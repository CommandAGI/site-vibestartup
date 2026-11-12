# handoff (2026-11-12)

Where VibeStartup stands, what other sessions own, and what is left. Update this file when an item closes, and delete an
item when it is done; history stays in the git log and in CommandAGI's `docs/verification.md`.

## where things stand (2026-11-12)

- **Soft launch:** live since 2026-11-11. Admin (account menu → Admin, for an admin of `org-vibestartup`) counts the
  founders, businesses, sales and free credits; on 2026-11-12 the only founders were the owner and one test account.
- **CommandAGI production** runs main past 1b260438ddc. That includes the brand lookup, the instant welcome, prompt
  caching, the model floor, `taskKey`, `GET /me/threads?of=`, `jsonSchema` on `/models/call`, the business-org
  foundations and the durable approval questions.
- **Deploys are shared with the CommandAGI session `commandagi-73`.** Land on CommandAGI's github/main and ride its next
  production ship; never start a production deploy of CommandAGI while another runs
  (`systemctl --user list-units | grep -iE 'deploy|ship'`). The owner waived the CI gate for the launch (2026-11-11);
  the waiver is named in every deploy's record.
- **Every business is its own org (step 2, done 2026-11-12).** A new business is `org-<slug>` (founded by the founder,
  brand `vibestartup`); its files are the schema's at the org's root (`docs/schema.md`, `lib/schema.js`), its
  co-founder an agent forked into the org with the charter as its instructions, its chats, site, address, tasks, goods
  and payouts the org's. Every tab reads the org through one seam (`bizDrive`, `bizTasksApi`, `bizAccount`); nothing
  reads `Businesses/<slug>/`. The owner's DigitalProduct moved into `org-digitalproduct` with
  `scripts/move-to-org.mjs` (16 files copied and checked by size and SHA-256, the site transferred with its slug,
  deploys and analytics, its good adopted with the same id, slug and SKU, the old chat listed as "Before the move", the
  briefing on the new chat); records in CommandAGI's `docs/verification.md` (2026-11-12) and
  `test-results/business-org-2026-11-12/`. Its mail address stays the owner's until CommandAGI can move an address to
  an org.
- **Ads are "Soon".** Meta app "VibeStartup Ads" (1338102101689302, portfolio commandagi 1379331479721276) is Live.
  Business verification was submitted on 2026-11-11 (about 2 business days), access verification on 2026-11-12
  (about 5 business days). App Review for advanced `ads_management` follows both; its material is
  `docs/meta-app-review.md`. Until then only the app's admins' and testers' ad accounts connect, and the platform's
  switch (`meta,vibestartup-ads` `enabled=false`) stays off.
- **Next (planned):** move what any CommandAGI app could use into CommandAGI, with VibeStartup keeping a brand subset:
  first the store templates (as generators with commerce parts and a per-brand subset), then the chat Markdown kit,
  then the shared co-founder notes as one skill. Brand things stay here: `*.vibestartup.pro`, the look, the words.

## live and verified

- Production: vibestartup.pro, www.vibestartup.pro, vibestartup.us and www.vibestartup.us serve this repository
  (deployed with `pnpm commandagi sites deploy <git archive of HEAD> --prod` from a CommandAGI checkout, as the host
  account that owns the site `vibestartup`; never deploy `.`, which would carry `.test-results/`). The API is
  `https://api.commandagi.com` (`/brand.js`).
