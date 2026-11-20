// Regression tests for the code-review findings. Everything here is hermetic:
// DSH_HOME points at a temp dir and the Store gets an INJECTED synthetic runner,
// so no real tokscale scan ever runs and no real history is touched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Store, metrics, deriveDaily, deriveTodayHourly } from '../lib/store.mjs';
import { buildArgs } from '../lib/tokscale.mjs';
import { formatSummary } from '../lib/views.mjs';

const workRoot = fileURLToPath(new URL('./.work/review-fixes/', import.meta.url));
fs.mkdirSync(workRoot, { recursive: true });
process.env.DSH_HOME = fs.mkdtempSync(path.join(workRoot, 'home-'));

const quiet = { info() {}, warn() {}, error() {} };

// Each Store gets its OWN DSH_HOME so tests never read each other's cache.json.
let homeSeq = 0;
function isolatedHome() {
  const dir = fs.mkdtempSync(path.join(workRoot, 'home-' + (homeSeq++) + '-'));
  process.env.DSH_HOME = dir;
  return dir;
}

// Synthetic tokscale report: distinct totals per window so a mismatched label is
// detectable (e.g. "yesterday" data must not equal "today" data).
function reportFor(tag, { input = 100, output = 10, cacheRead = 1000, cacheWrite = 0, messages = 3, cost = 0 } = {}) {
  return {
    groupBy: 'client,model',
    entries: [{ client: 'dsh', model: 'synth/' + tag, provider: 'synth', input, output, cacheRead, cacheWrite, reasoning: 0, messageCount: messages, cost }],
    totalInput: input, totalOutput: output, totalCacheRead: cacheRead, totalCacheWrite: cacheWrite,
    totalMessages: messages, totalCost: cost, processingTimeMs: 1,
  };
}

// Records every argv it is asked to run and answers with a tag derived from it.
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
    const data = tag === 'month' && args[0] === 'hourly'
      ? { entries: [{ hour: '2026-11-17 09:00', input: 5, output: 1, cacheRead: 50, cacheWrite: 0, messageCount: 1, turnCount: 1, cost: 0 }], totalCost: 0 }
      : reportFor(tag, { input: 100 + tag.length * 1000 });
    return { data, bin: { kind: 'file', path: 'synthetic.exe' }, args, ms: 1 };
  };
  return { runner, calls };
}

const newStore = (runner, cfg = {}) => { isolatedHome(); return new Store({ client: 'dsh', ...cfg }, quiet, { runView: runner }); };

// ---------------------------------------------------------------------------
// Issue 1 — range/label correctness in getReport
// ---------------------------------------------------------------------------
test('getReport(yesterday) scans --yesterday and never returns today/month cache data', async () => {
  const { runner, calls } = recordingRunner();
  const store = newStore(runner);
  await store.refresh(); // populate today + month cache
  calls.length = 0;

  const out = await store.getReport({ range: 'yesterday' });
  assert.equal(out.range, 'yesterday');
  assert.equal(out.cached, false);
  assert.ok(calls.some(c => c.includes('--yesterday')), 'ran a --yesterday scan: ' + calls.join(' | '));
  // The payload must be the yesterday window's data, not the cached today view.
  assert.equal(out.report.entries[0].model, 'synth/yesterday');
  assert.notEqual(out.report.totalInput, store.state.views.today.totalInput);
  store.dispose();
});

test('getReport(week) and getReport(all) each scan their own window', async () => {
  const { runner, calls } = recordingRunner();
  const store = newStore(runner);
  await store.refresh();
  calls.length = 0;

  const wk = await store.getReport({ range: 'week' });
  assert.equal(wk.range, 'week');
  assert.equal(wk.report.entries[0].model, 'synth/week');
  assert.ok(calls.some(c => c.includes('--week')));

  calls.length = 0;
  const all = await store.getReport({ range: 'all' });
  assert.equal(all.range, 'all');
  assert.equal(all.report.entries[0].model, 'synth/all');
  assert.ok(calls.some(c => !c.includes('--today') && !c.includes('--month') && !c.includes('--week')), 'all = no date filter: ' + calls.join(' | '));
  store.dispose();
});

