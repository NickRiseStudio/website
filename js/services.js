// ═══════════════════════════════════════════════════════════════════════
// NICK RISE STUDIO — JS / УСЛУГИ: РЕНДЕР, ПЕРЕВОРОТ КАРТОЧКИ, КАРУСЕЛЬ
// Источник: script.js, строки 4982–5665 (перенос 1:1, поведение не менялось)
// Читает снаружи: currentLang, CONFIG
// Обязан грузиться после: js/state.js
// Публичные точки входа (window): initServices, renderServices,
//          flipServiceCard, syncServicesNav, nextService, prevService.
// animations.js вешает hook на renderServices.
// ═══════════════════════════════════════════════════════════════════════

// --- SERVICES SECTION ---
// Переворот карточки услуги: клик по карточке показывает обратную сторону
// («что это такое» + «что входит»), повторный клик / кнопка «Назад» возвращает.
// Крутится внутренний слой .service-card-inner — саму оболочку нельзя: её
// transform'ом управляют coverflow карусели (телефон) и GSAP-появление карточек.
function toggleServiceCardFlip(card) {
  if (!card) return;
  card.classList.toggle('is-flipped');
}

function initServices() {
  renderServices();
  initServicesNav();
}

/* ── Стрелки карусели услуг (телефон) ─────────────────────────────────────
   Листают карусель на одну карточку — тем же плавным переходом, что и тап по
   соседней карточке или свайп (scrollToServiceCard). Листание линейное: у
   крайних карточек соответствующая стрелка погашена (syncServicesNav), и
   нажатие по ней ничего не делает — это защита от случайных кликов.

   Активный индекс ведёт servicesActiveIndex — его обновляет сама карусель
   (scrollToServiceCard и updateServicesDots по событию scroll), поэтому частые
   тапы листают дальше, а не топчутся на месте.

   Тап разбирает bindTapControl — тот же помощник, что у стрелок треков: он
   срабатывает и тогда, когда браузер «съел» первый тап на остановку инерции. */
function initServicesNav() {
  const prevBtn = document.getElementById('servicesNavPrevBtn');
  const nextBtn = document.getElementById('servicesNavNextBtn');

  const step = (direction) => {
    const container = document.getElementById('servicesContainer');
    if (!container) return;
    const total = container.children.length;
    if (!total) return;

    const next = servicesActiveIndex + direction;
    // Крайняя карточка: дальше листать некуда. Стрелка там уже погашена, но
    // проверка нужна и сама по себе — нажатие не должно двигать карусель.
    if (next < 0 || next >= total) return;

    scrollToServiceCard(next);
  };

  bindTapControl(prevBtn, () => step(-1));
  bindTapControl(nextBtn, () => step(1));

  syncServicesNav();
}

/* Гасит стрелку, за которой карточек больше нет. Класс .is-hidden плавно
   уводит её в opacity: 0 (animations.css), поэтому при листании к крайней
   карточке стрелка исчезает ровно за время прокрутки — к остановке её уже нет.

   Состояние считается по servicesActiveIndex: scrollToServiceCard выставляет
   его сразу, до начала плавной прокрутки, — значит гашение начинается в момент
   нажатия. При свайпе индекс обновляет updateServicesDots по факту. */
