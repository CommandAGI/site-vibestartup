// Pictures of the storefront's templates and styles: every template with every style, at a phone's width (390 px)
// and a desktop's (1440 px), with a product page and the checkout. Each page is measured for sideways scroll, and the
// run fails when one has any.
//   node test/storefront-shots.mjs [--out DIR] [--only <template>]
import { createServer } from 'node:http';
import { mkdir, writeFile, readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { withBrowser } from './browser.mjs';

globalThis.window = {}; globalThis.location = { search: '' };
const { storefrontFiles } = await import('../lib/storefront.js');
const { brandFor } = await import('../lib/business.js');
const { TEMPLATES, STYLES } = await import('../lib/storefront-design.js');

const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const out = path.resolve(arg('--out') ?? 'test-results/storefront-templates');
const only = arg('--only');

// A drawn stand-in for a product photograph: a still life in the given colours (the storefront sizes real photographs
// in the founder's browser; these exercise the same markup and cropping).
const still = (a, b, c, shape) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient><radialGradient id="s" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="rgba(0,0,0,.35)"/><stop offset="1" stop-color="rgba(0,0,0,0)"/></radialGradient></defs><rect width="1600" height="1200" fill="url(#g)"/><rect y="820" width="1600" height="380" fill="rgba(0,0,0,.12)"/><ellipse cx="800" cy="900" rx="420" ry="60" fill="url(#s)"/>${shape === 'mug' ? `<path d="M560 420h480v380a90 90 0 0 1-90 90H650a90 90 0 0 1-90-90z" fill="${c}"/><path d="M1040 500h60a110 110 0 0 1 0 220h-60v-60h50a50 50 0 0 0 0-100h-50z" fill="${c}"/><ellipse cx="800" cy="420" rx="240" ry="34" fill="rgba(0,0,0,.25)"/>` : shape === 'bowl' ? `<path d="M420 560h760a380 330 0 0 1-760 0z" fill="${c}"/><ellipse cx="800" cy="560" rx="380" ry="46" fill="rgba(0,0,0,.22)"/>` : shape === 'jar' ? `<rect x="610" y="330" width="380" height="70" rx="14" fill="rgba(0,0,0,.45)"/><rect x="570" y="400" width="460" height="500" rx="60" fill="${c}"/><rect x="630" y="560" width="340" height="200" rx="8" fill="rgba(255,255,255,.85)"/>` : `<rect x="520" y="300" width="560" height="600" rx="18" fill="${c}"/><rect x="590" y="390" width="300" height="34" fill="rgba(255,255,255,.9)"/><rect x="590" y="450" width="420" height="16" fill="rgba(255,255,255,.55)"/><rect x="590" y="486" width="360" height="16" fill="rgba(255,255,255,.55)"/>`}</svg>`;
const pictures = {};
const made = (name, ...draw) => { pictures[`${name}.svg`] = still(...draw); return { base: name, width: 1600, height: 1200, files: [{ name: `${name}.svg`, w: null }] }; };
const good = (id, name, description, priceLabel, more = {}) => ({ id, name, description, priceLabel, status: 'active', type: 'physical', goodKind: 'physical', goodStatus: 'active', variantId: `var_${id}`, ...more });
const site = slug => ({ id: slug, folder: `Sites/${slug}`, url: '', brandUrl: '' });
const biz = (name, idea, tagline, vibe) => ({ slug: name.toLowerCase().replace(/\W+/g, '-'), name, idea, tagline, vibe, brand: brandFor(name, vibe), email: { address: `${name.toLowerCase().replace(/\W+/g, '')}@commandagi.email` }, site: site(name) });

// One business per template, of the kind the template is for.
const STORES = {
  spotlight: {
    biz: biz('DigitalProduct', 'A digital product store for AI prompts and workflows', 'A digital product store for AI prompts and workflows.', 'clean'),
    products: [good('solo-operator-prompt-pack', 'The Solo Operator Prompt Pack', '120 prompts for the work a solo founder does every week: offers, outreach, support replies and the weekly review. Plain text, yours to edit.', '$19', { type: 'digital', goodKind: 'digital' }), good('launch-week-workflow', 'Launch Week Workflow', 'Seven days of checklists and prompts, from the first offer to the debrief.', '$29', { type: 'digital', goodKind: 'digital' }), good('pricing-calculator', 'Pricing Calculator', 'A spreadsheet that turns your costs and hours into a price.', '$12', { type: 'digital', goodKind: 'digital' })],
    images: new Map([['launch-week-workflow', [made('workflow', '#dfe7ff', '#b9c6f5', '#3145c4', 'book')]]]),
    opts: { store: true, guestDigital: true },
    copy: { faq: [{ q: 'What do I get?', a: 'One Markdown file with every prompt, grouped by task.' }, { q: 'Can I get a refund?', a: 'Yes, until you download the file.' }] },
  },
  shop: {
    biz: biz('Harbour & Co', 'Small-batch stoneware for slow mornings', 'Mugs that make the morning.', 'warm'),
    products: [good('harbour-mug', 'Harbour Mug', 'Stoneware, 12 oz, glazed in sea green.', '$34'), good('tide-bowl', 'Tide Bowl', 'A wide bowl for soup, ramen or fruit.', '$48'), good('salt-jar', 'Salt Jar', 'With a cork lid. Holds half a pound.', '$26'), good('kiln-notes', 'Kiln Notes', 'A zine about glaze, in 24 pages.', '$8', { variantId: null }), good('studio-club', 'Studio Club', 'A new piece every month.', '$25', { recurring: true, interval: 'month' })],
    images: new Map([['harbour-mug', [made('mug', '#f3e3d0', '#e6cfb4', '#3f7f6e', 'mug'), made('mug2', '#e8eee9', '#cddad0', '#3f7f6e', 'mug')]], ['tide-bowl', [made('bowl', '#efe6da', '#d8c7b0', '#b8563a', 'bowl')]], ['salt-jar', [made('jar', '#e9e4dc', '#cfc6b8', '#d9b25a', 'jar')]]]),
    opts: { store: true },
    copy: { announcement: 'Free shipping on orders over $60 this week', about: { title: 'Two potters, one kiln', text: 'We throw every piece by hand in a small studio by the harbour.\n\nEach batch is small, so no two glazes are quite the same.' } },
  },
  launch: {
    biz: biz('Lumen Lamp', 'A camera-enabled desk lamp that lets an assistant see your notebook', 'The desk lamp that reads along.', 'bold'),
    products: [good('founders-batch', 'Founders Batch', 'One of the first 200 lamps, numbered. Ships in spring.', '$149'), good('lumen-shade', 'Spare Shade', 'A second shade in brushed steel.', '$29', { variantId: null })],
    images: new Map([['founders-batch', [made('lamp', '#1b1c22', '#30323c', '#f1c24b', 'jar')]]]),
    opts: { store: true },
    copy: { points: [{ title: 'Sees the page', text: 'A 12 MP camera looks down at your notebook.' }, { title: 'Private by default', text: 'A shutter covers the lens when you turn it off.' }, { title: 'Open hardware', text: 'The plans and the firmware are public.' }] },
  },
  services: {
    biz: biz('Clearcast', 'A podcast production service for busy founders', 'Your podcast, edited and out the door.', 'clean'),
    products: [good('one-episode', 'One episode', 'Editing, levelling, show notes and a clip for social. Back in three working days.', '$240'), good('monthly-four', 'Four a month', 'A weekly show, edited and published for you, with a monthly call.', '$840', { recurring: true, interval: 'month' }), good('launch-kit', 'Launch kit', 'Cover art, intro music and your first three episodes.', '$1,200', { variantId: null })],
    images: new Map(),
    opts: { store: true },
    copy: { testimonials: [{ quote: 'I record on Monday and it is live by Thursday.', name: 'Priya, Field Notes' }, { quote: 'The show notes alone are worth it.', name: 'Marcus, Two Founders' }], faq: [{ q: 'What do you need from me?', a: 'Your raw recording and any notes.' }] },
  },
  club: {
    biz: biz('Night Shift', 'A community for people who make music after work', 'Make music after work, with company.', 'playful'),
    products: [good('member', 'Member', 'The Discord, the weekly prompt and the Friday listening room.', '$8', { recurring: true, interval: 'month' }), good('studio', 'Studio', 'Everything in Member, plus monthly feedback on one track.', '$24', { recurring: true, interval: 'month' }), good('sample-pack', 'Sample Pack 01', '200 sounds recorded by members.', '$15', { type: 'digital', goodKind: 'digital' })],
    images: new Map(),
    opts: { store: true, guestDigital: true },
    copy: { points: [{ title: 'A prompt every Monday', text: 'One small idea to start a track.' }, { title: 'Friday listening room', text: 'Play what you made. Hear what others made.' }, { title: 'No algorithm', text: 'A chat, a calendar and people.' }] },
  },
  maker: {
    biz: biz('Second Rise', 'A neighbourhood bakery with sourdough and morning buns', 'Bread worth getting up for.', 'premium'),
    products: [good('country-loaf', 'Country Loaf', 'Naturally leavened, 36 hours.', '$9'), good('morning-bun', 'Morning Bun', 'Orange zest and cinnamon. Box of four.', '$14'), good('seeded-rye', 'Seeded Rye', 'Dense, dark, good for a week.', '$11'), good('granola', 'House Granola', 'Oats, pecans, maple.', '$12', { variantId: null }), good('bread-club', 'Bread Club', 'A loaf every Saturday.', '$32', { recurring: true, interval: 'month' })],
    images: new Map([['country-loaf', [made('loaf', '#3a2a1c', '#1f1711', '#c98f4e', 'bowl')]], ['morning-bun', [made('bun', '#e9dccb', '#cdb89c', '#b56a2c', 'bowl')]], ['seeded-rye', [made('rye', '#d7cfc4', '#b3a796', '#4a352a', 'jar')]], ['granola', [made('granola', '#efe2c8', '#d9c59c', '#8a5a2b', 'jar')]]]),
    opts: { store: true },
    copy: { about: { title: 'Baked before sunrise', text: 'We mill some of our own flour and bake every loaf the morning you get it.\n\nOrder by Thursday for Saturday.' } },
  },
};

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.mjs': 'text/javascript' };
const root = await mkdtemp(path.join(tmpdir(), 'vibestartup-storefronts-'));
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html');
  try { const body = await readFile(path.join(root, p)); res.writeHead(200, { 'content-type': TYPES[path.extname(p)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const bad = [];
try {
  await mkdir(out, { recursive: true });
  await withBrowser(async b => {
    const at = async (width, url, name) => {
      await b.send('Emulation.setDeviceMetricsOverride', { width, height: width < 500 ? 844 : 900, deviceScaleFactor: 1, mobile: width < 500 });
      await b.goto(url);
      await b.eval('document.fonts.ready.then(() => true)');
      const look = await b.shot(name);
      // Wider than the page: an element whose box passes the right edge (the gallery's own strip scrolls by design).
      const wide = await b.eval(`[...document.querySelectorAll('body *')].filter(e => !e.closest('.gallery,.hp,.thumbs') && e.getBoundingClientRect().right > innerWidth + 1).map(e => e.tagName + '.' + e.className).slice(0, 3).join(', ')`);
      if (look.sideways > 0 || wide) bad.push(`${name}: ${look.sideways} px sideways${wide ? ` (${wide})` : ''}`);
    };
    for (const t of TEMPLATES) {
      if (only && t.id !== only) continue;
      const store = STORES[t.id];
      for (const s of STYLES) {
        const dir = `${t.id}-${s.id}`;
        const files = storefrontFiles(store.biz, store.products, { storefront: { template: t.id, style: s.id, copy: store.copy }, images: store.images, ...store.opts });
        for (const [name, content] of Object.entries({ ...files, ...Object.fromEntries(Object.entries(pictures).map(([n, c]) => [`images/${n}`, c])) })) {
          await mkdir(path.dirname(path.join(root, dir, name)), { recursive: true });
          await writeFile(path.join(root, dir, name), content);
        }
        for (const width of [390, 1440]) await at(width, `${origin}/${dir}/`, `${t.id}--${s.id}--${width}`);
        if (s.id === STYLES[TEMPLATES.indexOf(t) % STYLES.length].id) for (const width of [390, 1440]) {
          await at(width, `${origin}/${dir}/product/${store.products[0].id}.html`, `${t.id}--${s.id}--product--${width}`);
          await at(width, `${origin}/${dir}/checkout.html?p=${store.products[0].id}`, `${t.id}--${s.id}--checkout--${width}`);
        }
        console.log(`shot ${dir}`);
      }
    }
    // A business with nothing yet: every template with no product.
    for (const t of only ? [] : TEMPLATES) {
      const store = STORES[t.id], dir = `${t.id}-empty`;
      const files = storefrontFiles(store.biz, [], {});
      for (const [name, content] of Object.entries(files)) await mkdir(path.dirname(path.join(root, dir, name)), { recursive: true }).then(() => writeFile(path.join(root, dir, name), content));
      for (const width of [390, 1440]) await at(width, `${origin}/${dir}/`, `${t.id}--no-products--${width}`);
    }
  }, { out });
} finally { server.close(); }
if (bad.length) { console.error(`\nsideways scroll:\n${bad.join('\n')}`); process.exit(1); }
console.log(`\nno sideways scroll on any page. Pictures: ${out}`);
