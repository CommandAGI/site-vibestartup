// The chapter-break films: a still from fal (FLUX1.1 [pro] ultra), then five seconds of motion from it (Kling 2.1
// standard, image-to-video), then the encodes the page serves (AV1 WebM, H.264 MP4, a WebP poster). A build script:
// the fal key is read here from the env cascade and never reaches a page or a log line.
//
//   COMMANDAGI_ENV_ROOT=… FFMPEG=/path/to/ffmpeg node redesign/media.mjs [--only <name>] [--encode-only]
//
// Prompts, models and what each call cost go in redesign/NOTES.md by hand; raw downloads stay in redesign/raw/
// (gitignored), the encodes in media/.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const raw = path.join(here, 'raw');
const out = path.join(here, '..', 'media');
mkdirSync(raw, { recursive: true });
mkdirSync(out, { recursive: true });
const arg = n => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';

// One art direction for every film: hands only, tight, warm, slow, 35 mm grain; ivory light, one tomato-red object.
const LOOK = 'Shot on 35mm film, Kodak Portra 400, soft natural window light, warm ivory highlights, deep charcoal shadows, '
  + 'fine film grain, shallow depth of field, close crop on the hands only, no faces, no text, no logos, quiet and unhurried, documentary craft';

export const FILMS = [
  { name: 'clay', prompt: `Overhead close-up of two hands centering wet terracotta clay on a spinning potter's wheel in a small studio, slip on the knuckles, a tomato-red glazed bowl drying in the corner. ${LOOK}`,
    motion: 'The wheel turns slowly and the hands press the clay upward into a cone; slow, steady, real-time motion, camera locked.' },
  // Two press takes (a letterpress pull, then a lino block) printed made-up letters: image models cannot set type, so
  // this chapter's film has no paper in it at all.
  { name: 'stitch', prompt: `Close-up of two hands saddle-stitching a small tan leather wallet with two needles and waxed tomato-red thread, a stitching clamp and an awl on a worn wooden bench. ${LOOK}`,
    motion: 'The hands pull both needles through and draw the red thread tight, one stitch after another; slow, camera locked.' },
  { name: 'dough', prompt: `Close-up of floured hands folding and shaping a round of bread dough on a worn wooden bench in a tiny bakery before dawn, a linen proofing basket beside it. ${LOOK}`,
    motion: 'The hands fold the dough over itself and turn it, flour dust drifting in the light; slow, calm, camera locked.' },
  // The first parcel take wrote made-up words on its card; this one has no card, no label and no paper with marks.
  { name: 'parcel', prompt: `Close-up of hands tying a cotton string around a small plain unmarked kraft paper parcel on a wooden table, no card, no label, no writing, a sprig of dried lavender tucked under the string, tissue paper nearby. ${LOOK}`,
    motion: 'The hands pull the string tight and finish the knot, then rest flat on the parcel; slow, camera locked.' },
];

function falKey() {
  const root = process.env.COMMANDAGI_ENV_ROOT;
  if (!root) throw new Error('COMMANDAGI_ENV_ROOT is not set.');
  for (const f of ['.env.api', '.env']) {
    if (!existsSync(path.join(root, f))) continue;
    const m = readFileSync(path.join(root, f), 'utf8').match(/^SVC__FAL__MAIN__API_KEY=(.*)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('SVC__FAL__MAIN__API_KEY is not in the env cascade.');
}

async function fal(model, input) {
  const headers = { authorization: `Key ${falKey()}`, 'content-type': 'application/json' };
  const q = await (await fetch(`https://queue.fal.run/${model}`, { method: 'POST', headers, body: JSON.stringify(input) })).json();
  if (!q.status_url) throw new Error(`${model}: ${JSON.stringify(q).slice(0, 300)}`);
  for (;;) {
    await new Promise(r => setTimeout(r, 5000));
    const s = await (await fetch(q.status_url, { headers })).json();
    if (s.status === 'COMPLETED') return (await fetch(q.response_url, { headers })).json();
    if (s.status !== 'IN_QUEUE' && s.status !== 'IN_PROGRESS') throw new Error(`${model}: ${JSON.stringify(s).slice(0, 300)}`);
  }
}

async function download(url, file) { writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer())); }

function encode(name) {
  const src = path.join(raw, `${name}.mp4`);
  // The page's grade: a little less saturation, lifted blacks toward the ink, so the films sit on ivory paper.
  const vf = 'scale=1280:-2:flags=lanczos,eq=saturation=0.86:contrast=0.96:brightness=0.01,fps=24';
  const run = a => execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' });
  run(['-i', src, '-an', '-vf', vf, '-c:v', 'libaom-av1', '-crf', '38', '-b:v', '0', '-cpu-used', '6', '-row-mt', '1', path.join(out, `${name}.webm`)]);
  run(['-i', src, '-an', '-vf', vf, '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, `${name}.mp4`)]);
  run(['-i', src, '-vf', `${vf},select=eq(n\\,0)`, '-frames:v', '1', '-c:v', 'libwebp', '-quality', '72', path.join(out, `${name}.webp`)]);
}

const only = arg('only');
for (const film of FILMS.filter(f => !only || f.name === only)) {
  if (!process.argv.includes('--encode-only')) {
    const still = path.join(raw, `${film.name}.jpg`);
    if (!existsSync(still)) {
      const r = await fal('fal-ai/flux-pro/v1.1-ultra', { prompt: film.prompt, aspect_ratio: '16:9', output_format: 'jpeg', safety_tolerance: '2', raw: true });
      await download(r.images[0].url, still);
      console.log(`${film.name}: still (seed ${r.seed})`);
    }
    const clip = path.join(raw, `${film.name}.mp4`);
    if (!existsSync(clip)) {
      const up = `data:image/jpeg;base64,${readFileSync(still).toString('base64')}`;
      const r = await fal('fal-ai/kling-video/v2.1/standard/image-to-video', { prompt: film.motion, image_url: up, duration: '5', negative_prompt: 'blur, distort, low quality, text, faces, extra fingers' });
      await download(r.video.url, clip);
      console.log(`${film.name}: clip`);
    }
  }
  encode(film.name);
  console.log(`${film.name}: encoded`);
}
