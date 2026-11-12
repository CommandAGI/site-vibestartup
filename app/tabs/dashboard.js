// Dashboard: the launch week, what needs your call, the inbox's last mails, money (real sales only), autopilot, and
// the cards for the site, the brand kit, the library, tasks, the runtime, the checkout test and the blueprint.
import { email, threads } from '/lib/api.js';
import { LAUNCH_WEEK, launchDay, writeBusiness, bizDrive } from '/lib/business.js';
import { PATHS } from '/lib/schema.js';
import { $, $$, esc, icon, toast, money, ago, oops } from '/lib/ui.js';
import { head, section, bizTasks, isApproval, ordersOf, realSales, siteState, askLink, empty, payoutsOf, payoutsCard, bindPayouts } from './_shared.js';

export async function render(ctx) {
  const { biz, el } = ctx;
  const day = launchDay(biz);
  const [tasksAll, orders, st, payouts] = await Promise.all([bizTasks(biz), ordersOf(biz), siteState(biz), payoutsOf(biz)]);
  const needs = tasksAll.filter(t => isApproval(t) && t.status === 'todo');
  const sales = realSales(orders);
  let mails = [];
  if (biz.email?.id) mails = ((await email.threads(biz.email.id, { limit: 3 }).catch(() => ({ threads: [] }))).threads ?? []).slice(0, 3);
  const studio = (await bizDrive(biz).list(PATHS.studio).catch(() => [])).filter(f => f.type !== 'folder');
  el.innerHTML = head(biz.name, day <= 7 ? `Day ${day} of 7: ${LAUNCH_WEEK[day - 1].title}.` : 'Launch week is complete.', `<label class="switch" id="autopilot-wrap"><input type="checkbox" id="autopilot" ${biz.autopilot ? 'checked' : ''}><i></i><span>Autopilot ${biz.autopilot ? 'on' : 'off'}</span></label>`)
    + payoutsCard(biz, payouts)
    + section('Launch week', `<ol class="week" id="launch-week">${LAUNCH_WEEK.map(d => `<li data-day="${d.day}" class="${d.day === day ? 'today' : d.day < day ? 'done' : ''}"><i>Day ${d.day}</i><b>${esc(d.title)}</b><small class="hint">${esc(d.about)}</small></li>`).join('')}</ol>`)
    + `<div class="grid-2">`
    + section('Needs your call', needs.length ? `<div id="needs-call" class="list">${needs.map(t => `<div class="task"><span class="glyph">${esc(t.glyph ?? '!')}</span><div><b>${esc(t.title)}</b><div class="meta">${esc(ago(t.createdAt ?? Date.now()))}</div></div><div class="acts"><a class="btn sm quiet" href="${esc(ctx.tabHref('chat'))}">Decide in chat</a></div></div>`).join('')}</div>` : `<div id="needs-call" class="note">Nothing waits on you right now.</div>`)
    + section('Inbox', mails.length ? `<div class="list">${mails.map(m => `<div class="thread" data-tid="${esc(m.id)}"><b>${esc(m.subject || '(no subject)')}</b><div class="meta">${esc(m.from ?? m.participants?.[0] ?? '')} · ${esc(ago(m.lastAt ?? m.updatedAt ?? m.at ?? Date.now()))}</div></div>`).join('')}</div>` : `<div class="note">${biz.email?.address ? `Nothing in ${esc(biz.email.address)} yet.` : 'No business address yet. Claim one in Email.'}</div>`)
    + `</div>`
    + section('Money', `<div class="grid-4" id="money">${[['Total sales', sales.count, ''], ['Net revenue', money(sales.revenue), ''], ['Payouts', money(0), 'unlock at a $20 balance'], ['Balance', money(sales.revenue), '']].map(([l, v, s]) => `<div class="kpi"><b>${esc(v)}</b><span>${esc(l)}</span>${s ? `<small>${esc(s)}</small>` : ''}</div>`).join('')}</div>${sales.count ? '' : `<p class="hint" style="margin-top:8px">No sales yet${sales.test ? `, only ${sales.test} test ${sales.test === 1 ? 'order' : 'orders'}` : ''}. Only completed, real orders count.</p>`}`)
    + section('Everything else', `<div class="grid-auto">
      ${card('store', 'Live site', st.gap ? st.gap : st.live ? st.url.replace(/^https?:\/\//, '') : 'Not live yet', st.url ? st.url : ctx.tabHref('settings'), !!st.url)}
      ${card('sparkle', 'Brand kit', biz.brand?.type ?? '', ctx.tabHref('studio') + '&view=brand')}
      ${card('image', 'Library', `${studio.length} ${studio.length === 1 ? 'piece' : 'pieces'}`, ctx.tabHref('studio'))}
      ${card('tasks', 'Tasks', `${tasksAll.filter(t => t.status === 'doing').length} in progress · ${tasksAll.filter(t => t.status === 'done').length} done`, ctx.tabHref('tasks'))}
      ${card('bolt', 'Runtime', st.gap ? 'No site' : `${(st.deployments ?? []).length} ${(st.deployments ?? []).length === 1 ? 'deploy' : 'deploys'}`, ctx.tabHref('settings'))}
      ${card('card', 'Checkout', sales.count ? `${sales.count} ${sales.count === 1 ? 'sale' : 'sales'}${sales.test ? `, ${sales.test} test` : ''}` : sales.test ? `${sales.test} test ${sales.test === 1 ? 'order' : 'orders'}` : 'Put a product on sale', ctx.tabHref('products'))}
      ${card('flag', 'Blueprint', biz.blueprint?.title ?? biz.idea, ctx.tabHref('chat'))}
    </div>`);
  $('#autopilot', el).onchange = async e => {
    const on = e.target.checked;
    try {
      biz.autopilot = on; await writeBusiness(biz); ctx.setBiz(biz);
      $('#autopilot-wrap span', el).textContent = `Autopilot ${on ? 'on' : 'off'}`;
      if (biz.cofounder?.threadId) await threads.send(biz.cofounder.threadId, on ? 'Autopilot is on: do routine work inside the limits of your rules and report what you did.' : 'Autopilot is off: propose, then wait for my approval.').catch(() => null);
      toast(`Autopilot ${on ? 'on' : 'off'}.`, 'ok');
    } catch (err) { toast(oops(err), 'bad'); e.target.checked = !on; }
  };
  bindPayouts(el, biz);
  $$('.thread', el).forEach(t => t.onclick = () => { location.hash = `tab=email&thread=${encodeURIComponent(t.dataset.tid)}`; });
}
const card = (ico, title, text, href, external = false) => `<a class="card link" href="${esc(href)}" ${external ? 'target="_blank" rel="noopener"' : ''}><div class="row">${icon(ico)}<h4>${esc(title)}</h4></div><p class="meta">${esc(text)}</p></a>`;
