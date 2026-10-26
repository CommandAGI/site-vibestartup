// VibeStartup's web app: the server. A site folder's `app.mjs` is the server module CommandAGI's site hosting runs
// (docs/site-hosting.md), so this file answers every `/api/*` route and the static files answer every page.
//
// Sign-up and sign-in are this app's own accounts; each account has many startups, and each startup is one row whose
// `state` is the founder's console (messages, tasks, routines, products, orders, files, settings). The co-founder's
// replies come from a model this app calls itself (OpenRouter), never from the browser: the key lives in the site's
// environment. Providers that need money or a third-party account stop at "connect your provider": this module builds
// up to their call and records that it stopped there.
//
// This file is one module because site hosting uploads it verbatim as app.mjs; it imports nothing.

const PBKDF2_ITERATIONS = 100000;
const SESSION_COOKIE = 'vs_session';
const SESSION_DAYS = 30;

export const FREE_CREDITS = 50;
export const PAYOUT_MIN = 20;
export const SEATS = 10;
export const TEST_CARD = '4242 4242 4242 4242';

/** Launch week: one step a day, each with the task the co-founder proposes when the day starts. */
const LAUNCH_WEEK = [
  { title: 'Site & first offer', task: null, about: 'The storefront is live and one product is active.' },
  { title: 'Your warm list', task: 'Add your warm contacts', about: 'Share 5 to 15 real people who may want to hear about the business. Only the people you give are recorded.' },
  { title: 'Personal notes', task: 'Send personal notes to the warm list', about: 'A short, personal note to each person on the warm list, drafted for you to send or approve.' },
  { title: 'Launch posts', task: 'Publish the launch posts', about: 'Launch posts in your brand for each connected account, or ready for you to post yourself.' },
  { title: 'Launch day', task: 'Open the doors', about: 'The launch offer goes live and the first follow-ups are scheduled.' },
  { title: 'Follow-ups', task: 'Follow up with everyone who replied', about: 'Answer every reply, thank every buyer, ask every visitor who left a cart.' },
  { title: 'Debrief', task: 'Write the launch debrief', about: 'What worked, what did not, and the plan for next week, in MEMORY.md.' },
];

const FORMATS = [
  { id: 'offer', name: 'Offer image', about: 'A branded image with your offer, sized for every placement.', sizes: '9:16, 4:5, 1:1, 2:3, 1.91:1', takes: 'about a minute', low: 3, high: 5, ready: true },
  { id: 'image', name: 'Image', about: 'One image from a description. Your brand only if you ask for it.', sizes: '4:5, 1:1, 9:16, 16:9', takes: 'under a minute', low: 2, high: 4, ready: true },
  { id: 'short', name: 'Short video', about: 'Six to ten seconds, vertical, captions burned in.', sizes: '9:16, 4:5, 1:1', takes: 'about 4 minutes', low: 60, high: 110, ready: false },
  { id: 'clip', name: 'Clip', about: 'A four to eight second clip from a description or a still.', sizes: '9:16, 1:1', takes: 'about 3 minutes', low: 45, high: 80, ready: false },
  { id: 'presenter', name: 'Presenter ad', about: 'Fifteen seconds, a presenter reading your script word for word.', sizes: '9:16, 4:5, 1:1', takes: 'about 6 minutes', low: 20, high: 25, ready: false },
  { id: 'film', name: 'Launch film', about: 'Twenty to thirty seconds, built around your real photos.', sizes: '9:16, 4:5, 1:1, 16:9', takes: 'about 12 minutes', low: 50, high: 60, ready: false },
];

const LOOKS = ['Up to you', 'Clean studio', 'In place', 'Bold type', 'Sunlit'];
const SOCIAL = ['Instagram (professional)', 'Facebook Page', 'TikTok', 'X', 'YouTube', 'Threads', 'Pinterest', 'LinkedIn'];
const PLANS = [
  { name: 'Starter', for: 'Testing your first idea.', features: ['One business', 'An agent team for code, images and video', 'Email and outbound', 'Ads on autopilot', 'A subdomain of vibestartup.pro'] },
  { name: 'Growth', for: 'For founders ready to grow.', features: ['Three businesses', 'Everything in Starter', 'Your own domain', 'Priority help'], featured: true },
  { name: 'Scale', for: 'Operators with many businesses.', features: ['Ten businesses', 'Everything in Growth', 'The most credits each month'] },
];
const RATES = { page: 300, email: 50, deploy: 500, image: 40 };

/** Providers a founder connects with their own account. Each stops one call short of charging or publishing. */
const PROVIDERS = {
  payments: { name: 'Stripe', what: 'Taking real money needs your Stripe account and its keys. Add them in Settings when you are ready; test buys work now.' },
  ads: { name: 'Meta Ads', what: 'Running an ad needs your own ad account and a payment method. VibeStartup will spend only inside the budget you approve.' },
  social: { name: 'each social platform', what: 'Publishing needs your official login on each platform. The posts are drafted and wait for it.' },
  email: { name: 'Resend', what: 'Sending from your own domain needs your Resend account and its verified domain.' },
  domain: { name: 'your registrar', what: 'A custom domain needs a DNS record at your registrar. This app shows the record; it does not move DNS.' },
  legal: { name: 'Charter House', what: 'Filing a company needs a signature and a fee. The drafts wait for yours.' },
};

// ---------- small helpers ----------

const now = () => Date.now();
const uid = () => crypto.randomUUID();
const money = n => `$${(Math.round(n * 100) / 100).toFixed(2)}`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const svgData = svg => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const slugify = name => String(name).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 32) || 'my-business';
const suggestName = idea => {
  const words = String(idea).replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 3).sort((a, b) => b.length - a.length).slice(0, 2);
  if (!words.length) return '';
  return words.map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
};
const brandFor = name => {
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.codePointAt(0)) % 360;
  const hsl = (s, l, hh = h) => `hsl(${Math.round(hh)} ${s}% ${l}%)`;
  return {
    primary: hsl(55, 38), secondary: hsl(30, 86, (h + 40) % 360), accent: hsl(80, 56, (h + 180) % 360),
    ground: hsl(30, 97), ink: hsl(20, 14),
    type: 'Serif headlines, sans-serif body', voice: ['warm', 'plain-spoken', 'confident'],
  };
};
const longDay = at => new Date(at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const bad = (message, status = 400) => json({ error: message }, status);
const safeJson = (text, fallback = {}) => { try { return JSON.parse(text) ?? fallback; } catch { return fallback; } };

// ---------- passwords and sessions ----------

const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, key, 256);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(bits)}`;
}

async function checkPassword(password, stored) {
  const [scheme, rounds, salt, want] = String(stored ?? '').split('$');
  if (scheme !== 'pbkdf2' || !rounds || !salt || !want) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(salt), iterations: Number(rounds), hash: 'SHA-256' }, key, 256);
  const got = b64(bits);
  // Compare without an early exit, so the answer takes the same time whatever the difference.
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

/** A one-way digest of a secret's value: enough to tell that a replacement happened, never enough to read it. */
async function digest(value) {
  const bits = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value)));
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

const cookieFrom = request => {
  const raw = request.headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === SESSION_COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
};
const sessionCookie = (token, maxAge) => `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

