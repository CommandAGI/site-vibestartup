// Studio: make (pictures from a description, through CommandAGI's generate route), this month's budget, the library,
// the brand book and the formats with their credit ranges.
import { drive, generate } from '/lib/api.js';
import { folderOf, readBizJson } from '/lib/business.js';
import { $, $$, esc, icon, toast, oops, busy, ago, bytes } from '/lib/ui.js';
import { head, section, productsOf, settingsOf, writeSettings, empty, iconBtn, bars } from './_shared.js';

const FORMATS = [
  { id: 'offer', name: 'Offer image', about: 'A branded image with your offer, sized for every placement.', sizes: '9:16, 4:5, 1:1, 2:3, 1.91:1', takes: 'about a minute', low: 3, high: 5, ready: true },
  { id: 'image', name: 'Image', about: 'One image from a description. Your brand only if you ask for it.', sizes: '4:5, 1:1, 9:16, 16:9', takes: 'under a minute', low: 2, high: 4, ready: true },
  { id: 'short', name: 'Short video', about: 'Six to ten seconds, vertical, captions burned in.', sizes: '9:16, 4:5, 1:1', takes: 'about 4 minutes', low: 60, high: 110, ready: false },
  { id: 'clip', name: 'Clip', about: 'A four to eight second clip from a description or a still.', sizes: '9:16, 1:1', takes: 'about 3 minutes', low: 45, high: 80, ready: false },
  { id: 'presenter', name: 'Presenter ad', about: 'Fifteen seconds, a presenter reading your script word for word.', sizes: '9:16, 4:5, 1:1', takes: 'about 6 minutes', low: 20, high: 25, ready: false },
  { id: 'film', name: 'Launch film', about: 'Twenty to thirty seconds, built around your real photos.', sizes: '9:16, 4:5, 1:1, 16:9', takes: 'about 12 minutes', low: 50, high: 60, ready: false },
];
const LOOKS = ['Up to you', 'Clean studio', 'In place', 'Bold type', 'Sunlit'];
const VIEWS = [['make', 'Make'], ['month', 'This month'], ['library', 'Library'], ['brand', 'Brand book'], ['formats', 'Formats']];

