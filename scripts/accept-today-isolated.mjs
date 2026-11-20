import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Store, todayDateLocal } from '../lib/store.mjs';

// Diagnostic only: the isolated tokscale config omits configured extra scan
// paths (including possible Codex paths), so this cannot establish coverage.
// This script can run real scans; use verify-live.mjs for coordinated acceptance.
console.error('DIAGNOSTIC ONLY: isolated settings omit configured extra scan paths; results do not establish real source coverage.');
const workRoot = fileURLToPath(new URL('./.work/accept-today-isolated/', import.meta.url));
fs.mkdirSync(workRoot, { recursive: true });
const root = fs.mkdtempSync(path.join(workRoot, 'run-'));
process.env.DSH_HOME = path.join(root, 'dsh');
process.env.TOKSCALE_CONFIG_DIR = path.join(root, 'tokscale');
const store = new Store({}, { warn: () => {} });
const today = todayDateLocal();
const sum = (entries, key) => entries.reduce((n, e) => n + (Number.isFinite(e[key]) ? e[key] : 0), 0);
function summary(q) {
  const m = q.metrics, e = m.entries;
  const totals = { input: m.input, output: m.output, cacheRead: m.cacheRead, cacheWrite: m.cacheWrite, totalTokens: m.totalTokens, messages: m.messages, cost: m.cost };
  const checks = Object.fromEntries([['input','input'], ['output','output'], ['cacheRead','cacheRead'], ['cacheWrite','cacheWrite'], ['messages','messageCount']].map(([a,b]) => [a, m[a] === sum(e,b)]));
  checks.cost = Math.abs(m.cost - sum(e,'cost')) < 1e-7;
  checks.tokenArithmetic = m.totalTokens === m.input + m.output + m.cacheRead + m.cacheWrite;
  checks.model = q.meta.model === 'all' || e.every(x => x.model === q.meta.model);
  checks.dailyDates = q.daily.every(x => x.date === today);
  checks.client = q.meta.client === 'all' || e.every(x => !x.client || x.client === q.meta.client);
  return { client:q.meta.client, modelFilter:q.meta.model === 'all' ? 'all' : 'selected-observed-model', entryCount:e.length, modelCount:q.models.length, totals, checks, dailyCount:q.daily.length, trendsAvailable:q.meta.trendsAvailable, stale:q.meta.stale, errors:Object.keys(q.meta.errors) };
}
try {
  const codex = await store.query({client:'codex', model:'all', range:'today', refresh:true});
  const dsh = await store.query({client:'dsh', model:'all', range:'today', refresh:true});
  const selected = codex.models[0] || dsh.models[0];
  if (!selected) throw new Error('No observed model available for filtered all-client query');
  const all = await store.query({client:'all', model:selected, range:'today', refresh:true});
  console.log(JSON.stringify({ today, endedDate:todayDateLocal(), isolation:'fresh DSH_HOME and TOKSCALE_CONFIG_DIR; real tokscale settings omitted', results:[summary(codex),summary(dsh),summary(all)] }, null, 2));
} finally { store.dispose(); }
