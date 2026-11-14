// Billing: credits (what the co-founder's work draws on) and the packs that buy them, the three listings a founder hires
// from launch day, the founder's contracts, the ledger and disputes. Prices are CommandAGI's (docs/organization.md §
// VibeStartup: prices, providers and launch, 2026-11-08). A listing is hired through a service contract
// (docs/ARCHITECTURE.md § hiring): the founder proposes it from the business's co-founder thread and signs; VibeStartup's
// agent signs; escrow holds the price on the founder's credits; the work is delivered and the founder accepts it.
// Every business is an org whose chats bill the founder (CommandAGI Access.billingTarget): a model call draws the plan's
// free allowance first, then the free credits, then the paid ones. The allowance's part is no ledger row, so the page
// shows the allowance and each co-founder's calls beside the ledger.
import { credits, creditsHistory, allowance, freeCredits, agentCost, checkout, services, emails, BRAND } from '/lib/api.js';
import * as ui from '/lib/ui.js';
import { head, section, iconBtn } from './_shared.js';

const { $, $$, esc, num, when, day, oops, busy, toast, modal, prompt } = ui;
const LAUNCH = '2026-12-08';
const TERM_DAYS = 30;
const DAY_MS = 86400000;
/** CommandAGI's credit packs (packages/domain/core billing.ts CREDIT_PACKS): 1 credit is $0.01 at list. */
const PACKS = [
  { id: 'pack-starter', name: 'Starter', credits: 1000, usd: 10 },
  { id: 'pack-plus', name: 'Plus', credits: 5500, usd: 50, popular: true },
  { id: 'pack-pro', name: 'Pro', credits: 12000, usd: 100 },
];
/**
 * The listings of org-vibestartup (its org.json): one 30-day contract each, run by VibeStartup's co-founder agent. The
 * price and the ceiling here are what the page shows while a listing is not open; an open listing's own row wins.
 */
