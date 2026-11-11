// The new-business wizard: one question per screen, the suggestions made by a script from the founder's words
// (lib/business.js), then the creation sequence against CommandAGI (createBusiness), each step shown as it finishes.
import { requireSignIn, setNotificationPref, settleReferral, ApiError } from '/lib/api.js';
import { $, $$, esc, oops } from '/lib/ui.js';
import { IDEA_STARTERS, suggestBlueprints, suggestNames, suggestTagline, VIBES, VOICES, PARTNERS, COFOUNDER_NAMES, brandFor, createBusiness } from '/lib/business.js';

// A signed-out visitor is sent to /auth/ and this page does nothing more (no thrown error: the redirect is the answer).
const signedInHere = requireSignIn();
// A shared link's ref that the sign-up could not hand over (an API without the door then) is named now, within its day.
if (signedInHere) settleReferral();

const STEPS = ['idea', 'blueprint', 'name', 'vibe', 'voice', 'partner', 'cofounder', 'updates'];
const LABELS = { idea: 'Idea', blueprint: 'Blueprint', name: 'Name', vibe: 'Look', voice: 'Voice', partner: 'Partner', cofounder: 'Co-founder', updates: 'Updates' };
const params = new URLSearchParams(location.search);
const state = { idea: params.get('idea') ?? '', blueprint: null, name: '', vibe: 'clean', voice: 'casual', partner: 'creative', cofounder: COFOUNDER_NAMES[0], updates: true };
let at = 0;

const wizard = $('#wizard'), body = $('#wiz-body'), title = $('#wiz-title'), sub = $('#wiz-sub'), label = $('#step-label'), fill = $('#wiz-fill');
const back = $('#back'), next = $('#continue'), skip = $('#skip'), error = $('#wiz-error');

const choices = (items, selectedId, { suggestedId, extra } = {}) => `<div class="choices" id="choices">${items.map(it => `<button type="button" class="choice${it.id === suggestedId ? ' suggested' : ''}" data-id="${esc(it.id)}" aria-pressed="${String(it.id === selectedId)}"><b>${esc(it.title ?? it.name)}</b>${it.about ? `<p>${esc(it.about)}</p>` : ''}${it.sample ? `<p class="sample">${esc(it.sample)}</p>` : ''}${it.traits ? `<div class="traits">${it.traits.map(t => `<span>${esc(t)}</span>`).join('')}</div>` : ''}${extra ? extra(it) : ''}</button>`).join('')}</div>`;
const own = (placeholder, value = '') => `<label class="own field"><span>Or your own</span><input id="own" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="80"></label>`;

