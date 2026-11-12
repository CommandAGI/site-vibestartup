// A message's widgets (lib/widgets.js): every kind of CommandAGI's ChatUi renders, open and answered, and nothing a
// model writes into a label, a prompt or a chart reaches the page as markup.
//   node test/widgets.mjs
import assert from 'node:assert/strict';
import { widget, toolUi, stripAsk, answerText, answerable } from '../lib/widgets.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log(`ok ${n} ${name}`); };
const entry = (ui, extra = {}) => ({ id: 'm1', role: 'agent', text: 'Which one?', ui, question: 'q1', ...extra });
const EVIL = '<img src=x onerror=alert(1)>"\'&';
// Nothing of the model's words is markup: no tag, no attribute it opened, no unescaped quote inside an attribute.
const clean = h => {
  assert.doesNotMatch(h, /<img|<script|onerror=alert\(1\)>/);
  assert.doesNotMatch(h, /="[^"]*<[^"]*"/, 'a < inside an attribute');
};

const PRICE = { kind: 'select', prompt: 'Which price do we start with?', options: [{ value: '18', label: '$18 a mug', description: 'Near the cafe price' }, { value: '24', label: '$24 a mug' }, { label: '$30 a mug' }] };

ok('select: one button per option, its value and its meaning; nothing chosen', () => {
  const h = widget(entry(PRICE));
  assert.equal((h.match(/class="ask-opt"/g) ?? []).length, 3);
  assert.match(h, /data-widget="m1" data-kind="select" role="group" aria-labelledby="ask-m1-p"/);
  assert.match(h, /<p class="ask-prompt" id="ask-m1-p">Which price do we start with\?<\/p>/);
  assert.match(h, /data-value="18" data-ask-send><b>\$18 a mug<\/b><small>Near the cafe price<\/small>/);
  assert.match(h, /data-value="\$30 a mug"/, 'an option with no value sends its label');
  assert.doesNotMatch(h, /disabled|Answered/);
});
ok('select answered: locked, the chosen one marked, the answer in words', () => {
  const h = widget(entry({ ...PRICE, answered: true, answer: '24' }));
  assert.equal((h.match(/ disabled/g) ?? []).length, 3);
  assert.match(h, /class="ask-opt chosen" data-value="24" data-ask-send aria-pressed="true" disabled/);
  assert.match(h, /<span class="badge ok">Answered<\/span> \$24 a mug/);
  assert.match(h, /class="ask answered"/);
});
ok('select with freeText: a labelled box for the founder\'s own words', () => {
  const h = widget(entry({ ...PRICE, freeText: true }));
  assert.match(h, /<label class="sr-only" for="ask-m1-own">Or write your own answer<\/label><input id="ask-m1-own"/);
  assert.doesNotMatch(widget(entry({ ...PRICE, freeText: true, answered: true, answer: 'mine' })), /ask-own/);
});
ok('sending: controls off, busy, a status line; an error says so and turns them on', () => {
  const h = widget(entry(PRICE), { sending: true });
  assert.match(h, /aria-busy="true"/);
  assert.match(h, /role="status">Sending…/);
  assert.equal((h.match(/ disabled/g) ?? []).length, 3);
  const e = widget(entry(PRICE), { error: 'We could not reach CommandAGI.' });
  assert.match(e, /role="alert">We could not reach CommandAGI\. Try again\./);
  assert.doesNotMatch(e, /disabled/);
});
ok('multiselect: toggles with aria-pressed and a send that waits for a choice', () => {
  const ui = { kind: 'multiselect', options: [{ label: 'Instagram' }, { label: 'TikTok' }, { label: 'Email' }] };
  const none = widget(entry(ui));
  assert.match(none, /aria-label="Choose any"/);
  assert.match(none, /data-ask-submit disabled>Send/);
  const two = widget(entry(ui), { picked: ['TikTok', 'Email'] });
  assert.equal((two.match(/aria-pressed="true"/g) ?? []).length, 2);
  assert.match(two, /data-ask-submit>Send<\/button><small class="muted">2 chosen/);
  const done = widget(entry({ ...ui, answered: true, answer: 'Instagram, Email' }));
  assert.equal((done.match(/class="ask-opt chosen"/g) ?? []).length, 2);
  assert.match(done, /Answered<\/span> Instagram, Email/);
  assert.doesNotMatch(done, /data-ask-submit/);
});
ok('slider: a range with its bounds, step, default and a live value; answered shows the number, locked', () => {
  const ui = { kind: 'slider', prompt: 'Monthly ad budget', min: 0, max: 500, step: 25, defaultValue: 150, submitLabel: 'Set budget' };
  const h = widget(entry(ui));
  assert.match(h, /<input type="range" id="ask-m1-r" name="value" min="0" max="500" step="25" value="150" aria-labelledby="ask-m1-p">/);
  assert.match(h, /<output for="ask-m1-r" aria-live="polite">150<\/output>/);
  assert.match(h, />Set budget<\/button>/);
  const mid = widget(entry({ kind: 'slider', min: 10, max: 50, step: 10 }));
  assert.match(mid, /value="30"/, 'no default: the middle, on a step');
  const done = widget(entry({ ...ui, answered: true, answer: '275' }));
  assert.match(done, /value="275" aria-labelledby="ask-m1-p" disabled>/);
  assert.match(done, /Answered<\/span> 275/);
  assert.doesNotMatch(done, /Set budget/);
});
ok('confirm and acknowledge: buttons that send their words', () => {
  const c = widget(entry({ kind: 'confirm', prompt: 'Publish the post now?' }));
  assert.match(c, /data-ask-send data-value="Yes">Yes<\/button>/);
  assert.match(c, /data-ask-send data-value="No">No<\/button>/);
  const cd = widget(entry({ kind: 'confirm', answered: true, answer: 'No' }));
  assert.match(cd, /btn sm quiet chosen" data-ask-send data-value="No" aria-pressed="true" disabled/);
  const a = widget(entry({ kind: 'acknowledge', submitLabel: 'Understood' }));
  assert.match(a, /data-value="Understood">Understood<\/button>/);
  assert.match(widget(entry({ kind: 'acknowledge' })), />Got it<\/button>/);
});
ok('text: a labelled input and a send; answered shows the words', () => {
  const h = widget(entry({ kind: 'text', prompt: 'What is the shop\'s phone number?' }));
  assert.match(h, /<label class="sr-only" for="ask-m1-t">What is the shop&#39;s phone number\?<\/label><input id="ask-m1-t"/);
  const done = widget(entry({ kind: 'text', answered: true, answer: '555 0100' }));
  assert.doesNotMatch(done, /<input/);
  assert.match(done, /Answered<\/span> 555 0100/);
});
ok('file: a picker that keeps the request\'s types; the prompt the words say is not shown twice', () => {
  const ui = { kind: 'file', prompt: 'Send me your logo.', accept: ['image/png', 'image/*', 'application/pdf"><x'], requestId: 'r1' };
  const h = widget({ id: 'f1', role: 'agent', text: 'Send me your logo.', ui, question: 'r1' });
  assert.match(h, /<input type="file" id="ask-f1-f" class="sr-only" data-ask-file accept="image\/png,image\/\*,application\/pdfx">/);
  assert.match(h, /<label for="ask-f1-f" class="btn sm primary">Choose a file<\/label>/);
  assert.match(h, /class="ask-prompt sr-only"/);
  const done = widget({ id: 'f1', text: 'x', ui: { ...ui, answered: true, answer: 'logo.png', file: { id: 'd1', name: 'logo.png', url: 'https://api.commandagi.com/drive/d1/content?token=t' } } });
  assert.match(done, /Answered<\/span> logo\.png · <a href="https:\/\/api\.commandagi\.com\/drive\/d1\/content\?token=t" target="_blank" rel="noopener nofollow">Open<\/a>/);
  assert.doesNotMatch(widget({ id: 'f1', ui: { ...ui, answered: true, answer: 'a', file: { name: 'a', url: 'javascript:alert(1)' } } }), /javascript:/);
});
ok('lens series: an SVG line, a summary a screen reader reads, and the numbers as a table', () => {
  const t0 = Date.UTC(2026, 0, 1);
  const ui = { kind: 'lens', lens: { lens: 'series', title: 'Orders a week', data: { points: [{ t: t0, value: 4 }, { t: t0 + 7 * 864e5, value: 9 }, { t: t0 + 14 * 864e5, value: 7, lo: 5, hi: 9 }] }, spec: { suffix: ' orders' } } };
  const h = widget(entry(ui));
  assert.match(h, /class="ask picture"/);
  assert.match(h, /<figcaption id="ask-m1-c">Orders a week<\/figcaption>/);
  assert.match(h, /role="img" aria-label="Orders a week\. 3 points, from 4 orders at Jan 1, 26 to 7 orders at Jan 15, 26; the highest is 9 orders at Jan 8, 26\."/);
  assert.match(h, /<polyline points="[\d.,\s]+"\/>/);
  assert.equal((h.match(/<circle/g) ?? []).length, 3);
  assert.match(h, /<summary>Show the numbers<\/summary>/);
  assert.match(h, /<th scope="row">Jan 8, 26<\/th><td class="num">9 orders<\/td>/);
  assert.doesNotMatch(h, /Answered|data-ask-send/);
  const labelled = widget(entry({ kind: 'lens', lens: { lens: 'series', data: { points: [{ t: 0, value: 1200, label: 'Sep' }, { t: 1, value: 1850.5, label: 'Oct' }] }, spec: { prefix: '$' } } }));
  assert.match(labelled, /<th scope="row">Oct<\/th><td class="num">\$1,851<\/td>/);
});
ok('lens timeline, treemap, flow, matrix, chord, graph', () => {
  const tl = widget(entry({ kind: 'lens', lens: { lens: 'timeline', data: { events: [{ id: 'b', t: Date.UTC(2026, 1, 2), label: 'Launch' }, { id: 'a', t: Date.UTC(2026, 0, 5), label: 'Site live', note: 'day 1' }] } } }));
  assert.match(tl, /<ol class="ask-timeline"><li><time>Jan 5, 26<\/time><b>Site live<\/b><small>day 1<\/small><\/li><li><time>Feb 2, 26<\/time><b>Launch<\/b>/);
  const tm = widget(entry({ kind: 'lens', lens: { lens: 'treemap', data: { name: 'Costs', children: [{ name: 'Clay', value: 40 }, { name: 'Ads', children: [{ name: 'Meta', value: 60 }, { name: 'TikTok', value: 20 }] }] } } }));
  assert.match(tm, /<figcaption>Costs<\/figcaption><ul class="ask-bars"><li><span>Ads<\/span><i style="--w:100%" aria-hidden="true"><\/i><b>80<\/b><\/li><li><span>Clay<\/span><i style="--w:50%"/);
  const fl = widget(entry({ kind: 'lens', lens: { lens: 'flow', data: { nodes: [{ id: 'v', label: 'Visits' }, { id: 'o', label: 'Orders' }], links: [{ source: 'v', target: 'o', value: 12 }] } } }));
  assert.match(fl, /<span>Visits → Orders<\/span>/);
  const mx = widget(entry({ kind: 'lens', lens: { lens: 'matrix', data: { rows: ['Mon', 'Tue'], cols: ['AM', 'PM'], values: [[1, 2], [3, 4]] } } }));
  assert.match(mx, /<th scope="row">Tue<\/th><td class="num" style="--h:45%">3<\/td><td class="num" style="--h:60%">4<\/td>/);
  const ch = widget(entry({ kind: 'lens', lens: { lens: 'chord', data: { labels: ['A', 'B'], matrix: [[0, 5], [5, 0]] } } }));
  assert.match(ch, /<th scope="col">A<\/th><th scope="col">B<\/th>/);
  const g = widget(entry({ kind: 'graph', graph: { title: 'Who buys', view: { nodes: [{ id: 'c', label: 'Cafe' }, { id: 'm', label: 'Mug' }], edges: [{ id: 'e', from: 'c', to: 'm', kind: 'buys' }] } } }));
  assert.match(g, /role="img" aria-label="Who buys\. 2 nodes and 1 links"/);
  assert.match(g, /<li>Cafe <span class="muted">buys<\/span> Mug<\/li>/);
  assert.match(widget(entry({ kind: 'lens', lens: { lens: 'graph', data: { nodes: [{ id: 'x', label: 'X' }], edges: [] } } })), /<text[^>]*>X<\/text>/);
});
ok('broken or empty chart data draws nothing that throws', () => {
  for (const l of ['series', 'timeline', 'treemap', 'flow', 'matrix', 'chord', 'radial', 'graph', 'unknown'])
    for (const data of [undefined, null, {}, { points: 'x', events: 3, nodes: {}, links: null, rows: 1 }]) widget(entry({ kind: 'lens', lens: { lens: l, data } }));
  assert.match(widget(entry({ kind: 'lens', lens: { lens: 'series', data: { points: [] } } })), /No numbers\./);
  assert.equal(widget(entry({ kind: 'nope' })), '');
  assert.equal(widget({ id: 'x' }), '');
});
ok('escaping: a model\'s label, description, prompt, value, title and chart text never become markup', () => {
  const opts = [{ value: EVIL, label: EVIL, description: EVIL }];
  const kinds = [
    { kind: 'select', prompt: EVIL, options: opts, freeText: true, submitLabel: EVIL },
    { kind: 'select', prompt: EVIL, options: opts, answered: true, answer: EVIL },
    { kind: 'multiselect', prompt: EVIL, options: opts, submitLabel: EVIL },
    { kind: 'multiselect', options: opts, answered: true, answer: EVIL },
    { kind: 'slider', prompt: EVIL, min: 0, max: 10, submitLabel: EVIL },
    { kind: 'slider', answered: true, answer: EVIL },
    { kind: 'confirm', prompt: EVIL, submitLabel: EVIL },
    { kind: 'confirm', submitLabel: EVIL, answered: true, answer: EVIL },
    { kind: 'acknowledge', submitLabel: EVIL },
    { kind: 'text', prompt: EVIL, defaultValue: EVIL },
    { kind: 'text', answered: true, answer: EVIL },
    { kind: 'file', prompt: EVIL, accept: [EVIL], submitLabel: EVIL },
    { kind: 'file', answered: true, answer: EVIL, file: { name: EVIL, url: `https://x/"><img src=x onerror=alert(1)>` } },
    { kind: 'lens', prompt: EVIL, lens: { lens: 'series', title: EVIL, spec: { prefix: EVIL, suffix: EVIL }, data: { points: [{ t: 1, value: 2, label: EVIL }] } } },
    { kind: 'lens', lens: { lens: 'timeline', title: EVIL, data: { events: [{ id: '1', t: 1, label: EVIL, group: EVIL, note: EVIL }] } } },
    { kind: 'lens', lens: { lens: 'treemap', data: { name: EVIL, children: [{ name: EVIL, value: 1 }] } } },
    { kind: 'lens', lens: { lens: 'flow', title: EVIL, data: { nodes: [{ id: EVIL, label: EVIL }], links: [{ source: EVIL, target: EVIL, value: 1 }] } } },
    { kind: 'lens', lens: { lens: 'matrix', title: EVIL, data: { rows: [EVIL], cols: [EVIL], values: [[1]] } } },
    { kind: 'graph', graph: { title: EVIL, view: { nodes: [{ id: EVIL, label: EVIL }], edges: [{ id: 'e', from: EVIL, to: EVIL, label: EVIL }] } } },
  ];
  for (const ui of kinds) {
    const h = widget({ id: EVIL, text: 'x', ui });
    clean(h);
    assert.match(h, /data-widget="&lt;img src=x onerror=alert\(1\)&gt;&quot;&#39;&amp;"/, ui.kind);
  }
});
ok('a visualize call\'s line carries its chart; anything else is no chart', () => {
  const output = JSON.stringify({ ok: true, lens: 'series', data: { points: [{ t: 1, value: 2 }] }, ui: { kind: 'lens', prompt: 'Sales', lens: { lens: 'series', data: { points: [{ t: 1, value: 2 }] }, title: 'Sales' } } });
  assert.equal(toolUi({ name: 'visualize', ok: true, output }).lens.title, 'Sales');
  assert.equal(toolUi({ name: 'visualize', ok: false, output }), null);
  assert.equal(toolUi({ name: 'read_drive_file', ok: true, output }), null);
  assert.equal(toolUi({ name: 'visualize', ok: true, output: '{"ok":true,"lens":"series"' }), null, 'a truncated output');
});
ok('a streaming message hides its cagi-ask block, closed or still open', () => {
  assert.equal(stripAsk('Pick one.\n\n```cagi-ask\n{"kind":"confirm"}\n```'), 'Pick one.');
  assert.equal(stripAsk('Pick one.\n```cagi-ask\n{"kind":"sel'), 'Pick one.');
  assert.equal(stripAsk('Plain words.'), 'Plain words.');
});
ok('which kinds ask; an answer in words', () => {
  assert.deepEqual(['select', 'multiselect', 'slider', 'confirm', 'acknowledge', 'text', 'file', 'lens', 'graph'].map(k => answerable({ kind: k })), [true, true, true, true, true, true, true, false, false]);
  assert.equal(answerText({ kind: 'select', options: PRICE.options, answer: '18' }), '$18 a mug');
  assert.equal(answerText({ kind: 'select', options: PRICE.options, answer: 'my own words' }), 'my own words');
});
console.log(`${n} passed`);
