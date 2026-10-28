// ═══════════════════════════════════════════════════════════════════════
// js/scroll.js — ПРОКРУТКА: ЯКОРЯ, SCROLL-SPY, «НАВЕРХ», ФЕЙДЕР МИКШЕРА
// Грузится после: js/state.js. Чужие функции зовёт только внутри обработчиков.
// Владеет: activeScrollTween, NAV_SECTIONS, scrollSpyAnchors, scrollSpyDocHeight,
//         scrollSpyTicking.
// Публичные (window): initSmoothAnchorNavigation, initScrollSpy, initScrollToTop, scrollToTop,
//         goToFaqItem, initMixerFaderScroll, refreshScrollSpyAnchors, setActiveNavSection.
// Блоки файла:
//   • Плавные якоря через Lenis (window.SmoothScroll) — секция «якоря».
//   • Scroll-spy: подсветка пункта меню по текущей секции.
//   • Кнопка «наверх» по центру внизу.
//   • Фейдер бокового микшера: --fader-y, вид — css/style/08-mixer.css.
// ═══════════════════════════════════════════════════════════════════════


// --- ПЛАВНАЯ ПРОКРУТКА К ЯКОРЯМ (кнопки шапки и ссылки внутри страницы) ---
let activeScrollTween = null;

function smoothScrollTo(targetY, customDuration) {
  const startY = window.pageYOffset || document.documentElement.scrollTop || 0;
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const clampedTargetY = Math.min(Math.max(0, targetY), maxScroll);
  const distance = Math.abs(clampedTargetY - startY);

  if (distance < 3) return;

  if (activeScrollTween) {
    activeScrollTween.kill();
    activeScrollTween = null;
  }

  // html scroll-behavior: auto — иначе браузер спорит с GSAP/JS на каждом кадре
  document.documentElement.style.scrollBehavior = 'auto';

  // Длительность растёт с расстоянием: 1.1s на близких, до 1.55s на дальних
  const animDuration = customDuration || Math.min(1.55, Math.max(1.1, 0.95 + (distance / 3800) * 0.6));

  // Если плавный скролл ведёт Lenis — отдаём якорь ему: GSAP ScrollToPlugin и
  // Lenis одновременно пишут в window.scrollTo и дерутся за позицию каждый кадр.
  if (window.nrSmoothScroll && typeof window.nrSmoothScroll.scrollTo === 'function' &&
      typeof window.nrSmoothScroll.isEnabled === 'function' && window.nrSmoothScroll.isEnabled()) {
    /* Якорь — не «щелчок колеса»: у колеса импульсная кривая из smoothConfig
       (быстрый старт, длинный хвост), а переходу между разделами нужен
       симметричный разгон и торможение. Поэтому кривую задаём здесь (как в
       GSAP-ветке ниже), а не берём движковую. force: true — иначе Lenis
       молча выходит из scrollTo, пока висит класс-замок страницы. */
    window.nrSmoothScroll.scrollTo(clampedTargetY, {
      duration: animDuration,
      easing: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
      force: true
    });
    return;
  }

  // Окно 220ms после клика: инерция трекпада и мыши не обрывает прокрутку
  let allowInterrupt = false;
  const graceTimer = setTimeout(() => {
    allowInterrupt = true;
  }, 220);

  function onUserInterrupt(e) {
    if (!allowInterrupt) return;
    // Микроколебания точных трекпадов и щелчков мыши игнорируются
    if (e.type === 'wheel' && Math.abs(e.deltaY) < 6 && Math.abs(e.deltaX) < 6) return;

    if (activeScrollTween) {
      activeScrollTween.kill();
      activeScrollTween = null;
    }
    cleanup();
  }

  function cleanup() {
    clearTimeout(graceTimer);
    window.removeEventListener('wheel', onUserInterrupt);
    window.removeEventListener('touchmove', onUserInterrupt);
    window.removeEventListener('keydown', onUserInterrupt);
  }

  window.addEventListener('wheel', onUserInterrupt, { passive: true });
  window.addEventListener('touchmove', onUserInterrupt, { passive: true });
  window.addEventListener('keydown', onUserInterrupt, { passive: true });

  if (typeof gsap !== 'undefined' && typeof ScrollToPlugin !== 'undefined') {
    activeScrollTween = gsap.to(window, {
      duration: animDuration,
      scrollTo: {
        y: clampedTargetY,
        autoKill: false
      },
      ease: "power2.inOut",
      overwrite: "auto",
      onComplete: () => {
        cleanup();
        activeScrollTween = null;
      },
      onInterrupt: () => {
        cleanup();
        activeScrollTween = null;
      }
    });
  } else if (typeof gsap !== 'undefined') {
    const scrollProxy = { y: startY };
    activeScrollTween = gsap.to(scrollProxy, {
      y: clampedTargetY,
      duration: animDuration,
      ease: "power2.inOut",
      overwrite: "auto",
      onUpdate: () => {
        window.scrollTo(0, scrollProxy.y);
      },
      onComplete: () => {
        cleanup();
        activeScrollTween = null;
      },
      onInterrupt: () => {
        cleanup();
        activeScrollTween = null;
      }
    });
  } else {
    const startTime = performance.now();
    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / (animDuration * 1000), 1);
      const ease = easeInOutCubic(progress);
      window.scrollTo(0, startY + (clampedTargetY - startY) * ease);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        cleanup();
      }
    }
    requestAnimationFrame(step);
  }
}

