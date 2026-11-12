// The controls and pictures a co-founder's message carries (CommandAGI's ChatUi, `ui` on a chat entry): option
// buttons, a multiselect, a slider, yes or no, a got-it, a text box, a file picker, and charts (`lens`, `graph`).
// The agent makes one with a ```cagi-ask JSON block (the platform strips it and keeps `ui`), with ask_question, or
// with request_upload. Every string here came from a model: each one is escaped, and nothing in `ui` becomes markup.
// Pure: no DOM, so a plain node test renders every kind (test/widgets.mjs). app/tabs/chat.js wires the events.

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const arr = v => Array.isArray(v) ? v : [];
const fin = n => typeof n === 'number' && Number.isFinite(n);
// A chart's `spec` may name a prefix and a suffix for its numbers ("$", " mugs").
const fmtRaw = (n, spec = {}) => `${String(spec.prefix ?? '').slice(0, 8)}${new Intl.NumberFormat('en-US', { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 2 }).format(n)}${String(spec.suffix ?? '').slice(0, 16)}`;
const fmt = (n, spec) => esc(fmtRaw(n, spec));
const safeUrl = u => /^https:\/\//i.test(String(u ?? '')) ? esc(u) : null;
const ANSWERABLE = new Set(['select', 'multiselect', 'slider', 'confirm', 'acknowledge', 'text', 'file']);

/** Whether a `ui` asks the founder something (a chart asks nothing). */
export const answerable = ui => !!ui && ANSWERABLE.has(ui.kind);

/** The value a choice sends: the platform matches it to an option by `value ?? label`. */
export const optionValue = o => String(o?.value ?? o?.label ?? '');

/**
 * A message's words without its ```cagi-ask block, while the model still writes it (message.delta): a closed block
 * goes, and an open one at the end goes with the rest of the message after it. The stored message has none.
 */
