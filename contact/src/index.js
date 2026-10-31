// Modulo di contatto per il sito su GitHub Pages — Cloudflare Worker + Resend.
//   POST /send   riceve nome, cognome, email e messaggio e li invia per mail (via Resend)
// La mail arriva a TO_EMAIL (info@sarashanti.com, inoltrata a Gmail da Cloudflare Email Routing)
// e ha come «Rispondi a» l'indirizzo del visitatore: basta premere Rispondi in Gmail.

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const oneLine = (s, max) => String(s ?? '').replace(/[\u0000-\u001F\u007F\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
}

function corsHeaders(req, env) {
  const origin = (req.headers.get('Origin') || '').replace(/\/$/, '');
  if (!origin || !allowedOrigins(env).includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

const json = (data, status, extra) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra }
});

/** Controlla e pulisce i dati del modulo. Restituisce { ok, data } oppure { ok:false, error }. */
export function validate(b) {
  if (!b || typeof b !== 'object') return { ok: false, error: 'Richiesta non valida.' };
  const first = oneLine(b.first, 60);
  const last = oneLine(b.last, 60);
  const email = oneLine(b.email, 120);
  const message = String(b.message ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, 3000);
  if (!first || !last) return { ok: false, error: 'Nome e cognome obbligatori.' };
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Email non valida.' };
  if (message.length < 2) return { ok: false, error: 'Messaggio mancante.' };
  return { ok: true, data: { first, last, email, message } };
}

export function buildEmail({ first, last, email, message }, env) {
  const name = `${first} ${last}`;
  const text = `New message from the website\n\nName: ${name}\nEmail: ${email}\n\n${message}\n`;
  const html = `<p><strong>New message from the website</strong></p>
<p><strong>Name:</strong> ${esc(name)}<br><strong>Email:</strong> <a href="mailto:${esc(email)}">${esc(email)}</a></p>
<p style="white-space:pre-wrap">${esc(message)}</p>
<p style="color:#888;font-size:12px">Press Reply to answer ${esc(name)} directly.</p>`;
  return {
    from: env.FROM_EMAIL,
    to: [env.TO_EMAIL],
    reply_to: email,
    subject: `Website message from ${name}`,
    text,
    html
  };
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(req, env);

    if (req.method === 'OPTIONS') return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });
    if (url.pathname === '/') return new Response('Modulo di contatto attivo.', { status: 200 });
    if (url.pathname !== '/send' || req.method !== 'POST') return new Response('Not found', { status: 404 });

    if (!cors) return json({ ok: false, error: 'Origine non autorizzata.' }, 403);
    if (!env.RESEND_API_KEY || !env.TO_EMAIL || !env.FROM_EMAIL) return json({ ok: false, error: 'Servizio non configurato.' }, 500, cors);

    let body;
    try { body = JSON.parse((await req.text()).slice(0, 8192)); } catch { return json({ ok: false, error: 'Richiesta non valida.' }, 400, cors); }

    // Anti-spam: campo trappola (honeypot) compilato o invio troppo veloce → finto successo, nessuna mail.
    const tooFast = Number(body && body.t) > 0 && Number(body.t) < 2500;
    if (body && (String(body.website || '') !== '' || tooFast)) return json({ ok: true }, 200, cors);

    const v = validate(body);
    if (!v.ok) return json({ ok: false, error: v.error }, 400, cors);

    let res;
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildEmail(v.data, env))
      });
    } catch {
      return json({ ok: false, error: 'Invio non riuscito.' }, 502, cors);
    }
    if (!res.ok) {
      console.error('Resend error', res.status, (await res.text()).slice(0, 300));
      return json({ ok: false, error: 'Invio non riuscito.' }, 502, cors);
    }
    return json({ ok: true }, 200, cors);
  }
};
