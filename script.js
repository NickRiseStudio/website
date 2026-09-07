// State variables
let currentLang = 'en';
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
});

// --- AUTOMATIC REGION & LANGUAGE DETECTION ---
function detectUserLanguage() {
  // 1. Check if user already manually selected a preferred language
  try {
    const saved = localStorage.getItem('nick_rise_lang');
    if (saved === 'ru' || saved === 'en') {
      return saved;
    }
  } catch (e) {}

  // 2. Check browser languages (navigator.languages or navigator.language)
  try {
    const navLangs = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || navigator.userLanguage || ''];

    const cisLangs = ['ru', 'be', 'kk', 'uk', 'ky', 'tg', 'uz', 'hy', 'az', 'mo'];
    for (let i = 0; i < navLangs.length; i++) {
      const l = String(navLangs[i] || '').toLowerCase().trim();
      if (!l) continue;
      const base = l.split('-')[0].split('_')[0];
      if (cisLangs.includes(base)) {
        return 'ru';
      }
    }
  } catch (e) {}

  // 3. Check timezone as additional regional indicator for CIS countries
  try {
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    const cisTimezones = [
      'moscow', 'minsk', 'kiev', 'kyiv', 'samara', 'yekaterinburg', 'kaliningrad',
      'volgograd', 'saratov', 'ulyanovsk', 'astrakhan', 'kirov', 'almaty', 'tashkent',
      'bishkek', 'yerevan', 'baku', 'dushanbe', 'novosibirsk', 'krasnoyarsk', 'irkutsk',
      'yakutsk', 'vladivostok', 'sakhalin', 'magadan', 'kamchatka', 'omsk', 'barnaul',
      'tomsk', 'novokuznetsk', 'chita', 'anadyr', 'qyzylorda', 'aqtobe', 'aqtau', 'atyrau', 'oral'
    ];
    if (cisTimezones.some(city => tz.includes(city))) {
      return 'ru';
    }
  } catch (e) {}

  // 4. Default to international English for all other regions
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

function toggleLanguage() {
  setLanguage(currentLang === 'ru' ? 'en' : 'ru', true);
}

function setLanguage(lang, savePreference = true) {
  if (lang !== 'ru' && lang !== 'en') lang = 'en';
  currentLang = lang;

  if (savePreference) {
    try {
      localStorage.setItem('nick_rise_lang', lang);
    } catch (e) {}
  }

  try {
    document.documentElement.lang = lang;
  } catch (e) {}

  const btnRu = document.getElementById('btnLangRu');
  const btnEn = document.getElementById('btnLangEn');

  if (btnRu && btnEn) {
    if (lang === 'ru') {
      btnRu.className = 'px-2 sm:px-3 py-1 text-xs font-bold rounded-md sm:rounded-lg transition-all bg-amber-500 text-slate-950 font-extrabold pointer-events-none';
      btnEn.className = 'px-2 sm:px-3 py-1 text-xs font-bold rounded-md sm:rounded-lg transition-all text-gray-400 hover:text-white pointer-events-none';
    } else {
      btnEn.className = 'px-2 sm:px-3 py-1 text-xs font-bold rounded-md sm:rounded-lg transition-all bg-amber-500 text-slate-950 font-extrabold pointer-events-none';
      btnRu.className = 'px-2 sm:px-3 py-1 text-xs font-bold rounded-md sm:rounded-lg transition-all text-gray-400 hover:text-white pointer-events-none';
    }
  }

  renderI18nText();
  renderServices();
  renderFaq();
  updateMasterDeckUI();
  renderTrackList();
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

  if (typeof window !== 'undefined' && window.NickRiseAnimations && typeof window.NickRiseAnimations.animateHeroTitle === 'function') {
    window.NickRiseAnimations.animateHeroTitle();
  }
}

