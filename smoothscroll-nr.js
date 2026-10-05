/* ======================================================================
   NICK RISE STUDIO — «виртуальный» скролл (собственный движок).

   Страница больше не прокручивается нативно. Содержимое лежит в обёртке
   #nr-content (index.html: вокруг <main> и <footer>), и каждый кадр она
   сдвигается трансформом translate3d(0, -y, 0). Колесо не двигает скролл,
   а меняет ЦЕЛЬ y; позиция идёт к цели РОВНО тем же законом, что вёл прежний
   Lenis: каждый щелчок заново запускает доезд от ТЕКУЩЕЙ позиции к новой
   цели на полную длительность duration по кривой easing. Прогресс считается
   от часов (dt), а не от числа кадров, — поэтому ход одинаков и на 60, и на
   200 Гц (на 200 Гц шаг на кадр просто меньше, «ступенек» не видно).

   Почему трансформ: содержимое — ОДИН композитный слой, браузер двигает
   его на GPU без перерисовки разметки. Нативный скролл (в т.ч. прежний
   Lenis) каждый кадр писал scrollTop и заставлял компоситор работать с
   подкадровой точностью — на 200 Гц это читалось микро-дёрганьем.

   ВАЖНО: содержимое остаётся В ПОТОКЕ (обёртка НЕ position:fixed). Тогда
   documentElement.scrollHeight по-прежнему равен полной высоте страницы,
   и весь существующий код «предел прокрутки = scrollHeight - innerHeight»
   работает без правок (ScrollTrigger, полоска прогресса, фейдер микшера).

   Совместимость без правок остального кода: пока движок активен, мы
   подменяем чтения позиции (window.scrollY / window.pageYOffset /
   documentElement.scrollTop → текущая виртуальная позиция) и записи
   (window.scrollTo / Element.scrollIntoView → движок), плюс каждый кадр
   рассылаем синтетическое событие 'scroll'. Поэтому scroll-spy, полоска,
   фон шапки, карусель услуг, фейдер и ScrollTrigger работают как раньше.

   Публичный API сохранён 1:1 с прежним модулем:
     SmoothScroll.enable(opts) / destroy() / cancel() / resync() /
     isEnabled() / scrollTo(y, opts);  SmoothScroll(opts);
     window.SmoothScroll;  window.nrSmoothScroll.

   Настройки задаются в index.html (smoothConfig): duration, easing,
   wheelMultiplier, smoothWheel, syncTouch. duration — время доезда одного
   щелчка колеса и якоря (как в прежнем Lenis), easing — его кривая.
   ====================================================================== */

