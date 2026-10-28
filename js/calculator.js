// ═══════════════════════════════════════════════════════════════════════
// js/calculator.js — КАЛЬКУЛЯТОР СТОИМОСТИ
// Грузится после: js/state.js. Читает: currentLang, CONFIG, calcAnswers.
// Владеет: CALC_LAST_STEP, CALC_SHOWCASE_MQ и состояние шагов со сметой (calc*).
// Публичные (window): openPriceCalc, openPriceCalcModal, closePriceCalcModal,
//         openPriceCalcShowcase, closePriceCalcShowcase, nextCalcStep, prevCalcStep,
//         resetPriceCalc, setCalcAnswer, setCalcFormAnswer, changeCalcPerformers,
//         onCalcDurationInput, onCalcFormDurationInput, sendCalcOrderToTelegram,
//         copyCalcOrder,
//         initCalcHints, initPriceCalcForm, showCalcHint, hideCalcHint,
//         toggleCalcHint — все стоят в инлайн-onclick разметки.
// Блоки файла:
//   • openPriceCalc — выбор вида: компьютер → #priceCalcShowcase, иначе окно.
//   • Окно #priceCalcModal: шаги 0 — предупреждение, 1 — длительность,
//     2..5 — вопросы Да/Нет, 6 — итог.
//   • Форма на компьютере #priceCalcShowcase: анкета слева, смета справа,
//     текст заявки для Telegram.
//   • Смета и цена: пересчёт на каждом шаге, промо-скидка.
//   • Подсказки «i» у вопросов: initCalcHints, showCalcHint, hideCalcHint, toggleCalcHint.
//   • Разметка — index.html → #priceCalcModal и #priceCalcShowcase.
// ═══════════════════════════════════════════════════════════════════════

// --- SERVICE COST CALCULATOR (окно «Рассчитать стоимость услуг») ---
// Шаги: 0 — предупреждение, 1 — длительность, 2..5 — вопросы Да/Нет, 6 — итог.
const CALC_LAST_STEP = 6;
const CALC_TOTAL_STEPS = CALC_LAST_STEP + 1;
let calcStep = 0;
// rush — срочность: спрашивается только в форме на компьютере (#priceCalcShowcase),
// в шагах мобильного окна её нет, поэтому значение там всегда null.
const calcAnswers = { mastering: null, vocalRhythm: null, trackout: null, vocalNotes: null, rush: null };
// Сколько исполнителей (фит). Вопрос есть только в форме на компьютере
// (#priceCalcShowcase); в шагах мобильного окна его нет, там всегда 1.
let calcPerformers = 1;

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
    // снимаем «замороженную» высоту окна и убираем подсказку у кружка «i».
    if (typeof hideCalcHint === 'function') hideCalcHint();
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
  calcPerformers = (cfg && cfg.performers && cfg.performers.min) || 1;
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
  // Уходящий шаг мог оставить открытую подсказку у кружка «i» — гасим её.
  if (typeof hideCalcHint === 'function') hideCalcHint();
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

