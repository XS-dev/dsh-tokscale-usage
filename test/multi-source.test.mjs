import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Store } from '../lib/store.mjs';
import { buildArgs } from '../lib/tokscale.mjs';

const quiet = { info() {}, warn() {} };
const workRoot = fileURLToPath(new URL('./.work/multi-source/', import.meta.url));
fs.mkdirSync(workRoot, { recursive: true });
const home = () => { process.env.DSH_HOME = fs.mkdtempSync(path.join(workRoot, 'home-')); };
const report = { entries: [
  { client: 'dsh', model: 'a', input: 10, output: 2, cacheRead: 8, cacheWrite: 1, reasoning: 0, messageCount: 2, cost: 1 },
  { client: 'codex', model: 'b', input: 30, output: 3, cacheRead: 9, cacheWrite: 2, reasoning: 0, messageCount: 4, cost: 2 },
], totalInput: 40, totalOutput: 5, totalCacheRead: 17, totalCacheWrite: 3, totalMessages: 6, totalCost: 3 };

test('multi-source filters, independent caches and stale failures', async () => {
  home(); let fail = false; const calls = [];
  const runView = async opts => {
    calls.push(opts);
    if (fail) throw new Error('scan failed');
    return { args: buildArgs(opts), data: opts.sub ? { entries: [{ hour: '2026-11-01 09:00', input: 40, output: 5, cacheRead: 17, cacheWrite: 3 }] } : report };
  };
  const store = new Store({ client: 'dsh' }, quiet, { runView });
  const all = await store.query({ range: 'today' });
  assert.equal(calls[0].client, 'all');
  assert.equal(all.metrics.totalTokens, 65);
  assert.ok(all.sources.some(s => s.name === 'codex' && s.status === 'unknown'));
  assert.equal(all.daily[0].input, 40);
  const baseCount = calls.length;
  const filtered = await store.query({ range: 'today', model: 'a' });
  assert.equal(calls.length, baseCount, 'model filtering reuses the matching complete report');
  assert.equal(filtered.metrics.totalTokens, 21);
  assert.deepEqual(filtered.daily, []);
  assert.equal(filtered.meta.trendsAvailable, false);
  assert.deepEqual(filtered.models, ['a', 'b']);
  const count = calls.length;
  await store.query({ range: 'today' });
  assert.equal(calls.length, count);
  fail = true;
  const stale = await store.query({ range: 'today', refresh: true });
  assert.equal(stale.meta.stale, true);
  assert.equal(stale.meta.updatedAt, all.meta.updatedAt);
  assert.match(stale.meta.errors.report, /scan failed/);
  assert.equal((await store.query({ range: 'today', model: 'a' })).meta.stale, true);
  store.dispose();
});

test('engine environment changes separate cached reports and old reports are marked stale', async () => {
  home(); const calls = [];
  const runView = async opts => { calls.push(opts); return { args: buildArgs(opts), data: opts.sub ? { entries: [] } : report }; };
  const prior = process.env.TOKSCALE_BIN;
  const store = new Store({}, quiet, { runView });
  try {
    process.env.TOKSCALE_BIN = 'engine-one';
    await store.query({ client: 'dsh', range: 'today' });
    const cached = [...store._queries.values()][0];
    cached.meta.updatedAt = Date.now() - 600001;
    assert.equal((await store.query({ client: 'dsh', range: 'today' })).meta.stale, true);
    const count = calls.length;
    process.env.TOKSCALE_BIN = 'engine-two';
    await store.query({ client: 'dsh', range: 'today' });
    assert.ok(calls.length > count, 'new engine cannot reuse the old engine cache');
  } finally {
    if (prior === undefined) delete process.env.TOKSCALE_BIN; else process.env.TOKSCALE_BIN = prior;
    store.dispose();
  }
});

test('reasoning is included in totals and suppresses incomplete hourly trends', async () => {
  home(); const calls = [];
  const runView = async opts => {
    calls.push(opts);
    return { args: buildArgs(opts), data: { ...report, entries: report.entries.map((entry, i) => ({ ...entry, reasoning: i ? 7 : 2 })) } };
  };
  const store = new Store({}, quiet, { runView });
  const result = await store.query({ range: 'today' });
  assert.equal(result.metrics.reasoning, 9);
  assert.equal(result.metrics.totalTokens, 74);
  assert.equal(result.meta.trendsAvailable, false);
  assert.deepEqual(result.daily, []);
  assert.equal(calls.length, 1);
  store.dispose();
});

test('model aggregation preserves missing values for cached and fresh queries', async () => {
  home();
  const rows = [{ ...report.entries[0] }, { ...report.entries[0], output: undefined, cacheRead: undefined, reasoning: undefined, cost: undefined }];
  const data = { ...report, entries: rows };
  const store = new Store({}, quiet, { runView: async opts => ({ args: buildArgs(opts), data }) });
  const fresh = await store.query({ range: 'today', model: 'a' });
  assert.equal(fresh.metrics.input, 20);
  assert.equal(fresh.metrics.output, null);
  assert.equal(fresh.metrics.cacheRead, null);
  assert.equal(fresh.metrics.cacheHitRate, null);
  assert.equal(fresh.metrics.reasoning, null);
  assert.equal(fresh.metrics.totalTokens, null);
  assert.equal(fresh.metrics.cost, null);
  await store.query({ range: 'today' });
  const cached = await store.query({ range: 'today', model: 'a' });
  assert.equal(cached.metrics.output, null);
  assert.equal(cached.metrics.cacheHitRate, null);
  assert.equal(cached.metrics.totalTokens, null);
  store.dispose();
});

test('queued cancellation does not start runner and invalid inputs are rejected', async () => {
  home(); let release; const started = [];
  const runView = async opts => { started.push(opts); await new Promise(r => { release = r; }); return { data: report }; };
  const store = new Store({}, quiet, { runView });
  const first = store.getReport({ range: 'week' });
  await new Promise(r => setImmediate(r));
  const controller = new AbortController();
  const second = store.query({ range: 'yesterday', signal: controller.signal });
  controller.abort(); release();
  await first;
  await assert.rejects(second, /aborted/);
  assert.equal(started.length, 1);
  await assert.rejects(store.query({ client: 'dsh&bad' }), /invalid/);
  await assert.rejects(store.query({ range: 'custom', since: 'bad', until: '2026-11-02' }), /invalid/);
  store.dispose();
});
