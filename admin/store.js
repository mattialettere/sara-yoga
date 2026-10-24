// Livello "dati" della dashboard per GitHub Pages (sito statico, nessun server).
//  - Accesso: email e password controllate nel browser (hash PBKDF2 in admin/auth.json).
//  - Pubblicazione: un unico commit sul repository GitHub con content.json, index.html e le foto nuove.
//  - Il token GitHub e la chiave del contatore restano SOLO in questo browser, cifrati con la password.
import { mergeContent, renderPage } from './render.js';

const GH_API = () => window.SS_GH_API || 'https://api.github.com';
const te = new TextEncoder(), td = new TextDecoder();
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const LS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignora */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignora */ } }
};
const SS = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignora */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch { /* ignora */ } }
};

/* ---------- Crittografia ---------- */
async function pbkdf2(password, salt, iterations) {
  const km = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, km, 256));
}
const vaultSalt = auth => new Uint8Array([...unb64(auth.salt), ...te.encode('|vault')]);
async function aesKey(raw) { return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']); }
async function encryptJson(rawKey, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(rawKey), te.encode(JSON.stringify(obj))));
  return { iv: b64(iv), ct: b64(ct) };
}
async function decryptJson(rawKey, blob) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, await aesKey(rawKey), unb64(blob.ct));
  return JSON.parse(td.decode(pt));
}
function safeEq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

/* ---------- Stato ---------- */
const state = { schema: null, defaultSizes: {}, sizes: {}, pending: {}, vaultKey: null, vault: null, email: null, auth: null, failures: 0 };