// --- PLAYER & MASTER DECK ENGINE ---
function getEnabledTracks() {
  if (!CONFIG || !CONFIG.tracks) return [];
  return CONFIG.tracks.filter(tr => tr.enabled !== false && tr.active !== false && tr.visible !== false);
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
  const enabledTracks = getEnabledTracks();

  // Load all enabled tracks immediately on page load so switching is instant without delays
  enabledTracks.forEach((track, index) => {
    const audioA = new Audio(track.audioBefore);
    const audioB = new Audio(track.audioAfter);
    audioA.preload = 'auto';
    audioB.preload = 'auto';
    audioA.load();
    audioB.load();

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

    const handleTimeUpdate = () => {
      if (activeTrackId === track.id) {
        if (Math.abs(audioA.currentTime - audioB.currentTime) > 0.25) {
          audioB.currentTime = audioA.currentTime;
        }
        updateDeckProgressUI();
      }
    };

    audioA.addEventListener('timeupdate', handleTimeUpdate);
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

  if (enabledTracks.length > 0) {
    activeTrackId = enabledTracks[0].id;
  }

  // Filter Buttons
  const filterBtns = document.querySelectorAll('.genre-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.className = 'genre-filter-btn px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold rounded-xl transition-all bg-[#090C12] border border-gray-800/80 text-gray-400 hover:text-white cursor-pointer');
      btn.className = 'genre-filter-btn px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold rounded-xl transition-all bg-amber-500 text-slate-950 font-black cursor-pointer shadow-md shadow-amber-500/20';
      activeGenre = btn.getAttribute('data-genre');
      currentTrackPage = 0;
      
      const filtered = getEnabledTracks().filter(tr => activeGenre === 'all' || tr.genre === activeGenre);
      if (filtered.length > 0 && !filtered.some(t => t.id === activeTrackId)) {
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
      applyAudioVolumes(trackId);
      if (Math.abs(item.audioA.currentTime - item.audioB.currentTime) > 0.05) {
        item.audioB.currentTime = item.audioA.currentTime;
      }
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
      if (Math.abs(item.audioA.currentTime - item.audioB.currentTime) > 0.05) {
        item.audioB.currentTime = item.audioA.currentTime;
      }
      const pA = item.audioA.play();
      if (pA && pA.catch) pA.catch(err => console.warn('Play A:', err));
      const pB = item.audioB.play();
      if (pB && pB.catch) pB.catch(err => console.warn('Play B:', err));
      showStickyPlayer();
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
    applyAudioVolumes(activeTrackId);
    if (Math.abs(item.audioA.currentTime - item.audioB.currentTime) > 0.05) {
      item.audioB.currentTime = item.audioA.currentTime;
    }
    const pA = item.audioA.play();
    if (pA && pA.catch) pA.catch(err => console.warn('Play A:', err));
    const pB = item.audioB.play();
    if (pB && pB.catch) pB.catch(err => console.warn('Play B:', err));
    showStickyPlayer();
  }

  updateMasterDeckUI();
  renderTrackList(false);
}

function switchDeckSource(src) {
  if (!activeTrackId) return;
  const item = trackAudioMap[activeTrackId];
  if (!item) return;

  item.source = src;

  if (src === 'before') {
    item.audioA.currentTime = item.audioB.currentTime;
  } else {
    item.audioB.currentTime = item.audioA.currentTime;
  }

  applyAudioVolumes(activeTrackId);
  updateMasterDeckUI();
}

function toggleDeckSource() {
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
  applyAudioVolumes(activeTrackId);
}

function applyAudioVolumes(trackId) {
  const item = trackAudioMap[trackId];
  if (!item) return;

  if (item.source === 'before') {
    item.audioA.volume = item.volume;
    item.audioB.volume = 0;
  } else {
    item.audioA.volume = 0;
    item.audioB.volume = item.volume;
  }
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
  const dur = item.audioA.duration || item.audioB.duration || 0;

  if (dur > 0) {
    const newTime = (clickX / rect.width) * dur;
    item.audioA.currentTime = newTime;
    item.audioB.currentTime = newTime;
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
    const dur = item.audioA.duration || item.audioB.duration || 0;

    if (dur > 0) {
      const newTime = (clickX / rect.width) * dur;
      item.audioA.currentTime = newTime;
      item.audioB.currentTime = newTime;
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
  const track = enabledTracks.find(t => t.id === activeTrackId);
  if (!track) return;

  const currentDevice = getDeviceType();
  const item = trackAudioMap[activeTrackId] || { source: 'after', volume: 0.9 };
  const isPlaying = isAudioPlaying(activeTrackId);
  const genreText = resolveI18nValue(track.genreLabel, currentLang, currentDevice);
  const trackTitle = resolveDeviceText(track.title, currentDevice);
  const trackArtist = resolveDeviceText(track.artist, currentDevice);
  const t = CONFIG.i18n[currentLang];

  document.querySelectorAll('.deck-cover').forEach(el => { el.src = track.cover; });
  document.querySelectorAll('.deck-title').forEach(el => { el.textContent = trackTitle; });
  document.querySelectorAll('.deck-artist').forEach(el => { el.textContent = trackArtist; });
  document.querySelectorAll('.deck-genre').forEach(el => { el.textContent = genreText; });

  const totalTracks = enabledTracks.length;
  const currentIdx = enabledTracks.findIndex(t => t.id === activeTrackId);
  const trackNum = (currentIdx >= 0 ? currentIdx + 1 : 1).toString().padStart(2, '0');
  document.querySelectorAll('.deck-index').forEach(el => { el.textContent = `${trackNum} / ${totalTracks}`; });

  // Source Buttons & LEDs
  const btnsBefore = document.querySelectorAll('.deck-btn-before');
  const btnsAfter = document.querySelectorAll('.deck-btn-after');
  const ledsBefore = document.querySelectorAll('.deck-led-before');
  const ledsAfter = document.querySelectorAll('.deck-led-after');
  const modeLabels = document.querySelectorAll('.deck-mode-label');

  if (item.source === 'before') {
    btnsBefore.forEach(el => {
      el.classList.add('bg-amber-500', 'text-slate-950', 'font-black', 'shadow-md');
      el.classList.remove('text-gray-400', 'hover:text-white', 'bg-transparent');
    });
    btnsAfter.forEach(el => {
      el.classList.remove('bg-amber-500', 'text-slate-950', 'font-black', 'shadow-md');
      el.classList.add('text-gray-400', 'hover:text-white', 'bg-transparent');
    });
    ledsBefore.forEach(el => { el.className = 'deck-led-before w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full vu-led-green animate-pulse flex-shrink-0'; });
    ledsAfter.forEach(el => { el.className = 'deck-led-after w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full bg-gray-600 flex-shrink-0'; });
    modeLabels.forEach(el => { el.textContent = resolveDeviceText(t.player.beforeLabel, currentDevice) || 'BEFORE (MIX)'; });
  } else {
    btnsAfter.forEach(el => {
      el.classList.add('bg-amber-500', 'text-slate-950', 'font-black', 'shadow-md');
      el.classList.remove('text-gray-400', 'hover:text-white', 'bg-transparent');
    });
    btnsBefore.forEach(el => {
      el.classList.remove('bg-amber-500', 'text-slate-950', 'font-black', 'shadow-md');
      el.classList.add('text-gray-400', 'hover:text-white', 'bg-transparent');
    });
    ledsAfter.forEach(el => { el.className = 'deck-led-after w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full vu-led-green animate-pulse flex-shrink-0'; });
    ledsBefore.forEach(el => { el.className = 'deck-led-before w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full bg-gray-600 flex-shrink-0'; });
    modeLabels.forEach(el => { el.textContent = resolveDeviceText(t.player.afterLabel, currentDevice) || 'AFTER (MASTER)'; });
  }

  // Play Button & Icons
  const playIcons = document.querySelectorAll('.deck-play-icon');
  const playTexts = document.querySelectorAll('.deck-play-text');
  const playBtns = document.querySelectorAll('.deck-play-btn');

  playIcons.forEach(el => {
    el.innerHTML = isPlaying 
      ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>' 
      : '<path d="M8 5v14l11-7z"/>';
  });
  playTexts.forEach(el => {
    el.textContent = isPlaying ? 'PAUSE' : 'PLAY';
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

  const cur = item.audioA.currentTime || 0;
  const dur = item.audioA.duration || 0;
  const pct = dur > 0 ? (cur / dur) * 100 : 0;

  const progressBar = document.getElementById('deckProgressBar');
  const curText = document.getElementById('deckCurTime');
  const durText = document.getElementById('deckDurTime');

  if (progressBar) progressBar.style.width = `${pct}%`;
  if (curText) curText.textContent = formatTime(cur);
  if (durText) durText.textContent = formatTime(dur);
}

function renderTrackList(animate = false) {
  const container = document.getElementById('trackListContainer');
  if (!container) return;

  const currentDevice = getDeviceType();
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
    existingIds.every((id, idx) => id === targetIds[idx]);

  if (canReuseDOM) {
    visibleTracks.forEach(track => {
      const isSelected = activeTrackId === track.id;
      const isPlaying = isSelected && isAudioPlaying(track.id);
      const genreText = resolveI18nValue(track.genreLabel, currentLang, currentDevice);
      const trackTitle = resolveDeviceText(track.title, currentDevice);
      const trackArtist = resolveDeviceText(track.artist, currentDevice);

      const itemCard = document.getElementById(`track-item-${track.id}`);
      if (!itemCard) return;

      itemCard.className = `p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between gap-3 group ${
        isSelected 
          ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10' 
          : 'bg-[#0B0E15] border-gray-800/80 hover:border-amber-500/40 hover:bg-[#0F131E]'
      }`;

      const coverBox = itemCard.querySelector('.track-cover-box');
      if (coverBox) {
        coverBox.className = `track-cover-box relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden flex-shrink-0 border transition-colors duration-300 ${isSelected ? 'border-amber-500' : 'border-gray-800'}`;
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
        genreBadge.className = `track-genre-badge text-[9px] font-extrabold px-2 py-0.5 rounded-full transition-colors duration-300 ${isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-gray-800 text-amber-400'}`;
      }

      const playBtn = itemCard.querySelector('.track-play-btn');
      if (playBtn) {
        playBtn.className = `track-play-btn p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer ${
          isSelected 
            ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
            : 'bg-gray-900 text-gray-300 hover:bg-amber-500 hover:text-slate-950'
        }`;
      }

      const playSvgPath = itemCard.querySelector('.track-play-svg path');
      if (playSvgPath) {
        playSvgPath.setAttribute('d', isPlaying ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z');
      }
    });
  } else {
    container.innerHTML = '';

    visibleTracks.forEach(track => {
      const isSelected = activeTrackId === track.id;
      const isPlaying = isSelected && isAudioPlaying(track.id);
      const genreText = resolveI18nValue(track.genreLabel, currentLang, currentDevice);
      const trackTitle = resolveDeviceText(track.title, currentDevice);
      const trackArtist = resolveDeviceText(track.artist, currentDevice);

      const itemCard = document.createElement('div');
      itemCard.id = `track-item-${track.id}`;
      itemCard.setAttribute('data-track-id', track.id);
      itemCard.onclick = () => toggleTrack(track.id);
      itemCard.className = `p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer flex items-center justify-between gap-3 group ${
        isSelected 
          ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10' 
          : 'bg-[#0B0E15] border-gray-800/80 hover:border-amber-500/40 hover:bg-[#0F131E]'
      }`;

      itemCard.innerHTML = `
        <div class="flex items-center gap-3.5 min-w-0 flex-1">
          <div class="track-cover-box relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden flex-shrink-0 border transition-colors duration-300 ${isSelected ? 'border-amber-500' : 'border-gray-800'}">
            <img src="${track.cover}" alt="${trackTitle}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            <div class="track-live-overlay absolute inset-0 bg-black/60 items-center justify-center" style="display: ${isPlaying ? 'flex' : 'none'};">
              <span class="w-2.5 h-2.5 rounded-full vu-led-green animate-ping"></span>
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <h4 class="track-card-title text-xs sm:text-sm font-extrabold text-white truncate group-hover:text-amber-400 transition-colors">
              ${trackTitle}
            </h4>
            <p class="track-card-artist text-[11px] text-gray-400 truncate mt-0.5">
              ${trackArtist}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="track-genre-badge text-[9px] font-extrabold px-2 py-0.5 rounded-full transition-colors duration-300 ${isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-gray-800 text-amber-400'}">
            ${genreText}
          </span>
          <button
            type="button"
            onclick="event.stopPropagation(); toggleTrack('${track.id}')"
            class="track-play-btn p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer ${
              isSelected 
                ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
                : 'bg-gray-900 text-gray-300 hover:bg-amber-500 hover:text-slate-950'
            }"
          >
            <svg class="track-play-svg w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="${isPlaying ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/>
            </svg>
          </button>
        </div>
      `;

      container.appendChild(itemCard);
    });

    if (animate && typeof gsap !== 'undefined' && container.children.length > 0) {
      gsap.fromTo(
        container.children,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.28, stagger: 0.04, ease: 'power2.out', clearProps: 'transform,opacity' }
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
      ? 'service-mobile-card popular-rack-card p-6 md:p-8 flex flex-col justify-between sm:transition-all sm:duration-300 transform w-[78vw] max-w-[310px] sm:w-auto sm:max-w-none flex-shrink-0 snap-center cursor-pointer select-none'
      : 'service-mobile-card rack-card p-6 md:p-8 flex flex-col justify-between sm:transition-all sm:duration-300 transform w-[78vw] max-w-[310px] sm:w-auto sm:max-w-none flex-shrink-0 snap-center cursor-pointer select-none';

    // Set initial custom attribute
    card.setAttribute('data-card-index', idx);

    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      if (window.innerWidth < 640) {
        scrollToServiceCard(idx);
      }
    });

    let featuresHtml = features.map(f => `
      <li class="flex items-start gap-3 text-sm text-gray-300">
        <svg class="w-4 h-4 text-emerald-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>${f}</span>
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
      ${s.isPopular ? `<div class="absolute -top-3.5 left-1/2 -translate-x-1/2"><span class="popular-badge uppercase tracking-wider">${popularBadgeText}</span></div>` : ''}

      <div>
        <div class="flex justify-between items-center mb-4 opacity-40">
          <div class="rack-bolt"></div>
          <div class="text-[10px] font-mono text-gray-400 tracking-widest uppercase">
            ${rackUnitText}
          </div>
          <div class="rack-bolt"></div>
        </div>

        <h3 class="text-2xl font-extrabold text-white mb-2 tracking-tight">${title}</h3>
        <p class="service-card-desc text-sm text-gray-400 mb-6 leading-relaxed sm:max-lg:text-center">${desc}</p>

        <ul class="space-y-3 mb-6">
          ${featuresHtml}
        </ul>
      </div>

      <div>
        <div class="h-px bg-gray-800/80 my-6"></div>

        <div class="flex items-center justify-between gap-4">
          <div class="flex flex-col">
            <span class="text-xs font-mono text-gray-400 uppercase tracking-wider">${fromLabel}</span>
            <span class="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent tracking-tight">${displayPrice}</span>
          </div>

          <button
            onclick="openContactModal()"
            class="py-3 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl transition-all duration-200 shadow-md shadow-amber-500/20 active:scale-95 text-sm sm:text-base cursor-pointer flex items-center gap-1.5 flex-shrink-0"
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
  container.addEventListener('touchstart', () => { userInteractedServices = true; }, { passive: true });
  container.addEventListener('pointerdown', () => { userInteractedServices = true; }, { passive: true });
  window.removeEventListener('resize', onServicesResize);
  window.addEventListener('resize', onServicesResize, { passive: true });

  const initMobileServicesPosition = () => {
    if (window.innerWidth < 640 && !userInteractedServices) {
      scrollToServiceCard(1, 'instant');
    }
    updateServicesDots(true);
  };

  // Run immediately and after fonts/layout settle
  initMobileServicesPosition();
  requestAnimationFrame(initMobileServicesPosition);
  setTimeout(initMobileServicesPosition, 60);
  setTimeout(initMobileServicesPosition, 200);
  setTimeout(initMobileServicesPosition, 500);

  // Ensure card 1 is centered when user scrolls to services section
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !userInteractedServices && window.innerWidth < 640) {
          scrollToServiceCard(1, 'instant');
        }
      });
    }, { threshold: 0.1 });
    observer.observe(container);
  }
}

let userInteractedServices = false;

function onServicesResize() {
  updateServicesDots(true);
}

let isServicesScrollTicking = false;
function onServicesScroll() {
  if (!isServicesScrollTicking) {
    requestAnimationFrame(() => {
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
  if (cards && cards[index]) {
    const card = cards[index];
    const card0 = cards[0];
    
    let targetScrollLeft = 0;
    if (index > 0 && card0) {
      const delta = card.offsetLeft - card0.offsetLeft;
      targetScrollLeft = delta > 0 ? delta : index * 270;
    }
    
    if (behavior === 'instant') {
      container.scrollLeft = targetScrollLeft;
      updateServicesDots(false);
    } else {
      container.scrollTo({
        left: targetScrollLeft,
        behavior: 'smooth'
      });
    }
  }
}

function updateServicesDots(withTransition = false) {
  const container = document.getElementById('servicesContainer');
  if (!container) return;

  const cards = container.children;
  if (!cards.length) return;

  if (window.innerWidth >= 640) {
    Array.from(cards).forEach(card => {
      card.style.transform = '';
      card.style.opacity = '';
      card.style.zIndex = '';
      card.style.transition = '';
      card.style.boxShadow = '';
    });
    return;
  }

  const containerWidth = container.clientWidth || window.innerWidth;
  const containerCenter = container.scrollLeft + (containerWidth / 2);
  let activeIndex = 0;
  let minDiff = Infinity;

  Array.from(cards).forEach((card, idx) => {
    const cardWidth = card.offsetWidth || 290;
    const cardCenter = card.offsetLeft + (cardWidth / 2);
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
  container.innerHTML = '';

  CONFIG.faqData.forEach((item, index) => {
    const qRaw = currentLang === 'ru' ? item.qRu : item.qEn;
    const aRaw = currentLang === 'ru' ? item.aRu : item.aEn;
    const q = resolveDeviceText(qRaw, currentDevice);
    const rawA = resolveDeviceText(aRaw, currentDevice);
    const a = (rawA || '').replace(/\n/g, '<br/>');
    const itemKey = `faq-${index}`;

    const el = document.createElement('div');
    el.className = 'rack-card overflow-hidden transition-all duration-300 border border-gray-800/80';
    el.innerHTML = `
      <button
        onclick="toggleFaq('${itemKey}')"
        class="w-full p-5 sm:p-6 text-left flex justify-between items-center gap-4 group focus:outline-none cursor-pointer select-none"
        aria-expanded="false"
      >
        <span class="text-base sm:text-lg font-bold text-gray-100 group-hover:text-amber-400 transition-colors">
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
  const targetHeight = body.offsetHeight;
  body.style.height = '0px';

  if (typeof gsap !== 'undefined') {
    gsap.killTweensOf(body);
    gsap.fromTo(body,
      { height: 0, opacity: 0 },
      {
        height: targetHeight,
        opacity: 1,
        duration: 0.55,
        ease: 'power3.out',
        onComplete: () => {
          body.style.height = 'auto';
        }
      }
    );
  } else {
    body.style.height = 'auto';
    body.style.opacity = '1';
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
      duration: 0.42,
      ease: 'power3.inOut',
      onComplete: () => {
        body.style.display = 'none';
      }
    });
  } else {
    body.style.height = '0px';
    body.style.opacity = '0';
    body.style.display = 'none';
  }
}

// --- MODAL SCROLL LOCK SYSTEM ---
let savedBodyScrollY = 0;
let isPageScrollLocked = false;

function lockPageScroll() {
  if (isPageScrollLocked) return;
  savedBodyScrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  isPageScrollLocked = true;

  document.documentElement.classList.add('modal-open');
  document.body.classList.add('modal-open');
  document.body.style.position = 'fixed';
  document.body.style.top = `-${savedBodyScrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';
}

function unlockPageScroll() {
  const contactActive = document.getElementById('contactModal')?.classList.contains('active');
  const aboutActive = document.getElementById('aboutModal')?.classList.contains('active');
  if (contactActive || aboutActive) return;

  if (!isPageScrollLocked) return;
  isPageScrollLocked = false;

  const topValue = document.body.style.top;
  document.documentElement.classList.remove('modal-open');
  document.body.classList.remove('modal-open');
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  document.body.style.overflow = '';

  const restoreY = topValue ? parseInt(topValue, 10) * -1 : savedBodyScrollY;
  window.scrollTo(0, restoreY);
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
  if (modal) {
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
  if (modal) {
    modal.classList.remove('active');
    unlockPageScroll();
  }
}

// --- MOBILE MENU ---
function toggleMobileMenu() {
  const drawer = document.getElementById('mobileMenuDrawer');
  if (!drawer) return;

  const isClosed = drawer.classList.contains('hidden') || drawer.classList.contains('opacity-0');

  if (isClosed) {
    openMobileMenu();
  } else {
    closeMobileMenu();
  }
}

function openMobileMenu() {
  const drawer = document.getElementById('mobileMenuDrawer');
  const overlay = document.getElementById('mobileMenuOverlay');
  const hamIcon = document.getElementById('hamburgerIcon');
  const closeIcon = document.getElementById('closeMenuIcon');
  if (!drawer) return;

  drawer.classList.remove('hidden');
  if (overlay) {
    overlay.classList.remove('hidden');
    void overlay.offsetWidth;
    overlay.classList.remove('opacity-0', 'pointer-events-none');
    overlay.classList.add('opacity-100', 'pointer-events-auto');
  }

  void drawer.offsetWidth;
  drawer.classList.remove('-translate-y-4', 'opacity-0', 'scale-[0.98]');
  drawer.classList.add('translate-y-0', 'opacity-100', 'scale-100');

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
  if (!drawer) return;

  drawer.classList.remove('translate-y-0', 'opacity-100', 'scale-100');
  drawer.classList.add('-translate-y-4', 'opacity-0', 'scale-[0.98]');

  if (overlay) {
    overlay.classList.remove('opacity-100', 'pointer-events-auto');
    overlay.classList.add('opacity-0', 'pointer-events-none');
  }

  if (hamIcon) {
    hamIcon.classList.remove('scale-50', 'opacity-0', '-rotate-90');
  }
  if (closeIcon) {
    closeIcon.classList.remove('scale-100', 'opacity-100', 'rotate-0');
    closeIcon.classList.add('scale-50', 'opacity-0', 'rotate-90');
  }

  setTimeout(() => {
    if (drawer && drawer.classList.contains('opacity-0')) {
      drawer.classList.add('hidden');
      if (closeIcon) closeIcon.classList.add('hidden');
    }
    if (overlay && overlay.classList.contains('opacity-0')) {
      overlay.classList.add('hidden');
    }
  }, 300);
}

function goToFaqItem(faqIndex) {
  closeAboutModal();
  const faqSection = document.getElementById('faq');
  if (faqSection) {
    faqSection.scrollIntoView({ behavior: 'smooth' });
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

function copyText(text, toastMsg) {
  const onSuccess = () => showToast(toastMsg);

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

// --- GSAP ANIMATIONS ---
function initGsapAnimations() {
  if (typeof gsap === 'undefined') return;

  if (typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  gsap.from('#hero .space-y-6 > *', {
    y: 30,
    opacity: 0,
    duration: 1.1,
    stagger: 0.12,
    ease: 'power3.out'
  });

  gsap.from('#hero .hero-mask-container', {
    y: 25,
    opacity: 0,
    duration: 1.1,
    ease: 'power3.out',
    delay: 0.15,
    clearProps: 'transform'
  });

  const animateScrollBlock = (selectorOrEls, options = {}) => {
    const els = typeof selectorOrEls === 'string' ? document.querySelectorAll(selectorOrEls) : selectorOrEls;
    if (!els || els.length === 0) return;

    const yVal = options.y !== undefined ? options.y : 30;
    const duration = options.duration || 0.9;
    const stagger = options.stagger || 0;
    const delay = options.delay || 0;
    const trigger = options.trigger || null;

    if (stagger > 0) {
      gsap.fromTo(
        els,
        { y: yVal, opacity: 0, scale: 0.97 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: duration,
          stagger: stagger,
          delay: delay,
          ease: 'power3.out',
          clearProps: 'transform,opacity,scale',
          scrollTrigger: {
            trigger: trigger || els[0],
            start: 'top 90%',
            toggleActions: 'play none none none',
            once: true
          }
        }
      );
    } else {
      els.forEach(el => {
        gsap.fromTo(
          el,
          { y: yVal, opacity: 0, scale: 0.97 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: duration,
            delay: delay,
            ease: 'power3.out',
            clearProps: 'transform,opacity,scale',
            scrollTrigger: {
              trigger: el,
              start: 'top 90%',
              toggleActions: 'play none none none',
              once: true
            }
          }
        );
      });
    }
  };

  animateScrollBlock('#player .text-center', { duration: 0.95 });
  animateScrollBlock('#player .genre-filter-btn', { y: 20, stagger: 0.06, duration: 0.85, trigger: '#player .flex.flex-wrap' });
  animateScrollBlock('#trackListContainer', { y: 28, duration: 0.95 });

  animateScrollBlock('#services .text-center', { duration: 0.95 });
  if (window.innerWidth >= 640) {
    const serviceCards = document.querySelectorAll('#servicesContainer > *');
    if (serviceCards.length > 0) {
      animateScrollBlock(serviceCards, { y: 32, stagger: 0.1, duration: 0.95, trigger: '#servicesContainer' });
    }
  } else {
    animateScrollBlock('#servicesContainer', { y: 24, duration: 0.85 });
  }

  animateScrollBlock('#faq .text-center', { duration: 0.95 });
  const faqItems = document.querySelectorAll('#faqContainer > *');
  if (faqItems.length > 0) {
    animateScrollBlock(faqItems, { y: 24, stagger: 0.08, duration: 0.85, trigger: '#faqContainer' });
  }

  animateScrollBlock('#contacts .text-center', { duration: 0.95 });
  animateScrollBlock('#contacts .rack-card', { y: 32, duration: 0.95 });
}

function initMixerFaderScroll() {
  const knob = document.getElementById('side-fader-knob');
  const rail = knob ? knob.closest('.fader-rail') : null;
  const strip = document.getElementById('side-mixer-strip');
  if (!knob || !rail) return;

  let isDragging = false;
  let grabOffsetY = 12;

  function updateFaderUI(scrollPercent) {
    const railH = rail.clientHeight || 400;
    const knobH = knob.offsetHeight || 24;
    const maxTravel = Math.max(0, railH - knobH);
    const topPx = Math.max(0, Math.min(maxTravel, scrollPercent * maxTravel));
    knob.style.top = `${topPx}px`;

    const faderLevel = 1 - Math.max(0, Math.min(1, scrollPercent));

    const dbLabel = document.getElementById('side-db-label');
    if (dbLabel) {
      if (faderLevel < 0.04) {
        dbLabel.textContent = '-INF';
      } else {
        const dbVal = ((faderLevel - 0.75) * 24).toFixed(1);
        dbLabel.textContent = `${dbVal > 0 ? '+' : ''}${dbVal}dB`;
      }
    }

    const sideLeds = document.querySelectorAll('.side-vu-led');
    const totalLeds = sideLeds.length;
    if (totalLeds > 0) {
      const activeCount = Math.round(faderLevel * totalLeds);
      const redCount = Math.max(2, Math.round(totalLeds * 0.15));
      const yellowCount = Math.max(4, Math.round(totalLeds * 0.38));

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
