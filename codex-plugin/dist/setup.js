"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/setup.ts
var import_fs = require("fs");
var import_os = require("os");
var import_path = require("path");

// ../devglobe-core/src/config.ts
var fs2 = __toESM(require("node:fs"), 1);
var path2 = __toESM(require("node:path"), 1);
var os = __toESM(require("node:os"), 1);

// ../devglobe-core/src/logger.ts
var fs = __toESM(require("node:fs"), 1);
var path = __toESM(require("node:path"), 1);
var LOG_FILE_NAME = "devglobe.log";
var MAX_LOG_BYTES = 5 * 1024 * 1024;
var TRUNCATE_KEEP_BYTES = 1 * 1024 * 1024;
var Logger = class {
  level = 0 /* Error */;
  editor = "";
  /**
   * Enabled when the config has `debug = true` in `~/.devglobe/config.toml`.
   * The editor tag is shown on every line so logs from multiple plugins
   * sharing the same file stay readable.
   */
  configure(debugFromConfig, editor) {
    this.level = debugFromConfig ? 2 /* Debug */ : 0 /* Error */;
    if (editor) this.editor = editor;
  }
  setEditor(editor) {
    this.editor = editor;
  }
  isEnabled() {
    return this.level >= 2 /* Debug */;
  }
  error(...args) {
    this.write("ERROR", args);
  }
  info(...args) {
    if (this.level >= 1 /* Info */) this.write("INFO", args);
  }
  debug(...args) {
    if (this.level >= 2 /* Debug */) this.write("DEBUG", args);
  }
  write(level, args) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const message = args.map(this.format).join(" ");
    const tag = this.editor ? `[${this.editor}]` : "";
    const line = `${timestamp} ${level} ${tag} ${message}
`.replace(/  +/g, " ");
    try {
      const filePath = this.logPath();
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(filePath, line, { mode: 384 });
      this.maybeRotate(filePath);
    } catch {
    }
  }
  maybeRotate(filePath) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.size <= MAX_LOG_BYTES) return;
      const fd = fs.openSync(filePath, "r");
      const buf = Buffer.alloc(TRUNCATE_KEEP_BYTES);
      fs.readSync(fd, buf, 0, TRUNCATE_KEEP_BYTES, stat.size - TRUNCATE_KEEP_BYTES);
      fs.closeSync(fd);
      fs.writeFileSync(filePath, buf, { mode: 384 });
    } catch {
    }
  }
  logPath() {
    return path.join(devglobeDir(), LOG_FILE_NAME);
  }
  format(arg) {
    if (typeof arg === "string") return arg;
    if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
};
var logger = new Logger();

// ../devglobe-core/src/config.ts
function defaultConfig() {
  return {
    apiKey: null,
    debug: false,
    privacy: { hideFileNames: false, hideBranchNames: false, hideProjectNames: false }
  };
}
function devglobeDir() {
  return path2.join(os.homedir(), ".devglobe");
}
function configPath() {
  return path2.join(devglobeDir(), "config.toml");
}
function legacyApiKeyPath() {
  return path2.join(devglobeDir(), "api_key");
}
function loadConfig() {
  const cfgPath = configPath();
  let cfg;
  if (!fs2.existsSync(cfgPath)) {
    cfg = migrateLegacyKey();
  } else {
    try {
      cfg = parseToml(fs2.readFileSync(cfgPath, "utf-8"));
    } catch {
      cfg = defaultConfig();
    }
  }
  logger.configure(cfg.debug);
  return cfg;
}
function saveConfig(cfg) {
  const dir = devglobeDir();
  if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
  fs2.writeFileSync(configPath(), stringifyToml(cfg), { mode: 384 });
}
function setApiKey(apiKey) {
  const cfg = loadConfig();
  cfg.apiKey = apiKey;
  saveConfig(cfg);
  logger.info("api key saved to config.toml");
}
function migrateLegacyKey() {
  const legacyPath = legacyApiKeyPath();
  if (!fs2.existsSync(legacyPath)) return defaultConfig();
  try {
    const key = fs2.readFileSync(legacyPath, "utf-8").trim();
    const cfg = defaultConfig();
    cfg.apiKey = key || null;
    saveConfig(cfg);
    logger.info("migrated legacy ~/.devglobe/api_key to config.toml");
    return cfg;
  } catch (err) {
    logger.error("failed to migrate legacy api_key", err);
    return defaultConfig();
  }
}
function parseTomlValue(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  return raw;
}
function parseToml(content) {
  const cfg = defaultConfig();
  let section = "";
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("[") && line.endsWith("]")) {
      section = line.slice(1, -1).trim();
      continue;
    }
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const value = parseTomlValue(line.slice(eqIdx + 1).trim());
    if (section === "" && key === "api_key" && typeof value === "string") {
      cfg.apiKey = value || null;
    } else if (section === "" && key === "debug" && typeof value === "boolean") {
      cfg.debug = value;
    } else if (section === "privacy" && typeof value === "boolean") {
      if (key === "hide_file_names") cfg.privacy.hideFileNames = value;
      else if (key === "hide_branch_names") cfg.privacy.hideBranchNames = value;
      else if (key === "hide_project_names") cfg.privacy.hideProjectNames = value;
    }
  }
  return cfg;
}
function stringifyToml(cfg) {
  const lines = [];
  if (cfg.apiKey) lines.push(`api_key = "${cfg.apiKey}"`);
  if (cfg.debug) lines.push(`debug = true`);
  lines.push("");
  lines.push("[privacy]");
  lines.push(`hide_file_names = ${cfg.privacy.hideFileNames}`);
  lines.push(`hide_branch_names = ${cfg.privacy.hideBranchNames}`);
  lines.push(`hide_project_names = ${cfg.privacy.hideProjectNames}`);
  return lines.join("\n") + "\n";
}

