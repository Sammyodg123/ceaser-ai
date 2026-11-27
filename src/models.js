// Models shown in the chat page's "Choose model" picker.
// Override in .env: AI_MODELS="id|Label|Description;id2|Label2|Description2"
const def = process.env.AI_MODEL || 'claude-sonnet-4-5';
const MODELS = process.env.AI_MODELS
  ? process.env.AI_MODELS.split(';').map((x) => x.trim()).filter(Boolean).map((x) => { const [id, label, desc] = x.split('|'); return { id: id.trim(), label: (label || id).trim(), desc: (desc || '').trim() }; })
  : [{ id: def, label: 'CEASER Default', desc: 'Balanced speed and quality' }];
module.exports = { MODELS };
