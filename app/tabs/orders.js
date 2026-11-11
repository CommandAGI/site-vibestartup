// Orders: every order, newest first. A test order says Test and is never a sale.
import { esc, money, when } from '/lib/ui.js';
import { head, ordersOf, realSales, empty } from './_shared.js';

export async function render(ctx) {
  const { biz, el } = ctx;
  const orders = (await ordersOf(biz)).sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  const s = realSales(orders);
  el.innerHTML = head('Orders', `${s.count} real ${s.count === 1 ? 'order' : 'orders'}${s.test ? ` and ${s.test} test ${s.test === 1 ? 'order' : 'orders'}` : ''}. Only real, completed orders count as sales.`)
    + (orders.length ? `<table class="table" id="orders"><thead><tr><th>Order</th><th>Product</th><th>Buyer</th><th>When</th><th class="num">Amount</th><th>State</th></tr></thead><tbody>${orders.map(o => `<tr class="${o.test ? 'test' : ''}"><td class="mono">${esc(o.id)}</td><td>${esc(o.name)}</td><td>${esc(o.email ?? '')}</td><td>${esc(when(o.at))}</td><td class="num">${esc(money(o.amount, o.currency))}</td><td>${o.test ? '<span class="badge warn">Test</span>' : `<span class="badge ok">${esc(o.status ?? 'paid')}</span>`} ${o.delivered ? 'delivered' : o.test ? '' : 'to deliver'}</td></tr>`).join('')}</tbody></table>` : `<div id="orders">${empty('No orders yet', 'When someone buys, the order shows here with what they got, or what is left to deliver.', `<a class="btn quiet" href="${esc(ctx.tabHref('products'))}">See your products</a>`)}</div>`);
}
