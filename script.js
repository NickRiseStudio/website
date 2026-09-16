// State variables
let currentLang = 'en';
let activeTrackLang = 'en';
let activeGenre = 'all';
let activeTrackId = null;
let currentTrackPage = 0;

// Audio engine data
const trackAudioMap = {}; // { trackId: { audioA, audioB, source: 'before'|'after', volume: 0.9 } }

document.addEventListener('DOMContentLoaded', () => {
  initI18n();
  initPlayer();
  initServices();
  initFaq();
  initModalAndToast();
  initGsapAnimations();
  initMixerFaderScroll();
  initSmoothAnchorNavigation();
  initScrollSpy();
  initScrollToTop();
});

window.addEventListener('load', () => {
  if (typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.refresh();
  }
});

// Ensure ScrollTrigger recalibrates when web fonts finish downloading
if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
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
    } catch (e) {}
    renderI18nText();
    renderServices();
    renderFaq();
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
    } catch (e) {}

    renderI18nText();
    renderServices();
    renderFaq();
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

  // Do not call animateHeroTitle on language toggle to prevent visual jitter/layout shift
}

// --- PLAYER & MASTER DECK ENGINE ---
function getEnabledTracks() {
  if (!CONFIG || !CONFIG.tracks) return [];
  return CONFIG.tracks.filter(tr => 
    tr.enabled !== false && 
    tr.active !== false && 
    tr.visible !== false &&
    (!tr.lang || tr.lang === activeTrackLang)
  );
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

function setTrackLanguage(targetLang) {
  if (targetLang !== 'ru' && targetLang !== 'en') return;
  if (targetLang === activeTrackLang) return;
  activeTrackLang = targetLang;

  currentTrackPage = 0;
  updateTrackLangButtonsUI();

  const isPlaying = activeTrackId && isAudioPlaying(activeTrackId);
  const enabled = getEnabledTracks();

  // If NOT currently playing, update deck selection to the new language
  if (!isPlaying) {
    const matchingGenre = enabled.filter(tr => activeGenre === 'all' || tr.genre === activeGenre);
    if (matchingGenre.length === 0) {
      activeGenre = 'all';
      const filterBtns = document.querySelectorAll('.genre-filter-btn');
      filterBtns.forEach(b => {
        const isAll = b.getAttribute('data-genre') === 'all';
        const allMinW = isAll ? 'min-w-[92px] sm:min-w-[100px] flex items-center justify-center ' : '';
        if (isAll) {
          b.className = `${allMinW}genre-filter-btn px-3.5 py-2 text-xs font-bold rounded-xl transition-all bg-amber-500 text-slate-950 border border-amber-500 cursor-pointer shadow-md shadow-amber-500/20`;
        } else {
          b.className = `${allMinW}genre-filter-btn px-3.5 py-2 text-xs font-bold rounded-xl transition-all bg-[#090C12] border border-gray-800/80 text-gray-400 hover:text-white cursor-pointer`;
        }
      });
    }

    const tracksToPick = enabled.filter(tr => activeGenre === 'all' || tr.genre === activeGenre);
    if (tracksToPick.length > 0) {
      selectTrack(tracksToPick[0].id, false);
    } else if (enabled.length > 0) {
      selectTrack(enabled[0].id, false);
    }
  }

  // Smooth entrance animation exclusively for track cards
  renderTrackList(true);
  updateMasterDeckUI();
}

function getTracksPerPage() {
  if (window.innerWidth >= 1024) return 6; // Desktop: 3 columns x 2 rows
  if (window.innerWidth >= 640) return 6;  // Tablet: 2 columns x 3 rows
  return 5; // Mobile: 1 column x 5 rows
}

function prevTrackPage() {
  if (currentTrackPage > 0) {
    currentTrackPage--;
    renderTrackList(true);
  }
}

function nextTrackPage() {
  const perPage = getTracksPerPage();
  const filtered = getEnabledTracks().filter(tr => activeGenre === 'all' || tr.genre === activeGenre);
  const maxPages = Math.ceil(filtered.length / perPage);
  if (currentTrackPage < maxPages - 1) {
    currentTrackPage++;
    renderTrackList(true);
  }
}

function ensureTrackLoaded(trackId) {
  const item = trackAudioMap[trackId];
  if (!item) return;
  if (item.audioA.preload !== 'auto') {
    item.audioA.preload = 'auto';
    item.audioB.preload = 'auto';
    item.audioA.load();
    item.audioB.load();
  }
}

function initPlayer() {
  const allTracks = CONFIG && CONFIG.tracks ? CONFIG.tracks.filter(tr => tr.enabled !== false && tr.active !== false && tr.visible !== false) : [];

  // Set metadata preload initially so page load doesn't download audio upfront
  allTracks.forEach((track, index) => {
    if (trackAudioMap[track.id]) return;
    const audioA = new Audio(track.audioBefore);
    const audioB = new Audio(track.audioAfter);
    audioA.preload = 'metadata';
    audioB.preload = 'metadata';

    const handleAudioError = (el, type) => {
      el.addEventListener('error', () => {
        const fallbackSrc = `./audio/pophouse_1_${type}.mp3`;
        const fullFallback = new URL(fallbackSrc, window.location.href).href;
        if (el.src !== fullFallback) {
          el.src = fallbackSrc;
          el.load();
        }
      });
    };
    handleAudioError(audioA, 'before');
    handleAudioError(audioB, 'after');

    trackAudioMap[track.id] = {
      audioA,
      audioB,
      source: 'after',
      volume: 0.9,
      trackIndex: index + 1
    };

    // Никаких жёстких seek внутри воспроизведения: расхождение пары гасится
    // микро-коррекцией скорости той дорожки, которая сейчас не звучит.
    const handleTimeUpdate = () => {
      if (activeTrackId !== track.id) return;
      syncAudioPair(trackAudioMap[track.id]);
      updateDeckProgressUI();
    };

    audioA.addEventListener('timeupdate', handleTimeUpdate);
    audioB.addEventListener('timeupdate', handleTimeUpdate);
    audioA.addEventListener('loadedmetadata', () => {
      if (activeTrackId === track.id) updateDeckProgressUI();
    });
    audioB.addEventListener('loadedmetadata', () => {
      if (activeTrackId === track.id) updateDeckProgressUI();
    });

    audioA.addEventListener('ended', () => {
      if (activeTrackId === track.id) nextDeckTrack();
    });
    audioB.addEventListener('ended', () => {
      if (activeTrackId === track.id) nextDeckTrack();
    });
  });

  // Track Audio Language Switch (RU / EN)
  const trackLangBtns = document.querySelectorAll('.track-lang-btn');
  trackLangBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetLang = btn.getAttribute('data-track-lang');
      if (targetLang && targetLang !== activeTrackLang) {
        setTrackLanguage(targetLang);
      }
    });
  });
  updateTrackLangButtonsUI();

  const enabledTracks = getEnabledTracks();
  if (enabledTracks.length > 0) {
    activeTrackId = enabledTracks[0].id;
  }

  // Preload active track when user scrolls near player or hovers over it
  const triggerPreloadActive = () => {
    if (activeTrackId) ensureTrackLoaded(activeTrackId);
  };

  if ('IntersectionObserver' in window) {
    const playerSec = document.getElementById('player');
    if (playerSec) {
      const ioPlayer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          triggerPreloadActive();
          ioPlayer.disconnect();
        }
      }, { rootMargin: '350px 0px' });
      ioPlayer.observe(playerSec);
    }
  }

  const pSec = document.getElementById('player');
  if (pSec) {
    pSec.addEventListener('pointerenter', triggerPreloadActive, { once: true, passive: true });
    pSec.addEventListener('touchstart', triggerPreloadActive, { once: true, passive: true });
  }

  // Filter Buttons
  const filterBtns = document.querySelectorAll('.genre-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        const isAll = b.getAttribute('data-genre') === 'all';
        const allMinW = isAll ? 'min-w-[92px] sm:min-w-[100px] flex items-center justify-center ' : '';
        b.className = `${allMinW}genre-filter-btn px-3.5 py-2 text-xs font-bold rounded-xl transition-all bg-[#090C12] border border-gray-800/80 text-gray-400 hover:text-white cursor-pointer`;
      });
      const isTargetAll = btn.getAttribute('data-genre') === 'all';
      const targetMinW = isTargetAll ? 'min-w-[92px] sm:min-w-[100px] flex items-center justify-center ' : '';
      btn.className = `${targetMinW}genre-filter-btn px-3.5 py-2 text-xs font-bold rounded-xl transition-all bg-amber-500 text-slate-950 border border-amber-500 cursor-pointer shadow-md shadow-amber-500/20`;
      activeGenre = btn.getAttribute('data-genre');
      currentTrackPage = 0;
      
      const isPlaying = activeTrackId && isAudioPlaying(activeTrackId);
      const filtered = getEnabledTracks().filter(tr => activeGenre === 'all' || tr.genre === activeGenre);
      if (!isPlaying && filtered.length > 0 && !filtered.some(t => t.id === activeTrackId)) {
        selectTrack(filtered[0].id, false);
      } else {
        renderTrackList();
        updateMasterDeckUI();
      }
    });
  });

  window.addEventListener('resize', () => {
    renderTrackList();
  });

  // Touch Swipe for mobile track list
  const listContainer = document.getElementById('trackListContainer');
  if (listContainer) {
    let touchStartX = 0;
    listContainer.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    listContainer.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      if (touchStartX - touchEndX > 60) {
        nextTrackPage();
      } else if (touchEndX - touchStartX > 60) {
        prevTrackPage();
      }
    }, { passive: true });
  }

  initDeckSeekBar();
  updateMasterDeckUI();
  renderTrackList();
}

