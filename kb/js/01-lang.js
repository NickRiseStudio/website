// ═══════════════════════════════════════════════════════════════════════
// kb/js/01-lang.js — ЯЗЫК: АВТООПРЕДЕЛЕНИЕ ПО РЕГИОНУ И ПЕРЕКЛЮЧАТЕЛЬ
// Грузится: kb/index.html в <head> БЕЗ defer — атрибут html[data-lang]
//         должен стоять до первой отрисовки, иначе страница мигнёт чужим
//         языком. DOM на этом моменте ещё не разобран, поэтому работа с
//         кнопками отложена до DOMContentLoaded.
// Читает: localStorage (ключ nick_rise_lang — общий с основным сайтом),
//         navigator.languages, Intl.
// Публичные (window): setKbLang, detectKbLang.
// Блоки файла:
//   • Определение языка: сохранённый выбор → языки и страны → таймзоны.
//   • setKbLang — переключение html[data-lang] и состояния кнопок.
//   • Обработчик переключателя RU/EN.
// ═══════════════════════════════════════════════════════════════════════

/* Ключ тот же, что у основного сайта (js/i18n.js): домен один, поэтому
   выбор языка переносится в обе стороны. Пришёл с сайта — здесь тот же
   язык; переключил здесь — сайт откроется на нём же. */
var KB_LANG_KEY = 'nick_rise_lang';

// Языки, носители которых ожидают русскоязычную страницу. 'mo' — устаревший
// код молдавского, далее — языки народов РФ (локаль обычно вида tt-RU).
var KB_RU_LANGS = [
  'ru', 'be', 'uk', 'kk', 'ky', 'uz', 'tg', 'tk', 'hy', 'az', 'mo',
  'ab', 'av', 'ba', 'ce', 'cv', 'os', 'tt', 'udm', 'sah'
];

// Страны СНГ и постсоветского пространства (ISO 3166-1 alpha-2)
var KB_RU_COUNTRIES = [
  'RU', 'BY', 'KZ', 'KG', 'UZ', 'TJ', 'TM', 'AM', 'AZ', 'MD', 'UA'
];

// Города в названиях таймзон: срабатывает, когда браузер сообщает только
// английскую локаль (en-US у человека, живущего в России).
var KB_RU_TIMEZONES = [
  'moscow', 'kirov', 'volgograd', 'astrakhan', 'ulyanovsk', 'saratov', 'samara',
  'kaliningrad', 'simferopol', 'zaporozhye', 'minsk', 'kyiv', 'kiev', 'chisinau',
  'tiraspol', 'yekaterinburg', 'omsk', 'novosibirsk', 'barnaul', 'tomsk',
  'novokuznetsk', 'krasnoyarsk', 'irkutsk', 'chita', 'yakutsk', 'khandyga',
  'vladivostok', 'ust-nera', 'magadan', 'sakhalin', 'srednekolymsk', 'kamchatka',
  'anadyr', 'almaty', 'qostanay', 'aqtobe', 'aqtau', 'atyrau', 'oral',
  'qyzylorda', 'bishkek', 'tashkent', 'samarkand', 'dushanbe', 'ashgabat',
  'yerevan', 'baku'
];

// Код страны из локали: 'ru-RU' → 'RU', 'en-BY' → 'BY', 'uk_UA' → 'UA'
function kbLocaleRegion(locale) {
  var parts = String(locale || '').replace(/_/g, '-').split('-');
  for (var i = 1; i < parts.length; i++) {
    if (/^[a-zA-Z]{2}$/.test(parts[i])) return parts[i].toUpperCase();
  }
  return '';
}

function detectKbLang() {
  // 1. Ручной выбор пользователя — приоритетнее любых догадок. Сюда же
  //    попадает выбор, сделанный на основном сайте.
  try {
    var saved = localStorage.getItem(KB_LANG_KEY);
    if (saved === 'ru' || saved === 'en') return saved;
  } catch (e) {}

  // 2. Языки браузера: проверяем и код языка, и код страны
  try {
    var langs = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || navigator.userLanguage || ''];

    for (var i = 0; i < langs.length; i++) {
      var raw = String(langs[i] || '').trim();
      if (!raw) continue;

      var base = raw.replace(/_/g, '-').split('-')[0].toLowerCase();
      if (KB_RU_LANGS.indexOf(base) !== -1) return 'ru';

      var region = kbLocaleRegion(raw);
      if (region && KB_RU_COUNTRIES.indexOf(region) !== -1) return 'ru';
    }
  } catch (e) {}

  // 3. Часовой пояс — когда локаль английская, а человек в СНГ
  try {
    var tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').toLowerCase();
    if (tz) {
      for (var j = 0; j < KB_RU_TIMEZONES.length; j++) {
        if (tz.indexOf(KB_RU_TIMEZONES[j]) !== -1) return 'ru';
      }
    }
  } catch (e) {}

  // 4. Все остальные регионы — английская версия
  return 'en';
}

/* Переключение языка: атрибут на html управляет видимостью текстов
   (kb/css/style/01-base.css) и ползунком в шапке (kb/css/style/02-header.css).
   save = true — запомнить выбор, чтобы основной сайт открылся на нём же. */
function setKbLang(lang, save) {
  if (lang !== 'ru' && lang !== 'en') lang = 'en';

  document.documentElement.setAttribute('data-lang', lang);
  document.documentElement.setAttribute('lang', lang);

  var ru = document.getElementById('kbLangRu');
  var en = document.getElementById('kbLangEn');
  if (ru) ru.setAttribute('aria-pressed', lang === 'ru' ? 'true' : 'false');
  if (en) en.setAttribute('aria-pressed', lang === 'en' ? 'true' : 'false');

  if (save) {
    try { localStorage.setItem(KB_LANG_KEY, lang); } catch (e) {}
  }
}

// Язык ставим сразу — до разбора body и до первой отрисовки.
setKbLang(detectKbLang(), false);

// Кнопки переключателя появляются позже: страницу разбирают уже после
// этого файла.
document.addEventListener('DOMContentLoaded', function () {
  setKbLang(document.documentElement.getAttribute('data-lang') || detectKbLang(), false);

  var toggle = document.getElementById('kbLangToggle');
  if (!toggle) return;

  /* Клик ловится на капсуле целиком: по букве — переход на её язык, по фону
     капсулы, ползунку или уже выбранной букве — на противоположный. Кнопки
     настоящие, поэтому Enter и Space браузер превращает в click сам;
     отдельный обработчик клавиш дал бы двойное переключение. */
  toggle.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-kb-lang]') : null;
    var want = btn ? btn.getAttribute('data-kb-lang') : '';
    var current = document.documentElement.getAttribute('data-lang');
    if (want && want !== current) {
      setKbLang(want, true);
      return;
    }
    setKbLang(current === 'ru' ? 'en' : 'ru', true);
  });
});
