@tool
class_name DevGlobeDaemonProcess
extends Node
## DaemonProcess — Manages the devglobe-core daemon via a TCP bridge.
##
## Since Godot 4.x does not support stdin/stdout pipes with OS.create_process(),
## we use a Node.js TCP bridge (tcp-bridge.js) that spawns the daemon and
## exposes its stdin/stdout protocol over a localhost TCP socket.
##
## Flow:  Godot Plugin  <--->  TCP Socket (127.0.0.1:PORT)  <--->  tcp-bridge.js  <--->  devglobe-core daemon

signal event_received(event: Dictionary)
signal connected()

var _bridge_pid: int = -1
var _tcp_client: StreamPeerTCP
var _running := false
var _read_buffer := ""
var _connect_timer: Timer
var _poll_timer: Timer
var _port: int = 0
var _reconnect_attempts := 0
var _using_process_frame := false
const MAX_RECONNECT := 8


func _ready() -> void:
	set_process(false)  # Only process when we have a TCP client to poll

	_connect_timer = Timer.new()
	_connect_timer.one_shot = true
	_connect_timer.wait_time = 0.5
	_connect_timer.timeout.connect(_retry_connect)
	add_child(_connect_timer)

	# Dedicated polling timer — more reliable than _process() in editor context
	_poll_timer = Timer.new()
	_poll_timer.one_shot = false
	_poll_timer.wait_time = 0.016  # ~60Hz
	_poll_timer.autostart = false
	_poll_timer.timeout.connect(_poll_tcp)
	add_child(_poll_timer)

	# Also try process_frame signal as a fallback
	_using_process_frame = false
	if get_tree() and not get_tree().process_frame.is_connected(_poll_tcp):
		get_tree().process_frame.connect(_poll_tcp)
		_using_process_frame = true
		_log("connected to process_frame signal")
	else:
		_log("get_tree() is null or process_frame already connected — skipping")


func _ensure_timers() -> void:
	# Timers may not exist if _ready() hasn't run yet (e.g. start() called
	# before add_child). Create them on demand.
	if _connect_timer == null:
		_connect_timer = Timer.new()
		_connect_timer.one_shot = true
		_connect_timer.wait_time = 0.5
		_connect_timer.timeout.connect(_retry_connect)
		add_child(_connect_timer)
	if _poll_timer == null:
		_poll_timer = Timer.new()
		_poll_timer.one_shot = false
		_poll_timer.wait_time = 0.016  # ~60Hz
		_poll_timer.autostart = false
		_poll_timer.timeout.connect(_poll_tcp)
		add_child(_poll_timer)
	if not _using_process_frame and get_tree() and not get_tree().process_frame.is_connected(_poll_tcp):
		get_tree().process_frame.connect(_poll_tcp)
		_using_process_frame = true
		_log("connected to process_frame signal (deferred)")


func is_running() -> bool:
	return _running and _tcp_client != null and _tcp_client.get_status() == StreamPeerTCP.STATUS_CONNECTED


func start() -> bool:
	_ensure_timers()

	# Find a free port and launch the TCP bridge
	_port = _find_free_port()
	if _port == 0:
		push_warning("[DevGlobe] could not find a free port for TCP bridge")
		return false

	var bridge_path := _find_bridge_script()
	if bridge_path == "":
		push_warning("[DevGlobe] tcp-bridge.js not found")
		return false

	var node_path := _find_node()
	if node_path == "":
		push_warning("[DevGlobe] Node.js not found — required to run tcp-bridge.js")
		return false

	_log("using Node.js: %s" % node_path)
	_log("using bridge: %s" % bridge_path)
	_log("using port: %d" % _port)

	# Launch the TCP bridge process
	var args := PackedStringArray()
	args.push_back(bridge_path)
	args.push_back(str(_port))
	_bridge_pid = OS.create_process(node_path, args)
	if _bridge_pid == -1:
		push_warning("[DevGlobe] failed to start TCP bridge process")
		return false

	_log("bridge process started (pid %d)" % _bridge_pid)

	# Schedule the first connection attempt after a delay.
	# The bridge needs time to: start Node.js → listen on TCP → be ready.
	# We use the reconnect timer with a longer initial delay (3s).
	_reconnect_attempts = 0
	_connect_timer.wait_time = 3.0
	_connect_timer.start()
	_log("first connection attempt scheduled in 3s ...")
	return true


func stop() -> void:
	set_process(false)
	if _poll_timer:
		_poll_timer.stop()
	if _using_process_frame and get_tree() and get_tree().process_frame.is_connected(_poll_tcp):
		get_tree().process_frame.disconnect(_poll_tcp)
		_using_process_frame = false
	if _tcp_client != null:
		_tcp_client.disconnect_from_host()
		_tcp_client = null
	if _bridge_pid > 0:
		OS.kill(_bridge_pid)
		_bridge_pid = -1
	_running = false
	_log("daemon stopped")


