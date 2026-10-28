// ═══════════════════════════════════════════════════════════════════════
// js/reviews.js — ОТЗЫВЫ: ПРОГРЕВ ФОТО, ЛЕНТЫ, СВАЙП, РАСКРЫТИЕ
// Грузится после: js/state.js. Читает: currentLang, CONFIG.
// Владеет: —
// Публичные (window): initReviews, renderReviews, toggleReview, warmReviewsAvatars.
// Блоки файла:
//   • warmReviewsAvatars — фото аватаров в скрытом контейнере до появления ленты.
//   • renderReviews — карточки из CONFIG.reviewsData, контейнер #reviews.
//   • Две бегущие ленты: свайп, перетаскивание, пауза под курсором.
//   • Раскрытие длинного отзыва и «Читать далее» (syncReviewsMore).
//   • toggleReview зовётся из инлайн-onclick построенной разметки — только function.
// ═══════════════════════════════════════════════════════════════════════

// --- РАЗДЕЛ ОТЗЫВОВ ---
// До появления ленты (initReviews) фото аватаров держим вставленными в скрытый
// контейнер: браузер качает их на первом же кадре, вместе со страницей, а не
// когда лента доедет до секции. Карточки получают уже готовые картинки из кэша.
function warmReviewsAvatars() {
  const reviews = CONFIG.reviewsData || [];
  if (!reviews.length) return;

  const holder = document.createElement('div');
  holder.className = 'nr-avatars-preload';
  holder.setAttribute('aria-hidden', 'true');

  const currentDevice = getDeviceType();
  reviews.forEach((review) => {
    const src = resolveDeviceText(review.avatar, currentDevice);
    if (typeof src !== 'string' || !src) return;
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.loading = 'eager';
    img.decoding = 'async';
    holder.appendChild(img);
  });

  document.body.appendChild(holder);
}
warmReviewsAvatars();

function initReviews() {
  renderReviews();
  initReviewSwipe();
  initReviewDrag();
  initReviewLinkFocus();

  // Фото уже в кэше (warmReviewsAvatars): держать на них loading="lazy"
  // больше незачем — карточка показывает картинку сразу, без доедет-загрузится.
  document.querySelectorAll('#reviews .review-photo').forEach((img) => {
    img.loading = 'eager';
  });
  document.querySelectorAll('.nr-avatars-preload').forEach((el) => el.remove());

  // Метрики текста меняются после загрузки шрифтов — обрезку длинных отзывов
  // («Читать далее…») и высоту карточек считаем заново.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      syncReviewsMore();
      syncReviewCardHeights();
    });
  }
}

// Ссылка на автора открывается в новой вкладке (target="_blank") и после клика
// остаётся в фокусе. Возвращаешься на сайт — лента стоит: её держит пауза
// .nr-marquee:focus-within (css/style), а снимается она только следующим кликом
// в любом месте страницы. Поэтому после клика мышью или пальцем фокус снимаем —
// тот же приём, что у «Читать далее…» (toggleReview). С клавиатуры фокус не
// трогаем: там по нему идёт переход по Tab, и лента под фокусом должна стоять.
// Слушатель один на всю секцию: карточки пересобираются при смене языка.
function initReviewLinkFocus() {
  const section = document.getElementById('reviews');
  if (!section) return;

  section.addEventListener('click', (event) => {
    if (event.detail === 0) return; // Enter/Space — это клавиатура
    const person = event.target.closest('.review-person');
    if (person) person.blur();
  });
}

// Инициалы — подложка под фото: видны, пока картинка не загрузилась.
function getReviewInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');
}

// Данные одной карточки — по текущему языку и разрешению экрана.
// Английский текст отзыва — перевод, поэтому под ним показывается пометка
// reviews.translated (в русской версии ключ пустой — пометки нет).
function fillReviewCard(card, review) {
  const currentDevice = getDeviceType();
  const text = resolveDeviceText(currentLang === 'ru' ? review.textRu : review.textEn, currentDevice);

  const personEl = card.querySelector('.review-person');
  if (personEl) personEl.setAttribute('href', review.url || '#');

  const photoEl = card.querySelector('.review-photo');
  if (photoEl) {
    // Фото — маленький локальный WebP (image/reviews), грузим сразу вместе со
    // страницей: initReviews() снимает loading="lazy" с уже готовых картинок.
    photoEl.setAttribute('src', resolveDeviceText(review.avatar, currentDevice) || '');
  }

  const initialsEl = card.querySelector('.review-initials');
  if (initialsEl) initialsEl.textContent = getReviewInitials(review.name);

  const nameEl = card.querySelector('.review-name');
  if (nameEl) nameEl.textContent = review.name || '';

  const textEl = card.querySelector('.review-text');
  if (textEl) textEl.textContent = text || '';

  const noteEl = card.querySelector('.review-note');
  if (noteEl) {
    const note = getI18nValue(currentLang, 'reviews.translated') || '';
    noteEl.textContent = note;
    noteEl.hidden = !note;
  }
}