const LISTINGS = [
  { id: 'listing-vibestartup-cofounder', name: 'Co-founder', price: 3900, ceiling: 2400, for: 'Your idea, running.', features: ['A live storefront with checkout into your own Stripe account', 'A business email address', 'A brand kit, the seven-day launch week and a daily briefing', 'Every big decision waits for your approval'] },
  { id: 'listing-vibestartup-growth', name: 'Growth', price: 2900, ceiling: 1800, for: 'Customers, inside a budget you set.', features: ['One focused ad campaign on your own Meta ad account', 'Posts on the social accounts you connect', 'Mail to contacts who opted in', 'Never spends past your approved budget; ad spend is paid to Meta by you'] },
  { id: 'listing-vibestartup-studio', name: 'Studio', price: 2900, ceiling: 1800, for: 'Your brand, made.', features: ['A brand book: colours, type and voice', 'Up to 100 offer images, sized for every placement', 'Up to 4 five-second videos', 'Made in your brand within 30 days'] },
];
const OURS = new Set(LISTINGS.map(l => l.id));
const usd = n => `$${num(n)}`;
const dollars = creditsN => usd(Math.round(creditsN) / 100);
const launchDay = () => new Date(`${LAUNCH}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
/** The pill a feature that is not open yet wears: lib/ui.js `soon()` where it exists. */
const soonPill = () => (typeof ui.soon === 'function' ? ui.soon() : '<span class="pill soon">Soon</span>');

// Free credits a founder earns once each (CommandAGI GET /me/free-credits; docs/billing.md § free credits): what each
// milestone asks and where it is done. A refusal's code is said in words; one this page does not know is shown as it is.
const MILESTONES = {
  signup: { title: 'Joining', todo: '' },
  email: { title: 'Confirm your email', todo: '<button type="button" class="btn quiet" data-unlock-email>Send a code</button>' },
  build: { title: 'Put your first site live', todo: '<a class="btn quiet" href="#tab=storefront">Open the storefront</a>' },
  paid: { title: 'Make a first payment', todo: '<a class="btn quiet" href="#packs" data-unlock-packs>See the packs</a>' },
};
const REFUSED = {
  surge: 'not given during a rush of sign-ups',
  disposable_domain: 'not given to a throwaway address',
  made_for_an_org: 'not given to an account made for an organisation',
  nothing_today: 'none left to give that day',
  budget_spent: "the month's free credits were all given",
};
function unlockCard(promo) {
  const grants = (promo?.grants ?? []).filter(g => MILESTONES[g.kind] && g.state !== 'none');
  if (!grants.length || !grants.some(g => g.state === 'open' && g.credits > 0)) return '';
  const row = g => {
    const m = MILESTONES[g.kind];
    const [badge, text, act] = g.state === 'earned'
      ? ['<span class="badge ok">Earned</span>', `${num(g.credits)} credits${g.expiresAt ? `, to use by ${day(g.expiresAt)}` : ''}`, '']
      : g.state === 'refused'
        ? ['<span class="badge">Not given</span>', REFUSED[g.why] ?? g.why, '']
        : ['<span class="badge warn">Open</span>', g.credits > 0 ? `${num(g.credits)} credits` : 'nothing to earn today', g.credits > 0 ? m.todo : ''];
    return `<div class="row" data-milestone="${esc(g.kind)}" data-state="${esc(g.state)}"><div class="grow"><b>${esc(m.title)}</b> ${badge}<div class="small muted">${esc(text)}</div></div>${act}</div>`;
  };
  const rule = promo.rule ?? {};
  return `<div class="panel stack" id="unlock"><h3>Unlock more credits</h3>${grants.map(row).join('')}<p class="hint">Each is earned once.${rule.expiryDays ? ` Free credits last ${esc(num(rule.expiryDays))} days` : ''}${rule.dailySpendCredits ? `, and your co-founder uses up to ${esc(num(rule.dailySpendCredits))} of them a day` : ''}${rule.expiryDays ? '.' : ''}</p></div>`;
}

/** A plan's amount in credits (a flat posted plan: `amount.amount` is a decimal `{ u, s }`). */
function planCredits(plan) {
  const a = plan?.amount?.amount;
  if (a && typeof a === 'object' && a.u != null) return Number(a.u) / 10 ** (Number(a.s) || 0);
  return Number.isFinite(Number(a)) ? Number(a) : null;
}
/** The listing as the page shows it: the API's row when it is open, else the declared copy, marked not open. */
function merge(l, row) {
  if (!row || row.status !== 'active') return { ...l, open: false, status: row?.status ?? 'draft' };
  return { ...l, open: true, status: 'active', price: planCredits(row.plan) ?? l.price, ceiling: row.costCeilingMilli != null ? row.costCeilingMilli / 1000 : l.ceiling };
}

// ---------- a contract, in words ----------

const LIVE = new Set(['proposed', 'signed', 'active', 'delivered', 'disputed']);
const signedAt = c => Math.max(c.customerSignedAt ?? 0, c.providerSignedAt ?? 0) || null;
/** The term ends at the contract's deadline (set at proposal), else 30 days after both signatures. */
const endsAt = c => c.deadline ?? (signedAt(c) ? signedAt(c) + TERM_DAYS * DAY_MS : null);
const daysLeft = c => { const e = endsAt(c); return e == null ? null : Math.max(0, Math.ceil((e - Date.now()) / DAY_MS)); };
/** Both signed and still `proposed`: the escrow did not hold (the founder's credits did not cover it). */
const escrowWaits = c => c.status === 'proposed' && c.customerSignedAt && c.providerSignedAt;

function stateOf(c) {
  if (escrowWaits(c)) return { badge: '<span class="badge warn">Not paid</span>', text: 'Both sides signed, but your credits did not cover the price. Buy credits, then sign again.' };
  if (c.status === 'proposed' && !c.customerSignedAt) return { badge: '<span class="badge warn">Needs your signature</span>', text: 'Sign to hold the price in escrow and start the work.' };
  if (c.status === 'proposed') return { badge: '<span class="badge">Waiting</span>', text: 'You signed. VibeStartup signs next; then the price is held in escrow from your credits and the work starts.' };
  if (c.status === 'active' || c.status === 'signed') {
    const d = daysLeft(c);
    return { badge: `<span class="badge ok">Active</span>`, text: d == null ? 'The work is under way.' : d > 0 ? `${num(d)} ${d === 1 ? 'day' : 'days'} left, to ${day(endsAt(c))}.` : `The 30 days ended on ${day(endsAt(c))}. VibeStartup delivers next; then you accept the work.` };
  }
  if (c.status === 'delivered') return { badge: '<span class="badge accent">Delivered</span>', text: c.acceptDeadlineAt ? `Accept the work, or dispute it, by ${when(c.acceptDeadlineAt)}. If you do neither, the price is released to VibeStartup then.` : 'Accept the work, or dispute it.' };
  if (c.status === 'disputed') return { badge: '<span class="badge bad">Disputed</span>', text: 'An arbiter decides where the escrowed credits go.' };
  if (c.status === 'settled') return { badge: '<span class="badge">Settled</span>', text: `Paid${c.settledAt ? ` on ${day(c.settledAt)}` : ''}.` };
  if (c.status === 'cancelled') return { badge: '<span class="badge">Cancelled</span>', text: 'Nothing was charged.' };
  return { badge: `<span class="badge">${esc(c.status)}</span>`, text: '' };
}

/** Credits used against the ceiling: the API's measure when the contract carries it, else the ceiling alone. */
function usage(c, listing) {
  const ceiling = c.costCeilingCredits ?? listing?.ceiling ?? null;
  if (ceiling == null) return '';
  const used = Number.isFinite(c.spentCredits) ? c.spentCredits : null;
  const reached = c.ceilingReachedAt ? `<p class="note warn">The work reached its ceiling on ${esc(day(c.ceilingReachedAt))} and stopped. Renew to go on.</p>` : '';
  if (used == null) return `<p class="hint">Up to ${esc(num(ceiling))} credits of model, image and mail work.</p>${reached}`;
  const pct = Math.min(100, Math.round((used / ceiling) * 100));
  return `<div class="usage"><div class="meter" role="meter" aria-valuemin="0" aria-valuemax="${esc(ceiling)}" aria-valuenow="${esc(used)}" aria-label="Credits used"><i style="width:${pct}%"></i></div><p class="hint" data-usage>${esc(num(Math.round(used)))} of ${esc(num(ceiling))} credits used</p></div>${reached}`;
}

function contractRow(c, listing, biz) {
  const s = stateOf(c);
  const name = listing?.name ?? c.title ?? 'Contract';
  const here = biz?.cofounder?.threadId && c.customerThreadId === biz.cofounder.threadId;
  const price = c.amountCents ? `${num(c.amountCents)} credits (${dollars(c.amountCents)}) in escrow` : listing ? `${num(listing.price)} credits (${dollars(listing.price)})` : '';
  const actions = [];
  if (c.status === 'proposed' && (!c.customerSignedAt || escrowWaits(c))) actions.push(`<button type="button" class="btn primary" data-sign="${esc(c.id)}">${escrowWaits(c) ? 'Sign again' : 'Sign'}</button>`);
  if (c.status === 'delivered') actions.push(`<button type="button" class="btn primary" data-accept="${esc(c.id)}">Accept the work</button>`, `<button type="button" class="btn quiet" data-dispute="${esc(c.id)}">Dispute</button>`);
  if (c.status === 'active' && listing?.open) actions.push(`<button type="button" class="btn quiet" data-renew="${esc(listing.id)}">Renew</button>`);
  if (c.status === 'active') actions.push(`<button type="button" class="btn ghost" data-dispute="${esc(c.id)}">Dispute</button>`);
  if (c.status === 'proposed') actions.push(iconBtn('trash', 'Cancel this contract', `data-cancel="${esc(c.id)}"`));
  return `<article class="contract" data-contract="${esc(c.id)}" data-status="${esc(c.status)}"><div class="contract-head"><h4>${esc(name)} ${s.badge}</h4><span class="muted">${esc(price)}</span></div>`
    + `<p class="muted">${esc(s.text)}${here ? ` For ${esc(biz.name)}.` : c.customerThreadId ? ' For another of your businesses.' : ''}</p>`
    + (['active', 'signed', 'delivered'].includes(c.status) ? usage(c, listing) : '')
    + (actions.length ? `<div class="row-actions">${actions.join('')}</div>` : '') + '</article>';
}

/** The co-founders whose calls the page counts: this business's and every other business's the console knows. */
const cofoundersOf = (biz, businesses = []) => {
  const seen = new Set();
  return [biz, ...businesses].filter(b => b?.cofounder?.agentId && !seen.has(b.cofounder.agentId) && seen.add(b.cofounder.agentId));
};

export async function render(ctx) {
  const { el, founder, biz } = ctx;
  const working = cofoundersOf(biz, ctx.businesses);
  const [balance, history, rows, contracts, free, promo, costs] = await Promise.all([
    credits().catch(() => null),
    creditsHistory().catch(() => ({ entries: [] })),
    Promise.all(LISTINGS.map(l => services.listing(l.id).catch(() => null))),
    services.contracts().catch(() => null),
    allowance().catch(() => null),
    freeCredits().catch(() => null),
    Promise.all(working.map(b => agentCost(b.cofounder.agentId).catch(() => null))),
  ]);
  const usageRows = working.map((b, i) => ({ biz: b, cost: costs[i] })).filter(r => r.cost);
  const promoLeft = Number(promo?.promoLeft ?? 0);
  const listings = LISTINGS.map((l, i) => merge(l, rows[i]));
  const byId = new Map(listings.map(l => [l.id, l]));
  const anyOpen = listings.some(l => l.open);
  const entries = history?.entries ?? history?.history ?? [];
  const mine = (contracts ?? []).filter(c => OURS.has(c.listingId) && c.role !== 'provider');
  const live = mine.filter(c => LIVE.has(c.status));
  const past = mine.filter(c => !LIVE.has(c.status));
  const activeFor = id => live.find(c => c.listingId === id && ['active', 'signed', 'delivered'].includes(c.status) && c.customerThreadId === biz?.cofounder?.threadId);
  const back = new URLSearchParams(location.search);
  const current = live.filter(c => c.status === 'active' || c.status === 'signed');
  const planLine = current.length
    ? current.map(c => `<b>${esc(byId.get(c.listingId)?.name ?? c.title)}</b> <span class="badge ok">${esc(daysLeft(c) == null ? 'active' : `${num(daysLeft(c))} days left`)}</span>`).join(' ')
    : `<b>Free</b> <span class="badge">${anyOpen ? 'no contract' : 'until launch'}</span>`;

  el.innerHTML = head('Billing', `Signed in as ${esc(founder?.email ?? '')}. Your customers pay you through your own Stripe account; this page is what you pay for your co-founder's work.`)
    + (back.get('checkout') ? `<div class="note ok">Thank you. Your credits arrive as soon as Stripe confirms the payment.</div>` : '')
    + section('Credits', `<div class="grid-2"><div class="kpi"><b id="credits-balance">${balance == null ? '—' : esc(num(Math.round(balance)))}</b><span>credits</span><small>about ${balance == null ? '—' : esc(dollars(balance))} of work at list price${promoLeft > 0 ? `, ${esc(num(Math.round(promoLeft)))} of them free credits` : ''}</small></div>`
      + `<div class="kpi" id="allowance"><b data-allowance>${free ? `${esc(num(free.remaining))} of ${esc(num(free.allotment))}` : '—'}</b><span>free allowance</span><small>${free ? `credits your co-founder can use before your credits${free.resetAt ? `; full again ${esc(when(free.resetAt))}` : ''}` : 'could not be read just now'}</small></div></div>`
      + `<p class="hint" id="pays-first">Your co-founder's work is paid from your free allowance first, then your free credits, then the credits you buy.</p>`
      + unlockCard(promo)
      + `<div class="plans packs" id="packs">${PACKS.map(p => `<article class="card${p.popular ? ' popular' : ''}" data-pack="${esc(p.id)}"><h3>${esc(p.name)}${p.popular ? ' <span class="badge ok">best value</span>' : ''}</h3><p class="price">${esc(usd(p.usd))}</p><p class="muted">${esc(num(p.credits))} credits${p.credits > p.usd * 100 ? ` · ${esc(num(p.credits - p.usd * 100))} free` : ''}</p><button type="button" class="btn ${p.popular ? 'primary' : 'quiet'}" data-buy="${esc(p.id)}">Buy ${esc(p.name)}</button></article>`).join('')}</div>`
      + `<p class="hint">Stripe's secure page takes the payment. Your co-founder's model calls, images, video and mail draw on your credits at cost.</p>`)
    + section(anyOpen ? 'Hire your co-founder' : `Hire your co-founder · opens ${launchDay()}`, `<div class="plans" id="plans">${listings.map(l => {
      const active = activeFor(l.id);
      const button = l.open
        ? `<button type="button" class="btn ${l.id === 'listing-vibestartup-cofounder' ? 'primary' : 'quiet'}" data-hire="${esc(l.id)}">${active ? `Renew ${esc(l.name)}` : `Hire ${esc(l.name)}`}</button>`
        : `<button type="button" class="btn quiet" data-hire="${esc(l.id)}" disabled aria-disabled="true">Hire ${esc(l.name)}</button>`;
      return `<article class="card" data-listing="${esc(l.id)}" data-open="${l.open ? '1' : '0'}"><h3>${esc(l.name)}${l.open ? '' : ` ${soonPill()}`}</h3><p class="muted">${esc(l.for)}</p><p class="price">${esc(dollars(l.price))} <span class="muted">/ 30 days</span></p><ul>${l.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>`
        + `<p class="hint">${esc(num(l.price))} credits for 30 days of work, up to ${esc(num(l.ceiling))} credits of it in model, image and mail cost. ${l.open ? 'Renew each month; nothing renews by itself.' : `Opens ${esc(launchDay())}.`}</p>${button}</article>`;
    }).join('')}</div>`)
    + section('Your plan', `<div class="panel stack"><p id="plan-current">${planLine}</p>`
      + (contracts == null ? '<p class="hint">Your contracts could not be read just now.</p>' : '')
      + (live.length ? `<div class="list" id="contracts">${live.map(c => contractRow(c, byId.get(c.listingId), biz)).join('')}</div>` : `<p class="muted">Free now: a storefront with checkout into your own Stripe account, a business email, a brand kit, the launch week and a daily briefing, on your credits. Not included: sourcing, stock or shipping (you bring the supplier), and edits to a site you already have.</p>`)
      + (past.length ? `<details class="past"><summary>Past contracts (${esc(String(past.length))})</summary><div class="list" id="contracts-past">${past.map(c => contractRow(c, byId.get(c.listingId), biz)).join('')}</div></details>` : '')
      + '</div>')
    + section('Your co-founders\' work', usageRows.length
      ? `<table class="table" id="usage"><thead><tr><th>Business</th><th class="num">Model calls</th><th class="num">Credits</th></tr></thead><tbody>${usageRows.map(({ biz: b, cost }) => `<tr data-usage-biz="${esc(b.slug)}"><td>${esc(b.cofounder.name ?? 'Co-founder')} for ${esc(b.name)}</td><td class="num">${esc(num(cost.calls ?? 0))}</td><td class="num" data-credits>${esc(cost.pricedCostUsd ? (cost.pricedCostUsd * 100 < 1 ? 'under 1' : num(Math.round(cost.pricedCostUsd * 100))) : '0')}</td></tr>`).join('')}</tbody></table><p class="hint">The last 30 days, at cost. The free allowance pays first, so this work shows here before it shows in the ledger.</p>`
      : '<p class="hint" id="usage">No co-founder work yet.</p>')
    + section('Ledger', entries.length ? `<table class="table"><thead><tr><th>When</th><th>What</th><th class="num">Credits</th></tr></thead><tbody id="credits-history">${entries.slice(0, 50).map(e => `<tr><td>${esc(when(e.at ?? e.createdAt ?? e.timestamp ?? Date.now()))}</td><td>${esc(e.reason ?? e.description ?? e.kind ?? e.type ?? '')}</td><td class="num">${esc(num(e.amount ?? e.delta ?? e.credits ?? 0))}</td></tr>`).join('')}</tbody></table>` : '<table hidden><tbody id="credits-history"></tbody></table><p class="hint">No ledger entries yet. Each credit your co-founder spends past the free allowance shows here, with what it was for.</p>')
    + section('Disputes', `<div class="panel stack"><p class="muted">Billed work that was not what you asked for can be disputed for its credits back.</p><a class="btn quiet" id="dispute" href="mailto:${esc(BRAND.support)}?subject=${encodeURIComponent('Dispute a charge')}&body=${encodeURIComponent(`Account: ${founder?.email ?? ''}\nWhat was billed: \nWhat I asked for: \n`)}">Dispute a charge</a></div>`);

  const returnPath = `/app/${location.search}#page=billing`;
  const buy = async (b, packId) => busy(b, async () => {
    try {
      const r = await checkout({ type: 'pack', packId }, returnPath);
      if (r?.url) location.href = r.url; else toast('The checkout did not open. Try again.', 'bad');
    } catch (err) { toast(oops(err), 'bad'); }
  });
  // The email milestone: a code mailed to the sign-in address, entered here; the card is drawn again with the grant.
  const unlockEmail = $('[data-unlock-email]', el);
  if (unlockEmail) unlockEmail.onclick = () => busy(unlockEmail, async () => {
    try {
      const login = (await emails.list()).find(e => e.login);
      if (!login) return toast('We could not find your sign-in email.', 'bad');
      if (!login.verified) {
        await emails.sendCode(login.id);
        const entered = await prompt(`We sent a 6-digit code to ${login.email}.`, { title: 'Confirm your email', ok: 'Confirm', placeholder: '123456' });
        if (!entered) return;
        await emails.confirm(login.id, entered);
      }
      toast('Email confirmed. Your free credits are on their way.', 'ok');
      ctx.refresh();
    } catch (err) { toast(oops(err), 'bad'); }
  });
  const toPacks = $('[data-unlock-packs]', el);
  if (toPacks) toPacks.onclick = e => { e.preventDefault(); $('#packs', el).scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  $('#packs', el).addEventListener('click', e => { const b = e.target.closest('[data-buy]'); if (b) buy(b, b.dataset.buy); });
  $('#plans', el).addEventListener('click', e => {
    const b = e.target.closest('[data-hire]'); if (!b || b.disabled) return;
    hireSheet({ listing: byId.get(b.dataset.hire), biz, balance, renewing: !!activeFor(b.dataset.hire), buy, done: ctx.refresh });
  });
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-sign],[data-cancel],[data-accept],[data-dispute],[data-renew]'); if (!b || !el.contains(b)) return;
    if (b.dataset.renew) { hireSheet({ listing: byId.get(b.dataset.renew), biz, balance, renewing: true, buy, done: ctx.refresh }); return; }
    if (b.dataset.dispute) {
      const reason = await prompt('Say what was billed and what you asked for. The escrowed credits stay held until an arbiter decides.', { title: 'Dispute this contract', ok: 'Dispute', multiline: true });
      if (!reason) return;
      await busy(b, () => services.dispute(b.dataset.dispute, reason).then(() => { toast('Disputed. The credits stay held.', 'ok'); ctx.refresh(); }, err => toast(oops(err), 'bad')));
      return;
    }
    const [act, id, okText] = b.dataset.sign ? ['sign', b.dataset.sign, 'Signed.'] : b.dataset.cancel ? ['cancel', b.dataset.cancel, 'Cancelled. Nothing was charged.'] : ['accept', b.dataset.accept, 'Accepted. The price is released to VibeStartup.'];
    if (act === 'cancel' && !(await ui.confirm('The contract ends before anything is charged.', { title: 'Cancel this contract?', ok: 'Cancel the contract' }))) return;
    await busy(b, () => services[act](id).then(() => { toast(okText, 'ok'); ctx.refresh(); }, err => toast(oops(err), 'bad')));
  });

  // A contract waiting on VibeStartup's signature moves on its own: look again every 10 s for 2 minutes while the
  // page is open.
  if (live.some(c => c.status === 'proposed' && c.customerSignedAt && !c.providerSignedAt)) {
    let n = 0;
    const t = setInterval(async () => {
      if (!el.isConnected || ++n > 12) return clearInterval(t);
      const now = await services.contracts().catch(() => null);
      if (now?.some(c => live.some(l => l.id === c.id && (l.status !== c.status || l.providerSignedAt !== c.providerSignedAt)))) { clearInterval(t); ctx.refresh(); }
    }, 10000);
  }
}

