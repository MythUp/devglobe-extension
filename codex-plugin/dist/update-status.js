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
var API_BASE_URL = "https://devglobe.xyz";
var HEARTBEAT_ENDPOINT = `${API_BASE_URL}/api/v2/heartbeat`;
var STATUS_ENDPOINT = `${API_BASE_URL}/api/v2/status`;
var FETCH_TIMEOUT_MS = 15e3;

// ../devglobe-core/src/heartbeat.ts
async function sendStatus(apiKey, message) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const truncated = message.slice(0, 100);
    const res = await fetch(STATUS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apiKey, message: truncated }),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } finally {
    clearTimeout(timer);
  }
}

// ../devglobe-core/src/config.ts
var fs = __toESM(require("node:fs"), 1);
var path = __toESM(require("node:path"), 1);
var os = __toESM(require("node:os"), 1);
function defaultConfig() {
  return {
    apiKey: null,
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
  if (!fs.existsSync(cfgPath)) {
    return migrateLegacyKey();
  }
  try {
    return parseToml(fs.readFileSync(cfgPath, "utf-8"));
  } catch {
    return defaultConfig();
  }
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
    return cfg;
  } catch {
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
  lines.push("");
  lines.push("[privacy]");
  lines.push(`hide_file_names = ${cfg.privacy.hideFileNames}`);
  lines.push(`hide_branch_names = ${cfg.privacy.hideBranchNames}`);
  lines.push(`hide_project_names = ${cfg.privacy.hideProjectNames}`);
  return lines.join("\n") + "\n";
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
