// Ads: one campaign on the founder's own Meta ad account, run inside the budget the founder approves. The plan and the
// readiness checklist are real and editable. Launch stays 'Soon' until the platform says the Meta Ads integration is
// configured (GET /integrations: `meta-ads` with `configured: true`; the owner turns it on by enabling the service
// account meta/vibestartup-ads). Then: connect the ad account (Facebook Login for Business in a popup), choose it and
// the Page, launch a PAUSED campaign whose daily budget is at most the plan's, approve going live, read the insights.
// The bounds are the API's (CommandAGI routes/meta-ads.ts); this page only asks for them.
import { api, drive, integrations, payments } from '/lib/api.js';
import { readBizJson, writeBizJson, folderOf } from '/lib/business.js';
import { $, $$, esc, icon, toast, money, when, oops, soonButton, modal, confirm, busy } from '/lib/ui.js';
import { head, section, siteState, productsOf, ordersOf, realSales, settingsOf, notifyChip, bindNotify } from './_shared.js';

const DEFAULT = { daily: 10, weeklyMax: 50, windowDays: 14, targetCps: 25, why: '', history: [], launched: false };
const META = 'meta-ads';
const IMAGE = /\.(png|jpe?g)$/i;

/** The founder's Meta ad account through a popup: start, the provider's page, back at /app/connected/, exchange. */
async function connectMeta() {
  const redirectUri = `${location.origin}/app/connected/`;
  const started = await api(`/integrations/${META}/oauth/start`, { method: 'POST', body: { redirectUri } });
  const popup = window.open(started.authUrl, 'meta-ads-connect', 'popup,width=640,height=780');
  if (!popup) throw new Error('The browser blocked the sign-in window. Allow pop-ups for this page and press Connect again.');
  const back = await new Promise((resolve, reject) => {
    const done = (fn, v) => { removeEventListener('message', onMessage); clearInterval(timer); fn(v); };
    const onMessage = e => { if (e.origin === location.origin && e.data?.type === 'oauth') done(resolve, e.data); };
    addEventListener('message', onMessage);
    const timer = setInterval(() => { if (popup.closed) done(reject, new Error('The sign-in window was closed before it finished.')); }, 700);
  });
  if (back.error) throw new Error(back.error_description || back.error);
  // The state that comes back must be the one this page started: anything else is not this sign-in.
  if (back.state !== started.state) throw new Error('The sign-in came back for another request. Press Connect again.');
  return api('/integrations/oauth/exchange', { method: 'POST', body: { code: back.code, state: back.state, redirectUri } });
}

