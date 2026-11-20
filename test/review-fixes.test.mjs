// Hermetic regression tests for Store accounting, serial scan gating, LRU cache pruning,
// 24h hourly padding, monthly spend projection, and timeMetrics scope gating.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  Store, metrics, deriveDaily, deriveTodayHourly, deriveHourlyWindow, computeMonthlyProjection, todayDateLocal,
} from '../lib/store.mjs';
import { buildArgs } from '../lib/tokscale.mjs';
import { formatSummary } from '../lib/views.mjs';

const workRoot = fileURLToPath(new URL('./.work/review-fixes/', import.meta.url));
fs.mkdirSync(workRoot, { recursive: true });

const quiet = { info() {}, warn() {}, error() {} };
let homeSeq = 0;
function isolatedHome() {
  const dir = fs.mkdtempSync(path.join(workRoot, 'home-' + (homeSeq++) + '-'));
  process.env.DSH_HOME = dir;
  return dir;
}

function reportFor(tag, { input = 100, output = 10, cacheRead = 1000, cacheWrite = 0, messages = 3, cost = 0 } = {}) {
  return {
    groupBy: 'client,model',
    entries: [{ client: 'dsh', model: 'synth/' + tag, provider: 'synth', input, output, cacheRead, cacheWrite, reasoning: 0, messageCount: messages, cost }],
    totalInput: input, totalOutput: output, totalCacheRead: cacheRead, totalCacheWrite: cacheWrite,
    totalMessages: messages, totalCost: cost, processingTimeMs: 1,
  };
}

function recordingRunner(overrides = {}) {
  const calls = [];
  const runner = async (viewOpts, { signal } = {}) => {
    const args = buildArgs(viewOpts);
    calls.push(args.join(' '));
    if (overrides.hook) await overrides.hook(args, signal);
    const tag = args.includes('--today') ? 'today'
      : args.includes('--yesterday') ? 'yesterday'
      : args.includes('--week') ? 'week'
      : args.includes('--since') ? 'custom'
      : args.includes('--month') ? 'month'
      : 'all';
    if (overrides.fail && overrides.fail(args)) throw new Error('synthetic scan failure');
    const data = args[0] === 'hourly'
      ? { entries: [] }
      : reportFor(tag, { input: 100 + tag.length * 1000 });
    return { data, bin: { kind: 'file', path: 'synthetic.exe' }, args, ms: 1 };
  };
  return { runner, calls };
}

const newStore = (runner, cfg = {}) => { isolatedHome(); return new Store({ client: 'dsh', ...cfg }, quiet, { runView: runner }); };

test('totalTokens = input+output+cacheRead+cacheWrite+reasoning across metrics, text, daily, and hourly', () => {
  const rep = reportFor('x', { input: 100, output: 10, cacheRead: 1000, cacheWrite: 5 });
  const m = metrics(rep);
  assert.equal(m.totalTokens, 1115);
  assert.match(formatSummary({ report: rep, range: 'today' }, m), /Total 1\.1K tokens/);

  const daily = deriveDaily({ entries: [{ hour: '2026-11-17 09:00', input: 100, output: 10, cacheRead: 1000, cacheWrite: 5, messageCount: 1, cost: 0 }] });
  assert.equal(daily[0].totalTokens, 1115);
  const hourly = deriveTodayHourly({ entries: [{ hour: '2026-11-17 09:00', input: 100, output: 10, cacheRead: 1000, cacheWrite: 5, messageCount: 1, cost: 0 }] }, '2026-11-17');
  assert.equal(hourly[0].totalTokens, 1115);

  const withReasoning = { totalInput: 100, totalOutput: 10, totalCacheRead: 1000, totalCacheWrite: 0, entries: [{ reasoning: 50 }], totalMessages: 1, totalCost: 0 };
  assert.equal(metrics(withReasoning).reasoning, 50);
  assert.equal(metrics(withReasoning).totalTokens, 1160);
});

test('deriveHourlyWindow with pad24 fills uniform 00:00..23:00 buckets when activity exists', () => {
  const empty = deriveHourlyWindow({ entries: [] }, { pad24: true });
  assert.equal(empty.length, 0);

  const padded = deriveHourlyWindow({
    entries: [
      { hour: '2026-11-20 03:00', input: 40, output: 10, cacheRead: 0, cacheWrite: 0, reasoning: 0, clients: ['dsh'] },
      { hour: '2026-11-20 19:00', input: 80, output: 20, cacheRead: 0, cacheWrite: 0, reasoning: 0, clients: ['dsh'] },
    ],
  }, { sinceDate: '2026-11-20', untilDate: '2026-11-20', pad24: true });
  assert.equal(padded.length, 24);
  assert.equal(padded[0].hour, '00:00');
  assert.equal(padded[0].totalTokens, 0);
  assert.equal(padded[3].hour, '03:00');
  assert.equal(padded[3].totalTokens, 50);
  assert.equal(padded[19].hour, '19:00');
  assert.equal(padded[19].totalTokens, 100);
  assert.equal(padded[23].hour, '23:00');
});

