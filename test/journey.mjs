// VibeStartup's journey, from a blank browser against a local run (the site and a local CommandAGI platform): the
// landing's sketch, an account, the wizard to a business, the console's co-founder, an approval, files, the launch
// week, a product and a test buy, the test order, a routine paused and resumed, a secret listed by name only, a
// domain record, a provider stop, activity, billing, a second business from home, then the account deleted. Each
// screenshot also checks the shape rules (test/edges.mjs: square shapes, rounded floats, one edge on square corners).
// The account is deleted at the end so a run against a cloud API leaves nothing behind. At 1440 and 390 px.
// Screenshots in .test-results/; the problems are printed at the end and the exit code says whether there were any.
//
//   node test/journey.mjs                         starts the local run (test/local.mjs) and drives it
//   node test/journey.mjs --api <origin>          the site here, against that API
//   node test/journey.mjs --url <site> [--api …]  a site already running
//   node test/journey.mjs --no-chat               do not wait for the model's reply
//   node test/journey.mjs --width 1440            one width only
//   node test/journey.mjs --keep                  keep the accounts at the end (to look at them); otherwise a stopped
//                                                 run erases its accounts through the API
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withBrowser, sleep } from './browser.mjs';
import { SHAPE_SCAN } from './edges.mjs';

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

/** The wizard's build ends in the console. Over 2 minutes is a problem to fix (production took 3 to 6 on 2026-11-11),
 *  but the journey waits up to 7 so the steps after it are still checked. */
async function built(b, label) {
  const t0 = Date.now();
  await b.waitFor('location.pathname === "/app/" && location.search.includes("b=")', 420000);
  const s = Math.round((Date.now() - t0) / 1000);
  check(s <= 120, `${label}: the business was built in ${s} s (over 120 s)`);
}

