# VibeStartup: the design

Owner direction, 2026-11-03: the book-style site was "very old school"; make VibeStartup a consumer app like DreamIt
and the robot creators' shop, with every feature of MadeThis and more, in the professional register of Replit or
Lovable. This spec replaces the 2027 book spec.

## concept

**The console is the product, and the landing is a window into it.** A founder types an idea into one calm box and
watches a business take shape: a name, a brand, a storefront, a launch week, a co-founder who talks back. The whole
site is one product UI, not a brochure: the landing's hero box is the same box the wizard and the console use.
Professional, warm, quiet confidence. Nothing shouts; the one accent does the pointing.

## type

- **Instrument Sans** for everything (self-hosted, Latin and Latin Extended, `font-display: swap`): text 400/500,
  labels 500, headings 600 with tight tracking (−0.02 em; display −0.03 em). `text-wrap: balance` on headings,
  `pretty` on paragraphs; tabular figures in tables and money.
- **Instrument Serif italic** only in the wordmark ("Vibe") and for one word of the hero headline. Nowhere else.
- Scale: marketing 17 px body, display `clamp(40px, 6.5vw, 76px)`; the console 14 px body, 13 px labels, 20/24 px
  headings.

## colour (tokens in `style.css`; light is the default, dark follows the system)

| token | light | dark | use |
|---|---|---|---|
| `--bg` | #ffffff | #0f0f12 | the page |
| `--canvas` | #f7f6f3 | #16161a | the console's ground, section bands |
| `--surface` | #ffffff | #1d1d22 | cards, rail, composer |
| `--ink` | #17161a | #f2f1ee | text |
| `--ink-2` | #5f5c66 | #a3a09b | secondary text |
| `--ink-3` | #8e8a93 | #6f6c74 | hints, placeholders |
| `--line` | #e9e6e0 | #2a2a31 | hairlines |
| `--accent` | #f0532f | #ff6a47 | the one accent: primary buttons, the active tab's mark, links on hover |
| `--accent-soft` | #fff0eb | #3a1f17 | accent tints |
| `--cofounder` | #5b57d9 | #8b87ff | the co-founder's avatar ring and name, only |
| `--ok` / `--warn` / `--bad` | #1f8a4c / #b7791f / #c8321f | states |

No gradients except the hero's soft radial wash (accent at 6 %, cofounder at 5 %) behind the prompt box. No glass.

## shape and depth

Owner direction, 2026-11-11: "Lean more into the sharp-shaped, no-margin select backgrounds, rounded modal corners,
mobile-friendly CommandAGI style." VibeStartup keeps its own brand (Instrument Sans, the accent, the wordmark) and
takes the shape language, density and selection style of CommandAGI's shell (`packages/appkit/workbench/style.css`,
CommandAGI `docs/regions.md` § one edge, square corners).

| what | radius | shadow |
|---|---|---|
| buttons, inputs, cards, panels, list rows, tabs, chat blocks, the idea box, the composer, a numbered step marker | 0 | none (the idea box alone keeps `--shadow-float`: it is the signature) |
| a chip (an example idea, a suggested question, a choice of name), a badge (a state, a count), a tag (the hero's eyebrow, a character's traits, "Suggested") | `--r-pill` (999 px) | none |
| a dialog, a menu, the landing's phone menu | `--r-float` (14 px) | `--shadow-modal` for a dialog, `--shadow-float` for a menu |
| a toast, a tooltip | `--r-tip` (8 px) | `--shadow-float` on a toast |
| round by nature: a person's or the co-founder's avatar, a switch, a spinner, a status dot | round | none |

- **Square shapes.** What acts and what holds is square: a button, a field, a card, a panel, a row. Hairlines
  (`--line`) separate; no card floats.
