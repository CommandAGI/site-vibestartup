# handoff (2026-11-11)

Where VibeStartup stands, what other sessions own, and what is left. Update this file when an item closes, and delete an
item when it is done; history stays in the git log and in CommandAGI's `docs/verification.md`.

## live and verified

- Production: vibestartup.pro, www.vibestartup.pro, vibestartup.us and www.vibestartup.us serve this repository
  (deployed with `pnpm commandagi sites deploy <git archive of HEAD> --prod` from a CommandAGI checkout, as the host
  account that owns the site `vibestartup`; never deploy `.`, which would carry `.test-results/`). The API is
  `https://api.commandagi.com` (`/brand.js`).
- 2026-11-11, at 55b16e5: the journey passes against production's API at 1440 and 390 px (`node test/journey.mjs --api
  https://api.commandagi.com`), every step, with one problem left: the co-founder's first answer can take over 90 s.
- The look is CommandAGI's shape language (2026-11-11, owner): square controls, wall-to-wall selection bands, only
  floats rounded, a phone drawer and bottom bar (`docs/DESIGN.md`; `test/edges.mjs` checks it at every screenshot).
- Payments: a founder's customers pay through CommandAGI's Connect checkout (Settings → Payments onboards a Stripe
  Express account). A physical product is a good, and so is a digital product with its file (`products/files/`). What a
  guest can buy is read at run time (`guestCheckout`, `lib/storefront.js`): the platform's `store` flag (off on
  production for visitors: every good is ordered by email until it is on, below), and whether the checkout sells a
  download to a guest (`email_required` vs `account_required`). The storefront is written from the answer, and its
  checkout falls back to email on either refusal. The co-founder adds products as product files (`productsRule` in
  `lib/business.js`); the Products tab links them to their goods.
- The storefront (`lib/storefront.js`), 2026-11-11 against production's API with a throwaway account (erased): product
  pictures chosen in Products from the Studio library, made into 480/960/1600 px WebP in the browser and served with
  `srcset` and `loading=lazy`; a page per product (`product/<id>.html`: gallery, thumbnails, description, price, buy);
  "Get updates" recorded by the storefront's own server module in the site's KV with the consent words, then listed in
  Customers and copied into `customers/customers.json`; the business's own `legal/terms.html` published in place of
  the default, default privacy and refunds pages otherwise; no sideways scroll at 390 and 1440. The checkout stopped
  at "order by email" (the `store` flag is off, and a new account's goods are drafts until payouts), so Stripe's page
  was not reached.
- Billing sells CommandAGI's credit packs through Stripe Checkout and hires the three listings (Co-founder $39, Growth
  $29, Studio $29 for 30 days) through a service contract proposed from the business's co-founder thread
  (`docs/ARCHITECTURE.md` § hiring). Until a listing is open (2026-12-08) its Hire button is disabled with a Soon pill.
  2026-11-11 on dev, with the listings seeded and launched there for the run and drafted again after it
  (`node test/hire.mjs --api https://api-dev.commandagi.com`): the sheet's price, term, ceiling and renewal, the pack
  offer and its Stripe checkout when short, the contract proposed from the business's thread with the 2,400-credit
  ceiling and a 30-day deadline, signed by the founder, cancelled, and the account erased. VibeStartup's agent did not
  sign within 6 minutes, so escrow, the active row and accept were not reached (below).
- Speed: the console opens in about 2 s (parallel first reads, a file read by path in one call); a business is built in
  under 2 minutes (its folders and files made at once).

## owned by other sessions

- **CommandAGI, started 2026-11-11 by the VibeStartup session's agent:** a brand's own origin for checkout, portal and
  Connect onboarding returns (today a pack's checkout returns to commandagi.com: Billing asks for this origin and falls
  back), and a guest's paid digital good delivered by an emailed download link (github/main 46c73e0). When it reaches
  production: Billing's fallback goes and Settings → Payments passes this origin. The storefront needs no change for
  downloads: the console reads the API's answer (`guestCheckout`) and publishes the storefront again when it changes.

