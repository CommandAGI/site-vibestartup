// The levels the rail shows under a tab while it is the tab shown (app/nav.js draws them). Only levels a tab really
// has: its own views or folders (`view=`), its items (`item=`), or a business's chats (`thread=`). A tab reads its
// level from ctx.view; a tab with none here has no levels.
import { threads } from '/lib/api.js';
import { addressOf } from '/lib/business.js';
import { ago } from '/lib/ui.js';
import { productsOf } from './tabs/_shared.js';

/** Chats per page of the rail: the 5 most recently active, then 5 more for each "More". */
export const CHAT_PAGE = 5;

const views = list => () => list.map(([id, label]) => ({ id, label }));
// The platform names a thread after its first exchange; until then it has a placeholder.
const PLACEHOLDER = new Set(['', 'Untitled', 'New thread', 'New chat']);
const when = t => t.lastActivityAt ?? t.lastEvent?.at ?? t.startedAt ?? t.createdAt;

export const LEVELS = {
  chat: {
    label: 'Chats', param: 'thread', action: { key: 'new-chat', label: 'New chat', icon: 'plus' },
    /**
     * The business's chats: the threads about its business.json, most recently active first. A platform that cannot
     * list them by file yet shows the first chat alone.
     */
    async load({ biz, me }, { cursor = null, limit = CHAT_PAGE } = {}) {
      const main = biz.cofounder?.threadId ?? null;
      const only = main ? [{ id: main, label: 'Main chat' }] : [];
      const got = await threads.of(addressOf(me.id, biz.slug), { limit, cursor }).catch(() => null);
      // No New chat there either: a chat it made could not be listed.
      if (!got) return { items: cursor ? [] : only, next: null, fixed: true };
      const items = got.threads.map(t => ({ id: t.id, label: t.id === main ? 'Main chat' : PLACEHOLDER.has(String(t.title ?? '').trim()) ? 'New chat' : t.title, meta: when(t) ? ago(when(t)) : '' }));
      if (!cursor && main && !items.some(i => i.id === main) && !got.nextCursor) items.push(...only);
      return { items, next: got.nextCursor };
    },
  },
  analytics: { label: 'Analytics views', param: 'view', items: views([['overview', 'Overview'], ['activity', 'Activity'], ['site', 'The site']]) },
  tasks: { label: 'Task groups', param: 'view', items: views([['needs', 'Needs your call'], ['doing', 'In progress'], ['done', 'Done'], ['routines', 'Routines']]) },
  email: { label: 'Mail folders', param: 'view', when: biz => !!biz.email?.id, items: views([['inbox', 'Inbox'], ['unread', 'Unread'], ['sent', 'Sent'], ['drafts', 'Drafts']]) },
  files: { label: 'File groups', param: 'view', items: views([['identity', 'Identity'], ['operations', 'Operations'], ['evolving', 'Evolving'], ['other', 'Other'], ['assets', 'Creative assets']]) },
  products: {
    label: 'Products', param: 'item',
    async load({ biz }) { return { items: (await productsOf(biz).catch(() => [])).map(p => ({ id: p.id, label: p.name, meta: p.status === 'active' ? '' : p.status })), next: null }; },
  },
};

export const levelOf = (tab, biz) => { const l = LEVELS[tab]; return l && (!l.when || l.when(biz)) ? l : null; };
