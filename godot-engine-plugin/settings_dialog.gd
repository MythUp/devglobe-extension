@tool
## DevGlobe SettingsDialog — UI for configuring the plugin.
## Two states:
##   Not connected: API key field + Connect button
##   Connected: hours coded, current language, separator,
##             status field + Set button, Start/Stop tracking, Disconnect

class_name DevGlobeSettingsDialog
extends RefCounted

# Signals emitted to the plugin
signal connect_requested(api_key: String)
signal set_status_requested(message: String)
signal start_tracking_requested()
signal stop_tracking_requested()
signal disconnect_requested()

var _config: RefCounted
var _dialog: AcceptDialog

# Not-connected state widgets
var _not_connected_box: VBoxContainer
var _api_key_line: LineEdit
var _connect_btn: Button

# Connected state widgets
var _connected_box: VBoxContainer
var _hours_label: Label
var _language_label: Label
var _status_line: LineEdit
var _set_status_btn: Button
var _start_tracking_btn: Button
var _stop_tracking_btn: Button
var _disconnect_btn: Button

# State passed from plugin
var _is_connected := false
var _is_tracking := false


func _init(config: RefCounted) -> void:
	_config = config


## Build the dialog UI (call once).
func build() -> AcceptDialog:
	_dialog = AcceptDialog.new()
	_dialog.title = "DevGlobe"
	_dialog.min_size = Vector2i(420, 300)

	var vbox := VBoxContainer.new()
	_dialog.add_child(vbox)

	# --- Not connected state ---
	_not_connected_box = VBoxContainer.new()
	vbox.add_child(_not_connected_box)

	var key_label := Label.new()
	key_label.text = "API Key:"
	_not_connected_box.add_child(key_label)

	_api_key_line = LineEdit.new()
	_api_key_line.placeholder_text = "Enter your DevGlobe API key"
	_api_key_line.secret = true
	_api_key_line.text = ""  # Never pre-fill
	_not_connected_box.add_child(_api_key_line)

	_connect_btn = Button.new()
	_connect_btn.text = "Connect"
	_connect_btn.tooltip_text = "Connect to DevGlobe with the provided API key"
	_not_connected_box.add_child(_connect_btn)
	_connect_btn.pressed.connect(_on_connect_pressed)

	# --- Connected state ---
	_connected_box = VBoxContainer.new()
	vbox.add_child(_connected_box)

	_hours_label = Label.new()
	_hours_label.text = "Today: 0m"
	_hours_label.add_theme_font_size_override("font_size", 16)
	_connected_box.add_child(_hours_label)

	_language_label = Label.new()
	_language_label.text = "Language: —"
	_connected_box.add_child(_language_label)

	var sep := HSeparator.new()
	_connected_box.add_child(sep)

	# Status field + Set button side by side
	var status_hbox := HBoxContainer.new()
	_connected_box.add_child(status_hbox)

	_status_line = LineEdit.new()
	_status_line.placeholder_text = "e.g. Working on boss fight..."
	_status_line.clear_button_enabled = true
	_status_line.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	status_hbox.add_child(_status_line)

	_set_status_btn = Button.new()
	_set_status_btn.text = "Set"
	_set_status_btn.tooltip_text = "Send this status message"
	status_hbox.add_child(_set_status_btn)
	_set_status_btn.pressed.connect(_on_set_status_pressed)

	# Tracking buttons side by side
	var tracking_hbox := HBoxContainer.new()
	_connected_box.add_child(tracking_hbox)

	_start_tracking_btn = Button.new()
	_start_tracking_btn.text = "Start Tracking"
	_start_tracking_btn.tooltip_text = "Start tracking coding activity"
	tracking_hbox.add_child(_start_tracking_btn)
	_start_tracking_btn.pressed.connect(_on_start_tracking_pressed)

	_stop_tracking_btn = Button.new()
	_stop_tracking_btn.text = "Stop Tracking"
	_stop_tracking_btn.tooltip_text = "Stop tracking coding activity"
	tracking_hbox.add_child(_stop_tracking_btn)
	_stop_tracking_btn.pressed.connect(_on_stop_tracking_pressed)

	_disconnect_btn = Button.new()
	_disconnect_btn.text = "Disconnect"
	_disconnect_btn.tooltip_text = "Disconnect from DevGlobe"
	_connected_box.add_child(_disconnect_btn)
	_disconnect_btn.pressed.connect(_on_disconnect_pressed)

	# Initially show not-connected state
	_update_visibility()

	return _dialog


