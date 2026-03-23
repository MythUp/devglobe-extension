import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { langFromPath } from './language.js';
import { detectRepo } from './git.js';
import { fetchGeolocationFile } from './geo.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, RATE_LIMIT_MS, FETCH_TIMEOUT_MS } from './constants.js';
import type { OneshotParams, OneshotState, Config } from './types.js';

const STATE_PATH = join(homedir(), '.devglobe', 'oneshot-state.json');

function getApiKey(): string | null {
  const envKey = process.env.DEVGLOBE_API_KEY;
  if (envKey?.trim()) return envKey.trim();

  try {
    const key = readFileSync(join(homedir(), '.devglobe', 'api_key'), 'utf-8').trim();
    if (key) return key;
  } catch { /* file doesn't exist */ }

  return null;
}

function getConfig(): Config {
  try {
    return JSON.parse(readFileSync(join(homedir(), '.devglobe', 'config.json'), 'utf-8'));
  } catch {
    return {};
  }
}

function readState(): OneshotState {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeState(state: OneshotState): void {
  try { writeFileSync(STATE_PATH, JSON.stringify(state)); } catch { /* ignore */ }
}

export async function runOneshot(params: OneshotParams): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) return;

  const state = readState();
  const now = Date.now();

  const cwdChanged = params.cwd !== state.lastCwd;

  const language = params.language
    ?? (params.file_path ? langFromPath(params.file_path) : null)
    ?? (cwdChanged ? null : state.lastLanguage)
    ?? null;

  const repoDirs: string[] = [];
  if (params.file_path) repoDirs.push(dirname(params.file_path));
  repoDirs.push(params.cwd);

  let repo: string | null = null;
  for (const dir of repoDirs) {
    repo = await detectRepo(dir);
    if (repo) break;
  }

  const languageChanged = language && language !== state.lastLanguage;
  if (!params.force && !languageChanged && state.lastHeartbeatAt) {
    if (now - state.lastHeartbeatAt < RATE_LIMIT_MS) return;
  }

  const config = getConfig();
  const anonymous = config.anonymousMode !== false;

  let geo = await fetchGeolocationFile(anonymous, params.session_id);

  const platformMap: Record<string, string> = { darwin: "macOS", linux: "Linux", win32: "Windows" };

  const body: Record<string, unknown> = {
    p_key: apiKey,
    p_editor: params.editor,
    p_anonymous: anonymous,
    p_share_repo: config.shareRepo === true,
    p_platform: platformMap[process.platform] ?? process.platform,
  };

  if (language) body.p_lang = language;
  if (config.shareRepo === true && repo) body.p_repo = repo;
  if (geo?.city) body.p_city = geo.city;
  if (geo?.lat != null) body.p_lat = geo.lat;
  if (geo?.lon != null) body.p_lng = geo.lon;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return;
  } catch {
    return;
  } finally {
    clearTimeout(timer);
  }

  writeState({ lastHeartbeatAt: now, lastLanguage: language, lastRepo: repo, lastCwd: params.cwd });
}
