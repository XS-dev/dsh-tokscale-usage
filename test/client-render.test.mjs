import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');

function setup(seed = []) {
  let definition, component;
  const effects = [], registrations = [];
  const rootStates = [...seed];
  const fiberStates = new Map();
  let activeArr = rootStates;
  let activeIdx = 0;

  function renderTree(node, callCounts = new Map()) {
    if (node == null || node === false || node === true) return null;
    if (Array.isArray(node)) return node.map(c => renderTree(c, callCounts));
    if (typeof node !== 'object') return node;
    if (typeof node.type === 'function') {
      const fn = node.type;
      const prevArr = activeArr, prevIdx = activeIdx;
      if (fn === component) {
        activeArr = rootStates;
      } else {
        const count = callCounts.get(fn) || 0;
        callCounts.set(fn, count + 1);
        const key = `${fn.name || 'anon'}:${count}`;
        if (!fiberStates.has(key)) fiberStates.set(key, []);
        activeArr = fiberStates.get(key);
      }
      activeIdx = 0;
      const out = fn({ ...(node.props || {}), children: node.children });
      activeArr = prevArr;
      activeIdx = prevIdx;
      return renderTree(out, callCounts);
    }
    return { ...node, children: (node.children || []).map(c => renderTree(c, callCounts)) };
  }

  const React = {
    Fragment: Symbol('fragment'),
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) }),
    useState: initial => {
      const arr = activeArr, i = activeIdx++;
      if (!(i in arr)) arr[i] = typeof initial === 'function' ? initial() : initial;
      return [arr[i], v => { arr[i] = typeof v === 'function' ? v(arr[i]) : v; }];
    },
    useEffect(fn) { effects.push(fn); },
    useLayoutEffect(fn) { effects.push(fn); },
    useCallback: fn => fn,
    useMemo: fn => fn(),
    useRef: initial => {
      const arr = activeArr, i = activeIdx++;
      if (!(i in arr)) arr[i] = { current: initial };
      return arr[i];
    },
    memo: comp => comp,
  };
  new Function('window', 'navigator', code)({ __ModuleLoader__: { load: d => { definition = d; } } }, { language: 'en-US' });
  const plugin = definition.factory(name => { assert.equal(name, 'react'); return React; });
  plugin.apply({ slots: { inject: (_key, fn) => fn(), register: (opts, comp) => { registrations.push({ opts, comp }); if (opts.name === 'main') component = comp; } } });
  const render = () => renderTree({ type: component, props: {}, children: [] });
  return { render, states: rootStates, effects, registrations };
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

test('daily SVG chart never renders incompatible buckets and renders unified SVG bars when available', () => {
  const selection = { client: 'codex', model: 'example', range: 'month', since: '', until: '' };
  const data = {
    metrics: { input: 10, output: 2, reasoning: 3, cacheRead: 5, cacheWrite: 0, entries: [{ client: 'codex', model: 'example', input: 10, reasoning: 3 }] },
    daily: [{ date: '2099-01-01', totalTokens: 999 }],
    meta: { trendsAvailable: false },
  };
  const tree = nodes(setup([selection, selection, data, { clients: ['codex'], models: ['example'] }]).render());
  assert.ok(tree.includes('Trend data is unavailable for this selection.'));
  assert.ok(!tree.includes('Daily usage & spend trend'));
  assert.equal(tree.some(x => x && typeof x === 'object' && String(x.props?.title || '').includes('2099-01-01')), false);

  data.meta.trendsAvailable = true;
  const available = nodes(setup([selection, selection, data, { clients: ['codex'], models: ['example'] }]).render());
  assert.ok(available.includes('Daily usage & spend trend'));
  assert.ok(available.some(x => x && typeof x === 'object' && x.props?.title === '2099-01-01: 999'));
});

test('dashboard renders streamlined 2-select command bar, engine coverage diagnostics and reasoning', () => {
  const selection = { client: 'all', model: 'all', range: 'today', since: '', until: '' };
  const data = {
    metrics: { totalTokens: 23, input: 10, output: 3, reasoning: 2, cacheRead: 8, cacheWrite: 0, entries: [{ client: 'codex', model: 'example', reasoning: 2 }] },
    meta: { updatedAt: 1 },
    sources: [{ name: 'codex', observed: true }],
  };
  const probe = { candidates: [{ client: 'dsh', kind: 'sessions', status: 'directory-present', path: '/fixture' }] };
  const { render } = setup([selection, selection, data, { clients: ['codex'], models: ['example'] }, probe]);
  const all = nodes(render());
  const text = all.filter(x => typeof x === 'string').join(' ');
  for (const value of ['Total tokens', 'Reasoning', 'codex', 'example', 'directory-present', 'Engine coverage map']) {
    assert.ok(text.includes(value), value);
  }
  // Duplicate 3rd range <select> removed in favor of segmented range buttons
  assert.equal(all.filter(x => x && typeof x === 'object' && x.type === 'select').length, 2);
});

