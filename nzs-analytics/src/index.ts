interface Env {
  DB: D1Database;
}

const maxBodyLength = 1024;
const maxIdentifierLength = 128;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;

    try {
      if ((path === '/' || path === '/v1/seen') && request.method === 'POST') {
        return await recordUser(request, env);
      }
      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error('Analytics request failed', error);
      return new Response('Internal server error', { status: 500 });
    }
  }
} satisfies ExportedHandler<Env>;

async function recordUser(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (
    !isRecord(body) ||
    !isIdentifier(body.appId) ||
    !isIdentifier(body.userId) ||
    typeof body.premium !== 'boolean'
  ) {
    return new Response('Expected appId, userId, and premium', { status: 400 });
  }

  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO app_users (app_id, user_id, premium, first_seen, last_seen)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(app_id, user_id) DO UPDATE SET
         premium = excluded.premium,
         first_seen = COALESCE(app_users.first_seen, excluded.first_seen),
         last_seen = MAX(COALESCE(app_users.last_seen, excluded.last_seen), excluded.last_seen)`
    ).bind(body.appId, body.userId, body.premium ? 1 : 0, now, now),
    env.DB.prepare(
      'INSERT OR IGNORE INTO app_daily_activity (app_id, user_id, day) VALUES (?, ?, ?)'
    ).bind(body.appId, body.userId, day)
  ]);

  return new Response(null, { status: 204 });
}

async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get('Content-Length'));
  if (length > maxBodyLength) return null;

  try {
    const text = await request.text();
    return text.length <= maxBodyLength ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maxIdentifierLength
  );
}
