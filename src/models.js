// ============================================================================
// Models shown in the chat's "Choose model" picker. Everything is driven by .env
//
//  1. Put the API key of every provider you want in .env  (see PROVIDERS below).
//  2. Optional: several models per provider ->  OPENAI_MODELS="gpt-4o,gpt-4o-mini,o3-mini"
//  3. Optional: full control ->  AI_MODELS="id|Label|Description|provider|costMultiplier;..."
//
//  "Auto" (default) uses AUTO_PROVIDER (default: manus) at normal cost.
//  Every other model costs EXTRA_MODEL_COST x tokens (default 2).
//  Providers without a key are hidden. Restart the server after editing .env.
// ============================================================================
const OA = 'openai'; // OpenAI-compatible "chat/completions" protocol
const PROVIDERS = {
  anthropic:  { key: 'ANTHROPIC_API_KEY',  type: 'anthropic', vision: true, label: 'Claude',        model: () => process.env.AI_MODEL || 'claude-sonnet-4-5' },
  manus:      { key: 'MANUS_API_KEY',      type: 'manus',     label: 'Manus',         model: () => 'manus-' + (process.env.MANUS_PROFILE || 'standard') },
  openai:     { key: 'OPENAI_API_KEY',     type: OA, vision: true, label: 'OpenAI',        base: () => process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',            model: () => 'gpt-4o' },
  gemini:     { key: 'GEMINI_API_KEY',     type: OA, vision: true, label: 'Gemini',        base: () => 'https://generativelanguage.googleapis.com/v1beta/openai',            model: () => 'gemini-2.5-flash', hdr: (k) => ({ 'x-goog-api-key': k }) },
  meta:       { key: 'LLAMA_API_KEY',      type: OA, label: 'Meta Llama',    base: () => process.env.LLAMA_BASE_URL || 'https://api.llama.com/compat/v1',       model: () => 'Llama-4-Maverick-17B-128E-Instruct-FP8' },
  mistral:    { key: 'MISTRAL_API_KEY',    type: OA, label: 'Mistral',       base: () => 'https://api.mistral.ai/v1',                                          model: () => 'mistral-large-latest' },
  xai:        { key: 'XAI_API_KEY',        type: OA, label: 'Grok (xAI)',    base: () => 'https://api.x.ai/v1',                                                model: () => 'grok-3' },
  deepseek:   { key: 'DEEPSEEK_API_KEY',   type: OA, label: 'DeepSeek',      base: () => 'https://api.deepseek.com/v1',                                        model: () => 'deepseek-chat' },
  groq:       { key: 'GROQ_API_KEY',       type: OA, label: 'Groq',          base: () => 'https://api.groq.com/openai/v1',                                     model: () => 'llama-3.3-70b-versatile' },
  together:   { key: 'TOGETHER_API_KEY',   type: OA, label: 'Together',      base: () => 'https://api.together.xyz/v1',                                        model: () => 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  fireworks:  { key: 'FIREWORKS_API_KEY',  type: OA, label: 'Fireworks',     base: () => 'https://api.fireworks.ai/inference/v1',                              model: () => 'accounts/fireworks/models/llama-v3p3-70b-instruct' },
  cerebras:   { key: 'CEREBRAS_API_KEY',   type: OA, label: 'Cerebras',      base: () => 'https://api.cerebras.ai/v1',                                         model: () => 'llama-3.3-70b' },
  nvidia:     { key: 'NVIDIA_API_KEY',     type: OA, label: 'NVIDIA',        base: () => 'https://integrate.api.nvidia.com/v1',                                model: () => 'meta/llama-3.3-70b-instruct' },
  perplexity: { key: 'PERPLEXITY_API_KEY', type: OA, label: 'Perplexity',    base: () => 'https://api.perplexity.ai',                                          model: () => 'sonar' },
  openrouter: { key: 'OPENROUTER_API_KEY', type: OA, label: 'OpenRouter',    base: () => 'https://openrouter.ai/api/v1',                                       model: () => 'meta-llama/llama-3.3-70b-instruct:free' },
  venice:     { key: 'VENICE_API_KEY',     type: OA, label: 'Venice AI',     base: () => process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1',        model: () => process.env.VENICE_MODEL || 'llama-3.3-70b', vision: true },
  ollama:     { key: 'OLLAMA_BASE_URL',    type: OA, label: 'Ollama (local)', noauth: true, base: () => process.env.OLLAMA_BASE_URL,                              model: () => 'llama3.2' },
  // FREE, no key needed (anonymous public API). Turn off with FREE_AI=off. Always last so it is only the Auto fallback when nothing else is set.
  pollinations: { key: null, always: true, free: true, noauth: true, vision: true, type: OA, label: 'Free AI', base: () => process.env.FREE_BASE_URL || 'https://text.pollinations.ai/openai', model: () => process.env.FREE_MODEL || 'openai' },
  // Optional free engines from api.omegatech.app (unofficial, may be slow or change). Turn on with OMEGA_AI=on in Admin.
  omega:      { key: 'OMEGA_AI', type: 'omega', free: true, label: 'Omega', model: () => 'Qwen3-coder' },
  custom:     { key: 'CUSTOM_API_KEY',     type: OA, label: 'Custom',        base: () => process.env.CUSTOM_BASE_URL || '',                                    model: () => '' },
};
Object.keys(PROVIDERS).forEach((k) => { const P = PROVIDERS[k]; P.id = k; P.prefix = k === 'meta' ? 'LLAMA' : k === 'pollinations' ? 'FREE' : k === 'omega' ? 'OMEGA' : P.key.replace(/_(API_KEY|BASE_URL)$/, ''); });
// keys pasted into dashboards often carry quotes, spaces or a trailing newline: strip them so the provider does not answer 401
const clean = (v) => String(v == null ? '' : v).trim().replace(/^["']|["']$/g, '').trim();
const keyOf = (P) => (P && P.key ? clean(process.env[P.key]) : '');
const hasKey = (p) => { const P = PROVIDERS[p]; if (!P) return false; if (p === 'omega') return /^(on|1|true|yes)$/i.test(clean(process.env.OMEGA_AI)); if (P.always) return String(process.env.FREE_AI || 'on').toLowerCase() !== 'off'; return !!keyOf(P); };
// ---- dynamic model discovery: providers retire models often (Groq/Gemini/NVIDIA all 404/410 on old names), so ask the provider what it has ----
const found = {}, cooled = {};
const BADM = /embed|whisper|tts|guard|moderat|rerank|image|audio|safety|orpheus|transcri|dall|clip|ocr|parse|retriev|vision-preview|imagen|veo|live|robotics|aqa|learnlm|gemma-?\d*n?-?it?$/i;
const PREFS = {
  groq: [/llama-3\.3-70b/, /llama-?4/, /gpt-oss-120b/, /llama-3\.1-8b/, /qwen/, /./],
  gemini: [/^gemini-[\d.]+-flash$/, /^gemini-[\d.]+-flash-(?!lite)/, /flash/, /^gemini-[\d.]+-pro$/, /./],
  nvidia: [/llama-3\.3-70b/, /llama-?4/, /llama-3\.1-70b/, /nemotron.*(70b|super)/, /llama-3\.1-8b/, /instruct/, /./],
  venice: [/llama-3\.3-70b/, /llama/, /./],
};
const verKey = (x) => (x.match(/\d+(\.\d+)?/g) || ['0']).map(Number);
const newer = (a, b) => { const A = verKey(a), B = verKey(b); for (let i = 0; i < Math.max(A.length, B.length); i++) { if ((B[i] || 0) !== (A[i] || 0)) return (B[i] || 0) - (A[i] || 0); } return a.length - b.length; };
async function discover(p) {
  const P = PROVIDERS[p]; if (!P || P.type !== 'openai' || !P.base) return null;
  const base = (P.base() || '').replace(/\/$/, ''); if (!base) return null;
  const k = keyOf(P);
  const r = await fetch(base + '/models', { signal: AbortSignal.timeout(12000), headers: Object.assign(P.noauth ? {} : { authorization: 'Bearer ' + k }, P.hdr && k ? P.hdr(k) : {}) });
  if (!r.ok) return null;
  const j = await r.json().catch(() => ({}));
  const ids = (j.data || j.models || []).map((m) => String(m.id || m.name || '').replace(/^models\//, '')).filter((x) => x && !BADM.test(x));
  if (!ids.length) return null;
  for (const re of (PREFS[p] || [/./])) { const hit = ids.filter((x) => re.test(x)).sort(newer); if (hit.length) { found[p] = hit[0]; return hit[0]; } }
  return null;
}
// the model to actually call: a model found by discovery wins over the built-in default (but never over one you set in .env)
const modelFor = (p, wanted) => { const P = PROVIDERS[p]; return P && (process.env[P.prefix + '_MODEL'] || process.env[P.prefix + '_MODELS']) ? wanted : (found[p] || wanted); };
const reset = () => { Object.keys(found).forEach((k) => delete found[k]); Object.keys(cooled).forEach((k) => delete cooled[k]); };
let lastGood = ''; const good = (p) => { lastGood = p; delete cooled[p]; };
const cool = (p, ms) => { cooled[p] = Date.now() + (ms || 10 * 60 * 1000); };
const isCooled = (p) => cooled[p] > Date.now();
const extra = () => Math.max(1, Number(process.env.EXTRA_MODEL_COST) || 2);

// default model id(s) of a provider: <PREFIX>_MODELS="a,b,c"  or  <PREFIX>_MODEL=a  or built-in default
function idsOf(p) {
  const P = PROVIDERS[p], list = process.env[P.prefix + '_MODELS'], one = process.env[P.prefix + '_MODEL'];
  const ids = p === 'omega' && !list ? ['WormGPT', 'Qwen3-coder', 'Qwen', 'Claude', 'Chatai', 'Chatbot', 'llamacoder'] : list ? list.split(',').map((x) => x.trim()).filter(Boolean) : [one || P.model()].filter(Boolean);
  return ids;
}
function all() {
  const out = [];
  if (process.env.AI_MODELS) {
    process.env.AI_MODELS.split(';').map((x) => x.trim()).filter(Boolean).forEach((x) => {
      const [id, label, desc, prov, cost] = x.split('|').map((s) => (s || '').trim());
      out.push({ id, label: label || id, desc: desc || id, provider: PROVIDERS[prov] ? prov : 'anthropic', cost: Number(cost) || extra() });
    });
    return out;
  }
  Object.keys(PROVIDERS).forEach((p) => {
    if (!hasKey(p)) return;
    const ids = idsOf(p);
    ids.forEach((id) => out.push({ id, label: ids.length > 1 ? PROVIDERS[p].label + ' · ' + id.split('/').pop() : PROVIDERS[p].label, desc: id, provider: p, cost: PROVIDERS[p].free ? 1 : extra() }));
  });
  return out;
}
function autoProvider() {
  const want = (process.env.AUTO_PROVIDER || 'manus').toLowerCase();
  if (hasKey(want)) return want;
  return Object.keys(PROVIDERS).find(hasKey) || null; // no keys at all -> the free public AI keeps the app working
}
// ---------------------------------------------------------------------------
// SMART AUTO ROUTING  (what "Auto" does for every message)
//   build  = websites / apps / bots / projects  -> WEBSITE_PROVIDERS   (default: manus, anthropic)
//   code   = snippets, bugs, scripts, questions -> CODE_PROVIDERS      (default: anthropic, manus)
//   chat   = everything else                    -> CHAT_PROVIDERS      (default: every keyed provider, rotated so no single API is drained)
//   Anything not listed is still used as a fallback, and the free AI is always last.
//   If a provider fails before it wrote anything, the next one in the chain answers instead.
// ---------------------------------------------------------------------------
const BUILD_RE = /\b(web ?sites?|web ?pages?|landing ?page|portfolio|dashboard|html|full (?:app|stack)|mobile app|web ?app|whatsapp bot|telegram bot|discord bot|\bbot\b|project|e-?commerce|clone|ui\b|frontend|front-end|backend|multi-?file|index\.html|zip)\b/i;
const CODE_RE = /\b(code|coding|script|function|bug|debug|error|exception|stack ?trace|regex|sql|query|api|endpoint|json|css|javascript|typescript|node(?:js)?|python|react|vue|java|php|golang|rust|bash|shell|docker|git|npm|compile|refactor|algorithm|program|component|class|variable|loop|deploy|baileys|pterodactyl)\b|```|<<<FILE /i;
function intent(text) {
  const t = String(text || '');
  if (/^\s*(create|build|make|generate|design|write|code)\b[^\n]{0,40}\b(web ?site|web ?page|landing|portfolio|dashboard|app|bot|store|game)\b/i.test(t) || (BUILD_RE.test(t) && /\b(create|build|make|generate|design|develop|write)\b/i.test(t)) || t.length > 900 && CODE_RE.test(t)) return 'build';
  if (CODE_RE.test(t)) return 'code';
  return 'chat';
}
const envList = (k, d) => String(process.env[k] || d || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
let rr = 0;
// This is a style/provider classifier, not a safety bypass. Direct mode may be
// blunt, but the application still keeps its normal refusal and abuse handling.
function categoryOf(text, tone) {
  const t = String(text || '');
  return tone === 'blunt' || /\b(uncensored|unfiltered|no filter|brutal(?:ly)? honest|roast|swear|curse|harsh|edgy)\b/i.test(t) ? 'uncensored' : 'censored';
}
function chainFor(kind, vision, category) {
  const ok = (p) => PROVIDERS[p] && hasKey(p) && !isCooled(p) && (!vision || PROVIDERS[p].vision);
  const keyed = Object.keys(PROVIDERS).filter((p) => ok(p) && !PROVIDERS[p].free && p !== 'custom');
  let pref;
  if (kind === 'build') pref = envList('WEBSITE_PROVIDERS', 'manus,anthropic');
  else if (kind === 'code') pref = envList('CODE_PROVIDERS', 'anthropic,manus');
  else {
    pref = envList('CHAT_PROVIDERS', '').length ? envList('CHAT_PROVIDERS') : keyed.filter((p) => p !== 'manus');
    pref = pref.filter((p) => !isCooled(p)).concat(pref.filter(isCooled));
    if (lastGood && pref.indexOf(lastGood) > 0) pref = [lastGood].concat(pref.filter((p) => p !== lastGood)); // stick with the engine that last worked: steady, no random failures
  }
  const out = [];
  const add = (p) => { if (ok(p) && out.indexOf(p) < 0) out.push(p); };
  if (hasKey('omega')) {
    const omegaIds = idsOf('omega').map((x) => x.toLowerCase());
    const preferred = category === 'uncensored' ? ['wormgpt', 'llamacoder', 'qwen3-coder'] : ['qwen', 'chatai', 'chatbot', 'claude'];
    if (preferred.some((x) => omegaIds.includes(x))) add('omega');
  }
  pref.forEach(add);
  keyed.filter((p) => p !== 'manus' || kind !== 'chat').forEach(add);
  add('custom'); add('pollinations'); // free AI is always the last resort
  return out;
}
// plan(requestedModelId, lastUserText, hasImage) -> { kind, auto, chain:[{provider,model,cost,label}] }
function plan(reqId, text, hasImage, tone) {
  const l = list(); if (!l.length) return null;
  const pickedId = reqId && reqId !== 'auto' && l.some((x) => x.id === reqId) ? reqId : (reqId ? null : 'auto');
  if (pickedId && pickedId !== 'auto') {
    const m = l.find((x) => x.id === pickedId);
    return { kind: intent(text), category: categoryOf(text, tone), auto: false, chain: [{ provider: m.provider, model: m.id, cost: m.cost || 1, label: PROVIDERS[m.provider].label }] };
  }
  const kind = intent(text);
  const category = categoryOf(text, tone);
  const chain = chainFor(kind, hasImage, category).map((p) => ({ provider: p, model: p === 'omega' ? (category === 'uncensored' ? 'WormGPT' : 'Qwen') : (idsOf(p)[0] || ''), cost: 1, label: PROVIDERS[p].label }));
  if (!chain.length) { const f = find(reqId); return f ? { kind, category, auto: true, chain: [{ provider: f.provider, model: f.id, cost: f.cost || 1, label: PROVIDERS[f.provider].label }] } : null; }
  return { kind, category, auto: true, chain };
}
const list = () => {
  const ap = autoProvider(); if (!ap) return [];
  const autoModel = idsOf(ap)[0] || '';
  const auto = { id: 'auto', label: 'Auto', desc: 'Automatically classifies censored/direct style and picks the matching engine', provider: ap, cost: 1, model: autoModel };
  const rest = all().filter((m) => hasKey(m.provider) && !(m.provider === ap && m.id === autoModel));
  return [auto].concat(rest);
};
const pub = () => list().map(({ id, label, desc, cost, provider }) => ({ id, label, desc: id === 'auto' ? desc : desc + ' · ' + (cost > 1 ? cost + '× tokens' : 'free / normal cost'), cost, group: id === 'auto' ? 'Smart' : (PROVIDERS[provider] ? PROVIDERS[provider].label : 'Other') }));
function find(id) {
  const l = list(); if (!l.length) return null;
  const m = (id && l.find((x) => x.id === id)) || l[0];
  return m.id === 'auto' ? Object.assign({}, m, { id: m.model }) : m;
}
module.exports = { list, pub, find, plan, intent, categoryOf, PROVIDERS, keyOf, hasKey, idsOf, discover, modelFor, cool, reset, good };
