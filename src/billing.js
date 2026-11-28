// Payments: Flutterwave, PayPal and Stripe. The buyer picks one at checkout.
// Put the keys in Admin -> Payments (saved live, no redeploy) or in .env:
//   Flutterwave: FLW_SECRET_KEY (+ FLW_SECRET_HASH for the webhook), optional FLW_CURRENCY=NGN and FLW_RATE=1500
//   PayPal:      PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_MODE=live|sandbox
//   Stripe:      STRIPE_SECRET_KEY (+ STRIPE_WEBHOOK_SECRET for the webhook)
//   Optional:    PAYMENT_METHODS=flutterwave,paypal,stripe  (hide some), PROMO_CODES=SAVE20:20
// PayPal and Stripe charge in USD. Flutterwave charges USD, or local money if FLW_CURRENCY + FLW_RATE are set.
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { cfg, planOf, db, HttpError, wrap, id, inDays, balanceOf } = require('./core');
const { requireVerified, requireUser } = require('./auth');

const env = (k) => String(process.env[k] || '').trim();
const LABELS = { flutterwave: 'Flutterwave', paypal: 'PayPal', stripe: 'Stripe' };
const READY = { flutterwave: () => !!env('FLW_SECRET_KEY'), paypal: () => !!(env('PAYPAL_CLIENT_ID') && env('PAYPAL_SECRET')), stripe: () => !!env('STRIPE_SECRET_KEY') };
// Providers that have keys AND are not hidden by PAYMENT_METHODS
const methods = () => {
  const allow = env('PAYMENT_METHODS').toLowerCase().split(/[,;\s]+/).filter(Boolean);
  return Object.keys(READY).filter((k) => READY[k]() && (!allow.length || allow.includes(k)));
};
const promos = () => Object.fromEntries((process.env.PROMO_CODES || '').split(',').filter(Boolean).map((s) => { const [c, p] = s.split(':'); return [c.trim().toUpperCase(), +p]; }));
const priceUsd = (plan, code) => plan.priceUsd * (1 - (promos()[String(code || '').toUpperCase()] || 0) / 100);
const cents = (usd) => Math.round(usd * 100);
const sleepless = (ms) => AbortSignal.timeout(ms);

function activatePlan(userId, planId, provider, amount, ref) {
  if (db.prepare('SELECT 1 FROM payments WHERE ref=? AND provider=?').get(ref, provider)) return; // idempotent: webhooks and returns can both arrive
  db.prepare('UPDATE users SET plan=?, plan_expires=?, used=0, period_end=? WHERE id=?').run(planId, inDays(31), inDays(30), userId);
  db.prepare('INSERT INTO payments(id,user_id,provider,plan,amount,ref) VALUES(?,?,?,?,?,?)').run(id(), userId, provider, planId, amount, ref);
}
const pending = (provider, ref) => db.prepare('SELECT * FROM payments WHERE ref=? AND provider=?').get(ref, provider + '_pending');
const complete = (p, provider, ref) => { db.prepare('DELETE FROM payments WHERE id=?').run(p.id); activatePlan(p.user_id, p.plan, provider, p.amount, ref); return true; };
const addPending = (userId, provider, planId, amount, ref) => db.prepare('INSERT INTO payments(id,user_id,provider,plan,amount,ref) VALUES(?,?,?,?,?,?)').run(id(), userId, provider + '_pending', planId, amount, ref);

/* ---------------- Flutterwave ---------------- */
const FLW = 'https://api.flutterwave.com/v3';
const flwCur = () => (env('FLW_CURRENCY') || 'USD').toUpperCase();
const flwRate = () => (flwCur() === 'USD' ? 1 : Number(env('FLW_RATE')) || 1);
const flw = async (path, opt) => { const r = await fetch(FLW + path, Object.assign({ headers: { authorization: 'Bearer ' + env('FLW_SECRET_KEY'), 'content-type': 'application/json' }, signal: sleepless(25000) }, opt)); return { r, j: await r.json().catch(() => ({})) }; };