// Отзывы раскладываются в две бегущие ленты (#reviewsRowTop / #reviewsRowBottom):
// чётные — в верхнюю, нечётные — в нижнюю. Каждый ряд строится двумя
// одинаковыми половинами, чтобы лента ехала безразрывно: трек сдвигается ровно
// на половину своей ширины (css/style → @keyframes nrMarqueeLeft / nrMarqueeRight).
function renderReviews() {
  const rows = [
    document.getElementById('reviewsRowTop'),
    document.getElementById('reviewsRowBottom')
  ];
  if (!rows[0] || !rows[1]) return;

  const reviews = CONFIG.reviewsData || [];
  if (!reviews.length) return;

  const groups = [
    reviews.filter((review, index) => index % 2 === 0),
    reviews.filter((review, index) => index % 2 === 1)
  ];

  // Обновление на месте: без скачков раскладки и пересборки DOM при смене языка
  const isBuilt = rows.every((row, idx) => row.children.length === groups[idx].length * 2);
  if (isBuilt) {
    rows.forEach((row, idx) => {
      Array.prototype.forEach.call(row.children, (card, index) => {
        fillReviewCard(card, groups[idx][index % groups[idx].length]);
      });
    });
    syncReviewsMore();
    syncReviewCardHeights();
    return;
  }

  rows.forEach((row, idx) => {
    row.innerHTML = '';

    // Вторая половина — копия первой: она делает ленту безразрывной, поэтому
    // уходит из порядка табуляции и из озвучки скринридером.
    [false, true].forEach((isClone) => {
      groups[idx].forEach((review) => {
        const card = document.createElement('article');
        card.className = 'rack-card review-card';
        // Номер отзыва в CONFIG.reviewsData: по нему раскрываются сразу обе
        // карточки отзыва — сама карточка и её копия в ленте.
        card.dataset.review = String(reviews.indexOf(review));
        card.innerHTML = `
          <a class="review-person" target="_blank" rel="noopener noreferrer">
            <span class="review-avatar">
              <span class="review-initials"></span>
              <img class="review-photo" alt="" loading="lazy" decoding="async">
            </span>
            <span class="review-name"></span>
          </a>
          <div class="review-body">
            <p class="review-text"></p>
            <button class="review-more" hidden onclick="toggleReview(this, event)"></button>
            <span class="review-note" hidden></span>
          </div>
        `;

        if (isClone) {
          card.setAttribute('aria-hidden', 'true');
          card.querySelector('.review-person').setAttribute('tabindex', '-1');
          card.querySelector('.review-more').setAttribute('tabindex', '-1');
        }

        row.appendChild(card);
        fillReviewCard(card, review);
      });
    });
  });

  // Подписи «Читать далее…» и общая высота свёрнутых карточек — когда разметка
  // уже собрана: и то и другое считается по факту обрезки текста.
  syncReviewsMore();
  syncReviewCardHeights();
}

// Обрезан ли текст карточки по высоте (css/style/18-reviews.css → .review-text: max-height)
function isReviewTextClamped(card) {
  const textEl = card.querySelector('.review-text');
  return !!textEl && textEl.scrollHeight > textEl.clientHeight + 1;
}

// Высота, до которой обрезан свёрнутый текст (css/style/18-reviews.css → .review-text: max-height).
// У раскрытой карточки обрезка снята классом, поэтому нужное значение берём у
// свёрнутой карточки того же ряда: оно вычисленное (1.6em * 6), то есть одинаковое
// для всех и не зависит от длины конкретного отзыва.
// Карточку в движении пропускаем: у неё обрезка задана inline-стилем анимации.
function getReviewClampHeight(card) {
  const track = card.closest('.nr-marquee-track');
  const probes = track ? track.querySelectorAll('.review-card:not(.is-open) .review-text') : [];
  for (const probe of probes) {
    if (probe.style.maxHeight) continue;
    return parseFloat(getComputedStyle(probe).maxHeight) || 0;
  }
  return 0; // все карточки ряда раскрыты или в движении — обрезку взять негде
}

// Общая высота свёрнутой карточки ряда — переменная --nr-review-card-h, которую
// ставит syncReviewCardHeights(). Именно она в css/style держит height свёрнутой
// карточки, поэтому сворачивание должно заканчиваться ровно на этом значении.
function getReviewRowHeight(card) {
  const track = card.closest('.nr-marquee-track');
  if (!track) return 0;
  return parseFloat(getComputedStyle(track).getPropertyValue('--nr-review-card-h')) || 0;
}

