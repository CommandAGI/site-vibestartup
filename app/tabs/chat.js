// Chat: the conversation with the co-founder (the thread's transcript), approval cards (the business's needs-approval
// tasks), milestones, the daily briefing, and the right panel of what is being built.
import { threads, drive } from '/lib/api.js';
import { wakeCofounder, writeBusiness, folderOf } from '/lib/business.js';
import { $, $$, esc, icon, toast, initial, time, ago, oops, busy } from '/lib/ui.js';
import { bizTasks, isApproval, approve, reject, siteState, askLink } from './_shared.js';

// Questions a founder often has, one tap from the composer. A chip writes the question; the founder sends it.
const PROMPTS = ['What should I do today?', 'What needs my call?', 'Change the storefront', 'Draft a launch post', 'How are sales?'];

export async function render(ctx) {
  const { biz, founder, el, panel, actions } = ctx;
  const cof = biz.cofounder ?? {};
  el.innerHTML = `<div class="chat-wrap"><div class="chat" id="chat" aria-label="Conversation"><div class="skeleton" role="status" aria-label="Loading the conversation" style="max-width:520px"><i class="short"></i><i></i><i class="short"></i></div></div>
    <div class="composer"><div class="prompts" id="prompts" aria-label="Suggested questions">${PROMPTS.map(p => `<button type="button" class="chip" data-prompt>${esc(p)}</button>`).join('')}</div><form id="compose-form"><label class="sr-only" for="composer">Message ${esc(cof.name ?? 'your co-founder')}</label><textarea id="composer" rows="1" placeholder="Message ${esc(cof.name ?? 'your co-founder')}…"></textarea><button type="submit" class="btn icon send" id="send" aria-label="Send" data-tip="Send">${icon('send')}</button></form><p class="hint">${esc(cof.name ?? 'Your co-founder')} is an AI agent. Big decisions come to you as approval cards.</p></div></div>`;
  actions.innerHTML = `<button type="button" class="btn icon" id="chat-refresh" aria-label="Refresh" data-tip="Refresh">${icon('refresh')}</button>`;
  const chat = $('#chat', el);
  const composer = $('#composer', el);
  try { const q = sessionStorage.getItem('vs_ask'); if (q) { composer.value = q; sessionStorage.removeItem('vs_ask'); composer.focus(); } } catch { /* storage off */ }
  const prompts = $('#prompts', el);
  const fit = () => { composer.style.height = 'auto'; composer.style.height = `${Math.min(160, composer.scrollHeight)}px`; prompts.hidden = !!composer.value.trim(); };
  composer.addEventListener('input', fit);
  prompts.addEventListener('click', e => { const b = e.target.closest('[data-prompt]'); if (!b) return; composer.value = b.textContent; fit(); composer.focus(); });
  fit();
  composer.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#compose-form', el).requestSubmit(); } });

  let messages = [], approvalsList = [], composing = false, lastAgentAt = 0, alive = true, timer = null;
  const speaker = m => m.role === 'user' ? 'me' : m.role === 'agent' ? 'cofounder' : 'system';
  const paint = () => {
    const atBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 80;
    const open = approvalsList.filter(t => t.status === 'todo');
    const decided = approvalsList.filter(t => t.status !== 'todo');
    const parts = [];
    if (!cof.threadId) parts.push(`<div class="note warn" style="max-width:760px"><b>${esc(cof.name ?? 'Your co-founder')} is not awake.</b> ${esc(biz.gaps?.find(g => g.what === 'cofounder')?.why ?? 'The thread was not created.')} <button type="button" class="btn sm quiet" id="wake">Wake the co-founder</button></div>`);
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const who = speaker(m);
      if (m.tool) {
        // A run of the same tool reads as one line: "used read_drive_file ×8 (2 failed)".
        let n = 1, failed = m.tool.ok === false ? 1 : 0;
        while (messages[i + 1]?.tool?.name === m.tool.name) { i++; n++; if (messages[i].tool.ok === false) failed++; }
        parts.push(`<div class="msg system"><div class="body"><div class="text">${esc(cof.name ?? 'Co-founder')} used ${esc(m.tool.name)}${n > 1 ? ` ×${n}` : ''}${failed ? ` (${n > 1 ? `${failed} failed` : 'it failed'})` : ''}</div></div></div>`);
        continue;
      }
      if (!m.text?.trim()) continue;
      // The opening ask (lib/business.js openingFor: instructions to the agent and the business's address) reads as
      // one quiet line, not as the founder's words.
      if (who === 'me' && /Introduce yourself in three short lines/.test(m.text)) {
        parts.push(`<div class="msg system" data-id="${esc(m.id ?? '')}"><div class="body"><div class="text">You started ${esc(biz.name)} with ${esc(cof.name ?? 'your co-founder')} · ${esc(time(m.at))}</div></div></div>`);
        continue;
      }
      parts.push(`<div class="msg ${who}" data-id="${esc(m.id ?? '')}">${who === 'me' ? '' : `<span class="avatar ${who === 'cofounder' ? 'cofounder' : ''}">${who === 'cofounder' ? initial(cof.name) : '·'}</span>`}<div class="body"><div class="who"><b>${esc(who === 'me' ? (founder?.name || 'You') : who === 'cofounder' ? (m.senderName || cof.name || 'Co-founder') : 'System')}</b><span>${esc(time(m.at))}</span></div><div class="text">${esc(m.text)}</div></div>${who === 'me' ? `<span class="avatar">${initial(founder?.name || founder?.email)}</span>` : ''}</div>`);
    }
    if (biz.site?.lastDeploy?.at) parts.push(`<div class="milestone">${icon('rocket')}<div><b>Site deployed</b> · <a href="${esc(biz.site.url)}" target="_blank" rel="noopener">${esc(biz.site.url)}</a> <small class="muted">${esc(ago(biz.site.lastDeploy.at))}</small></div></div>`);
    for (const t of open) parts.push(approvalCard(t));
    if (decided.length) parts.push(`<p class="hint" style="margin-left:42px">${decided.length} decided ${decided.length === 1 ? 'card' : 'cards'} are in Tasks.</p>`);
    if (composing) parts.push(`<div class="msg system composing"><div class="body"><div class="text">${esc(cof.name ?? 'Your co-founder')} is composing</div></div></div>`);
    if (!messages.length && cof.threadId) parts.push(`<div class="msg system"><div class="body"><div class="text">${esc(cof.name ?? 'Your co-founder')} is reading the files and will say hello in a moment.</div></div></div>`);
    chat.innerHTML = parts.join('');
    const needs = $('#building [data-needs] b'); if (needs) needs.textContent = `${open.length} need${open.length === 1 ? 's' : ''} you`;
    $$('.approval [data-approve]', chat).forEach(b => b.onclick = () => decide(b.closest('.approval').dataset.id, true, b));
    $$('.approval [data-reject]', chat).forEach(b => b.onclick = () => decide(b.closest('.approval').dataset.id, false, b));
    $$('.approval [data-reasoning]', chat).forEach(b => b.onclick = () => { const r = $('.reasoning', b.closest('.approval')); r.hidden = !r.hidden; b.textContent = r.hidden ? 'Show reasoning' : 'Hide reasoning'; });
    $('#wake', chat)?.addEventListener('click', e => busy(e.currentTarget, async () => { try { const b = await wakeCofounder(biz); ctx.setBiz(b); cof.threadId = b.cofounder.threadId; cof.agentId = b.cofounder.agentId; toast(`${cof.name} is awake.`, 'ok'); await load(); } catch (err) { toast(oops(err), 'bad'); } }));
    if (atBottom) chat.scrollTop = chat.scrollHeight;
  };
  const approvalCard = t => `<div class="approval" data-id="${esc(t.id)}"><div class="row"><span class="badge accent">Needs your call</span><small class="muted">${esc(ago(t.createdAt ?? Date.now()))}</small></div><b>${esc(t.title)}</b>${t.readme || t.body ? `<div class="reasoning" hidden>${esc(t.body ?? t.readme ?? '')}</div>` : ''}<div class="acts"><button type="button" class="btn sm primary" data-approve>Approve</button><button type="button" class="btn sm quiet" data-reject>Reject</button>${t.body || t.readme ? '<button type="button" class="btn sm ghost" data-reasoning>Show reasoning</button>' : ''}</div></div>`;
  const decide = async (id, yes, button) => {
    const t = approvalsList.find(x => x.id === id); if (!t) return;
    await busy(button, async () => {
      try { if (yes) await approve(biz, t); else await reject(biz, t); toast(yes ? 'Approved.' : 'Rejected.', 'ok'); await load(); ctx.refreshNeeds(); }
      catch (e) { toast(oops(e), 'bad'); }
    });
  };
  const load = async () => {
    if (!alive) return;
    if (cof.threadId) {
      const got = await threads.chat(cof.threadId, 100).catch(() => null);
      if (got) {
        messages = got;
        const agentLast = Math.max(0, ...got.filter(m => m.role === 'agent' && m.text).map(m => m.at ?? 0));
        if (agentLast > lastAgentAt) { composing = false; lastAgentAt = agentLast; }
      }
    }
    const all = await bizTasks(biz).catch(() => []);
    approvalsList = await Promise.all(all.filter(isApproval).map(async t => ({ ...t, body: t.body ?? t.readmeText ?? null })));
    paint();
  };
  $('#compose-form', el).onsubmit = async e => {
    e.preventDefault();
    const text = composer.value.trim(); if (!text) return;
    if (!cof.threadId) return toast('Wake the co-founder first.', 'bad');
    composer.value = ''; fit();
    messages.push({ role: 'user', text, at: Date.now(), id: `local-${Date.now()}` });
    composing = true; paint();
    try { await threads.send(cof.threadId, text); setTimeout(load, 1500); }
    catch (err) { composing = false; toast(oops(err), 'bad'); paint(); }
    setTimeout(() => { if (composing) { composing = false; paint(); } }, 90000);
  };
  $('#chat-refresh').onclick = load;
  await load();
  timer = setInterval(load, 4000);
  renderPanel(ctx, panel, approvalsList).catch(() => null);
  return () => { alive = false; clearInterval(timer); };
}

