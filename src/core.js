require('./env');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');

const env = process.env;
// Primary owner identity. This remains an application rule instead of relying
// on a deployment environment variable, so the owner is recognized on Render.
const OWNER_EMAIL = 'sammyodg123@gmail.com';
const cfg = {
  prod: env.NODE_ENV === 'production',
  port: +env.PORT || 3000,
  name: env.APP_NAME || 'CEASER AI',
  url: (env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
  creator: env.CREATOR_NAME || 'Ceaser',
  email: env.CONTACT_EMAIL || '',
  adminEmail: OWNER_EMAIL,
  frontend: path.resolve(__dirname, '..', env.FRONTEND_DIR || './site'),
  stripe: !!env.STRIPE_SECRET_KEY,
  paypal: !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_SECRET),
};
// Edit prices / allowances here
const PLANS = [
  { id: 'free', name: 'Free', priceUsd: 0, monthlyTokens: 20000, tokens: 20000, voiceInput: false, resetHours: 5 }, // free tokens refill every 5 hours (change FREE_RESET_HOURS in Admin)
  { id: 'pro', name: 'Pro', priceUsd: 1.99, monthlyTokens: 500000, tokens: 500000, voiceInput: true },
  { id: 'premium', name: 'Premium', priceUsd: 5, monthlyTokens: 2000000, tokens: 2000000, voiceInput: true },
];
const planOf = (id) => PLANS.find((p) => p.id === id) || PLANS[0];

fs.mkdirSync(path.dirname(path.resolve(env.DB_PATH || './data/app.db')), { recursive: true });
const db = new Database(env.DB_PATH || './data/app.db');
db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, pass TEXT, email_verified INT DEFAULT 0,
  plan TEXT DEFAULT 'free', plan_expires TEXT, role TEXT DEFAULT 'user', locale TEXT DEFAULT 'en', ai_language TEXT DEFAULT 'auto',
  used INT DEFAULT 0, bonus INT DEFAULT 0, period_end TEXT, ref_code TEXT UNIQUE, referred_by TEXT,
  stripe_customer TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, user_id TEXT, expires TEXT);
CREATE TABLE IF NOT EXISTS otp(hash TEXT PRIMARY KEY, user_id TEXT, kind TEXT, expires TEXT);
CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY, user_id TEXT, title TEXT DEFAULT 'New conversation',
  pinned INT DEFAULT 0, last_message_at TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT, content TEXT, status TEXT DEFAULT 'complete', model TEXT, tokens_in INT DEFAULT 0, tokens_out INT DEFAULT 0,
  feedback TEXT, seq INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS payments(id TEXT PRIMARY KEY, user_id TEXT, provider TEXT, plan TEXT, amount INT, ref TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);

try { db.exec('ALTER TABLE conversations ADD COLUMN manus_task TEXT'); } catch (e) { /* already exists */ }

class HttpError extends Error { constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; } }
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const id = () => crypto.randomUUID();
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const rand = (n = 32) => crypto.randomBytes(n).toString('hex');
const now = () => new Date().toISOString();
const inDays = (d) => new Date(Date.now() + d * 864e5).toISOString();
const inMins = (m) => new Date(Date.now() + m * 6e4).toISOString();

// ---------- email ----------
const mailer = env.SMTP_USER ? nodemailer.createTransport({
  host: env.SMTP_HOST || 'smtp.gmail.com', port: +env.SMTP_PORT || 465, secure: env.SMTP_SECURE ? String(env.SMTP_SECURE).toLowerCase() === 'true' : (+env.SMTP_PORT || 465) === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
}) : null;
async function sendMail(to, subject, html) {
  if (env.BREVO_API_KEY) {
    const m = /^(.*)<(.+)>$/.exec(env.MAIL_FROM || '');
    const sender = m ? { name: m[1].trim().replace(/^"|"$/g, ''), email: m[2].trim() } : { name: 'CEASER AI', email: env.SMTP_USER };
    const r = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender, to: [{ email: to }], subject, htmlContent: html }),
    });
    if (!r.ok) throw new Error('Brevo ' + r.status + ' ' + await r.text());
    return;
  }
  return sendMailSmtp(to, subject, html);
}
async function sendMailSmtp(to, subject, html) {
  if (!mailer) { console.log(`[MAIL not configured] to=${to} subject=${subject}\n${html.replace(/<[^>]+>/g, ' ')}`); return; }
  await mailer.sendMail({ from: env.MAIL_FROM || env.SMTP_USER, to, subject, html });
}

