// A business is a folder in the founder's Drive, a co-founder thread, its triggers and a site (docs/ARCHITECTURE.md).
// This module holds the record's shape, the creation sequence, the co-founder's charter, the memory-file templates,
// the brand generator (a script, labelled so) and the storefront writer. Everything here is the founder's own
// CommandAGI objects; nothing is kept anywhere else.
import { api, auth, drive, threads, agents, sites, email, mcp, integrations, BRAND, API } from './api.js';
import { slugify } from './ui.js';
import { storefrontFiles, ensureSignups } from './storefront.js';
import { TEMPLATES, STYLES, newStorefrontSource, sourceMark } from './storefront-design.js';

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

// The suggestions for an idea (names, a tagline, the blueprints ranked, a first product, the storefront's layout and
// look) come from a model: lib/suggest.js.

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
export const markSvg = (name, brand) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" fill="${brand.primary}"/><text x="32" y="41" text-anchor="middle" font-family="Instrument Sans, Arial, sans-serif" font-size="28" font-weight="700" fill="${brand.ground === '#ffffff' ? '#fff' : brand.ink}">${(String(name).trim()[0] || 'V').toUpperCase()}</text></svg>`;

// ---------- the co-founder's charter ----------

/**
 * How the co-founder changes the storefront's layout, look and words: one file, never the site's HTML (charter and
 * CODEMAP.md). The console publishes the change when the founder opens it.
 */
export const storefrontRule = biz => `The storefront's layout, look and words are one file: ${folderOf(biz.slug)}/storefront.json. Never edit the HTML or CSS in the site folder: every publish writes them again from this file, products/products.json and the brand kit. Read the file, change only the fields you mean to, and write the whole file back with write_drive_file (keep it valid JSON):
- "template" is the layout, one of: ${TEMPLATES.map(t => `"${t.id}" (${t.about})`).join(' ')}
- "style" is the look, one of: ${STYLES.map(t => `"${t.id}" (${t.about})`).join(' ')}
- "copy" holds the words: "announcement" (a line above the header), "kicker" (the small label over the headline), "headline", "subhead", "cta" (the main button), "productsTitle", "about": { "title", "text" }, "points": [{ "title", "text" }], "faq": [{ "q", "a" }], "testimonials": [{ "quote", "name" }]. An empty field shows the default (the tagline, the idea); an empty list hides its section. Testimonials are real customers' words only: never write one yourself.
- "sections" turns a section off with false: "how" (How it works), "about", "points", "faq", "testimonials".
Switching "template" or "style" keeps every word, product and picture. The change goes live when the founder opens the console (it publishes the file's changes), or presses Publish in the console's Storefront tab; say so. It is a change to the live site, so it needs an approved task first.`;

/** How the co-founder adds a product: a product file the Drive indexes as a good (charter and PLAYBOOK.md). */
export const productsRule = biz => `Products are goods on CommandAGI, so the checkout can sell them. Never list a product only in a page or a JSON file. To add one, write its product file with write_drive_file at ${folderOf(biz.slug)}/products/<slug>.product.tsx (the Drive indexes it as a good; a file it refuses is not a good, so read the answer). The file is SDK code:
- physical: export default () => (<product name="Desk lamp" kind="physical" status="draft" description="…" shipping={{ zones: [{ rule: "flat", countries: ["US"], amountCents: 500 }] }}><variant sku="${biz.slug.toUpperCase()}-LAMP" name="Standard" priceCents={4900} /></product>);
- digital: export default () => (<product name="Prompt pack" kind="digital" status="draft" description="…"><variant sku="${biz.slug.toUpperCase()}-PACK" name="Download" priceCents={1900} file="./files/prompt-pack.zip" /></product>); the variant's file is the thing sold, a path from the product file's folder, and it must exist first.
Keep status="draft": the console makes a good live when the founder's payouts are ready. Then add the product to ${folderOf(biz.slug)}/products/products.json (keep its other entries): { "id": "<slug>", "name", "description", "price": 19, "priceLabel": "$19", "type": "physical" or "digital", "status": "active", "file": "${folderOf(biz.slug)}/products/<slug>.product.tsx", "images": [{ "path": "${folderOf(biz.slug)}/studio/<picture>.png" }], "createdAt": <ms> }. "images" are Drive paths of pictures (the Studio's, or ones the founder uploaded); the storefront shows them, sized for the web, the first on the product's card. The console's Products tab links the entry to its good and publishes the storefront; ask the founder to open Products once. A physical good sells through the checkout once payouts are connected; a digital one too where the checkout sells downloads to guests (the console checks), and by email elsewhere.`;

