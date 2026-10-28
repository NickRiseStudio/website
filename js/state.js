// ═══════════════════════════════════════════════════════════════════════
// js/state.js — ОБЩЕЕ СОСТОЯНИЕ, ОБЩИЕ ПОМОЩНИКИ, БУТСТРАП
// Грузится ПЕРВЫМ: остальные файлы читают его let/const (иначе TDZ).
// Требует: config.js, smoothscroll-nr.js и inline-настройку Lenis (index.html).
// Владеет состоянием, которое читают ВСЕ остальные файлы:
//   currentLang, activeTrackLang, activeTrackId, currentTrackPage,
//   trackAudioMap, audioCacheStampValue, suppressCardEnterAnimation.
// Блоки файла:
//   1. Переменные состояния.
//   2. Данные аудиодвижка (trackAudioMap, штамп обхода кэша).
//   3. Общие помощники: scheduleScrollTriggerRefresh (ScrollTrigger.refresh()
//      схлопнут в один вызов), bindTapControl (тап на телефоне).
//   4. Бутстрап: DOMContentLoaded → init*(), load → refresh, document.fonts.ready.
// ═══════════════════════════════════════════════════════════════════════

// ── 1. ПЕРЕМЕННЫЕ СОСТОЯНИЯ ──────────────────────────────────────────────
let currentLang = 'en';
let activeTrackLang = 'en';
let activeTrackId = null;
let currentTrackPage = 0;
// Во время свайп-перехода лентой треков управляет свайп-режим
// (enterSwipeMode/settleSwipe/exitSwipeMode), поэтому штатная «вкатка снизу»
// в renderTrackList() на этот момент подавляется, чтобы не было двух анимаций.
let suppressCardEnterAnimation = false;

// ── 2. ДАННЫЕ АУДИОДВИЖКА ────────────────────────────────────────────────
const trackAudioMap = {}; // { trackId: { audioA, audioB, source: 'before'|'after', volume: 0.9 } }
// Штамп для обхода кэша аудио (см. audioUrl): один на всю сессию страницы,
// чтобы адреса внутри одного захода не расходились.
let audioCacheStampValue = '';

// ── 3. ОБЩИЕ ПОМОЩНИКИ ───────────────────────────────────────────────────
/* ScrollTrigger.refresh() — полный пересчёт позиций всех триггеров, то есть
   принудительная переклейка раскладки всей страницы. Вызовов на старте много
   (load, шрифты, карточки услуг и треков, показ плеера), и несколько подряд
   дают заметные «залипания» на телефоне. Поэтому они схлопываются в один:
   если пересчёт уже запланирован, повторный запрос игнорируется. */
let scrollTriggerRefreshTimer = 0;
function scheduleScrollTriggerRefresh(delay) {
  if (typeof ScrollTrigger === 'undefined') return;
  if (scrollTriggerRefreshTimer) return;
  scrollTriggerRefreshTimer = setTimeout(() => {
    scrollTriggerRefreshTimer = 0;
    if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
    /* Раскладка/высота страницы изменились (смена языка, раскрытие FAQ и
       отзывов, появление плеера, рост карточек) — значит устарели и кэши
       геометрии scroll-spy. Обновляем их здесь же, вне кадра прокрутки, чтобы
       подсветка навигации оставалась точной, а сам скролл не читал раскладку. */
    if (typeof refreshScrollSpyAnchors === 'function') refreshScrollSpyAnchors();
  }, delay || 0);
}

/* bindTapControl — тап по кнопке на телефоне.
   Android-браузеры (Chrome, Яндекс) не присылают click, если страница под
   пальцем ещё ехала по инерции: первый тап тратится на её остановку, и это
   выглядит как «кнопка не работает» (второй срабатывает). Сами касания при
   этом приходят всегда, поэтому тап разбираем на touchend и, если click так
   и не пришёл, выполняем действие сами через TAP_FALLBACK_DELAY. Если click
   пришёл — страховка снимается: действие выполняется РОВНО ОДИН раз.
   Используется там, где листаются треки: переключатель языка, точки, стрелки. */
const TAP_FALLBACK_DELAY = 350; // мс: сколько ждём click, прежде чем сработать самим
const TAP_FALLBACK_GUARD = 600; // мс: окно, в котором поздний click уже не повторяет действие
const TAP_MAX_MS = 700;         // мс: дольше — это удержание, а не тап

/* Телефон и планшет (<1024px): появления блоков при прокрутке выключены —
   всё содержимое разделов выведено сразу, без всплытий. Медиазапрос тот же,
   что в css/anim/12-reveal.css и в animations.js (NO_REVEAL), поэтому JS и
   CSS не разойдутся. ПК (от 1024px) не затрагивается. */
const NR_NO_SCROLL_REVEAL = window.matchMedia('(max-width: 1023.98px)').matches;

/* opts.ignore — селектор вложенного элемента со своим действием (например,
   кнопка play внутри карточки): такие касания сюда не относим, иначе одно
   нажатие выполнилось бы дважды. */
function bindTapControl(el, handler, opts) {
  if (!el) return;
  const ignore = (opts && opts.ignore) || '';
  const isIgnored = (target) =>
    !!(ignore && target && target.closest && target.closest(ignore));

  let startX = 0;
  let startY = 0;
  let startScrollY = 0;
  let startAt = 0;
  let fallbackTimer = 0;
  let fallbackFiredAt = 0; // когда действие выполнила страховка (0 — не выполняла)

  el.addEventListener('touchstart', (e) => {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    startX = t.clientX;
    startY = t.clientY;
    startScrollY = window.scrollY || window.pageYOffset || 0;
    startAt = Date.now();
  }, { passive: true });

  el.addEventListener('touchend', (e) => {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    if (isIgnored(e.target)) return;
    // Сдвиг больше тап-допуска — это жест (свайп), а не нажатие.
    if (Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10) return;
    // Страница за время касания уехала — значит это была прокрутка, а не тап
    // (браузер в таком случае click и не присылает — повторять его незачем).
    if (Math.abs((window.scrollY || window.pageYOffset || 0) - startScrollY) > 2) return;
    if (Date.now() - startAt > TAP_MAX_MS) return;

    clearTimeout(fallbackTimer);
    fallbackTimer = setTimeout(() => {
      fallbackTimer = 0;
      fallbackFiredAt = Date.now();
      handler();
    }, TAP_FALLBACK_DELAY);
  }, { passive: true });

  el.addEventListener('click', (e) => {
    if (isIgnored(e.target)) return;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = 0;
    }
    // Действие уже выполнила страховка — этот поздний click не повторяем.
    // Обычные клики (и быстрые повторные тапы) под этот запрет не попадают.
    if (fallbackFiredAt && Date.now() - fallbackFiredAt < TAP_FALLBACK_GUARD) {
      fallbackFiredAt = 0;
      return;
    }
    fallbackFiredAt = 0;
    handler();
  });
}

// ── 4. БУТСТРАП ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  initPlayer();
  initServices();
  initFaq();
  initReviews();
  initModalAndToast();
  initAboutShowcase();
  initMobileMenuScrollLock();
  initGsapAnimations();
  initMixerFaderScroll();
  initSmoothAnchorNavigation();
  initScrollSpy();
  initScrollToTop();
  initCalcHints();
  maybeShowLogoHint();
});

window.addEventListener('load', () => {
  scheduleScrollTriggerRefresh(0);
});

// Пересчёт ScrollTrigger после загрузки шрифтов: до них высоты блоков другие.
if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    scheduleScrollTriggerRefresh(120);
  });
}

