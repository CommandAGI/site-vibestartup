// A business is a folder in the founder's Drive, a co-founder thread, its triggers and a site (docs/ARCHITECTURE.md).
// This module holds the record's shape, the creation sequence, the co-founder's charter, the memory-file templates,
// the brand generator (a script, labelled so) and the storefront writer. Everything here is the founder's own
// CommandAGI objects; nothing is kept anywhere else.
import { api, auth, drive, threads, sites, email, mcp, BRAND } from './api.js';
import { slugify } from './ui.js';

export const ROOT = 'Businesses';
export const folderOf = slug => `${ROOT}/${slug}`;
export const addressOf = (userId, slug, file = 'business.json') => `cloud://home/${userId}/${folderOf(slug)}/${file}`;

export const LAUNCH_WEEK = [
  { day: 1, title: 'Site and first offer', about: 'The storefront is live and one product is active.' },
  { day: 2, title: 'Your warm list', about: 'Share 5 to 15 real people who may want to hear about the business. Only the people you give are recorded.' },
  { day: 3, title: 'Personal notes', about: 'A short, personal note to each person on the warm list, drafted for you to send or approve.' },
  { day: 4, title: 'Launch posts', about: 'Launch posts in your brand for each connected account, or ready for you to post yourself.' },
  { day: 5, title: 'Launch day', about: 'The launch offer goes live and the first follow-ups are scheduled.' },
  { day: 6, title: 'Follow-ups', about: 'Answer every reply, thank every buyer, ask every visitor who left a cart.' },
  { day: 7, title: 'Debrief', about: 'What worked, what did not, and the plan for next week, written into MEMORY.md.' },
];
export const launchDay = biz => {
  const started = biz?.launchWeek?.startedAt;
  if (!started) return 1;
  return Math.min(8, Math.floor((Date.now() - started) / 86400000) + 1);
};

export const VIBES = [
  { id: 'bold', name: 'Bold', about: 'High contrast, strong typography, striking.' },
  { id: 'clean', name: 'Clean', about: 'Lots of white space, calm and precise.' },
  { id: 'warm', name: 'Warm', about: 'Soft colours, friendly shapes, human.' },
  { id: 'playful', name: 'Playful', about: 'Bright colour, rounded type, a wink.' },
  { id: 'premium', name: 'Premium', about: 'Dark, restrained, considered.' },
];
export const VOICES = [
  { id: 'casual', name: 'Casual & friendly', sample: '“Hey! Welcome to our shop — grab something you love.”' },
  { id: 'professional', name: 'Professional', sample: '“Welcome. Here is what we make, and how to order.”' },
  { id: 'witty', name: 'Witty', sample: '“Yes, it is as good as it looks. No, you do not need two. (You want two.)”' },
  { id: 'bold', name: 'Bold', sample: '“Stop scrolling. This is the one.”' },
];
export const PARTNERS = [
  { id: 'hustler', name: 'The Hustler', about: 'Move fast, ship fast, break through walls.', traits: ['Proactive', 'Bold', 'Energetic'] },
  { id: 'strategist', name: 'The Strategist', about: 'Think deep, plan carefully, win big.', traits: ['Analytical', 'Methodical', 'Patient'] },
  { id: 'creative', name: 'The Creative', about: 'Beautiful products, delightful experiences.', traits: ['Design-minded', 'Experimental', 'Inspiring'] },
  { id: 'operator', name: 'The Operator', about: 'Systems, processes, reliable execution.', traits: ['Systematic', 'Efficient', 'Organized'] },
];
export const COFOUNDER_NAMES = ['Juno', 'Lumi', 'Remy', 'Sol', 'Noor', 'Kai', 'Ada', 'Pip'];
export const IDEA_STARTERS = [
  'A digital product store for AI prompts and workflows',
  'A podcast production service for busy founders',
  'A niche calculator and spreadsheet shop',
  'A coaching and consultation booking page',
  'A test-prep and study-guide store',
  'A resume and career package shop',
  'A small-batch ceramics studio with a pre-order shop',
  'A camera-enabled desk lamp that lets an assistant see your notebook',
];

// ---------- the sketch: a business from an idea, in the browser, labelled as a script's work ----------

