// ═══════════════════════════════════════════════════════════════════════
// js/about.js — «ОБО МНЕ»: РАЗДЕЛ НА ПК, КАДРЫ, ПРОМОКОД
// Грузится после: js/state.js. Читает: currentLang, CONFIG.
// Владеет: PROMO_CODE, aboutSlideIndex, aboutSlideLockedUntil, ABOUT_*.
// Публичные (window): initAboutShowcase, openAboutModal, closeAboutModal, closeAboutShowcase,
//                     aboutGoToSlide, aboutMuteUnderLayer (её зовёт onclick в index.html).
// Блоки файла:
//   • #aboutShowcase на ПК (от 1024px): кадры about-1..3.webp, подписи, точки, «Листайте».
//   • #aboutModal — тот же контент на телефоне и планшете.
//   • PROMO_CODE читает js/toast.js → copyPromoCode, поэтому toast.js грузится после.
// ═══════════════════════════════════════════════════════════════════════

// --- «ОБО МНЕ»: ПОЛНОЭКРАННЫЙ РАЗДЕЛ НА КОМПЬЮТЕРЕ (от 1024px) ---
// Телефону и планшету остаётся модалка #aboutModal (на телефоне — лист на весь
// экран, css/style/09-modals.css); с 1024px тот же контент
// открывается как раздел #aboutShowcase: три кадра about-1..3.webp, по одному
// за жест. Обычного скролла здесь нет намеренно — иначе кадры пролетали бы
// пачкой; один жест = один кадр, поэтому у колеса есть накопление дельты и
// замок ABOUT_STEP_LOCK мс. Ввод: колесо, стрелки / PageUp / PageDown / пробел,
// свайп, клик по точке. Страница под разделом стоит на паузе (lockPageScroll).
// Расчёт стоимости (z-index 105) и контакты (110) открываются ПОВЕРХ раздела
// (100): кнопки кадра 3 его не закрывают, а Esc снимает слои по одному сверху
// вниз. Пока слой открыт, раздел помечен aria-hidden — двух aria-modal на
// экране быть не должно (aboutMuteUnderLayer).
const ABOUT_SHOWCASE_MQ = '(min-width: 1024px)';
// мс: столько кадр держит следующий жест. 300 — примерно длина анимации кадра
// (css/anim/15-about.css): быстрее жест не читается, а больше — 1-й → 3-й кадр
// занимал бы полторы секунды.
const ABOUT_STEP_LOCK = 300;
const ABOUT_WHEEL_STEP = 30;   // px: минимальная дельта, считающаяся жестом
// px: сколько дельты копим за время замка. Жест, пришедший во время замка, не
// выбрасывается: дельта ждёт в накопителе и сразу даёт шаг, как только замок
// истёк. Предел — чтобы инерция тачпада после одного рывка не растянулась на
// несколько кадров.
const ABOUT_WHEEL_ACCUM_MAX = 150;
// Промокод со скидкой: одно значение на всё — строка на финальном кадре
// «Обо мне» (aboutModal.discount) и промо-блок ответов FAQ (FAQ_PROMO_RU/EN).
// Именно оно уходит в буфер обмена по клику; в текстах код показан как
// «NRSDiscount» — при смене кода менять в трёх местах: здесь и в текстах.
const PROMO_CODE = 'NRSDiscount';
let aboutSlideIndex = 0;
let aboutSlideLockedUntil = 0;
let aboutWheelAccum = 0;
let aboutWheelLastAt = 0;   // время последнего движения колеса: по паузе видно конец жеста
let aboutWheelDrainTimer = 0;   // таймер, который забирает накопленную дельту
let aboutTouchStartY = null;
let aboutPhotosWarmed = false;

function isAboutShowcaseViewport() {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia(ABOUT_SHOWCASE_MQ).matches;
}

function aboutSlides() {
  return document.querySelectorAll('#aboutShowcase .nr-about-slide');
}

// Кадры грузятся лениво: прогреваем их при наведении на то, что открывает
// «Обо мне», и при открытии — первый кадр не мигает пустотой.
function warmAboutPhotos() {
  if (aboutPhotosWarmed) return;
  aboutPhotosWarmed = true;
  ['1', '2', '3'].forEach(function (n) {
    const img = new Image();
    img.src = './image/about-' + n + '.webp';
  });
}

