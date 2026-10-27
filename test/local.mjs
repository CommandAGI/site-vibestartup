// Run VibeStartup's app on this computer: the site's static files and its server module (app.mjs), with the site's
// database standing in as an in-memory SQLite. D1 is the one edge this cannot run here, so it is the one fake.
//
//   node test/local.mjs [--port 4180] [--db /tmp/vibestartup.db]
//
// The page is served at http://127.0.0.1:<port>/ and the API at /api/*. The model key comes from
// COMMANDAGI_ENV_ROOT's cascade or from the host's secrets file when VIBESTARTUP_USE_LOCAL_SECRETS=1.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm',
};

/** D1's statement surface over node:sqlite: prepare/bind/first/all/run. */
function d1(file = ':memory:') {
  const db = new DatabaseSync(file);
  return {
    prepare(sql) {
      let args = [];
      const stmt = {
        bind(...values) { args = values; return stmt; },
        async first() { const row = db.prepare(sql).get(...args); return row ?? null; },
        async all() { return { results: db.prepare(sql).all(...args), success: true }; },
        async run() { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: r.changes } }; },
      };
      return stmt;
    },
    async batch(list) { const out = []; for (const s of list) out.push(await s.run()); return out; },
    async exec(sql) { db.exec(sql); },
  };
}

/** The model key for a local run: the environment first, then this host's own secrets file. Never printed. */
async function modelKey() {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  if (process.env.VIBESTARTUP_USE_LOCAL_SECRETS === '1') {
    const file = path.join(process.env.HOME ?? '', '.commandagi/.secrets/env.json');
    try {
      const store = JSON.parse(await readFile(file, 'utf8'));
      return store.SVC__OPENROUTER__MAIN__API_KEY ?? null;
    } catch { return null; }
  }
  return null;
}

export async function startLocal({ port = 0, dbFile = ':memory:', model = undefined } = {}) {
  const app = (await import(pathToFileURL(path.join(root, 'app.mjs')).href)).default;
  const env = { DB: d1(dbFile), OPENROUTER_API_KEY: model ?? await modelKey(), COFOUNDER_MODEL: process.env.COFOUNDER_MODEL ?? 'deepseek/deepseek-chat-v3.1' };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const hasBody = chunks.length > 0;
    const request = new Request(`http://127.0.0.1${url.pathname}${url.search}`, {
      method: req.method,
      headers: req.headers,
      ...(hasBody ? { body: Buffer.concat(chunks) } : {}),
    });
    let response;
    if (url.pathname.startsWith('/api/')) {
      response = await app.fetch(request, env, {});
    } else {
      const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const candidates = rel === '' || rel.endsWith('/') ? [`${rel}index.html`] : [rel, `${rel}/index.html`, `${rel}.html`];
      let file = null, found = null;
      for (const c of candidates) {
        const abs = path.join(root, c);
        if (!abs.startsWith(root + path.sep)) continue;
        if (existsSync(abs)) { file = abs; found = c; break; }
      }
      if (file) {
        response = new Response(await readFile(file), { headers: { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' } });
      } else {
        response = new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
      }
    }
    const headers = {};
    for (const [k, v] of response.headers) headers[k] = k === 'set-cookie' ? undefined : v;
    const cookies = response.headers.getSetCookie?.() ?? [];
    res.writeHead(response.status, { ...headers, ...(cookies.length ? { 'set-cookie': cookies.map(c => c.replace('; Secure', '')) } : {}) });
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}`, env, close: () => new Promise(r => server.close(r)) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
  const { url } = await startLocal({ port: Number(arg('port', 4180)), dbFile: arg('db', ':memory:') });
  console.log(`VibeStartup on ${url}`);
}
