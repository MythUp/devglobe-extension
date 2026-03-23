import { readFileSync, writeFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { HooksFile } from './hooks';

async function main(): Promise<void> {
  const hooksPath = join(homedir(), '.codex', 'hooks.json');

  if (!existsSync(hooksPath)) {
    console.log(JSON.stringify({ ok: true, message: 'No hooks.json found, nothing to remove.' }));
    return;
  }

  let existing: HooksFile;
  try {
    existing = JSON.parse(readFileSync(hooksPath, 'utf-8'));
  } catch {
    console.log(JSON.stringify({ ok: true, message: 'Could not parse hooks.json, nothing to remove.' }));
    return;
  }

  if (!existing.hooks) {
    console.log(JSON.stringify({ ok: true, message: 'No hooks found, nothing to remove.' }));
    return;
  }

  let removed = 0;
  for (const event of Object.keys(existing.hooks)) {
    const before = existing.hooks[event].length;
    existing.hooks[event] = existing.hooks[event].filter(
      (h) => !h.hooks?.some((hh) => hh.command?.includes('devglobe')),
    );
    removed += before - existing.hooks[event].length;
    if (existing.hooks[event].length === 0) {
      delete existing.hooks[event];
    }
  }

  writeFileSync(hooksPath, JSON.stringify(existing, null, 2));

  console.log(JSON.stringify({
    ok: true,
    message: `Removed ${removed} DevGlobe hook(s) from ${hooksPath}. API key in ~/.devglobe/ was kept.`,
  }));
}

main().catch(() => process.exit(1));
