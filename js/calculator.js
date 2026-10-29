// ═══════════════════════════════════════════════════════════════════════
// js/calculator.js — КАЛЬКУЛЯТОР СТОИМОСТИ
// Грузится после: js/state.js. Читает: currentLang, CONFIG, calcAnswers.
// Владеет: calcAnswers, calcPerformers, CALC_ORDER_TELEGRAM_URL, calcHintVisibleId.
// Публичные (window): openPriceCalc, openPriceCalcForService, openPriceCalcShowcase,
//         closePriceCalcShowcase,
//         showCalcSummaryView, showCalcFormView, resetPriceCalc, setCalcFormAnswer,
//         changeCalcPerformers, onCalcFormDurationInput, sendCalcOrderToTelegram,
//         copyCalcOrder, initCalcHints, initPriceCalcForm, showCalcHint, hideCalcHint,
//         toggleCalcHint — все стоят в инлайн-onclick разметки.
// Блоки файла:
//   • Ответы анкеты и цена: calcAnswers, calculatePriceCalcTotal.
//   • Раздел #priceCalcShowcase: открытие, закрытие и две страницы на планшете
//     и телефоне (анкета → итог), перерисовка анкеты и сметы.
//   • Текст заявки для Telegram и копирование.
//   • Подсказки у кружков «i»: initCalcHints, showCalcHint, hideCalcHint,
//     toggleCalcHint.
//   • Разметка — index.html → #priceCalcShowcase.
// ═══════════════════════════════════════════════════════════════════════

// --- SERVICE COST CALCULATOR ---
// Ответы анкеты. rush — срочность: это условие работы, а не услуга, поэтому
// в CONFIG.priceCalc она лежит отдельной записью (см. calculatePriceCalcTotal).
const calcAnswers = { mixing: null, mastering: null, vocalRhythm: null, trackout: null, vocalNotes: null, rush: null };
// Сколько исполнителей (фит): число меняют стрелки, цена — CONFIG.priceCalc.performers.
let calcPerformers = 1;

function getCalcConfig() {
  return (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.priceCalc) ? CONFIG.priceCalc : null;
}

function getCalcI18n() {
  const t = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.i18n) ? CONFIG.i18n[currentLang] : null;
  return (t && t.services && t.services.priceCalc) ? t.services.priceCalc : null;
}

