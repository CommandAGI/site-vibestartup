# The journey's contract: ids and classes the pages keep

`test/journey.mjs` drives the app through these. A page that renames one breaks the journey, so change both.

## landing (`/`)

| what | selector |
|---|---|
| the idea box | `#idea` (textarea) |
| the example chips | `#chips .chip` |
| the sketch under the box | `#sketch` with `[data-f=name]`, `[data-f=tagline]`, `[data-f=product]`, `[data-f=day-1]` … and `#sketch-note` (says it is a preview) |
| start building | `#start` (a link to `/start/?idea=…`, its text names the sketched business) |
| sign in | `a[href="/auth/"]` |
| the hero's background figures | `.hero-figs` (`aria-hidden`; gone at 1100 px and under), `.hero-fig.her`, `.hero-fig.him`, `.hero-note` |
| how it works | `#how .steps li` (an arrow after each but the last) |
| what the co-founder does | `#what .cap-grid article` (each has a `.cap-icon`) |
| plans | `#plans .plan-grid article` (the three listings; each shows its price "/ 30 days") |

## auth (`/auth/`)

| what | selector |
|---|---|
| create account | `#signup` with `[name=name]`, `[name=email]`, `[name=password]`, `[name=birthdate]` (a date; the platform's models for adults need it), `button[type=submit]`, `[data-error]` |
| sign in | `#signin` with `[name=email]`, `[name=password]`, `button[type=submit]`, `[data-error]` |
| the switch between them | `[data-auth-switch]` |

After success the page goes to `?next=` or `/home/`.

## wizard (`/start/`)

| what | selector |
|---|---|
| the step | `#wizard[data-step="idea|blueprint|name|vibe|voice|partner|cofounder|updates|building"]` and `#step-label` ("Step 3 of 8 · Name") |
| the idea | `#idea` |
| a choice | `#choices .choice` (a button; `[data-id]`; the suggested one has `.suggested`) |
| your own answer | `#own` (input), when the step takes one |
| continue / back | `#continue`, `#back` |
| building | `#building li[data-done]` as steps finish; then the page goes to `/app/?b=<slug>` |

## home (`/home/`)

| what | selector |
|---|---|
| a business | `.biz-card` with `[data-slug]`, a link `a.open` to `/app/?b=<slug>` |
| new business | `#new-business` (to `/start/`) |
| the account | `#account-email`, `#signout`, `#delete-account` |

## console (`/app/?b=<slug>`)

| what | selector |
|---|---|
| the rail | `.rail a[data-tab="chat|dashboard|analytics|tasks|email|products|orders|customers|ads|studio|outbound|social|files|legal|settings|activity"]`; the current one `[aria-current=page]` |
| the rail on a phone | the same `.rail`, a drawer: `#rail-toggle` (top bar) and `#more` (bottom bar) open it (`body[data-rail=open]`), `#rail-close`, `#rail-scrim`, Escape or a chosen tab close it; `#bottombar a[data-tab]` are the four tabs that stay |
| the account menu | `#account-menu` (opens billing, profile, share, sign out: `[data-page=billing]`, `[data-page=profile]`, `[data-page=share]`, `#signout`) |
| search | `#search` (⌘K opens it), `#search input` |
| the content | `#main`, with `#main[data-tab]`; a visit's view is `#main > .view`, which holds `.skeleton` (grey bars) until the tab paints, `.loading.slow` with `[data-retry]` when the tab takes over 10 s, or `.empty` with `[data-retry]` when it failed. A tab is ready when `#main .view` exists and `#main .skeleton` does not |
| keys | `G` then a letter opens a tab (`GO` in `app/console.js`), `[` `]`, `/`, `?` (a `dialog.modal` labelled "Keyboard shortcuts") |
| an empty state's next step | `.empty [data-press="<selector>"]` presses that control; or a link to a tab |
| chat | `.chat`, each message `.msg` (`.msg.me`, `.msg.cofounder`, `.msg.system`), `#composer`, `#send`, the suggested questions `#prompts [data-prompt]` (a chip writes into the composer), approval cards `.approval` with `[data-approve]`, `[data-reject]`, `[data-reasoning]`; a milestone `.milestone`; the briefing `.briefing` |
| the right panel | `#building` (the site's state `[data-site-state]`, the brand kit `[data-brand]`, needs you `[data-needs]`) |
| dashboard | `#launch-week li[data-day]` (the current one `.today`), `#needs-call`, `#money .kpi`, `#autopilot` (a switch) |
| tasks | `#approvals .task`, `#in-progress .task`, `#done .task`, `#routines .routine` with `[data-pause]`, `[data-resume]`, `[data-run]`, `[data-edit]`, `[data-cancel]`; `#new-routine` |
| products | `#add-product`, `#p-name`, `#p-desc`, `#p-price`, `#p-type` (a select; subscription, service and course say "checkout soon"), `#p-how` (how buyers pay for the chosen type), `#p-recurring`, `#create-product`, `#product-list .product` with `[data-activate]`, `[data-archive]`, `[data-test-buy]`; the checkout `#checkout-dialog` (a `dialog`) with `[name=email]`, `[name=card]`, `[name=exp]`, `[name=cvc]`, `button[value=pay]`, `#copy-card` |
| orders | `#orders tbody tr` (a test order carries `.test` and the word Test) |
| customers | `#customers tbody tr` |
| email | `#claim` (no address yet), `#mail-soon` (a second business: its own address is Soon, `[data-notify=email-address]`), `#mail-address`, `#mail-folders [data-folder]`, `#mail-list .thread`, `#mail-thread`, `#mail-reply`, `#mail-compose` |
| ads | `#ads-plan` (the form), `#ads-readiness li[data-ok]`, `#ads-recheck`, `#ads-ask`, `#ads-launch` (disabled, says Soon), `[data-notify=ads-launch]` |
| studio | `#studio-tabs [data-view="make|month|library|brand|formats"]`, `#make-format`, `#make-prompt`, `#make-count`, `#make-go`, `#library .piece`, `#brand-book`; video formats (`short`, `clip`, `film`): `#make-aspect [data-aspect="9:16|1:1|16:9"]`, `#make-still` (clip, short), `#make-stills input[type=checkbox]` (film), `#make-still-upload`, `#make-caption` (short), `#make-endcard` (film), `#make-credits`; the renders `#studio-jobs .job[data-id][data-state="rendering|done|failed|interrupted"]` with `[data-step]`, `[data-elapsed]`, `[data-player] [data-play]` → `video`, `[data-retry]`; a video in the library: `#library .piece [data-play]` |
| outbound | `#leads-upload` (file input), `#leads tbody tr`, `#outbound-campaigns .campaign` |
| social | `#social-accounts .account` with `[data-connect]` (`.account[data-id=reddit]` says Soon), `#social-auto` (automatic publishing: Soon, `[data-notify=social-auto]`), `#compose-post`, `#posts .post`, `#social-view [data-view="calendar|list"]` |
| files | `#file-search`, `#file-groups .group`, `.file-row` with `[data-open]`, `[data-copy]`, `#file-upload`, `#file-preview` |
| legal | `#formation` (its state and the numbers), `#file-company` (disabled, says Soon), `[data-notify=company-filing]`, `#legal-pages a`; documents: `#legal-docs [data-doc=terms|privacy|refunds|contractor|nda|founders|llc|invoice|formation]` (the chosen one `[aria-pressed=true]`), `#legal-form` (each field `#legal-f-<key>`, e.g. `#legal-f-state`), `#legal-missing`, `#legal-pdf`, `#legal-save`, `#legal-use` (the storefront's three only), `#legal-status` ("Downloaded …", "Saved to Files: legal/<file>.pdf.", "Written to legal/<page>.html. …"), `#legal-preview` |
| settings | `#autonomy` (a switch), `#briefing` (a select), `#plan`, `#domain-form` with `[name=hostname]`, `#secrets` with `#secret-name`, `#secret-value`, `#secret-save`, `#secret-list .secret`, `#runtime`, `#built-estimate`, `#members` with `#member-email`, `#member-role`, `#member-invite`, `.member` and `[data-revoke]`, `#delete-business` |
| activity | `#activity .event` |
| billing | `#credits-balance`, `#packs [data-buy]` (a credit pack's checkout), `#plans article[data-listing][data-open="1"|"0"]` (the listings; each shows its price "/ 30 days"; one not open says "opens December 8" and wears `.pill.soon`), `[data-hire=<listing id>]` (disabled until the listing is open), the confirm sheet `dialog#hire-sheet` with `#hire-terms`, `#hire-short [data-buy]` (short of credits) and `#hire-confirm`, `#plan-current`, `#contracts .contract[data-contract][data-status]` with `[data-sign]`, `[data-cancel]`, `[data-renew]`, `[data-accept]`, `[data-dispute]`, `#contracts-past`, `#credits-history tr`, `#dispute` |
| profile | `#profile-name`, `#profile-email`, `#notif-push`, `#notif-email`, `#signout`, `#delete-account` |
| share | `#referral-link`, `#copy-referral`, `#share-referral` (the phone's share sheet, where the browser has one), `#referral-rewards`; on an API without referrals `#referral-soon` (the "Soon" pill); with them `#referral-rule`, `#referral-count`, `#referral-earned`, `#referral-list tr`, and for a referred founder `#referral-unlock` with `#confirm-email` |

| soon | `.badge.soon` (the pill), `.btn.is-soon` (a control that opens soon), `[data-notify="<feature>"]` (`aria-pressed` says whether the founder asked) |
| the account menu | `#account-menu`, then `.menu button`: Billing, Profile, Share & earn, Replay the tour, Sign out |
| a first-run guide | `.guide[data-guide="wizard|console|products|studio|tasks"][data-step]`, `.guide-next`, `.guide-skip`, `.guide-ring`; `html[data-guide]` while one shows. Hidden from a driven browser unless `?guides=1` or localStorage `vs_guides_ask` = "1" |

A table (`table.table`) reflows on a phone: `console.js` writes each cell's column name into `td[data-label]`.

Every destructive act is a trash icon with a tooltip, never red text. Every provider stop is a `.note.warn` that
says which provider and that nothing was sent.