/**
 * The confirm sheet: what the founder gets, the price in credits and dollars, the term, the ceiling and the renewal;
 * then the contract is proposed from the business's co-founder thread and signed. Short of credits, it offers the
 * pack that covers the price.
 */
function hireSheet({ listing: l, biz, balance, renewing, buy, done }) {
  if (!l) return;
  const thread = biz?.cofounder?.threadId;
  const start = Date.now();
  const end = start + TERM_DAYS * DAY_MS;
  const short = balance == null ? 0 : Math.max(0, l.price - Math.round(balance));
  const pack = PACKS.find(p => p.credits >= short) ?? PACKS[PACKS.length - 1];
  const m = modal(`<h2>${renewing ? 'Renew' : 'Hire'} ${esc(l.name)}</h2>`
    + `<p class="muted">${esc(l.for)}${biz ? ` For ${esc(biz.name)}.` : ''}</p>`
    + `<ul class="sheet-list">${l.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>`
    + `<dl class="terms" id="hire-terms">`
    + `<dt>Price</dt><dd><b>${esc(num(l.price))} credits</b> (${esc(dollars(l.price))}), held in escrow from your credits when both sides sign, and paid to VibeStartup when you accept the work</dd>`
    + `<dt>Term</dt><dd>30 days: ${esc(day(start))} to ${esc(day(end))}</dd>`
    + `<dt>Ceiling</dt><dd>The work stops at ${esc(num(l.ceiling))} credits of model, image and mail cost, and you are told</dd>`
    + `<dt>Renewal</dt><dd>Nothing renews by itself. Hire again for the next 30 days</dd>`
    + `<dt>Your credits</dt><dd>${balance == null ? '—' : esc(num(Math.round(balance)))}</dd></dl>`
    + (!thread ? `<div class="note warn">This business has no co-founder thread yet, so there is nothing to hire for. Open Chat to wake your co-founder first.</div>` : '')
    + (short > 0 ? `<div class="note warn" id="hire-short">You need ${esc(num(short))} more credits. <button type="button" class="btn quiet" data-buy="${esc(pack.id)}">Buy ${esc(pack.name)}: ${esc(num(pack.credits))} credits for ${esc(usd(pack.usd))}</button></div>` : '')
    + `<p class="hint">If the work is not what you asked for, dispute it before you accept: the credits stay held until an arbiter decides.</p>`
    + `<div class="modal-actions"><button type="button" class="btn quiet" value="cancel">Cancel</button><button type="button" class="btn primary" id="hire-confirm" ${short > 0 || !thread ? 'disabled' : ''}>${renewing ? 'Renew' : 'Hire'} for ${esc(num(l.price))} credits</button></div>`,
  { label: `${renewing ? 'Renew' : 'Hire'} ${l.name}` });
  m.el.id = 'hire-sheet';
  $('[value=cancel]', m.el).onclick = () => m.close('cancel');
  $$('[data-buy]', m.el).forEach(b => b.onclick = () => buy(b, b.dataset.buy));
  $('#hire-confirm', m.el).onclick = e => busy(e.currentTarget, async () => {
    try {
      const { contract } = await services.propose({
        listingId: l.id,
        customerThreadId: thread,
        title: `${l.name} for ${biz.name}`.slice(0, 200),
        brief: `VibeStartup ${l.name} for 30 days, for the business "${biz.name}" (its CommandAGI organisation ${biz.org}, cloud://home/${biz.org}/, its co-founder thread ${thread}). ${l.features.join('. ')}.`,
        // Set at the confirm, not when the sheet opened: the listing signs only a 30-day term (CommandAGI 6c3f8548385).
        deadline: Date.now() + TERM_DAYS * DAY_MS,
      });
      if (!contract?.id) throw new Error('The contract was not made. Try again.');
      try { await services.sign(contract.id); }
      catch (err) {
        // The proposal stands; the founder signs it from the list once the reason is gone.
        toast(oops(err), 'bad'); m.close('ok'); done?.(); return;
      }
      toast(`${l.name}: signed. VibeStartup signs next, then the work starts.`, 'ok');
      m.close('ok'); done?.();
    } catch (err) { toast(oops(err), 'bad'); }
  });
}
