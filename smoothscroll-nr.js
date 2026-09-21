/* ======================================================================
   NICK RISE STUDIO — плавный скролл (собственный модуль).
   Ядро — как у скролл-либы Balázs Galambosi (раньше подключалась как
   smoothscroll.min.js; файл удалён из проекта, читаемый исходник для
   сверки — tools/_smoothscroll-pretty.txt): per-notch pulse-инерция
   через scrollBy. Убраны её хрупкие эвристики:
   localStorage-буфер и «прогрев» после resize/zoom, phantom-div,
   MutationObserver, ctrlKey-рассинхронизация; на resize/zoom — лёгкий
   resync() вместо destroy()+enable().

   API: SmoothScroll.enable(opts) / destroy() / cancel() / stop() /
        resync() / init();  window.nrSmoothScroll;  window.SmoothScroll;
        SmoothScroll._dbg()  (отладочный доступ к состоянию).
   ====================================================================== */

(function () {
  'use strict';

  var defaults = {
    frameRate: 150,          // fps (резерв, если нет requestAnimationFrame)
    animationTime: 1000,     // мс — длительность инерции одного «щелчка»
    stepSize: 75,            // базовый шаг (совместим с прежним конфигом)
    accelerationDelta: 30,   // мс — при более частых дельтах «ускоряем»
    accelerationMax: 1.6,    // множитель ускорения (мягче родных 2)
    keyboardSupport: true,
    arrowScroll: 50,
    touchpadSupport: true,   // мелкие фракционные движения — нативные
    pulseAlgorithm: true,
    pulseScale: 4,
    pulseNormalize: 1
  };

  var opts = {};
  var enabled = false;
  var onWheel, onKey, onVisChange;

  var rafId = 0;           // id текущего rAF-цикла
  var running = false;     // идёт ли цикл
  var buffer = [];         // незавершённые «щелчки» колеса
  var lastDirX = 0;        // последнее направление (сброс при развороте)
  var lastDirY = 0;
  var lastEventAt = 0;     // отметка времени для акселерации
  var pulseN = 1;          // ленивая нормализация pulse-кривой

  function isTouchOnlyDevice() {
    try {
      return window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches &&
             ('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));
    } catch (e) { return false; }
  }

  function getEl() { return document.scrollingElement || document.documentElement; }
  function getY() { return window.pageYOffset || getEl().scrollTop || 0; }
  function getX() { return window.pageXOffset || getEl().scrollLeft || 0; }
  function maxY() { return Math.max(0, (document.documentElement.scrollHeight || 0) - window.innerHeight); }
  function maxX() { return Math.max(0, (document.documentElement.scrollWidth || 0) - window.innerWidth); }

  /* Есть ли «внутренний» скролл-контейнер в предке цели (модал, мобильное
     меню, карусель отзывов)? Если да — колесо должно крутить ЕГО, поэтому
     событие не перехватываем и не гасим нативный скролл. */
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

  /* Pulse-кривая — байт-в-байт как в оригинале (форма ощущения инерции). */
  function pulseV(v) {
    v *= opts.pulseScale;
    if (v < 1) return v - (1 - Math.exp(-v));
    v -= 1;
    var t = Math.exp(-1);
    return (t + (1 - Math.exp(-v)) * (1 - t)) * pulseN;
  }
  function pulseNorm(c) {
    if (c >= 1) return 1;
    if (c <= 0) return 0;
    if (pulseN === 1) pulseN = 1 / pulseV(1);   // ленивая нормализация, как в оригинале
    return pulseV(c);
  }

  /* rAF-цикл: каждый кадр «доигрывает» все живые щелчки из буфера.
     Ключ плавности — дельта режется на под-шаги (delta*progress - last) и
     применяется через scrollBy: браузер сам клампит на 0/max, поэтому доезд
     до краёв точный, а не «1–99%». */
  function tick() {
    rafId = 0;
    if (!enabled || !buffer.length) { running = false; return; }
    try {
      var nowT = Date.now();
      var accX = 0, accY = 0;
      for (var i = 0; i < buffer.length; i++) {
        var a = buffer[i];
        var age = nowT - a.start;
        var done = age >= opts.animationTime;
        var c = done ? 1 : age / opts.animationTime;
        if (opts.pulseAlgorithm && c < 1) c = pulseNorm(c);
        var sx = (a.x * c - a.lastX) >> 0;   // trunc к нулю — как в оригинале
        var sy = (a.y * c - a.lastY) >> 0;
        accX += sx;
        accY += sy;
        a.lastX += sx;
        a.lastY += sy;
        if (done) { buffer.splice(i, 1); i--; }
      }
      if (accX || accY) window.scrollBy(accX, accY);
      if (buffer.length) {
        running = true;
        rafId = requestAnimationFrame(tick);
      } else {
        running = false;
        lastDirX = 0;
        lastDirY = 0;
        lastEventAt = 0;
      }
    } catch (err) {
      if (window.console && console.warn) console.warn('[smoothscroll-nr] tick:', err);
      stopMotion();
    }
  }

  /* Добавить «щелчок» (колесо/клавиатура) в буфер и запустить цикл. */
  function pushWheel(xDelta, yDelta) {
    if (!xDelta && !yDelta) return;
    var dx = xDelta > 0 ? 1 : xDelta < 0 ? -1 : 0;
    var dy = yDelta > 0 ? 1 : yDelta < 0 ? -1 : 0;
    // Разворот направления — сбрасываем незавершённую инерцию (как в оригинале),
    // иначе остаток старого хода «тянет» в противоположную сторону.
    if (lastDirX && dx && dx !== lastDirX) { buffer = []; lastEventAt = 0; }
    if (lastDirY && dy && dy !== lastDirY) { buffer = []; lastEventAt = 0; }
    if (dx) lastDirX = dx;
    if (dy) lastDirY = dy;

    // Акселерация при частом скролле (как в оригинале: ускоряем, если щелчки чаще 30 мс)
    if (opts.accelerationMax !== 1) {
      var e = Date.now() - lastEventAt;
      if (e < opts.accelerationDelta) {
        var acc = (1 + 50 / e) / 2;
        if (acc > 1) {
          acc = Math.min(acc, opts.accelerationMax);
          xDelta *= acc;
          yDelta *= acc;
        }
      }
    }
    lastEventAt = Date.now();

    buffer.push({
      x: xDelta,
      y: yDelta,
      // ±0.99 из оригинала: компенсирует потерю пикселя при trunc на первом кадре
      lastX: xDelta < 0 ? 0.99 : -0.99,
      lastY: yDelta < 0 ? 0.99 : -0.99,
      start: Date.now()
    });
    // Защита от бесконечного роста буфера (тачпад/долгий скролл): держим не
    // больше 64 живых щелчков — при animationTime=1000 их реально ~30 максимум.
    if (buffer.length > 64) buffer.splice(0, buffer.length - 64);

    if (!rafId) {
      running = true;
      rafId = requestAnimationFrame(tick);
    }
  }

  /* Остановить текущую инерцию, НЕ снимая обработчики (enabled остаётся).
     Нужно фейдеру микшера и якорной навигации: их window.scrollTo не должен
     драться с «доезжанием» колеса. */
  function stopMotion() {
    if (rafId) { try { cancelAnimationFrame(rafId); } catch (e) {} rafId = 0; }
    running = false;
    buffer = [];
    lastDirX = 0;
    lastDirY = 0;
    lastEventAt = 0;
  }

  /* Лёгкий пересчёт после resize/zoom: гасим инерцию и направление, но
     слушатели НЕ трогаем (иначе каждый resize = рывок колеса, как было при
     destroy()+enable()). Опции/обработчики остаются теми же. */
  function resync() { stopMotion(); }

  function destroy() {
    enabled = false;
    stopMotion();
    detach();
  }

  function enable(options) {
    var k;
    if (options) for (k in options) if (defaults.hasOwnProperty(k)) opts[k] = options[k];
    // Уже включён — только resync: внешние вызовы destroy()+enable() на resize
    // больше не пересоздают обработчики.
    if (enabled) { resync(); return; }
    if (isTouchOnlyDevice() && window.innerWidth < 1024) { destroy(); return; }
    enabled = true;
    resync();
    attach();
  }

  onWheel = function (e) {
    if (!enabled || e.defaultPrevented) return;
    // Ctrl/Cmd + колесо — масштаб браузера: не мешаем ему и не портим состояние.
    if (e.ctrlKey || e.metaKey) return;
    // Пока висит boot-заставка, страница не скроллится (её гасит animations.js).
    if (document.documentElement.classList.contains('nr-boot-active')) return;
    if (!maxY() && !maxX()) return;
    if (innerScrollable(e.target)) return;

    var dy = e.deltaY || (-e.wheelDeltaY) || 0;
    var dx = e.deltaX || (-e.wheelDeltaX) || 0;
    if (e.deltaMode === 1) { dy *= 40; dx *= 40; }                       // строки
    else if (e.deltaMode === 2) { dy *= window.innerHeight; dx *= window.innerWidth; } // страницы

    // Мелкие фракционные дельты (тачпад) отдаём браузеру: нативный скролл
    // тачпада плавнее любой эмуляции — так же ведёт себя и оригинал.
    if (opts.touchpadSupport && Math.abs(dx) < 40 && Math.abs(dy) < 40) return;

    // Крупный «щелчок» нормализуем к stepSize (120 → 75) — как в оригинале.
    if (Math.abs(dx) > 1.2) dx *= opts.stepSize / 120;
    if (Math.abs(dy) > 1.2) dy *= opts.stepSize / 120;
    if (!dx && !dy) return;

    e.preventDefault();
    pushWheel(dx, dy);
  };

  onKey = function (e) {
    if (!enabled || !opts.keyboardSupport || e.defaultPrevented) return;
    var t = e.target;
    if (t && t.nodeType === 1 &&
        (/^(textarea|select|button|a)$/i.test(t.nodeName) ||
         t.isContentEditable ||
         (t.nodeName === 'INPUT' && !/^(button|submit|checkbox|radio|file|color|image)$/i.test(t.type)))) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (document.documentElement.classList.contains('nr-boot-active')) return;
    if (!maxY() && !maxX()) return;

    var dh = 0, dv = 0, k = e.keyCode || e.which || e.key;
    switch (k) {
      case 38: case 'ArrowUp':    dv = -opts.arrowScroll; break;
      case 40: case 'ArrowDown':  dv = opts.arrowScroll; break;
      case 37: case 'ArrowLeft':  dh = -opts.arrowScroll; break;
      case 39: case 'ArrowRight': dh = opts.arrowScroll; break;
      case 32: case 'Spacebar': case ' ':
        dv = (e.shiftKey ? -1 : 1) * Math.round(window.innerHeight * 0.9); break;
      case 33: case 'PageUp':   dv = -Math.round(window.innerHeight * 0.9); break;
      case 34: case 'PageDown': dv = Math.round(window.innerHeight * 0.9); break;
      case 36: case 'Home': e.preventDefault(); stopMotion(); window.scrollTo(0, 0); return;
      case 35: case 'End':  e.preventDefault(); stopMotion(); window.scrollTo(0, maxY()); return;
      default: return;
    }
    e.preventDefault();
    pushWheel(dh, dv);
  };

  // Если вкладка ушла в фон, rAF вставал — по возвращении просто продолжаем цикл.
  onVisChange = function () {
    if (!document.hidden && buffer.length && !rafId) rafId = requestAnimationFrame(tick);
  };

  function attach() {
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey, { capture: true });
    document.addEventListener('visibilitychange', onVisChange);
  }
  function detach() {
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKey, { capture: true });
    document.removeEventListener('visibilitychange', onVisChange);
  }

  /* Публичный API — совместим с прежним (inline-блок, animations.js,
     script.js/фейдер микшера продолжают работать без правок). */
  function SmoothScroll(options) { enable(options); }
  SmoothScroll.enable = enable;
  SmoothScroll.init = enable;
  SmoothScroll.destroy = destroy;
  SmoothScroll.cancel = stopMotion;   // стоп инерции без снятия обработчиков
  SmoothScroll.stop = stopMotion;
  SmoothScroll.resync = resync;       // лёгкий пересчёт после resize/zoom
  SmoothScroll._dbg = function () {
    return {
      module: 'smoothscroll-nr',
      enabled: enabled,
      targetY: null, targetX: null,
      y: Math.round(getY() * 100) / 100,
      x: Math.round(getX() * 100) / 100,
      max: Math.round(maxY() * 100) / 100,
      buffer: buffer.length,
      running: running,
      raf: !!rafId,
      dirY: lastDirY,
      dirX: lastDirX
    };
  };

  window.SmoothScroll = SmoothScroll;
  window.nrSmoothScroll = SmoothScroll;


})();
