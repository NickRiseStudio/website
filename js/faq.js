// ═══════════════════════════════════════════════════════════════════════
// js/faq.js — FAQ: РЕНДЕР И РАСКРЫТИЕ ВОПРОСОВ
// Грузится после: js/state.js. Читает: currentLang, CONFIG.
// Владеет: —
// Публичные (window): initFaq, renderFaq, toggleFaq, openFaqItem, closeFaqItem.
// Блоки файла:
//   • renderFaq — список вопросов из CONFIG.faq, контейнер index.html → #faqContainer.
//   • toggleFaq зовётся из инлайн-onclick построенной разметки — только function-декларация.
//   • animations.js вешает hook на openFaqItem / closeFaqItem.
// ═══════════════════════════════════════════════════════════════════════

// --- РАЗДЕЛ ЧАСТЫХ ВОПРОСОВ ---
function initFaq() {
  renderFaq();

  // Промокод в промо-блоке ответа (config.js → FAQ_PROMO_RU / FAQ_PROMO_EN)
  // копируется по клику. Обработчик висит на контейнере, а не на самой кнопке:
  // карточки FAQ перерисовываются при смене языка (renderFaq → innerHTML),
  // контейнер же остаётся тем же, и подписка не теряется.
  const container = document.getElementById('faqContainer');
  if (container) {
    container.addEventListener('click', function (e) {
      const codeEl = e.target.closest ? e.target.closest('[data-copy-promo]') : null;
      if (!codeEl) return;
      e.preventDefault();
      e.stopPropagation();
      copyPromoCode(codeEl);
    });
  }
}

// FAQ-ответы в config.js заканчиваются промо-блоком со скидкой (FAQ_PROMO_RU / FAQ_PROMO_EN).
// Промо рендерится отдельным блоком ПОСЛЕ текста ответа: внутри <p> блок-уровневый <div>
// недопустим — парсер выносит его за пределы абзаца, и при повторном рендере промо дублируется.
function splitFaqAnswer(answerHtml) {
  const promo = currentLang === 'ru' ? FAQ_PROMO_RU : FAQ_PROMO_EN;
  if (typeof promo === 'string' && promo && answerHtml.indexOf(promo) !== -1) {
    // split/join убирает все вхождения — промо-блок на странице всегда один
    return { text: answerHtml.split(promo).join(''), promo: promo };
  }
  return { text: answerHtml, promo: '' };
}

function renderFaq() {
  const container = document.getElementById('faqContainer');
  if (!container) return;

  const currentDevice = getDeviceType();

  // Обновление на месте: без скачков раскладки и пересборки DOM при смене языка
  const existingCards = container.querySelectorAll('.rack-card');
  if (existingCards.length === CONFIG.faqData.length) {
    CONFIG.faqData.forEach((item, index) => {
      const card = existingCards[index];
      const qRaw = currentLang === 'ru' ? item.qRu : item.qEn;
      const aRaw = currentLang === 'ru' ? item.aRu : item.aEn;
      const q = resolveDeviceText(qRaw, currentDevice);
      const rawA = resolveDeviceText(aRaw, currentDevice);
      const a = (rawA || '').replace(/\n/g, '<br/>');
      const answer = splitFaqAnswer(a);

      const qSpan = card.querySelector('.faq-q-text') || card.querySelector('button > span');
      if (qSpan) qSpan.textContent = q;

      const aP = card.querySelector('.faq-a-text') || card.querySelector('.faq-content-wrapper p');
      if (aP) aP.innerHTML = answer.text;

      const promoSlot = card.querySelector('.faq-promo-slot');
      if (promoSlot) promoSlot.innerHTML = answer.promo;

      const body = card.querySelector('.faq-content-wrapper');
      if (body && body.getAttribute('data-open') === 'true') {
        body.style.display = 'block';
        body.style.height = 'auto';
        body.style.opacity = '1';
        card.classList.add('nr-faq-lang-switched');
      }
    });
    return;
  }

  container.innerHTML = '';

  CONFIG.faqData.forEach((item, index) => {
    const qRaw = currentLang === 'ru' ? item.qRu : item.qEn;
    const aRaw = currentLang === 'ru' ? item.aRu : item.aEn;
    const q = resolveDeviceText(qRaw, currentDevice);
    const rawA = resolveDeviceText(aRaw, currentDevice);
    const a = (rawA || '').replace(/\n/g, '<br/>');
    const answer = splitFaqAnswer(a);
    const itemKey = `faq-${index}`;

    const el = document.createElement('div');
    el.className = 'rack-card faq-card overflow-hidden border border-gray-800/80 transition-colors duration-300';
    el.innerHTML = `
      <button
        onclick="toggleFaq('${itemKey}')"
        class="w-full p-5 sm:p-6 text-left flex justify-between items-center gap-4 group focus:outline-none cursor-pointer select-none"
        aria-expanded="false"
      >
        <span class="faq-q-text flex-1 min-w-0 text-base sm:text-lg font-bold text-gray-100 group-hover:text-amber-400 transition-colors">
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
          <p class="faq-a-text">${answer.text}</p>
          <div class="faq-promo-slot">${answer.promo}</div>
        </div>
      </div>
    `;
    container.appendChild(el);
  });

  setTimeout(() => {
    if (typeof initFaqGsapAnimation === 'function') {
      initFaqGsapAnimation();
    }
    scheduleScrollTriggerRefresh(0);
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
  const targetHeight = Math.ceil(body.scrollHeight || body.offsetHeight);
  body.style.height = '0px';

  if (typeof gsap !== 'undefined') {
    gsap.killTweensOf(body);
    gsap.fromTo(body,
      { height: 0, opacity: 0 },
      {
        height: targetHeight,
        opacity: 1,
        duration: 1.5,
        ease: 'power3.out',
        onComplete: () => {
          body.style.height = 'auto';
          requestAnimationFrame(() => {
            scheduleScrollTriggerRefresh(0);
          });
        }
      }
    );
  } else {
    body.style.height = 'auto';
    body.style.opacity = '1';
    requestAnimationFrame(() => {
      scheduleScrollTriggerRefresh(0);
    });
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
      duration: 0.7,
      ease: 'power3.inOut',
      onComplete: () => {
        body.style.display = 'none';
        body.style.height = '0px';
        requestAnimationFrame(() => {
          scheduleScrollTriggerRefresh(0);
        });
      }
    });
  } else {
    body.style.height = '0px';
    body.style.opacity = '0';
    body.style.display = 'none';
    requestAnimationFrame(() => {
      scheduleScrollTriggerRefresh(0);
    });
  }
}

