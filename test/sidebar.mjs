// The rail's levels, from a blank browser: an account made at /auth/, a business, a message to the co-founder, 7 more
// chats made with the rail's "New chat" (each with a line and its reply), the rail's 5 most recent chats and "More"
// for the rest, an older chat opened (its lines, and a live reply), the levels of Analytics, Tasks and Files as
// addressable views, the keys, then the same at 390 px in the phone's drawer. No sideways scroll, no console error.
// The account is erased at the end.
//
//   node test/sidebar.mjs --url https://vibestartup.pro            the site in production (its API)
//   node test/sidebar.mjs --api https://api-dev.commandagi.com     this checkout's site, served here, on that API
//   node test/sidebar.mjs ... --out <dir> --keep
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { withBrowser, sleep } from './browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const flag = name => process.argv.includes(`--${name}`);
const out = arg('out') ?? path.join(here, '..', '.test-results', 'sidebar');
await mkdir(out, { recursive: true });
const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); else console.log(`  ok: ${what}`); return ok; };
const stamp = Date.now().toString(36);
const email = `sidebar-${stamp}@example.com`;
const PASSWORD = 'correct horse battery';

let base = arg('url'), stop = null;
if (!base) {
  const { startLocal } = await import('./local.mjs');
  const local = await startLocal({ port: 0, api: arg('api') ?? null });
  base = local.url; stop = local.stop;
}
console.log(`site ${base} · account ${email}`);
let made = false;

const subItems = b => b.eval(`[...document.querySelectorAll('#tabs .sub a.sub-item')].map(a => ({ label: a.innerText.split('\\n')[0], href: a.getAttribute('href'), current: a.getAttribute('aria-current') === 'page' }))`);
const threadOf = href => new URLSearchParams(String(href).split('#')[1] ?? '').get('thread');
/** The rail's row of chat `id` (an id has characters an href encodes), marked so a selector names it. */
const markChat = (b, id) => b.eval(`(() => { document.querySelectorAll('[data-pick]').forEach(e => e.removeAttribute('data-pick')); const a = [...document.querySelectorAll('#tabs .sub a.sub-item')].find(a => new URLSearchParams(a.getAttribute('href').split('#')[1]).get('thread') === ${JSON.stringify(id)}); a?.setAttribute('data-pick', ''); return !!a; })()`);
const chatAt = (b, i) => b.eval(`(() => { const a = document.querySelectorAll('#tabs .sub a.sub-item')[${i}]; return a ? new URLSearchParams(a.getAttribute('href').split('#')[1]).get('thread') : null; })()`);
const currentChat = b => b.eval(`(() => { const a = document.querySelector('#tabs .sub a.sub-item[aria-current="page"]'); return a ? new URLSearchParams(a.getAttribute('href').split('#')[1]).get('thread') : null; })()`);
const hashThread = b => b.eval(`new URLSearchParams(location.hash.slice(1)).get('thread')`);
/** Send a line in the chat shown and wait for the co-founder's answer to it. */
async function say(b, text, label) {
  const before = await b.eval('document.querySelectorAll(".msg.cofounder").length');
  await b.fill('#composer', text);
  await b.click('#send');
  const t0 = Date.now();
  const ok = await b.waitFor(`document.querySelectorAll(".msg.cofounder").length > ${before}`, 120000).then(() => true, () => false);
  check(ok, `${label}: the co-founder answered${ok ? ` in ${((Date.now() - t0) / 1000).toFixed(1)} s` : ' within 120 s'}`);
  return ok;
}

