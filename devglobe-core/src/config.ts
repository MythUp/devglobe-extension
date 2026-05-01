import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { logger } from './logger.js';

export interface DevGlobeConfig {
  apiKey: string | null;
  debug: boolean;
  privacy: {
    hideFileNames: boolean;
    hideBranchNames: boolean;
    hideProjectNames: boolean;
  };
}

function defaultConfig(): DevGlobeConfig {
  return {
    apiKey: null,
    debug: false,
    privacy: { hideFileNames: false, hideBranchNames: false, hideProjectNames: false },
  };
}

export function devglobeDir(): string {
  return path.join(os.homedir(), '.devglobe');
}

export function configPath(): string {
  return path.join(devglobeDir(), 'config.toml');
}

export function legacyApiKeyPath(): string {
  return path.join(devglobeDir(), 'api_key');
}

export function loadConfig(): DevGlobeConfig {
  const cfgPath = configPath();
  let cfg: DevGlobeConfig;
  if (!fs.existsSync(cfgPath)) {
    cfg = migrateLegacyKey();
  } else {
    try {
      cfg = parseToml(fs.readFileSync(cfgPath, 'utf-8'));
    } catch {
      cfg = defaultConfig();
    }
  }
  logger.configure(cfg.debug);
  return cfg;
}

export function saveConfig(cfg: DevGlobeConfig): void {
  const dir = devglobeDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath(), stringifyToml(cfg), { mode: 0o600 });
}

export function setApiKey(apiKey: string): void {
  const cfg = loadConfig();
  cfg.apiKey = apiKey;
  saveConfig(cfg);
  logger.info('api key saved to config.toml');
}

function migrateLegacyKey(): DevGlobeConfig {
  const legacyPath = legacyApiKeyPath();
  if (!fs.existsSync(legacyPath)) return defaultConfig();
  try {
    const key = fs.readFileSync(legacyPath, 'utf-8').trim();
    const cfg = defaultConfig();
    cfg.apiKey = key || null;
    saveConfig(cfg);
    logger.info('migrated legacy ~/.devglobe/api_key to config.toml');
    return cfg;
  } catch (err) {
    logger.error('failed to migrate legacy api_key', err);
    return defaultConfig();
  }
}

function parseTomlValue(raw: string): string | boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  return raw;
}

function parseToml(content: string): DevGlobeConfig {
  const cfg = defaultConfig();
  let section = '';
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1).trim();
      continue;
    }
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const value = parseTomlValue(line.slice(eqIdx + 1).trim());

    if (section === '' && key === 'api_key' && typeof value === 'string') {
      cfg.apiKey = value || null;
    } else if (section === '' && key === 'debug' && typeof value === 'boolean') {
      cfg.debug = value;
    } else if (section === 'privacy' && typeof value === 'boolean') {
      if (key === 'hide_file_names') cfg.privacy.hideFileNames = value;
      else if (key === 'hide_branch_names') cfg.privacy.hideBranchNames = value;
      else if (key === 'hide_project_names') cfg.privacy.hideProjectNames = value;
    }
  }
  return cfg;
}

function stringifyToml(cfg: DevGlobeConfig): string {
  const lines: string[] = [];
  if (cfg.apiKey) lines.push(`api_key = "${cfg.apiKey}"`);
  if (cfg.debug) lines.push(`debug = true`);
  lines.push('');
  lines.push('[privacy]');
  lines.push(`hide_file_names = ${cfg.privacy.hideFileNames}`);
  lines.push(`hide_branch_names = ${cfg.privacy.hideBranchNames}`);
  lines.push(`hide_project_names = ${cfg.privacy.hideProjectNames}`);
  return lines.join('\n') + '\n';
}
