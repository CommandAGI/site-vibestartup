// Products: the catalogue, published into the storefront on every change. A physical product, and a digital one with
// its file, is also a good on CommandAGI (`/goods`): its buyers pay through the one cart checkout into the founder's
// own Stripe account (Connect) and return to the storefront. A digital good sells to a guest where the API takes a
// guest's email for it, and any good only where the API's store is open to guests (`guestCheckout`); elsewhere, and for
// any other kind, the storefront takes orders by email.
// Pictures come from the Studio's library, the brand folder or an upload; the storefront shows them sized for the web.
import { publishStorefront } from '/lib/business.js';
import { folderOf } from '/lib/business.js';
import { guestCheckout, sellable, isImage, storefrontUrl } from '/lib/storefront.js';
import { payments, goods, drive } from '/lib/api.js';
import { $, $$, esc, icon, toast, modal, confirm, money, oops, busy, soon } from '/lib/ui.js';
import { head, section, productsOf, writeProducts, ordersOf, iconBtn, empty, swatch } from './_shared.js';

const TYPES = ['digital', 'service', 'subscription', 'physical', 'hardware', 'course', 'other'];
/** The kinds the checkout sells as a shipped good. */
const SHIPPED = new Set(['physical', 'hardware']);
/** The kinds the checkout sells as a download, once the file is chosen. */
const DOWNLOADS = new Set(['digital', 'course']);
/** The kinds whose checkout opens soon; they take orders by email today. A recurring price is a subscription. */
const CHECKOUT_SOON = new Set(['subscription', 'service']);
const checkoutSoon = p => CHECKOUT_SOON.has(p.type) || !!p.recurring;
/** Where the pictures a founder can choose live, in the business's folder. */
const PICTURE_DIRS = ['studio', 'products/images', 'brand'];

/** A picture's thumbnail (a blob URL: the Drive needs the bearer), kept for the visit. */
const thumbs = new Map();
const thumbOf = path => { if (!thumbs.has(path)) thumbs.set(path, drive.readBlobPath(path).then(b => b ? URL.createObjectURL(b) : null).catch(() => null)); return thumbs.get(path); };

/**
 * The picture chooser inside a form: the business's pictures as toggles (the order chosen is the order shown; the
 * first is the cover) and an upload. `chosen` is the product's `images` and is changed in place.
 */
