// Products: the catalogue, published into the storefront on every change. A physical product is also a good on
// CommandAGI (`/goods`): its buyers pay through the one cart checkout into the founder's own Stripe account (Connect),
// and return to the storefront. Any other kind is ordered by email from the storefront.
import { publishStorefront } from '/lib/business.js';
import { payments, goods } from '/lib/api.js';
import { $, $$, esc, icon, toast, modal, confirm, money, oops, busy } from '/lib/ui.js';
import { head, section, productsOf, writeProducts, ordersOf, iconBtn, empty, swatch } from './_shared.js';

const TYPES = ['digital', 'service', 'subscription', 'physical', 'hardware', 'course', 'other'];
/** The kinds the checkout sells now: shipped goods, which a buyer pays for without an account. */
const SHIPPED = new Set(['physical', 'hardware']);

export async function render(ctx) {
  const { biz, el, actions } = ctx;
  actions.innerHTML = `<button type="button" class="btn sm primary" id="add-product">${icon('plus', 14)} Add product</button>`;
  const republish = async () => { try { await publishStorefront(biz); toast(`Storefront published to ${biz.site?.url ?? 'the site'}.`, 'ok'); } catch (e) { toast(`Saved, but the storefront did not publish: ${oops(e)}`, 'bad'); } };
  /** A good's status follows the product's; a draft good goes live once the founder's payouts are ready. */
  const syncGood = async (p, want, ready) => {
    if (!p.goodId) return;
    const status = want === 'active' && !ready ? 'draft' : want;
    if (p.goodStatus === status) return;
    try { p.goodStatus = (await goods.update(p.goodId, { status })).status ?? status; } catch (e) { toast(`${p.name}: ${oops(e)}`, 'bad'); }
  };
  // A republish the first paint owes runs after the tab is drawn: the founder sees the products, then the toast.
  let republishLater = false;
  const paint = async () => {
    const [products, orders, readiness] = await Promise.all([productsOf(biz), ordersOf(biz), payments.readiness().catch(() => ({ ready: false, blocks: ['unreadable'] }))]);
    const ready = !!readiness.ready;
    // A product the co-founder wrote as a product file (`file`) is linked to the good the Drive indexed from it.
    const unlinked = products.filter(p => p.file && !p.goodId);
    if (unlinked.length) {
      const bare = s => String(s ?? '').replace(/^\/+/, '');
      const all = await goods.list().catch(() => []);
      let linked = 0;
      for (const p of unlinked) {
        const g = all.find(g => g.file && bare(g.file) === bare(p.file));
        if (g) { Object.assign(p, { goodId: g.id, variantId: g.variants?.[0]?.id ?? null, goodStatus: g.status, goodKind: g.kind }); linked++; }
      }
      if (linked) { await writeProducts(biz, products); if (!(ready && products.some(p => p.goodId && p.status === 'active' && p.goodStatus !== 'active'))) republishLater = true; }
    }
    const pending =products.filter(p => p.goodId && p.status === 'active' && p.goodStatus !== 'active');
    if (ready && pending.length) {
      for (const p of pending) await syncGood(p, 'active', ready);
      await writeProducts(biz, products);
      republishLater = true;
    }
    const subs = products.filter(p => p.recurring && p.status === 'active');
    const sold = p => p.goodId && p.goodKind !== 'digital' ? (p.goodStatus === 'active' ? '<span class="badge ok">checkout</span>' : '<span class="badge warn">checkout after payouts</span>') : '<span class="badge">order by email</span>';
    const checkoutHref = p => biz.site?.url ? `${biz.site.url.replace(/\/+$/, '')}/checkout.html?p=${encodeURIComponent(p.id)}` : null;
    el.innerHTML = head('Products', 'What your storefront sells. Every change publishes the storefront again.')
      + (ready ? '' : `<div class="note warn" id="payments-needed"><b>Connect payouts to take payment.</b> Your customers pay through the checkout into your own Stripe account. Until you connect it in <a href="${esc(ctx.tabHref('settings'))}">Settings</a>, the storefront takes orders by email. Nothing is charged.</div>`)
      + (products.length ? `<div id="product-list" class="list">${products.map(p => `<div class="product" data-id="${esc(p.id)}">${swatch(biz.brand)}<div><b>${esc(p.name)}</b> <span class="badge ${p.status === 'active' ? 'ok' : ''}">${esc(p.status)}</span> ${sold(p)}<div class="meta">${[`${p.priceLabel ?? ''}${p.recurring ? ` / ${p.interval}` : ''}`, p.type ?? (p.goodKind === 'digital' ? 'digital' : ''), p.description ?? p.tagline ?? ''].filter(Boolean).map(esc).join(' · ')}</div></div><div class="acts">${p.goodStatus === 'active' && checkoutHref(p) ? `<a class="btn sm quiet" data-open-checkout target="_blank" rel="noopener" href="${esc(checkoutHref(p))}">Open checkout</a>` : ''}${p.status === 'active' ? iconBtn('pause', 'Archive', 'data-archive') : iconBtn('play', 'Activate', 'data-activate')}${iconBtn('trash', 'Remove', 'data-remove')}</div></div>`).join('')}</div>` : `<div id="product-list">${empty('No products yet', 'Add the first offer. The storefront shows it the moment it is active.', '<button type="button" class="btn primary" data-press="#add-product">Add your first product</button>')}</div>`)
      + section('Subscriptions', `<div class="grid-4">${[['Active', subs.length, 'recurring products'], ['Orders', orders.length, 'all time'], ['Needs attention', 0, ''], ['Ending soon', 0, '']].map(([l, v, s]) => `<div class="kpi"><b>${esc(String(v))}</b><span>${esc(l)}</span>${s ? `<small>${esc(s)}</small>` : ''}</div>`).join('')}</div>`)
      + `<p class="hint">A physical product sells through the checkout: the buyer pays on Stripe's page, the money goes to your Stripe account less a 0.5% fee, and the buyer comes back to your storefront. Other kinds take orders by email. On a test stack, Stripe's test card pays.</p>`;
    const byId = id => products.find(p => p.id === id);
    const setStatus = async (p, status) => { p.status = status; await syncGood(p, status === 'active' ? 'active' : 'archived', ready); await writeProducts(biz, products); await paint(); await republish(); };
    $$('[data-archive]', el).forEach(b => b.onclick = () => setStatus(byId(b.closest('.product').dataset.id), 'archived'));
    $$('[data-activate]', el).forEach(b => b.onclick = () => setStatus(byId(b.closest('.product').dataset.id), 'active'));
    $$('[data-remove]', el).forEach(b => b.onclick = async () => { const p = byId(b.closest('.product').dataset.id); if (!await confirm(`Remove ${p.name}?`, { ok: 'Remove', danger: true })) return; await syncGood(p, 'archived', ready); await writeProducts(biz, products.filter(x => x !== p)); await paint(); await republish(); });
    return ready;
  };
  $('#add-product').onclick = () => {
    const m = modal(`<h2>Add a product</h2><form id="pf" class="stack"><label class="field"><span>Name</span><input id="p-name" name="name" required></label><label class="field"><span>Description</span><textarea id="p-desc" name="description" rows="2"></textarea></label><div class="grid-2"><label class="field"><span>Price (USD)</span><input id="p-price" name="price" type="number" min="0" step="0.01" required></label><label class="field"><span>Type</span><input id="p-type" name="type" list="p-types" value="physical"><datalist id="p-types">${TYPES.map(t => `<option value="${t}">`).join('')}</datalist></label></div><label class="field" id="p-shipping-wrap"><span>Shipping in the US (USD)</span><input id="p-shipping" name="shipping" type="number" min="0" step="0.01" value="0"></label><label class="check"><input id="p-recurring" name="recurring" type="checkbox"> Recurring</label><label class="field" id="p-interval-wrap" hidden><span>Every</span><select id="p-interval" name="interval"><option value="month">month</option><option value="year">year</option><option value="week">week</option></select></label><label class="check"><input name="active" type="checkbox" checked> Active (shown on the storefront)</label><p class="hint">A physical product sells through the checkout. Other kinds, and recurring prices, take orders by email.</p><div class="modal-actions"><button type="button" class="btn quiet" id="pf-cancel">Cancel</button><button class="btn primary" type="submit" id="create-product">Add product</button></div></form>`, { label: 'Add a product' });
    const f = $('#pf', m.el);
    const shippedNow = () => SHIPPED.has(f.type.value.trim()) && !f.recurring.checked;
    const toggle = () => { $('#p-interval-wrap', m.el).hidden = !f.recurring.checked; $('#p-shipping-wrap', m.el).hidden = !shippedNow(); };
    f.recurring.onchange = toggle; f.type.oninput = toggle;
    $('#pf-cancel', m.el).onclick = () => m.close();
    f.onsubmit = async e => {
      e.preventDefault();
      const price = Number(f.price.value) || 0;
      const p = { id: `p-${Date.now().toString(36)}`, name: f.name.value.trim(), description: f.description.value.trim(), price, priceLabel: money(price), type: f.type.value.trim() || 'other', recurring: f.recurring.checked, interval: f.recurring.checked ? f.interval.value : null, status: f.active.checked ? 'active' : 'draft', createdAt: Date.now() };
      await busy($('#create-product', m.el), async () => {
        try {
          if (shippedNow()) {
            // The good is a draft until the founder's payouts are ready: a good goes live only for a seller who can be paid.
            const ready = !!(await payments.readiness().catch(() => ({ ready: false }))).ready;
            try {
              const good = await goods.create({
                name: p.name,
                description: p.description || undefined,
                kind: 'physical',
                shipping: { zones: [{ rule: 'flat', countries: ['US'], amountCents: Math.round((Number(f.shipping.value) || 0) * 100) }] },
                variants: [{ sku: `${biz.slug}-${p.id}`.toUpperCase().slice(0, 80), name: 'Standard', priceCents: Math.round(price * 100), inventoryQty: -1 }],
                status: ready && p.status === 'active' ? 'active' : 'draft',
              });
              Object.assign(p, { goodId: good.id, variantId: good.variants?.[0]?.id ?? null, goodStatus: good.status });
            } catch (err) { toast(`Saved for orders by email; the checkout refused it: ${oops(err)}`, 'bad'); }
          }
          const products = await productsOf(biz); products.push(p); await writeProducts(biz, products); m.close(); toast('Product added.', 'ok'); await paint(); await republish();
        } catch (err) { toast(oops(err), 'bad'); }
      });
    };
  };
  await paint();
  if (republishLater) { republishLater = false; republish(); }
}
