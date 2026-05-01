import { dirname } from "path";
import { Tracker } from "../../../devglobe-core/src/tracker";
import { langFromPath } from "../../../devglobe-core/src/language";
import { sendStatus } from "../../../devglobe-core/src/heartbeat";
import { loadConfig, setApiKey, configPath } from "../../../devglobe-core/src/config";
import type { CoreEvent } from "../../../devglobe-core/src/types";

const PLUGIN_VERSION = "2.0.0";

const mode = process.argv[2];
if (mode === "lsp") {
  startLsp();
} else if (mode) {
  runSubcommand(mode, process.argv.slice(3));
} else {
  process.stderr.write("Usage: server.js <lsp|setup|status>\n");
  process.exit(1);
}

// ── LSP Language Server (precise activity detection) ──────────────────

function startLsp(): void {
  const log = (msg: string) => process.stderr.write(`[DevGlobe:lsp] ${msg}\n`);

  const tracker = new Tracker((event: CoreEvent) => {
    if (event.event === "heartbeat_ok") {
      const { today_seconds, language } = event.data;
      const h = Math.floor(today_seconds / 3600);
      const m = Math.floor((today_seconds % 3600) / 60);
      const time = h > 0 ? `${h}h ${m}m` : `${m}m`;
      log(`Heartbeat OK — ${language || "Unknown"} — ${time} today`);
    } else if (event.event === "invalid_api_key") {
      log("Invalid API key — tracking stopped. Run /devglobe-setup with a valid key.");
    } else if (event.event === "offline") {
      log("Offline — heartbeats will retry when connection is back");
    } else if (event.event === "online") {
      log("Back online");
    }
  });

  let started = false;

  function ensureStarted(): void {
    if (started) return;
    const cfg = loadConfig();
    if (!cfg.apiKey) return;
    tracker.init(PLUGIN_VERSION, "zed");
    started = true;
    log("Tracking started");
  }

  // Try to start on boot in case the key is already configured.
  ensureStarted();

  const fileLangs = new Map<string, string>();

  // LSP protocol: Content-Length framed JSON-RPC on stdin/stdout
  let buf = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk: string) => {
    buf += chunk;
    while (true) {
      const headerEnd = buf.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;
      const header = buf.slice(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) { buf = buf.slice(headerEnd + 4); continue; }
      const len = parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      if (buf.length < bodyStart + len) break;
      const body = buf.slice(bodyStart, bodyStart + len);
      buf = buf.slice(bodyStart + len);
      handleLspMessage(body);
    }
  });

  function sendLsp(msg: object): void {
    const body = JSON.stringify(msg);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  }

  function recordActivity(uri: string, languageHint?: string): void {
    if (!uri) return;
    const filePath = uriToPath(uri);
    const language =
      capitalizeLanguageId(languageHint) ||
      fileLangs.get(uri) ||
      langFromPath(filePath) ||
      undefined;
    if (language) fileLangs.set(uri, language);
    ensureStarted();
    if (started) tracker.activity(filePath, language);
  }

  function handleLspMessage(raw: string): void {
    let msg: { jsonrpc: string; id?: number; method?: string; params?: any };
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.method) {
      case "initialize":
        sendLsp({
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            capabilities: {
              textDocumentSync: {
                openClose: true,
                change: 2, // incremental
                save: { includeText: false },
              },
            },
            serverInfo: { name: "devglobe-ls", version: PLUGIN_VERSION },
          },
        });
        log("LSP initialized");
        break;

      case "initialized":
        break;

      case "textDocument/didOpen":
        recordActivity(msg.params?.textDocument?.uri, msg.params?.textDocument?.languageId);
        break;

      case "textDocument/didChange":
        recordActivity(msg.params?.textDocument?.uri);
        break;

      case "textDocument/didSave":
        recordActivity(msg.params?.textDocument?.uri);
        break;

      case "textDocument/didClose": {
        const uri = msg.params?.textDocument?.uri as string;
        if (uri) fileLangs.delete(uri);
        break;
      }

      case "shutdown":
        sendLsp({ jsonrpc: "2.0", id: msg.id, result: null });
        break;

      case "exit":
        tracker.shutdown();
        process.exit(0);
        break;

      default:
        if (msg.id !== undefined) {
          sendLsp({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found" } });
        }
        break;
    }
  }

  process.stdin.on("end", () => { tracker.shutdown(); process.exit(0); });
  process.on("SIGTERM", () => { tracker.shutdown(); process.exit(0); });
  process.on("SIGINT", () => { tracker.shutdown(); process.exit(0); });
}

