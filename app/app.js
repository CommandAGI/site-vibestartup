// VibeStartup's console: one business, its co-founder and every tab, for the founder who signed in.
// Everything shown is the app's own state, read from /api/startups/<id> and changed through the app's routes
// (app.mjs); this browser keeps nothing. The co-founder is a model the server calls, so a reply that did not come
// from a model says so.
const TABS = [
  ['chat', 'Chat'], ['dashboard', 'Dashboard'], ['analytics', 'Analytics'], ['tasks', 'Tasks'], ['email', 'Email'],
  ['products', 'Products'], ['orders', 'Orders'], ['customers', 'Customers'], ['ads', 'Ads'], ['studio', 'Studio'],
  ['outbound', 'Outbound'], ['social', 'Social'], ['files', 'Files'], ['legal', 'Legal'], ['settings', 'Settings'],
  ['activity', 'Activity'],
];
const PAGES = [['billing', 'Billing'], ['profile', 'Profile'], ['secrets', 'Environment secrets']];
const EVERY = ['Daily', 'Every 30 minutes', 'Hourly', 'Every 6 hours', 'Every 12 hours', 'Weekly', 'Custom'];

const STARTUP_ID = new URLSearchParams(location.search).get('s');
/** The console's own vocabulary, as the app sends it (one copy of it, on the server). */
const S = { money: n => `$${(Math.round(n * 100) / 100).toFixed(2)}`, svgData: svg => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
let META = {};
let state = { profile: null, biz: null };
let startups = [];
const ui = { studio: 'make', format: 'offer', look: 'Up to you', count: 3, refs: [], made: [], mailFolder: 'all', mailThread: null, mailSearch: '', fileSearch: '', open: {}, routineEdit: null, dayOpen: null, socialView: 'calendar', draftFrom: null, notes: {}, secretShow: false, secretEdit: '', newProduct: false, recurring: false, checkout: null, fromStore: false, preview: null };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const now = () => Date.now();
const time = at => new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const day = at => new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const longDay = at => new Date(at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const $ = sel => document.querySelector(sel);

function route() {
  const p = new URLSearchParams(location.hash.slice(1));
  const tab = p.get('tab') ?? 'chat';
  return { tab: [...TABS, ...PAGES].some(([t]) => t === tab) ? tab : 'chat', draft: p.get('draft') };
}
const chatLink = draft => `#tab=chat&draft=${encodeURIComponent(draft)}`;

let toastTimer;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
}

// ---------- the app's routes ----------

async function api(method, path, body) {
  const r = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) { location.href = `/?next=${encodeURIComponent(location.pathname + location.search)}`; throw new Error('Signed out'); }
  if (!r.ok) throw new Error(data.error ?? `The app answered ${r.status}`);
  return data;
}

/** One change to this business: the server applies it, saves it, and answers the whole console as it now stands. */
async function op(path, body = {}) {
  try {
    const r = await api('POST', `/startups/${encodeURIComponent(STARTUP_ID)}${path}`, body);
    if (r.startup) { state.biz = r.startup; render(); }
    return r;
  } catch (e) {
    toast(e.message);
    throw e;
  }
}
async function reload() {
  const r = await api('GET', `/startups/${encodeURIComponent(STARTUP_ID)}`);
  state.biz = r.startup;
}


/** No business here: the business list is where a founder makes one or opens one. */
const noBusiness = () => `<main class="start" id="main-start"><p class="eyebrow">VibeStartup console</p><h1>Choose a business</h1><p class="muted">Open one from your list, or start a new one from an idea.</p><a class="btn primary" href="/startups/">My startups</a></main>`;

/** What the numbers are, as the app computed them on the last read: this page does no money math of its own. */
const metrics = () => state.biz.metrics ?? { total: 0, net: 0, payouts: 0, profits: 0, balance: 0, real: 0, realRevenue: 0, tests: 0 };

function side(tab) {
  const b = state.biz, waiting = b.tasks.filter(t => t.status === 'approval').length, logo = b.creatives.find(c => c.kind === 'logo');
  return `<aside class="side">
    <a class="brand" href="../index.html"><img src="../mark.svg" alt="" width="26" height="26">VibeStartup</a>
    <button type="button" class="searchbtn" data-action="search">Search <kbd>Ctrl K</kbd></button>
    <div class="bizname">${logo ? `<img class="logo" alt="" src="${S.svgData(logo.svg)}">` : `<span class="logo" style="background:${b.brand.primary}"></span>`}<div><b>${esc(b.name)}</b><span>Business</span></div></div>
    <nav class="nav" aria-label="Console">${TABS.map(([t, label]) => `<a href="#tab=${t}" data-tab="${t}" ${t === tab ? 'aria-current="page"' : ''}>${label}${t === 'tasks' && waiting ? `<span class="count">${waiting}</span>` : ''}</a>`).join('')}</nav>
    <div class="side-foot">
      <div class="meter"><span id="credits">${b.credits} of ${S.FREE_CREDITS} free credits left</span><div class="bar"><i style="width:${Math.round(100 * b.credits / S.FREE_CREDITS)}%"></i></div><a href="#tab=billing">Plans</a></div>
      <button type="button" class="btn small" data-action="share" id="share-btn">Share &amp; earn</button>
      <div class="user"><a href="/startups/">My startups</a><a href="#tab=profile">Profile</a><a href="#tab=billing">Billing</a></div>
    </div>
  </aside>`;
}

const head = (title, sub = '', right = '') => `<header class="page-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${right}</header>`;

function approvalCard(task, compact = false) {
  const open = ui.open[task.id];
  const state_ = task.status === 'approval' ? '<span class="pill accent">Needs approval</span>' : task.status === 'done' ? `<span class="pill ok">Approved${task.via ? ` · ${esc(task.via)}` : ''}</span>` : '<span class="pill bad">Rejected</span>';
  return `<div class="card-msg approval" data-task="${task.id}">
    <div class="box-head"><span class="label">Task · ${task.cost} credits</span>${state_}</div>
    <h4>${esc(task.title)}</h4>
    ${open ? `<p class="reasoning">${esc(task.reasoning)}</p>` : ''}
    <div class="btns">
      <button type="button" class="btn small" data-action="reasoning" data-id="${task.id}">${open ? 'Hide reasoning' : 'Show reasoning'}</button>
      ${task.status === 'approval' ? `<button type="button" class="btn small primary" data-action="approve" data-id="${task.id}">Approve</button><button type="button" class="btn small" data-action="reject" data-id="${task.id}">Reject</button>` : ''}
    </div>${compact ? '' : ''}
  </div>`;
}

function message(m) {
  const b = state.biz;
  if (m.from === 'you') return `<div class="msg you"><div class="bubble">${esc(m.text)}</div><span class="who">${time(m.at)}</span></div>`;
  if (m.from === 'system') return `<div class="card-msg"><span class="label">VibeStartup</span><p>${esc(m.text)}</p></div>`;
  const who = `<span class="who">${esc(b.cofounder)} · ${time(m.at)}${m.sample ? ' · <span class="sample">sample reply</span>' : ''}</span>`;
  if (m.kind === 'approval') { const t = b.tasks.find(x => x.id === m.task); return t ? `<div class="msg">${who}${approvalCard(t)}</div>` : ''; }
  if (m.kind === 'milestone') return `<div class="card-msg milestone"><span class="label">Milestone · ${time(m.at)}</span><h4>${esc(m.title)}</h4><p class="muted">${esc(m.text)}</p></div>`;
  if (m.kind === 'briefing') {
    const d = m.data;
    return `<div class="msg">${who}<div class="card-msg briefing"><span class="label">Daily briefing</span><h4>${esc(b.name)}, ${esc(d.date)}</h4>
      <div class="tiles">${d.tiles.map(([k, v, s]) => `<div class="tile"><span class="label">${esc(k)}</span><b>${esc(v)}</b><small>${esc(s)}</small></div>`).join('')}</div>
      <span class="label">Highlights</span><ul>${d.highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
      <details><summary>Today's plan</summary><ul>${d.plan.map(h => `<li>${esc(h)}</li>`).join('')}</ul></details></div></div>`;
  }
  if (m.kind === 'image') {
    const c = b.creatives.find(x => x.id === m.image);
    return `<div class="msg">${who}<div class="bubble">${esc(m.text)}${c ? `<br><img alt="${esc(c.name)}" src="${S.svgData(c.svg)}" style="max-width:260px;border-radius:6px;margin-top:8px">` : ''}</div></div>`;
  }
  return `<div class="msg">${who}<div class="bubble">${esc(m.text)}</div></div>`;
}

function weekList() {
  const b = state.biz;
  return `<ol class="week">${S.LAUNCH_WEEK.map((d, i) => { const n = i + 1, cls = n < b.day ? 'done' : n === b.day ? 'now' : ''; return `<li class="${cls}"><i>${n < b.day ? '✓' : n}</i><button type="button" class="linkish" data-action="day" data-n="${i}" title="Day ${n}: ${esc(d.title)}">${esc(d.title)}</button></li>`; }).join('')}</ol>`;
}

function moneyTiles() {
  const m = metrics();
  return `<div class="grid tiles" id="money">
    ${[['Total sales', S.money(m.total), m.tests ? `${m.tests} test` : ''], ['Net revenue', S.money(m.net), 'after card fees'], ['Payouts', S.money(m.payouts), ''], ['Profits', S.money(m.profits), 'after ad spend'], ['Balance', S.money(m.balance), m.balance >= S.PAYOUT_MIN ? 'payouts unlocked' : `payouts unlock at ${S.money(S.PAYOUT_MIN)}`]].map(([k, v, s]) => `<div class="tile" data-tile="${k}"><span class="label">${k}</span><b>${v}</b><small>${s}</small></div>`).join('')}
  </div>`;
}