// The co-founder's model: OpenAI's GPT-6 Luna at low effort. It is the fastest OpenAI model in the platform's catalog
// that does the agent loop's structured steps well. Production, 2026-11-11, through POST /models/call: about 1.4 s to
// its first token and 2.2 s for a three-line greeting, against 1.9 s and 4.4 s for Claude Sonnet 5.5 (the default, at
// its high effort); GPT-5.6 Luna was as fast and costs twice as much, GPT-6.1 Sol was slower. CommandAGI's scouts put
// Luna's quality level with Sonnet's on their knowledge-work cases (docs/scouts.md there). The co-founder is an agent
// of its own, a fork of the catalog's base instance of this model, so the agent's record names the model it runs.
// The platform's model floor (`connections.modelFloor`: Sonnet 5.5 for every connected account) would refuse this agent
// the founder's connected accounts (a social account, Gmail); the founder's own level admits it (FOUNDER_FLOOR below).
export const COFOUNDER_MODEL = 'openai/gpt-6-luna';
export const COFOUNDER_EFFORT = 'low';

/**
 * The founder's own model floor (CommandAGI `docs/services.md` § a brand's founders): the platform's default (Claude
 * Sonnet 5.5 or higher), or the co-founder's model, so the co-founder may use the founder's connected accounts (a social
 * account, mail). It is the founder's setting at the founder's own level, written with the founder's token: at sign-up,
 * and for an account made before, at its next business while its floor is still the platform's default. A floor the
 * founder chose is never overwritten.
 */
export const FOUNDER_FLOOR = [{ model: 'anthropic/claude-sonnet-5-5' }, { model: COFOUNDER_MODEL }];
const PLATFORM_FLOOR = JSON.stringify([{ model: 'anthropic/claude-sonnet-5-5' }]);
export async function allowCofounderAccounts({ atSignUp = false } = {}) {
  if (!atSignUp) {
    const listed = await integrations.list().catch(() => null);
    const floor = (listed?.integrations ?? []).map(e => e.modelFloor).find(f => f?.key === '*');
    if (!floor || JSON.stringify(floor.floors) !== PLATFORM_FLOOR) return null;
  }
  return integrations.setFloor('*', FOUNDER_FLOOR);
}
/** The catalog's base instance of a model: its id in lowercase words (CommandAGI's `apiBaseId`). */
const baseOf = modelId => modelId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export function charterFor(biz, founder) {
  const partner = PARTNERS.find(p => p.id === biz.partner) ?? PARTNERS[2];
  const voice = VOICES.find(v => v.id === biz.voice) ?? VOICES[0];
  return `You are ${biz.cofounder.name}, the AI co-founder of ${biz.name}, a business started on ${BRAND.name} (a CommandAGI brand). You say you are an AI agent whenever it matters, to the founder and to anyone you write to.

The founder is ${founder.name || 'the founder'} (${founder.email}). The business: ${biz.idea}
The first version: ${biz.blueprint?.title ?? 'a storefront with one offer'}. ${biz.blueprint?.about ?? ''}
Your character: ${partner.name}. ${partner.about} Traits: ${partner.traits.join(', ')}. The brand's voice is ${voice.name.toLowerCase()}.

The brief, so you need no file to start: the brand's vibe is ${biz.vibe}, its colours ${biz.brand?.primary ?? ''} and ${biz.brand?.accent ?? ''}. The business email is ${biz.email?.address ?? 'not claimed yet'}. The storefront ${biz.site ? `is at ${biz.site.brandUrl ?? biz.site.url}` : 'is not made yet'}. The launch week started ${new Date(biz.launchWeek?.startedAt ?? Date.now()).toISOString().slice(0, 10)}; day 1 is the site and the first offer.

Your files live in the founder's Drive at ${folderOf(biz.slug)}/ (business.json is the record; cofounder/ holds your memory: SOUL.md, BUSINESS.md, OWNER.md, PLAYBOOK.md, MEMORY.md; products/, orders/, customers/, leads/, ads/, social/, studio/, Tasks/). Read a file when the work needs what is in it, not before every answer (list_drive on the folder, then read_drive_file with the file's id), and write what you learn into MEMORY.md (write_drive_file with the folder path and the file name).

Answer first. When the founder writes, your first action is a short message in chat; then do the work with your tools, and say what you did when it is done. The storefront is a CommandAGI site${biz.site?.url ? ` at ${biz.site.brandUrl ?? biz.site.url}` : ''}; its folder is ${biz.site?.folder ?? 'Sites/<name>'} and a deploy publishes it.

${productsRule(biz)}

${storefrontRule(biz)}

${WIDGETS_RULE}

Rules you keep:
1. The founder decides. Before any spend, any public post, any change to the live site, any contact import and any legal filing, create a task in ${folderOf(biz.slug)}/Tasks with the labels ["biz:${biz.slug}", "needs-approval"], assigned to user:${founder.id}, that says what you propose and why, and tell the founder in chat. Do that work only after the task is approved (status doing, assigned to you).
   Each task has a taskKey: the launch day and the step, such as "day1.storefront", "day1.offer" or "day2.warm-list". Before you create a task, read your open tasks (task_list with labels ["biz:${biz.slug}"]) and create only one that is not there. A task_create with a key a task has returns that task with existing: true and creates nothing. A founder's question is not a request for a task: answer it.
2. No pretending. Never say a feature works that does not. A test order is a test. Count only measured numbers. If a provider is not connected (payments, ads, a social account, outbound mail), say so and stop there.
3. Money moves only by the founder's act. Never spend past an approved budget.
4. Secrets are never shown again. Never write a key or a password into chat or a file.
5. Contacts are only the ones the founder gives. Record only people the founder shares.
6. ${biz.autopilot ? 'Autopilot is on: do routine work inside the limits above and report what you did.' : 'Autopilot is off: propose, then wait.'}

The launch week is seven days: site and first offer, the warm list, personal notes, launch posts, launch day, follow-ups, debrief. Each day's work is a proposal the founder approves. Every morning's briefing (a routine) reports the numbers with their change, the highlights, today's plan and what waits on the founder, in a few short lines.

Write short, plain sentences. One idea per sentence. Say what you did, what you found, and what you need.`;
}