// Подпись под текстом. Подпись есть у обрезанного отзыва, а у раскрытой карточки
// она видна всегда («Свернуть») — даже у короткой: сворачивать её тоже нужно.
// isOpen передаётся явно: setReviewOpen меняет класс в конце хода, поэтому на
// время анимации состояние класса ещё старое, а подпись нужна уже целевая.
// Готовый текст подписи — setReviewMoreLabelText(); видимость решает
// setReviewMoreLabel() по конечному состоянию карточки (вызывается в конце хода).
function setReviewMoreLabelText(card, isOpen) {
  const moreEl = card.querySelector('.review-more');
  if (!moreEl) return;
  moreEl.textContent = getI18nValue(currentLang, isOpen ? 'reviews.less' : 'reviews.more') || '';
}

function setReviewMoreLabel(card, isClamped, isOpen) {
  const moreEl = card.querySelector('.review-more');
  if (!moreEl) return;

  const open = typeof isOpen === 'boolean' ? isOpen : card.classList.contains('is-open');
  setReviewMoreLabelText(card, open);
  moreEl.hidden = !open && !isClamped;
}

// Подписи по всем карточкам сразу: сначала измеряем все (одна переклейка
// раскладки), потом пишем подписи — иначе раскладка считалась бы на каждой карточке.
function syncReviewsMore() {
  const cards = document.querySelectorAll('#reviews .review-card');
  const clamped = [];
  cards.forEach((card) => clamped.push(isReviewTextClamped(card)));
  cards.forEach((card, index) => setReviewMoreLabel(card, clamped[index]));
}

// Общая высота свёрнутой карточки для ОБЕИХ лент — переменная --nr-review-card-h,
// которую читают и css/style (.nr-marquee-track / .review-card), и JS.
// Через align-items: stretch высоту задавать нельзя: раскрытый отзыв растягивает
// весь ряд. Поэтому карточки друг за другом не тянутся, а высота задаётся явно.
// Меряем только свёрнутые: у раскрытой карточки height: auto.
// Значение одно на две ленты: длинные отзывы (верхний ряд) задают «полку», и
// короткий нижний ряд поднимается до неё — так карточки в лентах выглядят
// одинаковыми, а не двумя разными по высоте рядами.
function syncReviewCardHeights() {
  const tracks = document.querySelectorAll('#reviews .nr-marquee-track');
  if (!tracks.length) return;

  // Замер — на чистой раскладке: снятую переменную иначе намерили бы её же значением
  tracks.forEach((track) => track.style.removeProperty('--nr-review-card-h'));

  let max = 0;
  tracks.forEach((track) => {
    track.querySelectorAll('.review-card:not(.is-open)').forEach((card) => {
      const textEl = card.querySelector('.review-text');
      if (!textEl) return;
      // Карточку в движении пропускаем: высота у неё сейчас между раскрытой и
      // свёрнутой (js/reviews.js → setReviewOpen вешает .is-animating).
      if (card.classList.contains('is-animating')) return;
      // ceil: высота карточки не должна оказаться на доли пикселя меньше содержимого
      max = Math.max(max, Math.ceil(card.getBoundingClientRect().height));
    });
  });

  if (!max) return;
  tracks.forEach((track) => track.style.setProperty('--nr-review-card-h', `${max}px`));
}

// Ход раскрытия и сворачивания отзыва — 1s, вдвое короче прежних 2s / 1.5s
// (медленный ход читался вяло). Кривая sine.inOut общая для обоих направлений и
// для всех движущихся величин (высота карточки, обрезка текста, подпись): плавное
// начало, ускорение в середине пути и плавное торможение в конце. Именно синус, а
// не power2: у power2.out скорость максимальна ровно в нуле, из-за чего раскрытие
// начиналось рывком.
const REVIEW_TOGGLE_DURATION = 1;
const REVIEW_TOGGLE_EASE = 'sine.inOut';

