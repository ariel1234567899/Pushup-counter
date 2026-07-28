import webpush from 'web-push';

const json = (value, init = {}) => new Response(JSON.stringify(value), { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });
const cors = (request, env) => request.headers.get('Origin') === env.ALLOWED_ORIGIN ? { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN, Vary: 'Origin' } : {};
const withCors = (request, env, response) => { const headers = new Headers(response.headers); Object.entries(cors(request, env)).forEach(([key, value]) => headers.set(key, value)); return new Response(response.body, { status: response.status, headers }); };
const localParts = (timeZone, now) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
const validTime = (time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

async function sendDueReminders(env, now = new Date()) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  let cursor;
  do {
    const page = await env.SUBSCRIPTIONS.list({ prefix: 'subscription:', cursor }); cursor = page.cursor;
    await Promise.all(page.keys.map(async ({ name }) => {
      const entry = await env.SUBSCRIPTIONS.get(name, 'json'); if (!entry) return;
      const parts = localParts(entry.schedule.timeZone, now); const localDate = `${parts.year}-${parts.month}-${parts.day}`; const localTime = `${parts.hour}:${parts.minute}`;
      const slot = entry.schedule.morning === localTime ? 'morning' : entry.schedule.evening === localTime ? 'evening' : null;
      if (!slot || entry.lastSent?.[slot] === localDate) return;
      try {
        await webpush.sendNotification(entry.subscription, JSON.stringify({ title: 'Push-Up Tracker', body: slot === 'morning' ? 'Good morning — start your push-up goal today.' : 'Evening check-in — how is today’s push-up goal going?' }), { TTL: 120 });
        entry.lastSent = { ...entry.lastSent, [slot]: localDate }; await env.SUBSCRIPTIONS.put(name, JSON.stringify(entry));
      } catch (error) { if (error.statusCode === 404 || error.statusCode === 410) await env.SUBSCRIPTIONS.delete(name); else console.error('Push delivery failed', error); }
    }));
  } while (cursor);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: { ...cors(request, env), 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    if (request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return json({ error: 'Origin not allowed.' }, { status: 403 });
    if (request.method === 'GET' && url.pathname === '/v1/config') return withCors(request, env, json({ publicKey: env.VAPID_PUBLIC_KEY }));
    if (request.method === 'POST' && url.pathname === '/v1/subscriptions') {
      const body = await request.json();
      if (!/^[a-f0-9-]{36}$/i.test(body.clientId || '') || !body.subscription?.endpoint || !validTime(body.schedule?.morning) || !validTime(body.schedule?.evening) || !body.schedule?.timeZone) return withCors(request, env, json({ error: 'Invalid subscription payload.' }, { status: 400 }));
      await env.SUBSCRIPTIONS.put(`subscription:${body.clientId}`, JSON.stringify({ subscription: body.subscription, schedule: body.schedule, lastSent: {} }));
      return withCors(request, env, json({ ok: true }, { status: 201 }));
    }
    if (request.method === 'DELETE' && /^\/v1\/subscriptions\/[a-f0-9-]{36}$/i.test(url.pathname)) { await env.SUBSCRIPTIONS.delete(`subscription:${url.pathname.split('/').pop()}`); return withCors(request, env, json({ ok: true })); }
    return withCors(request, env, json({ error: 'Not found.' }, { status: 404 }));
  },
  async scheduled(_controller, env, ctx) { ctx.waitUntil(sendDueReminders(env)); }
};