const STOP = new Set(['a', 'an', 'the', 'for', 'that', 'with', 'and', 'your', 'you', 'to', 'of', 'in', 'on', 'my', 'our', 'into', 'from', 'this', 'it', 'is', 'are', 'who', 'lets', 'let', 'who', 'their']);
const words = idea => String(idea).replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/[\s-]+/).filter(w => w.length > 2 && !STOP.has(w.toLowerCase()));
const cap = w => w[0].toUpperCase() + w.slice(1).toLowerCase();
export function suggestNames(idea) {
  const ws = words(idea);
  const nouns = ws.filter(w => w.length > 3).slice(0, 6);
  const out = new Set();
  if (nouns.length >= 2) out.add(cap(nouns[0]) + cap(nouns[1]));
  if (nouns[0]) out.add(cap(nouns[0]) + 'ly');
  if (nouns[0]) out.add(cap(nouns[0]) + ' Co');
  if (nouns[1]) out.add(cap(nouns[1]) + ' Lab');
  if (nouns[0] && nouns[2]) out.add(cap(nouns[0]) + cap(nouns[2]));
  if (nouns[0]) out.add('The ' + cap(nouns[0]) + ' Shop');
  return [...out].slice(0, 5);
}
export function suggestTagline(idea) {
  const s = String(idea).trim().replace(/\.$/, '');
  return s ? s[0].toUpperCase() + s.slice(1) + '.' : '';
}
export function suggestProduct(idea) {
  const ws = words(idea).filter(w => w.length > 3);
  return ws.length ? 'The ' + ws.slice(0, 2).map(cap).join(' ') : 'The first offer';
}
export function suggestBlueprints(idea) {
  const hardware = /lamp|device|robot|camera|sensor|board|printer|hardware|kit|gadget/i.test(idea);
  const service = /service|coach|consult|agency|booking|studio|production/i.test(idea);
  const digital = /prompt|template|course|guide|ebook|spreadsheet|calculator|software|app|download/i.test(idea);
  const list = [];
  if (hardware) list.push({ id: 'demo', title: 'Public demo and waitlist', about: 'With no audience yet, a demo and a waitlist test demand before any hardware is made.' });
  if (service) list.push({ id: 'booking', title: 'A booking page with one package', about: 'One clear offer, a price, a calendar: the fastest way to a first paying client.' });
  if (digital) list.push({ id: 'digital', title: 'One digital product, sold now', about: 'A single download with a checkout; more products once the first one sells.' });
  list.push({ id: 'preorder', title: 'A pre-order storefront', about: 'Sell the first batch before it exists; make only what sold.' });
  list.push({ id: 'waitlist', title: 'Landing page and waitlist', about: 'Say what it is, collect emails, launch to the list.' });
  return list.slice(0, 3);
}

/** A brand kit from the name and the vibe: a palette by hue, a type pairing and voice words. Made by a script. */
export function brandFor(name, vibe = 'clean', voice = 'casual') {
  let hsum = 0; for (const c of String(name)) hsum = (hsum * 31 + c.codePointAt(0)) % 360;
  const hsl = (hh, s, l) => `hsl(${Math.round((hh + 360) % 360)} ${s}% ${l}%)`;
  const dark = vibe === 'premium';
  const sat = vibe === 'playful' || vibe === 'bold' ? 86 : vibe === 'warm' ? 70 : 60;
  const brand = {
    primary: hsl(hsum, sat, dark ? 62 : 42),
    secondary: hsl(hsum + 40, sat - 10, dark ? 70 : 58),
    accent: hsl(hsum + 180, sat, 56),
    ground: dark ? 'hsl(240 8% 10%)' : vibe === 'warm' ? 'hsl(36 60% 97%)' : '#ffffff',
    ink: dark ? 'hsl(40 20% 94%)' : 'hsl(240 10% 12%)',
    type: vibe === 'bold' ? 'Condensed grotesque headlines, sans-serif body' : vibe === 'premium' ? 'Serif headlines, sans-serif body' : vibe === 'playful' ? 'Rounded sans headlines and body' : 'Geometric sans headlines, humanist sans body',
    voice: voice === 'casual' ? ['warm', 'plain-spoken', 'friendly'] : voice === 'witty' ? ['quick', 'dry', 'confident'] : voice === 'bold' ? ['direct', 'short', 'certain'] : ['clear', 'measured', 'courteous'],
    vibe, generated: 'by a script from the name and the vibe, not by a designer',
  };
  return brand;
}
export const markSvg = (name, brand) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="14" fill="${brand.primary}"/><text x="32" y="41" text-anchor="middle" font-family="Instrument Sans, Arial, sans-serif" font-size="28" font-weight="700" fill="${brand.ground === '#ffffff' ? '#fff' : brand.ink}">${(String(name).trim()[0] || 'V').toUpperCase()}</text></svg>`;

// ---------- the co-founder's charter ----------

export function charterFor(biz, founder) {
  const partner = PARTNERS.find(p => p.id === biz.partner) ?? PARTNERS[2];
  const voice = VOICES.find(v => v.id === biz.voice) ?? VOICES[0];
  return `You are ${biz.cofounder.name}, the AI co-founder of ${biz.name}, a business started on ${BRAND.name} (a CommandAGI brand). You say you are an AI agent whenever it matters, to the founder and to anyone you write to.

