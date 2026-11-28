// Admin panel API: edit API keys / routing / payments from inside the app, test every provider, restart the server.
// Values are saved to <data dir>/settings.json and applied to process.env immediately (no redeploy needed).
// NOTE: on Render's free plan the disk is wiped on redeploy, so keep a copy of important keys in Render's Environment tab too.
const express = require('express'), fs = require('fs'), path = require('path');
const { cfg, HttpError, wrap, isAdminEmail, db, balanceOf } = require('./core');
const models = require('./models');
const billing = require('./billing');
const router = express.Router();
const FILE = path.join(path.dirname(path.resolve(process.env.DB_PATH || './data/app.db')), 'settings.json');

const GROUPS = [
  ['AI engines (API keys)', ['OMEGA_AI', 'GROQ_API_KEY', 'GEMINI_API_KEY', 'NVIDIA_API_KEY', 'VENICE_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'MANUS_API_KEY', 'DEEPSEEK_API_KEY', 'MISTRAL_API_KEY', 'XAI_API_KEY', 'TOGETHER_API_KEY', 'OPENROUTER_API_KEY', 'CEREBRAS_API_KEY', 'FIREWORKS_API_KEY', 'PERPLEXITY_API_KEY', 'LLAMA_API_KEY', 'OLLAMA_BASE_URL', 'CUSTOM_API_KEY']],
  ['Model and endpoint overrides (empty = built-in/default)', ['OMEGA_MODELS', 'GROQ_MODEL', 'GEMINI_MODEL', 'GEMINI_MODELS', 'GEMINI_BASE_URL', 'NVIDIA_MODEL', 'VENICE_MODEL', 'VENICE_MODELS', 'VENICE_BASE_URL', 'OPENAI_MODEL', 'OPENAI_MODELS', 'OPENAI_BASE_URL', 'LLAMA_BASE_URL', 'CUSTOM_MODEL', 'CUSTOM_BASE_URL', 'FREE_MODEL', 'FREE_BASE_URL']],
  ['Routing', ['AUTO_PROVIDER', 'CHAT_PROVIDERS', 'CODE_PROVIDERS', 'WEBSITE_PROVIDERS', 'EXTRA_MODEL_COST', 'FREE_AI']],
  ['Images', ['IMAGE_PROVIDERS', 'HF_TOKEN', 'IMAGE_FREE']],
  ['Payments: which methods buyers can pick (empty = every method that has keys)', ['PAYMENT_METHODS', 'PROMO_CODES']],
  ['Payments: Flutterwave', ['FLW_SECRET_KEY', 'FLW_PUBLIC_KEY', 'FLW_SECRET_HASH', 'FLW_CURRENCY', 'FLW_RATE']],
  ['Payments: PayPal (PAYPAL_MODE = live or sandbox)', ['PAYPAL_CLIENT_ID', 'PAYPAL_SECRET', 'PAYPAL_MODE']],
  ['Payments: Stripe', ['STRIPE_SECRET_KEY', 'STRIPE_PUBLIC_KEY', 'STRIPE_WEBHOOK_SECRET']],
  ['Free plan', ['FREE_RESET_HOURS']],
  ['Email', ['ADMIN_EMAIL', 'BREVO_API_KEY', 'MAIL_FROM']],
];
const ALLOWED = new Set(GROUPS.flatMap((g) => g[1]));
const EXTRA_RE = /^[A-Z][A-Z0-9]{1,24}_(API_KEY|BASE_URL|MODEL|MODELS)$/; // new AIs can be added from the panel without touching code
const allowed = (k) => ALLOWED.has(k) || EXTRA_RE.test(k);
const isSecret = (k) => /KEY|TOKEN|HASH|SECRET|PASS/.test(k);
const mask = (v) => (v.length <= 8 ? '••••' : '••••' + v.slice(-4));
const read = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) { return {}; } };

router.use((req, res, next) => {
  const ok = req.user && (req.user.role === 'admin' || isAdminEmail(req.user.email));
  ok ? next() : next(new HttpError(403, 'forbidden', 'Admins only.'));
});

router.get('/settings', (req, res) => {
  const extra = Object.keys(process.env).filter((k) => EXTRA_RE.test(k) && !ALLOWED.has(k)).sort();
  res.json({ groups: GROUPS.concat(extra.length ? [['Other AIs found in your environment', extra]] : []).map(([title, keys]) => ({ title, fields: keys.map((k) => { const v = String(process.env[k] || ''); return { k, secret: isSecret(k), set: !!v, value: isSecret(k) && v ? mask(v) : v }; }) })) });
});

