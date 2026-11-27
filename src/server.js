require('./env');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path'), fs = require('fs');
const { cfg, PLANS, db, HttpError, wrap, balanceOf } = require('./core');
const auth = require('./auth');
const chat = require('./chat');
const billing = require('./billing');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: { 'img-src': ["'self'", 'data:', 'blob:'], 'upgrade-insecure-requests': cfg.prod ? [] : null } } }));
app.use(cookieParser());
app.post('/api/billing/webhook/stripe', express.raw({ type: 'application/json' }), billing.stripeWebhook); // must be BEFORE express.json
app.use(express.json({ limit: '2mb' }));
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
  payments: { stripe: cfg.stripe, paypal: cfg.paypal },
  voice: { transcription: false },
  plans: PLANS,
  models: require('./models').MODELS,
}));
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/tokens', auth.requireUser, (req, res) => res.json({ balance: balanceOf(req.user) }));
app.use('/api/auth', auth.router);
app.use('/api/chat', auth.requireVerified, chat);
app.use('/api/billing', billing.router);

// Not built yet: projects, files, teams, API keys. Lists return empty so the UI does not crash.
app.use(['/api/projects', '/api/files', '/api/teams', '/api/v1'], auth.requireUser, (req, res) => {
  if (req.method === 'GET') return res.json({ projects: [], files: [], teams: [], invitations: [], items: [] });
  throw new HttpError(501, 'not_implemented', 'This feature is not available yet.');
});
app.use('/api', (req, res, next) => next(new HttpError(404, 'not_found', 'Unknown endpoint.')));

// Serve the website itself from the same server (same origin = cookies + CSRF just work)
app.get('/chat', (req, res) => res.sendFile(path.join(cfg.frontend, 'chat.html')));
app.use(express.static(cfg.frontend, { index: 'index.html', maxAge: '1h' }));
app.get('*', (req, res) => fs.existsSync(path.join(cfg.frontend, 'index.html')) ? res.sendFile(path.join(cfg.frontend, 'index.html')) : res.status(404).send('Frontend not found. Check FRONTEND_DIR.'));

app.use((err, req, res, next) => {
  if (!(err instanceof HttpError)) console.error(err);
  const e = err instanceof HttpError ? err : new HttpError(500, 'server_error', 'Something went wrong.');
  if (res.headersSent) return res.end();
  res.status(e.status).json({ error: { code: e.code, message: e.message, details: e.details } });
});
app.listen(cfg.port, () => console.log(`${cfg.name} running on :${cfg.port}`));
