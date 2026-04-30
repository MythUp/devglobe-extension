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

// src/index.ts
var import_fs = require("fs");

// ../../../devglobe-core/src/oneshot.ts
var fs2 = __toESM(require("node:fs"), 1);
var path3 = __toESM(require("node:path"), 1);

// ../../../devglobe-core/src/config.ts
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

// ../../../devglobe-core/src/git.ts
var fsp = __toESM(require("node:fs/promises"), 1);
var path2 = __toESM(require("node:path"), 1);

// ../../../devglobe-core/src/constants.ts
var API_BASE_URL = "https://devglobe.xyz";
var HEARTBEAT_ENDPOINT = `${API_BASE_URL}/api/v2/heartbeat`;
var STATUS_ENDPOINT = `${API_BASE_URL}/api/v2/status`;
var FETCH_TIMEOUT_MS = 15e3;
var GIT_CACHE_TTL_MS = 3e5;
var ONESHOT_RATE_LIMIT_MS = 6e4;
function currentPlatform() {
  switch (process.platform) {
    case "darwin":
      return "macOS";
    case "win32":
      return "Windows";
    default:
      return "Linux";
  }
}

// ../../../devglobe-core/src/git.ts
var MAX_WALK_UP = 30;
var MAX_CACHE_ENTRIES = 32;
var NO_GIT = { repo: null, branch: null, root: null };
var cache = /* @__PURE__ */ new Map();
async function detectGit(cwd) {
  const now = Date.now();
  const hit = cache.get(cwd);
  if (hit && now - hit.fetchedAt < GIT_CACHE_TTL_MS) {
    return { repo: hit.repo, branch: hit.branch, root: hit.root };
  }
  const realCwd = await safeRealpath(cwd);
  const info = await findGit(realCwd);
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(cwd, { ...info, fetchedAt: now });
  return info;
}
async function safeRealpath(p) {
  try {
    return await fsp.realpath(p);
  } catch {
    return p;
  }
}
async function findGit(start) {
  let dir = start;
  for (let i = 0; i < MAX_WALK_UP; i++) {
    const gitDir = await resolveGitDir(dir);
    if (gitDir === "not-a-repo") {
      return { repo: null, branch: null, root: dir };
    }
    if (gitDir) {
      const [branch, repo] = await Promise.all([readBranch(gitDir), readRepo(gitDir)]);
      return { repo, branch, root: dir };
    }
    const parent = path2.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return NO_GIT;
}
async function resolveGitDir(dir) {
  const gitPath = path2.join(dir, ".git");
  const stat2 = await fsp.stat(gitPath).catch(() => null);
  if (!stat2) return null;
  if (stat2.isDirectory()) return gitPath;
  if (!stat2.isFile()) return "not-a-repo";
  const content = await fsp.readFile(gitPath, "utf8").catch(() => "");
  const match = content.match(/^gitdir:\s*(.+)$/m);
  if (!match) return "not-a-repo";
  const target = match[1].trim();
  return path2.isAbsolute(target) ? target : path2.resolve(dir, target);
}
async function readBranch(gitDir) {
  try {
    const head = (await fsp.readFile(path2.join(gitDir, "HEAD"), "utf8")).trim();
    const refMatch = head.match(/^ref:\s*refs\/heads\/(.+)$/);
    return refMatch ? refMatch[1] : null;
  } catch {
    return null;
  }
}
async function readRepo(gitDir) {
  try {
    const configPath2 = await resolveConfigPath(gitDir);
    const content = await fsp.readFile(configPath2, "utf8");
    return parseOriginUrl(content);
  } catch {
    return null;
  }
}
async function resolveConfigPath(gitDir) {
  try {
    const commondir = (await fsp.readFile(path2.join(gitDir, "commondir"), "utf8")).trim();
    const resolved = path2.isAbsolute(commondir) ? commondir : path2.resolve(gitDir, commondir);
    const altConfig = path2.join(resolved, "config");
    await fsp.access(altConfig);
    return altConfig;
  } catch {
    return path2.join(gitDir, "config");
  }
}
function parseOriginUrl(config) {
  const lines = config.split("\n");
  let inOrigin = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) {
      inOrigin = /^\[remote\s+"origin"\]$/.test(trimmed);
      continue;
    }
    if (!inOrigin) continue;
    const match = trimmed.match(/^url\s*=\s*(.+)$/);
    if (match) {
      return canonicalizeRepoUrl(match[1].trim());
    }
  }
  return null;
}
function canonicalizeRepoUrl(raw) {
  if (!raw) return null;
  const stripped = raw.replace(/\.git$/, "");
  const ssh = stripped.match(/^[\w.-]+@([^:]+):(.+)$/);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
  const sshUrl = stripped.match(/^ssh:\/\/[\w.-]+@([^/:]+)(?::\d+)?\/(.+)$/);
  if (sshUrl) return `https://${sshUrl[1]}/${sshUrl[2]}`;
  if (/^https?:\/\//.test(stripped)) return stripped;
  const gitProto = stripped.match(/^git:\/\/([^/]+)\/(.+)$/);
  if (gitProto) return `https://${gitProto[1]}/${gitProto[2]}`;
  return null;
}
function relativeToRoot(filePath, repoRoot) {
  const rel = path2.relative(repoRoot, filePath);
  return rel.startsWith("..") ? filePath : rel;
}
async function resolveRepoFields(filePath, privacy, cwd = path2.dirname(filePath)) {
  const git = await detectGit(cwd);
  const fields = {};
  if (!privacy.hideProjectNames && git.repo) fields.repo = git.repo;
  if (!privacy.hideProjectNames && !privacy.hideBranchNames && git.branch) {
    fields.branch = git.branch;
  }
  if (!privacy.hideFileNames && git.root) {
    fields.file = relativeToRoot(filePath, git.root);
  }
  return fields;
}
async function resolveRepoFromCwd(cwd, privacy) {
  const git = await detectGit(cwd);
  const fields = {};
  if (!privacy.hideProjectNames && git.repo) fields.repo = git.repo;
  if (!privacy.hideProjectNames && !privacy.hideBranchNames && git.branch) {
    fields.branch = git.branch;
  }
  return fields;
}

// ../../../devglobe-core/src/language.ts
var import_path = require("path");
var EXT_LANG = {
  ".js": "JavaScript",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".ts": "TypeScript",
  ".mts": "TypeScript",
  ".cts": "TypeScript",
  ".jsx": "React JSX",
  ".tsx": "React TSX",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".astro": "Astro",
  ".html": "HTML",
  ".htm": "HTML",
  ".css": "CSS",
  ".sass": "Sass",
  ".scss": "SCSS",
  ".less": "Less",
  ".styl": "Stylus",
  ".graphql": "GraphQL",
  ".gql": "GraphQL",
  ".mdx": "MDX",
  ".hbs": "Handlebars",
  ".pug": "Pug",
  ".jade": "Pug",
  ".ejs": "EJS",
  ".erb": "ERB",
  ".haml": "Haml",
  ".twig": "Twig",
  ".blade.php": "Blade",
  ".liquid": "Liquid",
  ".mustache": "Mustache",
  ".njk": "Nunjucks",
  ".c": "C",
  ".h": "C",
  ".cpp": "C++",
  ".cxx": "C++",
  ".cc": "C++",
  ".hpp": "C++",
  ".hxx": "C++",
  ".rs": "Rust",
  ".go": "Go",
  ".zig": "Zig",
  ".d": "D",
  ".v": "V",
  ".odin": "Odin",
  ".mojo": "Mojo",
  ".java": "Java",
  ".kt": "Kotlin",
  ".kts": "Kotlin",
  ".scala": "Scala",
  ".sc": "Scala",
  ".groovy": "Groovy",
  ".cs": "C#",
  ".fs": "F#",
  ".fsx": "F#",
  ".vb": "Visual Basic",
  ".py": "Python",
  ".pyw": "Python",
  ".pyi": "Python",
  ".rb": "Ruby",
  ".php": "PHP",
  ".lua": "Lua",
  ".pl": "Perl",
  ".pm": "Perl",
  ".r": "R",
  ".R": "R",
  ".jl": "Julia",
  ".m": "MATLAB",
  ".swift": "Swift",
  ".dart": "Dart",
  ".mm": "Objective-C++",
  ".hs": "Haskell",
  ".lhs": "Haskell",
  ".ex": "Elixir",
  ".exs": "Elixir",
  ".erl": "Erlang",
  ".hrl": "Erlang",
  ".ml": "OCaml",
  ".mli": "OCaml",
  ".elm": "Elm",
  ".purs": "PureScript",
  ".clj": "Clojure",
  ".cljs": "Clojure",
  ".cljc": "Clojure",
  ".rkt": "Racket",
  ".scm": "Scheme",
  ".lisp": "Common Lisp",
  ".pro": "Prolog",
  ".gleam": "Gleam",
  ".roc": "Roc",
  ".idr": "Idris",
  ".agda": "Agda",
  ".lean": "Lean",
  ".nim": "Nim",
  ".cr": "Crystal",
  ".hx": "Haxe",
  ".ada": "Ada",
  ".adb": "Ada",
  ".ads": "Ada",
  ".f90": "Fortran",
  ".f95": "Fortran",
  ".f03": "Fortran",
  ".pas": "Pascal",
  ".pp": "Pascal",
  ".cob": "COBOL",
  ".cbl": "COBOL",
  ".vhd": "VHDL",
  ".vhdl": "VHDL",
  ".sv": "SystemVerilog",
  ".svh": "SystemVerilog",
  ".asm": "Assembly",
  ".s": "Assembly",
  ".cu": "CUDA",
  ".cuh": "CUDA",
  ".glsl": "GLSL",
  ".vert": "GLSL",
  ".frag": "GLSL",
  ".hlsl": "HLSL",
  ".wgsl": "WGSL",
  ".metal": "Metal",
  ".sh": "Bash",
  ".bash": "Bash",
  ".zsh": "Bash",
  ".fish": "Fish",
  ".ps1": "PowerShell",
  ".psm1": "PowerShell",
  ".bat": "Batch",
  ".cmd": "Batch",
  ".tf": "Terraform",
  ".tfvars": "Terraform",
  ".nix": "Nix",
  ".sql": "SQL",
  ".prisma": "Prisma",
  ".sol": "Solidity",
  ".vy": "Vyper",
  ".gd": "GDScript",
  ".gdshader": "Godot Shader",
  ".json": "JSON",
  ".jsonc": "JSON",
  ".jsonnet": "Jsonnet",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".xml": "XML",
  ".ini": "INI",
  ".env": "Env",
  ".properties": "Properties",
  ".csv": "CSV",
  ".tsv": "TSV",
  ".cue": "CUE",
  ".dhall": "Dhall",
  ".pkl": "Pkl",
  ".proto": "Protobuf",
  ".thrift": "Thrift",
  ".avro": "Avro",
  ".md": "Markdown",
  ".rst": "reStructuredText",
  ".tex": "LaTeX",
  ".bib": "BibTeX",
  ".typ": "Typst",
  ".adoc": "AsciiDoc",
  ".txt": "Plain Text",
  ".coffee": "CoffeeScript",
  ".tcl": "Tcl"
};
var NAME_LANG = {
  "Dockerfile": "Docker",
  "docker-compose.yml": "Docker Compose",
  "docker-compose.yaml": "Docker Compose",
  "Makefile": "Makefile",
  "CMakeLists.txt": "CMake",
  "Justfile": "Just",
  ".gitignore": "Gitignore",
  ".editorconfig": "EditorConfig"
};
function langFromPath(filePath) {
  const base = filePath.split("/").pop() || "";
  if (base in NAME_LANG) return NAME_LANG[base];
  const lowerBase = base.toLowerCase();
  for (const key of Object.keys(EXT_LANG)) {
    if (key.startsWith(".") && key.includes(".", 1) && lowerBase.endsWith(key)) {
      return EXT_LANG[key];
    }
  }
  const ext = (0, import_path.extname)(base).toLowerCase();
  if (!ext) return null;
  return EXT_LANG[ext] ?? null;
}

// ../../../devglobe-core/src/heartbeat.ts
async function sendBatch(batch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(HEARTBEAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
      signal: controller.signal
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ../../../devglobe-core/src/oneshot.ts
async function runOneshot(params) {
  const cfg = loadConfig();
  if (!cfg.apiKey) {
    process.stderr.write("not configured \u2014 run: devglobe-core setup <API_KEY>\n");
    process.exit(1);
  }
  const now = Date.now();
  const state = loadState();
  const language = params.language ?? (params.file ? langFromPath(params.file) : null) ?? state.lastLanguage ?? void 0;
  const fileChanged = params.file !== void 0 && params.file !== state.lastFile;
  const langChanged = language !== void 0 && language !== state.lastLanguage;
  const rateLimited = state.lastHeartbeatAt !== void 0 && now - state.lastHeartbeatAt < ONESHOT_RATE_LIMIT_MS;
  if (!params.force && !fileChanged && !langChanged && rateLimited) {
    return;
  }
  const ev = { time: now / 1e3 };
  if (language) ev.language = language;
  if (params.file) {
    Object.assign(ev, await resolveRepoFields(params.file, cfg.privacy));
  } else if (params.cwd) {
    Object.assign(ev, await resolveRepoFromCwd(params.cwd, cfg.privacy));
  }
  const batch = {
    key: cfg.apiKey,
    plugin_version: params.pluginVersion,
    editor: params.editor,
    platform: currentPlatform(),
    heartbeats: [ev]
  };
  try {
    await sendBatch(batch);
    saveState({ lastHeartbeatAt: now, lastFile: params.file, lastLanguage: language });
  } catch {
  }
}
function stateFile() {
  return path3.join(devglobeDir(), "oneshot-state.json");
}
function loadState() {
  try {
    return JSON.parse(fs2.readFileSync(stateFile(), "utf-8"));
  } catch {
    return {};
  }
}
function saveState(state) {
  const dir = devglobeDir();
  if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
  fs2.writeFileSync(stateFile(), JSON.stringify(state), { mode: 384 });
}

// src/types.ts
var PLUGIN_VERSION = "2.0.0";

// src/index.ts
async function main() {
  const raw = (0, import_fs.readFileSync)(0, "utf-8");
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return;
  }
  const filePath = input.tool_input?.file_path || input.tool_response?.filePath || void 0;
  await runOneshot({
    file: filePath,
    cwd: input.cwd,
    editor: "claude-code",
    pluginVersion: PLUGIN_VERSION,
    force: input.hook_event_name === "Stop"
  });
}
main().catch(() => process.exit(0));
