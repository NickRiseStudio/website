// ═══════════════════════════════════════════════════════════════════════
// NICK RISE STUDIO — JS / ПЛЕЕР: ИНТЕРФЕЙС (ЛЕНТА ТРЕКОВ, ПУЛЬТ, ПОДСКАЗКА A/B)
// Источник: script.js, строки 510–767, 1972–3231, 4017–4252, 4537–4981 (перенос 1:1, поведение не менялось)
// Читает снаружи: currentLang, activeTrackLang, activeTrackId, currentTrackPage (js/state.js), CONFIG
// Обязан грузиться после: js/state.js, js/player-audio.js
// Владеет всем, что видно и нажимается:
//   • модель ленты: треки языка, страницы, шаги, точки (getEnabledTracks*,
//     setTrackLanguage, stepTrackPage, goToTrackStep, renderTrackDots);
//   • переход ленты и свайп (animateTrackTransition, runTrackTransition,
//     peek-панели, блик по карточкам);
//   • initPlayer — сборка списка треков и нижнего пульта из CONFIG;
//   • нижний пульт (showStickyPlayer, closeStickyPlayer, toggleDeckPlay,
//     switchDeckSource), подсказка A/B (abHint*);
//   • перемотка и навигация (seekDeckTrack, initDeckSeekBar, prevDeckTrack,
//     nextDeckTrack), индикаторы (updateMasterDeckUI, syncPlayStateUI,
//     updateDeckProgressUI, setDeckBuffering);
//   • карточки и лента (createTrackCard, renderTrackList, прогрев обложек).
// Публичные точки входа (window): initPlayer, toggleTrack, selectTrack,
//   toggleDeckPlay, toggleDeckSource, prevDeckTrack, nextDeckTrack,
//   prevTrackPage, nextTrackPage, setTrackLanguage, renderTrackList,
//   closeStickyPlayer — часть стоит в инлайн-onclick, поэтому только function.
// Звук (js/player-audio.js) только вызывается — сам он сюда не ходит.
// ═══════════════════════════════════════════════════════════════════════

// --- PLAYER & MASTER DECK ENGINE ---
// Доступные треки конкретного языка (RU/EN) — нужно и для текущего списка,
// и для «соседних» peek-панелей во время свайпа.
function getEnabledTracksForLang(lang) {
  if (!CONFIG || !CONFIG.tracks) return [];
  return CONFIG.tracks.filter(tr =>
    tr.enabled !== false &&
    tr.active !== false &&
    tr.visible !== false &&
    (!tr.lang || tr.lang === lang)
  );
}

function getEnabledTracks() {
  return getEnabledTracksForLang(activeTrackLang);
}

// lang — какой язык подсветить. По умолчанию текущий activeTrackLang; во время
// перехода ленты язык передаётся явно, чтобы переключатель переключился СРАЗУ,
// вместе со стартом движения треков, а не после доводки (см. runTrackTransition).
function updateTrackLangButtonsUI(lang = activeTrackLang) {
  const ruBtn = document.getElementById('trackLangRuBtn');
  const enBtn = document.getElementById('trackLangEnBtn');
  const baseClasses = 'track-lang-btn py-2 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap flex-shrink-0';
  const activeClasses = `${baseClasses} is-active bg-amber-500 text-slate-950 border border-amber-500 shadow-md shadow-amber-500/20`;
  const inactiveClasses = `${baseClasses} bg-[#090C12] border border-gray-800/80 text-gray-400 hover:text-white`;

  if (ruBtn) {
    ruBtn.className = lang === 'ru' ? activeClasses : inactiveClasses;
    const dot = ruBtn.querySelector('.track-lang-dot');
    if (dot) dot.className = `track-lang-dot w-2 h-2 rounded-full flex-shrink-0 ${lang === 'ru' ? 'bg-slate-950' : 'bg-transparent'}`;
  }
  if (enBtn) {
    enBtn.className = lang === 'en' ? activeClasses : inactiveClasses;
    const dot = enBtn.querySelector('.track-lang-dot');
    if (dot) dot.className = `track-lang-dot w-2 h-2 rounded-full flex-shrink-0 ${lang === 'en' ? 'bg-slate-950' : 'bg-transparent'}`;
  }
}

// targetPage: 0 — первая страница языка (обычное переключение),
// 'last' — последняя страница (когда листаем список назад по кругу).
function setTrackLanguage(targetLang, targetPage = 0) {
  if (targetLang !== 'ru' && targetLang !== 'en') return;
  if (targetLang === activeTrackLang) return;
  activeTrackLang = targetLang;

  currentTrackPage = targetPage === 'last' ? getTotalTrackPages() - 1 : targetPage;
  updateTrackLangButtonsUI();

  // Треки нового языка нужны раньше всего — поднимаем их в очереди прогрева
  // (см. «ФОНОВЫЙ ПРОГРЕВ АУДИО»): у нового языка подгружается вся страница.
  warmPrioritizeLanguage(targetLang);

  // Первый трек нового языка не выделяется: подсветка живёт только у трека,
  // который пользователь включил сам. Плеер просто обновляет подписи.

  // Smooth entrance animation exclusively for track cards
  renderTrackList(true);
  updateMasterDeckUI();
}

function getTracksPerPage() {
  // Колонок две на телефоне (2 x 2 = 4) и четыре на компьютере (4 x 1 = 4); на
  // планшете список идёт по одному треку в ряд, поэтому там 1 x 4 = 4. В любом
  // случае страница — 4 трека, поэтому число страниц и «остановок» листания не
  // меняется.
  return 4;
}

/* Раскладка карточки трека. «Вертикальная» (как на телефоне): обложка-квадрат
   во всю ширину карточки, ниже название с артистом и жанр. Так карточки идут на
   телефоне (<640px, две колонки) и на компьютере (≥1024px, четыре колонки —
   число колонок в animations.css). На планшете (640–1023px) список стоит в одну
   колонку, поэтому там карточка — строка: обложка-миниатюра и текст в ряд. */
function isVerticalTrackCardView() {
  const w = window.innerWidth;
  return w < 640 || w >= 1024;
}

// Порядок языков при циклическом листании списка треков: EN → RU → EN …
const TRACK_LANG_CYCLE_ORDER = ['en', 'ru'];

// Языки, у которых есть доступные треки (используется для свайпа).
function getTrackLangCycle() {
  return TRACK_LANG_CYCLE_ORDER.filter(lang => getEnabledTracksForLang(lang).length > 0);
}

function getTotalTrackPages() {
  return Math.max(1, Math.ceil(getEnabledTracks().length / getTracksPerPage()));
}

// То же, но для конкретного языка. Нужно, когда страница считается ДО смены
// activeTrackLang — переключатель и точки листаются в начале перехода ленты.
function getTotalTrackPagesForLang(lang) {
  return Math.max(1, Math.ceil(getEnabledTracksForLang(lang).length / getTracksPerPage()));
}

// Треки, которые будут видны на конкретной странице конкретного языка.
// Нужно для peek-панелей: их содержимое = «соседний шаг» списка.
function getTracksForState(lang, page) {
  const all = getEnabledTracksForLang(lang);
  const perPage = getTracksPerPage();
  const maxPages = Math.max(1, Math.ceil(all.length / perPage));
  const safePage = Math.min(Math.max(page, 0), maxPages - 1);
  return all.slice(safePage * perPage, safePage * perPage + perPage);
}

// Куда приведёт шаг ±1: страница того же языка либо другой язык по кругу.
// Ничего не меняет — только считает (используется и для шага, и для peek).
function getStepTarget(direction) {
  const totalPages = getTotalTrackPages();
  const nextPage = currentTrackPage + direction;

  // Обычная страница внутри текущего языка.
  if (nextPage >= 0 && nextPage < totalPages) {
    return { lang: activeTrackLang, page: nextPage, sameLang: true };
  }

  const cycle = getTrackLangCycle();

  // Треки только одного языка — замыкаем страницы по кругу.
  if (cycle.length <= 1) {
    return { lang: activeTrackLang, page: direction > 0 ? 0 : totalPages - 1, sameLang: true };
  }

  const idx = Math.max(0, cycle.indexOf(activeTrackLang));
  const nextLang = cycle[(idx + direction + cycle.length) % cycle.length];
  const langPages = Math.max(1, Math.ceil(getEnabledTracksForLang(nextLang).length / getTracksPerPage()));

  return {
    lang: nextLang,
    // Вперёд — с первой страницы нового языка, назад — с последней.
    page: direction > 0 ? 0 : langPages - 1,
    sameLang: false
  };
}

// Шаг по списку треков: внутри языка листаем страницы, а когда страницы
// закончились — переходим на другой язык по кругу (EN → RU → EN …).
function stepTrackPage(direction) {
  const target = getStepTarget(direction);

  if (target.sameLang) {
    currentTrackPage = target.page;
    renderTrackList(true);
    return;
  }

  setTrackLanguage(target.lang, target.page);
}

function prevTrackPage() {
  stepTrackPage(-1);
}

function nextTrackPage() {
  stepTrackPage(1);
}

// Куда поедет лента при смене языка кнопками EN / RU. Сторону задаёт ПОЛОЖЕНИЕ
// КНОПОК, а не порядок цикла: кнопки стоят в том же порядке, что и страницы
// ленты (слева «На английском», справа «На русском»), поэтому клик по правой
// кнопке тянет ленту влево (новая страница въезжает справа, motion = -1), а по
// левой — вправо (новая страница въезжает слева, motion = 1). Тогда треки
// уезжают в ту сторону, где стоит выбранная кнопка.
function getLangSwitchDirection(targetLang) {
  const btns = Array.from(document.querySelectorAll('.track-lang-btn'));
  const indexOf = (lang) => btns.findIndex(b => b.getAttribute('data-track-lang') === lang);
  const currentIdx = indexOf(activeTrackLang);
  const targetIdx = indexOf(targetLang);
  if (currentIdx < 0 || targetIdx < 0 || targetIdx === currentIdx) return 1;
  return targetIdx > currentIdx ? -1 : 1;
}

/* ── Точки-индикатор листания ─────────────────────────────────────────────
   «Остановки» листания — это язык + страница внутри языка, в порядке цикла
   (EN → RU → EN). Сейчас у каждого языка по одной странице, поэтому точек
   ровно две: столько, сколько раз можно пролистать список. */
function getTrackSteps() {
  const steps = [];
  getTrackLangCycle().forEach(lang => {
    const pages = Math.max(1, Math.ceil(getEnabledTracksForLang(lang).length / getTracksPerPage()));
    for (let page = 0; page < pages; page++) steps.push({ lang, page });
  });
  return steps;
}

// lang / page — состояние, чью точку считать активной. По умолчанию текущее;
// во время перехода ленты передаётся целевое (см. renderTrackDots).
function getCurrentTrackStepIndex(lang = activeTrackLang, page = currentTrackPage) {
  return getTrackSteps().findIndex(s => s.lang === lang && s.page === page);
}

function goToTrackStep(index) {
  const target = getTrackSteps()[index];
  if (!target) return;
  // Хвост свайп-перехода (растворение панели) закрываем сразу — он уже
  // ничего не значит, а шаг по точке должен срабатывать мгновенно.
  finishTrackSwipeTail();
  if (target.lang !== activeTrackLang) {
    setTrackLanguage(target.lang, target.page);
    return;
  }
  currentTrackPage = target.page;
  renderTrackList(true);
}

// Классы точек — те же, что у индикатора карусели услуг (index.html),
// поэтому пересобирать tailwind.css не нужно.
const TRACK_DOT_ACTIVE_CLASS = 'w-8 h-2.5 rounded-full transition-all duration-300 bg-amber-500 shadow-sm shadow-amber-500/50 cursor-pointer';
const TRACK_DOT_IDLE_CLASS = 'w-2.5 h-2.5 rounded-full transition-all duration-300 bg-gray-700 hover:bg-amber-500 cursor-pointer';

// lang / page — какая «остановка» подсвечивается. По умолчанию текущая; во время
// перехода ленты передаётся целевая, чтобы точки переключились сразу вместе со
// стартом движения треков (см. runTrackTransition).
function renderTrackDots(lang = activeTrackLang, page = currentTrackPage) {
  const wrap = document.getElementById('trackDots');
  if (!wrap) return;

  const steps = getTrackSteps();
  const activeIdx = getCurrentTrackStepIndex(lang, page);
  const shouldShow = steps.length > 1;

  const isShown = wrap.style.display !== 'none';
  if (shouldShow !== isShown) {
    wrap.style.display = shouldShow ? '' : 'none';
    if (shouldShow) scheduleScrollTriggerRefresh(0);
  }

  if (!shouldShow) {
    if (wrap.children.length) wrap.innerHTML = '';
    return;
  }

  // Кнопки пересоздаём только при смене их числа — иначе ширина активной точки
  // перетекает плавно (transition-all).
  if (wrap.children.length !== steps.length) {
    wrap.innerHTML = '';
    steps.forEach((step, idx) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `${step.lang.toUpperCase()} — ${step.page + 1}`);
      // Тап ловим сами: после свайпа ленты браузер может «съесть» click
      // (см. bindTapControl).
      bindTapControl(dot, () => goToTrackStep(idx));
      wrap.appendChild(dot);
    });
  }

  Array.from(wrap.children).forEach((dot, idx) => {
    const isActive = idx === activeIdx;
    const cls = isActive ? TRACK_DOT_ACTIVE_CLASS : TRACK_DOT_IDLE_CLASS;
    if (dot.className !== cls) dot.className = cls;
    if (isActive) dot.setAttribute('aria-current', 'true');
    else dot.removeAttribute('aria-current');
  });
}


