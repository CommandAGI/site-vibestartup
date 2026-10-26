// What the scripted co-founder of the demo says and makes. Everything here is sample text for a sample business; the
// live co-founder is an agent of a CommandAGI thread, not this file.

export const FREE_CREDITS = 50;
export const PAYOUT_MIN = 20;
export const SEATS = 10;

/** Launch week: one step a day, each with the task the co-founder proposes when the day starts. */
export const LAUNCH_WEEK = [
  { title: 'Site & first offer', task: null, about: 'The storefront is live and one product is active.' },
  { title: 'Your warm list', task: 'Add your warm contacts', about: 'Share 5 to 15 real people who may want to hear about the business. Only the people you give are recorded.' },
  { title: 'Personal notes', task: 'Send personal notes to the warm list', about: 'A short, personal note to each person on the warm list, drafted for you to send or approve.' },
  { title: 'Launch posts', task: 'Publish the launch posts', about: 'Launch posts in your brand for each connected account, or ready for you to post yourself.' },
  { title: 'Launch day', task: 'Open the doors', about: 'The launch offer goes live and the first follow-ups are scheduled.' },
  { title: 'Follow-ups', task: 'Follow up with everyone who replied', about: 'Answer every reply, thank every buyer, ask every visitor who left a cart.' },
  { title: 'Debrief', task: 'Write the launch debrief', about: 'What worked, what did not, and the plan for next week, in MEMORY.md.' },
];

/** What the studio can make. Only the offer image is ready in the demo; the others say so. */
export const FORMATS = [
  { id: 'offer', name: 'Offer image', about: 'A branded image with your offer, sized for every placement.', sizes: '9:16, 4:5, 1:1, 2:3, 1.91:1', takes: 'about a minute', low: 3, high: 5, ready: true },
  { id: 'image', name: 'Image', about: 'One image from a description. Your brand only if you ask for it.', sizes: '4:5, 1:1, 9:16, 16:9', takes: 'under a minute', low: 2, high: 4, ready: false },
  { id: 'short', name: 'Short video', about: 'Six to ten seconds, vertical, captions burned in.', sizes: '9:16, 4:5, 1:1', takes: 'about 4 minutes', low: 60, high: 110, ready: false },
  { id: 'clip', name: 'Clip', about: 'A four to eight second clip from a description or a still.', sizes: '9:16, 1:1', takes: 'about 3 minutes', low: 45, high: 80, ready: false },
  { id: 'presenter', name: 'Presenter ad', about: 'Fifteen seconds, a presenter reading your script word for word.', sizes: '9:16, 4:5, 1:1', takes: 'about 6 minutes', low: 20, high: 25, ready: false },
  { id: 'film', name: 'Launch film', about: 'Twenty to thirty seconds, built around your real photos.', sizes: '9:16, 4:5, 1:1, 16:9', takes: 'about 12 minutes', low: 50, high: 60, ready: false },
];

export const LOOKS = ['Up to you', 'Clean studio', 'In place', 'Bold type', 'Sunlit'];

export const SOCIAL = ['Instagram (professional)', 'Facebook Page', 'TikTok', 'X', 'YouTube', 'Threads', 'Pinterest', 'LinkedIn'];

export const PLANS = [
  { name: 'Starter', for: 'Testing your first idea.', features: ['One business', 'An agent team for code, images and video', 'Email and outbound', 'Ads on autopilot', 'A subdomain of vibestartup.pro'] },
  { name: 'Growth', for: 'For founders ready to grow.', features: ['Three businesses', 'Everything in Starter', 'Your own domain', 'Priority help'], featured: true },
  { name: 'Scale', for: 'Operators with many businesses.', features: ['Ten businesses', 'Everything in Growth', 'The most credits each month'] },
];

/** Freelancer rates the "what your co-founder built" estimate uses, in dollars. */
export const RATES = { page: 300, email: 50, deploy: 500, image: 40 };

export function slugify(name) {
  return String(name).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 32) || 'my-business';
}

/** A name from an idea: its two longest words, capitalised. */
export function suggestName(idea) {
  const words = String(idea).replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 3).sort((a, b) => b.length - a.length).slice(0, 2);
  if (!words.length) return '';
  return words.map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
}

/** Brand colours from the name, so each sample business looks like itself. */
export function brandFor(name) {
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.codePointAt(0)) % 360;
  const hsl = (s, l, hh = h) => `hsl(${Math.round(hh)} ${s}% ${l}%)`;
  return {
    primary: hsl(55, 38), secondary: hsl(30, 86, (h + 40) % 360), accent: hsl(80, 56, (h + 180) % 360),
    ground: hsl(30, 97), ink: hsl(20, 14),
    type: 'Serif headlines, sans-serif body', voice: ['warm', 'plain-spoken', 'confident'],
  };
}

export function money(n) { return `$${(Math.round(n * 100) / 100).toFixed(2)}`; }

/** The test card the demo checkout accepts. No other card is accepted and none is ever charged. */
export const TEST_CARD = '4242 4242 4242 4242';

