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

// --- I18N SYSTEM ---
function initI18n() {
  const btnRu = document.getElementById('btnLangRu');
  const btnEn = document.getElementById('btnLangEn');
  const langToggle = document.getElementById('langToggleContainer');

  if (langToggle) {
    langToggle.addEventListener('click', () => toggleLanguage());
  }
  if (btnRu) {
    btnRu.addEventListener('click', (e) => {
      e.stopPropagation();
      setLanguage('ru');
    });
  }
  if (btnEn) {
    btnEn.addEventListener('click', (e) => {
      e.stopPropagation();
      setLanguage('en');
    });
  }

  setLanguage(currentLang);
}

function toggleLanguage() {
  setLanguage(currentLang === 'ru' ? 'en' : 'ru');
}

function setLanguage(lang) {
  currentLang = lang;
  const btnRu = document.getElementById('btnLangRu');
  const btnEn = document.getElementById('btnLangEn');

  if (btnRu && btnEn) {
    if (lang === 'ru') {
      btnRu.className = 'px-3 py-1 text-xs font-bold rounded-lg transition-all bg-amber-500 text-slate-950 font-extrabold';
      btnEn.className = 'px-3 py-1 text-xs font-bold rounded-lg transition-all text-gray-400 hover:text-white';
    } else {
      btnEn.className = 'px-3 py-1 text-xs font-bold rounded-lg transition-all bg-amber-500 text-slate-950 font-extrabold';
      btnRu.className = 'px-3 py-1 text-xs font-bold rounded-lg transition-all text-gray-400 hover:text-white';
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
  
  // Elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const keyPath = el.getAttribute('data-i18n');
    const parts = keyPath.split('.');
    let val = t;
    parts.forEach(p => {
      if (val) val = val[p];
    });
    if (val && typeof val === 'string') {
      if (el.hasAttribute('data-i18n-html') || val.includes('<')) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    }
  });
}

// --- PLAYER & MASTER DECK ENGINE ---
function getEnabledTracks() {
  if (!CONFIG || !CONFIG.tracks) return [];
  return CONFIG.tracks.filter(tr => tr.enabled !== false && tr.enabled !== 'false' && tr.active !== false && tr.visible !== false);
}

function getTracksPerPage() {
  if (window.innerWidth >= 1024) return 6; // Desktop: 3 columns x 2 rows
  if (window.innerWidth >= 640) return 6;  // Tablet: 2 columns x 3 rows
  return 5; // Mobile: 1 column x 5 rows
}

function prevTrackPage() {
  if (currentTrackPage > 0) {
    currentTrackPage--;
    renderTrackList();
  }
}

function nextTrackPage() {
  const perPage = getTracksPerPage();
  const filtered = getEnabledTracks().filter(tr => activeGenre === 'all' || tr.genre === activeGenre);
  const maxPages = Math.ceil(filtered.length / perPage);
  if (currentTrackPage < maxPages - 1) {
    currentTrackPage++;
    renderTrackList();
  }
}

