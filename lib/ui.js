// Shared UI: icons (inline SVG, 24-unit grid), toasts, dialogs, menus and formatting. No framework.
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const h = (strings, ...values) => strings.reduce((out, s, i) => out + s + (i < values.length ? (values[i] instanceof Raw ? values[i].s : esc(values[i])) : ''), '');
class Raw { constructor(s) { this.s = s; } }
export const raw = s => new Raw(String(s ?? ''));

export const money = (n, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(n) || 0);
export const num = n => new Intl.NumberFormat('en-US').format(Number(n) || 0);
export const plural = (n, w, ws) => `${num(n)} ${n === 1 ? w : (ws ?? w + 's')}`;
export const when = at => { const d = new Date(at); return isNaN(d) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
export const day = at => { const d = new Date(at); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); };
export const time = at => { const d = new Date(at); return isNaN(d) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); };
export function ago(at) {
  const s = Math.max(0, (Date.now() - new Date(at).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 14) return `${Math.round(s / 86400)} d ago`;
  return day(at);
}
export const initial = s => (String(s ?? '').trim()[0] || '?').toUpperCase();
export const slugify = s => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
export const bytes = n => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;

// ---------- icons ----------
const P = {
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z',
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 11h7v9h-7zM4 14h7v6H4z',
  analytics: 'M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6',
  tasks: 'M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9',
  email: 'M4 6h16v12H4zM4 7l8 6 8-6',
  products: 'M20 7l-8-4-8 4 8 4 8-4zM4 7v10l8 4 8-4V7M12 11v10',
  orders: 'M6 2h12l2 5H4zM4 7v13h16V7M9 11a3 3 0 0 0 6 0',
  customers: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  ads: 'M3 11l18-7-7 18-2-7-9-4z',
  studio: 'M12 3l2.4 5 5.6.8-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6-4-3.9 5.6-.8z',
  outbound: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  social: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  files: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8',
  legal: 'M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  more: 'M12 12h.01M19 12h.01M5 12h.01',
  x: 'M18 6L6 18M6 6l12 12',
  check: 'M20 6L9 17l-5-5',
  arrow: 'M5 12h14M12 5l7 7-7 7',
  back: 'M19 12H5M12 19l-7-7 7-7',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  paperclip: 'M21 11.5l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  copy: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15',
  external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3',
  play: 'M5 3l14 9-14 9V3z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  lock: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20',
  home: 'M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  card: 'M2 5h20v14H2zM2 10h20',
  gift: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  sparkle: 'M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8zM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  warn: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  menu: 'M3 12h18M3 6h18M3 18h18',
  chevron: 'M6 9l6 6 6-6',
  image: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  video: 'M23 7l-7 5 7 5V7zM14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
  store: 'M3 9l1-5h16l1 5M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 9v12h14V9M9 21v-6h6v6',
  key: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15 8m0 0l3 3L22 7l-3-3',
  calendar: 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  shield: 'M12 22s8-4 8-10V5l-8-3-4 1.5L4 5v7c0 6 8 10 8 10z',
  rocket: 'M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8-.8-.7-2-.7-2.8 0zM12 15l-3-3a22 22 0 0 1 2-3.9A12.5 12.5 0 0 1 22 2c0 2.7-.9 7.6-6 11a22 22 0 0 1-4 2zM9 12H4s.6-3.3 2-4.5c1.6-1.4 5 0 5 0M12 15v5s3.3-.6 4.5-2c1.4-1.6 0-5 0-5',
  dollar: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
};
export const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[name] ?? P.info}"/></svg>`;

// ---------- soon ----------
/** A feature that is on its way wears one small pill. It never apologises: the control is there, and it opens soon. */
export const soon = (label = 'Soon') => `<span class="badge soon">${esc(label)}</span>`;
/** A control that opens soon: its real label, not yet pressable, with the pill. `attrs` keeps its id for the day it opens. */
export const soonButton = (label, cls = 'btn quiet', attrs = '') => `<button type="button" class="${cls} is-soon" disabled aria-disabled="true" ${attrs}>${esc(label)}${soon()}</button>`;

// ---------- toasts ----------
let toastRoot = null;
export function toast(text, kind = '') {
  if (!toastRoot) { toastRoot = document.createElement('div'); toastRoot.className = 'toasts'; toastRoot.setAttribute('aria-live', 'polite'); document.body.append(toastRoot); }
  const el = document.createElement('div');
  el.className = `toast ${kind}`; el.textContent = text;
  toastRoot.append(el);
  setTimeout(() => el.remove(), 4200);
  return el;
}

