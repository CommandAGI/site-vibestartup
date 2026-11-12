// The schema of a business (docs/schema.md): a business is a CommandAGI org, `org-<slug>`, whose Drive's root is the
// business. This module is the one map from the console's tabs to the org's paths: the lens (app/tabs/*), the
// co-founder's charter (lib/business.js) and the lint below all read it. It holds no state and calls nothing, so a
// plain node run tests it (test/schema.mjs).

/** The org of a business: its id is `org-<slug>` (CommandAGI `POST /accounts { name, handle }`). */
export const orgOf = slug => `org-${slug}`;
/** The business's slug from its org's id, or null for an org that is not a business's (no handle). */
export const slugOf = orgId => /^org-[a-z0-9][a-z0-9-]*$/.test(String(orgId ?? '')) ? String(orgId).slice(4) : null;
/** The org as an account (`x-cagi-account`, the agent tools' `account`). */
export const accountOf = orgId => `acct:org:${orgId}`;
/** The org's Drive as an address; `path` is relative to its root. */
export const homeOf = (orgId, path = '') => `cloud://home/${orgId}/${path}`;
/** The workbench's page for a file or a folder of the org (CommandAGI's `/file?path=<address>`). */
export const workbenchHref = (orgId, path = '', origin = 'https://commandagi.com') => `${origin}/file?path=${encodeURIComponent(homeOf(orgId, path))}`;

/** Every path of the schema, by name, relative to the org's root. */
export const PATHS = {
  business: 'BUSINESS.md',
  soul: 'SOUL.md',
  owner: 'OWNER.md',
  playbook: 'PLAYBOOK.md',
  memory: 'MEMORY.md',
  support: 'SUPPORT.md',
  record: 'business.json',
  storefront: 'storefront.json',
  settings: '.commandagi/settings.json',
  brandBook: 'brand/brand-book.json',
  logo: 'brand/logo.svg',
  products: 'products',
  catalogue: 'products/products.json',
  productImages: 'products/images',
  productFiles: 'products/files',
  contacts: 'contacts',
  leads: 'leads/leads.csv',
  leadStatus: 'leads/status.json',
  outbound: 'outbound',
  ads: 'ads/campaign.json',
  social: 'social/posts.json',
  studio: 'studio',
  studioJobs: 'studio/jobs',
  legal: 'legal',
  legalFields: 'legal/fields.json',
  orders: 'orders/orders.jsonl',
  tasks: 'Tasks',
  sites: 'Sites',
  agents: 'agents',
  runs: 'runs',
  trash: 'Trash',
};

/** The folder of a path, and its file name: `products/images/a.png` → ['products/images', 'a.png']. */
export const split = path => { const at = String(path).lastIndexOf('/'); return at < 0 ? ['', path] : [path.slice(0, at), path.slice(at + 1)]; };

/** The six Markdown files of the co-founder, at the root, in capitals. */
export const MEMORY_FILES = ['SOUL.md', 'BUSINESS.md', 'OWNER.md', 'PLAYBOOK.md', 'MEMORY.md', 'SUPPORT.md'];

/**
 * Each file of the schema: its path (a folder ends in `/` and holds what its pattern says), who writes it and what it
 * is. "founder" writes through the console, "co-founder" with its tools, "console" by the app's code, "platform" by
 * CommandAGI's routes.
 */
