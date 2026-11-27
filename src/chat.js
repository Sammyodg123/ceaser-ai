const router = require('express').Router();
const models = require('./models');
const { cfg, db, HttpError, wrap, id, now, balanceOf, spend } = require('./core');

const SYSTEM = `You are ${cfg.name}, a precise, friendly AI assistant for conversation, coding and building projects. Be concise and correct. Use Markdown. Whenever you write a script, program, config or any code, put it in a fenced code block with the language name, and keep prose around it short.`;
const BUILD_RULE = `\n\nWhen asked for a website, landing page, app UI or game: reply with ONE complete, self-contained file in a single fenced block labelled like \`\`\`html:index.html (inline CSS and JS, no build step, mobile-first and responsive, modern clean design, system fonts or Google Fonts only, no placeholder images that need a network except via CSS gradients/SVG). Keep animations light so the page stays smooth on phones. Do not use localStorage. Write at most two short sentences before the code and two after.`;
const msgDTO = (m) => ({ id: m.id, role: m.role, content: m.content, status: m.status, model: m.model, attachments: [], feedback: m.feedback,
  usage: { inputTokens: m.tokens_in, outputTokens: m.tokens_out }, createdAt: m.created_at });
const convDTO = (c) => ({ id: c.id, title: c.title, pinned: !!c.pinned, lastMessageAt: c.last_message_at || c.created_at, createdAt: c.created_at });
function own(req, cid) {
  const c = db.prepare('SELECT * FROM conversations WHERE id=? AND user_id=?').get(cid, req.user.id);
  if (!c) throw new HttpError(404, 'not_found', 'Conversation not found.');
  return c;
}
const nextSeq = (cid) => (db.prepare('SELECT COALESCE(MAX(seq),0)+1 n FROM messages WHERE conversation_id=?').get(cid).n);
const addMsg = (cid, role, content, status = 'complete') => {
  const m = { id: id(), seq: nextSeq(cid) };
  db.prepare('INSERT INTO messages(id,conversation_id,role,content,status,seq) VALUES(?,?,?,?,?,?)').run(m.id, cid, role, content, status, m.seq);
  return m;
};

