// Chat: the conversation with the co-founder (the thread's transcript), approval cards (the business's needs-approval
// tasks), milestones, the daily briefing, and the right panel of what is being built.
import { threads } from '/lib/api.js';
import { wakeCofounder } from '/lib/business.js';
import { $, $$, esc, icon, toast, initial, time, ago, oops, busy } from '/lib/ui.js';
import { md } from '/lib/md.js';
import { widget, toolUi, stripAsk } from '/lib/widgets.js';
import { storefrontUrl } from '/lib/storefront.js';
import { bizTasks, isApproval, approve, reject, siteState, askLink } from './_shared.js';

// Questions a founder often has, one tap from the composer. A chip writes the question; the founder sends it.
const PROMPTS = ['What should I do today?', 'What needs my call?', 'Change the storefront', 'Draft a launch post', 'How are sales?'];

export async function render(ctx) {
  const { biz, founder, el, panel, actions } = ctx;
  // The chat shown is the thread the address names (`#tab=chat&thread=<id>`, the rail's chats), else the first one. Another
  // chat has the same co-founder, without the first one's welcome.
  const first = biz.cofounder ?? {};
  const asked = ctx.view;
  const cof = asked && asked !== first.threadId ? { ...first, threadId: asked, welcome: null } : first;
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

  // `messages` is the transcript (GET /threads/:id/chat, and lines the socket brought since); `live` holds the
  // co-founder's words while the model writes them (the socket's message.delta), one bubble per step.
  let messages = [], approvalsList = [], lastAgentAt = 0, alive = true, timer = null;
  const live = new Map();
  // A widget's state on this page (lib/widgets.js): `sending`, `error`, a multiselect's `picked`. The server's
  // message.update is what locks it; `waiters` resolve when that update comes.
  const asks = new Map();
  const waiters = new Map();
  // The agent loop's own asks (its `confirm` approval barrier, a runtime's prompt): the socket's {t:"prompt"} while
  // the co-founder waits, answered with prompt.respond and closed by prompt.resolved. The platform keeps them in no
  // transcript, so they show only while this page is open.
  const waits = new Map();
  const promptUi = p => ({ kind: 'select', prompt: p.question, options: (p.options?.length ? p.options : ['approve', 'deny']).map(o => ({ value: String(o), label: o === 'approve' ? 'Approve' : o === 'deny' ? 'Deny' : String(o) })), ...(p.answer != null ? { answered: true, answer: p.answer } : {}) });
  let socket = null, socketOpen = false, retries = 0;
  // The co-founder is typing while the socket says it works, or while the founder's last line has no answer yet.
  let working = false, typingUntil = Date.now() + 120000;
  // An empty first chat waits for the opening turn only while the business is new; a chat opened later (a moved
  // business's main chat) is simply empty until the founder writes.
  const unanswered = () => { const last = messages.filter(m => (m.role === 'user' || m.role === 'agent') && m.text?.trim()).at(-1); return !!cof.threadId && (last ? last.role === 'user' : cof === first && Date.now() - (biz.createdAt ?? 0) < 15 * 60e3); };
  const isOpening = m => String(m.id ?? '').startsWith('opening:') || /Introduce yourself in three short lines|First say hello in two or three short lines|Your welcome message is above this one/.test(m.text ?? '');
  // The welcome (lib/business.js welcomeFor) is the thread's first line, kept by the platform at creation. The record
  // holds its words, so it shows before the transcript is read; the transcript's line has the same id and replaces it.
  const welcome = cof.welcome;
  if (welcome?.kept && welcome.lineId && welcome.text) messages = [{ id: welcome.lineId, role: 'agent', text: welcome.text, at: welcome.at, template: welcome.template, senderName: cof.name }];
  // A template's line is typed out word by word the first time this browser shows it (30 to 60 ms a word), as if the
  // co-founder wrote it now; at once when the founder asks for reduced motion, or when it was shown before.
  const typed = typedLines();
  let typing = null;
  const typeOut = m => {
    if (typing || typed.has(m.id) || reducedMotion()) return;
    const words = m.text.match(/\s*\S+/g) ?? [m.text];
    typing = { id: m.id, words, shown: 1 };
    const step = () => {
      if (!alive || !typing) return;
      typing.shown++;
      const node = chat.querySelector(`[data-id="${CSS.escape(typing.id)}"] .text`);
      if (node) { const atBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 80; node.textContent = typing.words.slice(0, typing.shown).join(''); if (atBottom) chat.scrollTop = chat.scrollHeight; }
      if (typing.shown < typing.words.length) setTimeout(step, 30 + Math.random() * 30);
      else { rememberTyped(typed, typing.id); typing = null; paint(); }
    };
    setTimeout(step, 30);
  };
  const speaker = m => m.role === 'user' ? 'me' : m.role === 'agent' ? 'cofounder' : 'system';
  const paint = () => {
    // Decided before the lines are drawn, so the welcome is never drawn whole and then typed again.
    const scripted = messages.find(m => m.template && m.role === 'agent' && m.text);
    if (scripted) typeOut(scripted);
    const atBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 80;
    const open = approvalsList.filter(t => t.status === 'todo');
    const decided = approvalsList.filter(t => t.status !== 'todo');
    const parts = [];
    if (!cof.threadId) parts.push(`<div class="note warn" style="max-width:760px"><b>${esc(cof.name ?? 'Your co-founder')} is not awake.</b> ${esc(biz.gaps?.find(g => g.what === 'cofounder')?.why ?? 'The thread was not created.')} <button type="button" class="btn sm quiet" id="wake">Wake the co-founder</button></div>`);
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const who = speaker(m);
      if (m.tool) {
        // A chart the co-founder drew with `visualize`: the tool line carries it (lib/widgets.js toolUi).
        const pic = toolUi(m.tool);
        if (pic) { parts.push(`<div class="msg cofounder" data-id="${esc(m.id ?? '')}"><span class="avatar cofounder">${initial(cof.name)}</span><div class="body"><div class="who"><b>${esc(cof.name || 'Co-founder')}</b><span>${esc(time(m.at))}</span></div>${widget({ ...m, ui: pic })}</div></div>`); continue; }
        // A run of the same tool reads as one line: "used read_drive_file ×8 (2 failed)".
        let n = 1, failed = m.tool.ok === false ? 1 : 0;
        while (messages[i + 1]?.tool?.name === m.tool.name) { i++; n++; if (messages[i].tool.ok === false) failed++; }
        parts.push(`<div class="msg system"><div class="body"><div class="text">${esc(cof.name ?? 'Co-founder')} used ${esc(m.tool.name)}${n > 1 ? ` ×${n}` : ''}${failed ? ` (${n > 1 ? `${failed} failed` : 'it failed'})` : ''}</div></div></div>`);
        continue;
      }
      // A file the founder gave with no request names itself (the platform's line has no words).
      if (who === 'me' && !m.text?.trim() && m.ui?.kind === 'file' && m.ui.answer) {
        parts.push(`<div class="msg system" data-id="${esc(m.id ?? '')}"><div class="body"><div class="text">You uploaded ${esc(m.ui.answer)} · ${esc(time(m.at))}</div></div></div>`);
        continue;
      }
      if (!m.text?.trim() && !(who !== 'me' && m.ui)) continue;
      // The opening ask (lib/business.js openingFor: instructions to the agent and the business's address) reads as
      // one quiet line, not as the founder's words.
      if (who === 'me' && isOpening(m)) {
        parts.push(`<div class="msg system" data-id="${esc(m.id ?? '')}"><div class="body"><div class="text">You started ${esc(biz.name)} with ${esc(cof.name ?? 'your co-founder')} · ${esc(time(m.at))}</div></div></div>`);
        continue;
      }
      const writing = typing?.id === m.id;
      const shown = writing ? typing.words.slice(0, typing.shown).join('') : m.text;
      parts.push(`<div class="msg ${who}${writing ? ' streaming' : ''}" data-id="${esc(m.id ?? '')}"${writing ? ' aria-busy="true"' : ''}>${who === 'me' ? '' : `<span class="avatar ${who === 'cofounder' ? 'cofounder' : ''}">${who === 'cofounder' ? initial(cof.name) : '·'}</span>`}<div class="body"><div class="who"><b>${esc(who === 'me' ? (founder?.name || 'You') : who === 'cofounder' ? (m.senderName || cof.name || 'Co-founder') : 'System')}</b><span>${esc(time(m.at))}</span></div>${who === 'me' ? `<div class="text">${esc(shown)}</div>` : shown?.trim() ? `<div class="text md">${md(shown)}</div>` : ''}${who !== 'me' && m.ui && !writing ? widget(m, asks.get(m.id)) : ''}</div>${who === 'me' ? `<span class="avatar">${initial(founder?.name || founder?.email)}</span>` : ''}</div>`);
    }
    // The brand address the right panel shows (lib/storefront.js storefrontUrl), not the hosting one.
    const siteUrl = storefrontUrl(biz);
    if (biz.site?.lastDeploy?.at && siteUrl) parts.push(`<div class="milestone">${icon('rocket')}<div><b>Site deployed</b> · <a href="${esc(siteUrl)}" target="_blank" rel="noopener">${esc(siteUrl.replace(/^https?:\/\//, ''))}</a> <small class="muted">${esc(ago(biz.site.lastDeploy.at))}</small></div></div>`);
    for (const t of open) parts.push(approvalCard(t));
    if (decided.length) parts.push(`<p class="hint" style="margin-left:42px">${decided.length} decided ${decided.length === 1 ? 'card' : 'cards'} are in Tasks.</p>`);
    // A prompt the platform also keeps as a question (an agent's approval: a confirm whose requestId is the prompt's id)
    // is answered there, and it survives a reload; the live card would draw it twice.
    const approvals = new Set(messages.map(x => x.ui?.kind === 'confirm' ? x.ui.requestId : null).filter(Boolean));
    for (const p of waits.values()) if (!approvals.has(p.id)) parts.push(`<div class="msg cofounder" data-prompt-id="${esc(p.id)}"><span class="avatar cofounder">${initial(cof.name)}</span><div class="body"><div class="who"><b>${esc(cof.name || 'Co-founder')}</b><span>${esc(time(p.at))}</span></div>${widget({ id: `prompt:${p.id}`, ui: promptUi(p) }, asks.get(`prompt:${p.id}`))}</div></div>`);
    for (const b of live.values()) parts.push(liveBubble(b));
    if ((working || unanswered()) && !live.size && !typing && Date.now() < typingUntil) parts.push(`<div class="msg system composing typing" role="status"><div class="body"><div class="text">${esc(cof.name ?? 'Your co-founder')} is typing</div></div></div>`);
    // A paint draws the chat again: what the founder typed into a widget, and the focus, stay.
    const kept = $$('.ask input:not([type="file"])', chat).filter(i => i.id).map(i => [i.id, i.value]);
    const focused = chat.contains(document.activeElement) ? document.activeElement : null;
    const focusAt = focused?.id || (focused?.closest('[data-widget]') ? { ask: focused.closest('[data-widget]').dataset.widget, value: focused.dataset.value } : null);
    chat.innerHTML = parts.join('');
    for (const [id, value] of kept) { const i = chat.querySelector(`#${CSS.escape(id)}`); if (i && !i.closest('.ask.answered')) { i.value = value; const o = i.closest('.ask-range')?.querySelector('output'); if (o) o.textContent = value; } }
    if (typeof focusAt === 'string') chat.querySelector(`#${CSS.escape(focusAt)}`)?.focus({ preventScroll: true });
    else if (focusAt) { const box = chat.querySelector(`[data-widget="${CSS.escape(focusAt.ask)}"]`); (box?.querySelector(focusAt.value != null ? `[data-value="${CSS.escape(focusAt.value)}"]:not([disabled])` : 'button:not([disabled])') ?? box?.querySelector('button:not([disabled]), input:not([disabled])') ?? box)?.focus?.({ preventScroll: true }); }
    const needs = $('#building [data-needs] b'); if (needs) needs.textContent = `${open.length} need${open.length === 1 ? 's' : ''} you`;
    $$('.approval [data-approve]', chat).forEach(b => b.onclick = () => decide(b.closest('.approval').dataset.id, true, b));
    $$('.approval [data-reject]', chat).forEach(b => b.onclick = () => decide(b.closest('.approval').dataset.id, false, b));
    $$('.approval [data-reasoning]', chat).forEach(b => b.onclick = () => { const r = $('.reasoning', b.closest('.approval')); r.hidden = !r.hidden; b.textContent = r.hidden ? 'Show reasoning' : 'Hide reasoning'; });
    $('#wake', chat)?.addEventListener('click', e => busy(e.currentTarget, async () => { try { const b = await wakeCofounder(biz); ctx.setBiz(b); cof.threadId = b.cofounder.threadId; cof.agentId = b.cofounder.agentId; toast(`${cof.name} is awake.`, 'ok'); await load(); } catch (err) { toast(oops(err), 'bad'); } }));
    if (atBottom) chat.scrollTop = chat.scrollHeight;
  };
  const liveBubble = b => `<div class="msg cofounder streaming" data-live="${esc(b.id)}" aria-live="polite"><span class="avatar cofounder">${initial(cof.name)}</span><div class="body"><div class="who"><b>${esc(cof.name || 'Co-founder')}</b><span>${esc(time(b.at))}</span></div><div class="text md">${md(stripAsk(b.text))}</div></div></div>`;
  const approvalCard = t => `<div class="approval" data-id="${esc(t.id)}"><div class="row"><span class="badge accent">Needs your call</span><small class="muted">${esc(ago(t.createdAt ?? Date.now()))}</small></div><b>${esc(t.title)}</b>${t.readme || t.body ? `<div class="reasoning md" hidden>${md(t.body ?? t.readme ?? '')}</div>` : ''}<div class="acts"><button type="button" class="btn sm primary" data-approve>Approve</button><button type="button" class="btn sm quiet" data-reject>Reject</button>${t.body || t.readme ? '<button type="button" class="btn sm ghost" data-reasoning>Show reasoning</button>' : ''}</div></div>`;
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
        // Lines the socket brought that this read does not have yet stay; the founder's own line waits for its echo.
        const ids = new Set(got.map(m => m.id));
        const newest = Math.max(0, ...got.map(m => m.at ?? 0));
        const said = new Set(got.map(m => `${m.role}\n${m.text}`));
        messages = [...got, ...messages.filter(m => !ids.has(m.id) && (m.at ?? 0) >= newest && !said.has(`${m.role}\n${m.text}`))];
        lastAgentAt = Math.max(lastAgentAt, ...got.filter(m => m.role === 'agent' && m.text).map(m => m.at ?? 0));
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
    typingUntil = Date.now() + 120000; paint();
    try { await threads.send(cof.threadId, text); if (!socketOpen) setTimeout(load, 1500); ctx.chatsChanged?.(); setTimeout(() => alive && ctx.chatsChanged?.(), 25000); }
    catch (err) { messages = messages.filter(m => m.text !== text || !String(m.id).startsWith('local-')); toast(oops(err), 'bad'); paint(); }
  };

  // A widget's answer: over the thread's socket (`widget.respond`, which locks the widget, posts the answer as the
  // founder's line and wakes the co-founder), confirmed by the server's message.update. When the socket is not open or
  // no update comes, the transcript is read once (an answer that landed is never sent twice), then the question's
  // answer route takes it. The controls stay off while it is on its way; a failure says so and turns them on again.
  // The thread the chat shows: the widget code reads it here, never the co-founder's first thread by name.
  const threadOf = () => cof.threadId;
  const lockedNow = id => id.startsWith('prompt:') ? waits.get(id.slice(7))?.answer != null : !!messages.find(x => x.id === id)?.ui?.answered;
  const waitLocked = (id, ms) => new Promise(resolve => {
    const done = v => { clearTimeout(t); waiters.delete(id); resolve(v); };
    const t = setTimeout(() => done(lockedNow(id)), ms);
    waiters.set(id, done);
  });
  const settle = async (id, work) => {
    if (asks.get(id)?.sending) return;
    asks.set(id, { ...asks.get(id), sending: true, error: null }); paint();
    try {
      await work();
      asks.delete(id); typingUntil = Date.now() + 120000; paint();
    } catch (err) { if (!alive) return; asks.set(id, { ...asks.get(id), sending: false, error: oops(err) }); paint(); }
  };
  const respond = (id, raw) => {
    if (id.startsWith('prompt:')) return answerPrompt(id.slice(7), raw);
    const m = messages.find(x => x.id === id);
    const value = String(raw ?? '').trim();
    if (!m?.ui || m.ui.answered || !value || !threadOf()) return;
    return settle(id, async () => {
      if (socket && socketOpen && socket.readyState === 1) {
        socket.send(JSON.stringify({ t: 'widget.respond', id, value }));
        if (await waitLocked(id, 8000)) return;
      }
      await load();
      if (lockedNow(id)) return;
      if (!m.question) throw Error(`The answer did not reach ${cof.name ?? 'your co-founder'}.`);
      await threads.answer(threadOf(), m.question, value);
      await load();
      // The route took the answer; the transcript may show it a moment later.
      if (!lockedNow(id)) { const x = messages.find(y => y.id === id); if (x?.ui) x.ui = { ...x.ui, answered: true, answer: value }; }
    });
  };
  const answerPrompt = (pid, value) => {
    const p = waits.get(pid);
    if (!p || p.answer != null) return;
    return settle(`prompt:${pid}`, async () => {
      if (!(socket && socketOpen && socket.readyState === 1)) throw Error('The connection to the co-founder is closed. Refresh the page.');
      socket.send(JSON.stringify({ t: 'prompt.respond', id: pid, value: String(value) }));
      if (!(await waitLocked(`prompt:${pid}`, 8000))) throw Error(`The answer did not reach ${cof.name ?? 'your co-founder'}.`);
    });
  };
  const upload = (id, files) => {
    const m = messages.find(x => x.id === id);
    if (!m?.ui || m.ui.answered || !files.length || !threadOf()) return;
    return settle(id, async () => {
      for (const f of (m.ui.multiple ? files : files.slice(0, 1))) await threads.upload(threadOf(), f, m.ui.requestId);
      if (await waitLocked(id, socketOpen ? 6000 : 0)) return;
      await load();
      if (!lockedNow(id)) { const x = messages.find(y => y.id === id); if (x?.ui) x.ui = { ...x.ui, answered: true, answer: files.map(f => f.name).join(', ') }; }
    });
  };
  chat.addEventListener('click', e => {
    const box = e.target.closest('[data-widget]'); if (!box) return;
    const id = box.dataset.widget;
    const send = e.target.closest('[data-ask-send]');
    if (send && !send.disabled) return respond(id, send.dataset.value);
    const toggle = e.target.closest('[data-ask-toggle]');
    if (toggle && !toggle.disabled) {
      const st = asks.get(id) ?? {};
      const picked = new Set(st.picked ?? []);
      if (picked.has(toggle.dataset.value)) picked.delete(toggle.dataset.value); else picked.add(toggle.dataset.value);
      asks.set(id, { ...st, picked: [...picked], error: null }); paint();
      return;
    }
    const submit = e.target.closest('[data-ask-submit]');
    if (submit && !submit.disabled) {
      const m = messages.find(x => x.id === id);
      const picked = asks.get(id)?.picked ?? [];
      // In the options' order, as the founder read them.
      const order = (m?.ui?.options ?? []).map(o => String(o.value ?? o.label));
      respond(id, [...picked].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join(', '));
    }
  });
  chat.addEventListener('submit', e => {
    const form = e.target.closest('[data-ask-form]'); if (!form) return;
    e.preventDefault();
    respond(form.closest('[data-widget]').dataset.widget, form.elements.value?.value);
  });
  chat.addEventListener('input', e => {
    if (e.target.type !== 'range') return;
    const o = e.target.closest('.ask-range')?.querySelector('output'); if (o) o.textContent = e.target.value;
  });
  chat.addEventListener('change', e => {
    if (!e.target.matches('[data-ask-file]')) return;
    upload(e.target.closest('[data-widget]').dataset.widget, [...e.target.files]);
  });

  // The thread's socket: the co-founder's words as the model writes them, its lines as they land, and whether it is
  // working. Without a socket (refused, closed five times) the chat reads the transcript every 4 s instead.
  const onLive = m => {
    if (m.t === 'message.delta' && m.text) {
      live.set(m.id, { id: m.id, text: m.text, at: live.get(m.id)?.at ?? Date.now() });
      const el = chat.querySelector(`[data-live="${CSS.escape(m.id)}"] .text`);
      if (el) { const atBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 80; el.innerHTML = md(stripAsk(m.text)); if (atBottom) chat.scrollTop = chat.scrollHeight; }
      else paint();
    } else if (m.t === 'message.update' && m.id) {
      // A widget answered (here, in another tab, or by the answer route): the server's state locks it.
      const at = messages.findIndex(x => x.id === m.id);
      if (at >= 0) messages[at] = { ...messages[at], ...(m.text != null ? { text: m.text } : {}), ...(m.ui ? { ui: m.ui } : {}) };
      if (m.ui?.answered) { asks.delete(m.id); waiters.get(m.id)?.(true); }
      paint();
    } else if (m.t === 'prompt' && m.id && m.question) {
      waits.set(m.id, { id: m.id, kind: m.kind, question: m.question, options: m.options, at: Date.now() });
      paint();
    } else if (m.t === 'prompt.resolved' && m.id) {
      const p = waits.get(m.id);
      if (p) { p.answer = String(m.value ?? ''); asks.delete(`prompt:${m.id}`); waiters.get(`prompt:${m.id}`)?.(true); paint(); }
    } else if (m.t === 'message.delete') {
      // The step ended; its own message follows in a moment and takes the bubble's place.
      setTimeout(() => { if (live.delete(m.id)) paint(); }, 3000);
    } else if (m.t === 'message' && m.role === 'system') {
      // A tool line reads as "used …" from the transcript, which names the tool.
      reload();
    } else if (m.t === 'message' && m.id && m.text != null) {
      if (!messages.some(x => x.id === m.id || (x.role === m.role && x.text === m.text && Math.abs((x.at ?? 0) - (m.at ?? 0)) < 5000))) {
        if (m.role === 'user') messages = messages.filter(x => !(String(x.id).startsWith('local-') && x.text === m.text));
        messages.push(m);
      }
      if (m.role === 'agent') { live.clear(); lastAgentAt = Math.max(lastAgentAt, m.at ?? 0); }
      paint();
    } else if (m.t === 'agent.status' || m.t === 'state') {
      const was = working;
      working = m.t === 'state' ? m.state?.execState === 'active' : m.state !== 'idle';
      if (working) typingUntil = Date.now() + 120000;
      else if (was) reload();
      if (working !== was) paint();
    }
  };
  // Tool lines and approval cards come from the transcript and the tasks: one read shortly after the socket says so.
  let reloadTimer = null;
  const reload = () => { clearTimeout(reloadTimer); reloadTimer = setTimeout(load, 600); };
  const connect = async () => {
    if (!alive || !cof.threadId || typeof WebSocket === 'undefined') return;
    const url = await threads.socketUrl(cof.threadId).catch(() => null);
    if (!url || !alive) return;
    const ws = new WebSocket(url);
    socket = ws;
    ws.onopen = () => { socketOpen = true; retries = 0; };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } if (alive) onLive(m); };
    ws.onclose = () => { socketOpen = false; socket = null; if (alive && retries < 5) setTimeout(connect, 1000 * 2 ** retries++); };
  };
  const poll = () => { if (!alive) return; timer = setTimeout(async () => { await load(); poll(); }, socketOpen ? 15000 : 4000); };

  $('#chat-refresh').onclick = load;
  if (messages.length) paint();
  connect();
  await load();
  poll();
  renderPanel(ctx, panel, approvalsList).catch(() => null);
  return () => { alive = false; clearTimeout(timer); clearTimeout(reloadTimer); try { socket?.close(); } catch { /* closed */ } };
}

/** The template lines this browser has typed out already (ids), so a reload shows them whole. */
const TYPED_KEY = 'vs_typed';
function typedLines() {
  try { return new Set(JSON.parse(localStorage.getItem(TYPED_KEY) ?? '[]')); } catch { return new Set(); }
}
function rememberTyped(set, id) {
  set.add(id);
  try { localStorage.setItem(TYPED_KEY, JSON.stringify([...set].slice(-50))); } catch { /* storage off: it types again next time */ }
}
const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

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
