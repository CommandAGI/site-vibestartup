// First-run guides (docs/DESIGN.md § guides): a short row of callouts that point at real controls the first time a
// founder opens a surface. One mechanism; each guide is data:
//
//   { id, version, surface, ready?, steps: [{ at, title, text }] }
//
//   surface  a CSS selector that is on the page while the guide's place is in front (`#main[data-tab=products]`)
//   ready    a selector that must be on screen before the guide shows (the place has drawn its controls)
//   at       a selector of the control a step points at. A step whose control is not on screen is left out (the rail's
//            rows on a phone); a step with no `at` sits at the foot of the window.
//
// What a founder has seen is kept per account in this browser (`vs_guides:<account id>`: { id: version }); a guide
// whose version is above the one seen shows again, so bump `version` when its steps change. "Replay the tour" in the
// account menu forgets what was seen.
//
// Never blocking: a callout is not modal and takes no focus. Escape, a press outside it, Skip and the last step's
// button close it, and each counts as seen. It waits while a dialog, a menu or the phone's drawer is open, and it is
// said through a polite live region. A browser driven by automation (navigator.webdriver) sees no guide unless it
// asks: `?guides=1` in the address, or `vs_guides_ask` = "1" in localStorage.
import { esc } from '/lib/ui.js';

/** The copy speaks to a first-time founder: warm, concrete, second person, one action a step. */
export const GUIDES = [
  { id: 'wizard', version: 1, surface: '#wizard[data-step=idea]', ready: '#idea', steps: [
    { at: '#idea', title: 'It starts with one sentence', text: 'Type the idea the way you would tell a friend. Rough is fine: you can change everything later.' },
    { at: '.starters', title: 'No idea yet? Borrow one', text: 'Tap a starter and make it yours.' },
    { at: '#step-label', title: 'A few quick picks', text: 'A name, a look, a co-founder. A couple of minutes, then your business is real.' },
    { at: '#continue', title: 'Ready? Go', text: 'Hit this when the idea feels right. Your co-founder takes it from here.' },
  ] },
  { id: 'console', version: 1, surface: '#main[data-tab=chat]', ready: '#composer', steps: [
    { at: '#compose-form', title: 'Say hi to your co-founder', text: 'Ask for anything: a product page, a launch post, a plan for the week. Type it here and send.' },
    { at: '#prompts', title: 'Stuck? Tap a starter', text: 'A chip writes the question for you. You just hit send.' },
    { at: '.approval, #building [data-needs]', title: 'You make the big calls', text: 'When something needs your yes, it shows up here. Approve it and your co-founder gets moving.' },
    { at: '#tabs, #more', title: 'Your whole business, one menu', text: 'Home, Work, Sell, Grow, Company. Everything your business needs is one tap away.' },
    { at: '#tabs a[data-tab=products]', title: 'Add your first product', text: 'One product is enough to start selling. Open Products and add it.' },
    { at: '#tabs a[data-tab=settings]', title: 'Get paid', text: 'Connect Stripe in Settings and every sale lands in your own account.' },
    { at: '#credits', title: 'Credits power the work', text: 'Your co-founder runs on credits, and you started with free ones. Tap here to see them.' },
  ] },
  { id: 'products', version: 1, surface: '#main[data-tab=products]', ready: '#add-product', steps: [
    { at: '#add-product', title: 'Put something up for sale', text: 'Name it, price it, done. It goes on your storefront right away.' },
    { at: '#product-list .product', title: 'This one is live', text: 'Your storefront is selling it now. Go show someone!' },
    { at: '#payments-needed', title: 'One step to real money', text: 'Connect Stripe and buyers pay you by card. Until then, orders reach you by email.' },
  ] },
  { id: 'studio', version: 1, surface: '#main[data-tab=studio]', ready: '#studio-tabs', steps: [
    { at: '#studio-tabs', title: 'Your brand, made here', text: 'Images and clips for your offer, in your colours and your voice.' },
    { at: '#make-format', title: 'Pick what to make', text: 'A product shot, a story, an ad. Each format shows what it costs before anything is made.' },
    { at: '#make-go', title: 'Make it', text: 'Hit this and watch it appear. Keep the ones you love.' },
  ] },
  { id: 'tasks', version: 1, surface: '#main[data-tab=tasks]', ready: '#approvals, #new-task', steps: [
    { at: '#approvals', title: 'Your yes goes here', text: 'Your co-founder asks before the big moves. Approve one and it starts right away.' },
    { at: '#in-progress', title: 'Watch the work happen', text: 'Everything in motion sits here, so you always know what is being done.' },
    { at: '#new-task', title: 'Hand something off', text: 'Got a job in mind? Write it down and your co-founder picks it up.' },
    { at: '#routines', title: 'Put it on repeat', text: 'A routine runs on a schedule, like your daily briefing. Pause or change one any time.' },
  ] },
];