// Хронометраж берётся из ползунка анкеты — он один на всех устройствах.
function getCalcDurationEntry() {
  const cfg = getCalcConfig();
  if (!cfg || !Array.isArray(cfg.durations)) return null;
  const range = document.getElementById('calcFormDurationRange');
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

// Сброс анкеты: ответы, число исполнителей и ползунок хронометража. Зовётся при
// открытии раздела — раздел всегда начинается с чистого расчёта.
function resetPriceCalc() {
  Object.keys(calcAnswers).forEach(key => { calcAnswers[key] = null; });
  const cfg = getCalcConfig();
  calcPerformers = (cfg && cfg.performers && cfg.performers.min) || 1;
  const range = document.getElementById('calcFormDurationRange');
  if (range && cfg && cfg.defaultMinutes) range.value = String(cfg.defaultMinutes);
}

// Количество исполнителей: сколько человек, что это стоит и не «индивидуально» ли.
// display — то, что видно в анкете и в смете: «1», «2», «3», «4+».
function getCalcPerformersEntry() {
  const cfg = getCalcConfig();
  const rules = cfg ? cfg.performers : null;
  if (!rules) return null;

  const min = rules.min || 1;
  const max = rules.max || min;
  const count = Math.max(min, Math.min(max, calcPerformers || min));
  const individual = rules.individualFrom ? count >= rules.individualFrom : false;
  const priceKey = currentLang === 'ru' ? 'priceRu' : 'priceEn';

  let price = 0;
  if (!individual) {
    (rules.prices || []).forEach(item => {
      if (item.count === count) price = item[priceKey] || 0;
    });
  }

  return {
    count: count,
    display: individual ? count + '+' : String(count),
    price: price,
    individual: individual
  };
}

// Стрелки в карточке «Сколько исполнителей?»: шаг ±1 в пределах min..max.
function changeCalcPerformers(delta) {
  const cfg = getCalcConfig();
  const entry = getCalcPerformersEntry();
  if (!cfg || !cfg.performers || !entry) return;

  const min = cfg.performers.min || 1;
  const max = cfg.performers.max || min;
  const next = Math.max(min, Math.min(max, entry.count + delta));
  if (next === entry.count) return;

  calcPerformers = next;
  renderPriceCalcForm();
}

// Итог считается всегда: анкета и смета пересчитываются на каждое изменение.
function calculatePriceCalcTotal() {
  const cfg = getCalcConfig();
  const entry = getCalcDurationEntry();
  if (!cfg || !entry) return null;

  const priceKey = currentLang === 'ru' ? 'priceRu' : 'priceEn';

  // Срочность (cfg.rush) — галочка в анкете. Отдельной записью, а не в
  // cfg.options: по options строится список услуг, и лишний пункт попал бы в
  // него как услуга.
  const rush = cfg.rush && calcAnswers.rush === true ? cfg.rush : null;
  const performers = getCalcPerformersEntry();

  // Состав заявки собирается ВСЕГДА: услуги, срочность и число исполнителей
  // нужны и тогда, когда цена «обговаривается индивидуально», — иначе из
  // текста пропало бы, что именно человек заказывает.
  const chosen = [];
  let total = entry.individual ? 0 : (entry[priceKey] || 0);
  (cfg.options || []).forEach(option => {
    if (calcAnswers[option.id] === true) {
      chosen.push(option);
      total += option[priceKey] || 0;
    }
  });

  if (rush) total += rush[priceKey] || 0;
  if (performers) total += performers.price || 0;

  // «Обговаривается индивидуально» — это про ЦЕНУ: либо хронометраж (1 мин /
  // 6+ мин), либо 4+ исполнителя. Всё остальное в заявке остаётся как есть.
  const individual = !!entry.individual || !!(performers && performers.individual);

  return {
    individual: individual,
    durationEntry: entry,
    options: chosen,
    rush: rush,
    performers: performers,
    total: total
  };
}

// ── РАЗДЕЛ РАСЧЁТА СТОИМОСТИ (#priceCalcShowcase) ─────────────────────────
// Один вид на всех устройствах: анкета и смета. Ответы общие (calcAnswers),
// расчёт один (calculatePriceCalcTotal), поэтому цена везде совпадает.
// Компьютер: анкета слева, смета справа, обе колонки видны сразу.
// Планшет и телефон: две страницы внутри панели — анкета с кнопкой «Далее» и
// итог с кнопкой «Назад». Переключает класс is-summary-view на панели
// (css/style/19-calculator.css, группа 4).
// Чат, в который уходит заявка: тот же ник, что у кнопок в разделе контактов.
const CALC_ORDER_TELEGRAM_URL = 'https://t.me/Nick_Rise';

function getCalcFormBox() {
  return document.getElementById('priceCalcShowcase');
}

function getCalcPanel() {
  const box = getCalcFormBox();
  return box ? box.querySelector('.nr-calcshow-panel') : null;
}

// Единая точка входа для «Заказать» и «Рассчитать стоимость услуг».
// Затемнение расчёта набирает плотность за 0.7 с (css/style/19-calculator.css),
// а шторка бургер-меню уезжает вверх за 1.2 с и на своей кривой открывает
// верхнюю половину экрана уже через ~150 мс. Если закрыть меню сразу, главный
// экран на долю секунды показывается сквозь ещё прозрачное затемнение — это и
// читалось как «позади сверху что-то мелькнуло». Поэтому меню закрываем, когда
// расчёт уже непрозрачен. Прокрутка при этом не разблокируется: её держит
// modal-open (js/modals.js → lockPageScroll), а не nr-menu-open.
const CALC_MENU_CLOSE_MS = 700;

function isMobileMenuOpen() {
  const drawer = document.getElementById('mobileMenuDrawer');
  return !!drawer && drawer.classList.contains('is-open');
}

function openPriceCalc() {
  openPriceCalcShowcase();
  if (typeof closeMobileMenu !== 'function') return;
  // Меню закрыто (обычный клик со страницы) — зовём сразу: на десктопе и при
  // закрытой шторке closeMobileMenu только приводит в порядок иконки.
  if (isMobileMenuOpen()) setTimeout(closeMobileMenu, CALC_MENU_CLOSE_MS);
  else closeMobileMenu();
}

// Кнопка «Заказать» на карточке услуги: id карточек (config.js → servicesData)
// → галочки анкеты (config.js → priceCalc.options). Пакет отмечает обе услуги.
const CALC_SERVICE_PRESETS = {
  'mixing': ['mixing'],
  'mix-master': ['mixing', 'mastering'],
  'mastering': ['mastering']
};

// Открывает расчёт с уже отмеченной услугой — той, на карточке которой нажали
// «Заказать» (js/services.js → renderServices). Зовётся из инлайн-onclick,
// поэтому объявлена как function на верхнем уровне.
function openPriceCalcForService(serviceId) {
  openPriceCalc();
  const preset = CALC_SERVICE_PRESETS[serviceId];
  if (!preset) return;
  preset.forEach(id => { calcAnswers[id] = true; });
  renderPriceCalcForm();
}

function openPriceCalcShowcase() {
  const box = getCalcFormBox();
  if (!box) return;
  resetPriceCalc();
  // Всегда с анкеты: в прошлый раз раздел могли закрыть на итоге.
  showCalcFormView();
  renderPriceCalcForm();
  box.classList.add('active');
  box.setAttribute('aria-hidden', 'false');
  lockPageScroll();
}

function closePriceCalcShowcase() {
  const box = getCalcFormBox();
  if (!box || !box.classList.contains('active')) return;
  box.classList.remove('active');
  box.setAttribute('aria-hidden', 'true');
  if (typeof hideCalcHint === 'function') hideCalcHint();
  unlockPageScroll();
}

// Вторая страница панели (планшет и телефон): итог со сметой. На компьютере
// класс ничего не меняет — там обе колонки видны сразу.
function showCalcSummaryView() {
  const panel = getCalcPanel();
  if (!panel) return;
  renderPriceCalcForm();
  panel.classList.add('is-summary-view');
  const summary = panel.querySelector('.nr-calcshow-summary');
  if (summary) summary.scrollTop = 0;
}

// Возврат к анкете с итога.
function showCalcFormView() {
  const panel = getCalcPanel();
  if (!panel) return;
  panel.classList.remove('is-summary-view');
  const form = panel.querySelector('.nr-calcshow-form');
  if (form) form.scrollTop = 0;
}

function setCalcFormAnswer(optionId, value) {
  if (!(optionId in calcAnswers)) return;
  calcAnswers[optionId] = value;
  renderPriceCalcForm();
}

// Ползунок анкеты: значение читает getCalcDurationEntry, поэтому достаточно
// перерисовать анкету и смету.
function onCalcFormDurationInput(value) {
  const range = document.getElementById('calcFormDurationRange');
  if (range) range.value = value;
  renderPriceCalcForm();
}

// Перерисовка анкеты и сметы. Зовётся при смене языка (js/i18n.js), при
// открытии раздела, из ответов анкеты и из ползунка.
function renderPriceCalcForm() {
  const box = getCalcFormBox();
  const cfg = getCalcConfig();
  const t = getCalcI18n();
  if (!box || !cfg || !t || !t.form) return;

  const form = t.form;
  const result = calculatePriceCalcTotal();
  if (!result) return;

  const entry = result.durationEntry;
  const priceKey = currentLang === 'ru' ? 'priceRu' : 'priceEn';

  // Ползунок: значение живёт в нём самом, здесь только заполненная часть.
  const range = document.getElementById('calcFormDurationRange');
  if (range) {
    const min = parseInt(range.min, 10) || 1;
    const max = parseInt(range.max, 10) || (min + 1);
    const pct = max > min ? ((entry.minutes - min) / (max - min)) * 100 : 100;
    range.style.setProperty('--calc-fill', pct + '%');
  }

  const valueEl = document.getElementById('calcFormDurationValue');
  if (valueEl && valueEl.textContent !== entry.label) valueEl.textContent = entry.label;

  // Шкала собирается один раз на язык и набор делений, дальше только подсветка.
  const scale = document.getElementById('calcFormDurationScale');
  if (scale) {
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

  // Плашка под ползунком — про ЦЕНУ: она нужна и при 1 мин / 6+ мин, и при
  // 4+ исполнителях (result.individual учитывает оба случая).
  const note = document.getElementById('calcFormIndividualNote');
  if (note) note.classList.toggle('hidden', !result.individual);

  // Галочки услуг: нативное состояние input (клавиатура, Space, скринридеры) и
  // подсветка всей строки. Клик по строке-<label> браузер обрабатывает сам.
  box.querySelectorAll('.nr-calcshow-checkbox').forEach(input => {
    const id = input.getAttribute('data-calc-option');
    const checked = calcAnswers[id] === true;
    if (input.checked !== checked) input.checked = checked;
    const row = input.closest('.nr-calcshow-option');
    if (row) row.classList.toggle('is-checked', checked);
  });

  // Счётчик исполнителей: число, а на краях диапазона стрелка гаснет.
  const performers = result.performers;
  if (performers && cfg.performers) {
    const valueEl = document.getElementById('calcFormPerformers');
    if (valueEl && valueEl.textContent !== performers.display) valueEl.textContent = performers.display;

    const minCount = cfg.performers.min || 1;
    const maxCount = cfg.performers.max || minCount;
    const lessBtn = document.getElementById('calcFormPerformersLess');
    const moreBtn = document.getElementById('calcFormPerformersMore');
    if (lessBtn) lessBtn.disabled = performers.count <= minCount;
    if (moreBtn) moreBtn.disabled = performers.count >= maxCount;
  }

  const comment = document.getElementById('calcFormComment');
  if (comment && comment.placeholder !== form.commentPlaceholder) {
    comment.placeholder = form.commentPlaceholder;
  }

  // Смета — только выбранное: хронометраж, услуги, срочность и исполнители.
  const breakdown = document.getElementById('calcFormBreakdown');
  if (breakdown) {
    const rows = [];
    // Длительность: доплата за хронометраж показывается как у услуг — со знаком
    // «+» и янтарным цветом (css/style/19-calculator.css → .nr-calcshow-row-plus).
    // 2–3 мин входят в цену сведения (config.js → priceCalc.durations), поэтому
    // вместо «0 ₽» стоит белый прочерк.
    const durationPlus = !entry.individual && entry[priceKey] > 0;
    const durationPrice = entry.individual
      ? form.individualRow
      : (durationPlus ? '+' + formatCalcPrice(entry[priceKey], currentLang) : form.freeRow);
    rows.push(
      `<div class="nr-calcshow-row">` +
        `<span class="nr-calcshow-row-label">${t.durationRow}: ${entry.label} ${t.durationMin}</span>` +
        `<span class="nr-calcshow-row-price${durationPlus ? ' nr-calcshow-row-plus' : ''}">${durationPrice}</span>` +
      `</div>`
    );

    result.options.forEach(option => {
      // 'mastering' → 'optMastering' и т.д.
      const labelKey = 'opt' + option.id.charAt(0).toUpperCase() + option.id.slice(1);
      rows.push(
        `<div class="nr-calcshow-row">` +
          `<span class="nr-calcshow-row-label">${t[labelKey] || option.id}</span>` +
          `<span class="nr-calcshow-row-price nr-calcshow-row-plus">+${formatCalcPrice(option[priceKey], currentLang)}</span>` +
        `</div>`
      );
    });

    // Исполнители — строкой, только если их больше одного. При 4+ цена
    // обговаривается индивидуально, поэтому вместо суммы стоит та же плашка.
    // Порядок строк повторяет порядок карточек в анкете: услуги → исполнители
    // → срочность.
    const performersRow = !!(performers && performers.count > ((cfg.performers && cfg.performers.min) || 1));
    if (performersRow) {
      rows.push(
        `<div class="nr-calcshow-row">` +
          `<span class="nr-calcshow-row-label">${t.optPerformers}: ${performers.display}</span>` +
          `<span class="nr-calcshow-row-price${performers.individual ? '' : ' nr-calcshow-row-plus'}">` +
            (performers.individual ? form.individualRow : '+' + formatCalcPrice(performers.price, currentLang)) +
          `</span>` +
        `</div>`
      );
    }

    // Срочность — отдельной строкой сметы: в сумму входит, а в списке услуг
    // её нет (в заявке она идёт первой строкой).
    if (result.rush) {
      rows.push(
        `<div class="nr-calcshow-row">` +
          `<span class="nr-calcshow-row-label">${t.optRush}</span>` +
          `<span class="nr-calcshow-row-price nr-calcshow-row-plus">+${formatCalcPrice(result.rush[priceKey], currentLang)}</span>` +
        `</div>`
      );
    }

    if (!result.options.length && !result.rush && !performersRow) {
      rows.push(`<div class="nr-calcshow-empty">${form.emptyRow}</div>`);
    }

    breakdown.innerHTML = rows.join('');
  }

  const totalEl = document.getElementById('calcFormTotal');
  if (totalEl) {
    totalEl.textContent = result.individual
      ? form.individualRow
      : formatCalcPrice(result.total, currentLang);
  }
}

// Текст заявки: человек отправляет его сам, поэтому в нём всё, что он выбрал.
// Порядок строк: срочность (если отмечена) → приветствие → услуги → хронометраж
// → количество исполнителей (если больше одного) → ориентировочная стоимость →
// комментарий (если заполнен). «Обговаривается индивидуально» заменяет ТОЛЬКО
// сумму: состав заявки всегда полный.
function buildCalcOrderText() {
  const cfg = getCalcConfig();
  const t = getCalcI18n();
  const result = calculatePriceCalcTotal();
  if (!cfg || !t || !t.form || !result) return '';

  const form = t.form;
  const lines = [];

  // Срочность — отдельной строкой в самом верху: её видно раньше всего остального.
  if (result.rush) lines.push(form.msgRush, '');

  lines.push(form.msgHello, '');

  // Список услуг. Срочность сюда НЕ попадает — она уже первой строкой, но в
  // стоимость входит (её считает calculatePriceCalcTotal).
  const services = result.options.map(option => {
    const labelKey = 'opt' + option.id.charAt(0).toUpperCase() + option.id.slice(1);
    return t[labelKey] || option.id;
  });
  if (services.length) lines.push(`${form.msgNeed}: ${services.join(', ')}`);

  lines.push(`${form.msgDuration}: ${result.durationEntry.label} ${t.durationMin}`);

  // Сколько исполнителей — строкой, только если их больше одного.
  const performers = result.performers;
  const performersMin = (cfg.performers && cfg.performers.min) || 1;
  if (performers && performers.count > performersMin) {
    lines.push(`${form.msgPerformers}: ${performers.display}`);
  }

  // Стоимость: если она «индивидуальная», так и пишем — остальной текст заявки
  // при этом остаётся полным.
  lines.push(
    `${form.msgTotal}: ` +
    (result.individual ? form.msgIndividual : formatCalcPrice(result.total, currentLang))
  );

  const commentEl = document.getElementById('calcFormComment');
  const comment = commentEl ? commentEl.value.trim() : '';
  if (comment) lines.push(`${form.msgComment}: ${comment}`);

  return lines.join('\n');
}

// Ссылка t.me с черновиком сообщения: в приложениях Telegram и в Web-версии
// открывается чат с уже набранным текстом. Если клиент черновик не подставил,
// рядом стоит «Скопировать заявку».
function sendCalcOrderToTelegram() {
  const text = buildCalcOrderText();
  if (!text) return;
  window.open(CALC_ORDER_TELEGRAM_URL + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
}

function copyCalcOrder() {
  const text = buildCalcOrderText();
  const t = getCalcI18n();
  if (!text || !t || !t.form) return;
  writeToClipboard(text, () => showToast(t.form.toastCopied));
}

// Закрытие раздела: клик мимо панели и крестик (onclick в разметке), Esc —
// js/modals.js. Раздел один на всех устройствах, поэтому при сужении окна его
// закрывать не нужно: панель сама перестраивается из двух колонок в две
// страницы (css/style/19-calculator.css).
function initPriceCalcForm() {
  const box = getCalcFormBox();
  if (!box) return;

  box.addEventListener('click', (e) => {
    if (e.target === box) closePriceCalcShowcase();
  });

  renderPriceCalcForm();
}

// ── Подсказки к услугам (кружок «i») ──────────────────────────────────────
// Кружок стоит рядом с названием услуги в анкете; наведение/фокус показывают
// бабл, уход курсора — скрывают. На телефоне наведения нет, поэтому тап по
// кружку переключает бабл. Вид бабла — как у подсказки BEFORE / AFTER (тот же
// класс .nr-ab-hint-tip), позицию и место хвостика считает positionCalcHint.
const CALC_HINT_KEYS = { mixing: 'hintMixing', mastering: 'hintMastering', trackout: 'hintTrackout' };
let calcHintVisibleId = null;
// Момент последнего показа: на телефоне тап по кружку сначала даёт focus (показ),
// а затем click (переключение). Без этой отметки click тут же погасил бы бабл.
let calcHintShownAt = 0;

function getCalcHintDot(id) {
  const selector = `.nr-calc-hint-dot[data-calc-hint="${id}"]`;
  // Кружок живёт в анкете (#priceCalcShowcase). Берём видимый: у скрытого
  // (display: none) getBoundingClientRect() = 0, и бабл встал бы в левом
  // верхнем углу экрана.
  const box = getCalcFormBox();
  const dots = (box || document).querySelectorAll(selector);
  for (let i = 0; i < dots.length; i++) {
    if (dots[i].getBoundingClientRect().width > 0) return dots[i];
  }
  return dots[0] || null;
}

// Ключи подсказок лежат в services.priceCalc (i18n.ru / i18n.en).
function getCalcHintText(id) {
  const key = CALC_HINT_KEYS[id];
  if (!key) return '';
  return getI18nValue(currentLang, 'services.priceCalc.' + key, getDeviceType());
}

function positionCalcHint(tip, dot) {
  const rect = dot.getBoundingClientRect();
  const margin = 12;
  // Бабл ставим над кружком, по центру; подсказки к вопросам внизу страницы —
  // поэтому если сверху мало места, показываем под кружком.
  const tipRect = tip.getBoundingClientRect();
  const tipHeight = tipRect.height || 0;
  let top = rect.top - tipHeight - margin;
  let placeBelow = false;
  if (top < margin) {
    top = rect.bottom + margin;
    placeBelow = true;
  }
  const half = tipRect.width / 2 || 0;
  let left = rect.left + rect.width / 2;
  left = Math.max(margin + half, Math.min(left, window.innerWidth - margin - half));

  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
  tip.classList.toggle('nr-calc-hint-tip--below', placeBelow);
  // Хвостик держим точно под/над кружком, даже когда бабл прижат к краю экрана.
  const tailX = rect.left + rect.width / 2 - (left - half);
  tip.style.setProperty('--nr-ab-tail-x', Math.round(tailX) + 'px');
}

function showCalcHint(id) {
  const text = getCalcHintText(id);
  const dot = getCalcHintDot(id);
  const tip = document.getElementById('calcHintTip');
  const tipText = document.getElementById('calcHintTipText');
  if (!text || !dot || !tip || !tipText) return;

  calcHintVisibleId = id;
  tipText.innerHTML = text;
  // Сначала отдаём баблу размеры, потом считаем позицию (иначе ширина/высота = 0).
  tip.classList.add('show');
  tip.setAttribute('aria-hidden', 'false');
  positionCalcHint(tip, dot);
  calcHintShownAt = Date.now();
}

function hideCalcHint(id) {
  // Кружок может быть неактивной «половиной» пары hover/focus/blur — сверяемся
  // с тем, что реально показано, чтобы не погасить бабл по лишнему событию.
  if (id && calcHintVisibleId !== id) return;
  const tip = document.getElementById('calcHintTip');
  if (!tip || !calcHintVisibleId) return;
  calcHintVisibleId = null;
  tip.classList.remove('show');
  tip.setAttribute('aria-hidden', 'true');
}

// Тап/клик по кружку: на телефоне наведения нет, поэтому тап переключает бабл.
// На устройствах с мышью (hover) показ/скрытие и так делает наведение — клик
// оставляем «пустым», чтобы бабл не мигал под курсором.
function toggleCalcHint(id) {
  const canHover = typeof window.matchMedia === 'function' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (canHover) return;
  // Тот же тап уже показал бабл через focus — не закрываем его этим же нажатием.
  if (calcHintVisibleId === id && Date.now() - calcHintShownAt < 500) return;
  if (calcHintVisibleId === id) {
    hideCalcHint(id);
    // Снимаем фокус, иначе кружок на телефоне остаётся в «нажатом» виде (:focus).
    const dot = getCalcHintDot(id);
    if (dot && typeof dot.blur === 'function') dot.blur();
  } else {
    showCalcHint(id);
  }
}

// Глобальные правила для подсказок: тап мимо кружка закрывает бабл, а при
// прокрутке/повороте экрана уже открытый бабл прилипает к своему кружку.
function initCalcHints() {
  document.addEventListener('click', e => {
    // Тап мимо кружка и бабла: на телефоне снимаем фокус с кружка, иначе он
    // остаётся «залипшим» в нажатом виде до следующего касания.
    if (!e.target.closest('.nr-calc-hint-dot') && !e.target.closest('#calcHintTip')) {
      const dots = document.querySelectorAll('.nr-calc-hint-dot');
      dots.forEach(d => {
        if (d === document.activeElement && typeof d.blur === 'function') d.blur();
      });
    }
    if (!calcHintVisibleId) return;
    if (e.target.closest('.nr-calc-hint-dot')) return;
    if (e.target.closest('#calcHintTip')) return;
    hideCalcHint();
  }, true);

  /* Подсказка калькулятора прилипает к своему кружку при прокрутке/повороте.
     Раньше на КАЖДОЕ событие scroll (да ещё и с capture:true) вызывался
     positionCalcHint, а он читает getBoundingClientRect — это переклейка
     раскладки на каждое событие. Теперь считаем положение один раз за кадр:
     события лишь поднимают флаг, а фактический пересчёт делает rAF. Пока
     подсказка не показана, колбэк выходит сразу (calcHintVisibleId пуст), так
     что в обычной прокрутке лишней работы нет вообще. */
  let calcHintRepositionQueued = false;
  const queueReposition = () => {
    if (!calcHintVisibleId || calcHintRepositionQueued) return;
    calcHintRepositionQueued = true;
    requestAnimationFrame(() => {
      calcHintRepositionQueued = false;
      if (!calcHintVisibleId) return;
      const tip = document.getElementById('calcHintTip');
      const dot = getCalcHintDot(calcHintVisibleId);
      if (tip && dot) positionCalcHint(tip, dot);
    });
  };
  window.addEventListener('resize', queueReposition, { passive: true });
  window.addEventListener('scroll', queueReposition, { passive: true, capture: true });
}







