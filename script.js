// State variables
let currentLang = 'en';
let activeTrackLang = 'en';
let activeTrackId = null;
let currentTrackPage = 0;
// Во время свайп-перехода лентой треков управляет свайп-режим
// (enterSwipeMode/settleSwipe/exitSwipeMode), поэтому штатная «вкатка снизу»
// в renderTrackList() на этот момент подавляется, чтобы не было двух анимаций.
let suppressCardEnterAnimation = false;

// Audio engine data
const trackAudioMap = {}; // { trackId: { audioA, audioB, source: 'before'|'after', volume: 0.9 } }
// Штамп для отладочного обхода кэша аудио (см. audioUrl): один на всю сессию
// страницы, чтобы адреса внутри одного захода не расходились.
let audioCacheStampValue = '';

/* ScrollTrigger.refresh() — это полный пересчёт позиций всех триггеров, то есть
   принудительная переклейка раскладки всей страницы. На старте он вызывался
   несколько раз подряд (load, готовность шрифтов, отрисовка карточек услуг и
   треков, показ нижнего плеера), и на телефоне это давало заметные «залипания»
   в первые секунды. Здесь вызовы схлопываются в один: если пересчёт уже
   запланирован, повторный запрос просто игнорируется. */
let scrollTriggerRefreshTimer = 0;
function scheduleScrollTriggerRefresh(delay) {
  if (typeof ScrollTrigger === 'undefined') return;
  if (scrollTriggerRefreshTimer) return;
  scrollTriggerRefreshTimer = setTimeout(() => {
    scrollTriggerRefreshTimer = 0;
    if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
  }, delay || 0);
}

document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  initPlayer();
  initServices();
  initFaq();
  initReviews();
  initModalAndToast();
  initMobileMenuScrollLock();
  initGsapAnimations();
  initMixerFaderScroll();
  initSmoothAnchorNavigation();
  initScrollSpy();
  initScrollToTop();
});

window.addEventListener('load', () => {
  scheduleScrollTriggerRefresh(0);
});

// Ensure ScrollTrigger recalibrates when web fonts finish downloading
if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    scheduleScrollTriggerRefresh(120);
  });
}

// --- АВТООПРЕДЕЛЕНИЕ ЯЗЫКА ПО РЕГИОНУ ---
// Русская версия показывается России и СНГ: Беларусь, Казахстан, Кыргызстан,
// Узбекистан, Таджикистан, Туркменистан, Армения, Азербайджан, Молдова, а также
// Украина (там русский понимает большинство посетителей). Остальной мир получает
// английскую версию. Ручной выбор кнопкой RU/EN запоминается в localStorage и
// всегда приоритетнее любого автоопределения.

// Языки, носители которых ожидают русскоязычный сайт. 'mo' — устаревший код
// молдавского, далее — языки народов РФ (локаль обычно вида tt-RU, os-RU и т.п.).
const RU_SPHERE_LANGS = [
  'ru', 'be', 'uk', 'kk', 'ky', 'uz', 'tg', 'tk', 'hy', 'az', 'mo',
  'ab', 'av', 'ba', 'ce', 'cv', 'os', 'tt', 'udm', 'sah'
];

// Страны СНГ и постсоветского пространства (ISO 3166-1 alpha-2)
const RU_SPHERE_COUNTRIES = [
  'RU', 'BY', 'KZ', 'KG', 'UZ', 'TJ', 'TM', 'AM', 'AZ', 'MD', 'UA'
];

// Города в названиях таймзон: надёжный признак региона, когда браузер сообщает
// только английскую локаль (например, en-US у человека, живущего в России).
const RU_SPHERE_TIMEZONES = [
  'moscow', 'kirov', 'volgograd', 'astrakhan', 'ulyanovsk', 'saratov', 'samara',
  'kaliningrad', 'simferopol', 'zaporozhye', 'minsk', 'kyiv', 'kiev', 'chisinau',
  'tiraspol', 'yekaterinburg', 'omsk', 'novosibirsk', 'barnaul', 'tomsk',
  'novokuznetsk', 'krasnoyarsk', 'irkutsk', 'chita', 'yakutsk', 'khandyga',
  'vladivostok', 'ust-nera', 'magadan', 'sakhalin', 'srednekolymsk', 'kamchatka',
  'anadyr', 'almaty', 'qostanay', 'aqtobe', 'aqtau', 'atyrau', 'oral',
  'qyzylorda', 'bishkek', 'tashkent', 'samarkand', 'dushanbe', 'ashgabat',
  'yerevan', 'baku'
];

// Код страны из локали браузера: 'ru-RU' → 'RU', 'en-BY' → 'BY', 'uk_UA' → 'UA'
function getLocaleRegion(locale) {
  const parts = String(locale || '').replace(/_/g, '-').split('-');
  for (let i = 1; i < parts.length; i++) {
    if (/^[a-zA-Z]{2}$/.test(parts[i])) return parts[i].toUpperCase();
  }
  return '';
}

function detectUserLanguage() {
  // 1. Ручной выбор пользователя — приоритетнее любых догадок
  try {
    const saved = localStorage.getItem('nick_rise_lang');
    if (saved === 'ru' || saved === 'en') return saved;
  } catch (e) {}

  // 2. Языки браузера: проверяем и код языка, и код страны
  try {
    const navLangs = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || navigator.userLanguage || ''];

    for (let i = 0; i < navLangs.length; i++) {
      const raw = String(navLangs[i] || '').trim();
      if (!raw) continue;

      const base = raw.replace(/_/g, '-').split('-')[0].toLowerCase();
      if (RU_SPHERE_LANGS.indexOf(base) !== -1) return 'ru';

      const region = getLocaleRegion(raw);
      if (region && RU_SPHERE_COUNTRIES.indexOf(region) !== -1) return 'ru';
    }
  } catch (e) {}

  // 3. Часовой пояс — сработает, когда локаль английская, а человек в СНГ
  try {
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    if (tz && RU_SPHERE_TIMEZONES.some(city => tz.indexOf(city) !== -1)) return 'ru';
  } catch (e) {}

  // 4. Все остальные регионы — английская версия
  return 'en';
}

// --- DEVICE DETECTION & MULTI-SCREEN TEXT RESOLUTION ---
function getDeviceType() {
  const w = window.innerWidth;
  if (w < 768) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

function resolveDeviceText(val, device = getDeviceType()) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);

  if (typeof val === 'object') {
    // If it's an object with device keys: { desktop: "...", tablet: "...", mobile: "..." }
    if ('mobile' in val || 'tablet' in val || 'desktop' in val) {
      if (device === 'mobile') {
        return val.mobile !== undefined ? val.mobile : (val.tablet !== undefined ? val.tablet : val.desktop || '');
      }
      if (device === 'tablet') {
        return val.tablet !== undefined ? val.tablet : (val.desktop !== undefined ? val.desktop : val.mobile || '');
      }
      return val.desktop !== undefined ? val.desktop : (val.tablet !== undefined ? val.tablet : val.mobile || '');
    }
  }
  return val;
}

function resolveI18nValue(obj, lang = currentLang, device = getDeviceType()) {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;

  if (obj[lang] !== undefined) {
    return resolveDeviceText(obj[lang], device);
  }

  if ('desktop' in obj || 'tablet' in obj || 'mobile' in obj) {
    const devVal = resolveDeviceText(obj, device);
    if (typeof devVal === 'object' && devVal[lang] !== undefined) {
      return devVal[lang];
    }
    return typeof devVal === 'string' ? devVal : '';
  }

  const fallback = obj.ru !== undefined ? obj.ru : (obj.en !== undefined ? obj.en : Object.values(obj)[0]);
  return resolveDeviceText(fallback, device);
}

// --- I18N SYSTEM ---
let lastDetectedDevice = getDeviceType();

function initI18n() {
  const langToggle = document.getElementById('langToggleContainer');
  if (langToggle) {
    langToggle.addEventListener('click', (e) => {
      e.preventDefault();
      toggleLanguage();
    });
    langToggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleLanguage();
      }
    });
  }

  window.addEventListener('resize', () => {
    const currentDevice = getDeviceType();
    if (currentDevice !== lastDetectedDevice) {
      lastDetectedDevice = currentDevice;
      renderI18nText();
      renderServices();
      renderFaq();
      renderReviews();
      updateMasterDeckUI();
      renderTrackList(false);
    }
  }, { passive: true });

  const initialLang = detectUserLanguage();
  setLanguage(initialLang, false);
}

let isSwitchingLanguage = false;

function getI18nValue(lang, keyPath, device) {
  const t = CONFIG.i18n && CONFIG.i18n[lang];
  if (!t) return null;
  const parts = keyPath.split('.');
  let val = t;
  for (let i = 0; i < parts.length; i++) {
    if (val === undefined || val === null) return null;
    val = val[parts[i]];
  }
  return resolveDeviceText(val, device);
}

function getI18nAnimatedElements() {
  const elements = [];
  const currentDevice = getDeviceType();

  // 1. All [data-i18n] elements (excluding language switch container & strings that don't differ)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    if (el.closest('#langToggleContainer')) return;
    const keyPath = el.getAttribute('data-i18n');
    if (keyPath) {
      const ruVal = getI18nValue('ru', keyPath, currentDevice);
      const enVal = getI18nValue('en', keyPath, currentDevice);
      // If the translated string is identical in both languages, skip animating to keep UI rock-solid
      if (ruVal && enVal && ruVal === enVal) return;
    }
    elements.push(el);
  });

  // 2. Services section dynamic texts: badge, title, desc, bullet list, price prefix, button text
  document.querySelectorAll(
    '#servicesContainer .popular-badge, ' +
    '#servicesContainer .service-card-title, ' +
    '#servicesContainer .service-card-desc, ' +
    '#servicesContainer .service-card-features, ' +
    '#servicesContainer .service-card-from, ' +
    '#servicesContainer .service-card-order-btn span'
  ).forEach(el => {
    if (!elements.includes(el)) elements.push(el);
  });

  // 3. Dynamic FAQ texts (only target the question text container, not plus icons or entire buttons)
  document.querySelectorAll(
    '#faqContainer .faq-q-text, ' +
    '#faqContainer .faq-content-wrapper p'
  ).forEach(el => {
    if (!elements.includes(el)) elements.push(el);
  });

  // 4. Reviews (#reviews): текст и имя меняются мгновенно — карточки живут
  //    в бегущих лентах и их в разы больше, чем остальных текстов на странице.

  // Filter out any elements whose ancestor is already in the list to avoid nested blurs
  return elements.filter(el => {
    let parent = el.parentElement;
    while (parent) {
      if (elements.includes(parent)) return false;
      parent = parent.parentElement;
    }
    return true;
  });
}

function toggleLanguage() {
  if (isSwitchingLanguage) return;
  const nextLang = currentLang === 'ru' ? 'en' : 'ru';
  setLanguage(nextLang, true, true);
}

function setLanguage(lang, savePreference = true, animate = false) {
  if (lang !== 'ru' && lang !== 'en') lang = 'en';

  if (savePreference) {
    try {
      localStorage.setItem('nick_rise_lang', lang);
    } catch (e) {}
  }

  const langToggle = document.getElementById('langToggleContainer');
  if (langToggle) {
    langToggle.setAttribute('data-lang', lang);
  }

  if (!animate) {
    currentLang = lang;
    try {
      document.documentElement.lang = lang;
      document.documentElement.setAttribute('data-lang', lang);
    } catch (e) {}
    renderI18nText();
    renderServices();
    renderFaq();
    renderReviews();
    updateMasterDeckUI();
    renderTrackList(false);
    return;
  }

  isSwitchingLanguage = true;
  const oldEls = getI18nAnimatedElements();
  oldEls.forEach(el => {
    el.classList.remove('lang-vapor-in');
    el.classList.add('lang-vapor-out');
  });

  setTimeout(() => {
    currentLang = lang;
    try {
      document.documentElement.lang = lang;
      document.documentElement.setAttribute('data-lang', lang);
    } catch (e) {}

    renderI18nText();
    renderServices();
    renderFaq();
    renderReviews();
    updateMasterDeckUI();
    renderTrackList(false);

    const newEls = getI18nAnimatedElements();
    oldEls.forEach(el => el.classList.remove('lang-vapor-out'));
    newEls.forEach(el => {
      el.classList.remove('lang-vapor-out');
      void el.offsetWidth;
      el.classList.add('lang-vapor-in');
    });

    setTimeout(() => {
      newEls.forEach(el => el.classList.remove('lang-vapor-in'));
      document.querySelectorAll('.nr-faq-lang-switched').forEach(c => {
        c.classList.remove('nr-faq-lang-switched');
      });
      isSwitchingLanguage = false;
    }, 480);
  }, 320);
}

function renderI18nText() {
  const t = CONFIG.i18n[currentLang];
  if (!t) return;
  const currentDevice = getDeviceType();
  
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const keyPath = el.getAttribute('data-i18n');
    const parts = keyPath.split('.');
    let val = t;
    parts.forEach(p => {
      if (val !== undefined && val !== null) val = val[p];
    });

    const finalVal = resolveDeviceText(val, currentDevice);
    if (finalVal !== undefined && finalVal !== null && typeof finalVal === 'string') {
      if (el.hasAttribute('data-i18n-html') || finalVal.includes('<')) {
        el.innerHTML = finalVal;
      } else {
        el.textContent = finalVal;
      }
    }
  });

  // Тултипы и aria-label (локализация атрибутов): data-i18n-title / data-i18n-aria-label
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const v = getI18nValue(currentLang, el.getAttribute('data-i18n-title'), currentDevice);
    if (typeof v === 'string' && v) el.setAttribute('title', v);
  });

  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const v = getI18nValue(currentLang, el.getAttribute('data-i18n-aria-label'), currentDevice);
    if (typeof v === 'string' && v) el.setAttribute('aria-label', v);
  });

  // Заголовок вкладки и meta description — по текущему языку
  updateDocumentMeta();

  // Окно-калькулятор стоимости услуг: пересчёт шкалы, подписей опций и итоговой цены
  renderPriceCalcStep();

  // Do not call animateHeroTitle on language toggle to prevent visual jitter/layout shift
}

// Заголовок вкладки (<title>) и meta description — динамические по языку.
// og:* / twitter:* остаются статичными: скрейперы Telegram/VK/WhatsApp не выполняют JS.
function updateDocumentMeta() {
  const t = CONFIG.i18n && CONFIG.i18n[currentLang];
  if (!t || !t.meta) return;
  if (t.meta.title) document.title = t.meta.title;
  const md = document.querySelector('meta[name="description"]');
  if (md && t.meta.description) md.setAttribute('content', t.meta.description);
}

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