- **A pill is a small label** (owner, 2026-11-11: the hero's chips and eyebrow "should be rounded not rects"). A chip
  (a choice or a suggestion that fills a field), a badge (a state or a count) and a tag are pills, with the same line
  on every edge or none. A pill never submits, saves or spends: what does that is a button, and a button is square.
- **A rounded corner means "this floats".** What opens over the page is rounded and carries a shadow: dialogs, menus,
  toasts, tooltips. The phone's drawer is attached to the window's edge, so it is square.
- **A selection is a band from wall to wall.** A row of the rail, a menu, a list, the search results or the mail
  folders has no margin around its background and no rounded highlight: hover is a `--surface-2` band, the current row
  is an `--accent-soft` band with a 2 px accent line on its start edge (an inset shadow). The container has no side
  padding; the row pads its own text. A `.list` is one bordered surface whose rows run wall to wall.
- **One edge, square corners** (owner, 2026-11-03). A line on one edge only (the current row's accent line, a subtab's
  underline, a notice's or an approval's start line) is legal on any square element. On the rounded ones (floats and
  pills), the outline is the same on every edge or absent.
- Buttons: `.btn` square, 40 px high (44 px on a phone); `.btn.primary` accent with white text; `.btn.quiet` surface
  with a hairline; `.btn.ghost` text only; `.btn.danger` outline in `--bad` (a row's remove is a trash icon with a
  tooltip, never red text).
- Notices (`.note`) and the cards that need a call (`.approval`, `.milestone`) carry a start line in their tint.
- Toolbars use icon buttons with tooltips (`title` and `aria-label`); rare actions sit in a ⋯ menu. A menu opens 2 px
  from its trigger, above it when the window ends first.
- The journey scans the final cascade at every screenshot (`test/edges.mjs`): an element that is rounded and is not
  on the list above is a problem, and so is a rounded one whose edges carry different lines.
- **Cards in a row share their lines** (owner, 2026-11-11: "we need vertical alignment"). A grid of cards with the
  same parts (the steps, the launch week, the capabilities, the plans, Billing's packs and listings) is a subgrid: each
  card spans the rows of its parts, so every badge, title, body, list and button starts on the same line across the
  row, however long one card's words are, and the buttons sit on one line at the bottom. A card that is stretched to
  its row's height keeps its content at the top (`align-content: start`; `.stack` and `.kpi` do).
- **Icons** are the one set of `lib/ui.js` (`icon()`: a 24-unit grid, a 1.8 stroke, round caps). A capability card of
  the landing carries one, in the accent on a 40 px `--accent-soft` square.
- **A flow has arrows.** The landing's three steps have the `arrow` icon in the gap after each step but the last, in
  the accent; when the steps stack (1000 px and under) it points down.

## layout

- **Landing**: a 64 px sticky header (wordmark, Product, How it works, Pricing, FAQ; Sign in; Start free). Hero:
  two figures in the margins behind it (below), the headline, one sentence, the idea box (textarea, example chips below, "Start building" inside the box), then the
  business sketch that grows under it as the visitor types (name, brand colours, storefront card, launch week): made
  in the browser, labelled a preview. Then: how it works (three steps with arrows between them), the console in a
  framed window (labelled "with example data"), the launch week (seven days), what the co-founder does (eight cards,
  one per capability: an icon, a title, a sentence, and one line that says what you connect or that it is ready),
  what you get and don't, plans (the three listings at Billing's prices, `app/tabs/billing.js`; the first one's
  button is the primary one, because every founder starts there), FAQ, footer.
- **The hero's figures** (owner, 2026-11-11: an "instagirl" at her phone on the left and a "tech bro" at his laptop
  on the right, both making money on their startups, "like marginal visuals in the bg"). Two drawn, fictional people
  in one flat style and the brand's colours (`hero/her.webp`, `hero/him.webp`: made with CommandAGI's image route,
  cut from white to clear, under 50 KB each, decorative, `alt=""`). They are background: 42 % opacity, less
  saturated, fading out at the foot, placed 430 px from the centre so the window's edge cuts them and they never
  reach the headline or the idea box. Each has two small notes (`.hero-note`: an order, a week's total, a payout, a
  sales line) that drift 5 px; they float, so they are rounded (`--r-tip`). The notes are a picture of the product,
  not a claim about a customer: no person's name, no quote. At 1100 px and under the figures are gone. Reduced motion:
  nothing drifts.
- **Wizard** (`/start/`): one question per screen, centred, max 640 px, a progress line "Step 3 of 8 · Name", the
  co-founder's suggested answers as cards (one marked Suggested), a text field for your own, Continue and Back.
- **Home** (`/home/`): the businesses as cards (name, mark, launch-week day, what waits on you, credits), a new
  business card, the account row.
- **Console** (`/app/?b=<slug>`): at 1440, a 240 px rail (the business switcher, ⌘K search, five groups of tabs,
  then credits and the account menu; every row runs from wall to wall), a 56 px top bar (the tab's title, its actions
  as icon buttons), the content at max 1120 px; the Chat tab has a 320 px right panel ("Building": the site's state,
  the brand kit, what needs you, the blueprint). From 761 to 900 the rail is icons (64 px).
