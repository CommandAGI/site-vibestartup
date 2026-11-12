// The wizard's suggestions (lib/suggest.js): only a model reads the founder's idea. When the call is refused, errs,
// answers off-schema or is slow, the wizard gets the same neutral choices for every idea (every blueprint in the fixed
// order, no name, no tagline, no storefront pick), so nothing on that path parses the words.
//   node test/suggest.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { suggestFor, readSuggestions, neutralSuggestions, BLUEPRINTS, SUGGEST_SCHEMA } from '../lib/suggest.js';
import { defaultStorefront, TEMPLATES, STYLES } from '../lib/storefront-design.js';

let n = 0;
const ok = async (name, fn) => { await fn(); n++; console.log(`ok ${n} ${name}`); };
const strip = s => { const { failed, ...rest } = s; return rest; };

// Ideas that a keyword list would have told apart (a device, a service, a download, a maker, a club).
const IDEAS = [
  'A camera-enabled desk lamp that lets an assistant see your notebook',
  'A coaching and consultation booking page',
  'A digital product store for AI prompts and workflows',
  'Small-batch honey and candles from our farm',
  'A podcast membership club for fans',
];
const FAILURES = {
  refused: () => Promise.reject(Object.assign(new Error('Not enough credits for that.'), { code: 'insufficient_credits', status: 402 })),
  unreachable: () => Promise.reject(Object.assign(new Error('We could not reach CommandAGI.'), { code: 'unreachable', status: 0 })),
  slow: () => new Promise(() => {}),
  'not JSON': () => Promise.resolve({ text: 'Here are some ideas: Lampwise, Notebook Co.' }),
  'off schema': () => Promise.resolve({ text: JSON.stringify({ names: ['Lampwise'], blueprints: [{ id: 'hardware', why: 'x' }] }) }),
};

await ok('every failure gives the same neutral choices for every idea', async () => {
  const neutral = neutralSuggestions();
  assert.deepEqual(neutral.blueprints.map(b => b.id), ['digital', 'booking', 'preorder', 'waitlist', 'demo'], 'the fixed order');
  assert.deepEqual([neutral.names, neutral.tagline, neutral.product, neutral.template, neutral.style, neutral.by], [[], '', null, null, null, null]);
  for (const [what, request] of Object.entries(FAILURES)) for (const idea of IDEAS) {
    const s = await suggestFor(idea, request, { timeoutMs: 30 });
    assert.ok(s.failed, `${what}: says why`);
    assert.deepEqual(strip(s), neutral, `${what}: ${idea}`);
  }
});

await ok('the neutral storefront comes from the blueprint, the products and the vibe, not the idea', () => {
  for (const blueprint of [null, ...BLUEPRINTS]) {
    const picks = new Set(IDEAS.map(idea => JSON.stringify(defaultStorefront({ idea, tagline: idea, blueprint, vibe: 'clean', storefrontPick: null }, []))));
    assert.equal(picks.size, 1, `one pick for blueprint ${blueprint?.id}`);
  }
});

await ok('the idea goes to the model as the founder wrote it, with the schema of the answer', async () => {
  let sent;
  await suggestFor(`  ${IDEAS[0]}  `, (path, opts) => { sent = { path, ...opts }; return Promise.resolve({ text: '{}' }); });
  assert.equal(sent.path, '/models/call');
  assert.equal(sent.method, 'POST');
  assert.deepEqual(sent.body.messages, [{ role: 'user', content: IDEAS[0] }]);
  assert.deepEqual(sent.body.jsonSchema, { name: 'idea_suggestions', schema: SUGGEST_SCHEMA });
});

await ok("a model's answer: only known ids, every blueprint once (ranked first, the rest in order), names deduplicated", async () => {
  const answer = { names: ['Lumen Desk', 'lumen desk', '', 'Paperlight', 7], tagline: '  A lamp that sees your notes. ', blueprints: [{ id: 'demo', why: 'Hardware: show it first.' }, { id: 'hardware', why: 'x' }, { id: 'demo', why: 'again' }, { id: 'preorder', why: 'Sell the first batch.' }], product: { name: 'Notebook Lamp', about: 'A lamp with a camera.' }, template: 'launch', style: 'neon' };
  const s = await suggestFor(IDEAS[0], () => Promise.resolve({ text: JSON.stringify(answer), model: 'anthropic/claude-haiku-5-5' }));
  assert.equal(s.failed, undefined);
  assert.deepEqual(s.names, ['Lumen Desk', 'Paperlight']);
  assert.equal(s.tagline, 'A lamp that sees your notes.');
  assert.deepEqual(s.blueprints.map(b => b.id), ['demo', 'preorder', 'digital', 'booking', 'waitlist']);
  assert.equal(s.blueprints[0].why, 'Hardware: show it first.');
  assert.equal(s.blueprints[2].why, undefined);
  assert.deepEqual([s.template, s.style], ['launch', null], 'an unknown style is dropped');
  assert.equal(readSuggestions('{"blueprints":[]}'), null, 'no known blueprint is no answer');
  assert.ok(SUGGEST_SCHEMA.properties.template.enum.every(id => TEMPLATES.some(t => t.id === id)));
  assert.ok(SUGGEST_SCHEMA.properties.style.enum.every(id => STYLES.some(t => t.id === id)));
});

await ok('no keyword reader is left: the wizard, the landing and the business module read the idea through no function of words', () => {
  const src = f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  for (const f of ['lib/business.js', 'start/start.js', 'landing.js', 'lib/suggest.js'])
    for (const gone of ['suggestNames', 'suggestTagline', 'suggestProduct', 'suggestBlueprints'])
      assert.ok(!src(f).includes(gone), `${f} still names ${gone}`);
  const fn = src('lib/storefront-design.js').match(/export function defaultStorefront[\s\S]*?\n}\n/)[0];
  assert.ok(!/idea|tagline|\.test\(/.test(fn), 'defaultStorefront reads neither the idea nor the tagline');
});

console.log(`\n${n} passed`);
