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
var import_path2 = require("path");

// ../devglobe-core/src/oneshot.ts
var fs3 = __toESM(require("node:fs"), 1);
var path4 = __toESM(require("node:path"), 1);

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
      const stat2 = fs.statSync(filePath);
      if (stat2.size <= MAX_LOG_BYTES) return;
      const fd = fs.openSync(filePath, "r");
      const buf = Buffer.alloc(TRUNCATE_KEEP_BYTES);
      fs.readSync(fd, buf, 0, TRUNCATE_KEEP_BYTES, stat2.size - TRUNCATE_KEEP_BYTES);
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

// ../devglobe-core/src/git.ts
var fsp = __toESM(require("node:fs/promises"), 1);
var path3 = __toESM(require("node:path"), 1);

// ../devglobe-core/src/constants.ts
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

// ../devglobe-core/src/git.ts
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
    const parent = path3.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return NO_GIT;
}
async function resolveGitDir(dir) {
  const gitPath = path3.join(dir, ".git");
  const stat2 = await fsp.stat(gitPath).catch(() => null);
  if (!stat2) return null;
  if (stat2.isDirectory()) return gitPath;
  if (!stat2.isFile()) return "not-a-repo";
  const content = await fsp.readFile(gitPath, "utf8").catch(() => "");
  const match = content.match(/^gitdir:\s*(.+)$/m);
  if (!match) return "not-a-repo";
  const target = match[1].trim();
  return path3.isAbsolute(target) ? target : path3.resolve(dir, target);
}
async function readBranch(gitDir) {
  try {
    const head = (await fsp.readFile(path3.join(gitDir, "HEAD"), "utf8")).trim();
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
    const commondir = (await fsp.readFile(path3.join(gitDir, "commondir"), "utf8")).trim();
    const resolved = path3.isAbsolute(commondir) ? commondir : path3.resolve(gitDir, commondir);
    const altConfig = path3.join(resolved, "config");
    await fsp.access(altConfig);
    return altConfig;
  } catch {
    return path3.join(gitDir, "config");
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
  const rel = path3.relative(repoRoot, filePath);
  return rel.startsWith("..") ? filePath : rel;
}
async function resolveRepoFields(filePath, privacy, cwd = path3.dirname(filePath)) {
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

// ../devglobe-core/src/language.ts
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

// ../devglobe-core/src/heartbeat.ts
var InvalidApiKeyError = class extends Error {
  code = "INVALID_API_KEY";
  constructor() {
    super("Invalid API key");
    this.name = "InvalidApiKeyError";
  }
};
async function sendBatch(apiKey, batch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const started = Date.now();
  try {
    logger.debug("heartbeat send", {
      events: batch.heartbeats.length,
      editor: batch.editor,
      first: batch.heartbeats[0]
    });
    const res = await fetch(HEARTBEAT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(batch),
      signal: controller.signal
    });
    if (res.status === 401) {
      logger.error(`heartbeat rejected: invalid api key (${Date.now() - started}ms)`);
      throw new InvalidApiKeyError();
    }
    if (!res.ok) {
      logger.error(`heartbeat HTTP ${res.status} (${Date.now() - started}ms)`);
      throw new Error(`HTTP ${res.status}`);
    }
    const body = await res.json();
    logger.debug(`heartbeat ok (${Date.now() - started}ms)`, body);
    return body;
  } catch (err) {
    if (err instanceof InvalidApiKeyError) throw err;
    if (!(err instanceof Error && err.message.startsWith("HTTP "))) {
      logger.error("heartbeat error", err);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ../devglobe-core/src/oneshot.ts
async function runOneshot(params) {
  const cfg = loadConfig();
  logger.setEditor(params.editor);
  if (!cfg.apiKey) {
    logger.error("oneshot skipped: not configured");
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
    logger.debug("oneshot rate-limited", { sinceLast: now - (state.lastHeartbeatAt ?? 0) });
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
    plugin_version: params.pluginVersion,
    editor: params.editor,
    platform: currentPlatform(),
    heartbeats: [ev]
  };
  try {
    await sendBatch(cfg.apiKey, batch);
    saveState({ lastHeartbeatAt: now, lastFile: params.file, lastLanguage: language });
  } catch (err) {
    if (err instanceof InvalidApiKeyError) {
      logger.error("oneshot stopping: invalid api key \u2014 re-run setup with a valid key");
      process.stderr.write(
        "devglobe: invalid API key. Re-run setup with a valid key from https://devglobe.xyz/dashboard/settings\n"
      );
      return;
    }
    logger.error("oneshot send failed; state preserved for retry", err);
  }
}
function stateFile() {
  return path4.join(devglobeDir(), "oneshot-state.json");
}
function loadState() {
  try {
    return JSON.parse(fs3.readFileSync(stateFile(), "utf-8"));
  } catch {
    return {};
  }
}
function saveState(state) {
  const dir = devglobeDir();
  if (!fs3.existsSync(dir)) fs3.mkdirSync(dir, { recursive: true });
  fs3.writeFileSync(stateFile(), JSON.stringify(state), { mode: 384 });
}

// src/types.ts
var PLUGIN_VERSION = "2.0.0";

// src/index.ts
var BACKTICK_PATH_RE = /`(\/[^`\n]+\.\w{1,10})`/g;
var BARE_PATH_RE = /(?:^|\s)(\/(?:[\w .@-]+\/)+[\w.@-]+\.\w{1,10})(?=[\s,;:]|$)/gm;
var RELATIVE_PATH_RE = /(?:^|\s|['"`(])((?:[\w.@-]+\/)+[\w.@-]+\.\w{1,10})(?=[\s'"`):,]|$)/g;
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", "dist", "build", ".git", ".next", "__pycache__", "target", "vendor"]);
function extractFilePaths(text) {
  if (!text) return [];
  const seen = /* @__PURE__ */ new Set();
  const paths = [];
  function add(p) {
    if (!seen.has(p)) {
      seen.add(p);
      paths.push(p);
    }
  }
  for (const m of text.matchAll(BACKTICK_PATH_RE)) add(m[1]);
  for (const m of text.matchAll(BARE_PATH_RE)) add(m[1].trim());
  for (const m of text.matchAll(RELATIVE_PATH_RE)) {
    const p = m[1];
    if (p.includes("/") || langFromPath(p)) add(p);
  }
  return paths;
}
function findRecentFile(cwd) {
  let best = null;
  function scan(dir, depth) {
    if (depth > 2) return;
    try {
      for (const name of (0, import_fs.readdirSync)(dir)) {
        if (name.startsWith(".") || SKIP_DIRS.has(name)) continue;
        const full = (0, import_path2.join)(dir, name);
        try {
          const st = (0, import_fs.statSync)(full);
          if (st.isDirectory() && depth < 2) {
            scan(full, depth + 1);
          } else if (st.isFile()) {
            const ext = (0, import_path2.extname)(name);
            if (!ext || ext === ".lock" || ext === ".log") continue;
            if (!best || st.mtimeMs > best.mtime) {
              best = { path: full, mtime: st.mtimeMs };
            }
          }
        } catch {
        }
      }
    } catch {
    }
  }
  scan(cwd, 0);
  return best?.path ?? null;
}
function pickBestFile(paths, cwd) {
  const codePaths = [];
  for (const p of paths) {
    const resolved = p.startsWith("/") ? p : (0, import_path2.join)(cwd, p);
    const lang = langFromPath(resolved);
    if (lang && lang !== "Markdown" && lang !== "Plain Text" && lang !== "JSON" && lang !== "YAML" && lang !== "TOML") {
      codePaths.push({ filePath: resolved, language: lang });
    }
  }
  if (codePaths.length > 0) {
    const existing = codePaths.find((p) => (0, import_fs.existsSync)(p.filePath));
    return existing ?? codePaths[0];
  }
  for (const p of paths) {
    const resolved = p.startsWith("/") ? p : (0, import_path2.join)(cwd, p);
    const lang = langFromPath(resolved);
    if (lang) return { filePath: resolved, language: lang };
  }
  return null;
}
async function main() {
  const raw = (0, import_fs.readFileSync)(0, "utf-8");
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return;
  }
  const { cwd, hook_event_name } = input;
  let filePath;
  let language;
  const allPaths = [];
  for (const text of [input.last_assistant_message, input.prompt]) {
    allPaths.push(...extractFilePaths(text));
  }
  const best = pickBestFile(allPaths, cwd);
  if (best) {
    filePath = best.filePath;
    language = best.language;
  }
  if (!language) {
    const recent = findRecentFile(cwd);
    if (recent) {
      const lang = langFromPath(recent);
      if (lang) {
        filePath = recent;
        language = lang;
      }
    }
  }
  await runOneshot({
    file: filePath,
    cwd,
    editor: "codex",
    language,
    pluginVersion: PLUGIN_VERSION,
    force: hook_event_name === "Stop"
  });
}
main().catch(() => process.exit(0));
