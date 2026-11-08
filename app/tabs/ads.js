// Ads: one campaign on one ad network, run inside the budget the founder approves. The readiness checklist reads the
// real state; launching stops at the ad account until the founder connects one.
import { integrations, payments } from '/lib/api.js';
import { readBizJson, writeBizJson } from '/lib/business.js';
import { $, $$, esc, icon, toast, money, when, oops, busy } from '/lib/ui.js';
import { head, section, siteState, productsOf, ordersOf, realSales, providerStop, askLink } from './_shared.js';

const DEFAULT = { daily: 10, weeklyMax: 50, windowDays: 14, targetCps: 25, why: '', history: [], launched: false };

export async function render(ctx) {
  const { biz, el, actions } = ctx;
  actions.innerHTML = `<button type="button" class="btn icon" id="ads-recheck" aria-label="Recheck plan" data-tip="Recheck plan">${icon('refresh')}</button>`;
  const paint = async () => {
    const plan = { ...DEFAULT, ...(await readBizJson(biz.slug, 'ads/campaign.json', {})) };
    const [st, products, orders, pay, ints] = await Promise.all([siteState(biz), productsOf(biz), ordersOf(biz), payments.readiness().catch(() => ({ ready: false })), integrations.list().catch(() => ({ integrations: [] }))]);
    const sales = realSales(orders);
    const adAccount = (ints.integrations ?? []).find(i => /ads|meta|facebook|google/i.test(`${i.id} ${i.category} ${i.label}`) && i.connections?.length);
    const checks = [
      ['Storefront live', st.live, st.live ? st.url : 'Publish the storefront from Products or Settings.'],
      ['Something to promote', products.some(p => p.status === 'active'), products.some(p => p.status === 'active') ? `${products.filter(p => p.status === 'active').length} active` : 'Activate a product.'],
      ['Taking payment', !!pay.ready, pay.ready ? 'payouts connected: the checkout pays your Stripe account' : 'Connect payouts in Settings; until then the storefront takes orders by email.'],
      ['Sales tracking', !st.gap, st.gap ? 'No site to measure.' : 'The edge measures requests to the storefront.'],
      ['Ad account', !!adAccount, adAccount ? adAccount.label : 'No ad account is connected. CommandAGI has no ad-network connector on this stack yet.'],
      ['Sales history', sales.count > 0, sales.count ? `${sales.count} real sales` : 'No real sales yet. Early results are noise; the 14-day window is for that.'],
    ];
    const blockers = checks.filter(c => !c[1]);
    const salesAWeek = plan.targetCps > 0 ? Math.round((plan.daily * 7) / plan.targetCps * 10) / 10 : 0;
    el.innerHTML = head('Ads', 'One focused campaign, inside a budget you approve. Your co-founder never spends past it.')
      + `<div class="grid-2">`
      + section('The plan', `<form id="ads-plan" class="stack"><div class="grid-2"><label class="field"><span>Daily budget (USD)</span><input name="daily" type="number" min="1" value="${esc(String(plan.daily))}"></label><label class="field"><span>Weekly maximum (USD)</span><input name="weeklyMax" type="number" min="1" value="${esc(String(plan.weeklyMax))}"></label><label class="field"><span>Test window (days)</span><input name="windowDays" type="number" min="7" value="${esc(String(plan.windowDays))}"><small>14 days, because early results are noise.</small></label><label class="field"><span>Target cost per sale (USD)</span><input name="targetCps" type="number" min="1" value="${esc(String(plan.targetCps))}"><small>About ${esc(String(salesAWeek))} sales a week at this budget.</small></label></div><label class="field"><span>Why it should work</span><textarea name="why" rows="2" placeholder="Who sees it, what it says, why they buy">${esc(plan.why)}</textarea></label><div class="row"><button class="btn quiet" type="submit">Save plan</button><button class="btn primary" type="button" id="ads-launch">Launch</button></div><div id="ads-stop"></div></form>`)
      + section('Readiness', `<ul class="readiness" id="ads-readiness">${checks.map(([l, ok, note]) => `<li data-ok="${ok}"><span class="dot"></span><div><b>${esc(l)}</b><div class="small muted">${esc(note)}</div></div></li>`).join('')}</ul><p class="hint" style="margin-top:8px">${blockers.length ? `${blockers.length} ${blockers.length === 1 ? 'blocker stops' : 'blockers stop'} the launch. ` : 'Nothing blocks the launch. '}<a href="#" id="ads-ask" data-ask="Fix the blockers on the ads readiness checklist: ${esc(blockers.map(b => b[0]).join(', ') || 'none')}. Tell me what you need from me.">Ask your co-founder to fix the blockers</a></p>`)
      + `</div>`
      + section('What your co-founder may do alone', `<ul class="muted"><li>Pause for safety, tracking or budget.</li><li>Rotate approved creative without more spend.</li><li>Adjust delivery inside the goal.</li></ul>`)
      + section('What each assumption rests on', `<table class="table"><tbody><tr><td>Daily budget</td><td>${esc(money(plan.daily))}</td><td><span class="badge">best guess</span> until the first week runs</td></tr><tr><td>Cost per sale</td><td>${esc(money(plan.targetCps))}</td><td><span class="badge">${sales.count ? 'good estimate' : 'best guess'}</span> ${sales.count ? 'from real sales' : 'no sales yet'}</td></tr><tr><td>Verified outcomes</td><td>0 sales traced to an ad</td><td><span class="badge">solid</span> only sales traced to an ad count</td></tr></tbody></table>`)
      + section('Decision history', plan.history.length ? `<div class="list">${plan.history.slice().reverse().map(h => `<div><b>${esc(h.what)}</b><div class="meta">${esc(when(h.at))}</div></div>`).join('')}</div>` : '<p class="muted">No decisions yet. The next review is after the first saved plan.</p>');
    $('#ads-plan', el).onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      const next = { ...plan, daily: Number(f.daily.value) || 0, weeklyMax: Number(f.weeklyMax.value) || 0, windowDays: Number(f.windowDays.value) || 14, targetCps: Number(f.targetCps.value) || 0, why: f.why.value.trim(), history: [...plan.history, { at: Date.now(), what: `Plan saved: ${money(Number(f.daily.value) || 0)} a day, ${money(Number(f.weeklyMax.value) || 0)} a week at most` }], nextReview: Date.now() + 7 * 86400000 };
      try { await writeBizJson(biz.slug, 'ads/campaign.json', next); toast('Plan saved.', 'ok'); await paint(); } catch (err) { toast(oops(err), 'bad'); }
    };
    $('#ads-launch', el).onclick = async () => {
      const stop = $('#ads-stop', el);
      if (!adAccount) { stop.innerHTML = providerStop('an ad account', 'Running an ad needs your own ad account and a payment method.'); return; }
      if (blockers.length) { stop.innerHTML = `<div class="note warn">${blockers.length} ${blockers.length === 1 ? 'blocker stops' : 'blockers stop'} the launch: ${esc(blockers.map(b => b[0]).join(', '))}.</div>`; return; }
      stop.innerHTML = providerStop('the ad network', 'The connector can read the account but CommandAGI has no campaign-creation call on this stack yet.');
    };
  };
  $('#ads-recheck').onclick = paint;
  await paint();
}
