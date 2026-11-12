// Storefront: how the store looks and what it says. The founder picks a template (the layout) and a style (the look)
// from live previews of their own store, edits the words once, and publishes. The choice and the words are the
// business's storefront.json (lib/storefront-design.js); switching either keeps every word, product and picture.
import { publishStorefront } from '/lib/business.js';
import { readStorefront, writeStorefront, storefrontPreview, storefrontUrl } from '/lib/storefront.js';
import { TEMPLATES, STYLES, newStorefrontSource, readStorefrontSource } from '/lib/storefront-design.js';
import { $, $$, esc, icon, toast, oops, busy } from '/lib/ui.js';
import { head, section, productsOf } from './_shared.js';

const FRAME_W = 1280, FRAME_H = 960;
const LISTS = {
  points: { title: 'Highlights', hint: 'Three short reasons to buy, or what is inside.', a: ['title', 'Title'], b: ['text', 'One line about it'], add: 'Add a highlight' },
  faq: { title: 'Questions', hint: 'What buyers ask before they pay.', a: ['q', 'Question'], b: ['a', 'Answer'], add: 'Add a question' },
  testimonials: { title: 'What customers say', hint: 'Real customers\' words only. The section stays hidden until you add one.', a: ['quote', 'Their words'], b: ['name', 'Their name'], add: 'Add a quote' },
};
const TOGGLES = [['how', 'How it works'], ['about', 'About'], ['points', 'Highlights'], ['faq', 'Questions'], ['testimonials', 'What customers say']];

