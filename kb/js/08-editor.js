// ═══════════════════════════════════════════════════════════════════════
// kb/js/08-editor.js — РЕЖИМ ПРАВКИ СТАТЬИ И СОХРАНЕНИЕ В .MD
// Грузится: kb/index.html — в конце body, defer. После kb/js/07-articles.js
//         (статья и адрес уже расставлены) и до kb/animations.js.
// Читает: ?edit=1 в адресе, .kb-article-page.is-current, #kbArticle, #kbMain,
//         #kbSidebar [data-kb-draft], html[data-lang], window.nrSmoothScroll,
//         window.kbToc, #kbSidebarOverlay.
// Публичные (window): нет — модуль самодостаточный.
// Блоки файла:
//   • Полоса правки и правка на месте: contenteditable, защита разметки.
//   • Черновик темы «скоро»: пункт меню с data-kb-draft открывает пустую
//     статью с готовым названием.
//   • markdown — сборка файла из отредактированной статьи и скачивание.
//
// Зачем так: сайт статический, писать файлы ему некуда. Правка живёт только
// в браузере, а результат уходит в скачанный .md — его отдают ИИ, и тот
// переносит правки в kb/index.html. Ни localStorage, ни запросов здесь нет:
// перезагрузка возвращает исходный текст статьи.
// ═══════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  /* Режим включается только параметром в адресе: у посетителей страница
     остаётся прежней — ни полосы, ни правки. */
  if (!/[?&]edit=1(&|$)/.test(window.location.search)) return;

  var article = document.getElementById('kbArticle');
  var main = document.getElementById('kbMain');
  if (!article || !main) return;

  var originals = {};       /* slug → разметка статьи до правок («Отменить») */
  var bar = null;
  var statusEl = null;
  var tagEl = null;
  var activePage = null;    /* секция, которая правится сейчас */
  var draft = null;         /* открытый черновик темы «скоро» */
  var draftTitles = { ru: '', en: '' };
  var dirty = false;

  /* ── ОБЩЕЕ ────────────────────────────────────────────────────────── */

  function lang() {
    return document.documentElement.getAttribute('data-lang') === 'en' ? 'en' : 'ru';
  }

  function slugOf(page) {
    return page ? (page.getAttribute('data-kb-article') || '') : '';
  }

  function currentPage() {
    return article.querySelector('.kb-article-page.is-current');
  }

  function markDirty(on) {
    dirty = !!on;
    if (bar) bar.classList.toggle('is-dirty', dirty);
  }

  /* Строка состояния — двумя языками, как весь текст страницы: видимость
     выбирает CSS по html[data-lang]. */
  function setStatus(ru, en) {
    if (!statusEl) return;
    statusEl.innerHTML = '';
    var a = document.createElement('span');
    a.setAttribute('data-lang', 'ru');
    a.textContent = ru;
    var b = document.createElement('span');
    b.setAttribute('data-lang', 'en');
    b.textContent = en;
    statusEl.appendChild(a);
    statusEl.appendChild(b);
  }

  function syncTag() {
    if (tagEl) tagEl.textContent = lang().toUpperCase();
  }

  /* ── ПОЛОСА ПРАВКИ ────────────────────────────────────────────────── */

  function makeButton(ru, en, cls) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = cls;
    var a = document.createElement('span');
    a.setAttribute('data-lang', 'ru');
    a.textContent = ru;
    var b = document.createElement('span');
    b.setAttribute('data-lang', 'en');
    b.textContent = en;
    btn.appendChild(a);
    btn.appendChild(b);
    return btn;
  }

  function buildBar() {
    bar = document.createElement('div');
    bar.id = 'kbEditBar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Режим правки / Edit mode');

    var label = document.createElement('span');
    label.className = 'kb-edit-label';
    var dot = document.createElement('span');
    dot.className = 'kb-edit-dot';
    dot.setAttribute('aria-hidden', 'true');
    var ru = document.createElement('span');
    ru.setAttribute('data-lang', 'ru');
    ru.textContent = 'Режим правки';
    var en = document.createElement('span');
    en.setAttribute('data-lang', 'en');
    en.textContent = 'Edit mode';
    label.appendChild(dot);
    label.appendChild(ru);
    label.appendChild(en);

    tagEl = document.createElement('span');
    tagEl.className = 'kb-edit-tag';

    statusEl = document.createElement('span');
    statusEl.className = 'kb-edit-status';

    var save = makeButton('Сохранить .md', 'Save .md', 'kb-edit-btn kb-edit-btn--primary');
    var reset = makeButton('Отменить правки', 'Discard', 'kb-edit-btn');
    var exit = makeButton('Выйти', 'Exit', 'kb-edit-btn');

    save.addEventListener('click', saveMd);
    reset.addEventListener('click', discard);
    exit.addEventListener('click', exitMode);

    bar.appendChild(label);
    bar.appendChild(tagEl);
    bar.appendChild(statusEl);
    bar.appendChild(save);
    bar.appendChild(reset);
    bar.appendChild(exit);
    document.body.appendChild(bar);

    syncTag();
    setStatus('Правьте текст прямо на странице', 'Edit the text right on the page');
  }
  /* ── ПРАВКА НА МЕСТЕ ──────────────────────────────────────────────── */

  /* contenteditable стоит на самой секции: так Enter честно делает новый
     абзац или пункт списка, а не вставляет <br>. Служебные части статьи
     правку не принимают — рамку иллюстрации и её бейдж трогать нельзя. */
  function lockService(page) {
    var fixed = page.querySelectorAll('.kb-figure-frame, .kb-figure-badge');
    for (var i = 0; i < fixed.length; i++) fixed[i].setAttribute('contenteditable', 'false');
  }

  function activate() {
    var page = currentPage();
    if (!page) return;
    if (activePage && activePage !== page && activePage.parentNode) {
      activePage.removeAttribute('contenteditable');
    }
    activePage = page;
    page.setAttribute('contenteditable', 'true');
    lockService(page);
    syncTag();
  }

  /* Разметка статей до правок — для кнопки «Отменить». Снимок делается один
     раз при загрузке: правки живут только в этом окне. */
  function captureOriginals() {
    var pages = article.querySelectorAll('.kb-article-page');
    for (var i = 0; i < pages.length; i++) {
      originals[slugOf(pages[i])] = pages[i].innerHTML;
    }
  }

  function download(name, text) {
    var blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    if (a.parentNode) a.parentNode.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function saveMd() {
    var page = currentPage();
    if (!page) return;
    var code = lang();
    var name = (slugOf(page) || 'article') + '.' + code + '.md';
    download(name, toMarkdown(page, code));
    markDirty(false);
    setStatus('Сохранено: ' + name, 'Saved: ' + name);
  }

  function discard() {
    var page = currentPage();
    if (!page) return;
    if (draft && page === draft) {
      fillDraft(page);
    } else {
      var html = originals[slugOf(page)];
      if (html === undefined) return;
      page.innerHTML = html;
      lockService(page);
    }
    markDirty(false);
    setStatus('Вернул текст статьи до правок', 'Text restored');
  }

  /* Выход — перезагрузка без параметра. Правки после выхода не нужны,
     поэтому про несохранённые не спрашиваем. */
  function exitMode() {
    markDirty(false);
    var slug = draft ? '' : slugOf(currentPage());
    window.location.href = slug ? '?article=' + slug : window.location.pathname;
  }
  /* ── ЧЕРНОВИК ТЕМЫ «СКОРО» ────────────────────────────────────────── */

  /* Название берём из пункта меню: бейдж «скоро» пропускаем — он тоже
     размечен data-lang. */
  function titleOf(item) {
    var out = { ru: '', en: '' };
    var spans = item.querySelectorAll('span[data-lang]');
    for (var i = 0; i < spans.length; i++) {
      var code = spans[i].getAttribute('data-lang');
      if (code !== 'ru' && code !== 'en') continue;
      if (String(spans[i].className).indexOf('kb-side-soon') !== -1) continue;
      if (out[code]) continue;
      out[code] = spans[i].textContent.trim();
    }
    return out;
  }

  function fillDraft(page) {
    page.innerHTML = '';

    var badge = document.createElement('p');
    badge.className = 'kb-draft-badge';
    var badgeRu = document.createElement('span');
    badgeRu.setAttribute('data-lang', 'ru');
    badgeRu.textContent = 'Черновик';
    var badgeEn = document.createElement('span');
    badgeEn.setAttribute('data-lang', 'en');
    badgeEn.textContent = 'Draft';
    badge.appendChild(badgeRu);
    badge.appendChild(badgeEn);

    var h1 = document.createElement('h1');
    h1.className = 'kb-article-title';
    var h1Ru = document.createElement('span');
    h1Ru.setAttribute('data-lang', 'ru');
    h1Ru.textContent = draftTitles.ru;
    var h1En = document.createElement('span');
    h1En.setAttribute('data-lang', 'en');
    h1En.textContent = draftTitles.en;
    h1.appendChild(h1Ru);
    h1.appendChild(h1En);

    /* Пустой абзац на каждый язык: без него в пустой статье некуда поставить
       курсор. */
    var pRu = document.createElement('p');
    pRu.setAttribute('data-lang', 'ru');
    pRu.appendChild(document.createElement('br'));
    var pEn = document.createElement('p');
    pEn.setAttribute('data-lang', 'en');
    pEn.appendChild(document.createElement('br'));

    page.appendChild(badge);
    page.appendChild(h1);
    page.appendChild(pRu);
    page.appendChild(pEn);
    page.setAttribute('contenteditable', 'true');
  }

  function closeSidebarOnPhone() {
    if (window.innerWidth >= 1024) return;
    var overlay = document.getElementById('kbSidebarOverlay');
    if (overlay) overlay.click();
  }

  function openDraft(slug, item) {
    if (draft && draft.getAttribute('data-kb-article') === slug) return;
    var ask = lang() === 'ru' ? 'Несохранённые правки пропадут. Продолжить?'
                              : 'Unsaved changes will be lost. Continue?';
    if (dirty && !window.confirm(ask)) return;
    closeDraft();
    draftTitles = titleOf(item);

    var pages = article.querySelectorAll('.kb-article-page');
    for (var i = 0; i < pages.length; i++) pages[i].classList.remove('is-current');

    var page = document.createElement('section');
    page.className = 'kb-article-page is-current is-draft';
    page.setAttribute('data-kb-article', slug);
    article.appendChild(page);
    draft = page;

    fillDraft(page);
    document.documentElement.setAttribute('data-kb-view', 'article');
    document.documentElement.setAttribute('data-kb-draft', slug);
    main.scrollTop = 0;
    if (window.kbToc && typeof window.kbToc.close === 'function') window.kbToc.close();
    closeSidebarOnPhone();
    activate();
    markDirty(false);
    setStatus('Черновик: пишите текст', 'Draft: start writing');
  }

  function closeDraft() {
    if (!draft) return;
    if (draft.parentNode) draft.parentNode.removeChild(draft);
    if (activePage === draft) activePage = null;
    draft = null;
    document.documentElement.removeAttribute('data-kb-draft');
    var real = currentPage();
    document.documentElement.setAttribute('data-kb-view', real ? 'article' : 'greeting');
    if (real) activate();
  }
  /* ── MARKDOWN ─────────────────────────────────────────────────────── */

  /* Собираем один язык: блоки чужого языка пропускаем. Единственный общий
     блок в статье — список «Источники» без data-lang: он попадает в файл
     любого языка. */
  function tidy(text) {
    return String(text).replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
  }

  function inline(node, code) {
    if (node.nodeType === 3) return node.nodeValue.replace(/\u00a0/g, ' ');
    if (node.nodeType !== 1) return '';

    var own = node.getAttribute('data-lang');
    if (own && own !== code) return '';

    var tag = node.tagName.toLowerCase();
    if (tag === 'br') return '\n';

    /* Подсказка «i» и её бабл — не текст статьи: в .md они не выгружаются.
       Определения живут в разметке, а в скачанном файле стояло бы просто
       «i» и текст подсказки посреди фразы. */
    if (String(node.className || '').indexOf('kb-hint') !== -1) return '';


    var inner = '';
    for (var i = 0; i < node.childNodes.length; i++) {
      inner += inline(node.childNodes[i], code);
    }

    if (tag === 'strong' || tag === 'b') return '**' + tidy(inner) + '**';
    if (tag === 'em' || tag === 'i') return '*' + tidy(inner) + '*';
    if (tag === 'code') return '`' + tidy(inner) + '`';
    if (tag === 'a') return '[' + tidy(inner) + '](' + (node.getAttribute('href') || '') + ')';
    return inner;
  }

  function listOf(list, code, depth) {
    var ordered = list.tagName.toLowerCase() === 'ol';
    var check = String(list.className || '').indexOf('kb-checklist') !== -1;
    var pad = new Array(depth + 1).join('  ');
    var out = [];
    var n = 0;

    for (var i = 0; i < list.children.length; i++) {
      var li = list.children[i];
      if (li.tagName.toLowerCase() !== 'li') continue;

      var own = li.getAttribute('data-lang');
      if (own && own !== code) continue;

      n++;
      var text = '';
      var nested = '';

      for (var j = 0; j < li.childNodes.length; j++) {
        var ch = li.childNodes[j];
        if (ch.nodeType === 1 && /^(ul|ol)$/i.test(ch.tagName)) {
          var sub = listOf(ch, code, depth + 1);
          if (sub) nested += '\n' + sub;
          continue;
        }
        text += inline(ch, code);
      }

      var mark = check ? '- [ ] ' : (ordered ? n + '. ' : '- ');
      out.push(pad + mark + tidy(text) + nested);
    }

    return out.join('\n');
  }

  function blocksOf(root, code) {
    var out = [];

    for (var i = 0; i < root.children.length; i++) {
      var el = root.children[i];
      var own = el.getAttribute('data-lang');
      if (own && own !== code) continue;

      var tag = el.tagName.toLowerCase();
      if (String(el.className || '').indexOf('kb-draft-badge') !== -1) continue;

      if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
        var title = tidy(inline(el, code));
        if (!title) continue;
        var level = tag === 'h1' ? '#' : (tag === 'h2' ? '##' : '###');
        /* id заголовка — якорь содержания: по нему правку переносят и в
           разметку, и в список разделов. */
        var anchor = (tag === 'h2' && el.id) ? ' {#' + el.id + '}' : '';
        out.push(level + ' ' + title + anchor);
        continue;
      }

      if (tag === 'p' || tag === 'div') {
        var text = tidy(inline(el, code));
        if (text) out.push(text);
        continue;
      }

      if (tag === 'ul' || tag === 'ol') {
        var list = listOf(el, code, 0);
        if (list) out.push(list);
        continue;
      }

      if (tag === 'blockquote') {
        var inner = blocksOf(el, code);
        if (!inner.length) continue;
        out.push(inner.join('\n\n').split('\n').map(function (line) {
          return line ? '> ' + line : '>';
        }).join('\n'));
        continue;
      }

      if (tag === 'figure') {
        var img = el.querySelector('img');
        var cap = el.querySelector('figcaption');
        var caption = cap ? tidy(inline(cap, code)) : '';
        if (img) {
          out.push('![' + (img.getAttribute('alt') || '') + '](' +
            (img.getAttribute('src') || '') + ')' + (caption ? '\n\n' + caption : ''));
        } else if (caption) {
          out.push('<!-- иллюстрация: ' + caption + ' -->');
        }
        continue;
      }

      if (tag === 'hr') {
        out.push('---');
        continue;
      }
    }

    return out;
  }

  function toMarkdown(page, code) {
    var head = '<!-- База знаний Nick Rise Studio · статья: ' + (slugOf(page) || 'draft') +
      ' · язык: ' + code + ' -->\n' +
      '<!-- Сохранено из kb/index.html (?edit=1). Правки переносятся в сайт вручную. -->\n';
    return head + '\n' + blocksOf(page, code).join('\n\n') + '\n';
  }
  /* ── СОБЫТИЯ ──────────────────────────────────────────────────────── */

  function bind() {
    /* Enter в заголовке сломал бы якорь и пункт содержания — там он не
       работает. В абзацах и списках Enter делает новую строку сам. */
    article.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.isComposing) return;
      var el = e.target;
      if (el && el.closest && el.closest('h1, h2, h3')) e.preventDefault();
    });

    /* Вставка — только текстом: чужая разметка в статье не нужна, а md
       собирается из этой же разметки. */
    article.addEventListener('paste', function (e) {
      var data = e.clipboardData || window.clipboardData;
      var text = data ? data.getData('text/plain') : '';
      if (!text) return;
      var inserted = false;
      try { inserted = document.execCommand('insertText', false, text); } catch (err) { inserted = false; }
      /* Не вышло — отдаём вставку браузеру: текст важнее чистоты разметки. */
      if (inserted) e.preventDefault();
    });

    /* Ссылки внутри статьи в режиме правки не открываются: клик по тексту
       остаётся кликом по тексту. */
    article.addEventListener('click', function (e) {
      var link = e.target.closest ? e.target.closest('a') : null;
      if (link) e.preventDefault();
    }, true);

    article.addEventListener('input', function () {
      if (!activePage || !activePage.parentNode) return;
      markDirty(true);
      setStatus('Есть несохранённые правки', 'Unsaved changes');
    });

    /* Тема «скоро»: пункт меню с data-kb-draft открывает пустой черновик.
       Пункт — не ссылка, поэтому обработчики меню и статей такой клик
       пропускают; перехватываем на погружении. */
    document.addEventListener('click', function (e) {
      var item = e.target.closest ? e.target.closest('[data-kb-draft]') : null;
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      openDraft(item.getAttribute('data-kb-draft'), item);
    }, true);

    /* Переход на настоящую статью закрывает черновик; саму статью показывает
       kb/js/07-articles.js — здесь только снимаем свою секцию. */
    document.addEventListener('click', function (e) {
      var link = e.target.closest ? e.target.closest('a[data-kb-article]') : null;
      if (!link) return;
      if (draft) closeDraft();
      setTimeout(activate, 0);
    }, true);

    /* kb/js/07-articles.js меняет адрес статьи через pushState и про ?edit=1
       не знает — дописываем параметр, иначе перезагрузка выкинет из правки. */
    var push = window.history.pushState;
    window.history.pushState = function (state, title, url) {
      if (typeof url === 'string' && url && url.indexOf('edit=1') === -1) {
        url += (url.indexOf('?') === -1 ? '?' : '&') + 'edit=1';
      }
      return push.call(window.history, state, title, url);
    };

    /* «Назад/вперёд»: адрес уже верный, kb/js/07-articles.js показал статью. */
    window.addEventListener('popstate', function () {
      if (draft) closeDraft();
      setTimeout(activate, 0);
    });

    /* Язык переключили — подпись в полосе обязана обновиться. */
    var observer = new MutationObserver(syncTag);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });

    /* На сайте правки не сохраняются: перезагрузка их теряет, и браузер
       обязан об этом спросить. */
    window.addEventListener('beforeunload', function (e) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    });
  }

  /* ── СТАРТ ────────────────────────────────────────────────────────── */

  function init() {
    document.documentElement.setAttribute('data-kb-edit', '');
    buildBar();
    captureOriginals();

    /* Плавную прокрутку гасим: с инерционным движком каретка в contenteditable
       «плывёт». Прокрутка панели остаётся нативной. */
    if (window.nrSmoothScroll && typeof window.nrSmoothScroll.destroy === 'function') {
      window.nrSmoothScroll.destroy();
    }

    bind();
    activate();
  }

  init();
})();