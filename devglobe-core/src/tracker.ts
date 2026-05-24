import { loadConfig, configPath } from './config.js';
import { resolveRepoFields } from './git.js';
import { sendBatch, sendStatus, InvalidApiKeyError } from './heartbeat.js';
import { logger } from './logger.js';
import {
  KEEPALIVE_INTERVAL_MS,
  DEDUP_WINDOW_MS,
  ACTIVITY_TIMEOUT_MS,
  OFFLINE_THRESHOLD,
  currentPlatform,
} from './constants.js';
import type { HeartbeatEvent, HeartbeatBatch, CoreEvent, TrackerState } from './types.js';

export type Emitter = (event: CoreEvent) => void;

interface DedupEntry {
  file: string | undefined;
  language: string | undefined;
  at: number;
}

export class Tracker {
  private pluginVersion = '';
  private editor = '';
  private currentFile: string | undefined;
  // Raw absolute path last seen on the input side, used for change detection.
  // `currentFile` is rewritten relative to the git root and would never match
  // the absolute path coming back in from the editor.
  private lastFileInput: string | undefined;
  private currentLanguage: string | undefined;
  private currentRepo: string | undefined;
  private currentBranch: string | undefined;
  private lastActivity = 0;
  private pending: HeartbeatEvent[] = [];
  private lastDedup: DedupEntry = { file: undefined, language: undefined, at: 0 };
  private timer: NodeJS.Timeout | null = null;
  private paused = false;
  private offline = false;
  private consecutiveErrors = 0;
  private todaySeconds = 0;

  constructor(private readonly emit: Emitter) {}

  init(pluginVersion: string, editor: string): void {
    this.pluginVersion = pluginVersion;
    this.editor = editor;
    logger.setEditor(editor);
    const cfg = loadConfig();
    logger.info(`tracker init pluginVersion=${pluginVersion} configured=${!!cfg.apiKey}`);
    this.emit({ event: 'ready', data: { configured: !!cfg.apiKey } });
    if (!cfg.apiKey) {
      this.emit({ event: 'not_configured' });
      return;
    }
    this.startTimer();
  }

  pause(): void {
    this.paused = true;
    this.stopTimer();
  }

  resume(): void {
    this.paused = false;
    if (!this.timer) this.startTimer();
  }

  shutdown(): void {
    this.stopTimer();
  }

  async activity(file: string | undefined, language: string | undefined): Promise<void> {
    if (this.paused) return;
    const cfg = loadConfig();
    if (!cfg.apiKey) return;

    const now = Date.now();
    this.lastActivity = now;

    const fileChanged = file !== undefined && file !== this.lastFileInput;
    const langChanged = language !== undefined && language !== this.currentLanguage;

    if (!fileChanged && !langChanged) {
      const dup = this.lastDedup;
      if (dup.file === file && dup.language === language && now - dup.at < DEDUP_WINDOW_MS) {
        return;
      }
    }

    const firstActivity = this.lastFileInput === undefined;
    const transition = (fileChanged || langChanged) && !firstActivity;

    if (file !== undefined) {
      this.lastFileInput = file;
      const fields = await resolveRepoFields(file, cfg.privacy);
      this.currentFile = fields.file;
      this.currentRepo = fields.repo;
      this.currentBranch = fields.branch;
      if (fileChanged) logger.debug('activity file', { file: fields.file, repo: fields.repo, branch: fields.branch });
    }
    if (language !== undefined) this.currentLanguage = language || undefined;

    // Heartbeats are emitted on first activity (session start) and transitions.
    // The server uses heartbeats[i].file for the interval [i, i+1], so each
    // heartbeat reflects state going forward from its timestamp.
    if (firstActivity || transition) {
      this.pending.push(this.buildEvent(now, cfg));
    }

    this.lastDedup = { file, language, at: now };
  }

