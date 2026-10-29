// ═══════════════════════════════════════════════════════════════════════
// js/gsap-reveal.js — ПОЯВЛЕНИЕ БЛОКОВ ПРИ ПРОКРУТКЕ (GSAP / ScrollTrigger)
// Грузится после: js/state.js. Читает: NR_NO_SCROLL_REVEAL, GSAP и
//         ScrollTrigger из vendor/.
// Владеет: playerTimelines, servicesTimelines, *Revealed, animateScrollBlock.
// Публичные (window): initGsapAnimations, animateScrollBlock, initFaqGsapAnimation,
//         initContactsGsapAnimation.
// Блоки файла:
//   • Каскад появления блоков с поправкой на высоту нижнего плеера
//     (getStickyPlayerHeight).
//   • Таймлайны треков, услуг, FAQ и контактов.
//   • Цены услуг: readPriceTarget читает цель набора из data-target-price в
//     момент старта отсчёта — смена языка попадает в анимацию.
//   • Всплывание героя стартует после заставки — по сигналу из animations.js.
//   • На телефоне и планшете всплытий нет: NR_NO_SCROLL_REVEAL и css/anim/12-reveal.css.
// ═══════════════════════════════════════════════════════════════════════

// --- GSAP-АНИМАЦИИ: КАСКАД ПРИВЯЗАН К ПОЗИЦИИ, СМЕЩЕНИЕ ПОД НИЖНИЙ ПУЛЬТ ---
function getStickyPlayerHeight() {
  const bar = document.getElementById('stickyPlayerBar');
  const isActive = bar && (bar.classList.contains('active') || document.body.classList.contains('has-sticky-player'));
  if (isActive) {
    const h = bar.offsetHeight;
    if (h && h > 0) return h;
    return window.innerWidth >= 640 ? 96 : 84;
  }
  return 0;
}

function computeDynamicStart(percentOrStr = 86) {
  let percent = 86;
  if (typeof percentOrStr === 'number') {
    percent = percentOrStr;
  } else if (typeof percentOrStr === 'string') {
    const m = percentOrStr.match(/(\d+)%/);
    if (m) {
      percent = parseFloat(m[1]);
    }
  }

  return () => {
    const bottomBarHeight = getStickyPlayerHeight();
    if (bottomBarHeight > 0) {
      // Видимая область над нижним пультом плеера
      const effectiveViewportHeight = window.innerHeight - bottomBarHeight;
      const triggerY = Math.round(effectiveViewportHeight * (percent / 100));
      return `top ${triggerY}px`;
    }
    return `top ${percent}%`;
  };
}

function animateScrollBlock(selectorOrEls, options = {}) {
  const els = typeof selectorOrEls === 'string' ? document.querySelectorAll(selectorOrEls) : selectorOrEls;
  if (!els || els.length === 0) return;

  // Телефон и планшет: блоки не прячем и не анимируем — они уже на месте.
  if (NR_NO_SCROLL_REVEAL) return;

  const yVal = options.y !== undefined ? options.y : 22;
  const duration = options.duration || 0.48;
  const rawStart = options.start || 'top 86%';
  const dynamicStart = typeof rawStart === 'function' ? rawStart : computeDynamicStart(rawStart);
  const ease = options.ease || 'power2.out';
  const stagger = options.stagger || 0;
  const delay = options.delay || 0;
  const trigger = options.trigger || null;
  /* Необязательное: снять инлайновые свойства после появления. Нужно там, где
     GSAP-твин идёт по ОБЁРТКЕ кнопки (transform родителя создал бы отдельный
     композитный слой — текст кнопки «сереет» на Windows). */
  const clearProps = options.clearProps || undefined;

  els.forEach((el, idx) => {
    // Прежние триггеры этого элемента снимаются
    ScrollTrigger.getAll().forEach(st => {
      if (st.vars && st.vars.trigger === el) {
        st.kill();
      }
    });

    // По умолчанию строго закрыто
    gsap.set(el, { y: yVal, opacity: 0 });

    const trigEl = trigger ? (typeof trigger === 'string' ? document.querySelector(trigger) : trigger) : el;
    if (!trigEl) return;

    const itemDelay = delay + (stagger > 0 ? idx * stagger : 0);

    // Появление один раз: элемент всплывает при пересечении start снизу
    // и остаётся на месте — при прокрутке вверх ничего не прячется.
    gsap.fromTo(
      el,
      { y: yVal, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: duration,
        delay: itemDelay,
        ease: ease,
        overwrite: 'auto',
        clearProps: clearProps,
        scrollTrigger: {
          trigger: trigEl,
          start: dynamicStart,
          end: 'bottom top',
          toggleActions: 'play none none none'
        }
      }
    );
  });
}

