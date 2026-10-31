// ═══════════════════════════════════════════════════════════════════════
// kb/js/09-hint.js — ПОДСКАЗКИ К ТЕРМИНАМ (кружок «i»)
// Грузится: kb/index.html — в конце body, defer. После kb/js/08-editor.js
//         (тот ставит html[data-kb-edit]) и до kb/animations.js.
// Читает: button.kb-hint[aria-controls], span.kb-hint-tip, #kbMain,
//         html[data-kb-edit], html[data-lang].
// Публичные (window): нет — модуль самодостаточный.
// Блоки файла:
//   • show / hide — на странице открыт ровно один бабл.
//   • place — положение бабла и место хвостика.
//   • События: наведение, фокус, тап, Esc, тап мимо, смена статьи и языка.
//   • Пересчёт положения при прокрутке панели и повороте экрана.
//
// Зачем так: подсказка — часть текста статьи, но бабл не должен влиять на
// раскладку абзаца. Поэтому бабл лежит в разметке рядом с кружком, но
// вынут из потока (position: fixed), а координаты считает скрипт. Текст
// бабла остаётся в HTML и виден поисковикам; без скрипта страница просто
// читается без подсказок.
//
// Перед показом бабл переносится в конец body (show): у панели чтения и у
// статьи бывает transform (вход панели, смена вида), а он делает предка
// системой координат для position: fixed — бабл уезжал бы вместе с колонкой
// и обрезался прокруткой панели.
// ═══════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var MARGIN = 10;        /* зазор от кружка, от краёв экрана и от шапки */
  var TAIL_MARGIN = 18;   /* хвостик не ближе этого к углу бабла */

  var openBtn = null;     /* кружок открытой подсказки */
  var openTip = null;     /* её бабл */
  var shownAt = 0;        /* момент показа: тот же тап не должен его гасить */
  var headerH = -1;       /* высота шапки из --kb-header-h, -1 — ещё не читали */
  var retrying = false;   /* ждём второй замер размера бабла */

  /* Режим правки: там тап нужен каретке, а не баблу. Атрибут ставит
     kb/js/08-editor.js — этот файл грузится после него и видит его сразу. */
  var editing = document.documentElement.hasAttribute('data-kb-edit');

  function tipOf(btn) {
    var id = btn.getAttribute('aria-controls');
    return id ? document.getElementById(id) : null;
  }

  /* Есть ли настоящий курсор: на тач-экране наведение не работает, а тап
     переключает бабл. */
  function canHover() {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  /* Высота шапки. Она зафиксирована сверху, лежит по слою выше бабла и своим
     фоном перекрывает его целиком — попав под неё, подсказка просто не видна.
     Значение берём из --kb-header-h: на планшете переменная меняется с 64px
     на 80px, поэтому кэш сбрасывается на resize. */
  function headerHeight() {
    if (headerH < 0) {
      var raw = window.getComputedStyle(document.documentElement).getPropertyValue('--kb-header-h');
      var px = parseFloat(raw);
      headerH = isNaN(px) ? 0 : px;
    }
    return headerH;
  }

  /* Прямоугольник панели чтения в координатах окна. Текст живёт в ней, и бабл
     не должен вылезать за её края: иначе он наезжает на меню статей и на
     колонку содержания. null — панели в разметке нет или она не в раскладке. */
  function panelBox() {
    var main = document.getElementById('kbMain');
    if (!main) return null;
    var box = main.getBoundingClientRect();
    return box.width > 0 ? box : null;
  }

  /* ПОЛОЖЕНИЕ. По умолчанию бабл стоит над кружком по центру; если сверху
     не хватает места (в том числе мешает шапка) — под ним, и тогда хвостик
     разворачивается вверх. У краёв панели и окна бабл прижимается, а хвостик
     остаётся точно под кружком — иначе он указывал бы в пустоту. */
  function place() {
    if (!openBtn || !openTip) return;

    var w = openTip.offsetWidth;
    var h = openTip.offsetHeight;
    /* Размеров ещё нет — повторяем замер в следующем кадре. Без этого бабл
       остался бы в left: 0; top: 0, то есть в углу экрана под шапкой. */
    if ((!w || !h) && !retrying) {
      retrying = true;
      requestAnimationFrame(function () {
        retrying = false;
        place();
      });
      return;
    }
    if (!w || !h) return;

    var r = openBtn.getBoundingClientRect();
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    var box = panelBox();

    /* Ниже шапки и внутри окна. */
    var minTop = headerHeight() + MARGIN;
    var maxTop = vh - MARGIN;
    var minLeft = MARGIN;
    var maxLeft = vw - MARGIN - w;

    if (box) {
      /* Кружок ушёл за край панели (прокрутили): бабл к чужому месту не
         приклеиваем — он относился бы к тексту, которого не видно. */
      if (r.right < box.left || r.left > box.right) {
        hide();
        return;
      }
      /* Панель уже бабла — её границы не годятся, считаем от окна. */
      if (box.width > w + MARGIN * 2) {
        minLeft = Math.max(minLeft, box.left + MARGIN);
        maxLeft = Math.min(maxLeft, box.right - MARGIN - w);
      }
    }

    var below = r.top - MARGIN - h < minTop;
    var top = below ? r.bottom + MARGIN : r.top - h - MARGIN;
    if (top + h > maxTop) top = Math.max(minTop, maxTop - h);
    if (top < minTop) top = minTop;
    /* Хвостик смотрит в сторону кружка. После прижатия к низу бабл может
       оказаться выше него, даже если места сверху не было, — тогда хвостик
       разворачивается вниз. */
    below = top >= r.bottom;

    var left = r.left + r.width / 2 - w / 2;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    openTip.style.left = Math.round(left) + 'px';
    openTip.style.top = Math.round(top) + 'px';
    openTip.classList.toggle('is-below', below);

    var tailX = r.left + r.width / 2 - left;
    tailX = Math.max(TAIL_MARGIN, Math.min(tailX, w - TAIL_MARGIN));
    openTip.style.setProperty('--kb-hint-tail-x', Math.round(tailX) + 'px');
  }

  /* ── ПОКАЗ И СКРЫТИЕ ──────────────────────────────────────────────── */

  /* Открыта ровно одна подсказка: новый кружок гасит прежнюю. Повторный
     показ того же кружка только передвигает бабл — так ведёт себя наведение
     при прокрутке. */
  function show(btn) {
    if (editing) return;
    var tip = tipOf(btn);
    if (!tip) return;

    if (openBtn === btn) {
      place();
      return;
    }

    hide();
    openBtn = btn;
    openTip = tip;
    /* Бабл уходит в конец body. Причина: у панели чтения и у статьи бывает
       transform (вход панели, анимация смены вида), а transform делает предка
       системой координат для position: fixed — бабл уезжал бы вместе с
       колонкой, да ещё и обрезался прокруткой панели. Текст остаётся в
       документе: id, aria-controls и поисковики работают как прежде. */
    if (tip.parentNode !== document.body) document.body.appendChild(tip);
    tip.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    /* Сначала отдаём баблу размеры (класс is-open делает его видимым), потом
       считаем положение — у скрытого offsetWidth был бы нулевым только при
       display: none, а здесь размер есть всегда, и порядок безопасен. */
    place();
    shownAt = Date.now();
  }

  function hide() {
    if (!openTip) return;
    openTip.classList.remove('is-open');
    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
    openBtn = null;
    openTip = null;
  }

  /* ── СОБЫТИЯ КРУЖКА ───────────────────────────────────────────────── */

  function bindButton(btn) {
    btn.setAttribute('aria-expanded', 'false');

    btn.addEventListener('mouseenter', function () {
      if (canHover()) show(btn);
    });

    btn.addEventListener('mouseleave', function () {
      if (canHover() && openBtn === btn) hide();
    });

    /* Фокус с клавиатуры: подсказка открывается и без мыши. На телефоне
       focus приходит от тапа, поэтому показ здесь тоже нужен. */
    btn.addEventListener('focus', function () {
      show(btn);
    });

    btn.addEventListener('blur', function () {
      if (openBtn === btn) hide();
    });

    /* Тап на телефоне: сначала focus (показ), затем click. Бабл, который
       только что открылся, этим же касанием не гасим — иначе он мигал бы
       на каждом тапе. Второй тап по кружку закрывает подсказку. */
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (canHover()) return;
      if (openBtn === btn && Date.now() - shownAt < 500) return;
      if (openBtn === btn) {
        hide();
        /* Снимаем фокус: иначе кружок остаётся «нажатым» до следующего
           касания (на iOS кнопки фокус от тапа не получают вовсе). */
        if (typeof btn.blur === 'function') btn.blur();
      } else {
        show(btn);
      }
    });
  }

  /* ── ОБЩИЕ ПРАВИЛА ────────────────────────────────────────────────── */

  /* Тап мимо кружка закрывает подсказку. Слушатель на документе, но клик по
     самому кружку пропускаем: его обработал bindButton. */
  document.addEventListener('click', function (e) {
    if (!openBtn || !e.target.closest) return;
    if (e.target.closest('.kb-hint')) return;
    hide();
  });

  document.addEventListener('keydown', function (e) {
    if (!openBtn) return;
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    var btn = openBtn;
    hide();
    if (btn && typeof btn.blur === 'function') btn.blur();
  });

  /* Переход на другую статью: бабл относится к прежнему тексту. */
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('a[data-kb-article]')) hide();
  }, true);
  window.addEventListener('popstate', hide);

  /* Смена языка: текст бабла остался на прежнем языке. */
  if (window.MutationObserver) {
    new MutationObserver(hide).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-lang']
    });
  }

  /* ── ПЕРЕСЧЁТ ПОЛОЖЕНИЯ ───────────────────────────────────────────── */

  /* Прокручивается не страница, а панель #kbMain: событие scroll не всплывает,
     поэтому слушаем на window с capture — так ловятся прокрутки любого
     контейнера, включая панель и шторку меню. Считаем не чаще раза за кадр:
     place() читает getBoundingClientRect, а это переклейка раскладки. */
  var queued = false;

  function queuePlace() {
    if (!openTip || queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      place();
    });
  }

  window.addEventListener('resize', function () {
    headerH = -1;   /* на планшете меняется --kb-header-h */
    queuePlace();
  }, { passive: true });
  window.addEventListener('scroll', queuePlace, { passive: true, capture: true });

  /* ── СТАРТ ────────────────────────────────────────────────────────── */

  function init() {
    if (editing) return;
    var buttons = document.querySelectorAll('.kb-hint');
    for (var i = 0; i < buttons.length; i++) bindButton(buttons[i]);
  }

  init();
})();