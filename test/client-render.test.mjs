import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');
function setup(seed = []) {
  let definition, component, idx = 0;
  const effects = [], registrations = [];
  const states = [...seed];
  const React = {
    Fragment: Symbol('fragment'),
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState: initial => { const i = idx++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], v => { states[i] = typeof v === 'function' ? v(states[i]) : v; }]; },
    useEffect(fn) { effects.push(fn); }, useCallback: fn => fn,
  };
  new Function('window', 'navigator', code)({ __ModuleLoader__: { load: d => { definition = d; } } }, { language: 'en-US' });
  const plugin = definition.factory(name => { assert.equal(name, 'react'); return React; });
  plugin.apply({ slots: { inject: (_key, fn) => fn(), register: (opts, comp) => { registrations.push({ opts, comp }); if (opts.name === 'main') component = comp; } } });
  const render = () => { idx = 0; return component(); };
  return { render, states, effects, registrations };
}
function nodes(node) {
  if (node == null || node === false) return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node !== 'object') return [String(node)];
  return [node, ...nodes(node.children)];
}

test('native sidebar entry opens the matching central panel', () => {
  const { registrations } = setup();
  const sidebar = registrations.find(r => r.opts.name === 'sidebar.panellist');
  const main = registrations.find(r => r.opts.name === 'main');
  assert.equal(sidebar.opts.id, 'tokscale-usage');
  assert.equal(main.opts.key, sidebar.opts.id);
  assert.equal(sidebar.opts.label(), 'Usage insights');
  assert.equal(registrations.some(r => r.opts.name === 'settings.section'), false);
});

test('daily chart never renders incompatible buckets', () => {
  const selection = { client: 'codex', model: 'example', range: 'month', since: '', until: '' };
  const data = { metrics: { input: 10, output: 2, reasoning: 3, cacheRead: 5, cacheWrite: 0, entries: [{ client: 'codex', model: 'example', input: 10, reasoning: 3 }] }, daily: [{ date: '2099-01-01', totalTokens: 999 }], meta: { trendsAvailable: false } };
  const tree = nodes(setup([selection, selection, data, { clients: ['codex'], models: ['example'] }]).render());
  assert.ok(tree.includes('Trend data is unavailable for this selection.'));
  assert.ok(tree.indexOf('Agent usage comparison') < tree.indexOf('Trend data is unavailable for this selection.'));
  assert.ok(!tree.includes('Daily trend'));
  assert.equal(tree.some(x => x && typeof x === 'object' && String(x.props?.title || '').includes('2099-01-01')), false);
  data.meta.trendsAvailable = true;
  const available = nodes(setup([selection, selection, data, { clients: ['codex'], models: ['example'] }]).render());
  assert.ok(available.some(x => x && typeof x === 'object' && x.props?.title === '2099-01-01: 999'));
});

test('dashboard renders selected report, engine coverage chips and reasoning', () => {
  const selection = { client: 'all', model: 'all', range: 'today', since: '', until: '' };
  const data = { metrics: { totalTokens: 23, input: 10, output: 3, reasoning: 2, cacheRead: 8, cacheWrite: 0, entries: [{ client: 'codex', model: 'example', reasoning: 2 }] }, meta: { updatedAt: 1 }, sources: [{ name: 'codex', observed: true }] };
  const probe = { candidates: [{ client: 'dsh', kind: 'sessions', status: 'directory-present', path: '/fixture' }] };
  const { render } = setup([selection, selection, data, { clients: ['codex'], models: ['example'] }, probe]);
  const all = nodes(render());
  const text = all.filter(x => typeof x === 'string').join(' ');
  for (const value of ['Total tokens', 'Reasoning', 'codex', 'example', 'directory-present', 'Engine coverage map']) assert.ok(text.includes(value), value);
  assert.equal(all.filter(x => x && typeof x === 'object' && x.type === 'select').length, 3);
});

test('agent comparison groups model rows and includes reasoning', () => {
  const selection = { client: 'all', model: 'all', range: 'today', since: '', until: '' };
  const data = { metrics: { entries: [
    { client: 'codex', model: 'one', input: 10, output: 2, reasoning: 3, cacheRead: 5, cacheWrite: 0, cost: 0.1 },
    { client: 'codex', model: 'two', input: 4, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 1, cost: 0.2 },
    { client: 'dsh', model: 'three', input: 2, output: 1 },
  ] }, meta: {} };
  const tree = nodes(setup([selection, selection, data, { clients: [], models: [] }]).render());
  const heading = tree.findIndex(x => x === 'Agent usage comparison');
  assert.ok(heading >= 0);
  const comparison = tree.slice(heading, tree.findIndex((x, i) => i > heading && x === 'Model comparison'));
  const text = comparison.filter(x => typeof x === 'string').join(' ');
  assert.match(text, /codex 25 \$0\.3000/);
  assert.match(text, /dsh — —/);
});