export const FILES = [
  { path: 'BUSINESS.md', writers: ['founder', 'co-founder'], about: 'the overview and the goals' },
  { path: 'SOUL.md', writers: ['console', 'founder'], about: 'the co-founder\'s personality and voice' },
  { path: 'OWNER.md', writers: ['co-founder', 'founder'], about: 'the founder\'s profile and preferences' },
  { path: 'PLAYBOOK.md', writers: ['console', 'co-founder'], about: 'how this business works: launch week, approvals, routines' },
  { path: 'MEMORY.md', writers: ['co-founder'], about: 'the short page the co-founder reads at the start of work: dated lines, under 2 KB' },
  { path: 'SUPPORT.md', writers: ['console', 'founder', 'co-founder'], about: 'how customers are answered' },
  { path: 'business.json', writers: ['console'], about: 'the console\'s record: ids and state' },
  { path: 'storefront.json', writers: ['console', 'co-founder'], about: 'the storefront\'s layout, look and words' },
  { path: '.commandagi/', writers: ['console', 'platform'], about: 'the business\'s settings (settings.json, CommandAGI\'s one settings model)', hidden: true },
  { path: 'agents/', writers: ['platform'], about: 'the co-founder agent (agents/<name>/agent.tsx)', hidden: true },
  { path: 'runs/', writers: ['platform'], about: 'the chats\' runs', hidden: true },
  { path: 'Sites/', writers: ['console', 'platform'], about: 'the storefront\'s site folder: written by every publish, never edited', hidden: true },
  { path: 'Trash/', writers: ['platform'], about: 'what was removed', hidden: true },
  { path: 'brand/brand-book.json', writers: ['console'], about: 'colours, type and voice (made by a script, labelled so)' },
  { path: 'brand/', writers: ['console', 'founder'], about: 'the mark and the brand\'s pictures' },
  { path: 'products/files/', writers: ['founder', 'co-founder'], about: 'the files the digital products sell' },
  { path: 'products/images/', writers: ['founder', 'co-founder'], about: 'pictures of the products' },
  { path: 'products/products.json', writers: ['console', 'co-founder'], about: 'the storefront\'s catalogue: every product, its words, price label, pictures and, for a good, its product file' },
  { path: 'products/*.product.tsx', writers: ['co-founder', 'console'], about: 'one good each (CommandAGI\'s product in code): what the checkout sells' },
  { path: 'contacts/*.vcf', writers: ['console', 'co-founder'], about: 'one customer or sign-up each (vCard 3.0, the consent in NOTE)' },
  { path: 'leads/', writers: ['founder', 'console'], about: 'the founder\'s uploaded leads (leads.csv) and their status' },
  { path: 'outbound/', writers: ['co-founder', 'console'], about: 'a campaign\'s drafts (outbound/<campaign>/sequence.md)' },
  { path: 'ads/campaign.json', writers: ['console', 'co-founder'], about: 'the one ad campaign\'s plan, readiness and decisions' },
  { path: 'social/posts.json', writers: ['console', 'co-founder'], about: 'composed posts, scheduled or posted by hand' },
  { path: 'studio/', writers: ['platform', 'console', 'founder'], about: 'everything the Studio made (studio/jobs/<id>.json for a video render)' },
  { path: 'legal/', writers: ['console', 'founder', 'co-founder'], about: 'terms.html, privacy.html, refunds.html (the storefront\'s own pages), saved PDFs, fields.json, an optional <Name>.company.tsx' },
  { path: 'orders/orders.jsonl', writers: ['console', 'co-founder'], about: 'orders recorded outside the checkout, one a line' },
  { path: 'Tasks/', writers: ['co-founder', 'console', 'founder'], about: 'approvals and work (<title>.task.tsx and its .md), a taskKey per day and step' },
];

/** The folders the console never shows the founder. */
export const HIDDEN = FILES.filter(f => f.hidden).map(f => f.path);

/** Whether `path` (relative to the root) is a file of the schema. */
export function inSchema(path) {
  const p = String(path).replace(/^\/+/, '');
  return FILES.some(f => {
    if (f.path.endsWith('/')) return p.startsWith(f.path);
    if (f.path.includes('*')) { const [dir, tail] = split(f.path); const [pd, pn] = split(p); return pd === dir && pn.endsWith(tail.replace('*', '')); }
    return p === f.path;
  });
}
/** Whether the founder sees `path` in the lens (Files lists only these). */
export const shown = path => !HIDDEN.some(h => String(path).replace(/^\/+/, '').startsWith(h));

/**
 * The lens: each tab's paths, read and written. The console's tabs read and write only these (app/tabs/*), the
 * charter names them, and docs/schema.md § the lens is this table in words.
 */