export async function render(ctx) {
  const { biz, el, actions } = ctx;
  actions.innerHTML = `<button type="button" class="btn icon" id="ads-recheck" aria-label="Recheck plan" data-tip="Recheck plan">${icon('refresh')}</button>`;
  const paint = async () => {
    const plan = { ...DEFAULT, ...(await readBizJson(biz.slug, 'ads/campaign.json', {})) };
    const [st, products, orders, pay, ints, settings] = await Promise.all([siteState(biz), productsOf(biz), ordersOf(biz), payments.readiness().catch(() => ({ ready: false })), integrations.list().catch(() => ({ integrations: [] })), settingsOf(biz).catch(() => ({}))]);
    const sales = realSales(orders);
    const meta = (ints.integrations ?? []).find(i => i.id === META);
    // Ads open only where the platform says so. Anywhere else (production today) Launch is the Soon control.
    const open = !!meta?.configured;
    const conn = open ? (meta.connections ?? []).find(c => c.status === 'connected') ?? (meta.connections ?? [])[0] ?? null : null;
    const target = conn?.meta?.metaAds?.target ?? null;
    let campaigns = [];
    if (conn && conn.status === 'connected' && target) campaigns = (await api('/meta-ads/campaigns').catch(() => ({ campaigns: [] }))).campaigns ?? [];
    const adAccount = conn && target ? `${target.adAccountName ?? target.adAccountId} · ${target.pageName ?? 'Page ' + target.pageId}` : null;
    const checks = [
      ['Storefront live', st.live, st.live ? st.url : 'Publish the storefront from Products or Settings.'],
      ['Something to promote', products.some(p => p.status === 'active'), products.some(p => p.status === 'active') ? `${products.filter(p => p.status === 'active').length} active` : 'Activate a product.'],
      ['Taking payment', !!pay.ready, pay.ready ? 'payouts connected: the checkout pays your Stripe account' : 'Connect payouts in Settings; until then the storefront takes orders by email.'],
      ['Sales tracking', !st.gap, st.gap ? 'No site to measure.' : 'The edge measures requests to the storefront.'],
      ['Ad account', !!adAccount, adAccount ?? (open ? 'Connect your own Meta ad account below.' : 'Your own Meta ad account. Connecting it opens with Launch.')],
      ['Sales history', sales.count > 0, sales.count ? `${sales.count} real sales` : 'No real sales yet. Early results are noise; the 14-day window is for that.'],
    ];
    const blockers = checks.filter(c => !c[1]);
    const salesAWeek = plan.targetCps > 0 ? Math.round((plan.daily * 7) / plan.targetCps * 10) / 10 : 0;
    const live = campaigns.find(c => c.status !== 'DELETED' && c.status !== 'ARCHIVED');
    const launchControl = !open
      ? soonButton('Launch', 'btn primary', 'id="ads-launch"')
      : `<button type="button" class="btn primary" id="ads-launch" ${adAccount && !live ? '' : 'disabled'} title="${esc(!adAccount ? 'Connect and choose your ad account first' : live ? 'One campaign at a time' : 'Make the campaign, paused')}">Launch</button>`;
    el.innerHTML = head('Ads', 'One focused campaign, inside a budget you approve. Your co-founder never spends past it.')
      + `<div class="grid-2">`
      + section('The plan', `<form id="ads-plan" class="stack"><div class="grid-2"><label class="field"><span>Daily budget (USD)</span><input name="daily" type="number" min="1" value="${esc(String(plan.daily))}"><small>${open ? 'The most a campaign may spend a day: the API refuses more.' : ''}</small></label><label class="field"><span>Weekly maximum (USD)</span><input name="weeklyMax" type="number" min="1" value="${esc(String(plan.weeklyMax))}"></label><label class="field"><span>Test window (days)</span><input name="windowDays" type="number" min="7" value="${esc(String(plan.windowDays))}"><small>14 days, because early results are noise.</small></label><label class="field"><span>Target cost per sale (USD)</span><input name="targetCps" type="number" min="1" value="${esc(String(plan.targetCps))}"><small>About ${esc(String(salesAWeek))} sales a week at this budget.</small></label></div><label class="field"><span>Why it should work</span><textarea name="why" rows="2" placeholder="Who sees it, what it says, why they buy">${esc(plan.why)}</textarea></label><div class="row"><button class="btn quiet" type="submit">Save plan</button>${launchControl}${open ? '' : notifyChip('ads-launch', settings.notify?.['ads-launch'])}</div></form>`)
      + section('Readiness', `<ul class="readiness" id="ads-readiness">${checks.map(([l, ok, note]) => `<li data-ok="${ok}"><span class="dot"></span><div><b>${esc(l)}</b><div class="small muted">${esc(note)}</div></div></li>`).join('')}</ul><p class="hint" style="margin-top:8px">${blockers.length ? `${blockers.length} to go before launch day. ` : 'Ready for launch day. '}<a href="#" id="ads-ask" data-ask="Fix the blockers on the ads readiness checklist: ${esc(blockers.map(b => b[0]).join(', ') || 'none')}. Tell me what you need from me.">Ask your co-founder to fix the blockers</a></p>`)
      + `</div>`
      + (open ? section('Ad account', accountPanel(conn, target)) : '')
      + (open && campaigns.length ? section('Campaign', `<div id="ads-campaigns" class="stack">${campaigns.map(campaignCard).join('')}</div>`) : '')
      + section('What your co-founder may do alone', `<ul class="muted"><li>Pause for safety, tracking or budget.</li><li>Rotate approved creative without more spend.</li><li>Adjust delivery inside the goal.</li></ul>`)
      + section('What each assumption rests on', `<table class="table"><tbody><tr><td>Daily budget</td><td>${esc(money(plan.daily))}</td><td><span class="badge">best guess</span> until the first week runs</td></tr><tr><td>Cost per sale</td><td>${esc(money(plan.targetCps))}</td><td><span class="badge">${sales.count ? 'good estimate' : 'best guess'}</span> ${sales.count ? 'from real sales' : 'no sales yet'}</td></tr><tr><td>Verified outcomes</td><td>0 sales traced to an ad</td><td><span class="badge">solid</span> only sales traced to an ad count</td></tr></tbody></table>`)
      + section('Decision history', plan.history.length ? `<div class="list">${plan.history.slice().reverse().map(h => `<div><b>${esc(h.what)}</b><div class="meta">${esc(when(h.at))}</div></div>`).join('')}</div>` : '<p class="muted">No decisions yet. The next review is after the first saved plan.</p>');

    const decided = async what => { const p = { ...plan, ...(await readBizJson(biz.slug, 'ads/campaign.json', {})) }; p.history = [...(p.history ?? []), { at: Date.now(), what }]; await writeBizJson(biz.slug, 'ads/campaign.json', p); };
    $('#ads-plan', el).onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      const next = { ...plan, daily: Number(f.daily.value) || 0, weeklyMax: Number(f.weeklyMax.value) || 0, windowDays: Number(f.windowDays.value) || 14, targetCps: Number(f.targetCps.value) || 0, why: f.why.value.trim(), history: [...plan.history, { at: Date.now(), what: `Plan saved: ${money(Number(f.daily.value) || 0)} a day, ${money(Number(f.weeklyMax.value) || 0)} a week at most` }], nextReview: Date.now() + 7 * 86400000 };
      try { await writeBizJson(biz.slug, 'ads/campaign.json', next); toast('Plan saved.', 'ok'); await paint(); } catch (err) { toast(oops(err), 'bad'); }
    };
    bindNotify(el, biz);
    if (!open) return;

    const connectBtn = $('#ads-connect', el);
    if (connectBtn) connectBtn.onclick = () => busy(connectBtn, async () => {
      try { await connectMeta(); toast('Ad account connected.', 'ok'); await paint(); } catch (err) { toast(oops(err), 'bad'); }
    });
    const chooser = $('#ads-target', el);
    if (chooser) {
      const fill = async () => {
        try {
          const r = await api('/meta-ads/accounts');
          const accounts = (r.adAccounts ?? []).filter(a => a.active);
          $('#ads-target-account', chooser).innerHTML = accounts.length ? accounts.map(a => `<option value="${esc(a.id)}" ${target?.adAccountId === a.id ? 'selected' : ''}>${esc(a.name ?? a.id)} (${esc(a.currency)})</option>`).join('') : '<option value="">No active ad account</option>';
          $('#ads-target-page', chooser).innerHTML = (r.pages ?? []).length ? r.pages.map(p => `<option value="${esc(p.id)}" ${target?.pageId === p.id ? 'selected' : ''}>${esc(p.name ?? p.id)}</option>`).join('') : '<option value="">No Page you can advertise as</option>';
        } catch (err) { $('#ads-target-note', chooser).textContent = oops(err); }
      };
      fill();
      chooser.onsubmit = async e => {
        e.preventDefault();
        const adAccountId = $('#ads-target-account', chooser).value, pageId = $('#ads-target-page', chooser).value;
        if (!adAccountId || !pageId) return toast('Choose an ad account and a Page.', 'bad');
        try { await api('/meta-ads/target', { method: 'PUT', body: { adAccountId, pageId } }); await decided(`Ad account chosen: ${adAccountId}`); toast('Saved.', 'ok'); await paint(); } catch (err) { toast(oops(err), 'bad'); }
      };
    }
    const disconnect = $('#ads-disconnect', el);
    if (disconnect) disconnect.onclick = () => busy(disconnect, async () => {
      if (!(await confirm('VibeStartup forgets the Meta sign-in. Campaigns already at Meta stay as they are: pause or delete them first if they should stop.', { title: 'Disconnect the ad account?', ok: 'Disconnect', danger: true }))) return;
      try { await api(`/connections/${encodeURIComponent(disconnect.dataset.connection)}`, { method: 'DELETE' }); await decided('Ad account disconnected'); toast('Disconnected.', 'ok'); await paint(); } catch (err) { toast(oops(err), 'bad'); }
    });
    const launchBtn = $('#ads-launch', el);
    if (launchBtn && !launchBtn.disabled) launchBtn.onclick = () => launchDialog({ biz, plan, st, onDone: async c => { await decided(`Campaign made, paused: ${money(c.dailyBudgetCents / 100)} a day`); await paint(); } });
    $$('[data-campaign]', el).forEach(card => bindCampaign(card, campaigns.find(c => c.id === card.dataset.campaign), { plan, decided, paint }));
  };
  $('#ads-recheck').onclick = paint;
  await paint();
}

