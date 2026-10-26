// The public pages' own script: the account forms and the A/文 language picker. It talks to the app's routes only.
const dialog = document.querySelector('#lang-dialog');
document.querySelector('[data-lang]')?.addEventListener('click', () => dialog?.showModal());

for (const form of document.querySelectorAll('form[data-auth]')) {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const kind = form.dataset.auth;
    const f = Object.fromEntries(new FormData(form));
    const error = form.querySelector('[data-error]');
    if (error) error.textContent = '';
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      const r = await fetch(`/api/${kind}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { if (error) error.textContent = data.error ?? `The app answered ${r.status}.`; return; }
      const next = new URLSearchParams(location.search).get('next');
      location.href = data.startup ? `/app/?s=${encodeURIComponent(data.startup.id)}` : (next || '/startups/');
    } catch {
      if (error) error.textContent = 'The app could not be reached. Check your connection and try again.';
    } finally {
      button.disabled = false;
    }
  });
}
