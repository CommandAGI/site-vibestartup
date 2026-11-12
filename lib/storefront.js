// The storefront: the files VibeStartup writes into a business's site folder, and the publish that deploys them
// (docs/ARCHITECTURE.md § the storefront). It is a static site on CommandAGI's site hosting with one small server module
// (`app.mjs`) for the "Get updates" sign-ups. Everything runs in the founder's browser with the founder's own token.
//
// How a store looks is chosen, not coded per store: a template (the layout) and a style (the look), with the
// founder's words, in `storefront.json` of the business's folder (lib/storefront-design.js). Every publish writes the
// pages again from that file, the products and the brand kit.
//
//   index.html            the front page, by the template: hero, products (pictures, price, buy), get updates, footer
//   product/<id>.html     one page per active product: gallery, description, price, buy
//   checkout.html         a guest cart and the one cart checkout (Stripe's page), or "order by email"
//   terms.html privacy.html refunds.html
//                         the business's own (legal/*.html in its folder) when it has them, else the defaults here
//   images/               each product picture at 480, 960 and 1600 px (WebP), made in the browser from the original
//   products.json         what checkout.html reads
//   app.mjs               the sign-ups: POST /api/signups (a visitor, with consent), GET /api/signups (the founder)
//   style.css logo.svg
import { api, sites, BRAND, API } from './api.js';
import { bizDrive, readBizJson, writeBizJson, writeBusiness, markSvg } from './business.js';
import { TEMPLATES, readStorefrontSource, newStorefrontSource, sourceMark, storefrontCss, styleHead, frontPage, buyWord } from './storefront-design.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** A value written into an inline script: JSON, with `<` escaped so no text closes the script. */
const js = v => JSON.stringify(v).replace(/</g, '\\u003c');

/** The words a visitor agrees to when they ask for updates. The server module records these, not the page's. */
export const consentText = biz => `Email me news and offers from ${biz.name}. I can stop them at any time.`;

/**
 * Where the storefront answers: its VibeStartup address (`https://<slug>.vibestartup.pro`, the site's `brandUrl`, which
 * VibeStartup's edge serves: edge/README.md), else the site's own address on commandagi.app.
 */
export const storefrontUrl = biz => (biz.site?.brandUrl ?? biz.site?.url ?? '').replace(/\/+$/, '');

// ---------- what the checkout can sell ----------

/**
 * A product sells through the checkout when it is a live good and a guest can check out on this API: the buyer pays
 * into the founder's own Stripe account (Connect) and returns to the storefront. `store` is whether the API's headless
 * store is open to a visitor (its `store` feature flag); a digital good also needs the API to take a guest's email for
 * it (`guestDigital`). Both are read by `guestCheckout`. Anything else is ordered by email.
 */
export const sellable = (p, { store = null, guestDigital = false } = {}) => store !== false && !!p.variantId && p.goodStatus === 'active' && (p.goodKind !== 'digital' || guestDigital === true);

const cached = (key, ms) => { try { const c = JSON.parse(localStorage.getItem(key) || 'null'); return c && Date.now() - c.at < ms ? c.ok : undefined; } catch { return undefined; } };
const keep = (key, ok) => { if (ok !== null) try { localStorage.setItem(key, JSON.stringify({ ok, at: Date.now() })); } catch { /* storage may be off */ } return ok; };

/**
 * What a guest can buy through this API's checkout, as { store, guestDigital } (each true, false, or null when the
 * answer said neither):
 * - `store`: a visitor's read of the catalog (`GET /commerce/products`) is not refused `feature_off` (the platform's
 *   `store` flag, `docs/feature-flags.md`). It makes nothing. Kept ten minutes in this browser.
 * - `guestDigital`: the checkout sells a digital good to a guest (CommandAGI github/main 46c73e0, `docs/api-worker.md`
 *   § digital goods). A guest's cart holding `digitalVariantId`, checked out with no email, answers 400 `email_required`
 *   where it does and 401 `account_required` where it does not; nothing is made at Stripe either way. Needs a live
 *   digital variant. Kept six hours.
 */
export async function guestCheckout(digitalVariantId) {
  const storeKey = `vs_guest_store:${API}`, digitalKey = `vs_guest_digital:${API}`;
  let store = cached(storeKey, 600e3);
  if (store === undefined) {
    const r = await fetch(`${API}/commerce/products?limit=1`, { cache: 'no-store' }).catch(() => null);
    const body = r ? await r.json().catch(() => ({})) : null;
    store = keep(storeKey, !r ? null : r.status === 404 && body?.error === 'feature_off' ? false : r.ok ? true : null);
  }
  let guestDigital = cached(digitalKey, 6 * 3600e3);
  if (guestDigital === undefined) {
    guestDigital = null;
    if (store && digitalVariantId) {
      const post = (path, body) => api(path, { method: 'POST', body, anonymous: true });
      try {
        const cart = await post('/commerce/cart', {});
        await post(`/commerce/cart/${encodeURIComponent(cart.id)}/items`, { variantId: digitalVariantId, qty: 1 });
        await post('/billing/checkout', { type: 'cart', cartId: cart.id });
      } catch (e) {
        guestDigital = keep(digitalKey, e?.code === 'email_required' ? true : e?.code === 'account_required' ? false : null);
      }
    }
  }
  return { store, guestDigital };
}

