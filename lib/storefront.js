// The storefront: the files VibeStartup writes into a business's site folder, and the publish that deploys them
// (docs/ARCHITECTURE.md § the storefront). It is a static site on CommandAGI's site hosting with one small server module
// (`app.mjs`) for the "Get updates" sign-ups. Everything runs in the founder's browser with the founder's own token.
//
//   index.html            the shop: hero, products (pictures, price, buy), get updates, footer
//   product/<id>.html     one page per active product: gallery, description, price, buy
//   checkout.html         a guest cart and the one cart checkout (Stripe's page), or "order by email"
//   terms.html privacy.html refunds.html
//                         the business's own (legal/*.html in its folder) when it has them, else the defaults here
//   images/               each product picture at 480, 960 and 1600 px (WebP), made in the browser from the original
//   products.json         what checkout.html reads
//   app.mjs               the sign-ups: POST /api/signups (a visitor, with consent), GET /api/signups (the founder)
//   style.css logo.svg
import { api, drive, sites, BRAND, API } from './api.js';
import { folderOf, readBizJson, writeBizJson, writeBusiness, markSvg } from './business.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** A value written into an inline script: JSON, with `<` escaped so no text closes the script. */
const js = v => JSON.stringify(v).replace(/</g, '\\u003c');

/** The words a visitor agrees to when they ask for updates. The server module records these, not the page's. */
export const consentText = biz => `Email me news and offers from ${biz.name}. I can stop them at any time.`;