// ---------- the database ----------

let schemaReady = null;
/** The app's own tables, made on the first request of an isolate. A site resource is the site's, not the platform's. */
function ensureSchema(env) {
  schemaReady ??= (async () => {
    for (const sql of [
      `create table if not exists app_users (id text primary key, email text not null unique, name text not null, pass text not null, created_at integer not null, phone text, notify text)`,
      `create table if not exists app_sessions (token text primary key, user_id text not null, created_at integer not null)`,
      `create table if not exists app_startups (id text primary key, user_id text not null, name text not null, slug text not null, idea text not null, cofounder text not null, state text not null, created_at integer not null, updated_at integer not null)`,
    ]) await env.DB.prepare(sql).run();
    return true;
  })().catch(err => { schemaReady = null; throw err; });
  return schemaReady;
}

async function userFrom(request, env) {
  const token = cookieFrom(request);
  if (!token) return null;
  const row = await env.DB.prepare('select u.id, u.email, u.name from app_sessions s join app_users u on u.id = s.user_id where s.token = ?').bind(token).first();
  return row ?? null;
}

// ---------- the business's records ----------

function activity(biz, text) { biz.activity.unshift({ at: now(), text }); biz.activity = biz.activity.slice(0, 300); }

function say(biz, text, extra = {}) { biz.messages.push({ id: uid(), from: 'cofounder', kind: 'text', text, at: now(), ...extra }); }

/** Spend credits for work. Out of credits, the co-founder stops and says so. */
function charge(biz, credits, what) {
  if (biz.credits < credits) {
    biz.messages.push({ id: uid(), from: 'system', kind: 'text', text: `Out of free credits: "${what}" needs ${credits}. Subscribe in Billing to keep your co-founder working.`, at: now() });
    return false;
  }
  biz.credits -= credits;
  biz.billed.unshift({ id: uid(), at: now(), what, credits, disputed: false });
  return true;
}

function propose(biz, title, reasoning, effect, cost = 2) {
  const task = { id: uid(), title, reasoning, effect, cost, status: 'approval', at: now() };
  biz.tasks.push(task);
  biz.messages.push({ id: uid(), from: 'cofounder', kind: 'approval', task: task.id, at: now() });
  activity(biz, `Proposed: ${title}`);
  if (biz.autopilot) approve(biz, task.id, 'autopilot');
  return task;
}

function advanceDay(biz) {
  if (biz.day >= 7) { biz.day = 8; say(biz, 'Launch week is complete. The debrief is in MEMORY.md.'); return; }
  biz.day += 1;
  const step = LAUNCH_WEEK[biz.day - 1];
  activity(biz, `Launch week: day ${biz.day}, ${step.title}`);
  if (step.task) propose(biz, step.task, step.about, 'day');
}

function checkDayOne(biz) {
  if (biz.day === 1 && biz.siteLive && biz.products.some(p => p.status === 'active')) {
    biz.messages.push({ id: uid(), from: 'cofounder', kind: 'milestone', title: 'Day 1 done', text: 'The site is live and the first offer is active.', at: now() });
    advanceDay(biz);
  }
}

function approve(biz, id, via = 'chat') {
  const task = biz.tasks.find(t => t.id === id);
  if (!task || task.status !== 'approval') return { error: 'That task is not waiting for approval.' };
  if (!charge(biz, task.cost, task.title)) return { error: 'No credits left.' };
  task.status = 'done';
  task.doneAt = now();
  task.via = via;
  activity(biz, `Approved (${via}): ${task.title}`);
  const e = task.effect;
  if (e === 'site') {
    biz.siteLive = true;
    biz.counters.pages += 1; biz.counters.deploys += 1;
    biz.messages.push({ id: uid(), from: 'cofounder', kind: 'milestone', title: 'Site is live', text: `${biz.slug}.vibestartup.pro is deployed. Build, checks and the live link passed.`, at: now() });
    biz.events.push({ at: now(), text: 'Storefront deployed' });
  } else if (e === 'brand') {
    biz.brandReady = true;
    biz.counters.deploys += 1;
    biz.creatives.push({ id: uid(), name: 'brand-kit.svg', svg: brandKitImage(biz), at: now(), kind: 'brand' });
    biz.creatives.push({ id: uid(), name: 'logo-light.svg', svg: logoImage(biz, false), at: now(), kind: 'logo' });
    biz.creatives.push({ id: uid(), name: 'logo-dark.svg', svg: logoImage(biz, true), at: now(), kind: 'logo' });
    say(biz, 'Your brand kit is ready, with a light and a dark logo. The storefront now uses it.', { kind: 'image', image: biz.creatives.at(-3).id });
  } else if (e === 'day') {
    say(biz, `Done: ${task.title}. Day ${biz.day} of launch week is complete.`);
    advanceDay(biz);
  } else if (e === 'campaign') {
    biz.campaigns.push({ id: uid(), name: 'First outbound', at: now(), steps: [['Day 0', 'A short introduction and the one offer'], ['Day 3', 'A follow-up with one useful detail'], ['Day 7', 'A last, friendly note']] });
    say(biz, `The outbound campaign is built: three steps over a week, for ${plural(biz.leads.length, 'lead')}. Nothing is sent until you connect a sending provider.`);
  } else if (e === 'formation') {
    biz.formation = { at: now() };
    say(biz, 'I prepared the formation papers as drafts for you to read. Filing and its fees are your call.');
  } else {
    say(biz, `Approved: ${task.title}. I am on it.`);
  }
  if (biz.day === 1) checkDayOne(biz);
  return { ok: true };
}

function reject(biz, id) {
  const task = biz.tasks.find(t => t.id === id);
  if (!task || task.status !== 'approval') return { error: 'That task is not waiting for approval.' };
  task.status = 'rejected';
  activity(biz, `Rejected: ${task.title}`);
  say(biz, `Understood, I will not do "${task.title}". Tell me what you would rather do.`);
  return { ok: true };
}

function metrics(biz) {
  const total = biz.orders.reduce((s, o) => s + o.amount, 0);
  const fees = biz.orders.reduce((s, o) => s + o.amount * 0.029 + 0.3, 0);
  const net = Math.max(0, total - fees);
  const real = biz.orders.filter(o => !o.test);
  return { total, net, payouts: 0, profits: net - (biz.ads.spent ?? 0), balance: net, real: real.length, realRevenue: real.reduce((s, o) => s + o.amount, 0), tests: biz.orders.length - real.length };
}

