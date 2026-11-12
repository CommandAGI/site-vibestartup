// The console's shell: one business (`?b=<slug>`, the org `org-<slug>`), its tabs (`#tab=<name>`) and the account's
// pages (`#page=billing|profile|share`). Every tab is a module in ./tabs/ that renders into #main with the API client
// and reads and writes the business's org through lib/business.js (docs/schema.md § the lens). The founder's own
// CommandAGI token does everything (docs/ARCHITECTURE.md).
import { signedIn, whoami, user, credits, signOut, auth, BRAND, brandAdmin } from '/lib/api.js';
import { listBusinesses, readBusiness, approvals, startChat, lintBusiness, refreshCharter } from '/lib/business.js';
import { publishIfEdited } from '/lib/storefront.js';
import { $, $$, esc, icon, toast, menu, modal, initial, oops } from '/lib/ui.js';
import { startGuides, replayGuides } from '/lib/guides.js';
import { branch, bindTree, redraw } from './nav.js';
import { levelOf, CHAT_PAGE } from './levels.js';

export const GROUPS = [
  { name: 'Home', tabs: [['chat', 'Chat', 'chat'], ['dashboard', 'Dashboard', 'dashboard'], ['analytics', 'Analytics', 'analytics']] },
  { name: 'Work', tabs: [['tasks', 'Tasks', 'tasks'], ['email', 'Email', 'email'], ['files', 'Files', 'files']] },
  { name: 'Sell', tabs: [['products', 'Products', 'products'], ['storefront', 'Storefront', 'store'], ['orders', 'Orders', 'orders'], ['customers', 'Customers', 'customers']] },
  { name: 'Grow', tabs: [['ads', 'Ads', 'ads'], ['studio', 'Studio', 'studio'], ['outbound', 'Outbound', 'outbound'], ['social', 'Social', 'social']] },
  { name: 'Company', tabs: [['legal', 'Legal', 'legal'], ['settings', 'Settings', 'settings'], ['activity', 'Activity', 'activity']] },
];
export const TABS = GROUPS.flatMap(g => g.tabs.map(([id, label, ico]) => ({ id, label, icon: ico, group: g.name })));
export const PAGES = [{ id: 'billing', label: 'Billing', icon: 'card' }, { id: 'profile', label: 'Profile', icon: 'user' }, { id: 'share', label: 'Share & earn', icon: 'gift' }, { id: 'admin', label: 'Admin', icon: 'shield' }];
const PHONE_TABS = ['chat', 'dashboard', 'tasks', 'files'];
// G, then a letter, opens a tab (the letter is shown beside the tab in search and in the shortcuts list).
const GO = { chat: 'C', dashboard: 'D', analytics: 'N', tasks: 'T', email: 'E', files: 'F', products: 'P', storefront: 'W', orders: 'O', customers: 'U', ads: 'A', studio: 'S', outbound: 'B', social: 'L', legal: 'G', settings: 'I', activity: 'Y' };

export const state = { me: null, founder: null, biz: null, businesses: [], tab: 'chat', page: null, credits: null, cleanup: null, needs: 0, visit: 0, admin: false, view: null, level: null };
// How long a view may wait before the page offers to try again.
const SLOW_MS = 10000;

