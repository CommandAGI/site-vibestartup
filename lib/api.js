// The CommandAGI client every VibeStartup page uses (docs/ARCHITECTURE.md). The founder's own token, kept in this
// origin's storage, calls the API from the browser: REST routes and the MCP tools at POST /mcp. The app holds no
// credential of its own. window.BRAND comes from /brand.js (app.mjs): which API, which stack.
export const BRAND = window.BRAND ?? { name: 'VibeStartup', client: 'vibestartup', api: 'https://api.commandagi.com', stack: 'production', mailDomain: 'commandagi.email', support: 'hello@vibestartup.pro' };
const API = (new URLSearchParams(location.search).get('api') || BRAND.api).replace(/\/+$/, '');
const AUTH_KEY = 'vs_auth';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- the token ----------

export function auth() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; }
}
function setAuth(a) {
  try { a ? localStorage.setItem(AUTH_KEY, JSON.stringify(a)) : localStorage.removeItem(AUTH_KEY); } catch { /* storage may be off */ }
  document.dispatchEvent(new CustomEvent('auth', { detail: a }));
}
export const signedIn = () => !!auth()?.access;

export class ApiError extends Error {
  constructor(status, body, path) {
    super(body?.message || body?.detail || body?.error_description || messageFor(body?.error) || (status === 0 ? messageFor('unreachable') : `Something went wrong (${status}).`));
    this.status = status; this.code = body?.error; this.body = body; this.path = path;
  }
}
const MESSAGES = {
  unauthorized: 'Please sign in first.',
  forbidden: 'You cannot do that with this account.',
  not_found: 'We could not find that.',
  email_taken: 'An account with this email already exists. Sign in instead.',
  invalid_grant: 'That email or password is not right.',
  invalid_request: 'Something is missing from the form.',
  slow_down: 'Too many tries. Wait a minute and try again.',
  signup_capped: 'New accounts are limited today. Try again tomorrow, or write to us.',
  password_too_short: 'Use at least 8 characters.',
  name_required: 'Tell us your name.',
  invalid_email: 'That email address does not look right.',
  account_suspended: 'This account is suspended.',
  age_verification_required: 'Your account needs a date of birth before the co-founder can run: add it in Profile, then wake the co-founder.',
  insufficient_credits: 'Not enough credits for that.',
  unreachable: 'We could not reach CommandAGI. Check your connection and try again.',
  generate_unavailable: 'Image generation is not configured on this stack yet.',
  sites_not_configured: 'Site hosting is not configured on this stack.',
  uploads_unavailable: 'File storage is not available on this stack.',
};
export const messageFor = code => MESSAGES[code] || null;

async function tokenRequest(fields) {
  const res = await fetch(`${API}/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() }).catch(() => null);
  if (!res) throw new ApiError(0, { error: 'unreachable' }, '/oauth/token');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body, '/oauth/token');
  return body;
}
function keep(body, userId) {
  const a = { access: body.access_token, refresh: body.refresh_token ?? null, expiresAt: Date.now() + (Number(body.expires_in) || 0) * 1000, userId: userId ?? auth()?.userId ?? null };
  setAuth(a);
  return a;
}

/** Sign in with the founder's CommandAGI password: the token endpoint's password grant for this platform-owned client. */
export async function signIn({ email, password }) {
  const body = await tokenRequest({ grant_type: 'password', client_id: BRAND.client, username: String(email).trim(), password, scope: '*' });
  keep(body);
  const me = await whoami();
  setAuth({ ...auth(), userId: me.id });
  return me;
}

/** Create the CommandAGI account and sign it in, in one call (`POST /oauth/signup`, platform-owned clients only). */
export async function signUp({ name, email, password }) {
  const res = await fetch(`${API}/oauth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: BRAND.client, name, email: String(email).trim(), password, scope: '*' }) }).catch(() => null);
  if (!res) throw new ApiError(0, { error: 'unreachable' }, '/oauth/signup');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body, '/oauth/signup');
  keep(body, body.userId);
  const me = await whoami();
  setAuth({ ...auth(), userId: me.id });
  return me;
}

/** Whether the token in hand still opens the account (`GET /me`). */
async function tokenAlive() {
  const a = auth();
  if (!a?.access) return false;
  const r = await fetch(`${API}/me`, { headers: { authorization: `Bearer ${a.access}` } }).catch(() => null);
  return !!r && r.status !== 401;
}

