// Legal: company formation, proposed only at traction (about three real sales or $100 of revenue), and the
// storefront's terms and privacy pages.
import { esc, icon, money } from '/lib/ui.js';
import { head, section, ordersOf, realSales, askLink } from './_shared.js';

export async function render(ctx) {
  const { biz, el } = ctx;
  const s = realSales(await ordersOf(biz));
  const ready = s.count >= 3 || s.revenue >= 100;
  el.innerHTML = head('Legal', 'Formation, and the pages your storefront needs.')
    + section('Company formation', `<div id="formation" class="panel stack"><div class="row"><span class="badge ${ready ? 'ok' : ''}">${ready ? 'ready to propose' : 'not yet'}</span><span class="muted">Proposed when the business has traction: about three real sales or $100 of revenue, because formation costs recur.</span></div><div class="grid-2"><div class="kpi"><b>${esc(String(s.count))}</b><span>real sales</span><small>of 3</small></div><div class="kpi"><b>${esc(money(s.revenue))}</b><span>revenue</span><small>of $100</small></div></div><p class="muted">${ready ? `Your co-founder can now propose a formation through Charter House (CommandAGI's formation service): ${askLink('Propose the company formation now: what entity, where, what it costs, and what I sign.', 'ask for the proposal')}.` : `Want it sooner? ${askLink('I want to form the company before traction. Propose it: what entity, where, what it costs, and what I sign.', 'Ask your co-founder')}. Filing needs your signature and a fee; nothing is filed without them.`}</p>${s.test ? `<p class="hint">${s.test} test ${s.test === 1 ? 'order does' : 'orders do'} not count.</p>` : ''}</div>`)
    + section('The storefront\'s pages', biz.site?.url ? `<div id="legal-pages" class="row"><a class="btn quiet" href="${esc(biz.site.url)}/terms.html" target="_blank" rel="noopener">${icon('external', 14)} Terms</a><a class="btn quiet" href="${esc(biz.site.url)}/privacy.html" target="_blank" rel="noopener">${icon('external', 14)} Privacy</a></div><p class="hint" style="margin-top:8px">Plain starting drafts written by VibeStartup; replace them in Files (the site folder) when you have your own.</p>` : '<div id="legal-pages" class="note">No storefront yet, so no pages.</div>');
}
