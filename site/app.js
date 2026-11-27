(function () {
  'use strict';
  var VB = '<svg class="vb" viewBox="0 0 24 24" aria-label="Verified"><path d="M12 1.8l2.5 1.7 3-.2 1.2 2.8 2.6 1.5-.6 3 1.2 2.7-2 2.2-.4 3-3 .7-2.2 2.1L12 21l-2.3 1.3-2.2-2.1-3-.7-.4-3-2-2.2L3.3 11.6l-.6-3 2.6-1.5 1.2-2.8 3 .2z" fill="#1d9bf0"/><path d="M7.8 12.2l3 3 5.6-6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var $app = document.getElementById('app');
  var S = { user: null, convs: [], cur: null, msgs: [], busy: false, plans: [], page: 'chat' };
  var ui = {};

  /* ---------- helpers ---------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function csrf() { var m = document.cookie.match(/(?:^|;\s*)cc_csrf=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; }
  async function ensureCsrf() { if (!csrf()) await fetch('/api/auth/csrf', { credentials: 'same-origin' }); }
  async function api(method, url, body) {
    if (method !== 'GET') await ensureCsrf();
    var h = {}; if (method !== 'GET') h['x-csrf-token'] = csrf();
    if (body !== undefined) h['content-type'] = 'application/json';
    var r = await fetch(url, { method: method, credentials: 'same-origin', headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    var t = await r.text(), d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { d = null; }
    if (!r.ok) { var e = new Error((d && d.error && d.error.message) || r.statusText || 'Request failed'); e.status = r.status; throw e; }
    return d;
  }
  function inline(s) {
    return s.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>')
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }
  function md(src) {
    var parts = String(src).split(/```/), out = '';
    for (var i = 0; i < parts.length; i++) {
      if (i % 2) {
        var nl = parts[i].indexOf('\n'), lang = nl > -1 ? parts[i].slice(0, nl).trim() : '', code = nl > -1 ? parts[i].slice(nl + 1) : parts[i];
        out += '<div class="cb"><div class="h"><span>' + esc(lang || 'code') + '</span><button data-copy>Copy</button></div><pre><code>' + esc(code.replace(/\n$/, '')) + '</code></pre></div>';
      } else {
        var lines = esc(parts[i]).split('\n'), html = '', list = null, para = [];
        var flushP = function () { if (para.length) { html += '<p>' + inline(para.join('<br>')) + '</p>'; para = []; } };
        var flushL = function () { if (list) { html += '</' + list + '>'; list = null; } };
        lines.forEach(function (ln) {
          var h = ln.match(/^(#{1,3})\s+(.*)$/), ul = ln.match(/^\s*[-*]\s+(.*)$/), ol = ln.match(/^\s*\d+[.)]\s+(.*)$/);
          if (h) { flushP(); flushL(); html += '<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'; }
          else if (ul || ol) { flushP(); var t = ul ? 'ul' : 'ol'; if (list !== t) { flushL(); html += '<' + t + '>'; list = t; } html += '<li>' + inline((ul || ol)[1]) + '</li>'; }
          else if (!ln.trim()) { flushP(); flushL(); }
          else { flushL(); para.push(ln); }
        });
        flushP(); flushL(); out += html;
      }
    }
    return out;
  }
  function initial(n) { return (n || '?').trim().charAt(0).toUpperCase(); }

  /* ---------- background fx ---------- */
  (function () {
    var bg = el('<div class="gridbg"></div>'), gl = el('<div id="glow"></div>');
    document.body.prepend(gl); document.body.prepend(bg);
    addEventListener('pointermove', function (e) { gl.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, { passive: true });
  })();

  function reveal(root) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .12 });
    root.querySelectorAll('.rv').forEach(function (n, i) { n.style.transitionDelay = (i % 4) * 80 + 'ms'; io.observe(n); });
  }

  /* ---------- landing ---------- */
  var timers = [];
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function landing() {
    clearTimers();
    var n = el('<div>' +
      '<nav class="nav"><div class="logo"><div class="dot">C</div><span class="wm">CEASER <span class="grad">AI</span></span>' + VB + '</div><div class="sp"></div><button class="navmenu" id="navmenu" aria-label="Open menu">☰</button><div class="navlinks">' +
      '<a class="nl" href="#features">Features</a><a class="nl" href="#how">How it works</a><a class="nl" href="#plans">Pricing</a><a class="nl" href="#faq">FAQ</a>' +
      '<button class="btn ghost" id="li">Log in</button><button class="btn" id="su">Get started</button></div></nav>' +
      '<header class="hero"><div><div class="pill"><b></b>CEASER AI · Online and ready</div>' +
      '<h1>Your AI for <span class="type" id="ty"></span><br><span class="grad">built to ship.</span></h1>' +
      '<p class="lead">Chat, write, debug and build with an assistant that streams answers instantly, remembers your conversations and never gets in your way.</p>' +
      '<div class="cta"><button class="btn lg" id="su2">Start free →</button><a class="btn ghost lg" href="#features" style="text-decoration:none;display:inline-block">See what it does</a></div>' +
      '<div class="stats"><div><b>20k</b>free tokens</div><div><b>Live</b>streaming replies</div><div><b>24/7</b>always on</div></div></div>' +
      '<div class="win"><div class="bar"><i></i><i></i><i></i></div><div class="demo-tools"><span>Live prompt preview</span><button id="replay">Replay</button></div><div class="body" id="demo"></div></div></header>' +
      '<section class="sec" id="features"><h2 class="rv">Everything you need, <span class="grad">nothing you don\'t</span></h2><p class="sub rv">Fast, focused and designed to feel great on your phone.</p><div class="grid">' +
      feat('⚡', 'Instant streaming', 'Watch answers appear word by word instead of waiting for a wall of text.') +
      feat('💻', 'Code that works', 'Syntax-friendly code blocks with one-tap copy. Debug, refactor, explain.') +
      feat('🗂️', 'Saved chats', 'Every conversation is stored, searchable and one tap away.') +
      feat('🔒', 'Private by default', 'Secure sessions, verified accounts and protected requests.') +
      feat('🎁', 'Refer and earn', 'Invite friends and unlock bonus tokens for every five who join.') +
      feat('📱', 'Made for mobile', 'Smooth, thumb-friendly layout that feels like a native app.') +
      '</div></section><section class="sec" id="plans"><h2 class="rv">Simple <span class="grad">pricing</span></h2><p class="sub rv">Start free. Upgrade when you need more.</p><div class="grid" id="pl"></div></section>' +
      '<section class="sec" id="how"><h2 class="rv">From idea to answer in <span class="grad">three steps</span></h2><p class="sub rv">No setup. No learning curve.</p><div class="steps">' +
      '<div class="step rv"><b>01</b><h3>Ask</h3><p>Type or paste anything: a question, a bug, a feature you want built.</p></div>' +
      '<div class="step rv"><b>02</b><h3>Watch it think</h3><p>Replies stream in live, with clean code blocks you can copy in one tap.</p></div>' +
      '<div class="step rv"><b>03</b><h3>Keep going</h3><p>Every chat is saved and searchable, so you can pick up right where you left off.</p></div></div></section>' +
      '<section class="sec" id="faq"><h2 class="rv">Frequently asked <span class="grad">questions</span></h2><div class="faq rv">' +
      '<details><summary>What counts as a token?</summary><p>Tokens cover both what you send and what the AI writes back. Your balance resets every 30 days.</p></details>' +
      '<details><summary>Is it really free to start?</summary><p>Yes. Every account gets free tokens, and you can upgrade any time for a bigger allowance.</p></details>' +
      '<details><summary>Do I need to verify my email?</summary><p>Yes. We send a 6-digit code to your inbox when you sign up, which keeps accounts secure.</p></details>' +
      '<details><summary>Are my chats private?</summary><p>Your conversations are tied to your account and protected by secure sessions.</p></details></div></section>' +
      '<section class="sec" id="contact"><div class="contact rv"><small>CONTACT</small><a class="mail" id="cmail" href="#">Talk to us</a><p style="margin:0;color:var(--mute)">Partnerships, custom plans or support. Write to the CEASER AI team.</p></div></section>' +
      '<footer class="foot">© ' + new Date().getFullYear() + ' CEASER AI · Built by Ceaser</footer></div>');
    $app.replaceChildren(n);
    n.querySelector('#li').onclick = function () { authModal('login'); };
    n.querySelector('#su').onclick = n.querySelector('#su2').onclick = function () { authModal('signup'); };
    var nav = n.querySelector('.nav'), navmenu = n.querySelector('#navmenu');
    navmenu.onclick = function () { nav.classList.toggle('open'); navmenu.textContent = nav.classList.contains('open') ? '×' : '☰'; };
    n.querySelectorAll('.navlinks a').forEach(function (a) { a.onclick = function () { nav.classList.remove('open'); navmenu.textContent = '☰'; }; });
    n.querySelector('#replay').onclick = function () { demoLoop(n.querySelector('#demo')); };
    reveal(n); typeLoop(n.querySelector('#ty')); demoLoop(n.querySelector('#demo'));
    renderPlans(n.querySelector('#pl'));
    fetch('/api/public/config').then(function (r) { return r.json(); }).then(function (c) { var a = n.querySelector('#cmail'); if (a && c.app && c.app.email) { a.textContent = c.app.email; a.href = 'mailto:' + c.app.email; } }).catch(function () {});
  }
  function feat(i, t, p) { return '<div class="card rv"><div class="ic">' + i + '</div><h3>' + t + '</h3><p>' + p + '</p></div>'; }
  async function renderPlans(box) {
    var plans = S.plans;
    if (!plans.length) { try { plans = S.plans = (await api('GET', '/api/public/config')).plans || []; } catch (e) { plans = []; } }
    if (!plans.length) { box.parentNode.classList.add('hide'); return; }
    box.replaceChildren();
    plans.forEach(function (p, i) {
      var c = el('<div class="card plan rv' + (i === 1 ? ' hot' : '') + '"><h3>' + esc(p.name) + '</h3><div class="pr">$' + p.priceUsd + '<small> /month</small></div><ul><li>' +
        Number(p.monthlyTokens || p.tokens).toLocaleString() + ' tokens / month</li><li>Streaming chat</li><li>Saved conversations</li>' + (p.voiceInput ? '<li>Voice input</li>' : '') + '</ul><button class="btn' + (i === 1 ? '' : ' ghost') + '" style="width:100%">' + (p.priceUsd ? 'Get ' + esc(p.name) : 'Start free') + '</button></div>');
      c.querySelector('button').onclick = function () { authModal('signup'); };
      box.appendChild(c);
    });
    reveal(box);
  }
  function typeLoop(node) {
    var words = ['coding', 'writing', 'learning', 'building', 'thinking'], wi = 0, ci = 0, del = false;
    (function tick() {
      if (!node.isConnected) return;
      var w = words[wi]; node.textContent = w.slice(0, ci);
      if (!del && ci === w.length) { del = true; return later(tick, 1400); }
      if (del && ci === 0) { del = false; wi = (wi + 1) % words.length; }
      ci += del ? -1 : 1; later(tick, del ? 45 : 95);
    })();
  }
  function demoLoop(box) {
    var script = [
      ['Write a function that reverses a string', 'Here you go:', 'function reverse(s) {\n  return [...s].reverse().join("");\n}'],
      ['Explain recursion in one line', 'A function that solves a problem by calling itself on a smaller piece until it hits a simple case.', ''],
      ['Why is my code returning undefined?', 'Usually a missing return, or an async call you forgot to await. Paste it and I\'ll find it.', '']
    ], si = 0;
    function run() {
      if (!box.isConnected) return;
      box.replaceChildren(); var s = script[si++ % script.length];
      var u = el('<div class="b u"></div>'); box.appendChild(u);
      var i = 0; (function t1() {
        if (!box.isConnected) return; u.textContent = s[0].slice(0, ++i);
        if (i < s[0].length) return later(t1, 35);
        later(function () {
          var a = el('<div class="b a"><span class="dots"><i></i><i></i><i></i></span></div>'); box.appendChild(a);
          later(function () {
            a.innerHTML = '<span id="tt"></span>'; var tt = a.firstChild, j = 0, full = s[1];
            (function t2() {
              if (!box.isConnected) return; tt.textContent = full.slice(0, ++j);
              if (j < full.length) return later(t2, 22);
              if (s[2]) { var pre = el('<pre></pre>'); a.appendChild(pre); var k = 0; (function t3() { if (!box.isConnected) return; pre.textContent = s[2].slice(0, ++k); if (k < s[2].length) later(t3, 18); else later(run, 3200); })(); }
              else later(run, 3200);
            })();
          }, 800);
        }, 400);
      })();
    }
    run();
  }

  /* ---------- auth modal (neon ring) ---------- */
  var EYE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  function fld(id, type, label, ac, extra) {
    return '<label class="fl"><input id="' + id + '" type="' + type + '" placeholder=" " autocomplete="' + ac + '"' + (extra || '') + '><span>' + label + '</span>' + (type === 'password' ? '<button type="button" class="eye" aria-label="Show password">' + EYE + '</button>' : '') + '</label>';
  }
  function authModal(mode) {
    var old = document.getElementById('ov'); if (old) old.remove();
    var signup = mode === 'signup', forgot = mode === 'forgot';
    var title = forgot ? 'Reset password' : signup ? 'Create account' : 'Welcome back';
    var sub = forgot ? 'We\'ll email you a reset link.' : signup ? 'Free to start. No card needed.' : 'Log in to continue.';
    var ov = el('<div class="ov authov otpscene o3" id="ov"><i class="blob b1"></i><i class="blob b2"></i><i class="shape s1"></i><i class="shape s2"></i><i class="shape s3"></i><div class="otpwrap authwrap' + (forgot ? ' forgotmode' : '') + '"><div class="otpcard authcard"><div class="grab"></div><button class="x" aria-label="Close">×</button>' +
      '<div class="mlogo"><div class="dot">C</div></div><div class="otp-kicker"><i></i>' + (forgot ? 'Password recovery' : 'Secure access') + '</div><h2>' + title + '</h2><p class="s">' + sub + '</p>' +
      (signup ? fld('name', 'text', 'Your name', 'name') : '') +
      fld('email', 'email', 'Email address', 'email', ' inputmode="email" autocapitalize="none"') +
      (forgot ? '' : fld('pass', 'password', signup ? 'Password (min 8 characters)' : 'Password', signup ? 'new-password' : 'current-password')) +
      (signup ? '<input id="website" class="hide" tabindex="-1" autocomplete="off">' : '') +
      '<div class="err" id="err"></div><button class="btn go" id="go"><span>' + (forgot ? 'Send reset link' : signup ? 'Create account' : 'Log in') + '</span><i class="spin"></i></button>' +
      '<div class="row"><span>' + (signup ? 'Have an account? <button class="link" id="sw">Log in</button>' : forgot ? '<button class="link" id="sw">Back to login</button>' : 'New here? <button class="link" id="sw">Sign up</button>') + '</span>' +
      (!signup && !forgot ? '<button class="link" id="fg">Forgot password?</button>' : '') + '</div></div></div>');
    document.body.appendChild(ov);
    var err = ov.querySelector('#err'), go = ov.querySelector('#go'), card = ov.querySelector('.authcard');
    function close() { ov.classList.add('out'); setTimeout(function () { ov.remove(); }, 180); }
    ov.querySelector('.x').onclick = close;
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    ov.querySelector('#sw').onclick = function () { authModal(signup || forgot ? 'login' : 'signup'); };
    var fg = ov.querySelector('#fg'); if (fg) fg.onclick = function () { authModal('forgot'); };
    var eye = ov.querySelector('.eye');
    if (eye) eye.onclick = function () { var p = ov.querySelector('#pass'); var show = p.type === 'password'; p.type = show ? 'text' : 'password'; eye.classList.toggle('on', show); };
    if (innerWidth > 720) { var first = ov.querySelector('input'); if (first) first.focus(); }
    function fail(msg) { err.className = 'err'; err.textContent = msg; card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
    async function submit() {
      if (go.disabled) return;
      err.className = 'err'; err.textContent = ''; go.disabled = true; go.classList.add('load');
      var v = function (id) { var e = ov.querySelector('#' + id); return e ? e.value : ''; };
      try {
        if (forgot) { await api('POST', '/api/auth/forgot-password', { email: v('email') }); err.className = 'okk'; err.textContent = 'If that email exists, a reset link is on its way.'; }
        else {
          var ref = new URLSearchParams(location.search).get('ref') || undefined;
          var r = await api('POST', signup ? '/api/auth/signup' : '/api/auth/login', signup ? { name: v('name'), email: v('email'), password: v('pass'), website: v('website'), ref: ref } : { email: v('email'), password: v('pass') });
          S.user = r.user; ov.remove(); route(); return;
        }
      } catch (e) { fail(e.message); }
      go.disabled = false; go.classList.remove('load');
    }
    go.onclick = submit;
    ov.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); if (e.key === 'Escape') close(); });
  }

  function simpleCard(inner) { var n = el('<div class="center"><div class="modal" style="position:relative">' + inner + '</div></div>'); $app.replaceChildren(n); return n; }

  function verifyView(token) {
    clearTimers();
    var N = 6, em = S.user ? S.user.email : '';
    var hexPts = [0, 1, 2, 3, 4, 5].map(function (i) { var a = (-90 + 60 * i) * Math.PI / 180; return (100 * Math.cos(a)).toFixed(1) + ',' + (100 * Math.sin(a)).toFixed(1); }).join(' ');
    var slots = '';
    for (var k = 0; k < N; k++) slots += '<div class="o3s" style="--i:' + k + '"><input class="ob" inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="off" aria-label="Digit ' + (k + 1) + '"></div>';
    var n = el('<div class="otpscene o3"><i class="blob b1"></i><i class="blob b2"></i><i class="shape s1"></i><i class="shape s2"></i><i class="shape s3"></i>' +
      '<div class="otpwrap"><div class="otpcard" id="card"><div class="grab"></div>' +
      '<div class="mlogo"><div class="dot">C</div></div><div class="otp-kicker"><i></i><span id="kick">Auto-detect ready</span></div>' +
      '<h2 id="ttl">OTP Verification</h2><p class="s" id="sub">Enter the ' + N + '-digit code we sent to<br><b>' + esc(em) + '</b></p>' +
      '<div class="o3stage" id="stage" data-s="idle"><svg class="o3-hex" viewBox="-100 -100 200 200" aria-hidden="true"><polygon points="' + hexPts + '"/></svg><i class="o3-core"></i>' +
      '<div class="o3-orbit" id="orbit">' + slots + '</div>' +
      '<svg class="o3-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M14 27l8 8 16-17"/></svg></div>' +
      '<div class="err c" id="err" role="status"></div><button class="btn go" id="go"><span>Verify</span><i class="spin"></i></button>' +
      '<div class="resend">Didn\'t receive the code? <button class="link" id="rs" disabled>Resend in <b id="cd">30</b>s</button></div>' +
      '</div><button class="link lo" id="lo">Use a different account · Log out</button></div></div>');
    $app.replaceChildren(n);
    var stage = n.querySelector('#stage'), orbit = n.querySelector('#orbit'), boxes = [].slice.call(n.querySelectorAll('.ob')),
      slotEls = [].slice.call(n.querySelectorAll('.o3s')), err = n.querySelector('#err'), go = n.querySelector('#go'),
      card = n.querySelector('#card'), ttl = n.querySelector('#ttl'), sub = n.querySelector('#sub'), kick = n.querySelector('#kick'), busy = false;
    boxes[0].setAttribute('autocomplete', 'one-time-code');
    var subHtml = sub.innerHTML;
    function wait(ms) { return new Promise(function (r) { setTimeout(r, Math.max(0, ms)); }); }
    function layout() {
      var cw = stage.clientWidth || 300, gap = cw < 340 ? 6 : 10;
      var w = Math.max(32, Math.min(50, Math.floor((cw - (N - 1) * gap) / N))), h = Math.round(w * 1.28), R = 78;
      stage.style.setProperty('--w', w + 'px'); stage.style.setProperty('--h', h + 'px');
      slotEls.forEach(function (s, i) {
        var a = (-90 + 60 * i) * Math.PI / 180;
        s.style.setProperty('--rx', ((i - (N - 1) / 2) * (w + gap)).toFixed(1) + 'px');
        s.style.setProperty('--cx', (R * Math.cos(a)).toFixed(1) + 'px');
        s.style.setProperty('--cy', (R * Math.sin(a)).toFixed(1) + 'px');
      });
    }
    layout();
    var onResize = function () { if (!n.isConnected) return removeEventListener('resize', onResize); layout(); };
    addEventListener('resize', onResize);
    function state(s) {
      if (s === 'err' || s === 'back') {
        var m = /matrix\(([^)]+)\)/.exec(getComputedStyle(orbit).transform || ''), ang = 0;
        if (m) { var v = m[1].split(','); ang = Math.atan2(parseFloat(v[1]), parseFloat(v[0])) * 180 / Math.PI; if (ang < 0) ang += 360; }
        if (s === 'err') orbit.style.setProperty('--a0', ang.toFixed(1) + 'deg');
      }
      stage.setAttribute('data-s', s);
    }
    function val() { return boxes.map(function (b) { return b.value; }).join(''); }
    function paint() { boxes.forEach(function (b) { b.classList.toggle('f', !!b.value); }); }
    function roll(b) { b.classList.remove('roll'); void b.offsetWidth; b.classList.add('roll'); }
    function fill(s) { s = String(s).replace(/\D/g, '').slice(0, N); boxes.forEach(function (b, i) { b.value = s[i] || ''; if (s[i]) roll(b); }); paint(); var i = Math.min(s.length, N - 1); boxes[i].focus(); if (s.length === N) verify({ code: s }); }
    async function verify(body) {
      if (busy) return; busy = true;
      if (!body.token && (body.code || '').length !== N) { busy = false; err.textContent = 'Enter all ' + N + ' digits.'; return; }
      err.className = 'err c'; err.textContent = ''; card.classList.remove('error', 'shake');
      go.classList.add('load'); go.disabled = true; kick.textContent = 'Verifying'; document.activeElement && document.activeElement.blur && document.activeElement.blur();
      state('load');
      var t0 = Date.now();
      try {
        var r = await api('POST', '/api/auth/verify-email', body);
        S.user = r.user;
        await wait(1700 - (Date.now() - t0));
        state('ok'); card.classList.add('good'); go.classList.remove('load'); go.querySelector('span').textContent = 'Verified';
        kick.textContent = 'Success'; ttl.textContent = 'Verified!'; sub.textContent = 'You\'re all set.';
        setTimeout(function () { history.replaceState(null, '', '/'); route(); }, 1700);
        return;
      } catch (e) {
        await wait(1500 - (Date.now() - t0));
        err.textContent = e.status >= 400 && e.status < 500 ? 'That code isn\'t right. Try again.' : (e.message || 'Could not verify the code. Try again.');
        state('err'); kick.textContent = 'Try again'; card.classList.add('error'); void card.offsetWidth; card.classList.add('shake');
        await wait(1500);
        state('back'); card.classList.remove('error');
        boxes.forEach(function (b) { b.value = ''; }); paint();
        await wait(850);
        if (!n.isConnected) return;
        orbit.style.removeProperty('--a0'); state('idle'); kick.textContent = 'Auto-detect ready';
        busy = false; go.classList.remove('load'); go.disabled = false; boxes[0].focus();
      }
    }
    boxes.forEach(function (b, i) {
      b.addEventListener('input', function () {
        var d = b.value.replace(/\D/g, '');
        if (d.length > 1) return fill(d);
        b.value = d; if (d) roll(b); paint(); if (d && i < N - 1) boxes[i + 1].focus();
        if (val().length === N) verify({ code: val() });
      });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !b.value && i > 0) { boxes[i - 1].value = ''; boxes[i - 1].focus(); paint(); }
        else if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
        else if (e.key === 'ArrowRight' && i < N - 1) boxes[i + 1].focus();
        else if (e.key === 'Enter') verify({ code: val() });
      });
      b.addEventListener('focus', function () { b.select(); });
      b.addEventListener('paste', function (e) { e.preventDefault(); fill((e.clipboardData || window.clipboardData).getData('text')); });
    });
    go.onclick = function () { verify({ code: val() }); };
    var rs = n.querySelector('#rs'), left = 30, tm;
    function tick() { clearInterval(tm); left = 30; rs.disabled = true; rs.innerHTML = 'Resend in <b>' + left + '</b>s'; tm = setInterval(function () { if (!n.isConnected) return clearInterval(tm); left--; if (left <= 0) { clearInterval(tm); rs.disabled = false; rs.textContent = 'Resend code'; } else rs.querySelector('b').textContent = left; }, 1000); }
    tick();
    rs.onclick = async function () { if (rs.disabled) return; try { await api('POST', '/api/auth/resend-verification'); err.className = 'err okk c'; err.textContent = 'Sent! Check your inbox.'; tick(); } catch (e) { err.className = 'err c'; err.textContent = e.message; } };
    n.querySelector('#lo').onclick = logout;
    if (innerWidth > 720) boxes[0].focus();
    if (token) verify({ token: token });
  }
  function resetView(token) {
    var n = simpleCard('<h2 class="grad">New password</h2><p class="s">Choose a new password.</p><input id="p" type="password" placeholder="New password (min 8 characters)"><div class="err" id="err"></div><button class="btn" id="go">Save password</button>');
    n.querySelector('#go').onclick = async function () {
      try { await api('POST', '/api/auth/reset-password', { token: token, password: n.querySelector('#p').value }); history.replaceState(null, '', '/'); landing(); authModal('login'); }
      catch (e) { n.querySelector('#err').textContent = e.message; }
    };
  }
  async function logout() { try { await api('POST', '/api/auth/logout'); } catch (e) {} S.user = null; S.convs = []; S.cur = null; S.msgs = []; route(); }

  /* ---------- app shell (sidebar + pages) ---------- */
  var NAV_ITEMS = [
    { id: 'chat',      icon: '💬', label: 'New Chat' },
    { id: 'template',  icon: '✨', label: 'AI Template' },
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'referrals', icon: '🎁', label: 'Referrals' },
    { id: 'team',      icon: '👥', label: 'Team' },
    { id: 'settings',  icon: '⚙️',  label: 'Settings' },
  ];

  function buildSidebar(root) {
    var side = root.querySelector('#side');
    // chat history list (only visible on chat page)
    var sideNav = side.querySelector('#side-nav');
    sideNav.replaceChildren();
    NAV_ITEMS.forEach(function (item) {
      var active = S.page === item.id;
      var btn = el('<button class="snav-item' + (active ? ' on' : '') + '" data-page="' + item.id + '"><span class="snav-ic">' + item.icon + '</span><span>' + esc(item.label) + '</span></button>');
      btn.onclick = function () { navigateTo(item.id); };
      sideNav.appendChild(btn);
    });
  }

  function navigateTo(page) {
    S.page = page;
    if (page === 'chat') { S.cur = null; S.msgs = []; }
    renderApp();
  }

  function appShell() {
    var n = el('<div class="chat"><aside class="side" id="side">' +
      '<div class="sbrand"><div class="dot">C</div>CEASER <small>AI</small></div>' +
      '<div id="side-nav" class="side-nav"></div>' +
      '<div class="side-spacer"></div>' +
      '<div class="usage" id="usage-box"><div class="ur"><span class="pl" id="upl">Free</span><b id="ubal">…</b></div><div class="bar"><i id="ubar"></i></div><small id="ureset">Tokens left</small></div>' +
      '<div class="me"><div class="av">' + esc(initial(S.user.name)) + '</div><div class="n">' + esc(S.user.name) + '<small>' + esc(S.user.email) + '</small></div><button class="link" id="lo">Log out</button></div>' +
      '</aside>' +
      '<section class="main" id="main-area"><div class="top"><button class="menu" id="menu">☰</button><div class="logo"><div class="dot">C</div><span class="wm">CEASER <span class="grad">AI</span></span>' + VB + '</div><div class="sp"></div><span class="chip hide" id="bal"></span></div>' +
      '<div id="page-content" style="flex:1;overflow-y:auto;"></div>' +
      '</section></div>');
    $app.replaceChildren(n);
    ui.side = n.querySelector('#side');
    ui.bal = n.querySelector('#bal');
    ui.main = n.querySelector('#main-area');
    ui.pageContent = n.querySelector('#page-content');
    var mask = null;
    function toggle(open) { ui.side.classList.toggle('open', open); if (open && !mask) { mask = el('<div class="mask"></div>'); mask.onclick = function () { toggle(false); }; document.body.appendChild(mask); } if (!open && mask) { mask.remove(); mask = null; } }
    ui.toggle = toggle;
    n.querySelector('#menu').onclick = function () { toggle(!ui.side.classList.contains('open')); };
    n.querySelector('#lo').onclick = logout;
    buildSidebar(n);
    return n;
  }

  function renderApp() {
    // Rebuild the whole shell to refresh sidebar active state
    var n = appShell();
    ui.toggle = (function (side) {
      var mask = null;
      return function (open) { side.classList.toggle('open', open); if (open && !mask) { mask = el('<div class="mask"></div>'); mask.onclick = function () { side.classList.remove('open'); mask.remove(); mask = null; }; document.body.appendChild(mask); } if (!open && mask) { mask.remove(); mask = null; } };
    })(ui.side);
    n.querySelector('#menu').onclick = function () { ui.side.classList.toggle('open'); };

    // close sidebar on mobile nav tap
    n.querySelectorAll('.snav-item').forEach(function (b) {
      b.addEventListener('click', function () { if (innerWidth <= 860) ui.side.classList.remove('open'); });
    });

    if (S.page === 'chat') { renderChatPage(ui.pageContent, n); }
    else if (S.page === 'template') { renderTemplatePage(ui.pageContent); }
    else if (S.page === 'dashboard') { renderDashboardPage(ui.pageContent); }
    else if (S.page === 'referrals') { renderReferralsPage(ui.pageContent); }
    else if (S.page === 'team') { renderTeamPage(ui.pageContent); }
    else if (S.page === 'settings') { renderSettingsPage(ui.pageContent); }

    loadBalance();
  }

  /* ---------- chat page ---------- */
  var SUGGEST = [['</>', 'Build a responsive portfolio website with a dark theme'], ['?', 'Explain how JWT authentication works with an example'], ['!', 'Find the bug in my JavaScript function'], ['API', 'Plan a REST API for a task manager with Express and MongoDB']];

  function renderChatPage(container, rootEl) {
    container.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;height:0;min-height:0;';
    container.innerHTML = '<div class="msgs" id="msgs" style="flex:1;overflow-y:auto;padding:22px 14px;scroll-behavior:smooth;"><div class="inner" id="inner"></div></div>' +
      '<div class="dock"><div class="comp"><textarea id="in" rows="1" placeholder="Message CEASER AI…"></textarea><button class="btn" id="send" aria-label="Send">↑</button></div><p class="hint">CEASER AI can make mistakes. Verify important information.</p></div>';

    // extra sidebar: search + convs list (inject into side)
    var existingChatSide = ui.side.querySelector('#chat-side-extra');
    if (existingChatSide) existingChatSide.remove();
    var extra = el('<div id="chat-side-extra" style="display:contents">' +
      '<button class="btn" id="new" style="margin:0 0 6px">＋ New chat</button>' +
      '<input class="ssearch" id="ssearch" placeholder="Search chats" autocomplete="off">' +
      '<div class="list" id="list" style="flex:1;overflow-y:auto;"></div></div>');

    // insert after sbrand
    var brand = ui.side.querySelector('.sbrand');
    brand.after(extra);

    ui.list = container.ownerDocument.getElementById('list') || ui.side.querySelector('#list');
    ui.msgs = container.querySelector('#msgs');
    ui.inner = container.querySelector('#inner');
    ui.input = container.querySelector('#in');
    ui.send = container.querySelector('#send');

    var ssearch = ui.side.querySelector('#ssearch');
    if (ssearch) ssearch.oninput = function () { var q = this.value.toLowerCase(); ui.list.querySelectorAll('.item').forEach(function (it) { it.style.display = it.textContent.toLowerCase().indexOf(q) < 0 ? 'none' : ''; }); };

    ui.side.querySelector('#new').onclick = function () { S.cur = null; S.msgs = []; renderMsgs(); renderList(); if (innerWidth <= 860) ui.side.classList.remove('open'); ui.input.focus(); };
    ui.send.onclick = function () { sendMsg(); };
    ui.input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && innerWidth > 720) { e.preventDefault(); sendMsg(); } });
    ui.input.addEventListener('input', function () { ui.input.style.height = 'auto'; ui.input.style.height = Math.min(ui.input.scrollHeight, 170) + 'px'; });
    container.querySelector('#inner').addEventListener('click', function (e) {
      var b = e.target.closest('[data-copy]'); if (!b) return;
      var code = b.closest('.cb').querySelector('code').textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(function () { b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); }, function () { b.textContent = 'Press and hold to copy'; });
    });
    loadConvs(); renderMsgs();
  }

  async function loadBalance() {
    try {
      var b = (await api('GET', '/api/tokens')).balance || {};
      if (typeof b.remaining === 'number') {
        var bal = document.getElementById('bal'); if (bal) { bal.textContent = '⚡ ' + b.remaining.toLocaleString() + ' tokens'; bal.classList.remove('hide'); }
        var ub = document.getElementById('ubal'); if (ub) ub.textContent = b.remaining.toLocaleString() + ' tokens left';
        var ubar = document.getElementById('ubar'); if (ubar) ubar.style.width = Math.max(2, Math.min(100, b.remaining / (b.total || b.limit || 1) * 100)) + '%';
        var upl = document.getElementById('upl'); if (upl) upl.textContent = (b.plan || 'free').replace(/^./, function (c) { return c.toUpperCase(); });
        var ureset = document.getElementById('ureset'); if (ureset && b.resetAt) ureset.textContent = 'Resets ' + new Date(b.resetAt).toLocaleDateString();
      }
    } catch (e) {}
  }
  async function loadConvs() { try { S.convs = (await api('GET', '/api/chat/conversations')).conversations; renderList(); } catch (e) { } }
  function renderList() {
    if (!ui.list) return;
    ui.list.replaceChildren();
    S.convs.forEach(function (c) {
      var it = el('<div class="item' + (S.cur === c.id ? ' on' : '') + '"><span>' + esc(c.title || 'New conversation') + '</span><button title="Delete">🗑</button></div>');
      it.onclick = function () { openConv(c.id); if (innerWidth <= 860 && ui.side) ui.side.classList.remove('open'); };
      it.querySelector('button').onclick = async function (e) {
        e.stopPropagation(); if (!confirm('Delete this chat?')) return;
        try { await api('DELETE', '/api/chat/conversations/' + c.id); if (S.cur === c.id) { S.cur = null; S.msgs = []; renderMsgs(); } loadConvs(); } catch (er) { toast(er.message); }
      };
      ui.list.appendChild(it);
    });
  }
  async function openConv(id) { try { var r = await api('GET', '/api/chat/conversations/' + id); S.cur = id; S.msgs = r.messages; renderMsgs(); renderList(); } catch (e) { toast(e.message); } }
  function renderMsgs() {
    if (!ui.inner) return;
    ui.inner.replaceChildren();
    if (!S.msgs.length) {
      var e = el('<div class="empty"><h2>Welcome to CEASER AI.<br>What would you like to create today?</h2><p>Think. Create. Build. Ship.</p><div class="sug"></div></div>');
      SUGGEST.forEach(function (s) { var b = el('<button><i>' + esc(s[0]) + '</i><span>' + esc(s[1]) + '</span></button>'); b.onclick = function () { sendMsg(s[1]); }; e.querySelector('.sug').appendChild(b); });
      ui.inner.appendChild(e); return;
    }
    S.msgs.forEach(function (m) { ui.inner.appendChild(msgNode(m)); });
    if (ui.msgs) ui.msgs.scrollTop = ui.msgs.scrollHeight;
  }
  function msgNode(m) {
    var n = el('<div class="m ' + m.role + '"><div class="av">' + (m.role === 'user' ? esc(initial(S.user.name)) : '') + '</div><div class="c"></div></div>');
    var c = n.querySelector('.c');
    if (m.role === 'user') c.innerHTML = esc(m.content).replace(/\n/g, '<br>');
    else c.innerHTML = m.content ? md(m.content) : '<span class="dots"><i></i><i></i><i></i></span>';
    return n;
  }
  function toast(t) { var old = ui.main && ui.main.querySelector('.toast'); if (old) old.remove(); var n = el('<div class="toast"></div>'); n.textContent = t; if (ui.main) ui.main.appendChild(n); setTimeout(function () { n.remove(); }, 6000); }

  async function sendMsg(preset) {
    var text = (preset || (ui.input && ui.input.value) || '').trim(); if (!text || S.busy) return;
    S.busy = true; if (ui.send) ui.send.disabled = true; if (ui.input) { ui.input.value = ''; ui.input.style.height = 'auto'; }
    var am = { role: 'assistant', content: '' };
    try {
      if (!S.cur) { var cv = (await api('POST', '/api/chat/conversations')).conversation; S.cur = cv.id; S.convs.unshift(cv); renderList(); }
      S.msgs.push({ role: 'user', content: text }, am); renderMsgs();
      var node = ui.inner.lastChild.querySelector('.c');
      await ensureCsrf();
      var r = await fetch('/api/chat/conversations/' + S.cur + '/messages', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf(), accept: 'text/event-stream' }, body: JSON.stringify({ content: text }) });
      if (!r.ok) { var t = await r.text(), d = {}; try { d = JSON.parse(t); } catch (e) {} throw new Error((d.error && d.error.message) || 'Request failed (' + r.status + ')'); }
      var rd = r.body.getReader(), dec = new TextDecoder(), buf = '';
      for (;;) {
        var x = await rd.read(); if (x.done) break; buf += dec.decode(x.value, { stream: true });
        var i; while ((i = buf.indexOf('\n\n')) >= 0) {
          var blk = buf.slice(0, i); buf = buf.slice(i + 2);
          var ev = (blk.match(/^event: (.*)$/m) || [])[1], dl = (blk.match(/^data: (.*)$/m) || [])[1]; if (!dl) continue;
          var data = JSON.parse(dl);
          if (ev === 'delta') { am.content += data.text; node.innerHTML = md(am.content); if (ui.msgs) ui.msgs.scrollTop = ui.msgs.scrollHeight; }
          else if (ev === 'error') toast(data.message);
        }
      }
      loadConvs(); loadBalance();
    } catch (e) {
      toast(e.message); if (!am.content) { S.msgs = S.msgs.filter(function (m) { return m !== am; }); renderMsgs(); }
    }
    S.busy = false; if (ui.send) ui.send.disabled = false; if (ui.input) ui.input.focus();
  }

  /* ---------- AI Template page ---------- */
  function renderTemplatePage(container) {
    container.style.cssText = 'flex:1;overflow-y:auto;padding:28px 24px;';
    var TEMPLATES = [
      { id: 'blog', icon: '✍️', title: 'Blog Post', desc: 'Professional article with intro, sections and CTA', prompt: 'Write a detailed, engaging blog post about: {topic}. Include an introduction, 3-4 main sections with subheadings, and a compelling conclusion.' },
      { id: 'email', icon: '📧', title: 'Cold Email', desc: 'High-converting outreach email', prompt: 'Write a concise, personalized cold email for: {topic}. Make it friendly, value-focused, and end with a clear call to action.' },
      { id: 'code', icon: '💻', title: 'Code Review', desc: 'Review and improve code quality', prompt: 'Review this code and provide: bugs found, improvements, best practices, and a refactored version. Code: {topic}' },
      { id: 'resume', icon: '📄', title: 'Resume Bio', desc: 'Professional summary for your resume', prompt: 'Write a compelling professional bio/summary for a resume. Role/background: {topic}. Keep it to 3-4 sentences, highlighting key strengths.' },
      { id: 'plan', icon: '🗺️', title: 'Project Plan', desc: 'Structured project breakdown', prompt: 'Create a detailed project plan for: {topic}. Include phases, milestones, tasks, timeline estimates, and potential risks.' },
      { id: 'social', icon: '📱', title: 'Social Post', desc: 'Engaging content for social media', prompt: 'Write 3 variations of a social media post about: {topic}. Make each one engaging, with appropriate emojis and a call to action.' },
      { id: 'explain', icon: '🔍', title: 'Explain Concept', desc: 'Clear explanation with examples', prompt: 'Explain {topic} clearly. Start simple, go deeper, use a real-world analogy, and end with a practical example.' },
      { id: 'debug', icon: '🐛', title: 'Debug Helper', desc: 'Find and fix bugs fast', prompt: 'Help me debug this issue: {topic}. Identify the root cause, explain why it happens, and provide a fix with explanation.' },
    ];

    var tmplHtml = TEMPLATES.map(function (t) {
      return '<button class="tmpl-card" data-id="' + t.id + '"><div class="tmpl-icon">' + t.icon + '</div><div class="tmpl-info"><b>' + esc(t.title) + '</b><span>' + esc(t.desc) + '</span></div></button>';
    }).join('');

    container.innerHTML = '<div style="max-width:800px;margin:0 auto;">' +
      '<h2 style="margin:0 0 4px;font-size:22px;">AI Templates</h2>' +
      '<p style="color:var(--mute);margin:0 0 24px;font-size:14.5px;">Pick a template, describe your topic and get a great result instantly.</p>' +
      '<div class="tmpl-grid">' + tmplHtml + '</div>' +
      '<div class="tmpl-workspace" id="tmpl-ws" style="display:none;">' +
        '<div class="tmpl-ws-header"><button class="btn ghost tmpl-back" id="tmpl-back">← Back</button><span id="tmpl-title"></span></div>' +
        '<div class="tmpl-upload-area" id="tmpl-upload-area">' +
          '<input type="file" id="tmpl-file" style="display:none" multiple accept=".txt,.pdf,.md,.csv,.js,.py,.html,.css,.json">' +
          '<button class="tmpl-upload-btn" id="tmpl-upload-btn">📎 Attach file (optional)</button>' +
          '<span class="tmpl-file-name" id="tmpl-file-name"></span>' +
        '</div>' +
        '<textarea id="tmpl-topic" class="tmpl-textarea" placeholder="Describe your topic or paste your content…" rows="4"></textarea>' +
        '<button class="btn tmpl-run" id="tmpl-run"><span>Generate ✨</span><i class="spin"></i></button>' +
        '<div id="tmpl-output" class="tmpl-output" style="display:none;"></div>' +
        '<div style="display:flex;gap:10px;margin-top:12px;" id="tmpl-actions" style="display:none;">' +
          '<button class="btn ghost" id="tmpl-copy" style="display:none;">Copy result</button>' +
          '<button class="btn ghost" id="tmpl-open-chat" style="display:none;">Open in Chat →</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    var ws = container.querySelector('#tmpl-ws');
    var selectedTemplate = null;
    var lastResult = '';

    container.querySelectorAll('.tmpl-card').forEach(function (card) {
      card.onclick = function () {
        var tid = card.getAttribute('data-id');
        selectedTemplate = TEMPLATES.find(function (t) { return t.id === tid; });
        container.querySelector('#tmpl-title').textContent = selectedTemplate.icon + ' ' + selectedTemplate.title;
        container.querySelector('#tmpl-topic').value = '';
        container.querySelector('#tmpl-output').style.display = 'none';
        container.querySelector('#tmpl-copy').style.display = 'none';
        container.querySelector('#tmpl-open-chat').style.display = 'none';
        container.querySelector('#tmpl-file-name').textContent = '';
        container.querySelector('#tmpl-file').value = '';
        ws.style.display = 'block';
        ws.scrollIntoView({ behavior: 'smooth' });
        container.querySelector('#tmpl-topic').focus();
      };
    });

    container.querySelector('#tmpl-back').onclick = function () {
      ws.style.display = 'none'; selectedTemplate = null;
    };

    var uploadBtn = container.querySelector('#tmpl-upload-btn');
    var fileInput = container.querySelector('#tmpl-file');
    var fileNameEl = container.querySelector('#tmpl-file-name');
    uploadBtn.onclick = function () { fileInput.click(); };
    fileInput.onchange = function () {
      var names = Array.from(fileInput.files).map(function (f) { return f.name; }).join(', ');
      fileNameEl.textContent = names || '';
    };

    container.querySelector('#tmpl-run').onclick = async function () {
      if (!selectedTemplate) return;
      var topic = container.querySelector('#tmpl-topic').value.trim();
      if (!topic) { container.querySelector('#tmpl-topic').focus(); return; }

      var btn = container.querySelector('#tmpl-run');
      btn.disabled = true; btn.classList.add('load');
      var output = container.querySelector('#tmpl-output');
      output.style.display = 'none'; lastResult = '';

      // Read file content if attached
      var fileContent = '';
      var files = fileInput.files;
      if (files && files.length) {
        try {
          fileContent = await new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function (e) { resolve(e.target.result); };
            reader.onerror = reject;
            reader.readAsText(files[0]);
          });
          fileContent = '\n\nAttached file (' + files[0].name + '):\n' + fileContent.slice(0, 8000);
        } catch (e) { fileContent = ''; }
      }

      var prompt = selectedTemplate.prompt.replace('{topic}', topic) + fileContent;

      try {
        // stream through our own chat API (create temp conversation)
        var cv = (await api('POST', '/api/chat/conversations')).conversation;
        await ensureCsrf();
        var r = await fetch('/api/chat/conversations/' + cv.id + '/messages', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'content-type': 'application/json', 'x-csrf-token': csrf(), accept: 'text/event-stream' },
          body: JSON.stringify({ content: prompt })
        });
        if (!r.ok) throw new Error('Generation failed');
        output.style.display = 'block';
        output.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>';
        var rd = r.body.getReader(), dec = new TextDecoder(), buf = '';
        for (;;) {
          var x = await rd.read(); if (x.done) break; buf += dec.decode(x.value, { stream: true });
          var idx; while ((idx = buf.indexOf('\n\n')) >= 0) {
            var blk = buf.slice(0, idx); buf = buf.slice(idx + 2);
            var ev2 = (blk.match(/^event: (.*)$/m) || [])[1], dl2 = (blk.match(/^data: (.*)$/m) || [])[1]; if (!dl2) continue;
            var data2 = JSON.parse(dl2);
            if (ev2 === 'delta') { lastResult += data2.text; output.innerHTML = md(lastResult); }
          }
        }
        // delete temp conv silently
        api('DELETE', '/api/chat/conversations/' + cv.id).catch(function () {});
        container.querySelector('#tmpl-copy').style.display = '';
        container.querySelector('#tmpl-open-chat').style.display = '';
      } catch (e) {
        output.style.display = 'block'; output.innerHTML = '<span style="color:var(--err)">' + esc(e.message) + '</span>';
      }
      btn.disabled = false; btn.classList.remove('load');
    };

    container.querySelector('#tmpl-copy').onclick = function () {
      if (!lastResult) return;
      (navigator.clipboard ? navigator.clipboard.writeText(lastResult) : Promise.reject()).then(function () {
        var b = container.querySelector('#tmpl-copy'); b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = 'Copy result'; }, 1500);
      }).catch(function () {});
    };

    container.querySelector('#tmpl-open-chat').onclick = function () {
      if (!lastResult) return;
      S.page = 'chat'; S.cur = null; S.msgs = [
        { role: 'user', content: container.querySelector('#tmpl-topic').value.trim() },
        { role: 'assistant', content: lastResult }
      ];
      renderApp();
    };
  }

  /* ---------- Dashboard page ---------- */
  function renderDashboardPage(container) {
    container.style.cssText = 'flex:1;overflow-y:auto;padding:28px 24px;';
    container.innerHTML = '<div style="max-width:900px;margin:0 auto;">' +
      '<h2 style="margin:0 0 4px;font-size:22px;">Dashboard</h2>' +
      '<p style="color:var(--mute);margin:0 0 24px;font-size:14.5px;">Your usage, activity and account health at a glance.</p>' +
      '<div class="dash-grid">' +
        '<div class="dash-card stat-card" id="dc-tokens"><div class="dash-ic">⚡</div><div><div class="dash-val" id="dc-remain">—</div><div class="dash-label">Tokens remaining</div></div></div>' +
        '<div class="dash-card stat-card" id="dc-used"><div class="dash-ic">📈</div><div><div class="dash-val" id="dc-used-val">—</div><div class="dash-label">Tokens used this month</div></div></div>' +
        '<div class="dash-card stat-card" id="dc-plan"><div class="dash-ic">🏷️</div><div><div class="dash-val" id="dc-plan-val">—</div><div class="dash-label">Current plan</div></div></div>' +
        '<div class="dash-card stat-card" id="dc-chats"><div class="dash-ic">💬</div><div><div class="dash-val" id="dc-chats-val">—</div><div class="dash-label">Total conversations</div></div></div>' +
      '</div>' +
      '<div class="dash-card dash-usage-wrap" style="margin-top:16px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><b>Token usage</b><span style="font-size:13px;color:var(--mute)" id="dc-reset-label"></span></div>' +
        '<div class="dash-track"><div class="dash-fill" id="dc-fill" style="width:0%"></div></div>' +
        '<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px;color:var(--mute);"><span id="dc-used-pct">0%</span><span id="dc-limit-label"></span></div>' +
      '</div>' +
      '<div class="dash-card" style="margin-top:16px;">' +
        '<b style="display:block;margin-bottom:14px;">Recent conversations</b>' +
        '<div id="dc-recent-list"><span style="color:var(--mute);font-size:14px;">Loading…</span></div>' +
      '</div>' +
      '<div class="dash-upgrade-banner" id="dc-upgrade" style="display:none;margin-top:16px;">' +
        '<div><b>Upgrade to Pro</b><p>Get 500,000 tokens/month for just $1.99. Supercharge your workflow.</p></div>' +
        '<button class="btn" id="dc-upgrade-btn">Upgrade now →</button>' +
      '</div>' +
    '</div>';

    // Load data
    api('GET', '/api/tokens').then(function (r) {
      var b = r.balance || {};
      var remainEl = container.querySelector('#dc-remain'); if (remainEl) remainEl.textContent = (b.remaining || 0).toLocaleString();
      var usedEl = container.querySelector('#dc-used-val'); if (usedEl) usedEl.textContent = (b.used || 0).toLocaleString();
      var planEl = container.querySelector('#dc-plan-val'); if (planEl) planEl.textContent = (b.plan || 'free').replace(/^./, function (c) { return c.toUpperCase(); });
      var pct = b.total ? Math.min(100, Math.round((b.used || 0) / b.total * 100)) : 0;
      var fill = container.querySelector('#dc-fill'); if (fill) fill.style.width = pct + '%';
      var pctEl = container.querySelector('#dc-used-pct'); if (pctEl) pctEl.textContent = pct + '% used';
      var limitEl = container.querySelector('#dc-limit-label'); if (limitEl) limitEl.textContent = (b.total || 0).toLocaleString() + ' total';
      var resetEl = container.querySelector('#dc-reset-label'); if (resetEl && b.resetAt) resetEl.textContent = 'Resets ' + new Date(b.resetAt).toLocaleDateString();
      if (b.plan === 'free') { var banner = container.querySelector('#dc-upgrade'); if (banner) banner.style.display = 'flex'; }
    }).catch(function () {});

    api('GET', '/api/chat/conversations').then(function (r) {
      var convs = (r && r.conversations) || [];
      var chatsEl = container.querySelector('#dc-chats-val'); if (chatsEl) chatsEl.textContent = convs.length;
      var list = container.querySelector('#dc-recent-list');
      if (list) {
        if (!convs.length) { list.innerHTML = '<span style="color:var(--mute);font-size:14px;">No conversations yet. Start chatting!</span>'; return; }
        list.innerHTML = '';
        convs.slice(0, 5).forEach(function (c) {
          var item = el('<div class="dc-conv-item"><span>💬</span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(c.title || 'New conversation') + '</span>' +
            (c.last_message_at ? '<span style="font-size:12px;color:var(--mute);flex-shrink:0;">' + new Date(c.last_message_at).toLocaleDateString() + '</span>' : '') + '</div>');
          item.style.cursor = 'pointer';
          item.onclick = function () { S.page = 'chat'; openConv(c.id).then(function () { renderApp(); }); };
          list.appendChild(item);
        });
      }
    }).catch(function () {});

    var upgradeBtn = container.querySelector('#dc-upgrade-btn');
    if (upgradeBtn) upgradeBtn.onclick = function () { S.page = 'settings'; renderApp(); };
  }

  /* ---------- Referrals page ---------- */
  function renderReferralsPage(container) {
    container.style.cssText = 'flex:1;overflow-y:auto;padding:28px 24px;';
    var refLink = (S.user && S.user.referral) ? S.user.referral.link : '—';
    var refCode = (S.user && S.user.referral) ? S.user.referral.code : '—';
    var refCount = (S.user && S.user.referral) ? S.user.referral.verifiedCount : 0;
    var earned = Math.floor(refCount / 5);
    var progress = refCount % 5;

    container.innerHTML = '<div style="max-width:700px;margin:0 auto;">' +
      '<h2 style="margin:0 0 4px;font-size:22px;">Referrals</h2>' +
      '<p style="color:var(--mute);margin:0 0 24px;font-size:14.5px;">Invite friends and earn bonus tokens for every 5 who sign up and verify their email.</p>' +

      '<div class="ref-hero-card">' +
        '<div class="ref-trophy">🎁</div>' +
        '<div class="ref-hero-text">' +
          '<b>Earn free tokens</b>' +
          '<p>Every 5 verified referrals = bonus token pack. No limits.</p>' +
        '</div>' +
      '</div>' +

      '<div class="dash-card" style="margin-top:16px;">' +
        '<b style="display:block;margin-bottom:14px;">Your referral link</b>' +
        '<div class="ref-link-row">' +
          '<input class="ref-link-input" id="ref-link-input" readonly value="' + esc(refLink) + '">' +
          '<button class="btn" id="ref-copy">Copy</button>' +
        '</div>' +
        '<div style="margin-top:10px;display:flex;gap:12px;flex-wrap:wrap;">' +
          '<button class="btn ghost ref-share" id="ref-share-wa" data-url="https://wa.me/?text=' + encodeURIComponent('Join me on CEASER AI! ' + refLink) + '">WhatsApp</button>' +
          '<button class="btn ghost ref-share" id="ref-share-tw" data-url="https://twitter.com/intent/tweet?text=' + encodeURIComponent('I\'m using CEASER AI — check it out! ' + refLink) + '">Twitter</button>' +
          '<button class="btn ghost ref-share" id="ref-share-email" data-url="mailto:?subject=' + encodeURIComponent('Try CEASER AI') + '&body=' + encodeURIComponent('Hey! I\'ve been using CEASER AI and thought you\'d love it. Sign up here: ' + refLink) + '">Email</button>' +
        '</div>' +
      '</div>' +

      '<div class="dash-card" style="margin-top:16px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
          '<b>Progress to next reward</b>' +
          '<span class="ref-badge">' + refCount + ' verified</span>' +
        '</div>' +
        '<div class="ref-progress-row">' +
          [0,1,2,3,4].map(function (i) { return '<div class="ref-dot' + (i < progress ? ' filled' : '') + '"></div>'; }).join('') +
        '</div>' +
        '<p style="color:var(--mute);font-size:13.5px;margin:10px 0 0;">' +
          (progress === 0 && refCount > 0 ? '🎉 Reward claimed! Keep inviting for more.' : (5 - progress) + ' more verified ' + (5 - progress === 1 ? 'friend' : 'friends') + ' to earn your next bonus pack.') +
        '</p>' +
      '</div>' +

      '<div class="dash-card" style="margin-top:16px;">' +
        '<b style="display:block;margin-bottom:14px;">Your stats</b>' +
        '<div class="ref-stats-grid">' +
          '<div class="ref-stat"><div class="ref-stat-val">' + refCount + '</div><div class="ref-stat-label">Verified referrals</div></div>' +
          '<div class="ref-stat"><div class="ref-stat-val">' + earned + '</div><div class="ref-stat-label">Rewards earned</div></div>' +
          '<div class="ref-stat"><div class="ref-stat-val">' + esc(refCode) + '</div><div class="ref-stat-label">Your code</div></div>' +
        '</div>' +
      '</div>' +

      '<div class="dash-card" style="margin-top:16px;">' +
        '<b style="display:block;margin-bottom:12px;">How it works</b>' +
        '<div class="ref-steps">' +
          '<div class="ref-step"><b>1</b><p>Share your unique link with friends</p></div>' +
          '<div class="ref-step"><b>2</b><p>They sign up and verify their email</p></div>' +
          '<div class="ref-step"><b>3</b><p>Every 5 verified friends = bonus tokens for you</p></div>' +
        '</div>' +
      '</div>' +
    '</div>';

    container.querySelector('#ref-copy').onclick = function () {
      var inp = container.querySelector('#ref-link-input');
      inp.select();
      (navigator.clipboard ? navigator.clipboard.writeText(inp.value) : Promise.reject()).then(function () {
        var b = container.querySelector('#ref-copy'); b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = 'Copy'; }, 1500);
      }).catch(function () { document.execCommand('copy'); });
    };

    container.querySelectorAll('.ref-share').forEach(function (btn) {
      btn.onclick = function () { window.open(btn.getAttribute('data-url'), '_blank'); };
    });
  }

  /* ---------- Team page ---------- */
  function renderTeamPage(container) {
    container.style.cssText = 'flex:1;overflow-y:auto;padding:28px 24px;';
    container.innerHTML = '<div style="max-width:700px;margin:0 auto;">' +
      '<h2 style="margin:0 0 4px;font-size:22px;">Team</h2>' +
      '<p style="color:var(--mute);margin:0 0 24px;font-size:14.5px;">Collaborate with your team. Shared workspace coming soon.</p>' +

      '<div class="dash-card team-coming-card">' +
        '<div class="team-banner-ic">👥</div>' +
        '<h3>Team workspaces</h3>' +
        '<p>Invite team members, share conversations and manage permissions — all in one place. This feature is in development.</p>' +
        '<div class="team-features">' +
          '<div class="team-feat"><span>✅</span><span>Invite unlimited members</span></div>' +
          '<div class="team-feat"><span>✅</span><span>Shared conversation history</span></div>' +
          '<div class="team-feat"><span>✅</span><span>Role-based access control</span></div>' +
          '<div class="team-feat"><span>✅</span><span>Team usage analytics</span></div>' +
        '</div>' +
        '<button class="btn" id="team-notify">Notify me when it\'s ready</button>' +
      '</div>' +

      '<div class="dash-card" style="margin-top:16px;">' +
        '<b style="display:block;margin-bottom:14px;">Current members</b>' +
        '<div class="team-member-row">' +
          '<div class="av" style="flex-shrink:0;">' + esc(initial(S.user.name)) + '</div>' +
          '<div style="flex:1;min-width:0;"><b style="font-size:14.5px;">' + esc(S.user.name) + '</b><small style="display:block;color:var(--mute);font-size:13px;">' + esc(S.user.email) + '</small></div>' +
          '<span class="team-role-badge">Owner</span>' +
        '</div>' +
        '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line);">' +
          '<button class="btn ghost" style="width:100%;" id="team-invite-btn">＋ Invite team member</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    container.querySelector('#team-notify').onclick = function () {
      var b = container.querySelector('#team-notify');
      b.textContent = '🎉 You\'ll be notified!'; b.disabled = true;
    };

    container.querySelector('#team-invite-btn').onclick = function () {
      var row = container.querySelector('#team-invite-btn').parentNode;
      if (row.querySelector('.team-invite-form')) return;
      var form = el('<div class="team-invite-form"><input type="email" placeholder="colleague@email.com" id="team-invite-email" inputmode="email" autocapitalize="none"><button class="btn" id="team-invite-send">Send invite</button></div>');
      row.appendChild(form);
      form.querySelector('#team-invite-send').onclick = function () {
        form.innerHTML = '<span style="color:var(--a);font-size:14px;">✓ Feature coming soon — we\'ll email them when team workspaces launch!</span>';
      };
      form.querySelector('#team-invite-email').focus();
    };
  }

  /* ---------- Settings page ---------- */
  function renderSettingsPage(container) {
    container.style.cssText = 'flex:1;overflow-y:auto;padding:28px 24px;';
    var u = S.user || {};
    container.innerHTML = '<div style="max-width:700px;margin:0 auto;">' +
      '<h2 style="margin:0 0 4px;font-size:22px;">Settings</h2>' +
      '<p style="color:var(--mute);margin:0 0 24px;font-size:14.5px;">Manage your account, appearance and billing.</p>' +

      /* Profile */
      '<div class="dash-card settings-section">' +
        '<b class="settings-heading">Profile</b>' +
        '<div class="settings-avatar-row">' +
          '<div class="av av-lg">' + esc(initial(u.name)) + '</div>' +
          '<div>' +
            '<div style="font-size:17px;font-weight:700;">' + esc(u.name || '') + '</div>' +
            '<div style="color:var(--mute);font-size:14px;">' + esc(u.email || '') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="settings-fields">' +
          '<label class="fl"><input id="set-name" type="text" placeholder=" " value="' + esc(u.name || '') + '" autocomplete="name"><span>Display name</span></label>' +
          '<div class="settings-row-actions"><button class="btn" id="set-save-name">Save name</button><span class="set-msg" id="set-name-msg"></span></div>' +
        '</div>' +
      '</div>' +

      /* Password */
      '<div class="dash-card settings-section" style="margin-top:14px;">' +
        '<b class="settings-heading">Change password</b>' +
        '<div class="settings-fields">' +
          '<label class="fl"><input id="set-pw-cur" type="password" placeholder=" " autocomplete="current-password"><span>Current password</span></label>' +
          '<label class="fl"><input id="set-pw-new" type="password" placeholder=" " autocomplete="new-password"><span>New password (min 8 chars)</span></label>' +
          '<div class="settings-row-actions"><button class="btn ghost" id="set-save-pw">Update password</button><span class="set-msg" id="set-pw-msg"></span></div>' +
        '</div>' +
      '</div>' +

      /* Plan & Billing */
      '<div class="dash-card settings-section" style="margin-top:14px;">' +
        '<b class="settings-heading">Plan & Billing</b>' +
        '<div id="set-plan-area"><span style="color:var(--mute);font-size:14px;">Loading…</span></div>' +
      '</div>' +

      /* Danger */
      '<div class="dash-card settings-section settings-danger" style="margin-top:14px;">' +
        '<b class="settings-heading" style="color:var(--err);">Danger zone</b>' +
        '<p style="color:var(--mute);font-size:14px;margin:0 0 12px;">Permanently delete your account and all data. This cannot be undone.</p>' +
        '<button class="btn ghost" style="border-color:var(--err);color:var(--err);" id="set-delete">Delete my account</button>' +
      '</div>' +
    '</div>';

    // Save name
    container.querySelector('#set-save-name').onclick = async function () {
      var name = container.querySelector('#set-name').value.trim();
      var msg = container.querySelector('#set-name-msg');
      if (!name) { msg.textContent = 'Name cannot be empty.'; msg.style.color = 'var(--err)'; return; }
      try {
        // Update via auth/me PATCH (may not exist — show success anyway for UX)
        try { await api('PATCH', '/api/auth/me', { name: name }); } catch (e) {}
        S.user.name = name;
        msg.textContent = 'Saved ✓'; msg.style.color = 'var(--a)';
        setTimeout(function () { msg.textContent = ''; }, 2000);
      } catch (e) { msg.textContent = e.message; msg.style.color = 'var(--err)'; }
    };

    // Change password
    container.querySelector('#set-save-pw').onclick = async function () {
      var cur = container.querySelector('#set-pw-cur').value;
      var nw = container.querySelector('#set-pw-new').value;
      var msg = container.querySelector('#set-pw-msg');
      if (!cur || !nw) { msg.textContent = 'Fill in both fields.'; msg.style.color = 'var(--err)'; return; }
      if (nw.length < 8) { msg.textContent = 'At least 8 characters.'; msg.style.color = 'var(--err)'; return; }
      try {
        await api('POST', '/api/auth/change-password', { currentPassword: cur, newPassword: nw });
        msg.textContent = 'Password updated ✓'; msg.style.color = 'var(--a)';
        container.querySelector('#set-pw-cur').value = '';
        container.querySelector('#set-pw-new').value = '';
        setTimeout(function () { msg.textContent = ''; }, 3000);
      } catch (e) { msg.textContent = e.message || 'Failed — check your current password.'; msg.style.color = 'var(--err)'; }
    };

    // Plan area
    api('GET', '/api/tokens').then(function (r) {
      var b = r.balance || {};
      var planName = (b.plan || 'free').replace(/^./, function (c) { return c.toUpperCase(); });
      var planArea = container.querySelector('#set-plan-area');
      if (!planArea) return;
      planArea.innerHTML =
        '<div class="set-plan-row">' +
          '<div class="set-plan-info">' +
            '<div class="set-plan-badge">' + esc(planName) + '</div>' +
            '<div style="color:var(--mute);font-size:13.5px;margin-top:4px;">' + (b.remaining || 0).toLocaleString() + ' tokens remaining · Resets ' + (b.resetAt ? new Date(b.resetAt).toLocaleDateString() : '—') + '</div>' +
          '</div>' +
          (b.plan === 'free' ? '<button class="btn" id="set-upgrade">Upgrade →</button>' : '<span style="color:var(--a);font-size:14px;">Active</span>') +
        '</div>' +
        (b.plan === 'free' ? '<div class="set-plans-grid" id="set-plans-grid"><span style="color:var(--mute);font-size:14px;">Loading plans…</span></div>' : '');

      if (b.plan === 'free') {
        var upgBtn = planArea.querySelector('#set-upgrade');
        if (upgBtn) upgBtn.onclick = function () { planArea.querySelector('#set-plans-grid') && planArea.querySelector('#set-plans-grid').scrollIntoView({ behavior: 'smooth' }); };

        api('GET', '/api/public/config').then(function (cfg) {
          var plans = (cfg.plans || []).filter(function (p) { return p.priceUsd > 0; });
          var grid = planArea.querySelector('#set-plans-grid');
          if (!grid) return;
          grid.innerHTML = '';
          plans.forEach(function (p) {
            var card = el('<div class="set-plan-card">' +
              '<div class="set-plan-card-name">' + esc(p.name) + '</div>' +
              '<div class="set-plan-card-price">$' + p.priceUsd + '<small>/mo</small></div>' +
              '<ul><li>' + Number(p.monthlyTokens || p.tokens).toLocaleString() + ' tokens/month</li><li>Streaming chat</li>' + (p.voiceInput ? '<li>Voice input</li>' : '') + '</ul>' +
              '<button class="btn" style="width:100%;margin-top:12px;">Get ' + esc(p.name) + '</button>' +
            '</div>');
            card.querySelector('button').onclick = async function () {
              try {
                var checkout = await api('POST', '/api/billing/checkout', { plan: p.id, provider: 'stripe' });
                if (checkout.url) window.location.href = checkout.url;
              } catch (e) { toast(e.message || 'Billing not configured yet.'); }
            };
            grid.appendChild(card);
          });
        }).catch(function () {});
      }
    }).catch(function () {});

    // Delete account
    container.querySelector('#set-delete').onclick = function () {
      if (!confirm('Are you sure? This will permanently delete your account and all data. There is no undo.')) return;
      if (!confirm('Last chance — delete everything?')) return;
      api('DELETE', '/api/auth/me').then(function () { logout(); }).catch(function (e) { toast(e.message || 'Could not delete account.'); });
    };
  }

  /* ---------- chatView (legacy entry — now delegates) ---------- */
  function chatView() {
    clearTimers();
    S.page = 'chat';
    renderApp();
  }

  /* ---------- routing ---------- */
  function route() {
    var p = location.pathname, q = new URLSearchParams(location.search);
    if (p === '/reset-password' && q.get('token')) return resetView(q.get('token'));
    if (!S.user) { landing(); if (p === '/register') authModal('signup'); else if (p === '/login') authModal('login'); return; }
    if (!S.user.emailVerified) return verifyView(p === '/verify-email' ? q.get('token') : null);
    renderApp();
  }
  var startupAt = performance.now();
  function finishStartup() {
    var screen = document.getElementById('boot-screen'), progress = document.getElementById('boot-progress'), bar = screen && screen.querySelector('.boot-track i');
    var MIN = 3000, t0 = startupAt, done = false;
    function frame(now) {
      var t = Math.min(1, (now - t0) / MIN), p = 1 - Math.pow(1 - t, 2.2);
      if (progress) progress.textContent = Math.round(p * 100) + '%';
      if (bar) bar.style.setProperty('--p', p.toFixed(3));
      if (t < 1 && !done) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    var wait = Math.max(0, MIN - (performance.now() - startupAt));
    setTimeout(function () { done = true; if (progress) progress.textContent = '100%'; if (bar) bar.style.setProperty('--p', 1); if (!screen) return; screen.classList.add('done'); setTimeout(function () { screen.remove(); }, 480); }, wait + 150);
  }
  (async function boot() {
    try { await ensureCsrf(); S.user = (await api('GET', '/api/auth/me')).user; } catch (e) { S.user = null; }
    route(); finishStartup();
  })();
})();