const params = () => new URLSearchParams(location.search);
const hashParams = () => new URLSearchParams(location.hash.replace(/^#/, ''));
export const tabHref = (tab, slug = state.biz?.slug) => `/app/?b=${encodeURIComponent(slug ?? '')}#tab=${tab}`;
export const pageHref = page => `/app/?b=${encodeURIComponent(state.biz?.slug ?? '')}#page=${page}`;

/** Open chat with a question already typed (a link anywhere says "ask your co-founder"). */
export function ask(question) {
  try { sessionStorage.setItem('vs_ask', question); } catch { /* storage off */ }
  openTab('chat');
}
export function openTab(tab) { location.hash = `tab=${tab}`; }

function renderSignedOut() {
  document.body.innerHTML = `<div class="signed-out"><div class="card stack" style="max-width:420px;text-align:center;padding:32px"><img src="/wordmark.svg" alt="${esc(BRAND.name)}" width="148" height="41" style="margin:0 auto"><h1 style="font-size:22px">Sign in to open your console</h1><p class="muted">Your businesses, your co-founder and every file of them wait behind your account.</p><a class="btn primary lg" href="/auth/?next=${encodeURIComponent(location.pathname + location.search + location.hash)}">Sign in</a><p class="hint">Taking you there…</p></div></div>`;
  setTimeout(() => { location.href = `/auth/?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`; }, 900);
}

function renderRail() {
  const tabs = $('#tabs');
  redraw(tabs, GROUPS.map(g => `<div class="group">${esc(g.name)}</div>${g.tabs.map(([id, label, ico]) => {
    const shown = state.tab === id && !state.page;
    const kids = kidsOf(id, shown);
    return branch({ id, href: tabHref(id), label, ico, title: `${label} (G then ${GO[id]})`, current: shown && (kids?.items.some(k => k.current) ? 'true' : true), count: id === 'tasks' ? state.needs : 0, kids });
  }).join('')}`).join(''));
  $('.search-ico').innerHTML = icon('search', 16);
  $('.credits-ico').innerHTML = icon('bolt', 16);
  $('#rail-toggle').innerHTML = icon('menu');
  $('#rail-close').innerHTML = icon('x');
  $('#credits').toggleAttribute('aria-current', state.page === 'billing');
  const bottom = $('#bottombar');
  bottom.innerHTML = PHONE_TABS.map(id => { const t = TABS.find(x => x.id === id); return `<a href="${tabHref(id)}" data-tab="${id}" ${state.tab === id && !state.page ? 'aria-current="page"' : ''}>${icon(t.icon, 20)}<span>${esc(t.label)}</span></a>`; }).join('') + `<button type="button" id="more">${icon('more', 20)}<span>More</span></button>`;
  $('#more').onclick = () => setRail(true);
}

/**
 * The levels of tab `id` for the rail (app/levels.js), open while it is the tab shown: the views of a tab are fixed,
 * a tab's items and the chats are read (state.level, a page at a time for the chats).
 */
function kidsOf(id, shown) {
  const l = state.biz && levelOf(id, state.biz);
  if (!l) return null;
  if (!shown) return { open: false, items: [] };
  const lv = state.level?.tab === id ? state.level : null;
  const list = l.items ? l.items(state.biz) : lv?.items ?? [];
  const at = state.view;
  return {
    open: true, label: l.label, loading: !!lv?.loading, more: !!lv?.next, empty: l.load ? (lv?.error ? 'Could not load.' : 'Nothing yet.') : '',
    action: l.action && !lv?.fixed ? { key: l.action.key, label: l.action.label, icon: l.action.icon } : null,
    items: list.map(k => ({ key: `${id}:${k.id}`, href: `${tabHref(id)}&${l.param}=${encodeURIComponent(k.id)}`, label: k.label, meta: k.meta, current: at === k.id })),
  };
}

/** Read the levels of the tab shown: from the start (`more` false) or the next page. Resolves when they are drawn. */
function loadLevel({ more = false, limit } = {}) {
  const tab = state.tab, biz = state.biz;
  const l = biz && !state.page && levelOf(tab, biz);
  if (!l?.load) return Promise.resolve();
  const lv = state.level?.tab === tab && state.level.slug === biz.slug ? state.level : (state.level = { tab, slug: biz.slug, items: [], next: null });
  if (more && !lv.next) return Promise.resolve();
  lv.loading = true; renderRail();
  const run = l.load({ biz, me: state.me }, { cursor: more ? lv.next : null, limit: limit ?? CHAT_PAGE }).then(
    got => { lv.items = more ? [...lv.items, ...got.items.filter(i => !lv.items.some(x => x.id === i.id))] : got.items; lv.next = got.next; lv.fixed = !!got.fixed; lv.error = null; },
    e => { lv.error = e; },
  ).finally(() => { lv.loading = false; if (state.level === lv) renderRail(); });
  lv.pending = run;
  return run;
}

/** A new chat with the co-founder, opened at once. */
async function newChat(button) {
  if (!state.biz?.cofounder?.threadId) return toast('Wake the co-founder first.', 'bad');
  button.disabled = true; button.setAttribute('aria-busy', 'true');
  try {
    const id = await startChat(state.biz);
    state.level = null;
    location.hash = `tab=chat&thread=${encodeURIComponent(id)}`;
  } catch (e) { toast(oops(e), 'bad'); button.disabled = false; button.removeAttribute('aria-busy'); }
}

/** The phone's rail is a drawer from the left edge (console.css); wider, the rail is always there and this does nothing. */
function setRail(open) {
  document.body.dataset.rail = open ? 'open' : '';
  $('#rail-scrim').hidden = !open;
  $('#rail-toggle').setAttribute('aria-expanded', String(open));
  if (open) $('#tabs a[aria-current="page"]')?.focus({ preventScroll: true });
}

function renderIdentity() {
  const b = state.biz;
  $('#biz-name').textContent = b?.name ?? 'No business';
  $('#biz-avatar').textContent = initial(b?.name);
  if (b?.brand?.primary) { $('#biz-avatar').style.background = b.brand.primary; $('#biz-avatar').style.color = '#fff'; }
  $('#me-name').textContent = state.founder?.name || state.founder?.email || 'Account';
  $('#me-avatar').textContent = initial(state.founder?.name || state.founder?.email);
  $('#credits-balance-rail').textContent = state.credits == null ? '…' : new Intl.NumberFormat('en-US').format(Math.round(state.credits));
  document.title = `${b?.name ? b.name + ' · ' : ''}${state.page ? PAGES.find(p => p.id === state.page)?.label : TABS.find(t => t.id === state.tab)?.label ?? 'Console'} · ${BRAND.name}`;
}

async function doSignOut() {
  await signOut().catch(() => null);
  location.href = '/';
}

function bindChrome() {
  $('#biz-switch').onclick = e => menu(e.currentTarget, [
    ...state.businesses.map(b => ({ label: b.name, icon: 'store', onClick: () => { location.href = tabHref(state.tab ?? 'chat', b.slug); } })),
    'hr',
    { label: 'New business', icon: 'plus', onClick: () => { location.href = '/start/'; } },
    { label: 'All businesses', icon: 'home', onClick: () => { location.href = '/home/'; } },
  ]);
  $('#account-menu').onclick = e => menu(e.currentTarget, [
    { label: 'Billing', icon: 'card', onClick: () => { location.hash = 'page=billing'; } },
    { label: 'Profile', icon: 'user', onClick: () => { location.hash = 'page=profile'; } },
    { label: 'Share & earn', icon: 'gift', onClick: () => { location.hash = 'page=share'; } },
    // An admin of the brand's org (GET /me/brands names this brand) reads its founders; nobody else sees the row.
    ...(state.admin ? [{ label: 'Admin', icon: 'shield', onClick: () => { location.hash = 'page=admin'; } }] : []),
    // The tour starts where a founder starts: the chat.
    { label: 'Replay the tour', icon: 'sparkle', onClick: () => { openTab('chat'); replayGuides(); } },
    'hr',
    { label: 'Sign out', icon: 'logout', onClick: doSignOut },
  ]);
  $('#rail-toggle').onclick = () => setRail(document.body.dataset.rail !== 'open');
  $('#rail-close').onclick = () => setRail(false);
  $('#rail-scrim').onclick = () => setRail(false);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.dataset.rail === 'open') setRail(false); });
  labelCells();
  const nav = $('#tabs');
  bindTree(nav);
  nav.addEventListener('click', e => {
    const more = e.target.closest('[data-more]');
    if (more) {
      e.preventDefault();
      const before = state.level?.items.length ?? 0;
      // The first of the chats this page brought takes the focus, so a keyboard keeps its place.
      loadLevel({ more: true }).then(() => { const first = $$('#tabs .sub a.sub-item')[before]; if (more.isConnected || document.activeElement === document.body) first?.focus({ preventScroll: true }); });
      return;
    }
    const act = e.target.closest('[data-action="new-chat"]');
    if (act) { e.preventDefault(); newChat(act); }
  });
  // ⌘K search over tabs, pages and businesses
  const dlg = $('#search'); const input = $('#search input'); const list = $('#search .search-results');
  let items = [], sel = 0;
  const open = () => { dlg.showModal(); input.value = ''; fill(); input.focus(); };
  const fill = () => {
    const q = input.value.trim().toLowerCase();
    items = [
      ...TABS.map(t => ({ label: t.label, kind: 'Tab', icon: t.icon, keys: `G ${GO[t.id]}`, go: () => openTab(t.id) })),
      ...PAGES.filter(p => p.id !== 'admin' || state.admin).map(p => ({ label: p.label, kind: 'Account', icon: p.icon, go: () => { location.hash = `page=${p.id}`; } })),
      ...state.businesses.map(b => ({ label: b.name, kind: 'Business', icon: 'store', go: () => { location.href = tabHref('chat', b.slug); } })),
      { label: 'New business', kind: 'Start', icon: 'plus', go: () => { location.href = '/start/'; } },
    ].filter(i => !q || i.label.toLowerCase().includes(q) || i.kind.toLowerCase().includes(q));
    sel = 0;
    list.innerHTML = items.map((i, k) => `<li role="option" aria-selected="${k === sel}">${icon(i.icon, 16)}<span>${esc(i.label)}</span><small>${esc(i.kind)}</small>${i.keys ? `<kbd>${esc(i.keys)}</kbd>` : ''}</li>`).join('') || '<li class="muted">Nothing matches</li>';
    $$('li', list).forEach((li, k) => li.onclick = () => { dlg.close(); items[k]?.go(); });
  };
  input.oninput = fill;
  input.onkeydown = e => {
    if (e.key === 'ArrowDown') { sel = Math.min(items.length - 1, sel + 1); } else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); } else if (e.key === 'Enter') { e.preventDefault(); dlg.close(); items[sel]?.go(); return; } else return;
    e.preventDefault(); $$('li', list).forEach((li, k) => li.setAttribute('aria-selected', String(k === sel)));
  };
  $('#search-open').onclick = open;
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); dlg.open ? dlg.close() : open(); } });
  // Keys, when the founder is not typing: G then a letter opens a tab, [ and ] step through the tabs, / searches,
  // ? lists the keys.
  let g = 0;
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('dialog[open]')) return;
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (g && Date.now() - g < 1500) {
      g = 0;
      const tab = Object.keys(GO).find(id => GO[id] === key);
      if (tab) { e.preventDefault(); openTab(tab); }
      return;
    }
    if (key === 'G') { g = Date.now(); return; }
    if (key === '/') { e.preventDefault(); open(); return; }
    if (key === '?') { e.preventDefault(); showKeys(); return; }
    if (key === '[' || key === ']') {
      const at = TABS.findIndex(t => t.id === state.tab);
      openTab(TABS[(Math.max(0, at) + (key === ']' ? 1 : TABS.length - 1)) % TABS.length].id);
    }
  });
  // "ask your co-founder" links anywhere
  document.addEventListener('click', e => { const a = e.target.closest('[data-ask]'); if (a) { e.preventDefault(); ask(a.dataset.ask); } });
  // An empty state's next step presses the control that does it (`data-press` names it).
  document.addEventListener('click', e => { const b = e.target.closest('[data-press]'); if (b) $(b.dataset.press)?.click(); });
  addEventListener('hashchange', route);
}

