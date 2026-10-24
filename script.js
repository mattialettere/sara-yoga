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

// Intentionally keep the registration form link from navigating to an empty page.
// Replace this placeholder in index.html with the real form URL before publishing.
const registrationLink = document.querySelector('#registration-link');
if (registrationLink) {
  registrationLink.addEventListener('click', event => {
    if (registrationLink.getAttribute('href') === '#') {
      event.preventDefault();
      alert('The registration form link has not been added yet. Please message Sara to receive the form.');
    }
  });
}

// Contatore visite anonimo (pagine viste, visitatori unici, provenienza).
// Funziona solo se in dashboard è stato inserito l'indirizzo del contatore.
// Le visite dell'amministratore (collegato alla dashboard in questo browser) non vengono contate.
(function () {
  try {
    var meta = document.querySelector('meta[name="stats-endpoint"]');
    var endpoint = meta ? meta.getAttribute('content') : '';
    if (!endpoint) return;
    if (localStorage.getItem('ss_nc') === '1') return;
    var vid = localStorage.getItem('ss_vid');
    if (!vid || !/^[a-f0-9]{24}$/.test(vid)) {
      var a = new Uint8Array(12);
      (window.crypto || window.msCrypto).getRandomValues(a);
      vid = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      localStorage.setItem('ss_vid', vid);
    }
    var base = new URL('.', document.baseURI).pathname;
    var path = '/' + location.pathname.slice(base.length).replace(/index\.html$/, '');
    var q = new URLSearchParams(location.search);
    var body = JSON.stringify({ v: vid, p: path, r: document.referrer || '', u: q.get('utm_source') || '' });
    var url = endpoint + '/hit';
    if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }));
    else fetch(url, { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain' } });
  } catch (e) { /* il sito funziona anche senza contatore */ }
})();