export async function render(ctx) {
  const { biz, el, actions } = ctx;
  const [saved, products] = await Promise.all([readStorefront(biz), productsOf(biz)]);
  // The file as it is, with every field the form edits; a business with none yet starts from the default for its kind.
  const fresh = newStorefrontSource(biz, products);
  const doc = { ...fresh, ...(saved ?? {}), copy: { ...fresh.copy, ...(saved?.copy ?? {}) }, sections: { ...fresh.sections, ...(saved?.sections ?? {}) } };
  const shown = readStorefrontSource(doc, biz, products);
  doc.template = shown.template; doc.style = shown.style;
  if (typeof doc.copy.about !== 'object' || !doc.copy.about) doc.copy.about = { title: '', text: String(doc.copy.about ?? '') };
  for (const k of Object.keys(LISTS)) if (!Array.isArray(doc.copy[k])) doc.copy[k] = [];
  let dirty = !saved, width = innerWidth < 720 ? 390 : 1280;
  const url = storefrontUrl(biz);

  actions.innerHTML = `${url ? `<a class="btn sm quiet" href="${esc(url)}" target="_blank" rel="noopener">${icon('external', 14)} Open</a>` : ''}<button type="button" class="btn sm primary" id="sf-publish">Publish</button>`;
  const tile = (kind, x) => `<button type="button" class="sf-tile" data-${kind}="${x.id}" aria-pressed="${doc[kind] === x.id}"><span class="sf-frame"><iframe title="${esc(x.name)} preview" sandbox="allow-same-origin" loading="lazy" tabindex="-1" aria-hidden="true"></iframe></span><b>${esc(x.name)}</b><small>${esc(x.about)}</small></button>`;
  const field = (name, label, value, { area = false, hint = '', placeholder = '' } = {}) => `<label class="field"><span>${esc(label)}</span>${area ? `<textarea data-copy="${name}" rows="4" placeholder="${esc(placeholder)}">${esc(value)}</textarea>` : `<input data-copy="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}">`}${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
  const listRows = k => doc.copy[k].map((x, i) => `<div class="sf-row"><input data-list="${k}" data-i="${i}" data-k="${LISTS[k].a[0]}" value="${esc(x?.[LISTS[k].a[0]] ?? '')}" placeholder="${esc(LISTS[k].a[1])}" aria-label="${esc(LISTS[k].a[1])}"><input data-list="${k}" data-i="${i}" data-k="${LISTS[k].b[0]}" value="${esc(x?.[LISTS[k].b[0]] ?? '')}" placeholder="${esc(LISTS[k].b[1])}" aria-label="${esc(LISTS[k].b[1])}"><button type="button" class="btn icon" data-drop="${k}" data-i="${i}" aria-label="Remove" data-tip="Remove">${icon('trash')}</button></div>`).join('');
  const listHtml = k => `<div class="field sf-list" data-list-of="${k}"><span>${esc(LISTS[k].title)}</span><small>${esc(LISTS[k].hint)}</small><div class="sf-rows">${listRows(k)}</div><div><button type="button" class="btn sm quiet" data-add="${k}">${icon('plus', 14)} ${esc(LISTS[k].add)}</button></div></div>`;

  el.innerHTML = head('Storefront', `How ${biz.name}'s store looks and what it says. Pick a layout and a style, edit the words, then publish.`)
    + (biz.site?.id ? '' : `<div class="note warn">${esc(biz.gaps?.find(g => g.what === 'site')?.why ?? 'The storefront was not created yet.')} You can still choose: the choice is kept for when it is.</div>`)
    + section('Layout', `<div class="sf-grid" id="sf-templates">${TEMPLATES.map(t => tile('template', t)).join('')}</div>`)
    + section('Style', `<div class="sf-grid" id="sf-styles">${STYLES.map(s => tile('style', s)).join('')}</div>`)
    + section('Preview', `<div class="sf-preview" id="sf-preview"><span class="sf-frame"><iframe title="Storefront preview" sandbox="allow-same-origin"></iframe></span></div><p class="hint" id="sf-state"></p>`, `<button type="button" class="btn sm quiet" data-width="390" aria-pressed="false">Phone</button><button type="button" class="btn sm quiet" data-width="1280" aria-pressed="true">Desktop</button>`)
    + section('Words', `<form class="panel stack" id="sf-words" autocomplete="off">
        ${field('headline', 'Headline', doc.copy.headline, { placeholder: biz.tagline ?? biz.name, hint: 'Empty shows your tagline.' })}
        ${field('subhead', 'Under the headline', doc.copy.subhead, { area: true, placeholder: biz.idea ?? '' })}
        <div class="sf-two">${field('kicker', 'Small label over the headline', doc.copy.kicker, { placeholder: TEMPLATES.find(t => t.id === doc.template)?.kicker })}${field('cta', 'Main button', doc.copy.cta, { placeholder: TEMPLATES.find(t => t.id === doc.template)?.cta })}</div>
        <div class="sf-two">${field('productsTitle', 'Title over the products', doc.copy.productsTitle, { placeholder: TEMPLATES.find(t => t.id === doc.template)?.productsTitle })}${field('announcement', 'Announcement bar', doc.copy.announcement, { placeholder: 'Free shipping this week', hint: 'A line above the header. Empty hides it.' })}</div>
        ${field('about.title', 'About: title', doc.copy.about.title, { placeholder: `About ${biz.name}` })}
        ${field('about.text', 'About: your story', doc.copy.about.text, { area: true, hint: 'Hidden until you write it. An empty line starts a new paragraph.' })}
        ${Object.keys(LISTS).map(listHtml).join('')}
        <div class="field"><span>Sections</span><div class="sf-toggles">${TOGGLES.map(([k, l]) => `<label class="switch"><input type="checkbox" data-section="${k}" ${doc.sections[k] !== false ? 'checked' : ''}><i></i><span>${esc(l)}</span></label>`).join('')}</div><small>A section with no words stays hidden.</small></div>
      </form>`)
    + `<div class="row"><button type="button" class="btn primary" id="sf-publish-2">Publish the storefront</button><span class="hint">Your products, pictures and words stay as they are when you switch a layout or a style.</span></div>`;

  // Each preview frame is a full-width page, scaled to its tile.
  const fit = new ResizeObserver(entries => { for (const e of entries) { const w = Number(e.target.dataset.w ?? FRAME_W); e.target.style.setProperty('--k', String(Math.min(1, e.contentRect.width / w))); } });
  $$('.sf-frame', el).forEach(f => fit.observe(f));
  const html = over => storefrontPreview(biz, products, { ...doc, ...over });
  const paintTiles = () => {
    for (const b of $$('[data-template]', el)) { $('iframe', b).srcdoc = html({ template: b.dataset.template }); b.setAttribute('aria-pressed', String(doc.template === b.dataset.template)); }
    for (const b of $$('[data-style]', el)) { $('iframe', b).srcdoc = html({ style: b.dataset.style }); b.setAttribute('aria-pressed', String(doc.style === b.dataset.style)); }
  };
  const paintPreview = () => {
    const frame = $('#sf-preview .sf-frame', el);
    frame.dataset.w = String(width); frame.style.setProperty('--w', `${width}px`);
    frame.style.setProperty('--k', String(Math.min(1, frame.clientWidth / width)));
    $('iframe', frame).srcdoc = html({});
    $('#sf-preview', el).dataset.width = String(width);
    for (const b of $$('[data-width]', el)) b.setAttribute('aria-pressed', String(Number(b.dataset.width) === width));
    const t = TEMPLATES.find(x => x.id === doc.template), s = STYLES.find(x => x.id === doc.style);
    $('#sf-state', el).textContent = `${t.name} layout, ${s.name} style.${dirty ? ' Not published yet.' : ' This is what is live.'}`;
  };
  let later = null;
  const changed = ({ tiles = false } = {}) => {
    dirty = true;
    clearTimeout(later);
    later = setTimeout(() => { paintPreview(); if (tiles) paintTiles(); }, tiles ? 0 : 250);
  };
  paintTiles(); paintPreview();

  el.addEventListener('click', e => {
    const pick = e.target.closest('[data-template],[data-style]');
    if (pick) { if (pick.dataset.template) doc.template = pick.dataset.template; else doc.style = pick.dataset.style; return changed({ tiles: true }); }
    const w = e.target.closest('[data-width]');
    if (w) { width = Number(w.dataset.width); return paintPreview(); }
    const add = e.target.closest('[data-add]');
    if (add) { const k = add.dataset.add; doc.copy[k].push({}); $(`[data-list-of="${k}"] .sf-rows`, el).innerHTML = listRows(k); $(`[data-list-of="${k}"] .sf-row:last-child input`, el)?.focus(); return; }
    const drop = e.target.closest('[data-drop]');
    if (drop) { const k = drop.dataset.drop; doc.copy[k].splice(Number(drop.dataset.i), 1); $(`[data-list-of="${k}"] .sf-rows`, el).innerHTML = listRows(k); return changed(); }
  });
  $('#sf-words', el).addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.copy) { const [a, b] = t.dataset.copy.split('.'); if (b) doc.copy[a][b] = t.value; else doc.copy[a] = t.value; }
    else if (t.dataset.list) { const row = doc.copy[t.dataset.list][Number(t.dataset.i)] ??= {}; row[t.dataset.k] = t.value; }
    else if (t.dataset.section) doc.sections[t.dataset.section] = t.checked;
    changed();
  });
  $('#sf-words', el).addEventListener('submit', e => e.preventDefault());
  // The tiles show the words too: they follow once a field is left.
  $('#sf-words', el).addEventListener('change', () => paintTiles());

  const publish = button => busy(button, async () => {
    try {
      // The file keeps only rows with words.
      for (const k of Object.keys(LISTS)) doc.copy[k] = doc.copy[k].filter(x => Object.values(x ?? {}).some(v => String(v ?? '').trim()));
      await writeStorefront(biz, doc);
      if (!biz.site?.id) { dirty = false; paintPreview(); return toast('Saved. It is used when the storefront is made.', 'ok'); }
      await publishStorefront(biz);
      ctx.setBiz(biz);
      dirty = false; paintPreview();
      toast(`Storefront published to ${storefrontUrl(biz) || 'the site'}.`, 'ok');
    } catch (e) { toast(oops(e), 'bad'); }
  });
  $('#sf-publish', actions).onclick = e => publish(e.currentTarget);
  $('#sf-publish-2', el).onclick = e => publish(e.currentTarget);
  return () => { fit.disconnect(); clearTimeout(later); };
}
