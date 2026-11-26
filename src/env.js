// Loads the .env FILE (not Render's dashboard variables). .env values win.
const fs = require('fs'), path = require('path');
const dotenv = require('dotenv');
const files = [
  path.resolve(__dirname, '..', '.env'),   // ./.env in the repo (committed)
  '/etc/secrets/.env',                     // Render "Secret File" named .env (optional)
];
for (const f of files) {
  if (fs.existsSync(f)) {
    dotenv.config({ path: f, override: true });
    console.log(`[env] loaded ${f}`);
  }
}