- **The console on a phone** (760 and under): the rail is a drawer from the left edge (the same rows, 44 px high, the
  business switcher, credits and the account menu included), opened by the top bar's menu button or the bottom bar's
  More, closed by its ✕, the scrim, Escape or choosing a tab. A bottom bar of five stays (Chat, Dashboard, Tasks,
  Files, More); its current cell is a band with a line on its top edge. The right panel becomes a section under the
  chat. A table reflows: each row is a block and each cell a line that names its column.
- Mobile is designed first: 44 px targets, 16 px gutters, 16 px text in fields (no zoom on focus), no sideways scroll
  at 390 and 320, forms full width.
- **A view never stays blank** (owner, 2026-11-11: Billing "did not load at first"). A tab shows grey bars
  (`.skeleton`) where its words will be; a part of a tab that waits on its own call shows bars or a spinner
  (`bars()` in `app/tabs/_shared.js`, `.loading`). After 10 s a banner says CommandAGI is slow and offers Try again,
  whatever the tab has painted. Then the tab's content, or what went wrong and Try again. A tab that answers after the
  founder left it writes into nothing: each visit renders into elements of its own (`route()` in `app/console.js`).
- **One title.** The top bar names the tab; a tab's page head that repeats the name keeps it for screen readers only
  and shows its one-line description. The Dashboard's head is the business's name, so it stays.
- **An empty state names the next step**: a bordered surface with what the place is for and one button or link that
  fills it (`empty(title, text, extra)`; `data-press="<selector>"` presses the control that does it).
- **Surfaces.** Rows that belong together sit on one bordered surface and run wall to wall: `.list`, `.table` (its
  head a `--surface-2` band), a file group, the mail folders, the readiness list.