async function run(browser, width) {
  const label = `@${width}`;
  const email = `journey-${stamp}-${width}@example.com`;
  made.push(email);
  console.log(`${label}: account ${email}`);
  const idea = 'Hand-thrown ceramic mugs sold to cafes by subscription';
  const b = browser;
  // Every screenshot also holds the page to the shape rules (docs/DESIGN.md § shape and depth): a rounded element that
  // does not float, or a rounded one with a line on only some of its edges, is a problem, named with the screenshot.
  const shoot = b.shot.bind(b);
  b.shot = async name => {
    const shot = await shoot(name);
    for (const f of JSON.parse(await b.eval(SHAPE_SCAN).catch(() => '[]'))) check(false, `${label}: ${name}: shape: ${f}`);
    return shot;
  };
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
  await built(b, label);

  // 4. The console: the co-founder says hello (a real model reply), and the right panel reports the build.
  await b.waitFor('!!document.querySelector(".chat")', 30000);
  const slug = await b.eval('new URLSearchParams(location.search).get("b")');
  console.log(`${label}: business ${slug}`);
  check(/Kiln/.test(await b.eval('document.querySelector("#biz-name").textContent')), `${label}: the rail names the business`);
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
  // The panel fills after the chat's first read.
  await b.waitFor('!!document.querySelector("#building [data-site-state]")', 30000).catch(() => null);
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

  // 6. A physical product: a good sold through the checkout once payouts are connected, else ordered by email.
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
  const mug = '[...document.querySelectorAll("#product-list .product")].find(e => /Harbour Mug/.test(e.innerText))';
  const payable = await b.eval('!document.querySelector("#payments-needed")');
  check(await b.eval(`/${payable ? 'checkout' : 'checkout after payouts|order by email'}/.test(${mug}.innerText)`), `${label}: the mug says how it is sold (${payable ? 'the checkout' : 'after payouts'})`);
  check(!(await b.eval('!!document.querySelector("[data-test-buy], #checkout-dialog")')), `${label}: no checkout but the platform's (no test-card form in the console)`);
  await hash('orders');
  await b.waitFor('!!document.querySelector("#orders")', 30000);
  await b.shot(`console-orders-${width}`);

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
    const r = '[...document.querySelectorAll("#routines .routine")].find(e => /Weekly stock check/.test(e.innerText))';
    await b.eval(`${r}.querySelector("[data-pause]").click()`);
    await b.waitFor(`/paused/.test(${r}?.innerText ?? "")`, 20000);
    check(/paused/.test(await b.eval(`${r}.innerText`)), `${label}: the routine paused`);
    await b.eval(`${r}.querySelector("[data-resume]").click()`);
    await b.waitFor(`/weekly/.test(${r}?.innerText ?? "")`, 20000);
    check(/weekly/.test(await b.eval(`${r}.innerText`)), `${label}: the routine resumed`);
  } else console.log(`${label}: no thread, so no routines on this stack`);
  await b.shot(`console-tasks-${width}`);

  // 8. Settings: payments through Connect (no payment key field), a secret listed by name only, a domain record, members.
  await hash('settings');
  await b.waitFor('!!document.querySelector("#secrets")', 20000);
  check(await b.eval('!!document.querySelector("#payments #connect-payouts, #payments .badge.ok")'), `${label}: payments connect through Stripe (a button, or connected)`);
  check(!/STRIPE_SECRET_KEY/.test(await tabText()), `${label}: no payment key is asked for`);
  const siteGap = !await b.eval('!!document.querySelector("#secret-form")');
  if (!siteGap) {
    await b.fill('#secret-name', 'WEATHER_API_KEY');
    await b.fill('#secret-value', 'journey_not_a_real_key');
    await b.click('#secret-save');
    const listed = await b.waitFor('[...document.querySelectorAll("#secret-list .secret code")].some(e => e.textContent === "WEATHER_API_KEY")', 30000).catch(() => false);
    check(listed, `${label}: the secret is listed by name`);
    check(!(await tabText()).includes('journey_not_a_real_key'), `${label}: the secret's value is never shown`);
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
    await b.waitFor(`document.querySelector("#main")?.dataset.tab === "${t}" && !!document.querySelector("#main .view") && !document.querySelector("#main .skeleton")`, 30000).catch(() => null);
    const txt = await tabText();
    check(txt.length > 40 && !/could not load/i.test(txt), `${label}: the ${t} tab rendered (${txt.slice(0, 50).replace(/\n/g, ' ')})`);
    await b.shot(`console-${t}-${width}`);
  }

  // 10. Activity and Billing.
  await hash('activity');
  await b.waitFor('document.querySelector("#main")?.dataset.tab === "activity" && !/^Loading/.test(document.querySelector("#main")?.innerText ?? "")', 30000).catch(() => null);
  // The tab refreshes every 5 s; a co-founder still on its first turn may have written nothing yet.
  if (hasThread) check(await b.waitFor('document.querySelectorAll("#activity .event").length >= 1', 45000).then(() => true, () => false), `${label}: Activity has events`);
  await b.shot(`console-activity-${width}`);
  await b.eval('location.hash = "page=billing"'); await sleep(300);
  await b.waitFor('/\\d|—/.test(document.querySelector("#credits-balance")?.textContent ?? "")', 20000).catch(() => null);
  check(/\d|—/.test(await b.text('#credits-balance')), `${label}: Billing shows the credit balance`);
  check(await b.eval('document.querySelectorAll("#main #plans article").length') === 3, `${label}: Billing shows its three listings`);
  // A tab that answers late never paints over the one now shown: leave Chat (slow: the transcript, the tasks) for
  // Billing in the same instant, and Billing is what stays, with Chat's refresh button gone from the top bar.
  await b.eval('location.hash = "tab=chat"'); await b.eval('location.hash = "page=billing"');
  await b.waitFor('!!document.querySelector("#main #plans article")', 20000).catch(() => null);
  await sleep(6000);
  check(await b.eval('!!document.querySelector("#main #plans article") && !document.querySelector("#main .chat") && !document.querySelector("#chat-refresh") && document.querySelector("#building").hidden'), `${label}: Billing stays when Chat, left a moment before, answers late`);
  await b.eval('location.hash = "page=billing"');
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
    await b.click('#account-menu');
    await b.waitFor('!!document.querySelector(".menu")');
    check(await b.eval('(() => { const r = document.querySelector(".menu").getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()'), `${label}: the account menu opens inside the window`);
    await b.shot(`console-menu-${width}`);
    await b.eval('document.querySelector(".menu").remove()');
    await b.click('#search-open');
    await b.waitFor('document.querySelector("#search")?.open === true');
    await b.shot(`console-search-${width}`);
    await b.eval('document.querySelector("#search").close()');
  } else {
    check(await b.eval('getComputedStyle(document.querySelector("#bottombar")).display !== "none"'), `${label}: the bottom bar shows on a phone`);
    await b.click('#more');
    await b.waitFor('document.body.dataset.rail === "open"');
    await sleep(350);
    check(await b.eval('(() => { const r = document.querySelector(".rail").getBoundingClientRect(); return r.left === 0 && r.width <= innerWidth; })()'), `${label}: More opens the rail as a drawer from the left edge`);
    check(await b.eval('[...document.querySelectorAll(".rail a[data-tab]")].filter(a => a.getBoundingClientRect().height >= 44).length') >= 16, `${label}: the drawer lists every tab, each 44 px high`);
    await b.shot(`console-drawer-${width}`);
    await b.click('.rail a[data-tab=orders]');
    await b.waitFor('location.hash === "#tab=orders" && document.body.dataset.rail !== "open"', 5000).catch(() => null);
    check(await b.eval('location.hash === "#tab=orders" && document.body.dataset.rail !== "open"'), `${label}: a tab chosen in the drawer opens and the drawer closes`);
    await sleep(350);
    await b.click('#rail-toggle');
    await b.waitFor('document.body.dataset.rail === "open"');
    await b.click('#account-menu');
    await b.waitFor('!!document.querySelector(".menu")');
    check(await b.eval('(() => { const r = document.querySelector(".menu").getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; })()'), `${label}: the account menu opens inside the window`);
    await b.shot(`console-menu-${width}`);
    await b.eval('document.querySelector(".menu").remove(); document.querySelector("#rail-scrim").click()');
    await sleep(350);
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
  await built(b, label);
  await b.goto(`${base}/home/`);
  await b.waitFor('document.querySelectorAll(".biz-card[data-slug]").length >= 2', 30000);
  check(await b.eval('document.querySelectorAll(".biz-card[data-slug]").length') >= 2, `${label}: home shows two businesses`);

  // 13. Delete the account: the modal on a deep shadow, then the landing, and the password no longer signs in. A run
  // against a cloud API leaves nothing behind (`--keep` keeps the account to look at).
  if (!flag('keep')) {
    await b.click('#delete-account');
    await b.waitFor('!!document.querySelector(".modal .modal-actions [value=ok]")', 5000);
    check(/cannot be undone/i.test(await b.text('.modal')), `${label}: the delete modal says it cannot be undone`);
    await b.shot(`delete-account-${width}`);
    await b.eval('document.querySelector(".modal .modal-actions [value=ok]").click()');
    // An erase that stops part way ends the session first (lib/api.js eraseAccount): the page asks for the password.
    await b.waitFor('location.pathname === "/" || !!document.querySelector(".modal input[type=password]")', 90000);
    if (await b.eval('location.pathname !== "/"')) {
      await b.shot(`delete-password-${width}`);
      await b.fill('.modal input[type=password]', 'correct horse battery');
      await b.eval('document.querySelector(".modal .modal-actions [value=ok]").click()');
      await b.waitFor('location.pathname === "/"', 90000);
    }
    erased.add(email);
    await b.goto(`${base}/auth/`);
    await b.waitFor('!!document.querySelector("#signin")');
    await b.fill('#signin [name=email]', email);
    await b.fill('#signin [name=password]', 'correct horse battery');
    await b.eval('document.querySelector("#signin").requestSubmit()');
    await sleep(2500);
    check(await b.eval('location.pathname === "/auth/"'), `${label}: the deleted account no longer signs in`);
  }

  for (const p of b.problems) if (!/favicon|ResizeObserver|cloudflareinsights/.test(p)) problems.push(`${label}: ${p}`);
}