let playerTimelines = [];
let playerTracksTimeline = null;
// Плеер уже всплыл: второй раз карточки не прячем и не анимируем
// (перерисовка при смене языка, resize, листание страниц).
let playerRevealed = false;

function initPlayerGsapAnimation() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  // Телефон и планшет: секция не прячется и не всплывает — всё видно сразу.
  if (NR_NO_SCROLL_REVEAL) { playerRevealed = true; return; }

  const section = document.getElementById('player');
  if (!section) return;

  const sectionHeader = section.querySelector('.text-center');
  // Жанровых фильтров нет — анимируем только пагинацию и карточки треков.
  const paginationContainer = section.querySelector('#playerContentContainer .border-t');
  // Переключатель языка примеров («На английском / На русском»): статичная
  // разметка внутри #playerContentContainer, поэтому анимируется вместе с
  // заголовком — иначе он просто стоит на экране и «не всплывает».
  const langSwitcher = document.getElementById('trackLangSwitcher');

  // Прошлые таймлайны и триггеры плеера снимаются
  if (playerTimelines && playerTimelines.length) {
    playerTimelines.forEach(tl => {
      try { tl.kill(); } catch (e) {}
    });
    playerTimelines = [];
  }

  ScrollTrigger.getAll().forEach(st => {
    if (st.vars && st.vars.trigger) {
      const tr = st.vars.trigger;
      if (
        tr === '#player' ||
        tr === '#playerContentContainer' ||
        tr === '#player .text-center' ||
        tr === '#trackListContainer' ||
        (typeof tr === 'object' && (tr === section || (tr.closest && tr.closest('#player'))))
      ) {
        st.kill();
      }
    }
  });

  const trackContainer = document.getElementById('trackListContainer');
  const trackCards = trackContainer ? trackContainer.querySelectorAll(':scope > *') : [];

  // Учитывается системная настройка «уменьшить движение»
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (sectionHeader) gsap.set(sectionHeader, { opacity: 1, y: 0 });
    if (langSwitcher) gsap.set(langSwitcher, { opacity: 1, y: 0 });
    trackCards.forEach(card => gsap.set(card, { opacity: 1, y: 0 }));
    if (paginationContainer) gsap.set(paginationContainer, { opacity: 1, y: 0 });
    return;
  }

  // Элементы вне экрана скрываются заранее
  const vh = window.innerHeight || 800;
  const secRect = section.getBoundingClientRect();
  const isPlayerInView = secRect.top < vh * 0.88 && secRect.bottom > 0;

  if (!isPlayerInView) {
    if (sectionHeader) gsap.set(sectionHeader, { y: 24, opacity: 0 });
    if (langSwitcher) gsap.set(langSwitcher, { y: 18, opacity: 0 });
    trackCards.forEach(card => gsap.set(card, { y: 26, opacity: 0 }));
    if (paginationContainer) gsap.set(paginationContainer, { y: 16, opacity: 0 });
  }

  // 1. SECTION HEADER TIMELINE (Title "Слушай разницу")
  // Всплывает один раз при пересечении 88% и больше не прячется.
  if (sectionHeader) {
    const headerTl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionHeader,
        start: computeDynamicStart(88),
        end: 'bottom top',
        toggleActions: 'play none none none',
        onEnter: () => {
          playerRevealed = true;
          headerTl.timeScale(1.0).play();
        }
      }
    });

    headerTl.fromTo(
      sectionHeader,
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' },
      0
    );

    if (langSwitcher) {
      // Переключатель языка примеров всплывает сразу за заголовком.
      headerTl.fromTo(
        langSwitcher,
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' },
        0.12
      );
    }

    playerTimelines.push(headerTl);
  }

  // 2. ТАЙМЛАЙН СЕТКИ ТРЕКОВ (карточки с обложкой и кнопкой play)
  // Всплывает один раз при пересечении 83%.
  initPlayerTrackCardsTimeline(true);

  // 3. ТАЙМЛАЙН ЛИСТАНИЯ (кнопки назад/вперёд, счётчик и точки)
  // Появление один раз при пересечении 80%, без скрытия при прокрутке вверх.
  // Если страница одна, блок пагинации скрыт (см. renderTrackList) — анимировать нечего.
  if (paginationContainer && paginationContainer.style.display !== 'none') {
    const paginationTl = gsap.timeline({
      scrollTrigger: {
        trigger: paginationContainer,
        start: computeDynamicStart(80),
        end: 'bottom top',
        toggleActions: 'play none none none',
        onEnter: () => {
          playerRevealed = true;
          paginationTl.timeScale(1.0).play();
        }
      }
    });

    paginationTl.fromTo(
      paginationContainer,
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' },
      0
    );
    playerTimelines.push(paginationTl);
  }

  /* Кнопка «Заказать» стоит ВНЕ #playerContentContainer, поэтому ни в одну
     выборку выше не попадала и появлялась без анимации. Анимируем ОБЁРТКУ:
     у самой кнопки занят transform (пульс .nr-calc-cta и hover-подъём), а
     инлайновый transform родителя к тому же промоутил бы надпись в отдельный
     слой. Массив — потому что animateScrollBlock работает через forEach. */
  const contactCta = document.getElementById('playerContactCta');
  if (contactCta) {
    /* Если кнопка уже на экране (переинициализация при смене языка), заново её
       не прячем — иначе она мигнёт. Тот же порог, что у самого триггера. */
    const ctaRect = contactCta.getBoundingClientRect();
    const ctaInView = ctaRect.top < (window.innerHeight || 800) * 0.84;
    if (!ctaInView) {
      animateScrollBlock([contactCta], {
        y: 16, duration: 0.5, start: 84, clearProps: 'transform,opacity'
      });
    }
  }
}

