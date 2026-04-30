import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig, devglobeDir } from './config.js';
import { resolveRepoFields } from './git.js';
import { langFromPath } from './language.js';
import { sendBatch } from './heartbeat.js';
import { ONESHOT_RATE_LIMIT_MS, currentPlatform } from './constants.js';
import type { HeartbeatBatch, HeartbeatEvent } from './types.js';

export interface OneshotParams {
  file?: string;
  language?: string;
  editor: string;
  pluginVersion: string;
  force?: boolean;
}

interface OneshotState {
  lastHeartbeatAt?: number;
  lastFile?: string;
  lastLanguage?: string;
  lastRepo?: string;
  lastBranch?: string;
}

export async function runOneshot(params: OneshotParams): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.apiKey) {
    process.stderr.write('not configured — run: devglobe-core setup <API_KEY>\n');
    process.exit(1);
  }

  const now = Date.now();
  const state = loadState();
  const language = params.language ?? (params.file ? langFromPath(params.file) : null) ?? undefined;

  const fileChanged = params.file !== undefined && params.file !== state.lastFile;
  const langChanged = language !== undefined && language !== state.lastLanguage;

  const rateLimited = state.lastHeartbeatAt !== undefined
    && now - state.lastHeartbeatAt < ONESHOT_RATE_LIMIT_MS;
  if (!params.force && !fileChanged && !langChanged && rateLimited) {
    return;
  }

  const ev: HeartbeatEvent = { time: now / 1000 };
  if (language) ev.language = language;
  if (params.file) {
    Object.assign(ev, await resolveRepoFields(params.file, cfg.privacy));
  }

  const batch: HeartbeatBatch = {
    key: cfg.apiKey,
    plugin_version: params.pluginVersion,
    editor: params.editor,
    platform: currentPlatform(),
    heartbeats: [ev],
  };

  try {
    await sendBatch(batch);
    saveState({
      lastHeartbeatAt: now,
      lastFile: params.file,
      lastLanguage: language,
      lastRepo: ev.repo,
      lastBranch: ev.branch,
    });
  } catch {
    // Silent fail — state stays unchanged so the next call retries.
  }
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
