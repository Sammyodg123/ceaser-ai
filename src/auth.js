const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { cfg, db, HttpError, wrap, id, sha, rand, now, inDays, inMins, sendMail, userDTO } = require('./core');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: { code: 'rate_limited', message: 'Too many attempts, try later.' } }) });
const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: cfg.prod, path: '/' };
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function startSession(res, userId) {
  const token = rand(32);
  db.prepare('INSERT INTO sessions(hash,user_id,expires) VALUES(?,?,?)').run(sha(token), userId, inDays(30));
  res.cookie('cc_session', token, { ...cookieOpts, maxAge: 30 * 864e5 });
}
// middleware: attaches req.user (or null)
function loadUser(req, res, next) {
  const t = req.cookies.cc_session; req.user = null;
  if (t) {
    const s = db.prepare('SELECT * FROM sessions WHERE hash=? AND expires>?').get(sha(t), now());
    if (s) req.user = db.prepare('SELECT * FROM users WHERE id=?').get(s.user_id) || null;
  }
  next();
}
const requireUser = (req, res, next) => req.user ? next() : next(new HttpError(401, 'unauthorized', 'Please log in.'));
const requireVerified = (req, res, next) => !req.user ? next(new HttpError(401, 'unauthorized', 'Please log in.'))
  : req.user.email_verified ? next() : next(new HttpError(403, 'email_not_verified', 'Verify your email first.'));
const requireAdmin = (req, res, next) => req.user?.role === 'admin' ? next() : next(new HttpError(403, 'forbidden', 'Admins only.'));

async function sendVerification(u) {
  const code = String(Math.floor(100000 + Math.random() * 900000)), token = rand(24);
  db.prepare("DELETE FROM otp WHERE user_id=? AND kind='verify'").run(u.id);
  db.prepare('INSERT INTO otp VALUES(?,?,?,?)').run(sha(code), u.id, 'verify', inMins(30));
  db.prepare('INSERT INTO otp VALUES(?,?,?,?)').run(sha(token), u.id, 'verify', inMins(30));
  await sendMail(u.email, `${cfg.name} — verify your email`,
    `<p>Hi ${u.name},</p><p>Your verification code: <b style="font-size:22px">${code}</b></p>
     <p>Or click: <a href="${cfg.url}/verify-email?token=${token}">verify my email</a></p><p>Expires in 30 minutes.</p>`);
}
function markVerified(userId) {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  if (u.email_verified) return u;
  db.prepare('UPDATE users SET email_verified=1 WHERE id=?').run(userId);
  db.prepare("DELETE FROM otp WHERE user_id=? AND kind='verify'").run(userId);
  if (u.referred_by) { // +50k bonus tokens for every 5 verified friends
    const n = db.prepare('SELECT COUNT(*) c FROM users WHERE referred_by=? AND email_verified=1').get(u.referred_by).c;
    if (n % 5 === 0) db.prepare('UPDATE users SET bonus=bonus+50000 WHERE id=?').run(u.referred_by);
  }
  return db.prepare('SELECT * FROM users WHERE id=?').get(userId);
}

router.get('/csrf', (req, res) => { // double-submit CSRF: readable cookie, echoed in x-csrf-token header
  const t = rand(16);
  res.cookie('cc_csrf', t, { httpOnly: false, sameSite: 'lax', secure: cfg.prod, path: '/' });
  res.json({ ok: true });
});
router.get('/me', (req, res) => res.json({ user: req.user ? userDTO(req.user) : null }));

router.post('/signup', limiter, wrap(async (req, res) => {
  const { name, email, password, website, locale, ref } = req.body;
  if (website) return res.json({ user: null }); // honeypot: bots fill this
  if (!name?.trim() || !emailRe.test(email || '')) throw new HttpError(400, 'invalid_input', 'Name and valid email required.');
  if (!password || password.length < 8) throw new HttpError(400, 'weak_password', 'Password must be at least 8 characters.');
  const mail = email.trim().toLowerCase();
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(mail)) throw new HttpError(409, 'email_taken', 'This email is already registered.');
  const referrer = ref ? db.prepare('SELECT id FROM users WHERE ref_code=?').get(String(ref)) : null;
  const uid = id();
  db.prepare('INSERT INTO users(id,name,email,pass,role,locale,ref_code,referred_by,period_end) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(uid, name.trim().slice(0, 80), mail, await bcrypt.hash(password, 12), mail === cfg.adminEmail ? 'admin' : 'user',
      locale === 'fr' ? 'fr' : 'en', rand(4), referrer?.id || null, inDays(30));
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(uid);
  startSession(res, uid);
  sendVerification(u).catch((e) => console.error('mail error', e.message));
  res.json({ user: userDTO(u) });
}));

router.post('/login', limiter, wrap(async (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body.email || '').trim().toLowerCase());
  if (!u || !u.pass || !(await bcrypt.compare(req.body.password || '', u.pass))) throw new HttpError(401, 'invalid_credentials', 'Wrong email or password.');
  startSession(res, u.id);
  res.json({ user: userDTO(u) });
}));
router.post('/logout', (req, res) => {
  if (req.cookies.cc_session) db.prepare('DELETE FROM sessions WHERE hash=?').run(sha(req.cookies.cc_session));
  res.clearCookie('cc_session', cookieOpts); res.json({ ok: true });
});