function runBriefing(biz, profile, routine) {
  if (!charge(biz, 1, `Run routine: ${routine.name}`)) return { error: 'No credits left.' };
  const m = metrics(biz), pending = biz.tasks.filter(t => t.status === 'approval');
  const active = biz.products.filter(p => p.status === 'active');
  const tiles = [
    ['Store visitors', biz.visits, 'all time'], ['Carts', biz.carts, 'started'], ['Orders', biz.orders.length, m.tests ? `${m.tests} test` : 'none yet'],
    ['Revenue', money(m.total), m.tests ? 'includes test sales' : 'all time'], ['Active products', active.length, `${biz.products.length - active.length} other`], ['Pending approvals', pending.length, 'waiting on you'],
  ];
  const highlights = [
    biz.siteLive ? `The storefront is live at ${biz.slug}.vibestartup.pro.` : 'The storefront is not live yet; its task waits on your approval.',
    `${plural(biz.visits, 'visit')} and ${plural(biz.carts, 'cart')} so far. A cart without a sale is normal drop-off, not a broken checkout.`,
    m.real ? `${plural(m.real, 'real sale')} for ${money(m.realRevenue)}.` : 'No real sales yet. Test sales are never counted as real.',
  ];
  const plan = pending.length ? pending.map(t => `Decide: ${t.title}.`) : [`Launch week day ${Math.min(biz.day, 7)}: ${LAUNCH_WEEK[Math.min(biz.day, 7) - 1].title}.`];
  biz.messages.push({ id: uid(), from: 'cofounder', kind: 'briefing', at: now(), data: { date: longDay(now()), tiles, highlights, plan } });
  biz.emails.unshift({ id: uid(), folder: 'sent', from: `team@${biz.slug}.vibestartup.pro`, to: profile.email || 'you (owner)', subject: `${biz.name}: daily briefing, ${longDay(now())}${pending.length ? ` · ${plural(pending.length, 'approval')} waiting` : ''}`, body: `${tiles.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nHighlights\n${highlights.map(h => `- ${h}`).join('\n')}\n\nToday's plan\n${plan.map(p => `- ${p}`).join('\n')}\n\n${biz.cofounder}`, at: now(), read: false, by: 'co-founder', approval: pending[0]?.id ?? null, draft: true });
  biz.counters.emails += 1;
  routine.lastRun = now();
  routine.lastResult = `Drafted the ${longDay(now())} briefing in chat and in the Email tab: ${plural(biz.visits, 'visit')}, ${plural(biz.orders.length, 'order')}, ${plural(pending.length, 'pending approval')}.`;
  activity(biz, `Routine ran: ${routine.name}`);
  return { ok: true };
}

function memoryFiles(biz, profile) {
  const active = biz.products.filter(p => p.status === 'active');
  const real = biz.orders.filter(o => !o.test);
  return [
    { name: 'SOUL.md', group: 'Identity', about: 'Co-founder personality and voice', body: md(`SOUL: ${biz.cofounder}`, [
      ['Who', [`${biz.cofounder} is the AI co-founder of ${biz.name}. It builds, ships and grows the business with its human partner.`]],
      ['Personality', ['Design-minded: how it looks and feels matters as much as what it does.', "Customer first: every change is judged from the buyer's side.", 'Transparent: it says what it is doing and why.', 'Honest about numbers: a test sale is never counted as a real one.']],
      ['Decisions', ['Does it serve the customer?', 'Is it the simplest thing that works?', 'Can it ship today?', 'Is it easy to change later?']],
    ]) },
    { name: 'BUSINESS.md', group: 'Identity', about: 'Business overview and goals', body: md(`BUSINESS: ${biz.name}`, [
      ['Idea', [biz.idea]],
      ['Offer', active.length ? active.map(p => `${p.name}: ${p.price ? money(p.price) : 'free'} ${p.billing === 'recurring' ? 'per ' + p.interval : 'one-time'}`) : ['No active product yet.']],
      ['Goals', ['First three real sales.', 'Finish launch week.']],
    ]) },
    { name: 'OWNER.md', group: 'Identity', about: 'Owner profile and preferences', body: md('OWNER: human partner', [
      ['Who', [`Name: ${profile.name || 'not given'}`, `Email: ${profile.email || 'not given'}`]],
      ['Preferences', [biz.autopilot ? 'Autopilot is on: the co-founder acts and briefs.' : 'Autopilot is off: big steps wait for approval.', `Briefing: ${biz.briefing}`]],
    ]) },
    { name: 'PLAYBOOK.md', group: 'Operations', about: 'Operational playbook', body: md('PLAYBOOK', [
      ['Every morning', ["Compile the numbers, the open approvals and today's plan; draft them in chat and in Email."]],
      ['Launch week', LAUNCH_WEEK.map((d, i) => `Day ${i + 1}: ${d.title}. ${d.about}`)],
    ]) },
    { name: 'PLATFORM.md', group: 'Operations', about: 'Platform configuration', body: md('PLATFORM', [
      ['Addresses', [`Storefront: ${biz.slug}.vibestartup.pro`, `Email: team@${biz.slug}.vibestartup.pro`, biz.domain ? `Own domain: ${biz.domain}` : 'Own domain: none']],
      ['Secrets', biz.secrets.length ? biz.secrets.map(s => `${s.name} (set; the value is never shown)`) : ['None.']],
    ]) },
    { name: 'MEMORY.md', group: 'Evolving', about: 'Working memory and context', body: md('MEMORY: working memory', [
      ['Key decisions', biz.tasks.filter(t => t.status === 'done').map(t => `Approved: ${t.title}.`).concat(biz.notes).slice(-12).concat(biz.tasks.some(t => t.status === 'done') ? [] : ['None yet.'])],
      ['What worked', biz.siteLive ? [`The storefront is live at ${biz.slug}.vibestartup.pro.`] : ['Nothing shipped yet.']],
      ['Numbers', [`${biz.visits} visits, ${biz.carts} carts, ${real.length} real sales, ${biz.orders.length - real.length} test sales.`]],
    ]) },
    { name: 'CODE_MAP.md', group: 'Evolving', about: 'Codebase structure map', body: md('CODE_MAP: storefront', [
      ['Stack', ['A static storefront with a checkout route and an admin area.']],
      ['Routes', ['/', '/products/[slug]', '/cart', '/checkout/success', '/checkout/canceled', '/about', '/faq', '/policies/returns', '/policies/shipping', '/admin']],
      ['Checks', ['Build, type check, tests, a browser check at phone and desk widths, then the live link.']],
    ]) },
    { name: 'SUPPORT.md', group: 'Other', about: 'How customers are helped', body: md('SUPPORT', [
      ['Answers', ['Reply within a day, from the address the customer wrote to.', 'Refunds within 14 days, no questions.']],
    ]) },
  ];
}

const md = (title, sections) => `# ${title}\n\n${sections.map(([h, lines]) => `## ${h}\n\n${lines.map(l => `- ${l}`).join('\n')}`).join('\n\n')}\n`;

