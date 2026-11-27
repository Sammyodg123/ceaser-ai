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
  anthropic:  { key: 'ANTHROPIC_API_KEY',  type: 'anthropic', label: 'Claude',        model: () => process.env.AI_MODEL || 'claude-sonnet-4-5' },
  manus:      { key: 'MANUS_API_KEY',      type: 'manus',     label: 'Manus',         model: () => 'manus-' + (process.env.MANUS_PROFILE || 'standard') },
  openai:     { key: 'OPENAI_API_KEY',     type: OA, label: 'OpenAI',        base: () => process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',            model: () => 'gpt-4o' },
  gemini:     { key: 'GEMINI_API_KEY',     type: OA, label: 'Gemini',        base: () => 'https://generativelanguage.googleapis.com/v1beta/openai',            model: () => 'gemini-2.0-flash' },
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
  ollama:     { key: 'OLLAMA_BASE_URL',    type: OA, label: 'Ollama (local)', noauth: true, base: () => process.env.OLLAMA_BASE_URL,                              model: () => 'llama3.2' },
  // FREE, no key needed (anonymous public API). Turn off with FREE_AI=off. Always last so it is only the Auto fallback when nothing else is set.
  pollinations: { key: null, always: true, free: true, noauth: true, type: OA, label: 'Free AI', base: () => process.env.FREE_BASE_URL || 'https://text.pollinations.ai/openai', model: () => process.env.FREE_MODEL || 'openai' },
  custom:     { key: 'CUSTOM_API_KEY',     type: OA, label: 'Custom',        base: () => process.env.CUSTOM_BASE_URL || '',                                    model: () => '' },
};
Object.keys(PROVIDERS).forEach((k) => { const P = PROVIDERS[k]; P.id = k; P.prefix = k === 'meta' ? 'LLAMA' : k === 'pollinations' ? 'FREE' : P.key.replace(/_(API_KEY|BASE_URL)$/, ''); });
const hasKey = (p) => { const P = PROVIDERS[p]; if (!P) return false; if (P.always) return String(process.env.FREE_AI || 'on').toLowerCase() !== 'off'; return !!process.env[P.key]; };
const extra = () => Math.max(1, Number(process.env.EXTRA_MODEL_COST) || 2);

// default model id(s) of a provider: <PREFIX>_MODELS="a,b,c"  or  <PREFIX>_MODEL=a  or built-in default
function idsOf(p) {
  const P = PROVIDERS[p], list = process.env[P.prefix + '_MODELS'], one = process.env[P.prefix + '_MODEL'];
  const ids = list ? list.split(',').map((x) => x.trim()).filter(Boolean) : [one || P.model()].filter(Boolean);
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
const list = () => {
  const ap = autoProvider(); if (!ap) return [];
  const autoModel = idsOf(ap)[0] || '';
  const auto = { id: 'auto', label: 'Auto', desc: 'Best available · normal token cost', provider: ap, cost: 1, model: autoModel };
  const rest = all().filter((m) => hasKey(m.provider) && !(m.provider === ap && m.id === autoModel));
  return [auto].concat(rest);
};
const pub = () => list().map(({ id, label, desc, cost }) => ({ id, label, desc: id === 'auto' ? desc : desc + ' · ' + (cost > 1 ? cost + '× tokens' : 'free / normal cost'), cost }));
function find(id) {
  const l = list(); if (!l.length) return null;
  const m = (id && l.find((x) => x.id === id)) || l[0];
  return m.id === 'auto' ? Object.assign({}, m, { id: m.model }) : m;
}
module.exports = { list, pub, find, PROVIDERS };