// ═══ 768–1971 → js/player-audio.js (аудио-движок: загрузка, поток MP3, прогрев) ═══
// Анимация перехода ленты треков (свайп-эффект) и синхронизация стрелок
// листания: назначаются в initPlayer, вызываются из renderTrackList и кнопок.
let animateTrackTransition = null;
let syncTrackNav = null;
// Прогрев peek-панелей (соседние страницы) — тоже назначается в initPlayer.
let warmTrackPeekPanels = null;
/* Куда лента едет прямо сейчас (язык и страница цели). Пока идёт доводка,
   activeTrackLang и currentTrackPage ещё старые, поэтому перерисовка списка
   по ходу перехода (например, тап по карточке «приехавшей» страницы) не должна
   откатывать точки-индикатор назад — их уже поставили по цели перехода. */
let trackTransitionTarget = null;

/* «Хвост» свайп-перехода: растворение уехавшей панели и доводка возврата.
   Лента в этот момент уже стоит на нужной странице, ввод держит только флаг
   swipeAnimating — то есть косметика формально блокирует нажатия. Любое
   новое действие (касание по ленте, кнопка языка, стрелка, точка) закрывает
   хвост сразу: см. finishTrackSwipeTail. Назначает его initPlayer. */
let trackSwipeTail = null;

function finishTrackSwipeTail() {
  const tail = trackSwipeTail;
  trackSwipeTail = null;
  if (tail) tail();
}

/* ══ БЛИК ПО КАРТОЧКАМ ПОСЛЕ СВАЙПА ══════════════════════════════════════
   Тот же янтарный «пробегающий» блик, что и при наведении, но запускается
   явно: каскадом по карточкам страницы и всегда целиком — полоса плавно
   входит из-за кромки и так же уходит (см. @keyframes nrCardSheen
   в animations.css). */
let trackSheenToken = 0;

function playTrackSheen() {
  if (prefersReducedMotion()) return;

  const container = document.getElementById('trackListContainer');
  if (!container) return;

  const cards = Array.from(container.children);
  if (!cards.length) return;

  const token = ++trackSheenToken;
  cards.forEach((card, idx) => {
    card.classList.remove('nr-sheen');
    setTimeout(() => {
      if (token !== trackSheenToken || !card.isConnected) return;
      card.classList.add('nr-sheen');
      const clear = () => card.classList.remove('nr-sheen');
      card.addEventListener('animationend', clear, { once: true });
      // Страховка: если анимация прервана (перерисовка списка), класс всё равно уйдёт.
      setTimeout(clear, 1700);
    }, idx * 70);
  });
}

