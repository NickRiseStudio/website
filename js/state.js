// ═══════════════════════════════════════════════════════════════════════
// NICK RISE STUDIO — JS / СОСТОЯНИЕ, ОБЩИЕ ПОМОЩНИКИ, БУТСТРАП
// Источник: script.js, строки 1–147 (перенос 1:1, поведение не менялось)
// Читает снаружи: —
// Обязан грузиться после: config.js, smoothscroll-nr.js (и inline-настройки Lenis)
// Владеет общим состоянием, которое читают ВСЕ остальные файлы:
//   currentLang, activeTrackLang, activeTrackId, currentTrackPage,
//   trackAudioMap, audioCacheStampValue, suppressCardEnterAnimation.
// Два общих помощника:
//   • scheduleScrollTriggerRefresh — схлопывает ScrollTrigger.refresh в один
//     вызов (иначе на старте их было несколько подряд и телефон «залипал»);
//   • bindTapControl — надёжный тап на телефоне: touchend + страховка, если
//     браузер не прислал click (инерция после свайпа).
// Бутстрап: DOMContentLoaded → init*(), load → refresh, document.fonts.ready.
// Грузится ПЕРВЫМ: остальные файлы читают его let/const (иначе TDZ).
// ═══════════════════════════════════════════════════════════════════════

// State variables
let currentLang = 'en';
let activeTrackLang = 'en';
let activeTrackId = null;
let currentTrackPage = 0;
// Во время свайп-перехода лентой треков управляет свайп-режим
// (enterSwipeMode/settleSwipe/exitSwipeMode), поэтому штатная «вкатка снизу»
// в renderTrackList() на этот момент подавляется, чтобы не было двух анимаций.
let suppressCardEnterAnimation = false;

// Audio engine data
const trackAudioMap = {}; // { trackId: { audioA, audioB, source: 'before'|'after', volume: 0.9 } }
// Штамп для отладочного обхода кэша аудио (см. audioUrl): один на всю сессию
// страницы, чтобы адреса внутри одного захода не расходились.
let audioCacheStampValue = '';

/* ScrollTrigger.refresh() — это полный пересчёт позиций всех триггеров, то есть
   принудительная переклейка раскладки всей страницы. На старте он вызывался
   несколько раз подряд (load, готовность шрифтов, отрисовка карточек услуг и
   треков, показ нижнего плеера), и на телефоне это давало заметные «залипания»
   в первые секунды. Здесь вызовы схлопываются в один: если пересчёт уже
   запланирован, повторный запрос просто игнорируется. */
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

/* ── НАДЁЖНЫЙ ТАП ПО КНОПКЕ НА ТЕЛЕФОНЕ ───────────────────────────────────
   Android-браузеры (Chrome, Яндекс) не присылают click, если страница под
   пальцем ещё ехала по инерции: первый тап после свайпа тратится на её
   остановку, и со стороны это выглядит как «кнопка не работает» (второй тап
   срабатывает — инерция уже погашена). Сами касания при этом приходят всегда.
   Поэтому тап разбираем на touchend и, если click так и не пришёл, выполняем
   действие сами через TAP_FALLBACK_DELAY. Если click пришёл — страховка
   снимается, то есть действие выполняется РОВНО ОДИН раз и без задержки.
   Используется для переключателя языка, точек-индикатора и стрелок ленты —
   всего, что листает треки. */
const TAP_FALLBACK_DELAY = 350; // мс: сколько ждём click, прежде чем сработать самим
const TAP_FALLBACK_GUARD = 600; // мс: окно, в котором поздний click уже не повторяет действие
const TAP_MAX_MS = 700;         // мс: дольше — это удержание, а не тап

/* Телефон и планшет (<1024px): появления блоков при прокрутке выключены —
   всё содержимое разделов выведено сразу, без всплытий. Медиазапрос тот же,
   что в animations.css (секция 16), поэтому JS и CSS не разойдутся.
   ПК-версия (от 1024px) не затрагивается. */
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

// Ensure ScrollTrigger recalibrates when web fonts finish downloading
if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    scheduleScrollTriggerRefresh(120);
  });
}


// ═══ 148–509 → js/i18n.js (автоопределение языка, i18n-рендер, meta) ═══