function initPlayer() {
  const enabledTracks = getEnabledTracks();

  // Preload audio files
  enabledTracks.forEach((track, index) => {
    const audioA = new Audio(track.audioBefore);
    const audioB = new Audio(track.audioAfter);
    audioA.preload = 'metadata';
    audioB.preload = 'metadata';

    // Universal fallback if audio file is missing or fails to load
    const handleAudioError = (el, type) => {
      el.addEventListener('error', () => {
        const fallbackSrc = `./audio/pophouse_1_${type}.mp3`;
        const fullFallback = new URL(fallbackSrc, window.location.href).href;
        if (el.src !== fullFallback) {
          console.warn(`Audio error for track ${track.id} (${el.src}), falling back to ${fallbackSrc}`);
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
      if (activeTrackId === track.id) {
        nextDeckTrack();
      }
    });
    audioB.addEventListener('ended', () => {
      if (activeTrackId === track.id) {
        nextDeckTrack();
      }
    });
  });

  // Default active track is first enabled track
  if (enabledTracks.length > 0) {
    activeTrackId = enabledTracks[0].id;
  }

  // Filter Buttons
  const filterBtns = document.querySelectorAll('.genre-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.className = 'genre-filter-btn px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold rounded-xl transition-all bg-[#090C12] border border-gray-800/80 text-gray-400 hover:text-white');
      btn.className = 'genre-filter-btn px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold rounded-xl transition-all bg-amber-500 text-slate-950 font-black';
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

  // Responsive resize
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

function selectTrack(trackId, shouldPlay = true) {
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
    }
  }

  showStickyPlayer();
  updateMasterDeckUI();
  renderTrackList();
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
  renderTrackList();
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

  const rect = e.currentTarget.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const dur = item.audioA.duration || item.audioB.duration || 0;

  if (dur > 0) {
    const newTime = (clickX / rect.width) * dur;
    item.audioA.currentTime = newTime;
    item.audioB.currentTime = newTime;
    updateDeckProgressUI();
  }
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

  const item = trackAudioMap[activeTrackId] || { source: 'after', volume: 0.9 };
  const isPlaying = isAudioPlaying(activeTrackId);
  const genreText = track.genreLabel[currentLang] || track.genreLabel.ru;
  const t = CONFIG.i18n[currentLang];

  document.querySelectorAll('.deck-cover, #deckCover').forEach(el => { el.src = track.cover; });
  document.querySelectorAll('.deck-title, #deckTitle').forEach(el => { el.textContent = track.title; });
  document.querySelectorAll('.deck-artist, #deckArtist').forEach(el => { el.textContent = track.artist; });
  document.querySelectorAll('.deck-genre, #deckGenre').forEach(el => { el.textContent = genreText; });

  const totalTracks = enabledTracks.length;
  const currentIdx = enabledTracks.findIndex(t => t.id === activeTrackId);
  const trackNum = (currentIdx >= 0 ? currentIdx + 1 : 1).toString().padStart(2, '0');
  document.querySelectorAll('.deck-index, #deckTrackIndex').forEach(el => { el.textContent = `${trackNum} / ${totalTracks}`; });

  // Source Buttons & LEDs
  const btnsBefore = document.querySelectorAll('.deck-btn-before, #deckBtnBefore');
  const btnsAfter = document.querySelectorAll('.deck-btn-after, #deckBtnAfter');
  const ledsBefore = document.querySelectorAll('.deck-led-before, #deckLedBefore');
  const ledsAfter = document.querySelectorAll('.deck-led-after, #deckLedAfter');
  const modeLabels = document.querySelectorAll('.deck-mode-label, #deckActiveModeLabel');

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
    modeLabels.forEach(el => { el.textContent = t.player.beforeLabel || 'BEFORE (MIX)'; });
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
    modeLabels.forEach(el => { el.textContent = t.player.afterLabel || 'AFTER (MASTER)'; });
  }

  // Play Button & Icons
  const playIcons = document.querySelectorAll('.deck-play-icon, #deckPlayIcon');
  const playTexts = document.querySelectorAll('.deck-play-text, #deckPlayText');
  const playBtns = document.querySelectorAll('.deck-play-btn, #deckPlayBtn');

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
      el.className = 'w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-amber-400 text-slate-950 font-black rounded-full transition-all shadow-xl shadow-amber-500/30 scale-105 flex-shrink-0 cursor-pointer';
    } else {
      el.className = 'w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-full transition-all shadow-md shadow-amber-500/20 active:scale-95 flex-shrink-0 cursor-pointer';
    }
  });

  // Volume
  document.querySelectorAll('.deck-volume, #deckVolume').forEach(el => { el.value = item.volume; });

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