func send_message(msg: Dictionary) -> void:
	if not is_running():
		_log("cannot send message — daemon not running")
		return

	var json_str := JSON.stringify(msg) + "\n"
	_tcp_client.put_data(json_str.to_utf8_buffer())


# ---------------------------------------------------------------------------
# TCP connection
# ---------------------------------------------------------------------------

var _connect_start_msec := 0
const CONNECT_TIMEOUT_MSEC := 5000  # 5s max to wait for TCP connection


func _try_connect() -> void:
	_ensure_timers()

	_tcp_client = StreamPeerTCP.new()
	_log("attempting TCP connect to 127.0.0.1:%d ..." % _port)
	var err := _tcp_client.connect_to_host("127.0.0.1", _port)
	if err != OK:
		_log("TCP connect failed (error %d)" % err)
		_schedule_reconnect()
		return

	# Non-blocking: enable multiple polling mechanisms to advance TCP state.
	_connect_start_msec = Time.get_ticks_msec()
	_poll_count = 0
	set_process(true)
	# Reconnect process_frame for high-frequency connection polling
	if not _using_process_frame and get_tree() and not get_tree().process_frame.is_connected(_poll_tcp):
		get_tree().process_frame.connect(_poll_tcp)
		_using_process_frame = true
		_log("reconnected process_frame for connection polling")
	if _poll_timer:
		_poll_timer.wait_time = 0.016  # ~60Hz during connection phase
		_poll_timer.start()
	_log("TCP connect initiated, polling for connection (process=%s, timer=%s, frame=%s)..." % [
		str(is_processing()),
		str(_poll_timer.is_stopped() if _poll_timer else "N/A"),
		str(_using_process_frame),
	])


## Called by _poll_tcp on each tick. Handles the CONNECTING → CONNECTED transition.
func _check_connecting() -> void:
	if _tcp_client == null:
		return

	var status := _tcp_client.get_status()
	_log("_check_connecting: status=%d elapsed=%dms" % [status, Time.get_ticks_msec() - _connect_start_msec])
	if status == StreamPeerTCP.STATUS_CONNECTED:
		_running = true
		_reconnect_attempts = 0
		set_process(false)
		_switch_to_connected_polling()
		_log("connected to TCP bridge on port %d" % _port)
		connected.emit()
	elif status == StreamPeerTCP.STATUS_CONNECTING:
		# Check for timeout
		var elapsed := Time.get_ticks_msec() - _connect_start_msec
		if elapsed > CONNECT_TIMEOUT_MSEC:
			_log("TCP connect timed out after %dms, scheduling reconnect" % elapsed)
			set_process(false)
			if _poll_timer:
				_poll_timer.stop()
			_tcp_client.disconnect_from_host()
			_tcp_client = null
			_schedule_reconnect()
		# else: still connecting — wait for next poll tick
	else:
		# STATUS_NONE or STATUS_ERROR — connection failed
		_log("TCP connect failed (status=%d), scheduling reconnect" % status)
		set_process(false)
		if _poll_timer:
			_poll_timer.stop()
		_tcp_client = null
		_schedule_reconnect()


func _schedule_reconnect() -> void:
	_reconnect_attempts += 1
	if _reconnect_attempts < MAX_RECONNECT:
		_log("connection attempt %d failed, retrying in 0.5s..." % _reconnect_attempts)
		_connect_timer.wait_time = 0.5
		_connect_timer.start()
	else:
		_log("failed to connect to TCP bridge after %d attempts" % MAX_RECONNECT)
		_running = false


func _retry_connect() -> void:
	_try_connect()


func _process(_delta: float) -> void:
	_poll_tcp()


var _poll_count := 0
func _poll_tcp() -> void:
	if _tcp_client == null:
		return

	_poll_count += 1
	# Only log during connection phase or on status changes — not when stably connected
	var pre_status := _tcp_client.get_status()
	if pre_status != StreamPeerTCP.STATUS_CONNECTED:
		if _poll_count <= 5 or _poll_count % 60 == 0:
			_log("_poll_tcp #%d: status=%d" % [_poll_count, pre_status])

	_tcp_client.poll()

	# Re-read status AFTER poll() — poll() may change the connection state
	var status := _tcp_client.get_status()

	if status == StreamPeerTCP.STATUS_CONNECTING:
		_check_connecting()
		return

	if status == StreamPeerTCP.STATUS_CONNECTED:
		# First time entering CONNECTED state — initialize connected state
		if not _running:
			_running = true
			_reconnect_attempts = 0
			set_process(false)
			_switch_to_connected_polling()
			_log("connected to TCP bridge on port %d" % _port)
			connected.emit()

		# Read available data
		var available := _tcp_client.get_available_bytes()
		while available > 0:
			var result: Array = _tcp_client.get_data(available)
			var err: int = result[0]
			if err != OK:
				break
			var bytes: PackedByteArray = result[1]
			var text = bytes.get_string_from_utf8()
			_read_buffer += text
			_process_buffer()
			available = _tcp_client.get_available_bytes()
	elif status == StreamPeerTCP.STATUS_ERROR or status == StreamPeerTCP.STATUS_NONE:
		_handle_disconnect()


