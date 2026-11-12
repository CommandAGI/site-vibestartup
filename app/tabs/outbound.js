// Outbound: the leads you upload (only the people you give), the sequence your co-founder drafts, and each lead's
// status. A send goes out from the business address, after you confirm it.
import { email } from '/lib/api.js';
import { bizDrive } from '/lib/business.js';
import { $, $$, esc, icon, toast, confirm, when, oops, busy } from '/lib/ui.js';
import { head, section, empty, providerStop, askLink, iconBtn } from './_shared.js';

const parseCsv = text => {
  const lines = String(text).split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const cells = l => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')).slice(0, -0 || undefined);
  const headers = cells(lines[0]).map(h => h.trim().toLowerCase());
  return lines.slice(1).map(l => { const c = cells(l); const o = {}; headers.forEach((h, i) => { o[h] = (c[i] ?? '').trim(); }); return o; }).filter(o => Object.values(o).some(Boolean));
};

export async function render(ctx) {
  const { biz, el } = ctx;
  const leadsPath = 'leads', drive = bizDrive(biz);
  const paint = async () => {
    const csv = await drive.readPath(leadsPath, 'leads.csv').catch(() => null);
    const leads = csv ? parseCsv(csv) : [];
    const status = (await drive.readPath(leadsPath, 'status.json').then(t => t ? JSON.parse(t) : {}).catch(() => ({}))) ?? {};
    const campaigns = (await drive.list(`outbound`).catch(() => [])).filter(f => f.type === 'folder');
    el.innerHTML = head('Outbound', 'Campaigns your co-founder builds over the leads you upload. Only the people you give are recorded.')
      + section('Leads', `<div class="row" style="margin-bottom:10px"><label class="btn quiet" for="leads-upload">${icon('upload', 16)} Upload a CSV<input id="leads-upload" type="file" accept=".csv,text/csv" hidden></label><span class="hint">Columns: name, email, company, note. The file is leads/leads.csv in your files.</span></div>` + (leads.length ? `<table class="table"><thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Status</th><th></th></tr></thead><tbody id="leads">${leads.map((l, i) => `<tr data-i="${i}"><td>${esc(l.name ?? '')}</td><td>${esc(l.email ?? '')}</td><td>${esc(l.company ?? '')}</td><td>${esc(status[l.email]?.state ?? 'new')}${status[l.email]?.at ? ` <small class="hint">${esc(when(status[l.email].at))}</small>` : ''}</td><td>${l.email ? `<button type="button" class="btn sm quiet" data-send>Send the first note</button>` : ''}</td></tr>`).join('')}</tbody></table>` : `<div id="leads">${empty('No leads yet', 'Upload a CSV of people who may want to hear from you. Your co-founder drafts a sequence for them.')}</div>`))
      + section('Campaigns', campaigns.length ? `<div id="outbound-campaigns" class="grid-auto">${campaigns.map(c => `<div class="campaign card"><h4>${esc(c.name)}</h4><p class="meta">outbound/${esc(c.name)}/ in your files</p><button type="button" class="btn sm quiet" data-open="${esc(c.name)}">Read the sequence</button><div class="seq" hidden></div></div>`).join('')}</div>` : `<div id="outbound-campaigns" class="note">No campaign yet. ${askLink(`Draft an outbound campaign for ${biz.name} over the leads in leads/leads.csv: a three-step sequence (first note, follow-up after 7 days, last note after 21 days) written into outbound/launch/sequence.md, for my approval.`, 'Ask your co-founder to draft one')}.</div>`, `<a class="btn sm quiet" href="#" data-ask="Draft an outbound campaign for ${esc(biz.name)} over the leads in leads/leads.csv: a three-step sequence written into outbound/launch/sequence.md, for my approval.">${icon('sparkle', 14)} Draft a campaign</a>`);
    $('#leads-upload', el).onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      try { await drive.ensure(leadsPath); await drive.write(leadsPath, 'leads.csv', file, 'text/csv'); toast('Leads uploaded.', 'ok'); await paint(); } catch (err) { toast(oops(err), 'bad'); }
    };
    $$('[data-open]', el).forEach(b => b.onclick = async () => { const box = $('.seq', b.closest('.campaign')); const text = await drive.readPath(`outbound/${b.dataset.open}`, 'sequence.md').catch(() => null); box.hidden = false; box.innerHTML = `<pre class="mono" style="white-space:pre-wrap;margin-top:8px">${esc(text ?? 'No sequence.md yet: your co-founder has not drafted it.')}</pre>`; });
    $$('[data-send]', el).forEach(b => b.onclick = async () => {
      const lead = leads[Number(b.closest('tr').dataset.i)];
      if (!biz.email?.id) { b.closest('td').innerHTML = providerStop('a business address', 'Claim one in Email first.'); return; }
      const seq = await drive.readPath(`outbound/launch`, 'sequence.md').catch(() => null);
      const text = seq ? seq.split(/\n#+\s/)[0].trim() : `Hi ${lead.name || ''},\n\nI'm starting ${biz.name}: ${biz.idea}\n\nWould you like to hear when it launches?`;
      if (!await confirm(`Send this from ${biz.email.address} to ${lead.email}?\n\n${text.slice(0, 400)}`, { title: 'Send the first note', ok: 'Send' })) return;
      await busy(b, async () => { try { await email.compose(biz.email.id, { to: lead.email, subject: `${biz.name}`, text }); status[lead.email] = { state: 'sent', at: Date.now() }; await drive.write(leadsPath, 'status.json', JSON.stringify(status, null, 2)); toast('Sent.', 'ok'); await paint(); } catch (err) { toast(oops(err), 'bad'); } });
    });
  };
  await paint();
}