// ---- sandboxed HTML previews (served with a sandbox CSP so generated pages cannot touch the app's cookies) ----
const previews = new Map();
router.post('/preview', (req, res) => {
  const html = String((req.body && req.body.html) || '');
  if (!html || html.length > 400000) throw new HttpError(400, 'invalid_input', 'Preview is empty or too large.');
  const pid = id(); previews.set(pid, { html, uid: req.user.id, t: Date.now() });
  for (const [k, v] of previews) if (Date.now() - v.t > 3600000 || previews.size > 300) previews.delete(k);
  res.json({ id: pid });
});
router.get('/preview/:pid', (req, res) => {
  const p = previews.get(req.params.pid);
  if (!p || p.uid !== req.user.id) return res.status(404).send('Preview expired. Reload the chat.');
  // The preview runs in an opaque origin, so localStorage/sessionStorage throw and kill the page's scripts (blank page). Give it in-memory stand-ins.
  const shim = '<meta name="viewport" content="width=device-width,initial-scale=1"><script>(function(){function M(){var d={};return{getItem:function(k){return k in d?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}["localStorage","sessionStorage"].forEach(function(n){try{window[n].getItem("x")}catch(e){try{Object.defineProperty(window,n,{value:M(),configurable:true})}catch(_){}}})})();</script>';
  let html = p.html;
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + shim) : /<html[^>]*>/i.test(html) ? html.replace(/<html[^>]*>/i, (m) => m + '<head>' + shim + '</head>') : shim + html;
  res.removeHeader('X-Frame-Options');
  res.set({ 'Content-Security-Policy': "sandbox allow-scripts allow-forms allow-popups allow-modals; frame-ancestors 'self'", 'Cross-Origin-Resource-Policy': 'same-origin', 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }).send(html);
});
router.get('/conversations', (req, res) => {
  const limit = Math.min(+req.query.limit || 50, 200);
  res.json({ conversations: db.prepare('SELECT * FROM conversations WHERE user_id=? ORDER BY pinned DESC, COALESCE(last_message_at,created_at) DESC LIMIT ?').all(req.user.id, limit).map(convDTO) });
});
router.post('/conversations', (req, res) => {
  const cid = id(); db.prepare('INSERT INTO conversations(id,user_id,last_message_at) VALUES(?,?,?)').run(cid, req.user.id, now());
  res.json({ conversation: convDTO(db.prepare('SELECT * FROM conversations WHERE id=?').get(cid)) });
});
router.get('/search', (req, res) => {
  const q = `%${String(req.query.q || '').replace(/[%_]/g, '')}%`;
  const rows = db.prepare(`SELECT DISTINCT c.* FROM conversations c LEFT JOIN messages m ON m.conversation_id=c.id
    WHERE c.user_id=? AND (c.title LIKE ? OR m.content LIKE ?) ORDER BY c.last_message_at DESC LIMIT 30`).all(req.user.id, q, q);
  res.json({ conversations: rows.map(convDTO), results: rows.map(convDTO) });
});
router.get('/conversations/:id', (req, res) => {
  const c = own(req, req.params.id);
  res.json({ conversation: convDTO(c), messages: db.prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY seq').all(c.id).map(msgDTO) });
});
router.patch('/conversations/:id', (req, res) => {
  const c = own(req, req.params.id);
  db.prepare('UPDATE conversations SET title=? WHERE id=?').run(String(req.body.title ?? c.title).slice(0, 120), c.id);
  res.json({ conversation: convDTO(db.prepare('SELECT * FROM conversations WHERE id=?').get(c.id)) });
});
router.post('/conversations/:id/pin', (req, res) => {
  const c = own(req, req.params.id);
  db.prepare('UPDATE conversations SET pinned=? WHERE id=?').run(req.body.pinned === undefined ? (c.pinned ? 0 : 1) : (req.body.pinned ? 1 : 0), c.id);
  res.json({ conversation: convDTO(db.prepare('SELECT * FROM conversations WHERE id=?').get(c.id)) });
});
router.delete('/conversations/:id', (req, res) => { const c = own(req, req.params.id); db.prepare('DELETE FROM conversations WHERE id=?').run(c.id); res.json({ ok: true }); });
router.post('/messages/:id/feedback', (req, res) => {
  const m = db.prepare('SELECT m.id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id=? AND c.user_id=?').get(req.params.id, req.user.id);
  if (!m) throw new HttpError(404, 'not_found', 'Message not found.');
  db.prepare('UPDATE messages SET feedback=? WHERE id=?').run(req.body.value ?? req.body.feedback ?? null, m.id); res.json({ ok: true });
});


// ---- Manus agent provider (async tasks, polled and streamed to the browser) ----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FILE_RULE = 'Formatting rules for this chat: whenever you create or change a file, script or web page, put the COMPLETE contents in a fenced code block whose info string is the language and the filename, like ```js:Telegram.js or ```html:index.html. Never answer with only a sandbox path such as /home/ubuntu/file; the user cannot open your sandbox, so always paste the full file in the reply. Keep any prose short.';
const SANDBOX_LINK = /\]\((?:file:\/\/)?\/(?:home|workspace|tmp|mnt)\/[^)]+\)/;
async function manusReply(conv, history, ac, send, step) {
  const base = (process.env.MANUS_API_URL || 'https://api.manus.ai').replace(/\/$/, '');
  const H = { 'content-type': 'application/json', 'x-manus-api-key': process.env.MANUS_API_KEY };
  const call = async (path, body) => {
    const r = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: H, signal: ac.signal, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error('manus ' + r.status + ' ' + JSON.stringify(j.error || j).slice(0, 300));
    return j;
  };
  let taskId = db.prepare('SELECT manus_task FROM conversations WHERE id=?').get(conv.id).manus_task;
  const list = () => call('/v2/task.listMessages?task_id=' + taskId + '&order=asc&limit=100');
  const seen = new Set(), last = splitImages(history[history.length - 1].content).text || 'Please help with the attached image.';
  history = history.map((m) => ({ role: m.role, content: splitImages(m.content).text }));
  if (taskId) {
    ((await list()).messages || []).forEach((m) => seen.add(m.id));
    await call('/v2/task.sendMessage', { task_id: taskId, message: { content: FILE_RULE + '\n\n' + last } });
  } else {
    const body = history.length > 1 ? history.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n') : last;
    const j = await call('/v2/task.create', { message: { content: FILE_RULE + '\n\n' + body }, interactive_mode: false, hide_in_task_list: true, agent_profile: process.env.MANUS_PROFILE || 'standard' });
    taskId = j.task_id;
    db.prepare('UPDATE conversations SET manus_task=? WHERE id=?').run(taskId, conv.id);
  }
  step('Build agent started');
  let text = '', lastStatus = '';
  const add = (t) => { t = (text ? '\n\n' : '') + t; text += t; send('delta', { text: t }); };
  // Poll until the agent is done. Only trust "stopped/waiting" after we have seen it running (or some time passed).
  async function round(maxMs) {
    let sawRun = false, sawNew = false;
    for (const t0 = Date.now(); Date.now() - t0 < maxMs;) {
      await sleep(2000); if (ac.signal.aborted) return;
      let status = null;
      for (const m of (await list()).messages || []) {
        const fresh = !seen.has(m.id); if (fresh) { seen.add(m.id); sawNew = true; }
        if (m.type === 'status_update') { status = m.status_update?.agent_status; if (status && status !== lastStatus) { lastStatus = status; send('thinking', { text: 'Agent is ' + status + '…\n' }); } }
        else if (fresh && m.type === 'assistant_message') {
          const am = m.assistant_message || {};
          if (am.content) add(am.content);
          const atts = am.attachments || am.files || [];
          atts.forEach((f) => { const u = f.url || f.download_url || f.file_url; if (u) add(`[${f.filename || f.name || 'download'}](${u})`); });
          if (!am.content && !atts.length) console.log('[manus] assistant_message keys:', Object.keys(am).join(','));
        } else if (fresh && m.type === 'error_message') throw new Error('manus task error: ' + (m.error_message?.content || ''));
        else if (fresh && m.type !== 'user_message') { console.log('[manus] message type:', m.type, Object.keys(m).join(',')); step('Working: ' + String(m.type).replace(/_/g, ' ')); }
      }
      if (status === 'running') sawRun = true;
      if (sawNew && status === 'error') throw new Error('manus task failed');
      if ((status === 'stopped' || status === 'waiting') && (sawRun || Date.now() - t0 > 20000)) return;
    }
  }
  await round(420000);
  // Manus often answers "[Download file](/home/ubuntu/x.js)": a path inside ITS sandbox. Ask it to paste the file instead.
  if (!ac.signal.aborted && SANDBOX_LINK.test(text)) {
    await call('/v2/task.sendMessage', { task_id: taskId, message: { content: 'I cannot open sandbox paths. Paste the COMPLETE contents of every file you created or changed as fenced code blocks labelled with the filename, e.g. ```js:Telegram.js. No other text needed.' } });
    send('delta', { text: '\n\n' });
    await round(300000);
  }
  if (!text && !ac.signal.aborted) add('The agent finished without a text reply.');
  return { text, tin: Math.ceil(last.length / 4), tout: Math.ceil(text.length / 4) };
}

