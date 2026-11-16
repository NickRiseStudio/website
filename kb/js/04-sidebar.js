// ═══════════════════════════════════════════════════════════════════════
// kb/js/04-sidebar.js — МЕНЮ СТАТЕЙ: ШТОРКА И РАСКРЫТИЕ РАЗДЕЛОВ
// Грузится: kb/index.html — в конце body, defer. После kb/js/01-lang.js
//         (язык на кнопках уже стоит).
// Читает: #kbSidebar, #kbSidebarOverlay, #kbSidebarToggle, а внутри меню —
//         li.kb-side-group, button.kb-side-group-title, ul.kb-side-sublist.
// Публичные (window): kbSidebar.openGroup — раскрыть раздел статьёй, которую
//         открыл kb/js/07-articles.js.
// Блоки файла:
//   • setSidebarOpen — одно место переключения: классы, aria-expanded, шапка.
//   • Обработчики: кнопка, затемнение, Esc, клик по пункту.
//   • Защита прокрутки под меню и автозакрытие на ширине компьютера.
//   • Разделы меню: раскрытие (setGroupOpen, замер высоты, пересчёт).
// ═══════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var sidebar = document.getElementById('kbSidebar');
  var overlay = document.getElementById('kbSidebarOverlay');
  var toggle = document.getElementById('kbSidebarToggle');
  if (!sidebar || !toggle) return;

  function isOpen() {
    return sidebar.classList.contains('is-open');
  }

  /* Одна точка переключения: разметка шторки, иконка кнопки (гамбургер ↔
     крестик), aria-expanded и класс на <html> живут в одном состоянии.
     Класс kb-menu-open читает шапка: у открытой шторки на телефоне и планшете
     показывается подпись «← А это мой сайт», а центральное название раздела
     уступает ей место (kb/css/style/02-header.css). */
  function setSidebarOpen(open) {
    sidebar.classList.toggle('is-open', open);
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.documentElement.classList.toggle('kb-menu-open', open);
    if (overlay) overlay.classList.toggle('is-open', open);
  }

  toggle.addEventListener('click', function () {
    setSidebarOpen(!isOpen());
  });

  if (overlay) {
    overlay.addEventListener('click', function () {
      setSidebarOpen(false);
    });

    /* Затемнение перекрывает панель чтения целиком: жесты по нему не должны
       «протаскивать» страницу под открытым меню. Слушатель стоит на самом
       затемнении (в закрытом меню у него pointer-events: none), поэтому
       обычная прокрутка остаётся быстрой. */
    overlay.addEventListener('touchmove', function (e) {
      if (!e.touches || !e.touches[0]) return;
      e.preventDefault();
    }, { passive: false });
  }

  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Escape' || e.key === 'Esc') && isOpen()) setSidebarOpen(false);
  });

  /* Переход по пункту меню: статья открывается в этом же документе
     (kb/js/07-articles.js), а шторка закрывается сама. */
  sidebar.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.target.closest('a.kb-side-link')) setSidebarOpen(false);
  });

  /* Окно доросло до ширины компьютера — меню там уже обычная колонка,
     открытое состояние шторки не нужно. */
  var desktopQuery = window.matchMedia('(min-width: 1024px)');
  var closeOnDesktop = function (mq) {
    if (mq.matches && isOpen()) setSidebarOpen(false);
  };
  if (typeof desktopQuery.addEventListener === 'function') {
    desktopQuery.addEventListener('change', closeOnDesktop);
  } else if (typeof desktopQuery.addListener === 'function') {
    desktopQuery.addListener(closeOnDesktop); /* старые Safari */
  }

  /* ── РАЗДЕЛЫ МЕНЮ: РАСКРЫТИЕ ───────────────────────────────────────── */

  var groups = Array.prototype.slice.call(sidebar.querySelectorAll('.kb-side-group'));
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Раскрытие раздела. В CSS у закрытого списка max-height: 0, а у открытого —
     var(--kb-grp-h): настоящую высоту знает только браузер, поэтому замер идёт
     здесь. Пока раздел открыт, замер остаётся действующим ограничением — так
     список не может «прыгнуть» выше себя, — а при смене языка или ширины окна
     пересчитывается (refreshOpenGroups). */
  function setGroupOpen(group, open, animate) {
    var list = group.querySelector('.kb-side-sublist');
    var title = group.querySelector('.kb-side-group-title');
    if (!list || !title) return;

    title.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (group.classList.contains('is-open') === open) return;

    /* Открытие: замер — стартовая точка перехода. Закрытие: ограничение уже
       стоит с прошлого замера, его и хватает. */
    if (open) group.style.setProperty('--kb-grp-h', list.scrollHeight + 'px');

    /* Без движения — первый показ статьи по ссылке и «уменьшить движение» в
       настройках системы. Класс is-instant снимает переход на один кадр: иначе
       открытие шло бы к запасным 2000px и «догоняло» уже видимый текст. */
    if (animate === false || reduceMotion.matches) {
      group.classList.add('is-instant');
      group.classList.toggle('is-open', open);
      void list.offsetHeight;
      group.classList.remove('is-instant');
      return;
    }

    group.classList.toggle('is-open', open);
  }

  /* Смена языка меняет длину названий статей: пункт может стать двухстрочным,
     и раздел вырос бы выше прошлого замера. Пересчитываем открытые разделы при
     смене html[data-lang] и при изменении ширины окна — высота меняется тем же
     переходом, без рывка. */
  function refreshOpenGroups() {
    for (var i = 0; i < groups.length; i++) {
      if (!groups[i].classList.contains('is-open')) continue;
      var list = groups[i].querySelector('.kb-side-sublist');
      if (list) groups[i].style.setProperty('--kb-grp-h', list.scrollHeight + 'px');
    }
  }

  var refreshFrame = 0;
  window.addEventListener('resize', function () {
    if (refreshFrame) return;
    refreshFrame = window.requestAnimationFrame(function () {
      refreshFrame = 0;
      refreshOpenGroups();
    });
  });

  /* Шрифты догружаются после первой отрисовки и меняют высоту строк: без
     пересчёта открытый раздел обрезал бы последний пункт. */
  window.addEventListener('load', refreshOpenGroups);
  if (document.fonts && typeof document.fonts.ready === 'object') {
    document.fonts.ready.then(refreshOpenGroups);
  }

  if (window.MutationObserver) {
    new MutationObserver(refreshOpenGroups).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-lang']
    });
  }

  /* Клик по названию раздела открывает и закрывает только его: разделы
     независимы, соседние не трогаются. Кнопка нативная, поэтому Enter и Space
     браузер превращает в click сам. */
  sidebar.addEventListener('click', function (e) {
    var title = e.target.closest ? e.target.closest('.kb-side-group-title') : null;
    if (!title) return;
    var group = title.closest('.kb-side-group');
    if (group) setGroupOpen(group, !group.classList.contains('is-open'), true);
  });

  /* Меню другого модуля: kb/js/07-articles.js раскрывает раздел статьи,
     открытой по ссылке, — иначе её подсветка осталась бы в закрытом списке. */
  window.kbSidebar = {
    openGroup: function (group, animate) {
      if (group) setGroupOpen(group, true, animate);
    }
  };

})();