export const TABS = {
  chat: { reads: ['business.json', 'MEMORY.md'], writes: [] },
  dashboard: { reads: ['business.json', 'products/products.json', 'orders/orders.jsonl', 'Tasks/', 'studio/'], writes: ['.commandagi/settings.json'] },
  analytics: { reads: [], writes: [] },
  tasks: { reads: ['Tasks/'], writes: ['Tasks/'] },
  email: { reads: ['business.json'], writes: ['business.json'] },
  files: { reads: ['*'], writes: ['*'] },
  products: { reads: ['products/products.json', 'products/images/', 'studio/', 'brand/'], writes: ['products/products.json', 'products/*.product.tsx', 'products/images/', 'products/files/'] },
  storefront: { reads: ['storefront.json', 'brand/', 'products/products.json', 'legal/'], writes: ['storefront.json', 'Sites/'] },
  orders: { reads: ['orders/orders.jsonl', 'products/products.json'], writes: [] },
  customers: { reads: ['contacts/*.vcf'], writes: ['contacts/*.vcf'] },
  ads: { reads: ['ads/campaign.json', 'studio/'], writes: ['ads/campaign.json'] },
  studio: { reads: ['brand/brand-book.json', 'brand/', 'studio/', 'products/images/'], writes: ['studio/'] },
  outbound: { reads: ['leads/', 'outbound/'], writes: ['leads/'] },
  social: { reads: ['social/posts.json', '.commandagi/settings.json'], writes: ['social/posts.json'] },
  legal: { reads: ['legal/', 'brand/logo.svg', 'business.json'], writes: ['legal/'] },
  settings: { reads: ['.commandagi/settings.json', 'business.json'], writes: ['.commandagi/settings.json', 'business.json'] },
  activity: { reads: [], writes: [] },
};

/** The business's settings: keys of the org's `.commandagi/settings.json` (CommandAGI's one settings model). */
export const SETTINGS = { autopilot: 'vibestartup.autopilot', briefing: 'vibestartup.briefing', notify: 'vibestartup.notify', creativeBudget: 'vibestartup.creativeBudget' };
export const settingsFrom = file => ({
  autopilot: file?.[SETTINGS.autopilot] === true,
  briefing: file?.[SETTINGS.briefing] ?? 'daily',
  notify: file?.[SETTINGS.notify] ?? {},
  creativeBudget: file?.[SETTINGS.creativeBudget] ?? 0,
});
/** The file with these settings' keys set, and every other key kept. */
export const settingsInto = (file, s) => ({ ...(file ?? {}), [SETTINGS.autopilot]: !!s.autopilot, [SETTINGS.briefing]: s.briefing ?? 'daily', [SETTINGS.notify]: s.notify ?? {}, [SETTINGS.creativeBudget]: Number(s.creativeBudget) || 0 });

/**
 * business.json holds what no other file or platform record says: ids and state. The name is the org's, the brand is
 * brand/brand-book.json, the settings are .commandagi/settings.json; the site's addresses come back from the site.
 */
export const RECORD_KEYS = ['slug', 'idea', 'tagline', 'blueprint', 'storefrontPick', 'vibe', 'voice', 'partner', 'cofounder', 'site', 'email', 'payouts', 'routines', 'launchWeek', 'lint', 'gaps', 'createdAt', 'updatedAt'];
export const recordOf = biz => Object.fromEntries(RECORD_KEYS.filter(k => biz[k] !== undefined).map(k => [k, biz[k]]));

/** What CommandAGI gives every business, the same for each: a section of the charter, never a file in a Drive. */
export const PLATFORM = `The business runs on CommandAGI under the VibeStartup brand. It is an org of CommandAGI: its Drive, its mail address, its storefront site, its goods and its payouts are the org's. Your tools reach the org's Drive (list_drive, read_drive_file, write_drive_file, each with the account below), its tasks (task_create, task_list, task_get, task_update with the account), its triggers (routines) and its site (the storefront deploys from its folder). Payments go through CommandAGI's checkout into the business's own Stripe account once the founder finishes Stripe's form. Ads, social posting and outbound mail need the founder's own provider accounts; until one is connected you stop at the call and say so.`;

/** The code map: where each thing of the business is, from FILES. A section of the charter. */
export function charterMap() {
  return ['Where each thing is (paths from the root of the business\'s Drive):', ...FILES.filter(f => !f.hidden || f.path === 'Sites/').map(f => `- ${f.path}: ${f.about}.`)].join('\n');
}

/**
 * The files of a listing that are not in the schema: the founder's own, never refused, reported once a week in one
 * task (lib/business.js `lintBusiness`). `listing` is paths relative to the root; folders end in `/`.
 */
export function lint(listing) {
  return [...new Set(listing.map(p => String(p).replace(/^\/+/, '')))]
    .filter(p => p && !p.endsWith('/') && shown(p) && !inSchema(p))
    .sort();
}
export const LINT_DAYS = 7;
export const LINT_TASK = { key: 'schema.strays', title: 'Files outside the business\'s folders' };
