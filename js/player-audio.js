// ═══════════════════════════════════════════════════════════════════════
// js/player-audio.js — ПЛЕЕР: АУДИО-ДВИЖОК (ЗАГРУЗКА, ПОТОК MP3, КРОССФЕЙД A/B)
// Грузится после: js/state.js. Читает: currentLang, activeTrackLang,
//         activeTrackId, trackAudioMap, CONFIG.
// Владеет: пара <audio> в trackAudioMap, очередь прогрева, буферы потока, граф Web Audio.
// Публичные (window): changeDeckVolume (инлайн-oninput разметки — только function), window.nrAudioStream
//         и window.nrAudioWarm (отладка).
// Блоки файла:
//   • Ленивое создание пары <audio> и обход кэша (audioUrl, audioCacheStamp*).
//   • Очередь фонового прогрева (audioWarm*, warmQueue*, warmOnPlay, warmHold).
//   • Порционное чтение MP3 по Range (audioStream*, stream*, разбор кадров mp3*).
//   • Кроссфейд и подтяжка BEFORE/AFTER (audioFade*, syncAudioPair, fadePairToSource,
//     syncActivePairTick), звуковой тракт Web Audio (audioCtx, ensureAudioGraph).
//   • Гейт буфера, сторож залипания, play/pause пары (checkPairBufferGate,
//     watchAudioStall, playPairAudio, pausePairAudio).
//   • Два setInterval верхнего уровня срабатывают сразу при загрузке — их функции
//     обязаны остаться в этом файле.
//   • Модель ленты (треки языка, страницы, точки) — в js/player-ui.js, отсюда только вызовы.
// ═══════════════════════════════════════════════════════════════════════

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
  /* По умолчанию звучит AFTER (см. source ниже): BEFORE глушим сразу, иначе до
     первой расстановки громкостей пара начинала бы играть двумя голосами. */
  audioA.muted = true;
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
  const order = getInitialWarmOrder();
  /* Порционный режим: мегабайты — только по клику, но заголовки файлов (первые
     килобайты) нужны заранее. Без них первый клик начинается с опроса обоих
     файлов, то есть с лишнего круга до сервера, — на холодном канале это и есть
     та задержка, из-за которой первый трек ведёт себя хуже остальных.
     Опрашиваем первые два трека: самый вероятный клик и следующий за ним. */
  if (audioChunkSupported()) {
    order.slice(0, AUDIO_CHUNK_PRIME_TRACKS).forEach(trackId => {
      const item = trackAudioMap[trackId] || createTrackAudioEntry(getTrackConfigById(trackId));
      if (item) streamPreparePair(item);
    });
  }
  order.forEach(trackId => warmQueuePush(trackId));
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
   что ещё не слушают. Здесь поток данных режем сами: впереди держим одну–две
   порции по AUDIO_CHUNK_SEC секунд, и просим следующую, когда до конца текущей
   остаётся AUDIO_CHUNK_AHEAD секунд (10 с при порции 15 с). Такой запас — не
   про экономию, а про плавность перехода BEFORE / AFTER: к моменту клика данные
   должны быть у ОБЕИХ дорожек (см. «гейт общим буфером пары»). Полоса загрузки
   после этого честная: она показывает именно то, что скачано.

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
const AUDIO_CHUNK_AHEAD = 10;        // с: за сколько до конца порции просить следующую
const AUDIO_CHUNK_HEAD_SEC = 2;      // с: первая порция (клик, перемотка)
const AUDIO_CHUNK_KEEP_BEHIND = 20;  // с: сколько скачанного оставляем позади
const AUDIO_CHUNK_RETRY_MS = 1500;   // мс: пауза перед повтором
const AUDIO_CHUNK_PROBE_BYTES = 4096;
const AUDIO_CHUNK_PRIME_TRACKS = 2; // сколько треков опросить заголовками заранее
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
      retryAt: 0, failCount: 0, retryTimer: 0 };
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
  /* Опрос уже идёт (наведение, затем клик) — второй не нужен: два ответа на один
     и тот же файл переписывали st.nextByte/nextTime и делали порцию «свежей»,
     то есть заставляли качать заново уже скачанный участок. */
  if (st.meta || st.probing) return;
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
  /* Незавершённый повтор порции тоже снимаем: иначе он «выстрелил» бы после
     паузы или разбора состояния потока. */
  if (st.retryTimer) { clearTimeout(st.retryTimer); st.retryTimer = 0; }
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
  /* fresh — это перемотка: её порция нужна даже в «завершённом» потоке. */
  if (!st.wanted || st.fetching || (st.done && !st.fresh)) return;
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
      /* failCount сбрасываем НЕ здесь, а когда порция реально легла в буфер
         (streamAfterAppend): иначе сбой проверки offset после перемотки
         обнулял счётчик на каждой удачной загрузке, страховка «3 попытки»
         не срабатывала никогда и один и тот же фрагмент качался бесконечно. */
      st.fetching = false; st.aborter = null;
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
  /* Время порции — по ПЕРВОМУ кадру, который реально попал в данные, а не по
     запрошенной точке. После перемотки граница кадра ищется НАЗАД (режим 'at'):
     начало порции оказывается раньше st.nextTime — до AUDIO_CHUNK_FRAME_SEEK
     байт, то есть до сотни миллисекунд звука. Если объявить порцию временем
     запрошенной точки, содержимое встанет в дорожку позже, чем оно есть: элемент
     играет звук РАНЬШЕ своего currentTime. На телефоне перемотки частые, порции
     приходят медленно, и такие сдвиги накапливаются — при переключении
     BEFORE/AFTER слышится повтор уже прошедшего слога, хотя позиции дорожек
     совпадают. На ПК пара успевает скачаться целиком, «свежих» порций почти нет,
     поэтому там ошибка не проявляется. */
  const shift = (st.nextByte - startByte) / st.meta.bytesPerSec;
  const time = Math.max(0, st.nextTime - shift);
  st.chunk = { payload: bytes.subarray(offset, end), time, frames: frames + (tail ? 1 : 0), nextByte: fromByte + end, tail, fresh: st.fresh };
  st.fresh = false; streamFlush(st);
}

