import { readFileSync } from 'fs';
import { runOneshot } from '../../../../devglobe-core/src/oneshot';
import { PLUGIN_VERSION, type Input } from './types';

async function main(): Promise<void> {
  const raw = readFileSync(0, 'utf-8');
  let input: Input;
  try {
    input = JSON.parse(raw);
  } catch {
    return;
  }

  const filePath = input.tool_input?.file_path || input.tool_response?.filePath || undefined;

  await runOneshot({
    file: filePath,
    cwd: input.cwd,
    editor: 'claude-code',
    pluginVersion: PLUGIN_VERSION,
    force: input.hook_event_name === 'Stop',
  });
}

main().catch(() => process.exit(0));
