// Legal: company formation, proposed only at traction (about three real sales or $100 of revenue), the storefront's
// terms and privacy pages, and the document library: starter templates filled from the business record, previewed
// live, downloaded as a PDF made in the browser (lib/pdf.js), saved into the business's legal/ folder, and for the
// storefront's three, written there as HTML pages the storefront's publish picks up (lib/legal-docs.js).
import { bizDrive, markSvg } from '/lib/business.js';
import { $, $$, esc, icon, money, toast, oops, busy, soonButton } from '/lib/ui.js';
import { head, section, ordersOf, realSales, askLink, settingsOf, notifyChip, bindNotify } from './_shared.js';
import { renderPdf } from '/lib/pdf.js';
import { storefrontUrl } from '/lib/storefront.js';
import { TEMPLATES, FIELDS, US_STATES, defaults, fill, missing, blocksToHtml, storefrontPage } from '/lib/legal-docs.js';

const CSS = `
.legal-lib{border:1px solid var(--line);background:var(--surface);overflow:hidden;margin-bottom:20px}
.legal-lib>div{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));margin:0 -1px -1px 0}
.legal-lib button{display:grid;align-content:start;gap:3px;min-height:64px;padding:12px 14px;border:0;border-right:1px solid var(--line);border-bottom:1px solid var(--line);background:transparent;color:var(--ink);text-align:left;font:inherit;cursor:pointer;transition:background .16s var(--ease)}
.legal-lib button:hover{background:var(--surface-2)}
.legal-lib button[aria-pressed="true"]{background:var(--accent-soft);box-shadow:inset 2px 0 0 var(--accent)}
.legal-lib b{display:flex;align-items:center;gap:6px;font-weight:600;font-size:14px}
.legal-lib small{color:var(--ink-2);font-size:13px;line-height:1.35}
.legal-edit{display:grid;grid-template-columns:minmax(0,340px) minmax(0,1fr);gap:16px;align-items:start}
.legal-edit form{padding:16px}
.legal-edit .field input,.legal-edit .field select,.legal-edit .field textarea{font-size:14px}
.legal-acts{display:grid;gap:8px;margin-top:4px}
.legal-paper{--brand:#333;background:#fff;color:#17161a;border:1px solid var(--line);padding:0 40px 40px;font-family:'Times New Roman',Times,Georgia,serif;font-size:13px;line-height:1.5;max-height:calc(100vh - 120px);overflow:auto;position:sticky;top:72px;border-top:5px solid var(--brand)}
.legal-paper .paper-head{display:flex;align-items:center;gap:10px;padding:18px 0 14px;border-bottom:1px solid #e3e1dc;margin-bottom:28px}
.legal-paper .paper-head img{width:24px;height:24px}
.legal-paper .paper-head b{font-size:13px}
.legal-paper .paper-head span{margin-left:auto;color:#5f5c66;font-size:11px;text-align:right}
.legal-paper h1{font-size:26px;letter-spacing:-.02em;line-height:1.15;margin:0 0 4px;color:#17161a}
.legal-paper .sub{color:#5f5c66;margin:0 0 20px}
.legal-paper h2{font-size:15px;margin:22px 0 4px;color:#17161a}
.legal-paper h3{font-size:13px;margin:14px 0 2px;color:#17161a}
.legal-paper p{margin:0 0 8px}
.legal-paper .muted{color:#5f5c66}
.legal-paper ul,.legal-paper ol{margin:0 0 10px;padding-left:20px}
.legal-paper li{margin-bottom:3px}
.legal-paper ul li::marker{color:var(--brand)}
.legal-paper ul.checks{list-style:none;padding-left:0}
.legal-paper ul.checks li{position:relative;padding-left:22px;margin-bottom:6px}
.legal-paper ul.checks li::before{content:"";position:absolute;left:1px;top:3px;width:10px;height:10px;border:1.2px solid var(--brand)}
.legal-paper .parties,.legal-paper .signs{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:0 0 16px}
.legal-paper small{display:block;color:var(--brand);font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}
.legal-paper .parties div div+div{color:#5f5c66}
.legal-paper .kv{display:grid;grid-template-columns:120px 1fr;gap:2px 8px;margin:0 0 14px}
.legal-paper dt{color:#5f5c66;font-size:12px}.legal-paper dd{margin:0}
.legal-paper .doc-table{overflow-x:auto;margin:0 0 14px}
.legal-paper table{width:100%;border-collapse:collapse;font-size:12px}
.legal-paper th{background:color-mix(in srgb,var(--brand) 9%,#fff);text-align:left;padding:7px 6px}
.legal-paper td{padding:7px 6px;border-bottom:1px solid #e3e1dc;vertical-align:top}
.legal-paper .r{text-align:right}
.legal-paper tfoot td{border:0}.legal-paper tfoot .strong td{font-weight:700;font-size:14px;background:color-mix(in srgb,var(--brand) 9%,#fff)}
.legal-paper .doc-note{padding:10px 14px;background:color-mix(in srgb,var(--brand) 9%,#fff);box-shadow:inset 3px 0 0 var(--brand)}
.legal-paper .signs p{display:flex;gap:8px;align-items:end;color:#5f5c66;font-size:11px;margin:14px 0 0}
.legal-paper .signs i{flex:1;border-bottom:1px solid #8e8a93;font-style:normal;color:#17161a;font-size:13px;min-height:18px}
@media (max-width:900px){.legal-edit{grid-template-columns:1fr}.legal-paper{position:static;max-height:none}}
@media (max-width:760px){.legal-paper{padding:0 16px 24px}.legal-paper .parties,.legal-paper .signs{grid-template-columns:1fr}}
`;