function initPlayer() {
  /* Дорожки <audio> создаются лениво (см. createTrackAudioEntry выше): на
     загрузке страницы больше нет 16 запросов к mp3. Первый запрос возникает,
     когда пользователь проявляет интерес к конкретной карточке — наведение
     курсором, касание или фокус с клавиатуры. */
  const trackListEl = document.getElementById('trackListContainer');
  if (trackListEl) {
    const warmCardAudio = (e) => {
      const card = e.target && e.target.closest ? e.target.closest('[data-track-id]') : null;
      if (card) prefetchTrackAudio(card.getAttribute('data-track-id'));
    };
    trackListEl.addEventListener('pointerover', warmCardAudio, { passive: true });
    trackListEl.addEventListener('touchstart', warmCardAudio, { passive: true });
    trackListEl.addEventListener('focusin', warmCardAudio);
  }

  // Track Audio Language Switch (RU / EN)
  // Смена языка проходит свайпом-лентой на ЛЮБОЙ ширине (и на компьютере):
  // треки уезжают в сторону выбранной кнопки — правая кнопка ведёт список влево,
  // левая вправо, — а не «вкатываются снизу». Если свайп-лента недоступна
  // (нет её элементов), остаётся прежняя смена с появлением карточек.
  const trackLangBtns = document.querySelectorAll('.track-lang-btn');
  trackLangBtns.forEach(btn => {
    // Тап ловим сами (bindTapControl): после свайпа ленты Android-браузер
    // может не прислать click — и переключатель выглядел бы «мёртвым».
    bindTapControl(btn, () => {
      const targetLang = btn.getAttribute('data-track-lang');
      if (!targetLang || targetLang === activeTrackLang) return;

      if (typeof animateTrackTransition === 'function') {
        // Раскладка 'nav': слева предыдущая страница, справа следующая — как
        // кнопки EN | RU. Сторону перехода задаёт положение кнопок, поэтому
        // клик по правой кнопке ведёт треки влево, а по левой — вправо.
        const direction = getLangSwitchDirection(targetLang);
        // Язык и страница передаются в переход: переключатель и точки
        // переключаются сразу, вместе со стартом движения ленты.
        animateTrackTransition(direction, () => {
          setTrackLanguage(targetLang, direction > 0 ? 'last' : 0);
        }, 'nav', targetLang, direction > 0 ? 'last' : 0);
        return;
      }

      setTrackLanguage(targetLang);
    });
  });
  updateTrackLangButtonsUI();

  // Первый трек намеренно НЕ выбирается автоматически: при загрузке страницы
  // ни одна карточка не должна выглядеть активной. Подсветка появляется только
  // после того, как пользователь сам включит трек (клик по карточке / play).

  /* Прогрев аудио. Раньше здесь грузился только активный трек, а до первого
     клика активного трека нет — то есть не грузилось вообще ничего. Теперь
     подход к секции плеера запускает общую очередь прогрева (см. блок
     «ФОНОВЫЙ ПРОГРЕВ АУДИО» выше по файлу). */
  if ('IntersectionObserver' in window) {
    const playerSec = document.getElementById('player');
    if (playerSec) {
      const ioPlayer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          scheduleInitialAudioWarm();
          ioPlayer.disconnect();
        }
      }, { rootMargin: '350px 0px' });
      ioPlayer.observe(playerSec);
    }
  }

  const pSec = document.getElementById('player');
  if (pSec) {
    pSec.addEventListener('pointerenter', scheduleInitialAudioWarm, { once: true, passive: true });
    pSec.addEventListener('touchstart', scheduleInitialAudioWarm, { once: true, passive: true });
  }

  /* Основной триггер — конец загрузки страницы: критичные ресурсы уже взяты,
     поэтому фоновая очередь не мешает первому рендеру и LCP. */
  if (document.readyState === 'complete') {
    whenBrowserIdle(scheduleInitialAudioWarm);
  } else {
    window.addEventListener('load', () => whenBrowserIdle(scheduleInitialAudioWarm), { once: true });
  }

  /* Вкладка скрыта — новые загрузки не начинаем (текущую не рвём); вернулись
     на страницу — очередь продолжается. */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    warmQueueRun();
    streamResumeActive();   // порционная загрузка слушаемой пары продолжается
  });

  window.addEventListener('resize', () => {
    renderTrackList();
  });

  // Свайп по списку треков (телефон): вправо — вперёд по кругу (EN → RU → EN),
  // влево — назад. Список — «лента» из трёх панелей, поэтому во время свайпа
  // видно, куда листаешь: [следующая страница][текущая][предыдущая].
  // Следующая лежит СЛЕВА, потому что свайп вправо = вперёд, а лента ходит
  // за пальцем: потянул вправо — из-под пальца выезжает следующая страница.
  // Жест определяется по преобладающей оси, preventDefault не вызывается,
  // поэтому вертикальная прокрутка страницы работает как обычно.
  const swipeViewport = document.getElementById('trackListSwipeViewport');
  const swipeTrack = document.getElementById('trackListSwipeTrack');
  const listContainer = document.getElementById('trackListContainer');
  const peekLeftPanel = document.getElementById('trackListPanelLeft');
  const peekRightPanel = document.getElementById('trackListPanelRight');

  if (swipeViewport && swipeTrack && listContainer && peekLeftPanel && peekRightPanel) {
    const SWIPE_AXIS_THRESHOLD = 12; // px: отсекает дрожание пальца при обычном тапе
    const SWIPE_TRIGGER = 60;        // px: порог зачёта свайпа
    /* px: с какого перевеса горизонтали отменяем прокрутку страницы. Меньше
       SWIPE_AXIS_THRESHOLD намеренно — отменять нужно РАНЬШЕ, чем браузер
       успеет начать свой вертикальный скролл (его порог ~8 px), но и не на
       первом же пикселе: иначе вертикальная прокрутка страницы, начатая с
       карточки под небольшим углом, глохла бы. */
    const SWIPE_SCROLL_CANCEL = 6;
    const DRAG_RATIO = 0.55;         // «сопротивление»: палец идёт быстрее ленты
    const DRAG_LIMIT_RATIO = 0.35;   // максимум сдвига — доля ширины списка
    const SETTLE_FALLBACK = 420;     // мс: страховка, если transitionend не придёт
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeAxis = null;       // 'x' | 'y' | null (ещё не определена)
    let swipeAnimating = false; // идёт доводка — новые жесты игнорируем
    let peekReady = false;      // соседние панели отрисованы, лента включена
    /* Нажатие (стрелка, кнопка языка), пришедшее ПОКА ЛЕНТА ЕДЕТ: не теряем
       его, а выполняем сразу после доводки — иначе два перехода наложились бы.
       Первый тап после свайпа сюда уже не попадает: косметический хвост
       перехода (растворение панели) закрывается мгновенно, см.
       finishTrackSwipeTail. Здесь остаются только нажатия во время реального
       движения ленты. */
    let pendingTrackStep = null;

    // Позиция ленты: '' — текущие карточки по центру (режим выключен),
    // 'translate3d(-100%, 0, 0)' — режим свайпа (слева следующая страница,
    // справа предыдущая), дальше — сдвиг пальцем или доводка к соседу.
    // Переход включаем/выключаем инлайново: так порядок «сначала отключить
    // анимацию, потом сдвинуть» гарантирован и не зависит от пересчёта стилей.
    const setTrackX = (transform, animate) => {
      swipeTrack.style.transition = animate ? '' : 'none';
      swipeViewport.classList.toggle('nr-dragging', !animate);
      swipeTrack.style.transform = transform;
    };

    // Возвращаем ленте штатный CSS-переход (после того как кадр отрисован).
    const restoreTrackTransition = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        swipeViewport.classList.remove('nr-dragging');
        swipeTrack.style.transition = '';
      }));
    };

    // Принудительный пересчёт стилей ленты. Нужен, когда положение меняется
    // программно (стрелки, кнопки языка): без него браузер «схлопывает»
    // стартовое положение и доводку в один кадр, и перехода не видно.
    const flushTrackStyles = () => { void swipeTrack.offsetWidth; };

    // Ждём окончания CSS-перехода ленты (со страховкой по времени).
    // Слушаем только сам переход ленты: у карточек внутри есть свои transition,
    // и без фильтра их всплывающие события обрывали бы ожидание раньше времени.
    const afterTrackTransition = (callback) => {
      if (reducedMotion) { callback(); return; }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        swipeTrack.removeEventListener('transitionend', onEnd);
        callback();
      };
      const onEnd = (e) => {
        if (e.target !== swipeTrack || e.propertyName !== 'transform') return;
        finish();
      };
      swipeTrack.addEventListener('transitionend', onEnd);
      setTimeout(finish, SETTLE_FALLBACK);
    };

    /* Отложенное нажатие: пока лента едет, новые шаги не запускаем (иначе два
       перехода наложатся), но и не выбрасываем — выполняем самое свежее сразу
       после доводки. Так нажатие по стрелке или кнопке языка во время движения
       ленты срабатывает, а не пропадает. */
    const runPendingTrackStep = () => {
      const pending = pendingTrackStep;
      pendingTrackStep = null;
      if (pending) pending();
    };

    /* ── Соседние страницы ленты и общий переход шага ──────────────────────
       Панели заполняются только на время анимации (свайп, стрелки, кнопки
       языка). Раскладка:
       • 'swipe' — как при жесте: слева следующая страница (свайп вправо =
         вперёд), справа предыдущая;
       • 'nav'   — как в обычной карусели: слева предыдущая, справа следующая
         (стрелкам так привычнее: правая «толкает» список влево).
       Содержимое панелей НЕ зависит от направления жеста — поэтому при смене
       направления внутри одного свайпа ничего не пересобирается, и гаснущая
       панель успевает уйти плавно. Подпись не даёт пересобирать панели зря. */
    let peekSignature = '';

    // Рисуем в панели карточки конкретной страницы. Карточки без id (иначе в
    // документе появились бы дубли track-item-*) — тем же createTrackCard, что
    // и контейнер, поэтому панель и контейнер выглядят пиксель в пиксель.
    const renderPeekPanel = (panel, lang, page) => {
      const currentDevice = getDeviceType();
      const isVerticalView = isVerticalTrackCardView();
      panel.innerHTML = '';
      getTracksForState(lang, page).forEach(track => {
        // Обложки панелей грузим сразу и заранее декодируем: панель появляется
        // из-за края в первые же кадры свайпа, а к моменту подмены ленты
        // (контейнер получает ту же страницу) картинки уже в кэше — тогда
        // подмена проходит без мелькания пустых обложек.
        panel.appendChild(createTrackCard(track, { isVerticalView, currentDevice, withId: false, eagerImages: true }));
      });
      whenTrackCoversReady(panel);
    };

    const fillPeekPanels = (layout) => {
      const leftTarget = layout === 'nav' ? getStepTarget(-1) : getStepTarget(1);
      const rightTarget = layout === 'nav' ? getStepTarget(1) : getStepTarget(-1);
      const isVerticalView = isVerticalTrackCardView();
      const signature = [
        layout, activeTrackLang, currentTrackPage, currentLang,
        isVerticalView ? 'v' : 'r',
        leftTarget.lang, leftTarget.page, rightTarget.lang, rightTarget.page
      ].join('|');
      if (signature === peekSignature) return;
      peekSignature = signature;

      renderPeekPanel(peekLeftPanel, leftTarget.lang, leftTarget.page);
      renderPeekPanel(peekRightPanel, rightTarget.lang, rightTarget.page);
    };

    /* Прозрачность соседних страниц. При жесте панель проявляется постепенно —
       ровно настолько, насколько ушёл палец (см. moveTrackWithFinger), поэтому
       карточки не «вспыхивают» по краям в первый же пиксель свайпа. Уходит
       панель так же плавно: при смене направления жеста и при возврате ленты
       она гаснет за PEEK_FADE_MS, а уехавшая после шага страница — за
       PEEK_DISSOLVE_MS (чуть медленнее, чтобы растворение читалось). */
    const PEEK_FADE_MS = 280;
    const PEEK_DISSOLVE_MS = 360;
    // Доводка ленты (transform в .track-swipe-track, см. animations.css): въезжающая
    // панель должна дойти до полной видимости ровно к концу доводки.
    const TRACK_SETTLE_MS = 340;
    let peekFadeOutPanel = null;   // панель, которая сейчас гаснет
    let peekFadeOutUntil = 0;

    const fadePeekPanel = (panel, value, animate, duration = PEEK_FADE_MS) => {
      // Пока панель гаснет, не мешаем её переходу (иначе следующий кадр жеста
      // сбросил бы transition и она пропала бы мгновенно).
      if (!animate && panel === peekFadeOutPanel && Date.now() < peekFadeOutUntil) return;
      panel.style.transition = animate ? `opacity ${duration}ms var(--nr-ease)` : 'none';
      panel.style.opacity = String(value);
    };

    const startPeekFadeOut = (panel) => {
      peekFadeOutPanel = panel;
      peekFadeOutUntil = Date.now() + PEEK_FADE_MS;
      fadePeekPanel(panel, 0, true);
    };

    const setPeekFade = (leftOpacity, rightOpacity, animateLeft, animateRight) => {
      fadePeekPanel(peekLeftPanel, leftOpacity, animateLeft);
      fadePeekPanel(peekRightPanel, rightOpacity, animateRight);
    };

    const clearPeekFade = () => {
      peekFadeOutPanel = null;
      peekFadeOutUntil = 0;
      [peekLeftPanel, peekRightPanel].forEach(panel => {
        panel.style.transition = '';
        panel.style.opacity = '';
      });
    };

    // Включаем ленту: рисуем соседние страницы и в том же кадре сдвигаем ленту
    // так, чтобы текущие карточки остались на месте (скачка нет). Панели всегда
    // стартуют прозрачными: при жесте они проявляются по мере движения пальца, а
    // при переходе стрелкой или кнопкой языка — плавно проявляются за время
    // доводки. Так ни одна из сторон не «вспыхивает» полоской у края.
    const enterSwipeMode = (layout = 'swipe') => {
      if (peekReady) return;
      peekReady = true;

      clearPeekFade();
      fillPeekPanels(layout);
      peekMotion = 0;
      setPeekFade(0, 0, false, false);

      swipeViewport.classList.add('nr-swipe-active');
      setTrackX('translate3d(-100%, 0, 0)', false);
    };

    // Выключаем ленту: возвращаем исходную позицию и прячем соседей в одном
    // кадре — список визуально не «прыгает».
    const exitSwipeMode = () => {
      setTrackX('', false);
      swipeViewport.classList.remove('nr-swipe-active');
      // Клики по панелям включала доводка (см. runTrackTransition) — возвращаем
      // штатное «не принимать клики» (см. animations.css → .track-peek-panel).
      peekLeftPanel.style.pointerEvents = '';
      peekRightPanel.style.pointerEvents = '';
      peekLeftPanel.style.touchAction = '';
      peekRightPanel.style.touchAction = '';
      // Панели НЕ очищаем: их карточки (и уже декодированные обложки) остаются
      // готовыми к следующему свайпу. Раньше содержимое сбрасывалось, и при
      // быстром листании панель успевала показаться раньше, чем декодируются
      // картинки — соседние треки «моргали» пустыми обложками. Подпись тоже
      // сохраняем: если состояние списка не изменилось, содержимое панелей
      // остаётся верным и пересобирать его не нужно (см. fillPeekPanels).
      clearPeekFade();
      peekReady = false;
      // Переход закончен — индикаторы снова считаются по состоянию списка.
      trackTransitionTarget = null;
      restoreTrackTransition();
      // Положение стрелок пересчитываем по спокойной раскладке: во время
      // перехода лента сдвинута, и замер «на ходу» дал бы сбитые координаты.
      if (typeof syncTrackNav === 'function') syncTrackNav();
    };

    /* Прогрев панелей: собираем карточки соседних страниц заранее и декодируем
       их обложки, чтобы к следующему свайпу всё было готово. Делается вне кадра
       (rAF) и только когда лента спокойна: во время жеста или перехода панели
       пересобирать нельзя — это сломало бы текущую анимацию. */
    warmTrackPeekPanels = () => {
      requestAnimationFrame(() => {
        if (swipeAnimating || peekReady) return;
        fillPeekPanels('swipe');
        whenTrackCoversReady(peekLeftPanel);
        whenTrackCoversReady(peekRightPanel);
      });
    };

    // Лента идёт за пальцем с «резиновым» сопротивлением.
    let peekMotion = 0;
    const moveTrackWithFinger = (dx) => {
      const width = listContainer.offsetWidth || swipeViewport.offsetWidth || 1;
      const limit = Math.max(90, width * DRAG_LIMIT_RATIO);
      const shift = Math.max(-limit, Math.min(limit, dx * DRAG_RATIO));
      setTrackX(`translate3d(calc(-100% + ${shift}px), 0, 0)`, false);

      // Проявление панели пропорционально сдвигу (smoothstep): полный сдвиг
      // (потолок DRAG_LIMIT_RATIO) даёт полностью видимую соседнюю страницу.
      const p = Math.min(1, Math.abs(shift) / Math.max(1, width * 0.32));
      const eased = p * p * (3 - 2 * p);

      // Смена направления внутри жеста: встречная панель гаснет плавно, а
      // противоположная — проявляется под пальцем.
      const motion = shift >= 0 ? 1 : -1;
      const changed = motion !== peekMotion;
      peekMotion = motion;

      if (motion > 0) {
        if (changed) startPeekFadeOut(peekRightPanel);
        fadePeekPanel(peekLeftPanel, eased, false);
      } else {
        if (changed) startPeekFadeOut(peekLeftPanel);
        fadePeekPanel(peekRightPanel, eased, false);
      }
    };

    // ── Общий переход ленты ────────────────────────────────────────────────
    // Один путь для свайпа, стрелок и кнопок языка: лента доезжает в сторону
    // движения (motion > 0 — вправо, показывая левую панель; motion < 0 — влево,
    // показывая правую), список перерисовывается без штатной «вкатки снизу»
    // (её роль играет выезд ленты сбоку), затем лента возвращается на место.
    // Финал: лента мгновенно встаёт в нейтральное положение (в окне — контейнер
    // с уже новой страницей, пиксели те же), въехавшая панель сразу гаснет (её
    // полоска у края до этого была пустой — иначе она «мигала» бы), а в уехавшую
    // панель кладётся СТАРАЯ страница и плавно растворяется там, куда ушёл жест.
    // applyStep — что применить к состоянию списка (шаг страницы или смена языка).
    // targetLang / targetPage — куда перейдёт список ('last' — последняя страница
    // целевого языка). По ним переключатель языка и точки-индикатор переключаются
    // СРАЗУ, в кадре старта ленты: applyStep срабатывает только по transitionend,
    // и раньше подсветка отставала от треков.
    const runTrackTransition = (motion, applyStep, layout = 'swipe', targetLang = null, targetPage = null) => {
      /* Косметический хвост предыдущего перехода (растворение уехавшей
         панели, доводка возврата) закрываем сразу: он уже ничего не значит,
         а флаг swipeAnimating из-за него откладывал бы нажатие на полсекунды. */
      finishTrackSwipeTail();
      if (swipeAnimating) {
        // Уже едет — нажатие не выбрасываем, а выполним сразу после доводки
        // (см. runPendingTrackStep). Для стрелок цель пересчитывается в их
        // обработчике: за время перехода состояние списка уже изменится.
        pendingTrackStep = () => runTrackTransition(motion, applyStep, layout, targetLang, targetPage);
        return false;
      }

      // «Уменьшить движение»: переключаем состояние без анимации.
      if (reducedMotion) {
        suppressCardEnterAnimation = true;
        try { applyStep(); } finally { suppressCardEnterAnimation = false; }
        return true;
      }

      swipeAnimating = true;

      // Состояние до шага: его страница уезжает в сторону движения и должна там
      // же раствориться — язык и страницу запоминаем СРАЗУ, после applyStep их
      // уже не восстановить.
      const prevLang = activeTrackLang;
      const prevPage = currentTrackPage;

      // Сторона въезда/уезда задана геометрией: лента ходит за пальцем, поэтому
      // при движении вправо новая страница въезжает слева, а старая уходит вправо.
      const entryIsLeft = motion > 0;
      const entryPanel = entryIsLeft ? peekLeftPanel : peekRightPanel;
      const exitPanel = entryIsLeft ? peekRightPanel : peekLeftPanel;

      enterSwipeMode(layout);
      // Пока идёт доводка, видимая страница нарисована в ПАНЕЛИ: контейнер в этот
      // момент стоит за кадром, а панель по умолчанию кликов не принимает
      // (animations.css → .track-peek-panel). Без этого тап по карточке сразу
      // после свайпа пропадал бы впустую. Клик по панели обрабатывает
      // делегированный слушатель swipeTrack (см. initPlayer).
      // touch-action: pan-y — панель принимает клики, но новый свайп по ней всё
      // равно остаётся жестом сайта, а не горизонтальной прокруткой браузера.
      entryPanel.style.pointerEvents = 'auto';
      entryPanel.style.touchAction = 'pan-y';
      // Индикаторы (переключатель языка и точки) переключаем здесь, а не в
      // applyStep: состояние списка меняется только по окончании доводки, а
      // подсветка должна идти вместе с треками. Строго ПОСЛЕ enterSwipeMode: он
      // наполняет панели по ТЕКУЩЕМУ activeTrackLang (getStepTarget читает его),
      // поэтому раньше состояние менять нельзя.
      if (targetLang) {
        const dotsPage = targetPage === 'last'
          ? getTotalTrackPagesForLang(targetLang) - 1
          : (targetPage === null ? currentTrackPage : targetPage);
        // Запоминаем цель: пока лента едет, индикаторы рисуются по ней, а не по
        // ещё не обновлённому состоянию списка (см. renderTrackList).
        trackTransitionTarget = { lang: targetLang, page: dotsPage };
        updateTrackLangButtonsUI(targetLang);
        renderTrackDots(targetLang, dotsPage);
      }
      // Встречная панель уходит за кадр — держим её прозрачной: её полоска у
      // противоположного края не должна «вспыхивать».
      fadePeekPanel(exitPanel, 0, false);
      // Обложки старой страницы декодируем заранее (пока лента едет): их покажет
      // уехавшая панель в момент подмены, и они должны быть готовы — иначе при
      // быстром листании старые треки мелькали бы пустыми.
      const oldPageCoversReady = predecodeTrackCovers(prevLang, prevPage);
      // Фиксируем стартовое положение ленты (-100%) и нулевую прозрачность
      // въезжающей панели до включения переходов — иначе браузер «схлопнул» бы
      // доводку и проявление в один кадр.
      flushTrackStyles();
      // Въезжающая панель проявляется ровно за время доводки: у свайпа она уже
      // видна под пальцем, у стрелки/кнопки языка — плавно появляется из края.
      fadePeekPanel(entryPanel, 1, true, TRACK_SETTLE_MS);
      setTrackX(entryIsLeft ? 'translate3d(0%, 0, 0)' : 'translate3d(-200%, 0, 0)', true);
      afterTrackTransition(() => {
        // Карточки старой страницы запоминаем ДО перерисовки: их покажет уехавшая
        // панель в момент подмены. Это те же узлы, что уже отрисованы в контейнере
        // (обложки декодированы и нарисованы), поэтому старая страница появляется
        // мгновенно — без «моргания» пустыми обложками.
        const oldPageCards = Array.from(listContainer.children);

        suppressCardEnterAnimation = true;
        try {
          applyStep();
        } finally {
          suppressCardEnterAnimation = false;
        }

        const finish = () => {
          trackSwipeTail = null;
          exitSwipeMode();
          // Новая страница встала на место — по карточкам мягко пробегает блик.
          playTrackSheen();
          swipeAnimating = false;
          // Готовим панели к следующему свайпу: их карточки и обложки собираются
          // заранее, поэтому быстрое листание больше не показывает пустые картинки.
          if (typeof warmTrackPeekPanels === 'function') warmTrackPeekPanels();
          // Нажатие, пришедшее во время доводки, выполняем сейчас — тап не теряется.
          runPendingTrackStep();
        };

        if (reducedMotion) { finish(); return; }

        // Обложки новой страницы могут быть ещё не готовы к отрисовке: карточки
        // контейнера только что созданы и стоят ЗА кадром (лента сейчас показывает
        // въехавшую панель), а у карточек loading="lazy". Если подменить ленту
        // прямо сейчас, в этом кадре мелькнут пустые обложки — то самое «моргание».
        // В окне в это время та же страница в панели, поэтому ожидание (обычно
        // единицы миллисекунд, у закэшированных картинок) визуально не заметно.
        // Обложки СТАРОЙ страницы (их покажет уехавшая панель) к этому моменту уже
        // декодированы — их подготовили, пока лента ехала.
        Promise.all([whenTrackCoversReady(listContainer), oldPageCoversReady]).then(() => {
          // «Заглушку» жеста снимаем: панели должны встать такими, как нужно.
          peekFadeOutPanel = null;
          peekFadeOutUntil = 0;

          // Всё одним кадром (до отрисовки): лента в нейтраль, въехавшая панель
          // гаснет, уехавшая показывает старую страницу в полную силу. Её край
          // сейчас занимал контейнер (он уходил в ту же сторону), поэтому подмена
          // незаметна — видно только то, что старая страница осталась на месте.
          // Старую страницу переносим теми же узлами (перерисовка их отсоединила):
          // они уже отрисованы, поэтому картинки не «моргают». Если перерисовка
          // узлы переиспользовала, собираем карточки заново.
          const canMoveOldCards = oldPageCards.length > 0 && oldPageCards.every(card => !card.isConnected);
          if (canMoveOldCards) exitPanel.replaceChildren(...oldPageCards);
          else renderPeekPanel(exitPanel, prevLang, prevPage);
          // Содержимое панелей теперь не соответствует подписи (в уехавшей панели
          // лежит старая страница), поэтому следующая перерисовка обязана пройти —
          // её заранее делает warmTrackPeekPanels в finish().
          peekSignature = '';
          setTrackX('translate3d(-100%, 0, 0)', false);
          fadePeekPanel(entryPanel, 0, false);
          fadePeekPanel(exitPanel, 1, false);
          flushTrackStyles();

          // …и она плавно растворяется — ровно с той стороны, куда ушёл свайп.
          let peekSettled = false;
          const onPeekFadeEnd = (e) => {
            // Только переход прозрачности самой панели: события карточек внутри
            // всплывают сюда же и обрывали бы растворение раньше времени.
            if (e.target !== exitPanel || e.propertyName !== 'opacity') return;
            settlePeek();
          };
          const settlePeek = () => {
            if (peekSettled) return;
            peekSettled = true;
            clearTimeout(peekWatchdog);
            exitPanel.removeEventListener('transitionend', onPeekFadeEnd);
            finish();
          };
          // Страховка: если transitionend не придёт (панель уже прозрачная).
          const peekWatchdog = setTimeout(settlePeek, PEEK_DISSOLVE_MS + 160);
          exitPanel.addEventListener('transitionend', onPeekFadeEnd);
          /* Пока идёт это растворение, лента уже стоит на новой странице, а
             ввод формально ещё заблокирован. Новое касание завершит хвост
             сразу (см. touchstart) — тап не упирается в ожидание. */
          trackSwipeTail = settlePeek;
          fadePeekPanel(exitPanel, 0, true, PEEK_DISSOLVE_MS);
        });
      });
      return true;
    };
    animateTrackTransition = runTrackTransition;

    // Свайп вправо = вперёд (панель следующей страницы лежит слева).
    // Куда шагнёт список, считаем ДО перехода: по этой же цели переключаются
    // переключатель языка и точки (см. runTrackTransition).
    const settleSwipe = (direction) => {
      const target = getStepTarget(direction);
      runTrackTransition(direction, () => stepTrackPage(direction), 'swipe', target.lang, target.page);
    };

    /* Клик/тап по карточке «приехавшей» страницы, пока лента ещё едет: видимая в
       этот момент страница нарисована в панели, поэтому событие приходит сюда, а
       не в карточку контейнера (она стоит за кадром). Без этого первый тап по
       треку после свайпа пропадал бы. */
    const peekCardFromTarget = (target) =>
      (target && target.closest) ? target.closest('.track-peek-panel [data-track-id]') : null;

    // Касание разбираем сами: свайп синтетический click не даёт, а тап — даёт,
    // поэтому click гасим (preventDefault в touchend), чтобы трек не включился
    // дважды.
    swipeViewport.addEventListener('touchend', (e) => {
      if (!swipeAnimating || swipeAxis === 'x') return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      // Сдвиг пальца больше тап-допуска — это не тап, а жест/прокрутка.
      if (Math.abs(touch.clientX - swipeStartX) > 10 || Math.abs(touch.clientY - swipeStartY) > 10) return;
      const card = peekCardFromTarget(e.target);
      if (!card) return;
      e.preventDefault();
      toggleTrack(card.getAttribute('data-track-id'));
    }, { passive: false });

    // Мышь и трекпад (узкое окно компьютера): обычный клик по карточке панели.
    swipeTrack.addEventListener('click', (e) => {
      const card = peekCardFromTarget(e.target);
      if (!card) return;
      toggleTrack(card.getAttribute('data-track-id'));
    });

    /* ── Стрелки листания (телефон) ─────────────────────────────────────────
       Листают список тем же переходом, что и свайп, но по-карусельному:
       правая стрелка толкает список влево (следующие треки въезжают справа),
       левая — вправо (предыдущие въезжают слева). Видимость и положение
       включает syncTrackNav() из renderTrackList. */
    const navPrevBtn = document.getElementById('trackNavPrevBtn');
    const navNextBtn = document.getElementById('trackNavNextBtn');
    const navWrap = document.getElementById('trackListNavWrap');

    // Цель шага считаем в момент выполнения: если нажали во время доводки, к
    // этому моменту состояние списка уже сменилось (см. pendingTrackStep).
    const stepByNav = (motion, direction) => {
      const go = () => {
        const target = getStepTarget(direction);
        runTrackTransition(motion, () => stepTrackPage(direction), 'nav', target.lang, target.page);
      };
      // Косметический хвост прошлого перехода шаг не задерживает.
      finishTrackSwipeTail();
      if (swipeAnimating) { pendingTrackStep = go; return; }
      go();
    };

    if (navPrevBtn) bindTapControl(navPrevBtn, () => stepByNav(1, -1));
    if (navNextBtn) bindTapControl(navNextBtn, () => stepByNav(-1, 1));

    syncTrackNav = () => {
      // Стрелки нужны там, где список идёт в одну колонку — на телефоне и на
      // планшете (до 1024px, как lg в Tailwind): там вьюпорт резервирует под них
      // боковые зоны (см. animations.css). На компьютере карточки стоят в
      // четыре колонки, места под стрелки нет — не показываем.
      const shouldShow = window.innerWidth < 1024 && getTrackSteps().length > 1;
      swipeViewport.classList.toggle('nr-track-nav-mode', shouldShow);

      const t = (CONFIG.i18n && CONFIG.i18n[currentLang] && CONFIG.i18n[currentLang].player) || {};
      if (navPrevBtn) navPrevBtn.setAttribute('aria-label', t.prevBtn || 'Back');
      if (navNextBtn) navNextBtn.setAttribute('aria-label', t.nextBtn || 'Next');

      if (!shouldShow || !navWrap || !navPrevBtn || !navNextBtn) return;

      // Стрелки ставим по краю области карточек (см. ниже). Меряем по вьюпорту и
      // его боковым зонам, а НЕ по контейнеру карточек: во время свайпа лента
      // сдвинута, и замер по ней уводил стрелки в сторону.
      const wrapRect = navWrap.getBoundingClientRect();
      const vpRect = swipeViewport.getBoundingClientRect();
      const vpStyle = getComputedStyle(swipeViewport);
      const padLeft = parseFloat(vpStyle.paddingLeft) || 0;
      const padRight = parseFloat(vpStyle.paddingRight) || 0;
      const padBottom = parseFloat(vpStyle.paddingBottom) || 0;
      const arrowW = navPrevBtn.offsetWidth || 30;

      const cardsLeft = vpRect.left + padLeft;
      const cardsRight = vpRect.right - padRight;
      const cardsCenterY = vpRect.top + (vpRect.height - padBottom) / 2;

      const bandLeft = cardsLeft;                             // полоса 0 … карточки
      const bandRight = window.innerWidth - cardsRight;       // полоса карточки … край окна

      // Стрелку ставим вплотную к карточке. Раньше она вставала в середину
      // свободной полосы: на телефоне полоса узкая (28–34px), и разницы не было,
      // а на планшете полоса широкая — стрелка «висела» бы в пустоте далеко от
      // списка. От края окна оставляем небольшой зазор: на узком экране он и
      // задаёт положение (там вся полоса занята стрелкой).
      const ARROW_GAP = 10;      // зазор между стрелкой и карточкой
      const ARROW_EDGE_MIN = 6;  // минимум от края окна

      const prevScreenLeft = Math.max(ARROW_EDGE_MIN, bandLeft - arrowW - ARROW_GAP);
      const nextScreenRight = Math.max(ARROW_EDGE_MIN, bandRight - arrowW - ARROW_GAP);

      navPrevBtn.style.left = (prevScreenLeft - wrapRect.left) + 'px';
      navNextBtn.style.right = (nextScreenRight - (window.innerWidth - wrapRect.right)) + 'px';

      // Вертикально — ровно по центру карточек (нижний padding вьюпорта — это
      // место, куда «вкатываются» карточки, в высоту списка он не входит).
      const centerY = cardsCenterY - wrapRect.top;
      navPrevBtn.style.top = centerY + 'px';
      navNextBtn.style.top = centerY + 'px';
    };

    // Свайп не зачтён — лента плавно возвращается к текущим карточкам,
    // а соседние страницы так же плавно растворяются.
    const resetSwipe = () => {
      swipeAnimating = true;
      let resetSettled = false;
      setPeekFade(0, 0, true, true);
      flushTrackStyles();
      setTrackX('translate3d(-100%, 0, 0)', true);
      const settleReset = () => {
        if (resetSettled) return;
        resetSettled = true;
        trackSwipeTail = null;
        exitSwipeMode();
        swipeAnimating = false;
        // Тап по стрелке/кнопке языка во время возврата ленты не теряем.
        runPendingTrackStep();
      };
      // Возврат ленты — тоже «хвост»: новое касание завершит его досрочно
      // (см. touchstart), чтобы первый тап после неудавшегося свайпа не ждал.
      trackSwipeTail = settleReset;
      afterTrackTransition(settleReset);
    };

    swipeViewport.addEventListener('touchstart', (e) => {
      const touch = e.changedTouches[0];
      /* Лента уже доехала до новой страницы и сейчас только растворяет
         уехавшую панель — это картинка, а не состояние. Новое касание
         закрывает хвост сразу: иначе первые ~0,5 с после свайпа ввод
         формально заблокирован и тап по кнопке «не срабатывает». */
      if (swipeAnimating && trackSwipeTail) finishTrackSwipeTail();
      // Базу жеста фиксируем ДО проверки swipeAnimating: иначе жест, начавшийся,
      // пока лента ещё доезжает, унаследовал бы координаты и ось (swipeAxis='x')
      // предыдущего свайпа — тогда вертикальный скролл по карточкам таскал бы
      // ленту за собой, а отпускание возвращало её на место.
      if (!touch) return;
      swipeStartX = touch.clientX;
      swipeStartY = touch.clientY;
      swipeAxis = null;
      if (swipeAnimating) return; // во время доводки новый жест не ведём
    }, { passive: true });

    swipeViewport.addEventListener('touchmove', (e) => {
      if (swipeAnimating || swipeAxis === 'y') return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - swipeStartX;
      const dy = touch.clientY - swipeStartY;

      // Ось жеста определяем один раз по первым сантиметрам движения.
      if (swipeAxis === null) {
        // Горизонталь уже перевешивает — отменяем прокрутку страницы, не
        // дожидаясь порога распознавания (см. SWIPE_SCROLL_CANCEL).
        if (Math.abs(dx) > SWIPE_SCROLL_CANCEL && Math.abs(dx) > Math.abs(dy) && e.cancelable) {
          e.preventDefault();
        }
        if (Math.abs(dx) > SWIPE_AXIS_THRESHOLD || Math.abs(dy) > SWIPE_AXIS_THRESHOLD) {
          swipeAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        }
        if (swipeAxis !== 'x') return;
        // Горизонтальный жест: показываем соседние треки и ведём ленту.
        enterSwipeMode('swipe');
      }

      /* Жест признан горизонтальным — страница под пальцем стоять обязана.
         Раньше слушатель был passive и прокрутку не отменял: вместе с лентой
         ехала и страница, после отпускания пальца она получала инерцию, и
         ПЕРВЫЙ тап по ЛЮБОМУ объекту сайта тратился на её остановку — click
         не рождался вовсе. Со стороны это выглядело как «после свайпа первый
         клик никуда не ведёт, второй работает». Вертикальный жест сюда не
         доходит (выход по swipeAxis === 'y' выше) — прокрутка страницы поверх
         карточек остаётся нативной. */
      if (e.cancelable) e.preventDefault();
      moveTrackWithFinger(dx);
    }, { passive: false });

    swipeViewport.addEventListener('touchend', (e) => {
      if (swipeAnimating) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - swipeStartX;
      const dy = touch.clientY - swipeStartY;

      // Вертикальный жест — не мешаем прокрутке страницы.
      if (swipeAxis === 'y') return;
      if (swipeAxis !== 'x') return;

      // Короткий или спорный жест: лента плавно возвращается на место.
      if (Math.abs(dx) < SWIPE_TRIGGER || Math.abs(dx) < Math.abs(dy)) {
        resetSwipe();
        return;
      }

      settleSwipe(dx > 0 ? 1 : -1);
    }, { passive: true });

    // Системный жест (например, «назад» или звонок) — тоже плавно возвращаем.
    swipeViewport.addEventListener('touchcancel', () => {
      if (swipeAnimating || swipeAxis !== 'x') return;
      resetSwipe();
    }, { passive: true });
  }

  initDeckSeekBar();
  updateMasterDeckUI();
  renderTrackList();
  // Панели соседних страниц собираем и декодируем заранее: тогда первый же
  // свайп (в том числе быстрый) показывает готовые обложки, без «моргания».
  if (typeof warmTrackPeekPanels === 'function') warmTrackPeekPanels();
}

