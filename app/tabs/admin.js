// Admin: VibeStartup's founders and their businesses, for an admin of the brand's org (`org-vibestartup`). Everything
// is read from CommandAGI's records (`GET /brands/vibestartup/admin`, `…/admin/founders`; CommandAGI docs/brands.md
// § a brand's admins); nothing here is estimated. The page is reached from the account menu, which shows it only when
// `GET /me/brands` names this brand. Opened another way, it says why it shows nothing.
import { BRAND, brandAdmin } from '/lib/api.js';
import { $, esc, icon, money, num, plural, day, ago, soon, oops, busy } from '/lib/ui.js';
import { head, section, bars, empty } from './_shared.js';

const KIND = {
  gaps: ['warn', 'Step did not finish'],
  unanswered: ['bad', 'No answer'],
  thread_error: ['bad', 'Co-founder error'],
  site_not_live: ['warn', 'Storefront not live'],
  no_site: ['warn', 'No storefront'],
  unreadable: ['bad', 'Record broken'],
};

/** A small bar chart of one daily series: square bars on a baseline, the busiest day's count, the first and last day. */
function chart(id, title, daily, key) {
  const W = 300, H = 96, pad = 18, n = daily.length;
  const max = Math.max(1, ...daily.map(d => d[key]));
  const bw = (W - 2) / n;
  const total = daily.reduce((s, d) => s + d[key], 0);
  const barsSvg = daily.map((d, i) => {
    const h = d[key] ? Math.max(2, Math.round((H - pad - 4) * d[key] / max)) : 0;
    return h ? `<rect x="${(1 + i * bw + 1).toFixed(1)}" y="${H - pad - h}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${h}"><title>${esc(d.day)}: ${d[key]}</title></rect>` : '';
  }).join('');
  const label = `${title}: ${total} in ${n} days, at most ${max} a day`;
  return `<figure class="admin-chart" id="${id}"><figcaption><span>${esc(title)}</span><b>${num(total)}</b></figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}" preserveAspectRatio="none">
      <line x1="0" x2="${W}" y1="${H - pad + 0.5}" y2="${H - pad + 0.5}" class="axis"/>
      <text x="0" y="10" class="tick">${max}</text>
      ${barsSvg}
      <text x="0" y="${H - 4}" class="tick">${esc(daily[0]?.day.slice(5) ?? '')}</text>
      <text x="${W}" y="${H - 4}" class="tick end">${esc(daily.at(-1)?.day.slice(5) ?? '')}</text>
    </svg></figure>`;
}

const storefront = s => s ? `<a href="${esc(s.brandUrl ?? s.url)}" target="_blank" rel="noopener">${esc((s.brandUrl ?? s.url).replace(/^https:\/\//, ''))}</a> ${s.live ? '<span class="badge ok">Live</span>' : '<span class="badge warn">Not live</span>'}` : '<span class="hint">No storefront</span>';

function founderRows(list) {
  return list.map(f => {
    const biz = f.businesses.length
      ? f.businesses.map(b => `<div class="admin-biz"><b>${esc(b.name ?? b.site?.slug ?? 'Unnamed')}</b> ${storefront(b.site)}${b.gaps.length ? ` <span class="badge warn">${plural(b.gaps.length, 'gap')}</span>` : ''}</div>`).join('')
      : '<span class="hint">None yet</span>';
    return `<tr data-founder="${esc(f.id)}">
      <td>${esc(day(f.joinedAt))}<br><span class="hint">${esc(ago(f.joinedAt))}</span></td>
      <td><b>${esc(f.name || '–')}</b><br><span class="hint">${esc(f.email)}</span> ${f.emailVerified ? '<span class="badge ok">Proved</span>' : ''}${f.accountMadeHere ? '' : ' <span class="badge">Existing account</span>'}</td>
      <td>${biz}</td>
      <td>${num(f.orders.sales)} · ${esc(money(f.orders.revenueCents / 100))}</td>
      <td>${num(f.credits.used)} of ${num(f.credits.free)} free</td>
      <td>${f.lastActiveAt ? esc(ago(f.lastActiveAt)) : '–'}</td>
    </tr>`;
  }).join('');
}