test('changing a filter identifies the displayed report and keeps refresh available', () => {
  const applied = { client: 'dsh', model: 'all', range: 'today', since: '', until: '' };
  const data = { metrics: { entries: [] }, meta: {} };
  const render = (filters) => nodes(setup([filters, applied, data, { clients: [], models: [] }]).render());
  const refresh = tree => tree.find(x => x?.type === 'button' && x.children.includes('Refresh data'));
  assert.ok(!refresh(render({ ...applied })).props.disabled);
  const dirty = render({ ...applied, client: 'codex' });
  assert.ok(!refresh(dirty).props.disabled);
  assert.ok(dirty.some(text => typeof text === 'string' && text.includes('Showing Today · Agent dsh')));
});

test('tasks render top six cards initially and expand on demand without raw tables', () => {
  const selection = { client: 'all', model: 'all', range: 'today', since: '', until: '' };
  const tasks = Array.from({ length: 10 }, (_, i) => ({
    client: 'dsh', id: `t-${i}`, title: `Task ${i}`, model: 'gpt-6.1-sol', totalTokens: 1000 - i * 10,
  }));
  const entries = [
    { client: 'dsh', model: 'gpt-6.1-sol', input: 500, output: 100, reasoning: 0, cacheRead: 400, cacheWrite: 0, cost: 1 },
    { client: 'codex', model: 'gpt-6.2-sol', input: 300, output: 50, reasoning: 0, cacheRead: 200, cacheWrite: 0, cost: 0.5 },
  ];
  const { render } = setup([selection, selection, { metrics: { totalTokens: 1550, input: 800, output: 150, reasoning: 0, cacheRead: 600, cacheWrite: 0, entries }, tasks }]);
  const first = nodes(render());
  assert.equal(first.some(node => node?.type === 'table'), false);
  assert.equal(first.filter(node => node?.props?.className === 'tu-task-card').length, 6);
  const expand = first.find(node => node?.type === 'button' && node.children.some(c => String(c).startsWith('Show more')));
  assert.ok(expand);
  expand.props.onClick();
  assert.equal(nodes(render()).filter(node => node?.props?.className === 'tu-task-card').length, 10);
});

test('cancel button aborts the active request', () => {
  let aborted = false;
  const selection = { client: 'all', model: 'all', range: 'today', since: '', until: '' };
  const { render, states } = setup([selection, selection, null, { clients: [], models: [] }, null, '', true, '', { current: 1, controller: { abort() { aborted = true; } } }]);
  const button = nodes(render()).find(x => x && typeof x === 'object' && x.type === 'button' && x.children.includes('Cancel query'));
  assert.ok(button);
  button.props.onClick();
  assert.equal(aborted, true);
  assert.equal(states[6], false);
});

test('formats large token counts with M/B and renders donut for agents only', () => {
  const selection = { client: 'all', model: 'all', range: 'today', since: '', until: '' };
  const data = {
    metrics: {
      totalTokens: 2_500_000_000, input: 1_500_000, output: 200_000, reasoning: 0, cacheRead: 2_498_300_000, cacheWrite: 0,
      entries: [
        { client: 'codex', model: 'gpt-x', input: 1_000_000, output: 100_000, reasoning: 0, cacheRead: 1_998_900_000, cacheWrite: 0, cost: 1.5 },
        { client: 'dsh', model: 'm-y', input: 500_000, output: 100_000, reasoning: 0, cacheRead: 499_400_000, cacheWrite: 0, cost: 0.5 },
      ],
    },
    meta: {},
  };
  const tree = nodes(setup([selection, selection, data, { clients: [], models: [] }]).render());
  const text = tree.filter(x => typeof x === 'string').join(' ');
  assert.ok(text.includes('2.50B'), 'KPI should format B');
  assert.ok(text.includes('1.50M'), 'Token composition should format M');
  const agentStart = tree.findIndex(x => x === 'Agent usage comparison');
  const modelStart = tree.findIndex(x => x === 'Model comparison');
  const bubbleStart = tree.findIndex(x => x === 'Model efficiency map');
  assert.ok(agentStart >= 0 && modelStart > agentStart && bubbleStart > modelStart);
  const agentSlice = tree.slice(agentStart, modelStart);
  const modelSlice = tree.slice(modelStart, bubbleStart);
  assert.ok(agentSlice.some(x => String(x?.props?.style?.background || '').includes('conic-gradient')));
  assert.equal(modelSlice.some(x => String(x?.props?.style?.background || '').includes('conic-gradient')), false);
});