function approvalsDock() {
  const pending = state.biz.tasks.filter(t => t.status === 'approval');
  return `<div class="box" id="dock"><div class="box-head"><h3>Needs your call</h3><span class="pill">${pending.length}</span></div>
    ${pending.length ? pending.map(t => approvalCard(t, true)).join('') : '<p class="muted">All clear. Nothing needs your call right now.</p>'}</div>`;
}

function autopilotSwitch(id) {
  return `<label class="switch"><input type="checkbox" role="switch" id="${id}" data-change="autopilot" ${state.biz.autopilot ? 'checked' : ''}> Autopilot ${state.biz.autopilot ? 'on' : 'off'}</label>`;
}

function chatView(r) {
  const b = state.biz;
  return `${head('Chat', `With ${esc(b.cofounder)}, your co-founder.`, autopilotSwitch('autopilot-chat'))}
  <div class="chat-layout">
    <div class="chat" id="chat">${b.messages.map(message).join('')}
      <form class="composer" data-form="chat"><label class="sr" for="composer">Message ${esc(b.cofounder)}</label><textarea id="composer" name="text" rows="2" placeholder="Message ${esc(b.cofounder)}…">${esc(r.draft ?? '')}</textarea><button class="btn primary" type="submit" id="send">Send</button></form>
    </div>
    <div class="rail">
      <div class="box"><span class="label">Launch week</span><h3 style="margin:2px 0 0">${b.day > 7 ? 'Complete' : `Day ${b.day} of 7`}</h3>${weekList()}</div>
      ${approvalsDock()}
      <div class="box"><span class="label">Money</span>${moneyTiles()}</div>
    </div>
  </div>`;
}

function dashboardView() {
  const b = state.biz, m = metrics(), logo = b.creatives.find(c => c.kind === 'brand');
  const d = ui.dayOpen;
  const cards = [
    ['Site', b.siteLive ? `<span class="pill ok">Live</span><p class="small">${b.slug}.vibestartup.pro</p><button type="button" class="btn small" data-action="store">Open my store</button>` : '<span class="pill warn">Not set up</span><p class="small muted">Waiting on your approval.</p>'],
    ['Brand kit', logo ? `<img alt="Brand kit" src="${S.svgData(logo.svg)}" style="border-radius:6px">` : '<p class="small muted">Not approved yet.</p>'],
    ['Library', `<p>${plural(b.creatives.length, 'piece')}</p><a href="#tab=studio" data-studio="library">Open the library</a>`],
    ['Tasks', `<p>${b.tasks.filter(t => t.status === 'approval').length} need you</p><a href="#tab=tasks">All tasks</a>`],
    ['Runtime', `<span class="pill ${b.siteLive ? 'ok' : ''}">${b.siteLive ? 'Ready' : 'Waits for the site'}</span><p class="small muted">Email, signing and checkout settings.</p>`],
    ['Checkout test', b.orders.some(o => o.test) ? '<span class="pill ok">Tested</span>' : '<p class="small muted">Not tested yet. Buy from your own store with the test card.</p><a href="#tab=products">Test it</a>'],
    ['Blueprint', `<p class="small">${esc(b.idea)}</p>`],
  ];
  return `${head('Dashboard', `${esc(b.name)} at a glance.`, autopilotSwitch('autopilot-dash'))}
  <div class="grid two">
    <div class="box" id="launch-week"><span class="label">Launch week</span><h2>${b.day > 7 ? 'Launch week is complete' : `Day ${b.day}: ${esc(S.LAUNCH_WEEK[b.day - 1].title)}`}</h2>${weekList()}
      ${d !== null ? `<p class="reasoning" id="day-about"><b>Day ${d + 1}: ${esc(S.LAUNCH_WEEK[d].title)}.</b> ${esc(S.LAUNCH_WEEK[d].about)}</p>` : ''}</div>
    ${approvalsDock()}
  </div>
  <h2 class="label" style="margin:22px 0 8px">Money</h2>${moneyTiles()}
  <p class="small muted">${m.balance >= S.PAYOUT_MIN ? 'Payout setup is unlocked.' : `Payout setup unlocks once the balance reaches ${S.money(S.PAYOUT_MIN)}.`}</p>
  <div class="grid two" style="margin-top:14px">
    <div class="box"><div class="box-head"><h3>Customer inbox</h3><a href="#tab=email">Open email</a></div><ul class="list">${b.emails.slice(0, 3).map(e => `<li><span class="grow"><b>${esc(e.subject)}</b><br><span class="small muted">${esc(e.from)} · ${day(e.at)}</span></span></li>`).join('')}</ul></div>
    <div class="grid cards3">${cards.map(([k, v]) => `<div class="box"><span class="label">${k}</span><div>${v}</div></div>`).join('')}</div>
  </div>`;
}

function analyticsView() {
  const b = state.biz, sales = b.orders.length;
  const ago = Math.round((now() - b.refreshedAt) / 60000);
  return `${head('Analytics', 'Visitors, carts and sales from your live storefront.', '<button type="button" class="btn small" data-action="refresh" id="refresh">Refresh</button>')}
  <p id="funnel"><b>${plural(b.visits, 'visitor')}</b> · ${plural(b.carts, 'cart')} · ${plural(b.checkouts, 'checkout')} · ${plural(sales, 'sale')} <span class="muted small">Updated ${ago < 1 ? 'just now' : `${ago} min ago`}</span></p>
  ${b.visits === 0 ? `<div class="box empty"><h3>No one has been by yet.</h3><p>${b.siteLive ? 'Your storefront is live but quiet. Share your link with people who already trust you, or try a small ad test.' : 'Your storefront is not live yet.'}</p><button type="button" class="btn" data-action="share-store" ${b.siteLive ? '' : 'disabled'}>Share your link</button></div>` : ''}
  <div class="box" style="margin-top:14px"><h3>Recent activity</h3>${b.events.length ? `<ul class="list" id="events">${b.events.map(e => `<li><span class="grow">${esc(e.text)}</span><span class="small muted">${time(e.at)}</span></li>`).join('')}</ul>` : '<p class="muted">Activity shows here as soon as anyone visits.</p>'}</div>`;
}

function tasksView() {
  const b = state.biz;
  const group = (title, list) => list.length ? `<div class="box"><div class="box-head"><h3>${title}</h3><span class="pill">${list.length}</span></div><ul class="list">${list.map(t => `<li><button type="button" class="linkish grow" data-action="open-task" data-id="${t.id}" style="text-align:left">${esc(t.title)}</button><span class="small muted">${t.cost} cr · ${day(t.at)}</span>${ui.open['t' + t.id] ? `<p class="reasoning" style="width:100%">${esc(t.reasoning)}</p>` : ''}${t.status === 'approval' ? `<span class="btns"><button type="button" class="btn small primary" data-action="approve" data-id="${t.id}">Approve</button><button type="button" class="btn small" data-action="reject" data-id="${t.id}">Reject</button></span>` : ''}</li>`).join('')}</ul></div>` : '';
  const routines = b.routines.filter(r => r.status !== 'cancelled');
  return `${head('Tasks', 'Approvals waiting on you, work under way, and the routines that run on a schedule.')}
  <div class="grid">
    ${group('Needs your call', b.tasks.filter(t => t.status === 'approval'))}
    ${group('Done', b.tasks.filter(t => t.status === 'done').reverse())}
    ${group('Rejected', b.tasks.filter(t => t.status === 'rejected'))}
    <div class="box" id="routines"><div class="box-head"><h3>Recurring</h3><span class="pill">${routines.length}</span></div>
      <ul class="list">${routines.map(r => `<li><button type="button" class="linkish grow" data-action="routine" data-id="${r.id}" style="text-align:left">${esc(r.name)}</button><span class="pill ${r.status === 'active' ? 'ok' : 'warn'}">${r.status === 'active' ? 'Active' : 'Paused'}</span><span class="small muted">${esc(r.schedule)}</span>${ui.open['r' + r.id] ? routineDetail(r) : ''}</li>`).join('') || '<li class="muted">No routines.</li>'}</ul>
      ${ui.newRoutine ? `<form class="panel" data-form="routine-new" id="routine-new" style="width:100%">
        <label class="field">Name<input name="name" required placeholder="e.g. Weekly review"></label>
        <label class="field">What your co-founder should do each run<textarea name="instructions" rows="3" placeholder="Summarise the week: numbers, what shipped, what waits on me"></textarea></label>
        <div class="row2"><label class="field">Schedule in words<input name="schedule" value="every Monday at 9am"></label>
        <label class="field">Runs every<select name="every">${EVERY.map(e => `<option ${e === 'Weekly' ? 'selected' : ''}>${e}</option>`).join('')}</select></label></div>
        <div class="btns"><button class="btn primary" type="submit">Create routine</button><button type="button" class="btn" data-action="new-routine">Cancel</button></div></form>` : `<div class="btns"><button type="button" class="btn small" data-action="new-routine" id="add-routine">+ New routine</button></div>`}</div>
  </div>`;
}

