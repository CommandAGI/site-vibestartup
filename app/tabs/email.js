// Email: the business's address (a CommandAGI mailbox), its folders and threads, reply, hand to the co-founder, compose.
import { email, threads, orgs } from '/lib/api.js';
import { writeBusiness } from '/lib/business.js';
import { $, $$, esc, icon, toast, modal, ago, when, oops, busy, slugify, soon, soonButton } from '/lib/ui.js';
import { head, section, empty, iconBtn, bars } from './_shared.js';

const FOLDERS = [['all', 'All'], ['inbox', 'Inbox'], ['unread', 'Unread'], ['sent', 'Sent'], ['drafts', 'Drafts']];

export async function render(ctx) {
  const { biz, el, actions } = ctx;
  // A folder's view (`#tab=email&view=inbox|unread|sent|drafts`, app/levels.js) opens on it; the tab's own buttons still
  // move between them.
  const state = { folder: FOLDERS.some(([id]) => id === ctx.view) ? ctx.view : 'all', list: [], open: null, q: '' };
  const hp = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (hp.get('thread')) state.open = hp.get('thread');
  actions.innerHTML = `${iconBtn('edit', 'Compose', 'id="mail-compose"')}${iconBtn('refresh', 'Refresh', 'id="mail-refresh"')}`;

  if (!biz.email?.id) {
    el.innerHTML = head('Email', 'A business address of your own, where customers and the co-founder write.') + empty('No business address yet', esc(biz.gaps?.find(g => g.what === 'email')?.why ?? 'The address was not claimed.'), `<form id="claim" class="row"><label class="field"><span class="sr-only">Address</span><input name="local" value="${esc(slugify(biz.name))}" placeholder="name"></label><span class="muted">@${esc(window.BRAND?.mailDomain ?? 'commandagi.email')}</span><button class="btn primary" type="submit">Claim an address</button></form>`);
    $('#claim', el).onsubmit = async e => {
      e.preventDefault(); const local = e.target.local.value.trim().toLowerCase();
      try { const addr = await orgs.claimAddress(biz.org, local, `${biz.name} (VibeStartup)`); biz.email = { id: addr.id, address: addr.address ?? `${local}@${window.BRAND?.mailDomain ?? 'commandagi.email'}` }; biz.gaps = (biz.gaps ?? []).filter(g => g.what !== 'email'); await writeBusiness(biz); ctx.setBiz(biz); toast(`${biz.email.address} is yours.`, 'ok'); ctx.refresh(); }
      catch (err) { toast(oops(err), 'bad'); }
    };
    return;
  }

  // The mailbox is fetched by load(); a folder or a search only draws again from what was fetched, so the highlight moves
  // at the click and the search box keeps its focus and cursor while the list follows it.
  let r = { threads: [] };
  const load = async () => { r = await email.threads(biz.email.id, { limit: 100 }).catch(e => ({ threads: [], error: e })); state.list = r.threads ?? []; };
  const draw = (listOnly = false) => {
    const unread = t => t.unread || t.unreadCount > 0 || t.isUnread;
    const inFolder = t => state.folder === 'all' ? true : state.folder === 'unread' ? unread(t) : state.folder === 'sent' ? (t.folder === 'sent' || t.direction === 'outbound' || t.lastDirection === 'outbound') : state.folder === 'drafts' ? t.folder === 'drafts' : !(t.folder === 'sent' || t.direction === 'outbound') && !t.archived;
    const shown = state.list.filter(inFolder).filter(t => !state.q || `${t.subject ?? ''} ${t.from ?? ''} ${t.snippet ?? ''}`.toLowerCase().includes(state.q.toLowerCase()));
    const listHtml = shown.length ? shown.map(t => `<div class="thread ${unread(t) ? 'unread' : ''}" data-tid="${esc(t.id)}"><b>${esc(t.subject || '(no subject)')}</b><div class="meta">${esc(t.from ?? t.participants?.join(', ') ?? '')} · ${esc(ago(t.lastAt ?? t.updatedAt ?? t.at ?? Date.now()))}</div><div class="small muted">${esc((t.snippet ?? '').slice(0, 120))}</div></div>`).join('') : `<div class="empty"><h3>Nothing here</h3><p>${r.error ? esc(oops(r.error)) : `No mail in ${state.folder}.`}</p></div>`;
    const bindThreads = () => $$('.thread', el).forEach(t => t.onclick = () => openThread(t.dataset.tid));
    if (listOnly) { $('#mail-list', el).innerHTML = listHtml; bindThreads(); return; }
    el.innerHTML = head('Email', '', `<p class="muted" id="mail-address">${esc(biz.email.address)}${iconBtn('copy', 'Copy address', 'data-copy-address')}</p>`)
      + `<div class="mail-layout"><div class="mail-folders" id="mail-folders">${FOLDERS.map(([id, l]) => `<button type="button" data-folder="${id}" aria-pressed="${state.folder === id}">${l}</button>`).join('')}<label class="field" style="margin-top:12px"><span class="sr-only">Search</span><input id="mail-search" placeholder="Search" value="${esc(state.q)}"></label></div>
        <div id="mail-list">${listHtml}</div>
        <div id="mail-thread"><div class="empty"><p>Open a thread to read it.</p></div></div></div>`;
    $$('[data-folder]', el).forEach(b => b.onclick = () => { state.folder = b.dataset.folder; draw(); });
    $('#mail-search', el).oninput = e => { state.q = e.target.value; draw(true); };
    $('[data-copy-address]', el).onclick = () => navigator.clipboard?.writeText(biz.email.address).then(() => toast('Address copied', 'ok'));
    bindThreads();
    if (state.open) openThread(state.open);
  };
  const paint = async () => { await load(); draw(); };
  const openThread = async tid => {
    state.open = tid;
    const box = $('#mail-thread', el);
    box.innerHTML = bars(1);
    try {
      const r = await email.thread(biz.email.id, tid);
      email.read(biz.email.id, tid).catch(() => null);
      const msgs = r.messages ?? r.thread?.messages ?? [];
      box.innerHTML = `<div class="row"><h3 class="grow">${esc(r.thread?.subject ?? r.subject ?? '(no subject)')}</h3>${iconBtn('chat', 'Hand to the co-founder', 'id="mail-hand"')}</div>
        ${msgs.map(m => `<div class="mail-msg"><div class="meta">${esc(m.from ?? m.sender ?? '')} · ${esc(when(m.at ?? m.date ?? Date.now()))}</div>${esc(m.text ?? m.body ?? m.snippet ?? '')}</div>`).join('') || '<p class="muted">No messages.</p>'}
        <form id="mail-reply" class="stack" style="margin-top:12px"><label class="field"><span>Reply</span><textarea name="text" required placeholder="Write a reply…"></textarea></label><div class="row"><button class="btn primary" type="submit">Send reply</button></div></form>`;
      $('#mail-reply', box).onsubmit = async e => { e.preventDefault(); const b = e.target.querySelector('button'); await busy(b, async () => { try { await email.reply(biz.email.id, tid, { text: e.target.text.value }); toast('Reply sent.', 'ok'); openThread(tid); } catch (err) { toast(oops(err), 'bad'); } }); };
      $('#mail-hand', box).onclick = async () => { if (!biz.cofounder?.threadId) return toast('Wake the co-founder first.', 'bad'); const gist = `A mail arrived at ${biz.email.address}: "${r.thread?.subject ?? r.subject ?? ''}" from ${msgs[0]?.from ?? 'someone'}. ${(msgs.at(-1)?.text ?? msgs.at(-1)?.snippet ?? '').slice(0, 600)}\n\nDraft a reply for my approval.`; await threads.send(biz.cofounder.threadId, gist).catch(err => toast(oops(err), 'bad')); toast('Handed to your co-founder.', 'ok'); ctx.openTab('chat'); };
    } catch (e) { box.innerHTML = `<div class="empty"><p>${esc(oops(e))}</p></div>`; }
  };
  $('#mail-compose').onclick = () => {
    const m = modal(`<h2>New mail</h2><p class="hint">From ${esc(biz.email.address)}</p><form id="cf" class="stack"><label class="field"><span>To</span><input name="to" type="email" required></label><label class="field"><span>Subject</span><input name="subject" required></label><label class="field"><span>Message</span><textarea name="text" required rows="6"></textarea></label><div class="modal-actions"><button type="button" class="btn quiet" id="cf-cancel">Cancel</button><button class="btn primary" type="submit">Send</button></div></form>`, { label: 'New mail' });
    $('#cf-cancel', m.el).onclick = () => m.close();
    $('#cf', m.el).onsubmit = async e => { e.preventDefault(); const f = e.target; try { await email.compose(biz.email.id, { to: f.to.value.trim(), subject: f.subject.value.trim(), text: f.text.value }); m.close(); toast('Sent.', 'ok'); paint(); } catch (err) { toast(oops(err), 'bad'); } };
  };
  $('#mail-refresh').onclick = paint;
  await paint();
}