function showStickyPlayer() {
  const playerBar = document.getElementById('stickyPlayerBar');
  if (playerBar) {
    playerBar.classList.add('active');
    playerBar.classList.remove('translate-y-full');
    playerBar.classList.add('translate-y-0');
    document.body.classList.add('has-sticky-player');

    const barHeight = playerBar.offsetHeight;
    if (barHeight > 0) {
      document.documentElement.style.setProperty('--sticky-player-height', barHeight + 'px');
    }

    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
    if (window.NickRiseAnimations && window.NickRiseAnimations.updateRevealObserver) {
      window.NickRiseAnimations.updateRevealObserver();
    }
    setTimeout(() => {
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      if (window.NickRiseAnimations && window.NickRiseAnimations.updateRevealObserver) {
        window.NickRiseAnimations.updateRevealObserver();
      }
    }, 300);
    setTimeout(() => {
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      if (window.NickRiseAnimations && window.NickRiseAnimations.updateRevealObserver) {
        window.NickRiseAnimations.updateRevealObserver();
      }
    }, 960);
  }
}

function closeStickyPlayer() {
  if (activeTrackId) {
    const item = trackAudioMap[activeTrackId];
    if (item) {
      item.audioA.pause();
      item.audioB.pause();
    }
  }
  const playerBar = document.getElementById('stickyPlayerBar');
  if (playerBar) {
    playerBar.classList.remove('active');
    playerBar.classList.remove('translate-y-0');
    playerBar.classList.add('translate-y-full');
    document.body.classList.remove('has-sticky-player');
    document.documentElement.style.removeProperty('--sticky-player-height');

    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
    if (window.NickRiseAnimations && window.NickRiseAnimations.updateRevealObserver) {
      window.NickRiseAnimations.updateRevealObserver();
    }
    setTimeout(() => {
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      if (window.NickRiseAnimations && window.NickRiseAnimations.updateRevealObserver) {
        window.NickRiseAnimations.updateRevealObserver();
      }
    }, 300);
    setTimeout(() => {
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      if (window.NickRiseAnimations && window.NickRiseAnimations.updateRevealObserver) {
        window.NickRiseAnimations.updateRevealObserver();
      }
    }, 960);
  }
  renderTrackList();
}

