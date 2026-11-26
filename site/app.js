(function () {
  'use strict';
  var $app = document.getElementById('app');
  var S = { user: null, convs: [], cur: null, msgs: [], busy: false, balance: null };

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
    if (!r.ok) { var e = new Error((d && d.error && d.error.message) || r.statusText || 'Request failed'); e.status = r.status; e.code = d && d.error && d.error.code; throw e; }
    return d;
  }
  // tiny safe markdown: code fences, inline code, bold, italic, paragraphs
  function md(src) {
    var parts = String(src).split(/```/), out = '';
    for (var i = 0; i < parts.length; i++) {
      if (i % 2) { var p = parts[i].replace(/^[^\n]*\n/, ''); out += '<pre><code>' + esc(p.replace(/\n$/, '')) + '</code></pre>'; }
      else {
        var h = esc(parts[i]).replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/(^|\s)\*([^*\n]+)\*/g, '$1<i>$2</i>');
        out += h.split(/\n{2,}/).map(function (x) { return x.trim() ? '<p>' + x.replace(/\n/g, '<br>') + '</p>' : ''; }).join('');
      }
    }
    return out;
  }

  /* ---------- binary rain ---------- */
  (function () {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var c = document.getElementById('rain'), x = c.getContext('2d'), w, h, cols, d, s = 16, last = 0;
    function fit() { w = c.width = innerWidth; h = c.height = innerHeight; cols = Math.ceil(w / s); d = []; for (var i = 0; i < cols; i++) d[i] = Math.random() * h / s; }
    fit(); addEventListener('resize', fit);
    (function f(t) {
      if (t - last > 60 && !document.hidden) {
        last = t; x.fillStyle = 'rgba(5,7,12,.14)'; x.fillRect(0, 0, w, h); x.fillStyle = '#00ff96'; x.font = s + 'px monospace';
        for (var i = 0; i < cols; i++) { x.fillText(Math.random() > .5 ? '1' : '0', i * s, d[i] * s); if (d[i] * s > h && Math.random() > .975) d[i] = 0; d[i]++; }
      }
      requestAnimationFrame(f);
    })(0);
  })();

  /* ---------- auth screens ---------- */
  function authView(mode) {
    var signup = mode === 'signup', forgot = mode === 'forgot';
    var title = forgot ? 'Reset password' : signup ? 'Create account' : 'Welcome back';
    var n = el('<div class="center"><div class="card"><h1>CEASER <span>AI</span></h1><p class="sub">' + title + '</p>' +
      (signup ? '<input id="name" placeholder="Name" autocomplete="name">' : '') +
      '<input id="email" type="email" placeholder="Email" autocomplete="email">' +
      (forgot ? '' : '<input id="pass" type="password" placeholder="Password' + (signup ? ' (min 8 characters)' : '') + '" autocomplete="' + (signup ? 'new-password' : 'current-password') + '">') +
      (signup ? '<input id="website" class="hide" tabindex="-1" autocomplete="off">' : '') +
      '<div class="err" id="err"></div><button class="btn" id="go">' + (forgot ? 'Send reset link' : signup ? 'Sign up' : 'Log in') + '</button>' +
      '<div class="row"><span>' + (signup ? 'Have an account? <button class="link" id="sw">Log in</button>' : forgot ? '<button class="link" id="sw">Back to login</button>' : 'New here? <button class="link" id="sw">Sign up</button>') + '</span>' +
      (!signup && !forgot ? '<button class="link" id="fg">Forgot password?</button>' : '') + '</div></div></div>');
    $app.replaceChildren(n);
    var err = n.querySelector('#err'), go = n.querySelector('#go');
    n.querySelector('#sw').onclick = function () { authView(forgot ? 'login' : signup ? 'login' : 'signup'); };
    var fg = n.querySelector('#fg'); if (fg) fg.onclick = function () { authView('forgot'); };
    async function submit() {
      err.className = 'err'; err.textContent = ''; go.disabled = true;
      var v = function (id) { var e = n.querySelector('#' + id); return e ? e.value : ''; };
      try {
        if (forgot) { await api('POST', '/api/auth/forgot-password', { email: v('email') }); err.className = 'ok'; err.textContent = 'If that email exists, a reset link was sent.'; }
        else {
          var ref = new URLSearchParams(location.search).get('ref') || undefined;
          var r = await api('POST', signup ? '/api/auth/signup' : '/api/auth/login', signup ? { name: v('name'), email: v('email'), password: v('pass'), website: v('website'), ref: ref } : { email: v('email'), password: v('pass') });
          S.user = r.user; route();
        }
      } catch (e) { err.textContent = e.message; }
      go.disabled = false;
    }
    go.onclick = submit;
    n.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }

  function verifyView(token) {
    var n = el('<div class="center"><div class="card"><h1>CEASER <span>AI</span></h1><p class="sub">Verify your email. Enter the code we sent to <b>' + esc(S.user ? S.user.email : '') + '</b>.</p>' +
      '<input id="code" placeholder="Verification code" inputmode="text" autocomplete="one-time-code"><div class="err" id="err"></div>' +
      '<button class="btn" id="go">Verify</button><div class="row"><button class="link" id="rs">Resend code</button><button class="link" id="lo">Log out</button></div></div></div>');
    $app.replaceChildren(n);
    var err = n.querySelector('#err'), code = n.querySelector('#code');
    async function verify(body) {
      err.className = 'err'; err.textContent = '';
      try { var r = await api('POST', '/api/auth/verify-email', body); S.user = r.user; history.replaceState(null, '', '/'); route(); }
      catch (e) { err.textContent = e.message; }
    }
    n.querySelector('#go').onclick = function () { verify({ code: code.value.trim() }); };
    n.querySelector('#rs').onclick = async function () { try { await api('POST', '/api/auth/resend-verification'); err.className = 'ok'; err.textContent = 'Code sent. Check your inbox and spam.'; } catch (e) { err.textContent = e.message; } };
    n.querySelector('#lo').onclick = logout;
    if (token) verify({ token: token });
  }

  function resetView(token) {
    var n = el('<div class="center"><div class="card"><h1>CEASER <span>AI</span></h1><p class="sub">Choose a new password</p><input id="p" type="password" placeholder="New password (min 8 characters)"><div class="err" id="err"></div><button class="btn" id="go">Save password</button></div></div>');
    $app.replaceChildren(n);
    n.querySelector('#go').onclick = async function () {
      var err = n.querySelector('#err');
      try { await api('POST', '/api/auth/reset-password', { token: token, password: n.querySelector('#p').value }); history.replaceState(null, '', '/'); authView('login'); }
      catch (e) { err.textContent = e.message; }
    };
  }

  async function logout() { try { await api('POST', '/api/auth/logout'); } catch (e) {} S = { user: null, convs: [], cur: null, msgs: [], busy: false }; authView('login'); }

  /* ---------- chat ---------- */
  var ui = {};
  function chatView() {
    var n = el('<div class="chat"><aside class="side" id="side"><button class="btn" id="new">+ New chat</button><div class="list" id="list"></div>' +
      '<div class="row"><span id="who"></span><button class="link" id="lo">Log out</button></div></aside>' +
      '<section class="main"><div class="top"><button class="menu" id="menu">☰</button><b>CEASER <span>AI</span></b><span class="row" id="bal"></span></div>' +
      '<div class="msgs" id="msgs"></div><div class="bar hide" id="bar"></div>' +
      '<div class="composer"><textarea id="in" rows="1" placeholder="Message CEASER AI…"></textarea><button class="btn" id="send">Send</button></div></section></div>');
    $app.replaceChildren(n);
    ui = { side: n.querySelector('#side'), list: n.querySelector('#list'), msgs: n.querySelector('#msgs'), input: n.querySelector('#in'), send: n.querySelector('#send'), bar: n.querySelector('#bar'), bal: n.querySelector('#bal') };
    n.querySelector('#who').textContent = S.user.name;
    n.querySelector('#lo').onclick = logout;
    n.querySelector('#menu').onclick = function () { ui.side.classList.toggle('open'); };
    n.querySelector('#new').onclick = function () { S.cur = null; S.msgs = []; renderMsgs(); renderList(); ui.side.classList.remove('open'); ui.input.focus(); };
    ui.send.onclick = sendMsg;
    ui.input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && innerWidth > 720) { e.preventDefault(); sendMsg(); } });
    ui.input.addEventListener('input', function () { ui.input.style.height = 'auto'; ui.input.style.height = Math.min(ui.input.scrollHeight, 160) + 'px'; });
    loadConvs(); renderMsgs(); loadBalance();
  }
  async function loadBalance() {
    try { var r = await api('GET', '/api/tokens'); var b = r.balance || {}; S.balance = b; if (typeof b.remaining === 'number') ui.bal.textContent = b.remaining.toLocaleString() + ' tokens left'; } catch (e) {}
  }
  async function loadConvs() { try { S.convs = (await api('GET', '/api/chat/conversations')).conversations; renderList(); } catch (e) { flash(e.message); } }
  function renderList() {
    ui.list.replaceChildren();
    S.convs.forEach(function (c) {
      var it = el('<div class="item' + (S.cur === c.id ? ' on' : '') + '"><span>' + esc(c.title || 'New conversation') + '</span><button title="Delete">✕</button></div>');
      it.onclick = function () { openConv(c.id); ui.side.classList.remove('open'); };
      it.querySelector('button').onclick = async function (e) {
        e.stopPropagation(); if (!confirm('Delete this chat?')) return;
        try { await api('DELETE', '/api/chat/conversations/' + c.id); if (S.cur === c.id) { S.cur = null; S.msgs = []; renderMsgs(); } loadConvs(); } catch (er) { flash(er.message); }
      };
      ui.list.appendChild(it);
    });
  }
  async function openConv(id) {
    try { var r = await api('GET', '/api/chat/conversations/' + id); S.cur = id; S.msgs = r.messages; renderMsgs(); renderList(); } catch (e) { flash(e.message); }
  }
  function renderMsgs() {
    ui.msgs.replaceChildren();
    if (!S.msgs.length) { ui.msgs.appendChild(el('<div class="empty"><h2>How can I help?</h2><div>Ask anything, or paste code to debug.</div></div>')); return; }
    S.msgs.forEach(function (m) { ui.msgs.appendChild(msgNode(m)); });
    ui.msgs.scrollTop = ui.msgs.scrollHeight;
  }
  function msgNode(m) { var n = el('<div class="m ' + m.role + '"></div>'); n.innerHTML = m.role === 'user' ? '<p>' + esc(m.content).replace(/\n/g, '<br>') + '</p>' : md(m.content || '…'); return n; }
  function flash(t) { ui.bar.textContent = t; ui.bar.classList.remove('hide'); clearTimeout(flash.t); flash.t = setTimeout(function () { ui.bar.classList.add('hide'); }, 6000); }

  async function sendMsg() {
    var text = ui.input.value.trim(); if (!text || S.busy) return;
    S.busy = true; ui.send.disabled = true; ui.input.value = ''; ui.input.style.height = 'auto';
    try {
      if (!S.cur) { var c = (await api('POST', '/api/chat/conversations')).conversation; S.cur = c.id; S.convs.unshift(c); }
      S.msgs.push({ role: 'user', content: text }); var am = { role: 'assistant', content: '' }; S.msgs.push(am); renderMsgs();
      var node = ui.msgs.lastChild;
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
          else if (ev === 'error') flash(data.message);
        }
      }
      loadConvs(); loadBalance();
    } catch (e) {
      flash(e.message); if (S.msgs.length && S.msgs[S.msgs.length - 1].role === 'assistant' && !S.msgs[S.msgs.length - 1].content) { S.msgs.pop(); renderMsgs(); }
    }
    S.busy = false; ui.send.disabled = false; ui.input.focus();
  }

  /* ---------- routing / boot ---------- */
  function route() {
    var p = location.pathname, q = new URLSearchParams(location.search);
    if (p === '/reset-password' && q.get('token')) return resetView(q.get('token'));
    if (p === '/verify-email' && q.get('token')) { if (!S.user) { return authView('login'); } return verifyView(q.get('token')); }
    if (!S.user) return authView(p === '/register' ? 'signup' : 'login');
    if (!S.user.emailVerified) return verifyView();
    chatView();
  }
  (async function boot() {
    try { await ensureCsrf(); S.user = (await api('GET', '/api/auth/me')).user; } catch (e) { S.user = null; }
    route();
  })();
})();
