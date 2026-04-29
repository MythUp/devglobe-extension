import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { GIT_CACHE_TTL_MS } from './constants.js';

// Pure file-system git detection — no `git` binary, no shell out.
// Walks up at most MAX_WALK_UP parents. Handles worktrees and submodules
// (a `.git` file containing `gitdir: <path>` is followed transparently).

const MAX_WALK_UP = 30;
const MAX_CACHE_ENTRIES = 32;

export interface GitInfo {
  repo: string | null;
  branch: string | null;
  root: string | null;
}

interface CacheEntry extends GitInfo {
  fetchedAt: number;
}

const NO_GIT: GitInfo = { repo: null, branch: null, root: null };
const cache = new Map<string, CacheEntry>();

export async function detectGit(cwd: string): Promise<GitInfo> {
  const now = Date.now();
  const hit = cache.get(cwd);
  if (hit && now - hit.fetchedAt < GIT_CACHE_TTL_MS) {
    return { repo: hit.repo, branch: hit.branch, root: hit.root };
  }

  const realCwd = await safeRealpath(cwd);
  const info = await findGit(realCwd);

  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(cwd, { ...info, fetchedAt: now });
  return info;
}

async function safeRealpath(p: string): Promise<string> {
  try {
    return await fsp.realpath(p);
  } catch {
    return p;
  }
}

async function findGit(start: string): Promise<GitInfo> {
  let dir = start;
  for (let i = 0; i < MAX_WALK_UP; i++) {
    const gitDir = await resolveGitDir(dir);
    if (gitDir === 'not-a-repo') {
      return { repo: null, branch: null, root: dir };
    }
    if (gitDir) {
      const [branch, repo] = await Promise.all([readBranch(gitDir), readRepo(gitDir)]);
      return { repo, branch, root: dir };
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return NO_GIT;
}

// Resolves the actual git directory for the given working dir.
// Returns null when there's no `.git` here (caller should walk up),
// 'not-a-repo' when a `.git` exists but can't be interpreted (give up).
async function resolveGitDir(dir: string): Promise<string | null | 'not-a-repo'> {
  const gitPath = path.join(dir, '.git');
  const stat = await fsp.stat(gitPath).catch(() => null);
  if (!stat) return null;

  if (stat.isDirectory()) return gitPath;
  if (!stat.isFile()) return 'not-a-repo';

  const content = await fsp.readFile(gitPath, 'utf8').catch(() => '');
  const match = content.match(/^gitdir:\s*(.+)$/m);
  if (!match) return 'not-a-repo';
  const target = match[1].trim();
  return path.isAbsolute(target) ? target : path.resolve(dir, target);
}

async function readBranch(gitDir: string): Promise<string | null> {
  try {
    const head = (await fsp.readFile(path.join(gitDir, 'HEAD'), 'utf8')).trim();
    const refMatch = head.match(/^ref:\s*refs\/heads\/(.+)$/);
    return refMatch ? refMatch[1] : null;
  } catch {
    return null;
  }
}

async function readRepo(gitDir: string): Promise<string | null> {
  try {
    const configPath = await resolveConfigPath(gitDir);
    const content = await fsp.readFile(configPath, 'utf8');
    return parseOriginUrl(content);
  } catch {
    return null;
  }
}

// Worktrees keep their config in the main repo, pointed to by `commondir`.
async function resolveConfigPath(gitDir: string): Promise<string> {
  try {
    const commondir = (await fsp.readFile(path.join(gitDir, 'commondir'), 'utf8')).trim();
    const resolved = path.isAbsolute(commondir) ? commondir : path.resolve(gitDir, commondir);
    const altConfig = path.join(resolved, 'config');
    await fsp.access(altConfig);
    return altConfig;
  } catch {
    return path.join(gitDir, 'config');
  }
}

function parseOriginUrl(config: string): string | null {
  const lines = config.split('\n');
  let inOrigin = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) {
      inOrigin = /^\[remote\s+"origin"\]$/.test(trimmed);
      continue;
    }
    if (!inOrigin) continue;
    const match = trimmed.match(/^url\s*=\s*(.+)$/);
    if (match) {
      return canonicalizeRepoUrl(match[1].trim());
    }
  }
  return null;
}

export function canonicalizeRepoUrl(raw: string): string | null {
  if (!raw) return null;
  const stripped = raw.replace(/\.git$/, '');

  const ssh = stripped.match(/^[\w.-]+@([^:]+):(.+)$/);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;

  const sshUrl = stripped.match(/^ssh:\/\/[\w.-]+@([^/:]+)(?::\d+)?\/(.+)$/);
  if (sshUrl) return `https://${sshUrl[1]}/${sshUrl[2]}`;

  if (/^https?:\/\//.test(stripped)) return stripped;

  const gitProto = stripped.match(/^git:\/\/([^/]+)\/(.+)$/);
  if (gitProto) return `https://${gitProto[1]}/${gitProto[2]}`;

  return null;
}

export function relativeToRoot(filePath: string, repoRoot: string): string {
  const rel = path.relative(repoRoot, filePath);
  return rel.startsWith('..') ? filePath : rel;
}

export interface RepoFields {
  file?: string;
  repo?: string;
  branch?: string;
}

export interface PrivacyFlags {
  hideFileNames: boolean;
  hideBranchNames: boolean;
  hideProjectNames: boolean;
}

// Resolves repo/branch/file fields for a given absolute file path, applying
// privacy flags. Hiding the project also hides the branch (revealing the
// branch of a hidden project would leak structural info). The file path is
// only emitted relative to a git root — we never leak a home-relative
// absolute path.
export async function resolveRepoFields(
  filePath: string,
  privacy: PrivacyFlags,
  cwd: string = path.dirname(filePath),
): Promise<RepoFields> {
  const git = await detectGit(cwd);
  const fields: RepoFields = {};

  if (!privacy.hideProjectNames && git.repo) fields.repo = git.repo;
  if (!privacy.hideProjectNames && !privacy.hideBranchNames && git.branch) {
    fields.branch = git.branch;
  }
  if (!privacy.hideFileNames && git.root) {
    fields.file = relativeToRoot(filePath, git.root);
  }
  return fields;
}
