// Dev probe: run the exact argv the fixed getReport builds for each range and
// confirm each window's data differs (i.e. labels match data). Uses the real
// tokscale engine but only cheap windows (today/yesterday/week).
import { runView, buildArgs } from '../lib/tokscale.mjs';
import { metrics } from '../lib/store.mjs';

const rows = [];
for (const range of ['today', 'yesterday', 'week']) {
  const t0 = Date.now();
  const { data, args } = await runView({ client: 'dsh', range }, { config: {}, timeoutMs: 180000 });
  const m = metrics(data);
  rows.push({ range, argv: args.join(' '), totalTokens: m.totalTokens, messages: m.messages, ms: Date.now() - t0 });
}
for (const r of rows) console.log(r.range.padEnd(10), '| totalTokens=' + String(r.totalTokens).padStart(10), '| msgs=' + String(r.messages).padStart(4), '| ' + String(r.ms).padStart(6) + 'ms |', r.argv);
const t = rows.find(r => r.range === 'today'), y = rows.find(r => r.range === 'yesterday'), w = rows.find(r => r.range === 'week');
console.log('\nyesterday != today :', y.totalTokens !== t.totalTokens);
console.log('week >= today      :', w.totalTokens >= t.totalTokens);
console.log('week != today      :', w.totalTokens !== t.totalTokens);