function accountPanel(conn, target) {
  if (!conn) return `<p class="muted">Your own Meta ad account. You sign in on Facebook; your password is never seen, and Meta bills you for the ads, never us.</p><div class="row"><button type="button" class="btn primary" id="ads-connect">Connect your ad account</button></div>`;
  if (conn.status !== 'connected') return `<p class="note warn">The Meta sign-in has ended. Connect again to keep running ads.</p><div class="row"><button type="button" class="btn primary" id="ads-connect">Connect again</button></div>`;
  return `<form id="ads-target" class="stack"><p class="muted">Signed in as <b>${esc(conn.label ?? 'your Meta account')}</b>. Choose where the campaign runs and which Page it speaks as.</p><div class="grid-2"><label class="field"><span>Ad account</span><select id="ads-target-account"><option>Loading…</option></select></label><label class="field"><span>Page</span><select id="ads-target-page"><option>Loading…</option></select></label></div><p class="hint" id="ads-target-note">${target ? `Now: ${esc(target.adAccountName ?? target.adAccountId)} · ${esc(target.pageName ?? target.pageId)}` : ''}</p><div class="row"><button class="btn quiet" type="submit">${target ? 'Change' : 'Use these'}</button><button type="button" class="btn quiet" id="ads-disconnect" data-connection="${esc(conn.id)}">Disconnect</button></div></form>`;
}

