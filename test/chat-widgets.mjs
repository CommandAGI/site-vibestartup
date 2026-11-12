// The co-founder's chat controls, end to end with a real model: one throwaway account, the wizard to a business, then
// the founder asks for a choice. The co-founder answers with a select (a ```cagi-ask block); the founder clicks an
// option in the page; the server locks it (message.update) and the co-founder replies to the answer. Then the same with
// a slider (a budget) set with the keyboard. Each step is timed from the founder's act, the transcript is read back
// through the API (the answer on the widget, the founder's line, the co-founder's reply after it), and screenshots are
// taken at --width and at 390 px. The account is erased at the end, also when the run fails.
//
//   node test/chat-widgets.mjs [--url https://vibestartup.commandagi.app] [--api https://api.commandagi.com|local]
//                              [--out <dir>] [--width 1440] [--no-slider] [--refused] [--keep]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withBrowser, sleep } from './browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const apiArg = arg('api') ?? 'https://api.commandagi.com';
const width = Number(arg('width') ?? 1440);
const out = arg('out') ?? path.join(here, '..', '.test-results', 'chat-widgets');
const slider = !process.argv.includes('--no-slider');
// The thread refuses a slider answer out of its range (WIDGET_ANSWER_REFUSED); the page shows why on that widget.
const refused = process.argv.includes('--refused');
// Keep the account and its threads, so CommandAGI can read the thread's events afterwards; the report names the account.
const keep = process.argv.includes('--keep');
const email = `widgets-${Date.now().toString(36)}@example.com`;
const password = 'correct horse battery';
const ASK_SELECT = 'Which starting price should we use for one mug? Give me three prices to choose from as buttons in the chat.';
const ASK_SLIDER = 'How much should we spend on ads in the first month? Let me pick the amount with a slider in the chat.';