- **Keys** (when the founder is not typing): ⌘K or `/` searches, `G` then a letter opens a tab (the letter shows in
  search and in a rail row's tooltip), `[` and `]` step through the tabs, `?` lists every key.
- **Toasts** sit in the console's bottom corner on a desktop and above the bottom bar on a phone, never over the
  composer.
- **The storefront** (`storefrontFiles` in `lib/storefront.js`) wears the business's colours on the same shapes:
  square cards and buttons, hairlines, a sticky 56 px header, one column of products until 600 px, 48 px targets,
  16 px fields. The generated mark is a square. A product card is its first picture (4:3, cover), its name (the whole
  card opens the product's page), three lines of description, the price and Buy or Order; a product with no picture
  shows the brand's gradient. The product page is a square gallery that swipes (scroll snap, no script) with a strip of
  thumbnails, then the name, the price, the whole description, Buy and one line on how it is delivered; two columns
  from 900 px. "Get updates" is one bordered panel under the products: email, first name, the button, and the consent
  box with the exact words recorded. The footer links Terms, Privacy, Refunds and the business address.

## guides (the first-run tour)

Owner, 2026-11-11: a guided first run, as CommandAGI's shell has (`packages/appkit/workbench/guides.js`). One
mechanism, `lib/guides.js`; each guide is data: `{ id, version, surface, ready, steps: [{ at, title, text }] }`.

- **A callout beside a real control**, with a square accent ring around the control. The callout floats, so it has the
  14 px corner and the float shadow. On a phone it is a sheet at the foot of the screen, over the bottom bar; at the top
  when the control is in the lower half.
- **Never blocking.** It is not modal and takes no focus; the page under it works. Escape, a press outside it, Skip
  and the last step's "Got it" close it, and each counts as seen. It waits while a dialog, a menu or the phone's
  drawer is open. A polite live region says each step.
- **A step whose control is not on screen is left out** (the rail's rows on a phone), so a guide never points at
  nothing.
- **Seen is kept per account** in this browser (`vs_guides:<account id>`, a map of id to version). A version bump
  shows a guide again. The account menu's **Replay the tour** forgets what was seen and opens the chat.
- **A driven browser sees no guide** (`navigator.webdriver`; the journey's Chrome says so) unless it asks:
  `?guides=1`, or `vs_guides_ask` = "1" in localStorage.
- **The guides**: the wizard's first step; the console's first visit (the composer, the suggested questions, approvals,
  the menu, Products, Settings for payouts, credits); Products; Studio; Tasks.
- **The copy speaks to a first-time founder** (owner: "'founder' kids", keep them excited). Warm, concrete, second
  person, short. One action a step. Celebrate what is done ("Your storefront is selling it now. Go show someone!").
  Never talk down, no jargon, no exclamation on every line.

## soon

Owner, 2026-11-11: "coming soon" instead of broken. A feature that is not open yet reads as on its way, never as an
error or an apology.

- **One component**: `soon()` in `lib/ui.js` is the pill (`.badge.soon`: the accent, small capitals), and
  `soonButton(label, classes, attrs)` is the control with its real label, not pressable, with the pill. The control
  keeps its place and its id, so the day it opens only its handler changes.
- **What is around it still works**: Ads' plan and readiness save; a post goes on the calendar; a subscription takes
  orders by email.
- **"Notify me"** is a chip beside a Soon control (`notifyChip`, `bindNotify` in `app/tabs/_shared.js`). It records
  the founder's interest in the business's `settings.json` (`notify: { <feature>: true }`).
- **Soon today**: Ads' Launch (`ads-launch`); Social's automatic publishing (`social-auto`) and Reddit; the checkout
  of subscriptions, services and courses ("checkout soon" in the type picker and on the product's row); a second
  business's own email address (`email-address`); Legal's "File my company" (`company-filing`).
- The words: "Soon", "on its way", "opens with Launch". Never "not available", "not supported", "sorry".

## motion

Short and physical: 160 ms ease-out for hover and open, 220 ms for the drawer, `@starting-style` fades for new rows.
The hero's sketch inks in field by field (opacity + 4 px rise, 320 ms). Reduced motion: nothing moves.

## signature

Type an idea; the business sketches itself under the box, then the Start button says "Start building <Name>". The
same box, with the same sketch, is the first screen of the wizard and the "New business" card at home.

## don'ts

No invented founders, numbers, logos or quotes (the hero's background notes are the one picture with amounts in it: they name no person and sit behind the page). No stock photos of people. No "most popular" badge until prices
exist. No red text for destructive actions. No second accent. No drop shadows on cards. No pill buttons, no rounded
cards, no rounded or inset highlight on a chosen row. No walls of text: a section
says one thing. The co-founder never pretends a provider is connected.

**No small print that hedges** (owner, 2026-11-11: "we already state everything in the terms. no need to make it
louder"). The terms and the privacy policy hold the legal text; a page links to them where a person accepts them and
does not repeat them. A line stays when it is a fact a person needs at the moment of an action (Stripe takes the
payment; nothing was charged) or the plain state of a part (what to connect, what is not open yet). A line goes when
it only apologises, disclaims or repeats: "it never pretends", "set at launch" on every surface, a footnote of
caveats under the plans, the company's legal name in every footer.

## compared with MadeThis (2026-11-11)

From the owner's rrweb recordings (CommandAGI `docs/research/vibestartups.md`; read with
`scripts/research/rrweb-read.mjs`). We take patterns, never their names, words, logos or colours.

| | MadeThis | VibeStartup | verdict |
|---|---|---|---|
| shape | 2 px corners nearly everywhere, hairlines, one shadow (the composer); pills for chips and counts | 0 px, hairlines, rounded corners only on floats; pills for chips, badges and tags | the same direction; ours is stricter, so a rounded corner always means "floats" and a pill always means "a label" |
| the rail | 224 px, 16 links in one flat list; the current one a full-width muted band with a short dark bar | 240 px, 16 tabs in five groups; the current one a wall-to-wall accent band with a full-height line | ours: groups make 16 items scannable |
| chat | the co-founder's words are prose on the page, the founder's a dark block; suggested-reply chips over the composer; an attach button | adopted the prose and the block, and the chips (they write the question, the founder sends) | adopted. Attachments are not built (docs: Files uploads) |
| chat beside every tab | a 400 px chat column stays on every tab | chat is a tab; "ask your co-founder" links open it with the question typed | theirs is better on wide screens; not built yet |
| the phone | a top bar with a menu; chat takes the whole screen | a drawer of every tab and a bottom bar of five | ours: one thumb reaches the four main tabs |
| the wizard | seven segments, one question a screen, a Suggested card with a reason, your own answer always, the build starts before the last step | the same steps and Suggested card; a progress line and bar | equal; starting the build early is theirs and is worth taking |
| loading | a centred setup checklist with a spinner on the current row | the same on the building step; every tab shows a spinner, then offers Try again | equal |
| credits and plans | a banner, a Subscribe button, an "earn" chip, a discount countdown after onboarding | one credits row in the rail; plans show their prices | ours: no upsell noise |
| pages | weight-300 grey text at 10 to 12 px; Ads is a wall of prose | 14 px text at weight 400; Ads is a form and a readiness list | ours |

Not taken, on purpose: the dispute icon on every message, the countdown offers, the serif headings.
Worth taking next (not built): chat docked beside every tab at 1280 and wider; the cost of an action printed on its
button ("Make 3 · about 200 credits"); collapsible Done and Recurring sections in Tasks with counts.
