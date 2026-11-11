// Run VibeStartup on this computer: the site's static files and app.mjs (for /brand.js), pointed at a CommandAGI API.
// The API is a local platform this script starts (the whole api worker under workerd, its own database and files,
// the checkout's service accounts so the co-founder's model calls are real), or an origin you name.
//
//   node test/local.mjs [--port 4180] [--platform-dir DIR] [--api https://api-dev.commandagi.com] [--no-build]
//
// --api           use that API instead of starting a local platform
// --platform-dir  the local platform's state folder (default: a fresh temporary folder, so the sign-up cap is fresh)
// --no-build      start the platform from the build already in <platform-dir>/dist
//
// COMMANDAGI_ROOT is the CommandAGI checkout the platform is built from (default: the checkout this folder is mounted
// in, five levels up); COMMANDAGI_ENV_ROOT is where the .env cascade is read (default: COMMANDAGI_ROOT).
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { existsSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const COMMANDAGI_ROOT = process.env.COMMANDAGI_ROOT || path.resolve(root, '../../../..');
const ENV_ROOT = process.env.COMMANDAGI_ENV_ROOT || (existsSync(path.join(COMMANDAGI_ROOT, '.env')) ? COMMANDAGI_ROOT : path.resolve(root, '../../../..'));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.md': 'text/markdown; charset=utf-8',
};

/** The service accounts as the worker reads them: one `SVC__<SERVICE>__<ACCOUNT>` binding per account. */
async function serviceBindings() {
  try {
    const { localAccounts } = await import(pathToFileURL(path.join(ENV_ROOT, 'scripts/release/service-accounts.mjs')).href);
    const out = {};
    for (const [service, accounts] of Object.entries(localAccounts({ root: ENV_ROOT }).services ?? {})) {
      for (const a of accounts) {
        const { fields, id, name, service: _s, ...attributes } = a;
        out[`SVC__${service.toUpperCase().replace(/-/g, '_')}__${String(name).toUpperCase().replace(/-/g, '_')}`] = JSON.stringify({ fields, ...attributes });
      }
    }
    return out;
  } catch (e) {
    console.warn(`no service accounts (${e.message}): the co-founder has no model key on this run`);
    return {};
  }
}

/**
 * The cloud://global folder the local platform serves: the checkout's, copied, with the daily sign-up cap raised.
 * A fresh platform's migrations make about 70 accounts dated today, and the platform's cap (5 a day off production,
 * `signup.dailyCap` in global settings.json) counts them, so a journey's sign-ups would be refused `signup_capped`.
 */
async function globalDirWithCap(stateDir) {
  // The seeded copy where a seed run made one, else the checkout's own `global/` (a clean checkout has no seed/).
  const seeded = path.join(COMMANDAGI_ROOT, 'seed/user-commandagi/global');
  const source = existsSync(seeded) ? seeded : path.join(COMMANDAGI_ROOT, 'global');
  const target = path.join(stateDir, 'global');
  if (!existsSync(target)) cpSync(source, target, { recursive: true });
  const file = path.join(target, 'settings.json');
  const settings = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : {};
  settings['signup.dailyCap'] = Number(process.env.VIBESTARTUP_SIGNUP_CAP || 10000);
  await writeFile(file, JSON.stringify(settings, null, 2) + '\n');
  return target;
}

/** Start the local CommandAGI platform from the checkout. → { base, stop } */
export async function startPlatform({ dir, build = true } = {}) {
  const { startCheckoutPlatform } = await import(pathToFileURL(path.join(COMMANDAGI_ROOT, 'scripts/workbench/local-platform.mjs')).href);
  const stateDir = dir ?? await mkdtemp(path.join(tmpdir(), 'vibestartup-platform-'));
  const p = await startCheckoutPlatform({ dir: stateDir, build, vars: await serviceBindings(), globalDir: await globalDirWithCap(stateDir) });
  return { base: p.base, dir: stateDir, stop: () => p.stop(), logFile: p.logFile };
}

/** The site on this computer, against `api`. → { url, close } */
export async function startSite({ port = 0, api } = {}) {
  const app = (await import(pathToFileURL(path.join(root, 'app.mjs')).href)).default;
  const env = { VIBESTARTUP_API: api };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const candidates = rel === '' || rel.endsWith('/') ? [`${rel}index.html`] : [rel, `${rel}/index.html`, `${rel}.html`];
    let file = null;
    for (const c of candidates) {
      const abs = path.join(root, c);
      if (!abs.startsWith(root + path.sep)) continue;
      // No dot file of the site is served; the checkout itself may live under a dot folder (a worktree).
      if (existsSync(abs) && !c.split('/').some(part => part.startsWith('.'))) { file = abs; break; }
    }
    let response;
    if (file) {
      response = new Response(await readFile(file), { headers: { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' } });
    } else {
      const request = new Request(`http://127.0.0.1${url.pathname}${url.search}`, { method: req.method, headers: req.headers });
      response = await app.fetch(request, env, {});
    }
    const headers = {};
    for (const [k, v] of response.headers) headers[k] = v;
    res.writeHead(response.status, headers);
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => server.close(r)) };
}

/** Everything: a platform (unless `api` names one) and the site. → { url, api, stop } */
export async function startLocal({ port = 0, api = null, platformDir = null, build = true } = {}) {
  const platform = api ? null : await startPlatform({ dir: platformDir, build });
  const site = await startSite({ port, api: api ?? platform.base });
  return { url: site.url, api: api ?? platform.base, platform, stop: async () => { await site.close(); await platform?.stop(); } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
  const local = await startLocal({ port: Number(arg('port', 4180)), api: arg('api', null), platformDir: arg('platform-dir', null), build: !process.argv.includes('--no-build') });
  console.log(`VibeStartup on ${local.url} (API ${local.api}${local.platform ? `, platform state ${local.platform.dir}, log ${local.platform.logFile}` : ''})`);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => local.stop().finally(() => process.exit(0)));
}