// Видимая высота окна в пикселях — JS-эквивалент CSS-единицы dvh, по которой
// теперь ограничены модальные окна (css/style/09-modals.css, блок «ВСПЛЫВАЮЩИЕ ОКНА»).
// window.innerHeight в мобильных браузерах — это «большое» окно БЕЗ нижней
// панели браузера: она рисуется поверх страницы (в Яндекс.Браузере страницу
// не сжимает), поэтому высоту окна-калькулятора упирало в запас за панелью.
// visualViewport.height — то, что видно сейчас.
function visibleViewportHeight() {
  return (window.visualViewport && window.visualViewport.height) || window.innerHeight;
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

    const maxHeight = Math.max(200, Math.round(visibleViewportHeight() * 0.9));
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
  const maxHeight = Math.max(200, Math.round(visibleViewportHeight() * 0.9));
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
  // Шаги 2..5 — вопросы Да/Нет; шаги 0, 1 и итог автопереход не используют.
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
  // Форма на компьютере живёт на тех же ответах — держим её в актуальном виде
  // (смена языка, сброс, переход по шагам).
  renderPriceCalcForm();

  // Открытая подсказка у кружка «i» могла остаться от прежнего языка — перелистываем
  // её текст на текущий язык, сохранив позицию.
  if (typeof calcHintVisibleId !== 'undefined' && calcHintVisibleId) {
    showCalcHint(calcHintVisibleId);
  }

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

  // Заполненная янтарная часть дорожки ползунка (--calc-fill читает css/style)
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

// Итог считается всегда, но показывается только на последнем шаге.
function calculatePriceCalcTotal() {
  const cfg = getCalcConfig();
  const entry = getCalcDurationEntry();
  if (!cfg || !entry) return null;

  const priceKey = currentLang === 'ru' ? 'priceRu' : 'priceEn';

  // Срочность (cfg.rush) отмечается только в форме на компьютере, поэтому здесь
  // она отдельной записью, а не в cfg.options: по options мобильное окно строит
  // шаги 2..5, и лишний пункт сдвинул бы нумерацию. В мобильном окне
  // calcAnswers.rush остаётся null, значит цена там не меняется.
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

// ── РАСЧЁТ СТОИМОСТИ НА КОМПЬЮТЕРЕ (#priceCalcShowcase) ───────────────────
// С 1024px вместо окна открывается раздел-всплывашка: слева анкета, справа
// смета. Ответы те же (calcAnswers), расчёт тот же (calculatePriceCalcTotal),
// поэтому цена в обоих видах совпадает до рубля.
const CALC_SHOWCASE_MQ = '(min-width: 1024px)';
// Чат, в который уходит заявка: тот же ник, что у кнопок в разделе контактов.
const CALC_ORDER_TELEGRAM_URL = 'https://t.me/Nick_Rise';

function isPriceCalcShowcaseViewport() {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia(CALC_SHOWCASE_MQ).matches;
}

function getCalcFormBox() {
  return document.getElementById('priceCalcShowcase');
}

// Единая точка входа для «Заказать» и «Рассчитать стоимость услуг»:
// компьютер — раздел, планшет и телефон — прежнее окно.
function openPriceCalc() {
  if (typeof closeMobileMenu === 'function') closeMobileMenu();
  if (isPriceCalcShowcaseViewport()) openPriceCalcShowcase();
  else openPriceCalcModal();
}

function openPriceCalcShowcase() {
  const box = getCalcFormBox();
  if (!box) return;
  resetPriceCalc();
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

function setCalcFormAnswer(optionId, value) {
  if (!(optionId in calcAnswers)) return;
  calcAnswers[optionId] = value;
  renderPriceCalcForm();
}

// Ползунок анкеты двигает общий хронометраж: значение пишется и в скрытое окно
// (#calcDurationRange), откуда его читает getCalcDurationEntry.
function onCalcFormDurationInput(value) {
  const range = document.getElementById('calcDurationRange');
  if (range) range.value = value;
  renderPriceCalcForm();
}

// Перерисовка анкеты и сметы. Зовётся из renderPriceCalcStep (смена языка,
// сброс, шаги окна), из ответов и из ползунка анкеты.
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

  // Ползунок: значение берём из общего (скрытого) — так сброс окна
  // возвращает и его, и заполненную часть дорожки.
  const range = document.getElementById('calcFormDurationRange');
  if (range) {
    const shared = document.getElementById('calcDurationRange');
    if (shared && range.value !== shared.value) range.value = shared.value;
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
    rows.push(
      `<div class="nr-calcshow-row">` +
        `<span class="nr-calcshow-row-label">${t.durationRow}: ${entry.label} ${t.durationMin}</span>` +
        `<span class="nr-calcshow-row-price">` +
          (entry.individual ? form.individualRow : formatCalcPrice(entry[priceKey], currentLang)) +
        `</span>` +
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
// js/modals.js. Окно сузили ниже 1024px — там своя модалка, раздел закрываем.
function initPriceCalcForm() {
  const box = getCalcFormBox();
  if (!box) return;

  box.addEventListener('click', (e) => {
    if (e.target === box) closePriceCalcShowcase();
  });

  window.addEventListener('resize', () => {
    if (box.classList.contains('active') && !isPriceCalcShowcaseViewport()) closePriceCalcShowcase();
  });

  renderPriceCalcForm();
}

// ── Подсказки к вопросам калькулятора (кружок «i») ────────────────────────
// Кружок стоит рядом с вопросом; наведение/фокус показывают бабл, уход курсора —
// скрывают. На телефоне наведения нет, поэтому тап по кружку переключает бабл.
// Вид бабла — как у подсказки BEFORE / AFTER (тот же класс .nr-ab-hint-tip),
// позицию и место хвостика считает positionCalcHint.
const CALC_HINT_KEYS = { mastering: 'hintMastering', trackout: 'hintTrackout' };
let calcHintVisibleId = null;
// Момент последнего показа: на телефоне тап по кружку сначала даёт focus (показ),
// а затем click (переключение). Без этой отметки click тут же погасил бы бабл.
let calcHintShownAt = 0;

function getCalcHintDot(id) {
  const selector = `.nr-calc-hint-dot[data-calc-hint="${id}"]`;
  // Кружков с одной подсказкой в разметке два: в окне для телефона
  // (#priceCalcModal) и в анкете на компьютере (#priceCalcShowcase). Ищем в
  // открытом виде и берём видимый: у кружка на неактивном шаге окна
  // (display: none) getBoundingClientRect() = 0, и бабл встал бы в левом
  // верхнем углу экрана.
  const showcase = document.getElementById('priceCalcShowcase');
  const modal = document.getElementById('priceCalcModal');
  const scope = showcase && showcase.classList.contains('active') ? showcase : modal;
  const dots = (scope || document).querySelectorAll(selector);
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