function toggleTrack(trackId) {
  ensureTrackLoaded(trackId);
  if (activeTrackId === trackId) {
    const item = trackAudioMap[trackId];
    if (!item) return;

    if (isAudioPlaying(trackId)) {
      item.audioA.pause();
      item.audioB.pause();
    } else {
      prepareAudioPair(item);
      applyAudioVolumes(trackId);
      const pA = item.audioA.play();
      if (pA && pA.catch) pA.catch(err => console.warn('Play A:', err));
      const pB = item.audioB.play();
      if (pB && pB.catch) pB.catch(err => console.warn('Play B:', err));
      showStickyPlayer();
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
      prevItem.audioA.pause();
      prevItem.audioB.pause();
    }
  }

  activeTrackId = trackId;
  const item = trackAudioMap[trackId];

  if (item) {
    applyAudioVolumes(trackId);
    if (shouldPlay) {
      prepareAudioPair(item);
      const pA = item.audioA.play();
      if (pA && pA.catch) pA.catch(err => console.warn('Play A:', err));
      const pB = item.audioB.play();
      if (pB && pB.catch) pB.catch(err => console.warn('Play B:', err));
      showStickyPlayer();

      // Background prefetch adjacent track for zero delay
      setTimeout(() => {
        const enabled = getEnabledTracks();
        const currIdx = enabled.findIndex(t => t.id === trackId);
        if (currIdx >= 0 && enabled.length > 1) {
          const nextTr = enabled[(currIdx + 1) % enabled.length];
          if (nextTr) ensureTrackLoaded(nextTr.id);
        }
      }, 1500);
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
    item.audioA.pause();
    item.audioB.pause();
  } else {
    prepareAudioPair(item);
    applyAudioVolumes(activeTrackId);
    const pA = item.audioA.play();
    if (pA && pA.catch) pA.catch(err => console.warn('Play A:', err));
    const pB = item.audioB.play();
    if (pB && pB.catch) pB.catch(err => console.warn('Play B:', err));
    showStickyPlayer();

    // Background prefetch adjacent track for zero delay
    setTimeout(() => {
      const enabled = getEnabledTracks();
      const currIdx = enabled.findIndex(t => t.id === activeTrackId);
      if (currIdx >= 0 && enabled.length > 1) {
        const nextTr = enabled[(currIdx + 1) % enabled.length];
        if (nextTr) ensureTrackLoaded(nextTr.id);
      }
    }, 1500);
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
  const filtered = getEnabledTracks().filter(tr => activeGenre === 'all' || tr.genre === activeGenre);
  if (filtered.length === 0) return;

  const curIdx = filtered.findIndex(t => t.id === activeTrackId);
  let nextIdx = curIdx - 1;
  if (nextIdx < 0) nextIdx = filtered.length - 1;

  selectTrack(filtered[nextIdx].id, true);
}

function nextDeckTrack() {
  const filtered = getEnabledTracks().filter(tr => activeGenre === 'all' || tr.genre === activeGenre);
  if (filtered.length === 0) return;

  const curIdx = filtered.findIndex(t => t.id === activeTrackId);
  let nextIdx = curIdx + 1;
  if (nextIdx >= filtered.length) nextIdx = 0;

  selectTrack(filtered[nextIdx].id, true);
}

function updateMasterDeckUI() {
  const enabledTracks = getEnabledTracks();
  const track = (CONFIG && CONFIG.tracks) 
    ? (CONFIG.tracks.find(t => t.id === activeTrackId) || enabledTracks.find(t => t.id === activeTrackId)) 
    : enabledTracks.find(t => t.id === activeTrackId);
  if (!track) return;

  const currentDevice = getDeviceType();
  const item = trackAudioMap[activeTrackId] || { source: 'after', volume: 0.9 };
  const isPlaying = isAudioPlaying(activeTrackId);
  const genreText = resolveI18nValue(track.genreLabel, currentLang, currentDevice);
  const trackTitle = resolveDeviceText(track.title, currentDevice);
  const trackArtist = resolveDeviceText(track.artist, currentDevice);

  document.querySelectorAll('.deck-cover').forEach(el => { el.src = track.cover; });
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
}

function renderTrackList(animate = false) {
  const container = document.getElementById('trackListContainer');
  if (!container) return;

  const currentDevice = getDeviceType();
  // Мобильный вид карточек (вертикальный прямоугольник) — только < 640px.
  // getTracksPerPage() меняет количество карточек на границе 640 (5 ↔ 6),
  // поэтому при переходе mobile ⇄ tablet/desktop DOM всегда пересоздаётся.
  const isMobileView = window.innerWidth < 640;
  const currentView = isMobileView ? 'mobile' : 'desktop';
  const perPage = getTracksPerPage();
  const filtered = getEnabledTracks().filter(tr => activeGenre === 'all' || tr.genre === activeGenre);
  const totalItems = filtered.length;
  const maxPages = Math.ceil(totalItems / perPage) || 1;

  if (currentTrackPage >= maxPages) {
    currentTrackPage = Math.max(0, maxPages - 1);
  }

  const startIdx = currentTrackPage * perPage;
  const visibleTracks = filtered.slice(startIdx, startIdx + perPage);

  const existingCards = Array.from(container.children);
  const existingIds = existingCards.map(c => c.getAttribute('data-track-id'));
  const targetIds = visibleTracks.map(t => t.id);

  const canReuseDOM = existingIds.length === targetIds.length &&
    existingIds.every((id, idx) => id === targetIds[idx]) &&
    // Вид (mobile ⇄ desktop) влияет на СТРУКТУРУ карточки, поэтому при смене
    // вида DOM обязательно пересоздаём, даже если состав треков совпадает.
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

      itemCard.className = (isMobileView
        ? `p-3 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col gap-3 group ${
            isSelected 
              ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10' 
              : 'bg-[#0B0E15] border-gray-800/80 hover:border-amber-500/40 hover:bg-[#0F131E]'
          }`
        : `p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between gap-3 group ${
            isSelected 
              ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10' 
              : 'bg-[#0B0E15] border-gray-800/80 hover:border-amber-500/40 hover:bg-[#0F131E]'
          }`
      );

      const coverBox = itemCard.querySelector('.track-cover-box');
      if (coverBox) {
        coverBox.className = (isMobileView
          ? `track-cover-box relative w-full aspect-square rounded-xl overflow-hidden flex-shrink-0 border transition-colors duration-300 ${isSelected ? 'border-amber-500' : 'border-gray-800'}`
          : `track-cover-box relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden flex-shrink-0 border transition-colors duration-300 ${isSelected ? 'border-amber-500' : 'border-gray-800'}`
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
        genreBadge.className = (isMobileView
          // Жанр по центру и чуть крупнее, чтобы проще было заметить жанр трека.
          ? `track-genre-badge self-center text-[11px] font-bold px-3 py-1 rounded-full transition-colors duration-300 ${isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-gray-800 text-amber-400'}`
          : `track-genre-badge text-[11px] font-extrabold px-3 py-1 rounded-full transition-colors duration-300 ${isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-gray-800 text-amber-400'}`
        );
      }

      const playBtn = itemCard.querySelector('.track-play-btn');
      if (playBtn) {
        playBtn.className = (isMobileView
          // Кнопка-контейнер крупнее (64px) — сам треугольник внутри теперь 48px,
          // его хорошо видно на большом квадратном фото.
          ? `track-play-btn absolute inset-0 z-10 m-auto w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110 cursor-pointer ${
              isSelected
                ? 'text-amber-400 hover:text-amber-300'
                : 'text-white hover:text-amber-400'
            } active:scale-95`
          : `track-play-btn p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer ${
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
      emptyDiv.textContent = currentLang === 'ru' ? 'В этом жанре пока нет доступных треков' : 'No tracks available in this genre yet';
      container.appendChild(emptyDiv);
    }

    visibleTracks.forEach(track => {
      const isSelected = activeTrackId === track.id;
      const isPlaying = isSelected && isAudioPlaying(track.id);
      const genreText = resolveI18nValue(track.genreLabel, currentLang, currentDevice);
      const trackTitle = resolveDeviceText(track.title, currentDevice);
      const trackArtist = resolveDeviceText(track.artist, currentDevice);

      const itemCard = document.createElement('div');
      itemCard.id = `track-item-${track.id}`;
      itemCard.setAttribute('data-track-id', track.id);
      itemCard.setAttribute('data-view', currentView);
      itemCard.onclick = () => toggleTrack(track.id);
      itemCard.className = (isMobileView
        ? `p-3 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col gap-3 group ${
            isSelected 
              ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10' 
              : 'bg-[#0B0E15] border-gray-800/80 hover:border-amber-500/40 hover:bg-[#0F131E]'
          }`
        : `p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between gap-3 group ${
            isSelected 
              ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10' 
              : 'bg-[#0B0E15] border-gray-800/80 hover:border-amber-500/40 hover:bg-[#0F131E]'
          }`
      );

      const trackCoverBox = document.createElement('div');
      trackCoverBox.className = (isMobileView
        ? `track-cover-box relative w-full aspect-square rounded-xl overflow-hidden flex-shrink-0 border transition-colors duration-300 ${isSelected ? 'border-amber-500' : 'border-gray-800'}`
        : `track-cover-box relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden flex-shrink-0 border transition-colors duration-300 ${isSelected ? 'border-amber-500' : 'border-gray-800'}`
      );

      const coverImg = document.createElement('img');
      coverImg.src = track.cover;
      coverImg.alt = trackTitle;
      coverImg.loading = 'lazy';
      coverImg.decoding = 'async';
      coverImg.className = 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-300';
      coverImg.onerror = () => { coverImg.onerror = null; coverImg.src = './image/cover1.webp'; };
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
      titleEl.className = (isMobileView
        ? 'track-card-title text-sm font-extrabold text-white truncate group-hover:text-amber-400 transition-colors'
        : 'track-card-title text-xs sm:text-sm font-extrabold text-white truncate group-hover:text-amber-400 transition-colors'
      );
      titleEl.textContent = trackTitle;
      const artistEl = document.createElement('p');
      artistEl.className = (isMobileView
        ? 'track-card-artist text-xs text-gray-400 truncate mt-0.5'
        : 'track-card-artist text-[11px] text-gray-400 truncate mt-0.5'
      );
      artistEl.textContent = trackArtist;
      meta.appendChild(titleEl);
      meta.appendChild(artistEl);

      const genreSpan = document.createElement('span');
      genreSpan.className = (isMobileView
        // Жанр по центру и чуть крупнее, чтобы проще было заметить жанр трека.
        ? `track-genre-badge self-center text-[11px] font-bold px-3 py-1 rounded-full transition-colors duration-300 ${isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-gray-800 text-amber-400'}`
        : `track-genre-badge text-[11px] font-extrabold px-3 py-1 rounded-full transition-colors duration-300 ${isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-gray-800 text-amber-400'}`
      );
      genreSpan.textContent = genreText;

      if (isMobileView) {
        // ── МОБИЛЬНЫЙ ВИД: вертикальный прямоугольник ─────────────────────
        // Квадратное фото на всю ширину карточки, по центру фото кнопка
        // play/pause «треугольником» без фона, ниже название + артист,
        // ниже жанр.

        const playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
        playBtn.onclick = (ev) => { ev.stopPropagation(); toggleTrack(track.id); };
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
        // ── ПЛАНШЕТ / ДЕСКТОП: прежний горизонтальный вид ──────────────────
        const playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
        playBtn.onclick = (ev) => { ev.stopPropagation(); toggleTrack(track.id); };
        playBtn.className = `track-play-btn p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer ${
          isSelected 
            ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
            : 'bg-gray-900 text-gray-300 hover:bg-amber-500 hover:text-slate-950'
        }`;
        playBtn.innerHTML = `<svg class="track-play-svg w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="${isPlaying ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/></svg>`;

        const leftRow = document.createElement('div');
        leftRow.className = 'flex items-center gap-3.5 min-w-0 flex-1';
        leftRow.appendChild(trackCoverBox);
        meta.className = 'min-w-0 flex-1';
        leftRow.appendChild(meta);

        const rightRow = document.createElement('div');
        rightRow.className = 'flex items-center gap-2 flex-shrink-0';
        rightRow.appendChild(genreSpan);
        rightRow.appendChild(playBtn);

        itemCard.appendChild(leftRow);
        itemCard.appendChild(rightRow);
      }

      container.appendChild(itemCard);
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
}

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
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
      if (titleEl) titleEl.textContent = title;

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

    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      if (window.innerWidth < 640) {
        scrollToServiceCard(idx);
      }
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

        <h3 class="service-card-title text-xl sm:text-2xl font-extrabold text-white mb-1.5 tracking-tight">${title}</h3>
        <p class="service-card-desc text-sm text-gray-400 mb-4 leading-relaxed sm:max-lg:text-center">${desc}</p>

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
  if (typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.refresh();
  }
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
      }
    });
    return;
  }

  const containerWidth = container.clientWidth || window.innerWidth;
  const containerCenter = container.scrollLeft + (containerWidth / 2);

  // Координаты карточек внутри прокручиваемой области: padding-left контейнера
  // плюс смещение от первой карточки. Не зависят ни от offsetParent, ни от
  // coverflow-трансформа, поэтому coverflow считается точно.
  const padding = parseFloat(window.getComputedStyle(container).paddingLeft) || 0;
  const firstCard = cards[0];

  let activeIndex = 0;
  let minDiff = Infinity;

  Array.from(cards).forEach((card, idx) => {
    const cardWidth = card.offsetWidth || 290;
    const cardCenter = padding + (card.offsetLeft - firstCard.offsetLeft) + (cardWidth / 2);
    const diff = cardCenter - containerCenter;
    const absDiff = Math.abs(diff);

    if (absDiff < minDiff) {
      minDiff = absDiff;
      activeIndex = idx;
    }

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

    if (withTransition) {
      card.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease, z-index 0.4s step-start';
    } else {
      card.style.transition = 'none';
    }

    // Помечаем, что transform/opacity карточки выставил именно coverflow — по
    // этому маркеру они снимаются при возврате к сетке (планшет/десктоп).
    card.dataset.nrCoverflow = '1';
    card.style.transform = `translate3d(${shiftX.toFixed(1)}px, 0, 0) scale(${scale.toFixed(3)}) rotateY(${rotateY.toFixed(1)}deg)`;
    card.style.opacity = opacity.toFixed(2);
    card.style.zIndex = zIndex;
  });

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

      const qSpan = card.querySelector('.faq-q-text') || card.querySelector('button > span');
      if (qSpan) qSpan.textContent = q;

      const aP = card.querySelector('.faq-content-wrapper p');
      if (aP) aP.innerHTML = a;

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
          <p>${a}</p>
        </div>
      </div>
    `;
    container.appendChild(el);
  });

  setTimeout(() => {
    if (typeof initFaqGsapAnimation === 'function') {
      initFaqGsapAnimation();
    }
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
  }, 50);
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
            if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
          });
        }
      }
    );
  } else {
    body.style.height = 'auto';
    body.style.opacity = '1';
    requestAnimationFrame(() => {
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
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
          if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
        });
      }
    });
  } else {
    body.style.height = '0px';
    body.style.opacity = '0';
    body.style.display = 'none';
    requestAnimationFrame(() => {
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
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
  if (contactActive || aboutActive) return;

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

  // Prevent scroll propagation from backdrop area
  [contactModal, aboutModal].forEach(modalEl => {
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

  // Если прокрутили до самого низа страницы — гарантированно активны Контакты
  if (scrollY + windowHeight >= documentHeight - 50) {
    setActiveNavSection('contacts');
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

  const NAV_SECTIONS = ['player', 'services', 'faq', 'contacts'];

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

  // Проверяем секции в обратном порядке (снизу вверх: contacts -> faq -> services -> player):
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
        if (targetId && ['player', 'services', 'faq', 'contacts'].includes(targetId)) {
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
  const filtersContainer = section.querySelector('#playerContentContainer .flex.flex-wrap');
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

  const filterBtns = filtersContainer ? filtersContainer.querySelectorAll('.genre-filter-btn') : [];
  const trackContainer = document.getElementById('trackListContainer');
  const trackCards = trackContainer ? trackContainer.querySelectorAll(':scope > *') : [];

  // Respect prefers-reduced-motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (sectionHeader) gsap.set(sectionHeader, { opacity: 1, y: 0 });
    if (filterBtns.length) gsap.set(filterBtns, { opacity: 1, y: 0, scale: 1 });
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
    if (filterBtns.length) gsap.set(filterBtns, { y: 14, opacity: 0, scale: 0.95 });
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

  // 2. GENRE FILTERS TIMELINE (Buttons "Все жанры", "Pop/House", "Rock/Metal", "Rap/R&B")
  // Enters at 86%, reverses visibly when scrolling up past 86%
  if (filtersContainer && filterBtns.length) {
    const filtersTl = gsap.timeline({
      scrollTrigger: {
        trigger: filtersContainer,
        start: computeDynamicStart(86),
        end: 'bottom top',
        toggleActions: 'play none none reverse',
        onLeaveBack: () => {
          filtersTl.timeScale(1.6).reverse();
        },
        onEnter: () => {
          filtersTl.timeScale(1.0).play();
        }
      }
    });

    filtersTl.fromTo(
      filterBtns,
      { y: 14, opacity: 0, scale: 0.95 },
      { y: 0, opacity: 1, scale: 1, duration: 0.38, stagger: 0.05, ease: 'back.out(1.4)' },
      0
    );
    playerTimelines.push(filtersTl);
  }

  // 3. TRACK LIST GRID TIMELINE (Individual track cards with cover art and play buttons)
  // Enters at 83%, reverses visibly when scrolling up past 83%
  initPlayerTrackCardsTimeline(true);

  // 4. PAGINATION CONTROLS TIMELINE (Prev/Next buttons + Page info / Dots)
  // Enters at 80%, reverses visibly when scrolling up past 80%
  if (paginationContainer) {
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

  function updateFaderUI(scrollPercent) {
    const railH = rail.clientHeight || 400;
    const knobH = knob.offsetHeight || 24;
    const maxTravel = Math.max(0, railH - knobH);
    const topPx = Math.max(0, Math.min(maxTravel, scrollPercent * maxTravel));
    knob.style.top = `${topPx}px`;

    const faderLevel = 1 - Math.max(0, Math.min(1, scrollPercent));

    if (dbLabel) {
      if (faderLevel < 0.04) {
        dbLabel.textContent = '-INF';
      } else {
        const dbVal = ((faderLevel - 0.75) * 24).toFixed(1);
        dbLabel.textContent = `${dbVal > 0 ? '+' : ''}${dbVal}dB`;
      }
    }

    if (totalLeds > 0) {
      const activeCount = Math.round(faderLevel * totalLeds);

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

  function getScrollMetrics() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const scrollHeight = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
    const clientHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const maxScroll = Math.max(1, scrollHeight - clientHeight);
    return { scrollTop, maxScroll };
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

  function applyScrollFromPointerY(clientY) {
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