// ---------- the files ----------

const WIDTHS = [480, 960, 1600];
/** `<img>` for a product picture made by `storefrontImages` (`up` is '../' on a product page). */
function picture(img, alt, { up = '', sizes = '(min-width: 900px) 33vw, (min-width: 600px) 50vw, 100vw', eager = false } = {}) {
  if (!img?.files?.length) return '';
  const files = [...img.files].sort((a, b) => (a.w ?? 0) - (b.w ?? 0));
  const mid = files.find(f => (f.w ?? 0) >= 960) ?? files[files.length - 1];
  const srcset = files.filter(f => f.w).map(f => `${up}images/${esc(f.name)} ${f.w}w`).join(', ');
  const dims = img.width && img.height ? ` width="${img.width}" height="${img.height}"` : '';
  return `<img src="${up}images/${esc(mid.name)}"${srcset ? ` srcset="${srcset}" sizes="${esc(sizes)}"` : ''} alt="${esc(alt)}"${dims} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

/**
 * The storefront's files, by path in the site folder. `opts`: `storefront` (the business's `storefront.json`: its
 * template, its style and its words; absent, the default for the business), `images` (product id → pictures made by
 * `storefrontImages`), `legal` ({ terms, privacy, refunds }: the business's own pages, HTML), `store` and
 * `guestDigital` (what a guest can buy through the checkout, `guestCheckout`). The layout and the look are
 * lib/storefront-design.js: any template with any style, in the brand kit's colours, phone first (48 px targets,
 * one column until 600 px), docs/DESIGN.md § the storefront.
 */
export function storefrontFiles(biz, products = [], opts = {}) {
  const images = opts.images ?? new Map();
  const legal = opts.legal ?? {};
  const active = products.filter(p => p.status === 'active');
  const source = readStorefrontSource(opts.storefront, biz, active);
  const sells = p => sellable(p, opts);
  const contactText = biz.email?.address ?? BRAND.support;
  const contact = esc(contactText);
  const year = new Date().getFullYear();
  const css = storefrontCss(source, biz.brand);
  const fonts = styleHead(source);
  const template = TEMPLATES.find(t => t.id === source.template);

  // One page shell: the bar, the content, the footer. `up` is '../' for a page in product/. `wide` is the front page,
  // whose sections run the page's full width. `path` is the page's own path in the site: its canonical address is
  // the storefront's address plus it.
  const home = storefrontUrl(biz);
  const canonical = path => home && path !== undefined ? `<link rel="canonical" href="${esc(`${home}/${path}`)}"><meta property="og:url" content="${esc(`${home}/${path}`)}">` : '';
  const anySell = active.some(sells);
  // The launch page with no product yet has no products section to link to.
  const hasShop = active.length > 0 || source.template !== 'launch';
  const footer = up => `<footer><div class="wrap foot"><div class="foot-brand"><a class="brand" href="${up || './'}"><img src="${up}logo.svg" alt="" width="30" height="30"><span>${esc(biz.name)}</span></a>${biz.tagline ? `<p>${esc(biz.tagline)}</p>` : ''}</div><nav aria-label="Shop"><h2>Shop</h2>${hasShop ? `<a href="${up}#products">${esc(source.copy.productsTitle || template.productsTitle)}</a>` : ''}<a href="${up}#updates">Get updates</a><a href="mailto:${contact}">${contact}</a></nav><nav aria-label="Legal"><h2>Legal</h2><a href="${up}terms.html">Terms</a><a href="${up}privacy.html">Privacy</a><a href="${up}refunds.html">Refunds</a></nav></div><div class="wrap foot-base"><span>© ${year} ${esc(biz.name)}</span>${anySell ? '<span>Payments by Stripe</span>' : ''}<span>Built with ${esc(BRAND.name)}</span></div></footer>`;
  const page = ({ title, description = '', body, up = '', nav = true, script = '', og = '', path, wide = false }) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${canonical(path)}${description ? `<meta name="description" content="${esc(description)}"><meta property="og:description" content="${esc(description)}">` : ''}<meta property="og:title" content="${esc(title)}">${og}<link rel="icon" href="${up}logo.svg" type="image/svg+xml">${fonts}<link rel="stylesheet" href="${up}style.css"></head><body data-template="${esc(source.template)}" data-style="${esc(source.style)}">${source.copy.announcement && wide ? `<p class="announce">${esc(source.copy.announcement)}</p>` : ''}<header class="bar"><div class="wrap bar-in"><a class="brand" href="${up || './'}"><img src="${up}logo.svg" alt="" width="30" height="30"><span>${esc(biz.name)}</span></a>${nav ? `<nav>${hasShop ? `<a href="${up}#products">Shop</a>` : `<a href="${up}#updates">Updates</a>`}<a href="mailto:${contact}">Contact</a></nav>` : ''}</div></header><main>${wide ? body : `<div class="wrap page">${body}</div>`}</main>${footer(up)}${script}</body></html>`;

  const priceLine = p => `${esc(p.priceLabel ?? '')}${p.recurring ? ` <span>/ ${esc(p.interval ?? 'month')}</span>` : ''}`;
  const buyLabel = p => buyWord(source, sells(p));

  const updates = `<section class="updates" id="updates" aria-labelledby="updates-title"><h2 id="updates-title">Get updates</h2><p>New products, launches and offers from ${esc(biz.name)}, straight to your inbox.</p><form id="signup" novalidate><div class="fields"><label>Email <input name="email" type="email" required autocomplete="email" inputmode="email"></label><label>First name <input name="name" autocomplete="given-name" maxlength="80"></label><button class="buy" type="submit">Get updates</button></div><label class="consent"><input name="consent" type="checkbox" required> <span>${esc(consentText(biz))}</span></label><label class="hp" aria-hidden="true">Website <input name="website" tabindex="-1" autocomplete="off"></label><p class="error" role="alert" hidden></p></form><p class="said" role="status" hidden></p></section>`;
  const signupScript = `<script>(function(){var f=document.getElementById('signup'),said=document.querySelector('#updates .said'),err=f.querySelector('.error'),q=new URLSearchParams(location.search),n=document.getElementById('returned');if(q.get('paid')==='1'){n.textContent='Thank you: your payment went through. Your receipt is on its way to your email.';n.hidden=false}else if(q.get('canceled')==='1'){n.textContent='Checkout canceled. Nothing was charged.';n.hidden=false}
f.onsubmit=function(e){e.preventDefault();err.hidden=true;var el=f.elements,email=el.email.value.trim();if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){err.textContent='Please enter your email address.';err.hidden=false;return}if(!el.consent.checked){err.textContent='Please tick the box to agree to the emails.';err.hidden=false;return}var b=f.querySelector('button');b.disabled=true;
fetch('/api/signups',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:email,name:el.name.value.trim(),consent:true,website:el.website.value,page:location.href})}).then(function(r){if(!r.ok)throw r;f.hidden=true;said.textContent=${js(`You are on the list. Watch your inbox for news from ${biz.name}.`)};said.hidden=false}).catch(function(){b.disabled=false;err.innerHTML='That did not go through. Write to <a href="mailto:${contact}?subject=Updates&amp;body=Please%20send%20me%20updates.">${contact}</a> and we will add you.';err.hidden=false})}})()</script>`;

  const index = page({
    title: biz.name,
    path: '',
    wide: true,
    description: biz.tagline ?? biz.idea,
    body: `<div class="wrap"><p id="returned" class="note" hidden></p></div>${frontPage({ biz, source, active, images, sells, picture, priceLine, contact, contactText, updates })}`,
    script: signupScript,
  });

  const productPage = p => {
    const pics = images.get(p.id) ?? [];
    const gallery = `<div class="gallery" aria-label="Pictures of ${esc(p.name)}">${pics.length ? pics.map((img, i) => `<figure id="img-${i + 1}">${picture(img, pics.length > 1 ? `${p.name}, picture ${i + 1} of ${pics.length}` : p.name, { up: '../', sizes: '(min-width: 900px) 540px, 100vw', eager: i === 0 })}</figure>`).join('') : `<figure role="img" aria-label="${esc(p.name)}"><div class="ph" aria-hidden="true"><span>${esc((String(p.name).trim()[0] ?? '').toUpperCase())}</span></div></figure>`}</div>${pics.length > 1 ? `<nav class="thumbs" aria-label="Pictures">${pics.map((img, i) => `<a href="#img-${i + 1}" aria-label="Picture ${i + 1}">${picture(img, '', { up: '../', sizes: '64px' })}</a>`).join('')}</nav>` : ''}`;
    const how = sells(p) ? (p.goodKind === 'digital' ? 'A download: the link comes to your email as soon as you pay.' : 'Ships within the United States. You pay on Stripe\'s secure page.') : `Order by email: ${biz.email?.address ?? BRAND.support}. Nothing is charged on this site.`;
    const first = pics[0]?.files?.find(f => (f.w ?? 0) >= 960) ?? pics[0]?.files?.[0];
    return page({
      title: `${p.name} · ${biz.name}`,
      description: p.description ?? '',
      up: '../',
      path: `product/${encodeURIComponent(p.id)}.html`,
      og: first && home ? `<meta property="og:image" content="${esc(`${home}/images/${first.name}`)}">` : '',
      body: `<a class="crumb" href="../#products">← All products</a><article class="pp"><div>${gallery}</div><div><h1>${esc(p.name)}</h1><p class="price">${priceLine(p)}</p>${p.description ? `<p class="about">${esc(p.description)}</p>` : ''}<a class="buy" href="../checkout.html?p=${encodeURIComponent(p.id)}">${buyLabel(p)}</a><p class="fine">${esc(how)}</p><ul class="trust"><li>Questions? <a href="mailto:${contact}">${contact}</a></li><li><a href="../refunds.html">Refunds and returns</a></li></ul></div></article>`,
    });
  };

  const checkout = page({
    title: `Checkout · ${biz.name}`,
    nav: false,
    body: `<section class="checkout"><h1>Checkout</h1><p id="line">Loading…</p><div id="thumb" class="thumb" hidden></div>
<form id="pay" class="stack" novalidate hidden><p id="how"></p><label>Email <input name="email" type="email" required autocomplete="email" inputmode="email"></label><fieldset id="ship"><label>Name <input name="name" required autocomplete="name"></label><label>Address <input name="line1" required autocomplete="address-line1"></label><label>City <input name="city" required autocomplete="address-level2"></label><label>State <input name="region" required autocomplete="address-level1"></label><label>ZIP <input name="postal" required autocomplete="postal-code"></label></fieldset><button class="buy" type="submit">Continue to payment</button><p class="error" id="error" role="alert"></p></form>
<p id="by-mail" class="note" hidden><span id="by-mail-why"></span>Order by email: <a id="mail" href="mailto:${contact}">${contact}</a>. Nothing is charged here.</p></section>`,
    script: `<script>(function(){var API=${JSON.stringify(API)},p=new URLSearchParams(location.search).get('p'),line=document.getElementById('line'),form=document.getElementById('pay'),err=document.getElementById('error'),ship=document.getElementById('ship'),how=document.getElementById('how'),mail=document.getElementById('mail');
function post(path,body){return fetch(API+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok)throw j;return j})})}
var WHY={seller_payout_not_ready:'This shop is not taking card payment yet.',out_of_stock:'That is sold out.',zone_refused:'This shop does not ship there.',destination_sanctioned:'This shop cannot ship there.',account_required:'Downloads are ordered by email for now.',feature_off:'This shop takes orders by email for now.',email_required:'Please enter your email address.'};
function byMail(it,why){document.getElementById('by-mail-why').textContent=why?why+' ':'';document.getElementById('by-mail').hidden=false;if(it)mail.href='mailto:${contact}?subject='+encodeURIComponent('Order: '+it.name)}
fetch('products.json').then(function(r){return r.json()}).then(function(list){var it=list.find(function(x){return x.id===p});line.textContent=it?it.name+' · '+(it.priceLabel||''):'That product is not here.';if(!it)return;if(it.image){var t=document.getElementById('thumb');t.innerHTML='<img alt="" src="images/'+encodeURIComponent(it.image)+'">';t.hidden=false}
var digital=it.kind==='digital';if(!it.variantId){byMail(it);return}
form.hidden=false;ship.hidden=ship.disabled=digital;how.textContent=digital?${js(`A download: you pay on Stripe's secure page, and the link comes to this email. The money goes to ${biz.name}.`)}:${js(`Ships within the United States. You pay on Stripe's secure page; the money goes to ${biz.name}.`)};
form.onsubmit=function(e){e.preventDefault();err.textContent='';if(!form.checkValidity()){err.textContent='Please fill in every field.';return}var f=form.elements,b=form.querySelector('button');b.disabled=true;
var body={type:'cart',email:f.email.value.trim()};if(!digital)body.shippingAddress={name:f.name.value,line1:f.line1.value,city:f.city.value,region:f.region.value,postal:f.postal.value,country:'US'};
post('/commerce/cart',{}).then(function(cart){body.cartId=cart.id;return post('/commerce/cart/'+encodeURIComponent(cart.id)+'/items',{variantId:it.variantId,qty:1})}).then(function(){return post('/billing/checkout',body)}).then(function(r){location.href=r.url}).catch(function(e){b.disabled=false;var code=e&&e.error;if(code==='account_required'||code==='seller_payout_not_ready'||code==='feature_off'){form.hidden=true;byMail(it,WHY[code]);return}err.textContent=(code&&WHY[code])||'The checkout did not open'+(code?' ('+code+')':'')+'. Please try again, or order by email.';byMail(it)})}}).catch(function(){line.textContent='Could not load the product.'})})()</script>`,
  });

  const files = {
    'index.html': index,
    'style.css': css,
    'checkout.html': checkout,
    'terms.html': legalPage(biz, 'terms', legal.terms, page),
    'privacy.html': legalPage(biz, 'privacy', legal.privacy, page),
    'refunds.html': legalPage(biz, 'refunds', legal.refunds, page),
    'products.json': JSON.stringify(active.map(p => {
      const first = images.get(p.id)?.[0]?.files?.find(f => (f.w ?? 0) === 480) ?? images.get(p.id)?.[0]?.files?.[0];
      return { id: p.id, name: p.name, description: p.description ?? '', priceLabel: p.priceLabel ?? '', recurring: !!p.recurring, interval: p.interval ?? null, kind: p.goodKind === 'digital' || p.type === 'digital' ? 'digital' : 'physical', ...(first ? { image: first.name } : {}), ...(sells(p) ? { variantId: p.variantId } : {}) };
    }), null, 2) + '\n',
    'logo.svg': markSvg(biz.name, biz.brand),
    'app.mjs': serverModule(biz),
  };
  for (const p of active) files[`product/${p.id}.html`] = productPage(p);
  return files;
}

