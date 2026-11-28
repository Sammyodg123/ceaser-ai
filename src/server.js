require('./env');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path'), fs = require('fs');
const { cfg, PLANS, db, HttpError, wrap, balanceOf, freeHours } = require('./core');
const auth = require('./auth');
const chat = require('./chat');
const billing = require('./billing');
const models = require('./models');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: { 'img-src': ["'self'", 'data:', 'blob:'], 'upgrade-insecure-requests': cfg.prod ? [] : null } } }));
app.use(cookieParser());
require('./guard')(app); // anti-clone guard
app.post('/api/billing/webhook/flutterwave', express.json(), billing.flwWebhook);
app.post('/api/billing/webhook/stripe', express.raw({ type: '*/*', limit: '1mb' }), billing.stripeWebhook); // Stripe signs the raw body, so it is read before express.json // Flutterwave tells us when money arrived (no CSRF cookie, checked by secret hash)
app.use(express.json({ limit: '20mb' })); // raised so image/vision attachments (base64) fit
app.use(auth.loadUser);

// CSRF: every state-changing request must carry the x-csrf-token header matching the cookie, and come from our own origin
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && cfg.prod) {
    const o = origin.replace(/\/$/, '');
    let oHost = ''; try { oHost = new URL(o).host; } catch {}
    const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim().replace(/\/$/, '')).filter(Boolean);
    const ok = o === cfg.url || oHost === req.get('host') || extra.includes(o);
    if (!ok) return next(new HttpError(403, 'bad_origin', 'Bad origin.'));
  }
  if (!req.cookies.cc_csrf || req.headers['x-csrf-token'] !== req.cookies.cc_csrf) return next(new HttpError(403, 'csrf', 'Security token missing. Refresh the page.'));
  next();
});

app.get('/api/public/config', (req, res) => res.json({
  app: { name: cfg.name, email: cfg.email, creator: cfg.creator, url: cfg.url },
  auth: { google: false },
  payments: { methods: billing.methods().map((k) => ({ id: k, label: billing.LABELS[k] })), flutterwave: billing.methods().includes('flutterwave'), paypal: billing.methods().includes('paypal'), stripe: billing.methods().includes('stripe') },
  voice: { transcription: false },
  plans: PLANS.map((p) => (p.id === 'free' ? Object.assign({}, p, { resetHours: freeHours() }) : p)),
  models: models.pub(),
}));
app.get('/api/public/models', (req, res) => { res.set('Cache-Control', 'no-store'); res.json({ models: models.pub(), detected: models.detected(), categories: [{ id: 'censored', label: 'Censored', desc: 'Careful, polished answers' }, { id: 'uncensored', label: 'Uncensored', desc: 'Blunt, direct answers (same safety rules)' }] }); });
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/tokens', auth.requireUser, (req, res) => res.json({ balance: balanceOf(req.user) }));
app.use('/api/auth', auth.router);
app.use('/api/chat', auth.requireVerified, chat);
app.use('/api/billing', billing.router);
app.use('/api/admin', auth.requireUser, require('./admin'));

// Not built yet: projects, files, teams, API keys. Lists return empty so the UI does not crash.
app.use(['/api/projects', '/api/files', '/api/teams', '/api/v1'], auth.requireUser, (req, res) => {
  if (req.method === 'GET') return res.json({ projects: [], files: [], teams: [], invitations: [], items: [] });
  throw new HttpError(501, 'not_implemented', 'This feature is not available yet.');
});
app.use('/api', (req, res, next) => next(new HttpError(404, 'not_found', 'Unknown endpoint.')));

// Serve the website itself from the same server (same origin = cookies + CSRF just work)
app.use(express.static(cfg.frontend, { index: 'index.html', maxAge: '1h', setHeaders: (res, file) => { if (/\.html$/i.test(file)) res.setHeader('Cache-Control', 'no-store, must-revalidate'); } }));
app.get('*', (req, res) => fs.existsSync(path.join(cfg.frontend, 'index.html')) ? res.sendFile(path.join(cfg.frontend, 'index.html')) : res.status(404).send('Frontend not found. Check FRONTEND_DIR.'));

app.use((err, req, res, next) => {
  if (!(err instanceof HttpError)) console.error(err);
  const e = err instanceof HttpError ? err : new HttpError(500, 'server_error', 'Something went wrong.');
  if (res.headersSent) return res.end();
  res.status(e.status).json({ error: { code: e.code, message: e.message, details: e.details } });
});
app.listen(cfg.port, () => { console.log(`${cfg.name} running on :${cfg.port}`); models.warm().then(() => console.log('[models] engines found: ' + models.detected().map((d) => d.label).join(', '))).catch(() => {}); });