- 2026-11-13, the org co-founder's controls, credits and Drive (production, throwaway accounts, erased):
  - Chat controls: the charter reached the agent whole (14,133 characters, read back from `GET /agents/:id`, and
    CommandAGI reads an agent's `systemPrompt` at each turn). It was not cut. The model asked through CommandAGI's
    `ask_user` verb, which draws only plain buttons, and said "this chat's controls don't provide a slider". The charter
    now says a control is text in one `done` action, with the whole action as an example, and that no message comes
    before it. The console writes a changed charter into an existing co-founder once (`refreshCharter`). API trials:
    0 of 4 sliders before, then 18 of 18 on a fresh thread. Browser runs of `test/chat-widgets.mjs`: select and slider
    passed in runs 1, 2, 5 and 7 (the select 7 to 13 s after the question, the slider 11 to 14 s). Runs 3, 4 and 6 drew no
    select: the model sent its words without the block, mostly while its day-one turn was still ending.
  - Who pays: the founder (an org's thread bills its owner). A call draws the free plan's `ai` allowance first (30
    credits each 8 hours, `GET /quota`), then the free credits, then the bought ones. A chat-only thread's spend was never
    settled: the ledger flushed only at an alarm, and a chat arms none. CommandAGI 3bd4e4ec2ef settles each call as it
    ends. Credit probe (sonnet, 4 turns): `ai` used went 5, 10, 15, 19; before the fix it stayed at 0 while 21.5 credits
    were owed. Past the allowance the call is refused. Chat now shows that refusal as a notice with a link to Billing.
    Billing shows the allowance and each co-founder's calls. A `@example.com` probe has no credits, so a ledger row
    cannot be shown with one; the API test covers the credits path.
  - Drive: inside an org thread, the co-founder's `list_drive {account}` answered 404 for an org with no handle.
    CommandAGI 5c5e235 fixed it; list, write and read now pass in a fresh org thread. Not checked: org-digitalproduct's
    co-founder (it needs the owner's session).
  - Products: `node test/org-goods.mjs` passes 7 of 7. A Products-tab mug is the org's good (`acct:org:<id>`, the
    product file in `products/`, $28.00), a draft while payouts are not onboarded, and not among the founder's goods.
- 2026-11-12, every business an org: `node test/journey.mjs --url https://vibestartup.pro` passes at 1440 and 390 px
  with no problem (two throwaway founders, erased): the org `org-<slug>` with the schema's files and no stray, the
  storefront live at `<slug>.vibestartup.pro`, the co-founder answering in its org chat (11.9 and 17.9 s), the approval a
  file of the org's `Tasks/`, Files' lens and Open in CommandAGI link, the Finish payouts card, the switcher with two
  businesses, and the founder's erasure taking both business orgs (no `orgs_held`; `GET /sites/brand/<slug>` 404 after).
  `test/sidebar.mjs` 58 of 58; `test/schema.mjs` 6 of 6; `test/storefront.mjs` 53 of 53. `test/chat-widgets.mjs`: the
  select passed (server lock, reply); the slider, and in a second run the select, were not drawn by the model in time.
  Screenshots and logs: CommandAGI's `test-results/business-org-2026-11-12/`.
- 2026-11-11, at 55b16e5: the journey passes against production's API at 1440 and 390 px (`node test/journey.mjs --api
  https://api.commandagi.com`), every step, with one problem left: the co-founder's first answer can take over 90 s.
- Chat controls (2026-11-12): a co-founder message's `ui` renders as options, a multiselect, a slider, yes or no, got
  it, a text box, a file picker, and lens and graph charts (`lib/widgets.js`, `test/widgets.mjs`). `node
  test/chat-widgets.mjs` (against production's API, a throwaway account, erased): the co-founder sent a select 13.0 s
  after the question, the click locked it on the server in 0.38 s and the reply came 11.4 s after the click; a slider
  16.5 s, locked 0.28 s, reply 15.0 s; no sideways scroll at 390. The charter teaches the cagi-ask shapes
  (`WIDGETS_RULE`); without a whole example message the model said the chat could not show a slider. The agent loop's
  `confirm` approval is a durable question since CommandAGI 1b260438ddc (58f556fa469): its Approve and Deny survive a
  reload, and the chat draws it once, by the question (e2a22c0).
- The rail's levels (2026-11-12): the tab shown opens under its row (`app/nav.js`, `app/levels.js`). Chat lists the
  business's 5 most recently active chats, More for 5 more, and New chat (a thread about its `business.json`, listed by
  CommandAGI's `GET /me/threads?of=`, live on production since ff7e012); Analytics, Tasks, Email and Files list their
  views, Products its products. `node test/sidebar.mjs --url https://vibestartup.pro` (a throwaway account, erased): 8
  chats, each answered in 9.5 to 14.1 s; the rail's 5 newest first, More brings the other 3 once; the first chat keeps
  its own lines and a live reply came in 10.3 s; the views as addresses; the keys; 390 px in the drawer; no sideways
  scroll, no console error: 58 of 58. `--fixed` checks an API without `of` (the first chat alone, no New chat): 19 of
  19 before ff7e012. Screenshots: CommandAGI's `test-results/sidebar-2026-11-12/`. A chat is titled by the platform
  after its first exchange; until the rail reads it again (25 s after a line) it says "New chat".
- The look is CommandAGI's shape language (2026-11-11, owner): square controls, wall-to-wall selection bands, only
  floats rounded, a phone drawer and bottom bar (`docs/DESIGN.md`; `test/edges.mjs` checks it at every screenshot).
- Payments: a founder's customers pay through CommandAGI's Connect checkout into the business's own Stripe Express
  account (the Finish payouts card onboards the org). A physical product is a good, and so is a digital product with its file (`products/files/`). What a
  guest can buy is read at run time (`guestCheckout`, `lib/storefront.js`): the platform's `store` flag (off on
  production for visitors: every good is ordered by email until it is on, below), and whether the checkout sells a
  download to a guest (`email_required` vs `account_required`). The storefront is written from the answer, and its
  checkout falls back to email on either refusal. The co-founder adds products as product files (`productsRule` in
  `lib/business.js`); the Products tab links them to their goods.
- The storefront (`lib/storefront.js`), 2026-11-11 against production's API with a throwaway account (erased): product
  pictures chosen in Products from the Studio library, made into 480/960/1600 px WebP in the browser and served with
  `srcset` and `loading=lazy`; a page per product (`product/<id>.html`: gallery, thumbnails, description, price, buy);
  "Get updates" recorded by the storefront's own server module in the site's KV with the consent words, then listed in
  Customers and written as contacts, `contacts/<email>.vcf`; the business's own `legal/terms.html` published in place of
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
- Markdown (2026-11-12): the co-founder's messages and a card's reasoning render as Markdown, with every character of
  the source escaped first and links kept to http(s), mailto and same-site (`lib/md.js`, `test/md.mjs`).
- Storefront templates (2026-11-12): six layouts (spotlight, shop, launch, services, club, maker) by eight styles
  (studio, editorial, bold, soft, playful, luxe, mono, craft), chosen in `Businesses/<slug>/storefront.json` with the
  words and section switches; the Storefront tab previews and publishes, and the co-founder edits the file
  (`lib/storefront-design.js`, `test/storefront.mjs`: 53 pass; screenshots in CommandAGI's
  `test-results/storefront-templates-2026-11-12/`). DigitalProduct was published with spotlight × mono.
- Sign-up suggestions (2026-11-12): one Claude Haiku 5.5 call through `POST /models/call` with a JSON schema gives the
  names, tagline, ranked blueprints, a first product, and the layout and style, about 3 s after the founder stops
  typing; one credit of the founder's free allowance. A failed or late call gives neutral fixed choices; nothing reads
  the idea by keywords (`test/suggest.mjs`).
- `<slug>.vibestartup.pro` serves every VibeStartup storefront (the edge Worker `vibestartup-subdomains` on
  `*.vibestartup.pro/*`, `edge/README.md`; CommandAGI's `GET /sites/brand/:slug`); other names get the branded 404.
- Speed: the console opens in about 2 s (parallel first reads, a file read by path in one call); a business is built in
  under 2 minutes (its folders and files made at once).

## owned by other sessions

- **CommandAGI's org conversion (`commandagi-73`).** 7,745 of the 7,982 orgs with origin `public-record` (7,629 SEC
  issuers, 116 Alibaba suppliers) become folders of `org-commandagi/relisting/<slug>/` (CommandAGI
  `docs/next/relisting.md`); the owner approved the deletes. The other 237 are stores (org-parts-digikey and
  org-parts-mouser, the org-shop-* shops) and stay accounts, because purchases and supplier sync read them. Every other
  org stays, and an org a brand client creates is never touched. Since 2026-11-12 the owner's account owns every
  production org, so erasure and the brand admin view find a founder's businesses by the org's recorded founder and
  brand (`orgs.founded_by`, `orgs.brand`), never by owner.
- **A brand's own origin for checkout, portal and Connect returns, and guest downloads** (CommandAGI 46c73e0) are on
  production. Billing's fallback is still in the code (left to do).

## left to do

- **Business orgs, what the platform does not do yet** (CommandAGI `docs/next`, the VibeStartup file): an address moved
  to an org (DigitalProduct writes from the owner's `digitalproduct@commandagi.email`); a site moved back to a person;
  a seller's legal type (Connect onboards every org as `company`; a sole proprietor is `individual`); the org's own
  purse (an org's chats bill its owner, so the founder's credits, free first, pay).
- **Ads in an org.** The Meta ads routes read the founder's own Drive for a campaign's picture and plan; the console now
  names them by address (`cloud://home/org-<slug>/…`). Check that `POST /meta-ads/campaigns` resolves an org address
  before Ads opens (it is "Soon" until then).
- **The Products tab writes a product file with JSON string attributes** (`name={"…"}`, `lib/business.js`
  `productFile`). The co-founder's files use plain strings. Check that a physical product added in Products is indexed
  as the org's good on production (the journey's step 6 says which badge it got).

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

- **The welcome, the prompt cache and the floor are on production** (CommandAGI 7a06ccdc999, 2026-11-12). Measured
  after (de1a156, `node test/cofounder-speed.mjs --api https://api.commandagi.com --replies 3`): welcome first words
  3.1 s, replies' first words 20.1, 12.8 and 12.0 s, 72.9% of the co-founder's input from the prompt cache. The
  replies' 12 s is the turn's start on the platform, not the model.
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
- **The storefront's checkout has not reached Stripe's page** on any stack since it was written: on production the
  flag is on now, but no run has had a founder whose payouts are ready. Such a run should buy a physical good to
  Stripe's page, and a download with only an email.
- **Sign-ups have no unsubscribe link yet.** The consent says "I can stop them at any time"; today that is a reply to
  the business address and the founder removing the row (`DELETE /api/signups?email=` on the storefront, with the
  read key, is there; no button calls it). Sending updates is Outbound's job and should carry the link.
- **Launch follow-ups not done yet:** require Turnstile on OAuth sign-ups (`signup.turnstile.require.oauth`); an
  "Unlock more credits" card from `GET /me/free-credits`; drop Billing's origin fallback (the brand origin is on
  production); seed the listing terms to production (`org-specs`, above).
- **The Email tab's own folder buttons** don't move the address or the rail's highlight; the rail's links do.
- **Existing businesses keep the co-founder instructions they were made with** until step 2 puts the charter in the
  agent (`docs/schema.md`).
- `lib/api.js` has no fetch timeout; a hung call shows the tab's "still loading, Try again" banner after 10 s.

## for the owner

- **Finish DigitalProduct's payouts.** Its own Stripe account is made. Open https://vibestartup.pro/app/?b=digitalproduct,
  press **Finish payouts** (Dashboard, Products or Settings) and fill in Stripe's form: identity, bank and tax. Until
  then its good stays a draft and the storefront takes orders by email.
- **The old chat's run stays in your Drive** at `Businesses/digitalproduct/runs/` (the folder's only content): a run
  cannot change hands, and its thread writes there. Everything else of the folder is in your Trash, restorable.

