@tool
extends EditorPlugin
## DevGlobe Diagnostic — Minimal test to find parse errors.
##
## Install this INSTEAD of devglobe_plugin.gd in plugin.cfg to test
## which script has a parse error. It tries to load each script one by one
## and logs the result.
##
## Usage:
##   1. In plugin.cfg, change: script="devglobe_diagnostic.gd"
##   2. Restart Godot — check Output panel for [DevGlobe:Diag] messages
##   3. Once fixed, restore: script="devglobe_plugin.gd"

const LOG_FILE = "user://devglobe_diagnostic.log"


func _get_plugin_name() -> String:
	return "DevGlobe Diagnostic"


func _enter_tree() -> void:
	_write_log("=== DevGlobe Diagnostic Start ===")
	_write_log("Godot version: %s" % Engine.get_version_info())

	# Test each script individually
	var scripts := [
		"res://addons/devglobe/config_manager.gd",
		"res://addons/devglobe/daemon_process.gd",
		"res://addons/devglobe/settings_dialog.gd",
		"res://addons/devglobe/devglobe_plugin.gd",
	]

	for path in scripts:
		_test_load_script(path)

	_write_log("=== DevGlobe Diagnostic End ===")
	_write_log("Log file: %s" % ProjectSettings.globalize_path(LOG_FILE))
	push_warning("[DevGlobe:Diag] Check Output panel and log file at: %s" % ProjectSettings.globalize_path(LOG_FILE))


func _exit_tree() -> void:
	pass


func _test_load_script(path: String) -> void:
	_write_log("Testing: %s" % path)

	# Check if file exists
	if not FileAccess.file_exists(path):
		_write_log("  FAIL: File does not exist!")
		return

	# Try to load the script
	var script = load(path)
	if script == null:
		_write_log("  FAIL: load() returned null — PARSE ERROR in this script!")
		# Try to read the file and check for common issues
		_check_common_issues(path)
		return

	# Try to instantiate (RefCounted scripts only)
	if script.instance_is_base_type_of(RefCounted) or script.instance_is_base_type_of(Node):
		_write_log("  OK: Script loaded successfully (base type valid)")
	else:
		_write_log("  OK: Script loaded (type: %s)" % str(script))

	# Try .new() for RefCounted-based scripts
	if path.find("config_manager") != -1 or path.find("settings_dialog") != -1:
		var instance = null
		if path.find("settings_dialog") != -1:
			# settings_dialog needs a config param in _init
			var config_script = load("res://addons/devglobe/config_manager.gd")
			if config_script != null:
				var config = config_script.new()
				instance = script.new(config)
			else:
				_write_log("  SKIP: Cannot test .new() — config_manager.gd failed to load")
				return
		else:
			instance = script.new()
		if instance != null:
			_write_log("  OK: Instance created successfully")
		else:
			_write_log("  FAIL: .new() returned null")


func _check_common_issues(path: String) -> void:
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		_write_log("  Cannot read file for analysis")
		return

	var content := file.get_as_text()
	file.close()

	var lines := content.split("\n")
	_write_log("  File has %d lines" % lines.size())

	# Check for @tool
	if not content.begins_with("@tool"):
		_write_log("  WARNING: File does not start with @tool — required for EditorPlugin scripts")

	# Check for class_name on @tool scripts
	if "@tool" in content and "class_name" in content:
		_write_log("  WARNING: @tool + class_name may cause issues in Godot 4.x")

	# Check for typed empty arrays that might cause issues
	var line_num := 0
	for line in lines:
		line_num += 1
		var trimmed := line.strip_edges()

		# Check for var x := [] (infers typed empty array)
		if trimmed.begins_with("var ") and ":= []" in trimmed:
			_write_log("  WARNING line %d: ':= []' infers typed empty array — use ': Array = []' instead" % line_num)

		# Check for Dictionary.get() without cast
		if ".get(" in trimmed and "Dictionary" not in trimmed:
			_write_log("  INFO line %d: Uses .get() — may need explicit type cast" % line_num)

		# Check for OS.execute with typed array
		if "OS.execute" in trimmed:
			_write_log("  INFO line %d: OS.execute — output array must be untyped" % line_num)


func _write_log(msg: String) -> void:
	var full_msg: String = "[DevGlobe:Diag] " + msg
	print(full_msg)
	push_warning(full_msg)

	# Also write to file (append mode)
	var file: FileAccess = FileAccess.open(LOG_FILE, FileAccess.READ)
	var existing: String = ""
	if file != null:
		existing = file.get_as_text()
		file.close()

	file = FileAccess.open(LOG_FILE, FileAccess.WRITE)
	if file != null:
		file.store_string(existing + full_msg + "\n")
		file.close()