/* Пульт могли закрывать крестиком: таймер ухода гасим, а сам класс закрытия
   снимаем — пульт возвращается целым (см. closeStickyPlayer). */
const PLAYER_CLOSING_SLIDE_MS = 950;  // пульт уезжает вниз целиком (см. #stickyPlayerBar.nr-closing)

let playerClosingResetTimer = null;

function showStickyPlayer() {
  const playerBar = document.getElementById('stickyPlayerBar');
  if (playerBar) {
    clearTimeout(playerClosingResetTimer);
    playerClosingResetTimer = null;
    playerBar.classList.remove('nr-closing');

    playerBar.classList.add('active');
    playerBar.classList.remove('translate-y-full');
    playerBar.classList.add('translate-y-0');
    document.body.classList.add('has-sticky-player');

    const barHeight = playerBar.offsetHeight;
    if (barHeight > 0) {
      document.documentElement.style.setProperty('--sticky-player-height', barHeight + 'px');
    }

    scheduleScrollTriggerRefresh(0);
    if (window.NickRiseAnimations && window.NickRiseAnimations.updateRevealObserver) {
      window.NickRiseAnimations.updateRevealObserver();
    }
    setTimeout(() => {
      scheduleScrollTriggerRefresh(0);
      if (window.NickRiseAnimations && window.NickRiseAnimations.updateRevealObserver) {
        window.NickRiseAnimations.updateRevealObserver();
      }
    }, 300);
    setTimeout(() => {
      scheduleScrollTriggerRefresh(0);
      if (window.NickRiseAnimations && window.NickRiseAnimations.updateRevealObserver) {
        window.NickRiseAnimations.updateRevealObserver();
      }
    }, 960);
    // Первое включение трека за сессию — подсказка о кнопке BEFORE / AFTER
    // (показывается, когда пульт уже доехал: см. AB_HINT_DELAY_MS).
    maybeShowAbHint();
  }
}