const SCREENS = {
  idea: {
    title: 'First things first: what are we building?', sub: 'Tell me your idea in a line, or start from one below.', ok: 'Looks good',
    render: () => `<label class="field"><span class="sr-only">Your idea</span><textarea id="idea" maxlength="240" placeholder="A camera-enabled desk lamp that lets an assistant see your notebook">${esc(state.idea)}</textarea></label><p class="hint">Need a starting point?</p><div class="starters">${IDEA_STARTERS.map(s => `<button type="button" class="chip" data-starter>${esc(s)}</button>`).join('')}</div>`,
    bind: () => { $$('[data-starter]').forEach(c => c.onclick = () => { $('#idea').value = c.textContent; $('#idea').focus(); }); $('#idea').focus(); },
    read: () => { state.idea = $('#idea').value.trim(); if (state.idea.length < 8) throw new Error('Say the idea in at least a few words.'); state.blueprint ??= suggestBlueprints(state.idea)[0]; },
  },
  blueprint: {
    title: 'Locked in. What should the first version offer?', sub: 'The first version is one offer, not a catalogue. Pick the shape, or write your own.', ok: 'Continue',
    render: () => { const list = suggestBlueprints(state.idea); const sel = state.blueprint?.id && list.some(b => b.id === state.blueprint.id) ? state.blueprint.id : (state.blueprint?.id === 'own' ? 'own' : list[0].id); return choices(list, sel, { suggestedId: list[0].id }) + own('A membership with monthly office hours', state.blueprint?.id === 'own' ? state.blueprint.title : ''); },
    bind: () => bindChoices(id => { const list = suggestBlueprints(state.idea); state.blueprint = list.find(b => b.id === id) ?? state.blueprint; $('#own').value = ''; }),
    read: () => { const o = $('#own').value.trim(); if (o) state.blueprint = { id: 'own', title: o, about: '' }; if (!state.blueprint) throw new Error('Pick one, or write your own.'); },
  },
  name: {
    title: 'Every business needs a name.', sub: 'A few that fit your idea. Pick one, or hand me your own.', ok: 'Continue',
    render: () => { const names = suggestNames(state.idea).map(n => ({ id: n, name: n })); if (!state.name && names[0]) state.name = names[0].id; const sel = names.some(n => n.id === state.name) ? state.name : ''; return `<div class="names" id="choices">${names.map((n, i) => `<button type="button" class="choice${i === 0 ? ' suggested' : ''}" data-id="${esc(n.id)}" aria-pressed="${String(n.id === sel)}"><b>${esc(n.name)}</b><div class="vibe-swatches">${[brandFor(n.name, state.vibe).primary, brandFor(n.name, state.vibe).secondary, brandFor(n.name, state.vibe).accent].map(c => `<i style="background:${esc(c)}"></i>`).join('')}</div></button>`).join('')}</div>` + own('Your own name', names.some(n => n.id === state.name) ? '' : state.name); },
    bind: () => bindChoices(id => { state.name = id; $('#own').value = ''; }),
    read: () => { const o = $('#own').value.trim(); if (o) state.name = o; if (!state.name) throw new Error('Pick a name, or write one.'); },
  },
  vibe: {
    title: 'How should it look?', sub: 'The brand kit, the storefront and every image follow this.', ok: 'Continue',
    render: () => choices(VIBES, state.vibe, { suggestedId: 'clean', extra: v => `<div class="vibe-swatches">${[brandFor(state.name, v.id).primary, brandFor(state.name, v.id).secondary, brandFor(state.name, v.id).accent].map(c => `<i style="background:${esc(c)}"></i>`).join('')}</div>` }),
    bind: () => bindChoices(id => { state.vibe = id; }),
    read: () => {},
  },
  voice: {
    title: 'How should it sound?', sub: 'Every page, post and email is written in this voice.', ok: 'Continue',
    render: () => choices(VOICES, state.voice, { suggestedId: 'casual' }),
    bind: () => bindChoices(id => { state.voice = id; }),
    read: () => {},
  },
  partner: {
    title: 'What kind of partner do you want?', sub: 'Your co-founder’s character: how it plans, how it pushes, what it cares about.', ok: 'Continue',
    render: () => choices(PARTNERS.map(p => ({ ...p, title: p.name })), state.partner, { suggestedId: 'creative' }),
    bind: () => bindChoices(id => { state.partner = id; }),
    read: () => {},
  },
  cofounder: {
    title: 'Name your co-founder.', sub: 'It will introduce itself with this name, and say it is an AI agent.', ok: 'Continue',
    render: () => `<div class="chips-row" id="choices">${COFOUNDER_NAMES.map(n => `<button type="button" class="chip choice-chip" data-id="${esc(n)}" aria-pressed="${String(n === state.cofounder)}">${esc(n)}</button>`).join('')}</div>` + own('Or a name of your own', COFOUNDER_NAMES.includes(state.cofounder) ? '' : state.cofounder),
    bind: () => { $$('#choices .chip').forEach(c => c.onclick = () => { $$('#choices .chip').forEach(x => x.setAttribute('aria-pressed', 'false')); c.setAttribute('aria-pressed', 'true'); state.cofounder = c.dataset.id; $('#own').value = ''; }); },
    read: () => { const o = $('#own').value.trim(); if (o) state.cofounder = o; if (!state.cofounder) throw new Error('Give your co-founder a name.'); },
  },
  updates: {
    title: 'Want an email when something needs your call?', sub: 'Approvals, milestones and the daily briefing. Only when you are needed.', ok: `Create the business`, skippable: true,
    render: () => `<label class="check"><input type="checkbox" id="updates" ${state.updates ? 'checked' : ''}><span>Email me when something needs my call. This records the preference on your CommandAGI account; text messages are not set up here.</span></label>
      <div class="summary"><div><span>Idea</span><b>${esc(state.idea)}</b></div><div><span>First version</span><b>${esc(state.blueprint?.title ?? '')}</b></div><div><span>Name</span><b>${esc(state.name)}</b></div><div><span>Look</span><b>${esc(VIBES.find(v => v.id === state.vibe)?.name ?? '')}</b></div><div><span>Voice</span><b>${esc(VOICES.find(v => v.id === state.voice)?.name ?? '')}</b></div><div><span>Partner</span><b>${esc(PARTNERS.find(p => p.id === state.partner)?.name ?? '')}</b></div><div><span>Co-founder</span><b>${esc(state.cofounder)}</b></div></div>`,
    bind: () => {},
    read: () => { state.updates = $('#updates').checked; },
  },
};

