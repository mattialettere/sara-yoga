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
