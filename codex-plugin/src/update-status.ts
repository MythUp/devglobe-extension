import { readFileSync } from 'fs';
import { SUPABASE_URL, SUPABASE_ANON_KEY, FETCH_TIMEOUT_MS } from '../../devglobe-core/src/constants';

async function main(): Promise<void> {
  const raw = readFileSync(0, 'utf-8');
  let input: { api_key: string; message: string };
  try {
    input = JSON.parse(raw);
  } catch {
    console.log(JSON.stringify({ error: 'invalid JSON input' }));
    process.exit(1);
  }

  const { api_key, message } = input;

  if (!api_key || !message) {
    console.log(JSON.stringify({ error: 'api_key and message required' }));
    process.exit(1);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_status_message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_key: api_key, p_message: message }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.log(JSON.stringify({ error: `HTTP ${res.status}` }));
      process.exit(1);
    }

    const result = await res.text();
    console.log(JSON.stringify({ ok: true, response: result }));
  } catch (err) {
    console.log(
      JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }),
    );
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
}

main().catch(() => process.exit(1));