// The founder's choice and field values survive a visit to another tab.
let chosen = 'terms';

export async function render(ctx) {
  const { biz, el, founder } = ctx;
  const legalDir = 'legal', drive = bizDrive(biz);
  const [orders, saved, logoText] = await Promise.all([
    ordersOf(biz),
    drive.readPath(legalDir, 'fields.json').then(t => (t ? JSON.parse(t) : {})).catch(() => ({})),
    drive.readPath('brand', 'logo.svg').catch(() => null),
  ]);
  const s = realSales(orders);
  const settings = await settingsOf(biz).catch(() => ({}));
  const ready = s.count >= 3 || s.revenue >= 100;
  el.innerHTML = head('Legal', 'Formation, the pages your storefront needs, and documents you can fill in and download.')
    + section('Company formation', `<div id="formation" class="panel stack"><div class="row"><span class="badge ${ready ? 'ok' : ''}">${ready ? 'ready to propose' : 'not yet'}</span><span class="muted">Proposed when the business has traction: about three real sales or $100 of revenue, because formation costs recur.</span></div><div class="grid-2"><div class="kpi"><b>${esc(String(s.count))}</b><span>real sales</span><small>of 3</small></div><div class="kpi"><b>${esc(money(s.revenue))}</b><span>revenue</span><small>of $100</small></div></div><p class="muted">${ready ? `Your co-founder can now propose a formation through Charter House (CommandAGI's formation service): ${askLink('Propose the company formation now: what entity, where, what it costs, and what I sign.', 'ask for the proposal')}.` : `Want it sooner? ${askLink('I want to form the company before traction. Propose it: what entity, where, what it costs, and what I sign.', 'Ask your co-founder')}. Filing needs your signature and a fee; nothing is filed without them.`}</p>${s.test ? `<p class="hint">${s.test} test ${s.test === 1 ? 'order does' : 'orders do'} not count.</p>` : ''}<div class="row">${soonButton('File my company', 'btn primary', 'id="file-company"')}${notifyChip('company-filing', settings.notify?.['company-filing'])}</div></div>`)
    + section('The storefront\'s pages', biz.site?.url ? `<div id="legal-pages" class="row">${[['terms', 'Terms'], ['privacy', 'Privacy'], ['refunds', 'Refunds']].map(([f, l]) => `<a class="btn quiet" href="${esc(storefrontUrl(biz))}/${f}.html" target="_blank" rel="noopener">${icon('external', 14)} ${l}</a>`).join('')}</div><p class="hint" style="margin-top:8px">Terms of sale, privacy and refunds written for a small online shop. A document below that you put on your storefront replaces its page at the next publish.</p>` : '<div id="legal-pages" class="note">No storefront yet, so no pages.</div>')
    + section('Documents', `<style>${CSS}</style><div id="legal-docs"><div class="legal-lib"><div role="group" aria-label="Templates">${TEMPLATES.map(t => `<button type="button" data-doc="${t.id}" aria-pressed="${t.id === chosen}"><b>${esc(t.title)}${t.storefront ? ' <span class="badge">storefront</span>' : ''}</b><small>${esc(t.about)}</small></button>`).join('')}</div></div><div id="legal-editor" class="legal-edit"></div></div>`);
  bindNotify(el, biz);

  // The business's own values first (the record may have changed), then what the founder typed and saved.
  const base = defaults(biz, founder);
  const values = { ...base, ...Object.fromEntries(Object.entries(saved).filter(([, v]) => String(v ?? '').trim())) };
  const usesVectorMark = !logoText || logoText.trim() === markSvg(biz.name, biz.brand).trim();
  const logoSrc = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoText || markSvg(biz.name, biz.brand))}`;
  let logoJpeg = null; // a founder's own logo, rasterized once, for the PDF

  const editor = $('#legal-editor', el);
  const paint = () => {
    const t = TEMPLATES.find(x => x.id === chosen) ?? TEMPLATES[0];
    editor.innerHTML = `<form id="legal-form" class="panel stack" novalidate>${t.fields.map(fieldHtml(values)).join('')}<datalist id="us-states">${US_STATES.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <p id="legal-missing" class="hint"></p>
      <div class="legal-acts"><button type="button" id="legal-pdf" class="btn primary full">${icon('download', 16)} Download PDF</button><button type="button" id="legal-save" class="btn quiet full">${icon('files', 16)} Save to Files</button>${t.storefront ? `<button type="button" id="legal-use" class="btn quiet full">${icon('store', 16)} Use on my storefront</button>` : ''}</div>
      <p class="hint">Templates, not legal advice; have a lawyer review before you sign.</p><p id="legal-status" class="hint" role="status"></p></form>
      <div id="legal-preview" class="legal-paper" style="--brand:${esc(biz.brand?.primary ?? '#333')}" aria-label="Preview"></div>`;
    const preview = () => {
      const doc = fill(t, values);
      $('#legal-preview', el).innerHTML = `<div class="paper-head"><img src="${logoSrc}" alt=""><b>${esc(values.business || biz.name)}</b><span>${esc(doc.title)}</span></div><h1>${esc(doc.title)}</h1><p class="sub">${esc(doc.subtitle ?? '')}</p>${blocksToHtml(doc.blocks)}`;
      const gaps = missing(t, values);
      $('#legal-missing', el).textContent = gaps.length ? `Still to fill: ${gaps.map(k => FIELDS[k].label.toLowerCase()).join(', ')}. The preview shows each gap in brackets.` : '';
      return doc;
    };
    preview();
    let timer;
    $('#legal-form', el).oninput = e => { const k = e.target.dataset.field; if (!k) return; values[k] = e.target.value; clearTimeout(timer); timer = setTimeout(preview, 120); };
    $('#legal-form', el).onsubmit = e => e.preventDefault();

    const pdf = async () => {
      const doc = preview();
      if (!usesVectorMark && !logoJpeg) logoJpeg = await rasterize(logoSrc).catch(() => null);
      const bytes = renderPdf({ title: doc.title, subtitle: doc.subtitle, business: { name: values.business || biz.name }, brand: biz.brand, logo: logoJpeg, blocks: doc.blocks });
      return { doc, blob: new Blob([bytes], { type: 'application/pdf' }) };
    };
    // Only what the founder changed is kept: the rest follows the business record (and the date stays today's).
    const remember = () => drive.write(legalDir, 'fields.json', JSON.stringify(Object.fromEntries(Object.entries(values).filter(([k, v]) => v !== base[k])), null, 2) + '\n', 'application/json').catch(() => null);
    const status = text => { $('#legal-status', el).textContent = text; };
    $('#legal-pdf', el).onclick = e => busy(e.currentTarget, async () => {
      try {
        const { doc, blob } = await pdf();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${biz.slug}-${doc.file}`; document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        status(`Downloaded ${biz.slug}-${doc.file}.`);
        await ensureDir(drive, legalDir); remember();
      } catch (err) { toast(oops(err), 'bad'); }
    });
    $('#legal-save', el).onclick = e => busy(e.currentTarget, async () => {
      try {
        const { doc, blob } = await pdf();
        await ensureDir(drive, legalDir);
        await drive.write(legalDir, doc.file, blob, 'application/pdf');
        remember();
        status(`Saved to Files: legal/${doc.file}.`); toast('Saved to Files.', 'ok');
      } catch (err) { toast(oops(err), 'bad'); }
    });
    if (t.storefront) $('#legal-use', el).onclick = e => busy(e.currentTarget, async () => {
      try {
        const doc = preview();
        await ensureDir(drive, legalDir);
        await drive.write(legalDir, t.storefront, storefrontPage(doc, values.business || biz.name), 'text/html');
        remember();
        status(`Written to legal/${t.storefront}. Your storefront shows it from its next publish.`); toast('Ready for your storefront.', 'ok');
      } catch (err) { toast(oops(err), 'bad'); }
    });
  };
  $$('[data-doc]', el).forEach(b => b.onclick = () => {
    chosen = b.dataset.doc;
    $$('[data-doc]', el).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    paint();
    if (matchMedia('(max-width: 900px)').matches) editor.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  paint();
}

const fieldHtml = values => k => {
  const f = FIELDS[k], id = `legal-f-${k}`, v = values[k] ?? '';
  const control = f.type === 'textarea' ? `<textarea id="${id}" data-field="${k}" rows="3" placeholder="${esc(f.placeholder ?? '')}">${esc(v)}</textarea>`
    : f.type === 'select' ? `<select id="${id}" data-field="${k}">${f.options.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`
    : `<input id="${id}" data-field="${k}" type="${f.type ?? 'text'}" value="${esc(v)}" placeholder="${esc(f.placeholder ?? '')}"${f.list ? ` list="${f.list}"` : ''}${f.type === 'number' ? ' inputmode="decimal" min="0"' : ''}${f.type === 'email' ? ' autocomplete="off"' : ''}>`;
  return `<label class="field" for="${id}"><span>${esc(f.label)}${f.hint ? ` <small>${esc(f.hint)}</small>` : ''}</span>${control}</label>`;
};

const made = new Set();
async function ensureDir(drive, path) { const key = `${drive.org}:${path}`; if (made.has(key)) return; await drive.ensure(path); made.add(key); }

/** A founder's own SVG logo as a JPEG for the PDF (a PDF draws no SVG). */
async function rasterize(src, size = 240) {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.drawImage(img, 0, 0, size, size);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), width: size, height: size };
}