router.post('/settings', wrap(async (req, res) => {
  const vals = req.body && req.body.values || {}, cur = read();
  Object.keys(vals).forEach((k) => {
    if (!allowed(k)) return;
    let v = String(vals[k] == null ? '' : vals[k]).trim().replace(/^["']|["']$/g, '').trim();
    if (v.startsWith('••••')) return; // unchanged masked value
    if (v === '') { delete cur[k]; delete process.env[k]; } else { cur[k] = v; process.env[k] = v; }
  });
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(cur, null, 2));
  models.reset(); models.syncDynamic();
  await models.warm().catch(() => {}); // live right now: no restart needed
  res.json({ ok: true, models: models.pub(), detected: models.detected() });
}));

// Real test of every engine: lists its models, calls the one the chat would use, and reports the exact HTTP status.
router.post('/test', wrap(async (req, res) => {
  const names = Object.keys(models.PROVIDERS).filter((p) => models.hasKey(p) && (models.PROVIDERS[p].type === 'openai' || p === 'omega'));
  const results = (await Promise.all(names.map(async (p) => {
    if (p === 'omega') {
      const base = (process.env.OMEGA_BASE || 'https://api.omegatech.app').replace(/\/$/, '');
      const routes = { wormgpt: '/api/ai/wormgpt?action=chat&message=Say%20hi&newChat=true&forceNew=true', 'qwen3-coder': '/api/ai/Qwen3-coder?action=chat&message=Say%20hi', llamacoder: '/api/ai/llamacoder?action=create&prompt=Say%20hi&quality=high', qwen: '/api/ai/Qwen?action=chat&message=Say%20hi', chatai: '/api/ai/Chatai?action=chat&message=Say%20hi&model=chatgpt', chatbot: '/api/ai/Chatbot?action=chat&message=Say%20hi&needSearch=false', claude: '/api/ai/Claude?text=Say%20hi' };
      return Promise.all(models.idsOf('omega').map(async (id) => {
        const key = id.toLowerCase(), t0 = Date.now();
        try { const r = await fetch(base + (routes[key] || ''), { signal: AbortSignal.timeout(30000) }); const raw = await r.text(); let j; try { j = JSON.parse(raw); } catch { j = raw; } const ok = r.ok && !(j && j.success === false) && !!(typeof j === 'string' ? j.trim() : j && (j.reply || j.result || j.response || j.answer || j.files || j.message)); return { provider: 'omega', label: id, model: id, ok, status: r.status, ms: Date.now() - t0, note: ok ? 'working' : raw.slice(0, 180) }; } catch (e) { return { provider: 'omega', label: id, model: id, ok: false, status: 0, ms: Date.now() - t0, note: String(e.message).slice(0, 160) }; }
      }));
    }
    const P = models.PROVIDERS[p], base = (P.base() || '').replace(/\/$/, ''), t0 = Date.now();
    const H = Object.assign({ 'content-type': 'application/json' }, P.noauth ? {} : { authorization: 'Bearer ' + models.keyOf(P) }, P.noauth || !P.hdr ? {} : P.hdr(models.keyOf(P)));
    const call = async (model) => { const r = await fetch(base + '/chat/completions', { method: 'POST', signal: AbortSignal.timeout(25000), headers: H, body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: 'user', content: 'Say hi' }] }) }); return { r, body: r.ok ? '' : (await r.text()).slice(0, 200) }; };
    try {
      let model = models.modelFor(p, models.idsOf(p)[0]), x = await call(model), note = '';
      if (!x.r.ok && !P.free && [400, 404, 410].includes(x.r.status)) {
        const nm = await models.discover(p).catch(() => null);
        if (nm && nm !== model) { note = `old model "${model}" is gone, switched to "${nm}"`; model = nm; x = await call(model); }
      }
      return { provider: p, label: P.label, model, ok: x.r.ok, status: x.r.status, ms: Date.now() - t0, note: note || (x.r.ok ? 'working' : x.body) };
    } catch (e) { return { provider: p, label: P.label, ok: false, status: 0, ms: Date.now() - t0, note: String(e.message).slice(0, 160) }; }
  }))).flat();
  results.forEach((r) => { if (r.ok) models.reset && 0; });
  res.json({ results });
}));

// ---- users: see everyone with their remaining points, and give (or take back) points ----
const userRow = (u) => { const b = balanceOf(u); return { id: u.id, name: u.name, email: u.email, plan: u.plan, role: u.role, verified: !!u.email_verified, createdAt: u.created_at, unlimited: !!b.unlimited, remaining: b.unlimited ? null : b.remaining, total: b.unlimited ? null : b.total, bonus: u.bonus }; };
router.get('/users', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 1000').all()
    .filter((u) => !q || String(u.email).toLowerCase().includes(q) || String(u.name || '').toLowerCase().includes(q));
  res.json({ count: rows.length, users: rows.slice(0, 300).map(userRow) });
});
router.post('/users/:id/points', (req, res) => {
  const amount = Math.trunc(Number(req.body.amount));
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100000000) throw new HttpError(400, 'invalid_input', 'Enter a whole number of points (use a minus sign to take points away).');
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!u) throw new HttpError(404, 'not_found', 'User not found.');
  db.prepare('UPDATE users SET bonus=MAX(0, bonus+?) WHERE id=?').run(amount, u.id);
  res.json({ ok: true, user: userRow(db.prepare('SELECT * FROM users WHERE id=?').get(u.id)) });
});
router.post('/payments/test', wrap(async (req, res) => res.json({ results: await billing.testAll() })));
router.post('/restart', (req, res) => { res.json({ ok: true }); setTimeout(() => process.exit(0), 500); }); // the host (Render) starts it again automatically

module.exports = router;