async function pictures(root, biz, chosen) {
  const base = folderOf(biz.slug);
  const lists = await Promise.all(PICTURE_DIRS.map(d => drive.list(`${base}/${d}`).then(fs => fs.filter(f => f.type !== 'folder' && isImage(f)).map(f => ({ path: `${base}/${d}/${f.name}`, name: f.name, at: Date.parse(f.updatedAt ?? f.createdAt ?? '') || 0 }))).catch(() => [])));
  const all = lists.flat().sort((a, b) => b.at - a.at);
  for (const c of chosen) if (!all.some(f => f.path === c.path)) all.unshift({ path: c.path, name: c.path.split('/').pop() });
  const grid = $('.pick-grid', root), count = $('.pick-count', root);
  const paint = () => {
    grid.innerHTML = all.length ? all.slice(0, 48).map(f => { const n = chosen.findIndex(c => c.path === f.path); return `<button type="button" class="pick" data-path="${esc(f.path)}" aria-pressed="${n >= 0}" aria-label="${esc(f.name)}" title="${esc(f.name)}"><img alt="" data-thumb="${esc(f.path)}">${n >= 0 ? `<b>${n + 1}</b>` : ''}</button>`; }).join('') : '<p class="muted">No pictures yet. Make some in Studio, or upload one.</p>';
    count.textContent = chosen.length ? `${chosen.length} chosen; the first is the cover.` : 'None chosen: the storefront shows your brand colours.';
    $$('[data-thumb]', grid).forEach(async img => { const u = await thumbOf(img.dataset.thumb); if (u) img.src = u; });
    $$('.pick', grid).forEach(b => b.onclick = () => { const i = chosen.findIndex(c => c.path === b.dataset.path); if (i >= 0) chosen.splice(i, 1); else chosen.push({ path: b.dataset.path }); paint(); });
  };
  $('.pick-upload', root).onchange = async e => {
    const files = [...e.target.files].filter(f => /^image\//.test(f.type));
    if (!files.length) return;
    await drive.mkdir(`${base}/products`, 'images').catch(() => null);
    for (const f of files) {
      try {
        const name = f.name.replace(/[^\w.-]+/g, '-');
        await drive.write(`${base}/products/images`, name, f, f.type);
        const path = `${base}/products/images/${name}`;
        thumbs.set(path, Promise.resolve(URL.createObjectURL(f)));
        all.unshift({ path, name, at: Date.now() });
        if (!chosen.some(c => c.path === path)) chosen.push({ path });
      } catch (err) { toast(`${f.name}: ${oops(err)}`, 'bad'); }
    }
    e.target.value = '';
    paint();
  };
  paint();
}
const pickerHtml = id => `<div class="field"><span>Pictures</span><div class="pick-grid" id="${id}"></div><div class="row"><small class="pick-count grow"></small><label class="btn sm quiet">${icon('upload', 14)} Upload<input type="file" class="pick-upload" accept="image/*" multiple hidden></label></div></div>`;

export async function render(ctx) {
  const { biz, el, actions } = ctx;
  actions.innerHTML = `<button type="button" class="btn sm primary" id="add-product">${icon('plus', 14)} Add product</button>`;
  const republish = async () => { try { await publishStorefront(biz); toast(`Storefront published to ${storefrontUrl(biz) || 'the site'}.`, 'ok'); } catch (e) { toast(`Saved, but the storefront did not publish: ${oops(e)}`, 'bad'); } };
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
    const pending = products.filter(p => p.goodId && p.status === 'active' && p.goodStatus !== 'active');
    if (ready && pending.length) {
      for (const p of pending) await syncGood(p, 'active', ready);
      await writeProducts(biz, products);
      republishLater = true;
    }
    // What a guest can buy through this API's checkout (its store open to visitors; a download sold to a guest), asked
    // once in a while. A storefront published under another answer is published again.
    const liveDigital = products.find(p => p.goodKind === 'digital' && p.goodStatus === 'active' && p.variantId);
    const can = await guestCheckout(liveDigital?.variantId);
    const { guestDigital } = can;
    const was = biz.site?.checkout;
    if (biz.site && products.some(p => p.goodStatus === 'active') && (can.store !== (was?.store ?? null) || (liveDigital && guestDigital !== (was?.guestDigital ?? null)))) republishLater = true;
    const subs = products.filter(p => p.recurring && p.status === 'active');
    const sold = p => {
      if (!p.goodId) return `<span class="badge">order by email</span>${checkoutSoon(p) ? ' ' + soon('checkout soon') : ''}`;
      if (p.goodStatus !== 'active') return '<span class="badge warn">checkout after payouts</span>';
      if (can.store === false) return '<span class="badge" title="CommandAGI\'s checkout is not open to guests yet (its store is off): buyers order by email until it opens.">checkout not open · order by email</span>';
      if (p.goodKind === 'digital' && guestDigital !== true) return `<span class="badge" title="${esc(guestDigital === false ? 'CommandAGI\'s checkout does not sell downloads to guests yet: buyers order by email until it does.' : 'Not checked yet.')}">download · order by email</span>`;
      return `<span class="badge ok">checkout${p.goodKind === 'digital' ? ' · download' : ''}</span>`;
    };
    const shop = storefrontUrl(biz);
    const sells = p => sellable(p, can);
    el.innerHTML = head('Products', 'What your storefront sells. Every change publishes the storefront again.')
      + (ready ? '' : `<div class="note warn" id="payments-needed"><b>Connect payouts to take payment.</b> Your customers pay through the checkout into your own Stripe account. Until you connect it in <a href="${esc(ctx.tabHref('settings'))}">Settings</a>, the storefront takes orders by email. Nothing is charged.</div>`)
      + (products.length ? `<div id="product-list" class="list">${products.map(p => `<div class="product" data-id="${esc(p.id)}">${p.images?.length ? `<img class="thumb" alt="" data-thumb="${esc(p.images[0].path)}">` : swatch(biz.brand)}<div><b>${esc(p.name)}</b> <span class="badge ${p.status === 'active' ? 'ok' : ''}">${esc(p.status)}</span> ${sold(p)}<div class="meta">${[`${p.priceLabel ?? ''}${p.recurring ? ` / ${p.interval}` : ''}`, p.type ?? (p.goodKind === 'digital' ? 'digital' : ''), p.images?.length ? `${p.images.length} ${p.images.length === 1 ? 'picture' : 'pictures'}` : '', p.description ?? p.tagline ?? ''].filter(Boolean).map(esc).join(' · ')}</div></div><div class="acts">${shop && p.status === 'active' ? `<a class="btn icon" data-open-page target="_blank" rel="noopener" href="${esc(`${shop}/product/${encodeURIComponent(p.id)}.html`)}" aria-label="Open its page" data-tip="Open its page">${icon('external')}</a>` : ''}${sells(p) && shop ? `<a class="btn sm quiet" data-open-checkout target="_blank" rel="noopener" href="${esc(`${shop}/checkout.html?p=${encodeURIComponent(p.id)}`)}">Open checkout</a>` : ''}${iconBtn('image', 'Pictures', 'data-images')}${p.status === 'active' ? iconBtn('pause', 'Archive', 'data-archive') : iconBtn('play', 'Activate', 'data-activate')}${iconBtn('trash', 'Remove', 'data-remove')}</div></div>`).join('')}</div>` : `<div id="product-list">${empty('No products yet', 'Add the first offer. The storefront shows it the moment it is active.', '<button type="button" class="btn primary" data-press="#add-product">Add your first product</button>')}</div>`)
      + section('Subscriptions', `<div class="grid-4">${[['Active', subs.length, 'recurring products'], ['Orders', orders.length, 'all time'], ['Needs attention', 0, ''], ['Ending soon', 0, '']].map(([l, v, s]) => `<div class="kpi"><b>${esc(String(v))}</b><span>${esc(l)}</span>${s ? `<small>${esc(s)}</small>` : ''}</div>`).join('')}</div>`)
      + `<p class="hint">A physical product sells through the checkout: the buyer pays on Stripe's page, the money goes to your Stripe account less a 0.5% fee, and the buyer comes back to your storefront. A digital product with its file sells the same way and the buyer gets a download link by email${guestDigital === true ? '' : ', once CommandAGI\'s checkout sells downloads to guests (until then it is ordered by email)'}. Other kinds take orders by email. Each product has its own page on the storefront.</p>`;
    $$('[data-thumb]', el).forEach(async img => { const u = await thumbOf(img.dataset.thumb); if (u) img.src = u; });
    const byId = id => products.find(p => p.id === id);
    const setStatus = async (p, status) => { p.status = status; await syncGood(p, status === 'active' ? 'active' : 'archived', ready); await writeProducts(biz, products); await paint(); await republish(); };
    $$('[data-archive]', el).forEach(b => b.onclick = () => setStatus(byId(b.closest('.product').dataset.id), 'archived'));
    $$('[data-activate]', el).forEach(b => b.onclick = () => setStatus(byId(b.closest('.product').dataset.id), 'active'));
    $$('[data-remove]', el).forEach(b => b.onclick = async () => { const p = byId(b.closest('.product').dataset.id); if (!await confirm(`Remove ${p.name}?`, { ok: 'Remove', danger: true })) return; await syncGood(p, 'archived', ready); await writeProducts(biz, products.filter(x => x !== p)); await paint(); await republish(); });
    $$('[data-images]', el).forEach(b => b.onclick = () => {
      const p = byId(b.closest('.product').dataset.id);
      const chosen = (p.images ?? []).map(i => ({ ...i }));
      const m = modal(`<h2>Pictures of ${esc(p.name)}</h2><form id="pics" class="stack">${pickerHtml('p-pictures')}<div class="modal-actions"><button type="button" class="btn quiet" id="pics-cancel">Cancel</button><button class="btn primary" type="submit" id="pics-save">Save and publish</button></div></form>`, { label: 'Pictures' });
      pictures(m.el, biz, chosen);
      $('#pics-cancel', m.el).onclick = () => m.close();
      $('#pics', m.el).onsubmit = async e => {
        e.preventDefault();
        await busy($('#pics-save', m.el), async () => {
          // A picture kept keeps what was made of it; a new one is made at the publish.
          p.images = chosen.map(c => (p.images ?? []).find(i => i.path === c.path) ?? { path: c.path });
          try { await writeProducts(biz, products); m.close(); await paint(); await republish(); } catch (err) { toast(oops(err), 'bad'); }
        });
      };
    });
    return ready;
  };
  $('#add-product').onclick = () => {
    const chosen = [];
    const m = modal(`<h2>Add a product</h2><form id="pf" class="stack"><label class="field"><span>Name</span><input id="p-name" name="name" required></label><label class="field"><span>Description</span><textarea id="p-desc" name="description" rows="3"></textarea></label><div class="grid-2"><label class="field"><span>Price (USD)</span><input id="p-price" name="price" type="number" min="0" step="0.01" required></label><label class="field"><span>Type <span id="p-type-soon" hidden>${soon('checkout soon')}</span></span><select id="p-type" name="type">${TYPES.map(t => `<option value="${t}"${t === 'physical' ? ' selected' : ''}>${t[0].toUpperCase() + t.slice(1)}${CHECKOUT_SOON.has(t) ? ' · checkout soon' : ''}</option>`).join('')}</select></label></div><label class="field" id="p-shipping-wrap"><span>Shipping in the US (USD)</span><input id="p-shipping" name="shipping" type="number" min="0" step="0.01" value="0"></label><label class="field" id="p-file-wrap" hidden><span>The file buyers download</span><input id="p-file" name="file" type="file"><small>Kept in your Drive (products/files). Buyers get a link to it by email after they pay.</small></label>${pickerHtml('p-pictures')}<label class="check"><input id="p-recurring" name="recurring" type="checkbox"> Recurring</label><label class="field" id="p-interval-wrap" hidden><span>Every</span><select id="p-interval" name="interval"><option value="month">month</option><option value="year">year</option><option value="week">week</option></select></label><label class="check"><input name="active" type="checkbox" checked> Active (shown on the storefront)</label><p class="hint" id="p-how"></p><div class="modal-actions"><button type="button" class="btn quiet" id="pf-cancel">Cancel</button><button class="btn primary" type="submit" id="create-product">Add product</button></div></form>`, { label: 'Add a product' });
    const f = $('#pf', m.el);
    pictures(m.el, biz, chosen);
    const kind = () => f.recurring.checked ? null : SHIPPED.has(f.type.value.trim()) ? 'physical' : DOWNLOADS.has(f.type.value.trim()) ? 'digital' : null;
    const toggle = () => {
      const later = checkoutSoon({ type: f.type.value, recurring: f.recurring.checked });
      $('#p-interval-wrap', m.el).hidden = !f.recurring.checked; $('#p-shipping-wrap', m.el).hidden = kind() !== 'physical'; $('#p-file-wrap', m.el).hidden = kind() !== 'digital';
      $('#p-type-soon', m.el).hidden = !later;
      $('#p-how', m.el).textContent = kind() === 'physical' ? 'Buyers pay by card at your checkout once payouts are connected.' : kind() === 'digital' ? 'With its file, buyers pay at your checkout and get a download link by email, where CommandAGI\'s checkout sells downloads to guests; otherwise they order by email.' : later ? 'Buyers order by email today. Card checkout for this kind is on its way.' : 'Buyers order by email.';
    };
    f.recurring.onchange = toggle; f.type.oninput = toggle; f.type.onchange = toggle; toggle();
    $('#pf-cancel', m.el).onclick = () => m.close();
    f.onsubmit = async e => {
      e.preventDefault();
      const price = Number(f.price.value) || 0;
      const p = { id: `p-${Date.now().toString(36)}`, name: f.name.value.trim(), description: f.description.value.trim(), price, priceLabel: money(price), type: f.type.value.trim() || 'other', recurring: f.recurring.checked, interval: f.recurring.checked ? f.interval.value : null, status: f.active.checked ? 'active' : 'draft', images: chosen.map(c => ({ path: c.path })), createdAt: Date.now() };
      const k = kind();
      const file = k === 'digital' ? f.file.files[0] : null;
      await busy($('#create-product', m.el), async () => {
        try {
          if (k === 'physical' || file) {
            // The good is a draft until the founder's payouts are ready: a good goes live only for a seller who can be paid.
            const ready = !!(await payments.readiness().catch(() => ({ ready: false }))).ready;
            try {
              const variant = { sku: `${biz.slug}-${p.id}`.toUpperCase().slice(0, 80), name: k === 'physical' ? 'Standard' : 'Download', priceCents: Math.round(price * 100) };
              const body = { name: p.name, description: p.description || undefined, kind: k, status: ready && p.status === 'active' ? 'active' : 'draft' };
              if (k === 'physical') Object.assign(body, { shipping: { zones: [{ rule: 'flat', countries: ['US'], amountCents: Math.round((Number(f.shipping.value) || 0) * 100) }] }, variants: [{ ...variant, inventoryQty: -1 }] });
              else {
                // The file sold is the founder's own Drive file; the good names it by its path.
                const dir = `${folderOf(biz.slug)}/products/files`;
                await drive.mkdir(`${folderOf(biz.slug)}/products`, 'files').catch(() => null);
                const name = file.name.replace(/[^\w.-]+/g, '-');
                await drive.write(dir, name, file, file.type || 'application/octet-stream');
                Object.assign(body, { variants: [{ ...variant, file: `${dir}/${name}` }] });
                p.download = `${dir}/${name}`;
              }
              const good = await goods.create(body);
              Object.assign(p, { goodId: good.id, variantId: good.variants?.[0]?.id ?? null, goodStatus: good.status, goodKind: good.kind ?? k });
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
