// ═══════════════════════════════════════════════════════════════════════
// js/i18n.js — ЯЗЫК: АВТООПРЕДЕЛ ПО РЕГИОНУ, I18N-РЕНДЕР, META
// Грузится после: js/state.js и js/player-ui.js (зовёт renderTrackList и
//         updateMasterDeckUI по имени). Читает: currentLang, CONFIG.
// Владеет: lastDetectedDevice, isSwitchingLanguage, RU_SPHERE_LANGS,
//         RU_SPHERE_COUNTRIES, RU_SPHERE_TIMEZONES.
// Публичные (window): setLanguage, initI18n, updateDocumentMeta.
// Блоки файла:
//   • Автоопределение языка по региону (RU_SPHERE_*): RU для России и СНГ.
//   • getDeviceType и resolveDeviceText — выбор desktop/tablet/mobile текста.
//   • I18N-система: расстановка текстов по data-i18n, updateDocumentMeta.
// ═══════════════════════════════════════════════════════════════════════

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

// --- ОПРЕДЕЛЕНИЕ УСТРОЙСТВА И ВЫБОР ТЕКСТА ПОД ЭКРАН ---
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
    // Объект с ключами устройств { desktop, tablet, mobile } — берётся нужный вариант
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

// --- СИСТЕМА ПЕРЕВОДОВ ---
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

  // 1. Все элементы [data-i18n], кроме контейнера переключателя языка и совпадающих строк
  document.querySelectorAll('[data-i18n]').forEach(el => {
    if (el.closest('#langToggleContainer')) return;
    const keyPath = el.getAttribute('data-i18n');
    if (keyPath) {
      const ruVal = getI18nValue('ru', keyPath, currentDevice);
      const enVal = getI18nValue('en', keyPath, currentDevice);
      // Если строка в обоих языках одинаковая, анимация пропускается — интерфейс не дёргается
      if (ruVal && enVal && ruVal === enVal) return;
    }
    elements.push(el);
  });

  // 2. Динамические тексты услуг: бейдж, заголовок, описание, список, префикс цены, кнопка
  document.querySelectorAll(
    '#servicesContainer .popular-badge, ' +
    '#servicesContainer .service-card-title, ' +
    '#servicesContainer .service-card-desc, ' +
    '#servicesContainer .service-card-features, ' +
    '#servicesContainer .service-card-from, ' +
    '#servicesContainer .service-card-order-btn span, ' +
    // Обратная сторона карточки услуги
    '#servicesContainer .service-card-back-title, ' +
    '#servicesContainer .service-card-about, ' +
    '#servicesContainer .service-card-includes-title, ' +
    '#servicesContainer .service-card-back-btn span'
  ).forEach(el => {
    if (!elements.includes(el)) elements.push(el);
  });

  // 3. Динамические тексты FAQ: только контейнер текста вопроса, без иконок и кнопок целиком
  document.querySelectorAll(
    '#faqContainer .faq-q-text, ' +
    '#faqContainer .faq-content-wrapper p'
  ).forEach(el => {
    if (!elements.includes(el)) elements.push(el);
  });

  // 4. Reviews (#reviews): текст и имя меняются мгновенно — карточки живут
  //    в бегущих лентах и их в разы больше, чем остальных текстов на странице.

  // Элементы внутри уже выбранных отбрасываются — иначе размытие накладывается дважды
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

  // Калькулятор стоимости: пересчёт шкалы, подписей услуг и итоговой цены в
  // анкете и смете (js/calculator.js → renderPriceCalcForm).
  renderPriceCalcForm();

  // Тексты сменились — «главные» строки окна «Обо мне» надо подогнать заново.
  // У языков разная длина («Проходил обучение…» — 20.79 em по-русски против
  // 18.74 em по-английски), а инлайн-кегль на них остался от прежнего языка:
  // без пересчёта русская строка после английской не влезла бы в nowrap.
  queueAboutLeadsFit();

  // animateHeroTitle при смене языка не вызывается: иначе заголовок дёргается и раскладка едет
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