function bindChoices(onPick) {
  $$('#choices .choice').forEach(c => c.onclick = () => { $$('#choices .choice').forEach(x => x.setAttribute('aria-pressed', 'false')); c.setAttribute('aria-pressed', 'true'); onPick(c.dataset.id); });
}

function show() {
  const step = STEPS[at], s = SCREENS[step];
  wizard.dataset.step = step;
  label.textContent = `Step ${at + 1} of ${STEPS.length} · ${LABELS[step]}`;
  fill.style.width = `${((at + 1) / STEPS.length) * 100}%`;
  title.textContent = s.title; sub.textContent = s.sub;
  body.innerHTML = s.render();
  s.bind();
  error.textContent = '';
  back.hidden = at === 0;
  skip.hidden = !s.skippable;
  next.textContent = s.ok;
  next.hidden = false;
  document.title = `${LABELS[step]} · New business | VibeStartup`;
  window.scrollTo({ top: 0 });
}
back.onclick = () => { if (at > 0) { at--; show(); } };
skip.onclick = () => { state.updates = false; build(); };
next.onclick = () => {
  try { SCREENS[STEPS[at]].read(); } catch (e) { error.textContent = oops(e); return; }
  if (at < STEPS.length - 1) { at++; show(); } else build();
};
body.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); next.click(); } });

const BUILD_STEPS = ['Making the folder', 'Claiming the business email', 'Creating the storefront', "Writing the co-founder's memory", `Waking the co-founder`, 'Scheduling the daily briefing'];
async function build() {
  wizard.dataset.step = 'building';
  label.textContent = 'Setting up your business';
  fill.style.width = '100%';
  title.textContent = `Building ${state.name}`;
  sub.textContent = 'This usually takes about a minute. Each step is a real act on your CommandAGI account.';
  back.hidden = true; skip.hidden = true; next.hidden = true;
  body.innerHTML = `<ol id="building">${BUILD_STEPS.map(s => `<li data-step="${esc(s)}"><i></i><span>${esc(s)}</span></li>`).join('')}</ol>`;
  const rows = $$('#building li');
  const mark = (labelText, cls) => { const row = rows.find(r => labelText.startsWith(r.dataset.step.split(' ')[0]) && r.dataset.step.split(' ')[1] === labelText.split(' ')[1]) ?? rows.find(r => !r.hasAttribute('data-done') && !r.classList.contains('doing')); return row; };
  let current = null;
  const onStep = text => {
    if (current) { current.classList.remove('doing'); current.setAttribute('data-done', '1'); }
    current = rows.find(r => r.dataset.step.toLowerCase().startsWith(text.toLowerCase().split(' ').slice(0, 2).join(' '))) ?? rows.find(r => !r.hasAttribute('data-done') && !r.classList.contains('doing'));
    current?.classList.add('doing');
  };
  try {
    if (state.updates) await setNotificationPref('email', true).catch(() => null);
    const biz = await createBusiness({ idea: state.idea, name: state.name, tagline: suggestTagline(state.idea), blueprint: state.blueprint, vibe: state.vibe, voice: state.voice, partner: state.partner, cofounder: state.cofounder }, { onStep });
    if (current) { current.classList.remove('doing'); current.setAttribute('data-done', '1'); }
    for (const g of biz.gaps ?? []) {
      const row = rows.find(r => r.dataset.step.toLowerCase().includes(g.what === 'cofounder' ? 'waking' : g.what === 'briefing' ? 'briefing' : g.what === 'site' || g.what === 'deploy' ? 'storefront' : g.what));
      if (row) { row.classList.add('gap'); row.removeAttribute('data-done'); row.insertAdjacentHTML('beforeend', `<small>${esc(g.why)}</small>`); }
    }
    rows.forEach(r => { if (!r.hasAttribute('data-done') && !r.classList.contains('gap')) r.setAttribute('data-done', '1'); });
    sub.textContent = biz.gaps?.length ? `${state.name} exists. ${biz.gaps.length} step${biz.gaps.length === 1 ? '' : 's'} did not finish; the console says what to do.` : `${state.name} is ready. Opening the console…`;
    setTimeout(() => { location.href = `/app/?b=${encodeURIComponent(biz.slug)}`; }, biz.gaps?.length ? 2500 : 900);
  } catch (e) {
    if (current) current.classList.add('gap');
    error.textContent = e instanceof ApiError && e.status === 401 ? 'Your sign-in ended. Sign in again and try once more.' : `Could not create the business: ${oops(e)}`;
    next.hidden = false; next.textContent = 'Try again'; back.hidden = false;
    next.onclick = () => build();
  }
}

if (signedInHere) show();
