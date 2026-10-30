// ═══════════════════════════════════════════════════════════════════════
// kb/animations.js — ЭФФЕКТЫ БАЗЫ ЗНАНИЙ: ЗАСТАВКА И ВХОД ПАНЕЛЕЙ
// Грузится: kb/index.html — в конце body, defer, СТРОГО последним: после
//         kb/js/07-articles.js (вид страницы уже расставлен) и
//         kb/js/03-hint.js (он ждёт событие kb:boot-done). Заставке нужен
//         готовый window.nrSmoothScroll — его отдаёт kb/js/06-smooth-scroll.js.
// Читает: #kb-boot, <html> (класс kb-intro), document.readyState,
//         prefers-reduced-motion, window.load.
// Публичные (window): нет — модуль самодостаточный.
// Блоки файла:
//   • initBoot — показ заставки, лок страницы, гашение по готовности.
//   • playPanelIntro — снятие kb-intro: панели входят (css/anim/02-panels.css).
//   • unlockPage — снятие лока, пересчёт плавной прокрутки, kb:boot-done.
// ═══════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  /* «Уменьшить движение»: кадр заставки статичен (css/anim/01-boot.css),
     держать его долго незачем — отсюда короткий MIN_HOLD. */
  var REDUCED = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initBoot() {
    var boot = document.getElementById('kb-boot');

    /* Заставки нет — класс kb-intro снять всё равно нужно, иначе панели
       остались бы в начальном состоянии навсегда. */
    if (!boot) {
      document.documentElement.classList.remove('kb-intro');
      return;
    }

    /* Инлайн-страховка в разметке уже погасила оверлей (скрипт подгрузился
       позже четырёх секунд) — лока и входа больше нет. */
    if (boot.classList.contains('kb-boot-done') || boot.style.display === 'none') {
      document.documentElement.classList.remove('kb-intro');
      return;
    }

    /* Прогрев ламп до последней заканчивается у ~1.5 с (animation-delay
       в css/anim/01-boot.css). Держим заставку ровно столько, чтобы прогрев
       читался целиком. */
    var MIN_HOLD = REDUCED ? 400 : 1500;
    var FADE_MS = 470;    /* чуть больше CSS-перехода opacity 0.42s */

    function blockScroll(e) { e.preventDefault(); }
    function blockKeys(e) {
      var k = e.key || '';
      if (k === 'Tab') {
        e.preventDefault();
        boot.focus({ preventScroll: true }); /* фокус «застревает» в оверлее */
        return;
      }
      /* Пробел/стрелки/PageUp… иначе прокрутят панель за оверлеем. */
      if (k === ' ' || k === 'Spacebar' || /^(Arrow|PageUp|PageDown|Home|End)/.test(k)) {
        e.preventDefault();
      }
    }

    function lockPage() {
      if (boot.dataset.locked) return;
      boot.dataset.locked = '1';
      document.documentElement.classList.add('kb-boot-active');
      window.addEventListener('wheel', blockScroll, { passive: false, capture: true });
      window.addEventListener('touchmove', blockScroll, { passive: false, capture: true });
      window.addEventListener('keydown', blockKeys, { capture: true });
    }

    function unlockPage() {
      if (!boot.dataset.locked) return;
      delete boot.dataset.locked;
      document.documentElement.classList.remove('kb-boot-active');
      window.removeEventListener('wheel', blockScroll, { capture: true });
      window.removeEventListener('touchmove', blockScroll, { capture: true });
      window.removeEventListener('keydown', blockKeys, { capture: true });
      /* Плавная прокрутка создана на DOMContentLoaded, пока панель стояла
         под оверлеем и её ширина была сдвинута входом, — пересчитываем
         предел прокрутки в момент, когда страница стала интерактивной. */
      if (window.nrSmoothScroll && typeof window.nrSmoothScroll.resync === 'function') {
        window.nrSmoothScroll.resync();
      }
    }

    /* Класс kb-intro ставит инлайн-скрипт в head (до первой отрисовки).
       Снимаем его в момент гашения — панели входят сквозь уходящий оверлей. */
    function playPanelIntro() {
      document.documentElement.classList.remove('kb-intro');
    }

    function hideBoot() {
      if (boot.classList.contains('kb-boot-hide')) return;
      boot.classList.add('kb-boot-hide'); /* фейд; клики и дальше съедает оверлей */
      playPanelIntro();
      setTimeout(function () {
        boot.classList.add('kb-boot-done'); /* display:none — последний кадр окна */
        unlockPage();                       /* только теперь страница интерактивна */
        /* Подсказка (kb/js/03-hint.js) показывает себя только после этого
           события: пока заставка видна, бабл ей не место. Событие шлём здесь,
           а не в unlockPage: при «уменьшить движение» лока нет и unlockPage
           выходит сразу. */
        document.dispatchEvent(new CustomEvent('kb:boot-done'));
      }, FADE_MS);
    }

    function ready() {
      var elapsed = Date.now() - Number(boot.dataset.bootStart || 0);
      if (elapsed < MIN_HOLD) {
        setTimeout(ready, MIN_HOLD - elapsed + 30);
        return;
      }
      hideBoot();
    }

    boot.dataset.bootStart = String(Date.now());
    if (!REDUCED) {
      lockPage();
      boot.setAttribute('tabindex', '-1');
      boot.focus({ preventScroll: true });
    }
    if (document.readyState === 'complete') {
      ready();
    } else {
      window.addEventListener('load', ready, { once: true });
      setTimeout(ready, 2000); /* страховка: не ждём вечно */
    }
  }

  function init() {
    initBoot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();