function showKeys() {
  const row = (what, keys) => `<span>${esc(what)}</span><span>${keys.map(k => `<kbd>${esc(k)}</kbd>`).join(' ')}</span>`;
  const m = modal(`<h2>Keyboard</h2><div class="keys">${row('Search and jump', ['⌘K', '/'])}${row('Next tab, previous tab', [']', '['])}${TABS.map(t => row(t.label, ['G', GO[t.id]])).join('')}${row('This list', ['?'])}</div><div class="modal-actions"><button type="button" class="btn quiet" data-close>Close</button></div>`, { label: 'Keyboard shortcuts' });
  $('[data-close]', m.el).onclick = () => m.close();
}

async function refreshCredits() { state.credits = await credits().catch(() => null); renderIdentity(); }
async function refreshNeeds() {
  if (!state.biz) return;
  const open = (await approvals(state.biz).catch(() => [])).filter(t => (t.status ?? t.doc?.status) === 'todo');
  state.needs = open.length; renderRail();
}

/**
 * What every tab's markup gets, whenever a tab writes into the content. On a phone a table's row is a block and each
 * cell a line that names its column (console.css): a cell learns its column's name here.
 */
function labelCells() {
  const label = () => {
    // The top bar already says the tab's name: a page head that repeats it keeps it for screen readers only.
    const h = $('#main .page-head h2');
    if (h && !h.classList.contains('sr-only') && h.textContent.trim() === $('#tab-title').textContent.trim()) h.classList.add('sr-only');
    for (const table of $$('#main table.table')) {
      const heads = $$('thead th', table).map(th => th.textContent.trim());
      for (const tr of $$('tbody tr', table)) [...tr.children].forEach((td, i) => { if (td.dataset.label !== (heads[i] ?? '')) td.dataset.label = heads[i] ?? ''; });
    }
  };
  new MutationObserver(label).observe($('#main'), { childList: true, subtree: true });
}