const widths = arg('width') ? [Number(arg('width'))] : [1440, 390];

// The accounts a run made and the ones its delete step erased; a stopped run erases the rest through the API, so a run
// against a cloud leaves nothing behind (unless `--keep`).
const made = [], erased = new Set();
async function eraseLeftovers() {
  if (flag('keep')) return;
  const left = made.filter(e => !erased.has(e));
  if (!left.length) return;
  const api = arg('api') ?? (await (await fetch(`${base}/brand.js`)).text()).match(/"api":"([^"]+)"/)?.[1];
  for (const email of left) {
    let said = 'not tried';
    for (let i = 0; i < 4 && said !== 'erased' && said !== 'no account'; i++) {
      if (i) await sleep(5000 * i);
      const tok = await (await fetch(`${api}/oauth/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: 'vibestartup', username: email, password: 'correct horse battery', scope: '*' }) })).json().catch(() => ({}));
      if (!tok.access_token) { said = tok.error === 'invalid_grant' ? 'no account' : `sign-in: ${tok.error}`; continue; }
      const r = await fetch(`${api}/me/erase`, { method: 'POST', headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' }, body: '{"confirm":true}' });
      said = r.ok ? 'erased' : `erase: ${r.status} ${(await r.text()).slice(0, 120)}`;
    }
    console.log(`left over ${email}: ${said}`);
    if (said !== 'erased' && said !== 'no account') problems.push(`the account ${email} is left on ${api}: ${said}`);
  }
}

try {
  for (const width of widths) {
    console.log(`— ${width}px —`);
    await withBrowser(async browser => { try { await run(browser, width); } catch (e) { problems.push(`@${width}: the journey stopped: ${e.message}`); await browser.shot(`stopped-${width}`).catch(() => null); } }, { out: shots, width, height: width < 500 ? 844 : 900 });
  }
} finally { await eraseLeftovers().catch(e => problems.push(`erasing the run's accounts: ${e.message}`)); await stop?.(); }

console.log(problems.length ? `\n${problems.length} problem${problems.length === 1 ? '' : 's'}:\n${problems.map(p => ` - ${p}`).join('\n')}` : '\nno problems');
process.exit(problems.length ? 1 : 0);