## left to do

- **Hiring: VibeStartup's agent does not sign.** On dev (2026-11-11) a founder's proposed and signed contract for
  `listing-vibestartup-cofounder` stayed `proposed` for 6 minutes. The platform wakes the provider agent
  (`agent-vibestartup-cofounder`) over the bus to call `sign_contract`; that is a model turn of an agent whose account
  migration 0743 left without credits ("dark: no credit grant"), and nothing else signs. The listings need a provider
  side that signs: a standing auto-sign for an org's own listings at their posted price (a provider policy on the
  listing, signed as the org's principal at proposal), or the agent's account funded and its wake checked
  (CommandAGI `routes/services/lifecycle.ts`, `data/wake-seat.ts`). Until then nothing after the founder's signature
  (escrow, the active contract, days left, accept) has run end to end.
- **Hiring: credits used.** A contract's view carries its ceiling (`costCeilingCredits`) and `ceilingReachedAt`, not
  what was spent. Billing shows "N of 2,400 credits used" once `GET /me/contracts` and `GET /services/contracts/:id`
  carry `spentCredits` (the counted sum of `contract_usage`, settled plus unexpired held rows, as
  `data/contract-ceiling.ts` computes it; one more field in `contractView`, `routes/services/shared.ts`).
- **Hiring: the business thread is not the contract's work.** Only spend in the provider's private work thread
  (`provider_thread_id`, keys with `work_thread_id`) counts under the contract and runs on VibeStartup's purse. The
  business's co-founder thread is the founder's and keeps drawing the founder's credits, so a hired co-founder does its
  work in a thread the founder cannot see. The platform needs one of: the customer thread named at proposal billed to
  the contract while it is active (its calls carry the contract, count under the ceiling and charge the provider's
  purse), or the provider's work thread granted the business folder and the founder shown its chat.
