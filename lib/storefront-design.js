// The storefront's design: the layouts (templates) and the style presets every store starts from, the source a
// founder or the co-founder edits (`storefront.json` in the business's folder), and the colours a brand kit becomes
// on a page (docs/DESIGN.md § the storefront). This module is pure: no network, no DOM. `lib/storefront.js` calls it
// on every publish, so nobody edits the site's HTML.
//
//   storefront.json   { template, style, copy: { … }, sections: { … } }
//
// Any template works with any style: a template is the page's sections and their markup, a style is CSS custom
// properties and a few component rules, and the brand kit's palette fills the colours.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- the templates ----------

/** The layouts. `buy` is the button's word when the checkout sells the product, `order` when it is ordered by email. */
export const TEMPLATES = [
  { id: 'spotlight', name: 'Spotlight', about: 'One product takes the page: a download, a guide, a single offer.', kicker: 'Featured', productsTitle: 'More to explore', cta: 'Get it now', buy: 'Buy', order: 'Order' },
  { id: 'shop', name: 'Shop', about: 'A small shop of goods: a banner, then a grid of products.', kicker: 'The shop', productsTitle: 'Shop everything', cta: 'Shop now', buy: 'Buy', order: 'Order' },
  { id: 'launch', name: 'Launch', about: 'A pre-order or a waitlist: the sign-up is the hero, the first offers follow.', kicker: 'Launching soon', productsTitle: 'Available to pre-order', cta: 'Join the list', buy: 'Pre-order', order: 'Order' },
  { id: 'services', name: 'Services', about: 'Services and bookings: packages in a list, each with a price and a clear next step.', kicker: 'Services', productsTitle: 'Packages', cta: 'See the packages', buy: 'Book', order: 'Enquire' },
  { id: 'club', name: 'Club', about: 'A creator or a community: membership plans side by side.', kicker: 'Membership', productsTitle: 'Ways to join', cta: 'See the plans', buy: 'Join', order: 'Order' },
  { id: 'maker', name: 'Maker', about: 'Food or a local maker: a full-width picture, your story, then what you make.', kicker: 'Small batch', productsTitle: 'What we make', cta: 'See what we make', buy: 'Buy', order: 'Order' },
];

// ---------- the styles ----------

const gf = families => `https://fonts.googleapis.com/css2?${families.map(f => `family=${f}`).join('&')}&display=swap`;

/**
 * The style presets. `vars` are the custom properties the base rules read; `css` is the preset's own component rules.
 * Colours are never named here: they come from the brand kit (`palette`).
 */