/* ── ЗАКРЫТИЕ ПУЛЬТА (крестик справа сверху) ───────────────────────────────
   Уход — одно движение: пульт уезжает вниз целиком (корпус вместе с начинкой),
   ровно как приезжал, и за то же время (PLAYER_CLOSING_SLIDE_MS ≈ возврат
   отступа body — style.css, body.has-sticky-player). Раздельных фаз нет.
   Звук останавливаем сразу, но трек остаётся выбранным: повторный клик по
   нему (или по кнопке Play) возвращает пульт на место — showStickyPlayer(). */
function closeStickyPlayer() {
  const playerBar = document.getElementById('stickyPlayerBar');
  if (!playerBar || playerBar.classList.contains('nr-closing')) return;

  // Гасим пару всегда, когда трек выбран: звук мог стоять на паузе «гейта
  // буфера» (wantPlay включён) — тогда после закрытия он снова заиграл бы.
  if (activeTrackId && trackAudioMap[activeTrackId]) {
    pausePairAudio(activeTrackId);
    // Остановили — фон снова качает все треки (см. warmReleaseHold).
    warmReleaseHold();
  }
  // Карточка выбранного трека и кнопки пульта перерисовываются на «паузу».
  updateMasterDeckUI();
  renderTrackList(false);

  // Класс закрытия задаёт кривую ухода, а сам уход начинается со снятия
  // active: его !important-transform держал пульт поднятым, без него панель
  // уезжает в своё нижнее положение — вместе с начинкой (см.
  // #stickyPlayerBar.nr-closing).
  playerBar.classList.add('nr-closing');
  playerBar.classList.remove('active');
  document.body.classList.remove('has-sticky-player');

  // Подсказка о кнопке BEFORE / AFTER уезжает вместе с пультом: иначе её
  // затемнение осталось бы висеть над закрытым пультом.
  hideAbHint();

  scheduleScrollTriggerRefresh(0);
  if (window.NickRiseAnimations && window.NickRiseAnimations.updateRevealObserver) {
    window.NickRiseAnimations.updateRevealObserver();
  }

  // Класс закрытия снимаем и отступы пересчитываем, когда пульт уже за кадром:
  // возврат начинки в этот момент незаметен.
  clearTimeout(playerClosingResetTimer);
  playerClosingResetTimer = setTimeout(() => {
    playerClosingResetTimer = null;
    playerBar.classList.remove('nr-closing');
    scheduleScrollTriggerRefresh(0);
    if (window.NickRiseAnimations && window.NickRiseAnimations.updateRevealObserver) {
      window.NickRiseAnimations.updateRevealObserver();
    }
  }, PLAYER_CLOSING_SLIDE_MS);
}

function toggleTrack(trackId) {
  ensureTrackLoaded(trackId);
  if (activeTrackId === trackId) {
    const item = trackAudioMap[trackId];
    if (!item) return;

    if (isAudioPlaying(trackId)) {
      pausePairAudio(trackId);
      // Остановили — фон снова качает все треки (см. warmReleaseHold).
      warmReleaseHold();
    } else {
      prepareAudioPair(item);
      applyAudioVolumes(trackId);
      playPairAudio(trackId);
      showStickyPlayer();
      // Трек слушают: он вне очереди прогрева, соседи — сразу за ним,
      // а фоновая очередь удерживается (канал свободен под перемотку).
      warmOnPlay(trackId);
      warmHold(trackId);
    }
    updateMasterDeckUI();
    renderTrackList(false);
    return;
  }

  selectTrack(trackId, true);
}

function selectTrack(trackId, shouldPlay = true) {
  ensureTrackLoaded(trackId);
  if (activeTrackId && activeTrackId !== trackId) {
    const prevItem = trackAudioMap[activeTrackId];
    if (prevItem) {
      pausePairAudio(activeTrackId);
    }
  }

  activeTrackId = trackId;
  const item = trackAudioMap[trackId];

  if (item) {
    applyAudioVolumes(trackId);
    if (shouldPlay) {
      prepareAudioPair(item);
      playPairAudio(trackId);
      showStickyPlayer();

      // Соседние треки — сразу в начало очереди прогрева: следующий клик по
      // «Next» не должен ждать сеть. Раньше здесь стоял таймер 1.5 с и грузился
      // один трек — при быстром листании он просто не успевал сработать.
      warmOnPlay(trackId);
      // Слушают этот трек — фоновую очередь удерживаем, канал свободен.
      warmHold(trackId);
    } else {
      pausePairAudio(trackId);
      warmReleaseHold();
    }
  }

  updateMasterDeckUI();
  renderTrackList(false);
}

function isAudioPlaying(trackId) {
  const item = trackAudioMap[trackId];
  if (!item) return false;
  return !item.audioA.paused || !item.audioB.paused;
}

function toggleDeckPlay() {
  const enabledTracks = getEnabledTracks();
  if (!activeTrackId && enabledTracks.length > 0) {
    activeTrackId = enabledTracks[0].id;
  }
  if (!activeTrackId) return;
  ensureTrackLoaded(activeTrackId);
  const item = trackAudioMap[activeTrackId];
  if (!item) return;

  if (isAudioPlaying(activeTrackId)) {
    pausePairAudio(activeTrackId);
    warmReleaseHold();
  } else {
    prepareAudioPair(item);
    applyAudioVolumes(activeTrackId);
    playPairAudio(activeTrackId);
    showStickyPlayer();

    // Соседние треки — сразу в начало очереди прогрева (см. блок «ФОНОВЫЙ
    // ПРОГРЕВ АУДИО»): таймер 1.5 с не успевал сработать при быстром листании.
    warmOnPlay(activeTrackId);
    warmHold(activeTrackId);
  }

  updateMasterDeckUI();
  renderTrackList(false);
}

function updateDeckSourceUI() {
  if (!activeTrackId) return;
  const item = trackAudioMap[activeTrackId];
  if (!item) return;
  // Обновляем только переключатели источника: полная перерисовка пульта в момент
  // клика не нужна (и давала лишнюю работу в главном потоке).
  document.querySelectorAll('.deck-source-switch').forEach(sw => {
    sw.setAttribute('data-source', item.source);
  });
}

function switchDeckSource(src) {
  if (!activeTrackId) return;
  const item = trackAudioMap[activeTrackId];
  if (!item || item.source === src) return;

  const nextEl = src === 'before' ? item.audioA : item.audioB;
  const prevEl = src === 'before' ? item.audioB : item.audioA;

  /* Пара могла остаться без графа (первый клик застал контекст спящим): тогда
     фейд выродился бы в скачок заглушки. Подключаем сейчас, пока уровни ещё
     прежние, — это неслышно, зато переключение пойдёт рампами. */
  if (ensurePairAudioGraph(activeTrackId)) applyAudioVolumes(activeTrackId, false);

  /* Переключение на непрогруженной паре — это тоже перемотка: второй дорожке
     нужен тот же участок из сети. Отдаём ей канал так же, как при обычной
     перемотке (если пара уже целиком в буфере — ничего не делаем, чтобы не
     держать фон без причины). */
  if (!isPairWarm(item)) warmOnSeek(activeTrackId, pairPos(prevEl));

  /* Источник и интерфейс меняются мгновенно: отклик кнопки не должен зависеть
     от того, что в этот момент происходит со звуком. */
  item.source = src;
  item.switchAt = performance.now();
  updateDeckSourceUI();
  item.seekPending = false;

  /* Пара стоит на паузе: звука нет, выравнивание позицией неслышно — уровни
     переключаем сразу, без фейда. */
  if (prevEl.paused && nextEl.paused) {
    cancelDeckSwitch();
    alignPairTo(item, prevEl);
    applyAudioVolumes(activeTrackId, false);
    return;
  }

  /* Входящая дорожка не готова звучать (браузер её остановил, нет данных в этой
     точке): запускаем её, просим порцию с текущей позиции, а кроссфейд отложим
     до готовности. Звук при этом не рвётся — играет прежняя дорожка. */
  if (!isDeckReadyToSound(nextEl)) {
    const played = nextEl.play();
    if (played && played.catch) played.catch(() => {});
    streamSeekTo(activeTrackId, pairPos(prevEl));
    waitDeckReadyThenFade(item, nextEl, prevEl, src);
    return;
  }

  /* Обычный путь: обе дорожки уже идут с одной позиции — только кроссфейд. */
  fadePairToSource(item, nextEl);
}