let currentActiveNavSection = undefined;
let scrollSpyClickLockTimer = null;
let lastScrollSpyY = typeof window !== 'undefined' ? (window.pageYOffset || document.documentElement.scrollTop || 0) : 0;
let scrollSpyDirection = 'down';

/* ─── Кэш геометрии секций для scroll-spy ──────────────────────────────
   Раньше updateActiveNavSection на КАЖДОМ кадре скролла вызывал
   getSectionAnchorTop → getBoundingClientRect по 5 секциям (плюс отдельный
   вызов для первой). Это 6 вынужденных пересчётов раскладки В КАДРЕ, прямо
   между записями стилей (полоска прогресса, фон шапки) — классический
   layout thrashing, из-за которого срывались кадры на быстрой прокрутке.
   Теперь позиции заголовков секций в системе координат ДОКУМЕНТА считаются
   один раз (и при resize/refresh), а в кадре от них отнимается только
   текущий scrollY — на страницу, которая между пересчётами не меняла высоту,
   это точная эквивалентная величина. Пересчёт вешает сам scroll-spy и
   внешние вызовы (смена языка, раскрытие отзывов/FAQ, появление плеера). */
const NAV_SECTIONS = ['player', 'services', 'reviews', 'contacts', 'faq'];
let scrollSpyAnchors = Object.create(null); /* id → top в координатах документа */
let scrollSpyDocHeight = 0;  /* высота документа на момент замера */
let scrollSpyHeaderH = 0;    /* высота шапки на момент замера */

function measureSectionAnchorTop(el) {
  if (!el) return null;
  /* Топ заголовка раздела в координатах документа = его позиция во вьюпорте
     плюс текущая прокрутка. Если заголовка нет или он скрыт (нулевой размер —
     например, свёрнутый блок), берём край контейнера — как было в прежней
     покадровой версии. */
  const heading = el.querySelector('h2, h1, [data-section-title], .section-title');
  if (heading) {
    const hr = heading.getBoundingClientRect();
    if (hr.height > 0 || hr.width > 0) return hr.top + (window.pageYOffset || document.documentElement.scrollTop || 0);
  }
  const rect = el.getBoundingClientRect();
  return rect.top + (window.pageYOffset || document.documentElement.scrollTop || 0);
}

function refreshScrollSpyAnchors() {
  const cache = Object.create(null);
  for (let i = 0; i < NAV_SECTIONS.length; i++) {
    const id = NAV_SECTIONS[i];
    const el = document.getElementById(id);
    cache[id] = el ? measureSectionAnchorTop(el) : null;
  }
  scrollSpyAnchors = cache;
  /* Заодно кэшируем высоту документа и шапки: в кадре прокрутки updateActiveNavSection
     опирается на них, а любое чтение scrollHeight/offsetHeight = переклейка раскладки. */
  scrollSpyDocHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  const header = document.querySelector('header');
  scrollSpyHeaderH = header ? header.offsetHeight : 72;
}

/* Позиция якоря секции в текущем вьюпорте из кэша (без чтения раскладки). */
function getSectionAnchorTop(el) {
  if (!el || !el.id) return null;
  const top = scrollSpyAnchors[el.id];
  if (top === undefined) return null;
  if (top === null) return null;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  return top - scrollY;
}