// src/setup.ts
async function main() {
  const raw = (0, import_fs.readFileSync)(0, "utf-8");
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    console.log(JSON.stringify({ error: 'invalid JSON input, expected {"api_key":"..."}' }));
    process.exit(1);
  }
  if (!input.api_key?.trim()) {
    console.log(JSON.stringify({ error: "api_key is required" }));
    process.exit(1);
  }
  setApiKey(input.api_key.trim());
  const codexDir = (0, import_path.join)((0, import_os.homedir)(), ".codex");
  (0, import_fs.mkdirSync)(codexDir, { recursive: true });
  const hooksPath = (0, import_path.join)(codexDir, "hooks.json");
  const skillDir = (0, import_path.join)((0, import_path.dirname)(__filename), "..");
  const scriptsDir = (0, import_path.join)(skillDir, "scripts");
  for (const script of ["heartbeat", "setup", "uninstall", "update-status", "find-node"]) {
    try {
      (0, import_fs.chmodSync)((0, import_path.join)(scriptsDir, script), 493);
    } catch {
    }
  }
  const heartbeatScript = (0, import_path.join)(scriptsDir, "heartbeat");
  const hookEntry = {
    matcher: "",
    hooks: [{ type: "command", command: heartbeatScript, timeout: 30 }]
  };
  let existing = { hooks: {} };
  try {
    existing = JSON.parse((0, import_fs.readFileSync)(hooksPath, "utf-8"));
    if (!existing.hooks) existing.hooks = {};
  } catch {
  }
  const events = ["SessionStart", "UserPromptSubmit", "Stop"];
  for (const event of events) {
    const eventHooks = existing.hooks[event] || [];
    const alreadyInstalled = eventHooks.some(
      (h) => h.hooks?.some((hh) => hh.command?.includes("devglobe"))
    );
    if (!alreadyInstalled) {
      eventHooks.push(hookEntry);
    }
    existing.hooks[event] = eventHooks;
  }
  (0, import_fs.writeFileSync)(hooksPath, JSON.stringify(existing, null, 2));
  const configTomlPath = (0, import_path.join)(codexDir, "config.toml");
  let tomlContent = "";
  try {
    tomlContent = (0, import_fs.readFileSync)(configTomlPath, "utf-8");
  } catch {
  }
  if (!tomlContent.includes("codex_hooks")) {
    if (tomlContent.includes("[features]")) {
      tomlContent = tomlContent.replace(
        /\[features\]/,
        "[features]\ncodex_hooks = true"
      );
    } else {
      const separator = tomlContent.length > 0 && !tomlContent.endsWith("\n") ? "\n\n" : tomlContent.length > 0 ? "\n" : "";
      tomlContent += `${separator}[features]
codex_hooks = true
`;
    }
    (0, import_fs.writeFileSync)(configTomlPath, tomlContent);
  }
  console.log(JSON.stringify({
    ok: true,
    message: `DevGlobe configured! API key saved to ~/.devglobe/config.toml, hooks installed in ${hooksPath}, codex_hooks feature enabled in config.toml. Restart Codex for hooks to take effect.`
  }));
}
main().catch(() => process.exit(1));
