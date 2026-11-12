// A business is a CommandAGI org, `org-<slug>`, founded by the founder through VibeStartup (docs/schema.md): its Drive's
// root is the business, and its co-founder, chats, site, mail, goods and payouts are the org's. This module holds the
// record, the creation sequence, the co-founder's charter, the memory files and the brand generator (a script, labelled
// so). Every path is lib/schema.js's; every call is the founder's own token acting in the org.
import { api, drive, tasks, threads, agents, sites, orgs, payments, goods, integrations, BRAND } from './api.js';
import { slugify } from './ui.js';
import { storefrontFiles, ensureSignups } from './storefront.js';
import { TEMPLATES, STYLES, newStorefrontSource, sourceMark } from './storefront-design.js';
import { orgOf, slugOf, accountOf, homeOf, PATHS, MEMORY_FILES, PLATFORM, charterMap, recordOf, settingsFrom, settingsInto, split, lint, LINT_DAYS, LINT_TASK } from './schema.js';

/** The business's Drive, its tasks, and the account it acts as (`acct:org:<id>`): the one seam every tab uses. */
export const bizDrive = biz => drive.forAccount(biz.org);
export const bizTasksApi = biz => tasks.forAccount(biz.org);
export const bizAccount = biz => accountOf(biz.org);
/** The address of a file of the business (`business.json` by default): what its chats are `about`. */
export const addressOf = (biz, path = PATHS.record) => homeOf(biz.org, path);


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

/** How every Drive and task tool reaches the business: the org's account, named on each call. */
const toolsRule = biz => `Your files are the business's Drive, the org ${biz.org}: paths are from its root (business.json, MEMORY.md, products/products.json …). Every Drive tool call names it: list_drive { account: "${accountOf(biz.org)}", path }, read_drive_file { fileId } (the id list_drive gives), write_drive_file { account: "${accountOf(biz.org)}", path, name, content } (one call writes the whole file; write it once). Every task tool call names it too: task_create, task_list, task_get and task_update with { account: "${accountOf(biz.org)}" }. Without the account a call reaches the founder's own Drive, which is not the business's. If a Drive call fails, say so to the founder in one short line (you cannot open the business's files just now), then go on with what these instructions tell you: never stop without a word, and never call the same failing tool again in the turn.`;

/**
 * How the co-founder changes the storefront's layout, look and words: one file, never the site's HTML (the charter's
 * code map). The console publishes the change when the founder opens it.
 */
export const storefrontRule = biz => `The storefront's layout, look and words are one file: ${PATHS.storefront} at the root of the business's Drive. Never edit the HTML or CSS in the site folder (Sites/): every publish writes them again from this file, ${PATHS.catalogue} and the brand kit. Read the file, change only the fields you mean to, and write the whole file back with write_drive_file (keep it valid JSON):
- "template" is the layout, one of: ${TEMPLATES.map(t => `"${t.id}" (${t.about})`).join(' ')}
- "style" is the look, one of: ${STYLES.map(t => `"${t.id}" (${t.about})`).join(' ')}
- "copy" holds the words: "announcement" (a line above the header), "kicker" (the small label over the headline), "headline", "subhead", "cta" (the main button), "productsTitle", "about": { "title", "text" }, "points": [{ "title", "text" }], "faq": [{ "q", "a" }], "testimonials": [{ "quote", "name" }]. An empty field shows the default (the tagline, the idea); an empty list hides its section. Testimonials are real customers' words only: never write one yourself.
- "sections" turns a section off with false: "how" (How it works), "about", "points", "faq", "testimonials".
Switching "template" or "style" keeps every word, product and picture. The change goes live when the founder opens the console (it publishes the file's changes), or presses Publish in the console's Storefront tab; say so. It is a change to the live site, so it needs an approved task first.`;

