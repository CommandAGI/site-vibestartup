// Billing: the plan, the plans (prices set at launch), credits and their history, the safety cap, disputes.
import { credits, creditsHistory, subscription, BRAND } from '/lib/api.js';
import { $, esc, num, when, oops } from '/lib/ui.js';
import { head, section } from './_shared.js';

const PLANS = [
  { name: 'Starter', for: 'Testing your first idea.', features: ['One business', 'An agent team for code, images and video', 'Email and outbound', 'Ads on autopilot', 'A subdomain of vibestartup.pro'] },
  { name: 'Growth', for: 'For founders ready to grow.', features: ['Three businesses', 'Everything in Starter', 'Your own domain', 'Priority help'] },
  { name: 'Scale', for: 'Operators with many businesses.', features: ['Ten businesses', 'Everything in Growth', 'The most credits each month'] },
];

export async function render(ctx) {
  const { el, founder } = ctx;
  const [balance, history, sub] = await Promise.all([credits().catch(() => null), creditsHistory().catch(() => ({ entries: [] })), subscription().catch(() => null)]);
  const entries = history.entries ?? history.history ?? [];
  el.innerHTML = head('Billing', `Signed in as ${esc(founder?.email ?? '')}.`)
    + section('Your plan', `<div class="panel stack"><p id="plan-current"><b>Current plan: ${esc(sub?.planId ?? sub?.plan ?? 'Free')}</b>${sub?.status ? ` <span class="badge">${esc(sub.status)}</span>` : ''}</p><p class="muted">What you get: a storefront, checkout in test mode, business email, a brand kit, the launch week and a daily briefing. What you do not: sourcing, stock or shipping (you bring the supplier), and edits to a site you already have.</p></div>`)
    + section('Plans', `<div class="plans" id="plans">${PLANS.map(p => `<article class="card"><h3>${esc(p.name)}</h3><p class="muted">${esc(p.for)}</p><p class="price">Price set at launch</p><ul>${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul><button type="button" class="btn quiet" data-plan="${esc(p.name)}">Choose ${esc(p.name)}</button></article>`).join('')}</div><div id="plan-note"></div><p class="hint" style="margin-top:10px">Every plan carries a per-day safety cap on what runs your co-founder, measured on platform cost; it pauses autopilot for the day when reached. The cap, like the prices, is set at launch.</p>`)
    + section('Credits', `<div class="grid-2"><div class="kpi"><b id="credits-balance">${balance == null ? '—' : esc(num(Math.round(balance)))}</b><span>credits</span><small>what your co-founder's work draws on</small></div><div class="kpi"><b>${esc(String(entries.length))}</b><span>entries</span><small>in the recent ledger</small></div></div>${entries.length ? `<table class="table" style="margin-top:12px"><thead><tr><th>When</th><th>What</th><th class="num">Credits</th></tr></thead><tbody id="credits-history">${entries.slice(0, 50).map(e => `<tr><td>${esc(when(e.at ?? e.createdAt ?? e.timestamp ?? Date.now()))}</td><td>${esc(e.reason ?? e.description ?? e.kind ?? e.type ?? '')}</td><td class="num">${esc(num(e.amount ?? e.delta ?? e.credits ?? 0))}</td></tr>`).join('')}</tbody></table>` : '<table style="display:none"><tbody id="credits-history"></tbody></table><p class="hint" style="margin-top:8px">No ledger entries yet.</p>'}`)
    + section('Disputes', `<div class="panel stack"><p class="muted">Billed work that was not what you asked for can be disputed for its credits back.</p><a class="btn quiet" id="dispute" href="mailto:${esc(BRAND.support)}?subject=${encodeURIComponent('Dispute a charge')}&body=${encodeURIComponent(`Account: ${founder?.email ?? ''}\nWhat was billed: \nWhat I asked for: \n`)}">Dispute a charge</a></div>`);
  $('#plans', el).addEventListener('click', e => { const b = e.target.closest('[data-plan]'); if (!b) return; $('#plan-note', el).innerHTML = `<div class="note" style="margin-top:12px">${esc(b.dataset.plan)} opens when prices are set at launch. You keep your free credits until then.</div>`; });
}
