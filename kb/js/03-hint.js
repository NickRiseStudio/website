// ═══════════════════════════════════════════════════════════════════════
// kb/js/03-hint.js — ПОДСКАЗКА ПОД ЛОГОТИПОМ
// Грузится: kb/index.html — в конце body, defer. После kb/js/01-lang.js
//         (язык на кнопках уже стоит) и kb/js/02-dust.js.
// Читает: #kbLogoLink, #kbHeader, #kbHint, #kbHintClose, #kb-boot.
// Публичные (window): нет — модуль самодостаточный.
// Блоки файла:
//   • positionHint — бабл под логотипом, хвостик смотрит вверх на логотип.
//   • showHint / hideHint — показ при заходе, уход по крестику.
//   • Ожидание заставки — бабл появляется после события kb:boot-done.
// ═══════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  var HINT_GAP_PX = 10;          /* зазор от низа шапки до верхней кромки бабла */
  var HINT_TAIL_MARGIN_PX = 28;  /* хвостик не ближе этого к углу плашки */
  var HINT_SHOW_DELAY_MS = 350;  /* пауза после разбора страницы: без неё бабл
                                    «выскакивает» одновременно с первым кадром */

  var hint = document.getElementById('kbHint');
  var closeBtn = document.getElementById('kbHintClose');
  var logo = document.getElementById('kbLogoLink');
  var header = document.getElementById('kbHeader');
  if (!hint || !logo || !header) return;

  var visible = false;

  /* Бабл ставим левым краем по логотипу и чуть ниже шапки, хвостик — на
     середину логотипа. Размеры читаем у скрытого бабла: он поэтому и не
     убирается через display: none (kb/css/style/03-hint.css). */
  function positionHint() {
    var logoRect = logo.getBoundingClientRect();
    var headerRect = header.getBoundingClientRect();
    var hintRect = hint.getBoundingClientRect();

    var left = Math.max(8, Math.round(logoRect.left));
    /* У правого края экрана бабл не должен вылезать за вьюпорт: на телефоне
       логотип стоит близко к краю, а бабл шире него. */
    var maxLeft = Math.round(window.innerWidth - hintRect.width - 8);
    if (left > maxLeft) left = Math.max(8, maxLeft);

    var tailX = Math.min(
      hintRect.width - HINT_TAIL_MARGIN_PX,
      Math.max(HINT_TAIL_MARGIN_PX, logoRect.left + logoRect.width / 2 - left)
    );

    hint.style.left = left + 'px';
    hint.style.top = Math.round(headerRect.bottom + HINT_GAP_PX) + 'px';
    hint.style.setProperty('--kb-hint-tail-x', tailX + 'px');
  }

  function showHint() {
    if (visible) return;
    positionHint();
    hint.classList.add('show');
    visible = true;
    window.addEventListener('resize', positionHint);
  }

  function hideHint() {
    if (!visible) return;
    visible = false;
    hint.classList.remove('show');
    window.removeEventListener('resize', positionHint);
  }

  if (closeBtn) closeBtn.addEventListener('click', hideHint);

  /* Пока видна заставка #kb-boot, баблу не место: показываем его после
     гашения — kb/animations.js сообщает об этом событием kb:boot-done.
     Обработчик ставится раньше, чем заставка успеет уйти: этот файл
     грузится до kb/animations.js. Статьи открываются внутри этого же
     документа, страница не перезагружается — подсказка одна на заход. */
  var boot = document.getElementById('kb-boot');
  if (boot && !boot.classList.contains('kb-boot-done')) {
    document.addEventListener('kb:boot-done', function () {
      setTimeout(showHint, HINT_SHOW_DELAY_MS);
    }, { once: true });
  } else {
    setTimeout(showHint, HINT_SHOW_DELAY_MS);
  }
})();