/**
 * Show a tab or a page. A view never stays blank: it shows that it is loading, then its content, or what went wrong
 * and a way to try again. Each visit renders into elements of its own, so a tab that answers late (the founder already
 * went elsewhere) writes into nothing: it cannot paint over the tab now shown, or leave its actions in the top bar.
 */
async function route() {
  // The address may change before the business is read (a back step while the console opens): init() routes then.
  if (!state.biz) return;
  const visit = ++state.visit;
  const current = () => visit === state.visit;
  state.cleanup?.(); state.cleanup = null;
  setRail(false);
  const hp = hashParams();
  state.page = PAGES.some(p => p.id === hp.get('page')) ? hp.get('page') : null;
  state.tab = state.page ? null : (hp.get('tab') || 'chat');
  if (!state.page && !TABS.some(t => t.id === state.tab)) state.tab = 'chat';
  const level = state.page ? null : levelOf(state.tab, state.biz);
  state.view = level ? hp.get(level.param) : null;
  // A tab's items are read again each time the founder comes to it (the chats move as they are used).
  const entered = state.lastTab !== (state.page ?? state.tab); state.lastTab = state.page ?? state.tab;
  if (level?.load && (entered || state.level?.tab !== state.tab || state.level?.slug !== state.biz.slug)) loadLevel();
  if (state.tab === 'chat' && !state.view) {
    renderRail();
    // Chat with no thread named opens the most recently active one, from the list read now (the one read before may be
    // stale), or the first chat when the list is slow or absent.
    await Promise.race([state.level?.pending, new Promise(r => setTimeout(r, 8000))]).catch(() => null);
    if (!current()) return;
    const id = state.level?.items[0]?.id ?? state.biz.cofounder?.threadId;
    if (id) { state.view = id; history.replaceState(null, '', `${location.pathname}${location.search}#tab=chat&thread=${encodeURIComponent(id)}`); }
  }
  renderRail(); renderIdentity();
  const main = $('#main'); main.dataset.tab = state.page ?? state.tab;
  document.body.dataset.panel = state.tab === 'chat' ? '1' : '0';
  $('#tab-title').textContent = state.page ? PAGES.find(p => p.id === state.page).label : TABS.find(t => t.id === state.tab).label;
  const own = id => { const was = $('#' + id); const el = was.cloneNode(false); was.replaceWith(el); return el; };
  const actions = own('actions'); const panel = own('building'); panel.hidden = state.tab !== 'chat';
  const view = document.createElement('div'); view.className = 'view';
  view.innerHTML = '<div class="skeleton" role="status" aria-label="Loading"><i class="title"></i><i></i><i class="short"></i><i class="block"></i><i class="block"></i></div>';
  main.replaceChildren(view);
  const failed = e => {
    view.innerHTML = `<div class="empty"><h3>This tab could not load</h3><p>${esc(e ? oops(e) : 'It answered with nothing to show.')}</p><button type="button" class="btn quiet" data-retry>Try again</button></div>`;
    actions.innerHTML = '';
    $('[data-retry]', view).onclick = route;
  };
  const slow = setTimeout(() => {
    if (!current()) return;
    view.insertAdjacentHTML('afterbegin', '<div class="loading slow"><span class="spin"></span><span>Still loading. CommandAGI is slow to answer.</span><button type="button" class="btn sm quiet" data-retry>Try again</button></div>');
    $('.slow [data-retry]', view).onclick = route;
  }, SLOW_MS);
  const name = state.page ?? state.tab;
  let out;
  try {
    const mod = await import(`./tabs/${name}.js`);
    const ctx = {
      biz: state.biz, me: state.me, founder: state.founder, el: view, actions, panel,
      refresh: () => { if (current()) return route(); }, setBiz: b => { state.biz = b; renderIdentity(); }, openTab, ask, refreshCredits, refreshNeeds, tabHref, pageHref,
      businesses: state.businesses, view: state.view,
      // The chats moved (a line sent, a title given): read them again, as many as the rail shows.
      chatsChanged: () => { if (state.tab === 'chat') loadLevel({ limit: Math.max(CHAT_PAGE, state.level?.items.length ?? 0) }); },
      openRail: () => setRail(true),
    };
    out = await mod.render(ctx);
    if (current() && level) {
      // An item's level (`item=<id>`) is a row of the tab: it is brought into view and marked.
      if (level.param === 'item' && state.view) { const row = view.querySelector(`[data-id="${CSS.escape(state.view)}"]`); if (row) { row.classList.add('focused'); row.scrollIntoView({ block: 'center' }); } }
      // On a phone the rail is a drawer: the tab's levels (the chats) are one tap from the top bar.
      actions.insertAdjacentHTML('beforeend', `<button type="button" class="btn icon levels-open" aria-label="${esc(level.label)}" data-tip="${esc(level.label)}">${icon('list')}</button>`);
      $('.levels-open', actions).onclick = () => setRail(true);
    }
    if (current() && (!view.childElementCount || $(':scope > .skeleton', view))) failed(null);
  } catch (e) {
    if (current()) { console.error(e); failed(e); }
  } finally { clearTimeout(slow); if (current()) $(':scope > .slow', view)?.remove(); }
  // A visit the founder already left stops what it started (a poll, a listener) at once.
  if (typeof out === 'function') { if (current()) state.cleanup = out; else out(); }
  if (current()) main.focus({ preventScroll: true });
}