const KEY = 'vs_guides', ASK = 'vs_guides_ask', SETTLE_MS = 1000;
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage off: the guide shows again next time */ } },
};
const shown = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
const first = sel => { try { return [...document.querySelectorAll(sel)].find(shown) ?? null; } catch { return null; } };
const phone = () => matchMedia('(max-width: 760px)').matches;

let account = 'anon', current = null, layer = null, live = null, timer = 0, settling = null;
const dismissedNow = new Set();

const seenKey = () => `${KEY}:${account}`;
function seen() { try { return JSON.parse(store.get(seenKey()) ?? '{}') ?? {}; } catch { return {}; } }
function markSeen(guide) { dismissedNow.add(guide.id); store.set(seenKey(), JSON.stringify({ ...seen(), [guide.id]: guide.version })); }

/** Whether guides show here: always for a person; under automation only when it asks. */
export function guidesOn() {
  if (!globalThis.navigator?.webdriver) return true;
  return new URLSearchParams(location.search).get('guides') === '1' || store.get(ASK) === '1';
}
const busy = () => document.body.dataset.rail === 'open' || [...document.querySelectorAll('dialog[open], .menu')].some(shown);

function check() {
  timer = 0;
  if (!guidesOn()) return close(false);
  if (current) {
    // The place went away (another tab, another step): the guide waits for it, unseen.
    if (!first(current.guide.surface)) return close(false);
    return place();
  }
  if (busy()) return;
  const was = seen();
  for (const guide of GUIDES) {
    if (dismissedNow.has(guide.id) || (was[guide.id] ?? 0) >= guide.version || !first(guide.surface)) continue;
    if (guide.ready && !first(guide.ready)) return;
    const steps = guide.steps.filter(s => !s.at || first(s.at));
    if (!steps.length) return;
    // A tab draws over several renders: the guide opens once the controls it can point at have held for a second.
    const key = `${guide.id}:${steps.length}`;
    if (settling?.key !== key) settling = { key, since: Date.now() };
    if (Date.now() - settling.since < SETTLE_MS) { timer = setTimeout(check, SETTLE_MS / 2); return; }
    settling = null;
    current = { guide, steps, index: 0 };
    layer.hidden = false;
    return draw();
  }
}
function schedule() { if (!timer) timer = setTimeout(check, 250); }

/** Close the callout; `wasSeen`: the founder closed it, so it does not come back. */
function close(wasSeen) {
  if (!current) return;
  const { guide } = current;
  current = null;
  layer.hidden = true;
  layer.replaceChildren();
  document.documentElement.removeAttribute('data-guide');
  if (wasSeen) markSeen(guide);
  schedule();
}

function draw() {
  const { guide, steps, index } = current, step = steps[index], last = index === steps.length - 1;
  layer.innerHTML = `<div class="guide-ring" aria-hidden="true"></div>
    <div class="guide" role="dialog" aria-modal="false" aria-labelledby="guide-title" aria-describedby="guide-text" data-guide="${esc(guide.id)}" data-step="${index}">
      <h3 class="guide-title" id="guide-title">${esc(step.title)}</h3>
      <p class="guide-text" id="guide-text">${esc(step.text)}</p>
      <div class="guide-foot">${steps.length > 1 ? `<span class="guide-dots" aria-label="Step ${index + 1} of ${steps.length}">${steps.map((_, i) => `<i class="${i === index ? 'on' : ''}"></i>`).join('')}</span>` : ''}<span class="grow"></span>${last ? '' : '<button type="button" class="btn sm ghost guide-skip">Skip</button>'}<button type="button" class="btn sm primary guide-next">${last ? 'Got it' : 'Next'}</button></div>
    </div>`;
  layer.querySelector('.guide-skip')?.addEventListener('click', () => close(true));
  layer.querySelector('.guide-next').addEventListener('click', () => { if (last) return close(true); advance(); });
  document.documentElement.dataset.guide = `${guide.id}:${index}`;
  // Polite: said after what the founder is doing now, never in place of it.
  live.textContent = `${step.title}. ${step.text}`;
  const anchor = step.at ? first(step.at) : null;
  // Bring the control into view without taking focus.
  const r = anchor?.getBoundingClientRect();
  if (r && (r.top < 0 || r.bottom > innerHeight) && r.height < innerHeight) anchor.scrollIntoView({ block: 'center', behavior: 'instant' });
  place();
}
/** The next step. The place may have drawn more controls since the guide opened: the steps are read again. */
function advance() {
  const { guide, steps, index } = current;
  const now = guide.steps.filter(s => !s.at || first(s.at) || s === steps[index]);
  current.steps = now;
  current.index = now.indexOf(steps[index]) + 1;
  if (current.index >= now.length) return close(true);
  draw();
}