function updateTrackLangButtonsUI() {
  const ruBtn = document.getElementById('trackLangRuBtn');
  const enBtn = document.getElementById('trackLangEnBtn');
  const baseClasses = 'track-lang-btn py-2 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap flex-shrink-0';
  const activeClasses = `${baseClasses} is-active bg-amber-500 text-slate-950 border border-amber-500 shadow-md shadow-amber-500/20`;
  const inactiveClasses = `${baseClasses} bg-[#090C12] border border-gray-800/80 text-gray-400 hover:text-white`;

  if (ruBtn) {
    ruBtn.className = activeTrackLang === 'ru' ? activeClasses : inactiveClasses;
    const dot = ruBtn.querySelector('.track-lang-dot');
    if (dot) dot.className = `track-lang-dot w-2 h-2 rounded-full flex-shrink-0 ${activeTrackLang === 'ru' ? 'bg-slate-950' : 'bg-transparent'}`;
  }
  if (enBtn) {
    enBtn.className = activeTrackLang === 'en' ? activeClasses : inactiveClasses;
    const dot = enBtn.querySelector('.track-lang-dot');
    if (dot) dot.className = `track-lang-dot w-2 h-2 rounded-full flex-shrink-0 ${activeTrackLang === 'en' ? 'bg-slate-950' : 'bg-transparent'}`;
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

function getCurrentTrackStepIndex() {
  return getTrackSteps().findIndex(s => s.lang === activeTrackLang && s.page === currentTrackPage);
}

function goToTrackStep(index) {
  const target = getTrackSteps()[index];
  if (!target) return;
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

function renderTrackDots() {
  const wrap = document.getElementById('trackDots');
  if (!wrap) return;

  const steps = getTrackSteps();
  const activeIdx = getCurrentTrackStepIndex();
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
      dot.onclick = () => goToTrackStep(idx);
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

/* ══ ЛЕНИВОЕ СОЗДАНИЕ ДОРОЖЕК ПЛЕЕРА ═══════════════════════════════════════
   Раньше при загрузке страницы сразу создавались 16 элементов <audio>
   (8 треков × BEFORE/AFTER) с preload='metadata' — браузер тут же открывал
   16 запросов к mp3, в том числе к трекам языка, которого сейчас нет на
   экране. Теперь пара дорожек создаётся при первом реальном интересе к треку:
   наведение/касание карточки, фокус с клавиатуры, выбор трека или старт
   воспроизведения. Логика и вид плеера не меняются. */

function getTrackConfigById(trackId) {
  if (!trackId || !CONFIG || !CONFIG.tracks) return null;
  return CONFIG.tracks.find(tr => tr.id === trackId) || null;
}

/* id треков, чьи файлы не загрузились (404, битый mp3): их больше не качаем,
   пока пользователь не кликнет по треку ещё раз (см. ensureTrackLoaded). */
const audioFailedTrackIds = [];

/* Текст сообщения о том, что файл трека не удалось загрузить, — на текущем
   языке страницы (ключ player.audioError в config.js есть и в ru, и в en). */
function getAudioErrorText() {
  const t = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.i18n) ? CONFIG.i18n[currentLang] : null;
  return (t && t.player && t.player.audioError) ? t.player.audioError : '';
}

/* В паре уже есть данные — метаданные или первые байты: значит запрос живой. */
function hasAnyAudioData(item) {
  return [item.audioA, item.audioB].some(el => el && (el.readyState >= 1 || el.buffered.length > 0));
}

/* Клик — приоритет №1: пара обязана начать получать байты. Если за отведённое
   время не пришло НИ ОДНОГО байта (запрос завис в очереди соединений браузера),
   выбор ресурса перезапускается — но только у ПОЛНОСТЬЮ пустых дорожек, чтобы не
   потерять уже скачанное у соседней. В порционном режиме это не нужно: свой
   запрос повторяет сам streamKick, а load() сбросил бы скачанное. */
const AUDIO_FETCH_RETRY_MS = 2000;

function retryStalledPairFetch(item) {
  if (!item) return;
  if (audioChunkSupported()) return;
  const { audible } = getAudiblePair(item);
  setTimeout(() => {
    if (!item.wantPlay) return;
    if (audible.readyState >= 2 || audible.buffered.length > 0) return;
    if ((audible.currentTime || 0) > 0) return;
    const stuck = [item.audioA, item.audioB].filter(el => el.readyState < 1 && el.buffered.length === 0);
    if (!stuck.length) return;
    item.warmStarted = false;
    setPairPreload(item, 'auto');
    stuck.forEach(el => el.load());
  }, AUDIO_FETCH_RETRY_MS);
}

/* ══ ОТЛАДОЧНЫЙ ОБХОД КЭША АУДИО ═══════════════════════════════════════════
   Выключатель: CONFIG.AUDIO_CACHE_BUST в config.js. Пока флаг true, к URL
   каждого mp3 добавляется уникальный параметр — браузер считает файл новым и
   качает его заново при каждом открытии страницы (проверка «как новый
   человек»). После проверки флаг ставится в false, и поведение возвращается к
   обычному кэшированию.

   Важно: параметр добавляется РОВНО ОДИН РАЗ, при создании элемента <audio>.
   Если подставлять его в момент загрузки (load()), тогда каждое прерывание
   фонового прогрева обнуляло бы уже скачанное, и обход кэша ломал бы логику
   возобновления. Здесь URL фиксируется на всю сессию элемента. */

function audioUrl(src) {
  if (!src) return src;
  if (!CONFIG || !CONFIG.AUDIO_CACHE_BUST) return src;
  const sep = src.indexOf('?') < 0 ? '?' : '&';
  // Один и тот же штамп на все дорожки страницы: адреса уникальны для браузера,
  // но внутри одного захода не меняются — иначе элементы одного трека
  // разошлись бы по разным URL.
  return src + sep + 'nrcb=' + getAudioCacheStamp();
}

function getAudioCacheStamp() {
  if (!audioCacheStampValue) {
    audioCacheStampValue = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
  }
  return audioCacheStampValue;
}

function createTrackAudioEntry(track) {
  if (!track || !track.id || !track.audioBefore || !track.audioAfter) return null;
  if (trackAudioMap[track.id]) return trackAudioMap[track.id];

  const urlA = audioUrl(track.audioBefore);
  const urlB = audioUrl(track.audioAfter);
  const chunked = audioChunkSupported();

  const audioA = new Audio();
  const audioB = new Audio();
  if (chunked) {
    audioA.preload = 'none';
    audioB.preload = 'none';
    audioA.setAttribute('data-nr-src', urlA);
    audioB.setAttribute('data-nr-src', urlB);
  } else {
    audioA.preload = 'metadata';
    audioB.preload = 'metadata';
    audioA.src = urlA;
    audioB.src = urlB;
  }

  /* Ошибка загрузки файла трека: пара останавливается, трек помечается
     недоступным, пользователь видит честное сообщение. Повтор — только по его
     клику (см. ensureTrackLoaded). Подмены на другой файл нет. */
  const handleAudioError = el => {
    el.addEventListener('error', () => {
      const item = trackAudioMap[track.id];
      if (audioFailedTrackIds.indexOf(track.id) < 0) audioFailedTrackIds.push(track.id);
      if (item) {
        item.warmStarted = false;
        pausePairAudio(track.id);
      }
      if (activeTrackId === track.id) {
        warmReleaseHold();
        updateMasterDeckUI();
        renderTrackList(false);
        showToast(getAudioErrorText());
      }
    });
  };
  handleAudioError(audioA);
  handleAudioError(audioB);

  const trackIndex = CONFIG && CONFIG.tracks ? CONFIG.tracks.indexOf(track) + 1 : 1;
  trackAudioMap[track.id] = {
    audioA,
    audioB,
    source: 'after',
    volume: 0.9,
    // Трек слушают (не пауза): нужно, чтобы после буферизации продолжить самим.
    wantPlay: false,
    bufferGate: false,
    trackIndex: trackIndex > 0 ? trackIndex : 1
  };

  /* Порционный режим: дорожки привязываются к своему потоку данных. */
  if (chunked) {
    streamBindElement(audioA, urlA);
    streamBindElement(audioB, urlB);
  }

  // Никаких жёстких seek внутри воспроизведения: расхождение пары гасится
  // микро-коррекцией скорости той дорожки, которая сейчас не звучит.
  // timeupdate прилетает от ДВУХ дорожек (BEFORE и AFTER) примерно 4 раза в
  // секунду каждая — складываем их в один пересчёт на кадр, чтобы не трогать
  // интерфейс лишний раз (важно для батареи на телефоне).
  let timeUpdatePending = false;
  const handleTimeUpdate = () => {
    if (activeTrackId !== track.id || timeUpdatePending) return;
    timeUpdatePending = true;
    requestAnimationFrame(() => {
      timeUpdatePending = false;
      if (activeTrackId !== track.id) return;
      const item = trackAudioMap[track.id];
      syncAudioPair(item);
      // Звук не должен уходить за общий буфер обеих дорожек.
      checkPairBufferGate(item);
      // Данных впереди мало — просим следующую порцию (см. «ПОРЦИОННАЯ ЗАГРУЗКА»).
      streamTickItem(item);
      updateDeckProgressUI();
    });
  };

  audioA.addEventListener('timeupdate', handleTimeUpdate);
  audioB.addEventListener('timeupdate', handleTimeUpdate);
  audioA.addEventListener('loadedmetadata', () => {
    if (activeTrackId === track.id) updateDeckProgressUI();
    restoreWarmResume(track.id, audioA);
  });
  audioB.addEventListener('loadedmetadata', () => {
    if (activeTrackId === track.id) updateDeckProgressUI();
    restoreWarmResume(track.id, audioB);
  });

  /* Играющий трек догрузился целиком — снимаем удержание фоновой очереди
     (см. warmHold): дальше звук идёт из буфера, и фон снова может качать
     остальные треки. Проверка дешёвая: срабатывает только для того трека,
     который сейчас слушают. */
  audioA.addEventListener('progress', () => warmCheckHoldRelease(track.id));
  audioB.addEventListener('progress', () => warmCheckHoldRelease(track.id));
  audioA.addEventListener('canplaythrough', () => warmCheckHoldRelease(track.id));
  audioB.addEventListener('canplaythrough', () => warmCheckHoldRelease(track.id));

  audioA.addEventListener('ended', () => {
    if (activeTrackId === track.id) nextDeckTrack();
  });
  audioB.addEventListener('ended', () => {
    if (activeTrackId === track.id) nextDeckTrack();
  });

  /* Состояние данных пары: полоса буфера в пульте, спиннер на кнопке Play и
     дозапуск после буферизации (как в стримингах). Слушаем обе дорожки пары,
     но обработчик срабатывает только для активного трека. */
  const handleDeckDataState = () => {
    if (activeTrackId !== track.id) return;
    const item = trackAudioMap[track.id];
    streamTickItem(item);
    // Звук мог пойти или остановиться сам (гейт буфера) — доводим иконку Play.
    syncPlayStateUI(track.id);
    if (item.bufferGate) {
      /* Пара встала на границе общего буфера (см. checkPairBufferGate): ждём,
         пока данные дойдут до этой отметки у ОБЕИХ дорожек. */
      releasePairBufferGate(track.id);
    } else {
      const { audible } = getAudiblePair(item);
      if (audible.readyState >= 3) ensurePairPlaying(track.id);
    }
    updateDeckProgressUI();
    updateDeckBufferingUI();
  };
  ['play', 'playing', 'pause', 'progress', 'waiting', 'stalled', 'canplay',
    'loadeddata', 'suspend', 'ended'].forEach(evt => {
    audioA.addEventListener(evt, handleDeckDataState);
    audioB.addEventListener(evt, handleDeckDataState);
  });

  return trackAudioMap[track.id];
}

/* Наведение/фокус на карточке: пара создаётся сразу, а у файлов запрашиваются
   только первые килобайты (длительность и полоса перемотки готовы заранее).
   Мегабайты в сеть уходят только после клика. */
function prefetchTrackAudio(trackId) {
  if (!trackId) return;
  if (!trackAudioMap[trackId]) createTrackAudioEntry(getTrackConfigById(trackId));

  /* Порционный режим: «прогрев» — это только заголовки файлов (первые килобайты). */
  streamPreparePair(trackAudioMap[trackId]);

  if (hoverWarmId === trackId) return;
  hoverWarmId = trackId;
  clearTimeout(hoverWarmTimer);
  hoverWarmTimer = setTimeout(() => warmQueuePush(trackId, { front: true }), AUDIO_WARM_HOVER_DELAY);
}

/* Трек понадобился сейчас (клик, старт воспроизведения): включаем полную
   загрузку пары. Повторный вызов не перезапускает уже идущую передачу. */
function ensureTrackLoaded(trackId) {
  const item = trackAudioMap[trackId] || createTrackAudioEntry(getTrackConfigById(trackId));
  if (!item) return;
  /* Клик по треку — это и есть ручная повторная попытка: снимаем отметку об
     ошибке загрузки, которую поставил handleAudioError. */
  const failedIdx = audioFailedTrackIds.indexOf(trackId);
  if (failedIdx >= 0) audioFailedTrackIds.splice(failedIdx, 1);
  beginPairDownload(item);
  retryStalledPairFetch(item);
}

/* ══ ФОНОВЫЙ ПРОГРЕВ АУДИО ═══════════════════════════════════════════════
   Зачем. Треки «до/после» — это полноценные mp3 320 kbps: 5.4–11.1 МБ на
   файл, то есть 11–22 МБ на трек. Пока пара не в буфере, первый клик ждал
   сеть, а листание и смена языка EN↔RU ждали особенно долго: у нового языка
   подгружается сразу вся страница треков (47–66 МБ).

   Как. Сразу после загрузки страницы (window.load — критичные ресурсы уже
   взяты, поэтому LCP/TBT не затрагиваются) все треки обоих языков встают в
   очередь и качаются ПО ОДНОЙ паре за раз: следующий трек начинаем, когда
   текущий готов (или по страховочному таймауту), чтобы слышимая дорожка не
   делила канал с фоновыми загрузками.

   Приоритеты. Клик, «Next/Prev» и смена языка перебивают фон: выбранный трек
   идёт первым, а фоновую загрузку, которую никто не слушает, прерываем —
   канал целиком достаётся тому, что включили. Если фон занят активным
   (играющим) треком, его не трогаем: выбранный качается параллельно одной
   дополнительной парой.

   Чего очередь не делает: не трогает активную пару (звук не рвётся), не
   начинает новых загрузок при скрытой вкладке, не берёт в работу треки,
   которые уже целиком в буфере. Состояние очереди видно в консоли:
   window.nrAudioWarm.

   Важно: в порционном режиме («ПОРЦИОННАЯ ЗАГРУЗКА ПАРЫ») очередь вообще не
   запускается — мегабайты уходят только по клику, а весь поток ведёт
   nrAudioStream. Этот блок остаётся рабочим для браузеров без mp3 в MediaSource.
   ══════════════════════════════════════════════════════════════════════ */

const AUDIO_WARM_TIMEOUT = 20000;   // мс: страховка от залипания на медленном канале
const AUDIO_WARM_READY_TAIL = 0.5;  // с: «готово», если в буфере всё, кроме хвоста
const AUDIO_WARM_HOVER_DELAY = 120; // мс: сколько ждать «намерения» при наведении

const audioWarmQueue = [];       // id треков, ожидающих фоновой загрузки, по порядку
const audioWarmReady = [];       // id, чья пара уже целиком в буфере
const audioWarmCanceled = [];    // id, чью фоновую загрузку прервало действие пользователя
let audioWarmCurrentId = null;   // id фоновой загрузки в работе (одна пара за раз)
let audioWarmCurrentItem = null; // её пара дорожек
let audioWarmCurrentTimer = 0;   // таймер страховки фоновой загрузки
let audioWarmBoostId = null;     // трек, который качается параллельно (фон занят)
let audioWarmBoostTimer = 0;     // его таймер страховки
/* id трека, который слушают прямо сейчас. Пока он задан, фоновая очередь не
   берёт следующий трек: канал остаётся свободным для перемоток внутри
   играющего трека (см. warmQueueRun). Как только воспроизведение остановлено,
   warmReleaseHold() снимает удержание и очередь идёт дальше. */
let audioWarmHoldId = null;
let audioWarmSweepStarted = false;
let hoverWarmId = null;
let hoverWarmTimer = 0;

/* Пара готова к мгновенному воспроизведению: в буфере есть всё, кроме
   последнего хвоста (или браузер сам считает, что данных хватит до конца). */
function isElementWarm(el) {
  if (!el) return false;
  const dur = el.duration;
  if (dur && isFinite(dur)) {
    try {
      const t = el.currentTime || 0;
      for (let i = 0; i < el.buffered.length; i++) {
        if (el.buffered.start(i) <= t + 0.25 && el.buffered.end(i) >= dur - AUDIO_WARM_READY_TAIL) {
          return true;
        }
      }
    } catch (err) { /* buffered может быть недоступен до метаданных */ }
  }
  return el.readyState >= 4;
}

function isPairWarm(item) {
  if (!item) return false;
  return isElementWarm(item.audioA) && isElementWarm(item.audioB);
}

function markWarmReady(trackId) {
  if (audioWarmReady.indexOf(trackId) < 0) audioWarmReady.push(trackId);
}

function setPairPreload(item, value) {
  if (!item) return;
  if (item.audioA.preload !== value) item.audioA.preload = value;
  if (item.audioB.preload !== value) item.audioB.preload = value;
}

/* Возврат позиции после прерывания фоновой загрузки: load() в abortWarmCurrent
   сбрасывает currentTime, поэтому запомненную позицию восстанавливаем, когда
   элемент снова получил метаданные. */
function restoreWarmResume(trackId, el) {
  const item = trackAudioMap[trackId];
  if (!item || !item.resumeAt) return;
  try {
    const at = item.resumeAt;
    if (!el.duration || at < el.duration - 0.5) el.currentTime = at;
  } catch (err) { /* не критично: восстанавливать позицию не обязательно */ }
}

/* Включает полную загрузку пары. load() вызываем ровно один раз на попытку:
   повторный вызов сбросил бы уже скачанное и позицию воспроизведения. */
function beginPairDownload(item) {
  if (!item) return;
  /* Порционный режим: в сеть уходят только первые килобайты заголовка — порции
     начнёт качать playPairAudio (streamActivateItem). */
  if (audioChunkSupported()) { streamPreparePair(item); return; }
  setPairPreload(item, 'auto');
  if (item.warmStarted) return;
  /* load() нужен только ПУСТОЙ паре: у элемента, в котором уже есть данные, он
     обнулил бы и буфер, и позицию воспроизведения. Незакрытая загрузка у такой
     пары просто продолжается. */
  if (hasAnyAudioData(item)) return;
  item.warmStarted = true;
  item.audioA.load();
  item.audioB.load();
}

/* Слушатели вешаем на пару один раз. Они «молчат», пока этот трек не станет
   целью прогрева — фоновой или параллельной. */
function bindWarmListeners(trackId, item) {
  if (!item || item.warmBound) return;
  item.warmBound = true;

  const check = () => {
    if (audioWarmCurrentId !== trackId && audioWarmBoostId !== trackId) return;
    if (isPairWarm(item)) finishWarmLoad(trackId, true);
  };

  ['canplaythrough', 'progress', 'loadeddata', 'suspend'].forEach(evt => {
    item.audioA.addEventListener(evt, check);
    item.audioB.addEventListener(evt, check);
  });
}

/* ── очередь прогрева ─────────────────────────────────────────────────── */

/* Очередь дошла до этого трека — начинаем загрузку пары.
   null: качать нечего (нет трека или он уже целиком в буфере). */
function startWarmLoad(trackId) {
  const item = trackAudioMap[trackId] || createTrackAudioEntry(getTrackConfigById(trackId));
  if (!item) return null;
  if (isPairWarm(item)) { markWarmReady(trackId); return null; }

  bindWarmListeners(trackId, item);
  beginPairDownload(item);
  return item;
}

/* Фоновая загрузка закончилась: пара готова либо вышла страховка по времени. */
function finishWarmLoad(trackId, isReady) {
  if (audioWarmBoostId === trackId) {
    clearTimeout(audioWarmBoostTimer);
    audioWarmBoostTimer = 0;
    audioWarmBoostId = null;
  }
  if (audioWarmCurrentId !== trackId) return;

  clearTimeout(audioWarmCurrentTimer);
  audioWarmCurrentTimer = 0;
  audioWarmCurrentId = null;
  audioWarmCurrentItem = null;
  if (isReady) markWarmReady(trackId);
  warmQueueRun();
}

/* Прерываем фоновую загрузку: канал нужен треку, который выбрал пользователь.
   Пара сбрасывается и возвращается в конец очереди, чтобы догрузиться позже.
   Активный (играющий) трек не прерываем никогда — звук не должен рваться. */
function abortWarmCurrent() {
  const trackId = audioWarmCurrentId;
  const item = audioWarmCurrentItem;

  audioWarmCurrentId = null;
  audioWarmCurrentItem = null;
  clearTimeout(audioWarmCurrentTimer);
  audioWarmCurrentTimer = 0;

  if (item) {
    // Позицию запоминаем: load() обнуляет currentTime, а вернувшись к треку,
    // пользователь должен услышать то же место (см. restoreWarmResume).
    const at = Math.max(item.audioA.currentTime || 0, item.audioB.currentTime || 0);
    item.resumeAt = at > 0.25 ? at : 0;
    setPairPreload(item, 'none');
    item.warmStarted = false;
    item.audioA.load();
    item.audioB.load();
  }
  if (trackId) {
    if (audioWarmCanceled.indexOf(trackId) < 0) audioWarmCanceled.push(trackId);
    if (audioWarmQueue.indexOf(trackId) < 0) audioWarmQueue.push(trackId);
  }
}

/* front: true — трек нужен раньше остальных (наведение, сосед играющего).
   defer: true — не запускать очередь сразу: батч-постановка, запуск в конце
   (см. warmPrioritizeLanguage — иначе первым начал бы качаться последний трек). */
function warmQueuePush(trackId, options = {}) {
  if (!trackId || !getTrackConfigById(trackId)) return;
  if (audioWarmCurrentId === trackId || audioWarmBoostId === trackId) return;

  const item = trackAudioMap[trackId];
  if (item && isPairWarm(item)) { markWarmReady(trackId); return; }

  const idx = audioWarmQueue.indexOf(trackId);
  if (options.front) {
    if (idx >= 0) audioWarmQueue.splice(idx, 1);
    audioWarmQueue.unshift(trackId);
  } else if (idx < 0) {
    audioWarmQueue.push(trackId);
  }

  if (!options.defer) warmQueueRun();
}

function warmQueueRun() {
  /* Порционный режим: мегабайты качаются только по клику — очередь здесь ничего
     не делает, поэтому в сеть заранее не уходит ничего лишнего. */
  if (audioChunkSupported()) return;
  if (audioWarmCurrentId) return; // одна пара за раз
  if (document.hidden) return;    // вкладка скрыта — новые загрузки не начинаем
  /* Трек слушают прямо сейчас: канал держим свободным. Если продолжить качать
     следующую пару, любая перемотка («перемотал на припев») встанет в очередь
     за фоновыми мегабайтами — это и давало секунды ожидания. Как только
     воспроизведение остановлено, очередь продолжается сама (warmReleaseHold). */
  if (audioWarmHoldId) return;

  while (audioWarmQueue.length) {
    const trackId = audioWarmQueue.shift();
    const item = startWarmLoad(trackId);
    if (!item) continue;

    audioWarmCurrentId = trackId;
    audioWarmCurrentItem = item;
    clearTimeout(audioWarmCurrentTimer);
    audioWarmCurrentTimer = setTimeout(() => finishWarmLoad(trackId, false), AUDIO_WARM_TIMEOUT);
    return;
  }
}

/* ── приоритеты: действие пользователя главнее фона ───────────────────── */

/* Выбранный трек нужен сейчас: фон, который никто не слушает, прерываем.
   Если фон занят активным треком — качаем выбранный параллельно одной
   дополнительной парой, чтобы не рвать звук. */
function warmQueuePrioritize(trackId) {
  if (!trackId || !getTrackConfigById(trackId)) return;

  const item = trackAudioMap[trackId];
  if (item && isPairWarm(item)) { markWarmReady(trackId); return; }

  if (audioWarmCurrentId && audioWarmCurrentId !== trackId &&
      audioWarmCurrentId !== activeTrackId) {
    const currentItem = audioWarmCurrentItem;
    if (currentItem && !isPairWarm(currentItem)) abortWarmCurrent();
  }

  warmQueuePush(trackId, { front: true });

  if (audioWarmCurrentId && audioWarmCurrentId !== trackId && audioWarmBoostId !== trackId) {
    clearTimeout(audioWarmBoostTimer);
    audioWarmBoostTimer = 0;
    const previousBoost = audioWarmBoostId;
    audioWarmBoostId = null;
    if (previousBoost) warmQueuePush(previousBoost);

    const boostItem = startWarmLoad(trackId);
    if (boostItem) {
      audioWarmBoostId = trackId;
      audioWarmBoostTimer = setTimeout(() => finishWarmLoad(trackId, false), AUDIO_WARM_TIMEOUT);
    }
  }
}

/* Пользователь слушает трек: он вне очереди, соседи — сразу за ним. */
function warmOnPlay(trackId) {
  if (!trackId) return;
  // Клик «забывает» наведение: если трек позже вернётся в очередь, новое
  // наведение на него снова сможет поднять его в начало.
  hoverWarmId = null;
  warmQueuePrioritize(trackId);

  const enabled = getEnabledTracks();
  if (enabled.length < 2) return;
  const idx = enabled.findIndex(tr => tr.id === trackId);
  if (idx < 0) return;

  const nextTrack = enabled[(idx + 1) % enabled.length];
  const prevTrack = enabled[(idx - 1 + enabled.length) % enabled.length];
  // Порядок вставки обратный: следующий трек оказывается первым в очереди.
  if (prevTrack && prevTrack.id !== nextTrack.id) warmQueuePush(prevTrack.id, { front: true });
  if (nextTrack) warmQueuePush(nextTrack.id, { front: true });
}

/* Перемотка внутри играющего трека («перемотал на припев»). Новое место почти
   всегда ещё не в буфере, поэтому браузер идёт в сеть за этим участком
   (Range-запрос). Если параллельно идёт фоновый прогрев, канал делится, и звук
   ждёт своей порции данных — на 320 kbps это заметные секунды. Здесь канал
   освобождается под активный трек, но САМУ пару не перезагружаем: у неё уже
   есть буфер и позиция, повторный load() их бы обнулил. */
function warmOnSeek(trackId, seekTime) {
  if (!trackId) return;
  warmOnPlay(trackId);
  /* Перемотали в место, которого в буфере ещё нет: канал снова целиком под
     этот трек, пока нужный участок не догрузится (дальше удержание снимет
     warmCheckHoldRelease). */
  warmHold(trackId);
  // Фоновая загрузка, которая не звучит, канал больше не занимает.
  if (audioWarmCurrentId && audioWarmCurrentId !== trackId &&
      audioWarmCurrentId !== activeTrackId) {
    const currentItem = audioWarmCurrentItem;
    if (currentItem && !isPairWarm(currentItem)) abortWarmCurrent();
  }
  void seekTime;
}

/* ── удержание фона на время прослушивания ─────────────────────────────── */

/* Трек зазвучал: фоновая очередь останавливается, весь канал — этому треку,
   пока он не догружен целиком. Именно это убирает «нажал и жду 8 секунд»:
   выбранный трек не делит канал с фоновыми загрузками.
   Как только пара в буфере целиком, удержание снимается само
   (warmCheckHoldRelease) — слушать можно из буфера, и фон снова качает
   остальные треки. Если пользователь перемотал в непрогруженный участок,
   удержание ставится снова (warmOnSeek). */
function warmHold(trackId) {
  if (!trackId) return;
  /* Порционный режим: канал не делится — очередь здесь ничего не бронирует. */
  if (audioChunkSupported()) return;
  /* Пара уже целиком в буфере — держать канал незачем, и снимать удержание
     будет нечем (событие progress для готового трека может не прийти). */
  const item = trackAudioMap[trackId];
  if (item && isPairWarm(item)) { audioWarmHoldId = null; return; }
  audioWarmHoldId = trackId;
}

/* Воспроизведение остановлено (пауза, доиграл до конца) — фон снова качает
   ВСЕ треки: очередь пересобирается в исходный порядок (активный язык целиком,
   затем второй), уже скачанное не перекачивается. Это и есть «остановил —
   снова загружаются все треки». */
function warmReleaseHold() {
  if (!audioWarmHoldId) return;
  audioWarmHoldId = null;
  warmQueueRefill();
  warmQueueRun();
}

/* Играющий трек догрузился целиком — держать канал больше незачем. */
function warmCheckHoldRelease(trackId) {
  if (!audioWarmHoldId || audioWarmHoldId !== trackId) return;
  const item = trackAudioMap[trackId];
  if (item && isPairWarm(item)) warmReleaseHold();
}

/* Докладываем в очередь всё, чего в ней нет и что ещё не готово. */
function warmQueueRefill() {
  getInitialWarmOrder().forEach(trackId => warmQueuePush(trackId, { defer: true }));
}

/* Сменился язык — треки нового языка нужны раньше всего остального. */
function warmPrioritizeLanguage(lang) {
  const ids = getEnabledTracksForLang(lang).map(tr => tr.id);
  // Ставим батчем и запускаем очередь один раз: у поочерёдной вставки первый же
  // unshift начал бы качать последний трек языка вместо первого.
  ids.slice().reverse().forEach(trackId => warmQueuePush(trackId, { front: true, defer: true }));
  warmQueueRun();
}

/* Порядок первого прогрева: первый трек активного языка (самый вероятный
   клик) → остальные треки активного языка → первый трек второго языка →
   хвост второго языка. */
function getInitialWarmOrder() {
  const activeIds = getEnabledTracks().map(tr => tr.id);
  const otherIds = getEnabledTracksForLang(activeTrackLang === 'ru' ? 'en' : 'ru').map(tr => tr.id);
  return [].concat(
    activeIds.slice(0, 1),
    activeIds.slice(1),
    otherIds.slice(0, 1),
    otherIds.slice(1)
  );
}

function whenBrowserIdle(callback) {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => callback(), { timeout: 1500 });
  } else {
    setTimeout(callback, 200);
  }
}

/* Основной триггер прогрева: страница загружена целиком, сеть свободна. */
function scheduleInitialAudioWarm() {
  if (audioWarmSweepStarted) return;
  audioWarmSweepStarted = true;
  getInitialWarmOrder().forEach(trackId => warmQueuePush(trackId));
}

/* Состояние очереди — для проверки в браузере (консоль: nrAudioWarm).
   hold — id трека, который слушают: пока он не догружен, фоновая очередь
   стоит и канал целиком отдан ему. paused — стоит ли очередь из-за удержания
   или скрытой вкладки. cacheBust — включён ли отладочный обход кэша
   (CONFIG.AUDIO_CACHE_BUST): при true каждый заход качает треки заново. */
/* ══ ПОРЦИОННАЯ ЗАГРУЗКА ПАРЫ (ПО 15 СЕКУНД) ═══════════════════════════════
   Зачем. Файлы треков — mp3 320 kbps (5.4–11.1 МБ), то есть 11–22 МБ на пару,
   а у двух языков — 47–66 МБ. В обычном режиме браузер, начав загрузку, качает
   файл далеко вперёд: полоса загрузки сразу уходит к концу, а мегабайты — в то,
   что ещё не слушают. Здесь поток данных режем сами: впереди держим ровно одну
   порцию — AUDIO_CHUNK_SEC секунд, и просим следующую, когда до её конца
   остаётся AUDIO_CHUNK_AHEAD секунд. Полоса загрузки после этого честная: она
   показывает именно то, что скачано.

   Как. Дорожка играет не файл, а MediaSource (audio/mpeg — тот же mp3, но байты
   в буфер кладём мы). Длительность, битрейт и начало первого кадра известны из
   первых килобайт файла (Range-запрос заголовка, без мегабайт), поэтому время
   переводится в байты как t × битрейт/8. Границы порций выравниваются по кадрам
   mp3 (1152 сэмпла = 26.12 мс), поэтому склейка бесшовная: следующая порция
   начинается ровно там, где кончилась предыдущая.

   Клик и перемотка. Первая порция короткая (AUDIO_CHUNK_HEAD_SEC): звук должен
   пойти сразу, а не через 15 секунд загрузки. Перемотка в место, где данных нет,
   качает порцию с этой позиции — показывается загрузка, а трек продолжается сам
   с той же секунды (releasePairBufferGate). Пауза и переход на другой трек
   передачу обрывают, скачанное остаётся; позади позиции держим только
   AUDIO_CHUNK_KEEP_BEHIND секунд, иначе буферы прослушанных треков копились бы
   в памяти. Порядок «мегабайты только по клику» держит и очередь прогрева: в
   этом режиме она не запускается (warmQueueRun), а наведение на карточку тянет
   лишь заголовки файлов (streamPreparePair).

   Если браузер не умеет mp3 внутри MediaSource, файл оказался не CBR или буфер
   отказался принять данные — режим выключается сам (streamDisableChunkMode) и
   всё работает как раньше: файл качает браузер. Состояние видно в консоли:
   window.nrAudioStream.summary. */

const AUDIO_CHUNK_ENABLED = true;    // false — прежняя загрузка файла целиком
const AUDIO_CHUNK_SEC = 15;          // с: размер порции
const AUDIO_CHUNK_AHEAD = 5;         // с: за сколько до конца порции просить следующую
const AUDIO_CHUNK_HEAD_SEC = 2;      // с: первая порция (клик, перемотка)
const AUDIO_CHUNK_KEEP_BEHIND = 20;  // с: сколько скачанного оставляем позади
const AUDIO_CHUNK_RETRY_MS = 1500;   // мс: пауза перед повтором
const AUDIO_CHUNK_PROBE_BYTES = 4096;
const AUDIO_CHUNK_FRAME_SEEK = 1600;
const AUDIO_CHUNK_MIME = 'audio/mpeg';

let audioChunkOff = false;
let audioChunkCapable = null;

/* Порции качаются через fetch с заголовком Range и собираются в MediaSource —
   это возможно только по http(s). Страница, открытая прямо с диска (file://),
   на такой запрос получает отказ, поэтому для неё режим порций выключаем сразу,
   ещё до первого клика: иначе первая же выбранная пара уходила бы в fetch,
   который падает асинхронно (уже после клика), и первый трек после открытия
   страницы молчал бы, пока отказ не переключит режим на обычную загрузку. */
function audioStreamProtocolOk() {
  try {
    const protocol = window.location && window.location.protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch (err) { return false; }
}

function audioChunkSupported() {
  if (!AUDIO_CHUNK_ENABLED || audioChunkOff) return false;
  if (!audioStreamProtocolOk()) {
    streamDisableChunkMode('страница открыта как файл (file://) — порции работают только по http(s)');
    return false;
  }
  if (audioChunkCapable === null) {
    try {
      audioChunkCapable = typeof MediaSource !== 'undefined' &&
        typeof MediaSource.isTypeSupported === 'function' &&
        MediaSource.isTypeSupported(AUDIO_CHUNK_MIME);
    } catch (err) { audioChunkCapable = false; }
    if (!audioChunkCapable) audioChunkOff = true;
  }
  return audioChunkCapable;
}

/* ── разбор mp3 ── */

const MP3_BITRATE_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, -1];
const MP3_BITRATE_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, -1];
const MP3_SAMPLERATE_V1 = [44100, 48000, 32000, -1];
const MP3_SAMPLERATE_V2 = [22050, 24000, 16000, -1];
const MP3_SAMPLERATE_V25 = [11025, 12000, 8000, -1];

function mp3Id3Size(bytes) {
  if (bytes.length < 10) return 0;
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0;
  const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  return 10 + size + ((bytes[5] & 0x10) ? 10 : 0);
}

function mp3FrameAt(bytes, p) {
  if (p < 0 || p + 4 > bytes.length) return null;
  if (bytes[p] !== 0xff || (bytes[p + 1] & 0xe0) !== 0xe0) return null;
  const version = (bytes[p + 1] >> 3) & 3;
  const layer = (bytes[p + 1] >> 1) & 3;
  const bitrateIdx = (bytes[p + 2] >> 4) & 0xf;
  const rateIdx = (bytes[p + 2] >> 2) & 3;
  if (version === 1 || layer !== 1 || bitrateIdx === 0 || bitrateIdx === 15 || rateIdx === 3) return null;
  const mpeg1 = version === 3;
  const bitrate = (mpeg1 ? MP3_BITRATE_V1_L3 : MP3_BITRATE_V2_L3)[bitrateIdx] * 1000;
  const sr = mpeg1 ? MP3_SAMPLERATE_V1[rateIdx] :
    (version === 2 ? MP3_SAMPLERATE_V2[rateIdx] : MP3_SAMPLERATE_V25[rateIdx]);
  if (!bitrate || sr <= 0) return null;
  const padding = (bytes[p + 2] >> 1) & 1;
  return { bitrate, sampleRate: sr, samplesPerFrame: mpeg1 ? 1152 : 576,
    length: Math.floor((mpeg1 ? 144 : 72) * bitrate / sr) + padding };
}

function mp3FrameStartAt(bytes, p) {
  const frame = mp3FrameAt(bytes, p);
  if (!frame) return null;
  if (p + frame.length + 4 > bytes.length) return frame;
  const next = mp3FrameAt(bytes, p + frame.length);
  if (!next || next.bitrate !== frame.bitrate || next.sampleRate !== frame.sampleRate) return null;
  return frame;
}

function mp3ChunkStart(bytes, fromByte, atByte, mode) {
  const at = atByte - fromByte;
  if (mode === 'at') {
    for (let p = Math.min(bytes.length - 4, at + 8); p >= 0; p--) {
      if (mp3FrameStartAt(bytes, p)) return fromByte + p;
    }
  }
  const until = Math.min(bytes.length - 4, at + AUDIO_CHUNK_FRAME_SEEK);
  for (let p = Math.max(0, at); p <= until; p++) {
    if (mp3FrameStartAt(bytes, p)) return fromByte + p;
  }
  return -1;
}

async function readAudioStreamMeta(url) {
  let response;
  try { response = await fetch(url, { headers: { Range: 'bytes=0-' + (AUDIO_CHUNK_PROBE_BYTES - 1) } }); } catch (err) { return null; }
  const cr = response.headers.get('Content-Range');
  if (!response.ok || !cr) {
    if (response.body && response.body.cancel) { try { response.body.cancel(); } catch (err) {} }
    return null;
  }
  const m = /\/(\d+)\s*$/.exec(cr);
  const totalBytes = m ? Number(m[1]) : 0;
  let bytes;
  try { bytes = new Uint8Array(await response.arrayBuffer()); } catch (err) { return null; }
  if (!totalBytes || bytes.length < 128) return null;

  const audioStart = mp3Id3Size(bytes);
  const first = mp3FrameStartAt(bytes, audioStart);
  if (!first) return null;

  let at = audioStart, frames = 0;
  while (frames < 3 && at + 4 <= bytes.length) {
    const f = mp3FrameStartAt(bytes, at);
    if (!f || f.bitrate !== first.bitrate) return null;
    at += f.length; frames++;
  }
  if (frames < 3) return null;
  const bps = first.bitrate / 8;
  return { url, totalBytes, audioStart, bitrate: first.bitrate, sampleRate: first.sampleRate,
    bytesPerSec: bps, frameSec: first.samplesPerFrame / first.sampleRate,
    duration: (totalBytes - audioStart) / bps };
}

/* ── состояние порционной загрузки ── */

const audioStreamMap = new Map();

function audioStreamOf(el) { return el ? (audioStreamMap.get(el) || null) : null; }

/* Состояние дорожки для порционной загрузки: создаётся один раз. */
function streamStateFor(el, url) {
  let st = audioStreamOf(el);
  if (!st) {
    st = { el, url: url || (el.dataset && el.dataset.nrSrc) || '',
      meta: null, probing: false, wanted: false, source: null, buffer: null,
      objectUrl: null, chunk: null, appending: null, fetching: false, aborter: null,
      fetchToken: 0, appended: 0, nextByte: 0, nextTime: 0, fresh: true, done: false,
      retryAt: 0, failCount: 0 };
    audioStreamMap.set(el, st);
  }
  return st;
}

