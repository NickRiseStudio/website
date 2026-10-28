// ═══════════════════════════════════════════════════════════════════════
// NICK RISE STUDIO — JS / БУРГЕР-МЕНЮ
// Источник: script.js, строки 7916–8065 (перенос 1:1, поведение не менялось)
// Читает снаружи: — (самодостаточен)
// Обязан грузиться после: js/state.js
// Владеет: mobileMenuCloseTimer, mobileMenuHeaderTimer.
// Публичные точки входа (window): toggleMobileMenu, openMobileMenu,
//          closeMobileMenu, initMobileMenuScrollLock — стоят в onclick.
// animations.js вешает hook на openMobileMenu / closeMobileMenu.
// ═══════════════════════════════════════════════════════════════════════

// --- MOBILE MENU ---
let mobileMenuCloseTimer = null;
let mobileMenuHeaderTimer = null;

function toggleMobileMenu() {
  const drawer = document.getElementById('mobileMenuDrawer');
  if (!drawer) return;

  if (drawer.classList.contains('is-open')) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
}

function openMobileMenu() {
  const drawer = document.getElementById('mobileMenuDrawer');
  const overlay = document.getElementById('mobileMenuOverlay');
  const hamIcon = document.getElementById('hamburgerIcon');
  const closeIcon = document.getElementById('closeMenuIcon');
  const header = document.getElementById('mainHeader');
  if (!drawer) return;

  if (mobileMenuCloseTimer) {
    clearTimeout(mobileMenuCloseTimer);
    mobileMenuCloseTimer = null;
  }
  if (mobileMenuHeaderTimer) {
    clearTimeout(mobileMenuHeaderTimer);
    mobileMenuHeaderTimer = null;
  }

  if (header) {
    /* Повторное открытие на середине затухания: снимаем переход, иначе фон
       поплыл бы к плотному цвету плавно, а шапка под открытым меню должна
       быть плотной сразу. */
    header.classList.remove('nr-menu-closing');
    header.classList.add('mobile-menu-active');
  }
  drawer.classList.add('is-open');
  if (overlay) overlay.classList.add('is-open');
  // Блокируем скролл страницы под открытым меню (см. initMobileMenuScrollLock)
  document.documentElement.classList.add('nr-menu-open');
  document.body.classList.add('nr-menu-open');

  if (hamIcon) {
    hamIcon.classList.add('scale-50', 'opacity-0', '-rotate-90');
  }
  if (closeIcon) {
    closeIcon.classList.remove('hidden', 'scale-50', 'opacity-0', 'rotate-90');
    closeIcon.classList.add('scale-100', 'opacity-100', 'rotate-0');
  }
}

function closeMobileMenu() {
  const drawer = document.getElementById('mobileMenuDrawer');
  const overlay = document.getElementById('mobileMenuOverlay');
  const hamIcon = document.getElementById('hamburgerIcon');
  const closeIcon = document.getElementById('closeMenuIcon');
  const header = document.getElementById('mainHeader');
  if (!drawer) return;

  if (mobileMenuCloseTimer) {
    clearTimeout(mobileMenuCloseTimer);
    mobileMenuCloseTimer = null;
  }
  if (mobileMenuHeaderTimer) {
    clearTimeout(mobileMenuHeaderTimer);
    mobileMenuHeaderTimer = null;
  }

  /* Шапка перестаёт быть «менюшной» СРАЗУ, а не через 1220ms (столько длится
     выезд шторки): кнопка языка тут же уезжает обратно в бургер, логотип
     возвращается к своей прозрачности от прокрутки. nr-menu-closing включает
     плавный переход фона на 1.2s — ровно столько же едет шторка, поэтому
     к её приезду шапка уже стоит в состоянии «меню закрыто». Класс
     снимается по таймеру (иначе он сглаживал бы и обычную прокрутку) или
     досрочно при скролле — см. animations.css → «Закрытие бургер-меню».
     Проверка is-open — до его снятия: closeMobileMenu зовут и с десктопа
     (клик по пункту меню), там закрывать нечего. */
  if (header && drawer.classList.contains('is-open')) {
    header.classList.remove('mobile-menu-active');
    header.classList.add('nr-menu-closing');
    mobileMenuHeaderTimer = setTimeout(() => {
      header.classList.remove('nr-menu-closing');
      mobileMenuHeaderTimer = null;
    }, 1260);
  }

  drawer.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-open');
  // Снимаем блокировку скролла страницы
  document.documentElement.classList.remove('nr-menu-open');
  document.body.classList.remove('nr-menu-open');

  if (hamIcon) {
    hamIcon.classList.remove('scale-50', 'opacity-0', '-rotate-90');
  }
  if (closeIcon) {
    closeIcon.classList.remove('scale-100', 'opacity-100', 'rotate-0');
    closeIcon.classList.add('scale-50', 'opacity-0', 'rotate-90');
  }

  /* Шторка едет 1.2s — столько же держим крестик, иначе он исчезнет раньше,
     чем меню уедет. Класс шапки здесь больше не снимается: это делается
     сразу при закрытии (см. выше). */
  mobileMenuCloseTimer = setTimeout(() => {
    if (closeIcon && !drawer.classList.contains('is-open')) {
      closeIcon.classList.add('hidden');
    }
    mobileMenuCloseTimer = null;
  }, 1220);
}

/* Блокировка прокрутки страницы при открытом бургер-меню (телефоны/планшеты).
   Класс nr-menu-open (html/body) запрещает скролл через overflow: hidden, но iOS
   может «протащить» страницу жестом — поэтому touch-жесты вне меню отменяются.
   Внутри #mobileMenuDrawer прокрутка работает (длинные меню).

   СЛУШАТЕЛЬ ЖИВЁТ НА ОВЕРЛЕЕ, А НЕ НА document (правка 26.10). Safari на iOS
   снимает быструю композитную прокрутку со ВСЕЙ страницы, если в цепочке события
   есть хоть один не-passive touchmove: перед каждым сдвигом пальца движок обязан
   дождаться JS. У оверлея в закрытом меню pointer-events: none (animations.css),
   поэтому в пути события его нет и прокрутка остаётся быстрой. Открыли меню —
   оверлей перекрывает экран (z-30, pointer-events: auto) и жесты вне шторки
   отменяет, как раньше. В шторке событие до оверлея не доходит вовсе: это
   отдельный элемент, а не его потомок. */
function initMobileMenuScrollLock() {
  const overlayEl = document.getElementById('mobileMenuOverlay');
  if (overlayEl) {
    overlayEl.addEventListener('touchmove', (e) => {
      if (!e.touches || !e.touches[0]) return;
      e.preventDefault();
    }, { passive: false });
  }

  // Если при открытом меню размер окна дорастил до десктопа (≥1024px) — закрываем,
  // иначе блокировка скролла останется при невидимом меню
  const desktopQuery = window.matchMedia('(min-width: 1024px)');
  const onDesktop = (mq) => {
    if (mq.matches && document.body.classList.contains('nr-menu-open')) {
      closeMobileMenu();
    }
  };
  if (typeof desktopQuery.addEventListener === 'function') {
    desktopQuery.addEventListener('change', onDesktop);
  } else if (typeof desktopQuery.addListener === 'function') {
    desktopQuery.addListener(onDesktop); // старые Safari
  }
}
