/* ═══════════════════════════════════════════════════════════════════════
   NICK RISE STUDIO — ANIMATION LAYER  (animations.js)
   Подключается ПОСЛЕ script.js.

   Файл НИЧЕГО не меняет в логике сайта: он только «оборачивает»
   существующие функции, чтобы добавить визуальные эффекты после их
   выполнения, и рисует два canvas-слоя (герой + нижний плеер).
   Любая ошибка внутри эффектов гасится try/catch, поэтому сайт
   продолжит работать, даже если анимации по какой-то причине упадут.
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var REDUCED = reduceMQ.matches;
  reduceMQ.addEventListener && reduceMQ.addEventListener('change', function (e) { REDUCED = e.matches; });

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  /* Эффекты не должны ломать сайт: любая ошибка гасится.
     Про каждую уникальную проблему один раз пишем в консоль — чтобы её
     было видно при доработках, но без спама в каждом кадре. */
  var reported = {};
  function safe(fn) {
    try {
      return fn();
    } catch (e) {
      var key = String(e && e.message || e);
      if (!reported[key]) {
        reported[key] = 1;
        if (window.console && console.warn) console.warn('[animations.js]', key);
      }
    }
  }

  /* На слабых машинах отключаем самые тяжёлые фоновые эффекты */
  var LITE = false;
  try {
    LITE = (navigator.hardwareConcurrency || 8) <= 4 ||
      (navigator.deviceMemory && navigator.deviceMemory < 4) ||
      (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
  } catch (e) {}
  if (LITE) document.documentElement.classList.add('nr-lite');

  /* Заставка «включения пульта» живёт целиком в animations.css.
     Здесь только помечаем, что в этой вкладке её уже показали. */
  try { sessionStorage.setItem('nrBooted', '1'); } catch (e) {}

  /* Обёртка над глобальной функцией: сначала оригинал, потом эффект. */
  function hook(name, after) {
    var orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      var res = orig.apply(this, arguments);
      var args = arguments;
      var self = this;
      safe(function () { after.apply(self, args); });
      return res;
    };
  }

  /* ═══ ДВИЖОК УРОВНЕЙ ════════════════════════════════════════════════
     Рисует правдоподобный спектр по состоянию плеера (play/pause,
     BEFORE/AFTER, позиция трека). Аудио-граф не трогается вообще —
     звук идёт напрямую в динамики, как и раньше.
     AFTER выглядит громче и плотнее, BEFORE — тише и динамичнее:
     ровно то, что мастеринг делает со звуком на самом деле.
  ═════════════════════════════════════════════════════════════════════ */

  var NB = 80;
  var Engine = {
    bands: new Float32Array(NB),
    peaks: new Float32Array(NB),
    level: 0,
    low: 0,
    playing: false,
    source: 'after',
    time: 0
  };

  function readPlayerState(now) {
    var st = { playing: false, source: 'after', time: now / 1000 };
    try {
      if (typeof activeTrackId !== 'undefined' && activeTrackId &&
          typeof trackAudioMap !== 'undefined' && trackAudioMap[activeTrackId]) {
        var it = trackAudioMap[activeTrackId];
        st.source = it.source || 'after';
        st.playing = !it.audioA.paused || !it.audioB.paused;
        var ct = st.source === 'before' ? it.audioA.currentTime : it.audioB.currentTime;
        if (isFinite(ct) && ct > 0) st.time = ct;
      }
    } catch (e) {}
    return st;
  }

  function updateEngine(now, dt) {
    var st = readPlayerState(now);
    Engine.playing = st.playing;
    Engine.source = st.source;
    Engine.time = st.time;

    var t = st.time;
    var after = st.source !== 'before';
    var gain = st.playing ? (after ? 1 : 0.6) : 0.13;

    var beat = t * (124 / 60);
    var kick = st.playing ? Math.pow(1 - (beat % 1), 5) : 0;
    var snare = st.playing ? Math.pow(1 - ((beat + 1) % 2) / 2, 14) : 0;
    var hat = st.playing ? Math.pow(1 - ((beat * 2) % 1), 9) : 0;

    var atk = Math.min(1, dt * 22);
    var rel = Math.min(1, dt * 6);
    var sum = 0;

    for (var i = 0; i < NB; i++) {
      var f = i / (NB - 1);
      var v = Math.pow(1 - f, 1.3) * 0.55 + 0.1;

      v += kick * Math.exp(-f * 13) * 1.25;
      v += snare * Math.exp(-Math.pow((f - 0.34) * 4.2, 2)) * 0.55;
      v += hat * Math.pow(f, 1.6) * 0.5;

      /* дешёвый «шум» — движение внутри полос */
      var n = 0.5 + 0.5 * Math.sin(i * 1.37 + t * 3.1) * Math.sin(i * 0.53 - t * 1.73);
      v *= 0.7 + 0.3 * n;

      /* мастеринг: компрессия и поднятый пол против сырого микса */
      v = after ? Math.pow(v, 0.8) : Math.pow(v, 1.32);
      v *= gain;
      if (v > 1.15) v = 1.15;

      var prev = Engine.bands[i];
      Engine.bands[i] = v > prev ? prev + (v - prev) * atk : prev + (v - prev) * rel;

      var p = Engine.peaks[i] - dt * 0.55;
      Engine.peaks[i] = Engine.bands[i] > p ? Engine.bands[i] : (p < 0 ? 0 : p);
      sum += Engine.bands[i];
    }

    Engine.level = sum / NB;
    Engine.low = (Engine.bands[1] + Engine.bands[2] + Engine.bands[3]) / 3;
  }

  /* ═══ CANVAS-ХЕЛПЕР ═════════════════════════════════════════════════ */

  function makeCanvas(parent, id, first, maxDpr) {
    var c = document.createElement('canvas');
    c.id = id;
    var ctx = c.getContext('2d');
    var state = { c: c, ctx: ctx, w: 0, h: 0, dpr: 1 };

    state.resize = function () {
      var r = parent.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, maxDpr || 1);
      state.w = Math.max(1, Math.round(r.width));
      state.h = Math.max(1, Math.round(r.height));
      state.dpr = dpr;
      c.width = state.w * dpr;
      c.height = state.h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    if (first && parent.firstChild) parent.insertBefore(c, parent.firstChild);
    else parent.appendChild(c);

    state.resize();
    return state;
  }

  /* ═══ 02. АТМОСФЕРА: стекло + круги от клика и скролла ══════════════ */

  function initAmbient() {
    if (!REDUCED) document.body.appendChild(Object.assign(el('div'), { id: 'nr-glass' }));

    var fx = el('div');
    fx.id = 'nr-fx';
    document.body.appendChild(fx);

    /* Анимация нажатия по экрану (круги от клика / тапа) */
    function spawnClickRipple(x, y) {
      for (var i = 1; i <= 3; i++) {
        var r = el('span', 'nr-ripple' + (i > 1 ? ' nr-ripple-' + i : ''));
        r.style.left = Math.round(x) + 'px';
        r.style.top = Math.round(y) + 'px';
        fx.appendChild(r);
        (function (node) { setTimeout(function () { node.remove(); }, 1200); })(r);
      }
    }

    /* Нажатия мышью на десктопе вызывают клик-анимацию сразу */
    document.addEventListener('pointerdown', function (e) {
      if (REDUCED || e.button !== 0) return;
      if (e.pointerType === 'touch') return; // Для тача проверяем скролл/тап отдельно
      if (e.target.closest && e.target.closest('input, textarea, .fader-rail, #nr-boot')) return;
      spawnClickRipple(e.clientX, e.clientY);
    }, { passive: true });

    /* Обработка тапа на мобильных устройствах (только клик, без скролла) */
    var touchStartX = 0;
    var touchStartY = 0;
    var touchStartTime = 0;
    var isTouchMoved = false;
    var touchTarget = null;

    window.addEventListener('touchstart', function (e) {
      if (REDUCED || !e.touches || !e.touches[0]) return;
      var t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchStartTime = performance.now();
      isTouchMoved = false;
      touchTarget = e.target;
    }, { passive: true });

    window.addEventListener('touchmove', function (e) {
      if (isTouchMoved || !e.touches || !e.touches[0]) return;
      var t = e.touches[0];
      var dist = Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY);
      if (dist > 8) {
        isTouchMoved = true;
      }
    }, { passive: true });

    window.addEventListener('touchend', function () {
      var tapDuration = performance.now() - touchStartTime;
      // Если палец не сдвигался (быстрый тап/клик) — создаём акустические круги клика
      if (!isTouchMoved && tapDuration < 500) {
        if (!touchTarget || !touchTarget.closest || !touchTarget.closest('input, textarea, .fader-rail, #nr-boot')) {
          spawnClickRipple(touchStartX, touchStartY);
        }
      }
    }, { passive: true });
  }

  /* ═══ 03. ШАПКА: линия прокрутки ════════════════════════════════════ */

  var scrollLine = null;

  function initHeader() {
    var header = $('#mainHeader');
    if (!header) return;
    scrollLine = el('div');
    scrollLine.id = 'nr-scrollline';
    header.appendChild(scrollLine);
  }

  /* ═══ 04. ГЕРОЙ: кольца, сканирование, параллакс ═══════════════════ */

  function initHero() {
    var section = $('#hero');
    if (!section) return;

    var box = $('.hero-mask-container', section);
    if (box) {
      if (!REDUCED) {
        box.appendChild(el('span', 'nr-scan-viewport', '<span class="nr-scan"></span>'));
        box.appendChild(el('span', 'nr-rings', '<i></i><i></i><i></i>'));
      }

      /* Параллакс/наклон фото — только на устройствах с мышью */
      if (window.matchMedia('(hover: hover) and (min-width: 1024px)').matches && !REDUCED) {
        box.addEventListener('pointermove', function (e) {
          var r = box.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width - 0.5;
          var py = (e.clientY - r.top) / r.height - 0.5;
          box.style.transform = 'perspective(900px) rotateY(' + (px * 7).toFixed(2) + 'deg) rotateX(' +
            (-py * 7).toFixed(2) + 'deg) translate3d(' + (px * 10).toFixed(1) + 'px,' + (py * 10).toFixed(1) + 'px,0)';
        });
        box.addEventListener('pointerleave', function () { box.style.transform = ''; });
      }
    }
  }

  /* ═══ 05. СЕКЦИЯ «СЛУШАЙ РАЗНИЦУ» (A/B): эквалайзер внизу на фоне ══════ */

  var playerCanvas = null, playerVisible = true;

  function initPlayerSectionEq() {
    var section = $('#player');
    if (!section || REDUCED) return;

    playerCanvas = makeCanvas(section, 'nr-player-canvas', true, 1.25);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (ents) {
        playerVisible = ents[0].isIntersecting;
      }).observe(section);
    }
  }

  function drawPlayerEq(now) {
    if (!playerCanvas || !playerVisible || document.hidden) return;
    var ctx = playerCanvas.ctx, w = playerCanvas.w, h = playerCanvas.h;
    ctx.clearRect(0, 0, w, h);

    var t = now / 1000;
    var lvl = Engine.level;
    var after = Engine.source !== 'before';
    var isPlaying = Engine.playing;

    /* Сетка студийного дисплея (ненавязчивая, в тон интерфейса) */
    if (!LITE) {
      ctx.strokeStyle = 'rgba(245,158,11,0.03)';
      ctx.lineWidth = 1;
      var step = 80;
      var off = (t * 6) % step;
      ctx.beginPath();
      for (var x = -off; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      for (var y = 0; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
    }

    /* Осциллограмма волны по нижней части секции */
    var baseLine = h * 0.74;
    var waveLayers = [
      { a: isPlaying ? 0.16 : 0.07, amp: 1.0, sp: 1.0, wd: 1.5 },
      { a: isPlaying ? 0.08 : 0.04, amp: 1.3, sp: -0.6, wd: 1.0 }
    ];
    var waveStep = LITE ? 16 : 8;

    for (var li = 0; li < waveLayers.length; li++) {
      var L = waveLayers[li];
      ctx.beginPath();
      ctx.strokeStyle = after ? 'rgba(245,158,11,' + L.a + ')' : 'rgba(148,163,184,' + L.a + ')';
      ctx.lineWidth = L.wd;
      for (var px = 0; px <= w; px += waveStep) {
        var u = px / w;
        var env = Math.sin(u * Math.PI);
        var amp = ((isPlaying ? 18 : 6) + lvl * 100) * L.amp * env;
        var yy = baseLine +
          Math.sin(u * 14 + t * 2.4 * L.sp) * amp * 0.55 +
          Math.sin(u * 32 - t * 3.2 * L.sp) * amp * 0.3 +
          Math.sin(u * 58 + t * 4.8 * L.sp) * amp * 0.15;
        px === 0 ? ctx.moveTo(px, yy) : ctx.lineTo(px, yy);
      }
      ctx.stroke();
    }

    /* Нижний эквалайзер: разреженные полосы спектра частот с градиентом и peak-hold */
    var barCount = LITE ? 36 : NB;
    var bw = w / barCount;
    var maxBarH = Math.min(220, h * 0.30);
    var stepRatio = NB / barCount;

    /* Оптимизация: создаём один общий градиент на весь кадр, а не 80 градиентов в цикле */
    var g = ctx.createLinearGradient(0, h, 0, h - maxBarH);
    if (after) {
      g.addColorStop(0, isPlaying ? 'rgba(245,158,11,0.28)' : 'rgba(245,158,11,0.09)');
      g.addColorStop(0.6, isPlaying ? 'rgba(251,191,36,0.18)' : 'rgba(251,191,36,0.05)');
      g.addColorStop(1, isPlaying ? 'rgba(255,231,178,0.22)' : 'rgba(255,231,178,0.07)');
    } else {
      g.addColorStop(0, isPlaying ? 'rgba(148,163,184,0.16)' : 'rgba(148,163,184,0.05)');
      g.addColorStop(1, isPlaying ? 'rgba(203,213,225,0.10)' : 'rgba(203,213,225,0.03)');
    }
    ctx.fillStyle = g;

    var peakColor = after
      ? (isPlaying ? 'rgba(255,236,190,0.45)' : 'rgba(255,236,190,0.18)')
      : (isPlaying ? 'rgba(226,232,240,0.25)' : 'rgba(226,232,240,0.10)');

    for (var i = 0; i < barCount; i++) {
      var srcIdx = Math.min(NB - 1, Math.floor(i * stepRatio));
      var v = Engine.bands[srcIdx];
      var bh = Math.max(2, v * maxBarH);
      var bx = i * bw;
      var barW = bw * 0.52;
      var posX = bx + bw * 0.24;

      ctx.fillRect(posX, h - bh, barW, bh);

      /* Пиковый индикатор (peak hold линия) */
      var p = Engine.peaks[srcIdx] * maxBarH;
      if (p > 4) {
        ctx.fillStyle = peakColor;
        ctx.fillRect(posX, h - p - 1.5, barW, 1.5);
        ctx.fillStyle = g;
      }
    }
  }

  /* ═══ 06. ЗАГОЛОВОК ГЕРОЯ — пословный вкат ══════════════════════════ */

  function splitWords(node) {
    if (!node) return;
    var frag = document.createDocumentFragment();
    var idx = 0;

    function processNode(parent, targetFrag) {
      Array.prototype.slice.call(parent.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          child.nodeValue.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { targetFrag.appendChild(document.createTextNode(part)); return; }
            var s = el('span', 'nr-w');
            s.textContent = part;
            s.style.animationDelay = (0.05 + idx * 0.075).toFixed(3) + 's';
            idx++;
            targetFrag.appendChild(s);
          });
        } else if (child.nodeName === 'BR') {
          targetFrag.appendChild(child.cloneNode(true));
        } else {
          var clone = child.cloneNode(false);
          processNode(child, clone);
          targetFrag.appendChild(clone);
        }
      });
    }

    processNode(node, frag);
    node.innerHTML = '';
    node.appendChild(frag);
  }

  function animateHeroTitle() {
    if (REDUCED) return;
    var h1 = $('#hero h1');
    if (h1 && !h1.querySelector('.nr-w')) splitWords(h1);
    else if (h1) { splitWords(h1); }
  }

  window.NickRiseAnimations = window.NickRiseAnimations || {};
  window.NickRiseAnimations.animateHeroTitle = animateHeroTitle;

  /* ═══ 07. КРИВАЯ ЭКВАЛАЙЗЕРА ПОД ЗАГОЛОВКАМИ СЕКЦИЙ ═════════════════ */

  function initEqLines() {
    var defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    defs.setAttribute('width', '0');
    defs.setAttribute('height', '0');
    defs.setAttribute('aria-hidden', 'true');
    defs.style.position = 'absolute';
    defs.innerHTML = '<defs><linearGradient id="nr-eqgrad" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="#F59E0B" stop-opacity="0"/>' +
      '<stop offset="35%" stop-color="#FBBF24" stop-opacity="1"/>' +
      '<stop offset="70%" stop-color="#F59E0B" stop-opacity="1"/>' +
      '<stop offset="100%" stop-color="#F59E0B" stop-opacity="0"/></defs>';
    document.body.appendChild(defs);

    ['#player', '#services', '#faq', '#contacts'].forEach(function (sel) {
      var sec = $(sel);
      if (!sec) return;
      var h2 = $('h2', sec);
      if (!h2 || !h2.parentElement || $('.nr-eqline', h2.parentElement)) return;

      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'nr-eqline');
      svg.setAttribute('viewBox', '0 0 240 24');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = '<path d="M2 18C24 18 32 7 54 7C78 7 84 19 108 15C130 11 138 4 164 8C188 12 196 18 210 13C222 9 230 12 238 12"/>' +
        '<circle cx="54" cy="7" r="0"/>';
      h2.parentElement.appendChild(svg);
      observeReveal(svg);
    });
  }

  /* ═══ 08. ПОЯВЛЕНИЕ ПРИ ПРОКРУТКЕ ═══════════════════════════════════ */

  var revealObserver = null;

  function observeReveal(node) {
    if (!node) return;
    if (REDUCED || !('IntersectionObserver' in window)) { node.classList.add('nr-in'); return; }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('nr-in');
          } else {
            en.target.classList.remove('nr-in');
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.15 });
    }
    revealObserver.observe(node);
  }

  function initReveal() {
    $$('#contacts .grid > a, #contacts .grid > button').forEach(function (n, i) {
      n.classList.add('nr-reveal');
      n.setAttribute('data-nr-d', String((i % 4) + 1));
      observeReveal(n);
    });
  }

  /* ═══ 09. СЧЁТЧИК ЦИФР (цены, статистика) ═══════════════════════════ */

  function countUp(node) {
    if (!node || node.dataset.nrDone === '1') return;
    var original = node.textContent;
    var m = original.match(/\d[\d\s\u00A0.,]*\d|\d/);
    if (!m) return;
    node.dataset.nrDone = '1';
    if (REDUCED) return;

    var raw = m[0];
    var sep = /[\s\u00A0]/.test(raw) ? raw.match(/[\s\u00A0]/)[0] : (raw.indexOf(',') > -1 ? ',' : '');
    var target = parseInt(raw.replace(/[^\d]/g, ''), 10);
    if (!isFinite(target) || target <= 0) return;

    function fmt(n) {
      var s = String(n);
      if (!sep) return s;
      return s.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    }

    var dur = 1100, t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur);
      var eased = 1 - Math.pow(1 - k, 3);
      node.textContent = original.replace(raw, fmt(Math.round(target * eased)));
      if (k < 1) requestAnimationFrame(step);
      else node.textContent = original; /* точный исходный текст возвращается всегда */
    })(t0);
  }

  /* ═══ 10. УСЛУГИ: индикаторы, наклон, списки, цены ══════════════════ */

  function decorateServices() {
    var cont = $('#servicesContainer');
    if (!cont) return;

    var isMobile = window.innerWidth < 640;

    Array.prototype.slice.call(cont.children).forEach(function (card) {
      if (!$('.nr-ledstrip', card) && !REDUCED && !isMobile) {
        card.appendChild(el('span', 'nr-ledstrip', new Array(9).join('<i></i>')));
      }
    });
  }

  /* ═══ 11. ТРЕК-ЛИСТ: отметка активного/играющего трека ══════════════ */

  function decorateTracks() {
    var cont = $('#trackListContainer');
    if (!cont) return;

    var playing = false;
    try {
      playing = typeof isAudioPlaying === 'function' && typeof activeTrackId !== 'undefined' &&
        activeTrackId && isAudioPlaying(activeTrackId);
    } catch (e) {}

    Array.prototype.slice.call(cont.children).forEach(function (card) {
      card.classList.remove('nr-current', 'nr-live');
    });

    var id = null;
    try { id = typeof activeTrackId !== 'undefined' ? activeTrackId : null; } catch (e) {}
    if (!id) return;

    var cur = document.getElementById('track-item-' + id);
    if (!cur) return;
    cur.classList.add('nr-current');
    if (!playing) return;

    cur.classList.add('nr-live');
    var overlay = $('.absolute.inset-0', cur);
    if (overlay && !$('.nr-eqbars', overlay) && !REDUCED) {
      overlay.appendChild(el('span', 'nr-eqbars', '<i></i><i></i><i></i><i></i>'));
    }
  }

  /* ═══ 12. ЭФФЕКТЫ НИЖНЕГО ПЛЕЕРА ════════════════════════════════════ */

  function swapDeckText() {
    if (REDUCED) return;
    $$('.deck-title, .deck-artist, .deck-genre').forEach(function (n) {
      n.classList.remove('nr-swap');
      void n.offsetWidth;
      n.classList.add('nr-swap');
    });
    $$('.deck-cover').forEach(function (n) {
      n.style.filter = 'brightness(2.2) saturate(0.4)';
      setTimeout(function () { n.style.filter = ''; }, 260);
    });
  }

  function crossfadeFlash() {
    if (REDUCED) return;
    var bar = $('#stickyPlayerBar');
    if (!bar) return;
    var f = el('span', 'nr-crossfade');
    bar.appendChild(f);
    setTimeout(function () { f.remove(); }, 820);
  }

  function seekPulse() {
    var p = $('#deckProgressBar');
    if (!p || REDUCED) return;
    p.classList.remove('nr-seek-pulse');
    void p.offsetWidth;
    p.classList.add('nr-seek-pulse');
  }

  /* ═══ 13. FAQ / МОДАЛКИ / ТОСТ / МЕНЮ ═══════════════════════════════ */

  function faqCard(id) {
    var body = document.getElementById('faq-body-' + id);
    return body ? body.parentElement : null;
  }

  function initToastMeter() {
    var toast = $('#toast');
    if (!toast || $('.nr-toast-meter', toast)) return;
    toast.appendChild(el('i', 'nr-toast-meter'));
  }

  function restartToastMeter() {
    var toast = $('#toast');
    if (!toast) return;
    var old = $('.nr-toast-meter', toast);
    if (old) old.remove();
    toast.appendChild(el('i', 'nr-toast-meter'));
  }

  function countModalStats() {
    $$('#aboutModal [data-i18n$="Num"]').forEach(function (n) {
      n.dataset.nrDone = '';
      countUp(n);
    });
  }

  /* ═══ 14. СТУДИЙНЫЙ ФЕЙДЕР И СКРОЛЛ ══════════════════════════════════ */

  var faderTimer = null;
  var isScrollTicking = false;
  var wasScrolled = false;

  function onScroll() {
    if (!isScrollTicking) {
      isScrollTicking = true;
      requestAnimationFrame(handleScrollUpdate);
    }
  }

  function handleScrollUpdate() {
    isScrollTicking = false;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var currentY = window.scrollY || doc.scrollTop || 0;

    var p = max > 0 ? Math.min(1, Math.max(0, currentY / max)) : 0;

    if (scrollLine) {
      scrollLine.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      scrollLine.style.opacity = p > 0.004 ? '1' : '0';
    }

    var isScrolled = currentY > 40;
    if (isScrolled !== wasScrolled) {
      wasScrolled = isScrolled;
      document.body.classList.toggle('nr-scrolled', isScrolled);
    }

    /* Десктопный SSL фейдер — активен только на экранах от 1024px */
    if (window.innerWidth >= 1024) {
      document.body.classList.add('nr-faderactive');
      clearTimeout(faderTimer);
      faderTimer = setTimeout(function () {
        document.body.classList.remove('nr-faderactive');
      }, 420);
    }
  }

  /* ═══ 15. ЭКОНОМИЯ РЕСУРСОВ ═════════════════════════════════════════ */

  function initViewportGate() {
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        en.target.classList.toggle('nr-off', !en.isIntersecting);
      });
    }, { rootMargin: '140px 0px' });
    $$('#hero, #player, #faq, #contacts, footer').forEach(function (n) { io.observe(n); });
  }

  /* ═══ 16. СИНХРОНИЗАЦИЯ СОСТОЯНИЙ ══════════════════════════════════ */

  var lastPlaying = null, lastSource = null;
  var beamAngle = 0;

  function updateBeamAngle(dt) {
    if (!Engine.playing || REDUCED) return;
    beamAngle = (beamAngle + dt * 130) % 360;
    var str = beamAngle.toFixed(1) + 'deg';
    var switches = document.querySelectorAll('.deck-source-switch');
    for (var i = 0; i < switches.length; i++) {
      switches[i].style.setProperty('--beam-angle', str);
    }
  }

  function syncBodyState() {
    if (Engine.playing !== lastPlaying) {
      lastPlaying = Engine.playing;
      document.body.classList.toggle('nr-playing', Engine.playing);
      safe(decorateTracks);
    }
    if (Engine.source !== lastSource) {
      lastSource = Engine.source;
      document.body.classList.toggle('nr-src-before', Engine.source === 'before');
      document.body.classList.toggle('nr-src-after', Engine.source !== 'before');
    }
  }

  /* ═══ 17. ГЛАВНЫЙ ЦИКЛ ══════════════════════════════════════════════ */

  var prev = performance.now();
  var lastPlayerEq = 0;
  var loopRunning = false;

  function startLoop() {
    if (!loopRunning && !document.hidden) {
      loopRunning = true;
      prev = performance.now();
      requestAnimationFrame(loop);
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      startLoop();
    } else {
      loopRunning = false;
    }
  });

  function loop(now) {
    if (document.hidden) {
      loopRunning = false;
      return;
    }
    var dt = Math.min(0.05, (now - prev) / 1000) || 0.016;
    prev = now;

    var isModalOpen = document.body.classList.contains('modal-open');

    safe(function () { updateEngine(now, dt); });
    safe(syncBodyState);
    if (!isModalOpen) {
      safe(function () { updateBeamAngle(dt); });
      /* фоновый эквалайзер в секции «Слушай разницу» — 30-40 fps */
      if (now - lastPlayerEq > (LITE ? 60 : 25)) {
        lastPlayerEq = now;
        safe(function () { drawPlayerEq(now); });
      }
    }
    requestAnimationFrame(loop);
  }

  /* ═══ 18. ХУКИ НА СУЩЕСТВУЮЩИЕ ФУНКЦИИ ══════════════════════════════
     Оригинал всегда вызывается первым и возвращает своё значение —
     механика сайта остаётся ровно такой же.
  ═════════════════════════════════════════════════════════════════════ */

  hook('renderTrackList', decorateTracks);
  hook('renderServices', decorateServices);
  hook('selectTrack', swapDeckText);
  hook('switchDeckSource', crossfadeFlash);
  hook('seekDeckTrack', seekPulse);
  hook('showToast', restartToastMeter);
  hook('openAboutModal', function () { setTimeout(countModalStats, 220); });
  hook('setLanguage', function () {
    animateHeroTitle();
    setTimeout(function () { safe(decorateServices); safe(decorateTracks); }, 0);
  });
  hook('openFaqItem', function (id) {
    var c = faqCard(id);
    if (c) c.classList.add('nr-faq-open');
  });
  hook('closeFaqItem', function (id) {
    var c = faqCard(id);
    if (c) c.classList.remove('nr-faq-open');
  });
  hook('openMobileMenu', function () {
    var d = $('#mobileMenuDrawer');
    if (d) { d.classList.remove('nr-open'); void d.offsetWidth; d.classList.add('nr-open'); }
  });
  hook('closeMobileMenu', function () {
    var d = $('#mobileMenuDrawer');
    if (d) d.classList.remove('nr-open');
  });

  /* ═══ 19. СТАРТ ═════════════════════════════════════════════════════ */

  function init() {
    safe(initAmbient);
    safe(initHeader);
    safe(initHero);
    safe(initPlayerSectionEq);
    safe(initEqLines);
    safe(initReveal);
    safe(initViewportGate);
    safe(initToastMeter);
    safe(animateHeroTitle);
    safe(decorateServices);
    safe(decorateTracks);

    /* зелёная вспышка на кнопках «копировать» */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[onclick^="copyText"]');
      if (!btn || REDUCED) return;
      btn.classList.remove('nr-copied');
      void btn.offsetWidth;
      btn.classList.add('nr-copied');
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () {
      safe(function () { playerCanvas && playerCanvas.resize(); });
      onScroll();
    }, { passive: true });

    onScroll();
    startLoop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
