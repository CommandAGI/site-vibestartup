// One edge, square corners (docs/DESIGN.md § shape and depth): the elements of the page whose corners are rounded and
// whose edge lines differ from side to side (borders, or an inset shadow line). It runs in the page and answers JSON.
function oneEdge() {
  const out = [];
  const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.classList].map(c => '.' + c).join('') + (el.getAttribute('aria-pressed') ? `[aria-pressed=${el.getAttribute('aria-pressed')}]` : '');
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(k => parseFloat(cs[`border${k}Radius`]) || 0);
    if (!r.some(v => v > 0)) continue;
    const sides = ['Top', 'Right', 'Bottom', 'Left'].map(s => cs[`border${s}Style`] === 'none' || cs[`border${s}Style`] === 'hidden' ? 0 : (parseFloat(cs[`border${s}Width`]) || 0));
    const colors = ['Top', 'Right', 'Bottom', 'Left'].map(s => cs[`border${s}Color`]);
    const why = [];
    if (sides.some(v => v > 0) && new Set(sides).size > 1) why.push(`borders ${sides.join('/')}`);
    else if (sides.some(v => v > 0) && new Set(colors).size > 1 && !/spin/.test(el.className)) why.push(`border colors differ`);
    for (const sh of (cs.boxShadow === 'none' ? [] : cs.boxShadow.split(/,(?![^(]*\))/))) {
      if (!/inset/.test(sh)) continue;
      const nums = sh.replace(/rgba?\([^)]*\)|inset/g, '').trim().split(/\s+/).map(parseFloat).filter(n => !isNaN(n));
      const [x = 0, y = 0, blur = 0, spread = 0] = nums;
      if ((x || y) && blur === 0) why.push(`inset line ${sh.trim()}`);
    }
    if (why.length) out.push(`${name(el)} radius ${r.join('/')}: ${why.join('; ')}`);
  }
  return JSON.stringify([...new Set(out)]);
}
export const ONE_EDGE_SCAN = `(${oneEdge})()`;
