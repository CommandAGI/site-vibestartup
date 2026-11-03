// The console's shell: one business (`?b=<slug>`), its tabs (`#tab=<name>`) and the account's pages
// (`#page=billing|profile|share`). Every tab is a module in ./tabs/ that renders into #main with the API client. The
// founder's own CommandAGI token does everything (docs/ARCHITECTURE.md).
import { signedIn, whoami, user, credits, signOut, auth, BRAND } from '/lib/api.js';
import { listBusinesses, readBusiness, approvals } from '/lib/business.js';
import { $, $$, esc, icon, toast, menu, sheet, initial, oops } from '/lib/ui.js';

export const GROUPS = [
  { name: 'Home', tabs: [['chat', 'Chat', 'chat'], ['dashboard', 'Dashboard', 'dashboard'], ['analytics', 'Analytics', 'analytics']] },
  { name: 'Work', tabs: [['tasks', 'Tasks', 'tasks'], ['email', 'Email', 'email'], ['files', 'Files', 'files']] },
  { name: 'Sell', tabs: [['products', 'Products', 'products'], ['orders', 'Orders', 'orders'], ['customers', 'Customers', 'customers']] },
  { name: 'Grow', tabs: [['ads', 'Ads', 'ads'], ['studio', 'Studio', 'studio'], ['outbound', 'Outbound', 'outbound'], ['social', 'Social', 'social']] },
  { name: 'Company', tabs: [['legal', 'Legal', 'legal'], ['settings', 'Settings', 'settings'], ['activity', 'Activity', 'activity']] },
];
export const TABS = GROUPS.flatMap(g => g.tabs.map(([id, label, ico]) => ({ id, label, icon: ico, group: g.name })));
export const PAGES = [{ id: 'billing', label: 'Billing', icon: 'card' }, { id: 'profile', label: 'Profile', icon: 'user' }, { id: 'share', label: 'Share & earn', icon: 'gift' }];
const PHONE_TABS = ['chat', 'dashboard', 'tasks', 'files'];

export const state = { me: null, founder: null, biz: null, businesses: [], tab: 'chat', page: null, credits: null, cleanup: null, needs: 0 };

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
  tabs.innerHTML = GROUPS.map(g => `<div class="group">${esc(g.name)}</div>${g.tabs.map(([id, label, ico]) => `<a href="${tabHref(id)}" data-tab="${id}" ${state.tab === id && !state.page ? 'aria-current="page"' : ''}>${icon(ico)}<span>${esc(label)}</span>${id === 'tasks' && state.needs ? `<span class="count">${state.needs}</span>` : ''}</a>`).join('')}`).join('');
  $('.search-ico').innerHTML = icon('search', 16);
  $('.credits-ico').innerHTML = icon('bolt', 16);
  $('#rail-toggle').innerHTML = icon('menu');
  const bottom = $('#bottombar');
  bottom.innerHTML = PHONE_TABS.map(id => { const t = TABS.find(x => x.id === id); return `<a href="${tabHref(id)}" data-tab="${id}" ${state.tab === id && !state.page ? 'aria-current="page"' : ''}>${icon(t.icon, 20)}<span>${esc(t.label)}</span></a>`; }).join('') + `<button type="button" id="more">${icon('more', 20)}<span>More</span></button>`;
  $('#more').onclick = () => {
    const s = sheet(`<div class="stack"><h3>More</h3><div class="list">${TABS.filter(t => !PHONE_TABS.includes(t.id)).map(t => `<a href="${tabHref(t.id)}" data-tab="${t.id}" class="row">${icon(t.icon)}<span>${esc(t.label)}</span></a>`).join('')}${PAGES.map(p => `<a href="${pageHref(p.id)}" data-page="${p.id}" class="row">${icon(p.icon)}<span>${esc(p.label)}</span></a>`).join('')}<button type="button" class="row" id="sheet-signout" style="border:0;background:none;text-align:left;padding:12px 0">${icon('logout')}<span>Sign out</span></button></div></div>`, { label: 'More' });
    $$('a', s.el).forEach(a => a.addEventListener('click', () => s.close()));
    $('#sheet-signout', s.el).onclick = () => doSignOut();
  };
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
    ...state.businesses.map(b => ({ label: b.name, icon: 'store', onClick: () => { location.href = tabHref(state.tab, b.slug); } })),
    'hr',
    { label: 'New business', icon: 'plus', onClick: () => { location.href = '/start/'; } },
    { label: 'All businesses', icon: 'home', onClick: () => { location.href = '/home/'; } },
  ]);
  $('#account-menu').onclick = e => menu(e.currentTarget, [
    { label: 'Billing', icon: 'card', onClick: () => { location.hash = 'page=billing'; } },
    { label: 'Profile', icon: 'user', onClick: () => { location.hash = 'page=profile'; } },
    { label: 'Share & earn', icon: 'gift', onClick: () => { location.hash = 'page=share'; } },
    'hr',
    { label: 'Sign out', icon: 'logout', onClick: doSignOut },
  ]);
  $('#rail-toggle').onclick = () => $('#more').click();
  // ⌘K search over tabs, pages and businesses
  const dlg = $('#search'); const input = $('#search input'); const list = $('#search .search-results');
  let items = [], sel = 0;
  const open = () => { dlg.showModal(); input.value = ''; fill(); input.focus(); };
  const fill = () => {
    const q = input.value.trim().toLowerCase();
    items = [
      ...TABS.map(t => ({ label: t.label, kind: 'Tab', icon: t.icon, go: () => openTab(t.id) })),
      ...PAGES.map(p => ({ label: p.label, kind: 'Account', icon: p.icon, go: () => { location.hash = `page=${p.id}`; } })),
      ...state.businesses.map(b => ({ label: b.name, kind: 'Business', icon: 'store', go: () => { location.href = tabHref('chat', b.slug); } })),
      { label: 'New business', kind: 'Start', icon: 'plus', go: () => { location.href = '/start/'; } },
    ].filter(i => !q || i.label.toLowerCase().includes(q) || i.kind.toLowerCase().includes(q));
    sel = 0;
    list.innerHTML = items.map((i, k) => `<li role="option" aria-selected="${k === sel}">${icon(i.icon, 16)}<span>${esc(i.label)}</span><small>${esc(i.kind)}</small></li>`).join('') || '<li class="muted">Nothing matches</li>';
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
  // "ask your co-founder" links anywhere
  document.addEventListener('click', e => { const a = e.target.closest('[data-ask]'); if (a) { e.preventDefault(); ask(a.dataset.ask); } });
  addEventListener('hashchange', route);
}

