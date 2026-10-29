/* ═══════════════════════════════════════════════════════════════════════
   NICK RISE STUDIO — СЛОЙ АНИМАЦИЙ (animations.js)
   Подключается ПОСЛЕ js/player-ui.js.

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
      (window.matchMedia && window.matchMedia('(max-width: 767.98px)').matches);
  } catch (e) {}
  if (LITE) document.documentElement.classList.add('nr-lite');

  /* iOS (iPhone и iPad, включая iPadOS 13+, который представляется как Mac):
     параллакс фона там выключен — см. css/style и initHeroParallax. */
  var isIOS = /iP(hone|ad|od)/.test(navigator.platform || '') ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) document.documentElement.classList.add('nr-ios');

  /* Телефон и планшет (<1024px): появления блоков при прокрутке выключены.
     Тот же медиазапрос, что в js/state.js (NR_NO_SCROLL_REVEAL) и в
     css/anim/12-reveal.css. ПК-версия не затрагивается. */
  var NO_REVEAL = window.matchMedia('(max-width: 1023.98px)').matches;

  /* Заставка «включения пульта» (#nr-boot) видна при каждом заходе/обновлении.
     Скрывает её initBoot() — см. ниже в этом файле (перед init). */

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

    // Тяжёлый расчёт спектра по тригонометрии пропускается, если канвас плеера
    // вне экрана и звук не играет
    if (!playerVisible && !st.playing) {
      Engine.level = 0;
      return;
    }

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
      var w = Math.max(1, Math.round(r.width));
      var h = Math.max(1, Math.round(r.height));
      /* Размер не изменился — буфер НЕ пересоздаём. Прежняя версия писала
         c.width/c.height на каждый resize безусловно, а запись в эти поля
         очищает канвас и заставляет браузер заново выделить память под всё
         полотно. На телефоне resize приходит и от плашки адресной строки
         (при первом свайпе), то есть самая дорогая операция приходилась
         ровно на кадр первого жеста. Теперь при совпадении размеров выходим. */
      if (w === state.w && h === state.h && dpr === state.dpr) return;
      state.w = w;
      state.h = h;
      state.dpr = dpr;
      c.width = w * dpr;
      c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    if (first && parent.firstChild) parent.insertBefore(c, parent.firstChild);
    else parent.appendChild(c);

    state.resize();
    return state;
  }

  /* ═══ АТМОСФЕРА: стекло + круги от клика и скролла (css/anim/02-atmosphere.css) ═══ */

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

    /* Нажатия мышью на десктопе вызывают клик-анимацию сразу. Исключение —
       ленты отзывов: на ПК их тянут мышью (js/reviews.js → initReviewDrag), и
       нажатие там ещё не значит клик. Круги ждут отпускания кнопки и
       появляются, только если указатель не сдвинулся (порог 6 px — как
       REVIEW_DRAG_THRESHOLD в js/reviews.js). */
    var reviewPress = null;

    document.addEventListener('pointerdown', function (e) {
      reviewPress = null; // прошлое нажатие больше не в счёт
      if (REDUCED || e.button !== 0) return;
      if (e.pointerType === 'touch') return; // Для тача проверяем скролл/тап отдельно
      if (e.target.closest && e.target.closest('input, textarea, .fader-rail, #nr-boot, #mobileMenuToggle, #mobileMenuDrawer, #mobileMenuOverlay')) return;
      if (e.target.closest && e.target.closest('#reviews .nr-marquee')) {
        reviewPress = { id: e.pointerId, x: e.clientX, y: e.clientY };
        return;
      }
      spawnClickRipple(e.clientX, e.clientY);
    }, { passive: true });

    /* Отпускание кнопки над лентой отзывов: клик без движения — круги,
       перетаскивание — тишина */
    document.addEventListener('pointerup', function (e) {
      if (!reviewPress || e.pointerId !== reviewPress.id) return;
      var press = reviewPress;
      reviewPress = null;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) return;
      spawnClickRipple(press.x, press.y);
    }, { passive: true });

    document.addEventListener('pointercancel', function (e) {
      if (reviewPress && e.pointerId === reviewPress.id) reviewPress = null;
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
        if (!touchTarget || !touchTarget.closest || !touchTarget.closest('input, textarea, .fader-rail, #nr-boot, #mainHeader, #mobileMenuToggle, #mobileMenuDrawer, #mobileMenuOverlay')) {
          spawnClickRipple(touchStartX, touchStartY);
        }
      }
    }, { passive: true });
  }

  /* ═══ ШАПКА: линия прокрутки (css/anim/03-header.css) ═══════════════════ */

  var scrollLine = null;
  var lineTarget = 0;      /* реальный прогресс страницы — куда стремимся */
  var lineValue = 0;       /* сглаженное значение, которое рисуем */
  var lineRunning = false; /* идёт ли плавная догонка */
  var lineVisible = false;

  /* Высота документа нужна для прогресса прокрутки. Читать scrollHeight в
     каждом кадре скролла — это принудительная переклейка тяжёлой раскладки, и
     именно она дёргала прокрутку НА ПК: там скролл ведёт наш модуль
     smoothscroll-nr.js в rAF, и лишний layout в кадре бьёт по плавности. На
     телефоне скролл нативный (компоситорный) — замер в кадре кадру не вредит.
     Поэтому на ПК высоту держим свежей СОБЫТИЯМИ (ResizeObserver на <html> и
     <body> ниже и resize окна), а в кадре пользуемся кэшем; на телефоне меряем
     живую высоту (см. liveScrollMax). */
  var scrollMax = 0;

  function refreshScrollMax() {
    var doc = document.documentElement;
    scrollMax = Math.max(0, doc.scrollHeight - window.innerHeight);
  }

  /* Предел прокрутки по ЖИВОЙ высоте документа — только для нативного скролла
     (телефон): там он не мешает кадру и держит полоску точной при «дыхании»
     адресной строки. */
  function liveScrollMax() {
    scrollMax = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    return scrollMax;
  }

  /* Ведёт ли прокрутку наш плавный модуль (ПК). Пока да — замер в кадре не
     делаем (см. liveScrollMax). Вызов лёгкий: модуль отдаёт состояние без
     аллокаций. Если модуля на странице нет (скролл нативный) — вернём false. */
  function smoothScrollDrives() {
    var ns = window.nrSmoothScroll;
    return !!(ns && typeof ns.isEnabled === 'function' && ns.isEnabled());
  }

  function computeScrollProgress() {
    var y = window.scrollY || 0;
    return scrollMax > 0 ? Math.min(1, Math.max(0, y / scrollMax)) : 0;
  }

  function paintScrollLine() {
    if (!scrollLine) return;
    // Ширина вместо transform: scaleX() — scaleX сплющивал box-shadow и свечение
    // точки ::after в размытое пятно в начале скролла (см. комментарий в css/anim)
    scrollLine.style.width = (lineValue * 100).toFixed(3) + '%';
    var visible = lineValue > 0.004;
    if (visible !== lineVisible) {
      lineVisible = visible;
      scrollLine.style.opacity = visible ? '1' : '0';
    }
  }

  /* Полоска всегда догоняет цель с easing. Из-за этого она не «дёргается» на
     быстрой прокрутке и не прыгает, когда высота страницы меняется без
     события scroll (открылся вопрос в FAQ, появился нижний плеер и т.п.).

     ПРАВКА ПРОТИВ ДЁРГАНЬЯ. Раньше догон шёл в СОБСТВЕННОМ rAF-цикле, отдельном
     от кадра прокрутки: на каждый кадр скролла работали уже ДВЕ независимые
     rAF-цепочки (handleScrollUpdate + runScrollLine) плюс tick инерционного
     скролла — три потребителя одного кадра браузера, и на 60 Гц это давало
     пропуски. Теперь шаг догона делает тот же кадр (stepScrollLine вызывается
     из handleScrollUpdate), а свой rAF поднимается ТОЛЬКО вне прокрутки —
     например когда высота страницы изменилась, а колесо не крутится.

     Догон сглаживаем по РЕАЛЬНОМУ времени между кадрами (экспоненциальное
     сглаживание), а не фиксированной долей за кадр: на телефоне кадров в разы
     меньше, и фиксированные 0.14 делали догон вялым — полоска отставала от
     пальца и казалась «стоящей». Теперь путь до цели проходится одинаково на
     любой частоте кадров.

     Возвращает true, если догон ещё не завершён (нужен следующий кадр). */
  var lineLastAt = 0;
  var LINE_TAU = 0.075; /* «постоянная времени» догона, с: меньше = резче */

  function stepScrollLine() {
    var diff = lineTarget - lineValue;
    if (Math.abs(diff) < 0.0006) {
      lineValue = lineTarget;
      lineRunning = false;
      lineLastAt = 0;
      paintScrollLine();
      return false;
    }
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    var dt = lineLastAt ? (now - lineLastAt) / 1000 : 0.016;
    lineLastAt = now;
    if (dt > 0.25) dt = 0.25;      /* пауза вкладки/долгий кадр — не «прыгаем» */
    var k = 1 - Math.exp(-dt / LINE_TAU);
    lineValue += diff * k;
    paintScrollLine();
    return true;
  }

  /* Вне цикла скролла доводим полоску отдельным кадром, пока есть разница. */
  function runScrollLineIdle() {
    if (!lineRunning) return;
    if (stepScrollLine()) requestAnimationFrame(runScrollLineIdle);
    else lineRunning = false;
  }

  function setScrollLineProgress(p, snap) {
    lineTarget = p;
    if (snap || REDUCED) {
      lineValue = p;
      lineRunning = false;
      paintScrollLine();
      return;
    }
    /* Догон ведёт кадр прокрутки, если он сейчас активен: в handleScrollUpdate
       вызывается stepScrollLine. Иначе (высота страницы изменилась без
       прокрутки) — поднимаем разовый rAF. */
    if (!lineRunning) {
      lineRunning = true;
      if (!scrollFrameActive()) requestAnimationFrame(runScrollLineIdle);
    }
  }

  /* Догон для кадра прокрутки. Отдельная функция, а не «if (lineRunning)» на
     месте вызова: во время скролла флаг мог ещё не подняться (первый кадр), и
     полоска не двигалась бы до следующего события. Здесь флаг поднимается сам,
     поэтому полоска начинает ехать с первого же кадра прокрутки. */
  function advanceScrollLine() {
    if (!lineRunning) lineRunning = true;
    stepScrollLine();
  }

  /* ─── Растворение фона шапки при прокрутке ──────────────────────────
     Вверху страницы панель полностью непрозрачна (100%), а на отрезке от
     FADE_START до FADE_END плавно уходит в полную прозрачность (0%): шапка
     «растворяется» и не закрывает контент.

     Почему в JS, а не парой CSS-классов: у background-color нет промежуточных
     значений между двумя правилами — переключение класса дало бы мгновенный
     скачок. Здесь прозрачность считается как непрерывная величина и пишется
     одной строкой в inline-стиль, поэтому переход получается плавным на любом
     устройстве и без анимации свойства (перерисовки недорогие).

     Значение 1 = 100% (панель плотная), 0 = 0% (панель полностью прозрачна).

     ФОН ПАНЕЛИ НЕ РИСУЕТСЯ ВООБЩЕ. Шапка прозрачная
     всегда (css/style → #mainHeader, background-color: transparent), поэтому
     под ней видны кадры главного экрана. Величина alpha остаётся рабочей: по
     ней считаются --nr-header-fade (логотип на телефоне гаснет при прокрутке)
     и класс nr-header-clear (полностью прозрачная панель не перехватывает
     клики). В inline-стиль background-color не пишется.

     РАСТВОРЕНИЕ РАВНОМЕРНОЕ.
     Задача от заказчика: прозрачность должна убывать «по чуть-чуть» на всём
     протяжении, одинаковыми шагами, и дойти ровно до нуля:

       прокрутка   непрозрачность
          50px          1.0      ← начало
         100px          0.9
         150px          0.8
         200px          0.7
         250px          0.6
         300px          0.5
         350px          0.4
         400px          0.3
         450px          0.2
         500px          0.1
         550px          0.0      ← конец

     Шаг ровно −0.1 на каждые 50px, то есть чистая линейная зависимость
     alpha = 1 − (y − 50) / 500. Никаких полок и S-кривых: прежние smoothstep
     и smootherstep ускоряли растворение в середине отрезка (в точке перегиба
     производная была в 1.5–1.875 раза выше средней), и глаз читал середину
     как «рывок», хотя края были мягкими. При линейном законе производная
     постоянна, поэтому движение выглядит спокойным на всём пути.

     Полка до 50px оставлена намеренно: она гасит случайные сдвиги в 1–2px
     (инерционный скролл на тачпаде, отскок), при которых шапка иначе бы
     «дышала» фоном в самом верху страницы. Это не разгон — наклон сразу после
     неё такой же, как везде. */
  var FADE_START = 50;  /* до этой прокрутки панель держится полностью плотной */
  var FADE_END = 550;   /* на этой прокрутке фон растворяется окончательно, 0% */
  var headerBgAlpha = -1; /* кэш последнего записанного значения */
  var headerClear = false; /* панель растворена целиком — клики сквозь неё */
  var headerNav = null;   /* меню шапки: «овал» под пунктами, см. css/anim */
  var logoHintEl = null;  /* подсказка про логотип: на телефоне гаснет вместе с ним */

  function paintHeaderFade(y) {
    var t = (y - FADE_START) / (FADE_END - FADE_START);
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    /* ЛИНЕЙНОЕ растворение: k = t, alpha = 1 − t.
       Шаг постоянный — −0.1 непрозрачности на каждые 50px прокрутки, как в
       таблице выше. Производная на всём отрезке одна и та же, поэтому нет ни
       ускорения в середине (чем грешили smoothstep/smootherstep), ни «полки»
       в начале и «отсечки» в конце. */
    var alpha = 1 - t;
    /* Записываем style только при реальном изменении: в начале страницы и
       после FADE_END значение держится постоянным, и кадры прокрутки не
       трогают DOM. */
    if (alpha === headerBgAlpha) return;
    headerBgAlpha = alpha;
    var header = $('#mainHeader');
    if (!header) return;
    /* Та же величина, но для логотипа: на телефоне он гаснет вместе с прежней
       «растворяющейся» панелью. CSS читает её в opacity кнопки
       (css/anim → «Растворённая панель»); на планшете и ПК переменная не
       используется — там логотип остаётся на месте. */
    header.style.setProperty('--nr-header-fade', alpha.toFixed(4));
    /* Прокрутка во время затухания бургер-меню: снимаем переход, который
       повесил closeMobileMenu (там он длится 1.2s — ровно ход шторки).
       Без этого фон секунду «догонял» бы палец вместо того, чтобы идти 1:1. */
    if (header.classList.contains('nr-menu-closing')) header.classList.remove('nr-menu-closing');
    /* Полностью прозрачная панель перестаёт перехватывать клики: под её
       полосой виден контент сайта, и нажимать нужно на него, а не в пустоту.
       Видимые элементы шапки (меню, бургер, кнопки) CSS включает обратно
       поимённо — см. #mainHeader.nr-header-clear. */
    var isClear = alpha <= 0.001;
    if (isClear !== headerClear) {
      headerClear = isClear;
      header.classList.toggle('nr-header-clear', isClear);
    }

    /* Подсказка про логотип: пока страница прокручена, у неё снято сглаживание
       по opacity (иначе бабл отставал бы от пальца), а когда он погас целиком —
       отключены и клики. Оба класса читает css/style → «Телефон: бабл гаснет
       вместе с логотипом»; на планшете и ПК правила не действуют. */
    if (!logoHintEl) logoHintEl = $('#logoHintTip');
    if (logoHintEl) {
      /* Ту же величину получает сам бабл: он лежит в body, а не в шапке, поэтому
         до inline-переменной шапки не достаёт. Пишем НА НЕГО, а не на <html>:
         кастомные свойства наследуются, и переменная на корне помечает
         пересчитать стили всего документа — на каждом кадре прокрутки, пока
         идёт затухание. На планшете и ПК это значение вообще никто не читает
         (оба правила — телефонные), так что запись на корне там была чистой
         работой впустую. */
      logoHintEl.style.setProperty('--nr-header-fade', alpha.toFixed(4));
      logoHintEl.classList.toggle('nr-logo-hint-fade', alpha < 0.999);
      logoHintEl.classList.toggle('nr-logo-hint-clear', isClear);
    }

    /* «Овал» под пунктами меню (десктоп) проявляется ровно в той мере, в
       какой прокручена страница, — обратной величиной 1 − alpha. Вверху
       страницы капсулы нет вовсе, а над уехавшим фото и карточками она
       держит меню читаемым вместо прежней обводки букв.
       Отступы и цвет капсулы задаёт CSS (css/anim →
       #mainHeader nav::before), здесь пишется только прозрачность — в
       кастомную переменную, чтобы не трогать сам элемент меню. */
    if (!headerNav) headerNav = $('#mainHeader nav');
    if (headerNav) headerNav.style.setProperty('--nr-nav-pill', (1 - alpha).toFixed(4));
  }

  function initHeader() {
    var header = $('#mainHeader');
    if (!header) return;
    /* Полоска прогресса крепится к <body>, а НЕ внутрь шапки.
       Раньше она лежала в шапке с bottom: -1px и садилась на её нижний край —
       то есть примерно на 64–80px от верха экрана, под логотипом. Теперь она
       position: fixed; top: 0 и висит на самой верхней кромке окна: остаётся
       на месте, когда шапка растворяется, и не зависит от её высоты. */
    scrollLine = el('div');
    scrollLine.id = 'nr-scrollline';
    document.body.appendChild(scrollLine);

    /* Стартовое положение: страница может открыться уже прокрученной
       (якорь в ссылке, возврат на позицию) — ставим фон сразу, без анимации. */
    paintHeaderFade(window.scrollY || 0);

    refreshScrollMax();
    setScrollLineProgress(computeScrollProgress(), true);

    /* Высота документа меняется и без прокрутки: открыли вопрос в FAQ, показался
       нижний плеер, догрузился шрифт. Тогда цель пересчитываем — иначе полоска
       «резко смещается» на первом же скролле. */
    if (typeof ResizeObserver === 'function') {
      var rafId = 0;
      /* Документ изменил высоту — пересчитываем её один раз здесь, а не в
         каждом кадре прокрутки (см. refreshScrollMax). */
      function onDocResize() {
        if (rafId) return;
        rafId = requestAnimationFrame(function () {
          rafId = 0;
          safe(refreshScrollMax);
          safe(function () { setScrollLineProgress(computeScrollProgress(), false); });
        });
      }
      new ResizeObserver(onDocResize).observe(document.documentElement);
      if (document.body) {
        new ResizeObserver(onDocResize).observe(document.body);
      }
    }
  }

  /* ═══ ГЕРОЙ: кольца, сканирование, параллакс (css/anim/04-hero.css) ═════ */

  /* ─── ПАРАЛЛАКС ФОНА ГЛАВНОГО ЭКРАНА (hero-bg-1..5.webp) ───────────────
     ЗАДАЧА. При прокрутке кадр студии уезжает вниз чуть медленнее контента:
     фон «отстаёт» и главный экран выглядит объёмнее. Размер и положение
     самого фото НЕ меняются — двигается весь слой .hero-bg-layer целиком.

     ДВА ПУТИ, ОДНА КРИВАЯ. Там, где браузер умеет
     scroll-driven animation (animation-timeline: scroll()), эффект считает
     САМ ДВИЖОК: анимация слоя привязана к прокрутке страницы, JS в кадре не
     участвует вообще (CSS — css/style/02-hero-bg.css, блок «ПАРАЛЛАКС НА ДВИЖКЕ»). Всё, что
     делает скрипт в этом режиме, — один раз пишет длину диапазона
     (--nr-hero-parallax-range) при инициализации и на resize.

     Здесь остаётся ФОЛБЭК для браузеров без таймлайнов: сдвиг считается от
     положения героя и пишется в --nr-hero-parallax-y. Кривая и потолок у
     обоих путей одинаковые, поэтому на вид разницы нет.

     iOS — ИСКЛЮЧЕНИЕ: там не работает ни один путь, эффект выключен целиком
     (см. initHeroParallax). Причина у обоих механизмов общая — плашка
     адресной строки подкручивает scrollY на свою высоту, а сдвиг так или
     иначе привязан к прокрутке.

     ПОЧЕМУ ЭТО ЛУЧШЕ РАСЧЁТА В JS. В режиме движка между прокруткой и сдвигом
     нет посредника: одно и то же значение прогресса используется и для
     контента, и для фото. При расчёте в JS в кадр показа/скрытия плашки
     приходило «старое» значение — фото уезжало вслед за панелью. Движок
     ровнее, но и он не спасает: прогресс scroll(root) — это сама позиция
     прокрутки, а она на iOS в этот момент прыгает. Отсюда решение выключить
     эффект на iOS совсем (подробнее — в css/style).

     ПОЧЕМУ СДВИГ ВНИЗ, А НЕ ВВЕРХ. Секция уезжает вверх на S пикселей; слой
     мы опускаем на shift(S). Видимый кадр смещается вверх на S − shift, то
     есть фото движется вниз относительно секции — ровно то, что нужно.

     ДО КАКОГО МОМЕНТА ЕДЕТ. Раньше сдвиг ограничивался фиксированными 64px,
     и уже на 400px прокрутки фон «замирал» — глаз читал это как остановку
     эффекта, хотя секция продолжала уезжать ещё почти на пол-экрана. Теперь
     потолок не константа, а доля НАЧАЛЬНОЙ высоты главного экрана: движение
     идёт ровно столько, сколько длится сам главный экран, и заканчивается
     вместе с ним. Высота секции кэшируется в refreshHeroParallaxRange и
     перечитывается только на resize/повороте: секция при прокрутке высоту не
     меняет (на компьютере её держит min-height из css/style, на телефоне и
     планшете высота зависит только от содержимого — при прокрутке оно не
     меняется). Живой замер в кадре — это только rect.top (см. ниже), он
     дешевле полного пересчёта размеров и не «переклеивает» раскладку.

     ПОЧЕМУ НЕТ ПУСТОЙ ПОЛОСЫ НАД ФОТО. PARALLAX_RATE < 1 и потолок равен
     PARALLAX_RATE × высота, поэтому shift ≤ S на всём пути (в потолок кривая
     упирается как раз на S = высоте секции, то есть когда она уже за
     экраном). Верхний край слоя оказался бы выше нуля окна только при
     shift > S, чего не бывает, — значит обнажённой полосы фона html над фото
     не видно ни в одном кадре. Снизу слой только вылезает за секцию, и это
     безвредно: на телефоне он просто уходит вниз, перекрывая зазор до #player
     (секция больше НЕ обрезается — overflow-y: clip снят, см. css/style/03-hero-layout.css,
     блок «БЕЗ ЖЁСТКОЙ ВЫСОТЫ»), на компьютере он и так дотянут на 80px до
     #player (см. css/style/02-hero-bg.css).

     ПОЧЕМУ СЧИТАЕМ ОТ НАЧАЛА СТРАНИЦЫ, А НЕ ОТ ВЕРХА СЕКЦИИ. Верх секции — не
     нуль прокрутки: у main есть padding-top под шапку (pt-16 = 64px; на lg
     он снят, lg:pt-0). Если отсчитывать от верха секции, то на телефоне
     первые 64px прокрутки приходились на «мёртвую зону» (y − top ≤ 0) — фон
     стоял, а потом эффект начинался как бы с середины. Поэтому нуль — начало
     страницы: сдвиг растёт с первого же пикселя прокрутки на всех экранах.
     Длину пути добираем до низа секции (height + её отступ сверху), чтобы
     ход эффекта остался прежним и движение заканчивалось ровно вместе с
     уходом главного экрана.

     ЧТО ЧИТАЕМ В КАДРЕ ПРОКРУТКИ — rect.top, А НЕ window.scrollY.
     С scrollY есть проблема с адресной строкой: когда браузер прячет или
     показывает панель, он подкручивает scrollY на её высоту (50–100px), чтобы
     видимая часть не «прыгнула». Параллакс от scrollY в этот кадр уезжает на
     четверть этой величины — фото дёргается за адресной строкой.
     Спрятать это фильтром-эвристикой (сравнивать скачок scrollY с приращением
     высоты окна) можно, но это догадка: нужно угадать величину, окно времени
     и допуск.

     getBoundingClientRect().top — это готовый ответ, без догадок. Он отдаёт
     ПОЛОЖЕНИЕ ГЕРОЯ В ОКНЕ, а не значение прокрутки: подкрутку scrollY браузер
     делает именно для того, чтобы элемент остался на месте, поэтому rect.top
     в этот момент НЕ меняется, а при настоящей прокрутке меняется ровно на её
     величину. Компенсация уже посчитана внутри rect — руками её считать и
     накапливать не нужно (прежние parallaxComp/parallaxJump удалены целиком).
     Ни innerHeight, ни scrollY в формуле больше нет, поэтому смещению
     физически неоткуда взяться при выезде панели.

     Сколько пикселей страница проехала, получаем как разность постоянной
     страничной координаты верха секции (parallaxDocTop, кэш) и живого rect.top.
     Сама координата считается один раз по цепочке offsetTop (это НЕ scrollY:
     никакой подкрутки панели в ней нет) и обновляется только на resize и при
     повороте экрана — вместе с высотой секции.

     Чтение rect в каждом кадре безопасно: сначала читаем, потом пишем, а
     запись идёт в кастомное свойство, которое потребляет только transform, —
     раскладку она не инвалидирует, принудительного синхронного layout нет. */
  var parallaxSection = null;     /* #hero */
  var parallaxLayer = null;       /* .hero-bg-layer внутри #hero */
  var parallaxDocTop = 0;         /* страничная координата ВЕРХА #hero, px (кэш) */
  var parallaxHeight = 0;         /* высота #hero, px (кэш) */
  var parallaxShift = -1;         /* нарисованное смещение, px (−1 — «ещё не рисовали») */
  /* 0.25 от высоты экрана. История: 0.16 → 0.20 → 0.30 → 0.25 — эффект
     усиливали, затем немного ослабили. Значение должно оставаться < 1: иначе
     сдвиг на длинном пути превысит высоту секции и сверху над фото откроется
     пустая полоса (см. «ПОЧЕМУ НЕТ ПУСТОЙ ПОЛОСЫ НАД ФОТО» выше). */
  var PARALLAX_RATE = 0.25;

  /* Умеет ли браузер scroll-driven animation. Проверяем ровно тот же признак,
     по которому срабатывает @supports в css/style, — чтобы JS и CSS не
     разошлись: иначе в одном браузере эффект считали бы оба механизма сразу
     (или ни одного). */
  var nativeParallax = !!(window.CSS && window.CSS.supports &&
    window.CSS.supports('animation-timeline', 'scroll()'));

  function initHeroParallax() {
    /* iOS: scroll-driven параллакс там врёт — при скрытии/показе плашки
       адресной строки scrollY прыгает на её высоту (60–110px), а прогресс
       animation-timeline: scroll(root) — это ровно позиция прокрутки. Слой
       поэтому дёргался вниз на 15–27px (0.25 от высоты плашки) и там оставался,
       пока плашку не вернут. Компенсировать это в CSS нечем: таймлайн нельзя
       поправить на величину панели. Поэтому на iOS эффекта нет — фон стоит на
       месте, слайдшоу кадров продолжает работать (css/style, html.nr-ios). */
    if (isIOS) return;
    parallaxSection = $('#hero');
    if (!parallaxSection) return;
    parallaxLayer = $('.hero-bg-layer', parallaxSection);
    if (!parallaxLayer) return;
    refreshHeroParallaxRange();
    updateHeroParallax();
  }

  /* Кэш постоянных величин: страничная координата верха секции и её высота.
     Читаются только здесь (resize, поворот экрана), в кадре прокрутки их нет.
     Верх считаем по цепочке offsetTop, а НЕ через scrollY: offsetTop — это
     раскладка, подкрутка scrollY от адресной строки в неё не попадает. */
  function refreshHeroParallaxRange() {
    if (!parallaxSection) return;
    var top = 0;
    var el = parallaxSection;
    while (el) {
      top += el.offsetTop;
      el = el.offsetParent;
    }
    parallaxDocTop = top;
    parallaxHeight = parallaxSection.offsetHeight;
    /* −1: следующий расчёт гарантированно перерисует слой (после resize или
       поворота телефона старое нарисованное значение уже неверно). */
    parallaxShift = -1;
    /* РЕЖИМ ДВИЖКА: сообщаем CSS длину пути. Это ровно тот же travel, по
       которому считается фолбэк ниже (верх секции + её высота), поэтому обе
       ветки дают одинаковую кривую. Пишется на #hero — слой наследует.
       Вызывается только из init и обработчика resize, в кадре прокрутки
       записи нет. */
    if (nativeParallax) {
      parallaxSection.style.setProperty(
        '--nr-hero-parallax-range',
        (parallaxDocTop + parallaxHeight) + 'px'
      );
    }
  }

  function setHeroParallax(shift) {
    if (!parallaxLayer) return;
    /* Порог 0.1px: на такой сдвиг пиксель не изменится, а запись в style
       каждый кадр зря будила бы композитор. */
    if (Math.abs(shift - parallaxShift) < 0.1) return;
    parallaxShift = shift;
    parallaxLayer.style.setProperty('--nr-hero-parallax-y', shift.toFixed(2) + 'px');
  }

  function updateHeroParallax() {
    if (!parallaxLayer) return;
    /* РЕЖИМ ДВИЖКА: сдвиг считает анимация (css/style), JS не вмешивается —
       ни чтения rect, ни записи в style. Именно этого и добивались: в кадре
       прокрутки не остаётся ничего, что могло бы разойтись с прокруткой. */
    if (nativeParallax) return;
    /* ЖИВОЕ ПОЛОЖЕНИЕ ГЕРОЯ В ОКНЕ. Единственное чтение геометрии в кадре
       прокрутки; подкрутка scrollY при показе/скрытии панели на rect.top не
       влияет (см. блок «ЧТО ЧИТАЕМ В КАДРЕ ПРОКРУТКИ» выше), поэтому сдвиг
       не дёргается вслед за адресной строкой. На компьютере та же формула
       даёт ровно прежние значения: rect.top = docTop − scrollY. */
    var top = parallaxSection.getBoundingClientRect().top;
    /* Сколько пикселей страница проехала: от начала документа до низа секции.
       Отрицательное значение (резиновый отскок, подтягивание вверх) даёт 0,
       дальше низа секции сдвиг не растёт — эффект заканчивается вместе с
       уходом главного экрана. */
    var passed = parallaxDocTop - top;
    if (passed < 0) passed = 0;
    var travel = parallaxDocTop + parallaxHeight;
    if (passed > travel) passed = travel;
    setHeroParallax(REDUCED ? 0 : passed * PARALLAX_RATE);
  }

  /* ─── СЛАЙДШОУ ФОНА ГЛАВНОГО ЭКРАНА (hero-bg-1..5.webp) ─────────────────
     ЗАДАЧА. Пять кадров студии сменяют друг друга по кругу 1 → 2 → 3 → 4 → 5 → 1
     каждые HERO_SLIDE_MS, каждый проявляется плавным растворением (opacity,
     transition — css/style, .hero-bg-slide).

     ПОЧЕМУ СМЕНА НЕ МЕШАЕТ ПАРАЛЛАКСУ. Сдвиг при прокрутке висит на самом
     .hero-bg-layer (см. initHeroParallax), а кадры — его дети: двигается весь
     слой целиком, кадры только меняют прозрачность.

     ПОЧЕМУ ГРУЗИМ НЕ ВСЕ СРАЗУ. Кадр 1 отдан прямо в разметке и виден без JS.
     Остальные четыре появляются из data-bg только после того, как их скачал
     new Image(): пять полноэкранных кадров, запрошенные одновременно с первым
     экраном, мешали бы главному фото (LCP) и шрифтам. Пока кадр не загружен,
     он прозрачен; если файл не загрузился — кадр в смене не участвует, и
     слайдшоу идёт по загрузившимся.

     REDUCED («уменьшить движение»): смены нет вовсе — остаётся кадр 1. */
  var HERO_SLIDE_MS = 6000;   /* сколько кадр держится на экране */

  function initHeroSlideshow() {
    var layer = $('#hero .hero-bg-layer');
    if (!layer) return;
    var slides = $$('.hero-bg-slide', layer);
    if (slides.length < 2 || REDUCED) return;

    var usable = [true];   /* кадр 1 (из разметки) рабочий всегда */
    var waiting = 0;

    function start() {
      var frames = [];
      for (var k = 0; k < slides.length; k++) {
        if (usable[k]) frames.push(slides[k]);
      }
      if (frames.length < 2) return;
      var index = 0;
      setInterval(function () {
        /* «Уменьшить движение» включили уже после старта — смена замирает
           на текущем кадре (REDUCED обновляет подписка выше по файлу). */
        if (REDUCED) return;
        frames[index].classList.remove('is-active');
        index = (index + 1) % frames.length;
        frames[index].classList.add('is-active');
      }, HERO_SLIDE_MS);
    }

    /* Ждём последний кадр: пока очередь не опустела, смену не начинаем —
       иначе первые переключения пришлись бы на ещё не загруженные кадры. */
    function done() {
      if (--waiting > 0) return;
      start();
    }

    for (var i = 1; i < slides.length; i++) {
      (function (slide, slot) {
        var src = slide.getAttribute('data-bg');
        if (!src) return;
        waiting++;
        var probe = new Image();
        probe.onload = function () {
          slide.style.backgroundImage = 'url("' + src + '")';
          usable[slot] = true;
          done();
        };
        probe.onerror = done;
        probe.src = src;
      })(slides[i], i);
    }
  }

  function initHero() {
    var section = $('#hero');
    if (!section) return;

    var box = $('.hero-mask-container', section);
    if (box) {
      if (!REDUCED) {
        box.appendChild(el('span', 'nr-scan-viewport', '<span class="nr-scan"></span>'));
        box.appendChild(el('span', 'nr-rings', '<i></i><i></i><i></i>'));
      }

      /* Параллакс/наклон фото — только на устройствах с мышью.
         Трансформа вешается на САМУ КАРТИНКУ, а не на контейнер: над бейджем
         «Обо мне» (он лежит в контейнере) любой transform родителя заставляет
         Chrome растеризовать надпись бейджа в отдельный слой без субпиксельного
         сглаживания, и на наведении текст «мылится». Картинке это не вредит.

         Класс nr-tilt-live переключает переход картинки на короткий шаг
         (css/anim/04-hero.css, у .hero-mask-container): без него общий переход
         transform 0.65 с из css/style стартовал на каждом pointermove заново — и
         пока указатель ехал, фото топталось в начале кривой, а наклон проявлялся
         только после остановки мыши. Снимаем класс на pointerleave ДО сброса
         transform: тогда возврат в покой идёт с прежними 0.65 с и остаётся
         плавным. */
      var img = $('.hero-mask-img', box);
      if (img && window.matchMedia('(hover: hover) and (min-width: 1024px)').matches && !REDUCED) {
        box.addEventListener('pointermove', function (e) {
          var r = box.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width - 0.5;
          var py = (e.clientY - r.top) / r.height - 0.5;
          box.classList.add('nr-tilt-live');
          img.style.transform = 'perspective(900px) rotateY(' + (px * 7).toFixed(2) + 'deg) rotateX(' +
            (-py * 7).toFixed(2) + 'deg) translate3d(' + (px * 10).toFixed(1) + 'px,' + (py * 10).toFixed(1) + 'px,0) scale(1.02)';
        });
        box.addEventListener('pointerleave', function () {
          box.classList.remove('nr-tilt-live');
          img.style.transform = '';
        });
      }
    }
  }

  /* ═══ ЗАМОРОЗКА ВЫСОТЫ ОКНА (телефон и планшет) ════════════════════════════
     В сторонних браузерах на iOS (Chrome, Яндекс, Google, Firefox — все на
     WebKit, bug 279998) svh/lvh/dvh считаются как dvh и «дышат» на 60–110 px
     при показе/скрытии плашки адресной строки: главный экран менял высоту, а
     вместе с ним пересчитывался кроп фона (background-size: cover), поэтому
     фото то укрупнялось, то уменьшалось. В Safari этой ошибки нет — там всё
     было ровно.

     РЕШЕНИЕ. Видимая высота окна меряется один раз — при загрузке, когда
     панели браузера показаны (это и есть минимум, он же svh), — из неё
     вычитается системная полоса iPhone, и результат пишется в --nr-vh.
     Дальше CSS читает только эту переменную, поэтому от плашки высота не
     зависит: секция, её фон и текст стоят на месте, а страница ниже не
     «едет» вслед за изменением высоты документа.

     КОГДА ПЕРЕСЧИТЫВАЕМ. Сменилась ШИРИНА — это поворот экрана или ресайз
     окна: меряем заново. Высота стала МЕНЬШЕ замороженной — плашка вернулась
     или появились новые панели: берём новое, меньшее значение (оно всегда
     стремится к svh). Высота выросла — это скрытие плашки, значение не
     трогаем: именно ради этого всё и затевалось. Настоящий ресайз окна
     (не плашка — его признак уже вычислен в обработчике resize) пересчитывает
     высоту целиком, в любую сторону: ремера аргументом remeasure. */
  var vhLockW = 0, vhLockH = 0, vhSafeBottom = 0;

  function lockViewportHeight(remeasure) {
    var w = window.innerWidth;
    var h = window.innerHeight - vhSafeBottom;
    if (h <= 0) return;
    if (w !== vhLockW) { vhLockW = w; remeasure = true; }
    if (!remeasure && vhLockH && h >= vhLockH) return;
    vhLockH = h;
    document.documentElement.style.setProperty('--nr-vh', h + 'px');
  }

  /* Системную полосу (home indicator) меряем пробником: env() в CSS меняется
     вместе с панелью (0 ↔ 34 px), поэтому значение нужно узнать заранее и
     один раз — иначе вместе с плашкой «дышала» бы и высота. */
  function initViewportHeightLock() {
    var probe = el('div');
    probe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    vhSafeBottom = Math.round(probe.getBoundingClientRect().height) || 0;
    document.body.removeChild(probe);
    lockViewportHeight();
  }

  /* ═══ СЕКЦИЯ «СЛУШАЙ РАЗНИЦУ» (A/B): эквалайзер на фоне (css/anim/06-tracks.css) ═══ */

  /* playerVisible по умолчанию false: пока отложенная инициализация не
     создаст canvas и IntersectionObserver (после load), считаем, что секции
     на экране нет, и не держим rAF-цикл живым вхолостую. */
  var playerCanvas = null, playerVisible = false;

  function initPlayerSectionEq() {
    var section = $('#player');
    if (!section || REDUCED) return;

    playerCanvas = makeCanvas(section, 'nr-player-canvas', true, 1.25);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (ents) {
        playerVisible = ents[0].isIntersecting;
        /* Секция вернулась в кадр — будим главный цикл: когда плеер был
           за экраном и звук молчал, цикл спал и не рисовал фон. */
        if (playerVisible) wakeLoop();
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

  /* ═══ ЗАГОЛОВОК ГЕРОЯ — пословный вкат (css/style/12-hero-title.css) ════ */

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

  /* ═══ КРИВАЯ ЭКВАЛАЙЗЕРА ПОД ЗАГОЛОВКАМИ СЕКЦИЙ (css/anim/05-section-titles.css) ═══ */

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

    ['#player', '#services', '#faq', '#contacts', '#reviews'].forEach(function (sel) {
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

  /* ═══ ПОЯВЛЕНИЕ ПРИ ПРОКРУТКЕ (css/anim/12-reveal.css) ══════════════════ */

  var revealObserver = null;
  var revealNodes = [];

  function getRevealRootMargin() {
    var bar = document.getElementById('stickyPlayerBar');
    var isActive = bar && (bar.classList.contains('active') || document.body.classList.contains('has-sticky-player'));
    if (isActive) {
      var h = bar.offsetHeight || (window.innerWidth >= 640 ? 96 : 84);
      return '0px 0px -' + Math.round(h + 20) + 'px 0px';
    }
    return '0px 0px -8% 0px';
  }

  function updateRevealObserver() {
    if (!('IntersectionObserver' in window)) return;
    if (revealObserver) {
      revealObserver.disconnect();
    }
    revealObserver = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        /* Появление строго один раз: nr-in не снимается, элемент сразу
           снимается с наблюдения — кривая под заголовком секции рисуется
           единожды, а плитки контактов и ленты отзывов не пропадают при
           прокрутке вверх. */
        if (!en.isIntersecting) return;
        en.target.classList.add('nr-in');
        revealObserver.unobserve(en.target);
      });
    }, { rootMargin: getRevealRootMargin(), threshold: 0.15 });

    for (var i = 0; i < revealNodes.length; i++) {
      var node = revealNodes[i];
      if (node && node.isConnected && !node.classList.contains('nr-in')) {
        revealObserver.observe(node);
      }
    }
  }

  function observeReveal(node) {
    if (!node) return;
    if (REDUCED || NO_REVEAL || !('IntersectionObserver' in window)) { node.classList.add('nr-in'); return; }
    if (revealNodes.indexOf(node) === -1) {
      revealNodes.push(node);
    }
    if (!revealObserver) {
      updateRevealObserver();
    } else {
      revealObserver.observe(node);
    }
  }

  window.NickRiseAnimations = window.NickRiseAnimations || {};
  window.NickRiseAnimations.updateRevealObserver = updateRevealObserver;

  function initReveal() {
    $$('#contacts .grid > a, #contacts .grid > button').forEach(function (n, i) {
      n.classList.add('nr-reveal');
      n.setAttribute('data-nr-d', String((i % 4) + 1));
      observeReveal(n);
    });

    /* Ряды бегущих лент отзывов (#reviews) — тот же мягкий подъём снизу,
       что у плиток контактов. Карточки по отдельности не анимируем: их в ленте
       десятки, а у ряда уже есть своя бесконечная анимация сдвига. */
    $$('#reviews .nr-marquee').forEach(function (n, i) {
      n.classList.add('nr-reveal');
      n.setAttribute('data-nr-d', String(i + 1));
      observeReveal(n);
    });
  }

  /* ═══ СЧЁТЧИК ЦИФР (цены, статистика) ═══════════════════════════════════ */

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

  /* ═══ КАДРЫ 1–3 «ОБО МНЕ»: ВХОД ПО ТАЙМЛАЙНУ (css/anim/15-about.css) ═══════
     Только полноэкранный раздел на компьютере (#aboutShowcase). При переходе
     на кадр текст собирается по шагам.

     Кадр 1:
       1) появляется плашка «6+ лет в индустрии»;
       2) имя печатается по буквам (1 с);
       3) под именем по очереди встают две строки подзаголовка —
          «Звукорежиссер» и «Сведения / Мастеринга» (aboutModal.subtitle1/2);
       4) биография слева печатается по буквам — абзацами: все строки абзаца
          стартуют одновременно и идут слева направо, потом так же второй;
       5) последней всплывает подсказка «Листайте» и светится — вспышка,
          затухание, вспышка — пока зритель не листнёт первый раз
          (css/anim/15-about.css).

     Кадр 2:
       1) заголовок «Проходил обучение у» печатается по буквам (1 с);
       2) кнопки обучения вставляются по одной;
       3) после последней кнопки слева направо проходит разделяющая линия;
       4) в тот же кадр, что и линия (она ещё идёт), по одной появляются три
          цифры (countUp выше) с печатью подписи.

     Кадр 3:
       1) «С радостью готов поработать с тобой!» печатается по буквам (1 с);
       2) строка со скидкой выезжает слева — сразу, как легла последняя буква;
       3) вопросы выезжают слева по одному;
       4) кнопки появляются снизу по одной — сразу за последним вопросом.

     РИТМ ОДИН НА ОБА КАДРА: между любыми двумя шагами ровно ABOUT_GAP —
     0.3 с от конца предыдущей анимации до старта следующей. Появление кнопок
     и цифр длится столько же (ABOUT_SHOW_MS = 0.3 с, transition в
     css/anim), поэтому шаги идут встык, без наложений: элемент встал на
     место — через 0.3 с стартует следующий. Долгие «фазы» (печать 1 с и
     прочерчивание линии 1 с) считаются целиком: следующая группа ждёт их
     конца, а не старта. Исключения:
     • линия кадра 2 идёт без паузы после последней кнопки (ABOUT2_RULE_GAP = 0):
       провал в 0.3 с на неподвижной колонке был заметен, линия подхватывает
       движение сразу, как кнопка села на место;
     • цифры кадра 2 стартуют вровень с линией (ABOUT2_RULE_TO_STAT = 0), а не
       после её конца: полоса ползёт секунду, и все три карточки успевают встать,
       пока она идёт, — цифры и линия читаются одним движением;
     • кадр 3 идёт без пауз между группами (ABOUT3_GAP = 0): скидка, вопросы и
       кнопки подхватывают друг друга в тот же кадр. Три зазора по 0.3 с подряд
       растягивали финал до 3.4 с, и колонка трижды замирала на пустом месте.
       Шаг ВНУТРИ группы (ABOUT_GAP = длительность появления) остался прежним —
       поэтому пары «вопрос-вопрос» и «кнопка-кнопка» по-прежнему идут встык.

     Темп правится одной константой ABOUT_GAP — моменты старта ниже посчитаны
     от неё, руками их менять не нужно. Исключение — правая колонка кадра 1: она
     идёт своим, чуть более плотным ритмом ABOUT1_GAP, чтобы кадр не «зависал»
     на пустом экране (плашка → имя → подзаголовок); строки подзаголовка идут
     друг за другом через ABOUT1_SUB_GAP. Биография кадра 1 живёт по
     своим правилам: это печать по буквам, скорость — ABOUT1_TYPE_SPEED, паузы
     между абзацами нет (ABOUT1_PARA_GAP = 0 — второй абзац стартует в тот же
     кадр, когда легла последняя буква первого, биография читается одним
     потоком), длительность абзаца считается по его самой длинной строке (строки
     абзаца печатаются одновременно), поэтому у русского и английского текста
     она своя. Отдельный зазор ABOUT1_HINT_GAP оставлен только на выход
     подсказки «Листайте» — ей нужно чуть-чуть воздуха после последней буквы.
     Состояния — css/anim/15-about.css, запуск — хук на aboutGoToSlide()
     в блоке «ХУКИ НА СУЩЕСТВУЮЩИЕ ФУНКЦИИ».
     Полный таймлайн играется ОДИН раз за загрузку страницы (флаги
     about1Played / about2Played / about3Played живут в памяти модуля): при
     повторном входе кадр уже собран, а колонки просто всплывают лесенкой
     nrAboutTextIn. Перезагрузка страницы сбрасывает флаги, и полный таймлайн
     проигрывается снова. */

  var ABOUT_GAP = 300;        /* пауза между всеми шагами, мс */
  var ABOUT_SHOW_MS = 300;    /* длительность появления кнопки/цифры (CSS) */
  var ABOUT_TYPE_MS = 1000;   /* печать заголовка кадра 2 и лида кадра 3 */
  var ABOUT_RULE_MS = 1000;   /* прочерчивание линии кадра 2 (CSS) */

  /* Задержки на открытии раздела нет: таймлайн кадра 1 стартует сразу по клику,
     одновременно с проявлением рамки (0.7 с, css/style → .nr-about-overlay.active).
     Раньше первые шаги ждали конца проявления, а содержимое всё это время держал
     отдельный класс-придержка на оверлее: раздел открывался пустым и оживал с
     задержкой. Теперь начальные состояния держат только armed-классы кадра
     (плашка, строки подзаголовка, имя и буквы биографии невидимы до своего
     шага), поэтому печать начинается под ещё проявляющейся рамкой — и ничего не
     мелькает: показывать раньше времени нечего. */

  /* Кадр 1: плашка → имя → подзаголовок (две строки порознь) → биография по
     абзацам → подсказка «Листайте» со свечением.
     Правая колонка идёт тем же ритмом, что кадры 2–3, но плотнее: свой
     ABOUT1_GAP вместо общего ABOUT_GAP (0.3 с → 0.18 с). Биография слева
     печатается по буквам, как заголовки кадров 2–3, только абзацами: все строки
     абзаца стартуют одновременно и идут слева направо, абзацы — друг за другом.
     Скорость — ABOUT1_TYPE_SPEED (мс на букву), длительность абзаца считается
     по его самой длинной строке, поэтому у русского и английского текста она
     своя. Паузы между абзацами нет: второй начинается ровно в тот момент, когда
     легла последняя буква первого, — биография идёт одним потоком, без провала
     посередине. Последним шагом выходит подсказка «Листайте» — через
     ABOUT1_HINT_GAP после последней буквы, чтобы не вспыхнуть на самой букве. */
  var ABOUT1_GAP = 180;        /* пауза между шагами правой колонки, мс */
  var ABOUT1_SUB_GAP = 260;    /* пауза между строками подзаголовка, мс */
  /* Печать биографии: мс на букву, считается по самой длинной строке абзаца.
     Строки абзаца идут одновременно, поэтому время абзаца — это время одной
     строки, а не сумма строк: при прежних 9 мс/букву весь абзац проявлялся бы
     за 0,34 с и читался как рывок, а не как печать. 30 мс/букву возвращают
     прежний ритм — самый длинный ряд набирается ≈1,1–1,4 с, но теперь все ряды
     абзаца растут вместе. */
  var ABOUT1_TYPE_SPEED = 30;  /* печать биографии: мс на букву */
  /* Паузы между абзацами нет: пока первый абзац дописывает последнюю букву,
     второй уже начинает набор. 240 мс зазора читались как «печать споткнулась» —
     текст шёл рывками, хотя по смыслу это одно повествование. */
  var ABOUT1_PARA_GAP = 0;     /* пауза между абзацами биографии, мс */
  /* А вот подсказке «Листайте» воздух нужен: без него она вспыхивала бы в тот
     же кадр, когда легла последняя буква биографии. Зазор отдельный, чтобы
     убирание паузы между абзацами не тащило за собой и подсказку. */
  var ABOUT1_HINT_GAP = 240;   /* последний абзац → подсказка «Листайте», мс */

  var about1TitleAt = ABOUT_SHOW_MS + ABOUT1_GAP;                /* 480 */
  var about1SubAt = about1TitleAt + ABOUT_TYPE_MS + ABOUT1_GAP;  /* 1660 */
  var about1Sub2At = about1SubAt + ABOUT1_SUB_GAP;               /* 1920 */
  /* Биография стартует, пока вторая строка подзаголовка ещё садится (0.3 с):
     колонки разные — правая и левая, — и ждать её конца незачем. */
  var about1BioAt = about1Sub2At + ABOUT1_GAP;                   /* 2100 */

  var ABOUT1 = {
    kickerAt: 0,                /* 0 — плашка «6+ лет в индустрии» */
    titleAt: about1TitleAt,     /* 480 — печать имени */
    typeMs: ABOUT_TYPE_MS,      /* 1000 */
    subAt: about1SubAt,         /* 1660 — первая строка подзаголовка */
    subStep: ABOUT1_SUB_GAP,    /* 1660 / 1920 — строки подзаголовка */
    bioAt: about1BioAt,         /* 2100 — печать первого абзаца */
    typeSpeed: ABOUT1_TYPE_SPEED,
    paraGap: ABOUT1_PARA_GAP,   /* 0 — абзацы встык, без зазора */
    hintGap: ABOUT1_HINT_GAP    /* 240 — воздух перед «Листайте» */
  };

  /* Кадр 2: печать → 4 кнопки → линия → 3 цифры.
     Линия и цифры идут вровень: ABOUT2_RULE_TO_STAT = 0, первая цифра появляется
     в тот же миг, когда полоса начинает прочерчиваться. Линия идёт 1 с, поэтому
     все три цифры успевают встать, пока она ползёт по колонке (2500 / 2800 /
     3100 против конца линии в 3500). Раньше первая цифра ждала 0.5 с — это
     читалось как пауза между полосой и цифрами.
     Паузы между последней кнопкой и линией нет (ABOUT2_RULE_GAP = 0): линия
     начинает идти в тот же момент, когда последняя кнопка села на место. Общий
     ABOUT_GAP здесь не годится — с ним после кнопок был виден провал в 0.3 с
     на неподвижной колонке. */
  var ABOUT2_RULE_TO_STAT = 0;                                        /* линия → цифры */
  var ABOUT2_RULE_GAP = 0;                                            /* кнопки → линия */
  var about2BtnAt = ABOUT_TYPE_MS + ABOUT_GAP;                        /* 1300 */
  var about2BtnLastEnd = about2BtnAt + 3 * ABOUT_GAP + ABOUT_SHOW_MS; /* 2500 */
  var about2RuleAt = about2BtnLastEnd + ABOUT2_RULE_GAP;              /* 2500 */
  var about2StatAt = about2RuleAt + ABOUT2_RULE_TO_STAT;              /* 2500 */

  var ABOUT2 = {
    typeMs: ABOUT_TYPE_MS,
    btnAt: about2BtnAt,        /* 1300 — первая кнопка */
    btnStep: ABOUT_GAP,        /* 1300 / 1600 / 1900 / 2200 */
    ruleAt: about2RuleAt,      /* 2500 — линия, как только встала последняя кнопка */
    ruleMs: ABOUT_RULE_MS,     /* идёт до 3500 */
    statAt: about2StatAt,      /* 2500 — первая цифра, вместе с полосой */
    statStep: ABOUT_GAP,       /* 2500 / 2800 / 3100 */
    statTypeMs: 700            /* печать подписи под цифрой */
  };

  /* Кадр 3: печать → скидка → 2 вопроса → 4 кнопки (сетка 2×2).
     Пауз между группами нет (ABOUT3_GAP = 0): скидка подхватывается в тот кадр,
     когда легла последняя буква лида, первый вопрос — когда встала скидка, кнопки —
     когда встал последний вопрос. Раньше на каждом стыке стояло по 0.3 с (общий
     ABOUT_GAP), и три зазора подряд растягивали финал до 3.4 с: колонка трижды
     замирала на пустом месте. Внутри группы шаг остаётся ABOUT_GAP и равен
     длительности появления (ABOUT_SHOW_MS), поэтому пары идут встык: элемент встал —
     следующий уже трогается. */
  var ABOUT3_GAP = 0;                                                 /* группа → группа */
  var about3DiscountAt = ABOUT_TYPE_MS + ABOUT3_GAP;                  /* 1000 */
  var about3DiscountEnd = about3DiscountAt + ABOUT_SHOW_MS;           /* 1300 */
  var about3LinkAt = about3DiscountEnd + ABOUT3_GAP;                  /* 1300 */
  var about3LinkLastEnd = about3LinkAt + ABOUT_GAP + ABOUT_SHOW_MS;   /* 1900 */
  var about3BtnAt = about3LinkLastEnd + ABOUT3_GAP;                   /* 1900 */

  var ABOUT3 = {
    typeMs: ABOUT_TYPE_MS,
    discountAt: about3DiscountAt,  /* 1000 — скидка, сразу за печатью */
    linkAt: about3LinkAt,          /* 1300 — первый вопрос, сразу за скидкой */
    linkStep: ABOUT_GAP,           /* 1300 / 1600 */
    btnAt: about3BtnAt,            /* 1900 — кнопки, сразу за последним вопросом */
    btnStep: ABOUT_GAP             /* 1900 / 2200 / 2500 / 2800 — четыре кнопки сеткой 2×2 */
  };

  var aboutTimers = [];

  /* Анимации кадров играются один раз за загрузку страницы: флаги живут в
     памяти модуля, поэтому повторный вход на кадр (и листание туда-обратно)
     уже ничего не запускает, а перезагрузка страницы сбрасывает их. */
  var about1Played = false;
  var about2Played = false;
  var about3Played = false;

  function aboutClearTimers() {
    aboutTimers.forEach(function (t) { clearTimeout(t); });
    aboutTimers = [];
  }

  function aboutLater(fn, ms) {
    aboutTimers.push(setTimeout(fn, ms));
  }

  function about1Slide() {
    return $('#aboutShowcase [data-about-slide="0"]');
  }

  function about2Slide() {
    return $('#aboutShowcase [data-about-slide="1"]');
  }

  function about3Slide() {
    return $('#aboutShowcase [data-about-slide="2"]');
  }

  /* ── Подсказка «Листайте» (вёрстка и цвета — css/style) ────────────────
     Лежит вне кадров, поэтому по кадрам не переключается: CSS гасит её только
     на финальном (data-about-active="2"). На первом кадре она — последний шаг
     таймлайна: пока идёт печать, её нет вовсе (класс nr-hint-wait держит
     opacity: 0), а в конце она всплывает и светится — вспышка, затухание,
     вспышка (класс is-in, анимации в css/anim/15-about.css).
     Свечение живёт до первого листания: как только зритель ушёл с первого кадра,
     пульсация снимается и больше не возвращается (aboutHintGlowDone) — подсказка
     «Листайте» своё дело сделала, мигать на втором кадре ей незачем. */
  var aboutHintGlowDone = false;

  function aboutHint() {
    return $('#aboutShowcase .nr-about-hint');
  }

  /* Ожидание: подсказки не видно, пульсация снята. Ставится при загрузке
     страницы, вместе с первым кадром. */
  function aboutHintWait() {
    var hint = aboutHint();
    if (!hint) return;
    hint.classList.remove('is-in');
    hint.classList.add('nr-hint-wait');
  }

  /* Показ: снять ожидание и включить пульсацию свечения (is-in). Повторный
     вызов ничего не перезапускает — класс уже стоит, анимация продолжается с
     той же фазы. Поэтому одна функция годится и для последнего шага таймлайна,
     и для повторного входа на кадр. После первого листания свечение не
     включается (aboutHintGlowDone): подсказка просто видна. */
  function aboutHintShow() {
    var hint = aboutHint();
    if (!hint) return;
    hint.classList.remove('nr-hint-wait');
    if (!aboutHintGlowDone) hint.classList.add('is-in');
  }

  /* Первое листание: гасим пульсацию навсегда. Флаг нужен, потому что кадр 1
     при возврате собирается заново (about1ShowFinal → aboutHintShow) — без него
     свечение вспыхнуло бы снова. */
  function aboutHintStopGlow() {
    aboutHintGlowDone = true;
    var hint = aboutHint();
    if (hint) hint.classList.remove('is-in');
  }

  /* Печать по буквам (кадры 1–3): текст режется на слова (перенос — только по
     словам), слова — на буквы. Каждая буква проявляется со своей задержкой,
     поэтому весь текст набирается за duration. Исходная разметка берётся из
     элемента, так что смена языка подхватывается сама.

     Вложенная разметка сохраняется: буквы оборачиваются прямо внутри своих
     узлов, поэтому акценты биографии кадра 1 (.nr-ab-hint-accent) и её дефис
     (.nr-ab-hyphen) остаются на месте, а <br> не трогаем — он и есть перенос.

     Печать разделена на два шага: aboutTypeArm() только разбивает текст на
     буквы (они прозрачны, пока у узла нет nr-type-on), aboutTypeRun() задаёт
     задержки и включает появление. Так биографию кадра 1 можно «зарядить»
     заранее — при загрузке страницы, — и она не мелькнёт готовым текстом до
     своего шага таймлайна. */
  function aboutTypeArm(node) {
    if (!node || REDUCED) return [];

    /* Уже разряжен — второй раз не разбиваем. */
    if (node.dataset.nrTypeHtml != null && $('.nr-about-type-char', node)) return [];

    var html = node.innerHTML;
    var text = html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
    if (!text || !text.trim()) return [];

    node.dataset.nrTypeHtml = html;
    node.classList.remove('nr-type-on');

    var chars = [];

    /* Обход с сохранением разметки: текстовые узлы режем на слова и буквы,
       элементы (акценты, <br>) оставляем как есть и заходим внутрь них. */
    (function walk(parent) {
      Array.prototype.slice.call(parent.childNodes).forEach(function (kid) {
        if (kid.nodeType === 3) {
          var frag = document.createDocumentFragment();
          kid.nodeValue.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(part));
              return;
            }
            var word = el('span', 'nr-about-type-word');
            part.split('').forEach(function (chr) {
              var c = el('span', 'nr-about-type-char');
              c.textContent = chr;
              word.appendChild(c);
              chars.push(c);
            });
            frag.appendChild(word);
          });
          parent.replaceChild(frag, kid);
          return;
        }
        if (kid.nodeType !== 1 || kid.tagName === 'BR') return;
        walk(kid);
      });
    })(node);

    return chars;
  }

  /* Запуск печати: буквы проявляются слева направо за duration. */
  function aboutTypeRun(node, chars, duration) {
    if (!node || !chars || !chars.length) return;
    var step = duration / chars.length;
    chars.forEach(function (c, i) {
      c.style.transitionDelay = Math.round(i * step) + 'ms';
    });
    /* Стартовое состояние (opacity: 0) фиксируем принудительным пересчётом —
       иначе браузер может впервые посчитать стиль уже вместе с nr-type-on,
       переход не стартует и весь текст появляется сразу. */
    void node.offsetWidth;
    node.classList.add('nr-type-on');
  }

  function aboutType(node, duration) {
    if (!node || REDUCED || !duration) return;
    /* Прошлая печать: сначала вернуть исходную разметку, иначе в «текст»
       попали бы спаны букв. */
    aboutUntype(node);
    aboutTypeRun(node, aboutTypeArm(node), duration);
  }

  /* Возврат напечатанного текста к обычному: спаны собираются обратно в
     исходную разметку (при повторном входе на кадр и при
     prefers-reduced-motion). Разметку берём из dataset — так возвращается и
     <br> в заголовке кадра 2. Если букв в узле уже нет (язык успели сменить —
     renderI18nText() переписал innerHTML), ничего не трогаем, только чистим
     устаревший слепок и класс печати. */
  function aboutUntype(node) {
    if (!node) return;
    if ($('.nr-about-type-char', node) && node.dataset.nrTypeHtml != null) {
      node.innerHTML = node.dataset.nrTypeHtml;
    }
    delete node.dataset.nrTypeHtml;
    node.classList.remove('nr-type-on');
  }

  /* ── Кадр 1 ────────────────────────────────────────────────────────────
     Первый кадр открывает раздел, поэтому его таймлайн — это и есть вход:
     плашка, имя, подзаголовок, биография. Повторный вход (после листания
     вперёд-назад) кадр показывает уже собранным — как кадры 2 и 3.

     Биография печатается по буквам, абзацами: все строки абзаца стартуют
     одновременно и идут слева направо, затем так же следующий абзац. Абзацы —
     это группы подряд идущих .nr-about-line; начало нового помечено классом
     nr-about-para на первой строке (разметка — index.html и config.js →
     bioText1, пометка есть у обоих языков). Пометок нет — весь текст считается
     одним абзацем и печатается сплошняком, ничего не ломается. */
  function about1Paragraphs(slide) {
    var groups = [];
    $$('.nr-about-line', slide).forEach(function (line) {
      if (!groups.length || line.classList.contains('nr-about-para')) groups.push([]);
      groups[groups.length - 1].push(line);
    });
    return groups;
  }

  /* Число букв в абзаце — по нему считается, сколько он печатается. Строки
     абзаца печатаются ОДНОВРЕМЕННО (см. about1TypePara), поэтому абзац длится
     столько, сколько его самая длинная строка: берём максимум, а не сумму. */
  function about1ParaChars(lines) {
    var n = 0;
    lines.forEach(function (line) {
      var len = $$('.nr-about-type-char', line).length;
      if (len > n) n = len;
    });
    return n;
  }

  /* Печать абзаца: все его строки стартуют одновременно, каждая идёт слева
     направо с одной и той же скоростью (мс на букву). Абзац проявляется блоком,
     как будто печатают сразу по всем строкам. Короткие строки заканчиваются
     раньше длинных: скорость общая, а длину строки задаёт разбивка текста
     (config.js → bioText1). */
  function about1TypePara(lines, speed) {
    lines.forEach(function (line) {
      var chars = $$('.nr-about-type-char', line);
      if (!chars.length) return;
      aboutTypeRun(line, chars, chars.length * speed);
    });
  }

  /* Заряжаем биографию: текст разбивается на буквы, но не печатается — буквы
     прозрачны, пока у строки нет nr-type-on. Повторный вызов ничего не делает. */
  function about1BioArm(slide) {
    $$('.nr-about-line', slide).forEach(function (line) { aboutTypeArm(line); });
  }

  function about1BioUntype(slide) {
    $$('.nr-about-line', slide).forEach(function (line) { aboutUntype(line); });
  }

  function about1ClearIn(slide) {
    $$('.nr-about-kicker, .nr-about-title, .nr-about-subtitle-line', slide)
      .forEach(function (n) { n.classList.remove('is-in'); });
  }

  function about1ShowFinal(slide) {
    slide.classList.add('nr-one-reset');
    slide.classList.remove('nr-one-armed');
    aboutUntype($('.nr-about-title', slide));
    about1BioUntype(slide);
    about1ClearIn(slide);
    /* Подсказка «Листайте» уже была в конце таймлайна — без вспышки. */
    aboutHintShow();
    void slide.offsetWidth;
    slide.classList.remove('nr-one-reset');
  }

  function playAboutSlideOne() {
    var slide = about1Slide();
    if (!slide) return;

    aboutClearTimers();

    /* Второй и последующие входы: полный таймлайн не переигрываем — кадр
       сразу собран, а колонки всплывают обычной лесенкой (nrAboutTextIn). */
    if (about1Played) {
      about1ShowFinal(slide);
      return;
    }
    about1Played = true;

    var kicker = $('.nr-about-kicker', slide);
    var title = $('.nr-about-title', slide);
    var subLines = $$('.nr-about-subtitle-line', slide);
    var paras = about1Paragraphs(slide);

    /* Биография разбита на буквы ещё при загрузке (initAboutSlideOne), но смена
       языка переписывает разметку через renderI18nText() — тогда разбиваем
       заново. Повторный вызов ничего не делает. */
    about1BioArm(slide);

    /* Возврат в исходное состояние: снимаем is-in и возвращаем напечатанный
       текст, переходы на эти несколько строк гасим (nr-one-reset) — иначе блоки
       гасли бы на глазах.
       ВАЖНО: класс nr-one-armed здесь НЕ снимается. Он и так стоит с загрузки
       страницы (initAboutSlideOne) и как раз держит блоки невидимыми. Если его
       снять — на принудительном пересчёте ниже браузер посчитает блоки видимыми,
       а возврат класса запустит обратный переход 1 → 0 уже с включёнными
       переходами: текст мигнёт и быстро погаснет перед началом анимации. */
    slide.classList.add('nr-one-reset');
    aboutUntype(title);
    about1ClearIn(slide);
    void slide.offsetWidth;
    slide.classList.remove('nr-one-reset');

    /* При отключённых анимациях показываем всё сразу, без таймлайна. Биографию
       возвращаем к обычному тексту: её могли разрядить при загрузке, а потом
       настройку «меньше движения» включили — иначе буквы остались бы
       прозрачными навсегда. Подсказку «Листайте» тоже отпускаем: ждать ей
       нечего, ожидание ставится только для таймлайна. */
    if (REDUCED) {
      slide.classList.remove('nr-one-armed');
      about1BioUntype(slide);
      aboutHintShow();
      return;
    }

    slide.classList.add('nr-one-armed');

    aboutLater(function () {
      if (kicker) kicker.classList.add('is-in');
    }, ABOUT1.kickerAt);

    aboutLater(function () {
      aboutType(title, ABOUT1.typeMs);
      if (title) title.classList.add('is-in');
    }, ABOUT1.titleAt);

    /* Подзаголовок: «Звукорежиссер» и «Сведения / Мастеринга» — отдельными
       строками, каждая своим шагом (ABOUT1.subAt / subStep). */
    subLines.forEach(function (line, i) {
      aboutLater(function () { line.classList.add('is-in'); },
                 ABOUT1.subAt + i * ABOUT1.subStep);
    });

    /* Биография: абзац за абзацем, но без зазора между ними — paraGap = 0.
       Внутри абзаца строки печатаются одновременно, поэтому длительность
       абзаца — буквы его самой длинной строки × скорость; у RU и EN она своя. */
    var bioAt = ABOUT1.bioAt;
    paras.forEach(function (para) {
      var startAt = bioAt;
      bioAt = startAt + about1ParaChars(para) * ABOUT1.typeSpeed + ABOUT1.paraGap;
      aboutLater(function () { about1TypePara(para, ABOUT1.typeSpeed); }, startAt);
    });

    /* И последний шаг — подсказка «Листайте»: всплывает и начинает светиться
       (вспышка → затухание → вспышка, без остановки), когда печать уже
       закончилась. bioAt после цикла — конец последнего абзаца, а hintGap даёт
       ей небольшую паузу, чтобы не вспыхнуть на последней букве. Время считается
       по длине текста, поэтому у русского с английским оно разное. */
    aboutLater(aboutHintShow, bioAt + ABOUT1.hintGap);
  }

  /* Начальные состояния (скрытые плашка, строки подзаголовка) ставим заранее, а
     не в момент первого входа: иначе при первом показе кадра они мигнули бы
     видимыми. Биографию здесь же разбиваем на буквы — пока у строк нет
     nr-type-on, буквы прозрачны, поэтому готовый текст не мелькнёт ни при
     загрузке, ни в момент открытия раздела: печать просто включается на своём
     шаге таймлайна. Подсказку «Листайте» тоже придерживаем здесь: на первом
     кадре она выходит последней, после биографии. */
  function initAboutSlideOne() {
    if (REDUCED) return;
    aboutHintWait();
    var slide = about1Slide();
    if (!slide) return;
    slide.classList.add('nr-one-armed');
    about1BioArm(slide);
  }

  /* Цифру мог прервать уход с кадра — тогда в ней стоит промежуточное число.
     Исходное значение берём из CONFIG по ключу data-i18n самого элемента. */
  function about2RestoreNum(node) {
    var key = node.getAttribute('data-i18n');
    if (!key || typeof getI18nValue !== 'function') return;
    var lang = (typeof currentLang === 'string') ? currentLang : 'ru';
    var val = getI18nValue(lang, key);
    if (typeof val === 'string' && val) node.textContent = val;
  }

  /* Финальное состояние кадра 2 при повторном входе: всё на месте, без
     таймлайна. Переходы на этот момент гасим, чтобы ничего не мигало, а
     всплытие даёт обычная лесенка nrAboutTextIn (она снова стартует вместе с
     is-active). */
  function about2ShowFinal(slide) {
    /* Переходы на этот момент гасим: кадр должен быть уже собранным, а не
       проявляться на глазах (таймлайн могли оборвать на середине). */
    slide.classList.add('nr-two-reset');
    slide.classList.remove('nr-two-armed');
    slide.classList.add('nr-two-rule');
    aboutUntype($('.nr-about-subhead', slide));
    $$('.nr-about-stat-text', slide).forEach(aboutUntype);
    $$('.nr-about-stat-num', slide).forEach(about2RestoreNum);
    void slide.offsetWidth;
    slide.classList.remove('nr-two-reset');
  }

  function playAboutSlideTwo() {
    var slide = about2Slide();
    if (!slide) return;

    aboutClearTimers();

    /* Второй и последующие входы: полный таймлайн не переигрываем — кадр
       сразу собран, а колонка всплывает обычной лесенкой (nrAboutTextIn). */
    if (about2Played) {
      about2ShowFinal(slide);
      return;
    }
    about2Played = true;

    var trainers = $$('.nr-about-trainer', slide);
    var stats = $$('.nr-about-stat', slide);
    var title = $('.nr-about-subhead', slide);
    var ruleOn = function () { slide.classList.add('nr-two-rule'); };

    /* Возврат в исходное состояние — на случай повторного входа на кадр.
       Переходы на эти несколько строк отключаем (nr-two-reset), иначе элементы
       гасли бы на глазах, а линия уезжала бы назад. */
    slide.classList.add('nr-two-reset');
    slide.classList.remove('nr-two-rule');
    aboutUntype(title);
    trainers.concat(stats).forEach(function (n) { n.classList.remove('is-in'); });
    stats.forEach(function (card) {
      aboutUntype($('.nr-about-stat-text', card));
      var num = $('.nr-about-stat-num', card);
      if (num) { about2RestoreNum(num); num.dataset.nrDone = ''; }
    });
    void slide.offsetWidth;
    slide.classList.remove('nr-two-reset');

    /* При отключённых анимациях показываем всё сразу, без таймлайна. */
    if (REDUCED) {
      slide.classList.remove('nr-two-armed');
      ruleOn();
      return;
    }

    slide.classList.add('nr-two-armed');

    aboutLater(function () { aboutType(title, ABOUT2.typeMs); }, 0);

    trainers.forEach(function (btn, i) {
      aboutLater(function () { btn.classList.add('is-in'); }, ABOUT2.btnAt + i * ABOUT2.btnStep);
    });

    aboutLater(ruleOn, ABOUT2.ruleAt);

    stats.forEach(function (card, i) {
      aboutLater(function () {
        card.classList.add('is-in');
        var num = $('.nr-about-stat-num', card);
        if (num) {
          num.dataset.nrDone = '';
          countUp(num);
        }
        aboutType($('.nr-about-stat-text', card), ABOUT2.statTypeMs);
      }, ABOUT2.statAt + i * ABOUT2.statStep);
    });
  }

  /* Начальные состояния (скрытые кнопки и цифры) ставим заранее, а не в момент
     первого входа: иначе при первом показе кадра они мигнули бы видимыми. */
  function initAboutSlideTwo() {
    var slide = about2Slide();
    if (!slide || REDUCED) return;
    slide.classList.add('nr-two-armed');
  }

  /* ── Кадр 3 ────────────────────────────────────────────────────────────
     Повторный вход: снимаем «заряженные» классы (всё сразу на месте),
     собираем напечатанный лид обратно в текст и убираем is-in. Переходы на
     этот момент гасим — иначе блоки гасли бы на глазах. Дальше колонка
     всплывает обычной лесенкой: общий вход nrAboutTextIn снова действует,
     потому что класс nr-three-armed снят (css/anim/15-about.css). */
  function about3ShowFinal(slide) {
    slide.classList.add('nr-three-reset');
    slide.classList.remove('nr-three-armed');
    aboutUntype($('.nr-about-lead', slide));
    $$('.nr-about-discount, .nr-about-link, .nr-about-btn', slide)
      .forEach(function (n) { n.classList.remove('is-in'); });
    void slide.offsetWidth;
    slide.classList.remove('nr-three-reset');
  }

  function playAboutSlideThree() {
    var slide = about3Slide();
    if (!slide) return;

    aboutClearTimers();

    /* Второй и последующие входы: полный таймлайн не переигрываем — кадр
       сразу собран, а колонка всплывает обычной лесенкой (nrAboutTextIn). */
    if (about3Played) {
      about3ShowFinal(slide);
      return;
    }
    about3Played = true;

    var lead = $('.nr-about-lead', slide);
    var discount = $('.nr-about-discount', slide);
    var links = $$('.nr-about-link', slide);
    var btns = $$('.nr-about-btn', slide);

    /* Возврат в исходное состояние (переходы гасим на эти несколько строк). */
    slide.classList.add('nr-three-reset');
    aboutUntype(lead);
    links.concat(btns).forEach(function (n) { n.classList.remove('is-in'); });
    if (discount) discount.classList.remove('is-in');
    void slide.offsetWidth;
    slide.classList.remove('nr-three-reset');

    /* При отключённых анимациях показываем всё сразу, без таймлайна. */
    if (REDUCED) {
      slide.classList.remove('nr-three-armed');
      return;
    }

    slide.classList.add('nr-three-armed');

    aboutLater(function () { aboutType(lead, ABOUT3.typeMs); }, 0);

    if (discount) {
      aboutLater(function () { discount.classList.add('is-in'); }, ABOUT3.discountAt);
    }

    links.forEach(function (btn, i) {
      aboutLater(function () { btn.classList.add('is-in'); }, ABOUT3.linkAt + i * ABOUT3.linkStep);
    });

    btns.forEach(function (btn, i) {
      aboutLater(function () { btn.classList.add('is-in'); }, ABOUT3.btnAt + i * ABOUT3.btnStep);
    });
  }

  function initAboutSlideThree() {
    var slide = about3Slide();
    if (!slide || REDUCED) return;
    slide.classList.add('nr-three-armed');
  }

  /* ═══ УСЛУГИ: индикаторы, наклон, списки, цены (css/anim/08-services.css) ═══ */

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

  /* ═══ ТРЕК-ЛИСТ: отметка активного и играющего трека (css/anim/06-tracks.css) ═══ */

  /* Число полосок эквалайзера поверх обложки играющего трека.
     Телефон и компьютер: обложка — крупный квадрат, поэтому полосок много и они
     образуют низкую широкую «волну» (см. медиазапрос в css/anim/06-tracks.css).
     Планшет: прежние четыре вертикальные полоски. */
  function eqBarsCount() {
    return (window.innerWidth < 640 || window.innerWidth >= 1024) ? 12 : 4;
  }

  function eqBarsHTML(count) {
    var html = '';
    for (var i = 0; i < count; i++) html += '<i></i>';
    return html;
  }

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
    if (overlay && !REDUCED) {
      var need = eqBarsCount();
      var bars = $('.nr-eqbars', overlay);
      /* Смена вида mobile ⇄ desktop меняет число полосок: старый набор убираем. */
      if (bars && bars.children.length !== need) {
        bars.parentNode.removeChild(bars);
        bars = null;
      }
      if (!bars) {
        overlay.appendChild(el('span', 'nr-eqbars', eqBarsHTML(need)));
      }
    }
  }

  /* ═══ ЭФФЕКТЫ НИЖНЕГО ПЛЕЕРА (css/anim/07-player.css) ═══════════════════ */

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

  /* ═══ FAQ / МОДАЛКИ / ТОСТ / МЕНЮ (css/anim/11-toast-modals-menu.css) ═══ */

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
    // Статистика живёт и в модалке (телефон), и в полноэкранном разделе на
    // компьютере — цифры считаются в обоих.
    $$('#aboutModal [data-i18n$="Num"], #aboutShowcase [data-i18n$="Num"]').forEach(function (n) {
      n.dataset.nrDone = '';
      countUp(n);
    });
  }

  /* ═══ СТУДИЙНЫЙ ФЕЙДЕР И СКРОЛЛ ═════════════════════════════════════════ */

  var faderTimer = null;
  var bodyHasFaderactive = false; /* класс уже стоит? — чтобы не писать его каждый кадр */
  var isScrollTicking = false;

  /* true, пока запланирован кадр handleScrollUpdate. Полоска прогресса
     (setScrollLineProgress) по этому флагу решает: доводить себя тем же кадром
     прокрутки или поднимать собственный rAF (см. runScrollLineIdle). */
  function scrollFrameActive() { return isScrollTicking; }
  var wasScrolled = false;

  function onScroll() {
    if (!isScrollTicking) {
      isScrollTicking = true;
      requestAnimationFrame(handleScrollUpdate);
    }
  }

  function handleScrollUpdate() {
    isScrollTicking = false;
    var currentY = window.scrollY || 0;

    /* Пылинки на время прокрутки замирают (см. dustRestUntil): отрисовка
       фонового канваса не должна конкурировать с жестом за главный поток. */
    dustRestUntil = performance.now() + 200;

    /* Предел прокрутки: на ПК берём из кэша (он обновляется по событиям —
       иначе принудительный layout в кадре ломает плавность, см.
       refreshScrollMax), а на телефоне меряем живой (там скролл нативный). */
    if (smoothScrollDrives()) {
      if (scrollMax <= 0) refreshScrollMax();
    } else {
      liveScrollMax();
    }
    var p = computeScrollProgress();

    /* Полоска прогресса: цель — реальный прогресс страницы, отрисовку догоняем
       В ЭТОМ ЖЕ кадре (см. advanceScrollLine). Мгновенных «телепортов» от
       старого порога |p - lineValue| > 0.3 здесь больше нет: на телефоне кадры
       приходят пачками, и порог переставлял полоску рывком (≈ на 1/3, 2/3 и
       низ страницы). Якорные прыжки и возврат в начало по-прежнему ставятся
       мгновенно — их обрабатывает setScrollLineProgress(p, true) в
       initHeader/ResizeObserver. */
    safe(function () {
      lineTarget = p;
      advanceScrollLine();
    });

    /* Фон главного экрана отстаёт от контента (см. initHeroParallax).
       В режиме движка (scroll-driven animation) вызов сразу выходит: сдвиг
       привязан к прокрутке в CSS. В фолбэке позиция секции берётся из
       rect.top — единственное чтение геометрии в кадре, зато значение не
       зависит от подкрутки scrollY адресной строкой. Лишние записи в style
       отсекает порог внутри setHeroParallax. */
    safe(updateHeroParallax);

    /* Фон шапки растворяется на первых HERO_FADE_DISTANCE пикселях —
       см. paintHeaderFade. Считается от той же текущей позиции, что и
       полоска прогресса, поэтому лишних чтений scrollY здесь нет. */
    safe(function () { paintHeaderFade(currentY); });

    var isScrolled = currentY > 40;
    if (isScrolled !== wasScrolled) {
      wasScrolled = isScrolled;
      document.body.classList.toggle('nr-scrolled', isScrolled);
    }

    /* Размытия подложек (backdrop-filter) в проекте нет, поэтому нет и класса
       html.nr-scrolling, который снимал размытие на время прокрутки
       (см. css/style). Кадры скролла от этого дешевле: classList здесь не
       трогается. */

    /* Десктопный SSL фейдер — активен только на экранах от 1024px.
       Класс и таймер трогаются только когда состояние реально меняется: во время
       непрерывного скролла кадры почти не касаются DOM, а гашение через 420мс
       после остановки срабатывает всегда. */
    if (window.innerWidth >= 1024) {
      if (!bodyHasFaderactive) {
        bodyHasFaderactive = true;
        document.body.classList.add('nr-faderactive');
      }
      if (faderTimer !== null) clearTimeout(faderTimer);
      faderTimer = setTimeout(function () {
        faderTimer = null;
        bodyHasFaderactive = false;
        document.body.classList.remove('nr-faderactive');
      }, 420);
    }

    /* Если полоска ещё не догнала цель, а кадр прокрутки на этом заканчивается
       (колесо остановилось, инерция докатилась), доводим её разовым rAF — иначе
       она застыла бы на промежуточном значении. Пока прокрутка идёт, догон
       продолжает следующий кадр handleScrollUpdate, и лишних циклов не плодится. */
    if (lineRunning) safe(runScrollLineIdle);
  }

  /* ═══ ЭКОНОМИЯ РЕСУРСОВ ═════════════════════════════════════════════════ */

  function initViewportGate() {
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        en.target.classList.toggle('nr-off', !en.isIntersecting);
        // Секция отзывов ушла с экрана: раскрытые отзывы сворачиваем, ленты
        // снимаем с паузы — возвращаешься, а всё снова едет (js/reviews.js →
        // collapseAllReviews). Порог тот же, что у .nr-off: карточки вне экрана.
        if (en.target.id === 'reviews' && !en.isIntersecting) {
          if (typeof collapseAllReviews === 'function') collapseAllReviews();
        }
      });
    }, { rootMargin: '140px 0px' });
    /* Секцию плеера на телефоне из-под гейта выводим: она лежит сразу под
       первым экраном, и класс .nr-off снимался ровно в тот кадр, когда
       пользователь делал первый свайп. Пауза анимаций снималась у целой секции
       разом — браузер в этом кадре создавал слои и начинал отрисовку. Теперь на
       телефоне её анимации идут с загрузки, а экономия остаётся на компьютере,
       где кадр прокрутки ведёт Lenis и лишняя работа заметнее. */
    var skipPlayer = window.innerWidth < 1024;
    $$('#hero, #player, #faq, #contacts, #reviews, footer').forEach(function (n) {
      if (skipPlayer && n.id === 'player') return;
      io.observe(n);
    });
  }

  /* ═══ СИНХРОНИЗАЦИЯ СОСТОЯНИЙ ═══════════════════════════════════════════ */

  var lastPlaying = null, lastSource = null;

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

  /* ═══ СКВОЗНОЙ ФОН — ПЫЛИНКИ-ЧАСТИЦЫ (css/anim/14-particles.css) ═══════════
     Едва заметные янтарные пылинки медленно плывут вверх по всему тёмному
     фону сайта. Один fixed-canvas позади контента (см. css/anim/14-particles.css): клики пропускает, глубину задаёт разница размеров/яркости.
     Рисуется в главном цикле loop() по интервалу — второй rAF не заводим.
     Уважает LITE (телефон/слабое устройство): меньше частиц и реже кадры.
     При prefers-reduced-motion слой не создаётся вовсе. */

  var dustCanvas = null;     /* { c, ctx, w, h, dpr } — слой частиц */
  var dustSprite = null;     /* мягкий ореол одной пылинки (нарисован один раз) */
  var dustParticles = [];    /* массив частиц */
  var dustPrev = 0;          /* время прошлой отрисовки, мс */
  var lastDust = 0;          /* отметка интервала отрисовки в цикле, мс */
  /* Пока страница прокручивается, пылинки не перерисовываем.
     На iPhone прокрутку ведёт главный поток, и отрисовка фонового канваса в
     это время конкурирует с самим жестом: страница не успевает за пальцем.
     Слой висит на месте, поэтому пауза на время жеста не видна, а через 200 мс
     после остановки частицы снова дышат. */
  var dustRestUntil = 0;
  var DUST_TAU = Math.PI * 2;

  function makeDustSprite() {
    var s = 64;
    var c = document.createElement('canvas');
    c.width = s;
    c.height = s;
    var g = c.getContext('2d');
    var rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    rg.addColorStop(0, 'rgba(255, 236, 190, 1)');
    rg.addColorStop(0.28, 'rgba(251, 191, 36, 0.55)');
    rg.addColorStop(1, 'rgba(245, 158, 11, 0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, s, s);
    return c;
  }

  /* Частица живёт в ПИКСЕЛЯХ слоя, а не в долях экрана, и её высота считается
     ОТ НИЖНЕЙ КРОМКИ (d — сколько пикселей от низа слоя). Низ слоя привязан к
     низу экрана (css/anim/14-particles.css), поэтому пылинки не двигаются ни
     при появлении/скрытии плашек браузера, ни при смене высоты слоя: экранная
     позиция = низ экрана + d. Раньше хранилась доля экрана — при любом
     изменении высоты окна вся россыпь мгновенно пересчитывалась и прыгала. */
  function dustParticle(w, h) {
    var d = Math.random();               /* глубина: 0 — далеко, 1 — близко */
    return {
      x: Math.random() * w,              /* позиция по X, px от левого края */
      d: Math.random() * h,              /* позиция по Y, px ОТ НИЗА слоя */
      sp: 8 + d * 14,                    /* скорость подъёма, px/с */
      glow: 5 + (1 - d) * 7,             /* радиус ореола, px (дальние — размытее) */
      alpha: 0.05 + d * 0.11,            /* яркость (дальние — тусклее) */
      swayAmp: 4 + d * 8,                /* размах бокового покачивания, px */
      swaySpd: 0.15 + Math.random() * 0.25,
      phase: Math.random() * DUST_TAU,
      flickSpd: 0.4 + Math.random() * 0.9,
      flickPhase: Math.random() * DUST_TAU
    };
  }

  function sizeDust() {
    if (!dustCanvas) return;
    var c = dustCanvas.c;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    /* Размер берём у самого слоя, а не у окна: CSS-высота канваса задана
       в lvh (css/anim/14-particles.css) и от плашки браузера не зависит. */
    var w = Math.max(1, Math.round(c.clientWidth || window.innerWidth));
    var h = Math.max(1, Math.round(c.clientHeight || window.innerHeight));
    if (w === dustCanvas.w && h === dustCanvas.h && dpr === dustCanvas.dpr) return;
    dustCanvas.w = w;
    dustCanvas.h = h;
    dustCanvas.dpr = dpr;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    dustCanvas.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* Частицы живут в пикселях от нижней кромки: после сужения окна (поворот,
       ресайз) за правый край уходят только те, кому не хватило ширины.
       Высота не трогается вовсе — позиция от низа и так не зависит от неё. */
    for (var i = 0; i < dustParticles.length; i++) {
      if (dustParticles[i].x > w) dustParticles[i].x = Math.random() * w;
    }
  }

  function initDust() {
    if (REDUCED) return;                 /* системная настройка «уменьшить движение» */
    var c = Object.assign(el('canvas'), { id: 'nr-dust' });
    c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    dustCanvas = { c: c, ctx: c.getContext('2d'), w: 0, h: 0, dpr: 1 };
    sizeDust();
    dustSprite = makeDustSprite();
    var count = LITE ? 26 : 64;
    dustParticles = [];
    for (var i = 0; i < count; i++) dustParticles.push(dustParticle(dustCanvas.w, dustCanvas.h));
  }

  function drawDust(now) {
    if (!dustCanvas || !dustSprite || REDUCED) return;
    if (dustPrev === 0) dustPrev = now;
    var dt = Math.min(0.1, (now - dustPrev) / 1000) || 0.016;
    dustPrev = now;

    var ctx = dustCanvas.ctx, w = dustCanvas.w, h = dustCanvas.h;
    ctx.clearRect(0, 0, w, h);
    var t = now / 1000;

    for (var i = 0; i < dustParticles.length; i++) {
      var p = dustParticles[i];
      /* Вверх по экрану = дальше от нижней кромки слоя. */
      p.d += p.sp * dt;
      if (p.d > h + p.glow * 2) {        /* ушла за верх — возвращаем снизу */
        p.d = -p.glow * 2;
        p.x = Math.random() * w;
      }
      var x = p.x + Math.sin(t * p.swaySpd + p.phase) * p.swayAmp;
      var y = h - p.d;
      var flick = 0.7 + 0.3 * Math.sin(t * p.flickSpd + p.flickPhase);
      ctx.globalAlpha = p.alpha * flick;
      ctx.drawImage(dustSprite, x - p.glow, y - p.glow, p.glow * 2, p.glow * 2);
    }
    ctx.globalAlpha = 1;
  }

  /* ═══ ГЛАВНЫЙ ЦИКЛ ══════════════════════════════════════════════════════ */

  var prev = performance.now();
  var lastPlayerEq = 0;
  var loopRunning = false;

  /* Нужен ли цикл прямо сейчас? Да — если звук играет (двигаются полоски
     эквалайзера и «луч» источника), если видна секция плеера с canvas-фоном
     или открыта модалка. Если секция уехала за экран и звук молчит —
     рисовать нечего, и цикл засыпает: раньше rAF крутился непрерывно всё
     время, пока открыта вкладка, и на телефоне это тратило батарею. */
  function loopNeeded() {
    /* Пылинки сквозного фона (dustCanvas) дышат постоянно, поэтому при
       включённом эффекте цикл не засыпает, пока вкладка видима. */
    return Engine.playing || playerVisible || (dustCanvas && !REDUCED) ||
      document.body.classList.contains('modal-open');
  }

  function startLoop() {
    if (!loopRunning && !document.hidden) {
      loopRunning = true;
      prev = performance.now();
      requestAnimationFrame(loop);
    }
  }

  /* Пробуждение из «сна»: любой ввод пользователя, старт/пауза/конец
     воспроизведения и возврат вкладки в фокус. */
  function wakeLoop() {
    startLoop();
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      startLoop();
    } else {
      loopRunning = false;
    }
  });

  /* ВАЖНО: в списке только ввод пользователя, без 'wheel' и 'scroll'. Иначе
     главный цикл просыпался бы на КАЖДОЕ событие прокрутки и во время скролла
     каждый кадр крутил loop() с updateEngine, синком состояния и отрисовкой
     canvas-эквалайзера — даже когда секция плеера за экраном и звук молчит.
     Въезд секции в экран отслеживает отдельный IntersectionObserver
     (initPlayerSectionEq) и сам будит цикл. */
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    document.addEventListener(ev, wakeLoop, { passive: true });
  });
  // Медиа-события не всплывают, поэтому слушаем их на фазе перехвата
  document.addEventListener('play', wakeLoop, true);
  document.addEventListener('pause', wakeLoop, true);
  document.addEventListener('ended', wakeLoop, true);

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
      /* фоновый эквалайзер в секции «Слушай разницу» — энергосберегающий режим в паузе */
      var eqInterval = !Engine.playing ? 65 : (LITE ? 50 : 25);
      if (now - lastPlayerEq > eqInterval) {
        lastPlayerEq = now;
        safe(function () { drawPlayerEq(now); });
      }
      /* сквозной фон: пылинки — заметно реже, чем эквалайзер */
      var dustInterval = LITE ? 90 : 50;
      if (now - lastDust > dustInterval && now > dustRestUntil) {
        lastDust = now;
        safe(function () { drawDust(now); });
      }
    }

    if (loopNeeded()) {
      requestAnimationFrame(loop);
    } else {
      /* Засыпаем до следующего ввода или события плеера (wakeLoop). */
      loopRunning = false;
    }
  }

  /* ═══ ХУКИ НА СУЩЕСТВУЮЩИЕ ФУНКЦИИ ═════════════════════════════════════════
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
  /* Кадры 1–3 «Обо мне»: вход по таймлайну при первом переходе на кадр,
     уход с кадра (и закрытие раздела) обрывает ещё не сработавшие шаги.
     Таймлайн стартует сразу — и при открытии раздела тоже, не дожидаясь, пока
     рамка проявится: начальные состояния держат armed-классы кадров, поэтому
     показывать раньше времени нечего, а ждать 0.7 с проявления раздела незачем.
     Листание заодно гасит пульсацию «Листайте»: свечение живёт до первого ухода
     с первого кадра. */
  hook('aboutGoToSlide', function (index) {
    if (index === 0) playAboutSlideOne();
    else if (index === 1) playAboutSlideTwo();
    else if (index === 2) playAboutSlideThree();
    else aboutClearTimers();
    if (index !== 0) aboutHintStopGlow();
  });
  /* При закрытии раздела обрываем ещё не сработавшие шаги таймлайна. */
  hook('closeAboutShowcase', aboutClearTimers);
  hook('setLanguage', function (lang, savePref, animate) {
    // Заголовок главного экрана при смене языка не трогаем: декор запускается
    // после отрисовки перевода
    var delay = animate ? 330 : 0;
    setTimeout(function () { safe(decorateServices); safe(decorateTracks); }, delay);
  });
  /* Янтарная полоска FAQ живёт вместе с ответом, а не с курсором: при закрытии
     снимаем класс не сразу, а когда ответ уже свернулся (closeFaqItem —
     0.7s), поэтому на тач-экранах полоса гаснет синхронно с текстом.
     Повторное открытие отменяет запланированное снятие. */
  var faqLineTimers = {};
  hook('openFaqItem', function (id) {
    var c = faqCard(id);
    if (!c) return;
    clearTimeout(faqLineTimers[id]);
    delete faqLineTimers[id];
    c.classList.add('nr-faq-open');
  });
  hook('closeFaqItem', function (id) {
    var c = faqCard(id);
    if (!c) return;
    clearTimeout(faqLineTimers[id]);
    faqLineTimers[id] = setTimeout(function () {
      delete faqLineTimers[id];
      var card = faqCard(id);
      var body = document.getElementById('faq-body-' + id);
      /* Карточку могли пересобрать (смена языка) — тогда класс снимать не нужно */
      if (card && body && body.getAttribute('data-open') === 'false') {
        card.classList.remove('nr-faq-open');
      }
    }, 700);
  });
  hook('openMobileMenu', function () {
    var d = $('#mobileMenuDrawer');
    if (d) { d.classList.add('nr-open'); }
  });
  hook('closeMobileMenu', function () {
    var d = $('#mobileMenuDrawer');
    if (d) {
      setTimeout(function () {
        if (d && !d.classList.contains('is-open')) {
          d.classList.remove('nr-open');
        }
      }, 1220);
    }
  });

  /* ═══ СТАРТ ════════════════════════════════════════════════════════════════
     Инициализация разбита на две очереди. Первая — то, что видно сразу
     (кольца героя, полоска прокрутки, появление карточек). Вторая — декор ниже
     первого экрана: кривые под заголовками, canvas плеера, метки карточек.

     Раньше всё собиралось подряд в одном DOMContentLoaded, и на телефоне это
     давало один «залипший» кадр: замер показал ~120 мс в одном кадре, почти
     всё — принудительная переклейка раскладки. Пока идёт загрузка (а на
     телефоне это несколько секунд), пользователь как раз начинает листать —
     именно эти блокировки и чувствуются как «фризы». */

  var LATER_TASKS = [initToastMeter, initEqLines, initPlayerSectionEq, decorateServices, decorateTracks, initHeroSlideshow];
  var laterStarted = false;

  /* Очередь выполняется порциями по ~6 мс: между порциями браузер успевает
     отрисовать кадр и обработать ввод. */
  function runTaskQueue(tasks) {
    var i = 0;
    function step() {
      var started = performance.now();
      while (i < tasks.length && performance.now() - started < 6) {
        safe(tasks[i++]);
      }
      if (i < tasks.length) {
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(function () { requestAnimationFrame(step); }, { timeout: 200 });
        } else {
          setTimeout(function () { requestAnimationFrame(step); }, 0);
        }
      }
    }
    step();
  }

  function runLaterTasks() {
    if (laterStarted) return;
    laterStarted = true;
    runTaskQueue(LATER_TASKS);
  }

  function scheduleLaterTasks() {
    if (document.readyState === 'complete') {
      runLaterTasks();
      return;
    }
    window.addEventListener('load', runLaterTasks, { once: true });
    /* Ранние взаимодействия: пользователь уже листает (или тронул экран),
       пока страница ещё грузится — тогда декор собираем сразу, а не через
       долгую страховку ниже. */
    document.addEventListener('scroll', runLaterTasks, { once: true, passive: true });
    document.addEventListener('touchstart', runLaterTasks, { once: true, passive: true });
    document.addEventListener('pointerdown', runLaterTasks, { once: true, passive: true });
    /* Если секция плеера уже рядом с экраном, канвас её фона должен появиться
       до того, как пользователь туда доскроллит. */
    if ('IntersectionObserver' in window) {
      var p = $('#player');
      if (p) {
        var io = new IntersectionObserver(function (ents) {
          if (ents[0].isIntersecting) runLaterTasks();
        }, { rootMargin: '200px 0px' });
        io.observe(p);
      }
    }
    /* Страховка: если ничто из этого так и не сработает, декор всё равно
       соберётся — иначе canvas плеера не появился бы вовсе. */
    setTimeout(runLaterTasks, 4000);
  }