function termsDraft(biz) {
  return `Terms of sale for ${biz.name} (draft, not legal advice)\n\n1. Who sells: ${biz.name}, reachable at team@${biz.slug}.vibestartup.pro.\n2. What you buy: what the product page says, at the price shown at checkout.\n3. Refunds: within 14 days of purchase.\n4. Changes: we tell buyers before terms change.`;
}
function privacyDraft(biz) {
  return `Privacy notice for ${biz.name} (draft, not legal advice)\n\nWe keep your name, email and order to deliver what you bought and to answer you. We do not sell your data. Ask us at team@${biz.slug}.vibestartup.pro to see or delete what we keep.`;
}

function offerImage({ brand, words, product, look, n, name }) {
  const lines = [];
  let line = '';
  for (const w of String(words || name).split(/\s+/)) { if ((line + ' ' + w).trim().length > 18) { lines.push(line.trim()); line = w; } else line += ' ' + w; }
  if (line.trim()) lines.push(line.trim());
  const dark = look === 'Bold type' || n % 2 === 1;
  const bg = dark ? brand.primary : brand.ground, fg = dark ? brand.ground : brand.ink, pop = brand.secondary;
  const shapes = [
    `<circle cx="${320 + n * 30}" cy="${90 + n * 10}" r="${120 - n * 8}" fill="${pop}" opacity="0.85"/>`,
    `<rect x="-40" y="${330 - n * 12}" width="520" height="70" fill="${brand.accent}" opacity="0.6" transform="rotate(-8 200 360)"/>`,
    look === 'Sunlit' ? `<circle cx="70" cy="70" r="46" fill="#f8c74a"/>` : '',
  ].join('');
  const text = lines.slice(0, 4).map((l, i) => `<text x="32" y="${170 + i * 44}" font-family="Georgia, serif" font-size="38" fill="${fg}">${esc(l)}</text>`).join('');
  const price = product ? `<text x="32" y="440" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="${fg}">${esc(product.name)} · ${product.price ? money(product.price) : 'free'}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500"><rect width="400" height="500" fill="${bg}"/>${shapes}${text}${price}<text x="32" y="478" font-family="system-ui, sans-serif" font-size="14" fill="${fg}" opacity="0.8">${esc(name)}</text></svg>`;
}
function brandKitImage(biz) {
  const b = biz.brand;
  const sw = [b.primary, b.secondary, b.accent, b.ground, b.ink].map((c, i) => `<rect x="${30 + i * 70}" y="210" width="60" height="60" rx="6" fill="${c}" stroke="#0002"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300"><rect width="400" height="300" fill="${b.ground}"/><text x="30" y="80" font-family="Georgia, serif" font-size="40" fill="${b.ink}">${esc(biz.name)}</text><text x="30" y="120" font-family="system-ui, sans-serif" font-size="16" fill="${b.ink}">Brand kit · ${esc(b.voice.join(', '))}</text>${sw}</svg>`;
}
function logoImage(biz, dark) {
  const b = biz.brand, letter = biz.name.trim()[0]?.toUpperCase() ?? 'V';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><rect width="200" height="200" rx="36" fill="${dark ? b.ink : b.ground}"/><circle cx="100" cy="100" r="64" fill="${b.primary}"/><text x="100" y="124" text-anchor="middle" font-family="Georgia, serif" font-size="72" fill="${b.ground}">${esc(letter)}</text></svg>`;
}

/** A new startup's console state. Everything a founder sees is here, so one row is one business. */
function freshState({ name, idea, cofounder, slug }) {
  return {
    name, slug, idea, cofounder, createdAt: now(), autopilot: false, briefing: 'Daily digest', domain: '', domainPending: false, day: 1,
    siteLive: false, brandReady: false, credits: FREE_CREDITS, brand: brandFor(name), creativeBudget: null, formation: null,
    messages: [], tasks: [], routines: [], emails: [], products: [], orders: [], customers: [], visits: 0, carts: 0, checkouts: 0,
    events: [], creatives: [], leads: [], campaigns: [], posts: [], secrets: [], members: [], activity: [], billed: [], notes: [], uploads: [],
    ads: { daily: 7, days: 14, checked: null, spent: 0, history: [{ at: now(), what: 'First campaign launch proposed' }] },
    social: { personal: false, asked: [] }, counters: { pages: 0, emails: 0, deploys: 0 }, refreshedAt: now(), providers: {},
  };
}

function createStartupState({ name, idea, cofounder, slug }, profile) {
  const biz = freshState({ name, idea, cofounder, slug });
  activity(biz, 'Business created');
  say(biz, `Hi, I'm ${cofounder}, your co-founder on ${name}. The idea: ${idea}`);
  say(biz, `I build and run the site, the checkout and the business inbox at team@${slug}.vibestartup.pro. Big decisions come to you for approval; you can turn on autopilot in Settings.\n\nDay 1 is the site and a first offer. I proposed two tasks below. Add your first product in Products when you are ready.`);
  propose(biz, 'Build and launch the storefront', `A storefront at ${slug}.vibestartup.pro is the first thing a customer sees and the place every ad and post points to. It is the smallest step that lets anyone buy.`, 'site');
  propose(biz, 'Design the brand kit', 'Colours, type, a logo in light and dark, and a voice. Every image, email and page after this uses it, so it comes first.', 'brand');
  biz.emails.push({ id: uid(), folder: 'inbox', from: 'hello@vibestartup.pro', to: `team@${slug}.vibestartup.pro`, subject: 'Your business inbox is ready', body: `This is ${name}'s inbox. Customers write here; ${cofounder} drafts and answers, and you stay in control of every send.`, at: now(), read: false, by: 'VibeStartup' });
  const routine = { id: uid(), name: 'Daily briefing', instructions: 'Compile the numbers, the activity and the priorities. Draft them as a briefing card in chat and by email.', schedule: 'every day at 9am', every: 'Daily', status: 'active', by: 'Your co-founder' };
  biz.routines.push(routine);
  runBriefing(biz, profile, routine);
  return biz;
}

// ---------- the co-founder's model ----------

const MODEL_SYSTEM = [
  'You are the AI co-founder of a small business, talking with its founder in a chat console.',
  'Answer in at most 120 words, warm and plain-spoken, no markdown headings and no lists longer than three items.',
  'You are honest about what is built and what is not. A test sale is never a real sale. You never claim money moved,',
  'a post was published, an email was sent, an ad ran or a domain was connected unless the founder did it.',
  'When the founder asks for work worth more than a chat reply, propose one task for their approval.',
  'Answer with JSON only: {"reply": "what you say", "propose": null} or',
  '{"reply": "what you say", "propose": {"title": "a short task title", "reasoning": "why, in one or two sentences", "cost": 2}}',
  'cost is 1 to 5 credits. Propose at most one task per message.',
].join(' ');

function cofounderContext(biz, profile) {
  const pending = biz.tasks.filter(t => t.status === 'approval').map(t => t.title);
  const active = biz.products.filter(p => p.status === 'active').map(p => `${p.name} at ${money(p.price)}`);
  return [
    `Business: ${biz.name}. Idea: ${biz.idea}. Your name: ${biz.cofounder}. The founder: ${profile?.name || 'unnamed'} (${profile?.email || ''}).`,
    `Launch week day ${biz.day} of 7. Storefront ${biz.siteLive ? `live at ${biz.slug}.vibestartup.pro` : 'not live yet'}.`,
    `Credits left: ${biz.credits}. Autopilot ${biz.autopilot ? 'on' : 'off'}.`,
    `Active products: ${active.length ? active.join('; ') : 'none'}. Orders: ${biz.orders.length} (${biz.orders.filter(o => !o.test).length} real).`,
    `Waiting for approval: ${pending.length ? pending.join('; ') : 'nothing'}.`,
    biz.secrets.length ? `Secrets set (values never shown): ${biz.secrets.map(s => s.name).join(', ')}.` : 'No secrets set.',
    'Providers that need the founder\'s own account and stop at "connect your provider": payments, ads, social, email, domain, legal.',
  ].join(' ');
}

/** Ask the model for the co-founder's next message. Returns {reply, propose} — or a stated gap, never an invented reply. */
async function cofounderReply(env, biz, profile, text, history) {
  const key = env.OPENROUTER_API_KEY;
  if (!key) return { reply: null, propose: null, gap: 'The co-founder\'s model key is not set on this site, so this is not a model reply. Set OPENROUTER_API_KEY in the site\'s environment (Settings → environment secrets is for the storefront, not this app).', };
  const messages = [{ role: 'system', content: MODEL_SYSTEM }, { role: 'system', content: cofounderContext(biz, profile) }];
  for (const m of history.slice(-12)) messages.push({ role: m.from === 'you' ? 'user' : 'assistant', content: String(m.text).slice(0, 2000) });
  messages.push({ role: 'user', content: String(text).slice(0, 4000) });
  let body;
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'http-referer': 'https://vibestartup.commandagi.app', 'x-title': 'VibeStartup' },
      body: JSON.stringify({ model: env.COFOUNDER_MODEL || 'deepseek/deepseek-chat-v3.1', messages, temperature: 0.6, max_tokens: 400 }),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) return { reply: null, propose: null, gap: `The model provider answered ${r.status}. Nothing was invented in its place.` };
    body = await r.json();
  } catch (e) {
    return { reply: null, propose: null, gap: `The model provider could not be reached (${String(e?.message ?? e).slice(0, 120)}). Nothing was invented in its place.` };
  }
  const raw = body?.choices?.[0]?.message?.content ?? '';
  const parsed = parseModelJson(raw);
  return { reply: parsed.reply, propose: parsed.propose, gap: null, raw };
}

