"use strict";

// src/update-status.ts
var import_fs = require("fs");

// ../devglobe-core/src/constants.ts
var SUPABASE_URL = "https://kzcrtlbspkhlnjillhyz.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6Y3J0bGJzcGtobG5qaWxsaHl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzY3NTYsImV4cCI6MjA4ODIxMjc1Nn0.JvJraoxuffHe5VMQu763hROGXNot9XKFY54X6-Ko-bk";
var GEO_CACHE_TTL = 60 * 60 * 1e3;
var GIT_CACHE_TTL = 5 * 60 * 1e3;
var FETCH_TIMEOUT_MS = 15e3;

// src/update-status.ts
async function main() {
  const raw = (0, import_fs.readFileSync)(0, "utf-8");
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    console.log(JSON.stringify({ error: "invalid JSON input" }));
    process.exit(1);
  }
  const { api_key, message } = input;
  if (!api_key || !message) {
    console.log(JSON.stringify({ error: "api_key and message required" }));
    process.exit(1);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_status_message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ p_key: api_key, p_message: message }),
      signal: controller.signal
    });
    if (!res.ok) {
      console.log(JSON.stringify({ error: `HTTP ${res.status}` }));
      process.exit(1);
    }
    const result = await res.text();
    console.log(JSON.stringify({ ok: true, response: result }));
  } catch (err) {
    console.log(
      JSON.stringify({ error: err instanceof Error ? err.message : "unknown" })
    );
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
}
main().catch(() => process.exit(1));
