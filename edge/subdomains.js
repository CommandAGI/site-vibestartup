// VibeStartup's edge: every business at `<site slug>.vibestartup.pro` (owner decision 2026-11-11).
//
// A Cloudflare Worker in the Cloudflare account that holds the vibestartup.pro zone, on the route `*.vibestartup.pro/*`
// (edge/README.md). The zone's `*` record is proxied, so every name without a record of its own reaches it. For a host
// of one label it asks CommandAGI whose site the label is (`GET https://api.commandagi.com/sites/brand/<label>`, public,
// no owner in it) and proxies the request to `https://<label>.commandagi.app` only when the answer says the site is
// VibeStartup's. Anything else (no such site, a site of no brand, the API down, a malformed answer) is the branded 404:
// the edge never proxies a label it has not verified, so nobody can put their site at `<their slug>.vibestartup.pro`.
//
// The answer is kept in the Cache API for 5 minutes, a "no" too; an error is not kept. One module, no imports, no
// bindings: paste it into the dashboard as it is.

export const API = 'https://api.commandagi.com';
export const APEX = 'vibestartup.pro';
export const BRAND = 'vibestartup';
export const START = 'https://vibestartup.pro/start/';
export const ORIGIN_APEX = 'commandagi.app';
const LOOKUP_TTL = 300;
/** Labels that are VibeStartup's own names or a mail name: never a business, whatever site has the slug. */
export const RESERVED = new Set(['www', 'api', 'dev', 'dev-api', 'send']);
/** Headers of one hop (RFC 9110 § 7.6.1), and the host, which is the origin's. */
const HOP = new Set(['connection', 'keep-alive', 'proxy-connection', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host']);

/** The business label of a host on the apex, or null: one DNS label, a site slug's shape, not reserved, not `_*`. */
export function labelOf(host) {
  const h = String(host ?? '').toLowerCase().split(':')[0];
  if (!h.endsWith(`.${APEX}`)) return null;
  const label = h.slice(0, -(APEX.length + 1));
  if (!label || label.includes('.') || label.startsWith('_') || RESERVED.has(label)) return null;
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label) ? label : null;
}

/**
 * Whether CommandAGI says `label` is a VibeStartup site: true, false, or null when it could not tell (an error; never
 * kept). The answer must name this label and this brand; anything else is false.
 */
export async function isBrandSite(label, { fetch: get = fetch, cache = null, api = API } = {}) {
  const key = `https://${APEX}/__edge/brand/${label}`;
  const hit = cache ? await cache.match(key).catch(() => undefined) : undefined;
  if (hit) return (await hit.text()) === 'yes';
  let res;
  try {
    res = await get(`${api}/sites/brand/${encodeURIComponent(label)}`, { headers: { accept: 'application/json' } });
  } catch {
    return null;
  }
  let yes;
  if (res.status === 200) {
    const body = await res.json().catch(() => null);
    yes = !!body && body.brand === BRAND && String(body.slug ?? '').toLowerCase() === label;
  } else if (res.status === 404) {
    yes = false;
  } else {
    return null;
  }
  if (cache) {
    const kept = new Response(yes ? 'yes' : 'no', { headers: { 'cache-control': `public, max-age=${LOOKUP_TTL}` } });
    await cache.put(key, kept).catch(() => {});
  }
  return yes;
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The branded 404: no business at this address, and the way to start one. */
export function notHere(host) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>No business here yet · VibeStartup</title><style>html{color-scheme:light dark}body{margin:0;min-height:100dvh;display:grid;place-items:center;font:16px/1.5 "Instrument Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#faf9f6;color:#141413}@media(prefers-color-scheme:dark){body{background:#141413;color:#faf9f6}}main{text-align:center;padding:2rem 16px;max-width:32rem}h1{font:400 2.4rem/1.15 "Instrument Serif",Georgia,serif;margin:0 0 .75rem}p{margin:0 0 1.5rem;opacity:.75}a.go{display:inline-block;padding:.7rem 1.2rem;background:#141413;color:#faf9f6;text-decoration:none;font-weight:600}@media(prefers-color-scheme:dark){a.go{background:#faf9f6;color:#141413}}small{display:block;margin-top:2rem;opacity:.5}small a{color:inherit}</style></head><body><main><h1>No business here yet — start yours</h1><p>Nothing is published at ${esc(host)}. Describe an idea and an AI co-founder builds the business with you.</p><a class="go" href="${START}">Start yours</a><small><a href="https://${APEX}/">VibeStartup</a></small></main></body></html>`;
  return new Response(html, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' } });
}

/** A `Location` on the origin's host, moved to the brand's host; any other location is kept. */
export function rewriteLocation(location, originHost, host) {
  try {
    const u = new URL(location, `https://${originHost}`);
    if (u.host.toLowerCase() !== originHost) return location;
    u.protocol = 'https:';
    u.host = host;
    return u.toString();
  } catch {
    return location;
  }
}

/** A `Set-Cookie` whose Domain is the origin's (its host or commandagi.app), scoped to the brand's host instead. */
export function rewriteCookie(cookie, originHost, host) {
  return cookie.replace(/;\s*domain=([^;]*)/i, (all, d) => {
    const domain = d.trim().replace(/^\./, '').toLowerCase();
    return domain === originHost || domain === ORIGIN_APEX ? `; Domain=${host}` : all;
  });
}

/** Proxy the request to `<label>.commandagi.app`: method, path, query, body and headers; the answer streamed back. */
export async function proxy(request, label, { fetch: get = fetch } = {}) {
  const url = new URL(request.url);
  const host = url.host.toLowerCase();
  const originHost = `${label}.${ORIGIN_APEX}`;
  const headers = new Headers();
  // Cloudflare's own `cf-*` headers are the visitor's edge's, not ours to send on to another zone.
  for (const [k, v] of request.headers) if (!HOP.has(k.toLowerCase()) && !k.toLowerCase().startsWith('cf-')) headers.set(k, v);
  const visitor = request.headers.get('cf-connecting-ip');
  if (visitor) headers.set('x-forwarded-for', visitor);
  headers.set('x-forwarded-host', host);
  headers.set('x-forwarded-proto', 'https');
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body;
  const res = await get(`https://${originHost}${url.pathname}${url.search}`, { method: request.method, headers, body, redirect: 'manual', ...(body ? { duplex: 'half' } : {}) });
  const out = new Headers();
  for (const [k, v] of res.headers) if (!HOP.has(k.toLowerCase()) && k.toLowerCase() !== 'set-cookie') out.set(k, v);
  const location = res.headers.get('location');
  if (location) out.set('location', rewriteLocation(location, originHost, host));
  const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
  for (const c of cookies) out.append('set-cookie', rewriteCookie(c, originHost, host));
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

/** One request at the edge. `deps` stand in for the Worker's globals in a test. */
export async function handle(request, deps = {}) {
  const host = new URL(request.url).host.toLowerCase();
  const label = labelOf(host);
  if (host === `www.${APEX}`) return Response.redirect(`https://${APEX}${new URL(request.url).pathname}`, 301);
  if (!label) return notHere(host);
  const yes = await isBrandSite(label, deps);
  if (yes !== true) return notHere(host);
  return proxy(request, label, deps);
}

export default {
  async fetch(request) {
    return handle(request, { fetch: (...a) => fetch(...a), cache: typeof caches !== 'undefined' ? caches.default : null });
  },
};
