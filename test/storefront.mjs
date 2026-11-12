// The storefront's templates and styles: every template with every style renders the same business, and each result
// keeps the checkout's hooks, the sign-up form, the legal links, a sound structure and no leftover placeholder.
//   node test/storefront.mjs
import assert from 'node:assert/strict';

// lib/api.js reads the page's brand and address when it loads; a storefront's files need neither.
globalThis.window = {}; globalThis.location = { search: '' };
const { storefrontFiles, storefrontPreview } = await import('../lib/storefront.js');
const { brandFor, storefrontRule } = await import('../lib/business.js');
const { BLUEPRINTS } = await import('../lib/suggest.js');
const { TEMPLATES, STYLES, defaultStorefront, newStorefrontSource, readStorefrontSource, sourceMark, palette, contrast } = await import('../lib/storefront-design.js');

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log(`ok ${n} ${name}`); };

const business = (vibe = 'clean') => ({ slug: 'harbour', name: 'Harbour & Co', idea: 'Small-batch ceramics for slow mornings', tagline: 'Mugs that make the morning.', vibe, brand: brandFor('Harbour & Co', vibe), email: { address: 'harbour@commandagi.email' }, site: { id: 's1', folder: 'Sites/harbour', url: 'https://harbour.commandagi.app', brandUrl: 'https://harbour.vibestartup.pro' } });
const made = base => ({ base, width: 1600, height: 1200, files: [480, 960, 1600].map(w => ({ name: `${base}-${w}.webp`, w })) });
const FIXTURES = {
  digital: { products: [{ id: 'prompt-pack', name: 'The Solo Operator Prompt Pack', description: '120 prompts for the work a solo founder does every week.', priceLabel: '$19', status: 'active', type: 'digital', goodKind: 'digital', goodStatus: 'active', variantId: 'var_1' }], images: new Map(), opts: { store: true, guestDigital: true } },
  physical: {
    products: [
      { id: 'harbour-mug', name: 'Harbour Mug', description: 'Stoneware, 12 oz, glazed in sea green.', priceLabel: '$34', status: 'active', type: 'physical', goodKind: 'physical', goodStatus: 'active', variantId: 'var_2' },
      { id: 'tide-bowl', name: 'Tide Bowl', description: '', priceLabel: '$48', status: 'active', type: 'physical', goodKind: 'physical', goodStatus: 'active', variantId: 'var_3' },
      { id: 'studio-club', name: 'Studio Club', description: 'A new piece every month.', priceLabel: '$25', recurring: true, interval: 'month', status: 'active', type: 'physical' },
      { id: 'kiln-notes', name: 'Kiln Notes <b>zine</b>', description: 'No picture, ordered by email.', priceLabel: '$8', status: 'active', type: 'physical' },
      { id: 'retired-vase', name: 'Retired Vase', priceLabel: '$90', status: 'draft', type: 'physical' },
    ],
    images: new Map([['harbour-mug', [made('harbour-mug-1'), made('harbour-mug-2')]], ['tide-bowl', [made('tide-bowl-1')]]]),
    opts: { store: true, guestDigital: false },
  },
  none: { products: [], images: new Map(), opts: {} },
};
const WORDS = {
  announcement: 'Free shipping this week', kicker: 'Made in Maine', headline: 'Slow mornings start here', subhead: 'Stoneware thrown by hand <script>alert(1)</script>', cta: 'See the kiln',
  productsTitle: 'From the kiln', about: { title: 'Our studio', text: 'We are two potters.\n\nEvery piece is thrown by hand.' },
  points: [{ title: 'Dishwasher safe', text: 'Every glaze is food safe.' }], faq: [{ q: 'Do you ship abroad?', a: 'Not yet.' }], testimonials: [{ quote: 'My favourite mug.', name: 'Ada' }],
};