/**
 * How the co-founder asks with the chat's controls (CommandAGI's ChatUi, drawn by lib/widgets.js): a ```cagi-ask block
 * of JSON at the end of a message, which the platform takes out of the words and keeps as the message's `ui`. The
 * founder's answer is their next line. A file is asked for with request_upload. An approval task stays the way work
 * that spends, posts or publishes starts.
 */
export const WIDGETS_RULE = `CHAT CONTROLS. This chat (the ${BRAND.name} console) draws controls and charts under your words: option buttons, a slider, yes and no buttons, a text box and a line chart. You make one by ending your message with a fenced code block whose language tag is cagi-ask and whose body is one JSON object. The console takes the block out of your words and shows the control; the founder's tap comes back to you as their next message. So never say the chat cannot show buttons, a slider or a chart: write the block. Never draw a chart with text characters: a chart is a lens block. One control a message (two controls are two messages), valid JSON only.

A whole message with a choice, exactly as you write it:

Which price do we start with? Cafes pay about $20 for a hand-made mug.
\`\`\`cagi-ask
{"kind":"select","prompt":"Starting price for one mug","options":[{"value":"18","label":"$18","description":"Under what cafes pay"},{"value":"24","label":"$24"},{"value":"30","label":"$30","description":"Premium"}],"freeText":true}
\`\`\`

The other kinds go in the same block:
- several picks: {"kind":"multiselect","prompt":"Which channels first?","options":[{"label":"Instagram"},{"label":"Email"}],"submitLabel":"Send"}
- a quick yes or no: {"kind":"confirm","prompt":"Shall I draft the launch post now?"}
- a number, such as a price or a budget: {"kind":"slider","prompt":"Ad budget for the first month, in dollars","min":0,"max":500,"step":25,"defaultValue":150}
- a short answer in words: {"kind":"text","prompt":"What is the shop's phone number?"}
- numbers over time, as a chart (measured numbers only, never made up): {"kind":"lens","lens":{"lens":"series","title":"Sales a week","data":{"points":[{"t":1767225600000,"value":120,"label":"Jan 1"},{"t":1767830400000,"value":210,"label":"Jan 8"}]},"spec":{"prefix":"$"}}} ("t" is the time in ms, "label" what the founder reads, "spec" may name a "prefix" or a "suffix"). Dated events: {"kind":"lens","lens":{"lens":"timeline","data":{"events":[{"id":"1","t":1767225600000,"label":"Site live"}]}}}. Parts of a whole: {"kind":"lens","lens":{"lens":"treemap","data":{"name":"Costs","children":[{"name":"Clay","value":40}]}}}.
- a file you need (a logo, a photo, a price list): call request_upload with a prompt and accept (for example ["image/*"]) and end your turn; no block.
For the founder, use a block for every kind above, not ask_question, ask_user or your confirm step: a yes or no is a block with "kind":"confirm", a number a slider block, a chart a lens block. Your words and the block go in one message.

A control asks; it does not approve. Spend, a public post, a live-site change, a contact import and a legal filing still start only from an approved task (rule 1): a confirm never stands in for one. Settle a question with a control first, then write the task for the decision that starts the work.`;

