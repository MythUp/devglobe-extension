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

// src/update-status.ts
var import_fs = require("fs");

// ../devglobe-core/src/constants.ts
var API_BASE_URL = "https://devglobe.app";
var HEARTBEAT_ENDPOINT = `${API_BASE_URL}/api/v2/heartbeat`;
var STATUS_ENDPOINT = `${API_BASE_URL}/api/v2/status`;
var FETCH_TIMEOUT_MS = 15e3;

// ../devglobe-core/src/logger.ts
var fs2 = __toESM(require("node:fs"), 1);
var path2 = __toESM(require("node:path"), 1);

// ../devglobe-core/src/config.ts
var fs = __toESM(require("node:fs"), 1);
var path = __toESM(require("node:path"), 1);
var os = __toESM(require("node:os"), 1);
function defaultConfig() {
  return {
    apiKey: null,
    debug: false,
    privacy: { hideFileNames: false, hideBranchNames: false, hideProjectNames: false }
  };
}
function devglobeDir() {
  return path.join(os.homedir(), ".devglobe");
}
function configPath() {
  return path.join(devglobeDir(), "config.toml");
}
function legacyApiKeyPath() {
  return path.join(devglobeDir(), "api_key");
}
function loadConfig() {
  const cfgPath = configPath();
  let cfg;
  if (!fs.existsSync(cfgPath)) {
    cfg = migrateLegacyKey();
  } else {
    try {
      cfg = parseToml(fs.readFileSync(cfgPath, "utf-8"));
    } catch {
      cfg = defaultConfig();
    }
  }
  logger.configure(cfg.debug);
  return cfg;
}
function saveConfig(cfg) {
  const dir = devglobeDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath(), stringifyToml(cfg), { mode: 384 });
}
function migrateLegacyKey() {
  const legacyPath = legacyApiKeyPath();
  if (!fs.existsSync(legacyPath)) return defaultConfig();
  try {
    const key = fs.readFileSync(legacyPath, "utf-8").trim();
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

// ../devglobe-core/src/logger.ts
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
      const dir = path2.dirname(filePath);
      if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
      fs2.appendFileSync(filePath, line, { mode: 384 });
      this.maybeRotate(filePath);
    } catch {
    }
  }
  maybeRotate(filePath) {
    try {
      const stat = fs2.statSync(filePath);
      if (stat.size <= MAX_LOG_BYTES) return;
      const fd = fs2.openSync(filePath, "r");
      const buf = Buffer.alloc(TRUNCATE_KEEP_BYTES);
      fs2.readSync(fd, buf, 0, TRUNCATE_KEEP_BYTES, stat.size - TRUNCATE_KEEP_BYTES);
      fs2.closeSync(fd);
      fs2.writeFileSync(filePath, buf, { mode: 384 });
    } catch {
    }
  }
  logPath() {
    return path2.join(devglobeDir(), LOG_FILE_NAME);
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

// ../devglobe-core/src/heartbeat.ts
var InvalidApiKeyError = class extends Error {
  code = "INVALID_API_KEY";
  constructor() {
    super("Invalid API key");
    this.name = "InvalidApiKeyError";
  }
};
async function sendStatus(apiKey, message) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const truncated = message.slice(0, 100);
    logger.debug("status send", { length: truncated.length });
    const res = await fetch(STATUS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({ message: truncated }),
      signal: controller.signal
    });
    if (res.status === 401) {
      logger.error("status rejected: invalid api key");
      throw new InvalidApiKeyError();
    }
    if (!res.ok) {
      logger.error(`status HTTP ${res.status}`);
      throw new Error(`HTTP ${res.status}`);
    }
    logger.debug("status ok");
  } catch (err) {
    if (err instanceof InvalidApiKeyError) throw err;
    if (!(err instanceof Error && err.message.startsWith("HTTP "))) {
      logger.error("status error", err);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// src/update-status.ts
async function main() {
  const raw = (0, import_fs.readFileSync)(0, "utf-8");
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    console.log(JSON.stringify({ error: 'invalid JSON input, expected {"message":"..."}' }));
    process.exit(1);
  }
  if (!input.message?.trim()) {
    console.log(JSON.stringify({ error: "message is required" }));
    process.exit(1);
  }
  const cfg = loadConfig();
  if (!cfg.apiKey) {
    console.log(JSON.stringify({ error: "not configured \u2014 run setup first" }));
    process.exit(1);
  }
  try {
    await sendStatus(cfg.apiKey, input.message);
    console.log(JSON.stringify({ ok: true }));
  } catch (err) {
    console.log(JSON.stringify({
      error: err instanceof Error ? err.message : "unknown"
    }));
    process.exit(1);
  }
}
main().catch(() => process.exit(1));
