/**
 * ============================================================================
 * NICK RISE STUDIO - НАСТРОЙКА КОНФИГУРАЦИИ И ТЕКСТОВ САЙТА
 * ============================================================================
 * 
 * ПОДДЕРЖКА 3-Х ВАРИАЦИЙ ТЕКСТА (КОМПЬЮТЕР / ПЛАНШЕТ / ТЕЛЕФОН):
 * 
 * Любое текстовое поле в конфиге представлено в 3-х вариациях:
 * {
 *   desktop: 'Текст для компьютеров и ноутбуков (от 1024px)',
 *   tablet:  'Текст для планшетов (от 768px до 1023px)',
 *   mobile:  'Текст для мобильных телефонов (до 767px)'
 * }
 * 
 * Вы можете редактировать текст для каждого устройства отдельно,
 * либо использовать одинаковый текст для всех трех.
 * ============================================================================
 */

const CONFIG = {
  i18n: {
    ru: {
      nav: {
        logoTitle: {
          desktop: 'Nick Rise Studio',
          tablet: 'Nick Rise Studio',
          mobile: 'Nick Rise Studio'
        },
        about: {
          desktop: 'Обо мне',
          tablet: 'Обо мне',
          mobile: 'Обо мне'
        },
        abPlayer: {
          desktop: 'Примеры A/B',
          tablet: 'Примеры A/B',
          mobile: 'Примеры A/B'
        },
        services: {
          desktop: 'Услуги',
          tablet: 'Услуги',
          mobile: 'Услуги'
        },
        faq: {
          desktop: 'FAQ',
          tablet: 'FAQ',
          mobile: 'FAQ'
        },
        contacts: {
          desktop: 'Контакты',
          tablet: 'Контакты',
          mobile: 'Контакты'
        },
        contactBtn: {
          desktop: 'Связаться',
          tablet: 'Связаться',
          mobile: 'Связаться'
        }
      },
      hero: {
        badge: {
          desktop: 'ANALOG HYBRID MIXING & MASTERING',
          tablet: 'ANALOG HYBRID MIXING & MASTERING',
          mobile: 'ANALOG HYBRID MIXING & MASTERING'
        },
        title: {
          desktop: 'Профессиональное<br>Сведение / мастеринг',
          tablet: 'Профессиональное<br>Сведение / мастеринг',
          mobile: 'Профессиональное<br><span class="whitespace-nowrap">Сведение / мастеринг</span>'
        },
        subtitle: {
          desktop: 'Специализация: Pop/House • Rock/Metal • Rap/R&B',
          tablet: 'Специализация: Pop/House • Rock/Metal • Rap/R&B',
          mobile: 'Pop/House • Rock/Metal • Rap/R&B'
        },
        usp: {
          desktop: 'Превращаю демо-записи и сырые мультитреки в мощный, объемный и конкурентоспособный звук мирового уровня. От первых тактов до финального мастера — каждый элемент на своем месте, каждая частота под контролем.',
          tablet: 'Превращаю демо-записи и сырые мультитреки в мощный, объемный и конкурентоспособный звук мирового уровня. От первых тактов до финального мастера — каждый элемент на своем месте, каждая частота под контролем.',
          mobile: 'Превращаю демо-записи и сырые мультитреки в мощный, объемный и конкурентоспособный звук мирового уровня. От первых тактов до финального мастера — каждый элемент на своем месте, каждая частота под контролем.'
        },
        btnPlayer: {
          desktop: 'Примеры работ (A/B)',
          tablet: 'Примеры работ (A/B)',
          mobile: 'Примеры работ (A/B)'
        },
        btnContact: {
          desktop: 'Контакты',
          tablet: 'Контакты',
          mobile: 'Контакты'
        },
        aboutPhotoBadge: {
          desktop: 'Обо мне',
          tablet: 'Обо мне',
          mobile: 'Обо мне'
        }
      },
      player: {
        sectionBadge: {
          desktop: 'A/B COMPARISON',
          tablet: 'A/B COMPARISON',
          mobile: 'A/B COMPARISON'
        },
        title: {
          desktop: 'Слушай разницу',
          tablet: 'Слушай разницу',
          mobile: 'Слушай разницу'
        },
        subtitle: {
          desktop: 'Переключайтесь на лету между необработанным миксом (BEFORE) и мастерингом мирового уровня (AFTER). Нажмите PLAY и проверьте разницу!',
          tablet: 'Переключайтесь на лету между необработанным миксом (BEFORE) и мастерингом мирового уровня (AFTER). Нажмите PLAY и проверьте разницу!',
          mobile: 'Переключайтесь на лету между необработанным миксом (BEFORE) и мастерингом мирового уровня (AFTER). Нажмите PLAY и проверьте разницу!'
        },
        filterAll: {
          desktop: 'Все жанры',
          tablet: 'Все жанры',
          mobile: 'Все жанры'
        },
        filterPopHouse: {
          desktop: 'Pop / House',
          tablet: 'Pop / House',
          mobile: 'Pop / House'
        },
        filterRockMetal: {
          desktop: 'Rock / Metal',
          tablet: 'Rock / Metal',
          mobile: 'Rock / Metal'
        },
        filterRapRnB: {
          desktop: 'Rap / R&B',
          tablet: 'Rap / R&B',
          mobile: 'Rap / R&B'
        },
        filterTrapHipHop: {
          desktop: 'Rap / R&B',
          tablet: 'Rap / R&B',
          mobile: 'Rap / R&B'
        },
        beforeLabel: {
          desktop: 'BEFORE (MIX)',
          tablet: 'BEFORE (MIX)',
          mobile: 'BEFORE (MIX)'
        },
        afterLabel: {
          desktop: 'AFTER (MASTERED)',
          tablet: 'AFTER (MASTERED)',
          mobile: 'AFTER (MASTERED)'
        },
        volumeLabel: {
          desktop: 'Громкость',
          tablet: 'Громкость',
          mobile: 'Громкость'
        },
        nowPlaying: {
          desktop: 'Сейчас играет:',
          tablet: 'Сейчас играет:',
          mobile: 'Сейчас играет:'
        },
        prevBtn: {
          desktop: 'Назад',
          tablet: 'Назад',
          mobile: 'Назад'
        },
        nextBtn: {
          desktop: 'Вперед',
          tablet: 'Вперед',
          mobile: 'Вперед'
        }
      },
      services: {
        sectionBadge: {
          desktop: 'SERVICES & PRICING',
          tablet: 'SERVICES & PRICING',
          mobile: 'SERVICES & PRICING'
        },
        title: {
          desktop: 'Услуги и цены',
          tablet: 'Услуги и цены',
          mobile: 'Услуги и цены'
        },
        subtitle: {
          desktop: 'Аналоговые приборы SSL, Neve, Tube-Tech и топовые цифровые плагины для бескомпромиссного качества.',
          tablet: 'Аналоговые приборы SSL, Neve, Tube-Tech и топовые цифровые плагины для бескомпромиссного качества.',
          mobile: 'Аналоговые приборы SSL, Neve, Tube-Tech и топовые цифровые плагины для бескомпромиссного качества.'
        },
        popularBadge: {
          desktop: 'ЧАСТЫЙ ВЫБОР',
          tablet: 'ЧАСТЫЙ ВЫБОР',
          mobile: 'ЧАСТЫЙ ВЫБОР'
        },
        orderBtn: {
          desktop: 'Заказать',
          tablet: 'Заказать',
          mobile: 'Заказать'
        },
        turnaround: {
          desktop: 'Срок выполнения: 3-5 дней',
          tablet: 'Срок выполнения: 3-5 дней',
          mobile: 'Срок выполнения: 3-5 дней'
        }
      },
      faq: {
        sectionBadge: {
          desktop: 'FREQUENTLY ASKED QUESTIONS',
          tablet: 'FREQUENTLY ASKED QUESTIONS',
          mobile: 'FREQUENTLY ASKED QUESTIONS'
        },
        title: {
          desktop: 'Частые вопросы',
          tablet: 'Частые вопросы',
          mobile: 'Частые вопросы'
        },
        subtitle: {
          desktop: 'Ответы на самые популярные вопросы по подготовке мультитрека и процессу работы.',
          tablet: 'Ответы на самые популярные вопросы по подготовке мультитрека и процессу работы.',
          mobile: 'Ответы на самые популярные вопросы по подготовке мультитрека и процессу работы.'
        }
      },
      contacts: {
        sectionBadge: {
          desktop: 'DIRECT CONTACT',
          tablet: 'DIRECT CONTACT',
          mobile: 'DIRECT CONTACT'
        },
        title: {
          desktop: '',
          tablet: '',
          mobile: ''
        },
        subtitle: {
          desktop: '<span class="font-semibold text-gray-200">Свяжитесь со мной напрямую для обсуждения вашего проекта.</span><br/><span class="text-amber-400 font-extrabold mt-1 inline-block">На связи 7 дней в неделю.</span>',
          tablet: '<span class="font-semibold text-gray-200">Свяжитесь со мной напрямую для обсуждения вашего проекта.</span><br/><span class="text-amber-400 font-extrabold mt-1 inline-block">На связи 7 дней в неделю.</span>',
          mobile: '<span class="font-semibold text-gray-200">Свяжитесь со мной напрямую для обсуждения вашего проекта.</span><br/><span class="text-amber-400 font-extrabold mt-1 inline-block">На связи 7 дней в неделю.</span>'
        },
        telegramBtn: {
          desktop: 'Открыть Telegram',
          tablet: 'Открыть Telegram',
          mobile: 'Открыть Telegram'
        },
        copyTgUsername: {
          desktop: 'Копировать ТГ @Nick_Rise',
          tablet: 'Копировать ТГ @Nick_Rise',
          mobile: 'Копировать ТГ @Nick_Rise'
        },
        copyEmail: {
          desktop: 'Копировать Email',
          tablet: 'Копировать Email',
          mobile: 'Копировать Email'
        },
        vkBtn: {
          desktop: 'Профиль ВКонтакте',
          tablet: 'Профиль ВКонтакте',
          mobile: 'Профиль ВКонтакте'
        },
        instagramBtn: {
          desktop: 'Профиль ВКонтакте',
          tablet: 'Профиль ВКонтакте',
          mobile: 'Профиль ВКонтакте'
        },
        toastTgCopied: {
          desktop: 'Никнейм @Nick_Rise скопирован!',
          tablet: 'Никнейм @Nick_Rise скопирован!',
          mobile: 'Никнейм @Nick_Rise скопирован!'
        },
        toastEmailCopied: {
          desktop: 'Email скопирован в буфер обмена!',
          tablet: 'Email скопирован в буфер обмена!',
          mobile: 'Email скопирован в буфер обмена!'
        }
      },
      modal: {
        title: {
          desktop: 'Связаться с Nick Rise',
          tablet: 'Связаться с Nick Rise',
          mobile: 'Связаться с Nick Rise'
        },
        subtitle: {
          desktop: 'Выберите удобный способ связи для быстрого ответа:',
          tablet: 'Выберите удобный способ связи для быстрого ответа:',
          mobile: 'Выберите удобный способ связи для быстрого ответа:'
        },
        closeBtn: {
          desktop: 'Закрыть',
          tablet: 'Закрыть',
          mobile: 'Закрыть'
        }
      },
      aboutModal: {
        tag: {
          desktop: 'STUDIO ENGINEER PROFILE // NICK RISE',
          tablet: 'STUDIO ENGINEER PROFILE // NICK RISE',
          mobile: 'STUDIO ENGINEER PROFILE // NICK RISE'
        },
        title: {
          desktop: 'Александр (Nick Rise)',
          tablet: 'Александр (Nick Rise)',
          mobile: 'Александр (Nick Rise)'
        },
        subtitle: {
          desktop: 'Звукорежиссер сведения & мастеринга',
          tablet: 'Звукорежиссер сведения & мастеринга',
          mobile: 'Звукорежиссер сведения & мастеринга'
        },
        experience: {
          desktop: '6+ лет в индустрии',
          tablet: '6+ лет в индустрии',
          mobile: '6+ лет в индустрии'
        },
        bioTitle: {
          desktop: 'Обо мне',
          tablet: 'Обо мне',
          mobile: 'Обо мне'
        },
        bioText1: {
          desktop: 'Приветствую! Меня зовут Александр, я битмейкер, техник по звуку и звукорежиссёр из Москвы. В моём портфолио — работа с аналоговыми и цифровыми микшерами на концертах и студиях. Отвечал за звук на прямой трансляции Первого канала на ВДНХ, сотрудничал с PRO BATTLE League, Underground Amplitude и другими лейблами и сообществами.',
          tablet: 'Приветствую! Меня зовут Александр, я битмейкер, техник по звуку и звукорежиссёр из Москвы. В моём портфолио — работа с аналоговыми и цифровыми микшерами на концертах и студиях. Отвечал за звук на прямой трансляции Первого канала на ВДНХ, сотрудничал с PRO BATTLE League, Underground Amplitude и другими лейблами и сообществами.',
          mobile: 'Приветствую! Меня зовут Александр, я битмейкер, техник по звуку и звукорежиссёр из Москвы. В моём портфолио — работа с аналоговыми и цифровыми микшерами на концертах и студиях. Отвечал за звук на прямой трансляции Первого канала на ВДНХ, сотрудничал с PRO BATTLE League, Underground Amplitude и другими лейблами и сообществами.'
        },
        bioText2: {
          desktop: 'Проходил обучение у таких звукорежиссёров, как Джон Олин, Константин Матафонов, Илья Лукашев, Павел Уоллен и других.',
          tablet: 'Проходил обучение у таких звукорежиссёров, как Джон Олин, Константин Матафонов, Илья Лукашев, Павел Уоллен и других.',
          mobile: 'Проходил обучение у таких звукорежиссёров, как Джон Олин, Константин Матафонов, Илья Лукашев, Павел Уоллен и других.'
        },
        bioText3: {
          desktop: 'С радостью готов поработать с тобой!',
          tablet: 'С радостью готов поработать с тобой!',
          mobile: 'С радостью готов поработать с тобой!'
        },
        stat1Num: {
          desktop: '200+',
          tablet: '200+',
          mobile: '200+'
        },
        stat1Text: {
          desktop: 'Завершенных треков',
          tablet: 'Завершенных треков',
          mobile: 'Завершенных треков'
        },
        stat2Num: {
          desktop: '6+ лет',
          tablet: '6+ лет',
          mobile: '6+ лет'
        },
        stat2Text: {
          desktop: 'Студийного опыта',
          tablet: 'Студийного опыта',
          mobile: 'Студийного опыта'
        },
        stat3Num: {
          desktop: '100%',
          tablet: '100%',
          mobile: '100+'
        },
        stat3Text: {
          desktop: 'Готовность к радио & стримингам',
          tablet: 'Готовность к радио & стримингам',
          mobile: 'Готовность к радио & стримингам'
        },
        btnFaqWhy: {
          desktop: 'Почему стоит выбрать именно меня?',
          tablet: 'Почему стоит выбрать именно меня?',
          mobile: 'Почему стоит выбрать именно меня?'
        },
        btnFaqWorkflow: {
          desktop: 'Как происходит процесс работы?',
          tablet: 'Как происходит процесс работы?',
          mobile: 'Как происходит процесс работы?'
        },
        btnDiscuss: {
          desktop: 'Обсудить проект',
          tablet: 'Обсудить проект',
          mobile: 'Обсудить проект'
        },
        btnDemos: {
          desktop: 'Примеры работ (A/B)',
          tablet: 'Примеры работ (A/B)',
          mobile: 'Примеры работ (A/B)'
        },
        closeBtn: {
          desktop: 'Закрыть',
          tablet: 'Закрыть',
          mobile: 'Закрыть'
        }
      }
    },

    en: {
      nav: {
        logoTitle: {
          desktop: 'Nick Rise Studio',
          tablet: 'Nick Rise Studio',
          mobile: 'Nick Rise Studio'
        },
        about: {
          desktop: 'About',
          tablet: 'About',
          mobile: 'About'
        },
        abPlayer: {
          desktop: 'A/B Demos',
          tablet: 'A/B Demos',
          mobile: 'A/B Demos'
        },
        services: {
          desktop: 'Services',
          tablet: 'Services',
          mobile: 'Services'
        },
        faq: {
          desktop: 'FAQ',
          tablet: 'FAQ',
          mobile: 'FAQ'
        },
        contacts: {
          desktop: 'Contacts',
          tablet: 'Contacts',
          mobile: 'Contacts'
        },
        contactBtn: {
          desktop: 'Contact',
          tablet: 'Contact',
          mobile: 'Contact'
        }
      },
      hero: {
        badge: {
          desktop: 'ANALOG HYBRID MIXING & MASTERING',
          tablet: 'ANALOG HYBRID MIXING & MASTERING',
          mobile: 'ANALOG HYBRID MIXING & MASTERING'
        },
        title: {
          desktop: 'Professional<br>Mixing / Mastering',
          tablet: 'Professional<br>Mixing / Mastering',
          mobile: 'Professional<br><span class="whitespace-nowrap">Mixing / Mastering</span>'
        },
        subtitle: {
          desktop: 'Specialization: Pop/House • Rock/Metal • Rap/R&B',
          tablet: 'Specialization: Pop/House • Rock/Metal • Rap/R&B',
          mobile: 'Pop/House • Rock/Metal • Rap/R&B'
        },
        usp: {
          desktop: 'I transform raw demos and multitracks into a powerful, spacious, and world-class commercial sound. From the first bar to the final master — every element in its place, every frequency under control.',
          tablet: 'I transform raw demos and multitracks into a powerful, spacious, and world-class commercial sound. From the first bar to the final master — every element in its place, every frequency under control.',
          mobile: 'I transform raw demos and multitracks into a powerful, spacious, and world-class commercial sound. From the first bar to the final master — every element in its place, every frequency under control.'
        },
        btnPlayer: {
          desktop: 'Listen A/B Demos',
          tablet: 'Listen A/B Demos',
          mobile: 'Listen A/B Demos'
        },
        btnContact: {
          desktop: 'Contacts',
          tablet: 'Contacts',
          mobile: 'Contacts'
        },
        aboutPhotoBadge: {
          desktop: 'About',
          tablet: 'About',
          mobile: 'About'
        }
      },
      player: {
        sectionBadge: {
          desktop: 'A/B COMPARISON',
          tablet: 'A/B COMPARISON',
          mobile: 'A/B COMPARISON'
        },
        title: {
          desktop: 'Hear the Difference',
          tablet: 'Hear the Difference',
          mobile: 'Hear the Difference'
        },
        subtitle: {
          desktop: 'Seamless real-time A/B switching between the raw mix (BEFORE) and polished studio master (AFTER). Hit PLAY to test the difference!',
          tablet: 'Seamless real-time A/B switching between the raw mix (BEFORE) and polished studio master (AFTER). Hit PLAY to test the difference!',
          mobile: 'Seamless real-time A/B switching between the raw mix (BEFORE) and polished studio master (AFTER). Hit PLAY to test the difference!'
        },
        filterAll: {
          desktop: 'All Genres',
          tablet: 'All Genres',
          mobile: 'All Genres'
        },
        filterPopHouse: {
          desktop: 'Pop / House',
          tablet: 'Pop / House',
          mobile: 'Pop / House'
        },
        filterRockMetal: {
          desktop: 'Rock / Metal',
          tablet: 'Rock / Metal',
          mobile: 'Rock / Metal'
        },
        filterRapRnB: {
          desktop: 'Rap / R&B',
          tablet: 'Rap / R&B',
          mobile: 'Rap / R&B'
        },
        filterTrapHipHop: {
          desktop: 'Rap / R&B',
          tablet: 'Rap / R&B',
          mobile: 'Rap / R&B'
        },
        beforeLabel: {
          desktop: 'BEFORE (MIX)',
          tablet: 'BEFORE (MIX)',
          mobile: 'BEFORE (MIX)'
        },
        afterLabel: {
          desktop: 'AFTER (MASTERED)',
          tablet: 'AFTER (MASTERED)',
          mobile: 'AFTER (MASTERED)'
        },
        volumeLabel: {
          desktop: 'Volume',
          tablet: 'Volume',
          mobile: 'Volume'
        },
        nowPlaying: {
          desktop: 'Now Playing:',
          tablet: 'Now Playing:',
          mobile: 'Now Playing:'
        },
        prevBtn: {
          desktop: 'Previous',
          tablet: 'Previous',
          mobile: 'Previous'
        },
        nextBtn: {
          desktop: 'Next',
          tablet: 'Next',
          mobile: 'Next'
        }
      },
      services: {
        sectionBadge: {
          desktop: 'SERVICES & PRICING',
          tablet: 'SERVICES & PRICING',
          mobile: 'SERVICES & PRICING'
        },
        title: {
          desktop: 'Services & Pricing',
          tablet: 'Services & Pricing',
          mobile: 'Services & Pricing'
        },
        subtitle: {
          desktop: 'Solid State Logic, Neve, Tube-Tech hardware combined with pristine digital processing.',
          tablet: 'Solid State Logic, Neve, Tube-Tech hardware combined with pristine digital processing.',
          mobile: 'Solid State Logic, Neve, Tube-Tech hardware combined with pristine digital processing.'
        },
        popularBadge: {
          desktop: 'MOST POPULAR',
          tablet: 'MOST POPULAR',
          mobile: 'MOST POPULAR'
        },
        orderBtn: {
          desktop: 'Order',
          tablet: 'Order',
          mobile: 'Order'
        },
        turnaround: {
          desktop: 'Turnaround: 3-5 business days',
          tablet: 'Turnaround: 3-5 business days',
          mobile: 'Turnaround: 3-5 business days'
        }
      },
      faq: {
        sectionBadge: {
          desktop: 'FREQUENTLY ASKED QUESTIONS',
          tablet: 'FREQUENTLY ASKED QUESTIONS',
          mobile: 'FREQUENTLY ASKED QUESTIONS'
        },
        title: {
          desktop: 'FAQ',
          tablet: 'FAQ',
          mobile: 'FAQ'
        },
        subtitle: {
          desktop: 'Everything you need to know about multitrack preparation and the workflow process.',
          tablet: 'Everything you need to know about multitrack preparation and the workflow process.',
          mobile: 'Everything you need to know about multitrack preparation and the workflow process.'
        }
      },
      contacts: {
        sectionBadge: {
          desktop: 'DIRECT CONTACT',
          tablet: 'DIRECT CONTACT',
          mobile: 'DIRECT CONTACT'
        },
        title: {
          desktop: '',
          tablet: '',
          mobile: ''
        },
        subtitle: {
          desktop: '<span class="font-semibold text-gray-200">Reach out directly to discuss your project.</span><br/><span class="text-amber-400 font-extrabold mt-1 inline-block">Available 7 days a week.</span>',
          tablet: '<span class="font-semibold text-gray-200">Reach out directly to discuss your project.</span><br/><span class="text-amber-400 font-extrabold mt-1 inline-block">Available 7 days a week.</span>',
          mobile: '<span class="font-semibold text-gray-200">Reach out directly to discuss your project.</span><br/><span class="text-amber-400 font-extrabold mt-1 inline-block">Available 7 days a week.</span>'
        },
        telegramBtn: {
          desktop: 'Open Telegram',
          tablet: 'Open Telegram',
          mobile: 'Open Telegram'
        },
        copyTgUsername: {
          desktop: 'Copy TG @Nick_Rise',
          tablet: 'Copy TG @Nick_Rise',
          mobile: 'Copy TG @Nick_Rise'
        },
        copyEmail: {
          desktop: 'Copy Email',
          tablet: 'Copy Email',
          mobile: 'Copy Email'
        },
        vkBtn: {
          desktop: 'VKontakte Profile',
          tablet: 'VKontakte Profile',
          mobile: 'VKontakte Profile'
        },
        instagramBtn: {
          desktop: 'VKontakte Profile',
          tablet: 'VKontakte Profile',
          mobile: 'VKontakte Profile'
        },
        toastTgCopied: {
          desktop: 'Username @Nick_Rise copied to clipboard!',
          tablet: 'Username @Nick_Rise copied to clipboard!',
          mobile: 'Username @Nick_Rise copied to clipboard!'
        },
        toastEmailCopied: {
          desktop: 'Email copied to clipboard!',
          tablet: 'Email copied to clipboard!',
          mobile: 'Email copied to clipboard!'
        }
      },
      modal: {
        title: {
          desktop: 'Contact Nick Rise',
          tablet: 'Contact Nick Rise',
          mobile: 'Contact Nick Rise'
        },
        subtitle: {
          desktop: 'Choose your preferred channel for an instant response:',
          tablet: 'Choose your preferred channel for an instant response:',
          mobile: 'Choose your preferred channel for an instant response:'
        },
        closeBtn: {
          desktop: 'Close',
          tablet: 'Close',
          mobile: 'Close'
        }
      },
      aboutModal: {
        tag: {
          desktop: 'STUDIO ENGINEER PROFILE // NICK RISE',
          tablet: 'STUDIO ENGINEER PROFILE // NICK RISE',
          mobile: 'STUDIO ENGINEER PROFILE // NICK RISE'
        },
        title: {
          desktop: 'Alexander (Nick Rise)',
          tablet: 'Alexander (Nick Rise)',
          mobile: 'Alexander (Nick Rise)'
        },
        subtitle: {
          desktop: 'Mixing & Mastering Engineer',
          tablet: 'Mixing & Mastering Engineer',
          mobile: 'Mixing & Mastering Engineer'
        },
        experience: {
          desktop: '6+ Years Industry Experience',
          tablet: '6+ Years Industry Experience',
          mobile: '6+ Years Industry Experience'
        },
        bioTitle: {
          desktop: 'About Me',
          tablet: 'About Me',
          mobile: 'About Me'
        },
        bioText1: {
          desktop: 'Hello! I\'m Alexander — a beatmaker, audio technician, and sound engineer based in Moscow. My background spans working with both analog and digital consoles across live concert setups and studio sessions. I\'ve managed broadcast sound for live streams and collaborated with labels and communities such as PRO BATTLE League, Underground Amplitude, and others.',
          tablet: 'Hello! I\'m Alexander — a beatmaker, audio technician, and sound engineer based in Moscow. My background spans working with both analog and digital consoles across live concert setups and studio sessions. I\'ve managed broadcast sound for live streams and collaborated with labels and communities such as PRO BATTLE League, Underground Amplitude, and others.',
          mobile: 'Hello! I\'m Alexander — a beatmaker, audio technician, and sound engineer based in Moscow. My background spans working with both analog and digital consoles across live concert setups and studio sessions. I\'ve managed broadcast sound for live streams and collaborated with labels and communities such as PRO BATTLE League, Underground Amplitude, and others.'
        },
        bioText2: {
          desktop: 'I\'ve trained under renowned audio engineers including John Olin, Konstantin Matafonov, Ilya Lukashev, Pavel Wallen, and more.',
          tablet: 'I\'ve trained under renowned audio engineers including John Olin, Konstantin Matafonov, Ilya Lukashev, Pavel Wallen, and more.',
          mobile: 'I\'ve trained under renowned audio engineers including John Olin, Konstantin Matafonov, Ilya Lukashev, Pavel Wallen, and more.'
        },
        bioText3: {
          desktop: 'I would be happy to work with you!',
          tablet: 'I would be happy to work with you!',
          mobile: 'I would be happy to work with you!'
        },
        stat1Num: {
          desktop: '200+',
          tablet: '200+',
          mobile: '200+'
        },
        stat1Text: {
          desktop: 'Tracks Mixed & Mastered',
          tablet: 'Tracks Mixed & Mastered',
          mobile: 'Tracks Mixed & Mastered'
        },
        stat2Num: {
          desktop: '6+ Yrs',
          tablet: '6+ Yrs',
          mobile: '6+ Yrs'
        },
        stat2Text: {
          desktop: 'Studio Experience',
          tablet: 'Studio Experience',
          mobile: 'Studio Experience'
        },
        stat3Num: {
          desktop: '100%',
          tablet: '100%',
          mobile: '100%'
        },
        stat3Text: {
          desktop: 'Radio & Streaming Ready',
          tablet: 'Radio & Streaming Ready',
          mobile: 'Radio & Streaming Ready'
        },
        btnFaqWhy: {
          desktop: 'Why choose me?',
          tablet: 'Why choose me?',
          mobile: 'Why choose me?'
        },
        btnFaqWorkflow: {
          desktop: 'How does the workflow process work?',
          tablet: 'How does the workflow process work?',
          mobile: 'How does the workflow process work?'
        },
        btnDiscuss: {
          desktop: 'Discuss Project',
          tablet: 'Discuss Project',
          mobile: 'Discuss Project'
        },
        btnDemos: {
          desktop: 'Listen to A/B Demos',
          tablet: 'Listen to A/B Demos',
          mobile: 'Listen to A/B Demos'
        },
        closeBtn: {
          desktop: 'Close',
          tablet: 'Close',
          mobile: 'Close'
        }
      }
    }
  },

  tracks: [
    // --- POP / HOUSE (6 tracks) ---
    {
      id: 'track-1',
      enabled: true,
      title: {
        desktop: 'Masochist',
        tablet: 'Masochist',
        mobile: 'Masochist'
      },
      artist: {
        desktop: 'Ellise',
        tablet: 'Ellise',
        mobile: 'Ellise'
      },
      genre: 'pop-house',
      genreLabel: {
        ru: {
          desktop: 'Pop Dark',
          tablet: 'Pop Dark',
          mobile: 'Pop Dark'
        },
        en: {
          desktop: 'Pop Dark',
          tablet: 'Pop Dark',
          mobile: 'Pop Dark'
        }
      },
      audioBefore: './audio/(P)PopDark_before (Ellise - Masochist).mp3',
      audioAfter: './audio/(P)PopDark_after (Ellise - Masochist).mp3',
      cover: './image/image_Ellise_Masochist.jpg'
    },
    {
      id: 'track-2',
      enabled: false,
      title: {
        desktop: 'Velvet Sound',
        tablet: 'Velvet Sound',
        mobile: 'Velvet Sound'
      },
      artist: {
        desktop: 'Acoustic Dreams',
        tablet: 'Acoustic Dreams',
        mobile: 'Acoustic Dreams'
      },
      genre: 'pop-house',
      genreLabel: {
        ru: {
          desktop: 'Pop / House',
          tablet: 'Pop / House',
          mobile: 'Pop / House'
        },
        en: {
          desktop: 'Pop / House',
          tablet: 'Pop / House',
          mobile: 'Pop / House'
        }
      },
      audioBefore: './audio/pophouse_1_before.mp3',
      audioAfter: './audio/pophouse_1_after.mp3',
      cover: './image/cover4.jpg'
    },
    {
      id: 'track-3',
      enabled: false,
      title: {
        desktop: 'Midnight Groove',
        tablet: 'Midnight Groove',
        mobile: 'Midnight Groove'
      },
      artist: {
        desktop: 'Sunset Club',
        tablet: 'Sunset Club',
        mobile: 'Sunset Club'
      },
      genre: 'pop-house',
      genreLabel: {
        ru: {
          desktop: 'Pop / House',
          tablet: 'Pop / House',
          mobile: 'Pop / House'
        },
        en: {
          desktop: 'Pop / House',
          tablet: 'Pop / House',
          mobile: 'Pop / House'
        }
      },
      audioBefore: './audio/pophouse_1_before.mp3',
      audioAfter: './audio/pophouse_1_after.mp3',
      cover: './image/cover1.jpg'
    },
    {
      id: 'track-4',
      enabled: false,
      title: {
        desktop: 'Solar Flare',
        tablet: 'Solar Flare',
        mobile: 'Solar Flare'
      },
      artist: {
        desktop: 'High Pulse',
        tablet: 'High Pulse',
        mobile: 'High Pulse'
      },
      genre: 'pop-house',
      genreLabel: {
        ru: {
          desktop: 'Pop / House',
          tablet: 'Pop / House',
          mobile: 'Pop / House'
        },
        en: {
          desktop: 'Pop / House',
          tablet: 'Pop / House',
          mobile: 'Pop / House'
        }
      },
      audioBefore: './audio/pophouse_1_before.mp3',
      audioAfter: './audio/pophouse_1_after.mp3',
      cover: './image/cover2.jpg'
    },
    {
      id: 'track-5',
      enabled: false,
      title: {
        desktop: 'Electric Heart',
        tablet: 'Electric Heart',
        mobile: 'Electric Heart'
      },
      artist: {
        desktop: 'Disco Knights',
        tablet: 'Disco Knights',
        mobile: 'Disco Knights'
      },
      genre: 'pop-house',
      genreLabel: {
        ru: {
          desktop: 'Pop / House',
          tablet: 'Pop / House',
          mobile: 'Pop / House'
        },
        en: {
          desktop: 'Pop / House',
          tablet: 'Pop / House',
          mobile: 'Pop / House'
        }
      },
      audioBefore: './audio/pophouse_1_before.mp3',
      audioAfter: './audio/pophouse_1_after.mp3',
      cover: './image/cover3.jpg'
    },
    {
      id: 'track-6',
      enabled: false,
      title: {
        desktop: 'Deep Aura',
        tablet: 'Deep Aura',
        mobile: 'Deep Aura'
      },
      artist: {
        desktop: 'Synth Odyssey',
        tablet: 'Synth Odyssey',
        mobile: 'Synth Odyssey'
      },
      genre: 'pop-house',
      genreLabel: {
        ru: {
          desktop: 'Pop / House',
          tablet: 'Pop / House',
          mobile: 'Pop / House'
        },
        en: {
          desktop: 'Pop / House',
          tablet: 'Pop / House',
          mobile: 'Pop / House'
        }
      },
      audioBefore: './audio/pophouse_1_before.mp3',
      audioAfter: './audio/pophouse_1_after.mp3',
      cover: './image/cover1.jpg'
    },

    // --- ROCK / METAL (6 tracks) ---
    {
      id: 'track-7',
      enabled: true,
      title: {
        desktop: 'Into The Fire',
        tablet: 'Into The Fire',
        mobile: 'Into The Fire'
      },
      artist: {
        desktop: 'Asking Alexandria',
        tablet: 'Asking Alexandria',
        mobile: 'Asking Alexandria'
      },
      genre: 'rock-metal',
      genreLabel: {
        ru: {
          desktop: 'Metal',
          tablet: 'Metal',
          mobile: 'Metal'
        },
        en: {
          desktop: 'Metal',
          tablet: 'Metal',
          mobile: 'Metal'
        }
      },
      audioBefore: './audio/(M)Metal_1_before (Asking Alexandria - Into The Fire).mp3',
      audioAfter: './audio/(M)Metal_1_after (Asking Alexandria - Into The Fire).mp3',
      cover: './image/Image_IntoTheFire_AskingAlexandria.jpeg'
    },
    {
      id: 'track-8',
      enabled: true,
      title: {
        desktop: 'Dark Horses',
        tablet: 'Dark Horses',
        mobile: 'Dark Horses'
      },
      artist: {
        desktop: 'The Long Wait',
        tablet: 'The Long Wait',
        mobile: 'The Long Wait'
      },
      genre: 'rock-metal',
      genreLabel: {
        ru: {
          desktop: 'Rock Country',
          tablet: 'Rock Country',
          mobile: 'Rock Country'
        },
        en: {
          desktop: 'Rock Country',
          tablet: 'Rock Country',
          mobile: 'Rock Country'
        }
      },
      audioBefore: './audio/(M)RockCountry_2_before (The Long Wait - Dark Horses).mp3',
      audioAfter: './audio/(M)RockCountry_2_after (The Long Wait - Dark Horses).mp3',
      cover: './image/image_TheLongWait_DarkHorses.jpg'
    },
    {
      id: 'track-9',
      enabled: false,
      title: {
        desktop: 'Iron Pulse',
        tablet: 'Iron Pulse',
        mobile: 'Iron Pulse'
      },
      artist: {
        desktop: 'Void Screamer',
        tablet: 'Void Screamer',
        mobile: 'Void Screamer'
      },
      genre: 'rock-metal',
      genreLabel: {
        ru: {
          desktop: 'Rock / Metal',
          tablet: 'Rock / Metal',
          mobile: 'Rock / Metal'
        },
        en: {
          desktop: 'Rock / Metal',
          tablet: 'Rock / Metal',
          mobile: 'Rock / Metal'
        }
      },
      audioBefore: './audio/rockmetal_1_before.mp3',
      audioAfter: './audio/rockmetal_1_after.mp3',
      cover: './image/cover3.jpg'
    },
    {
      id: 'track-10',
      enabled: false,
      title: {
        desktop: 'Bleeding Steel',
        tablet: 'Bleeding Steel',
        mobile: 'Bleeding Steel'
      },
      artist: {
        desktop: 'Crimson Peak',
        tablet: 'Crimson Peak',
        mobile: 'Crimson Peak'
      },
      genre: 'rock-metal',
      genreLabel: {
        ru: {
          desktop: 'Rock / Metal',
          tablet: 'Rock / Metal',
          mobile: 'Rock / Metal'
        },
        en: {
          desktop: 'Rock / Metal',
          tablet: 'Rock / Metal',
          mobile: 'Rock / Metal'
        }
      },
      audioBefore: './audio/rockmetal_1_before.mp3',
      audioAfter: './audio/rockmetal_1_after.mp3',
      cover: './image/cover1.jpg'
    },
    {
      id: 'track-11',
      enabled: false,
      title: {
        desktop: 'Titanium Roar',
        tablet: 'Titanium Roar',
        mobile: 'Titanium Roar'
      },
      artist: {
        desktop: 'Black Engine',
        tablet: 'Black Engine',
        mobile: 'Black Engine'
      },
      genre: 'rock-metal',
      genreLabel: {
        ru: {
          desktop: 'Rock / Metal',
          tablet: 'Rock / Metal',
          mobile: 'Rock / Metal'
        },
        en: {
          desktop: 'Rock / Metal',
          tablet: 'Rock / Metal',
          mobile: 'Rock / Metal'
        }
      },
      audioBefore: './audio/rockmetal_1_before.mp3',
      audioAfter: './audio/rockmetal_1_after.mp3',
      cover: './image/cover4.jpg'
    },
    {
      id: 'track-12',
      enabled: false,
      title: {
        desktop: 'Rebel Horizon',
        tablet: 'Rebel Horizon',
        mobile: 'Rebel Horizon'
      },
      artist: {
        desktop: 'Riot Protocol',
        tablet: 'Riot Protocol',
        mobile: 'Riot Protocol'
      },
      genre: 'rock-metal',
      genreLabel: {
        ru: {
          desktop: 'Rock / Metal',
          tablet: 'Rock / Metal',
          mobile: 'Rock / Metal'
        },
        en: {
          desktop: 'Rock / Metal',
          tablet: 'Rock / Metal',
          mobile: 'Rock / Metal'
        }
      },
      audioBefore: './audio/rockmetal_1_before.mp3',
      audioAfter: './audio/rockmetal_1_after.mp3',
      cover: './image/cover2.jpg'
    },

    // --- RAP / R&B (6 tracks) ---
    {
      id: 'track-13',
      enabled: true,
      title: {
        desktop: 'Teleport',
        tablet: 'Teleport',
        mobile: 'Teleport'
      },
      artist: {
        desktop: 'TytillidieXXollin',
        tablet: 'TytillidieXXollin',
        mobile: 'TytillidieXXollin'
      },
      genre: 'rap-rnb',
      genreLabel: {
        ru: {
          desktop: 'Rap',
          tablet: 'Rap',
          mobile: 'Rap'
        },
        en: {
          desktop: 'Rap',
          tablet: 'Rap',
          mobile: 'Rap'
        }
      },
      audioBefore: './audio/(R)Rap_1_before (TytillidieXXollin - Teleport).mp3',
      audioAfter: './audio/(R)Rap_1_after (TytillidieXXollin - Teleport).mp3',
      cover: './image/image_TytillidieXXollin_Teleport.jpg'
    },
    {
      id: 'track-14',
      enabled: false,
      title: {
        desktop: 'Midnight Hustle',
        tablet: 'Midnight Hustle',
        mobile: 'Midnight Hustle'
      },
      artist: {
        desktop: 'Luna Boy',
        tablet: 'Luna Boy',
        mobile: 'Luna Boy'
      },
      genre: 'rap-rnb',
      genreLabel: {
        ru: {
          desktop: 'Rap / R&B',
          tablet: 'Rap / R&B',
          mobile: 'Rap / R&B'
        },
        en: {
          desktop: 'Rap / R&B',
          tablet: 'Rap / R&B',
          mobile: 'Rap / R&B'
        }
      },
      audioBefore: './audio/traphiphop_1_before.mp3',
      audioAfter: './audio/traphiphop_1_after.mp3',
      cover: './image/cover3.jpg'
    },
    {
      id: 'track-15',
      enabled: false,
      title: {
        desktop: 'Night City',
        tablet: 'Night City',
        mobile: 'Night City'
      },
      artist: {
        desktop: 'Trap Cartel',
        tablet: 'Trap Cartel',
        mobile: 'Trap Cartel'
      },
      genre: 'rap-rnb',
      genreLabel: {
        ru: {
          desktop: 'Rap / R&B',
          tablet: 'Rap / R&B',
          mobile: 'Rap / R&B'
        },
        en: {
          desktop: 'Rap / R&B',
          tablet: 'Rap / R&B',
          mobile: 'Rap / R&B'
        }
      },
      audioBefore: './audio/traphiphop_1_before.mp3',
      audioAfter: './audio/traphiphop_1_after.mp3',
      cover: './image/cover2.jpg'
    },
    {
      id: 'track-16',
      enabled: false,
      title: {
        desktop: 'Underground Kings',
        tablet: 'Underground Kings',
        mobile: 'Underground Kings'
      },
      artist: {
        desktop: 'Sub Zero',
        tablet: 'Sub Zero',
        mobile: 'Sub Zero'
      },
      genre: 'rap-rnb',
      genreLabel: {
        ru: {
          desktop: 'Rap / R&B',
          tablet: 'Rap / R&B',
          mobile: 'Rap / R&B'
        },
        en: {
          desktop: 'Rap / R&B',
          tablet: 'Rap / R&B',
          mobile: 'Rap / R&B'
        }
      },
      audioBefore: './audio/traphiphop_1_before.mp3',
      audioAfter: './audio/traphiphop_1_after.mp3',
      cover: './image/cover4.jpg'
    },
    {
      id: 'track-17',
      enabled: false,
      title: {
        desktop: 'Golden Flow',
        tablet: 'Golden Flow',
        mobile: 'Golden Flow'
      },
      artist: {
        desktop: 'Metro Beat',
        tablet: 'Metro Beat',
        mobile: 'Metro Beat'
      },
      genre: 'rap-rnb',
      genreLabel: {
        ru: {
          desktop: 'Rap / R&B',
          tablet: 'Rap / R&B',
          mobile: 'Rap / R&B'
        },
        en: {
          desktop: 'Rap / R&B',
          tablet: 'Rap / R&B',
          mobile: 'Rap / R&B'
        }
      },
      audioBefore: './audio/traphiphop_1_before.mp3',
      audioAfter: './audio/traphiphop_1_after.mp3',
      cover: './image/cover3.jpg'
    },
    {
      id: 'track-18',
      enabled: false,
      title: {
        desktop: '808 Eclipse',
        tablet: '808 Eclipse',
        mobile: '808 Eclipse'
      },
      artist: {
        desktop: 'Phonk Syndicate',
        tablet: 'Phonk Syndicate',
        mobile: 'Phonk Syndicate'
      },
      genre: 'rap-rnb',
      genreLabel: {
        ru: {
          desktop: 'Rap / R&B',
          tablet: 'Rap / R&B',
          mobile: 'Rap / R&B'
        },
        en: {
          desktop: 'Rap / R&B',
          tablet: 'Rap / R&B',
          mobile: 'Rap / R&B'
        }
      },
      audioBefore: './audio/traphiphop_1_before.mp3',
      audioAfter: './audio/traphiphop_1_after.mp3',
      cover: './image/cover1.jpg'
    }
  ],

  servicesData: [
    {
      id: 'mixing',
      isPopular: false,
      titleRu: {
        desktop: 'Сведение Мультитрека',
        tablet: 'Сведение Мультитрека',
        mobile: 'Сведение Мультитрека'
      },
      titleEn: {
        desktop: 'Multitrack Mixing',
        tablet: 'Multitrack Mixing',
        mobile: 'Multitrack Mixing'
      },
      descRu: {
        desktop: 'Идеальный баланс, глубина и мощь. Микс, который звучит дорого и готов к мастерингу.',
        tablet: 'Идеальный баланс, глубина и мощь. Микс, который звучит дорого и готов к мастерингу.',
        mobile: 'Идеальный баланс, глубина и мощь. Микс, который звучит дорого и готов к мастерингу.'
      },
      descEn: {
        desktop: 'Perfect balance, depth, and punch. A mix that sounds premium and is ready for mastering.',
        tablet: 'Perfect balance, depth, and punch. A mix that sounds premium and is ready for mastering.',
        mobile: 'Perfect balance, depth, and punch. A mix that sounds premium and is ready for mastering.'
      },
      priceRu: {
        desktop: 'от 3 500 ₽',
        tablet: 'от 3 500 ₽',
        mobile: 'от 3 500 ₽'
      },
      priceEn: {
        desktop: 'from $120',
        tablet: 'from $120',
        mobile: 'from $120'
      },
      featuresRu: [
        {
          desktop: 'Обработка до 20 мультитрек-дорожек',
          tablet: 'Обработка до 20 мультитрек-дорожек',
          mobile: 'Обработка до 20 мультитрек-дорожек'
        },
        {
          desktop: 'Ручной тюнинг и ритмическая коррекция вокала',
          tablet: 'Ручной тюнинг и ритмическая коррекция вокала',
          mobile: 'Ручной тюнинг и ритмическая коррекция вокала'
        },
        {
          desktop: '3 бесплатные итерации правок',
          tablet: '3 бесплатные итерации правок',
          mobile: '3 бесплатные итерации правок'
        },
        {
          desktop: 'Стерео WAV (32-bit) + Минус и Акапелла',
          tablet: 'Стерео WAV (32-bit) + Минус и Акапелла',
          mobile: 'Стерео WAV (32-bit) + Минус и Акапелла'
        }
      ],
      featuresEn: [
        {
          desktop: 'Processing for up to 20 multitrack tracks',
          tablet: 'Processing for up to 20 multitrack tracks',
          mobile: 'Processing for up to 20 multitrack tracks'
        },
        {
          desktop: 'Manual vocal tuning & pitch alignment',
          tablet: 'Manual vocal tuning & pitch alignment',
          mobile: 'Manual vocal tuning & pitch alignment'
        },
        {
          desktop: '3 complimentary revision rounds',
          tablet: '3 complimentary revision rounds',
          mobile: '3 complimentary revision rounds'
        },
        {
          desktop: 'Stereo WAV (32-bit) + Instrumental & Acapella',
          tablet: 'Stereo WAV (32-bit) + Instrumental & Acapella',
          mobile: 'Stereo WAV (32-bit) + Instrumental & Acapella'
        }
      ]
    },
    {
      id: 'mix-master',
      isPopular: true,
      titleRu: {
        desktop: 'Сведение + Мастеринг (Полный пакет)',
        tablet: 'Сведение + Мастеринг (Полный пакет)',
        mobile: 'Сведение + Мастеринг (Полный пакет)'
      },
      titleEn: {
        desktop: 'Mixing + Mastering (Full Package)',
        tablet: 'Mixing + Mastering (Full Package)',
        mobile: 'Mixing + Mastering (Full Package)'
      },
      descRu: {
        desktop: 'От мультитреков до готового релиза. Всё в одном пакете. Громкий, сбалансированный трек за 3 дня.',
        tablet: 'От мультитреков до готового релиза. Всё в одном пакете. Громкий, сбалансированный трек за 3 дня.',
        mobile: 'От мультитреков до готового релиза. Всё в одном пакете. Громкий, сбалансированный трек за 3 дня.'
      },
      descEn: {
        desktop: 'From raw multitracks to a release-ready master. All in one package. Loud, balanced track in 3 days.',
        tablet: 'From raw multitracks to a release-ready master. All in one package. Loud, balanced track in 3 days.',
        mobile: 'From raw multitracks to a release-ready master. All in one package. Loud, balanced track in 3 days.'
      },
      priceRu: {
        desktop: 'от 5 500 ₽',
        tablet: 'от 5 500 ₽',
        mobile: 'от 5 500 ₽'
      },
      priceEn: {
        desktop: 'from $150',
        tablet: 'from $150',
        mobile: 'from $150'
      },
      featuresRu: [
        {
          desktop: 'Всё, что входит в «Сведение»',
          tablet: 'Всё, что входит в «Сведение»',
          mobile: 'Всё, что входит в «Сведение»'
        },
        {
          desktop: 'Всё, что входит в «Мастеринг»',
          tablet: 'Всё, что входит в «Мастеринг»',
          mobile: 'Всё, что входит в «Мастеринг»'
        },
        {
          desktop: 'Обработка до 40 мультитрек-дорожек',
          tablet: 'Обработка до 40 мультитрек-дорожек',
          mobile: 'Обработка до 40 мультитрек-дорожек'
        },
        {
          desktop: 'Приоритетный срок выполнения (до 3 дней)',
          tablet: 'Приоритетный срок выполнения (до 3 дней)',
          mobile: 'Приоритетный срок выполнения (до 3 дней)'
        }
      ],
      featuresEn: [
        {
          desktop: 'Everything included in Mixing',
          tablet: 'Everything included in Mixing',
          mobile: 'Everything included in Mixing'
        },
        {
          desktop: 'Everything included in Mastering',
          tablet: 'Everything included in Mastering',
          mobile: 'Everything included in Mastering'
        },
        {
          desktop: 'Processing for up to 40 multitrack tracks',
          tablet: 'Processing for up to 40 multitrack tracks',
          mobile: 'Processing for up to 40 multitrack tracks'
        },
        {
          desktop: 'Priority turnaround (up to 3 days)',
          tablet: 'Priority turnaround (up to 3 days)',
          mobile: 'Priority turnaround (up to 3 days)'
        }
      ]
    },
    {
      id: 'mastering',
      isPopular: false,
      titleRu: {
        desktop: 'Стерео Мастеринг',
        tablet: 'Стерео Мастеринг',
        mobile: 'Стерео Мастеринг'
      },
      titleEn: {
        desktop: 'Stereo Mastering',
        tablet: 'Stereo Mastering',
        mobile: 'Stereo Mastering'
      },
      descRu: {
        desktop: 'Финальная полировка. Ширина, глубина и громкость под ваш референс. Готово для всех стримингов.',
        tablet: 'Финальная полировка. Ширина, глубина и громкость под ваш референс. Готово для всех стримингов.',
        mobile: 'Финальная полировка. Ширина, глубина и громкость под ваш референс. Готово для всех стримингов.'
      },
      descEn: {
        desktop: 'Final polish. Width, depth, and loudness matched to your reference. Ready for all streaming platforms.',
        tablet: 'Final polish. Width, depth, and loudness matched to your reference. Ready for all streaming platforms.',
        mobile: 'Final polish. Width, depth, and loudness matched to your reference. Ready for all streaming platforms.'
      },
      priceRu: {
        desktop: 'от 2 000 ₽',
        tablet: 'от 2 000 ₽',
        mobile: 'от 2 000 ₽'
      },
      priceEn: {
        desktop: 'from $40',
        tablet: 'from $40',
        mobile: 'from $40'
      },
      featuresRu: [
        {
          desktop: 'Контроль микса на студийных и бытовых системах',
          tablet: 'Контроль микса на студийных и бытовых системах',
          mobile: 'Контроль микса на студийных и бытовых системах'
        },
        {
          desktop: 'Коррекция частотного баланса и динамики',
          tablet: 'Коррекция частотного баланса и динамики',
          mobile: 'Коррекция частотного баланса и динамики'
        },
        {
          desktop: 'Контроль Mid-Side составляющей микса',
          tablet: 'Контроль Mid-Side составляющей микса',
          mobile: 'Контроль Mid-Side составляющей микса'
        },
        {
          desktop: 'Готовые файлы для всех стримингов',
          tablet: 'Готовые файлы для всех стримингов',
          mobile: 'Готовые файлы для всех стримингов'
        }
      ],
      featuresEn: [
        {
          desktop: 'Playback check on studio monitors and consumer sound systems',
          tablet: 'Playback check on studio monitors and consumer sound systems',
          mobile: 'Playback check on studio monitors and consumer sound systems'
        },
        {
          desktop: 'Frequency balance & dynamics control',
          tablet: 'Frequency balance & dynamics control',
          mobile: 'Frequency balance & dynamics control'
        },
        {
          desktop: 'Mid-Side balance monitoring',
          tablet: 'Mid-Side balance monitoring',
          mobile: 'Mid-Side balance monitoring'
        },
        {
          desktop: 'Distribution-ready streaming masters',
          tablet: 'Distribution-ready streaming masters',
          mobile: 'Distribution-ready streaming masters'
        }
      ]
    }
  ],

  faqData: [
    {
      qRu: {
        desktop: 'Почему стоит выбрать именно меня?',
        tablet: 'Почему стоит выбрать именно меня?',
        mobile: 'Почему стоит выбрать именно меня?'
      },
      qEn: {
        desktop: 'Why choose me?',
        tablet: 'Why choose me?',
        mobile: 'Why choose me?'
      },
      aRu: {
        desktop: 'Мой опыт — это не только 6+ лет сведения и мастеринга, но и написания аранжировок. Благодаря этому я могу и контролировать качество на всех этапах создания музыки и давать советы по его улучшению.<br/><br/>Я не просто делаю «громко и чисто». Я слышу трек целиком и понимаю, что нужно именно вашему жанру, настроению и материалу. Вы получаете не просто сведение, а профессиональный взгляд на ваш трек со всех сторон.<br/><br/>Моя задача — чтобы ваш трек звучал на уровне мировых релизов, был конкурентным на стримингах и цеплял слушателя с первой секунды.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>Вижу вам интересно сотрудничество со мной! Напишите мне в Телеграм <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> и получите скидку на первый заказ в размере <strong class="text-amber-400 font-bold">10%</strong></span></div>',
        tablet: 'Мой опыт — это не только 6+ лет сведения и мастеринга, но и написания аранжировок. Благодаря этому я могу и контролировать качество на всех этапах создания музыки и давать советы по его улучшению.<br/><br/>Я не просто делаю «громко и чисто». Я слышу трек целиком и понимаю, что нужно именно вашему жанру, настроению и материалу. Вы получаете не просто сведение, а профессиональный взгляд на ваш трек со всех сторон.<br/><br/>Моя задача — чтобы ваш трек звучал на уровне мировых релизов, был конкурентным на стримингах и цеплял слушателя с первой секунды.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>Вижу вам интересно сотрудничество со мной! Напишите мне в Телеграм <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> и получите скидку на первый заказ в размере <strong class="text-amber-400 font-bold">10%</strong></span></div>',
        mobile: 'Мой опыт — это не только 6+ лет сведения и мастеринга, но и написания аранжировок. Благодаря этому я могу и контролировать качество на всех этапах создания музыки и давать советы по его улучшению.<br/><br/>Я не просто делаю «громко и чисто». Я слышу трек целиком и понимаю, что нужно именно вашему жанру, настроению и материалу. Вы получаете не просто сведение, а профессиональный взгляд на ваш трек со всех сторон.<br/><br/>Моя задача — чтобы ваш трек звучал на уровне мировых релизов, был конкурентным на стримингах и цеплял слушателя с первой секунды.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>Вижу вам интересно сотрудничество со мной! Напишите мне в Телеграм <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> и получите скидку на первый заказ в размере <strong class="text-amber-400 font-bold">10%</strong></span></div>'
      },
      aEn: {
        desktop: 'My background spans not only 6+ years of mixing and mastering, but also music arrangement. This allows me to maintain quality control at every stage of music production and provide expert guidance to elevate your sound.<br/><br/>I don\'t just make tracks "loud and clean." I hear the big picture and know exactly what your specific genre, mood, and material need. You get more than just a mix — you get a comprehensive, professional perspective on your music.<br/><br/>My goal is to make your track sound on par with world-class releases, remain competitive across all streaming platforms, and hook the listener from the very first second.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>I see you\'re interested in working together! Message me <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> on Telegram to get <strong class="text-amber-400 font-bold">10% off</strong> your first order.</span></div>',
        tablet: 'My background spans not only 6+ years of mixing and mastering, but also music arrangement. This allows me to maintain quality control at every stage of music production and provide expert guidance to elevate your sound.<br/><br/>I don\'t just make tracks "loud and clean." I hear the big picture and know exactly what your specific genre, mood, and material need. You get more than just a mix — you get a comprehensive, professional perspective on your music.<br/><br/>My goal is to make your track sound on par with world-class releases, remain competitive across all streaming platforms, and hook the listener from the very first second.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>I see you\'re interested in working together! Message me <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> on Telegram to get <strong class="text-amber-400 font-bold">10% off</strong> your first order.</span></div>',
        mobile: 'My background spans not only 6+ years of mixing and mastering, but also music arrangement. This allows me to maintain quality control at every stage of music production and provide expert guidance to elevate your sound.<br/><br/>I don\'t just make tracks "loud and clean." I hear the big picture and know exactly what your specific genre, mood, and material need. You get more than just a mix — you get a comprehensive, professional perspective on your music.<br/><br/>My goal is to make your track sound on par with world-class releases, remain competitive across all streaming platforms, and hook the listener from the very first second.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>I see you\'re interested in working together! Message me <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> on Telegram to get <strong class="text-amber-400 font-bold">10% off</strong> your first order.</span></div>'
      }
    },
    {
      qRu: {
        desktop: 'Как происходит процесс работы?',
        tablet: 'Как происходит процесс работы?',
        mobile: 'Как происходит процесс работы?'
      },
      qEn: {
        desktop: 'How does the workflow process work?',
        tablet: 'How does the workflow process work?',
        mobile: 'How does the workflow process work?'
      },
      aRu: {
        desktop: 'Весь процесс делится на 4 этапа:<br/><br/>1 - Заявка и ТЗ. Вы присылаете мультитреки, референсы и техническое задание (как его правильно оформить, смотрите в следующем вопросе).<br/><br/>2 - Старт. Я слушаю материал, называю цену и срок. После вашей 50% предоплаты начинаю работу.<br/><br/>3 - Черновой микс и правки. Через 2–3 дня вы получаете MP3-черновик. Слушаете, пишете замечания. Я вношу правки (до 3-х итераций включительно).<br/><br/>4 - Финал. После утверждения микса вы оплачиваете оставшиеся 50%, я делаю мастеринг и отправляю готовые WAV и MP3 файлы.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>Вижу вам интересно сотрудничество со мной! Напишите мне в Телеграм <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> и получите скидку на первый заказ в размере <strong class="text-amber-400 font-bold">10%</strong></span></div>',
        tablet: 'Весь процесс делится на 4 этапа:<br/><br/>1 - Заявка и ТЗ. Вы присылаете мультитреки, референсы и техническое задание (как его правильно оформить, смотрите в следующем вопросе).<br/><br/>2 - Старт. Я слушаю материал, называю цену и срок. После вашей 50% предоплаты начинаю работу.<br/><br/>3 - Черновой микс и правки. Через 2–3 дня вы получаете MP3-черновик. Слушаете, пишете замечания. Я вношу правки (до 3-х итераций включительно).<br/><br/>4 - Финал. После утверждения микса вы оплачиваете оставшиеся 50%, я делаю мастеринг и отправляю готовые WAV и MP3 файлы.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>Вижу вам интересно сотрудничество со мной! Напишите мне в Телеграм <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> и получите скидку на первый заказ в размере <strong class="text-amber-400 font-bold">10%</strong></span></div>',
        mobile: 'Весь процесс делится на 4 этапа:<br/><br/>1 - Заявка и ТЗ. Вы присылаете мультитреки, референсы и техническое задание (как его правильно оформить, смотрите в следующем вопросе).<br/><br/>2 - Старт. Я слушаю материал, называю цену и срок. После вашей 50% предоплаты начинаю работу.<br/><br/>3 - Черновой микс и правки. Через 2–3 дня вы получаете MP3-черновик. Слушаете, пишете замечания. Я вношу правки (до 3-х итераций включительно).<br/><br/>4 - Финал. После утверждения микса вы оплачиваете оставшиеся 50%, я делаю мастеринг и отправляю готовые WAV и MP3 файлы.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>Вижу вам интересно сотрудничество со мной! Напишите мне в Телеграм <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> и получите скидку на первый заказ в размере <strong class="text-amber-400 font-bold">10%</strong></span></div>'
      },
      aEn: {
        desktop: 'The process is divided into 4 stages:<br/><br/>1 - Request & Brief. You send multitracks, reference tracks, and technical requirements (see the next question for details on how to prepare them).<br/><br/>2 - Kickoff. I listen to your material, provide a quote, and set a completion date. Work begins once a 50% deposit is made.<br/><br/>3 - Draft Mix & Revisions. Within 2–3 days, you receive an MP3 preview. You listen and provide feedback, and I apply your adjustments (up to 3 revision rounds included).<br/><br/>4 - Final Delivery. Once the mix is approved, you pay the remaining 50%. I complete the final mastering and deliver your high-resolution WAV and MP3 files.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>I see you\'re interested in working together! Message me <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> on Telegram to get <strong class="text-amber-400 font-bold">10% off</strong> your first order.</span></div>',
        tablet: 'The process is divided into 4 stages:<br/><br/>1 - Request & Brief. You send multitracks, reference tracks, and technical requirements (see the next question for details on how to prepare them).<br/><br/>2 - Kickoff. I listen to your material, provide a quote, and set a completion date. Work begins once a 50% deposit is made.<br/><br/>3 - Draft Mix & Revisions. Within 2–3 days, you receive an MP3 preview. You listen and provide feedback, and I apply your adjustments (up to 3 revision rounds included).<br/><br/>4 - Final Delivery. Once the mix is approved, you pay the remaining 50%. I complete the final mastering and deliver your high-resolution WAV and MP3 files.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>I see you\'re interested in working together! Message me <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> on Telegram to get <strong class="text-amber-400 font-bold">10% off</strong> your first order.</span></div>',
        mobile: 'The process is divided into 4 stages:<br/><br/>1 - Request & Brief. You send multitracks, reference tracks, and technical requirements (see the next question for details on how to prepare them).<br/><br/>2 - Kickoff. I listen to your material, provide a quote, and set a completion date. Work begins once a 50% deposit is made.<br/><br/>3 - Draft Mix & Revisions. Within 2–3 days, you receive an MP3 preview. You listen and provide feedback, and I apply your adjustments (up to 3 revision rounds included).<br/><br/>4 - Final Delivery. Once the mix is approved, you pay the remaining 50%. I complete the final mastering and deliver your high-resolution WAV and MP3 files.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>I see you\'re interested in working together! Message me <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> on Telegram to get <strong class="text-amber-400 font-bold">10% off</strong> your first order.</span></div>'
      }
    },
    {
      qRu: {
        desktop: 'Как правильно оформить Техническое Задание?',
        tablet: 'Как правильно оформить Техническое Задание?',
        mobile: 'Как правильно оформить Техническое Задание?'
      },
      qEn: {
        desktop: 'How do I prepare a Technical Brief?',
        tablet: 'How do I prepare a Technical Brief?',
        mobile: 'How do I prepare a Technical Brief?'
      },
      aRu: {
        desktop: 'Максимально подробно опишите ваше видение финального результата:<br/><br/>1 - Референсы. 2–3 трека других исполнителей файлом (или ссылкой), чей звук вам нравится. Это может быть бас из одного трека, вокал из другого, общая атмосфера из третьего. Я слушаю и понимаю, куда двигаться.<br/><br/>2 - Характер и описание. Подробно опишите, как вы видите финальный результат: что вы точно хотите сохранить или наоборот убрать. Например, чтобы вокал звучал ближе, а барабаны мощнее. Расскажите про энергетику трека, какие моменты должны цеплять слушателя в первую очередь.<br/><br/>3 - Дополнительная информация. Если есть что-то важное, что я должен знать о записи: например, трек записан в домашних условиях, есть шумы или артефакты, которые вы не можете перезаписать. Или, наоборот, вы гордитесь какой-то партией и хотите, чтобы она звучала ярко. Также укажите, если у вас есть дедлайн — я учту это при планировании работы.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>Вижу вам интересно сотрудничество со мной! Напишите мне в Телеграм <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> и получите скидку на первый заказ в размере <strong class="text-amber-400 font-bold">10%</strong></span></div>',
        tablet: 'Максимально подробно опишите ваше видение финального результата:<br/><br/>1 - Референсы. 2–3 трека других исполнителей файлом (или ссылкой), чей звук вам нравится. Это может быть бас из одного трека, вокал из другого, общая атмосфера из третьего. Я слушаю и понимаю, куда двигаться.<br/><br/>2 - Характер и описание. Подробно опишите, как вы видите финальный результат: что вы точно хотите сохранить или наоборот убрать. Например, чтобы вокал звучал ближе, а барабаны мощнее. Расскажите про энергетику трека, какие моменты должны цеплять слушателя в первую очередь.<br/><br/>3 - Дополнительная информация. Если есть что-то важное, что я должен знать о записи: например, трек записан в домашних условиях, есть шумы или артефакты, которые вы не можете перезаписать. Или, наоборот, вы гордитесь какой-то партией и хотите, чтобы она звучала ярко. Также укажите, если у вас есть дедлайн — я учту это при планировании работы.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>Вижу вам интересно сотрудничество со мной! Напишите мне в Телеграм <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> и получите скидку на первый заказ в размере <strong class="text-amber-400 font-bold">10%</strong></span></div>',
        mobile: 'Максимально подробно опишите ваше видение финального результата:<br/><br/>1 - Референсы. 2–3 трека других исполнителей файлом (или ссылкой), чей звук вам нравится. Это может быть бас из одного трека, вокал из другого, общая атмосфера из третьего. Я слушаю и понимаю, куда двигаться.<br/><br/>2 - Характер и описание. Подробно опишите, как вы видите финальный результат: что вы точно хотите сохранить или наоборот убрать. Например, чтобы вокал звучал ближе, а барабаны мощнее. Расскажите про энергетику трека, какие моменты должны цеплять слушателя в первую очередь.<br/><br/>3 - Дополнительная информация. Если есть что-то важное, что я должен знать о записи: например, трек записан в домашних условиях, есть шумы или артефакты, которые вы не можете перезаписать. Или, наоборот, вы гордитесь какой-то партией и хотите, чтобы она звучала ярко. Также укажите, если у вас есть дедлайн — я учту это при планировании работы.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>Вижу вам интересно сотрудничество со мной! Напишите мне в Телеграм <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> и получите скидку на первый заказ в размере <strong class="text-amber-400 font-bold">10%</strong></span></div>'
      },
      aEn: {
        desktop: 'Describe your vision for the final result in as much detail as possible:<br/><br/>1 - References. Send 2–3 tracks by other artists as files (or links) whose sound you admire. It could be the bass from one track, the vocal treatment from another, or the general vibe from a third. This helps me understand the target sonic direction.<br/><br/>2 - Character & Description. Detail what you want to achieve: what to preserve or remove. For instance, if you want vocals upfront or drums punchier. Explain the track\'s energy and which elements should grab the listener\'s attention first.<br/><br/>3 - Additional Info. Mention anything critical about the recording: e.g., if it was recorded at home with background noise or artifacts you can\'t re-record. Conversely, highlight any specific parts you\'re proud of and want featured prominently. Please mention if you have a tight deadline so I can plan accordingly.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>I see you\'re interested in working together! Message me <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> on Telegram to get <strong class="text-amber-400 font-bold">10% off</strong> your first order.</span></div>',
        tablet: 'Describe your vision for the final result in as much detail as possible:<br/><br/>1 - References. Send 2–3 tracks by other artists as files (or links) whose sound you admire. It could be the bass from one track, the vocal treatment from another, or the general vibe from a third. This helps me understand the target sonic direction.<br/><br/>2 - Character & Description. Detail what you want to achieve: what to preserve or remove. For instance, if you want vocals upfront or drums punchier. Explain the track\'s energy and which elements should grab the listener\'s attention first.<br/><br/>3 - Additional Info. Mention anything critical about the recording: e.g., if it was recorded at home with background noise or artifacts you can\'t re-record. Conversely, highlight any specific parts you\'re proud of and want featured prominently. Please mention if you have a tight deadline so I can plan accordingly.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>I see you\'re interested in working together! Message me <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> on Telegram to get <strong class="text-amber-400 font-bold">10% off</strong> your first order.</span></div>',
        mobile: 'Describe your vision for the final result in as much detail as possible:<br/><br/>1 - References. Send 2–3 tracks by other artists as files (or links) whose sound you admire. It could be the bass from one track, the vocal treatment from another, or the general vibe from a third. This helps me understand the target sonic direction.<br/><br/>2 - Character & Description. Detail what you want to achieve: what to preserve or remove. For instance, if you want vocals upfront or drums punchier. Explain the track\'s energy and which elements should grab the listener\'s attention first.<br/><br/>3 - Additional Info. Mention anything critical about the recording: e.g., if it was recorded at home with background noise or artifacts you can\'t re-record. Conversely, highlight any specific parts you\'re proud of and want featured prominently. Please mention if you have a tight deadline so I can plan accordingly.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>I see you\'re interested in working together! Message me <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> on Telegram to get <strong class="text-amber-400 font-bold">10% off</strong> your first order.</span></div>'
      }
    },
    {
      qRu: {
        desktop: 'Входят ли в стоимость правки?',
        tablet: 'Входят ли в стоимость правки?',
        mobile: 'Входят ли в стоимость правки?'
      },
      qEn: {
        desktop: 'Are revisions included in the price?',
        tablet: 'Are revisions included in the price?',
        mobile: 'Are revisions included in the price?'
      },
      aRu: {
        desktop: 'Да, в стоимость входит 3 итерации правок.<br/><br/>Это означает, что после получения чернового микса вы можете прислать список замечаний. Я вношу правки, вы слушаете обновлённую версию и при необходимости отправляете новый список. Так до трёх раз.<br/><br/>Важные правила:<br/><br/>1 - Замечания лучше присылать одним общим списком, а не по одному сообщению в день, при надобности указывайте чёткие тайминги, куда нужно вносить правку. Так мы не тратим время зря.<br/><br/>2 - Если после трёх итераций вы всё ещё недовольны — дальнейшие правки оплачиваются отдельно: одна итерация правок — 500₽.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>Вижу вам интересно сотрудничество со мной! Напишите мне в Телеграм <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> и получите скидку на первый заказ в размере <strong class="text-amber-400 font-bold">10%</strong></span></div>',
        tablet: 'Да, в стоимость входит 3 итерации правок.<br/><br/>Это означает, что после получения чернового микса вы можете прислать список замечаний. Я вношу правки, вы слушаете обновлённую версию и при необходимости отправляете новый список. Так до трёх раз.<br/><br/>Важные правила:<br/><br/>1 - Замечания лучше присылать одним общим списком, а не по одному сообщению в день, при надобности указывайте чёткие тайминги, куда нужно вносить правку. Так мы не тратим время зря.<br/><br/>2 - Если после трёх итераций вы всё ещё недовольны — дальнейшие правки оплачиваются отдельно: одна итерация правок — 500₽.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>Вижу вам интересно сотрудничество со мной! Напишите мне в Телеграм <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> и получите скидку на первый заказ в размере <strong class="text-amber-400 font-bold">10%</strong></span></div>',
        mobile: 'Да, в стоимость входит 3 итерации правок.<br/><br/>Это означает, что после получения чернового микса вы можете прислать список замечаний. Я вношу правки, вы слушаете обновлённую версию и при необходимости отправляете новый список. Так до трёх раз.<br/><br/>Важные правила:<br/><br/>1 - Замечания лучше присылать одним общим списком, а не по одному сообщению в день, при надобности указывайте чёткие тайминги, куда нужно вносить правку. Так мы не тратим время зря.<br/><br/>2 - Если после трёх итераций вы всё ещё недовольны — дальнейшие правки оплачиваются отдельно: одна итерация правок — 500₽.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>Вижу вам интересно сотрудничество со мной! Напишите мне в Телеграм <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> и получите скидку на первый заказ в размере <strong class="text-amber-400 font-bold">10%</strong></span></div>'
      },
      aEn: {
        desktop: 'Yes, the price includes up to 3 rounds of revisions.<br/><br/>This means after receiving the initial draft, you can send a list of feedback. I update the mix, you review the new version, and if necessary, submit another list — up to three times.<br/><br/>Important Guidelines:<br/><br/>1 - Please consolidate your feedback into a single organized list (with specific timestamps where adjustments are needed) rather than sending separate messages daily. This saves valuable time.<br/><br/>2 - If additional revisions are needed after 3 rounds, further changes are billed separately at $10 per revision round.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>I see you\'re interested in working together! Message me <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> on Telegram to get <strong class="text-amber-400 font-bold">10% off</strong> your first order.</span></div>',
        tablet: 'Yes, the price includes up to 3 rounds of revisions.<br/><br/>This means after receiving the initial draft, you can send a list of feedback. I update the mix, you review the new version, and if necessary, submit another list — up to three times.<br/><br/>Important Guidelines:<br/><br/>1 - Please consolidate your feedback into a single organized list (with specific timestamps where adjustments are needed) rather than sending separate messages daily. This saves valuable time.<br/><br/>2 - If additional revisions are needed after 3 rounds, further changes are billed separately at $10 per revision round.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>I see you\'re interested in working together! Message me <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> on Telegram to get <strong class="text-amber-400 font-bold">10% off</strong> your first order.</span></div>',
        mobile: 'Yes, the price includes up to 3 rounds of revisions.<br/><br/>This means after receiving the initial draft, you can send a list of feedback. I update the mix, you review the new version, and if necessary, submit another list — up to three times.<br/><br/>Important Guidelines:<br/><br/>1 - Please consolidate your feedback into a single organized list (with specific timestamps where adjustments are needed) rather than sending separate messages daily. This saves valuable time.<br/><br/>2 - If additional revisions are needed after 3 rounds, further changes are billed separately at $10 per revision round.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>I see you\'re interested in working together! Message me <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> on Telegram to get <strong class="text-amber-400 font-bold">10% off</strong> your first order.</span></div>'
      }
    },
    {
      qRu: {
        desktop: 'Какой срок выполнения заказа?',
        tablet: 'Какой срок выполнения заказа?',
        mobile: 'Какой срок выполнения заказа?'
      },
      qEn: {
        desktop: 'What is the estimated turnaround time?',
        tablet: 'What is the estimated turnaround time?',
        mobile: 'What is the estimated turnaround time?'
      },
      aRu: {
        desktop: 'Стандартный срок — от 3 до 5 рабочих дней на один трек.<br/><br/>Время зависит от количества дорожек и сложности материала. Точную дату я называю после того, как послушаю ваши мультитреки.<br/><br/>Если нужно быстрее — я могу сделать трек за 24–48 часов. Стоимость срочного заказа увеличивается на 5000₽.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>Вижу вам интересно сотрудничество со мной! Напишите мне в Телеграм <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> и получите скидку на первый заказ в размере <strong class="text-amber-400 font-bold">10%</strong></span></div>',
        tablet: 'Стандартный срок — от 3 до 5 рабочих дней на один трек.<br/><br/>Время зависит от количества дорожек и сложности материала. Точную дату я называю после того, как послушаю ваши мультитреки.<br/><br/>Если нужно быстрее — я могу сделать трек за 24–48 часов. Стоимость срочного заказа увеличивается на 5000₽.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>Вижу вам интересно сотрудничество со мной! Напишите мне в Телеграм <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> и получите скидку на первый заказ в размере <strong class="text-amber-400 font-bold">10%</strong></span></div>',
        mobile: 'Стандартный срок — от 3 до 5 рабочих дней на один трек.<br/><br/>Время зависит от количества дорожек и сложности материала. Точную дату я называю после того, как послушаю ваши мультитреки.<br/><br/>Если нужно быстрее — я могу сделать трек за 24–48 часов. Стоимость срочного заказа увеличивается на 5000₽.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>Вижу вам интересно сотрудничество со мной! Напишите мне в Телеграм <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> и получите скидку на первый заказ в размере <strong class="text-amber-400 font-bold">10%</strong></span></div>'
      },
      aEn: {
        desktop: 'Standard turnaround is 3 to 5 business days per track.<br/><br/>Delivery time depends on track count and complexity. I will provide an exact timeframe after reviewing your multitrack stems.<br/><br/>If you are in a rush, express delivery (24–48 hours) is available with a $100 rush order surcharge.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>I see you\'re interested in working together! Message me <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> on Telegram to get <strong class="text-amber-400 font-bold">10% off</strong> your first order.</span></div>',
        tablet: 'Standard turnaround is 3 to 5 business days per track.<br/><br/>Delivery time depends on track count and complexity. I will provide an exact timeframe after reviewing your multitrack stems.<br/><br/>If you are in a rush, express delivery (24–48 hours) is available with a $100 rush order surcharge.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>I see you\'re interested in working together! Message me <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> on Telegram to get <strong class="text-amber-400 font-bold">10% off</strong> your first order.</span></div>',
        mobile: 'Standard turnaround is 3 to 5 business days per track.<br/><br/>Delivery time depends on track count and complexity. I will provide an exact timeframe after reviewing your multitrack stems.<br/><br/>If you are in a rush, express delivery (24–48 hours) is available with a $100 rush order surcharge.<div class="mt-4 p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-sm flex items-start sm:items-center gap-3"><svg class="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5 sm:mt-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 2 20 2 15V8a2 2 0 012-2h16a2 2 0 012 2v7c0 5-8.832 6-10 6z"/></svg><span>I see you\'re interested in working together! Message me <strong class="text-amber-400 font-bold">"NRSDiscount"</strong> on Telegram to get <strong class="text-amber-400 font-bold">10% off</strong> your first order.</span></div>'
      }
    }
  ]
};
