// The account's businesses: each a folder in the founder's Drive (lib/business.js), and the account's two acts.
import { requireSignIn, whoami, user, credits, signOut, eraseAccount } from '/lib/api.js';
import { $, esc, initial, confirm, prompt, toast, oops, num } from '/lib/ui.js';
import { listBusinesses, launchDay, markSvg } from '/lib/business.js';

// A signed-out visitor is sent to /auth/ and this page does nothing more (no thrown error: the redirect is the answer).
const signedInHere = requireSignIn();

const list = $('#list');
const card = b => {
  const d = launchDay(b);
  return `<article class="biz-card" data-slug="${esc(b.slug)}">
    <div class="mark">${markSvg(b.name, b.brand)}</div>
    <div><h2>${esc(b.name)}</h2><p class="tag">${esc(b.tagline ?? b.idea ?? '')}</p></div>
    <div class="meta"><span class="badge">${d > 7 ? 'Launch week done' : `Day ${d} of 7`}</span><span class="badge cofounder">${esc(b.cofounder?.name ?? 'Co-founder')}</span>${b.site?.url ? `<span class="badge ok">Storefront</span>` : ''}${b.email?.address ? `<span class="badge">Email</span>` : ''}</div>
    ${b.gaps?.length ? `<p class="gaps">${b.gaps.length} step${b.gaps.length === 1 ? '' : 's'} did not finish: ${esc(b.gaps.map(g => g.what).join(', '))}. Open the console to see what to do.</p>` : ''}
    <a class="btn primary open" href="/app/?b=${encodeURIComponent(b.slug)}">Open the console</a>
  </article>`;
};

async function load() {
  try {
    const me = await whoami();
    if (me.exists === false) { await signOut(); location.href = '/auth/'; return; }
    const u = await user(me.id).catch(() => ({}));
    $('#account-name').textContent = u.name || 'Your account';
    $('#account-email').textContent = u.email || '';
    $('#account-initial').textContent = initial(u.name || u.email);
    $('#who').textContent = u.email || '';
    credits().then(c => { $('#credits-badge').textContent = `${num(c)} credits`; }).catch(() => null);
    const businesses = await listBusinesses();
    $('#biz-count').textContent = businesses.length ? `${businesses.length}` : '';
    list.insertAdjacentHTML('afterbegin', businesses.map(card).join(''));
    if (!businesses.length) list.insertAdjacentHTML('afterbegin', `<div class="biz-card"><h2>No business yet</h2><p class="tag">Start one: say the idea, pick a name and a look, name your co-founder. About a minute.</p></div>`);
  } catch (e) {
    if (e?.status === 401) { location.href = '/auth/?next=%2Fhome%2F'; return; }
    toast(oops(e), 'bad');
    list.insertAdjacentHTML('afterbegin', `<div class="biz-card"><h2>Could not load your businesses</h2><p class="tag">${esc(oops(e))}</p></div>`);
  } finally { list.setAttribute('aria-busy', 'false'); }
}

$('#signout').onclick = async () => { await signOut(); location.href = '/'; };
$('#delete-account').onclick = async () => {
  if (!await confirm('This removes your CommandAGI account and every business it holds, with its records, files and sites. It cannot be undone.', { title: 'Delete my account', ok: 'Delete everything', danger: true })) return;
  try { await eraseAccount(); toast('Your account was deleted.'); location.href = '/'; }
  catch (e) {
    if (!e?.needsPassword) { toast(oops(e), 'bad'); return; }
    // The erase stopped part way and ended this session (lib/api.js eraseAccount): the password finishes it.
    const password = await prompt('Deleting stopped part way, and your session ended with it. Enter your password to finish.', { title: 'Finish deleting', ok: 'Finish deleting', type: 'password' });
    if (!password) return;
    try { await eraseAccount({ email: $('#account-email').textContent, password }); toast('Your account was deleted.'); location.href = '/'; }
    catch (e2) { toast(oops(e2), 'bad'); }
  }
};
if (signedInHere) load();