test('getReport(today|month) serve the matching cached view (no cross-wiring)', async () => {
  const { runner } = recordingRunner();
  const store = newStore(runner);
  await store.refresh();

  const t = await store.getReport({ range: 'today' });
  assert.equal(t.range, 'today');
  assert.equal(t.report.entries[0].model, 'synth/today');
  assert.equal(t.cached, true);

  const m = await store.getReport({ range: 'month' });
  assert.equal(m.range, 'month');
  assert.equal(m.report.entries[0].model, 'synth/month');
  store.dispose();
});

test('getReport(custom since/until) scans the custom window and labels it', async () => {
  const { runner, calls } = recordingRunner();
  const store = newStore(runner);
  const out = await store.getReport({ range: 'month', since: '2026-11-01', until: '2026-11-10' });
  assert.equal(out.range, '2026-11-01..2026-11-10');
  assert.ok(calls.some(c => c.includes('--since 2026-11-01') && c.includes('--until 2026-11-10')));
  store.dispose();
});

// ---------------------------------------------------------------------------
// Issue 2 — one token accounting rule everywhere
// ---------------------------------------------------------------------------
test('totalTokens = input+output+cacheRead+cacheWrite in metrics, text, daily and hourly', async () => {
  const rep = reportFor('x', { input: 100, output: 10, cacheRead: 1000, cacheWrite: 5 });
  const m = metrics(rep);
  assert.equal(m.totalTokens, 1115);

  const text = formatSummary({ report: rep, range: 'today' }, m);
  assert.match(text, /Total 1\.1K tokens/); // 1115 -> 1.1K, same number the KPI shows

  const daily = deriveDaily({ entries: [{ hour: '2026-11-17 09:00', input: 100, output: 10, cacheRead: 1000, cacheWrite: 5, messageCount: 1, cost: 0 }] });
  assert.equal(daily[0].totalTokens, 1115);
  const hourly = deriveTodayHourly({ entries: [{ hour: '2026-11-17 09:00', input: 100, output: 10, cacheRead: 1000, cacheWrite: 5, messageCount: 1, cost: 0 }] }, '2026-11-17');
  assert.equal(hourly[0].totalTokens, 1115);
});

test('normalized reasoning is added from model rows once', () => {
  const rep = { totalInput: 100, totalOutput: 10, totalCacheRead: 1000, totalCacheWrite: 0, entries: [{ reasoning: 50 }], totalMessages: 1, totalCost: 0 };
  assert.equal(metrics(rep).reasoning, 50);
  assert.equal(metrics(rep).totalTokens, 1160);
});

test('cost is passed through as the engine estimate, never re-derived', () => {
  const rep = reportFor('c', { cost: 0.6727017479999999 });
  assert.equal(metrics(rep).cost, 0.6727017479999999);
  const text = formatSummary({ report: rep, range: 'month' }, metrics(rep));
  assert.match(text, /estimate/i);
  assert.match(text, /not your actual bill/i);
});

// ---------------------------------------------------------------------------
// Issue 3 — honest freshness
// ---------------------------------------------------------------------------
test('failed scan keeps old data but does NOT advance updatedAt; snapshot reports stale', async () => {
  let fail = false;
  const { runner } = recordingRunner({ fail: () => fail });
  const store = newStore(runner);

  await store.refresh();
  const goodUpdatedAt = store.state.updatedAt;
  assert.ok(goodUpdatedAt > 0);
  assert.equal(store.snapshot().meta.stale, false);

  fail = true;
  const before = Date.now();
  await store.refresh();
  assert.equal(store.state.updatedAt, goodUpdatedAt, 'updatedAt must not advance on failure');
  assert.ok(store.state.attemptedAt >= before, 'attemptedAt advances');
  const snap = store.snapshot();
  assert.equal(snap.meta.stale, true);
  assert.ok(Object.keys(snap.meta.errors).length > 0);
  // Old data is still served (not destroyed).
  assert.ok(snap.today && snap.today.totalTokens > 0);
  store.dispose();
});

test('per-view success/attempt/error are tracked separately', async () => {
  let failView = null;
  const { runner } = recordingRunner({ fail: args => failView && args.includes(failView) });
  const store = newStore(runner);

  failView = '--today';
  await store.refresh();
  const vm = store.snapshot().meta.viewMeta;
  assert.equal(vm.today.successAt, 0, 'failed view has no success');
  assert.ok(vm.today.attemptAt > 0);
  assert.match(vm.today.error, /synthetic scan failure/);
  assert.ok(vm.month.successAt > 0, 'healthy sibling view still succeeded');
  store.dispose();
});

