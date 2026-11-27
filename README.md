# CEASER AI — deploy guide

## How it fits together
Browser -> (HTTPS) nginx -> Node server (this project) -> SQLite file + Anthropic API + Gmail + Stripe/PayPal.
The Node server also serves the website in `site/`. All secrets live in `.env` on the server only.

## 1. Server (Ubuntu 22/24 VPS, point your domain's A record to its IP)
```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx build-essential python3
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g pm2
```
## 2. Upload & install
```bash
scp -r ceaser-ai user@SERVER:/home/user/      # or git clone
cd ~/ceaser-ai && npm install --omit=dev
cp .env.example .env && nano .env                  # fill every value, set APP_URL=https://yourdomain.com
chmod 600 .env
pm2 start src/server.js --name ceaser && pm2 save && pm2 startup
```
## 3. nginx + HTTPS
`/etc/nginx/sites-available/ceaser`:
```
server {
  server_name yourdomain.com www.yourdomain.com;
  client_max_body_size 20m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;          # needed for live chat streaming
    proxy_read_timeout 300s;
  }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/ceaser /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```
## 4. Gmail (verification + reset emails)
Google Account -> Security -> turn on 2-Step Verification -> "App passwords" -> create one.
Put it in `.env` as SMTP_PASS (16 chars), SMTP_USER = your Gmail. Users get emails FROM your Gmail.
(Later, for scale, switch to Resend/Brevo/Mailgun SMTP: only the 4 SMTP_ values change.)

## 5. AI key
console.anthropic.com -> API keys -> put in ANTHROPIC_API_KEY. Set a monthly spend limit there.

## 6. Stripe
1. dashboard.stripe.com -> Developers -> API keys -> STRIPE_SECRET_KEY (start with `sk_test_`).
2. Developers -> Webhooks -> Add endpoint: `https://yourdomain.com/api/billing/webhook/stripe`
   events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`.
3. Copy the signing secret (`whsec_...`) -> STRIPE_WEBHOOK_SECRET. Test with card 4242 4242 4242 4242, then swap to live keys.
## 7. PayPal
developer.paypal.com -> Apps & Credentials -> create app -> PAYPAL_CLIENT_ID / PAYPAL_SECRET.
Sandbox: PAYPAL_API=https://api-m.sandbox.paypal.com. Live: https://api-m.paypal.com. No webhook needed.
Money lands in the account that owns the app.

## 8. Backups & updates
`cp data/app.db backup-$(date +%F).db` daily (cron). Update: upload files, `pm2 restart ceaser`. Logs: `pm2 logs ceaser`.

## Not built yet
Projects generator, file uploads, teams, API keys (v1), admin panel, Google login. Those return "not available".
Prices/allowances: edit PLANS in `src/core.js`.

## Adding AIs (v15) — no restart
Every provider whose key is found in the environment (Render dashboard, `.env`, or Admin panel) shows up in the chat's model picker automatically.
Extra AIs not built in: set `NAME_API_KEY` + `NAME_BASE_URL` (any OpenAI-compatible API; a few names like SAMBANOVA, DEEPINFRA, HYPERBOLIC need only the key).
In Admin → "Add a new AI" → Save changes: live immediately. Render dashboard edits still need Render's own redeploy.
Auto → Censored / Uncensored only changes the answer style (blunt vs polished); the same safety rules apply to both.