  async setStatus(message: string): Promise<void> {
    const cfg = loadConfig();
    const apiKey = cfg.apiKey;
    if (!apiKey) {
      this.emit({ event: 'status_error', data: { message: 'not configured' } });
      return;
    }
    try {
      logger.debug('setStatus requested', {
        messageLength: message.length,
        configured: !!apiKey,
        keyLength: apiKey.length,
        editor: this.editor,
        configPath: configPath(),
      });
      await sendStatus(apiKey, message);
      this.emit({ event: 'status_ok' });
    } catch (e) {
      if (e instanceof InvalidApiKeyError) {
        // A status-only 401 should not invalidate the whole session.
        // Keep the key and let the next heartbeat be the source of truth.
        this.emit({ event: 'status_error', data: { message: 'status rejected by server (401). Key kept; retry or reconnect if needed.' } });
        return;
      }
      this.emit({ event: 'status_error', data: { message: (e as Error).message } });
    }
  }

  getState(): TrackerState {
    return {
      configured: !!loadConfig().apiKey,
      tracking: !this.paused,
      offline: this.offline,
      codingTime: formatSeconds(this.todaySeconds),
      todaySeconds: this.todaySeconds,
    };
  }

  private startTimer(): void {
    this.timer = setInterval(() => this.tick().catch(() => {}), KEEPALIVE_INTERVAL_MS);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.paused) return;
    const cfg = loadConfig();
    if (!cfg.apiKey) return;

    logger.debug('heartbeat tick', {
      paused: this.paused,
      pending: this.pending.length,
      currentFile: this.currentFile,
      currentLanguage: this.currentLanguage,
      editor: this.editor,
      keyLength: cfg.apiKey.length,
    });

    const now = Date.now();
    if (now - this.lastActivity > ACTIVITY_TIMEOUT_MS && this.pending.length === 0) {
      return;
    }

    // Keepalive marker with current state — gives the server an upper bound
    // for time attribution.
    if (this.currentFile !== undefined) {
      this.pending.push(this.buildEvent(now, cfg));
    }

    if (this.pending.length === 0) return;

    const batch: HeartbeatBatch = {
      plugin_version: this.pluginVersion,
      editor: this.editor,
      platform: currentPlatform(),
      heartbeats: this.pending,
    };

    try {
      const resp = await sendBatch(cfg.apiKey, batch);
      this.pending = [];
      this.consecutiveErrors = 0;
      if (this.offline) {
        this.offline = false;
        logger.info('back online');
        this.emit({ event: 'online' });
      }
      if (resp.today_seconds !== undefined) {
        this.todaySeconds = resp.today_seconds;
        this.emit({
          event: 'heartbeat_ok',
          data: { today_seconds: resp.today_seconds, language: this.currentLanguage ?? null },
        });
      }
    } catch (err) {
      this.pending = [];
      if (err instanceof InvalidApiKeyError) {
        logger.error('tracker stopping: invalid api key');
        this.stopTimer();
        this.emit({ event: 'invalid_api_key' });
        return;
      }
      this.consecutiveErrors++;
      logger.error(`heartbeat tick failed (consecutive=${this.consecutiveErrors})`, err);
      if (this.consecutiveErrors >= OFFLINE_THRESHOLD && !this.offline) {
        this.offline = true;
        logger.info('marking offline');
        this.emit({ event: 'offline' });
      }
    }
  }

  // The privacy guards mirror those in resolveRepoFields, since flags can
  // toggle at runtime between activity() and tick() — never leak past a flip.
  private buildEvent(now: number, cfg: ReturnType<typeof loadConfig>): HeartbeatEvent {
    const { hideFileNames, hideProjectNames, hideBranchNames } = cfg.privacy;
    const ev: HeartbeatEvent = { time: now / 1000 };
    if (this.currentFile !== undefined && !hideFileNames) ev.file = this.currentFile;
    if (this.currentLanguage !== undefined) ev.language = this.currentLanguage;
    if (this.currentRepo !== undefined && !hideProjectNames) ev.repo = this.currentRepo;
    if (this.currentBranch !== undefined && !hideBranchNames && !hideProjectNames) {
      ev.branch = this.currentBranch;
    }
    return ev;
  }
}

function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
