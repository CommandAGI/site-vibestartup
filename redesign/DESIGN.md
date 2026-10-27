# VibeStartup, 2027: the book of a business

*The designer's spec: an editorial book designer. Binding brief: CommandAGI `docs/design/startup-redesign-2027.md` §4.*

## concept

A business is written into existence. The page is a founder's notebook bound as a book. The founder writes in roman
type; the AI co-founder answers in the margins, in italic, in the editor's tomato pen, and it pushes back. Beside the
writing, on the facing page, the business takes form: its name, its mark, a storefront, a checkout, a task list.
Between chapters the book opens onto film: hands making small things. The page never shouts. It is set, not styled.

## type

- **Instrument Serif** (display; the roman is the founder, the italic is the co-founder), **Instrument Sans**
  (text, variable: `wght` 400–700 and `wdth` 75–100; the condensed width sets folios, running heads and labels).
  Self-hosted, Latin and Latin Extended subsets, `font-display: swap`, metric-matched fallbacks (`size-adjust`).
- Scale: a book's, ratio 1.333 (perfect fourth) from 18 px body at 1440 (17 px at 390); the hero numeral and chapter
  titles jump off the scale on purpose (clamp to 22 vw).
- Old-style figures in prose (`onum`), lining tabular in folios (`lnum tnum`). Real quotes, en and em dashes,
  `text-wrap: balance` on headings, `pretty` on paragraphs, `hanging-punctuation` where supported.

## colour (OKLCH in the CSS; sRGB hex here, contrast on paper measured with WCAG 2.x)

| token | value | use | contrast on paper |
|---|---|---|---|
| paper | #fff8e9 | the page | — |
| ink | #212121 | text, rules, the primary button | 15.2 |
| pencil | #6b645a | captions, folios | 5.5 |
| tomato | #f36c50 | the editor's pen: strokes, the ribbon, ticks; text only on ink (5.4) | 2.8 (never text on paper) |
| pen | #b23a22 | the co-founder's margin notes as text | 5.6 |
| cobalt | #2752ed | links in running text, the focus ring, used sparingly | 5.7 |

Paper has a grain (an inline SVG `feTurbulence`, 2 % opacity), never a gradient. Light only: a book on a desk.

## layout

- **1440 and 2560**: a spread. A 12-column grid inside a centred measure of 1360 px; the left page (5 cols), the gutter
  (a 1 px rule and a soft fold shadow), the right page (5 cols), and the outer margin (2 cols) for the co-founder's
  notes. At 2560 the spread stays 1360 and the paper grows around it.
- **768**: one page with a narrow outer margin; notes sit in the margin column at 9 rem.
- **390**: one column. Notes fall inline under the line they answer, indented with a tomato rule on the left. The
  running head is the brand, a Contents button and Start. The films are 4:5 crops.
- **320**: the same as 390 with the hero numeral down to 7 rem, form fields full width, and no horizontal scroll.
- Radius language: **zero**. Corners are paper corners; one dog-ear on the bookplate.
- Nav pattern: a **running head** (brand · the current chapter in italic · folio links) and a **Contents** popover
  that lists the chapters with their numerals, like a book's table of contents.
- Buttons: set in Instrument Sans condensed caps; primary is a solid ink block whose underline is a tomato pen stroke
  that draws in on hover and focus; secondary is a plain word with a double rule under it. No shadow, no radius.

## motion grammar: ink

Things are *written*, not slid. Strokes draw (`stroke-dashoffset`), words ink in (opacity and a 2 px blur clearing),
ticks are pen marks. Speeds are a calm hand: 600–900 ms, `cubic-bezier(.2,.7,.1,1)`.

- A tomato **bookmark ribbon** in the running head grows with the page's scroll (`animation-timeline: scroll(root)`).
- Margin notes ink in as their line enters the view (`animation-timeline: view()`).
- The week chapter: a sticky day numeral, and each day's line inks in as it passes.
- Films: muted, looped, `playsinline`, poster first, `preload="none"` below the first screen, played only while seen.
- **Reduced motion**: no ribbon growth (a full static ribbon), notes and lines shown at once, films replaced by their
  poster stills, the sketch appears whole (no typing). Nothing flashes.

## media plan (fal, through `redesign/media.mjs`; costs in `NOTES.md`)

Four films, five seconds each, hands only, no faces, no logos, no text: clay on a wheel (chapter break after the
cover), a letterpress pull (before "what your co-founder does"), dough on a bench (before the editions), a parcel tied
with string (before signing the first page). Art direction: 35 mm, Portra warmth, ivory highlights, charcoal shadows,
grain, close crops, locked camera, slow. Graded down in saturation in the encode so they sit on the paper. Stills by
FLUX1.1 [pro] ultra, motion by Kling 2.1 standard image-to-video. AV1 WebM plus H.264 MP4 at 1280 px, WebP posters.
Every film carries a caption: *Generated film. Not a VibeStartup customer.*

## the signature: the first page writes itself

On the cover the founder's line is typed into the notebook ("A camera-enabled desk lamp…"). Across the gutter the
facing page sketches the business from it: a name, a mark, a one-product storefront with a price the founder sets, a
checkout in test mode and four tasks. In the margin the co-founder writes back: *Who buys the first one? Name three
people.* The visitor can write their own idea and press **Sketch the first page**; the sketch is made by a script in
their browser, labeled as such, announced through `aria-live`, and nothing is sent. The real co-founder starts when
they sign the first page.

## sections (chapters)

0. Cover: the headline, the notebook line, the facing page, the margin. Start / How it works.
1. Film: clay. *I. Day one.*
2. The week: the four steps of the plan, then the seven days of launch week, scroll-inked.
3. Film: the press. *II. What your co-founder does.*
4. The index: the six capabilities as a book index (term, leaders, where it stops).
5. Errata: what you get, and what you don't, as a corrected proof.
6. Film: dough. *III. Editions.*
7. Editions: Starter, Growth, Scale; prices set at launch.
8. Film: the parcel. *IV. Sign the first page.*
9. The bookplate: create an account (and sign in).
10. Colophon: the footer, with the language picker.

## don'ts

No cards, no rounded rectangles, no shadows under boxes, no gradient text, no icons in squares, no centred hero with
two pill buttons, no logo cloud, no testimonials, no "most popular". No tomato text on paper. No faces in the films.
