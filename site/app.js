(function () {
  'use strict';
  var $app = document.getElementById('app');
  var S = { user: null, convs: [], cur: null, msgs: [], busy: false, plans: [] };
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
    var rain = el('<canvas id="rain"></canvas>'), au = el('<div class="aurora"><i></i><i></i><i></i></div>'), gl = el('<div id="glow"></div>');
    document.body.prepend(gl); document.body.prepend(au); document.body.prepend(rain);
    addEventListener('pointermove', function (e) { gl.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, { passive: true });
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var x = rain.getContext('2d'), w, h, cols, d, s = 16, last = 0, chars = '01';
    function fit() { w = rain.width = innerWidth; h = rain.height = innerHeight; cols = Math.ceil(w / s); d = []; for (var i = 0; i < cols; i++) d[i] = Math.random() * h / s; }
    fit(); addEventListener('resize', fit);
    (function f(t) {
      if (t - last > 60 && !document.hidden) {
        last = t; x.fillStyle = 'rgba(4,6,11,.16)'; x.fillRect(0, 0, w, h); x.fillStyle = '#00ff9d'; x.font = s + 'px monospace';
        for (var i = 0; i < cols; i++) { x.fillText(chars[Math.random() > .5 ? 1 : 0], i * s, d[i] * s); if (d[i] * s > h && Math.random() > .975) d[i] = 0; d[i]++; }
      }
      requestAnimationFrame(f);
    })(0);
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
      '<nav class="nav"><div class="logo"><div class="dot">C</div>CEASER <span class="grad">AI</span></div><div class="sp"></div>' +
      '<a class="nl" href="#features">Features</a><a class="nl" href="#plans">Pricing</a>' +
      '<button class="btn ghost" id="li">Log in</button><button class="btn" id="su">Get started</button></nav>' +
      '<header class="hero"><div><div class="pill"><b></b>Online and ready</div>' +
      '<h1>Your AI for <span class="type" id="ty"></span><br><span class="grad">built to ship.</span></h1>' +
      '<p class="lead">Chat, write, debug and build with an assistant that streams answers instantly, remembers your conversations and never gets in your way.</p>' +
      '<div class="cta"><button class="btn lg" id="su2">Start free →</button><a class="btn ghost lg" href="#features" style="text-decoration:none;display:inline-block">See what it does</a></div>' +
      '<div class="stats"><div><b>20k</b>free tokens</div><div><b>Live</b>streaming replies</div><div><b>24/7</b>always on</div></div></div>' +
      '<div class="win"><div class="bar"><i></i><i></i><i></i></div><div class="body" id="demo"></div></div></header>' +
      '<section class="sec" id="features"><h2 class="rv">Everything you need, <span class="grad">nothing you don’t</span></h2><p class="sub rv">Fast, focused and designed to feel great on your phone.</p><div class="grid">' +
      feat('⚡', 'Instant streaming', 'Watch answers appear word by word instead of waiting for a wall of text.') +
      feat('💻', 'Code that works', 'Syntax-friendly code blocks with one-tap copy. Debug, refactor, explain.') +
      feat('🗂️', 'Saved chats', 'Every conversation is stored, searchable and one tap away.') +
      feat('🔒', 'Private by default', 'Secure sessions, verified accounts and protected requests.') +
      feat('🎁', 'Refer and earn', 'Invite friends and unlock bonus tokens for every five who join.') +
      feat('📱', 'Made for mobile', 'Smooth, thumb-friendly layout that feels like a native app.') +
      '</div></section><section class="sec" id="plans"><h2 class="rv">Simple <span class="grad">pricing</span></h2><p class="sub rv">Start free. Upgrade when you need more.</p><div class="grid" id="pl"></div></section>' +
      '<footer class="foot">© ' + new Date().getFullYear() + ' CEASER AI · Built by Ceaser</footer></div>');
    $app.replaceChildren(n);
    n.querySelector('#li').onclick = function () { authModal('login'); };
    n.querySelector('#su').onclick = n.querySelector('#su2').onclick = function () { authModal('signup'); };
    reveal(n); typeLoop(n.querySelector('#ty')); demoLoop(n.querySelector('#demo'));
    renderPlans(n.querySelector('#pl'));
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
      ['Why is my code returning undefined?', 'Usually a missing return, or an async call you forgot to await. Paste it and I’ll find it.', '']
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

  /* ---------- auth modal ---------- */
  function authModal(mode) {
    var old = document.getElementById('ov'); if (old) old.remove();
    var signup = mode === 'signup', forgot = mode === 'forgot';
    var title = forgot ? 'Reset password' : signup ? 'Create your account' : 'Welcome back';
    var sub = forgot ? 'We’ll email you a reset link.' : signup ? 'Free to start. No card needed.' : 'Log in to continue.';
    var ov = el('<div class="ov" id="ov"><div class="modal"><button class="x" aria-label="Close">×</button><h2 class="grad">' + title + '</h2><p class="s">' + sub + '</p>' +
      (signup ? '<input id="name" placeholder="Your name" autocomplete="name">' : '') +
      '<input id="email" type="email" placeholder="Email" autocomplete="email">' +
      (forgot ? '' : '<input id="pass" type="password" placeholder="Password' + (signup ? ' (min 8 characters)' : '') + '" autocomplete="' + (signup ? 'new-password' : 'current-password') + '">') +
      (signup ? '<input id="website" class="hide" tabindex="-1" autocomplete="off">' : '') +
      '<div class="err" id="err"></div><button class="btn" id="go">' + (forgot ? 'Send reset link' : signup ? 'Create account' : 'Log in') + '</button>' +
      '<div class="row"><span>' + (signup ? 'Have an account? <button class="link" id="sw">Log in</button>' : forgot ? '<button class="link" id="sw">Back to login</button>' : 'New here? <button class="link" id="sw">Sign up</button>') + '</span>' +
      (!signup && !forgot ? '<button class="link" id="fg">Forgot password?</button>' : '') + '</div></div></div>');
    document.body.appendChild(ov);
    var err = ov.querySelector('#err'), go = ov.querySelector('#go');
    ov.querySelector('.x').onclick = function () { ov.remove(); };
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) ov.remove(); });
    ov.querySelector('#sw').onclick = function () { authModal(signup || forgot ? 'login' : 'signup'); };
    var fg = ov.querySelector('#fg'); if (fg) fg.onclick = function () { authModal('forgot'); };
    var first = ov.querySelector('input'); if (first) first.focus();
    async function submit() {
      err.className = 'err'; err.textContent = ''; go.disabled = true;
      var v = function (id) { var e = ov.querySelector('#' + id); return e ? e.value : ''; };
      try {
        if (forgot) { await api('POST', '/api/auth/forgot-password', { email: v('email') }); err.className = 'okk'; err.textContent = 'If that email exists, a reset link is on its way.'; }
        else {
          var ref = new URLSearchParams(location.search).get('ref') || undefined;
          var r = await api('POST', signup ? '/api/auth/signup' : '/api/auth/login', signup ? { name: v('name'), email: v('email'), password: v('pass'), website: v('website'), ref: ref } : { email: v('email'), password: v('pass') });
          S.user = r.user; ov.remove(); route();
        }
      } catch (e) { err.textContent = e.message; }
      go.disabled = false;
    }
    go.onclick = submit;
    ov.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); if (e.key === 'Escape') ov.remove(); });
  }

  function simpleCard(inner) { var n = el('<div class="center"><div class="modal" style="position:relative">' + inner + '</div></div>'); $app.replaceChildren(n); return n; }

  function verifyView(token) {
    clearTimers();
    var n = simpleCard('<h2 class="grad">Verify your email</h2><p class="s">Enter the code we sent to <b>' + esc(S.user ? S.user.email : '') + '</b>. Check spam too.</p>' +
      '<input id="code" placeholder="Verification code" autocomplete="one-time-code"><div class="err" id="err"></div><button class="btn" id="go">Verify</button>' +
      '<div class="row"><button class="link" id="rs">Resend code</button><button class="link" id="lo">Log out</button></div>');
    var err = n.querySelector('#err'), code = n.querySelector('#code');
    async function verify(body) {
      err.className = 'err'; err.textContent = '';
      try { var r = await api('POST', '/api/auth/verify-email', body); S.user = r.user; history.replaceState(null, '', '/'); route(); } catch (e) { err.textContent = e.message; }
    }
    n.querySelector('#go').onclick = function () { verify({ code: code.value.trim() }); };
    code.addEventListener('keydown', function (e) { if (e.key === 'Enter') verify({ code: code.value.trim() }); });
    n.querySelector('#rs').onclick = async function () { try { await api('POST', '/api/auth/resend-verification'); err.className = 'okk'; err.textContent = 'Sent! Check your inbox.'; } catch (e) { err.textContent = e.message; } };
    n.querySelector('#lo').onclick = logout;
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

  /* ---------- chat ---------- */
  var SUGGEST = [['💻 Write code', 'Write a Python script that renames files by date'], ['🧠 Explain', 'Explain how APIs work like I’m 12'], ['🐞 Debug', 'Why does my JavaScript return undefined?'], ['✍️ Draft', 'Write a friendly email asking for a deadline extension']];
  function chatView() {
    clearTimers();
    var n = el('<div class="chat"><aside class="side" id="side"><button class="btn" id="new">＋ New chat</button><div class="list" id="list"></div>' +
      '<div class="me"><div class="av">' + esc(initial(S.user.name)) + '</div><div class="n">' + esc(S.user.name) + '<small>' + esc(S.user.email) + '</small></div><button class="link" id="lo">Log out</button></div></aside>' +
      '<section class="main"><div class="top"><button class="menu" id="menu">☰</button><div class="logo"><div class="dot">C</div>CEASER <span class="grad">AI</span></div><div class="sp"></div><span class="chip hide" id="bal"></span></div>' +
      '<div class="msgs" id="msgs"><div class="inner" id="inner"></div></div>' +
      '<div class="dock"><div class="comp"><textarea id="in" rows="1" placeholder="Message CEASER AI…"></textarea><button class="btn" id="send">Send</button></div></div></section></div>');
    $app.replaceChildren(n);
    ui = { side: n.querySelector('#side'), list: n.querySelector('#list'), msgs: n.querySelector('#msgs'), inner: n.querySelector('#inner'), input: n.querySelector('#in'), send: n.querySelector('#send'), bal: n.querySelector('#bal'), main: n.querySelector('.main') };
    n.querySelector('#lo').onclick = logout;
    var mask = null;
    function toggle(open) { ui.side.classList.toggle('open', open); if (open && !mask) { mask = el('<div class="mask"></div>'); mask.onclick = function () { toggle(false); }; document.body.appendChild(mask); } if (!open && mask) { mask.remove(); mask = null; } }
    ui.toggle = toggle;
    n.querySelector('#menu').onclick = function () { toggle(!ui.side.classList.contains('open')); };
    n.querySelector('#new').onclick = function () { S.cur = null; S.msgs = []; renderMsgs(); renderList(); toggle(false); ui.input.focus(); };
    ui.send.onclick = function () { sendMsg(); };
    ui.input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && innerWidth > 720) { e.preventDefault(); sendMsg(); } });
    ui.input.addEventListener('input', function () { ui.input.style.height = 'auto'; ui.input.style.height = Math.min(ui.input.scrollHeight, 170) + 'px'; });
    ui.inner.addEventListener('click', function (e) {
      var b = e.target.closest('[data-copy]'); if (!b) return;
      var code = b.closest('.cb').querySelector('code').textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(function () { b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); }, function () { b.textContent = 'Press and hold to copy'; });
    });
    loadConvs(); renderMsgs(); loadBalance();
  }
  async function loadBalance() {
    try { var b = (await api('GET', '/api/tokens')).balance || {}; if (typeof b.remaining === 'number') { ui.bal.textContent = '⚡ ' + b.remaining.toLocaleString() + ' tokens'; ui.bal.classList.remove('hide'); } } catch (e) {}
  }
  async function loadConvs() { try { S.convs = (await api('GET', '/api/chat/conversations')).conversations; renderList(); } catch (e) { toast(e.message); } }
  function renderList() {
    ui.list.replaceChildren();
    S.convs.forEach(function (c) {
      var it = el('<div class="item' + (S.cur === c.id ? ' on' : '') + '"><span>' + esc(c.title || 'New conversation') + '</span><button title="Delete">🗑</button></div>');
      it.onclick = function () { openConv(c.id); ui.toggle(false); };
      it.querySelector('button').onclick = async function (e) {
        e.stopPropagation(); if (!confirm('Delete this chat?')) return;
        try { await api('DELETE', '/api/chat/conversations/' + c.id); if (S.cur === c.id) { S.cur = null; S.msgs = []; renderMsgs(); } loadConvs(); } catch (er) { toast(er.message); }
      };
      ui.list.appendChild(it);
    });
  }
  async function openConv(id) { try { var r = await api('GET', '/api/chat/conversations/' + id); S.cur = id; S.msgs = r.messages; renderMsgs(); renderList(); } catch (e) { toast(e.message); } }
  function renderMsgs() {
    ui.inner.replaceChildren();
    if (!S.msgs.length) {
      var e = el('<div class="empty"><div class="orb"></div><h2>Hi ' + esc((S.user.name || '').split(' ')[0]) + ', <span class="grad">what are we building?</span></h2><p>Ask anything. I’ll stream the answer live.</p><div class="sug"></div></div>');
      SUGGEST.forEach(function (s) { var b = el('<button>' + esc(s[0]) + '<small>' + esc(s[1]) + '</small></button>'); b.onclick = function () { sendMsg(s[1]); }; e.querySelector('.sug').appendChild(b); });
      ui.inner.appendChild(e); return;
    }
    S.msgs.forEach(function (m) { ui.inner.appendChild(msgNode(m)); });
    ui.msgs.scrollTop = ui.msgs.scrollHeight;
  }
  function msgNode(m) {
    var n = el('<div class="m ' + m.role + '"><div class="av">' + (m.role === 'user' ? esc(initial(S.user.name)) : '') + '</div><div class="c"></div></div>');
    var c = n.querySelector('.c');
    if (m.role === 'user') c.innerHTML = esc(m.content).replace(/\n/g, '<br>');
    else c.innerHTML = m.content ? md(m.content) : '<span class="dots"><i></i><i></i><i></i></span>';
    return n;
  }
  function toast(t) { var old = ui.main.querySelector('.toast'); if (old) old.remove(); var n = el('<div class="toast"></div>'); n.textContent = t; ui.main.appendChild(n); setTimeout(function () { n.remove(); }, 6000); }

  async function sendMsg(preset) {
    var text = (preset || ui.input.value).trim(); if (!text || S.busy) return;
    S.busy = true; ui.send.disabled = true; ui.input.value = ''; ui.input.style.height = 'auto';
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
          if (ev === 'delta') { am.content += data.text; node.innerHTML = md(am.content); ui.msgs.scrollTop = ui.msgs.scrollHeight; }
          else if (ev === 'error') toast(data.message);
        }
      }
      loadConvs(); loadBalance();
    } catch (e) {
      toast(e.message); if (!am.content) { S.msgs = S.msgs.filter(function (m) { return m !== am; }); renderMsgs(); }
    }
    S.busy = false; ui.send.disabled = false; ui.input.focus();
  }

  /* ---------- routing ---------- */
  function route() {
    var p = location.pathname, q = new URLSearchParams(location.search);
    if (p === '/reset-password' && q.get('token')) return resetView(q.get('token'));
    if (!S.user) { landing(); if (p === '/register') authModal('signup'); else if (p === '/login') authModal('login'); return; }
    if (!S.user.emailVerified) return verifyView(p === '/verify-email' ? q.get('token') : null);
    chatView();
  }
  (async function boot() {
    try { await ensureCsrf(); S.user = (await api('GET', '/api/auth/me')).user; } catch (e) { S.user = null; }
    route();
  })();
})();