const STATUS = { ACTIVE: ['ok', 'live'], PAUSED: ['', 'paused'], CAMPAIGN_PAUSED: ['', 'paused'], ARCHIVED: ['', 'archived'], IN_PROCESS: ['', 'in review'], WITH_ISSUES: ['warn', 'has issues'] };
function campaignCard(c) {
  const [cls, word] = STATUS[c.status] ?? ['', (c.status ?? 'unknown').toLowerCase()];
  const approved = c.approval ? `${money(c.approval.dailyBudgetCents / 100)} a day, approved ${when(c.approval.at)}` : 'not approved yet';
  return `<div class="card campaign" data-campaign="${esc(c.id)}"><div class="row"><div class="grow"><h4>${esc(c.name)} <span class="badge ${cls}">${esc(word)}</span></h4><p class="meta">${esc(money(c.dailyBudgetCents / 100))} a day · ${esc(approved)} · <a href="${esc(c.link)}" target="_blank" rel="noopener">${esc(c.link)}</a></p></div></div>`
    + (c.incomplete ? `<p class="note warn">Meta stopped the launch at the ${esc(c.incomplete)} Everything made so far is paused and spends nothing.</p>` : '')
    + `<div class="ads-insights" data-insights><p class="muted small">Reading what it did…</p></div>`
    + `<div class="row">${c.status === 'ACTIVE' ? '<button type="button" class="btn quiet" data-act="pause">Pause</button>' : (c.adId && !c.incomplete ? `<button type="button" class="btn primary" data-act="approve">Approve going live at ${esc(money(c.dailyBudgetCents / 100))} a day</button>` : '')}<button type="button" class="btn quiet" data-act="delete">Delete campaign</button></div></div>`;
}

