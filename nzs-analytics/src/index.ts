interface Env {
  DB: D1Database;
  PURCHASE_TOKEN: string;
  ADMIN_TOKEN: string;
}

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxBodyLength = 1024;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = new URL(request.url).pathname;

    try {
      if (path === '/v1/seen' && request.method === 'POST') {
        return await recordSeen(request, env);
      }
      if (path === '/v1/purchase' && request.method === 'POST') {
        return await recordPurchase(request, env);
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

async function recordSeen(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);
  if (!isRecord(body) || !isUserId(body.userId)) {
    return new Response('Expected a version 4 userId', { status: 400 });
  }

  const now = new Date().toISOString();
  const day = now.slice(0, 10);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO users (user_id, first_seen, last_seen)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         first_seen = COALESCE(users.first_seen, excluded.first_seen),
         last_seen = MAX(COALESCE(users.last_seen, excluded.last_seen), excluded.last_seen)`
    ).bind(body.userId, now, now),
    env.DB.prepare(
      'INSERT OR IGNORE INTO daily_activity (user_id, day) VALUES (?, ?)'
    ).bind(body.userId, day)
  ]);

  return new Response(null, { status: 204 });
}

async function recordPurchase(request: Request, env: Env): Promise<Response> {
  if (!authorized(request, env.PURCHASE_TOKEN)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await readJson(request);
  if (
    !isRecord(body) ||
    !isUserId(body.userId) ||
    typeof body.purchased !== 'boolean'
  ) {
    return new Response('Expected userId and purchased boolean', {
      status: 400
    });
  }

  const purchased = body.purchased ? 1 : 0;
  const purchasedAt = body.purchased ? new Date().toISOString() : null;
  await env.DB.prepare(
    `INSERT INTO users (user_id, purchased, purchased_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       purchased = excluded.purchased,
       purchased_at = excluded.purchased_at`
  )
    .bind(body.userId, purchased, purchasedAt)
    .run();

  return new Response(null, { status: 204 });
}

async function getMetrics(request: Request, env: Env): Promise<Response> {
  if (!authorized(request, env.ADMIN_TOKEN)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString();
  const totals = await env.DB.prepare(
    `SELECT
       COUNT(first_seen) AS unique_users,
       SUM(CASE WHEN purchased = 1 AND first_seen IS NOT NULL THEN 1 ELSE 0 END) AS purchased_users,
       SUM(CASE WHEN last_seen >= ? THEN 1 ELSE 0 END) AS active_users_30d
     FROM users`
  )
    .bind(thirtyDaysAgo)
    .first<{ unique_users: number; purchased_users: number; active_users_30d: number }>();
  const daily = await env.DB.prepare(
    'SELECT COUNT(*) AS active_users_today FROM daily_activity WHERE day = ?'
  )
    .bind(today)
    .first<{ active_users_today: number }>();

  return Response.json(
    {
      uniqueUsers: totals?.unique_users ?? 0,
      purchasedUsers: totals?.purchased_users ?? 0,
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

function isUserId(value: unknown): value is string {
  return typeof value === 'string' && uuidV4.test(value);
}

function authorized(request: Request, token: string | undefined): boolean {
  return Boolean(token && request.headers.get('Authorization') === `Bearer ${token}`);
}
