// What the tabs share: the business's files (products, orders, customers), small renderers, and the honest
// "connect your provider" stop.
import { threads, sites, goods, payments, BRAND } from '/lib/api.js';
import { bizDrive, bizTasksApi, bizAccount, readBizJson, writeBizJson, writeBusiness, startPayouts } from '/lib/business.js';
import { contactFile, vcardOf, contactOf } from '/lib/contacts.js';
import { PATHS, split } from '/lib/schema.js';
import { esc, icon, money, when, ago } from '/lib/ui.js';

export { esc, icon, money, when, ago };

export const head = (title, text, actionsHtml = '') => `<div class="page-head"><div><h2>${esc(title)}</h2>${text ? `<p>${esc(text)}</p>` : ''}</div>${actionsHtml}</div>`;
export const section = (title, body, right = '') => `<section class="section"><div class="section-title"><h3>${esc(title)}</h3><div class="right">${right}</div></div>${body}</section>`;
export const iconBtn = (name, label, attrs = '') => `<button type="button" class="btn icon" aria-label="${esc(label)}" data-tip="${esc(label)}" ${attrs}>${icon(name)}</button>`;
export const askLink = (question, label = 'ask your co-founder') => `<a href="#" data-ask="${esc(question)}">${esc(label)}</a>`;
/** A feature that needs the founder's own provider account stops here, and says so. */
export const providerStop = (provider, what) => `<div class="note warn"><b>Connect ${esc(provider)} first.</b> ${esc(what)} Nothing was sent or charged.</div>`;
/**
 * "Notify me" beside a control that opens soon: a chip that records the founder's interest in the business's
 * settings (`vibestartup.notify: { <feature>: true }`). `on` is what the file says now.
 */
export const notifyChip = (feature, on) => `<button type="button" class="chip" data-notify="${esc(feature)}" aria-pressed="${on ? 'true' : 'false'}">${on ? 'We will tell you' : 'Notify me'}</button>`;
export function bindNotify(root, biz) {
  for (const b of root.querySelectorAll('[data-notify]')) b.onclick = async () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    const show = v => { b.setAttribute('aria-pressed', String(v)); b.textContent = v ? 'We will tell you' : 'Notify me'; };
    show(on);
    try { biz.notify = { ...(biz.notify ?? {}), [b.dataset.notify]: on }; await writeBusiness(biz); }
    catch { show(!on); }
  };
}
/** Grey bars where a part of a tab will be, while its call runs. */
export const bars = (blocks = 2) => `<div class="skeleton" role="status" aria-label="Loading"><i></i><i class="short"></i>${'<i class="block"></i>'.repeat(blocks)}</div>`;
/** Nothing here yet: what the place is for (`text`, HTML) and the next step (`extra`, a button or a link). */
export const empty = (title, text, extra = '') => `<div class="empty"><h3>${esc(title)}</h3><p>${text}</p>${extra}</div>`;

// ---------- the business's files ----------

export async function productsOf(biz) { return (await readBizJson(biz, PATHS.catalogue, { products: [] })).products ?? []; }
export async function writeProducts(biz, products) { return writeBizJson(biz, PATHS.catalogue, { products }); }
/**
 * The business's orders: what its storefront's checkout sold (`GET /goods/orders`, the lines of this business's goods),
 * as its org, and the orders recorded in its Drive (`orders/orders.jsonl`). An order paid on a test stack is a test.
 */
export async function ordersOf(biz) {
  const [text, products, sold] = await Promise.all([
    bizDrive(biz).readPath(...split(PATHS.orders)).catch(() => null),
    productsOf(biz),
    goods.orders(bizAccount(biz)).catch(() => []),
  ]);
  const recorded = String(text ?? '').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const variants = new Set(products.map(p => p.variantId).filter(Boolean));
  const paid = sold.filter(o => (o.items ?? []).some(it => variants.has(it.variantId))).map(o => ({
    id: o.orderNumber ?? o.id,
    name: (o.items ?? []).map(it => it.productName).filter(Boolean).join(', '),
    amount: (Number(o.totalCents) || 0) / 100,
    currency: (o.currency ?? 'usd').toUpperCase(),
    email: o.email ?? '',
    at: o.placedAt ?? o.createdAt,
    status: o.status,
    test: BRAND.stack !== 'production',
    checkout: true,
    returned: o.status === 'refunded' || o.status === 'charged_back',
  }));
  return [...paid, ...recorded];
}
/** The business's contacts (`contacts/*.vcf`): its customers and the storefront's sign-ups. */
export async function customersOf(biz) {
  const d = bizDrive(biz);
  const files = (await d.list(PATHS.contacts).catch(() => [])).filter(f => f.name.endsWith('.vcf'));
  return (await Promise.all(files.map(f => d.readText(f.id).then(contactOf).catch(() => null)))).filter(Boolean);
}
/** The business's settings (`.commandagi/settings.json`, lib/schema.js SETTINGS), read with the business. */
export const settingsOf = async biz => ({ autopilot: biz.autopilot, briefing: biz.briefing, notify: biz.notify ?? {}, creativeBudget: biz.creativeBudget ?? 0 });
export async function writeSettings(biz, s) { Object.assign(biz, s); return writeBusiness(biz); }
/** Write one contact, as its vCard (an upsert by its address). */
export const writeContact = (biz, c) => bizDrive(biz).write(PATHS.contacts, contactFile(c.email), vcardOf(c), 'text/vcard');