function initPlayerTrackCardsTimeline(initialPreHide = true, alreadyAnimated = false) {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  const trackContainer = document.getElementById('trackListContainer');
  if (!trackContainer) return;

  const trackCards = trackContainer.querySelectorAll(':scope > *');
  if (!trackCards.length) return;

  // Секция уже всплыла — карточки остаются на месте (перерисовка списка,
  // смена языка, resize не запускают появление заново).
  if (playerRevealed) return;

  // Телефон и планшет: карточки треков не прячем и не анимируем.
  if (NR_NO_SCROLL_REVEAL) { playerRevealed = true; return; }

  if (playerTracksTimeline) {
    try { playerTracksTimeline.kill(); } catch (e) {}
    playerTracksTimeline = null;
  }

  ScrollTrigger.getAll().forEach(st => {
    if (st.vars && st.vars.trigger === '#trackListContainer') {
      st.kill();
    }
  });

  const rect = trackContainer.getBoundingClientRect();
  const vh = window.innerHeight || 800;
  const isAlreadyInView = rect.top < vh * 0.83 && rect.bottom > 0;

  if (initialPreHide && !isAlreadyInView && !alreadyAnimated) {
    gsap.set(trackCards, { y: 26, opacity: 0 });
  }

  playerTracksTimeline = gsap.timeline({
    scrollTrigger: {
      trigger: '#trackListContainer',
      start: computeDynamicStart(83),
      end: 'bottom top',
      toggleActions: 'play none none none',
      onEnter: () => {
        playerRevealed = true;
        playerTracksTimeline.timeScale(1.0).play();
      }
    }
  });

  playerTracksTimeline.fromTo(
    trackCards,
    { y: 26, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.45, stagger: 0.07, ease: 'power2.out' },
    0
  );

  if (isAlreadyInView || alreadyAnimated) {
    playerTracksTimeline.progress(1);
    playerRevealed = true;
  }

  if (playerTimelines && !playerTimelines.includes(playerTracksTimeline)) {
    playerTimelines.push(playerTracksTimeline);
  }
}

/* Цена карточки услуги для анимации набора: текст целиком, число в нём и
   разделитель разрядов. Источник — атрибут data-target-price: его переписывает
   js/services.js → renderServices при смене языка, поэтому прочитанная здесь
   цель всегда в валюте текущего языка. */
