// Files: the co-founder's memory and the business's folder as files, grouped; search, upload, preview, copy. A group's
// view (`#tab=files&view=<key>`, the last field of GROUPS; app/levels.js lists the same keys) shows that group alone.
import { drive } from '/lib/api.js';
import { folderOf } from '/lib/business.js';
import { $, $$, esc, icon, toast, copy, ago, bytes, oops } from '/lib/ui.js';
import { head, section, empty, iconBtn } from './_shared.js';

const GROUPS = [
  ['Identity', ['cofounder/SOUL.md', 'cofounder/BUSINESS.md', 'cofounder/OWNER.md'], 'its personality and voice, the business, the owner', 'identity'],
  ['Operations', ['cofounder/PLAYBOOK.md', 'cofounder/PLATFORM.md'], 'the playbook, the platform', 'operations'],
  ['Evolving', ['cofounder/MEMORY.md', 'cofounder/CODEMAP.md'], 'working memory, the code map', 'evolving'],
  ['Other', ['cofounder/SUPPORT.md', 'business.json', 'settings.json'], 'support, the record', 'other'],
  ['Creative assets', ['studio/', 'brand/'], 'everything made, and the brand', 'assets'],
];

export async function render(ctx) {
  const { biz, el, actions } = ctx;
  const root = folderOf(biz.slug);
  actions.innerHTML = `<label class="btn icon" for="file-upload" aria-label="Upload" data-tip="Upload">${icon('upload')}<input id="file-upload" type="file" hidden></label>`;
  const all = new Map();
  const walk = async (rel, depth = 0) => {
    const list = await drive.list(rel ? `${root}/${rel}` : root).catch(() => []);
    for (const f of list) {
      const path = rel ? `${rel}/${f.name}` : f.name;
      all.set(path, { ...f, rel: path, folder: f.type === 'folder' });
      if (f.type === 'folder' && depth < 2 && f.name !== 'Tasks') await walk(path, depth + 1);
    }
  };
  const state = { q: '', open: null };
  const paint = async () => {
    all.clear(); await walk('');
    const files = [...all.values()].filter(f => !f.folder);
    let matches = files;
    if (state.q) {
      const q = state.q.toLowerCase();
      matches = files.filter(f => f.rel.toLowerCase().includes(q));
      const extra = files.filter(f => !matches.includes(f) && /\.(md|txt|json|csv)$/i.test(f.name) && (f.size ?? 0) < 200000);
      for (const f of extra.slice(0, 20)) { const t = await drive.readText(f.id).catch(() => ''); if (t.toLowerCase().includes(q)) matches.push(f); }
    }
    const row = f => `<div class="file-row" data-id="${esc(f.id)}" data-rel="${esc(f.rel)}">${icon(/image\//.test(f.contentType ?? '') ? 'image' : 'files', 16)}<div><div class="name">${esc(f.rel)}</div><div class="meta">${f.size != null ? esc(bytes(f.size)) + ' · ' : ''}${esc(ago(f.updatedAt ?? f.createdAt ?? Date.now()))}</div></div><div class="acts">${iconBtn('eye', 'Open', 'data-open')}${iconBtn('copy', 'Copy contents', 'data-copy')}${iconBtn('download', 'Download', 'data-download')}</div></div>`;
    const view = GROUPS.some(g => g[3] === ctx.view) ? ctx.view : null;
    const grouped = GROUPS.filter(g => !view || g[3] === view).map(([name, paths, about]) => { const items = matches.filter(f => paths.some(p => p.endsWith('/') ? f.rel.startsWith(p) : f.rel === p)); return items.length ? `<div class="group"><h4>${esc(name)} <small class="hint">${esc(about)}</small></h4>${items.map(row).join('')}</div>` : ''; }).join('');
    const rest = matches.filter(f => !GROUPS.some(([, paths]) => paths.some(p => p.endsWith('/') ? f.rel.startsWith(p) : f.rel === p)));
    el.innerHTML = head('Files', 'Your co-founder\'s memory as plain files you can read, and everything else of the business. Businesses/' + esc(biz.slug) + '/ in your Drive.')
      + `<label class="field" style="margin-bottom:16px"><span class="sr-only">Search</span><input id="file-search" placeholder="Search names and contents" value="${esc(state.q)}"></label>
        <div class="files-layout"><div id="file-groups">${grouped}${rest.length && !view ? `<div class="group"><h4>Everything else</h4>${rest.map(row).join('')}</div>` : ''}${matches.length && (grouped || !view) ? '' : empty('Nothing here', state.q ? 'Nothing matches.' : view ? 'No files in this group yet.' : 'The folder is empty.')}</div><div class="panel" id="file-preview-wrap"><h4 id="file-preview-name">Preview</h4><div id="file-preview" class="muted">Open a file to read it.</div></div></div>`;
    let t; $('#file-search', el).oninput = e => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; paint(); }, 250); };
    const fileOf = b => all.get(b.closest('.file-row').dataset.rel);
    $$('[data-open]', el).forEach(b => b.onclick = () => open(fileOf(b)));
    $$('[data-copy]', el).forEach(b => b.onclick = async () => { const f = fileOf(b); try { copy(await drive.readText(f.id), 'Contents copied'); } catch (err) { toast(oops(err), 'bad'); } });
    $$('[data-download]', el).forEach(b => b.onclick = async () => { const f = fileOf(b); const url = await drive.blobUrl(f.id); if (!url) return toast('Could not read the file.', 'bad'); const a = document.createElement('a'); a.href = url; a.download = f.name; a.click(); });
    if (state.open) { const f = [...all.values()].find(x => x.rel === state.open); if (f) open(f); }
  };
  const open = async f => {
    state.open = f.rel;
    $('#file-preview-name', el).textContent = f.rel;
    const box = $('#file-preview', el); box.textContent = 'Loading…';
    try {
      if (/^image\//.test(f.contentType ?? '') || /\.(png|jpe?g|webp|gif|svg)$/i.test(f.name)) { const url = await drive.blobUrl(f.id); box.innerHTML = url ? `<img src="${url}" alt="${esc(f.name)}">` : 'Could not read it.'; }
      else { const text = await drive.readText(f.id); box.textContent = text.slice(0, 100000); }
    } catch (e) { box.textContent = oops(e); }
  };
  $('#file-upload').onchange = async e => { const file = e.target.files[0]; if (!file) return; try { await drive.write(root, file.name, file, file.type); toast('Uploaded.', 'ok'); await paint(); } catch (err) { toast(oops(err), 'bad'); } };
  await paint();
}
