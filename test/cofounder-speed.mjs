// How fast the co-founder answers a new business: one account, the wizard to a business, then the console. It prints
// the seconds from the wizard's last step to the console, and from the console's opening to the co-founder's first
// visible words, to its first full message, and to the first approval card (the day-one proposal). The account is
// erased at the end, also when the run fails.
//
//   node test/cofounder-speed.mjs --api https://api.commandagi.com [--width 1440] [--wait 120]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withBrowser, sleep } from './browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const api = arg('api') ?? 'https://api.commandagi.com';
const width = Number(arg('width') ?? 1440);
const waitS = Number(arg('wait') ?? 120);
const email = `speed-${Date.now().toString(36)}@example.com`;
const password = 'correct horse battery';

const { startLocal } = await import('./local.mjs');
const local = await startLocal({ port: 0, api });
const out = {};
let failure = null;
try {
  const r = await fetch(`${api}/oauth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: 'vibestartup', name: 'Speed Person', email, password, scope: '*' }) });
  const tok = await r.json();
  if (!r.ok) throw Error(`sign-up: ${r.status} ${JSON.stringify(tok)}`);
  await fetch(`${api}/me/profile`, { method: 'POST', headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' }, body: '{"birthdate":"1990-01-01"}' });
  const me = await (await fetch(`${api}/me`, { headers: { authorization: `Bearer ${tok.access_token}` } })).json();
  const stored = JSON.stringify({ access: tok.access_token, refresh: tok.refresh_token ?? null, expiresAt: Date.now() + (Number(tok.expires_in) || 3600) * 1000, userId: me.id });
  await withBrowser(async b => {
    await b.goto(`${local.url}/`);
    await b.eval(`localStorage.setItem('vs_auth', ${JSON.stringify(stored)})`);
    await b.goto(`${local.url}/start/?idea=${encodeURIComponent('Hand-thrown ceramic mugs sold to cafes by subscription')}`);
    await b.waitFor('document.querySelector("#wizard")?.dataset.step === "idea"', 20000);
    for (const step of ['idea', 'blueprint', 'name', 'vibe', 'voice', 'partner', 'cofounder']) {
      await b.waitFor(`document.querySelector("#wizard")?.dataset.step === ${JSON.stringify(step)}`, 10000);
      if (step === 'blueprint') await b.click('#choices .choice.suggested');
      if (step === 'name') await b.fill('#own', `Kiln ${Date.now().toString(36).slice(-4)}`);
      await b.click('#continue');
    }
    await b.waitFor('document.querySelector("#wizard")?.dataset.step === "updates"', 10000);
    await b.click('#continue');
    const t0 = Date.now();
    await b.waitFor('location.pathname === "/app/"', 420000);
    const opened = Date.now();
    out.buildS = (opened - t0) / 1000;
    // Sample the chat every 100 ms: the first co-founder words (a streaming bubble counts), a full message, a card.
    const deadline = opened + waitS * 1000;
    while (Date.now() < deadline && !(out.firstWordsS && out.firstMessageS && out.approvalS)) {
      const s = await b.eval(`(() => { const c = document.querySelector('#chat'); if (!c) return {}; const words = [...c.querySelectorAll('.msg.cofounder .text')].some(t => t.innerText.trim().length > 0); return { words, message: !!c.querySelector('.msg.cofounder:not(.streaming) .text'), typing: !!c.querySelector('.typing, .composing'), card: !!c.querySelector('.approval') }; })()`).catch(() => ({}));
      const at = (Date.now() - opened) / 1000;
      if (s.typing && out.typingS == null) out.typingS = at;
      if (s.words && out.firstWordsS == null) out.firstWordsS = at;
      if (s.message && out.firstMessageS == null) out.firstMessageS = at;
      if (s.card && out.approvalS == null) out.approvalS = at;
      await sleep(100);
    }
    out.transcript = await b.eval(`[...document.querySelectorAll('#chat .msg')].map(m => m.className.replace('msg ', '') + ': ' + (m.querySelector('.text')?.innerText ?? '').slice(0, 160).replace(/\\n/g, ' '))`).catch(() => []);
    await b.shot('cofounder-speed');
  }, { out: path.join(here, '..', '.test-results'), width, height: 900 });
} catch (e) { failure = e; } finally {
  const tok = await (await fetch(`${api}/oauth/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: 'vibestartup', username: email, password, scope: '*' }) })).json().catch(() => ({}));
  const erased = tok.access_token ? (await fetch(`${api}/me/erase`, { method: 'POST', headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' }, body: '{"confirm":true}' })).status : 'no token';
  out.erased = erased;
  await local.stop();
}
console.log(JSON.stringify({ email, ...out }, null, 2));
if (failure) { console.error(failure); process.exit(1); }
