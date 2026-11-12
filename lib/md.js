// Markdown → HTML for what an agent writes (the co-founder's messages, a card's reasoning). Safe by construction: every
// character of the source is escaped before any markup is added, so no HTML in a message ever reaches the page, and a
// link keeps only an http(s), mailto or same-site address. Handles what models write: headings, paragraphs, bold,
// italic, strikethrough, inline and fenced code, links and bare URLs, bulleted, numbered and task lists (nested by
// indent), quotes, rules and GFM tables. A half-written message (streaming) renders too: an open fence is a code block.

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** An href we keep, escaped, or null. */
function safeHref(raw) {
  const u = String(raw).trim().replace(/^<|>$/g, '');
  if (/^(https?:|mailto:)/i.test(u) || /^(\/(?!\/)|#|\.\.?\/)/.test(u)) return esc(u);
  return null;
}

/** Inline markup of one escaped-on-the-way line. Code spans are cut out first, so nothing inside them is formatted. */
export function inline(src) {
  const codes = [];
  let s = String(src).replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, _t, code) => `\u0000${codes.push(code.trim()) - 1}\u0000`);
  const links = [];
  const keep = html => `\u0001${links.push(html) - 1}\u0001`;
  // [text](url) before escaping, so the url is read raw; its text is formatted like any other.
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (all, text, url) => {
    const href = safeHref(url);
    return href ? keep(`<a href="${href}" target="_blank" rel="noopener nofollow">${fmt(esc(text))}</a>`) : all;
  });
  s = s.replace(/<(https?:\/\/[^\s>]+)>/g, (_, url) => keep(`<a href="${esc(url)}" target="_blank" rel="noopener nofollow">${esc(url)}</a>`));
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)'"\]])/g, (_, pre, url) => pre + keep(`<a href="${esc(url)}" target="_blank" rel="noopener nofollow">${esc(url)}</a>`));
  s = fmt(esc(s));
  s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => links[+i]);
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
}

/** Emphasis on escaped text. */
function fmt(s) {
  return s
    .replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<b><i>$1</i></b>')
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<b>$2</b>')
    .replace(/(^|[^*\w])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![*\w])/g, '$1<i>$2</i>')
    .replace(/(^|[^\w])_(?=[^\s_])([^_\n]*?[^\s_])_(?!\w)/g, '$1<i>$2</i>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>');
}

const LIST = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const isTableSep = l => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = l => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));

/** A list starting at line i: nested lists by indent. Returns [html, next index]. */
function list(lines, i) {
  const first = lines[i].match(LIST);
  const base = first[1].length;
  const ordered = /\d/.test(first[2]);
  const start = ordered ? parseInt(first[2], 10) : 1;
  const items = [];
  while (i < lines.length) {
    const m = lines[i].match(LIST);
    if (m && m[1].length === base && /\d/.test(m[2]) === ordered) { items.push({ text: [m[3]], sub: [] }); i++; continue; }
    if (m && m[1].length > base && items.length) { const [html, j] = list(lines, i); items.at(-1).sub.push(html); i = j; continue; }
    if (!m && items.length && lines[i].trim() && /^\s+/.test(lines[i]) && !items.at(-1).sub.length) { items.at(-1).text.push(lines[i].trim()); i++; continue; }
    break;
  }
  const lis = items.map(it => {
    let t = it.text.join(' ');
    const task = t.match(/^\[( |x|X)\]\s+(.*)$/);
    const box = task ? `<span class="md-check${task[1] === ' ' ? '' : ' done'}" aria-label="${task[1] === ' ' ? 'not done' : 'done'}"></span>` : '';
    if (task) t = task[2];
    return `<li${task ? ' class="task"' : ''}>${box}${inline(t)}${it.sub.join('')}</li>`;
  }).join('');
  return [ordered ? `<ol${start !== 1 ? ` start="${start}"` : ''}>${lis}</ol>` : `<ul>${lis}</ul>`, i];
}

/** Markdown to HTML. */
export function md(src) {
  const lines = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  const flush = () => { if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`); para = []; };
  for (let i = 0; i < lines.length;) {
    const l = lines[i];
    const fence = l.match(/^\s*(```|~~~)\s*([\w+-]*)/);
    if (fence) {
      flush();
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]);
      i++;
      out.push(`<pre class="md-code"${fence[2] ? ` data-lang="${esc(fence[2])}"` : ''}><code>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }
    if (!l.trim()) { flush(); i++; continue; }
    const h = l.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) { flush(); const n = Math.min(h[1].length + 2, 6); out.push(`<h${n} class="md-h">${inline(h[2])}</h${n}>`); i++; continue; }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l)) { flush(); out.push('<hr>'); i++; continue; }
    if (/^\s*>/.test(l)) {
      flush();
      const q = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push(`<blockquote>${md(q.join('\n'))}</blockquote>`);
      continue;
    }
    if (l.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flush();
      const head = cells(l);
      const align = cells(lines[i + 1]).map(c => (c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : ''));
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      const td = (tag, c, k) => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ''}>${inline(c ?? '')}</${tag}>`;
      out.push(`<div class="md-table"><table><thead><tr>${head.map((c, k) => td('th', c, k)).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${head.map((_, k) => td('td', r[k], k)).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (LIST.test(l)) { flush(); const [html, j] = list(lines, i); out.push(html); i = j; continue; }
    para.push(l.trim());
    i++;
  }
  flush();
  return out.join('');
}
