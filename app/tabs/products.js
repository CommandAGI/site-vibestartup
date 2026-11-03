// Products: the catalogue, published into the storefront on every change; a test buy through the test checkout.
import { publishStorefront } from '/lib/business.js';
import { $, $$, esc, icon, toast, modal, confirm, money, ago, oops, busy, copy } from '/lib/ui.js';
import { head, section, productsOf, writeProducts, ordersOf, appendOrder, customersOf, writeCustomers, iconBtn, empty, swatch } from './_shared.js';

export const TEST_CARD = '4242 4242 4242 4242';
const TYPES = ['digital', 'service', 'subscription', 'physical', 'hardware', 'course', 'other'];

export async function render(ctx) {
  const { biz, el, actions } = ctx;
  actions.innerHTML = `<button type="button" class="btn sm primary" id="add-product">${icon('plus', 14)} Add product</button>`;
  const paint = async () => {
    const [products, orders] = await Promise.all([productsOf(biz), ordersOf(biz)]);
    const subs = products.filter(p => p.recurring && p.status === 'active');
    const subOrders = orders.filter(o => products.find(p => p.id === o.productId)?.recurring);
    el.innerHTML = head('Products', 'What your storefront sells. Every change publishes the storefront again.')
      + (products.length ? `<div id="product-list" class="list">${products.map(p => `<div class="product" data-id="${esc(p.id)}">${swatch(biz.brand)}<div><b>${esc(p.name)}</b> <span class="badge ${p.status === 'active' ? 'ok' : ''}">${esc(p.status)}</span><div class="meta">${esc(p.priceLabel)}${p.recurring ? ` / ${esc(p.interval)}` : ''} · ${esc(p.type)} · ${esc(p.description ?? '')}</div></div><div class="acts"><button type="button" class="btn sm quiet" data-test-buy>Test buy</button>${p.status === 'active' ? iconBtn('pause', 'Archive', 'data-archive') : iconBtn('play', 'Activate', 'data-activate')}${iconBtn('trash', 'Remove', 'data-remove')}</div></div>`).join('')}</div>` : `<div id="product-list">${empty('No products yet', 'Add the first offer. The storefront shows it the moment it is active.')}</div>`)
      + section('Subscriptions', `<div class="grid-4">${[['Active', subs.length, 'recurring products'], ['Monthly', money(subOrders.filter(o => o.test).reduce((a, o) => a + (Number(o.amount) || 0), 0)), subOrders.length ? 'from test orders only' : 'no subscribers yet'], ['Needs attention', 0, ''], ['Ending soon', 0, '']].map(([l, v, s]) => `<div class="kpi"><b>${esc(String(v))}</b><span>${esc(l)}</span>${s ? `<small>${esc(s)}</small>` : ''}</div>`).join('')}</div>`)
      + `<p class="hint">Checkout is in test mode until you add your payment provider's keys in Settings. A test buy records an order marked test; it is never a sale.</p>`;
    const byId = id => products.find(p => p.id === id);
    const republish = async () => { try { await publishStorefront(biz); toast(`Storefront published to ${biz.site?.url ?? 'the site'}.`, 'ok'); } catch (e) { toast(`Saved, but the storefront did not publish: ${oops(e)}`, 'bad'); } };
    $$('[data-archive]', el).forEach(b => b.onclick = async () => { byId(b.closest('.product').dataset.id).status = 'archived'; await writeProducts(biz, products); await paint(); await republish(); });
    $$('[data-activate]', el).forEach(b => b.onclick = async () => { byId(b.closest('.product').dataset.id).status = 'active'; await writeProducts(biz, products); await paint(); await republish(); });
    $$('[data-remove]', el).forEach(b => b.onclick = async () => { const p = byId(b.closest('.product').dataset.id); if (!await confirm(`Remove ${p.name}?`, { ok: 'Remove', danger: true })) return; await writeProducts(biz, products.filter(x => x !== p)); await paint(); await republish(); });
    $$('[data-test-buy]', el).forEach(b => b.onclick = () => testBuy(byId(b.closest('.product').dataset.id)));
  };
  const testBuy = p => {
    const m = modal(`<h2>Test checkout</h2><p class="muted">${esc(p.name)} · ${esc(p.priceLabel)}${p.recurring ? ` / ${esc(p.interval)}` : ''}. <b>This is the payment sandbox:</b> only the test card works, nothing is charged, and the order is marked test.</p>
      <form id="checkout-form" class="stack"><label class="field"><span>Email</span><input name="email" type="email" required value="buyer@example.com"></label><label class="field"><span>Card <button type="button" class="btn sm ghost" id="copy-card">Copy the test card</button></span><input name="card" required placeholder="${TEST_CARD}" inputmode="numeric"></label><div class="grid-2"><label class="field"><span>Expiry</span><input name="exp" required placeholder="12 / 30"></label><label class="field"><span>CVC</span><input name="cvc" required placeholder="123" inputmode="numeric"></label></div><p class="error" data-error></p><div class="modal-actions"><button type="button" class="btn quiet" value="cancel" id="co-cancel">Cancel</button><button class="btn primary" type="submit" value="pay">Pay ${esc(p.priceLabel)} (test)</button></div></form>`, { label: 'Test checkout' });
    m.el.id = 'checkout-dialog';
    $('#copy-card', m.el).onclick = () => { $('[name=card]', m.el).value = TEST_CARD; copy(TEST_CARD, 'Test card copied'); };
    $('#co-cancel', m.el).onclick = () => m.close();
    $('#checkout-form', m.el).onsubmit = async e => {
      e.preventDefault(); const f = e.target; const err = $('[data-error]', m.el);
      if (f.card.value.replace(/\s+/g, '') !== TEST_CARD.replace(/\s+/g, '')) { err.textContent = `Only the test card ${TEST_CARD} is accepted here.`; return; }
      const b = f.querySelector('button[value=pay]');
      await busy(b, async () => {
        try {
          const order = { id: `ord-${Date.now().toString(36)}`, productId: p.id, name: p.name, amount: Number(p.price) || 0, currency: 'USD', email: f.email.value.trim(), test: true, at: Date.now(), status: 'paid (test)' };
          await appendOrder(biz, order);
          const customers = await customersOf(biz);
          if (!customers.some(c => c.email === order.email)) { customers.push({ email: order.email, name: '', since: Date.now(), orders: 1, test: true }); } else { const c = customers.find(c => c.email === order.email); c.orders = (c.orders ?? 0) + 1; }
          await writeCustomers(biz, customers);
          m.close(); toast('Test order recorded. It is marked test and is not a sale.', 'ok');
        } catch (e2) { err.textContent = oops(e2); }
      });
    };
  };
  $('#add-product').onclick = () => {
    const m = modal(`<h2>Add a product</h2><form id="pf" class="stack"><label class="field"><span>Name</span><input id="p-name" name="name" required></label><label class="field"><span>Description</span><textarea id="p-desc" name="description" rows="2"></textarea></label><div class="grid-2"><label class="field"><span>Price (USD)</span><input id="p-price" name="price" type="number" min="0" step="0.01" required></label><label class="field"><span>Type</span><input id="p-type" name="type" list="p-types" value="digital"><datalist id="p-types">${TYPES.map(t => `<option value="${t}">`).join('')}</datalist></label></div><label class="check"><input id="p-recurring" name="recurring" type="checkbox"> Recurring</label><label class="field" id="p-interval-wrap" hidden><span>Every</span><select id="p-interval" name="interval"><option value="month">month</option><option value="year">year</option><option value="week">week</option></select></label><label class="check"><input name="active" type="checkbox" checked> Active (shown on the storefront)</label><div class="modal-actions"><button type="button" class="btn quiet" id="pf-cancel">Cancel</button><button class="btn primary" type="submit" id="create-product">Add product</button></div></form>`, { label: 'Add a product' });
    const f = $('#pf', m.el);
    f.recurring.onchange = () => { $('#p-interval-wrap', m.el).hidden = !f.recurring.checked; };
    $('#pf-cancel', m.el).onclick = () => m.close();
    f.onsubmit = async e => {
      e.preventDefault();
      const price = Number(f.price.value) || 0;
      const p = { id: `p-${Date.now().toString(36)}`, name: f.name.value.trim(), description: f.description.value.trim(), price, priceLabel: money(price), type: f.type.value.trim() || 'other', recurring: f.recurring.checked, interval: f.recurring.checked ? f.interval.value : null, status: f.active.checked ? 'active' : 'draft', createdAt: Date.now() };
      await busy($('#create-product', m.el), async () => {
        try { const products = await productsOf(biz); products.push(p); await writeProducts(biz, products); m.close(); toast('Product added.', 'ok'); await paint(); try { await publishStorefront(biz); toast(`Storefront published to ${biz.site?.url ?? 'the site'}.`, 'ok'); } catch (err) { toast(`Saved, but the storefront did not publish: ${oops(err)}`, 'bad'); } }
        catch (err) { toast(oops(err), 'bad'); }
      });
    };
  };
  await paint();
}