function toggleDeckSource() {
  // Клик по самой кнопке BEFORE / AFTER тоже гасит подсказку о ней.
  hideAbHint();
  const enabledTracks = getEnabledTracks();
  if (!activeTrackId && enabledTracks.length > 0) {
    activeTrackId = enabledTracks[0].id;
    ensureTrackLoaded(activeTrackId);
  }
  if (!activeTrackId) return;
  const item = trackAudioMap[activeTrackId];
  if (!item) return;

  const nextSrc = item.source === 'before' ? 'after' : 'before';
  switchDeckSource(nextSrc);
}

/* ── ПОДСКАЗКА ПРО КНОПКУ BEFORE / AFTER ──────────────────────────────────
   Первое включение трека за сессию: пульт выезжает, через секунду (когда он
   уже стоит на месте) страница уходит в затемнение, а над переключателем
   появляется подсказка с хвостиком. Гаснет плавно по клику на фон, на
   затемнение пульта или на саму кнопку (см. style.css → блок «ПОДСКАЗКА ПРО
   ПЕРЕКЛЮЧАТЕЛЬ BEFORE / AFTER»).

   Флаг — в sessionStorage (как язык в localStorage: с try/catch): в новой
   вкладке подсказка покажется снова, а обновление страницы, повторный запуск
   того же трека и переход к следующему — нет.
   ────────────────────────────────────────────────────────────────────── */

const AB_HINT_KEY = 'nick_rise_ab_hint';
const AB_HINT_DELAY_MS = 950;   // ждём, пока пульт доедет (0.95s — style.css)
const AB_HINT_GAP_PX = 12;      // зазор между хвостиком бабла и кромкой пульта
const AB_HINT_CENTER_VW = 640;  // узкое окно (телефон): пульт показывает мобильный ряд — бабл ставим по центру
const AB_HINT_TAIL_MARGIN_PX = 28;  // хвостик не ближе этого к углу плашки (скругление 20px + половина хвостика 16px)
/* ВРЕМЕННО, ДЛЯ ПРОВЕРКИ: true — подсказка показывается один раз за загрузку
   страницы (флаг живёт в памяти, обновление страницы его сбрасывает). Вернуть
   false, когда проверка закончится: включится обычный режим — один раз за
   сессию (sessionStorage). */
const AB_HINT_EVERY_LOAD = true;

let abHintTimer = null;
let abHintVisible = false;
let abHintShownThisLoad = false;

function abHintSeen() {
  if (AB_HINT_EVERY_LOAD) return abHintShownThisLoad;
  try {
    return sessionStorage.getItem(AB_HINT_KEY) === '1';
  } catch (e) {
    return false;
  }
}

function markAbHintSeen() {
  if (AB_HINT_EVERY_LOAD) {
    abHintShownThisLoad = true;
    return;
  }
  try {
    sessionStorage.setItem(AB_HINT_KEY, '1');
  } catch (e) {}
}

/* Бабл ставим правым краем по кнопке (у мобильного и компьютерного рядов пульта
   переключатели свои — берём видимый) и над верхней кромкой пульта, чтобы
   внутри пульта он ничего не перекрывал. Хвостик указывает на середину кнопки,
   но не вылезает за скругление плашки. Размеры читаем при скрытом бабле — он
   поэтому и не убирается через display: none (см. style.css). */
function positionAbHint() {
  const tip = document.getElementById('abHintTip');
  const bar = document.getElementById('stickyPlayerBar');
  if (!tip || !bar) return false;

  let sw = null;
  document.querySelectorAll('.deck-source-switch').forEach((el) => {
    if (!sw && el.getBoundingClientRect().width > 0) sw = el;
  });
  if (!sw) return false;

  const swRect = sw.getBoundingClientRect();
  const barRect = bar.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();

  /* На телефонах плашка стоит по центру экрана: кнопка там жмётся к правому
     краю, и выравнивание по ней уводило бы текст в угол. Хвостик всё равно
     указывает на кнопку — его место считается от того же края. */
  const left = window.innerWidth < AB_HINT_CENTER_VW
    ? Math.max(8, Math.round((window.innerWidth - tipRect.width) / 2))
    : Math.min(
        Math.max(8, window.innerWidth - tipRect.width - 8),
        Math.max(8, swRect.right - tipRect.width)
      );
  const top = Math.max(8, barRect.top - tipRect.height - AB_HINT_GAP_PX);
  const tailX = Math.min(
    tipRect.width - AB_HINT_TAIL_MARGIN_PX,
    Math.max(AB_HINT_TAIL_MARGIN_PX, swRect.left + swRect.width / 2 - left)
  );

  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
  tip.style.setProperty('--nr-ab-tail-x', tailX + 'px');
  return true;
}

/* Прокрутка на время подсказки. Приём тот же, что у заставки (animations.js →
   blockScroll/blockKeys): перехват на входе (capture) и preventDefault. Колесо
   гасится ещё и потому, что собственный плавный скролл (smoothscroll-nr.js →
   onWheel) выходит сразу, увидев defaultPrevented. Клавиши он разбирает раньше
   нас (его слушатель тоже capture на window), поэтому уже набранный ход снимаем
   через SmoothScroll.cancel: иначе страница поехала бы программно, а такой ход
   overflow: hidden не держит. */
function abHintCancelScrollMotion() {
  try {
    if (window.SmoothScroll && typeof window.SmoothScroll.cancel === 'function') {
      window.SmoothScroll.cancel();
    }
  } catch (e) {}
}

function abHintBlockScroll(e) {
  e.preventDefault();
  abHintCancelScrollMotion();
}

function abHintBlockKeys(e) {
  const k = e.key || '';
  /* Tab и Enter не трогаем: с клавиатуры на кнопку нужно попасть и нажать её. */
  if (k === 'Tab' || k === 'Enter') return;
  if (k === ' ' || k === 'Spacebar' || /^(Arrow|PageUp|PageDown|Home|End)/.test(k)) {
    e.preventDefault();
    abHintCancelScrollMotion();
  }
}

function showAbHint() {
  const bar = document.getElementById('stickyPlayerBar');
  const tip = document.getElementById('abHintTip');
  const overlay = document.getElementById('abHintOverlay');
  if (abHintVisible || !bar || !tip || !overlay) return;
  // Пока подсказка ждала свою секунду, пульт могли закрыть крестиком.
  if (!bar.classList.contains('active')) return;
  if (!positionAbHint()) return;

  markAbHintSeen();
  tip.classList.add('show');
  overlay.classList.add('show');
  document.documentElement.classList.add('nr-ab-hint');
  abHintVisible = true;
  // Пока подсказка висит, держим её на кнопке (поворот экрана, масштаб окна).
  window.addEventListener('resize', positionAbHint);
  /* И держим на месте страницу: колесо, свайп и клавиши-скролл. Заодно гасим
     уже набранный ход колеса — если страница в этот момент «доезжала». */
  abHintCancelScrollMotion();
  window.addEventListener('wheel', abHintBlockScroll, { passive: false, capture: true });
  window.addEventListener('touchmove', abHintBlockScroll, { passive: false, capture: true });
  window.addEventListener('keydown', abHintBlockKeys, { capture: true });
}

/* Убирается и по клику на фон (оверлей и затемнение пульта), и по клику на саму
   кнопку — она выше затемнения, её onclick зовёт toggleDeckSource. Ожидание
   показа здесь не гасим: клик по пульту (например, по Play) сам включает трек,
   и подсказка после него показаться должна — её и запускает showStickyPlayer. */
function hideAbHint() {
  if (!abHintVisible) return;

  abHintVisible = false;
  window.removeEventListener('resize', positionAbHint);
  window.removeEventListener('wheel', abHintBlockScroll, { capture: true });
  window.removeEventListener('touchmove', abHintBlockScroll, { capture: true });
  window.removeEventListener('keydown', abHintBlockKeys, { capture: true });
  abHintCancelScrollMotion();
  document.documentElement.classList.remove('nr-ab-hint');

  const tip = document.getElementById('abHintTip');
  const overlay = document.getElementById('abHintOverlay');
  if (tip) tip.classList.remove('show');
  if (overlay) overlay.classList.remove('show');
}

function maybeShowAbHint() {
  if (abHintSeen() || abHintVisible) return;
  clearTimeout(abHintTimer);
  abHintTimer = setTimeout(() => {
    abHintTimer = null;
    showAbHint();
  }, AB_HINT_DELAY_MS);
}


// ═══ 3232–3335 → js/logo-hint.js (подсказка под логотипом);
//     3336–4016 → js/player-audio.js (кроссфейд, синхронизация, звуковой тракт) ═══
function seekDeckTrack(e) {
  if (!activeTrackId) return;
  const item = trackAudioMap[activeTrackId];
  if (!item) return;

  const hitArea = document.getElementById('deckSeekHitArea') || e.currentTarget;
  const rect = hitArea.getBoundingClientRect();
  if (rect.width <= 0) return;

  const clientX = (e.touches && e.touches[0]) 
    ? e.touches[0].clientX 
    : (e.clientX !== undefined ? e.clientX : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0));

  const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
  const { audible, silent } = getAudiblePair(item);
  const dur = audible.duration || silent.duration || 0;

  if (dur > 0) {
    const newTime = (clickX / rect.width) * dur;
    /* Ключевой момент для «перемотал на припев». Новое место почти наверняка
       ещё не в буфере, поэтому браузер идёт в сеть за этим участком. Если в это
       же время фон качает следующую пару, канал делится пополам и звук ждёт —
       те самые секунды. Поэтому перемотка немедленно забирает канал: активный
       трек получает максимальный приоритет, фоновая загрузка прерывается. */
    warmOnSeek(activeTrackId, newTime);
    // Тянем только звучащую дорожку: два seek одновременно и давали рывок звука.
    audible.currentTime = newTime;
    item.seekPending = true;
    /* Позиция окончательная — просим порцию (15 с) отсюда для ОБЕИХ дорожек
       пары, иначе вторая останется без данных и гейт буфера не отпустит. */
    streamSeekTo(activeTrackId, newTime);
    updateDeckProgressUI();
  }
}

function initDeckSeekBar() {
  const seekArea = document.getElementById('deckSeekHitArea');
  if (!seekArea) return;

  let isSeeking = false;
  /* true, если ползунок реально потянули. Обычный тап обрабатывает onclick
     у #deckSeekHitArea (seekDeckTrack) — иначе одно нажатие уходило бы в
     перемотку дважды: и здесь (pointerdown/up), и там. */
  let seekMoved = false;

  const handleSeekFromEvent = (e) => {
    if (!activeTrackId) return;
    const item = trackAudioMap[activeTrackId];
    if (!item) return;

    const rect = seekArea.getBoundingClientRect();
    if (rect.width <= 0) return;

    const clientX = (e.touches && e.touches[0])
      ? e.touches[0].clientX
      : (e.clientX !== undefined ? e.clientX : (e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : 0));

    const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const { audible, silent } = getAudiblePair(item);
    const dur = audible.duration || silent.duration || 0;

    if (dur > 0) {
      const newTime = (clickX / rect.width) * dur;
      // Во время перетаскивания двигаем только звучащую дорожку —
      // тихую выровняем одним seek после того, как закончится прокрутка.
      audible.currentTime = newTime;
      item.seekPending = true;
      updateDeckProgressUI();
    }
  };

  // Pointer drag events
  seekArea.addEventListener('pointerdown', (e) => {
    isSeeking = true;
    seekMoved = false;
    try { seekArea.setPointerCapture(e.pointerId); } catch (err) {}
  });

  seekArea.addEventListener('pointermove', (e) => {
    if (!isSeeking) return;
    seekMoved = true;
    handleSeekFromEvent(e);
  });

  const stopSeeking = (e) => {
    if (!isSeeking) return;
    isSeeking = false;
    try { seekArea.releasePointerCapture(e.pointerId); } catch (err) {}
    /* Тап без перемещения — не наша забота: его доводит onclick (seekDeckTrack). */
    if (!seekMoved) return;

    // Прокрутка закончилась: выравниваем вторую дорожку по звучащей одним движением
    if (activeTrackId) {
      const item = trackAudioMap[activeTrackId];
      if (item) {
        item.seekPending = true;
        if (item.audioA.paused && item.audioB.paused) prepareAudioPair(item);
        /* Позиция окончательная: обе дорожки пары просят порцию (15 с) ровно
           отсюда. Раньше здесь ничего не делалось, и до данных докачивалась
           только слышимая дорожка — гейт общего буфера держал паузу, пока
           пользователь не переключит трек. */
        const at = (item.source === 'before' ? item.audioA : item.audioB).currentTime || 0;
        streamSeekTo(activeTrackId, at);
        /* Перемотка — это и перемотка по треку: канал под активную пару. */
        if (!isPairWarm(item)) warmOnSeek(activeTrackId, at);
      }
    }
  };

  seekArea.addEventListener('pointerup', stopSeeking);
  seekArea.addEventListener('pointercancel', stopSeeking);

  // Touch fallback
  seekArea.addEventListener('touchmove', (e) => {
    seekMoved = true;
    handleSeekFromEvent(e);
  }, { passive: true });
}

