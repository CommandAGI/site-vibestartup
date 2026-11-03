// Profile: name, email, notification preferences, sign out, delete the account.
import { setProfile, notificationPrefs, setNotificationPref, signOut, eraseAccount } from '/lib/api.js';
import { $, esc, toast, confirm, oops, busy } from '/lib/ui.js';
import { head, section } from './_shared.js';

export async function render(ctx) {
  const { el, founder } = ctx;
  const prefs = await notificationPrefs().catch(() => ({ push: false, email: false, sms: false }));
  el.innerHTML = head('Profile')
    + section('You', `<form id="profile-form" class="panel stack"><label class="field"><span>Name</span><input id="profile-name" name="name" value="${esc(founder?.name ?? '')}"></label><label class="field"><span>Email</span><input id="profile-email" value="${esc(founder?.email ?? '')}" readonly><small>Your CommandAGI account's address.</small></label><label class="field"><span>Date of birth</span><input id="profile-birthdate" name="birthdate" type="date" value="${esc(founder?.birthdate ?? '')}" ${founder?.birthdate ? 'readonly' : ''}><small>${founder?.birthdate ? 'Set once; it cannot be changed here.' : 'The models that run your co-founder need you to be 18 or over. Set once.'}</small></label><label class="field"><span>Phone</span><input value="" placeholder="Not set" readonly><small>Text updates arrive when a phone is verified on the account; verification opens at launch.</small></label><div class="row"><button class="btn primary" type="submit">Save</button></div></form>`)
    + section('Notifications', `<div class="panel stack"><label class="switch"><input type="checkbox" id="notif-push" ${prefs.push ? 'checked' : ''}><i></i><span>Push for what needs you: approvals, errors, milestones</span></label><label class="switch"><input type="checkbox" id="notif-email" ${prefs.email ? 'checked' : ''}><i></i><span>Email: welcome, approvals, the daily briefing</span></label><label class="switch"><input type="checkbox" id="notif-sms" ${prefs.sms ? 'checked' : ''} disabled><i></i><span>Text messages for what needs you (after a phone is verified)</span></label></div>`)
    + section('Account', `<div class="panel stack"><div class="row"><button type="button" class="btn quiet" id="signout">Sign out</button><button type="button" class="btn danger" id="delete-account">Delete my account</button></div><p class="hint">Deleting removes your CommandAGI account and every business, file and record it holds.</p></div>`);
  $('#profile-form', el).onsubmit = async e => { e.preventDefault(); const b = e.target.querySelector('button'); await busy(b, async () => { try {
    const patch = { name: $('#profile-name', el).value.trim() };
    const dob = $('#profile-birthdate', el); if (dob.value && !dob.readOnly) patch.birthdate = dob.value;
    await setProfile(patch); founder.name = patch.name; if (patch.birthdate) { founder.birthdate = patch.birthdate; dob.readOnly = true; }
    toast('Saved.', 'ok'); ctx.setBiz(ctx.biz);
  } catch (err) { toast(oops(err), 'bad'); } }); };
  $('#notif-push', el).onchange = e => setNotificationPref('push', e.target.checked).then(() => toast('Saved.', 'ok')).catch(err => { toast(oops(err), 'bad'); e.target.checked = !e.target.checked; });
  $('#notif-email', el).onchange = e => setNotificationPref('email', e.target.checked).then(() => toast('Saved.', 'ok')).catch(err => { toast(oops(err), 'bad'); e.target.checked = !e.target.checked; });
  $('#signout', el).onclick = async () => { await signOut().catch(() => null); location.href = '/'; };
  $('#delete-account', el).onclick = async () => { if (!await confirm('This removes your account and every business it holds, with their records and files. It cannot be undone.', { title: 'Delete my account', ok: 'Delete everything', danger: true })) return; try { await eraseAccount(); location.href = '/'; } catch (err) { toast(oops(err), 'bad'); } };
}