async function refreshCredits() { state.credits = await credits().catch(() => null); renderIdentity(); }
async function refreshNeeds() {
  if (!state.biz) return;
  const open = (await approvals(state.biz).catch(() => [])).filter(t => (t.status ?? t.doc?.status) === 'todo');
  state.needs = open.length; renderRail();
}

async function route() {
  state.cleanup?.(); state.cleanup = null;
  const hp = hashParams();
  state.page = hp.get('page');
  state.tab = state.page ? null : (hp.get('tab') || 'chat');
  if (!state.page && !TABS.some(t => t.id === state.tab)) state.tab = 'chat';
  renderRail(); renderIdentity();
  const main = $('#main'); main.dataset.tab = state.page ?? state.tab;
  document.body.dataset.panel = state.tab === 'chat' ? '1' : '0';
  $('#building').hidden = state.tab !== 'chat';
  $('#tab-title').textContent = state.page ? PAGES.find(p => p.id === state.page).label : TABS.find(t => t.id === state.tab).label;
  $('#actions').innerHTML = '';
  main.innerHTML = '<p class="hint">Loading…</p>';
  const name = state.page ?? state.tab;
  try {
    const mod = await import(`./tabs/${name}.js`);
    const ctx = {
      biz: state.biz, me: state.me, founder: state.founder, el: main, actions: $('#actions'), panel: $('#building'),
      refresh: route, setBiz: b => { state.biz = b; renderIdentity(); }, openTab, ask, refreshCredits, refreshNeeds, tabHref, pageHref,
      businesses: state.businesses,
    };
    const out = await mod.render(ctx);
    if (typeof out === 'function') state.cleanup = out;
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="empty"><h3>This tab could not load</h3><p>${esc(oops(e))}</p><button class="btn quiet" id="retry">Try again</button></div>`;
    $('#retry').onclick = route;
  }
  main.focus({ preventScroll: true });
}

async function init() {
  if (!signedIn()) return renderSignedOut();
  bindChrome();
  try {
    state.me = await whoami();
    if (state.me?.exists === false) { await signOut().catch(() => null); return renderSignedOut(); }
  } catch (e) {
    if (e.status === 401 || !auth()) return renderSignedOut();
    $('#main').innerHTML = `<div class="empty"><h3>CommandAGI did not answer</h3><p>${esc(oops(e))}</p><button class="btn quiet" id="retry">Try again</button></div>`;
    $('#retry').onclick = init; return;
  }
  state.founder = await user(state.me.id).catch(() => ({ id: state.me.id, name: '', email: '' }));
  refreshCredits();
  state.businesses = await listBusinesses().catch(() => []);
  const slug = params().get('b');
  if (!slug) {
    if (!state.businesses.length) { location.replace('/start/'); return; }
    location.replace(tabHref(hashParams().get('tab') || 'chat', state.businesses[0].slug)); return;
  }
  try { state.biz = state.businesses.find(b => b.slug === slug) ?? await readBusiness(slug); }
  catch (e) {
    $('#main').innerHTML = `<div class="empty"><h3>That business is not in your account</h3><p>${esc(oops(e))}</p><a class="btn quiet" href="/home/">Your businesses</a></div>`;
    renderRail(); renderIdentity(); return;
  }
  renderIdentity();
  refreshNeeds();
  await route();
}

init().catch(e => { console.error(e); toast(oops(e), 'bad'); });