export const STYLES = [
  {
    id: 'studio', name: 'Studio', about: 'Clean and precise: a tight sans, hairlines, small radii.',
    fonts: gf(['Inter:wght@400;500;600', 'Inter+Tight:wght@600;700']),
    vars: { 'f-head': '"Inter Tight","Inter",system-ui,sans-serif', 'f-body': '"Inter",system-ui,-apple-system,"Segoe UI",sans-serif', 'f-label': 'var(--f-body)', 'w-head': 700, 'ls-head': '-.03em', 'tt-head': 'none', 'lh-head': 1.05, h1: 'clamp(34px,6.4vw,68px)', h2: 'clamp(24px,3.4vw,36px)', r: '10px', 'r-btn': '8px', 'r-img': '6px', bw: '1px', bd: 'var(--line)', shadow: 'none', sp: 'clamp(48px,8vw,104px)', ratio: '4/3', 'tt-label': 'uppercase', 'ls-label': '.08em', 'tt-btn': 'none', 'ls-btn': '0', 'w-btn': 600 },
    css: '',
  },
  {
    id: 'editorial', name: 'Editorial', about: 'A magazine: serif headlines, generous space, thin rules.',
    fonts: gf(['Fraunces:opsz,wght@9..144,400;9..144,600', 'Source+Sans+3:wght@400;600']),
    vars: { 'f-head': '"Fraunces",Georgia,"Times New Roman",serif', 'f-body': '"Source Sans 3",system-ui,sans-serif', 'f-label': 'var(--f-body)', 'w-head': 400, 'ls-head': '-.025em', 'tt-head': 'none', 'lh-head': 1.04, h1: 'clamp(38px,7.4vw,84px)', h2: 'clamp(26px,3.8vw,42px)', r: '0px', 'r-btn': '0px', 'r-img': '0px', bw: '1px', bd: 'var(--line)', shadow: 'none', sp: 'clamp(56px,9vw,128px)', ratio: '4/5', 'tt-label': 'uppercase', 'ls-label': '.14em', 'tt-btn': 'none', 'ls-btn': '.01em', 'w-btn': 600 },
    css: `body{font-size:17px}.products>.product{border:0;background:transparent;box-shadow:none}.products>.product .info{padding:14px 0 0}.sec-head{border-top:1px solid var(--i);padding-top:14px}.kicker{font-style:italic;font-family:var(--f-head);text-transform:none;letter-spacing:0;font-size:17px}.quote blockquote{font-family:var(--f-head);font-size:clamp(20px,2.6vw,28px);line-height:1.3}`,
  },
  {
    id: 'bold', name: 'Bold', about: 'Loud: tall condensed capitals, thick borders, hard shadows.',
    fonts: gf(['Anton', 'Archivo:wght@400;600;700']),
    vars: { 'f-head': '"Anton","Archivo Narrow",Impact,sans-serif', 'f-body': '"Archivo",system-ui,sans-serif', 'f-label': 'var(--f-body)', 'w-head': 400, 'ls-head': '.005em', 'tt-head': 'uppercase', 'lh-head': .98, h1: 'clamp(44px,9.4vw,112px)', h2: 'clamp(30px,4.6vw,54px)', r: '0px', 'r-btn': '0px', 'r-img': '0px', bw: '3px', bd: 'var(--i)', shadow: '6px 6px 0 var(--i)', sp: 'clamp(48px,8vw,104px)', ratio: '1/1', 'tt-label': 'uppercase', 'ls-label': '.1em', 'tt-btn': 'uppercase', 'ls-btn': '.06em', 'w-btn': 700 },
    css: `.buy{border:var(--bw) solid var(--i);box-shadow:4px 4px 0 var(--i)}.buy:hover{transform:translate(2px,2px);box-shadow:2px 2px 0 var(--i);filter:none}.kicker{background:var(--i);color:var(--g);padding:4px 10px;display:inline-block}.bar{border-bottom:var(--bw) solid var(--i)}footer{border-top:var(--bw) solid var(--i)}.info h2,.row-main h2,.tier h2,.menu-item h2{font-family:var(--f-body);font-weight:700;text-transform:none;letter-spacing:-.01em;line-height:1.2}`,
  },
  {
    id: 'soft', name: 'Soft', about: 'Friendly: round corners, pill buttons, soft shadows.',
    fonts: gf(['Plus+Jakarta+Sans:wght@400;500;700;800']),
    vars: { 'f-head': '"Plus Jakarta Sans",system-ui,sans-serif', 'f-body': '"Plus Jakarta Sans",system-ui,sans-serif', 'f-label': 'var(--f-body)', 'w-head': 800, 'ls-head': '-.035em', 'tt-head': 'none', 'lh-head': 1.06, h1: 'clamp(34px,6.4vw,70px)', h2: 'clamp(24px,3.4vw,38px)', r: '24px', 'r-btn': '999px', 'r-img': '18px', bw: '0px', bd: 'transparent', shadow: '0 1px 2px var(--shade),0 12px 32px -12px var(--shade)', sp: 'clamp(48px,8vw,104px)', ratio: '4/3', 'tt-label': 'none', 'ls-label': '0', 'tt-btn': 'none', 'ls-btn': '0', 'w-btn': 700 },
    css: `body{background:var(--tint)}.bar{background:var(--tint)}.products>.product,.feature,.tier,.updates,.row,.faq details,.quote,.step{background:var(--g)}.kicker{background:var(--g);padding:6px 14px;border-radius:999px;display:inline-block;box-shadow:var(--shadow);font-size:13px}.products .media,.feature .media{margin:8px 8px 0;border-radius:var(--r-img)}.band{background:var(--g)}`,
  },
  {
    id: 'playful', name: 'Playful', about: 'A wink: rounded type, chunky outlines, sticker labels.',
    fonts: gf(['Fredoka:wght@500;600;700', 'Nunito:wght@400;600;800']),
    vars: { 'f-head': '"Fredoka","Nunito",system-ui,sans-serif', 'f-body': '"Nunito",system-ui,sans-serif', 'f-label': 'var(--f-head)', 'w-head': 600, 'ls-head': '-.015em', 'tt-head': 'none', 'lh-head': 1.04, h1: 'clamp(38px,7.4vw,80px)', h2: 'clamp(26px,3.8vw,42px)', r: '22px', 'r-btn': '999px', 'r-img': '14px', bw: '2px', bd: 'var(--i)', shadow: '5px 5px 0 var(--a)', sp: 'clamp(48px,8vw,104px)', ratio: '1/1', 'tt-label': 'none', 'ls-label': '0', 'tt-btn': 'none', 'ls-btn': '0', 'w-btn': 800 },
    css: `body{font-size:17px}.buy{border:2px solid var(--i);box-shadow:3px 3px 0 var(--i)}.buy:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 var(--i);filter:none}.kicker{background:var(--a);color:var(--on-a);padding:5px 14px;border-radius:999px;border:2px solid var(--i);display:inline-block;transform:rotate(-2deg);font-size:14px}.products .media{border-bottom:2px solid var(--i)}.step-n{background:var(--a);color:var(--on-a);border:2px solid var(--i)}`,
  },
  {
    id: 'luxe', name: 'Luxe', about: 'Restrained: a fine serif, spaced capitals, lots of air.',
    fonts: gf(['Cormorant+Garamond:wght@400;500;600', 'Jost:wght@400;500']),
    vars: { 'f-head': '"Cormorant Garamond","Cormorant",Georgia,serif', 'f-body': '"Jost",system-ui,sans-serif', 'f-label': 'var(--f-body)', 'w-head': 500, 'ls-head': '-.01em', 'tt-head': 'none', 'lh-head': 1.04, h1: 'clamp(42px,8vw,96px)', h2: 'clamp(30px,4.2vw,50px)', r: '0px', 'r-btn': '0px', 'r-img': '0px', bw: '1px', bd: 'var(--line)', shadow: 'none', sp: 'clamp(64px,10vw,144px)', ratio: '4/5', 'tt-label': 'uppercase', 'ls-label': '.22em', 'tt-btn': 'uppercase', 'ls-btn': '.18em', 'w-btn': 500 },
    css: `.buy{font-size:13px}.kicker{font-size:12px}.products>.product{border:0;background:transparent}.products>.product .info{padding:16px 0 0;text-align:center;align-items:center}.products>.product .buy{align-self:stretch}.info h2,.row-main h2,.tier h2,.menu-item h2{font-size:24px;font-weight:500}.sec-head{text-align:center;justify-items:center}.brand span{font-family:var(--f-head);font-size:22px;font-weight:600;letter-spacing:.02em}.price{font-weight:500}`,
  },
  {
    id: 'mono', name: 'Mono', about: 'Technical: a grotesk with monospace labels, dashed lines.',
    fonts: gf(['Space+Grotesk:wght@400;500;700', 'IBM+Plex+Mono:wght@400;500']),
    vars: { 'f-head': '"Space Grotesk",system-ui,sans-serif', 'f-body': '"Space Grotesk",system-ui,sans-serif', 'f-label': '"IBM Plex Mono",ui-monospace,Menlo,monospace', 'w-head': 700, 'ls-head': '-.04em', 'tt-head': 'none', 'lh-head': 1.02, h1: 'clamp(36px,6.8vw,76px)', h2: 'clamp(24px,3.4vw,38px)', r: '4px', 'r-btn': '4px', 'r-img': '2px', bw: '1px', bd: 'var(--line2)', shadow: 'none', sp: 'clamp(48px,8vw,104px)', ratio: '16/10', 'tt-label': 'uppercase', 'ls-label': '.06em', 'tt-btn': 'none', 'ls-btn': '0', 'w-btn': 500 },
    css: `.product,.updates,.faq details,.quote,.step,.hero-aside,.hero-art{border-style:dashed}.kicker::before{content:"// "}.price,.buy,.bar nav a,.fine,.trust li,footer{font-family:var(--f-label)}.buy{font-size:14px}.step-n{border-radius:2px;font-family:var(--f-label)}`,
  },
  {
    id: 'craft', name: 'Craft', about: 'Warm and handmade: a display serif, paper cards, dotted rules.',
    fonts: gf(['DM+Serif+Display', 'Karla:wght@400;500;700']),
    vars: { 'f-head': '"DM Serif Display",Georgia,serif', 'f-body': '"Karla",system-ui,sans-serif', 'f-label': 'var(--f-body)', 'w-head': 400, 'ls-head': '-.01em', 'tt-head': 'none', 'lh-head': 1.08, h1: 'clamp(38px,7vw,78px)', h2: 'clamp(26px,3.8vw,42px)', r: '14px', 'r-btn': '10px', 'r-img': '10px', bw: '1px', bd: 'var(--line)', shadow: '0 2px 0 var(--line)', sp: 'clamp(48px,8vw,112px)', ratio: '1/1', 'tt-label': 'uppercase', 'ls-label': '.12em', 'tt-btn': 'none', 'ls-btn': '0', 'w-btn': 700 },
    css: `body{font-size:17px}.products>.product,.feature,.tier,.row,.faq details,.quote,.step{background:var(--card)}.products .media,.feature .media{margin:10px 10px 0;border-radius:var(--r-img)}.sec-head{border-bottom:2px dotted var(--line2);padding-bottom:14px}.kicker{font-size:12px}`,
  },
];