const VOID = new Set(['meta', 'link', 'img', 'input', 'br', 'hr', 'base']);
/** Every tag that opens closes, in order; every id is used once. Answers the page without its scripts. */
function sound(html, what) {
  assert.match(html, /^<!doctype html><html lang="en">/, `${what}: starts as a document`);
  const text = html.replace(/<script>[\s\S]*?<\/script>/g, '');
  const stack = [];
  for (const m of text.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*>/g)) {
    if (VOID.has(m[2])) continue;
    if (!m[1]) stack.push(m[2]);
    else assert.equal(stack.pop(), m[2], `${what}: </${m[2]}> closes what was opened`);
  }
  assert.deepEqual(stack, [], `${what}: every tag closes`);
  const ids = [...text.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, `${what}: an id is used once (${ids})`);
  assert.doesNotMatch(text, /undefined|\bNaN\b|\[object |\$\{|>null<|"null"/, `${what}: no leftover placeholder`);
  return text;
}

for (const t of TEMPLATES) for (const s of STYLES) {
  ok(`${t.id} × ${s.id}: every fixture keeps the checkout, the sign-ups and the legal pages`, () => {
    for (const [name, fx] of Object.entries(FIXTURES)) for (const copy of [undefined, WORDS]) {
      const what = `${t.id} × ${s.id} × ${name}${copy ? ' with words' : ''}`;
      const files = storefrontFiles(business(), fx.products, { storefront: { template: t.id, style: s.id, copy }, images: fx.images, ...fx.opts });
      const index = sound(files['index.html'], what);
      assert.equal(index.match(/<h1[\s>]/g)?.length, 1, `${what}: one h1`);
      assert.match(index, new RegExp(`<body data-template="${t.id}" data-style="${s.id}">`));
      // the sign-ups
      assert.equal(index.match(/<form id="signup"/g)?.length, 1, `${what}: one sign-up form`);
      for (const field of ['name="email"', 'name="name"', 'name="consent"', 'name="website"']) assert.ok(index.includes(field), `${what}: ${field}`);
      assert.match(index, /<section class="updates" id="updates"[\s\S]*<p class="said" role="status" hidden><\/p><\/section>/);
      assert.match(index, /Email me news and offers from Harbour &amp; Co/);
      assert.match(files['index.html'], /fetch\('\/api\/signups'/);
      assert.match(index, /<p id="returned" class="note" hidden>/);
      // the legal links and the contact
      for (const page of ['terms.html', 'privacy.html', 'refunds.html']) { assert.ok(index.includes(`href="${page}"`), `${what}: links ${page}`); sound(files[page], `${what} ${page}`); }
      assert.match(index, /mailto:harbour@commandagi\.email/);
      // the products
      const active = fx.products.filter(p => p.status === 'active');
      if (active.length || t.id !== 'launch') assert.match(index, /id="products"/, `${what}: the products section`);
      else assert.doesNotMatch(index, /href="#products"/, `${what}: no link to a section that is not there`);
      assert.equal(index.match(/class="product[ "]/g)?.length ?? 0, active.length, `${what}: a card per active product`);
      for (const p of active) {
        assert.ok(index.includes(`href="product/${p.id}.html"`), `${what}: ${p.id}'s page`);
        assert.ok(index.includes(`href="checkout.html?p=${p.id}"`), `${what}: ${p.id}'s checkout`);
        const page = sound(files[`product/${p.id}.html`], `${what} product/${p.id}`);
        assert.ok(page.includes(`href="../checkout.html?p=${p.id}"`) && page.includes('class="pp"') && page.includes('href="../style.css"'));
      }
      assert.ok(!index.includes('Retired Vase') && !files['product/retired-vase.html'], `${what}: a draft is not shown`);
      if (name === 'physical') {
        assert.match(index, /<img src="images\/harbour-mug-1-960\.webp" srcset="[^"]+ 1600w"/, `${what}: a picture`);
        assert.match(index, /class="ph"|class="product row"|class="product tier/, `${what}: a product with no picture has its place`);
        assert.ok(index.includes('Kiln Notes &lt;b&gt;zine&lt;/b&gt;'), `${what}: a name is text`);
        assert.match(index, /\$25 <span>\/ month<\/span>/);
      }
      if (name === 'none' && t.id !== 'launch') assert.match(index, /Products are on their way/);
      // the checkout
      const checkout = sound(files['checkout.html'], `${what} checkout`);
      for (const id of ['line', 'pay', 'ship', 'how', 'error', 'by-mail', 'mail', 'thumb']) assert.ok(checkout.includes(`id="${id}"`), `${what}: checkout #${id}`);
      assert.match(files['checkout.html'], /post\('\/commerce\/cart',\{\}\)[\s\S]*post\('\/billing\/checkout',body\)/);
      const listed = JSON.parse(files['products.json']);
      assert.deepEqual(listed.map(p => p.id), active.map(p => p.id));
      if (name === 'digital') assert.deepEqual([listed[0].kind, listed[0].variantId], ['digital', 'var_1']);
      if (name === 'physical') assert.deepEqual(listed.map(p => p.variantId ?? null), ['var_2', 'var_3', null, null]);
      assert.match(files['app.mjs'], /url\.pathname === '\/api\/signups'/);
      // the words
      if (copy) {
        for (const w of ['Free shipping this week', 'Made in Maine', 'Slow mornings start here', 'Our studio', 'Every piece is thrown by hand.', 'Dishwasher safe', 'Do you ship abroad?', 'My favourite mug.']) assert.ok(index.includes(w), `${what}: says "${w}"`);
        assert.ok(!files['index.html'].includes('<script>alert(1)'), `${what}: a founder's words are text`);
      } else {
        assert.ok(index.includes('Mugs that make the morning.'), `${what}: the tagline is the headline`);
        for (const id of ['about', 'faq', 'testimonials', 'points']) assert.ok(!index.includes(`id="${id}"`), `${what}: ${id} is hidden until it has words`);
      }
      // the stylesheet
      const css = files['style.css'];
      assert.equal(css.split('{').length, css.split('}').length, `${what}: the stylesheet's braces pair`);
      assert.doesNotMatch(css, /undefined|NaN|\$\{/);
      assert.match(css, /^:root\{--p:#[0-9a-f]{6};/);
      assert.ok(index.includes('fonts.googleapis.com/css2?family='));
    }
  });
}

ok('a section is turned off in the source, and an unknown choice falls back to the default', () => {
  const fx = FIXTURES.physical, biz = business();
  const off = storefrontFiles(biz, fx.products, { storefront: { template: 'shop', style: 'studio', copy: WORDS, sections: { faq: false, how: false } }, images: fx.images })['index.html'];
  assert.ok(!off.includes('id="faq"') && !off.includes('id="how"') && off.includes('id="about"'));
  const src = readStorefrontSource({ template: 'nope', style: 7, copy: 'x', sections: null }, biz, fx.products);
  assert.deepEqual([src.template, src.style], Object.values(defaultStorefront(biz, fx.products)));
  assert.deepEqual(src.copy.faq, []);
});

ok('a business with no storefront.json renders with the default from its structured choices, never its idea', () => {
  const biz = { ...business('warm'), blueprint: { id: 'preorder' } };
  const files = storefrontFiles(biz, FIXTURES.physical.products, { images: FIXTURES.physical.images });
  assert.match(sound(files['index.html'], 'default'), /<body data-template="shop" data-style="craft">/);
  assert.deepEqual(defaultStorefront({ ...biz, blueprint: { id: 'preorder' } }, []), { template: 'launch', style: 'craft' });
  assert.deepEqual(defaultStorefront({ ...biz, blueprint: { id: 'booking' } }, []), { template: 'services', style: 'soft' });
  assert.deepEqual(defaultStorefront({ vibe: 'clean' }, FIXTURES.digital.products), { template: 'spotlight', style: 'studio' });
  assert.deepEqual(defaultStorefront({ vibe: 'premium' }, FIXTURES.physical.products), { template: 'shop', style: 'luxe' });
  // The pair picked at sign-up wins; an unknown id in it falls back to the blueprint's.
  assert.deepEqual(defaultStorefront({ ...biz, storefrontPick: { template: 'maker', style: 'editorial' } }, FIXTURES.physical.products), { template: 'maker', style: 'editorial' });
  assert.deepEqual(defaultStorefront({ ...biz, storefrontPick: { template: 'nope', style: 'mono' } }, []), { template: 'launch', style: 'mono' });
  // The idea's words change nothing.
  for (const idea of ['A digital product store for AI prompts', 'A coaching and consultation booking page', 'Small-batch honey from our farm'])
    assert.deepEqual(defaultStorefront({ idea, tagline: idea, vibe: 'clean' }, []), { template: 'shop', style: 'studio' }, idea);
  for (const blueprint of [null, ...BLUEPRINTS]) {
    const d = defaultStorefront({ blueprint, vibe: 'bold' }, []);
    assert.ok(TEMPLATES.some(t => t.id === d.template) && STYLES.some(s => s.id === d.style), blueprint?.id);
  }
  const fresh = newStorefrontSource(biz);
  assert.deepEqual(Object.keys(fresh), ['template', 'style', 'copy', 'sections']);
  assert.equal(sourceMark(fresh), sourceMark(JSON.parse(JSON.stringify(fresh))));
  assert.notEqual(sourceMark(fresh), sourceMark({ ...fresh, style: 'bold' }));
});

ok('every palette the brand generator can make keeps its contrast', () => {
  const vibes = ['bold', 'clean', 'warm', 'playful', 'premium'];
  const hues = new Set();
  for (let i = 0; hues.size < 360 && i < 20000; i++) {
    const name = `Brand ${i}`;
    const hue = brandFor(name).primary.match(/\d+/)[0];
    if (hues.has(hue)) continue;
    hues.add(hue);
    for (const vibe of vibes) {
      const c = palette(brandFor(name, vibe));
      const at = `${name} (${vibe}, hue ${hue})`;
      assert.ok(contrast(c.i, c.g) >= 7, `${at}: ink on ground ${contrast(c.i, c.g)}`);
      assert.ok(contrast(c['on-p'], c.p) >= 4.5, `${at}: the button's words ${contrast(c['on-p'], c.p)}`);
      assert.ok(contrast(c['on-a'], c.a) >= 4.5, `${at}: the accent's words`);
      for (const bg of [c.g, c.tint, c.card]) for (const fg of ['p-text', 'a-text', 'muted', 'i']) assert.ok(contrast(c[fg], bg) >= 4.5, `${at}: ${fg} on ${bg} is ${contrast(c[fg], bg).toFixed(2)}`);
    }
  }
  assert.equal(hues.size, 360);
  // A founder's own colours too: a pale primary, a mid ground, a value that is no colour.
  for (const brand of [{ primary: '#ffe600', ground: '#ffffff', ink: '#cccccc' }, { primary: '#777', ground: '#808080', ink: '#888' }, { primary: 'tomato-ish', ground: null }, { primary: 'rgb(250, 250, 250)', ground: 'hsl(0 0% 4%)', ink: '#000' }]) {
    const c = palette(brand);
    assert.ok(contrast(c.i, c.g) >= 7 && contrast(c['on-p'], c.p) >= 4.5 && contrast(c['p-text'], c.g) >= 4.5 && contrast(c.muted, c.tint) >= 4.5, JSON.stringify(brand));
  }
});

ok('the console\'s preview is one document that loads nothing of the page but pictures', () => {
  const fx = FIXTURES.physical;
  const products = fx.products.map(p => ({ ...p, images: (fx.images.get(p.id) ?? []).map(made => ({ path: 'x', made })) }));
  const html = storefrontPreview(business(), products, { template: 'maker', style: 'bold' });
  assert.ok(!html.includes('<script') && !html.includes('href="style.css"') && html.includes('<base href="https://harbour.vibestartup.pro/">'));
  assert.match(html, /<style>:root\{--p:/);
  assert.match(html, /src="images\/harbour-mug-1-960\.webp"/);
});

ok('the co-founder is told the file and every choice by name', () => {
  const rule = storefrontRule({ slug: 'harbour' });
  assert.ok(rule.includes('Businesses/harbour/storefront.json'));
  for (const x of [...TEMPLATES, ...STYLES]) assert.ok(rule.includes(`"${x.id}"`), x.id);
});

console.log(`\n${n} passed`);
