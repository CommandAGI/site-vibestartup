// How fast the co-founder answers a new business: one account, the wizard to a business, then the console. It prints
// the seconds from the wizard's last step to the console, and from the console's opening to the co-founder's first
// visible words, to its first full message, and to the first approval card (the day-one proposal). Then the founder
// writes `--replies` times (default 2) and each reply's first words and whole message are timed. Last, the co-founder
// agent's model calls (`GET /agents/:id/cost`): input tokens and the share the provider read from its prompt cache.
// The account's own model floor (lib/business.js FOUNDER_FLOOR, set at sign-up) is read back. The business's tasks are
// listed with their keys, and a title or a key that is there twice is reported (`tasks.duplicateTitles`, `duplicateKeys`). The account is erased at
// the end, also when the run fails.
//
//   node test/cofounder-speed.mjs --api https://api.commandagi.com|local [--width 1440] [--wait 120] [--replies 2]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withBrowser, sleep } from './browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
// `--api local` starts a local platform from COMMANDAGI_ROOT's checkout (test/local.mjs).
const apiArg = arg('api') ?? 'https://api.commandagi.com';
const width = Number(arg('width') ?? 1440);
const waitS = Number(arg('wait') ?? 120);
const replies = Number(arg('replies') ?? 2);
const QUESTIONS = ['What should I put on the storefront first?', 'Give me one idea for a launch post.', 'What price would you start with?'];
const email = `speed-${Date.now().toString(36)}@example.com`;
const password = 'correct horse battery';

const { startLocal } = await import('./local.mjs');
const local = await startLocal({ port: 0, api: apiArg === 'local' ? null : apiArg });
const api = local.api;
const out = {};
let failure = null;
try {
  const r = await fetch(`${api}/oauth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: 'vibestartup', name: 'Speed Person', email, password, scope: '*' }) });
  const tok = await r.json();
  if (!r.ok) throw Error(`sign-up: ${r.status} ${JSON.stringify(tok)}`);
  await fetch(`${api}/me/profile`, { method: 'POST', headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' }, body: '{"birthdate":"1990-01-01"}' });
  const me = await (await fetch(`${api}/me`, { headers: { authorization: `Bearer ${tok.access_token}` } })).json();
  const stored = JSON.stringify({ access: tok.access_token, refresh: tok.refresh_token ?? null, expiresAt: Date.now() + (Number(tok.expires_in) || 3600) * 1000, userId: me.id });
  const call = async (p, init = {}) => { const res = await fetch(`${api}${p}`, { ...init, headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json', ...(init.headers ?? {}) } }); return { status: res.status, body: await res.json().catch(() => null) }; };
  // The sign-up's floor, as auth/auth.js sets it (the founder's own act with the founder's token).
  const FOUNDER_FLOOR = [{ model: 'anthropic/claude-sonnet-5-5' }, { model: 'openai/gpt-6-luna' }];
  out.floorSet = (await call('/integrations/*/model-floor', { method: 'PUT', body: JSON.stringify({ floor: FOUNDER_FLOOR }) })).status;
  out.floorRead = (await call('/integrations')).body?.integrations?.map(e => e.modelFloor).find(f => f?.key === '*') ?? null;
  await withBrowser(async b => {
    await b.goto(`${local.url}/`);
    await b.eval(`localStorage.setItem('vs_auth', ${JSON.stringify(stored)})`);
    await b.goto(`${local.url}/start/?idea=${encodeURIComponent('Hand-thrown ceramic mugs sold to cafes by subscription')}`);
    await b.waitFor('document.querySelector("#wizard")?.dataset.step === "idea"', 20000);
    for (const step of ['idea', 'blueprint', 'name', 'vibe', 'voice', 'partner', 'cofounder']) {
      await b.waitFor(`document.querySelector("#wizard")?.dataset.step === ${JSON.stringify(step)}`, 10000);
      if (step === 'blueprint') { await b.waitFor('!!document.querySelector("#choices .choice")', 15000); await b.click('#choices .choice.suggested, #choices .choice'); }
      if (step === 'name') await b.waitFor('!!document.querySelector("#tagline")', 15000);
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
    // The founder writes; each reply is timed from the send to its first words (a streaming bubble) and its message.
    out.replies = [];
    for (let i = 0; i < replies; i++) {
      await b.waitFor(`!document.querySelector('#chat .msg.cofounder.streaming')`, 60000).catch(() => null);
      const count = await b.eval(`document.querySelectorAll('#chat .msg.cofounder:not(.streaming)').length`);
      await b.fill('#composer', QUESTIONS[i % QUESTIONS.length]);
      const sent = Date.now();
      await b.click('#send');
      const r = { question: QUESTIONS[i % QUESTIONS.length] };
      while (Date.now() - sent < 120000 && r.messageS == null) {
        const s = await b.eval(`(() => { const c = document.querySelector('#chat'); return { streaming: [...c.querySelectorAll('.msg.cofounder.streaming .text')].some(t => t.innerText.trim()), done: c.querySelectorAll('.msg.cofounder:not(.streaming)').length }; })()`).catch(() => ({}));
        const at = (Date.now() - sent) / 1000;
        if ((s.streaming || s.done > count) && r.firstWordsS == null) r.firstWordsS = at;
        if (s.done > count) r.messageS = at;
        await sleep(100);
      }
      out.replies.push(r);
      await sleep(4000);
    }
    const slug = new URL(await b.eval('location.href')).searchParams.get('b');
    // The business is the org org-<slug>: its record at its Drive's root, its tasks in its Tasks/.
    const biz = (await call(`/accounts/org-${encodeURIComponent(slug)}/files/business.json`)).body;
    // The business's tasks after the replies: a repeated task_create with a card's taskKey answers that card, so each
    // title and each key is there once (production, 2026-11-11: each founder message made one to three more cards).
    const listed = (await call(`/me/tasks/query?owner=org&ownerScope=org-${encodeURIComponent(slug)}`, { method: 'POST', body: JSON.stringify({ labels: [`biz:${slug}`], includeClosed: true }) })).body?.tasks ?? [];
    const twice = list => [...new Set(list.filter((v, i) => v && list.indexOf(v) !== i))];
    out.tasks = { count: listed.length, titles: listed.map(t => t.title), keys: listed.map(t => t.taskKey ?? null), duplicateTitles: twice(listed.map(t => t.title)), duplicateKeys: twice(listed.map(t => t.taskKey)) };
    out.welcome = biz?.cofounder?.welcome ? { template: biz.cofounder.welcome.template, kept: biz.cofounder.welcome.kept } : null;
    const agentId = biz?.cofounder?.agentId;
    // Model calls settle into their rows a moment after the turn.
    await sleep(5000);
    const cost = agentId ? (await call(`/agents/${encodeURIComponent(agentId)}/cost`)).body : null;
    out.calls = cost ? { calls: cost.calls, inputTokens: cost.inputTokens, cachedInputTokens: cost.cachedInputTokens, cachedShare: cost.inputTokens ? Math.round((cost.cachedInputTokens / cost.inputTokens) * 1000) / 1000 : null, outputTokens: cost.outputTokens } : null;
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
