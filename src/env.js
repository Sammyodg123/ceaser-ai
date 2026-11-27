// Loads the .env FILE. Non-empty values in the file win over Render's dashboard variables;
// empty values (KEY=) never wipe a variable that is set elsewhere.
const fs = require('fs'), path = require('path');
const dotenv = require('dotenv');
const files = [path.resolve(__dirname, '..', '.env'), '/etc/secrets/.env'];
for (const f of files) {
  if (!fs.existsSync(f)) continue;
  const vars = dotenv.parse(fs.readFileSync(f));
  for (const [k, v] of Object.entries(vars)) if (v !== '' || process.env[k] === undefined) process.env[k] = v;
  console.log(`[env] loaded ${f}`);
}

// Admin-panel overrides (saved by /api/admin/settings). They win over .env and the Render dashboard.
try {
  const sf = path.join(path.dirname(path.resolve(process.env.DB_PATH || './data/app.db')), 'settings.json');
  if (fs.existsSync(sf)) { const o = JSON.parse(fs.readFileSync(sf, 'utf8')); for (const [k, v] of Object.entries(o)) if (v !== '' && v != null) process.env[k] = String(v); console.log('[env] loaded admin settings'); }
} catch (e) { console.error('[env] settings.json unreadable', e.message); }
