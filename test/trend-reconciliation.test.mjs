import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from '../lib/store.mjs';

const work = fileURLToPath(new URL('./.work/trend-reconciliation/', import.meta.url));

test('daily trend requires matching category totals across scans', async () => {
  fs.mkdirSync(work, { recursive: true });
  process.env.DSH_HOME = fs.mkdtempSync(path.join(work, 'home-'));
  const report = { entries: [{ client: 'dsh', reasoning: 0 }], totalInput: 10, totalOutput: 5, totalCacheRead: 2, totalCacheWrite: 0 };
  let input = 11;
  const store = new Store({}, { warn() {} }, {
    runView: async ({ sub }) => ({ data: sub ? { entries: [{ hour: '2026-11-01 09:00', input, output: 15 - input, cacheRead: 2, cacheWrite: 0 }] } : report }),
  });
  const options = { client: 'dsh', range: 'custom', since: '2026-11-01', until: '2026-11-01', refresh: true };
  const mismatch = await store.query(options);
  assert.equal(mismatch.metrics.totalTokens, 17);
  assert.equal(mismatch.meta.trendsAvailable, false);
  assert.equal(mismatch.meta.stale, false);
  assert.match(mismatch.meta.errors.hourly, /do not reconcile/);
  assert.deepEqual(mismatch.daily, []);
  input = 10;
  const matched = await store.query(options);
  assert.equal(matched.meta.trendsAvailable, true);
  assert.equal(matched.daily[0].totalTokens, 17);
});