/** How the co-founder adds a product: a product file the Drive indexes as a good of the org (the charter, PLAYBOOK.md). */
export const productsRule = biz => `Products are goods on CommandAGI, so the checkout can sell them. Never list a product only in a page or a JSON file. To add one, write its product file with write_drive_file { account: "${accountOf(biz.org)}" } at products/<product>.product.tsx (the Drive indexes it as a good the business sells; a file it refuses is not a good, so read the answer). A product's slug is unique on the whole platform, so give it one that starts with the business: slug="${biz.slug}-<product>". The file is SDK code:
- physical: export default () => (<product name="Desk lamp" slug="${biz.slug}-desk-lamp" kind="physical" status="draft" description="…" shipping={{ zones: [{ rule: "flat", countries: ["US"], amountCents: 500 }] }}><variant sku="${biz.slug.toUpperCase()}-LAMP" name="Standard" priceCents={4900} /></product>);
- digital: export default () => (<product name="Prompt pack" slug="${biz.slug}-prompt-pack" kind="digital" status="draft" description="…"><variant sku="${biz.slug.toUpperCase()}-PACK" name="Download" priceCents={1900} file="./files/prompt-pack.zip" /></product>); the variant's file is the thing sold, a path from the product file's folder (products/files/), and it must exist first.
Keep status="draft": the console makes a good live when the business's payouts are ready. Then add the product to ${PATHS.catalogue} (keep its other entries): { "id": "<product>", "name", "description", "price": 19, "priceLabel": "$19", "type": "physical" or "digital", "status": "active", "file": "products/<product>.product.tsx", "images": [{ "path": "studio/<picture>.png" }], "createdAt": <ms> }. "images" are paths of pictures in the business's Drive (the Studio's, or ones the founder uploaded to products/images/); the storefront shows them, sized for the web, the first on the product's card. The console's Products tab links the entry to its good and publishes the storefront; ask the founder to open Products once. A physical good sells through the checkout once payouts are ready; a digital one too where the checkout sells downloads to guests (the console checks), and by email elsewhere.`;

/** A product file of the catalogue (CommandAGI's product in code), as the Products tab writes it. Strings are JSON. */
export function productFile({ name, slug, kind, status = 'draft', description = '', sku, priceCents, shippingCents = 0, file = null }) {
  const attr = (k, v) => v === undefined || v === null || v === '' ? '' : ` ${k}={${JSON.stringify(v)}}`;
  const shipping = kind === 'physical' ? ` shipping={{ zones: [{ rule: "flat", countries: ["US"], amountCents: ${Math.round(shippingCents)} }] }}` : '';
  return `export default () => (\n  <product${attr('name', name)}${attr('slug', slug)}${attr('kind', kind)}${attr('status', status)}${attr('description', description)}${shipping}>\n    <variant${attr('sku', sku)}${attr('name', kind === 'digital' ? 'Download' : 'Standard')} priceCents={${Math.round(priceCents)}}${attr('file', file)} />\n  </product>\n);\n`;
}
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

/**
 * The co-founder's charter: its agent's instructions, so every chat starts with it and shares the prompt cache. The
 * platform's part and the code map are kept once, in lib/schema.js, never as files of a business.
 */