/* Привязка дорожки к порционному режиму: состояние плюс реакция на перемотку.
   Перемотку слушаем здесь, потому что место, куда прыгнул пользователь, почти
   всегда ещё не скачано — порция качается с этой позиции (streamOnSeek). */
function streamBindElement(el, url) {
  const st = streamStateFor(el, url);
  if (!st.seekBound) {
    st.seekBound = true;
    const onSeek = () => streamOnSeek(st);
    el.addEventListener('seeking', onSeek);
    el.addEventListener('seeked', onSeek);
  }
  return st;
}

function streamPreparePair(item) {
  if (!item || !audioChunkSupported()) return;
  [item.audioA, item.audioB].forEach(el => {
    const st = streamBindElement(el);
    if (st && !st.meta && !st.probing) streamPrepareMeta(st);
  });
}

function streamPrepareMeta(st) {
  st.probing = true;
  readAudioStreamMeta(st.url).then(meta => {
    st.probing = false;
    if (!meta) { streamDisableChunkMode('файл не подошёл: ' + st.url); return; }
    st.meta = meta; st.nextByte = meta.audioStart; st.nextTime = 0; st.fresh = true;
    if (st.wanted) streamStart(st);
  }).catch(() => { st.probing = false; });
}

function streamDisableChunkMode(reason) {
  if (audioChunkOff) return;
  audioChunkOff = true;
  if (typeof console !== 'undefined' && console.warn)
    console.warn('Аудио: порции (' + AUDIO_CHUNK_SEC + ' с) выключены —', reason);
  Array.from(audioStreamMap.values()).forEach(st => streamRevertToFile(st));
}

function streamStopFetch(st) {
  if (st.aborter) { try { st.aborter.abort(); } catch (err) {} st.aborter = null; }
  /* Номер запроса растёт: обработчики уже отменённого ответа увидят чужой токен
     и промолчат. Иначе отменённый ответ обнулил бы флаги НОВОГО запроса
     (перемотка ровно в этот момент) — и качались бы две порции сразу. */
  st.fetchToken++;
  st.fetching = false;
}

function findItemForElement(el) {
  for (const key in trackAudioMap) {
    const i = trackAudioMap[key];
    if (i && (i.audioA === el || i.audioB === el)) return i;
  }
  return null;
}

function streamRevertToFile(st) {
  const el = st.el; const item = findItemForElement(el);
  const at = el.currentTime || 0;
  streamStopFetch(st); st.chunk = null; st.appending = null; st.wanted = false;
  audioStreamMap.delete(el);
  /* В порционном режиме элементу НЕ ставили src: адрес файла лежал в
     data-nr-src, а звук шёл из собранного на лету потока. Возврат к обычной
     загрузке обязан этот адрес вернуть: без него load() в beginPairDownload
     остался бы без файла, и трек, который слушали в момент отказа, замолчал бы
     навсегда — именно так и молчал первый клик после открытия страницы. */
  const fileUrl = (el.dataset && el.dataset.nrSrc) || st.url || '';
  el.preload = 'none';
  try { el.removeAttribute('src'); el.load(); } catch (err) {}
  if (fileUrl) { try { el.src = fileUrl; } catch (err) {} }
  if (st.objectUrl) { try { URL.revokeObjectURL(st.objectUrl); } catch (err) {} st.objectUrl = null; }
  st.source = null; st.buffer = null;
  if (item) {
    if (at > 0.25) item.resumeAt = at;
    item.warmStarted = false;
    if (item.wantPlay) { beginPairDownload(item); retryStalledPairFetch(item); }
  }
}

/* ── активация потока ── */

function streamActivateItem(item, on) {
  if (!item) return;
  if (!audioChunkSupported()) { if (on) { beginPairDownload(item); retryStalledPairFetch(item); } return; }
  const states = [item.audioA, item.audioB].map(el => audioStreamOf(el)).filter(Boolean);
  if (!states.length) { if (on) { beginPairDownload(item); retryStalledPairFetch(item); } return; }
  states.forEach(st => { st.wanted = !!on; if (on) streamStart(st); else streamPause(st); });
}

function streamStart(st) {
  if (!st || st.done) return;
  if (!st.meta) { streamPrepareMeta(st); return; }
  if (!st.source) streamAttach(st);
  streamKick(st);
}

function streamAttach(st) {
  const el = st.el;
  let source;
  try { source = new MediaSource(); st.objectUrl = URL.createObjectURL(source); } catch (err) { streamDisableChunkMode('MediaSource не создался'); return; }
  st.source = source;
  source.addEventListener('sourceopen', () => {
    if (source.readyState !== 'open') return;
    let buffer;
    try { buffer = source.addSourceBuffer(AUDIO_CHUNK_MIME); } catch (err) { streamDisableChunkMode('аудиокодек не принят'); return; }
    st.buffer = buffer;
    buffer.addEventListener('updateend', () => streamAfterAppend(st));
    buffer.addEventListener('error', () => streamDisableChunkMode('буфер не принял данные'));
    try { source.duration = st.meta.duration; } catch (err) {}
    streamKick(st);
  });
  st.nextByte = st.meta.audioStart; st.nextTime = 0; st.fresh = true; st.done = false; st.retryAt = 0; st.failCount = 0; st.appended = 0;
  el.preload = 'none'; el.src = st.objectUrl;
}

function streamKick(st) {
  if (!st || !st.meta || !st.buffer) return;
  if (!st.wanted || st.fetching || st.done) return;
  if (st.chunk) { streamFlush(st); return; }
  if (document.hidden) return;
  if (st.buffer.updating) return;
  if (st.retryAt && performance.now() < st.retryAt) return;
  const el = st.el; const at = el.currentTime || 0; const end = getBufferedEndAt(el, at);
  if (end - at >= AUDIO_CHUNK_AHEAD) return;
  if (end < at) { st.nextByte = st.meta.audioStart + Math.round(at * st.meta.bytesPerSec); st.nextTime = at; st.fresh = true; }
  else if (end > 0 && Math.abs(st.nextTime - end) > 0.1) { st.nextByte = st.meta.audioStart + Math.round(end * st.meta.bytesPerSec); st.nextTime = end; }
  streamFetchChunk(st);
}

function streamFetchChunk(st) {
  const meta = st.meta; const sec = st.fresh ? AUDIO_CHUNK_HEAD_SEC : AUDIO_CHUNK_SEC;
  const from = st.fresh ? Math.max(meta.audioStart, st.nextByte - AUDIO_CHUNK_FRAME_SEEK) : st.nextByte;
  const last = meta.totalBytes - 1; const to = Math.min(last, st.nextByte + Math.round(sec * meta.bytesPerSec) - 1);
  const token = ++st.fetchToken;
  st.fetching = true; st.aborter = (typeof AbortController === 'function') ? new AbortController() : null;
  fetch(meta.url, { headers: { Range: 'bytes=' + from + '-' + to }, signal: st.aborter ? st.aborter.signal : undefined })
    .then(response => { if (!response.ok || !response.headers.get('Content-Range')) throw new Error('HTTP ' + response.status); return response.arrayBuffer(); })
    .then(buffer => {
      if (st.fetchToken !== token) return;   // это ответ отменённого запроса
      st.fetching = false; st.aborter = null; st.failCount = 0;
      if (!st.wanted || !st.meta) return;
      streamQueueChunk(st, new Uint8Array(buffer), from, to >= last);
    })
    .catch(err => {
      if (st.fetchToken !== token) return;
      st.fetching = false; st.aborter = null;
      if (err && err.name === 'AbortError') return;
      st.failCount++; st.retryAt = performance.now() + AUDIO_CHUNK_RETRY_MS;
      if (st.failCount >= 3) streamDisableChunkMode('порция не скачивается: ' + (err && err.message));
    });
}

function streamQueueChunk(st, bytes, fromByte, tail) {
  const startByte = mp3ChunkStart(bytes, fromByte, st.nextByte, st.fresh ? 'at' : 'after');
  if (startByte < 0) { streamRetryChunk(st, 'граница кадра не найдена'); return; }
  let offset = startByte - fromByte, atb = offset, frames = 0;
  while (atb + 4 <= bytes.length) { const f = mp3FrameAt(bytes, atb); if (!f || f.bitrate !== st.meta.bitrate || atb + f.length > bytes.length) break; atb += f.length; frames++; }
  const end = tail ? bytes.length : atb;
  if (end <= offset) { streamRetryChunk(st, 'порция без полного кадра'); return; }
  st.chunk = { payload: bytes.subarray(offset, end), time: st.nextTime, frames: frames + (tail ? 1 : 0), nextByte: fromByte + end, tail, fresh: st.fresh };
  st.fresh = false; streamFlush(st);
}

function streamRetryChunk(st, reason) {
  st.fresh = true; st.retryAt = performance.now() + AUDIO_CHUNK_RETRY_MS; st.failCount++;
  if (st.failCount >= 3) streamDisableChunkMode(reason);
}
function streamFlush(st) {
  const chunk = st.chunk, buffer = st.buffer, source = st.source;
  if (!chunk || !buffer || !source || buffer.updating) return;
  if (source.readyState === 'ended') { try { source.duration = st.meta.duration; } catch (err) {} }
  st.chunk = null;
  try { buffer.timestampOffset = chunk.time; buffer.appendBuffer(chunk.payload); st.appending = chunk; }
  catch (err) { st.appending = null; streamDisableChunkMode('буфер не принял: ' + err.message); }
}

function streamAfterAppend(st) {
  const chunk = st.appending; st.appending = null;
  if (chunk) {
    if (!streamCheckOffset(st, chunk)) return;
    st.nextByte = chunk.nextByte; st.nextTime = chunk.time + chunk.frames * st.meta.frameSec;
    st.appended += chunk.payload.length;
    if (chunk.tail) { st.done = true; st.nextTime = st.meta.duration; streamEndOfStream(st); }
    updateDeckProgressUI();
  }
  streamFlush(st); streamKick(st);
}

function streamCheckOffset(st, chunk) {
  if (!chunk.fresh || chunk.time < 0.5) return true;
  if (getBufferedEndAt(st.el, chunk.time) > chunk.time) return true;
  streamDisableChunkMode('браузер игнорирует смещение'); return false;
}

function streamEndOfStream(st) {
  const source = st.source;
  if (!source || source.readyState !== 'open') return;
  try { source.endOfStream(); } catch (err) {}
}

/* ── пауза, перемотка, подкачка ── */

function streamPause(st) { streamStopFetch(st); st.chunk = null; st.retryAt = 0; streamTrimBehind(st); }

function streamTrimBehind(st) {
  const buffer = st.buffer, source = st.source;
  if (!buffer || !source || source.readyState !== 'open' || buffer.updating) return;
  const to = (st.el.currentTime || 0) - AUDIO_CHUNK_KEEP_BEHIND;
  if (to <= 1) return; let from = 0;
  try { from = st.el.buffered.length ? st.el.buffered.start(0) : 0; } catch (err) { return; }
  if (to - from <= 1) return;
  try { buffer.remove(from, to); } catch (err) {}
}

function streamOnSeek(st) {
  if (!st || !st.meta || !st.wanted) return;
  const at = st.el.currentTime || 0;
  if (getBufferedEndAt(st.el, at) > at) return;
  if (st.fetching && Math.abs(st.nextTime - at) < 0.5) return;
  streamStopFetch(st); st.retryAt = 0;
  /* Возврат в место, которое уже было прослушано и обрезано (streamTrimBehind)
     или ещё не качалось: порция нужна снова — значит поток не «завершён». */
  st.done = false;
  st.nextByte = st.meta.audioStart + Math.round(at * st.meta.bytesPerSec);
  st.nextTime = at; st.fresh = true; streamKick(st);
}

function streamTickItem(item) {
  if (!item || !AUDIO_CHUNK_ENABLED || audioChunkOff) return;
  if (!item.wantPlay) return;
  [item.audioA, item.audioB].forEach(el => streamKick(audioStreamOf(el)));
}

function streamResumeActive() {
  if (!AUDIO_CHUNK_ENABLED || audioChunkOff) return;
  audioStreamMap.forEach(st => { if (st.wanted) streamKick(st); });
}

window.nrAudioStream = {
  get enabled() { return audioChunkSupported(); },
  get chunkSec() { return AUDIO_CHUNK_SEC; },
  get summary() {
    const rows = [];
    audioStreamMap.forEach(st => {
      if (!st.wanted) return;
      const el = st.el; const at = el.currentTime || 0;
      const item = findItemForElement(el);
      rows.push({
        track: item ? item.trackIndex : 0,
        file: item ? (el === item.audioA ? 'before' : 'after') : '',
        pos: Math.round(at * 10) / 10,
        ahead: Math.round(getBufferedAhead(el, at) * 10) / 10,
        gotKB: Math.round(st.appended / 1024), fetching: st.fetching, done: st.done
      });
    });
    return rows;
  }
};
window.nrAudioWarm = {
  get queue() { return audioWarmQueue.slice(); },
  get current() { return audioWarmCurrentId; },
  get boost() { return audioWarmBoostId; },
  get ready() { return audioWarmReady.slice(); },
  get canceled() { return audioWarmCanceled.slice(); },
  get hold() { return audioWarmHoldId; },
  get paused() { return !!audioWarmHoldId || document.hidden; },
  get cacheBust() { return !!(CONFIG && CONFIG.AUDIO_CACHE_BUST); },
  get summary() {
    return {
      listening: audioWarmHoldId,
      downloading: audioWarmCurrentId,
      parallel: audioWarmBoostId,
      waiting: audioWarmQueue.slice(),
      buffered: audioWarmReady.slice(),
      interrupted: audioWarmCanceled.slice(),
      cacheBust: !!(CONFIG && CONFIG.AUDIO_CACHE_BUST)
    };
  }
};

// Анимация перехода ленты треков (свайп-эффект) и синхронизация стрелок
// листания: назначаются в initPlayer, вызываются из renderTrackList и кнопок.
let animateTrackTransition = null;
let syncTrackNav = null;
// Прогрев peek-панелей (соседние страницы) — тоже назначается в initPlayer.
let warmTrackPeekPanels = null;

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
    btn.addEventListener('click', () => {
      const targetLang = btn.getAttribute('data-track-lang');
      if (!targetLang || targetLang === activeTrackLang) return;

      if (typeof animateTrackTransition === 'function') {
        // Раскладка 'nav': слева предыдущая страница, справа следующая — как
        // кнопки EN | RU. Сторону перехода задаёт положение кнопок, поэтому
        // клик по правой кнопке ведёт треки влево, а по левой — вправо.
        const direction = getLangSwitchDirection(targetLang);
        animateTrackTransition(direction, () => {
          setTrackLanguage(targetLang, direction > 0 ? 'last' : 0);
        }, 'nav');
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
    const DRAG_RATIO = 0.55;         // «сопротивление»: палец идёт быстрее ленты
    const DRAG_LIMIT_RATIO = 0.35;   // максимум сдвига — доля ширины списка
    const SETTLE_FALLBACK = 420;     // мс: страховка, если transitionend не придёт
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeAxis = null;       // 'x' | 'y' | null (ещё не определена)
    let swipeAnimating = false; // идёт доводка — новые жесты игнорируем
    let peekReady = false;      // соседние панели отрисованы, лента включена

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
      // Панели НЕ очищаем: их карточки (и уже декодированные обложки) остаются
      // готовыми к следующему свайпу. Раньше содержимое сбрасывалось, и при
      // быстром листании панель успевала показаться раньше, чем декодируются
      // картинки — соседние треки «моргали» пустыми обложками. Подпись тоже
      // сохраняем: если состояние списка не изменилось, содержимое панелей
      // остаётся верным и пересобирать его не нужно (см. fillPeekPanels).
      clearPeekFade();
      peekReady = false;
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
    const runTrackTransition = (motion, applyStep, layout = 'swipe') => {
      if (swipeAnimating) return false;   // уже едет — повторные нажатия игнорируем

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
          exitSwipeMode();
          // Новая страница встала на место — по карточкам мягко пробегает блик.
          playTrackSheen();
          swipeAnimating = false;
          // Готовим панели к следующему свайпу: их карточки и обложки собираются
          // заранее, поэтому быстрое листание больше не показывает пустые картинки.
          if (typeof warmTrackPeekPanels === 'function') warmTrackPeekPanels();
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
          fadePeekPanel(exitPanel, 0, true, PEEK_DISSOLVE_MS);
        });
      });
      return true;
    };
    animateTrackTransition = runTrackTransition;

    // Свайп вправо = вперёд (панель следующей страницы лежит слева).
    const settleSwipe = (direction) => {
      runTrackTransition(direction, () => stepTrackPage(direction), 'swipe');
    };

    /* ── Стрелки листания (телефон) ─────────────────────────────────────────
       Листают список тем же переходом, что и свайп, но по-карусельному:
       правая стрелка толкает список влево (следующие треки въезжают справа),
       левая — вправо (предыдущие въезжают слева). Видимость и положение
       включает syncTrackNav() из renderTrackList. */
    const navPrevBtn = document.getElementById('trackNavPrevBtn');
    const navNextBtn = document.getElementById('trackNavNextBtn');
    const navWrap = document.getElementById('trackListNavWrap');

    if (navPrevBtn) navPrevBtn.addEventListener('click', () => runTrackTransition(1, () => stepTrackPage(-1), 'nav'));
    if (navNextBtn) navNextBtn.addEventListener('click', () => runTrackTransition(-1, () => stepTrackPage(1), 'nav'));

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
      setPeekFade(0, 0, true, true);
      flushTrackStyles();
      setTrackX('translate3d(-100%, 0, 0)', true);
      afterTrackTransition(() => {
        exitSwipeMode();
        swipeAnimating = false;
      });
    };

    swipeViewport.addEventListener('touchstart', (e) => {
      const touch = e.changedTouches[0];
      // Базу жеста фиксируем ДО проверки swipeAnimating: иначе жест, начавшийся,
      // пока лента ещё доезжает, унаследовал бы координаты и ось (swipeAxis='x')
      // предыдущего свайпа — тогда вертикальный скролл по карточкам таскал бы
      // ленту за собой, а отпускание возвращало её на место.
      swipeStartX = touch.clientX;
      swipeStartY = touch.clientY;
      swipeAxis = null;
      if (swipeAnimating) return; // во время доводки новый жест не ведём
    }, { passive: true });

    swipeViewport.addEventListener('touchmove', (e) => {
      if (swipeAnimating || swipeAxis === 'y') return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - swipeStartX;
      const dy = touch.clientY - swipeStartY;

      // Ось жеста определяем один раз по первым сантиметрам движения.
      if (swipeAxis === null) {
        if (Math.abs(dx) > SWIPE_AXIS_THRESHOLD || Math.abs(dy) > SWIPE_AXIS_THRESHOLD) {
          swipeAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        }
        if (swipeAxis !== 'x') return;
        // Горизонтальный жест: показываем соседние треки и ведём ленту.
        enterSwipeMode('swipe');
      }

      moveTrackWithFinger(dx);
    }, { passive: true });

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
  const prevPlaying = !prevEl.paused;
  const nextPlaying = !nextEl.paused;

  /* Переключение BEFORE/AFTER на непрогруженной паре — это тоже перемотка:
     второй дорожке нужен тот же участок из сети. Отдаём ей канал так же, как
     при обычной перемотке (если пара уже целиком в буфере — ничего не делаем,
     чтобы не держать фон без причины). */
  if (!isPairWarm(item)) warmOnSeek(activeTrackId, prevEl.currentTime);

  // Логика и интерфейс переключаются мгновенно, звук — микро-фейдом
  item.source = src;
  updateDeckSourceUI();
  cancelPendingSwitch();
  item.seekPending = false;

  if (prevPlaying && nextPlaying) {
    const drift = prevEl.currentTime - nextEl.currentTime;
    const nextIsSilent = nextEl.volume <= 0.01;

    if (!nextIsSilent || Math.abs(drift) <= AUDIO_SWITCH_ALIGN) {
      // Дорожки уже стоят в одной точке — переключаем сразу, без задержки.
      // (Если вторая дорожка сейчас слышна — предыдущий переход в процессе:
      // seek по ней дал бы щелчок, поэтому просто продолжаем микро-фейд.)
      nextEl.playbackRate = 1;
      applyAudioVolumes(activeTrackId, true);
      return;
    }

    // Разошлись (буферизация, только что начали играть): подводим неслышимую
    // дорожку seek'ом и стартуем фейд, как только она встала на место, — иначе
    // при переходе «повторится» кусок фразы, звучавшей до переключения.
    nextEl.playbackRate = 1;
    const onSeeked = () => finishPendingSwitch();
    pendingSwitch = { item, nextEl, prevEl, src, onSeeked };
    nextEl.addEventListener('seeked', onSeeked, { once: true });
    nextEl.currentTime = prevEl.currentTime;
    pendingSwitchTimer = setTimeout(finishPendingSwitch, AUDIO_SWITCH_ALIGN_TIMEOUT);
    return;
  }

  // Одна из дорожек не играет (пауза или браузер не дал автозапуск): эталон —
  // та дорожка, которую пользователь только что слушал, выравнивание неслышно,
  // а переключение делаем мгновенным — без «дыры» в звуке.
  alignPairTo(item, prevEl);
  if (prevPlaying && !nextPlaying) {
    const p = nextEl.play();
    if (p && p.catch) p.catch(() => {});
  }
  applyAudioVolumes(activeTrackId, false);
}

function toggleDeckSource() {
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

function changeDeckVolume(val) {
  if (!activeTrackId) return;
  const item = trackAudioMap[activeTrackId];
  if (!item) return;

  item.volume = parseFloat(val);
  applyAudioVolumes(activeTrackId, false);
}

/* ══ ПЕРЕКЛЮЧЕНИЕ BEFORE / AFTER БЕЗ АРТЕФАКТОВ ═══════════════════════
   На каждый трек параллельно идут ОБА файла: слышен тот, у которого громкость
   больше нуля. Переключение — короткий микро-фейд (40 мс, без щелчка), а не
   длинный кроссфейд: при длинном кроссфейде обе дорожки звучат одновременно, и
   если их позиции расходятся хотя бы на десятки миллисекунд, окончание фразы
   слышится дважды. Поэтому:
     1. позиция «тихой» дорожки постоянно удерживается в одной точке со звучащей
        (коррекция скорости — её не слышно, громкость = 0);
     2. в момент клика позиции не перематываются: если дорожки уже совпадают,
        фейд стартует мгновенно; если разошлись — тихую (неслышимую) дорожку
        подводим seek'ом и стартуем фейд, как только она встала на место.
   ══════════════════════════════════════════════════════════════════════ */

const AUDIO_SYNC_TOLERANCE = 0.004;     // мёртвая зона синхронизации (4 мс)
const AUDIO_SYNC_GAIN = 4;              // усиление коррекции скорости
const AUDIO_SYNC_RATE_MAX = 0.12;       // предел коррекции скорости (±12 %)
const AUDIO_SYNC_HARD = 0.2;            // больше — выравниваем позицией
const AUDIO_FADE_MS = 40;               // микро-фейд переключения
const AUDIO_SWITCH_ALIGN = 0.015;       // с какого расхождения нужна подводка
const AUDIO_SWITCH_ALIGN_TIMEOUT = 140; // максимум ожидания подводки, мс

let audioFadeRAF = null;
let pendingSwitch = null;
let pendingSwitchTimer = null;

/* Какая из двух дорожек звучит сейчас, а какая идёт рядом на нулевой громкости */
function getAudiblePair(item) {
  const audibleIsA = item.source !== 'after';
  return {
    audible: audibleIsA ? item.audioA : item.audioB,
    silent: audibleIsA ? item.audioB : item.audioA
  };
}

/* Дорожка реально слышна: играет и громкость больше нуля */
function isAudioAudible(el) {
  return !el.paused && el.volume > 0.005;
}

/* Синхронизация в обычном воспроизведении: трогаем ТОЛЬКО неслышимую дорожку.
   Звучащая — эталон, её позицию и скорость не меняем никогда. */
function syncAudioPair(item) {
  if (!item) return;
  if (pendingSwitch || audioFadeRAF !== null) return; // идёт переход — не вмешиваемся

  const { audible, silent } = getAudiblePair(item);
  if (!isAudioAudible(audible)) return;

  // Пользователь тянет полосу прокрутки: пока браузер не закончил seek звучащей
  // дорожки, вторую не трогаем — двойной seek как раз и давал рывок в звуке.
  if (item.seekPending) {
    if (audible.seeking) return;
    if (Math.abs(audible.currentTime - silent.currentTime) > AUDIO_SYNC_TOLERANCE) {
      silent.playbackRate = 1;
      silent.currentTime = audible.currentTime;
    }
    item.seekPending = false;
    return;
  }

  if (isAudioAudible(silent)) return; // ещё затухает после перехода — не трогаем

  const drift = audible.currentTime - silent.currentTime;
  const absDrift = Math.abs(drift);

  // Большое расхождение (буферизация, скачок) — выравниваем позицией тихой дорожки
  if (absDrift > AUDIO_SYNC_HARD) {
    silent.playbackRate = 1;
    silent.currentTime = audible.currentTime;
    return;
  }

  if (absDrift < AUDIO_SYNC_TOLERANCE) {
    if (silent.playbackRate !== 1) silent.playbackRate = 1;
    return;
  }

  // Мягкая догонка скоростью: на неслышимой дорожке это незаметно
  const rate = 1 + Math.max(-AUDIO_SYNC_RATE_MAX, Math.min(AUDIO_SYNC_RATE_MAX, drift * AUDIO_SYNC_GAIN));
  if (Math.abs(silent.playbackRate - rate) > 0.002) silent.playbackRate = rate;
}

/* Подготовка пары к старту/паузе: на паузе выравнивание позицией неслышно.
   Эталон — звучащая дорожка (по текущему item.source). */
function prepareAudioPair(item) {
  if (!item) return;
  cancelPendingSwitch();
  const { audible } = getAudiblePair(item);
  alignPairTo(item, audible);
  item.seekPending = false;
}

/* Выравнивает «вторую» дорожку по указанной (эталон не трогаем) */
function alignPairTo(item, referenceEl) {
  if (!item || !referenceEl) return;
  const other = referenceEl === item.audioA ? item.audioB : item.audioA;
  other.playbackRate = 1;
  if (Math.abs(referenceEl.currentTime - other.currentTime) > AUDIO_SYNC_TOLERANCE) {
    other.currentTime = referenceEl.currentTime;
  }
}

function stopAudioFade() {
  if (audioFadeRAF !== null) {
    cancelAnimationFrame(audioFadeRAF);
    audioFadeRAF = null;
  }
}

function applyAudioVolumes(trackId, smooth = false) {
  const item = trackAudioMap[trackId];
  if (!item) return;

  const targetVolA = item.source === 'before' ? item.volume : 0;
  const targetVolB = item.source === 'after' ? item.volume : 0;

  // Мгновенно: пауза, скрытая вкладка или режим без сглаживания
  if (!smooth || document.hidden || (item.audioA.paused && item.audioB.paused)) {
    stopAudioFade();
    item.audioA.volume = targetVolA;
    item.audioB.volume = targetVolB;
    return;
  }

  // Микро-фейд по S-кривой считается покадрово: без «ступенек» и без таймеров,
  // поэтому переход не зависит от загрузки главного потока.
  stopAudioFade();

  const startA = item.audioA.volume;
  const startB = item.audioB.volume;
  const t0 = performance.now();

  const step = (now) => {
    const k = Math.min(1, (now - t0) / AUDIO_FADE_MS);
    const ease = 0.5 - Math.cos(k * Math.PI) / 2;

    item.audioA.volume = Math.max(0, Math.min(1, startA + (targetVolA - startA) * ease));
    item.audioB.volume = Math.max(0, Math.min(1, startB + (targetVolB - startB) * ease));

    if (k < 1) {
      audioFadeRAF = requestAnimationFrame(step);
    } else {
      audioFadeRAF = null;
      item.audioA.volume = targetVolA;
      item.audioB.volume = targetVolB;
    }
  };

  audioFadeRAF = requestAnimationFrame(step);
}

/* ── Подводка дорожек перед переходом ──────────────────────────────── */

function cancelPendingSwitch() {
  if (pendingSwitch && pendingSwitch.onSeeked) {
    try { pendingSwitch.nextEl.removeEventListener('seeked', pendingSwitch.onSeeked); } catch (e) {}
  }
  if (pendingSwitchTimer) {
    clearTimeout(pendingSwitchTimer);
    pendingSwitchTimer = null;
  }
  pendingSwitch = null;
}

/* Дорожка встала на место (либо вышло время ожидания) — запускаем микро-фейд */
function finishPendingSwitch() {
  const p = pendingSwitch;
  if (!p) return;
  cancelPendingSwitch();

  const stillActive = activeTrackId && trackAudioMap[activeTrackId] === p.item && p.item.source === p.src;
  if (!stillActive) return;

  p.nextEl.playbackRate = 1;
  applyAudioVolumes(activeTrackId, true);
}

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
    updateDeckProgressUI();
  }
}