## Get the built AcceptDialog node.
func get_dialog() -> AcceptDialog:
	return _dialog


## Update connection state from the plugin (e.g. when daemon connects/disconnects).
func set_connected(connected: bool, tracking: bool = false, today_seconds: int = 0, current_language: String = "") -> void:
	_is_connected = connected
	_is_tracking = tracking
	_hours_label.text = "Today: %s" % _format_seconds(today_seconds)
	_language_label.text = "Language: %s" % (current_language if current_language != "" else "—")
	_start_tracking_btn.disabled = _is_tracking
	_stop_tracking_btn.disabled = not _is_tracking
	_update_visibility()


## Update tracking state from the plugin.
func set_tracking(tracking: bool) -> void:
	_is_tracking = tracking
	_start_tracking_btn.disabled = _is_tracking
	_stop_tracking_btn.disabled = not _is_tracking


## Update displayed stats from the plugin.
func update_stats(today_seconds: int, current_language: String) -> void:
	_hours_label.text = "Today: %s" % _format_seconds(today_seconds)
	_language_label.text = "Language: %s" % (current_language if current_language != "" else "—")


## Popup the dialog centered, refreshing all values.
func popup(connected: bool, tracking: bool, today_seconds: int, current_language: String) -> void:
	if _dialog == null:
		return

	_is_connected = connected
	_is_tracking = tracking

	# Refresh values
	_api_key_line.text = ""  # Never pre-fill API key
	_hours_label.text = "Today: %s" % _format_seconds(today_seconds)
	_language_label.text = "Language: %s" % (current_language if current_language != "" else "—")

	# Update tracking button states
	_start_tracking_btn.disabled = _is_tracking
	_stop_tracking_btn.disabled = not _is_tracking

	_update_visibility()
	_dialog.popup_centered()


## Update which panel is visible based on connection state.
func _update_visibility() -> void:
	if _not_connected_box:
		_not_connected_box.visible = not _is_connected
	if _connected_box:
		_connected_box.visible = _is_connected


# ---------------------------------------------------------------------------
# Button handlers — emit signals for the plugin to handle
# ---------------------------------------------------------------------------

func _on_connect_pressed() -> void:
	var key := _api_key_line.text.strip_edges()
	if key != "":
		connect_requested.emit(key)


func _on_set_status_pressed() -> void:
	var msg := _status_line.text.strip_edges()
	if msg != "":
		set_status_requested.emit(msg)
		_status_line.clear()


func _on_start_tracking_pressed() -> void:
	start_tracking_requested.emit()
	_is_tracking = true
	_start_tracking_btn.disabled = true
	_stop_tracking_btn.disabled = false


func _on_stop_tracking_pressed() -> void:
	stop_tracking_requested.emit()
	_is_tracking = false
	_start_tracking_btn.disabled = false
	_stop_tracking_btn.disabled = true


func _on_disconnect_pressed() -> void:
	disconnect_requested.emit()
	# The plugin will call set_connected(false, ...) when it processes the disconnect
	_is_connected = false
	_update_visibility()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

## Get the current API key from the dialog input.
func get_api_key() -> String:
	if _api_key_line:
		return _api_key_line.text.strip_edges()
	return ""


## Get the current status message from the dialog input.
func get_status_message() -> String:
	if _status_line:
		return _status_line.text.strip_edges()
	return ""


static func _format_seconds(s: int) -> String:
	var h := s / 3600
	var m := (s % 3600) / 60
	if h > 0:
		return "%dh %dm" % [h, m]
	return "%dm" % m