router.post('/verify-email', limiter, wrap(async (req, res) => {
  const { token, code } = req.body, secret = token || code;
  if (!secret) throw new HttpError(400, 'invalid_input', 'Code required.');
  let row = db.prepare("SELECT * FROM otp WHERE hash=? AND kind='verify' AND expires>?").get(sha(String(secret)), now());
  if (!row || (code && req.user && row.user_id !== req.user.id)) throw new HttpError(400, 'invalid_code', 'Invalid or expired code.');
  const u = markVerified(row.user_id);
  res.json({ user: userDTO(u) });
}));
router.post('/resend-verification', limiter, requireUser, wrap(async (req, res) => {
  if (!req.user.email_verified) await sendVerification(req.user);
  res.json({ ok: true });
}));

router.post('/forgot-password', limiter, wrap(async (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body.email || '').trim().toLowerCase());
  if (u) {
    const token = rand(24);
    db.prepare('INSERT INTO otp VALUES(?,?,?,?)').run(sha(token), u.id, 'reset', inMins(30));
    await sendMail(u.email, `${cfg.name} — reset your password`, `<p>Reset link (30 min): <a href="${cfg.url}/reset-password?token=${token}">reset password</a></p><p>Ignore this if it wasn't you.</p>`);
  }
  res.json({ ok: true }); // same answer either way: don't reveal which emails exist
}));
router.post('/reset-password', limiter, wrap(async (req, res) => {
  const { token, password } = req.body;
  if (!password || password.length < 8) throw new HttpError(400, 'weak_password', 'Password must be at least 8 characters.');
  const row = db.prepare("SELECT * FROM otp WHERE hash=? AND kind='reset' AND expires>?").get(sha(String(token || '')), now());
  if (!row) throw new HttpError(400, 'invalid_code', 'Invalid or expired link.');
  db.prepare('UPDATE users SET pass=? WHERE id=?').run(await bcrypt.hash(password, 12), row.user_id);
  db.prepare('DELETE FROM otp WHERE user_id=?').run(row.user_id);
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(row.user_id);
  res.json({ ok: true });
}));

router.patch('/profile', requireUser, wrap(async (req, res) => {
  const { name, locale, preferences } = req.body, u = req.user;
  db.prepare('UPDATE users SET name=?, locale=?, ai_language=? WHERE id=?').run(
    name?.trim() ? name.trim().slice(0, 80) : u.name, locale === 'fr' ? 'fr' : locale === 'en' ? 'en' : u.locale,
    preferences?.aiLanguage ? String(preferences.aiLanguage).slice(0, 20) : u.ai_language, u.id);
  res.json({ user: userDTO(db.prepare('SELECT * FROM users WHERE id=?').get(u.id)) });
}));

// Profile + password management (used by the Settings page)
const saveProfile = wrap(async (req, res) => {
  const { name, locale, preferences } = req.body, u = req.user;
  db.prepare('UPDATE users SET name=?, locale=?, ai_language=? WHERE id=?').run(
    name?.trim() ? name.trim().slice(0, 80) : u.name, locale === 'fr' ? 'fr' : locale === 'en' ? 'en' : u.locale,
    preferences?.aiLanguage ? String(preferences.aiLanguage).slice(0, 20) : u.ai_language, u.id);
  res.json({ user: userDTO(db.prepare('SELECT * FROM users WHERE id=?').get(u.id)) });
});
router.patch('/me', requireUser, saveProfile);
router.post('/change-password', limiter, requireUser, wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body, u = req.user;
  if (!newPassword || String(newPassword).length < 8) throw new HttpError(400, 'weak_password', 'New password must be at least 8 characters.');
  if (!u.pass || !(await bcrypt.compare(String(currentPassword || ''), u.pass))) throw new HttpError(401, 'invalid_credentials', 'Current password is incorrect.');
  db.prepare('UPDATE users SET pass=? WHERE id=?').run(await bcrypt.hash(String(newPassword), 12), u.id);
  const keep = req.cookies.cc_session ? sha(req.cookies.cc_session) : '';
  db.prepare('DELETE FROM sessions WHERE user_id=? AND hash<>?').run(u.id, keep); // sign out other devices
  res.json({ ok: true });
}));
router.delete('/me', limiter, requireUser, wrap(async (req, res) => {
  const uid = req.user.id;
  for (const t of ['sessions', 'otp']) { try { db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(uid); } catch {} }
  try { db.prepare('DELETE FROM conversations WHERE user_id=?').run(uid); } catch {}
  db.prepare('DELETE FROM users WHERE id=?').run(uid);
  res.clearCookie('cc_session', cookieOpts); res.json({ ok: true });
}));

module.exports = { router, loadUser, requireUser, requireVerified, requireAdmin };