function initDeckSeekBar() {
  const seekArea = document.getElementById('deckSeekHitArea');
  if (!seekArea) return;

  let isSeeking = false;

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
    try { seekArea.setPointerCapture(e.pointerId); } catch (err) {}
    handleSeekFromEvent(e);
  });

  seekArea.addEventListener('pointermove', (e) => {
    if (!isSeeking) return;
    handleSeekFromEvent(e);
  });

  const stopSeeking = (e) => {
    if (!isSeeking) return;
    isSeeking = false;
    try { seekArea.releasePointerCapture(e.pointerId); } catch (err) {}

    // Прокрутка закончилась: выравниваем вторую дорожку по звучащей одним движением
    if (activeTrackId) {
      const item = trackAudioMap[activeTrackId];
      if (item) {
        item.seekPending = true;
        if (item.audioA.paused && item.audioB.paused) prepareAudioPair(item);
      }
    }
  };

  seekArea.addEventListener('pointerup', stopSeeking);
  seekArea.addEventListener('pointercancel', stopSeeking);

  // Touch fallback
  seekArea.addEventListener('touchmove', (e) => {
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

/* ── гейт общим буфером пары ───────────────────────────────────────────
   Пара не должна играть дальше, чем у обеих дорожек есть данные: если звучащая
   или неслышимая дорожка ушла бы вперёд, звук пропал бы, а полоса показала бы
   неверное. Запас, при котором пара встаёт на паузу — AUDIO_PAIR_GUARD
   (0.15 с); отпускаем, когда общий буфер впереди AUDIO_PAIR_HEAD (0.75 с). */

const AUDIO_PAIR_GUARD = 0.15; // с: запас, при котором пара встаёт на паузу
const AUDIO_PAIR_HEAD = 0.75;  // с: запас, с которым она продолжает (гистерезис)

/* Конец скачанного участка дорожки РОВНО в этой точке. 0 — данных в позиции нет
   (дыра): впереди может лежать скачанный кусок, но играть до него нельзя, не
   перематывая. Именно так выглядит конец общего буфера пары. */
function getBufferedEndAt(el, pos) {
  if (!el) return 0;
  try {
    const t = Math.max(0, pos || 0);
    for (let i = 0; i < el.buffered.length; i++) {
      if (el.buffered.start(i) > t + 0.25) break; // ближайший участок — дальше позиции
      const end = el.buffered.end(i);
      if (end >= t) return end;
    }
    return 0;
  } catch (err) {
    return 0;
  }
}

/* Сколько секунд данных есть в дорожке ВПЕРЁД от позиции (0 и меньше — в этой
   точке данных нет). */
function getBufferedAhead(el, pos) {
  const t = Math.max(0, pos || 0);
  return getBufferedEndAt(el, t) - t;
}

/* Минимум по обеим дорожкам пары — «до этой отметки трек обеспечен данными». */
function getPairBufferedAhead(item, pos) {
  if (!item) return 0;
  return Math.min(getBufferedAhead(item.audioA, pos), getBufferedAhead(item.audioB, pos));
}

/* Полоса буфера и спиннер загрузки — показываем и включаем, только когда
   трек слушают (wantPlay), а не при фоновой загрузке. */

function setDeckBuffering(on) {
  const bar = document.getElementById('stickyPlayerBar');
  if (!bar) return;
  bar.classList.toggle('nr-buffering', on);
}

function updateDeckBufferingUI() {
  if (!activeTrackId) { setDeckBuffering(false); return; }
  const item = trackAudioMap[activeTrackId];
  if (!item || !item.wantPlay) { setDeckBuffering(false); return; }
  const { audible } = getAudiblePair(item);
  const buffering = audible.readyState < 3;
  setDeckBuffering(buffering);
}

/* Гейт: звук не уходит за общий буфер обеих дорожек. Если данных впереди
   меньше запаса — пара встаёт на паузу и ждёт, пока догрузится то же место
   у МЕНЬШЕЙ из двух дорожек. */
function checkPairBufferGate(item) {
  if (!item || !item.wantPlay) return;
  const { audible } = getAudiblePair(item);
  if (audible.paused || audible.seeking || audible.ended) return;

  const pos = audible.currentTime || 0;
  const pairEnd = pos + getPairBufferedAhead(item, pos);
  const dur = audible.duration || 0;
  /* Хвост файла: если до конца трека меньше, чем запас для продолжения, ждать
     нечего — иначе пара встала бы перед самым «ended» и следующий трек не
     включился бы. */
  if (dur > 0 && dur - pos <= AUDIO_PAIR_HEAD) return;
  if (pairEnd - pos > AUDIO_PAIR_GUARD) return;

  gatePairByBuffer(item);
}

function gatePairByBuffer(item) {
  const { audible } = getAudiblePair(item);
  item.bufferGate = true;
  alignPairTo(item, audible);  // вторая дорожка — в ту же точку: продолжат вместе
  audible.pause();
  updateDeckBufferingUI();
}

/* Данные дошли до позиции, на которой пара встала, — продолжаем сами, без клика.
   Запас для продолжения больше, чем для остановки: иначе пара дёргалась бы
   пауза/игра на каждой новой порции данных. */
function releasePairBufferGate(trackId) {
  const item = trackAudioMap[trackId];
  if (!item || !item.bufferGate) return;
  const { audible } = getAudiblePair(item);
  const pos = audible.currentTime || 0;
  if (getPairBufferedAhead(item, pos) < AUDIO_PAIR_HEAD) return;

  item.bufferGate = false;
  alignPairTo(item, audible);
  ensurePairPlaying(trackId);
  updateDeckBufferingUI();
}

/* Трек слушают, но дорожка стоит без данных: как только браузер снова может
   играть — продолжаем без клика пользователя. */
function ensurePairPlaying(trackId) {
  const item = trackAudioMap[trackId];
  if (!item || !item.wantPlay) return;
  [item.audioA, item.audioB].forEach(el => {
    if (!el.paused || el.ended) return;
    const p = el.play();
    if (p && p.catch) p.catch(err => {
      if (err && err.name === 'AbortError') return;
      console.warn('Play:', err);
      item.wantPlay = false;
      updateDeckBufferingUI();
    });
  });
}

/* ── точка начала и остановки пары ── */

function playPairAudio(trackId) {
  const item = trackAudioMap[trackId];
  if (!item) return;
  item.wantPlay = true;
  /* Поток данных пары: в порционном режиме клик сразу просит первые секунды. */
  if (audioChunkSupported()) streamActivateItem(item, true);
  /* Стоит ли на текущей позиции общий буфер пары (данные ОБЕИХ дорожек)? Если
     нет, звук не начинаем: покажем ожидание и стартуем сами, когда данные дойдут
     (releasePairBufferGate). Так на холодном клике не бывает «пуск-стоп». */
  const { audible } = getAudiblePair(item);
  item.bufferGate = getPairBufferedAhead(item, audible.currentTime || 0) <= AUDIO_PAIR_GUARD;
  if (item.bufferGate) {
    item.audioA.pause();
    item.audioB.pause();
  } else {
    ensurePairPlaying(trackId);
  }
  updateDeckBufferingUI();
}

/* Пауза пары: сначала снимаем «слушают» — иначе дозапуск вернул бы звук. */
function pausePairAudio(trackId) {
  const item = trackAudioMap[trackId];
  if (!item) return;
  item.wantPlay = false;
  item.bufferGate = false;
  item.audioA.pause();
  item.audioB.pause();
  /* Порционный режим: обрываем передачу порций — скачанное и позиция остаются. */
  if (audioChunkSupported()) streamActivateItem(item, false);
  updateDeckBufferingUI();
}

function updateDeckProgressUI() {
  if (!activeTrackId) return;
  const item = trackAudioMap[activeTrackId];
  if (!item) return;

  // Прогресс считаем по звучащей дорожке (BEFORE → audioA, AFTER → audioB)
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
    itemCard.onclick = () => toggleTrack(track.id);
  }
  itemCard.setAttribute('data-track-id', track.id);
  // Подпись вида: структура карточки у видов разная, и renderTrackList по этой
  // подписи понимает, можно ли переиспользовать готовый DOM (см. canReuseDOM).
  itemCard.setAttribute('data-view', isVerticalView ? 'vertical' : 'row');
  itemCard.className = (isVerticalView
    ? `p-3 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col gap-3 group ${
        isSelected
          ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10'
          : 'bg-[#0B0E15] border-gray-800/80 hover:border-amber-500/40 hover:bg-[#0F131E]'
      }`
    : `p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between gap-3.5 group ${
        isSelected
          ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10'
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
  liveOverlay.className = 'track-live-overlay absolute inset-0 bg-black/60 items-center justify-center';
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
    if (withId) playBtn.onclick = (ev) => { ev.stopPropagation(); toggleTrack(track.id); };
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
    if (withId) playBtn.onclick = (ev) => { ev.stopPropagation(); toggleTrack(track.id); };
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
              ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10' 
              : 'bg-[#0B0E15] border-gray-800/80 hover:border-amber-500/40 hover:bg-[#0F131E]'
          }`
        : `p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between gap-3.5 group ${
            isSelected 
              ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10' 
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
      dot.onclick = () => {
        currentTrackPage = i;
        renderTrackList(true);
      };
      dotsContainer.appendChild(dot);
    }
  }

  if (!animate && typeof initPlayerTrackCardsTimeline === 'function') {
    initPlayerTrackCardsTimeline(false);
  }

  // Точки-индикатор листания и стрелки на телефоне
  renderTrackDots();
  if (typeof syncTrackNav === 'function') syncTrackNav();
}

// --- SERVICES SECTION ---
function initServices() {
  renderServices();
}

function renderServices() {
  const container = document.getElementById('servicesContainer');
  if (!container) return;

  const currentDevice = getDeviceType();
  const t = CONFIG.i18n[currentLang];

  // In-place update to prevent DOM destruction, layout jitter, and scroll reset on language toggle
  const existingCards = container.querySelectorAll('.service-mobile-card');
  if (existingCards.length === CONFIG.servicesData.length) {
    CONFIG.servicesData.forEach((s, idx) => {
      const card = existingCards[idx];
      const titleRaw = currentLang === 'ru' ? s.titleRu : s.titleEn;
      const descRaw = currentLang === 'ru' ? s.descRu : s.descEn;
      const priceRaw = currentLang === 'ru' ? s.priceRu : s.priceEn;
      const featuresRaw = currentLang === 'ru' ? s.featuresRu : s.featuresEn;

      const title = resolveDeviceText(titleRaw, currentDevice);
      const desc = resolveDeviceText(descRaw, currentDevice);
      const price = resolveDeviceText(priceRaw, currentDevice);
      const features = Array.isArray(featuresRaw)
        ? featuresRaw.map(f => resolveDeviceText(f, currentDevice))
        : [resolveDeviceText(featuresRaw, currentDevice)];

      let fromLabel = currentLang === 'ru' ? 'от' : 'from';
      let displayPrice = price;

      if (typeof price === 'string') {
        if (price.toLowerCase().startsWith('от ')) {
          fromLabel = 'от';
          displayPrice = price.slice(3).trim();
        } else if (price.toLowerCase().startsWith('from ')) {
          fromLabel = 'from';
          displayPrice = price.slice(5).trim();
        }
      }

      const popularBadgeText = resolveDeviceText(t.services.popularBadge, currentDevice);
      const orderBtnText = resolveDeviceText(t.services.orderBtn, currentDevice);

      const popEl = card.querySelector('.popular-badge');
      if (popEl) popEl.textContent = popularBadgeText;

      const titleEl = card.querySelector('.service-card-title');
      if (titleEl) {
        // Заголовок может содержать inline-HTML (перенос строки <br> в средней карточке) —
        // та же проверка, что в renderI18nText().
        if (typeof title === 'string' && title.includes('<')) titleEl.innerHTML = title;
        else titleEl.textContent = title;
      }

      const descEl = card.querySelector('.service-card-desc');
      if (descEl) descEl.textContent = desc;

      const featEls = card.querySelectorAll('.service-feature-text');
      features.forEach((fText, fIdx) => {
        if (featEls[fIdx]) featEls[fIdx].textContent = fText;
      });

      const fromEl = card.querySelector('.service-card-from');
      if (fromEl) fromEl.textContent = fromLabel;

      const priceEl = card.querySelector('.service-card-price');
      if (priceEl) {
        priceEl.textContent = displayPrice;
        priceEl.setAttribute('data-target-price', displayPrice);
      }

      const btnSpan = card.querySelector('.service-card-order-btn span');
      if (btnSpan) btnSpan.textContent = orderBtnText;
    });

    updateServicesDots(false);
    return;
  }

  container.innerHTML = '';

  CONFIG.servicesData.forEach((s, idx) => {
    const titleRaw = currentLang === 'ru' ? s.titleRu : s.titleEn;
    const descRaw = currentLang === 'ru' ? s.descRu : s.descEn;
    const priceRaw = currentLang === 'ru' ? s.priceRu : s.priceEn;
    const featuresRaw = currentLang === 'ru' ? s.featuresRu : s.featuresEn;

    const title = resolveDeviceText(titleRaw, currentDevice);
    const desc = resolveDeviceText(descRaw, currentDevice);
    const price = resolveDeviceText(priceRaw, currentDevice);
    const features = Array.isArray(featuresRaw)
      ? featuresRaw.map(f => resolveDeviceText(f, currentDevice))
      : [resolveDeviceText(featuresRaw, currentDevice)];

    const card = document.createElement('div');
    card.className = s.isPopular
      // Компактнее по вертикали на телефоне/планшете (иначе карточки еле
      // помещаются на дисплей, особенно с нижней панелью плеера).
      ? 'service-mobile-card popular-rack-card p-4 sm:p-5 flex flex-col justify-between transition-colors duration-200 w-[78vw] max-w-[310px] sm:w-auto sm:max-w-none flex-shrink-0 snap-center cursor-pointer select-none'
      : 'service-mobile-card rack-card p-4 sm:p-5 flex flex-col justify-between transition-colors duration-200 w-[78vw] max-w-[310px] sm:w-auto sm:max-w-none flex-shrink-0 snap-center cursor-pointer select-none';

    // Set initial custom attribute
    card.setAttribute('data-card-index', idx);

    // Клик по любой части карточки услуги (кроме кнопки «Заказать») открывает
    // окно расчёта стоимости — на телефоне и на компьютере одинаково.
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      if (typeof openPriceCalcModal === 'function') openPriceCalcModal();
    });

    let featuresHtml = features.map(f => `
      <li class="service-feature-item flex items-start gap-3 text-sm text-gray-300">
        <svg class="service-check-icon w-4 h-4 text-emerald-400 flex-shrink-0 mt-1 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span class="service-feature-text leading-relaxed">${f}</span>
      </li>
    `).join('');

    const rackUnitText = s.id === 'mixing'
      ? 'RACK UNIT // MIX'
      : s.id === 'mix-master'
      ? 'RACK UNIT // MIX-MASTERING'
      : 'RACK UNIT // MASTERING';

    let fromLabel = currentLang === 'ru' ? 'от' : 'from';
    let displayPrice = price;

    if (typeof price === 'string') {
      if (price.toLowerCase().startsWith('от ')) {
        fromLabel = 'от';
        displayPrice = price.slice(3).trim();
      } else if (price.toLowerCase().startsWith('from ')) {
        fromLabel = 'from';
        displayPrice = price.slice(5).trim();
      }
    }

    const popularBadgeText = resolveDeviceText(t.services.popularBadge, currentDevice);
    const orderBtnText = resolveDeviceText(t.services.orderBtn, currentDevice);

    card.innerHTML = `
      ${s.isPopular ? `<div class="service-card-popular absolute -top-3.5 inset-x-0 flex justify-center pointer-events-none z-10"><span class="popular-badge uppercase tracking-wider pointer-events-auto">${popularBadgeText}</span></div>` : ''}

      <div class="service-card-top flex flex-col">
        <div class="service-card-meta flex justify-between items-center mb-4 opacity-40">
          <div class="rack-bolt"></div>
          <div class="text-[10px] font-mono text-gray-400 tracking-widest uppercase">
            ${rackUnitText}
          </div>
          <div class="rack-bolt"></div>
        </div>

        <h3 class="service-card-title text-xl sm:text-2xl font-extrabold text-white mb-1.5 tracking-tight text-center">${title}</h3>
        <p class="service-card-desc text-sm text-gray-400 mb-4 leading-relaxed text-center">${desc}</p>

        <ul class="service-card-features space-y-2 sm:space-y-3 mb-3 sm:mb-5">
          ${featuresHtml}
        </ul>
      </div>

      <div class="service-card-bottom">
        <div class="service-card-divider h-px bg-gray-800/80 my-3 sm:my-5"></div>

        <div class="service-card-pricing flex items-center justify-between gap-4">
          <div class="service-card-price-group flex flex-col">
            <span class="service-card-from text-xs font-mono text-gray-400 uppercase tracking-wider">${fromLabel}</span>
            <span class="service-card-price text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent tracking-tight" data-target-price="${displayPrice}">${displayPrice}</span>
          </div>

          <button
            onclick="openContactModal()"
            class="service-card-order-btn py-2.5 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl transition-all duration-200 shadow-md shadow-amber-500/20 active:scale-95 text-sm sm:text-base cursor-pointer flex items-center gap-1.5 flex-shrink-0"
          >
            <span>${orderBtnText}</span>
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  container.removeEventListener('scroll', onServicesScroll);
  container.addEventListener('scroll', onServicesScroll, { passive: true });
  window.removeEventListener('resize', onServicesResize);
  window.addEventListener('resize', onServicesResize, { passive: true });

  // Раскладываем телефонную карусель сразу и включаем coverflow. Раскладка в этот
  // момент может быть ещё не готова (нулевые размеры) — тогда пробуем снова
  // в следующем кадре, а также по load/шрифтам/изменению размеров контейнера,
  // чтобы карточки НИКОГДА не оставались в неправильном положении.
  resetServicesCarouselState();
  scheduleMobileServicesAlignment();

  // Подстраховка: как только секция услуг появляется на экране, положение и
  // coverflow пересчитываются ещё раз (быстро, без видимых скачков).
  if (servicesCarouselObserver) {
    servicesCarouselObserver.disconnect();
    servicesCarouselObserver = null;
  }
  if ('IntersectionObserver' in window) {
    servicesCarouselObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) applyMobileServicesPosition();
      });
    }, { threshold: 0.06 });
    servicesCarouselObserver.observe(container);
  }

  window.removeEventListener('load', onServicesLayoutSettled);
  window.addEventListener('load', onServicesLayoutSettled);

  window.removeEventListener('scroll', onServicesPageScroll);
  window.addEventListener('scroll', onServicesPageScroll, { passive: true });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => onServicesLayoutSettled());
  }

  if (!servicesContainerObserver && 'ResizeObserver' in window) {
    servicesContainerObserver = new ResizeObserver(() => onServicesLayoutSettled());
    servicesContainerObserver.observe(container);
  }

  // Refresh ScrollTrigger and animations after cards are rendered
  if (typeof initServicesGsapAnimation === 'function') {
    initServicesGsapAnimation();
  }
  scheduleScrollTriggerRefresh(0);
}

/* ── Телефонная карусель услуг: стартовое положение ───────────────────
   «Главная» (популярная) карточка стоит по центру, соседние — за ней по краям
   и чуть под наклоном (coverflow из updateServicesDots). Раскладка считается
   только когда размеры уже реальные, поэтому применяем положение в первом же
   кадре, где это возможно, и повторяем по load / шрифтам / resize, пока не
   получится. */

const SERVICES_START_INDEX = 1; // индекс популярной карточки

let servicesCarouselObserver = null;   // IntersectionObserver на секцию
let servicesContainerObserver = null;  // ResizeObserver на контейнер
let servicesAutoCentered = false;      // стартовое положение уже применено
let servicesUserScrolled = false;      // пользователь сам пролистал карусель
let servicesAppliedScrollLeft = null;  // последняя позиция, которую выставили мы
let servicesCoverflowTransition = null; // последняя строка transition, выставленная coverflow
let isServicesScrollTicking = false;

function resetServicesCarouselState() {
  servicesAutoCentered = false;
  servicesUserScrolled = false;
  servicesAppliedScrollLeft = null;
}

/* Раскладка готова: у контейнера и карточек есть реальные размеры */
function isServicesLayoutReady(container) {
  const first = container.children[0];
  return !!first && container.clientWidth > 0 && first.offsetWidth > 0;
}

/* Ставит карусель в стартовое положение и включает coverflow.
   Возвращает true, если состояние уже применено (можно не повторять). */
function applyMobileServicesPosition() {
  const container = document.getElementById('servicesContainer');
  if (!container || !container.children.length) return true; // нечего выравнивать

  if (window.innerWidth >= 640) {
    updateServicesDots(false);
    return true;
  }

  if (!isServicesLayoutReady(container)) return false; // раскладка ещё не готова — повторим

  if (!servicesAutoCentered && !servicesUserScrolled) {
    scrollToServiceCard(SERVICES_START_INDEX, 'instant'); // сначала позиция…
    servicesAutoCentered = true;                          // …потом coverflow
  }
  updateServicesDots(false);
  return true;
}

