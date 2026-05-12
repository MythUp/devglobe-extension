export const API_BASE_URL = 'https://devglobe.app';
export const HEARTBEAT_ENDPOINT = `${API_BASE_URL}/api/v2/heartbeat`;
export const STATUS_ENDPOINT = `${API_BASE_URL}/api/v2/status`;

export const KEEPALIVE_INTERVAL_MS = 30_000;
export const DEDUP_WINDOW_MS = 2_000;
export const ACTIVITY_TIMEOUT_MS = 60_000;
export const FETCH_TIMEOUT_MS = 15_000;
export const GIT_CACHE_TTL_MS = 300_000;
export const ONESHOT_RATE_LIMIT_MS = 60_000;
export const OFFLINE_THRESHOLD = 2;

export function currentPlatform(): string {
  switch (process.platform) {
    case 'darwin': return 'macOS';
    case 'win32': return 'Windows';
    default: return 'Linux';
  }
}
