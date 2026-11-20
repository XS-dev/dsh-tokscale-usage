import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArgs, resolveTokscaleBin } from '../lib/tokscale.mjs';
import { metrics, deriveDaily, deriveTodayHourly, todayDateLocal } from '../lib/store.mjs';
import { formatSummary, fmtInt, fmtPct } from '../lib/views.mjs';

test('buildArgs: default report month', () => {
  assert.deepEqual(buildArgs({ range: 'month' }), ['-c', 'dsh', '--json', '--no-spinner', '--group-by', 'client,provider,model', '--month']);
});
test('buildArgs: today / yesterday / week / year', () => {
  assert.deepEqual(buildArgs({ range: 'today' }), ['-c', 'dsh', '--json', '--no-spinner', '--group-by', 'client,provider,model', '--today']);
  assert.deepEqual(buildArgs({ range: 'yesterday' }), ['-c', 'dsh', '--json', '--no-spinner', '--group-by', 'client,provider,model', '--yesterday']);
  assert.deepEqual(buildArgs({ range: 'week' }), ['-c', 'dsh', '--json', '--no-spinner', '--group-by', 'client,provider,model', '--week']);
  const y = buildArgs({ range: 'year' });
  assert.equal(y[y.length - 2], '--year');
});
test('buildArgs: all => no date filter', () => {
  assert.deepEqual(buildArgs({ range: 'all' }), ['-c', 'dsh', '--json', '--no-spinner', '--group-by', 'client,provider,model']);
});
test('buildArgs: subcommand + custom client + since/until + home', () => {
  assert.deepEqual(
    buildArgs({ sub: 'hourly', client: 'dsh', since: '2026-11-01', until: '2026-11-17', home: '/fixture/.dsh' }),
    ['hourly', '-c', 'dsh', '--json', '--no-spinner', '--since', '2026-11-01', '--until', '2026-11-17', '--home', '/fixture/.dsh'],
  );
});
test('buildArgs: since overrides range flag', () => {
  const a = buildArgs({ range: 'month', since: '2026-11-01' });
  assert.ok(!a.includes('--month'));
  assert.ok(a.includes('--since'));
});

test('resolveTokscaleBin: explicit config wins', () => {
  const b = resolveTokscaleBin({ tokscaleBin: 'X:/tokscale.exe' });
  assert.equal(b.kind, 'file');
  assert.equal(b.path, 'X:/tokscale.exe');
  assert.equal(b.source, 'config');
});

const report = {
  groupBy: 'client,model',
  entries: [
    { client: 'dsh', model: 'qoder-cn/qmodel_latest', provider: 'magpie', input: 1000, output: 200, cacheRead: 8000, cacheWrite: 0, reasoning: 0, messageCount: 10, cost: 0 },
    { client: 'dsh', model: 'group/ds', provider: 'magpie', input: 100, output: 20, cacheRead: 0, cacheWrite: 0, reasoning: 0, messageCount: 2, cost: 0.5 },
  ],
  totalInput: 1100, totalOutput: 220, totalCacheRead: 8000, totalCacheWrite: 0,
  totalMessages: 12, totalCost: 0.5, processingTimeMs: 30000,
};

test('metrics: totals + cache-hit rate', () => {
  const m = metrics(report);
  assert.equal(m.input, 1100);
  assert.equal(m.output, 220);
  assert.equal(m.cacheRead, 8000);
  assert.equal(m.messages, 12);
  assert.equal(m.cost, 0.5);
  assert.equal(m.totalTokens, 1100 + 220 + 8000);
  assert.ok(Math.abs(m.cacheHitRate - 8000 / 9100) < 1e-9);
  assert.equal(m.entries.length, 2);
});
test('metrics: null-safe', () => {
  assert.equal(metrics(null), null);
  assert.equal(metrics(undefined), null);
  const z = metrics({});
  assert.equal(z.input, null);
  assert.equal(z.reasoning, null);
  assert.equal(z.totalTokens, null);
  assert.equal(z.cacheHitRate, null);
  assert.equal(z.cost, null);
  assert.equal(z.messages, null);
  assert.equal(z.processingTimeMs, null);
  assert.equal(metrics({ ...report, totalCacheRead: undefined }).cacheHitRate, null);
  assert.equal(metrics({ ...report, totalInput: NaN }).totalTokens, null);
  assert.equal(metrics({ ...report, entries: [{ reasoning: 1 }, {}] }).reasoning, null);
  assert.equal(metrics({ ...report, totalInput: 0, totalCacheRead: 0 }).cacheHitRate, 0);
});

const hourly = {
  entries: [
    { hour: '2026-11-16 23:00', input: 10, output: 1, cacheRead: 5, cacheWrite: 0, messageCount: 1, turnCount: 1, cost: 0 },
    { hour: '2026-11-17 09:00', input: 100, output: 10, cacheRead: 50, cacheWrite: 0, messageCount: 2, turnCount: 2, cost: 0.1 },
    { hour: '2026-11-17 19:00', input: 200, output: 20, cacheRead: 80, cacheWrite: 0, messageCount: 3, turnCount: 3, cost: 0.2 },
    { hour: 'bad-hour', input: 999, output: 999, cacheRead: 999, messageCount: 999 },
  ],
};
test('deriveDaily: aggregates hourly into sorted day buckets, skips malformed', () => {
  const d = deriveDaily(hourly);
  assert.equal(d.length, 2);
  assert.equal(d[0].date, '2026-11-16');
  assert.equal(d[1].date, '2026-11-17');
  assert.equal(d[1].input, 300);
  assert.equal(d[1].output, 30);
  assert.equal(d[1].cacheRead, 130);
  assert.equal(d[1].messages, 5);
  assert.ok(Math.abs(d[1].cost - 0.3) < 1e-9);
});
test('deriveTodayHourly: filters to today, HH:MM labels, sorted', () => {
  const h = deriveTodayHourly(hourly, '2026-11-17');
  assert.equal(h.length, 2);
  assert.equal(h[0].hour, '09:00');
  assert.equal(h[1].hour, '19:00');
  assert.equal(h[1].input, 200);
  assert.equal(h[1].turns, 3);
});
test('todayDateLocal: YYYY-MM-DD', () => {
  assert.match(todayDateLocal(new Date(2026, 10, 17)), /^2026-11-17$/);
});

test('formatSummary: contains totals, cache-hit, per-model, cost note', () => {
  const s = formatSummary({ report, range: 'month', cached: true, updatedAt: Date.now() }, metrics(report));
  assert.match(s, /DSH token usage — month/);
  assert.match(s, /engine: tokscale/);
  assert.match(s, /Cache hit rate/);
  assert.match(s, /qoder-cn\/qmodel_latest/);
  assert.match(s, /Per model/);
  assert.match(s, /\(cached\)/);
});
test('formatSummary: zero-cost note when cost is 0', () => {
  const zero = { ...report, totalCost: 0 };
  const s = formatSummary({ report: zero, range: 'today' }, metrics(zero));
  assert.match(s, /cost is 0/);
});
test('formatSummary: no data', () => {
  assert.match(formatSummary({ report: null, range: 'month' }, null), /No usage data/);
});

test('fmtInt / fmtPct', () => {
  assert.equal(fmtInt(950), '950');
  assert.equal(fmtInt(1500), '1.5K');
  assert.equal(fmtInt(2_500_000), '2.50M');
  assert.equal(fmtPct(0.879), '87.9%');
});