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

- Radii: controls 8 px, cards 12 px, panels and sheets 16 px, the hero prompt box 20 px, buttons pills (999 px).
- Hairlines (`--line`) separate; shadows float: only the prompt box, popovers, menus and dialogs carry
  `--shadow-float`; every modal sits on `--shadow-modal` (a deep soft shadow). Cards do not float.
- Buttons: `.btn` pill; `.btn.primary` accent on white text; `.btn.quiet` surface with a hairline; `.btn.ghost` text
  only; `.btn.danger` outline in `--bad` (a row's remove is a trash icon with a tooltip, never red text).
- Toolbars use icon buttons with tooltips (`title` and `aria-label`); rare actions sit in a ⋯ menu.
- One edge, square corners (owner, 2026-11-03; CommandAGI's `docs/regions.md` § one edge, square corners). A line on
  only some edges (an accent bar, an underline, a tab's pressed line, an inset shadow line) curves up at its ends on a
  rounded element. A rounded element is outlined on every edge or on none; a one-edge line goes on a square element, or
  is its own element beside the rounded one (the console rail's current-tab bar). A card that must stand out is
  outlined whole in its tint (`.approval`, `.milestone`). Check the final cascade, not one rule:
  the journey scans the page at every screenshot (`test/edges.mjs`).

## layout

- **Landing**: a 64 px sticky header (wordmark, Product, How it works, Pricing, FAQ; Sign in; Start free pill). Hero:
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
  then credits and the account menu), a 56 px top bar (the tab's title, its actions as icon buttons), the content at
  max 1120 px; the Chat tab has a 320 px right panel ("Building": the site's state, the brand kit, what needs you,
  the blueprint). At 768 the rail collapses to icons (64 px). At 390 the rail becomes a bottom bar of five (Chat,
  Dashboard, Tasks, Files, More) and More opens a sheet with the rest; the right panel becomes a section above the
  chat that folds.
- Mobile is designed: 44 px targets, 16 px gutters, no sideways scroll at 390 and 320, forms full width.

## motion

Short and physical: 160 ms ease-out for hover and open, 220 ms for sheets, `@starting-style` fades for new rows.
The hero's sketch inks in field by field (opacity + 4 px rise, 320 ms). Reduced motion: nothing moves.

## signature

Type an idea; the business sketches itself under the box, then the Start button says "Start building <Name>". The
same box, with the same sketch, is the first screen of the wizard and the "New business" card at home.

## don'ts

No invented founders, numbers, logos or quotes. No stock photos of people. No "most popular" badge until prices
exist. No red text for destructive actions. No second accent. No drop shadows on cards. No walls of text: a section
says one thing. The co-founder never pretends a provider is connected.
