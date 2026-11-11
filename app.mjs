// VibeStartup's server module: CommandAGI's site hosting runs it for every path no static file answers. It serves one
// thing, `/brand.js`: which CommandAGI API the page talks to. Everything else the app does is the founder's own
// CommandAGI token calling the API from the browser (docs/ARCHITECTURE.md). A site's worker cannot reach the
// platform's worker, so this module holds no account, no database and no model call.
//
// This file is one module because site hosting uploads it verbatim as app.mjs; it imports nothing.

const BRAND = {
  name: 'VibeStartup',
  client: 'vibestartup',
  support: 'hello@vibestartup.pro',
  home: 'https://vibestartup.pro',
  mailDomain: 'commandagi.email',
  company: 'CommandAGI Inc',
};

/** Which API serves this host: a site env var first, then the host's stack (dev addresses carry `--dev`). */
export function apiFor(host, env = {}) {
  if (env.VIBESTARTUP_API) return String(env.VIBESTARTUP_API).replace(/\/+$/, '');
  const h = String(host ?? '').toLowerCase();
  if (/--dev\.commandagi\.app$/.test(h)) return 'https://api-dev.commandagi.com';
  return 'https://api.commandagi.com';
}

export function brandScript(host, env = {}) {
  const h = String(host ?? '').toLowerCase();
  const stack = env.VIBESTARTUP_API ? 'local' : /--dev\.commandagi\.app$/.test(h) ? 'dev' : 'production';
  const brand = { ...BRAND, api: apiFor(host, env), stack, origin: `https://${h}` };
  return `window.BRAND = ${JSON.stringify(brand)};\n`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/brand.js') {
      return new Response(brandScript(url.host, env), {
        headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=300' },
      });
    }
    // A console address with a query, or a folder path, is a static page: site hosting serves the files first, so
    // only a miss reaches here. Answer the miss plainly.
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  },
};
