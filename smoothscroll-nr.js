/* ======================================================================
   NICK RISE STUDIO — плавный скролл на библиотеке Lenis.

   Движок — Lenis (darkroom.engineering), локальный vendor/lenis.min.js —
   сборка «1.3.25-framer» (та же, что ставит Framer/Rep Republic; глобал
   window.Lenis). Модуль оставляет ПРЕЖНИЙ публичный API, поэтому
   index.html, animations.js, script.js и lab-инструменты менять не нужно:

     SmoothScroll.enable(opts) / init(opts) / destroy() / cancel() /
     stop() / resync() / isEnabled() / scrollTo(y, opts) / _dbg();
     window.SmoothScroll;  window.nrSmoothScroll.

   Роли:
     • enable()  — создаёт Lenis, склеивает его с GSAP ScrollTrigger и
                   подписывается на «замки» страницы; на touch-онли
                   устройствах < 1024px скролл остаётся нативным.
     • destroy() — снимает движок и всё, что он повесил.
     • cancel()  — гасит незавершённую инерцию, движок остаётся
                   (фейдер микшера, якорная навигация).
     • resync()  — пересчёт размеров после resize/zoom.
     • scrollTo(y, opts) — программный плавный скролл (якоря в script.js).

   Настройки задаются в index.html (smoothConfig). Ощущение-ориентир —
   шаблон Rep Republic: у Framer под капотом та же Lenis.
   ====================================================================== */

(function () {
  'use strict';

  var defaults = {
    duration: 1.2,              // сек — длина «доезда» одного щелчка колеса
    easing: null,               // null → кривая Lenis по умолчанию
    wheelMultiplier: 1,         // множитель шага колеса
    touchMultiplier: 1.5,       // множитель шага тача (если включат syncTouch)
    smoothWheel: true,
    syncTouch: false            // тач на планшетах — нативный, как было
  };

  var opts = {};
  var lenis = null;
  var enabled = false;
  var tickerAttached = false;
  var lockObserver = null;

  function isTouchOnlyDevice() {
    try {
      return window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches &&
             ('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
    } catch (e) { return false; }
  }

  /* Внутренний скролл-контейнер над целью события (мобильное меню, карусель
     услуг, тело модалки): такие события Lenis не гладит — их крутит сам
     контейнер. Логика 1:1 с прежним собственным движком. */
  function innerScrollable(target) {
    var el = (target && target.nodeType === 1) ? target : null;
    if (!el || el === window || el === document) return null;
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.scrollHeight > el.clientHeight + 8) {
        var cs;
        try { cs = getComputedStyle(el); } catch (e) { cs = null; }
        if (cs && (cs.overflowY === 'auto' || cs.overflowY === 'scroll')) return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  /* «Замок» страницы: пока висит хоть один — фон не двигаем. Классы ставит
     site-JS (заставка, модалки, мобильное меню, подсказка A/B). */
  function pageLocked() {
    var d = document.documentElement, b = document.body;
    return d.classList.contains('nr-boot-active') ||
           d.classList.contains('nr-ab-hint') ||
           b.classList.contains('modal-open') ||
           b.classList.contains('nr-menu-open');
  }

  function syncLock() {
    if (!lenis) return;
    if (pageLocked()) {
      if (!lenis.isStopped) lenis.stop();
    } else if (lenis.isStopped) {
      lenis.start();
    }
  }

  function onTicker(time) {
    if (lenis) lenis.raf(time * 1000);
  }

  /* Склейка с GSAP/ScrollTrigger: scroll-событие Lenis обновляет триггеры, а
     его rAF гоним тикером GSAP — один общий кадр, без рассинхрона. */
  function hookGsap() {
    if (tickerAttached) return;
    if (window.ScrollTrigger && typeof window.ScrollTrigger.update === 'function') {
      lenis.on('scroll', window.ScrollTrigger.update);
    }
    if (window.gsap && window.gsap.ticker) {
      window.gsap.ticker.add(onTicker);
      window.gsap.ticker.lagSmoothing(0);
      tickerAttached = true;
    }
  }

  function unhookGsap() {
    if (!tickerAttached) return;
    tickerAttached = false;
    if (window.gsap && window.gsap.ticker) {
      try { window.gsap.ticker.remove(onTicker); } catch (e) {}
    }
  }

  /* Следим за классами-замками на <html>/<body>: появился — lenis.stop(),
     снялся — lenis.start(). Наблюдатель лёгкий: только атрибут class. */
  function watchLocks() {
    if (lockObserver || !window.MutationObserver) return;
    lockObserver = new MutationObserver(syncLock);
    lockObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    lockObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  function unwatchLocks() {
    if (!lockObserver) return;
    lockObserver.disconnect();
    lockObserver = null;
  }

  /* Гасим незавершённую инерцию, движок оставляем: цель = текущая позиция.
     Нужно фейдеру микшера (он сам двигает window.scrollTo) и якорям. */
  function cancel() {
    if (!lenis) return;
    try { lenis.scrollTo(lenis.actualScroll, { immediate: true, force: true }); } catch (e) {}
  }

  function destroy() {
    unwatchLocks();
    unhookGsap();
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

    var conf = {
      duration: opts.duration,
      wheelMultiplier: opts.wheelMultiplier,
      touchMultiplier: opts.touchMultiplier,
      smoothWheel: opts.smoothWheel,
      syncTouch: opts.syncTouch,
      autoRaf: false,            // rAF гоним тикером GSAP (hookGsap)
      autoResize: true,
      prevent: function (node) { return !!innerScrollable(node); }
    };
    if (typeof opts.easing === 'function') conf.easing = opts.easing;

    lenis = new window.Lenis(conf);
    enabled = true;
    hookGsap();
    watchLocks();
    syncLock();
  }

  function resync() {
    if (!lenis) return;
    try { lenis.resize(); } catch (e) {}
    syncLock();
  }

  /* Программный плавный скролл (якоря). true — если повёл Lenis. */
  function scrollTo(y, options) {
    if (!lenis) return false;
    try { lenis.scrollTo(y, options || {}); return true; } catch (e) { return false; }
  }

  function SmoothScroll(options) { enable(options); }
  SmoothScroll.enable = enable;
  SmoothScroll.init = enable;
  SmoothScroll.destroy = destroy;
  SmoothScroll.cancel = cancel;
  SmoothScroll.stop = cancel;          // совместимость: «стоп инерции»
  SmoothScroll.resync = resync;
  SmoothScroll.scrollTo = scrollTo;
  SmoothScroll.isEnabled = function () { return enabled; };
  SmoothScroll._dbg = function () {
    return {
      module: 'lenis',
      enabled: enabled,
      stopped: !!(lenis && lenis.isStopped),
      locked: pageLocked(),
      y: lenis ? Math.round(lenis.actualScroll * 100) / 100 : null,
      limit: lenis ? Math.round(lenis.limit * 100) / 100 : null,
      progress: lenis ? lenis.progress : null
    };
  };

  window.SmoothScroll = SmoothScroll;
  window.nrSmoothScroll = SmoothScroll;


})();