// ---- image attachments: data URLs are embedded in message content between markers (no DB schema change needed) ----
const IMG_RE = /\n*<<<IMAGE ([^\n>]*)>>>\n([\s\S]*?)\n<<<ENDIMAGE>>>/g;
function splitImages(t) {
  const imgs = []; const text = String(t || '').replace(IMG_RE, (_, name, dataUrl) => { imgs.push({ name, dataUrl }); return ''; }).trim();
  return { text, imgs };
}
// Turn one history row's raw content into the shape the provider expects (plain string, or multimodal parts for rows that carry images).
function toOpenAIContent(raw) {
  const { text, imgs } = splitImages(raw);
  if (!imgs.length) return text;
  const parts = []; if (text) parts.push({ type: 'text', text });
  imgs.forEach((im) => parts.push({ type: 'image_url', image_url: { url: im.dataUrl } }));
  return parts;
}
function toAnthropicContent(raw) {
  const { text, imgs } = splitImages(raw);
  if (!imgs.length) return text;
  const parts = imgs.map((im) => { const m = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i.exec(im.dataUrl) || []; return { type: 'image', source: { type: 'base64', media_type: m[1] || 'image/png', data: m[2] || '' } }; });
  if (text) parts.push({ type: 'text', text });
  return parts;
}