function aboutGoToSlide(index) {
  const slides = aboutSlides();
  if (!slides.length) return;
  const next = Math.max(0, Math.min(slides.length - 1, index));
  aboutSlideIndex = next;

  slides.forEach(function (slide, i) {
    slide.classList.toggle('is-active', i === next);
  });

  document.querySelectorAll('#aboutShowcase .nr-about-dot').forEach(function (dot, i) {
    dot.classList.toggle('is-active', i === next);
    if (i === next) dot.setAttribute('aria-current', 'true');
    else dot.removeAttribute('aria-current');
  });

  // Текущий кадр нужен и вёрстке: по нему CSS гасит подсказку «Листайте» на
  // финальном кадре (css/style/20-about.css → .nr-about-overlay[data-about-active="2"]).
  const box = document.getElementById('aboutShowcase');
  if (box) box.setAttribute('data-about-active', String(next));
}

// Один шаг листания; с краёв дальше первого/последнего кадра не уходим.
function aboutStep(delta) {
  const now = Date.now();
  if (now < aboutSlideLockedUntil) return;
  const next = aboutSlideIndex + delta;
  if (next < 0 || next > aboutSlides().length - 1) return;
  aboutSlideLockedUntil = now + ABOUT_STEP_LOCK;
  aboutGoToSlide(next);
}

// Накопитель колеса и его таймер: сбрасываем и при открытии, и при закрытии
// раздела. Иначе запоздавший шаг перелистнул бы кадр сразу после открытия.
function aboutResetWheel() {
  if (aboutWheelDrainTimer) { clearTimeout(aboutWheelDrainTimer); aboutWheelDrainTimer = 0; }
  aboutWheelAccum = 0;
  aboutWheelLastAt = 0;
}

function openAboutShowcase() {
  const box = document.getElementById('aboutShowcase');
  if (!box) return;
  warmAboutPhotos();
  aboutGoToSlide(0);                                    // всегда с первого кадра
  // Гасим «хвост» клика, которым раздел открыли: 250 мс — примерно столько
  // длится нажатие на кнопку, и первый кадр не проскакивает вперёд от него.
  aboutSlideLockedUntil = Date.now() + 250;
  aboutResetWheel();
  box.classList.add('active');
  box.setAttribute('aria-hidden', 'false');
  lockPageScroll();
}

function closeAboutShowcase() {
  const box = document.getElementById('aboutShowcase');
  if (!box || !box.classList.contains('active')) return;
  box.classList.remove('active');
  box.setAttribute('aria-hidden', 'true');
  aboutResetWheel();
  unlockPageScroll();
}

// Забирает накопленную дельту, как только кадр «отпустил» жест. Без этого
// короткий рывок (вся дельта приходит за время замка) давал бы ровно один шаг:
// следующего события колеса, чтобы её забрать, уже не будет.
function aboutDrainWheelAfterLock() {
  if (aboutWheelDrainTimer) return;
  const wait = Math.max(0, aboutSlideLockedUntil - Date.now()) + 10;
  aboutWheelDrainTimer = setTimeout(function () {
    aboutWheelDrainTimer = 0;
    if (Math.abs(aboutWheelAccum) < ABOUT_WHEEL_STEP) return;
    const delta = aboutWheelAccum > 0 ? 1 : -1;
    aboutWheelAccum = 0;
    aboutStep(delta);
  }, wait);
}

// Открыт ли поверх раздела слой. Слои лежат соседями в body и по z-index выше
// раздела: контакты — 110, расчёт стоимости — 105, «Обо мне» — 100
// (css/style/20-about.css). Пока такой слой открыт, клавиши раздела молчат:
// в расчёте есть поле «Комментарий», и пробел должен печататься, а не листать
// кадры.
function aboutLayerOnTop() {
  return ['priceCalcShowcase', 'contactModal'].some(function (id) {
    const el = document.getElementById(id);
    return !!el && el.classList.contains('active');
  });
}