/* Пробуем применить положение в каждом кадре, пока раскладка не будет готова */
function scheduleMobileServicesAlignment() {
  let tries = 0;
  const tick = () => {
    let done = false;
    try {
      done = applyMobileServicesPosition();
    } catch (e) {
      done = true; // эффекты не должны ломать сайт
    }
    if (done || ++tries > 120) return; // не больше ~2 секунд
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function onServicesLayoutSettled() {
  try { applyMobileServicesPosition(); } catch (e) {}
}

/* Подстраховка: если по какой-то причине стартовое положение ещё не применилось,
   оно применится при первой же прокрутке страницы — до того, как секция попадёт
   на экран. После успешного применения это просто проверка одного флага. */
function onServicesPageScroll() {
  if (servicesAutoCentered || servicesUserScrolled) return;
  try { applyMobileServicesPosition(); } catch (e) {}
}

function onServicesResize() {
  updateServicesDots(true);
  onServicesLayoutSettled();
}

function onServicesScroll() {
  if (!isServicesScrollTicking) {
    requestAnimationFrame(() => {
      const container = document.getElementById('servicesContainer');
      // Позиция, которую выставили не мы, — значит карусель листает пользователь:
      // после этого стартовое положение уже не навязываем.
      if (container && servicesAppliedScrollLeft !== null &&
          Math.abs(container.scrollLeft - servicesAppliedScrollLeft) > 6) {
        servicesUserScrolled = true;
      }
      updateServicesDots(false);
      isServicesScrollTicking = false;
    });
    isServicesScrollTicking = true;
  }
}

function scrollToServiceCard(index, behavior = 'smooth') {
  const container = document.getElementById('servicesContainer');
  if (!container) return;
  const cards = container.children;
  if (!cards || !cards[index]) return;

  const card = cards[index];
  const firstCard = cards[0];
  if (!firstCard) return;

  // Позиция карточки в прокручиваемой области: padding-left контейнера плюс
  // смещение от первой карточки (gap и отрицательный margin уже учтены в
  // offsetLeft). Расчёт не зависит от coverflow-трансформа и совпадает с точкой
  // снапа (scroll-snap-align: center) — карточки не «прыгают» после пролистывания.
  const padding = parseFloat(window.getComputedStyle(container).paddingLeft) || 0;
  const contentX = padding + (card.offsetLeft - firstCard.offsetLeft);

  // Снап выравнивает центры border-box карточки и scrollport (scroll-padding
  // компенсирует padding-left контейнера), поэтому берём ширину самой карточки.
  const cardWidth = card.offsetWidth || 290;

  const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
  let targetScrollLeft = contentX + cardWidth / 2 - container.clientWidth / 2;
  targetScrollLeft = Math.max(0, Math.min(maxScroll, Math.round(targetScrollLeft)));

  if (behavior === 'instant') {
    container.scrollTo({ left: targetScrollLeft, behavior: 'auto' });
    servicesAppliedScrollLeft = targetScrollLeft;
    updateServicesDots(false);
  } else {
    servicesAppliedScrollLeft = targetScrollLeft;
    container.scrollTo({
      left: targetScrollLeft,
      behavior: 'smooth'
    });
  }
}

function updateServicesDots(withTransition = false) {
  const container = document.getElementById('servicesContainer');
  if (!container) return;

  const cards = container.children;
  if (!cards.length) return;

  if (window.innerWidth >= 640) {
    // Планшет/десктоп: карточки уже не карусель, а сетка — снимаем ТОЛЬКО те
    // inline-стили, которые выставлял coverflow (помечаем их data-атрибутом выше).
    // Стирать transform/opacity «оптом» нельзя: на планшете/десктопе этими же
    // свойствами управляет GSAP-анимация появления карточек, и стирание их
    // посреди проигрывания давало «дёрганье».
    Array.from(cards).forEach(card => {
      if (card.dataset.nrCoverflow === '1') {
        card.style.transform = '';
        card.style.opacity = '';
        card.style.zIndex = '';
        card.style.transition = '';
        delete card.dataset.nrCoverflow;
        // Сбрасываем и кэш значений: иначе при возврате в режим карусели
        // coverflow решил бы, что стили уже выставлены, и ничего не записал.
        delete card.__nrCoverflow;
      }
    });
    return;
  }

  const containerWidth = container.clientWidth || window.innerWidth;
  const containerCenter = container.scrollLeft + (containerWidth / 2);

  // Координаты карточек внутри прокручиваемой области: padding-left контейнера
  // плюс смещение от первой карточки. Не зависят ни от offsetParent, ни от
  // coverflow-трансформа, поэтому coverflow считается точно.
  //
  // ВАЖНО: сначала ЧИТАЕМ все размеры (одна переклейка раскладки), и только
  // потом пишем стили. Раньше чтение offsetWidth/offsetLeft переплеталось с
  // записью transform, и браузер пересчитывал раскладку заново на каждой
  // карточке — при листании карусели это давало «фризы».
  const padding = parseFloat(window.getComputedStyle(container).paddingLeft) || 0;
  const firstLeft = cards[0].offsetLeft;
  const metrics = new Array(cards.length);
  for (let i = 0; i < cards.length; i++) {
    const w = cards[i].offsetWidth || 290;
    metrics[i] = { w: w, center: padding + (cards[i].offsetLeft - firstLeft) + (w / 2) };
  }

  let activeIndex = 0;
  let minDiff = Infinity;
  for (let i = 0; i < metrics.length; i++) {
    const absDiff = Math.abs(metrics[i].center - containerCenter);
    if (absDiff < minDiff) {
      minDiff = absDiff;
      activeIndex = i;
    }
  }

  // Режим перехода меняется редко (ресайз или ручная прокрутка), поэтому строку
  // transition пишем только когда она реально другая, а не на каждом кадре.
  const transitionValue = withTransition
    ? 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease, z-index 0.4s step-start'
    : 'none';
  const transitionChanged = transitionValue !== servicesCoverflowTransition;
  servicesCoverflowTransition = transitionValue;

  for (let idx = 0; idx < cards.length; idx++) {
    const card = cards[idx];
    const cardWidth = metrics[idx].w;
    const diff = metrics[idx].center - containerCenter;

    // Normalized distance from viewport center (-1 to 1)
    const progress = Math.max(-1.5, Math.min(1.5, diff / cardWidth));
    const clampedAbs = Math.min(1, Math.abs(progress));

    // Coverflow 3D transformation:
    // When behind: scaled down (0.90), partially transparent (0.50), slightly rotated on Y axis, shifted inwards
    const scale = 1 - 0.10 * clampedAbs;
    const opacity = 1 - 0.50 * clampedAbs;
    const shiftX = -28 * progress; // moves card slightly towards center underneath
    const rotateY = -10 * progress; // 3D tilt
    const zIndex = Math.max(1, Math.round(30 - clampedAbs * 20));

    // Помечаем, что transform/opacity карточки выставил именно coverflow — по
    // этому маркеру они снимаются при возврате к сетке (планшет/десктоп).
    if (card.dataset.nrCoverflow !== '1') card.dataset.nrCoverflow = '1';

    // Кэш последних выставленных значений: если карточка уже стоит так, как
    // нужно, повторная запись только зря нагружает стилевой движок.
    let cache = card.__nrCoverflow;
    if (!cache) cache = card.__nrCoverflow = { t: '', o: '', z: '' };
    if (transitionChanged || !cache.t) card.style.transition = transitionValue;

    const nextTransform = `translate3d(${shiftX.toFixed(1)}px, 0, 0) scale(${scale.toFixed(3)}) rotateY(${rotateY.toFixed(1)}deg)`;
    const nextOpacity = opacity.toFixed(2);
    const nextZ = String(zIndex);
    if (cache.t !== nextTransform) { cache.t = nextTransform; card.style.transform = nextTransform; }
    if (cache.o !== nextOpacity) { cache.o = nextOpacity; card.style.opacity = nextOpacity; }
    if (cache.z !== nextZ) { cache.z = nextZ; card.style.zIndex = nextZ; }
  }

  const dotsContainer = document.getElementById('servicesDotsContainer');
  if (dotsContainer) {
    const dots = dotsContainer.querySelectorAll('button');
    dots.forEach((dot, idx) => {
      if (idx === activeIndex) {
        dot.className = 'w-8 h-2.5 rounded-full transition-all duration-300 bg-amber-500 shadow-sm shadow-amber-500/50 cursor-pointer';
      } else {
        dot.className = 'w-2.5 h-2.5 rounded-full transition-all duration-300 bg-gray-700 hover:bg-amber-500 cursor-pointer';
      }
    });
  }
}

// --- FAQ SECTION ---
function initFaq() {
  renderFaq();
}

// FAQ-ответы в config.js заканчиваются промо-блоком со скидкой (FAQ_PROMO_RU / FAQ_PROMO_EN).
// Промо рендерится отдельным блоком ПОСЛЕ текста ответа: внутри <p> блок-уровневый <div>
// недопустим — парсер выносит его за пределы абзаца, и при повторном рендере промо дублируется.
function splitFaqAnswer(answerHtml) {
  const promo = currentLang === 'ru' ? FAQ_PROMO_RU : FAQ_PROMO_EN;
  if (typeof promo === 'string' && promo && answerHtml.indexOf(promo) !== -1) {
    // split/join убирает все вхождения — промо-блок на странице всегда один
    return { text: answerHtml.split(promo).join(''), promo: promo };
  }
  return { text: answerHtml, promo: '' };
}

function renderFaq() {
  const container = document.getElementById('faqContainer');
  if (!container) return;

  const currentDevice = getDeviceType();

  // In-place update to prevent layout jumps and DOM destruction on language toggle
  const existingCards = container.querySelectorAll('.rack-card');
  if (existingCards.length === CONFIG.faqData.length) {
    CONFIG.faqData.forEach((item, index) => {
      const card = existingCards[index];
      const qRaw = currentLang === 'ru' ? item.qRu : item.qEn;
      const aRaw = currentLang === 'ru' ? item.aRu : item.aEn;
      const q = resolveDeviceText(qRaw, currentDevice);
      const rawA = resolveDeviceText(aRaw, currentDevice);
      const a = (rawA || '').replace(/\n/g, '<br/>');
      const answer = splitFaqAnswer(a);

      const qSpan = card.querySelector('.faq-q-text') || card.querySelector('button > span');
      if (qSpan) qSpan.textContent = q;

      const aP = card.querySelector('.faq-a-text') || card.querySelector('.faq-content-wrapper p');
      if (aP) aP.innerHTML = answer.text;

      const promoSlot = card.querySelector('.faq-promo-slot');
      if (promoSlot) promoSlot.innerHTML = answer.promo;

      const body = card.querySelector('.faq-content-wrapper');
      if (body && body.getAttribute('data-open') === 'true') {
        body.style.display = 'block';
        body.style.height = 'auto';
        body.style.opacity = '1';
        card.classList.add('nr-faq-lang-switched');
      }
    });
    return;
  }

  container.innerHTML = '';

  CONFIG.faqData.forEach((item, index) => {
    const qRaw = currentLang === 'ru' ? item.qRu : item.qEn;
    const aRaw = currentLang === 'ru' ? item.aRu : item.aEn;
    const q = resolveDeviceText(qRaw, currentDevice);
    const rawA = resolveDeviceText(aRaw, currentDevice);
    const a = (rawA || '').replace(/\n/g, '<br/>');
    const answer = splitFaqAnswer(a);
    const itemKey = `faq-${index}`;

    const el = document.createElement('div');
    el.className = 'rack-card faq-card overflow-hidden border border-gray-800/80 transition-colors duration-300';
    el.innerHTML = `
      <button
        onclick="toggleFaq('${itemKey}')"
        class="w-full p-5 sm:p-6 text-left flex justify-between items-center gap-4 group focus:outline-none cursor-pointer select-none"
        aria-expanded="false"
      >
        <span class="faq-q-text flex-1 min-w-0 text-base sm:text-lg font-bold text-gray-100 group-hover:text-amber-400 transition-colors">
          ${q}
        </span>
        <span id="faq-icon-${itemKey}" class="w-8 h-8 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center text-amber-500 font-bold transition-all duration-300 flex-shrink-0 group-hover:border-amber-500/50 group-hover:bg-amber-500/10">
          <svg id="faq-svg-${itemKey}" class="w-4 h-4 transform transition-transform duration-300" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </span>
      </button>
      <div id="faq-body-${itemKey}" class="faq-content-wrapper overflow-hidden" style="height: 0px; opacity: 0; display: none;" data-open="false">
        <div class="px-5 pb-5 sm:px-6 sm:pb-6 text-gray-300 text-sm sm:text-base leading-relaxed border-t border-gray-800/60 pt-4">
          <p class="faq-a-text">${answer.text}</p>
          <div class="faq-promo-slot">${answer.promo}</div>
        </div>
      </div>
    `;
    container.appendChild(el);
  });

  setTimeout(() => {
    if (typeof initFaqGsapAnimation === 'function') {
      initFaqGsapAnimation();
    }
    scheduleScrollTriggerRefresh(0);
  }, 50);
}

// --- REVIEWS SECTION ---
// До появления ленты (initReviews) фото аватаров держим вставленными в скрытый
// контейнер: браузер качает их на первом же кадре, вместе со страницей, а не
// когда лента доедет до секции. Карточки получают уже готовые картинки из кэша.
function warmReviewsAvatars() {
  const reviews = CONFIG.reviewsData || [];
  if (!reviews.length) return;

  const holder = document.createElement('div');
  holder.className = 'nr-avatars-preload';
  holder.setAttribute('aria-hidden', 'true');

  const currentDevice = getDeviceType();
  reviews.forEach((review) => {
    const src = resolveDeviceText(review.avatar, currentDevice);
    if (typeof src !== 'string' || !src) return;
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.loading = 'eager';
    img.decoding = 'async';
    holder.appendChild(img);
  });

  document.body.appendChild(holder);
}
warmReviewsAvatars();

function initReviews() {
  renderReviews();
  initReviewSwipe();

  // Фото уже в кэше (warmReviewsAvatars): держать на них loading="lazy"
  // больше незачем — карточка показывает картинку сразу, без доедет-загрузится.
  document.querySelectorAll('#reviews .review-photo').forEach((img) => {
    img.loading = 'eager';
  });
  document.querySelectorAll('.nr-avatars-preload').forEach((el) => el.remove());

  // Метрики текста меняются после загрузки шрифтов — обрезку длинных отзывов
  // («Читать далее…») и высоту карточек считаем заново.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      syncReviewsMore();
      syncReviewCardHeights();
    });
  }
}

// Инициалы — подложка под фото: видны, пока картинка не загрузилась.
function getReviewInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');
}

// Данные одной карточки — по текущему языку и разрешению экрана.
// Английский текст отзыва — перевод, поэтому под ним показывается пометка
// reviews.translated (в русской версии ключ пустой — пометки нет).
function fillReviewCard(card, review) {
  const currentDevice = getDeviceType();
  const text = resolveDeviceText(currentLang === 'ru' ? review.textRu : review.textEn, currentDevice);

  const personEl = card.querySelector('.review-person');
  if (personEl) personEl.setAttribute('href', review.url || '#');

  const photoEl = card.querySelector('.review-photo');
  if (photoEl) {
    // Фото — маленький локальный WebP (image/reviews), грузим сразу вместе со
    // страницей: initReviews() снимает loading="lazy" с уже готовых картинок.
    photoEl.setAttribute('src', resolveDeviceText(review.avatar, currentDevice) || '');
  }

  const initialsEl = card.querySelector('.review-initials');
  if (initialsEl) initialsEl.textContent = getReviewInitials(review.name);

  const nameEl = card.querySelector('.review-name');
  if (nameEl) nameEl.textContent = review.name || '';

  const textEl = card.querySelector('.review-text');
  if (textEl) textEl.textContent = text || '';

  const noteEl = card.querySelector('.review-note');
  if (noteEl) {
    const note = getI18nValue(currentLang, 'reviews.translated') || '';
    noteEl.textContent = note;
    noteEl.hidden = !note;
  }
}

// Отзывы раскладываются в две бегущие ленты (#reviewsRowTop / #reviewsRowBottom):
// чётные — в верхнюю, нечётные — в нижнюю. Каждый ряд строится двумя
// одинаковыми половинами, чтобы лента ехала безразрывно: трек сдвигается ровно
// на половину своей ширины (style.css → @keyframes nrMarqueeLeft / nrMarqueeRight).
function renderReviews() {
  const rows = [
    document.getElementById('reviewsRowTop'),
    document.getElementById('reviewsRowBottom')
  ];
  if (!rows[0] || !rows[1]) return;

  const reviews = CONFIG.reviewsData || [];
  if (!reviews.length) return;

  const groups = [
    reviews.filter((review, index) => index % 2 === 0),
    reviews.filter((review, index) => index % 2 === 1)
  ];

  // In-place update to prevent layout jumps and DOM destruction on language toggle
  const isBuilt = rows.every((row, idx) => row.children.length === groups[idx].length * 2);
  if (isBuilt) {
    rows.forEach((row, idx) => {
      Array.prototype.forEach.call(row.children, (card, index) => {
        fillReviewCard(card, groups[idx][index % groups[idx].length]);
      });
    });
    syncReviewsMore();
    syncReviewCardHeights();
    return;
  }

  rows.forEach((row, idx) => {
    row.innerHTML = '';

    // Вторая половина — копия первой: она делает ленту безразрывной, поэтому
    // уходит из порядка табуляции и из озвучки скринридером.
    [false, true].forEach((isClone) => {
      groups[idx].forEach((review) => {
        const card = document.createElement('article');
        card.className = 'rack-card review-card';
        // Номер отзыва в CONFIG.reviewsData: по нему раскрываются сразу обе
        // карточки отзыва — сама карточка и её копия в ленте.
        card.dataset.review = String(reviews.indexOf(review));
        card.innerHTML = `
          <a class="review-person" target="_blank" rel="noopener noreferrer">
            <span class="review-avatar">
              <span class="review-initials"></span>
              <img class="review-photo" alt="" loading="lazy" decoding="async">
            </span>
            <span class="review-name"></span>
          </a>
          <div class="review-body">
            <p class="review-text"></p>
            <button class="review-more" hidden onclick="toggleReview(this, event)"></button>
            <span class="review-note" hidden></span>
          </div>
        `;

        if (isClone) {
          card.setAttribute('aria-hidden', 'true');
          card.querySelector('.review-person').setAttribute('tabindex', '-1');
          card.querySelector('.review-more').setAttribute('tabindex', '-1');
        }

        row.appendChild(card);
        fillReviewCard(card, review);
      });
    });
  });

  // Подписи «Читать далее…» и общая высота свёрнутых карточек — когда разметка
  // уже собрана: и то и другое считается по факту обрезки текста.
  syncReviewsMore();
  syncReviewCardHeights();
}

// Обрезан ли текст карточки по высоте (style.css → .review-text: max-height)
function isReviewTextClamped(card) {
  const textEl = card.querySelector('.review-text');
  return !!textEl && textEl.scrollHeight > textEl.clientHeight + 1;
}

// Высота, до которой обрезан свёрнутый текст (style.css → .review-text: max-height).
// У раскрытой карточки обрезка снята классом, поэтому нужное значение берём у
// свёрнутой карточки того же ряда: оно вычисленное (1.6em * 6), то есть одинаковое
// для всех и не зависит от длины конкретного отзыва.
// Карточку в движении пропускаем: у неё обрезка задана inline-стилем анимации.
function getReviewClampHeight(card) {
  const track = card.closest('.nr-marquee-track');
  const probes = track ? track.querySelectorAll('.review-card:not(.is-open) .review-text') : [];
  for (const probe of probes) {
    if (probe.style.maxHeight) continue;
    return parseFloat(getComputedStyle(probe).maxHeight) || 0;
  }
  return 0; // все карточки ряда раскрыты или в движении — обрезку взять негде
}

// Общая высота свёрнутой карточки ряда — переменная --nr-review-card-h, которую
// ставит syncReviewCardHeights(). Именно она в style.css держит height свёрнутой
// карточки, поэтому сворачивание должно заканчиваться ровно на этом значении.
function getReviewRowHeight(card) {
  const track = card.closest('.nr-marquee-track');
  if (!track) return 0;
  return parseFloat(getComputedStyle(track).getPropertyValue('--nr-review-card-h')) || 0;
}

// Подпись под текстом. Подпись есть у обрезанного отзыва, а у раскрытой карточки
// она видна всегда («Свернуть») — даже у короткой: сворачивать её тоже нужно.
// isOpen передаётся явно: setReviewOpen меняет класс в конце хода, поэтому на
// время анимации состояние класса ещё старое, а подпись нужна уже целевая.
// Готовый текст подписи — setReviewMoreLabelText(); видимость решает
// setReviewMoreLabel() по конечному состоянию карточки (вызывается в конце хода).
function setReviewMoreLabelText(card, isOpen) {
  const moreEl = card.querySelector('.review-more');
  if (!moreEl) return;
  moreEl.textContent = getI18nValue(currentLang, isOpen ? 'reviews.less' : 'reviews.more') || '';
}

function setReviewMoreLabel(card, isClamped, isOpen) {
  const moreEl = card.querySelector('.review-more');
  if (!moreEl) return;

  const open = typeof isOpen === 'boolean' ? isOpen : card.classList.contains('is-open');
  setReviewMoreLabelText(card, open);
  moreEl.hidden = !open && !isClamped;
}

// Подписи по всем карточкам сразу: сначала измеряем все (одна переклейка
// раскладки), потом пишем подписи — иначе раскладка считалась бы на каждой карточке.
function syncReviewsMore() {
  const cards = document.querySelectorAll('#reviews .review-card');
  const clamped = [];
  cards.forEach((card) => clamped.push(isReviewTextClamped(card)));
  cards.forEach((card, index) => setReviewMoreLabel(card, clamped[index]));
}

// Общая высота свёрнутой карточки для каждого ряда — переменная ряда
// --nr-review-card-h (style.css → .nr-marquee-track / .review-card). Раньше её
// давал align-items: stretch, но тогда раскрытый отзыв растягивал весь ряд;
// теперь карточки не тянутся друг за другом, и высоту нужно задать. Меряем
// только свёрнутые: у раскрытой карточки height: auto.
function syncReviewCardHeights() {
  const tracks = document.querySelectorAll('#reviews .nr-marquee-track');
  if (!tracks.length) return;

  // Замер — на чистой раскладке: снятую переменную иначе намерили бы её же значением
  tracks.forEach((track) => track.style.removeProperty('--nr-review-card-h'));

  const heights = [];
  tracks.forEach((track) => {
    let max = 0;
    track.querySelectorAll('.review-card:not(.is-open)').forEach((card) => {
      const textEl = card.querySelector('.review-text');
      if (!textEl) return;
      // Карточку в движении пропускаем: высота у неё сейчас между раскрытой и
      // свёрнутой (script.js → setReviewOpen вешает .is-animating).
      if (card.classList.contains('is-animating')) return;
      // ceil: высота карточки не должна оказаться на доли пикселя меньше содержимого
      max = Math.max(max, Math.ceil(card.getBoundingClientRect().height));
    });
    heights.push(max);
  });

  tracks.forEach((track, index) => {
    if (heights[index]) track.style.setProperty('--nr-review-card-h', `${heights[index]}px`);
  });
}

// Ход раскрытия и сворачивания отзыва — 1s, вдвое короче прежних 2s / 1.5s
// (медленный ход читался вяло). Кривая sine.inOut общая для обоих направлений и
// для всех движущихся величин (высота карточки, обрезка текста, подпись): плавное
// начало, ускорение в середине пути и плавное торможение в конце. Именно синус, а
// не power2: у power2.out скорость максимальна ровно в нуле, из-за чего раскрытие
// начиналось рывком.
const REVIEW_TOGGLE_DURATION = 1;
const REVIEW_TOGGLE_EASE = 'sine.inOut';

// Раскрывает и сворачивает отзыв: класс .is-open ставит конечное состояние
// (style.css), а ход ведёт GSAP — как у вопроса в FAQ (openFaqItem).
// Едут две синхронные величины: высота карточки и обрезка самого текста
// (maxHeight от высоты обрезки до полной высоты текста). За счёт этого при
// раскрытии нижняя часть текста плавно выезжает из карточки, а при сворачивании
// так же плавно прячется вместе с ней, а не обрезается рывком. Вместе с текстом
// опускается вниз только эта карточка — остальные стоят на общей высоте ряда
// (style.css → .nr-marquee-track: flex-start).
function setReviewOpen(card, willOpen) {
  const textEl = card.querySelector('.review-text');
  if (!textEl) return;

  // Обрезан ли отзыв: по этому у свёрнутой карточки решается, показывать ли
  // подпись «Читать далее…» (у короткого отзыва подписи нет).
  // startTextH — видимая высота текста сейчас, fullH — его полная высота
  // (обрезка по max-height на scrollHeight не влияет).
  const startTextH = textEl.getBoundingClientRect().height;
  const fullH = textEl.scrollHeight;
  const clampH = getReviewClampHeight(card);
  const isClamped = fullH > clampH + 1;

  // Стартовые значения — то, что видно сейчас. Карточка могла остаться с
  // inline-высотой от прерванного хода, поэтому startH берём до её снятия.
  const startH = card.getBoundingClientRect().height;

  const moreEl = card.querySelector('.review-more');
  const moreWasHidden = !!moreEl && moreEl.hidden;

  // Высоту конечного состояния меряем, не показывая его: класс .is-open и
  // снятую обрезку ставим на один синхронный проход и сразу откатываем —
  // браузер успевает пересчитать стили, но не отрисовывает кадр, поэтому
  // раскладка страницы не мигает. Так высота получается ровно та, что даст CSS
  // (height: auto с полным текстом и подписью), а не собранная вручную.
  // Подпись на время замера показываем: у раскрытой карточки «Свернуть» видна
  // всегда, и её строка входит в высоту.
  const prevInlineH = card.style.height;
  const prevInlineMax = textEl.style.maxHeight;
  const wasOpen = card.classList.contains('is-open');
  let openH = 0;
  try {
    if (moreEl) moreEl.hidden = false;
    card.style.height = '';
    textEl.style.maxHeight = '';
    card.classList.add('is-open');
    openH = Math.ceil(card.getBoundingClientRect().height);
  } finally {
    // Откат в finally: если замер почему-то упадёт, карточка всё равно вернётся
    // в исходное состояние, а не останется раскрытой без анимации.
    card.classList.toggle('is-open', wasOpen);
    card.style.height = prevInlineH;
    textEl.style.maxHeight = prevInlineMax;
    if (moreEl) moreEl.hidden = moreWasHidden;
  }

  const rowH = getReviewRowHeight(card);
  const endCardH = willOpen ? openH : Math.ceil(rowH || startH);
  const endTextH = willOpen ? fullH : clampH;

  // Подпись: у раскрытой карточки всегда «Свернуть», у обрезанной свёрнутой —
  // «Читать далее…», у короткой свёрнутой подписи нет. Здесь меняем только текст:
  // скрывать подпись будем по завершении хода, иначе у сворачиваемой карточки
  // она пропала бы в самом начале, а не уехала с нижней частью текста.
  // Видимость при этом снимаем: у раскрываемой карточки короткого отзыва подпись
  // раньше была скрыта, а теперь её нужно показать («Свернуть»).
  setReviewMoreLabelText(card, willOpen);
  if (moreEl) moreEl.hidden = false;

  const gsapReady = typeof gsap !== 'undefined';
  const canAnimate = gsapReady && Math.abs(endCardH - startH) > 1;

  if (!canAnimate) {
    // Двигать нечего: отдаём карточку и текст CSS — класс сразу даёт конечное
    // состояние, а inline-обрезка и высота снимаются. Подпись решаем сразу:
    // хода нет, скрывать её позже некому.
    card.classList.remove('is-animating');
    card.classList.toggle('is-open', willOpen);
    if (gsapReady) gsap.set(card, { clearProps: 'height' });
    else card.style.height = '';
    textEl.style.maxHeight = '';
    setReviewMoreLabel(card, isClamped, willOpen);
    requestAnimationFrame(() => { scheduleScrollTriggerRefresh(0); });
    return;
  }

  // Подпись меняет текст на ходу («Читать далее…» ⇄ «Свернуть») — проявляем её
  // в такт с ходом текста (та же длительность и кривая), а не отдельным
  // мгновенным миганием: у раскрываемой карточки подпись выезжает вместе с
  // нижней частью текста, у сворачиваемой — уходит вместе с ней.
  const moreVisible = moreEl && !moreEl.hidden;
  if (moreVisible) {
    gsap.killTweensOf(moreEl);
    gsap.fromTo(moreEl, { opacity: 0 }, {
      opacity: 1,
      duration: REVIEW_TOGGLE_DURATION,
      ease: REVIEW_TOGGLE_EASE,
      onComplete: () => gsap.set(moreEl, { clearProps: 'opacity' })
    });
  }

  gsap.killTweensOf(card);
  gsap.killTweensOf(textEl);

  // Ключевой момент: класс .is-open задаёт КОНЕЧНОЕ состояние (height: auto и
  // снятую обрезку текста) и на время хода НЕ ставится. Иначе смена класса
  // мгновенно переклеила бы раскладку: трек и .nr-marquee (overflow: hidden)
  // сразу стали бы высокими, и раздел ниже прыгнул бы вниз ещё до первого кадра
  // анимации — а потом «догонял» бы в конце. Поэтому обе величины ведём только
  // inline-стилями, а класс ставим в onComplete.
  // .is-animating включается сразу: он обрезает контент за рамкой карточки.
  card.classList.add('is-animating');
  // Обрезка текста должна ехать, а не сниматься классом: на время хода её
  // держит inline maxHeight от GSAP (перебивает CSS-правило .review-text).
  textEl.style.maxHeight = startTextH + 'px';

  const tween = { duration: REVIEW_TOGGLE_DURATION, ease: REVIEW_TOGGLE_EASE };

  gsap.fromTo(card, { height: startH }, {
    height: endCardH,
    ...tween,
    onComplete: () => {
      // Конечное состояние отдаём CSS: класс даёт height: auto у раскрытой
      // карточки и снятую обрезку текста, а свёрнутую держит высота ряда.
      card.classList.toggle('is-open', willOpen);
      gsap.set(card, { clearProps: 'height' });
      textEl.style.maxHeight = '';
      card.classList.remove('is-animating');
      // Только теперь, когда ход закончен, решаем судьбу подписи: у короткого
      // свёрнутого отзыва она скрывается, у остальных остаётся на месте.
      setReviewMoreLabel(card, isClamped, willOpen);
      requestAnimationFrame(() => { scheduleScrollTriggerRefresh(0); });
    }
  });

  gsap.fromTo(textEl, { maxHeight: startTextH }, { maxHeight: endTextH, ...tween });
}

// Клик по «Читать далее…» раскрывает отзыв целиком, повторный клик — сворачивает.
// Состояние переключается у обеих карточек отзыва: у самой карточки и её копии.
function toggleReview(button, event) {
  const card = button.closest('.review-card');
  if (!card) return;

  const key = card.dataset.review;
  const sameReview = key ? document.querySelectorAll(`#reviews .review-card[data-review="${key}"]`) : [card];
  const willOpen = !card.classList.contains('is-open');
  // Клик с клавиатуры (Enter/Space) приходит без координат — detail === 0
  const byKeyboard = !!event && event.detail === 0;

  sameReview.forEach((item) => setReviewOpen(item, willOpen));

  // Управляли карточкой — снимаем оставшееся выделение: на сенсорных экранах
  // подсветка текста «залипала» после тапа по кнопке.
  clearReviewsSelection();

  // Мышь и палец фокус с кнопки снимают: иначе пауза по :focus-within держала
  // ленту до следующего клика в другом месте. С клавиатуры фокус остаётся —
  // по нему идёт переход по Tab, и лента под фокусом стоит (как и раньше).
  if (!byKeyboard) button.blur();

  // Свёрнутый отзыв прочитан — движение ленты возвращаем сразу, даже если
  // курсор/палец остались на карточке (см. resumeReviewsMarquee). С клавиатуры
  // не трогаем: там пауза держится фокусом.
  if (!willOpen && !byKeyboard) resumeReviewsMarquee(card);

  // Позиции триггеров анимаций пересчитываются по завершении хода высоты —
  // в setReviewOpen (как у вопроса в FAQ). Раньше refresh стоял ещё и здесь,
  // то есть запускался в первых кадрах движения и переклеивал раскладку всей
  // страницы прямо посреди анимации: ход читался резким, с пропуском кадров.
}

