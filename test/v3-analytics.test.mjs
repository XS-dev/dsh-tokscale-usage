import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArgs, extractPerformance } from '../lib/tokscale.mjs';
import {
  Store, sliceGraphReport, buildHeatmap, computePeriodDelta, deriveHourlyWindow, attachThroughput, todayDateLocal, shiftDateLocal, resolveDateWindow,
} from '../lib/store.mjs';
import { collectTaskUsage } from '../lib/tasks.mjs';

const workRoot = fileURLToPath(new URL('./.work/v3-analytics/', import.meta.url));
fs.mkdirSync(workRoot, { recursive: true });
const quiet = { info() {}, warn() {}, error() {} };

function makeHome() {
  const dir = fs.mkdtempSync(path.join(workRoot, 'home-'));
  process.env.DSH_HOME = dir;
  process.env.CODEX_HOME = path.join(dir, '.codex');
  process.env.TOKSCALE_CONFIG_DIR = dir;
  return dir;
}

test('buildArgs supports graph (no --json) and time-metrics (--json)', () => {
  assert.deepEqual(
    buildArgs({ sub: 'graph', client: 'dsh,codex', since: '2026-11-01', until: '2026-11-18' }),
    ['graph', '-c', 'dsh,codex', '--no-spinner', '--since', '2026-11-01', '--until', '2026-11-18'],
  );
  assert.deepEqual(
    buildArgs({ sub: 'time-metrics', client: 'dsh', range: 'today' }),
    ['time-metrics', '-c', 'dsh', '--json', '--no-spinner', '--today'],
  );
  assert.deepEqual(
    buildArgs({ client: 'dsh', range: 'month', groupBy: 'workspace,model' }),
    ['-c', 'dsh', '--json', '--no-spinner', '--group-by', 'workspace,model', '--merge-worktrees', '--month'],
  );
});

test('sliceGraphReport preserves reasoning across daily buckets and client/model filters', () => {
  const graph = {
    contributions: [
      {
        date: '2026-11-16', intensity: 2,
        totals: { tokens: 150, cost: 0.3, messages: 3 },
        tokenBreakdown: { input: 50, output: 20, cacheRead: 70, cacheWrite: 0, reasoning: 10 },
        clients: [
          { client: 'codex', modelId: 'gpt-6.2-sol', providerId: 'openai', tokens: { input: 50, output: 20, cacheRead: 70, cacheWrite: 0, reasoning: 10 }, cost: 0.3, messages: 3 },
        ],
      },
      {
        date: '2026-11-18', intensity: 4,
        totals: { tokens: 400, cost: 0.7, messages: 8 },
        tokenBreakdown: { input: 100, output: 40, cacheRead: 240, cacheWrite: 0, reasoning: 20 },
        clients: [
          { client: 'codex', modelId: 'gpt-6.2-sol', providerId: 'openai', tokens: { input: 40, output: 20, cacheRead: 120, cacheWrite: 0, reasoning: 20 }, cost: 0.5, messages: 4 },
          { client: 'dsh', modelId: 'codex/gpt-6.1-terra', providerId: 'magpie', tokens: { input: 60, output: 20, cacheRead: 120, cacheWrite: 0, reasoning: 0 }, cost: 0.2, messages: 4 },
        ],
      },
    ],
  };

  const all = sliceGraphReport(graph, { sinceDate: '2026-11-16', untilDate: '2026-11-18', client: 'all', model: 'all' });
  assert.equal(all.daily.length, 2);
  assert.equal(all.daily[0].reasoning, 10);
  assert.equal(all.daily[1].reasoning, 20);
  assert.equal(all.report.totalInput, 150);
  assert.equal(all.report.entries.length, 2);

  const codexOnly = sliceGraphReport(graph, { sinceDate: '2026-11-18', untilDate: '2026-11-18', client: 'codex', model: 'gpt-6.2-sol' });
  assert.equal(codexOnly.daily.length, 1);
  assert.equal(codexOnly.daily[0].totalTokens, 200);
  assert.equal(codexOnly.daily[0].reasoning, 20);
  assert.equal(codexOnly.report.totalMessages, 4);
});