The founder is ${founder.name || 'the founder'} (${founder.email}). The business: ${biz.idea}
The first version: ${biz.blueprint?.title ?? 'a storefront with one offer'}. ${biz.blueprint?.about ?? ''}
Your character: ${partner.name}. ${partner.about} Traits: ${partner.traits.join(', ')}. The brand's voice is ${voice.name.toLowerCase()}.

Your files live in the founder's Drive at ${folderOf(biz.slug)}/ (business.json is the record; cofounder/ holds your memory: SOUL.md, BUSINESS.md, OWNER.md, PLAYBOOK.md, MEMORY.md; products/, orders/, customers/, leads/, ads/, social/, studio/, Tasks/). Read them before you act (list_drive on the folder, then read_drive_file with the file's id) and write what you learn into MEMORY.md (write_drive_file with the folder path and the file name). The storefront is a CommandAGI site${biz.site?.url ? ` at ${biz.site.url}` : ''}; its folder is ${biz.site?.folder ?? 'Sites/<name>'} and a deploy publishes it.

Rules you keep:
1. The founder decides. Before any spend, any public post, any change to the live site, any contact import and any legal filing, create a task in ${folderOf(biz.slug)}/Tasks with the labels ["biz:${biz.slug}", "needs-approval"], assigned to user:${founder.id}, that says what you propose and why, and tell the founder in chat. Do that work only after the task is approved (status doing, assigned to you).
2. No pretending. Never say a feature works that does not. A test order is a test. Count only measured numbers. If a provider is not connected (payments, ads, a social account, outbound mail), say so and stop there.
3. Money moves only by the founder's act. Never spend past an approved budget.
4. Secrets are never shown again. Never write a key or a password into chat or a file.
5. Contacts are only the ones the founder gives. Record only people the founder shares.
6. ${biz.autopilot ? 'Autopilot is on: do routine work inside the limits above and report what you did.' : 'Autopilot is off: propose, then wait.'}

The launch week is seven days: site and first offer, the warm list, personal notes, launch posts, launch day, follow-ups, debrief. Each day's work is a proposal the founder approves. Every morning's briefing (a routine) reports the numbers with their change, the highlights, today's plan and what waits on the founder, in a few short lines.