function readPriceTarget(priceEl) {
  if (!priceEl) return null;

  const targetText = priceEl.getAttribute('data-target-price') || priceEl.textContent;
  const match = targetText.match(/\d[\d\s\u00A0.,]*\d|\d/);
  if (!match) return null;

  const raw = match[0];
  const sep = /[\s\u00A0]/.test(raw) ? raw.match(/[\s\u00A0]/)[0] : (raw.indexOf(',') > -1 ? ',' : '');
  const targetVal = parseInt(raw.replace(/[^\d]/g, ''), 10);
  if (isNaN(targetVal) || targetVal <= 0) return null;

  return {
    el: priceEl,
    targetText: targetText,
    raw: raw,
    sep: sep,
    targetVal: targetVal
  };
}

let servicesTimelines = [];
// Секция услуг уже всплыла: при перерисовке (смена языка) повторно не прячем.
let servicesRevealed = false;

function initServicesGsapAnimation() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  /* Телефон и планшет: карточки услуг и их содержимое не прячем — всё выведено
     сразу, цены остаются настоящими (счётчик ниже их обнулял бы). */
  if (NR_NO_SCROLL_REVEAL) { servicesRevealed = true; return; }

  const section = document.getElementById('services');
  if (!section) return;

  const sectionHeader = section.querySelector('.text-center');
  const cards = document.querySelectorAll('#servicesContainer > *');
  if (!cards.length) return;

  if (servicesRevealed) return;

  // На телефоне карточки услуг — карусель с coverflow: их transform и opacity
  // принадлежат updateServicesDots(). GSAP здесь анимирует только содержимое,
  // иначе его clearProps затирал позиции coverflow и карточки стояли
  // «неправильно» до первого пролистывания карусели.
  const mobileCarousel = window.innerWidth < 640;

  // Прошлые таймлайны и триггеры услуг снимаются
  if (servicesTimelines && servicesTimelines.length) {
    servicesTimelines.forEach(tl => {
      try {
        if (tl.scrollTrigger) tl.scrollTrigger.kill();
        tl.kill();
      } catch (e) {}
    });
    servicesTimelines = [];
  }

  ScrollTrigger.getAll().forEach(st => {
    if (st.vars && st.vars.trigger) {
      const tr = st.vars.trigger;
      if (
        tr === '#services' ||
        tr === '#servicesContainer' ||
        tr === '#services .text-center' ||
        tr === '.service-card-bottom' ||
        tr === '.service-card-features' ||
        (typeof tr === 'object' && (tr === section || (tr.closest && tr.closest('#services'))))
      ) {
        st.kill();
      }
    }
  });

  // Числа цен извлекаются для анимации набора
  const priceData = [];
  cards.forEach(card => {
    const target = readPriceTarget(card.querySelector('.service-card-price'));
    if (target) priceData.push(target);
  });

  // Учитывается системная настройка «уменьшить движение»
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (sectionHeader) gsap.set(sectionHeader, { opacity: 1, y: 0 });
    cards.forEach(card => {
      if (!mobileCarousel) gsap.set(card, { opacity: 1, y: 0 });
      gsap.set(card.querySelectorAll('.service-feature-item'), { opacity: 1, x: 0, y: 0 });
      gsap.set(card.querySelectorAll('.service-check-icon'), { opacity: 1, scale: 1 });
      gsap.set(card.querySelectorAll('.service-card-top, .service-card-bottom, .service-card-divider, .service-card-pricing, .service-card-order-btn, .service-card-price-group'), { opacity: 1, y: 0, scaleX: 1 });
    });
    priceData.forEach(p => { p.el.textContent = p.targetText; });
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ПОЯВЛЕНИЕ КАРТОЧЕК УСЛУГ — тем же шаблоном, что в разделах «Вопросы» и
  // «Контакты»:
  //
  //   gsap.fromTo(el, { y, opacity: 0 } → { y: 0, opacity: 1, overwrite: 'auto',
  //     scrollTrigger: { trigger: el, end: 'bottom top',
  //                      toggleActions: 'play none none none' } })
  //
  // `play … none` — появление строго один раз: карточка всплывает при
  // прокрутке вниз и остаётся на месте, когда листаешь обратно.
  //
  // На каждую карточку вешаем ОДИН таймлайн (оболочка + содержимое вместе):
  // два отдельных триггера на одной карточке срабатывают не одновременно, и
  // карточка «дёргается».
  //
  // На телефоне оболочки карточек НЕ трогаем: их transform/opacity принадлежат
  // coverflow из updateServicesDots(). Там всплывает только содержимое карточек.

  // Соберём «внутренности» карточек, которые можно мягко анимировать на ЛЮБОЙ
  // ширине экрана (оболочки на телефоне исключаем из-за coverflow).
  const cardInnerSelectors = [
    '.service-card-top',
    '.service-feature-item',
    '.service-check-icon',
    '.service-card-back-top',
    '.service-card-back-title',
    '.service-card-about',
    '.service-card-includes-title',
    '.service-card-back-features',
    '.service-card-bottom',
    '.service-card-divider',
    '.service-card-price-group',
    '.service-card-order-btn'
  ];

  // Если элемент уже на экране (например, переключили язык, а секция перед
  // глазами) — показываем его сразу, без повторного «проявления».
  const isAlreadyInView = (el) => {
    if (!el || typeof el.getBoundingClientRect !== 'function') return false;
    return el.getBoundingClientRect().top < window.innerHeight * 0.88;
  };

  // Снимаем твины прошлого запуска и ставим стартовое (скрытое) состояние.
  cards.forEach(card => {
    gsap.killTweensOf(card);
    if (!mobileCarousel) gsap.set(card, { y: 20, opacity: 0 });

    const innerEls = card.querySelectorAll(cardInnerSelectors.join(','));
    if (innerEls.length) {
      gsap.killTweensOf(innerEls);
      gsap.set(innerEls, { opacity: 0 });
    }
  });

  if (sectionHeader) {
    gsap.killTweensOf(sectionHeader);
    gsap.set(sectionHeader, { y: 20, opacity: 0 });
  }

  // Цены стартуют с нуля, чтобы набор шёл без рывка
  priceData.forEach(p => {
    p.el.textContent = p.targetText.replace(p.raw, '0');
  });

  const bottomContainer = document.querySelector('#servicesContainer .service-card-bottom') || '#servicesContainer';

  // Заголовок секции — как в остальных разделах: появление один раз.
  if (sectionHeader) {
    const headerTl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionHeader,
        start: computeDynamicStart(88),
        end: 'bottom top',
        toggleActions: 'play none none none',
        onEnter: () => { servicesRevealed = true; }
      }
    });

    headerTl.fromTo(
      sectionHeader,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', overwrite: 'auto' },
      0
    );

    if (isAlreadyInView(sectionHeader)) {
      headerTl.progress(1);
      servicesRevealed = true;
    }
    servicesTimelines.push(headerTl);
  }

  // Карточки: на планшете/десктопе каждая всплывает отдельно по мере скролла
  // (чтобы появление второй и третьей услуги было видно), на телефоне —
  // всплывает только содержимое, оболочку не трогаем (coverflow).
  cards.forEach((card, index) => {
    // Лёгкая «волна»: карточки, стоящие рядом в одной строке сетки, срабатывают
    // одновременно, поэтому вторая и третья получают небольшое отставание —
    // так появление читается, как в «Контактах» (там delay: idx * 0.05).
    const wave = mobileCarousel ? 0 : Math.min(index, 2) * 0.07;
    const innerEls = card.querySelectorAll(cardInnerSelectors.join(','));

    const cardTl = gsap.timeline({
      scrollTrigger: {
        trigger: card,
        start: computeDynamicStart(86),
        end: 'bottom top',
        toggleActions: 'play none none none'
      }
    });

    if (!mobileCarousel) {
      cardTl.fromTo(
        card,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', overwrite: 'auto' },
        wave
      );
    }

    const innerStart = wave + (mobileCarousel ? 0 : 0.04);

    // Пункты списка услуг («галочки») идут ОТДЕЛЬНЫМ каскадом с крупным шагом:
    // список читается строка за строкой сверху вниз (общая волна содержимого
    // их пропускает, иначе на одном элементе было бы два твина).
    const featureItems = card.querySelectorAll('.service-feature-item');
    const checkIcons = card.querySelectorAll('.service-check-icon');

    // Пунктов в разметке ВОСЕМЬ: по четыре на лицевой и на обратной стороне.
    // Шаг каскада считаем по лицевым — иначе разделитель и цена ждали бы
    // невидимые строки оборота и всплывали бы на полсекунды позже нужного.
    const frontFace = card.querySelector('.service-card-face--front');
    const frontFeatures = frontFace ? frontFace.querySelectorAll('.service-feature-item') : [];
    const frontListSpan = 0.28 + ((frontFeatures.length || 4) - 1) * 0.06;

    // Последовательность появления содержимого карточки:
    // верх → список построчно → разделитель → цена → кнопка «Заказать».
    const topStart = innerStart;
    const listStart = topStart + 0.08;
    const dividerStart = listStart + frontListSpan;
    const priceStart = dividerStart + 0.04;
    const orderStart = priceStart + 0.04;

    const cardTop = card.querySelector('.service-card-top');
    /* Разделитель есть на ОБЕИХ сторонах карточки: берём все, иначе тот, что на
       обороте, остался бы прозрачным (общий фейд его пропускает). */
    const dividers = card.querySelectorAll('.service-card-divider');
    const priceGroup = card.querySelector('.service-card-price-group');
    const orderBtn = card.querySelector('.service-card-order-btn');

    // Всё остальное (в основном оборот карточки) — мягкий фейд:
    // его видно только после переворота, поэтому порядок здесь не важен.
    const otherInnerEls = [];
    innerEls.forEach(el => {
      if (el.classList.contains('service-feature-item') ||
          el.classList.contains('service-check-icon') ||
          el.classList.contains('service-card-divider') ||
          el.classList.contains('service-card-price-group') ||
          el.classList.contains('service-card-order-btn') ||
          el === cardTop) return;
      otherInnerEls.push(el);
    });

    if (otherInnerEls.length) {
      cardTl.fromTo(
        otherInnerEls,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, stagger: 0.03, ease: 'power2.out', overwrite: 'auto' },
        innerStart
      );
    }

    // 1) Заголовок и описание — подъём на 16px.
    if (cardTop) {
      cardTl.fromTo(
        cardTop,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto' },
        topStart
      );
    }

    // 2) Список услуг — построчно.
    if (featureItems.length) {
      cardTl.fromTo(
        featureItems,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.28, stagger: 0.06, ease: 'power2.out', overwrite: 'auto' },
        listStart
      );

      if (checkIcons.length) {
        // Галочка «прощёлкивает» сразу после своей строки — чуть позже текста.
        cardTl.fromTo(
          checkIcons,
          { opacity: 0, scale: 0.4 },
          { opacity: 1, scale: 1, duration: 0.26, stagger: 0.06, ease: 'back.out(2.5)', overwrite: 'auto' },
          listStart + 0.06
        );
      }
    }

    // 3) Разделитель «прочерчивается» слева направо, затем цена.
    if (dividers.length) {
      cardTl.fromTo(
        dividers,
        { opacity: 0, scaleX: 0, transformOrigin: 'left center' },
        { opacity: 1, scaleX: 1, duration: 0.3, ease: 'power2.out', overwrite: 'auto' },
        dividerStart
      );
    }

    if (priceGroup) {
      cardTl.fromTo(
        priceGroup,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto' },
        priceStart
      );
    }

    // 4) Кнопка «Заказать».
    if (orderBtn) {
      cardTl.fromTo(
        orderBtn,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto' },
        orderStart
      );
    }

    if (isAlreadyInView(card)) cardTl.progress(1);
    servicesTimelines.push(cardTl);
  });

  // Цены: мягкий count-up при появлении (без реверса/скачков).
  let priceCountTween = null;
  const counterProxy = { progress: 0 };

  function startPriceCountUp() {
    if (priceCountTween) {
      priceCountTween.kill();
      priceCountTween = null;
    }

    /* Цель берётся из DOM в момент старта, а не из снимка priceData: между
       сбором снимка и этим вызовом язык могли сменить, и js/services.js →
       renderServices уже положил в data-target-price другую валюту. Отсчёт по
       старому снимку вернул бы в карточку прежнюю цену. */
    priceData.length = 0;
    document.querySelectorAll('#servicesContainer .service-card-price').forEach(priceEl => {
      const target = readPriceTarget(priceEl);
      if (target) priceData.push(target);
    });
    if (!priceData.length) return;

    counterProxy.progress = 0;
    priceCountTween = gsap.to(counterProxy, {
      progress: 1,
      duration: 1.25,
      delay: 0.08,
      ease: 'power2.out',
      onUpdate: () => {
        const pr = counterProxy.progress;
        priceData.forEach(p => {
          // Язык сменили, пока идёт набор: в data-target-price уже новая цена —
          // перечитываем цель, иначе счётчик допишет старую валюту.
          const liveTarget = p.el.getAttribute('data-target-price');
          if (liveTarget !== null && liveTarget !== p.targetText) {
            const target = readPriceTarget(p.el);
            if (target) Object.assign(p, target);
          }

          if (pr <= 0.01) {
            p.el.textContent = p.targetText.replace(p.raw, '0');
          } else if (pr >= 0.99) {
            p.el.textContent = p.targetText;
          } else {
            const currentVal = Math.round(p.targetVal * pr);
            const formatted = p.sep === ','
              ? String(currentVal).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
              : String(currentVal).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
            p.el.textContent = p.targetText.replace(p.raw, formatted);
          }
        });
      },
      onComplete: () => {
        priceData.forEach(p => {
          p.el.textContent = p.targetText;
        });
      }
    });
  }

  // Count-up цен запускаем отдельным триггером (без повторного фейда
  // bottomContainer — его opacity уже управляется общим мягким светом выше).
  // Порог 100% — нижняя видимая кромка (при активной панели плеера считается
  // над ней): отсчёт стартует ровно в момент появления блока цены на экране.
  // При прежних 80% блок успевал подняться на 20% высоты экрана и стоял нулём.
  if (priceData.length) {
    ScrollTrigger.create({
      trigger: bottomContainer,
      start: computeDynamicStart(100),
      once: true,
      onEnter: startPriceCountUp
    });
  }

  /* Кнопка «Рассчитать стоимость услуг» стоит ВНЕ #servicesContainer — её не
     брала ни одна выборка выше, поэтому она появлялась без анимации. Как и в
     «Примерах», анимируем ОБЁРТКУ (у самой кнопки занят transform), а после
     появления снимаем инлайновые свойства. Порог тот же, что у заголовка
     секции, — кнопка «догоняет» раздел. */
  const calcCta = document.getElementById('servicesCalcCta');
  if (calcCta && !isAlreadyInView(calcCta)) {
    animateScrollBlock([calcCta], {
      y: 16, duration: 0.5, start: 88, clearProps: 'transform,opacity'
    });
  }
}