// Снимает выделение текста, оставшееся после тапа или долгого нажатия
function clearReviewsSelection() {
  const selection = window.getSelection && window.getSelection();
  if (!selection) return;
  if (selection.removeAllRanges) selection.removeAllRanges();
  else if (selection.empty) selection.empty(); // старый WebKit
}

// Возвращает движение ленте после свёртки отзыва (style.css →
// .nr-marquee-track.nr-resume). Нужно потому, что карточка остаётся под
// курсором/пальцем: на сенсорных экранах браузер держит на ней :hover до
// следующего тапа, а мышь продолжала бы держать обычную паузу. Обычное
// поведение возвращается, как только курсор ушёл с ленты, — или при новом
// касании на сенсорном экране.
function resumeReviewsMarquee(card) {
  const track = card.closest('.nr-marquee-track');
  if (!track) return;

  track.classList.add('nr-resume');

  const drop = (event) => {
    // Тач-указатель «уходит» сразу после пальца, но браузер держит :hover —
    // для него класс снимает только новое касание (pointerdown).
    if (event.type === 'pointerleave' && event.pointerType === 'touch') return;
    track.classList.remove('nr-resume');
    track.removeEventListener('pointerleave', drop);
    track.removeEventListener('pointerdown', drop);
  };

  track.addEventListener('pointerleave', drop);
  track.addEventListener('pointerdown', drop);
}

/* Свайп колонок отзывов на сенсорных экранах: колонку можно тянуть пальцем
   влево-вправо. Лента едет CSS-анимацией (transform), поэтому сдвиг пальцем
   пишем в отдельное свойство translate на треке — оно складывается с анимацией,
   останавливать её не нужно. Сдвиг держим в пределах одного «круга» ленты
   (половины трека): половины одинаковые, поэтому переход через границу
   незаметен. Жест определяем по преобладающей оси, вертикальная прокрутка
   страницы остаётся нативной (touch-action: pan-y в style.css). */
const REVIEW_SWIPE_AXIS_THRESHOLD = 12; // px: отсекает дрожание пальца при тапе
const REVIEW_SWIPE_SHIFT_PROP = (window.CSS && CSS.supports && CSS.supports('translate', '0px'))
  ? 'translate'
  : 'marginLeft';

// Есть сенсорный ввод (телефон, планшет, тач-экран ноутбука)? Свайп колонок
// включаем только для него: там, где есть мышь, колонку ведёт сама лента.
function hasTouchInput() {
  return 'ontouchstart' in window ||
    !!(navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
}

// Сдвиг колонки: translate складывается с анимацией ленты; margin-left — запасной
// путь для браузеров, где отдельных свойств трансформации ещё нет
function setReviewColumnShift(track, shift) {
  if (REVIEW_SWIPE_SHIFT_PROP === 'translate') track.style.translate = shift + 'px 0';
  else track.style.marginLeft = shift + 'px';
}

// Сдвиг в пределах одного «круга» ленты: -span < shift <= 0
function wrapReviewColumnShift(value, span) {
  if (!span) return 0;
  const shift = value % span;
  return shift > 0 ? shift - span : shift;
}

function initReviewSwipe() {
  if (!hasTouchInput()) return;
  // «Уменьшить движение»: колонка прокручивается нативно (style.css) — свой свайп не нужен
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.querySelectorAll('#reviews .nr-marquee').forEach((marquee) => {
    const track = marquee.querySelector('.nr-marquee-track');
    if (!track) return;

    marquee.classList.add('nr-swipeable'); // touch-action: pan-y (style.css)

    let span = 0;       // половина трека = один «круг» ленты
    let shift = 0;      // накопленный сдвиг колонки
    let dragShift = 0;  // сдвиг на момент распознавания жеста
    let startX = 0;
    let startY = 0;
    let lastDx = 0;
    let axis = null;    // 'x' | 'y' | null (ещё не определена)
    let swiped = false; // только что был жест — следующий клик гасим

    // Клик, который браузер шлёт после жеста, не должен нажимать «Читать далее…»
    // или открывать страницу автора
    marquee.addEventListener('click', (event) => {
      if (!swiped) return;
      swiped = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    marquee.addEventListener('touchstart', (event) => {
      const touch = event.changedTouches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      lastDx = 0;
      axis = null;
      span = track.scrollWidth / 2; // копии ленты одинаковые: половина — «круг»
    }, { passive: true });

    marquee.addEventListener('touchmove', (event) => {
      if (!span || axis === 'y') return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      // Ось жеста определяем один раз по первым сантиметрам движения
      if (axis === null) {
        if (Math.abs(dx) < REVIEW_SWIPE_AXIS_THRESHOLD &&
            Math.abs(dy) < REVIEW_SWIPE_AXIS_THRESHOLD) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        dragShift = shift;
        if (axis !== 'x') return;
      }

      lastDx = dx;
      setReviewColumnShift(track, wrapReviewColumnShift(dragShift + dx, span));
    }, { passive: true });

    // Палец ушёл: запоминаем, где оставили колонку, и гасим клик после жеста
    const finishSwipe = () => {
      if (axis === 'x') {
        shift = wrapReviewColumnShift(dragShift + lastDx, span);
        swiped = true;
        setTimeout(() => { swiped = false; }, 400);
      }
      axis = null;
      lastDx = 0;
    };

    marquee.addEventListener('touchend', finishSwipe, { passive: true });
    marquee.addEventListener('touchcancel', finishSwipe, { passive: true });
  });
}

function toggleFaq(id) {
  const currentBody = document.getElementById(`faq-body-${id}`);
  if (!currentBody) return;

  const isAlreadyOpen = currentBody.getAttribute('data-open') === 'true';

  document.querySelectorAll('[id^="faq-body-"]').forEach(otherBody => {
    if (otherBody !== currentBody && otherBody.getAttribute('data-open') === 'true') {
      const otherId = otherBody.id.replace('faq-body-', '');
      closeFaqItem(otherId);
    }
  });

  if (!isAlreadyOpen) {
    openFaqItem(id);
  } else {
    closeFaqItem(id);
  }
}

function openFaqItem(id) {
  const body = document.getElementById(`faq-body-${id}`);
  const svg = document.getElementById(`faq-svg-${id}`);
  const icon = document.getElementById(`faq-icon-${id}`);
  const card = body?.parentElement;
  const btn = card?.querySelector('button');

  if (!body) return;

  body.setAttribute('data-open', 'true');
  if (btn) btn.setAttribute('aria-expanded', 'true');
  if (card) {
    card.classList.add('border-amber-500/50', 'bg-[#121622]');
  }

  if (svg) {
    svg.style.transform = 'rotate(45deg)';
  }
  if (icon) {
    icon.classList.add('bg-amber-500', 'text-slate-950', 'border-amber-400', 'shadow-md', 'shadow-amber-500/20');
    icon.classList.remove('bg-gray-900', 'text-amber-500', 'border-gray-800');
  }

  body.style.display = 'block';
  body.style.height = 'auto';
  const targetHeight = Math.ceil(body.scrollHeight || body.offsetHeight);
  body.style.height = '0px';

  if (typeof gsap !== 'undefined') {
    gsap.killTweensOf(body);
    gsap.fromTo(body,
      { height: 0, opacity: 0 },
      {
        height: targetHeight,
        opacity: 1,
        duration: 0.45,
        ease: 'power3.out',
        onComplete: () => {
          body.style.height = 'auto';
          requestAnimationFrame(() => {
            scheduleScrollTriggerRefresh(0);
          });
        }
      }
    );
  } else {
    body.style.height = 'auto';
    body.style.opacity = '1';
    requestAnimationFrame(() => {
      scheduleScrollTriggerRefresh(0);
    });
  }
}

function closeFaqItem(id) {
  const body = document.getElementById(`faq-body-${id}`);
  const svg = document.getElementById(`faq-svg-${id}`);
  const icon = document.getElementById(`faq-icon-${id}`);
  const card = body?.parentElement;
  const btn = card?.querySelector('button');

  if (!body) return;

  body.setAttribute('data-open', 'false');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  if (card) {
    card.classList.remove('border-amber-500/50', 'bg-[#121622]');
  }

  if (svg) {
    svg.style.transform = 'rotate(0deg)';
  }
  if (icon) {
    icon.classList.remove('bg-amber-500', 'text-slate-950', 'border-amber-400', 'shadow-md', 'shadow-amber-500/20');
    icon.classList.add('bg-gray-900', 'text-amber-500', 'border-gray-800');
  }

  if (typeof gsap !== 'undefined') {
    gsap.killTweensOf(body);
    gsap.to(body, {
      height: 0,
      opacity: 0,
      duration: 0.35,
      ease: 'power3.inOut',
      onComplete: () => {
        body.style.display = 'none';
        body.style.height = '0px';
        requestAnimationFrame(() => {
          scheduleScrollTriggerRefresh(0);
        });
      }
    });
  } else {
    body.style.height = '0px';
    body.style.opacity = '0';
    body.style.display = 'none';
    requestAnimationFrame(() => {
      scheduleScrollTriggerRefresh(0);
    });
  }
}

// --- MODAL SCROLL LOCK SYSTEM ---
let isPageScrollLocked = false;

function lockPageScroll() {
  if (isPageScrollLocked) return;
  isPageScrollLocked = true;

  // Prevent scrollbar layout shift on desktop without altering document scroll position
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    const header = document.querySelector('header');
    if (header) header.style.paddingRight = `${scrollbarWidth}px`;
  }

  document.documentElement.classList.add('modal-open');
  document.body.classList.add('modal-open');
}

function unlockPageScroll() {
  const contactActive = document.getElementById('contactModal')?.classList.contains('active');
  const aboutActive = document.getElementById('aboutModal')?.classList.contains('active');
  const calcActive = document.getElementById('priceCalcModal')?.classList.contains('active');
  if (contactActive || aboutActive || calcActive) return;

  if (!isPageScrollLocked) return;
  isPageScrollLocked = false;

  document.documentElement.classList.remove('modal-open');
  document.body.classList.remove('modal-open');
  document.body.style.paddingRight = '';
  const header = document.querySelector('header');
  if (header) header.style.paddingRight = '';
}

// --- MODAL & TOAST HANDLERS ---
function initModalAndToast() {
  const contactModal = document.getElementById('contactModal');
  if (contactModal) {
    contactModal.addEventListener('click', (e) => {
      if (e.target === contactModal) closeContactModal();
    });
  }

  const aboutModal = document.getElementById('aboutModal');
  if (aboutModal) {
    aboutModal.addEventListener('click', (e) => {
      if (e.target === aboutModal) closeAboutModal();
    });
  }

  // Окно-калькулятор стоимости услуг: закрытие по клику на затемнение
  const priceCalcModal = document.getElementById('priceCalcModal');
  if (priceCalcModal) {
    priceCalcModal.addEventListener('click', (e) => {
      if (e.target === priceCalcModal) closePriceCalcModal();
    });
  }

  // Prevent scroll propagation from backdrop area
  [contactModal, aboutModal, priceCalcModal].forEach(modalEl => {
    if (!modalEl) return;
    modalEl.addEventListener('wheel', (e) => {
      const content = modalEl.querySelector('.modal-content');
      if (!content || !content.contains(e.target)) {
        e.preventDefault();
      }
    }, { passive: false });

    modalEl.addEventListener('touchmove', (e) => {
      const content = modalEl.querySelector('.modal-content');
      if (!content || !content.contains(e.target)) {
        e.preventDefault();
      }
    }, { passive: false });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeContactModal();
      closeAboutModal();
      closePriceCalcModal();
    }
  });
}

function openContactModal() {
  closeMobileMenu();
  const modal = document.getElementById('contactModal');
  if (modal) {
    modal.classList.add('active');
    lockPageScroll();
  }
}

function closeContactModal() {
  const modal = document.getElementById('contactModal');
  if (modal && modal.classList.contains('active')) {
    modal.classList.remove('active');
    unlockPageScroll();
  }
}

function openAboutModal() {
  closeMobileMenu();
  const modal = document.getElementById('aboutModal');
  if (modal) {
    modal.classList.add('active');
    lockPageScroll();
  }
}

function closeAboutModal() {
  const modal = document.getElementById('aboutModal');
  if (modal && modal.classList.contains('active')) {
    modal.classList.remove('active');
    unlockPageScroll();
  }
}

// --- SERVICE COST CALCULATOR (окно «Рассчитать стоимость услуг») ---
// Шаги: 0 — предупреждение, 1 — длительность, 2..5 — вопросы Да/Нет, 6 — итог.
const CALC_LAST_STEP = 6;
const CALC_TOTAL_STEPS = CALC_LAST_STEP + 1;
let calcStep = 0;
const calcAnswers = { mastering: null, vocalRhythm: null, trackout: null, vocalNotes: null };

function getCalcConfig() {
  return (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.priceCalc) ? CONFIG.priceCalc : null;
}

function getCalcI18n() {
  const t = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.i18n) ? CONFIG.i18n[currentLang] : null;
  return (t && t.services && t.services.priceCalc) ? t.services.priceCalc : null;
}

function getCalcDurationEntry() {
  const cfg = getCalcConfig();
  if (!cfg || !Array.isArray(cfg.durations)) return null;
  const range = document.getElementById('calcDurationRange');
  const value = range ? parseInt(range.value, 10) : (cfg.defaultMinutes || 3);
  return cfg.durations.find(d => d.minutes === value) || cfg.durations[0] || null;
}

// Цена: RU — «3 500 ₽», EN — «$110».
function formatCalcPrice(value, lang) {
  if (value === null || value === undefined || isNaN(value)) return '';
  if (lang === 'ru') {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽';
  }
  return '$' + value;
}

function openPriceCalcModal() {
  if (typeof closeMobileMenu === 'function') closeMobileMenu();
  const modal = document.getElementById('priceCalcModal');
  if (!modal) return;
  resetPriceCalc();
  modal.classList.add('active');
  // Первый шаг мягко проявляется вместе с открытием окна
  restartCalcStepEntrance();
  lockPageScroll();
}

function closePriceCalcModal() {
  const modal = document.getElementById('priceCalcModal');
  if (modal && modal.classList.contains('active')) {
    modal.classList.remove('active');
    // Отменяем запланированный авто-переход и незавершённые переходы шагов,
    // снимаем «замороженную» высоту окна.
    cancelCalcAutoAdvance();
    calcStepAnimId++;
    cancelCalcStepFade();
    resetCalcModalBox();
    unlockPageScroll();
  }
}

function resetPriceCalc(animate = false) {
  cancelCalcAutoAdvance();
  Object.keys(calcAnswers).forEach(key => { calcAnswers[key] = null; });
  const cfg = getCalcConfig();
  const range = document.getElementById('calcDurationRange');
  if (range && cfg && cfg.defaultMinutes) range.value = String(cfg.defaultMinutes);

  if (animate) {
    // Шаг 6 → шаг 0 проходит плавно: calcStep меняет goToCalcStepAnimated
    goToCalcStepAnimated(0);
    return;
  }

  calcStep = 0;
  cancelCalcStepFade();
  resetCalcModalBox();
  renderPriceCalcStep();
}

// Шаги 0..1 всегда «отвечены» (предупреждение и ползунок со значением по умолчанию).
function isCalcStepAnswered(step) {
  if (step <= 1) return true;
  const cfg = getCalcConfig();
  if (!cfg || !Array.isArray(cfg.options)) return true;
  const option = cfg.options[step - 2];
  if (!option) return true;
  const answer = calcAnswers[option.id];
  return answer !== null && answer !== undefined;
}

function goToCalcStep(step) {
  calcStep = Math.max(0, Math.min(CALC_LAST_STEP, step));
  renderPriceCalcStep();
}

// ── Плавная смена шага: окно не должно «прыгать» по высоте ────────────────
// Уходящий шаг мягко растворяется, содержимое подменяется под «замороженной»
// высотой, а затем окно плавно перетекает в новую высоту (GSAP).
const CALC_STEP_FADE_MS = 340;    // затухание уходящего шага
const CALC_STEP_RESIZE_MS = 820;  // перетекание высоты окна
let calcStepFadeTween = null;     // tween затухания уходящего шага
let calcStepFadeEl = null;        // шаг, который сейчас растворяется
let calcStepSizeTween = null;     // tween высоты окна при смене шага
let calcHeightTween = null;       // tween высоты окна при смене контента (без смены шага)
let calcReceiptTween = null;      // каскад строк сметы на последнем шаге
let calcDurationValueTween = null;// «пружинка» цифры хронометража
let calcHeightLock = false;       // true, пока высотой управляет смена шага
let calcStepSwitching = false;    // true, пока окно перетекает в новый размер
let calcStepAnimId = 0;           // защита от гонок при быстрых кликах
let calcFadeWatchdog = null;      // таймер-страховка на затухание шага
let calcSizeWatchdog = null;      // таймер-страховка на перетекание высоты

function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Снимает «замороженную» из JS высоту окна и останавливает активный tween.
function resetCalcModalBox() {
  const modal = document.getElementById('priceCalcModal');
  const box = modal ? modal.querySelector('.modal-content') : null;
  if (!box) return null;
  if (calcStepSizeTween) { calcStepSizeTween.kill(); calcStepSizeTween = null; }
  if (calcHeightTween) { calcHeightTween.kill(); calcHeightTween = null; }
  if (calcFadeWatchdog) { clearTimeout(calcFadeWatchdog); calcFadeWatchdog = null; }
  if (calcSizeWatchdog) { clearTimeout(calcSizeWatchdog); calcSizeWatchdog = null; }
  box.style.height = '';
  box.style.overflow = '';
  box.classList.remove('is-calc-switching');
  calcStepSwitching = false;
  return box;
}

// Перезапуск CSS-анимации появления активного шага (после открытия окна или сброса).
function restartCalcStepEntrance() {
  const modal = document.getElementById('priceCalcModal');
  if (!modal) return;
  const el = modal.querySelector(`.nr-calc-step[data-calc-step="${calcStep}"]`);
  if (!el) return;
  el.classList.remove('is-active');
  void el.offsetWidth;   // принудительный reflow — иначе анимация не перезапустится
  el.classList.add('is-active');
}

function cancelCalcStepFade() {
  if (calcFadeWatchdog) { clearTimeout(calcFadeWatchdog); calcFadeWatchdog = null; }
  if (calcStepFadeTween) { calcStepFadeTween.kill(); calcStepFadeTween = null; }
  if (calcStepFadeEl && typeof gsap !== 'undefined') {
    gsap.set(calcStepFadeEl, { clearProps: 'opacity,transform' });
  }
  calcStepFadeEl = null;
}

