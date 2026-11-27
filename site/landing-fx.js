/* CEASER AI landing FX v21 — particles, scroll progress, reveal, count-up, tilt, card glow.
   Everything pauses when the tab is hidden and is skipped for reduced-motion. */
(function () {
  'use strict';
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FX = window.CzFX = {};
  var canvas, ctx, pts = [], raf = 0, W = 0, H = 0, run = false, mx = -9999, my = -9999;

  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.round(Math.min(70, Math.max(26, W * H / 16000)));
    pts = [];
    for (var i = 0; i < n; i++) pts.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .28, vy: (Math.random() - .5) * .28, r: Math.random() * 1.5 + .6 });
  }
  function frame() {
    if (!run) return;
    ctx.clearRect(0, 0, W, H);
    var i, j, p, q, dx, dy, d;
    for (i = 0; i < pts.length; i++) {
      p = pts[i]; p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
      dx = p.x - mx; dy = p.y - my; d = dx * dx + dy * dy;
      if (d < 14000) { p.x += dx * .004; p.y += dy * .004; }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fillStyle = 'rgba(120,255,200,.75)'; ctx.fill();
      for (j = i + 1; j < pts.length; j++) {
        q = pts[j]; dx = p.x - q.x; dy = p.y - q.y; d = dx * dx + dy * dy;
        if (d < 12000) { ctx.strokeStyle = 'rgba(80,200,255,' + (.2 * (1 - d / 12000)).toFixed(3) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
      }
    }
    raf = requestAnimationFrame(frame);
  }
  function start() { if (run || RM) return; run = true; raf = requestAnimationFrame(frame); }
  function stop() { run = false; cancelAnimationFrame(raf); }

  function particles() {
    if (RM || document.getElementById('cz-fx')) return;
    canvas = document.createElement('canvas'); canvas.id = 'cz-fx'; canvas.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(canvas, document.body.firstChild);
    ctx = canvas.getContext('2d'); if (!ctx) return;
    size(); var t; addEventListener('resize', function () { clearTimeout(t); t = setTimeout(size, 200); });
    addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; }, { passive: true });
    addEventListener('pointerleave', function () { mx = my = -9999; });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    start();
  }

  function progress() {
    if (document.getElementById('cz-prog')) return;
    var b = document.createElement('div'); b.id = 'cz-prog'; document.body.appendChild(b);
    var tick = false;
    function upd() { tick = false; var h = document.documentElement.scrollHeight - innerHeight; b.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')'; }
    addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }

  function countUp(el) {
    var to = parseFloat(el.getAttribute('data-to')), suf = el.getAttribute('data-suf') || '';
    if (isNaN(to) || RM) return;
    var t0 = performance.now(), dur = 1400;
    (function s(t) { var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e) + suf; if (k < 1) requestAnimationFrame(s); })(t0);
  }

  FX.reveal = function (root) {
    var list = root.querySelectorAll('.rv:not(.in)');
    if (!('IntersectionObserver' in window)) { document.documentElement.classList.add('no-io'); list.forEach(function (n) { n.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
    list.forEach(function (n, i) { n.style.transitionDelay = (i % 3) * 70 + 'ms'; io.observe(n); });
  };

  FX.init = function (root) {
    particles(); progress();
    if (!root) return;
    root.querySelectorAll('.stats b[data-to]').forEach(function (b) {
      if (!('IntersectionObserver' in window)) return;
      var o = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { o.disconnect(); countUp(b); } }, { threshold: .6 });
      o.observe(b);
    });
    // pointer / touch spotlight on cards
    root.addEventListener('pointermove', function (e) {
      var c = e.target.closest && e.target.closest('.card,.step'); if (!c) return;
      var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
    // gentle 3D tilt on the demo window (fine pointers only)
    var win = root.querySelector('.hero .win');
    if (win && !RM && matchMedia('(hover:hover) and (pointer:fine)').matches) {
      win.addEventListener('pointermove', function (e) { var r = win.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; win.style.transform = 'perspective(900px) rotateY(' + (x * 7).toFixed(2) + 'deg) rotateX(' + (-y * 7).toFixed(2) + 'deg)'; win.style.animationPlayState = 'running,paused'; });
      win.addEventListener('pointerleave', function () { win.style.transform = ''; win.style.animationPlayState = ''; });
    }
  };
})();
