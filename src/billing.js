const express = require('express');
const router = express.Router();
const { cfg, PLANS, planOf, db, HttpError, wrap, id, now, inDays, balanceOf } = require('./core');
const { requireVerified, requireUser } = require('./auth');

const stripe = cfg.stripe ? require('stripe')(process.env.STRIPE_SECRET_KEY) : null;
// PROMO_CODES="WELCOME10:10,CEASER50:50"  (code:percent off, first payment only)
const promos = Object.fromEntries((process.env.PROMO_CODES || '').split(',').filter(Boolean).map((s) => { const [c, p] = s.split(':'); return [c.trim().toUpperCase(), +p]; }));
const priceCents = (plan, code) => Math.round(plan.priceUsd * 100 * (1 - (promos[String(code || '').toUpperCase()] || 0) / 100));

function activatePlan(userId, planId, provider, amount, ref) {
  if (db.prepare('SELECT 1 FROM payments WHERE ref=? AND provider=?').get(ref, provider)) return; // idempotent: webhooks can repeat
  db.prepare('UPDATE users SET plan=?, plan_expires=?, used=0, period_end=? WHERE id=?').run(planId, inDays(31), inDays(30), userId);
  db.prepare('INSERT INTO payments(id,user_id,provider,plan,amount,ref) VALUES(?,?,?,?,?,?)').run(id(), userId, provider, planId, amount, ref);
}

router.get('/tokens-balance', requireUser, (req, res) => res.json({ balance: balanceOf(req.user) }));
router.post('/promo/validate', requireUser, (req, res) => {
  const plan = planOf(req.body.plan), code = String(req.body.code || '').trim().toUpperCase();
  if (!promos[code]) throw new HttpError(400, 'invalid_promo', 'Invalid promo code.');
  res.json({ code, valid: true, percentOff: promos[code], finalPriceUsd: priceCents(plan, code) / 100 });
});

router.post('/checkout', requireVerified, wrap(async (req, res) => {
  const plan = planOf(req.body.plan), provider = req.body.provider, code = String(req.body.promoCode || '').toUpperCase();
  if (plan.priceUsd <= 0) throw new HttpError(400, 'invalid_plan', 'This plan is free.');
  if (code && !promos[code]) throw new HttpError(400, 'invalid_promo', 'Invalid promo code.');
  const u = req.user;
  if (provider === 'stripe') {
    if (!stripe) throw new HttpError(503, 'provider_disabled', 'Stripe is not enabled.');
    const params = { mode: 'subscription', customer_email: u.stripe_customer ? undefined : u.email, customer: u.stripe_customer || undefined,
      line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: plan.priceUsd * 100, recurring: { interval: 'month' }, product_data: { name: `${cfg.name} ${plan.name}` } } }],
      metadata: { userId: u.id, plan: plan.id }, subscription_data: { metadata: { userId: u.id, plan: plan.id } },
      success_url: `${cfg.url}/app/billing?paid=1`, cancel_url: `${cfg.url}/pricing` };
    if (promos[code]) params.discounts = [{ coupon: (await stripe.coupons.create({ percent_off: promos[code], duration: 'once' })).id }];
    const s = await stripe.checkout.sessions.create(params);
    return res.json({ url: s.url });
  }
  if (provider === 'paypal') {
    if (!cfg.paypal) throw new HttpError(503, 'provider_disabled', 'PayPal is not enabled.');
    const cents = priceCents(plan, code), api = process.env.PAYPAL_API || 'https://api-m.paypal.com';
    const t = await ppToken();
    const r = await fetch(`${api}/v2/checkout/orders`, { method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ description: `${cfg.name} ${plan.name} (30 days)`, amount: { currency_code: 'USD', value: (cents / 100).toFixed(2) } }],
        application_context: { return_url: `${cfg.url}/api/billing/paypal/return`, cancel_url: `${cfg.url}/pricing`, user_action: 'PAY_NOW', brand_name: cfg.name } }) });
    const o = await r.json();
    if (!r.ok) { console.error('paypal', o); throw new HttpError(502, 'provider_error', 'PayPal error.'); }
    db.prepare('INSERT INTO payments(id,user_id,provider,plan,amount,ref) VALUES(?,?,?,?,?,?)').run(id(), u.id, 'paypal_pending', plan.id, cents, o.id);
    return res.json({ url: o.links.find((l) => l.rel === 'approve' || l.rel === 'payer-action').href });
  }
  throw new HttpError(400, 'invalid_provider', 'Unknown payment provider.');
}));

async function ppToken() {
  const api = process.env.PAYPAL_API || 'https://api-m.paypal.com';
  const r = await fetch(`${api}/v1/oauth2/token`, { method: 'POST', body: 'grant_type=client_credentials',
    headers: { authorization: 'Basic ' + Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' } });
  return (await r.json()).access_token;
}
// PayPal sends the buyer back here after approval -> we capture the money server-side and verify it
router.get('/paypal/return', requireUser, wrap(async (req, res) => {
  const order = String(req.query.token || ''), api = process.env.PAYPAL_API || 'https://api-m.paypal.com';
  const p = db.prepare("SELECT * FROM payments WHERE ref=? AND provider='paypal_pending' AND user_id=?").get(order, req.user.id);
  if (!p) return res.redirect('/pricing');
  const r = await fetch(`${api}/v2/checkout/orders/${order}/capture`, { method: 'POST', headers: { authorization: `Bearer ${await ppToken()}`, 'content-type': 'application/json' } });
  const o = await r.json();
  const paid = o.status === 'COMPLETED' && Math.round(parseFloat(o.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value) * 100) === p.amount;
  if (!paid) return res.redirect('/pricing?error=1');
  db.prepare("DELETE FROM payments WHERE id=?").run(p.id);
  activatePlan(req.user.id, p.plan, 'paypal', p.amount, order);
  res.redirect('/app/billing?paid=1');
}));

// Stripe webhook (mounted with express.raw in server.js). Stripe tells US when money really arrived.
const stripeWebhook = wrap(async (req, res) => {
  if (!stripe) return res.sendStatus(404);
  let ev; try { ev = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return res.status(400).send('bad signature'); }
  const o = ev.data.object;
  if (ev.type === 'checkout.session.completed' && o.metadata?.userId) {
    if (o.customer) db.prepare('UPDATE users SET stripe_customer=? WHERE id=?').run(o.customer, o.metadata.userId);
    activatePlan(o.metadata.userId, o.metadata.plan, 'stripe', o.amount_total, o.id);
  } else if (ev.type === 'invoice.paid' && o.billing_reason === 'subscription_cycle') {
    const u = db.prepare('SELECT * FROM users WHERE stripe_customer=?').get(o.customer);
    if (u) activatePlan(u.id, u.plan === 'free' ? 'pro' : u.plan, 'stripe', o.amount_paid, o.id);
  } else if (ev.type === 'customer.subscription.deleted') {
    db.prepare("UPDATE users SET plan='free', plan_expires=NULL WHERE stripe_customer=?").run(o.customer);
  }
  res.json({ received: true });
});
module.exports = { router, stripeWebhook };