/** Only completed, non-test orders count as sales; a refunded or charged-back one is not a sale. */
export function realSales(orders) {
  const real = orders.filter(o => !o.test && !o.returned);
  return { count: real.length, revenue: real.reduce((a, o) => a + (Number(o.amount) || 0), 0), test: orders.length - real.length };
}

// ---------- tasks of this business ----------

export const taskDoc = t => t.doc ?? t;
export const taskId = t => t.id ?? taskDoc(t).id;
export async function bizTasks(biz) {
  const all = await bizTasksApi(biz).list({ labels: [`biz:${biz.slug}`], includeClosed: true }).catch(() => []);
  return all.map(t => ({ ...taskDoc(t), id: taskId(t), raw: t }));
}
export const isApproval = t => (t.labels ?? []).includes('needs-approval');
export async function approve(biz, t) {
  await bizTasksApi(biz).update(t.id, { status: 'doing', ...(biz.cofounder?.agentId ? { assignees: [`agent:${biz.cofounder.agentId}`] } : {}) });
  if (biz.cofounder?.threadId) await threads.send(biz.cofounder.threadId, `Approved: ${t.title}. Go ahead, and tell me when it is done.`).catch(() => null);
}
export async function reject(biz, t, why = '') {
  await bizTasksApi(biz).update(t.id, { status: 'cancelled' });
  if (biz.cofounder?.threadId) await threads.send(biz.cofounder.threadId, `Not approved: ${t.title}.${why ? ' ' + why : ''}`).catch(() => null);
}

export const everyWords = s => s >= 604800 ? 'weekly' : s >= 86400 ? 'daily' : s >= 43200 ? 'every 12 hours' : s >= 21600 ? 'every 6 hours' : s >= 3600 ? 'hourly' : s >= 1800 ? 'every 30 minutes' : `every ${s} s`;
export const INTERVALS = [['1800', 'Every 30 minutes'], ['3600', 'Hourly'], ['21600', 'Every 6 hours'], ['43200', 'Every 12 hours'], ['86400', 'Daily'], ['604800', 'Weekly']];

/** The site's state, read once per tab render. `url` is where the storefront answers: its vibestartup.pro address
 *  (`site.brandUrl`) when CommandAGI names one, else its commandagi.app address. */
export async function siteState(biz) {
  if (!biz.site?.id) return { live: false, gap: biz.gaps?.find(g => g.what === 'site')?.why ?? 'The storefront was not created yet.' };
  try {
    const r = await sites.get(biz.site.id);
    const deployments = r.deployments ?? [];
    const live = r.site?.live ?? r.site?.liveDeploymentId ?? null;
    return { live: !!live || deployments.some(d => d.target === 'production' && (d.status === 'live' || d.status === 'ready' || d.status === 'succeeded')), site: r.site, deployments, domains: r.domains ?? [], env: r.env ?? [], url: r.site?.brandUrl ?? r.site?.url ?? biz.site.brandUrl ?? biz.site.url };
  } catch (e) { return { live: false, gap: e.message }; }
}

/** Whether the business's own Stripe account can take payments (Connect's state, as the org). */
export const payoutsOf = biz => payments.readiness(bizAccount(biz)).catch(() => ({ ready: false, blocks: ['unreadable'] }));
/**
 * "Finish payouts": the one step only the founder can do. Everything before Stripe's form is done here (the business's
 * own connected account is made on the first press); the form asks for identity, bank and tax details, on Stripe's page.
 */
export function payoutsCard(biz, readiness) {
  if (readiness?.ready) return '';
  const started = !!biz.payouts?.startedAt;
  const more = (readiness?.blocks ?? []).filter(b => !['not_onboarded', 'unreadable'].includes(b));
  return `<div class="note warn payouts-card" id="finish-payouts"><div class="grow"><b>Finish payouts</b> to take payment. ${started ? 'Your business\'s Stripe account is made.' : 'Your business gets its own Stripe account.'} Stripe asks for your identity, your bank and your tax details on its own page; ${esc(biz.name)} never sees them. Until then the storefront takes orders by email and nothing is charged.${more.length ? ` Stripe still needs: ${esc(more.join(', '))}.` : ''}</div><button type="button" class="btn primary" data-finish-payouts>${started ? 'Finish payouts' : 'Set up payouts'}</button></div>`;
}
export function bindPayouts(root, biz) {
  for (const b of root.querySelectorAll('[data-finish-payouts]')) b.onclick = async () => {
    b.disabled = true; b.setAttribute('aria-busy', 'true');
    try { const r = await startPayouts(biz); if (r?.url) { location.href = r.url; return; } toastBad('Stripe did not answer with its form. Try again.'); }
    catch (e) { toastBad(e.message); }
    b.disabled = false; b.removeAttribute('aria-busy');
  };
}
const toastBad = async m => (await import('/lib/ui.js')).toast(m, 'bad');

export const swatch = (brand, i) => `<div class="swatch" style="background:linear-gradient(135deg,${brand?.primary ?? '#ccc'},${brand?.secondary ?? '#eee'})"></div>`;
