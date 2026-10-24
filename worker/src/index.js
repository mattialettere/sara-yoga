// Contatore visite per il sito su GitHub Pages — Cloudflare Worker + database D1.
//   POST /hit    registra una pagina vista (chiamato dal sito)
//   GET  /stats  restituisce le statistiche (solo dashboard, con chiave segreta)
// Non viene salvato alcun indirizzo IP: il paese e la città arrivano da Cloudflare.

const TZ = 'Europe/London';

const SOCIAL = {
  facebook: 'Facebook', fb: 'Facebook', instagram: 'Instagram', ig: 'Instagram', 't.co': 'X (Twitter)', twitter: 'X (Twitter)', 'x.com': 'X (Twitter)',
  tiktok: 'TikTok', linkedin: 'LinkedIn', 'lnkd.in': 'LinkedIn', pinterest: 'Pinterest', youtube: 'YouTube', 'youtu.be': 'YouTube',
  whatsapp: 'WhatsApp', 'wa.me': 'WhatsApp', telegram: 'Telegram', 't.me': 'Telegram', reddit: 'Reddit', threads: 'Threads'
};
const SEARCH = { google: 'Google', bing: 'Bing', duckduckgo: 'DuckDuckGo', yahoo: 'Yahoo', ecosia: 'Ecosia', brave: 'Brave Search', yandex: 'Yandex', baidu: 'Baidu', qwant: 'Qwant', startpage: 'Startpage' };
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|httpclient|scrapy|java\//i;

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function lookup(host) {
  host = host.toLowerCase();
  for (const [k, name] of Object.entries(SEARCH)) if (new RegExp('(^|\\.)' + esc(k) + '\\.').test(host)) return ['Ricerca', name];
  for (const [k, name] of Object.entries(SOCIAL)) if (host === k || new RegExp('(^|\\.)' + esc(k) + '(\\.|$)').test(host)) return ['Social', name];
  return null;
}

export function classifySource(referrer, utm, ownHosts) {
  utm = String(utm || '').slice(0, 40).replace(/[^A-Za-z0-9._ -]/g, '').toLowerCase();
  if (utm) return lookup(utm + '.com') || lookup(utm) || ['Altri siti', utm];
  let host = '';
  try { host = new URL(referrer).hostname.toLowerCase(); } catch { /* nessun referrer */ }
  host = host.replace(/^(www|m|l)\./, '');
  if (!host || ownHosts.includes(host)) return ['Diretto', 'Accesso diretto'];
  return lookup(host) || ['Altri siti', host.slice(0, 60)];
}

export function deviceFromUA(ua) {
  if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android|blackberry|opera mini/i.test(ua)) return 'mobile';
  return 'desktop';
}

