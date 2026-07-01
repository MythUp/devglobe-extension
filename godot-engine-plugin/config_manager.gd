@tool
class_name DevGlobeConfigManager
extends RefCounted
## ConfigManager — Reads/writes ~/.devglobe/config.toml.
## Ported from devglobe-core/src/config.ts with TOML parsing/stringifying.

var api_key: String = ""
var debug: bool = false
var tracking_enabled: bool = true


func _init() -> void:
	_load()


func save() -> void:
	var dir := _devglobe_dir()
	if not DirAccess.dir_exists_absolute(dir):
		DirAccess.make_dir_recursive_absolute(dir)

	var content := _stringify_toml()
	var file := FileAccess.open(_config_path(), FileAccess.WRITE)
	if file:
		file.store_string(content)
		file.close()


func reload() -> void:
	_load()


# ---------------------------------------------------------------------------
# Internal
# ---------------------------------------------------------------------------

func _load() -> void:
	if not FileAccess.file_exists(_config_path()):
		_migrate_legacy_key()
		return

	var file := FileAccess.open(_config_path(), FileAccess.READ)
	if file == null:
		return

	var content := file.get_as_text()
	file.close()
	_parse_toml(content)


func _parse_toml(content: String) -> void:
	# Reset to defaults
	api_key = ""
	debug = false
	tracking_enabled = true

	var section := ""
	for raw_line in content.split("\n"):
		var line := raw_line.strip_edges()
		if line == "" or line.begins_with("#"):
			continue

		# Section header
		if line.begins_with("[") and line.ends_with("]"):
			section = line.substr(1, line.length() - 2).strip_edges()
			continue

		# Key = Value
		var eq_idx := line.find("=")
		if eq_idx == -1:
			continue

		var key := line.substr(0, eq_idx).strip_edges()
		var raw_value := line.substr(eq_idx + 1).strip_edges()
		var value = _parse_toml_value(raw_value)

		if section == "" and key == "api_key" and value is String:
			api_key = value
		elif section == "" and key == "debug" and value is bool:
			debug = value
		elif section == "" and key == "tracking_enabled" and value is bool:
			tracking_enabled = value


func _parse_toml_value(raw: String) -> Variant:
	if raw == "true":
		return true
	if raw == "false":
		return false
	if raw.begins_with('"') and raw.ends_with('"'):
		return raw.substr(1, raw.length() - 2)
	return raw


func _stringify_toml() -> String:
	var lines := PackedStringArray()

	if api_key != "":
		lines.append('api_key = "%s"' % api_key)
	if debug:
		lines.append("debug = true")
	if tracking_enabled:
		lines.append("tracking_enabled = true")

	return "\n".join(lines) + "\n"


func _migrate_legacy_key() -> void:
	var legacy_path := _legacy_api_key_path()
	if not FileAccess.file_exists(legacy_path):
		return

	var file := FileAccess.open(legacy_path, FileAccess.READ)
	if file == null:
		return

	var key := file.get_as_text().strip_edges()
	file.close()

	if key != "":
		api_key = key
		save()
		prints("[DevGlobe:Config] migrated legacy ~/.devglobe/api_key to config.toml")


static func _devglobe_dir() -> String:
	var home := ""
	match OS.get_name():
		"Windows":
			home = OS.get_environment("USERPROFILE")
		_:
			home = OS.get_environment("HOME")
	return home + "/.devglobe"


static func _config_path() -> String:
	return _devglobe_dir() + "/config.toml"


static func _legacy_api_key_path() -> String:
	return _devglobe_dir() + "/api_key"