(function () {
  'use strict';

  var defaults = {
    duration: 1.0,           // сек — длина «доезда» колеса и якоря (как в Lenis)
    easing: null,            // кривая доезда; null → easeInOutCubic
    wheelMultiplier: 0.625,  // множитель шага колеса
    minWidth: 1024           // уже экрана / тач — не включаем (нативный скролл)
  };

  var o = {};
  var content = null;                    // #nr-content
  var target = 0, current = 0, max = 0;  // цель, текущая позиция, предел
  var raf = null;
  var active = false;
  var tween = null;                      // активный якорный доезд (или null)
  var observers = [];
  var savedScrollTo = null, savedScrollIntoView = null;
  var savedYDesc = null, savedPageDesc = null;   // оригинальные дескрипторы позиции
  var overridden = false;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* «Замок» страницы: пока висит хоть один — фон не двигаем. Классы ставит
     site-JS (заставка, модалки, мобильное меню, подсказка A/B). */
  function isLocked() {
    var d = document.documentElement, b = document.body;
    return d.classList.contains('nr-boot-active') ||
           d.classList.contains('nr-ab-hint') ||
           b.classList.contains('modal-open') ||
           b.classList.contains('nr-menu-open');
  }

  /* Внутренний скролл-контейнер над целью события (мобильное меню, тело
     модалки, карусель услуг): такие события движок не трогает — контейнер
     крутится сам. Логика та же, что была у прежнего модуля. */
  function innerScrollable(node) {
    var el = (node && node.nodeType === 1) ? node : null;
    if (!el || el === window || el === document) return null;
    while (el && el !== document.body && el !== document.documentElement) {
      var cs;
      try { cs = getComputedStyle(el); } catch (e) { cs = null; }
      if (cs) {
        var canY = (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 8;
        var canX = (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 8;
        if (canY || canX) return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  /* Предел прокрутки — по-прежнему из высоты документа: содержимое в потоке,
     поэтому scrollHeight корректен и после включения движка. */
  function measure() {
    max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    target = clamp(target, 0, max);
    current = clamp(current, 0, max);
  }

  function docTop(el) { return el.getBoundingClientRect().top + current; }

  function querySafe(sel) {
    if (!sel || sel.charAt(0) !== '#') return null;
    try { return document.querySelector(sel); } catch (e) { return null; }
  }

  function render() {
    content.style.transform = 'translate3d(0,' + (-current).toFixed(3) + 'px,0)';
    /* Синтетическое событие 'scroll': существующие слушатели (scroll-spy,
       полоска, фон шапки, карусель услуг, фейдер) видят «прокрутку» и
       читают актуальную позицию через подменённый window.scrollY. */
    try { window.dispatchEvent(new Event('scroll')); } catch (e) {}
    try { document.dispatchEvent(new Event('scroll')); } catch (e) {}
    /* GSAP/ScrollTrigger: пересчёт триггеров в этом же кадре. */
    if (window.ScrollTrigger && typeof window.ScrollTrigger.update === 'function') {
      try { window.ScrollTrigger.update(); } catch (e) {}
    }
  }

  function kick() { if (raf == null) raf = requestAnimationFrame(frame); }

  /* Доезд — одна механика и для колеса, и для якоря (как в Lenis): считаем
     время от начала доезда, берём долю пройденного пути p = t/duration,
     прогоняем её через кривую easing и ставим позицию между from и to.
     Колесо на каждый щелчок заново зовёт animateTo(), поэтому прогресс
     начинается с нуля, а from — текущая (дробная) позиция. */
  function frame(now) {
    raf = null;
    if (!tween) return;

    var p = tween.dur > 0 ? clamp((now - tween.t0) / (tween.dur * 1000), 0, 1) : 1;
    var e = p >= 1 ? 1 : (tween.ease || easeInOutCubic)(p);
    current = tween.from + (tween.to - tween.from) * e;
    target = tween.to;
    if (p >= 1) tween = null;

    render();
    if (tween) raf = requestAnimationFrame(frame);
  }

  /* ── Ввод ───────────────────────────────────────────────────────────── */

  function onWheel(e) {
    if (!active || isLocked()) return;
    if (e.ctrlKey) return;                          /* Ctrl+колесо — масштаб страницы */
    if (innerScrollable(e.target)) return;          /* внутренний контейнер крутится сам */
    e.preventDefault();
    var d = e.deltaY;
    if (e.deltaMode === 1) d *= 16.666666666666668;       /* строки → px (как в Lenis) */
    else if (e.deltaMode === 2) d *= window.innerHeight;  /* страницы → px */
    var next = clamp(target + d * o.wheelMultiplier, 0, max);
    if (next === target) return;                    /* цель та же — идущий доезд не трогаем */
    /* Как Lenis: каждый щелчок заново ведёт доезд от ТЕКУЩЕЙ позиции к новой
       цели на полную длительность (duration + кривая), а не «догоняет» её. */
    animateTo(next, { duration: o.duration, easing: o.easing });
  }

  function onKey(e) {
    if (!active || isLocked()) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    var page = window.innerHeight * 0.9, to = null;
    switch (e.key) {
      case 'ArrowDown': case 'Down': to = target + 90; break;
      case 'ArrowUp':   case 'Up':   to = target - 90; break;
      case 'PageDown':               to = target + page; break;
      case 'PageUp':                 to = target - page; break;
      case 'Home':                   to = 0; break;
      case 'End':                    to = max; break;
      case ' ':                      to = target + (e.shiftKey ? -page : page); break;
    }
    if (to === null) return;
    e.preventDefault();
    animateTo(clamp(to, 0, max), { duration: o.duration, easing: o.easing });
  }

  function onResize() { if (!active) return; measure(); render(); }

  function onHash() {
    if (!active) return;
    var el = querySafe(location.hash);
    if (el) animateTo(clamp(docTop(el), 0, max), { duration: 0.8 });
  }

  /* Мгновенная установка позиции (фейдер микшера, GSAP-онupdate, ScrollTrigger
     во время refresh — им нужна та же семантика, что у нативного scrollTo). */
  function setImmediate(y) {
    if (!active) return;
    tween = null;
    current = target = clamp(y, 0, max);
    render();
  }

  function animateTo(y, opts) {
    opts = opts || {};
    var to = clamp(y, 0, max);
    tween = {
      from: current,
      to: to,
      t0: (window.performance && performance.now) ? performance.now() : Date.now(),
      dur: (opts.duration != null ? opts.duration : (o.duration || 1.0)),
      ease: (typeof opts.easing === 'function') ? opts.easing
            : (typeof o.easing === 'function' ? o.easing : null)
    };
    target = to;
    kick();
  }

  /* ── Подмена платформенных чтений/записей позиции ─────────────────────
     Содержимое сдвигается трансформом, поэтому нативная прокрутка всегда 0.
     Чтобы НЕ править десятки мест в script.js/animations.js, движок на время
     своей активности отвечает за них сам:
       • window.scrollY / window.pageYOffset / documentElement.scrollTop —
         чтение отдаёт текущую виртуальную позицию (её же читает ScrollTrigger);
       • window.scrollTo() и Element.scrollIntoView() — запись ведёт движок.
     Как только движок выключается (мобильный/слабый ПК) — всё возвращается
     к нативному поведению. */
  function applyOverrides() {
    if (overridden) return;
    overridden = true;
    savedScrollTo = window.scrollTo;
    savedScrollIntoView = Element.prototype.scrollIntoView;

    try { savedYDesc = Object.getOwnPropertyDescriptor(window, 'scrollY'); } catch (e) {}
    try { savedPageDesc = Object.getOwnPropertyDescriptor(window, 'pageYOffset'); } catch (e) {}
    try { Object.defineProperty(window, 'scrollY', { configurable: true, get: function () { return current; } }); } catch (e) {}
    try { Object.defineProperty(window, 'pageYOffset', { configurable: true, get: function () { return current; } }); } catch (e) {}

    try {
      Object.defineProperty(document.documentElement, 'scrollTop', {
        configurable: true,
        get: function () { return current; },
        set: function (v) { setImmediate(v); }
      });
    } catch (e) {}

    window.scrollTo = function (x, y) {
      if (x && typeof x === 'object') y = x.top;
      setImmediate(y);
    };

    Element.prototype.scrollIntoView = function () {
      if (!active || !content || !content.contains(this)) {
        return savedScrollIntoView.apply(this, arguments);
      }
      setImmediate(docTop(this));       /* мгновенно, как вело бы себя нативное */
    };
  }

  function restoreOverrides() {
    if (!overridden) return;
    overridden = false;
    try { if (savedYDesc) Object.defineProperty(window, 'scrollY', savedYDesc); else delete window.scrollY; } catch (e) {}
    try { if (savedPageDesc) Object.defineProperty(window, 'pageYOffset', savedPageDesc); else delete window.pageYOffset; } catch (e) {}
    try { delete document.documentElement.scrollTop; } catch (e) {}
    if (savedScrollTo) window.scrollTo = savedScrollTo;
    if (savedScrollIntoView) Element.prototype.scrollIntoView = savedScrollIntoView;
  }

  /* Гасим незавершённую инерцию, движок оставляем: цель = текущая позиция.
     Нужно фейдеру микшера (он сам двигает window.scrollTo) и якорям. */
  function cancel() {
    if (!active) return;
    tween = null;
    if (raf != null) { cancelAnimationFrame(raf); raf = null; }
    if (current !== target) { target = current; render(); }
  }

  function resync() { if (!active) return; measure(); render(); }

  function scrollTo(y, opts) {
    if (!active) return false;
    opts = opts || {};
    if (opts.immediate) { setImmediate(y); return true; }
    animateTo(y, opts);
    return true;
  }

  /* ── Включение/выключение ───────────────────────────────────────────── */

  function eligible() {
    var fine;
    try { fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches; }
    catch (e) { fine = true; }
    return fine && window.innerWidth >= o.minWidth;
  }

  function enable(options) {
    /* Сначала заполняем настройки значениями по умолчанию, потом накладываем
       переданные (smoothConfig). Без этого шага o.minWidth было undefined,
       eligible() всегда давал false — и движок не включался вовсе. */
    var dk;
    for (dk in defaults) {
      if (defaults.hasOwnProperty(dk) && !o.hasOwnProperty(dk)) o[dk] = defaults[dk];
    }
    if (options) for (var k in options) if (defaults.hasOwnProperty(k)) o[k] = options[k];
    content = document.getElementById('nr-content');
    if (!content) return false;              /* страница без обёртки — нативный скролл */
    if (active) { resync(); return true; }
    if (!eligible()) return false;           /* тач/узкое окно — нативный скролл */

    var startY = window.scrollY || window.pageYOffset || 0;   /* до подмены */

    /* Нативная прокрутка выключена; содержимое остаётся в потоке — поэтому
       documentElement.scrollHeight по-прежнему равен полной высоте. */
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('nr-virtual');
    content.style.willChange = 'transform';

    applyOverrides();

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey, false);
    window.addEventListener('resize', onResize, false);
    window.addEventListener('hashchange', onHash, false);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(onResize);
      ro.observe(content);
      observers.push(ro);
    }

    active = true;
    measure();
    target = current = clamp(startY, 0, max);
    if (location.hash) {                      /* открыли по якорю — встаём туда */
      var el = querySafe(location.hash);
      if (el) target = current = clamp(docTop(el), 0, max);
    }
    render();
    return true;
  }

  function destroy() {
    if (!active) return;
    active = false;
    var y = current;

    window.removeEventListener('wheel', onWheel, { passive: false });
    window.removeEventListener('keydown', onKey, false);
    window.removeEventListener('resize', onResize, false);
    window.removeEventListener('hashchange', onHash, false);
    if (raf != null) { cancelAnimationFrame(raf); raf = null; }
    for (var i = 0; i < observers.length; i++) { try { observers[i].disconnect(); } catch (e) {} }
    observers.length = 0;

    restoreOverrides();
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.documentElement.classList.remove('nr-virtual');
    if (content) { content.style.willChange = ''; content.style.transform = ''; }

    tween = null; target = current = 0;
    /* Возвращаемся на нативный скролл примерно там же, где были. */
    try { window.scrollTo(0, y); } catch (e) {}
  }

  function SmoothScroll(options) { enable(options); }
  SmoothScroll.enable = enable;
  SmoothScroll.destroy = destroy;
  SmoothScroll.cancel = cancel;
  SmoothScroll.resync = resync;
  SmoothScroll.scrollTo = scrollTo;
  SmoothScroll.isEnabled = function () { return active; };

  window.SmoothScroll = SmoothScroll;
  window.nrSmoothScroll = SmoothScroll;

})();
