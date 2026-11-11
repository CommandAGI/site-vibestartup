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
| buttons, inputs, chips, badges, cards, panels, list rows, tabs, chat blocks, the idea box, the composer | 0 | none (the idea box alone keeps `--shadow-float`: it is the signature) |
| a dialog, a menu, the landing's phone menu | `--r-float` (14 px) | `--shadow-modal` for a dialog, `--shadow-float` for a menu |
| a toast, a tooltip | `--r-tip` (8 px) | `--shadow-float` on a toast |
| round by nature: a person's or the co-founder's avatar, a switch, a spinner, a status dot | round | none |

- **Square shapes.** Everything on the page is square. Hairlines (`--line`) separate; no card floats.
- **Rounding means "this floats".** Only what opens over the page is rounded and carries a shadow: dialogs, menus,
  toasts, tooltips. The phone's drawer is attached to the window's edge, so it is square.
- **A selection is a band from wall to wall.** A row of the rail, a menu, a list, the search results or the mail
  folders has no margin around its background and no rounded highlight: hover is a `--surface-2` band, the current row
  is an `--accent-soft` band with a 2 px accent line on its start edge (an inset shadow). The container has no side
  padding; the row pads its own text. A `.list` is one bordered surface whose rows run wall to wall.
- **One edge, square corners** (owner, 2026-11-03). A line on one edge only (the current row's accent line, a subtab's
  underline, a notice's or an approval's start line) is legal on any square element, which is now every element. On the
  rounded ones that remain, the outline is the same on every edge or absent.
- Buttons: `.btn` square, 40 px high (44 px on a phone); `.btn.primary` accent with white text; `.btn.quiet` surface
  with a hairline; `.btn.ghost` text only; `.btn.danger` outline in `--bad` (a row's remove is a trash icon with a
  tooltip, never red text).
- Notices (`.note`) and the cards that need a call (`.approval`, `.milestone`) carry a start line in their tint.
- Toolbars use icon buttons with tooltips (`title` and `aria-label`); rare actions sit in a ⋯ menu. A menu opens 2 px
  from its trigger, above it when the window ends first.
- The journey scans the final cascade at every screenshot (`test/edges.mjs`): an element that is rounded and is not
  on the list above is a problem, and so is a rounded one whose edges carry different lines.

## layout

- **Landing**: a 64 px sticky header (wordmark, Product, How it works, Pricing, FAQ; Sign in; Start free). Hero:
  headline, one sentence, the idea box (textarea, example chips below, "Start building" inside the box), then the
  business sketch that grows under it as the visitor types (name, brand colours, storefront card, launch week): made
  by a script in the browser, labelled so. Then: how it works (three steps), the console in a framed window (an
  illustrative console, labelled), the launch week (seven days), what the co-founder does (eight cards, one per
  capability, each honest about where it stops), what you get and don't, plans (prices set at launch), FAQ, footer.
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
- **A view never stays blank** (owner, 2026-11-11: Billing "did not load at first"). A tab shows a spinner and
  "Loading…" at once; after 10 s the line offers Try again; then the tab's content, or what went wrong and Try again.
  A page whose words need no answer (Billing: the plans) paints at once and fills each number when its own call
  answers. A tab that answers after the founder left it writes into nothing (`route()` in `app/console.js`).

## motion

Short and physical: 160 ms ease-out for hover and open, 220 ms for the drawer, `@starting-style` fades for new rows.
The hero's sketch inks in field by field (opacity + 4 px rise, 320 ms). Reduced motion: nothing moves.

## signature

Type an idea; the business sketches itself under the box, then the Start button says "Start building <Name>". The
same box, with the same sketch, is the first screen of the wizard and the "New business" card at home.

## don'ts

No invented founders, numbers, logos or quotes. No stock photos of people. No "most popular" badge until prices
exist. No red text for destructive actions. No second accent. No drop shadows on cards. No pill buttons, no rounded
cards, no rounded or inset highlight on a chosen row. No walls of text: a section
says one thing. The co-founder never pretends a provider is connected.

## compared with MadeThis (2026-11-11)

From the owner's rrweb recordings (CommandAGI `docs/research/vibestartups.md`; read with
`scripts/research/rrweb-read.mjs`). We take patterns, never their names, words, logos or colours.

| | MadeThis | VibeStartup | verdict |
|---|---|---|---|
| shape | 2 px corners nearly everywhere, hairlines, one shadow (the composer); pills for chips and counts | 0 px, hairlines, rounding only on floats | the same direction; ours is stricter, so "rounded" always means "floats" |
| the rail | 224 px, 16 links in one flat list; the current one a full-width muted band with a short dark bar | 240 px, 16 tabs in five groups; the current one a wall-to-wall accent band with a full-height line | ours: groups make 16 items scannable |
| chat | the co-founder's words are prose on the page, the founder's a dark block; suggested-reply chips over the composer; an attach button | adopted the prose and the block, and the chips (they write the question, the founder sends) | adopted. Attachments are not built (docs: Files uploads) |
| chat beside every tab | a 400 px chat column stays on every tab | chat is a tab; "ask your co-founder" links open it with the question typed | theirs is better on wide screens; not built yet |
| the phone | a top bar with a menu; chat takes the whole screen | a drawer of every tab and a bottom bar of five | ours: one thumb reaches the four main tabs |
| the wizard | seven segments, one question a screen, a Suggested card with a reason, your own answer always, the build starts before the last step | the same steps and Suggested card; a progress line and bar | equal; starting the build early is theirs and is worth taking |
| loading | a centred setup checklist with a spinner on the current row | the same on the building step; every tab shows a spinner, then offers Try again | equal |
| credits and plans | a banner, a Subscribe button, an "earn" chip, a discount countdown after onboarding | one credits row in the rail; plans say "set at launch" | ours: no upsell noise |
| pages | weight-300 grey text at 10 to 12 px; Ads is a wall of prose | 14 px text at weight 400; Ads is a form and a readiness list | ours |

Not taken, on purpose: the dispute icon on every message, the countdown offers, the serif headings.
Worth taking next (not built): chat docked beside every tab at 1280 and wider; the cost of an action printed on its
button ("Make 3 · about 200 credits"); collapsible Done and Recurring sections in Tasks with counts.
