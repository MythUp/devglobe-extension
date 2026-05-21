import { HeartbeatBatch, HeartbeatResponse } from './types.js';
import { HEARTBEAT_ENDPOINT, STATUS_ENDPOINT, FETCH_TIMEOUT_MS } from './constants.js';
import { logger } from './logger.js';

function summarizeKey(apiKey: string): { length: number; prefix: string; suffix: string } {
  return {
    length: apiKey.length,
    prefix: apiKey.slice(0, 4),
    suffix: apiKey.slice(-4),
  };
}

/**
 * Thrown when the server explicitly rejects the API key (HTTP 401).
 * The tracker stops on this; plugins should surface a notification and
 * prompt the user to re-enter their key.
 */
export class InvalidApiKeyError extends Error {
  readonly code = 'INVALID_API_KEY' as const;
  constructor() {
    super('Invalid API key');
    this.name = 'InvalidApiKeyError';
  }
}

async function readResponseText(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.trim();
  } catch {
    return '';
  }
}

export async function sendBatch(apiKey: string, batch: HeartbeatBatch): Promise<HeartbeatResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const started = Date.now();
  try {
    logger.debug('heartbeat send', {
      events: batch.heartbeats.length,
      editor: batch.editor,
      platform: batch.platform,
      key: summarizeKey(apiKey),
      first: batch.heartbeats[0],
    });
    const res = await fetch(HEARTBEAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(batch),
      signal: controller.signal,
    });
    if (res.status === 401) {
      const body = await readResponseText(res);
      logger.error(`heartbeat rejected: invalid api key (${Date.now() - started}ms)`, body || '<empty body>');
      throw new InvalidApiKeyError();
    }
    if (!res.ok) {
      const body = await readResponseText(res);
      logger.error(`heartbeat HTTP ${res.status} (${Date.now() - started}ms)`, body || '<empty body>');
      throw new Error(`HTTP ${res.status}`);
    }
    const body = await res.json() as HeartbeatResponse;
    logger.debug(`heartbeat ok (${Date.now() - started}ms)`, body);
    return body;
  } catch (err) {
    if (err instanceof InvalidApiKeyError) throw err;
    if (!(err instanceof Error && err.message.startsWith('HTTP '))) {
      logger.error('heartbeat error', err);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function sendStatus(apiKey: string, message: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const truncated = message.slice(0, 100);
    logger.debug('status send', { length: truncated.length });
    logger.debug('status key', summarizeKey(apiKey));
    const res = await fetch(STATUS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ message: truncated }),
      signal: controller.signal,
    });
    if (res.status === 401) {
      const body = await readResponseText(res);
      logger.error('status rejected: invalid api key', { body: body || '<empty body>', key: summarizeKey(apiKey), length: truncated.length });
      throw new InvalidApiKeyError();
    }
    if (!res.ok) {
      const body = await readResponseText(res);
      logger.error(`status HTTP ${res.status}`, { body: body || '<empty body>', key: summarizeKey(apiKey), length: truncated.length });
      throw new Error(`HTTP ${res.status}`);
    }
    logger.debug('status ok');
  } catch (err) {
    if (err instanceof InvalidApiKeyError) throw err;
    if (!(err instanceof Error && err.message.startsWith('HTTP '))) {
      logger.error('status error', err);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
