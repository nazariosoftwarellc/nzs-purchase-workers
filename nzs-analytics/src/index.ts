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
      if (path === '/v1/metrics' && request.method === 'GET') {
        return await getMetrics(request, env);
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

async function getMetrics(request: Request, env: Env): Promise<Response> {
  const appId = new URL(request.url).searchParams.get('appId');
  if (!isIdentifier(appId)) {
    return new Response('Expected appId query parameter', { status: 400 });
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString();
  const totals = await env.DB.prepare(
    `SELECT
       COUNT(first_seen) AS unique_users,
       SUM(CASE WHEN premium = 1 AND first_seen IS NOT NULL THEN 1 ELSE 0 END) AS premium_users,
       SUM(CASE WHEN last_seen >= ? THEN 1 ELSE 0 END) AS active_users_30d
     FROM app_users
     WHERE app_id = ?`
  )
    .bind(thirtyDaysAgo, appId)
    .first<{ unique_users: number; premium_users: number; active_users_30d: number }>();
  const daily = await env.DB.prepare(
    'SELECT COUNT(*) AS active_users_today FROM app_daily_activity WHERE app_id = ? AND day = ?'
  )
    .bind(appId, today)
    .first<{ active_users_today: number }>();

  return Response.json(
    {
      appId,
      uniqueUsers: totals?.unique_users ?? 0,
      premiumUsers: totals?.premium_users ?? 0,
      activeUsers30d: totals?.active_users_30d ?? 0,
      activeUsersToday: daily?.active_users_today ?? 0
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
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
