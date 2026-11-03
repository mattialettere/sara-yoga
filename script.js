const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#primary-nav');

if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
  });

  nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', 'Open navigation');
    });
  });
}

// Photo lightbox for the gallery
const lightbox = document.querySelector('#lightbox');
if (lightbox && typeof lightbox.showModal === 'function') {
  const lightboxImg = lightbox.querySelector('img');
  const lightboxCaption = lightbox.querySelector('figcaption');
  document.querySelectorAll('.photo').forEach(button => {
    button.addEventListener('click', () => {
      const img = button.querySelector('img');
      const caption = button.querySelector('figcaption');
      lightboxImg.src = img.currentSrc || img.src;
      lightboxImg.alt = img.alt;
      lightboxCaption.textContent = caption ? caption.textContent : '';
      lightbox.showModal();
    });
  });
  lightbox.addEventListener('click', event => {
    if (event.target === lightbox || event.target.closest('.lightbox-close')) lightbox.close();
  });
}

document.querySelector('#year').textContent = new Date().getFullYear();

// Modulo di contatto: «Message Sara to book» e «Get in touch» aprono una finestra con il modulo.
// Se l'indirizzo del modulo non è stato impostato in dashboard (o il browser è molto vecchio),
// i link funzionano come prima e aprono la posta del visitatore (mailto).
(function () {
  var dialog = document.querySelector('#contact-dialog');
  var form = document.querySelector('#contact-form');
  var meta = document.querySelector('meta[name="contact-endpoint"]');
  var endpoint = meta ? meta.getAttribute('content') : '';
  if (!dialog || !form || typeof dialog.showModal !== 'function') return;

  var status = form.querySelector('.contact-status');
  var submit = form.querySelector('.contact-submit');
  var fallback = dialog.getAttribute('data-fallback') || '';
  var packageField = form.querySelector('[name="package"]');
  var openedAt = 0;

  function setStatus(text, kind) {
    status.textContent = text;
    status.className = 'contact-status' + (kind ? ' is-' + kind : '');
  }

  document.querySelectorAll('[data-contact]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      setStatus('', '');
      if (packageField) {
        var requestedPackage = link.getAttribute('data-package') || 'Informations';
        packageField.value = requestedPackage;
        if (!packageField.value) packageField.value = 'Informations';
      }
      openedAt = Date.now();
      dialog.showModal();
    });
  });

  dialog.addEventListener('click', function (event) {
    if (event.target === dialog || event.target.closest('.contact-close')) dialog.close();
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var data = new FormData(form);
    var first = String(data.get('first') || '').trim();
    var last = String(data.get('last') || '').trim();
    var email = String(data.get('email') || '').trim();
    var selectedPackage = String(data.get('package') || 'Informations').trim();
    var message = String(data.get('message') || '').trim();
    if (!first || !last || !email || !selectedPackage || !message) { setStatus('Please fill in every field.', 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus('Please enter a valid email address.', 'error'); return; }

    if (!endpoint) {
      var subject = encodeURIComponent('Yoga enquiry (' + selectedPackage + ') from ' + first + ' ' + last);
      var body = encodeURIComponent('Name: ' + first + ' ' + last + '\\nEmail: ' + email + '\\nInterested in: ' + selectedPackage + '\\n\\n' + message);
      window.location.href = 'mailto:' + (fallback || 'info@sarashanti.com') + '?subject=' + subject + '&body=' + body;
      setStatus('Your email app is opening with your message. Please send the email to complete your enquiry.', 'ok');
      return;
    }

    submit.disabled = true;
    setStatus('Sending…', '');
    fetch(endpoint + '/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first: first, last: last, email: email, package: selectedPackage, message: message,
        website: String(data.get('website') || ''),
        t: openedAt ? Date.now() - openedAt : 0
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      form.reset();
      setStatus('Thank you! Your message is on its way. Sara will reply by email soon.', 'ok');
    }).catch(function () {
      setStatus('Sorry, something went wrong.' + (fallback ? ' Please try again or write to ' + fallback + '.' : ' Please try again in a moment.'), 'error');
    }).finally(function () { submit.disabled = false; });
  });
})();

// Cookie preferences and consent-gated anonymous analytics.
(function () {
  'use strict';
  var CONSENT_KEY = 'ss_cookie_consent_v1';
  var banner = document.getElementById('cookie-banner');
  var dialog = document.getElementById('cookie-dialog');
  var analyticsToggle = document.getElementById('cookie-analytics');
  var endpointMeta = document.querySelector('meta[name="stats-endpoint"]');
  var endpoint = endpointMeta ? endpointMeta.getAttribute('content') : '';

  function readConsent() {
    try {
      var value = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
      if (!value || value.version !== 1 || typeof value.analytics !== 'boolean') return null;
      return value;
    } catch (_) { return null; }
  }

  function storeConsent(analytics) {
    var value = { version: 1, necessary: true, analytics: !!analytics, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(value)); } catch (_) {}
    if (!analytics) {
      try { localStorage.removeItem('ss_vid'); } catch (_) {}
    }
    if (banner) banner.hidden = true;
    if (dialog && dialog.open) dialog.close();
    if (analytics) sendPageView();
  }

  function openPreferences() {
    var current = readConsent();
    if (analyticsToggle) analyticsToggle.checked = !!(current && current.analytics);
    if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
    else if (banner) banner.hidden = false;
  }

  function sendPageView() {
    if (!endpoint || !readConsent() || !readConsent().analytics) return;
    try {
      if (localStorage.getItem('ss_nc') === '1') return;
      var vid = localStorage.getItem('ss_vid');
      if (!vid || !/^[a-f0-9]{24}$/.test(vid)) {
        var bytes = new Uint8Array(12);
        if (!window.crypto || !window.crypto.getRandomValues) return;
        window.crypto.getRandomValues(bytes);
        vid = Array.prototype.map.call(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
        localStorage.setItem('ss_vid', vid);
      }
      var base = new URL('.', document.baseURI).pathname;
      var path = '/' + location.pathname.slice(base.length).replace(/index\.html$/, '');
      var query = new URLSearchParams(location.search);
      var body = JSON.stringify({ v: vid, p: path, r: document.referrer || '', u: query.get('utm_source') || '' });
      var url = endpoint + '/hit';
      if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }));
      else fetch(url, { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain' } });
    } catch (_) { /* the website remains usable if analytics are unavailable */ }
  }

  document.getElementById('cookie-accept')?.addEventListener('click', function () { storeConsent(true); });
  document.getElementById('cookie-reject')?.addEventListener('click', function () { storeConsent(false); });
  document.getElementById('cookie-manage')?.addEventListener('click', openPreferences);
  document.getElementById('cookie-save')?.addEventListener('click', function () { storeConsent(!!(analyticsToggle && analyticsToggle.checked)); });
  document.getElementById('cookie-dialog-reject')?.addEventListener('click', function () { storeConsent(false); });
  document.getElementById('cookie-close')?.addEventListener('click', function () { if (dialog) dialog.close(); });
  document.querySelectorAll('[data-cookie-settings]').forEach(function (button) {
    button.addEventListener('click', openPreferences);
  });
  if (dialog) dialog.addEventListener('click', function (event) {
    if (event.target === dialog) dialog.close();
  });

  var consent = readConsent();
  if (!consent) {
    if (banner) banner.hidden = false;
  } else if (consent.analytics) {
    sendPageView();
  }
})();
