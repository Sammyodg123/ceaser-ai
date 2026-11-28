(function () {
  'use strict';
  var VB = '<svg class="vb" viewBox="0 0 24 24" aria-label="Verified"><path d="M12 1.8l2.5 1.7 3-.2 1.2 2.8 2.6 1.5-.6 3 1.2 2.7-2 2.2-.4 3-3 .7-2.2 2.1L12 21l-2.3 1.3-2.2-2.1-3-.7-.4-3-2-2.2L3.3 11.6l-.6-3 2.6-1.5 1.2-2.8 3 .2z" fill="#1d9bf0"/><path d="M7.8 12.2l3 3 5.6-6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
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

  /* ---------- static reveal: nothing slides or fades in, content is simply there ---------- */
  function reveal(root) { if (window.CzFX) CzFX.reveal(root); else root.querySelectorAll('.rv').forEach(function (n) { n.classList.add('in'); }); }

  /* ---------- landing ---------- */
  var timers = [];
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function later(fn, ms) { var id = setTimeout(function () { var i = timers.indexOf(id); if (i > -1) timers.splice(i, 1); fn(); }, ms); timers.push(id); } // prune finished timers: the list used to grow forever and slowly froze the page

  function landing() {
    clearTimers();
    var n = el('<div class="landing-shell">' +
      '<nav class="nav"><div class="logo"><div class="dot">C</div><span class="wm">CEASER <span class="grad">AI</span></span>' + VB + '</div><div class="sp"></div><button class="navmenu" id="navmenu" aria-label="Open menu">☰</button><div class="navlinks">' +
      '<a class="nl" href="#features">Features</a><a class="nl" href="#how">How it works</a><a class="nl" href="#plans">Pricing</a><a class="nl" href="#faq">FAQ</a>' +
      (S.user && S.user.emailVerified ? '<div class="acct" id="acct"><button class="acct-b" id="acctb" aria-haspopup="true" aria-expanded="false"><span class="acct-av">' + esc(initial(S.user.name)) + '</span><span class="acct-n">' + esc(S.user.name) + '</span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></button><div class="acct-m" id="acctm" hidden><div class="acct-i"><b>' + esc(S.user.name) + '</b><small>' + esc(S.user.email) + '</small></div><a href="/chat.html">Open chat</a><a href="/chat.html#dashboard">Dashboard</a><a href="/chat.html#settings">Settings</a><button id="acctso">Sign out</button></div></div>' : '<button class="btn ghost" id="li">Log in</button><button class="btn" id="su">Get started</button>') + '</div></nav>' +
      '<header class="hero"><div><div class="pill live-pill" id="lpill"><b></b><span class="lt">CEASER AI · Online and ready</span><span class="eq"><i></i><i></i><i></i><i></i></span></div>' +
      '<h1 class="h1one"><span class="l1">Your AI for</span> <span class="tw" id="tw">learning</span><span class="l2"><span class="grad">built to ship.</span></span></h1><div class="engline"><span>Powered by</span><b class="type" id="ty">Claude</b></div><div class="signal-row" aria-label="Live AI engines"><span><i></i> Claude <small>ready</small></span><span><i></i> Gemini <small>ready</small></span><span><i></i> Live replies <small>on</small></span></div>' +
      '<p class="lead">Chat, write, debug and build with an assistant that streams answers instantly, remembers your conversations and never gets in your way.</p><div class="engchips" id="engchips"></div>' +
      '<div class="cta"><button class="btn lg" id="su2">' + (S.user && S.user.emailVerified ? 'Open chat →' : 'Start free →') + '</button><a class="btn ghost lg" href="#features" style="text-decoration:none;display:inline-block">See what it does</a></div>' +
      '<div class="stats"><div><b data-to="20" data-suf="k">20k</b>free tokens</div><div><b>Live</b>streaming replies</div><div><b>24/7</b>always on</div></div></div>' +
      '<div class="win"><div class="bar"><i></i><i></i><i></i></div><div class="demo-tools"><span>Live prompt preview</span><button id="replay">Replay</button></div><div class="body" id="demo"></div></div></header>' +
      '<div class="marq" aria-hidden="true"><div class="mt"><span>Claude</span><span>Gemini</span><span>Grok</span><span>NVIDIA</span><span>Groq</span><span>DeepSeek</span><span>Qwen</span><span>Llama</span><span>Mistral</span><span>WormGPT</span><span>Claude</span><span>Gemini</span><span>Grok</span><span>NVIDIA</span><span>Groq</span><span>DeepSeek</span><span>Qwen</span><span>Llama</span><span>Mistral</span><span>WormGPT</span></div></div>' +
      '<section class="sec" id="features"><h2 class="rv">Everything you need, <span class="grad">nothing you don’t</span></h2><p class="sub rv">Fast, focused and designed to feel great on your phone.</p><div class="grid">' +
      feat('⚡', 'Instant streaming', 'Watch answers appear word by word instead of waiting for a wall of text.') +
      feat('💻', 'Code that works', 'Syntax-friendly code blocks with one-tap copy. Debug, refactor, explain.') +
      feat('🗂️', 'Saved chats', 'Every conversation is stored, searchable and one tap away.') +
      feat('🔒', 'Private by default', 'Secure sessions, verified accounts and protected requests.') +
      feat('🎁', 'Refer and earn', 'Invite friends and unlock bonus tokens for every five who join.') +
      feat('📱', 'Made for mobile', 'Smooth, thumb-friendly layout that feels like a native app.') +
      '</div></section>' +
      '<section class="sec" id="can"><h2 class="rv">What CEASER AI <span class="grad">can do</span></h2><p class="sub rv">One app that chats, codes, debugs, decodes and builds. Tap a skill and watch it work live.</p>' +
      '<div class="tabs rv" id="skilltabs"><button class="on" data-k="0">💬 Chat</button><button data-k="1">🐞 Debug</button><button data-k="2">🔓 Decode</button><button data-k="3">🌐 Build</button><button data-k="4">🖼️ Screenshots</button></div>' +
      '<div class="win rv" style="max-width:640px;margin:18px auto 0"><div class="bar"><i></i><i></i><i></i></div><div class="body" id="skilldemo" style="min-height:190px"></div></div>' +
      '<ul class="caps rv"><li><b>Chat about anything</b> Ask questions, brainstorm, summarize, translate and write.</li><li><b>Write and explain code</b> Python, JavaScript, PHP, Bash, SQL, Java and more, with one-tap copy.</li><li><b>Debug errors</b> Paste a stack trace or broken code and get the cause and the fix.</li><li><b>Decode and convert</b> Base64, hex, URL encoding, JSON, regex, timestamps and unknown formats.</li><li><b>Build websites and apps</b> Landing pages, dashboards, WhatsApp, Telegram and Discord bots, with live preview.</li><li><b>Read screenshots</b> Send an image of an error or a design and get an answer about it.</li><li><b>Generate images</b> Describe it, get it.</li><li><b>Voice input</b> Talk instead of typing.</li></ul></section>' +
      '<section class="sec" id="engines"><h2 class="rv">All the AI, <span class="grad">one place</span></h2><p class="sub rv">CEASER AI connects Claude, Gemini, Grok, NVIDIA, Groq, DeepSeek, Qwen, Llama and more, so you never juggle ten apps or ten subscriptions.</p>' +
      '<div class="grid"><div class="card rv"><div class="ic">🛡️</div><h3>Auto · Censored</h3><p>The everyday lane. Auto sends each message to the best engine across NVIDIA, Grok, Gemini, Claude and the rest, and falls back to the next one if an engine is busy.</p></div>' +
      '<div class="card rv"><div class="ic">🔥</div><h3>Auto · Uncensored</h3><p>A separate lane with its own Auto. It routes only through the uncensored engines, with straight, direct answers and no mixing with the censored ones.</p></div>' +
      '<div class="card rv"><div class="ic">🎯</div><h3>Pick any engine</h3><p>Don’t want Auto? Choose a single engine yourself and stay on it for the whole chat.</p></div>' +
      '<div class="card rv"><div class="ic">🔁</div><h3>Never stuck</h3><p>If one provider is down or rate limited, the next engine answers. You just keep chatting.</p></div></div></section>' +
      '<section class="sec" id="plans"><h2 class="rv">Simple <span class="grad">pricing</span></h2><p class="sub rv">Start free. Upgrade when you need more.</p><div class="grid" id="pl"></div></section>' +
      '<section class="sec" id="how"><h2 class="rv">From idea to answer in <span class="grad">three steps</span></h2><p class="sub rv">No setup. No learning curve.</p><div class="steps">' +
      '<div class="step rv"><b>01</b><h3>Ask</h3><p>Type or paste anything: a question, a bug, a feature you want built.</p></div>' +
      '<div class="step rv"><b>02</b><h3>Watch it think</h3><p>Replies stream in live, with clean code blocks you can copy in one tap.</p></div>' +
      '<div class="step rv"><b>03</b><h3>Keep going</h3><p>Every chat is saved and searchable, so you can pick up right where you left off.</p></div></div></section>' +
      '<section class="sec" id="faq"><h2 class="rv">Frequently asked <span class="grad">questions</span></h2><div class="faq rv">' +
      '<details><summary>What counts as a token?</summary><p>Tokens cover both what you send and what the AI writes back. Free tokens refill every 5 hours. Paid plans renew every 30 days.</p></details>' +
      '<details><summary>Is it really free to start?</summary><p>Yes. Every account gets free tokens, and you can upgrade any time for a bigger allowance.</p></details>' +
      '<details><summary>Do I need to verify my email?</summary><p>Yes. We send a 6-digit code to your inbox when you sign up, which keeps accounts secure.</p></details>' +
      '<details><summary>Are my chats private?</summary><p>Your conversations are tied to your account and protected by secure sessions.</p></details></div></section>' +
      '<section class="sec" id="contact"><div class="contact rv"><small>CONTACT</small><a class="mail" id="cmail" href="#">Talk to us</a><p style="margin:0;color:var(--mute)">Partnerships, custom plans or support. Write to the CEASER AI team.</p></div></section>' +
      '<footer class="foot">© ' + new Date().getFullYear() + ' CEASER AI · Built by Ceaser</footer></div>');
    $app.replaceChildren(n);
    var signed = S.user && S.user.emailVerified;
    if (signed) {
      var ab = n.querySelector('#acctb'), am = n.querySelector('#acctm');
      n.querySelector('.nav').insertBefore(n.querySelector('#acct'), n.querySelector('#navmenu'));
      ab.onclick = function (e) { e.stopPropagation(); am.hidden = !am.hidden; ab.setAttribute('aria-expanded', String(!am.hidden)); };
      document.addEventListener('click', function h(e) { if (!n.isConnected) return document.removeEventListener('click', h); if (!am.contains(e.target)) { am.hidden = true; ab.setAttribute('aria-expanded', 'false'); } });
      n.querySelector('#acctso').onclick = logout;
      n.querySelector('#su2').onclick = function () { location.href = '/chat.html'; };
    } else {
      n.querySelector('#li').onclick = function () { authModal('login'); };
      n.querySelector('#su').onclick = n.querySelector('#su2').onclick = function () { authModal('signup'); };
    }
    (function live() {
      var p = n.querySelector('#lpill'); if (!p) return; var t = p.querySelector('.lt');
      function chk() { if (!p.isConnected) return; var t0 = performance.now();
        fetch('/api/health', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; var ms = Math.round(performance.now() - t0); p.classList.remove('off'); t.textContent = 'Online · ' + ms + ' ms'; })
          .catch(function () { p.classList.add('off'); t.textContent = navigator.onLine ? 'Server unreachable' : 'You are offline'; });
        later(chk, 30000); }
      chk();
    })();
    var nav = n.querySelector('.nav'), navmenu = n.querySelector('#navmenu');
    navmenu.setAttribute('aria-expanded', 'false'); navmenu.onclick = function (e) { e.stopPropagation(); nav.classList.toggle('open'); navmenu.textContent = nav.classList.contains('open') ? '×' : '☰'; navmenu.setAttribute('aria-expanded', String(nav.classList.contains('open'))); };
    document.addEventListener('click', function h(e) { if (!nav.isConnected) return document.removeEventListener('click', h); if (nav.classList.contains('open') && !nav.contains(e.target)) { nav.classList.remove('open'); navmenu.textContent = '☰'; navmenu.setAttribute('aria-expanded', 'false'); } });
    n.querySelectorAll('.navlinks a').forEach(function (a) { a.onclick = function () { nav.classList.remove('open'); navmenu.textContent = '☰'; }; });
    n.querySelector('#replay').onclick = function () { demoLoop(n.querySelector('#demo')); };
    if (window.CzFX) CzFX.init(n); reveal(n); typeLoop(n.querySelector('#tw')); demoLoop(n.querySelector('#demo'));
    renderPlans(n.querySelector('#pl'));
    (function skills() {
      var SK = [
        [['Explain how a VPN works, simply', 'A VPN wraps your traffic in an encrypted tunnel to a server, so websites see the server’s address instead of yours.', '']],
        [['Debug: ReferenceError: x is not defined', 'You used x before declaring it, or it lives in another scope. Declare it first:', 'let x = 0;\nconsole.log(x);']],
        [['Decode: 48 65 6c 6c 6f', 'That is hexadecimal for ASCII text. It decodes to:', 'Hello']],
        [['Build a landing page for my coffee shop', 'Done. Header, menu, map and an order button, ready to preview:', '<h1>Brew & Co</h1>\n<a href=\"#menu\">See menu</a>']],
        [['[screenshot of a red error box]', 'The error says the port is already in use. Stop the other process or change the port:', 'PORT=3001 npm start']]
      ], box = n.querySelector('#skilldemo'), tabs = n.querySelector('#skilltabs');
      if (!box || !tabs) return;
      function go(k) { cur = k; tabs.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.k === String(k)); }); demoLoop(box, SK[k][0]); }
      var cur = 0, touched = false;
      tabs.onclick = function (e) { var b = e.target.closest('button'); if (b) { touched = true; go(+b.dataset.k); } };
      (function auto() { later(function () { if (!box.isConnected) return; if (!touched) go((cur + 1) % SK.length); auto(); }, 8500); })();
      go(0);
    })();
    fetch('/api/public/config').then(function (r) { return r.json(); }).then(function (c) { var seen = {}, names = [], box = n.querySelector('#engchips'); (c.models || []).forEach(function (m) { var g = m.group || m.label; if (m.id === 'auto' || seen[g]) return; seen[g] = 1; names.push(g); var b = document.createElement('button'); b.className = 'engchip'; b.textContent = g; b.onclick = function () { try { localStorage.setItem('cz_model', m.id); } catch (e) {} if (S.user && S.user.emailVerified) location.href = '/chat.html'; else authModal('signup'); }; if (box) box.appendChild(b); }); if (names.length) window.__eng = names; var a = n.querySelector('#cmail'); if (a && c.app && c.app.email) { a.textContent = c.app.email; a.href = 'mailto:' + c.app.email; } }).catch(function () {});
  }
  function feat(i, t, p) { return '<div class="card rv"><div class="ic">' + i + '</div><h3>' + t + '</h3><p>' + p + '</p></div>'; }
  async function renderPlans(box) {
    var plans = S.plans;
    if (!plans.length) { try { plans = S.plans = (await api('GET', '/api/public/config')).plans || []; } catch (e) { plans = []; } }
    if (!plans.length) { box.parentNode.classList.add('hide'); return; }
    box.replaceChildren();
    plans.forEach(function (p, i) {
      var c = el('<div class="card plan rv' + (i === 1 ? ' hot' : '') + '"><h3>' + esc(p.name) + '</h3><div class="pr">$' + p.priceUsd + '<small> /month</small></div><ul><li>' +
        Number(p.monthlyTokens || p.tokens).toLocaleString() + (p.resetHours ? ' tokens every ' + p.resetHours + ' hours' : ' tokens / month') + '</li><li>Streaming chat</li><li>Saved conversations</li>' + (p.voiceInput ? '<li>Voice input</li>' : '') + '</ul><button class="btn' + (i === 1 ? '' : ' ghost') + '" style="width:100%">' + (p.priceUsd ? 'Get ' + esc(p.name) : 'Start free') + '</button></div>');
      c.querySelector('button').onclick = function () { authModal('signup'); };
      box.appendChild(c);
    });
    reveal(box);
  }
  var TW = ['learning', 'coding', 'writing', 'debugging', 'building', 'creating'];
  function typeLoop(node) {
    if (!node) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var wi = 0, ci = node.textContent.length, del = true;
    function step() {
      if (!node.isConnected) return;
      var w = TW[wi];
      if (!del) { ci++; node.textContent = w.slice(0, ci); if (ci >= w.length) { del = true; return later(step, 1700); } return later(step, 85); }
      ci--; node.textContent = w.slice(0, ci);
      if (ci <= 0) { del = false; wi = (wi + 1) % TW.length; return later(step, 260); }
      later(step, 42);
    }
    later(step, 1800);
  }
  var DEMO = [
    ['Write a function that reverses a string', 'Here you go:', 'function reverse(s) {\n  return [...s].reverse().join(\"\");\n}'],
    ['Explain recursion in one line', 'A function that solves a problem by calling itself on a smaller piece until it hits a simple case.', ''],
    ['Why is my code returning undefined?', 'Usually a missing return, or an async call you forgot to await. Paste it and I’ll find it.', ''],
    ['Decode this: SGVsbG8gQ0VBU0VS', 'That is Base64. Decoded it reads:', 'Hello CEASER'],
    ['Debug: TypeError: cannot read properties of undefined', 'Something is undefined before you read it. Guard it first:', 'const name = user?.profile?.name ?? \"guest\";']
  ];
  function demoLoop(box, scr) {
    if (!box) return;
    if (box._demoTimer) { clearTimeout(box._demoTimer); box._demoTimer = null; }
    var run = box._run = (box._run || 0) + 1; // a newer run cancels any older one
    var s;
    if (scr) s = scr; else { box._i = ((box._i == null ? -1 : box._i) + 1) % DEMO.length; s = DEMO[box._i]; }
    var question = String(s[0] || ''), answer = String(s[1] || ''), code = String(s[2] || '');
    function alive() { return box.isConnected && box._run === run; }
    function wait(fn, ms) { box._demoTimer = setTimeout(function () { if (alive()) fn(); }, ms); }
    box.replaceChildren();
    var u = el('<div class="b u"></div>'); u.textContent = question; box.appendChild(u);
    wait(function () {
      var a = el('<div class="b a"><span class="demo-status"><i></i><i></i><i></i></span></div>'); box.appendChild(a);
      wait(function () {
        var txt = document.createTextNode(''), caret = el('<span class="caret"></span>'), pos = 0, cpos = 0, pre = null;
        a.replaceChildren(txt, caret);
        (function tick() {
          if (pos < answer.length) { pos += answer.length > 90 ? 2 : 1; txt.nodeValue = answer.slice(0, pos); return wait(tick, 20); }
          if (code) {
            if (!pre) { pre = el('<pre></pre>'); a.insertBefore(pre, caret); }
            if (cpos < code.length) { cpos += 2; pre.textContent = code.slice(0, cpos); return wait(tick, 16); }
          }
          caret.remove();
          if (!scr) wait(function () { box.classList.add('fade'); wait(function () { box.classList.remove('fade'); demoLoop(box); }, 280); }, 3600);
        })();
      }, 750);
    }, 480);
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
    var sub = forgot ? 'We’ll email you a reset link.' : signup ? 'Free to start. No card needed.' : 'Log in to continue.';
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
          S.user = r.user; ov.remove(); if (r.user && r.user.emailVerified) { location.replace('/chat.html'); return; } route(); return;
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
      '<div class="resend">Didn’t receive the code? <button class="link" id="rs" disabled>Resend in <b id="cd">30</b>s</button></div>' +
      '</div><button class="link lo" id="lo">Use a different account · Log out</button></div></div>');
    $app.replaceChildren(n);
    var stage = n.querySelector('#stage'), orbit = n.querySelector('#orbit'), boxes = [].slice.call(n.querySelectorAll('.ob')),
      slotEls = [].slice.call(n.querySelectorAll('.o3s')), err = n.querySelector('#err'), go = n.querySelector('#go'),
      card = n.querySelector('#card'), ttl = n.querySelector('#ttl'), sub = n.querySelector('#sub'), kick = n.querySelector('#kick'), busy = false;
    boxes[0].setAttribute('autocomplete', 'one-time-code');
    var subHtml = sub.innerHTML;
    function wait(ms) { return new Promise(function (r) { setTimeout(r, Math.max(0, ms)); }); }

    // geometry: row slot + ring slot for every box (computed in px so it fits any phone width)
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
      if (s === 'err' || s === 'back') { // freeze the spin where it is so the ring settles smoothly
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

    function vxShow() {
      var dots = ''; for (var i = 0; i < 14; i++) dots += '<i style="--a:' + (i * 360 / 14).toFixed(1) + 'deg;--d:' + (62 + (i % 3) * 14) + 'px;--c:' + ['#35f0b0', '#4aa8ff', '#8b7bff'][i % 3] + '"></i>';
      var v = document.createElement('div'); v.className = 'vx'; v.setAttribute('role', 'status');
      v.innerHTML = '<div class="vx-glow"></div><div class="vx-core"><svg class="vx-ring" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="vxg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#35f0b0"/><stop offset=".55" stop-color="#4aa8ff"/><stop offset="1" stop-color="#8b7bff"/></linearGradient></defs><circle class="vx-track" cx="60" cy="60" r="52"/><circle class="vx-arc" cx="60" cy="60" r="52" pathLength="100"/></svg><svg class="vx-check" viewBox="0 0 52 52" aria-hidden="true"><path pathLength="100" d="M14 27.5l8.5 8.5L38.5 18"/></svg><span class="vx-burst">' + dots + '</span></div><h2>Verified</h2><p>Opening your workspace</p><div class="vx-bar"><i></i></div><div class="vx-wipe"></div>';
      document.body.appendChild(v);
      setTimeout(function () { v.classList.add('out'); }, 1950);
    }
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
        await wait(1700 - (Date.now() - t0)); // let the ring finish a nice spin
        state('ok'); card.classList.add('good'); go.classList.remove('load'); go.querySelector('span').textContent = 'Verified';
        kick.textContent = 'Success'; ttl.textContent = 'Verified!'; sub.textContent = 'You’re all set.';
        vxShow(); // new clean success scene: ring completes, check draws, soft burst, wipe into the chat
        setTimeout(function () { location.replace('/chat.html'); }, 2650);
        return;
      } catch (e) {
        await wait(1500 - (Date.now() - t0));
        err.textContent = e.status >= 400 && e.status < 500 ? 'That code isn’t right. Try again.' : (e.message || 'Could not verify the code. Try again.');
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
  async function logout() { try { await api('POST', '/api/auth/logout'); } catch (e) {} S.user = null; S.convs = []; S.cur = null; S.msgs = []; history.replaceState(null, '', '/'); route(); }

  /* ---------- chat ---------- */
  var SUGGEST = [['</>', 'Build a responsive portfolio website with a dark theme'], ['?', 'Explain how JWT authentication works with an example'], ['!', 'Find the bug in my JavaScript function'], ['API', 'Plan a REST API for a task manager with Express and MongoDB']];
  function chatView() {
    clearTimers();
    var n = el('<div class="chat"><aside class="side" id="side"><div class="sbrand"><div class="dot">C</div>CEASER <small>AI</small></div><button class="btn" id="new">＋ New chat</button><input class="ssearch" id="ssearch" placeholder="Search chats" autocomplete="off"><div class="list" id="list"></div><div class="usage"><div class="ur"><span class="pl" id="upl">Free</span><b id="ubal">…</b></div><div class="bar"><i id="ubar"></i></div><small id="ureset">Tokens left</small></div>' +
      '<div class="me"><div class="av">' + esc(initial(S.user.name)) + '</div><div class="n">' + esc(S.user.name) + '<small>' + esc(S.user.email) + '</small></div><button class="link" id="lo">Log out</button></div></aside>' +
      '<section class="main"><div class="top"><button class="menu" id="menu">☰</button><div class="logo"><div class="dot">C</div><span class="wm">CEASER <span class="grad">AI</span></span>' + VB + '</div><div class="sp"></div><span class="chip hide" id="bal"></span></div>' +
      '<div class="msgs" id="msgs"><div class="inner" id="inner"></div></div>' +
      '<div class="dock"><div class="comp"><textarea id="in" rows="1" placeholder="Message CEASER AI…"></textarea><button class="btn" id="send" aria-label="Send">↑</button></div><p class="hint">CEASER AI can make mistakes. Verify important information.</p></div></section></div>');
    $app.replaceChildren(n);
    ui = { side: n.querySelector('#side'), list: n.querySelector('#list'), msgs: n.querySelector('#msgs'), inner: n.querySelector('#inner'), input: n.querySelector('#in'), send: n.querySelector('#send'), bal: n.querySelector('#bal'), main: n.querySelector('.main') };
    n.querySelector('#lo').onclick = logout;
    n.querySelector('#ssearch').oninput = function () { var q = this.value.toLowerCase(); ui.list.querySelectorAll('.item').forEach(function (it) { it.style.display = it.textContent.toLowerCase().indexOf(q) < 0 ? 'none' : ''; }); };
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
    try { var b = (await api('GET', '/api/tokens')).balance || {}; if (typeof b.remaining === 'number') { ui.bal.textContent = '⚡ ' + b.remaining.toLocaleString() + ' tokens'; ui.bal.classList.remove('hide'); var ub = document.getElementById('ubal'); if (ub) { ub.textContent = b.remaining.toLocaleString() + ' tokens left'; document.getElementById('ubar').style.width = Math.max(2, Math.min(100, b.remaining / (b.total || b.limit || 1) * 100)) + '%'; document.getElementById('upl').textContent = (b.plan || 'free').replace(/^./, function (c) { return c.toUpperCase(); }); if (b.resetAt) document.getElementById('ureset').textContent = 'Resets ' + new Date(b.resetAt).toLocaleDateString(); } } } catch (e) {}
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
      var e = el('<div class="empty"><h2>Welcome to CEASER AI.<br>What would you like to create today?</h2><p>Think. Create. Build. Ship.</p><div class="sug"></div></div>');
      SUGGEST.forEach(function (s) { var b = el('<button><i>' + esc(s[0]) + '</i><span>' + esc(s[1]) + '</span></button>'); b.onclick = function () { sendMsg(s[1]); }; e.querySelector('.sug').appendChild(b); });
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
    if (p === '/') return landing();
    location.replace('/chat.html');
  }
  var startupAt = performance.now();
  function finishStartup() {
    var screen = document.getElementById('boot-screen'), progress = document.getElementById('btp') || document.getElementById('boot-progress'), bar = screen && screen.querySelector('.boot-track i');
    var MIN = 900, t0 = startupAt, done = false;
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