function prevDeckTrack() {
  const tracks = getEnabledTracks();
  if (tracks.length === 0) return;

  const curIdx = tracks.findIndex(t => t.id === activeTrackId);
  let nextIdx = curIdx - 1;
  if (nextIdx < 0) nextIdx = tracks.length - 1;

  selectTrack(tracks[nextIdx].id, true);
}

function nextDeckTrack() {
  const tracks = getEnabledTracks();
  if (tracks.length === 0) return;

  const curIdx = tracks.findIndex(t => t.id === activeTrackId);
  let nextIdx = curIdx + 1;
  if (nextIdx >= tracks.length) nextIdx = 0;

  selectTrack(tracks[nextIdx].id, true);
}

/* Состояние «звук идёт / звук стоит», которое СЕЙЧАС нарисовано на кнопках
   Play (пульт снизу и карточки списка). Нужно, чтобы доводить иконки после
   старта, случившегося без клика (см. syncPlayStateUI). */
let deckUiPlaying = null;

function updateMasterDeckUI() {
  const enabledTracks = getEnabledTracks();
  const track = (CONFIG && CONFIG.tracks) 
    ? (CONFIG.tracks.find(t => t.id === activeTrackId) || enabledTracks.find(t => t.id === activeTrackId)) 
    : enabledTracks.find(t => t.id === activeTrackId);
  if (!track) return;

  const currentDevice = getDeviceType();
  const item = trackAudioMap[activeTrackId] || { source: 'after', volume: 0.9 };
  const isPlaying = isAudioPlaying(activeTrackId);
  // Что именно нарисовано сейчас — сверяется в syncPlayStateUI.
  deckUiPlaying = isPlaying;
  const genreText = resolveI18nValue(track.genreLabel, currentLang, currentDevice);
  const trackTitle = resolveDeviceText(track.title, currentDevice);
  const trackArtist = resolveDeviceText(track.artist, currentDevice);

  // Обложка в плеере: если файл трека недоступен — показываем заглушку.
  document.querySelectorAll('.deck-cover').forEach(el => {
    el.onerror = () => { el.onerror = null; el.src = './image/!image_none.jpg'; };
    el.src = track.cover;
  });
  document.querySelectorAll('.deck-title').forEach(el => { el.textContent = trackTitle; });
  document.querySelectorAll('.deck-artist').forEach(el => { el.textContent = trackArtist; });
  document.querySelectorAll('.deck-genre').forEach(el => { el.textContent = genreText; });

  // Source Switches (BEFORE / AFTER)
  document.querySelectorAll('.deck-source-switch').forEach(sw => {
    sw.setAttribute('data-source', item.source);
  });

  // Play Button & Icons
  const playIcons = document.querySelectorAll('.deck-play-icon');
  const playBtns = document.querySelectorAll('.deck-play-btn');

  playIcons.forEach(el => {
    el.innerHTML = isPlaying 
      ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>' 
      : '<path d="M8 5v14l11-7z"/>';
  });
  playBtns.forEach(el => {
    if (isPlaying) {
      el.className = 'deck-play-btn w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-amber-400 text-slate-950 font-black rounded-full transition-all shadow-xl shadow-amber-500/30 scale-105 flex-shrink-0 cursor-pointer';
    } else {
      el.className = 'deck-play-btn w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-full transition-all shadow-md shadow-amber-500/20 active:scale-95 flex-shrink-0 cursor-pointer';
    }
  });

  // Volume
  document.querySelectorAll('.deck-volume').forEach(el => { el.value = item.volume; });

  updateDeckProgressUI();
}

/* Иконка Play в карточках списка примеров: треугольник ⇄ две полосы и зелёный
   «живой» огонёк на обложке. Обновляем точечно, без пересборки списка: перерисовка
   на событии звука могла бы задеть идущую анимацию ленты (свайп, смена языка), а
   здесь меняются только атрибут иконки и видимость огонька. Оформление карточки
   (рамка, подсветка кнопки) зависит лишь от выбранного трека и не меняется. */