test('agent comparison groups model rows, includes reasoning, and renders pure SVG donut', () => {
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
  assert.ok(agentSlice.some(x => x?.type === 'circle' && x.props?.strokeDasharray), 'SVG circle arc donut rendered for agents');
  assert.ok(modelSlice.some(x => x?.type === 'circle' && x.props?.strokeDasharray), 'SVG circle arc donut also rendered for models');
});

test('heatmap pads lead cells so Monday..Sunday rows align accurately with calendar weekdays', () => {
  const selection = { client: 'all', model: 'all', range: 'today', since: '', until: '' };
  // 2026-11-18 is a Wednesday -> (getDay()=3 + 6) % 7 = 2 leading hidden cells (Mon, Tue)
  const data = {
    metrics: { totalTokens: 100, input: 80, output: 20, reasoning: 0, cacheRead: 0, cacheWrite: 0, entries: [{ client: 'codex', model: 'm1', input: 80, output: 20 }] },
    heatmap: [
      { date: '2026-11-18', tokens: 50, cost: 0.1, messages: 2, intensity: 2 },
      { date: '2026-11-19', tokens: 50, cost: 0.1, messages: 2, intensity: 2 },
    ],
    meta: {},
  };
  const tree = nodes(setup([selection, selection, data, { clients: [], models: [] }]).render());
  const grid = tree.find(n => n?.props?.className === 'tu-heat-grid');
  assert.ok(grid);
  const leadSpans = grid.children.filter(c => c?.type === 'span' && c.props?.style?.visibility === 'hidden');
  assert.equal(leadSpans.length, 2, 'Wednesday start pads 2 hidden cells for Monday & Tuesday');
  const dayButtons = grid.children.filter(c => c?.type === 'button');
  assert.equal(dayButtons.length, 2);
});

