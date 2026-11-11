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

- **The co-founder's first answer is slow** (over 90 s at some widths). Measured 2026-11-11 on production with a one-line
  prompt: `POST /threads` 4 s, the thread's first lifecycle event 9 s later, the turn done at +20 s. The real opening
  reads about ten files and makes two tasks, each tool call 2 to 4 s, so the first answer lands past 90 s. Shorter: an
  opening that answers before it reads, the files in one call, or a faster tool path in the platform.
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
- **`<slug>.vibestartup.pro` for every storefront.** CommandAGI's site hosting serves a custom hostname per site
  (Cloudflare for SaaS on the `commandagi.app` zone, `POST /sites/:id/domains`); one record in the vibestartup.pro zone
  routes every name at once. The app is ready: at a publish or a Settings visit it asks public DNS whether
  `<site slug>.vibestartup.pro` CNAMEs to `*.commandagi.app`, adds that hostname to the site, and Settings shows it
  (`#brand-address`) with its state; once it is active the storefront's links use it. Two steps, in this order:
  1. **First, a guard in CommandAGI** (not built: this session could not change CommandAGI). With the wildcard in
     place, Cloudflare validates any custom hostname under vibestartup.pro by HTTP, so any CommandAGI account could
     put its own site at `anything.vibestartup.pro`. `addCustomDomain` (`api-worker src/routes/sites.ts`) should
     refuse a hostname under a brand's zone unless the caller's token is that brand's platform-owned client
     (`vibestartup`) and the label is the site's own slug, with a boundary test (another account, another client, a
     label that is not the slug).
  2. **Then the record**, in the Cloudflare account that holds vibestartup.pro (DNS → Records → Add record):

     | Type | Name | Target | Proxy status | TTL |
     |---|---|---|---|---|
     | CNAME | `*` | `cname.commandagi.app` | DNS only (grey cloud) | Auto |

     It changes nothing else: the apex, `www` and every name that has a record of its own (the mail's MX, SPF, DKIM,
     DMARC, Resend's `send`, Email Routing) keep theirs, because a wildcard answers only names with no record. Check:
     `dig +short CNAME anything.vibestartup.pro` answers `cname.commandagi.app.`; then open a business's Settings.
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