export async function render(ctx) {
  const { el } = ctx;
  el.innerHTML = head('Admin', `${BRAND.name}'s founders and their businesses, from CommandAGI's records.`) + bars(4);
  let view;
  try {
    view = await brandAdmin.overview(30);
  } catch (e) {
    // The doors are not on this API yet (a 404 with no `not_found` of the brand's), or the brand has no admin org there.
    if (e.status === 404) {
      el.innerHTML = head('Admin', `${BRAND.name}'s founders and their businesses.`) + `<div class="note accent stack" id="admin-soon"><p><b>The admin view comes with CommandAGI's next release.</b> ${soon()}</p><p class="hint">This API has no admin view of ${esc(BRAND.name)} yet. Nothing here is a guess, so the page shows nothing until it does.</p></div>`;
      return;
    }
    if (e.status === 403) {
      el.innerHTML = head('Admin', `${BRAND.name}'s founders and their businesses.`) + empty('This account is not an admin', `Only an owner or admin of ${esc(BRAND.name)}'s organisation sees its founders. Ask an admin to add you.`);
      return;
    }
    throw e;
  }
  const t = view.totals;
  const fc = view.freeCredits;
  const kpis = `<div class="grid-4" id="admin-kpis">
    <div class="kpi"><span>Founders</span><b id="kpi-founders">${num(t.founders)}</b><small>${num(t.accountsMadeHere)} new accounts · ${num(t.verifiedEmails)} proved email · ${num(t.activeThisWeek)} active this week</small></div>
    <div class="kpi"><span>Businesses</span><b id="kpi-businesses">${num(t.businesses)}</b><small>${num(t.sitesLive)} of ${plural(t.sites, 'storefront')} live · ${num(t.goodsActive)} of ${plural(t.goods, 'product')} on sale</small></div>
    <div class="kpi"><span>Sales</span><b id="kpi-sales">${num(t.sales)}</b><small>${esc(money(t.revenueCents / 100))} from ${plural(t.sellers, 'seller')} · ${plural(t.orders, 'order')} in all</small></div>
    <div class="kpi"><span>Credits used</span><b id="kpi-credits">${num(Math.round(t.creditsUsed))}</b><small>${num(t.creditsFree)} free given · ${num(t.creditsPaid)} bought${fc ? ` · free budget ${esc(money(fc.spentMonthCents / 100))} of ${esc(money(fc.monthlyCents / 100))} this month` : ''}</small></div>
  </div>`;
  const mode = view.stripeMode === 'live' ? '' : `<div class="note warn" id="admin-test-mode">This API takes Stripe payments in test mode: its orders are not real money.</div>`;
  const budget = fc
    ? `<p class="hint" id="admin-budget">Free credits in force (${esc(fc.day)}, the platform's budget for every door): ${esc(money(fc.todayCents / 100))} may be given today, up to ${num(fc.perAccount)} credits an account (${Object.entries(fc.credits).map(([k, v]) => `${esc(k)} ${num(v)}`).join(', ')}), spent at most ${num(fc.dailySpendCredits)} a day, gone after ${plural(fc.expiryDays, 'day')}.</p>`
    : `<p class="hint" id="admin-budget">No free-credit plan is recorded on this API yet.</p>`;
  const charts = `<div class="grid-3 admin-charts">${chart('chart-signups', 'Founders joined', view.daily, 'signups')}${chart('chart-businesses', 'Businesses built', view.daily, 'businesses')}${chart('chart-sales', 'First sales', view.daily, 'firstSales')}</div>`;

  const first = await brandAdmin.founders(null, 25).catch(() => ({ founders: [], next: null }));
  const known = new Map(first.founders.map(f => [f.id, f]));
  const problems = view.watch?.problems ?? [];
  const watch = problems.length
    ? `<table class="table" id="admin-watch"><thead><tr><th>What</th><th>Business</th><th>Founder</th><th>Detail</th><th>Since</th></tr></thead><tbody>${problems.map(p => { const [cls, label] = KIND[p.kind] ?? ['', p.kind]; const f = known.get(p.founderId); return `<tr><td><span class="badge ${cls}">${esc(label)}</span></td><td>${esc(p.business ?? '–')}</td><td>${esc(f?.email ?? p.founderId.slice(0, 8))}</td><td>${esc(p.detail)}</td><td>${p.at ? esc(ago(p.at)) : '–'}</td></tr>`; }).join('')}</tbody></table>`
    : `<p class="note ok" id="admin-watch">Nothing to look at in the newest ${plural(view.watch?.of ?? 0, 'founder')}: every step finished, every storefront is live and every co-founder answered.</p>`;
  const table = first.founders.length
    ? `<table class="table" id="admin-founders"><thead><tr><th>Joined</th><th>Founder</th><th>Businesses</th><th>Sales</th><th>Credits</th><th>Last active</th></tr></thead><tbody>${founderRows(first.founders)}</tbody></table>${first.next ? '<div><button type="button" class="btn quiet" id="admin-more">Show more</button></div>' : ''}`
    : empty('No founders yet', `The first person who signs up on ${esc(BRAND.name)} shows up here.`);

  el.innerHTML = head('Admin', `${BRAND.name}'s founders and their businesses, from CommandAGI's records.`, `<button type="button" class="btn quiet" id="admin-refresh">${icon('refresh', 16)} Refresh</button>`)
    + mode + kpis + budget
    + section('Last 30 days', charts)
    + section('Watch', watch, `<span class="hint">${plural(problems.length, 'problem')}</span>`)
    + section('Latest sign-ups', table);

  $('#admin-refresh', el).onclick = () => ctx.refresh();
  let next = first.next;
  const more = $('#admin-more', el);
  if (more) more.onclick = () => busy(more, async () => {
    try {
      const page = await brandAdmin.founders(next, 25);
      $('#admin-founders tbody', el).insertAdjacentHTML('beforeend', founderRows(page.founders));
      next = page.next;
      if (!next) more.remove();
    } catch (e) { more.insertAdjacentHTML('afterend', `<p class="note bad">${esc(oops(e))}</p>`); }
  });
}