export function charterFor(biz, founder) {
  const partner = PARTNERS.find(p => p.id === biz.partner) ?? PARTNERS[2];
  const voice = VOICES.find(v => v.id === biz.voice) ?? VOICES[0];
  return `You are ${biz.cofounder.name}, the AI co-founder of ${biz.name}, a business started on ${BRAND.name} (a CommandAGI brand). You say you are an AI agent whenever it matters, to the founder and to anyone you write to.

The founder is ${founder.name || 'the founder'} (${founder.email}). The business: ${biz.idea}
The first version: ${biz.blueprint?.title ?? 'a storefront with one offer'}. ${biz.blueprint?.about ?? ''}
Your character: ${partner.name}. ${partner.about} Traits: ${partner.traits.join(', ')}. The brand's voice is ${voice.name.toLowerCase()}.

The brief, so you need no file to start: the brand's vibe is ${biz.vibe}, its colours ${biz.brand?.primary ?? ''} and ${biz.brand?.accent ?? ''}. The business email is ${biz.email?.address ?? 'not claimed yet'}. The storefront ${biz.site ? `is at ${biz.site.brandUrl ?? biz.site.url}${biz.site.storefront?.template ? `, its layout "${biz.site.storefront.template}" and its look "${biz.site.storefront.style ?? ''}"` : ''}` : 'is not made yet'}. The launch week started ${new Date(biz.launchWeek?.startedAt ?? Date.now()).toISOString().slice(0, 10)}; day 1 is the site and the first offer.

${toolsRule(biz)}

Your memory is the Markdown files at the root: SOUL.md, BUSINESS.md, OWNER.md, PLAYBOOK.md, MEMORY.md, SUPPORT.md. Read a file when the work needs what is in it, not before every answer, and write what you learn into MEMORY.md (a dated line; keep the file under 2 KB, and keep longer memory with memory_remember).

Answer first. When the founder writes, your first action is a short message in chat; then do the work with your tools, and say what you did when it is done. A question to the founder with a chat control is the exception: it is your whole answer, one "done" with the words and the block (CHAT CONTROLS below), and no message comes before it. The storefront is a CommandAGI site${biz.site?.url ? ` at ${biz.site.brandUrl ?? biz.site.url}` : ''}; its folder is ${biz.site?.folder ?? 'Sites/<name>'} in the business's Drive and a deploy publishes it.

THE PLATFORM. ${PLATFORM}

THE CODE MAP. ${charterMap()}
A file you make outside these places is the founder's to keep; the console lists such files once a week. The storefront's pages in Sites/ are written by every publish: edit their sources (storefront.json, products/products.json, legal/terms.html, legal/privacy.html, legal/refunds.html) instead. Sign-ups from the storefront reach contacts/ when the founder opens Customers.

${productsRule(biz)}

${storefrontRule(biz)}

${WIDGETS_RULE}

Rules you keep:
1. The founder decides. Before any spend, any public post, any change to the live site, any contact import and any legal filing, create a task with task_create { account: "${accountOf(biz.org)}", dir: "Tasks", labels: ["biz:${biz.slug}", "needs-approval"], assignees: ["user:${founder.id}"] } that says what you propose and why, and tell the founder in chat. Do that work only after the task is approved (status doing, assigned to you).
   Each task has a taskKey: the launch day and the step, such as "day1.storefront", "day1.offer" or "day2.warm-list". Before you create a task, read your open tasks (task_list { account: "${accountOf(biz.org)}", labels: ["biz:${biz.slug}"] }) and create only one that is not there. A task_create with a key a task has returns that task with existing: true and creates nothing. A founder's question is not a request for a task: answer it.
2. No pretending. Never say a feature works that does not. A test order is a test. Count only measured numbers. If a provider is not connected (payments, ads, a social account, outbound mail), say so and stop there.
3. Money moves only by the founder's act. Never spend past an approved budget.
4. Secrets are never shown again. Never write a key or a password into chat or a file.
5. Contacts are only the ones the founder gives. Record only people the founder shares.
6. ${biz.autopilot ? 'Autopilot is on: do routine work inside the limits above and report what you did.' : 'Autopilot is off: propose, then wait.'}

The launch week is seven days: site and first offer, the warm list, personal notes, launch posts, launch day, follow-ups, debrief. Each day's work is a proposal the founder approves. Every morning's briefing (a routine) reports the numbers with their change, the highlights, today's plan and what waits on the founder, in a few short lines.

Write short, plain sentences. One idea per sentence. Say what you did, what you found, and what you need.

Last, because it is easy to forget: when you ask the founder to choose, to pick a number or to say yes or no, your step is one "done" whose text ends with the \`\`\`cagi-ask block (CHAT CONTROLS), and a choice also lists its labels in that done's "options". Words alone draw nothing to tap.`;
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
HOW YOU SEND IT. A control is text, not an action: it is never one of your step's verbs. When you ask the founder, your step is exactly one action, a "done" whose "text" holds your words and then the block, the block's lines joined by \\n inside that JSON string. Never send the words in one action and the block in another, and never write a "message" before it: words without their block draw nothing, and the founder has nothing to tap. The slider above, as the whole step you emit:
{"type":"done","text":"How much do we spend on ads in the first month?\\n\`\`\`cagi-ask\\n{\\"kind\\":\\"slider\\",\\"prompt\\":\\"Ad budget for the first month, in dollars\\",\\"min\\":0,\\"max\\":500,\\"step\\":25,\\"defaultValue\\":150}\\n\`\`\`"}
A choice also lists its labels in that done's "options" (strings, in the block's order): "options":["$18","$24","$30"]. The block draws the buttons with their descriptions; "options" alone still draws plain buttons, so a choice is never words with nothing to tap. Only a choice uses "options": a slider, a yes or no and a chart are blocks.
Never ask the founder with "ask_user", "confirm" or ask_question: they draw only plain buttons or a text box, never a slider, a yes or no, a chart or an option's description. So a yes or no is a block with "kind":"confirm", a number a slider block, a chart a lens block, and a choice a select block.

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
  return `Hi ${biz.cofounder.name}. I'm ${founder.name || 'the founder'}. We're starting ${biz.name}: ${biz.idea}\n\n${first} Now make the two day-one approval tasks${greeted ? ' your welcome promised' : ''}, both in one step: task_create with { account: "${accountOf(biz.org)}", title, body, taskKey, dir: "Tasks", labels: ["biz:${biz.slug}", "needs-approval"], assignees: ["user:${founder.id}"], status: "todo" }, the first titled "${site.title}" with taskKey "${site.key}" (body: ${site.body}) and the second titled "${offer.title}" with taskKey "${offer.key}" (body: ${offer.body}). Make them once: after this turn they exist, and no later message asks for them again.${look ? ` Also on day 1, check that the storefront's layout ("template": "${look.template}") and look ("style": "${look.style}") fit the idea; if they do not, name the better pair in the storefront card's body, and change storefront.json once that card is approved.` : ''} Your instructions have what you need, so read no file and describe no tool first. Then say in one short line that both cards are ready for me. After this, when you need me to choose, say yes or no, give a number or send a file, ask with a chat control as your instructions show.`;
}

