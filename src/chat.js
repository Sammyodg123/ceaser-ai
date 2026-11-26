const router = require('express').Router();
const { cfg, db, HttpError, wrap, id, now, balanceOf, spend } = require('./core');

const SYSTEM = `You are ${cfg.name}, a precise, friendly AI assistant for conversation, coding and building projects. Be concise and correct. Use Markdown and fenced code blocks.`;
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

// ---- streaming reply (Server-Sent Events: start / delta / done / error) ----
async function streamReply(req, res, conv) {
  const bal = balanceOf(req.user);
  if (bal.remaining <= 0) throw new HttpError(402, 'insufficient_tokens', 'You are out of tokens. Upgrade your plan.');
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, 'ai_not_configured', 'AI provider key is not set on the server.');
  const history = db.prepare('SELECT role,content FROM messages WHERE conversation_id=? AND status IN (\'complete\',\'stopped\') AND content<>\'\' ORDER BY seq').all(conv.id)
    .map((m) => ({ role: m.role, content: m.content })).slice(-40);
  const model = process.env.AI_MODEL || 'claude-sonnet-4-5';
  const a = addMsg(conv.id, 'assistant', '', 'streaming');
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform', connection: 'keep-alive', 'x-accel-buffering': 'no' });
  const send = (ev, data) => res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
  send('start', { messageId: a.id });
  const ac = new AbortController(); res.on('close', () => ac.abort());
  let text = '', tin = 0, tout = 0, status = 'complete';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ac.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 4096, stream: true, system: SYSTEM, messages: history }) });
    if (!r.ok) throw Object.assign(new Error(`provider ${r.status}`), { provider: true });
    const dec = new TextDecoder(); let buf = '';
    for await (const chunk of r.body) {
      buf += dec.decode(chunk, { stream: true });
      let i; while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = block.split('\n').find((l) => l.startsWith('data: ')); if (!line) continue;
        const d = JSON.parse(line.slice(6));
        if (d.type === 'message_start') tin = d.message.usage?.input_tokens || 0;
        else if (d.type === 'content_block_delta' && d.delta?.text) { text += d.delta.text; send('delta', { text: d.delta.text }); }
        else if (d.type === 'message_delta') tout = d.usage?.output_tokens || tout;
      }
    }
  } catch (e) {
    if (ac.signal.aborted) status = 'stopped';
    else { status = 'error'; console.error('AI error:', e.message); send('error', { code: 'provider_error', message: 'The AI service failed. Try again.' }); }
  }
  db.prepare('UPDATE messages SET content=?, status=?, model=?, tokens_in=?, tokens_out=? WHERE id=?').run(text, status, model, tin, tout, a.id);
  db.prepare('UPDATE conversations SET last_message_at=? WHERE id=?').run(now(), conv.id);
  spend(req.user.id, tin + tout);
  if (status === 'complete') send('done', { usage: { inputTokens: tin, outputTokens: tout }, model, balance: balanceOf(req.user) });
  res.end();
}
router.post('/conversations/:id/messages', wrap(async (req, res) => {
  const conv = own(req, req.params.id), content = String(req.body.content || '').trim();
  if (!content) throw new HttpError(400, 'invalid_input', 'Message is empty.');
  if (content.length > 20000) throw new HttpError(400, 'too_long', 'Message too long.');
  if (balanceOf(req.user).remaining <= 0) throw new HttpError(402, 'insufficient_tokens', 'You are out of tokens. Upgrade your plan.');
  addMsg(conv.id, 'user', content);
  if (conv.title === 'New conversation') db.prepare('UPDATE conversations SET title=? WHERE id=?').run(content.slice(0, 60), conv.id);
  await streamReply(req, res, conv);
}));
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
