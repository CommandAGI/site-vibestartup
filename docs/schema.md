# VibeStartup's schema: a business is an org of CommandAGI

Owner, 2026-11-11: "can we just make it all a wrapper around commandagi? a user-* for each vibestartup.pro user and an
org-* for each vibestartup.pro business? with like BUSINESS.md and other files in the file system and keeping the
filesystem organized within a clearly organized schema such that even tho 'everything is a file' the vibestartup users
just see it thru a simple, organized, crisp lens that the vibestartup.pro app surfaces to them".

This file is the schema. Step 1 (the platform) is done; step 2 (the app moves to it) is the plan at the end. Until
step 2 lands, the app still keeps a business in the founder's Drive at `Businesses/<slug>/` (`docs/ARCHITECTURE.md`).

## the two accounts

| account | what it is | what it holds |
| --- | --- | --- |
| the founder: a CommandAGI **user** account (`user` in the token) | one per person who signs in at vibestartup.pro | the sign-in and the brand's grant, the profile and date of birth, the credits (free and bought), referrals, the founder's own connected accounts (Gmail, a social account) and model floor |
| a business: a CommandAGI **org** account | one per business, founded by the founder with the brand's token (`POST /accounts { name }`) | everything of the business: its Drive (below), its co-founder agent and threads, its site, its mail, its goods and orders, its payouts |

- **Ownership.** The founder's account owns the org and is its `owner` member. The org records its founder
  (`orgs.founded_by`) and its brand (`orgs.brand = "vibestartup"`) once, at its creation (CommandAGI migration 0765).
  The owner can change later; the founder and the brand do not.
- **The founder's businesses** are `GET /me/orgs?brand=vibestartup`. The console's switcher lists them, and
  `?b=<org id>` opens one.
- **People.** A person the founder invites is a member of the org (`POST /orgs/:id/invites`, `member` or `viewer`); an
  admin seat is `POST /orgs/:id/members`. Folder shares are not used for members.
- **The co-founder** is one agent made in the org (`POST /agents/<base>/fork { ownerScope: <org id>, name, instructions
  }`). Its charter is its instructions, so every chat starts with it and shares the prompt cache. Its `agent.tsx` is in
  the org's Drive. It acts with its founder's authority, which reaches the org as its owner, so it needs no seat. The
  org's members operate it (seat it, start chats on it); only the founder manages it.
- **Chats.** Many threads, each of the record (`POST /threads { ownerScope, fromAgentId, about: <business.json
  address> }`), listed newest activity first by `GET /me/threads?of=<business.json address>`. The daily briefing is a
  trigger on one pinned thread (`business.json` `routines.briefing`).
- **Who pays.** A thread of the org is billed to the org's owner, the founder: the founder's credits pay for the
  business, the free ones first, so the revenue-funded free credits keep working. The org's own purse is not used yet
  (CommandAGI `docs/next/vibestartup-what-is-left…md` § a business as an org).
- **Who sells.** The org is the seller of the goods in its Drive (`acct:org:<id>`). Its owner onboards it to Stripe
  Connect Express (`POST /connect/onboard` with `x-cagi-account: acct:org:<id>`). The legal seller is the founder's
  business: the founder as a sole proprietor until they form a company, then the company (`legal/<Name>.company.tsx`
  says which). The platform sends Stripe `business_type: company` for every org today; a sole proprietor's type is a
  CommandAGI gap.
- **Mail.** The org's own address, `<slug>@commandagi.email` (`POST /orgs/:id/email-addresses`, up to 25 an org), so
  each business has one and the founder keeps their personal one. Every member reads it.
- **A business is not a company.** An org is a shared account (the founder, the co-founder, the people the founder
  invites), which is what CommandAGI's orgs are for (`docs/intentions.md` § companies: "organisation accounts are only
  for sharing accounts"). Its legal entity, when it has one, is an optional `.company.tsx` in its `legal/` folder.
- **Erasing the founder** erases the businesses they founded and hold alone, and refuses (409 `orgs_held`) while a
  business has another member, until the founder transfers or deletes it.

## the org's Drive