test('zero-token window with historical heatmap renders SmartEmptyCard action guide', () => {
  const selection = { client: 'all', model: 'all', range: 'today', since: '', until: '' };
  const data = {
    metrics: { totalTokens: 0, input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, entries: [] },
    heatmap: [{ date: '2026-11-19', tokens: 42000, cost: 1.25, messages: 8, intensity: 4 }],
    tasks: [],
    meta: {},
  };
  const text = nodes(setup([selection, selection, data, { clients: [], models: [] }]).render())
    .filter(x => typeof x === 'string')
    .join(' ');
  assert.ok(text.includes('No usage recorded in this time window'));
  assert.ok(text.includes('Inspect 2026-11-19'));
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

test('supports family grouping, Agent × Model matrix tab, and Timing & tools tab', () => {
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
    periodDelta: { tokenDeltaPct: 0.25, costDeltaPct: -0.1, prevSince: '2026-11-19', prevUntil: '2026-11-19' },
    monthlyProjection: { projectedCost: 18.5, daysElapsed: 10, daysInMonth: 30 },
    meta: {},
  };
  const { render } = setup([selection, selection, data, { clients: [], models: [] }]);
  const first = nodes(render());
  const firstText = first.filter(x => typeof x === 'string').join(' ');
  assert.ok(firstText.includes('3 Agent'));
  assert.ok(firstText.includes('Workspace usage'));
  assert.ok(firstText.includes('▲ +25.0%'));
  assert.ok(firstText.includes('EOM est. $18.50'));

  const groupBtn = first.find(n => n?.type === 'button' && n.children.includes('Group family'));
  assert.ok(groupBtn);
  groupBtn.props.onClick();
  const second = nodes(render());
  assert.ok(second.filter(x => typeof x === 'string').join(' ').includes('2 Agent'));

  const matrixTab = second.find(n => n?.type === 'button' && n.children.includes('Matrix'));
  assert.ok(matrixTab);
  matrixTab.props.onClick();
  const matrixText = nodes(render()).filter(x => typeof x === 'string').join(' ');
  assert.ok(matrixText.includes('Agent × model matrix'));

  const execTab = nodes(render()).find(n => n?.type === 'button' && n.children.includes('Timing & tools'));
  assert.ok(execTab);
  execTab.props.onClick();
  const thirdText = nodes(render()).filter(x => typeof x === 'string').join(' ');
  assert.ok(thirdText.includes('Execution & tool telemetry'));
  assert.ok(thirdText.includes('ops_bash'));
});

test('harness scope configurator opens, toggles harnesses, and includes Last 3 days range', () => {
  const selection = { client: 'all', model: 'all', range: 'today', since: '', until: '' };
  const data = {
    metrics: { totalTokens: 100, input: 80, output: 20, reasoning: 0, cacheRead: 0, cacheWrite: 0, entries: [{ client: 'codex', model: 'm1', input: 80, output: 20 }] },
    sources: [{ name: 'codex', observed: true }, { name: 'dsh', observed: true }],
    meta: { updatedAt: 1, scope: { mode: 'custom', enabledClients: ['codex', 'dsh'], observedClients: ['codex', 'dsh'] } },
  };
  const { render } = setup([selection, selection, data, { clients: ['codex', 'dsh'], models: ['m1'] }]);
  const initial = nodes(render());
  assert.equal(initial.filter(x => x?.type === 'select').length, 2);
  const scopeBtn = initial.find(n => n?.type === 'button' && n.children.some(c => String(c).includes('Configure harnesses')));
  assert.ok(scopeBtn);
  scopeBtn.props.onClick();
  const opened = nodes(render());
  const openedText = opened.filter(x => typeof x === 'string').join(' ');
  assert.ok(openedText.includes('Configure harness query scope'));
  assert.ok(openedText.includes('Save scope'));
  assert.ok(openedText.includes('Last 3 days'));
});

test('v0.7.0: avoids host black C.brand, shows Δ pending & session-log fallback on incomplete scan, formats rollout titles, and uses single-col deep layout when <2 models', () => {
  assert.equal(code.includes('--dsw-alias-brand-primary'), false, 'must not bind active controls to near-black host brand var');
  assert.ok(code.includes('--tu-accent'), 'uses theme-adaptive oklab --tu-accent token');

  const selection = { client: 'all', model: 'all', range: 'today', since: '', until: '' };
  const data = {
    metrics: { totalTokens: 0, input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, entries: [] },
    periodDelta: { unavailable: 'scan-incomplete', missingClients: ['codex'] },
    fallback: { basis: 'session-cumulative', totalTokens: 48_500_000, sessionCount: 4, clients: ['codex'], entries: [] },
    workspaces: [{ workspaceKey: 'D:/MODXS/CODING/Circuit', label: 'Circuit', totalTokens: 48_500_000, cost: 0, taskCount: 4, clients: ['codex'] }],
    tasks: [{
      client: 'codex',
      id: '01a1fbe3-7413-7602-b907-c879f1476d50',
      title: 'rollout-2026-11-21T10-15-50-01a1fbe3-7413-7602-b907-c879f1476d50',
      isSubagent: true,
      model: 'gpt-6.2-astra',
      totalTokens: 22_009_406,
    }],
    meta: { completeness: { complete: false, missingClients: ['codex'], reasons: { codex: 'timeout' } } },
  };
  const all = nodes(setup([selection, selection, data, { clients: ['codex'], models: [] }]).render());
  const text = all.filter(x => typeof x === 'string').join(' ');
  assert.equal(text.includes('▼ 100.0%'), false, 'must never show fake -100% green drop when scan timed out');
  assert.ok(text.includes('Δ pending'), 'renders honest Δ pending badge');
  assert.ok(text.includes('≈ 48.50M'), 'renders session-log fallback on hero token card');
  assert.ok(text.includes('Retry codex'), 'renders 1-click Retry codex button');
  assert.ok(text.includes('Subagent · 11-21 10:15 · 01a1fbe3'), 'prettifies raw rollout filename into clean subagent title');
  assert.ok(all.some(n => n?.props?.className === 'tu-deep-single'), 'uses full-width single column when bubble chart has <2 models');
});

test('v0.8.0: bento puzzle spans 5th token bucket across full row, filters TaskStream by engine including antigravity, and sorts by cost', () => {
  const selection = { client: 'all', model: 'all', range: 'today', since: '', until: '' };
  const data = {
    metrics: {
      totalTokens: 500_000, input: 100_000, output: 40_000, reasoning: 10_000, cacheRead: 350_000, cacheWrite: 0, cost: 3.5,
      entries: [
        { client: 'antigravity', model: 'gemini-4-carbon', input: 60_000, output: 20_000, reasoning: 10_000, cacheRead: 210_000, cacheWrite: 0, cost: 2.4 },
        { client: 'codex', model: 'gpt-6.2-astra', input: 40_000, output: 20_000, reasoning: 0, cacheRead: 140_000, cacheWrite: 0, cost: 1.1 },
      ],
    },
    tasks: [
      { client: 'codex', id: 'cdx-1', title: 'Codex Refactor', model: 'gpt-6.2-astra', totalTokens: 320_000, cost: 0.9 },
      { client: 'antigravity', id: 'agy-1', title: 'Antigravity Bento Upgrade', workspaceLabel: 'Talkanything', model: 'gemini-4-carbon', totalTokens: 180_000, cost: 2.6, steps: 24 },
    ],
    meta: {},
  };
  const { render } = setup([selection, selection, data, { clients: ['antigravity', 'codex'], models: [] }]);
  const first = nodes(render());
  const firstText = first.filter(x => typeof x === 'string').join(' ');
  assert.ok(firstText.includes('antigravity (1)'), 'renders per-engine task filter pill for antigravity');
  assert.ok(firstText.includes('codex (1)'), 'renders per-engine task filter pill for codex');
  assert.ok(firstText.includes('$2.60'), 'renders Antigravity task dollar cost');
  assert.ok(firstText.includes('24 steps'), 'renders Antigravity step count');

  // Verify 5th TokenComposition bucket spans full width ('1 / -1') so there is no orphan empty cell
  const fullSpanBucket = first.find(n => n?.type === 'div' && n.props?.style?.gridColumn === '1 / -1' && nodes(n).includes('Cache read'));
  assert.ok(fullSpanBucket, '5th token bucket (Cache read) spans full row in 2-col puzzle grid');

  // Sort by cost puts Antigravity ($2.60) ahead of Codex ($0.90)
  const costSortBtn = first.find(n => n?.type === 'button' && n.children.includes('By cost'));
  assert.ok(costSortBtn);
  costSortBtn.props.onClick();
  const afterSortCards = nodes(render()).filter(n => n?.props?.className === 'tu-task-card');
  assert.ok(nodes(afterSortCards[0]).includes('Antigravity Bento Upgrade'));

  // Clicking antigravity (1) filter shows only Antigravity tasks
  const agyFilterBtn = nodes(render()).find(n => n?.type === 'button' && nodes(n).join('').includes('antigravity (1)'));
  assert.ok(agyFilterBtn);
  agyFilterBtn.props.onClick();
  const filteredCards = nodes(render()).filter(n => n?.props?.className === 'tu-task-card');
  assert.equal(filteredCards.length, 1);
  assert.ok(nodes(filteredCards[0]).includes('Antigravity Bento Upgrade'));
});

test('v0.8.1: QuadrantBubbleMap locks single-row header without wrapping, formats crisp log10 ticks, solves label collisions, and renders floating tooltip on hover', () => {
  const selection = { client: 'all', model: 'all', range: 'today', since: '', until: '' };
  const data = {
    metrics: {
      totalTokens: 660_000_000, input: 40_000_000, output: 10_000_000, reasoning: 5_000_000, cacheRead: 605_000_000, cacheWrite: 0, cost: 265,
      entries: [
        { client: 'antigravity', model: 'gemini-4-carbon', input: 20_000_000, output: 5_000_000, reasoning: 3_000_000, cacheRead: 313_000_000, cacheWrite: 0, cost: 105.7, messageCount: 120 },
        { client: 'codex', model: 'gpt-6.2-astra', input: 18_000_000, output: 4_000_000, reasoning: 2_000_000, cacheRead: 271_000_000, cacheWrite: 0, cost: 156.4, messageCount: 180 },
        { client: 'antigravity', model: 'gemini-4-hydrogen-tiered-high', input: 2_000_000, output: 1_000_000, reasoning: 0, cacheRead: 9_700_000, cacheWrite: 0, cost: 2.38, messageCount: 25 },
      ],
    },
    meta: {},
  };
  const { render } = setup([selection, selection, data, { clients: ['antigravity', 'codex'], models: [] }]);
  const first = nodes(render());
  const text = first.filter(x => typeof x === 'string').join(' ');
  assert.ok(text.includes('Model efficiency map'));
  assert.ok(text.includes('Log tokens × median quadrants'));
  // Clean log10 axis ticks without .00M noise
  assert.ok(first.includes('10M') && first.includes('100M'), 'formats clean log10 ticks 10M / 100M');
  assert.equal(first.includes('100.00M'), false, 'avoids noisy 100.00M tick label');
  // Radial gradient & haloed labels
  assert.ok(first.some(n => n?.type === 'radialGradient'), 'renders luminous radialGradient defs for bubbles');
  assert.ok(first.some(n => n?.type === 'text' && n.props?.className === 'tu-svg-halo'), 'renders haloed SVG text labels');

  // Hovering a bubble opens floating .tu-tip without mutating the header subtitle
  const hydroGroup = first.find(n => n?.type === 'g' && typeof n.props?.onMouseEnter === 'function' && nodes(n).some(s => String(s).includes('gemini-4-hydrogen-tiered-high')));
  assert.ok(hydroGroup);
  hydroGroup.props.onMouseEnter();
  const afterHover = nodes(render());
  assert.ok(afterHover.includes('Log tokens × median quadrants'), 'header subtitle stays static on hover so Cost segmented control never wraps');
  const tip = afterHover.find(n => n?.type === 'div' && String(n.props?.className || '').includes('tu-tip'));
  assert.ok(tip && nodes(tip).includes('gemini-4-hydrogen-tiered-high'), 'renders floating tooltip card on bubble hover');
});
