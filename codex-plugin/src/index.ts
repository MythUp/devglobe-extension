import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { runOneshot } from '../../devglobe-core/src/oneshot';
import { langFromPath } from '../../devglobe-core/src/language';
import type { Input } from './types';

const FILE_PATH_RE = /(?:^|\s|['"`(])(\/?(?:[\w.@-]+\/)*[\w.@-]+\.\w{1,10})(?=[\s'"`):,]|$)/g;

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.next', '__pycache__', 'target', 'vendor']);

function extractFilePaths(text: string | undefined): string[] {
  if (!text) return [];
  const paths: string[] = [];
  for (const match of text.matchAll(FILE_PATH_RE)) {
    const p = match[1];
    if (p.includes('/') || langFromPath(p)) {
      paths.push(p);
    }
  }
  return paths;
}

function findRecentFile(cwd: string): string | null {
  let best: { path: string; mtime: number } | null = null;

  function scan(dir: string, depth: number): void {
    if (depth > 2) return;
    try {
      for (const name of readdirSync(dir)) {
        if (name.startsWith('.') || SKIP_DIRS.has(name)) continue;

        const full = join(dir, name);
        try {
          const st = statSync(full);
          if (st.isDirectory() && depth < 2) {
            scan(full, depth + 1);
          } else if (st.isFile()) {
            const ext = extname(name);
            if (!ext || ext === '.lock' || ext === '.log') continue;
            if (!best || st.mtimeMs > best.mtime) {
              best = { path: full, mtime: st.mtimeMs };
            }
          }
        } catch { /* permission denied or broken symlink */ }
      }
    } catch { /* unreadable dir */ }
  }

  scan(cwd, 0);
  return best?.path ?? null;
}

async function main(): Promise<void> {
  const raw = readFileSync(0, 'utf-8');
  let input: Input;
  try {
    input = JSON.parse(raw);
  } catch {
    return;
  }

  const { session_id, cwd, hook_event_name } = input;

  let filePath: string | undefined;
  let language: string | undefined;

  const textSources = [input.prompt, input.last_assistant_message];
  for (const text of textSources) {
    const paths = extractFilePaths(text);
    for (const p of paths) {
      const resolved = p.startsWith('/') ? p : join(cwd, p);
      const lang = langFromPath(resolved);
      if (lang) {
        filePath = resolved;
        language = lang;
        break;
      }
    }
    if (language) break;
  }

  if (!language) {
    const recent = findRecentFile(cwd);
    if (recent) {
      const lang = langFromPath(recent);
      if (lang) {
        filePath = recent;
        language = lang;
      }
    }
  }

  await runOneshot({
    file_path: filePath,
    cwd,
    editor: 'codex',
    language,
    session_id,
    force: hook_event_name === 'Stop',
  });
}

main().catch(() => process.exit(0));