function streamRetryChunk(st, reason) {
  st.fresh = true; st.retryAt = performance.now() + AUDIO_CHUNK_RETRY_MS; st.failCount++;
  if (st.failCount >= 3) streamDisableChunkMode(reason);
  /* Пока пара стоит на паузе (гейт буфера) или ждёт данных, timeupdate молчит,
     и без этого таймера порция не повторилась бы сама — перемотка «зависала»
     бы до переключения трека. */
  clearTimeout(st.retryTimer);
  st.retryTimer = setTimeout(() => { st.retryAt = 0; streamKick(st); }, AUDIO_CHUNK_RETRY_MS + 50);
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
    /* Порция с перемотки легла не в позицию: её отбрасываем, но не «глотаем» —
       иначе потеряется место, с которого качать дальше. Первую порцию после
       перемотки повторяем с той же точки (streamRetryChunk), а для обычной
       порции просто идём дальше, как раньше. */
    if (!streamCheckOffset(st, chunk)) {
      const at = st.el.currentTime || 0;
      if (getBufferedEndAt(st.el, at) <= at) {
        st.nextByte = st.meta.audioStart + Math.round(at * st.meta.bytesPerSec);
        st.nextTime = at; st.fresh = true;
      } else { st.fresh = false; }
    } else {
      st.failCount = 0;   // порция легла на место — счётчик повторов обнулён
      st.nextByte = chunk.nextByte; st.nextTime = chunk.time + chunk.frames * st.meta.frameSec;
      st.appended += chunk.payload.length;
      if (chunk.tail) { st.done = true; st.nextTime = st.meta.duration; streamEndOfStream(st); }
      updateDeckProgressUI();
    }
  }
  streamFlush(st); streamKick(st);
}