test('computeMonthlyProjection & buildRichDashboardPayload gate timeMetrics on unfiltered client/model', async () => {
  const today = todayDateLocal();
  const graph = {
    contributions: [{
      date: today,
      intensity: 3,
      clients: [
        { client: 'codex', modelId: 'gpt-6.2', tokens: { input: 1000, output: 200, cacheRead: 0, cacheWrite: 0, reasoning: 0 }, cost: 2.0, messages: 5 },
        { client: 'dsh', modelId: 'ds-v3', tokens: { input: 500, output: 100, cacheRead: 0, cacheWrite: 0, reasoning: 0 }, cost: 0.5, messages: 3 },
      ],
    }],
  };
  const proj = computeMonthlyProjection(graph, { now: new Date(2026, 10, 15) }); // Nov 15 (30 days in Nov)
  assert.equal(proj.daysInMonth, 30);
  assert.equal(proj.daysElapsed, 15);

  const { runner } = recordingRunner();
  const store = newStore(runner);
  store._base.graph60d = graph;
  store._base.graph60dAt = Date.now();
  store._base.timeMetrics = { total_active_time_ms: 99000, max_concurrent_sessions: 4 };

  const allPayload = await store.buildRichDashboardPayload({ client: 'all', model: 'all', range: 'today' });
  assert.deepEqual(allPayload.timeMetrics, { total_active_time_ms: 99000, max_concurrent_sessions: 4 });
  assert.ok(allPayload.monthlyProjection.projectedCost > 0);

  const filteredClient = await store.buildRichDashboardPayload({ client: 'codex', model: 'all', range: 'today' });
  assert.equal(filteredClient.timeMetrics, null, 'global timeMetrics must not leak into single-agent filter');

  const filteredModel = await store.buildRichDashboardPayload({ client: 'all', model: 'gpt-6.2', range: 'today' });
  assert.equal(filteredModel.timeMetrics, null, 'global timeMetrics must not leak into single-model filter');
  store.dispose();
});

test('concurrent store.query calls never exceed one in-flight tokscale process and dedupe identical scans', async () => {
  let active = 0, peak = 0;
  const { runner, calls } = recordingRunner({
    hook: async () => { active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, 15)); active--; },
  });
  const store = newStore(runner);
  const [w1, w2] = await Promise.all([
    store.query({ client: 'dsh', range: 'week', refresh: true }),
    store.query({ client: 'dsh', range: 'week', refresh: true }),
    store.query({ client: 'dsh', range: 'yesterday', refresh: true }),
  ]);
  assert.equal(peak, 1, 'peak concurrent scans was ' + peak);
  assert.equal(calls.filter(c => c.startsWith('-c dsh') && c.includes('--week')).length, 1, 'deduped identical in-flight week scan');
  assert.equal(w1.metrics.totalInput, w2.metrics.totalInput);
  store.dispose();
});

test('dispose() aborts an in-flight scan and refuses new queries', async () => {
  let aborted = false;
  const { runner } = recordingRunner({
    hook: async (_args, signal) => {
      await new Promise((resolve, reject) => {
        const tm = setTimeout(resolve, 5000);
        signal?.addEventListener('abort', () => { aborted = true; clearTimeout(tm); reject(new Error('aborted')); }, { once: true });
      });
    },
  });
  const store = newStore(runner);
  const p = store.query({ client: 'dsh', range: 'week' }).then(() => 'resolved', e => 'rejected:' + e.message);
  await new Promise(r => setTimeout(r, 20));
  store.dispose();
  const outcome = await p;
  assert.equal(aborted, true);
  assert.match(outcome, /^rejected/);
  await assert.rejects(() => store.query({ client: 'dsh', range: 'week' }), /disposed/);
});

test('_pruneQueryCacheFiles removes legacy cache.json and bounds query-*.json files to maxFiles', async () => {
  const { runner } = recordingRunner();
  const store = newStore(runner);
  fs.mkdirSync(store.dir, { recursive: true });
  fs.writeFileSync(path.join(store.dir, 'cache.json'), '{}');
  fs.writeFileSync(path.join(store.dir, 'cache-0123456789abcdef.json'), '{}');
  for (let i = 0; i < 12; i++) {
    const f = path.join(store.dir, `query-${String(i).padStart(64, '0')}.json`);
    fs.writeFileSync(f, '{}');
    const tSec = 1700000000 + i * 10;
    fs.utimesSync(f, tSec, tSec);
  }
  store._pruneQueryCacheFiles(8);
  const remaining = fs.readdirSync(store.dir);
  assert.equal(remaining.some(n => n.startsWith('cache')), false, 'legacy v0.1 cache files deleted');
  assert.equal(remaining.filter(n => n.startsWith('query-')).length, 8, 'kept only 8 newest query cache files');
  store.dispose();
});
