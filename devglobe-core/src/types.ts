// Client → Core (stdin)
export type ClientMessage =
  | { method: 'init'; params: InitParams }
  | { method: 'activity'; params: ActivityParams }
  | { method: 'set_status'; params: SetStatusParams }
  | { method: 'pause' }
  | { method: 'resume' }
  | { method: 'shutdown' };

export interface InitParams {
  plugin_version: string;
  editor: string;
  // Legacy fields ignored: api_key, share_repo, anonymous_mode, status_message
  [key: string]: unknown;
}

export interface ActivityParams {
  file?: string;
  file_path?: string; // legacy alias, mapped to file
  language?: string | null;
  [key: string]: unknown;
}

export interface SetStatusParams {
  message: string;
  api_key?: string;
}

// Core → Client (stdout)
export type CoreEvent =
  | { event: 'ready'; data: { configured: boolean } }
  | { event: 'not_configured' }
  | { event: 'invalid_api_key' }
  | { event: 'heartbeat_ok'; data: { today_seconds: number; language: string | null } }
  | { event: 'offline' }
  | { event: 'online' }
  | { event: 'status_ok' }
  | { event: 'status_error'; data: { message: string } };

// Heartbeat batch payload
export interface HeartbeatEvent {
  time: number;
  file?: string;
  language?: string;
  /** Canonical https:// URL of the origin remote, when available. */
  repo?: string;
  branch?: string;
}

export interface HeartbeatBatch {
  plugin_version: string;
  editor: string;
  platform: string;
  heartbeats: HeartbeatEvent[];
}

export interface HeartbeatResponse {
  today_seconds?: number;
}

// Tracker state (exposed to daemon for internal tracking)
export interface TrackerState {
  configured: boolean;
  tracking: boolean;
  offline: boolean;
  codingTime: string;
  todaySeconds: number;
}
