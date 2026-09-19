/* ============================================================================
   NICK RISE STUDIO — плавный скролл (замена smoothscroll.min.js).
   ----------------------------------------------------------------------------
   Почему своя реализация вместо smoothscroll.min.js (Balázs Galambosi):

   1. «Прогрев»: оригинал хранит последние дельты колеса в localStorage
      (SS_deltaBuffer) и обрабатывает событие как «мышь» только если они
      кратны 100/120. После ЧУЖИХ дельт (тачпад, инерционное колесо, zoom-жест)
      первые 1–3 оборота уходят нативно — скролл «работает», а плавный
      «активируется» только после пары прокруток туда-сюда.
   2. Zoom/resize: после Ctrl+колесо состояние либы рассинхронизируется,
      а пересоздание через enable()/destroy() на resize создаёт рывки
      (снимается и вешается wheel-обработчик).
   3. Здесь нет ни буфера в localStorage, ни тачпад-эвристик, ни
      ctrlKey-пропусков: после ЛЮБОГО resize/zoom колёсико сразу скроллит
      плавно. Это полностью наша логика, воспроизводимая и отлаживаемая.

   Параметры совпадают с прежними (animationTime 1000 мс и т.д.), API —
   SmoothScroll.enable(opts) / SmoothScroll.destroy() / window.nrApplySmoothScroll.
   ============================================================================ */