async function fetchJson(path) {
  const r = await fetch(path + (path.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
}

async function loadAuth() {
  const pub = await fetchJson('auth.json');
  let pend = null; try { pend = JSON.parse(LS.get('ss_auth_pending') || 'null'); } catch { /* ignora */ }
  if (pend) {
    if (pend.auth.hash === pub.hash || Date.now() - pend.ts > 86400000) LS.del('ss_auth_pending');
    else return pend.auth; // appena cambiata: la versione pubblica si aggiorna entro un paio di minuti
  }
  return pub;
}

async function loadVault() {
  state.vault = {};
  const blob = (() => { try { return JSON.parse(LS.get('ss_vault') || 'null'); } catch { return null; } })();
  if (blob && state.vaultKey) { try { state.vault = await decryptJson(state.vaultKey, blob); } catch { state.vault = {}; } }
}
async function saveVault() { LS.set('ss_vault', JSON.stringify(await encryptJson(state.vaultKey, state.vault))); }

/* ---------- Sessione ---------- */
async function session() {
  const s = (() => { try { return JSON.parse(SS.get('ss_sess') || 'null'); } catch { return null; } })();
  if (!s || !s.k) return { auth: false };
  try {
    state.auth = await loadAuth();
    state.vaultKey = unb64(s.k); state.email = s.email;
    await loadVault();
    return { auth: true, email: s.email, is_default: !!state.auth.is_default };
  } catch { return { auth: false }; }
}

async function login(email, password) {
  if (state.failures >= 3) await new Promise(r => setTimeout(r, Math.min(8000, 800 * state.failures)));
  let auth; try { auth = await loadAuth(); } catch { return { ok: false, error: 'Impossibile leggere i dati di accesso. Controlla la connessione.' }; }
  const hash = b64(await pbkdf2(password, unb64(auth.salt), auth.iterations));
  const ok = String(email).trim().toLowerCase() === String(auth.email).toLowerCase() && safeEq(hash, auth.hash);
  if (!ok) { state.failures++; return { ok: false, error: 'Email o password non corretti.' }; }
  state.failures = 0; state.auth = auth; state.email = auth.email;
  state.vaultKey = await pbkdf2(password, vaultSalt(auth), auth.iterations);
  SS.set('ss_sess', JSON.stringify({ email: auth.email, k: b64(state.vaultKey) }));
  LS.set('ss_nc', '1'); // le visite di chi amministra non vengono contate
  await loadVault();
  return { ok: true };
}

function logout() { SS.del('ss_sess'); state.vaultKey = null; state.vault = null; return { ok: true }; }

/* ---------- GitHub ---------- */
function ghCfg() { const g = state.vault && state.vault.gh; return g && g.token ? g : null; }

async function gh(path, opts = {}) {
  const g = ghCfg(); if (!g) throw Object.assign(new Error('GitHub non collegato'), { needsGithub: true });
  const r = await fetch(GH_API() + path, {
    method: opts.method || 'GET',
    headers: { Authorization: 'Bearer ' + g.token, Accept: opts.accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store'
  });
  if (opts.raw) return r;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.message || ('GitHub ' + r.status)), { status: r.status });
  return j;
}
const repoPath = () => { const g = ghCfg(); return `/repos/${g.owner}/${g.repo}`; };

function friendlyGhError(e) {
  if (e.needsGithub) return 'Per pubblicare serve collegare GitHub: apri «Collegamenti» nel menu.';
  if (e.status === 401) return 'GitHub non accetta il token (scaduto o sbagliato). Aggiornalo in «Collegamenti».';
  if (e.status === 403 || e.status === 404) return 'GitHub ha negato l\'accesso al repository. Controlla in «Collegamenti» nome del repository e permessi del token (Contents: lettura e scrittura).';
  if (e.status === 409 || e.status === 422) return 'Il sito è stato modificato nel frattempo da un\'altra parte. Ricarica la pagina e riprova.';
  return 'Pubblicazione non riuscita: ' + (e.message || 'errore sconosciuto') + '.';
}

async function readRepoFile(path, ref) {
  const g = ghCfg(); if (!g) throw Object.assign(new Error('GitHub non collegato'), { needsGithub: true });
  const r = await gh(`${repoPath()}/contents/${path}?ref=${encodeURIComponent(ref || g.branch)}`, { accept: 'application/vnd.github.raw+json', raw: true });
  if (r.status === 404) return null;
  if (!r.ok) throw Object.assign(new Error('GitHub ' + r.status), { status: r.status });
  return r.text();
}

async function commitFiles(files, message) {
  const g = ghCfg(); if (!g) throw Object.assign(new Error('GitHub non collegato'), { needsGithub: true });
  const ref = await gh(`${repoPath()}/git/ref/heads/${g.branch}`);
  const parent = await gh(`${repoPath()}/git/commits/${ref.object.sha}`);
  const tree = [];
  for (const f of files) {
    const blob = await gh(`${repoPath()}/git/blobs`, { method: 'POST', body: { content: f.base64 ?? b64(te.encode(f.text)), encoding: 'base64' } });
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const t = await gh(`${repoPath()}/git/trees`, { method: 'POST', body: { base_tree: parent.tree.sha, tree } });
  const c = await gh(`${repoPath()}/git/commits`, { method: 'POST', body: { message, tree: t.sha, parents: [ref.object.sha] } });
  await gh(`${repoPath()}/git/refs/heads/${g.branch}`, { method: 'PATCH', body: { sha: c.sha } });
  return c.sha;
}

/** Cerca di capire owner/repo dall'indirizzo su cui gira la dashboard. */
function detectRepo() {
  const host = location.hostname;
  if (!host.endsWith('.github.io')) return { owner: '', repo: '' };
  const owner = host.split('.')[0];
  const seg = location.pathname.split('/').filter(Boolean)[0];
  return { owner, repo: (seg && seg !== 'admin') ? seg : owner + '.github.io' };
}

async function connectGithub({ owner, repo, token, branch }) {
  owner = String(owner || '').trim(); repo = String(repo || '').trim(); token = String(token || '').trim();
  if (!owner || !repo || !token) return { ok: false, error: 'Compila nome utente, repository e token.' };
  const prev = state.vault.gh; state.vault.gh = { owner, repo, branch: branch || 'main', token };
  try {
    const info = await gh(`/repos/${owner}/${repo}`);
    if (info.permissions && !info.permissions.push) throw Object.assign(new Error('Il token non ha permesso di scrittura.'), { status: 403 });
    state.vault.gh.branch = (branch || '').trim() || info.default_branch || 'main';
    await saveVault();
    return { ok: true, repo: info.full_name, branch: state.vault.gh.branch };
  } catch (e) {
    state.vault.gh = prev;
    return { ok: false, error: e.status === 401 ? 'Token non valido.' : e.status === 404 ? 'Repository non trovato (o il token non lo vede). Controlla nome utente e repository.' : e.message };
  }
}
async function disconnectGithub() { delete state.vault.gh; await saveVault(); return { ok: true }; }
async function setStatsKey(key) { key = String(key || '').trim(); if (key) state.vault.stats = { key }; else delete state.vault.stats; await saveVault(); return { ok: true }; }

/* ---------- Contenuti ---------- */
async function loadSchema() {
  if (!state.schema) {
    state.schema = await fetchJson('schema.json');
    try { state.defaultSizes = await fetchJson('default-sizes.json'); } catch { state.defaultSizes = {}; }
  }
  return state.schema;
}

async function loadSaved() {
  if (ghCfg()) {
    try { const t = await readRepoFile('content.json'); return t ? JSON.parse(t) : {}; } catch (e) { if (e.status === 401) throw e; }
  }
  try { return await fetchJson('../content.json'); } catch { return {}; }
}

function withSizes(content) { return { ...content, _sizes: { ...state.sizes } }; }

async function loadContent() {
  const schema = await loadSchema();
  let saved = {}, warning = null;
  try { saved = await loadSaved(); } catch (e) { warning = friendlyGhError(e); }
  state.sizes = { ...(saved._sizes || {}) };
  return { ok: true, schema, content: mergeContent(schema, saved), backups: await backups(), github: !!ghCfg(), warning, stats_ready: !!(state.vault.stats && state.vault.stats.key) };
}

async function save(content) {
  const schema = await loadSchema();
  const clean = withSizes(mergeContent(schema, content));
  // tiene solo le dimensioni delle foto realmente usate
  const used = JSON.stringify(clean);
  for (const p of Object.keys(clean._sizes)) if (!used.includes('"' + p + '"')) delete clean._sizes[p];
  const html = renderPage(schema, clean, { defaultSizes: state.defaultSizes });
  const files = [{ path: 'content.json', text: JSON.stringify(clean, null, 2) + '\n' }, { path: 'index.html', text: html }];
  const newPaths = Object.keys(state.pending).filter(p => !state.pending[p].committed && used.includes('"' + p + '"'));
  for (const p of newPaths) files.push({ path: p, base64: state.pending[p].base64 });
  try {
    await commitFiles(files, 'Aggiornamento dal pannello di amministrazione');
  } catch (e) { return { ok: false, error: friendlyGhError(e), needsGithub: !!e.needsGithub }; }
  newPaths.forEach(p => { state.pending[p].committed = true; });
  const d = new Date();
  return { ok: true, content: mergeContent(schema, clean), backups: await backups(), saved_at: d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) };
}

async function backups() {
  if (!ghCfg()) return [];
  try {
    const g = ghCfg();
    const list = await gh(`${repoPath()}/commits?path=content.json&sha=${encodeURIComponent(g.branch)}&per_page=20`);
    return list.map(c => ({ id: c.sha, label: new Date(c.commit.author.date).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'medium' }) }));
  } catch { return []; }
}

