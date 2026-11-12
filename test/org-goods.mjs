// A product added in the Products tab is a good of the business's org: one throwaway account, the wizard to a business,
// then Products → Add product (a physical mug). The good is read back as the org (`GET /goods` with x-cagi-account):
// its file is the product file in the org's products/, its seller is the org, and it is a draft while the org cannot be
// paid (Finish payouts), or active when it can. The founder's own goods hold no such good. The account is erased at the
// end, also when the run fails.
//
//   node test/org-goods.mjs [--url https://vibestartup.pro] [--api https://api.commandagi.com] [--out <dir>]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withBrowser, sleep } from './browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const api = arg('api') ?? 'https://api.commandagi.com';
const site = arg('url') ?? 'https://vibestartup.pro';
const out = arg('out') ?? path.join(here, '..', '.test-results', 'org-goods');
const email = `goods-${Date.now().toString(36)}@example.com`;
const password = 'correct horse battery';
const result = { site, api, email, checks: [] };
let failure = null;
const check = (ok, what) => { result.checks.push(`${ok ? 'ok' : 'FAIL'} ${what}`); if (!ok) throw Error(what); };
try {
  const r = await fetch(`${api}/oauth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: 'vibestartup', name: 'Goods Person', email, password, scope: '*' }) });
  const tok = await r.json();
  if (!r.ok) throw Error(`sign-up: ${r.status} ${JSON.stringify(tok)}`);
  const call = async (p, init = {}) => { const res = await fetch(`${api}${p}`, { ...init, headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json', ...(init.headers ?? {}) } }); return { status: res.status, body: await res.json().catch(() => null) }; };
  await call('/me/profile', { method: 'POST', body: '{"birthdate":"1990-01-01"}' });
  const me = (await call('/me')).body;
  const stored = JSON.stringify({ access: tok.access_token, refresh: tok.refresh_token ?? null, expiresAt: Date.now() + (Number(tok.expires_in) || 3600) * 1000, userId: me.id });
  await withBrowser(async b => {
    await b.goto(`${site}/`);
    await b.eval(`localStorage.setItem('vs_auth', ${JSON.stringify(stored)})`);
    await b.goto(`${site}/start/?idea=${encodeURIComponent('Hand-thrown ceramic mugs sold to cafes by subscription')}`);
    for (const step of ['idea', 'blueprint', 'name', 'vibe', 'voice', 'partner', 'cofounder']) {
      await b.waitFor(`document.querySelector("#wizard")?.dataset.step === ${JSON.stringify(step)}`, 20000);
      if (step === 'blueprint') { await b.waitFor('!!document.querySelector("#choices .choice")', 20000); await b.click(await b.eval('!!document.querySelector("#choices .choice.suggested")') ? '#choices .choice.suggested' : '#choices .choice'); }
      if (step === 'name') await b.fill('#own', `Kiln ${Date.now().toString(36).slice(-4)}`);
      await b.click('#continue');
    }
    await b.waitFor('document.querySelector("#wizard")?.dataset.step === "updates"', 10000);
    await b.click('#continue');
    await b.waitFor('location.pathname === "/app/"', 420000);
    const slug = await b.eval(`new URL(location.href).searchParams.get('b')`);
    const org = `org-${slug}`;
    result.org = org;
    await b.eval(`location.hash = 'tab=products'`);
    await b.waitFor('!!document.querySelector("#add-product")', 30000);
    await b.click('#add-product');
    await b.waitFor('!!document.querySelector("#p-name")');
    await b.fill('#p-name', 'The Harbour Mug');
    await b.fill('#p-desc', '350 ml, blue glaze');
    await b.fill('#p-price', '28');
    const added = Date.now();
    await b.click('#create-product');
    await b.waitFor('[...document.querySelectorAll("#product-list .product")].some(e => /Harbour Mug/.test(e.innerText))', 60000);
    result.addedS = (Date.now() - added) / 1000;
    await b.shot('products');
    const asOrg = { headers: { 'x-cagi-account': `acct:org:${org}` } };
    const listed = (await call('/goods', asOrg)).body;
    result.account = listed?.account ?? null;
    const goods = listed?.goods ?? [];
    const good = goods.find(g => /Harbour Mug/.test(g.name ?? ''));
    result.good = good ? { id: good.id, name: good.name, slug: good.slug, file: good.file, status: good.status, kind: good.kind, sellerAccount: good.sellerAccount ?? good.seller ?? null, variants: (good.variants ?? []).map(v => ({ sku: v.sku, priceCents: v.priceCents })) } : null;
    check(!!good, 'the org sells the mug: GET /goods as the org lists it');
    check(/(^|\/)products\/[^/]+\.product\.tsx$/.test(good.file ?? ''), `its file is the org's product file (${good.file})`);
    check(listed.account === `acct:org:${org}` && (!good.sellerAccount || good.sellerAccount === listed.account), `its seller is the org (${good.sellerAccount ?? listed.account})`);
    check(good.variants?.[0]?.priceCents === 2800, 'its price is $28.00');
    const payouts = (await call('/connect/refresh', { method: 'POST', body: JSON.stringify({ account: `acct:org:${org}` }), ...asOrg })).body;
    result.payouts = payouts;
    const ready = !!(payouts?.ready ?? payouts?.chargesEnabled);
    check(good.status === (ready ? 'active' : 'draft'), `it is ${ready ? 'active: the org can be paid' : 'a draft until the org can be paid'} (${good.status})`);
    const own = (await call('/goods')).body?.goods ?? [];
    check(!own.some(g => g.id === good.id), 'the founder\'s own goods do not hold it');
    const card = await b.eval(`[...document.querySelectorAll("#product-list .product")].find(e => /Harbour Mug/.test(e.innerText))?.innerText ?? ''`);
    result.card = card.replace(/\s+/g, ' ').slice(0, 300);
    check(ready ? /checkout/i.test(card) : /checkout after payouts|order by email|payouts/i.test(card), 'the card says how it is sold');
  }, { out, width: 1440, height: 900 });
} catch (e) { failure = e; } finally {
  const tok = await (await fetch(`${api}/oauth/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: 'vibestartup', username: email, password, scope: '*' }) })).json().catch(() => ({}));
  result.erased = tok.access_token ? (await fetch(`${api}/me/erase`, { method: 'POST', headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' }, body: '{"confirm":true}' })).status : 'no token';
}
console.log(JSON.stringify(result, null, 2));
if (failure) { console.error(failure); process.exit(1); }