/** Where the storefront answers: the brand address once it serves, else the site's own address. */
export const storefrontUrl = biz => (biz.site?.brandDomain?.status === 'active' ? `https://${biz.site.brandDomain.hostname}` : biz.site?.url ?? '').replace(/\/+$/, '');

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
function picture(img, alt, { up = '', sizes = '(min-width: 600px) 33vw, 100vw', eager = false } = {}) {
  if (!img?.files?.length) return '';
  const files = [...img.files].sort((a, b) => (a.w ?? 0) - (b.w ?? 0));
  const mid = files.find(f => (f.w ?? 0) >= 960) ?? files[files.length - 1];
  const srcset = files.filter(f => f.w).map(f => `${up}images/${esc(f.name)} ${f.w}w`).join(', ');
  const dims = img.width && img.height ? ` width="${img.width}" height="${img.height}"` : '';
  return `<img src="${up}images/${esc(mid.name)}"${srcset ? ` srcset="${srcset}" sizes="${esc(sizes)}"` : ''} alt="${esc(alt)}"${dims} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

/**
 * The storefront's files, by path in the site folder. `opts`: `images` (product id → pictures made by
 * `storefrontImages`), `legal` ({ terms, privacy, refunds }: the business's own pages, HTML), `store` and
 * `guestDigital` (what a guest can buy through the checkout, `guestCheckout`). The business's colours on VibeStartup's shapes: square, hairlines,
 * phone first (48 px targets, one column of products until 600 px), docs/DESIGN.md § the storefront.
 */
export function storefrontFiles(biz, products = [], opts = {}) {
  const b = biz.brand;
  const images = opts.images ?? new Map();
  const legal = opts.legal ?? {};
  const active = products.filter(p => p.status === 'active');
  const sells = p => sellable(p, opts);
  const contact = esc(biz.email?.address ?? BRAND.support);
  const year = new Date().getFullYear();
  const css = `:root{--p:${b.primary};--s:${b.secondary};--a:${b.accent};--g:${b.ground};--i:${b.ink};--line:color-mix(in srgb,var(--i) 14%,transparent);--card:color-mix(in srgb,var(--g) 92%,#fff)}*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;font-family:"Instrument Sans",system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;background:var(--g);color:var(--i);line-height:1.5;-webkit-font-smoothing:antialiased}a{color:inherit}img{max-width:100%;display:block}:focus-visible{outline:2px solid var(--p);outline-offset:2px}.bar{position:sticky;top:0;z-index:5;display:flex;align-items:stretch;min-height:56px;padding:0 16px;background:var(--g);border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:10px;min-height:56px;font-weight:700;text-decoration:none;color:inherit;min-width:0}.brand img{width:28px;height:28px;flex:none}.brand span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bar nav{margin-left:auto;display:flex}.bar nav a{display:flex;align-items:center;min-height:56px;padding:0 12px;font-size:15px;font-weight:500;text-decoration:none}.bar nav a:hover{background:color-mix(in srgb,var(--i) 6%,transparent)}.wrap{width:min(100% - 32px,1040px);margin:0 auto}main>p{max-width:64ch}.hero{padding:40px 0 24px}.hero h1{font-size:clamp(30px,7vw,56px);margin:0 0 12px;letter-spacing:-.025em;line-height:1.08;text-wrap:balance}.hero p{font-size:17px;opacity:.8;max-width:56ch;margin:0}.products{display:grid;grid-template-columns:1fr;gap:16px;padding:24px 0 48px}.product{position:relative;display:grid;grid-template-rows:auto 1fr;border:1px solid var(--line);background:var(--card)}.media{aspect-ratio:4/3;overflow:hidden;background:linear-gradient(135deg,var(--p),var(--s))}.media img{width:100%;height:100%;object-fit:cover}.info{padding:16px;display:flex;flex-direction:column;gap:8px}.info h2{margin:0;font-size:18px;letter-spacing:-.01em}.info h2 a{text-decoration:none}.info h2 a::after{content:"";position:absolute;inset:0}.info p{margin:0}.info .desc{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.price{font-weight:700;font-variant-numeric:tabular-nums}.price span{font-weight:500;opacity:.75}.buy{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;min-height:48px;padding:0 20px;margin-top:auto;background:var(--p);color:#fff;text-decoration:none;font-weight:600;border:0;cursor:pointer;font:inherit;font-weight:600}.buy:hover{filter:brightness(.92)}.buy:disabled{opacity:.6}.quiet{background:transparent;color:inherit;border:1px solid color-mix(in srgb,var(--i) 28%,transparent)}.empty{padding:32px 0;opacity:.75}footer{padding:32px 0;border-top:1px solid var(--line);font-size:14px}footer .wrap{display:flex;flex-wrap:wrap;gap:4px 16px;opacity:.85}footer a{text-decoration:none}footer a:hover{text-decoration:underline}.stack{display:grid;gap:14px;max-width:440px;margin-top:24px}.stack p{margin:0;font-size:15px}.stack label,.updates label{display:grid;gap:4px;font-weight:600;font-size:14px}.stack fieldset{border:0;padding:0;margin:0;display:grid;gap:14px}.stack fieldset[hidden]{display:none}input{font:inherit;font-size:16px;min-height:48px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--i) 28%,transparent);border-radius:0;background:#fff;color:#17161a;width:100%}input:focus{outline:none;border-color:var(--p);box-shadow:0 0 0 3px color-mix(in srgb,var(--p) 20%,transparent)}.stack .buy{width:100%}.error{color:#b91c1c;margin:0}.note{margin:24px 0 0;padding:12px 16px;border:1px solid var(--line);box-shadow:inset 3px 0 0 var(--p);background:color-mix(in srgb,var(--p) 8%,var(--g))}.updates{margin:0 0 48px;padding:24px 16px;border:1px solid var(--line);background:var(--card)}.updates h2{margin:0 0 4px;font-size:22px;letter-spacing:-.01em}.updates>p{margin:0 0 16px;opacity:.8}.updates form{display:grid;gap:12px}.updates .row{display:grid;gap:8px}.updates .consent{display:flex;gap:10px;align-items:flex-start;font-weight:400;font-size:14px}.updates .consent input{width:20px;min-height:20px;height:20px;margin:2px 0 0;flex:none;accent-color:var(--p)}.updates .said{margin:0;font-weight:600}.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}.crumb{display:inline-flex;align-items:center;min-height:48px;font-size:15px;text-decoration:none;opacity:.8}.crumb:hover{opacity:1;text-decoration:underline}.pp{display:grid;gap:24px;padding:8px 0 48px}.gallery{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;border:1px solid var(--line)}.gallery figure:empty{background:linear-gradient(135deg,var(--p),var(--s))}.gallery::-webkit-scrollbar{display:none}.gallery figure{margin:0;flex:0 0 100%;scroll-snap-align:start;aspect-ratio:1}.gallery img{width:100%;height:100%;object-fit:cover}.thumbs{display:flex;gap:8px;margin-top:8px;overflow-x:auto}.thumbs a{flex:0 0 64px;height:64px;border:1px solid var(--line);overflow:hidden}.thumbs img{width:100%;height:100%;object-fit:cover}.pp h1{font-size:clamp(28px,6vw,44px);margin:0 0 8px;letter-spacing:-.025em;line-height:1.1;text-wrap:balance}.pp .price{font-size:22px;margin:0 0 16px}.pp .about{white-space:pre-line;margin:0 0 24px;max-width:60ch}.pp .buy{max-width:440px}.pp .fine{font-size:14px;opacity:.75;margin:12px 0 0;max-width:440px}.legal h2{font-size:20px;margin:28px 0 8px;letter-spacing:-.01em}.legal p,.legal li{max-width:68ch}.legal .updated{opacity:.7;font-size:14px}.thumb{display:flex;gap:12px;align-items:center;margin:16px 0 0}.thumb img{width:72px;height:72px;object-fit:cover;border:1px solid var(--line)}@media(min-width:600px){.bar{padding:0 24px}.hero{padding:64px 0 32px}.hero p{font-size:18px}.products{grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px}.updates{padding:32px}.updates .row{grid-template-columns:1fr 1fr auto}.updates .row .buy{margin:0;align-self:end}}@media(min-width:900px){.pp{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:48px;padding-top:16px}}@media(prefers-reduced-motion:no-preference){.gallery{scroll-behavior:smooth}}`;

  // One page shell: the bar, the content, the footer. `up` is '../' for a page in product/.
  const page = ({ title, description = '', body, up = '', nav = true, script = '', og = '' }) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${description ? `<meta name="description" content="${esc(description)}"><meta property="og:description" content="${esc(description)}">` : ''}<meta property="og:title" content="${esc(title)}">${og}<link rel="icon" href="${up}logo.svg" type="image/svg+xml"><link rel="stylesheet" href="${up}style.css"></head><body><header class="bar"><a class="brand" href="${up || './'}"><img src="${up}logo.svg" alt=""><span>${esc(biz.name)}</span></a>${nav ? `<nav><a href="${up}#products">Shop</a><a href="mailto:${contact}">Contact</a></nav>` : ''}</header><main class="wrap">${body}</main><footer><div class="wrap"><span>© ${year} ${esc(biz.name)}</span><a href="${up}terms.html">Terms</a><a href="${up}privacy.html">Privacy</a><a href="${up}refunds.html">Refunds</a><a href="mailto:${contact}">${contact}</a><span>Built with ${esc(BRAND.name)}</span></div></footer>${script}</body></html>`;

  const priceLine = p => `${esc(p.priceLabel ?? '')}${p.recurring ? ` <span>/ ${esc(p.interval ?? 'month')}</span>` : ''}`;
  const buyLabel = p => sells(p) ? 'Buy' : 'Order';
  const productCard = (p, i) => `<article class="product"><div class="media">${picture(images.get(p.id)?.[0], p.name, { eager: i === 0 })}</div><div class="info"><h2><a href="product/${encodeURIComponent(p.id)}.html">${esc(p.name)}</a></h2>${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}<p class="price">${priceLine(p)}</p><a class="buy" href="checkout.html?p=${encodeURIComponent(p.id)}">${buyLabel(p)}</a></div></article>`;

  const updates = `<section class="updates" id="updates" aria-labelledby="updates-title"><h2 id="updates-title">Get updates</h2><p>New products, launches and offers from ${esc(biz.name)}, straight to your inbox.</p><form id="signup" novalidate><div class="row"><label>Email <input name="email" type="email" required autocomplete="email" inputmode="email"></label><label>First name <input name="name" autocomplete="given-name" maxlength="80"></label><button class="buy" type="submit">Get updates</button></div><label class="consent"><input name="consent" type="checkbox" required> <span>${esc(consentText(biz))}</span></label><label class="hp" aria-hidden="true">Website <input name="website" tabindex="-1" autocomplete="off"></label><p class="error" role="alert" hidden></p></form><p class="said" role="status" hidden></p></section>`;
  const signupScript = `<script>(function(){var f=document.getElementById('signup'),said=document.querySelector('#updates .said'),err=f.querySelector('.error'),q=new URLSearchParams(location.search),n=document.getElementById('returned');if(q.get('paid')==='1'){n.textContent='Thank you: your payment went through. Your receipt is on its way to your email.';n.hidden=false}else if(q.get('canceled')==='1'){n.textContent='Checkout canceled. Nothing was charged.';n.hidden=false}
f.onsubmit=function(e){e.preventDefault();err.hidden=true;var el=f.elements,email=el.email.value.trim();if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){err.textContent='Please enter your email address.';err.hidden=false;return}if(!el.consent.checked){err.textContent='Please tick the box to agree to the emails.';err.hidden=false;return}var b=f.querySelector('button');b.disabled=true;
fetch('/api/signups',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:email,name:el.name.value.trim(),consent:true,website:el.website.value,page:location.href})}).then(function(r){if(!r.ok)throw r;f.hidden=true;said.textContent=${js(`You are on the list. Watch your inbox for news from ${biz.name}.`)};said.hidden=false}).catch(function(){b.disabled=false;err.innerHTML='That did not go through. Write to <a href="mailto:${contact}?subject=Updates&amp;body=Please%20send%20me%20updates.">${contact}</a> and we will add you.';err.hidden=false})}})()</script>`;

  const index = page({
    title: biz.name,
    description: biz.tagline ?? biz.idea,
    body: `<p id="returned" class="note" hidden></p><section class="hero"><h1>${esc(biz.tagline ?? biz.name)}</h1><p>${esc(biz.idea)}</p></section><section id="products" class="products" aria-label="Products">${active.length ? active.map(productCard).join('') : `<p class="empty">Products are on their way. Ask for updates below to hear first.</p>`}</section>${updates}`,
    script: signupScript,
  });

  const productPage = p => {
    const pics = images.get(p.id) ?? [];
    const gallery = `<div class="gallery" aria-label="Pictures of ${esc(p.name)}">${pics.length ? pics.map((img, i) => `<figure id="img-${i + 1}">${picture(img, pics.length > 1 ? `${p.name}, picture ${i + 1} of ${pics.length}` : p.name, { up: '../', sizes: '(min-width: 900px) 540px, 100vw', eager: i === 0 })}</figure>`).join('') : '<figure role="img" aria-label="' + esc(p.name) + '"></figure>'}</div>${pics.length > 1 ? `<nav class="thumbs" aria-label="Pictures">${pics.map((img, i) => `<a href="#img-${i + 1}" aria-label="Picture ${i + 1}">${picture(img, '', { up: '../', sizes: '64px' })}</a>`).join('')}</nav>` : ''}`;
    const how = sells(p) ? (p.goodKind === 'digital' ? 'A download: the link comes to your email as soon as you pay.' : 'Ships within the United States. You pay on Stripe\'s secure page.') : `Order by email: ${biz.email?.address ?? BRAND.support}. Nothing is charged on this site.`;
    const first = pics[0]?.files?.find(f => (f.w ?? 0) >= 960) ?? pics[0]?.files?.[0];
    return page({
      title: `${p.name} · ${biz.name}`,
      description: p.description ?? '',
      up: '../',
      og: first && storefrontUrl(biz) ? `<meta property="og:image" content="${esc(`${storefrontUrl(biz)}/images/${first.name}`)}">` : '',
      body: `<a class="crumb" href="../#products">← All products</a><article class="pp"><div>${gallery}</div><div><h1>${esc(p.name)}</h1><p class="price">${priceLine(p)}</p>${p.description ? `<p class="about">${esc(p.description)}</p>` : ''}<a class="buy" href="../checkout.html?p=${encodeURIComponent(p.id)}">${buyLabel(p)}</a><p class="fine">${esc(how)}</p></div></article>`,
    });
  };

  const checkout = page({
    title: `Checkout · ${biz.name}`,
    nav: false,
    body: `<section class="hero"><h1>Checkout</h1><p id="line">Loading…</p><div id="thumb" class="thumb" hidden></div>
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
  if (own) return page({ title, body: `<article class="legal">${own}</article>` });
  return page({ title, body: `<article class="legal"><section class="hero"><h1>${TITLES[name]}</h1></section>${DEFAULTS[name](biz)}</article>` });
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
 * writes to the founder's Drive. The founder's console reads them with `SIGNUPS_READ_KEY`, a plain env var of the site
 * that only the site's owner can read (`GET /sites/:id/env`), and copies them into customers/customers.json.
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
async function renderPicture(folder, img, base) {
  const blob = await drive.readBlobPath(img.path);
  if (!blob) throw new Error(`${img.path} is not in your Drive.`);
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
  const folder = biz.site.folder;
  const want = products.filter(p => p.status === 'active').flatMap(p => (p.images ?? []).filter(i => i?.path).map(img => ({ p, img, base: `${p.id}-${hash8(img.path)}` })));
  const images = new Map();
  if (!want.length) return { images, changed: false };
  await drive.mkdir(folder, 'images').catch(() => null);
  const have = new Set((await drive.list(`${folder}/images`).catch(() => [])).map(f => f.name));
  let changed = false;
  await Promise.all(want.map(async w => {
    if (!(w.img.made?.base === w.base && w.img.made.files?.every(f => have.has(f.name)))) {
      try { w.img.made = await renderPicture(folder, w.img, w.base); changed = true; } catch (e) { w.img.made = null; w.img.why = e?.message ?? String(e); changed = true; }
    }
  }));
  for (const p of products) images.set(p.id, (p.images ?? []).map(i => i?.made).filter(Boolean));
  return { images, changed };
}