async function restore(sha) {
  try {
    const t = await readRepoFile('content.json', sha);
    if (t == null) return { ok: false, error: 'Versione non trovata.' };
    const saved = JSON.parse(t);
    state.sizes = { ...state.sizes, ...(saved._sizes || {}) };
    return { ok: true, content: mergeContent(await loadSchema(), saved) };
  } catch (e) { return { ok: false, error: friendlyGhError(e) }; }
}

/* ---------- Foto ---------- */
async function upload(file) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) return { ok: false, error: 'Formato non supportato. Usa una foto JPG, PNG o WEBP.' };
  if (file.size > 30 * 1024 * 1024) return { ok: false, error: 'La foto è troppo grande (massimo 30 MB).' };
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { return { ok: false, error: 'Impossibile leggere la foto. Prova con un\'altra.' }; }
  const max = 1800, r = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * r), h = Math.round(bmp.height * r);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const png = file.type === 'image/png';
  if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(bmp, 0, 0, w, h);
  const blob = await new Promise(res => cv.toBlob(res, png ? 'image/png' : 'image/jpeg', 0.85));
  if (!blob) return { ok: false, error: 'Impossibile elaborare la foto.' };
  const d = new Date(), pad = n => String(n).padStart(2, '0');
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(3)), x => x.toString(16).padStart(2, '0')).join('');
  const path = `assets/uploads/foto-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${rnd}.${png ? 'png' : 'jpg'}`;
  const base64 = b64(new Uint8Array(await blob.arrayBuffer()));
  state.pending[path] = { base64, url: URL.createObjectURL(blob), committed: false };
  state.sizes[path] = [w, h];
  return { ok: true, path, width: w, height: h };
}