async function run(b) {
  const shot = async (name, width) => {
    const s = await b.shot(name);
    check(s.sideways <= 0 && s.width <= width, `${name}: no sideways scroll (${s.sideways}px, ${s.width}px wide)`);
  };

  // 1. An account, through the sign-up form.
  await b.goto(`${base}/auth/`);
  await b.waitFor('!!document.querySelector("#signup")');
  await b.eval('document.querySelector("#signup")?.hidden && document.querySelector("[data-show=signup], #to-signup")?.click()');
  await b.waitFor('!document.querySelector("#signup").hidden', 5000).catch(() => null);
  await b.fill('#signup [name=name]', 'Sidebar Person');
  await b.fill('#signup [name=email]', email);
  await b.fill('#signup [name=password]', PASSWORD);
  if (await b.eval('!!document.querySelector("#signup [name=birthdate]")')) await b.eval('(() => { const i = document.querySelector("#signup [name=birthdate]"); i.value = "1990-05-05"; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); })()');
  await b.click('#signup button[type=submit]');
  made = true;
  await b.waitFor('location.pathname !== "/auth/"', 30000);

  // 2. A business, by the code the wizard runs (the wizard itself is test/journey.mjs's).
  const t0 = Date.now();
  const slug = await b.eval(`(async () => { const { createBusiness } = await import('/lib/business.js'); const biz = await createBusiness({ idea: 'Small-batch hot sauce sold at farmers markets', name: 'Ember ${stamp.slice(-4)}', vibe: 'warm', voice: 'casual', partner: 'operator', cofounder: 'Remy' }); return biz.slug; })()`);
  console.log(`business ${slug} in ${Math.round((Date.now() - t0) / 1000)} s`);
  await b.goto(`${base}/app/?b=${encodeURIComponent(slug)}#tab=chat`);
  await b.waitFor('!!document.querySelector("#composer") && !!document.querySelector("#tabs .sub")', 30000);
  const main = await b.eval(`(async () => { const { readBusiness } = await import('/lib/business.js'); return (await readBusiness(${JSON.stringify(slug)})).cofounder?.threadId ?? null; })()`);
  check(!!main, 'the business has its co-founder thread');
  await b.waitFor('document.querySelectorAll("#tabs .sub a.sub-item").length >= 1', 15000).catch(() => null);
  check(await b.eval('document.querySelector("#tabs a[data-tab=chat]").getAttribute("aria-expanded") === "true"'), 'Chat is open in the rail while it is shown');
  check(await hashThread(b) === main, 'Chat with no thread named opens the most recent one (the first chat), and the address names it');
  let items = await subItems(b);
  check(items.length === 1 && items[0].current && threadOf(items[0].href) === main, `the rail lists the one chat, marked (${JSON.stringify(items.map(i => i.label))})`);
  check(await b.eval('!!document.querySelector("#tabs .sub [data-action=new-chat]")'), 'the rail has "New chat"');
  // The welcome first (a template, then the opening's reply), so the answer counted is the answer to this line.
  await b.waitFor('document.querySelectorAll(".msg.cofounder").length >= 1 && !document.querySelector(".typing, .streaming")', 90000).catch(() => null);
  await sleep(3000);
  await say(b, 'In one short line: what is the first thing to do?', 'the first chat');
  await shot('chat-first-1440', 1440);

  // 3. Seven more chats, from the rail's "New chat", each with one line.
  const ids = [main];
  for (let i = 1; i <= 7; i++) {
    const was = await hashThread(b);
    await b.click('#tabs .sub [data-action=new-chat]');
    await b.waitFor(`(new URLSearchParams(location.hash.slice(1)).get('thread') ?? '') !== ${JSON.stringify(was)} && !!document.querySelector('#composer')`, 30000);
    const id = await hashThread(b);
    ids.push(id);
    for (let k = 0; k < 30 && await currentChat(b) !== id; k++) await sleep(500);
    check(await currentChat(b) === id, `chat ${i + 1}: the new chat is in the rail, marked`);
    check(await b.eval('document.querySelectorAll(".msg.cofounder").length === 0 && !document.querySelector(".typing")'), `chat ${i + 1}: a new chat starts empty, with nobody typing`);
    await say(b, `Chat ${i + 1}: reply with the word "noted" only.`, `chat ${i + 1}`);
  }
  check(new Set(ids).size === 8, 'eight different chats');

  // 4. The rail: the 5 most recently active and "More"; "More" brings the rest, each once.
  await b.eval('location.hash = "tab=dashboard"'); await sleep(500);
  check(await b.eval('document.querySelector("#tabs a[data-tab=chat]").getAttribute("aria-expanded") === "false" && !document.querySelector("#sub-chat")'), 'Chat is closed in the rail on another tab');
  await b.eval('location.hash = "tab=chat"');
  await b.waitFor('document.querySelectorAll("#tabs .sub a.sub-item").length >= 5', 20000).catch(() => null);
  await sleep(800);
  items = await subItems(b);
  const recent = [...ids].reverse();
  check(items.length === 5, `the rail shows 5 chats (${items.length})`);
  check(JSON.stringify(items.map(i => threadOf(i.href))) === JSON.stringify(recent.slice(0, 5)), `the 5 are the most recently active, newest first (${items.map(i => i.label).join(' | ')})`);
  check(await hashThread(b) === recent[0], 'Chat opens the most recently active chat');
  check(await b.eval('!!document.querySelector("#tabs .sub [data-more]")'), 'the rail has "More"');
  await shot('chat-rail-5-1440', 1440);
  await b.click('#tabs .sub [data-more]');
  await b.waitFor('document.querySelectorAll("#tabs .sub a.sub-item").length >= 8', 20000).catch(() => null);
  items = await subItems(b);
  check(items.length === 8 && JSON.stringify(items.map(i => threadOf(i.href))) === JSON.stringify(recent), `"More" shows the other 3, each once (${items.length})`);
  check(!await b.eval('!!document.querySelector("#tabs .sub [data-more]")'), '"More" goes when there is no more');
  await shot('chat-rail-more-1440', 1440);

  // 5. An older chat: its own lines, and a live reply over its socket.
  await markChat(b, main);
  await b.click('#tabs .sub a.sub-item[data-pick]');
  await b.waitFor(`new URLSearchParams(location.hash.slice(1)).get('thread') === ${JSON.stringify(main)}`, 10000);
  await b.waitFor('[...document.querySelectorAll(".msg.me")].some(m => /first thing to do/.test(m.innerText))', 20000).catch(() => null);
  check(await b.eval('[...document.querySelectorAll(".msg.me")].some(m => /first thing to do/.test(m.innerText)) && ![...document.querySelectorAll(".msg.me")].some(m => /Chat \\d/.test(m.innerText))'), 'the first chat shows its own lines and none of the others\'');
  check(await currentChat(b) === main, 'the rail marks the chat shown');
  await say(b, 'One more short line, please: what is the second thing to do?', 'the older chat (live)');
  for (let k = 0; k < 80 && await chatAt(b, 0) !== main; k++) await sleep(500);
  check(await chatAt(b, 0) === main, 'a chat used again moves to the top of the rail');
  await shot('chat-older-1440', 1440);

  // 6. Keys: ← from a chat goes to Chat, ↓ back to the chat, and only one row is in the Tab order.
  await b.eval(`document.querySelector('#tabs .sub a.sub-item[aria-current="page"]').focus()`);
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 });
  check(await b.eval('document.activeElement?.dataset.tab === "chat"'), '← goes from a chat to Chat');
  check(await b.eval('[...document.querySelectorAll("#tabs [data-key]")].filter(r => r.tabIndex === 0).length === 1'), 'one row of the rail is in the Tab order');

  // 7. Analytics, Tasks and Files: their views, as addresses.
  await b.click('#tabs a[data-tab=analytics]');
  await b.waitFor('!!document.querySelector("#sub-analytics")', 10000);
  check(JSON.stringify((await subItems(b)).map(i => i.label)) === JSON.stringify(['Overview', 'Activity', 'The site']), 'Analytics lists Overview, Activity, The site');
  await b.clickText('#tabs .sub a.sub-item', 'Activity');
  await b.waitFor('location.hash.includes("view=activity") && /Recent activity/.test(document.querySelector("#main").innerText)', 20000).catch(() => null);
  check(await b.eval('location.hash.includes("view=activity") && /Recent activity/.test(document.querySelector("#main").innerText) && !document.querySelector("#main .grid-4")'), '#tab=analytics&view=activity shows the activity alone');
  await shot('analytics-activity-1440', 1440);
  await b.eval('location.hash = "tab=analytics&view=site"');
  await b.waitFor('/The site/.test(document.querySelector("#main").innerText) && !/Recent activity/.test(document.querySelector("#main").innerText)', 20000).catch(() => null);
  check(await b.eval('/The site/.test(document.querySelector("#main").innerText) && !/Recent activity/.test(document.querySelector("#main").innerText) && document.querySelector("#tabs .sub a[aria-current=page]")?.innerText.includes("The site")'), '#tab=analytics&view=site shows the site alone, marked in the rail');
  await b.eval('location.hash = "tab=tasks&view=routines"');
  await b.waitFor('!!document.querySelector("#routines")', 20000).catch(() => null);
  check(await b.eval('!!document.querySelector("#routines") && !document.querySelector("#approvals")'), '#tab=tasks&view=routines shows the routines alone');
  await b.eval('location.hash = "tab=files&view=identity"');
  await b.waitFor('/SOUL\\.md/.test(document.querySelector("#main").innerText)', 30000).catch(() => null);
  check(await b.eval('/SOUL\\.md/.test(document.querySelector("#main").innerText) && !/PLAYBOOK\\.md/.test(document.querySelector("#file-groups").innerText)'), '#tab=files&view=identity shows the identity files alone');
  await shot('files-identity-1440', 1440);

  // 8. A phone: the drawer holds the same tree; a chat opens from it.
  await b.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await b.eval('location.hash = "tab=chat"');
  await b.waitFor('!!document.querySelector("#composer") && !!document.querySelector(".levels-open")', 20000);
  await sleep(800);
  await shot('chat-390', 390);
  await b.click('.levels-open');
  await b.waitFor('document.body.dataset.rail === "open"', 5000);
  await sleep(400);
  check(await b.eval('document.querySelectorAll("#tabs .sub a.sub-item").length >= 5 && document.querySelector("#tabs .sub a.sub-item").getBoundingClientRect().height >= 44'), 'the phone\'s drawer lists the chats, 44 px rows');
  await shot('chat-drawer-390', 390);
  const second = await chatAt(b, 1);
  await markChat(b, second);
  await b.click('#tabs .sub a.sub-item[data-pick]');
  for (let k = 0; k < 20 && (await hashThread(b) !== second || await b.eval('document.body.dataset.rail === "open"')); k++) await sleep(500);
  check(await hashThread(b) === second && await b.eval('document.body.dataset.rail !== "open"'), 'a chat opened from the drawer is shown, and the drawer closes');
  await b.eval('location.hash = "tab=analytics&view=overview"');
  await b.waitFor('!!document.querySelector("#main .grid-4")', 20000).catch(() => null);
  await b.click('.levels-open');
  await sleep(400);
  await shot('analytics-drawer-390', 390);
  check(await b.eval('document.querySelector("#tabs .sub a[aria-current=page]")?.innerText.includes("Overview")'), 'the phone\'s drawer marks Analytics › Overview');

  for (const p of b.problems) check(false, `browser: ${p}`);
}

