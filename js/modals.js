// ═══════════════════════════════════════════════════════════════════════
// js/modals.js — ЗАМОК ПРОКРУТКИ И ОБРАБОТЧИКИ ОКОН
// Грузится после: js/state.js.
// Владеет: isPageScrollLocked.
// Публичные (window): lockPageScroll, unlockPageScroll, initModalAndToast.
// Блоки файла:
//   • lockPageScroll / unlockPageScroll — страница стоит под открытым окном.
//   • initModalAndToast — закрытие по фону, Esc и крестику.
// ═══════════════════════════════════════════════════════════════════════

// --- БЛОКИРОВКА ПРОКРУТКИ ПОД МОДАЛКАМИ ---
let isPageScrollLocked = false;

function lockPageScroll() {
  if (isPageScrollLocked) return;
  isPageScrollLocked = true;

  // Без сдвига раскладки от исчезающего скроллбара: позиция прокрутки не меняется
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
  const calcFormActive = document.getElementById('priceCalcShowcase')?.classList.contains('active');
  const showcaseActive = document.getElementById('aboutShowcase')?.classList.contains('active');
  if (contactActive || aboutActive || calcFormActive || showcaseActive) return;

  if (!isPageScrollLocked) return;
  isPageScrollLocked = false;

  document.documentElement.classList.remove('modal-open');
  document.body.classList.remove('modal-open');
  document.body.style.paddingRight = '';
  const header = document.querySelector('header');
  if (header) header.style.paddingRight = '';
}

// --- ОБРАБОТЧИКИ МОДАЛОК И ТОСТОВ ---
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

  // Прокрутка не уходит за затемнение (backdrop)
  [contactModal, aboutModal].forEach(modalEl => {
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
      closePriceCalcShowcase();
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