let site = arg('url'), local = null;
if (!site) { const { startLocal } = await import('./local.mjs'); local = await startLocal({ port: 0, api: apiArg === 'local' ? null : apiArg }); site = local.url; }
const api = local?.api ?? apiArg;
const result = { site, api, email, checks: [] };
let failure = null;
const check = (ok, what) => { result.checks.push(`${ok ? 'ok' : 'FAIL'} ${what}`); if (!ok) throw Error(what); };
try {
  const r = await fetch(`${api}/oauth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: 'vibestartup', name: 'Widget Person', email, password, scope: '*' }) });
  const tok = await r.json();
  if (!r.ok) throw Error(`sign-up: ${r.status} ${JSON.stringify(tok)}`);
  const call = async (p, init = {}) => { const res = await fetch(`${api}${p}`, { ...init, headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json', ...(init.headers ?? {}) } }); return { status: res.status, body: await res.json().catch(() => null) }; };
  await call('/me/profile', { method: 'POST', body: '{"birthdate":"1990-01-01"}' });
  const me = (await call('/me')).body;
  // The sign-up's floor, as auth/auth.js sets it.
  await call('/integrations/*/model-floor', { method: 'PUT', body: JSON.stringify({ floor: [{ model: 'anthropic/claude-sonnet-5-5' }, { model: 'openai/gpt-6-luna' }] }) });
  // Who pays for the org's chats: the founder's own credits, the free ones first (docs/schema.md § who pays).
  const creditsBefore = (await call('/me/credits')).body;
  const aiUsed = async () => ((await call('/quota')).body?.categories ?? []).find(c => c.category === 'ai')?.used ?? null;
  const allowanceBefore = await aiUsed();
  const stored = JSON.stringify({ access: tok.access_token, refresh: tok.refresh_token ?? null, expiresAt: Date.now() + (Number(tok.expires_in) || 3600) * 1000, userId: me.id });
  await withBrowser(async b => {
    const problemsAt = () => b.problems.filter(p => !/favicon|ws-token|WebSocket/.test(p));
    await b.goto(`${site}/`);
    await b.eval(`localStorage.setItem('vs_auth', ${JSON.stringify(stored)})`);
    await b.goto(`${site}/start/?idea=${encodeURIComponent('Hand-thrown ceramic mugs sold to cafes by subscription')}`);
    for (const step of ['idea', 'blueprint', 'name', 'vibe', 'voice', 'partner', 'cofounder']) {
      await b.waitFor(`document.querySelector("#wizard")?.dataset.step === ${JSON.stringify(step)}`, 20000);
      if (step === 'blueprint') { await b.waitFor('!!document.querySelector("#choices .choice")', 20000); await b.click(await b.eval('!!document.querySelector("#choices .choice.suggested")') ? '#choices .choice.suggested' : '#choices .choice'); }
      if (step === 'name') await b.fill('#own', `Kiln ${Date.now().toString(36).slice(-4)}`);
      await b.click('#continue');
    }
    await b.waitFor('document.querySelector("#wizard")?.dataset.step === "updates"', 10000);
    await b.click('#continue');
    await b.waitFor('location.pathname === "/app/"', 420000);
    // The day-one turn ends first (its two cards and its line), so the question is a turn of its own.
    await b.waitFor(`document.querySelectorAll('#chat .approval').length >= 1 && !document.querySelector('#chat .msg.cofounder.streaming, #chat .typing')`, 180000).catch(() => null);
    await sleep(3000);
    const slug = await b.eval(`new URL(location.href).searchParams.get('b')`);
    const biz = await (async () => {
      // The business is the org org-<slug>; its record is at the root of its Drive.
      return (await call(`/accounts/org-${encodeURIComponent(slug)}/files/business.json`)).body;
    })();
    const thread = biz?.cofounder?.threadId;
    result.thread = { id: thread };
    check(!!thread, 'the business has a co-founder thread');
    const transcript = async () => (await call(`/threads/${encodeURIComponent(thread)}/chat?limit=100`)).body?.messages ?? [];

    // Ask, then wait for the widget the co-founder's message carries; answer it; wait for the lock and the reply.
    const round = async (label, question, kind, answer) => {
      const t = { question };
      const sent = Date.now();
      await b.fill('#composer', question);
      await b.click('#send');
      const sel = `#chat .ask[data-kind="${kind}"]:not(.answered)`;
      await b.waitFor(`!!document.querySelector('${sel}')`, 180000).catch(async e => {
        // What the co-founder made instead, for the report.
        result.lastMessages = (await transcript()).slice(-4).map(m => ({ role: m.role, text: m.text?.slice(0, 400), ui: m.ui ?? null, question: m.question ?? null, tool: m.tool?.name ?? null }));
        // Why: the model's own reasoning lines and any refusal of a call, from the thread's events.
        const ev = (await call(`/threads/${encodeURIComponent(thread)}/events?limit=300`)).body?.events ?? [];
        result.rawEvents = ev.filter(e => e.at >= sent).map(e => JSON.stringify(e).slice(0, 2000));
        result.why = ev.filter(e => e.event === 'agent_reasoning' || /^refused/.test(e.event ?? '') || e.event === 'platform.call').slice(-8).map(e => ({ event: e.event, text: e.text?.slice(0, 300), tool: e.tool, reason: e.reason }));
        await b.shot(`${label}-missing-${width}`);
        throw e;
      });
      // Absolute times too, to line up with the thread's events (each event's `at`).
      t.sentAt = sent; t.drawnAt = Date.now();
      t.widgetS = (t.drawnAt - sent) / 1000;
      await b.waitFor(`!document.querySelector('#chat .msg.cofounder.streaming')`, 60000).catch(() => null);
      t.widget = await b.eval(`(() => { const a = document.querySelector('${sel}'); return { id: a.dataset.widget, prompt: a.querySelector('.ask-prompt')?.innerText ?? null, options: [...a.querySelectorAll('.ask-opt')].map(o => o.innerText.replace(/\\n/g, ' · ')), range: a.querySelector('input[type=range]') ? { min: a.querySelector('input[type=range]').min, max: a.querySelector('input[type=range]').max, value: a.querySelector('input[type=range]').value } : null }; })()`);
      await b.shot(`${label}-open-${width}`);
      const before = await b.eval(`document.querySelectorAll('#chat .msg.cofounder:not(.streaming)').length`);
      const clicked = Date.now();
      t.sent = await answer(sel);
      // While sending, the widget is busy and its controls are off (or the server's lock came first).
      t.busySeen = await b.eval(`(() => { const a = document.querySelector('[data-widget="${t.widget.id}"]'); return !!a && (a.getAttribute('aria-busy') === 'true' || a.classList.contains('answered')); })()`);
      await b.waitFor(`!!document.querySelector('[data-widget="${t.widget.id}"].answered')`, 30000);
      t.lockedS = (Date.now() - clicked) / 1000;
      await b.waitFor(`document.querySelectorAll('#chat .msg.cofounder:not(.streaming)').length > ${before}`, 180000);
      t.replyS = (Date.now() - clicked) / 1000;
      await b.waitFor(`!document.querySelector('#chat .msg.cofounder.streaming')`, 60000).catch(() => null);
      await sleep(1500);
      const msgs = await transcript();
      const at = msgs.findIndex(m => m.id === t.widget.id);
      const entry = msgs[at];
      t.server = { kind: entry?.ui?.kind, answered: entry?.ui?.answered, answer: entry?.ui?.answer, question: entry?.question ?? null };
      t.near = msgs.slice(Math.max(0, at - 1)).map(m => ({ id: m.id, role: m.role, text: m.text?.slice(0, 120), ui: m.ui ? { kind: m.ui.kind, answered: m.ui.answered, answer: m.ui.answer } : null, question: m.question ?? null, reply: m.reply ?? null }));
      result[label] = t;
      const after = msgs.slice(at + 1);
      const founderLine = after.find(m => m.role === 'user');
      const reply = after.slice(after.indexOf(founderLine) + 1).find(m => m.role === 'agent' && m.text?.trim());
      t.founderLine = founderLine?.text ?? null;
      t.reply = reply?.text?.slice(0, 300) ?? null;
      check(entry?.ui?.answered === true, `${label}: the server holds the widget answered`);
      check(String(entry.ui.answer) === String(t.sent), `${label}: the server's answer is the one sent (${t.sent})`);
      check(!!founderLine && founderLine.text.includes(String(t.sent)), `${label}: the founder's line carries the answer`);
      check(!!reply, `${label}: the co-founder replied after the answer`);
      await b.shot(`${label}-answered-${width}`);
      return t;
    };

    result.select = await round('select', ASK_SELECT, 'select', async sel => {
      const value = await b.eval(`document.querySelector('${sel} .ask-opt').dataset.value`);
      await b.click(`${sel} .ask-opt`);
      return value;
    });
    check(result.select.widget.options.length >= 2, 'select: the co-founder offered two or more options');
    if (slider) {
      result.slider = await round('slider', ASK_SLIDER, 'slider', async sel => {
        if (refused) {
          // Past its max, as a changed page could send: the widget shows the thread's reason, stays open, and answers next.
          const max = Number(await b.eval(`document.querySelector('${sel} input[type=range]').max`));
          await b.eval(`(() => { const r = document.querySelector('${sel} input[type=range]'); r.max = ${max * 10}; r.value = ${max * 10}; r.dispatchEvent(new Event('input', { bubbles: true })); })()`);
          const at = Date.now();
          await b.click(`${sel} button[type=submit]`);
          await b.waitFor(`!!document.querySelector('${sel} .ask-error')`, 12000);
          result.refusal = { s: (Date.now() - at) / 1000, text: await b.eval(`document.querySelector('${sel} .ask-error').textContent`) };
          check(result.refusal.s < 7, `slider: a refused answer shows its reason before the 8 s fallback (${result.refusal.s} s: ${result.refusal.text})`);
          await b.shot(`slider-refused-${width}`);
        }
        // The keyboard sets it: focus the range, step it up three times, then send with the form's button.
        await b.eval(`document.querySelector('${sel} input[type=range]').focus()`);
        for (let i = 0; i < 3; i++) {
          await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
          await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
        }
        const value = await b.eval(`document.querySelector('${sel} input[type=range]').value`);
        const shown = await b.eval(`document.querySelector('${sel} output').textContent`);
        check(shown === value, `slider: the shown value follows the keys (${shown})`);
        await b.click(`${sel} button[type=submit]`);
        return value;
      });
    }
    // The answered widgets at the phone's width: no sideways scroll.
    await b.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(800);
    await b.eval(`document.querySelector('[data-widget="${result.select.widget.id}"]').scrollIntoView({ block: 'start' })`);
    const look = await b.shot('answered-390');
    result.sideways390 = look.sideways;
    check(look.sideways <= 0, 'at 390 px nothing scrolls sideways');
    // Billing shows the free allowance and this business's co-founder's calls (the allowance pays before the ledger).
    await b.eval('location.hash = "page=billing"');
    await b.waitFor('!!document.querySelector("#allowance [data-allowance]") && !!document.querySelector("#usage")', 30000);
    result.billing = await b.eval(`({ allowance: document.querySelector('#allowance [data-allowance]').textContent, usage: document.querySelector('#usage')?.innerText?.replace(/\\s+/g, ' ').slice(0, 200) ?? null })`);
    check(/\d+ of \d+/.test(result.billing.allowance), `Billing shows the free allowance (${result.billing.allowance})`);
    check(/for Kiln \S+ [1-9]\d* /.test(result.billing.usage ?? ''), `Billing lists the co-founder's calls (${result.billing.usage})`);
    await b.shot(`billing-${width}`);
    result.problems = problemsAt();
  }, { out, width, height: 900 });
  // Model calls settle into the ledger a moment after the turn.
  await sleep(8000);
  const creditsAfter = (await call('/me/credits')).body;
  const history = (await call('/me/credits/history')).body;
  result.credits = { before: creditsBefore, after: creditsAfter, history: (history?.entries ?? history?.history ?? history?.items ?? []).slice(0, 8) };
  result.thread.ownerScope = (await call(`/threads/${encodeURIComponent(result.thread?.id ?? '')}`)).body?.ownerScope ?? null;
  check(/^org-/.test(result.thread.ownerScope ?? ''), `the co-founder's chat is the org's (${result.thread.ownerScope})`);
  const allowanceAfter = await aiUsed();
  result.credits.allowance = { before: allowanceBefore, after: allowanceAfter };
  // The founder pays: the free ai allowance first (GET /quota), then the credits (the ledger). A part under one credit
  // waits for the next call, so the run is long enough to settle at least one.
  check(allowanceAfter > allowanceBefore || Number(creditsAfter?.credits) < Number(creditsBefore?.credits), `the org's chats were billed to the founder (allowance used ${allowanceBefore} → ${allowanceAfter}, credits ${creditsBefore?.credits} → ${creditsAfter?.credits})`);
} catch (e) { failure = e; } finally {
  const tok = await (await fetch(`${api}/oauth/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: 'vibestartup', username: email, password, scope: '*' }) })).json().catch(() => ({}));
  result.erased = keep ? 'kept (--keep)' : tok.access_token ? (await fetch(`${api}/me/erase`, { method: 'POST', headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' }, body: '{"confirm":true}' })).status : 'no token';
  await local?.stop();
}
console.log(JSON.stringify(result, null, 2));
if (failure) { console.error(failure); process.exit(1); }
