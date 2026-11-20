// Manual end-to-end smoke test against the REAL tokscale engine.
// Usage: node scripts/smoke.mjs [range]   (default: today)
// Resolves the native binary, runs one live view, prints the agent summary.
import { resolveTokscaleBin, runView } from '../lib/tokscale.mjs';
import { metrics } from '../lib/store.mjs';
import { formatSummary } from '../lib/views.mjs';

const range = process.argv[2] || 'today';
const bin = resolveTokscaleBin({});
console.log('resolved bin:', JSON.stringify(bin));
const t0 = Date.now();
const { data, args, ms } = await runView({ range, client: 'dsh' }, {});
console.log('argv:', args.join(' '));
console.log('scan ms:', ms, '| entries:', (data.entries || []).length);
console.log('---- summary ----');
console.log(formatSummary({ report: data, range, cached: false, updatedAt: Date.now() }, metrics(data)));
console.log('---- total wall ms:', Date.now() - t0);