let refreshing = null;
async function refresh() {
  const a = auth();
  if (!a?.refresh) return false;
  refreshing ??= tokenRequest({ grant_type: 'refresh_token', client_id: BRAND.client, refresh_token: a.refresh })
    .then(body => { keep(body, a.userId); return true; })
    // A refresh that lost a race to another one (the stored token moved on) is not a dead session.
    .catch(() => { if (auth()?.refresh && auth().refresh !== a.refresh) return true; setAuth(null); return false; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function signOut() {
  const a = auth();
  try {
    if (a?.access) {
      const { grants = [] } = await api('/me/oauth/grants').catch(() => ({ grants: [] }));
      const mine = grants.find(g => g.clientId === BRAND.client || g.client?.id === BRAND.client);
      if (mine) await api(`/me/oauth/grants/${encodeURIComponent(mine.id)}`, { method: 'DELETE' }).catch(() => null);
    }
  } finally { setAuth(null); }
}

/** Send the visitor to sign in, and back here afterwards. */
export function requireSignIn() {
  if (signedIn()) return true;
  const next = location.pathname + location.search + location.hash;
  location.href = `/auth/?next=${encodeURIComponent(next)}`;
  return false;
}

// ---------- REST ----------

/** One REST call with the token. `body` is JSON unless it is bytes/Blob/FormData; `raw: true` gives the Response. */
export async function api(path, opts = {}) {
  // Never the browser's cache: a Drive read answers `max-age=60`, and a file just written would read as it was.
  const init = { method: opts.method || 'GET', headers: { ...(opts.headers || {}) }, cache: 'no-store' };
  const a = auth();
  if (a?.access && !opts.anonymous) init.headers.authorization = `Bearer ${a.access}`;
  if (opts.body instanceof Blob || opts.body instanceof ArrayBuffer || opts.body instanceof Uint8Array || opts.body instanceof FormData) init.body = opts.body;
  else if (typeof opts.body === 'string') init.body = opts.body;
  else if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); init.headers['content-type'] = 'application/json'; }
  let res;
  try { res = await fetch(`${API}${path}`, init); } catch { throw new ApiError(0, { error: 'unreachable' }, path); }
  // A 401 is the route's own answer when the token still opens /me (a route proxied to a cloud that does not know
  // this key, for one); only a token that /me refuses is refreshed once, and a session ends only when the refresh
  // fails too. Refreshing on every 401 would rotate the key under requests in flight and sign the founder out.
  if (res.status === 401 && !opts.retried && !opts.anonymous && a?.access) {
    if (!(await tokenAlive())) {
      if (a.refresh && await refresh()) return api(path, { ...opts, retried: true });
      setAuth(null);
    }
  }
  if (opts.raw) return res;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new ApiError(res.status, data ?? {}, path);
  return data;
}

// ---------- MCP: every CommandAGI tool, by name ----------

let rpcId = 0;
/** Call one MCP tool (`POST /mcp`, JSON-RPC `tools/call`). The tool's JSON answer is parsed; an `isError` throws. */
export async function mcp(name, args = {}) {
  const a = auth();
  const res = await fetch(`${API}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(a?.access ? { authorization: `Bearer ${a.access}` } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: 'tools/call', params: { name, arguments: Object.fromEntries(Object.entries(args).filter(([k]) => k !== '__retried')) } }),
  }).catch(() => null);
  if (!res) throw new ApiError(0, { error: 'unreachable' }, `mcp:${name}`);
  if (res.status === 401 && a?.refresh && !args.__retried && await refresh()) return mcp(name, { ...args, __retried: true });
  const body = await res.json().catch(() => ({}));
  if (body.error) throw new ApiError(res.status || 400, { error: 'mcp_error', message: body.error.message }, `mcp:${name}`);
  const result = body.result ?? {};
  const text = result.content?.find(c => c.type === 'text')?.text ?? '';
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = { text }; }
  if (result.isError) throw new ApiError(400, { error: data?.error || 'tool_failed', message: data?.message || data?.detail || text.slice(0, 300), ...(data && typeof data === 'object' ? data : {}) }, `mcp:${name}`);
  return data;
}

// ---------- the account ----------

export async function whoami() { return api('/me'); }
export async function user(id) { return api(`/users/${encodeURIComponent(id ?? auth()?.userId)}`); }
export async function credits() { return (await api('/me/credits')).credits; }
export async function creditsHistory() { return api('/me/credits/history'); }
export async function subscription() { return (await api('/me/subscription')).subscription; }
export async function setProfile(patch) { return api('/me/profile', { method: 'POST', body: patch }); }
export async function notificationPrefs() { return api('/me/notification-prefs'); }
export async function setNotificationPref(channel, optedIn) { return api('/me/notification-prefs', { method: 'POST', body: { channel, optedIn } }); }
/**
 * Erase the account (`POST /me/erase`). The platform revokes the account's sign-ins before it erases the Drive, so an
 * erase that fails late (`erase_failed`, `retry: true`) leaves this session dead and the account standing. `password`
 * signs in again and finishes it; without one the error says so (`needsPassword`).
 */
export async function eraseAccount({ email, password } = {}) {
  const once = () => api('/me/erase', { method: 'POST', body: { confirm: true } });
  let r;
  try { r = await once(); }
  catch (e) {
    if (!(e?.status === 401 || e?.body?.retry)) throw e;
    if (!password) { e.needsPassword = true; throw e; }
    await signIn({ email, password });
    r = await once();
  }
  setAuth(null);
  return r;
}

// ---------- the Drive ----------

export const drive = {
  /** The nodes of one folder (`path` relative to the Drive root). */
  async list(path = '') { return (await api(`/drive?path=${encodeURIComponent(path)}`)).files ?? []; },
  async find(path, name) { return (await drive.list(path)).find(f => f.name === name) ?? null; },
  async mkdir(path, name) { return (await api('/drive/folders', { method: 'POST', body: { path, name } })).file; },
  /** Make sure `Businesses/x/y` exists, folder by folder. */
  async ensure(fullPath) {
    const parts = fullPath.split('/').filter(Boolean);
    let at = '';
    for (const p of parts) {
      const found = await drive.find(at, p).catch(() => null);
      if (!found) await drive.mkdir(at, p).catch(() => null);
      at = at ? `${at}/${p}` : p;
    }
    return at;
  },
  /** Create or overwrite a file (upsert by path and name). `content` is a string, bytes or a Blob. */
  async write(path, name, content, contentType) {
    const type = contentType || (name.endsWith('.json') ? 'application/json' : name.endsWith('.md') ? 'text/markdown' : name.endsWith('.csv') ? 'text/csv' : name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : name.endsWith('.js') || name.endsWith('.mjs') ? 'text/javascript' : name.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream');
    const body = typeof content === 'string' ? new Blob([content], { type }) : content;
    const q = new URLSearchParams({ path, name, contentType: type });
    // An upload is an upsert by path and name, so sending it again is safe. Storage answers a rare internal error
    // (R2's 10001, production 2026-11-11: a business stopped at "Writing the co-founder's memory"); retry a 5xx twice.
    for (let i = 0; ; i++) {
      try { return (await api(`/drive/upload?${q}`, { method: 'POST', body, headers: { 'content-type': type } })).file; }
      catch (e) { if (i >= 2 || !(e?.status >= 500)) throw e; await new Promise(r => setTimeout(r, 1000 * (i + 1))); }
    }
  },
  async writeJson(path, name, value) { return drive.write(path, name, JSON.stringify(value, null, 2) + '\n', 'application/json'); },
  async read(id) { return api(`/drive/${encodeURIComponent(id)}/content`, { raw: true }); },
  async readText(id) { const r = await drive.read(id); if (!r.ok) throw new ApiError(r.status, await r.json().catch(() => ({})), 'drive'); return r.text(); },
  async readJson(id) { return JSON.parse(await drive.readText(id)); },
  /** Read a file by its path and name; null when it is not there. */
  async readPath(path, name) { const f = await drive.find(path, name); return f ? drive.readText(f.id) : null; },
  async readJsonPath(path, name) { const t = await drive.readPath(path, name); return t == null ? null : JSON.parse(t); },
  async remove(id) { return api(`/drive/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async rename(id, name) { return api(`/drive/${encodeURIComponent(id)}`, { method: 'PATCH', body: { name } }); },
  /** A browser URL for a file's bytes needs the bearer, so pictures are fetched and shown as blobs. */
  async blobUrl(id) { const r = await drive.read(id); if (!r.ok) return null; return URL.createObjectURL(await r.blob()); },
  shares: {
    async list(path) { return (await api(`/drive/folder-share?path=${encodeURIComponent(path)}`)).shares ?? []; },
    async add(path, email, capability = 'view') { return (await api('/drive/folder-share', { method: 'POST', body: { path, email, capability } })).share; },
    async remove(path, who) { return api('/drive/folder-share', { method: 'DELETE', body: { path, ...who } }); },
  },
};

// ---------- threads: the co-founder ----------

export const threads = {
  async create(body) { return api('/threads', { method: 'POST', body }); },
  async get(id) { return api(`/threads/${encodeURIComponent(id)}`); },
  async chat(id, limit = 100) { return (await api(`/threads/${encodeURIComponent(id)}/chat?limit=${limit}`)).messages ?? []; },
  async send(id, text) { return mcp('send_message', { threadId: id, text }); },
  async inject(id, prompt, label = 'manual') { return api(`/threads/${encodeURIComponent(id)}/inject`, { method: 'POST', body: { prompt, label } }); },
  async events(id, { kind, limit = 200, since } = {}) {
    const q = new URLSearchParams(); if (kind) q.set('kind', kind); if (limit != null) q.set('limit', String(limit)); if (since) q.set('since', String(since));
    return (await api(`/threads/${encodeURIComponent(id)}/events?${q}`)).events ?? [];
  },
  async update(id, patch) { return api(`/threads/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }); },
  triggers: {
    async list(threadId) { return (await api(`/threads/${encodeURIComponent(threadId)}/triggers`)).triggers ?? []; },
    async create(threadId, body) { return api(`/threads/${encodeURIComponent(threadId)}/triggers`, { method: 'POST', body }); },
    async update(threadId, triggerId, patch) { return api(`/threads/${encodeURIComponent(threadId)}/triggers/${encodeURIComponent(triggerId)}`, { method: 'PATCH', body: patch }); },
    async remove(threadId, triggerId) { return api(`/threads/${encodeURIComponent(threadId)}/triggers/${encodeURIComponent(triggerId)}`, { method: 'DELETE' }); },
    async events(threadId, triggerId) { return api(`/threads/${encodeURIComponent(threadId)}/triggers/${encodeURIComponent(triggerId)}/events`); },
  },
};

// ---------- tasks and approvals ----------

export const tasks = {
  /** `dir` is the folder the task's file goes in; `doc` the fields (title, status, priority, assignees, labels, dueAt …); `body` its Markdown. */
  async create({ dir, doc, body = '' }) { return api('/me/tasks', { method: 'POST', body: { dir, doc, body } }); },
  async list({ labels, status, includeClosed = true, q } = {}) {
    const p = new URLSearchParams();
    if (labels?.length) p.set('labels', labels.join(','));
    if (status?.length) p.set('status', status.join(','));
    if (includeClosed) p.set('includeClosed', '1');
    if (q) p.set('q', q);
    return (await api(`/me/tasks?${p}`)).tasks ?? [];
  },
  async get(id) { return api(`/me/tasks/${encodeURIComponent(id)}`); },
  async update(id, doc, body) { return api(`/me/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: { doc, ...(body !== undefined ? { body } : {}) } }); },
  async remove(id) { return api(`/me/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
};

// ---------- sites: the storefront ----------

export const sites = {
  async list() { return (await api('/sites')).sites ?? []; },
  async create(body) { return api('/sites', { method: 'POST', body }); },
  async get(id) { return api(`/sites/${encodeURIComponent(id)}`); },
  async update(id, patch) { return api(`/sites/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }); },
  async remove(id) { return api(`/sites/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async deployFolder(id, target = 'production') { return api(`/sites/${encodeURIComponent(id)}/deploy`, { method: 'POST', body: { source: 'folder', target } }); },
  async analytics(id, hours = 168) { return (await api(`/sites/${encodeURIComponent(id)}/analytics?hours=${hours}`)).analytics; },
  env: {
    async list(id) { return (await api(`/sites/${encodeURIComponent(id)}/env`)).env ?? []; },
    async set(id, key, value, { secret = true, target = null } = {}) { return api(`/sites/${encodeURIComponent(id)}/env`, { method: 'PUT', body: { key, value, secret, target } }); },
    async remove(id, key) { return api(`/sites/${encodeURIComponent(id)}/env/${encodeURIComponent(key)}`, { method: 'DELETE' }); },
  },
  domains: {
    async list(id) { return (await api(`/sites/${encodeURIComponent(id)}/domains`)).domains ?? []; },
    async add(id, hostname) { return api(`/sites/${encodeURIComponent(id)}/domains`, { method: 'POST', body: { hostname } }); },
    async refresh(id, did) { return api(`/sites/${encodeURIComponent(id)}/domains/${encodeURIComponent(did)}/refresh`, { method: 'POST' }); },
    async remove(id, did) { return api(`/sites/${encodeURIComponent(id)}/domains/${encodeURIComponent(did)}`, { method: 'DELETE' }); },
  },
};

// ---------- payments: the founder's Stripe Express account and the goods it sells ----------

/**
 * A founder's customers pay through CommandAGI's checkout, into the founder's own Stripe Express account (Connect):
 * no payment key is ever pasted here. `readiness` says whether the account can be paid; `onboard` opens Stripe's form.
 */
export const payments = {
  async readiness() { return (await api('/payouts/readiness')).readiness ?? { ready: false, blocks: ['not_onboarded'] }; },
  async onboard() { return api('/connect/onboard', { method: 'POST', body: {} }); },
};

/** The founder's goods (`/goods`): a product sold through the cart checkout. Prices in cents. */
export const goods = {
  async list() { return (await api('/goods')).goods ?? []; },
  async create(body) { return api('/goods', { method: 'POST', body }); },
  async update(id, patch) { return api(`/goods/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }); },
  async orders() { return (await api('/goods/orders')).orders ?? []; },
};

