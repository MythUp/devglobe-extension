import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { runOneshot } from '../../devglobe-core/src/oneshot';
import { langFromPath } from '../../devglobe-core/src/language';
import { PLUGIN_VERSION, type Input } from './types';

const BACKTICK_PATH_RE = /`(\/[^`\n]+\.\w{1,10})`/g;

const BARE_PATH_RE = /(?:^|\s)(\/(?:[\w .@-]+\/)+[\w.@-]+\.\w{1,10})(?=[\s,;:]|$)/gm;

const RELATIVE_PATH_RE = /(?:^|\s|['"`(])((?:[\w.@-]+\/)+[\w.@-]+\.\w{1,10})(?=[\s'"`):,]|$)/g;

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.next', '__pycache__', 'target', 'vendor']);

function extractFilePaths(text: string | undefined): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const paths: string[] = [];

  function add(p: string): void {
    if (!seen.has(p)) {
      seen.add(p);
      paths.push(p);
    }
  }

  for (const m of text.matchAll(BACKTICK_PATH_RE)) add(m[1]);
  for (const m of text.matchAll(BARE_PATH_RE)) add(m[1].trim());
  for (const m of text.matchAll(RELATIVE_PATH_RE)) {
    const p = m[1];
    if (p.includes('/') || langFromPath(p)) add(p);
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

function pickBestFile(paths: string[], cwd: string): { filePath: string; language: string } | null {
  const codePaths: { filePath: string; language: string }[] = [];

  for (const p of paths) {
    const resolved = p.startsWith('/') ? p : join(cwd, p);
    const lang = langFromPath(resolved);
    if (lang && lang !== 'Markdown' && lang !== 'Plain Text' && lang !== 'JSON' && lang !== 'YAML' && lang !== 'TOML') {
      codePaths.push({ filePath: resolved, language: lang });
    }
  }

  if (codePaths.length > 0) {
    const existing = codePaths.find((p) => existsSync(p.filePath));
    return existing ?? codePaths[0];
  }

  for (const p of paths) {
    const resolved = p.startsWith('/') ? p : join(cwd, p);
    const lang = langFromPath(resolved);
    if (lang) return { filePath: resolved, language: lang };
  }

  return null;
}

async function main(): Promise<void> {
  const raw = readFileSync(0, 'utf-8');
  let input: Input;
  try {
    input = JSON.parse(raw);
  } catch {
    return;
  }

  const { cwd, hook_event_name } = input;

  let filePath: string | undefined;
  let language: string | undefined;

  const allPaths: string[] = [];
  for (const text of [input.last_assistant_message, input.prompt]) {
    allPaths.push(...extractFilePaths(text));
  }

  const best = pickBestFile(allPaths, cwd);
  if (best) {
    filePath = best.filePath;
    language = best.language;
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
    file: filePath,
    cwd,
    editor: 'codex',
    language,
    pluginVersion: PLUGIN_VERSION,
    force: hook_event_name === 'Stop',
  });
}

main().catch(() => process.exit(0));