/* ═══ ПРОГРЕВ ПЕРВОГО КАДРА ПРОКРУТКИ ═══════════════════════════════
     Первый свайп после холодного старта браузера — единственный кадр, где ещё
     ничего не прогрето: шапка впервые переходит в состояние «страница
     прокручена» (обводка логотипа, drop-shadow плитки, рост панели бургера), а
     секции впервые выходят из-под гейта .nr-off и запускают свои анимации.
     Браузер создаёт слои и растрирует всё это ровно в кадр жеста: прокрутка
     копит дельту, пока главный поток занят, и затем отдаёт её скачком.
     Пока заставка #nr-boot ещё непрозрачно закрывает экран, эти состояния
     включаются на два кадра и возвращаются назад — слои, обводки и первые
     кадры анимаций уже готовы, а пользователь ничего не видит.
     После обычного F5 прогревать нечего (всё в кэше), поэтому рывка там нет. */
  var firstScrollWarmed = false;

  function warmFirstScrollPaint(done) {
    var finish = function () { if (typeof done === 'function') done(); };

    if (firstScrollWarmed) { finish(); return; }
    if (REDUCED) { finish(); return; }
    var boot = $('#nr-boot');
    /* Имеет смысл только под непрозрачной заставкой. */
    if (!boot || boot.classList.contains('nr-boot-hide')) { finish(); return; }

    firstScrollWarmed = true;

    var gated = $$('#hero, #player, #faq, #contacts, #reviews, footer');
    var paused = [];
    for (var i = 0; i < gated.length; i++) {
      if (gated[i].classList.contains('nr-off')) paused.push(gated[i]);
    }
    var hadScrolled = document.body.classList.contains('nr-scrolled');

    /* Переходы шапки на время прогрева выключаем (см. css/anim →
       html.nr-warm): иначе возврат из «прокрученного» состояния анимировался
       бы уже поверх гаснущей заставки — панель бургера уменьшалась бы на
       глазах. Класс живёт всего несколько кадров под непрозрачным оверлеем. */
    var root = document.documentElement;
    root.classList.add('nr-warm');

    document.body.classList.add('nr-scrolled');
    for (var j = 0; j < paused.length; j++) paused[j].classList.remove('nr-off');

    requestAnimationFrame(function () {
      /* Кадр с «прокрученной» шапкой и ожившими секциями отрисован. Второй rAF
         нужен, чтобы возврат прошёл отдельным кадром: иначе браузер схлопнул бы
         обе смены состояния в одну и ничего не растрировал. */
      requestAnimationFrame(function () {
        if (!hadScrolled) document.body.classList.remove('nr-scrolled');
        for (var k = 0; k < paused.length; k++) paused[k].classList.add('nr-off');
        /* Снимаем в следующем кадре: смена состояний выше уже отрисована,
           и переходы можно возвращать. */
        requestAnimationFrame(function () { root.classList.remove('nr-warm'); });
        finish();
      });
    });
  }