test('buildHeatmap produces 56-day grid ending today and deriveHourlyWindow aggregates 24h profile', () => {
  const today = todayDateLocal();
  const cells = buildHeatmap({ contributions: [{ date: today, totals: { tokens: 500, cost: 1, messages: 2 }, intensity: 3 }] }, 8);
  assert.equal(cells.length, 56);
  assert.equal(cells.at(-1).date, today);
  assert.equal(cells.at(-1).intensity, 3);

  const hourly = {
    entries: [
      { hour: `${today} 09:00`, clients: ['dsh'], models: ['m1'], input: 10, output: 5, cacheRead: 85, messageCount: 2, turnCount: 1, cost: 0.1 },
      { hour: `${today} 14:00`, clients: ['codex'], models: ['m2'], input: 20, output: 10, cacheRead: 70, messageCount: 3, turnCount: 2, cost: 0.2 },
    ],
  };
  const dshHourly = deriveHourlyWindow(hourly, { sinceDate: today, untilDate: today, client: 'dsh' });
  assert.equal(dshHourly.length, 1);
  assert.equal(dshHourly[0].hour, '09:00');
  assert.equal(dshHourly[0].turns, 1);
});

test('extractPerformance and attachThroughput combine tokscale performance and dsh-context timing', () => {
  const perf = extractPerformance({ performance: { msPer1KTokens: 200, totalDurationMs: 2000, timedTokens: 10000, sampleCount: 5, tokenCoverage: 0.9 } });
  assert.equal(perf.tokensPerSec, 5000);
  assert.equal(perf.source, 'tokscale');

  const summary = {
    entries: [
      { client: 'codex', model: 'gpt-6.2-sol', input: 10, output: 5, cacheRead: 0, cacheWrite: 0, reasoning: 1, performance: { msPer1KTokens: 500, totalDurationMs: 1000, timedTokens: 2000, sampleCount: 2, tokenCoverage: 0.8 } },
      { client: 'dsh', model: 'codex/gpt-6.1-terra', input: 10, output: 5, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
    ],
  };
  const dshTp = {
    'codex/gpt-6.1-terra': { client: 'dsh', model: 'codex/gpt-6.1-terra', tokensPerSec: 120, avgTtftMs: 1500, totalDurationMs: 1000, timedTokens: 120, sampleCount: 4, source: 'dsh-context' },
  };
  const { summary: out, throughputSummary } = attachThroughput(summary, dshTp);
  assert.equal(out.entries[0].throughput.source, 'tokscale');
  assert.equal(out.entries[1].throughput.source, 'dsh-context');
  assert.equal(out.entries[1].throughput.tokensPerSec, 120);
  assert.ok(throughputSummary.avgTokensPerSec > 0);
  assert.equal(throughputSummary.avgTtftMs, 1500);
});

test('collectTaskUsage reads DSH overview-cache and Codex recent JSONL within date bounds', async () => {
  const home = makeHome();
  const today = todayDateLocal();
  const [y, m, d] = today.split('-');

  // Seed DSH overview cache
  const dshDir = path.join(home, 'storages', 'dsh-context');
  fs.mkdirSync(dshDir, { recursive: true });
  fs.writeFileSync(path.join(dshDir, 'overview-cache.v1.json'), JSON.stringify({
    sessions: [{
      session: {
        id: 's1', title: 'Optimize tokscale plugin', cwd: 'D:/workspace/dsh-tokscale-usage',
        updatedAt: Date.now(),
        timeline: { model: 'codex/gpt-6.2-sol', total: 5000, turns: 3, timing: { wallMs: 10000, ttftMs: 3000, genMs: 5000, calls: 3, speedTokens: 500, speedMs: 5000 } },
        activity: { days: { [today]: { tokens: 12000, requests: 3, turns: 2, toolCalls: 4, toolsMs: 1200, wallMs: 10000, cost: { magpie: { 'codex/gpt-6.2-sol': { peak: { uncached: 1000, cacheRead: 10500, cacheWrite: 0, output: 500 } } } } } } },
      },
    }],
  }));

  // Seed Codex session index + today's JSONL
  const codexRoot = path.join(home, '.codex');
  const codexDay = path.join(codexRoot, 'sessions', y, m, d);
  fs.mkdirSync(codexDay, { recursive: true });
  fs.writeFileSync(path.join(codexRoot, 'session_index.jsonl'), JSON.stringify({ id: 'codex-1', thread_name: 'Audit shader', updated_at: new Date().toISOString() }) + '\n');
  fs.writeFileSync(path.join(codexDay, 'rollout-codex-1.jsonl'), [
    JSON.stringify({ type: 'session_meta', payload: { id: 'codex-1', cwd: 'D:/repo/app', model: 'gpt-6.2-sol' } }),
    JSON.stringify({ type: 'event_msg', timestamp: new Date().toISOString(), payload: { type: 'token_count', info: { total_token_usage: { input_tokens: 2000, cached_input_tokens: 18000, cache_write_input_tokens: 0, output_tokens: 400, reasoning_output_tokens: 100, total_tokens: 20500 } } } }),
  ].join('\n'));

  const res = await collectTaskUsage({ client: 'all', sinceDate: today, untilDate: today });
  assert.equal(res.tasks.length, 2);
  assert.equal(res.tasks[0].client, 'codex');
  assert.equal(res.tasks[0].title, 'Audit shader');
  assert.equal(res.tasks[1].client, 'dsh');
  assert.equal(res.tasks[1].outputTps, 100);
  assert.equal(res.modelThroughput['codex/gpt-6.2-sol'].tokensPerSec, 100);
});

test('progressive refresh runs fast clients first, then heavy clients, and builds sliceable rich dashboard payload', async t => {
  makeHome();
  const today = todayDateLocal();
  const order = [];
  const store = new Store({ client: 'all', tokscaleBin: process.execPath }, quiet, {
    runView: async ({ sub, client }) => {
      order.push(`${sub || 'models'}:${client}`);
      if (sub === 'graph') {
        const isHeavy = client === 'codex' || client === 'antigravity-extension';
        const rows = isHeavy
          ? [{ client, modelId: 'gpt-6.2-sol', providerId: 'openai', tokens: { input: 30, output: 10, cacheRead: 50, cacheWrite: 0, reasoning: 5 }, cost: 0.4, messages: 2 }]
          : [{ client: 'dsh', modelId: 'codex/gpt-6.1-terra', providerId: 'magpie', tokens: { input: 20, output: 5, cacheRead: 40, cacheWrite: 0, reasoning: 0 }, cost: 0.1, messages: 1 }];
        return { data: { summary: { clients: rows.map(r => r.client) }, contributions: [{ date: today, intensity: 3, clients: rows }] } };
      }
      if (sub === 'hourly') return { data: { entries: [{ hour: `${today} 10:00`, clients: ['dsh'], models: ['codex/gpt-6.1-terra'], input: 20, output: 5, cacheRead: 40, messageCount: 1, turnCount: 1, cost: 0.1 }] } };
      if (sub === 'time-metrics') return { data: { metrics: { total_active_time_ms: 60000, max_concurrent_sessions: 3, session_count: 5 } } };
      return { data: { entries: [{ client: client === 'codex' ? 'codex' : 'dsh', model: 'gpt-6.2-sol', input: 30, output: 10, cacheRead: 50, reasoning: 5, messageCount: 2, cost: 0.4, performance: { msPer1KTokens: 250, totalDurationMs: 1000, timedTokens: 4000, sampleCount: 2, tokenCoverage: 0.9 } }] } };
    },
  });
  t.after(() => store.dispose());

  const status = await store.startProgressiveRefresh({ range: 'today', client: 'all' });
  assert.equal(status.active, false);
  assert.ok(order[0].startsWith('graph:') && !order[0].includes('codex'), 'fast clients execute before heavy clients');
  assert.ok(order.some(x => x === 'graph:codex'));

  const payload = await store.buildRichDashboardPayload({ client: 'all', model: 'all', range: 'today' });
  assert.ok(payload.metrics.totalTokens > 0);
  assert.equal(payload.daily.length, 1);
  assert.equal(payload.daily[0].reasoning > 0, true);
  assert.equal(payload.hourly.length, 1);
  assert.equal(payload.heatmap.length, 56);
  assert.equal(payload.timeMetrics.session_count, 5);
  assert.ok(payload.throughputSummary.avgTokensPerSec > 0);

  // Instant slice by client without re-scanning
  const codexSlice = await store.query({ client: 'codex', model: 'all', range: 'today', includeRich: true });
  assert.equal(codexSlice.meta.derivedFromBase, true);
  assert.equal(codexSlice.metrics.entries.every(e => e.client === 'codex'), true);

  // Full-history range='all' retains full daily trends when graphCoversAll is populated
  const allRange = await store.query({ client: 'all', model: 'all', range: 'all', includeRich: true });
  assert.equal(allRange.meta.trendsAvailable, true);
  assert.equal(allRange.meta.trendScope, 'all');
  assert.ok(allRange.daily.length >= 1);
  assert.ok(allRange.daily[0].byClient && allRange.daily[0].byClient.codex > 0, 'preserves per-agent daily breakdown');
});

test('computePeriodDelta, client-filtered heatmap, and DSH executionProfile work end-to-end', async () => {
  const home = makeHome();
  const today = todayDateLocal();
  const yest = shiftDateLocal(today, -1);
  const graph = {
    contributions: [
      { date: yest, intensity: 2, clients: [{ client: 'dsh', modelId: 'm1', tokens: { input: 100, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 }, cost: 1, messages: 1 }] },
      { date: today, intensity: 4, clients: [
        { client: 'dsh', modelId: 'm1', tokens: { input: 150, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 }, cost: 1.5, messages: 2 },
        { client: 'codex', modelId: 'm2', tokens: { input: 250, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 }, cost: 2.5, messages: 3 },
      ] },
    ],
  };
  const delta = computePeriodDelta(graph, { sinceDate: today, untilDate: today, client: 'dsh', curTokens: 150, curCost: 1.5, curMessages: 2 });
  assert.equal(delta.prevTokens, 100);
  assert.ok(Math.abs(delta.tokenDeltaPct - 0.5) < 1e-6);

  const dshHeat = buildHeatmap(graph, 8, new Date(), { client: 'dsh' });
  assert.equal(dshHeat.at(-1).tokens, 150);
  const codexHeat = buildHeatmap(graph, 8, new Date(), { client: 'codex' });
  assert.equal(codexHeat.at(-1).tokens, 250);
  assert.equal(codexHeat.at(-2).tokens, 0);

  const dshDir = path.join(home, 'storages', 'dsh-context');
  fs.mkdirSync(dshDir, { recursive: true });
  fs.writeFileSync(path.join(dshDir, 'overview-cache.v1.json'), JSON.stringify({
    sessions: [{
      session: {
        id: 'sub-1', title: 'Subagent worker', cwd: 'D:/workspace/Talkanything', parentSession: 'main-1', origin: 'subagent',
        updatedAt: Date.now(),
        timeline: {
          current: 64000, contextWindow: 128000, total: 9000, turns: 4, steps: 10, model: 'm1',
          generatedAnswerTokens: 600, generatedReasoning: 300, generatedCallTokens: 100,
          timing: { wallMs: 8000, ttftMs: 1200, reasoningMs: 2000, textMs: 1500, toolArgMs: 800, toolsMs: 2500, calls: 4, toolCalls: 6, speedTokens: 1000, speedMs: 4300, tools: { ops_bash: { calls: 4, ms: 2000 }, edit: { calls: 2, ms: 500 } } },
        },
        activity: { days: { [today]: { tokens: 9000, requests: 4, turns: 4, toolCalls: 6, toolsMs: 2500, wallMs: 8000 } } },
      },
    }],
  }));
  const res = await collectTaskUsage({ client: 'dsh', sinceDate: today, untilDate: today });
  assert.equal(res.tasks[0].isSubagent, true);
  assert.equal(res.tasks[0].workspaceLabel, 'Talkanything');
  assert.equal(res.executionProfile.sessionOrigins.subagentCount, 1);
  assert.equal(res.executionProfile.topTools[0].name, 'ops_bash');
  assert.equal(res.executionProfile.outputBreakdown.answerTokens, 600);
});

test('custom harness scope persists, trims 58-engine noise, and filters progressive refresh, rich payload, and queries', async t => {
  makeHome();
  const today = todayDateLocal();
  const seenClients = [];
  const store = new Store({ client: 'all', tokscaleBin: process.execPath }, quiet, {
    runView: async ({ sub, client }) => {
      seenClients.push(`${sub || 'report'}:${client}`);
      if (sub === 'graph') {
        const rows = [
          { client: 'dsh', modelId: 'm-dsh', providerId: 'magpie', tokens: { input: 100, output: 20, cacheRead: 0, cacheWrite: 0, reasoning: 0 }, cost: 0.2, messages: 2 },
          { client: 'codex', modelId: 'm-cdx', providerId: 'openai', tokens: { input: 200, output: 40, cacheRead: 0, cacheWrite: 0, reasoning: 10 }, cost: 0.5, messages: 3 },
          { client: 'opencode', modelId: 'm-open', providerId: 'x', tokens: { input: 900, output: 90, cacheRead: 0, cacheWrite: 0, reasoning: 0 }, cost: 9.0, messages: 9 },
        ].filter(r => client.split(',').includes(r.client));
        return { data: { summary: { clients: rows.map(r => r.client) }, contributions: [{ date: today, intensity: 3, clients: rows }] } };
      }
      if (sub === 'hourly' || sub === 'time-metrics') return { data: { entries: [] } };
      const rows = [
        { client: 'dsh', model: 'm-dsh', input: 100, output: 20, cacheRead: 0, cacheWrite: 0, reasoning: 0, messageCount: 2, cost: 0.2 },
        { client: 'codex', model: 'm-cdx', input: 200, output: 40, cacheRead: 0, cacheWrite: 0, reasoning: 10, messageCount: 3, cost: 0.5 },
      ].filter(r => client === 'all' || client.split(',').includes(r.client));
      return { data: { entries: rows, totalInput: rows.reduce((s, r) => s + r.input, 0), totalOutput: rows.reduce((s, r) => s + r.output, 0), totalCacheRead: 0, totalCacheWrite: 0, totalMessages: 5, totalCost: 0.7 } };
    },
  });
  t.after(() => store.dispose());

  // Seed multi-client base including opencode, then lock scope strictly to ['dsh', 'codex']
  await store.startProgressiveRefresh({ range: 'today', client: 'all' });
  const scope = store.setScope({ mode: 'custom', enabledClients: ['dsh', 'codex'] });
  assert.equal(scope.mode, 'custom');
  assert.deepEqual(scope.enabledClients, ['dsh', 'codex']);

  // Reloaded store picks up persisted scope.json
  const reopened = new Store({ client: 'all', tokscaleBin: process.execPath }, quiet, { runView: store._runView });
  t.after(() => reopened.dispose());
  assert.deepEqual(reopened.getScope().enabledClients, ['dsh', 'codex']);
  assert.deepEqual(reopened.scopedCatalogClients(['9router', 'amp', 'codex', 'dsh', 'zed']), ['dsh', 'codex']);

  // Rich payload immediately excludes opencode (990 tokens) from totals, daily bars, and sources
  const rich = await reopened.buildRichDashboardPayload({ client: 'all', model: 'all', range: 'today' });
  assert.equal(rich.metrics.totalTokens, 370);
  assert.deepEqual(rich.sources.map(s => s.name), ['codex', 'dsh']);
  assert.equal(rich.daily[0].byClient.opencode, undefined);

  // Direct refresh query only passes -c dsh,codex instead of all 58 clients
  seenClients.length = 0;
  const fresh = await reopened.query({ client: 'all', range: 'today', refresh: true });
  assert.ok(seenClients.some(x => x === 'report:dsh,codex'), 'expected scoped -c dsh,codex, got ' + seenClients.join(', '));
  assert.deepEqual(fresh.sources.map(s => s.name), ['codex', 'dsh']);
});

test('antigravity-extension and antigravity-cli unify under canonical antigravity without legacy RPC double-counting', async t => {
  makeHome();
  const today = todayDateLocal();
  const seen = [];
  const store = new Store({ client: 'all', tokscaleBin: process.execPath }, quiet, {
    runView: async ({ sub, client }) => {
      seen.push(`${sub || 'report'}:${client}`);
      const list = client.split(',');
      if (sub === 'graph') {
        const rows = [];
        if (list.includes('antigravity-cli')) {
          rows.push({ client: 'antigravity-cli', modelId: 'gemini-4-carbon', providerId: 'google', tokens: { input: 50, output: 10, cacheRead: 0, cacheWrite: 0, reasoning: 0 }, cost: 0.1, messages: 1 });
        }
        if (list.includes('antigravity-extension')) {
          rows.push({ client: 'antigravity-extension', modelId: 'gemini-4-carbon', providerId: 'google', tokens: { input: 300, output: 40, cacheRead: 0, cacheWrite: 0, reasoning: 0 }, cost: 0.6, messages: 4 });
        }
        // Simulate stale legacy RPC row already sitting on same day to ensure deduplication
        return { data: { summary: { clients: rows.map(r => r.client) }, contributions: [{ date: today, intensity: 3, clients: rows }] } };
      }
      return { data: { entries: [] } };
    },
  });
  t.after(() => store.dispose());

  // Legacy 3-variant scope migrates cleanly to single ['antigravity', 'codex']
  const saved = store.setScope({ mode: 'custom', enabledClients: ['antigravity-extension', 'antigravity-cli', 'antigravity', 'codex'] });
  assert.deepEqual(saved.enabledClients, ['antigravity', 'codex']);

  await store.startProgressiveRefresh({ range: 'today', client: 'all' });
  // Inject a legacy RPC `antigravity` row into graph60d alongside `antigravity-extension` to verify no double-counting
  store._base.graph60d.contributions[0].clients.push({
    client: 'antigravity', modelId: 'gemini-4-carbon', providerId: 'google',
    tokens: { input: 9999, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 }, cost: 99, messages: 99,
  });

  const payload = await store.buildRichDashboardPayload({ client: 'all', model: 'all', range: 'today' });
  // 60 (cli) + 340 (ext) = 400, legacy 9999 skipped!
  assert.equal(payload.metrics.totalTokens, 400);
  assert.deepEqual(payload.sources.map(s => s.name), ['antigravity', 'codex']);
  assert.equal(payload.metrics.entries.length, 1);
  assert.equal(payload.metrics.entries[0].client, 'antigravity');
  assert.equal(payload.daily[0].byClient.antigravity, 400);
  assert.equal(payload.daily[0].byClient['antigravity-extension'], undefined);

  const agyOnly = await store.buildRichDashboardPayload({ client: 'antigravity', model: 'all', range: 'today' });
  assert.equal(agyOnly.metrics.totalTokens, 400);

  // Verify `days3` (last 3 days inclusive) window & buildArgs translation
  const win3 = resolveDateWindow('days3', null, null, new Date(2026, 10, 20));
  assert.deepEqual(win3, { sinceDate: '2026-11-18', untilDate: '2026-11-20' });
  const args3 = buildArgs({ client: 'dsh', range: 'days3' });
  assert.ok(args3.includes('--since') && args3.includes('--until'), 'days3 translates to --since/--until');
});