(function () {
  'use strict';

  function isTouchOnlyDevice() {
    try {
      return ('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)) &&
             window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    } catch (e) { return false; }
  }

  var defaults = {
    frameRate: 150,
    animationTime: 1000,      // мс, «студийное скольжение»
    stepSize: 75,             // базовый шаг (для совместимости с прежним конфигом)
    accelerationDelta: 30,    // мс: при чаще дельт «ускоряем»
    accelerationMax: 2,       // множитель ускорения
    keyboardSupport: true,
    arrowScroll: 50,
    pulseAlgorithm: true,
    pulseScale: 4,
    pulseNormalize: 1,
    touchpadSupport: true
  };

  var opts = {};

  var enabled = false;

  var onWheel, onKey, onVisChange;
  var rafId = 0;
  var targetX = null;     // target scroll (null = стоять на месте)
  var targetY = null;
  var lastEventAt = 0;

  function scrollEl() { return document.scrollingElement || document.documentElement; }
  function getY() { return window.pageYOffset || scrollEl().scrollTop || 0; }
  function getX() { return window.pageXOffset || scrollEl().scrollLeft || 0; }
  function maxY() { return Math.max(0, (document.documentElement.scrollHeight || 0) - window.innerHeight); }
  function maxX() { return Math.max(0, (document.documentElement.scrollWidth || 0) - window.innerWidth); }

  /* Ищет «внутренний» скролл-контейнер в предках target. Если он есть —
     колесо должно крутить ЕГО, а не страницу: не перехватываем. */
  function innerScrollable(target) {
    if (!target || target === window || target === document) return null;
    var el = target.nodeType === 1 ? target : target.parentElement;
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

  function tick(now) {
    rafId = 0;
    if (!enabled || targetY === null) return;
    var last = tick._last || now;
    var dt = Math.min(100, now - last);
    tick._last = now;
    // Относительно медленное «студийное» сглаживание: за animationTime доезжаем ~95%.
    var k = 1 - Math.exp(-dt / (opts.animationTime * 0.22));
    if (k <= 0) k = 0.05;
    var cy = getY(), cx = getX();
    var ny = cy + (targetY - cy) * k;
    var nx = cx + (targetX === null ? 0 : (targetX - cx) * k);
    // Клампим по актуальной проскролленности: страница могла измениться
    // после resize/zoom (стала короче/уже)
    var my = maxY(), mx = maxX();
    if (ny < 0) ny = 0;
    if (ny > my) ny = my;
    if (nx < 0) nx = 0;
    if (nx > mx) nx = mx;
    var dy2 = Math.abs(targetY - ny), dx2 = Math.abs(targetX - nx);
    if (dy2 < 0.4) ny = targetY;
    if (dx2 < 0.4) nx = targetX;

    window.scrollTo(nx, ny);

    var atY = ny === targetY, atX = targetX === null || nx === targetX;
    if (atY && atX) {
      targetY = null;
      targetX = null;
      tick._last = 0;
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function pushTarget(dy, dx) {
    var y = getY(), x = getX();
    if (targetY === null) targetY = y;
    if (targetX === null) targetX = x;
    targetY += dy;
    targetX += dx;
    var my = maxY(), mx = maxX();
    if (targetY < 0) targetY = 0;
    if (targetY > my) targetY = my;
    if (targetX < 0) targetX = 0;
    if (targetX > mx) targetX = mx;
    var dist = Math.abs(targetY - getY()) + (targetX === null ? 0 : Math.abs(targetX - getX()));
    if (!rafId && targetY !== null && dist > 0.4) {
      rafId = requestAnimationFrame(tick);
    }
  }

  onWheel = function (e) {
    if (!enabled) return;
    if (e.defaultPrevented || e.ctrlKey) return;   // Ctrl+колесо = zoom, не мешаем
    if (document.documentElement.classList.contains('nr-boot-active')) return;
    if (!maxY() && !maxX()) return;                // страница не скроллится — не мешаем другим
    if (innerScrollable(e.target)) return;         // крутят модал/карусель — не трогаем внутр.
    if (!e.deltaY && !e.deltaX) return;

    var dy = e.deltaY, dx = e.deltaX;
    if (e.deltaMode === 1) { dy *= 40; dx *= 40; }
    else if (e.deltaMode === 2) { dy *= window.innerHeight; dx *= window.innerWidth; }

    // Ускорение при частом скролле (акселерация колеса), как в прежней либе
    var now = Date.now();
    var gap = now - lastEventAt;
    lastEventAt = now;
    if (opts.accelerationMax > 1 && gap > 0 && gap < opts.accelerationDelta) {
      var acc = Math.min(opts.accelerationMax, 1 + (opts.accelerationDelta / Math.max(1, gap)) * 0.5);
      dy *= acc;
      dx *= acc;
    }

    e.preventDefault();
    pushTarget(dy, dx);
  };

  onKey = function (e) {
    if (!enabled || !opts.keyboardSupport) return;
    if (e.defaultPrevented) return;
    var t = e.target;
    if (t && t.nodeType === 1 &&
        (/^(textarea|select|button|a)$/i.test(t.nodeName) ||
         t.isContentEditable ||
         (t.nodeName === 'INPUT' && !/^(button|submit|checkbox|radio|file|color|image)$/i.test(t.type)))) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (document.documentElement.classList.contains('nr-boot-active')) return;

    var step = opts.arrowScroll;
    var dh = 0, dv = 0;
    var key = e.keyCode || e.key;
    switch (key) {
      case 38: case 'ArrowUp': dv = -step; break;
      case 40: case 'ArrowDown': dv = step; break;
      case 37: case 'ArrowLeft': dh = -step; break;
      case 39: case 'ArrowRight': dh = step; break;
      case 32: case 'Spacebar': case ' ': dv = (e.shiftKey ? -1 : 1) * window.innerHeight * 0.9; break;
      case 33: case 'PageUp': dv = -window.innerHeight * 0.9; break;
      case 34: case 'PageDown': dv = window.innerHeight * 0.9; break;
      case 36: case 'Home': dv = -getY(); break;
      case 35: case 'End': dv = maxY() - getY(); break;
      default: return;
    }
    e.preventDefault();
    pushTarget(dv, dh);
  };

  onVisChange = function () {
    if (!document.hidden && targetY !== null && !rafId) {
      rafId = requestAnimationFrame(tick);
    }
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

  function destroy() {
    enabled = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    targetY = null; targetX = null; tick._last = 0;
    detach();
  }

  function enable(options) {
    opts = {};
    for (var k in defaults) if (defaults.hasOwnProperty(k)) opts[k] = defaults[k];
    if (options) for (var k2 in options) if (defaults.hasOwnProperty(k2)) opts[k2] = options[k2];
    destroy();
    var touchOnly = isTouchOnlyDevice();
    var desktop = !touchOnly || window.innerWidth >= 1024;
    if (!desktop) return;
    enabled = true;
    attach();
  }

  /* Публичный API — прежний, чтобы animations.js и пр. продолжали работать */
  function SmoothScroll(options) { enable(options); }
  SmoothScroll.enable = enable;
  SmoothScroll.destroy = destroy;
  SmoothScroll.init = enable;

  window.SmoothScroll = SmoothScroll;
  window.nrSmoothScroll = SmoothScroll;
})();