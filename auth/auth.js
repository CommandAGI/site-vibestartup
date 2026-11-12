// Sign in and create account: the founder's CommandAGI token for this brand (lib/api.js: the password grant and
// POST /oauth/signup of the platform-owned `vibestartup` client). Afterwards, to ?next= (a same-origin path) or home.
import { signIn, signUp, signedIn, setProfile, ApiError, API } from '/lib/api.js';
import { allowCofounderAccounts } from '/lib/business.js';
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
// Turnstile (Cloudflare's bot check, invisible unless it is unsure) on the sign-up form, on the hosts the platform's
// widget lists; elsewhere (localhost, a preview) no token is sent and the door takes the sign-up without one.
const TURNSTILE_HOSTS = new Set(['vibestartup.pro', 'www.vibestartup.pro', 'vibestartup.us', 'www.vibestartup.us', 'vibestartup.commandagi.app', 'vibestartup--dev.commandagi.app']);
let turnstileId = null;
if (TURNSTILE_HOSTS.has(location.hostname)) {
  fetch(`${API}/signup/config`).then(r => r.json()).then(cfg => {
    const key = cfg?.turnstile?.siteKey; if (!key) return;
    window.onTurnstileLoad = () => { turnstileId = window.turnstile.render('#turnstile', { sitekey: key, action: cfg.turnstile.action ?? 'signup', appearance: 'interaction-only' }); };
    const sc = document.createElement('script'); sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad'; sc.async = true; document.head.append(sc);
  }).catch(() => null);
}
const turnstileToken = () => { try { return turnstileId != null ? window.turnstile.getResponse(turnstileId) || null : null; } catch { return null; } };
signup.addEventListener('submit', e => { e.preventDefault(); submit(signup, async d => {
  try { await signUp({ name: String(d.name).trim(), email: d.email, password: d.password, turnstileToken: turnstileToken() }); }
  finally { try { if (turnstileId != null) window.turnstile.reset(turnstileId); } catch { /* a token is single-use */ } }
  // The date of birth is set once on the CommandAGI account (immutable there); a failure to set it is not a failed sign-up.
  await setProfile({ birthdate: d.birthdate }).catch(() => null);
  // The co-founder (GPT-6 Luna) may use the accounts the founder connects: the founder's own floor, set once here.
  await allowCofounderAccounts({ atSignUp: true }).catch(() => null);
}); });
signin.addEventListener('submit', e => { e.preventDefault(); submit(signin, d => signIn({ email: d.email, password: d.password })); });
// The forms send nothing until this module has bound them (auth/index.html stops a native submit, which would put the
// password in the address while the page's modules are still on their way); a driven browser waits for this mark.
document.documentElement.dataset.auth = 'ready';
