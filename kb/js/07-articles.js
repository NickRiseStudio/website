// ═══════════════════════════════════════════════════════════════════════
// kb/js/07-articles.js — СТАТЬИ В ОДНОМ ДОКУМЕНТЕ: ПОКАЗ, АДРЕС, МЕНЮ
// Грузится: kb/index.html — в конце body, defer. После kb/js/05-toc.js
//         (его kbToc.refresh) и kb/js/06-smooth-scroll.js (прокрутка панели),
//         до kb/animations.js.
// Читает: ?article=<slug> в адресе, #kbMain, #kbArticle, .kb-article-page,
//         .kb-toc-page, #kbSidebar, #kbTitle.
// Публичные (window): нет — модуль самодостаточный.
// Зовёт: window.kbToc (kb/js/05-toc.js), window.kbSidebar (kb/js/04-sidebar.js).
// Блоки файла:
//   • apply — единственная точка смены вида: классы, адрес, меню, содержание.
//   • show — смена статьи из меню или по названию раздела, с движением.
//   • Клики по ссылкам статей, кнопки «назад»/«вперёд», якорь из адреса.
//
// Почему так: статьи лежат в одном html, поэтому переход между ними — не
// загрузка документа, а подмена секции. Заставка #kb-boot в этот момент не
// повторяется, страница не мигает, прокрутка панели начинается с начала
// статьи, а адрес остаётся ссылкой, которой можно поделиться.
// ═══════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var main = document.getElementById('kbMain');
  var article = document.getElementById('kbArticle');
  if (!main || !article) return;

  var toc = document.getElementById('kbToc');
  var pages = article.querySelectorAll('.kb-article-page');
  var tocPages = toc ? toc.querySelectorAll('.kb-toc-page') : [];
  var sideItems = document.querySelectorAll('#kbSidebar .kb-side-item');

  /* Открытая секция; null — открыто приветствие. */
  var openPage = null;

  /* Статья по имени из адреса: имя же стоит в data-kb-article у секции,
     у списка содержания и у пункта меню — это единственная связь между ними. */
  function findPage(slug) {
    for (var i = 0; i < pages.length; i++) {
      if (pages[i].getAttribute('data-kb-article') === slug) return pages[i];
    }
    return null;
  }

  /* Адрес статьи — ?article=<slug>, приветствие — корень базы знаний без
     параметра. Поэтому серверу не нужно ничего перенастраивать, а ссылка
     на статью работает и при заходе снаружи. */
  function slugFromUrl() {
    var found = /[?&]article=([^&#]*)/.exec(window.location.search);
    return found ? found[1] : '';
  }

  /* Одна точка смены вида: секция статьи, её список содержания, пункт меню
     и атрибут на <html>, по которому видят правила раскладки и вход панели.
     remember — положить новый адрес в историю; при переходах «назад/вперёд»
     адрес уже верный, и историю трогать нельзя. move — играть движение смены:
     при загрузке (первый вызов) двигать нечего, там работает вход панели. */
  function apply(slug, remember, move) {
    var page = slug ? findPage(slug) : null;
    var i;
    /* Пункт меню, который открылся именно сейчас: его сопутствующие статьи
       раскрываем движением (kb/js/04-sidebar.js). */
    var openedItem = null;

    for (i = 0; i < pages.length; i++) {
      pages[i].classList.toggle('is-current', pages[i] === page);
    }
    for (i = 0; i < tocPages.length; i++) {
      tocPages[i].classList.toggle('is-current',
        !!page && tocPages[i].getAttribute('data-kb-article') === slug);
    }
    for (i = 0; i < sideItems.length; i++) {
      var link = sideItems[i].querySelector('.kb-side-link');
      var isCurrent = !!page && !!link && link.getAttribute('data-kb-article') === slug;
      if (isCurrent && !sideItems[i].classList.contains('is-current')) openedItem = sideItems[i];
      sideItems[i].classList.toggle('is-current', isCurrent);
      /* Свёрнутые сопутствующие не переживают закрытие статьи: вернувшись,
         читатель должен увидеть список развёрнутым. Тем же вызовом снимается
         недокрученное движение раскрытия (kb/js/04-sidebar.js → closeSubs). */
      if (!isCurrent) {
        sideItems[i].classList.remove('is-collapsed');
        if (window.kbSidebar) window.kbSidebar.closeSubs(sideItems[i]);
      }
      if (!link) continue;
      link.classList.toggle('is-active', isCurrent);
      /* aria-expanded — только у статей: у темы «скоро» пункт не ссылка. */
      if (link.getAttribute('data-kb-article') !== null) {
        link.setAttribute('aria-expanded', isCurrent ? 'true' : 'false');
      }
      if (isCurrent) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }

    /* Содержание приходит вместе со статьёй: если панели в раскладке ещё не
       было («приветствие → статья»), она выезжает справа от края экрана —
       kb/js/05-toc.js → playIn. При переключении статей не мигаем. */
    var tocEnters = !!page && document.documentElement.getAttribute('data-kb-view') !== 'article';
    document.documentElement.setAttribute('data-kb-view', page ? 'article' : 'greeting');
    openPage = page;
    main.scrollTop = 0;

    /* Сопутствующие статьи новой статьи раскрываем движением — как по клику
       на каретку (kb/js/04-sidebar.js). При загрузке не двигаем: там список
       раскрыт сразу, а панели входят по kb/css/anim/02-panels.css. */
    if (move && openedItem && window.kbSidebar) window.kbSidebar.openSubs(openedItem);

    if (remember && window.history && window.history.pushState) {
      window.history.pushState(null, '', page ? '?article=' + slug : window.location.pathname);
    }

    if (window.kbToc) {
      if (page) {
        window.kbToc.refresh();
        if (move && tocEnters) window.kbToc.playIn();
      } else {
        window.kbToc.close();
      }
    }
    if (window.nrSmoothScroll && typeof window.nrSmoothScroll.resync === 'function') {
      window.nrSmoothScroll.resync();
    }
  }

  /* Движение при смене вида — короткий вход текста (css/anim/02-panels.css).
     Класс снимаем и ставим заново в одном кадре: без этого повторная
     анимация не запустится. Первый показ после загрузки не двигаем — там
     работает вход панели. */
  function animate() {
    main.classList.remove('kb-view-in');
    void main.offsetWidth;
    main.classList.add('kb-view-in');
  }

  function currentSlug() {
    return openPage ? openPage.getAttribute('data-kb-article') : '';
  }

  function show(slug) {
    if (slug === currentSlug()) return;
    apply(slug, true, true);
    animate();
  }

  /* Клик по статье в меню или по названию раздела: адрес меняется без
     перезагрузки. Ссылка настоящая, поэтому новую вкладку
     (Ctrl/Cmd/Shift) отдаём браузеру. */
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var link = e.target.closest('a[data-kb-article]');
    if (!link) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    show(link.getAttribute('data-kb-article') || '');
  });

  /* «Назад»/«вперёд»: адрес уже верный, остаётся показать то, что в нём. */
  window.addEventListener('popstate', function () {
    apply(slugFromUrl(), false, true);
    scrollToHash();
    animate();
  });

  /* Ссылка вида ?article=<slug>#раздел: пока статья была скрыта, браузер
     к якорю прыгнуть не мог — доводим прокрутку сами. */
  function scrollToHash() {
    var id = window.location.hash.slice(1);
    if (!id || !openPage) return;
    var target = document.getElementById(id);
    if (!target || !openPage.contains(target)) return;
    var smooth = window.nrSmoothScroll;
    if (smooth && typeof smooth.scrollToSection === 'function' && smooth.scrollToSection(id)) return;
    target.scrollIntoView({ block: 'start' });
  }

  apply(slugFromUrl(), false, false);
  scrollToHash();
})();