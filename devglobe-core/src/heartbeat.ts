import { HeartbeatBatch, HeartbeatResponse } from './types.js';
import { HEARTBEAT_ENDPOINT, STATUS_ENDPOINT, FETCH_TIMEOUT_MS } from './constants.js';
import { logger } from './logger.js';

export async function sendBatch(apiKey: string, batch: HeartbeatBatch): Promise<HeartbeatResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const started = Date.now();
  try {
    logger.debug('heartbeat send', {
      events: batch.heartbeats.length,
      editor: batch.editor,
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
    if (!res.ok) {
      logger.error(`heartbeat HTTP ${res.status} (${Date.now() - started}ms)`);
      throw new Error(`HTTP ${res.status}`);
    }
    const body = await res.json() as HeartbeatResponse;
    logger.debug(`heartbeat ok (${Date.now() - started}ms)`, body);
    return body;
  } catch (err) {
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
    const res = await fetch(STATUS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ message: truncated }),
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.error(`status HTTP ${res.status}`);
      throw new Error(`HTTP ${res.status}`);
    }
    logger.debug('status ok');
  } catch (err) {
    if (!(err instanceof Error && err.message.startsWith('HTTP '))) {
      logger.error('status error', err);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
