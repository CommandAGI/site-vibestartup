// The chat's Markdown: what models write renders, and nothing in a message can put markup or a script on the page.
//   node test/md.mjs
import assert from 'node:assert/strict';
import { md } from '../lib/md.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log(`ok ${n} ${name}`); };

// The co-founder's message on production (2026-11-11), as written.
const sol = `Done. All three steps and the playbook rule are written, and I read each file back to confirm.

1. **Pack:** \`Businesses/digitalproduct/products/files/solo-operator-prompt-pack.md\` is written (6099 bytes, text/markdown).
2. **Product file:** \`solo-operator-prompt-pack.product.tsx\` is written.
   - **Drive's answer:** it accepted the file with no refusal or error.
   - Drive only confirms the file was stored.
3. **products.json:** the entry now has a file.

**Still open**
- The storefront copy is not updated yet.
- No payment provider is connected, so the order-by-email flow stays.`;

ok('a real message: bold, code, a numbered list with a nested bulleted one', () => {
  const h = md(sol);
  assert.match(h, /<ol><li><b>Pack:<\/b> <code>Businesses\/digitalproduct\/products\/files\/solo-operator-prompt-pack\.md<\/code>/);
  assert.match(h, /<li><b>Product file:<\/b> <code>solo-operator-prompt-pack\.product\.tsx<\/code> is written\.<ul><li><b>Drive&#39;s answer:<\/b>/);
  assert.match(h, /<\/ul><\/li><li><b>products\.json:<\/b>/);
  assert.match(h, /<p><b>Still open<\/b><\/p><ul><li>The storefront copy/);
  assert.doesNotMatch(h, /\*\*|`/);
});

ok('no HTML from a message reaches the page', () => {
  for (const evil of ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '**<b onclick=x>hi</b>**', '| a |\n|---|\n| <svg onload=x> |', '> <iframe src=//x>', '- <a href="javascript:x">y</a>']) {
    const h = md(evil);
    assert.doesNotMatch(h, /<(script|img|iframe|svg)|<b onclick|<a href="javascript/i, `${evil} → ${h}`);
  }
});

ok('a link keeps only http(s), mailto and same-site addresses', () => {
  assert.match(md('[shop](https://digitalproduct.vibestartup.pro/)'), /<a href="https:\/\/digitalproduct\.vibestartup\.pro\/" target="_blank" rel="noopener nofollow">shop<\/a>/);
  assert.match(md('[mail](mailto:hello@vibestartup.pro)'), /href="mailto:hello@vibestartup\.pro"/);
  assert.match(md('[tasks](/app/?b=x#tab=tasks)'), /href="\/app\/\?b=x#tab=tasks"/);
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,x', '//evil.example/x', 'vbscript:x'])
    assert.doesNotMatch(md(`[x](${bad})`), /<a /, bad);
  assert.doesNotMatch(md('[x](https://a.example/"onmouseover="y)'), /" onmouseover|"onmouseover="y"/);
});

ok('a bare URL is a link, without its closing punctuation', () => {
  const h = md('Your site is live at https://digitalproduct.vibestartup.pro.');
  assert.match(h, /<a href="https:\/\/digitalproduct\.vibestartup\.pro"[^>]*>https:\/\/digitalproduct\.vibestartup\.pro<\/a>\./);
});

ok('code is shown as written: no emphasis or links inside it', () => {
  assert.match(md('run `a **b** https://x.example`'), /<code>a \*\*b\*\* https:\/\/x\.example<\/code>/);
  const h = md('```js\nconst a = "<b>" && 1 < 2;\n```');
  assert.equal(h, '<pre class="md-code" data-lang="js"><code>const a = &quot;&lt;b&gt;&quot; &amp;&amp; 1 &lt; 2;</code></pre>');
});

ok('a message still being written renders: an open fence is a code block', () => {
  assert.match(md('Here:\n```\nline one'), /<pre class="md-code"><code>line one<\/code><\/pre>/);
  assert.match(md('A **half'), /A \*\*half/);
});

ok('headings, rules, quotes, tables and task lists', () => {
  assert.match(md('## Day 1'), /<h4 class="md-h">Day 1<\/h4>/);
  assert.match(md('a\n\n---\n\nb'), /<hr>/);
  assert.match(md('> a **quote**'), /<blockquote><p>a <b>quote<\/b><\/p><\/blockquote>/);
  const t = md('| Product | Price |\n|:--|--:|\n| Pack | $19 |');
  assert.match(t, /<th style="text-align:right">Price<\/th>/);
  assert.match(t, /<td style="text-align:right">\$19<\/td>/);
  assert.match(md('- [x] Logo\n- [ ] Launch post'), /<li class="task"><span class="md-check done" aria-label="done"><\/span>Logo<\/li><li class="task"><span class="md-check" aria-label="not done"><\/span>Launch post<\/li>/);
});

ok('emphasis does not eat snake_case, file names or arithmetic', () => {
  assert.match(md('set task_key and some_file_name.md'), /set task_key and some_file_name\.md/);
  assert.match(md('2 * 3 * 4'), /2 \* 3 \* 4/);
  assert.match(md('*one* and _two_'), /<i>one<\/i> and <i>two<\/i>/);
});

ok('a numbered list keeps its start', () => {
  assert.match(md('3. three\n4. four'), /<ol start="3"><li>three<\/li><li>four<\/li><\/ol>/);
});

console.log(`\n${n} passed`);