- **The previous site's resources.** The production site `vibestartup` still holds the previous app's D1, KV,
  `COFOUNDER_MODEL` and `OPENROUTER_API_KEY`; this site uses none of them. Deleting the D1 loses what the previous app
  stored (its sign-ups). To remove them:

  ```
  pnpm commandagi sites resources vibestartup rm d1
  pnpm commandagi sites resources vibestartup rm kv
  pnpm commandagi sites env vibestartup rm OPENROUTER_API_KEY
  pnpm commandagi sites env vibestartup rm COFOUNDER_MODEL
  ```

- **vibestartup.us** now shows this app too: its domain was already on the site. Its Google Workspace mail is
  unchanged.
- **Meta.** When Meta writes about the two verifications or App Review, forward the mail. Both verifications must
  pass before App Review can be submitted.
- **Stripe, after step 2.** Each business org gets its own Connect account; Stripe's own form (identity, bank, tax)
  is the founder's, so DigitalProduct's needs the owner once.
- **Prices, the paid providers and the launch.** The pages say "set at launch". Payments, ads, social posting and
  outbound mail stop at "connect your provider".
- **`hello@vibestartup.pro`.** Where it forwards: an Email Routing rule in the vibestartup.pro zone.
- **commandagi.com's gloss highlight.** It is a design call on CommandAGI's own site, not this one: a one-edge line on
  every rounded control (CommandAGI `docs/verification.md`, 2026-11-03).

## known limits of the product

- One personal mail address per CommandAGI account: a second business shows the email gap and says why.
- Site hosting, secrets and domains are cloud-only: against a local platform the journey skips those steps.
