import { HeartbeatBatch, HeartbeatResponse } from './types.js';
import { HEARTBEAT_ENDPOINT, STATUS_ENDPOINT, FETCH_TIMEOUT_MS } from './constants.js';

export async function sendBatch(batch: HeartbeatBatch): Promise<HeartbeatResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(HEARTBEAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json() as HeartbeatResponse;
  } finally {
    clearTimeout(timer);
  }
}

export async function sendStatus(apiKey: string, message: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const truncated = message.slice(0, 100);
    const res = await fetch(STATUS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: apiKey, message: truncated }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } finally {
    clearTimeout(timer);
  }
}