function isDesktopNavActive() {
  if (typeof getDeviceType === 'function') {
    return getDeviceType() === 'desktop';
  }
  return window.innerWidth >= 1024;
}

function setActiveNavSection(sectionId) {
  // На телефонах и планшетах подсветка разделов в навигации отключена
  if (!isDesktopNavActive()) {
    sectionId = null;
  }

  if (currentActiveNavSection === sectionId) return;
  currentActiveNavSection = sectionId;

  // Ссылки навигации в шапке на компьютере
  const desktopNavLinks = document.querySelectorAll('#mainHeader nav a[href^="#"]');
  desktopNavLinks.forEach(link => {
    const href = link.getAttribute('href');
    const target = href ? href.replace(/^#/, '') : '';
    if (sectionId && target === sectionId) {
      link.classList.add('nav-active');
    } else {
      link.classList.remove('nav-active');
    }
  });

  // На мобильных устройствах и планшетах меню остаётся чистым без принудительной подсветки
  const mobileNavLinks = document.querySelectorAll('#mobileMenuDrawer a[href^="#"]');
  mobileNavLinks.forEach(link => {
    link.classList.remove('nav-active');
  });
}

function updateActiveNavSection() {
  // На телефонах и планшетах полностью отключаем scrollspy-подсветку
  if (!isDesktopNavActive()) {
    setActiveNavSection(null);
    return;
  }

  if (scrollSpyClickLockTimer) return;

  const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  const windowHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  /* Высота документа и шапки — из кэша (refreshScrollSpyAnchors): чтение
     scrollHeight/offsetHeight здесь означало бы пересчёт раскладки в кадре. */
  const documentHeight = scrollSpyDocHeight || Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);

  // Определение направления скролла с фильтрацией микро-колебаний
  const scrollDelta = scrollY - lastScrollSpyY;
  if (Math.abs(scrollDelta) >= 3) {
    scrollSpyDirection = scrollDelta > 0 ? 'down' : 'up';
    lastScrollSpyY = scrollY;
  }

  // Если прокрутили до самого низа страницы — гарантированно активен FAQ
  // (последний раздел страницы перед подвалом)
  if (scrollY + windowHeight >= documentHeight - 50) {
    setActiveNavSection('faq');
    return;
  }

  const header = document.querySelector('header');
  const headerH = scrollSpyHeaderH || (header ? header.offsetHeight : 72);

  // Оптический центр видимой зоны экрана (между фиксированной шапкой и низом вьюпорта):
  // При скролле ВНИЗ: заголовок следующего раздела доходит до центра экрана (~47% видимой высоты) -> активируется этот раздел.
  // При скролле ВВЕРХ: заголовок нижнего раздела должен опуститься до ~72% (70-75% высоты экрана), прежде чем подсветка перейдёт на верхний раздел.
  const visibleHeight = windowHeight - headerH;
  const visibleCenter = headerH + visibleHeight * 0.47;
  const triggerY = scrollSpyDirection === 'down'
    ? visibleCenter
    : headerH + Math.round(visibleHeight * 0.72);

  // Зона Hero: если заголовок первого раздела (player) ещё не поднялся до центра экрана,
  // значит внимание пользователя на главном экране — подсветка выключена
  const firstSection = document.getElementById(NAV_SECTIONS[0]);
  const firstAnchorTop = getSectionAnchorTop(firstSection);
  if (firstAnchorTop !== null && firstAnchorTop > triggerY) {
    setActiveNavSection(null);
    return;
  }
  if (scrollY < 120) {
    setActiveNavSection(null);
    return;
  }

  // Проверяем секции в обратном порядке (снизу вверх: reviews -> contacts -> faq -> services -> player):
  // Первая секция снизу, чей заголовок/якорь пересёк линию центра экрана, становится активной
  let activeSection = null;
  for (let i = NAV_SECTIONS.length - 1; i >= 0; i--) {
    const id = NAV_SECTIONS[i];
    const el = document.getElementById(id);
    if (!el) continue;
    const anchorTop = getSectionAnchorTop(el);
    if (anchorTop !== null && anchorTop <= triggerY) {
      activeSection = id;
      break;
    }
  }

  setActiveNavSection(activeSection);
}

