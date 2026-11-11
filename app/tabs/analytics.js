// Analytics: what the edge measured for the storefront (requests, errors, CPU time), nothing invented.
import { sites } from '/lib/api.js';
import { $, esc, icon, toast, copy, num, when, oops } from '/lib/ui.js';
import { head, section, empty, siteState, bars } from './_shared.js';

export async function render(ctx) {
  const { biz, el, actions } = ctx;
  actions.innerHTML = `<button type="button" class="btn icon" id="an-refresh" aria-label="Refresh" data-tip="Refresh">${icon('refresh')}</button>`;
  const paint = async () => {
    el.innerHTML = head('Analytics', 'What the edge measured for your storefront over the last seven days. Requests are requests, not visitors: nothing here is estimated.') + bars(2);
    if (!biz.site?.id) { el.innerHTML = head('Analytics') + empty('No storefront yet', 'The storefront was not created. Settings shows why.', `<a class="btn quiet" href="${esc(ctx.tabHref('settings'))}">Open Settings</a>`); return; }
    let a = null, err = null;
    try { a = await sites.analytics(biz.site.id, 168); } catch (e) { err = e; }
    const st = await siteState(biz);
    const requests = a?.requests ?? a?.totals?.requests ?? a?.total?.requests ?? null;
    const errors = a?.errors ?? a?.totals?.errors ?? null;
    const cpu = a?.cpuMs ?? a?.totals?.cpuMs ?? a?.cpuTimeMs ?? null;
    const quiet = !requests;
    el.innerHTML = head('Analytics', 'What the edge measured for your storefront over the last seven days. Requests are requests, not visitors: nothing here is estimated.')
      + `<div class="grid-4">${[['Requests', requests == null ? '—' : num(requests), 'answered by the storefront'], ['Errors', errors == null ? '—' : num(errors), '5xx answers'], ['CPU', cpu == null ? '—' : `${num(Math.round(cpu))} ms`, 'spent serving them'], ['Carts and sales', '0', 'from the storefront']].map(([l, v, s]) => `<div class="kpi"><b>${esc(v)}</b><span>${esc(l)}</span><small>${esc(s)}</small></div>`).join('')}</div>
      <p class="hint" style="margin:8px 0 24px">Updated ${esc(when(Date.now()))}${err ? ` · the edge did not answer: ${esc(oops(err))}` : ''}</p>`
      + (quiet ? section('It is quiet', `<div class="note">Your site is quiet. Two ways to change that: <button type="button" class="btn sm quiet" id="share-link">Share your link</button> or <a class="btn sm quiet" href="${esc(ctx.tabHref('ads'))}">plan a small ad test</a>.</div>`) : '')
      + section('Recent activity', `<div class="list">${(a?.series ?? a?.buckets ?? []).slice(-14).map(b => `<div class="row"><span class="mono">${esc(when(b.at ?? b.t ?? b.time ?? Date.now()))}</span><span>${esc(num(b.requests ?? b.count ?? 0))} requests</span>${b.errors ? `<span class="badge bad">${esc(num(b.errors))} errors</span>` : ''}</div>`).join('') || '<p class="muted">No activity in the window.</p>'}</div>`)
      + section('The site', `<p class="muted">${st.gap ? esc(st.gap) : `<a href="${esc(st.url)}" target="_blank" rel="noopener">${esc(st.url)}</a> ${st.live ? '<span class="badge ok">live</span>' : '<span class="badge warn">not live</span>'}`}</p>`);
    $('#share-link', el)?.addEventListener('click', () => copy(biz.site.url, 'Link copied'));
  };
  $('#an-refresh').onclick = paint;
  await paint();
}