// Вопросы FAQ уже всплыли: при перерисовке (смена языка) повторно не прячем.
let faqRevealed = false;

function initFaqGsapAnimation() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  // Телефон и планшет: вопросы не прячем — раздел выведен сразу.
  if (NR_NO_SCROLL_REVEAL) { faqRevealed = true; return; }

  const faqItems = document.querySelectorAll('#faqContainer > *');
  if (!faqItems.length) return;

  if (faqRevealed) return;

  // Прежние триггеры пунктов FAQ снимаются
  ScrollTrigger.getAll().forEach(st => {
    if (st.vars && st.vars.trigger) {
      const tr = st.vars.trigger;
      if (typeof tr === 'object' && tr.closest && tr.closest('#faqContainer')) {
        st.kill();
      }
    }
  });

  // Каждый вопрос FAQ — независимый объект, привязанный к своей позиции на экране
  faqItems.forEach((item) => {
    // По умолчанию строго закрыто
    gsap.set(item, { y: 20, opacity: 0 });

    gsap.fromTo(
      item,
      { y: 20, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.45,
        ease: 'power2.out',
        overwrite: 'auto',
        scrollTrigger: {
          trigger: item,
          start: computeDynamicStart(86),
          end: 'bottom top',
          toggleActions: 'play none none none',
          onEnter: () => { faqRevealed = true; }
        }
      }
    );
  });
}