export async function render(ctx) {
  const { biz, el } = ctx;
  const hp = new URLSearchParams(location.hash.replace(/^#/, ''));
  const qp = new URLSearchParams(location.search);
  const state = { view: hp.get('view') || qp.get('view') || 'make', format: 'offer', look: LOOKS[0], count: 2 };
  const studioPath = `${folderOf(biz.slug)}/studio`;
  const paint = async () => {
    el.innerHTML = head('Studio', 'Everything your co-founder makes for you, and everything you make yourself.')
      + `<div class="subtabs" id="studio-tabs">${VIEWS.map(([id, l]) => `<button type="button" data-view="${id}" aria-pressed="${state.view === id}">${l}</button>`).join('')}</div><div id="studio-view">${bars(1)}</div>`;
    $$('[data-view]', el).forEach(b => b.onclick = () => { state.view = b.dataset.view; paint(); });
    const v = $('#studio-view', el);
    if (state.view === 'make') await make(v); else if (state.view === 'month') await month(v); else if (state.view === 'library') await library(v); else if (state.view === 'brand') await brand(v); else formats(v);
  };
  const make = async v => {
    const products = await productsOf(biz);
    const f = FORMATS.find(x => x.id === state.format);
    v.innerHTML = `<form id="make" class="panel stack"><div class="grid-2"><label class="field"><span>Format</span><select id="make-format">${FORMATS.map(x => `<option value="${x.id}" ${x.id === state.format ? 'selected' : ''}>${x.name}${x.ready ? '' : ' (not yet)'}</option>`).join('')}</select><small>${esc(f.about)} ${esc(f.sizes)}.</small></label><label class="field"><span>Which product</span><select id="make-product"><option value="">None in particular</option>${products.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label></div><label class="field"><span>Describe it</span><textarea id="make-prompt" rows="3" placeholder="A ${esc(biz.name)} offer image: the product on a clean table, warm light, the price in the corner"></textarea></label><div class="field"><span>Look</span><div class="row">${LOOKS.map(l => `<button type="button" class="chip" data-look="${esc(l)}" aria-pressed="${state.look === l}">${esc(l)}</button>`).join('')}</div></div><div class="row"><label class="field" style="width:120px"><span>How many</span><input id="make-count" type="number" min="1" max="4" value="${state.count}"></label><label class="field grow"><span>Reference files</span><input type="file" id="make-refs" multiple accept="image/*"><small>Kept in your library; the model sees the description.</small></label></div><p class="muted">Credits: a range, not a price. About ${f.low}–${f.high} each: you pay for what comes back clean.</p><div class="row"><button class="btn primary" type="submit" id="make-go" ${f.ready ? '' : 'disabled'}>${f.ready ? 'Make it' : 'Not available on this stack yet'}</button></div><div id="make-out" class="grid-auto"></div></form>`;
    $('#make-format', v).onchange = e => { state.format = e.target.value; make(v); };
    $$('[data-look]', v).forEach(b => b.onclick = () => { state.look = b.dataset.look; $$('[data-look]', v).forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    $('#make', v).onsubmit = async e => {
      e.preventDefault();
      const prompt = $('#make-prompt', v).value.trim(); if (!prompt) return toast('Describe what to make.', 'bad');
      const count = Math.max(1, Math.min(4, Number($('#make-count', v).value) || 1)); state.count = count;
      const refs = $('#make-refs', v).files;
      for (const r of refs) await drive.write(studioPath, r.name, r, r.type).catch(() => null);
      const out = $('#make-out', v); out.innerHTML = '';
      await busy($('#make-go', v), async () => {
        for (let i = 0; i < count; i++) {
          try {
            const full = `${prompt}. ${state.look !== 'Up to you' ? `Look: ${state.look}. ` : ''}Brand colours ${biz.brand?.primary}, ${biz.brand?.secondary}. ${f.id === 'offer' ? 'An offer image for a storefront, product centred, room for a short line of text.' : ''}`;
            const r = await generate({ modelId: 'text-to-image.flux-schnell', inputs: { prompt: full }, name: `${f.id}-${Date.now().toString(36)}-${i + 1}.png`, path: studioPath });
            const file = r.file ?? r;
            const url = file?.id ? await drive.blobUrl(file.id) : null;
            out.insertAdjacentHTML('beforeend', `<div class="piece card">${url ? `<img src="${url}" alt="">` : ''}<b>${esc(file?.name ?? 'made')}</b><small class="hint">in your library</small></div>`);
          } catch (err) { out.insertAdjacentHTML('beforeend', `<div class="note warn">${esc(err.code === 'generate_unavailable' ? 'Image generation is not configured on this stack yet. Nothing was charged.' : oops(err))}</div>`); break; }
        }
        ctx.refreshCredits();
      });
    };
  };
  const month = async v => {
    const s = await settingsOf(biz);
    v.innerHTML = `<div class="panel stack"><h3>This month</h3><p class="muted">A monthly creative budget keeps your feed and your ad account stocked. It is a budget you set: nothing is charged until something is made.</p><form id="budget" class="row"><label class="field"><span>Monthly creative budget (credits)</span><input name="budget" type="number" min="0" value="${esc(String(s.creativeBudget ?? 0))}"></label><button class="btn quiet" type="submit" style="align-self:end">Set a budget</button></form><p class="hint">Made this month: see the library. Spent: your credit history in Billing.</p></div>`;
    $('#budget', v).onsubmit = async e => { e.preventDefault(); s.creativeBudget = Number(e.target.budget.value) || 0; try { await writeSettings(biz, s); toast('Budget set.', 'ok'); } catch (err) { toast(oops(err), 'bad'); } };
  };
  const library = async v => {
    const files = (await drive.list(studioPath).catch(() => [])).filter(f => f.type !== 'folder').sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0));
    v.innerHTML = files.length ? `<div class="grid-auto" id="library">${files.map(f => `<div class="piece card" data-id="${esc(f.id)}"><div class="pic"></div><b>${esc(f.name)}</b><small class="hint">${esc(ago(f.updatedAt ?? f.createdAt ?? Date.now()))}${f.size ? ` · ${esc(bytes(f.size))}` : ''}</small><div class="row">${iconBtn('download', 'Download', 'data-download')}</div></div>`).join('')}</div>` : `<div id="library">${empty('Nothing made yet', 'Make something, or ask your co-founder for an offer image.', '<button type="button" class="btn quiet" data-press="#studio-tabs [data-view=make]">Make something</button>')}</div>`;
    for (const p of $$('.piece', v)) {
      const f = files.find(x => x.id === p.dataset.id);
      if (/^image\//.test(f.contentType ?? '')) { const url = await drive.blobUrl(f.id); if (url) $('.pic', p).innerHTML = `<img src="${url}" alt="">`; }
      $('[data-download]', p).onclick = async () => { const url = await drive.blobUrl(f.id); if (!url) return toast('Could not read the file.', 'bad'); const a = document.createElement('a'); a.href = url; a.download = f.name; a.click(); };
    }
  };
  const brand = async v => {
    const b = (await readBizJson(biz.slug, 'brand/brand-book.json', null)) ?? biz.brand ?? {};
    const logo = await drive.find(`${folderOf(biz.slug)}/brand`, 'logo.svg').catch(() => null);
    const logoUrl = logo ? await drive.blobUrl(logo.id) : null;
    v.innerHTML = `<div id="brand-book" class="grid-2"><div class="panel stack"><h3>Colours</h3><div class="row">${['primary', 'secondary', 'accent', 'ground', 'ink'].map(k => `<div class="stack" style="gap:4px;text-align:center"><i style="display:block;width:56px;height:56px;border:1px solid var(--line);background:${esc(b[k] ?? '#ccc')}"></i><small class="hint">${k}</small></div>`).join('')}</div><h3>Type</h3><p class="muted">${esc(b.type ?? '')}</p><h3>Voice</h3><p class="muted">${esc((b.voice ?? []).join(', '))}</p><p class="hint">${esc(b.generated ? 'Generated ' + b.generated + '. Ask your co-founder for a designed kit.' : '')}</p></div><div class="panel stack"><h3>Logo</h3>${logoUrl ? `<img src="${logoUrl}" alt="${esc(biz.name)} mark" width="96" height="96">` : '<p class="muted">No logo file yet.</p>'}<p class="hint">brand/logo.svg in your files.</p></div></div>`;
  };
  const formats = v => {
    v.innerHTML = `<p class="muted" style="margin-bottom:12px">A range, not a price: you pay for what comes back clean.</p><div class="grid-auto">${FORMATS.map(f => `<div class="card stack"><h4>${esc(f.name)} ${f.ready ? '' : '<span class="badge warn">not yet</span>'}</h4><p class="small muted">${esc(f.about)}</p><p class="hint">${esc(f.sizes)} · ${esc(f.takes)} · ${f.low}–${f.high} credits</p></div>`).join('')}</div>`;
  };
  await paint();
}
