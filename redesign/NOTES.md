# Notes: the generated media, what it cost, and the scores

## media (fal, 2026-10-26)

Made by `redesign/media.mjs`. The prompts, word for word, are the `FILMS` list in that file; every still prompt ends in
the one art direction (`LOOK`): *35 mm, Portra 400, window light, ivory highlights, charcoal shadows, grain, shallow
depth of field, close crop on the hands, no faces, no text, no logos.*

| film | still (FLUX1.1 [pro] ultra, 16:9, raw) | motion (Kling 2.1 standard, image-to-video, 5 s) | used in |
|---|---|---|---|
| clay | hands centering terracotta on a wheel, overhead; seed 1705042035 | the hands press the clay upward | chapter I break; the OG image |
| press, take 1 | hands pulling a letterpress sheet in tomato ink; seed 1531315882 | **rejected**: the print is made-up letters | — |
| press, take 2 | hands inking a carved lino leaf block; seed 362430995 | **rejected**: made-up letters again on the block | — |
| stitch | hands saddle-stitching a tan leather wallet with tomato thread; seed 774365909 | stitch after stitch, thread drawn tight | chapter II break |
| dough | floured hands shaping a round of dough on a bench; seed 4002648033 | fold and turn, flour drifting | chapter III break |
| parcel, take 1 | hands tying string around a kraft parcel with a card; seed 2367086348 | **rejected**: the card carries made-up handwriting | — |
| parcel, take 2 | the same with no card or label, a sprig of lavender; seed 837611121 | the knot pulled tight, hands rest | chapter IV break |

The lesson for the next set: image models cannot write. Any paper, card or block in a scene comes back with fake
words, so a scene for a page like this has no surface that could carry type.

Cost, from fal's published unit prices (`api.fal.ai/v1/models/pricing`, read the same day): FLUX1.1 [pro] ultra
$0.06 per image × 7 = $0.42; Kling 2.1 standard image-to-video $0.056 per second × 5 s × 7 clips = $1.96.
**Total $2.38** of the $15 budget (three takes rejected). Late frames (4 s) of every used film were checked too.

Encodes (`media/`): AV1 WebM (CRF 38) and H.264 MP4 (CRF 27, faststart) at 1280 px and 24 fps, no audio, graded to
86 % saturation; a WebP poster from the first frame. Raw downloads stay in `redesign/raw/` (gitignored, not deployed).
Each film is captioned on the page: *Generated film. Not a VibeStartup customer.*

## the wordmark, mark and OG image

- `wordmark.svg`: Instrument Serif outlined to paths with fontTools (no font needed to show it), "Vibe" in the
  italic (the co-founder's voice) and "Startup" in the roman, kerned by hand (tight italic, a close e|S join), a
  tomato pen stroke under "Vibe".
- `mark.svg` (favicon) and `touch-icon.png` (180 px): an ink page, the italic V in paper, a tomato bookmark ribbon.
- `og.png` (1200×630): the cover's headline on paper, the gutter, the clay still with a margin note.

## measured (2026-10-26, `test/local.mjs`, Chromium)

- `redesign/shots.py`: 1440, 768, 390, 320, reduced motion at 1440 and 390, es at 1440 and 390, zh at 390. No
  sideways scroll at any width; CLS 0 to 0.08 (the most at 390, the font swap; the wordmark's box was then fixed).
- Throttled 4G (1.6 Mb/s, 150 ms RTT, 4× CPU): LCP 1.09 s at 1440 and 1.04 s at 390 (the cover's h1); 9.9 KB of
  JavaScript before interaction; films load only near the view.
- Contrast on paper: ink 15.2, pencil 5.5, pen 5.6, cobalt 5.7; tomato never sets text on paper.
- `test/journey.mjs --no-chat` (Node 24.22.1 and 22.23.4): PASS at 1440 and 390, now also the sketch and the films'
  captions, posters and sources. The chat's model call was not run here (no model key on this host's local run).

## scores (brief §5.4), from the last screenshot round

| | score | why |
|---|---|---|
| art direction | 8 | one idea held everywhere: paper, ink, the pen; four films of one grade |
| brand specificity | 9 | the italic is the co-founder's voice; margin notes, errata, editions and an ex libris are this brand's alone |
| product expression | 8 | the facing page is the product's day one (name, mark, store, test checkout, tasks) from the visitor's own words |
| interaction | 8 | the sketch (notes change with the kind of business), the contents popover, the ribbon, the running head |
| technical quality | 8 | 10 KB of JS, AV1 + H.264, self-hosted subset fonts, reduced-motion stills, CSP unchanged |
| craft | 8 | outlined and kerned wordmark, old-style figures, real quotes, a designed 320 |

Average 8.2, nothing below 8. Weakest: the cover's right page is quiet below the task list at 1440.