/** The six Markdown files of the co-founder, written into the root of the org's Drive at creation. */
export const memoryFiles = (biz, founder) => {
  const partner = PARTNERS.find(p => p.id === biz.partner) ?? PARTNERS[2];
  return {
    'SOUL.md': `# ${biz.cofounder.name}\n\nI am ${biz.cofounder.name}, the AI co-founder of ${biz.name}. I am an AI agent and I say so.\n\n## Character\n\n${partner.name}: ${partner.about} ${partner.traits.join(', ')}.\n\n## Voice\n\n${(VOICES.find(v => v.id === biz.voice) ?? VOICES[0]).name}. ${(VOICES.find(v => v.id === biz.voice) ?? VOICES[0]).sample}\n\n## How I work\n\n- The founder decides. Spend, public posts, live-site changes, contact imports and legal filings wait for approval.\n- I never pretend. A gap is reported as a gap.\n- I write what I learn into MEMORY.md.\n`,
    'BUSINESS.md': `# ${biz.name}\n\n${biz.idea}\n\n## The first version\n\n${biz.blueprint?.title ?? ''}. ${biz.blueprint?.about ?? ''}\n\n## Brand\n\nVibe: ${biz.vibe}. Voice: ${biz.voice}. Colours: primary ${biz.brand.primary}, secondary ${biz.brand.secondary}, accent ${biz.brand.accent}. Type: ${biz.brand.type}.\n\n## Storefront\n\n${biz.site?.brandUrl ?? biz.site?.url ?? 'not yet live'}\n\n## Email\n\n${biz.email?.address ?? 'not yet claimed'}\n`,
    'OWNER.md': `# The founder\n\n${founder.name || ''} (${founder.email}). Autopilot: ${biz.autopilot ? 'on' : 'off'}. Briefing: ${biz.briefing}.\n\nWhat the founder decides: spend, public posts, live-site changes, contact lists, legal filings.\n`,
    'PLAYBOOK.md': `# Playbook\n\n## Launch week\n\n${LAUNCH_WEEK.map(d => `${d.day}. ${d.title}: ${d.about}`).join('\n')}\n\n## Daily briefing\n\nNumbers with their change, highlights, today's plan, what waits on the founder. A few short lines.\n\n## Approvals\n\nA task in Tasks/ with labels biz:${biz.slug} and needs-approval, assigned to the founder, and a taskKey of its day and step (day1.storefront, day1.offer, day2.warm-list). Read the open tasks first and make only the ones that are not there; a repeated key returns the task it made. Work starts when it is approved.\n\n## Asking in chat\n\nA choice is a select, a yes or no a confirm, a price or a budget a slider, numbers over time a lens chart: a \`\`\`cagi-ask JSON block at the end of the message (the charter has the shapes). A file is request_upload. A control never stands in for an approval task.\n\n## Products\n\n${productsRule(biz)}\n`,
    'MEMORY.md': `# Memory\n\n- ${new Date().toISOString().slice(0, 10)}: the business was created on ${BRAND.name}. Nothing has been learned yet.\n`,
    'SUPPORT.md': `# Support\n\nCustomers write to ${biz.email?.address ?? 'the business address'}. Answer within a day. A refund or a dispute is the founder's decision.\n`,
  };
};

// ---------- the storefront ----------

// The storefront's files and its publish are lib/storefront.js; the creation sequence below and the tabs use them.
export { storefrontFiles, publishStorefront, storefrontUrl } from './storefront.js';

// ---------- reading and writing the record ----------

/**
 * The console's view of a business: its record (business.json) with the org's name, the brand book and the settings
 * (.commandagi/settings.json) beside it. `settingsFile` keeps the file as read, so a write keeps its other keys.
 */