function initScrollSpy() {
  let isScrollSpyTicking = false;

  function onScrollOrResize() {
    if (!isScrollSpyTicking) {
      isScrollSpyTicking = true;
      requestAnimationFrame(() => {
        updateActiveNavSection();
        updateScrollToTopVisibility();
        isScrollSpyTicking = false;
      });
    }
  }

  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });

  /* Геометрию секций пересчитываем здесь, а не в кадре: сразу после старта
     (когда раскладка устоялась), после загрузки шрифтов и на resize. */
  refreshScrollSpyAnchors();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { refreshScrollSpyAnchors(); updateActiveNavSection(); });
  }
  window.addEventListener('load', () => { refreshScrollSpyAnchors(); updateActiveNavSection(); });

  // Пересчёт при первой отрисовке
  updateActiveNavSection();
}

function initSmoothAnchorNavigation() {
  if (typeof gsap !== 'undefined' && typeof ScrollToPlugin !== 'undefined') {
    gsap.registerPlugin(ScrollToPlugin);
  }

  document.addEventListener('click', (e) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

    const anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    if (href === '#' || href === '#top') {
      e.preventDefault();
      setActiveNavSection(null);
      smoothScrollTo(0);
      return;
    }

    try {
      const targetEl = document.querySelector(href);
      if (targetEl) {
        e.preventDefault();
        const header = document.querySelector('header');
        const headerH = header ? header.offsetHeight : 72;
        const extraOffset = 14;
        const rect = targetEl.getBoundingClientRect();
        const currentY = window.pageYOffset || document.documentElement.scrollTop || 0;
        const targetY = currentY + rect.top - headerH - extraOffset;

        const targetId = href.startsWith('#') ? href.slice(1) : null;
        if (targetId && ['player', 'services', 'faq', 'contacts', 'reviews'].includes(targetId)) {
          setActiveNavSection(targetId);
          if (scrollSpyClickLockTimer) clearTimeout(scrollSpyClickLockTimer);
          scrollSpyClickLockTimer = setTimeout(() => {
            scrollSpyClickLockTimer = null;
            updateActiveNavSection();
          }, 1300);
        }

        if (typeof closeMobileMenu === 'function') {
          closeMobileMenu();
        }

        smoothScrollTo(targetY);

        /* Адрес НЕ меняем: у сайта одна ссылка, якоря живут только в разметке.
           Раньше здесь стоял history.pushState(null, '', href) — при клике по
           меню в адресной строке появлялся #player и прочие хвосты. */
      }
    } catch (err) {
      // Некорректные селекторы пропускаются
    }
  });
}

// --- КНОПКА «НАВЕРХ» (ПО ЦЕНТРУ СНИЗУ) ---
function scrollToTop() {
  setActiveNavSection(null);
  smoothScrollTo(0);
}

function updateScrollToTopVisibility() {
  const btn = document.getElementById('scrollToTopBtn');
  if (!btn) return;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  if (scrollY > 260) {
    btn.classList.add('visible');
  } else {
    btn.classList.remove('visible');
  }
}

function initScrollToTop() {
  const btn = document.getElementById('scrollToTopBtn');
  if (!btn) return;

  const arrow = btn.querySelector('.scroll-to-top-arrow');

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    // Возвращаем стрелку в исходное положение: снимаем hover-анимацию на время
    // клика и сразу возвращаем ей transform (иначе на тач/после клика «левитация»
    // стрелки продолжалась бы, пока курсор/нажатие держится на кнопке).
    if (arrow) {
      arrow.classList.remove('nr-arrow-reset');
      void arrow.offsetWidth; // reflow, чтобы перезапустить
      arrow.classList.add('nr-arrow-reset');
      setTimeout(() => arrow.classList.remove('nr-arrow-reset'), 650);
    }
    scrollToTop();
  });
  updateScrollToTopVisibility();
}

/* Переход к блоку страницы из раздела «Обо мне» (и вообще из модалок).
   Раздел к этому моменту уже закрыт, замок прокрутки снят, но Lenis узнаёт об
   этом из MutationObserver — то есть уже ПОСЛЕ текущего вызова, а его start()
   внутри делает reset() и гасит только что запущенную анимацию: раздел
   закрывался, а перехода не было. Поэтому движок будим и пересчитываем сами,
   синхронно и до старта прокрутки. */
function syncScrollEngine() {
  if (window.nrSmoothScroll && typeof window.nrSmoothScroll.resync === 'function') {
    window.nrSmoothScroll.resync();
  }
}

