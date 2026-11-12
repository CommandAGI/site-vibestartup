// Activity: every event of the co-founder's first chat, and of the chat a moved business had before (its
// `cofounder.earlier`), newest first, with its time.
import { threads } from '/lib/api.js';
import { esc, icon, when } from '/lib/ui.js';
import { head, empty } from './_shared.js';

const line = e => {
  if (e.text) return e.text;
  if (e.tool?.name) return `used ${e.tool.name}`;
  if (e.event) return e.event;
  if (e.type) return e.type.replace(/[._]/g, ' ');
  return JSON.stringify(e).slice(0, 160);
};

export async function render(ctx) {
  const { biz, el, actions } = ctx;
  actions.innerHTML = `<button type="button" class="btn icon" id="act-refresh" aria-label="Refresh" data-tip="Refresh">${icon('refresh')}</button>`;
  const paint = async () => {
    if (!biz.cofounder?.threadId) { el.innerHTML = head('Activity') + empty('No activity yet', 'Wake the co-founder in Chat first.', `<a class="btn quiet" href="${esc(ctx.tabHref('chat'))}">Open Chat</a>`); return; }
    const ids = [biz.cofounder.threadId, ...(biz.cofounder.earlier ?? []).map(t => t.id)];
    const events = (await Promise.all(ids.map(id => threads.events(id, { limit: 200 }).catch(() => [])))).flat().sort((a, b) => (b.at ?? 0) - (a.at ?? 0)).slice(0, 200);
    el.innerHTML = head('Activity', 'Every action of you and your co-founder, newest first.') + (events.length ? `<div id="activity" class="list">${events.map(e => `<div class="event"><span class="meta">${esc(when(e.at))}</span><span class="badge">${esc(e.kind ?? e.type ?? '')}</span><span class="text">${esc(String(line(e)).slice(0, 400))}</span></div>`).join('')}</div>` : `<div id="activity">${empty('Nothing yet', 'Events show here as the thread works.')}</div>`);
  };
  $('#act-refresh').onclick = paint;
  await paint();
  const timer = setInterval(paint, 5000);
  return () => clearInterval(timer);
}
const $ = (s, r = document) => r.querySelector(s);
