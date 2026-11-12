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
  invalid_code: 'That code is not right. Check the email and try again.',
  code_expired: 'That code has expired. Send a new one.',
  code_locked: 'Too many wrong codes. Send a new one.',
  too_soon: 'A code was just sent. Wait half a minute before asking for another.',
  listing_inactive: 'This plan is not open yet.',
  listing_not_found: 'This plan is not open yet.',
  not_signable: 'This contract can no longer be signed.',
  not_cancellable: 'A signed contract cannot be cancelled. Dispute it if the work is not what you asked for.',
  thread_not_found: 'This business has no co-founder thread yet.',
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

/**
 * Create the CommandAGI account and sign it in, in one call (`POST /oauth/signup`, platform-owned clients only). The
 * `ref` of a shared link the visitor followed rides along; an API that answers no `referral` gets it at the referral
 * door right after (`settleReferral`).
 */
export async function signUp({ name, email, password, turnstileToken }) {
  const ref = pendingRef();
  const res = await fetch(`${API}/oauth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: BRAND.client, name, email: String(email).trim(), password, scope: '*', ...(ref ? { ref } : {}), ...(turnstileToken ? { turnstile_token: turnstileToken } : {}) }) }).catch(() => null);
  if (!res) throw new ApiError(0, { error: 'unreachable' }, '/oauth/signup');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body, '/oauth/signup');
  keep(body, body.userId);
  const me = await whoami();
  setAuth({ ...auth(), userId: me.id });
  if (body.referral) forgetRef(); else await settleReferral();
  return me;
}

// ---------- referrals (docs/ARCHITECTURE.md § share & earn) ----------

const REF_KEY = 'vs_ref';
/** The `ref` of the shared link this visitor followed, kept until the sign-up uses it. */
export function pendingRef() {
  try { return localStorage.getItem(REF_KEY) || null; } catch { return null; }
}
function forgetRef() { try { localStorage.removeItem(REF_KEY); } catch { /* storage may be off */ } }
// Any page opened from a shared link (`/?ref=…`, `/start/?ref=…`, `/auth/?ref=…`) keeps the ref.
try {
  const ref = new URLSearchParams(location.search).get('ref')?.trim();
  if (ref && /^[\w.-]{1,120}$/.test(ref)) localStorage.setItem(REF_KEY, ref);
} catch { /* storage may be off: the link still opens the page */ }

/** What the account earned by sharing (`GET /me/referrals`): its code, the rule, its referrals; null where the API has no referrals. */
export async function referrals() {
  try { return await api('/me/referrals'); } catch (e) { if (e?.status === 404) return null; throw e; }
}
/**
 * Name the referrer of a just-made account (`POST /me/referrer`, within a day of the sign-up). A ref the API has
 * answered (attached, already, self, unknown, too late) is forgotten; one an API without the door could not take is kept
 * for the next page.
 */
export async function settleReferral() {
  const ref = pendingRef();
  if (!ref || !signedIn()) return null;
  try { const r = await api('/me/referrer', { method: 'POST', body: { ref, client: BRAND.client } }); forgetRef(); return r; }
  catch (e) { if (['already', 'unknown_ref', 'self', 'too_late'].includes(e?.code)) forgetRef(); return null; }
}
/** The account's addresses (`GET /me/emails`), and the mailed code that proves one (`…/verify`, `…/confirm`). */
export const emails = {
  list: async () => (await api('/me/emails')).emails ?? [],
  sendCode: id => api(`/me/emails/${encodeURIComponent(id)}/verify`, { method: 'POST' }),
  confirm: (id, code) => api(`/me/emails/${encodeURIComponent(id)}/confirm`, { method: 'POST', body: { code: String(code).trim() } }),
};

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

/**
 * A Drive: the founder's own (`drive`), or an org's (`drive.forAccount(orgId)`: a business's, docs/schema.md). Paths are
 * relative to that Drive's root. An org's calls carry `owner=org&ownerScope=<org id>`, and its reads by path go to its
 * home's files door (`/accounts/<org id>/files/<path>`); a file read by id is the same door for both.
 */
function driveOf(org = null) {
  const owner = org ? { owner: 'org', ownerScope: org } : {};
  const q = (fields = {}) => new URLSearchParams({ ...fields, ...owner }).toString();
  const home = org ? encodeURIComponent(org) : 'me';
  const filesPath = full => `/accounts/${home}/files/${String(full).split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
  const d = {
    org,
    /** The nodes of one folder (`path` relative to the Drive root). */
    async list(path = '') { return (await api(`/drive?${q({ path })}`)).files ?? []; },
    async find(path, name) { return (await d.list(path)).find(f => f.name === name) ?? null; },
    async mkdir(path, name) { return (await api(`/drive/folders?${q()}`, { method: 'POST', body: { path, name, ...owner } })).file; },
    /** Make sure `a/b/c` exists, folder by folder. */
    async ensure(fullPath) {
      const parts = fullPath.split('/').filter(Boolean);
      let at = '';
      for (const p of parts) {
        const found = await d.find(at, p).catch(() => null);
        if (!found) await d.mkdir(at, p).catch(() => null);
        at = at ? `${at}/${p}` : p;
      }
      return at;
    },
    /** Create or overwrite a file (upsert by path and name). `content` is a string, bytes or a Blob. */
    async write(path, name, content, contentType) {
      const type = contentType || (name.endsWith('.json') ? 'application/json' : name.endsWith('.md') ? 'text/markdown' : name.endsWith('.csv') ? 'text/csv' : name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : name.endsWith('.js') || name.endsWith('.mjs') ? 'text/javascript' : name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.vcf') ? 'text/vcard' : name.endsWith('.tsx') ? 'text/plain' : 'application/octet-stream');
      const body = typeof content === 'string' ? new Blob([content], { type }) : content;
      // An upload is an upsert by path and name, so sending it again is safe. Storage answers a rare internal error
      // (R2's 10001, production 2026-11-11: a business stopped at "Writing the co-founder's memory"); retry a 5xx twice.
      for (let i = 0; ; i++) {
        try { return (await api(`/drive/upload?${q({ path, name, contentType: type })}`, { method: 'POST', body, headers: { 'content-type': type } })).file; }
        catch (e) { if (i >= 2 || !(e?.status >= 500)) throw e; await new Promise(r => setTimeout(r, 1000 * (i + 1))); }
      }
    },
    async writeJson(path, name, value) { return d.write(path, name, JSON.stringify(value, null, 2) + '\n', 'application/json'); },
    async read(id) { return api(`/drive/${encodeURIComponent(id)}/content`, { raw: true }); },
    async readText(id) { const r = await d.read(id); if (!r.ok) throw new ApiError(r.status, await r.json().catch(() => ({})), 'drive'); return r.text(); },
    async readJson(id) { return JSON.parse(await d.readText(id)); },
    /** Read a file by its path and name in one call (the account files door); null when it is not there. */
    async readPath(path, name) {
      const r = await api(filesPath([path, name].filter(Boolean).join('/')), { raw: true });
      if (r.status === 404) return null;
      if (!r.ok) throw new ApiError(r.status, await r.json().catch(() => ({})), 'drive');
      return r.text();
    },
    async readJsonPath(path, name) { const t = await d.readPath(path, name); return t == null ? null : JSON.parse(t); },
    /** A file's bytes by its full path (`studio/a.png`), as a Blob; null when it is not there. */
    async readBlobPath(full) {
      const r = await api(filesPath(full), { raw: true });
      if (r.status === 404) return null;
      if (!r.ok) throw new ApiError(r.status, await r.json().catch(() => ({})), 'drive');
      return r.blob();
    },
    /** Every file under `prefix` with its size and SHA-256 (`GET /accounts/:id/files`), a page at a time to the end. */
    async files(prefix = '') {
      const out = [];
      for (let after = null; ;) {
        const p = new URLSearchParams({ prefix, limit: '500' }); if (after) p.set('after', after);
        const r = await api(`/accounts/${home}/files?${p}`);
        out.push(...(r.files ?? []));
        if (!r.next) return out;
        after = r.next;
      }
    },
    /** To the Drive's Trash (`DELETE /drive/:id`): kept, never erased. */
    async remove(id) { return api(`/drive/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
    async rename(id, name) { return api(`/drive/${encodeURIComponent(id)}`, { method: 'PATCH', body: { name } }); },
    /** A browser URL for a file's bytes needs the bearer, so pictures are fetched and shown as blobs. */
    async blobUrl(id) { const r = await d.read(id); if (!r.ok) return null; return URL.createObjectURL(await r.blob()); },
  };
  return d;
}
export const drive = Object.assign(driveOf(), { forAccount: driveOf });

// ---------- orgs: a business is an org (docs/schema.md) ----------

/** The org's id is `org-<handle>`; a taken handle answers 409 `handle_taken` with a free `suggestion`. */
export const orgs = {
  /** The founder's orgs made through this brand (`GET /me/orgs?brand=`). */
  async list() { return (await api(`/me/orgs?brand=${encodeURIComponent(BRAND.client)}`)).orgs ?? []; },
  async create({ name, handle }) { return api('/accounts', { method: 'POST', body: { name, handle } }); },
  async get(id) { return api(`/orgs/${encodeURIComponent(id)}`); },
  async rename(id, name) { return api(`/orgs/${encodeURIComponent(id)}`, { method: 'PATCH', body: { name } }); },
  async remove(id) { return api(`/orgs/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async members(id) { return (await api(`/orgs/${encodeURIComponent(id)}/members`)).members ?? []; },
  async removeMember(id, userId) { return api(`/orgs/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' }); },
  async invites(id) { return (await api(`/orgs/${encodeURIComponent(id)}/invites`)).invites ?? []; },
  async invite(id, email, role = 'member') { return api(`/orgs/${encodeURIComponent(id)}/invites`, { method: 'POST', body: { email, role } }); },
  async uninvite(id, inviteId) { return api(`/orgs/${encodeURIComponent(id)}/invites/${encodeURIComponent(inviteId)}`, { method: 'DELETE' }); },
  async addresses(id) { return (await api(`/orgs/${encodeURIComponent(id)}/email-addresses`)).addresses ?? []; },
  async claimAddress(id, localPart, label) { return (await api(`/orgs/${encodeURIComponent(id)}/email-addresses`, { method: 'POST', body: { localPart, label } })).address; },
};

// ---------- agents: the co-founder's own agent ----------

export const agents = {
  /** A fork of a base instance (`openai-gpt-6-luna`, one per catalog model) or of an agent: `{ agent }`. */
  async fork(parentId, body) { return api(`/agents/${encodeURIComponent(parentId)}/fork`, { method: 'POST', body }); },
  async update(id, patch) { return api(`/agents/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }); },
};

// ---------- threads: the co-founder ----------

export const threads = {
  async create(body) { return api('/threads', { method: 'POST', body }); },
  async get(id) { return api(`/threads/${encodeURIComponent(id)}`); },
  /**
   * The threads about one file (`GET /me/threads?of=`), most recently active first, `limit` at a time. `null` from a
   * platform that does not list by file yet (its answer has no `nextCursor`: it ignored `of` and listed every thread).
   */
  async of(address, { limit = 5, cursor } = {}) {
    const q = new URLSearchParams({ of: address, limit: String(limit) }); if (cursor) q.set('cursor', cursor);
    const r = await api(`/me/threads?${q}`);
    return r && 'nextCursor' in r ? { threads: r.threads ?? [], nextCursor: r.nextCursor } : null;
  },
  async chat(id, limit = 100) { return (await api(`/threads/${encodeURIComponent(id)}/chat?limit=${limit}`)).messages ?? []; },
  async send(id, text) { return mcp('send_message', { threadId: id, text }); },
  async inject(id, prompt, label = 'manual') { return api(`/threads/${encodeURIComponent(id)}/inject`, { method: 'POST', body: { prompt, label } }); },
  async events(id, { kind, limit = 200, since } = {}) {
    const q = new URLSearchParams(); if (kind) q.set('kind', kind); if (limit != null) q.set('limit', String(limit)); if (since) q.set('since', String(since));
    return (await api(`/threads/${encodeURIComponent(id)}/events?${q}`)).events ?? [];
  },
  async update(id, patch) { return api(`/threads/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }); },
  /** The thread's live socket (`POST /threads/:id/ws-token` → `wsUrl`): messages, streamed words, the agent's state. */
  async socketUrl(id) { return (await api(`/threads/${encodeURIComponent(id)}/ws-token`, { method: 'POST' })).wsUrl ?? null; },
  /** Answer a question of the thread by its words (`POST /threads/:id/questions/:q/answer`): a widget's answer when the socket is not there. */
  async answer(id, question, text) { return api(`/threads/${encodeURIComponent(id)}/questions/${encodeURIComponent(question)}/answer`, { method: 'POST', body: { text } }); },
  /** A file into the thread (`POST /threads/:id/uploads`); `requestId` names the request_upload picker it answers. */
  async upload(id, file, requestId) {
    const form = new FormData(); form.append('file', file, file.name);
    return api(`/threads/${encodeURIComponent(id)}/uploads${requestId ? `?requestId=${encodeURIComponent(requestId)}` : ''}`, { method: 'POST', body: form });
  },
  triggers: {
    async list(threadId) { return (await api(`/threads/${encodeURIComponent(threadId)}/triggers`)).triggers ?? []; },
    async create(threadId, body) { return api(`/threads/${encodeURIComponent(threadId)}/triggers`, { method: 'POST', body }); },
    async update(threadId, triggerId, patch) { return api(`/threads/${encodeURIComponent(threadId)}/triggers/${encodeURIComponent(triggerId)}`, { method: 'PATCH', body: patch }); },
    async remove(threadId, triggerId) { return api(`/threads/${encodeURIComponent(threadId)}/triggers/${encodeURIComponent(triggerId)}`, { method: 'DELETE' }); },
    async events(threadId, triggerId) { return api(`/threads/${encodeURIComponent(threadId)}/triggers/${encodeURIComponent(triggerId)}/events`); },
  },
};

// ---------- tasks and approvals ----------

/**
 * The tasks of a Drive: the founder's own (`tasks`), or an org's (`tasks.forAccount(orgId)`: `?owner=org&ownerScope=`
 * on every call, so a task's file is in the org's `Tasks/`).
 */
function tasksOf(org = null) {
  const own = org ? { owner: 'org', ownerScope: org } : {};
  const q = (fields = {}) => { const p = new URLSearchParams(fields); for (const [k, v] of Object.entries(own)) p.set(k, v); const t = p.toString(); return t ? `?${t}` : ''; };
  return {
    /** `dir` is the folder the task's file goes in; `doc` the fields (title, status, priority, assignees, labels, taskKey …); `body` its Markdown. */
    async create({ dir, doc, body = '' }) { return api(`/me/tasks${q()}`, { method: 'POST', body: { dir, doc, body } }); },
    async list({ labels, status, includeClosed = true, q: text } = {}) {
      const p = {};
      if (labels?.length) p.labels = labels.join(',');
      if (status?.length) p.status = status.join(',');
      if (includeClosed) p.includeClosed = '1';
      if (text) p.q = text;
      return (await api(`/me/tasks${q(p)}`)).tasks ?? [];
    },
    async get(id) { return api(`/me/tasks/${encodeURIComponent(id)}${q()}`); },
    async update(id, doc, body) { return api(`/me/tasks/${encodeURIComponent(id)}${q()}`, { method: 'PATCH', body: { doc, ...(body !== undefined ? { body } : {}) } }); },
    async remove(id) { return api(`/me/tasks/${encodeURIComponent(id)}${q()}`, { method: 'DELETE' }); },
  };
}
export const tasks = Object.assign(tasksOf(), { forAccount: tasksOf });

// ---------- sites: the storefront ----------

export const sites = {
  async list() { return (await api('/sites')).sites ?? []; },
  async create(body) { return api('/sites', { method: 'POST', body }); },
  async get(id) { return api(`/sites/${encodeURIComponent(id)}`); },
  async update(id, patch) { return api(`/sites/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch }); },
  async remove(id) { return api(`/sites/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  /** Move the site's folder into an org's Drive, keeping its id, slug, domains, deploys and env (`POST /sites/:id/transfer`). */
  async transfer(id, ownerScope) { return api(`/sites/${encodeURIComponent(id)}/transfer`, { method: 'POST', body: { ownerScope } }); },
  async deployFolder(id, target = 'production') { return api(`/sites/${encodeURIComponent(id)}/deploy`, { method: 'POST', body: { source: 'folder', target } }); },
  async analytics(id, hours = 168) { return (await api(`/sites/${encodeURIComponent(id)}/analytics?hours=${hours}`)).analytics; },
  env: {
    async list(id) { return (await api(`/sites/${encodeURIComponent(id)}/env`)).env ?? []; },
    async set(id, key, value, { secret = true, target = null } = {}) { return api(`/sites/${encodeURIComponent(id)}/env`, { method: 'PUT', body: { key, value, secret, target } }); },
    async remove(id, key) { return api(`/sites/${encodeURIComponent(id)}/env/${encodeURIComponent(key)}`, { method: 'DELETE' }); },
  },
  resources: {
    async list(id) { return (await api(`/sites/${encodeURIComponent(id)}/resources`)).resources ?? []; },
    /** A managed D1, R2 or KV bound into the site's Worker (`env.DB`, `env.BLOB`, `env.KV`) from its next deploy. */
    async add(id, kind) { return api(`/sites/${encodeURIComponent(id)}/resources`, { method: 'POST', body: { kind } }); },
  },
  domains: {
    async list(id) { return (await api(`/sites/${encodeURIComponent(id)}/domains`)).domains ?? []; },
    async add(id, hostname) { return api(`/sites/${encodeURIComponent(id)}/domains`, { method: 'POST', body: { hostname } }); },
    async refresh(id, did) { return api(`/sites/${encodeURIComponent(id)}/domains/${encodeURIComponent(did)}/refresh`, { method: 'POST' }); },
    async remove(id, did) { return api(`/sites/${encodeURIComponent(id)}/domains/${encodeURIComponent(did)}`, { method: 'DELETE' }); },
  },
};

// ---------- payments: a business's Stripe Express account and the goods it sells ----------

/**
 * A business's customers pay through CommandAGI's checkout, into the business's own Stripe Express account (Connect):
 * no payment key is ever pasted here. Every call names the org it acts for (`x-cagi-account: acct:org:<id>`), so each
 * business has its own connected account. `readiness` says whether it can be paid; `onboard` makes it (once) and
 * answers Stripe's form, which only the founder fills in.
 */
const actingAs = account => (account ? { 'x-cagi-account': account } : {});
export const payments = {
  /** Connect's own state (POST /connect/refresh: ready | pending | not_onboarded | …) for the account. */
  async readiness(account) {
    const r = await api('/connect/refresh', { method: 'POST', body: account ? { account } : {}, headers: actingAs(account) }).catch(() => null);
    if (r?.outcome) return { ready: r.outcome === 'ready', blocks: r.outcome === 'ready' ? [] : [r.outcome] };
    return { ready: false, blocks: ['not_onboarded'] };
  },
  /** Stripe's form for the account, made if it has none: `{ url, account, createdAccount }`. The form returns to `returnPath`. */
  async onboard(account, returnPath) {
    const send = body => api('/connect/onboard', { method: 'POST', body, headers: actingAs(account) });
    try { return await send({ origin: location.origin, returnPath }); }
    catch (e) { if (e?.status === 400 && ['origin_not_registered', 'origin_mismatch', 'return_path_invalid'].includes(e.code)) return send({}); throw e; }
  },
};

/** The goods (`/goods`) a business sells, as its org: a product sold through the cart checkout. Prices in cents. */
export const goods = {
  async list(account) { return (await api('/goods', { headers: actingAs(account) })).goods ?? []; },
  async update(account, id, patch) { return api(`/goods/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch, headers: actingAs(account) }); },
  async orders(account) { return (await api('/goods/orders', { headers: actingAs(account) })).orders ?? []; },
  /** The index rebuilt from every product file of the account's Drive: `{ indexed, skipped, archived }`. */
  async reindex(account) { return api('/goods/reindex', { method: 'POST', body: {}, headers: actingAs(account) }); },
};

// ---------- billing: credit packs, and hiring a listing through a service contract ----------

/**
 * Start a Stripe checkout (`POST /billing/checkout`) that returns to this page. The API takes the brand's origin
 * (`origin`, `returnPath`) where its client names it (CommandAGI docs/billing.md § return origins); a stack that does
 * not yet refuses it (`origin_not_registered`, `origin_mismatch`, `return_path_invalid`), and then the checkout returns
 * to CommandAGI's own billing page.
 */
export async function checkout(body, returnPath) {
  try { return await api('/billing/checkout', { method: 'POST', body: { ...body, origin: location.origin, returnPath } }); }
  catch (e) {
    if (e?.status === 400 && ['origin_not_registered', 'origin_mismatch', 'return_path_invalid'].includes(e.code)) return api('/billing/checkout', { method: 'POST', body });
    throw e;
  }
}

/**
 * A listing is hired through a service contract (CommandAGI docs/api-worker.md § services): the founder proposes it
 * from a thread they own, both sides sign, escrow holds the price on the founder's credits, the provider delivers and
 * the founder accepts (or disputes). A listing that is not open (a draft before the launch) reads as null.
 */
export const services = {
  async listing(id) { try { return await api(`/listings/${encodeURIComponent(id)}`); } catch (e) { if (e?.status === 404) return null; throw e; } },
  async contracts() { return (await api('/me/contracts')).contracts ?? []; },
  async contract(id) { return (await api(`/services/contracts/${encodeURIComponent(id)}`)).contract; },
  async propose(body) { return api('/services/contracts', { method: 'POST', body }); },
  async sign(id) { return api(`/services/contracts/${encodeURIComponent(id)}/sign`, { method: 'POST', body: {} }); },
  async cancel(id) { return api(`/services/contracts/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: {} }); },
  async accept(id) { return api(`/services/contracts/${encodeURIComponent(id)}/accept`, { method: 'POST', body: {} }); },
  async dispute(id, reason) { return api(`/services/contracts/${encodeURIComponent(id)}/dispute`, { method: 'POST', body: { reason } }); },
};

// ---------- email ----------

export const email = {
  async addresses() { return api('/email/addresses'); },
  async available(local) { return api(`/email-addresses/available?local=${encodeURIComponent(local)}`); },
  async threads(addrId, { folder, limit = 100 } = {}) { const q = new URLSearchParams({ limit: String(limit) }); if (folder) q.set('folder', folder); return api(`/email/addresses/${encodeURIComponent(addrId)}/threads?${q}`); },
  async thread(addrId, threadId) { return api(`/email/addresses/${encodeURIComponent(addrId)}/threads/${encodeURIComponent(threadId)}`); },
  async read(addrId, threadId) { return api(`/email/addresses/${encodeURIComponent(addrId)}/threads/${encodeURIComponent(threadId)}/read`, { method: 'POST' }); },
  async reply(addrId, threadId, body) { return api(`/email/addresses/${encodeURIComponent(addrId)}/threads/${encodeURIComponent(threadId)}/reply`, { method: 'POST', body }); },
  async compose(addrId, body) { return api(`/email/addresses/${encodeURIComponent(addrId)}/compose`, { method: 'POST', body }); },
  async search(addrId, q) { return api(`/email/addresses/${encodeURIComponent(addrId)}/search?q=${encodeURIComponent(q)}`); },
  async drafts(addrId) { return api(`/email/addresses/${encodeURIComponent(addrId)}/drafts`); },
  async forwards(addrId, body) { return api(`/email/addresses/${encodeURIComponent(addrId)}/forwards`, { method: 'POST', body }); },
};

// ---------- the brand's admin view ----------

/**
 * Read only, for an owner or admin of the brand's org (CommandAGI docs/brands.md § a brand's admins). `mine()` lists
 * the brands this account administers; an API without these doors answers 404, and the Admin page says so.
 */
export const brandAdmin = {
  async mine() { return (await api('/me/brands')).brands ?? []; },
  async overview(days = 30) { return api(`/brands/${encodeURIComponent(BRAND.client)}/admin?days=${days}`); },
  async founders(before = null, limit = 25) { return api(`/brands/${encodeURIComponent(BRAND.client)}/admin/founders?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ''}`); },
};

// ---------- integrations (connected apps), generation ----------

export const integrations = {
  async list() { return api('/integrations'); },
  async oauthStart(id, redirectUri) { return api(`/integrations/${encodeURIComponent(id)}/oauth/start`, { method: 'POST', body: { redirectUri } }); },
  async call(id, body) { return api(`/integrations/${encodeURIComponent(id)}/call`, { method: 'POST', body }); },
  /** The model floor of the founder's own connected accounts (`connections.modelFloor`): `key` `*` (every account) or an
   *  integration's id; `floor` a floor, a list (any one met), false or null (`PUT /integrations/:key/model-floor`). */
  async setFloor(key, floor) { return api(`/integrations/${encodeURIComponent(key)}/model-floor`, { method: 'PUT', body: { floor } }); },
  async connections() { return api('/connections'); },
};
/** A picture or a clip from a description, kept as a Drive file (`POST /generate`). */
export async function generate({ modelId = 'text-to-image.flux-schnell', inputs, name, path, org }) {
  return api(`/generate${org ? `?${new URLSearchParams({ owner: 'org', ownerScope: org })}` : ''}`, { method: 'POST', body: { modelId, inputs, name, ...(path ? { path } : {}) } });
}

export { API };