/** The scripted reply to a message, by its words. */
export function replyTo(text, biz) {
  const t = text.toLowerCase();
  if (/customer|sell|sale|buyer/.test(t)) return `Your first customers usually come from people who already trust you. Launch week starts there: day 2 is your warm list. Share 5 to 15 names and I will draft a personal note to each, for you to approve.`;
  if (/price|product|offer/.test(t)) return `I would start with one clear offer and one price. Add it in Products (or tell me the name and price here), and I will make an offer image for it in the Studio.`;
  if (/ad|campaign|meta|facebook|instagram/.test(t)) return `The Ads tab holds the plan for one careful campaign: a daily budget, a two-week window and a target cost per sale. It lists what still blocks it; I can fix the ones I am allowed to.`;
  if (/budget|creative/.test(t)) return `Tell me a monthly creative budget and I will keep your feed and your ads stocked inside it, without asking for each piece.`;
  if (/hi|hello|hey/.test(t)) return `Hi! I am working on ${biz.name}. The Dashboard shows where launch week stands and what needs your call.`;
  return `Noted. I wrote it into MEMORY.md so it shapes what I do next. If it needs work from me, I will propose a task for your approval first.`;
}

const md = (title, sections) => `# ${title}\n\n${sections.map(([h, lines]) => `## ${h}\n\n${lines.map(l => `- ${l}`).join('\n')}`).join('\n\n')}\n`;

/** The business's memory as files: what the co-founder reads at the start of every session. */
export function memoryFiles(biz, profile) {
  const active = biz.products.filter(p => p.status === 'active');
  const real = biz.orders.filter(o => !o.test);
  return [
    { name: 'SOUL.md', group: 'Identity', about: 'Co-founder personality and voice', body: md(`SOUL: ${biz.cofounder}`, [
      ['Who', [`${biz.cofounder} is the AI co-founder of ${biz.name}. It builds, ships and grows the business with its human partner.`]],
      ['Personality', ['Design-minded: how it looks and feels matters as much as what it does.', 'Customer first: every change is judged from the buyer\'s side.', 'Transparent: it says what it is doing and why.', 'Honest about numbers: a test sale is never counted as a real one.']],
      ['Decisions', ['Does it serve the customer?', 'Is it the simplest thing that works?', 'Can it ship today?', 'Is it easy to change later?']],
    ]) },
    { name: 'BUSINESS.md', group: 'Identity', about: 'Business overview and goals', body: md(`BUSINESS: ${biz.name}`, [
      ['Idea', [biz.idea]],
      ['Offer', active.length ? active.map(p => `${p.name}: ${p.price ? '$' + p.price.toFixed(2) : 'free'} ${p.billing === 'recurring' ? 'per ' + p.interval : 'one-time'}`) : ['No active product yet.']],
      ['Goals', ['First three real sales.', 'Finish launch week.']],
    ]) },
    { name: 'OWNER.md', group: 'Identity', about: 'Owner profile and preferences', body: md('OWNER: human partner', [
      ['Who', [`Name: ${profile.name || 'not given'}`, `Email: ${profile.email || 'not given'}`]],
      ['Preferences', [biz.autopilot ? 'Autopilot is on: the co-founder acts and briefs.' : 'Autopilot is off: big steps wait for approval.', `Briefing: ${biz.briefing}`]],
    ]) },
    { name: 'PLAYBOOK.md', group: 'Operations', about: 'Operational playbook', body: md('PLAYBOOK', [
      ['Every morning', ['Compile the numbers, the open approvals and today\'s plan; send them in chat and by email.']],
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

export function termsDraft(biz) {
  return `Terms of sale for ${biz.name} (draft, not legal advice)\n\n1. Who sells: ${biz.name}, reachable at team@${biz.slug}.vibestartup.pro.\n2. What you buy: what the product page says, at the price shown at checkout.\n3. Refunds: within 14 days of purchase.\n4. Changes: we tell buyers before terms change.`;
}

export function privacyDraft(biz) {
  return `Privacy notice for ${biz.name} (draft, not legal advice)\n\nWe keep your name, email and order to deliver what you bought and to answer you. We do not sell your data. Ask us at team@${biz.slug}.vibestartup.pro to see or delete what we keep.`;
}

/** An offer image as SVG, drawn from the brand, the words and the look. Nothing is fetched. */
export function offerImage({ brand, words, product, look, n, name }) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
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
  const price = product ? `<text x="32" y="440" font-family="system-ui, sans-serif" font-size="20" font-weight="700" fill="${fg}">${esc(product.name)} · ${product.price ? '$' + product.price.toFixed(2) : 'free'}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500"><rect width="400" height="500" fill="${bg}"/>${shapes}${text}${price}<text x="32" y="478" font-family="system-ui, sans-serif" font-size="14" fill="${fg}" opacity="0.8">${esc(name)}</text></svg>`;
}

export function brandKitImage(biz) {
  const b = biz.brand;
  const sw = [b.primary, b.secondary, b.accent, b.ground, b.ink].map((c, i) => `<rect x="${30 + i * 70}" y="210" width="60" height="60" rx="6" fill="${c}" stroke="#0002"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300"><rect width="400" height="300" fill="${b.ground}"/><text x="30" y="80" font-family="Georgia, serif" font-size="40" fill="${b.ink}">${biz.name.replace(/[&<>]/g, '')}</text><text x="30" y="120" font-family="system-ui, sans-serif" font-size="16" fill="${b.ink}">Brand kit · ${b.voice.join(', ')}</text>${sw}</svg>`;
}

export function logoImage(biz, dark) {
  const b = biz.brand, letter = biz.name.trim()[0]?.toUpperCase() ?? 'V';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><rect width="200" height="200" rx="36" fill="${dark ? b.ink : b.ground}"/><circle cx="100" cy="100" r="64" fill="${b.primary}"/><text x="100" y="124" text-anchor="middle" font-family="Georgia, serif" font-size="72" fill="${b.ground}">${letter.replace(/[&<>]/g, '')}</text></svg>`;
}

export const svgData = svg => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
