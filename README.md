# site-vibestartup

VibeStartup's web app, at https://vibestartup.commandagi.app and on its domains (vibestartup.pro, vibestartup.us).
VibeStartup is a brand of CommandAGI Inc: a consumer app in which a person describes an idea and an AI co-founder
builds and runs a real small business with them. The app holds no accounts, no database and no model call of its
own: every feature is a CommandAGI feature, called from the browser with the founder's own CommandAGI token
(docs/ARCHITECTURE.md). It is mounted in CommandAGI's Drive at `seed/org-vibestartup/sites/vibestartup`.

## what it is

- **The landing** (`/`): type an idea, watch a sketch of the business grow under the box, start building.
- **The wizard** (`/start/`): idea, the first version, a name, a look, a voice, the co-founder's character and name,
  updates; then the business is made, step by step, on the founder's CommandAGI account: a folder in their Drive,
  a business email, a storefront site, the co-founder's memory files, the co-founder's thread, the daily briefing.
- **Home** (`/home/`): the account's businesses, a new one, the account.
- **The console** (`/app/?b=<slug>`): chat with the co-founder, the dashboard, analytics, tasks and routines, email,
  products, orders, customers, ads, the studio, outbound, social, files, legal, settings, activity; billing, profile
  and share & earn.

The spec is `docs/`: `ARCHITECTURE.md` (how each feature maps to a CommandAGI route or tool, and the honesty rules),
`DESIGN.md` (the look), `SELECTORS.md` (the ids and classes the journey drives), `HANDOFF.md` (where it stands, who owns
what is open, and what is left).

## files

| file | what |
|---|---|
| `app.mjs` | the server module: `/brand.js` (which CommandAGI API the page talks to) and nothing else |
| `index.html`, `landing.css`, `landing.js` | the landing and its sketch |
| `start/` | the new-business wizard |
| `home/`, `auth/`, `pages.css` | the businesses, sign in and create account |
| `app/` | the console |
| `lib/api.js` | the CommandAGI client: the token (the `vibestartup` OAuth client's password grant and `/oauth/signup`), refresh, REST, MCP tools, Drive, threads, tasks, sites, email |
| `lib/business.js` | the business record, its creation sequence, the co-founder's charter, the memory files, the brand generator |
| `lib/storefront.js` | the storefront: its files (shop, a page per product, checkout, terms, privacy, refunds, product pictures, the sign-ups' server module), what the checkout can sell, the brand address, the publish |
| `lib/ui.js` | icons, toasts, dialogs, menus, formatting, the Soon pill |
| `lib/legal-docs.js`, `lib/pdf.js` | the Legal tab's document templates, and a PDF writer with no dependency (Helvetica, wrapping, lists, tables, signature lines, page breaks, the brand's mark) |
| `lib/guides.js` | the first-run guides: callouts beside real controls, seen once per account (docs/DESIGN.md § guides) |
| `style.css` | the tokens and base components |
| `fonts/` | Instrument Sans and Instrument Serif (SIL Open Font License 1.1) |
| `wordmark.svg`, `wordmark-dark.svg`, `mark.svg`, `touch-icon.png`, `og.png`, `brand/` | the wordmark (light and dark), the favicon, the touch icon, the share image, and the HTML + script that render the last two |
| `test/local.mjs` | the app on this computer: the static files and `app.mjs`, pointed at a local CommandAGI platform it starts, or at an API you name |
| `test/legal-pdf.mjs` | every Legal template as a PDF from a sample business, to open and check (`pdfinfo`, `pdftotext`, `pdftoppm`) |
| `test/journey.mjs`, `test/browser.mjs` | the journey from a blank account, in Chrome over the DevTools protocol |
| `test/hire.mjs` | hiring the co-founder from a blank account (docs/ARCHITECTURE.md § hiring) |
| `site.json` | the site's manifest |

## running it here

```
node test/local.mjs --api https://api-dev.commandagi.com --port 4180   # the pages against the dev API
COMMANDAGI_ROOT=<a CommandAGI checkout> COMMANDAGI_ENV_ROOT=<the checkout with .env> node test/local.mjs --port 4180
                                                                       # the pages against a local platform it starts
node test/journey.mjs                                                  # the journey, against a local platform
node test/legal-pdf.mjs [dir] [--blank]                                # every Legal template as a PDF (.test-results/legal)
node test/journey.mjs --url https://vibestartup.commandagi.app         # the same journey, deployed
VS_ADMIN_KEY=<a staff key of dev> node test/hire.mjs --api https://api-dev.commandagi.com
                                                                       # hire the co-founder on dev (its listings open)
python3 brand/render.py                                                # og.png and touch-icon.png again
```

The local platform is the whole api worker under workerd with its own database and files, built from
`COMMANDAGI_ROOT` (the first build takes a minute or two); the service accounts come from `COMMANDAGI_ENV_ROOT`'s
`.env` cascade, so the co-founder's model calls are real. Sign-up needs the `vibestartup` OAuth client and
`POST /oauth/signup` on the API (CommandAGI migration 0708 and `docs/brands.md`).

## addresses

| address | what |
|---|---|
| vibestartup.commandagi.app | production, on CommandAGI's site hosting, against `api.commandagi.com` |
| vibestartup--dev.commandagi.app | the dev deploy, against `api-dev.commandagi.com` |
| vibestartup.pro, vibestartup.us | the app, once their DNS records are in place |

## deploying

```
cd seed/org-vibestartup/sites/vibestartup
commandagi sites deploy . --prod
```

The site needs no resources and no env: it is static files and one server module.