// Пока поверх раздела открыт слой, сам раздел остаётся на экране, но для
// скринридера исчезает: два aria-modal одновременно недопустимы. Возвращаем
// aria-hidden, как только слой закроется. Следим за его классом, а не за
// конкретной кнопкой «Назад»: слой закрывают и крестиком, и Esc, и кликом по
// затемнению. Наблюдатель живёт только пока слой открыт.
function aboutMuteUnderLayer(layerId) {
  const layer = document.getElementById(layerId);
  if (!layer) return;

  const showcase = document.getElementById('aboutShowcase');
  const modal = document.getElementById('aboutModal');
  const target = showcase && showcase.classList.contains('active') ? showcase
    : modal && modal.classList.contains('active') ? modal
      : null;
  if (!target) return;
  // Без наблюдателя раздел остался бы «немым» навсегда — тогда лучше не глушить.
  if (typeof MutationObserver !== 'function') return;

  target.setAttribute('aria-hidden', 'true');
  // inert — уже про фокус и клики: под слоем остаются живые кнопки и ссылки,
  // и Tab уводил бы в них. Браузеры без inert атрибут просто игнорируют.
  target.setAttribute('inert', '');

  const observer = new MutationObserver(function () {
    if (layer.classList.contains('active')) return;
    observer.disconnect();
    target.removeAttribute('inert');
    target.setAttribute('aria-hidden', target.classList.contains('active') ? 'false' : 'true');
  });
  observer.observe(layer, { attributes: true, attributeFilter: ['class'] });
}

function initAboutShowcase() {
  const box = document.getElementById('aboutShowcase');
  if (!box) return;

  // Колесо: страницу под разделом не двигаем вообще, кадры листаем по одному.
  // Дельта копится всегда, в том числе во время замка: иначе быстрый жест
  // пропадал целиком (замок сбрасывал накопитель) и 1-й → 3-й кадр занимал
  // больше секунды. Накопленное не ждёт следующего события — по истечении
  // замка его забирает aboutDrainWheelAfterLock, поэтому серия движений даёт
  // шаг за шагом, а не один шаг на всю серию.
  box.addEventListener('wheel', function (e) {
    e.preventDefault();
    const now = Date.now();
    // Пауза больше 200 мс — это уже новый жест: остаток дельты от прошлого не
    // копим, иначе одно движение колеса через полминуты срабатывало бы сразу.
    if (now - aboutWheelLastAt > 200) aboutWheelAccum = 0;
    aboutWheelLastAt = now;
    aboutWheelAccum = Math.max(-ABOUT_WHEEL_ACCUM_MAX,
      Math.min(ABOUT_WHEEL_ACCUM_MAX, aboutWheelAccum + e.deltaY));
    if (now < aboutSlideLockedUntil) { aboutDrainWheelAfterLock(); return; }
    if (Math.abs(aboutWheelAccum) < ABOUT_WHEEL_STEP) return;
    const delta = aboutWheelAccum > 0 ? 1 : -1;
    aboutWheelAccum = 0;
    aboutStep(delta);
  }, { passive: false });

  // Тачскрин/тачпад: короткий свайп = один кадр.
  box.addEventListener('touchstart', function (e) {
    aboutTouchStartY = e.touches[0] ? e.touches[0].clientY : null;
  }, { passive: true });

  box.addEventListener('touchmove', function (e) {
    e.preventDefault();
  }, { passive: false });

  box.addEventListener('touchend', function (e) {
    if (aboutTouchStartY === null) return;
    const endY = e.changedTouches[0] ? e.changedTouches[0].clientY : aboutTouchStartY;
    const dy = aboutTouchStartY - endY;
    aboutTouchStartY = null;
    if (Math.abs(dy) < 40) return;
    aboutStep(dy > 0 ? 1 : -1);
  });

  // Клавиатура — только пока раздел открыт и поверх него нет слоя.
  document.addEventListener('keydown', function (e) {
    if (!box.classList.contains('active')) return;
    if (aboutLayerOnTop()) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      aboutStep(1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      aboutStep(-1);
    }
  });

  // Точки, кнопки кадра 3 и закрытие по клику на затемнение за рамкой (сам
  // кадр не закрывает). Кнопки слайда 3 разбираем здесь по data-about-action,
  // а не в onclick: клик по кнопке не должен «протечь» в обработчик оверлея.
  // «Обсудить проект» и «Контакты» раздел НЕ закрывают: расчёт (105) и окно
  // контактов (110) ложатся поверх него (100), а Esc возвращает в раздел на
  // том же кадре. Закрытие оставлено только там, где дальше идёт прокрутка
  // страницы (демо и отзывы) — иначе она осталась бы заблокированной.
  box.addEventListener('click', function (e) {
    const actionEl = e.target.closest ? e.target.closest('[data-about-action]') : null;
    if (actionEl) {
      e.preventDefault();
      e.stopPropagation();
      const action = actionEl.getAttribute('data-about-action') || '';
      if (action === 'calc') {
        // Та же точка входа, что у кнопок «Заказать» (js/calculator.js →
        // openPriceCalc). Пока слой открыт, раздел помечается aria-hidden.
        openPriceCalc();
        aboutMuteUnderLayer('priceCalcShowcase');
      } else if (action === 'contact') {
        openContactModal();
        aboutMuteUnderLayer('contactModal');
      } else if (action === 'demos') {
        closeAboutShowcase();
        scrollPageToElement('player');
      } else if (action === 'reviews') {
        closeAboutShowcase();
        scrollPageToElement('reviews');
      } else if (action.indexOf('faq-') === 0) {
        goToFaqItem(parseInt(action.slice(4), 10) || 0);
      } else if (action === 'copy-discount') {
        // Промокод со скидкой: копируем значение и коротко подсвечиваем кнопку.
        copyPromoCode(actionEl);
      }
      return;
    }

    const dot = e.target.closest ? e.target.closest('.nr-about-dot') : null;
    if (dot) {
      aboutGoToSlide(parseInt(dot.getAttribute('data-about-dot'), 10) || 0);
      return;
    }
    if (e.target === box) closeAboutShowcase();
  });

  // Прогрев фото при наведении на логотип и фото в hero — только на компьютере.
  if (isAboutShowcaseViewport()) {
    document.querySelectorAll('[onclick="openAboutModal()"]').forEach(function (el) {
      el.addEventListener('pointerenter', warmAboutPhotos);
    });
  }

  // Окно сузили ниже 1024px — там своя модалка, раздел закрываем.
  window.addEventListener('resize', function () {
    if (box.classList.contains('active') && !isAboutShowcaseViewport()) closeAboutShowcase();
  });
}