// ---------- email ----------

export const email = {
  async addresses() { return api('/email/addresses'); },
  async available(local) { return api(`/email-addresses/available?local=${encodeURIComponent(local)}`); },
  async claim(localPart, label) { return (await api('/me/email-addresses', { method: 'POST', body: { localPart, label } })).address; },
  async threads(addrId, { folder, limit = 100 } = {}) { const q = new URLSearchParams({ limit: String(limit) }); if (folder) q.set('folder', folder); return api(`/email/addresses/${encodeURIComponent(addrId)}/threads?${q}`); },
  async thread(addrId, threadId) { return api(`/email/addresses/${encodeURIComponent(addrId)}/threads/${encodeURIComponent(threadId)}`); },
  async read(addrId, threadId) { return api(`/email/addresses/${encodeURIComponent(addrId)}/threads/${encodeURIComponent(threadId)}/read`, { method: 'POST' }); },
  async reply(addrId, threadId, body) { return api(`/email/addresses/${encodeURIComponent(addrId)}/threads/${encodeURIComponent(threadId)}/reply`, { method: 'POST', body }); },
  async compose(addrId, body) { return api(`/email/addresses/${encodeURIComponent(addrId)}/compose`, { method: 'POST', body }); },
  async search(addrId, q) { return api(`/email/addresses/${encodeURIComponent(addrId)}/search?q=${encodeURIComponent(q)}`); },
  async drafts(addrId) { return api(`/email/addresses/${encodeURIComponent(addrId)}/drafts`); },
  async forwards(addrId, body) { return api(`/email/addresses/${encodeURIComponent(addrId)}/forwards`, { method: 'POST', body }); },
};

// ---------- integrations (connected apps), generation ----------

export const integrations = {
  async list() { return api('/integrations'); },
  async oauthStart(id, redirectUri) { return api(`/integrations/${encodeURIComponent(id)}/oauth/start`, { method: 'POST', body: { redirectUri } }); },
  async call(id, body) { return api(`/integrations/${encodeURIComponent(id)}/call`, { method: 'POST', body }); },
  async connections() { return api('/connections'); },
};
/** A picture or a clip from a description, kept as a Drive file (`POST /generate`). */
export async function generate({ modelId = 'text-to-image.flux-schnell', inputs, name, path }) {
  return api('/generate', { method: 'POST', body: { modelId, inputs, name, ...(path ? { path } : {}) } });
}

export { API };
