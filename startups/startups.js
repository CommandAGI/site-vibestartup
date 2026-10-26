// The account's businesses: the list, a new business from an idea, and the account's own two acts (sign out, delete).
// Every read and change goes to the app's routes; this page keeps nothing.
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function api(method, path, body) {
  const r = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) { location.href = `/?next=${encodeURIComponent(location.pathname)}`; throw new Error('Signed out'); }
  if (!r.ok) throw new Error(data.error ?? `The app answered ${r.status}.`);
  return data;
}

function card(s) {
  return `<a class="card biz" href="/app/?s=${encodeURIComponent(s.id)}">
    <h3>${esc(s.name)}</h3>
    <p class="small muted">${esc(s.idea)}</p>
    <p class="small">Day ${esc(s.day > 7 ? '7 (complete)' : s.day)} of launch week &middot; ${esc(s.credits)} credits &middot; ${s.siteLive ? 'storefront live' : 'storefront not live yet'}</p>
    ${s.waiting ? `<p><span class="pill accent">${s.waiting} waiting on you</span></p>` : ''}
  </a>`;
}

let me = null;

async function load() {
  const data = await api('GET', '/me');
  me = data;
  $('#who').textContent = data.user.email;
  $('#account-email').textContent = `${data.user.name} · ${data.user.email}`;
  $('#list').innerHTML = data.startups.length ? data.startups.map(card).join('') : '<div class="card"><h3>No businesses yet</h3><p class="muted">Start one below: an idea in a sentence is enough.</p></div>';
}

$('#create').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target, f = Object.fromEntries(new FormData(form));
  const error = form.querySelector('[data-error]');
  error.textContent = '';
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  try {
    const r = await api('POST', '/startups', { idea: f.idea, name: f.name, cofounder: f.cofounder });
    location.href = `/app/?s=${encodeURIComponent(r.id)}`;
  } catch (err) {
    error.textContent = err.message;
  } finally {
    button.disabled = false;
  }
});

// The name follows the idea until the person types one, as it does on the way in.
const idea = document.querySelector('form#create [name=idea]');
const name = $('#biz-name');
idea.addEventListener('input', () => {
  if (name.dataset.edited) return;
  const words = idea.value.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 3).sort((a, b) => b.length - a.length).slice(0, 2);
  name.value = words.length ? words.map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('') : '';
});
name.addEventListener('input', () => { name.dataset.edited = '1'; });

$('#signout').addEventListener('click', async () => { await api('POST', '/signout'); location.href = '/'; });

$('#delete-account').addEventListener('click', async () => {
  const typed = prompt('This removes your account and every business it holds. Type your email to confirm.');
  if (typed !== me?.user.email) return;
  await api('DELETE', '/me');
  location.href = '/';
});

load().catch(() => { $('#list').innerHTML = '<div class="card"><h3>The app did not answer</h3><p class="muted">Reload the page and try again.</p></div>'; });