function initContactsGsapAnimation() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  // Телефон и планшет: плитки контактов не прячем — раздел выведен сразу.
  if (NR_NO_SCROLL_REVEAL) return;

  const contactButtons = document.querySelectorAll('#contactsGrid > *');
  if (!contactButtons.length) return;

  ScrollTrigger.getAll().forEach(st => {
    if (st.vars && st.vars.trigger) {
      const tr = st.vars.trigger;
      if (typeof tr === 'object' && tr.closest && tr.closest('#contactsGrid')) {
        st.kill();
      } else if (tr === '#contactsGrid') {
        st.kill();
      }
    }
  });

  contactButtons.forEach((btn, idx) => {
    gsap.set(btn, { y: 18, opacity: 0 });

    gsap.fromTo(
      btn,
      { y: 18, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.42,
        delay: idx * 0.05,
        ease: 'power2.out',
        overwrite: 'auto',
        scrollTrigger: {
          trigger: '#contactsGrid',
          start: computeDynamicStart(85),
          end: 'bottom top',
          toggleActions: 'play none none none'
        }
      }
    );
  });
}

function initGsapAnimations() {
  if (typeof gsap === 'undefined') return;

  if (typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    /* ПЛАШКА АДРЕСНОЙ СТРОКИ НЕ ДОЛЖНА ПЕРЕСЧИТЫВАТЬ ТРИГГЕРЫ.
       На телефоне при первом свайпе плашка браузера уезжает вверх, высота окна
       меняется на ~60–120px, и ScrollTrigger по умолчанию считает это ресайзом:
       делает полный refresh — пересчёт start/end у всех триггеров и повторную
       установку начальных значений. Работа разовая, но приходится ровно на
       кадр первого жеста после холодного старта браузера (после F5 код и
       раскладка уже прогреты, поэтому рывка там нет). Пока главный поток занят
       пересчётом, прокрутка копит дельту и затем отдаёт её одним скачком —
       тем большим, чем сильнее свайп. ignoreMobileResize отбрасывает такие
       «ресайзы», где ширина не менялась и высота изменилась меньше чем на 25%
       экрана — то есть именно появление/скрытие плашки. Настоящий поворот
       экрана и смена ширины по-прежнему пересчитываются. */
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  /* Hero Section: всплывание запускается НЕ здесь, а в момент, когда начинает
     гаснуть заставка #nr-boot (animations.js → hideBoot → playHeroIntro).
     Раньше анимация стартовала сразу на DOMContentLoaded и целиком доигрывала
     под непрозрачным оверлеем: к его исчезновению герой уже стоял на месте.
     Начальное состояние ставим сразу — оно живёт под заставкой, поэтому
     вспышки открытого героя нет. */
  gsap.set('#hero .space-y-6 > *', { y: 24, opacity: 0 });
  gsap.set('#hero .hero-mask-container', { y: 20, opacity: 0 });

  const heroIntro = gsap.timeline({ paused: true });
  heroIntro.to(
    '#hero .space-y-6 > *',
    {
      y: 0,
      opacity: 1,
      duration: 0.85,
      stagger: 0.08,
      ease: 'power2.out'
    },
    0
  );
  heroIntro.to(
    '#hero .hero-mask-container',
    {
      y: 0,
      opacity: 1,
      duration: 0.85,
      ease: 'power2.out'
    },
    0
  );

  // Заставка зовёт это, когда начала гаснуть. Второй раз не играем.
  let heroIntroPlayed = false;
  window.nrPlayHeroIntro = () => {
    if (heroIntroPlayed) return;
    heroIntroPlayed = true;
    heroIntro.play();
  };
  // Страховка: заставка так и не запустила вход (animations.js не выполнился и
  // сработала inline-страховка в разметке) — иначе герой остался бы невидимым.
  // Пока заставка ещё держит экран, вход запустит она сама: играть анимацию под
  // непрозрачным оверлеем незачем.
  setTimeout(() => {
    const boot = document.getElementById('nr-boot');
    if (boot && !boot.classList.contains('nr-boot-hide') &&
        !boot.classList.contains('nr-boot-done') && boot.style.display !== 'none') return;
    document.getElementById('hero')?.classList.remove('nr-title-hold');
    window.nrPlayHeroIntro();
  }, 5000);

  // 1. Плеер: единая последовательность по прокрутке (заголовок → карточки треков → листание)
  initPlayerGsapAnimation();

  // 2. Услуги: единая последовательность (заголовок → карточки → текст → галочки → цены и кнопки)
  initServicesGsapAnimation();

  // 3. FAQ: заголовок на 88% экрана, каждый вопрос — по своей позиции на 86%
  animateScrollBlock('#faq .text-center', { duration: 0.5, y: 20, start: 'top 88%' });
  initFaqGsapAnimation();

  // 4. Контакты: заголовок на 88%, корпус-стойка на 85%, каскад кнопок на 85%
  animateScrollBlock('#contacts .text-center', { duration: 0.5, y: 20, start: 'top 88%' });
  animateScrollBlock('#contacts .rack-card', { duration: 0.5, y: 18, start: 'top 85%' });
  initContactsGsapAnimation();

  // 5. Подвал: раскрывается на 92%
  animateScrollBlock('footer', { y: 16, duration: 0.5, start: 'top 92%' });

  // 6. Reviews Section: заголовок раздела появляется первым.
  //    Сами ряды лент поднимаются отдельно — animations.js → initReveal.
  animateScrollBlock('#reviews .text-center', { duration: 0.5, y: 20, start: 'top 88%' });
}

