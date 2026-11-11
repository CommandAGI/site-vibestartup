// The shape rules of docs/DESIGN.md § shape and depth, checked in the page on its final cascade. It answers JSON.
//
// 1. Square shapes. What floats over the page is rounded (a dialog, a menu), a chip, a badge and a tag are pills, and a
//    few things are round by nature (a person's avatar, a switch, a spinner, a status dot). Any other rounded element
//    is a problem: a button, a field, a card, a panel and a row stay square.
// 2. One edge, square corners. On the rounded things that remain, a corner fails when the lines of its two edges differ
//    (a border, or an inset shadow line offset to one edge): a line on one edge curves up at its ends on a rounded
//    corner. Everything else is square, so a one-edge line (the rail's current-tab bar, a tab's underline, a notice's
//    start line) is legal there.
function shapes() {
  const out = [];
  const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.classList].map(c => '.' + c).join('') + (el.getAttribute('aria-pressed') ? `[aria-pressed=${el.getAttribute('aria-pressed')}]` : '');
  // What may be rounded: floats, pills, and the round by nature.
  const ROUNDED = 'dialog, .menu, .top-menu, .toast, .chip, .badge, .eyebrow, .traits span, .avatar, .switch i, .spin, .dot, #building li i';
  const SIDES = ['Top', 'Right', 'Bottom', 'Left'];
  // Corner → its two edges, as indexes into SIDES.
  const CORNERS = { TopLeft: [0, 3], TopRight: [0, 1], BottomRight: [2, 1], BottomLeft: [2, 3] };
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const radius = Object.fromEntries(Object.keys(CORNERS).map(k => [k, parseFloat(cs[`border${k}Radius`]) || 0]));
    if (!Object.values(radius).some(v => v > 0)) continue;
    // An svg's own shapes are a drawing (a business's mark), not a shape of the page.
    if (el.closest('svg')) continue;
    if (!el.matches(ROUNDED)) { out.push(`${name(el)}: rounded (${Math.max(...Object.values(radius))}px) where shapes are square`); continue; }
    const line = SIDES.map(s => (cs[`border${s}Style`] === 'none' || cs[`border${s}Style`] === 'hidden') ? 0 : (parseFloat(cs[`border${s}Width`]) || 0));
    // An inset shadow with no blur that is offset adds a line along the edge it is offset towards.
    for (const sh of (cs.boxShadow === 'none' ? [] : cs.boxShadow.split(/,(?![^(]*\))/))) {
      if (!/inset/.test(sh)) continue;
      const [x = 0, y = 0, blur = 0] = sh.replace(/[a-z-]+\([^)]*\)|inset|#[0-9a-f]+/gi, ' ').trim().split(/\s+/).map(parseFloat).filter(n => !isNaN(n));
      if (blur !== 0) continue;
      if (y > 0) line[0] += y; if (y < 0) line[2] += -y; if (x > 0) line[3] += x; if (x < 0) line[1] += -x;
    }
    const bad = Object.entries(CORNERS).filter(([k, [a, b]]) => radius[k] > 0 && line[a] !== line[b]).map(([k]) => k);
    if (bad.length) out.push(`${name(el)}: rounded ${bad.join(', ')} where edge lines ${line.join('/')} (top/right/bottom/left) differ`);
  }
  return JSON.stringify([...new Set(out)]);
}
export const SHAPE_SCAN = `(${shapes})()`;
