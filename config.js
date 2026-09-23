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
        copyTgUsername: 'Копировать ТГ @Nick_Rise',
        copyEmail: 'Копировать Email',
        vkBtn: 'Профиль ВКонтакте',
        toastTgCopied: 'Никнейм @Nick_Rise скопирован!',
        toastEmailCopied: 'Email скопирован в буфер обмена!'
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
        copyTgUsername: 'Copy TG @Nick_Rise',
        copyEmail: 'Copy Email',
        vkBtn: 'VKontakte Profile',
        toastTgCopied: 'Username @Nick_Rise copied to clipboard!',
        toastEmailCopied: 'Email copied to clipboard!'
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
  ]
};
