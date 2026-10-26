# site-vibestartup

VibeStartup's own web app, at https://vibestartup.commandagi.app and on its domains (vibestartup.pro, vibestartup.us).
VibeStartup is its own startup: this repository is the whole product a person uses, and CommandAGI is only its host and
vendor (`commandagi sites`, docs/site-hosting.md). It is mounted in CommandAGI's Drive at
`seed/drive/platform/org-vibestartup/sites/vibestartup`.

## what it is

A startup factory. A person signs up, and every account has many startups. Each startup is a console with sixteen tabs:
chat with a real AI co-founder, the launch-week dashboard, tasks and routines, files (the co-founder's memory),
products with a sandbox test checkout, settings with environment secrets, and the rest of the spec the org's
`product.md` holds.

A site folder's `app.mjs` is its server module (CommandAGI's site hosting runs it), so this app has its own routes and
its own database: the site's D1 resource (`DB`). Accounts, sessions, startups and each startup's console state are rows
there. The co-founder's replies come from a model this app calls server-side (OpenRouter); the key lives in the site's
environment (`commandagi sites env vibestartup set OPENROUTER_API_KEY=… --secret`), never in a page.

Providers that need money or a third-party account (live payments, ads, social posting, email sending, a custom
domain) are built up to the provider call: the app records what was asked and answers "connect your provider".

## files

| file | what |
|---|---|
| `app.mjs` | the server: accounts, sessions, startups, the console's routes, the co-founder's model call |
| `index.html`, `es/`, `zh/` | the landing and its static locales (en, es, zh-Hans), with the A/文 picker |
| `site.js` | the public pages' script: the account forms and the language dialog |
| `startups/` | the account's businesses and a new business from an idea |
| `app/` | the console: `app.js` renders the state the app sends, `app.css` styles it |
| `style.css`, `mark.svg` | the house style and the mark |
| `test/local.mjs` | the app on this computer: the site's files and `app.mjs`, D1 as in-memory SQLite |
| `test/journey.mjs` | the journey from a blank account, in Chrome over the DevTools protocol |
| `test/browser.mjs` | the small CDP client the journey uses (no Playwright) |
| `site.json` | the site's manifest: slug, description, branch |

## running it here

```
node test/local.mjs --port 4180      # http://127.0.0.1:4180
node test/journey.mjs                # the journey against a local server it starts
node test/journey.mjs --url https://vibestartup.commandagi.app   # the same journey, deployed
```

The journey needs Chrome (`CHROME_PATH`, default `chromium-browser`). A local run takes the model key from
`OPENROUTER_API_KEY`, or from this host's secrets file with `VIBESTARTUP_USE_LOCAL_SECRETS=1`; `--no-chat` skips the
model calls.

## deploying

```
cd seed/drive/platform/org-vibestartup/sites/vibestartup
commandagi sites deploy . --prod
commandagi sites domains vibestartup add vibestartup.pro    # prints the CNAME and TXT a registrar needs
```

DNS is the integrator's: these commands print what a registrar needs and never move DNS.
