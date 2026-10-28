// ═══════════════════════════════════════════════════════════════════════
// NICK RISE STUDIO — JS / ЗАМОК ПРОКРУТКИ И ОБРАБОТЧИКИ ОКОН
// Источник: script.js, строки 6723–6826 (перенос 1:1, поведение не менялось)
// Читает снаружи: — (самодостаточен)
// Обязан грузиться после: js/state.js
// Владеет: isPageScrollLocked.
// Публичные точки входа (window): lockPageScroll, unlockPageScroll,
//          initModalAndToast.
// ═══════════════════════════════════════════════════════════════════════

// --- MODAL SCROLL LOCK SYSTEM ---
let isPageScrollLocked = false;

function lockPageScroll() {
  if (isPageScrollLocked) return;
  isPageScrollLocked = true;

  // Prevent scrollbar layout shift on desktop without altering document scroll position
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    const header = document.querySelector('header');
    if (header) header.style.paddingRight = `${scrollbarWidth}px`;
  }

  document.documentElement.classList.add('modal-open');
  document.body.classList.add('modal-open');
}

function unlockPageScroll() {
  const contactActive = document.getElementById('contactModal')?.classList.contains('active');
  const aboutActive = document.getElementById('aboutModal')?.classList.contains('active');
  const calcActive = document.getElementById('priceCalcModal')?.classList.contains('active');
  const showcaseActive = document.getElementById('aboutShowcase')?.classList.contains('active');
  if (contactActive || aboutActive || calcActive || showcaseActive) return;

  if (!isPageScrollLocked) return;
  isPageScrollLocked = false;

  document.documentElement.classList.remove('modal-open');
  document.body.classList.remove('modal-open');
  document.body.style.paddingRight = '';
  const header = document.querySelector('header');
  if (header) header.style.paddingRight = '';
}

// --- MODAL & TOAST HANDLERS ---
function initModalAndToast() {
  const contactModal = document.getElementById('contactModal');
  if (contactModal) {
    contactModal.addEventListener('click', (e) => {
      if (e.target === contactModal) closeContactModal();
    });
  }

  const aboutModal = document.getElementById('aboutModal');
  if (aboutModal) {
    aboutModal.addEventListener('click', (e) => {
      if (e.target === aboutModal) closeAboutModal();
    });
  }

  // Окно-калькулятор стоимости услуг: закрытие по клику на затемнение
  const priceCalcModal = document.getElementById('priceCalcModal');
  if (priceCalcModal) {
    priceCalcModal.addEventListener('click', (e) => {
      if (e.target === priceCalcModal) closePriceCalcModal();
    });
  }

  // Prevent scroll propagation from backdrop area
  [contactModal, aboutModal, priceCalcModal].forEach(modalEl => {
    if (!modalEl) return;
    modalEl.addEventListener('wheel', (e) => {
      const content = modalEl.querySelector('.modal-content');
      if (!content || !content.contains(e.target)) {
        e.preventDefault();
      }
    }, { passive: false });

    modalEl.addEventListener('touchmove', (e) => {
      const content = modalEl.querySelector('.modal-content');
      if (!content || !content.contains(e.target)) {
        e.preventDefault();
      }
    }, { passive: false });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeContactModal();
      closeAboutModal();
      closePriceCalcModal();
    }
  });
}

function openContactModal() {
  closeMobileMenu();
  const modal = document.getElementById('contactModal');
  if (modal) {
    modal.classList.add('active');
    lockPageScroll();
  }
}

function closeContactModal() {
  const modal = document.getElementById('contactModal');
  if (modal && modal.classList.contains('active')) {
    modal.classList.remove('active');
    unlockPageScroll();
  }
}