function routineDetail(r) {
  if (ui.routineEdit === r.id) return `<form class="panel" style="width:100%" data-form="routine" data-id="${r.id}" id="routine-form">
    <label class="field">Name<input name="name" value="${esc(r.name)}" required></label>
    <label class="field">Instructions<textarea name="instructions" rows="3" placeholder="What your co-founder does each run">${esc(r.instructions)}</textarea></label>
    <label class="field">Schedule<input name="schedule" value="${esc(r.schedule)}" placeholder="e.g. every weekday at 9am"></label>
    <label class="field">Runs every<select name="every">${EVERY.map(e => `<option ${e === r.every ? 'selected' : ''}>${e}</option>`).join('')}</select></label>
    <div class="btns"><button class="btn primary" type="submit">Save changes</button><button type="button" class="btn" data-action="routine-edit" data-id="">Cancel</button></div></form>`;
  return `<div class="panel" style="width:100%" id="routine-detail">
    <p class="small"><b>Schedule</b> ${esc(r.schedule)} · <b>Runs every</b> ${esc(r.every)} · <b>Created by</b> ${esc(r.by)}</p>
    <p class="small"><b>Last run</b> ${r.lastRun ? new Date(r.lastRun).toLocaleString('en-US') : 'never'}</p>
    <p>${esc(r.instructions)}</p>
    ${r.lastResult ? `<p class="reasoning"><b>Last result.</b> ${esc(r.lastResult)}</p>` : ''}
    <div class="btns"><button type="button" class="btn small" data-action="routine-edit" data-id="${r.id}">Edit</button><button type="button" class="btn small" data-action="routine-run" data-id="${r.id}">Run now</button><button type="button" class="btn small" data-action="routine-pause" data-id="${r.id}">${r.status === 'active' ? 'Pause' : 'Resume'}</button><button type="button" class="btn small danger" data-action="routine-cancel" data-id="${r.id}">Cancel routine</button></div></div>`;
}

function emailView() {
  const b = state.biz, address = `team@${b.slug}.vibestartup.pro`;
  const folders = [['all', 'All mail', () => true], ['inbox', 'Inbox', e => e.folder === 'inbox'], ['unread', 'Unread', e => !e.read], ['sent', 'Sent', e => e.folder === 'sent'], ['drafts', 'Drafts', e => e.folder === 'drafts']];
  const f = folders.find(x => x[0] === ui.mailFolder) ?? folders[0];
  const q = ui.mailSearch.toLowerCase();
  const list = b.emails.filter(f[2]).filter(e => !q || `${e.subject} ${e.body} ${e.from}`.toLowerCase().includes(q));
  const t = ui.mailThread && b.emails.find(e => e.id === ui.mailThread);
  const pending = t?.approval && b.tasks.find(x => x.id === t.approval && x.status === 'approval');
  return `${head('Email', `The business inbox: ${esc(address)}`)}
  <div class="box" style="margin-bottom:14px"><div class="box-head"><h3>Mailboxes and sending identities</h3></div>
    <p class="small">Every address your co-founder can receive at and send from. Sending defaults to <b>${esc(address)}</b>; replies use the address the customer wrote to.</p>
    <ul class="list"><li><span class="grow"><code>${esc(address)}</code> <span class="pill">Default sender</span></span><button type="button" class="btn small" data-action="copy" data-text="${esc(address)}">Copy</button></li></ul>
    <p class="small muted">Your own domain: on Growth and Scale plans.</p></div>
  <div class="mail">
    <div class="folders" role="tablist">${folders.map(([id, label, fn]) => `<button type="button" data-action="folder" data-id="${id}" aria-current="${id === f[0]}">${label}<span>${b.emails.filter(fn).length || ''}</span></button>`).join('')}</div>
    <div class="box">${t ? `
      <button type="button" class="btn small" data-action="thread" data-id="">Back</button>
      <h2 style="margin:12px 0 2px" id="thread-subject">${esc(t.subject)}</h2>
      <p class="small muted">From ${esc(t.from)} to ${esc(t.to)} · ${new Date(t.at).toLocaleString('en-US')}${t.by === 'co-founder' ? ' · sent by co-founder' : ''}</p>
      ${pending ? `<div class="reasoning" id="email-approval">Waiting on you: <b>${esc(pending.title)}</b><div class="btns" style="margin-top:6px"><button type="button" class="btn small primary" data-action="approve" data-id="${pending.id}" data-via="email">Approve</button><button type="button" class="btn small" data-action="reject" data-id="${pending.id}">Reject</button></div><span class="small muted">One tap. In the live app these work from the email itself.</span></div>` : ''}
      <div class="email-body">${esc(t.body)}</div>
      <form data-form="reply" data-id="${t.id}" style="margin-top:12px"><label class="field">Reply yourself<textarea name="text" rows="3"></textarea></label><div class="btns"><button class="btn primary" type="submit">Send reply</button><a class="btn" href="${chatLink(`Help me answer the email "${t.subject}"`)}">Ask co-founder</a></div></form>`
      : `<label class="sr" for="mail-search">Search mail</label><input id="mail-search" type="search" data-input="mail-search" placeholder="Search mail" value="${esc(ui.mailSearch)}" style="width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text)">
      <p class="small muted">Your co-founder can watch and handle these threads. You stay in control of every send.</p>
      ${list.length ? list.map(e => `<button type="button" class="thread-row ${e.read ? '' : 'unread'}" data-action="thread" data-id="${e.id}"><b>${esc(e.subject)}</b><span>${esc(e.from)} · ${day(e.at)} · ${esc(e.body.slice(0, 90))}</span></button>`).join('') : '<p class="muted">Nothing here.</p>'}`}
    </div>
  </div>`;
}

function productsView() {
  const b = state.biz, subs = b.products.filter(p => p.billing === 'recurring' && p.status === 'active');
  const desc = p => `${S.money(p.price)} USD${p.billing === 'recurring' ? ` / ${p.interval}` : ''} · ${p.billing === 'recurring' ? 'Recurring' : 'One-time'} · ${esc(p.type)}`;
  return `${head('Products', plural(b.products.filter(p => p.status !== 'archived').length, 'product'), `<span class="btns"><button type="button" class="btn small" data-action="store" ${b.siteLive ? '' : 'disabled'}>Open my store</button><button type="button" class="btn small primary" data-action="new-product" id="add-product">+ Add product</button></span>`)}
  ${ui.newProduct ? `<form class="panel" data-form="product" id="product-form" style="margin-bottom:14px">
    <h2 style="margin:0">New product</h2>
    <label class="field">Name<input name="name" id="p-name" required placeholder="e.g. A starter guide"></label>
    <label class="field">Description<input name="desc" id="p-desc" placeholder="A short product description"></label>
    <div class="row2"><label class="field">Price (USD)<input name="price" id="p-price" type="number" min="0" step="0.01" required placeholder="19.99"></label>
    <label class="field">Type<input name="type" id="p-type" placeholder="digital, service, physical…"></label></div>
    <div class="row2"><label class="field">Billing<select name="billing" id="p-billing" data-change="billing"><option value="one-time">One-time</option><option value="recurring" ${ui.recurring ? 'selected' : ''}>Recurring</option></select></label>
    <label class="field ${ui.recurring ? '' : 'hidden'}">Billing interval<select name="interval" id="p-interval"><option value="week">Weekly</option><option value="month" selected>Monthly</option><option value="year">Yearly</option></select></label></div>
    <label class="field">Status<select name="status" id="p-status"><option value="active">Active</option><option value="draft">Draft</option></select></label>
    <div class="btns"><button class="btn primary" type="submit" id="create-product">Create product</button><button type="button" class="btn" data-action="new-product">Cancel</button></div></form>` : ''}
  <div class="box" style="margin-bottom:14px"><div class="box-head"><h3>Test your checkout <span class="pill">Beta</span></h3></div><p class="small">Buy from your own store with the test card <code>${S.TEST_CARD}</code>, any future date and any three digits. No card is charged; the order is marked as a test.</p></div>
  <div class="box" id="product-list">${b.products.length ? `<ul class="list">${b.products.map(p => `<li data-product="${esc(p.name)}"><span class="grow"><b>${esc(p.name)}</b> <span class="pill ${p.status === 'active' ? 'ok' : p.status === 'draft' ? 'warn' : ''}">${p.status[0].toUpperCase() + p.status.slice(1)}</span><br><span class="small muted">${desc(p)}${p.desc ? ` · ${esc(p.desc)}` : ''}</span></span>
      <span class="btns">${p.status === 'active' ? `<button type="button" class="btn small primary" data-action="test-buy" data-id="${p.id}">Test buy</button>` : `<span class="small muted">Activate it to test-buy it.</span>`}${p.status !== 'active' ? `<button type="button" class="btn small" data-action="product-status" data-id="${p.id}" data-to="active">Activate</button>` : ''}${p.status !== 'archived' ? `<button type="button" class="btn small" data-action="product-status" data-id="${p.id}" data-to="archived">Archive</button>` : ''}</span></li>`).join('')}</ul>` : '<div class="empty"><h3>No products yet.</h3><p>Add your first offer. One clear product at one price is the best start.</p></div>'}</div>
  <div class="box" style="margin-top:14px"><h3>Customer subscriptions</h3><p class="small muted">Recurring revenue and who has access.</p>
    <div class="grid tiles"><div class="tile"><span class="label">Active</span><b>0</b></div><div class="tile"><span class="label">Monthly revenue</span><b>$0.00</b></div><div class="tile"><span class="label">Needs attention</span><b>0</b></div><div class="tile"><span class="label">Ending soon</span><b>0</b></div></div>
    <p class="small muted">${subs.length ? `${plural(subs.length, 'recurring product')} active. New subscriptions and renewals show here.` : 'No subscribers yet. Make an active recurring product and share its checkout link.'}</p></div>`;
}