// ---------- terms, privacy, refunds ----------

const TITLES = { terms: 'Terms of sale', privacy: 'Privacy', refunds: 'Refunds and returns' };
/** The business's own page (legal/<name>.html in its folder) when it has one, else the default below. */
function legalPage(biz, name, own, page) {
  const title = `${TITLES[name]} · ${biz.name}`;
  if (own && /<html[\s>]/i.test(own)) return own;
  if (own) return page({ title, path: `${name}.html`, body: `<article class="legal">${own}</article>` });
  return page({ title, path: `${name}.html`, body: `<article class="legal"><h1>${TITLES[name]}</h1>${DEFAULTS[name](biz)}</article>` });
}

const DEFAULTS = {
  terms: biz => {
    const n = esc(biz.name), mail = esc(biz.email?.address ?? BRAND.support);
    return `<p class="updated">Effective ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
<p>These terms cover what you buy from ${n} on this site. Placing an order means you accept them.</p>
<h2>Orders and payment</h2><p>Prices are in US dollars. You pay on Stripe's secure checkout page; card payments are processed through CommandAGI, which may appear on your receipt and card statement. An order is confirmed when you receive the receipt by email. We may cancel an order we cannot fulfil, and refund it in full.</p>
<h2>Physical products</h2><p>We ship within the United States. Delivery estimates are estimates; we tell you by email if an order is delayed. The risk of loss passes to you on delivery.</p>
<h2>Digital products</h2><p>A download link is sent to the email address you give at checkout, as soon as the payment clears. You may use what you buy for yourself; you may not resell or redistribute it.</p>
<h2>Subscriptions</h2><p>A recurring product renews at the interval shown until you cancel. Write to us to cancel; the cancellation takes effect at the end of the period you paid for.</p>
<h2>Refunds</h2><p>See <a href="refunds.html">Refunds and returns</a>.</p>
<h2>Liability</h2><p>Products are provided as described. To the extent the law allows, our liability for any order is limited to the amount you paid for it.</p>
<h2>Contact</h2><p>${n} · <a href="mailto:${mail}">${mail}</a></p>`;
  },
  privacy: biz => {
    const n = esc(biz.name), mail = esc(biz.email?.address ?? BRAND.support);
    return `<p class="updated">Effective ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
<p>${n} collects only what it needs to sell to you and keep you informed, and never sells your data.</p>
<h2>What we collect</h2><ul><li>When you order: your email address, and for a shipped product your name and address. Card details go to Stripe and never reach us.</li><li>When you ask for updates: your email address, your first name if you give it, and when and where you agreed.</li><li>When you write to us: your message and your address.</li></ul>
<h2>Why</h2><p>To fulfil and support your order, to send the updates you asked for, and to answer you. We send marketing email only to people who asked for it.</p>
<h2>Who helps us</h2><p>Stripe processes payments. CommandAGI hosts this site, our email and our records. Each handles your data only to provide its service.</p>
<h2>How long</h2><p>Order records are kept as long as tax and accounting law require. Your sign-up is kept until you ask us to stop.</p>
<h2>Your choices</h2><p>Write to <a href="mailto:${mail}">${mail}</a> to stop the updates, or to see, correct or delete what we hold about you. We answer within 30 days.</p>`;
  },
  refunds: biz => {
    const mail = esc(biz.email?.address ?? BRAND.support);
    return `<p class="updated">Effective ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
<h2>Physical products</h2><p>Return an unused item within 30 days of delivery for a full refund of its price. Write to <a href="mailto:${mail}">${mail}</a> first and we will tell you where to send it. If an item arrives damaged or wrong, we replace it or refund it, including shipping.</p>
<h2>Digital products</h2><p>You can have a full refund until you download the file. After a download, write to us if the file is faulty or not as described, and we will fix it or refund you.</p>
<h2>Subscriptions</h2><p>Cancel at any time; you keep access until the end of the period you paid for.</p>
<h2>How refunds are paid</h2><p>Refunds go back to the card you paid with. Your bank may take 5 to 10 business days to show them.</p>`;
  },
};

