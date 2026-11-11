# The journey's contract: ids and classes the pages keep

`test/journey.mjs` drives the app through these. A page that renames one breaks the journey, so change both.

## landing (`/`)

| what | selector |
|---|---|
| the idea box | `#idea` (textarea) |
| the example chips | `#chips .chip` |
| the sketch under the box | `#sketch` with `[data-f=name]`, `[data-f=tagline]`, `[data-f=product]`, `[data-f=day-1]` … and `#sketch-note` (says it is made by a script) |
| start building | `#start` (a link to `/start/?idea=…`, its text names the sketched business) |
| sign in | `a[href="/auth/"]` |
| plans | `#plans article` (each says "set at launch") |

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
| the account menu | `#account-menu` (opens billing, profile, share, sign out: `[data-page=billing]`, `[data-page=profile]`, `[data-page=share]`, `#signout`) |
| search | `#search` (⌘K opens it), `#search input` |
| the content | `#main`, with `#main[data-tab]` |
| chat | `.chat`, each message `.msg` (`.msg.me`, `.msg.cofounder`, `.msg.system`), `#composer`, `#send`, approval cards `.approval` with `[data-approve]`, `[data-reject]`, `[data-reasoning]`; a milestone `.milestone`; the briefing `.briefing` |
| the right panel | `#building` (the site's state `[data-site-state]`, the brand kit `[data-brand]`, needs you `[data-needs]`) |
| dashboard | `#launch-week li[data-day]` (the current one `.today`), `#needs-call`, `#money .kpi`, `#autopilot` (a switch) |
| tasks | `#approvals .task`, `#in-progress .task`, `#done .task`, `#routines .routine` with `[data-pause]`, `[data-resume]`, `[data-run]`, `[data-edit]`, `[data-cancel]`; `#new-routine` |
| products | `#add-product`, `#p-name`, `#p-desc`, `#p-price`, `#p-type`, `#p-recurring`, `#create-product`, `#product-list .product` with `[data-activate]`, `[data-archive]`, `[data-test-buy]`; the checkout `#checkout-dialog` (a `dialog`) with `[name=email]`, `[name=card]`, `[name=exp]`, `[name=cvc]`, `button[value=pay]`, `#copy-card` |
| orders | `#orders tbody tr` (a test order carries `.test` and the word Test) |
| customers | `#customers tbody tr` |
| email | `#mail-address`, `#mail-folders [data-folder]`, `#mail-list .thread`, `#mail-thread`, `#mail-reply`, `#mail-compose` |
| ads | `#ads-plan` (the form), `#ads-readiness li[data-ok]`, `#ads-recheck`, `#ads-ask` |
| studio | `#studio-tabs [data-view="make|month|library|brand|formats"]`, `#make-format`, `#make-prompt`, `#make-count`, `#make-go`, `#library .piece`, `#brand-book` |
| outbound | `#leads-upload` (file input), `#leads tbody tr`, `#outbound-campaigns .campaign` |
| social | `#social-accounts .account` with `[data-connect]`, `#compose-post`, `#posts .post`, `#social-view [data-view="calendar|list"]` |
| files | `#file-search`, `#file-groups .group`, `.file-row` with `[data-open]`, `[data-copy]`, `#file-upload`, `#file-preview` |
| legal | `#formation` (its state and the numbers), `#legal-pages a` |
| settings | `#autonomy` (a switch), `#briefing` (a select), `#plan`, `#domain-form` with `[name=hostname]`, `#secrets` with `#secret-name`, `#secret-value`, `#secret-save`, `#secret-list .secret`, `#runtime`, `#built-estimate`, `#members` with `#member-email`, `#member-role`, `#member-invite`, `.member` and `[data-revoke]`, `#delete-business` |
| activity | `#activity .event` |
| billing | `#credits-balance`, `#packs [data-buy]` (a credit pack's checkout), `#plans article` (the listings; each says "set at launch"), `#plan-current`, `#credits-history tr`, `#dispute` |
| profile | `#profile-name`, `#profile-email`, `#notif-push`, `#notif-email`, `#signout`, `#delete-account` |
| share | `#referral-link`, `#copy-referral` |

Every destructive act is a trash icon with a tooltip, never red text. Every provider stop is a `.note.warn` that
says which provider and that nothing was sent.
