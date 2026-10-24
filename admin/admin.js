(function () {
'use strict';

/* ---------------- Utilità ---------------- */
var app = document.getElementById('app');
var S = { github: false, statsReady: false, csrf: '', email: '', isDefault: false, schema: [], content: {}, snapshot: '', backups: [], view: 'stats', range: '30', stats: null, statsView: 'chart', menuOpen: false };

var ICONS = {
  mail: '<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
  home: '<path d="m4 11 8-7 8 7"/><path d="M6 10v10h12V10"/>',
  text: '<path d="M5 6h14M5 11h14M5 16h9"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>',
  leaf: '<path d="M5 19C5 9 11 5 19 5c0 8-4 14-12 14"/><path d="M5 19c3-5 6-8 10-10"/>',
  image: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m4 17 5-4 4 3 3-2 4 3"/>',
  quote: '<path d="M7 17c-2 0-3-1-3-3 0-3 2-6 5-7M16 17c-2 0-3-1-3-3 0-3 2-6 5-7"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  tag: '<path d="M4 12V5h7l9 9-7 7z"/><circle cx="8.5" cy="8.5" r="1"/>',
  help: '<circle cx="12" cy="12" r="8"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
  book: '<path d="M5 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H5zM19 5h-6"/><path d="M19 5v13h-6"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="m8 15 4-5 3 3 5-7"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l3 3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="m6 14 6-6 6 6"/>',
  down: '<path d="m6 10 6 6 6-6"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  upload: '<path d="M12 16V4m0 0-4 4m4-4 4 4M5 20h14"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  undo: '<path d="M9 7 4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12"/>',
  out: '<path d="M10 5H5v14h5M15 8l4 4-4 4M19 12H9"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'
};
function icon(n) { var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'i'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = ICONS[n] || ''; return s; }

function el(tag, attrs) {
  var e = document.createElement(tag);
  if (attrs) for (var k in attrs) {
    var v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
  return e;
}
function add(parent, c) {
  if (c == null || c === false) return;
  if (Array.isArray(c)) c.forEach(function (x) { add(parent, x); });
  else parent.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function fmt(n) { return Number(n || 0).toLocaleString('it-IT'); }

function api(action, opts) {
  opts = opts || {};
  if (action === 'stats') opts.statsUrl = S.content.stats_url;
  return window.Store.call(action, opts);
}

var toastTimer;
function toast(msg, err) {
  var t = document.getElementById('toast');
  if (!t) { t = el('div', { id: 'toast', class: 'toast', role: 'status' }); document.body.appendChild(t); }
  t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.className = 'toast' + (err ? ' err' : ''); }, 3600);
}

function confirmBox(title, text, okLabel, danger) {
  return new Promise(function (res) {
    var d = el('dialog', null, el('h3', { text: title }), el('p', { text: text, style: 'color:var(--muted);margin:0' }),
      el('div', { class: 'acts' },
        el('button', { class: 'btn', text: 'Annulla', onclick: function () { d.close(); res(false); } }),
        el('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), text: okLabel, onclick: function () { d.close(); res(true); } })));
    d.addEventListener('close', function () { d.remove(); res(false); });
    document.body.appendChild(d); d.showModal();
  });
}

/* ---------------- Avvio e login ---------------- */
function boot() {
  api('session').then(function (s) {
    if (!s.auth) return renderLogin();
    S.email = s.email; S.isDefault = s.is_default;
    return loadContent().then(function () { renderShell(); });
  }).catch(function () { app.innerHTML = ''; app.appendChild(el('p', { class: 'boot', text: 'Qualcosa è andato storto nel caricamento. Ricarica la pagina.' })); });
}

function loadContent() {
  return api('content').then(function (r) {
    if (!r.ok) return;
    S.schema = r.schema; S.content = r.content; S.backups = r.backups; S.snapshot = JSON.stringify(r.content); S.github = r.github; S.statsReady = r.stats_ready;
    if (r.warning) setTimeout(function () { toast(r.warning, true); }, 400);
  });
}

function renderLogin() {
  var err = el('div', { class: 'msg-error', role: 'alert', style: 'display:none' });
  var email = el('input', { type: 'email', id: 'em', autocomplete: 'username', required: true, autofocus: true });
  var pass = el('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true });
  var showBtn = el('button', { type: 'button', text: 'Mostra', onclick: function () { var h = pass.type === 'password'; pass.type = h ? 'text' : 'password'; showBtn.textContent = h ? 'Nascondi' : 'Mostra'; } });
  var go = el('button', { class: 'btn primary', type: 'submit', text: 'Entra', style: 'width:100%' });
  var form = el('form', { class: 'login-form', onsubmit: function (e) {
    e.preventDefault(); err.style.display = 'none'; go.disabled = true; go.textContent = 'Accesso in corso…';
    api('login', { body: { email: email.value, password: pass.value } }).then(function (r) {
      if (r.ok) { boot(); return; }
      go.disabled = false; go.textContent = 'Entra'; err.textContent = r.error; err.style.display = 'block'; pass.select();
    });
  } },
    el('h1', { text: 'Area amministratore' }),
    el('p', { class: 'lead', text: 'Accedi per modificare testi e foto del sito e vedere le visite.' }),
    err,
    el('div', { class: 'field' }, el('label', { for: 'em', text: 'Email' }), email),
    el('div', { class: 'field' }, el('label', { for: 'pw', text: 'Password' }), el('div', { class: 'pw' }, pass, showBtn)),
    go,
    el('p', { style: 'margin-top:20px;font-size:13px' }, el('a', { href: '../', class: 'link-view', text: '← Torna al sito' })));
  app.innerHTML = '';
  app.appendChild(el('div', { class: 'login' }, el('div', { class: 'login-art' }, el('p', { text: 'Il tuo sito, sempre aggiornato, senza toccare il codice.' })), el('div', { class: 'login-box' }, form)));
}

/* ---------------- Struttura ---------------- */
var ANCHORS = { settings: '', header: '', hero: '#top', intro: '#top', about: '#about', practice: '#classes', gallery: '#gallery', quote: '#quote', schedule: '#location', pricing: '#pricing', faq: '#faq', journal: '#journal', booking: '#book' };

function isDirty() { return JSON.stringify(S.content) !== S.snapshot; }
function sectionDirty(sec) {
  var a = JSON.parse(S.snapshot);
  return sec.fields.some(function (f) { return f.type !== 'divider' && JSON.stringify(a[f.key]) !== JSON.stringify(S.content[f.key]); });
}

function renderShell() {
  app.innerHTML = '';
  var side = el('aside', { class: 'side' + (S.menuOpen ? ' open' : ''), id: 'side', 'aria-label': 'Menu' });
  side.appendChild(el('div', { class: 'side-brand' }, el('div', { class: 'mark', 'aria-hidden': 'true', text: 'ॐ' }), el('div', null, el('strong', { text: 'Sara Shanti' }), el('small', { text: 'Area amministratore' }))));
  var nav = el('nav', { class: 'nav' });
  function item(id, label, ic) {
    var dirty = id !== 'stats' && id !== 'account' && id !== 'links' && S.schema.some(function (s) { return s.id === id && sectionDirty(s); });
    return el('button', { 'aria-current': S.view === id ? 'page' : null, onclick: function () { go(id); } }, icon(ic), label, dirty ? el('span', { class: 'dot', title: 'Modifiche non salvate' }) : null);
  }
  nav.appendChild(el('div', { class: 'nav-group', text: 'VISITE' }));
  nav.appendChild(item('stats', 'Statistiche', 'chart'));
  nav.appendChild(el('div', { class: 'nav-group', text: 'MODIFICA IL SITO' }));
  S.schema.forEach(function (s) { nav.appendChild(item(s.id, s.title, s.icon)); });
  nav.appendChild(el('div', { class: 'nav-group', text: 'IMPOSTAZIONI' }));
  nav.appendChild(item('links', 'Collegamenti', 'link'));
  nav.appendChild(item('account', 'Account e versioni', 'key'));
  side.appendChild(nav);
  side.appendChild(el('div', { class: 'side-foot' }, el('div', { text: S.email }),
    el('div', { class: 'row' }, el('a', { href: '../', target: '_blank', rel: 'noopener', text: 'Vedi il sito' }),
      el('button', { text: 'Esci', onclick: logout }))));

  var topbar = el('div', { class: 'topbar-m' }, el('button', { onclick: function () { S.menuOpen = !S.menuOpen; side.classList.toggle('open', S.menuOpen); } }, icon('menu'), 'Menu'), el('strong', { text: 'Area amministratore' }));
  var main = el('main', { class: 'main', id: 'main' });
  var bar = el('div', { class: 'savebar', id: 'savebar' }, el('span', { text: 'Hai modifiche non pubblicate' }),
    el('button', { class: 'btn', text: 'Annulla modifiche', onclick: discard }),
    el('button', { class: 'btn primary', id: 'savebtn', text: 'Pubblica modifiche', onclick: save }));
  app.appendChild(el('div', { class: 'shell' }, side, el('div', null, topbar, main)));
  document.body.appendChild(bar);
  var old = document.querySelectorAll('.savebar'); if (old.length > 1) old[0].remove();
  renderView();
}

function go(id) {
  S.view = id; S.menuOpen = false;
  if (id === 'stats') S.stats = null;
  renderShellKeepSave(); window.scrollTo(0, 0);
}
function renderShellKeepSave() {
  var bar = document.getElementById('savebar'); if (bar) bar.remove();
  renderShell(); updateBar();
}
function updateBar() {
  var b = document.getElementById('savebar'); if (b) b.classList.toggle('show', isDirty());
  document.querySelectorAll('.nav button').forEach(function (btn) { /* i puntini si aggiornano al prossimo cambio sezione */ });
}
function renderView() {
  var main = document.getElementById('main'); main.innerHTML = '';
  if (S.view === 'stats') return renderStats(main);
  if (S.view === 'account') return renderAccount(main);
  if (S.view === 'links') return renderLinks(main);
  var sec = S.schema.filter(function (s) { return s.id === S.view; })[0];
  if (sec) renderSection(main, sec);
}
function logout() {
  if (isDirty() && !confirm('Ci sono modifiche non salvate. Uscire comunque?')) return;
  api('logout', { body: {} }).then(function () { var b = document.getElementById('savebar'); if (b) b.remove(); boot(); });
}
window.addEventListener('beforeunload', function (e) { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

function changed() { updateBar(); }

/* ---------------- Salvataggio ---------------- */
function save() {
  var btn = document.getElementById('savebtn'); btn.disabled = true; btn.textContent = 'Pubblicazione…';
  api('save', { body: { content: S.content } }).then(function (r) {
    btn.disabled = false; btn.textContent = 'Pubblica modifiche';
    if (!r.ok) { toast(r.error, true); if (r.needsGithub) setTimeout(function () { go('links'); }, 1200); return; }
    S.content = r.content; S.snapshot = JSON.stringify(r.content); S.backups = r.backups;
    toast('Pubblicato alle ' + r.saved_at + '. Il sito si aggiorna entro 1-2 minuti.');
    renderShellKeepSave();
  });
}
function discard() {
  confirmBox('Annullare le modifiche?', 'I testi e le foto torneranno come erano all\'ultimo salvataggio.', 'Sì, annulla', true).then(function (ok) {
    if (!ok) return; S.content = JSON.parse(S.snapshot); renderShellKeepSave(); toast('Modifiche annullate.');
  });
}

/* ---------------- Editor delle sezioni ---------------- */
function renderSection(main, sec) {
  var inner = el('div', { class: 'main-inner' });
  var anchor = ANCHORS[sec.id];
  inner.appendChild(el('div', { class: 'page-head' }, el('div', null, el('h1', { text: sec.title }), el('p', { text: sec.help })),
    el('a', { class: 'btn', href: '../' + (anchor || ''), target: '_blank', rel: 'noopener' }, icon('eye'), 'Vedi sul sito')));
  if (S.isDefault) inner.appendChild(defaultBanner());
  var panel = el('div', { class: 'panel' });
  sec.fields.forEach(function (f) { panel.appendChild(renderField(f, S.content, f.key)); });
  inner.appendChild(panel);
  inner.appendChild(el('div', { class: 'section-foot' }, el('button', { class: 'btn small ghost', onclick: function () {
    confirmBox('Ripristinare i testi originali?', 'Tutti i testi e le foto di «' + sec.title + '» torneranno a quelli del sito originale. Potrai ancora annullare prima di salvare.', 'Ripristina', true).then(function (ok) {
      if (!ok) return;
      sec.fields.forEach(function (f) { if (f.type !== 'divider') S.content[f.key] = clone(f.default !== undefined ? f.default : (f.type === 'list' ? [] : '')); });
      changed(); renderShellKeepSave(); toast('Testi originali ripristinati. Ricorda di pubblicare.');
    });
  } }, icon('undo'), 'Ripristina i testi originali di questa sezione'), el('span', { text: 'Le modifiche si vedono sul sito solo dopo aver premuto «Pubblica modifiche».' })));
  main.appendChild(inner);
}

function defaultBanner() {
  return el('div', { class: 'banner' }, icon('key'), el('div', null, el('strong', { text: 'Stai usando la password di prova' }), 'Prima di pubblicare il sito, scegli una email e una password tue.'),
    el('button', { class: 'btn small', text: 'Cambia ora', onclick: function () { go('account'); } }));
}

var uid = 0;
function renderField(f, obj, key, extra) {
  extra = extra || {};
  if (f.type === 'divider') return el('div', { class: 'divider', text: f.label });
  var id = 'f' + (++uid);
  var wrap = el('div', { class: 'field' });
  var help = f.help ? el('span', { class: 'help', id: id + 'h', text: f.help }) : null;
  function lbl(text) { return el('label', { class: 'lbl', for: id, text: text || f.label }); }
  var val = obj[key];

  switch (f.type) {
    case 'text': case 'email': case 'url': case 'time': {
      var inp = el('input', { type: f.type === 'text' ? 'text' : f.type, id: id, value: val || '', maxlength: f.max || null, 'aria-describedby': help ? id + 'h' : null, placeholder: f.type === 'url' ? 'https://' : null });
      inp.addEventListener('input', function () { obj[key] = inp.value; if (extra.onInput) extra.onInput(); changed(); });
      wrap.append(lbl(), inp);
      break;
    }
    case 'textarea': case 'paragraphs': {
      var ta = el('textarea', { id: id, rows: f.rows || 4, 'aria-describedby': help ? id + 'h' : null });
      ta.value = val || '';
      ta.addEventListener('input', function () { obj[key] = ta.value; if (extra.onInput) extra.onInput(); changed(); });
      wrap.append(lbl(), ta);
      break;
    }
    case 'title': {
      var tt = el('textarea', { id: id, rows: f.rows || 2, style: 'min-height:0', 'aria-describedby': help ? id + 'h' : null });
      tt.value = val || '';
      var pv = el('div', { class: 'preview' });
      function paint() { pv.innerHTML = ''; pv.appendChild(el('small', { text: 'Anteprima' })); pv.appendChild(markup(tt.value)); }
      tt.addEventListener('input', function () { obj[key] = tt.value; paint(); if (extra.onInput) extra.onInput(); changed(); });
      var italic = el('button', { type: 'button', class: 'chip', onclick: function () {
        var s = tt.selectionStart, e = tt.selectionEnd, v = tt.value;
        if (s === e) { toast('Prima seleziona le parole da mettere in corsivo.', true); tt.focus(); return; }
        var sel = v.slice(s, e), wrapped = /^\*[^*]+\*$/.test(sel);
        var repl = wrapped ? sel.slice(1, -1) : '*' + sel + '*';
        tt.value = v.slice(0, s) + repl + v.slice(e); tt.focus(); tt.setSelectionRange(s, s + repl.length);
        tt.dispatchEvent(new Event('input'));
      } }, el('em', { text: 'Corsivo' }));
      if (f.help && f.help.indexOf('Corsivo') !== -1) wrap.append(el('div', { class: 'tb' }, lbl(), italic));
      else wrap.append(lbl());
      wrap.append(tt, pv); paint();
      break;
    }
    case 'select': {
      var sel = el('select', { id: id }, f.options.map(function (o) { return el('option', { value: o.value, text: o.label }); }));
      sel.value = val || f.default || f.options[0].value;
      sel.addEventListener('change', function () { obj[key] = sel.value; changed(); });
      wrap.append(lbl(), sel);
      break;
    }
    case 'image': wrap.append(imageField(f, obj, key, id, extra)); help = null; if (f.help) wrap.lastChild.appendChild(el('span', { class: 'help img-note', text: f.help })); break;
    case 'list': wrap.append(listField(f, obj, key)); break;
  }
  if (help) wrap.append(help);
  return wrap;
}

function markup(s) {
  var d = document.createElement('div');
  String(s).split('\n').forEach(function (line, i) {
    if (i) d.appendChild(document.createElement('br'));
    var parts = line.split(/\*([^*]+)\*/);
    parts.forEach(function (p, j) { if (!p) return; if (j % 2) d.appendChild(el('em', { text: p })); else d.appendChild(document.createTextNode(p)); });
  });
  return d;
}

/* ---- Immagini ---- */
function imageField(f, obj, key, id, extra) {
  var box = el('div', { class: 'img-field' });
  var drop = el('div', { class: 'img-drop', role: 'img', 'aria-label': 'Anteprima della foto' }, el('div', { class: 'busy', text: 'Caricamento…' }));
  var fileIn = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'sr', id: id, tabindex: '-1' });
  var side = el('div');
  var reset;
  function paint() {
    drop.style.backgroundImage = obj[key] ? 'url("' + window.Store.imgUrl(obj[key]) + '")' : 'none';
    if (reset) reset.style.display = (f.default && obj[key] !== f.default) ? '' : 'none';
  }
  function upload(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('Usa una foto JPG, PNG o WEBP.', true);
    drop.classList.add('loading');
    var fd = new FormData(); fd.append('file', file);
    api('upload', { form: fd }).then(function (r) {
      drop.classList.remove('loading');
      if (!r.ok) return toast(r.error, true);
      obj[key] = r.path; paint(); if (extra.onInput) extra.onInput(); changed(); toast('Foto caricata. Premi «Pubblica modifiche» per metterla online.');
    });
  }
  fileIn.addEventListener('change', function () { upload(fileIn.files[0]); fileIn.value = ''; });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { upload(e.dataTransfer.files[0]); });
  reset = el('button', { type: 'button', class: 'btn small ghost', onclick: function () { obj[key] = f.default; paint(); if (extra.onInput) extra.onInput(); changed(); } }, icon('undo'), 'Foto originale');
  var pick = el('button', { type: 'button', class: 'btn small', onclick: function () { fileIn.click(); } }, icon('upload'), obj[key] ? 'Cambia foto' : 'Scegli una foto');
  side.append(el('label', { class: 'lbl', for: id, text: f.label }), el('div', { class: 'img-actions' }, pick, reset), fileIn,
    el('span', { class: 'help', text: 'Puoi anche trascinare una foto sull\'anteprima. Le foto grandi vengono ridimensionate in automatico.' }));
  box.append(drop, side);
  paint();
  return box;
}

/* ---- Liste ---- */
function listField(f, obj, key) {
  var wrap = el('div');
  var listEl = el('div', { class: 'list' });
  var max = f.max_items || 40;
  var addBtn;
  function itemTitle(it, i) {
    var t = (f.title_key && it[f.title_key]) ? String(it[f.title_key]).replace(/\*/g, '') : '';
    return t || ('Nuova ' + f.item_label.toLowerCase());
  }
  function paint() {
    listEl.innerHTML = '';
    var arr = obj[key];
    if (!arr.length) listEl.appendChild(el('div', { class: 'empty-list', text: 'Nessun elemento. Usa il pulsante qui sotto per aggiungerne uno.' }));
    if (f.inline && arr.length) listEl.appendChild(el('div', { class: 'row-head' }, f.fields.map(function (sf) { return el('span', { text: sf.label }); }), el('span')));
    arr.forEach(function (it, i) {
      listEl.appendChild(f.inline ? inlineRow(it, i) : card(it, i));
    });
    if (addBtn) addBtn.style.display = arr.length >= max ? 'none' : '';
  }
  function ctl(i, arr) {
    function mv(d) { return function (e) { e.preventDefault(); e.stopPropagation(); var j = i + d; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; paint(); changed(); }; }
    return el('div', { class: 'ctl' },
      el('button', { type: 'button', class: 'icon-btn', title: 'Sposta su', 'aria-label': 'Sposta su', disabled: i === 0, onclick: mv(-1) }, icon('up')),
      el('button', { type: 'button', class: 'icon-btn', title: 'Sposta giù', 'aria-label': 'Sposta giù', disabled: i === arr.length - 1, onclick: mv(1) }, icon('down')),
      el('button', { type: 'button', class: 'icon-btn', title: 'Elimina', 'aria-label': 'Elimina', onclick: function (e) {
        e.preventDefault(); e.stopPropagation();
        confirmBox('Eliminare questo elemento?', '«' + itemTitle(arr[i], i) + '» sparirà dal sito dopo il salvataggio. Finché non salvi puoi annullare.', 'Elimina', true).then(function (ok) { if (ok) { arr.splice(i, 1); paint(); changed(); } });
      } }, icon('trash')));
  }
  function inlineRow(it, i) {
    var arr = obj[key];
    var row = el('div', { class: 'row-inline' });
    f.fields.forEach(function (sf) {
      var inp = el('input', { type: 'text', value: it[sf.key] || '', maxlength: sf.max || null, 'aria-label': sf.label });
      inp.addEventListener('input', function () { it[sf.key] = inp.value; changed(); });
      row.appendChild(inp);
    });
    row.appendChild(ctl(i, arr));
    return row;
  }
  function card(it, i) {
    var arr = obj[key];
    var ttl = el('span', { class: 'ttl' });
    var imgField = f.fields.filter(function (x) { return x.type === 'image'; })[0];
    var thumb = imgField ? el('span', { class: 'thumb' }) : null;
    function head() {
      ttl.innerHTML = ''; ttl.append(el('small', { text: f.item_label + ' ' + (i + 1) + (f.title_key ? ' ·' : '') }), f.title_key ? itemTitle(it, i) : '');
      if (thumb) thumb.style.backgroundImage = it[imgField.key] ? 'url("' + window.Store.imgUrl(it[imgField.key]) + '")' : 'none';
    }
    var body = el('div', { class: 'item-body' });
    f.fields.forEach(function (sf) { body.appendChild(renderField(sf, it, sf.key, { onInput: head })); });
    head();
    var d = el('details', { class: 'item' }, el('summary', null, el('span', { class: 'chev' }, icon('chev')), thumb, ttl, ctl(i, arr)), body);
    if (arr.length === 1 || it.__open) d.open = true;
    return d;
  }
  addBtn = el('button', { type: 'button', class: 'btn add', onclick: function () {
    var item = {}; f.fields.forEach(function (sf) { if (sf.type === 'list') item[sf.key] = []; else item[sf.key] = (sf.default !== undefined ? sf.default : ''); });
    if (f.key === 'dates_list' && obj[key].length) { var last = obj[key][obj[key].length - 1]; item.dow = last.dow; item.time = last.time; }
    obj[key].push(item); paint(); changed();
    var all = listEl.querySelectorAll(':scope > details'); var d = all[all.length - 1]; if (d) { d.open = true; d.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    var inputs = listEl.querySelectorAll('input[type=text]'); if (f.inline && inputs.length) inputs[inputs.length - 2].focus();
  } }, icon('plus'), f.add_label || 'Aggiungi');
  wrap.append(el('span', { class: 'lbl', text: f.label }), listEl, addBtn);
  paint();
  return wrap;
}

/* ---------------- Account e backup ---------------- */
function renderAccount(main) {
  var inner = el('div', { class: 'main-inner' });
  inner.appendChild(el('div', { class: 'page-head' }, el('div', null, el('h1', { text: 'Account e versioni' }), el('p', { text: 'Cambia i dati di accesso e recupera una versione precedente del sito.' }))));
  if (S.isDefault) inner.appendChild(defaultBanner());

  var em = el('input', { type: 'email', id: 'ae', value: S.email, autocomplete: 'username' });
  var cur = el('input', { type: 'password', id: 'ac', autocomplete: 'current-password' });
  var nw = el('input', { type: 'password', id: 'an', autocomplete: 'new-password', placeholder: 'Lascia vuoto per non cambiarla' });
  var msg = el('div', { class: 'msg-error', style: 'display:none', role: 'alert' });
  inner.appendChild(el('form', { class: 'panel', onsubmit: function (e) {
    e.preventDefault(); msg.style.display = 'none';
    api('password', { body: { current: cur.value, new: nw.value, email: em.value } }).then(function (r) {
      if (!r.ok) { msg.textContent = r.error; msg.style.display = 'block'; return; }
      S.email = r.email; S.isDefault = false; cur.value = ''; nw.value = ''; toast('Dati di accesso aggiornati. Sugli altri dispositivi valgono entro 1-2 minuti.'); renderShellKeepSave();
    });
  } },
    el('div', { class: 'divider', text: 'Dati di accesso' }), msg,
    el('div', { class: 'field' }, el('label', { class: 'lbl', for: 'ae', text: 'Email di accesso' }), em),
    el('div', { class: 'field' }, el('label', { class: 'lbl', for: 'ac', text: 'Password attuale' }), cur),
    el('div', { class: 'field' }, el('label', { class: 'lbl', for: 'an', text: 'Nuova password' }), nw, el('span', { class: 'help', text: 'Almeno 8 caratteri.' })),
    el('button', { class: 'btn primary', type: 'submit', text: 'Salva i dati di accesso' })));

  var list = el('div', { class: 'backup-list' });
  if (!S.backups.length) list.appendChild(el('p', { class: 'help', text: S.github ? 'Le versioni precedenti compaiono qui dopo la prima pubblicazione.' : 'Collega GitHub (menu «Collegamenti») per vedere le versioni precedenti.' }));
  S.backups.forEach(function (b) {
    list.appendChild(el('div', null, el('span', null, icon('clock'), ' ' + b.label), el('button', { class: 'btn small', text: 'Carica', onclick: function () {
      if (isDirty()) return toast('Salva o annulla prima le modifiche in corso.', true);
      confirmBox('Tornare a questa versione?', 'Verranno caricati i testi e le foto del ' + b.label + '. Non cambia nulla sul sito finché non premi «Pubblica modifiche».', 'Carica questa versione').then(function (ok) {
        if (!ok) return;
        api('restore', { body: { id: b.id } }).then(function (r) { if (!r.ok) return toast(r.error, true); S.content = r.content; toast('Versione caricata. Premi «Pubblica modifiche» per metterla online.'); go('hero'); });
      });
    } })));
  });
  inner.appendChild(el('div', { class: 'panel' }, el('div', { class: 'divider', text: 'Versioni precedenti' }), el('p', { class: 'help', style: 'margin-top:-6px;margin-bottom:10px', text: 'Ogni pubblicazione resta salvata nella cronologia di GitHub: qui vedi le ultime 20. Caricare una versione non la pubblica subito.' }), list));
  main.appendChild(inner);
}

/* ---------------- Statistiche ---------------- */
var RANGES = [['1', 'Oggi'], ['7', '7 giorni'], ['30', '30 giorni'], ['90', '3 mesi'], ['365', '12 mesi'], ['all', 'Sempre']];
var COL = { visitors: '#2d6cb5', views: '#c26d1a' };
var regionNames = (typeof Intl !== 'undefined' && Intl.DisplayNames) ? new Intl.DisplayNames(['it'], { type: 'region' }) : null;
function countryName(c) { if (c === '??' || !c) return 'Sconosciuto'; try { return regionNames ? regionNames.of(c) : c; } catch (e) { return c; } }
function flag(c) { return (c && c !== '??') ? String.fromCodePoint.apply(null, c.split('').map(function (x) { return 0x1F1E6 + x.charCodeAt(0) - 65; })) + ' ' : '🌍 '; }
var DEVICES = { mobile: 'Cellulare', desktop: 'Computer', tablet: 'Tablet' };

function renderStats(main) {
  var inner = el('div', { class: 'main-inner wide' });
  inner.appendChild(el('div', { class: 'page-head' }, el('div', null, el('h1', { text: 'Statistiche delle visite' }), el('p', { text: 'Chi visita il sito, da dove arriva e quali pagine guarda. Le tue visite da amministratrice non vengono contate.' })),
    el('div', { class: 'seg', role: 'group', 'aria-label': 'Periodo' }, RANGES.map(function (r) {
      return el('button', { 'aria-pressed': S.range === r[0] ? 'true' : 'false', text: r[1], onclick: function () { S.range = r[0]; S.stats = null; renderView(); } });
    }))));
  if (S.isDefault) inner.appendChild(defaultBanner());
  var todo = [];
  if (!S.content.contact_email) todo.push(['Manca l\'email per le prenotazioni: senza, il pulsante «Scrivi a Sara» non funziona.', 'settings']);
  if (!S.content.registration_url) todo.push(['Manca il link al modulo di iscrizione.', 'settings']);
  if (todo.length) inner.appendChild(el('div', { class: 'card', style: 'margin-bottom:14px' }, el('h2', { text: 'Da completare prima di pubblicare' }),
    el('ul', { class: 'todo' }, todo.map(function (t) { return el('li', null, t[0], el('button', { class: 'btn small', text: 'Completa', onclick: function () { go(t[1]); } })); }))));
  var body = el('div', { id: 'statsbody' }, el('p', { class: 'help', text: 'Caricamento delle statistiche…' }));
  inner.appendChild(body); main.appendChild(inner);
  var wanted = S.range;
  api('stats', { query: { range: wanted } }).then(function (r) {
    if (S.view !== 'stats' || wanted !== S.range) return;
    if (!r.ok) { drawStatsProblem(body, r); return; }
    S.stats = r; drawStats(body, r);
  });
}

function drawStatsProblem(body, r) {
  body.innerHTML = '';
  var missingUrl = !S.content.stats_url;
  if (r.notConfigured) {
    body.appendChild(el('div', { class: 'card' }, el('div', { class: 'empty' }, el('strong', { text: 'Il contatore visite non è ancora collegato' }),
      missingUrl ? 'Manca l\'indirizzo del contatore (si ottiene attivando il servizio descritto nel file worker/README.md). ' : 'Manca la chiave del contatore. ',
      el('div', { style: 'margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap' },
        missingUrl ? el('button', { class: 'btn', text: 'Inserisci l\'indirizzo', onclick: function () { go('settings'); } }) : null,
        el('button', { class: 'btn primary', text: 'Apri «Collegamenti»', onclick: function () { go('links'); } })))));
    return;
  }
  body.appendChild(el('div', { class: 'card' }, el('div', { class: 'empty' }, el('strong', { text: 'Non riesco a leggere le statistiche' }), r.error || 'Errore sconosciuto.',
    el('div', { style: 'margin-top:16px' }, el('button', { class: 'btn', text: 'Riprova', onclick: function () { renderView(); } })))));
}

/* ---------------- Collegamenti (GitHub e contatore) ---------------- */
function renderLinks(main) {
  var info = window.Store.vaultInfo();
  var inner = el('div', { class: 'main-inner' });
  inner.appendChild(el('div', { class: 'page-head' }, el('div', null, el('h1', { text: 'Collegamenti' }), el('p', { text: 'Servono una volta sola, su ogni browser che usi per amministrare il sito. I dati restano solo in questo browser, protetti dalla tua password.' }))));
  if (S.isDefault) inner.appendChild(defaultBanner());

  /* --- GitHub --- */
  var guess = window.Store.detectRepo();
  var gh = info.gh;
  var owner = el('input', { type: 'text', id: 'gho', value: gh ? gh.owner : guess.owner, autocomplete: 'off', spellcheck: 'false' });
  var repo = el('input', { type: 'text', id: 'ghr', value: gh ? gh.repo : guess.repo, autocomplete: 'off', spellcheck: 'false' });
  var branch = el('input', { type: 'text', id: 'ghb', value: gh ? gh.branch : '', placeholder: 'Lascia vuoto: viene scelto da solo', autocomplete: 'off', spellcheck: 'false' });
  var token = el('input', { type: 'password', id: 'ght', autocomplete: 'off', placeholder: gh ? 'Già salvato: scrivi qui solo per sostituirlo' : 'github_pat_…' });
  var msg = el('div', { class: 'msg-error', style: 'display:none', role: 'alert' });
  var go1 = el('button', { class: 'btn primary', type: 'submit', text: gh ? 'Aggiorna collegamento' : 'Collega GitHub' });
  var form = el('form', { class: 'panel', onsubmit: function (e) {
    e.preventDefault(); msg.style.display = 'none'; go1.disabled = true; go1.textContent = 'Verifica in corso…';
    var tk = token.value.trim();
    if (!tk && gh) { msg.textContent = 'Per aggiornare il collegamento incolla il token.'; msg.style.display = 'block'; go1.disabled = false; go1.textContent = 'Aggiorna collegamento'; return; }
    window.Store.connectGithub({ owner: owner.value, repo: repo.value, branch: branch.value, token: tk }).then(function (r) {
      go1.disabled = false; go1.textContent = gh ? 'Aggiorna collegamento' : 'Collega GitHub';
      if (!r.ok) { msg.textContent = r.error; msg.style.display = 'block'; return; }
      S.github = true; toast('Collegato a ' + r.repo + '.');
      if (!isDirty()) loadContent().then(function () { renderShellKeepSave(); }); else renderShellKeepSave();
    });
  } },
    el('div', { class: 'divider', text: 'GitHub: dove si pubblica il sito' }),
    el('p', { class: 'status ' + (gh ? 'ok' : 'no') }, gh ? 'Collegato a ' + gh.owner + '/' + gh.repo + ' (ramo ' + gh.branch + ')' : 'Non collegato: senza questo passaggio le modifiche non possono essere pubblicate.'),
    msg,
    el('div', { class: 'field' }, el('label', { class: 'lbl', for: 'gho', text: 'Nome utente GitHub' }), owner),
    el('div', { class: 'field' }, el('label', { class: 'lbl', for: 'ghr', text: 'Nome del repository' }), repo, el('span', { class: 'help', text: 'Quello del sito, ad esempio sara-yoga.' })),
    el('div', { class: 'field' }, el('label', { class: 'lbl', for: 'ght', text: 'Token di accesso' }), token,
      el('span', { class: 'help', text: 'Su GitHub: Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. In «Repository access» scegli solo questo repository; in «Permissions» imposta Contents: Read and write.' })),
    el('details', { class: 'adv' }, el('summary', { text: 'Opzioni avanzate' }), el('div', { class: 'field', style: 'margin-top:10px' }, el('label', { class: 'lbl', for: 'ghb', text: 'Ramo (branch)' }), branch)),
    el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-top:14px' }, go1,
      gh ? el('button', { type: 'button', class: 'btn danger', text: 'Scollega', onclick: function () {
        confirmBox('Scollegare GitHub?', 'Da questo browser non potrai più pubblicare finché non lo ricolleghi. Il sito online resta com\'è.', 'Scollega', true).then(function (ok) {
          if (ok) window.Store.disconnectGithub().then(function () { S.github = false; S.backups = []; toast('GitHub scollegato.'); renderShellKeepSave(); });
        });
      } }) : null));
  inner.appendChild(form);

  /* --- Contatore --- */
  var key = el('input', { type: 'password', id: 'sk', autocomplete: 'off', placeholder: info.statsKey ? 'Già salvata: scrivi qui solo per sostituirla' : 'La chiave scelta in fase di installazione' });
  var url = S.content.stats_url;
  inner.appendChild(el('form', { class: 'panel', onsubmit: function (e) {
    e.preventDefault();
    window.Store.setStatsKey(key.value).then(function () { S.statsReady = !!key.value.trim(); key.value = ''; toast(S.statsReady ? 'Chiave del contatore salvata.' : 'Chiave del contatore rimossa.'); renderShellKeepSave(); });
  } },
    el('div', { class: 'divider', text: 'Contatore visite' }),
    el('p', { class: 'status ' + (info.statsKey && url ? 'ok' : 'no') }, info.statsKey && url ? 'Contatore collegato' : (url ? 'Manca la chiave del contatore' : 'Manca l\'indirizzo del contatore (si inserisce in «Contatti e informazioni»)')),
    el('div', { class: 'field' }, el('label', { class: 'lbl', for: 'sk', text: 'Chiave del contatore' }), key,
      el('span', { class: 'help', text: 'Serve a leggere le statistiche. L\'attivazione del contatore è spiegata nel file worker/README.md.' })),
    el('button', { class: 'btn', type: 'submit', text: info.statsKey ? 'Aggiorna la chiave' : 'Salva la chiave' })));
  main.appendChild(inner);
}

function delta(cur, prev) {
  if (prev == null) return null;
  if (prev === 0) return null;
  var p = Math.round((cur - prev) / prev * 100);
  return el('span', { class: 'd' }, el('b', { class: p >= 0 ? 'up' : 'down', text: (p >= 0 ? '▲ +' : '▼ ') + p + '%' }), ' rispetto al periodo precedente');
}

function drawStats(body, r) {
  body.innerHTML = '';
  var t = r.totals, p = r.previous;
  if (!t.views) {
    body.appendChild(el('div', { class: 'card' }, el('div', { class: 'empty' }, el('strong', { text: 'Ancora nessuna visita in questo periodo' }),
      'Le visite compaiono qui pochi secondi dopo che qualcuno apre il sito. Le visite fatte mentre sei collegata alla dashboard non vengono contate: prova ad aprire il sito da un altro browser o dal telefono.')));
    return;
  }
  body.appendChild(el('div', { class: 'kpis' },
    el('div', { class: 'kpi' }, el('div', { class: 'k', text: 'Visitatori unici' }), el('div', { class: 'v', text: fmt(t.visitors) }), delta(t.visitors, p && p.visitors) || el('span', { class: 'd', text: 'persone diverse' })),
    el('div', { class: 'kpi' }, el('div', { class: 'k', text: 'Pagine viste' }), el('div', { class: 'v', text: fmt(t.views) }), delta(t.views, p && p.views) || el('span', { class: 'd', text: 'in totale' })),
    el('div', { class: 'kpi' }, el('div', { class: 'k', text: 'Pagine per visitatore' }), el('div', { class: 'v', text: String(t.per_visitor).replace('.', ',') }), el('span', { class: 'd', text: 'in media' }))));

  // Grafico
  var card = el('div', { class: 'card' });
  var head = el('div', { class: 'card-head' }, el('div', null, el('h2', { text: 'Andamento giorno per giorno' }), el('p', { class: 'sub', text: 'Un visitatore è contato una sola volta al giorno, anche se apre il sito più volte.' })),
    el('div', { class: 'seg', role: 'group', 'aria-label': 'Vista' }, [['chart', 'Grafico'], ['table', 'Tabella']].map(function (v) {
      return el('button', { 'aria-pressed': S.statsView === v[0] ? 'true' : 'false', text: v[1], onclick: function () { S.statsView = v[0]; drawStats(body, r); } });
    })));
  card.appendChild(head);
  if (S.statsView === 'table') card.appendChild(dailyTable(r.daily));
  else {
    card.appendChild(el('div', { class: 'legend' }, el('span', null, el('i', { class: 'sw', style: 'background:' + COL.visitors }), 'Visitatori unici'), el('span', null, el('i', { class: 'sw', style: 'background:' + COL.views }), 'Pagine viste')));
    var holder = el('div', { class: 'chart' }); card.appendChild(holder);
    requestAnimationFrame(function () { lineChart(holder, r.daily); });
    if (!holder._ro && window.ResizeObserver) { holder._ro = new ResizeObserver(function () { lineChart(holder, r.daily); }); holder._ro.observe(holder); }
  }
  body.appendChild(card);

  // Provenienza
  var maxCh = Math.max.apply(null, r.channels.map(function (x) { return x.visitors; }).concat([1]));
  var chBars = el('div', { class: 'bars' }, r.channels.map(function (c) { return barRow(c.name, c.visitors, c.views, maxCh); }));
  var srcTable = el('table', { class: 't', style: 'margin-top:18px' }, el('thead', null, el('tr', null, el('th', { text: 'Sito o servizio' }), el('th', { class: 'n', text: 'Visitatori' }), el('th', { class: 'n', text: 'Pagine viste' }))),
    el('tbody', null, r.sources.map(function (s) { return el('tr', null, el('td', null, s.name, el('span', { class: 'tag', text: s.channel })), el('td', { class: 'n', text: fmt(s.visitors) }), el('td', { class: 'n', text: fmt(s.views) })); })));
  body.appendChild(el('div', { class: 'grid2' },
    el('div', { class: 'card' }, el('h2', { text: 'Da dove arrivano' }), el('p', { class: 'sub', text: 'Il modo in cui le persone hanno trovato il sito.' }), chBars, srcTable),
    geoCard(r)));

  // Pagine e dispositivi
  var devMax = Math.max.apply(null, r.devices.map(function (x) { return x.visitors; }).concat([1]));
  body.appendChild(el('div', { class: 'grid2' },
    el('div', { class: 'card' }, el('h2', { text: 'Pagine più viste' }), el('p', { class: 'sub', text: '«/» è la pagina principale del sito.' }),
      el('table', { class: 't' }, el('thead', null, el('tr', null, el('th', { text: 'Pagina' }), el('th', { class: 'n', text: 'Visitatori' }), el('th', { class: 'n', text: 'Pagine viste' }))),
        el('tbody', null, r.pages.map(function (x) { return el('tr', null, el('td', { text: x.path === '/' ? '/ (pagina principale)' : x.path }), el('td', { class: 'n', text: fmt(x.visitors) }), el('td', { class: 'n', text: fmt(x.views) })); })))),
    el('div', { class: 'card' }, el('h2', { text: 'Con quale dispositivo' }), el('p', { class: 'sub', text: 'Quanti visitano da telefono, computer o tablet.' }),
      el('div', { class: 'bars' }, r.devices.map(function (d) { return barRow(DEVICES[d.name] || d.name, d.visitors, d.views, devMax); })))));
}

function geoCard(r) {
  var max = Math.max.apply(null, r.countries.map(function (x) { return x.visitors; }).concat([1]));
  var known = r.countries.filter(function (c) { return c.code !== '??'; }).length;
  var card = el('div', { class: 'card' }, el('h2', { text: 'Dove si trovano' }), el('p', { class: 'sub', text: 'Paese di provenienza dei visitatori.' }),
    el('div', { class: 'bars' }, r.countries.map(function (c) { return barRow(flag(c.code) + countryName(c.code), c.visitors, c.views, max); })));
  if (r.cities.length) card.appendChild(el('table', { class: 't', style: 'margin-top:18px' }, el('thead', null, el('tr', null, el('th', { text: 'Città' }), el('th', { class: 'n', text: 'Visitatori' }))),
    el('tbody', null, r.cities.map(function (c) { return el('tr', null, el('td', { text: c.city + (c.code !== '??' ? ' (' + countryName(c.code) + ')' : '') }), el('td', { class: 'n', text: fmt(c.visitors) })); }))));
  if (!known) card.appendChild(el('p', { class: 'help', style: 'margin-top:14px', text: 'Il paese non è ancora disponibile: dipende dall\'hosting. Vedi le note nel file README.' }));
  return card;
}

function barRow(name, visitors, views, max) {
  return el('div', { class: 'bar-row' }, el('div', { class: 'top' }, el('span', { text: name }), el('span', null, el('b', { text: fmt(visitors) }), ' visitatori · ' + fmt(views) + ' viste')),
    el('div', { class: 'track' }, el('div', { class: 'fill', style: 'width:' + Math.max(2, visitors / max * 100) + '%' })));
}

function dailyTable(daily) {
  var rows = daily.slice().reverse();
  return el('div', { style: 'max-height:380px;overflow:auto;margin-top:10px' }, el('table', { class: 't' }, el('thead', null, el('tr', null, el('th', { text: 'Giorno' }), el('th', { class: 'n', text: 'Visitatori unici' }), el('th', { class: 'n', text: 'Pagine viste' }))),
    el('tbody', null, rows.map(function (d) { return el('tr', null, el('td', { text: fmtDate(d.date, true) }), el('td', { class: 'n', text: fmt(d.visitors) }), el('td', { class: 'n', text: fmt(d.views) })); }))));
}
function fmtDate(s, long) {
  var d = new Date(s + 'T12:00:00');
  return d.toLocaleDateString('it-IT', long ? { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'short' });
}

function niceMax(v) { if (v <= 4) return 4; var p = Math.pow(10, Math.floor(Math.log10(v))); var m = v / p; var n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10; return n * p; }

function lineChart(holder, daily) {
  var W = holder.clientWidth; if (!W) return;
  var H = 280, m = { l: 40, r: 12, t: 14, b: 30 };
  var ns = 'http://www.w3.org/2000/svg';
  holder.innerHTML = '';
  if (daily.length < 2) { holder.appendChild(el('p', { class: 'help', style: 'padding:20px 0', text: 'Il grafico compare quando ci sono almeno due giorni da confrontare. Intanto guarda la tabella o i totali qui sopra.' })); return; }
  var max = niceMax(Math.max.apply(null, daily.map(function (d) { return Math.max(d.views, d.visitors); })));
  var iw = W - m.l - m.r, ih = H - m.t - m.b;
  function X(i) { return m.l + (daily.length === 1 ? iw / 2 : i * iw / (daily.length - 1)); }
  function Y(v) { return m.t + ih - v / max * ih; }
  var svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('height', H); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Grafico a linee di visitatori unici e pagine viste per giorno. La stessa informazione è disponibile nella vista Tabella.');
  function node(n, a, txt) { var e = document.createElementNS(ns, n); for (var k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; svg.appendChild(e); return e; }
  for (var g = 0; g <= 4; g++) { var v = max / 4 * g; node('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'grid' }); node('text', { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, Math.round(v)); }
  var ticks = Math.min(daily.length, Math.max(2, Math.floor(iw / 90)));
  for (var k = 0; k < ticks; k++) { var idx = Math.round(k * (daily.length - 1) / (ticks - 1)); node('text', { x: X(idx), y: H - 8, 'text-anchor': k === 0 ? 'start' : (k === ticks - 1 ? 'end' : 'middle') }, fmtDate(daily[idx].date)); }
  function path(key) { return daily.map(function (d, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(d[key]).toFixed(1); }).join(''); }
  node('path', { d: path('views'), fill: 'none', stroke: COL.views, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  node('path', { d: path('visitors'), fill: 'none', stroke: COL.visitors, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  if (daily.length <= 45) daily.forEach(function (d, i) {
    node('circle', { cx: X(i), cy: Y(d.views), r: 3, fill: COL.views, stroke: '#fff', 'stroke-width': 2 });
    node('circle', { cx: X(i), cy: Y(d.visitors), r: 3, fill: COL.visitors, stroke: '#fff', 'stroke-width': 2 });
  });
  var cross = node('line', { y1: m.t, y2: m.t + ih, stroke: '#9fb0a4', 'stroke-width': 1, 'stroke-dasharray': '3 3', visibility: 'hidden' });
  var hv = node('circle', { r: 5, fill: COL.visitors, stroke: '#fff', 'stroke-width': 2, visibility: 'hidden' });
  var hp = node('circle', { r: 5, fill: COL.views, stroke: '#fff', 'stroke-width': 2, visibility: 'hidden' });
  var tip = el('div', { class: 'tip' });
  holder.append(svg, tip);
  function move(ev) {
    var rect = svg.getBoundingClientRect(); var x = (ev.clientX - rect.left) * (W / rect.width);
    var i = Math.max(0, Math.min(daily.length - 1, Math.round((x - m.l) / iw * (daily.length - 1)))); var d = daily[i];
    cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('visibility', 'visible');
    hv.setAttribute('cx', X(i)); hv.setAttribute('cy', Y(d.visitors)); hv.setAttribute('visibility', 'visible');
    hp.setAttribute('cx', X(i)); hp.setAttribute('cy', Y(d.views)); hp.setAttribute('visibility', 'visible');
    tip.innerHTML = ''; tip.append(el('b', { text: fmtDate(d.date, true) }), el('span', null, el('i', { style: 'background:' + COL.visitors }), 'Visitatori unici: ' + fmt(d.visitors)), el('span', null, el('i', { style: 'background:' + COL.views }), 'Pagine viste: ' + fmt(d.views)));
    tip.style.display = 'block';
    var tx = X(i) * rect.width / W + 12; if (tx + tip.offsetWidth > rect.width) tx = X(i) * rect.width / W - tip.offsetWidth - 12;
    tip.style.left = Math.max(0, tx) + 'px'; tip.style.top = '8px';
  }
  function leave() { [cross, hv, hp].forEach(function (n) { n.setAttribute('visibility', 'hidden'); }); tip.style.display = 'none'; }
  svg.addEventListener('pointermove', move); svg.addEventListener('pointerleave', leave);
}

boot();
})();