/* ═══ ЗАСТАВКА «ВКЛЮЧЕНИЯ УСИЛИТЕЛЯ» (BOOT SCREEN) ═══════════════
     #nr-boot видна при каждом заходе/обновлении страницы. Ряд ламп
     накаливания «прогревается» по одной слева направо (CSS, ~1.5 с) —
     это видимый индикатор загрузки вместо прежней полосы. Как только
     страница готова (window.load или страховка) и MIN_HOLD истёк —
     заставка уходит фейдом. Пока окно видно, страница заморожена
     (lockPage): скролл выключен, фокус не покидает оверлей, клики
     съедает #nr-boot. Лок снимается (unlockPage) только в момент
     #nr-boot-done — display:none. */
  function initBoot() {
    var boot = $('#nr-boot');
    if (!boot) return;

    /* Прогрев ламп до последней заканчивается у ~1.5 с (см. animation-delay
       в §01 css/anim). Держим заставку ровно столько, чтобы прогрев
       читался целиком. При prefers-reduced-motion кадр статичен —
       держать его долго незачем, поэтому тайминг короткий. */
    var MIN_HOLD = REDUCED ? 400 : 1500;
    var FADE_MS = 470;    /* чуть больше CSS-перехода opacity 0.42s */

    function blockScroll(e) { e.preventDefault(); }
    function blockKeys(e) {
      var k = e.key || '';
      if (k === 'Tab') {
        e.preventDefault();
        boot.focus({ preventScroll: true }); /* фокус «застревает» в оверлее */
        return;
      }
      /* Пробел/стрелки/PageUp/… иначе всё равно прокрутят страницу. */
      if (k === ' ' || k === 'Spacebar' || /^(Arrow|PageUp|PageDown|Home|End)/.test(k)) {
        e.preventDefault();
      }
    }
    function lockPage() {
      if (boot.dataset.locked) return;
      boot.dataset.locked = '1';
      document.documentElement.classList.add('nr-boot-active');
      window.addEventListener('wheel', blockScroll, { passive: false, capture: true });
      window.addEventListener('touchmove', blockScroll, { passive: false, capture: true });
      window.addEventListener('keydown', blockKeys, { capture: true });
    }
    function unlockPage() {
      if (!boot.dataset.locked) return;
      delete boot.dataset.locked;
      document.documentElement.classList.remove('nr-boot-active');
      window.removeEventListener('wheel', blockScroll, { capture: true });
      window.removeEventListener('touchmove', blockScroll, { capture: true });
      window.removeEventListener('keydown', blockKeys, { capture: true });
      /* Плавный скролл: либа могла «проснуться», пока страница была заморожена
         (overflow:hidden) и не успела толком стартовать. Пересоздаём её заново
         в момент, когда страница стала интерактивной, чтобы она сразу работала —
         даже если юзер крутит колесо тут же после загрузки. */
      if (typeof window.nrApplySmoothScroll === 'function') {
        safe(window.nrApplySmoothScroll);
      }
      /* Страница стала интерактивной и раскладка окончательна — пересчитываем
         геометрию разделов и подсветку навигации, чтобы она сразу совпадала с
         текущим местом (после перезагрузки это главный экран). */
      if (typeof window.refreshScrollSpyAnchors === 'function') safe(window.refreshScrollSpyAnchors);
      if (typeof window.updateActiveNavSection === 'function') safe(window.updateActiveNavSection);
    }

    function hideBoot() {
      if (boot.classList.contains('nr-boot-hide')) return;
      boot.classList.add('nr-boot-hide'); /* фейд; клики и дальше съедает оверлей */
      playHeroIntro();                    /* герой всплывает сквозь гаснущий оверлей */
      setTimeout(function () {
        boot.classList.add('nr-boot-done'); /* display:none — последний кадр окна */
        unlockPage();                       /* только теперь страница интерактивна */
      }, FADE_MS);
    }

    function ready() {
      var elapsed = Date.now() - Number(boot.dataset.bootStart || 0);
      if (elapsed < MIN_HOLD) {
        setTimeout(ready, MIN_HOLD - elapsed + 30);
        return;
      }
      /* Сначала прогреваем первый кадр прокрутки (заставка в этот момент ещё
         полностью непрозрачна), и только потом начинаем её гасить. */
      warmFirstScrollPaint(hideBoot);
    }

    boot.dataset.bootStart = String(Date.now());
    /* prefers-reduced-motion: заставка скрыта CSS — лок не нужен. */
    if (!REDUCED) {
      lockPage();
      boot.setAttribute('tabindex', '-1');
      boot.focus({ preventScroll: true });
    }
    if (document.readyState === 'complete') {
      ready();
    } else {
      window.addEventListener('load', ready, { once: true });
      setTimeout(ready, 2000); /* страховка: не ждём вечно */
    }
  }

  /* Вход главного экрана ждёт заставку. Начальное состояние героя (y/opacity)
     ставит js/gsap-reveal.js → initGsapAnimations сразу, под непрозрачным оверлеем, а
     сама анимация — пауза-таймлайн, который запускает playHeroIntro().
     Класс nr-title-hold держит на паузе пословный вкат заголовка: без него
     слова доигрывали бы за заставкой (css/anim/04-hero.css, рядом с .nr-w). */
  function holdHeroIntro() {
    var hero = $('#hero');
    /* Класс ставим только если заставка есть: снимает его hideBoot, и без
       оверлея он остался бы на #hero навсегда (слова заголовка — на паузе). */
    if (hero && $('#nr-boot')) hero.classList.add('nr-title-hold');
  }

  /* Заставка начала гаснуть → главный экран всплывает. Заодно снимаем паузу с
     пословного вката заголовка: разбивка на слова сделана ещё под оверлеем
     (animateHeroTitle), поэтому перестройки строк в кадре показа нет. */
  function playHeroIntro() {
    var hero = $('#hero');
    if (hero) hero.classList.remove('nr-title-hold');
    if (typeof window.nrPlayHeroIntro === 'function') safe(window.nrPlayHeroIntro);
  }

  function init() {
    /* Высоту окна замораживаем ДО заставки: пока она непрозрачно закрывает
       экран, пересчёт не виден. */
    safe(initViewportHeightLock);
    safe(initBoot);
    safe(initAmbient);
    safe(initDust);
    safe(initHeader);
    safe(initHero);
    safe(initHeroParallax);
    safe(initReveal);
    safe(initViewportGate);
    safe(holdHeroIntro);     /* вход героя ждёт заставку; заголовок режем здесь же */
    safe(animateHeroTitle);
    safe(initAboutSlideOne);
    safe(initAboutSlideTwo);
    safe(initAboutSlideThree);

    /* зелёная вспышка на кнопках «копировать» */
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[onclick^="copyText"]');
      if (!btn || REDUCED) return;
      btn.classList.remove('nr-copied');
      void btn.offsetWidth;
      btn.classList.add('nr-copied');
    });

    /* Отклик на тап по карточкам контактов (css/anim →
       .nr-contact-tap). Ставим только там, где hover-эффекты отключены
       медиазапросом: на сенсорных экранах :hover «залипает», поэтому подъём
       и анимация иконки включаются классом. Клик браузер шлёт только за
       настоящий тап — при свайпе и прокрутке его нет, и карточка не оживает. */
    if (!REDUCED && window.matchMedia &&
        !window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      var CONTACT_TAP_MS = 800; /* ход подъёма 0.35s + возврат 0.35s */
      var contactTapTimer = 0;
      document.addEventListener('click', function (e) {
        var card = e.target.closest && e.target.closest('#contactsGrid > *, #contactModal .grid > *');
        if (!card) return;
        /* Остатки прошлого тапа снимаем сразу: подъём должен быть у одной карточки. */
        var marked = document.querySelectorAll('.nr-contact-tap');
        for (var i = 0; i < marked.length; i++) marked[i].classList.remove('nr-contact-tap');
        void card.offsetWidth;
        card.classList.add('nr-contact-tap');
        clearTimeout(contactTapTimer);
        contactTapTimer = setTimeout(function () {
          card.classList.remove('nr-contact-tap');
        }, CONTACT_TAP_MS);
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    /* Плашка адресной строки на телефоне присылает resize при каждом первом
       свайпе (высота окна меняется на 60–120px, ширина — нет). Раскладка от
       этого не едет: главный экран и его фон считаются от замороженной высоты
       (--nr-vh, см. ЗАМОРОЗКА ВЫСОТЫ ОКНА), канвасы в lvh. А вот пересчёт
       предела прокрутки — это принудительный layout, и он приходился ровно на
       кадр первого жеста после холодного старта. Такие события отбрасываем:
       настоящий поворот экрана меняет ширину, а изменение высоты больше
       четверти экрана — это уже не плашка. */
    var lastWinW = window.innerWidth;
    var lastWinH = window.innerHeight;
    window.addEventListener('resize', function () {
      /* До фильтра плашки: если высота УМЕНЬШИЛАСЬ (плашка вернулась), новое
         значение должно попасть в --nr-vh, иначе секция останется выше окна. */
      safe(lockViewportHeight);
      var w = window.innerWidth;
      var h = window.innerHeight;
      var dh = Math.abs(h - lastWinH);
      var barOnly = w === lastWinW && lastWinW < 1024 && dh > 0 && dh < h * 0.25;
      lastWinW = w;
      lastWinH = h;
      if (barOnly) return;

      /* Это настоящий ресайз (поворот, тяга окна мышью), а не плашка: высоту
         пересчитываем целиком, в том числе в сторону увеличения. */
      safe(function () { lockViewportHeight(true); });
      safe(refreshScrollMax);
      /* Сменилась ширина/высота окна — верх секции героя мог сдвинуться
         (шапка, padding'и, поворот телефона): пересчитываем базу параллакса
         и сразу перерисовываем с новой прокруткой. */
      safe(refreshHeroParallaxRange);
      safe(function () { playerCanvas && playerCanvas.resize(); });
      safe(sizeDust);
      onScroll();
    }, { passive: true });

    onScroll();
    startLoop();

    /* Вторая очередь — после первой отрисовки (или когда браузер свободен). */
    scheduleLaterTasks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

