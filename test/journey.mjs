// VibeStartup's journey, from a blank browser against a local run (the site and a local CommandAGI platform): the
// landing's sketch, an account, the wizard to a business, the console's co-founder, an approval, files, the launch
// week, a product and a test buy, the test order, a routine paused and resumed, a secret listed by name only, a
// domain record, a provider stop, activity, billing, and a second business from home. At 1440 and 390 px.
// Screenshots in .test-results/; the problems are printed at the end and the exit code says whether there were any.
//
//   node test/journey.mjs                         starts the local run (test/local.mjs) and drives it
//   node test/journey.mjs --api <origin>          the site here, against that API
//   node test/journey.mjs --url <site> [--api …]  a site already running
//   node test/journey.mjs --no-chat               do not wait for the model's reply
//   node test/journey.mjs --width 1440            one width only
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withBrowser, sleep } from './browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const flag = name => process.argv.includes(`--${name}`);
const shots = path.join(here, '..', '.test-results');
const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); return ok; };
const stamp = Date.now().toString(36);

let base = arg('url'), stop = null;
if (!base) {
  const { startLocal } = await import('./local.mjs');
  const local = await startLocal({ port: 0, api: arg('api') ?? null });
  base = local.url; stop = local.stop;
  console.log(`site ${base} · API ${local.api}`);
}

