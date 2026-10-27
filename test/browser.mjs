// A small Chrome DevTools client for the journey: no Playwright, no dependency. It starts the system Chrome with a
// fresh profile, opens a page, and gives the journey click, type, read and screenshot over the DevTools protocol.
// Set CHROME_PATH to choose the binary (default: chromium-browser, then chromium, then google-chrome).
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const sleep = ms => new Promise(r => setTimeout(r, ms));

const BINARIES = [process.env.CHROME_PATH, '/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean);

function binary() {
  for (const b of BINARIES) if (existsSync(b)) return b;
  throw Error('no Chrome found: set CHROME_PATH');
}

/** Start Chrome on a free debugging port with a profile of its own. `started` collects children to kill. */
export async function startChrome(profile, started) {
  const port = 9500 + Math.floor(Math.random() * 400);
  const child = spawn(binary(), [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
    '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' });
  started.push(child);
  for (let i = 0; i < 100; i++) {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`).catch(() => null);
    if (r?.ok) break;
    await sleep(100);
  }
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = list.find(t => t.type === 'page');
  if (!target) throw Error('Chrome started no page');
  return target.webSocketDebuggerUrl;
}

/** The page: `send(method, params)`, `eval(js)`, `click`, `type`, `waitFor`, `shot`, and what went wrong. */
export async function page(wsUrl, { out, width = 1440, height = 900 } = {}) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  const problems = [];
  const requests = [];
  /** Cloudflare injects its own analytics beacon into a zone's pages; this site's CSP blocks it, and it is the
   *  platform's request, not the app's. Everything else that leaves the page is the app's own business. */
  const PLATFORM_REQUESTS = ['static.cloudflareinsights.com'];
  const requestUrls = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(Error(`${message.error.message}`)); else resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') problems.push(`exception: ${message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails?.text}`);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') problems.push(`console error: ${message.params.args.map(a => a.value ?? a.description ?? '').join(' ')}`);
    if (message.method === 'Network.requestWillBeSent') { requests.push(message.params.request.url); requestUrls.set(message.params.requestId, message.params.request.url); }
    if (message.method === 'Network.loadingFailed' && !message.params.canceled) {
      const url = requestUrls.get(message.params.requestId) ?? '';
      if (!PLATFORM_REQUESTS.some(p => url.includes(p))) problems.push(`request failed: ${message.params.errorText || 'blocked'} ${url || message.params.requestId}`);
    }
    for (const l of listeners) l(message);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 500 });
  if (out) await mkdir(out, { recursive: true });

  const evalJs = async (expression, awaitPromise = true) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };

  const loaded = () => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('the page did not finish loading')), 30000);
    const listener = m => { if (m.method === 'Page.loadEventFired') { clearTimeout(timer); listeners.splice(listeners.indexOf(listener), 1); resolve(); } };
    listeners.push(listener);
  });

  const goto = async url => {
    const wait = loaded();
    await send('Page.navigate', { url });
    await wait;
    await sleep(150);
  };

  const waitFor = async (expression, ms = 15000) => {
    const until = Date.now() + ms;
    for (;;) {
      try { if (await evalJs(expression)) return true; } catch { /* the page may be reloading */ }
      if (Date.now() > until) throw Error(`timed out: ${expression}`);
      await sleep(120);
    }
  };

  const rect = sel => evalJs(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height }; })()`);

  const click = async sel => {
    const box = await rect(sel);
    if (!box) throw Error(`nothing to click at ${sel}`);
    await evalJs(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: 'center', behavior: 'instant' })`);
    const at = await rect(sel);
    for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: 1 });
    await sleep(120);
  };

  /** Click what the words say, inside a selector's matches (a button by its label). */
  const clickText = async (sel, words) => {
    const found = await evalJs(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => (x.innerText || '').includes(${JSON.stringify(words)})); if (!e) return null; e.scrollIntoView({ block: 'center', behavior: 'instant' }); return true; })()`);
    if (!found) throw Error(`no ${sel} says "${words}"`);
    const at = await evalJs(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => (x.innerText || '').includes(${JSON.stringify(words)})); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: at.x, y: at.y, button: 'left', clickCount: 1 });
    await sleep(120);
  };

  const type = async text => {
    await send('Input.insertText', { text });
    await sleep(40);
  };

  const fill = async (sel, value) => {
    await click(sel);
    await evalJs(`document.querySelector(${JSON.stringify(sel)}).select?.()`);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 });
    await type(value);
  };

  const shot = async name => {
    const look = await evalJs(`({ sideways: document.documentElement.scrollWidth - innerWidth, height: document.documentElement.scrollHeight, width: innerWidth })`);
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: look.width, height: Math.min(look.height, 6000), scale: 1 } });
    if (out) await writeFile(path.join(out, `${name}.png`), Buffer.from(data, 'base64'));
    return look;
  };

  const text = sel => evalJs(`(document.querySelector(${JSON.stringify(sel)})?.innerText ?? '')`);

  const close = async () => { try { ws.close(); } catch { /* already closed */ } };

  return { send, eval: evalJs, goto, waitFor, click, clickText, type, fill, shot, text, close, problems, requests };
}

export async function withBrowser(fn, { out, width = 1440, height = 900 } = {}) {
  const profile = await mkdtemp(path.join(tmpdir(), 'vibestartup-chrome-'));
  const started = [];
  const wsu = await startChrome(profile, started);
  const p = await page(wsu, { out, width, height });
  try { return await fn(p); } finally {
    await p.close();
    for (const child of started) { try { child.kill('SIGKILL'); } catch { /* gone */ } }
  }
}