Write short, plain sentences. One idea per sentence. Say what you did, what you found, and what you need.`;
}

export function openingFor(biz, founder) {
  return `Hi ${biz.cofounder.name}. I'm ${founder.name || 'the founder'}. We're starting ${biz.name}: ${biz.idea}\n\nIntroduce yourself in three short lines, read your files in ${folderOf(biz.slug)}/cofounder, then propose the first two things to do for day one of the launch week as approval tasks (label needs-approval). Keep it short.`;
}

const memoryFiles = (biz, founder) => {
  const partner = PARTNERS.find(p => p.id === biz.partner) ?? PARTNERS[2];
  return {
    'SOUL.md': `# ${biz.cofounder.name}\n\nI am ${biz.cofounder.name}, the AI co-founder of ${biz.name}. I am an AI agent and I say so.\n\n## Character\n\n${partner.name}: ${partner.about} ${partner.traits.join(', ')}.\n\n## Voice\n\n${(VOICES.find(v => v.id === biz.voice) ?? VOICES[0]).name}. ${(VOICES.find(v => v.id === biz.voice) ?? VOICES[0]).sample}\n\n## How I work\n\n- The founder decides. Spend, public posts, live-site changes, contact imports and legal filings wait for approval.\n- I never pretend. A gap is reported as a gap.\n- I write what I learn into MEMORY.md.\n`,
    'BUSINESS.md': `# ${biz.name}\n\n${biz.idea}\n\n## The first version\n\n${biz.blueprint?.title ?? ''}. ${biz.blueprint?.about ?? ''}\n\n## Brand\n\nVibe: ${biz.vibe}. Voice: ${biz.voice}. Colours: primary ${biz.brand.primary}, secondary ${biz.brand.secondary}, accent ${biz.brand.accent}. Type: ${biz.brand.type}.\n\n## Storefront\n\n${biz.site?.url ?? 'not yet live'} (folder ${biz.site?.folder ?? ''}).\n\n## Email\n\n${biz.email?.address ?? 'not yet claimed'}\n`,
    'OWNER.md': `# The founder\n\n${founder.name || ''} (${founder.email}). Autopilot: ${biz.autopilot ? 'on' : 'off'}. Briefing: ${biz.briefing}.\n\nWhat the founder decides: spend, public posts, live-site changes, contact lists, legal filings.\n`,
    'PLAYBOOK.md': `# Playbook\n\n## Launch week\n\n${LAUNCH_WEEK.map(d => `${d.day}. ${d.title}: ${d.about}`).join('\n')}\n\n## Daily briefing\n\nNumbers with their change, highlights, today's plan, what waits on the founder. A few short lines.\n\n## Approvals\n\nA task in Tasks/ with labels biz:${biz.slug} and needs-approval, assigned to the founder. Work starts when it is approved.\n`,
    'PLATFORM.md': `# The platform\n\n${biz.name} runs on CommandAGI under the ${BRAND.name} brand. My tools reach the founder's Drive (this folder), tasks, triggers (routines) and sites (the storefront). The storefront deploys from its folder. Payments, ads, social posting and outbound mail need the founder's own provider accounts; until one is connected I stop at the call and say so.\n`,
    'MEMORY.md': `# Memory\n\n- ${new Date().toISOString().slice(0, 10)}: the business was created on ${BRAND.name}. Nothing has been learned yet.\n`,
    'CODEMAP.md': `# Code map\n\nThe storefront is a static site in the founder's Drive (${biz.site?.folder ?? 'Sites/<name>'}): index.html, style.css, products.json, checkout.html, terms.html, privacy.html. Products are products/products.json in this business's folder; a deploy copies them into the site.\n`,
    'SUPPORT.md': `# Support\n\nCustomers write to ${biz.email?.address ?? 'the business address'}. Answer within a day. A refund or a dispute is the founder's decision.\n`,
  };
};

// ---------- the storefront files ----------

