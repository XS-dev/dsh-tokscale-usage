import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyReport } from '../scripts/verify-live.mjs';

const report = () => ({ meta: { engine: 'tokscale', client: 'codex', model: 'all', range: 'today', updatedAt: 1, stale: false, errors: {} }, metrics: { totalTokens: 12, entries: [{ client: 'codex', model: 'm', input: 12 }] } });
function logger() { const out = []; return { out, log: x => out.push(x), error: x => out.push(x) }; }
const reply = body => async () => ({ ok: true, json: async () => body });

test('verifyReport checks current report selection and records', async () => {
  const log = logger(); let requested;
  const rc = await verifyReport({ origin: 'http://localhost:1234', client: 'codex', range: 'today', log, fetchImpl: async url => { requested = url; return reply(report())(); } });
  assert.equal(rc, 0); assert.equal(requested.pathname, '/tokscale-usage/report');
  assert.equal(requested.searchParams.get('client'), 'codex');
  assert.match(log.out.join('\n'), /GUI NOT VERIFIED/);
});

test('verifyReport does not claim success on service or data errors', async () => {
  const cases = [
    [async () => { throw new Error('offline'); }, 1],
    [async () => ({ ok: false, status: 404 }), 1],
    [async () => ({ ok: true, json: async () => { throw new Error('bad'); } }), 1],
    [reply({ meta: { engine: 'tokscale' }, today: {} }), 1],
    [reply({ ...report(), meta: { ...report().meta, client: 'dsh' } }), 1],
    [reply({ ...report(), meta: { ...report().meta, stale: true } }), 2],
    [reply({ ...report(), meta: { ...report().meta, errors: { hourly: 'failed' } } }), 2],
    [reply({ ...report(), metrics: { totalTokens: 0, entries: [] } }), 2],
    [reply({ ...report(), metrics: { totalTokens: 12, entries: [{ client: 'dsh' }] } }), 2],
  ];
  for (const [fetchImpl, expected] of cases) {
    const log = logger();
    assert.equal(await verifyReport({ origin: 'http://localhost', client: 'codex', log, fetchImpl }), expected);
    assert.doesNotMatch(log.out.join('\n'), /DATA OK/);
  }
});

test('CLI exits nonzero on stale report without printing DATA OK', async t => {
  const server = http.createServer((_req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ ...report(), meta: { ...report().meta, stale: true } })); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const script = fileURLToPath(new URL('../scripts/verify-live.mjs', import.meta.url));
  const child = spawn(process.execPath, [script, `http://127.0.0.1:${server.address().port}`, 'codex', 'today'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', x => output += x); child.stderr.on('data', x => output += x);
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  assert.equal(code, 2); assert.doesNotMatch(output, /DATA OK/);
});
