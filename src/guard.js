// CEASER AI anti-clone guard (no dependencies). Raises the cost of copying; nothing can make a public website 100% uncopyable.
// 1) blocks scraper/downloader user agents (curl, wget, python, httrack...) except real search/ad crawlers
// 2) site assets (js/css/img/fonts) only load when requested by our own pages (same-origin / matching Referer)
// 3) per-IP rate limit on site files, so "wget -r" style mass downloads get cut off
// 4) hides private files that should never be public (.md .py .ts .map .zip .env .git ...)
const BOT_OK = /(googlebot|mediapartners-google|adsbot-google|google-adwords|apis-google|googleother|bingbot|duckduckbot|applebot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|slackbot)/i;
const BAD_UA = /(curl|wget|httpie|python|aiohttp|urllib|requests|scrapy|httrack|go-http|java\/|okhttp|libwww|perl|ruby|php|node-fetch|axios|got\b|undici|postman|insomnia|headless|phantom|selenium|puppeteer|playwright|crawler|spider|scraper|webcopy|teleport|offline|sitesucker|winhttrack|cyotek|aria2|lwp|mechanize|colly|nutch|harvest|grab|fetch)/i;
const PRIVATE = /(^|\/)\.|\.(md|py|ts|map|zip|sh|env|db|sqlite|log|bak|lock|yml|yaml)$|\/(package(-lock)?\.json|plan\.md|manus-routes\.json|serve\.py)$/i;
const ASSET = /\.(js|mjs|css|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|mp3|mp4|json)$/i;
const OPEN = new Set(['/ads.txt', '/robots.txt', '/sitemap.xml', '/favicon.png', '/apple-touch-icon.png']);
const hits = new Map(); // ip -> {n, t}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (now - v.t > 60000) hits.delete(k); }, 30000).unref();
const LIMIT = +process.env.GUARD_LIMIT_PER_MIN || 300;

module.exports = function guard(app) {
  if (process.env.GUARD_OFF === '1') return;
  app.use((req, res, next) => {
    const p = req.path;
    if (p.startsWith('/api/') || p === '/api') return next(); // the app's own API is protected elsewhere (login, CSRF, limits)
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (OPEN.has(p)) return next();
    const ua = String(req.headers['user-agent'] || '');
    const bot = BOT_OK.test(ua);
    if (!bot) {
      if (!ua || BAD_UA.test(ua)) return res.status(403).type('text/plain').send('Forbidden');
      if (PRIVATE.test(p)) return res.status(404).type('text/plain').send('Not found');
    } else if (PRIVATE.test(p)) return res.status(404).type('text/plain').send('Not found');
    if (!bot) {
      // rate limit per IP
      const ip = req.ip || 'x', now = Date.now();
      let h = hits.get(ip); if (!h || now - h.t > 60000) h = { n: 0, t: now };
      h.n++; hits.set(ip, h);
      if (h.n > LIMIT) { res.set('Retry-After', '60'); return res.status(429).type('text/plain').send('Too many requests'); }
      // assets must be requested by our own pages
      if (ASSET.test(p)) {
        const site = String(req.headers['sec-fetch-site'] || '');
        let refOk = false;
        try { refOk = new URL(req.headers.referer || '').host === req.get('host'); } catch (e) {}
        if (!(site === 'same-origin' || site === 'same-site' || refOk)) return res.status(403).type('text/plain').send('Forbidden');
      }
    }
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
};
