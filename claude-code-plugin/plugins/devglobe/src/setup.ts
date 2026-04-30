import { readFileSync } from 'fs';
import { setApiKey } from '../../../../devglobe-core/src/config';
import type { SetupInput } from './types';

async function main(): Promise<void> {
  const raw = readFileSync(0, 'utf-8');
  let input: SetupInput;
  try {
    input = JSON.parse(raw);
  } catch {
    console.log(JSON.stringify({ error: 'invalid JSON input' }));
    process.exit(1);
  }

  const apiKey = input.api_key?.trim();
  if (!apiKey) {
    console.log(JSON.stringify({ error: 'api_key required' }));
    process.exit(1);
  }

  try {
    setApiKey(apiKey);
    console.log(JSON.stringify({ ok: true, config: '~/.devglobe/config.toml' }));
  } catch (err) {
    console.log(JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }));
    process.exit(1);
  }
}

main().catch(() => process.exit(1));
