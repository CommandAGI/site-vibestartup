// A small PDF writer, made for the Legal tab's documents: no dependency, no font embedded. Text is set in the PDF's
// standard Helvetica (every reader has it), measured with its Adobe metrics so it wraps exactly; it draws headings,
// paragraphs with **bold** words, lists, checklists, tables, parties, signature lines and notes, breaks pages, and puts
// the business's mark, name and colour on every page with "Page n of N" under it. It runs in the browser and in Node.
//
//   renderPdf({ title, subtitle, business: { name }, brand: { primary, ground, ink }, logo?, blocks }) → Uint8Array
//
// `logo` is an optional JPEG ({ jpeg: Uint8Array, width, height }); without it the mark is drawn the way markSvg
// draws it (lib/business.js): a square of the primary colour and the name's first letter.

// Helvetica and Helvetica-Bold advance widths (1/1000 em), characters 32..126, from the Adobe AFM files.
const W_REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
// WinAnsi bytes above 127 that the documents use, with their widths [regular, bold].
const WIN = { '€': [0x80, 556, 556], '…': [0x85, 1000, 1000], '‘': [0x91, 222, 278], '’': [0x92, 222, 278], '“': [0x93, 333, 500], '”': [0x94, 333, 500], '•': [0x95, 350, 350], '–': [0x96, 556, 556], '—': [0x97, 1000, 1000], '™': [0x99, 1000, 1000], ' ': [0xa0, 278, 278], '§': [0xa7, 556, 556], '©': [0xa9, 737, 737], '®': [0xae, 737, 737], '°': [0xb0, 400, 400], '·': [0xb7, 278, 278], '½': [0xbd, 834, 834], '×': [0xd7, 584, 584] };

const FONTS = { reg: 'F1', bold: 'F2', ital: 'F3' };
const widthOf = (ch, font) => {
  const c = ch.charCodeAt(0);
  const table = font === 'bold' ? W_BOLD : W_REG;
  if (c >= 32 && c <= 126) return table[c - 32];
  if (WIN[ch]) return WIN[ch][font === 'bold' ? 2 : 1];
  const base = ch.normalize('NFKD')[0];
  return base && base !== ch && base.charCodeAt(0) >= 32 && base.charCodeAt(0) <= 126 ? table[base.charCodeAt(0) - 32] : 556;
};
/** One WinAnsi byte (as a char code under 256) per character; an accented Latin letter keeps its byte. */
const winAnsi = s => [...String(s)].map(ch => {
  const c = ch.charCodeAt(0);
  if (c >= 32 && c <= 126) return ch;
  if (WIN[ch]) return String.fromCharCode(WIN[ch][0]);
  if (c >= 0xa0 && c <= 0xff) return ch;
  if (ch === '\t' || ch === '\n') return ' ';
  const base = ch.normalize('NFKD')[0];
  return base && base.charCodeAt(0) < 127 && base.charCodeAt(0) >= 32 ? base : '?';
}).join('');
const pdfString = s => '(' + winAnsi(s).replace(/[\\()]/g, m => '\\' + m) + ')';
export const measure = (s, font, size) => [...String(s)].reduce((a, ch) => a + widthOf(ch, font), 0) * size / 1000;

/** A CSS colour (#rgb, #rrggbb, rgb(), hsl() with spaces or commas) as PDF [r, g, b] in 0..1. */
export function colour(css, fallback = [0.09, 0.09, 0.1]) {
  const s = String(css ?? '').trim();
  let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) { const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1]; return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); }
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (m) return [m[1], m[2], m[3]].map(v => Math.min(1, Number(v) / 255));
  m = s.match(/^hsla?\(\s*([-\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i);
  if (m) {
    const h = ((Number(m[1]) % 360) + 360) % 360 / 360, sat = Number(m[2]) / 100, l = Number(m[3]) / 100;
    if (!sat) return [l, l, l];
    const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat, p = 2 * l - q;
    const hue = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)];
  }
  return fallback;
}
const mix = (c, t) => c.map(v => 1 - (1 - v) * t); // the colour at `t` strength over white
const rg = c => c.map(v => v.toFixed(3)).join(' ');

/** `**bold**` spans in a line of text, as runs. */
export const runsOf = (text, font = 'reg') => String(text ?? '').split('**').map((t, i) => ({ t, font: i % 2 ? 'bold' : font })).filter(r => r.t);

// ---------- layout ----------

const PAGE = { w: 612, h: 792 }; // US Letter
const M = { left: 66, right: 66, top: 104, bottom: 70 };
const INK = [0.09, 0.09, 0.1], INK2 = [0.37, 0.36, 0.4], INK3 = [0.55, 0.54, 0.57], LINE = [0.86, 0.85, 0.82];

