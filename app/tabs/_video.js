// Studio's video formats (docs/ARCHITECTURE.md § studio video). CommandAGI's generate route has one video model
// today, `image-to-video.kling` (Kling v2 master on fal): a still and a direction in, a 5-second clip out, answered
// in one held request that may take minutes. Everything else a format needs is done here, in the founder's browser:
// the first frame from a description (`text-to-image.flux-schnell`), the crop to the chosen aspect, the caption
// burned into a short, and a launch film stitched from one clip a photo.
//
// A render is a job, recorded as `studio/jobs/<id>.json` before anything is sent and after every step, so a tab
// switch, a reload or another device shows where it is. A job runs in this page (the module stays loaded across tab
// switches). After a reload the request is gone with the page: the job waits for the clip it asked for (the platform
// may still save it), then says it was interrupted. A paid step is never sent again without the founder asking.
import { drive, generate, credits } from '/lib/api.js';
import { folderOf } from '/lib/business.js';
import { toast, oops } from '/lib/ui.js';

export const CLIP_SECONDS = 5;
/** Kling v2 master costs $0.28 a second, five at least (CommandAGI's `GENERATION_PRICES`); 1 credit is $0.01. */
export const CLIP_CREDITS = 140;
/** A FLUX schnell first frame: $0.003 a megapixel, under one credit. */
export const FRAME_CREDITS = 1;
/** How long a clip may take before a job that lost its page calls it interrupted (the route holds up to 280 s). */
const CLIP_DEADLINE = 7 * 60 * 1000;
const FRAME_SIZE = { '9:16': 'portrait_16_9', '1:1': 'square_hd', '16:9': 'landscape_16_9' };
const RATIO = { '9:16': 9 / 16, '1:1': 1, '16:9': 16 / 9 };

export const studioDir = biz => `${folderOf(biz.slug)}/studio`;
const jobsDir = biz => `${studioDir(biz)}/jobs`;

// ---------- the jobs this page runs, and who wants to hear about them ----------

const running = new Map();
const listeners = new Set();
const emit = job => { for (const fn of listeners) { try { fn(job); } catch { /* a view that went away */ } } };
/** Hear every change of a job; returns the unsubscribe. */
export function onJobs(fn) { listeners.add(fn); return () => listeners.delete(fn); }

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1-');
const newId = format => `${format}-${stamp()}-${Math.random().toString(36).slice(2, 6)}`;

async function record(biz, job, patch = {}) {
  Object.assign(job, patch, { updatedAt: Date.now() });
  emit(job);
  await drive.writeJson(jobsDir(biz), `${job.id}.json`, job).catch(() => null);
  return job;
}

/** The business's recent jobs: this page's running ones as they are now, the rest as their files say. */
export async function jobsOf(biz, limit = 12) {
  const files = (await drive.list(jobsDir(biz)).catch(() => [])).filter(f => f.name.endsWith('.json'))
    .sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)).slice(0, limit);
  const jobs = (await Promise.all(files.map(f => drive.readJson(f.id).catch(() => null)))).filter(Boolean);
  return jobs.map(j => running.get(j.id) ?? j).sort((a, b) => b.startedAt - a.startedAt);
}

// ---------- pictures: a still from the Drive, a first frame from a description ----------

/** The images a clip or a film can start from: the studio's and the business's own pictures (not SVG). */
export async function stillsOf(biz) {
  const root = folderOf(biz.slug);
  const lists = await Promise.all([studioDir(biz), `${root}/products`, root].map(p => drive.list(p).then(fs => fs.map(f => ({ ...f, at: p }))).catch(() => [])));
  const seen = new Set();
  return lists.flat().filter(f => f.type !== 'folder' && /^image\/(png|jpe?g|webp|gif)/.test(f.contentType ?? '') && !seen.has(f.id) && seen.add(f.id));
}

/** The largest centred crop of `blob` at `aspect`, at most 1280 px on its long side, as a JPEG data URI. */
async function framed(blob, aspect) {
  const bmp = await createImageBitmap(blob);
  const want = RATIO[aspect] ?? bmp.width / bmp.height;
  let sw = bmp.width, sh = bmp.height;
  if (sw / sh > want) sw = Math.round(sh * want); else sh = Math.round(sw / want);
  const scale = Math.min(1, 1280 / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
  c.getContext('2d').drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, c.width, c.height);
  bmp.close?.();
  return c.toDataURL('image/jpeg', 0.9);
}

async function blobOf(fileId) {
  const r = await drive.read(fileId);
  if (!r.ok) throw new Error('Could not read the picture from your files.');
  return r.blob();
}

/** Ask for a generated file by its full Drive path: the route keeps a name's folders (Drive `splitName`). */
async function made(modelId, inputs, dir, name) {
  const r = await generate({ modelId, inputs, name: `${dir}/${name}` });
  const file = r.file ?? r;
  if (!file?.id) throw new Error('The model answered without a file.');
  return { id: file.id, name: file.name, contentType: file.contentType, size: file.size };
}