const byId = (list, id) => list.find(x => x.id === id);

// ---------- the default for a business ----------

const BLUEPRINT = { digital: 'spotlight', booking: 'services', preorder: 'launch', waitlist: 'launch', demo: 'launch' };
const VIBE_STYLE = { bold: 'bold', clean: 'studio', warm: 'craft', playful: 'playful', premium: 'luxe' };

/**
 * The layout and the style a business starts with, from structured choices only (never from the idea's words): the
 * pair picked at sign-up (`storefrontPick`, the model's suggestion for the idea), else the blueprint, the products'
 * kinds and the vibe. A business with no `storefront.json` gets this at its next publish; the co-founder may change
 * the file later (its charter's storefrontRule).
 */
export function defaultStorefront(biz, products = []) {
  const active = products.filter(p => p.status === 'active');
  const pick = biz?.storefrontPick ?? {};
  let template = byId(TEMPLATES, pick.template) ? pick.template : BLUEPRINT[biz?.blueprint?.id] ?? null;
  // A launch page with several products to show reads better as a shop.
  if (!byId(TEMPLATES, pick.template) && template === 'launch' && active.length > 1) template = 'shop';
  if (!template) template = active.length === 1 && isDigital(active[0]) ? 'spotlight' : 'shop';
  if (byId(STYLES, pick.style)) return { template, style: pick.style };
  let style = VIBE_STYLE[biz?.vibe ?? biz?.brand?.vibe] ?? 'studio';
  if (style === 'craft' && (template === 'services' || template === 'club')) style = 'soft';
  if (style === 'studio' && template === 'maker') style = 'editorial';
  return { template, style };
}

const isDigital = p => p?.goodKind === 'digital' || p?.type === 'digital';

/** The file a new business gets: the default choice, and empty words for the founder or the co-founder to fill. */
export function newStorefrontSource(biz, products = []) {
  return {
    ...defaultStorefront(biz, products),
    copy: { announcement: '', kicker: '', headline: '', subhead: '', cta: '', productsTitle: '', about: { title: '', text: '' }, points: [], faq: [], testimonials: [] },
    sections: { how: true, about: true, points: true, faq: true, testimonials: true },
  };
}

const text = v => (typeof v === 'string' ? v.trim() : '');
const same = (a, b) => text(a).replace(/[.!\s]+$/, '').toLowerCase() === text(b).replace(/[.!\s]+$/, '').toLowerCase();

/**
 * The source as the pages read it: a known template and style (else the default for the business), every word
 * trimmed, lists without empty entries. Nothing here throws on a hand-edited file.
 */
export function readStorefrontSource(doc, biz, products = []) {
  const d = doc && typeof doc === 'object' ? doc : {};
  const def = defaultStorefront(biz, products);
  const copy = d.copy && typeof d.copy === 'object' ? d.copy : {};
  const list = (v, keep) => (Array.isArray(v) ? v : []).map(keep).filter(Boolean).slice(0, 12);
  const sections = d.sections && typeof d.sections === 'object' ? d.sections : {};
  return {
    template: byId(TEMPLATES, d.template) ? d.template : def.template,
    style: byId(STYLES, d.style) ? d.style : def.style,
    copy: {
      announcement: text(copy.announcement), kicker: text(copy.kicker), headline: text(copy.headline), subhead: text(copy.subhead),
      cta: text(copy.cta), productsTitle: text(copy.productsTitle),
      about: { title: text(copy.about?.title), text: text(typeof copy.about === 'string' ? copy.about : copy.about?.text) },
      points: list(copy.points, x => (text(x?.title) || text(x?.text)) ? { title: text(x.title), text: text(x.text) } : null),
      faq: list(copy.faq, x => text(x?.q) && text(x?.a) ? { q: text(x.q), a: text(x.a) } : null),
      testimonials: list(copy.testimonials, x => text(x?.quote) ? { quote: text(x.quote), name: text(x.name) } : null),
    },
    sections: Object.fromEntries(['how', 'about', 'points', 'faq', 'testimonials'].map(k => [k, sections[k] !== false])),
  };
}

