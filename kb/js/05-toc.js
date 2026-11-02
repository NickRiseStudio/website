// ═══════════════════════════════════════════════════════════════════════
// kb/js/05-toc.js — СОДЕРЖАНИЕ СТАТЬИ: ПОДСВЕТКА РАЗДЕЛА
// Грузится: kb/index.html — в конце body, defer. После kb/js/04-sidebar.js.
// Читает: #kbToc, .kb-toc-page.is-current, #kbMain и h2 открытой статьи.
// Публичные (window): kbToc → refresh (пересобрать под открытую статью),
//         playIn (выезд колонки, когда статья открывается из приветствия),
//         close (снять недокрученный выезд). Зовёт kb/js/07-articles.js.
// Блоки файла:
//   • collect / refresh — списки берутся у той статьи, что открыта.
//   • updateActive / setActiveSection — подсветка раздела, который читают:
//         линия взята у середины панели, а не у верхней кромки.
//   • playIn — выезд колонки справа при открытии статьи из приветствия.
//   • Прокрутка #kbMain: пересчёт на кадр и первый пересчёт после загрузки.
//   • Клик по пункту — доезд на линию чтения и подсветка выбранного раздела.
// ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* Где стоит линия подсветки — в долях высоты панели. Раздел становится
     текущим не когда ушёл под верхнюю кромку, а когда его заголовок дошёл до
     середины экрана: именно там читатель и держит внимание. Долей две, по
     направлению прокрутки: вниз раздел заступает за 47%, обратно подсветка
     возвращается только у 72%. Разные доли не дают подсветке дёргаться на
     границе раздела — та же механика, что в навигации основного сайта
     (public/js/scroll.js → updateActiveNavSection). */
  var TOC_LINE_DOWN = 0.47;
  var TOC_LINE_UP = 0.72;

  /* Допуск у самого низа панели: последний раздел обычно короче остатка
     экрана, и до линии его заголовок так и не дойдёт — после него ещё идут
     источники и нижний отступ статьи. Докрутили до конца — текущий раздел
     последний. */
  var TOC_BOTTOM_GAP_PX = 50;

  /* Микроколебания трекпада не должны переключать направление. */
  var TOC_DIR_DELTA_PX = 3;

  /* Куда по клику в содержании встаёт заголовок — тоже доля высоты панели, и
     тоже по линии чтения, а не под кромкой. 30% против 47% у подсветки: у
     заголовка остаётся запас, и пункт становится активным сам, как только
     панель встала, — без принудительной подсветки. */
  var TOC_CLICK_LINE = 0.3;

  var toc = document.getElementById('kbToc');
  var main = document.getElementById('kbMain');
  if (!toc || !main) return;

  /* Содержания на телефоне и планшете нет вовсе: колонка — только компьютер.
     Ширина нужна playIn, чтобы на узком экране не играть входа в невидимую
     панель. */
  var desktopQuery = window.matchMedia('(min-width: 1024px)');
  var links = [];
  var headings = [];

  var activeId = '';

  /* Направление прокрутки панели: по нему выбирается линия подсветки.
     lastScrollTop — позиция панели на прошлом пересчёте. */
  var lastScrollTop = 0;
  var scrollDown = true;

  /* Доезд по клику в содержании: id выбранного раздела и позиция панели, на
     которой доезд закончился. Пока панель стоит на этом месте, подсветка
     держится на выбранном пункте — следующий раздел мог начинаться сразу под
     ним, и общая линия увела бы подсветку на него. Пустая строка — держать
     нечего. */
  var jumpedId = '';
  var jumpedTop = -1;

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

  /* Текущий раздел — последний заголовок, дошедший до линии подсветки. Линия
     стоит в середине панели, поэтому подсвечен тот раздел, который сейчас
     перед глазами, а не тот, что давно ушёл за верхнюю кромку. Пока читатель в
     самом верху статьи, текущий — первый раздел.

     Геометрию читаем здесь же, на кадр: заголовков в статье три-шесть, а
     кэш пришлось бы сбрасывать на смену статьи, языка, шрифты и режим правки —
     промах кэша дал бы подсветку не того раздела. */
  function updateActive() {
    if (!headings.length) return;

    /* Направление прокрутки — по самой панели: страница в базе знаний не
       прокручивается вовсе. */
    var scrollTop = main.scrollTop;

    /* Самый верх статьи: подсвечен всегда первый пункт. Правило стоит раньше
       остальных и заодно обнуляет прошлый доезд — читатель вернулся к началу,
       и держать чужой пункт больше нечего. Состояние направления здесь же
       приводим в порядок: следующий пересчёт уже при прокрутке вниз. */
    if (scrollTop < 2) {
      jumpedId = '';
      lastScrollTop = scrollTop;
      scrollDown = true;
      setActiveSection(headings[0].id);
      return;
    }

    /* Приехали по клику в содержании: пока панель стоит на месте приезда,
       подсветка остаётся на выбранном пункте. Сдвинулась — дальше решает
       общая линия. Допуск 2px: браузер округляет позицию прокрутки. */
    if (jumpedId) {
      if (Math.abs(scrollTop - jumpedTop) < 2) {
        setActiveSection(jumpedId);
        return;
      }
      jumpedId = '';
    }

    var delta = scrollTop - lastScrollTop;
    if (Math.abs(delta) >= TOC_DIR_DELTA_PX) {
      scrollDown = delta > 0;
      lastScrollTop = scrollTop;
    }

    /* Дно панели: до линии последний заголовок уже не дойдёт, а читатель
       видит именно этот раздел. У статьи короче панели дна нет вовсе — там
       прокручивать нечего, и подсветка остаётся на первом разделе. */
    var maxScroll = main.scrollHeight - main.clientHeight;
    if (maxScroll > TOC_BOTTOM_GAP_PX && scrollTop >= maxScroll - TOC_BOTTOM_GAP_PX) {
      setActiveSection(headings[headings.length - 1].id);
      return;
    }

    var line = main.clientHeight * (scrollDown ? TOC_LINE_DOWN : TOC_LINE_UP);
    var mainTop = main.getBoundingClientRect().top;
    var currentId = headings[0].id;
    for (var i = 0; i < headings.length; i++) {
      if (headings[i].getBoundingClientRect().top - mainTop <= line) {
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
    /* Статья открылась с начала: направление и прошлую позицию панели берём
       заново, иначе первый же пересчёт сравнил бы позицию новой статьи со
       старой и выбрал линию не того направления. Доезд прежней статьи тоже
       больше не держим. */
    lastScrollTop = main.scrollTop;
    scrollDown = true;
    jumpedId = '';
    jumpedTop = -1;
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

  /* ── ПЕРЕХОД ПО ПУНКТУ ─────────────────────────────────────────────────
     Плавную прокрутку панели ведёт kb/js/06-smooth-scroll.js. Если движка нет,
     ссылка работает как обычный якорь: панель прокручивает сам браузер.

     Ведём не под кромку панели, а на линию чтения: раздел открывается там же,
     где стоит подсветка, поэтому читать его начинают сразу, а не с верхнего
     края. Сдвиг считаем от scroll-margin-top заголовка (его ставит
     kb/css/style/06-article.css): Lenis прибавляет offset к позиции, значит из
     этого отступа вычитаем долю высоты панели — заголовок опускается на неё. */
  function clickOffset(heading) {
    var margin = parseFloat(window.getComputedStyle(heading).scrollMarginTop);
    if (isNaN(margin)) margin = 0;
    return margin - main.clientHeight * TOC_CLICK_LINE;
  }

  /* Доезд закончился: подсветку держим на выбранном пункте, пока панель стоит
     (updateActive). */
  function holdActive(id) {
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute('href') === '#' + id) {
        jumpedId = id;
        jumpedTop = main.scrollTop;
        setActiveSection(id);
        return;
      }
    }
  }

  toc.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    var link = e.target.closest('a.kb-toc-link');
    if (!link) return;
    var hash = link.getAttribute('href') || '';
    if (hash.charAt(0) !== '#') return;
    var id = hash.slice(1);
    var heading = document.getElementById(id);
    var smooth = window.nrSmoothScroll;
    if (heading && smooth && typeof smooth.scrollToSection === 'function' &&
        smooth.scrollToSection(id, {
          offset: clickOffset(heading),
          onComplete: function () { holdActive(id); }
        })) {
      e.preventDefault();
      /* Адрес сохраняет якорь: ссылкой на раздел можно поделиться. */
      if (window.history && window.history.pushState) window.history.pushState(null, '', hash);
    }
  });

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
    /* На телефоне и планшете колонки нет вовсе — входить нечему. */
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
     снимает недокрученный выезд (kb/js/07-articles.js). */
  window.kbToc = {
    refresh: refresh,
    playIn: playIn,
    close: function () {
      /* Выезд могли прервать возвратом к приветствию: анимация тогда не
         заканчивается, и класс снял бы только этот вызов. */
      toc.classList.remove('is-opening');
    }
  };

  refresh();
  /* После полной загрузки раскладка и переход по якорю из адреса уже
     случились — положение раздела пересчитываем ещё раз. */
  window.addEventListener('load', refresh);
})();