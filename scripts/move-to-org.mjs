// The one-time move of a business made before businesses were orgs (docs/schema.md § the one-time move): a folder of
// the founder's Drive, `Businesses/<slug>/`, becomes the org `org-<slug>`, and nothing is lost. It runs in the console's
// page, as the signed-in founder (their own token; nothing else can act for them):
//
//   const m = await import('/scripts/move-to-org.mjs');
//   const plan = await m.move({ slug: 'digitalproduct' });              // a dry run: reads only, says each step
//   const done = await m.move({ slug: 'digitalproduct', apply: true }); // the move; run again, it does only what is left
//
// Every step is idempotent and checked: each file is copied byte for byte and its size and SHA-256 compared with the
// original's. The report is written into the founder's own Drive (`VibeStartup/moves/<slug>-<time>.json`) and returned.
import { api, drive, tasks, threads, sites, orgs, goods } from '/lib/api.js';
import { readBusiness, writeBusiness, forkCofounder, briefingRoutine, startPayouts, bizDrive, bizAccount, addressOf } from '/lib/business.js';
import { orgOf, PATHS, MEMORY_FILES, settingsInto, split } from '/lib/schema.js';
import { vcardOf, contactFile } from '/lib/contacts.js';

const FROM = slug => `Businesses/${slug}`;
/** Files whose words are now the charter's (lib/schema.js): kept in the Trash with the folder, never copied. */
const CHARTER_FILES = ['cofounder/PLATFORM.md', 'cofounder/CODEMAP.md'];
/** Files that change shape on the way (each step below writes them): the rest are copied as they are. */
const RESHAPED = ['business.json', 'settings.json', 'customers/customers.json', 'products/products.json'];
/** Where a file of the old folder goes in the org: the co-founder's Markdown to the root, the rest at its own path. */
const target = rel => rel.startsWith('cofounder/') && MEMORY_FILES.includes(rel.slice('cofounder/'.length)) ? rel.slice('cofounder/'.length) : rel;
/** The old folder's paths, relative to it, in the stored strings of the catalogue. */
const local = (slug, p) => typeof p === 'string' ? p.replace(new RegExp(`^/?${FROM(slug).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`), '') : p;

async function sha256(blob) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join(''); }

