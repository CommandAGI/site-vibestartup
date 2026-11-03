// Tasks: approvals, in progress, done, and the routines (the thread's triggers).
import { threads, tasks } from '/lib/api.js';
import { folderOf } from '/lib/business.js';
import { $, $$, esc, icon, toast, modal, confirm, ago, when, oops, busy } from '/lib/ui.js';
import { head, section, bizTasks, isApproval, approve, reject, everyWords, INTERVALS, iconBtn, empty } from './_shared.js';

export async function render(ctx) {
  const { biz, el, actions } = ctx;
  actions.innerHTML = `<button type="button" class="btn icon" id="new-task" aria-label="New task" data-tip="New task">${icon('plus')}</button>`;
  const paint = async () => {
    const all = await bizTasks(biz);
    const approvals = all.filter(t => isApproval(t) && t.status === 'todo');
    const doing = all.filter(t => t.status === 'doing' || (t.status === 'todo' && !isApproval(t)) || t.status === 'blocked');
    const done = all.filter(t => t.status === 'done' || t.status === 'cancelled').sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
    const routines = biz.cofounder?.threadId ? await threads.triggers.list(biz.cofounder.threadId).catch(() => []) : [];
    const row = (t, acts = '') => `<div class="task" data-id="${esc(t.id)}"><span class="glyph">${esc(t.glyph ?? (t.status === 'done' ? '✓' : t.status === 'cancelled' ? '×' : '•'))}</span><div><b>${esc(t.title)}</b><div class="meta">${esc(t.status)}${t.priority && t.priority !== 'none' ? ` · ${esc(t.priority)}` : ''} · ${esc(ago(t.closedAt ?? t.updatedAt ?? t.createdAt ?? Date.now()))}${t.credits ? ` · ${esc(String(t.credits))} credits` : ''}</div></div><div class="acts">${acts}</div></div>`;
    el.innerHTML = head('Tasks', 'Everything in flight, grouped by what needs you first.')
      + section('Needs your call', approvals.length ? `<div id="approvals" class="list">${approvals.map(t => row(t, `<button type="button" class="btn sm primary" data-approve>Approve</button><button type="button" class="btn sm quiet" data-reject>Reject</button>`)).join('')}</div>` : '<div id="approvals" class="note">No approvals waiting.</div>')
      + section('In progress', doing.length ? `<div id="in-progress" class="list">${doing.map(t => row(t, `${iconBtn('check', 'Mark done', 'data-done')}${iconBtn('trash', 'Cancel', 'data-cancel-task')}`)).join('')}</div>` : '<div id="in-progress" class="note">Nothing in progress.</div>')
      + section('Done', done.length ? `<div id="done" class="list">${done.slice(0, 30).map(t => row(t)).join('')}</div>` : '<div id="done" class="note">Nothing finished yet.</div>')
      + section('Routines', `<div id="routines" class="list">${routines.map(r => `<div class="routine" data-id="${esc(r.id)}"><div class="row"><b>${esc(r.label)}</b><span class="badge ${r.enabled ? 'ok' : ''}">${r.enabled ? everyWords(r.condition?.everySeconds ?? 0) : 'paused'}</span><span class="right"></span>${iconBtn('play', 'Run now', 'data-run')}${r.enabled ? iconBtn('pause', 'Pause', 'data-pause') : iconBtn('play', 'Resume', 'data-resume')}${iconBtn('edit', 'Edit', 'data-edit')}${iconBtn('trash', 'Cancel', 'data-cancel')}</div><p class="muted small">${esc(r.effect?.prompt ?? '')}</p><p class="hint">${r.lastFiredAt ? `Last ran ${esc(when(r.lastFiredAt))}` : 'Has not run yet'}${r.nextDueAt ? ` · next ${esc(when(r.nextDueAt))}` : ''}</p></div>`).join('') || '<p class="muted">No routines yet.</p>'}</div>`, `<button type="button" class="btn sm quiet" id="new-routine">${icon('plus', 14)} New routine</button>`);
    const find = id => all.find(t => t.id === id);
    $$('[data-approve]', el).forEach(b => b.onclick = () => busy(b, async () => { try { await approve(biz, find(b.closest('.task').dataset.id)); toast('Approved.', 'ok'); ctx.refreshNeeds(); await paint(); } catch (e) { toast(oops(e), 'bad'); } }));
    $$('[data-reject]', el).forEach(b => b.onclick = () => busy(b, async () => { try { await reject(biz, find(b.closest('.task').dataset.id)); toast('Rejected.', 'ok'); ctx.refreshNeeds(); await paint(); } catch (e) { toast(oops(e), 'bad'); } }));
    $$('[data-done]', el).forEach(b => b.onclick = async () => { try { await tasks.update(b.closest('.task').dataset.id, { status: 'done' }); await paint(); } catch (e) { toast(oops(e), 'bad'); } });
    $$('[data-cancel-task]', el).forEach(b => b.onclick = async () => { if (!await confirm('Cancel this task?', { ok: 'Cancel the task', danger: true })) return; try { await tasks.update(b.closest('.task').dataset.id, { status: 'cancelled' }); await paint(); } catch (e) { toast(oops(e), 'bad'); } });
    const tid = biz.cofounder?.threadId;
    const rid = b => b.closest('.routine').dataset.id;
    $$('[data-run]', el).forEach(b => b.onclick = () => busy(b, async () => { const r = routines.find(x => x.id === rid(b)); try { await threads.inject(tid, r.effect?.prompt ?? '', r.label); toast(`${r.label} is running.`, 'ok'); } catch (e) { toast(oops(e), 'bad'); } }));
    $$('[data-pause]', el).forEach(b => b.onclick = async () => { try { await threads.triggers.update(tid, rid(b), { enabled: false }); await paint(); } catch (e) { toast(oops(e), 'bad'); } });
    $$('[data-resume]', el).forEach(b => b.onclick = async () => { try { await threads.triggers.update(tid, rid(b), { enabled: true }); await paint(); } catch (e) { toast(oops(e), 'bad'); } });
    $$('[data-cancel]', el).forEach(b => b.onclick = async () => { if (!await confirm('Cancel this routine? It will not run again.', { ok: 'Cancel the routine', danger: true })) return; try { await threads.triggers.remove(tid, rid(b)); await paint(); } catch (e) { toast(oops(e), 'bad'); } });
    $$('[data-edit]', el).forEach(b => b.onclick = () => routineForm(routines.find(x => x.id === rid(b))));
    $('#new-routine', el).onclick = () => routineForm(null);
    const routineForm = r => {
      if (!tid) return toast('Wake the co-founder first.', 'bad');
      const m = modal(`<h2>${r ? 'Edit routine' : 'New routine'}</h2><form id="rf" class="stack"><label class="field"><span>Name</span><input name="label" required value="${esc(r?.label ?? '')}" placeholder="Daily briefing"></label><label class="field"><span>What your co-founder should do each run</span><textarea name="prompt" required>${esc(r?.effect?.prompt ?? '')}</textarea></label><label class="field"><span>How often</span><select name="every">${INTERVALS.map(([v, l]) => `<option value="${v}" ${String(r?.condition?.everySeconds ?? 86400) === v ? 'selected' : ''}>${l}</option>`).join('')}<option value="custom" ${r && !INTERVALS.some(([v]) => v === String(r.condition?.everySeconds)) ? 'selected' : ''}>Custom (seconds)</option></select></label><label class="field" id="custom-wrap" hidden><span>Every (seconds, at least 60)</span><input name="custom" type="number" min="60" value="${esc(String(r?.condition?.everySeconds ?? 3600))}"></label><div class="modal-actions"><button type="button" class="btn quiet" id="rf-cancel">Cancel</button><button class="btn primary" type="submit">${r ? 'Save' : 'Create'}</button></div></form>`, { label: 'Routine' });
      const f = $('#rf', m.el); const sel = f.every; const cw = $('#custom-wrap', m.el);
      const sync = () => { cw.hidden = sel.value !== 'custom'; }; sel.onchange = sync; sync();
      $('#rf-cancel', m.el).onclick = () => m.close();
      f.onsubmit = async e => {
        e.preventDefault();
        const everySeconds = sel.value === 'custom' ? Math.max(60, Number(f.custom.value) || 3600) : Number(sel.value);
        try {
          if (r) await threads.triggers.update(tid, r.id, { label: f.label.value.trim(), prompt: f.prompt.value.trim(), everySeconds });
          else await threads.triggers.create(tid, { kind: 'cron', label: f.label.value.trim(), prompt: f.prompt.value.trim(), everySeconds });
          m.close(); toast(r ? 'Routine saved.' : 'Routine created.', 'ok'); await paint();
        } catch (err) { toast(oops(err), 'bad'); }
      };
    };
  };
  $('#new-task').onclick = () => {
    const m = modal(`<h2>New task</h2><form id="tf" class="stack"><label class="field"><span>Title</span><input name="title" required></label><label class="field"><span>Notes</span><textarea name="body"></textarea></label><label class="check"><input type="checkbox" name="forme"> Assign to me (else to the co-founder)</label><div class="modal-actions"><button type="button" class="btn quiet" id="tf-cancel">Cancel</button><button class="btn primary" type="submit">Create</button></div></form>`, { label: 'New task' });
    $('#tf-cancel', m.el).onclick = () => m.close();
    $('#tf', m.el).onsubmit = async e => {
      e.preventDefault(); const f = e.target;
      const assignees = f.forme.checked ? [`user:${ctx.me.id}`] : biz.cofounder?.agentId ? [`agent:${biz.cofounder.agentId}`] : [];
      try { await tasks.create({ dir: `${folderOf(biz.slug)}/Tasks`, doc: { title: f.title.value.trim(), status: 'todo', labels: [`biz:${biz.slug}`], assignees }, body: f.body.value }); m.close(); toast('Task created.', 'ok'); await paint(); }
      catch (err) { toast(oops(err), 'bad'); }
    };
  };
  await paint();
}
