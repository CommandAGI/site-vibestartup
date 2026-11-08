// Customers: everyone who signed up (the business's own file) and everyone who bought through the checkout.
import { esc, when } from '/lib/ui.js';
import { head, customersOf, ordersOf, empty, askLink } from './_shared.js';

export async function render(ctx) {
  const { biz, el } = ctx;
  const [listed, orders] = await Promise.all([customersOf(biz), ordersOf(biz)]);
  const byEmail = new Map(listed.map(c => [c.email, { ...c }]));
  for (const o of orders.filter(o => o.checkout && o.email)) {
    const c = byEmail.get(o.email) ?? { email: o.email, name: '', since: o.at, orders: 0, test: o.test };
    c.orders = (c.orders ?? 0) + 1;
    c.since = Math.min(c.since ?? o.at, o.at ?? c.since);
    byEmail.set(o.email, c);
  }
  const customers = [...byEmail.values()].sort((a, b) => (b.since ?? 0) - (a.since ?? 0));
  el.innerHTML = head('Customers', 'Everyone who bought or signed up.')
    + (customers.length ? `<table class="table" id="customers"><thead><tr><th>Email</th><th>Name</th><th>Since</th><th class="num">Orders</th><th></th></tr></thead><tbody>${customers.map(c => `<tr><td>${esc(c.email)}</td><td>${esc(c.name ?? '')}</td><td>${esc(when(c.since))}</td><td class="num">${esc(String(c.orders ?? 0))}</td><td>${c.test ? '<span class="badge warn">Test</span>' : ''}</td></tr>`).join('')}</tbody></table>` : `<div id="customers">${empty('No customers yet', `Your first customers come from the launch week: ${askLink('How do I get my first customers?', 'ask your co-founder how to get your first customers')}.`)}</div>`);
}
