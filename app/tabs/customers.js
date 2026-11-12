// Customers: the business's contacts (`contacts/*.vcf`, one vCard each), everyone who asked for updates on the
// storefront (its "Get updates" form, kept by the site's server module and copied into contacts/ here, with the consent
// they gave), and everyone who bought through the checkout.
import { esc, when } from '/lib/ui.js';
import { readSignups } from '/lib/storefront.js';
import { head, customersOf, writeContact, ordersOf, empty, askLink } from './_shared.js';

export async function render(ctx) {
  const { biz, el } = ctx;
  const [listed, orders, fromSite] = await Promise.all([customersOf(biz), ordersOf(biz), readSignups(biz).catch(e => ({ signups: [], why: e.message }))]);
  // A storefront sign-up becomes a contact once, with its consent; the contacts are what the co-founder reads.
  const known = new Set(listed.map(c => String(c.email ?? '').toLowerCase()));
  const added = fromSite.signups.filter(s => s?.email && !known.has(s.email)).map(s => ({ email: s.email, name: s.name ?? '', since: s.at, source: 'storefront', updates: true, consent: s.consent ?? null, country: s.country ?? null }));
  if (added.length) {
    listed.push(...added);
    await Promise.all(added.map(c => writeContact(biz, c).catch(() => null)));
  }
  const byEmail = new Map(listed.map(c => [String(c.email ?? '').toLowerCase(), { ...c }]));
  for (const o of orders.filter(o => o.checkout && o.email)) {
    const key = o.email.toLowerCase();
    const c = byEmail.get(key) ?? { email: o.email, name: '', since: o.at, orders: 0, test: o.test, source: 'checkout' };
    c.orders = (c.orders ?? 0) + 1;
    c.since = Math.min(c.since ?? o.at, o.at ?? c.since);
    byEmail.set(key, c);
  }
  const customers = [...byEmail.values()].sort((a, b) => (b.since ?? 0) - (a.since ?? 0));
  const from = c => c.source === 'storefront' ? `<span class="badge ok" title="${esc(c.consent ? `Agreed ${when(c.consent.at)}: “${c.consent.text}”` : 'Asked for updates')}">updates</span>` : c.source === 'checkout' || c.orders ? '<span class="badge">bought</span>' : esc(c.source ?? '');
  const note = fromSite.why && biz.site?.id ? `<p class="hint" id="signups-state">Storefront sign-ups: ${esc(fromSite.why)}</p>` : '';
  el.innerHTML = head('Customers', 'Everyone who bought, signed up or asked for updates.')
    + (customers.length ? `<table class="table" id="customers"><thead><tr><th>Email</th><th>Name</th><th>From</th><th>Since</th><th class="num">Orders</th><th></th></tr></thead><tbody>${customers.map(c => `<tr><td>${esc(c.email)}</td><td>${esc(c.name ?? '')}</td><td>${from(c)}</td><td>${esc(when(c.since))}</td><td class="num">${esc(String(c.orders ?? 0))}</td><td>${c.test ? '<span class="badge warn">Test</span>' : ''}</td></tr>`).join('')}</tbody></table>` : `<div id="customers">${empty('No customers yet', `Visitors who ask for updates on your storefront appear here, with their consent. Your first customers come from the launch week: ${askLink('How do I get my first customers?', 'ask your co-founder how to get your first customers')}.`)}</div>`)
    + note;
}