async function run(browser, width) {
  const label = `@${width}`;
  const email = `journey-${stamp}-${width}@example.com`;
  const idea = 'Hand-thrown ceramic mugs sold to cafes by subscription';
  const b = browser;
  const hash = async tab => { await b.eval(`location.hash = 'tab=${tab}'`); await sleep(300); };
  const tabText = () => b.text('#main');

  // 1. The landing: the sketch grows under the box, made by a script; Start names the business.
  await b.goto(`${base}/`);
  check(/business/i.test(await b.text('h1')), `${label}: the landing headline promises a business`);
  await b.fill('#idea', idea);
  await b.waitFor('!document.querySelector("#sketch")?.hidden && /Mugs|Ceramic|Cafes/i.test(document.querySelector("[data-f=name]")?.textContent ?? "")', 8000).catch(() => null);
  const sketched = await b.text('[data-f=name]');
  check(sketched.trim().length >= 3 && !/Lampwise/i.test(sketched), `${label}: the sketch names the business from the idea (got "${sketched}")`);
  check(/script/i.test(await b.text('#sketch-note').catch(() => '')), `${label}: the sketch note says it is made by a script`);
  check(/Start building/i.test(await b.text('#start')), `${label}: the Start button says "Start building"`);
  const landing = await b.shot(`landing-${width}`);
  check(landing.sideways <= 0, `${label}: the landing scrolls sideways by ${landing.sideways}px`);

  // 2. Start → sign in first → create the account → back to the wizard with the idea.
  await b.click('#start');
  await b.waitFor('location.pathname === "/auth/"', 10000);
  await b.waitFor('!!document.querySelector("#signup") && !document.querySelector("#signup").hidden');
  await b.fill('#signup [name=name]', 'Journey Person');
  await b.fill('#signup [name=email]', email);
  await b.fill('#signup [name=password]', 'correct horse battery');
  // The platform's models for adults need a date of birth; the form asks for it at sign-up.
  if (await b.eval('!!document.querySelector("#signup [name=birthdate]")')) await b.eval('(() => { const i = document.querySelector("#signup [name=birthdate]"); i.value = "1990-05-05"; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); })()');
  await b.shot(`auth-${width}`);
  await b.click('#signup button[type=submit]');
  await b.waitFor('location.pathname === "/start/"', 30000);
  check((await b.eval('location.search')).includes('idea='), `${label}: the wizard received the idea from the landing`);

  // 3. The wizard, one step at a time.
  await b.waitFor('document.querySelector("#wizard")?.dataset.step === "idea"');
  check(/Step 1 of 8/.test(await b.text('#step-label')), `${label}: the wizard starts at step 1 of 8`);
  check((await b.eval('document.querySelector("#idea")?.value ?? ""')).includes('ceramic'), `${label}: the idea is in the box`);
  await b.click('#continue');
  await b.waitFor('document.querySelector("#wizard")?.dataset.step === "blueprint"');
  check(!!await b.eval('document.querySelector("#choices .choice.suggested")'), `${label}: the blueprint step marks a suggestion`);
  await b.click('#choices .choice.suggested');
  await b.click('#continue');
  await b.waitFor('document.querySelector("#wizard")?.dataset.step === "name"');
  await b.fill('#own', `Kiln ${stamp.slice(-3)}${width}`);
  await b.click('#continue');
  await b.waitFor('document.querySelector("#wizard")?.dataset.step === "vibe"');
  await b.clickText('#choices .choice', 'Warm');
  await b.click('#continue');
  await b.waitFor('document.querySelector("#wizard")?.dataset.step === "voice"');
  await b.click('#continue');
  await b.waitFor('document.querySelector("#wizard")?.dataset.step === "partner"');
  await b.clickText('#choices .choice', 'Operator');
  await b.click('#continue');
  await b.waitFor('document.querySelector("#wizard")?.dataset.step === "cofounder"');
  await b.clickText('#choices .chip', 'Remy');
  await b.click('#continue');
  await b.waitFor('document.querySelector("#wizard")?.dataset.step === "updates"');
  check(/Step 8 of 8/.test(await b.text('#step-label')), `${label}: the last step is 8 of 8`);
  await b.shot(`wizard-${width}`);
  await b.click('#continue');
  await b.waitFor('document.querySelector("#wizard")?.dataset.step === "building"', 10000);
  await b.waitFor('document.querySelectorAll("#building li[data-done]").length >= 1', 60000);
  await b.shot(`building-${width}`);
  await b.waitFor('location.pathname === "/app/" && location.search.includes("b=")', 180000);

  // 4. The console: the co-founder says hello (a real model reply), and the right panel reports the build.
  await b.waitFor('!!document.querySelector(".chat")', 30000);
  const slug = await b.eval('new URLSearchParams(location.search).get("b")');
  console.log(`${label}: business ${slug}`);
  check(/Kiln/.test(await b.text('#biz-name')), `${label}: the rail names the business`);
  const readGaps = () => b.eval(`(async () => { const { readBusiness } = await import('/lib/business.js'); const biz = await readBusiness(${JSON.stringify(slug)}); return (biz.gaps ?? []).map(g => g.what + ': ' + g.why); })()`);
  let gaps = await readGaps();
  if (gaps.length) console.log(`${label}: creation gaps on this stack: ${gaps.join(' | ')}`);
  // 4-. The co-founder's model needs the founder's date of birth: set it in Profile, then wake the co-founder in Chat.
  if (gaps.some(g => /^cofounder/.test(g) && /date of birth/i.test(g))) {
    check(/not awake/i.test(await b.text('.chat')), `${label}: chat says the co-founder is not awake, and why`);
    await b.eval('location.hash = "page=profile"'); await sleep(300);
    await b.waitFor('!!document.querySelector("#profile-birthdate")', 20000);
    await b.eval('(() => { const i = document.querySelector("#profile-birthdate"); i.value = "1990-05-05"; i.dispatchEvent(new Event("input", { bubbles: true })); })()');
    await b.click('#profile-form button[type=submit]');
    await b.waitFor('[...document.querySelectorAll(".toast")].some(t => /Saved/.test(t.textContent))', 15000).catch(() => null);
    await hash('chat');
    await b.waitFor('!!document.querySelector("#wake")', 20000);
    await b.click('#wake');
    await b.waitFor('!document.querySelector("#wake")', 60000).catch(() => null);
    gaps = await readGaps();
    check(!gaps.some(g => /^cofounder/.test(g)), `${label}: the co-founder woke after the date of birth was set (${gaps.filter(g => /^cofounder/.test(g)).join('; ') || 'ok'})`);
  }
  const hasThread = !gaps.some(g => g.startsWith('cofounder'));
  if (!flag('no-chat') && hasThread) {
    // The co-founder reads its files first (a dozen tool calls) and then says hello.
    const greeted = await b.waitFor('document.querySelectorAll(".msg.cofounder").length >= 1', 150000).catch(() => false);
    check(greeted, `${label}: the co-founder greeted within 150 s`);
    if (greeted) { const first = await b.eval('document.querySelector(".msg.cofounder .text")?.innerText ?? ""'); check(first.length > 20, `${label}: the greeting has words (${first.slice(0, 60).replace(/\n/g, ' ')}…)`); }
  } else check(hasThread || gaps.length > 0, `${label}: the co-founder's thread is missing and no gap says why`);
  check(!!await b.eval('document.querySelector("#building [data-site-state]")'), `${label}: the right panel reports the site's state`);
  await b.shot(`console-chat-${width}`);

  // 4a. A message from the founder, and the model's reply.
  if (!flag('no-chat') && hasThread) {
    const before = await b.eval('document.querySelectorAll(".msg.cofounder").length');
    await b.fill('#composer', 'What should I do first today? Answer in two short lines.');
    await b.click('#send');
    check(await b.eval('document.querySelectorAll(".msg.me").length >= 1'), `${label}: the sent message shows at once`);
    const replied = await b.waitFor(`document.querySelectorAll(".msg.cofounder").length > ${before}`, 90000).catch(() => false);
    check(replied, `${label}: the co-founder answered within 90 s`);
  }

  // 4b. An approval: the one the co-founder made, else one made through the tasks API; approve it.
  let card = await b.waitFor('!!document.querySelector(".approval [data-approve]")', hasThread && !flag('no-chat') ? 45000 : 2000).catch(() => false);
  if (!card) {
    const made = await b.eval(`(async () => { const { tasks } = await import('/lib/api.js'); const r = await tasks.create({ dir: 'Businesses/${slug}/Tasks', doc: { title: 'Send personal notes to the warm list', status: 'todo', labels: ['biz:${slug}', 'needs-approval'] }, body: 'Twelve people from your warm list get a short personal note each. Nothing is sent before you approve.' }); return r?.task?.id ?? r?.fileId ?? null; })()`).catch(e => `error: ${e.message}`);
    check(made && !String(made).startsWith('error'), `${label}: an approval task could be created through the tasks API (${made})`);
    await b.click('#chat-refresh');
    card = await b.waitFor('!!document.querySelector(".approval [data-approve]")', 20000).catch(() => false);
  }
  check(card, `${label}: an approval card is in the chat`);
  if (card) {
    const title = await b.text('.approval b');
    await b.click('.approval [data-approve]');
    await b.waitFor(`![...document.querySelectorAll(".approval b")].some(e => e.textContent === ${JSON.stringify(title)})`, 20000).catch(() => null);
    check(!await b.eval(`[...document.querySelectorAll(".approval b")].some(e => e.textContent === ${JSON.stringify(title)})`), `${label}: the approved card left the chat`);
  }

  // 5. Files: the co-founder's memory. Dashboard: the launch week.
  if (width >= 900) await b.click('.rail a[data-tab=files]'); else await hash('files');
  await b.waitFor('[...document.querySelectorAll(".file-row")].some(e => /SOUL\\.md/.test(e.innerText))', 30000).catch(() => null);
  const files = await tabText();
  for (const name of ['SOUL.md', 'BUSINESS.md', 'MEMORY.md', 'PLAYBOOK.md']) check(files.includes(name), `${label}: Files shows ${name}`);
  await b.click('.file-row [data-open]');
  await b.waitFor('(document.querySelector("#file-preview")?.innerText ?? "").length > 20', 10000).catch(() => null);
  await b.shot(`console-files-${width}`);
  await hash('dashboard');
  await b.waitFor('!!document.querySelector("#launch-week li.today")', 20000);
  check(/Day 1/.test(await b.text('#launch-week li.today')), `${label}: the dashboard marks day 1 of the launch week`);
  check(/No sales yet|Total sales/i.test(await tabText()), `${label}: money says there are no sales yet`);
  await b.shot(`console-dashboard-${width}`);

  // 6. A product, then a test buy; the order is marked test.
  await hash('products');
  await b.waitFor('!!document.querySelector("#add-product")', 20000);
  await b.click('#add-product');
  await b.waitFor('!!document.querySelector("#p-name")');
  await b.fill('#p-name', 'The Harbour Mug');
  await b.fill('#p-desc', '350 ml, blue glaze');
  await b.fill('#p-price', '28');
  await b.click('#create-product');
  await b.waitFor('[...document.querySelectorAll("#product-list .product")].some(e => /Harbour Mug/.test(e.innerText))', 40000);
  await b.shot(`console-products-${width}`);
  await b.click('[data-test-buy]');
  await b.waitFor('document.querySelector("#checkout-dialog")?.open === true', 10000);
  await b.click('#copy-card');
  check((await b.eval('document.querySelector("#checkout-dialog [name=card]").value')).replace(/\s/g, '') === '4242424242424242', `${label}: the test card was copied into the field`);
  await b.fill('#checkout-dialog [name=exp]', '12 / 30');
  await b.fill('#checkout-dialog [name=cvc]', '123');
  await b.click('#checkout-dialog button[value=pay]');
  await b.waitFor('!document.querySelector("#checkout-dialog")', 30000);
  await hash('orders');
  await b.waitFor('[...document.querySelectorAll("#orders tbody tr")].some(e => /Harbour Mug/.test(e.innerText))', 30000);
  check(/Test/.test(await b.text('#orders tbody tr.test')), `${label}: the test order is marked Test`);
  await b.shot(`console-orders-${width}`);
  await hash('customers');
  await b.waitFor('/buyer@example.com|No customers/.test(document.querySelector("#main")?.innerText ?? "")', 20000);
  check(/buyer@example.com/.test(await tabText()), `${label}: the test buyer is a customer, marked test`);

  // 7. Routines: created, paused, resumed.
  await hash('tasks');
  await b.waitFor('!!document.querySelector("#new-routine")', 20000);
  if (hasThread) {
    await b.click('#new-routine');
    await b.waitFor('!!document.querySelector("#rf")');
    await b.fill('#rf [name=label]', 'Weekly stock check');
    await b.fill('#rf [name=prompt]', 'Count what is in stock and tell me what is low.');
    await b.eval('document.querySelector("#rf [name=every]").value = "604800"');
    await b.click('#rf button[type=submit]');
    await b.waitFor('[...document.querySelectorAll("#routines .routine")].some(e => /Weekly stock check/.test(e.innerText))', 30000);
    await b.clickText('#routines .routine', 'Weekly stock check').catch(() => null);
    const r = '[...document.querySelectorAll("#routines .routine")].find(e => /Weekly stock check/.test(e.innerText))';
    await b.eval(`${r}.querySelector("[data-pause]").click()`);
    await b.waitFor(`/paused/.test(${r}?.innerText ?? "")`, 20000);
    check(/paused/.test(await b.eval(`${r}.innerText`)), `${label}: the routine paused`);
    await b.eval(`${r}.querySelector("[data-resume]").click()`);
    await b.waitFor(`/weekly/.test(${r}?.innerText ?? "")`, 20000);
    check(/weekly/.test(await b.eval(`${r}.innerText`)), `${label}: the routine resumed`);
  } else console.log(`${label}: no thread, so no routines on this stack`);
  await b.shot(`console-tasks-${width}`);

  // 8. Settings: a secret listed by name only, a domain record, members.
  await hash('settings');
  await b.waitFor('!!document.querySelector("#secrets")', 20000);
  const siteGap = !await b.eval('!!document.querySelector("#secret-form")');
  if (!siteGap) {
    await b.fill('#secret-name', 'STRIPE_SECRET_KEY');
    await b.fill('#secret-value', 'sk_test_journey_not_a_real_key');
    await b.click('#secret-save');
    const listed = await b.waitFor('[...document.querySelectorAll("#secret-list .secret code")].some(e => e.textContent === "STRIPE_SECRET_KEY")', 30000).catch(() => false);
    check(listed, `${label}: the secret is listed by name`);
    check(!(await tabText()).includes('sk_test_journey'), `${label}: the secret's value is never shown`);
    await b.fill('#domain-form [name=hostname]', 'shop.example.com');
    await b.click('#domain-form button[type=submit]');
    const rec = await b.waitFor('!!document.querySelector("#domain-records .card") || !!document.querySelector(".toast")', 30000).catch(() => false);
    check(rec, `${label}: adding a domain answered (a record, or why not)`);
  } else console.log(`${label}: no storefront on this stack (${gaps.find(g => g.startsWith('site')) ?? 'no site'}), so no secrets or domains to test`);
  check(!!await b.eval('document.querySelector("#members #member-email")'), `${label}: members has an invite form`);
  check(!!await b.eval('document.querySelector("#delete-business.btn.danger")') && !await b.eval('[...document.querySelectorAll("#main .btn.danger")].some(b => getComputedStyle(b).color === getComputedStyle(b).backgroundColor)'), `${label}: delete is a danger button`);
  await b.shot(`console-settings-${width}`);

  // 9. Ads: the launch stops at the provider. Analytics, Studio, Email, Social, Outbound, Legal render.
  await hash('ads');
  await b.waitFor('!!document.querySelector("#ads-launch")', 20000);
  await b.click('#ads-launch');
  await b.waitFor('!!document.querySelector("#ads-stop .note.warn")', 10000).catch(() => null);
  check(/Connect .* first|blocker/i.test(await b.text('#ads-stop')), `${label}: the ad launch stops at the provider and says so`);
  await b.shot(`console-ads-${width}`);
  for (const t of ['analytics', 'studio', 'email', 'social', 'outbound', 'legal']) {
    await hash(t);
    await b.waitFor(`document.querySelector("#main")?.dataset.tab === "${t}" && !/^Loading/.test(document.querySelector("#main")?.innerText ?? "")`, 30000).catch(() => null);
    const txt = await tabText();
    check(txt.length > 40 && !/could not load/i.test(txt), `${label}: the ${t} tab rendered (${txt.slice(0, 50).replace(/\n/g, ' ')})`);
    await b.shot(`console-${t}-${width}`);
  }

  // 10. Activity and Billing.
  await hash('activity');
  await b.waitFor('document.querySelector("#main")?.dataset.tab === "activity" && !/^Loading/.test(document.querySelector("#main")?.innerText ?? "")', 30000).catch(() => null);
  if (hasThread) check(await b.eval('document.querySelectorAll("#activity .event").length') >= 1, `${label}: Activity has events`);
  await b.shot(`console-activity-${width}`);
  await b.eval('location.hash = "page=billing"'); await sleep(300);
  await b.waitFor('!!document.querySelector("#credits-balance")', 20000);
  check(/\d|—/.test(await b.text('#credits-balance')), `${label}: Billing shows the credit balance`);
  check((await b.text('#plans')).includes('set at launch'), `${label}: plans say prices are set at launch`);
  await b.shot(`console-billing-${width}`);
  await b.eval('location.hash = "page=profile"'); await sleep(300);
  await b.waitFor('!!document.querySelector("#profile-email")', 20000);
  check((await b.eval('document.querySelector("#profile-email").value')) === email, `${label}: Profile shows the account's email`);
  await b.eval('location.hash = "page=share"'); await sleep(300);
  await b.waitFor('!!document.querySelector("#referral-link")', 20000);
  check(/vibestartup/.test(await b.eval('document.querySelector("#referral-link").value')), `${label}: the referral link is there`);

  // 11. ⌘K at desktop width, the bottom bar at phone width.
  if (width >= 900) {
    await b.click('#search-open');
    await b.waitFor('document.querySelector("#search")?.open === true');
    await b.type('orders');
    await b.waitFor('/Orders/.test(document.querySelector("#search .search-results")?.innerText ?? "")');
    await b.eval('document.querySelector("#search input").dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))');
    await b.waitFor('location.hash === "#tab=orders"', 5000);
    check(await b.eval('location.hash') === '#tab=orders', `${label}: ⌘K jumped to Orders`);
  } else {
    check(await b.eval('getComputedStyle(document.querySelector("#bottombar")).display !== "none"'), `${label}: the bottom bar shows on a phone`);
    await b.click('#more');
    await b.waitFor('!!document.querySelector(".sheet")');
    check(await b.eval('document.querySelectorAll(".sheet a[data-tab]").length') >= 10, `${label}: More lists the rest of the tabs`);
    await b.eval('document.querySelector(".scrim").click()');
  }
  const look = await b.shot(`console-${width}`);
  check(look.sideways <= 0, `${label}: the console scrolls sideways by ${look.sideways}px`);

  // 12. Home: the business is a card; a second business from the idea box.
  await b.goto(`${base}/home/`);
  await b.waitFor('document.querySelectorAll(".biz-card[data-slug]").length >= 1', 30000);
  check(/Kiln/.test(await b.text('.biz-card[data-slug]')), `${label}: home shows the business`);
  check((await b.text('#account-email')) === email, `${label}: home shows the account's email`);
  await b.shot(`home-${width}`);
  await b.click('#new-business');
  await b.waitFor('location.pathname === "/start/"', 10000);
  await b.waitFor('!!document.querySelector("#idea")');
  await b.fill('#idea', 'A weekend pottery class with a small shop of glazes');
  for (let i = 0; i < 7; i++) { await b.click('#continue'); await sleep(250); }
  await b.waitFor('document.querySelector("#wizard")?.dataset.step === "updates"', 10000);
  await b.click('#continue');
  await b.waitFor('location.pathname === "/app/" && location.search.includes("b=")', 180000);
  await b.goto(`${base}/home/`);
  await b.waitFor('document.querySelectorAll(".biz-card[data-slug]").length >= 2', 30000);
  check(await b.eval('document.querySelectorAll(".biz-card[data-slug]").length') >= 2, `${label}: home shows two businesses`);

  for (const p of b.problems) if (!/favicon|ResizeObserver|cloudflareinsights/.test(p)) problems.push(`${label}: ${p}`);
}

const widths = arg('width') ? [Number(arg('width'))] : [1440, 390];
try {
  for (const width of widths) {
    console.log(`— ${width}px —`);
    await withBrowser(async browser => { try { await run(browser, width); } catch (e) { problems.push(`@${width}: the journey stopped: ${e.message}`); await browser.shot(`stopped-${width}`).catch(() => null); } }, { out: shots, width, height: width < 500 ? 844 : 900 });
  }
} finally { await stop?.(); }

console.log(problems.length ? `\n${problems.length} problem${problems.length === 1 ? '' : 's'}:\n${problems.map(p => ` - ${p}`).join('\n')}` : '\nno problems');
process.exit(problems.length ? 1 : 0);