// Раскрывает и сворачивает отзыв: класс .is-open ставит конечное состояние
// (css/style), а ход ведёт GSAP — как у вопроса в FAQ (openFaqItem).
// Едут две синхронные величины: высота карточки и обрезка самого текста
// (maxHeight от высоты обрезки до полной высоты текста). За счёт этого при
// раскрытии нижняя часть текста плавно выезжает из карточки, а при сворачивании
// так же плавно прячется вместе с ней, а не обрезается рывком. Вместе с текстом
// опускается вниз только эта карточка — остальные стоят на общей высоте ряда
// (css/style/18-reviews.css → .nr-marquee-track: flex-start).
function setReviewOpen(card, willOpen) {
  const textEl = card.querySelector('.review-text');
  if (!textEl) return;

  // Обрезан ли отзыв: по этому у свёрнутой карточки решается, показывать ли
  // подпись «Читать далее…» (у короткого отзыва подписи нет).
  // startTextH — видимая высота текста сейчас, fullH — его полная высота
  // (обрезка по max-height на scrollHeight не влияет).
  const startTextH = textEl.getBoundingClientRect().height;
  const fullH = textEl.scrollHeight;
  const clampH = getReviewClampHeight(card);
  const isClamped = fullH > clampH + 1;

  // Стартовые значения — то, что видно сейчас. Карточка могла остаться с
  // inline-высотой от прерванного хода, поэтому startH берём до её снятия.
  const startH = card.getBoundingClientRect().height;

  const moreEl = card.querySelector('.review-more');
  const moreWasHidden = !!moreEl && moreEl.hidden;

  // Высоту конечного состояния меряем, не показывая его: класс .is-open и
  // снятую обрезку ставим на один синхронный проход и сразу откатываем —
  // браузер успевает пересчитать стили, но не отрисовывает кадр, поэтому
  // раскладка страницы не мигает. Так высота получается ровно та, что даст CSS
  // (height: auto с полным текстом и подписью), а не собранная вручную.
  // Подпись на время замера показываем: у раскрытой карточки «Свернуть» видна
  // всегда, и её строка входит в высоту.
  const prevInlineH = card.style.height;
  const prevInlineMax = textEl.style.maxHeight;
  const wasOpen = card.classList.contains('is-open');
  let openH = 0;
  try {
    if (moreEl) moreEl.hidden = false;
    card.style.height = '';
    textEl.style.maxHeight = '';
    card.classList.add('is-open');
    openH = Math.ceil(card.getBoundingClientRect().height);
  } finally {
    // Откат в finally: если замер почему-то упадёт, карточка всё равно вернётся
    // в исходное состояние, а не останется раскрытой без анимации.
    card.classList.toggle('is-open', wasOpen);
    card.style.height = prevInlineH;
    textEl.style.maxHeight = prevInlineMax;
    if (moreEl) moreEl.hidden = moreWasHidden;
  }

  const rowH = getReviewRowHeight(card);
  const endCardH = willOpen ? openH : Math.ceil(rowH || startH);
  const endTextH = willOpen ? fullH : clampH;

  // Подпись: у раскрытой карточки всегда «Свернуть», у обрезанной свёрнутой —
  // «Читать далее…», у короткой свёрнутой подписи нет. Здесь меняем только текст:
  // скрывать подпись будем по завершении хода, иначе у сворачиваемой карточки
  // она пропала бы в самом начале, а не уехала с нижней частью текста.
  // Видимость при этом снимаем: у раскрываемой карточки короткого отзыва подпись
  // скрыта, а показать её нужно («Свернуть»).
  setReviewMoreLabelText(card, willOpen);
  if (moreEl) moreEl.hidden = false;

  const gsapReady = typeof gsap !== 'undefined';
  const canAnimate = gsapReady && Math.abs(endCardH - startH) > 1;

  if (!canAnimate) {
    // Двигать нечего: отдаём карточку и текст CSS — класс сразу даёт конечное
    // состояние, а inline-обрезка и высота снимаются. Подпись решаем сразу:
    // хода нет, скрывать её позже некому.
    card.classList.remove('is-animating');
    card.classList.toggle('is-open', willOpen);
    if (gsapReady) gsap.set(card, { clearProps: 'height' });
    else card.style.height = '';
    textEl.style.maxHeight = '';
    setReviewMoreLabel(card, isClamped, willOpen);
    requestAnimationFrame(() => { scheduleScrollTriggerRefresh(0); });
    return;
  }

  // Подпись меняет текст на ходу («Читать далее…» ⇄ «Свернуть») — проявляем её
  // в такт с ходом текста (та же длительность и кривая), а не отдельным
  // мгновенным миганием: у раскрываемой карточки подпись выезжает вместе с
  // нижней частью текста, у сворачиваемой — уходит вместе с ней.
  const moreVisible = moreEl && !moreEl.hidden;
  if (moreVisible) {
    gsap.killTweensOf(moreEl);
    gsap.fromTo(moreEl, { opacity: 0 }, {
      opacity: 1,
      duration: REVIEW_TOGGLE_DURATION,
      ease: REVIEW_TOGGLE_EASE,
      onComplete: () => gsap.set(moreEl, { clearProps: 'opacity' })
    });
  }

  gsap.killTweensOf(card);
  gsap.killTweensOf(textEl);

  // Ключевой момент: класс .is-open задаёт КОНЕЧНОЕ состояние (height: auto и
  // снятую обрезку текста) и на время хода НЕ ставится. Иначе смена класса
  // мгновенно переклеила бы раскладку: трек и .nr-marquee (overflow: hidden)
  // сразу стали бы высокими, и раздел ниже прыгнул бы вниз ещё до первого кадра
  // анимации — а потом «догонял» бы в конце. Поэтому обе величины ведём только
  // inline-стилями, а класс ставим в onComplete.
  // .is-animating включается сразу: он обрезает контент за рамкой карточки.
  card.classList.add('is-animating');
  // Обрезка текста должна ехать, а не сниматься классом: на время хода её
  // держит inline maxHeight от GSAP (перебивает CSS-правило .review-text).
  textEl.style.maxHeight = startTextH + 'px';

  const tween = { duration: REVIEW_TOGGLE_DURATION, ease: REVIEW_TOGGLE_EASE };

  gsap.fromTo(card, { height: startH }, {
    height: endCardH,
    ...tween,
    onComplete: () => {
      // Конечное состояние отдаём CSS: класс даёт height: auto у раскрытой
      // карточки и снятую обрезку текста, а свёрнутую держит высота ряда.
      card.classList.toggle('is-open', willOpen);
      gsap.set(card, { clearProps: 'height' });
      textEl.style.maxHeight = '';
      card.classList.remove('is-animating');
      // Только теперь, когда ход закончен, решаем судьбу подписи: у короткого
      // свёрнутого отзыва она скрывается, у остальных остаётся на месте.
      setReviewMoreLabel(card, isClamped, willOpen);
      requestAnimationFrame(() => { scheduleScrollTriggerRefresh(0); });
    }
  });

  gsap.fromTo(textEl, { maxHeight: startTextH }, { maxHeight: endTextH, ...tween });
}