export function stripAsk(text) {
  return String(text ?? '').replace(/```cagi-ask[\s\S]*?```/g, '').replace(/```cagi-ask[\s\S]*$/, '').trimEnd();
}

/**
 * The picture a `visualize` call made, read from its tool line. The platform keeps the tool's output on the line
 * (`tool.output`, its JSON) but gives the line no `ui`, so the chart is read from the output here.
 */
export function toolUi(tool) {
  if (tool?.name !== 'visualize' || tool.ok === false || typeof tool.output !== 'string') return null;
  try {
    const out = JSON.parse(tool.output);
    const ui = out?.ui ?? (out?.lens ? { kind: 'lens', lens: { lens: out.lens, data: out.data } } : null);
    return ui?.kind === 'lens' && ui.lens?.lens ? ui : null;
  } catch { return null; }
}

/**
 * One widget as HTML. `m` is the chat entry (its `id`, `ui`, `question`); `state` is the page's state of it:
 * `sending` (controls off while the answer is on its way), `error` (shown, controls on again), `picked` (a
 * multiselect's chosen values before it is sent).
 */
export function widget(m, state = {}) {
  const ui = m?.ui;
  if (!ui?.kind) return '';
  const id = String(m.id ?? '');
  const pid = `ask-${id.replace(/[^\w-]/g, '_')}`;
  const answered = !!ui.answered;
  const off = answered || state.sending ? ' disabled' : '';
  // A prompt the message's words already say (request_upload writes both) is not shown twice; it still names the group.
  const said = String(m.text ?? '').trim() === String(ui.prompt ?? '').trim();
  const prompt = ui.prompt && !(ui.kind === 'lens' && ui.lens?.title) ? `<p class="ask-prompt${said ? ' sr-only' : ''}" id="${pid}-p">${esc(ui.prompt)}</p>` : '';
  const labelled = ui.prompt ? ` aria-labelledby="${pid}-p"` : ` aria-label="${esc(labelFor(ui.kind))}"`;
  let body = '';
  // A model's data can have any shape: a widget that cannot be drawn is left out, never a broken chat.
  try { switch (ui.kind) {
    case 'select': body = select(ui, off, pid); break;
    case 'multiselect': body = multiselect(ui, off, state); break;
    case 'slider': body = slider(ui, off, pid); break;
    case 'confirm': body = confirm(ui, off); break;
    case 'acknowledge': body = `<div class="ask-acts"><button type="button" class="btn sm primary" data-ask-send data-value="${esc(ui.submitLabel || 'Got it')}"${off}>${esc(ui.submitLabel || 'Got it')}</button></div>`; break;
    case 'text': body = textBox(ui, off, pid); break;
    case 'file': body = filePicker(ui, off, pid); break;
    case 'lens': body = lens(ui.lens ?? {}, pid); break;
    case 'graph': body = graph(ui.graph?.view ?? {}, ui.graph?.title, pid); break;
    default: return '';
  } } catch { return ''; }
  const ask = answerable(ui);
  const status = !ask ? ''
    : answered ? `<p class="ask-answer"><span class="badge ok">Answered</span> ${esc(answerText(ui))}${ui.file ? fileLink(ui.file) : ''}</p>`
    : state.sending ? '<p class="ask-status" role="status">Sending…</p>'
    : state.error ? `<p class="ask-error" role="alert">${esc(state.error)} Try again.</p>`
    : '';
  return `<div class="ask${answered ? ' answered' : ''}${ask ? '' : ' picture'}" data-widget="${esc(id)}" data-kind="${esc(ui.kind)}" role="group"${labelled}${state.sending ? ' aria-busy="true"' : ''}>${prompt}${body}${status}</div>`;
}

const labelFor = kind => ({ select: 'Choose one', multiselect: 'Choose any', slider: 'Pick a number', confirm: 'Yes or no', acknowledge: 'Acknowledge', text: 'Your answer', file: 'Upload a file', lens: 'Chart', graph: 'Graph' })[kind] ?? 'Question';

/** What the founder answered, in words: an option's label where the answer is its value. */
export function answerText(ui) {
  const a = String(ui.answer ?? '');
  const opts = ui.options ?? [];
  if (ui.kind === 'multiselect') return a.split(/,\s*/).map(v => opts.find(o => optionValue(o) === v)?.label ?? v).join(', ');
  return opts.find(o => optionValue(o) === a)?.label ?? a;
}

function isChosen(ui, o) {
  if (!ui.answered) return false;
  const a = String(ui.answer ?? '');
  if (ui.kind === 'multiselect') return a.split(/,\s*/).includes(optionValue(o));
  return a === optionValue(o) || a === o.label;
}

function option(ui, o, off, extra = '') {
  const chosen = isChosen(ui, o);
  return `<button type="button" class="ask-opt${chosen ? ' chosen' : ''}" data-value="${esc(optionValue(o))}"${extra}${off}><b>${esc(o.label)}</b>${o.description ? `<small>${esc(o.description)}</small>` : ''}</button>`;
}

function select(ui, off, pid) {
  const opts = (ui.options ?? []).slice(0, 24);
  const buttons = opts.map(o => option(ui, o, off, ' data-ask-send' + (ui.answered ? ` aria-pressed="${isChosen(ui, o)}"` : ''))).join('');
  const own = ui.freeText && !ui.answered ? `<form class="ask-own" data-ask-form><label class="sr-only" for="${pid}-own">Or write your own answer</label><input id="${pid}-own" class="input" name="value" maxlength="2000" placeholder="Or write your own…" autocomplete="off"${off}><button type="submit" class="btn sm quiet"${off}>${esc(ui.submitLabel || 'Send')}</button></form>` : '';
  return `<div class="ask-opts">${buttons}</div>${own}`;
}

function multiselect(ui, off, state) {
  const picked = new Set(state.picked ?? []);
  const opts = (ui.options ?? []).slice(0, 24);
  const buttons = opts.map(o => option(ui, o, off, ` data-ask-toggle aria-pressed="${ui.answered ? isChosen(ui, o) : picked.has(optionValue(o))}"`)).join('');
  const send = ui.answered ? '' : `<div class="ask-acts"><button type="button" class="btn sm primary" data-ask-submit${off || (picked.size ? '' : ' disabled')}>${esc(ui.submitLabel || 'Send')}</button><small class="muted">${picked.size ? `${picked.size} chosen` : 'Choose one or more'}</small></div>`;
  return `<div class="ask-opts">${buttons}</div>${send}`;
}

function slider(ui, off, pid) {
  const min = fin(ui.min) ? ui.min : 0;
  const max = fin(ui.max) && ui.max > min ? ui.max : min + 100;
  const step = fin(ui.step) && ui.step > 0 ? ui.step : 1;
  const answered = ui.answered && fin(Number(ui.answer)) ? Number(ui.answer) : null;
  const start = answered ?? (fin(Number(ui.defaultValue)) && ui.defaultValue !== '' ? Math.min(max, Math.max(min, Number(ui.defaultValue))) : min + Math.round((max - min) / 2 / step) * step);
  return `<form class="ask-slider" data-ask-form><div class="ask-range"><input type="range" id="${pid}-r" name="value" min="${min}" max="${max}" step="${step}" value="${start}"${ui.prompt ? ` aria-labelledby="${pid}-p"` : ' aria-label="Value"'}${off}><output for="${pid}-r" aria-live="polite">${esc(String(start))}</output></div><div class="ask-scale" aria-hidden="true"><span>${esc(String(min))}</span><span>${esc(String(max))}</span></div>${ui.answered ? '' : `<div class="ask-acts"><button type="submit" class="btn sm primary"${off}>${esc(ui.submitLabel || 'Send')}</button></div>`}</form>`;
}

function confirm(ui, off) {
  const yes = ui.submitLabel || 'Yes';
  const mark = v => ui.answered ? ` aria-pressed="${String(ui.answer) === v}"` : '';
  const cls = v => ui.answered && String(ui.answer) === v ? ' chosen' : '';
  return `<div class="ask-acts"><button type="button" class="btn sm primary${cls(yes)}" data-ask-send data-value="${esc(yes)}"${mark(yes)}${off}>${esc(yes)}</button><button type="button" class="btn sm quiet${cls('No')}" data-ask-send data-value="No"${mark('No')}${off}>No</button></div>`;
}

function textBox(ui, off, pid) {
  if (ui.answered) return '';
  return `<form class="ask-own" data-ask-form><label class="sr-only" for="${pid}-t">${esc(ui.prompt || 'Your answer')}</label><input id="${pid}-t" class="input" name="value" maxlength="2000" autocomplete="off" placeholder="Your answer…"${ui.defaultValue != null ? ` value="${esc(ui.defaultValue)}"` : ''}${off}><button type="submit" class="btn sm primary"${off}>${esc(ui.submitLabel || 'Send')}</button></form>`;
}

function filePicker(ui, off, pid) {
  if (ui.answered) return '';
  const accept = (ui.accept ?? []).map(a => String(a).replace(/[^\w/*.+-]/g, '')).filter(Boolean).join(',');
  return `<div class="ask-file"><input type="file" id="${pid}-f" class="sr-only" data-ask-file${accept ? ` accept="${esc(accept)}"` : ''}${ui.multiple ? ' multiple' : ''}${off}><label for="${pid}-f" class="btn sm primary${off ? ' is-off' : ''}">${esc(ui.submitLabel || (ui.multiple ? 'Choose files' : 'Choose a file'))}</label>${accept ? `<small class="muted">${esc(accept.replace(/,/g, ', '))}</small>` : ''}</div>`;
}

function fileLink(f) {
  const u = safeUrl(f.url);
  return u ? ` · <a href="${u}" target="_blank" rel="noopener nofollow">Open</a>` : '';
}

// ---------- pictures ----------

function figure(title, pid, svg, table, summary) {
  return `<figure class="ask-chart">${title ? `<figcaption id="${pid}-c">${esc(title)}</figcaption>` : ''}${svg ? `<div class="ask-svg" role="img" aria-label="${esc(summary)}">${svg}</div>` : ''}${table ? `<details${svg ? '' : ' open'}><summary>${svg ? 'Show the numbers' : 'The numbers'}</summary><div class="md-table">${table}</div></details>` : ''}</figure>`;
}
const tableOf = (head, rows) => `<table><thead><tr>${head.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => i ? `<td class="num">${c}</td>` : `<th scope="row">${c}</th>`).join('')}</tr>`).join('')}</tbody></table>`;
// A point's own `label` ("Jan"), else its time as a date when it is one (ms epoch), else its index.
const tRaw = (t, label) => label != null ? String(label) : t > 1e11 ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', timeZone: 'UTC' }) : String(t);
const tLabel = (t, label) => esc(tRaw(t, label));

function lens(l, pid) {
  const data = l.data ?? {};
  const spec = l.spec && typeof l.spec === 'object' ? l.spec : {};
  const title = l.title;
  switch (l.lens) {
    case 'series': return series(Array.isArray(data.points) ? data.points : [], spec, title, pid);
    case 'timeline': {
      const ev = (Array.isArray(data.events) ? data.events : []).filter(e => fin(e?.t)).sort((a, b) => a.t - b.t).slice(0, 60);
      return `<figure class="ask-chart">${title ? `<figcaption>${esc(title)}</figcaption>` : ''}<ol class="ask-timeline">${ev.map(e => `<li><time>${tLabel(e.t)}${fin(e.end) ? ` – ${tLabel(e.end)}` : ''}</time><b>${esc(e.label)}</b>${e.group ? ` <span class="badge">${esc(e.group)}</span>` : ''}${e.note ? `<small>${esc(e.note)}</small>` : ''}</li>`).join('')}</ol></figure>`;
    }
    case 'treemap': {
      const sum = n => fin(n?.value) && !arr(n.children).length ? n.value : arr(n?.children).reduce((s, c) => s + sum(c), 0);
      const kids = (arr(data.children).length ? data.children : [data]).map(c => ({ name: String(c?.name ?? ''), v: sum(c) })).sort((a, b) => b.v - a.v).slice(0, 30);
      return bars(kids.map(k => [k.name, k.v]), spec, title ?? data.name, pid);
    }
    case 'flow': {
      const name = id => arr(data.nodes).find(n => n?.id === id)?.label ?? id;
      const links = (Array.isArray(data.links) ? data.links : []).filter(k => fin(k?.value)).slice(0, 40);
      return bars(links.map(k => [`${name(k.source)} → ${name(k.target)}`, k.value]), spec, title, pid);
    }
    case 'matrix': return heat(data.rows ?? [], data.cols ?? [], data.values ?? [], spec, title);
    case 'chord': case 'radial': return heat(data.labels ?? [], data.labels ?? [], data.matrix ?? [], spec, title);
    case 'graph': return graph(data, title, pid);
    default: return title ? `<figure class="ask-chart"><figcaption>${esc(title)}</figcaption></figure>` : '';
  }
}

/** A line over time: the points' `value` (or `c`), a band from `lo`/`hi`, the first and last labels, and the table. */
function series(points, spec, title, pid) {
  const pts = points.map((p, i) => ({ t: fin(p?.t) ? p.t : i, label: p?.label, y: fin(p?.value) ? p.value : fin(p?.c) ? p.c : null, lo: p?.lo, hi: p?.hi })).filter(p => p.y != null).sort((a, b) => a.t - b.t).slice(0, 400);
  if (!pts.length) return figure(title, pid, '', '<p class="muted">No numbers.</p>', '');
  const W = 320, H = 120, P = 6;
  const ys = pts.flatMap(p => [p.y, fin(p.lo) ? p.lo : p.y, fin(p.hi) ? p.hi : p.y]);
  let lo = Math.min(0, ...ys), hi = Math.max(...ys);
  if (hi === lo) hi = lo + 1;
  const t0 = pts[0].t, t1 = pts.at(-1).t;
  const x = t => pts.length === 1 ? W / 2 : P + ((t - t0) / (t1 - t0 || 1)) * (W - 2 * P);
  const y = v => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const line = pts.map(p => `${x(p.t).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const banded = pts.filter(p => fin(p.lo) && fin(p.hi));
  const band = banded.length > 1 ? `<polygon class="band" points="${[...banded.map(p => `${x(p.t).toFixed(1)},${y(p.hi).toFixed(1)}`), ...banded.reverse().map(p => `${x(p.t).toFixed(1)},${y(p.lo).toFixed(1)}`)].join(' ')}"/>` : '';
  const dots = pts.length <= 40 ? pts.map(p => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.y).toFixed(1)}" r="2.5"/>`).join('') : '';
  const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" focusable="false" aria-hidden="true"><line class="axis" x1="0" x2="${W}" y1="${y(lo).toFixed(1)}" y2="${y(lo).toFixed(1)}"/>${band}<polyline points="${line}"/>${dots}</svg><div class="ask-ticks"><span>${tLabel(pts[0].t, pts[0].label)}</span><span>${tLabel(pts.at(-1).t, pts.at(-1).label)}</span></div>`;
  const first = pts[0], last = pts.at(-1);
  const max = pts.reduce((a, b) => b.y > a.y ? b : a);
  const summary = `${title ? `${title}. ` : ''}${pts.length} points, from ${fmtRaw(first.y, spec)} at ${tRaw(first.t, first.label)} to ${fmtRaw(last.y, spec)} at ${tRaw(last.t, last.label)}; the highest is ${fmtRaw(max.y, spec)} at ${tRaw(max.t, max.label)}.`;
  const hasBand = banded.length > 0;
  const table = tableOf(['When', 'Value', ...(hasBand ? ['Low', 'High'] : [])], pts.slice(0, 120).map(p => [tLabel(p.t, p.label), fmt(p.y, spec), ...(hasBand ? [fin(p.lo) ? fmt(p.lo, spec) : '', fin(p.hi) ? fmt(p.hi, spec) : ''] : [])]));
  return figure(title, pid, svg, table, summary);
}

/** Named magnitudes as bars, largest first: a treemap's parts or a flow's links. */
function bars(rows, spec, title, pid) {
  const items = rows.filter(([, v]) => fin(v));
  if (!items.length) return figure(title, pid, '', '<p class="muted">No numbers.</p>', '');
  const max = Math.max(...items.map(([, v]) => Math.abs(v))) || 1;
  return `<figure class="ask-chart">${title ? `<figcaption>${esc(title)}</figcaption>` : ''}<ul class="ask-bars">${items.map(([k, v]) => `<li><span>${esc(k)}</span><i style="--w:${Math.max(1, Math.round((Math.abs(v) / max) * 100))}%" aria-hidden="true"></i><b>${fmt(v, spec)}</b></li>`).join('')}</ul></figure>`;
}

/** A grid of numbers, each cell shaded by its size. */
function heat(rows, cols, values, spec, title) {
  const R = arr(rows).slice(0, 30).map(String), C = arr(cols).slice(0, 30).map(String);
  const all = R.flatMap((_, i) => C.map((_, j) => arr(arr(values)[i])[j])).filter(fin);
  const max = Math.max(...all.map(Math.abs), 0) || 1;
  const cell = v => fin(v) ? `<td class="num" style="--h:${Math.round((Math.abs(v) / max) * 60)}%">${fmt(v, spec)}</td>` : '<td></td>';
  return `<figure class="ask-chart">${title ? `<figcaption>${esc(title)}</figcaption>` : ''}<div class="md-table"><table class="ask-heat"><thead><tr><td></td>${C.map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${R.map((r, i) => `<tr><th scope="row">${esc(r)}</th>${C.map((_, j) => cell(arr(arr(values)[i])[j])).join('')}</tr>`).join('')}</tbody></table></div></figure>`;
}

/** A small graph: nodes on a circle, edges as lines, and the edges as a list (what a screen reader reads). */
function graph(view, title, pid) {
  const nodes = (Array.isArray(view?.nodes) ? view.nodes : []).slice(0, 40);
  const edges = (Array.isArray(view?.edges) ? view.edges : []).filter(e => nodes.some(n => n.id === e?.from) && nodes.some(n => n.id === e?.to)).slice(0, 80);
  if (!nodes.length) return figure(title, pid, '', '<p class="muted">No nodes.</p>', '');
  const W = 320, H = 200, r = Math.min(W, H) / 2 - 24;
  const at = new Map(nodes.map((n, i) => [n.id, { x: W / 2 + r * Math.cos((2 * Math.PI * i) / nodes.length - Math.PI / 2), y: H / 2 + r * Math.sin((2 * Math.PI * i) / nodes.length - Math.PI / 2) }]));
  const label = id => nodes.find(n => n.id === id)?.label ?? id;
  const svg = `<svg class="tall" viewBox="0 0 ${W} ${H}" focusable="false" aria-hidden="true">${edges.map(e => { const a = at.get(e.from), b = at.get(e.to); return `<line class="edge" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>`; }).join('')}${nodes.map(n => { const p = at.get(n.id); return `<g><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4"/><text x="${p.x.toFixed(1)}" y="${(p.y - 8).toFixed(1)}">${esc(String(n.label ?? n.id).slice(0, 18))}</text></g>`; }).join('')}</svg>`;
  const list = `<ul class="ask-edges">${edges.map(e => `<li>${esc(label(e.from))} <span class="muted">${esc(e.label ?? e.kind ?? '→')}</span> ${esc(label(e.to))}</li>`).join('') || nodes.map(n => `<li>${esc(n.label ?? n.id)}</li>`).join('')}</ul>`;
  return `<figure class="ask-chart">${title ? `<figcaption>${esc(title)}</figcaption>` : ''}<div class="ask-svg" role="img" aria-label="${esc(`${title ? `${title}. ` : ''}${nodes.length} nodes and ${edges.length} links`)}">${svg}</div><details><summary>Show the links</summary>${list}</details></figure>`;
}
