/**
 * NICK RISE STUDIO — config.js (тексты и данные сайта).
 * Тексты — обычные строки; исключение: hero.subtitle (на телефоне короче).
 * FAQ_PROMO_RU/EN — общий промо-блок со скидкой, добавляется в конец ответов FAQ.
 */

const FAQ_PROMO_RU = '<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>Вижу вам интересно сотрудничество со мной! Напишите мне в Телеграм <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> и получите скидку на первый заказ в размере <strong class="text-amber-400 font-bold">10%</strong></span></div>';
const FAQ_PROMO_EN = '<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>Interested in working together? Message me <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> on Telegram and get <strong class="text-amber-400 font-bold">10% off</strong> your first order.</span></div>';

const CONFIG = {
  /* ── Отладочный обход HTTP-кэша аудио (в обычной работе ВЫКЛЮЧЕН) ────────
     false — рабочее значение: файлы берутся из кэша браузера, повторный
             заход треки не качает.
     true  — только на время проверки: к каждому mp3 при создании дорожки
             добавляется уникальный параметр (?nrcb=...), браузер не узнаёт
             URL и качает все треки ЗАНОВО при каждом открытии страницы —
             как будто зашёл новый человек. Так честно проверяются загрузка
             и приоритеты прогрева в Network (≈113 МБ за заход).
             После проверки вернуть false и запушить: файлы из public/ уходят
             на сайт как есть, сборки в проекте нет.
     На папку public/ значение не влияет: параметр живёт только в памяти
     страницы, ссылки в index.html остаются прежними. */
  AUDIO_CACHE_BUST: false,

  i18n: {
    ru: {
      nav: {
        logoTitle: 'Nick Rise Studio',
        abPlayer: 'Примеры A/B',
        services: 'Услуги',
        faq: 'FAQ',
        contacts: 'Контакты',
        reviews: 'Отзывы',
        contactBtn: 'Связаться'
      },
      hero: {
        title: 'Профессиональное<br><span class="whitespace-nowrap">Сведение / Мастеринг</span>',
        subtitle: {
          desktop: 'Специализация: Pop/House • Rock/Metal • Rap/R&B',
          tablet: 'Специализация: Pop/House • Rock/Metal • Rap/R&B',
          mobile: 'Pop/House • Rock/Metal • Rap/R&B'
        },
        usp: 'Превращаю демо-записи и сырые мультитреки в мощный, объемный и конкурентоспособный звук мирового уровня. От первых тактов до финального мастера — каждый элемент на своем месте, каждая частота под контролем.',
        btnPlayer: 'Примеры работ (A/B)',
        btnContact: 'Контакты',
        aboutPhotoBadge: 'Обо мне'
      },
      player: {
        title: 'Слушай разницу',
        langRuBtn: 'На русском',
        langEnBtn: 'На английском',
        beforeLabel: 'BEFORE (MIX)',
        afterLabel: 'AFTER (MASTERED)',
        prevBtn: 'Назад',
        nextBtn: 'Вперед',
        audioError: 'Не удалось загрузить файл трека. Проверьте соединение и нажмите на трек ещё раз.'
      },
      services: {
        title: 'Услуги и цены',
        popularBadge: 'ЧАСТЫЙ ВЫБОР',
        orderBtn: 'Заказать',
        // Всплывающее окно «Рассчитать стоимость услуг» (шаги: предупреждение →
        // длительность → 4 вопроса Да/Нет → итоговая цена).
        priceCalc: {
          button: 'Рассчитать стоимость услуг',
          badge: 'КАЛЬКУЛЯТОР СТОИМОСТИ // NICK RISE',
          warnTitle: 'ВАЖНО',
          warnText: 'Стоимость услуг примерная и зависит от конкретного проекта, здесь вы можете считать ориентировочную стоимость работы.',
          nextBtn: 'Далее',
          prevBtn: 'Назад',
          durationQ: 'Сколько длится Ваш трек (в минутах)?',
          durationMin: 'мин',
          individualNote: 'Обговаривается индивидуально',
          qMastering: 'Вам нужен мастеринг?',
          qVocalRhythm: 'Вам нужна коррекция ритмики / выравнивание громкости вокала?',
          qTrackout: 'Вам нужно сведение trackout бита (бит по дорожкам) / доработка бита?',
          qVocalNotes: 'Вам нужна ручная коррекция нот вокала?',
          yes: 'Да',
          no: 'Нет',
          resultTitle: 'Ориентировочная стоимость',
          resultSub: 'Это предварительный расчёт — точную цену я назову после прослушивания вашего материала.',
          resultIndividualTitle: 'Обговаривается индивидуально',
          resultIndividualSub: 'Для такого хронометража стоимость рассчитывается индивидуально. Напишите мне — обсудим ваш проект.',
          durationRow: 'Длительность трека',
          totalLabel: 'ИТОГО',
          optMastering: 'Мастеринг',
          optVocalRhythm: 'Коррекция ритмики и громкости вокала',
          optTrackout: 'Сведение trackout бита и доработка',
          optVocalNotes: 'Ручная коррекция нот вокала',
          cta: 'Напишите мне — обсудим ваш проект и я назову точную стоимость.',
          writeBtn: 'Написать мне',
          restartBtn: 'Посчитать заново',
          stepLabel: 'Шаг'
        }
      },
      faq: {
        title: 'Частые вопросы'
      },
      contacts: {
        subtitle: '<span class="font-semibold text-gray-200">Свяжитесь со мной напрямую<br class="lg:hidden"/> для обсуждения вашего проекта.</span><br/><span class="text-amber-400 font-extrabold mt-1 inline-block">На связи 7 дней в неделю.</span>',
        telegramBtn: 'Открыть Telegram',
        copyTgUsername: 'Копировать TG',
        copyEmail: 'Копировать Email',
        vkBtn: 'Открыть ВК',
        toastTgCopied: 'Никнейм @Nick_Rise скопирован!',
        toastEmailCopied: 'Email скопирован в буфер обмена!'
      },
      reviews: {
        title: 'Отзывы',
        // Пометка под переведённым отзывом: в русской версии перевода нет.
        translated: '',
        // Подпись под обрезанным длинным отзывом и она же при раскрытии.
        more: 'Читать далее…',
        less: 'Свернуть'
      },
      aboutModal: {
        tag: 'STUDIO ENGINEER PROFILE // NICK RISE',
        title: 'Александр (Nick Rise)',
        subtitle: 'Звукорежиссер сведения & мастеринга',
        experience: '6+ лет в индустрии',
        bioTitle: 'Обо мне',
        bioText1: 'Приветствую! Меня зовут Александр, я битмейкер, техник по звуку и звукорежиссёр из Москвы. В моём портфолио — работа с аналоговыми и цифровыми микшерами на концертах и студиях. Отвечал за звук на прямой трансляции Первого канала на ВДНХ, сотрудничал с PRO BATTLE League, Underground Amplitude и другими лейблами и сообществами.',
        bioText2: 'Проходил обучение у таких звукорежиссёров, как Джон Олин, Константин Матафонов, Илья Лукашев, Павел Уоллен и других.',
        bioText3: 'С радостью готов поработать с тобой!',
        stat1Num: '200+',
        stat1Text: 'Завершенных треков',
        stat2Num: '6+ лет',
        stat2Text: 'Студийного опыта',
        stat3Num: '100%',
        stat3Text: 'Готовность к радио & стримингам',
        btnFaqWhy: 'Почему стоит выбрать именно меня?',
        btnFaqWorkflow: 'Как происходит процесс работы?',
        btnDiscuss: 'Обсудить проект',
        btnDemos: 'Примеры работ (A/B)'
      },

      // Метаданные страницы: title и meta description подставляются по языку
      // в script.js → updateDocumentMeta(). og:*/twitter:* — статичные, двуязычные.
      meta: {
        title: 'Nick Rise Studio — Профессиональное сведение & мастеринг',
        description: 'Премиальное сведение и мастеринг треков от Ника Райза (Nick Rise). Аналоговый звук SSL, Neve, Tube-Tech под стандарты Spotify, Apple Music и Радио.'
      },

      // Подписи тултипов и aria-label (атрибуты data-i18n-title / data-i18n-aria-label).
      a11y: {
        mixerStrip: 'Интерактивная полоса микшера SSL',
        aboutTitle: 'Обо мне // Nick Rise',
        aboutAria: 'Обо мне - Nick Rise Studio',
        aboutPhoto: 'Нажмите, чтобы узнать больше обо мне',
        prev: 'Назад',
        next: 'Вперед',
        close: 'Закрыть',
        backToTop: 'Вернуться наверх'
      }
    },

    en: {
      nav: {
        logoTitle: 'Nick Rise Studio',
        abPlayer: 'A/B Demos',
        services: 'Services',
        faq: 'FAQ',
        contacts: 'Contacts',
        reviews: 'Reviews',
        contactBtn: 'Contact'
      },
      hero: {
        title: 'Professional<br><span class="whitespace-nowrap">Mixing / Mastering</span>',
        subtitle: {
          desktop: 'Specialization: Pop/House • Rock/Metal • Rap/R&B',
          tablet: 'Specialization: Pop/House • Rock/Metal • Rap/R&B',
          mobile: 'Pop/House • Rock/Metal • Rap/R&B'
        },
        usp: 'I turn raw demos and multitracks into a powerful, wide and competitive world-class sound. From the first bar to the final master — every element in its place, every frequency under control.',
        btnPlayer: 'Hear A/B Demos',
        btnContact: 'Contact Me',
        aboutPhotoBadge: 'About'
      },
      player: {
        title: 'Hear the Difference',
        langRuBtn: 'In Russian',
        langEnBtn: 'In English',
        beforeLabel: 'BEFORE (MIX)',
        afterLabel: 'AFTER (MASTERED)',
        prevBtn: 'Previous',
        nextBtn: 'Next',
        audioError: 'Could not load the track file. Check your connection and tap the track again.'
      },
      services: {
        title: 'Services & Pricing',
        popularBadge: 'MOST CHOSEN',
        orderBtn: 'Order',
        // Service cost calculator modal (steps: warning → duration → 4 Yes/No
        // questions → final price).
        priceCalc: {
          button: 'Calculate service cost',
          badge: 'SERVICE COST CALCULATOR // NICK RISE',
          warnTitle: 'IMPORTANT',
          warnText: 'Service pricing is approximate and depends on the specific project — use this calculator to get a rough estimate.',
          nextBtn: 'Next',
          prevBtn: 'Back',
          durationQ: 'How long is your track (in minutes)?',
          durationMin: 'min',
          individualNote: 'Quoted individually',
          qMastering: 'Do you need mastering?',
          qVocalRhythm: 'Do you need vocal timing correction / loudness leveling?',
          qTrackout: 'Do you need beat trackout mixing (beat stems) / beat refinement?',
          qVocalNotes: 'Do you need manual vocal pitch correction?',
          yes: 'Yes',
          no: 'No',
          resultTitle: 'Estimated cost',
          resultSub: 'This is a preliminary estimate — I\'ll give you an exact quote after listening to your material.',
          resultIndividualTitle: 'Quoted individually',
          resultIndividualSub: 'For this track length the price is quoted individually. Message me and let\'s discuss your project.',
          durationRow: 'Track length',
          totalLabel: 'TOTAL',
          optMastering: 'Mastering',
          optVocalRhythm: 'Vocal timing & loudness correction',
          optTrackout: 'Beat trackout mixing & refinement',
          optVocalNotes: 'Manual vocal pitch correction',
          cta: 'Message me — we\'ll discuss your project and I\'ll give you an exact quote.',
          writeBtn: 'Message me',
          restartBtn: 'Calculate again',
          stepLabel: 'Step'
        }
      },
      faq: {
        title: 'FAQ'
      },
      contacts: {
        subtitle: '<span class="font-semibold text-gray-200">Reach out directly to discuss your project.</span><br/><span class="text-amber-400 font-extrabold mt-1 inline-block">Available 7 days a week.</span>',
        telegramBtn: 'Open Telegram',
        copyTgUsername: 'Copy Telegram',
        copyEmail: 'Copy Email',
        vkBtn: 'Open VK',
        toastTgCopied: 'Username @Nick_Rise copied to clipboard!',
        toastEmailCopied: 'Email copied to clipboard!'
      },
      reviews: {
        title: 'Reviews',
        // Translation notice under the review text (English version only)
        translated: 'Translated',
        // Label under a long truncated review and its state when expanded
        more: 'Read more…',
        less: 'Show less'
      },
      aboutModal: {
        tag: 'STUDIO ENGINEER PROFILE // NICK RISE',
        title: 'Alexander (Nick Rise)',
        subtitle: 'Mixing & Mastering Engineer',
        experience: '6+ Years Industry Experience',
        bioTitle: 'About Me',
        bioText1: 'Hello! I\'m Alexander — a beatmaker, audio technician, and sound engineer based in Moscow. My background spans working with both analog and digital consoles across live concert setups and studio sessions. I\'ve managed broadcast sound for live streams and collaborated with labels and communities such as PRO BATTLE League, Underground Amplitude, and others.',
        bioText2: 'I\'ve trained under renowned audio engineers including John Olin, Konstantin Matafonov, Ilya Lukashev, Pavel Wallen, and more.',
        bioText3: 'I would be happy to work with you!',
        stat1Num: '200+',
        stat1Text: 'Tracks Mixed & Mastered',
        stat2Num: '6+ Years',
        stat2Text: 'Studio Experience',
        stat3Num: '100%',
        stat3Text: 'Radio & Streaming Ready',
        btnFaqWhy: 'Why choose me?',
        btnFaqWorkflow: 'How does the process work?',
        btnDiscuss: 'Discuss Project',
        btnDemos: 'Hear A/B Demos'
      },

      // Page metadata: title and meta description are set per language
      // by script.js → updateDocumentMeta(). og:*/twitter:* are static and bilingual.
      meta: {
        title: 'Nick Rise Studio — Professional Mixing & Mastering',
        description: 'Premium mixing and mastering by Nick Rise. Analog SSL, Neve and Tube-Tech sound, mastered to Spotify, Apple Music and radio standards.'
      },

      // Tooltip and aria-label captions (data-i18n-title / data-i18n-aria-label attributes).
      a11y: {
        mixerStrip: 'Interactive SSL mixer strip',
        aboutTitle: 'About Me // Nick Rise',
        aboutAria: 'About Me - Nick Rise Studio',
        aboutPhoto: 'Click to learn more about me',
        prev: 'Previous',
        next: 'Next',
        close: 'Close',
        backToTop: 'Back to top'
      }
    }
  },

  // Треки для A/B плеера: id, язык (lang), видимость (enabled), подписи и обложка.
  tracks: [
    {
      id: 'track-2',
      lang: 'en',
      enabled: true,
      title: 'Masochist',
      artist: 'Ellise',
      genre: 'pop-house',
      genreLabel: 'Pop Dark',
      audioBefore: './audio/en/(P) Pop Dark before (Ellise - Masochist).mp3',
      audioAfter: './audio/en/(P) Pop Dark after (Ellise - Masochist).mp3',
      cover: './image/image_Ellise_Masochist.webp'
    },
    {
      id: 'track-1',
      lang: 'en',
      enabled: true,
      title: 'Into The Fire',
      artist: 'Asking Alexandria',
      genre: 'rock-metal',
      genreLabel: 'Metal',
      audioBefore: './audio/en/(M) Metal before (Asking Alexandria - Into The Fire).mp3',
      audioAfter: './audio/en/(M) Metal after (Asking Alexandria - Into The Fire).mp3',
      cover: './image/Image_AskingAlexandria_IntoTheFire.webp'
    },
    {
      id: 'track-3',
      lang: 'en',
      enabled: true,
      title: 'Dark Horses',
      artist: 'The Long Wait',
      genre: 'rock-metal',
      genreLabel: 'Rock Country',
      audioBefore: './audio/en/(M) Rock Country before (The Long Wait - Dark Horses).mp3',
      audioAfter: './audio/en/(M) Rock Country after (The Long Wait - Dark Horses).mp3',
      cover: './image/image_TheLongWait_DarkHorses.webp'
    },
    {
      id: 'track-4',
      lang: 'en',
      enabled: true,
      title: 'Teleport',
      artist: 'TytillidieXXollin',
      genre: 'rap-rnb',
      genreLabel: 'Rap',
      audioBefore: './audio/en/(R) Rap before (TytillidieXXollin - Teleport).mp3',
      audioAfter: './audio/en/(R) Rap after (TytillidieXXollin - Teleport).mp3',
      cover: './image/image_TytillidieXXollin_Teleport.webp'
    },
    {
      id: 'track-ru-1',
      lang: 'ru',
      enabled: true,
      title: 'Последняя мятная',
      artist: 'SIMA',
      genre: 'pop-house',
      genreLabel: 'Pop Lyric',
      audioBefore: './audio/ru/(P) Pop Lyric before (SIMA - Последняя мятная).mp3',
      audioAfter: './audio/ru/(P) Pop Lyric after (SIMA - Последняя мятная).mp3',
      cover: './image/image_SIMA_ПоследняяМятная.webp'
    },
    {
      id: 'track-ru-2',
      lang: 'ru',
      enabled: true,
      title: 'Lets Go',
      artist: 'None',
      genre: 'pop-house',
      genreLabel: 'Pop UK',
      audioBefore: './audio/ru/(P) Pop UK before (None - Lets Go).mp3',
      audioAfter: './audio/ru/(P) Pop UK after (None - Lets Go).mp3',
      cover: './image/!image_none.jpg'
    },
    {
      id: 'track-ru-3',
      lang: 'ru',
      enabled: true,
      title: 'Титры',
      artist: 'Solvada',
      genre: 'rap-rnb',
      genreLabel: 'Rap',
      audioBefore: './audio/ru/(R) Rap before (Solvada - Титры).mp3',
      audioAfter: './audio/ru/(R) Rap after (Solvada - Титры).mp3',
      cover: './image/!image_none.jpg'
    },
    {
      id: 'track-ru-4',
      lang: 'ru',
      enabled: true,
      title: 'Savage',
      artist: 'None',
      genre: 'rap-rnb',
      genreLabel: 'Rap Lyric',
      audioBefore: './audio/ru/(R) Rap Lyric before (None - Savage).mp3',
      audioAfter: './audio/ru/(R) Rap Lyric after (None - Savage).mp3',
      cover: './image/!image_none.jpg'
    },
  ],
  servicesData: [
    {
      id: 'mixing',
      isPopular: false,
      titleRu: 'Сведение Мультитрека',
      titleEn: 'Multitrack Mixing',
      descRu: 'Идеальный баланс, глубина и мощь. Микс, который звучит дорого и готов к мастерингу.',
      descEn: 'Perfect balance, depth, and punch. A mix that sounds premium and is ready for mastering.',
      priceRu: 'от 3 500 ₽',
      priceEn: 'from $110',
      featuresRu: [
        'Обработка до 20 мультитрек-дорожек',
        'Ручной тюнинг и ритмическая коррекция вокала',
        '3 бесплатные итерации правок',
        'Стерео WAV (32-bit) + Минус и Акапелла'
      ],
      featuresEn: [
        'Up to 20 tracks processed',
        'Manual vocal tuning & timing correction',
        '3 complimentary revision rounds',
        'Stereo WAV (32-bit) + Instrumental & Acapella'
      ]
    },
    {
      id: 'mix-master',
      isPopular: true,
      titleRu: 'Сведение + Мастеринг (Полный пакет)',
      titleEn: 'Mixing + Mastering (Full Package)',
      descRu: 'От мультитреков до готового релиза. Всё в одном пакете. Громкий, сбалансированный трек за 3 дня.',
      descEn: 'From raw multitracks to a release-ready master. All in one package. Loud, balanced track in 3 days.',
      priceRu: 'от 5 500 ₽',
      priceEn: 'from $150',
      featuresRu: [
        'Всё, что входит в «Сведение»',
        'Всё, что входит в «Мастеринг»',
        'Обработка до 40 мультитрек-дорожек',
        'Приоритетный срок выполнения (до 3 дней)'
      ],
      featuresEn: [
        'Everything from the Mixing package',
        'Everything from the Mastering package',
        'Up to 40 tracks processed',
        'Priority turnaround (up to 3 days)'
      ]
    },
    {
      id: 'mastering',
      isPopular: false,
      titleRu: 'Стерео Мастеринг',
      titleEn: 'Stereo Mastering',
      descRu: 'Финальная полировка. Ширина, глубина и громкость под ваш референс. Готово для всех стримингов.',
      descEn: 'Final polish. Width, depth, and loudness matched to your reference. Ready for all streaming platforms.',
      priceRu: 'от 2 000 ₽',
      priceEn: 'from $40',
      featuresRu: [
        'Контроль микса на студийных и бытовых системах',
        'Коррекция частотного баланса и динамики',
        'Контроль Mid-Side составляющей микса',
        'Готовые файлы для всех стримингов'
      ],
      featuresEn: [
        'Playback check on studio monitors and consumer sound systems',
        'Frequency balance & dynamics control',
        'Mid/Side balance control',
        'Distribution-ready streaming masters'
      ]
    }
  ],

  // Данные калькулятора стоимости услуг (окно «Рассчитать стоимость услуг»).
  // Длительность: 1 мин и 6+ мин считаются индивидуально (individual: true).
  // Цены: RU — рубли, EN — доллары (шкала согласована с карточками услуг).
  priceCalc: {
    defaultMinutes: 3,
    durations: [
      { minutes: 1, label: '1', individual: true },
      { minutes: 2, label: '2', priceRu: 3500, priceEn: 110 },
      { minutes: 3, label: '3', priceRu: 3500, priceEn: 110 },
      { minutes: 4, label: '4', priceRu: 4000, priceEn: 120 },
      { minutes: 5, label: '5', priceRu: 4500, priceEn: 130 },
      { minutes: 6, label: '6+', individual: true }
    ],
    options: [
      { id: 'mastering', priceRu: 2000, priceEn: 40 },
      { id: 'vocalRhythm', priceRu: 1000, priceEn: 20 },
      { id: 'trackout', priceRu: 1000, priceEn: 20 },
      { id: 'vocalNotes', priceRu: 1500, priceEn: 30 }
    ]
  },

  faqData: [
    {
      qRu: 'Почему стоит выбрать именно меня?',
      qEn: 'Why choose me?',
      aRu: 'Мой опыт — это не только 6+ лет сведения и мастеринга, но и написания аранжировок. Благодаря этому я могу и контролировать качество на всех этапах создания музыки и давать советы по его улучшению.<br/><br/>Я не просто делаю «громко и чисто». Я слышу трек целиком и понимаю, что нужно именно вашему жанру, настроению и материалу. Вы получаете не просто сведение, а профессиональный взгляд на ваш трек со всех сторон.<br/><br/>Моя задача — чтобы ваш трек звучал на уровне мировых релизов, был конкурентным на стримингах и цеплял слушателя с первой секунды.' + FAQ_PROMO_RU,
      aEn: 'My background spans not only 6+ years of mixing and mastering, but also music arrangement. This allows me to maintain quality control at every stage of music production and provide expert guidance to elevate your sound.<br/><br/>I don\'t just make tracks "loud and clean." I hear the big picture and know exactly what your specific genre, mood, and material need. You get more than just a mix — you get a comprehensive, professional perspective on your music.<br/><br/>My goal is to make your track sound stand alongside world-class releases, remain competitive across all streaming platforms, and hook the listener from the very first second.' + FAQ_PROMO_EN
    },
    {
      qRu: 'Как происходит процесс работы?',
      qEn: 'How does the process work?',
      aRu: 'Весь процесс делится на 4 этапа:<br/><br/>1 - Заявка и ТЗ. Вы присылаете мультитреки, референсы и техническое задание (как его правильно оформить, смотрите в следующем вопросе).<br/><br/>2 - Старт. Я слушаю материал, называю цену и срок. После вашей 50% предоплаты начинаю работу.<br/><br/>3 - Черновой микс и правки. Через 2–3 дня вы получаете MP3-черновик. Слушаете, пишете замечания. Я вношу правки (до 3-х итераций включительно).<br/><br/>4 - Финал. После утверждения микса вы оплачиваете оставшиеся 50%, я делаю мастеринг и отправляю готовые WAV и MP3 файлы.' + FAQ_PROMO_RU,
      aEn: 'The process is divided into 4 stages:<br/><br/>1 - Request & Brief. You send multitracks, reference tracks, and technical requirements (see the next question for details).<br/><br/>2 - Kickoff. I listen to your material, provide a quote, and set a completion date. Work begins once a 50% deposit is made.<br/><br/>3 - Draft Mix & Revisions. Within 2–3 days, you receive an MP3 preview. You listen and provide feedback, and I apply your adjustments (up to 3 revision rounds included).<br/><br/>4 - Final Delivery. Once the mix is approved, you pay the remaining 50%. I complete the final mastering and deliver your WAV and MP3 files.' + FAQ_PROMO_EN
    },
    {
      qRu: 'Как правильно оформить Техническое Задание?',
      qEn: 'How do I prepare a Technical Brief?',
      aRu: 'Максимально подробно опишите ваше видение финального результата:<br/><br/>1 - Референсы. 2–3 трека других исполнителей файлом (или ссылкой), чей звук вам нравится. Это может быть бас из одного трека, вокал из другого, общая атмосфера из третьего. Я слушаю и понимаю, куда двигаться.<br/><br/>2 - Характер и описание. Подробно опишите, как вы видите финальный результат: что вы точно хотите сохранить или наоборот убрать. Например, чтобы вокал звучал ближе, а барабаны мощнее. Расскажите про энергетику трека, какие моменты должны цеплять слушателя в первую очередь.<br/><br/>3 - Дополнительная информация. Если есть что-то важное, что я должен знать о записи: например, трек записан в домашних условиях, есть шумы или артефакты, которые вы не можете перезаписать. Или, наоборот, вы гордитесь какой-то партией и хотите, чтобы она звучала ярко. Также укажите, если у вас есть дедлайн — я учту это при планировании работы.' + FAQ_PROMO_RU,
      aEn: 'Describe your vision for the final result in as much detail as possible:<br/><br/>1 - References. Send 2–3 tracks by other artists as files (or links) whose sound you admire. It could be the bass from one track, the vocal treatment from another, or the general vibe from a third. This helps me understand the target sonic direction.<br/><br/>2 - Character & Description. Detail what you want to achieve: what to preserve or remove. For instance, if you want vocals upfront or drums punchier. Explain the track\'s energy and which elements should grab the listener\'s attention first.<br/><br/>3 - Additional Info. Mention anything critical about the recording: e.g., if it was recorded at home with background noise or artifacts you can\'t re-record. Conversely, highlight any specific parts you\'re proud of and want featured prominently. Please mention if you have a tight deadline so I can plan accordingly.' + FAQ_PROMO_EN
    },
    {
      qRu: 'Входят ли в стоимость правки?',
      qEn: 'Are revisions included in the price?',
      aRu: 'Да, в стоимость входит 3 итерации правок.<br/><br/>Это означает, что после получения чернового микса вы можете прислать список замечаний. Я вношу правки, вы слушаете обновлённую версию и при необходимости отправляете новый список. Так до трёх раз.<br/><br/>Важные правила:<br/><br/>1 - Замечания лучше присылать одним общим списком, а не по одному сообщению в день, при надобности указывайте чёткие тайминги, куда нужно вносить правку. Так мы не тратим время зря.<br/><br/>2 - Если после трёх итераций вы всё ещё недовольны — дальнейшие правки оплачиваются отдельно: одна итерация правок — 500₽.' + FAQ_PROMO_RU,
      aEn: 'Yes, the price includes 3 rounds of revisions.<br/><br/>This means after receiving the initial draft, you can send a list of feedback. I update the mix, you review the new version, and if necessary, submit another list — up to three times.<br/><br/>Important Guidelines:<br/><br/>1 - Please consolidate your feedback into a single organized list (with specific timestamps where adjustments are needed) rather than sending separate messages daily. This saves valuable time.<br/><br/>2 - If additional revisions are needed after 3 rounds, further changes are billed separately at $10 per revision round.' + FAQ_PROMO_EN
    },
    {
      qRu: 'Какой срок выполнения заказа?',
      qEn: 'What is the estimated turnaround time?',
      aRu: 'Стандартный срок — от 3 до 5 рабочих дней на один трек.<br/><br/>Время зависит от количества дорожек и сложности материала. Точную дату я называю после того, как послушаю ваши мультитреки.<br/><br/>Если нужно быстрее — я могу сделать трек за 24–48 часов. Стоимость срочного заказа увеличивается на 5000₽.' + FAQ_PROMO_RU,
      aEn: 'Standard turnaround is from 3 to 5 business days per track.<br/><br/>Delivery time depends on track count and complexity. I will provide an exact timeframe after reviewing your multitrack stems.<br/><br/>If you are in a rush, express delivery (24–48 hours) is available with a $100 rush fee.' + FAQ_PROMO_EN
    },
  ],

  /* ── Отзывы (секция #reviews) ──────────────────────────────────────────
     Структура одного отзыва:
       name     — имя автора: показывается как есть в обеих версиях сайта
                  (имена не переводим);
       url      — ссылка на страницу автора (открывается в новой вкладке);
       avatar   — фото: ссылка на превью (у VK-ссылок это cs=96x0 в хвосте);
       textRu / textEn — текст отзыва. Английский — перевод, поэтому в
                  EN-версии под текстом стоит пометка reviews.translated.
     Порядок в массиве = исходный порядок отзывов: чётные отзывы уходят в
     верхнюю бегущую ленту, нечётные — в нижнюю (script.js → renderReviews()). */
  reviewsData: [
    {
      name: 'Артём Фартович',
      url: 'https://vk.ru/gel_genius',
      avatar: 'https://sun9-7.vkuserphoto.ru/s/v1/ig2/Bo9VjgKxm4SjIk6M3rSmVuRTc5hQgglOxHGSJSJy8Mj6UJtrnlzI6eqSAIb8JMvOie64SgC7IdPR2L9oEpCSVlF9.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080,1280x1280,1440x1440,2048x2048&from=bu&cs=96x0',
      textRu: 'Делаем с ником уже несколько месяцев треки,пока только начинаем понимать друг друга,что я хочу и как я это вижу и как видит он это (мне важно услышать мнение человека у которого опыта много лет),поэтому мы работаем уже несколько месяцев и будем работать дальше. Уникальный звукоинженер,ко всем найдет подход и всегда всех услышит+на своем опыте предложит что то свое(в лучшую сторону естественно)🕊🤝',
      textEn: 'We\'ve been making tracks together for a few months now, and we\'re only starting to understand each other — what I want, how I see it and how he sees it (it matters to me to hear the opinion of someone with many years of experience), so we\'ve been working together for several months and will keep going. A unique sound engineer: he finds an approach to everyone, always listens to you, and from his own experience suggests something of his own (for the better, of course)🕊🤝'
    },
    {
      name: 'Артур Голдин',
      url: 'https://vk.ru/needrate',
      avatar: 'https://sun9-3.vkuserphoto.ru/s/v1/ig2/rEbob754vbaQsMUdXUfhQTF5CNQjV4AIzGPUJOcH2rYYWcCLkpwXdgd2fpwETdPhqAfQq5m4DmJmT8Dd1UpE0f-1.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,960x960&from=bu&cs=96x0',
      textRu: 'Ник максимально заинтересован в том, чтобы работа удовлетворила и задает правильные вопросы. Понимание и реализация твоих пожеланий происходит очень быстро, с первого раза. При этом может предложить что-то свое и это с большой долей вероятности тебе понравится! Заточен на взаимопонимание, а именно поэтому работа будет 100% качественной и более чем удовлетворительной. Рекомендация безоговорочная 👍',
      textEn: 'Nick is genuinely invested in making sure the work satisfies you, and he asks the right questions. He understands and implements your wishes very fast, right from the first try. At the same time he can suggest something of his own, and chances are you\'ll love it! He\'s all about mutual understanding — which is exactly why the work comes out 100% quality and more than satisfactory. Unconditional recommendation 👍'
    },
    {
      name: 'Руслан Беспяткин',
      url: 'https://vk.ru/deadboyclub_official',
      avatar: 'https://sun9-58.vkuserphoto.ru/s/v1/ig2/XEPoPdqYh9KWu-6aVI4vaTjAg6HgAHIotM7u_Z_Rt819-I_oyZMNvHYxoq7RWQTjgwDGXCgm0fhNlatt8tvHer2c.jpg?quality=95&as=32x31,48x46,72x69,108x103,160x153,240x230,360x345,480x460,540x517,640x613,720x689,750x718&from=bu&cs=96x0',
      textRu: 'Парень-мастер своего дела, работой остался доволен, всегда подсказывал, инициативу проявлял. Отвечает всегда быстро и по делу, никогда не игнорил, списывается даже на не рабочие темы. Ник-профессионал в своем деле, советую каждому с ним поработать!)',
      textEn: 'The guy is a true master of his craft. I was happy with the work: he always gave advice and took initiative. He always replies fast and to the point, never ignores you, and will even chat about non-work stuff. Nick is a professional in his field — I recommend everyone work with him!)'
    },
    {
      name: 'Валерий Шакиров',
      url: 'https://vk.ru/tungaionga',
      avatar: 'https://sun9-58.vkuserphoto.ru/s/v1/ig2/JS0qE2oT8qERSBLYJo21D394G9ItTDbyoqleXenC0GI2l67iVr378baxJRWbMOCcf4z1NPSkHdqmwqUJJjblWdrl.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x299,360x449,480x599,540x673,640x798,720x898,749x934&from=bu&cs=96x0',
      textRu: 'Работаю с Ником не первый месяц, каждый раз остаюсь доволен, своих денег работа точно стоит, но больше подмечу креативный подход в разным моментах работы, свои фишки, недостоющим музыкантам неких тонкостей в создании песни, точно сюда. А так, пока не попробуешь, не узнаешь, твой ли это звукорежиссер) Мир 😌',
      textEn: 'I\'ve been working with Nick for more than a month now, and I\'m happy every single time. The work is definitely worth the money, but what I\'d highlight most is the creative approach at different stages of the job, his own little tricks — musicians who are missing certain finer points of song creation, come here. Otherwise you won\'t know if he\'s your sound engineer until you try) Peace 😌'
    },
    {
      name: 'Иман Мамедов',
      url: 'https://vk.ru/holdthesnow',
      avatar: 'https://sun9-31.vkuserphoto.ru/s/v1/ig2/riZtq12XTHE15duFY9Xc0988GOHyu3h7r-CEKuWKuMFFhlWSyViyuQP9gLCUrlCK1C6LcMRRt8WKvmplqcBpcKSi.jpg?quality=95&as=32x45,48x68,72x102,108x152,160x226,240x339,360x508,480x678,540x763,640x904,720x1017,1080x1525,1223x1727&from=bu&cs=96x0',
      textRu: 'Звукорежиссер придумывает авторские фишки в проекте, который сводит, а также доводит качество звука до максимума, используя всё то, что знает и умеет. По необходимости ответственно подходит к внесению правок, если ты в состоянии их грамотно сформулировать. Рекомендую, здесь работают по совести и от сердца.',
      textEn: 'The sound engineer comes up with his own signature touches in the project he\'s mixing, and he pushes the sound quality to the max, using everything he knows and can do. When needed, he takes revisions seriously — as long as you\'re able to formulate them clearly. I recommend him: here they work honestly and from the heart.'
    },
    {
      name: 'Владимир Битков',
      url: 'https://vk.ru/mir_podbit_99',
      avatar: 'https://sun9-58.vkuserphoto.ru/s/v1/ig2/dnxul9x-BzpE8EJ0k3dyjnWsJm9mMvefWAUkFh2bmU9H8YcFbbJjJO55FowucRNTw52je91os556MhTNsWDTAOL7.jpg?quality=96&as=32x48,48x72,72x108,108x162,160x240,240x359,360x539,480x719,540x809,640x959,720x1078,1080x1618,1280x1917,1440x2157,1442x2160&from=bu&cs=96x0',
      textRu: 'Отзывчивый внимательный человек. Не забивает болт, а подсказывает как улучшить качество записи. Делает свое дело, респект за работу 👍',
      textEn: 'A responsive and attentive person. He doesn\'t blow you off — he tells you how to improve your recording quality. He does his job. Respect for the work 👍'
    },
    {
      name: 'Трамс Трамс',
      url: 'https://vk.ru/id239096362',
      avatar: 'https://sun9-5.vkuserphoto.ru/s/v1/ig2/tQUYyCh95EPZ0KiBSHl7FBc-7BkP5SEM5h7j1yj83-AN0_k0rMMN3yEbCiPNPYMa328x6mAnKxwH6EoEYscRpPBa.jpg?quality=95&as=32x35,48x52,72x78,108x117,160x173,240x260,360x389,480x519,540x584,640x692,720x779,1080x1168,1280x1384,1440x1557,1595x1725&from=bu&cs=96x0',
      textRu: 'Качественно свёл и довёл до ума сырой продукт 10/10',
      textEn: 'Mixed it with quality and polished the raw product to perfection 10/10'
    },
    {
      name: 'Эльдар Хисматуллин',
      url: 'https://vk.ru/hismaruu',
      avatar: 'https://sun9-3.vkuserphoto.ru/s/v1/ig2/BO3Ws9nzbhSoZqs9K0r0hmoCNfbu7-vIJWGBfQdlMiKEUNXBhIQ3kK7apVkLGAy_-mKu2q8co4iYQ4BNQoraqmhP.jpg?quality=95&as=32x28,48x42,72x63,108x94,160x139,240x209,360x313,480x418,540x470,640x557,720x626,1080x940,1280x1114,1440x1253&from=bu&cs=96x0',
      textRu: 'Наконец-то я его нашел, сделал все качественно, прям как хотел, хотя даже не объяснял чего хочу 😁 очень доволен , теперь я тут постоянный клиент )',
      textEn: 'I finally found him. He did everything with quality, exactly how I wanted — even though I never even explained what I wanted 😁 Very happy, I\'m a regular client here now )'
    },
    {
      name: 'Emil Che',
      url: 'https://vk.ru/blckdhood_q',
      avatar: 'https://sun9-10.vkuserphoto.ru/s/v1/ig2/2TB9Wrs05vLvuSvrjTk8WcobZpX4MqtwVLX34kRCaOwKQqC2rnZ8yry3yg7V-GyDWtArshHcjphimDR_VS3MNN4B.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640&from=bu&cs=96x0',
      textRu: 'Он действительно делает то что нужно🔥 Если где-то что-то не так подскажет) Обращайтесь не пожалеете',
      textEn: 'He really does what\'s needed🔥 If something is off somewhere, he\'ll point it out) Get in touch, you won\'t regret it'
    },
    {
      name: 'Олег Ломтев',
      url: 'https://vk.ru/kt0_g0v0rit',
      avatar: 'https://sun9-10.vkuserphoto.ru/s/v1/ig2/tsFiJSjymzIMYmCENOJ8GJfSWDKQ33hupKdm-4doc0NWsce4EFOET8u6Qopjfupci_rmCywLmjDJO1wpqqscEtxC.jpg?quality=95&as=32x32,48x47,72x71,108x107,160x158,240x237,360x356,480x474,540x534,640x632,720x711,1000x988&from=bu&cs=96x0',
      textRu: 'Я балдею. Это высший пилотаж. Ник реально знает свое дело. Этот Мужик, с большой буквы, настоящий колдун. Гарри Гудини нервно курит в сторонке. Он помог вывести трек на совершенно иной уровень. Если вам нужен адекватный звукорежиссер, который выслушает ваши пожелания и накинет, при необходимости, своих СВЕЖИХ идей - то вы по адресу. Подведу итоги. Николаса предлагаю возвести в лик святых, отдать ему грэмми и ежегодно проводить праздник в его честь во всем мире. У меня все. Спасибо! Ник, ты лучший!',
      textEn: 'I\'m blown away. This is top-class work. Nick really knows his craft. This man — with a capital M — is a real wizard. Harry Houdini is nervously smoking on the sidelines. He helped take the track to a completely different level. If you need an adequate sound engineer who will listen to your wishes and, when needed, throw in his own FRESH ideas — you\'re in the right place. To sum up: I suggest we canonize Nicholas, hand him a Grammy and hold a worldwide holiday in his honor every year. That\'s all from me. Thank you! Nick, you\'re the best!'
    },
    {
      name: 'Kira Daon',
      url: 'https://vk.ru/kira_daon',
      avatar: 'https://sun9-79.vkuserphoto.ru/s/v1/ig2/I0KSBgcM0y7qV7HiHUjHpZ1AgNJ3KnrlaX_V4rNNScFqON3K29v5EFUo9Vtxz_T_B5nZRggKr75Hn3IoGHIYO_gH.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x539,640x639,720x719,1069x1068&from=bu&cs=96x0',
      textRu: 'Послушал песню, похвалил 😱 и дал советы? Да ещё и поделился интересным контентом по теме?😳 Приятное знакомство, удачи студии и его участникам от группы Sphecidae Ltd.!',
      textEn: 'He listened to the song, praised it 😱 and gave advice? And even shared some interesting content on the subject?😳 A pleasant acquaintance. Good luck to the studio and its members from the band Sphecidae Ltd.!'
    },
    {
      name: 'Евгений Вохманов',
      url: 'https://vk.ru/fakehoodo',
      avatar: 'https://sun9-69.vkuserphoto.ru/s/v1/ig2/TVDS-8kSAZbNCutdS2yi3u5RB02ao5muP-2zWH4jt60_uWoRej0PbfXfj-OfTGFU0lPTP-3vMAKHWpqtXEQuO-VG.jpg?quality=95&as=32x40,48x60,72x90,108x135,160x200,240x300,360x450,480x600,540x675,640x800,720x900,1080x1350,1280x1600,1440x1800,1536x1920&from=bu&cs=96x0',
      textRu: 'Огромный респект, знает своё дело 🤙🏻🔥',
      textEn: 'Huge respect, he knows his craft 🤙🏻🔥'
    },
    {
      name: 'Виталий Витальев',
      url: 'https://vk.ru/lunatictonight',
      avatar: 'https://sun9-82.vkuserphoto.ru/s/v1/ig2/gSKPMo6Xz5Q0wJmX_bv-o_Lb2Bc1FhSeUbkL5GacGiiJtqAdwAMKX7fGejSXKEBcfMcF-Szf0LEp-kr1RTpBgQzM.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080,1200x1200&from=bu&cs=96x0',
      textRu: 'Огонь🔥',
      textEn: 'Fire🔥'
    },
    {
      name: 'Надежда Придёт',
      url: 'https://vk.ru/nadezhdapridetlabel',
      avatar: 'https://sun9-39.vkuserphoto.ru/s/v1/ig2/xdzBCY-m-tccwauzDHKVqhZszaPbRq4VB-g67xCVrs_vL6Fb6-hSzkOpr7MmcUYxV1gFzNlquvLlzD_NDOQAIQc-.jpg?quality=95&as=32x31,48x47,72x71,108x106,160x157,240x235,360x353,480x470,540x529,640x627,720x705,1080x1058,1125x1102&from=bu&cs=96x0',
      textRu: 'Интересная обработка. Мне понравилась работа, очень быстро сделал 👍🏻❤🔥',
      textEn: 'Interesting treatment. I liked the work, he did it very fast 👍🏻❤🔥'
    },
    {
      name: 'Иван Терсков',
      url: 'https://vk.ru/montesori2013',
      avatar: 'https://sun9-68.vkuserphoto.ru/s/v1/ig2/e2avKCvjT4ZhpzKkhNjUitW6Z5jP7jnRiBM6GVitbjT-vjSXCrtr1hMyxqxZEh9WISx4qkDdUpf9fPJ4ZWtwYuQa.jpg?quality=95&as=32x43,48x64,72x96,108x144,160x213,240x320,360x480,480x640,540x720,640x853,720x960,1080x1440,1280x1707,1440x1920,1920x2560&from=bu&cs=96x0',
      textRu: 'Этот человек, сделал просто мощнейшую пушку, бля, однозначно знает что и как нужно!!!!! Респект!!!!',
      textEn: 'This guy made an absolutely killer banger, damn, he definitely knows what and how it should be done!!!!! Respect!!!!'
    },
    {
      name: 'Даниил Ломейко',
      url: 'https://vk.ru/lom_0_9',
      avatar: 'https://sun9-41.vkuserphoto.ru/s/v1/ig2/xp0XyjkExJU4wMF-t8C34ZKWjf5yvZDNU9Gxuc_LSL3Uf18-YKMXopAfe3k94o-an6nVrGqkJvE81MflsG2_o69b.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080,1280x1280&from=bu&cs=96x0',
      textRu: 'Хорошая работа🔥',
      textEn: 'Good work🔥'
    },
    {
      name: 'Владислав Иларионов',
      url: 'https://vk.ru/vladbezdat',
      avatar: 'https://sun9-26.vkuserphoto.ru/s/v1/ig2/JNPzt6IfKwFMig9k_d-ruNUX3IbkIlQgEU9avK3G4MyzQe-LNYpxBGQ8d6HJKoYMoK0Lb478vRR13-sg_z2V78l4.jpg?quality=95&as=32x43,48x65,72x98,108x147,160x217,240x326,360x488,480x651,540x733,640x868,720x977,1080x1465,1280x1737,1440x1954,1887x2560&from=bu&cs=96x0',
      textRu: 'Работаю уже на постоянке с автором, очень сговорчив, вежлив и профессионален. На заказ сделает, что хотите)',
      textEn: 'I already work with the author on a regular basis — he\'s very accommodating, polite and professional. He\'ll make whatever you order)'
    },
    {
      name: 'Антон Федосов',
      url: 'https://vk.ru/afamc',
      avatar: 'https://sun9-41.vkuserphoto.ru/s/v1/ig2/vNalbdAburNgwytOTJllGsSCTonJHBi8oV14y3jOwHLgBdBzomPWE6WrRwGV2obFP-KaR4l6r4C4oMYe4F96WVzn.jpg?quality=95&as=32x48,48x72,72x108,108x162,160x240,240x360,360x540,480x720,540x810,640x960,720x1080,1080x1621,1280x1921,1440x2161,1706x2560&from=bu&cs=96x0',
      textRu: 'Парень знает своё дело, респект! Хорошо, качественно свёл трек 🤝 Смело обращайтесь, рекомендую !',
      textEn: 'The guy knows his craft, respect! He mixed the track well and with quality 🤝 Reach out without hesitation, I recommend him!'
    },
    {
      name: 'Артём Фирсов',
      url: 'https://vk.ru/firsov998',
      avatar: 'https://sun9-20.vkuserphoto.ru/s/v1/ig2/QLUoqF1zOeuTK6HCgBL1luEBcJXQCiRNbNBr1ogH7EUngGv_hk6v-PcBkWVhAtAK-d3DdZfJihr6RLy4FDEH-irF.jpg?quality=95&as=32x57,48x85,72x127,108x191,160x283,240x425,360x637,480x850,540x956,640x1133,720x1275,768x1360&from=bu&cs=96x0',
      textRu: 'Спасибо Ник, очень общительный и хорошо делает свою работу🙂',
      textEn: 'Thanks Nick, very communicative and does his job well🙂'
    },
    {
      name: 'Алекс Лобанов',
      url: 'https://vk.ru/chego_blyea',
      avatar: 'https://sun9-33.vkuserphoto.ru/s/v1/ig2/wISEs8lm_Dg1B3JaHJLBeJkRV2RXvDYbNE-y_VdLxAN42vCBBYPpCjNDXVeGUuct9r3ElkgzuSIV39rNALVI-zuD.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080,1280x1280,1440x1440,2020x2020&from=bu&cs=96x0',
      textRu: 'Очень интересное сведение, звукер чувствует и создаёт очень классную атмосферу, респектов!',
      textEn: 'A very interesting mix — the sound guy feels and creates a really cool atmosphere, respect!'
    },
    {
      name: 'Тимур Чмара',
      url: 'https://vk.ru/timurchmara',
      avatar: 'https://sun9-70.vkuserphoto.ru/s/v1/ig2/Re0zNQH71hR8QqWwCQjKy9Yh2n8QdtHI4yiw26pF04cErF7mAli1lyje31xa1fEi8VqOiS0QX5xV1N17Fx5LEpLj.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640,720x720,1080x1080,1280x1280&from=bu&cs=96x0',
      textRu: 'Спасибо Ник, отличная проработка песни и качество!',
      textEn: 'Thanks Nick, excellent song work and quality!'
    },
    {
      name: 'Егор Абрамов',
      url: 'https://vk.ru/hurdleast',
      avatar: 'https://sun9-19.vkuserphoto.ru/s/v1/ig2/Ys2h1Jun2eTxcIuSLlhgmBe9AlIDTVbEBe_td8yraHSWXYIFg1CZ9YfNnBiMpLYlTZDsdYoy_lydMv-2UEah-UFt.jpg?quality=95&as=32x48,48x72,72x108,108x162,160x240,240x360,360x540,480x720,540x810,640x960,720x1080,1080x1620,1280x1920,1440x2160&from=bu&cs=96x0',
      textRu: 'Идеальное соотношение цены и качества, оперативное обслуживание. Рекомендую к сотрудничеству',
      textEn: 'A perfect price-to-quality ratio with prompt service. I recommend him for collaboration'
    },
    {
      name: 'Ульяна Крус',
      url: 'https://vk.ru/ulyana.krus',
      avatar: 'https://sun9-46.vkuserphoto.ru/s/v1/ig2/J-na76dck2CZI75JIBPGGAKUVW314A-DELlUdyur7v6ZBPYKQk7bQyBGo7y3sQRuL6vHuTXWUFU1YICvZ1xTp-P3.jpg?quality=95&as=32x32,48x48,72x72,108x108,160x160,240x240,360x360,480x480,540x540,640x640&from=bu&u=7kPwDYxswLw6B4FyK6855GZeAMYZpfmAOxKwA1WcFtk&cs=96x0',
      textRu: 'ааааа, это просто пушка!!!! офигенный, талантливый человечек! ТОЛЬКО у него заказывать! реально круто))))))))',
      textEn: 'aaah, this is just a banger!!!! an awesome, talented guy! Order ONLY from him! really cool))))))))'
    },
    {
      name: 'Sirafim Sudnev',
      url: 'https://vk.ru/saimon_original',
      avatar: 'https://sun9-3.vkuserphoto.ru/s/v1/ig2/bWhR57sCwtD-sJCZ14Lch_AEkRDfMrTKCMFRMoQWZyRkOJCnJOE71Ee_Ie7MhhRdtzdxdB2X59iU7JRJtadtJE2Z.jpg?quality=95&as=32x43,48x64,72x96,108x144,160x213,240x320,360x480,480x640,540x720,640x853,720x960,1080x1440,1280x1707,1440x1920,1536x2048&from=bu&cs=96x0',
      textRu: 'Ваййй❤🔥❤🔥❤🔥 паблик ебейший !! Биты огонь🔥🔥❤ админ и автор🥰красавчик💋 буду работать дальше☺',
      textEn: 'Wooow❤🔥❤🔥❤🔥 the page is awesome!! The beats are fire🔥🔥❤ the admin and author🥰a stunner💋 I\'ll keep working with him☺'
    },
    {
      name: 'Иман Мамедов',
      url: 'https://vk.ru/holdthesnow',
      avatar: 'https://sun9-31.vkuserphoto.ru/s/v1/ig2/riZtq12XTHE15duFY9Xc0988GOHyu3h7r-CEKuWKuMFFhlWSyViyuQP9gLCUrlCK1C6LcMRRt8WKvmplqcBpcKSi.jpg?quality=95&as=32x45,48x68,72x102,108x152,160x226,240x339,360x508,480x678,540x763,640x904,720x1017,1080x1525,1223x1727&from=bu&cs=96x0',
      textRu: 'Работали с Ником около года назад, недавно снова списались… Пиздец. Таких boost’ов в качестве я не видел давно, при этом в общении и своём подходе к делу Ник остался таким же приятным и компетентным. Очень рекомендую!',
      textEn: 'We worked with Nick about a year ago, and recently got back in touch… Damn. I haven\'t seen such boosts in quality in a long time, and at the same time Nick has stayed just as pleasant and competent in communication and in his approach to the work. Highly recommend!'
    }
  ]
};
