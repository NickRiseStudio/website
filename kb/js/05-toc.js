// ═══════════════════════════════════════════════════════════════════════
// kb/js/05-toc.js — СОДЕРЖАНИЕ СТАТЬИ: ШТОРКА И ПОДСВЕТКА РАЗДЕЛА
// Грузится: kb/index.html — в конце body, defer. После kb/js/04-sidebar.js:
//         меню статей уже умеет закрывать эту шторку.
// Читает: #kbToc, .kb-toc-page.is-current, #kbTocToggle, #kbMain,
//         #kbSidebarOverlay, #kbSidebar, #kbSidebarToggle и h2 открытой статьи.
// Публичные (window): kbToc → refresh (пересобрать под открытую статью),
//         playIn (выезд колонки, когда статья открывается из приветствия),
//         close (закрыть шторку). Зовёт kb/js/07-articles.js.
// Блоки файла:
//   • collect / refresh — списки берутся у той статьи, что открыта.
//   • updateActive / setActiveSection — подсветка раздела, который читают.
//   • setTocOpen — шторка на телефоне и планшете (на ПК это колонка).
//   • playIn — выезд колонки справа при открытии статьи из приветствия.
//   • Переход по пункту — плавная прокрутка панели (kb/js/06-smooth-scroll.js).
//   • Прокрутка #kbMain: пересчёт на кадр и первый пересчёт после загрузки.
// ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* Насколько верх раздела должен уйти под кромку панели, чтобы раздел стал
     текущим: читатель уже видит его заголовок, но не начало текста. */
  var TOC_ACTIVE_OFFSET_PX = 24;

  var toc = document.getElementById('kbToc');
  var toggle = document.getElementById('kbTocToggle');
  var main = document.getElementById('kbMain');
  if (!toc || !toggle || !main) return;

  var overlay = document.getElementById('kbSidebarOverlay');
  var sidebar = document.getElementById('kbSidebar');
  var sidebarToggle = document.getElementById('kbSidebarToggle');
  var links = [];
  var headings = [];

  var activeId = '';

  /* Статьи лежат в одном документе, и у каждой свой список разделов: наборы
     ссылок и заголовков берём у той статьи, что открыта. У приветствия их
     нет вовсе — тогда оба набора пустые, и подсветке нечего делать. */
  function collect() {
    var nav = toc.querySelector('.kb-toc-page.is-current');
    var page = document.querySelector('#kbArticle .kb-article-page.is-current');
    links = nav ? nav.querySelectorAll('.kb-toc-link') : [];
    headings = page ? page.querySelectorAll('h2') : [];
  }

  /* Активный пункт держим на виду в собственной прокрутке панели: список
     разделов длиннее её высоты. */
  function keepActiveLinkVisible() {
    var link = toc.querySelector('.kb-toc-link.is-active');
    if (!link || !toc.clientHeight) return;
    var linkRect = link.getBoundingClientRect();
    var tocRect = toc.getBoundingClientRect();
    if (linkRect.top < tocRect.top + 8) {
      toc.scrollTop -= (tocRect.top + 8) - linkRect.top;
    } else if (linkRect.bottom > tocRect.bottom - 8) {
      toc.scrollTop += linkRect.bottom - (tocRect.bottom - 8);
    }
  }

  /* Одна точка смены подсветки: класс на пункте, aria-current и видимость
     пункта в панели. */
  function setActiveSection(id) {
    if (!id || id === activeId) return;
    activeId = id;
    for (var i = 0; i < links.length; i++) {
      var isActive = links[i].getAttribute('href') === '#' + id;
      links[i].classList.toggle('is-active', isActive);
      if (isActive) links[i].setAttribute('aria-current', 'location');
      else links[i].removeAttribute('aria-current');
    }
    keepActiveLinkVisible();
  }

  /* Текущий раздел — последний заголовок, ушедший выше кромки панели. Пока
     читатель в самом верху статьи, текущий — первый раздел. */
  function updateActive() {
    if (!headings.length) return;
    var mainTop = main.getBoundingClientRect().top;
    var currentId = headings[0].id;
    for (var i = 0; i < headings.length; i++) {
      if (headings[i].getBoundingClientRect().top - mainTop <= TOC_ACTIVE_OFFSET_PX) {
        currentId = headings[i].id;
      }
    }
    setActiveSection(currentId);
  }

  /* Смена статьи: другой список, другие заголовки. Подсветку снимаем целиком
     и ставим заново — иначе на новом списке остался бы пункт прежней статьи. */
  function refresh() {
    var active = toc.querySelectorAll('.kb-toc-link.is-active');
    for (var i = 0; i < active.length; i++) {
      active[i].classList.remove('is-active');
      active[i].removeAttribute('aria-current');
    }
    activeId = '';
    toc.scrollTop = 0;
    collect();
    updateActive();
  }

  /* Пересчёт не чаще одного раза на кадр: прокрутка длинной статьи идёт
     десятки раз в секунду, а обход тринадцати заголовков на каждый вызов
     не нужен. */
  var frame = 0;
  main.addEventListener('scroll', function () {
    if (frame) return;
    frame = window.requestAnimationFrame(function () {
      frame = 0;
      updateActive();
    });
  }, { passive: true });

  /* ── ШТОРКА: телефон и планшет ─────────────────────────────────────────
     На компьютере панель — обычная колонка, и кнопки на полосе нет. */
  function isOpen() {
    return toc.classList.contains('is-open');
  }

  function closeSidebar() {
    if (!sidebar || !sidebarToggle) return;
    sidebar.classList.remove('is-open');
    sidebarToggle.classList.remove('is-open');
    sidebarToggle.setAttribute('aria-expanded', 'false');
  }

  function setTocOpen(open) {
    if (open) closeSidebar();
    toc.classList.toggle('is-open', open);
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (overlay) overlay.classList.toggle('is-open', open);
    if (open) updateActive();
  }

  toggle.addEventListener('click', function () {
    setTocOpen(!isOpen());
  });

  if (overlay) {
    overlay.addEventListener('click', function () {
      if (isOpen()) setTocOpen(false);
    });
  }

  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Escape' || e.key === 'Esc') && isOpen()) setTocOpen(false);
  });

  /* Переход по пункту: шторка закрывается, а прокрутку панели ведёт
     kb/js/06-smooth-scroll.js. Если движка нет (тач-онли устройства шириной
     меньше 1024px), ссылка работает как обычный якорь: панель прокручивает
     сам браузер. */
  toc.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var link = e.target.closest('a.kb-toc-link');
    if (!link) return;
    var hash = link.getAttribute('href') || '';
    if (hash.charAt(0) !== '#') { setTocOpen(false); return; }
    var smooth = window.nrSmoothScroll;
    if (smooth && typeof smooth.scrollToSection === 'function' &&
        smooth.scrollToSection(hash.slice(1))) {
      e.preventDefault();
      /* Адрес сохраняет якорь: ссылкой на раздел можно поделиться. */
      if (window.history && window.history.pushState) window.history.pushState(null, '', hash);
    }
    setTocOpen(false);
  });

  /* Окно доросло до ширины компьютера — панель там уже колонка, открытое
     состояние шторки не нужно. */
  var desktopQuery = window.matchMedia('(min-width: 1024px)');
  var closeOnDesktop = function (mq) {
    if (mq.matches && isOpen()) setTocOpen(false);
  };
  if (typeof desktopQuery.addEventListener === 'function') {
    desktopQuery.addEventListener('change', closeOnDesktop);
  } else if (typeof desktopQuery.addListener === 'function') {
    desktopQuery.addListener(closeOnDesktop); /* старые Safari */
  }

  /* ── ВЫЕЗД КОЛОНКИ, КОГДА СТАТЬЯ ОТКРЫВАЕТСЯ ИЗ ПРИВЕТСТВИЯ ────────────
     В приветствии панели нет вовсе, и раньше она появлялась на месте целиком.
     Теперь колонка выезжает справа из-за края экрана (kb/css/style/07-toc.css
     → kbTocIn). Место в раскладке она занимает с первого кадра, поэтому текст
     статьи сразу ложится по своей окончательной ширине — по ходу движения он
     не перекладывается, узкой колонкой его не покачивает.

     Зовёт kb/js/07-articles.js только на переходе «приветствие → статья»:
     при переключении статей панель остаётся на месте и не мигает, а при
     загрузке страницы свой вход играет панель оболочки (kb/css/anim). */
  function playIn() {
    /* На телефоне и планшете это шторка со своим ходом (группа 4) — там
       входа нет. */
    if (!desktopQuery.matches) return;
    /* «Уменьшить движение»: панель просто видна, движения нет. */
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    /* Класс снимаем до пересчёта стиля: так повторный вход играет заново, а не
       остаётся на конечном кадре прошлого. */
    toc.classList.remove('is-opening');
    void toc.offsetWidth;
    toc.classList.add('is-opening');

    /* Конец анимации — панель встала: класс больше не нужен, дальше она живёт
       на обычных стилях и не спорит с ними. */
    toc.addEventListener('animationend', function endIn(e) {
      if (e.animationName !== 'kbTocIn') return;
      toc.removeEventListener('animationend', endIn);
      toc.classList.remove('is-opening');
    });
  }

  /* Публичное: смена статьи пересобирает список, возврат к приветствию
     закрывает шторку (kb/js/07-articles.js). */
  window.kbToc = {
    refresh: refresh,
    playIn: playIn,
    close: function () {
      /* Выезд могли прервать возвратом к приветствию: анимация тогда не
         заканчивается, и класс снял бы только этот вызов. */
      toc.classList.remove('is-opening');
      setTocOpen(false);
    }
  };

  refresh();
  /* После полной загрузки раскладка и переход по якорю из адреса уже
     случились — положение раздела пересчитываем ещё раз. */
  window.addEventListener('load', refresh);
})();