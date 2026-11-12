// The schema of a business (lib/schema.js) and its contacts (lib/contacts.js), in plain node: the lint reports the
// founder's own files and nothing of the schema, the lens hides the platform's folders, the record keeps ids and state
// only, the settings keep every other key, and a contact survives its vCard.
//   node test/schema.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { orgOf, slugOf, accountOf, homeOf, workbenchHref, PATHS, FILES, TABS, HIDDEN, inSchema, shown, lint, recordOf, settingsFrom, settingsInto, charterMap, MEMORY_FILES } from '../lib/schema.js';
import { vcardOf, contactOf, contactFile } from '../lib/contacts.js';

test('a business is the org org-<slug>, and its addresses follow', () => {
  assert.equal(orgOf('digitalproduct'), 'org-digitalproduct');
  assert.equal(slugOf('org-digitalproduct'), 'digitalproduct');
  assert.equal(slugOf('org:5b59b48d'), null, 'an org made without a handle is not a business of the brand');
  assert.equal(accountOf('org-digitalproduct'), 'acct:org:org-digitalproduct');
  assert.equal(homeOf('org-digitalproduct', 'business.json'), 'cloud://home/org-digitalproduct/business.json');
  assert.equal(workbenchHref('org-digitalproduct'), 'https://commandagi.com/file?path=cloud%3A%2F%2Fhome%2Forg-digitalproduct%2F');
});

test('every path the console names is a file of the schema, and every tab reads only those', () => {
  for (const [name, path] of Object.entries(PATHS)) if (!['products', 'contacts', 'outbound', 'studio', 'studioJobs', 'legal', 'tasks', 'sites', 'agents', 'runs', 'trash', 'productImages', 'productFiles'].includes(name)) assert.ok(inSchema(path), `${name}: ${path}`);
  for (const f of MEMORY_FILES) assert.ok(inSchema(f), f);
  for (const [tab, { reads, writes }] of Object.entries(TABS)) for (const p of [...reads, ...writes]) assert.ok(p === '*' || FILES.some(f => f.path === p) || inSchema(p.replace('*', 'x')), `${tab}: ${p}`);
});

test('the lens never shows the platform\'s folders, and the lint lists only the founder\'s own files', () => {
  for (const h of ['.commandagi/', 'agents/', 'runs/', 'Sites/', 'Trash/']) assert.ok(HIDDEN.includes(h), h);
  assert.equal(shown('.commandagi/settings.json'), false);
  assert.equal(shown('agents/Sol/agent.tsx'), false);
  assert.equal(shown('runs/thread-1/run.json'), false);
  assert.equal(shown('Sites/Shop/index.html'), false);
  assert.equal(shown('MEMORY.md'), true);
  const listing = [
    'BUSINESS.md', 'SOUL.md', 'OWNER.md', 'PLAYBOOK.md', 'MEMORY.md', 'SUPPORT.md', 'business.json', 'storefront.json',
    '.commandagi/settings.json', 'agents/Sol/agent.tsx', 'runs/t1/run.json', 'Sites/Shop/index.html', 'brand/brand-book.json', 'brand/logo.svg',
    'products/products.json', 'products/shop-lamp.product.tsx', 'products/images/lamp.png', 'products/files/pack.zip',
    'contacts/ada@example.com.vcf', 'leads/leads.csv', 'outbound/launch/sequence.md', 'ads/campaign.json', 'social/posts.json',
    'studio/a.png', 'studio/jobs/clip-1.json', 'legal/terms.html', 'legal/Shop LLC.company.tsx', 'orders/orders.jsonl',
    'Tasks/Pick a price.task.tsx', 'Tasks/Pick a price.md', 'Trash/old.md',
    // the founder's own
    'notes.txt', 'products/ideas.md', 'contacts/list.csv', 'cofounder/MEMORY.md',
  ];
  assert.deepEqual(lint(listing), ['cofounder/MEMORY.md', 'contacts/list.csv', 'notes.txt', 'products/ideas.md']);
  assert.deepEqual(lint(['studio/', 'Tasks/']), [], 'a folder is not a stray');
});

test('the record keeps ids and state; the name, the brand and the settings live elsewhere', () => {
  const biz = { org: 'org-shop', slug: 'shop', name: 'Shop', brand: { primary: '#000' }, autopilot: true, briefing: 'weekly', settingsFile: {}, idea: 'Lamps', cofounder: { name: 'Sol', agentId: 'a1', threadId: 't1' }, site: { id: 's1' }, gaps: [] };
  const r = recordOf(biz);
  assert.deepEqual(Object.keys(r).sort(), ['cofounder', 'gaps', 'idea', 'site', 'slug']);
  const file = settingsInto({ 'editor.fontSize': 14 }, biz);
  assert.equal(file['editor.fontSize'], 14, 'another key of the settings file is kept');
  assert.equal(file['vibestartup.autopilot'], true);
  assert.deepEqual(settingsFrom(file), { autopilot: true, briefing: 'weekly', notify: {}, creativeBudget: 0 });
  assert.deepEqual(settingsFrom(null), { autopilot: false, briefing: 'daily', notify: {}, creativeBudget: 0 });
});

test('the code map names the business\'s folders and none of the platform\'s own but Sites/', () => {
  const map = charterMap();
  for (const p of ['business.json', 'products/*.product.tsx', 'contacts/*.vcf', 'Tasks/', 'Sites/']) assert.ok(map.includes(p), p);
  for (const p of ['agents/', 'runs/', '.commandagi/']) assert.ok(!map.includes(`- ${p}`), p);
});

test('a contact and its consent survive the vCard; a name with a comma or a line break too', () => {
  const c = { email: 'Ada.Lovelace@example.com', name: 'Lovelace, Ada', source: 'storefront', since: 1794419962726, consent: { text: 'Email me news and offers from Shop. I can stop them at any time.', at: 1794419962726, page: 'https://shop.vibestartup.pro/' }, country: 'GB' };
  const text = vcardOf(c);
  assert.match(text, /^BEGIN:VCARD\r\nVERSION:3\.0\r\n/);
  assert.match(text, /CATEGORIES:signup/);
  const back = contactOf(text);
  assert.equal(back.email, c.email);
  assert.equal(back.name, c.name);
  assert.equal(back.source, 'storefront');
  assert.deepEqual(back.consent, c.consent);
  assert.equal(back.updates, true);
  assert.equal(contactFile(c.email), 'ada.lovelace@example.com.vcf');
  const buyer = contactOf(vcardOf({ email: 'b@example.com', source: 'checkout', since: 1 }));
  assert.equal(buyer.source, 'checkout'); assert.equal(buyer.name, ''); assert.equal(buyer.updates, false);
  assert.equal(contactOf('BEGIN:VCARD\r\nFN:x\r\nEND:VCARD'), null, 'no address, no contact');
});