function goToCalcStepAnimated(step) {
  const modal = document.getElementById('priceCalcModal');
  const box = modal ? modal.querySelector('.modal-content') : null;
  const target = Math.max(0, Math.min(CALC_LAST_STEP, step));

  // Фолбэк: окно закрыто, шаг тот же, GSAP недоступен или просят меньше движения
  if (!box || !modal.classList.contains('active') || target === calcStep ||
      typeof gsap === 'undefined' || prefersReducedMotion()) {
    box && box.classList.remove('is-calc-switching');
    calcStepSwitching = false;
    goToCalcStep(target);
    return;
  }

  const animId = ++calcStepAnimId;
  cancelCalcStepFade();

  // Навигация на время перехода неактивна: окно ещё перетекает, а быстрые
  // повторные нажатия иначе пролистывали бы вопросы.
  calcStepSwitching = true;
  box.classList.add('is-calc-switching');

  // Прерванный переход не должен оставить окно с «прилипшей» высотой:
  // запоминаем то, что видно сейчас, и снимаем inline-фиксацию до анимации.
  const visibleHeight = box.offsetHeight;
  if (calcStepSizeTween) { calcStepSizeTween.kill(); calcStepSizeTween = null; }
  if (calcHeightTween) { calcHeightTween.kill(); calcHeightTween = null; }
  box.style.height = '';
  box.style.overflow = '';

  const activeStep = modal.querySelector('.nr-calc-step.is-active');

  const runSwitch = () => {
    if (animId !== calcStepAnimId) return;

    // Замораживаем текущую высоту, чтобы подмена содержимого не дала рывка
    const fromHeight = visibleHeight || box.offsetHeight;
    box.style.overflow = 'hidden';
    box.style.height = fromHeight + 'px';

    // На время рендера шага высотой управляем только мы: иначе отрисовка шага
    // (например, предупреждение «индивидуально») запустила бы второй tween высоты.
    calcHeightLock = true;
    goToCalcStep(target);
    calcHeightLock = false;

    const maxHeight = Math.max(200, Math.round(window.innerHeight * 0.9));
    // natural меряем через offsetHeight (scrollHeight не учитывает рамку окна),
    // сняв фиксацию высоты ровно на один кадр чтения — без визуального скачка.
    box.style.height = '';
    const naturalHeight = box.offsetHeight;
    box.style.height = fromHeight + 'px';
    const toHeight = Math.min(Math.max(naturalHeight, 1), maxHeight);

    // Доводка высоты выполняется ровно один раз — либо по завершении tween, либо
    // по страховочному таймеру (что случится раньше).
    let sizeSettled = false;
    const finishSize = () => {
      if (calcSizeWatchdog) { clearTimeout(calcSizeWatchdog); calcSizeWatchdog = null; }
      if (sizeSettled) return;
      sizeSettled = true;
      calcStepSizeTween = null;
      if (animId !== calcStepAnimId) return;
      settleCalcModalHeight(box, fromHeight);
    };

    calcStepSizeTween = gsap.to(box, {
      height: toHeight,
      duration: CALC_STEP_RESIZE_MS / 1000,
      ease: 'power3.inOut',
      overwrite: 'auto',
      onComplete: finishSize
    });

    // Страховка: если кадры GSAP притормозили (фоновая вкладка, загрузка), окно
    // всё равно доводится до естественной высоты — без «залипания» на полпути.
    calcSizeWatchdog = setTimeout(finishSize, CALC_STEP_RESIZE_MS + 300);

    // Если окно было прокручено — мягко возвращаем содержимое к началу
    // (ScrollToPlugin умеет плавно менять scrollTop, обычная строка не умеет)
    if (box.scrollTop > 0) {
      if (typeof ScrollToPlugin !== 'undefined') {
        gsap.to(box, {
          scrollTo: { y: 0, autoKill: false },
          duration: (CALC_STEP_RESIZE_MS * 0.7) / 1000,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      } else {
        box.scrollTop = 0;
      }
    }
  };

  if (activeStep) {
    calcStepFadeEl = activeStep;

    // Подмена шага выполняется ровно один раз: по завершении затухания или по
    // страховочному таймеру (если кадры GSAP притормозили).
    let switched = false;
    const doSwitch = () => {
      if (calcFadeWatchdog) { clearTimeout(calcFadeWatchdog); calcFadeWatchdog = null; }
      if (switched) return;
      switched = true;
      calcStepFadeTween = null;
      if (calcStepFadeEl && typeof gsap !== 'undefined') {
        gsap.set(calcStepFadeEl, { clearProps: 'opacity,transform' });
      }
      calcStepFadeEl = null;
      runSwitch();
    };

    calcStepFadeTween = gsap.to(activeStep, {
      opacity: 0,
      y: -10,
      duration: CALC_STEP_FADE_MS / 1000,
      ease: 'power2.in',
      overwrite: 'auto',
      onComplete: doSwitch
    });
    calcFadeWatchdog = setTimeout(doSwitch, CALC_STEP_FADE_MS + 260);
  } else {
    runSwitch();
  }
}

// Финальная доводка высоты окна. Содержимое могло измениться, пока шла анимация
// смены шага (например, пользователь двинул ползунок длительности): вместо рывка
// отдаём окно обратно в height:auto и, если разница существенная, доезжаем плавно.
function settleCalcModalHeight(box, fromHeight) {
  const pinned = box.offsetHeight;
  box.style.height = '';
  box.style.overflow = '';
  const natural = box.offsetHeight;
  // Окно доехало до своего размера — навигацию можно вернуть
  box.classList.remove('is-calc-switching');
  calcStepSwitching = false;

  if (Math.abs(natural - pinned) < 1) return;

  box.style.overflow = 'hidden';
  box.style.height = `${Math.max(pinned, fromHeight)}px`;
  calcStepSizeTween = gsap.to(box, {
    height: natural,
    duration: 0.5,
    ease: 'power3.inOut',
    overwrite: 'auto',
    onComplete: () => {
      box.style.height = '';
      box.style.overflow = '';
      calcStepSizeTween = null;
    }
  });
}

// Плавное «дыхание» окна, когда высота меняется без смены шага
// (например, на шаге с хронометражом появилось предупреждение «индивидуально»).
function animateCalcModalHeight(duration = 0.62) {
  const modal = document.getElementById('priceCalcModal');
  const box = modal ? modal.querySelector('.modal-content') : null;
  if (!box || !modal.classList.contains('active') ||
      typeof gsap === 'undefined' || prefersReducedMotion()) {
    return;
  }
  // Высотой уже распоряжается смена шага — не вмешиваемся (после неё доведёт
  // settleCalcModalHeight), плюс защита от вызова изнутри рендера шага.
  if (calcHeightLock || calcStepSizeTween) return;

  if (calcHeightTween) { calcHeightTween.kill(); calcHeightTween = null; }

  const fromHeight = box.offsetHeight;
  // Целевую высоту меряем со снятой inline-фиксацией, иначе она была бы занижена
  box.style.height = '';
  box.style.overflow = '';
  const maxHeight = Math.max(200, Math.round(window.innerHeight * 0.9));
  const toHeight = Math.min(Math.max(box.offsetHeight, 1), maxHeight);

  // Разница меньше пары пикселей — анимировать нечего
  if (Math.abs(toHeight - fromHeight) < 2) return;

  box.style.overflow = 'hidden';
  box.style.height = fromHeight + 'px';

  calcHeightTween = gsap.to(box, {
    height: toHeight,
    duration: duration,
    ease: 'power3.inOut',
    overwrite: 'auto',
    onComplete: () => {
      box.style.height = '';
      box.style.overflow = '';
      calcHeightTween = null;
    }
  });
}

// Смета на последнем шаге появляется каскадом: строки одна за другой, итог — последним.
function playCalcReceiptCascade() {
  if (typeof gsap === 'undefined' || prefersReducedMotion()) return;

  const receipt = document.getElementById('calcReceipt');
  const individual = document.getElementById('calcIndividualResult');
  let targets = [];

  if (receipt && !receipt.classList.contains('hidden')) {
    targets = Array.from(receipt.querySelectorAll('#calcBreakdown .nr-calc-row'));
    const totalRow = receipt.querySelector('.nr-calc-total-row');
    if (totalRow) targets.push(totalRow);
  } else if (individual && !individual.classList.contains('hidden')) {
    targets = [individual];
  }

  if (!targets.length) return;
  if (calcReceiptTween) { calcReceiptTween.kill(); calcReceiptTween = null; }

  calcReceiptTween = gsap.fromTo(targets,
    { opacity: 0, y: 14 },
    {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: 'power3.out',
      stagger: 0.09,
      delay: 0.12,
      overwrite: 'auto',
      clearProps: 'opacity,transform',
      onComplete: () => { calcReceiptTween = null; }
    }
  );
}

// ── Авто-переход на вопросах Да/Нет ───────────────────────────────────────
// Кнопки «Далее» на этих шагах нет: выбранный ответ сам ведёт к следующему
// вопросу (небольшая пауза, чтобы выбор был виден). Если окно в этот момент
// ещё перетекает по высоте, пробуем снова, пока переход не пройдёт.
const CALC_AUTO_ADVANCE_MS = 340;
let calcAutoAdvanceTimer = null;

function cancelCalcAutoAdvance() {
  if (calcAutoAdvanceTimer) { clearTimeout(calcAutoAdvanceTimer); calcAutoAdvanceTimer = null; }
}

function scheduleCalcAutoAdvance() {
  cancelCalcAutoAdvance();
  // Шаги 2..5 — вопросы Да/Нет; шаги 0, 1 и итог работают как раньше.
  if (calcStep < 2 || calcStep >= CALC_LAST_STEP) return;

  let waited = 0;
  const attempt = () => {
    calcAutoAdvanceTimer = setTimeout(() => {
      calcAutoAdvanceTimer = null;
      if (calcStep < 2 || calcStep >= CALC_LAST_STEP) return;
      if (calcStepSwitching) {
        if (waited < 2000) { waited += 130; attempt(); }
        return;
      }
      nextCalcStep();
    }, waited === 0 ? CALC_AUTO_ADVANCE_MS : 130);
  };
  attempt();
}

function nextCalcStep() {
  if (calcStepSwitching) return;   // окно ещё перетекает — не пролистываем
  if (calcStep >= CALC_LAST_STEP) return;
  if (!isCalcStepAnswered(calcStep)) return;
  goToCalcStepAnimated(calcStep + 1);
}

function prevCalcStep() {
  if (calcStepSwitching) return;
  if (calcStep <= 0) return;
  // «Назад» отменяет запланированный авто-переход (иначе шаг ускачет вперёд).
  cancelCalcAutoAdvance();
  goToCalcStepAnimated(calcStep - 1);
}

function onCalcDurationInput(value) {
  const range = document.getElementById('calcDurationRange');
  if (range) range.value = value;
  renderPriceCalcDuration();
  // Смета пересчитывается сразу: пока окно «дышит» по высоте, данные уже актуальны
  renderPriceCalcSummary();
}

function setCalcAnswer(optionId, value) {
  if (!(optionId in calcAnswers)) return;
  calcAnswers[optionId] = value;
  renderPriceCalcStep();
  // Ответ выбран — сразу переходим к следующему вопросу.
  scheduleCalcAutoAdvance();
}

// Перерисовка видимого шага: навигация и смена языка.
function renderPriceCalcStep() {
  const modal = document.getElementById('priceCalcModal');
  if (!modal) return;

  modal.querySelectorAll('.nr-calc-step').forEach(el => {
    const idx = parseInt(el.getAttribute('data-calc-step'), 10);
    el.classList.toggle('is-active', idx === calcStep);
  });

  const backBtn = document.getElementById('calcBackBtn');
  if (backBtn) backBtn.classList.toggle('is-visible', calcStep > 0);

  const fill = document.getElementById('calcProgressFill');
  if (fill) fill.style.width = Math.round((calcStep / CALC_LAST_STEP) * 100) + '%';

  const nowEl = document.getElementById('calcStepNow');
  if (nowEl) nowEl.textContent = String(calcStep + 1);
  const totalEl = document.getElementById('calcStepTotal');
  if (totalEl) totalEl.textContent = String(CALC_TOTAL_STEPS);

  renderPriceCalcDuration();
  renderPriceCalcChoices();
  renderPriceCalcSummary();

  // Смета на последнем шаге выстраивается каскадом: строки → итог
  if (calcStep === CALC_LAST_STEP) playCalcReceiptCascade();
}

function renderPriceCalcDuration() {
  const cfg = getCalcConfig();
  const t = getCalcI18n();
  if (!cfg || !t) return;

  const entry = getCalcDurationEntry();
  if (!entry) return;

  const valueEl = document.getElementById('calcDurationValue');
  if (valueEl && valueEl.textContent !== entry.label) {
    valueEl.textContent = entry.label;
    // Деликатная «пружинка» цифры: смена хронометража не выглядит резкой.
    // Свойство одно (scale), поэтому быстрое перетаскивание ползунка безопасно.
    if (typeof gsap !== 'undefined' && !prefersReducedMotion()) {
      if (calcDurationValueTween) calcDurationValueTween.kill();
      calcDurationValueTween = gsap.fromTo(valueEl, { scale: 1.14 }, {
        scale: 1,
        duration: 0.6,
        ease: 'power3.out',
        overwrite: 'auto',
        clearProps: 'transform',
        onComplete: () => { calcDurationValueTween = null; }
      });
    }
  }

  // Заполненная янтарная часть дорожки ползунка (--calc-fill читает style.css)
  const rangeEl = document.getElementById('calcDurationRange');
  if (rangeEl) {
    const min = parseInt(rangeEl.min, 10) || 1;
    const max = parseInt(rangeEl.max, 10) || (min + 1);
    const pct = max > min ? ((entry.minutes - min) / (max - min)) * 100 : 100;
    rangeEl.style.setProperty('--calc-fill', pct + '%');
  }

  const scale = document.getElementById('calcDurationScale');
  if (scale) {
    // Разметку шкалы строим один раз (пересобираем только при смене языка/набора
    // делений), а подсветку просто переключаем — тогда она перетекает плавно.
    const signature = cfg.durations.map(d => d.minutes).join(',') + '|' + t.durationMin;
    if (scale.dataset.signature !== signature) {
      scale.dataset.signature = signature;
      scale.innerHTML = cfg.durations.map(d =>
        `<span class="nr-calc-scale-item" data-minutes="${d.minutes}">${d.label} ${t.durationMin}</span>`
      ).join('');
    }
    Array.from(scale.children).forEach(el => {
      el.classList.toggle('is-active', el.getAttribute('data-minutes') === String(entry.minutes));
    });
  }

  // Предупреждение для хронометража, который считается индивидуально (1 мин и 6+ мин).
  // Его появление/скрытие меняет высоту окна — перетекаем плавно.
  const note = document.getElementById('calcIndividualNote');
  if (note) {
    const shouldShow = !!entry.individual;
    const wasHidden = note.classList.contains('hidden');
    note.classList.toggle('hidden', !shouldShow);
    // wasHidden === shouldShow — значит видимость реально изменилась
    if (wasHidden === shouldShow) animateCalcModalHeight();
  }
}

function renderPriceCalcChoices() {
  const modal = document.getElementById('priceCalcModal');
  if (!modal) return;

  modal.querySelectorAll('.nr-calc-choice').forEach(group => {
    const optionId = group.getAttribute('data-calc-option');
    const answer = calcAnswers[optionId];
    group.querySelectorAll('.nr-calc-choice-btn').forEach(btn => {
      const isYes = btn.getAttribute('data-value') === 'yes';
      btn.classList.toggle('is-selected', (answer !== null && answer !== undefined) && answer === isYes);
    });
  });

  const activeStepEl = modal.querySelector(`.nr-calc-step[data-calc-step="${calcStep}"]`);
  if (activeStepEl) {
    const nextBtn = activeStepEl.querySelector('.nr-calc-next-btn');
    if (nextBtn) nextBtn.disabled = !isCalcStepAnswered(calcStep);
  }
}

// Итог считается всегда, но показывается только на последнем шаге.
function calculatePriceCalcTotal() {
  const cfg = getCalcConfig();
  const entry = getCalcDurationEntry();
  if (!cfg || !entry) return null;

  const priceKey = currentLang === 'ru' ? 'priceRu' : 'priceEn';

  if (entry.individual) {
    return { individual: true, durationEntry: entry, options: [] };
  }

  const chosen = [];
  let total = entry[priceKey] || 0;
  (cfg.options || []).forEach(option => {
    if (calcAnswers[option.id] === true) {
      chosen.push(option);
      total += option[priceKey] || 0;
    }
  });

  return { individual: false, durationEntry: entry, options: chosen, total: total };
}

function renderPriceCalcSummary() {
  const t = getCalcI18n();
  const result = calculatePriceCalcTotal();
  if (!t || !result) return;

  const receipt = document.getElementById('calcReceipt');
  const breakdown = document.getElementById('calcBreakdown');
  const totalEl = document.getElementById('calcTotalPrice');
  const individualEl = document.getElementById('calcIndividualResult');
  const priceKey = currentLang === 'ru' ? 'priceRu' : 'priceEn';

  // 1 мин и 6+ мин — стоимость обсуждается индивидуально, сумму не показываем.
  if (result.individual) {
    if (receipt) receipt.classList.add('hidden');
    if (individualEl) individualEl.classList.remove('hidden');
    return;
  }

  if (receipt) receipt.classList.remove('hidden');
  if (individualEl) individualEl.classList.add('hidden');

  if (breakdown) {
    const rows = [];
    rows.push(
      `<div class="nr-calc-row">` +
        `<span class="nr-calc-row-label">${t.durationRow}: ${result.durationEntry.label} ${t.durationMin}</span>` +
        `<span class="nr-calc-row-price">${formatCalcPrice(result.durationEntry[priceKey], currentLang)}</span>` +
      `</div>`
    );

    result.options.forEach(option => {
      // 'mastering' → 'optMastering' и т.д.
      const labelKey = 'opt' + option.id.charAt(0).toUpperCase() + option.id.slice(1);
      rows.push(
        `<div class="nr-calc-row">` +
          `<span class="nr-calc-row-label">${t[labelKey] || option.id}</span>` +
          `<span class="nr-calc-row-price nr-calc-row-plus">+${formatCalcPrice(option[priceKey], currentLang)}</span>` +
        `</div>`
      );
    });

    breakdown.innerHTML = rows.join('');
  }

  if (totalEl) totalEl.textContent = formatCalcPrice(result.total, currentLang);
}

// --- MOBILE MENU ---
let mobileMenuCloseTimer = null;

function toggleMobileMenu() {
  const drawer = document.getElementById('mobileMenuDrawer');
  if (!drawer) return;

  if (drawer.classList.contains('is-open')) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
}

function openMobileMenu() {
  const drawer = document.getElementById('mobileMenuDrawer');
  const overlay = document.getElementById('mobileMenuOverlay');
  const hamIcon = document.getElementById('hamburgerIcon');
  const closeIcon = document.getElementById('closeMenuIcon');
  const header = document.getElementById('mainHeader');
  if (!drawer) return;

  if (mobileMenuCloseTimer) {
    clearTimeout(mobileMenuCloseTimer);
    mobileMenuCloseTimer = null;
  }

  if (header) header.classList.add('mobile-menu-active');
  drawer.classList.add('is-open');
  if (overlay) overlay.classList.add('is-open');
  // Блокируем скролл страницы под открытым меню (см. initMobileMenuScrollLock)
  document.documentElement.classList.add('nr-menu-open');
  document.body.classList.add('nr-menu-open');

  if (hamIcon) {
    hamIcon.classList.add('scale-50', 'opacity-0', '-rotate-90');
  }
  if (closeIcon) {
    closeIcon.classList.remove('hidden', 'scale-50', 'opacity-0', 'rotate-90');
    closeIcon.classList.add('scale-100', 'opacity-100', 'rotate-0');
  }
}

function closeMobileMenu() {
  const drawer = document.getElementById('mobileMenuDrawer');
  const overlay = document.getElementById('mobileMenuOverlay');
  const hamIcon = document.getElementById('hamburgerIcon');
  const closeIcon = document.getElementById('closeMenuIcon');
  const header = document.getElementById('mainHeader');
  if (!drawer) return;

  if (mobileMenuCloseTimer) {
    clearTimeout(mobileMenuCloseTimer);
    mobileMenuCloseTimer = null;
  }

  drawer.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-open');
  // Снимаем блокировку скролла страницы
  document.documentElement.classList.remove('nr-menu-open');
  document.body.classList.remove('nr-menu-open');

  if (hamIcon) {
    hamIcon.classList.remove('scale-50', 'opacity-0', '-rotate-90');
  }
  if (closeIcon) {
    closeIcon.classList.remove('scale-100', 'opacity-100', 'rotate-0');
    closeIcon.classList.add('scale-50', 'opacity-0', 'rotate-90');
  }

  mobileMenuCloseTimer = setTimeout(() => {
    if (header && !drawer.classList.contains('is-open')) {
      header.classList.remove('mobile-menu-active');
    }
    if (closeIcon && !drawer.classList.contains('is-open')) {
      closeIcon.classList.add('hidden');
    }
    mobileMenuCloseTimer = null;
  }, 1220);
}

/* Блокировка прокрутки страницы при открытом бургер-меню (телефоны/планшеты).
   Класс nr-menu-open (html/body) запрещает скролл через overflow: hidden, но iOS
   может «протащить» страницу жестом — поэтому touch-жесты вне меню отменяются.
   Внутри #mobileMenuDrawer прокрутка работает (длинные меню). */
function initMobileMenuScrollLock() {
  document.addEventListener('touchmove', (e) => {
    if (!document.body.classList.contains('nr-menu-open')) return;
    if (!e.touches || !e.touches[0]) return;
    const drawer = document.getElementById('mobileMenuDrawer');
    if (drawer && drawer.contains(e.target)) return; // скролл самого меню — не блокируем
    e.preventDefault();
  }, { passive: false });

  // Если при открытом меню размер окна дорастил до десктопа (≥1024px) — закрываем,
  // иначе блокировка скролла останется при невидимом меню
  const desktopQuery = window.matchMedia('(min-width: 1024px)');
  const onDesktop = (mq) => {
    if (mq.matches && document.body.classList.contains('nr-menu-open')) {
      closeMobileMenu();
    }
  };
  if (typeof desktopQuery.addEventListener === 'function') {
    desktopQuery.addEventListener('change', onDesktop);
  } else if (typeof desktopQuery.addListener === 'function') {
    desktopQuery.addListener(onDesktop); // старые Safari
  }
}

// --- SMOOTH & LUXURIOUS ANCHOR NAVIGATION (Header buttons & in-page anchors) ---
let activeScrollTween = null;

function smoothScrollTo(targetY, customDuration) {
  const startY = window.pageYOffset || document.documentElement.scrollTop || 0;
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const clampedTargetY = Math.min(Math.max(0, targetY), maxScroll);
  const distance = Math.abs(clampedTargetY - startY);

  if (distance < 3) return;

  if (activeScrollTween) {
    activeScrollTween.kill();
    activeScrollTween = null;
  }

  // Ensure html scroll-behavior is auto so browser doesn't fight GSAP/JS on every frame
  document.documentElement.style.scrollBehavior = 'auto';

  // Smooth, gradual duration based on distance (1.1s for short, up to 1.55s for long distances)
  const animDuration = customDuration || Math.min(1.55, Math.max(1.1, 0.95 + (distance / 3800) * 0.6));

  // Allow a short 220ms grace window after click so trackpad/mouse lift momentum never aborts scroll
  let allowInterrupt = false;
  const graceTimer = setTimeout(() => {
    allowInterrupt = true;
  }, 220);

  function onUserInterrupt(e) {
    if (!allowInterrupt) return;
    // Ignore micro-jitters from high-precision trackpads or mouse clicks
    if (e.type === 'wheel' && Math.abs(e.deltaY) < 6 && Math.abs(e.deltaX) < 6) return;

    if (activeScrollTween) {
      activeScrollTween.kill();
      activeScrollTween = null;
    }
    cleanup();
  }

  function cleanup() {
    clearTimeout(graceTimer);
    window.removeEventListener('wheel', onUserInterrupt);
    window.removeEventListener('touchmove', onUserInterrupt);
    window.removeEventListener('keydown', onUserInterrupt);
  }

  window.addEventListener('wheel', onUserInterrupt, { passive: true });
  window.addEventListener('touchmove', onUserInterrupt, { passive: true });
  window.addEventListener('keydown', onUserInterrupt, { passive: true });

  if (typeof gsap !== 'undefined' && typeof ScrollToPlugin !== 'undefined') {
    activeScrollTween = gsap.to(window, {
      duration: animDuration,
      scrollTo: {
        y: clampedTargetY,
        autoKill: false
      },
      ease: "power2.inOut",
      overwrite: "auto",
      onComplete: () => {
        cleanup();
        activeScrollTween = null;
      },
      onInterrupt: () => {
        cleanup();
        activeScrollTween = null;
      }
    });
  } else if (typeof gsap !== 'undefined') {
    const scrollProxy = { y: startY };
    activeScrollTween = gsap.to(scrollProxy, {
      y: clampedTargetY,
      duration: animDuration,
      ease: "power2.inOut",
      overwrite: "auto",
      onUpdate: () => {
        window.scrollTo(0, scrollProxy.y);
      },
      onComplete: () => {
        cleanup();
        activeScrollTween = null;
      },
      onInterrupt: () => {
        cleanup();
        activeScrollTween = null;
      }
    });
  } else {
    const startTime = performance.now();
    function easeInOutCubic(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / (animDuration * 1000), 1);
      const ease = easeInOutCubic(progress);
      window.scrollTo(0, startY + (clampedTargetY - startY) * ease);
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        cleanup();
      }
    }
    requestAnimationFrame(step);
  }
}

let currentActiveNavSection = undefined;
let scrollSpyClickLockTimer = null;
let lastScrollSpyY = typeof window !== 'undefined' ? (window.pageYOffset || document.documentElement.scrollTop || 0) : 0;
let scrollSpyDirection = 'down';

function isDesktopNavActive() {
  if (typeof getDeviceType === 'function') {
    return getDeviceType() === 'desktop';
  }
  return window.innerWidth >= 1024;
}

function setActiveNavSection(sectionId) {
  // На телефонах и планшетах подсветка разделов в навигации отключена
  if (!isDesktopNavActive()) {
    sectionId = null;
  }

  if (currentActiveNavSection === sectionId) return;
  currentActiveNavSection = sectionId;

  // Desktop header nav links
  const desktopNavLinks = document.querySelectorAll('#mainHeader nav a[href^="#"]');
  desktopNavLinks.forEach(link => {
    const href = link.getAttribute('href');
    const target = href ? href.replace(/^#/, '') : '';
    if (sectionId && target === sectionId) {
      link.classList.add('nav-active');
    } else {
      link.classList.remove('nav-active');
    }
  });

  // На мобильных устройствах и планшетах меню остаётся чистым без принудительной подсветки
  const mobileNavLinks = document.querySelectorAll('#mobileMenuDrawer a[href^="#"]');
  mobileNavLinks.forEach(link => {
    link.classList.remove('nav-active');
  });
}

function getSectionAnchorTop(el) {
  if (!el) return null;
  // Ищем заголовок раздела (h2, h1 или специализированный класс)
  // Если заголовок найден — ориентируемся на него как на смысловой центр раздела
  // Если верстка изменится или заголовка нет — плавно ориентируемся на верхний край контейнера
  const heading = el.querySelector('h2, h1, [data-section-title], .section-title');
  if (heading) {
    const headingRect = heading.getBoundingClientRect();
    if (headingRect.height > 0 || headingRect.width > 0) {
      return headingRect.top;
    }
  }
  return el.getBoundingClientRect().top;
}

function updateActiveNavSection() {
  // На телефонах и планшетах полностью отключаем scrollspy-подсветку
  if (!isDesktopNavActive()) {
    setActiveNavSection(null);
    return;
  }

  if (scrollSpyClickLockTimer) return;

  const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  const windowHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const documentHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);

  // Определение направления скролла с фильтрацией микро-колебаний
  const scrollDelta = scrollY - lastScrollSpyY;
  if (Math.abs(scrollDelta) >= 3) {
    scrollSpyDirection = scrollDelta > 0 ? 'down' : 'up';
    lastScrollSpyY = scrollY;
  }

  // Если прокрутили до самого низа страницы — гарантированно активны Отзывы
  // (последний раздел страницы перед подвалом)
  if (scrollY + windowHeight >= documentHeight - 50) {
    setActiveNavSection('reviews');
    return;
  }

  const header = document.querySelector('header');
  const headerH = header ? header.offsetHeight : 72;

  // Оптический центр видимой зоны экрана (между фиксированной шапкой и низом вьюпорта):
  // При скролле ВНИЗ: заголовок следующего раздела доходит до центра экрана (~47% видимой высоты) -> активируется этот раздел.
  // При скролле ВВЕРХ: заголовок нижнего раздела должен опуститься до ~72% (70-75% высоты экрана), прежде чем подсветка перейдёт на верхний раздел.
  const visibleHeight = windowHeight - headerH;
  const visibleCenter = headerH + visibleHeight * 0.47;
  const triggerY = scrollSpyDirection === 'down'
    ? visibleCenter
    : headerH + Math.round(visibleHeight * 0.72);

  const NAV_SECTIONS = ['player', 'services', 'faq', 'contacts', 'reviews'];

  // Зона Hero: если заголовок первого раздела (player) ещё не поднялся до центра экрана,
  // значит внимание пользователя на главном экране — подсветка выключена
  const firstSection = document.getElementById(NAV_SECTIONS[0]);
  const firstAnchorTop = getSectionAnchorTop(firstSection);
  if (firstAnchorTop !== null && firstAnchorTop > triggerY) {
    setActiveNavSection(null);
    return;
  }
  if (scrollY < 120) {
    setActiveNavSection(null);
    return;
  }

  // Проверяем секции в обратном порядке (снизу вверх: reviews -> contacts -> faq -> services -> player):
  // Первая секция снизу, чей заголовок/якорь пересёк линию центра экрана, становится активной
  let activeSection = null;
  for (let i = NAV_SECTIONS.length - 1; i >= 0; i--) {
    const id = NAV_SECTIONS[i];
    const el = document.getElementById(id);
    if (!el) continue;
    const anchorTop = getSectionAnchorTop(el);
    if (anchorTop !== null && anchorTop <= triggerY) {
      activeSection = id;
      break;
    }
  }

  setActiveNavSection(activeSection);
}

function initScrollSpy() {
  let isScrollSpyTicking = false;

  function onScrollOrResize() {
    if (!isScrollSpyTicking) {
      isScrollSpyTicking = true;
      requestAnimationFrame(() => {
        updateActiveNavSection();
        updateScrollToTopVisibility();
        isScrollSpyTicking = false;
      });
    }
  }

  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });

  // Recalculate on initial render
  updateActiveNavSection();
}

function initSmoothAnchorNavigation() {
  if (typeof gsap !== 'undefined' && typeof ScrollToPlugin !== 'undefined') {
    gsap.registerPlugin(ScrollToPlugin);
  }

  document.addEventListener('click', (e) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

    const anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    if (href === '#' || href === '#top') {
      e.preventDefault();
      setActiveNavSection(null);
      smoothScrollTo(0);
      return;
    }

    try {
      const targetEl = document.querySelector(href);
      if (targetEl) {
        e.preventDefault();
        const header = document.querySelector('header');
        const headerH = header ? header.offsetHeight : 72;
        const extraOffset = 14;
        const rect = targetEl.getBoundingClientRect();
        const currentY = window.pageYOffset || document.documentElement.scrollTop || 0;
        const targetY = currentY + rect.top - headerH - extraOffset;

        const targetId = href.startsWith('#') ? href.slice(1) : null;
        if (targetId && ['player', 'services', 'faq', 'contacts', 'reviews'].includes(targetId)) {
          setActiveNavSection(targetId);
          if (scrollSpyClickLockTimer) clearTimeout(scrollSpyClickLockTimer);
          scrollSpyClickLockTimer = setTimeout(() => {
            scrollSpyClickLockTimer = null;
            updateActiveNavSection();
          }, 1300);
        }

        if (typeof closeMobileMenu === 'function') {
          closeMobileMenu();
        }

        smoothScrollTo(targetY);

        if (history.pushState) {
          history.pushState(null, '', href);
        }
      }
    } catch (err) {
      // Ignore invalid selectors
    }
  });
}

// --- SCROLL TO TOP FLOATING BUTTON (CENTER BOTTOM) ---
function scrollToTop() {
  setActiveNavSection(null);
  smoothScrollTo(0);
}

function updateScrollToTopVisibility() {
  const btn = document.getElementById('scrollToTopBtn');
  if (!btn) return;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
  if (scrollY > 260) {
    btn.classList.add('visible');
  } else {
    btn.classList.remove('visible');
  }
}

function initScrollToTop() {
  const btn = document.getElementById('scrollToTopBtn');
  if (!btn) return;

  const arrow = btn.querySelector('.scroll-to-top-arrow');

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    // Возвращаем стрелку в исходное положение: снимаем hover-анимацию на время
    // клика и сразу возвращаем ей transform (иначе на тач/после клика «левитация»
    // стрелки продолжалась бы, пока курсор/нажатие держится на кнопке).
    if (arrow) {
      arrow.classList.remove('nr-arrow-reset');
      void arrow.offsetWidth; // reflow, чтобы перезапустить
      arrow.classList.add('nr-arrow-reset');
      setTimeout(() => arrow.classList.remove('nr-arrow-reset'), 650);
    }
    scrollToTop();
  });
  updateScrollToTopVisibility();
}

function goToFaqItem(faqIndex) {
  closeAboutModal();
  setActiveNavSection('faq');
  if (scrollSpyClickLockTimer) clearTimeout(scrollSpyClickLockTimer);
  scrollSpyClickLockTimer = setTimeout(() => {
    scrollSpyClickLockTimer = null;
    updateActiveNavSection();
  }, 1300);

  const faqSection = document.getElementById('faq');
  if (faqSection) {
    const header = document.querySelector('header');
    const headerH = header ? header.offsetHeight : 72;
    const rect = faqSection.getBoundingClientRect();
    const currentY = window.pageYOffset || document.documentElement.scrollTop || 0;
    const targetY = Math.max(0, currentY + rect.top - headerH - 18);
    smoothScrollTo(targetY, 1.2);
  }
  const itemKey = `faq-${faqIndex}`;
  setTimeout(() => {
    openFaqItem(itemKey);
  }, 400);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toastText');
  if (toast && toastText) {
    toastText.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
}

function getLocalizedCopyToast(text, fallbackMsg) {
  const t = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.i18n) ? CONFIG.i18n[currentLang] : null;
  const contacts = t && t.contacts ? t.contacts : null;
  if (!contacts) return fallbackMsg;

  const value = String(text || '');
  const atIdx = value.indexOf('@');
  const isEmail = atIdx > 0 && value.indexOf('.') > atIdx;
  const key = isEmail ? 'toastEmailCopied' : 'toastTgCopied';
  const resolved = resolveDeviceText(contacts[key], getDeviceType());

  return (typeof resolved === 'string' && resolved) ? resolved : fallbackMsg;
}

function copyText(text, toastMsg) {
  const resolvedToastMsg = getLocalizedCopyToast(text, toastMsg);
  const onSuccess = () => showToast(resolvedToastMsg);

  const fallbackCopy = () => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.setAttribute('readonly', '');
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, 99999);
      document.execCommand('copy');
      document.body.removeChild(textArea);
      onSuccess();
    } catch (err) {
      onSuccess();
    }
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
}

// --- GSAP ANIMATIONS: STRICT POSITION-BOUND CASCADE WITH DYNAMIC PLAYER BAR OFFSET ---
function getStickyPlayerHeight() {
  const bar = document.getElementById('stickyPlayerBar');
  const isActive = bar && (bar.classList.contains('active') || document.body.classList.contains('has-sticky-player'));
  if (isActive) {
    const h = bar.offsetHeight;
    if (h && h > 0) return h;
    return window.innerWidth >= 640 ? 96 : 84;
  }
  return 0;
}

