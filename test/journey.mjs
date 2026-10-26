// VibeStartup's journey, from a blank browser: a person signs up, gets a business from an idea, talks to the real
// co-founder, approves a task, adds a product, test-buys it, creates and runs a routine, sets a secret, hits a provider
// that needs their own account, and makes a second business. At 1440 and at 390 px. Screenshots in test-results/.
//
//   node test/journey.mjs                          the app on this computer, started for the run
//   node test/journey.mjs --url https://vibestartup.commandagi.app   the deployed app
//   node test/journey.mjs --url … --no-chat        skip the model calls (a layout run)
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withBrowser, sleep } from './browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const flag = name => process.argv.includes(`--${name}`);
const shots = path.join(here, '..', '.test-results');

const problems = [];
const check = (ok, what) => { if (!ok) problems.push(what); return ok; };

let base = arg('url');
let stopLocal = null;
if (!base) {
  const { startLocal } = await import('./local.mjs');
  const local = await startLocal({ port: 0 });
  base = local.url;
  stopLocal = () => local.close();
}
const stamp = Date.now().toString(36);

async function run(browser, width) {
  const label = `@${width}`;
  const email = `journey-${stamp}-${width}@example.com`;
  const idea = 'A camera-enabled desk lamp that lets an assistant see your notebook';

  // 1. A blank visit: the landing page, then an account.
  await browser.goto(`${base}/`);
  check(/business/i.test(await browser.text('h1')), `${label}: the landing headline promises a business`);
  check(await browser.eval('!!document.querySelector("#signup")'), `${label}: the sign-up form is on the page`);
  check(await browser.eval('!!document.querySelector("[data-lang]")'), `${label}: the A/文 language picker is in the footer`);
  const landing = await browser.shot(`landing-${width}`);
  check(landing.sideways <= 0, `${label}: the landing page scrolls sideways by ${landing.sideways}px`);

  await browser.fill('#signup [name=name]', 'Journey Person');
  await browser.fill('#signup [name=email]', email);
  await browser.fill('#signup [name=password]', 'correct horse battery');
  await browser.fill('#signup [name=idea]', idea);
  await browser.click('#signup button[type=submit]');
  await browser.waitFor('location.pathname === "/app/" && location.search.includes("s=")', 20000);
  await browser.waitFor('!!document.querySelector(".chat")');
  await browser.shot(`console-${width}`);

  // 2. The console: the co-founder's greeting and two approval cards.
  const greeting = await browser.text('.chat');
  check(/co-founder on/i.test(greeting), `${label}: the co-founder introduced itself`);
  const cards = await browser.eval('document.querySelectorAll(".approval").length');
  check(cards >= 2, `${label}: the co-founder proposed ${cards} approval cards (2 expected)`);

  // 3. A real reply from the model, through the app's chat route.
  if (!flag('no-chat')) {
    const before = await browser.eval('document.querySelectorAll(".msg").length');
    await browser.fill('#composer', 'What should I do first today?');
    await browser.click('#send');
    await browser.waitFor(`document.querySelectorAll(".msg").length > ${before} + 1`, 45000);
    const last = await browser.eval('[...document.querySelectorAll(".msg")].at(-1)?.innerText ?? ""');
    check(last.length > 40, `${label}: the co-founder answered (${last.slice(0, 60).replace(/\n/g, ' ')}…)`);
    check(!/not a model reply/i.test(last), `${label}: the reply came from the model`);
  }

  // 4. Approve a card: the task is done and the site goes live.
  await browser.click('.approval .btn.primary');
  await browser.waitFor('[...document.querySelectorAll(".approval")].some(e => /Approved/i.test(e.innerText))', 20000);
  check(/Site is live/i.test(await browser.text('.chat')), `${label}: the milestone card says the site is live`);

  // 4b. The co-founder's memory as files, and the launch-week dashboard.
  await browser.click('a[href="#tab=files"]');
  await browser.waitFor('[...document.querySelectorAll(".file-row")].some(e => /SOUL[.]md/.test(e.innerText))', 20000);
  const files = await browser.text('#main');
  for (const name of ['BUSINESS.md', 'MEMORY.md', 'PLAYBOOK.md']) check(files.includes(name), `${label}: the Files tab holds ${name}`);
  await browser.click('a[href="#tab=dashboard"]');
  await browser.waitFor('/Day [0-9]+(:| of 7)|Launch week is complete/.test(document.querySelector("#main")?.innerText ?? "")', 15000);

  // 5. A product, then a test buy through the sandbox checkout.
  await browser.click('a[href="#tab=products"]');
  await browser.waitFor('!!document.querySelector("#add-product")');
  await browser.click('#add-product');
  await browser.fill('#p-name', 'The Notebook Lamp');
  await browser.fill('#p-desc', 'A lamp that sees your notes');
  await browser.fill('#p-price', '49');
  await browser.fill('#p-type', 'hardware');
  await browser.click('#create-product');
  await browser.waitFor('[...document.querySelectorAll("#product-list li")].some(e => /Notebook Lamp/.test(e.innerText))', 20000);
  await browser.shot(`products-${width}`);

  await browser.click('[data-action=test-buy]');
  await browser.waitFor('document.querySelector("#checkout-dialog")?.open === true');
  await browser.fill('#checkout-form [name=email]', 'buyer@example.com');
  await browser.fill('#checkout-form [name=card]', '4242 4242 4242 4242');
  await browser.fill('#checkout-form [name=exp]', '12 / 30');
  await browser.fill('#checkout-form [name=cvc]', '123');
  await browser.click('#checkout-form button[value=pay]');
  await browser.waitFor('document.querySelector("#checkout-dialog")?.open === false', 20000);
  await browser.click('a[href="#tab=orders"]');
  await browser.waitFor('[...document.querySelectorAll("#orders tbody tr")].some(e => /Notebook Lamp/.test(e.innerText))', 20000);
  check(/Test/.test(await browser.text('#orders')), `${label}: the test order is marked as a test`);
  await browser.shot(`orders-${width}`);

  // 6. A routine: created, then run.
  await browser.click('a[href="#tab=tasks"]');
  await browser.waitFor('!!document.querySelector("#add-routine")');
  await browser.click('#add-routine');
  await browser.fill('#routine-new [name=name]', 'Weekly review');
  await browser.fill('#routine-new [name=instructions]', 'Summarise the week and list what waits on me.');
  await browser.click('#routine-new button[type=submit]');
  await browser.waitFor('[...document.querySelectorAll("#routines .linkish")].some(e => /Weekly review/.test(e.innerText))', 20000);
  await browser.clickText('#routines .linkish', 'Weekly review');
  await browser.waitFor('!!document.querySelector("#routine-detail")');
  await browser.click('[data-action=routine-run]');
  await browser.waitFor('!!document.querySelector("#routine-detail") && /Last result/.test(document.querySelector("#routine-detail").innerText)', 30000);
  await browser.shot(`routine-${width}`);

  // 7. A secret: its value never comes back.
  await browser.eval('location.hash = "#tab=secrets"');
  await browser.waitFor('!!document.querySelector("#secret-form")');
  await browser.fill('#secret-name', 'STRIPE_SECRET_KEY');
  await browser.fill('#secret-value', 'sk_test_journey_secret');
  await browser.click('#save-secret');
  await browser.waitFor('[...document.querySelectorAll("#secrets li")].some(e => /STRIPE_SECRET_KEY/.test(e.innerText))', 20000);
  const page = await browser.eval('document.body.innerText');
  check(!page.includes('sk_test_journey_secret'), `${label}: the secret value is not shown again`);

  // 8. A provider that needs the founder's own account: it stops and says so.
  await browser.eval('location.hash = "#tab=social"');
  await browser.waitFor('!!document.querySelector("[data-action=connect]")');
  await browser.click('[data-action=connect]');
  await browser.waitFor('/connect your provider|Connect your provider/i.test(document.querySelector("#toast")?.innerText ?? "")', 15000);

  // 9. A second business, then both are on the list.
  await browser.goto(`${base}/startups/`);
  await browser.waitFor('!!document.querySelector("#create")');
  await browser.fill('#create [name=idea]', 'Hand-thrown ceramic mugs sold to cafes');
  await browser.fill('#create [name=name]', 'Kiln and Clay');
  await browser.fill('#create [name=cofounder]', 'Mira');
  await browser.click('#create button[type=submit]');
  await browser.waitFor('location.pathname === "/app/"', 20000);
  await browser.waitFor('/Kiln and Clay/.test(document.querySelector(".side .bizname")?.innerText ?? "")', 20000);
  const second = await browser.text('.side .bizname');
  check(/Kiln and Clay/.test(second), `${label}: the second business opened (${second.replace(/\n/g, ' ')})`);
  await browser.goto(`${base}/startups/`);
  await browser.waitFor('document.querySelectorAll("#list a.card").length >= 2', 15000);
  const cardsOnList = await browser.eval('document.querySelectorAll("#list a.card").length');
  check(cardsOnList === 2, `${label}: the account lists ${cardsOnList} businesses (2 expected)`);
  const list = await browser.shot(`startups-${width}`);
  check(list.sideways <= 0, `${label}: the business list scrolls sideways by ${list.sideways}px`);
}

try {
  for (const width of [1440, 390]) {
    await withBrowser(async browser => {
      await run(browser, width);
      for (const p of browser.problems) problems.push(`@${width}: ${p}`);
      // The platform's own analytics beacon is not the app's request (and this site's CSP blocks it).
      const foreign = browser.requests.filter(u => u.startsWith('http') && !u.startsWith(base) && !u.startsWith('data:') && !u.includes('static.cloudflareinsights.com'));
      check(foreign.length === 0, `@${width}: the page reached ${foreign.length} other origins: ${foreign.slice(0, 3).join(', ')}`);
    }, { out: shots, width, height: width < 500 ? 844 : 900 });
  }
} finally {
  await stopLocal?.();
}

if (problems.length) {
  console.error(`FAIL (${problems.length})`);
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}
console.log(`PASS: the journey ran from a blank account at 1440 and 390 px against ${base}. Screenshots: test-results/`);
process.exit(0);
