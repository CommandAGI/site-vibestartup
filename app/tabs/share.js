// Share & earn: a referral link and the ways to send it. The referral credit is set at launch, and says so.
import { BRAND } from '/lib/api.js';
import { $, esc, icon, copy } from '/lib/ui.js';
import { head, section } from './_shared.js';

export async function render(ctx) {
  const { el, founder } = ctx;
  const link = `${BRAND.home ?? 'https://vibestartup.pro'}/?ref=${encodeURIComponent(founder?.handle ?? founder?.id ?? '')}`;
  const text = `I'm building a business with an AI co-founder on ${BRAND.name}. Start yours: ${link}`;
  el.innerHTML = head('Share & earn', 'Give a friend a start; the referral credit for you both is set at launch.')
    + section('Your link', `<div class="panel stack"><div class="row"><input class="input grow" id="referral-link" value="${esc(link)}" readonly><button type="button" class="btn primary" id="copy-referral">${icon('copy', 16)} Copy</button></div><div class="row">${[['X', `https://x.com/intent/post?text=${encodeURIComponent(text)}`], ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`], ['Facebook', `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`], ['Text', `sms:?&body=${encodeURIComponent(text)}`], ['Email', `mailto:?subject=${encodeURIComponent('Start a business with an AI co-founder')}&body=${encodeURIComponent(text)}`]].map(([l, h]) => `<a class="btn quiet" href="${h}" target="_blank" rel="noopener">${esc(l)}</a>`).join('')}</div><p class="hint">What your friend gets and what you earn are set with the prices at launch. Nothing is promised that is not set.</p></div>`);
  $('#copy-referral', el).onclick = () => copy(link, 'Link copied');
}