function renderTrackList() {
  const container = document.getElementById('trackListContainer');
  if (!container) return;

  const perPage = getTracksPerPage();
  const filtered = getEnabledTracks().filter(tr => activeGenre === 'all' || tr.genre === activeGenre);
  const totalItems = filtered.length;
  const maxPages = Math.ceil(totalItems / perPage) || 1;

  if (currentTrackPage >= maxPages) {
    currentTrackPage = Math.max(0, maxPages - 1);
  }

  const startIdx = currentTrackPage * perPage;
  const visibleTracks = filtered.slice(startIdx, startIdx + perPage);

  container.innerHTML = '';

  visibleTracks.forEach(track => {
    const isSelected = activeTrackId === track.id;
    const isPlaying = isSelected && isAudioPlaying(track.id);
    const genreText = track.genreLabel[currentLang] || track.genreLabel.ru;

    const itemCard = document.createElement('div');
    itemCard.id = `track-item-${track.id}`;
    itemCard.onclick = () => selectTrack(track.id, true);
    itemCard.className = `p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 group ${
      isSelected 
        ? 'bg-amber-500/10 border-amber-500/60 shadow-lg shadow-amber-500/10' 
        : 'bg-[#0B0E15] border-gray-800/80 hover:border-amber-500/40 hover:bg-[#0F131E]'
    }`;

    itemCard.innerHTML = `
      <div class="flex items-center gap-3 min-w-0 flex-1">
        <div class="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden flex-shrink-0 border ${isSelected ? 'border-amber-500' : 'border-gray-800'}">
          <img src="${track.cover}" alt="${track.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ${isPlaying ? `
            <div class="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span class="w-2.5 h-2.5 rounded-full vu-led-green animate-ping"></span>
            </div>
          ` : ''}
        </div>
        <div class="min-w-0 flex-1">
          <h4 class="text-xs sm:text-sm font-extrabold text-white truncate group-hover:text-amber-400 transition-colors">
            ${track.title}
          </h4>
          <p class="text-[11px] text-gray-400 truncate mt-0.5">
            ${track.artist}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="text-[9px] font-extrabold px-2 py-0.5 rounded-full ${isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-gray-800 text-amber-400'}">
          ${genreText}
        </span>
        <button
          onclick="event.stopPropagation(); selectTrack('${track.id}', true)"
          class="p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer ${
            isSelected 
              ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
              : 'bg-gray-900 text-gray-300 hover:bg-amber-500 hover:text-slate-950'
          }"
        >
          <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="${isPlaying ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'}"/>
          </svg>
        </button>
      </div>
    `;

    container.appendChild(itemCard);
  });

  if (typeof gsap !== 'undefined' && container.children.length > 0) {
    gsap.fromTo(
      container.children,
      { y: 18, opacity: 0, scale: 0.98 },
      { y: 0, opacity: 1, scale: 1, duration: 0.35, stagger: 0.04, ease: 'power2.out', clearProps: 'transform,opacity,scale' }
    );
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
      dot.className = `h-1.5 rounded-full transition-all ${i === currentTrackPage ? 'bg-amber-500 w-5' : 'bg-gray-700 hover:bg-gray-500 w-1.5'}`;
      dot.onclick = () => {
        currentTrackPage = i;
        renderTrackList();
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

  const t = CONFIG.i18n[currentLang];
  container.innerHTML = '';

  CONFIG.servicesData.forEach(s => {
    const title = currentLang === 'ru' ? s.titleRu : s.titleEn;
    const desc = currentLang === 'ru' ? s.descRu : s.descEn;
    const price = currentLang === 'ru' ? s.priceRu : s.priceEn;
    const features = currentLang === 'ru' ? s.featuresRu : s.featuresEn;

    const card = document.createElement('div');
    card.className = s.isPopular
      ? 'popular-rack-card p-6 md:p-8 flex flex-col justify-between transition-all duration-300 transform lg:-translate-y-2'
      : 'rack-card p-6 md:p-8 flex flex-col justify-between transition-all duration-300';

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

    card.innerHTML = `
      ${s.isPopular ? `<div class="absolute -top-3.5 left-1/2 -translate-x-1/2"><span class="popular-badge uppercase tracking-wider">${t.services.popularBadge}</span></div>` : ''}

      <div>
        <div class="flex justify-between items-center mb-4 opacity-40">
          <div class="rack-bolt"></div>
          <div class="text-[10px] font-mono text-gray-400 tracking-widest uppercase">
            ${rackUnitText}
          </div>
          <div class="rack-bolt"></div>
        </div>

        <h3 class="text-2xl font-extrabold text-white mb-2 tracking-tight">${title}</h3>
        <p class="text-sm text-gray-400 mb-6 leading-relaxed">${desc}</p>

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
            <span>${t.services.orderBtn}</span>
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// --- FAQ SECTION ---
function initFaq() {
  renderFaq();
}

function renderFaq() {
  const container = document.getElementById('faqContainer');
  if (!container) return;

  container.innerHTML = '';

  CONFIG.faqData.forEach((item, index) => {
    const q = currentLang === 'ru' ? item.qRu : item.qEn;
    const a = currentLang === 'ru' ? item.aRu : item.aEn;
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

  // Close all other open FAQ items smoothly
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
        duration: 0.35,
        ease: 'power2.out',
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
      duration: 0.28,
      ease: 'power2.inOut',
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

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeContactModal();
      closeAboutModal();
    }
  });
}

function openContactModal() {
  const modal = document.getElementById('contactModal');
  if (modal) modal.classList.add('active');
}

function closeContactModal() {
  const modal = document.getElementById('contactModal');
  if (modal) modal.classList.remove('active');
}

function openAboutModal() {
  const modal = document.getElementById('aboutModal');
  if (modal) modal.classList.add('active');
}

function closeAboutModal() {
  const modal = document.getElementById('aboutModal');
  if (modal) modal.classList.remove('active');
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
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast(toastMsg)).catch(() => showToast(toastMsg));
  } else {
    showToast(toastMsg);
  }
}

// --- GSAP ANIMATIONS ---
function initGsapAnimations() {
  if (typeof gsap === 'undefined') return;

  if (typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  // 1. HERO ANIMATIONS (Immediate load)
  gsap.from('#hero .space-y-6 > *', {
    y: 25,
    opacity: 0,
    duration: 0.6,
    stagger: 0.08,
    ease: 'power2.out'
  });

  gsap.from('#hero .hero-mask-container', {
    y: 30,
    scale: 0.96,
    opacity: 0,
    duration: 0.7,
    ease: 'power2.out',
    delay: 0.15
  });

  // Helper for scroll reveal float-up animation
  const animateScrollBlock = (selectorOrEls, options = {}) => {
    const els = typeof selectorOrEls === 'string' ? document.querySelectorAll(selectorOrEls) : selectorOrEls;
    if (!els || els.length === 0) return;

    const yVal = options.y !== undefined ? options.y : 24;
    const duration = options.duration || 0.5;
    const stagger = options.stagger || 0;
    const delay = options.delay || 0;
    const trigger = options.trigger || null;

    if (stagger > 0) {
      gsap.fromTo(
        els,
        { y: yVal, opacity: 0, scale: 0.98 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: duration,
          stagger: stagger,
          delay: delay,
          ease: 'power2.out',
          clearProps: 'transform,opacity,scale',
          scrollTrigger: {
            trigger: trigger || els[0],
            start: 'top 92%',
            toggleActions: 'play none none none',
            once: true
          }
        }
      );
    } else {
      els.forEach(el => {
        gsap.fromTo(
          el,
          { y: yVal, opacity: 0, scale: 0.98 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: duration,
            delay: delay,
            ease: 'power2.out',
            clearProps: 'transform,opacity,scale',
            scrollTrigger: {
              trigger: el,
              start: 'top 92%',
              toggleActions: 'play none none none',
              once: true
            }
          }
        );
      });
    }
  };

  // 2. A/B PLAYER SECTION
  animateScrollBlock('#player .text-center');
  animateScrollBlock('#player .genre-filter-btn', { y: 18, stagger: 0.05, trigger: '#player .flex.flex-wrap' });
  animateScrollBlock('#trackListContainer', { y: 24, duration: 0.5 });
  animateScrollBlock('#player .border-t', { y: 16 });

  // 3. SERVICES SECTION
  animateScrollBlock('#services .text-center');
  const serviceCards = document.querySelectorAll('#servicesContainer > *');
  if (serviceCards.length > 0) {
    animateScrollBlock(serviceCards, { y: 28, stagger: 0.08, trigger: '#servicesContainer' });
  }

  // 4. FAQ SECTION
  animateScrollBlock('#faq .text-center');
  const faqItems = document.querySelectorAll('#faqContainer > *');
  if (faqItems.length > 0) {
    animateScrollBlock(faqItems, { y: 20, stagger: 0.06, trigger: '#faqContainer' });
  }

  // 5. DIRECT CONTACTS SECTION
  animateScrollBlock('#contacts .text-center');
  animateScrollBlock('#contacts .rack-card', { y: 28 });
  const contactBtns = document.querySelectorAll('#contacts .grid > *');
  if (contactBtns.length > 0) {
    animateScrollBlock(contactBtns, { y: 20, stagger: 0.06, trigger: '#contacts .grid' });
  }
}

function initMixerFaderScroll() {
  const knob = document.getElementById('side-fader-knob');
  if (!knob) return;

  function updateFader() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = docHeight > 0 ? Math.min(Math.max(scrollTop / docHeight, 0), 1) : 0;

    const maxTopPct = 91.5;
    const topPos = scrollPercent * maxTopPct;
    knob.style.top = `${topPos}%`;

    const faderLevel = 1 - scrollPercent;

    const dbLabel = document.getElementById('side-db-label');
    if (dbLabel) {
      if (faderLevel < 0.05) {
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

      sideLeds.forEach((led, idx) => {
        const distFromBottom = totalLeds - 1 - idx;
        if (distFromBottom < activeCount) {
          if (idx <= 1) {
            led.className = "side-vu-led vu-led active-red";
          } else if (idx <= 3) {
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

  window.addEventListener('scroll', updateFader);
  window.addEventListener('resize', updateFader);
  updateFader();
}