export function storefrontFiles(biz, products = []) {
  const b = biz.brand;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const active = products.filter(p => p.status === 'active');
  const css = `:root{--p:${b.primary};--s:${b.secondary};--a:${b.accent};--g:${b.ground};--i:${b.ink}}*{box-sizing:border-box}body{margin:0;font-family:"Instrument Sans",system-ui,sans-serif;background:var(--g);color:var(--i);line-height:1.5}.bar{display:flex;align-items:center;gap:16px;padding:16px 24px;border-bottom:1px solid color-mix(in srgb,var(--i) 12%,transparent)}.brand{display:flex;align-items:center;gap:10px;font-weight:700;text-decoration:none;color:inherit}.brand img{width:32px;height:32px;border-radius:8px}.bar nav{margin-left:auto;display:flex;gap:16px}.bar a{color:inherit;text-decoration:none}.wrap{width:min(100% - 32px,1040px);margin:0 auto}.hero{padding:64px 0 32px}.hero h1{font-size:clamp(32px,5vw,56px);margin:0 0 12px;letter-spacing:-.02em;line-height:1.1}.hero p{font-size:18px;opacity:.8;max-width:56ch;margin:0}.products{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px;padding:32px 0}.product{border:1px solid color-mix(in srgb,var(--i) 12%,transparent);border-radius:14px;overflow:hidden;background:color-mix(in srgb,var(--g) 92%,#fff)}.swatch{aspect-ratio:4/3;background:linear-gradient(135deg,var(--p),var(--s))}.info{padding:16px;display:grid;gap:8px}.info h2{margin:0;font-size:18px}.price{font-weight:700}.buy{display:inline-block;padding:10px 18px;border-radius:999px;background:var(--p);color:#fff;text-decoration:none;font-weight:600}.buy.off{background:color-mix(in srgb,var(--i) 20%,transparent)}.empty{padding:48px 0;opacity:.7}footer{padding:40px 0;border-top:1px solid color-mix(in srgb,var(--i) 12%,transparent);font-size:14px;opacity:.8}footer a{color:inherit}.test{display:inline-block;padding:2px 8px;border-radius:999px;background:#fde68a;color:#78350f;font-size:12px;font-weight:600;margin-left:8px}`;
  const productCard = p => `<article class="product"><div class="swatch" role="img" aria-label="${esc(p.name)}"></div><div class="info"><h2>${esc(p.name)}</h2><p>${esc(p.description ?? '')}</p><p class="price">${esc(p.priceLabel ?? '')}${p.recurring ? ` <span>/ ${esc(p.interval ?? 'month')}</span>` : ''}</p>${biz.payments?.connected ? `<a class="buy" href="checkout.html?p=${encodeURIComponent(p.id)}">Buy</a>` : `<a class="buy" href="checkout.html?p=${encodeURIComponent(p.id)}">Buy <span class="test">test mode</span></a>`}</div></article>`;
  const index = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(biz.name)}</title><meta name="description" content="${esc(biz.tagline ?? biz.idea)}"><link rel="icon" href="logo.svg" type="image/svg+xml"><link rel="stylesheet" href="style.css"></head><body><header class="bar"><a class="brand" href="./"><img src="logo.svg" alt="">${esc(biz.name)}</a><nav><a href="#products">Products</a><a href="mailto:${esc(biz.email?.address ?? BRAND.support)}">Contact</a></nav></header><main class="wrap"><section class="hero"><h1>${esc(biz.tagline ?? biz.name)}</h1><p>${esc(biz.idea)}</p></section><section id="products" class="products">${active.length ? active.map(productCard).join('') : `<p class="empty">Products are on their way. Write to <a href="mailto:${esc(biz.email?.address ?? BRAND.support)}">${esc(biz.email?.address ?? BRAND.support)}</a> to hear first.</p>`}</section></main><footer><div class="wrap">© ${new Date().getFullYear()} ${esc(biz.name)} · <a href="terms.html">Terms</a> · <a href="privacy.html">Privacy</a> · Built with ${esc(BRAND.name)}</div></footer></body></html>`;
  const checkout = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Checkout · ${esc(biz.name)}</title><link rel="stylesheet" href="style.css"></head><body><header class="bar"><a class="brand" href="./"><img src="logo.svg" alt="">${esc(biz.name)}</a></header><main class="wrap"><section class="hero"><h1>Checkout</h1><p id="line">Loading…</p>${biz.payments?.connected ? '' : `<p><strong>Checkout opens when ${esc(biz.name)} connects a payment provider.</strong> Until then, order by email: <a id="mail" href="mailto:${esc(biz.email?.address ?? BRAND.support)}">${esc(biz.email?.address ?? BRAND.support)}</a>. Nothing is charged here.</p>`}</section></main><script>const p=new URLSearchParams(location.search).get('p');fetch('products.json').then(r=>r.json()).then(list=>{const it=list.find(x=>x.id===p);document.getElementById('line').textContent=it?it.name+' · '+(it.priceLabel||''):'That product is not here.';const m=document.getElementById('mail');if(m&&it)m.href+='?subject='+encodeURIComponent('Order: '+it.name)}).catch(()=>{document.getElementById('line').textContent='Could not load the product.'})</script></body></html>`;
  const legal = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · ${esc(biz.name)}</title><link rel="stylesheet" href="style.css"></head><body><header class="bar"><a class="brand" href="./"><img src="logo.svg" alt="">${esc(biz.name)}</a></header><main class="wrap"><section class="hero"><h1>${esc(title)}</h1></section>${body}</main></body></html>`;
  const terms = legal('Terms', `<p>${esc(biz.name)} sells what its pages describe. An order is accepted when it is confirmed by email. A test order is never charged and never shipped. Questions: <a href="mailto:${esc(biz.email?.address ?? BRAND.support)}">${esc(biz.email?.address ?? BRAND.support)}</a>.</p><p>These terms are a plain starting draft written by ${esc(BRAND.name)}; the founder may replace them.</p>`);
  const privacy = legal('Privacy', `<p>${esc(biz.name)} keeps the details you give to place an order, and nothing else. It does not sell your data. Write to <a href="mailto:${esc(biz.email?.address ?? BRAND.support)}">${esc(biz.email?.address ?? BRAND.support)}</a> to see or delete what it holds.</p><p>This notice is a plain starting draft written by ${esc(BRAND.name)}; the founder may replace it.</p>`);
  return {
    'index.html': index,
    'style.css': css,
    'checkout.html': checkout,
    'terms.html': terms,
    'privacy.html': privacy,
    'products.json': JSON.stringify(active.map(p => ({ id: p.id, name: p.name, description: p.description ?? '', priceLabel: p.priceLabel ?? '', recurring: !!p.recurring, interval: p.interval ?? null })), null, 2) + '\n',
    'logo.svg': markSvg(biz.name, biz.brand),
  };
}

// ---------- reading and writing the record ----------

export async function readBusiness(slug) {
  const b = await drive.readJsonPath(folderOf(slug), 'business.json');
  if (!b) throw Object.assign(new Error('That business is not in your Drive.'), { code: 'not_found' });
  return b;
}
export async function writeBusiness(biz) {
  biz.updatedAt = Date.now();
  await drive.writeJson(folderOf(biz.slug), 'business.json', biz);
  return biz;
}
export async function listBusinesses() {
  const folders = (await drive.list(ROOT).catch(() => [])).filter(f => f.type === 'folder' || f.type === 'directory' || !f.contentType);
  const out = [];
  for (const f of folders) {
    const b = await drive.readJsonPath(folderOf(f.name), 'business.json').catch(() => null);
    if (b) out.push(b);
  }
  return out.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/** Read a JSON file of the business, or the fallback. */
export const readBizJson = (slug, rel, fallback) => drive.readJsonPath(`${folderOf(slug)}/${rel.split('/').slice(0, -1).join('/')}`.replace(/\/$/, ''), rel.split('/').pop()).then(v => v ?? fallback).catch(() => fallback);
export const writeBizJson = (slug, rel, value) => drive.writeJson(`${folderOf(slug)}/${rel.split('/').slice(0, -1).join('/')}`.replace(/\/$/, ''), rel.split('/').pop(), value);

/** Write the storefront's files into the site's folder and deploy it to production. */
export async function publishStorefront(biz) {
  if (!biz.site?.id || !biz.site?.folder) throw new Error(biz.gaps?.find(g => g.what === 'site')?.why ?? 'The storefront was not created, so there is nothing to publish.');
  const products = (await readBizJson(biz.slug, 'products/products.json', { products: [] })).products ?? [];
  const files = storefrontFiles(biz, products);
  for (const [name, content] of Object.entries(files)) await drive.write(biz.site.folder, name, content);
  const deploy = await sites.deployFolder(biz.site.id, 'production');
  biz.site.lastDeploy = { at: Date.now(), id: deploy?.deployment?.id ?? deploy?.id ?? null };
  await writeBusiness(biz);
  return deploy;
}

/**
 * The creation sequence (each step is one CommandAGI act; `onStep(label)` reports progress):
 * the folder and its files, the brand, the business email, the storefront site, the co-founder's thread,
 * then the daily briefing routine. Nothing is pretended: a step that fails is recorded on the record as a gap.
 */
export async function createBusiness(input, { onStep = () => {} } = {}) {
  const me = await api('/me');
  const founder = await api(`/users/${encodeURIComponent(me.id)}`).catch(() => ({ id: me.id, email: '', name: '' }));
  const name = String(input.name).trim();
  let slug = slugify(name) || 'business';
  const taken = new Set((await drive.list(ROOT).catch(() => [])).map(f => f.name));
  for (let i = 2; taken.has(slug); i++) slug = `${slugify(name)}-${i}`;
  const biz = {
    v: 1, slug, name, idea: String(input.idea).trim(), tagline: input.tagline || suggestTagline(input.idea),
    blueprint: input.blueprint ?? null, vibe: input.vibe ?? 'clean', voice: input.voice ?? 'casual', partner: input.partner ?? 'creative',
    cofounder: { name: input.cofounder || COFOUNDER_NAMES[0], threadId: null, agentId: null },
    brand: brandFor(name, input.vibe ?? 'clean', input.voice ?? 'casual'),
    site: null, email: null, payments: { connected: false }, autopilot: false, briefing: 'daily',
    launchWeek: { startedAt: Date.now() }, gaps: [], createdAt: Date.now(), updatedAt: Date.now(), founderId: me.id,
  };
  onStep('Making the folder');
  const folder = folderOf(slug);
  await drive.ensure(folder);
  for (const sub of ['cofounder', 'brand', 'products', 'orders', 'customers', 'leads', 'outbound', 'ads', 'social', 'studio', 'Tasks']) await drive.mkdir(folder, sub).catch(() => null);
  await drive.writeJson(folder, 'business.json', biz);
  await drive.writeJson(`${folder}/products`, 'products.json', { products: [] });
  await drive.writeJson(`${folder}/customers`, 'customers.json', { customers: [] });
  await drive.writeJson(`${folder}/social`, 'posts.json', { posts: [] });
  await drive.writeJson(`${folder}/brand`, 'brand-book.json', biz.brand);
  await drive.write(`${folder}/brand`, 'logo.svg', markSvg(name, biz.brand));
  await drive.writeJson(folder, 'settings.json', { autopilot: false, briefing: 'daily', members: [] });

  onStep('Claiming the business email');
  try {
    const local = slug.replace(/[^a-z0-9-]/g, '').slice(0, 30);
    // `GET /email-addresses/available` answers { ok, reason }: a taken or reserved local part gets a suffix.
    const free = await email.available(local).catch(() => ({ ok: true }));
    const chosen = free?.ok === false ? `${local}-${Math.random().toString(36).slice(2, 6)}` : local;
    const addr = await email.claim(chosen, `${name} (${BRAND.name})`);
    biz.email = { id: addr.id, address: addr.address ?? `${chosen}@${BRAND.mailDomain}` };
  } catch (e) {
    // One personal address per CommandAGI account (the platform's mailbox rule): the account's first business has it.
    const why = e?.body?.error === 'limit_reached' ? 'Your account has one CommandAGI address, and your first business uses it. Write from that one, or connect your own domain in Settings.' : e.message;
    biz.gaps.push({ at: Date.now(), what: 'email', why });
  }

  onStep('Creating the storefront');
  try {
    const made = await sites.create({ name, slug: slug.slice(0, 54), description: biz.tagline });
    const site = made.site;
    biz.site = { id: site.id, slug: site.slug, url: site.url ?? `https://${site.slug}.commandagi.app`, folder: site.folder };
    for (const [fname, content] of Object.entries(storefrontFiles(biz, []))) await drive.write(site.folder, fname, content);
    try { const d = await sites.deployFolder(site.id, 'production'); biz.site.lastDeploy = { at: Date.now(), id: d?.deployment?.id ?? d?.id ?? null }; }
    catch (e) { biz.gaps.push({ at: Date.now(), what: 'deploy', why: e.message }); }
  } catch (e) {
    const why = e.status === 401 && BRAND.stack === 'local' ? 'Site hosting is the cloud\'s: a local platform cannot make the storefront.' : e.message;
    biz.gaps.push({ at: Date.now(), what: 'site', why, code: e.code ?? null });
  }

  onStep('Writing the co-founder\'s memory');
  for (const [fname, content] of Object.entries(memoryFiles(biz, founder))) await drive.write(`${folder}/cofounder`, fname, content);
  await drive.writeJson(folder, 'business.json', biz);

  onStep(`Waking ${biz.cofounder.name}`);
  try {
    const t = await threads.create({
      title: name, agentName: biz.cofounder.name, systemPrompt: charterFor(biz, founder), intent: openingFor(biz, founder),
      surface: 'vibestartup', about: addressOf(me.id, slug), reality: 'simulation', idempotencyKey: `vibestartup:${slug}:${biz.createdAt}`,
    });
    biz.cofounder.threadId = t.threadId;
    const full = await threads.get(t.threadId).catch(() => null);
    biz.cofounder.agentId = full?.agentId ?? full?.agents?.[0]?.id ?? null;
    biz.ownerScope = t.ownerScope ?? null;
  } catch (e) {
    // The platform's models for adults need the account's date of birth (POST /me/profile); the wizard asks for it at
    // sign-up, and an account made elsewhere sets it in Profile.
    const why = e.code === 'age_verification_required' ? 'CommandAGI needs your date of birth before the co-founder can start: set it in Profile, then wake the co-founder from the console.' : e.message;
    biz.gaps.push({ at: Date.now(), what: 'cofounder', why, code: e.code ?? null });
  }

  if (biz.cofounder.threadId) {
    onStep('Scheduling the daily briefing');
    try {
      const r = await threads.triggers.create(biz.cofounder.threadId, { kind: 'cron', everySeconds: 86400, label: 'Daily briefing', prompt: `Write the daily briefing for ${name}: the numbers with their change (from the files and the site's analytics), the highlights, today's plan and what waits on the founder. A few short lines. Write it into cofounder/MEMORY.md as today's entry too.` });
      biz.routines = { briefing: r.id ?? r.trigger?.id ?? null };
    } catch (e) { biz.gaps.push({ at: Date.now(), what: 'briefing', why: e.message }); }
  }
  await drive.writeJson(folder, 'business.json', biz);
  return biz;
}

