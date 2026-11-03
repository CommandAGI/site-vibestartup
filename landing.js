// The landing: the header's scroll line and phone menu, the example chips, and the sketch that grows under the idea
// box. The sketch is made here by a script (lib/business.js's suggestions and brandFor), and nothing is sent.
import { IDEA_STARTERS, suggestNames, suggestTagline, suggestProduct, brandFor, markSvg, COFOUNDER_NAMES } from '/lib/business.js';
import { $, $$, esc } from '/lib/ui.js';
import { signedIn } from '/lib/api.js';

const head = $('#head');
addEventListener('scroll', () => head.classList.toggle('scrolled', scrollY > 8), { passive: true });
const menuBtn = $('#menu-btn'), menu = $('#top-menu');
menuBtn.onclick = () => { const open = menu.hidden; menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); };
$$('a', menu).forEach(a => a.addEventListener('click', () => { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); }));
if (signedIn()) { const s = $('#signin-link'); s.textContent = 'Your businesses'; s.href = '/home/'; }

const idea = $('#idea'), sketch = $('#sketch'), start = $('#start'), count = $('#idea-count');
$('#chips').innerHTML = IDEA_STARTERS.slice(0, 6).map(s => `<button type="button" class="chip">${esc(s)}</button>`).join('');
$$('#chips .chip').forEach(c => c.onclick = () => { idea.value = c.textContent; idea.focus(); render(); });

const COF_LINES = [
  'Who buys the first one? Name three people, and we start there.',
  'One product first. A catalogue can wait.',
  'What does the first version look like: a demo, a pre-order, or a download?',
  'Who makes it? Sourcing stays with you, or we sell it as a pre-order.',
];
let timer = null;
function render() {
  const text = idea.value.trim();
  count.textContent = text ? `${text.length} / 240` : '';
  if (text.length < 8) {
    sketch.hidden = true;
    start.textContent = 'Start building';
    start.href = text ? `/start/?idea=${encodeURIComponent(text)}` : '/start/';
    return;
  }
  const name = suggestNames(text)[0] || 'Your business';
  const brand = brandFor(name, 'clean', 'casual');
  const product = suggestProduct(text);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const cof = COFOUNDER_NAMES[text.length % COFOUNDER_NAMES.length];
  sketch.classList.add('inking');
  sketch.hidden = false;
  $('[data-f=name]', sketch).textContent = name;
  $('[data-f=tagline]', sketch).textContent = suggestTagline(text);
  $('[data-f=mark]', sketch).innerHTML = markSvg(name, brand);
  $('[data-f=swatches]', sketch).innerHTML = [brand.primary, brand.secondary, brand.accent].map(c => `<i style="background:${esc(c)}" title="${esc(c)}"></i>`).join('');
  $('[data-f=product]', sketch).textContent = product;
  $('[data-f=url]', sketch).textContent = `${slug || 'your-business'}.commandagi.app`;
  $('[data-f=cof-initial]', sketch).textContent = cof[0];
  $('[data-f=cof-line]', sketch).textContent = `${cof}: ${COF_LINES[text.length % COF_LINES.length]}`;
  start.textContent = `Start building ${name}`;
  start.href = `/start/?idea=${encodeURIComponent(text)}`;
  requestAnimationFrame(() => requestAnimationFrame(() => sketch.classList.remove('inking')));
}
idea.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 180); });
$('#idea-form').addEventListener('submit', e => { e.preventDefault(); location.href = start.href; });
idea.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); render(); location.href = start.href; } });
render();
