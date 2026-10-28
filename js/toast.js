// ═══════════════════════════════════════════════════════════════════════
// NICK RISE STUDIO — JS / ТОСТ И КОПИРОВАНИЕ В БУФЕР
// Источник: script.js, строки 8526–8613 (перенос 1:1, поведение не менялось)
// Читает снаружи: currentLang, CONFIG, PROMO_CODE (about.js)
// Обязан грузиться после: about.js
// Публичные точки входа (window): showToast, writeToClipboard, copyText,
//          copyPromoCode. animations.js вешает hook на showToast —
//          поэтому файл обязан грузиться ДО animations.js.
// ═══════════════════════════════════════════════════════════════════════

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

function getLocalizedCopyToast(text, fallbackMsg) {
  const t = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.i18n) ? CONFIG.i18n[currentLang] : null;
  const contacts = t && t.contacts ? t.contacts : null;
  if (!contacts) return fallbackMsg;

  const value = String(text || '');
  const atIdx = value.indexOf('@');
  const isEmail = atIdx > 0 && value.indexOf('.') > atIdx;
  const key = isEmail ? 'toastEmailCopied' : 'toastTgCopied';
  const resolved = resolveDeviceText(contacts[key], getDeviceType());

  return (typeof resolved === 'string' && resolved) ? resolved : fallbackMsg;
}

// Копирование в буфер обмена: основной путь — navigator.clipboard, запасной —
// скрытая textarea (старый браузер или небезопасный контекст). Вызывающему
// отдаётся только сигнал «готово»: показать тост или подсветить кнопку решает он.
function writeToClipboard(text, onSuccess) {
  const done = typeof onSuccess === 'function' ? onSuccess : function () {};

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
      done();
    } catch (err) {
      done();
    }
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(fallbackCopy);
  } else {
    fallbackCopy();
  }
}

function copyText(text, toastMsg) {
  const resolvedToastMsg = getLocalizedCopyToast(text, toastMsg);
  writeToClipboard(text, () => showToast(resolvedToastMsg));
}

// Промокод со скидкой копируется одинаково из двух мест: строка на финальном
// кадре «Обо мне» и промо-блок в ответах FAQ. Одно значение (PROMO_CODE), один
// тост (aboutModal.toastDiscountCopied) и одна короткая подсветка кнопки.
function copyPromoCode(el) {
  const t = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.i18n) ? CONFIG.i18n[currentLang] : null;
  const about = (t && t.aboutModal) ? t.aboutModal : null;
  const msg = (about && about.toastDiscountCopied) || 'Промокод скопирован!';
  const prefix = (about && about.promoCodePrefix) || 'Промокод: ';

  writeToClipboard(prefix + PROMO_CODE, function () {
    showToast(msg);
    if (!el || !el.classList) return;
    el.classList.add('is-copied');
    setTimeout(function () { el.classList.remove('is-copied'); }, 1500);
  });
}