/* ── ПОДГОНКА «ГЛАВНЫХ» СТРОК БИОГРАФИИ ПОД ШИРИНУ ОКНА ────────────────────

   Речь о двух строках окна «Обо мне» (css/style → «ДВЕ ГЛАВНЫЕ СТРОКИ…»):
   вступлении «Проходил обучение у лучших в индустрии:» и финальной фразе
   «С радостью готов поработать с тобой!». Обе должны стоять ОДНОЙ строкой на
   телефоне любой ширины.

   В css/style кегль задан долей ширины абзаца (4.62cqi и 5.12cqi) с запасом 4%
   — этого хватает, чтобы строка не переносилась даже без скрипта. Здесь кегль
   доводится до точного: он зависит от реальной ширины текста, а она меняется
   по трём причинам:

     1) шрифты могли не успеть загрузиться (fonts.css отдаёт woff2 с
        font-display: swap — до загрузки буквы рисует фолбэк, метрики другие);
     2) в системе пользователя может быть включён увеличенный/уменьшенный
        размер шрифта (и мобильные браузеры иногда добавляют свой масштаб);
     3) поля у окна разные по брейкпоинтам (p-3/p-4, p-5) и есть полоса
        прокрутки — заранее долей от ширины окна их не учесть.

   Каждая строка подгоняется ПОД СВОЮ длину: финальная фраза короче вступления
   (18.76 em против 20.79 em), и при общем кегле она оставляла бы заметный
   зазор в конце. Строка при этом всегда остаётся одной: при нехватке места
   уменьшается кегль, а не происходит перенос. */

