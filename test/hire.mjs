// Hiring the co-founder, from a blank browser: an account, a business record with its co-founder thread, Billing, the
// confirm sheet, a credit pack when the credits are short, the contract proposed and signed, then VibeStartup's
// signature and the escrow, and the account erased at the end. Before the launch (the listings are drafts, so the API
// does not show them to a founder) it checks the other half: each listing's Hire button is disabled with a Soon pill
// and "opens December 8", and stops there.
//
//   node test/hire.mjs --api https://api-dev.commandagi.com     the site here, against dev
//   node test/hire.mjs --url <site> --api <origin>              a site already running
//   options: --wait <minutes> (VibeStartup's signature, default 5), --keep (keep the account), --width 390
//
// VS_ADMIN_KEY, when set, is a staff key of that stack: it grants the throwaway account the credits the contract
// needs (POST /admin/console/users/:id/credits). Without it the run stops at the pack offer. The business is made
// through the API (a thread and business.json, as lib/business.js writes them), not the wizard: this run is about
// hiring, and the wizard's journey is test/journey.mjs.
//
// The listings are open on a stack after `POST /admin/console/seed/vibestartup/launch` there (docs/HANDOFF.md § hiring).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withBrowser, sleep } from './browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const flag = name => process.argv.includes(`--${name}`);
const shots = path.join(here, '..', '.test-results');
const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); else console.log(`  ok  ${what}`); return ok; };
const stamp = Date.now().toString(36);
const email = `hire-${stamp}@example.com`;
const password = 'correct horse battery';
const width = Number(arg('width') ?? 1440);

let base = arg('url'), stop = null, api = arg('api');
if (!base) {
  const { startLocal } = await import('./local.mjs');
  const local = await startLocal({ port: 0, api: api ?? null });
  base = local.url; api = local.api; stop = local.stop;
}
api ??= (await (await fetch(`${base}/brand.js`)).text()).match(/"api":"([^"]+)"/)?.[1];
console.log(`site ${base} · API ${api} · account ${email}`);

