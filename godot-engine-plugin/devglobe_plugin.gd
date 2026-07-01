@tool
extends EditorPlugin
## DevGlobe Godot Editor Plugin — Thin wrapper around devglobe-core daemon.
##
## This plugin does NOT reimplement any devglobe-core logic.
## ALL tracking (dedup, keepalive, git detection, language mapping,
## privacy, heartbeat batching, offline detection) is handled by
## the devglobe-core daemon subprocess.
##
## This plugin only:
##   1. Spawns `devglobe-core daemon` via DaemonProcess
##   2. Sends `init`, `activity`, `pause`, `resume`, `shutdown` messages
##   3. Listens for daemon events to update the toolbar UI
##   4. Provides a settings dialog for API key configuration

const PLUGIN_VERSION := "2.0.0"
const EDITOR_NAME := "godot"

# Core — single subprocess, no reimplemented logic
var _daemon: DevGlobeDaemonProcess
var _config: DevGlobeConfigManager
var _settings_ui: DevGlobeSettingsDialog

# UI
var _toolbar_button: Button

# State (only what the UI needs)
var _configured := false
var _offline := false
var _today_seconds := 0
var _paused := false
var _current_language := ""
var _daemon_connected := false
var _pending_activity: Dictionary = {}  # Buffered activity to send once daemon connects
var _user_initiated_connect := false  # True when user clicked Connect (not auto-connect at startup)


# ---------------------------------------------------------------------------
# EditorPlugin lifecycle
# ---------------------------------------------------------------------------

func _get_plugin_name() -> String:
	return "DevGlobe"


func _enter_tree() -> void:
	# Config manager — only for reading/displaying current config
	var config_script := load("res://addons/devglobe/config_manager.gd")
	_config = (config_script as Script).new() as DevGlobeConfigManager

	# Daemon subprocess — the single source of truth for ALL logic
	var daemon_script := load("res://addons/devglobe/daemon_process.gd")
	_daemon = (daemon_script as Script).new() as DevGlobeDaemonProcess
	_daemon.event_received.connect(_on_daemon_event)
	_daemon.connected.connect(_on_daemon_connected)
	add_child(_daemon)  # add_child BEFORE start() so _ready() runs first

	if not _daemon.start():
		_log("devglobe-core daemon not found — plugin inactive")
		_log("Install devglobe-core: npm install -g devglobe-core")
		_configured = false

	# Start paused if tracking is disabled (default: false)
	_paused = not _config.tracking_enabled

	# Settings dialog
	var settings_script := load("res://addons/devglobe/settings_dialog.gd")
	_settings_ui = (settings_script as Script).new(_config) as DevGlobeSettingsDialog
	var dialog: AcceptDialog = _settings_ui.build()
	_settings_ui.connect_requested.connect(_on_connect_requested)
	_settings_ui.set_status_requested.connect(_on_set_status_requested)
	_settings_ui.start_tracking_requested.connect(_on_start_tracking_requested)
	_settings_ui.stop_tracking_requested.connect(_on_stop_tracking_requested)
	_settings_ui.disconnect_requested.connect(_on_disconnect_requested)
	add_child(dialog)

	# Toolbar button
	_build_toolbar_button()

	# Connect editor signals for activity tracking
	var script_editor := get_editor_interface().get_script_editor()
	script_editor.editor_script_changed.connect(_on_script_changed)

	# Note: Godot 4 doesn't have a global resource_saved signal.
	# We rely on editor_script_changed for script tab switches
	# and the daemon's heartbeat for periodic activity reporting.

	_log("DevGlobe plugin initialized")


func _exit_tree() -> void:
	if _daemon and _daemon.is_running():
		_send_shutdown()
		_daemon.stop()

	if _toolbar_button:
		remove_control_from_container(CONTAINER_TOOLBAR, _toolbar_button)
		_toolbar_button.queue_free()

	_log("DevGlobe plugin shut down")


func _has_settings() -> bool:
	return true


func _get_settings_dialog() -> AcceptDialog:
	return _settings_ui.get_dialog()


# ---------------------------------------------------------------------------
# Daemon communication — thin wrappers, NO logic here
# ---------------------------------------------------------------------------

func _on_daemon_connected() -> void:
	_log("daemon TCP connected, sending init")
	_daemon_connected = true
	_send_init()
	# If tracking is disabled, pause immediately after init
	if _paused:
		_daemon.send_message({"method": "pause"})
	else:
		# Ensure daemon is in active state (e.g. after Connect)
		_daemon.send_message({"method": "resume"})
	# Send any activity that was buffered before the daemon was ready
	if _pending_activity.size() > 0:
		var pending_params: Dictionary = _pending_activity.get("params", {})
		_log("sending pending activity: %s [%s]" % [pending_params.get("file", ""), pending_params.get("language", "")])
		_daemon.send_message(_pending_activity)
		_pending_activity = {}
	# Update dialog to show connected state
	_settings_ui.set_connected(true, not _paused, _today_seconds, _current_language)