/**
 * The live storefront follows storefront.json: when the co-founder changed the file, or the business has none yet (it
 * gets the default for its kind), the console publishes it, and says so.
 */
async function syncStorefront(biz) {
  try {
    if (await publishIfEdited(biz)) { if (state.biz === biz) renderIdentity(); toast('Your storefront was published with its latest layout, style and words.', 'ok'); }
  } catch (e) { console.warn('storefront sync', e); }
}

async function init() {
  if (!signedIn()) return renderSignedOut();
  bindChrome();
  // Every first read starts at once: the account, the founder, the credits and the business in the address. The
  // whole list (the switcher, search) loads behind it; the console waits on it only when no business is named.
  const slug = params().get('b');
  const uid = auth()?.userId;
  const meP = whoami(), founderP = uid ? user(uid).catch(() => null) : null;
  const bizP = slug ? readBusiness(slug).then(b => ({ b }), e => ({ e })) : null;
  const listP = listBusinesses().catch(() => []);
  refreshCredits();
  // Whether this account administers the brand: an API without the door, or any refusal, leaves the row hidden.
  brandAdmin.mine().then(list => { state.admin = list.some(b => b.id === BRAND.client); }, () => { state.admin = false; });
  $('#main').innerHTML = '<div class="skeleton" role="status" aria-label="Opening your console"><i class="title"></i><i></i><i class="short"></i><i class="block"></i></div>';
  try {
    state.me = await meP;
    if (state.me?.exists === false) { await signOut().catch(() => null); return renderSignedOut(); }
  } catch (e) {
    if (e.status === 401 || !auth()) return renderSignedOut();
    $('#main').innerHTML = `<div class="empty"><h3>CommandAGI did not answer</h3><p>${esc(oops(e))}</p><button type="button" class="btn quiet" id="retry">Try again</button></div>`;
    $('#retry').onclick = () => location.reload(); return;
  }
  state.founder = (await (founderP && uid === state.me.id ? founderP : user(state.me.id).catch(() => null))) ?? { id: state.me.id, name: '', email: '' };
  state.businesses = [];
  listP.then(list => { state.businesses = list; renderIdentity(); });
  if (!slug) {
    const list = await listP;
    if (!list.length) { location.replace('/start/'); return; }
    // An account page (`#page=admin`) is the same page in any business: keep it, and only choose the business.
    const page = hashParams().get('page');
    location.replace(page ? `/app/?b=${encodeURIComponent(list[0].slug)}#page=${encodeURIComponent(page)}` : tabHref(hashParams().get('tab') || 'chat', list[0].slug)); return;
  }
  const got = await bizP;
  if (got.e) {
    $('#main').innerHTML = `<div class="empty"><h3>That business is not in your account</h3><p>${esc(oops(got.e))}</p><a class="btn quiet" href="/home/">Your businesses</a></div>`;
    renderRail(); renderIdentity(); return;
  }
  state.biz = got.b;
  renderIdentity();
  refreshNeeds();
  await route();
  startGuides(state.me.id);
  syncStorefront(state.biz);
  // Once a week, the files outside the schema in one task (never a refusal: they are the founder's).
  // One after the other: both write business.json.
  refreshCharter(state.biz, state.founder).catch(() => null).then(() => lintBusiness(state.biz)).catch(() => null);
}

init().catch(e => { console.error(e); toast(oops(e), 'bad'); });