// ---------- tokens / balance ----------
// Free plan: the allowance refills every FREE_RESET_HOURS (default 5). Paid plans: every 30 days from the day they paid.
const freeHours = () => Math.min(720, Math.max(1, Number(process.env.FREE_RESET_HOURS) || 5));
function refreshPeriod(u) {
  if (u.plan !== 'free' && u.plan_expires && u.plan_expires < now()) {
    db.prepare("UPDATE users SET plan='free', plan_expires=NULL WHERE id=?").run(u.id);
  }
  const cur = db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
  if (!cur.period_end || cur.period_end < now()) {
    db.prepare('UPDATE users SET used=0, period_end=? WHERE id=?').run(cur.plan === 'free' ? inMins(freeHours() * 60) : inDays(30), u.id);
  } else if (cur.plan === 'free' && cur.period_end > inMins(freeHours() * 60 + 1)) {
    db.prepare('UPDATE users SET period_end=? WHERE id=?').run(inMins(freeHours() * 60), u.id); // older accounts that still had a 30-day window
  }
  return db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
}
function balanceOf(u) {
  u = refreshPeriod(u);
  if (isAdminEmail(u.email)) { const unlimited = Number.MAX_SAFE_INTEGER; return { limit: unlimited, used: u.used, bonus: u.bonus, remaining: unlimited, allowance: unlimited, total: unlimited, unlimited: true, resetAt: null, nextReset: null, plan: 'owner' }; }
  const limit = planOf(u.plan).monthlyTokens, used = u.used;
  const allowance = Math.max(0, limit - used);
  return { limit, used, bonus: u.bonus, remaining: allowance + u.bonus, allowance, total: limit + u.bonus, resetAt: u.period_end, nextReset: u.period_end, resetHours: u.plan === 'free' ? freeHours() : 720, plan: u.plan };
}
function spend(userId, tokens) {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  if (u && isAdminEmail(u.email)) return;
  const allowance = Math.max(0, planOf(u.plan).monthlyTokens - u.used);
  const fromAllowance = Math.min(allowance, tokens), fromBonus = Math.min(u.bonus, tokens - fromAllowance);
  db.prepare('UPDATE users SET used=used+?, bonus=bonus-? WHERE id=?').run(fromAllowance + (tokens - fromAllowance - fromBonus), fromBonus, userId);
}

// Normalize addresses for role checks. Gmail ignores dots and plus-tags in the local part.
const normalizeAdminEmail = (e) => {
  let email = String(e || '').trim().toLowerCase();
  const m = /^([^@]+)@(gmail\.com|googlemail\.com)$/.exec(email);
  if (m) email = m[1].split('+')[0].replace(/\./g, '') + '@gmail.com';
  return email;
};
// The owner is always an admin; ADMIN_EMAIL may still add extra admins.
const isAdminEmail = (e) => {
  const email = normalizeAdminEmail(e);
  const extra = String(process.env.ADMIN_EMAIL || '').split(/[,;\s]+/).map(normalizeAdminEmail).filter(Boolean);
  return !!email && (email === OWNER_EMAIL || extra.includes(email));
};
const userDTO = (u) => {
  const verified = db.prepare('SELECT COUNT(*) c FROM users WHERE referred_by=? AND email_verified=1').get(u.id).c;
  return { id: u.id, name: u.name, email: u.email, emailVerified: !!u.email_verified, plan: refreshPeriod(u).plan, role: isAdminEmail(u.email) ? 'admin' : u.role,
    locale: u.locale, preferences: { aiLanguage: u.ai_language }, createdAt: u.created_at,
    referral: { code: u.ref_code, link: `${cfg.url}/register?ref=${u.ref_code}`, verifiedCount: verified } };
};
module.exports = { freeHours, cfg, PLANS, planOf, db, HttpError, wrap, id, sha, rand, now, inDays, inMins, sendMail, balanceOf, spend, userDTO, refreshPeriod, isAdminEmail, normalizeAdminEmail };
