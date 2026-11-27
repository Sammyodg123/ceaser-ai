// Payments: Flutterwave (Standard checkout). Set FLW_SECRET_KEY (+ FLW_SECRET_HASH for the webhook) in the admin panel or .env.
// Optional: FLW_CURRENCY=NGN and FLW_RATE=1500 (local currency per 1 USD) to charge in local money. Default is USD.
const express = require('express');
const router = express.Router();
const { cfg, PLANS, planOf, db, HttpError, wrap, id, now, inDays, balanceOf } = require('./core');
const { requireVerified, requireUser } = require('./auth');

const FLW = 'https://api.flutterwave.com/v3';
const key = () => String(process.env.FLW_SECRET_KEY || '').trim();
const currency = () => String(process.env.FLW_CURRENCY || 'USD').trim().toUpperCase();
const rate = () => (currency() === 'USD' ? 1 : Number(process.env.FLW_RATE) || 1);
const promos = () => Object.fromEntries((process.env.PROMO_CODES || '').split(',').filter(Boolean).map((s) => { const [c, p] = s.split(':'); return [c.trim().toUpperCase(), +p]; }));
const priceUsd = (plan, code) => plan.priceUsd * (1 - (promos()[String(code || '').toUpperCase()] || 0) / 100);
const flw = async (path, opt) => { const r = await fetch(FLW + path, Object.assign({ headers: { authorization: 'Bearer ' + key(), 'content-type': 'application/json' }, signal: AbortSignal.timeout(25000) }, opt)); return { r, j: await r.json().catch(() => ({})) }; };

function activatePlan(userId, planId, provider, amount, ref) {
  if (db.prepare('SELECT 1 FROM payments WHERE ref=? AND provider=?').get(ref, provider)) return; // idempotent: webhooks can repeat
  db.prepare('UPDATE users SET plan=?, plan_expires=?, used=0, period_end=? WHERE id=?').run(planId, inDays(31), inDays(30), userId);
  db.prepare('INSERT INTO payments(id,user_id,provider,plan,amount,ref) VALUES(?,?,?,?,?,?)').run(id(), userId, provider, planId, amount, ref);
}
// Verify with Flutterwave itself (never trust the redirect URL alone), then activate the plan.
async function settle(txId, txRef) {
  const p = db.prepare("SELECT * FROM payments WHERE ref=? AND provider='flw_pending'").get(txRef);
  if (!p) return null;
  const { r, j } = await flw('/transactions/' + encodeURIComponent(txId) + '/verify');
  const d = j && j.data;
  const ok = r.ok && d && d.status === 'successful' && d.tx_ref === txRef && String(d.currency).toUpperCase() === currency() && Number(d.amount) + 0.01 >= p.amount / 100;
  if (!ok) return false;
  db.prepare('DELETE FROM payments WHERE id=?').run(p.id);
  activatePlan(p.user_id, p.plan, 'flutterwave', p.amount, txRef);
  return true;
}

router.get('/tokens-balance', requireUser, (req, res) => res.json({ balance: balanceOf(req.user) }));
router.post('/promo/validate', requireUser, (req, res) => {
  const plan = planOf(req.body.plan), code = String(req.body.code || '').trim().toUpperCase();
  if (!promos()[code]) throw new HttpError(400, 'invalid_promo', 'Invalid promo code.');
  res.json({ code, valid: true, percentOff: promos()[code], finalPriceUsd: Math.round(priceUsd(plan, code) * 100) / 100 });
});

router.post('/checkout', requireVerified, wrap(async (req, res) => {
  const plan = planOf(req.body.plan), code = String(req.body.promoCode || '').toUpperCase(), u = req.user;
  if (plan.priceUsd <= 0) throw new HttpError(400, 'invalid_plan', 'This plan is free.');
  if (code && !promos()[code]) throw new HttpError(400, 'invalid_promo', 'Invalid promo code.');
  if (!key()) throw new HttpError(503, 'provider_disabled', 'Payments are not set up yet. Add the Flutterwave secret key in Admin.');
  const amount = Math.round(priceUsd(plan, code) * rate() * 100) / 100, txRef = 'cz_' + id().replace(/-/g, '').slice(0, 20);
  const { r, j } = await flw('/payments', { method: 'POST', body: JSON.stringify({
    tx_ref: txRef, amount, currency: currency(), redirect_url: `${cfg.url}/api/billing/flutterwave/return`,
    customer: { email: u.email, name: u.name || u.email },
    customizations: { title: cfg.name, description: `${plan.name} plan (30 days)` }, meta: { userId: u.id, plan: plan.id } }) });
  if (!r.ok || !j.data || !j.data.link) { console.error('flutterwave', r.status, JSON.stringify(j).slice(0, 300)); throw new HttpError(502, 'provider_error', 'Flutterwave: ' + (j.message || 'could not start the payment')); }
  db.prepare('INSERT INTO payments(id,user_id,provider,plan,amount,ref) VALUES(?,?,?,?,?,?)').run(id(), u.id, 'flw_pending', plan.id, Math.round(amount * 100), txRef);
  res.json({ url: j.data.link });
}));

// Flutterwave sends the buyer back here after paying
router.get('/flutterwave/return', requireUser, wrap(async (req, res) => {
  const { status, tx_ref: txRef, transaction_id: txId } = req.query;
  if (status === 'cancelled' || !txRef || !txId) return res.redirect('/chat.html#plan');
  const ok = await settle(txId, String(txRef));
  res.redirect('/chat.html#' + (ok ? 'plan' : 'plan'));
}));
// Webhook (backup if the buyer closes the page before returning). Set the same secret hash in Flutterwave dashboard and FLW_SECRET_HASH.
const flwWebhook = wrap(async (req, res) => {
  const h = String(process.env.FLW_SECRET_HASH || '').trim();
  if (!h || req.headers['verif-hash'] !== h) return res.sendStatus(401);
  const d = req.body && req.body.data;
  if (d && d.status === 'successful' && d.tx_ref && d.id) await settle(d.id, d.tx_ref);
  res.sendStatus(200);
});
module.exports = { router, flwWebhook };