/** The thread step again, for a business whose co-founder was never woken (a gap at creation). */
export async function wakeCofounder(biz) {
  const me = await api('/me');
  const founder = await api(`/users/${encodeURIComponent(me.id)}`).catch(() => ({ id: me.id, email: '', name: '' }));
  const t = await threads.create({
    title: biz.name, agentName: biz.cofounder.name, systemPrompt: charterFor(biz, founder), intent: openingFor(biz, founder),
    surface: 'vibestartup', about: addressOf(me.id, biz.slug), reality: 'simulation', idempotencyKey: `vibestartup:${biz.slug}:${biz.createdAt}`,
  });
  biz.cofounder.threadId = t.threadId;
  const full = await threads.get(t.threadId).catch(() => null);
  biz.cofounder.agentId = full?.agentId ?? full?.agents?.[0]?.id ?? null;
  biz.ownerScope = t.ownerScope ?? null;
  biz.gaps = (biz.gaps ?? []).filter(g => g.what !== 'cofounder');
  if (!biz.routines?.briefing) {
    try {
      const r = await threads.triggers.create(t.threadId, { kind: 'cron', everySeconds: 86400, label: 'Daily briefing', prompt: `Write the daily briefing for ${biz.name}: the numbers with their change (from the files and the site's analytics), the highlights, today's plan and what waits on the founder. A few short lines. Write it into cofounder/MEMORY.md as today's entry too.` });
      biz.routines = { ...(biz.routines ?? {}), briefing: r.id ?? r.trigger?.id ?? null };
    } catch { /* the routine can be made later from Tasks */ }
  }
  return writeBusiness(biz);
}

/** Everything that waits on the founder: the approval tasks of this business. */
export async function approvals(biz) {
  const { tasks } = await import('./api.js');
  const all = await tasks.list({ labels: [`biz:${biz.slug}`], includeClosed: true }).catch(() => []);
  return all.filter(t => (t.labels ?? t.doc?.labels ?? []).includes('needs-approval'));
}

/** Remove a business: the folder to the Trash, the site, the routines. The thread stays as a record. */
export async function deleteBusiness(biz) {
  const f = await drive.find(ROOT, biz.slug);
  if (biz.cofounder?.threadId) for (const t of await threads.triggers.list(biz.cofounder.threadId).catch(() => [])) await threads.triggers.remove(biz.cofounder.threadId, t.id).catch(() => null);
  if (biz.site?.id) await sites.remove(biz.site.id).catch(() => null);
  if (f) await drive.remove(f.id);
}

export { mcp, auth };
