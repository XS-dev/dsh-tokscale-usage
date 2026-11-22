import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply } from '../index.mjs';
import { runTokscaleJson } from '../lib/tokscale.mjs';

const root = fileURLToPath(new URL('./.work/http-cancel/', import.meta.url));
fs.mkdirSync(root, { recursive: true });
process.env.DSH_HOME = fs.mkdtempSync(path.join(root, 'home-'));
const waitFor = async fn => { for (let i = 0; i < 200; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 20)); } throw new Error('timed out waiting for child'); };

test('real HTTP cancellation terminates only the owned process and releases the serial gate', async t => {
  const routes = [];
  const ctx = { logger: () => ({ info() {}, warn() {} }), get: name => name === 'webServer' ? { register: r => { routes.push(r); return () => {}; } } : null, effect() {} };
  const { store } = apply(ctx, { tokscaleBin: process.execPath });
  const marker = path.join(process.env.DSH_HOME, 'pid');
  let calls = 0;
  store._runView = async (opts, { signal }) => {
    calls++;
    if (opts.client === 'all') {
      const program = `require('fs').writeFileSync(${JSON.stringify(marker)}, String(process.pid)); setInterval(() => {}, 1000)`;
      await runTokscaleJson({ kind: 'file', path: process.execPath }, ['-e', program], { signal, timeoutMs: 10000 });
      throw new Error('unexpected child completion');
    }
    return { data: { entries: [{ client: 'dsh', model: 'test', input: 1, reasoning: 1 }], totalInput: 1 }, args: ['-c', 'dsh'] };
  };
  const server = http.createServer((req, res) => {
    const route = routes.find(r => r.path === new URL(req.url, 'http://localhost').pathname);
    if (route) route.handler(req, res); else { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { store.dispose(); server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const id = 'a'.repeat(32);
  const first = fetch(`${base}/tokscale-usage/report?client=all&range=today&requestId=${id}`);
  let pid;
  await waitFor(() => {
    if (!fs.existsSync(marker)) return false;
    pid = Number(fs.readFileSync(marker, 'utf8'));
    return Number.isSafeInteger(pid) && pid > 0;
  });
  const second = fetch(`${base}/tokscale-usage/report?client=dsh&range=today&refresh=true&requestId=${'b'.repeat(32)}`);
  const cancel = await fetch(`${base}/tokscale-usage/cancel?id=${id}`, { method: 'POST' });
  assert.equal(cancel.status, 202);
  assert.equal((await first).status, 499);
  assert.equal((await second).status, 200);
  assert.equal(calls, 2);
  await waitFor(() => { try { process.kill(pid, 0); return false; } catch (e) { return e.code === 'ESRCH'; } });
});

test('cancel arriving before report prevents child creation', async t => {
  const routes = [];
  const ctx = { logger: () => ({ info() {}, warn() {} }), get: n => n === 'webServer' ? { register: r => { routes.push(r); return () => {}; } } : null, effect() {} };
  const { store } = apply(ctx, { tokscaleBin: process.execPath });
  let calls = 0; store._runView = async () => { calls++; throw new Error('must not start'); };
  const server = http.createServer((req, res) => routes.find(r => r.path === new URL(req.url, 'http://localhost').pathname).handler(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { store.dispose(); server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`, id = 'c'.repeat(32);
  assert.equal((await fetch(`${base}/tokscale-usage/cancel?id=${id}`, { method: 'POST' })).status, 202);
  assert.equal((await fetch(`${base}/tokscale-usage/report?client=dsh&range=today&requestId=${id}`)).status, 499);
  assert.equal(calls, 0);
});

test('HTTP routes enforce DSH connection.requestRejection, DNS-rebinding Host fence, and Chrome 151+ portless loopback Origin', async t => {
  const routes = [];
  let gateImpl = null;
  let trustedHosts = ['dsh.internal.lan:3080'];
  const ctx = {
    logger: () => ({ info() {}, warn() {} }),
    get: n => {
      if (n === 'webServer') return { host: '10.0.0.9', register: r => { routes.push(r); return () => {}; } };
      if (n === 'connection') return { trustedHosts, requestRejection: req => gateImpl ? gateImpl(req) : undefined };
      return null;
    },
    effect() {},
  };
  const { store } = apply(ctx, { tokscaleBin: process.execPath });
  t.after(() => store.dispose());
  const statusRoute = routes.find(r => r.path === '/tokscale-usage/status');

  const invoke = async (headers = {}, method = 'GET') => {
    let statusCode = 0;
    let payload = '';
    const req = { method, url: '/tokscale-usage/status', headers };
    const res = {
      writeHead(code) { statusCode = code; },
      end(body = '') { payload = body; },
    };
    await statusRoute.handler(req, res);
    return { statusCode, body: payload ? JSON.parse(payload) : null };
  };

  // 1. DSH connection.requestRejection returns 401 -> 401
  gateImpl = () => 401;
  assert.equal((await invoke({ host: '127.0.0.1:3080' })).statusCode, 401);

  // 2. DSH connection.requestRejection throws -> fail closed (403)
  gateImpl = () => { throw new Error('auth broken'); };
  assert.equal((await invoke({ host: '127.0.0.1:3080' })).statusCode, 403);

  // 3. Gate passes -> DNS-rebinding Host (evil.com) refused (403) even with matching Origin
  gateImpl = () => undefined;
  assert.equal((await invoke({ host: 'evil.com', origin: 'http://evil.com' })).statusCode, 403);

  // 4. Cross-site Sec-Fetch-Site refused (403) even without Origin on GET
  assert.equal((await invoke({ host: '127.0.0.1:3080', 'sec-fetch-site': 'cross-site' })).statusCode, 403);

  // 5. Chrome 151+ port-less loopback Origin accepted (200)
  assert.equal((await invoke({ host: '127.0.0.1:3080', origin: 'http://127.0.0.1' })).statusCode, 200);

  // 6. Declared trustedHosts and concrete webServer.host accepted (200)
  assert.equal((await invoke({ host: 'dsh.internal.lan:3080', origin: 'http://dsh.internal.lan:3080' })).statusCode, 200);
  assert.equal((await invoke({ host: '10.0.0.9:3080', origin: 'http://10.0.0.9:3080' })).statusCode, 200);
});
