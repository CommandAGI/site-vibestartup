# The redesign's look-at-it step (brief §5.4): full-page screenshots at 1440, 768, 390 and 320, and 1440 and 390 with
# reduced motion, of the landing in every locale and of the account page. Also measures sideways scroll and the
# page's layout shift. Output in .test-results/redesign/ (gitignored).
#
#   python3 redesign/shots.py [base-url]        default http://127.0.0.1:4187 (node test/local.mjs --port 4187)
import json, os, sys
from playwright.sync_api import sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4187'
out = os.path.join(os.path.dirname(__file__), '..', '.test-results', 'redesign')
os.makedirs(out, exist_ok=True)
CLS = """new Promise(r => { let v = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) v += e.value; })
  .observe({ type: 'layout-shift', buffered: true }); setTimeout(() => r(v), 300); })"""
report = []
with sync_playwright() as p:
    b = p.chromium.launch()
    runs = [(w, 'no-preference', path) for w in (1440, 768, 390, 320) for path in ('/',)]
    runs += [(1440, 'reduce', '/'), (390, 'reduce', '/'), (1440, 'no-preference', '/es/'), (390, 'no-preference', '/zh/'), (390, 'no-preference', '/es/')]
    for w, motion, path in runs:
        ctx = b.new_context(viewport={'width': w, 'height': 900 if w > 500 else 844}, reduced_motion=motion, device_scale_factor=1)
        pg = ctx.new_page()
        pg.goto(base + path, wait_until='networkidle')
        pg.wait_for_timeout(6500)  # the cover types its line, then sketches and writes the margin
        name = f"{path.strip('/') or 'en'}-{w}{'-reduced' if motion == 'reduce' else ''}"
        pg.screenshot(path=os.path.join(out, f'{name}-fold.png'))
        cls = pg.evaluate(CLS)
        h = pg.evaluate('document.documentElement.scrollHeight')
        # each chapter as a reader meets it: scrolled to, with its scroll-driven ink run
        for i, sel in enumerate(['.film[data-film=clay]', '#how', '#what', '#honest', '.film[data-film=dough]', '#plans', '#account', '.colophon']):
            pg.evaluate(f"document.querySelector('{sel}').scrollIntoView({{block: 'start', behavior: 'instant'}}); window.scrollBy({{top: -60, behavior: 'instant'}})")
            pg.wait_for_timeout(500)
            pg.screenshot(path=os.path.join(out, f'{name}-s{i}.png'))
        # the whole page as a contact sheet: Chromium's full-page capture does not advance view() timelines, so the
        # sheet is taken with animations finished
        pg.add_style_tag(content='*, *::before, *::after { animation: none !important; }')
        pg.evaluate('window.scrollTo(0, 0)'); pg.wait_for_timeout(300)
        pg.screenshot(path=os.path.join(out, f'{name}-full.png'), full_page=True)
        sideways = pg.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
        report.append({'page': name, 'cls': round(cls, 4), 'sideways': sideways, 'height': h})
        ctx.close()
    b.close()
print(json.dumps(report, indent=1))