// Клик по «Читать далее…» раскрывает отзыв целиком, повторный клик — сворачивает.
// Состояние переключается у обеих карточек отзыва: у самой карточки и её копии.
function toggleReview(button, event) {
  const card = button.closest('.review-card');
  if (!card) return;

  const key = card.dataset.review;
  const sameReview = key ? document.querySelectorAll(`#reviews .review-card[data-review="${key}"]`) : [card];
  const willOpen = !card.classList.contains('is-open');
  // Клик с клавиатуры (Enter/Space) приходит без координат — detail === 0
  const byKeyboard = !!event && event.detail === 0;

  sameReview.forEach((item) => setReviewOpen(item, willOpen));

  // Управляли карточкой — снимаем оставшееся выделение: на сенсорных экранах
  // подсветка текста «залипала» после тапа по кнопке.
  clearReviewsSelection();

  // Мышь и палец фокус с кнопки снимают: иначе пауза по :focus-within держала
  // ленту до следующего клика в другом месте. С клавиатуры фокус остаётся —
  // по нему идёт переход по Tab, и лента под фокусом стоит.
  if (!byKeyboard) button.blur();

  // Свёрнутый отзыв прочитан — движение ленты возвращаем сразу, даже если
  // курсор/палец остались на карточке (см. resumeReviewsMarquee). С клавиатуры
  // не трогаем: там пауза держится фокусом.
  if (!willOpen && !byKeyboard) {
    resumeReviewsMarquee(card);
    // Тап-пауза ленты (сенсорные экраны) снимается вместе с движением: сворачивать
    // отзыв и оставлять ленту стоящей смысла нет.
    const track = card.closest('.nr-marquee-track');
    if (track) track.classList.remove('nr-paused');
  }

  // Сенсорные экраны: раскрытый отзыв читают, а лента под пальцем не останавливается
  // (hover там «залипает» только после касания, а его на бегущей ленте нет) —
  // поэтому тап по «Читать далее…» останавливает именно ту ленту, где нажали.
  // Снимает паузу повторный тап по «Свернуть» (ветка выше) или уход секции с экрана.
  if (willOpen && isTouchActivation(event)) pauseReviewsMarquee(card);

  // Позиции триггеров анимаций пересчитываются по завершении хода высоты —
  // в setReviewOpen (как у вопроса в FAQ). Пересчёт в первых кадрах движения
  // переклеивал бы раскладку всей страницы прямо посреди анимации: ход читается
  // резким, с пропуском кадров.
}

// Тап ли это пальцем — по нему решается пауза ленты на сенсорных экранах.
// На гибридных устройствах (тач-экран + мышь) клик мышью паузы не даёт: там
// отзыв под курсором и так стоит (:hover в css/style), а лента продолжает ехать.
function isTouchActivation(event) {
  if (!hasTouchInput()) return false;
  if (!event) return false;                        // вызов без события — не тап
  const type = event.pointerType || '';            // современных браузеров
  if (type) return type === 'touch' || type === 'pen';
  return true;                                     // старые: событие без pointerType
}

// Пауза ленты, в которой тапнули «Читать далее…» (css/style →
// .nr-marquee-track.nr-paused). Вешаем только на сенсорных экранах: там нет
// hover-паузы, и раскрытый отзыв иначе уезжал бы из-под пальца.
function pauseReviewsMarquee(card) {
  const track = card.closest('.nr-marquee-track');
  if (!track) return;
  track.classList.add('nr-paused');
  // Прежний «принудительный старт» (resumeReviewsMarquee) отменяем: он перебил бы паузу.
  track.classList.remove('nr-resume');
}