func _send_init() -> void:
	_daemon.send_message({
		"method": "init",
		"params": {
			"plugin_version": PLUGIN_VERSION,
			"editor": EDITOR_NAME,
		}
	})


func _send_activity(file: String, language: String) -> void:
	# Always forward activity to the daemon — it handles dedup and pause logic.
	# The daemon already knows the pause state via pause/resume messages.
	var msg := {
		"method": "activity",
		"params": {
			"file": file,
			"language": language,
		}
	}
	if _daemon.is_running():
		_daemon.send_message(msg)
	else:
		# Buffer the activity — it will be sent once the daemon connects
		_pending_activity = msg
		_log("buffered activity (daemon not ready): %s [%s]" % [file, language])


func _send_pause() -> void:
	_paused = true
	_daemon.send_message({"method": "pause"})
	_update_toolbar_icon()


func _send_resume() -> void:
	_paused = false
	_daemon.send_message({"method": "resume"})
	_update_toolbar_icon()


func _send_shutdown() -> void:
	_daemon.send_message({"method": "shutdown"})


# ---------------------------------------------------------------------------
# Daemon event handling — update UI state only
# ---------------------------------------------------------------------------

func _on_daemon_event(event: Dictionary) -> void:
	var event_type = event.get("event", "")

	match event_type:
		"ready":
			var data_dict: Dictionary = event.get("data", {})
			_configured = data_dict.get("configured", false)
			if not _configured:
				_show_not_configured()
			else:
				# Successfully connected with valid API key —
				# close connection popup and reopen in connected/config state
				_transition_to_connected_ui()
			_log("daemon ready, configured=%s" % str(_configured))

		"not_configured":
			_configured = false
			_show_not_configured()

		"invalid_api_key":
			_configured = false
			_show_invalid_key()

		"heartbeat_ok":
			var data: Dictionary = event.get("data", {})
			_today_seconds = data.get("today_seconds", 0)
			var lang: String = data.get("language", "")
			if lang != "":
				_current_language = lang
			_offline = false
			_update_toolbar_icon()
			# Update dialog stats if it's visible
			_settings_ui.update_stats(_today_seconds, _current_language)

		"offline":
			_offline = true
			_update_toolbar_icon()

		"online":
			_offline = false
			_update_toolbar_icon()

		"status_ok":
			_log("status set ok")

		"status_error":
			var err_data: Dictionary = event.get("data", {})
			_log("status error: %s" % str(err_data.get("message", "")))

		_:
			_log("unknown daemon event: %s" % event_type)


# ---------------------------------------------------------------------------
# Editor signal handlers
# ---------------------------------------------------------------------------

func _on_script_changed(script: Resource) -> void:
	if script == null:
		return
	var res_path: String = script.resource_path
	if res_path == "":
		return
	# Convert Godot virtual path (res://) to a real filesystem path.
	# The daemon's git.ts needs actual OS paths to detect git repos;
	# virtual paths like "res://new_script.gd" cause silent failures.
	var file_path: String = ProjectSettings.globalize_path(res_path)
	var language := _guess_language(file_path)
	if language != "":
		_current_language = language
	_log("script changed: %s → %s [%s]" % [res_path, file_path, language])
	_send_activity(file_path, language)


func _guess_language(file_path: String) -> String:
	## Quick hint for Godot-specific extensions.
	## devglobe-core also has its own mapping, but passing the language
	## explicitly avoids ambiguity for .gd files.
	var ext := file_path.get_extension().to_lower()
	match ext:
		"gd":
			return "GDScript"
		"gdshader", "shader":
			return "Godot Shader"
		"tscn":
			return "Godot Scene"
		"tres":
			return "Godot Resource"
		"cfg":
			return "INI"
		"import":
			return "INI"
		_:
			return ""  # Let devglobe-core figure it out


# ---------------------------------------------------------------------------
# Settings dialog signal handlers
# ---------------------------------------------------------------------------

func _on_connect_requested(api_key: String) -> void:
	_log("connect requested with API key")
	_user_initiated_connect = true
	_config.api_key = api_key
	_config.tracking_enabled = true
	_config.save()

	# Run devglobe-core setup to persist the API key in the daemon's own config.
	# This must happen before restarting the daemon so it picks up the new key.
	if api_key != "":
		var core_path := _find_core_binary()
		if core_path != "":
			var output := []
			var exit_code := OS.execute("node", [core_path, "setup", api_key], output)
			_log("devglobe-core setup exit=%d" % exit_code)
		else:
			_log("could not find devglobe-core binary for setup")

	# Stop the existing daemon first
	if _daemon:
		_daemon.stop()

	# Auto-resume tracking — user clicked Connect, they want to track
	_paused = false

	# Restart the daemon — it will read the new API key from config
	# and send init automatically when connected
	if _daemon and _daemon.start():
		_log("daemon restarted with new API key")
		_settings_ui.set_connected(false, false, 0, "")
	else:
		_log("failed to restart daemon after connect")