- **Hiring: the priced spec on production's Drive.** The working copy of `org-vibestartup/.commandagi/org/org.json`
  now has the prices, ceilings and `backing.agent` (as CommandAGI's fixture) and dev's Drive has it (seed `org-specs`,
  `--files` that one file); production's Drive does not, so production has no listing rows: run
  `node scripts/seed/run.mjs org-specs prod --apply --files <a list naming that file>` before the launch.

- **The welcome, the prompt cache and the floor wait for CommandAGI's next production deploy** (2026-11-11). Landed
  on CommandAGI's main: `POST /threads { greeting }` (ed68bf17c96), the goal step's cached prefix (8b8cf4e42a9) and the
  floor that reads a thread's pinned model (48159a699a2). Until production runs them: the platform drops `greeting`, so
  `cofounder.welcome.kept` is null and the co-founder greets with the model (the opening ask then says so), about 6 s
  after the console opens; afterwards the welcome is the thread's first line and shows the moment the console opens.
  The founder's floor (Sonnet 5.5 or Luna) is set on production now: `PUT /integrations/*/model-floor` answered 200 and
  `GET /integrations` reads it back (`test/cofounder-speed.mjs` checks it).
  Measured on production before that deploy (one run, `--replies 2`): the console 48 s after the wizard, the first
  words 5.9 s after it opened, the first card 21.6 s, replies 45.9 s (the first turn was still making its cards) and
  16.1 s; the co-founder's calls read 31% of their input from OpenAI's cache (20,923 of 67,957 tokens, 8 calls).
  The same request shape straight to OpenAI (gpt-6-luna, a 3,900-token prefix, 3 turns): 0 cached tokens with the turn's
  context before the cache mark, 3,909 on turns 2 and 3 with the mark (CommandAGI `docs/agents.md` § prompt caching).
  The same run on a local platform built from CommandAGI's main with the three changes (`COMMANDAGI_ROOT=<that
  checkout> node test/cofounder-speed.mjs --api local --replies 3`, real OpenAI calls, no site hosting): the welcome's
  first words 0.1 s after the console opened, typed out in 4.6 s; the first card at 3.9 s; replies' first words 7.0,
  9.0 and 3.6 s (whole 8.6, 10.0 and 5.3 s); 80% of the co-founder's input read from the cache (47,312 of 59,499
  tokens, 8 calls), against 29 to 31% on production. The co-founder did not greet again after the welcome.
  After the deploy, run `node test/cofounder-speed.mjs --api https://api.commandagi.com --replies 3` again and write
  the numbers here.
- **Each founder message makes the co-founder call `task_create` again** (production, 2026-11-11, two runs): after
  the day-one cards exist, a question ("What should I put on the storefront first?") brought one to three more
  `task_create` calls before the answer, so the first reply took 22 to 46 s. The local run did not do it. Check the
  Tasks folder of a new business for duplicate day-one cards; if they are there, the charter should say the two cards
  exist (or the opening ask should name the turn it belongs to).
  Fixed 2026-11-11: CommandAGI's `task_create` takes `taskKey` (de1a156159c, for every agent), and a repeat with a key
  a task has answers that task with `existing: true` and makes nothing. The opening ask gives the two cards their keys
  (`day1.storefront`, `day1.offer`: `dayOneTasks`), says to make them once, and the charter and PLAYBOOK.md say every
  approval task has a key of its day and step and that the co-founder reads its open tasks before it makes one.
  `test/cofounder-speed.mjs` now lists the business's tasks and reports a title or a key that is there twice.
  Measured on production after the deploy (de1a156, 2026-11-12 04:2x UTC, `--replies 3`): two tasks, `day1.offer` and
  `day1.storefront`, no title or key twice. The co-founder still called `task_create` once in the first reply (the key
  answered the existing card, so nothing was made), and that reply's first words came at 20.1 s (whole 22.1 s); the
  next two replies 12.8 and 12.0 s (whole 14.2 and 14.6 s). Welcome first words 3.1 s, the first card at 31.2 s, the
  build 30.4 s. 72.9% of the co-founder's input came from the prompt cache (63,183 of 86,715 tokens, 10 calls). Left:
  the extra call in the first reply costs a few seconds; the replies' 12 s is the turn's start, not the model.
- **The co-founder's first answer** (2026-11-11, `node test/cofounder-speed.mjs --api https://api.commandagi.com`):
  before, the first words 17.8 s after the console opened and no day-one card within 150 s (15 file reads, 8
  failed); after (GPT-6 Luna, the thread started during the deploy, a greeting before any tool, the brief in the
  charter), the first words 4.2 to 5.1 s after the console opened and the first approval card at 13.5 to 22.5 s
  (three runs). The words stream token by token once CommandAGI deploys its streamed goal step (013f5c0cf85, "A goal
  step's words stream…"); until then a message arrives whole. A reply to the founder took 18.5 s (a probe over the
  socket): about 8 s before the agent's turn starts and 8 s of its step, whatever the model, so the journey's reply
  check stays at 90 s. The journey of 2026-11-11 15:09 greeted 1.3 s after the chat was up; production was overloaded
  then (a build refused "D1 DB is overloaded", Files "still loading"), and its reply and Files checks failed.
- **One probe account is left on production:** `journey-firstturn-<base36>@example.com` (password in `test/journey.mjs`),
  made 2026-11-11 by a probe whose run was killed before its erase; its exact address was lost. Harmless (no business,
  200 promotional credits); erase it if an admin listing finds it.
- **Site hosting is slow.** A static file of this site takes 0.3 to 6 s to its first byte: the gateway is in the api
  worker, which Smart Placement runs near its database (`cf-placement: remote-ARN` seen from SJC). A gateway worker of
  its own at the visitor's edge would serve every tenant site from its PoP (CommandAGI `docs/site-hosting.md`).
- **Existing storefronts keep their rounded stylesheet** until they are published again (any product change in the
  console publishes it).
- `brand/og.html` and `og.png` still show the rounded look; the storefront falls back to the system font.
- **The storefront's checkout has not reached Stripe's page** on any stack since it was written: on production the
  `store` flag refuses a visitor's cart (`feature_off`). Once the owner turns it on (below), a run with a founder whose
  payouts are ready should buy a physical good to Stripe's page, and a download with only an email once 46c73e0 is
  deployed.
- **The brand address is ready in the app, not in DNS** (below). Until the record exists nothing is offered; the
  storefront's own address stays `<slug>.commandagi.app`.
- **Sign-ups have no unsubscribe link yet.** The consent says "I can stop them at any time"; today that is a reply to
  the business address and the founder removing the row (`DELETE /api/signups?email=` on the storefront, with the
  read key, is there; no button calls it). Sending updates is Outbound's job and should carry the link.
- `lib/api.js` has no fetch timeout; a hung call shows the tab's "still loading, Try again" banner after 10 s.

## for the owner

- **The previous site's resources.** The production site `vibestartup` still holds the previous app's D1, KV,
  `COFOUNDER_MODEL` and `OPENROUTER_API_KEY`; this site uses none of them. Deleting the D1 loses what the previous app
  stored (its sign-ups). To remove them:

  ```
  pnpm commandagi sites resources vibestartup rm d1
  pnpm commandagi sites resources vibestartup rm kv
  pnpm commandagi sites env vibestartup rm OPENROUTER_API_KEY
  pnpm commandagi sites env vibestartup rm COFOUNDER_MODEL
  ```

- **Open the store to guests.** CommandAGI's `store` flag (`/commerce/*`, `packages/domain/world/flags.js`) is off on
  production, so every storefront's checkout answers `feature_off` to its buyers and the storefronts take orders by
  email. It is a money decision, so it is yours: `node scripts/release/flags.mjs --env prod set store on` in a
  CommandAGI checkout (`docs/feature-flags.md` § changing a flag). The storefronts follow at their next publish (the
  console publishes again when it sees the change).
- **`<slug>.vibestartup.pro` for every storefront** (owner decision 2026-11-11). CommandAGI records a site made
  through VibeStartup's sign-in as VibeStartup's (`sites.brand`) and answers the public `GET /sites/brand/:slug`;
  the edge Worker `edge/subdomains.js`, in the Cloudflare account that holds vibestartup.pro, proxies
  `<slug>.vibestartup.pro` to `<slug>.commandagi.app` for such a site only, and answers every other name with the
  branded 404. The console shows `site.brandUrl` and the storefront's canonical links name it. Two steps are
  yours: CommandAGI's next production deploy (it carries the lookup), and the Worker in the dashboard
  (`edge/README.md` § deploy: the Worker `vibestartup-subdomains`, the route `*.vibestartup.pro/*`, no binding;
  remove today's "no startup here yet" Worker's route). Deploying the Worker first is safe: until the lookup is on
  production it answers 404 for every label.
- **vibestartup.us** now shows this app too: its domain was already on the site. Its Google Workspace mail is
  unchanged.
- **Prices, the paid providers and the launch.** The pages say "set at launch". Payments, ads, social posting and
  outbound mail stop at "connect your provider".
- **`hello@vibestartup.pro`.** Where it forwards: an Email Routing rule in the vibestartup.pro zone.
- **commandagi.com's gloss highlight.** It is a design call on CommandAGI's own site, not this one: a one-edge line on
  every rounded control (CommandAGI `docs/verification.md`, 2026-11-03).

## known limits of the product

- One personal mail address per CommandAGI account: a second business shows the email gap and says why.
- Site hosting, secrets and domains are cloud-only: against a local platform the journey skips those steps.