// Снимает паузу со всех лент отзывов — уход секции с экрана и повторный показ.
function clearReviewsMarqueePause() {
  document.querySelectorAll('#reviews .nr-marquee-track').forEach((track) => {
    track.classList.remove('nr-paused');
  });
}

// Сворачивает все раскрытые отзывы разом — секция ушла с экрана (animations.js →
// initViewportGate). Ход GSAP здесь не нужен: карточки вне экрана, простой сброс
// классов и inline-стилей дешевле и не переклеивает раскладку на глазах.
function collapseAllReviews() {
  const cards = document.querySelectorAll('#reviews .review-card');
  let hasOpen = false;
  cards.forEach((card) => {
    if (!card.classList.contains('is-open')) return;
    hasOpen = true;
    card.classList.remove('is-open');
    card.classList.remove('is-animating');
    card.style.removeProperty('height');
    const textEl = card.querySelector('.review-text');
    if (textEl) textEl.style.removeProperty('max-height');
  });
  if (!hasOpen) return;

  clearReviewsMarqueePause();
  syncReviewsMore();
  syncReviewCardHeights();
}

// Снимает выделение текста, оставшееся после тапа или долгого нажатия
function clearReviewsSelection() {
  const selection = window.getSelection && window.getSelection();
  if (!selection) return;
  if (selection.removeAllRanges) selection.removeAllRanges();
  else if (selection.empty) selection.empty(); // старый WebKit
}

// Возвращает движение ленте после свёртки отзыва (css/style →
// .nr-marquee-track.nr-resume). Нужно потому, что карточка остаётся под
// курсором/пальцем: на сенсорных экранах браузер держит на ней :hover до
// следующего тапа, а мышь продолжала бы держать обычную паузу. Обычное
// поведение возвращается, как только курсор ушёл с ленты, — или при новом
// касании на сенсорном экране.
function resumeReviewsMarquee(card) {
  const track = card.closest('.nr-marquee-track');
  if (!track) return;

  track.classList.add('nr-resume');

  const drop = (event) => {
    // Тач-указатель «уходит» сразу после пальца, но браузер держит :hover —
    // для него класс снимает только новое касание (pointerdown).
    if (event.type === 'pointerleave' && event.pointerType === 'touch') return;
    track.classList.remove('nr-resume');
    track.removeEventListener('pointerleave', drop);
    track.removeEventListener('pointerdown', drop);
  };

  track.addEventListener('pointerleave', drop);
  track.addEventListener('pointerdown', drop);
}

/* Свайп колонок отзывов на сенсорных экранах: колонку можно тянуть пальцем
   влево-вправо. Лента едет CSS-анимацией, поэтому сдвиг пальцем пишем в её фазу
   (animation-delay, см. setReviewColumnShift), а не отдельным свойством: фаза
   всегда остаётся внутри одного «круга» ленты, поэтому трек никогда не уезжает
   за свои копии и справа не появляется пустота. На время касания лента стоит.
   Жест определяем по преобладающей оси, вертикальная прокрутка страницы
   остаётся нативной (touch-action: pan-y в css/style). */
const REVIEW_SWIPE_AXIS_THRESHOLD = 12; // px: отсекает дрожание пальца при тапе
const REVIEW_SWIPE_GAIN = 1.4; // усиление свайпа: палец 100 px → лента 140 px (1 — как было)
/* px: с какого перевеса горизонтали отменяем прокрутку страницы — ниже
   браузерного порога скролла (~8 px), иначе страница «уедет» вместе с лентой
   и её инерция съест первый тап после свайпа (см. touchmove ниже). */
const REVIEW_SWIPE_SCROLL_CANCEL = 6;

// Есть сенсорный ввод (телефон, планшет, тач-экран ноутбука)? Свайп колонок
// включаем только для него: там, где есть мышь, колонку ведёт сама лента.
function hasTouchInput() {
  return 'ontouchstart' in window ||
    !!(navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
}

// Ход ленты в секундах — из css/style (.nr-marquee-track: animation 110s).
// Читаем его, а не держим своим числом: иначе правка длительности в стилях
// молча разошлась бы с расчётом сдвига.
function getReviewMarqueeDuration(track) {
  const value = parseFloat(getComputedStyle(track).animationDuration);
  return value > 0 ? value : 110;
}

// Текущее положение ленты в px — его показывает сама анимация (матрица
// transform в вычисленных стилях). Нужно в начале жеста: ручной сдвиг живёт в
// фазе анимации, поэтому «откуда тянуть» знает только она.
function getReviewTrackOffset(track) {
  const transform = getComputedStyle(track).transform;
  const match = transform && transform.match(/matrix(3d)?\(([^)]+)\)/);
  if (!match) return 0;
  const parts = match[2].split(',').map(Number);
  const offset = match[1] ? parts[12] : parts[4];
  return Number.isFinite(offset) ? offset : 0;
}