function streamCheckOffset(st, chunk) {
  if (!chunk.fresh || chunk.time < 0.5) return true;
  /* Проверяем не «ровно в отметке», а с допуском: декодер mp3 может отдать
     участок на доли секунды позже timestampOffset, и строгая проверка считала
     это промахом — порция снова качалась с той же позиции, и так по кругу. */
  if (getBufferedEndAt(st.el, chunk.time + 0.5) > chunk.time + 0.5) return true;
  /* Порция с перемотки легла не туда. Выключать режим целиком нельзя:
     streamRevertToFile переводит элемент на файл, и браузер качает его С
     НАЧАЛА. Повторяем порцию с той же позиции — режим порций остаётся рабочим. */
  streamRetryChunk(st, 'порция легла не в позицию перемотки');
  return false;
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

/* Перемотка завершена (отпустили ползунок, кликнули по полосе): обе дорожки
   пары обязаны получить порцию РОВНО с новой позиции. Без этого вторая
   (неслышимая) дорожка остаётся без данных, гейт общего буфера не отпускает —
   и звук стоит, пока пару не пересоздашь переключением трека.

   Почему не полагаемся на события seeking/seeked: при перетаскивании ползунка
   их десятки, они «дребезжат», и streamOnSeek со своей проверкой
   (st.fetching && |nextTime - at| < 0.5) часть из них отбрасывает. Здесь
   позиция уже окончательная, поэтому поток ведём к ней безусловно. */
function streamSeekTo(trackId, at) {
  if (!audioChunkSupported() || !trackId) return;
  const item = trackAudioMap[trackId];
  if (!item || !item.wantPlay) return;
  const pos = Math.max(0, at || 0);
  [item.audioA, item.audioB].forEach(el => {
    const st = audioStreamOf(el);
    if (!st || !st.meta) return;
    /* В этой точке данные уже есть и поток не завершён — порция не нужна. */
    if (getBufferedEndAt(el, pos) > pos && !st.done) return;
    /* Уже качаем ровно эту позицию — не рвём живой запрос. */
    if (st.fetching && Math.abs(st.nextTime - pos) < 0.5) return;
    streamStopFetch(st); st.retryAt = 0; st.failCount = 0;
    st.done = false; st.chunk = null;
    st.nextByte = st.meta.audioStart + Math.round(pos * st.meta.bytesPerSec);
    st.nextTime = pos; st.fresh = true;
    streamKick(st);
  });
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


function changeDeckVolume(val) {
  if (!activeTrackId) return;
  const item = trackAudioMap[activeTrackId];
  if (!item) return;

  item.volume = parseFloat(val);
  applyAudioVolumes(activeTrackId, false);
}

/* ══ ПЕРЕКЛЮЧЕНИЕ BEFORE / AFTER ═══════════════════════════════════════════
   Обе дорожки пары идут ВСЕГДА: слышна та, у которой уровень больше нуля,
   вторая беззвучна и стоит в той же точке трека. Переключение — это только
   уровень:
     1. клик сразу меняет источник и интерфейс;
     2. уровень переводится коротким равномощным кроссфейдом (AUDIO_FADE_MS) на
        звуковых часах AudioContext — сэмпл-в-сэмпл, без зависимости от кадров
        и от загрузки главного потока;
     3. позиция при переключении НЕ трогается: ни seek, ни подводки темпом.
        Расхождение пары всё время держит тикер (syncAudioPair), и только на
        беззвучной дорожке, поэтому оно не слышно.
   Отсюда нет задержки между кликом и звуком (кроме самого кроссфейда) и нет
   скачка по треку: входящая дорожка продолжает с той же точки.
   Чтобы это работало всегда, пара не играет дальше точки, до которой скачаны
   ОБА файла: на границе общего буфера звук встаёт на паузу и ждёт данные у
   обеих дорожек (см. «гейт общим буфером пары»). Тогда к моменту клика
   входящая дорожка гарантированно готова.
   И второе условие: пара должна быть подключена к звуковому графу (см. «ЕДИНЫЙ
   ЗВУКОВОЙ ТРАКТ»). Без графа уровень задаётся флагом muted, и переключение
   превращается в скачок заглушки — на телефоне это слышно как повтор слога.
   Поэтому подключение доводится в трёх точках: playPairAudio, ensurePairPlaying
   (перед первым звуком) и onstatechange контекста (первый клик на iOS застаёт
   его ещё спящим — раньше пара первого трека так и оставалась без графа до
   конца трека).
   Если входящая дорожка всё же не готова (нет данных, браузер её остановил),
   звук не рвётся: играет прежняя, а фейд начнётся, как только данные дойдут, —
   не позже AUDIO_SWITCH_WAIT_MS. Не дождались — переключатель возвращается
   назад, чтобы не показывать то, чего не слышно.
   ══════════════════════════════════════════════════════════════════════ */

const AUDIO_FADE_MS = 30;               // мс: равномощный кроссфейд переключения
const AUDIO_SWITCH_WAIT_MS = 300;       // мс: сколько ждём готовности входящей дорожки
const AUDIO_SYNC_TOLERANCE = 0.004;     // мёртвая зона синхронизации (4 мс)
const AUDIO_SYNC_GAIN = 4;              // усиление коррекции скорости
const AUDIO_SYNC_RATE_MAX = 0.08;       // предел коррекции (±8 %: дорожка беззвучна)
const AUDIO_SYNC_SEEK_MAX = 0.25;       // с: больше — выравниваем позицией
const AUDIO_SYNC_TICK_MS = 100;         // мс: подтяжка пары во время воспроизведения

/* ── ОТЧЁТ О ПЕРЕКЛЮЧЕНИИ (для проверки на реальном устройстве) ─────────────
   Включение: открыть страницу с ?abdbg=1. Внизу экрана появляются числа:
   расхождение дорожек, их состояния и запас данных. Нужно это потому, что
   эмуляция телефона в инструментах разработчика не воспроизводит мобильный
   аудио-стек: на ПК и в эмуляции гладко, а на устройстве иначе. По числам сразу
   видно, в чём дело — в позиции дорожек или в самом звуковом тракте.
   Без ?abdbg=1 ничего не создаётся и на работу плеера не влияет. */
const AB_DEBUG = /[?&]abdbg=1/.test(location.search);
const abState = {};
let abBox = null;

function abRender() {
  if (!AB_DEBUG) return;
  if (!abBox) {
    if (!document.body) return;
    abBox = document.createElement('div');
    abBox.id = 'abDebugBox';
    abBox.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;' +
      'background:rgba(0,0,0,.86);color:#8fd8ff;font:11px/1.5 ui-monospace,monospace;' +
      'padding:6px 8px;white-space:pre-wrap;pointer-events:none;max-height:46vh;overflow:hidden';
    document.body.appendChild(abBox);
  }
  abBox.textContent = Object.keys(abState).map(k => k + ': ' + abState[k]).join('\n');
}

function abSet(key, value) {
  if (!AB_DEBUG) return;
  abState[key] = value;
  abRender();
}

/* Запас данных впереди позиции (секунды) */
function abAhead(el, pos) {
  if (!el) return 0;
  try { return Math.max(0, getBufferedEndAt(el, pos) - pos); } catch (err) { return 0; }
}

function abElState(el) {
  if (!el) return '—';
  const lvl = audioLevelMap.has(el) ? ' g' + (audioLevelMap.get(el) || 0).toFixed(2) : '';
  return (el.paused ? 'пауза' : 'игра') +
    (el.seeking ? '/seek' : '') +
    ' rs' + el.readyState +
    (el.muted ? ' muted' : '') +
    ' v' + el.volume.toFixed(2) +
    ' r' + el.playbackRate.toFixed(2) + lvl;
}

/* Фактический уровень дорожки в звуковом тракте (только при ?abdbg=1 и только
   когда пара подключена к графу). Это единственный способ проверить на самом
   устройстве, слышны ли обе дорожки сразу: «тихая» обязана быть около -100 дБ. */
function abRms(el) {
  const an = audioAnalyserMap.get(el);
  if (!an) return '—';
  try {
    const buf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    return (20 * Math.log10(rms + 1e-6)).toFixed(0) + ' дБ';
  } catch (err) { return '—'; }
}

let audioFadeRAF = null;

/* ── ТОЧНАЯ ПОЗИЦИЯ ДОРОЖКИ ────────────────────────────────────────────────
   На телефоне currentTime обновляется рывками: медиа-часы приходят пачками по
   десятки–сотни миллисекунд, у каждой дорожки в своей фазе. Поэтому разница двух
   «сырых» currentTime — это ещё НЕ расхождение дорожек: ошибка достигает сотен
   миллисекунд. Проверка «дорожи стоят в одной точке» по таким числам проходит
   тогда, когда на самом деле одна отстала, — и переход стартует с чужой точки.
   Именно это слышится как повтор последнего слога или фразы, и именно поэтому на
   ПК (там currentTime идёт от звуковых часов гладко) всё в порядке, а на
   устройстве нет.

   Между обновлениями позицию считаем сами: от последнего замера по
   performance.now(). На ПК значения меняются на каждом замере и экстраполяция не
   включается вовсе — там поведение прежнее. */
const AUDIO_POS_EXTRAP_MAX = 0.12;  // с: дальше этого позицию не досчитываем
const AUDIO_POS_STALE_MS = 250;     // мс: дольше часы стоят — считаем, что дорожка встала
const audioPosCache = new WeakMap();

function pairPos(el) {
  if (!el) return 0;
  const now = performance.now();
  const ct = el.currentTime || 0;
  const prev = audioPosCache.get(el);

  /* Медиа-часы стоят, а дорожка играет: досчитываем позицию по времени. Если
     часы стоят слишком долго, это уже не рывок обновления, а остановка
     (буферизация) — тогда позицию не досчитываем, иначе разрыв будет выдуман. */
  if (prev && prev.ct === ct && !el.paused && !el.seeking && !el.ended &&
      now - prev.t < AUDIO_POS_STALE_MS) {
    const dt = (now - prev.t) / 1000 * (el.playbackRate || 1);
    return ct + Math.min(dt, AUDIO_POS_EXTRAP_MAX);
  }

  audioPosCache.set(el, { ct, t: now });
  return ct;
}


/* Какая из двух дорожек звучит сейчас, а какая идёт рядом заглушённой.
   item.source — единственный источник истины: он меняется в момент клика. */
function getAudiblePair(item) {
  const audibleIsA = item.source !== 'after';
  return {
    audible: audibleIsA ? item.audioA : item.audioB,
    silent: audibleIsA ? item.audioB : item.audioA
  };
}

/* ══ ЕДИНЫЙ ЗВУКОВОЙ ТРАКТ ══════════════════════════════════════════════════
   До сих пор уровни дорожек задавались свойствами самих <audio>: volume и
   muted. На телефоне это ненадёжно, и именно там оставался дефект, который не
   лечился никакой правкой таймингов:

   1. muted — не «громкость 0», а отдельный флаг потока. Браузер на телефоне
      вправе держать такой поток в облегчённом состоянии, а при снятии флага
      поднять его заново. У играющей дорожки звуковой тракт уже прогрет, у
      «тихой» — нет, и первые десятки–сотни миллисекунд после снятия заглушки
      выходят с другой задержкой. Слышится это ровно как повтор слога: позиции
      дорожек совпадают, а звук второй приходит позже.
   2. volume на iOS Safari не действует, поэтому плавного фейда там не было
      вовсе — заглушка снималась скачком.
   3. фейд считался по кадрам (requestAnimationFrame): на телефоне кадры
      приходят неравномерно, и «40 мс» могли растянуться.

   Здесь оба элемента сведены в ОДИН AudioContext со своим GainNode у каждого.
   Тогда: уровень задаёт граф (а не флаг потока), элементы для системы всегда
   звучат, у обоих один выход и одна задержка, а фейд планируется на звуковых
   часах — он не зависит от кадров и работает на iOS.

   Включается на всех устройствах: переключение BEFORE / AFTER делается рампами
   на звуковых часах, а они работают только в графе. Полный выключатель —
   AUDIO_GRAPH_ENABLED. */
const AUDIO_GRAPH_ENABLED = true;

let audioCtx = null;
let audioGraphFailed = false;
const audioGainMap = new WeakMap();     // el -> GainNode
const audioLevelMap = new WeakMap();    // el -> текущий уровень 0..1
const audioAnalyserMap = new WeakMap(); // el -> AnalyserNode (только для отчёта)

function audioGraphWanted() {
  return AUDIO_GRAPH_ENABLED;
}

/* Граф подключён к обеим дорожкам пары */
function audioGraphActive(el) {
  if (!audioCtx || audioGraphFailed || audioCtx.state === 'closed') return false;
  return !el || audioGainMap.has(el);
}

function ensureAudioGraph() {
  if (audioCtx || audioGraphFailed) return audioCtx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { audioGraphFailed = true; return null; }
    audioCtx = new Ctx();
    /* Контекст может уснуть сам (свернули вкладку, заблокировали экран). Если
       трек при этом слушают, будим обратно: иначе звук просто пропадёт, потому
       что выход элемента идёт через граф. */
    audioCtx.onstatechange = () => {
      if (!audioCtx) return;
      /* Контекст проснулся — сразу подключаем к нему активную пару, если она ещё
         на volume/muted. Это и есть лечение «первого трека»: первый контекст на
         iOS (и на части Android-браузеров) создаётся СПЯЩИМ, resume() отвечает
         асинхронно, поэтому в момент первого playPairAudio дорожки подключить не
         удавалось — и весь первый трек переключался скачком заглушки, то есть с
         тем самым «повтором». Следующий трек уже заставал контекст рабочим и
         звучал нормально. */
      if (audioCtx.state === 'running') attachActivePairGraph();
      if (!activeTrackId) return;
      const item = trackAudioMap[activeTrackId];
      if (item && item.wantPlay) resumeAudioGraph();
    };
  } catch (err) {
    audioGraphFailed = true;
    audioCtx = null;
  }
  return audioCtx;
}

/* Контекст создаётся и будится только из обработчика действия пользователя
   (клик по треку, play, переключатель): иначе браузер оставит его спящим и
   звука не будет вообще. */
function resumeAudioGraph() {
  if (!audioCtx) return;
  /* 'interrupted' — состояние iOS: контекст прерывается звонком, будильником или
     сменой звукового устройства и возвращается тем же resume(), что и из
     'suspended'. Без этого пара после такого прерывания оставалась без звука. */
  const state = audioCtx.state;
  if (state === 'suspended' || state === 'interrupted') {
    const p = audioCtx.resume();
    if (p && p.catch) p.catch(() => {});
  }
}

/* Подключает дорожку к графу. Вызывается один раз на элемент; повторный вызов
   вернёт уже созданный узел. Уровень берётся из текущего состояния элемента,
   поэтому переключение на граф ничего не меняет на слух. */
function attachAudioGraph(el) {
  if (!el || !audioGraphWanted()) return null;
  const known = audioGainMap.get(el);
  if (known) return known;
  const ctx = ensureAudioGraph();
  if (!ctx) return null;
  /* Подключение необратимо: после createMediaElementSource звук элемента идёт
     ТОЛЬКО через граф, и «отключить обратно» нельзя. Поэтому подключаем лишь
     когда контекст уже работает — иначе пара осталась бы молчащей. Не готов —
     дорожка живёт на volume/muted, а подключение попробуем в следующий раз
     (контекст будит primeAudioGraph по первому касанию страницы). */
  if (ctx.state !== 'running') { resumeAudioGraph(); return null; }

  let gain;
  try {
    gain = ctx.createGain();
    gain.gain.value = el.muted ? 0 : (el.volume || 0);
    gain.connect(ctx.destination);
  } catch (err) { audioGraphFailed = true; return null; }

  let node;
  try {
    node = ctx.createMediaElementSource(el);
  } catch (err) {
    /* Элемент уже отдал свой звук другому узлу — граф ему не подходит. Свой
       GainNode отключаем: без источника он ни на что не влияет. */
    try { gain.disconnect(); } catch (e) {}
    return null;
  }

  try { node.connect(gain); } catch (err) { audioGraphFailed = true; return null; }

  audioGainMap.set(el, gain);
  audioLevelMap.set(el, el.muted ? 0 : (el.volume || 0));
  /* Дальше уровень задаёт только граф: элемент для системы всегда звучит в
     полную силу, поэтому его тракт не «засыпает» и задержка у обеих дорожек
     одинаковая. */
  el.muted = false;
  el.volume = 1;

  if (AB_DEBUG) {
    try {
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      gain.connect(an);
      audioAnalyserMap.set(el, an);
    } catch (err) {}
  }
  return gain;
}

/* Подключает к графу пару целиком. Возвращает true, только если подключение
   произошло СЕЙЧАС (вызывающему нужно один раз выставить уровни). Повторные
   вызовы дешёвые: две проверки в WeakMap.
   Нужна там, где пара вот-вот зазвучит или где её уровень меняется: если граф не
   подключён, кроссфейд вырождается в скачок заглушки — на телефоне это слышно
   как повтор слога (см. «ЕДИНЫЙ ЗВУКОВОЙ ТРАКТ»). */
function ensurePairAudioGraph(trackId) {
  const item = trackAudioMap[trackId];
  if (!item || !audioGraphWanted()) return false;
  if (audioGainMap.has(item.audioA) && audioGainMap.has(item.audioB)) return false;
  attachAudioGraph(item.audioA);
  attachAudioGraph(item.audioB);
  return audioGainMap.has(item.audioA) && audioGainMap.has(item.audioB);
}

/* Пара активного трека подключается к графу, как только он заработал. */
function attachActivePairGraph() {
  if (!activeTrackId) return;
  const item = trackAudioMap[activeTrackId];
  if (!item) return;
  if (!ensurePairAudioGraph(activeTrackId)) return;
  /* Уровни те же, что были у элементов: подключение не слышно. */
  applyAudioVolumes(activeTrackId, false);
}

/* Уровень мгновенно (пауза, скрытая вкладка, старт) */
function setAudioLevel(el, level) {
  const v = Math.max(0, Math.min(1, level));
  const gain = audioGainMap.get(el);
  if (!gain || !audioCtx) {
    el.volume = v;
    el.muted = v <= 0.005;
    return;
  }
  audioLevelMap.set(el, v);
  const param = gain.gain;
  try { param.cancelScheduledValues(audioCtx.currentTime); } catch (err) {}
  param.value = v;
}

/* Плавно, по звуковым часам: рампа планируется заранее и выполняется сэмпл-в-
   сэмпл, независимо от загрузки главного потока и от кадров. */
function rampAudioLevel(el, level, seconds) {
  const v = Math.max(0, Math.min(1, level));
  const gain = audioGainMap.get(el);
  if (!gain || !audioCtx) {
    el.volume = v;
    el.muted = v <= 0.005;
    return;
  }
  const from = gain.gain.value;
  audioLevelMap.set(el, v);
  const param = gain.gain;
  const now = audioCtx.currentTime;
  try {
    param.cancelScheduledValues(now);
    param.setValueAtTime(from, now);
    param.linearRampToValueAtTime(v, now + Math.max(0.01, seconds));
  } catch (err) { param.value = v; }
}

/* Дорожка реально слышна. С графом смотрим на уровень узла: сами элементы там
   не заглушаются. Без графа — по прежним признакам (muted проверяем отдельно:
   на iOS Safari громкость элемента не действует, и только muted даёт тишину). */
function isAudioAudible(el) {
  if (!el || el.paused) return false;
  if (audioGainMap.has(el)) return (audioLevelMap.get(el) || 0) > 0.005;
  return !el.muted && el.volume > 0.005;
}

/* Контекст мог заснуть, пока вкладка была скрыта: возвращаемся — будим. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !activeTrackId) return;
  const item = trackAudioMap[activeTrackId];
  if (item && item.wantPlay) resumeAudioGraph();
});

/* Будим контекст как можно раньше — на первом же касании страницы, задолго до
   клика по треку. К моменту playPairAudio он уже работает, и дорожки можно
   подключить к графу до начала звука (подключение посреди воспроизведения
   слышно как щелчок, поэтому важно успеть заранее). */
function primeAudioGraph() {
  if (!audioGraphWanted()) return;
  ensureAudioGraph();
  resumeAudioGraph();
}
document.addEventListener('pointerdown', primeAudioGraph, { capture: true, passive: true });
document.addEventListener('keydown', primeAudioGraph, { capture: true });

/* Синхронизация пары: трогаем ТОЛЬКО неслышимую дорожку. Звучащая — эталон,
   её позицию и скорость не меняем никогда.
   Позиция досчитывается между обновлениями медиа-часов (pairPos), поэтому
   расхождение видно и на телефоне, где currentTime приходит рывками.
   Коррекция — темпом: дорожка беззвучна, её ускорение или замедление не слышно,
   seek не нужен и декодер не перезапускается. Позицией выравниваем только при
   большом разрыве (дорожку останавливали, пара стояла в буфере, была перемотка). */
function syncAudioPair(item) {
  if (!item) return;
  if (audioFadeActive()) return; // идёт кроссфейд — не вмешиваемся

  const { audible, silent } = getAudiblePair(item);
  if (!isAudioAudible(audible)) return;
  if (silent.seeking || silent.ended) return;

  // Пользователь тянет полосу прокрутки: пока браузер не закончил seek звучащей
  // дорожки, вторую не трогаем — двойной seek как раз и давал рывок в звуке.
  if (item.seekPending) {
    if (audible.seeking) return;
    silent.playbackRate = 1;
    if (Math.abs(pairPos(audible) - pairPos(silent)) > AUDIO_SYNC_TOLERANCE) {
      try { silent.currentTime = pairPos(audible); } catch (err) {}
    }
    item.seekPending = false;
    item.syncDrift = 0;
    return;
  }

  const ref = pairPos(audible);
  const drift = ref - pairPos(silent); // > 0 — тихая отстаёт
  /* Сглаживание: у каждой дорожки свои медиа-часы, и разница двух оценок
     дрожит на несколько миллисекунд. По дрожащей величине темп гулял бы. */
  item.syncDrift = item.syncDrift === undefined
    ? drift
    : item.syncDrift + (drift - item.syncDrift) * 0.4;

  if (Math.abs(item.syncDrift) > AUDIO_SYNC_SEEK_MAX) {
    /* Большой разрыв темпом закрывать секунды. Прыжок по беззвучной дорожке
       неслышен, но только туда, где данные уже есть: seek в непрогруженное
       место уходит в сеть и снова ставит дорожку. */
    if (getBufferedEndAt(silent, ref) > ref) {
      try { silent.currentTime = ref; } catch (err) {}
    }
    if (silent.playbackRate !== 1) silent.playbackRate = 1;
    item.syncDrift = 0;
    return;
  }

  if (Math.abs(item.syncDrift) <= AUDIO_SYNC_TOLERANCE) {
    if (silent.playbackRate !== 1) silent.playbackRate = 1;
    return;
  }

  // Мягкая догонка скоростью: на неслышимой дорожке это незаметно
  const rate = 1 + Math.max(-AUDIO_SYNC_RATE_MAX, Math.min(AUDIO_SYNC_RATE_MAX, item.syncDrift * AUDIO_SYNC_GAIN));
  if (Math.abs(silent.playbackRate - rate) > 0.001) silent.playbackRate = rate;
}

/* Подготовка пары к старту/паузе: на паузе выравнивание позицией неслышно.
   Эталон — звучащая дорожка (по текущему item.source). */
function prepareAudioPair(item) {
  if (!item) return;
  cancelDeckSwitch();
  const { audible } = getAudiblePair(item);
  alignPairTo(item, audible);
  item.seekPending = false;
  item.syncDrift = 0;
}

/* Выравнивает «вторую» дорожку по указанной (эталон не трогаем) */
function alignPairTo(item, referenceEl) {
  if (!item || !referenceEl) return;
  const other = referenceEl === item.audioA ? item.audioB : item.audioA;
  other.playbackRate = 1;
  const ref = pairPos(referenceEl);
  if (Math.abs(ref - pairPos(other)) > AUDIO_SYNC_TOLERANCE) {
    other.currentTime = ref;
  }
}

/* Куда должен прийти текущий фейд: если его прервут, доводим мгновенно */
let audioFadeTargets = null;
let audioFadeUntil = 0;      // мс: до этого времени идёт фейд по звуковым часам

/* Идёт ли фейд (по любому из двух путей: граф или кадры) */
function audioFadeActive() {
  return audioFadeRAF !== null || performance.now() < audioFadeUntil;
}

/* Текущий уровень дорожки (в графе — его гейн, иначе volume/muted) */
function currentAudioLevel(el) {
  if (!el) return 0;
  if (audioLevelMap.has(el)) return audioLevelMap.get(el) || 0;
  return el.muted ? 0 : (el.volume || 0);
}

/* Останавливает фейд, не доводя уровни до старых целей: все вызывающие сами
   сразу выставляют нужные уровни, а «доводка до предыдущей цели» после
   быстрого повторного клика давала бы провал громкости. */
function stopAudioFade() {
  if (audioFadeRAF !== null) {
    cancelAnimationFrame(audioFadeRAF);
    audioFadeRAF = null;
  }
  audioFadeUntil = 0;
  audioFadeTargets = null;
}

function applyAudioVolumes(trackId, smooth = false) {
  const item = trackAudioMap[trackId];
  if (!item) return;

  const targetVolA = item.source === 'before' ? item.volume : 0;
  const targetVolB = item.source === 'after' ? item.volume : 0;

  // Мгновенно: пауза, скрытая вкладка или режим без сглаживания
  if (!smooth || document.hidden || (item.audioA.paused && item.audioB.paused)) {
    stopAudioFade();
    setAudioLevel(item.audioA, targetVolA);
    setAudioLevel(item.audioB, targetVolB);
    return;
  }

  /* Граф подключён: кроссфейд планируется на звуковых часах. Рампа выполняется
     сэмпл-в-сэмпл и не зависит от кадров и от загрузки главного потока — это и
     есть «без задержки» при переключении. */
  if (audioGraphActive() && audioGainMap.has(item.audioA) && audioGainMap.has(item.audioB)) {
    audioFadeTargets = { a: item.audioA, b: item.audioB, volA: targetVolA, volB: targetVolB };
    audioFadeUntil = performance.now() + AUDIO_FADE_MS + 30;
    rampAudioLevel(item.audioA, targetVolA, AUDIO_FADE_MS / 1000);
    rampAudioLevel(item.audioB, targetVolB, AUDIO_FADE_MS / 1000);
    return;
  }

  /* Графа нет (страница без AudioContext) — покадровый фейд по S-кривой: чуть
     менее точный, но без щелчка. */
  const startA = currentAudioLevel(item.audioA);
  const startB = currentAudioLevel(item.audioB);
  stopAudioFade();
  const t0 = performance.now();
  audioFadeTargets = { a: item.audioA, b: item.audioB, volA: targetVolA, volB: targetVolB };

  const step = (now) => {
    const k = Math.min(1, (now - t0) / AUDIO_FADE_MS);
    const ease = 0.5 - Math.cos(k * Math.PI) / 2;

    setAudioLevel(item.audioA, startA + (targetVolA - startA) * ease);
    setAudioLevel(item.audioB, startB + (targetVolB - startB) * ease);

    if (k < 1) {
      audioFadeRAF = requestAnimationFrame(step);
    } else {
      audioFadeRAF = null;
      audioFadeTargets = null;
      setAudioLevel(item.audioA, targetVolA);
      setAudioLevel(item.audioB, targetVolB);
    }
  };

  audioFadeRAF = requestAnimationFrame(step);
}

/* ── Ожидание готовности входящей дорожки ────────────────────────────────
   В обычном переключении этих функций нет: пара играет всегда, обе дорожки
   стоят в одной точке, и звук меняется одним кроссфейдом. Сюда попадаем только
   когда входящая дорожка не готова — браузер её остановил или в этой точке нет
   данных. Тогда звук не рвём: продолжает играть прежняя дорожка, а фейд
   начнётся, как только данные дойдут. */

let deckSwitchToken = 0;
let deckSwitchTimer = 0;

/* Отменяет отложенный фейд: новый клик, смена трека, пауза, перемотка. */
function cancelDeckSwitch() {
  deckSwitchToken++;
  if (deckSwitchTimer) {
    clearTimeout(deckSwitchTimer);
    deckSwitchTimer = null;
  }
}

/* Дорожка готова звучать прямо сейчас: играет, не в перемотке, и данных впереди
   хватает на продолжение (HAVE_FUTURE_DATA). */
function isDeckReadyToSound(el) {
  return !!el && !el.paused && !el.ended && !el.seeking && el.readyState >= 3;
}

function waitDeckReadyThenFade(item, nextEl, prevEl, src) {
  cancelDeckSwitch();
  const token = deckSwitchToken;
  const deadline = performance.now() + AUDIO_SWITCH_WAIT_MS;

  const step = () => {
    deckSwitchTimer = null;
    if (token !== deckSwitchToken) return;   // пришёл новый клик
    if (!activeTrackId || trackAudioMap[activeTrackId] !== item || item.source !== src) return;

    if (isDeckReadyToSound(nextEl)) {
      fadePairToSource(item, nextEl);
      return;
    }
    if (!item.wantPlay || performance.now() > deadline) {
      /* Не дождались: возвращаем прежний источник, чтобы переключатель не
         показывал то, чего не слышно. Сама пара при этом не тронута. */
      item.source = prevEl === item.audioA ? 'before' : 'after';
      updateDeckSourceUI();
      return;
    }
    deckSwitchTimer = setTimeout(step, 16);
  };

  deckSwitchTimer = setTimeout(step, 16);
}

/* Сам кроссфейд: меняются только уровни. Позиции не трогаем — входящая дорожка
   уже стоит в той же точке, что и звучащая (её держит syncAudioPair). */
function fadePairToSource(item, nextEl) {
  cancelDeckSwitch();
  /* Входящая могла догонять темпом: возвращаем нормальную скорость, иначе после
     фейда она зазвучала бы с изменённой. Позиция от этого не прыгает. */
  if (nextEl.playbackRate !== 1) nextEl.playbackRate = 1;
  item.syncDrift = 0;

  if (AB_DEBUG) {
    const ms = item.switchAt ? performance.now() - item.switchAt : 0;
    abSet('переход', 'фейд ' + AUDIO_FADE_MS + ' мс через ' + ms.toFixed(0) +
      ' мс после клика: Δ ' + ((pairPos(item.audioA) - pairPos(item.audioB)) * 1000).toFixed(0) + ' мс');
  }
  applyAudioVolumes(activeTrackId, true);
}

/* ══ ПОДТЯЖКА ПАРЫ ВО ВРЕМЯ ВОСПРОИЗВЕДЕНИЯ ══════════════════════════════
   Синхронизация на timeupdate приходила 2–4 раза в секунду, а на телефоне
   реже: неслышимая дорожка успевала разойтись, и переключение попадало в
   расхождение. Тик держит дорожки в одной точке всё время, пока трек слушают,
   поэтому в момент клика они уже совпадают и выравнивать нечего. */
function syncActivePairTick() {
  if (!activeTrackId) return;
  const item = trackAudioMap[activeTrackId];
  if (!item || !item.wantPlay) return;
  if (item.bufferGate) return;     // пара ждёт данных — её не трогаем
  if (audioFadeActive()) return;   // идёт кроссфейд

  const { audible, silent } = getAudiblePair(item);
  if (!isAudioAudible(audible)) return;

  /* Вторая дорожка встала: браузер мог отжать у неё звук (телефон, смена
     звукового устройства) или она осталась на паузе. Сама она уже не поедет, и
     на клике это обернулось бы отставанием на всю длину паузы. Перед запуском
     ставим её в точку звучащей — дорожка заглушена, прыжок неслышен. */
  if (silent.paused && !silent.ended) {
    alignPairTo(item, audible);
    const p = silent.play();
    if (p && p.catch) p.catch(() => {});
  }
  syncAudioPair(item);
}

setInterval(syncActivePairTick, AUDIO_SYNC_TICK_MS);

/* Отчёт (только при ?abdbg=1): расхождение пары при обычном прослушивании и
   фактический уровень каждой дорожки в тракте. Если расхождение маленькое, а
   повтор при переключении всё равно слышен, — дело не в позиции; тогда смотрим
   на уровни: у «тихой» дорожки должно быть около -100 дБ. Если там слышимый
   уровень, значит звучат обе дорожки сразу (эхо, которое воспринимается как
   повтор), и правки таймингов тут ни при чём. */
if (AB_DEBUG) {
  setInterval(() => {
    if (!activeTrackId) return;
    const item = trackAudioMap[activeTrackId];
    if (!item || !item.wantPlay) return;
    const { audible, silent } = getAudiblePair(item);
    const raw = (audible.currentTime || 0) - (silent.currentTime || 0);
    const est = pairPos(audible) - pairPos(silent);
    abSet('тракт', audioCtx
      ? 'контекст ' + audioCtx.state + ' | граф: A ' + (audioGainMap.has(item.audioA) ? 'да' : 'НЕТ') +
        ', B ' + (audioGainMap.has(item.audioB) ? 'да' : 'НЕТ') +
        ' | ' + abRms(item.audioA) + ' / ' + abRms(item.audioB)
      : 'volume/muted (без графа)');
    abSet('в игре', 'Δ сырое ' + (raw * 1000).toFixed(0) + ' мс, с досчётом ' +
      (est * 1000).toFixed(0) + ' мс | A ' + abElState(item.audioA) +
      ' | B ' + abElState(item.audioB));
    /* Запас данных у каждой дорожки: пока он меньше AUDIO_PAIR_GUARD, пара стоит
       на гейте (ждёт порции для ОБЕИХ дорожек), и переключаться нечем. */
    const at = audible.currentTime || 0;
    abSet('буфер', 'впереди пары ' + getPairBufferedAhead(item, at).toFixed(1) +
      ' с (A ' + abAhead(item.audioA, at).toFixed(1) + ', B ' + abAhead(item.audioB, at).toFixed(1) +
      ') | ' + (item.bufferGate ? 'гейт: ждём данные' : 'гейт: не нужен'));
  }, 500);
}


/* ── гейт общим буфером пары ───────────────────────────────────────────
   Переключение BEFORE / AFTER возможно только тогда, когда данные есть у ОБЕИХ
   дорожек: если входящая отстала, кроссфейд придётся откладывать, и плавность
   теряется. Поэтому пара не играет дальше точки, до которой скачаны оба файла:
   запас AUDIO_PAIR_GUARD (0.6 с) — пауза, запас AUDIO_PAIR_HEAD (1.5 с) —
   продолжение. Останавливаются ОБЕ дорожки и выравниваются в одной точке, а
   продолжают вместе: иначе тихая успела бы уехать вперёд и после снятия гейта
   пара поехала бы с расхождением.
   Пока пара стоит на паузе, порции продолжают качаться (поток не выключается),
   поэтому пауза сама снимается, как только данные дошли. */

const AUDIO_PAIR_GUARD = 0.6;  // с: запас, при котором пара встаёт на паузу
const AUDIO_PAIR_HEAD = 1.5;   // с: запас, с которым она продолжает (гистерезис)

/* Конец скачанного участка дорожки РОВНО в этой точке. 0 — данных в позиции нет
   (дыра): впереди может лежать скачанный кусок, но играть до него нельзя, не
   перематывая. Именно так выглядит конец общего буфера пары. */
function getBufferedEndAt(el, pos) {
  if (!el) return 0;
  try {
    const t = Math.max(0, pos || 0);
    for (let i = 0; i < el.buffered.length; i++) {
      if (el.buffered.start(i) > t) break; // участок начинается правее точки — здесь дыра
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

/* Начало ближайшего скачанного участка ВПЕРЁД от позиции (-1 — дальше данных нет). */
function getBufferedNextStart(el, pos) {
  if (!el) return -1;
  try {
    const t = Math.max(0, pos || 0);
    for (let i = 0; i < el.buffered.length; i++) {
      const start = el.buffered.start(i);
      if (start > t) return start;
    }
    return -1;
  } catch (err) {
    return -1;
  }
}

const AUDIO_STALL_MS = 1200;     // мс: столько пара может стоять на месте — дальше лечим
const AUDIO_STALL_TICK_MS = 500; // мс: как часто проверяем залипание

/* Залипание после перемотки. Позиция перемотки может попасть в дыру буфера:
   первый кадр порции встаёт не ровно на свою отметку, поэтому между уже
   скачанным участком и только что добавленным остаётся щель в доли секунды.
   В этой точке данных нет, элемент застревает в seeking, новых запросов не
   уходит — звук не идёт, кнопка всё крутится, а беззвучная дорожка пары уходит
   вперёд (syncAudioPair молчит, пока идёт seek). Ручная перемотка это лечит:
   она сдвигает позицию к началу имеющихся данных. Здесь делаем то же самое
   автоматически — если пара «играет», а звучащая дорожка замерла в точке без
   данных, уводим её к ближайшим данным (не дальше AUDIO_PAIR_HEAD) и просим
   порцию оттуда. */
function watchAudioStall() {
  if (!activeTrackId) return;
  const item = trackAudioMap[activeTrackId];
  if (!item || !item.wantPlay) return;
  /* Пара стоит на гейте: timeupdate молчит, поэтому порции просим и снятие
     гейта проверяем здесь — иначе на медленном канале загрузка могла бы
     остановиться вместе со звуком. */
  if (item.bufferGate) {
    streamTickItem(item);
    releasePairBufferGate(activeTrackId);
    return;
  }

  const { audible } = getAudiblePair(item);
  const pos = audible.currentTime || 0;
  /* Хвост трека: там ждать нечего — либо пара доигрывает, либо данных в самом
     конце уже не будет (та же оговорка, что в checkPairBufferGate). */
  const dur = audible.duration || 0;
  if (dur > 0 && dur - pos <= AUDIO_PAIR_HEAD) { item.stallAt = 0; return; }
  const stuck = !audible.paused && !audible.ended &&
    getBufferedEndAt(audible, pos) <= pos;
  if (!stuck) { item.stallAt = 0; return; }

  const now = performance.now();
  /* Позиция сдвинулась — это ещё не залипание, а обычная загрузка. */
  if (!item.stallAt || Math.abs(pos - (item.stallPos || 0)) > 0.05) {
    item.stallAt = now; item.stallPos = pos;
    return;
  }
  /* Порция уже в пути или ждёт повтора — не мешаем своему же запросу. */
  const st = audioStreamOf(audible);
  if (st && (st.fetching || (st.retryAt && now < st.retryAt))) { item.stallAt = now; return; }
  if (now - item.stallAt < AUDIO_STALL_MS) return;
  item.stallAt = now;

  const next = getBufferedNextStart(audible, pos);
  const at = (next > pos && next - pos <= AUDIO_PAIR_HEAD) ? next : pos;
  if (at > pos) { try { audible.currentTime = at; } catch (err) {} }
  streamSeekTo(activeTrackId, at);
  if (!isPairWarm(item)) warmOnSeek(activeTrackId, at);
}

setInterval(watchAudioStall, AUDIO_STALL_TICK_MS);

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
  const buffering = item.bufferGate || audible.readyState < 3;
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
  /* Останавливаем ОБЕ дорожки и ставим их в одну точку: пока пара стоит, тихая
     иначе уехала бы вперёд, и после снятия гейта они поехали бы с расхождением —
     то есть переключение снова пришлось бы начинать с выравнивания. */
  alignPairTo(item, audible);
  audible.pause();
  const silent = audible === item.audioA ? item.audioB : item.audioA;
  if (!silent.paused) silent.pause();
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
  if (getPairBufferedAhead(item, pos) < AUDIO_PAIR_HEAD) {
    /* Данных у одной из дорожек ещё нет. Гейт мог встать сразу после перемотки:
       страховка на случай, если порция для второй дорожки не попросилась сама
       (её событие seeking не пришло) — просим её отсюда, и пауза снимется. */
    streamSeekTo(trackId, pos);
    /* Пара стоит, timeupdate молчит: просим порции обеих дорожек здесь же, иначе
       на медленном канале следующая порция могла бы не запроситься вовсе. */
    streamTickItem(item);
    /* Порционный режим выключен: streamSeekTo ничего не качает, и дыра в буфере
       отстающей дорожки сама не закроется — гейт запирал пару навсегда (звук не
       идёт, кнопка всё крутится). Просим пропущенный участок у браузера обычной
       перемоткой этой дорожки: она беззвучна, а данные придут Range-запросом. */
    if (!audioChunkSupported()) {
      const silent = (item.audioA === audible) ? item.audioB : item.audioA;
      if (silent && getBufferedAhead(silent, pos) < AUDIO_PAIR_HEAD &&
          Math.abs((silent.currentTime || 0) - pos) > 0.3) {
        try { silent.currentTime = pos; } catch (err) {}
      }
    }
    return;
  }

  item.bufferGate = false;
  /* Обе дорожки снова в одной точке — и только теперь продолжаем: до этого
     момента переключение было бы невозможно без потери плавности. */
  alignPairTo(item, audible);
  ensurePairPlaying(trackId);
  updateDeckBufferingUI();
}

/* Трек слушают, но дорожка стоит без данных: как только браузер снова может
   играть — продолжаем без клика пользователя. */
function ensurePairPlaying(trackId) {
  const item = trackAudioMap[trackId];
  if (!item || !item.wantPlay) return;
  /* Пара вот-вот зазвучит, а контекст к этому моменту уже разбужен кликом:
     подключаем граф здесь, до первого звука, чтобы переключение сразу шло
     рампами. Если контекст всё ещё спит, подключение сделает onstatechange. */
  if (ensurePairAudioGraph(trackId)) applyAudioVolumes(trackId, false);
  [item.audioA, item.audioB].forEach(el => {
    if (!el.paused || el.ended) return;
    /* Запускаем в точке звучащей дорожки: сама дорожка стояла, её звука нет,
       поэтому прыжок неслышен — зато пара продолжит синхронно. */
    const other = el === item.audioA ? item.audioB : item.audioA;
    if (!other.paused && !other.seeking && !other.ended) {
      const at = pairPos(other);
      if (Math.abs((el.currentTime || 0) - at) > 0.02 && getBufferedEndAt(el, at) > at) {
        try { el.currentTime = at; } catch (err) {}
      }
    }
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
  /* Звуковой тракт (см. «ЕДИНЫЙ ЗВУКОВОЙ ТРАКТ»): подключаем пару к графу
     именно здесь — этот вызов всегда идёт из действия пользователя, а браузер
     только в нём и разрешает создать/разбудить AudioContext. Уровень каждой
     дорожки берётся из её текущего состояния, так что момент подключения
     неслышен. Если граф недоступен, пара продолжает жить на volume/muted. */
  if (audioGraphWanted()) {
    ensurePairAudioGraph(trackId);
    resumeAudioGraph();          // будим ПОСЛЕ создания: контекст мог только появиться
    applyAudioVolumes(trackId, false);
  }
  /* Поток данных пары: в порционном режиме клик сразу просит первые секунды. */
  if (audioChunkSupported()) streamActivateItem(item, true);
  /* Стоит ли на текущей позиции общий буфер пары (данные ОБЕИХ дорожек)? Если
     нет, звук не начинаем: покажем ожидание и стартуем сами, когда данные дойдут
     (releasePairBufferGate). Так на холодном клике не бывает «пуск-стоп». */
  const { audible } = getAudiblePair(item);
  item.bufferGate = getPairBufferedAhead(item, audible.currentTime || 0) <= AUDIO_PAIR_GUARD;
  if (item.bufferGate) {
    /* Старт с ожиданием: обе дорожки в одну точку и обе стоят. Продолжим
       вдвоём, когда данные будут у обеих (releasePairBufferGate). */
    alignPairTo(item, audible);
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

