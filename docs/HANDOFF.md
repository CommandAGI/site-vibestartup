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
  Express account). A physical product is a good; a digital good is ordered by email until the checkout sells digital
  goods to guests. The co-founder adds products as product files (`productsRule` in `lib/business.js`); the Products
  tab links them to their goods.
- Billing sells CommandAGI's credit packs through Stripe Checkout and shows the three listings at their prices (Co-founder
  $39, Growth $29, Studio $29 for 30 days), opening on 2026-12-08.
- Speed: the console opens in about 2 s (parallel first reads, a file read by path in one call); a business is built in
  under 2 minutes (its folders and files made at once).

## owned by other sessions

- **CommandAGI, started 2026-11-11 by the VibeStartup session's agent:** a brand's own origin for checkout, portal and
  Connect onboarding returns (today a pack's checkout returns to commandagi.com: Billing asks for this origin and falls
  back), and a guest's paid digital good delivered by an emailed download link. When it reaches production: Billing's
  fallback goes, Settings → Payments passes this origin, and the storefront sells digital goods through the checkout
  (`storefrontFiles` `sellable`, `app/tabs/products.js` `sold`).

## left to do

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