function ordersView() {
  const b = state.biz;
  return `${head('Orders', 'Every paid order, newest first. Delivery says what the buyer got, or what is left for you to do.')}
  <div class="box" id="orders">${b.orders.length ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Product</th><th>Buyer</th><th>Amount</th><th>Delivery</th></tr></thead><tbody>${b.orders.map(o => `<tr><td>${day(o.at)} ${time(o.at)}</td><td>${esc(o.name)} ${o.test ? '<span class="pill warn">Test</span>' : ''}</td><td>${esc(o.email)}</td><td>${S.money(o.amount)}</td><td>${esc(o.delivery)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><h3>No sales yet.</h3><p>When a buyer pays, the order shows here with what they got.</p></div>'}</div>`;
}

function customersView() {
  const b = state.biz;
  return `${head('Customers', 'Everyone who bought or signed up.')}
  <div class="box" id="customers">${b.customers.length ? `<div class="table-wrap"><table><thead><tr><th>Email</th><th>Since</th><th>Orders</th><th>Spent</th></tr></thead><tbody>${b.customers.map(c => `<tr><td>${esc(c.email)} ${c.test ? '<span class="pill warn">Test</span>' : ''}</td><td>${day(c.first)}</td><td>${c.orders}</td><td>${S.money(c.spent)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty"><h3>No customers yet.</h3><p>They show up here as people buy or sign up on your site.</p><a class="btn" href="${chatLink('How do I get my first customers?')}">Ask your co-founder</a></div>`}</div>`;
}

function readiness() {
  const b = state.biz, active = b.products.find(p => p.status === 'active'), m = metrics();
  return [
    ['Your storefront', b.siteLive, b.siteLive ? 'Live, so ads have somewhere to send people.' : 'The storefront must be live before ads can send people to it.'],
    ['What we promote', !!active, active ? `${active.name}: what your ads point people to.` : 'Activate a product to promote.'],
    ['Taking payment', b.orders.length > 0, b.orders.length ? 'Checkout is tested; each sale can be traced to the ad.' : 'Test your checkout first.'],
    ['Sales tracking', b.siteLive, b.siteLive ? 'We can tell which sales come from ads.' : 'Tracking starts with the live storefront.'],
    ['Ad account', false, 'Connect an ad account in the live app, through the platform\'s own login.'],
    ['Subscription', false, 'An active subscription is needed to start ads.'],
    ['Sales history', true, m.real ? `${plural(m.real, 'real sale')} so far.` : 'No real sales yet, so we start small and careful.'],
  ];
}

function adsView() {
  const b = state.biz, a = b.ads, active = b.products.find(p => p.status === 'active');
  const weekly = a.daily * 7, target = active ? active.price * 0.3 : 0, perWeek = active && active.price ? Math.ceil(weekly / active.price) : 0;
  const ready = readiness(), blockers = ready.filter(r => !r[1]);
  return `${head('Ads', 'Your co-founder plans, launches and improves one focused campaign, within the budget you approve.')}
  <div class="grid two">
    <div class="box"><span class="label">Goal</span><h2>More sales of ${esc(active?.name ?? 'your first product')}</h2>
      <p class="small">One campaign, run by your co-founder, that improves as it goes. ${blockers.length ? `<span class="pill warn" id="ads-state">Blocked: ${blockers.length}</span>` : '<span class="pill ok" id="ads-state">Ready</span>'}</p>
      <form data-form="ads" class="inline" id="ads-form"><label class="sr" for="ads-daily">Daily budget</label><input id="ads-daily" name="daily" type="number" min="1" step="1" value="${a.daily}"><span class="small">$ a day</span><label class="sr" for="ads-days">Window</label><select id="ads-days" name="days">${[7, 14, 21, 28].map(d => `<option value="${d}" ${d === a.days ? 'selected' : ''}>${d} days</option>`).join('')}</select><button class="btn small" type="submit">Set budget</button></form>
      <p class="small"><b>${S.money(a.daily)} a day</b>, at most ${S.money(weekly)} a week, every fee included. Give it ${a.days} days: early results are noisy while the platform finds your buyers.</p>
      <p class="small"><b>What success looks like.</b> ${active ? `A sale for under ${S.money(target)} of ad spend. At ${S.money(weekly)} a week, about ${plural(perWeek, 'sale')} a week bring in as much as the budget.` : 'Set once a product is active.'}</p></div>
    <div class="box" id="readiness"><div class="box-head"><h3>Why this should work</h3><button type="button" class="btn small" data-action="recheck" id="recheck">Recheck plan</button></div>
      <ul class="list">${ready.map(([k, ok, why]) => `<li><span class="grow"><b>${k}</b>: ${esc(why)}</span><span class="pill ${ok ? 'ok' : 'warn'}">${ok ? 'Ready' : 'Blocker'}</span></li>`).join('')}</ul>
      ${a.checked ? `<p class="reasoning small" id="recheck-result">Plan rechecked ${time(a.checked)}: ${blockers.length ? `${plural(blockers.length, 'blocker')} remain (${blockers.map(x => x[0]).join(', ')}).` : 'no blockers.'}</p>` : ''}
      <div class="btns"><a class="btn small" href="${chatLink('Fix the blockers in my ads plan that you are allowed to fix, recheck it, and tell me exactly what remains.')}">Ask co-founder to fix blockers</a><a class="btn small" href="${chatLink('Review my ads plan. Explain or change specific assumptions only where needed.')}">Tune specifics</a></div></div>
    <div class="box"><h3>Ad ideas</h3><ul class="list"><li><span class="grow"><b>Proof in use</b> (starting ad): the product solving a real problem, in a believable moment.</span></li><li><span class="grow"><b>Problem to outcome</b> (test): the costly problem first, then the outcome and the offer.</span></li><li><span class="grow"><b>Founder note</b> (test): who it is for, why it exists, the simplest next step.</span></li></ul>
      <h3 style="margin-top:12px">What your co-founder handles</h3><ul class="small"><li>Pause delivery for safety, tracking or budget problems.</li><li>Rotate approved creatives without raising spend.</li><li>Adjust delivery inside the approved goal and area.</li></ul></div>
    <div class="box"><h3>What we based this on</h3><ul class="list">
      <li><span class="grow">Goal: sales on your storefront.</span><span class="pill ok">solid</span></li>
      <li><span class="grow">Offer: ${esc(active?.name ?? 'none yet')}.</span><span class="pill">good estimate</span></li>
      <li><span class="grow">Target cost per sale: ${active ? S.money(target) : '—'}.</span><span class="pill warn">best guess</span></li></ul>
      <h3 style="margin-top:12px">Outcomes, last 28 days</h3><div class="grid tiles"><div class="tile"><span class="label">Verified purchases</span><b>0</b></div><div class="tile"><span class="label">Verified revenue</span><b>$0.00</b></div><div class="tile"><span class="label">You spent</span><b>$0.00</b></div><div class="tile"><span class="label">Return</span><b>—</b></div></div>
      <p class="small muted">Only sales completed on your storefront that trace back to an ad count.</p>
      <h3>Decision history</h3><ul class="small">${a.history.map(h => `<li>${day(h.at)} · ${esc(h.what)}</li>`).join('')}</ul></div>
  </div>
  <div class="box" style="margin-top:14px"><h3>Campaigns and creative</h3><p class="small muted">0 campaigns · 0 drafts · ${plural(b.creatives.filter(c => c.kind === 'offer').length, 'asset')}</p><a class="btn small" href="${chatLink('Draft an ad campaign proposal for my business')}">Ask co-founder to draft one</a></div>`;
}

function studioView() {
  const b = state.biz, tabs = [['make', 'Make'], ['month', 'This month'], ['brand', 'Brand book'], ['formats', 'Formats'], ['library', 'Library']];
  const f = S.FORMATS.find(x => x.id === ui.format) ?? S.FORMATS[0];
  const body = {
    make: () => `<div class="box"><h3>What kind</h3><div class="chips">${S.FORMATS.map(x => `<button type="button" data-action="format" data-id="${x.id}" aria-pressed="${x.id === f.id}" ${x.ready ? '' : 'disabled title="Not ready yet"'}>${x.name}${x.ready ? '' : ' · not ready yet'}</button>`).join('')}</div>
      <p class="small muted">${esc(f.about)} Comes back in ${f.sizes}, ${f.takes}.</p>
      <form data-form="make" id="make-form">
        <label class="field">What do you want<textarea name="prompt" id="studio-prompt" data-input="studio-prompt" rows="2" placeholder="A launch-week post for the starter guide, 20% off through Sunday">${esc(ui.prompt ?? '')}</textarea></label>
        <span class="label">Look</span><div class="chips">${S.LOOKS.map(l => `<button type="button" data-action="look" data-id="${l}" aria-pressed="${l === ui.look}">${l}</button>`).join('')}</div>
        <span class="label" style="display:block;margin-top:10px">How many options</span><div class="chips" id="count">${[2, 3, 4, 5].map(n => `<button type="button" data-action="count" data-id="${n}" aria-pressed="${n === ui.count}">${n}</button>`).join('')}</div>
        <label class="field">About which product<select name="product" id="studio-product" data-change="studio-product"><option value="">None</option>${b.products.filter(p => p.status !== 'archived').map(p => `<option value="${p.id}" ${p.id === ui.product ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
        <span class="label">Use these as reference (optional)</span><div class="refs">${b.creatives.length ? b.creatives.map(c => `<label><input type="checkbox" data-change="ref" value="${c.id}" ${ui.refs.includes(c.id) ? 'checked' : ''}><img alt="" src="${S.svgData(c.svg)}">${esc(c.name)}</label>`).join('') : '<span class="small muted">Nothing in the library yet.</span>'}</div>
        <div class="btns" style="margin-top:12px"><button class="btn primary" type="submit" id="make">Make ${ui.count} · about ${ui.count * f.low} to ${ui.count * f.high} credits</button></div>
        <p class="small muted">A range, not a price: you pay for what comes back, never more than the top of the range.</p>
      </form>
      ${ui.made.length ? `<h3>Just made</h3><div class="creatives">${ui.made.map(id => b.creatives.find(c => c.id === id)).filter(Boolean).map(creative).join('')}</div>` : ''}</div>`,
    month: () => `<div class="box"><span class="label">This month's plan</span><h3>${b.creativeBudget ? `${b.creativeBudget} credits a month` : 'No monthly budget yet'}</h3>
      <p class="small">Tell your co-founder what to spend on creative each month, and it keeps your feed and your ads stocked on its own, inside that number.</p>
      <form data-form="budget" class="inline"><label class="sr" for="budget">Monthly creative budget in credits</label><input id="budget" name="budget" type="number" min="0" step="10" value="${b.creativeBudget ?? ''}" placeholder="Credits a month"><button class="btn small" type="submit">Set the budget</button></form>
      ${b.creativeBudget ? `<p class="small muted">About ${Math.floor(b.creativeBudget / 4)} offer images a month.</p>` : ''}</div>`,
    brand: () => b.brandReady ? `<div class="box" id="brand-book"><h3>How things will look</h3><div class="swatches">${['primary', 'secondary', 'accent', 'ground', 'ink'].map(k => `<div><i style="background:${b.brand[k]}"></i>${k[0].toUpperCase() + k.slice(1)}</div>`).join('')}</div><p><b>Type.</b> ${esc(b.brand.type)}.</p><p><b>Voice.</b> ${b.brand.voice.join(', ')}.</p></div>` : '<div class="box empty"><h3>No brand book yet.</h3><p>It comes with the brand kit, once you approve it.</p></div>',
    formats: () => `<div class="box"><h3>What I can make</h3><div class="table-wrap"><table><thead><tr><th>Format</th><th>Comes back as</th><th>Takes</th><th>Each</th></tr></thead><tbody>${S.FORMATS.map(x => `<tr><td><b>${x.name}</b>${x.ready ? '' : ' <span class="pill">Not ready yet</span>'}<br><span class="small muted">${x.about}</span></td><td>${x.sizes}</td><td>${x.takes}</td><td>about ${x.low} to ${x.high} credits</td></tr>`).join('')}</tbody></table></div></div>`,
    library: () => `<div class="box" id="library"><h3>Everything made for you, and by you</h3>${b.creatives.length ? `<div class="creatives">${b.creatives.map(creative).join('')}</div>` : '<p class="muted">Nothing yet.</p>'}</div>`,
  };
  return `${head('Studio', 'Everything your co-founder makes for you, and everything you make yourself.')}
  <div class="subtabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" data-action="studio" data-id="${id}" aria-selected="${id === ui.studio}">${label}</button>`).join('')}</div>${body[ui.studio]()}`;
}

function creative(c) {
  return `<div class="creative ${c.kind === 'offer' ? '' : 'square'}" data-creative="${esc(c.name)}"><img alt="${esc(c.name)}" src="${S.svgData(c.svg)}"><div><span>${esc(c.name)}</span><a href="${S.svgData(c.svg)}" download="${esc(c.name)}">Download</a></div></div>`;
}

function outboundView() {
  const b = state.biz, c = b.campaigns.at(-1);
  return `${head('Outbound', 'Campaigns to people who have not heard of you yet, one lead at a time.')}
  <div class="grid two">
    <div class="box">${c ? `<h3>${esc(c.name)}</h3><ol class="small" id="sequence">${c.steps.map(([d, w]) => `<li><b>${d}</b>: ${esc(w)}</li>`).join('')}</ol>` : `<div class="empty"><h3>No campaigns yet</h3><p>Ask your co-founder to build one. Then upload your own leads, read its sequence, and follow each lead through it here.</p></div>`}
      <div class="btns"><button type="button" class="btn small" data-action="campaign" ${b.tasks.some(t => t.effect === 'campaign' && t.status === 'approval') ? 'disabled' : ''}>Ask co-founder to build a campaign</button></div></div>
    <div class="box"><h3>Leads</h3><label class="field">Upload leads (CSV with name and email)<input type="file" accept=".csv,text/csv" id="leads-file" data-change="leads"></label>
      ${b.leads.length ? `<div class="table-wrap"><table id="leads"><thead><tr><th>Name</th><th>Email</th><th>Step</th></tr></thead><tbody>${b.leads.map(l => `<tr><td>${esc(l.name)}</td><td>${esc(l.email)}</td><td>${c ? 'Queued · nothing sent in the demo' : 'Waiting for a campaign'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="small muted">No leads yet. The file is read in this browser only.</p>'}</div>
  </div>`;
}

function socialView() {
  const b = state.biz, d = new Date(), y = d.getFullYear(), mo = d.getMonth(), first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
  const cells = [...Array(first)].map(() => '<div></div>').concat([...Array(days)].map((_, i) => { const n = i + 1, ps = b.posts.filter(p => p.date === `${y}-${String(mo + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`); return `<div class="${n === d.getDate() ? 'today' : ''}">${n}${ps.map(p => `<span class="post" title="${esc(p.text)}">${esc(p.text)}</span>`).join('')}</div>`; }));
  return `${head('Social', 'Posting on your accounts, or ready for you to post yourself.')}
  <div class="grid two">
    <div class="box"><h3>Automatic publishing</h3><p class="small muted">Accounts connect through each platform's own login. VibeStartup never sees or keeps your social passwords.</p>
      <ul class="list" id="accounts">${S.SOCIAL.map(s => `<li><span class="grow">${s}<br><span class="small muted">${b.social.asked.includes(s) ? 'In the live app, this opens the platform\'s own login. Not available in the demo.' : 'Not connected'}</span></span><button type="button" class="btn small" data-action="connect" data-id="${esc(s)}">Connect</button></li>`).join('')}</ul></div>
    <div class="box"><h3>Personal profiles</h3><p class="small">For personal accounts, your co-founder prepares the picture and the caption and texts them to you. You post it yourself, so your account stays yours.</p>
      <label class="switch"><input type="checkbox" role="switch" data-change="personal" ${b.social.personal ? 'checked' : ''}> Use my personal profile</label>
      <h3 style="margin-top:16px">Compose</h3><form data-form="post"><label class="field">Post<textarea name="text" id="post-text" rows="2" required></textarea></label><label class="field">Day<input type="date" name="date" id="post-date" required value="${d.toISOString().slice(0, 10)}"></label><button class="btn small primary" type="submit">Schedule</button></form></div>
  </div>
  <div class="box" style="margin-top:14px"><div class="box-head"><h3>Posts · ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3><span class="chips"><button type="button" data-action="social-view" data-id="calendar" aria-pressed="${ui.socialView === 'calendar'}">Calendar</button><button type="button" data-action="social-view" data-id="list" aria-pressed="${ui.socialView === 'list'}">List</button></span></div>
    ${ui.socialView === 'calendar' ? `<div class="cal">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(w => `<div class="dow">${w}</div>`).join('')}${cells.join('')}</div>` : `<ul class="list">${b.posts.map(p => `<li><span class="grow">${esc(p.text)}</span><span class="small muted">${p.date} · ${esc(p.status)}</span></li>`).join('') || '<li class="muted">No posts yet.</li>'}</ul>`}</div>`;
}

function allFiles() {
  const b = state.biz;
  return (b.files ?? []).concat(b.creatives.map(c => ({ name: c.name, group: 'Creative assets', about: 'Image', svg: c.svg })));
}

function filesView() {
  const q = ui.fileSearch.toLowerCase(), files = allFiles().filter(f => !q || `${f.name} ${f.body ?? ''}`.toLowerCase().includes(q));
  const groups = ['Identity', 'Operations', 'Evolving', 'Other', 'Creative assets'];
  return `${head('Files', 'The business as files: what your co-founder reads at the start of every session.', '<label class="btn small">Upload<input type="file" class="sr" data-change="upload" accept=".md,.txt,text/*"></label>')}
  <div class="box"><label class="sr" for="file-search">Search names and contents</label><input id="file-search" type="search" data-input="file-search" value="${esc(ui.fileSearch)}" placeholder="Search names and contents" style="width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--text)">
    <p class="small muted">${plural(files.length, 'file')}</p>
    ${groups.map(g => { const fs = files.filter(f => f.group === g); return fs.length ? `<h3 class="label" style="margin:14px 0 4px">${g}</h3>${fs.map(f => `<button type="button" class="file-row" data-action="preview" data-id="${esc(f.name)}"><b>${esc(f.name)}</b><span>${esc(f.about)}</span></button>`).join('')}` : ''; }).join('')}</div>`;
}

function legalView() {
  const b = state.biz, m = metrics(), rec = m.real >= 3 || m.realRevenue >= 100;
  return `${head('Legal', 'The company behind the business, and the pages every store needs.')}
  <div class="grid two">
    <div class="box" id="formation"><h3>Company formation</h3>
      <p>${b.formation ? `<span class="pill ok">Drafts ready</span> Formation papers were prepared ${day(b.formation.at)} for you to read.` : 'No formation in progress. Once the business has real traction, your co-founder can propose forming a company, with the papers prepared for you.'}</p>
      <p class="small ${rec ? '' : 'muted'}" id="formation-gate">${rec ? 'Recommended now' : 'Recommended once you have about 3 real sales or $100 in revenue'}: you have ${plural(m.real, 'real sale')} and ${S.money(m.realRevenue)} so far${m.tests ? ` (${plural(m.tests, 'test sale')} do not count)` : ''}. The costs recur, so it is your call.</p>
      <button type="button" class="btn small" data-action="formation" ${b.formation || b.tasks.some(t => t.effect === 'formation' && t.status === 'approval') ? 'disabled' : ''}>Ask co-founder to prepare it</button></div>
    <div class="box"><h3>Store pages</h3><ul class="list"><li><span class="grow">Terms of sale <span class="pill">Draft</span></span><button type="button" class="btn small" data-action="preview" data-id="TERMS.md">Read</button></li><li><span class="grow">Privacy notice <span class="pill">Draft</span></span><button type="button" class="btn small" data-action="preview" data-id="PRIVACY.md">Read</button></li></ul><p class="small muted">Drafts, not legal advice. Have them read before real customers rely on them.</p></div>
  </div>`;
}

function settingsView() {
  const b = state.biz, owner = state.profile;
  const built = b.counters.pages * S.RATES.page + b.counters.emails * S.RATES.email + b.counters.deploys * S.RATES.deploy + b.creatives.filter(c => c.kind === 'offer').length * S.RATES.image;
  return `${head('Settings', esc(b.name))}
  <div class="grid two">
    <div class="box"><h3>Autonomy</h3><p class="small">Let your co-founder act on its own and brief you on progress.</p>${autopilotSwitch('autopilot-settings')}
      <label class="field">Briefing frequency<select data-change="briefing" id="briefing">${['Daily digest', 'Weekly digest', 'Only when something needs me'].map(o => `<option ${o === b.briefing ? 'selected' : ''}>${o}</option>`).join('')}</select></label></div>
    <div class="box"><h3>Subscription</h3><p class="small">Your plan, billing and payment method.</p><a class="btn small" href="#tab=billing">Manage plan</a>
      <h3 style="margin-top:14px">Custom domain</h3><p class="small">Bring your own domain (Growth and Scale plans).</p>
      <form data-form="domain" class="inline"><label class="sr" for="domain">Domain</label><input id="domain" name="domain" placeholder="example.com" value="${esc(b.domain)}"><button class="btn small" type="submit">Add domain</button></form>
      ${b.domain ? `<p class="small reasoning">Add a CNAME record from <code>${esc(b.domain)}</code> to <code>${esc(b.slug)}.vibestartup.pro</code>. Status: waiting for DNS (the demo never checks).</p>` : ''}</div>
    <div class="box"><h3>Environment secrets</h3><p class="small">Provider keys for your storefront's server code, kept encrypted and never shown in chat.</p><a class="btn small" href="#tab=secrets" id="manage-secrets">Manage</a>
      <h3 style="margin-top:14px">Platform runtime</h3><p class="small">The settings VibeStartup manages on your site: email, signing, checkout lookup. <span class="pill ${b.siteLive ? 'ok' : ''}">${b.siteLive ? 'Ready' : 'Waits for the site'}</span></p></div>
    <div class="box" id="built"><div class="box-head"><h3>What your co-founder built</h3><b>${S.money(built).replace('.00', '')}</b></div><p class="small muted">What it would cost to hire a freelancer for it; included in your plan.</p>
      <ul class="list small"><li><span class="grow">${plural(b.counters.pages, 'page')} built</span>${S.money(b.counters.pages * S.RATES.page)}</li><li><span class="grow">${plural(b.counters.emails, 'email')} composed</span>${S.money(b.counters.emails * S.RATES.email)}</li><li><span class="grow">${plural(b.counters.deploys, 'deployment')}</span>${S.money(b.counters.deploys * S.RATES.deploy)}</li><li><span class="grow">${plural(b.creatives.filter(c => c.kind === 'offer').length, 'image')} made</span>${S.money(b.creatives.filter(c => c.kind === 'offer').length * S.RATES.image)}</li></ul></div>
    <div class="box" id="members"><h3>Members</h3><p class="small">Invite teammates to see or help run this business. <span id="seats">${b.members.length} of ${S.SEATS} seats used</span></p>
      <form data-form="invite" class="inline"><label class="sr" for="invite-email">Invite email address</label><input id="invite-email" name="email" type="email" required placeholder="teammate@example.com"><label class="sr" for="invite-role">Role</label><select id="invite-role" name="role"><option value="Viewer">Viewer: read-only revenue, analytics, products, activity</option><option value="Admin">Admin: everything but billing, autonomy and owner settings</option></select><button class="btn small primary" type="submit" id="invite">Invite</button></form>
      ${b.members.length ? `<h3 class="label" style="margin-top:10px">Pending invites</h3><ul class="list">${b.members.map(m => `<li><span class="grow">${esc(m.email)} · ${m.role} · invited ${day(m.at)}${m.resent ? ' · re-sent' : ''}</span><span class="btns"><button type="button" class="btn small" data-action="resend" data-id="${esc(m.email)}">Re-send</button><button type="button" class="btn small" data-action="revoke" data-id="${esc(m.email)}">Revoke</button></span></li>`).join('')}</ul>` : ''}
      <ul class="list"><li><span class="grow">${esc(owner.name || 'You')} ${owner.email ? `· ${esc(owner.email)}` : ''}</span><span class="pill">Owner</span></li></ul></div>
    <div class="box"><h3>Danger zone</h3><p class="small">Remove this business, its storefront and its data, for good.</p><button type="button" class="btn small danger" data-action="delete-biz" id="delete-biz">Delete business</button></div>
  </div>`;
}

function secretsView() {
  const b = state.biz;
  return `<p><a href="#tab=settings">Back to settings</a></p>${head('Environment secrets', 'Provider keys for your storefront. The app keeps the name and a one-way digest, never the value: a key goes to your storefront\'s runtime when that provider is connected, so you never paste one into chat.')}
  <div class="grid two">
    <form class="box" data-form="secret" id="secret-form"><h3>${ui.secretEdit ? `Replace ${esc(ui.secretEdit)}` : 'Add a secret'}</h3>
      <p class="small muted">The value is dropped as soon as you save: the app keeps the name and a one-way digest, and never shows the value again.</p>
      <label class="field">Name<input name="name" id="secret-name" required pattern="[A-Z][A-Z0-9_]*" placeholder="PROVIDER_API_KEY" value="${esc(ui.secretEdit)}"><small>The environment variable your code reads: capitals, digits and underscores.</small></label>
      <label class="field">Value<span class="inline"><input name="value" id="secret-value" type="${ui.secretShow ? 'text' : 'password'}" required placeholder="Paste the key" autocomplete="off"><button type="button" class="btn small" data-action="secret-show">${ui.secretShow ? 'Hide' : 'Show'}</button></span></label>
      <fieldset class="field" style="border:0;padding:0"><legend>Give it to</legend><label class="check"><input type="checkbox" name="server" checked> Storefront server</label><label class="check"><input type="checkbox" name="jobs"> Background jobs</label></fieldset>
      <button class="btn primary" type="submit" id="save-secret">Save</button></form>
    <div class="box" id="secrets"><h3>Your secrets</h3>${b.secrets.length ? `<ul class="list">${b.secrets.map(s => `<li><span class="grow"><code>${esc(s.name)}</code> <span class="pill ok">Set</span><br><span class="small muted">value not kept · digest ${esc(s.digest ?? '')} · ${day(s.at)}</span></span><span class="btns"><button type="button" class="btn small" data-action="secret-replace" data-id="${esc(s.name)}">Replace</button><button type="button" class="btn small danger" data-action="secret-delete" data-id="${esc(s.name)}">Delete</button></span></li>`).join('')}</ul>` : '<p class="muted">No secrets yet. Add a key and your storefront\'s server code can read it after the next deploy.</p>'}</div>
  </div>`;
}

function activityView() {
  const b = state.biz;
  return `${head('Activity', 'Everything that happened in this business, newest first.')}<div class="box"><ul class="list" id="activity">${b.activity.map(a => `<li><span class="grow">${esc(a.text)}</span><span class="small muted">${day(a.at)} ${time(a.at)}</span></li>`).join('')}</ul></div>`;
}

function billingView() {
  const b = state.biz;
  return `${head('Billing', 'Your plan: Free.')}
  <div class="grid two"><div class="box"><h3>What you get, and what you don't</h3><ul class="small"><li>Builds and runs your storefront, checkout, email and ads. Does not source, stock or ship physical goods: you bring the supplier, or sell digital products and services.</li><li>Builds a new site, hosted by VibeStartup. Does not edit or host a site you already have; it can read it for context.</li></ul></div>
  <div class="box"><h3>Safety cap</h3><p class="small">Each plan has a daily cap on what running your co-founder may cost. It pauses autopilot for the day when reached and resets at midnight UTC, so a runaway loop cannot run up a bill. Monthly credits do not roll over; top-up credits never expire.</p></div></div>
  <div class="plans" id="plans">${S.PLANS.map(p => `<div class="plan ${p.featured ? 'featured' : ''}"><h3>${p.name}</h3><span class="price">Price set at launch</span><p class="small muted">${p.for}</p><ul>${p.features.map(f => `<li>${f}</li>`).join('')}</ul><button type="button" class="btn small" disabled>Opens at launch</button></div>`).join('')}</div>
  <div class="box" style="margin-top:14px" id="billed"><h3>Billed work</h3><p class="small muted">Work that was not what you asked for? Dispute it and say why. In the demo, a dispute gives the credits back at once.</p>
    <ul class="list">${b.billed.map(w => `<li><span class="grow">${esc(w.what)}<br><span class="small muted">${new Date(w.at).toLocaleString('en-US')} · ${plural(w.credits, 'credit')}</span></span>${w.disputed ? '<span class="pill ok">Refunded</span>' : `<button type="button" class="btn small" data-action="dispute" data-id="${w.id}">Dispute</button>`}</li>`).join('') || '<li class="muted">Nothing billed yet.</li>'}</ul></div>
  <p class="small muted">Cancel at any time. Your data is always yours.</p>`;
}

function profileView() {
  const p = state.profile, n = p.notify;
  const sw = (k, label, sub = '') => `<label class="switch" style="display:flex;margin:8px 0"><input type="checkbox" role="switch" name="${k}" ${n[k] ? 'checked' : ''}> ${label}${sub ? ` <span class="small muted">${sub}</span>` : ''}</label>`;
  return `${head('Profile', 'You, the human partner.')}
  <div class="grid two">
    <form class="box" data-form="profile" id="profile-form"><h3>Edit profile</h3>
      <label class="field">Name<input name="name" value="${esc(p.name)}" placeholder="Your name"></label>
      <label class="field">Email<input name="email" type="email" value="${esc(p.email)}" placeholder="you@example.com"></label>
      <label class="field">Phone<input name="phone" type="tel" value="${esc(p.phone)}" placeholder="+1 555 123 4567"></label>
      <button class="btn primary" type="submit">Save changes</button></form>
    <form class="box" data-form="notify"><h3>Notifications</h3>${sw('sms', 'Text messages', 'when something needs you; reply STOP to stop')}${sw('welcome', 'Welcome emails')}${sw('approvals', 'Approval alerts')}${sw('errors', 'Error alerts')}${sw('milestones', 'Milestone emails')}${sw('briefing', 'Daily briefing emails')}<button class="btn small" type="submit">Save preferences</button></form>
    <div class="box"><h3>Account</h3><div class="btns"><button type="button" class="btn small" data-action="sign-out">Sign out</button><button type="button" class="btn small danger" data-action="delete-account">Delete account</button></div><p class="small muted">Deleting the account removes it and every business it holds, for good.</p></div>
  </div>`;
}

const VIEWS = { chat: chatView, dashboard: dashboardView, analytics: analyticsView, tasks: tasksView, email: emailView, products: productsView, orders: ordersView, customers: customersView, ads: adsView, studio: studioView, outbound: outboundView, social: socialView, files: filesView, legal: legalView, settings: settingsView, activity: activityView, billing: billingView, profile: profileView, secrets: secretsView };

function render() {
  const app = $('#app');
  const typed = $('#composer')?.value;
  const active = document.activeElement, id = active?.id, sel = active && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;
  if (!state.biz) { app.innerHTML = noBusiness(); }
  else {
    const r = route();
    if (r.draft && ui.draftFrom === location.hash) r.draft = null;
    app.innerHTML = `<div class="shell">${side(r.tab)}<main class="main" id="main" tabindex="-1">${VIEWS[r.tab](r)}</main></div>`;
    if (r.draft) ui.draftFrom = location.hash;
    else if (typed && $('#composer')) $('#composer').value = typed;
    if (r.tab === 'chat') { const c = $('#chat'); c?.lastElementChild?.previousElementSibling?.scrollIntoView?.({ block: 'nearest' }); }
  }
  if (id) { const el = document.getElementById(id); if (el && el !== document.body) { el.focus({ preventScroll: true }); if (sel && 'setSelectionRange' in el) try { el.setSelectionRange(...sel); } catch { /* not a text field */ } } }
}

function commit() { render(); }

// ---------- dialogs ----------

function openCheckout(id) {
  const b = state.biz, p = b.products.find(x => x.id === id);
  ui.checkout = id;
  const d = $('#checkout-dialog'), f = $('#checkout-form');
  f.reset();
  $('#checkout-biz').textContent = b.name;
  $('#checkout-product').textContent = `${p.name}${p.billing === 'recurring' ? ` (per ${p.interval})` : ''}`;
  $('#checkout-amount').textContent = S.money(p.price);
  $('#checkout-error').textContent = '';
  d.showModal();
}

function openStore() {
  const b = state.biz, br = b.brand;
  void op('/visit');
  $('#store-body').innerHTML = `<div class="store"><header style="background:${br.ground};color:${br.ink}"><span class="label" style="color:${br.ink}">${esc(b.slug)}.vibestartup.pro</span><h3 id="store-title" style="color:${br.ink}">${esc(b.name)}</h3><p>${esc(b.idea)}</p></header>
    <div class="items">${b.products.filter(p => p.status === 'active').map(p => `<div class="item"><b>${esc(p.name)}</b><p class="small muted">${esc(p.desc)}</p><p>${S.money(p.price)}${p.billing === 'recurring' ? ` / ${p.interval}` : ''}</p><button type="button" class="btn small primary" data-action="store-buy" data-id="${p.id}">Buy</button></div>`).join('') || '<p class="muted">Nothing for sale yet.</p>'}</div>
    <footer>Made with VibeStartup</footer></div>`;
  $('#store-dialog').showModal();
}

function confirmDialog({ title, text, ok, typed }) {
  return new Promise(resolve => {
    const d = $('#confirm-dialog');
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    $('#confirm-ok').textContent = ok;
    const wrap = $('#confirm-type-wrap'), input = $('#confirm-type');
    wrap.classList.toggle('hidden', !typed);
    input.value = '';
    $('#confirm-type-label').textContent = typed ? `Type "${typed}" to confirm` : '';
    d.returnValue = '';
    d.addEventListener('close', () => resolve(d.returnValue === 'ok' && (!typed || input.value.trim() === typed)), { once: true });
    d.showModal();
  });
}

function openPreview(name) {
  const b = state.biz;
  const f = allFiles().find(x => x.name === name);
  if (!f) return;
  ui.preview = f;
  $('#preview-title').textContent = f.name;
  $('#preview-meta').textContent = f.svg ? 'Image' : `Document · ${f.about}`;
  const body = $('#preview-body');
  body.innerHTML = f.svg ? `<img alt="${esc(f.name)}" src="${S.svgData(f.svg)}">` : '<pre></pre>';
  if (!f.svg) body.querySelector('pre').textContent = f.body;
  $('#preview-dialog').showModal();
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast('Select the text and copy it'); }
}

const searchItems = () => [...TABS, ...PAGES].map(([t, l]) => ({ href: `#tab=${t}`, label: l }));
function renderSearch() {
  const q = $('#search-input').value.toLowerCase();
  const items = searchItems().filter(i => i.label.toLowerCase().includes(q));
  $('#search-results').innerHTML = items.map((i, n) => `<li><a href="${i.href}" class="${n === 0 ? 'on' : ''}" data-action="search-go">${i.label}</a></li>`).join('') || '<li class="muted">Nothing matches.</li>';
}
function openSearch() {
  if (!state.biz) return;
  $('#search-input').value = '';
  renderSearch();
  $('#search-dialog').showModal();
}

function openShare() {
  const b = state.biz;
  let h = 7;
  for (const c of b.slug) h = (h * 33 + c.charCodeAt(0)) % 1e8;
  const link = `https://vibestartup.pro/r/${h.toString(36)}`;
  $('#share-link').value = link;
  const text = `I'm building a real business with an AI co-founder on VibeStartup: ${link}`;
  $('#share-mail').href = `mailto:?subject=${encodeURIComponent('Build a business with an AI co-founder')}&body=${encodeURIComponent(text)}`;
  $('#share-sms').href = `sms:?body=${encodeURIComponent(text)}`;
  $('#share-earned').textContent = 'You have earned 0 credits so far.';
  $('#share-dialog').showModal();
}

// ---------- events ----------

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action, id = el.dataset.id, b = state.biz;
  switch (a) {
    case 'approve': return op('/approve', { taskId: id, via: el.dataset.via ?? 'chat' });
    case 'reject': return op('/reject', { taskId: id });
    case 'reasoning': ui.open[id] = !ui.open[id]; return render();
    case 'open-task': ui.open['t' + id] = !ui.open['t' + id]; return render();
    case 'day': ui.dayOpen = ui.dayOpen === Number(el.dataset.n) ? null : Number(el.dataset.n); if (route().tab !== 'dashboard') location.hash = '#tab=dashboard'; return render();
    case 'routine': ui.open['r' + id] = !ui.open['r' + id]; ui.routineEdit = null; return render();
    case 'routine-edit': ui.routineEdit = id || null; return render();
    case 'new-routine': ui.newRoutine = !ui.newRoutine; return render();
    case 'routine-run': return op('/routine/run', { id });
    case 'routine-pause': { const r = b.routines.find(x => x.id === id); return op('/routine/status', { id, status: r.status === 'active' ? 'paused' : 'active' }); }
    case 'routine-cancel': { const r = b.routines.find(x => x.id === id); if (await confirmDialog({ title: `Cancel "${r.name}"?`, text: 'It stops running. You can ask your co-founder for a new routine later.', ok: 'Cancel routine' })) await op('/routine/status', { id, status: 'cancelled' }); return render(); }
    case 'refresh': await reload(); toast('Updated'); return render();
    case 'share-store': return copy(`https://${b.slug}.vibestartup.pro`);
    case 'share': return openShare();
    case 'copy-share': return copy($('#share-link').value);
    case 'copy': return copy(el.dataset.text);
    case 'copy-preview': return copy(ui.preview?.body ?? ui.preview?.name ?? '');
    case 'search': return openSearch();
    case 'search-go': $('#search-dialog').close(); return;
    case 'folder': ui.mailFolder = id; ui.mailThread = null; return render();
    case 'thread': ui.mailThread = id || null; return render();
    case 'new-product': ui.newProduct = !ui.newProduct; ui.recurring = false; return render();
    case 'product-status': return op('/product/status', { id, to: el.dataset.to });
    case 'test-buy': ui.fromStore = false; return openCheckout(id);
    case 'store': return openStore();
    case 'store-buy': ui.fromStore = true; $('#store-dialog').close(); return openCheckout(id);
    case 'recheck': { const blockers = readiness().filter(r => !r[1]); await op('/ads', { recheck: true }); toast(blockers.length ? `Plan rechecked: ${plural(blockers.length, 'blocker')} remain` : 'Plan rechecked: ready'); return; }
    case 'studio': ui.studio = id; return render();
    case 'format': ui.format = id; return render();
    case 'look': ui.look = id; return render();
    case 'count': ui.count = Number(id); return render();
    case 'campaign': await op('/propose', { title: 'Build an outbound campaign', reasoning: 'A three-step sequence over a week to the leads you upload: an introduction, one useful follow-up and a last note. Every step is shown before anything is sent.', effect: 'campaign' }); location.hash = '#tab=chat'; return render();
    case 'formation': return op('/propose', { title: 'Prepare a company formation', reasoning: 'Draft formation papers for a company that owns this business, for you to read. Filing and its fees are your decision.', effect: 'formation' });
    case 'connect': await op('/provider', { kind: 'social' }); toast('Publishing needs your own login on each platform: connect your provider when you are ready'); return;
    case 'social-view': ui.socialView = id; return render();
    case 'preview': return openPreview(id);
    case 'secret-show': { const v = $('#secret-value').value; ui.secretShow = !ui.secretShow; render(); $('#secret-value').value = v; return; }
    case 'secret-replace': ui.secretEdit = id; return render();
    case 'secret-delete': return op('/secret', { name: id, remove: true });
    case 'resend': toast(`Invite saved for ${id}. Sending needs your email provider: connect it when you are ready`); return;
    case 'revoke': return op('/member', { email: id, revoke: true });
    case 'dispute': return op('/dispute', { id });
    case 'delete-biz': if (await confirmDialog({ title: `Delete ${b.name}?`, text: 'Its storefront, records and files are removed for good.', ok: 'Delete business', typed: b.name })) { await api('DELETE', `/startups/${encodeURIComponent(STARTUP_ID)}`); location.href = '/startups/'; } return;
    case 'sign-out': await api('POST', '/signout'); location.href = '/'; return;
    case 'delete-account': if (await confirmDialog({ title: 'Delete your account?', text: 'Your account and every business it holds are removed for good.', ok: 'Delete account' })) { await api('DELETE', '/me'); location.href = '/'; } return;
  }
});

document.addEventListener('submit', async e => {
  const form = e.target, kind = form.dataset.form;
  if (form.id === 'checkout-form') return checkoutSubmit(e);
  if (!kind) return;
  e.preventDefault();
  const f = Object.fromEntries(new FormData(form)), b = state.biz;
  switch (kind) {
    case 'chat': {
      const text = (f.text ?? '').trim();
      if (!text) return;
      form.elements.text.value = '';
      if (location.hash.includes('draft=')) location.hash = '#tab=chat';
      const button = form.querySelector('button[type=submit]');
      button.disabled = true;
      form.classList.add('waiting');
      try { await op('/chat', { text }); }
      finally { button.disabled = false; form.classList.remove('waiting'); }
      return;
    }
    case 'routine': {
      await op('/routine/edit', { id: form.dataset.id, name: (f.name ?? '').trim(), instructions: (f.instructions ?? '').trim(), schedule: (f.schedule ?? '').trim(), every: f.every });
      ui.routineEdit = null;
      toast('Saved');
      return;
    }
    case 'reply': {
      const text = (f.text ?? '').trim();
      if (!text) return;
      await op('/reply', { id: form.dataset.id, text });
      toast('Reply saved in Sent as a draft: connect your email provider to send');
      return;
    }
    case 'product':
      await op('/product', { name: f.name, desc: f.desc, price: f.price, billing: f.billing, interval: f.interval ?? 'month', type: f.type, status: f.status });
      ui.newProduct = false;
      return;
    case 'ads':
      await op('/ads', { daily: Number(f.daily) || 1, days: Number(f.days) || 14 });
      toast('Budget saved');
      return;
    case 'routine-new': {
      if (!(f.name ?? '').trim()) return;
      await op('/routine', { name: f.name, instructions: f.instructions, schedule: f.schedule, every: f.every });
      ui.newRoutine = false;
      toast('Routine created');
      return;
    }
    case 'make': return make(f);
    case 'budget':
      await op('/settings', { creativeBudget: Number(f.budget) || 0 });
      return;
    case 'post':
      await op('/post', { text: f.text, date: f.date });
      toast('Post drafted');
      return;
    case 'domain':
      await op('/settings', { domain: (f.domain ?? '').trim() });
      toast(f.domain?.trim() ? 'Saved: the DNS record is yours to add. This app does not move DNS' : 'Domain removed');
      return;
    case 'invite': {
      try { await op('/member', { email: (f.email ?? '').trim(), role: f.role }); toast(`Invite saved for ${(f.email ?? '').trim()}. Sending needs your email provider`); }
      catch { /* already invited, or no seat left (the message is shown) */ }
      return;
    }
    case 'secret': {
      // The value goes straight to the app and is never kept: only its name and a one-way digest come back.
      try {
        await op('/secret', { name: (f.name ?? '').trim(), value: f.value ?? '' });
        form.reset();
        ui.secretEdit = '';
        ui.secretShow = false;
        toast(`${(f.name ?? '').trim()} saved; the value is not kept`);
      } catch { /* the message is shown */ }
      return;
    }
    case 'profile': {
      const r = await api('PATCH', '/me', { name: (f.name ?? '').trim(), phone: (f.phone ?? '').trim() });
      state.profile = { ...state.profile, ...r.user };
      toast('Profile saved');
      return reload();
    }
    case 'notify': {
      const keys = ['sms', 'welcome', 'approvals', 'errors', 'milestones', 'briefing'];
      const notify = Object.fromEntries(keys.map(k => [k, !!f[k]]));
      await api('PATCH', '/me', { notify });
      state.profile.notify = notify;
      toast('Preferences saved');
      return;
    }
  }
});

async function checkoutSubmit(e) {
  e.preventDefault();
  if (e.submitter?.value !== 'pay') return;
  const f = Object.fromEntries(new FormData(e.target));
  const card = String(f.card).replace(/\D/g, ''), exp = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(f.exp).trim());
  const err = msg => { e.preventDefault(); $('#checkout-error').textContent = msg; };
  if (card !== S.TEST_CARD.replace(/\s/g, '')) return err('In this demo only the test card works. No real card is ever charged.');
  if (!exp || Number(exp[1]) < 1 || Number(exp[1]) > 12 || new Date(2000 + Number(exp[2]), Number(exp[1])) < new Date()) return err('Use any future expiry date, as MM / YY.');
  if (!/^\d{3,4}$/.test(String(f.cvc).trim())) return err('Use any three digits.');
  if (!/^\S+@\S+\.\S+$/.test(String(f.email).trim())) return err('Add an email for the receipt.');
  // The card fields are dropped here: the app takes only the test card, and keeps the order and the buyer's email.
  try {
    await op('/checkout', { productId: ui.checkout, email: String(f.email).trim().toLowerCase(), card });
    $('#checkout-dialog').close();
    toast('Test payment complete');
  } catch { /* the message is shown in the dialog */ }
}

async function make(f) {
  const fmt = S.FORMATS.find(x => x.id === ui.format);
  if (!fmt?.ready) return toast('That format is not ready yet');
  const product = state.biz.products.find(p => p.id === f.product);
  const words = (f.prompt ?? '').trim() || product?.name || state.biz.name;
  try {
    const r = await op('/studio/make', { format: ui.format, words, look: ui.look, count: ui.count, productId: product?.id ?? null });
    ui.made = (r.startup.creatives ?? []).slice(-ui.count).map(c => c.id);
    ui.studio = 'library';
    render();
  } catch { /* the message is shown */ }
}

document.addEventListener('change', async e => {
  const el = e.target, k = el.dataset?.change, b = state.biz;
  if (!k) return;
  if (k === 'autopilot') return op('/settings', { autopilot: el.checked });
  if (k === 'briefing') return op('/settings', { briefing: el.value });
  if (k === 'billing') { ui.recurring = el.value === 'recurring'; el.closest('form').querySelector('[name=interval]').closest('label').classList.toggle('hidden', !ui.recurring); return; }
  if (k === 'studio-product') { ui.product = el.value; return; }
  if (k === 'ref') { ui.refs = el.checked ? [...ui.refs, el.value] : ui.refs.filter(x => x !== el.value); return; }
  if (k === 'personal') return op('/settings', { personal: el.checked });
  if (k === 'leads' || k === 'upload') {
    const file = el.files?.[0];
    if (!file) return;
    file.text().then(text => {
      if (k === 'upload') return void op('/file', { name: file.name, body: text.slice(0, 20000) });
      const rows = text.split(/\r?\n/).map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, ''))).filter(r => r.some(Boolean));
      const header = rows[0].map(h => h.toLowerCase()), hasHeader = header.includes('email');
      const ni = hasHeader ? header.indexOf('name') : 0, ei = hasHeader ? header.indexOf('email') : 1;
      const leads = rows.slice(hasHeader ? 1 : 0).map(r => ({ name: r[ni] ?? '', email: r[ei] ?? '' })).filter(l => /@/.test(l.email));
      toast(`${plural(leads.length, 'lead')} read`);
      void op('/leads', { leads });
    });
  }
});

