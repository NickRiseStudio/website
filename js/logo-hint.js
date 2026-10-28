// ═══════════════════════════════════════════════════════════════════════
// NICK RISE STUDIO — JS / ПОДСКАЗКА ПОД ЛОГОТИПОМ
// Источник: script.js, строки 3232–3335 (перенос 1:1, поведение не менялось)
// Читает снаружи: — (самодостаточен)
// Обязан грузиться после: js/state.js
// Владеет: LOGO_HINT_*, logoHint*.
// Публичные точки входа (window): maybeShowLogoHint, showLogoHint,
//          hideLogoHint — стоят в onclick/бутстрапе.
// ═══════════════════════════════════════════════════════════════════════

/* ──────────────────────────────────────────────────────────────────────
   ПОДСКАЗКА ПРО ЛОГОТИП В ШАПКЕ («ОБО МНЕ»)

   Показывается при заходе на сайт под логотипом слева вверху. Формат — тот же
   бабл, что у подсказки плеера (.nr-ab-hint-tip), но БЕЗ затемнения: страница
   не гаснет и прокрутка не блокируется.

   Одинаково на всех устройствах: у бабла есть крестик, и уходит он ТОЛЬКО по
   крестику или по клику на то, что открывает «Обо мне» — логотип в шапке слева
   или фото в hero. Прокрутка и тапы мимо подсказку не гасят; на телефоне она
   при прокрутке гаснет вместе с логотипом (style.css, media max-width 639px).

   Ждём, пока уедет заставка #nr-boot (класс #nr-boot-done): пока она висит,
   страница заморожена и подсказку поверх неё показывать нельзя.
   ────────────────────────────────────────────────────────────────────── */

const LOGO_HINT_GAP_PX = 10;         // зазор от низа шапки до верхней кромки бабла
const LOGO_HINT_TAIL_MARGIN_PX = 28; // хвостик не ближе этого к углу плашки
const LOGO_HINT_WAIT_MS = 200;       // как часто проверяем, что заставка уехала

let logoHintVisible = false;
let logoHintDone = false;
let logoHintWaitTimer = null;
/* Элементы, открывающие окно «Обо мне» (логотип в шапке и фото в hero) —
   клик по любому из них гасит подсказку. */
let logoHintAboutOpeners = [];

/* Бабл ставим левым краем по логотипу и чуть ниже шапки, хвостик указывает вверх
   на логотип. Размеры читаем при скрытом бабле — он поэтому и не убирается через
   display: none (см. style.css). */
function positionLogoHint() {
  const tip = document.getElementById('logoHintTip');
  const btn = document.getElementById('headerLogoBtn');
  const header = document.getElementById('mainHeader');
  if (!tip || !btn || !header) return false;

  const btnRect = btn.getBoundingClientRect();
  const headerRect = header.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();

  const left = Math.max(8, Math.round(btnRect.left));
  const top = Math.round(headerRect.bottom + LOGO_HINT_GAP_PX);
  const tailX = Math.min(
    tipRect.width - LOGO_HINT_TAIL_MARGIN_PX,
    Math.max(LOGO_HINT_TAIL_MARGIN_PX, btnRect.left + btnRect.width / 2 - left)
  );

  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
  tip.style.setProperty('--nr-ab-tail-x', tailX + 'px');
  return true;
}

function showLogoHint() {
  const tip = document.getElementById('logoHintTip');
  if (!tip || logoHintVisible || logoHintDone) return;
  if (!positionLogoHint()) return;

  logoHintDone = true;
  tip.classList.add('show');
  logoHintVisible = true;
  window.addEventListener('resize', positionLogoHint);

  /* Уходит только по крестику или по клику на то, что открывает «Обо мне» —
     логотип в шапке слева и фото в hero (у обоих в разметке
     onclick="openAboutModal()"). Одинаково на всех устройствах: прокрутка и
     тапы мимо подсказку не гасят. */
  logoHintAboutOpeners = Array.prototype.slice.call(
    document.querySelectorAll('[onclick="openAboutModal()"]')
  );
  logoHintAboutOpeners.forEach((el) => el.addEventListener('click', hideLogoHint));
}

function hideLogoHint() {
  if (!logoHintVisible) return;
  logoHintVisible = false;

  window.removeEventListener('resize', positionLogoHint);
  logoHintAboutOpeners.forEach((el) => el.removeEventListener('click', hideLogoHint));
  logoHintAboutOpeners = [];

  const tip = document.getElementById('logoHintTip');
  if (tip) tip.classList.remove('show');
}

/* Ждём готовности страницы: заставка #nr-boot в момент, когда страница стала
   интерактивной, получает класс nr-boot-done (animations.js → initBoot). */
function logoHintBootSettled() {
  const boot = document.getElementById('nr-boot');
  if (boot && !boot.classList.contains('nr-boot-done')) return false;
  return !document.documentElement.classList.contains('nr-boot-active');
}

function maybeShowLogoHint() {
  if (logoHintDone) return;
  if (!logoHintBootSettled()) {
    clearTimeout(logoHintWaitTimer);
    logoHintWaitTimer = setTimeout(maybeShowLogoHint, LOGO_HINT_WAIT_MS);
    return;
  }
  logoHintWaitTimer = null;
  showLogoHint();
}

