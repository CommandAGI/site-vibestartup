// Studio: make (pictures from a description, and clips, shorts and launch films, through CommandAGI's generate
// route), this month's budget, the library, the brand book and the formats with their credit ranges. The video
// pipeline and its jobs are ./_video.js.
import { generate } from '/lib/api.js';
import { bizDrive, readBizJson } from '/lib/business.js';
import { PATHS } from '/lib/schema.js';
import { $, $$, esc, icon, toast, oops, busy, ago, bytes } from '/lib/ui.js';
import { head, section, productsOf, settingsOf, writeSettings, empty, iconBtn, bars } from './_shared.js';
import { CLIP_SECONDS, CLIP_CREDITS, FRAME_CREDITS, startJob, jobsOf, onJobs, recover, retry, stillsOf, estimate, label } from './_video.js';

const FORMATS = [
  { id: 'offer', name: 'Offer image', about: 'A branded image with your offer, sized for every placement.', sizes: '9:16, 4:5, 1:1, 2:3, 1.91:1', takes: 'about a minute', low: 3, high: 5, ready: true },
  { id: 'image', name: 'Image', about: 'One image from a description. Your brand only if you ask for it.', sizes: '4:5, 1:1, 9:16, 16:9', takes: 'under a minute', low: 2, high: 4, ready: true },
  { id: 'short', name: 'Short video', about: `${CLIP_SECONDS} seconds, vertical, your caption burned in.`, sizes: '9:16, 1:1', takes: 'about 3 to 6 minutes', low: CLIP_CREDITS, high: CLIP_CREDITS + FRAME_CREDITS, ready: true, video: true },
  { id: 'clip', name: 'Clip', about: `A ${CLIP_SECONDS}-second clip from a description or a still.`, sizes: '9:16, 1:1, 16:9', takes: 'about 3 to 5 minutes', low: CLIP_CREDITS, high: CLIP_CREDITS + FRAME_CREDITS, ready: true, video: true },
  // No talking-head or lip-sync model is in CommandAGI's generate catalog yet (docs/ARCHITECTURE.md § studio video).
  { id: 'presenter', name: 'Presenter ad', about: 'Fifteen seconds, a presenter reading your script word for word.', sizes: '9:16, 4:5, 1:1', takes: 'about 6 minutes', low: 20, high: 25, ready: false },
  { id: 'film', name: 'Launch film', about: `${CLIP_SECONDS * 4} to ${CLIP_SECONDS * 6} seconds: one clip from each of 4 to 6 of your real photos, put together.`, sizes: '9:16, 1:1, 16:9', takes: 'about 8 to 15 minutes', low: 4 * CLIP_CREDITS, high: 6 * CLIP_CREDITS, ready: true, video: true },
];
const ASPECTS = { short: ['9:16', '1:1'], clip: ['9:16', '1:1', '16:9'], film: ['9:16', '1:1', '16:9'] };
const LOOKS = ['Up to you', 'Clean studio', 'In place', 'Bold type', 'Sunlit'];
const VIEWS = [['make', 'Make'], ['month', 'This month'], ['library', 'Library'], ['brand', 'Brand book'], ['formats', 'Formats']];
/** The format last chosen, kept while the console is open, so leaving Studio during a render comes back to it. */
let lastFormat = 'offer';