/** The model may wrap JSON in prose or a fence; read the object it names, and never invent a reply it did not give. */
function parseModelJson(raw) {
  const text = String(raw).trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const o = JSON.parse(text.slice(start, end + 1));
      const reply = typeof o.reply === 'string' && o.reply.trim() ? o.reply.trim() : null;
      let proposal = null;
      if (o.propose && typeof o.propose.title === 'string' && o.propose.title.trim()) {
        proposal = {
          title: o.propose.title.trim().slice(0, 120),
          reasoning: String(o.propose.reasoning ?? '').trim().slice(0, 600),
          cost: Math.min(5, Math.max(1, Math.round(Number(o.propose.cost) || 2))),
        };
      }
      return { reply, propose: proposal };
    } catch { /* the model answered prose: use it as the reply, as it came */ }
  }
  return { reply: text || null, propose: null };
}

// ---------- reading and writing a startup ----------

async function startupFor(env, user, id) {
  const row = await env.DB.prepare('select * from app_startups where id = ? and user_id = ?').bind(id, user.id).first();
  if (!row) return null;
  return { row, biz: JSON.parse(row.state) };
}

async function saveStartup(env, id, biz) {
  await env.DB.prepare('update app_startups set state = ?, updated_at = ? where id = ?').bind(JSON.stringify(biz), now(), id).run();
  return biz;
}

