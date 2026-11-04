# handoff (2026-11-03)

Where VibeStartup stands, what other sessions own, and what is left. Update this file when an item closes, and delete an
item when it is done; history stays in the git log and in CommandAGI's `docs/verification.md`.

## live and verified

- Production: vibestartup.pro, www.vibestartup.pro, vibestartup.us and www.vibestartup.us serve this repository
  (deployed with `commandagi sites deploy <export of HEAD> --prod`, as the host account that owns the site
  `vibestartup`). The API is `https://api.commandagi.com` (`/brand.js`).
- The journey passes on production, at 1440 and 390 px, for the whole flow:
  - sign-up, the wizard and the co-founder's reply;
  - an approval, the files and the launch week;
  - a product, a test buy and the storefront (`<slug>.commandagi.app`);
  - a secret, a domain record, a routine and Activity;
  - a second business, and the account deleted through the page.

  Each run erases its own accounts (`--keep` keeps them). Run it with:

  ```
  node test/journey.mjs --url https://vibestartup.pro
  ```

- The journey checks one edge, square corners at every screenshot (`test/edges.mjs`, `docs/DESIGN.md` § shape and
  depth).
- The platform side: the `vibestartup` OAuth client and `POST /oauth/signup` (CommandAGI 74f5c66, migration 0708);
  the sign-up cap is 500 a day on production and 200 on dev (CommandAGI 5503606; live since 2026-11-03 through a
  workbench-only deploy of c73b803 with only the settings changed).

## owned by other sessions

The CommandAGI driver session (`commandagi-95`, the gate and the deploys) took these on 2026-11-03:

- **Deploy CommandAGI main.** It carries the caps from the repository and the erase fix (1afd25356ba): erasure now
  revokes the caller's sign-ins last and deletes in bounded batches. Production was still on c73b803 when this was
  written.
- **Dev, after its next dev deploy:**
  - Retry the erase of the two journey accounts stuck there, `journey-mw1avsed-390@example.com` and
    `journey-mw1avsed-1440@example.com` (password `correct horse battery`). Dev's D1 answered `D1 DB is overloaded` to
    every erase.
  - Publish this site on dev (it still serves 13648e0), from a CommandAGI checkout whose gitlink is current:

    ```
    node scripts/seed/run.mjs sites-org-vibestartup dev --apply
    ```

## left to do

- **After the production deploy of CommandAGI main:** run the journey once against production (the command above), to
  see the new erase order with this site's accounts. The page's "enter your password to finish" step stays as a
  fallback and should no longer appear.
- **The co-founder's first answer is slow.** It took more than 90 s in three of six widths on production on
  2026-11-03, and the journey reports it as a problem. Find where the first turn spends its time (the thread's events)
  before changing the journey's wait.
- **A late erase failure on production.** Production's erase answered `D1 DB is overloaded` once on 2026-11-03, and a
  retry succeeded. The erase fix above should cover it; the journey after the deploy shows whether it does.

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
