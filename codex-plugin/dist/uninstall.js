"use strict";

// src/uninstall.ts
var import_fs = require("fs");
var import_os = require("os");
var import_path = require("path");
async function main() {
  const hooksPath = (0, import_path.join)((0, import_os.homedir)(), ".codex", "hooks.json");
  if (!(0, import_fs.existsSync)(hooksPath)) {
    console.log(JSON.stringify({ ok: true, message: "No hooks.json found, nothing to remove." }));
    return;
  }
  let existing;
  try {
    existing = JSON.parse((0, import_fs.readFileSync)(hooksPath, "utf-8"));
  } catch {
    console.log(JSON.stringify({ ok: true, message: "Could not parse hooks.json, nothing to remove." }));
    return;
  }
  if (!existing.hooks) {
    console.log(JSON.stringify({ ok: true, message: "No hooks found, nothing to remove." }));
    return;
  }
  let removed = 0;
  for (const event of Object.keys(existing.hooks)) {
    const before = existing.hooks[event].length;
    existing.hooks[event] = existing.hooks[event].filter(
      (h) => !h.hooks?.some((hh) => hh.command?.includes("devglobe"))
    );
    removed += before - existing.hooks[event].length;
    if (existing.hooks[event].length === 0) {
      delete existing.hooks[event];
    }
  }
  (0, import_fs.writeFileSync)(hooksPath, JSON.stringify(existing, null, 2));
  console.log(JSON.stringify({
    ok: true,
    message: `Removed ${removed} DevGlobe hook(s) from ${hooksPath}. API key in ~/.devglobe/ was kept.`
  }));
}
main().catch(() => process.exit(1));