The root of the org's Drive is the business. Formats are CommandAGI's where one exists. "Writes" is who changes the
file: **founder** (through the console), **co-founder** (its tools), **console** (the app's code), **platform**
(CommandAGI's routes).

```
BUSINESS.md                  the overview and goals                                    founder, co-founder
SOUL.md                      the co-founder's personality and voice                    console (from the wizard), founder
OWNER.md                     the founder's profile and preferences                     co-founder, founder
PLAYBOOK.md                  how this business works: launch week, approvals, routines console (seed), co-founder
MEMORY.md                    the short page the co-founder reads each turn: dated lines co-founder
SUPPORT.md                   how customers are answered: the address, refunds, tone    console (seed), founder, co-founder
business.json                the console's record: ids and state (below)               console
storefront.json              the storefront's template, style and words               console, co-founder
.commandagi/settings.json    the business's settings (CommandAGI's one settings model) console
agents/<name>/agent.tsx      the co-founder agent; its instructions are the charter    platform (the fork, PATCH /agents)
brand/brand-book.json        colours, type, voice (made by a script; labelled so)      console
brand/logo.svg               the mark                                                  console, founder
products/<slug>.product.tsx  one good each, the source of truth of the catalogue       co-founder, console
products/images/             pictures of products                                      founder, co-founder
products/files/              the files digital products sell                           founder
contacts/<email>.vcf         one customer or sign-up each (vCard 3.0)                  platform (storefront sign-ups), console, co-founder
leads/leads.csv              the founder's uploaded leads                              founder
outbound/<campaign>/         a campaign's drafts and per-lead status                   co-founder, console
ads/campaign.json            the one ad campaign's plan, readiness and decisions       console, co-founder
social/posts.json            composed posts, scheduled or posted by hand               console, co-founder
studio/                      everything the Studio made                                platform (POST /generate), console
studio/jobs/<id>.json        one video render: spec, step, clips, credits              console
legal/terms.html privacy.html refunds.html   the storefront's own pages (they replace the defaults)  console (Legal tab)
legal/<template>.pdf         a document saved from the Legal tab                       console
legal/fields.json            the values the founder typed that differ from the record  console
legal/<Name>.company.tsx     optional: the legal entity, once formed                   founder, co-founder
orders/orders.jsonl          orders recorded outside the checkout, one a line          console, co-founder
Tasks/<title>.task.tsx       approvals and work (`taskKey` per day and step)          co-founder, console, founder
Sites/<name>/                the storefront site's folder: generated, never edited     console (publish), platform
runs/                        the threads' runs                                         platform
```

- **Names.** The co-founder's files are at the root, in capitals: `BUSINESS.md`, `SOUL.md`, `OWNER.md`,
  `PLAYBOOK.md`, `MEMORY.md`, `SUPPORT.md`. The code map is **CODEMAP.md** (one word), not CODE_MAP.md.
- **Kept once, not in each Drive.** `PLATFORM.md` (what CommandAGI gives the business) and `CODEMAP.md` (where each
  thing is, from this schema) are the same for every business. They live in this repository at `docs/cofounder/` and
  are sections of the charter, built by `lib/schema.js`; a business holds no copy. A business's own facts are in its
  files above.
- **MEMORY.md** is the short page, under 2 KB, that the co-founder reads at the start of work. Longer memory is the
  platform's (`memory_remember`, `memory_search`).
- **The catalogue** is the product files. `products/products.json` is gone: the storefront reads the goods
  (`GET /goods` with `x-cagi-account: acct:org:<id>`, `images` on each `<product>`).
- **Customers** are contacts, `contacts/<email>.vcf`: `CATEGORIES:customer` or `CATEGORIES:signup`, the consent in
  `NOTE` (the words agreed to, when, on which page). `customers/customers.json` is gone.
- **Settings** are `.commandagi/settings.json` at the org's root, keys `vibestartup.autopilot` (boolean) and
  `vibestartup.briefing` (`daily`, `weekly` or `off`). The business's own `settings.json` and its `members` list are
  gone: members are the org's.
- **business.json** holds only what no other file or platform record says: `{ slug, idea, tagline, blueprint, vibe,
  voice, partner, cofounder: { name, agentId, model }, site: { id }, email: { id, address }, routines: { briefing,
  briefingThread }, launchWeek: { startedAt }, gaps: [] }`. The name is the org's; the site's addresses are the site's.
  CommandAGI's brand admin reads its `name`, `site.id` and `gaps` (`oauth_clients.brand_record`'s file name at the org
  Drive's root).
- **A file not in this schema** is the founder's own. The lint (`lib/schema.js`) lists such files in a task once a
  week and never refuses a write.

## the lens: what the console shows

The founder never sees a path, an id, `.commandagi/`, `agents/`, `runs/` or `Sites/`. Each tab reads and writes a fixed
set of paths, held in code in `lib/schema.js` (not in the Drive). Files and Settings have one "Open in CommandAGI" link.

| tab | reads | writes |
| --- | --- | --- |
| Chat | the threads of `business.json` (`GET /me/threads?of=`), `MEMORY.md` | a new thread, messages |
| Dashboard | `business.json`, goods, orders, `Tasks/`, `studio/` | — |
| Analytics | the site's analytics (`GET /sites/:id/analytics`) | — |
| Tasks | `Tasks/` (`GET /me/tasks?owner=org&ownerScope=`) | `Tasks/` (approve, decline) |
| Email | the org's mailboxes | sent mail |
| Files | the org's Drive, the lens's folders only | uploads |
| Products | `products/*.product.tsx`, the goods | `products/`, `products/images/`, `products/files/` |
| Storefront | `storefront.json`, `brand/` | `storefront.json`, then a publish into `Sites/<name>/` |
| Orders | `GET /goods/orders` as the org, `orders/orders.jsonl` | — |
| Customers | `contacts/` | `contacts/` (storefront sign-ups) |
| Ads | `ads/campaign.json`, `studio/` | `ads/campaign.json` |
| Studio | `brand/brand-book.json`, `studio/` | `studio/` |
| Outbound | `leads/`, `outbound/` | `outbound/` |
| Social | `social/posts.json` | `social/posts.json` |
| Legal | `legal/`, `brand/`, `business.json` | `legal/` |
| Settings | `.commandagi/settings.json`, the org's members and invites, `SOUL.md` | the same |
| Activity | the org's audit and the threads' events | — |
| Billing, Profile, Share & earn | the founder's account (credits, profile, referrals) | the founder's account |
| Admin | `GET /brands/vibestartup/admin` (admins of `org-vibestartup` only) | — |

## step 2: the app moves to the schema (the plan)

Not run yet: other sessions are editing `lib/business.js`, `app/tabs/chat.js`, `app/console.js` and `lib/storefront.js`.
No compatibility layer: one way, the org. About 900 changed lines in 25 files, in seven commits, then one script run.

**Platform first (CommandAGI, one commit).** The task tools take `account` (`task_create`, `task_list`, `task_get`,
`task_update`; CommandAGI `docs/next/vibestartup-what-is-left…md` § a business as an org), so the co-founder makes its
approvals in the org. Until it lands the co-founder writes `Tasks/<title>.task.tsx` with `write_drive_file { account }`,
and the console makes the day-one cards itself.

1. **The seam (one small commit, before anything moves).** `lib/schema.js`, new (about 150 lines): `PATHS` (every path
   above, by name), `FILES` (each file's writer and format), `TABS` (the lens table), `charterMap()` (the CODEMAP
   section of the charter), `lint(listing)`. `lib/api.js`: every Drive call takes the business's account
   (`drive.forAccount(acct)`: `owner=org&ownerScope=<org id>` on `/drive*`, `/accounts/<acct>/files/<path>` for reads by
   path); `orgs.list()` = `GET /me/orgs?brand=vibestartup`, `orgs.create(name)` = `POST /accounts`, `orgs.invite`,
   `orgs.members`; `email.claimForOrg(org, local)` = `POST /orgs/:id/email-addresses`; `goods.orders(acct)` and
   `payments.*` send `x-cagi-account`; `tasks.*` take `{ owner: 'org', ownerScope }`. `lib/business.js`: `folderOf`,
   `addressOf` and `readBizJson`/`writeBizJson` go through `schema.PATHS` and the account. No behaviour changes in this
   commit.
2. **Creating a business makes an org** (`lib/business.js createBusiness`, about 120 lines changed): `orgs.create(name)`;
   the files of the schema at its root (the six Markdown files, `business.json`, `storefront.json`,
   `.commandagi/settings.json`, `brand/`); the site with `POST /sites { name, slug, ownerScope }`; the address with
   `email.claimForOrg`; the co-founder with `POST /agents/<base>/fork { ownerScope, name, instructions: charter }`
   (no thread `systemPrompt`); the thread with `POST /threads { ownerScope, fromAgentId, about, greeting }`; the
   briefing trigger on it. `memoryFiles` loses `PLATFORM.md` and `CODEMAP.md` (into the charter from
   `docs/cofounder/`). `listBusinesses` = `orgs.list()` and each org's `business.json`; `readBusiness(orgId)`;
   `deleteBusiness` removes the site and the triggers, then `DELETE /orgs/:id`.
3. **The console switches by org** (`app/console.js`, about 40 lines): `?b=<org id>`; the switcher lists
   `listBusinesses()`; a founder with no org of the brand goes to `start/`.
4. **Every tab reads from the org** (`app/tabs/*.js` and `_shared.js`, about 350 lines): the paths of the lens table;
   Products writes only `.product.tsx` (no `products.json`); Customers reads and writes `contacts/*.vcf`; Settings
   writes `.commandagi/settings.json` and manages the org's members and invites instead of folder shares; Chat lists the
   record's threads with `GET /me/threads?of=` and opens a new one with the same launch.
5. **The storefront reads the goods** (`lib/storefront.js`, about 80 lines): products from `GET /goods` as the org, images
   from each product's `images`, sign-ups into `contacts/`, the publish into the site's own folder (`site.folder`).
6. **The charter** (`charterFor`, `productsRule`, `storefrontRule`, about 60 lines): paths from `schema.PATHS`, the
   Drive tools with `account: "acct:org:<id>"`, the code map from `schema.charterMap()`.
7. **Tests** (`test/local.mjs`, `test/journey.mjs`, `test/storefront.mjs`, about 100 lines): a journey from a blank
   sign-up that makes a business through the wizard and checks the org's Drive against `schema.lint` (no stray file),
   the switcher with two businesses, and another account refused at the org.

**The one-time move** (`scripts/move-to-org.mjs`, about 200 lines; run once, with the owner's VibeStartup token, for
the owner's business "DigitalProduct", account `7d29cf3e-5808-4eb6-a522-0c38171689cd`). Dry run first, then `--apply`;
each step is idempotent and writes what it did into a report beside the script's run.

1. Read `Businesses/<slug>/business.json` and the whole folder listing; stop if anything is unreadable.
2. `POST /accounts { name }` with the founder's VibeStartup token (so `orgs.brand` is `vibestartup`); keep the org id in
   the report, and reuse it on a rerun.
3. Copy every file of `Businesses/<slug>/` to its schema path in the org's Drive, byte for byte (`cofounder/*.md` to the
   root, `settings.json` into `.commandagi/settings.json`'s keys, `customers/customers.json` into `contacts/<email>.vcf`
   with each consent kept, `products/products.json` into each product's `images`); compare each file's size and hash
   after the copy.
4. The products: the `.product.tsx` files move with step 3, so the goods are reindexed under `acct:org:<id>`
   (`POST /goods/reindex` with `x-cagi-account`); the orders already paid keep their seller account, and the Orders tab
   reads both accounts' orders for this business.
5. The site keeps its slug, its addresses, its deployments and its analytics: it stays in the founder's Drive
   (`Sites/<name>`), named by `business.json` `site.id`, until CommandAGI has a site transfer (`POST /sites/:id/transfer`,
   CommandAGI `docs/next/…` § a business as an org). The publish writes into `site.folder`, wherever it is.
6. The co-founder: fork its agent into the org (`ownerScope`), with today's charter. The thread history stays in the
   existing thread, whose run is of the founder's `business.json`: its id goes into the new `business.json`
   (`routines.briefingThread`), the Chat tab lists it beside the org's threads, and its triggers stay on it.
7. The mail address: the founder's personal address stays theirs; the org claims `<slug>@commandagi.email` and the
   storefront and `SUPPORT.md` name it.
8. Stripe: the founder's payouts stay connected to the founder. The org onboards its own Connect account; the founder
   finishes Stripe's form (the one step that needs them), and until then the console keeps the goods in draft.
9. Write the new `business.json`, then move `Businesses/<slug>/` to the Trash (not deleted), and record the move in the
   org's `MEMORY.md`.

Its acceptance: the console opens the business from the switcher with every tab showing what it showed before, the
storefront at `digitalproduct.vibestartup.pro` answers as before, the old thread's messages show in Chat, and the brand
admin view lists one business for the founder.