async function run(b) {
  // 1. An account, through the sign-up form.
  await b.goto(`${base}/auth/?next=${encodeURIComponent('/home/')}`);
  await b.eval('document.querySelector("[data-auth-switch]") && document.querySelector("#signup").hidden && document.querySelector("[data-auth-switch]").click()');
  await b.waitFor('!!document.querySelector("#signup") && !document.querySelector("#signup").hidden');
  await b.fill('#signup [name=name]', 'Hire Person');
  await b.fill('#signup [name=email]', email);
  await b.fill('#signup [name=password]', password);
  await b.eval('(() => { const i = document.querySelector("#signup [name=birthdate]"); if (!i) return; i.value = "1990-05-05"; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); })()');
  await b.click('#signup button[type=submit]');
  await b.waitFor('location.pathname === "/home/"', 30000);

  // 2. A business: its co-founder thread and its record, as lib/business.js writes them.
  const slug = `hire-${stamp}`;
  const made = JSON.parse(await b.eval(`(async () => {
    const { threads, drive, whoami } = await import('/lib/api.js');
    const me = await whoami();
    const t = await threads.create({ title: 'Hire test', agentName: 'Mae', systemPrompt: 'You are a test co-founder. Answer in one line.', intent: 'Wait for the founder.', surface: 'vibestartup', reality: 'simulation' });
    const biz = { slug: '${slug}', name: 'Hire test ${stamp}', idea: 'A test business for hiring the co-founder', cofounder: { name: 'Mae', threadId: t.threadId }, createdAt: Date.now() };
    await drive.ensure('Businesses/${slug}');
    await drive.writeJson('Businesses/${slug}', 'business.json', biz);
    return JSON.stringify({ userId: me.id, threadId: t.threadId });
  })()`));
  check(!!made.threadId, `a business with a co-founder thread (${made.threadId})`);

  // 3. Billing: the three listings, open or not.
  // A fresh load each time (a URL that differs only in its hash would not load the page again).
  let loads = 0;
  const billing = async () => {
    await b.goto(`${base}/app/?b=${slug}&load=${++loads}#page=billing`);
    await b.waitFor('!!document.querySelector("#main #plans article") && !document.querySelector("#main .skeleton")', 30000);
  };
  await billing();
  check(await b.eval('document.querySelectorAll("#plans article").length') === 3, 'Billing shows three listings');
  const open = await b.eval('!!document.querySelector("#plans [data-listing=listing-vibestartup-cofounder][data-open=\\"1\\"]")');
  await b.shot(`hire-billing-${width}`);
  if (!open) {
    check(await b.eval('document.querySelector("[data-hire=listing-vibestartup-cofounder]").disabled'), 'before the launch, Hire is disabled');
    check(await b.eval('!!document.querySelector("#plans [data-listing=listing-vibestartup-cofounder] .pill.soon, #plans [data-listing=listing-vibestartup-cofounder] .soon")'), 'before the launch, the listing wears a Soon pill');
    check(/opens December 8/i.test(await b.text('#main')), 'before the launch, Billing says it opens December 8');
    console.log('the listings are not open on this stack: the hire itself was not run');
    return;
  }

  // 4. The confirm sheet: what you get, the price in credits and dollars, the term, the ceiling, the renewal.
  await b.click('[data-hire=listing-vibestartup-cofounder]');
  await b.waitFor('!!document.querySelector("#hire-sheet")', 5000);
  const sheet = await b.text('#hire-sheet');
  check(/3,900 credits/.test(sheet) && /\$39/.test(sheet), 'the sheet names the price in credits and dollars');
  check(/30 days/.test(sheet) && /2,400 credits/.test(sheet) && /renews by itself/i.test(sheet), 'the sheet names the term, the ceiling and the renewal');
  await b.shot(`hire-sheet-${width}`);

  // 5. Short of credits: the sheet offers the pack that covers the price, and its checkout opens.
  if (await b.eval('!!document.querySelector("#hire-short")')) {
    check(await b.eval('document.querySelector("#hire-confirm").disabled'), 'short of credits, the sheet does not hire');
    const url = await b.eval(`(async () => { const { checkout } = await import('/lib/api.js'); const r = await checkout({ type: 'pack', packId: document.querySelector('#hire-short [data-buy]').dataset.buy }, '/app/?b=${slug}#page=billing'); return r?.url ?? ''; })()`).catch(e => `error: ${e.message}`);
    check(/^https:\/\/checkout\.stripe\.com\//.test(url), `the pack's checkout opens on Stripe (${String(url).slice(0, 40)}…)`);
    const admin = process.env.VS_ADMIN_KEY;
    if (!admin) { console.log('no VS_ADMIN_KEY: the run stops at the pack offer'); return; }
    const r = await fetch(`${api}/admin/console/users/${made.userId}/credits`, { method: 'POST', headers: { authorization: `Bearer ${admin}`, 'content-type': 'application/json' }, body: JSON.stringify({ amount: 4000, reason: 'vibestartup_hire_test' }) });
    check(r.ok, `the test account was granted 4,000 credits (${r.status})`);
    await billing();
    await b.click('[data-hire=listing-vibestartup-cofounder]');
    await b.waitFor('!!document.querySelector("#hire-sheet")', 5000);
  }

  // 6. Hire: the contract is proposed from the business's thread and signed by the founder.
  await b.click('#hire-confirm');
  await b.waitFor('!document.querySelector("#hire-sheet")', 30000);
  await b.waitFor('!!document.querySelector("#contracts .contract")', 30000);
  const status = await b.eval('document.querySelector("#contracts .contract").dataset.status');
  check(['proposed', 'active'].includes(status), `the contract is listed (${status})`);
  check((await b.text('#contracts')).includes('Hire test'), 'the contract names the business it is for');
  const contract = JSON.parse(await b.eval(`(async () => { const { services } = await import('/lib/api.js'); const cs = await services.contracts(); return JSON.stringify(cs.find(c => c.listingId === 'listing-vibestartup-cofounder') ?? null); })()`));
  check(contract?.customerThreadId === made.threadId, 'the contract was proposed from the business\'s co-founder thread');
  check(!!contract?.customerSignedAt, 'the founder signed');
  check(contract?.costCeilingCredits === 2400, `the contract carries the 2,400-credit ceiling (${contract?.costCeilingCredits})`);
  check(contract?.deadline && Math.abs(contract.deadline - (Date.now() + 30 * 86400000)) < 3600000, 'the contract ends 30 days from now');
  await b.shot(`hire-proposed-${width}`);

  // 7. VibeStartup's agent signs; then escrow holds the price and the contract is active.
  const until = Date.now() + Number(arg('wait') ?? 5) * 60000;
  let now = status;
  while (now !== 'active' && Date.now() < until) {
    await sleep(15000);
    await billing();
    now = await b.eval('document.querySelector("#contracts .contract")?.dataset.status ?? ""');
  }
  if (check(now === 'active', `VibeStartup signed and the escrow holds (${now})`)) {
    check(/days left/.test(await b.text('#contracts')), 'the active contract shows its days left');
    check(/2,400 credits/.test(await b.text('#contracts')), 'the active contract shows its ceiling');
    await b.shot(`hire-active-${width}`);
  } else {
    await b.shot(`hire-waiting-${width}`);
    // Cancel the proposal so nothing is left for the provider to sign after the account goes.
    if (now === 'proposed') {
      await b.click('[data-cancel]');
      await b.waitFor('!!document.querySelector("dialog.modal [value=ok]")', 5000);
      await b.click('dialog.modal [value=ok]');
      await sleep(3000);
      const after = JSON.parse(await b.eval(`(async () => { const { services } = await import('/lib/api.js'); return JSON.stringify(await services.contract('${contract.id}')); })()`));
      check(after?.status === 'cancelled', `the waiting proposal was cancelled (${after?.status})`);
    }
  }
  for (const p of b.problems) if (!/favicon|ResizeObserver|cloudflareinsights/.test(p)) problems.push(p);
}

async function erase() {
  if (flag('keep')) return;
  const tok = await (await fetch(`${api}/oauth/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: 'vibestartup', username: email, password, scope: '*' }) })).json().catch(() => ({}));
  if (!tok.access_token) { if (tok.error !== 'invalid_grant') problems.push(`the account ${email} could not sign in to be erased: ${tok.error}`); return; }
  const r = await fetch(`${api}/me/erase`, { method: 'POST', headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' }, body: '{"confirm":true}' });
  console.log(`erase ${email}: ${r.status}`);
  if (!r.ok) problems.push(`the account ${email} is left on ${api}: ${r.status} ${(await r.text()).slice(0, 160)}`);
}

try {
  await withBrowser(async b => { try { await run(b); } catch (e) { problems.push(`the run stopped: ${e.message}`); await b.shot(`hire-stopped-${width}`).catch(() => null); } }, { out: shots, width, height: width < 500 ? 844 : 900 });
} finally { await erase().catch(e => problems.push(`erasing ${email}: ${e.message}`)); await stop?.(); }

console.log(problems.length ? `\n${problems.length} problem${problems.length === 1 ? '' : 's'}:\n${problems.map(p => ` - ${p}`).join('\n')}` : '\nno problems');
process.exit(problems.length ? 1 : 0);