export async function move({ slug, apply = false } = {}) {
  if (!slug) throw new Error('slug is required');
  const report = { slug, apply, at: new Date().toISOString(), org: orgOf(slug), steps: [], files: [], problems: [] };
  const step = (name, detail = {}) => { report.steps.push({ name, ...detail }); return detail; };
  const problem = (what, detail = {}) => { report.problems.push({ what, ...detail }); };
  const me = await api('/me');
  const founder = await api(`/users/${encodeURIComponent(me.id)}`).catch(() => ({ id: me.id, email: '', name: '' }));
  report.founder = me.id;

  // 1. Read everything first; stop on anything unreadable.
  const from = FROM(slug);
  const old = await drive.readJsonPath(from, 'business.json');
  const listed = await drive.files(`${from}/`);
  if (!old && !listed.length) {
    // Already moved: the org's record says so.
    const done = await readBusiness(slug).catch(() => null);
    step('read', { found: false, moved: !!done });
    if (!done) throw new Error(`${from}/business.json is not in this Drive, and ${orgOf(slug)} has no business.`);
    return finish(report, apply);
  }
  if (!old) throw new Error(`${from}/business.json could not be read.`);
  const rel = f => f.path.slice(from.length + 1);
  const files = listed.map(f => ({ rel: rel(f), size: f.size, sha256: f.version ?? null })).filter(f => f.rel);
  const runs = files.filter(f => f.rel.startsWith('runs/'));
  const copy = files.filter(f => !f.rel.startsWith('runs/') && !CHARTER_FILES.includes(f.rel) && !RESHAPED.includes(f.rel));
  const productsDoc = await drive.readJsonPath(`${from}/products`, 'products.json').catch(() => null) ?? { products: [] };
  const settingsOld = await drive.readJsonPath(from, 'settings.json').catch(() => null) ?? {};
  const customers = (await drive.readJsonPath(`${from}/customers`, 'customers.json').catch(() => null))?.customers ?? [];
  const bizTasks = (await tasks.list({ labels: [`biz:${slug}`], includeClosed: true }).catch(() => [])).map(t => ({ id: t.id ?? t.doc?.id, title: t.title ?? t.doc?.title, status: t.status ?? t.doc?.status, readme: t.readme ?? t.doc?.readme }));
  // A task is its .task.tsx and the .md of its body, both named by its title.
  const taskFiles = (await drive.files('Tasks/')).filter(f => bizTasks.some(t => [`Tasks/${t.title}.task.tsx`, `Tasks/${t.title}.md`, t.readme && `Tasks/${t.readme}`].includes(f.path)));
  const site = old.site?.id ? await sites.get(old.site.id).catch(e => ({ error: e.message })) : null;
  const oldThread = old.cofounder?.threadId ?? null;
  const oldTriggers = oldThread ? await threads.triggers.list(oldThread).catch(() => []) : [];
  const mine = await goods.list().catch(() => []);
  step('read', {
    files: files.length, bytes: files.reduce((a, f) => a + (f.size ?? 0), 0), copied: copy.length, reshaped: RESHAPED.filter(r => files.some(f => f.rel === r)),
    charterFiles: CHARTER_FILES.filter(r => files.some(f => f.rel === r)), runFiles: runs.length,
    products: productsDoc.products.length, customers: customers.length, tasks: bizTasks.length, taskFiles: taskFiles.length,
    site: site?.site ? { id: site.site.id, slug: site.site.slug, folder: site.site.folder, deploys: (site.deployments ?? []).length, live: (site.deployments ?? []).find(d => d.status === 'live')?.id ?? null, domains: (site.domains ?? []).map(d => d.hostname) } : site,
    thread: oldThread, triggers: oldTriggers.map(t => ({ id: t.id, label: t.label, every: t.condition?.everySeconds, enabled: t.enabled })),
    goods: mine.filter(g => productsDoc.products.some(p => p.goodId === g.id)).map(g => ({ id: g.id, slug: g.slug, status: g.status, file: g.file })),
  });

  // 2. The org, with the business's slug as its handle and VibeStartup as its brand (the founder's token is the brand's).
  let org = (await orgs.list()).find(o => o.id === orgOf(slug));
  if (!org && apply) {
    const made = await orgs.create({ name: old.name, handle: slug });
    org = { id: made.org, name: made.name, brand: made.brand };
  }
  step('org', { id: org?.id ?? orgOf(slug), made: !!org, brand: org?.brand ?? null });
  if (!apply) return finish(report, false, { copy, taskFiles });
  const biz = { ...old, org: org.id, slug, name: old.name, brand: old.brand ?? {}, settingsFile: {}, autopilot: !!(settingsOld.autopilot ?? old.autopilot), briefing: settingsOld.briefing ?? old.briefing ?? 'daily' };
  delete biz.v; delete biz.founderId; delete biz.ownerScope; delete biz.payments;
  const d = bizDrive(biz);

  // 3. The files, byte for byte, each checked against the original's size and SHA-256.
  const have = new Map((await d.files('')).map(f => [f.path, f]));
  const put = async (src, dest) => {
    const was = files.find(f => f.rel === src) ?? taskFiles.find(f => f.path === src);
    const there = have.get(dest);
    let sha = was?.sha256 ?? null;
    if (!(there && sha && there.version === sha)) {
      const blob = await drive.readBlobPath(src.startsWith('Tasks/') ? src : `${from}/${src}`);
      if (!blob) { problem('unreadable', { file: src }); return; }
      sha ??= await sha256(blob);
      const [dir, name] = split(dest);
      if (dir) await d.ensure(dir);
      await d.write(dir, name, blob, blob.type || undefined);
    }
    report.files.push({ from: src, to: dest, size: was?.size ?? null, sha256: sha });
  };
  for (const f of copy) await put(f.rel, target(f.rel));
  for (const f of taskFiles) await put(f.path, f.path);
  const after = new Map((await d.files('')).map(f => [f.path, f]));
  for (const f of report.files) {
    const got = after.get(f.to);
    f.ok = !!got && got.size === f.size && (!f.sha256 || got.version === f.sha256);
    if (!f.ok) problem('copy differs', { file: f.to, want: { size: f.size, sha256: f.sha256 }, got: got ? { size: got.size, sha256: got.version } : null });
  }
  step('files', { copied: report.files.length, ok: report.files.filter(f => f.ok).length });

  // 4. The reshaped files: the settings as keys of .commandagi/settings.json, the customers as contacts, the catalogue
  // with paths from the org's root.
  biz.settingsFile = settingsInto(await d.readJsonPath(...split(PATHS.settings)).catch(() => null) ?? {}, biz);
  await d.ensure('.commandagi');
  await d.writeJson(...split(PATHS.settings), biz.settingsFile);
  if (customers.length) await d.ensure(PATHS.contacts);
  for (const c of customers) await d.write(PATHS.contacts, contactFile(c.email), vcardOf(c), 'text/vcard');
  const catalogue = { ...productsDoc, products: productsDoc.products.map(p => ({ ...p, file: local(slug, p.file), deliverable: local(slug, p.deliverable), download: local(slug, p.download), images: (p.images ?? []).map(i => ({ ...i, path: local(slug, i.path) })) })) };
  await d.writeJson(...split(PATHS.catalogue), catalogue);
  step('reshaped', { settings: { autopilot: biz.autopilot, briefing: biz.briefing }, contacts: customers.length, products: catalogue.products.map(p => ({ id: p.id, file: p.file, images: p.images.length })) });

  // 5. The site moves into the org with its id, slug, domains, deploys and env (POST /sites/:id/transfer).
  if (old.site?.id) {
    const now = await sites.get(old.site.id);
    if (now.site?.ownerScope !== org.id) {
      const moved = await sites.transfer(old.site.id, org.id);
      biz.site = { ...old.site, folder: moved.site?.folder ?? old.site.folder };
      step('site', { moved: true, folder: biz.site.folder, from: moved.from });
    } else { biz.site = { ...old.site, folder: now.site.folder }; step('site', { moved: false, already: true, folder: now.site.folder }); }
  }

  // 6. The co-founder: its agent made in the org with today's charter, and a new main chat of the org. The chat it had
  // stays the founder's thread (a run cannot change hands); the Chat tab lists it as an earlier chat.
  // A run stopped half way left the org's record: its agent and its chat are the co-founder's still.
  const prior = await d.readJsonPath('', PATHS.record).catch(() => null);
  biz.cofounder = { ...old.cofounder, ...(prior?.cofounder?.earlier ? prior.cofounder : {}) };
  biz.routines = prior?.routines ?? biz.routines;
  delete biz.cofounder.modelRefused; delete biz.cofounder.modelAsked; delete biz.cofounder.storefrontRule; delete biz.cofounder.forkId;
  const earlier = oldThread ? [{ id: oldThread, title: 'Before the move', at: Date.now() }] : [];
  if (!prior?.cofounder?.earlier) {
    biz.cofounder.agentId = await forkCofounder(biz, founder);
    const t = await threads.create({ ownerScope: org.id, agentName: biz.cofounder.name, fromAgentId: biz.cofounder.agentId, surface: 'vibestartup', about: addressOf(biz), reality: 'simulation', title: biz.name, idempotencyKey: `vibestartup:${org.id}:moved` });
    biz.cofounder.threadId = t.threadId;
    biz.cofounder.model = 'openai/gpt-6-luna';
    biz.cofounder.earlier = [...(old.cofounder?.earlier ?? []), ...earlier];
  }
  step('cofounder', { agentId: biz.cofounder.agentId, threadId: biz.cofounder.threadId, earlier: biz.cofounder.earlier?.map(e => e.id) });

  // 7. The routines: the same ones on the new main chat, then the old ones paused (kept, with their history).
  const now = await threads.triggers.list(biz.cofounder.threadId).catch(() => []);
  const made = [];
  for (const tr of oldTriggers) {
    const label = tr.label;
    if (!now.some(n => n.label === label)) {
      const body = /briefing/i.test(label) ? briefingRoutine(biz) : { kind: 'cron', everySeconds: tr.condition?.everySeconds ?? 86400, label, prompt: tr.effect?.prompt ?? '' };
      const r = await threads.triggers.create(biz.cofounder.threadId, body);
      made.push({ label, id: r.id ?? r.trigger?.id ?? null });
      if (/briefing/i.test(label)) biz.routines = { ...(biz.routines ?? {}), briefing: r.id ?? r.trigger?.id ?? null };
    }
    if (tr.enabled) await threads.triggers.update(oldThread, tr.id, { enabled: false }).catch(e => problem('old routine still on', { id: tr.id, why: e.message }));
  }
  step('routines', { made, paused: oldTriggers.filter(t => t.enabled).map(t => t.id) });

  // 8. The record, the mail (the founder's address stays theirs: CommandAGI moves no address to an org) and payouts
  // (the org's own Stripe account, up to Stripe's form: the founder fills that in).
  biz.gaps = [...(old.gaps ?? []).filter(g => g.what !== 'email-owner'), ...(old.email?.id ? [{ at: Date.now(), what: 'email-owner', why: `${old.email.address} is your own address from before ${biz.name} was its own business: CommandAGI cannot move an address to a business yet, so its mail stays in your account.` }] : [])];
  await writeBusiness(biz);
  try { const r = await startPayouts(biz); step('payouts', { account: r?.account ?? bizAccount(biz), createdAccount: r?.createdAccount ?? null, form: !!r?.url }); }
  catch (e) { step('payouts', { error: e.code ?? e.message }); problem('payouts', { why: e.message }); }

  // 9. The old folder to the Trash (kept, never erased), all but the run of its chat, which stays where its thread
  // writes it; the business's tasks from the founder's Tasks/ with it. Then the goods are indexed again as the org's: a
  // good whose file moved comes along with its slug and SKU (CommandAGI's "a product moves with its file").
  if (!report.problems.some(p => p.what === 'copy differs' || p.what === 'unreadable')) {
    // A file goes to the Trash (`DELETE /drive/:id`, kept until the Trash is emptied); a folder only when empty, so a
    // folder's files go first, then the folder. A task's .md goes with its .task.tsx.
    const trashTree = async path => {
      for (const n of await drive.list(path)) {
        if (n.type === 'folder') { await trashTree(`${path}/${n.name}`); await drive.remove(n.id).catch(() => null); }
        else await drive.remove(n.id).catch(e => { if (e.status !== 404) problem('not trashed', { file: `${path}/${n.name}`, why: e.message }); });
      }
    };
    const top = await drive.list(from);
    for (const n of top.filter(n => n.name !== 'runs')) {
      if (n.type === 'folder') { await trashTree(`${from}/${n.name}`); await drive.remove(n.id).catch(() => null); }
      else await drive.remove(n.id);
    }
    for (const f of await drive.list('Tasks')) if (taskFiles.some(t => t.path === `Tasks/${f.name}`)) await drive.remove(f.id).catch(() => null);
    step('trash', { moved: top.filter(n => n.name !== 'runs').map(n => n.name), kept: top.some(n => n.name === 'runs') ? ['runs'] : [], tasks: taskFiles.length });
    const re = await goods.reindex(bizAccount(biz)).catch(e => ({ error: e.message }));
    const theirs = await goods.list(bizAccount(biz)).catch(() => []);
    for (const p of catalogue.products) {
      const g = theirs.find(x => String(x.file ?? '').replace(/^\/+/, '') === p.file);
      if (g) Object.assign(p, { goodId: g.id, variantId: g.variants?.[0]?.id ?? p.variantId, goodStatus: g.status, goodKind: g.kind });
      else if (p.file) problem('good not adopted', { product: p.id, file: p.file, skipped: re.skipped?.find(s => s.file === p.file) ?? null });
    }
    await d.writeJson(...split(PATHS.catalogue), catalogue);
    step('goods', { indexed: re.indexed?.map(i => ({ id: i.id, slug: i.slug })) ?? [], skipped: re.skipped ?? [], error: re.error ?? null, goods: theirs.map(g => ({ id: g.id, slug: g.slug, status: g.status, sku: g.variants?.[0]?.sku })) });
    const memory = await d.readPath('', 'MEMORY.md').catch(() => null) ?? '# Memory\n';
    if (!memory.includes('became its own business on CommandAGI')) await d.write('', 'MEMORY.md', `${memory.trimEnd()}\n- ${new Date().toISOString().slice(0, 10)}: ${biz.name} became its own business on CommandAGI (the org ${org.id}). Its files, products, storefront and routines moved here; the chat before the move is listed in Chat.\n`);
  } else step('trash', { skipped: 'a copy did not check out, so the old folder stays where it is' });
  return finish(report, true);
}

async function finish(report, apply, extra = {}) {
  if (!apply) report.plan = { copy: extra.copy?.map(f => `${f.rel} → ${target(f.rel)} (${f.size} bytes)`), tasks: extra.taskFiles?.map(f => f.path) };
  const name = `${report.slug}-${report.at.replace(/[:.]/g, '-')}${apply ? '' : '-dry-run'}.json`;
  await drive.ensure('VibeStartup/moves').catch(() => null);
  await drive.writeJson('VibeStartup/moves', name, report).catch(() => null);
  report.saved = `VibeStartup/moves/${name}`;
  return report;
}
