"use strict";

// src/setup.ts
var import_fs = require("fs");
var import_os = require("os");
var import_path = require("path");
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
  const devglobeDir = (0, import_path.join)((0, import_os.homedir)(), ".devglobe");
  (0, import_fs.mkdirSync)(devglobeDir, { recursive: true });
  (0, import_fs.writeFileSync)((0, import_path.join)(devglobeDir, "api_key"), input.api_key.trim());
  const configPath = (0, import_path.join)(devglobeDir, "config.json");
  if (!(0, import_fs.existsSync)(configPath)) {
    (0, import_fs.writeFileSync)(configPath, JSON.stringify({ anonymousMode: true, shareRepo: false }, null, 2));
  }
  const codexDir = (0, import_path.join)((0, import_os.homedir)(), ".codex");
  (0, import_fs.mkdirSync)(codexDir, { recursive: true });
  const hooksPath = (0, import_path.join)(codexDir, "hooks.json");
  const skillDir = (0, import_path.join)((0, import_path.dirname)(__filename), "..");
  const heartbeatScript = (0, import_path.join)(skillDir, "scripts", "heartbeat");
  try {
    (0, import_fs.chmodSync)(heartbeatScript, 493);
  } catch {
  }
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
    message: `DevGlobe configured! API key saved, hooks installed in ${hooksPath}, codex_hooks feature enabled in config.toml. Restart Codex for hooks to take effect.`
  }));
}
main().catch(() => process.exit(1));
