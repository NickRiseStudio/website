// ═══════════════════════════════════════════════════════════════════════
// kb/js/06-smooth-scroll.js — ПЛАВНАЯ ПРОКРУТКА ПАНЕЛИ #kbMain
// Грузится: kb/index.html — в конце body, defer. После
//         kb/js/vendor/lenis.min.js (глобал window.Lenis).
// Читает: #kbMain (прокручивается только панель, страница — один экран),
//         window.Lenis.
// Публичные (window): nrSmoothScroll → enable / destroy / cancel / resync /
//         scrollTo / scrollToSection / isEnabled.
// Блоки файла:
//   • enable / destroy — движок на панели; на тач-онли устройствах шириной
//         меньше 1024px прокрутка остаётся нативной.
//   • cancel / resync / scrollTo — инерция, пересчёт размеров, якоря.
//   • scrollToSection — якорь из содержания (kb/js/05-toc.js).
// ═══════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  /* Настройки те же, что у основного сайта (public/index.html → smoothConfig):
     длина доезда одного щелчка колеса, шаг колеса ~62px и кривая «быстрый
     старт, длинный хвост». Иначе база знаний крутилась бы иначе, чем сайт. */
  var defaults = {
    duration: 1.0,
    wheelMultiplier: 0.625,
    smoothWheel: true,
    syncTouch: false
  };

  /* Отдельного смещения у якоря нет: Lenis сам вычитает scroll-margin-top
     заголовка (kb/css/style/06-article.css), поэтому раздел встаёт так же, как
     при обычном переходе по ссылке. */
  var ANCHOR_DURATION_S = 0.9;

  var opts = {};
  var lenis = null;
  var enabled = false;

  function isTouchOnlyDevice() {
    try {
      return window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches &&
             ('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
    } catch (e) { return false; }
  }

  function panel() {
    return document.getElementById('kbMain');
  }

  /* Кривая доезда: на половине времени пройдено ~79% пути — та же, что
     в smoothConfig сайта. У кривой Lenis по умолчанию ~97%, из-за чего
     движение читается как рывок с остановкой. */
  function ease(t) {
    return 1 - Math.pow(1 - t, 2.25);
  }

  function destroy() {
    if (lenis) {
      try { lenis.destroy(); } catch (e) {}
      lenis = null;
    }
    enabled = false;
  }

  function enable(options) {
    var k;
    if (options) for (k in options) if (defaults.hasOwnProperty(k)) opts[k] = options[k];
    if (lenis) { resync(); return; }
    if (typeof window.Lenis !== 'function') return;   // библиотека не загрузилась
    if (isTouchOnlyDevice() && window.innerWidth < 1024) { destroy(); return; }

    var el = panel();
    if (!el || !el.firstElementChild) return;

    /* content — единственный ребёнок панели (#kbMainInner: приветствие и все
       статьи сразу): по нему Lenis следит за высотой содержимого
       (autoResize), поэтому подгрузка шрифтов, картинок и смена статьи
       не оставляют устаревший предел прокрутки. */
    lenis = new window.Lenis({
      wrapper: el,
      content: el.firstElementChild,
      duration: opts.duration,
      easing: ease,
      wheelMultiplier: opts.wheelMultiplier,
      smoothWheel: opts.smoothWheel,
      syncTouch: opts.syncTouch,
      autoRaf: true,          // GSAP в базе знаний нет: кадры гонит сам Lenis
      autoResize: true
    });
    enabled = true;
  }

  /* Гасим незавершённую инерцию, движок оставляем: цель — текущая позиция. */
  function cancel() {
    if (!lenis) return;
    try { lenis.scrollTo(lenis.actualScroll, { immediate: true, force: true }); } catch (e) {}
  }

  function resync() {
    if (!lenis) return;
    try { lenis.resize(); } catch (e) {}
  }

  /* Программный плавный скролл: y — координата внутри панели. */
  function scrollTo(y, options) {
    if (!lenis) return false;
    try { lenis.scrollTo(y, options || {}); return true; } catch (e) { return false; }
  }

  /* Якорь из содержания: id заголовка внутри панели. false — движка нет
     или раздела не нашли, тогда переход делает сам браузер. */
  function scrollToSection(id) {
    if (!lenis || !id) return false;
    var el = panel();
    var target = document.getElementById(id);
    if (!el || !target || !el.contains(target)) return false;
    try {
      lenis.scrollTo(target, { duration: ANCHOR_DURATION_S });
      return true;
    } catch (e) { return false; }
  }

  function SmoothScroll(options) { enable(options); }
  SmoothScroll.enable = enable;
  SmoothScroll.destroy = destroy;
  SmoothScroll.cancel = cancel;
  SmoothScroll.resync = resync;
  SmoothScroll.scrollTo = scrollTo;
  SmoothScroll.scrollToSection = scrollToSection;
  SmoothScroll.isEnabled = function () { return enabled; };

  window.nrSmoothScroll = SmoothScroll;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { enable(); });
  } else {
    enable();
  }

  /* После resize и поворота экрана панель меняет высоту — предел прокрутки
     пересчитываем сразу, не дожидаясь щелчка колеса. */
  window.addEventListener('resize', resync, { passive: true });
  window.addEventListener('orientationchange', resync, { passive: true });
})();