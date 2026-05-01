import { readFileSync } from 'fs';
import { sendStatus } from '../../devglobe-core/src/heartbeat';
import { loadConfig } from '../../devglobe-core/src/config';

async function main(): Promise<void> {
  const raw = readFileSync(0, 'utf-8');
  let input: { message: string };
  try {
    input = JSON.parse(raw);
  } catch {
    console.log(JSON.stringify({ error: 'invalid JSON input, expected {"message":"..."}' }));
    process.exit(1);
  }

  if (!input.message?.trim()) {
    console.log(JSON.stringify({ error: 'message is required' }));
    process.exit(1);
  }

  const cfg = loadConfig();
  if (!cfg.apiKey) {
    console.log(JSON.stringify({ error: 'not configured — run setup first' }));
    process.exit(1);
  }

  try {
    await sendStatus(cfg.apiKey, input.message);
    console.log(JSON.stringify({ ok: true }));
  } catch (err) {
    console.log(JSON.stringify({
      error: err instanceof Error ? err.message : 'unknown',
    }));
    process.exit(1);
  }
}

main().catch(() => process.exit(1));