## Find the devglobe-core .js file (resolves .cmd wrappers on Windows).
func _find_core_binary() -> String:
	var is_windows := OS.get_name() == "Windows"
	var home := _home_dir()

	# 1. Check ~/.devglobe/core/devglobe-core.js (canonical install location)
	var core_js := home + "/.devglobe/core/devglobe-core.js"
	if FileAccess.file_exists(core_js):
		_log("found devglobe-core at: %s" % core_js)
		return core_js

	# 2. On Windows, resolve the npm .cmd wrapper to the underlying .js
	if is_windows:
		var appdata := OS.get_environment("APPDATA")
		if appdata != "":
			var npm_cmd := appdata + "/npm/devglobe-core.cmd"
			if FileAccess.file_exists(npm_cmd):
				var npm_lib := appdata + "/npm/node_modules/devglobe-core/dist/devglobe-core.js"
				if FileAccess.file_exists(npm_lib):
					_log("resolved devglobe-core.cmd -> %s" % npm_lib)
					return npm_lib

	# 3. Try npm global bin on non-Windows
	if not is_windows:
		if FileAccess.file_exists("/usr/local/bin/devglobe-core"):
			return "/usr/local/bin/devglobe-core"

	_log("devglobe-core binary not found")
	return ""


func _on_set_status_requested(message: String) -> void:
	if _daemon.is_running():
		_daemon.send_message({
			"method": "set_status",
			"params": {
				"message": message,
			}
		})
		_log("sent status to daemon: %s" % message)


func _on_start_tracking_requested() -> void:
	_send_resume()
	_config.tracking_enabled = true
	_config.save()
	_settings_ui.set_tracking(true)


func _on_stop_tracking_requested() -> void:
	_send_pause()
	_config.tracking_enabled = false
	_config.save()
	_settings_ui.set_tracking(false)


func _on_disconnect_requested() -> void:
	_log("disconnect requested")
	_config.api_key = ""
	_config.save()
	_daemon_connected = false
	_configured = false
	_update_toolbar_icon()
	# Update dialog to show disconnected state
	_settings_ui.set_connected(false)


func _show_not_configured() -> void:
	_configured = false
	_update_toolbar_icon()
	_log("not configured — enter your API key in DevGlobe settings")


## Called when daemon reports ready+configured — update UI to connected state.
## Only opens the popup if the user explicitly clicked Connect;
## at startup with a saved API key, we update state silently.
func _transition_to_connected_ui() -> void:
	if _settings_ui and _settings_ui.get_dialog().visible:
		_settings_ui.get_dialog().hide()
	_settings_ui.set_connected(true, not _paused, _today_seconds, _current_language)
	if _user_initiated_connect:
		# User clicked Connect — show the connected popup
		_settings_ui.popup(true, not _paused, _today_seconds, _current_language)
		_user_initiated_connect = false
	_update_toolbar_icon()


func _show_invalid_key() -> void:
	_configured = false
	_update_toolbar_icon()
	_log("invalid API key — check your DevGlobe settings")


# ---------------------------------------------------------------------------
# Toolbar UI
# ---------------------------------------------------------------------------

func _build_toolbar_button() -> void:
	_toolbar_button = Button.new()
	_toolbar_button.flat = true
	_toolbar_button.tooltip_text = "DevGlobe"
	_toolbar_button.pressed.connect(_on_toolbar_pressed)
	_update_toolbar_icon()
	add_control_to_container(CONTAINER_TOOLBAR, _toolbar_button)


func _on_toolbar_pressed() -> void:
	_settings_ui.popup(_daemon_connected and _configured, not _paused, _today_seconds, _current_language)


func _update_toolbar_icon() -> void:
	if _toolbar_button == null:
		return

	if not _configured:
		_toolbar_button.text = "DG ⚠"
		_toolbar_button.tooltip_text = "DevGlobe — Not configured"
	elif _offline:
		_toolbar_button.text = "DG ◌"
		_toolbar_button.tooltip_text = "DevGlobe — Offline"
	elif _paused:
		_toolbar_button.text = "DG ‖"
		_toolbar_button.tooltip_text = "DevGlobe — Paused"
	else:
		var h := _today_seconds / 3600
		var m := (_today_seconds % 3600) / 60
		var time_str: String
		if h > 0:
			time_str = "%dh %dm" % [h, m]
		else:
			time_str = "%dm" % m
		_toolbar_button.text = "DG ● %s" % time_str
		_toolbar_button.tooltip_text = "DevGlobe — Tracking (%s today)" % time_str


# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

static func _home_dir() -> String:
	match OS.get_name():
		"Windows":
			return OS.get_environment("USERPROFILE")
		_:
			return OS.get_environment("HOME")


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

func _log(msg: String) -> void:
	prints("[DevGlobe] " + msg)
