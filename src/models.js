// Models shown in the chat page's "Choose model" picker. Everything is driven by .env.
//
// Option A (simple): just set the API keys you have. Models are built automatically:
//   ANTHROPIC_API_KEY, MANUS_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY,
//   GROQ_API_KEY, OPENROUTER_API_KEY, CUSTOM_API_KEY (+ CUSTOM_BASE_URL)
//
// Option B (full control): AI_MODELS="id|Label|Description|provider;id2|Label2|Description2|provider2"
//   provider = anthropic | manus | openai | gemini | deepseek | groq | openrouter | custom
//   e.g. AI_MODELS="claude-sonnet-4-5|Claude Sonnet|Balanced|anthropic;gpt-4o|GPT-4o|Fast all-rounder|openai"
//
// Only models whose provider has a key are shown to users.
const PROVIDERS = {
  anthropic:  { key: 'ANTHROPIC_API_KEY',  type: 'anthropic', label: 'Claude',   model: () => process.env.AI_MODEL || 'claude-sonnet-4-5' },
  manus:      { key: 'MANUS_API_KEY',      type: 'manus',     label: 'Manus',    model: () => 'manus-' + (process.env.MANUS_PROFILE || 'standard') },
  openai:     { key: 'OPENAI_API_KEY',     type: 'openai',    label: 'OpenAI',   base: () => process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',                       model: () => process.env.OPENAI_MODEL || 'gpt-4o' },
  gemini:     { key: 'GEMINI_API_KEY',     type: 'openai',    label: 'Gemini',   base: () => 'https://generativelanguage.googleapis.com/v1beta/openai',                        model: () => process.env.GEMINI_MODEL || 'gemini-2.0-flash' },
  deepseek:   { key: 'DEEPSEEK_API_KEY',   type: 'openai',    label: 'DeepSeek', base: () => 'https://api.deepseek.com/v1',                                                    model: () => process.env.DEEPSEEK_MODEL || 'deepseek-chat' },
  groq:       { key: 'GROQ_API_KEY',       type: 'openai',    label: 'Groq',     base: () => 'https://api.groq.com/openai/v1',                                                 model: () => process.env.GROQ_MODEL || 'llama-3.3-70b-versatile' },
  openrouter: { key: 'OPENROUTER_API_KEY', type: 'openai',    label: 'OpenRouter', base: () => 'https://openrouter.ai/api/v1',                                                 model: () => process.env.OPENROUTER_MODEL || 'openai/gpt-4o' },
  custom:     { key: 'CUSTOM_API_KEY',     type: 'openai',    label: 'Custom',   base: () => process.env.CUSTOM_BASE_URL || '',                                                model: () => process.env.CUSTOM_MODEL || '' },
};
const hasKey = (p) => !!(PROVIDERS[p] && process.env[PROVIDERS[p].key]);

// AUTO uses AUTO_PROVIDER (default: manus). Picking any other model costs EXTRA_MODEL_COST x tokens (default 2).
const extra = () => Math.max(1, Number(process.env.EXTRA_MODEL_COST) || 2);
function all() {
  const custom = [];
  if (process.env.AI_MODELS) {
    process.env.AI_MODELS.split(';').map((x) => x.trim()).filter(Boolean).forEach((x) => {
      const [id, label, desc, prov, cost] = x.split('|').map((s) => (s || '').trim());
      custom.push({ id, label: label || id, desc: desc || '', provider: PROVIDERS[prov] ? prov : 'anthropic', cost: Number(cost) || extra() });
    });
  } else {
    Object.keys(PROVIDERS).forEach((p) => {
      if (!hasKey(p)) return;
      const id = PROVIDERS[p].model(); if (!id) return;
      custom.push({ id, label: PROVIDERS[p].label, desc: id, provider: p, cost: extra() });
    });
  }
  return custom;
}
function autoProvider() {
  const want = (process.env.AUTO_PROVIDER || 'manus').toLowerCase();
  if (hasKey(want)) return want;
  const any = Object.keys(PROVIDERS).find(hasKey); return any || null;
}
// Re-read on every call so editing .env + restart is all that's needed.
const list = () => {
  const ap = autoProvider(); if (!ap) return [];
  const am = all().find((m) => m.provider === ap);
  const auto = { id: 'auto', label: 'Auto', desc: 'Best available · normal token cost', provider: ap, cost: 1, model: ap === 'manus' || !am ? PROVIDERS[ap].model() : am.id };
  return [auto].concat(all().filter((m) => hasKey(m.provider) && m.provider !== ap || (m.provider === ap && am && m.id !== am.id)));
};
function find(id) {
  const l = list(); if (!l.length) return null;
  const m = (id && l.find((x) => x.id === id)) || l[0];
  return m.id === 'auto' ? Object.assign({}, m, { id: m.model }) : m;
}
const pub = () => list().map(({ id, label, desc, cost }) => ({ id, label, desc: id === 'auto' ? desc : (desc ? desc + ' · ' : '') + (cost > 1 ? cost + '× tokens' : 'normal cost'), cost }));
module.exports = { list, pub, find, PROVIDERS };