async function renderPanel(ctx, panel, approvalsList) {
  const { biz } = ctx;
  const b = biz.brand ?? {};
  panel.innerHTML = `<section><h3>Building</h3><div class="mini">
      <div class="card" data-site-state><b>Site</b><p class="meta">Checking…</p></div>
      <div class="card" data-brand><b>Brand kit</b><div class="swatches" style="margin-top:6px">${['primary', 'secondary', 'accent', 'ground', 'ink'].map(k => `<i style="background:${esc(b[k] ?? '#ccc')}" title="${k}"></i>`).join('')}</div><p class="meta">${esc(b.type ?? '')}</p><p class="meta">${esc(b.generated ? 'Generated ' + b.generated : '')}</p></div>
      <div class="card" data-needs><b>${approvalsList.filter(t => t.status === 'todo').length} need you</b><p class="meta"><a href="${esc(ctx.tabHref('tasks'))}">Tasks</a></p></div>
      <div class="card"><b>Blueprint</b><p class="meta">${esc(biz.blueprint?.title ?? biz.idea)}</p><p class="meta">${esc(biz.blueprint?.about ?? '')}</p></div>
    </div></section>
    <section><h3>Routines</h3><div class="mini" id="panel-routines"><p class="meta">Loading…</p></div></section>`;
  const st = await siteState(biz);
  const site = $('[data-site-state]', panel);
  site.innerHTML = st.gap ? `<b>Site</b><p class="meta">${esc(st.gap)}</p>` : `<b>Site ${st.live ? '<span class="badge ok">live</span>' : '<span class="badge warn">not live yet</span>'}</b><p class="meta"><a href="${esc(st.url)}" target="_blank" rel="noopener">${esc(st.url?.replace(/^https?:\/\//, '') ?? '')}</a></p>${biz.site?.lastDeploy?.at ? `<p class="meta">Deployed ${esc(ago(biz.site.lastDeploy.at))}</p>` : ''}`;
  const r = $('#panel-routines', panel);
  if (!biz.cofounder?.threadId) { r.innerHTML = '<p class="meta">No routines until the co-founder is awake.</p>'; return; }
  const list = await threads.triggers.list(biz.cofounder.threadId).catch(() => []);
  r.innerHTML = list.length ? list.map(t => `<div class="card"><b>${esc(t.label)}</b><p class="meta">${t.enabled ? 'on' : 'paused'}${t.lastFiredAt ? ` · last ran ${esc(ago(t.lastFiredAt))}` : ' · has not run yet'}</p></div>`).join('') : '<p class="meta">No routines yet.</p>';
}