async function erase() {
  if (!made || flag('keep')) return;
  const api = arg('api') ?? (await (await fetch(`${base}/brand.js`)).text()).match(/"api":"([^"]+)"/)?.[1];
  for (let i = 0; i < 4; i++) {
    if (i) await sleep(5000 * i);
    const tok = await (await fetch(`${api}/oauth/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: 'vibestartup', username: email, password: PASSWORD, scope: '*' }) })).json().catch(() => ({}));
    if (!tok.access_token) { if (tok.error === 'invalid_grant') return; continue; }
    const r = await fetch(`${api}/me/erase`, { method: 'POST', headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' }, body: '{"confirm":true}' });
    if (r.ok) { console.log(`erased ${email}`); return; }
  }
  problems.push(`the account ${email} is left on ${api}`);
}

try {
  await withBrowser(async b => { try { await run(b); } catch (e) { problems.push(`the run stopped: ${e.message}`); await b.shot('stopped').catch(() => null); } }, { out, width: 1440, height: 900 });
} finally { await erase().catch(e => problems.push(`erase: ${e.message}`)); await stop?.(); }
console.log(problems.length ? `\n${problems.length} problem(s):\n${problems.map(p => ` - ${p}`).join('\n')}` : '\nno problems');
process.exit(problems.length ? 1 : 0);