// Положение ленты в начале жеста: видимый сдвиг в px и фаза анимации в секундах.
// Обе величины снимаются один раз, до первого движения, и дальше сдвиг считается
// как разница от них. Иначе лента прыгала бы в момент нажатия: анимация к этому
// времени уже отработала сколько-то времени страницы, и задержка, назначенная
// «с нуля», сдвинула бы её рывком.
function getReviewTrackBase(track) {
  const delay = parseFloat(getComputedStyle(track).animationDelay);
  return {
    offset: getReviewTrackOffset(track),
    delay: Number.isFinite(delay) ? delay : 0
  };
}

// Сдвиг колонки — через фазу анимации: animation-delay переносит ленту на нужное
// место, и она продолжает свой бесконечный ход оттуда. Смещение всегда остаётся
// внутри одного «круга» (половины трека), поэтому справа никогда не оголяется
// пустота. Отдельный translate складывался с анимацией: при большом сдвиге сумма
// доходила до полной ширины трека.
// shift — куда поставить ленту (px, в пределах (-span, 0]); base — положение в
// начале жеста (getReviewTrackBase); duration — ход ленты в секундах.
function setReviewColumnShift(marquee, track, shift, span, duration, base) {
  // У обратной ленты ход идёт от -50% к 0, поэтому фаза считается от её начала
  const reverse = marquee.classList.contains('is-reverse');
  const delta = shift - base.offset;
  let delay = base.delay + (reverse ? -delta : delta) * duration / span;
  delay %= duration;
  if (delay > 0) delay -= duration; // держим в (-duration, 0]
  track.style.animationDelay = delay.toFixed(3) + 's';
}

// Сдвиг в пределах одного «круга» ленты: -span < shift <= 0
function wrapReviewColumnShift(value, span) {
  if (!span) return 0;
  const shift = value % span;
  return shift > 0 ? shift - span : shift;
}