async function settleFlw(txId, txRef) {
  const p = pending('flw', txRef);
  if (!p) return null;
  const { r, j } = await flw('/transactions/' + encodeURIComponent(txId) + '/verify'); // never trust the redirect URL alone
  const d = j && j.data;
  const ok = r.ok && d && d.status === 'successful' && d.tx_ref === txRef && String(d.currency).toUpperCase() === flwCur() && Number(d.amount) + 0.01 >= p.amount / 100;
  return ok ? complete(p, 'flutterwave', txRef) : false;
}
async function startFlw(u, plan, usd) {
  const amount = Math.round(usd * flwRate() * 100) / 100, txRef = 'cz_' + id().replace(/-/g, '').slice(0, 20);
  const { r, j } = await flw('/payments', { method: 'POST', body: JSON.stringify({
    tx_ref: txRef, amount, currency: flwCur(), redirect_url: `${cfg.url}/api/billing/flutterwave/return`,
    customer: { email: u.email, name: u.name || u.email },
    customizations: { title: cfg.name, description: `${plan.name} plan (30 days)` }, meta: { userId: u.id, plan: plan.id } }) });
  if (!r.ok || !j.data || !j.data.link) { console.error('flutterwave', r.status, JSON.stringify(j).slice(0, 300)); throw new HttpError(502, 'provider_error', 'Flutterwave: ' + (j.message || 'could not start the payment')); }
  addPending(u.id, 'flw', plan.id, Math.round(amount * 100), txRef);
  return j.data.link;
}