test('getReport surfaces the real error when a view never succeeded', async () => {
  const { runner } = recordingRunner({ fail: () => true });
  const store = newStore(runner);
  await store.refresh();
  await assert.rejects(() => store.getReport({ range: 'month' }), /synthetic scan failure/);
  store.dispose();
});

// ---------------------------------------------------------------------------
// Issue 4 — scan cost: serial gate, dedupe, cancellation
// ---------------------------------------------------------------------------
test('concurrent scans never exceed one in-flight tokscale process', async () => {
  let active = 0, peak = 0;
  const { runner } = recordingRunner({
    hook: async () => { active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, 15)); active--; },
  });
  const store = newStore(runner);
  await Promise.all([
    store.getReport({ range: 'week' }),
    store.getReport({ range: 'all' }),
    store.getReport({ range: 'yesterday' }),
    store.refresh(),
  ]);
  assert.equal(peak, 1, 'peak concurrent scans was ' + peak);
  store.dispose();
});

test('identical concurrent scans are deduped to a single process', async () => {
  const { runner, calls } = recordingRunner({ hook: async () => { await new Promise(r => setTimeout(r, 15)); } });
  const store = newStore(runner);
  const [a, b] = await Promise.all([
    store.getReport({ range: 'week' }),
    store.getReport({ range: 'week' }),
  ]);
  assert.equal(calls.filter(c => c.includes('--week')).length, 1, 'deduped: ' + calls.join(' | '));
  assert.equal(a.report.totalInput, b.report.totalInput);
  store.dispose();
});

test('dispose() aborts an in-flight scan and refuses new ones', async () => {
  let aborted = false;
  const { runner } = recordingRunner({
    hook: async (_args, signal) => {
      await new Promise((resolve, reject) => {
        const t = setTimeout(resolve, 5000);
        signal?.addEventListener('abort', () => { aborted = true; clearTimeout(t); reject(new Error('aborted')); }, { once: true });
      });
    },
  });
  const store = newStore(runner);
  const p = store.getReport({ range: 'week' }).then(() => 'resolved', e => 'rejected:' + e.message);
  await new Promise(r => setTimeout(r, 20));
  store.dispose();
  const outcome = await p;
  assert.equal(aborted, true, 'in-flight scan received the abort signal');
  assert.match(outcome, /^rejected/);
  await assert.rejects(() => store.getReport({ range: 'week' }), /disposed/);
});

test('refresh() is single-flight', async () => {
  const { runner, calls } = recordingRunner({ hook: async () => { await new Promise(r => setTimeout(r, 10)); } });
  const store = newStore(runner);
  await Promise.all([store.refresh(), store.refresh(), store.refresh()]);
  assert.equal(calls.length, 3, 'one refresh = exactly three view scans, got ' + calls.length);
  store.dispose();
});

test('cache persists and reloads viewMeta (back-compat with older caches)', async () => {
  const { runner } = recordingRunner();
  isolatedHome();
  const store = new Store({ client: 'dsh' }, quiet, { runView: runner });
  await store.refresh();
  const file = store.file;
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(saved.viewMeta && saved.viewMeta.month.successAt > 0);
  assert.ok(saved.attemptedAt > 0);

  // Same DSH_HOME: a fresh Store must pick the persisted state back up.
  const reopened = new Store({ client: 'dsh' }, quiet, { runView: runner });
  assert.equal(reopened.state.updatedAt, store.state.updatedAt);
  assert.equal(reopened.snapshot().meta.stale, false);
  store.dispose(); reopened.dispose();

  // Old cache shape (no viewMeta) must still load, inferring success from data.
  const legacy = { updatedAt: 111, views: { today: reportFor('t'), month: reportFor('m'), hourlyMonth: null }, errors: {}, bin: null };
  fs.writeFileSync(file, JSON.stringify(legacy));
  const legacyStore = new Store({ client: 'dsh' }, quiet, { runView: runner });
  assert.equal(legacyStore.state.updatedAt, 111);
  assert.equal(legacyStore.state.viewMeta.today.successAt, 111);
  legacyStore.dispose();
});
