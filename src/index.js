const VISITOR_TTL = 60 * 60 * 24 * 365; 

const NO_STORE = { 'Cache-Control': 'no-store' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...NO_STORE, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/count') {
      if (request.method !== 'GET') {
        return json({ error: 'используй GET' }, 405);
      }

      const visitorId = (url.searchParams.get('v') || 'anon').slice(0, 64);
      const seenKey = `seen:${visitorId}`;

      const alreadySeen = (await env.VIEWS.get(seenKey)) !== null;

      if (!alreadySeen) {
        await env.VIEWS.put(seenKey, '1', { expirationTtl: VISITOR_TTL });
      }

      const stored = parseInt(await env.VIEWS.get('count'), 10);
      const current = Number.isFinite(stored) ? stored : Number(env.INITIAL_COUNT);
      const count = alreadySeen ? current : current + 1;

      if (!alreadySeen) {
        await env.VIEWS.put('count', String(count));
      }

      return json({ count });
    }

    if (url.pathname === '/api/reset') {
      if (request.method !== 'POST') {
        return json({ error: 'используй POST' }, 405);
      }
      if (request.headers.get('X-Reset-Token') !== env.RESET_TOKEN) {
        return json({ error: 'неверный токен' }, 401);
      }
      await env.VIEWS.delete('count');
      return json({ ok: true, count: Number(env.INITIAL_COUNT) });
    }

    return env.ASSETS.fetch(request);
  },
};
