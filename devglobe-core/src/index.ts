import { runDaemon } from './daemon.js';
import { runOneshot } from './oneshot.js';
import { runLsp } from './lsp.js';
import { setApiKey } from './config.js';

const CORE_VERSION = '2.0.0';

const args = process.argv.slice(2);
const mode = args[0];

async function main(): Promise<void> {
  if (mode === 'daemon') {
    await runDaemon();
    return;
  }
  if (mode === 'lsp') {
    await runLsp(CORE_VERSION);
    return;
  }
  if (mode === 'setup' && args[1]) {
    setApiKey(args[1]);
    process.stdout.write('API key saved\n');
    return;
  }
  if (mode === 'heartbeat') {
    const params = parseOneshotArgs(args.slice(1));
    await runOneshot(params);
    return;
  }
  process.stderr.write('Usage: devglobe-core <daemon|lsp|heartbeat|setup>\n');
  process.exit(1);
}

function parseOneshotArgs(args: string[]): Parameters<typeof runOneshot>[0] {
  const parsed: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--force') { parsed.force = true; continue; }
    if (key.startsWith('--')) {
      parsed[key.slice(2)] = args[++i];
    }
  }
  return {
    file: parsed.file as string | undefined,
    cwd: parsed.cwd as string | undefined,
    language: parsed.language as string | undefined,
    editor: (parsed.editor as string) ?? 'unknown',
    pluginVersion: (parsed['plugin-version'] as string) ?? '0.0.0',
    force: parsed.force as boolean | undefined,
  };
}

main().catch((err) => {
  process.stderr.write(`error: ${err}\n`);
  process.exit(1);
});