async function createStartup(env, user, { idea, name, cofounder }) {
  const cleanIdea = String(idea ?? '').trim();
  const cleanName = String(name ?? '').trim() || suggestName(cleanIdea) || 'My Business';
  const agent = String(cofounder ?? '').trim() || 'Juno';
  const slug = slugify(cleanName);
  const profile = { name: user.name, email: user.email };
  const biz = createStartupState({ name: cleanName, idea: cleanIdea, cofounder: agent, slug }, profile);
  biz.metrics = metrics(biz);
  biz.files = memoryFiles(biz, profile);
  const id = uid();
  await env.DB.prepare('insert into app_startups (id, user_id, name, slug, idea, cofounder, state, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, user.id, cleanName, slug, cleanIdea, agent, JSON.stringify(biz), now(), now()).run();
  return { id, biz };
}

// ---------- the routes ----------

async function route(request, env) {
  const url = new URL(request.url);
  const p = url.pathname;
  if (p === '/api/health') return json({ ok: true, app: 'vibestartup', at: now() });
  if (!p.startsWith('/api/')) return bad('Not an API route.', 404);

  const method = request.method;
  const body = async () => (method === 'POST' || method === 'PATCH' ? await request.json().catch(() => ({})) : {});
  await ensureSchema(env);
  const user = await userFrom(request, env);

  // --- meta: the console's own vocabulary, so the browser holds no second copy of it ---
  if (p === '/api/meta' && method === 'GET')
    return json({ launchWeek: LAUNCH_WEEK, formats: FORMATS, looks: LOOKS, social: SOCIAL, plans: PLANS, rates: RATES, freeCredits: FREE_CREDITS, payoutMin: PAYOUT_MIN, seats: SEATS, testCard: TEST_CARD, providers: PROVIDERS });

  // --- accounts ---
  if (p === '/api/signup' && method === 'POST') {
    const { email, password, name, idea, cofounder } = await body();
    const cleanEmail = String(email ?? '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) return bad('Enter an email address.');
    if (String(password ?? '').length < 8) return bad('Use a password of at least 8 characters.');
    const exists = await env.DB.prepare('select id from app_users where email = ?').bind(cleanEmail).first();
    if (exists) return bad('That email already has an account. Sign in instead.', 409);
    const id = uid();
    await env.DB.prepare('insert into app_users (id, email, name, pass, created_at) values (?, ?, ?, ?, ?)')
      .bind(id, cleanEmail, String(name ?? '').trim() || cleanEmail.split('@')[0], await hashPassword(String(password)), now()).run();
    const token = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
    await env.DB.prepare('insert into app_sessions (token, user_id, created_at) values (?, ?, ?)').bind(token, id, now()).run();
    const me = { id, email: cleanEmail, name: String(name ?? '').trim() || cleanEmail.split('@')[0] };
    let startup = null;
    // The first idea names its own business: the person's name is theirs, not the business's.
    if (String(idea ?? '').trim()) {
      const made = await createStartup(env, me, { idea, cofounder });
      startup = { id: made.id, ...made.biz };
    }
    return json({ user: me, startup }, 200, { 'set-cookie': sessionCookie(token, SESSION_DAYS * 86400) });
  }

  if (p === '/api/signin' && method === 'POST') {
    const { email, password } = await body();
    const row = await env.DB.prepare('select * from app_users where email = ?').bind(String(email ?? '').trim().toLowerCase()).first();
    if (!row || !(await checkPassword(String(password ?? ''), row.pass))) return bad('That email and password do not match an account.', 401);
    const token = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
    await env.DB.prepare('insert into app_sessions (token, user_id, created_at) values (?, ?, ?)').bind(token, row.id, now()).run();
    return json({ user: { id: row.id, email: row.email, name: row.name } }, 200, { 'set-cookie': sessionCookie(token, SESSION_DAYS * 86400) });
  }

  if (p === '/api/signout' && method === 'POST') {
    const token = cookieFrom(request);
    if (token) await env.DB.prepare('delete from app_sessions where token = ?').bind(token).run();
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
  }

  if (!user) return bad('Sign in first.', 401);

  if (p === '/api/me' && method === 'GET') {
    const { results } = await env.DB.prepare('select id, name, slug, idea, cofounder, state, created_at from app_startups where user_id = ? order by created_at').bind(user.id).all();
    const account = await env.DB.prepare('select phone, notify from app_users where id = ?').bind(user.id).first();
    return json({
      user: { id: user.id, email: user.email, name: user.name, phone: account?.phone ?? '', notify: safeJson(account?.notify) },
      startups: results.map((r) => { const biz = JSON.parse(r.state); return { id: r.id, name: r.name, slug: r.slug, idea: r.idea, cofounder: r.cofounder, createdAt: r.created_at, day: biz.day, credits: biz.credits, siteLive: biz.siteLive, waiting: biz.tasks.filter(t => t.status === 'approval').length }; }),
    });
  }

  if (p === '/api/me' && method === 'PATCH') {
    const { name, notify, phone } = await body();
    const cleanName = String(name ?? user.name).trim().slice(0, 80) || user.name;
    await env.DB.prepare('update app_users set name = ?, phone = ?, notify = ? where id = ?')
      .bind(cleanName, String(phone ?? '').slice(0, 40), JSON.stringify(notify ?? {}), user.id).run();
    return json({ user: { id: user.id, email: user.email, name: cleanName } });
  }

  if (p === '/api/me' && method === 'DELETE') {
    const { results } = await env.DB.prepare('select id from app_startups where user_id = ?').bind(user.id).all();
    for (const r of results) await env.DB.prepare('delete from app_startups where id = ?').bind(r.id).run();
    await env.DB.prepare('delete from app_sessions where user_id = ?').bind(user.id).run();
    await env.DB.prepare('delete from app_users where id = ?').bind(user.id).run();
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
  }

  if (p === '/api/startups' && method === 'POST') {
    const { idea, name, cofounder } = await body();
    if (!String(idea ?? '').trim()) return bad('Say the idea in a sentence.');
    const made = await createStartup(env, user, { idea, name, cofounder });
    return json({ id: made.id, startup: made.biz });
  }

  const m = p.match(/^\/api\/startups\/([^/]+)(\/.*)?$/);
  if (!m) return bad('No such route.', 404);
  const found = await startupFor(env, user, decodeURIComponent(m[1]));
  if (!found) return bad('No such business of yours.', 404);
  const { row, biz } = found;
  const profile = { name: user.name, email: user.email };
  const sub = m[2] ?? '';
  /** The co-founder's memory is derived from the startup, never stored twice: one implementation, sent with each read. */
  const withFiles = () => {
    biz.metrics = metrics(biz);
    biz.files = memoryFiles(biz, profile).concat([
      { name: 'TERMS.md', group: 'Other', about: 'Draft, not legal advice', body: termsDraft(biz) },
      { name: 'PRIVACY.md', group: 'Other', about: 'Draft, not legal advice', body: privacyDraft(biz) },
    ], biz.uploads ?? []);
    return biz;
  };
  const done = async (extra = {}) => { withFiles(); await saveStartup(env, row.id, biz); return json({ id: row.id, startup: biz, ...extra }); };

  if (sub === '' && method === 'GET') return json({ id: row.id, startup: withFiles() });

  if (sub === '/chat' && method === 'POST') {
    const { text } = await body();
    const clean = String(text ?? '').trim();
    if (!clean) return bad('Say something first.');
    biz.messages.push({ id: uid(), from: 'you', kind: 'text', text: clean.slice(0, 4000), at: now() });
    const history = biz.messages.filter(x => x.kind === 'text' && (x.from === 'you' || x.from === 'cofounder'));
    const answer = await cofounderReply(env, biz, profile, clean, history.slice(0, -1));
    if (answer.reply) say(biz, answer.reply, { model: env.COFOUNDER_MODEL || 'deepseek/deepseek-chat-v3.1' });
    else if (answer.gap) say(biz, answer.gap, { gap: true });
    if (answer.propose) {
      // A proposal for work already proposed or done would be a second copy: the founder decides once.
      const same = biz.tasks.some(t => t.status !== 'rejected' && t.title.trim().toLowerCase() === answer.propose.title.trim().toLowerCase());
      if (!same) {
        const task = propose(biz, answer.propose.title, answer.propose.reasoning || 'The co-founder proposed it in chat.', 'none', answer.propose.cost);
        say(biz, `I proposed "${task.title}". Approve it and I start.`);
      }
    }
    biz.notes.push(`${longDay(now())}: ${clean.slice(0, 160)}`);
    biz.notes = biz.notes.slice(-40);
    activity(biz, 'You wrote to the co-founder');
    return done();
  }

  if (sub === '/approve' && method === 'POST') {
    const { taskId, via } = await body();
    const r = approve(biz, String(taskId), via === 'autopilot' ? 'autopilot' : 'chat');
    if (r.error) return bad(r.error, 409);
    return done();
  }
  if (sub === '/reject' && method === 'POST') {
    const { taskId } = await body();
    const r = reject(biz, String(taskId));
    if (r.error) return bad(r.error, 409);
    return done();
  }

  if (sub === '/prompt' && method === 'POST') {
    // "Ask your co-founder" links: the question already typed is a chat message the founder sends.
    const { text } = await body();
    biz.messages.push({ id: uid(), from: 'you', kind: 'text', text: String(text ?? '').slice(0, 500), at: now() });
    activity(biz, 'You asked the co-founder a question from the console');
    return done();
  }

  if (sub === '/propose' && method === 'POST') {
    const { title, reasoning, effect } = await body();
    const allowed = new Set(['campaign', 'formation', 'day']);
    if (!allowed.has(effect)) return bad('The co-founder proposes a campaign, a formation or a launch-week day.');
    propose(biz, String(title ?? 'A task').slice(0, 120), String(reasoning ?? '').slice(0, 600), effect);
    return done();
  }

  if (sub === '/reply' && method === 'POST') {
    const { id, text } = await body();
    const mail = biz.emails.find(x => x.id === id);
    if (!mail) return bad('No such message.', 404);
    const clean = String(text ?? '').trim();
    if (!clean) return bad('Write the reply first.');
    // A reply is a draft: sending needs the founder's own mail provider, which is not connected.
    biz.emails.unshift({ id: uid(), folder: 'sent', from: `team@${biz.slug}.vibestartup.pro`, to: mail.from, subject: `Re: ${mail.subject}`, body: `${clean.slice(0, 4000)}\n\n(Draft: not delivered. Connect your email provider to send.)`, at: now(), read: true, by: 'you', draft: true });
    activity(biz, `Email reply drafted: ${mail.subject}`);
    return done();
  }

  if (sub === '/post' && method === 'POST') {
    const { text, date } = await body();
    const clean = String(text ?? '').trim();
    if (!clean) return bad('Write the post first.');
    biz.posts.push({ id: uid(), text: clean.slice(0, 1000), date: String(date ?? '').slice(0, 20), status: biz.social.personal ? 'Ready: sent to you to post by hand' : 'Draft: connect an account to publish' });
    activity(biz, 'Post drafted');
    return done();
  }

  if (sub === '/routine' && method === 'POST') {
    const b = await body();
    const every = EVERY_OK.has(b.every) ? b.every : 'Daily';
    const routine = { id: uid(), name: String(b.name ?? '').trim().slice(0, 80) || 'New routine', instructions: String(b.instructions ?? '').trim().slice(0, 600), schedule: String(b.schedule ?? 'every day at 9am').slice(0, 80), every, status: 'active', by: 'You', lastRun: null, lastResult: null };
    biz.routines.push(routine);
    activity(biz, `Routine created: ${routine.name}`);
    return done();
  }
  if (sub === '/routine/run' && method === 'POST') {
    const { id } = await body();
    const routine = biz.routines.find(r => r.id === id);
    if (!routine) return bad('No such routine.', 404);
    if (routine.status !== 'active') return bad('That routine is not active.', 409);
    const r = runBriefing(biz, profile, routine);
    if (r.error) return bad(r.error, 409);
    return done();
  }
  if (sub === '/routine/status' && method === 'POST') {
    const { id, status } = await body();
    const routine = biz.routines.find(r => r.id === id);
    if (!routine) return bad('No such routine.', 404);
    if (!['active', 'paused', 'cancelled'].includes(status)) return bad('A routine is active, paused or cancelled.');
    routine.status = status;
    activity(biz, `Routine ${status}: ${routine.name}`);
    return done();
  }
  if (sub === '/routine/edit' && method === 'POST') {
    const b = await body();
    const routine = biz.routines.find(r => r.id === b.id);
    if (!routine) return bad('No such routine.', 404);
    if (b.name !== undefined) routine.name = String(b.name).slice(0, 80) || routine.name;
    if (b.instructions !== undefined) routine.instructions = String(b.instructions).slice(0, 600);
    if (b.schedule !== undefined) routine.schedule = String(b.schedule).slice(0, 80);
    if (b.every !== undefined && EVERY_OK.has(b.every)) routine.every = b.every;
    activity(biz, `Routine edited: ${routine.name}`);
    return done();
  }

  if (sub === '/product' && method === 'POST') {
    const f = await body();
    const p = { id: uid(), name: String(f.name ?? '').trim().slice(0, 120), desc: String(f.desc ?? '').trim().slice(0, 600), price: Math.max(0, Number(f.price) || 0), billing: f.billing === 'recurring' ? 'recurring' : 'one-time', interval: String(f.interval ?? 'month').slice(0, 20), type: String(f.type ?? '').trim().slice(0, 60) || 'digital', status: f.status === 'active' ? 'active' : 'draft', at: now() };
    if (!p.name) return bad('A product needs a name.');
    biz.products.push(p);
    activity(biz, `Product added: ${p.name} (${p.status})`);
    if (p.status === 'active') checkDayOne(biz);
    return done();
  }
  if (sub === '/product/status' && method === 'POST') {
    const { id, to } = await body();
    const p = biz.products.find(x => x.id === id);
    if (!p) return bad('No such product.', 404);
    if (!['active', 'draft', 'archived'].includes(to)) return bad('A product is active, a draft or archived.');
    p.status = to;
    activity(biz, `Product ${to}: ${p.name}`);
    if (p.status === 'active') checkDayOne(biz);
    return done();
  }

  if (sub === '/checkout' && method === 'POST') {
    const { productId, email, card } = await body();
    const p = biz.products.find(x => x.id === productId);
    if (!p) return bad('No such product.', 404);
    const digits = String(card ?? '').replace(/\D/g, '');
    if (digits !== TEST_CARD.replace(/\D/g, '')) return bad('Test mode takes only the test card: 4242 4242 4242 4242. No real card is charged here.', 402);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email ?? ''))) return bad('The buyer needs an email address.');
    biz.checkouts += 1;
    biz.carts += 1;
    const order = { id: uid(), productId, name: p.name, amount: p.price, test: true, at: now(), email: String(email).slice(0, 200), delivery: /digital|download|ebook|course/i.test(p.type) ? 'Delivered: download sent' : 'Waiting on you: deliver it' };
    biz.orders.unshift(order);
    let c = biz.customers.find(x => x.email === email);
    if (!c) { c = { email, first: now(), orders: 0, spent: 0, test: true }; biz.customers.push(c); }
    c.orders += 1;
    c.spent += p.price;
    biz.events.push({ at: now(), text: `Test sale: ${p.name}, ${money(p.price)}` });
    activity(biz, `Test buy: ${p.name}`);
    biz.emails.unshift({ id: uid(), folder: 'inbox', from: email, to: `team@${biz.slug}.vibestartup.pro`, subject: `Order received (test): ${p.name}`, body: `A test order for ${p.name}, ${money(p.price)}.\nDelivery: ${order.delivery}.`, at: now(), read: false, by: 'checkout' });
    biz.messages.push({ id: uid(), from: 'cofounder', kind: 'milestone', title: 'Checkout works', text: `A test buy of ${p.name} went through, ${money(p.price)}. It is marked as a test and never counted as a real sale.`, at: now() });
    return done();
  }

  if (sub === '/studio/make' && method === 'POST') {
    const f = await body();
    const format = FORMATS.find(x => x.id === f.format) ?? FORMATS[0];
    if (!format.ready) return bad(`${format.name} is not built yet: it needs the video provider, which is not connected.`, 501);
    const n = Math.max(1, Math.min(6, Number(f.count) || 1));
    if (!charge(biz, format.low, `${format.name} × ${n}`)) return bad('No credits left.', 409);
    const product = biz.products.find(p => p.id === f.productId) ?? null;
    for (let i = 0; i < n; i++) {
      const svg = offerImage({ brand: biz.brand, words: f.words, product, look: f.look, n: i, name: biz.name });
      biz.creatives.push({ id: uid(), name: `${format.id}-${Date.now()}-${i}.svg`, svg, at: now(), kind: format.id, credits: format.low });
    }
    activity(biz, `Made ${plural(n, format.name)}`);
    say(biz, `${plural(n, format.name)} made. They are in the library.`);
    return done();
  }

  if (sub === '/secret' && method === 'POST') {
    const { name, value, remove } = await body();
    const key = String(name ?? '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 60);
    if (!/^[A-Z][A-Z0-9_]{1,59}$/.test(key)) return bad('A secret name is letters, digits and underscores, e.g. STRIPE_SECRET_KEY.');
    if (remove) { biz.secrets = biz.secrets.filter(s => s.name !== key); activity(biz, `Secret deleted: ${key}`); return done(); }
    if (!String(value ?? '').length) return bad('A secret needs a value.');
    const kept = { name: key, at: now(), digest: await digest(value), replaces: biz.secrets.filter(s => s.name === key).length };
    biz.secrets = biz.secrets.filter(s => s.name !== key).concat(kept);
    activity(biz, `Secret set: ${key}`);
    return done();
  }

  if (sub === '/settings' && method === 'POST') {
    const f = await body();
    if (f.autopilot !== undefined) {
      biz.autopilot = !!f.autopilot;
      activity(biz, `Autopilot ${biz.autopilot ? 'on' : 'off'}`);
      if (biz.autopilot) for (const t of biz.tasks.filter(x => x.status === 'approval')) approve(biz, t.id, 'autopilot');
    }
    if (f.personal !== undefined) biz.social.personal = !!f.personal;
    if (f.briefing !== undefined) biz.briefing = String(f.briefing).slice(0, 40);
    if (f.creativeBudget !== undefined) biz.creativeBudget = Math.max(0, Number(f.creativeBudget) || 0);
    if (f.domain !== undefined) {
      const d = String(f.domain).trim().toLowerCase();
      if (d && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) return bad('That is not a domain name.');
      biz.domain = d;
      biz.domainPending = !!d;
      if (d) biz.providers.domain = { status: 'needs_provider', at: now(), provider: PROVIDERS.domain.name };
      activity(biz, d ? `Domain requested: ${d}` : 'Domain removed');
    }
    return done();
  }

  if (sub === '/member' && method === 'POST') {
    const { email, role, revoke } = await body();
    const clean = String(email ?? '').trim().toLowerCase();
    if (revoke) { biz.members = biz.members.filter(x => x.email !== clean); activity(biz, `Invite revoked: ${clean}`); return done(); }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return bad('Enter an email address.');
    if (biz.members.length >= SEATS) return bad(`A business has ${SEATS} seats.`);
    if (!biz.members.some(x => x.email === clean)) biz.members.push({ email: clean, role: role === 'viewer' ? 'viewer' : 'admin', at: now(), invited: false });
    activity(biz, `Invited: ${clean}`);
    return done();
  }

  if (sub === '/provider' && method === 'POST') {
    const { kind } = await body();
    const provider = PROVIDERS[kind];
    if (!provider) return bad('No such provider.', 404);
    biz.providers[kind] = { status: 'needs_provider', at: now(), provider: provider.name };
    if (kind === 'social') for (const s of biz.social.asked) biz.social.asked.push(s);
    activity(biz, `Stopped at connect your ${provider.name} account`);
    return json({ id: row.id, startup: (await saveStartup(env, row.id, biz)), provider: { kind, ...provider, status: 'needs_provider' } });
  }

  if (sub === '/ads' && method === 'POST') {
    const f = await body();
    if (f.daily !== undefined) biz.ads.daily = Math.max(0, Number(f.daily) || 0);
    if (f.days !== undefined) biz.ads.days = Math.max(1, Number(f.days) || 14);
    if (f.recheck) { biz.ads.checked = now(); biz.ads.history.push({ at: now(), what: 'Plan rechecked' }); }
    return done();
  }

  if (sub === '/file' && method === 'POST') {
    const { name, body: text, remove } = await body();
    const clean = String(name ?? '').trim().replace(/[^A-Za-z0-9._-]/g, '').slice(0, 80);
    if (!clean) return bad('A file needs a name.');
    if (remove) { biz.uploads = (biz.uploads ?? []).filter(f => f.name !== clean); activity(biz, `File removed: ${clean}`); return done(); }
    const kept = { name: clean, group: 'Other', about: 'Uploaded', body: String(text ?? '').slice(0, 20000) };
    biz.uploads = (biz.uploads ?? []).filter(f => f.name !== clean).concat(kept);
    activity(biz, `File uploaded: ${clean}`);
    return done();
  }

  if (sub === '/leads' && method === 'POST') {
    const { leads } = await body();
    const list = (Array.isArray(leads) ? leads : []).filter(l => /@/.test(String(l?.email ?? ''))).map(l => ({ name: String(l.name ?? '').slice(0, 80), email: String(l.email).slice(0, 200) }));
    biz.leads = biz.leads.concat(list);
    activity(biz, `Leads uploaded: ${list.length}`);
    return done();
  }

  if (sub === '/visit' && method === 'POST') {
    biz.visits += 1;
    biz.events.push({ at: now(), text: 'A visit to the storefront' });
    return done();
  }

  if (sub === '/dispute' && method === 'POST') {
    const { id } = await body();
    const w = biz.billed.find(x => x.id === id);
    if (!w) return bad('No such charge.', 404);
    w.disputed = true;
    biz.credits = Math.min(FREE_CREDITS, biz.credits + w.credits);
    activity(biz, `Disputed: ${w.what}; ${plural(w.credits, 'credit')} back`);
    return done();
  }

  if (method === 'DELETE' && sub === '') {
    await env.DB.prepare('delete from app_startups where id = ? and user_id = ?').bind(row.id, user.id).run();
    return json({ ok: true });
  }

  return bad('No such route.', 404);
}

const EVERY_OK = new Set(['Daily', 'Every 30 minutes', 'Hourly', 'Every 6 hours', 'Every 12 hours', 'Weekly', 'Custom']);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        const r = await route(request, env);
        return r;
      } catch (e) {
        const message = String(e?.message ?? e);
        return json({ error: `The app failed: ${message.slice(0, 200)}` }, 500);
      }
    }
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};