// ---------- the server module: sign-ups ----------

/**
 * The storefront's `app.mjs`. Site hosting runs it for every path no file answers. It keeps the "Get updates" sign-ups
 * in the site's own KV (`env.KV`, a managed resource): a site's Worker cannot reach the platform's API, so nothing here
 * writes to the business's Drive. The founder's console reads them with `SIGNUPS_READ_KEY`, a plain env var of the site
 * that only the site's owner can read (`GET /sites/:id/env`), and copies them into contacts/ (one vCard each).
 */
export function serverModule(biz) {
  return `// ${biz.name}'s storefront server module, written by ${BRAND.name} (lib/storefront.js). It answers /api/signups:
// POST records a visitor who asked for updates (with their consent, the words below); GET and DELETE are the founder's,
// with the site's SIGNUPS_READ_KEY. The sign-ups live in the site's KV, one key per address.
const CONSENT = ${JSON.stringify(consentText(biz))};
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS', 'access-control-max-age': '600' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
const isEmail = s => s.length <= 254 && /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(s);
async function same(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc.encode(String(s)))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0; for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}
async function signups(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (!env.KV) return json({ error: 'signups_not_ready' }, 503);
  if (request.method === 'POST') {
    const text = await request.text();
    if (text.length > 4096) return json({ error: 'too_large' }, 413);
    let b; try { b = JSON.parse(text); } catch { return json({ error: 'invalid_json' }, 400); }
    if (!b || typeof b !== 'object') return json({ error: 'invalid_json' }, 400);
    if (b.website) return json({ ok: true });
    const email = String(b.email ?? '').trim().toLowerCase();
    if (!isEmail(email)) return json({ error: 'invalid_email' }, 400);
    if (b.consent !== true) return json({ error: 'consent_required' }, 400);
    const key = 'signup:' + email;
    const had = await env.KV.getWithMetadata(key);
    const now = Date.now();
    const record = { email, name: String(b.name ?? '').trim().slice(0, 80), at: had?.metadata?.at ?? now, consent: { text: CONSENT, at: now, page: String(b.page ?? '').slice(0, 200) }, country: request.cf?.country ?? null };
    await env.KV.put(key, JSON.stringify(record), { metadata: record });
    return json({ ok: true, created: !had?.value });
  }
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\\s+/i, '');
  if (!env.SIGNUPS_READ_KEY || !token || !(await same(token, env.SIGNUPS_READ_KEY))) return json({ error: 'unauthorized' }, 401);
  if (request.method === 'DELETE') {
    const email = String(new URL(request.url).searchParams.get('email') ?? '').trim().toLowerCase();
    if (!email) return json({ error: 'email_required' }, 400);
    await env.KV.delete('signup:' + email);
    return json({ ok: true });
  }
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const out = [];
  let cursor;
  for (let i = 0; i < 20; i++) {
    const page = await env.KV.list({ prefix: 'signup:', cursor });
    for (const k of page.keys) out.push(k.metadata ?? JSON.parse((await env.KV.get(k.name)) ?? 'null'));
    if (page.list_complete) break;
    cursor = page.cursor;
  }
  return json({ signups: out.filter(Boolean) });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/signups') return signups(request, env);
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};
`;
}

