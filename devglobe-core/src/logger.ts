import * as fs from 'node:fs';
import * as path from 'node:path';
import { devglobeDir } from './config.js';

const LOG_FILE_NAME = 'devglobe.log';
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const TRUNCATE_KEEP_BYTES = 1 * 1024 * 1024;

export enum LogLevel {
  Error = 0,
  Info = 1,
  Debug = 2,
}

class Logger {
  private level: LogLevel = LogLevel.Error;
  private editor: string = '';

  /**
   * Enabled when the config has `debug = true` in `~/.devglobe/config.toml`.
   * The editor tag is shown on every line so logs from multiple plugins
   * sharing the same file stay readable.
   */
  configure(debugFromConfig: boolean, editor?: string): void {
    this.level = debugFromConfig ? LogLevel.Debug : LogLevel.Error;
    if (editor) this.editor = editor;
  }

  setEditor(editor: string): void {
    this.editor = editor;
  }

  isEnabled(): boolean {
    return this.level >= LogLevel.Debug;
  }

  error(...args: unknown[]): void {
    this.write('ERROR', args);
  }

  info(...args: unknown[]): void {
    if (this.level >= LogLevel.Info) this.write('INFO', args);
  }

  debug(...args: unknown[]): void {
    if (this.level >= LogLevel.Debug) this.write('DEBUG', args);
  }

  private write(level: string, args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const message = args.map(this.format).join(' ');
    const tag = this.editor ? `[${this.editor}]` : '';
    const line = `${timestamp} ${level} ${tag} ${message}\n`.replace(/  +/g, ' ');

    try {
      const filePath = this.logPath();
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(filePath, line, { mode: 0o600 });
      this.maybeRotate(filePath);
    } catch {
      // Logging must never break the host process.
    }
  }

  private maybeRotate(filePath: string): void {
    try {
      const stat = fs.statSync(filePath);
      if (stat.size <= MAX_LOG_BYTES) return;
      const fd = fs.openSync(filePath, 'r');
      const buf = Buffer.alloc(TRUNCATE_KEEP_BYTES);
      fs.readSync(fd, buf, 0, TRUNCATE_KEEP_BYTES, stat.size - TRUNCATE_KEEP_BYTES);
      fs.closeSync(fd);
      fs.writeFileSync(filePath, buf, { mode: 0o600 });
    } catch {
      // Rotation failure is non-fatal.
    }
  }

  private logPath(): string {
    return path.join(devglobeDir(), LOG_FILE_NAME);
  }

  private format(arg: unknown): string {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
    try { return JSON.stringify(arg); } catch { return String(arg); }
  }
}

export const logger = new Logger();