function computeDynamicStart(percentOrStr = 86) {
  let percent = 86;
  if (typeof percentOrStr === 'number') {
    percent = percentOrStr;
  } else if (typeof percentOrStr === 'string') {
    const m = percentOrStr.match(/(\d+)%/);
    if (m) {
      percent = parseFloat(m[1]);
    }
  }

  return () => {
    const bottomBarHeight = getStickyPlayerHeight();
    if (bottomBarHeight > 0) {
      // Visible viewport above the bottom sticky player bar
      const effectiveViewportHeight = window.innerHeight - bottomBarHeight;
      const triggerY = Math.round(effectiveViewportHeight * (percent / 100));
      return `top ${triggerY}px`;
    }
    return `top ${percent}%`;
  };
}

function animateScrollBlock(selectorOrEls, options = {}) {
  const els = typeof selectorOrEls === 'string' ? document.querySelectorAll(selectorOrEls) : selectorOrEls;
  if (!els || els.length === 0) return;

  const yVal = options.y !== undefined ? options.y : 22;
  const duration = options.duration || 0.48;
  const rawStart = options.start || 'top 86%';
  const dynamicStart = typeof rawStart === 'function' ? rawStart : computeDynamicStart(rawStart);
  const ease = options.ease || 'power2.out';
  const stagger = options.stagger || 0;
  const delay = options.delay || 0;
  const trigger = options.trigger || null;

  els.forEach((el, idx) => {
    // Kill existing triggers for this element
    ScrollTrigger.getAll().forEach(st => {
      if (st.vars && st.vars.trigger === el) {
        st.kill();
      }
    });

    // Strictly closed by default
    gsap.set(el, { y: yVal, opacity: 0 });

    const trigEl = trigger ? (typeof trigger === 'string' ? document.querySelector(trigger) : trigger) : el;
    if (!trigEl) return;

    const itemDelay = delay + (stagger > 0 ? idx * stagger : 0);

    // Position-bound trigger: opens when crossing into viewport from below, closes when leaving viewport downward
    gsap.fromTo(
      el,
      { y: yVal, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: duration,
        delay: itemDelay,
        ease: ease,
        overwrite: 'auto',
        scrollTrigger: {
          trigger: trigEl,
          start: dynamicStart,
          end: 'bottom top',
          toggleActions: 'play none none reverse'
        }
      }
    );
  });
}

let playerTimelines = [];
let playerTracksTimeline = null;

function initPlayerGsapAnimation() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  const section = document.getElementById('player');
  if (!section) return;

  const sectionHeader = section.querySelector('.text-center');
  // Жанровые фильтры убраны — анимируем только пагинацию и карточки треков.
  const paginationContainer = section.querySelector('#playerContentContainer .border-t');

  // Clean up previous timelines or triggers attached to player
  if (playerTimelines && playerTimelines.length) {
    playerTimelines.forEach(tl => {
      try { tl.kill(); } catch (e) {}
    });
    playerTimelines = [];
  }

  ScrollTrigger.getAll().forEach(st => {
    if (st.vars && st.vars.trigger) {
      const tr = st.vars.trigger;
      if (
        tr === '#player' ||
        tr === '#playerContentContainer' ||
        tr === '#player .text-center' ||
        tr === '#trackListContainer' ||
        (typeof tr === 'object' && (tr === section || (tr.closest && tr.closest('#player'))))
      ) {
        st.kill();
      }
    }
  });

  const trackContainer = document.getElementById('trackListContainer');
  const trackCards = trackContainer ? trackContainer.querySelectorAll(':scope > *') : [];

  // Respect prefers-reduced-motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (sectionHeader) gsap.set(sectionHeader, { opacity: 1, y: 0 });
    trackCards.forEach(card => gsap.set(card, { opacity: 1, y: 0 }));
    if (paginationContainer) gsap.set(paginationContainer, { opacity: 1, y: 0 });
    return;
  }

  // Pre-hide elements if not already scrolled into view
  const vh = window.innerHeight || 800;
  const secRect = section.getBoundingClientRect();
  const isPlayerInView = secRect.top < vh * 0.88 && secRect.bottom > 0;

  if (!isPlayerInView) {
    if (sectionHeader) gsap.set(sectionHeader, { y: 24, opacity: 0 });
    trackCards.forEach(card => gsap.set(card, { y: 26, opacity: 0 }));
    if (paginationContainer) gsap.set(paginationContainer, { y: 16, opacity: 0 });
  }

  // 1. SECTION HEADER TIMELINE (Title "Слушай разницу")
  // Enters at 88%, reverses visibly when scrolling up past 88%
  if (sectionHeader) {
    const headerTl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionHeader,
        start: computeDynamicStart(88),
        end: 'bottom top',
        toggleActions: 'play none none reverse',
        onLeaveBack: () => {
          headerTl.timeScale(1.6).reverse();
        },
        onEnter: () => {
          headerTl.timeScale(1.0).play();
        }
      }
    });

    headerTl.fromTo(
      sectionHeader,
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' },
      0
    );
    playerTimelines.push(headerTl);
  }

  // 2. TRACK LIST GRID TIMELINE (Individual track cards with cover art and play buttons)
  // Enters at 83%, reverses visibly when scrolling up past 83%
  initPlayerTrackCardsTimeline(true);

  // 3. PAGINATION CONTROLS TIMELINE (Prev/Next buttons + Page info / Dots)
  // Enters at 80%, reverses visibly when scrolling up past 80%
  // Если страница одна, блок пагинации скрыт (см. renderTrackList) — анимировать нечего.
  if (paginationContainer && paginationContainer.style.display !== 'none') {
    const paginationTl = gsap.timeline({
      scrollTrigger: {
        trigger: paginationContainer,
        start: computeDynamicStart(80),
        end: 'bottom top',
        toggleActions: 'play none none reverse',
        onLeaveBack: () => {
          paginationTl.timeScale(1.8).reverse();
        },
        onEnter: () => {
          paginationTl.timeScale(1.0).play();
        }
      }
    });

    paginationTl.fromTo(
      paginationContainer,
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out' },
      0
    );
    playerTimelines.push(paginationTl);
  }
}

function initPlayerTrackCardsTimeline(initialPreHide = true, alreadyAnimated = false) {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  const trackContainer = document.getElementById('trackListContainer');
  if (!trackContainer) return;

  const trackCards = trackContainer.querySelectorAll(':scope > *');
  if (!trackCards.length) return;

  if (playerTracksTimeline) {
    try { playerTracksTimeline.kill(); } catch (e) {}
    playerTracksTimeline = null;
  }

  ScrollTrigger.getAll().forEach(st => {
    if (st.vars && st.vars.trigger === '#trackListContainer') {
      st.kill();
    }
  });

  const rect = trackContainer.getBoundingClientRect();
  const vh = window.innerHeight || 800;
  const isAlreadyInView = rect.top < vh * 0.83 && rect.bottom > 0;

  if (initialPreHide && !isAlreadyInView && !alreadyAnimated) {
    gsap.set(trackCards, { y: 26, opacity: 0 });
  }

  playerTracksTimeline = gsap.timeline({
    scrollTrigger: {
      trigger: '#trackListContainer',
      start: computeDynamicStart(83),
      end: 'bottom top',
      toggleActions: 'play none none reverse',
      onLeaveBack: () => {
        playerTracksTimeline.timeScale(1.6).reverse();
      },
      onEnter: () => {
        playerTracksTimeline.timeScale(1.0).play();
      }
    }
  });

  playerTracksTimeline.fromTo(
    trackCards,
    { y: 26, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.45, stagger: 0.07, ease: 'power2.out' },
    0
  );

  if (isAlreadyInView || alreadyAnimated) {
    playerTracksTimeline.progress(1);
  }

  if (playerTimelines && !playerTimelines.includes(playerTracksTimeline)) {
    playerTimelines.push(playerTracksTimeline);
  }
}

let servicesTimelines = [];

function initServicesGsapAnimation() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  const section = document.getElementById('services');
  if (!section) return;

  const sectionHeader = section.querySelector('.text-center');
  const cards = document.querySelectorAll('#servicesContainer > *');
  if (!cards.length) return;

  // На телефоне карточки услуг — карусель с coverflow: их transform и opacity
  // принадлежат updateServicesDots(). GSAP здесь анимирует только содержимое,
  // иначе его clearProps затирал позиции coverflow и карточки стояли
  // «неправильно» до первого пролистывания карусели.
  const mobileCarousel = window.innerWidth < 640;

  // Clean up previous timelines or triggers attached to services
  if (servicesTimelines && servicesTimelines.length) {
    servicesTimelines.forEach(tl => {
      try {
        if (tl.scrollTrigger) tl.scrollTrigger.kill();
        tl.kill();
      } catch (e) {}
    });
    servicesTimelines = [];
  }

  ScrollTrigger.getAll().forEach(st => {
    if (st.vars && st.vars.trigger) {
      const tr = st.vars.trigger;
      if (
        tr === '#services' ||
        tr === '#servicesContainer' ||
        tr === '#services .text-center' ||
        tr === '.service-card-bottom' ||
        tr === '.service-card-features' ||
        (typeof tr === 'object' && (tr === section || (tr.closest && tr.closest('#services'))))
      ) {
        st.kill();
      }
    }
  });

  // Extract price data for number count-up animation
  const priceData = [];
  cards.forEach(card => {
    const priceEl = card.querySelector('.service-card-price');
    if (!priceEl) return;
    const targetText = priceEl.getAttribute('data-target-price') || priceEl.textContent;
    const match = targetText.match(/\d[\d\s\u00A0.,]*\d|\d/);
    if (!match) return;

    const raw = match[0];
    const sep = /[\s\u00A0]/.test(raw) ? raw.match(/[\s\u00A0]/)[0] : (raw.indexOf(',') > -1 ? ',' : '');
    const targetVal = parseInt(raw.replace(/[^\d]/g, ''), 10);
    if (isNaN(targetVal) || targetVal <= 0) return;

    priceData.push({
      el: priceEl,
      targetText: targetText,
      raw: raw,
      sep: sep,
      targetVal: targetVal
    });
  });

  // Respect prefers-reduced-motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (sectionHeader) gsap.set(sectionHeader, { opacity: 1, y: 0 });
    cards.forEach(card => {
      if (!mobileCarousel) gsap.set(card, { opacity: 1, y: 0 });
      gsap.set(card.querySelectorAll('.service-feature-item'), { opacity: 1, x: 0 });
      gsap.set(card.querySelectorAll('.service-check-icon'), { opacity: 1, scale: 1 });
      gsap.set(card.querySelectorAll('.service-card-top, .service-card-bottom, .service-card-divider, .service-card-pricing, .service-card-order-btn, .service-card-price-group'), { opacity: 1, y: 0, scaleX: 1 });
    });
    priceData.forEach(p => { p.el.textContent = p.targetText; });
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ПОЯВЛЕНИЕ И «УЕЗД» КАРТОЧЕК УСЛУГ — тем же шаблоном, что в разделах
  // «Вопросы» и «Контакты» (там анимация работает правильно):
  //
  //   gsap.fromTo(el, { y, opacity: 0 } → { y: 0, opacity: 1, overwrite: 'auto',
  //     scrollTrigger: { trigger: el, end: 'bottom top',
  //                      toggleActions: 'play none none reverse' } })
  //
  // `play … reverse` даёт сразу обе анимации: открытие при прокрутке вниз и
  // закрытие (плавный уезд) при прокрутке вверх. Раньше стояло 'none' — поэтому
  // закрытия не было видно, а открытие «не читалось».
  //
  // На каждую карточку вешаем ОДИН таймлайн (оболочка + содержимое вместе):
  // два отдельных триггера на одной карточке срабатывали не одновременно, и
  // карточка «дёргалась».
  //
  // На телефоне оболочки карточек НЕ трогаем: их transform/opacity принадлежат
  // coverflow из updateServicesDots(). Там всплывает только содержимое карточек.

  // Соберём «внутренности» карточек, которые можно мягко анимировать на ЛЮБОЙ
  // ширине экрана (оболочки на телефоне исключаем из-за coverflow).
  const cardInnerSelectors = [
    '.service-card-top',
    '.service-feature-item',
    '.service-check-icon',
    '.service-card-bottom',
    '.service-card-divider',
    '.service-card-price-group',
    '.service-card-order-btn'
  ];

  // Если элемент уже на экране (например, переключили язык, а секция перед
  // глазами) — показываем его сразу, без повторного «проявления».
  const isAlreadyInView = (el) => {
    if (!el || typeof el.getBoundingClientRect !== 'function') return false;
    return el.getBoundingClientRect().top < window.innerHeight * 0.88;
  };

  // Снимаем твины прошлого запуска и ставим стартовое (скрытое) состояние.
  cards.forEach(card => {
    gsap.killTweensOf(card);
    if (!mobileCarousel) gsap.set(card, { y: 20, opacity: 0 });

    const innerEls = card.querySelectorAll(cardInnerSelectors.join(','));
    if (innerEls.length) {
      gsap.killTweensOf(innerEls);
      gsap.set(innerEls, { opacity: 0 });
    }
  });

  if (sectionHeader) {
    gsap.killTweensOf(sectionHeader);
    gsap.set(sectionHeader, { y: 20, opacity: 0 });
  }

  // Initialize prices to 0 so count-up starts cleanly
  priceData.forEach(p => {
    p.el.textContent = p.targetText.replace(p.raw, '0');
  });

  const bottomContainer = document.querySelector('#servicesContainer .service-card-bottom') || '#servicesContainer';

  // Заголовок секции — как в остальных разделах: появление и уезд.
  if (sectionHeader) {
    const headerTl = gsap.timeline({
      scrollTrigger: {
        trigger: sectionHeader,
        start: computeDynamicStart(88),
        end: 'bottom top',
        toggleActions: 'play none none reverse'
      }
    });

    headerTl.fromTo(
      sectionHeader,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', overwrite: 'auto' },
      0
    );

    if (isAlreadyInView(sectionHeader)) headerTl.progress(1);
    servicesTimelines.push(headerTl);
  }

  // Карточки: на планшете/десктопе каждая всплывает отдельно по мере скролла
  // (чтобы появление второй и третьей услуги было видно), на телефоне —
  // всплывает только содержимое, оболочку не трогаем (coverflow).
  cards.forEach((card, index) => {
    // Лёгкая «волна»: карточки, стоящие рядом в одной строке сетки, срабатывают
    // одновременно, поэтому вторая и третья получают небольшое отставание —
    // так появление читается, как в «Контактах» (там delay: idx * 0.05).
    const wave = mobileCarousel ? 0 : Math.min(index, 2) * 0.07;
    const innerEls = card.querySelectorAll(cardInnerSelectors.join(','));

    const cardTl = gsap.timeline({
      scrollTrigger: {
        trigger: card,
        start: computeDynamicStart(86),
        end: 'bottom top',
        toggleActions: 'play none none reverse'
      }
    });

    if (!mobileCarousel) {
      cardTl.fromTo(
        card,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out', overwrite: 'auto' },
        wave
      );
    }

    if (innerEls.length) {
      // Содержимое догоняет оболочку с лёгкой задержкой и мягким каскадом.
      cardTl.fromTo(
        innerEls,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, stagger: 0.03, ease: 'power2.out', overwrite: 'auto' },
        wave + (mobileCarousel ? 0 : 0.06)
      );
    }

    if (isAlreadyInView(card)) cardTl.progress(1);
    servicesTimelines.push(cardTl);
  });

  // Цены: мягкий count-up при появлении (без реверса/скачков).
  let priceCountTween = null;
  const counterProxy = { progress: 0 };

  function startPriceCountUp() {
    if (priceCountTween) {
      priceCountTween.kill();
      priceCountTween = null;
    }
    counterProxy.progress = 0;
    priceCountTween = gsap.to(counterProxy, {
      progress: 1,
      duration: 1.25,
      delay: 0.08,
      ease: 'power2.out',
      onUpdate: () => {
        const pr = counterProxy.progress;
        priceData.forEach(p => {
          if (pr <= 0.01) {
            p.el.textContent = p.targetText.replace(p.raw, '0');
          } else if (pr >= 0.99) {
            p.el.textContent = p.targetText;
          } else {
            const currentVal = Math.round(p.targetVal * pr);
            const formatted = p.sep === ','
              ? String(currentVal).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
              : String(currentVal).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
            p.el.textContent = p.targetText.replace(p.raw, formatted);
          }
        });
      },
      onComplete: () => {
        priceData.forEach(p => {
          p.el.textContent = p.targetText;
        });
      }
    });
  }

  // Count-up цен запускаем отдельным триггером (без повторного фейда
  // bottomContainer — его opacity уже управляется общим мягким светом выше).
  if (priceData.length) {
    ScrollTrigger.create({
      trigger: bottomContainer,
      start: computeDynamicStart(80),
      once: true,
      onEnter: startPriceCountUp
    });
  }
}

function initFaqGsapAnimation() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  const faqItems = document.querySelectorAll('#faqContainer > *');
  if (!faqItems.length) return;

  // Kill previous triggers attached to FAQ items
  ScrollTrigger.getAll().forEach(st => {
    if (st.vars && st.vars.trigger) {
      const tr = st.vars.trigger;
      if (typeof tr === 'object' && tr.closest && tr.closest('#faqContainer')) {
        st.kill();
      }
    }
  });

  // Each FAQ question is an independent object strictly bound to its own viewport position
  faqItems.forEach((item) => {
    // Strictly closed by default
    gsap.set(item, { y: 20, opacity: 0 });

    gsap.fromTo(
      item,
      { y: 20, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.45,
        ease: 'power2.out',
        overwrite: 'auto',
        scrollTrigger: {
          trigger: item,
          start: computeDynamicStart(86),
          end: 'bottom top',
          toggleActions: 'play none none reverse'
        }
      }
    );
  });
}

function initContactsGsapAnimation() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  const contactButtons = document.querySelectorAll('#contactsGrid > *');
  if (!contactButtons.length) return;

  ScrollTrigger.getAll().forEach(st => {
    if (st.vars && st.vars.trigger) {
      const tr = st.vars.trigger;
      if (typeof tr === 'object' && tr.closest && tr.closest('#contactsGrid')) {
        st.kill();
      } else if (tr === '#contactsGrid') {
        st.kill();
      }
    }
  });

  contactButtons.forEach((btn, idx) => {
    gsap.set(btn, { y: 18, opacity: 0 });

    gsap.fromTo(
      btn,
      { y: 18, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.42,
        delay: idx * 0.05,
        ease: 'power2.out',
        overwrite: 'auto',
        scrollTrigger: {
          trigger: '#contactsGrid',
          start: computeDynamicStart(85),
          end: 'bottom top',
          toggleActions: 'play none none reverse'
        }
      }
    );
  });
}

function initGsapAnimations() {
  if (typeof gsap === 'undefined') return;

  if (typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  // Hero Section: smooth entrance on load, stable at top
  gsap.fromTo(
    '#hero .space-y-6 > *',
    { y: 24, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: 0.85,
      stagger: 0.08,
      ease: 'power2.out'
    }
  );

  gsap.fromTo(
    '#hero .hero-mask-container',
    { y: 20, opacity: 0 },
    {
      y: 0,
      opacity: 1,
      duration: 0.85,
      ease: 'power2.out'
    }
  );

  // 1. Player Section: Unified scroll-driven sequence (Header -> Genre Filters -> Track Cards -> Pagination Controls)
  initPlayerGsapAnimation();

  // 2. Services Section: Unified scroll-driven sequence (Header -> Cards -> Main Text -> Checkmarks -> Prices & Buttons)
  initServicesGsapAnimation();

  // 3. FAQ Section: Phrase/header first at 88%, individual questions strictly by their position at 86%
  animateScrollBlock('#faq .text-center', { duration: 0.5, y: 20, start: 'top 88%' });
  initFaqGsapAnimation();

  // 4. Contacts Section: Phrase/header first at 88%, rack card container at 85%, buttons cascade at 85%
  animateScrollBlock('#contacts .text-center', { duration: 0.5, y: 20, start: 'top 88%' });
  animateScrollBlock('#contacts .rack-card', { duration: 0.5, y: 18, start: 'top 85%' });
  initContactsGsapAnimation();

  // 5. Footer Section: Opens at 92%
  animateScrollBlock('footer', { y: 16, duration: 0.5, start: 'top 92%' });

  // 6. Reviews Section: заголовок раздела появляется первым.
  //    Сами ряды лент поднимаются отдельно — animations.js → initReveal.
  animateScrollBlock('#reviews .text-center', { duration: 0.5, y: 20, start: 'top 88%' });
}

function initMixerFaderScroll() {
  const knob = document.getElementById('side-fader-knob');
  const rail = knob ? knob.closest('.fader-rail') : null;
  const strip = document.getElementById('side-mixer-strip');
  if (!knob || !rail) return;

  let isDragging = false;
  let grabOffsetY = 12;

  // Cache static DOM lookups once to avoid layout/query thrashing on scroll frames
  const dbLabel = document.getElementById('side-db-label');
  const sideLeds = Array.from(document.querySelectorAll('.side-vu-led'));
  const totalLeds = sideLeds.length;
  const redCount = Math.max(2, Math.round(totalLeds * 0.15));
  const yellowCount = Math.max(4, Math.round(totalLeds * 0.38));

  // Метрики ползунка читаем не на каждом кадре скролла, а при старте и при
  // изменении размеров окна: clientHeight/offsetHeight — это чтение раскладки.
  let maxTravel = 0;
  function measureFader() {
    const railH = rail.clientHeight || 400;
    const knobH = knob.offsetHeight || 24;
    maxTravel = Math.max(0, railH - knobH);
  }
  measureFader();
  window.addEventListener('resize', measureFader, { passive: true });

  // Последнее отрисованное состояние: подсветка 16 светодиодов и текст
  // dB переписываются только когда значение реально изменилось.
  let lastLedActive = -1;
  let lastDbText = '';

  function updateFaderUI(scrollPercent) {
    const topPx = Math.max(0, Math.min(maxTravel, scrollPercent * maxTravel));
    knob.style.top = `${topPx}px`;

    const faderLevel = 1 - Math.max(0, Math.min(1, scrollPercent));

    if (dbLabel) {
      let txt;
      if (faderLevel < 0.04) {
        txt = '-INF';
      } else {
        const dbVal = ((faderLevel - 0.75) * 24).toFixed(1);
        txt = `${dbVal > 0 ? '+' : ''}${dbVal}dB`;
      }
      if (txt !== lastDbText) {
        lastDbText = txt;
        dbLabel.textContent = txt;
      }
    }

    if (totalLeds > 0) {
      const activeCount = Math.round(faderLevel * totalLeds);
      if (activeCount === lastLedActive) return;
      lastLedActive = activeCount;

      sideLeds.forEach((led, idx) => {
        const distFromBottom = totalLeds - 1 - idx;
        if (distFromBottom < activeCount) {
          if (idx < redCount) {
            led.className = "side-vu-led vu-led active-red";
          } else if (idx < yellowCount) {
            led.className = "side-vu-led vu-led active-yellow";
          } else {
            led.className = "side-vu-led vu-led active-green";
          }
        } else {
          led.className = "side-vu-led vu-led";
        }
      });
    }
  }

  // Высота документа меняется редко (открылся вопрос в FAQ, показался нижний
  // плеер), поэтому меряем её не в каждом кадре скролла, а по resize и через
  // ResizeObserver. Раньше scrollHeight и clientHeight читались на каждом
  // кадре прокрутки — это принудительная переклейка раскладки всей страницы.
  let cachedMaxScroll = 0;
  function measureScrollMetrics() {
    const scrollHeight = document.documentElement.scrollHeight || (document.body && document.body.scrollHeight) || 0;
    const clientHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    cachedMaxScroll = Math.max(1, scrollHeight - clientHeight);
  }
  measureScrollMetrics();
  window.addEventListener('resize', measureScrollMetrics, { passive: true });
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => measureScrollMetrics()).observe(document.documentElement);
  }

  function getScrollMetrics() {
    // window.scrollY читается без переклейки — в отличие от scrollTop у элемента.
    const scrollTop = window.scrollY || 0;
    if (!cachedMaxScroll) measureScrollMetrics();
    return { scrollTop, maxScroll: cachedMaxScroll };
  }

  let isWindowScrollTicking = false;

  function onWindowScroll() {
    if (window.innerWidth < 1024 || isDragging) return;
    if (!isWindowScrollTicking) {
      isWindowScrollTicking = true;
      requestAnimationFrame(() => {
        const { scrollTop, maxScroll } = getScrollMetrics();
        const scrollPercent = Math.min(Math.max(scrollTop / maxScroll, 0), 1);
        updateFaderUI(scrollPercent);
        isWindowScrollTicking = false;
      });
    }
  }

  // Останавливаем активную анимацию плавного скролла (инерцию колеса или
  // GSAP-якорь), иначе её tick дерётся за window.scrollTo с фейдером микшера:
  // страница «откатывается» к старой цели колеса. Вызов дёшев (сброс состояния).
  function stopSmoothMotion() {
    try {
      if (window.nrSmoothScroll && typeof window.nrSmoothScroll.cancel === 'function') {
        window.nrSmoothScroll.cancel();
      }
    } catch (err) {}
    if (typeof activeScrollTween !== 'undefined' && activeScrollTween) {
      try {
        activeScrollTween.kill();
      } catch (err) {}
      activeScrollTween = null;
    }
  }

  function applyScrollFromPointerY(clientY) {
    stopSmoothMotion();
    const railRect = rail.getBoundingClientRect();
    if (railRect.height <= 0) return;

    const knobH = knob.offsetHeight || 24;
    const maxTravel = railRect.height - knobH;
    if (maxTravel <= 0) return;

    const targetTop = Math.max(0, Math.min(maxTravel, clientY - railRect.top - grabOffsetY));
    const ratio = targetTop / maxTravel;

    const { maxScroll } = getScrollMetrics();
    const targetScrollY = ratio * maxScroll;

    window.scrollTo(0, targetScrollY);
    updateFaderUI(ratio);
  }

  function onPointerDown(e) {
    if (window.innerWidth < 1024) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    isDragging = true;
    knob.classList.add('is-dragging');
    document.body.style.userSelect = 'none';
    document.documentElement.style.scrollBehavior = 'auto';

    stopSmoothMotion();

    const knobRect = knob.getBoundingClientRect();
    const knobH = knob.offsetHeight || 24;

    if (e.target === knob || knob.contains(e.target)) {
      grabOffsetY = Math.max(0, Math.min(knobH, e.clientY - knobRect.top));
    } else {
      grabOffsetY = knobH / 2;
    }

    applyScrollFromPointerY(e.clientY);

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp, { passive: false });
    window.addEventListener('pointercancel', onPointerUp, { passive: false });
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    e.preventDefault();
    applyScrollFromPointerY(e.clientY);
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    knob.classList.remove('is-dragging');
    document.body.style.userSelect = '';
    document.documentElement.style.scrollBehavior = '';

    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);

    onWindowScroll();
  }

  rail.addEventListener('pointerdown', onPointerDown);
  if (strip) {
    strip.addEventListener('selectstart', (e) => e.preventDefault());
  }

  window.addEventListener('scroll', onWindowScroll, { passive: true });
  window.addEventListener('resize', onWindowScroll, { passive: true });
  onWindowScroll();
}