function initReviewSwipe() {
  if (!hasTouchInput()) return;
  // «Уменьшить движение»: колонка прокручивается нативно (css/style) — свой свайп не нужен
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.querySelectorAll('#reviews .nr-marquee').forEach((marquee) => {
    const track = marquee.querySelector('.nr-marquee-track');
    if (!track) return;

    marquee.classList.add('nr-swipeable'); // touch-action: pan-y (css/style)

    let span = 0;       // половина трека = один «круг» ленты
    let duration = 0;   // ход ленты в секундах (css/style → animation)
    let base = { offset: 0, delay: 0 }; // положение ленты в начале касания
    let dragShift = 0;  // оно же на момент распознавания жеста
    let startX = 0;
    let startY = 0;
    let lastDx = 0;
    let axis = null;    // 'x' | 'y' | null (ещё не определена)
    let swiped = false; // только что был жест — следующий клик гасим

    // Клик, который браузер шлёт после жеста, не должен нажимать «Читать далее…»
    // или открывать страницу автора
    marquee.addEventListener('click', (event) => {
      if (!swiped) return;
      swiped = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    marquee.addEventListener('touchstart', (event) => {
      const touch = event.changedTouches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      lastDx = 0;
      axis = null;
      span = track.scrollWidth / 2; // копии ленты одинаковые: половина — «круг»
      duration = getReviewMarqueeDuration(track);
    }, { passive: true });

    marquee.addEventListener('touchmove', (event) => {
      if (!span || axis === 'y') return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      // Ось жеста определяем один раз по первым сантиметрам движения.
      // Пауза и замер — только здесь: при вертикальной прокрутке страницы лента
      // продолжает ехать, а сдвиг считается от того положения, в котором ленту
      // застал горизонтальный жест.
      if (axis === null) {
        // Горизонталь уже перевешивает — сразу отменяем прокрутку страницы:
        // иначе вместе с лентой ехала бы и страница, а после отпускания пальца
        // её инерция съедала первый тап по любому объекту сайта.
        if (Math.abs(dx) > REVIEW_SWIPE_SCROLL_CANCEL &&
            Math.abs(dx) > Math.abs(dy) && event.cancelable) {
          event.preventDefault();
        }
        if (Math.abs(dx) < REVIEW_SWIPE_AXIS_THRESHOLD &&
            Math.abs(dy) < REVIEW_SWIPE_AXIS_THRESHOLD) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (axis !== 'x') return;
        marquee.classList.add('nr-dragging');
        base = getReviewTrackBase(track);
        dragShift = base.offset;
      }

      // Жест признан горизонтальным — страница под ним стоять обязана.
      if (event.cancelable) event.preventDefault();
      lastDx = dx * REVIEW_SWIPE_GAIN;
      setReviewColumnShift(marquee, track, wrapReviewColumnShift(dragShift + lastDx, span), span, duration, base);
    }, { passive: false });

    // Палец ушёл: лента продолжает ход с того места, где её оставили,
    // и клик после жеста гасим.
    const finishSwipe = () => {
      if (axis === 'x') {
        swiped = true;
        setTimeout(() => { swiped = false; }, 400);
      }
      marquee.classList.remove('nr-dragging');
      axis = null;
      lastDx = 0;
    };

    marquee.addEventListener('touchend', finishSwipe, { passive: true });
    marquee.addEventListener('touchcancel', finishSwipe, { passive: true });
  });
}

/* Перетаскивание лент отзывов мышью: на компьютере свайпа пальцем нет, и колонку
   можно было только ждать, пока лента доедет сама. Тянем её курсором так же, как
   пальцем на сенсорном экране: сдвиг пишем в фазу анимации (setReviewColumnShift),
   поэтому лента остаётся бесконечной, а не спорит с анимацией. Пока держим, она
   стоит (css/style → .nr-marquee.nr-dragging) и едет ровно за курсором.
   Короткое нажатие без движения остаётся кликом — по нему работают «Читать
   далее…» и ссылка на автора. На тач-экранах жест по-прежнему ведёт initReviewSwipe. */
const REVIEW_DRAG_THRESHOLD = 6; // px: меньше — это клик, а не перетаскивание

function initReviewDrag() {
  // «Уменьшить движение»: колонка прокручивается нативно (css/style) — тянуть нечего
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Только точный указатель: у тач-экранов свой свайп (initReviewSwipe)
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  document.querySelectorAll('#reviews .nr-marquee').forEach((marquee) => {
    const track = marquee.querySelector('.nr-marquee-track');
    if (!track) return;

    marquee.classList.add('nr-draggable'); // cursor: grab (css/style)

    let span = 0;         // половина трека = один «круг» ленты
    let duration = 0;     // ход ленты в секундах (css/style → animation)
    let base = { offset: 0, delay: 0 }; // положение ленты в начале нажатия
    let dragShift = 0;    // оно же, снятое в момент нажатия
    let startX = 0;
    let lastDx = 0;
    let pointerId = null; // мышь, которая держит ленту
    let dragging = false; // порог пройден — это перетаскивание, а не клик
    let dragged = false;  // только что перетащили — следующий клик гасим

    // Клик, который браузер шлёт после перетаскивания, не должен нажимать
    // «Читать далее…» или открывать страницу автора
    marquee.addEventListener('click', (event) => {
      if (!dragged) return;
      dragged = false;
      event.preventDefault();
      event.stopPropagation();
    }, true);

    // Тянуть карточку — это жест ленты, а не «перетащить ссылку/картинку» браузером
    marquee.addEventListener('dragstart', (event) => event.preventDefault());

    const onMove = (event) => {
      if (event.pointerId !== pointerId) return;
      // Кнопку отпустили вне окна — pointerup мог не дойти, завершаем сами
      if (!event.buttons) { finishDrag(event); return; }
      const dx = event.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < REVIEW_DRAG_THRESHOLD) return;
        dragging = true;
      }
      event.preventDefault();
      lastDx = dx; // 1:1 — лента едет ровно за курсором
      setReviewColumnShift(marquee, track, wrapReviewColumnShift(dragShift + lastDx, span), span, duration, base);
    };

    // Кнопка отпущена или указатель потерян: лента продолжает ход с того места,
    // где её оставили (фаза анимации уже стоит на нём).
    const finishDrag = (event) => {
      if (event && event.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', finishDrag);
      pointerId = null;
      marquee.classList.remove('nr-dragging');
      if (!dragging) return;
      dragging = false;
      dragged = true;
      setTimeout(() => { dragged = false; }, 400);
      clearReviewsSelection();
    };

    marquee.addEventListener('pointerdown', (event) => {
      // Только левая кнопка: правая — контекстное меню, средняя — автоскролл
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      if (pointerId !== null) return;
      span = track.scrollWidth / 2; // копии ленты одинаковые: половина — «круг»
      if (!span) return;
      duration = getReviewMarqueeDuration(track);
      pointerId = event.pointerId;
      startX = event.clientX;
      lastDx = 0;
      dragging = false;
      // Класс сразу: лента стоит под нажатием, а текст карточки не выделяется
      // мышью ещё до того, как стало ясно, тянут её или просто кликают.
      // Замер — после класса, чтобы лента не успела уехать на кадр.
      marquee.classList.add('nr-dragging');
      base = getReviewTrackBase(track);
      dragShift = base.offset;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', finishDrag);
      window.addEventListener('pointercancel', finishDrag);
    });
  });
}