function updateTrackCardPlayUI() {
  const playing = !!activeTrackId && isAudioPlaying(activeTrackId);
  const container = document.getElementById('trackListContainer');
  if (!container) return;

  Array.from(container.children).forEach(card => {
    const isSelected = card.getAttribute('data-track-id') === activeTrackId;
    const live = isSelected && playing;

    const overlay = card.querySelector('.track-live-overlay');
    if (overlay) overlay.style.display = live ? 'flex' : 'none';

    const path = card.querySelector('.track-play-svg path');
    if (path) path.setAttribute('d', live ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z');
  });
}

/* Иконка Play/Pause (треугольник ⇄ две полосы). Клик — не единственный момент,
   когда состояние звука меняется: холодный клик сначала ждёт первую порцию
   данных, и пара стартует САМА, уже после updateMasterDeckUI (см.
   releasePairBufferGate), да и гейт буфера останавливает звук между порциями.
   Поэтому иконки доводим по событиям play/pause дорожек: если нарисованное
   состояние разошлось с настоящим — перерисовываем пульт и карточки. */
function syncPlayStateUI(trackId) {
  if (!activeTrackId || activeTrackId !== trackId) return;
  const playing = isAudioPlaying(trackId);
  if (playing === deckUiPlaying) return;   // на кнопках уже верная иконка

  updateMasterDeckUI();      // пульт: треугольник/две полосы, подсветка, полосы
  updateTrackCardPlayUI();   // карточки: иконка и зелёный огонёк
}


// ═══ 4253–4536 → js/player-audio.js (гейт буфера, сторож залипания, play/pause пары) ═══
function updateDeckProgressUI() {
  if (!activeTrackId) return;
  const item = trackAudioMap[activeTrackId];
  if (!item) return;

  // Прогресс считаем по звучащей дорожке (BEFORE → audioA, AFTER → audioB);
  // пока идёт переход, звучит ещё прежняя — это учитывает getAudiblePair.
  const { audible, silent } = getAudiblePair(item);
  const cur = audible.currentTime || 0;
  const dur = audible.duration || silent.duration || 0;
  const pct = dur > 0 ? (cur / dur) * 100 : 0;

  const progressBar = document.getElementById('deckProgressBar');
  if (progressBar) progressBar.style.width = `${pct}%`;

  // Полоса загрузки: до какого момента скачаны ОБЕ дорожки пары (до этой отметки
  // трек действительно обеспечен данными), но не меньше текущей позиции — чтобы
  // полоса не откатывалась назад при перемотке.
  const bufEnd = cur + getPairBufferedAhead(item, cur);
  const bufPct = dur > 0 ? (Math.max(cur, bufEnd) / dur) * 100 : 0;
  const bufferBar = document.getElementById('deckBufferBar');
  if (bufferBar) bufferBar.style.width = `${bufPct}%`;
}

/* Ждём, пока обложки будут готовы к отрисовке. Зачем: у карточек стоит
   loading="lazy", а панели ленты и только что перерисованный список в момент
   перехода находятся ЗА кадром — браузер откладывает их загрузку и декодирование,
   и в кадре подмены ленты мелькали бы пустые обложки («моргание» треков).
   img.decode() резолвится, когда картинка декодирована и готова к отрисовке
   (для уже закэшированной — почти мгновенно); страховка по времени нужна,
   чтобы переход не задерживался из-за медленной сети. */
const TRACK_COVERS_WAIT_MS = 240;

function whenTrackCoversReady(root, timeoutMs = TRACK_COVERS_WAIT_MS) {
  if (!root) return Promise.resolve();
  const imgs = Array.from(root.querySelectorAll('img'));
  if (!imgs.length) return Promise.resolve();

  const allReady = Promise.all(imgs.map(img => {
    // decode() заодно запускает загрузку, если она ещё не началась.
    if (typeof img.decode === 'function') return img.decode().catch(() => {});
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  }));

  return Promise.race([
    allReady,
    new Promise(resolve => setTimeout(resolve, timeoutMs))
  ]);
}

/* Готовит обложки страницы к отрисовке, не трогая разметку: создаём картинки
   «на лету» и декодируем их. Нужно перед подменой ленты — уехавшая панель
   получает СТАРУЮ страницу уже в момент подмены, и если картинки к этому
   моменту не готовы, старые треки на мгновение показываются пустыми
   (это и есть «моргание» при быстром листании). */
function predecodeTrackCovers(lang, page) {
  const tracks = (typeof getTracksForState === 'function') ? getTracksForState(lang, page) : [];
  return Promise.all(tracks.map(track => {
    const img = new Image();
    img.decoding = 'async';
    img.src = track.cover;
    if (typeof img.decode === 'function') return img.decode().catch(() => {});
    return Promise.resolve();
  }));
}

// Карточка трека. withId=false используется для peek-панелей («соседние»
// треки во время свайпа): там карточка нужна только визуально, иначе в
// документе появились бы дубли id вида track-item-<id>.
// eagerImages=true — грузить обложку сразу, не откладывая: такие карточки
// создаются за кадром (панели ленты, список во время перехода), а «ленивая»
// загрузка в этот момент откладывается, и обложка мелькала бы пустой.
// isVerticalView=true — вертикальная карточка, как на телефоне: так выглядят и
// карточки компьютера (см. isVerticalTrackCardView).
function createTrackCard(track, { isVerticalView, currentDevice, withId = true, eagerImages = false }) {
  const isSelected = activeTrackId === track.id;
  const isPlaying = isSelected && isAudioPlaying(track.id);
  const genreText = resolveI18nValue(track.genreLabel, currentLang, currentDevice);
  const trackTitle = resolveDeviceText(track.title, currentDevice);
  const trackArtist = resolveDeviceText(track.artist, currentDevice);

  const itemCard = document.createElement('div');
  if (withId) {
    itemCard.id = `track-item-${track.id}`;
    // Тап разбираем сами (bindTapControl): после свайпа ленты Android-браузер
    // может не прислать click, и первый тап по карточке пропадал бы. Кнопку
    // play внутри пропускаем — у неё своё действие (см. opts.ignore).
    bindTapControl(itemCard, () => toggleTrack(track.id), { ignore: '.track-play-btn' });
  }
  itemCard.setAttribute('data-track-id', track.id);
  // Подпись вида: структура карточки у видов разная, и renderTrackList по этой
  // подписи понимает, можно ли переиспользовать готовый DOM (см. canReuseDOM).
  itemCard.setAttribute('data-view', isVerticalView ? 'vertical' : 'row');
  itemCard.className = (isVerticalView
    ? `p-3 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col gap-3 group ${
        isSelected
          ? 'bg-[#1A1F2B] border-amber-500/60 shadow-lg shadow-amber-500/10'
          : 'bg-[#0B0E15] border-gray-800/80 hover:border-amber-500/40 hover:bg-[#0F131E]'
      }`
    : `p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between gap-3.5 group ${
        isSelected
          ? 'bg-[#1A1F2B] border-amber-500/60 shadow-lg shadow-amber-500/10'
          : 'bg-[#0B0E15] border-gray-800/80 hover:border-amber-500/40 hover:bg-[#0F131E]'
      }`
  );

  const trackCoverBox = document.createElement('div');
  trackCoverBox.className = (isVerticalView
    ? `track-cover-box relative w-full aspect-square rounded-xl overflow-hidden flex-shrink-0 border transition-colors duration-300 ${isSelected ? 'border-amber-500' : 'border-gray-800'}`
    : `track-cover-box relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden flex-shrink-0 border transition-colors duration-300 ${isSelected ? 'border-amber-500' : 'border-gray-800'}`
  );

  const coverImg = document.createElement('img');
  coverImg.src = track.cover;
  coverImg.alt = trackTitle;
  coverImg.loading = eagerImages ? 'eager' : 'lazy';
  coverImg.decoding = 'async';
  coverImg.className = 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-300';
  // Если обложки нет/не загрузилась — подставляем единую заглушку «нет обложки».
  coverImg.onerror = () => { coverImg.onerror = null; coverImg.src = './image/!image_none.jpg'; };
  trackCoverBox.appendChild(coverImg);

  const liveOverlay = document.createElement('div');
  liveOverlay.className = 'track-live-overlay absolute inset-0 items-center justify-center';
  liveOverlay.style.display = isPlaying ? 'flex' : 'none';
  const liveLed = document.createElement('span');
  liveLed.className = 'w-2.5 h-2.5 rounded-full vu-led-green animate-ping';
  liveOverlay.appendChild(liveLed);
  trackCoverBox.appendChild(liveOverlay);

  const meta = document.createElement('div');
  const titleEl = document.createElement('h4');
  titleEl.className = (isVerticalView
    ? 'track-card-title text-sm font-extrabold text-white truncate group-hover:text-amber-400 transition-colors'
    : 'track-card-title text-sm sm:text-base font-extrabold text-white truncate group-hover:text-amber-400 transition-colors'
  );
  titleEl.textContent = trackTitle;
  const artistEl = document.createElement('p');
  artistEl.className = (isVerticalView
    ? 'track-card-artist text-xs text-gray-400 truncate mt-0.5'
    : 'track-card-artist text-xs sm:text-sm text-gray-400 truncate mt-0.5'
  );
  artistEl.textContent = trackArtist;
  meta.appendChild(titleEl);
  meta.appendChild(artistEl);

  const genreSpan = document.createElement('span');
  genreSpan.className = (isVerticalView
    // Жанр по центру и чуть крупнее, чтобы проще было заметить жанр трека.
    ? `track-genre-badge self-center text-[11px] font-bold px-3 py-1 rounded-full transition-colors duration-300 ${isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-gray-800 text-amber-400'}`
    : `track-genre-badge text-xs font-extrabold px-3.5 py-1.5 rounded-full transition-colors duration-300 ${isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-gray-800 text-amber-400'}`
  );
  genreSpan.textContent = genreText;

  if (isVerticalView) {
    // ── ВЕРТИКАЛЬНЫЙ ВИД (телефон и компьютер): прямоугольник ─────────
    // Квадратное фото на всю ширину карточки, по центру фото кнопка
    // play/pause «треугольником» без фона, ниже название + артист,
    // ниже жанр.

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    if (withId) bindTapControl(playBtn, () => toggleTrack(track.id));
    // Кнопка-контейнер крупнее (64px) — сам треугольник внутри теперь 48px,
    // плюс плотная тень: на светлых обложках его стало хорошо видно.
    playBtn.className = `track-play-btn absolute inset-0 z-10 m-auto w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 cursor-pointer ${
      isSelected
        ? 'text-amber-400 hover:text-amber-300'
        : 'text-white hover:text-amber-400'
    } active:scale-95`;
    playBtn.innerHTML = `<svg class="track-play-svg w-12 h-12 fill-current drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)] pointer-events-none mx-auto" viewBox="0 0 24 24"><path d="${isPlaying ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/></svg>`;
    trackCoverBox.appendChild(playBtn);

    meta.className = 'min-w-0 flex-1 flex-col';

    itemCard.appendChild(trackCoverBox);
    itemCard.appendChild(meta);
    itemCard.appendChild(genreSpan);
  } else {
    // ── ПЛАНШЕТ: горизонтальный вид (список идёт в одну колонку) ──────
    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    if (withId) bindTapControl(playBtn, () => toggleTrack(track.id));
    playBtn.className = `track-play-btn p-2.5 sm:p-3 rounded-xl transition-all cursor-pointer ${
      isSelected
        ? 'bg-amber-500 text-slate-950 font-black shadow-md'
        : 'bg-gray-900 text-gray-300 hover:bg-amber-500 hover:text-slate-950'
    }`;
    playBtn.innerHTML = `<svg class="track-play-svg w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="${isPlaying ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/></svg>`;

    const leftRow = document.createElement('div');
    leftRow.className = 'flex items-center gap-4 min-w-0 flex-1';
    leftRow.appendChild(trackCoverBox);
    meta.className = 'min-w-0 flex-1';
    leftRow.appendChild(meta);

    const rightRow = document.createElement('div');
    rightRow.className = 'flex items-center gap-2.5 flex-shrink-0';
    rightRow.appendChild(genreSpan);
    rightRow.appendChild(playBtn);

    itemCard.appendChild(leftRow);
    itemCard.appendChild(rightRow);
  }

  return itemCard;
}

function renderTrackList(animate = false) {
  const container = document.getElementById('trackListContainer');
  if (!container) return;

  // При свайп-переходе въездом карточек управляет свайп-лента (см. initPlayer).
  if (suppressCardEnterAnimation) animate = false;

  const currentDevice = getDeviceType();
  // Вертикальные карточки (как на телефоне) — на телефоне и на компьютере
  // (см. isVerticalTrackCardView); на планшете карточка-строка. Структура
  // карточки зависит от вида, поэтому при смене вида DOM всегда пересоздаётся
  // (см. canReuseDOM ниже).
  const isVerticalView = isVerticalTrackCardView();
  const currentView = isVerticalView ? 'vertical' : 'row';
  const perPage = getTracksPerPage();
  // Жанровые фильтры убраны: показываем все треки текущего языка (RU/EN).
  const tracks = getEnabledTracks();
  const totalItems = tracks.length;
  const maxPages = Math.ceil(totalItems / perPage) || 1;

  if (currentTrackPage >= maxPages) {
    currentTrackPage = Math.max(0, maxPages - 1);
  }

  // Пагинация нужна, только если карточек больше одной страницы:
  // при 4 колонках и 4 треках весь список влезает в один ряд.
  const paginationWrap = document.getElementById('trackPagination');
  if (paginationWrap) {
    const shouldShowPagination = maxPages > 1;
    const isPaginationShown = paginationWrap.style.display !== 'none';
    if (shouldShowPagination !== isPaginationShown) {
      paginationWrap.style.display = shouldShowPagination ? '' : 'none';
      scheduleScrollTriggerRefresh(0);
    }
  }

  const startIdx = currentTrackPage * perPage;
  const visibleTracks = tracks.slice(startIdx, startIdx + perPage);

  const existingCards = Array.from(container.children);
  const existingIds = existingCards.map(c => c.getAttribute('data-track-id'));
  const targetIds = visibleTracks.map(t => t.id);

  const canReuseDOM = existingIds.length === targetIds.length &&
    existingIds.every((id, idx) => id === targetIds[idx]) &&
    // Вид (вертикальные карточки ⇄ карточки-строки) влияет на СТРУКТУРУ
    // карточки, поэтому при смене вида DOM обязательно пересоздаём, даже если
    // состав треков совпадает.
    existingIds.length > 0 && existingCards[0].getAttribute('data-view') === currentView;

  if (canReuseDOM) {
    visibleTracks.forEach(track => {
      const isSelected = activeTrackId === track.id;
      const isPlaying = isSelected && isAudioPlaying(track.id);
      const genreText = resolveI18nValue(track.genreLabel, currentLang, currentDevice);
      const trackTitle = resolveDeviceText(track.title, currentDevice);
      const trackArtist = resolveDeviceText(track.artist, currentDevice);

      const itemCard = document.getElementById(`track-item-${track.id}`);
      if (!itemCard) return;

      itemCard.className = (isVerticalView
        ? `p-3 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col gap-3 group ${
            isSelected 
              ? 'bg-[#1A1F2B] border-amber-500/60 shadow-lg shadow-amber-500/10' 
              : 'bg-[#0B0E15] border-gray-800/80 hover:border-amber-500/40 hover:bg-[#0F131E]'
          }`
        : `p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between gap-3.5 group ${
            isSelected 
              ? 'bg-[#1A1F2B] border-amber-500/60 shadow-lg shadow-amber-500/10' 
              : 'bg-[#0B0E15] border-gray-800/80 hover:border-amber-500/40 hover:bg-[#0F131E]'
          }`
      );

      const coverBox = itemCard.querySelector('.track-cover-box');
      if (coverBox) {
        coverBox.className = (isVerticalView
          ? `track-cover-box relative w-full aspect-square rounded-xl overflow-hidden flex-shrink-0 border transition-colors duration-300 ${isSelected ? 'border-amber-500' : 'border-gray-800'}`
          : `track-cover-box relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden flex-shrink-0 border transition-colors duration-300 ${isSelected ? 'border-amber-500' : 'border-gray-800'}`
        );
      }

      const liveOverlay = itemCard.querySelector('.track-live-overlay');
      if (liveOverlay) {
        liveOverlay.style.display = isPlaying ? 'flex' : 'none';
      }

      const titleEl = itemCard.querySelector('.track-card-title');
      if (titleEl) titleEl.textContent = trackTitle;

      const artistEl = itemCard.querySelector('.track-card-artist');
      if (artistEl) artistEl.textContent = trackArtist;

      const genreBadge = itemCard.querySelector('.track-genre-badge');
      if (genreBadge) {
        genreBadge.textContent = genreText;
        genreBadge.className = (isVerticalView
          // Жанр по центру и чуть крупнее, чтобы проще было заметить жанр трека.
          ? `track-genre-badge self-center text-[11px] font-bold px-3 py-1 rounded-full transition-colors duration-300 ${isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-gray-800 text-amber-400'}`
          : `track-genre-badge text-xs font-extrabold px-3.5 py-1.5 rounded-full transition-colors duration-300 ${isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-gray-800 text-amber-400'}`
        );
      }

      const playBtn = itemCard.querySelector('.track-play-btn');
      if (playBtn) {
        playBtn.className = (isVerticalView
          // Кнопка-контейнер крупнее (64px) — сам треугольник внутри теперь 48px,
          // его хорошо видно на большом квадратном фото.
          ? `track-play-btn absolute inset-0 z-10 m-auto w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110 cursor-pointer ${
              isSelected
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-white hover:text-amber-400'
            } active:scale-95`
          : `track-play-btn p-2.5 sm:p-3 rounded-xl transition-all cursor-pointer ${
              isSelected 
                ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
                : 'bg-gray-900 text-gray-300 hover:bg-amber-500 hover:text-slate-950'
            }`
        );
      }

      const playSvgPath = itemCard.querySelector('.track-play-svg path');
      if (playSvgPath) {
        playSvgPath.setAttribute('d', isPlaying ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z');
      }
    });

    if (animate && typeof gsap !== 'undefined' && container.children.length > 0) {
      gsap.killTweensOf(container.children);
      gsap.fromTo(
        container.children,
        { opacity: 0, y: 26 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.07,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
          onComplete: () => {
            if (typeof initPlayerTrackCardsTimeline === 'function') {
              initPlayerTrackCardsTimeline(false, true);
            }
          }
        }
      );
    }
  } else {
    container.innerHTML = '';

    if (visibleTracks.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'col-span-full py-12 text-center text-gray-500 text-xs sm:text-sm font-medium';
      emptyDiv.textContent = currentLang === 'ru' ? 'Пока нет доступных треков' : 'No tracks available yet';
      container.appendChild(emptyDiv);
    }

    visibleTracks.forEach(track => {
      // Во время свайп-перехода список перерисовывается за кадром — грузим
      // обложки сразу, иначе «ленивая» загрузка отложилась бы до подмены ленты.
      container.appendChild(createTrackCard(track, { isVerticalView, currentDevice, withId: true, eagerImages: suppressCardEnterAnimation }));
    });

    if (animate && typeof gsap !== 'undefined' && container.children.length > 0) {
      gsap.killTweensOf(container.children);
      gsap.fromTo(
        container.children,
        { opacity: 0, y: 26 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.07,
          ease: 'power2.out',
          clearProps: 'transform,opacity',
          onComplete: () => {
            if (typeof initPlayerTrackCardsTimeline === 'function') {
              initPlayerTrackCardsTimeline(false, true);
            }
          }
        }
      );
    }
  }

  // Controls UI
  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');
  const pageInfo = document.getElementById('carouselPageInfo');
  const dotsContainer = document.getElementById('carouselDots');

  if (btnPrev) btnPrev.disabled = currentTrackPage === 0;
  if (btnNext) btnNext.disabled = currentTrackPage >= maxPages - 1;

  if (pageInfo) {
    if (totalItems === 0) {
      pageInfo.textContent = '0 / 0';
    } else {
      const endIdx = Math.min(startIdx + perPage, totalItems);
      pageInfo.textContent = perPage === 1 
        ? `${startIdx + 1} / ${totalItems}` 
        : `${startIdx + 1}-${endIdx} / ${totalItems}`;
    }
  }

  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    for (let i = 0; i < maxPages; i++) {
      const dot = document.createElement('button');
      dot.className = `h-1.5 rounded-full transition-all duration-300 cursor-pointer ${i === currentTrackPage ? 'bg-amber-500 w-5 shadow-sm shadow-amber-500/50' : 'bg-gray-700 hover:bg-gray-500 w-1.5'}`;
      // Тап разбираем сами — как у точек-индикатора и кнопок языка
      // (см. bindTapControl): после свайпа браузер может не прислать click.
      bindTapControl(dot, () => {
        currentTrackPage = i;
        renderTrackList(true);
      });
      dotsContainer.appendChild(dot);
    }
  }

  if (!animate && typeof initPlayerTrackCardsTimeline === 'function') {
    initPlayerTrackCardsTimeline(false);
  }

  // Точки-индикатор листания и стрелки на телефоне. Пока лента едет, активная
  // точка — цель перехода, а не ещё старое состояние списка (см. runTrackTransition).
  if (trackTransitionTarget) renderTrackDots(trackTransitionTarget.lang, trackTransitionTarget.page);
  else renderTrackDots();
  if (typeof syncTrackNav === 'function') syncTrackNav();
}


// ═══ 4982–9720 → js/services.js, faq.js, reviews.js, modals.js, about.js,
//     calculator.js, mobile-menu.js, scroll.js, toast.js, gsap-reveal.js ═══
