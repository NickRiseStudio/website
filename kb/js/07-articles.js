// ═══════════════════════════════════════════════════════════════════════
// kb/js/07-articles.js — СТАТЬИ В ОДНОМ ДОКУМЕНТЕ: ПОКАЗ, АДРЕС, МЕНЮ
// Грузится: kb/index.html — в конце body, defer. После kb/js/05-toc.js
//         (его kbToc.refresh) и kb/js/06-smooth-scroll.js (прокрутка панели),
//         до kb/animations.js.
// Читает: ?article=<slug> в адресе, #kbMain, #kbArticle, .kb-article-page,
//         .kb-toc-page, #kbSidebar, #kbTitle.
// Пишет: html[data-kb-view], html[data-kb-toc] (есть ли у статьи содержание).
// Публичные (window): нет — модуль самодостаточный.
// Зовёт: window.kbToc (kb/js/05-toc.js), window.kbSidebar (kb/js/04-sidebar.js —
//         раскрыть раздел меню с открытой статьёй).
// Блоки файла:
//   • apply — единственная точка смены вида: классы, адрес, меню, содержание.
//   • Память прокрутки — у каждой статьи своя позиция чтения до перезагрузки.
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

  /* Стартовая статья 0.1: она же открыта, когда в адресе нет ?article=,
     и когда в адресе slug, которого в базе больше нет. */
  var DEFAULT_SLUG = 'start-here';

  /* Открытая секция; пустой адрес открывает стартовую статью. */
  var openPage = null;

  /* Где читатель остановился в каждой статье: slug → scrollTop. Живёт
     в памяти вкладки и переживает любые переходы внутри базы, а при
     перезагрузке начинается заново — свежий заход открывает статью сверху. */
  var scrollMemory = {};

  function scrollKey() {
    return openPage ? openPage.getAttribute('data-kb-article') : '';
  }

  function rememberScroll() {
    scrollMemory[scrollKey()] = main.scrollTop;
  }

  /* Статья по имени из адреса: имя же стоит в data-kb-article у секции,
     у списка содержания и у пункта меню — это единственная связь между ними. */
  function findPage(slug) {
    for (var i = 0; i < pages.length; i++) {
      if (pages[i].getAttribute('data-kb-article') === slug) return pages[i];
    }
    return null;
  }

  /* Адрес статьи — ?article=<slug>, стартовая статья — корень базы знаний
     без параметра. Поэтому серверу не нужно ничего перенастраивать, а ссылка
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
    var page = findPage(slug) || findPage(DEFAULT_SLUG);
    var pageSlug = page ? page.getAttribute('data-kb-article') : '';
    var i;

    /* Статья, с которой уходим. Её пункт останется с одной заливкой, без
       янтарной полосы: видно, где читатель был и где он сейчас. */
    var prevSlug = openPage ? openPage.getAttribute('data-kb-article') : '';

    /* Позицию чтения запоминаем до подмены вида: иначе вернувшийся читатель
       попадал бы в начало статьи. Ключ — статья, из которой уходим. */
    rememberScroll();

    for (i = 0; i < pages.length; i++) {
      pages[i].classList.toggle('is-current', pages[i] === page);
    }
    var hasTocList = false;
    for (i = 0; i < tocPages.length; i++) {
      var isTocPage = !!page && tocPages[i].getAttribute('data-kb-article') === pageSlug;
      if (isTocPage) hasTocList = true;
      tocPages[i].classList.toggle('is-current', isTocPage);
    }
    /* У статьи без разделов списка содержания нет — это заглушка, которая
       ждёт текста. Пустую колонку ей не показываем (kb/css/style/07-toc.css). */
    document.documentElement.setAttribute('data-kb-toc', hasTocList ? 'on' : 'none');
    var activeLink = null;
    for (i = 0; i < sideItems.length; i++) {
      var link = sideItems[i].querySelector('.kb-side-link');
      if (!link) continue;
      /* Открытая статья: янтарная полоса слева и aria-current у её пункта.
         Подсветка живёт на ссылке — подписи групп и номера не трогаем. */
      var own = !!page && link.getAttribute('data-kb-article') === pageSlug;
      link.classList.toggle('is-active', own);
      /* Пункт прошлой статьи: та же янтарная заливка, но без полосы. Полоса
         остаётся приметой одного места — той статьи, что открыта сейчас. */
      link.classList.toggle('is-visited', !own && !!prevSlug &&
        link.getAttribute('data-kb-article') === prevSlug);
      if (own) {
        link.setAttribute('aria-current', 'page');
        activeLink = link;
      } else {
        link.removeAttribute('aria-current');
      }
    }

    /* Пункт открытой статьи лежит внутри своего раздела, а разделы закрыты.
       Раскрываем нужный, иначе подсветки не видно. При первой загрузке
       (move = false) — без движения: там играет вход панели. */
    var activeGroup = activeLink && activeLink.closest
      ? activeLink.closest('.kb-side-group')
      : null;
    if (activeGroup && window.kbSidebar) window.kbSidebar.openGroup(activeGroup, move);

    /* Вид один — статья. Выезда содержания справа, как при переходе с
       приветствия, больше нет: колонка просто встаёт на место. */
    document.documentElement.setAttribute('data-kb-view', 'article');
    openPage = page;
    /* Статья, в которой читатель уже был, открывается там, где он её
       оставил; новая — с начала. */
    main.scrollTop = scrollMemory[pageSlug] || 0;

    /* Стартовая статья живёт по чистому адресу базы — /kb/ без параметра. */
    if (remember && window.history && window.history.pushState) {
      window.history.pushState(null, '', pageSlug === DEFAULT_SLUG
        ? window.location.pathname
        : '?article=' + pageSlug);
    }

    if (window.kbToc) {
      if (page) {
        window.kbToc.refresh();
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