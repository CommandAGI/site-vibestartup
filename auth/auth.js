// Sign in and create account: the founder's CommandAGI token for this brand (lib/api.js: the password grant and
// POST /oauth/signup of the platform-owned `vibestartup` client). Afterwards, to ?next= (a same-origin path) or home.
import { signIn, signUp, signedIn, setProfile, ApiError } from '/lib/api.js';
import { $, $$, oops } from '/lib/ui.js';

const params = new URLSearchParams(location.search);
const rawNext = params.get('next') || '/home/';
const next = /^\/(?!\/)/.test(rawNext) ? rawNext : '/home/';
const signup = $('#signup'), signin = $('#signin');
if (signedIn()) location.replace(next);

function showForm(which) {
  signup.hidden = which !== 'signup'; signin.hidden = which !== 'signin';
  document.title = `${which === 'signup' ? 'Create your account' : 'Sign in'} | VibeStartup`;
  const u = new URL(location.href); u.searchParams.set('mode', which); history.replaceState(null, '', u);
  $(`#${which} input`).focus();
}
$$('[data-auth-switch]').forEach(b => b.onclick = () => showForm(b.dataset.authSwitch));
showForm(params.get('mode') === 'signin' ? 'signin' : 'signup');

const say = (form, text) => { $('[data-error]', form).textContent = text; };
async function submit(form, act) {
  const button = $('button[type=submit]', form);
  const data = Object.fromEntries(new FormData(form));
  say(form, '');
  if (!data.email || !/@/.test(data.email)) return say(form, 'Enter your email address.');
  if (!data.password || data.password.length < 8) return say(form, 'Use a password of at least 8 characters.');
  if (form === signup && !String(data.name ?? '').trim()) return say(form, 'Tell us your name.');
  if (form === signup && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.birthdate ?? ''))) return say(form, 'Enter your date of birth.');
  button.disabled = true; const was = button.textContent; button.textContent = form === signup ? 'Creating your account…' : 'Signing in…';
  try {
    await act(data);
    location.href = next;
  } catch (e) {
    if (e instanceof ApiError && e.code === 'signup_capped') say(form, 'New accounts are limited today. Try again tomorrow, or write to hello@vibestartup.pro.');
    else if (e instanceof ApiError && e.status === 0) say(form, 'We could not reach CommandAGI. Check your connection and try again.');
    else if (e instanceof ApiError && e.code === 'email_taken') { say(form, 'An account with this email already exists. Sign in instead.'); }
    else say(form, oops(e));
    button.disabled = false; button.textContent = was;
  }
}
signup.addEventListener('submit', e => { e.preventDefault(); submit(signup, async d => {
  await signUp({ name: String(d.name).trim(), email: d.email, password: d.password });
  // The date of birth is set once on the CommandAGI account (immutable there); a failure to set it is not a failed sign-up.
  await setProfile({ birthdate: d.birthdate }).catch(() => null);
}); });
signin.addEventListener('submit', e => { e.preventDefault(); submit(signin, d => signIn({ email: d.email, password: d.password })); });
