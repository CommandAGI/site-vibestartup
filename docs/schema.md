# VibeStartup's schema: a business is an org of CommandAGI

Owner, 2026-11-11: "can we just make it all a wrapper around commandagi? a user-* for each vibestartup.pro user and an
org-* for each vibestartup.pro business? with like BUSINESS.md and other files in the file system and keeping the
filesystem organized within a clearly organized schema such that even tho 'everything is a file' the vibestartup users
just see it thru a simple, organized, crisp lens that the vibestartup.pro app surfaces to them".

This file is the schema. Step 1 (the platform, CommandAGI 1b260438ddc) and step 2 (the app moves to it, 2026-11-12)
are done: every business is an org, the console reads it through `lib/schema.js`, and the owner's DigitalProduct moved
(§ the one-time move). Nothing reads `Businesses/<slug>/` any more.

## the two accounts

| account | what it is | what it holds |
| --- | --- | --- |
| the founder: a CommandAGI **user** account (`user` in the token) | one per person who signs in at vibestartup.pro | the sign-in and the brand's grant, the profile and date of birth, the credits (free and bought), referrals, the founder's own connected accounts (Gmail, a social account) and model floor |
| a business: a CommandAGI **org** account | one per business, founded by the founder with the brand's token (`POST /accounts { name }`) | everything of the business: its Drive (below), its co-founder agent and threads, its site, its mail, its goods and orders, its payouts |

- **Ownership.** The founder's account owns the org and is its `owner` member. The org records its founder
  (`orgs.founded_by`) and its brand (`orgs.brand = "vibestartup"`) once, at its creation (CommandAGI migration 0765).
  The owner can change later; the founder and the brand do not.
- **The founder's businesses** are `GET /me/orgs?brand=vibestartup`. The console's switcher lists them, and
  `?b=<slug>` opens `org-<slug>`. The org's handle is the storefront's slug: the site is made first (a slug another
  site holds gets a suffix), the org takes the same handle, and the site moves into it before anything is in it
  (`POST /sites/:id/transfer`).
- **People.** A person the founder invites is a member of the org (`POST /orgs/:id/invites`, `viewer`, `member` or
  `admin`; Settings → Members). Folder shares are not used for members.
- **The co-founder** is one agent made in the org (`POST /agents/<base>/fork { ownerScope: <org id>, name, instructions
  }`). Its charter is its instructions, so every chat starts with it and shares the prompt cache. Its `agent.tsx` is in
  the org's Drive. It acts with its founder's authority, which reaches the org as its owner, so it needs no seat. The
  org's members operate it (seat it, start chats on it); only the founder manages it.
- **Chats.** Many threads, each of the record (`POST /threads { ownerScope, fromAgentId, about: <business.json
  address> }`), listed newest activity first by `GET /me/threads?of=<business.json address>`. The daily briefing is a
  trigger on the first chat (`business.json` `cofounder.threadId`, `routines.briefing`). A business moved from a
  founder's folder lists its chat from before the move too (`cofounder.earlier`): a run cannot change hands, so that
  chat stays the founder's thread.
- **Who pays.** A thread of the org is billed to the org's owner, the founder (CommandAGI `Access.billingTarget`). A
  model call draws the founder's free `ai` allowance first (the free plan's 30 credits each 8 hours, `GET /quota`),
  then the free credits earned at sign-up and at the milestones (`GET /me/free-credits`), then the bought credits. The
  allowance's part is no ledger row, so Billing shows the allowance and each co-founder's calls (`GET /agents/:id/cost`)
  beside the ledger. Each call settles as it ends (CommandAGI 3bd4e4ec2ef; before, a chat-only thread's spend waited for
  an alarm that never came). Past the allowance and the credits, CommandAGI refuses the call, and Chat shows a notice
  with the way to Billing. The org's own purse is not used yet.
- **Who sells.** The org is the seller of the goods in its Drive (`acct:org:<id>`). Its owner onboards it to Stripe
  Connect Express (`POST /connect/onboard` with `x-cagi-account: acct:org:<id>`). The legal seller is the founder's
  business: the founder as a sole proprietor until they form a company, then the company (`legal/<Name>.company.tsx`
  says which). The platform sends Stripe `business_type: company` for every org today; a sole proprietor's type is a
  CommandAGI gap.