/**
 * The sign-ups' storage: the site's KV and its read key. Each takes effect at the next deploy. Made once; a failure is
 * recorded on the record (`biz.site.signups.why`) and tried again a day later. Answers whether the record changed.
 */
export async function ensureSignups(biz) {
  if (!biz.site?.id) return false;
  const s = biz.site.signups;
  if (s?.ready || (s?.at && Date.now() - s.at < 86400e3)) return false;
  try {
    await sites.resources.add(biz.site.id, 'kv').catch(e => { if (e?.status !== 409) throw e; });
    const env = await sites.env.list(biz.site.id);
    if (!env.some(v => v.key === 'SIGNUPS_READ_KEY')) {
      const key = [...crypto.getRandomValues(new Uint8Array(24))].map(x => x.toString(16).padStart(2, '0')).join('');
      await sites.env.set(biz.site.id, 'SIGNUPS_READ_KEY', key, { secret: false });
    }
    biz.site.signups = { ready: true, at: Date.now() };
  } catch (e) {
    biz.site.signups = { ready: false, at: Date.now(), why: e?.message ?? String(e) };
  }
  return true;
}

/** The storefront's sign-ups, newest first: { signups, why } (`why` says why there are none to read). */
export async function readSignups(biz) {
  const base = biz.site?.url?.replace(/\/+$/, '');
  if (!biz.site?.id || !base) return { signups: [], why: 'No storefront yet.' };
  if (!biz.site.signups?.ready) return { signups: [], why: biz.site.signups?.why ?? 'The sign-up form is set up at the next publish.' };
  const key = (await sites.env.list(biz.site.id).catch(() => [])).find(v => v.key === 'SIGNUPS_READ_KEY' && !v.isSecret)?.value;
  if (!key) return { signups: [], why: 'The storefront has no read key for its sign-ups yet; publishing it again makes one.' };
  const r = await fetch(`${base}/api/signups`, { headers: { authorization: `Bearer ${key}` }, cache: 'no-store' }).catch(() => null);
  if (!r) return { signups: [], why: 'The storefront did not answer.' };
  const body = await r.json().catch(() => ({}));
  if (!r.ok) return { signups: [], why: body.error === 'signups_not_ready' ? 'The sign-up storage is ready at the next publish.' : `The storefront answered ${r.status}${body.error ? ` (${body.error})` : ''}.` };
  return { signups: (body.signups ?? []).sort((a, b) => (b.at ?? 0) - (a.at ?? 0)), why: null };
}