// ---------- the brand address: <site slug>.vibestartup.pro ----------

/** VibeStartup's zone, and the labels in it that are VibeStartup's own (each has a record of its own there). */
export const BRAND_ZONE = 'vibestartup.pro';
const RESERVED = new Set(['www', 'mail', 'email', 'send', 'smtp', 'imap', 'pop', 'mx', 'api', 'app', 'admin', 'auth', 'login', 'billing', 'dashboard', 'help', 'support', 'status', 'blog', 'docs', 'shop', 'store', 'dev', 'staging', 'cdn', 'assets', 'static', 'ns1', 'ns2', 'm']);
/** The storefront's address in VibeStartup's zone: the site's slug, which the platform keeps unique. Null when it cannot be one. */
export function brandHostname(biz) {
  const label = String(biz.site?.slug ?? '').toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label) || label.includes('--') || RESERVED.has(label)) return null;
  return `${label}.${BRAND_ZONE}`;
}
/**
 * Whether the zone sends this hostname to CommandAGI's site hosting (the owner's wildcard CNAME, docs/HANDOFF.md
 * § for the owner): asked of public DNS over HTTPS. Until it does, no address is offered, so nothing waits on a record
 * that is not there.
 */
export async function brandDnsReady(hostname) {
  if (!hostname) return false;
  const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=CNAME`, { headers: { accept: 'application/dns-json' } }).catch(() => null);
  const body = r?.ok ? await r.json().catch(() => null) : null;
  return !!body?.Answer?.some(a => a.type === 5 && /(^|\.)commandagi\.app\.?$/i.test(String(a.data)));
}
/**
 * The brand address on the site: added once the zone sends it here (a custom hostname of the site, `POST
 * /sites/:id/domains`), its state read again while it is pending. Kept on the record as `site.brandDomain`
 * ({ hostname, id, status }). Answers whether the record changed.
 */
export async function ensureBrandDomain(biz) {
  const hostname = brandHostname(biz);
  if (!hostname || !biz.site?.id) return false;
  const was = JSON.stringify(biz.site.brandDomain ?? null);
  const row = (await sites.domains.list(biz.site.id).catch(() => [])).find(d => d.hostname === hostname);
  if (row) {
    let status = row.status ?? 'pending';
    if (status !== 'active') status = (await sites.domains.refresh(biz.site.id, row.id).catch(() => null))?.status ?? status;
    biz.site.brandDomain = { hostname, id: row.id, status };
  } else if (await brandDnsReady(hostname)) {
    const added = await sites.domains.add(biz.site.id, hostname).catch(e => ({ error: e }));
    biz.site.brandDomain = added.error ? { hostname, status: 'failed', why: added.error.message } : { hostname, id: added.domain?.id ?? null, status: added.domain?.status === 'active' ? 'active' : 'pending' };
  }
  return JSON.stringify(biz.site.brandDomain ?? null) !== was;
}

// ---------- publishing ----------

/** The business's own legal pages (legal/terms.html, privacy.html, refunds.html in its folder), or null for each. */
async function ownLegal(biz) {
  const read = name => drive.readPath(`${folderOf(biz.slug)}/legal`, `${name}.html`).catch(() => null);
  const [terms, privacy, refunds] = await Promise.all([read('terms'), read('privacy'), read('refunds')]);
  return { terms, privacy, refunds };
}

/** Write a path of the site folder (`product/x.html` goes into product/). */
const writeSiteFile = (folder, path, content) => {
  const at = path.lastIndexOf('/');
  return at < 0 ? drive.write(folder, path, content) : drive.write(`${folder}/${path.slice(0, at)}`, path.slice(at + 1), content);
};

/**
 * Write the storefront's files into the site's folder and deploy it to production: the pictures first (made in this
 * browser), the business's legal pages or the defaults, a page per product, the sign-ups' storage, the brand address
 * when VibeStartup's zone sends it here, then the deploy.
 * A product page whose product is no longer active is removed.
 */
export async function publishStorefront(biz) {
  if (!biz.site?.id || !biz.site?.folder) throw new Error(biz.gaps?.find(g => g.what === 'site')?.why ?? 'The storefront was not created, so there is nothing to publish.');
  const folder = biz.site.folder;
  const products = (await readBizJson(biz.slug, 'products/products.json', { products: [] })).products ?? [];
  const liveDigital = products.find(p => p.status === 'active' && p.goodKind === 'digital' && p.goodStatus === 'active' && p.variantId);
  const [{ images, changed }, legal, can] = await Promise.all([
    storefrontImages(biz, products),
    ownLegal(biz),
    guestCheckout(liveDigital?.variantId),
    ensureSignups(biz),
    ensureBrandDomain(biz).catch(() => false),
  ]);
  if (changed) await writeBizJson(biz.slug, 'products/products.json', { products });
  const files = storefrontFiles(biz, products, { images, legal, store: can.store, guestDigital: can.guestDigital === true });
  if (Object.keys(files).some(p => p.startsWith('product/'))) await drive.mkdir(folder, 'product').catch(() => null);
  // Each file is its own upsert, so they go together: one at a time took about a minute on production.
  await Promise.all(Object.entries(files).map(([path, content]) => writeSiteFile(folder, path, content)));
  const stale = (await drive.list(`${folder}/product`).catch(() => [])).filter(f => !files[`product/${f.name}`]);
  await Promise.all(stale.map(f => drive.remove(f.id).catch(() => null)));
  const deploy = await sites.deployFolder(biz.site.id, 'production');
  biz.site.lastDeploy = { at: Date.now(), id: deploy?.deployment?.id ?? deploy?.id ?? null };
  biz.site.checkout = { ...can, at: Date.now() };
  await writeBusiness(biz);
  return deploy;
}
