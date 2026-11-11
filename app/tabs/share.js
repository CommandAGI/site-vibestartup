// Share & earn: the founder's referral link, the ways to send it, and what it earned (GET /me/referrals; CommandAGI's
// docs/billing.md § referrals). Where the API has no referrals yet, the reward shows "Soon" and nothing is promised.
import { BRAND, referrals, emails } from '/lib/api.js';
import { $, esc, icon, copy, day, num, plural, prompt, toast, oops, busy } from '/lib/ui.js';
import { head, section, bars } from './_shared.js';

const STATE = {
  credited: ['ok', 'Credited'],
  pending: ['', 'Waiting for their email'],
  refused: ['warn', 'Not counted'],
};
const WHY = { monthly_cap: 'this month\'s limit was reached', address_used: 'that email already earned a reward', not_a_real_signup: 'a test account' };

export async function render(ctx) {
  const { el, founder } = ctx;
  el.innerHTML = head('Share & earn', `Give a friend a start on ${BRAND.name}.`) + bars(2);
  const info = await referrals().catch(() => null);
  const code = info?.code ?? founder?.handle ?? founder?.id ?? '';
  const link = `${BRAND.home ?? 'https://vibestartup.pro'}/?ref=${encodeURIComponent(code)}`;
  const text = `I'm building a business with an AI co-founder on ${BRAND.name}. Start yours: ${link}`;
  const canShare = typeof navigator.share === 'function';
  const credits = info?.rule?.credits ?? 0;

  const linkPanel = `<div class="panel stack"><div class="row"><input class="input grow" id="referral-link" value="${esc(link)}" readonly aria-label="Your referral link"><button type="button" class="btn primary" id="copy-referral">${icon('copy', 16)} Copy</button>${canShare ? `<button type="button" class="btn" id="share-referral">${icon('send', 16)} Share</button>` : ''}</div><div class="row">${[['X', `https://x.com/intent/post?text=${encodeURIComponent(text)}`], ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`], ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`], ['Text', `sms:?&body=${encodeURIComponent(text)}`], ['Email', `mailto:?subject=${encodeURIComponent('Start a business with an AI co-founder')}&body=${encodeURIComponent(text)}`]].map(([l, h]) => `<a class="btn quiet" href="${h}" target="_blank" rel="noopener">${esc(l)}</a>`).join('')}</div></div>`;

  // The API has no referrals yet: the link works, the reward waits, and the page says so.
  const soon = `<div class="panel stack" id="referral-rewards"><p>When a friend you bring confirms their email, you both get free credits. <span class="badge accent" id="referral-soon">Soon</span></p><p class="hint">The reward turns on with CommandAGI's next release. Share your link today; no credit is promised until then.</p></div>`;

  const own = info?.referredBy;
  const ownNote = own?.state === 'pending'
    ? `<div class="note accent stack" id="referral-unlock"><p><b>A friend brought you here.</b> Confirm your email and you both get ${num(own.credits ?? credits)} credits.</p><div><button type="button" class="btn primary" id="confirm-email">Confirm my email</button></div></div>`
    : own?.state === 'credited' ? `<div class="note ok" id="referral-unlock">You and the friend who brought you each got ${num(own.credits ?? credits)} credits.</div>` : '';

  const made = info?.referrals ?? [];
  const rewards = info ? `<div class="stack" id="referral-rewards">
      <p id="referral-rule">Bring a friend: when they confirm their email, you each get ${num(credits)} credits, for up to ${plural(info.rule.monthlyCap, 'friend')} a month.</p>
      <div class="grid-3"><div class="kpi"><span>Friends joined</span><b id="referral-count">${num(made.length)}</b></div><div class="kpi"><span>Credits earned</span><b id="referral-earned">${num(info.earned)}</b></div><div class="kpi"><span>This month</span><b>${num(info.thisMonth)} / ${num(info.rule.monthlyCap)}</b><small>rewarded friends</small></div></div>
      ${made.length ? `<table class="table" id="referral-list"><thead><tr><th>Joined</th><th>Status</th><th>Credits</th></tr></thead><tbody>${made.map(r => { const [cls, label] = STATE[r.state] ?? ['', r.state]; return `<tr><td>${esc(day(r.createdAt))}</td><td><span class="badge ${cls}">${esc(label)}</span>${r.refused ? ` <span class="hint">${esc(WHY[r.refused] ?? r.refused)}</span>` : ''}</td><td>${r.state === 'credited' ? num(r.credits) : '–'}</td></tr>`; }).join('')}</tbody></table>` : `<p class="hint">No friends yet. The first one who joins from your link shows up here.</p>`}
    </div>` : soon;

  el.innerHTML = head('Share & earn', `Give a friend a start on ${BRAND.name}.`)
    + ownNote
    + section('Your link', linkPanel)
    + section('Rewards', rewards);

  $('#copy-referral', el).onclick = () => copy(link, 'Link copied');
  const share = $('#share-referral', el);
  if (share) share.onclick = () => navigator.share({ title: BRAND.name, text: `I'm building a business with an AI co-founder on ${BRAND.name}. Start yours:`, url: link }).catch(() => null);
  const confirmBtn = $('#confirm-email', el);
  if (confirmBtn) confirmBtn.onclick = () => busy(confirmBtn, async () => {
    try {
      const login = (await emails.list()).find(e => e.login);
      if (!login) return toast('We could not find your sign-in email.', 'bad');
      if (!login.verified) {
        await emails.sendCode(login.id);
        const entered = await prompt(`We sent a 6-digit code to ${login.email}.`, { title: 'Confirm your email', ok: 'Confirm', placeholder: '123456' });
        if (!entered) return;
        await emails.confirm(login.id, entered);
      }
      toast('Email confirmed');
      return render(ctx);
    } catch (e) { toast(oops(e), 'bad'); }
  });
}