- **Mail.** The org's own address, `<slug>@commandagi.email` (`POST /orgs/:id/email-addresses`, up to 25 an org), so
  each business has one and the founder keeps their personal one. Every member reads it. A business moved from a
  founder's folder keeps the founder's address (`digitalproduct@commandagi.email` is the owner's): CommandAGI moves no
  address to an org yet (its `docs/next`, "An address cannot move to an org"), so the record says so in `gaps`.
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
products/products.json       the storefront's catalogue: every product, its words and pictures  console, co-founder
products/<id>.product.tsx    one good each: what the checkout sells                    co-founder, console
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
Trash/                       what was removed                                          platform
```

- **Names.** The co-founder's files are at the root, in capitals: `BUSINESS.md`, `SOUL.md`, `OWNER.md`,
  `PLAYBOOK.md`, `MEMORY.md`, `SUPPORT.md`. The code map is **CODEMAP.md** (one word), not CODE_MAP.md.
- **Kept once, not in each Drive.** The platform's part (what CommandAGI gives the business) and the code map (where
  each thing is, from this schema) are the same for every business: `PLATFORM` and `charterMap()` in `lib/schema.js`,
  sections of the charter (`charterFor`, `lib/business.js`), which is the co-founder agent's instructions. A business
  holds no `PLATFORM.md` or `CODEMAP.md`. A business's own facts are in its files above.
- **MEMORY.md** is the short page, under 2 KB, that the co-founder reads at the start of work. Longer memory is the
  platform's (`memory_remember`, `memory_search`).
- **The catalogue** is `products/products.json`, and each good is its product file. The plan was to drop
  `products.json` for the goods; the code proved it wrong: a product file is a `physical` or `digital` good only, and
  the console sells services, subscriptions and courses by email too, so the storefront's catalogue stays one file
  that names each good's `file`. The Products tab writes a good as `products/<id>.product.tsx` (slug
  `<business>-<id>`: a product's slug and SKU are unique on the whole platform), the Drive indexes it as a good of the
  org, and the tab links the entry to it (`GET /goods` with `x-cagi-account: acct:org:<id>`). Paths in the catalogue
  (`file`, `images[].path`) are from the org's root.
- **Customers** are contacts, `contacts/<email>.vcf`: `CATEGORIES:customer` or `CATEGORIES:signup`, the consent in
  `NOTE` (the words agreed to, when, on which page). `customers/customers.json` is gone.
- **Settings** are `.commandagi/settings.json` at the org's root, keys `vibestartup.autopilot` (boolean),
  `vibestartup.briefing` (`daily`, `weekly` or `off`), `vibestartup.notify` (the "Notify me" chips) and
  `vibestartup.creativeBudget`; every other key of the file is kept. The business's own `settings.json` and its `members` list are
  gone: members are the org's.
- **business.json** holds only what no other file or platform record says (`RECORD_KEYS`, `lib/schema.js`): `{ slug,
  idea, tagline, blueprint, storefrontPick, vibe, voice, partner, cofounder: { name, agentId, threadId, model, welcome,
  earlier }, site, email: { id, address }, payouts: { account, startedAt }, routines: { briefing }, launchWeek: {
  startedAt }, lint: { at, strays }, gaps: [], createdAt, updatedAt }`. The name is the org's; the brand is
  `brand/brand-book.json`; the settings are `.commandagi/settings.json`. `site` keeps its id and the state the
  storefront's publish needs (its slug, addresses, folder, the storefront's mark, the checkout's answer, the sign-ups'
  storage, the last deploy); the addresses are read again from the site (`syncBrandUrl`).
  CommandAGI's brand admin reads its `name`, `site.id` and `gaps` (`oauth_clients.brand_record`'s file name at the org
  Drive's root).
- **A file not in this schema** is the founder's own. The lint (`lint`, `lib/schema.js`) lists such files in one task
  (`taskKey` `schema.strays`) at most once a week, when the console opens the business (`lintBusiness`), and never
  refuses or moves a file.

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
| Products | `products/products.json`, the goods (as the org), `products/images/`, `studio/`, `brand/` | `products/products.json`, `products/*.product.tsx`, `products/images/`, `products/files/` |
| Storefront | `storefront.json`, `brand/` | `storefront.json`, then a publish into `Sites/<name>/` |
| Orders | `GET /goods/orders` as the org, `orders/orders.jsonl` | — |
| Customers | `contacts/*.vcf`, the storefront's sign-ups | `contacts/*.vcf` (a sign-up, with its consent) |
| Ads | `ads/campaign.json`, `studio/` | `ads/campaign.json` |
| Studio | `brand/brand-book.json`, `studio/` | `studio/` |
| Outbound | `leads/`, `outbound/` | `outbound/` |
| Social | `social/posts.json` | `social/posts.json` |
| Legal | `legal/`, `brand/`, `business.json` | `legal/` |
| Settings | `.commandagi/settings.json`, the org's members and invites, payouts (`POST /connect/refresh` as the org) | the same; the Finish payouts card (`POST /connect/onboard` as the org) |
| Activity | the org's audit and the threads' events | — |
| Billing, Profile, Share & earn | the founder's account (credits, profile, referrals) | the founder's account |
| Admin | `GET /brands/vibestartup/admin` (admins of `org-vibestartup` only) | — |

## step 2: how the app is built on the schema (2026-11-12)

Landed in this repository on 2026-11-12, on CommandAGI production 03e577dded1. No compatibility layer: nothing reads
`Businesses/<slug>/`.

- **The seam.** `lib/schema.js` (the paths, the files and their writers, the lens, the charter's platform part and
  code map, the record's keys, the settings' keys, the lint) and, in `lib/api.js`, a Drive, tasks, goods and payments
  that act for an account: `drive.forAccount(org)`, `tasks.forAccount(org)`, `goods.*(account)`,
  `payments.*(account)`, `orgs.*`. `lib/business.js` gives every tab `bizDrive(biz)`, `bizTasksApi(biz)` and
  `bizAccount(biz)`; no tab names a path of its own outside the schema.
- **Creating a business** (`createBusiness`): `POST /sites { name, slug }` first, then `POST /accounts { name, handle:
  <the site's slug> }` (on 409 `handle_taken`, the `suggestion`, and the record names the difference as a gap), then
  `POST /sites/:id/transfer { ownerScope }` while the site is empty; the schema's files at the org's root; the org's
  address (`POST /orgs/:id/email-addresses`); the storefront's files and deploy; the six Markdown files; the
  co-founder forked into the org with the charter as its instructions; the first chat (`POST /threads { ownerScope,
  fromAgentId, about, greeting }`, no `systemPrompt`) and the opening ask by its replay; the daily briefing on it.
- **The console** opens `?b=<slug>` as `org-<slug>` (`readBusiness`: the record, the brand book, the settings and the
  org's name, read together), lists the switcher with `GET /me/orgs?brand=vibestartup`, lists the chats with `GET
  /me/threads?of=<the org's business.json address>` (and `cofounder.earlier`), and draws the approval cards from the
  org's `Tasks/`. Files shows the lens's folders only; Files and Settings have one "Open in CommandAGI" link
  (`https://commandagi.com/file?path=cloud://home/org-<slug>/`). Settings manages the org's members and invites.
- **Payouts**: the Dashboard, Products and Settings show "Finish payouts" until the business's own Stripe account can
  be paid (`POST /connect/refresh { account }` as the org). Its button makes the account if there is none (`POST
  /connect/onboard` with `x-cagi-account: acct:org:<id>`) and opens Stripe's form: identity, bank and tax are the
  founder's to fill in, on Stripe's page.
- **Who pays**: the founder, through the org's owner (§ who pays above). `test/chat-widgets.mjs` checks that the
  allowance or the credits moved and that Billing lists the co-founder's calls.
- **The charter**: the co-founder agent's `systemPrompt`, read by every chat at each turn. The console writes it again
  when `charterFor` changed (`refreshCharter`: the record's `cofounder.charter` is the digest it wrote).
- **The lint** runs when the console opens a business, at most once a week, and makes one task (`schema.strays`).
- **Tests**: `test/schema.mjs` (plain node: the paths, the lens, the lint, the record, the settings, a contact's
  vCard); `test/journey.mjs` checks the org, its files and no stray, the storefront at `<slug>.vibestartup.pro`, the
  approval as a file of the org's `Tasks/`, Files' lens and link, the Finish payouts card, the switcher with two
  businesses, and the erasure of the founder's two business orgs.

## the one-time move

`scripts/move-to-org.mjs` moves a business made before businesses were orgs. It runs in the console's page as the
signed-in founder (their own token): `(await import('/scripts/move-to-org.mjs')).move({ slug, apply })`. A dry run
reads only; `apply: true` does each step once (a second run does only what is left) and writes its report into the
founder's own Drive (`VibeStartup/moves/<slug>-<time>.json`).

1. Read the folder (`GET /accounts/me/files?prefix=Businesses/<slug>/`: each file's size and SHA-256), the record, the
   catalogue, the settings, the customers, the business's tasks in the founder's `Tasks/`, the site, the chat and its
   routines, the goods; stop if anything is unreadable.
2. `POST /accounts { name, handle: <slug> }` with the founder's VibeStartup token, so the org's brand is VibeStartup.
3. Copy every file to its schema path in the org's Drive (the co-founder's Markdown from `cofounder/` to the root, the
   rest at its own path, the business's task files into `Tasks/`), then compare each copy's size and SHA-256 with the
   original's. `cofounder/PLATFORM.md` and `cofounder/CODEMAP.md` are not copied: they are the charter's now, and stay
   in the Trash with the folder.
4. Reshape what changes shape: `settings.json` into `.commandagi/settings.json`'s keys, `customers/customers.json`
   into `contacts/<email>.vcf`, the catalogue's paths to the org's root.
5. Move the site with `POST /sites/:id/transfer`: its id, slug, deploys, env and analytics stay (CommandAGI cannot move
   a site back to a person yet: its `docs/next`).
6. Fork the co-founder into the org with today's charter and open the org's main chat; the chat from before stays the
   founder's thread (a run cannot change hands) and is listed in Chat as "Before the move" (`cofounder.earlier`).
7. Make the same routines on the new main chat, then pause the old ones (kept, with their history).
8. Write the record; the mail address stays the founder's (a gap on the record); start payouts as the org (its own
   Stripe account, up to Stripe's form).
9. Move the old folder to the Trash, all but `runs/` (the old chat's run, which its thread writes at that path), and
   the business's task files with it; then `POST /goods/reindex` as the org, so a good whose file moved comes along
   with its slug and SKU (CommandAGI's "a product moves with its file", 03e577dded1); record the move in `MEMORY.md`.