function syncServicesNav() {
  const prevBtn = document.getElementById('servicesNavPrevBtn');
  const nextBtn = document.getElementById('servicesNavNextBtn');
  if (!prevBtn || !nextBtn) return;

  const container = document.getElementById('servicesContainer');
  const total = container ? container.children.length : 0;
  if (!total) return;

  prevBtn.classList.toggle('is-hidden', servicesActiveIndex <= 0);
  nextBtn.classList.toggle('is-hidden', servicesActiveIndex >= total - 1);
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

      // Пункты list есть и на передней, и на обратной стороне — обновляем каждую
      // грань отдельно, чтобы индексы не «перепрыгивали» через обе стороны.
      const frontFeatEls = card.querySelectorAll('.service-card-face--front .service-feature-text');
      frontFeatEls.forEach((el, fIdx) => {
        if (features[fIdx] !== undefined) el.textContent = features[fIdx];
      });
      const backFeatEls = card.querySelectorAll('.service-card-face--back .service-feature-text');
      backFeatEls.forEach((el, fIdx) => {
        if (features[fIdx] !== undefined) el.textContent = features[fIdx];
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

      // Тексты обратной стороны: «что это такое» + «что входит» + кнопка «Назад».
      const aboutRaw = currentLang === 'ru' ? s.aboutRu : s.aboutEn;
      const aboutEl = card.querySelector('.service-card-about');
      if (aboutEl) aboutEl.textContent = resolveDeviceText(aboutRaw, currentDevice);

      const backTitleEl = card.querySelector('.service-card-back-title');
      if (backTitleEl) backTitleEl.textContent = resolveDeviceText(t.services.backTitle, currentDevice);

      const includesTitleEl = card.querySelector('.service-card-includes-title');
      if (includesTitleEl) includesTitleEl.textContent = resolveDeviceText(t.services.includesTitle, currentDevice);

      const backBtnSpan = card.querySelector('.service-card-back-btn span');
      if (backBtnSpan) backBtnSpan.textContent = resolveDeviceText(t.services.backBtn, currentDevice);
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

    // Клик по карточке услуги (кроме кнопок внутри). На телефоне (карусель)
    // переворот срабатывает только у активной (центральной) карточки, а тап по
    // соседней сначала листает карусель до неё — она встаёт в центр. На планшете/ПК
    // карточки видны все сразу (сетка), поэтому там клик по любой переворачивает её.
    card.addEventListener('click', (e) => {
      // Кнопка «Назад» на обороте возвращает карточку. Проверять её нужно ДО
      // общей глушилки кнопок ниже — иначе клик по ней молча гасился и кнопка
      // выглядела нерабочей. Своё нажатие кнопка показывает сама (active:scale-95).
      if (e.target.closest('.service-card-back-btn')) {
        toggleServiceCardFlip(card);
        return;
      }
      if (e.target.closest('button')) return;
      if (window.innerWidth < 640 && idx !== servicesActiveIndex) {
        scrollToServiceCard(idx);
        return;
      }
      toggleServiceCardFlip(card);
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

    // Обратная сторона карточки: «что это такое» + «что входит».
    const aboutRaw = currentLang === 'ru' ? s.aboutRu : s.aboutEn;
    const about = resolveDeviceText(aboutRaw, currentDevice);
    const backTitleText = resolveDeviceText(t.services.backTitle, currentDevice);
    const includesTitleText = resolveDeviceText(t.services.includesTitle, currentDevice);
    const backBtnText = resolveDeviceText(t.services.backBtn, currentDevice);
    const backFeaturesHtml = features.map(f => `
      <li class="service-feature-item flex items-start gap-3 text-sm text-gray-300">
        <svg class="service-check-icon w-4 h-4 text-emerald-400 flex-shrink-0 mt-1 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span class="service-feature-text leading-relaxed">${f}</span>
      </li>
    `).join('');

    card.innerHTML = `
      ${s.isPopular ? `<div class="service-card-popular absolute -top-3.5 inset-x-0 flex justify-center pointer-events-none z-10"><span class="popular-badge uppercase tracking-wider pointer-events-auto">${popularBadgeText}</span></div>` : ''}

      <div class="service-card-inner">
        <div class="service-card-face service-card-face--front">
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
        </div>

        <div class="service-card-face service-card-face--back">
          <div class="service-card-back-top flex flex-col">
            <div class="service-card-meta flex justify-between items-center mb-4 opacity-40">
              <div class="rack-bolt"></div>
              <div class="text-[10px] font-mono text-gray-400 tracking-widest uppercase">
                ${rackUnitText}
              </div>
              <div class="rack-bolt"></div>
            </div>

            <h3 class="service-card-back-title text-base sm:text-lg font-black text-amber-400 tracking-tight text-center uppercase mb-2">${backTitleText}</h3>
            <p class="service-card-about text-sm text-gray-300 leading-relaxed mb-4">${about}</p>

            <h4 class="service-card-includes-title text-xs font-mono text-amber-400/90 tracking-widest uppercase mb-2">${includesTitleText}</h4>
            <ul class="service-card-back-features space-y-2 mb-3">
              ${backFeaturesHtml}
            </ul>
          </div>

          <div class="service-card-bottom">
            <div class="service-card-divider h-px bg-gray-800/80 my-3 sm:my-5"></div>
            <button
              class="service-card-back-btn w-full py-2.5 px-5 bg-transparent hover:bg-white/5 text-gray-200 font-bold rounded-xl border border-gray-700 hover:border-amber-500/60 transition-all duration-200 active:scale-95 text-sm cursor-pointer"
            >
              <span>${backBtnText}</span>
            </button>
          </div>
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
let servicesActiveIndex = SERVICES_START_INDEX; // индекс центральной (активной) карточки карусели
let servicesProgrammaticScroll = false;         // идёт наша плавная прокрутка к карточке

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
      // после этого стартовое положение уже не навязываем. Во время нашей
      // плавной прокрутки (servicesProgrammaticScroll) вывод не делаем: scrollLeft
      // на этих кадрах промежуточный.
      if (container && !servicesProgrammaticScroll && servicesAppliedScrollLeft !== null &&
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

  // Активная карточка известна уже сейчас — не ждём события scroll: иначе при
  // тапе по соседней карточке «активной» ещё секунду числилась бы старая, и
  // повторный тап по новой центральной карточке снова листал бы карусель
  // вместо открытия калькулятора.
  servicesActiveIndex = index;
  // Стрелки гасим сразу по цели, а не по факту прокрутки: так стрелка крайней
  // стороны начинает плавно исчезать в момент нажатия и успевает погаснуть к
  // остановке карусели.
  syncServicesNav();

  if (behavior === 'instant') {
    servicesProgrammaticScroll = false;
    container.scrollTo({ left: targetScrollLeft, behavior: 'auto' });
    servicesAppliedScrollLeft = targetScrollLeft;
    updateServicesDots(false);
    return;
  }

  // Плавный скролл: позицию «своей» прокрутки записываем только когда анимация
  // закончилась. Иначе onServicesScroll на промежуточных кадрах видел бы
  // расхождение с целью и ошибочно помечал прокрутку как пользовательскую.
  //
  // ВАЖНО: на телефоне у контейнера scroll-snap-type: x mandatory, а у карточек
  // scroll-snap-stop: always. С такими настройками браузер обязан тормозить на
  // каждой снап-точке, поэтому плавный scrollTo через несколько карточек
  // откатывался назад (замер: тап по 3-й карточке возвращал карусель к 1-й).
  // На время программной прокрутки снап отключаем и возвращаем в конце.
  const snapType = container.style.scrollSnapType;
  const hadInlineSnap = container.style.scrollSnapType !== '';
  container.style.scrollSnapType = 'none';

  servicesAppliedScrollLeft = null;
  servicesProgrammaticScroll = true;
  let settled = false;
  const onSettled = (e) => {
    if (e && e.target !== container) return;
    if (settled) return;
    settled = true;
    container.removeEventListener('scroll', onSettled);
    container.style.scrollSnapType = hadInlineSnap ? snapType : '';
    servicesProgrammaticScroll = false;
    servicesAppliedScrollLeft = container.scrollLeft;
    updateServicesDots(false);
  };
  container.addEventListener('scroll', onSettled, { passive: true });
  container.scrollTo({
    left: targetScrollLeft,
    behavior: 'smooth'
  });
  // Страховка, если события scroll не будет (цель уже достигнута).
  setTimeout(onSettled, 600);
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

  // Активная (центральная) карточка — используется обработчиком клика, чтобы
  // калькулятор открывался только по ней, а тап по соседним листал карусель.
  // Пока идёт наша плавная прокрутка, индекс не трогаем: scrollLeft на этих
  // кадрах промежуточный, и «активной» на миг становилась бы не та карточка.
  if (!servicesProgrammaticScroll) servicesActiveIndex = activeIndex;

  // Режим перехода меняется редко (ресайз или ручная прокрутка), поэтому строку
  // transition пишем только когда она реально другая, а не на каждом кадре.
  const transitionValue = withTransition
    ? 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease, z-index 0.4s step-start'
    : 'none';
  const transitionChanged = transitionValue !== servicesCoverflowTransition;
  servicesCoverflowTransition = transitionValue;

  // ГОРИЗОНТАЛЬНОГО СДВИГА КАРТОЧЕК НЕТ НИ НА ОДНОМ УСТРОЙСТВЕ (правка 26.10).
  // Раньше соседние карточки подтягивались к центру на ±28px (shiftX). На
  // Android (Blink) это работало, а на iPhone (WebKit) ломало снап: WebKit
  // считает снап-точку по ТРАНСФОРМИРОВАННОМУ боксу карточки, поэтому её центр
  // уезжал вместе со сдвигом, и после свайпа карточка вставала не по центру
  // экрана (зеркально в сторону, откуда свайпали). Сдвиг убран везде — так
  // поведение и вид одинаковые на iOS и Android. Масштаб (0.90) и наклон
  // rotateY оставлены: центр карточки они не двигают, coverflow сохраняется.

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
    const shiftX = 0; // горизонтального сдвига нет — см. пояснение выше
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

  // Стрелки карусели: состояние по фактической центральной карточке — так они
  // гаснут и при свайпе пальцем, и после ресайза.
  syncServicesNav();
}

