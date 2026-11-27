(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var S = { user: null, convs: [], cur: null, msgs: [], busy: false, page: 'chat', model: localStorage.getItem('cz_model') || '', models: [], files: [], bal: null };
  var IC = {
    menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8M5 9.5V21h14V9.5"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.7A8 8 0 1 1 21 12z"/></svg>',
    tpl: '<svg viewBox="0 0 24 24"><path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z"/></svg>',
    dash: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    gift: '<svg viewBox="0 0 24 24"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7S10 3 7.5 3 5 6 8 7M12 7s2-4 4.5-4S19 6 16 7"/></svg>',
    team: '<svg viewBox="0 0 24 24"><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-1.5a4 4 0 0 0-3-3.9M16 4.2a3.5 3.5 0 0 1 0 6.6"/></svg>',
    set: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    clip: '<svg viewBox="0 0 24 24"><path d="M21 12.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l9-9a3.7 3.7 0 0 1 5.2 5.2l-9 9a1.8 1.8 0 0 1-2.6-2.6l8.3-8.3"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    cpu: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    chev: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    ok: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    bolt: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    card: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
    dots: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    wa: '<svg viewBox="0 0 24 24"><path d="M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.5z"/><path d="M9 9c0 3 3 6 6 6l1-1.5-2-1-1 .8c-1-.4-2-1.400-2.400-2.400l.8-1-1-2z"/></svg>',
    xx: '<svg viewBox="0 0 24 24"><path d="M4 4l16 16M20 4L4 20"/></svg>',
    home2: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8M5 9.500V21h5v-6h4v6h5V9.500"/></svg>',
    dl: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>',
    tag: '<svg viewBox="0 0 24 24"><path d="M3 12V3h9l9 9-9 9z"/><circle cx="8" cy="8" r="1.2"/></svg>'
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(h) { var t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstChild; }
  function csrf() { var m = document.cookie.match(/(?:^|;\s*)cc_csrf=([^;]+)/); return m ? decodeURIComponent(m[1]) : ''; }
  async function api(method, url, body) {
    if (method !== 'GET' && !csrf()) await fetch('/api/auth/csrf', { credentials: 'same-origin' });
    var h = {}; if (method !== 'GET') h['x-csrf-token'] = csrf(); if (body !== undefined) h['content-type'] = 'application/json';
    var r = await fetch(url, { method: method, credentials: 'same-origin', headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
    var t = await r.text(), d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {}
    if (!r.ok) { var e = new Error((d && d.error && d.error.message) || 'Request failed'); e.status = r.status; throw e; } return d;
  }
  function toast(t) { var n = $('#toast'); n.textContent = t; n.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { n.classList.remove('on'); }, 3500); }
  function inline(s) { return s.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'); }
  var EXT = { javascript: 'js', js: 'js', node: 'js', typescript: 'ts', ts: 'ts', python: 'py', py: 'py', bash: 'sh', sh: 'sh', shell: 'sh', json: 'json', css: 'css', html: 'html', java: 'java', go: 'go', rust: 'rs', php: 'php', ruby: 'rb', sql: 'sql', yaml: 'yml', yml: 'yml', jsx: 'jsx', tsx: 'tsx', c: 'c', cpp: 'cpp', md: 'md', markdown: 'md', xml: 'xml' };
  var KW = /\b(function|const|let|var|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|import|from|export|default|async|await|try|catch|finally|throw|typeof|in|of|this|true|false|null|undefined|def|self|None|True|False|elif|lambda|with|as|pass|raise|yield|print|public|private|static|void|int|string|bool|fn|let|mut|impl|struct|enum|use|pub|package|func|echo|then|fi|done|do|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|JOIN|ORDER|BY|GROUP|LIMIT|AND|OR|NOT|NULL)\b/g;
  function hl(code) {
    var re = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|--[^\n]*)|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\.|[^`\\])*`?)|(\b\d[\d_.]*\b)|([A-Za-z_$][\w$]*)(?=\()|([^\s\w"'`\/#-]+|[\s\S])/g, out = '', m;
    while ((m = re.exec(code))) {
      if (m[1]) out += '<span class="tk-c">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="tk-s">' + esc(m[2]) + '</span>';
      else if (m[3]) out += '<span class="tk-n">' + esc(m[3]) + '</span>';
      else if (m[4]) out += (KW.test(m[4]) ? '<span class="tk-k">' : '<span class="tk-f">') + esc(m[4]) + '</span>', KW.lastIndex = 0;
      else { var t = m[5]; KW.lastIndex = 0; out += esc(t); }
      if (m[0] === '') re.lastIndex++;
    }
    // keywords outside calls
    return out.replace(/(^|[^\w>-])(function|const|let|var|return|if|else|for|while|class|import|from|export|default|async|await|try|catch|new|def|elif|self|None|True|False|print|public|private|static|void|int|string|fn|struct|use|pub|package|func|echo|throw|typeof|extends|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE|TABLE|JOIN)(?![\w])(?![^<]*<\/span>)/g, '$1<span class="tk-k">$2</span>');
  }
  function md(src, live) {
    var parts = String(src).split(/```/), out = '';
    parts.forEach(function (p, i) {
      if (i % 2) {
        var open = live && i === parts.length - 1, nl = p.indexOf('\n'), info = nl > -1 ? p.slice(0, nl).trim() : (open ? p.trim() : ''), code = nl > -1 ? p.slice(nl + 1) : (open ? '' : p);
        code = code.replace(/\n$/, '');
        var lang = (info.split(/[\s:]/)[0] || '').toLowerCase(), fn = (info.slice(lang.length).replace(/^[\s:]+/, '').replace(/^(title|file|filename)=/, '').replace(/["']/g, '').split(/\s+/)[0] || '');
        if (fn && !/\.[A-Za-z0-9]{1,8}$/.test(fn)) fn = '';
        var html5 = lang === 'html' || lang === 'htm' || /^\s*<!doctype html|^\s*<html/i.test(code);
        if (!fn) fn = html5 ? 'index.html' : (lang && EXT[lang]) ? 'file.' + EXT[lang] : '';
        var n = code ? code.split('\n').length : 0, prev = html5 && !open && code.length > 40;
        out += '<div class="cb' + (open ? ' wr' : '') + (prev ? ' hp' : '') + '" data-name="' + esc(fn || 'code.txt') + '"><div class="h"><span class="fi">' + esc((fn.split('.').pop() || lang || 'txt').slice(0, 4)) + '</span><span class="lg">' + esc(fn || lang || 'code') + '</span>' +
          (open ? '<span class="wt"><b></b>writing…</span>' : (prev ? '<span class="tb"><button data-tab="pv" class="on">Preview</button><button data-tab="cd">Code</button></span>' : '<span class="ln">' + n + ' line' + (n === 1 ? '' : 's') + '</span>')) +
          (open ? '' : '<button class="ic" data-dl aria-label="Download" title="Download">' + IC.dl + '</button>') + '<button data-copy>Copy</button></div>' +
          (prev ? '<div class="pv"><iframe sandbox="allow-scripts allow-forms allow-popups allow-modals" loading="lazy" data-pv></iframe><button class="full" data-full>Full screen ⤢</button></div>' : '') +
          '<pre' + (prev ? ' hidden' : '') + '><code>' + hl(code) + (open ? '<span class="caret"></span>' : '') + '</code></pre></div>';
        return;
      }
      var html = '', list = null, para = [];
      var fp = function () { if (para.length) { html += '<p>' + inline(para.join('<br>')) + '</p>'; para = []; } }, fl = function () { if (list) { html += '</' + list + '>'; list = null; } };
      esc(p).split('\n').forEach(function (ln) {
        var h = ln.match(/^(#{1,3})\s+(.*)$/), ul = ln.match(/^\s*[-*]\s+(.*)$/), ol = ln.match(/^\s*\d+[.)]\s+(.*)$/);
        if (h) { fp(); fl(); html += '<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>'; }
        else if (ul || ol) { fp(); var t = ul ? 'ul' : 'ol'; if (list !== t) { fl(); html += '<' + t + '>'; list = t; } html += '<li>' + inline((ul || ol)[1]) + '</li>'; }
        else if (!ln.trim()) { fp(); fl(); } else { fl(); para.push(ln); }
      }); fp(); fl(); out += html;
    }); return out;
  }
  /* attachments are sent inside the message between markers; the UI shows them as file chips */
  var FRE = /\n*<<<FILE ([^\n>]*)>>>\n([\s\S]*?)\n<<<END>>>/g;
  function splitFiles(t) { var f = []; var txt = String(t || '').replace(FRE, function (_, n, b) { f.push({ name: n, size: b.length }); return ''; }).trim(); return { text: txt, files: f }; }
  function chipHTML(f) { var ext = (f.name.split('.').pop() || 'file').slice(0, 4).toUpperCase(); return '<div class="fchip"><i>' + esc(ext) + '</i><span><b>' + esc(f.name) + '</b><small>' + (f.size >= 1000 ? (f.size / 1000).toFixed(1) + 'K' : f.size) + ' chars</small></span></div>'; }
  function copy(t, b, label) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = label; }, 1400); }, function () { toast('Press and hold to copy'); }); }
  function stream(url, body, onDelta) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf(), accept: 'text/event-stream' }, body: JSON.stringify(body) }).then(async function (r) {
      if (!r.ok) { var t = await r.text(), d = {}; try { d = JSON.parse(t); } catch (e) {} throw new Error((d.error && d.error.message) || 'Request failed (' + r.status + ')'); }
      var rd = r.body.getReader(), dec = new TextDecoder(), buf = '';
      for (;;) {
        var x = await rd.read(); if (x.done) break; buf += dec.decode(x.value, { stream: true });
        var i; while ((i = buf.indexOf('\n\n')) >= 0) {
          var blk = buf.slice(0, i); buf = buf.slice(i + 2);
          var ev = (blk.match(/^event: (.*)$/m) || [])[1], dl = (blk.match(/^data: (.*)$/m) || [])[1]; if (!dl) continue;
          var d2 = JSON.parse(dl); if (ev === 'delta') onDelta(d2.text); else if (ev === 'error') toast(d2.message);
        }
      }
    });
  }

  /* ---------- shell / drawer ---------- */
  var NAV = [['templates', 'tpl', 'AI Templates'], ['dashboard', 'dash', 'Dashboard'], ['plan', 'card', 'Plan & usage'], ['referrals', 'gift', 'Referrals'], ['team', 'team', 'Team'], ['settings', 'set', 'Settings']];
  var shell = $('#shell');
  function navOpen(o) { shell.classList.toggle('nav-open', o); }
  function buildDrawer() {
    var u = S.user, d = $('#drawer'), q = (S.q || '');
    d.innerHTML = '<div class="brand"><i>C</i>CEASER <small>AI</small><button class="clp" id="col" aria-label="Close menu">' + IC.menu + '</button></div>' +
      '<button class="nv newc' + (S.page === 'chat' && !S.cur ? ' on' : '') + '" data-p="chat">' + IC.chat + 'New chat</button>' +
      '<label class="srch">' + IC.search + '<input id="sq" placeholder="Search chats" autocomplete="off" value="' + esc(q) + '"><kbd>⌘K</kbd></label>' +
      '<div class="sect">RECENT</div><div class="hist" id="hist"></div>' +
      '<div class="navs">' + NAV.map(function (n) { return '<button class="nv' + (S.page === n[0] ? ' on' : '') + '" data-p="' + n[0] + '">' + IC[n[1]] + n[2] + '</button>'; }).join('') +
      '<a class="home" href="/">' + IC.back + 'Back to home</a></div>' +
      '<div class="tk" id="tk"></div>' +
      '<div class="me"><div class="av">' + esc((u.name || '?').charAt(0).toUpperCase()) + '</div><div class="n">' + esc(u.name) + '<small>' + esc(u.email) + '</small></div><button class="out" id="lo" aria-label="Sign out" title="Sign out">' + IC.out + '</button></div>';
    d.onclick = function (e) { var b = e.target.closest('[data-p]'); if (b) go(b.dataset.p); else if (e.target.closest('#col')) navOpen(false); else if (e.target.closest('a.home') && innerWidth < 960) navOpen(false); };
    $('#sq').oninput = function () { S.q = this.value; renderHist(); };
    $('#lo').onclick = signOut;
    renderHist(); renderTk();
  }
  async function signOut() { try { await api('POST', '/api/auth/logout'); } catch (e) {} location.replace('/'); }
  addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); navOpen(true); var i = $('#sq'); if (i) i.focus(); } });
  function renderHist() {
    var h = $('#hist'); if (!h) return; h.replaceChildren();
    var qq = (S.q || '').toLowerCase(), list = S.convs.filter(function (c) { return !qq || (c.title || 'New conversation').toLowerCase().indexOf(qq) > -1; });
    if (!list.length) h.innerHTML = '<div class="hi"><span class="none">' + (qq ? 'No matches' : 'No chats yet') + '</span></div>';
    list.forEach(function (c) {
      var it = el('<div class="hi' + (S.cur === c.id ? ' on' : '') + '"><span>' + esc(c.title || 'New conversation') + '</span><button aria-label="Delete">' + IC.trash.replace('<svg', '<svg width="15" height="15"') + '</button></div>');
      it.onclick = function () { openConv(c.id); };
      it.querySelector('button').onclick = async function (e) { e.stopPropagation(); if (!confirm('Delete this chat?')) return; try { await api('DELETE', '/api/chat/conversations/' + c.id); if (S.cur === c.id) { S.cur = null; S.msgs = []; if (S.page === 'chat') renderChat(); } loadConvs(); } catch (er) { toast(er.message); } };
      h.appendChild(it);
    });
  }
  function renderTk() {
    var t = $('#tk'), b = S.bal; if (!t || !b) return; var pct = b.total ? Math.max(2, Math.min(100, b.remaining / b.total * 100)) : 0, free = (b.plan || 'free') === 'free';
    var days = b.resetAt ? Math.max(0, Math.ceil((new Date(b.resetAt) - Date.now()) / 864e5)) : null;
    t.innerHTML = '<div class="r1"><span class="pl">' + cap(b.plan) + '</span><span>' + fmtK(b.remaining || 0) + ' tokens left</span></div><div class="tr"><i style="width:' + pct + '%"></i></div><div class="r2"><span>' + (days != null ? 'Resets in ' + days + ' day' + (days === 1 ? '' : 's') : '') + '</span>' + (free ? '<button class="up" data-p="plan">' + IC.tpl + 'Upgrade</button>' : '') + '</div>';
  }
  function fmtK(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : n.toLocaleString(); }
  async function loadBal() { try { S.bal = (await api('GET', '/api/tokens')).balance || null; renderTk(); } catch (e) {} }
  async function loadConvs() { try { S.convs = (await api('GET', '/api/chat/conversations')).conversations || []; renderHist(); } catch (e) {} }
  async function openConv(id) { try { var r = await api('GET', '/api/chat/conversations/' + id); S.cur = id; S.msgs = r.messages; go('chat', true); if (innerWidth < 960) navOpen(false); } catch (e) { toast(e.message); } }

  function go(p, keep) {
    if (p === 'chat' && !keep) { S.cur = null; S.msgs = []; }
    S.page = p; if (location.hash !== '#' + p) history.replaceState(null, '', '#' + p);
    var main = $('#main'), t = { chat: 'CEASER AI', templates: 'AI Templates', dashboard: 'Dashboard', plan: 'Plan & usage', referrals: 'Referrals', team: 'Team', settings: 'Settings' };
    $('#ttl').textContent = t[p] || 'CEASER AI';
    ({ chat: renderChat, templates: renderTemplates, dashboard: renderDash, plan: function (m) { renderSettings(m, 'billing'); }, referrals: renderRef, team: renderTeam, settings: renderSettings })[p](main);
    main.firstElementChild && main.firstElementChild.classList.add('fadein');
    buildDrawer(); if (innerWidth < 960) navOpen(false);
  }

  /* ---------- chat ---------- */
  var SUG = [['</>', 'Build a responsive portfolio website'], ['?', 'Explain how JWT authentication works'], ['!', 'Find the bug in my JavaScript function'], ['API', 'Plan a REST API for a task manager']];
  function modelLabel() { var m = S.models.find(function (x) { return x.id === S.model; }) || S.models[0]; return m ? m.label : 'No model'; }
  function renderChat(main) {
    main.innerHTML = '<div class="msgs" id="msgs"><div class="in" id="inner"></div></div>' +
      '<div class="dock"><div class="comp"><div class="files" id="files"></div><textarea id="ta" rows="1" placeholder="Message CEASER AI…"></textarea>' +
      '<div class="crow"><button class="cbtn" id="att" aria-label="Upload file" title="Upload file">' + IC.clip + '</button><button class="cbtn" id="mic" aria-label="Voice input" title="Voice input">' + IC.mic + '</button><button class="mchip" id="mchip">' + IC.cpu.replace('<svg', '<svg width="14" height="14"') + '<span id="ml">' + esc(modelLabel()) + '</span>' + IC.chev + '</button><span class="sp"></span><button class="send" id="send" aria-label="Send">' + IC.up + '</button></div></div>' +
      '<p class="hint">CEASER AI can make mistakes. Verify important information.</p></div>';
    var ta = $('#ta');
    ta.oninput = function () { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 170) + 'px'; };
    ta.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey && innerWidth > 760) { e.preventDefault(); send(); } };
    $('#send').onclick = function () { send(); };
    $('#att').onclick = pickFile; $('#mchip').onclick = modelSheet; $('#mic').onclick = dictate;
    $('#inner').onclick = blockClick;
    drawMsgs(); drawFiles();
  }
  /* previews are served by the backend with a sandbox CSP (own opaque origin), so generated pages can run scripts safely */
  function previewURL(code) { return api('POST', '/api/chat/preview', { html: code }).then(function (r) { return '/api/chat/preview/' + r.id; }); }
  function mountPreviews(root) {
    if (!root) return; root.querySelectorAll('iframe[data-pv]').forEach(function (f) {
      if (f.dataset.mt) return; f.dataset.mt = 1; var code = f.closest('.cb').querySelector('code').textContent;
      previewURL(code).then(function (u) { f.src = u; }).catch(function () { var cb = f.closest('.cb'); if (cb) { cb.querySelector('.pv').hidden = true; cb.querySelector('pre').hidden = false; } });
    });
  }
  function blockClick(e) {
    var cb = e.target.closest('.cb'); if (!cb) return;
    var code = function () { return cb.querySelector('code').textContent; }, b;
    if ((b = e.target.closest('[data-copy]'))) return copy(code(), b, 'Copy');
    if (e.target.closest('[data-dl]')) { var a = document.createElement('a'), u = URL.createObjectURL(new Blob([code()], { type: 'text/plain' })); a.href = u; a.download = cb.dataset.name || 'file.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); return toast('Downloading ' + (cb.dataset.name || 'file')); }
    if ((b = e.target.closest('[data-tab]'))) { var pv = b.dataset.tab === 'pv'; cb.querySelector('.pv').hidden = !pv; cb.querySelector('pre').hidden = pv; cb.querySelectorAll('[data-tab]').forEach(function (x) { x.classList.toggle('on', x === b); }); return; }
    if (e.target.closest('[data-full]')) {
      var o = el('<div class="fs"><div class="fb"><span>' + esc(cb.dataset.name) + '</span><button aria-label="Close">' + IC.x + '</button></div><iframe sandbox="allow-scripts allow-forms allow-popups allow-modals"></iframe></div>');
      previewURL(code()).then(function (u) { o.querySelector('iframe').src = u; }).catch(function (er) { toast(er.message); }); o.querySelector('button').onclick = function () { o.remove(); }; document.body.appendChild(o);
    }
  }
  function drawMsgs() {
    var inner = $('#inner'); if (!inner) return; inner.replaceChildren();
    if (!S.msgs.length) {
      var h = el('<div class="hello"><div class="lg">C</div><h1>Welcome to CEASER AI. <span>What would you like to create today?</span></h1><p>Think. Create. Build. Ship.</p><div class="sug"></div></div>');
      SUG.forEach(function (s) { var b = el('<button><i>' + esc(s[0]) + '</i><span>' + esc(s[1]) + '</span></button>'); b.onclick = function () { send(s[1]); }; h.querySelector('.sug').appendChild(b); });
      inner.appendChild(h); return;
    }
    S.msgs.forEach(function (m) { inner.appendChild(msgNode(m)); }); mountPreviews(inner); var ms = $('#msgs'); ms.style.scrollBehavior = 'auto'; ms.scrollTop = ms.scrollHeight; ms.style.scrollBehavior = '';
  }
  function msgNode(m) {
    var n = el('<div class="m ' + m.role + '"><div class="c"></div></div>'), c = n.querySelector('.c');
    if (m.role === 'user') {
      var sp = splitFiles(m.content); c.innerHTML = (sp.files.length ? '<div class="fchips">' + sp.files.map(chipHTML).join('') + '</div>' : '') + (sp.text ? '<div class="ut"></div>' : ''); var ut = c.querySelector('.ut'); if (ut) ut.textContent = sp.text; if (!sp.files.length && !sp.text) c.textContent = m.content;
    } else c.innerHTML = (m.content ? '' : '<div class="think"><span class="sp">' + IC.tpl + '</span><span class="tx">Thinking…</span></div>') + '<div class="body">' + (m.content ? md(m.content) : '') + '</div>';
    return n;
  }
  function plusMenu(btn) {
    var p = $('#pop'), r = btn.getBoundingClientRect();
    p.innerHTML = '<button data-a="up">' + IC.clip + '<div>Upload file<small>Text, code, CSV, JSON…</small></div></button><button data-a="mic">' + IC.mic + '<div>Choose audio<small>Dictate with your voice</small></div></button><button data-a="model">' + IC.cpu + '<div>Choose model<small>' + esc(modelLabel()) + '</small></div></button>';
    p.hidden = false; p.style.left = Math.max(10, Math.min(r.left, innerWidth - 250)) + 'px'; p.style.bottom = (innerHeight - r.top + 8) + 'px'; p.style.top = 'auto';
    p.onclick = function (e) { var b = e.target.closest('[data-a]'); if (!b) return; p.hidden = true; var a = b.dataset.a; if (a === 'up') pickFile(); else if (a === 'mic') dictate(); else modelSheet(); };
    setTimeout(function () { document.addEventListener('pointerdown', function h(e) { if (!p.contains(e.target)) { p.hidden = true; document.removeEventListener('pointerdown', h); } }); }, 0);
  }
  function pickFile() {
    var i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.accept = '.txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.html,.css,.java,.c,.cpp,.go,.rs,.php,.rb,.sh,.sql,.xml,.yml,.yaml,.log,.env,.ini,.toml,text/*';
    i.onchange = function () { Array.from(i.files).slice(0, 4).forEach(function (f) { if (f.size > 400000) return toast(f.name + ' is too large (max 400 KB).'); var r = new FileReader(); r.onload = function () { S.files.push({ name: f.name, text: String(r.result).slice(0, 9000), size: f.size }); drawFiles(); }; r.readAsText(f); }); };
    i.click();
  }
  function drawFiles() {
    var f = $('#files'); if (!f) return; f.replaceChildren(); f.style.display = S.files.length ? '' : 'none';
    S.files.forEach(function (x, i) { var c = el('<div class="fc"><i>' + esc((x.name.split('.').pop() || 'file').slice(0, 4).toUpperCase()) + '</i><span><b>' + esc(x.name) + '</b><small>' + (x.size >= 1000 ? (x.size / 1000).toFixed(1) + ' KB' : x.size + ' B') + ' · ready</small></span><button aria-label="Remove">' + IC.x + '</button></div>'); c.querySelector('button').onclick = function () { S.files.splice(i, 1); drawFiles(); }; f.appendChild(c); });
  }
  var rec = null;
  function dictate() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition, mic = $('#mic'), ta = $('#ta');
    if (!SR) return toast('Voice input isn’t supported in this browser. Try Chrome or Safari.');
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.interimResults = true; rec.continuous = true; rec.lang = navigator.language || 'en-US';
    var base = ta.value ? ta.value + ' ' : '';
    rec.onresult = function (e) { var t = ''; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; ta.value = base + t; ta.oninput(); };
    rec.onend = function () { rec = null; mic && mic.classList.remove('rec'); ta.placeholder = 'Message CEASER AI…'; }; rec.onerror = function (e) { toast(e.error === 'not-allowed' ? 'Microphone permission denied.' : 'Voice input stopped.'); };
    try { rec.start(); mic.classList.add('rec'); ta.placeholder = 'Listening…'; toast('Listening — tap the mic again to stop'); } catch (e) { rec = null; }
  }
  function modelSheet() {
    var s = $('#sheet'), ms = S.models.length ? S.models : [{ id: '', label: 'No model yet', desc: 'Add an API key to your .env file' }];
    s.innerHTML = '<div class="box"><h3>Choose model</h3>' + ms.map(function (m) { return '<button class="opt' + (m.id === S.model || (!S.model && m === ms[0]) ? ' on' : '') + '" data-m="' + esc(m.id) + '"><div><b>' + esc(m.label) + '</b><small>' + esc(m.desc || '') + '</small></div><span class="ck">' + ((m.id === S.model || (!S.model && m === ms[0])) ? IC.ok : '') + '</span></button>'; }).join('') + '</div>';
    s.hidden = false;
    s.onclick = function (e) { var b = e.target.closest('[data-m]'); if (b) { S.model = b.dataset.m; localStorage.setItem('cz_model', S.model); var l = $('#ml'); if (l) l.textContent = modelLabel(); } if (b || e.target === s) s.hidden = true; };
  }
  /* smooth "being written" effect: incoming text is revealed at an adaptive speed */
  function typer(am, node, ms, th) {
    var q = '', raf = 0, done = false, resolve = null;
    function tick() {
      raf = 0;
      if (q) {
        var n = Math.max(3, Math.ceil(q.length / 10)); am.content += q.slice(0, n); q = q.slice(n); if (th && !th.dataset.w) { th.dataset.w = 1; th.querySelector('.tx').textContent = 'Writing…'; }
        node.innerHTML = md(am.content, true);
        var near = ms.scrollHeight - ms.scrollTop - ms.clientHeight < 140; if (near) ms.scrollTop = ms.scrollHeight;
      }
      if (q || !done) raf = requestAnimationFrame(tick); else if (resolve) resolve();
    }
    return { push: function (t) { q += t; if (!raf) raf = requestAnimationFrame(tick); },
      finish: function () { done = true; return new Promise(function (r) { resolve = r; if (!q) { if (raf) cancelAnimationFrame(raf); r(); } else if (!raf) raf = requestAnimationFrame(tick); }); } };
  }
  async function send(preset) {
    var ta = $('#ta'), text = (preset || (ta && ta.value) || '').trim(); if ((!text && !S.files.length) || S.busy) return; if (!text) text = 'Please review the attached file.';
    var full = text + S.files.map(function (f) { return '\n\n<<<FILE ' + f.name.replace(/[<>\n]/g, '') + '>>>\n' + f.text + '\n<<<END>>>'; }).join('');
    S.busy = true; $('#send').disabled = true; if (rec) rec.stop(); ta.value = ''; ta.style.height = 'auto'; S.files = []; drawFiles();
    var am = { role: 'assistant', content: '' };
    try {
      if (!S.cur) { var cv = (await api('POST', '/api/chat/conversations')).conversation; S.cur = cv.id; S.convs.unshift(cv); renderHist(); }
      S.msgs.push({ role: 'user', content: full }, am); drawMsgs();
      var cn = $('#inner').lastChild.querySelector('.c'), node = cn.querySelector('.body'), th = cn.querySelector('.think'), ms = $('#msgs'), t0 = Date.now();
      var tw = typer(am, node, ms, th);
      await stream('/api/chat/conversations/' + S.cur + '/messages', { content: full, model: S.model || undefined }, function (d) { tw.push(d); });
      await tw.finish(); node.innerHTML = md(am.content); mountPreviews(node); loadConvs(); loadBal();
      if (th) { var sec = Math.max(1, Math.round((Date.now() - t0) / 1000)); th.classList.add('done'); th.innerHTML = '<span class="sp">' + IC.ok + '</span><span class="tx">Worked for ' + (sec >= 60 ? Math.floor(sec / 60) + 'm ' + (sec % 60) + 's' : sec + 's') + '</span>'; }
    } catch (e) { toast(e.message); if (!am.content) { S.msgs = S.msgs.filter(function (m) { return m !== am; }); if (S.page === 'chat') drawMsgs(); } }
    S.busy = false; var s = $('#send'); if (s) s.disabled = false;
  }

  /* ---------- pages ---------- */
  function page(main, html) { main.innerHTML = '<div class="page"><div class="pw">' + html + '</div></div>'; return $('.pw', main); }
  var cap = function (s) { return (s || 'free').replace(/^./, function (c) { return c.toUpperCase(); }); };
  async function renderDash(main) {
    var w = page(main, '<a class="btn g back" href="/" style="text-decoration:none">'+IC.back+'Home</a><h1>Dashboard</h1><p class="sb">Your usage, activity and plan at a glance.</p><div class="stats">' +
      [['bolt', 'd-r', 'Tokens left'], ['dash', 'd-u', 'Used this month'], ['tag', 'd-p', 'Current plan'], ['chat', 'd-c', 'Conversations']].map(function (x) { return '<div class="st"><div class="ic">' + IC[x[0]] + '</div><b id="' + x[1] + '">—</b><span>' + x[2] + '</span></div>'; }).join('') + '</div>' +
      '<div class="card"><h3>Token usage <span class="msg" id="d-rs" style="float:right"></span></h3><div class="bar"><i id="d-f"></i></div><div class="bl2"><span id="d-pc">0%</span><span id="d-t"></span></div></div>' +
      '<div class="card"><h3>Recent conversations</h3><div id="d-l"><small>Loading…</small></div></div><div class="card" id="d-up" hidden style="background:var(--acs);border-color:#bfe6d3"><h3>Upgrade to Pro</h3><p style="margin:0 0 12px;color:var(--mu)">500,000 tokens a month plus voice input.</p><button class="btn" id="d-ub">See plans →</button></div>');
    var b = S.bal; if (!b) { await loadBal(); b = S.bal || {}; }
    var rem = b.remaining || 0, tot = b.total || 0, used = b.used != null ? b.used : Math.max(0, tot - rem), pct = tot ? Math.min(100, Math.round(used / tot * 100)) : 0;
    $('#d-r').textContent = rem.toLocaleString(); $('#d-u').textContent = used.toLocaleString(); $('#d-p').textContent = cap(b.plan); $('#d-pc').textContent = pct + '% used'; $('#d-t').textContent = tot.toLocaleString() + ' total';
    if (b.resetAt) $('#d-rs').textContent = 'Resets ' + new Date(b.resetAt).toLocaleDateString(); requestAnimationFrame(function () { var f = $('#d-f'); if (f) f.style.width = pct + '%'; });
    if ((b.plan || 'free') === 'free') { $('#d-up').hidden = false; $('#d-ub').onclick = function () { go('plan'); }; }
    $('#d-c').textContent = S.convs.length; var l = $('#d-l'); l.replaceChildren();
    if (!S.convs.length) l.innerHTML = '<small>No conversations yet. Start chatting!</small>';
    S.convs.slice(0, 6).forEach(function (c) { var r = el('<div class="row"><span>' + esc(c.title || 'New conversation') + '</span><small>' + (c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : '') + '</small></div>'); r.onclick = function () { openConv(c.id); }; l.appendChild(r); });
  }
  var TPL = [['✍️', 'Blog Post', 'Article with intro, sections and CTA', 'Write a detailed, engaging blog post about: {t}. Include an introduction, 3-4 sections with subheadings, and a conclusion.'], ['📧', 'Cold Email', 'High-converting outreach', 'Write a concise, personalized cold email for: {t}. Friendly, value-focused, with a clear call to action.'], ['💻', 'Code Review', 'Bugs, improvements, refactor', 'Review this code and give bugs found, improvements, best practices and a refactored version. Code: {t}'], ['📄', 'Resume Bio', 'Professional summary', 'Write a compelling 3-4 sentence professional resume summary. Role/background: {t}.'], ['🗺️', 'Project Plan', 'Phases, milestones, risks', 'Create a detailed project plan for: {t}. Include phases, milestones, tasks, timeline estimates and risks.'], ['📱', 'Social Post', '3 engaging variations', 'Write 3 variations of a social media post about: {t}, each engaging, with emojis and a call to action.'], ['🔍', 'Explain Concept', 'Clear, with examples', 'Explain {t} clearly. Start simple, go deeper, use a real-world analogy, and end with a practical example.'], ['🐛', 'Debug Helper', 'Find and fix bugs fast', 'Help me debug this issue: {t}. Identify the root cause, explain why, and provide a fix.']];
  function renderTemplates(main) {
    var slug = function (s) { return s.toLowerCase().replace(/\s+/g, '-'); };
    var w = page(main, '<h1>AI Templates</h1><p class="sb">Pick a template, add your topic, get a result instantly.</p><div class="tg">' + TPL.map(function (t, i) {
      var pv = esc(t[3]).replace('{t}', '<u>{topic}</u>');
      return '<button class="tc cbk" data-i="' + i + '"><div class="h"><span class="tl"><i></i><i></i><i></i></span><em>' + slug(t[1]) + '.tpl</em><b>' + t[0] + '</b></div><pre>' + pv + '</pre><div class="f"><span><strong>' + esc(t[1]) + '</strong> · ' + esc(t[2]) + '</span><span class="use">Use ↗</span></div></button>';
    }).join('') + '</div><div id="ws"></div>');
    w.onclick = function (e) {
      var c = e.target.closest('.tc'); if (!c) return; var t = TPL[c.dataset.i], last = '';
      w.querySelectorAll('.tc').forEach(function (x) { x.classList.toggle('sel', x === c); });
      $('#ws').innerHTML = '<div class="cbk wsb"><div class="h"><span class="tl"><i></i><i></i><i></i></span><em>' + slug(t[1]) + '.tpl</em><b>' + t[0] + '</b></div><div class="wsc"><div class="fld"><label>Your topic</label><textarea id="tt" placeholder="Describe your topic or paste your content…"></textarea></div><button class="btn" id="tr">Generate ✨</button><div class="out" id="to" hidden></div><div class="tact" id="ta2" hidden><button class="btn g" id="tcp">Copy result</button><button class="btn g" id="toc">Open in chat →</button></div></div></div>';
      $('#ws').scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(function () { $('#tt').focus({ preventScroll: true }); }, 350);
      $('#tr').onclick = async function () {
        var topic = $('#tt').value.trim(); if (!topic) return $('#tt').focus(); var b = this, o = $('#to'); b.disabled = true; b.textContent = 'Generating…'; o.hidden = false; o.innerHTML = '<span class="dots"><i></i><i></i><i></i></span>'; last = '';
        try { var cv = (await api('POST', '/api/chat/conversations')).conversation; var r = 0;
          await stream('/api/chat/conversations/' + cv.id + '/messages', { content: t[3].replace('{t}', topic), model: S.model || undefined }, function (d) { last += d; if (!r) r = requestAnimationFrame(function () { r = 0; o.innerHTML = md(last, true); }); });
          o.innerHTML = md(last); mountPreviews(o); api('DELETE', '/api/chat/conversations/' + cv.id).catch(function () {}); $('#ta2').hidden = false; loadBal();
        } catch (er) { o.innerHTML = '<span style="color:var(--err)">' + esc(er.message) + '</span>'; }
        b.disabled = false; b.textContent = 'Generate ✨';
        $('#tcp').onclick = function () { copy(last, this, 'Copy result'); }; $('#toc').onclick = function () { S.cur = null; S.msgs = [{ role: 'user', content: topic }, { role: 'assistant', content: last }]; go('chat', true); };
      };
    };
  }
  function renderRef(main) {
    var r = S.user.referral || {}, link = r.link || '', code = r.code || '—', n = r.verifiedCount || 0, p = n % 5, left = 5 - p;
    var tile = function (ic, label, attr) { return '<button class="shr" ' + attr + '><span>' + IC[ic] + '</span>' + label + '</button>'; };
    var msg = 'Join me on CEASER AI! ' + link;
    var w = page(main, '<a class="btn g back" href="/" style="text-decoration:none">' + IC.back + 'Home</a><h1>Referrals</h1><p class="sb">Every 5 friends who join and verify earns you a bonus token pack.</p>' +
      '<div class="refhero"><small>YOUR CODE</small><div class="code" id="rcode">' + esc(code) + '</div><div class="lnk"><span id="rlink">' + esc(link.replace(/^https?:\/\//, '')) + '</span><button id="rc">' + IC.copy + 'Copy</button></div></div>' +
      '<div class="shrs">' + tile('wa', 'WhatsApp', 'data-u="https://wa.me/?text=' + encodeURIComponent(msg) + '"') + tile('xx', 'X', 'data-u="https://twitter.com/intent/tweet?text=' + encodeURIComponent('Try CEASER AI ' + link) + '"') + tile('mail', 'Email', 'data-u="mailto:?subject=Try%20CEASER%20AI&body=' + encodeURIComponent(link) + '"') + tile('share', 'More', 'id="rsh"') + '</div>' +
      '<div class="card"><div class="ph"><h3>Next reward</h3><span class="msg">' + p + ' / 5</span></div><div class="segs">' + [0, 1, 2, 3, 4].map(function (i) { return '<i class="' + (i < p ? 'f' : '') + '"></i>'; }).join('') + '</div><small style="color:var(--mu)">' + left + ' more verified ' + (left === 1 ? 'friend' : 'friends') + ' to unlock the next bonus.</small></div>' +
      '<div class="stats3"><div class="st"><b>' + n + '</b><span>Verified</span></div><div class="st"><b>' + Math.floor(n / 5) + '</b><span>Rewards</span></div><div class="st"><b>' + Math.floor(n / 5) * 50 + 'K</b><span>Tokens earned</span></div></div>');
    function cp(b) { copy(link, b, b.innerHTML); }
    $('#rc').onclick = function () { var b = this, h = b.innerHTML; (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { b.innerHTML = IC.ok + 'Copied'; setTimeout(function () { b.innerHTML = h; }, 1400); }, function () { toast('Press and hold the link to copy'); }); };
    $('#rcode').onclick = function () { navigator.clipboard && navigator.clipboard.writeText(code).then(function () { toast('Code copied'); }); };
    w.querySelectorAll('[data-u]').forEach(function (b) { b.onclick = function () { open(b.dataset.u, '_blank'); }; });
    $('#rsh').onclick = function () { if (navigator.share) navigator.share({ title: 'CEASER AI', text: 'Join me on CEASER AI!', url: link }).catch(function () {}); else { navigator.clipboard && navigator.clipboard.writeText(link); toast('Link copied'); } };
  }
  function renderTeam(main) {
    var u = S.user, w = page(main, '<a class="btn g back" href="/" style="text-decoration:none">' + IC.back + 'Home</a><h1>Team</h1><p class="sb">Shared workspaces are in development.</p>' +
      '<div class="card"><h3>Team workspaces</h3><p style="margin:0 0 14px;color:var(--mu)">Invite members, share conversations and manage roles in one place.</p><button class="btn" id="tn">Notify me when it’s ready</button></div>' +
      '<div class="card"><h3>Members</h3><div class="mem"><div class="av">' + esc(u.name.charAt(0).toUpperCase()) + '</div><div><b>' + esc(u.name) + '</b><small>' + esc(u.email) + '</small></div><span class="pill2">Owner</span></div></div>');
    $('#tn').onclick = function () { this.textContent = '🎉 You’ll be notified'; this.disabled = true; };
  }
  function renderSettings(main, tab) {
    tab = tab || 'profile';
    var u = S.user, since = u.createdAt ? new Date(u.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
    var pwf = function (id, label, ac) { return '<div class="fld"><label>' + label + '</label><div class="pwf"><input id="' + id + '" type="password" autocomplete="' + ac + '"><button type="button" class="eyeb" aria-label="Show password">' + IC.eye + '</button></div></div>'; };
    var w = page(main, '<a class="btn g back" href="/" style="text-decoration:none">' + IC.back + 'Home</a><div class="prof"><div class="av">' + esc(u.name.charAt(0).toUpperCase()) + '</div><div><h2>' + esc(u.name) + '<span class="pill2">' + cap(u.plan) + '</span></h2><small>' + esc(u.email) + '</small></div></div>' +
      '<div class="tabs" id="tabs"><button data-t="profile">' + IC.user + 'Profile</button><button data-t="security">' + IC.lock + 'Security</button><button data-t="billing">' + IC.card + 'Billing</button></div>' +
      '<div class="tp" data-t="profile"><div class="card"><h3>Profile</h3><div class="fld"><label>Full name</label><input id="sn" value="' + esc(u.name) + '" autocomplete="name"></div><button class="btn" id="sns">Save name</button><span class="msg" id="snm"></span></div>' +
      '<div class="card"><h3>Account</h3><div class="kv"><span>Email</span><b>' + esc(u.email) + '</b></div><div class="kv"><span>Member since</span><b>' + esc(since) + '</b></div><div class="kv"><span>Plan</span><b>' + cap(u.plan) + '</b></div></div>' +
      '<div class="card"><h3>Session</h3><p style="margin:0 0 12px;color:var(--mu)">Sign out of this device.</p><button class="btn g" id="so">' + IC.out.replace('<svg', '<svg width="16" height="16" style="vertical-align:-3px;margin-right:6px"') + 'Sign out</button></div></div>' +
      '<div class="tp" data-t="security"><div class="card"><h3>Change password</h3>' + pwf('pc', 'Current password', 'current-password') + pwf('pn', 'New password (min 8)', 'new-password') + '<div class="strength"><i id="pst"></i></div>' + pwf('pr', 'Confirm new password', 'new-password') + '<button class="btn" id="ps">Update password</button><span class="msg" id="pm"></span><p style="margin:12px 0 0;color:var(--mu);font-size:12.5px">Updating your password signs you out of your other devices.</p></div>' +
      '<div class="card"><h3 style="color:var(--err)">Danger zone</h3><p style="margin:0 0 12px;color:var(--mu)">Permanently delete your account and all data.</p><button class="btn d" id="del">Delete my account</button></div></div>' +
      '<div class="tp" data-t="billing"><div class="card"><h3>Plan &amp; usage</h3><div id="pl"><small>Loading…</small></div></div></div>');
    function show(t) { tab = t; w.querySelectorAll('.tp').forEach(function (x) { x.hidden = x.dataset.t !== t; }); w.querySelectorAll('#tabs button').forEach(function (x) { x.classList.toggle('on', x.dataset.t === t); }); $('.page', main).scrollTop = 0; }
    $('#tabs').onclick = function (e) { var b = e.target.closest('[data-t]'); if (b) show(b.dataset.t); };
    show(tab);
    w.querySelectorAll('.eyeb').forEach(function (b) { b.onclick = function () { var i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; b.style.color = i.type === 'text' ? 'var(--ac)' : ''; }; });
    function say(id, t, bad) { var m = $(id); m.textContent = t; m.className = 'msg' + (bad ? ' e' : ''); }
    $('#so').onclick = signOut;
    $('#sns').onclick = async function () { var n = $('#sn').value.trim(); if (!n) return say('#snm', 'Name cannot be empty.', 1); try { var r = await api('PATCH', '/api/auth/profile', { name: n }); S.user = r.user || S.user; S.user.name = n; say('#snm', 'Saved ✓'); buildDrawer(); } catch (e) { say('#snm', e.message, 1); } };
    $('#pn').oninput = function () { var v = this.value, sc = 0; if (v.length >= 8) sc++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) sc++; if (/\d/.test(v)) sc++; if (/[^\w\s]/.test(v) || v.length >= 14) sc++; var s = $('#pst'); s.style.width = (v ? Math.max(1, sc) * 25 : 0) + '%'; s.style.background = ['', '#ff6b81', '#ffc857', '#19c3ff', '#2dffa0'][v ? Math.max(1, sc) : 0]; };
    $('#ps').onclick = async function () {
      var c = $('#pc').value, n = $('#pn').value, r = $('#pr').value, b = this;
      if (!c || !n || !r) return say('#pm', 'Fill in all fields.', 1); if (n.length < 8) return say('#pm', 'At least 8 characters.', 1); if (n !== r) return say('#pm', 'Passwords do not match.', 1); if (n === c) return say('#pm', 'Choose a different password.', 1);
      b.disabled = true; b.textContent = 'Updating…';
      try { await api('POST', '/api/auth/change-password', { currentPassword: c, newPassword: n }); say('#pm', 'Password updated ✓'); $('#pc').value = $('#pn').value = $('#pr').value = ''; $('#pst').style.width = 0; toast('Password updated'); } catch (e) { say('#pm', e.message, 1); }
      b.disabled = false; b.textContent = 'Update password';
    };
    (async function () {
      if (!S.bal) await loadBal(); var b = S.bal || {}, free = (b.plan || 'free') === 'free', pl = $('#pl'); if (!pl) return;
      var pct = b.total ? Math.min(100, Math.round((b.used || 0) / b.total * 100)) : 0;
      pl.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between"><div><b style="font-size:20px">' + cap(b.plan) + '</b><br><small style="color:var(--mu)">' + (b.remaining || 0).toLocaleString() + ' tokens left' + (b.resetAt ? ' · resets ' + new Date(b.resetAt).toLocaleDateString() : '') + '</small></div>' + (free ? '' : '<span class="msg">Active</span>') + '</div><div class="bar" style="margin-top:12px"><i style="width:' + pct + '%"></i></div><div class="pg" id="pg" style="margin-top:14px"></div>';
      if (!free) return;
      try { var cfg = await api('GET', '/api/public/config'); (cfg.plans || []).filter(function (p) { return p.priceUsd > 0; }).forEach(function (p) {
        var c = el('<div class="pc"><b>' + esc(p.name) + '</b> <small>$' + p.priceUsd + '/mo</small><ul><li>' + Number(p.monthlyTokens || p.tokens).toLocaleString() + ' tokens / month</li><li>Streaming chat</li>' + (p.voiceInput ? '<li>Voice input</li>' : '') + '</ul><button class="btn" style="width:100%">Get ' + esc(p.name) + '</button></div>');
        c.querySelector('button').onclick = async function () { try { var r = await api('POST', '/api/billing/checkout', { plan: p.id, provider: 'stripe' }); if (r.url) location.href = r.url; } catch (e) { toast(e.message || 'Billing not configured yet.'); } }; $('#pg').appendChild(c); }); } catch (e) {}
    })();
    $('#del').onclick = function () { if (!confirm('Permanently delete your account and all data?') || !confirm('Last chance — delete everything?')) return; api('DELETE', '/api/auth/me').then(function () { location.replace('/'); }).catch(function (e) { toast(e.message); }); };
  }

  /* ---------- top-right menu ---------- */
  function topMenu() {
    var m = $('#tmenu'), b = $('#dots'); if (!m.hidden) { m.hidden = true; return; }
    var it = function (ic, label, a, cls) { return '<button class="ti' + (cls ? ' ' + cls : '') + '" data-a="' + a + '">' + IC[ic] + '<span>' + label + '</span></button>'; };
    m.innerHTML = '<div class="tu"><div class="av">' + esc(S.user.name.charAt(0).toUpperCase()) + '</div><div><b>' + esc(S.user.name) + '</b><small>' + esc(S.user.email) + '</small></div></div>' +
      it('home2', 'Home', 'home') + it('chat', 'New chat', 'new') + it('gift', 'Referrals', 'referrals') + it('set', 'Settings', 'settings') + '<div class="sep"></div>' + it('out', 'Sign out', 'out', 'red');
    m.hidden = false; var r = b.getBoundingClientRect(); m.style.top = (r.bottom + 6) + 'px'; m.style.right = Math.max(10, innerWidth - r.right) + 'px'; m.style.left = 'auto'; m.style.bottom = 'auto';
    m.onclick = function (e) { var x = e.target.closest('[data-a]'); if (!x) return; m.hidden = true; var a = x.dataset.a; if (a === 'home') location.href = '/'; else if (a === 'out') signOut(); else if (a === 'new') go('chat'); else go(a); };
    setTimeout(function () { document.addEventListener('pointerdown', function h(e) { if (!m.contains(e.target) && !b.contains(e.target)) { m.hidden = true; } if (m.hidden || !m.contains(e.target)) document.removeEventListener('pointerdown', h); }); }, 0);
  }
  $('#dots').onclick = topMenu;

  /* ---------- live status chip ---------- */
  function ping() {
    var c = $('#live'); if (!c) return; var t0 = performance.now();
    fetch('/api/health', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; var ms = Math.round(performance.now() - t0); c.className = 'live'; c.lastChild.textContent = 'Live · ' + ms + ' ms'; })
      .catch(function () { c.className = 'live off'; c.lastChild.textContent = navigator.onLine ? 'Server down' : 'Offline'; });
  }
  setInterval(function () { if (!document.hidden) ping(); }, 20000); addEventListener('online', ping); addEventListener('offline', ping); document.addEventListener('visibilitychange', function () { if (!document.hidden) ping(); });

  /* ---------- boot ---------- */
  $('#mb').onclick = function () { navOpen(!shell.classList.contains('nav-open')); };
  $('#scrim').onclick = function () { navOpen(false); };
  $('#nc').onclick = function () { go('chat'); var t = $('#ta'); if (t) t.focus(); };
  addEventListener('keydown', function (e) { if (e.key === 'Escape') { navOpen(false); $('#pop').hidden = true; $('#tmenu').hidden = true; $('#sheet').hidden = true; } });
  (async function () {
    try { S.user = (await api('GET', '/api/auth/me')).user; } catch (e) { S.user = null; }
    if (!S.user) return location.replace('/login'); if (!S.user.emailVerified) return location.replace('/verify-email');
    try { var cfg = await api('GET', '/api/public/config'); S.models = cfg.models || []; } catch (e) {}
    if (S.model && S.models.length && !S.models.some(function (m) { return m.id === S.model; })) S.model = '';
    if (innerWidth >= 960) navOpen(true);
    loadBal(); await loadConvs();
    var h = location.hash.slice(1); go(['chat', 'templates', 'dashboard', 'plan', 'referrals', 'team', 'settings'].indexOf(h) > -1 ? h : 'chat', true);
    ping(); var b = $('#boot'), wait = Math.max(0, 1300 - (performance.now() || 0)); setTimeout(function () { b.classList.add('x'); setTimeout(function () { b.remove(); }, 380); }, wait);
  })();
})();