export function renderPdf(doc) {
  const primary = colour(doc.brand?.primary, [0.94, 0.33, 0.18]);
  const tint = mix(primary, 0.09);
  const markInk = String(doc.brand?.ground ?? '#ffffff').toLowerCase() === '#ffffff' ? [1, 1, 1] : colour(doc.brand?.ink, [1, 1, 1]);
  const width = PAGE.w - M.left - M.right;
  const pages = [];
  let ops, y;

  const text = (x, yy, s, font = 'reg', size = 10, c = INK) => ops.push(`BT /${FONTS[font]} ${size} Tf ${rg(c)} rg ${x.toFixed(2)} ${yy.toFixed(2)} Td ${pdfString(s)} Tj ET`);
  const fill = (x, yy, w, h, c) => ops.push(`${rg(c)} rg ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  const stroke = (x1, y1, x2, y2, c = LINE, lw = 0.6) => ops.push(`${rg(c)} RG ${lw} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  const box = (x, yy, w, h, c = INK3, lw = 0.8) => ops.push(`${rg(c)} RG ${lw} w ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
  const right = (xr, yy, s, font, size, c) => text(xr - measure(s, font, size), yy, s, font, size, c);

  const mark = (x, top, size) => {
    if (doc.logo?.jpeg) { ops.push(`q ${size} 0 0 ${size} ${x} ${top - size} cm /Im1 Do Q`); return; }
    fill(x, top - size, size, size, primary);
    const letter = (String(doc.business?.name ?? '').trim()[0] || 'V').toUpperCase();
    const fs = size * 0.44;
    text(x + (size - measure(letter, 'bold', fs)) / 2, top - size + size * 0.5 - fs * 0.36, letter, 'bold', fs, markInk);
  };
  const newPage = () => {
    ops = [];
    pages.push(ops);
    fill(0, PAGE.h - 5, PAGE.w, 5, primary);
    mark(M.left, PAGE.h - 34, 22);
    text(M.left + 30, PAGE.h - 49, doc.business?.name ?? '', 'bold', 10.5, INK);
    right(PAGE.w - M.right, PAGE.h - 49, doc.title ?? '', 'reg', 9, INK2);
    stroke(M.left, PAGE.h - 66, PAGE.w - M.right, PAGE.h - 66);
    y = PAGE.h - M.top;
  };
  const room = h => { if (y - h < M.bottom) newPage(); };

  /** Lay runs into lines no wider than `w`: [{ runs: [{t, font}], width }]. */
  const wrap = (runs, size, w) => {
    const words = [];
    for (const r of runs) for (const [i, part] of r.t.split(/(\s+)/).entries()) if (part) words.push({ t: part, font: r.font, space: i % 2 === 1 });
    const lines = []; let line = [], lw = 0;
    for (const word of words) {
      if (word.space) { if (line.length) { line.push({ t: ' ', font: word.font }); lw += measure(' ', word.font, size); } continue; }
      let ww = measure(word.t, word.font, size);
      if (lw + ww > w && line.length) {
        while (line.length && line[line.length - 1].t === ' ') lw -= measure(' ', line.pop().font, size);
        lines.push({ runs: line, width: lw }); line = []; lw = 0;
      }
      // A word longer than the line (a long address or URL) breaks where it must.
      let t = word.t;
      while (ww > w) {
        let n = t.length; while (n > 1 && measure(t.slice(0, n), word.font, size) > w) n--;
        lines.push({ runs: [{ t: t.slice(0, n), font: word.font }], width: measure(t.slice(0, n), word.font, size) });
        t = t.slice(n); ww = measure(t, word.font, size);
      }
      line.push({ t, font: word.font }); lw += ww;
    }
    while (line.length && line[line.length - 1].t === ' ') line.pop();
    if (line.length) lines.push({ runs: line, width: lw });
    return lines;
  };
  const drawLine = (line, x, yy, size, c) => {
    let at = x; let buf = '', font = null;
    const flush = () => { if (buf) { text(at, yy, buf, font, size, c); at += measure(buf, font, size); } buf = ''; };
    for (const r of line.runs) { if (r.font !== font) { flush(); font = r.font; } buf += r.t; }
    flush();
  };
  /** A wrapped paragraph at x with width w; returns nothing, moves y. */
  const para = (runs, { x = M.left, w = width, size = 10, lead = 1.48, c = INK, after = 7 } = {}) => {
    const lh = size * lead;
    for (const line of wrap(runs, size, w)) { room(lh); y -= lh; drawLine(line, x, y + (lh - size) / 2 + size * 0.2, size, c); }
    y -= after;
  };

  const blocks = {
    h(b) { room(16 + 15 * 3); y -= 12; para(runsOf(b.h, 'bold'), { size: 12.5, c: INK, after: 4, lead: 1.3 }); },
    h3(b) { room(10 + 14 * 3); y -= 4; para(runsOf(b.h3, 'bold'), { size: 10.5, after: 3, lead: 1.35 }); },
    p(b) { para(runsOf(b.p, b.italic ? 'ital' : 'reg'), { size: b.size ?? 10, c: b.muted ? INK2 : INK }); },
    list(b) {
      b.list.forEach((item, i) => {
        const label = b.ordered ? `${i + 1}.` : '•';
        const lh = 10 * 1.48; room(lh);
        const top = y;
        text(M.left + 4 + (b.ordered ? 0 : 2), top - lh + (lh - 10) / 2 + 2, label, b.ordered ? 'bold' : 'reg', 10, b.ordered ? INK : primary);
        para(runsOf(item), { x: M.left + 20, w: width - 20, after: 3 });
      });
      y -= 4;
    },
    checks(b) {
      for (const item of b.checks) {
        const lh = 10 * 1.48; room(lh + 4);
        box(M.left + 2, y - lh + 3.2, 8.5, 8.5, primary, 0.9);
        para(runsOf(item), { x: M.left + 20, w: width - 20, after: 5 });
      }
      y -= 2;
    },
    note(b) {
      const lines = wrap(runsOf(b.note), 9.5, width - 28), lh = 9.5 * 1.45, h = lines.length * lh + 16;
      room(h + 6);
      fill(M.left, y - h, width, h, tint); fill(M.left, y - h, 2.5, h, primary);
      let yy = y - 8;
      for (const line of lines) { yy -= lh; drawLine(line, M.left + 14, yy + (lh - 9.5) / 2 + 1, 9.5, INK); }
      y -= h + 10;
    },
    rule() { room(14); y -= 6; stroke(M.left, y, PAGE.w - M.right, y); y -= 8; },
    space(b) { y -= b.space; },
    pagebreak() { newPage(); },
    kv(b) {
      const lw = b.labelWidth ?? 120;
      for (const [k, v] of b.kv) {
        const lines = wrap(runsOf(v), 10, width - lw), lh = 10 * 1.45; room(lines.length * lh + 2);
        text(M.left, y - lh + (lh - 10) / 2 + 1.5, k, 'reg', 9, INK2);
        for (const line of lines) { y -= lh; drawLine(line, M.left + lw, y + (lh - 10) / 2 + 1.5, 10, INK); }
        y -= 2;
      }
      y -= 6;
    },
    parties(b) {
      const n = b.parties.length, gap = 24, cw = (width - gap * (n - 1)) / n, lh = 10 * 1.45;
      const cols = b.parties.map(p => p.lines.filter(Boolean).flatMap(l => wrap(runsOf(l), 10, cw)));
      const h = 16 + Math.max(...cols.map(c => c.length)) * lh;
      room(h + 8);
      b.parties.forEach((p, i) => {
        const x = M.left + i * (cw + gap);
        text(x, y - 9, String(p.label).toUpperCase(), 'bold', 7.5, primary);
        cols[i].forEach((line, j) => drawLine(line, x, y - 16 - (j + 1) * lh + (lh - 10) / 2 + 2, 10, j === 0 ? INK : INK2));
      });
      y -= h + 12;
    },
    table(b) {
      const t = b.table, cols = t.head.length, fr = t.widths ?? Array(cols).fill(1 / cols);
      const ws = fr.map(f => f * width), pad = 6, size = 9.5, lh = size * 1.4;
      const xs = ws.map((_, i) => M.left + ws.slice(0, i).reduce((a, v) => a + v, 0));
      const cell = (s, i, yy, font, c = INK) => {
        const lines = wrap(runsOf(s, font), size, ws[i] - pad * 2);
        lines.forEach((line, j) => {
          const ly = yy - (j + 1) * lh + (lh - size) / 2 + 1.5;
          if (t.align?.[i] === 'r') drawLine(line, xs[i] + ws[i] - pad - line.width, ly, size, c); else drawLine(line, xs[i] + pad, ly, size, c);
        });
        return lines.length;
      };
      const headRow = () => {
        const h = lh + 8; room(h + lh + 8);
        fill(M.left, y - h, width, h, tint);
        t.head.forEach((s, i) => cell(s, i, y - 4, 'bold'));
        y -= h;
      };
      headRow();
      for (const row of t.rows) {
        const n = Math.max(...row.map((s, i) => wrap(runsOf(s), size, ws[i] - pad * 2).length));
        const h = n * lh + 8;
        if (y - h < M.bottom) { newPage(); headRow(); }
        row.forEach((s, i) => cell(s, i, y - 4, 'reg'));
        y -= h; stroke(M.left, y, PAGE.w - M.right, y);
      }
      for (const [k, v, strong] of t.totals ?? []) {
        const h = lh + 6; room(h);
        const font = strong ? 'bold' : 'reg', size2 = strong ? 11 : size;
        if (strong) fill(xs[cols - 2] ?? M.left, y - h - 2, PAGE.w - M.right - (xs[cols - 2] ?? M.left), h + 2, tint);
        right(xs[cols - 1] - pad, y - lh + 1, k, font, size2, strong ? INK : INK2);
        right(PAGE.w - M.right - pad, y - lh + 1, v, font, size2, INK);
        y -= h + (strong ? 2 : 0);
      }
      y -= 10;
    },
    sign(b) {
      const gap = 30, cw = (width - gap) / 2, h = 128;
      for (let i = 0; i < b.sign.length; i += 2) {
        room(h);
        y -= 8;
        b.sign.slice(i, i + 2).forEach((s, j) => {
          const x = M.left + j * (cw + gap);
          text(x, y - 9, String(s.party).toUpperCase(), 'bold', 7.5, primary);
          const rows = [['Signature', ''], ['Name', s.name ?? ''], ...(s.title !== undefined ? [['Title', s.title]] : []), ['Date', '']];
          rows.forEach(([label, value], k) => {
            const ly = y - 42 - k * 24;
            stroke(x + 52, ly - 3, x + cw, ly - 3, INK3, 0.6);
            text(x, ly, label, 'reg', 8.5, INK2);
            if (value) text(x + 56, ly + 0.5, value, 'reg', 10, INK);
          });
        });
        y -= h - 8;
      }
    },
  };

  newPage();
  // The title block on the first page.
  y -= 6;
  for (const line of wrap(runsOf(doc.title ?? '', 'bold'), 22, width)) { y -= 27; drawLine(line, M.left, y, 22, INK); }
  if (doc.subtitle) { y -= 6; para(runsOf(doc.subtitle), { size: 10, c: INK2, after: 0 }); }
  y -= 14;
  for (const b of doc.blocks ?? []) { const kind = Object.keys(blocks).find(k => k in b); if (kind) blocks[kind](b); }

  // The footer, now that the page count is known.
  pages.forEach((p, i) => {
    ops = p;
    stroke(M.left, 48, PAGE.w - M.right, 48);
    text(M.left, 34, `${doc.business?.name ?? ''} · ${doc.title ?? ''}`, 'reg', 8, INK3);
    right(PAGE.w - M.right, 34, `Page ${i + 1} of ${pages.length}`, 'reg', 8, INK3);
  });
  return write(pages, doc);
}

// ---------- the file ----------

function write(pages, doc) {
  const objects = []; // [index] = body string (char codes < 256)
  const add = body => { objects.push(body); return objects.length; };
  const catalog = add(null), pagesObj = add(null);
  const fontObj = Object.entries({ F1: 'Helvetica', F2: 'Helvetica-Bold', F3: 'Helvetica-Oblique' }).map(([k, base]) => [k, add(`<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`)]);
  let image = null;
  if (doc.logo?.jpeg) {
    const bytes = doc.logo.jpeg; let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    image = add(`<< /Type /XObject /Subtype /Image /Width ${doc.logo.width} /Height ${doc.logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bin.length} >>\nstream\n${bin}\nendstream`);
  }
  const resources = `<< /Font << ${fontObj.map(([k, n]) => `/${k} ${n} 0 R`).join(' ')} >>${image ? ` /XObject << /Im1 ${image} 0 R >>` : ''} >>`;
  const kids = pages.map(ops => {
    const stream = ops.join('\n');
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    return add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources ${resources} /Contents ${content} 0 R >>`);
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const d = doc.date instanceof Date ? doc.date : new Date();
  const pad = n => String(n).padStart(2, '0');
  const stamp = `D:${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const info = add(`<< /Title ${pdfString(doc.title ?? '')} /Author ${pdfString(doc.business?.name ?? '')} /Creator ${pdfString(doc.creator ?? 'VibeStartup')} /Producer (VibeStartup lib/pdf.js) /CreationDate (${stamp}) >>`);

  let out = '%PDF-1.4\n%âãÏÓ\n';
  const offsets = objects.map((body, i) => { const at = out.length; out += `${i + 1} 0 obj\n${body}\nendobj\n`; return at; });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
}
