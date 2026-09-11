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

function toggleLanguage() {
  const nextLang = currentLang === 'ru' ? 'en' : 'ru';
  setLanguage(nextLang, true);
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

  const langToggle = document.getElementById('langToggleContainer');
  if (langToggle) {
    langToggle.setAttribute('data-lang', lang);
  }

  renderI18nText();
  renderServices();
  renderFaq();
  updateMasterDeckUI();
  renderTrackList(false);
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

  // Set metadata preload initially so page load doesn't download 12MB of audio upfront
  enabledTracks.forEach((track, index) => {
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
    applyAudioVolumes(activeTrackId);
    if (Math.abs(item.audioA.currentTime - item.audioB.currentTime) > 0.05) {
      item.audioB.currentTime = item.audioA.currentTime;
    }
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

  applyAudioVolumes(activeTrackId, true);
  updateMasterDeckUI();
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

let audioCrossfadeTimer = null;

function applyAudioVolumes(trackId, smooth = false) {
  const item = trackAudioMap[trackId];
  if (!item) return;

  const targetVolA = item.source === 'before' ? item.volume : 0;
  const targetVolB = item.source === 'after' ? item.volume : 0;

  // Immediate switch if audio is paused or smooth mode not requested
  if (!smooth || (item.audioA.paused && item.audioB.paused)) {
    if (audioCrossfadeTimer) {
      clearInterval(audioCrossfadeTimer);
      audioCrossfadeTimer = null;
    }
    item.audioA.volume = targetVolA;
    item.audioB.volume = targetVolB;
    return;
  }

  // Soft analog studio crossfade over 280ms
  if (audioCrossfadeTimer) {
    clearInterval(audioCrossfadeTimer);
  }

  const startA = item.audioA.volume;
  const startB = item.audioB.volume;
  const steps = 22;
  const stepTime = 13; // ~280ms total duration
  let step = 0;

  audioCrossfadeTimer = setInterval(() => {
    step++;
    const progress = Math.min(1, step / steps);
    // Smooth S-curve sinusoidal curve for transparent studio transition
    const ease = 0.5 - Math.cos(progress * Math.PI) / 2;

    try {
      item.audioA.volume = Math.max(0, Math.min(1, startA + (targetVolA - startA) * ease));
      item.audioB.volume = Math.max(0, Math.min(1, startB + (targetVolB - startB) * ease));
    } catch (e) {}

    if (step >= steps) {
      clearInterval(audioCrossfadeTimer);
      audioCrossfadeTimer = null;
      item.audioA.volume = targetVolA;
      item.audioB.volume = targetVolB;
    }
  }, stepTime);
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

  // Source Switches & Mode Labels
  document.querySelectorAll('.deck-source-switch').forEach(sw => {
    sw.setAttribute('data-source', item.source);
  });

  const modeLabels = document.querySelectorAll('.deck-mode-label');
  const targetLabelText = item.source === 'before' 
    ? (resolveDeviceText(t.player.beforeLabel, currentDevice) || 'BEFORE (MIX)')
    : (resolveDeviceText(t.player.afterLabel, currentDevice) || 'AFTER (MASTER)');

  modeLabels.forEach(el => {
    if (el.textContent !== targetLabelText) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(2px)';
      setTimeout(() => {
        el.textContent = targetLabelText;
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      }, 150);
    }
  });

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
            <img src="${track.cover}" alt="${trackTitle}" loading="lazy" decoding="async" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="if(this.src!=='./image/cover1.webp')this.src='./image/cover1.webp'" />
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

  if (typeof initPlayerTrackCardsTimeline === 'function') {
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
      ? 'service-mobile-card popular-rack-card p-6 md:p-8 flex flex-col justify-between transition-colors duration-200 w-[78vw] max-w-[310px] sm:w-auto sm:max-w-none flex-shrink-0 snap-center cursor-pointer select-none'
      : 'service-mobile-card rack-card p-6 md:p-8 flex flex-col justify-between transition-colors duration-200 w-[78vw] max-w-[310px] sm:w-auto sm:max-w-none flex-shrink-0 snap-center cursor-pointer select-none';

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

        <h3 class="service-card-title text-2xl font-extrabold text-white mb-2 tracking-tight">${title}</h3>
        <p class="service-card-desc text-sm text-gray-400 mb-6 leading-relaxed sm:max-lg:text-center">${desc}</p>

        <ul class="service-card-features space-y-3 mb-6">
          ${featuresHtml}
        </ul>
      </div>

      <div class="service-card-bottom">
        <div class="service-card-divider h-px bg-gray-800/80 my-6"></div>

        <div class="service-card-pricing flex items-center justify-between gap-4">
          <div class="service-card-price-group flex flex-col">
            <span class="service-card-from text-xs font-mono text-gray-400 uppercase tracking-wider">${fromLabel}</span>
            <span class="service-card-price text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent tracking-tight" data-target-price="${displayPrice}">${displayPrice}</span>
          </div>

          <button
            onclick="openContactModal()"
            class="service-card-order-btn py-3 px-6 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl transition-all duration-200 shadow-md shadow-amber-500/20 active:scale-95 text-sm sm:text-base cursor-pointer flex items-center gap-1.5 flex-shrink-0"
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

  // Refresh ScrollTrigger and animations after cards are rendered
  if (typeof initServicesGsapAnimation === 'function') {
    initServicesGsapAnimation();
  }
  if (typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.refresh();
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
          if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
        }
      }
    );
  } else {
    body.style.height = 'auto';
    body.style.opacity = '1';
    if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
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
        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      }
    });
  } else {
    body.style.height = '0px';
    body.style.opacity = '0';
    body.style.display = 'none';
    if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
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
  btn.addEventListener('click', (e) => {
    e.preventDefault();
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

function initPlayerTrackCardsTimeline(initialPreHide = true) {
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

  if (initialPreHide && !isAlreadyInView) {
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

  if (isAlreadyInView) {
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

  // Clean up previous timelines or triggers attached to services
  if (servicesTimelines && servicesTimelines.length) {
    servicesTimelines.forEach(tl => {
      try { tl.kill(); } catch (e) {}
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
      gsap.set(card, { opacity: 1, y: 0 });
      gsap.set(card.querySelectorAll('.service-feature-item'), { opacity: 1, x: 0 });
      gsap.set(card.querySelectorAll('.service-check-icon'), { opacity: 1, scale: 1 });
      gsap.set(card.querySelectorAll('.service-card-top, .service-card-bottom, .service-card-divider, .service-card-pricing, .service-card-order-btn, .service-card-price-group'), { opacity: 1, y: 0, scaleX: 1 });
    });
    priceData.forEach(p => { p.el.textContent = p.targetText; });
    return;
  }

  // Pre-hide all elements to prepare for sequenced emergence
  if (sectionHeader) gsap.set(sectionHeader, { y: 24, opacity: 0 });

  const allMainText = [];
  const allDividers = [];
  const allBottoms = [];

  cards.forEach(card => {
    gsap.set(card, { y: 30, opacity: 0 });

    const popularBadge = card.querySelector('.popular-badge') || card.querySelector('.service-card-popular');
    const metaBar = card.querySelector('.service-card-meta');
    const title = card.querySelector('.service-card-title');
    const desc = card.querySelector('.service-card-desc');
    const divider = card.querySelector('.service-card-divider');
    const priceGroup = card.querySelector('.service-card-price-group');
    const orderBtn = card.querySelector('.service-card-order-btn');

    const topItems = [metaBar, title, desc, popularBadge].filter(Boolean);
    topItems.forEach(el => allMainText.push(el));
    if (topItems.length) gsap.set(topItems, { y: 16, opacity: 0 });

    const featureItems = card.querySelectorAll('.service-feature-item');
    const checkIcons = card.querySelectorAll('.service-check-icon');
    if (featureItems.length) gsap.set(featureItems, { x: -30, opacity: 0 });
    if (checkIcons.length) gsap.set(checkIcons, { scale: 0.2, opacity: 0 });

    if (divider) {
      allDividers.push(divider);
      gsap.set(divider, { scaleX: 0, opacity: 0 });
    }
    const bottomGroup = [priceGroup, orderBtn].filter(Boolean);
    bottomGroup.forEach(el => allBottoms.push(el));
    if (bottomGroup.length) gsap.set(bottomGroup, { y: 16, opacity: 0 });
  });

  // Calculate maximum number of features across all cards
  let maxFeatures = 0;
  cards.forEach(card => {
    const count = card.querySelectorAll('.service-feature-item').length;
    if (count > maxFeatures) maxFeatures = count;
  });

  // Initialize prices to 0 so count-up starts cleanly
  priceData.forEach(p => {
    p.el.textContent = p.targetText.replace(p.raw, '0');
  });

  const featuresContainer = document.querySelector('#servicesContainer .service-card-features') || '#servicesContainer';
  const bottomContainer = document.querySelector('#servicesContainer .service-card-bottom') || '#servicesContainer';

  // 1. HEADER TIMELINE (Title "Услуги и Стоимость")
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
      { y: 0, opacity: 1, duration: 0.45, ease: 'power2.out', clearProps: 'transform' },
      0
    );
    servicesTimelines.push(headerTl);
  }

  // 2. CARDS & MAIN TEXT TIMELINE (3 card shells + titles, descriptions, badges)
  // Enters at 85%, reverses visibly when scrolling up past 85%
  const cardsTl = gsap.timeline({
    scrollTrigger: {
      trigger: '#servicesContainer',
      start: computeDynamicStart(85),
      end: 'bottom top',
      toggleActions: 'play none none reverse',
      onLeaveBack: () => {
        cardsTl.timeScale(1.6).reverse();
      },
      onEnter: () => {
        cardsTl.timeScale(1.0).play();
      }
    }
  });

  cardsTl.fromTo(
    cards,
    { y: 30, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.45, stagger: 0.08, ease: 'power2.out', clearProps: 'transform' },
    0
  );

  if (allMainText.length) {
    cardsTl.fromTo(
      allMainText,
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.42, stagger: 0.05, ease: 'power2.out', clearProps: 'transform' },
      0.14
    );
  }
  servicesTimelines.push(cardsTl);

  // 3. FEATURES & CHECKMARKS TIMELINE (Checkmarks float in row-by-row with emerald glow)
  // Enters at 83%, reverses visibly row-by-row when scrolling up past 83%
  const featuresTl = gsap.timeline({
    scrollTrigger: {
      trigger: featuresContainer,
      start: computeDynamicStart(83),
      end: 'bottom top',
      toggleActions: 'play none none reverse',
      onLeaveBack: () => {
        featuresTl.timeScale(1.6).reverse();
      },
      onEnter: () => {
        featuresTl.timeScale(1.0).play();
      }
    }
  });

  for (let r = 0; r < maxFeatures; r++) {
    const rowItems = [];
    const rowIcons = [];
    cards.forEach(card => {
      const items = card.querySelectorAll('.service-feature-item');
      if (items[r]) {
        rowItems.push(items[r]);
        const ic = items[r].querySelector('.service-check-icon');
        if (ic) rowIcons.push(ic);
      }
    });

    if (rowItems.length) {
      featuresTl.fromTo(
        rowItems,
        { x: -30, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.42, stagger: 0.06, ease: 'back.out(1.3)' },
        r * 0.16
      );
    }
    if (rowIcons.length) {
      featuresTl.fromTo(
        rowIcons,
        { scale: 0.2, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.42, stagger: 0.06, ease: 'back.out(1.8)' },
        r * 0.16
      );
    }
  }
  servicesTimelines.push(featuresTl);

  // 4. BOTTOM PRICING & ORDER BUTTONS TIMELINE (Divider, Order Buttons, Price count-up)
  // Enters at 80%, reverses visibly when scrolling up past 80%
  // On scroll down: elements fade/slide in, numbers count up smoothly from 0 to target
  // On scroll up: elements simply fade/slide down and hide like FAQ (no countdown/decrease)
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

  const bottomTl = gsap.timeline({
    scrollTrigger: {
      trigger: bottomContainer,
      start: computeDynamicStart(80),
      end: 'bottom top',
      toggleActions: 'play none none reverse',
      onLeaveBack: () => {
        // Smoothly fade down and hide prices and buttons (identical to FAQ exit)
        bottomTl.timeScale(1.8).reverse();
        if (priceCountTween) {
          priceCountTween.kill();
          priceCountTween = null;
        }
        // Keep target price text intact during reverse fade, then reset to 0 in background
        gsap.delayedCall(0.35, () => {
          priceData.forEach(p => {
            p.el.textContent = p.targetText.replace(p.raw, '0');
          });
        });
      },
      onEnter: () => {
        bottomTl.timeScale(1.0).play();
        startPriceCountUp();
      }
    }
  });

  if (allDividers.length) {
    bottomTl.fromTo(
      allDividers,
      { scaleX: 0, opacity: 0 },
      { scaleX: 1, opacity: 1, duration: 0.35, ease: 'power2.out' },
      0
    );
  }

  if (allBottoms.length) {
    bottomTl.fromTo(
      allBottoms,
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, stagger: 0.06, ease: 'power2.out' },
      0.06
    );
  }
  servicesTimelines.push(bottomTl);
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