/* ---------- Giorni nel fuso orario del sito ---------- */
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = ts => dayFmt.format(new Date(ts * 1000));
function addDays(key, n) { const d = new Date(key + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

function totals(rows) {
  const v = new Set(rows.map(r => r.vid));
  return { views: rows.length, visitors: v.size };
}

export function buildReport(rows, days, nowTs) {
  const today = dayKey(nowTs);
  let first;
  if (days > 0) first = addDays(today, -(days - 1));
  else first = rows.length ? dayKey(Math.min(...rows.map(r => r.ts))) : today;
  const span = [];
  for (let k = first; k <= today; k = addDays(k, 1)) span.push(k);
  const inSpan = new Set(span);
  const cur = [], prevRows = [];
  const prevSet = new Set();
  if (days > 0) for (let i = 1; i <= days; i++) prevSet.add(addDays(first, -i));
  for (const r of rows) {
    const k = dayKey(r.ts);
    r.day = k;
    if (inSpan.has(k)) cur.push(r); else if (prevSet.has(k)) prevRows.push(r);
  }

  const daily = new Map(span.map(k => [k, { views: 0, vs: new Set() }]));
  for (const r of cur) { const d = daily.get(r.day); d.views++; d.vs.add(r.vid); }

  const agg = (keyFn) => {
    const out = new Map();
    for (const r of cur) {
      const k = keyFn(r); if (k == null) continue;
      const kk = Array.isArray(k) ? k.join('|') : k;
      if (!out.has(kk)) out.set(kk, { key: k, views: 0, vs: new Set() });
      const o = out.get(kk); o.views++; o.vs.add(r.vid);
    }
    return [...out.values()].sort((a, b) => b.vs.size - a.vs.size || b.views - a.views);
  };
  const t = totals(cur);
  return {
    ok: true, days, from: first, to: today,
    totals: { ...t, per_visitor: t.visitors ? Math.round(t.views / t.visitors * 100) / 100 : 0 },
    previous: days > 0 ? totals(prevRows) : null,
    daily: [...daily].map(([date, d]) => ({ date, views: d.views, visitors: d.vs.size })),
    sources: agg(r => [r.ch || 'Diretto', r.ref || 'Accesso diretto']).slice(0, 15).map(x => ({ channel: x.key[0], name: x.key[1], views: x.views, visitors: x.vs.size })),
    channels: agg(r => r.ch || 'Diretto').map(x => ({ name: x.key, views: x.views, visitors: x.vs.size })),
    countries: agg(r => r.country || '??').slice(0, 15).map(x => ({ code: x.key, views: x.views, visitors: x.vs.size })),
    cities: agg(r => r.city ? [r.city, r.country || '??'] : null).slice(0, 10).map(x => ({ city: x.key[0], code: x.key[1], views: x.views, visitors: x.vs.size })),
    pages: agg(r => r.path).slice(0, 15).map(x => ({ path: x.key, views: x.views, visitors: x.vs.size })),
    devices: agg(r => r.dev || 'desktop').map(x => ({ name: x.key, views: x.views, visitors: x.vs.size }))
  };
}

/* ---------- HTTP ---------- */
function allowedOrigins(env) { return String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean); }

function corsHeaders(req, env) {
  const origin = (req.headers.get('Origin') || '').replace(/\/$/, '');
  const ok = origin && allowedOrigins(env).includes(origin);
  return ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : null;
}

const json = (data, status, extra) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);

    if (req.method === 'OPTIONS') return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });

    if (url.pathname === '/' ) return new Response('Contatore visite attivo.', { status: 200 });

    if (url.pathname === '/hit' && req.method === 'POST') {
      if (!cors) return new Response(null, { status: 403 });
      const ua = req.headers.get('User-Agent') || '';
      if (!ua || BOT.test(ua)) return new Response(null, { status: 204, headers: cors });
      let b; try { b = JSON.parse((await req.text()).slice(0, 2048)); } catch { return new Response(null, { status: 400, headers: cors }); }
      if (!b || !/^[a-f0-9]{24}$/.test(String(b.v || ''))) return new Response(null, { status: 400, headers: cors });
      let path = String(b.p || '/').replace(/\/index\.html$/, '/');
      if (!/^\/[A-Za-z0-9/_\-.~%]{0,119}$/.test(path)) path = '/';
      const own = allowedOrigins(env).map(o => { try { return new URL(o).hostname.replace(/^www\./, ''); } catch { return ''; } });
      const [ch, ref] = classifySource(String(b.r || ''), String(b.u || ''), own);
      const cf = req.cf || {};
      const country = /^[A-Z]{2}$/.test(cf.country || '') && !['XX', 'T1'].includes(cf.country) ? cf.country : '';
      await env.DB.prepare('INSERT INTO hits (ts, vid, path, ch, ref, country, city, dev) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(Math.floor(Date.now() / 1000), b.v, path, ch, ref, country, String(cf.city || '').slice(0, 60), deviceFromUA(ua)).run();
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === '/stats' && req.method === 'GET') {
      if (!cors) return json({ ok: false, error: 'Origine non autorizzata.' }, 403);
      const auth = req.headers.get('Authorization') || '';
      if (!env.ADMIN_KEY || !safeEqual(auth, 'Bearer ' + env.ADMIN_KEY)) return json({ ok: false, error: 'Chiave non valida.' }, 401, cors);
      const range = url.searchParams.get('range') || '30';
      const days = ['1', '7', '30', '90', '365'].includes(range) ? parseInt(range, 10) : (range === 'all' ? 0 : 30);
      const now = Math.floor(Date.now() / 1000);
      const since = days > 0 ? now - (days * 2 + 2) * 86400 : 0; // periodo + periodo precedente
      const { results } = await env.DB.prepare('SELECT ts, vid, path, ch, ref, country, city, dev FROM hits WHERE ts >= ?').bind(since).all();
      return json(buildReport(results || [], days, now), 200, cors);
    }

    return new Response('Not found', { status: 404 });
  }
};
