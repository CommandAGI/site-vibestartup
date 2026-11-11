// Billing: credits (what the co-founder's work draws on) and the packs that buy them, the three listings a founder hires
// from launch day, the ledger and disputes. Prices are CommandAGI's (docs/organization.md § VibeStartup: prices,
// providers and launch, 2026-11-08); the listings open on the launch day and are hired through a service contract.
import { api, credits, creditsHistory, BRAND } from '/lib/api.js';
import { $, esc, num, when, oops, busy, toast } from '/lib/ui.js';
import { head, section } from './_shared.js';

const LAUNCH = '2026-12-08';
/** CommandAGI's credit packs (packages/domain/core billing.ts CREDIT_PACKS): 1 credit is $0.01 at list. */
const PACKS = [
  { id: 'pack-starter', name: 'Starter', credits: 1000, usd: 10 },
  { id: 'pack-plus', name: 'Plus', credits: 5500, usd: 50, popular: true },
  { id: 'pack-pro', name: 'Pro', credits: 12000, usd: 100 },
];
/** The listings of org-vibestartup (its org.json): one 30-day contract each, run by the co-founder agent. */
const LISTINGS = [
  { id: 'listing-vibestartup-cofounder', name: 'Co-founder', usd: 39, credits: 2400, for: 'Your idea, running.', features: ['A live storefront with checkout into your own Stripe account', 'A business email address', 'A brand kit, the seven-day launch week and a daily briefing', 'Every big decision waits for your approval'] },
  { id: 'listing-vibestartup-growth', name: 'Growth', usd: 29, credits: 1800, for: 'Customers, inside a budget you set.', features: ['One focused ad campaign on your own Meta ad account', 'Posts on the social accounts you connect', 'Mail to contacts who opted in', 'Never spends past your approved budget; ad spend is paid to Meta by you'] },
  { id: 'listing-vibestartup-studio', name: 'Studio', usd: 29, credits: 1800, for: 'Your brand, made.', features: ['A brand book: colours, type and voice', 'Up to 100 offer images, sized for every placement', 'Up to 4 five-second videos', 'Made in your brand within 30 days'] },
];
const launched = () => Date.now() >= Date.parse(`${LAUNCH}T00:00:00Z`);
const usd = n => `$${num(n)}`;

export async function render(ctx) {
  const { el, founder } = ctx;
  const [balance, history] = await Promise.all([credits().catch(() => null), creditsHistory().catch(() => ({ entries: [] }))]);
  const entries = history.entries ?? history.history ?? [];
  const back = new URLSearchParams(location.search);
  el.innerHTML = head('Billing', `Signed in as ${esc(founder?.email ?? '')}. Your customers pay you through your own Stripe account; this page is what you pay for your co-founder's work.`)
    + (back.get('checkout') ? `<div class="note ok">Thank you. Your credits arrive as soon as Stripe confirms the payment.</div>` : '')
    + section('Credits', `<div class="grid-2"><div class="kpi"><b id="credits-balance">${balance == null ? '—' : esc(num(Math.round(balance)))}</b><span>credits</span><small>about ${balance == null ? '—' : esc(usd(Math.round(balance) / 100))} of work at list price</small></div><div class="kpi"><b>${esc(String(entries.length))}</b><span>entries</span><small>in the recent ledger</small></div></div>`
      + `<div class="plans packs" id="packs">${PACKS.map(p => `<article class="card${p.popular ? ' popular' : ''}" data-pack="${esc(p.id)}"><h3>${esc(p.name)}${p.popular ? ' <span class="badge ok">best value</span>' : ''}</h3><p class="price">${esc(usd(p.usd))}</p><p class="muted">${esc(num(p.credits))} credits${p.credits > p.usd * 100 ? ` · ${esc(num(p.credits - p.usd * 100))} free` : ''}</p><button type="button" class="btn ${p.popular ? 'primary' : 'quiet'}" data-buy="${esc(p.id)}">Buy ${esc(p.name)}</button></article>`).join('')}</div>`
      + `<p class="hint">Stripe's secure page takes the payment. Your co-founder's model calls, images, video and mail draw on your credits at cost.</p>`)
    + section(launched() ? 'Hire your co-founder' : `Hire your co-founder · opens ${new Date(`${LAUNCH}T12:00:00Z`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`, `<div class="plans" id="plans">${LISTINGS.map(l => `<article class="card" data-listing="${esc(l.id)}"><h3>${esc(l.name)}</h3><p class="muted">${esc(l.for)}</p><p class="price">${esc(usd(l.usd))} <span class="muted">/ 30 days</span></p><ul>${l.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul><p class="hint">Includes up to ${esc(num(l.credits))} credits of work. Price set at launch: ${esc(usd(l.usd))} from ${esc(LAUNCH)}.</p><button type="button" class="btn quiet" data-plan="${esc(l.name)}">${launched() ? `Hire ${esc(l.name)}` : 'Opens at launch'}</button></article>`).join('')}</div><div id="plan-note"></div>`)
    + section('Your plan', `<div class="panel stack"><p id="plan-current"><b>Free</b> <span class="badge">until launch</span></p><p class="muted">Free now: a storefront with checkout into your own Stripe account, a business email, a brand kit, the launch week and a daily briefing, on your credits. Not included: sourcing, stock or shipping (you bring the supplier), and edits to a site you already have.</p></div>`)
    + section('Ledger', entries.length ? `<table class="table"><thead><tr><th>When</th><th>What</th><th class="num">Credits</th></tr></thead><tbody id="credits-history">${entries.slice(0, 50).map(e => `<tr><td>${esc(when(e.at ?? e.createdAt ?? e.timestamp ?? Date.now()))}</td><td>${esc(e.reason ?? e.description ?? e.kind ?? e.type ?? '')}</td><td class="num">${esc(num(e.amount ?? e.delta ?? e.credits ?? 0))}</td></tr>`).join('')}</tbody></table>` : '<table hidden><tbody id="credits-history"></tbody></table><p class="hint">No ledger entries yet. Every credit your co-founder spends shows here, with what it was for.</p>')
    + section('Disputes', `<div class="panel stack"><p class="muted">Billed work that was not what you asked for can be disputed for its credits back.</p><a class="btn quiet" id="dispute" href="mailto:${esc(BRAND.support)}?subject=${encodeURIComponent('Dispute a charge')}&body=${encodeURIComponent(`Account: ${founder?.email ?? ''}\nWhat was billed: \nWhat I asked for: \n`)}">Dispute a charge</a></div>`);
  $('#packs', el).addEventListener('click', async e => {
    const b = e.target.closest('[data-buy]'); if (!b) return;
    await busy(b, async () => {
      try {
        // Back to this page when the API takes the brand's origin; until then it refuses it (origin_mismatch) and the
        // checkout returns to CommandAGI's own billing page.
        const body = { type: 'pack', packId: b.dataset.buy };
        const r = await api('/billing/checkout', { method: 'POST', body: { ...body, origin: location.origin, returnPath: `/app/${location.search}#page=billing` } })
          .catch(err => { if (err?.code === 'origin_mismatch') return api('/billing/checkout', { method: 'POST', body }); throw err; });
        if (r?.url) location.href = r.url; else toast('The checkout did not open. Try again.', 'bad');
      } catch (err) { toast(oops(err), 'bad'); }
    });
  });
  $('#plans', el).addEventListener('click', e => { const b = e.target.closest('[data-plan]'); if (!b) return; $('#plan-note', el).innerHTML = `<div class="note">${esc(b.dataset.plan)} opens on launch day, ${esc(LAUNCH)}. Until then everything runs on your credits.</div>`; });
}