// ---------- in the browser: a caption burned in, clips stitched into one film ----------

const RECORDER_TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
const extOf = type => type.startsWith('video/mp4') ? 'mp4' : 'webm';

function wrap(g, text, maxWidth) {
  const lines = []; let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

/**
 * Play `blobs` one after another onto a canvas and record it (MediaRecorder): the clips cover the frame, and
 * `caption` is drawn over the lower third of every frame. Real time: a 5-second clip takes 5 seconds. A tab in the
 * background draws once a second, so the founder is asked to keep it in front.
 */
export async function compose(blobs, { caption = '', endCard = '' } = {}) {
  const type = RECORDER_TYPES.find(t => window.MediaRecorder?.isTypeSupported?.(t));
  if (!type) throw new Error('This browser cannot record video. Try Chrome, Edge or Firefox.');
  const videos = [];
  for (const b of blobs) {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = URL.createObjectURL(b);
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('A clip could not be read.')); });
    videos.push(v);
  }
  const W = videos[0].videoWidth || 720, H = videos[0].videoHeight || 1280;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rec = new MediaRecorder(c.captureStream(30), { mimeType: type, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise(res => { rec.onstop = res; });
  const size = Math.round(Math.min(W, H) * 0.062);
  const drawCaption = text => {
    if (!text) return;
    g.font = `700 ${size}px "Instrument Sans", system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = wrap(g, text, W * 0.84);
    const lh = size * 1.25, top = H * 0.78 - (lines.length * lh) / 2;
    lines.forEach((l, i) => {
      const y = top + i * lh + lh / 2, w = g.measureText(l).width + size;
      g.fillStyle = 'rgba(0,0,0,0.62)'; g.fillRect((W - w) / 2, y - lh / 2, w, lh);
      g.fillStyle = '#fff'; g.fillText(l, W / 2, y);
    });
  };
  const cover = v => {
    const s = Math.max(W / v.videoWidth, H / v.videoHeight), w = v.videoWidth * s, h = v.videoHeight * s;
    g.drawImage(v, (W - w) / 2, (H - h) / 2, w, h);
  };
  rec.start(250);
  for (const v of videos) {
    await v.play();
    await new Promise(res => {
      const draw = () => { cover(v); drawCaption(caption); if (v.ended) return res(); setTimeout(draw, 1000 / 30); };
      draw();
    });
  }
  if (endCard) {
    const until = Date.now() + 1500;
    await new Promise(res => {
      const draw = () => { g.fillStyle = '#111'; g.fillRect(0, 0, W, H); g.font = `600 ${size * 1.4}px "Instrument Serif", Georgia, serif`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(endCard, W / 2, H / 2); if (Date.now() >= until) return res(); setTimeout(draw, 1000 / 30); };
      draw();
    });
  }
  rec.stop();
  await stopped;
  for (const v of videos) URL.revokeObjectURL(v.src);
  return new Blob(chunks, { type: type.split(';')[0] });
}

// ---------- a job ----------

/** What a format costs at the catalog's prices, before it runs: one clip a part, a first frame when none is given. */
export function estimate(format, { stills = 0 } = {}) {
  if (format === 'film') { const n = Math.max(4, Math.min(6, stills || 4)); return { low: n * CLIP_CREDITS, high: n * CLIP_CREDITS, parts: n }; }
  return { low: CLIP_CREDITS, high: CLIP_CREDITS + FRAME_CREDITS, parts: 1 };
}

/**
 * Start a render and record it. `spec`: `format` (clip | short | film), `direction` (the motion, the scene),
 * `aspect` (9:16 | 1:1 | 16:9), `stills` ([{ id, name }]: a clip's one still, a film's 4–6 photos; none for a clip from
 * the description), `caption` (a short's words), `endCard` (a film's last frame).
 */
export function startJob(biz, spec) {
  const id = newId(spec.format);
  const parts = spec.format === 'film' ? spec.stills.length : 1;
  const job = {
    id, format: spec.format, state: 'rendering', step: 'Starting', startedAt: Date.now(), updatedAt: Date.now(),
    direction: spec.direction, aspect: spec.aspect, caption: spec.caption ?? '', endCard: spec.endCard ?? '',
    stills: spec.stills ?? [], estimate: estimate(spec.format, { stills: parts }),
    parts: Array.from({ length: parts }, (_, i) => ({ name: parts > 1 || spec.format !== 'clip' ? `${id}-part-${i + 1}.mp4` : `${id}.mp4`, state: 'waiting' })),
  };
  running.set(id, job);
  run(biz, job).finally(() => running.delete(id));
  return job;
}

async function run(biz, job) {
  const dir = studioDir(biz);
  try {
    await drive.ensure(jobsDir(biz));
    job.creditsBefore = await credits().catch(() => null);
    await record(biz, job, { step: job.parts.length > 1 ? `Animating ${job.parts.length} clips` : 'Preparing the first frame' });
    // A film's clips run two at a time: each is minutes at the provider, and two keep one founder's queue short.
    const queue = job.parts.map((p, i) => i);
    const one = async i => {
      const part = job.parts[i];
      let image;
      if (job.stills[i]) image = await framed(await blobOf(job.stills[i].id), job.aspect);
      else {
        const frame = await made('text-to-image.flux-schnell', { prompt: `${job.direction}. A single photographic frame, no text.`, image_size: FRAME_SIZE[job.aspect] ?? 'portrait_16_9' }, dir, `${job.id}-frame.png`);
        await record(biz, job, { frame });
        image = await framed(await blobOf(frame.id), job.aspect);
      }
      part.state = 'rendering'; part.startedAt = Date.now();
      await record(biz, job, { step: job.parts.length > 1 ? `Animating clip ${i + 1} of ${job.parts.length}` : 'Animating the clip' });
      part.file = await made('image-to-video.kling', { image_url: image, prompt: job.direction }, dir, part.name);
      part.state = 'done';
      await record(biz, job);
    };
    await Promise.all([0, 1].map(async () => { while (queue.length) await one(queue.shift()); }));
    await finish(biz, job);
  } catch (e) {
    await record(biz, job, { state: 'failed', step: 'Stopped', error: e?.code === 'generate_unavailable' ? 'Video generation is not configured on this stack yet.' : oops(e) });
    toast(`The ${label(job)} stopped: ${job.error}`, 'bad');
  }
}

/** The steps after every clip is back: the caption or the stitch (in this page), then the credits it took. */
async function finish(biz, job) {
  const dir = studioDir(biz);
  let file = job.parts[0].file;
  if (job.format === 'short' || job.format === 'film') {
    await record(biz, job, { step: job.format === 'short' ? 'Burning in the caption (keep this tab in front)' : 'Putting the film together (keep this tab in front)' });
    const blobs = await Promise.all(job.parts.map(p => blobOf(p.file.id)));
    const out = await compose(blobs, { caption: job.format === 'short' ? job.caption : '', endCard: job.format === 'film' ? job.endCard : '' });
    file = await drive.write(dir, `${job.id}.${extOf(out.type)}`, out, out.type);
    file = { id: file.id, name: file.name, contentType: file.contentType ?? out.type, size: file.size ?? out.size };
  }
  const after = await credits().catch(() => null);
  const charged = job.creditsBefore != null && after != null ? Math.max(0, Math.round(job.creditsBefore - after)) : null;
  await record(biz, job, { state: 'done', step: 'Ready', file, creditsAfter: after, charged, doneAt: Date.now() });
  toast(`Your ${label(job)} is ready in the Studio library.`, 'ok');
}

export const label = job => ({ clip: 'clip', short: 'short video', film: 'launch film' })[job.format] ?? 'video';

/**
 * A job whose page went away (a reload, another device). If its clips came back, finish it here; while a clip may
 * still come back, wait for it; past that, say it was interrupted. Never sends a paid step again.
 */
export async function recover(biz, job) {
  if (job.state !== 'rendering' || running.has(job.id)) return job;
  running.set(job.id, job);
  try {
    const names = new Map((await drive.list(studioDir(biz)).catch(() => [])).map(f => [f.name, f]));
    for (const p of job.parts) {
      const f = names.get(p.name);
      if (f && !p.file) { p.file = { id: f.id, name: f.name, contentType: f.contentType, size: f.size }; p.state = 'done'; }
    }
    if (job.parts.every(p => p.file)) {
      await record(biz, job, { step: 'Picking up where it stopped' });
      await finish(biz, job);
      running.delete(job.id);
      return job;
    }
    const waiting = job.parts.filter(p => !p.file);
    const last = Math.max(...waiting.map(p => p.startedAt ?? job.startedAt));
    if (Date.now() - last < CLIP_DEADLINE) {
      await record(biz, job, { step: 'Waiting for the clip asked for on another page' });
      setTimeout(() => { running.delete(job.id); recover(biz, job).then(emit); }, 15_000);
      return job;
    }
    await record(biz, job, { state: 'interrupted', step: 'Interrupted', error: 'The page that asked for this closed before the clip came back, and nothing came back after it. Nothing is sent again unless you ask.' });
  } catch (e) { await record(biz, job, { state: 'failed', error: oops(e) }); }
  running.delete(job.id);
  return job;
}

/** Ask again for a job that failed or was interrupted: a new job with the same spec (the founder's explicit act). */
export function retry(biz, job) {
  return startJob(biz, { format: job.format, direction: job.direction, aspect: job.aspect, stills: job.stills, caption: job.caption, endCard: job.endCard });
}