/** Indirizzo da usare per mostrare una foto nella dashboard (foto appena caricate incluse). */
function imgUrl(path) { return state.pending[path] ? state.pending[path].url : '../' + path; }

/* ---------- Account ---------- */
async function changeCredentials({ current, new: next, email }) {
  const auth = state.auth;
  const hash = b64(await pbkdf2(current || '', unb64(auth.salt), auth.iterations));
  if (!safeEq(hash, auth.hash)) return { ok: false, error: 'La password attuale non è corretta.' };
  email = String(email || auth.email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Inserisci un\'email valida.' };
  if (next && next.length < 8) return { ok: false, error: 'La nuova password deve avere almeno 8 caratteri.' };
  if (!ghCfg()) return { ok: false, error: 'Per cambiare i dati di accesso serve prima collegare GitHub (menu «Collegamenti»).' };
  const password = next || current;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const na = { email, salt: b64(salt), hash: b64(await pbkdf2(password, salt, auth.iterations)), iterations: auth.iterations };
  const newKey = await pbkdf2(password, vaultSalt(na), na.iterations);
  try { await commitFiles([{ path: 'admin/auth.json', text: JSON.stringify(na, null, 1) }], 'Aggiornamento dati di accesso'); }
  catch (e) { return { ok: false, error: friendlyGhError(e) }; }
  state.auth = na; state.email = email; state.vaultKey = newKey;
  await saveVault();
  SS.set('ss_sess', JSON.stringify({ email, k: b64(newKey) }));
  LS.set('ss_auth_pending', JSON.stringify({ auth: na, ts: Date.now() }));
  return { ok: true, email };
}

/* ---------- Statistiche (Cloudflare Worker) ---------- */
async function stats(range, statsUrl) {
  const key = state.vault.stats && state.vault.stats.key;
  const base = String(statsUrl || '').replace(/\/+$/, '');
  if (!base || !key) return { ok: false, notConfigured: true };
  try {
    const r = await fetch(base + '/stats?range=' + encodeURIComponent(range), { headers: { Authorization: 'Bearer ' + key }, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: r.status === 401 ? 'La chiave del contatore non è corretta. Controlla «Collegamenti».' : (j.error || 'Errore del contatore (' + r.status + ').') };
    return j;
  } catch { return { ok: false, error: 'Contatore non raggiungibile. Controlla l\'indirizzo in «Contatti e informazioni».' }; }
}

/* ---------- Interfaccia usata da admin.js ---------- */
const Store = {
  detectRepo, imgUrl, connectGithub, disconnectGithub, setStatsKey,
  vaultInfo() { const g = ghCfg(); return { gh: g ? { owner: g.owner, repo: g.repo, branch: g.branch } : null, statsKey: !!(state.vault && state.vault.stats && state.vault.stats.key) }; },
  async call(action, o = {}) {
    try {
      switch (action) {
        case 'session': return await session();
        case 'login': return await login(o.body.email, o.body.password);
        case 'logout': return logout();
        case 'content': return await loadContent();
        case 'save': return await save(o.body.content);
        case 'upload': return await upload(o.form.get('file'));
        case 'password': return await changeCredentials(o.body);
        case 'restore': return await restore(o.body.id);
        case 'stats': return await stats(o.query.range, o.statsUrl);
        default: return { ok: false, error: 'Azione sconosciuta.' };
      }
    } catch (e) { return { ok: false, error: friendlyGhError(e) }; }
  }
};
window.Store = Store;

// Avvia la dashboard solo dopo che questo modulo è pronto
const s = document.createElement('script'); s.src = 'admin.js'; document.body.appendChild(s);
