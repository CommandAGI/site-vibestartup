// The rail's tree: a tab with levels of its own (a business's chats, the views of Analytics, the folders of Email …)
// opens under its row while it is the tab shown, and is closed otherwise. One component for every such tab: the
// children, a "More" that loads the next page, an action row ("New chat"), and the child shown marked
// (aria-current). Keys: ↑ and ↓ move, Home and End go to the ends, → opens a closed tab or goes to its first child,
// ← goes from a child to its tab. Only one row is in the Tab order (roving focus), so Tab leaves the rail at once.
import { esc, icon } from '/lib/ui.js';

/**
 * One row of the rail, and its children when it is open. `current` is true for the tab shown, 'true' for the tab whose
 * child is shown (the child is then the page).
 * `kids` (null for a tab with no levels): { open, label, items: [{ key, href, label, meta, current }], more, loading,
 * empty, action: { key, label, icon } }.
 */
export function branch({ id, href, label, ico, current, title, count, kids }) {
  const has = !!kids;
  const sub = `sub-${id}`;
  const row = `<a href="${esc(href)}" data-tab="${esc(id)}" data-key="tab:${esc(id)}" title="${esc(title ?? label)}"${current ? ` aria-current="${current === true ? 'page' : esc(current)}"` : ''}${has ? ` aria-expanded="${kids.open}"${kids.open ? ` aria-controls="${sub}"` : ''}` : ''}>${icon(ico)}<span>${esc(label)}</span>${count ? `<span class="count">${count}</span>` : ''}${has ? `<i class="caret" aria-hidden="true">${icon('chevron', 14)}</i>` : ''}</a>`;
  if (!has || !kids.open) return row;
  const items = kids.items.map(k => `<li><a class="sub-item" href="${esc(k.href)}" data-key="${esc(k.key)}"${k.current ? ' aria-current="page"' : ''}><span>${esc(k.label)}</span>${k.meta ? `<small>${esc(k.meta)}</small>` : ''}</a></li>`).join('');
  const state = kids.loading && !kids.items.length ? `<li class="sub-note" role="status">Loading…</li>` : !kids.items.length && kids.empty ? `<li class="sub-note">${esc(kids.empty)}</li>` : '';
  const more = kids.more ? `<li><button type="button" class="sub-item sub-more" data-key="more:${esc(id)}" data-more="${esc(id)}"${kids.loading ? ' aria-busy="true" disabled' : ''}><span>${kids.loading ? 'Loading…' : 'More'}</span></button></li>` : '';
  const act = kids.action ? `<li><button type="button" class="sub-item sub-action" data-key="${esc(kids.action.key)}" data-action="${esc(kids.action.key)}">${icon(kids.action.icon ?? 'plus', 14)}<span>${esc(kids.action.label)}</span></button></li>` : '';
  return `${row}<ul class="sub" id="${sub}" aria-label="${esc(kids.label ?? label)}">${act}${items}${state}${more}</ul>`;
}

const rows = nav => [...nav.querySelectorAll('[data-key]')].filter(r => r.offsetParent !== null && !r.disabled);

/** The one row in the Tab order: the child shown, else the tab shown, else the first row. */
export function settle(nav) {
  const all = [...nav.querySelectorAll('[data-key]')];
  const pick = nav.querySelector('[aria-current="page"]') ?? all[0];
  for (const r of all) r.tabIndex = r === pick ? 0 : -1;
}

/** The rail's keys, bound once on the nav (its rows are drawn again and again). */
export function bindTree(nav) {
  nav.addEventListener('focusin', e => {
    const r = e.target.closest('[data-key]');
    if (!r) return;
    for (const x of nav.querySelectorAll('[data-key]')) x.tabIndex = x === r ? 0 : -1;
  });
  nav.addEventListener('keydown', e => {
    const r = e.target.closest('[data-key]');
    if (!r || e.altKey || e.ctrlKey || e.metaKey) return;
    const list = rows(nav);
    const at = list.indexOf(r);
    const go = x => { if (x) { e.preventDefault(); x.focus(); } };
    if (e.key === 'ArrowDown') go(list[at + 1]);
    else if (e.key === 'ArrowUp') go(list[at - 1]);
    else if (e.key === 'Home') go(list[0]);
    else if (e.key === 'End') go(list.at(-1));
    else if (e.key === 'ArrowRight') {
      if (r.getAttribute('aria-expanded') === 'false') { e.preventDefault(); r.click(); }
      else if (r.getAttribute('aria-expanded') === 'true') go(r.nextElementSibling?.querySelector('[data-key]'));
    } else if (e.key === 'ArrowLeft') {
      const ul = r.closest('.sub');
      if (ul) go(ul.previousElementSibling);
    }
  });
}

/** Draw the rail again and keep the focus on the row that had it (a child's page arriving must not drop it). */
export function redraw(nav, html) {
  const had = nav.contains(document.activeElement) ? document.activeElement.closest('[data-key]')?.dataset.key : null;
  nav.innerHTML = html;
  settle(nav);
  if (had) {
    const again = [...nav.querySelectorAll('[data-key]')].find(r => r.dataset.key === had) ?? nav.querySelector('[aria-current="page"]');
    again?.focus({ preventScroll: true });
  }
}