/** The welcome's template: its name is on the thread's line (`template`) and in the record, so it is never counted as a model's words. */
export const WELCOME_TEMPLATE = 'vibestartup.welcome.v1';

/**
 * The two day-one approvals the welcome promises and the opening asks for: the site, then the first offer. Each has its
 * `taskKey` (day and step): a repeated task_create with it answers the card it made (`existing: true`), so a
 * co-founder that calls task_create again makes no second card (production, 2026-11-11).
 */
export const dayOneTasks = biz => [
  { key: 'day1.storefront', title: `Make the ${biz.name} storefront yours`, body: `The storefront is up${biz.site ? ` at ${biz.site.brandUrl ?? biz.site.url}` : ''}. Check the words, the look and the details, and say what to change, so day 1 ends with a page you are proud to share.` },
  { key: 'day1.offer', title: 'Pick your first offer and its price', body: `One product for ${biz.name}, with a clear price, ready to sell. I draft the name, the description and the price; you approve it before it goes on the storefront.` },
];

/**
 * The co-founder's first message, written from the record before any model runs (owner, 2026-11-11): it is the
 * thread's first line, said as the co-founder (`POST /threads { greeting }`), so it shows at once, stays in the
 * transcript, and the co-founder's first turn reads it as its own words. It says plainly that the co-founder is an AI
 * agent. Each sentence is one idea, for a young founder starting a first business.
 */
