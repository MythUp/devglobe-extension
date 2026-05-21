import * as readline from 'node:readline';
import { Tracker } from './tracker.js';
import type { ClientMessage, CoreEvent } from './types.js';

export async function runDaemon(): Promise<void> {
  const emit = (event: CoreEvent) => {
    process.stdout.write(JSON.stringify(event) + '\n');
  };

  const tracker = new Tracker(emit);
  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(trimmed) as ClientMessage;
    } catch {
      return;
    }
    try {
      switch (msg.method) {
        case 'init':
          tracker.init(msg.params.plugin_version ?? '', msg.params.editor ?? 'unknown');
          break;
        case 'activity': {
          const file = msg.params.file ?? msg.params.file_path;
          const language = msg.params.language ?? undefined;
          await tracker.activity(file, language);
          break;
        }
        case 'set_status':
          await tracker.setStatus(msg.params.message, msg.params.api_key);
          break;
        case 'pause':
          tracker.pause();
          break;
        case 'resume':
          tracker.resume();
          break;
        case 'shutdown':
          tracker.shutdown();
          rl.close();
          process.exit(0);
      }
    } catch { /* swallow */ }
  });

  rl.on('close', () => {
    tracker.shutdown();
    process.exit(0);
  });
}