func _process_buffer() -> void:
	while true:
		var newline_pos := _read_buffer.find("\n")
		if newline_pos == -1:
			break

		var line := _read_buffer.substr(0, newline_pos).strip_edges()
		_read_buffer = _read_buffer.substr(newline_pos + 1)

		if line == "":
			continue

		# The bridge may send "BRIDGE_READY:<port>" — ignore it
		if line.begins_with("BRIDGE_READY:"):
			continue

		var json := JSON.new()
		if json.parse(line) != OK:
			_log("failed to parse daemon output: %s" % line)
			continue

		var event = json.get_data()
		if event is Dictionary:
			event_received.emit(event)


func _switch_to_connected_polling() -> void:
	# After connection, we no longer need high-frequency process_frame polling.
	# Switch to timer-only at 100ms (10Hz) for reading daemon data.
	# process_frame is reconnected in _try_connect() for the next connection attempt.
	if _using_process_frame and get_tree() and get_tree().process_frame.is_connected(_poll_tcp):
		get_tree().process_frame.disconnect(_poll_tcp)
		_using_process_frame = false
		_log("disconnected process_frame — using timer-only polling")
	if _poll_timer:
		_poll_timer.wait_time = 0.1  # 100ms (10Hz) — sufficient for reading daemon events
		_poll_timer.start()
		_log("poll timer restarted at 100ms for connected state")


func _handle_disconnect() -> void:
	if _running:
		_log("TCP connection lost")
		_running = false
		set_process(false)
		if _poll_timer:
			_poll_timer.stop()
		_tcp_client = null
		event_received.emit({"event": "offline", "data": {}})


# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

func _find_bridge_script() -> String:
	# Look for tcp-bridge.js next to this script
	var script_res: String = (get_script() as Script).resource_path as String
	_log("script resource_path: %s" % script_res)
	var script_dir: String = script_res.get_base_dir() as String
	var bridge_path: String = script_dir + "/tcp-bridge.js"
	_log("checking bridge at: %s" % bridge_path)
	if FileAccess.file_exists(bridge_path):
		var global_path := ProjectSettings.globalize_path(bridge_path)
		_log("bridge found at: %s" % global_path)
		return global_path

	# Also check the addon directory structure
	var addon_path := "res://addons/devglobe/tcp-bridge.js"
	_log("checking bridge at: %s" % addon_path)
	if FileAccess.file_exists(addon_path):
		var global_path2 := ProjectSettings.globalize_path(addon_path)
		_log("bridge found at: %s" % global_path2)
		return global_path2

	_log("tcp-bridge.js not found")
	return ""


func _find_node() -> String:
	# Try to find Node.js executable
	var is_windows := OS.get_name() == "Windows"
	var node_name := "node" if not is_windows else "node.exe"

	# Check PATH
	var result = []
	var find_cmd := "where" if is_windows else "which"
	var exit_code := OS.execute(find_cmd, [node_name], result)
	_log("finding node: '%s' exit=%d output='%s'" % [find_cmd, exit_code, str(result)])
	if exit_code == 0 and result.size() > 0:
		var found := str(result[0]).strip_edges()
		# Windows "where" returns CRLF lines; clean up
		found = found.replace("\r", "").replace("\n", "")
		# "where" may return multiple lines; take the first
		if found.find("\n") >= 0:
			found = found.split("\n")[0].strip_edges()
		if found != "":
			_log("found node at: %s" % found)
			return found

	# Common locations
	var candidates := PackedStringArray()
	if is_windows:
		candidates.append("C:/Program Files/nodejs/node.exe")
		candidates.append("C:/Program Files (x86)/nodejs/node.exe")
		# Also check via APPDATA (nvm-windows)
		var appdata := OS.get_environment("APPDATA")
		if appdata != "":
			candidates.append(appdata + "/nvm/v20.10.0/node.exe")
			candidates.append(appdata + "/nvm/nodejs/node.exe")
	else:
		candidates.append("/usr/local/bin/node")
		candidates.append("/usr/bin/node")

	for candidate in candidates:
		if FileAccess.file_exists(candidate):
			_log("found node at: %s" % candidate)
			return candidate

	_log("Node.js not found in PATH or common locations")
	return ""


func _find_free_port() -> int:
	# Use a random port in the dynamic range
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	return rng.randi_range(49152, 65535)


static func _home_dir() -> String:
	match OS.get_name():
		"Windows":
			return OS.get_environment("USERPROFILE")
		_:
			return OS.get_environment("HOME")


func _log(msg: String) -> void:
	prints("[DevGlobe:Daemon] " + msg)
