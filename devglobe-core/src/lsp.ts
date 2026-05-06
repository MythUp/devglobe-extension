import { Tracker } from './tracker.js';
import { langFromPath } from './language.js';
import type { CoreEvent } from './types.js';

const LSP_EDITOR = 'zed';

export async function runLsp(pluginVersion: string): Promise<void> {
  const log = (msg: string) => process.stderr.write(`[DevGlobe:lsp] ${msg}\n`);

  const tracker = new Tracker((event: CoreEvent) => {
    if (event.event === 'heartbeat_ok') {
      const { today_seconds, language } = event.data;
      const h = Math.floor(today_seconds / 3600);
      const m = Math.floor((today_seconds % 3600) / 60);
      const time = h > 0 ? `${h}h ${m}m` : `${m}m`;
      log(`Heartbeat OK — ${language || 'Unknown'} — ${time} today`);
    } else if (event.event === 'invalid_api_key') {
      log('Invalid API key — tracking stopped. Re-run setup with a valid key.');
    } else if (event.event === 'offline') {
      log('Offline — heartbeats will retry when connection is back');
    } else if (event.event === 'online') {
      log('Back online');
    }
  });

  let started = false;
  function ensureStarted(): void {
    if (started) return;
    tracker.init(pluginVersion, LSP_EDITOR);
    started = true;
    log('Tracking started');
  }
  ensureStarted();

  const fileLangs = new Map<string, string>();

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
    tracker.activity(filePath, language);
  }

  function handleLspMessage(raw: string): void {
    let msg: { jsonrpc: string; id?: number; method?: string; params?: any };
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.method) {
      case 'initialize':
        sendLsp({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            capabilities: {
              textDocumentSync: {
                openClose: true,
                change: 2,
                save: { includeText: false },
              },
            },
            serverInfo: { name: 'devglobe-ls', version: pluginVersion },
          },
        });
        log('LSP initialized');
        break;

      case 'initialized':
        break;

      case 'textDocument/didOpen':
        recordActivity(msg.params?.textDocument?.uri, msg.params?.textDocument?.languageId);
        break;

      case 'textDocument/didChange':
        recordActivity(msg.params?.textDocument?.uri);
        break;

      case 'textDocument/didSave':
        recordActivity(msg.params?.textDocument?.uri);
        break;

      case 'textDocument/didClose': {
        const uri = msg.params?.textDocument?.uri as string | undefined;
        if (uri) fileLangs.delete(uri);
        break;
      }

      case 'shutdown':
        sendLsp({ jsonrpc: '2.0', id: msg.id, result: null });
        break;

      case 'exit':
        tracker.shutdown();
        process.exit(0);

      default:
        if (msg.id !== undefined) {
          sendLsp({
            jsonrpc: '2.0',
            id: msg.id,
            error: { code: -32601, message: 'Method not found' },
          });
        }
        break;
    }
  }

  let buf = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk: string) => {
    buf += chunk;
    while (true) {
      const headerEnd = buf.indexOf('\r\n\r\n');
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

  process.stdin.on('end', () => { tracker.shutdown(); process.exit(0); });
  process.on('SIGTERM', () => { tracker.shutdown(); process.exit(0); });
  process.on('SIGINT', () => { tracker.shutdown(); process.exit(0); });
}

function uriToPath(uri: string): string {
  try {
    const pathname = decodeURIComponent(new URL(uri).pathname);
    if (process.platform === 'win32' && pathname.match(/^\/[a-zA-Z]:/)) {
      return pathname.slice(1);
    }
    return pathname;
  } catch { return uri; }
}

function capitalizeLanguageId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const map: Record<string, string> = {
    javascript: 'JavaScript', typescript: 'TypeScript',
    javascriptreact: 'JSX', typescriptreact: 'TSX',
    python: 'Python', rust: 'Rust', go: 'Go', c: 'C', cpp: 'C++', csharp: 'C#',
    java: 'Java', kotlin: 'Kotlin', scala: 'Scala', groovy: 'Groovy',
    swift: 'Swift', dart: 'Dart', ruby: 'Ruby', php: 'PHP',
    lua: 'Lua', perl: 'Perl', r: 'R', julia: 'Julia', matlab: 'MATLAB',
    haskell: 'Haskell', elixir: 'Elixir', erlang: 'Erlang', ocaml: 'OCaml',
    elm: 'Elm', purescript: 'PureScript', clojure: 'Clojure', racket: 'Racket', scheme: 'Scheme',
    html: 'HTML', css: 'CSS', scss: 'SCSS', sass: 'Sass', less: 'Less',
    json: 'JSON', jsonc: 'JSON', yaml: 'YAML', toml: 'TOML', xml: 'XML', ini: 'INI',
    markdown: 'Markdown', latex: 'LaTeX', typst: 'Typst',
    sql: 'SQL', prisma: 'Prisma', graphql: 'GraphQL',
    shellscript: 'Bash', powershell: 'PowerShell', fish: 'Fish',
    dockerfile: 'Docker', makefile: 'Makefile', nix: 'Nix', terraform: 'Terraform',
    vue: 'Vue', svelte: 'Svelte', astro: 'Astro',
    zig: 'Zig', nim: 'Nim', v: 'V',
    solidity: 'Solidity', gdscript: 'GDScript',
    glsl: 'GLSL', hlsl: 'HLSL', wgsl: 'WGSL', metal: 'Metal',
    assembly: 'Assembly', vhdl: 'VHDL', verilog: 'Verilog',
    protobuf: 'Protobuf', proto: 'Protobuf',
    plaintext: 'Plain Text',
  };
  return map[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}
