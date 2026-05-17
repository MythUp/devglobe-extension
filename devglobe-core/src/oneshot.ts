import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig, devglobeDir } from './config.js';
import { resolveRepoFields, resolveRepoFromCwd } from './git.js';
import { langFromPath } from './language.js';
import { sendBatch, InvalidApiKeyError } from './heartbeat.js';
import { logger } from './logger.js';
import { ONESHOT_RATE_LIMIT_MS, currentPlatform } from './constants.js';
import type { HeartbeatBatch, HeartbeatEvent } from './types.js';

export interface OneshotParams {
  file?: string;
  cwd?: string;
  language?: string;
  editor: string;
  pluginVersion: string;
  force?: boolean;
}

export interface OneshotState {
  lastHeartbeatAt?: number;
  lastFile?: string;
  lastLanguage?: string;
}

// In-memory variant for long-lived plugins (e.g. OpenCode) where the host
// process owns the state and concurrent instances must not share a file.
// Mutates `state` in place on a successful send.
export async function runOneshotInMemory(
  params: OneshotParams,
  state: OneshotState,
): Promise<void> {
  const cfg = loadConfig();
  logger.setEditor(params.editor);
  if (!cfg.apiKey) {
    logger.error('oneshot skipped: not configured');
    return;
  }

  const now = Date.now();
  const language = params.language
    ?? (params.file ? langFromPath(params.file) : null)
    ?? state.lastLanguage
    ?? undefined;

  const fileChanged = params.file !== undefined && params.file !== state.lastFile;
  const langChanged = language !== undefined && language !== state.lastLanguage;

  const rateLimited = state.lastHeartbeatAt !== undefined
    && now - state.lastHeartbeatAt < ONESHOT_RATE_LIMIT_MS;
  if (!params.force && !fileChanged && !langChanged && rateLimited) {
    logger.debug('oneshot rate-limited', { sinceLast: now - (state.lastHeartbeatAt ?? 0) });
    return;
  }

  const ev: HeartbeatEvent = { time: now / 1000 };
  if (language) ev.language = language;
  if (params.file) {
    Object.assign(ev, await resolveRepoFields(params.file, cfg.privacy));
  } else if (params.cwd) {
    Object.assign(ev, await resolveRepoFromCwd(params.cwd, cfg.privacy));
  }

  const batch: HeartbeatBatch = {
    plugin_version: params.pluginVersion,
    editor: params.editor,
    platform: currentPlatform(),
    heartbeats: [ev],
  };

  try {
    await sendBatch(cfg.apiKey, batch);
    state.lastHeartbeatAt = now;
    state.lastFile = params.file;
    state.lastLanguage = language;
  } catch (err) {
    if (err instanceof InvalidApiKeyError) {
      logger.error('oneshot stopping: invalid api key — re-run setup with a valid key');
      throw err;
    }
    logger.error('oneshot send failed; state preserved for retry', err);
  }
}

// File-backed variant for one-shot CLI invocations (Claude Code, Codex, raw
// `devglobe-core oneshot`). Each call is a separate process, so persisting
// state to disk is the only way to dedup across invocations.
export async function runOneshot(params: OneshotParams): Promise<void> {
  const cfg = loadConfig();
  logger.setEditor(params.editor);
  if (!cfg.apiKey) {
    logger.error('oneshot skipped: not configured');
    process.stderr.write('not configured — run: devglobe-core setup <API_KEY>\n');
    process.exit(1);
  }

  const state = loadState();
  const before = state.lastHeartbeatAt;
  try {
    await runOneshotInMemory(params, state);
  } catch (err) {
    if (err instanceof InvalidApiKeyError) {
      process.stderr.write(
        'devglobe: invalid API key. Re-run setup with a valid key from https://devglobe.app/dashboard/settings\n',
      );
    }
  }
  if (state.lastHeartbeatAt !== before) saveState(state);
}

function stateFile(): string {
  return path.join(devglobeDir(), 'oneshot-state.json');
}

function loadState(): OneshotState {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf-8'));
  } catch {
    return {};
  }
}

function saveState(state: OneshotState): void {
  const dir = devglobeDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(stateFile(), JSON.stringify(state), { mode: 0o600 });
}