// Пределы. Снизу 9px — ниже текст нечитаем. Сверху 18px — кегль заголовка
// «Обо мне» (text-lg в index.html): крупнее этих строк быть не должно.
var ABOUT_LEAD_FONT_MIN = 9;
var ABOUT_LEAD_FONT_MAX = 18;
// Доля доступной ширины, которую занимает строка: 0.985 — 1.5% запаса на
// субпиксельные округления.
var ABOUT_LEAD_FILL = 0.985;

/* Подгоняет ОДНУ строку: измеряет её ширину на эталонном кегле и ставит такой,
   при котором она займёт почти всю доступную ширину абзаца. */
function fitAboutLead(lead) {
  if (!lead || !lead.parentElement) return;

  var box = lead.parentElement;
  var cs = getComputedStyle(box);
  var avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  // Предок ещё не отрисован (окно закрыто) — мерить нечего.
  if (!(avail > 0)) return;

  // Сброс к CSS перед замером: иначе следующая подгонка считалась бы от
  // результата предыдущей, то есть от своего же inline-размера.
  lead.style.fontSize = '';

  // Ширина всей фразы одной строкой на эталонном кегле 100px. Перенос при
  // измерении запрещён намеренно: нужна полная ширина текста, а не последней
  // строки. Запись и чтение идут подряд в одном блоке — до перерисовки кадра,
  // поэтому подмены кегля на экране не видно.
  lead.style.whiteSpace = 'nowrap';
  lead.style.fontSize = '100px';
  var range = document.createRange();
  range.selectNodeContents(lead);
  var full = range.getBoundingClientRect().width;
  if (typeof range.detach === 'function') range.detach();
  lead.style.whiteSpace = '';

  if (!full) { lead.style.fontSize = ''; return; }

  var size = (100 * avail * ABOUT_LEAD_FILL) / full;
  size = Math.max(ABOUT_LEAD_FONT_MIN, Math.min(ABOUT_LEAD_FONT_MAX, size));
  lead.style.fontSize = size.toFixed(2) + 'px';

  // Страховка на округления: если строка всё-таки шире места — ужимаем шагами.
  // scrollWidth больше clientWidth только когда содержимое не влезло в строку.
  for (var i = 0; i < 4 && lead.scrollWidth > lead.clientWidth; i++) {
    size *= 0.985;
    lead.style.fontSize = size.toFixed(2) + 'px';
  }
}

/* Обе строки окна «Обо мне» разом. */
function fitAboutLeads() {
  fitAboutLead(document.querySelector('#aboutModal .nr-about-training-lead'));
  fitAboutLead(document.querySelector('#aboutModal .nr-about-final-lead'));
}

/* Пересчёт при смене ширины окна и повороте экрана: подгонка зависит от
   реальной ширины абзаца. Считаем один раз за кадр через rAF, чтобы перетаскивание
   границы окна не вызывало замер на каждый пиксель. */
var aboutLeadFitRaf = 0;
function queueAboutLeadsFit() {
  if (aboutLeadFitRaf) return;
  aboutLeadFitRaf = requestAnimationFrame(function () {
    aboutLeadFitRaf = 0;
    fitAboutLeads();
  });
}
window.addEventListener('resize', queueAboutLeadsFit, { passive: true });
window.addEventListener('orientationchange', queueAboutLeadsFit, { passive: true });

/* Кириллица подключается с font-display: swap — пока woff2 не пришёл, буквы
   рисует фолбэк с другими метриками, и замер, сделанный в этот момент, дал бы
   неверный кегль. Как только шрифты загружены, пересчитываем (тот же приём уже
   используется ниже для ScrollTrigger и высот карточек отзывов). */
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(queueAboutLeadsFit);
}

function openAboutModal() {
  closeMobileMenu();
  if (isAboutShowcaseViewport()) {
    openAboutShowcase();
    return;
  }
  const modal = document.getElementById('aboutModal');
  if (modal) {
    modal.classList.add('active');
    lockPageScroll();
    // Подгоняем «Проходил обучение…» и «С радостью готов…» под фактическую
    // ширину окна на этом устройстве (поля окна и масштаб шрифта у всех разные).
    fitAboutLeads();
  }
}

function closeAboutModal() {
  closeAboutShowcase();
  const modal = document.getElementById('aboutModal');
  if (modal && modal.classList.contains('active')) {
    modal.classList.remove('active');
    unlockPageScroll();
  }
}

