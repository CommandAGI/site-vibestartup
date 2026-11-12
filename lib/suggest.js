// The wizard's suggestions for a founder's idea: one structured model call through CommandAGI (`POST /models/call`
// with a JSON schema), on the founder's own token. Free text is understood by a model, never by keyword lists or
// regular expressions (CommandAGI AGENTS.md). When the call fails or is slow, the wizard gets neutral defaults: every
// blueprint in a fixed order, no names, no tagline, and the storefront from the chosen blueprint and the products.
// This module is pure: the caller hands it the request function (lib/api.js `api`), so a plain node test loads it.
import { TEMPLATES, STYLES } from './storefront-design.js';

/** The first version's shapes, in the fixed order the wizard lists them when no model ranked them. */
export const BLUEPRINTS = [
  { id: 'digital', title: 'One digital product, sold now', about: 'A single download with a checkout; more products once the first one sells.' },
  { id: 'booking', title: 'A booking page with one package', about: 'One clear offer, a price, a calendar: the fastest way to a first paying client.' },
  { id: 'preorder', title: 'A pre-order storefront', about: 'Sell the first batch before it exists; make only what sold.' },
  { id: 'waitlist', title: 'Landing page and waitlist', about: 'Say what it is, collect emails, launch to the list.' },
  { id: 'demo', title: 'Public demo and waitlist', about: 'A demo and a waitlist test demand before anything is made.' },
];

// The fastest cheap model of the platform's catalog that answers this schema well: Claude Haiku 5.5 at low effort.
// Production, 2026-11-12: about 2 s on the model (docs/ARCHITECTURE.md § the wizard's suggestions has the numbers and
// the models it was measured against).
export const SUGGEST_MODEL = 'anthropic/claude-haiku-5-5';
export const SUGGEST_EFFORT = 'low';
/** Past this the wizard stops waiting and shows the neutral defaults; a late answer is dropped. */
export const SUGGEST_TIMEOUT_MS = 6000;

const ids = list => list.map(x => x.id);
export const SUGGEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['names', 'tagline', 'blueprints', 'product', 'template', 'style'],
  properties: {
    names: { type: 'array', items: { type: 'string' }, description: 'Four short brand names for the business.' },
    tagline: { type: 'string', description: 'One line for the storefront, at most 10 words.' },
    blueprints: {
      type: 'array',
      description: 'Every blueprint id, best fit first, each with a one-line reason for this idea.',
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'why'],
        properties: { id: { type: 'string', enum: ids(BLUEPRINTS) }, why: { type: 'string' } },
      },
    },
    product: {
      type: 'object', additionalProperties: false, required: ['name', 'about'],
      properties: { name: { type: 'string' }, about: { type: 'string' } },
      description: 'The first product to sell: a short name and one line on what it is.',
    },
    template: { type: 'string', enum: ids(TEMPLATES) },
    style: { type: 'string', enum: ids(STYLES) },
  },
};

export const SUGGEST_INSTRUCTIONS = `You help a founder start a small business on VibeStartup. The user message is the founder's idea, in their own words. Answer with one JSON object of the given schema and nothing else.
- names: four short, distinct brand names that fit the idea. No "Inc", no domain endings.
- tagline: one plain line a customer reads on the storefront, at most 10 words.
- blueprints: all five ids, best fit for a first version first. "why" says in at most 12 words why it fits this idea.
${BLUEPRINTS.map(b => `  - ${b.id}: ${b.title}. ${b.about}`).join('\n')}
- product: the first thing to sell: a name of two to five words, and "about" in at most 12 words.
- template: the storefront's layout, one of: ${TEMPLATES.map(t => `${t.id} (${t.about})`).join(' ')}
- style: the storefront's look, one of: ${STYLES.map(s => `${s.id} (${s.about})`).join(' ')}
If the idea is unclear, still answer with your best fit.`;

const line = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/**
 * The wizard's suggestions from a model's answer: only known ids, every blueprint once (ranked ones first, the rest in
 * the fixed order), names deduplicated. `null` when the answer is not an object of the schema's shape.
 */
export function readSuggestions(raw) {
  let doc = raw;
  if (typeof raw === 'string') { try { doc = JSON.parse(raw); } catch { return null; } }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || !Array.isArray(doc.blueprints)) return null;
  const seen = new Set();
  const names = (Array.isArray(doc.names) ? doc.names : []).map(n => line(n, 40)).filter(n => n && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase())).slice(0, 5);
  const why = new Map();
  for (const b of doc.blueprints) if (b && BLUEPRINTS.some(x => x.id === b.id) && !why.has(b.id)) why.set(b.id, line(b.why, 160));
  if (!why.size) return null;
  const blueprints = [...why.keys(), ...ids(BLUEPRINTS).filter(id => !why.has(id))]
    .map(id => ({ ...BLUEPRINTS.find(b => b.id === id), ...(why.get(id) ? { why: why.get(id) } : {}) }));
  const product = doc.product && typeof doc.product === 'object' && line(doc.product.name, 60) ? { name: line(doc.product.name, 60), about: line(doc.product.about, 200) } : null;
  return {
    by: 'model',
    names,
    tagline: line(doc.tagline, 120),
    blueprints,
    product,
    template: TEMPLATES.some(t => t.id === doc.template) ? doc.template : null,
    style: STYLES.some(s => s.id === doc.style) ? doc.style : null,
  };
}

/** What the wizard shows with no model's answer: nothing read from the idea. */
export const neutralSuggestions = () => ({ by: null, names: [], tagline: '', blueprints: BLUEPRINTS.map(b => ({ ...b })), product: null, template: null, style: null });

/**
 * One model call for the idea. `request(path, opts)` is lib/api.js `api`. Answers the suggestions, or the neutral
 * defaults (with `failed`: why) when the call is refused, errs, answers off-schema or takes longer than `timeoutMs`.
 */
export async function suggestFor(idea, request, { timeoutMs = SUGGEST_TIMEOUT_MS } = {}) {
  const text = String(idea ?? '').trim().slice(0, 240);
  if (!text) return { ...neutralSuggestions(), failed: 'no idea' };
  const t0 = Date.now();
  let timer;
  const late = new Promise(resolve => { timer = setTimeout(() => resolve({ timeout: true }), timeoutMs); });
  try {
    const call = request('/models/call', {
      method: 'POST',
      body: {
        model: SUGGEST_MODEL, effort: SUGGEST_EFFORT, instructions: SUGGEST_INSTRUCTIONS,
        messages: [{ role: 'user', content: text }],
        jsonSchema: { name: 'idea_suggestions', schema: SUGGEST_SCHEMA },
        maxTokens: 900,
        configuration: { harness: 'vibestartup.suggest' },
      },
    }).then(answer => ({ answer }), error => ({ error }));
    const out = await Promise.race([call, late]);
    if (out.timeout) return { ...neutralSuggestions(), failed: `no answer in ${timeoutMs} ms` };
    if (out.error) return { ...neutralSuggestions(), failed: out.error.code ?? out.error.message ?? 'refused' };
    const read = readSuggestions(out.answer?.text);
    if (!read) return { ...neutralSuggestions(), failed: 'the answer was not the schema' };
    return { ...read, ms: Date.now() - t0, model: out.answer.model ?? SUGGEST_MODEL };
  } finally { clearTimeout(timer); }
}
