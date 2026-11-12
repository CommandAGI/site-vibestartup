// Studio's video formats, for real: a fresh account makes a short video (a first frame from the description, a Kling
// clip, the caption burned in) through the Studio's form, leaves the tab while it renders, comes back, reloads, and
// plays the result from the library. Then the launch film's stitch is run in the page on that clip twice (no second
// paid clip). The account is erased at the end, also when the run stops.
//
//   node test/studio-video.mjs --api https://api.commandagi.com [--port 4190]   the site here, against that API
//   node test/studio-video.mjs --url <site> --api <origin>                      a site already running
//
// The business is a bare business.json written through the API (this checks the Studio, not the wizard's build).
// One short costs CommandAGI one Kling v2 clip ($1.40) and one FLUX frame. Screenshots in .test-results/.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withBrowser, sleep } from './browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const shots = path.join(here, '..', '.test-results');
const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); return ok; };
const stamp = Date.now().toString(36);
const email = `studio-video-${stamp}@example.com`;
const password = 'correct horse battery';
const slug = `clips-${stamp}`;

let base = arg('url'), api = arg('api'), stop = null;
if (!base) {
  const { startLocal } = await import('./local.mjs');
  const local = await startLocal({ port: Number(arg('port') ?? 0), api: api ?? null });
  base = local.url; api = local.api; stop = local.stop;
}
console.log(`site ${base} · API ${api} · account ${email}`);

async function run(b) {
  const t0 = Date.now();
  const at = () => `${Math.round((Date.now() - t0) / 1000)} s`;
  await b.goto(`${base}/auth/`);
  await b.waitFor('!!document.querySelector("#signup")');
  await b.eval('(() => { const s = document.querySelector("#signup"); if (s.hidden) document.querySelector("[data-mode=signup], #to-signup, a[href*=signup]")?.click(); })()');
  await b.waitFor('!document.querySelector("#signup").hidden', 5000).catch(() => null);
  await b.fill('#signup [name=name]', 'Studio Video');
  await b.fill('#signup [name=email]', email);
  await b.fill('#signup [name=password]', password);
  if (await b.eval('!!document.querySelector("#signup [name=birthdate]")')) await b.eval('(() => { const i = document.querySelector("#signup [name=birthdate]"); i.value = "1990-05-05"; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); })()');
  await b.waitFor('document.documentElement.dataset.auth === "ready"', 30000).catch(() => null);

  await b.click('#signup button[type=submit]');
  await b.waitFor('location.pathname !== "/auth/"', 30000);
  check(true, `signed up (${at()})`);

  const before = await b.eval(`(async () => {
    const m = await import('/lib/api.js');
    await m.setProfile({ birthdate: '1990-05-05' }).catch(() => null);
    const org = (await m.orgs.create({ name: 'Clip Test Co', handle: '${slug}' })).org;
    await m.drive.forAccount(org).writeJson('', 'business.json', { slug: '${slug}', tagline: 'Lemonade, made slowly.', createdAt: Date.now() });
    await m.drive.forAccount(org).writeJson('brand', 'brand-book.json', { primary: '#d9480f', secondary: '#ffd8a8' });
    return m.credits();
  })()`);
  check(typeof before === 'number', `the account has a balance (${before} credits)`);

  await b.goto(`${base}/app/?b=${slug}#tab=studio`);
  await b.waitFor('!!document.querySelector("#make-format")', 30000);
  await b.eval('(() => { const s = document.querySelector("#make-format"); s.value = "short"; s.dispatchEvent(new Event("change", { bubbles: true })); })()');
  await b.waitFor('!!document.querySelector("#make-caption")', 15000);
  check(await b.eval('!document.querySelector("#make-go").disabled'), 'the short form can be sent');
  const quote = await b.text('#make-credits');
  check(/about 141/.test(quote), `the credit range is shown before it runs ("${quote.slice(0, 90)}…")`);
  check(await b.eval('document.querySelector("[data-aspect=\'9:16\']")?.getAttribute("aria-pressed") === "true"'), 'a short starts vertical (9:16)');
  await b.fill('#make-prompt', 'A glass of fresh lemonade on a sunny wooden cafe table, ice cubes, the camera slowly pushes in');
  await b.fill('#make-caption', 'Fresh lemonade. Made slowly.');
  await b.shot('studio-video-form');
  await b.click('#make-go');
  await b.waitFor('!!document.querySelector("#studio-jobs .job[data-state=rendering]")', 15000);
  const id = await b.eval('document.querySelector("#studio-jobs .job").dataset.id');
  check(true, `the render started as job ${id} (${at()})`);
  await sleep(20000);
  check(/elapsed/.test(await b.text('#studio-jobs .job')), `the job shows its step and elapsed time: "${(await b.text('#studio-jobs .job [data-step]').catch(() => '')).trim()}"`);
  const record = await b.eval(`(async () => { const m = await import('/lib/api.js'); return m.drive.forAccount('org-${slug}').readJsonPath('studio/jobs', '${id}.json'); })()`);
  check(record?.state === 'rendering' && record.parts?.length === 1, `the job is recorded in studio/jobs/${id}.json (state ${record?.state}, step "${record?.step}")`);
  await b.shot('studio-video-rendering');

  // Leave the tab and come back: the render goes on in the page.
  await b.eval('location.hash = "tab=dashboard"');
  await sleep(8000);
  await b.eval('location.hash = "tab=studio"');
  await b.waitFor(`!!document.querySelector('#studio-jobs .job[data-id="${id}"]')`, 20000);
  check(true, `after a tab switch the job is still shown (${await b.eval(`document.querySelector('#studio-jobs .job[data-id="${id}"]').dataset.state`)})`);

  await b.waitFor(`['done','failed','interrupted'].includes(document.querySelector('#studio-jobs .job[data-id="${id}"]')?.dataset.state)`, 10 * 60 * 1000);
  const final = await b.eval(`(async () => { const m = await import('/lib/api.js'); return m.drive.forAccount('org-${slug}').readJsonPath('studio/jobs', '${id}.json'); })()`);
  console.log(`job after ${at()}: ${JSON.stringify({ state: final.state, step: final.step, error: final.error, file: final.file, parts: final.parts, charged: final.charged, creditsBefore: final.creditsBefore, creditsAfter: final.creditsAfter })}`);
  await b.shot('studio-video-done');
  if (!check(final.state === 'done', `the short is done (${final.state}${final.error ? `: ${final.error}` : ''}) in ${Math.round((final.updatedAt - final.startedAt) / 1000)} s`)) return;
  check(typeof final.charged === 'number', `the actual credits are recorded: ${final.charged} (estimated ${final.estimate.low}–${final.estimate.high})`);
  check(/Took \d+ credit/.test(await b.text(`#studio-jobs .job[data-id="${id}"]`)), 'the card says what the balance moved');

  // Reload: the library shows the short with a player that plays it.
  await b.goto(`${base}/app/?b=${slug}&view=library#tab=studio`);
  await b.waitFor('!!document.querySelector("#library")', 30000);
  const names = await b.eval('[...document.querySelectorAll("#library .piece b")].map(x => x.textContent)');
  check(names.includes(final.file.name), `the library lists ${final.file.name} (${names.join(', ')})`);
  await b.waitFor(`!!document.querySelector('#library .piece[data-id="${final.file.id}"] [data-play]')`, 10000);
  await b.click(`#library .piece[data-id="${final.file.id}"] [data-play]`);
  await b.waitFor(`(document.querySelector('#library .piece[data-id="${final.file.id}"] video')?.readyState ?? 0) >= 2`, 30000);
  const media = await b.eval(`(() => { const v = document.querySelector('#library .piece[data-id="${final.file.id}"] video'); return { w: v.videoWidth, h: v.videoHeight, d: v.duration }; })()`);
  check(media.w > 0 && media.h > media.w, `the short plays in the library, vertical (${media.w}×${media.h}, ${media.d} s)`);
  const raw = final.parts[0].file;
  await b.eval(`(async () => { const v = document.querySelector('#library .piece[data-id="${final.file.id}"] video'); v.currentTime = 2.5; await new Promise(r => v.onseeked = r); })()`).catch(() => null);
  await b.shot('studio-video-library');

  // The launch film's stitch, in the page, on the paid clip twice (no second clip is bought).
  const film = await b.eval(`(async () => {
    const api = await import('/lib/api.js'); const v = await import('/app/tabs/_video.js');
    const blob = await (await api.drive.read('${raw.id}')).blob();
    const out = await v.compose([blob, blob], { endCard: 'Clip Test Co' });
    const el = document.createElement('video'); el.muted = true; el.src = URL.createObjectURL(out);
    await new Promise((r, j) => { el.onloadedmetadata = r; el.onerror = () => j(new Error('the film does not load')); });
    return { type: out.type, size: out.size, w: el.videoWidth, h: el.videoHeight, rawSize: blob.size };
  })()`);
  check(film.size > 0 && film.w > 0, `two clips stitch into one film in the page (${film.type}, ${film.size} bytes, ${film.w}×${film.h}; a clip is ${film.rawSize} bytes)`);
  check(Math.round((Date.now() - t0) / 1000) > 0, `the whole run took ${at()}`);
}