function bindCampaign(card, c, { decided, paint }) {
  if (!c) return;
  api(`/meta-ads/campaigns/${encodeURIComponent(c.id)}/insights?datePreset=maximum`).then(r => {
    const i = r.insights ?? {};
    $('[data-insights]', card).innerHTML = `<table class="table"><tbody><tr><td>Spent</td><td>${esc(money(Number(i.spend) || 0))}</td><td>Impressions</td><td>${esc(String(i.impressions ?? 0))}</td></tr><tr><td>Reach</td><td>${esc(String(i.reach ?? 0))}</td><td>Clicks</td><td>${esc(String(i.clicks ?? 0))}</td></tr></tbody></table>`;
  }).catch(err => { $('[data-insights]', card).innerHTML = `<p class="note warn">${esc(oops(err))}</p>`; });
  const act = (name, fn) => { const b = $(`[data-act="${name}"]`, card); if (b) b.onclick = () => busy(b, async () => { try { await fn(); await paint(); } catch (err) { toast(oops(err), 'bad'); } }); };
  act('approve', async () => {
    const amount = money(c.dailyBudgetCents / 100);
    if (!(await confirm(`The campaign goes live and Meta bills your ad account up to ${amount} a day. Your co-founder may pause it or lower it, never raise it past ${amount} without asking you again.`, { title: 'Approve going live?', ok: `Approve ${amount} a day` }))) return;
    await api(`/meta-ads/campaigns/${encodeURIComponent(c.id)}/approve`, { method: 'POST', body: { dailyBudgetCents: c.dailyBudgetCents } });
    await api(`/meta-ads/campaigns/${encodeURIComponent(c.id)}/status`, { method: 'POST', body: { status: 'ACTIVE' } });
    await decided(`Approved going live at ${amount} a day`);
    toast('Live. Meta reviews a new ad before it shows.', 'ok');
  });
  act('pause', async () => { await api(`/meta-ads/campaigns/${encodeURIComponent(c.id)}/status`, { method: 'POST', body: { status: 'PAUSED' } }); await decided('Campaign paused'); toast('Paused.', 'ok'); });
  act('delete', async () => {
    if (!(await confirm('The campaign, its ad set and its ad are deleted at Meta. What it spent stays on your Meta bill.', { title: 'Delete the campaign?', ok: 'Delete', danger: true }))) return;
    await api(`/meta-ads/campaigns/${encodeURIComponent(c.id)}/status`, { method: 'POST', body: { status: 'DELETED' } });
    await decided('Campaign deleted');
    toast('Deleted.', 'ok');
  });
}

async function launchDialog({ biz, plan, st, onDone }) {
  const studio = `${folderOf(biz.slug)}/studio`;
  const images = (await drive.list(studio).catch(() => [])).filter(f => IMAGE.test(f.name)).sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)).slice(0, 12);
  const m = modal(`<h2>Launch the campaign</h2><form id="launch-form" class="stack">`
    + `<p class="muted">It is made paused: nothing spends until you approve going live.</p>`
    + `<div class="field"><span>Picture</span>${images.length ? `<div class="grid-auto" id="launch-images">${images.map((f, i) => `<label class="pick"><input type="radio" name="image" value="${esc(f.path ? `${f.path}/${f.name}` : f.name)}" ${i === 0 ? 'checked' : ''}><img alt="${esc(f.name)}" data-file="${esc(f.id)}" width="120" height="120"></label>`).join('')}</div>` : '<p class="note warn">No picture in the Studio yet. Make one in Studio, then come back.</p>'}</div>`
    + `<label class="field"><span>Caption</span><textarea name="caption" rows="3" required maxlength="2000">${esc(plan.why || `${biz.name}: see what is new.`)}</textarea></label>`
    + `<div class="grid-2"><label class="field"><span>Where it goes</span><input name="link" type="url" required value="${esc(st.url && /^https:/.test(st.url) ? st.url : '')}" placeholder="https://"></label><label class="field"><span>Daily budget (USD)</span><input name="daily" type="number" min="1" step="0.01" max="${esc(String(plan.daily))}" value="${esc(String(plan.daily))}"><small>At most the plan's ${esc(money(plan.daily))}.</small></label></div>`
    + `<div class="modal-actions"><button type="button" class="btn quiet" id="launch-cancel">Cancel</button><button class="btn primary" type="submit" id="launch-go" ${images.length ? '' : 'disabled'}>Make it, paused</button></div></form>`, { label: 'Launch the campaign' });
  $$('img[data-file]', m.el).forEach(async img => { const u = await drive.blobUrl(img.dataset.file).catch(() => null); if (u) img.src = u; });
  $('#launch-cancel', m.el).onclick = () => m.close();
  $('#launch-form', m.el).onsubmit = async e => {
    e.preventDefault();
    const f = e.target, go = $('#launch-go', m.el);
    await busy(go, async () => {
      try {
        const r = await api('/meta-ads/campaigns', { method: 'POST', body: { name: `${biz.name}: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, dailyBudgetCents: Math.round(Number(f.daily.value) * 100), plan: `${folderOf(biz.slug)}/ads/campaign.json`, image: f.image.value, link: f.link.value.trim(), caption: f.caption.value.trim() } });
        m.close();
        toast(r.campaign.incomplete ? 'Meta stopped partway. See the campaign card.' : 'Made, paused. Approve it to go live.', r.campaign.incomplete ? 'bad' : 'ok');
        await onDone(r.campaign);
      } catch (err) { toast(oops(err), 'bad'); }
    });
  };
}
