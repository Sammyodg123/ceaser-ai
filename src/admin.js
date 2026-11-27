// Admin panel API: edit API keys / routing / payments from inside the app, test every provider, restart the server.
// Values are saved to <data dir>/settings.json and applied to process.env immediately (no redeploy needed).
// NOTE: on Render's free plan the disk is wiped on redeploy, so keep a copy of important keys in Render's Environment tab too.
const express = require('express'), fs = require('fs'), path = require('path');
const { cfg, HttpError, wrap, isAdminEmail } = require('./core');
const models = require('./models');
const router = express.Router();
const FILE = path.join(path.dirname(path.resolve(process.env.DB_PATH || './data/app.db')), 'settings.json');

const GROUPS = [
  ['AI engines (API keys)', ['OMEGA_AI', 'GROQ_API_KEY', 'GEMINI_API_KEY', 'NVIDIA_API_KEY', 'VENICE_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'MANUS_API_KEY', 'DEEPSEEK_API_KEY', 'MISTRAL_API_KEY', 'XAI_API_KEY', 'TOGETHER_API_KEY', 'OPENROUTER_API_KEY', 'CEREBRAS_API_KEY', 'FIREWORKS_API_KEY', 'PERPLEXITY_API_KEY', 'LLAMA_API_KEY', 'OLLAMA_BASE_URL', 'CUSTOM_API_KEY']],
  ['Model and endpoint overrides (empty = built-in/default)', ['OMEGA_MODELS', 'GROQ_MODEL', 'GEMINI_MODEL', 'GEMINI_MODELS', 'GEMINI_BASE_URL', 'NVIDIA_MODEL', 'VENICE_MODEL', 'VENICE_MODELS', 'VENICE_BASE_URL', 'OPENAI_MODEL', 'OPENAI_MODELS', 'OPENAI_BASE_URL', 'LLAMA_BASE_URL', 'CUSTOM_MODEL', 'CUSTOM_BASE_URL', 'FREE_MODEL', 'FREE_BASE_URL']],
  ['Routing', ['AUTO_PROVIDER', 'CHAT_PROVIDERS', 'CODE_PROVIDERS', 'WEBSITE_PROVIDERS', 'EXTRA_MODEL_COST', 'FREE_AI']],
  ['Images', ['IMAGE_PROVIDERS', 'HF_TOKEN', 'IMAGE_FREE']],
  ['Payments (Flutterwave)', ['FLW_SECRET_KEY', 'FLW_PUBLIC_KEY', 'FLW_SECRET_HASH', 'FLW_CURRENCY', 'FLW_RATE', 'PROMO_CODES']],
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
  const names = Object.keys(models.PROVIDERS).filter((p) => models.hasKey(p) && models.PROVIDERS[p].type === 'openai');
  const results = await Promise.all(names.map(async (p) => {
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
  }));
  results.forEach((r) => { if (r.ok) models.reset && 0; });
  res.json({ results });
}));

router.post('/restart', (req, res) => { res.json({ ok: true }); setTimeout(() => process.exit(0), 500); }); // the host (Render) starts it again automatically

module.exports = router;