// ---------- pictures ----------

const hash8 = s => { let h = 0x811c9dc5; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
const IMAGE = /\.(png|jpe?g|webp|gif|avif|svg)$/i;
export const isImage = f => IMAGE.test(f?.name ?? f ?? '') || /^image\//.test(f?.contentType ?? '');

/** One picture's sizes for the web: WebP at each width up to its own (JPEG where the browser cannot write WebP). */
async function renderPicture(biz, folder, img, base) {
  const drive = bizDrive(biz);
  const blob = await drive.readBlobPath(img.path);
  if (!blob) throw new Error(`${img.path} is not in the business's Drive.`);
  if (/svg/.test(blob.type) || /\.svg$/i.test(img.path)) {
    const name = `${base}.svg`;
    await drive.write(`${folder}/images`, name, blob, 'image/svg+xml');
    return { base, files: [{ name, w: null }], width: null, height: null };
  }
  const bitmap = await createImageBitmap(blob);
  const widths = WIDTHS.filter(w => w <= bitmap.width);
  if (!widths.length) widths.push(bitmap.width);
  const files = [];
  for (const w of widths) {
    const h = Math.round(bitmap.height * w / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    let out = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.82));
    let ext = 'webp';
    if (!out || out.type !== 'image/webp') { out = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85)); ext = 'jpg'; }
    const name = `${base}-${w}.${ext}`;
    await drive.write(`${folder}/images`, name, out, out.type);
    files.push({ name, w });
  }
  const made = { base, files, width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  return made;
}