// ── CLI Subcommands ───────────────────────────────────────────────────

function runSubcommand(cmd: string, args: string[]): void {
  switch (cmd) {
    case "setup": {
      const key = args[0];
      if (!key?.trim()) {
        console.log(
          "Usage: /devglobe-setup YOUR_API_KEY\n\n" +
          "Get your key at https://devglobe.xyz/dashboard/settings",
        );
        process.exit(1);
      }
      setApiKey(key.trim());
      console.log(
        `Connected to DevGlobe!\n\n` +
        `API key saved to ${configPath()}.\n` +
        `You'll appear on the globe within 30 seconds.\n\n` +
        `Visibility settings (anonymous mode, repo sharing on the globe, profile mode) ` +
        `are managed at https://devglobe.xyz/dashboard/settings\n\n` +
        `Other commands: /devglobe-status MESSAGE`,
      );
      break;
    }
    case "status": {
      const message = args.join(" ");
      const cfg = loadConfig();
      if (!cfg.apiKey) {
        console.log("No API key found. Run /devglobe-setup YOUR_KEY first.");
        process.exit(1);
      }
      sendStatus(cfg.apiKey, message)
        .then(() => {
          console.log(message ? `Status set to "${message}"` : "Status cleared.");
        })
        .catch((err) => {
          console.log(`Failed to update status: ${err instanceof Error ? err.message : "unknown"}`);
          process.exit(1);
        });
      break;
    }
    default:
      console.log("Unknown command. Available: setup, status");
      process.exit(1);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function uriToPath(uri: string): string {
  try {
    const pathname = decodeURIComponent(new URL(uri).pathname);
    if (process.platform === "win32" && pathname.match(/^\/[a-zA-Z]:/)) {
      return pathname.slice(1);
    }
    return pathname;
  } catch { return uri; }
}

function capitalizeLanguageId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const map: Record<string, string> = {
    javascript: "JavaScript", typescript: "TypeScript",
    javascriptreact: "JSX", typescriptreact: "TSX",
    python: "Python", rust: "Rust", go: "Go", c: "C", cpp: "C++", csharp: "C#",
    java: "Java", kotlin: "Kotlin", scala: "Scala", groovy: "Groovy",
    swift: "Swift", dart: "Dart", ruby: "Ruby", php: "PHP",
    lua: "Lua", perl: "Perl", r: "R", julia: "Julia", matlab: "MATLAB",
    haskell: "Haskell", elixir: "Elixir", erlang: "Erlang", ocaml: "OCaml",
    elm: "Elm", purescript: "PureScript", clojure: "Clojure", racket: "Racket", scheme: "Scheme",
    html: "HTML", css: "CSS", scss: "SCSS", sass: "Sass", less: "Less",
    json: "JSON", jsonc: "JSON", yaml: "YAML", toml: "TOML", xml: "XML", ini: "INI",
    markdown: "Markdown", latex: "LaTeX", typst: "Typst",
    sql: "SQL", prisma: "Prisma", graphql: "GraphQL",
    shellscript: "Bash", powershell: "PowerShell", fish: "Fish",
    dockerfile: "Docker", makefile: "Makefile", nix: "Nix", terraform: "Terraform",
    vue: "Vue", svelte: "Svelte", astro: "Astro",
    zig: "Zig", nim: "Nim", v: "V",
    solidity: "Solidity", gdscript: "GDScript",
    glsl: "GLSL", hlsl: "HLSL", wgsl: "WGSL", metal: "Metal",
    assembly: "Assembly", vhdl: "VHDL", verilog: "Verilog",
    protobuf: "Protobuf", proto: "Protobuf",
    plaintext: "Plain Text",
  };
  return map[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}
