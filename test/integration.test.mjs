import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { apply, name, inject } from '../index.mjs';

const workRoot = fileURLToPath(new URL('./.work/integration/', import.meta.url));
fs.mkdirSync(workRoot, { recursive: true });
process.env.DSH_HOME = fs.mkdtempSync(path.join(workRoot, 'home-'));

const MISSING_BIN = path.join(process.env.DSH_HOME, 'missing-bin.exe');

function mockCtx() {
  const regs = { tools: [], commands: [], routes: [] };
  const effects = [];
  const noop = () => () => {};
  const services = {
    tools: { register: d => { regs.tools.push(d); return noop(); } },
    commands: { register: d => { regs.commands.push(d); return noop(); } },
    webServer: { register: r => { regs.routes.push(r); return noop(); }, getOrigin: () => 'http://127.0.0.1:64830' },
  };
  const ctx = {
    logger: () => ({ info() {}, warn() {}, error() {} }),
    get: k => services[k],
    effect: (fn, label) => { effects.push({ fn, label }); },
  };
  return { ctx, regs, effects };
}
function res() {
  return { code: 0, hdr: null, body: undefined, writeHead(c, h) { this.code = c; this.hdr = h; }, end(b) { this.body = b; } };
}
const route = (regs, p) => regs.routes.find(r => r.path === p);

test('plugin metadata', () => {
  assert.equal(name, 'dsh-tokscale-usage');
  assert.deepEqual(inject, ['tools', 'webServer', 'commands']);
});

test('apply registers tool, command and 6 active studio JSON routes; declares cleanup effect', () => {
  const { ctx, regs, effects } = mockCtx();
  const out = apply(ctx, { tokscaleBin: MISSING_BIN, scanTimeoutMs: 5000 });
  assert.ok(out && out.store, 'apply returns store handle');
  assert.equal(regs.tools.length, 1);
  assert.equal(regs.tools[0].name, 'tokscale_usage');
  assert.equal(typeof regs.tools[0].execute, 'function');
  assert.ok(regs.tools[0].parameters.properties.range);
  assert.equal(regs.commands.length, 1);
  assert.equal(regs.commands[0].name, 'tokscale');
  assert.equal(regs.routes.length, 6);
  for (const p of [
    '/tokscale-usage/report',
    '/tokscale-usage/cached-report',
    '/tokscale-usage/sources',
    '/tokscale-usage/cancel',
    '/tokscale-usage/status',
    '/tokscale-usage/progressive-refresh',
  ]) {
    assert.ok(route(regs, p), 'route ' + p);
  }
  assert.equal(route(regs, '/tokscale-usage/'), undefined, 'legacy HTML dashboard route removed');
  assert.equal(effects.length, 1);
  const cleanup = effects[0].fn();
  assert.equal(typeof cleanup, 'function');
  cleanup();
});

test('disabled config registers nothing', () => {
  const { ctx, regs } = mockCtx();
  const out = apply(ctx, { enabled: false });
  assert.equal(out, undefined);
  assert.equal(regs.tools.length, 0);
  assert.equal(regs.routes.length, 0);
});

test('report endpoint passes the complete selection to the store', async () => {
  const { ctx, regs, effects } = mockCtx();
  const { store } = apply(ctx, { tokscaleBin: MISSING_BIN });
  let received;
  store.query = async opts => { received = opts; return { metrics: { totalTokens: 42 } }; };
  const response = res();
  await route(regs, '/tokscale-usage/report').handler({ method: 'GET', url: '/tokscale-usage/report?client=codex&model=x&range=custom&since=2026-11-01&until=2026-11-02&refresh=true&rich=1' }, response);
  assert.equal(response.code, 200);
  assert.ok(received.signal instanceof AbortSignal);
  const { signal, ...selection } = received;
  assert.deepEqual(selection, { client: 'codex', model: 'x', range: 'custom', since: '2026-11-01', until: '2026-11-02', refresh: true, includeRich: true });
  assert.equal(JSON.parse(response.body).metrics.totalTokens, 42);
  effects[0].fn()();
});

test('disconnected report request aborts its underlying query', async () => {
  const { ctx, regs, effects } = mockCtx();
  const { store } = apply(ctx, { tokscaleBin: MISSING_BIN });
  let observed;
  store.query = ({ signal }) => new Promise((resolve, reject) => {
    observed = signal;
    signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
  });
  const response = Object.assign(new EventEmitter(), res(), { writableEnded: false });
  const pending = route(regs, '/tokscale-usage/report').handler({ method: 'GET', url: '/tokscale-usage/report' }, response);
  response.emit('close');
  await pending;
  assert.equal(observed.aborted, true);
  assert.equal(response.code, 0, 'no response is written to the disconnected client');
  effects[0].fn()();
});

test('progressive-refresh & status routes enforce same-origin and HTTP method', async () => {
  const { ctx, regs, effects } = mockCtx();
  const { store } = apply(ctx, { tokscaleBin: MISSING_BIN, scanTimeoutMs: 5000 });
  store.startProgressiveRefresh = async () => store.progressStatus();

  const hProg = route(regs, '/tokscale-usage/progressive-refresh').handler;
  const ok = res();
  hProg({ method: 'POST', url: '/tokscale-usage/progressive-refresh?range=today', headers: { host: '127.0.0.1:64830', origin: 'http://127.0.0.1:64830' } }, ok);
  assert.equal(ok.code, 202);
  assert.equal(JSON.parse(ok.body).ok, true);

  const bad = res();
  hProg({ method: 'POST', url: '/tokscale-usage/progressive-refresh', headers: { host: '127.0.0.1:64830', origin: 'http://evil.example' } }, bad);
  assert.equal(bad.code, 403);

  const get = res();
  hProg({ method: 'GET', url: '/tokscale-usage/progressive-refresh', headers: { host: '127.0.0.1:64830' } }, get);
  assert.equal(get.code, 405);

  const rStatus = res();
  route(regs, '/tokscale-usage/status').handler({ method: 'GET', headers: { host: '127.0.0.1:64830' } }, rStatus);
  assert.equal(rStatus.code, 200);
  assert.equal(typeof JSON.parse(rStatus.body).active, 'boolean');

  effects[0].fn()();
});

test('tool + command degrade gracefully when no data is available', async () => {
  const { ctx, regs, effects } = mockCtx();
  apply(ctx, { tokscaleBin: MISSING_BIN, scanTimeoutMs: 5000 });

  const toolOut = await regs.tools[0].execute({ range: 'month' }, {});
  assert.equal(toolOut.isError, true);
  assert.match(toolOut.content, /tokscale_usage error/);
  const rendered = regs.tools[0].output.render({}, toolOut);
  assert.equal(rendered[0].type, 'text');

  const cmdOut = await regs.commands[0].handler();
  assert.equal(cmdOut.kind, 'error');
  assert.match(cmdOut.text, /tokscale:/);

  effects[0].fn()();
});