/**
 * Each active product's pictures in the site folder's images/, made once per picture (the product's `images[].made`
 * names the files) and again only when a file is missing. Answers { images: Map(product id → made), changed }.
 */
export async function storefrontImages(biz, products) {
  const folder = biz.site.folder, drive = bizDrive(biz);
  const want = products.filter(p => p.status === 'active').flatMap(p => (p.images ?? []).filter(i => i?.path).map(img => ({ p, img, base: `${p.id}-${hash8(img.path)}` })));
  const images = new Map();
  if (!want.length) return { images, changed: false };
  await drive.mkdir(folder, 'images').catch(() => null);
  const have = new Set((await drive.list(`${folder}/images`).catch(() => [])).map(f => f.name));
  let changed = false;
  await Promise.all(want.map(async w => {
    if (!(w.img.made?.base === w.base && w.img.made.files?.every(f => have.has(f.name)))) {
      try { w.img.made = await renderPicture(biz, folder, w.img, w.base); changed = true; } catch (e) { w.img.made = null; w.img.why = e?.message ?? String(e); changed = true; }
    }
  }));
  for (const p of products) images.set(p.id, (p.images ?? []).map(i => i?.made).filter(Boolean));
  return { images, changed };
}

// ---------- the brand address: <site slug>.vibestartup.pro ----------

/**
 * The site's VibeStartup address as CommandAGI names it (`site.brandUrl`: a site made through VibeStartup's sign-in,
 * on production), copied onto the business record. VibeStartup's edge serves it (edge/subdomains.js); nothing here
 * adds a domain or waits on DNS. Answers whether the record changed.
 */
export async function syncBrandUrl(biz, site = null) {
  if (!biz.site?.id) return false;
  const s = site ?? (await sites.get(biz.site.id).catch(() => null))?.site;
  if (!s) return false;
  const was = biz.site.brandUrl ?? null;
  biz.site.brandUrl = s.brandUrl ?? null;
  return biz.site.brandUrl !== was;
}

// ---------- the source: storefront.json ----------

/** The business's `storefront.json` (its template, its style, its words), or null when it has none yet. */
export const readStorefront = biz => readBizJson(biz, 'storefront.json', null);
export async function writeStorefront(biz, doc) { await writeBizJson(biz, 'storefront.json', doc); return doc; }

