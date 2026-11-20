import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const cacheUrl = '/tokscale-usage/cached-report?client=all&model=all&range=today&rich=1';
const settle = () => new Promise(resolve => setImmediate(resolve));

function resolveTree(node) {
  if (node == null || node === false || node === true) return null;
  if (Array.isArray(node)) return node.map(resolveTree);
  if (typeof node !== 'object') return node;
  if (typeof node.type === 'function') {
    return resolveTree(node.type({ ...(node.props || {}), children: node.children }));
  }
  return { ...node, children: (node.children || []).map(resolveTree) };
}

function mount(fetch) {
  let definition, component, index = 0;
  const effects = [], state = [];
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState: initial => {
      const n = index++;
      if (!(n in state)) state[n] = typeof initial === 'function' ? initial() : initial;
      return [state[n], value => { state[n] = typeof value === 'function' ? value(state[n]) : value; }];
    },
    useEffect: effect => effects.push(effect),
    useCallback: fn => fn,
    useMemo: fn => fn(),
    useRef: initial => {
      const n = index++;
      if (!(n in state)) state[n] = { current: initial };
      return state[n];
    },
    memo: comp => comp,
    Fragment: Symbol('fragment'),
  };
  const window = { __ModuleLoader__: { load: value => { definition = value; } } };
  new Function('window', 'navigator', 'fetch', code)(window, { language: 'en' }, fetch);
  definition.factory(() => React).apply({ slots: {
    inject: (_, register) => register(),
    register: (options, value) => { if (options.name === 'main') component = value; },
  } });
  resolveTree(component());
  effects.forEach(effect => effect());
  return () => { index = 0; return walk(resolveTree(component())); };
}

function walk(node) {
  if (node == null || node === false) return [];
  if (Array.isArray(node)) return node.flatMap(walk);
  return typeof node === 'object' ? [node, ...(node.children || []).flatMap(walk)] : [node];
}

for (const status of [204, 404]) {
  test(`initial cache lookup HTTP ${status} leaves filters usable and triggers non-blocking progressive refresh`, async () => {
    const calls = [];
    const render = mount(async url => {
      calls.push(url);
      if (url === cacheUrl) return { status, ok: status === 204 };
      if (url.startsWith('/tokscale-usage/progressive-refresh')) return { status: 202, ok: false };
      return { ok: true, json: async () => ({ clients: ['dsh', 'codex'], candidates: [] }) };
    });
    await settle();
    const tree = render();
    const agent = tree.find(node => node.type === 'select');
    assert.deepEqual(agent.children.map(option => option.props.value), ['all']);
    assert.ok(tree.includes('Select a preset or refresh to query usage.'));
    assert.deepEqual(calls, [cacheUrl, '/tokscale-usage/progressive-refresh?client=all&range=today']);
    await agent.props.onFocus();
    const updated = render().find(node => node.type === 'select');
    assert.deepEqual(updated.children.map(option => option.props.value), ['all', 'codex', 'dsh']);
    assert.deepEqual(calls, [cacheUrl, '/tokscale-usage/progressive-refresh?client=all&range=today', '/tokscale-usage/sources']);
  });
}

test('initial cache hit displays fresh usage immediately with rich=1 without re-scanning', async () => {
  const calls = [];
  const render = mount(async url => {
    calls.push(url);
    return { status: 200, ok: true, json: async () => ({ metrics: { totalTokens: 314 }, meta: { stale: false, updatedAt: Date.now() } }) };
  });
  await settle();
  const tree = render();
  assert.ok(tree.includes('314'));
  assert.ok(!tree.find(node => node.type === 'button' && node.children.includes('Refresh data')).props.disabled);
  assert.deepEqual(calls, [cacheUrl]);
});

test('stale cache hit displays cached usage immediately while triggering background progressive refresh', async () => {
  const calls = [];
  const render = mount(async url => {
    calls.push(url);
    if (url === cacheUrl) return { status: 200, ok: true, json: async () => ({ metrics: { totalTokens: 314 }, meta: { stale: true, updatedAt: 1000 } }) };
    return { status: 202, ok: false };
  });
  await settle();
  const tree = render();
  assert.ok(tree.includes('314'));
  assert.ok(tree.includes('Today · Last cached report'));
  assert.deepEqual(calls, [cacheUrl, '/tokscale-usage/progressive-refresh?client=all&range=today']);
});

test('a late startup cache response cannot overwrite an explicitly applied report', async () => {
  let resolveCache;
  const pendingCache = new Promise(resolve => { resolveCache = resolve; });
  const calls = [];
  const response = totalTokens => ({ status: 200, ok: true, json: async () => ({ metrics: { totalTokens } }) });
  const render = mount((url, options) => {
    calls.push({ url, options });
    if (url === cacheUrl) return pendingCache;
    return Promise.resolve(response(271));
  });
  assert.ok(render().includes('Checking for a saved report…'));
  const yestBtn = render().find(node => node.type === 'button' && node.children.includes('Yesterday'));
  yestBtn.props.onClick();
  await settle();
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /^\/tokscale-usage\/report\?/);
  assert.equal(new URL(calls[1].url, 'http://localhost').searchParams.get('range'), 'yesterday');
  assert.equal(calls[0].options.signal.aborted, true);
  resolveCache(response(314));
  await settle();
  const tree = render();
  assert.ok(tree.includes('271'));
  assert.equal(tree.includes('314'), false);
});

test('refresh immediately queries the edited range and retains the old report on failure', async () => {
  const calls = [];
  const render = mount(async url => {
    calls.push(url);
    if (url === cacheUrl) return { status: 200, ok: true, json: async () => ({ metrics: { totalTokens: 314 } }) };
    return { status: 503, ok: false, json: async () => ({ error: 'Scan unavailable' }) };
  });
  await settle();
  render().find(node => node.type === 'button' && node.children.includes('Last 7 days')).props.onClick();
  await settle();
  render().find(node => node.type === 'button' && node.children.includes('Refresh data')).props.onClick();
  await settle();
  assert.equal(calls.length, 3);
  const url = new URL(calls[2], 'http://localhost');
  assert.equal(url.pathname, '/tokscale-usage/report');
  assert.equal(url.searchParams.get('range'), 'week');
  assert.equal(url.searchParams.get('refresh'), 'true');
  assert.equal(url.searchParams.get('rich'), '1');
  const tree = render();
  assert.ok(tree.includes('314'));
  assert.ok(tree.includes('Report request failed: Scan unavailable'));
  assert.ok(tree.some(text => typeof text === 'string' && text.startsWith('Showing Today')));
});

test('selecting a new range queries immediately and replaces the saved report only after succeeding', async () => {
  let finishScan;
  const scan = new Promise(resolve => { finishScan = resolve; });
  const report = totalTokens => ({ ok: true, status: 200, json: async () => ({ metrics: { totalTokens } }) });
  const render = mount(url => url === cacheUrl ? Promise.resolve(report(314)) : scan);
  await settle();
  render().find(node => node.type === 'button' && node.children.includes('Last 7 days')).props.onClick();
  const pending = render();
  assert.ok(pending.includes('314'));
  assert.ok(pending.includes('Cancel query'));
  assert.deepEqual(pending.filter(node => node?.props?.role === 'status').map(node => node.children.join('')), ['Showing Today · Updating']);
  finishScan(report(512));
  await settle();
  const complete = render();
  assert.ok(complete.includes('512'));
  assert.ok(!complete.includes('314'));
  assert.ok(!complete.some(text => typeof text === 'string' && text.startsWith('Showing Today')));
  assert.ok(complete.includes('Refresh data'));
});