async function erase() {
  let said = 'not tried';
  for (let i = 0; i < 4 && said !== 'erased' && said !== 'no account'; i++) {
    if (i) await sleep(5000 * i);
    const tok = await (await fetch(`${api}/oauth/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: 'vibestartup', username: email, password, scope: '*' }) })).json().catch(() => ({}));
    if (!tok.access_token) { said = tok.error === 'invalid_grant' ? 'no account' : `sign-in: ${tok.error}`; continue; }
    const r = await fetch(`${api}/me/erase`, { method: 'POST', headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' }, body: '{"confirm":true}' });
    said = r.ok ? 'erased' : `erase: ${r.status} ${(await r.text()).slice(0, 120)}`;
  }
  check(said === 'erased' || said === 'no account', `the account ${email} is erased (${said})`);
}

try {
  await withBrowser(async b => { try { await run(b); } catch (e) { problems.push(`the run stopped: ${e.message}`); console.log(`stopped: ${e.message}`); await b.shot('studio-video-stopped').catch(() => null); } }, { out: shots, width: 1440, height: 900 });
} finally { await erase().catch(e => problems.push(`erasing ${email}: ${e.message}`)); await stop?.(); }

console.log(problems.length ? `\n${problems.length} problem${problems.length === 1 ? '' : 's'}:\n${problems.map(p => ` - ${p}`).join('\n')}` : '\nno problems');
process.exit(problems.length ? 1 : 0);