/** A short, stable mark of a source's content: the console publishes again when the file's differs from the site's. */
export function sourceMark(doc) {
  const s = JSON.stringify(doc ?? null);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

// ---------- colour: a brand kit's palette on a page, with contrast that holds ----------

const clamp01 = x => Math.min(1, Math.max(0, x));
function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp01(s / 100); l = clamp01(l / 100);
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map(x => Math.round(x * 255));
}
/** A CSS colour (`#rgb`, `#rrggbb`, `rgb()`, `hsl()`) as [r, g, b], or null. */
export function parseColor(c) {
  const s = String(c ?? '').trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(s);
  if (m) return [...m[1]].map(x => parseInt(x + x, 16));
  m = /^#([0-9a-f]{6})/.exec(s);
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  const n = s.match(/-?\d*\.?\d+/g)?.map(Number);
  if (/^rgba?\(/.test(s) && n?.length >= 3) return n.slice(0, 3).map(x => Math.round(Math.min(255, Math.max(0, x))));
  if (/^hsla?\(/.test(s) && n?.length >= 3) return hslToRgb(n[0], n[1], n[2]);
  return null;
}
const hex = rgb => '#' + rgb.map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const lum = rgb => { const [r, g, b] = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** The WCAG contrast ratio of two colours. */
export function contrast(a, b) {
  const [x, y] = [lum(parseColor(a) ?? [0, 0, 0]), lum(parseColor(b) ?? [255, 255, 255])];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const WHITE = [255, 255, 255], BLACK = [16, 15, 20];
/** `fg` moved toward black or white, as little as it takes to reach `min` against every colour of `bgs`. */
function legible(fg, bgs, min) {
  // Measured as the page will show them: whole numbers, each ground too, with a little room.
  bgs = bgs.map(b => b.map(Math.round)); min += 0.05;
  const worst = c => Math.min(...bgs.map(b => ratio(c.map(Math.round), b)));
  if (worst(fg) >= min) return fg;
  const toward = bgs.reduce((a, b) => a + lum(b), 0) / bgs.length > 0.3 ? [0, 0, 0] : WHITE;
  for (let t = 0.04; t <= 1.001; t += 0.04) { const c = mix(fg, toward, t); if (worst(c) >= min) return c; }
  return toward;
}

/**
 * The page's colours from a brand kit (`{ primary, secondary, accent, ground, ink }`, any CSS colour): text that
 * reads on the ground and on the tinted and card surfaces (4.5:1 or more; ink 7:1), and the words on a button
 * (white or near-black, whichever reads on the primary). A value that is no colour falls back to a neutral one.
 */
export function palette(brand = {}) {
  // A ground in the middle holds no readable ink: it moves to the nearer end until one reads on it.
  let g = parseColor(brand.ground) ?? WHITE;
  for (const end = lum(g) > 0.18 ? WHITE : [0, 0, 0]; Math.max(ratio(WHITE, g), ratio([0, 0, 0], g)) < 7.5;) g = mix(g, end, 0.1);
  const p = parseColor(brand.primary) ?? [42, 82, 190];
  const s = parseColor(brand.secondary) ?? p;
  const a = parseColor(brand.accent) ?? p;
  const dark = lum(g) < 0.3;
  const i = legible(parseColor(brand.ink) ?? (dark ? [240, 238, 232] : BLACK), [g], 7);
  const tint = mix(g, p, dark ? 0.14 : 0.07);
  const card = mix(g, i, dark ? 0.07 : 0.035);
  const surfaces = [g, tint, card];
  const on = c => (ratio(WHITE, c) >= 4.5 ? WHITE : BLACK);
  // The button: the primary itself where white or near-black reads on it, else the primary moved until one does.
  let btn = p, onP = on(p);
  if (ratio(onP, btn) < 4.5) { btn = legible(p, [onP], 4.5); }
  let ab = a, onA = on(a);
  if (ratio(onA, ab) < 4.5) { ab = legible(a, [onA], 4.5); }
  const out = {
    p: btn, 'on-p': onP, 'p-text': legible(p, surfaces, 4.5), s, a: ab, 'on-a': onA, 'a-text': legible(a, surfaces, 4.5),
    g, i, muted: legible(mix(i, g, 0.34), surfaces, 4.5), line: mix(g, i, 0.14), line2: mix(g, i, 0.34), tint, card,
    shade: dark ? [0, 0, 0] : mix(i, g, 0.72),
  };
  return { dark, ...Object.fromEntries(Object.entries(out).map(([k, v]) => [k, hex(v)])) };
}

// ---------- the stylesheet ----------

const BASE = `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;font-family:var(--f-body);font-size:16px;line-height:1.55;background:var(--g);color:var(--i);-webkit-font-smoothing:antialiased}
a{color:inherit}
img{max-width:100%;display:block}
h1,h2,h3{font-family:var(--f-head);font-weight:var(--w-head);letter-spacing:var(--ls-head);text-transform:var(--tt-head);line-height:var(--lh-head);margin:0;text-wrap:balance;overflow-wrap:anywhere}
p{margin:0}
:focus-visible{outline:2px solid var(--p-text);outline-offset:2px}
.wrap{width:min(100% - 32px,1120px);margin:0 auto}
.announce{background:var(--i);color:var(--g);text-align:center;font-size:14px;padding:8px 16px}
.bar{position:sticky;top:0;z-index:5;background:var(--g);border-bottom:1px solid var(--line)}
.bar-in{display:flex;align-items:stretch;min-height:60px}
.brand{display:flex;align-items:center;gap:10px;min-height:60px;font-weight:700;text-decoration:none;color:inherit;min-width:0}
.brand img{width:30px;height:30px;flex:none;border-radius:min(var(--r-btn),8px)}
.brand span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar nav{margin-left:auto;display:flex;flex:none}
.bar nav a{display:flex;align-items:center;min-height:60px;padding:0 12px;font-size:15px;font-weight:500;text-decoration:none}
.bar nav a:hover{color:var(--p-text)}
main{display:block}
.kicker{font-family:var(--f-label);font-size:13px;font-weight:600;text-transform:var(--tt-label);letter-spacing:var(--ls-label);color:var(--p-text);margin:0 0 16px}
.lede{font-size:clamp(17px,2vw,21px);color:var(--muted);max-width:56ch}
.buy{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 24px;background:var(--p);color:var(--on-p);text-decoration:none;font:inherit;font-weight:var(--w-btn);text-transform:var(--tt-btn);letter-spacing:var(--ls-btn);border:0;border-radius:var(--r-btn);cursor:pointer;transition:filter .15s,transform .15s,box-shadow .15s;text-align:center}
.buy:hover{filter:brightness(.92)}
.buy:disabled{opacity:.6}
.buy.quiet{background:transparent;color:var(--i);border:var(--bw,1px) solid var(--line2);box-shadow:none}
.buy.quiet:hover{border-color:var(--i);filter:none}
.actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:28px}
.price{font-weight:700;font-variant-numeric:tabular-nums}
.price span{font-weight:500;color:var(--muted)}
.fine{font-size:14px;color:var(--muted)}
.hero{padding:clamp(40px,7vw,96px) 0 clamp(32px,5vw,64px)}
.hero h1{font-size:var(--h1);margin:0 0 20px}
.hero-center{text-align:center}
.hero-center .lede{margin-inline:auto}
.hero-center .actions{justify-content:center}
.hero-split{display:grid;gap:32px;align-items:center}
.hero-split>*{min-width:0}
.band{background:var(--tint)}
.trust{list-style:none;padding:0;margin:28px 0 0;display:flex;flex-wrap:wrap;gap:8px 22px;font-size:14px;color:var(--muted)}
.trust li{display:flex;align-items:center;gap:8px}
.trust li::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--p-text);flex:none}
.hero-center .trust{justify-content:center}
.sec{padding:calc(var(--sp)/2) 0}
.sec-head{display:grid;gap:8px;margin:0 0 28px}
.sec-head h2{font-size:var(--h2)}
.sec-head p{color:var(--muted);max-width:60ch}
.products{display:grid;grid-template-columns:1fr;gap:20px}
.product{position:relative;display:flex;flex-direction:column;min-width:0;border:var(--bw) solid var(--bd);border-radius:var(--r);background:var(--g);box-shadow:var(--shadow);overflow:hidden}
.media{position:relative;aspect-ratio:var(--ratio);overflow:hidden;background:var(--tint);flex:none}
.media img{width:100%;height:100%;object-fit:cover}
.ph{position:absolute;inset:0;display:grid;place-items:center;background:linear-gradient(135deg,var(--p),var(--s));color:var(--on-p)}
.ph::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 20% 15%,rgba(255,255,255,.28),transparent 45%),repeating-linear-gradient(135deg,rgba(255,255,255,.07) 0 2px,transparent 2px 14px)}
.ph span{position:relative;font-family:var(--f-head);font-weight:var(--w-head);font-size:clamp(56px,18cqw,128px);line-height:1;opacity:.92;text-transform:uppercase}
.media,.gallery figure{container-type:inline-size}
.info{padding:18px;display:flex;flex-direction:column;gap:8px;flex:1}
.info h2,.row-main h2,.tier h2,.menu-item h2{font-size:20px;line-height:1.2}
.info h2 a,.row-main h2 a,.tier h2 a,.menu-item h2 a{text-decoration:none}
.info h2 a::after{content:"";position:absolute;inset:0}
.desc{color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.info .buy{margin-top:auto}
.info .price{margin-bottom:6px}
.empty{padding:32px 24px;border:var(--bw,1px) dashed var(--line2);border-radius:var(--r);color:var(--muted);text-align:center}
.feature{display:grid;grid-template-columns:1fr}
.feature .info{padding:24px;gap:12px;justify-content:center}
.feature .info h2{font-size:clamp(22px,2.6vw,30px)}
.feature .desc{-webkit-line-clamp:6}
.feature .price{font-size:26px}
.rows{display:grid;gap:14px}
.row{position:relative;display:grid;gap:16px;align-items:center;padding:20px;border:var(--bw) solid var(--bd);border-radius:var(--r);background:var(--g);box-shadow:var(--shadow);min-width:0}
.row .media{width:100%;border-radius:var(--r-img);aspect-ratio:16/9;margin:0}
.row-main{display:grid;gap:6px;min-width:0}
.row-side{display:flex;align-items:center;justify-content:space-between;gap:16px}
.row .price{font-size:22px}
.tiers{display:grid;gap:20px;align-items:stretch}
.tier{position:relative;display:flex;flex-direction:column;gap:12px;padding:28px 24px;border:var(--bw) solid var(--bd);border-radius:var(--r);background:var(--g);box-shadow:var(--shadow);min-width:0}
.tier .media{margin:-28px -24px 8px;border-radius:0}
.tier .price{font-family:var(--f-head);font-weight:var(--w-head);font-size:clamp(34px,5vw,48px);line-height:1;letter-spacing:var(--ls-head)}
.tier .price span{font-family:var(--f-body);font-size:15px;letter-spacing:0}
.tier .desc{-webkit-line-clamp:8;flex:1}
.tier.first{border-color:var(--p-text);outline:1px solid var(--p-text)}
.tier .tag{position:absolute;top:14px;right:14px;z-index:1;font-family:var(--f-label);font-size:12px;font-weight:600;text-transform:var(--tt-label);letter-spacing:var(--ls-label);background:var(--p);color:var(--on-p);padding:4px 10px;border-radius:var(--r-btn)}
.menu{display:grid;gap:0 48px}
.menu-item{position:relative;display:grid;grid-template-columns:88px minmax(0,1fr);gap:16px;align-items:start;padding:20px 0;border:0;border-bottom:1px solid var(--line);border-radius:0;box-shadow:none;background:transparent;overflow:visible;min-width:0}
.menu-item .media{width:88px;aspect-ratio:1;border-radius:var(--r-img);margin:0;border:0}
.menu-top{display:flex;align-items:baseline;gap:10px}
.menu-top h2{min-width:0}
.menu-top i{flex:1;min-width:12px;border-bottom:2px dotted var(--line2);transform:translateY(-4px)}
.menu-body{display:grid;gap:8px;min-width:0}
.menu-item .buy{min-height:44px;padding:0 18px;justify-self:start}
.steps{display:grid;gap:16px;counter-reset:step}
.step{padding:22px;border:var(--bw) solid var(--bd);border-radius:var(--r);box-shadow:var(--shadow);display:grid;gap:8px;align-content:start;min-width:0}
.step-n{width:36px;height:36px;display:grid;place-items:center;border-radius:50%;background:var(--tint);color:var(--p-text);font-weight:700;font-variant-numeric:tabular-nums}
.step h3{font-size:19px;line-height:1.2}
.step p{color:var(--muted)}
.about{display:grid;gap:24px}
.about h2{font-size:var(--h2)}
.about-text{display:grid;gap:14px;font-size:clamp(17px,1.6vw,19px);max-width:64ch}
.quotes{display:grid;gap:16px}
.quote{margin:0;padding:24px;border:var(--bw) solid var(--bd);border-radius:var(--r);box-shadow:var(--shadow);display:grid;gap:14px;align-content:start}
.quote blockquote{margin:0;font-size:18px;line-height:1.45}
.quote figcaption{font-size:14px;color:var(--muted);font-weight:600}
.faq{display:grid;gap:10px;max-width:760px}
.faq details{border:var(--bw) solid var(--bd);border-radius:min(var(--r),16px);box-shadow:var(--shadow)}
.faq summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:16px;align-items:center;min-height:56px;padding:12px 20px;font-weight:600}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";font-size:22px;line-height:1;color:var(--p-text);flex:none}
.faq details[open] summary::after{content:"–"}
.faq details p{padding:0 20px 18px;color:var(--muted);white-space:pre-line}
.updates{padding:clamp(24px,4vw,48px);border:var(--bw) solid var(--bd);border-radius:var(--r);background:var(--tint);box-shadow:var(--shadow)}
.updates h2{font-size:var(--h2);margin:0 0 8px}
.updates>p{color:var(--muted);margin:0 0 20px;max-width:56ch}
.updates form{display:grid;gap:12px}
.updates .fields{display:grid;gap:10px}
.updates label,.stack label{display:grid;gap:4px;font-weight:600;font-size:14px;text-align:left}
.updates .consent{display:flex;gap:10px;align-items:flex-start;font-weight:400;font-size:14px;color:var(--muted)}
.updates .consent input{width:20px;min-height:20px;height:20px;margin:2px 0 0;flex:none;accent-color:var(--p)}
.updates .said{font-weight:600}
.hero .updates{margin-top:32px;text-align:left;max-width:680px}
.hero-center .updates{margin-inline:auto}
input{font:inherit;font-size:16px;min-height:48px;padding:10px 14px;border:1px solid var(--line2);border-radius:min(var(--r-btn),12px);background:#fff;color:#17161a;width:100%}
input:focus{outline:none;border-color:var(--p-text);box-shadow:0 0 0 3px color-mix(in srgb,var(--p-text) 25%,transparent)}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.error{color:#b91c1c;margin:0}
.error:not(:empty){background:#fff;padding:8px 12px;border-radius:6px;border:1px solid #f3c4c4}
.note{margin:24px 0 0;padding:12px 16px;border:1px solid var(--line);border-radius:min(var(--r),12px);box-shadow:inset 3px 0 0 var(--p-text);background:var(--tint)}
footer{margin-top:calc(var(--sp)/2);padding:48px 0 32px;border-top:1px solid var(--line);font-size:15px}
.foot{display:grid;gap:32px}
.foot-brand p{color:var(--muted);max-width:40ch;margin-top:8px}
.foot nav{display:grid;gap:4px;align-content:start}
.foot h2{font-family:var(--f-label);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:0 0 6px;line-height:1.4}
.foot nav a{text-decoration:none;display:flex;align-items:center;min-height:36px;overflow-wrap:anywhere}
.foot nav a:hover{text-decoration:underline}
.foot-base{display:flex;flex-wrap:wrap;gap:6px 20px;margin-top:32px;padding-top:20px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
.page{padding:8px 0 32px}
.crumb{display:inline-flex;align-items:center;min-height:48px;font-size:15px;text-decoration:none;color:var(--muted)}
.crumb:hover{color:var(--i);text-decoration:underline}
.pp{display:grid;gap:28px;padding:8px 0 32px}
.pp>*{min-width:0}
.gallery{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;border:var(--bw) solid var(--bd);border-radius:var(--r);box-shadow:var(--shadow)}
.gallery::-webkit-scrollbar{display:none}
.gallery figure{position:relative;margin:0;flex:0 0 100%;scroll-snap-align:start;aspect-ratio:1}
.gallery img{width:100%;height:100%;object-fit:cover}
.thumbs{display:flex;gap:8px;margin-top:10px;overflow-x:auto}
.thumbs a{flex:0 0 64px;height:64px;border:1px solid var(--line);border-radius:min(var(--r-img),8px);overflow:hidden}
.thumbs img{width:100%;height:100%;object-fit:cover}
.pp h1{font-size:clamp(30px,5vw,52px);margin:0 0 12px}
.pp .price{font-size:24px;margin:0 0 18px}
.pp .about{white-space:pre-line;margin:0 0 24px;max-width:60ch;display:block;font-size:17px}
.pp .buy{width:100%;max-width:440px}
.pp .fine{margin:14px 0 0;max-width:440px}
.pp .trust{display:grid;gap:8px;margin-top:24px;padding-top:20px;border-top:1px solid var(--line)}
.stack{display:grid;gap:14px;max-width:440px;margin-top:24px}
.stack p{font-size:15px}
.stack fieldset{border:0;padding:0;margin:0;display:grid;gap:14px}
.stack fieldset[hidden]{display:none}
.stack .buy{width:100%}
.thumb{display:flex;gap:12px;align-items:center;margin:16px 0 0}
.thumb img{width:72px;height:72px;object-fit:cover;border:1px solid var(--line);border-radius:min(var(--r-img),8px)}
.checkout h1{font-size:clamp(30px,5vw,52px);margin:24px 0 12px}
.legal{max-width:760px;padding-top:24px}
.legal h1{font-size:clamp(30px,5vw,52px)}
.legal h2{font-size:22px;margin:32px 0 8px}
.legal p,.legal li{max-width:68ch;margin:0 0 12px}
.legal .updated{color:var(--muted);font-size:14px}
.legal a,.note a,.fine a,.error a{color:var(--p-text)}
.error a{color:#b91c1c}
.hero-bleed{position:relative;display:grid;align-items:end;min-height:min(78vh,720px);padding:0;color:#fff;background:#17161a;overflow:hidden}
.hero-bleed .bg{position:absolute;inset:0}
.hero-bleed .bg img{width:100%;height:100%;object-fit:cover}
.hero-bleed .bg::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,14,.25),rgba(10,10,14,.5) 45%,rgba(10,10,14,.86))}
.hero-bleed .wrap{position:relative;padding:clamp(120px,22vh,220px) 0 clamp(32px,6vw,72px)}
.hero-bleed .kicker{color:#fff;background:transparent;border:0;padding:0;transform:none;box-shadow:none}
.hero-bleed .lede{color:rgba(255,255,255,.88)}
.hero-bleed .buy.quiet{color:#fff;border-color:rgba(255,255,255,.6)}
.hero-aside{display:grid;gap:0;padding:8px 22px;border:var(--bw) solid var(--bd);border-radius:var(--r);background:var(--g);box-shadow:var(--shadow)}
.hero-aside a{display:flex;justify-content:space-between;gap:16px;align-items:baseline;padding:16px 0;text-decoration:none;border-bottom:1px solid var(--line);min-height:48px}
.hero-aside a:last-child{border-bottom:0}
.hero-aside b{font-weight:600;min-width:0;overflow-wrap:anywhere}
.hero-aside span{flex:none;font-variant-numeric:tabular-nums;color:var(--p-text);font-weight:700}
.hero-mark{width:72px;height:72px;margin:0 auto 24px;border-radius:min(var(--r),20px)}
.hero-art{position:relative;aspect-ratio:5/4;border-radius:var(--r);overflow:hidden;border:var(--bw) solid var(--bd);box-shadow:var(--shadow);container-type:inline-size}
.hero-art img{width:100%;height:100%;object-fit:cover}
@media(min-width:600px){
.wrap{width:min(100% - 64px,1120px)}
.products{grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}
.updates .fields{grid-template-columns:1fr 1fr auto;align-items:end}
.steps{grid-template-columns:repeat(3,minmax(0,1fr))}
.quotes{grid-template-columns:repeat(2,minmax(0,1fr))}
.tiers{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}
.row{grid-template-columns:minmax(0,1fr) auto;padding:24px 28px}
.row.has-media{grid-template-columns:160px minmax(0,1fr) auto}
.row-side{flex-direction:column;align-items:flex-end;justify-content:center}
.foot{grid-template-columns:minmax(0,2fr) minmax(0,1fr) minmax(0,1fr)}
.feature{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr)}
.feature .media{aspect-ratio:auto;min-height:320px;height:100%}
.feature .info{padding:36px}
}
@media(min-width:900px){
.products{grid-template-columns:repeat(3,minmax(0,1fr))}
.hero-split{grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:56px}
.pp{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:56px;padding-top:16px}
.menu{grid-template-columns:repeat(2,minmax(0,1fr))}
.about{grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:56px}
.quotes{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.buy{transition:none}}
`;

/** The stylesheet of one store: the palette, the style's properties, the base rules, then the style's own rules. */
export function storefrontCss(source, brand) {
  const style = byId(STYLES, source.style) ?? STYLES[0];
  const pal = palette(brand);
  const vars = [...Object.entries(pal).filter(([k]) => k !== 'dark'), ...Object.entries(style.vars)].map(([k, v]) => `--${k}:${v}`).join(';');
  return `:root{${vars};color-scheme:${pal.dark ? 'dark' : 'light'}}${BASE.replace(/\n/g, '')}${style.css}`;
}

/** What a page's `<head>` loads for the style: its fonts (Google Fonts, one request). */
export function styleHead(source) {
  const style = byId(STYLES, source.style) ?? STYLES[0];
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${esc(style.fonts)}">`;
}

// ---------- the front page ----------

/**
 * The front page's body. `ctx` is what `storefrontFiles` knows: { biz, source, active (the active products), images,
 * sells(p), picture(img, alt, opts), priceLine(p), contact, updates (the sign-up panel, once per page) }.
 */
export function frontPage(ctx) {
  const { biz, source, active, images, sells, picture, priceLine, contact, contactText, updates } = ctx;
  const t = byId(TEMPLATES, source.template) ?? TEMPLATES[0];
  const c = source.copy;
  const headline = c.headline || biz.tagline || biz.name;
  const subhead = c.subhead || (same(biz.idea, headline) ? '' : text(biz.idea));
  const kicker = c.kicker || t.kicker;
  const cta = c.cta || t.cta;
  const first = active[0];
  const href = p => `product/${encodeURIComponent(p.id)}.html`;
  const buyHref = p => `checkout.html?p=${encodeURIComponent(p.id)}`;
  const label = p => (sells(p) ? t.buy : t.order);
  const pic = (p, opts) => picture(images.get(p.id)?.[0], p.name, opts);
  const ph = name => `<div class="ph" aria-hidden="true"><span>${esc((String(name).trim()[0] ?? '').toUpperCase())}</span></div>`;
  const media = (p, opts) => `<div class="media">${pic(p, opts) || ph(p.name)}</div>`;
  const desc = p => (p.description ? `<p class="desc">${esc(p.description)}</p>` : '');
  const anySell = active.some(sells), digital = active.some(isDigital), physical = active.some(p => !isDigital(p));

  // What is true of this store today, said once under the hero.
  const facts = [];
  if (active.length) {
    facts.push(anySell ? 'Secure payment on Stripe' : 'Order by email, nothing charged here');
    if (digital) facts.push(anySell ? 'Download link by email at once' : 'Downloads sent by email');
    if (physical) facts.push('Ships within the United States');
    facts.push('Refunds as our policy says');
  }
  const trust = facts.length ? `<ul class="trust">${facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '';
  const head = `<p class="kicker">${esc(kicker)}</p><h1>${esc(headline)}</h1>${subhead ? `<p class="lede">${esc(subhead)}</p>` : ''}`;
  const toProducts = `<a class="buy" href="#products">${esc(cta)}</a>`;
  const toUpdates = quiet => `<a class="buy${quiet ? ' quiet' : ''}" href="#updates">Get updates</a>`;
  const none = `<p class="empty">Products are on their way. Ask for updates to hear first.</p>`;
  const secHead = (title, sub = '') => `<div class="sec-head"><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;
  const productsTitle = c.productsTitle || t.productsTitle;

  const card = (p, i) => `<article class="product">${media(p, { eager: i === 0 })}<div class="info"><h2><a href="${href(p)}">${esc(p.name)}</a></h2>${desc(p)}<p class="price">${priceLine(p)}</p><a class="buy" href="${buyHref(p)}">${label(p)}</a></div></article>`;
  const grid = list => `<div class="products">${list.map(card).join('')}</div>`;

  // The sections every template may show, each hidden until it has words.
  const how = () => {
    if (!source.sections.how || !active.length) return '';
    const steps = [
      ['Choose', 'Every price is on the page. You need no account.'],
      anySell ? ['Pay securely', `You pay on Stripe's secure page. Your card details never reach ${biz.name}.`] : ['Order by email', `Write to ${contactText}. Nothing is charged on this site.`],
      !anySell ? ['We answer you', 'We reply with how to pay and when it arrives.']
        : digital && physical ? ['It is on its way', 'A download link comes to your email at once. Everything else ships within the United States.']
        : digital ? ['Download it', 'The link comes to your email as soon as you pay.'] : ['We ship it', 'Your order ships within the United States.'],
    ];
    return `<section class="sec wrap" id="how" aria-labelledby="how-title"><div class="sec-head"><h2 id="how-title">How it works</h2></div><div class="steps">${steps.map(([a, b], i) => `<div class="step"><span class="step-n">${i + 1}</span><h3>${esc(a)}</h3><p>${esc(b)}</p></div>`).join('')}</div></section>`;
  };
  const points = () => source.sections.points && c.points.length
    ? `<section class="sec wrap" id="points"><div class="steps">${c.points.map(x => `<div class="step">${x.title ? `<h3>${esc(x.title)}</h3>` : ''}${x.text ? `<p>${esc(x.text)}</p>` : ''}</div>`).join('')}</div></section>` : '';
  const about = () => source.sections.about && c.about.text
    ? `<section class="sec wrap about" id="about"><h2>${esc(c.about.title || `About ${biz.name}`)}</h2><div class="about-text">${c.about.text.split(/\n\s*\n/).map(x => `<p>${esc(x.trim())}</p>`).join('')}</div></section>` : '';
  const quotes = () => source.sections.testimonials && c.testimonials.length
    ? `<section class="sec wrap" id="testimonials" aria-label="What people say"><div class="quotes">${c.testimonials.map(q => `<figure class="quote"><blockquote>${esc(q.quote)}</blockquote>${q.name ? `<figcaption>${esc(q.name)}</figcaption>` : ''}</figure>`).join('')}</div></section>` : '';
  const faq = () => source.sections.faq && c.faq.length
    ? `<section class="sec wrap" id="faq" aria-labelledby="faq-title"><div class="sec-head"><h2 id="faq-title">Questions</h2></div><div class="faq">${c.faq.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div></section>` : '';
  const updatesSec = `<section class="sec wrap">${updates}</section>`;
  const productsSec = (inner, { title = productsTitle, cls = '' } = {}) => `<section id="products" class="sec wrap${cls}" aria-labelledby="products-title"><div class="sec-head"><h2 id="products-title">${esc(title)}</h2></div>${inner}</section>`;

  const layouts = {
    // One product takes the page: the words beside it, the product as a wide card, the rest below.
    spotlight: () => {
      const feature = first ? `<article class="product feature">${media(first, { eager: true, sizes: '(min-width: 600px) 50vw, 100vw' })}<div class="info"><h2><a href="${href(first)}">${esc(first.name)}</a></h2>${desc(first)}<p class="price">${priceLine(first)}</p><a class="buy" href="${buyHref(first)}">${label(first)}</a></div></article>` : none;
      const more = active.length > 1 ? `<div class="sec-head" style="margin-top:56px"><h2>${esc(productsTitle)}</h2></div>${grid(active.slice(1))}` : '';
      return `<section class="hero hero-center band"><div class="wrap">${head}<div class="actions">${first ? `<a class="buy" href="${buyHref(first)}">${esc(c.cta || `${label(first)}${first.priceLabel ? ` · ${first.priceLabel}` : ''}`)}</a>` : ''}${toUpdates(!!first)}</div>${trust}</div></section>`
        + `<section id="products" class="sec wrap" aria-label="Products">${feature}${more}</section>${how()}${points()}${about()}${quotes()}${faq()}${updatesSec}`;
    },
    // A small shop: a banner with a picture, then the grid.
    shop: () => {
      const art = first ? `<div class="hero-art">${pic(first, { eager: true, sizes: '(min-width: 900px) 45vw, 100vw' }) || ph(biz.name)}</div>` : `<div class="hero-art">${ph(biz.name)}</div>`;
      return `<section class="hero band"><div class="wrap hero-split"><div>${head}<div class="actions">${active.length ? toProducts : ''}${toUpdates(active.length > 0)}</div>${trust}</div>${art}</div></section>`
        + productsSec(active.length ? grid(active) : none) + how() + points() + about() + quotes() + faq() + updatesSec;
    },
    // A pre-order or a waitlist: the sign-up is the hero.
    launch: () => `<section class="hero hero-center band"><div class="wrap">${head}${updates}${trust}</div></section>`
      + (active.length ? productsSec(grid(active)) : '') + how() + points() + about() + quotes() + faq(),
    // Services: the packages as a list, each with its price and its next step.
    services: () => {
      const aside = active.length ? `<div class="hero-aside" aria-label="${esc(productsTitle)}">${active.slice(0, 4).map(p => `<a href="${href(p)}"><b>${esc(p.name)}</b><span>${priceLine(p)}</span></a>`).join('')}</div>` : `<div class="hero-art">${ph(biz.name)}</div>`;
      const row = p => { const im = pic(p, { sizes: '160px' }); return `<article class="product row${im ? ' has-media' : ''}">${im ? `<div class="media">${im}</div>` : ''}<div class="row-main"><h2><a href="${href(p)}">${esc(p.name)}</a></h2>${desc(p)}</div><div class="row-side"><p class="price">${priceLine(p)}</p><a class="buy" href="${buyHref(p)}">${label(p)}</a></div></article>`; };
      return `<section class="hero"><div class="wrap hero-split"><div>${head}<div class="actions">${active.length ? toProducts : ''}<a class="buy quiet" href="mailto:${contact}">Talk to us</a></div>${trust}</div>${aside}</div></section>`
        + productsSec(active.length ? `<div class="rows">${active.map(row).join('')}</div>` : none) + how() + points() + about() + quotes() + faq() + updatesSec;
    },
    // A creator or a community: the plans side by side.
    club: () => {
      const tier = (p, i) => { const im = pic(p, { sizes: '(min-width: 600px) 33vw, 100vw' }); return `<article class="product tier${i === 0 && active.length > 1 ? ' first' : ''}">${i === 0 && active.length > 1 ? '<span class="tag">Start here</span>' : ''}${im ? `<div class="media">${im}</div>` : ''}<h2><a href="${href(p)}">${esc(p.name)}</a></h2><p class="price">${priceLine(p)}</p>${desc(p)}<a class="buy" href="${buyHref(p)}">${label(p)}</a></article>`; };
      return `<section class="hero hero-center"><div class="wrap"><img class="hero-mark" src="logo.svg" alt="" width="72" height="72">${head}<div class="actions">${active.length ? toProducts : ''}${toUpdates(active.length > 0)}</div>${trust}</div></section>`
        + productsSec(active.length ? `<div class="tiers">${active.map(tier).join('')}</div>` : none, {}) + points() + quotes() + how() + about() + faq() + updatesSec;
    },
    // Food or a local maker: a full-width picture, the story, then what is made.
    maker: () => {
      const bg = first ? pic(first, { eager: true, sizes: '100vw' }) : '';
      const item = p => `<article class="product menu-item">${media(p, { sizes: '88px' })}<div class="menu-body"><div class="menu-top"><h2><a href="${href(p)}">${esc(p.name)}</a></h2><i></i><p class="price">${priceLine(p)}</p></div>${desc(p)}<a class="buy quiet" href="${buyHref(p)}">${label(p)}</a></div></article>`;
      const hero = bg
        ? `<section class="hero hero-bleed"><div class="bg">${bg}</div><div class="wrap">${head}<div class="actions">${toProducts}${toUpdates(true)}</div></div></section>${trust ? `<div class="wrap">${trust}</div>` : ''}`
        : `<section class="hero band"><div class="wrap">${head}<div class="actions">${active.length ? toProducts : ''}${toUpdates(active.length > 0)}</div>${trust}</div></section>`;
      return hero + about() + productsSec(active.length ? `<div class="menu">${active.map(item).join('')}</div>` : none) + points() + quotes() + how() + faq() + updatesSec;
    },
  };
  return (layouts[t.id] ?? layouts.shop)();
}

/** The word on a product page's button, by the store's template. */
export const buyWord = (source, sells) => { const t = byId(TEMPLATES, source.template) ?? TEMPLATES[0]; return sells ? t.buy : t.order; };
