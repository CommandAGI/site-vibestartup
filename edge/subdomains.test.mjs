// The edge Worker (edge/subdomains.js) with fetch faked only at its two edges: CommandAGI's brand lookup and the
// storefront's origin. The Cache API is a Map with the same two calls.
//
// Run:  node edge/subdomains.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handle, labelOf } from './subdomains.js';

/** A fake network: `brand` answers the lookup by label, `origin` answers `<label>.commandagi.app`. */
function net({ brand = {}, origin = () => new Response('shop'), lookupThrows = false } = {}) {
  const calls = { lookup: [], origin: [] };
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    if (u.host === 'api.commandagi.com') {
      calls.lookup.push(u.pathname);
      if (lookupThrows) throw new TypeError('network down');
      const label = decodeURIComponent(u.pathname.replace('/sites/brand/', ''));
      const b = brand[label];
      if (typeof b === 'number') return new Response('{}', { status: b });
      if (b === undefined) return Response.json({ error: 'not_found' }, { status: 404 });
      return Response.json(b);
    }
    if (u.host.endsWith('.commandagi.app')) {
      calls.origin.push({ url: u.toString(), method: init.method, headers: new Headers(init.headers), body: init.body ? await new Response(init.body).text() : null, redirect: init.redirect });
      return origin(u, init);
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  const store = new Map();
  const cache = { match: async k => store.get(k)?.clone(), put: async (k, r) => void store.set(k, r) };
  return { fetch, cache, calls, store };
}

const req = (url, init) => new Request(url, init);
const vibe = slug => ({ slug, brand: 'vibestartup', url: `https://${slug}.vibestartup.pro` });

test('a VibeStartup site is proxied: method, path, query, body and headers go to <label>.commandagi.app, the answer comes back', async () => {
  const n = net({ brand: { 'moon-socks': vibe('moon-socks') }, origin: () => new Response('made', { status: 201, headers: { 'x-shop': '1', 'content-type': 'text/plain' } }) });
  const res = await handle(req('https://moon-socks.vibestartup.pro/api/signups?x=1', { method: 'POST', body: '{"email":"a@b.c"}', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.9', connection: 'keep-alive' } }), n);
  assert.equal(res.status, 201);
  assert.equal(await res.text(), 'made');
  assert.equal(res.headers.get('x-shop'), '1');
  const [o] = n.calls.origin;
  assert.equal(o.url, 'https://moon-socks.commandagi.app/api/signups?x=1');
  assert.equal(o.method, 'POST');
  assert.equal(o.body, '{"email":"a@b.c"}');
  assert.equal(o.redirect, 'manual');
  assert.equal(o.headers.get('content-type'), 'application/json');
  assert.equal(o.headers.get('x-forwarded-host'), 'moon-socks.vibestartup.pro');
  assert.equal(o.headers.get('x-forwarded-for'), '203.0.113.9');
  assert.equal(o.headers.get('connection'), null);
  assert.equal(o.headers.get('cf-connecting-ip'), null);
});

test('a redirect and a cookie of the origin are moved to the vibestartup.pro host; a third party\'s are kept', async () => {
  const headers = new Headers({ location: 'https://moon-socks.commandagi.app/checkout.html?c=1' });
  headers.append('set-cookie', 'cart=1; Domain=moon-socks.commandagi.app; Path=/; Secure');
  headers.append('set-cookie', 'seen=1; Domain=.commandagi.app; Path=/');
  headers.append('set-cookie', 'plain=1; Path=/');
  const n = net({ brand: { 'moon-socks': vibe('moon-socks') }, origin: () => new Response(null, { status: 302, headers }) });
  const res = await handle(req('https://moon-socks.vibestartup.pro/cart'), n);
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://moon-socks.vibestartup.pro/checkout.html?c=1');
  assert.deepEqual(res.headers.getSetCookie(), [
    'cart=1; Domain=moon-socks.vibestartup.pro; Path=/; Secure',
    'seen=1; Domain=moon-socks.vibestartup.pro; Path=/',
    'plain=1; Path=/',
  ]);

  const away = net({ brand: { 'moon-socks': vibe('moon-socks') }, origin: () => new Response(null, { status: 303, headers: { location: 'https://checkout.stripe.com/c/pay/x' } }) });
  assert.equal((await handle(req('https://moon-socks.vibestartup.pro/buy'), away)).headers.get('location'), 'https://checkout.stripe.com/c/pay/x');
  const relative = net({ brand: { 'moon-socks': vibe('moon-socks') }, origin: () => new Response(null, { status: 301, headers: { location: '/product/a.html' } }) });
  assert.equal((await handle(req('https://moon-socks.vibestartup.pro/p'), relative)).headers.get('location'), 'https://moon-socks.vibestartup.pro/product/a.html');
});

test('a label that is no VibeStartup site gets the branded 404 and is never proxied: no site, another brand, a wrong slug, the API down', async () => {
  const cases = [
    ['nobody', {}],
    ['tower', { tower: { slug: 'tower', brand: 'someone-else', url: null } }],
    ['tower', { tower: { slug: 'other', brand: 'vibestartup', url: null } }],
    ['tower', { tower: 500 }],
    ['tower', { tower: 'not json' }],
  ];
  for (const [label, brand] of cases) {
    const n = net({ brand });
    const res = await handle(req(`https://${label}.vibestartup.pro/`), n);
    assert.equal(res.status, 404, `${label} ${JSON.stringify(brand)}`);
    const html = await res.text();
    assert.match(html, /No business here yet — start yours/);
    assert.match(html, /href="https:\/\/vibestartup\.pro\/start\/"/);
    assert.equal(n.calls.origin.length, 0);
  }
  const down = net({ brand: { tower: vibe('tower') }, lookupThrows: true });
  assert.equal((await handle(req('https://tower.vibestartup.pro/'), down)).status, 404);
  assert.equal(down.calls.origin.length, 0);
});

test('today, before the lookup is on production (404 for every label), every label is the branded 404', async () => {
  const n = net();
  for (const label of ['moon-socks', 'vibestartup', 'shop']) assert.equal((await handle(req(`https://${label}.vibestartup.pro/`), n)).status, 404);
  assert.equal(n.calls.origin.length, 0);
});

test('the answer is kept for five minutes, a "no" too; an error is asked again', async () => {
  const n = net({ brand: { 'moon-socks': vibe('moon-socks') } });
  await handle(req('https://moon-socks.vibestartup.pro/'), n);
  await handle(req('https://moon-socks.vibestartup.pro/a'), n);
  await handle(req('https://nobody.vibestartup.pro/'), n);
  await handle(req('https://nobody.vibestartup.pro/b'), n);
  assert.deepEqual(n.calls.lookup, ['/sites/brand/moon-socks', '/sites/brand/nobody']);
  assert.equal(n.calls.origin.length, 2);
  assert.match([...n.store.values()][0].headers.get('cache-control'), /max-age=300/);

  const flaky = net({ brand: { tower: 503 } });
  await handle(req('https://tower.vibestartup.pro/'), flaky);
  await handle(req('https://tower.vibestartup.pro/'), flaky);
  assert.equal(flaky.calls.lookup.length, 2);
  assert.equal(flaky.store.size, 0);
});

test('only one label of the apex is a business: reserved names, `_` names, deeper names and other hosts are not', async () => {
  for (const host of ['api.vibestartup.pro', 'dev.vibestartup.pro', 'dev-api.vibestartup.pro', 'send.vibestartup.pro', '_dmarc.vibestartup.pro', 'a.b.vibestartup.pro', 'vibestartup.pro', 'shop.vibestartup.us', 'x_y.vibestartup.pro'])
    assert.equal(labelOf(host), null, host);
  assert.equal(labelOf('Moon-Socks.VibeStartup.pro'), 'moon-socks');
  const n = net({ brand: { api: vibe('api') } });
  assert.equal((await handle(req('https://api.vibestartup.pro/'), n)).status, 404);
  assert.equal(n.calls.lookup.length, 0);
  const www = await handle(req('https://www.vibestartup.pro/start/'), n);
  assert.deepEqual([www.status, www.headers.get('location')], [301, 'https://vibestartup.pro/start/']);
});