/** Put the callout beside its control: under it, else over it, else at its side; on a phone, a sheet clear of it. */
function place() {
  const card = layer.querySelector('.guide'), ring = layer.querySelector('.guide-ring');
  if (!current || !card) return;
  const step = current.steps[current.index], anchor = step.at ? first(step.at) : null;
  const r = anchor?.getBoundingClientRect();
  ring.hidden = !r;
  if (r) Object.assign(ring.style, { left: `${r.left - 3}px`, top: `${r.top - 3}px`, width: `${r.width + 6}px`, height: `${r.height + 6}px` });
  card.classList.toggle('guide-sheet', phone() || !r);
  if (phone() || !r) {
    // A sheet at the foot of the screen; at the top when the control is in the lower half.
    card.dataset.side = r && (r.top + r.height / 2) > innerHeight / 2 ? 'top' : 'bottom';
    card.style.left = card.style.top = '';
    return;
  }
  const w = card.offsetWidth, h = card.offsetHeight, gap = 12, pad = 12;
  const clampX = x => Math.max(pad, Math.min(x, innerWidth - w - pad)), clampY = y => Math.max(pad, Math.min(y, innerHeight - h - pad));
  let side, x, y;
  if (r.bottom + gap + h + pad <= innerHeight) { side = 'below'; x = clampX(r.left + Math.min(r.width / 2, 160) - w / 2); y = r.bottom + gap; }
  else if (r.top - gap - h - pad >= 0) { side = 'above'; x = clampX(r.left + Math.min(r.width / 2, 160) - w / 2); y = r.top - gap - h; }
  else if (r.right + gap + w + pad <= innerWidth) { side = 'right'; x = r.right + gap; y = clampY(r.top + Math.min(r.height / 2, 120) - h / 2); }
  else if (r.left - gap - w - pad >= 0) { side = 'left'; x = r.left - gap - w; y = clampY(r.top + Math.min(r.height / 2, 120) - h / 2); }
  else { side = 'over'; x = clampX(r.right - w - gap); y = clampY(r.bottom - h - gap); }
  card.dataset.side = side;
  card.style.left = `${Math.round(x)}px`; card.style.top = `${Math.round(y)}px`;
}

/** Forget what this account has seen and show the guide of the place in front (the account menu's "Replay the tour"). */
export function replayGuides() {
  dismissedNow.clear();
  store.set(seenKey(), '{}');
  close(false);
  schedule();
}

/** Start watching the page. `accountId` names whose "seen" this is (none on a page before sign-in). */
export function startGuides(accountId) {
  account = accountId || 'anon';
  if (layer) return schedule();
  layer = document.createElement('div'); layer.className = 'guide-layer'; layer.hidden = true;
  live = document.createElement('div'); live.className = 'sr-only'; live.setAttribute('aria-live', 'polite');
  document.body.append(layer, live);
  new MutationObserver(m => { if (m.some(x => !layer.contains(x.target))) schedule(); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-tab', 'data-step', 'data-rail', 'hidden', 'open'] });
  addEventListener('hashchange', schedule);
  addEventListener('resize', () => current && place());
  addEventListener('scroll', () => current && place(), { capture: true, passive: true });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && current && !busy()) close(true); });
  document.addEventListener('pointerdown', e => { if (current && !e.target.closest?.('.guide')) close(true); }, true);
  schedule();
}