// ---- streaming reply (Server-Sent Events: start / step / thinking / delta / done / error) ----
// Smart routing: models.plan() gives an ordered chain of providers. If one fails before writing anything, the next one answers.
async function streamReply(req, res, conv) {
  const bal = balanceOf(req.user);
  if (bal.remaining <= 0) throw new HttpError(402, 'insufficient_tokens', 'You are out of tokens. Upgrade your plan.');
  const history = db.prepare('SELECT role,content FROM messages WHERE conversation_id=? AND status IN (\'complete\',\'stopped\') AND content<>\'\' ORDER BY seq').all(conv.id)
    .map((m) => ({ role: m.role, content: m.content })).slice(-40);
  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  const lastRaw = lastUser ? lastUser.content : '';
  const hasImage = /<<<IMAGE /.test(lastRaw);
  const pl = models.plan(req.body && req.body.model, splitImages(lastRaw).text, hasImage);
  if (!pl) throw new HttpError(503, 'ai_not_configured', 'No AI provider key is set on the server. Add one to .env.');
  const a = addMsg(conv.id, 'assistant', '', 'streaming');
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
  const send = (ev, data) => { if (!res.writableEnded) res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`); };
  const step = (t) => send('step', { text: t });
  send('start', { messageId: a.id, kind: pl.kind });
  const ac = new AbortController(); res.on('close', () => ac.abort());
  let text = '', tin = 0, tout = 0, status = 'complete', usedModel = '', usedCost = 1;
  const SYS = SYSTEM + (pl.kind === 'build' ? BUILD_RULE : '');
  const emit = (t) => { if (!text) step(pl.kind === 'build' ? 'Writing code' : pl.kind === 'code' ? 'Writing the answer' : 'Writing the answer'); text += t; send('delta', { text: t }); };

  async function viaOpenAI(P, prov, model) {
    const base = P.base().replace(/\/$/, ''); if (!base) throw new Error('missing base url for ' + prov);
    const msgs = history.map((m) => ({ role: m.role, content: toOpenAIContent(m.content) }));
    const r = await fetch(base + '/chat/completions', { method: 'POST', signal: ac.signal,
      headers: Object.assign({ 'content-type': 'application/json' }, P.noauth ? {} : { authorization: 'Bearer ' + process.env[P.key] }),
      body: JSON.stringify({ model, stream: true, ...(P.free ? {} : { stream_options: { include_usage: true } }), messages: [{ role: 'system', content: SYS }, ...msgs] }) });
    if (!r.ok) throw new Error(`provider ${r.status} ${(await r.text()).slice(0, 200)}`);
    const dec = new TextDecoder(); let buf = '';
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let i; while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = block.split('\n').find((l) => l.startsWith('data: ')); if (!line || line.includes('[DONE]')) continue;
        let d; try { d = JSON.parse(line.slice(6)); } catch (e) { continue; }
        const delta = d.choices && d.choices[0] && d.choices[0].delta || {};
        const think = delta.reasoning_content || delta.reasoning;
        if (think) send('thinking', { text: think });
        if (delta.content) emit(delta.content);
        if (d.usage) { tin = d.usage.prompt_tokens || tin; tout = d.usage.completion_tokens || tout; }
      }
    }
    if (!tout) { tin = tin || Math.ceil(history.reduce((n, m) => n + m.content.length, 0) / 4); tout = Math.ceil(text.length / 4); }
  }
  async function viaAnthropic(P, model) {
    const msgs = history.map((m) => ({ role: m.role, content: toAnthropicContent(m.content) }));
    const supportsThinking = !/^claude-3-(haiku|sonnet-20240229)/.test(model);
    const call = (think) => fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ac.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': process.env[P.key], 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: think ? 8192 : 4096, stream: true, system: SYS, messages: msgs, ...(think ? { thinking: { type: 'enabled', budget_tokens: 2048 } } : {}) }) });
    let r = await call(supportsThinking);
    if (!r.ok && supportsThinking && r.status === 400) r = await call(false);
    if (!r.ok) throw new Error(`provider ${r.status}`);
    const dec = new TextDecoder(); let buf = '';
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let i; while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = block.split('\n').find((l) => l.startsWith('data: ')); if (!line) continue;
        let d; try { d = JSON.parse(line.slice(6)); } catch (e) { continue; }
        if (d.type === 'message_start') tin = d.message.usage?.input_tokens || 0;
        else if (d.type === 'content_block_delta' && d.delta?.type === 'thinking_delta') send('thinking', { text: d.delta.thinking || '' });
        else if (d.type === 'content_block_delta' && d.delta?.text) emit(d.delta.text);
        else if (d.type === 'message_delta') tout = d.usage?.output_tokens || tout;
      }
    }
  }

  const kindLabel = { build: 'Build task', code: 'Coding task', chat: 'Chat' }[pl.kind];
  try {
    for (let i = 0; i < pl.chain.length; i++) {
      const c = pl.chain[i], P = models.PROVIDERS[c.provider];
      step(i === 0 ? (pl.auto ? `${kindLabel} → ${c.label}` : `Using ${c.label}`) : `Switching to ${c.label}`);
      usedModel = c.model; usedCost = c.cost || 1;
      try {
        if (P.type === 'manus') { const o = await manusReply(conv, history, ac, send, step); text = o.text; tin = o.tin; tout = o.tout; }
        else if (P.type === 'openai') await viaOpenAI(P, c.provider, c.model);
        else await viaAnthropic(P, c.model);
        break;
      } catch (e) {
        if (ac.signal.aborted) throw e;
        console.error(`AI error (${c.provider}):`, e.message);
        if (text || i === pl.chain.length - 1) throw e; // already wrote something (or nothing left to try)
        send('thinking', { text: `${c.label} was unavailable, trying another engine…\n` });
      }
    }
  } catch (e) {
    if (ac.signal.aborted) status = 'stopped';
    else { status = 'error'; send('error', { code: 'provider_error', message: 'The AI service failed. Try again.' }); }
  }
  db.prepare('UPDATE messages SET content=?, status=?, model=?, tokens_in=?, tokens_out=? WHERE id=?').run(text, status, usedModel, tin, tout, a.id);
  db.prepare('UPDATE conversations SET last_message_at=? WHERE id=?').run(now(), conv.id);
  spend(req.user.id, Math.ceil((tin + tout) * usedCost));
  if (status === 'complete') send('done', { usage: { inputTokens: tin, outputTokens: tout }, model: usedModel, balance: balanceOf(req.user) });
  res.end();
}
router.post('/conversations/:id/messages', wrap(async (req, res) => {
  const conv = own(req, req.params.id);
  let content = String(req.body.content || '').trim();
  const atts = Array.isArray(req.body.attachments) ? req.body.attachments.slice(0, 4) : [];
  atts.forEach((a) => { if (a && a.dataUrl && /^data:image\//.test(a.dataUrl)) content += `\n\n<<<IMAGE ${String(a.name || 'image').replace(/[<>\n]/g, '')}>>>\n${a.dataUrl}\n<<<ENDIMAGE>>>`; });
  if (!content.trim()) throw new HttpError(400, 'invalid_input', 'Message is empty.');
  if (content.length > 400000) throw new HttpError(400, 'too_long', 'Message too long.');
  if (balanceOf(req.user).remaining <= 0) throw new HttpError(402, 'insufficient_tokens', 'You are out of tokens. Upgrade your plan.');
  addMsg(conv.id, 'user', content);
  if (conv.title === 'New conversation') db.prepare('UPDATE conversations SET title=? WHERE id=?').run(splitImages(content).text.slice(0, 60) || 'Image', conv.id);
  await streamReply(req, res, conv);
}));

// ---- AI image generation ----
// Images are generated SERVER-SIDE, saved to disk and served from /api/chat/img/<file>. (The page's security policy only allows same-origin images,
// so hot-linking a third-party image URL never displayed.) Providers are tried in IMAGE_PROVIDERS order (default: custom,together,huggingface,pollinations,openai):
//   custom       IMAGE_API_KEY + IMAGE_BASE_URL (+ IMAGE_MODEL)   any OpenAI-compatible /images/generations endpoint
//   together     TOGETHER_API_KEY   (free model black-forest-labs/FLUX.1-schnell-Free, change with IMAGE_TOGETHER_MODEL)
//   huggingface  HF_TOKEN           (free FLUX.1-schnell, change with IMAGE_HF_MODEL)
//   pollinations no key needed (free)
//   openai       OPENAI_API_KEY     (paid, last resort)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const IMG_DIR = path.resolve(process.env.IMAGE_DIR || path.join(__dirname, '..', 'data', 'images'));
try { fs.mkdirSync(IMG_DIR, { recursive: true }); } catch (e) {}
async function grab(url, opt, ms) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 60000);
  try {
    const r = await fetch(url, Object.assign({ signal: c.signal }, opt));
    const type = (r.headers.get('content-type') || '').toLowerCase();
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`);
    if (type.startsWith('image/')) return { buf: Buffer.from(await r.arrayBuffer()), type };
    const j = await r.json().catch(() => null); return { json: j, type };
  } finally { clearTimeout(t); }
}
const fromJSON = async (j) => {
  const d = j && j.data && j.data[0]; if (!d) throw new Error('no image in response');
  if (d.b64_json) return { buf: Buffer.from(d.b64_json, 'base64'), type: 'image/png' };
  if (d.url) { const g = await grab(d.url, {}, 45000); if (g.buf) return g; }
  throw new Error('empty image response');
};
const IMG_PROVIDERS = {
  custom: { on: () => process.env.IMAGE_API_KEY && process.env.IMAGE_BASE_URL, run: async (p) => fromJSON((await grab(process.env.IMAGE_BASE_URL.replace(/\/$/, '') + '/images/generations', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.IMAGE_API_KEY }, body: JSON.stringify({ model: process.env.IMAGE_MODEL || undefined, prompt: p, n: 1, size: '1024x1024' }) }, 90000)).json) },
  together: { on: () => process.env.TOGETHER_API_KEY, run: async (p) => fromJSON((await grab('https://api.together.xyz/v1/images/generations', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.TOGETHER_API_KEY }, body: JSON.stringify({ model: process.env.IMAGE_TOGETHER_MODEL || 'black-forest-labs/FLUX.1-schnell-Free', prompt: p, width: 1024, height: 1024, steps: 4, n: 1, response_format: 'b64_json' }) }, 60000)).json) },
  huggingface: { on: () => process.env.HF_TOKEN, run: async (p) => { const g = await grab('https://router.huggingface.co/hf-inference/models/' + (process.env.IMAGE_HF_MODEL || 'black-forest-labs/FLUX.1-schnell'), { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.HF_TOKEN, accept: 'image/png' }, body: JSON.stringify({ inputs: p }) }, 90000); if (!g.buf) throw new Error('not an image'); return g; } },
  pollinations: { on: () => String(process.env.IMAGE_FREE || 'on').toLowerCase() !== 'off', run: async (p) => {
    let last; for (const m of ['flux', 'turbo']) {
      try { const g = await grab('https://image.pollinations.ai/prompt/' + encodeURIComponent(p) + '?width=1024&height=1024&nologo=true&private=true&model=' + m + '&seed=' + Math.floor(Math.random() * 1e9), {}, 70000); if (g.buf && g.buf.length > 2000) return g; last = new Error('empty image'); } catch (e) { last = e; }
    } throw last; } },
  openai: { on: () => process.env.OPENAI_API_KEY, run: async (p) => fromJSON((await grab('https://api.openai.com/v1/images/generations', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.OPENAI_API_KEY }, body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1', prompt: p, size: '1024x1024', n: 1 }) }, 120000)).json) },
};
const uhash = (u) => crypto.createHash('sha1').update(String(u)).digest('hex').slice(0, 10);
router.post('/image', wrap(async (req, res) => {
  const prompt = String(req.body.prompt || '').trim().slice(0, 2000);
  if (!prompt) throw new HttpError(400, 'invalid_input', 'Describe the image you want.');
  if (balanceOf(req.user).remaining <= 0) throw new HttpError(402, 'insufficient_tokens', 'You are out of tokens. Upgrade your plan.');
  const conv = req.body.conversationId ? own(req, req.body.conversationId) : null;
  const order = String(process.env.IMAGE_PROVIDERS || 'custom,together,huggingface,pollinations,openai').split(',').map((x) => x.trim().toLowerCase()).filter((x) => IMG_PROVIDERS[x] && IMG_PROVIDERS[x].on());
  let out = null;
  for (const k of order) {
    try { out = await IMG_PROVIDERS[k].run(prompt); if (out && out.buf && out.buf.length > 1000) { out.provider = k; break; } out = null; }
    catch (e) { console.error(`image error (${k}):`, String(e.message).slice(0, 200)); out = null; }
  }
  if (!out) throw new HttpError(502, 'provider_error', 'The image service is busy right now. Try again in a moment.');
  const ext = /jpe?g/.test(out.type) ? 'jpg' : /webp/.test(out.type) ? 'webp' : 'png';
  const file = `${uhash(req.user.id)}_${crypto.randomBytes(9).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(IMG_DIR, file), out.buf);
  const url = '/api/chat/img/' + file;
  if (conv) {
    addMsg(conv.id, 'user', '/image ' + prompt); addMsg(conv.id, 'assistant', `![${prompt.replace(/[\[\]\n]/g, ' ').slice(0, 120)}](${url})`);
    if (conv.title === 'New conversation') db.prepare('UPDATE conversations SET title=? WHERE id=?').run(('Image: ' + prompt).slice(0, 60), conv.id);
    db.prepare('UPDATE conversations SET last_message_at=? WHERE id=?').run(now(), conv.id);
  }
  spend(req.user.id, 200);
  res.json({ url, prompt, provider: out.provider });
}));
router.get('/img/:f', (req, res) => {
  const f = String(req.params.f || '');
  if (!/^[a-f0-9]{10}_[a-f0-9]{18}\.(png|jpg|webp)$/.test(f) || f.slice(0, 10) !== uhash(req.user.id)) return res.status(404).end();
  res.sendFile(path.join(IMG_DIR, f), { maxAge: '7d', headers: { 'Cache-Control': 'private, max-age=604800' } }, (e) => { if (e && !res.headersSent) res.status(404).end(); });
});
function ownMsg(req) {
  const m = db.prepare('SELECT m.* FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE m.id=? AND c.user_id=?').get(req.params.id, req.user.id);
  if (!m) throw new HttpError(404, 'not_found', 'Message not found.'); return m;
}
router.post('/messages/:id/regenerate', wrap(async (req, res) => {
  const m = ownMsg(req); if (m.role !== 'assistant') throw new HttpError(400, 'invalid_input', 'Only assistant messages.');
  db.prepare('DELETE FROM messages WHERE conversation_id=? AND seq>=?').run(m.conversation_id, m.seq);
  await streamReply(req, res, db.prepare('SELECT * FROM conversations WHERE id=?').get(m.conversation_id));
}));
router.post('/messages/:id/edit', wrap(async (req, res) => {
  const m = ownMsg(req); const content = String(req.body.content || '').trim();
  if (m.role !== 'user' || !content) throw new HttpError(400, 'invalid_input', 'Invalid edit.');
  db.prepare('DELETE FROM messages WHERE conversation_id=? AND seq>?').run(m.conversation_id, m.seq);
  db.prepare('UPDATE messages SET content=? WHERE id=?').run(content, m.id);
  await streamReply(req, res, db.prepare('SELECT * FROM conversations WHERE id=?').get(m.conversation_id));
}));
module.exports = router;
