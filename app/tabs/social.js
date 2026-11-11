// Social: the accounts you connect through each platform's official login (CommandAGI's connectors) and the posts as
// a month calendar or a list. The founder publishes a post; automatic scheduled publishing and Reddit open soon.
import { integrations } from '/lib/api.js';
import { readBizJson, writeBizJson } from '/lib/business.js';
import { $, $$, esc, icon, toast, modal, when, oops, busy, soon, soonButton } from '/lib/ui.js';
import { head, section, empty, settingsOf, notifyChip, bindNotify } from './_shared.js';

const SOCIAL = /\b(x|twitter|instagram|facebook|tiktok|youtube|threads|pinterest|linkedin|bluesky|mastodon)\b/i;
const PLATFORMS = ['Instagram (professional)', 'Facebook Page', 'TikTok', 'X', 'YouTube', 'Threads', 'Pinterest', 'LinkedIn'];

export async function render(ctx) {
  const { biz, el } = ctx;
  const state = { view: 'calendar' };
  const paint = async () => {
    const [ints, posts, settings] = await Promise.all([integrations.list().catch(e => ({ integrations: [], error: e })), readBizJson(biz.slug, 'social/posts.json', { posts: [] }), settingsOf(biz).catch(() => ({}))]);
    const social = (ints.integrations ?? []).filter(i => SOCIAL.test(`${i.id} ${i.label} ${i.category}`) && !/reddit/i.test(`${i.id} ${i.label}`));
    // Reddit opens soon: its card is here, with the pill, whatever the connectors say.
    const reddit = `<div class="account card" data-id="reddit"><h4>Reddit ${soon()}</h4><p class="meta">Posts to your communities</p>${soonButton('Connect', 'btn sm quiet')}</div>`;
    el.innerHTML = head('Social', 'Plan your posts and connect your accounts through each platform\'s official login. Your password is never seen.')
      + section('Accounts', `<div id="social-accounts" class="grid-auto">${social.length ? social.map(i => `<div class="account card" data-id="${esc(i.id)}"><h4>${esc(i.label)}</h4><p class="meta">${i.connections?.length ? `${i.connections.length} connected` : i.configured ? 'Not connected' : 'Not available on this stack'}</p>${i.connections?.length ? '<span class="badge ok">connected</span>' : i.configured ? `<button type="button" class="btn sm quiet" data-connect>Connect</button>` : '<span class="badge">not available</span>'}</div>`).join('') + reddit : (ints.error ? `<div class="note">${esc(oops(ints.error))}</div>` : '') + reddit}</div>
        <div class="row" id="social-auto" style="margin-top:12px"><b>Automatic publishing</b>${soon()}<span class="muted grow">Your posts go out on schedule to ${esc(PLATFORMS.join(', '))}.</span>${notifyChip('social-auto', settings.notify?.['social-auto'])}</div>
        <p class="hint" style="margin-top:10px">Today your co-founder prepares the picture and the caption, and you post them.</p>`)
      + section('Posts', `<div class="subtabs" id="social-view"><button type="button" data-view="calendar" aria-pressed="${state.view === 'calendar'}">Calendar</button><button type="button" data-view="list" aria-pressed="${state.view === 'list'}">List</button></div><div id="posts">${state.view === 'calendar' ? calendar(posts.posts) : list(posts.posts)}</div>`, `<button type="button" class="btn sm primary" id="compose-post">${icon('plus', 14)} Compose</button>`);
    bindNotify(el, biz);
    $$('[data-view]', el).forEach(b => b.onclick = () => { state.view = b.dataset.view; paint(); });
    $$('[data-connect]', el).forEach(b => b.onclick = () => busy(b, async () => {
      const id = b.closest('.account').dataset.id;
      try { const r = await integrations.oauthStart(id, `${location.origin}/app/?b=${encodeURIComponent(biz.slug)}#tab=social`); if (r.url || r.authorizeUrl) location.href = r.url ?? r.authorizeUrl; else toast('The platform gave no sign-in link.', 'bad'); }
      catch (err) { b.closest('.account').insertAdjacentHTML('beforeend', `<p class="note warn">${esc(err.status === 409 ? 'Not available on this stack: the connector is not configured.' : oops(err))}</p>`); }
    }));
    $$('[data-post-by-hand]', el).forEach(b => b.onclick = async () => { const p = posts.posts.find(x => x.id === b.dataset.postByHand); p.status = 'posted by hand'; p.postedAt = Date.now(); await writeBizJson(biz.slug, 'social/posts.json', posts); toast('Marked as posted.', 'ok'); paint(); });
    $('#compose-post', el).onclick = () => {
      const m = modal(`<h2>Compose a post</h2><form id="pf" class="stack"><label class="field"><span>Caption</span><textarea name="caption" rows="4" required></textarea></label><div class="grid-2"><label class="field"><span>Platform</span><select name="platform">${PLATFORMS.map(p => `<option>${p}</option>`).join('')}<option>Personal profile</option></select></label><label class="field"><span>When</span><input name="at" type="datetime-local" value="${new Date(Date.now() + 3600000).toISOString().slice(0, 16)}"></label></div><p class="hint">It goes on your calendar, ready for you to post at that time.</p><div class="modal-actions"><button type="button" class="btn quiet" id="pf-cancel">Cancel</button><button class="btn primary" type="submit">Add to calendar</button></div></form>`, { label: 'Compose a post' });
      $('#pf-cancel', m.el).onclick = () => m.close();
      $('#pf', m.el).onsubmit = async e => { e.preventDefault(); const f = e.target; posts.posts.push({ id: `post-${Date.now().toString(36)}`, caption: f.caption.value.trim(), platform: f.platform.value, at: new Date(f.at.value).getTime() || Date.now(), status: 'waiting for you to post', createdAt: Date.now() }); try { await writeBizJson(biz.slug, 'social/posts.json', posts); m.close(); toast('Post added to your calendar.', 'ok'); paint(); } catch (err) { toast(oops(err), 'bad'); } };
    };
  };
  const list = posts => posts.length ? `<div class="list">${posts.slice().sort((a, b) => b.at - a.at).map(p => `<div class="post row"><div class="grow"><b>${esc(p.platform)}</b> · <span class="muted">${esc(when(p.at))}</span><div>${esc(p.caption)}</div><span class="badge ${p.status === 'posted by hand' || p.status === 'posted' ? 'ok' : ''}">${esc(p.status)}</span></div>${p.status.startsWith('waiting') ? `<button type="button" class="btn sm quiet" data-post-by-hand="${esc(p.id)}">I posted it</button>` : ''}</div>`).join('')}</div>` : empty('No posts yet', 'Compose one, or ask your co-founder for the launch posts.', '<button type="button" class="btn quiet" data-press="#compose-post">Compose a post</button>');
  const calendar = posts => {
    const now = new Date(); const y = now.getFullYear(), mo = now.getMonth();
    const first = new Date(y, mo, 1).getDay(); const days = new Date(y, mo + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push('<div class="day pad"></div>');
    for (let d = 1; d <= days; d++) { const dayPosts = posts.filter(p => { const t = new Date(p.at); return t.getFullYear() === y && t.getMonth() === mo && t.getDate() === d; }); cells.push(`<div class="day"><b>${d}</b>${dayPosts.map(p => `<span class="post" title="${esc(p.caption)}">${esc(p.platform)}: ${esc(p.caption.slice(0, 24))}</span>`).join('')}</div>`); }
    return `<p class="muted small" style="margin-bottom:6px">${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p><div class="calendar">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<div class="hint" style="text-align:center">${d}</div>`).join('')}${cells.join('')}</div>`;
  };
  await paint();
}