test('supports grouping multi-surface agent families and switching workspace/timing telemetry tabs', () => {
  const selection = { client: 'all', model: 'all', range: 'today', since: '', until: '' };
  const data = {
    metrics: {
      totalTokens: 3000, input: 1000, output: 500, reasoning: 0, cacheRead: 1500, cacheWrite: 0, cost: 1.2,
      entries: [
        { client: 'antigravity', model: 'g-carbon', input: 500, output: 200, reasoning: 0, cacheRead: 500, cacheWrite: 0, cost: 0.5 },
        { client: 'antigravity-extension', model: 'g-carbon', input: 300, output: 200, reasoning: 0, cacheRead: 500, cacheWrite: 0, cost: 0.4 },
        { client: 'dsh', model: 'd-flash', input: 200, output: 100, reasoning: 0, cacheRead: 500, cacheWrite: 0, cost: 0.3 },
      ],
    },
    workspaces: [{ workspaceKey: 'D:/workspace/TMP', label: 'TMP', totalTokens: 2000, cost: 0.8, taskCount: 3, clients: ['dsh'] }],
    executionProfile: {
      timingBreakdown: { ttftMs: 1000, reasoningMs: 2000, textMs: 1500, toolArgMs: 500, toolsMs: 1200, calls: 5, toolCalls: 8 },
      outputBreakdown: { answerTokens: 300, reasoningTokens: 150, toolCallTokens: 50 },
      topTools: [{ name: 'ops_bash', calls: 5, totalMs: 1000, avgMs: 200 }],
      sessionOrigins: { mainCount: 2, subagentCount: 1, mainTokens: 1500, subagentTokens: 500 },
    },
    periodDelta: { tokenDeltaPct: 0.25, costDeltaPct: -0.1 },
    meta: {},
  };
  const { render } = setup([selection, selection, data, { clients: [], models: [] }]);
  const first = nodes(render());
  const firstText = first.filter(x => typeof x === 'string').join(' ');
  assert.ok(firstText.includes('3 Agent'));
  assert.ok(firstText.includes('Workspace treemap'));
  assert.ok(firstText.includes('▲ +25.0%'));

  // Group antigravity + antigravity-extension into 1 family -> 2 Agent
  const groupBtn = first.find(n => n?.type === 'button' && n.children.includes('Group family'));
  assert.ok(groupBtn);
  groupBtn.props.onClick();
  const second = nodes(render());
  assert.ok(second.filter(x => typeof x === 'string').join(' ').includes('2 Agent'));

  // Switch deep telemetry panel to Timing & tools
  const execTab = second.find(n => n?.type === 'button' && n.children.includes('Timing & tools'));
  assert.ok(execTab);
  execTab.props.onClick();
  const thirdText = nodes(render()).filter(x => typeof x === 'string').join(' ');
  assert.ok(thirdText.includes('Execution & tool telemetry'));
  assert.ok(thirdText.includes('ops_bash'));
});

test('harness scope configurator opens, toggles harnesses, and preserves 3-select command bar contract', () => {
  const selection = { client: 'all', model: 'all', range: 'today', since: '', until: '' };
  const data = {
    metrics: { totalTokens: 100, input: 80, output: 20, reasoning: 0, cacheRead: 0, cacheWrite: 0, entries: [{ client: 'codex', model: 'm1', input: 80, output: 20 }] },
    sources: [{ name: 'codex', observed: true }, { name: 'dsh', observed: true }],
    meta: { updatedAt: 1, scope: { mode: 'custom', enabledClients: ['codex', 'dsh'], observedClients: ['codex', 'dsh'] } },
  };
  const { render } = setup([selection, selection, data, { clients: ['codex', 'dsh'], models: ['m1'] }]);
  const initial = nodes(render());
  assert.equal(initial.filter(x => x?.type === 'select').length, 3);
  const scopeBtn = initial.find(n => n?.type === 'button' && n.children.some(c => String(c).includes('Configure harnesses')));
  assert.ok(scopeBtn);
  scopeBtn.props.onClick();
  const opened = nodes(render());
  assert.equal(opened.filter(x => x?.type === 'select').length, 3);
  const openedText = opened.filter(x => typeof x === 'string').join(' ');
  assert.ok(openedText.includes('Configure harness query scope'));
  assert.ok(openedText.includes('Save scope'));
  assert.ok(openedText.includes('Last 3 days'));
});
