// The Ads tab's Meta path at 1440 px, as screenshots for Meta's App Review (docs/meta-app-review.md § the screencast):
// the plan, the connected account and its chooser, the launch dialog, the campaign with its insights; with --delete,
// the campaign is deleted at Meta at the end. Its account must already hold a meta-ads connection: the connect step is
// Facebook's own dialog, recorded by hand (a script cannot sign in to Facebook).
//
//   VS_EMAIL=… VS_PASSWORD=… node test/meta-ads-walkthrough.mjs --url http://localhost:4193 --api http://127.0.0.1:PORT \
//     --business mug-studio [--link https://vibestartup.pro/] [--launch] [--delete] [--out .test-results/meta-ads]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withBrowser, sleep } from './browser.mjs';

const arg = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const has = name => process.argv.includes(`--${name}`);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const url = arg('url'), api = arg('api'), biz = arg('business'), out = path.resolve(root, arg('out', '.test-results/meta-ads'));
if (!url || !biz || !process.env.VS_EMAIL || !process.env.VS_PASSWORD) throw new Error('--url, --business, VS_EMAIL and VS_PASSWORD are required');
const console_ = `${url}/app/?b=${encodeURIComponent(biz)}${api ? `&api=${encodeURIComponent(api)}` : ''}#tab=ads`;

await withBrowser(async b => {
  const step = async (name, what) => { await sleep(400); await b.shot(name); console.log(`${name}: ${what}`); };
  await b.goto(`${url}/auth/${api ? `?api=${encodeURIComponent(api)}` : ''}`);
  await b.eval(`import('/lib/api.js').then(m => m.signIn(${JSON.stringify({ email: process.env.VS_EMAIL, password: process.env.VS_PASSWORD })})).then(() => true)`);
  await b.goto(console_);
  await b.waitFor('!!document.querySelector("#ads-launch")', 30000);
  await step('01-plan', 'the plan, the readiness list and Launch');
  const connected = await b.waitFor('!!document.querySelector("#ads-target-account option[value^=act_]")', 30000).then(() => true, () => false);
  if (!connected) { await step('02-connect', 'Connect your ad account (no connection yet)'); return; }
  await b.eval('document.querySelector("#ads-target").scrollIntoView({ block: "center" })');
  await step('02-account', 'signed in, the ad account and the Page to choose');
  if (has('launch') && await b.eval('!document.querySelector("#ads-launch").disabled')) {
    await b.eval('document.querySelector("#ads-launch").scrollIntoView({ block: "center" }); document.querySelector("#ads-launch").click()');
    await b.waitFor('!!document.querySelector("#launch-form")');
    await b.eval(`(() => { const f = document.querySelector('#launch-form'); if (!f.link.value) f.link.value = ${JSON.stringify(arg('link', 'https://vibestartup.pro/'))}; })()`);
    await step('03-launch', 'the launch dialog: the Studio picture, the caption, the link, the budget at most the plan');
    await b.eval('document.querySelector("#launch-go").click()');
    await b.waitFor('!!document.querySelector("[data-campaign]")', 60000);
  }
  if (await b.eval('!!document.querySelector("[data-campaign]")')) {
    await b.waitFor('!document.querySelector("[data-insights]")?.textContent.includes("Reading")', 30000).catch(() => null);
    await b.eval('document.querySelector("[data-campaign]").scrollIntoView({ block: "center" })');
    await step('04-campaign', 'the campaign: its status, its approval, what Meta stopped at, its insights');
    if (has('delete')) {
      // The page's confirm dialog: press Delete, then its OK.
      await b.eval('document.querySelector("[data-act=delete]").click()');
      await b.waitFor('!!document.querySelector(".modal-actions button[value=ok]")');
      await step('05-delete', 'deleting the campaign asks first');
      await b.eval('document.querySelector(".modal-actions button[value=ok]").click()');
      await b.waitFor('!document.querySelector("[data-campaign]")', 30000);
      await step('06-deleted', 'the campaign is gone at Meta and here');
    }
  }
  if (b.problems.length) console.log('problems:', b.problems.join('\n'));
}, { out, width: 1440, height: 900 });
console.log(`screenshots in ${out}`);
