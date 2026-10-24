// Genera la pagina pubblica (index.html) a partire dai testi salvati in content.json.
// Lo stesso file gira nel browser (dashboard) e in Node (tools/build.mjs).

const ICONS = ['〰', '✺', '☾', '❧', '☼'];

/* ---------- Utilità ---------- */
export function h(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
/** Testo con a-capo e *corsivo* -> HTML sicuro */
export function mk(s) {
  return h(s).replace(/\*([^*\n]+)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
}
/** Paragrafi separati da una riga vuota */
export function paras(s) {
  return String(s ?? '').trim().split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => `<p>${mk(p)}</p>`).join('\n');
}

/* ---------- Contenuti: valori originali + modifiche salvate, con controlli ---------- */
function cleanValue(f, v) {
  if (f.type === 'list') {
    if (!Array.isArray(v)) return [];
    return v.slice(0, 60).filter(x => x && typeof x === 'object').map(item => {
      const o = {};
      for (const sf of f.fields) if (sf.type !== 'divider') o[sf.key] = cleanValue(sf, item[sf.key] ?? sf.default ?? '');
      return o;
    });
  }
  let s = (v == null || typeof v === 'object') ? '' : String(v);
  s = s.replace(/\r\n/g, '\n').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim().slice(0, f.max || 6000);
  switch (f.type) {
    case 'image': return (s === '' || (/^assets\/[A-Za-z0-9_./-]+$/.test(s) && !s.includes('..'))) ? s : (f.default || '');
    case 'url': return /^https?:\/\/[^\s<>"]+$/i.test(s) ? s : '';
    case 'email': return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(s) ? s : '';
    case 'select': return f.options.some(o => o.value === s) ? s : (f.default || '');
    case 'time': return /^\d{2}:\d{2}$/.test(s) ? s : (f.default || '');
    default: return s;
  }
}

export function allFields(schema) {
  return schema.flatMap(sec => sec.fields).filter(f => f.type !== 'divider');
}

export function mergeContent(schema, saved) {
  saved = saved || {};
  const out = {};
  for (const f of allFields(schema)) {
    const base = JSON.parse(JSON.stringify(f.default ?? (f.type === 'list' ? [] : '')));
    out[f.key] = (f.key in saved) ? cleanValue(f, saved[f.key]) : base;
  }
  return out;
}

/* ---------- Pagina ---------- */
export function renderPage(schema, saved, opts = {}) {
  const c = mergeContent(schema, saved);
  const defaultSizes = opts.defaultSizes || {};
  const savedSizes = (saved && saved._sizes) || {};
  const size = p => {
    const s = savedSizes[p] || defaultSizes[p];
    return (Array.isArray(s) && s[0] > 0 && s[1] > 0) ? [s[0], s[1]] : [1200, 800];
  };
  const year = opts.year || new Date().getFullYear();
  const siteUrl = c.site_url.endsWith('/') ? c.site_url : c.site_url + '/';
  const mailto = c.contact_email !== '' ? 'mailto:' + h(c.contact_email) : '#book';
  const address = (c.venue_street + ', ' + (c.venue_city + ' ' + c.venue_postcode).trim()).replace(/^[ ,]+|[ ,]+$/g, '');
  const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.venue_name + ', ' + address);
  const brandPlain = c.brand_name.replace(/\*/g, '');

  // Dati strutturati per Google
  const offers = []; const prices = [];
  for (const p of c.price_cards) {
    const n = p.price.replace(/[^0-9.]/g, '');
    if (!n) continue;
    offers.push({ '@type': 'Offer', name: p.title, price: n, priceCurrency: p.currency === '€' ? 'EUR' : 'GBP' });
    prices.push(parseFloat(n));
  }
  const ld = {
    '@context': 'https://schema.org', '@type': 'HealthClub', name: brandPlain + ' Yoga', url: siteUrl, description: c.site_description,
    image: siteUrl + c.hero_image,
    address: { '@type': 'PostalAddress', streetAddress: c.venue_name + ', ' + c.venue_street, addressLocality: c.venue_city, postalCode: c.venue_postcode, addressCountry: 'GB' },
    event: {
      '@type': 'Event', name: 'Weekly Sivananda Hatha Yoga Class',
      eventSchedule: { '@type': 'Schedule', byDay: 'https://schema.org/' + c.seo_day, startTime: c.seo_start, endTime: c.seo_end },
      location: { '@type': 'Place', name: c.venue_name, address: { '@type': 'PostalAddress', streetAddress: c.venue_street, addressLocality: c.venue_city, postalCode: c.venue_postcode, addressCountry: 'GB' } },
      offers
    }
  };
  if (prices.length) ld.priceRange = `£${Math.min(...prices)}–£${Math.max(...prices)} per class`;
  const ldJson = JSON.stringify(ld).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

  const cards = c.practice_cards.map((card, i) => `
          <article class="practice-card">
            <div class="card-number">${String(i + 1).padStart(2, '0')}</div><div class="practice-icon" aria-hidden="true">${ICONS[i % ICONS.length]}</div>
            <h3>${h(card.title)}</h3><p>${mk(card.text)}</p>
          </article>`).join('');

  const themes = c.gallery_themes.map(t => {
    const split = t.layout === 'split';
    const photos = t.photos.filter(p => p.src !== '');
    const sizes = photos.map(p => size(p.src));
    const portraits = sizes.filter(s => s[1] > s[0]).length;
    const figs = photos.map((p, k) => {
      const [w, hh] = sizes[k];
      return `
            <figure class="${hh > w ? 'portrait' : 'landscape'}" style="--ar:${Math.round(w / hh * 1000) / 1000}">
              <button type="button" class="photo" aria-label="Enlarge photo: ${h(p.caption)}">
                <img src="${h(p.src)}" width="${w}" height="${hh}" loading="lazy" decoding="async" alt="${h(p.alt)}">
                <figcaption>${h(p.caption)}</figcaption>
              </button>
            </figure>`;
    }).join('');
    return `
        <article class="theme${split ? ' theme-split' : ''}">
          <div class="theme-text">
            <p class="eyebrow">${h(t.eyebrow)}</p>
            <h3>${h(t.title)}</h3>
            <p>${mk(t.text)}</p>${split && t.link !== '' ? `
            <a class="text-link" href="#book">${h(t.link)} <span>→</span></a>` : ''}
          </div>
          <div class="photo-row${portraits >= 2 ? ' pair' : ''}">${figs}
          </div>
        </article>`;
  }).join('\n');

  const dates = c.dates_list.map(d => `
          <div class="date-line"><span>${h(d.dow)}</span><strong>${h(d.date)}</strong><i>${h(d.time)}</i></div>`).join('');

  const prices_html = c.price_cards.map(p => {
    const feat = p.tag !== '';
    return `
          <article class="price-card${feat ? ' featured' : ''}">${feat ? `
            <div class="popular-tag">${h(p.tag)}</div>` : ''}
            <p class="eyebrow">${h(p.eyebrow)}</p><h3>${h(p.title)}</h3>
            <div class="price"><span>${h(p.currency)}</span>${h(p.price)}<small> ${h(p.unit)}</small></div>
            <p>${mk(p.text)}</p>
            <a class="button ${feat ? 'button-dark' : 'button-outline'}" href="#book">${h(p.button)} <span>↗</span></a>
          </article>`;
  }).join('');

  const faq = c.faq_list.map(f => `
          <details><summary>${h(f.q)}</summary><p>${mk(f.a)}</p></details>`).join('');

  const [jw, jh] = size(c.journal_image);
  const steps = c.journal_steps.map(s => `<li>${mk(s.text)}</li>`).join('\n                ');
  const nav = (id, key) => `<a href="#${id}">${h(c[key])}</a>`;

  return `<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f7f5ef">
  <meta name="description" content="${h(c.site_description)}">
  <meta name="robots" content="index,follow">
  <meta name="stats-endpoint" content="${h(c.stats_url.replace(/\/+$/, ''))}">
  <link rel="canonical" href="${h(siteUrl)}">
  <title>${h(c.site_title)}</title>
  <meta property="og:type" content="website">
  <meta property="og:title" content="${h(c.site_title)}">
  <meta property="og:description" content="${h(c.site_description)}">
  <meta property="og:url" content="${h(siteUrl)}">
  <meta property="og:image" content="${h(siteUrl + c.hero_image)}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
  <script type="application/ld+json">${ldJson}</script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="container nav-wrap">
      <a class="brand" href="#top" aria-label="${h(brandPlain)} home">
        <span class="brand-mark" aria-hidden="true">ॐ</span>
        <span>${mk(c.brand_name)}<small>${h(c.brand_tag)}</small></span>
      </a>
      <button class="menu-toggle" aria-expanded="false" aria-controls="primary-nav" aria-label="Open navigation">
        <span></span><span></span><span></span>
      </button>
      <nav id="primary-nav" class="primary-nav" aria-label="Main navigation">
        ${nav('about', 'nav_about')}
        ${nav('classes', 'nav_classes')}
        ${nav('gallery', 'nav_gallery')}
        ${nav('pricing', 'nav_pricing')}
        ${nav('location', 'nav_location')}
        <a class="nav-cta" href="#book">${h(c.nav_cta)} <span aria-hidden="true">↗</span></a>
      </nav>
    </div>
  </header>

  <main id="main">
    <section class="hero" id="top">
      <div class="hero-image" role="img" aria-label="${h(c.hero_alt)}" style="background-image:url('${h(c.hero_image)}')"></div>
      <div class="hero-shade"></div>
      <div class="container hero-content">
        <p class="eyebrow light"><span></span> ${h(c.hero_eyebrow)}</p>
        <h1>${mk(c.hero_title)}</h1>
        <p class="hero-copy">${mk(c.hero_copy)}</p>
        <div class="hero-actions">
          <a class="button button-light" href="#book">${h(c.hero_btn)} <span>↗</span></a>
          <a class="text-link light-link" href="#about">${h(c.hero_link)} <span>↓</span></a>
        </div>
        <div class="hero-note"><span class="note-icon">✺</span><span><strong>${h(c.hero_note_title)}</strong><br>${h(c.hero_note_text)}</span></div>
      </div>
      <div class="hero-caption">${h(c.hero_caption)}</div>
    </section>

    <section class="intro section-pad">
      <div class="container intro-grid">
        <div class="intro-label"><span class="sun-symbol">☼</span><p>${mk(c.intro_label)}</p></div>
        <div class="intro-text">
          <p class="eyebrow">${h(c.intro_eyebrow)}</p>
          <h2>${mk(c.intro_title)}</h2>
          <p>${mk(c.intro_text)}</p>
        </div>
      </div>
    </section>

    <section class="about section-pad" id="about">
      <div class="container about-grid">
        <div class="about-photo-wrap">
          <img src="${h(c.about_image)}" alt="${h(c.about_alt)}" class="about-photo" loading="lazy">
          <div class="photo-stamp"><span>${h(c.about_stamp_num)}</span><small>${mk(c.about_stamp_text)}</small></div>
        </div>
        <div class="about-copy">
          <p class="eyebrow">${h(c.about_eyebrow)}</p>
          <h2>${mk(c.about_title)}</h2>
          <p class="script-line">${h(c.about_script)}</p>
          ${paras(c.about_text)}
          ${c.about_link !== '' ? `<a class="text-link" href="#classes">${h(c.about_link)} <span>→</span></a>` : ''}
        </div>
      </div>
    </section>

    <section class="practice section-pad" id="classes">
      <div class="container">
        <div class="section-heading centered">
          <p class="eyebrow">${h(c.practice_eyebrow)}</p>
          <h2>${mk(c.practice_title)}</h2>
          <p>${mk(c.practice_text)}</p>
        </div>
        <div class="practice-cards">${cards}
        </div>${c.practice_pills.length ? `
        <div class="duration-pill"><span>◷</span> ${c.practice_pills.map(p => h(p.text)).join(' <i></i> ')}</div>` : ''}
      </div>
    </section>

    <section class="gallery section-pad" id="gallery">
      <div class="container">
        <div class="section-heading centered">
          <p class="eyebrow">${h(c.gallery_eyebrow)}</p>
          <h2>${mk(c.gallery_title)}</h2>
          <p>${mk(c.gallery_text)}</p>
        </div>
${themes}
      </div>
    </section>

    <section class="quote-band" id="quote">
      <div class="quote-mark" aria-hidden="true">“</div>
      <blockquote>${mk(c.quote_text)}</blockquote>
      <p>${mk(c.quote_sub)}</p>
    </section>

    <section class="schedule section-pad" id="location">
      <div class="container schedule-grid">
        <div class="schedule-copy">
          <p class="eyebrow">${h(c.sched_eyebrow)}</p>
          <h2>${mk(c.sched_title)}</h2>
          <p>${mk(c.sched_text)}</p>
          <div class="detail-row"><span class="detail-icon">◷</span><div><strong>${h(c.sched_when)}</strong><small>${h(c.sched_when_small)}</small></div></div>
          <div class="detail-row"><span class="detail-icon">⌖</span><div><strong>${h(c.venue_name)}</strong><small>${h(address)}</small></div></div>
          ${c.sched_directions !== '' ? `<a class="text-link" href="${h(mapsUrl)}" target="_blank" rel="noopener noreferrer">${h(c.sched_directions)} <span>↗</span></a>` : ''}
        </div>
        <div class="dates-card">
          <div class="dates-top"><span class="eyebrow">${h(c.dates_eyebrow)}</span><span class="leaf-mark">❧</span></div>
          <h3>${h(c.dates_title)}</h3>
          <p class="dates-note">${h(c.dates_note)}</p>${dates}
          <a class="button button-dark full-button" href="#book">${h(c.dates_btn)} <span>↗</span></a>
          <small class="date-disclaimer">${h(c.dates_disclaimer)}</small>
        </div>
      </div>
    </section>

    <section class="pricing section-pad" id="pricing">
      <div class="container pricing-grid">
        <div class="pricing-copy">
          <p class="eyebrow">${h(c.pricing_eyebrow)}</p>
          <h2>${mk(c.pricing_title)}</h2>
          <p>${mk(c.pricing_text)}</p>
          <div class="kind-note"><span>♡</span><p><strong>${h(c.kind_title)}</strong><br>${mk(c.kind_text)}</p></div>
        </div>
        <div class="price-options">${prices_html}
        </div>
      </div>
    </section>

    <section class="faq section-pad" id="faq">
      <div class="container faq-grid">
        <div><p class="eyebrow">${h(c.faq_eyebrow)}</p><h2>${mk(c.faq_title)}</h2></div>
        <div class="faq-list">${faq}
        </div>
      </div>
    </section>

    <section class="curiosity section-pad" id="journal">
      <div class="container">
        <div class="section-heading centered">
          <p class="eyebrow">${h(c.journal_eyebrow)}</p>
          <h2>${mk(c.journal_heading)}</h2>
        </div>
        <article class="journal-card">
          <figure class="journal-photo">
            <img src="${h(c.journal_image)}" width="${jw}" height="${jh}" loading="lazy" decoding="async" alt="${h(c.journal_alt)}">
            <figcaption>${h(c.journal_caption)}</figcaption>
          </figure>
          <div class="journal-body">
            <p class="eyebrow">${h(c.journal_tag)}</p>
            <h3>${h(c.journal_title)}</h3>
            ${paras(c.journal_text)}${c.journal_steps.length ? `
            <div class="try-box">
              <strong>${h(c.journal_try_title)}</strong>
              <ol>
                ${steps}
              </ol>
            </div>` : ''}
            ${c.journal_link !== '' ? `<a class="text-link" href="#book">${h(c.journal_link)} <span>→</span></a>` : ''}
          </div>
        </article>
      </div>
    </section>

    <section class="booking section-pad" id="book">
      <div class="booking-pattern" aria-hidden="true"></div>
      <div class="container booking-content">
        <p class="eyebrow light">${h(c.book_eyebrow)}</p>
        <h2>${mk(c.book_title)}</h2>
        <p>${mk(c.book_text)}</p>
        <div class="booking-actions">
          <a class="button button-light" href="${mailto}${c.contact_email !== '' ? '?subject=Yoga%20class%20booking' : ''}">${h(c.book_btn_mail)} <span>↗</span></a>
          <a class="button button-translucent" href="${c.registration_url !== '' ? h(c.registration_url) : '#'}"${c.registration_url !== '' ? ' target="_blank" rel="noopener noreferrer"' : ''} id="registration-link">${h(c.book_btn_form)} <span>↗</span></a>
        </div>
        <p class="booking-small">${h(c.book_small)}</p>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container footer-main">
      <a class="brand footer-brand" href="#top"><span class="brand-mark" aria-hidden="true">ॐ</span><span>${mk(c.brand_name)}<small>${h(c.brand_tag)}</small></span></a>
      <p>${h(c.footer_tagline)}</p>
      <a class="back-top" href="#top">${h(c.footer_back)} ↑</a>
    </div>
    <div class="container footer-bottom"><span>© <span id="year">${year}</span> ${h(c.footer_name)}</span><span>${h(c.footer_made)}</span><a href="${mailto}">${h(c.footer_contact)}</a><a class="admin-link" href="admin/">Area amministratore</a></div>
  </footer>
  <dialog id="lightbox" class="lightbox" aria-label="Enlarged photo">
    <figure>
      <img src="" alt="">
      <figcaption></figcaption>
    </figure>
    <button type="button" class="lightbox-close" aria-label="Close photo">×</button>
  </dialog>
  <script src="script.js"></script>
</body>
</html>
`;
}
