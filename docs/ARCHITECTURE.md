# VibeStartup: how the app is built on CommandAGI

Owner direction, 2026-11-03: "give it a commandagi token or whatever so that it wraps the actual functionality from
commandagi instead of re-implementing the same thing. VibeStartup is just a brand for commandagi; both operate from
CommandAGI Inc, a Delaware C corp." So this app keeps no accounts, no database and no model call of its own. Every
feature is a CommandAGI feature, called with the founder's own CommandAGI token, under the VibeStartup brand.

## the token

- VibeStartup is a **platform-owned OAuth client** of CommandAGI: `oauth_clients.id = vibestartup`, type `public`,
  scopes `["*"]`, no owner (migration 0708 in the CommandAGI repository). A platform-owned client may take a password
  at the token endpoint (`docs/brands.md` in the CommandAGI repository).
- **Sign in**: `POST {api}/oauth/token` with `grant_type=password&client_id=vibestartup&username=&password=` →
  `{ access_token, refresh_token, expires_in }`. The access token is a 90-day API key of the founder's account named
  "VibeStartup (connected app)"; `refresh_token` rotates it.
- **Sign up**: `POST {api}/oauth/signup` `{ client_id: "vibestartup", email, password, name }` → the same answer plus
  `created: true`. It creates the CommandAGI account (the platform's sign-up cap and policy acceptance apply) and signs
  it in, in one call.
- The token lives in this origin's `localStorage` (`vs_auth`). The pages call the API themselves with it as a bearer
  (`lib/api.js`). A 401 refreshes once, then signs out. Sign-out revokes the grant (`DELETE /me/oauth/grants/:id`).
- **The site's worker serves the shell and nothing else.** A site's Worker cannot fetch the platform's worker
  (Cloudflare refuses a worker's call to the script that dispatched it), so `app.mjs` only serves `/brand.js` (which
  API the page talks to: production, dev or a local platform) and the static pages.

## which API

| the page's host | `BRAND.api` |
|---|---|
| `vibestartup.commandagi.app`, `vibestartup.pro`, `vibestartup.us` | `https://api.commandagi.com` |
| `vibestartup--dev.commandagi.app`, any other `*--dev.commandagi.app` | `https://api-dev.commandagi.com` |
| a local run (`test/local.mjs`) | the local platform it started, or `--api <origin>` |

`app.mjs` reads `env.VIBESTARTUP_API` first (a site env var), then the host.

## one business = one org

A business is a CommandAGI org, `org-<slug>`, founded by the founder with VibeStartup's token, so CommandAGI records
VibeStartup as its brand (`orgs.brand`) and the founder as its founder (`orgs.founded_by`). The root of its Drive,
`cloud://home/org-<slug>/`, is the business. `docs/schema.md` is the schema: every file, who writes it, and which tab
reads it; `lib/schema.js` holds it in code (the paths, the lens, the charter's code map and platform, the lint). Every
tab reads and writes the org through one seam: `bizDrive(biz)` (`drive.forAccount(org)`: `owner=org&ownerScope=` on
`/drive*`, reads by path at `/accounts/org-<slug>/files/<path>`), `bizTasksApi(biz)` (`?owner=org&ownerScope=` on
`/me/tasks*`) and `bizAccount(biz)` (`x-cagi-account: acct:org:org-<slug>` on `/goods*` and `/connect/*`).

The co-founder's thread, triggers and site are CommandAGI objects whose ids `business.json` records.

| feature | CommandAGI piece (HTTP route, or the MCP tool at `POST /mcp`) |
|---|---|
| the co-founder | its own agent, a fork of the catalog's base instance of `COFOUNDER_MODEL` (`lib/business.js`: `openai/gpt-6-luna` at low effort, chosen for speed; `POST /agents/openai-gpt-6-luna/fork { name, instructions: <the charter>, ownerScope: <org> }` (made in the org: its `agent.tsx` is in the org's Drive; the charter, with the platform's part and the code map from `lib/schema.js`, is its instructions, so every chat starts with it), then `PATCH /agents/:id { modelEffort, access: { scopes: ["*"], reach: "project" } }`), and `POST /threads { ownerScope: <org>, title, agentName, fromAgentId, greeting: { text, template: "vibestartup.welcome.v1" }, surface: "vibestartup", about: <the org's business.json address>, idempotencyKey }`: a thread of the org on that agent, whose tools reach the org's Drive and tasks with `account: "acct:org:<org>"` (the charter says so), and whose first line is the welcome (below). The same launch again with `intent` (its replay delivers the opening ask once) asks for the two day-one approval tasks; after a kept welcome the ask says not to greet again, and on a platform that keeps no welcome it asks for a hello first. The thread starts while the storefront deploys. The platform's model floor (`connections.modelFloor`, Sonnet 5.5 for every connected account) would refuse this agent the founder's connected accounts, so the founder's own level lists Luna too (`FOUNDER_FLOOR`: `PUT /integrations/*/model-floor { floor: [Sonnet 5.5, Luna] }` with the founder's token, at sign-up in `auth/auth.js`, and at an older account's next business while its floor is still the platform's default; a floor the founder chose stays) |
| the welcome | `welcomeFor` (`lib/business.js`): the co-founder's first message, written from the record (the founder's first name, the business, the co-founder's name, character and voice, the idea, the storefront's address, the two day-one tasks) before any model runs. It is the thread's first line, said as the co-founder (`greeting` above), so it persists, a reload shows it, and the co-founder's first turn reads it as its own words. It is a template's words: the line carries `template` and the record `cofounder.welcome { template, text, at, kept, lineId }`, so no count takes it for a model's output. The console shows it from the record before the transcript is read, and types it out word by word (30 to 60 ms a word) the first time this browser shows it; at once under `prefers-reduced-motion` and after that (`vs_typed` in `localStorage`) |
| chat | `GET /threads/:id/chat?limit=` (the transcript), MCP `send_message`, and the thread's socket (`POST /threads/:id/ws-token` → `wsUrl`): `message.delta` (the co-founder's words while the model writes them), `message`, `agent.status` and `state` (typing). Without a socket the chat reads the transcript every 4 s |
| chats | a business has many chats with its co-founder. Each is a thread about the business's `business.json` (`about` at `POST /threads`); `GET /me/threads?of=<that address>&limit=5&cursor=` lists them, most recently active first, with `nextCursor` for the rail's More. New chat (`lib/business.js` `startChat`) makes a thread with the same charter and the co-founder's agent (`fromAgentId`: its model, effort and tools) and no opening ask; the platform titles it after the first exchange. `#tab=chat&thread=<id>` opens one; `#tab=chat` the most recently active. The approval cards, the files, the tasks and the daily briefing belong to the business: every chat shows the same cards, and the routines stay on the first thread (`cofounder.threadId`). An API whose `GET /me/threads` has no `nextCursor` (it ignores `of`) lists the first chat alone |
| chat widgets | a chat entry's `ui` (CommandAGI's `ChatUi`): select, multiselect, slider, confirm, acknowledge, text and file are answered with `{t:"widget.respond", id, value}` on the thread's socket, which locks the widget (`message.update`), posts the answer as the founder's line and wakes the co-founder; with no socket or no update in 8 s the chat reads the transcript, then answers the question (`POST /threads/:id/questions/:q/answer {text}`). A file picker uploads to `POST /threads/:id/uploads?requestId=`. `lens` and `graph` are charts (SVG and a table, `lib/widgets.js`); a `visualize` call's chart is read from its tool line's output, since the platform gives that line no `ui`. The co-founder makes a widget with a ```` ```cagi-ask ```` JSON block (`WIDGETS_RULE` in `lib/business.js`) or with `request_upload`. The agent loop's own approval barrier (its `confirm` step: a "Needs your approval" line and the socket's `{t:"prompt"}`) shows Approve and Deny while the page is open, answered with `{t:"prompt.respond", id, value}` and closed by `prompt.resolved`; the platform keeps no pending prompt in the transcript, so a reload loses the buttons |
| approvals | tasks in the org's `Tasks/` (the task tools with `account`, the REST door with `?owner=org&ownerScope=`) with the label `needs-approval`, assigned to the founder. Approve: `PATCH /me/tasks/:id { doc: { status: "doing", assignees: ["agent:<id>"] } }` and a chat line; reject: `cancelled` |
| tasks | `POST /me/tasks?owner=org&ownerScope=<org> { dir: "Tasks", doc, body }`, `GET /me/tasks?owner=org&ownerScope=<org>&labels=biz:<slug>&includeClosed=1`; the co-founder's `task_create`/`task_list` with `account: "acct:org:<org>"` |
| routines (daily briefing) | the thread's triggers: `POST /threads/:id/triggers { kind: "cron", everySeconds, prompt, label }`, `PATCH … { enabled }`, `GET …/events`; run now: `POST /threads/:id/inject { prompt, label }` |
| files (memory) | the org's Drive: `GET /drive?path=&owner=org&ownerScope=<org>`, `GET /accounts/<org>/files/<path>` (a read by path; `GET /accounts/<org>/files?prefix=` lists sizes and SHA-256), `GET /drive/:id/content`, `POST /drive/upload?path=&name=&owner=org&ownerScope=`, `POST /drive/folders`, `DELETE /drive/:id` (to the Trash). Files shows the lens's folders only (never `.commandagi/`, `agents/`, `runs/`, `Sites/`) and one Open in CommandAGI link (`https://commandagi.com/file?path=cloud://home/<org>/`) |
| the storefront | `POST /sites { name, slug }`, then `POST /sites/:id/transfer { ownerScope: <org> }` before anything is in it (the site's slug decides the org's handle, so the two are the same; its folder is `Sites/<name>` in the org's Drive), VibeStartup's storefront files written into that folder (`lib/storefront.js`), `POST /sites/:id/deploy { source: "folder" }`; live at `https://<slug>.commandagi.app` and at `https://<slug>.vibestartup.pro` (below). The files: `index.html` (products, "Get updates"), `product/<id>.html` (gallery, description, price, buy), `checkout.html`, `terms.html`, `privacy.html`, `refunds.html` (the business's `legal/*.html` when it has them, else defaults), `images/` (each product picture at 480, 960 and 1600 px as WebP, made in the founder's browser from the Drive file, served with `srcset` and `loading=lazy`; the brand gradient only when a product has none), `products.json`, `style.css`, `logo.svg`, `app.mjs` |
| storefront sign-ups | the storefront's own server module (`app.mjs`) keeps them in the site's KV (`POST /sites/:id/resources { kind: "kv" }`, `env.KV`): `POST /api/signups { email, name, consent: true }` from the visitor (the module records its own consent words, not the page's), `GET /api/signups` for the founder with `SIGNUPS_READ_KEY`, a plain env var of the site (`PUT /sites/:id/env { secret: false }`) that only the site's owner reads (`GET /sites/:id/env`). A site's Worker cannot reach the platform's API, so nothing on the storefront writes to the Drive; the Customers tab reads the sign-ups and writes each as a contact, `contacts/<email>.vcf` (`CATEGORIES:signup`, the consent in `NOTE`; `lib/contacts.js`). Where the KV cannot be made (a local platform), the form says to write to the business address |
| the brand address | `<site slug>.vibestartup.pro`: CommandAGI records a site made with VibeStartup's token as VibeStartup's (`sites.brand`) and names its address in `site.brandUrl` (`GET /sites/:id`); VibeStartup's edge Worker (`edge/subdomains.js`) asks the public `GET /sites/brand/:slug` and proxies a VibeStartup site's requests to `<slug>.commandagi.app`, every other name its 404. The record keeps `site.brandUrl`; the console and the storefront's canonical links use it, else the commandagi.app address |
| custom domain | `POST /sites/:id/domains { hostname }` → the records to add; `GET /sites/:id` → `domains[]` |
| environment secrets | `PUT /sites/:id/env { key, value, secret: true }`; `GET /sites/:id/env` lists names (a secret's value is write-only) |
| analytics | `GET /sites/:id/analytics?hours=` (requests, errors, CPU: what the edge measured; no visitor is invented) |
| business email | the org's address: `POST /orgs/:id/email-addresses { localPart, label }` → `<slug>@commandagi.email` (up to 25 an org, so every business has one); `GET /email/addresses`, `/email/addresses/:id/threads`, `…/threads/:tid`, `…/reply`, `…/compose`. A business moved from a founder's folder keeps the founder's own address until CommandAGI can move one to an org |
| products, orders, customers | files (above). A physical product is also a good: its product file, `products/<id>.product.tsx`, which the Products tab writes and the Drive indexes as a good the org sells (`GET /goods`, `PATCH /goods/:id` with `x-cagi-account: acct:org:<org>`), live once the business's own Stripe Express account can be paid (`POST /connect/refresh { account }`; the Finish payouts card starts `POST /connect/onboard` as the org and opens Stripe's form, which only the founder fills in). The storefront's `checkout.html` makes a guest cart (`POST /commerce/cart`, `/items`) and starts the one cart checkout (`POST /billing/checkout`, `type: cart`): the buyer pays into the business's account less the 0.5% fee and returns to the storefront (`?paid=1`, `?canceled=1`; the API reads the site from its records). Orders are `GET /goods/orders` as the org. A digital product with its file (`products/files/<name>`) is a digital good (`kind: "digital"`, the variant's `file`): an all-digital cart's checkout asks only for the buyer's email (no `shippingAddress`; the buyer is emailed the download links), where the API sells downloads to guests. What a guest can buy is read at run time (`guestCheckout` in `lib/storefront.js`): a visitor's `GET /commerce/products` refused `feature_off` means the platform's `store` flag is off for guests (every good is ordered by email); a guest cart of a live digital good checked out without an email answers `email_required` where downloads sell to guests and `account_required` where they do not. The storefront is written from the answer and its checkout falls back to email on either refusal. Any other kind is ordered by email. No payment key is ever pasted. The co-founder adds a product as a product file (`products/<product>.product.tsx` with `slug="<business>-<product>"`, which the Drive indexes as a draft good; its charter and `PLAYBOOK.md` say how, `lib/business.js` `productsRule`) and an entry in `products/products.json` (the storefront's catalogue: every product, goods and the kinds ordered by email) naming that `file`; the Products tab links the entry to its good (`GET /goods`, by `file`) and publishes the storefront. |
| ads | `ads/campaign.json` (the plan: its `daily` is the cap the API holds every campaign to) + `GET /integrations`. Launch is 'Soon' unless `meta-ads` answers `configured: true` (the owner turns it on by enabling CommandAGI's service account `meta/vibestartup-ads`). Then: Connect is `POST /integrations/meta-ads/oauth/start { redirectUri: <origin>/app/connected/ }` in a popup, `app/connected/` posts the code and state back to this origin, and the tab checks the state and calls `POST /integrations/oauth/exchange`; `GET /meta-ads/accounts` and `PUT /meta-ads/target` choose the ad account and the Page; Launch is `POST /meta-ads/campaigns { dailyBudgetCents, plan, image: studio/<file>, link, caption }` (everything PAUSED); Approve is `POST /meta-ads/campaigns/:id/approve` then `…/status { ACTIVE }`; pause, delete, insights are `…/status`, `…/insights`; Disconnect is `DELETE /connections/:id`. The co-founder's tools are `meta_ads_*` and it cannot approve its own spend (CommandAGI `docs/meta-ads.md`). Readiness is computed from real state |
| studio | `POST /generate?owner=org&ownerScope=<org> { modelId, inputs, name: "studio/<file>" }` → a Drive file (the route keeps a name's folders; it has no `path` field). Pictures: `text-to-image.flux-schnell`. Video: `image-to-video.kling` (§ studio video). Brand book from `brand/` |
| outbound | leads file + sequence drafts; a send is `POST /email/addresses/:id/compose` after the founder approves |
| social | `GET /integrations` (connectors with a social category), `POST /integrations/:id/oauth/start { redirectUri }`, `POST /integrations/:id/call`; otherwise "post by hand" with the prepared caption and image |
| legal | formation proposed at traction (3 real sales or $100), computed from `orders.jsonl` (test orders excluded); the storefront's terms, privacy and refunds pages: the business's own `legal/*.html` when it has them ("Use on my storefront" below writes them), else defaults (`lib/storefront.js`). Documents: nine starter templates (`lib/legal-docs.js`: terms, privacy, refunds, freelancer agreement, mutual NDA, co-founder agreement, single-member LLC operating agreement, invoice, formation checklist) filled from `business.json` and the founder's fields, set as a PDF in the browser by `lib/pdf.js` (no dependency: standard Helvetica, the brand's colour and mark) and written with `POST /drive/upload` into `legal/`. Templates, not legal advice: the tab says so once, beside the buttons |
| members | the org's: `GET /orgs/:id/members`, `POST /orgs/:id/invites { email, role: viewer \| member \| admin }`, `GET`/`DELETE /orgs/:id/invites/:invite`, `DELETE /orgs/:id/members/:user` |
| activity | `GET /threads/:id/events?limit=` newest first |
| billing | `GET /me/credits`, `GET /me/credits/history`, `GET /me/subscription`; a credit pack: `POST /billing/checkout { type: "pack", packId, origin, returnPath }` (`checkout` in `lib/api.js`: a stack that refuses the origin, `origin_not_registered` or `origin_mismatch`, gets the call again without it) |
| hiring a listing | below, § hiring |
| profile | `GET /me`, `GET /users/:id`, `POST /me/profile { name }`, `GET/POST /me/notification-prefs`, `POST /me/erase { confirm: true }` (the platform revokes the sign-ins before it erases the Drive, so an erase that fails late ends the session: the page asks for the password, signs in again and finishes it) |
| share & earn | the link is `${BRAND.home}/?ref=<code>` (`GET /me/referrals` → `code`, the account's handle or id). Any page opened from it keeps `ref` in `localStorage` (`vs_ref`, `lib/api.js`); the sign-up sends it as `ref` on `POST /oauth/signup`, and when the answer has no `referral` the page names it at `POST /me/referrer { ref, client }` (right after the sign-up and again on `/start/`, within the day the platform allows). The platform grants both accounts the credit when the friend proves their login email (`POST /me/emails/:id/verify` and `…/confirm`; CommandAGI's `docs/billing.md` § referrals). The Share page shows the rule, the friends who joined, the credits earned and this month's count against the cap; a referred founder gets "Confirm my email". Where `GET /me/referrals` answers 404 (an API without referrals) the reward shows a "Soon" pill and promises nothing |
| admin | for an owner or admin of `org-vibestartup` only (CommandAGI `docs/brands.md` § a brand's admins): `GET /me/brands` names `vibestartup`, and the account menu shows Admin (`app/tabs/admin.js`, `#page=admin`). `GET /brands/vibestartup/admin` gives the totals, the daily series (founders joined, businesses built, first sales), the free-credit plan in force and the watch list (a business's `gaps`, a co-founder that did not answer, a storefront not live); `GET /brands/vibestartup/admin/founders?before=` pages the founders with their businesses and storefront links. An API without the doors answers 404: the page says the view comes with the next release and shows nothing else |
| delete a business | the triggers deleted, `DELETE /sites/:id`, then `DELETE /orgs/:id` (its Drive with it); the chats are left (a run is a record). Erasing the founder erases the businesses they founded and hold alone |

Every request is the founder's own: the API's authority, key scopes, audit and billing run unchanged. Nothing here
acts for anyone but the signed-in founder, and the app holds no credential of its own.

## the wizard's suggestions

The wizard's names, tagline, ranked blueprints (each with a reason), first product, and the storefront's layout and
look come from one model call on the founder's idea: `POST /models/call` with `jsonSchema` (CommandAGI
`docs/agents.md` § a host's model call), on the founder's own token (`lib/suggest.js`). No code here reads the idea's
words: CommandAGI's rule is that free text goes to a model (AGENTS.md). The call waits for a 0.9 s pause in typing,
or for Continue, and goes once per idea; the blueprint and name steps show a skeleton until it answers.

- **The model**: Claude Haiku 5.5 at low effort (`SUGGEST_MODEL`). Production, 2026-11-12, the full schema: 1.9 to
  2.3 s on the model, 2.4 to 3.1 s from the caller. GPT-6 Luna took 4.4 to 5.7 s; GLM-5.3 Flash and Qwen 3.8 Flash
  took 7 to 20 s or answered off-schema.
- **Who pays**: the founder, like every call of theirs. The account's free `ai` allowance covers it first (one whole
  credit per call; the free plan has 30 a month), then the founder's credits. CommandAGI has no separate sign-up
  budget for a brand's model calls.
- **When it fails** (refused, no credits, an error, an answer off the schema, or no answer in 6 s): every blueprint in
  a fixed order (digital, booking, preorder, waitlist, demo) with none marked, no names (the founder types one), an
  empty tagline the founder is asked for, and the storefront from the blueprint, the products' kinds and the vibe
  (`lib/storefront-design.js` `defaultStorefront`). `test/suggest.mjs` holds this path to reading nothing from the idea.
- **The storefront**: the model's layout goes to `business.json` `storefrontPick` when the founder keeps its first
  blueprint, its look always; the first `storefront.json` starts from it. On day 1 the co-founder checks that the pair
  fits the idea and proposes a change in the storefront card (`openingFor`).
- **The landing**: a visitor has no account, so the sketch under the idea box shows the idea in their words and the
  shape of what they get, with nothing read from the words.

## studio video

CommandAGI's generate catalog has one video model today: `image-to-video.kling` (Kling v2 master on fal, inputs
`image_url` and `prompt`). It takes a still and a direction and gives a 5-second clip; the clip's shape is the still's.
The route answers in one held request (the worker polls fal for up to 280 s). The rest is done in the founder's
browser (`app/tabs/_video.js`):

| format | how |
|---|---|
| clip | a still from the Studio library or the business's files, cropped to 9:16, 1:1 or 16:9, or a first frame made from the description (`text-to-image.flux-schnell` at that shape) → one Kling clip, `studio/<id>.mp4` |
| short | the same clip (9:16 or 1:1) → the caption drawn over the lower third of every frame on a canvas and recorded (MediaRecorder) → `studio/<id>.mp4` (or `.webm` where the browser records only WebM); the clip without the caption is kept beside it as `<id>-part-1.mp4` |
| film | 4 to 6 of the founder's photos → one Kling clip each, two at a time → the clips played one after another onto a canvas and recorded, with the business's name as the last frame → `studio/<id>.mp4` (20 to 30 s) |
| presenter | not built: the catalog has no talking-head or lip-sync model (the `lipsync` task has no model row), so it stays "not yet" |

The credits shown before a render are the catalog's price (`GENERATION_PRICES`: Kling v2 $0.28 a second, five at
least, so 140 credits a clip; a FLUX first frame under 1 credit). After it, the page shows what the balance actually
moved (`GET /me/credits` before and after). CommandAGI does not charge generations to any purse yet
(`docs/billing.md` § a contract's cost ceiling), so that is 0 until it does. Checked on production on 2026-11-11
(`test/studio-video.mjs`): a short from a description was ready in 171 s, 1080×1920 and 5.07 s, with the caption burned in;
the balance stayed at 200. Two clips were stitched into a 1080×1920 MP4 in the page.

A render is a job, written to `studio/jobs/<id>.json` before anything is sent and after every step. It runs in the
page: a tab switch keeps it (the module stays loaded), and the job's card shows its step and the time since it started.
A reload ends the held request. The page then waits for the clip it asked for, by its name in `studio/`, until 7 minutes
after it was sent, and finishes the caption or the film when it comes. Otherwise it marks the job `interrupted`. A paid
step is sent again only when the founder presses Try again. The caption and the stitch play in real time, so the
founder is asked to keep the tab in front for those seconds.

What a small API change would add (not made here): `duration` (`"5" | "10"`) as a declared input of
`image-to-video.kling` in `packages/domain/core/src/genmodels.ts` (fal's endpoint takes it; `mappedInputs` drops an
undeclared input today, and `generationQuote` already prices `inputs.duration`), for 10-second shorts and clips; and a job form of `POST /generate` (submit, then
`GET /generate/jobs/:id`, as `data/maker.ts` already does for its pictures), so a render survives the page.

## hiring

VibeStartup sells three listings of the org `org-vibestartup`, backed by its agent `agent-vibestartup-cofounder`
(CommandAGI `docs/organization.md` § VibeStartup: prices, providers and launch): `listing-vibestartup-cofounder`
(3,900 credits, $39), `-growth` and `-studio` (2,900 credits, $29), each one 30-day contract whose work stops at a cost
ceiling of 2,400, 1,800 and 1,800 credits. Billing (`app/tabs/billing.js`, `services` in `lib/api.js`) hires one:

| step | CommandAGI |
|---|---|
| is it open, at what price | `GET /listings/:id`: an open listing answers with `status: "active"`, its `plan` (credits) and `costCeilingMilli`. A draft answers 404 to a founder, and the card shows the declared price, a disabled Hire button, a Soon pill and "opens December 8". The page reads the listing's status, not the date: the listings open when `POST /admin/console/seed/vibestartup/launch` activates them on that stack |
| the confirm sheet | what you get, the price in credits and dollars, the 30-day term, the ceiling, that nothing renews by itself, the founder's credits. Short of credits, it offers the pack that covers the price (the checkout returns to Billing) |
| hire | `POST /services/contracts { listingId, customerThreadId, title, brief, deadline }` then `POST /services/contracts/:id/sign`. `customerThreadId` is the business's co-founder thread (`business.json` `cofounder.threadId`): the contract is proposed from it, the provider is invited into a coordination room beside it (never into it), and the brief names the business and its folder. `deadline` is the end of the 30 days |
| VibeStartup signs | the platform wakes the provider agent to sign (`sign_contract`). When both have signed, escrow holds the price on the founder's credits (`402 insufficient_credits` when they do not cover it: the row says so and offers Sign again) and the provider's private work thread starts |
| the contract | `GET /me/contracts`, the ones of the three listings: status, days left (to `deadline`), the ceiling (`costCeilingCredits`) and `ceilingReachedAt`; credits used when the contract carries `spentCredits` (not yet: see `docs/HANDOFF.md`). The page looks again every 10 s for 2 minutes while VibeStartup has not signed |
| cancel, renew, accept, dispute | `POST /services/contracts/:id/cancel` (only while proposed: nothing is held), Renew opens the sheet for the next contract, `…/accept` when delivered (releases the escrow), `…/dispute { reason }` while active or delivered |

The contract's work is what is spent in the provider's work thread (`contracts.provider_thread_id`; keys minted there
carry `api_keys.work_thread_id`, CommandAGI `docs/billing.md` § a contract's cost ceiling). That thread is
VibeStartup's, private to it. The business's co-founder thread is the founder's own and still draws on the founder's
credits; `docs/HANDOFF.md` says what the platform lacks to make the business thread's work the contract's.

`node test/hire.mjs --api <origin>` runs the hire from a blank account (`VS_ADMIN_KEY`, a staff key of that stack,
grants the credits); before the launch it checks the disabled state instead.

## honesty rules the pages keep

1. A number is what the API measured. A test order is marked `test` everywhere and never counts as a sale.
2. A feature that needs a provider the founder has not connected says so where it stops, and records nothing as sent.
3. A secret's value is never shown again after it is set.
4. The co-founder is an AI agent and says so. When the model gives no answer, the page says so.
5. The prices are the listings' (`app/tabs/billing.js`); the landing's plans show the same ones.
6. A reward is shown only where the API grants it: the Share page reads the rule from `GET /me/referrals`, and says "Soon" where the API has none.

## files of this repository

| file | what |
|---|---|
| `app.mjs` | the server module: `/brand.js` and the static files (nothing else) |
| `index.html`, `landing.css`, `landing.js` | the landing |
| `start/` | the new-business wizard (idea → blueprint → name → look → voice → partner → co-founder → updates) |
| `home/` | the account's businesses, a new business, the account |
| `auth/` | sign in and create account |
| `app/` | the console (`console.js`, one file per tab in `app/tabs/`, `console.css`) |
| `lib/api.js` | the CommandAGI client: token, refresh, REST, MCP, drive, threads, tasks, sites, email |
| `lib/business.js` | the business record, its creation sequence and the co-founder's charter |
| `lib/widgets.js`, `test/widgets.mjs` | a message's controls and charts as HTML (every string escaped), and their plain-node test |
| `lib/ui.js` | the shared UI: icons, toast, dialog, menu, formatting, the Soon pill |
| `lib/legal-docs.js`, `lib/pdf.js` | the Legal tab's templates (as blocks, and as HTML), and the PDF writer that sets them |
| `lib/guides.js` | the first-run guides (docs/DESIGN.md § guides) |
| `style.css` | the tokens and base components every page shares |
| `lib/storefront.js` | the storefront files VibeStartup writes into a business's site folder, and the publish |
| `lib/storefront-design.js` | the storefront's templates and styles, the default for a business, the palette (pure) |
| `test/local.mjs`, `test/journey.mjs`, `test/browser.mjs` | the local run (static files + a local CommandAGI platform) and the journey |
| `test/studio-video.mjs` | a real short video from a fresh account (one paid Kling clip), the tab left and the page reloaded, the library's player, the film's stitch; the account erased |
| `test/hire.mjs` | hiring the co-founder from a blank account (§ hiring) |