document.addEventListener('input', e => {
  const k = e.target.dataset?.input;
  if (k === 'mail-search') { ui.mailSearch = e.target.value; render(); }
  if (k === 'studio-prompt') ui.prompt = e.target.value;
  if (k === 'file-search') { ui.fileSearch = e.target.value; render(); }
  if (e.target.id === 'search-input') renderSearch();
});

document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  if (e.target.id === 'search-input' && e.key === 'Enter') { e.preventDefault(); const a = $('#search-results a'); if (a) { location.hash = a.getAttribute('href'); $('#search-dialog').close(); } }
  if (e.target.id === 'composer' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.form.requestSubmit(); }
});

document.addEventListener('click', e => {
  const s = e.target.closest('[data-studio]');
  if (s) ui.studio = s.dataset.studio;
});

window.addEventListener('hashchange', () => { ui.mailThread = null; render(); $('#main')?.focus({ preventScroll: true }); window.scrollTo(0, 0); });
async function boot() {
  try {
    META = await (await fetch('/api/meta', { credentials: 'same-origin' })).json();
    Object.assign(S, {
      LAUNCH_WEEK: META.launchWeek ?? [], FORMATS: META.formats ?? [], LOOKS: META.looks ?? [], SOCIAL: META.social ?? [],
      PLANS: META.plans ?? [], RATES: META.rates ?? {}, FREE_CREDITS: META.freeCredits ?? 50, PAYOUT_MIN: META.payoutMin ?? 20,
      SEATS: META.seats ?? 10, TEST_CARD: META.testCard ?? '4242 4242 4242 4242',
    });
  } catch { /* the console still shows what the business already has */ }
  if (!STARTUP_ID) { location.href = '/startups/'; return; }
  try {
    const me = await (await fetch('/api/me', { credentials: 'same-origin' })).json();
    if (!me.user) { location.href = `/?next=${encodeURIComponent(location.pathname + location.search)}`; return; }
    state.profile = me.user;
    startups = me.startups ?? [];
    await reload();
  } catch {
    location.href = '/';
    return;
  }
  render();
}

boot();