export async function render(ctx) {
  const { biz, el } = ctx;
  const hp = new URLSearchParams(location.hash.replace(/^#/, ''));
  const qp = new URLSearchParams(location.search);
  const state = { view: hp.get('view') || qp.get('view') || 'make', format: lastFormat, look: LOOKS[0], count: 2 };
  const studioPath = PATHS.studio, drive = bizDrive(biz);
  const paint = async () => {
    el.innerHTML = head('Studio', 'Everything your co-founder makes for you, and everything you make yourself.')
      + `<div class="subtabs" id="studio-tabs">${VIEWS.map(([id, l]) => `<button type="button" data-view="${id}" aria-pressed="${state.view === id}">${l}</button>`).join('')}</div><div id="studio-view">${bars(1)}</div>`;
    $$('[data-view]', el).forEach(b => b.onclick = () => { state.view = b.dataset.view; paint(); });
    const v = $('#studio-view', el);
    if (state.view === 'make') await make(v); else if (state.view === 'month') await month(v); else if (state.view === 'library') await library(v); else if (state.view === 'brand') await brand(v); else formats(v);
  };
  const make = async v => {
    const f = FORMATS.find(x => x.id === state.format);
    if (f.video) return makeVideo(v, f);
    const products = await productsOf(biz);
    v.innerHTML = `<div id="studio-jobs" class="stack"></div><form id="make" class="panel stack"><div class="grid-2"><label class="field"><span>Format</span><select id="make-format">${FORMATS.map(x => `<option value="${x.id}" ${x.id === state.format ? 'selected' : ''}>${x.name}${x.ready ? '' : ' (not yet)'}</option>`).join('')}</select><small>${esc(f.about)} ${esc(f.sizes)}.</small></label><label class="field"><span>Which product</span><select id="make-product"><option value="">None in particular</option>${products.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label></div><label class="field"><span>Describe it</span><textarea id="make-prompt" rows="3" placeholder="A ${esc(biz.name)} offer image: the product on a clean table, warm light, the price in the corner"></textarea></label><div class="field"><span>Look</span><div class="row">${LOOKS.map(l => `<button type="button" class="chip" data-look="${esc(l)}" aria-pressed="${state.look === l}">${esc(l)}</button>`).join('')}</div></div><div class="row"><label class="field" style="width:120px"><span>How many</span><input id="make-count" type="number" min="1" max="4" value="${state.count}"></label><label class="field grow"><span>Reference files</span><input type="file" id="make-refs" multiple accept="image/*"><small>Kept in your library; the model sees the description.</small></label></div><p class="muted">Credits: a range, not a price. About ${f.low}–${f.high} each: you pay for what comes back clean.</p><div class="row"><button class="btn primary" type="submit" id="make-go" ${f.ready ? '' : 'disabled'}>${f.ready ? 'Make it' : 'Not available on this stack yet'}</button></div><div id="make-out" class="grid-auto"></div></form>`;
    jobsPanel($('#studio-jobs', v));
    $('#make-format', v).onchange = e => { state.format = lastFormat = e.target.value; make(v); };
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
            // The route keeps the folders of a name (it has no `path` field), so the full path puts it in studio/.
            const r = await generate({ modelId: 'text-to-image.flux-schnell', inputs: { prompt: full }, name: `${studioPath}/${f.id}-${Date.now().toString(36)}-${i + 1}.png`, org: biz.org });
            const file = r.file ?? r;
            const url = file?.id ? await drive.blobUrl(file.id) : null;
            out.insertAdjacentHTML('beforeend', `<div class="piece card">${url ? `<img src="${url}" alt="">` : ''}<b>${esc(file?.name ?? 'made')}</b><small class="hint">in your library</small></div>`);
          } catch (err) { out.insertAdjacentHTML('beforeend', `<div class="note warn">${esc(err.code === 'generate_unavailable' ? 'Image generation is not configured on this stack yet. Nothing was charged.' : oops(err))}</div>`); break; }
        }
        ctx.refreshCredits();
      });
    };
  };
  // ---------- video: a clip, a short, a launch film (./_video.js runs them as jobs) ----------
  const formatPicker = f => `<label class="field"><span>Format</span><select id="make-format">${FORMATS.map(x => `<option value="${x.id}" ${x.id === f.id ? 'selected' : ''}>${x.name}${x.ready ? '' : ' (not yet)'}</option>`).join('')}</select><small>${esc(f.about)} ${esc(f.sizes)}.</small></label>`;
  const makeVideo = async (v, f) => {
    const stills = await stillsOf(biz);
    const aspects = ASPECTS[f.id];
    if (!aspects.includes(state.aspect)) state.aspect = aspects[0];
    const film = f.id === 'film';
    const stillList = film
      ? `<div class="field"><span>Your photos (choose 4 to 6)</span><div id="make-stills" class="grid-auto">${stills.length ? stills.map(x => `<label class="card row" style="gap:8px"><input type="checkbox" value="${esc(x.id)}" data-name="${esc(x.name)}"><span class="small">${esc(x.name)}</span></label>`).join('') : '<p class="muted">No photos in your files yet: add some below.</p>'}</div></div>`
      : `<label class="field"><span>Start from</span><select id="make-still"><option value="">A first frame made from the description</option>${stills.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select><small>A still from your Studio library or your business's files. It is cropped to the shape you choose.</small></label>`;
    v.innerHTML = `<div id="studio-jobs" class="stack"></div><form id="make" class="panel stack"><div class="grid-2">${formatPicker(f)}<div class="field"><span>Shape</span><div class="row" id="make-aspect">${aspects.map(a => `<button type="button" class="chip" data-aspect="${a}" aria-pressed="${state.aspect === a}">${a}</button>`).join('')}</div></div></div>`
      + `<label class="field"><span>${film ? 'Direction for every clip' : 'Describe the scene and the motion'}</span><textarea id="make-prompt" rows="3" placeholder="${film ? 'Slow push-in, warm morning light, gentle movement' : `The ${esc(biz.name)} product on a sunlit table, the camera slowly circles it`}"></textarea></label>`
      + stillList
      + `<label class="field"><span>Add ${film ? 'photos' : 'a still'}</span><input type="file" id="make-still-upload" accept="image/png,image/jpeg,image/webp" ${film ? 'multiple' : ''}><small>Kept in your Studio library.</small></label>`
      + (f.id === 'short' ? `<label class="field"><span>Caption</span><input id="make-caption" maxlength="90" placeholder="New: ${esc(biz.name)}. Out now."><small>Burned into the video, in the lower third.</small></label>` : '')
      + (film ? `<label class="field"><span>Last frame</span><input id="make-endcard" maxlength="40" value="${esc(biz.name)}"></label>` : '')
      + `<p class="muted" id="make-credits"></p><div class="row"><button class="btn primary" type="submit" id="make-go">Make it</button></div></form>`;
    $('#make-format', v).onchange = e => { state.format = lastFormat = e.target.value; make(v); };
    $$('[data-aspect]', v).forEach(b => b.onclick = () => { state.aspect = b.dataset.aspect; $$('[data-aspect]', v).forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    const chosen = () => film ? $$('#make-stills input:checked', v).map(x => ({ id: x.value, name: x.dataset.name })) : ($('#make-still', v).value ? [{ id: $('#make-still', v).value, name: $('#make-still', v).selectedOptions[0].textContent }] : []);
    const price = () => {
      const n = chosen().length;
      const e = film ? estimate('film', { stills: n }) : estimate(f.id);
      const low = film || n ? e.low : e.high;
      $('#make-credits', v).textContent = `Credits: about ${film && !n ? `${4 * CLIP_CREDITS}–${6 * CLIP_CREDITS}` : low} at CommandAGI's price for ${film ? `${n >= 4 ? n : '4 to 6'} clips` : 'one clip'} (Kling v2, ${CLIP_SECONDS} seconds each${film || n ? '' : ', plus a first frame'}). A range, not a price: after it runs you see what your balance actually moved.`;
    };
    v.addEventListener('change', price); price();
    $('#make-still-upload', v).onchange = async e => {
      const files = [...e.target.files];
      await busy($('#make-go', v), async () => {
        for (const file of files) { try { await drive.ensure(studioPath); await drive.write(studioPath, file.name, file, file.type); } catch (err) { toast(oops(err), 'bad'); } }
      });
      toast(files.length === 1 ? 'Added to your library.' : `${files.length} added to your library.`, 'ok');
      const keep = $('#make-prompt', v).value; await makeVideo(v, f); $('#make-prompt', v).value = keep;
    };
    $('#make', v).onsubmit = async e => {
      e.preventDefault();
      const direction = $('#make-prompt', v).value.trim(); if (!direction) return toast('Describe the scene and the motion.', 'bad');
      const picked = chosen();
      if (film && (picked.length < 4 || picked.length > 6)) return toast('Choose 4 to 6 photos for a launch film.', 'bad');
      const caption = $('#make-caption', v)?.value.trim() ?? '';
      if (f.id === 'short' && !caption) return toast('Write the caption to burn in.', 'bad');
      startJob(biz, { format: f.id, direction, aspect: state.aspect, stills: picked, caption, endCard: $('#make-endcard', v)?.value.trim() ?? '' });
      toast(`Your ${label({ format: f.id })} is rendering. You can leave this page: it is in Studio's library when it is done.`, 'ok');
      await jobsPanel($('#studio-jobs', v));
    };
    await jobsPanel($('#studio-jobs', v));
  };

  // The renders of this business: each one's step and elapsed time while it runs, the player when it is done.
  const jobsPanel = async box => {
    if (!box) return;
    const jobs = await jobsOf(biz);
    const draw = () => {
      if (!box.isConnected) return;
      const recent = jobs.filter(j => j.state === 'rendering' || Date.now() - (j.updatedAt ?? 0) < 86_400_000).slice(0, 6);
      box.innerHTML = recent.length ? `<h3>Renders</h3>${recent.map(jobCard).join('')}` : '';
      $$('[data-retry]', box).forEach(b => b.onclick = () => { const j = jobs.find(x => x.id === b.dataset.retry); if (!j) return; retry(biz, j); toast('Asked again.', 'ok'); jobsPanel(box); });
      for (const p of $$('[data-player]', box)) playerFor(p);
    };
    draw();
    for (const j of jobs) if (j.state === 'rendering') recover(biz, j);
    const off = onJobs(changed => {
      if (!box.isConnected) return off();
      const i = jobs.findIndex(x => x.id === changed.id);
      if (i >= 0) jobs[i] = changed; else jobs.unshift(changed);
      draw();
    });
    const tick = setInterval(() => {
      if (!box.isConnected) { clearInterval(tick); off(); return; }
      $$('[data-elapsed]', box).forEach(x => { x.textContent = minutes(Date.now() - Number(x.dataset.elapsed)); });
    }, 1000);
  };
  const minutes = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const range = e => e.low === e.high ? `${e.low}` : `${e.low}–${e.high}`;
  const jobCard = j => {
    const parts = j.parts.length > 1 ? `<small class="hint">Clips: ${j.parts.map(p => p.state === 'done' ? '●' : p.state === 'rendering' ? '◐' : '○').join(' ')}</small>` : '';
    const credits = j.state === 'done'
      ? (j.charged == null ? 'Your balance could not be read, so what it took is not known.' : `Took ${j.charged} credit${j.charged === 1 ? '' : 's'} from your balance (estimated ${range(j.estimate)}).`)
      : `Estimated ${range(j.estimate)} credits.`;
    const badge = { rendering: '<span class="badge accent">rendering</span>', done: '<span class="badge ok">ready</span>', failed: '<span class="badge bad">stopped</span>', interrupted: '<span class="badge warn">interrupted</span>' }[j.state] ?? '';
    const name = label(j);
    return `<div class="card stack job" data-id="${esc(j.id)}" data-state="${esc(j.state)}"><div class="row" style="justify-content:space-between"><b>${esc(name[0].toUpperCase() + name.slice(1))} · ${esc(j.aspect)}</b>${badge}</div><small class="muted">${esc(j.direction)}</small>`
      + (j.state === 'rendering' ? `<p class="small" data-step><span class="spin" style="display:inline-block;width:12px;height:12px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin .8s linear infinite;vertical-align:-1px"></span> ${esc(j.step)} · <span data-elapsed="${j.startedAt}">${minutes(Date.now() - j.startedAt)}</span> elapsed. A clip usually takes 2 to 5 minutes; you can leave this page.</p>` : '')
      + parts
      + (j.state === 'done' && j.file ? `<div data-player="${esc(j.file.id)}" data-name="${esc(j.file.name)}"></div>` : '')
      + (j.error ? `<div class="note warn">${esc(j.error)}</div>` : '')
      + `<small class="hint">${esc(credits)}</small>`
      + (j.state === 'failed' || j.state === 'interrupted' ? `<div class="row"><button type="button" class="btn quiet" data-retry="${esc(j.id)}">Try again (about ${esc(range(j.estimate))} credits)</button></div>` : '')
      + `</div>`;
  };
  /** A video's bytes need the bearer, so the player is filled from a blob when it is asked for. */
  const playerFor = async box => {
    if (box.dataset.ready) return; box.dataset.ready = '1';
    box.innerHTML = `<button type="button" class="btn quiet" data-play aria-label="Play ${esc(box.dataset.name)}">${icon('play')} Play</button>`;
    $('[data-play]', box).onclick = async e => {
      await busy(e.currentTarget, async () => {
        const url = await drive.blobUrl(box.dataset.player);
        if (!url) return toast('Could not read the video.', 'bad');
        box.innerHTML = `<video controls playsinline muted src="${url}" style="width:100%;max-height:480px;background:#000"></video>`;
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
    // A clip's parts and first frame are kept beside it (they cost the same as the clip), shown under it in Files.
    v.innerHTML = `<div id="studio-jobs" class="stack" style="margin-bottom:16px"></div>` + (files.length ? `<div class="grid-auto" id="library">${files.map(f => `<div class="piece card" data-id="${esc(f.id)}"><div class="pic"></div><b>${esc(f.name)}</b><small class="hint">${esc(ago(f.updatedAt ?? f.createdAt ?? Date.now()))}${f.size ? ` · ${esc(bytes(f.size))}` : ''}</small><div class="row">${iconBtn('download', 'Download', 'data-download')}</div></div>`).join('')}</div>` : `<div id="library">${empty('Nothing made yet', 'Make something, or ask your co-founder for an offer image.', '<button type="button" class="btn quiet" data-press="#studio-tabs [data-view=make]">Make something</button>')}</div>`);
    jobsPanel($('#studio-jobs', v));
    for (const p of $$('.piece', v)) {
      const f = files.find(x => x.id === p.dataset.id);
      $('[data-download]', p).onclick = async () => { const url = await drive.blobUrl(f.id); if (!url) return toast('Could not read the file.', 'bad'); const a = document.createElement('a'); a.href = url; a.download = f.name; a.click(); };
      if (/^video\//.test(f.contentType ?? '') || /\.(mp4|webm)$/.test(f.name)) { const pic = $('.pic', p); pic.dataset.player = f.id; pic.dataset.name = f.name; playerFor(pic); continue; }
      if (/^image\//.test(f.contentType ?? '')) { const url = await drive.blobUrl(f.id); if (url) $('.pic', p).innerHTML = `<img src="${url}" alt="">`; }
    }
  };
  const brand = async v => {
    const b = (await readBizJson(biz, PATHS.brandBook, null)) ?? biz.brand ?? {};
    const logo = await drive.find('brand', 'logo.svg').catch(() => null);
    const logoUrl = logo ? await drive.blobUrl(logo.id) : null;
    v.innerHTML = `<div id="brand-book" class="grid-2"><div class="panel stack"><h3>Colours</h3><div class="row">${['primary', 'secondary', 'accent', 'ground', 'ink'].map(k => `<div class="stack" style="gap:4px;text-align:center"><i style="display:block;width:56px;height:56px;border:1px solid var(--line);background:${esc(b[k] ?? '#ccc')}"></i><small class="hint">${k}</small></div>`).join('')}</div><h3>Type</h3><p class="muted">${esc(b.type ?? '')}</p><h3>Voice</h3><p class="muted">${esc((b.voice ?? []).join(', '))}</p><p class="hint">${esc(b.generated ? 'Generated ' + b.generated + '. Ask your co-founder for a designed kit.' : '')}</p></div><div class="panel stack"><h3>Logo</h3>${logoUrl ? `<img src="${logoUrl}" alt="${esc(biz.name)} mark" width="96" height="96">` : '<p class="muted">No logo file yet.</p>'}<p class="hint">brand/logo.svg in your files.</p></div></div>`;
  };
  const formats = v => {
    v.innerHTML = `<p class="muted" style="margin-bottom:12px">A range, not a price: you pay for what comes back clean.</p><div class="grid-auto">${FORMATS.map(f => `<div class="card stack"><h4>${esc(f.name)} ${f.ready ? '' : '<span class="badge warn">not yet</span>'}</h4><p class="small muted">${esc(f.about)}</p><p class="hint">${esc(f.sizes)} · ${esc(f.takes)} · ${f.low}–${f.high} credits</p></div>`).join('')}</div>`;
  };
  await paint();
}
