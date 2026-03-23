import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import type { HookEntry, HooksFile } from './hooks';

async function main(): Promise<void> {
  const raw = readFileSync(0, 'utf-8');
  let input: { api_key: string };
  try {
    input = JSON.parse(raw);
  } catch {
    console.log(JSON.stringify({ error: 'invalid JSON input, expected {"api_key":"..."}' }));
    process.exit(1);
  }

  if (!input.api_key?.trim()) {
    console.log(JSON.stringify({ error: 'api_key is required' }));
    process.exit(1);
  }

  const devglobeDir = join(homedir(), '.devglobe');
  mkdirSync(devglobeDir, { recursive: true });

  writeFileSync(join(devglobeDir, 'api_key'), input.api_key.trim());

  const configPath = join(devglobeDir, 'config.json');
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify({ anonymousMode: true, shareRepo: false }, null, 2));
  }

  const codexDir = join(homedir(), '.codex');
  mkdirSync(codexDir, { recursive: true });
  const hooksPath = join(codexDir, 'hooks.json');

  const skillDir = join(dirname(__filename), '..');
  const heartbeatScript = join(skillDir, 'scripts', 'heartbeat');
  try { chmodSync(heartbeatScript, 0o755); } catch { /* script may not exist yet in dev */ }

  const hookEntry: HookEntry = {
    matcher: '',
    hooks: [{ type: 'command', command: heartbeatScript, timeout: 30 }],
  };

  let existing: HooksFile = { hooks: {} };
  try {
    existing = JSON.parse(readFileSync(hooksPath, 'utf-8'));
    if (!existing.hooks) existing.hooks = {};
  } catch { /* file doesn't exist or invalid */ }

  const events = ['SessionStart', 'UserPromptSubmit', 'Stop'];
  for (const event of events) {
    const eventHooks: HookEntry[] = existing.hooks[event] || [];
    const alreadyInstalled = eventHooks.some((h) =>
      h.hooks?.some((hh) => hh.command?.includes('devglobe')),
    );
    if (!alreadyInstalled) {
      eventHooks.push(hookEntry);
    }
    existing.hooks[event] = eventHooks;
  }

  writeFileSync(hooksPath, JSON.stringify(existing, null, 2));

  const configTomlPath = join(codexDir, 'config.toml');
  let tomlContent = '';
  try { tomlContent = readFileSync(configTomlPath, 'utf-8'); } catch { /* doesn't exist */ }

  if (!tomlContent.includes('codex_hooks')) {
    if (tomlContent.includes('[features]')) {
      tomlContent = tomlContent.replace(
        /\[features\]/,
        '[features]\ncodex_hooks = true',
      );
    } else {
      const separator = tomlContent.length > 0 && !tomlContent.endsWith('\n') ? '\n\n' : tomlContent.length > 0 ? '\n' : '';
      tomlContent += `${separator}[features]\ncodex_hooks = true\n`;
    }
    writeFileSync(configTomlPath, tomlContent);
  }

  console.log(JSON.stringify({
    ok: true,
    message: `DevGlobe configured! API key saved, hooks installed in ${hooksPath}, codex_hooks feature enabled in config.toml. Restart Codex for hooks to take effect.`,
  }));
}

main().catch(() => process.exit(1));
