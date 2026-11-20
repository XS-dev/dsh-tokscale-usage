import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { apply } from '../index.mjs';

const work = fileURLToPath(new URL('./.work/loading/', import.meta.url));
const quiet = { info() {}, warn() {} };
const config = { tokscaleBin: process.execPath };
const storage = () => {
  fs.mkdirSync(work, { recursive: true });
  process.env.DSH_HOME = fs.mkdtempSync(path.join(work, 'home-'));
  process.env.TOKSCALE_CONFIG_DIR = process.env.DSH_HOME;
};
const report = { entries: [{ client: 'dsh', provider: 'test', model: 'test/model', input: 10, output: 5, cacheRead: 2, cacheWrite: 0, reasoning: 3, messageCount: 1, cost: 0 }],
  totalInput: 10, totalOutput: 5, totalCacheRead: 2, totalCacheWrite: 0, totalMessages: 1, totalCost: 0 };

function dashboard() {
  const routes = new Map();
  const { store } = apply({ logger: () => quiet, get: name => name === 'webServer' ? {
    register: route => { routes.set(route.path, route.handler); return () => {}; },
  } : null }, config);
  return { store, async request(query, route = 'cached-report') {
    const pathname = '/tokscale-usage/' + route;
    const handle = routes.get(pathname);
    if (!handle) return { code: 404 };
    let code, body, headers;
    await handle({ method: 'GET', url: pathname + '?' + query }, {
      writeHead(status, values) { code = status; headers = values; }, end(value) { if (value) body = JSON.parse(value); },
    });
    return { code, headers, body };
  } };
}

test('all/today cache-only lookup is fast on a miss and retrieves a persisted exact-scope report', async t => {
  storage();
  const { store, request } = dashboard();
  t.after(() => store.dispose());
  const calls = [];
  store._runView = async ({ sub }) => { calls.push(sub || 'report'); await delay(120); return { data: report, args: ['-c', 'dsh'] }; };
  const params = 'client=all&range=today';
  const start = performance.now();
  const miss = await request(params);
  const missMs = performance.now() - start;
  assert.deepEqual(calls, []);
  const coldStart = performance.now();
  const scanned = await request(params, 'report');
  t.diagnostic(`Cache lookup ${missMs.toFixed(1)} ms (HTTP ${miss.code}); cold report ${(performance.now() - coldStart).toFixed(1)} ms with a 120 ms synthetic runner`);
  assert.equal(miss.code, 204);
  assert.equal(miss.headers['cache-control'], 'no-store');
  assert.equal(miss.body, undefined);
  assert.equal((await request('range=custom')).code, 400);
  assert.equal(scanned.code, 200);
  assert.equal(scanned.body.metrics.totalTokens, 20);
  assert.equal(scanned.body.meta.trendsAvailable, false);
  assert.deepEqual(calls, ['report']);

  const reopened = dashboard();
  t.after(() => reopened.store.dispose());
  reopened.store._runView = async () => assert.fail('cache-only request started a scan');
  const hitStart = performance.now();
  const hit = await reopened.request(params + '');
  t.diagnostic(`Persisted cache hit ${(performance.now() - hitStart).toFixed(1)} ms`);
  assert.equal(hit.code, 200);
  assert.deepEqual(hit.body, scanned.body);
  const modelHit = await reopened.request(params + '&model=test%2Fmodel');
  assert.equal(modelHit.body.metrics.totalTokens, 20);
  assert.equal(modelHit.body.meta.model, 'test/model');
  assert.equal((await reopened.request('client=dsh&range=today')).code, 204);
});

test('cache lookup bypasses an occupied scan gate and never forces refresh', async t => {
  storage();
  const { store, request } = dashboard();
  t.after(() => store.dispose());
  let releaseScan;
  let signalStarted;
  const scanStarted = new Promise(resolve => { signalStarted = resolve; });
  const blockingScan = new Promise(resolve => { releaseScan = resolve; });
  const calls = [];
  store._runView = async ({ range }) => {
    calls.push(range);
    signalStarted();
    await blockingScan;
    return { data: report, args: ['-c', 'dsh'] };
  };
  const running = request('client=all&range=month', 'report');
  await scanStarted;
  try {
    const lookup = request('client=all&range=today&refresh=true');
    const miss = await Promise.race([lookup, delay(500, null, { ref: false })]);
    assert.equal(miss?.code, 204, 'cached report must resolve while an unrelated scan is still running');
  } finally {
    releaseScan();
    await running;
  }
  assert.deepEqual(calls, ['month']);
});