const lowerFirst = t => (/^(A|An|The)\b|^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);
export function welcomeFor(biz, founder) {
  const first = String(founder?.name ?? '').trim().split(/\s+/)[0] || 'there';
  const partner = PARTNERS.find(p => p.id === biz.partner) ?? PARTNERS[2];
  const url = biz.site ? (biz.site.brandUrl ?? biz.site.url).replace(/^https?:\/\//, '') : null;
  const [site, offer] = dayOneTasks(biz);
  const hello = {
    casual: `Hey ${first}! I'm ${biz.cofounder.name}, your co-founder for ${biz.name}.`,
    professional: `Hi ${first}. I'm ${biz.cofounder.name}, your co-founder for ${biz.name}.`,
    witty: `Hey ${first}! I'm ${biz.cofounder.name}, your co-founder for ${biz.name}.`,
    bold: `${first}, let's go. I'm ${biz.cofounder.name}, your co-founder for ${biz.name}.`,
  }[biz.voice] ?? `Hey ${first}! I'm ${biz.cofounder.name}, your co-founder for ${biz.name}.`;
  const style = {
    hustler: 'I move fast, and I will push us to ship something real this week.',
    strategist: 'I like a plan, so we will take one clear step at a time.',
    creative: 'I care about how it looks and feels, so people love it from the first click.',
    operator: 'I keep things organised, so nothing falls through the cracks.',
  }[partner.id] ?? '';
  return [
    `${hello} ${biz.voice === 'witty' ? "I'm an AI agent, so I never sleep (and I won't eat your snacks). I do the work; you make the calls." : "I'm an AI agent: I do the work, and you make the calls."}`,
    `I love this idea: ${lowerFirst(biz.idea.trim().replace(/[.!]+$/, ''))}. ${style}`.trim(),
    url ? `Your storefront is going live at ${url} right now.` : 'Your storefront is being set up now.',
    `Here is day 1. I'm writing two cards for you to approve:\n1. ${site.title}\n2. ${offer.title}`,
    'Nothing goes public, and no money moves, until you say yes. Ask me anything while I work.',
  ].join('\n\n');
}

/**
 * The opening ask: the day-one proposal as two approval tasks and one line that names them. After a kept welcome
 * (`greeted`) the co-founder does not greet again; without one it says hello first, with no tool before it. The console
 * shows this ask as one quiet line (app/tabs/chat.js).
 */
export function openingFor(biz, founder, { greeted = true } = {}) {
  const [site, offer] = dayOneTasks(biz);
  const look = biz.site?.storefront?.template ? biz.site.storefront : null;
  const first = greeted
    ? 'Your welcome message is above this one, so do not greet me again.'
    : 'First say hello in two or three short lines, from what you already know; use no tool before that message.';
  return `Hi ${biz.cofounder.name}. I'm ${founder.name || 'the founder'}. We're starting ${biz.name}: ${biz.idea}\n\n${first} Now make the two day-one approval tasks${greeted ? ' your welcome promised' : ''}, both in one step: task_create with { title, body, taskKey, dir: "${folderOf(biz.slug)}/Tasks", labels: ["biz:${biz.slug}", "needs-approval"], assignees: ["user:${founder.id}"], status: "todo" }, the first titled "${site.title}" with taskKey "${site.key}" (body: ${site.body}) and the second titled "${offer.title}" with taskKey "${offer.key}" (body: ${offer.body}). Make them once: after this turn they exist, and no later message asks for them again.${look ? ` Also on day 1, check that the storefront's layout ("template": "${look.template}") and look ("style": "${look.style}") fit the idea; if they do not, name the better pair in the storefront card's body, and change storefront.json once that card is approved.` : ''} Your instructions have what you need, so read no file and describe no tool first. Then say in one short line that both cards are ready for me. After this, when you need me to choose, say yes or no, give a number or send a file, ask with a chat control as your instructions show.`;
}

const memoryFiles = (biz, founder) => {
  const partner = PARTNERS.find(p => p.id === biz.partner) ?? PARTNERS[2];
  return {
    'SOUL.md': `# ${biz.cofounder.name}\n\nI am ${biz.cofounder.name}, the AI co-founder of ${biz.name}. I am an AI agent and I say so.\n\n## Character\n\n${partner.name}: ${partner.about} ${partner.traits.join(', ')}.\n\n## Voice\n\n${(VOICES.find(v => v.id === biz.voice) ?? VOICES[0]).name}. ${(VOICES.find(v => v.id === biz.voice) ?? VOICES[0]).sample}\n\n## How I work\n\n- The founder decides. Spend, public posts, live-site changes, contact imports and legal filings wait for approval.\n- I never pretend. A gap is reported as a gap.\n- I write what I learn into MEMORY.md.\n`,
    'BUSINESS.md': `# ${biz.name}\n\n${biz.idea}\n\n## The first version\n\n${biz.blueprint?.title ?? ''}. ${biz.blueprint?.about ?? ''}\n\n## Brand\n\nVibe: ${biz.vibe}. Voice: ${biz.voice}. Colours: primary ${biz.brand.primary}, secondary ${biz.brand.secondary}, accent ${biz.brand.accent}. Type: ${biz.brand.type}.\n\n## Storefront\n\n${biz.site?.brandUrl ?? biz.site?.url ?? 'not yet live'} (folder ${biz.site?.folder ?? ''}).\n\n## Email\n\n${biz.email?.address ?? 'not yet claimed'}\n`,
    'OWNER.md': `# The founder\n\n${founder.name || ''} (${founder.email}). Autopilot: ${biz.autopilot ? 'on' : 'off'}. Briefing: ${biz.briefing}.\n\nWhat the founder decides: spend, public posts, live-site changes, contact lists, legal filings.\n`,
    'PLAYBOOK.md': `# Playbook\n\n## Launch week\n\n${LAUNCH_WEEK.map(d => `${d.day}. ${d.title}: ${d.about}`).join('\n')}\n\n## Daily briefing\n\nNumbers with their change, highlights, today's plan, what waits on the founder. A few short lines.\n\n## Approvals\n\nA task in Tasks/ with labels biz:${biz.slug} and needs-approval, assigned to the founder, and a taskKey of its day and step (day1.storefront, day1.offer, day2.warm-list). Read the open tasks first and make only the ones that are not there; a repeated key returns the task it made. Work starts when it is approved.\n\n## Asking in chat\n\nA choice is a select, a yes or no a confirm, a price or a budget a slider, numbers over time a lens chart: a \`\`\`cagi-ask JSON block at the end of the message (the charter has the shapes). A file is request_upload. A control never stands in for an approval task.\n\n## Products\n\n${productsRule(biz)}\n`,
    'PLATFORM.md': `# The platform\n\n${biz.name} runs on CommandAGI under the ${BRAND.name} brand. My tools reach the founder's Drive (this folder), tasks, triggers (routines) and sites (the storefront). The storefront deploys from its folder. Payments, ads, social posting and outbound mail need the founder's own provider accounts; until one is connected I stop at the call and say so.\n`,
    'MEMORY.md': `# Memory\n\n- ${new Date().toISOString().slice(0, 10)}: the business was created on ${BRAND.name}. Nothing has been learned yet.\n`,
    'CODEMAP.md': `# Code map\n\nThe storefront is a static site in the founder's Drive (${biz.site?.folder ?? 'Sites/<name>'}): index.html (the shop and its "Get updates" form), product/<id>.html (a page per product), checkout.html, terms.html, privacy.html, refunds.html, images/ (product pictures), products.json, style.css, app.mjs (keeps the sign-ups). The console writes them all on every publish, so edit the sources instead: storefront.json in this business's folder for the layout, the look and the words (below), products/products.json for the products, legal/terms.html, legal/privacy.html and legal/refunds.html here for the business's own pages (they replace the defaults). Sign-ups from the storefront reach customers/customers.json when the founder opens Customers.\n\n## storefront.json\n\n${storefrontRule(biz)}\n`,
    'SUPPORT.md': `# Support\n\nCustomers write to ${biz.email?.address ?? 'the business address'}. Answer within a day. A refund or a dispute is the founder's decision.\n`,
  };
};

// ---------- the storefront ----------

// The storefront's files and its publish are lib/storefront.js; the creation sequence below and the tabs use them.
export { storefrontFiles, publishStorefront, storefrontUrl } from './storefront.js';

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
  const out = (await Promise.all(folders.map(f => drive.readJsonPath(folderOf(f.name), 'business.json').catch(() => null)))).filter(Boolean);
  return out.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/** Read a JSON file of the business, or the fallback. */
export const readBizJson = (slug, rel, fallback) => drive.readJsonPath(`${folderOf(slug)}/${rel.split('/').slice(0, -1).join('/')}`.replace(/\/$/, ''), rel.split('/').pop()).then(v => v ?? fallback).catch(() => fallback);
export const writeBizJson = (slug, rel, value) => drive.writeJson(`${folderOf(slug)}/${rel.split('/').slice(0, -1).join('/')}`.replace(/\/$/, ''), rel.split('/').pop(), value);

/**
 * The co-founder's agent and thread: a fork of COFOUNDER_MODEL's base instance named for the co-founder, with the
 * charter as its instructions, the thread's tools (the account-wide scopes a thread's default agent has) and
 * COFOUNDER_EFFORT; then the thread, seated on it, with the opening ask. A stack whose catalog lacks the base seats the
 * account's default agent, as before, and the record says which model runs.
 */
async function startCofounder(biz, founder, userId) {
  const charter = charterFor(biz, founder);
  // A fork made by an earlier try whose thread was refused (a missing date of birth) is the co-founder still.
  let agentId = biz.cofounder.forkId ?? null;
  try {
    if (!agentId) {
      const made = await agents.fork(baseOf(COFOUNDER_MODEL), { name: biz.cofounder.name, instructions: charter });
      agentId = made?.agent?.id ?? null;
      if (agentId) await agents.update(agentId, { modelEffort: COFOUNDER_EFFORT, access: { scopes: ['*'], reach: 'project' } });
      biz.cofounder.forkId = agentId;
    }
  } catch (e) {
    if (e.code === 'age_restricted' || e.code === 'age_verification_required') throw e;
    biz.gaps = [...(biz.gaps ?? []), { at: Date.now(), what: 'model', why: `The co-founder runs the account's default model: ${e.message}`, code: e.code ?? null }];
    agentId = null;
  }
  const welcome = welcomeFor(biz, founder);
  const launch = {
    title: biz.name, agentName: biz.cofounder.name, systemPrompt: charter,
    ...(agentId ? { fromAgentId: agentId } : {}),
    surface: 'vibestartup', about: addressOf(userId, biz.slug), reality: 'simulation', idempotencyKey: `vibestartup:${biz.slug}:${biz.createdAt}`,
  };
  // The thread with the welcome as its first line, then the opening ask by the same launch's replay (its id is the
  // thread's, so it is said once). The ask depends on the answer: after a kept welcome the co-founder does not greet
  // again; a platform that keeps no welcome (it predates `greeting`) gets the ask that greets first.
  const t = await threads.create({ ...launch, greeting: { text: welcome, template: WELCOME_TEMPLATE } });
  const kept = t.greeting === 'delivered' || t.greeting === 'already';
  await threads.create({ ...launch, intent: openingFor(biz, founder, { greeted: kept }) });
  biz.cofounder.threadId = t.threadId;
  // The welcome is a template's words, not a model's: the record says so, and whether the platform kept it as the
  // thread's first line.
  biz.cofounder.welcome = { template: WELCOME_TEMPLATE, text: welcome, at: Date.now(), kept: t.greeting ?? null, lineId: kept ? `greeting:${t.threadId}` : null };
  const full = await threads.get(t.threadId).catch(() => null);
  const seated = full?.agents?.[0] ?? null;
  biz.cofounder.agentId = agentId ?? full?.agentId ?? seated?.id ?? null;
  biz.cofounder.model = seated?.modelId ?? (agentId ? COFOUNDER_MODEL : null);
  biz.ownerScope = t.ownerScope ?? null;
  return biz;
}

/**
 * Another chat with the co-founder: a thread about the same business.json (so `threads.of` lists it beside the first),
 * the same charter and the same agent's settings (its fork: model, effort, tools). The approval cards, the files and
 * the daily briefing belong to the business and its first thread, so every chat sees the same ones. No opening ask:
 * the founder's first line starts it, and the platform names the thread after its first exchange.
 */
export async function startChat(biz, founder, userId) {
  const agentId = biz.cofounder?.forkId ?? null;
  const t = await threads.create({
    title: 'New thread', agentName: biz.cofounder?.name, systemPrompt: charterFor(biz, founder),
    ...(agentId ? { fromAgentId: agentId } : {}),
    surface: 'vibestartup', about: addressOf(userId, biz.slug), reality: 'simulation',
  });
  return t.threadId;
}

/**
 * An existing business's co-founder on COFOUNDER_MODEL, asked once (the console calls it when the chat opens). A thread
 * whose agent is on another provider's harness keeps its model: the platform refuses that move (`harness_fixed`: a
 * model of another provider is another agent), and the record keeps the answer so the console does not ask again.
 */
export async function moveCofounderModel(biz) {
  const cof = biz.cofounder ?? {};
  if (!cof.threadId || cof.model === COFOUNDER_MODEL || cof.modelAsked === COFOUNDER_MODEL) return null;
  try {
    // The model only: an effort here would be set on the account's default agent, which other threads share.
    await threads.update(cof.threadId, { modelId: COFOUNDER_MODEL });
    cof.model = COFOUNDER_MODEL;
  } catch (e) {
    cof.modelRefused = { code: e.code ?? null, why: e.body?.detail ?? e.message };
  }
  cof.modelAsked = COFOUNDER_MODEL;
  biz.cofounder = cof;
  return writeBusiness(biz);
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
    v: 1, slug, name, idea: String(input.idea).trim(), tagline: String(input.tagline ?? '').trim(),
    blueprint: input.blueprint ?? null,
    // The storefront's layout and look picked at sign-up (the model's suggestion for the idea, else none): the first
    // storefront.json starts from it (lib/storefront-design.js defaultStorefront).
    storefrontPick: input.storefront?.template || input.storefront?.style ? { template: input.storefront.template ?? null, style: input.storefront.style ?? null } : null, vibe: input.vibe ?? 'clean', voice: input.voice ?? 'casual', partner: input.partner ?? 'creative',
    cofounder: { name: input.cofounder || COFOUNDER_NAMES[0], threadId: null, agentId: null, storefrontRule: true },
    brand: brandFor(name, input.vibe ?? 'clean', input.voice ?? 'casual'),
    site: null, email: null, autopilot: false, briefing: 'daily',
    launchWeek: { startedAt: Date.now() }, gaps: [], createdAt: Date.now(), updatedAt: Date.now(), founderId: me.id,
  };
  onStep('Making the folder');
  const folder = folderOf(slug);
  await drive.ensure(folder);
  // The folders, then the files, each group at once: one call at a time took about a minute on production (2026-11-11).
  await Promise.all(['cofounder', 'brand', 'products', 'orders', 'customers', 'leads', 'outbound', 'ads', 'social', 'studio', 'Tasks'].map(sub => drive.mkdir(folder, sub).catch(() => null)));
  await Promise.all([
    drive.writeJson(folder, 'business.json', biz),
    drive.writeJson(`${folder}/products`, 'products.json', { products: [] }),
    drive.writeJson(`${folder}/customers`, 'customers.json', { customers: [] }),
    drive.writeJson(`${folder}/social`, 'posts.json', { posts: [] }),
    drive.writeJson(`${folder}/brand`, 'brand-book.json', biz.brand),
    drive.write(`${folder}/brand`, 'logo.svg', markSvg(name, biz.brand)),
    drive.writeJson(folder, 'settings.json', { autopilot: false, briefing: 'daily', members: [] }),
  ]);

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
  // The site's deploy (the slowest step) runs while the co-founder starts, so the greeting is on its way before the
  // console opens. The Drive writes stay one group at a time: production's database refused a burst of both groups
  // ("D1 DB is overloaded", 2026-11-11).
  let storefront = Promise.resolve();
  try {
    const made = await sites.create({ name, slug: slug.slice(0, 54), description: biz.tagline || biz.idea });
    const site = made.site;
    biz.site = { id: site.id, slug: site.slug, url: site.url ?? `https://${site.slug}.commandagi.app`, brandUrl: site.brandUrl ?? null, folder: site.folder };
    // The files and the sign-ups' storage (the site's KV and its read key) together, so the first deploy carries both.
    // The layout and the look this business starts with (lib/storefront-design.js), in the file that changes them.
    const source = newStorefrontSource(biz);
    biz.site.storefront = { template: source.template, style: source.style, mark: sourceMark(source) };
    await Promise.all([...Object.entries(storefrontFiles(biz, [], { storefront: source })).map(([fname, content]) => drive.write(site.folder, fname, content)), drive.writeJson(folder, 'storefront.json', source), ensureSignups(biz)]);
    storefront = sites.deployFolder(site.id, 'production')
      .then(d => { biz.site.lastDeploy = { at: Date.now(), id: d?.deployment?.id ?? d?.id ?? null }; })
      .catch(e => { biz.gaps.push({ at: Date.now(), what: 'deploy', why: e.message }); });
  } catch (e) {
    const why = e.status === 401 && BRAND.stack === 'local' ? 'Site hosting is the cloud\'s: a local platform cannot make the storefront.' : e.message;
    biz.gaps.push({ at: Date.now(), what: 'site', why, code: e.code ?? null });
  }

  onStep('Writing the co-founder\'s memory');
  await Promise.all(Object.entries(memoryFiles(biz, founder)).map(([fname, content]) => drive.write(`${folder}/cofounder`, fname, content)));
  await drive.writeJson(folder, 'business.json', biz);

  onStep(`Waking ${biz.cofounder.name}`);
  // An account made before VibeStartup set the founder's floor gets it now (a floor the founder chose stays).
  const floor = allowCofounderAccounts().catch(() => null);
  try { await startCofounder(biz, founder, me.id); }
  catch (e) {
    // The platform's models for adults need the account's date of birth (POST /me/profile); the wizard asks for it at
    // sign-up, and an account made elsewhere sets it in Profile.
    const why = e.code === 'age_verification_required' || e.code === 'age_restricted' ? 'CommandAGI needs your date of birth before the co-founder can start: set it in Profile, then wake the co-founder from the console.' : e.message;
    biz.gaps.push({ at: Date.now(), what: 'cofounder', why, code: e.code ?? null });
  }
  await Promise.all([storefront, floor]);

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

/**
 * The co-founder of a business made before `storefront.json` learns the file, once: its CODEMAP.md is written again,
 * and its agent's instructions are the charter of today. The record keeps that it was done (`cofounder.storefrontRule`).
 */
export async function teachStorefront(biz) {
  if (biz.cofounder?.storefrontRule) return false;
  const me = await api('/me');
  const founder = await api(`/users/${encodeURIComponent(me.id)}`).catch(() => ({ id: me.id, email: '', name: '' }));
  await drive.write(`${folderOf(biz.slug)}/cofounder`, 'CODEMAP.md', memoryFiles(biz, founder)['CODEMAP.md']);
  if (biz.cofounder?.forkId) await agents.update(biz.cofounder.forkId, { instructions: charterFor(biz, founder) }).catch(() => null);
  biz.cofounder = { ...(biz.cofounder ?? {}), storefrontRule: true };
  return true;
}

/** The thread step again, for a business whose co-founder was never woken (a gap at creation). */
export async function wakeCofounder(biz) {
  const me = await api('/me');
  const founder = await api(`/users/${encodeURIComponent(me.id)}`).catch(() => ({ id: me.id, email: '', name: '' }));
  await startCofounder(biz, founder, me.id);
  biz.gaps = (biz.gaps ?? []).filter(g => g.what !== 'cofounder');
  if (!biz.routines?.briefing) {
    try {
      const r = await threads.triggers.create(biz.cofounder.threadId, { kind: 'cron', everySeconds: 86400, label: 'Daily briefing', prompt: `Write the daily briefing for ${biz.name}: the numbers with their change (from the files and the site's analytics), the highlights, today's plan and what waits on the founder. A few short lines. Write it into cofounder/MEMORY.md as today's entry too.` });
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