function viewOf(org, record, { name, brand, settings }) {
  return { ...record, slug: slugOf(org), org, name: name ?? record.slug ?? slugOf(org), brand: brand ?? {}, ...settingsFrom(settings), settingsFile: settings ?? {} };
}
export async function readBusiness(slug) {
  const org = orgOf(slug);
  const d = drive.forAccount(org);
  const [record, brand, settings, info] = await Promise.all([
    d.readJsonPath('', PATHS.record),
    d.readJsonPath(...split(PATHS.brandBook)).catch(() => null),
    d.readJsonPath(...split(PATHS.settings)).catch(() => null),
    orgs.get(org).catch(() => null),
  ]);
  if (!record) throw Object.assign(new Error('That business is not in your account.'), { code: 'not_found' });
  return viewOf(org, record, { name: info?.org?.name, brand, settings });
}
/** Write the record, and the settings when they changed (every other key of the settings file is kept). */
export async function writeBusiness(biz) {
  biz.updatedAt = Date.now();
  const d = bizDrive(biz);
  const settings = settingsInto(biz.settingsFile, biz);
  const changed = JSON.stringify(settings) !== JSON.stringify(biz.settingsFile ?? {});
  await Promise.all([
    d.writeJson('', PATHS.record, recordOf(biz)),
    changed ? d.writeJson(...split(PATHS.settings), settings).then(() => { biz.settingsFile = settings; }) : null,
  ]);
  return biz;
}
/** The founder's businesses: the orgs they are a member of that VibeStartup made (`GET /me/orgs?brand=`), newest first. */
export async function listBusinesses() {
  const list = (await orgs.list()).filter(o => slugOf(o.id));
  const out = await Promise.all(list.map(async o => {
    const d = drive.forAccount(o.id);
    const [record, brand] = await Promise.all([d.readJsonPath('', PATHS.record).catch(() => null), d.readJsonPath(...split(PATHS.brandBook)).catch(() => null)]);
    return record ? viewOf(o.id, record, { name: o.name, brand, settings: null }) : null;
  }));
  return out.filter(Boolean).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

/** Read a JSON file of the business by its path from the root, or the fallback. */
export const readBizJson = (biz, path, fallback) => bizDrive(biz).readJsonPath(...split(path)).then(v => v ?? fallback).catch(() => fallback);
export const writeBizJson = (biz, path, value) => bizDrive(biz).writeJson(...split(path), value);

/**
 * The co-founder's agent: a fork of COFOUNDER_MODEL's base instance made in the org (`ownerScope`), named for the
 * co-founder, with the charter as its instructions, the thread's tools and COFOUNDER_EFFORT. Answers its id.
 */
export async function forkCofounder(biz, founder) {
  const charter = charterFor(biz, founder);
  const made = await agents.fork(baseOf(COFOUNDER_MODEL), { name: biz.cofounder.name, instructions: charter, ownerScope: biz.org });
  biz.cofounder.charter = digestOf(charter);
  const id = made?.agent?.id ?? null;
  if (id) await agents.update(id, { modelEffort: COFOUNDER_EFFORT, access: { scopes: ['*'], reach: 'project' } });
  return id;
}
/** A chat of the business: a thread of the org about its business.json, on the co-founder's agent. */
const chatLaunch = biz => ({ ownerScope: biz.org, agentName: biz.cofounder?.name, fromAgentId: biz.cofounder?.agentId, surface: 'vibestartup', about: addressOf(biz), reality: 'simulation' });

/**
 * The co-founder: its agent (once), then the first chat with the welcome as its first line and the opening ask by the
 * same launch's replay (its id is the thread's, so it is said once). After a kept welcome the co-founder does not greet
 * again; a platform that keeps no welcome gets the ask that greets first.
 */
async function startCofounder(biz, founder) {
  // An agent made by an earlier try whose thread was refused (a missing date of birth) is the co-founder still.
  if (!biz.cofounder.agentId) biz.cofounder.agentId = await forkCofounder(biz, founder);
  const welcome = welcomeFor(biz, founder);
  const launch = { ...chatLaunch(biz), title: biz.name, idempotencyKey: `vibestartup:${biz.org}:${biz.createdAt}` };
  const t = await threads.create({ ...launch, greeting: { text: welcome, template: WELCOME_TEMPLATE } });
  const kept = t.greeting === 'delivered' || t.greeting === 'already';
  await threads.create({ ...launch, intent: openingFor(biz, founder, { greeted: kept }) });
  biz.cofounder.threadId = t.threadId;
  // The welcome is a template's words, not a model's: the record says so, and whether the platform kept it.
  biz.cofounder.welcome = { template: WELCOME_TEMPLATE, text: welcome, at: Date.now(), kept: t.greeting ?? null, lineId: kept ? `greeting:${t.threadId}` : null };
  biz.cofounder.model = COFOUNDER_MODEL;
  return biz;
}

/**
 * Another chat with the co-founder: a thread of the org about the same business.json (so `threads.of` lists it beside
 * the first), on the co-founder's agent (its charter, model, effort and tools). No opening ask: the founder's first line
 * starts it, and the platform names the thread after its first exchange.
 */
export async function startChat(biz) {
  const t = await threads.create({ ...chatLaunch(biz), title: 'New thread' });
  return t.threadId;
}

/** The daily briefing: a routine on the business's first chat. */
export const briefingRoutine = biz => ({ kind: 'cron', everySeconds: 86400, label: 'Daily briefing', prompt: `Write the daily briefing for ${biz.name}: the numbers with their change (from the files and the site's analytics), the highlights, today's plan and what waits on the founder. A few short lines. Write it into MEMORY.md as today's entry too.` });

/** A handle the platform takes (3 to 40 of a-z, 0-9 and single dashes), leaving room for a site slug's suffix. */
const handleOf = name => {
  const h = slugify(name).replace(/-+/g, '-').slice(0, 33).replace(/^-+|-+$/g, '');
  return h.length >= 3 ? h : `${h || 'my'}-shop`.replace(/^-/, '');
};

/**
 * The creation sequence, each step one CommandAGI act (`onStep(label)` reports progress): the storefront site and the
 * org with the same slug, the files of the schema, the business email, the storefront's files and deploy, the
 * co-founder (its agent in the org, its first chat), then the daily briefing. A step that fails is a gap on the record.
 */
export async function createBusiness(input, { onStep = () => {} } = {}) {
  const me = await api('/me');
  const founder = await api(`/users/${encodeURIComponent(me.id)}`).catch(() => ({ id: me.id, email: '', name: '' }));
  const name = String(input.name).trim();
  const gaps = [];

  onStep('Making the business');
  // The site first, so its slug decides the org's handle: a slug another site holds gets a suffix, and the org takes the
  // same one. The site then moves into the org, with nothing in it yet.
  let site = null;
  try { site = (await sites.create({ name, slug: handleOf(name), description: String(input.tagline || input.idea).trim() })).site; }
  catch (e) { gaps.push({ at: Date.now(), what: 'site', why: e.status === 401 && BRAND.stack === 'local' ? 'Site hosting is the cloud\'s: a local platform cannot make the storefront.' : e.message, code: e.code ?? null }); }
  let made;
  try { made = await orgs.create({ name, handle: site?.slug ?? handleOf(name) }); }
  catch (e) {
    if (!(e.status === 409 && e.body?.suggestion)) { if (site) await sites.remove(site.id).catch(() => null); throw e; }
    made = await orgs.create({ name, handle: e.body.suggestion });
    if (site) gaps.push({ at: Date.now(), what: 'slug', why: `The storefront's address is ${site.slug}, the business's ${slugOf(made.org)}: another business had that name.` });
  }
  const org = made.org;
  const biz = {
    org, slug: slugOf(org), name, idea: String(input.idea).trim(), tagline: String(input.tagline ?? '').trim(),
    blueprint: input.blueprint ?? null,
    // The storefront's layout and look picked at sign-up (the model's suggestion for the idea, else none): the first
    // storefront.json starts from it (lib/storefront-design.js defaultStorefront).
    storefrontPick: input.storefront?.template || input.storefront?.style ? { template: input.storefront.template ?? null, style: input.storefront.style ?? null } : null, vibe: input.vibe ?? 'clean', voice: input.voice ?? 'casual', partner: input.partner ?? 'creative',
    cofounder: { name: input.cofounder || COFOUNDER_NAMES[0], threadId: null, agentId: null },
    brand: brandFor(name, input.vibe ?? 'clean', input.voice ?? 'casual'),
    site: null, email: null, autopilot: false, briefing: 'daily', settingsFile: {},
    launchWeek: { startedAt: Date.now() }, gaps, createdAt: Date.now(), updatedAt: Date.now(),
  };
  const d = bizDrive(biz);
  if (site) {
    try { site = (await sites.transfer(site.id, org)).site ?? site; }
    catch (e) { gaps.push({ at: Date.now(), what: 'site', why: `The storefront could not move into the business: ${e.message}`, code: e.code ?? null }); await sites.remove(site.id).catch(() => null); site = null; }
  }
  if (site) biz.site = { id: site.id, slug: site.slug, url: site.url ?? `https://${site.slug}.commandagi.app`, brandUrl: site.brandUrl ?? null, folder: site.folder };

  onStep('Writing the business\'s files');
  // The folders, then the files, each group at once: one call at a time took about a minute on production (2026-11-11).
  await Promise.all(['.commandagi', 'brand', 'products', 'orders', 'contacts', 'leads', 'outbound', 'ads', 'social', 'studio', 'legal', 'Tasks'].map(sub => d.mkdir('', sub).catch(() => null)));
  await Promise.all([
    writeBusiness(biz),
    d.writeJson(...split(PATHS.catalogue), { products: [] }),
    d.writeJson(...split(PATHS.social), { posts: [] }),
    d.writeJson(...split(PATHS.brandBook), biz.brand),
    d.write(...split(PATHS.logo), markSvg(name, biz.brand)),
  ]);

  onStep('Claiming the business email');
  try {
    const local = biz.slug.replace(/[^a-z0-9-]/g, '').slice(0, 30);
    // `GET /email-addresses/available` answers { ok, reason }: a taken or reserved local part gets a suffix.
    const free = await api(`/email-addresses/available?local=${encodeURIComponent(local)}`).catch(() => ({ ok: true }));
    const chosen = free?.ok === false ? `${local}-${Math.random().toString(36).slice(2, 6)}` : local;
    const addr = await orgs.claimAddress(org, chosen, `${name} (${BRAND.name})`);
    biz.email = { id: addr.id, address: addr.address ?? `${chosen}@${BRAND.mailDomain}` };
  } catch (e) { gaps.push({ at: Date.now(), what: 'email', why: e.message }); }

  onStep('Creating the storefront');
  // The site's deploy (the slowest step) runs while the co-founder starts, so the greeting is on its way before the
  // console opens.
  let storefront = Promise.resolve();
  if (biz.site) {
    try {
      // The layout and the look this business starts with (lib/storefront-design.js), in the file that changes them.
      const source = newStorefrontSource(biz);
      biz.site.storefront = { template: source.template, style: source.style, mark: sourceMark(source) };
      await Promise.all([...Object.entries(storefrontFiles(biz, [], { storefront: source })).map(([fname, content]) => d.write(biz.site.folder, fname, content)), d.writeJson('', PATHS.storefront, source), ensureSignups(biz)]);
      storefront = sites.deployFolder(biz.site.id, 'production')
        .then(r => { biz.site.lastDeploy = { at: Date.now(), id: r?.deployment?.id ?? r?.id ?? null }; })
        .catch(e => { gaps.push({ at: Date.now(), what: 'deploy', why: e.message }); });
    } catch (e) { gaps.push({ at: Date.now(), what: 'deploy', why: e.message, code: e.code ?? null }); }
  }

  onStep('Writing the co-founder\'s memory');
  await Promise.all([...Object.entries(memoryFiles(biz, founder)).map(([fname, content]) => d.write('', fname, content)), writeBusiness(biz)]);

  onStep(`Waking ${biz.cofounder.name}`);
  // An account made before VibeStartup set the founder's floor gets it now (a floor the founder chose stays).
  const floor = allowCofounderAccounts().catch(() => null);
  try { await startCofounder(biz, founder); }
  catch (e) {
    // The platform's models for adults need the account's date of birth (POST /me/profile); the wizard asks for it at
    // sign-up, and an account made elsewhere sets it in Profile.
    const why = e.code === 'age_verification_required' || e.code === 'age_restricted' ? 'CommandAGI needs your date of birth before the co-founder can start: set it in Profile, then wake the co-founder from the console.' : e.message;
    gaps.push({ at: Date.now(), what: 'cofounder', why, code: e.code ?? null });
  }
  await Promise.all([storefront, floor]);

  if (biz.cofounder.threadId) {
    onStep('Scheduling the daily briefing');
    try { const r = await threads.triggers.create(biz.cofounder.threadId, briefingRoutine(biz)); biz.routines = { briefing: r.id ?? r.trigger?.id ?? null }; }
    catch (e) { gaps.push({ at: Date.now(), what: 'briefing', why: e.message }); }
  }
  await writeBusiness(biz);
  return biz;
}

/** The co-founder step again, for a business whose co-founder was never woken (a gap at creation). */
export async function wakeCofounder(biz) {
  const me = await api('/me');
  const founder = await api(`/users/${encodeURIComponent(me.id)}`).catch(() => ({ id: me.id, email: '', name: '' }));
  await startCofounder(biz, founder);
  biz.gaps = (biz.gaps ?? []).filter(g => g.what !== 'cofounder');
  if (!biz.routines?.briefing) {
    try { const r = await threads.triggers.create(biz.cofounder.threadId, briefingRoutine(biz)); biz.routines = { ...(biz.routines ?? {}), briefing: r.id ?? r.trigger?.id ?? null }; }
    catch { /* the routine can be made later from Tasks */ }
  }
  return writeBusiness(biz);
}

/** Everything that waits on the founder: the approval tasks in the org's Tasks/. */
export async function approvals(biz) {
  const all = await bizTasksApi(biz).list({ labels: [`biz:${biz.slug}`], includeClosed: true }).catch(() => []);
  return all.filter(t => (t.labels ?? t.doc?.labels ?? []).includes('needs-approval'));
}

/**
 * Payouts: the business's own Stripe Express account. `startPayouts` makes it, if the business has none, and answers
 * Stripe's form, which only the founder fills in (identity, bank, tax). The record keeps that it was started.
 */
export async function startPayouts(biz, returnPath = `/app/?b=${encodeURIComponent(biz.slug)}#tab=settings`) {
  const r = await payments.onboard(bizAccount(biz), returnPath);
  if (!biz.payouts?.startedAt) { biz.payouts = { account: r?.account ?? bizAccount(biz), startedAt: Date.now() }; await writeBusiness(biz).catch(() => null); }
  return r;
}

/** A short digest of a text (FNV-1a, 32 bits): enough to tell that a charter changed. */
const digestOf = text => { let h = 0x811c9dc5; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };

/**
 * The co-founder's instructions are the charter of today: when the console's charter changed (a rule added, the chat
 * controls taught again), the agent's `systemPrompt` is written once, and every chat, made before or after, reads it at
 * its next turn (CommandAGI reads an agent's instructions at each turn). The record keeps the digest it wrote.
 */
export async function refreshCharter(biz, founder) {
  const id = biz.cofounder?.agentId;
  if (!id || !founder?.email) return false;
  const charter = charterFor(biz, founder);
  const digest = digestOf(charter);
  if (biz.cofounder.charter === digest) return false;
  await agents.update(id, { systemPrompt: charter });
  biz.cofounder.charter = digest;
  await writeBusiness(biz);
  return true;
}

/**
 * The lint (docs/schema.md § a file not in the schema): once a week, the files of the Drive outside the schema, listed
 * in one task for the founder. It never refuses or moves a file: those are the founder's own.
 */
export async function lintBusiness(biz) {
  if (biz.lint?.at && Date.now() - biz.lint.at < LINT_DAYS * 86400e3) return null;
  const files = await bizDrive(biz).files('').catch(() => null);
  if (!files) return null;
  const strays = lint(files.map(f => f.path));
  biz.lint = { at: Date.now(), strays: strays.length };
  const t = bizTasksApi(biz);
  if (strays.length) {
    const body = `These files are outside the business's folders, so the console's tabs do not show them. Nothing is wrong: they are yours. Move each one into the folder it belongs to, or keep it.\n\n${strays.slice(0, 50).map(p => `- ${p}`).join('\n')}${strays.length > 50 ? `\n- and ${strays.length - 50} more` : ''}`;
    await t.create({ dir: PATHS.tasks, doc: { title: LINT_TASK.title, taskKey: LINT_TASK.key, status: 'todo', labels: [`biz:${biz.slug}`, 'schema'], assignees: [] }, body }).catch(() => null);
  }
  await writeBusiness(biz).catch(() => null);
  return strays;
}

/** Remove a business: its routines and its site, then the org (its Drive goes with it). The chats stay as records. */
export async function deleteBusiness(biz) {
  if (biz.cofounder?.threadId) for (const t of await threads.triggers.list(biz.cofounder.threadId).catch(() => [])) await threads.triggers.remove(biz.cofounder.threadId, t.id).catch(() => null);
  if (biz.site?.id) await sites.remove(biz.site.id).catch(() => null);
  await orgs.remove(biz.org);
}
