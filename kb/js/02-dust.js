// ═══════════════════════════════════════════════════════════════════════
// kb/js/02-dust.js — ФОН: ПЫЛИНКИ-ЧАСТИЦЫ
// Грузится: kb/index.html, в конце body, defer.
// Читает: window.devicePixelRatio, prefers-reduced-motion.
// Публичные (window): нет — модуль самодостаточный.
// Блоки файла:
//   • Холст #kb-dust на весь экран, позади контента (kb/css/style/01-base.css).
//   • Спрайт-ореол пылинки, частицы, отрисовка в requestAnimationFrame.
// ═══════════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  /* «Уменьшить движение» — системная настройка: слой не создаётся вовсе,
     кадры не рисуются. */
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var TAU = Math.PI * 2;

  var canvas = document.createElement('canvas');
  canvas.id = 'kb-dust';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  var w = 0;
  var h = 0;
  var dpr = 1;
  var particles = [];
  var prevTime = 0;

  /* Мягкий янтарный ореол одной пылинки. Рисуется один раз в 64x64 и потом
     просто копируется — радиальный градиент на каждую частицу в каждом
     кадре стоил бы заметно дороже. */
  function makeSprite() {
    var size = 64;
    var c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    var g = c.getContext('2d');
    var rg = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    rg.addColorStop(0, 'rgba(255, 236, 190, 1)');
    rg.addColorStop(0.28, 'rgba(251, 191, 36, 0.55)');
    rg.addColorStop(1, 'rgba(245, 158, 11, 0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, size, size);
    return c;
  }

  var sprite = makeSprite();

  /* Частица живёт в пикселях слоя, высота считается ОТ НИЗА (d): низ слоя
     привязан к низу экрана, поэтому пылинки не двигаются при появлении и
     скрытии плашек браузера. */
  function makeParticle() {
    var depth = Math.random();          /* глубина: 0 — далеко, 1 — близко */
    return {
      x: Math.random() * w,
      d: Math.random() * h,
      sp: 8 + depth * 14,               /* скорость подъёма, px/с */
      glow: 5 + (1 - depth) * 7,        /* радиус ореола, px */
      alpha: 0.05 + depth * 0.11,       /* яркость: дальние тусклее */
      swayAmp: 4 + depth * 8,           /* размах бокового покачивания, px */
      swaySpd: 0.15 + Math.random() * 0.25,
      phase: Math.random() * TAU,
      flickSpd: 0.4 + Math.random() * 0.9,
      flickPhase: Math.random() * TAU
    };
  }

  function sizeCanvas() {
    var nextDpr = Math.min(window.devicePixelRatio || 1, 1.5);
    /* Размер берём у самого слоя: его высота задана в lvh и от адресной
       плашки не зависит. */
    var nextW = Math.max(1, Math.round(canvas.clientWidth || window.innerWidth));
    var nextH = Math.max(1, Math.round(canvas.clientHeight || window.innerHeight));
    if (nextW === w && nextH === h && nextDpr === dpr) return;

    w = nextW;
    h = nextH;
    dpr = nextDpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /* После сужения окна за правый край уходят только те, кому не хватило
       ширины; высоту не трогаем — позиция от низа от неё не зависит. */
    for (var i = 0; i < particles.length; i++) {
      if (particles[i].x > w) particles[i].x = Math.random() * w;
    }
  }

  function initParticles() {
    /* На телефоне частиц меньше: экран маленький, плотность та же. */
    var count = window.innerWidth < 640 ? 30 : 62;
    particles = [];
    for (var i = 0; i < count; i++) particles.push(makeParticle());
  }

  function draw(now) {
    if (!prevTime) prevTime = now;
    var dt = Math.min(0.1, (now - prevTime) / 1000) || 0.016;
    prevTime = now;

    ctx.clearRect(0, 0, w, h);
    var t = now / 1000;

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];

      /* Вверх по экрану — дальше от нижней кромки слоя. */
      p.d += p.sp * dt;
      if (p.d > h + p.glow * 2) {
        p.d = -p.glow * 2;
        p.x = Math.random() * w;
      }

      var x = p.x + Math.sin(t * p.swaySpd + p.phase) * p.swayAmp;
      var y = h - p.d;
      var flick = 0.7 + 0.3 * Math.sin(t * p.flickSpd + p.flickPhase);

      ctx.globalAlpha = p.alpha * flick;
      ctx.drawImage(sprite, x - p.glow, y - p.glow, p.glow * 2, p.glow * 2);
    }

    ctx.globalAlpha = 1;
    window.requestAnimationFrame(draw);
  }

  sizeCanvas();
  initParticles();
  window.requestAnimationFrame(draw);

  window.addEventListener('resize', sizeCanvas);
})();