/**
 * Publish when the live site is not what `storefront.json` says: the co-founder changed the file, or the business
 * has no file yet (it gets the default for its kind). The console calls it when a business opens. Answers whether it
 * published.
 */
export async function publishIfEdited(biz) {
  if (!biz.site?.id || !biz.site?.folder) return false;
  const saved = await readStorefront(biz);
  if (saved && biz.site.storefront?.mark === sourceMark(saved)) return false;
  await publishStorefront(biz);
  return true;
}

/**
 * The front page as one document for a preview frame in the console: the stylesheet inline, pictures read from the
 * live storefront, no script, and nothing in it can be pressed. `doc` is the storefront.json to show.
 */
export function storefrontPreview(biz, products, doc) {
  const images = new Map(products.map(p => [p.id, (p.images ?? []).map(i => i?.made).filter(Boolean)]));
  const files = storefrontFiles(biz, products, { storefront: doc, images, store: biz.site?.checkout?.store ?? null, guestDigital: biz.site?.checkout?.guestDigital === true });
  const home = storefrontUrl(biz);
  return files['index.html']
    .replace(/<script>[\s\S]*?<\/script>/g, '')
    .replace('<link rel="stylesheet" href="style.css">', `${home ? `<base href="${esc(home)}/">` : ''}<style>${files['style.css']}a,button,input,summary{pointer-events:none}.bar{position:static}</style>`)
    .replace('href="logo.svg" type="image/svg+xml"', `href="data:image/svg+xml,${encodeURIComponent(files['logo.svg'])}" type="image/svg+xml"`)
    .replaceAll('src="logo.svg"', `src="data:image/svg+xml,${encodeURIComponent(files['logo.svg'])}"`);
}

// ---------- publishing ----------

/** The business's own legal pages (legal/terms.html, privacy.html, refunds.html in its folder), or null for each. */
async function ownLegal(biz) {
  const read = name => bizDrive(biz).readPath('legal', `${name}.html`).catch(() => null);
  const [terms, privacy, refunds] = await Promise.all([read('terms'), read('privacy'), read('refunds')]);
  return { terms, privacy, refunds };
}

/** Write a path of the site folder (`product/x.html` goes into product/). */
const writeSiteFile = (drive, folder, path, content) => {
  const at = path.lastIndexOf('/');
  return at < 0 ? drive.write(folder, path, content) : drive.write(`${folder}/${path.slice(0, at)}`, path.slice(at + 1), content);
};

/**
 * Write the storefront's files into the site's folder and deploy it to production: the pictures first (made in this
 * browser), the business's legal pages or the defaults, a page per product, the sign-ups' storage, the brand address
 * (the site's `brandUrl`, which the pages' canonical links name), then the deploy.
 * A product page whose product is no longer active is removed.
 */
export async function publishStorefront(biz) {
  if (!biz.site?.id || !biz.site?.folder) throw new Error(biz.gaps?.find(g => g.what === 'site')?.why ?? 'The storefront was not created, so there is nothing to publish.');
  const folder = biz.site.folder, drive = bizDrive(biz);
  const products = (await readBizJson(biz, 'products/products.json', { products: [] })).products ?? [];
  const liveDigital = products.find(p => p.status === 'active' && p.goodKind === 'digital' && p.goodStatus === 'active' && p.variantId);
  const [{ images, changed }, legal, can, saved] = await Promise.all([
    storefrontImages(biz, products),
    ownLegal(biz),
    guestCheckout(liveDigital?.variantId),
    readStorefront(biz),
    ensureSignups(biz),
    syncBrandUrl(biz).catch(() => false),
  ]);
  if (changed) await writeBizJson(biz, 'products/products.json', { products });
  // A business with no choice saved gets the default for its kind, written down so it can be changed.
  const storefront = saved ?? await writeStorefront(biz, newStorefrontSource(biz, products));
  const files = storefrontFiles(biz, products, { storefront, images, legal, store: can.store, guestDigital: can.guestDigital === true });
  if (Object.keys(files).some(p => p.startsWith('product/'))) await drive.mkdir(folder, 'product').catch(() => null);
  // Each file is its own upsert, so they go together: one at a time took about a minute on production.
  await Promise.all(Object.entries(files).map(([path, content]) => writeSiteFile(drive, folder, path, content)));
  const stale = (await drive.list(`${folder}/product`).catch(() => [])).filter(f => !files[`product/${f.name}`]);
  await Promise.all(stale.map(f => drive.remove(f.id).catch(() => null)));
  const deploy = await sites.deployFolder(biz.site.id, 'production');
  biz.site.lastDeploy = { at: Date.now(), id: deploy?.deployment?.id ?? deploy?.id ?? null };
  biz.site.checkout = { ...can, at: Date.now() };
  const shown = readStorefrontSource(storefront, biz, products);
  biz.site.storefront = { template: shown.template, style: shown.style, mark: sourceMark(storefront) };
  await writeBusiness(biz);
  return deploy;
}
