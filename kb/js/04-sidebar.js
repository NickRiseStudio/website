// ═══════════════════════════════════════════════════════════════════════
// kb/js/04-sidebar.js — МЕНЮ СТАТЕЙ: ШТОРКА НА ТЕЛЕФОНЕ И ПЛАНШЕТЕ
// Грузится: kb/index.html — в конце body, defer. После kb/js/01-lang.js
//         (язык на кнопках уже стоит).
// Читает: #kbSidebar, #kbSidebarOverlay, #kbSidebarToggle, #kbToc,
//         #kbTocToggle (вторая шторка — содержание статьи).
// Публичные (window): kbSidebar → openSubs (раскрыть сопутствующие статьи
//         открывшейся статьи движением). Зовёт kb/js/07-articles.js.
// Блоки файла:
//   • setSidebarOpen — одно место переключения: классы, aria-expanded.
//   • Обработчики: кнопка, затемнение, Esc, клик по пункту.
//   • openSubs — раскрытие сопутствующих при переходе на статью.
//   • Сопутствующие статьи открытой статьи: повторный клик сворачивает их.
//   • Защита прокрутки под меню и автозакрытие на ширине компьютера.
// ═══════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var sidebar = document.getElementById('kbSidebar');
  var overlay = document.getElementById('kbSidebarOverlay');
  var toggle = document.getElementById('kbSidebarToggle');
  /* Вторая шторка живёт в kb/js/05-toc.js; здесь только закрываем её, когда
     открывается меню, — двух открытых шторок не бывает. */
  var toc = document.getElementById('kbToc');
  var tocToggle = document.getElementById('kbTocToggle');
  if (!sidebar || !toggle) return;

  function isOpen() {
    return sidebar.classList.contains('is-open');
  }

  function closeToc() {
    if (!toc || !tocToggle) return;
    toc.classList.remove('is-open');
    tocToggle.classList.remove('is-open');
    tocToggle.setAttribute('aria-expanded', 'false');
  }

  /* Одна точка переключения: разметка шторки, иконка кнопки (гамбургер ↔
     крестик) и aria-expanded живут в одном состоянии. */
  function setSidebarOpen(open) {
    if (open) closeToc();
    sidebar.classList.toggle('is-open', open);
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
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
     (kb/js/07-articles.js), а шторка закрывается сама. Клик по статье,
     которая уже открыта, никуда не ведёт — он сворачивает и разворачивает
     список её сопутствующих статей. */
  sidebar.addEventListener('click', function (e) {
    if (!e.target.closest) return;

    var activeLink = e.target.closest('a.kb-side-link.is-active');
    if (activeLink) {
      var item = activeLink.closest('.kb-side-item');
      var subs = item ? item.querySelector('.kb-side-subs') : null;
      if (subs) {
        e.preventDefault();
        /* Точная высота нужна только на время перехода: по ней CSS ведёт
           max-height (kb/css/style/05-sidebar.css). scrollHeight отдаёт полную
           высоту и в свёрнутом виде тоже — обрезает список max-height,
           а не он сам. При «уменьшить движение» переходов нет, высота
           не нужна. */
        var noMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!noMotion) subs.style.setProperty('--kb-subs-h', subs.scrollHeight + 'px');

        var collapsed = item.classList.toggle('is-collapsed');
        activeLink.setAttribute('aria-expanded', collapsed ? 'false' : 'true');

        /* Раскрытый список возвращаем к запасу из CSS: с точной высотой он
           обрезал бы текст, который стал выше, — другой язык, узкая полоса
           меню. */
        if (!collapsed) {
          if (noMotion) {
            subs.style.removeProperty('--kb-subs-h');
          } else {
            subs.addEventListener('transitionend', function endExpand(ev) {
              if (ev.propertyName !== 'max-height') return;
              subs.removeEventListener('transitionend', endExpand);
              subs.style.removeProperty('--kb-subs-h');
            });
          }
        }
      }
      return;
    }

    if (e.target.closest('a.kb-side-link, a.kb-side-sub')) setSidebarOpen(false);
  });

  /* Сопутствующие статьи раскрываются движением и при переходе на статью:
     пункт становится текущим (kb/js/07-articles.js), а список в этот момент
     только что попал в раскладку. Переходом такое раскрытие не сыграть —
     с display: none переходы не запускаются, — поэтому его играет анимация
     (kb/css/style/05-sidebar.css → kbSubsOut). Конец анимации — настоящая
     высота списка: её кладём в --kb-subs-h, иначе анимация шла бы к запасу
     из CSS и список раскрылся бы за пару кадров. */
  function openSubs(item) {
    var subs = item ? item.querySelector('.kb-side-subs') : null;
    if (!subs || !item.classList.contains('is-current')) return;

    /* «Уменьшить движение»: список просто виден, анимации нет. */
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    /* Список уже в раскладке: класс is-current поставил apply до этого вызова. */
    var height = subs.scrollHeight;
    if (!height) return;   /* раскрывать нечего */

    subs.style.setProperty('--kb-subs-h', height + 'px');
    item.classList.add('is-opening');

    subs.addEventListener('animationend', function endOpen(ev) {
      if (ev.animationName !== 'kbSubsOut') return;
      subs.removeEventListener('animationend', endOpen);
      closeSubs(item);
    });
  }

  /* Снять движение раскрытия и точную высоту: дальше список живёт на запасе
     высоты из CSS и не обрезает текст, который стал выше. Зовёт
     kb/js/07-articles.js, когда пункт перестаёт быть текущим, — иначе
     недокрученная анимация осталась бы висеть на пункте; и сам openSubs
     по концу анимации. Свёрнутость (.is-collapsed) не трогаем: её ведёт клик
     по каретке выше. */
  function closeSubs(item) {
    if (!item) return;
    item.classList.remove('is-opening');
    var subs = item.querySelector('.kb-side-subs');
    if (subs) subs.style.removeProperty('--kb-subs-h');
  }

  /* Публичное: раскрыть сопутствующие статьи пункта (openSubs) и вернуть
     список в обычное состояние (closeSubs). Зовёт kb/js/07-articles.js при
     смене статьи — там движение смены вида. */
  window.kbSidebar = {
    openSubs: openSubs,
    closeSubs: closeSubs
  };

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
})();