function scrollPageToElement(id, customDuration) {
  syncScrollEngine();
  const el = document.getElementById(id);
  if (!el) return;
  const header = document.querySelector('header');
  const headerH = header ? header.offsetHeight : 72;
  const rect = el.getBoundingClientRect();
  const currentY = window.pageYOffset || document.documentElement.scrollTop || 0;
  smoothScrollTo(Math.max(0, currentY + rect.top - headerH - 18), customDuration || 1.2);
}

function goToFaqItem(faqIndex) {
  closeAboutModal();
  setActiveNavSection('faq');
  if (scrollSpyClickLockTimer) clearTimeout(scrollSpyClickLockTimer);
  scrollSpyClickLockTimer = setTimeout(() => {
    scrollSpyClickLockTimer = null;
    updateActiveNavSection();
  }, 1300);

  // Скролл — после пробуждения движка прокрутки (см. syncScrollEngine выше).
  scrollPageToElement('faq', 1.2);

  const itemKey = `faq-${faqIndex}`;
  setTimeout(() => {
    openFaqItem(itemKey);
  }, 400);
}


function initMixerFaderScroll() {
  const knob = document.getElementById('side-fader-knob');
  const rail = knob ? knob.closest('.fader-rail') : null;
  const strip = document.getElementById('side-mixer-strip');
  if (!knob || !rail) return;

  let isDragging = false;
  let grabOffsetY = 12;

  // Статичные выборки DOM кешируются: на кадрах прокрутки нет лишних запросов и пересчёта раскладки
  const dbLabel = document.getElementById('side-db-label');
  const sideLeds = Array.from(document.querySelectorAll('.side-vu-led'));
  const totalLeds = sideLeds.length;
  const redCount = Math.max(2, Math.round(totalLeds * 0.15));
  const yellowCount = Math.max(4, Math.round(totalLeds * 0.38));

  // Метрики ползунка читаем не на каждом кадре скролла, а при старте и при
  // изменении размеров окна: clientHeight/offsetHeight — это чтение раскладки.
  let maxTravel = 0;
  function measureFader() {
    const railH = rail.clientHeight || 400;
    const knobH = knob.offsetHeight || 24;
    maxTravel = Math.max(0, railH - knobH);
  }
  measureFader();
  window.addEventListener('resize', measureFader, { passive: true });

  // Последнее отрисованное состояние: подсветка 16 светодиодов и текст
  // dB переписываются только когда значение реально изменилось.
  let lastLedActive = -1;
  let lastDbText = '';

  function updateFaderUI(scrollPercent) {
    const topPx = Math.max(0, Math.min(maxTravel, scrollPercent * maxTravel));
    /* Позиция ползунка задаётся CSS-переменной --fader-y, а сам transform
       (translate3d + возможный scale активного состояния) собирается в CSS.
       ПОЧЕМУ НЕ `top`: запись `top` каждый кадр — это смена layout-свойства,
       браузер пересобирает раскладку и перерисовывает элемент (reflow+paint)
       вместо дешёвого сдвига композитного слоя (transform). Плюс на `top`
       висел transition 0.08–0.15s: при перетаскивании ползунок «догонял»
       курсор пружиной и подрагивал. Теперь слой двигается по GPU, а в
       состоянии is-dragging transition и вовсе отключён (см. .fader-knob),
       поэтому ползунок идёт ровно под указателем. */
    knob.style.setProperty('--fader-y', `${topPx}px`);

    const faderLevel = 1 - Math.max(0, Math.min(1, scrollPercent));

    if (dbLabel) {
      let txt;
      if (faderLevel < 0.04) {
        txt = '-INF';
      } else {
        const dbVal = ((faderLevel - 0.75) * 24).toFixed(1);
        txt = `${dbVal > 0 ? '+' : ''}${dbVal}dB`;
      }
      if (txt !== lastDbText) {
        lastDbText = txt;
        dbLabel.textContent = txt;
      }
    }

    if (totalLeds > 0) {
      const activeCount = Math.round(faderLevel * totalLeds);
      if (activeCount === lastLedActive) return;
      lastLedActive = activeCount;

      sideLeds.forEach((led, idx) => {
        const distFromBottom = totalLeds - 1 - idx;
        if (distFromBottom < activeCount) {
          if (idx < redCount) {
            led.className = "side-vu-led vu-led active-red";
          } else if (idx < yellowCount) {
            led.className = "side-vu-led vu-led active-yellow";
          } else {
            led.className = "side-vu-led vu-led active-green";
          }
        } else {
          led.className = "side-vu-led vu-led";
        }
      });
    }
  }

  // Высота документа меняется редко (открылся вопрос в FAQ, показался нижний
  // плеер), поэтому меряем её не в каждом кадре скролла, а по resize и через
  // ResizeObserver. Замер на каждом кадре прокрутки — это принудительная
  // переклейка раскладки всей страницы, поэтому scrollHeight и clientHeight
  // читаются только при resize и изменении содержимого.
  let cachedMaxScroll = 0;
  function measureScrollMetrics() {
    const scrollHeight = document.documentElement.scrollHeight || (document.body && document.body.scrollHeight) || 0;
    const clientHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    cachedMaxScroll = Math.max(1, scrollHeight - clientHeight);
  }
  measureScrollMetrics();
  window.addEventListener('resize', measureScrollMetrics, { passive: true });
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => measureScrollMetrics()).observe(document.documentElement);
  }

  function getScrollMetrics() {
    // window.scrollY читается без переклейки — в отличие от scrollTop у элемента.
    const scrollTop = window.scrollY || 0;
    if (!cachedMaxScroll) measureScrollMetrics();
    return { scrollTop, maxScroll: cachedMaxScroll };
  }

  let isWindowScrollTicking = false;

  function onWindowScroll() {
    if (window.innerWidth < 1024 || isDragging) return;
    if (!isWindowScrollTicking) {
      isWindowScrollTicking = true;
      requestAnimationFrame(() => {
        const { scrollTop, maxScroll } = getScrollMetrics();
        const scrollPercent = Math.min(Math.max(scrollTop / maxScroll, 0), 1);
        updateFaderUI(scrollPercent);
        isWindowScrollTicking = false;
      });
    }
  }

  // Останавливаем активную анимацию плавного скролла (инерцию колеса или
  // GSAP-якорь), иначе её tick дерётся за window.scrollTo с фейдером микшера:
  // страница «откатывается» к старой цели колеса. Вызов дёшев (сброс состояния).
  function stopSmoothMotion() {
    try {
      if (window.nrSmoothScroll && typeof window.nrSmoothScroll.cancel === 'function') {
        window.nrSmoothScroll.cancel();
      }
    } catch (err) {}
    if (typeof activeScrollTween !== 'undefined' && activeScrollTween) {
      try {
        activeScrollTween.kill();
      } catch (err) {}
      activeScrollTween = null;
    }
  }

  function applyScrollFromPointerY(clientY) {
    stopSmoothMotion();
    const railRect = rail.getBoundingClientRect();
    if (railRect.height <= 0) return;

    const knobH = knob.offsetHeight || 24;
    const maxTravel = railRect.height - knobH;
    if (maxTravel <= 0) return;

    const targetTop = Math.max(0, Math.min(maxTravel, clientY - railRect.top - grabOffsetY));
    const ratio = targetTop / maxTravel;

    const { maxScroll } = getScrollMetrics();
    const targetScrollY = ratio * maxScroll;

    window.scrollTo(0, targetScrollY);
    updateFaderUI(ratio);
  }

  function onPointerDown(e) {
    if (window.innerWidth < 1024) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    isDragging = true;
    knob.classList.add('is-dragging');
    document.body.style.userSelect = 'none';
    document.documentElement.style.scrollBehavior = 'auto';

    stopSmoothMotion();

    const knobRect = knob.getBoundingClientRect();
    const knobH = knob.offsetHeight || 24;

    if (e.target === knob || knob.contains(e.target)) {
      grabOffsetY = Math.max(0, Math.min(knobH, e.clientY - knobRect.top));
    } else {
      grabOffsetY = knobH / 2;
    }

    applyScrollFromPointerY(e.clientY);

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('pointercancel', onPointerUp, { passive: false });
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    applyScrollFromPointerY(e.clientY);
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    knob.classList.remove('is-dragging');
    document.body.style.userSelect = '';
    document.documentElement.style.scrollBehavior = '';

    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);

    onWindowScroll();
  }

  rail.addEventListener('pointerdown', onPointerDown);
  if (strip) {
    strip.addEventListener('selectstart', (e) => e.preventDefault());
  }

  window.addEventListener('scroll', onWindowScroll, { passive: true });
  window.addEventListener('resize', onWindowScroll, { passive: true });
  onWindowScroll();
}