/* ---------------- PayPal ---------------- */
const ppBase = () => env('PAYPAL_API') || (env('PAYPAL_MODE').toLowerCase() === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com');
async function ppToken() {
  const r = await fetch(ppBase() + '/v1/oauth2/token', { method: 'POST', signal: sleepless(25000),
    headers: { authorization: 'Basic ' + Buffer.from(env('PAYPAL_CLIENT_ID') + ':' + env('PAYPAL_SECRET')).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new HttpError(502, 'provider_error', 'PayPal: ' + (j.error_description || 'check the Client ID, Secret and Live/Sandbox mode in Admin'));
  return j.access_token;
}
const pp = async (path, opt) => { const t = await ppToken(); const r = await fetch(ppBase() + path, Object.assign({ headers: { authorization: 'Bearer ' + t, 'content-type': 'application/json' }, signal: sleepless(25000) }, opt)); return { r, j: await r.json().catch(() => ({})) }; };

async function startPaypal(u, plan, usd) {
  const { r, j } = await pp('/v2/checkout/orders', { method: 'POST', body: JSON.stringify({ intent: 'CAPTURE',
    purchase_units: [{ reference_id: plan.id, custom_id: u.id, description: `${cfg.name} ${plan.name} plan (30 days)`, amount: { currency_code: 'USD', value: usd.toFixed(2) } }],
    payment_source: { paypal: { experience_context: { brand_name: cfg.name, user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING', return_url: `${cfg.url}/api/billing/paypal/return`, cancel_url: `${cfg.url}/api/billing/paypal/return?cancelled=1` } } } }) });
  const link = ((j.links || []).find((l) => l.rel === 'payer-action') || (j.links || []).find((l) => l.rel === 'approve') || {}).href;
  if (!r.ok || !j.id || !link) { console.error('paypal', r.status, JSON.stringify(j).slice(0, 300)); throw new HttpError(502, 'provider_error', 'PayPal: ' + (j.message || 'could not start the payment')); }
  addPending(u.id, 'pp', plan.id, cents(usd), j.id);
  return link;
}
// The buyer approved on PayPal; we capture the money here, then check what PayPal says it captured.
async function settlePaypal(orderId) {
  const p = pending('pp', orderId);
  if (!p) return null;
  let { r, j } = await pp('/v2/checkout/orders/' + encodeURIComponent(orderId) + '/capture', { method: 'POST', body: '{}' });
  if (!r.ok && JSON.stringify(j).includes('ORDER_ALREADY_CAPTURED')) ({ r, j } = await pp('/v2/checkout/orders/' + encodeURIComponent(orderId)));
  const cap = j && j.purchase_units && j.purchase_units[0] && j.purchase_units[0].payments && j.purchase_units[0].payments.captures && j.purchase_units[0].payments.captures[0];
  const ok = r.ok && j.status === 'COMPLETED' && cap && cap.status === 'COMPLETED' && cap.amount && cap.amount.currency_code === 'USD' && Number(cap.amount.value) + 0.01 >= p.amount / 100;
  return ok ? complete(p, 'paypal', orderId) : false;
}

/* ---------------- Stripe ---------------- */
const form = (o, pre) => Object.entries(o).flatMap(([k, v]) => { const key = pre ? `${pre}[${k}]` : k; return v !== null && typeof v === 'object' ? [form(v, key)] : [encodeURIComponent(key) + '=' + encodeURIComponent(v)]; }).join('&');
const stripe = async (path, opt) => { const r = await fetch('https://api.stripe.com/v1' + path, Object.assign({ headers: { authorization: 'Bearer ' + env('STRIPE_SECRET_KEY'), 'content-type': 'application/x-www-form-urlencoded' }, signal: sleepless(25000) }, opt)); return { r, j: await r.json().catch(() => ({})) }; };

async function startStripe(u, plan, usd) {
  const { r, j } = await stripe('/checkout/sessions', { method: 'POST', body: form({ mode: 'payment', customer_email: u.email, client_reference_id: u.id,
    success_url: `${cfg.url}/api/billing/stripe/return?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${cfg.url}/api/billing/stripe/return?cancelled=1`,
    line_items: { 0: { quantity: 1, price_data: { currency: 'usd', unit_amount: cents(usd), product_data: { name: `${cfg.name} ${plan.name} plan (30 days)` } } } },
    metadata: { userId: u.id, plan: plan.id } }) });
  if (!r.ok || !j.id || !j.url) { console.error('stripe', r.status, JSON.stringify(j).slice(0, 300)); throw new HttpError(502, 'provider_error', 'Stripe: ' + ((j.error && j.error.message) || 'could not start the payment')); }
  addPending(u.id, 'stripe', plan.id, cents(usd), j.id);
  return j.url;
}
async function settleStripe(sessionId) {
  const p = pending('stripe', sessionId);
  if (!p) return null;
  const { r, j } = await stripe('/checkout/sessions/' + encodeURIComponent(sessionId)); // ask Stripe, never trust the URL
  const ok = r.ok && j.payment_status === 'paid' && String(j.currency).toLowerCase() === 'usd' && Number(j.amount_total) >= p.amount;
  return ok ? complete(p, 'stripe', sessionId) : false;
}

/* ---------------- routes ---------------- */
router.get('/tokens-balance', requireUser, (req, res) => res.json({ balance: balanceOf(req.user) }));
router.get('/methods', (req, res) => res.json({ methods: methods().map((k) => ({ id: k, label: LABELS[k] })) }));
router.post('/promo/validate', requireUser, (req, res) => {
  const plan = planOf(req.body.plan), code = String(req.body.code || '').trim().toUpperCase();
  if (!promos()[code]) throw new HttpError(400, 'invalid_promo', 'Invalid promo code.');
  res.json({ code, valid: true, percentOff: promos()[code], finalPriceUsd: Math.round(priceUsd(plan, code) * 100) / 100 });
});

router.post('/checkout', requireVerified, wrap(async (req, res) => {
  const plan = planOf(req.body.plan), code = String(req.body.promoCode || '').toUpperCase(), u = req.user, on = methods();
  if (plan.priceUsd <= 0) throw new HttpError(400, 'invalid_plan', 'This plan is free.');
  if (code && !promos()[code]) throw new HttpError(400, 'invalid_promo', 'Invalid promo code.');
  if (!on.length) throw new HttpError(503, 'provider_disabled', 'Payments are not set up yet. Add a payment method in Admin → Payments.');
  const provider = String(req.body.provider || '').toLowerCase() || (on.length === 1 ? on[0] : '');
  if (!provider) throw new HttpError(400, 'choose_method', 'Choose a payment method.');
  if (!LABELS[provider]) throw new HttpError(400, 'invalid_method', 'Unknown payment method.');
  if (!on.includes(provider)) throw new HttpError(503, 'provider_disabled', `${LABELS[provider]} is not available right now. Pick another method.`);
  const usd = Math.max(0.5, Math.round(priceUsd(plan, code) * 100) / 100);
  const url = provider === 'paypal' ? await startPaypal(u, plan, usd) : provider === 'stripe' ? await startStripe(u, plan, usd) : await startFlw(u, plan, usd);
  res.json({ url, provider });
}));

// Where the buyer lands after paying. Always ends on the plan page with ?pay=ok|failed|cancelled so the app can say what happened.
const back = (res, s) => res.redirect('/chat.html?pay=' + s + '#plan');
router.get('/flutterwave/return', requireUser, wrap(async (req, res) => {
  const { status, tx_ref: txRef, transaction_id: txId } = req.query;
  if (status === 'cancelled' || !txRef || !txId) return back(res, 'cancelled');
  back(res, (await settleFlw(txId, String(txRef))) ? 'ok' : 'failed');
}));
router.get('/paypal/return', requireUser, wrap(async (req, res) => {
  if (req.query.cancelled || !req.query.token) return back(res, 'cancelled');
  back(res, (await settlePaypal(String(req.query.token))) ? 'ok' : 'failed');
}));
router.get('/stripe/return', requireUser, wrap(async (req, res) => {
  if (req.query.cancelled || !req.query.session_id) return back(res, 'cancelled');
  back(res, (await settleStripe(String(req.query.session_id))) ? 'ok' : 'failed');
}));

// Webhooks: backup in case the buyer closes the page before coming back.
const flwWebhook = wrap(async (req, res) => {
  const h = env('FLW_SECRET_HASH');
  if (!h || req.headers['verif-hash'] !== h) return res.sendStatus(401);
  const d = req.body && req.body.data;
  if (d && d.status === 'successful' && d.tx_ref && d.id) await settleFlw(d.id, d.tx_ref);
  res.sendStatus(200);
});
// Stripe signs the raw body: mounted with express.raw in server.js. Add the endpoint https://YOUR-SITE/api/billing/webhook/stripe (event: checkout.session.completed) and paste its signing secret in Admin.
const stripeWebhook = wrap(async (req, res) => {
  const secret = env('STRIPE_WEBHOOK_SECRET'), raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  const parts = Object.fromEntries(String(req.headers['stripe-signature'] || '').split(',').map((x) => x.split('=')));
  if (!secret || !parts.t || !parts.v1) return res.sendStatus(400);
  const want = crypto.createHmac('sha256', secret).update(parts.t + '.' + raw).digest('hex');
  const same = want.length === parts.v1.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(parts.v1));
  if (!same || Math.abs(Date.now() / 1000 - Number(parts.t)) > 600) return res.sendStatus(400);
  let ev; try { ev = JSON.parse(raw); } catch (e) { return res.sendStatus(400); }
  if (ev.type === 'checkout.session.completed' && ev.data && ev.data.object && ev.data.object.id) await settleStripe(ev.data.object.id);
  res.sendStatus(200);
});

// Admin "Test payments" button: checks that each saved key really works.
async function testAll() {
  const out = [];
  const run = async (k, fn) => { if (!READY[k]()) return out.push({ provider: k, label: LABELS[k], ok: false, note: 'No keys saved yet' }); const t0 = Date.now(); try { out.push({ provider: k, label: LABELS[k], ok: true, ms: Date.now() - t0, note: await fn() }); } catch (e) { out.push({ provider: k, label: LABELS[k], ok: false, ms: Date.now() - t0, note: String(e.message).slice(0, 200) }); } };
  await run('flutterwave', async () => { const { r, j } = await flw('/balances'); if (!r.ok) throw new Error(j.message || 'HTTP ' + r.status); return 'key works · ' + flwCur(); });
  await run('paypal', async () => { await ppToken(); return 'key works · ' + (ppBase().includes('sandbox') ? 'sandbox' : 'live'); });
  await run('stripe', async () => { const { r, j } = await stripe('/balance'); if (!r.ok) throw new Error((j.error && j.error.message) || 'HTTP ' + r.status); return 'key works · ' + (j.livemode ? 'live' : 'test mode'); });
  const on = methods();
  out.forEach((o) => { o.shown = on.includes(o.provider); });
  return out;
}

module.exports = { router, flwWebhook, stripeWebhook, methods, testAll, LABELS };