// ---------- dialogs ----------
/** A modal on a deep soft shadow. `render(dialog)` fills it; the returned handle closes it. Esc and the backdrop close. */
export function modal(html, { label = 'Dialog', onClose } = {}) {
  const d = document.createElement('dialog');
  d.className = 'modal'; d.setAttribute('aria-label', label);
  d.innerHTML = `<div class="modal-body">${html}</div>`;
  document.body.append(d);
  d.addEventListener('click', e => { if (e.target === d) d.close(); });
  d.addEventListener('close', () => { onClose?.(d.returnValue); d.remove(); });
  d.showModal();
  return { el: d, close: v => d.close(v ?? '') };
}
export function confirm(text, { title = 'Are you sure?', ok = 'Confirm', danger = false } = {}) {
  return new Promise(resolve => {
    const m = modal(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p><div class="modal-actions"><button class="btn quiet" value="cancel">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" value="ok">${esc(ok)}</button></div>`, { title, onClose: v => resolve(v === 'ok') });
    $$('.modal-actions button', m.el).forEach(b => b.onclick = () => m.close(b.value));
  });
}
export function prompt(text, { title = 'Enter', ok = 'Save', value = '', placeholder = '', multiline = false, type = 'text' } = {}) {
  return new Promise(resolve => {
    const m = modal(`<h2>${esc(title)}</h2>${text ? `<p class="muted">${esc(text)}</p>` : ''}<label class="field"><span class="sr-only">${esc(title)}</span>${multiline ? `<textarea name="v" placeholder="${esc(placeholder)}">${esc(value)}</textarea>` : `<input name="v" type="${esc(type)}" value="${esc(value)}" placeholder="${esc(placeholder)}"${type === 'password' ? ' autocomplete="current-password"' : ''}>`}</label><div class="modal-actions"><button class="btn quiet" value="cancel">Cancel</button><button class="btn primary" value="ok">${esc(ok)}</button></div>`, { title, onClose: () => resolve(null) });
    const input = $('[name=v]', m.el); input.focus();
    $$('.modal-actions button', m.el).forEach(b => b.onclick = () => { if (b.value === 'ok') { const v = input.value; m.el.removeEventListener('close', null); resolve(v); } m.close(b.value); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !multiline) { resolve(input.value); m.close('ok'); } });
  });
}

// ---------- menus ----------
/** A small menu under `anchor`. `items`: [{ label, icon?, onClick, danger? }] or 'hr'. */
export function menu(anchor, items) {
  $$('.menu').forEach(m => m.remove());
  const m = document.createElement('div'); m.className = 'menu'; m.setAttribute('role', 'menu');
  m.innerHTML = items.map(it => it === 'hr' ? '<hr>' : `<button type="button" role="menuitem" ${it.danger ? 'style="color:var(--bad)"' : ''}>${it.icon ? icon(it.icon, 16) : ''}<span>${esc(it.label)}</span></button>`).join('');
  document.body.append(m);
  const r = anchor.getBoundingClientRect();
  // Under the anchor; above it when the window ends first (the account menu at the foot of the rail).
  const below = r.bottom + 2 + m.offsetHeight <= innerHeight;
  m.style.top = `${(below ? r.bottom + 2 : Math.max(8, r.top - 2 - m.offsetHeight)) + scrollY}px`;
  m.style.left = `${Math.max(8, Math.min(r.left + scrollX, innerWidth - m.offsetWidth - 12))}px`;
  const buttons = $$('button', m); let i = 0;
  items.filter(it => it !== 'hr').forEach((it, k) => { buttons[k].onclick = () => { m.remove(); it.onClick?.(); }; });
  const away = e => { if (!m.contains(e.target) && e.target !== anchor) { m.remove(); document.removeEventListener('pointerdown', away); } };
  setTimeout(() => document.addEventListener('pointerdown', away), 0);
  m.addEventListener('keydown', e => { if (e.key === 'Escape') { m.remove(); anchor.focus(); } if (e.key === 'ArrowDown') { i = (i + 1) % buttons.length; buttons[i].focus(); } if (e.key === 'ArrowUp') { i = (i - 1 + buttons.length) % buttons.length; buttons[i].focus(); } });
  buttons[0]?.focus();
  return m;
}

/** Copy text and say so. */
export async function copy(text, what = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(what, 'ok'); } catch { toast('Copy it by hand: ' + text); }
}
/** Run `fn` with the button busy (a spinner, no double clicks). */
export async function busy(button, fn) {
  const was = button.innerHTML; button.disabled = true; button.innerHTML = `<span class="spin"></span>${was}`;
  try { return await fn(); } finally { button.disabled = false; button.innerHTML = was; }
}
/** The error's message, for a person. */
export const oops = e => e?.message || String(e);
