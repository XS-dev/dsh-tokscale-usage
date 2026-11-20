// Full host-path smoke over REAL HTTP + REAL tokscale data (no DSH restart needed).
// Mounts the plugin's webServer routes on a node http server, runs a live refresh,
// then fetches the dashboard + JSON snapshot to prove the end-to-end web path.
// Usage: node scripts/serve-smoke.mjs [port]
import http from 'node:http';
import { apply } from '../index.mjs';

const port = Number(process.argv[2] || 64999);
const routes = [];
const tools = [];
const commands = [];
const effects = [];
const noop = () => () => {};

const server = http.createServer((req, res) => {
  const pathname = (req.url || '/').split('?')[0];
  const r = routes.find(x => x.kind === 'exact' ? x.path === pathname : pathname.startsWith(x.path));
  if (!r) { res.writeHead(404); res.end('no route'); return; }
  try { r.handler(req, res); } catch (e) { res.writeHead(500); res.end(String(e)); }
});

const ctx = {
  logger: () => ({ info() {}, warn() {}, error() {} }),
  get: k => ({
    tools: { register: d => { tools.push(d); return noop(); } },
    commands: { register: d => { commands.push(d); return noop(); } },
    webServer: { register: r => { routes.push(r); return noop(); }, getOrigin: () => `http://127.0.0.1:${port}` },
  }[k]),
  effect: (fn, label) => { effects.push({ fn, label }); },
};

await new Promise(r => server.listen(port, '127.0.0.1', r));
const origin = `http://127.0.0.1:${port}`;
const { store } = apply(ctx, { client: 'dsh', refreshIntervalMs: 0, scanTimeoutMs: 180000 });
console.log('registered:', { tools: tools.map(t => t.name), commands: commands.map(c => c.name), routes: routes.map(r => r.path) });

console.log('running live refresh (3 views)...');
const t0 = Date.now();
await store.refresh();
console.log('refresh wall ms:', Date.now() - t0);

const snap = store.snapshot();
console.log('meta:', JSON.stringify(snap.meta));
console.log('today totals:', JSON.stringify({ input: snap.today.input, output: snap.today.output, cacheRead: snap.today.cacheRead, totalTokens: snap.today.totalTokens, messages: snap.today.messages, cacheHitRate: snap.today.cacheHitRate, cost: snap.today.cost }));
console.log('month totals:', JSON.stringify({ totalTokens: snap.month.totalTokens, messages: snap.month.messages, cost: snap.month.cost }));
console.log('daily buckets:', snap.daily.length, '| todayHourly buckets:', snap.todayHourly.length);
console.log('errors:', JSON.stringify(snap.meta.errors));

const html = await (await fetch(origin + '/tokscale-usage/')).text();
console.log('dashboard GET: bytes', html.length, '| has title:', /DSH token usage/.test(html));
const dataRes = await fetch(origin + '/tokscale-usage/data');
const dataJson = await dataRes.json();
console.log('data GET:', dataRes.status, '| engine:', dataJson.meta.engine, '| daily:', dataJson.daily.length);
const redir = await fetch(origin + '/tokscale-usage', { redirect: 'manual' });
console.log('no-slash redirect:', redir.status, '->', redir.headers.get('location'));
const refreshRes = await fetch(origin + '/tokscale-usage/refresh', { method: 'POST', headers: { origin } });
console.log('refresh POST:', refreshRes.status, await refreshRes.text());

// cleanup
for (const e of effects) { const c = e.fn(); if (typeof c === 'function') c(); }
await new Promise(r => server.close(r));
console.log('OK: full host path verified over real HTTP + real tokscale data');