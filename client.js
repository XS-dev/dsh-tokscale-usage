// Native DSH Usage & Telemetry Studio (tokscale + dsh-context v0.4.0).
window.__ModuleLoader__.load({
  id: 'dsh-tokscale-usage',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback } = React;

    const C = {
      bg: 'var(--dsw-alias-bg-base, #fff)',
      panel: 'var(--dsw-alias-bg-layer-1, #f7f8fa)',
      panel2: 'var(--dsw-alias-bg-layer-2, #eef1f5)',
      border: 'var(--dsw-alias-border-l1, #e3e6ea)',
      text: 'var(--dsw-alias-label-primary, #1a1d21)',
      muted: 'var(--dsw-alias-label-secondary, #5b6470)',
      brand: 'var(--dsw-alias-brand-primary, #247bbf)',
      error: 'var(--dsw-alias-state-error-primary, #d23f3f)',
      warn: 'var(--dsw-alias-state-warn-primary, #c98a00)',
      ok: 'var(--dsw-alias-state-success-primary, #087e75)',
    };

    const zh = (() => { try { return String(navigator.language).toLowerCase().startsWith('zh'); } catch { return false; } })();
    const t = (a, b) => (zh ? a : b);
    const num = n => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString() : '—');
    const compact = n => {
      if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
      const a = Math.abs(n);
      if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
      if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
      if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
      return String(Math.round(n));
    };
    const cost = n => (typeof n === 'number' && Number.isFinite(n) ? '$' + n.toFixed(4) : '—');
    const shortCost = n => {
      if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
      if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(2) + 'K';
      if (Math.abs(n) >= 100) return '$' + n.toFixed(1);
      return '$' + n.toFixed(2);
    };
    const pct = n => (typeof n === 'number' && Number.isFinite(n) ? (n * 100).toFixed(1) + '%' : '—');
    const tpsFmt = n => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(1) + ' tok/s' : '—');
    const durFmt = ms => {
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return '—';
      if (ms < 1000) return `${Math.round(ms)}ms`;
      const s = Math.round(ms / 1000);
      if (s < 60) return `${s}s`;
      const m = Math.floor(s / 60);
      if (m < 60) return `${m}m ${s % 60}s`;
      const hr = Math.floor(m / 60);
      return `${hr}h ${m % 60}m`;
    };
    const time = n => (n ? new Date(n).toLocaleString() : '—');
    const label = {
      all: t('全部', 'All'), today: t('今天', 'Today'), yesterday: t('昨天', 'Yesterday'),
      days3: t('最近 3 天', 'Last 3 days'), week: t('最近 7 天', 'Last 7 days'),
      month: t('本月', 'This month'), custom: t('自定义', 'Custom'),
    };
    const palette = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'];
    const heatColors = [
      'var(--dsw-alias-bg-layer-2, rgba(120,147,186,.14))',
      'color-mix(in srgb, #3b82f6 26%, transparent)',
      'color-mix(in srgb, #3b82f6 48%, transparent)',
      'color-mix(in srgb, #3b82f6 74%, transparent)',
      '#3b82f6',
    ];

    const button = { padding: '6px 11px', border: '1px solid ' + C.border, borderRadius: 8, background: C.panel, color: C.text, cursor: 'pointer', font: 'inherit', fontSize: 12 };
    const activePill = { background: palette[0], color: '#fff', borderColor: palette[0] };
    const select = { ...button, minWidth: 112, maxWidth: 'min(260px, 100%)', padding: '5px 9px' };
    const panel = { background: C.panel, border: '1px solid ' + C.border, borderRadius: 12, padding: 14, minWidth: 0 };
    const panelCss = `
      [data-tokscale-usage] .tu-kpi { text-align: left; padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; }
      [data-tokscale-usage] .tu-kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
      [data-tokscale-usage] .tu-summary { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); gap: 12px; }
      [data-tokscale-usage] .tu-deep { display: grid; grid-template-columns: minmax(0, 1.18fr) minmax(0, 1fr); gap: 12px; }
      [data-tokscale-usage] .tu-report { display: grid; gap: 12px; transition: opacity 120ms ease-out; }
      [data-tokscale-usage] .tu-report[aria-busy='true'] { opacity: .62; }
      [data-tokscale-usage] .tu-tasks { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 10px; }
      [data-tokscale-usage] .tu-task-card { border: 1px solid ${C.border}; background: ${C.bg}; border-radius: 10px; padding: 10px 12px; display: grid; gap: 6px; min-width: 0; transition: border-color 150ms ease; }
      [data-tokscale-usage] .tu-task-card:hover { border-color: ${palette[0]}; }
      [data-tokscale-usage] .tu-heat-wrap { display: flex; align-items: start; gap: 6px; }
      [data-tokscale-usage] .tu-heat-days { display: grid; grid-template-rows: repeat(7, 14px); gap: 3px; font-size: 10px; color: ${C.muted}; line-height: 14px; text-align: right; user-select: none; }
      [data-tokscale-usage] .tu-heat-grid { display: grid; grid-auto-flow: column; grid-template-rows: repeat(7, 14px); gap: 3px; overflow-x: auto; padding-bottom: 4px; flex: 1; }
      [data-tokscale-usage] .tu-heat-cell { width: 14px; height: 14px; border-radius: 3px; border: 1px solid transparent; padding: 0; cursor: pointer; }
      [data-tokscale-usage] .tu-heat-cell.selected { border-color: ${C.text}; transform: scale(1.14); }
      [data-tokscale-usage] .tu-treemap { display: flex; flex-wrap: wrap; gap: 8px; align-content: stretch; margin-top: 10px; }
      [data-tokscale-usage] .tu-ws-tile { border: 1px solid ${C.border}; border-radius: 9px; padding: 9px 11px; background: ${C.bg}; cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; gap: 4px; min-width: 120px; transition: border-color 150ms ease, transform 150ms ease; }
      [data-tokscale-usage] .tu-ws-tile:hover { border-color: ${palette[0]}; transform: translateY(-1px); }
      [data-tokscale-usage] .tu-bar-col:hover { filter: brightness(1.14); }
      [data-tokscale-usage] button { transition: background-color 160ms ease-in-out, border-color 160ms ease-in-out; }
      [data-tokscale-usage] button:enabled:hover { border-color: ${C.muted}; }
      [data-tokscale-usage] button:focus-visible, [data-tokscale-usage] select:focus-visible, [data-tokscale-usage] input:focus-visible { outline: 2px solid ${palette[0]}; outline-offset: 2px; }
      @media (max-width: 1120px) { [data-tokscale-usage] .tu-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } [data-tokscale-usage] .tu-summary, [data-tokscale-usage] .tu-deep { grid-template-columns: 1fr; } }
      @media (max-width: 640px) { [data-tokscale-usage] .tu-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (prefers-reduced-motion: reduce) { [data-tokscale-usage] .tu-report, [data-tokscale-usage] button, [data-tokscale-usage] .tu-ws-tile { transition: none; } }
    `;

    const tint = color => `color-mix(in srgb, ${color} 13%, ${C.panel})`;
    const grid = minimum => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${minimum}px), 1fr))`, gap: 12 });
    const dot = color => h('span', { 'aria-hidden': true, style: { display: 'inline-block', width: 8, height: 8, background: color, marginRight: 6, borderRadius: '50%' } });
    const optionValue = x => (typeof x === 'string' ? x : String(x?.id ?? x?.value ?? x?.client ?? x?.model ?? x?.name ?? ''));
    const optionLabel = x => (typeof x === 'string' ? x : String(x?.label ?? x?.name ?? x?.model ?? x?.client ?? x?.id ?? x?.value ?? ''));
    const distinct = xs => [...new Map(xs.filter(x => optionValue(x) && optionValue(x) !== 'all').map(x => [optionValue(x), x])).values()];
    const shortPath = p => {
      if (!p) return '';
      const parts = String(p).replace(/\\/g, '/').split('/').filter(Boolean);
      return parts.length <= 2 ? parts.join('/') : '…/' + parts.slice(-2).join('/');
    };
    const addKnown = (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? a + b : null);
    const agentFamily = name => {
      const s = String(name || '');
      if (s === 'antigravity' || s.startsWith('antigravity-')) return 'antigravity';
      if (s.startsWith('devin-')) return 'devin';
      if (s.startsWith('micode')) return 'micode';
      return s;
    };

    const deltaBadge = pctVal => {
      if (typeof pctVal !== 'number' || !Number.isFinite(pctVal)) return null;
      if (Math.abs(pctVal) < 0.005) return h('span', { style: { fontSize: 10.5, padding: '1px 6px', borderRadius: 999, background: C.panel2, color: C.muted } }, '0.0%');
      const up = pctVal > 0;
      const col = up ? palette[2] : C.ok;
      const txt = (up ? '▲ +' : '▼ ') + Math.min(999, Math.abs(pctVal * 100)).toFixed(1) + '%';
      return h('span', {
        title: t('对比上一等长周期变化率', 'Change vs previous equal period'),
        style: { fontSize: 10.5, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: tint(col), color: col, whiteSpace: 'nowrap' },
      }, txt);
    };

    const initialFilters = { client: 'all', model: 'all', range: 'today', since: '', until: '' };

    function UsagePage() {
      // Preserve first 11 state slots for existing test harness compatibility
      const [filters, setFilters] = useState(initialFilters);
      const [applied, setApplied] = useState(null);
      const [data, setData] = useState(null);
      const [catalog, setCatalog] = useState({ clients: [], models: [] });
      const [sourceProbe, setSourceProbe] = useState(null);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(false);
      const [validation, setValidation] = useState('');
      const [sequence] = useState(() => ({ current: 0 }));
      const [checkingCache, setCheckingCache] = useState(true);
      const [, setShowAllRows] = useState(false);

      // Studio v0.4 interactive state
      const [trendTab, setTrendTab] = useState('daily');          // 'daily' | 'hourly'
      const [trendMetric, setTrendMetric] = useState('stacked');  // 'stacked' | 'paired' | 'tokens' | 'cost' | 'messages'
      const [trendZoom, setTrendZoom] = useState('recent60');     // 'recent60' | 'all'
      const [hoverTrend, setHoverTrend] = useState(null);
      const [hoverHeat, setHoverHeat] = useState(null);
      const [hoverBubble, setHoverBubble] = useState(null);
      const [groupFamily, setGroupFamily] = useState(false);
      const [modelRankBy, setModelRankBy] = useState('tokens');   // 'tokens' | 'cost' | 'tps'
      const [insightTab, setInsightTab] = useState('workspaces'); // 'workspaces' | 'execution'
      const [workspaceFilter, setWorkspaceFilter] = useState('');
      const [taskQuery, setTaskQuery] = useState('');
      const [taskSort, setTaskSort] = useState('tokens');         // 'tokens' | 'recent' | 'tps'
      const [showAllTasks, setShowAllTasks] = useState(false);
      const [progress, setProgress] = useState(null);
      const [showScopeEditor, setShowScopeEditor] = useState(false);
      const [scopeState, setScopeState] = useState(null);
      const [allEngineCatalog, setAllEngineCatalog] = useState([]);
      const [draftScopeMode, setDraftScopeMode] = useState('custom');
      const [draftScopeClients, setDraftScopeClients] = useState([]);
      const [scopeQuery, setScopeQuery] = useState('');
      const [showExtraEngines, setShowExtraEngines] = useState(false);
      const [savingScope, setSavingScope] = useState(false);

      const CORE_HARNESS_PRESET = ['dsh', 'codex', 'antigravity', 'claude', 'gemini'];
      const canonHarness = name => {
        const s = String(name || '');
        return (s === 'antigravity-extension' || s === 'antigravity-cli') ? 'antigravity' : s;
      };
      const HARNESS_HINTS = {
        antigravity: t('IDE + CLI 合并统计', 'IDE + CLI unified'),
        codex: 'OpenAI Codex',
        dsh: 'DSH 原生',
        claude: 'Claude Code',
      };

      const stopQuery = (stopPoll = false) => {
        const token = sequence.token;
        sequence.token = null;
        sequence.controller?.abort();
        sequence.controller = null;
        if (stopPoll && sequence.pollTimer) { clearInterval(sequence.pollTimer); sequence.pollTimer = null; }
        if (token) {
          fetch('/tokscale-usage/cancel?id=' + token, { method: 'POST', keepalive: true })
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); })
            .catch(e => setError(t('取消请求发送失败：', 'Cancellation request failed: ') + String(e?.message || e)));
        }
      };

      const mergeCatalogFromResult = result => {
        const rows = Array.isArray(result?.metrics?.entries) ? result.metrics.entries : [];
        const sc = result?.meta?.scope;
        if (sc) setScopeState(sc);
        setCatalog(old => ({
          clients: sc?.mode === 'custom' && Array.isArray(sc.enabledClients)
            ? distinct(sc.enabledClients)
            : distinct([...old.clients, ...(Array.isArray(result?.sources) ? result.sources : []), ...rows.map(e => e.client || e.agent).filter(Boolean)]),
          models: distinct([...old.models, ...(Array.isArray(result?.models) ? result.models : rows.map(e => e.model).filter(Boolean))]),
        }));
      };

      const load = useCallback(async (query, refresh = false, cacheOnly = false) => {
        const id = ++sequence.current;
        stopQuery(false);
        const controller = new AbortController();
        const token = cacheOnly ? null : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
        sequence.controller = controller;
        sequence.token = token;
        if (!cacheOnly) { setCheckingCache(false); setBusy(true); setError(''); setValidation(''); }
        try {
          const params = new URLSearchParams({ client: query.client, model: query.model, range: query.range });
          if (!cacheOnly) params.set('requestId', token);
          if (query.range === 'custom') { params.set('since', query.since); params.set('until', query.until); }
          if (refresh) params.set('refresh', 'true');
          if (!cacheOnly) params.set('rich', '1');
          const route = cacheOnly ? 'cached-report' : 'report';
          const response = await fetch('/tokscale-usage/' + route + '?' + params.toString(), { cache: 'no-store', signal: controller.signal });
          if (cacheOnly && (response.status === 204 || response.status === 404)) return null;
          if (!response.ok) {
            let message = 'HTTP ' + response.status;
            try { const body = await response.json(); message = body.error?.message || body.error || body.message || message; } catch {}
            throw new Error(String(message));
          }
          const result = await response.json();
          if (id === sequence.current) {
            setApplied(query);
            setData(result);
            setShowAllRows(false);
            setHoverTrend(null);
            setHoverBubble(null);
            if (result?.meta?.progress) setProgress(result.meta.progress);
            mergeCatalogFromResult(result);
          }
          return result;
        } catch (e) {
          if (!cacheOnly && id === sequence.current) setError(String(e?.message || e));
          return null;
        } finally {
          if (id === sequence.current) {
            sequence.controller = null;
            sequence.token = null;
            setCheckingCache(false);
            setBusy(false);
          }
        }
      }, [sequence]);

      const triggerProgressive = useCallback(async (query, discoverAll = false) => {
        const target = query || sequence.latestFilters || initialFilters;
        try {
          const params = new URLSearchParams({ client: target.client, range: target.range });
          if (target.range === 'custom' && target.since && target.until) { params.set('since', target.since); params.set('until', target.until); }
          if (discoverAll) params.set('discoverAll', '1');
          const res = await fetch('/tokscale-usage/progressive-refresh?' + params.toString(), { method: 'POST' });
          if (!res.ok) return;
          const payload = await res.json();
          setProgress(payload.progress);
          let lastRev = payload.progress?.revision || 0;
          if (sequence.pollTimer) clearInterval(sequence.pollTimer);
          sequence.pollTimer = setInterval(async () => {
            try {
              const sr = await fetch('/tokscale-usage/status', { cache: 'no-store' });
              if (!sr.ok) return;
              const st = await sr.json();
              setProgress(st);
              if (st.revision !== lastRev || !st.active) {
                lastRev = st.revision;
                const activeQuery = sequence.latestFilters || target;
                if (!sequence.controller) {
                  const cp = new URLSearchParams({ client: activeQuery.client, model: activeQuery.model, range: activeQuery.range, rich: '1' });
                  if (activeQuery.range === 'custom') { cp.set('since', activeQuery.since); cp.set('until', activeQuery.until); }
                  const cr = await fetch('/tokscale-usage/cached-report?' + cp.toString(), { cache: 'no-store' });
                  if (cr.ok && cr.status === 200) {
                    const fresh = await cr.json();
                    setApplied(activeQuery);
                    setData(fresh);
                    mergeCatalogFromResult(fresh);
                  }
                }
              }
              if (!st.active) {
                clearInterval(sequence.pollTimer);
                sequence.pollTimer = null;
              }
            } catch { /* ignore transient poll failure */ }
          }, 1200);
        } catch { /* progressive endpoint unavailable in minimal mock */ }
      }, [sequence]);

      useEffect(() => {
        sequence.latestFilters = initialFilters;
        const mountId = sequence.current + 1;
        void load(initialFilters, false, true).then(cached => {
          if (sequence.current !== mountId) return;
          const staleOrMissing = !cached || Boolean(cached?.meta?.stale);
          if (staleOrMissing) void triggerProgressive(initialFilters, false);
        });
        return () => {
          sequence.current++;
          stopQuery(true);
          sequence.catalogController?.abort();
          sequence.catalogController = null;
        };
      }, [load, triggerProgressive, sequence]);

      const cancel = () => {
        sequence.current++;
        stopQuery(true);
        setBusy(false);
        setError('');
        setValidation(t('取消请求已发送。', 'Cancellation requested.'));
      };

      const loadSources = async (force = false) => {
        if (sequence.catalogController || (force !== true && sequence.catalogLoaded)) return null;
        const controller = new AbortController();
        sequence.catalogController = controller;
        try {
          const response = await fetch('/tokscale-usage/sources', { cache: 'no-store', signal: controller.signal });
          if (!response.ok) throw new Error('HTTP ' + response.status);
          const value = await response.json();
          if (controller.signal.aborted) return null;
          sequence.catalogLoaded = !value?.catalogError;
          setSourceProbe(value);
          if (value?.scope) setScopeState(value.scope);
          if (Array.isArray(value?.allClients) && value.allClients.length) setAllEngineCatalog(value.allClients);
          else if (Array.isArray(value?.clients) && value.clients.length) setAllEngineCatalog(prev => prev.length ? prev : value.clients);
          setCatalog(old => ({
            ...old,
            clients: value?.scope?.mode === 'custom'
              ? distinct(Array.isArray(value.clients) ? value.clients : [])
              : distinct([...old.clients, ...(Array.isArray(value?.clients) ? value.clients : [])]),
          }));
          return value;
        } catch (err) {
          if (!controller.signal.aborted) setSourceProbe({ error: String(err?.message || err) });
          return null;
        } finally {
          if (sequence.catalogController === controller) sequence.catalogController = null;
        }
      };

      const openScopeEditor = () => {
        if (showScopeEditor) {
          setShowScopeEditor(false);
          return;
        }
        const curMode = scopeState?.mode === 'all' ? 'all' : 'custom';
        const curList = Array.isArray(scopeState?.enabledClients) && scopeState.enabledClients.length
          ? distinct(scopeState.enabledClients.map(canonHarness))
          : CORE_HARNESS_PRESET;
        setDraftScopeMode(curMode);
        setDraftScopeClients(curList);
        setScopeQuery('');
        setShowScopeEditor(true);
        void loadSources(true).then(val => {
          if (val?.scope && !scopeState) {
            setDraftScopeMode(val.scope.mode === 'all' ? 'all' : 'custom');
            if (Array.isArray(val.scope.enabledClients) && val.scope.enabledClients.length) {
              setDraftScopeClients(val.scope.enabledClients);
            }
          }
        });
      };

      const toggleDraftClient = name => {
        setDraftScopeMode('custom');
        setDraftScopeClients(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
      };

      const saveScopeSelection = async (modeOverride, listOverride) => {
        const nextMode = modeOverride || draftScopeMode;
        const nextList = listOverride || draftScopeClients;
        if (nextMode === 'custom' && (!Array.isArray(nextList) || nextList.length === 0)) {
          setValidation(t('请至少勾选 1 个常用 Harness。', 'Select at least one harness.'));
          return;
        }
        setSavingScope(true);
        setValidation('');
        try {
          const res = await fetch('/tokscale-usage/sources', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mode: nextMode, enabledClients: nextList }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body?.error || ('HTTP ' + res.status));
          if (body?.scope) setScopeState(body.scope);
          if (Array.isArray(body?.allClients) && body.allClients.length) setAllEngineCatalog(body.allClients);
          setCatalog(old => ({
            ...old,
            clients: nextMode === 'custom' ? distinct(body?.clients || nextList) : distinct(body?.clients || old.clients),
          }));
          setShowScopeEditor(false);
          const resetClient = nextMode === 'custom' && filters.client !== 'all' && !nextList.includes(filters.client);
          const nextFilters = resetClient ? { ...filters, client: 'all' } : filters;
          sequence.latestFilters = nextFilters;
          if (resetClient) setFilters(nextFilters);
          const hit = await load(nextFilters, false, false);
          const knownObs = new Set(body?.scope?.observedClients || []);
          if (nextMode === 'custom' && nextList.some(c => !knownObs.has(c)) && !hit?.metrics?.totalTokens) {
            void triggerProgressive(nextFilters, false);
          }
        } catch (err) {
          setError(t('保存 Harness 范围失败：', 'Failed to save harness scope: ') + String(err?.message || err));
        } finally {
          setSavingScope(false);
        }
      };

      const applyImmediate = next => {
        sequence.latestFilters = next;
        setFilters(next);
        void load(next, false, false);
      };
      const change = (key, value) => {
        const next = key === 'range' && value !== 'custom'
          ? { ...filters, range: value, since: '', until: '' }
          : { ...filters, [key]: value };
        sequence.latestFilters = next;
        setFilters(next);
        if (key === 'range' && value === 'custom') {
          if (!next.since || !next.until || next.since > next.until) return;
          void load(next, false, false);
          return;
        }
        if (key === 'since' || key === 'until') {
          if (!next.since || !next.until) return;
          if (next.since > next.until) {
            setValidation(t('请选择有效的起止日期，开始日期不能晚于结束日期。', 'Choose a valid start and end date in order.'));
            return;
          }
          void load(next, false, false);
          return;
        }
        if ((key === 'client' || key === 'model') && data?.meta?.derivedFromBase) {
          void load(next, false, true).then(hit => {
            if (!hit && sequence.latestFilters === next) void load(next, false, false);
          });
          return;
        }
        void load(next, false, false);
      };
      const submitFilters = (refresh = false) => {
        if (filters.range === 'custom' && (!filters.since || !filters.until || filters.since > filters.until)) {
          setValidation(t('请选择有效的起止日期，开始日期不能晚于结束日期。', 'Choose a valid start and end date in order.'));
          return;
        }
        sequence.latestFilters = filters;
        void load(filters, refresh);
      };
      const apply = e => { e.preventDefault(); submitFilters(); };
      const reset = () => { setWorkspaceFilter(''); applyImmediate(initialFilters); };

      const dirty = !applied || ['client', 'model', 'range', 'since', 'until'].some(key => filters[key] !== applied[key]);
      const meta = data?.meta || {};
      const sources = Array.isArray(data?.sources) ? data.sources : [];
      const entries = Array.isArray(data?.metrics?.entries) ? data.metrics.entries : [];
      const activeProgress = progress?.active ? progress : (meta.progress?.active ? meta.progress : null);

      const clients = catalog.clients;
      const models = catalog.models;
      const observedClientNames = new Set(sources.filter(s => s?.observed).map(optionValue));
      const sortedClients = [...clients].sort((a, b) => {
        const ao = observedClientNames.has(optionValue(a)) ? 0 : 1;
        const bo = observedClientNames.has(optionValue(b)) ? 0 : 1;
        return ao - bo || optionLabel(a).localeCompare(optionLabel(b));
      });

      const dropdown = (value, key, items, prefix) => h('select', {
        value,
        'aria-label': prefix,
        onFocus: key === 'client' ? loadSources : undefined,
        onChange: e => change(key, e.target.value),
        style: select,
      }, h('option', { value: 'all' }, `${prefix}: ${label.all}`), ...items.map(x => h('option', { key: optionValue(x), value: optionValue(x) }, optionLabel(x) + (key === 'client' && observedClientNames.has(optionValue(x)) ? ' ★' : ''))));

      const statusBadge = activeProgress
        ? h('span', { role: 'status', style: { fontSize: 11.5, padding: '3px 10px', borderRadius: 999, background: tint(palette[0]), color: palette[0], display: 'inline-flex', alignItems: 'center', gap: 6 } },
            h('span', { style: { width: 7, height: 7, borderRadius: '50%', background: palette[0] } }),
            t(`增量同步 ${activeProgress.completed}/${activeProgress.total}`, `Syncing ${activeProgress.completed}/${activeProgress.total}`) +
            (activeProgress.currentClients?.length ? ` · ${activeProgress.currentClients.join(', ')}` : ''))
        : meta.updatedAt
          ? h('span', { style: { fontSize: 11.5, color: meta.stale ? C.warn : C.muted } },
              (meta.stale ? t('上次快照 · ', 'Snapshot · ') : t('已同步 · ', 'Synced · ')) + time(meta.updatedAt))
          : null;

      // Active filter chips for instant 1-click clearing
      const filterChips = [
        filters.client !== 'all' ? ['client', `Agent: ${filters.client}`, () => change('client', 'all')] : null,
        filters.model !== 'all' ? ['model', `${t('模型', 'Model')}: ${filters.model}`, () => change('model', 'all')] : null,
        filters.range === 'custom' && filters.since && filters.since === filters.until
          ? ['day', `${t('单日', 'Day')}: ${filters.since}`, () => applyImmediate(initialFilters)]
          : null,
        workspaceFilter ? ['ws', `${t('项目', 'Project')}: ${workspaceFilter.split('/').pop()}`, () => setWorkspaceFilter('')] : null,
      ].filter(Boolean);

      // Unified Sleek Studio Command Bar (retains 3 selects for full accessibility & test compatibility)
      const commandBar = h('form', {
        onSubmit: apply,
        style: { ...panel, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
      },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
        h('h1', { style: { fontSize: 19, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' } }, t('用量洞察', 'Usage insights')),
        statusBadge,
        ...filterChips.map(([ck, cText, onClear]) => h('button', {
          key: ck, type: 'button', onClick: onClear,
          style: { ...button, padding: '2px 8px', fontSize: 11, borderRadius: 999, background: tint(palette[0]), borderColor: palette[0], color: C.text },
        }, cText + ' ×'))),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7 } },
        dropdown(filters.client, 'client', sortedClients, 'Agent'),
        h('button', {
          type: 'button',
          title: t('设置默认纳入统计与下拉列表的常用 Harness 范围', 'Configure which harnesses are included in usage queries & dropdowns'),
          onClick: openScopeEditor,
          style: {
            ...button,
            padding: '5px 9px',
            ...(showScopeEditor ? activePill : scopeState?.mode === 'custom' ? { borderColor: palette[0], background: tint(palette[0]) } : {}),
          },
        }, scopeState?.mode === 'custom'
          ? t(`⚙ 常用 (${scopeState.enabledClients.length})`, `⚙ Scope (${scopeState.enabledClients.length})`)
          : t('⚙ 常用范围', '⚙ Harnesses')),
        dropdown(filters.model, 'model', models, t('模型', 'Model')),
        h('select', {
          'aria-label': t('日期范围', 'Date range'),
          value: filters.range,
          onChange: e => change('range', e.target.value),
          style: { ...select, minWidth: 96 },
        }, ...['today', 'yesterday', 'days3', 'week', 'month', 'all', 'custom'].map(x => h('option', { key: x, value: x }, label[x]))),
        filters.range === 'custom' ? h('input', { type: 'date', 'aria-label': t('开始日期', 'Start date'), value: filters.since, onChange: e => change('since', e.target.value), style: select, required: true }) : null,
        filters.range === 'custom' ? h('input', { type: 'date', 'aria-label': t('结束日期', 'End date'), value: filters.until, onChange: e => change('until', e.target.value), style: select, required: true }) : null,
        h('div', { role: 'group', 'aria-label': t('日期快捷选项', 'Date presets'), style: { display: 'inline-flex', gap: 2, padding: 2, borderRadius: 8, background: C.bg, border: '1px solid ' + C.border } },
          ...['today', 'yesterday', 'days3', 'week', 'month', 'all'].map(range => h('button', {
            key: range, type: 'button', disabled: busy, 'aria-pressed': filters.range === range,
            onClick: () => applyImmediate({ ...filters, range, since: '', until: '' }),
            style: { ...button, padding: '4px 9px', borderColor: 'transparent', background: filters.range === range ? palette[0] : 'transparent', color: filters.range === range ? '#fff' : C.text, fontSize: 11.5 },
          }, label[range]))),
        busy
          ? h('button', { type: 'button', style: button, onClick: cancel }, t('取消查询', 'Cancel query'))
          : h('button', { type: 'button', style: button, onClick: () => submitFilters(true) }, t('刷新数据', 'Refresh data')),
        (filters.client !== 'all' || filters.model !== 'all' || filters.range !== 'today' || workspaceFilter)
          ? h('button', { type: 'button', style: { ...button, padding: '6px 9px' }, disabled: busy, onClick: reset }, t('重置', 'Reset'))
          : null),
      sourceProbe?.catalogError ? h('div', { role: 'alert', style: { color: C.error, width: '100%', fontSize: 12 } }, t('无法读取完整 Agent 列表：', 'Could not load the complete agent catalog: ') + sourceProbe.catalogError) : null,
      validation ? h('div', { role: 'alert', style: { color: C.error, width: '100%', fontSize: 12 } }, validation) : null);

      const errors = meta.errors && typeof meta.errors === 'object' ? Object.entries(meta.errors) : [];
      const notice = (text, color = C.warn) => h('div', { role: 'status', style: { ...panel, color, fontSize: 13 } }, text);
      const reportScope = applied ? [
        applied.range === 'custom' ? `${applied.since} – ${applied.until}` : label[applied.range],
        applied.client === 'all' ? null : 'Agent ' + applied.client,
        applied.model === 'all' ? null : t('模型 ', 'Model ') + applied.model,
      ].filter(Boolean).join(' · ') : '';
      const reportStatus = [
        reportScope && (dirty ? t('显示 ', 'Showing ') : '') + reportScope,
        busy ? t('更新中', 'Updating') : meta.stale ? t('上次缓存', 'Last cached report') : null,
      ].filter(Boolean).join(' · ');
      const requestError = error ? h('div', { role: 'alert', style: { ...panel, color: C.error, fontSize: 13 } }, t('报告加载失败：', 'Report request failed: ') + error) : null;

      // Interactive Harness Scope Configurator (declutters 58-engine noise down to user's actual tools)
      const knownObservedList = distinct([
        ...(scopeState?.observedClients || []),
        ...sources.filter(s => s?.observed).map(optionValue),
        ...entries.map(e => e.client || e.agent).filter(Boolean),
      ].map(canonHarness));
      const knownObservedSet = new Set(knownObservedList);
      const scopeEditorPanel = showScopeEditor
        ? (() => {
            const primaryCandidates = distinct([
              ...knownObservedList,
              ...CORE_HARNESS_PRESET,
              ...draftScopeClients.map(canonHarness),
            ]).sort((a, b) => {
              const ao = knownObservedSet.has(a) ? 0 : 1;
              const bo = knownObservedSet.has(b) ? 0 : 1;
              return ao - bo || a.localeCompare(b);
            });
            const primarySet = new Set(primaryCandidates);
            const qLower = scopeQuery.trim().toLowerCase();
            const extraCandidates = distinct(allEngineCatalog.map(canonHarness))
              .filter(c => !primarySet.has(c))
              .filter(c => !qLower || c.toLowerCase().includes(qLower))
              .sort((a, b) => a.localeCompare(b));
            const filteredPrimary = qLower
              ? primaryCandidates.filter(c => c.toLowerCase().includes(qLower))
              : primaryCandidates;
            const renderToggleChip = cName => {
              const checked = draftScopeMode === 'all' || draftScopeClients.includes(cName);
              const isObs = knownObservedSet.has(cName);
              return h('button', {
                key: cName,
                type: 'button',
                'aria-pressed': checked,
                onClick: () => toggleDraftClient(cName),
                style: {
                  ...button,
                  padding: '4px 10px',
                  fontSize: 12,
                  borderRadius: 999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: checked ? tint(palette[0]) : C.bg,
                  borderColor: checked ? palette[0] : C.border,
                  fontWeight: checked ? 600 : 400,
                },
              },
              h('span', { 'aria-hidden': true, style: { color: checked ? palette[0] : C.muted, fontWeight: 700 } }, checked ? '✓' : '+'),
              cName,
              HARNESS_HINTS[cName] ? h('small', { style: { color: C.muted, fontSize: 10.5, fontWeight: 400 } }, `(${HARNESS_HINTS[cName]})`) : null,
              isObs ? h('span', { title: t('本机已观测到用量记录', 'Usage observed on this machine'), style: { width: 6, height: 6, borderRadius: '50%', background: C.ok, display: 'inline-block' } }) : null);
            };

            return h('section', { style: { ...panel, borderColor: palette[0], display: 'grid', gap: 10 } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' } },
                h('div', null,
                  h('strong', { style: { fontSize: 14 } }, t('常用 Harness 查询范围设置', 'Configure harness query scope')),
                  h('div', { style: { fontSize: 12, color: C.muted, marginTop: 2 } },
                    t('保存后，“全部”汇总、图表、下拉框与引擎状态图仅统计和展示你勾选的常用 Harness，不再混入未使用的数十个客户端。', 'Limit "All" queries, charts, dropdowns, and refreshes to your chosen harnesses instead of all 58 clients.'))),
                h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
                  knownObservedList.length > 0
                    ? h('button', {
                        type: 'button',
                        style: { ...button, padding: '3px 9px', fontSize: 11.5 },
                        onClick: () => { setDraftScopeMode('custom'); setDraftScopeClients([...knownObservedList]); },
                      }, t(`仅选本机活跃 (${knownObservedList.length})`, `Active only (${knownObservedList.length})`))
                    : null,
                  h('button', {
                    type: 'button',
                    style: { ...button, padding: '3px 9px', fontSize: 11.5 },
                    onClick: () => { setDraftScopeMode('custom'); setDraftScopeClients([...CORE_HARNESS_PRESET]); },
                  }, t('推荐常用组', 'Core defaults')),
                  h('button', {
                    type: 'button',
                    style: { ...button, padding: '3px 9px', fontSize: 11.5, ...(draftScopeMode === 'all' ? activePill : {}) },
                    onClick: () => setDraftScopeMode('all'),
                  }, t('不限 (全部引擎)', 'Unrestricted (all)')),
                  h('button', {
                    type: 'button',
                    style: { ...button, padding: '3px 9px', fontSize: 11.5 },
                    onClick: () => void triggerProgressive(filters, true),
                  }, t('全量扫描发现新引擎', 'Scan all to discover')))),
              draftScopeMode === 'all'
                ? h('div', { style: { fontSize: 12, color: C.muted, padding: '6px 10px', borderRadius: 8, background: C.bg, border: '1px solid ' + C.border } },
                    t('当前选择“不限”模式：查询全部时将扫描并展示 tokscale 支持的全部客户端。点击下方任意胶囊可切回自定义勾选。', 'Unrestricted mode: queries and lists all supported tokscale clients. Click any chip below to switch back to custom selection.'))
                : null,
              h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 7 } },
                ...filteredPrimary.map(renderToggleChip)),
              allEngineCatalog.length > primaryCandidates.length
                ? h('div', { style: { borderTop: '1px solid ' + C.border, paddingTop: 8, display: 'grid', gap: 8 } },
                    h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                      h('input', {
                        type: 'search',
                        value: scopeQuery,
                        placeholder: t('搜索添加其他客户端 (如 cursor / trae / qwen)…', 'Search other harnesses (cursor, trae, qwen)…'),
                        onChange: e => setScopeQuery(e.target.value),
                        style: { ...button, padding: '4px 10px', minWidth: 220, fontSize: 12 },
                      }),
                      !qLower
                        ? h('button', {
                            type: 'button',
                            style: { ...button, padding: '3px 9px', fontSize: 11.5 },
                            onClick: () => setShowExtraEngines(v => !v),
                          }, showExtraEngines
                            ? t('收起其余未用客户端', 'Hide other clients')
                            : t(`展开其余 ${extraCandidates.length} 个客户端`, `Show ${extraCandidates.length} other clients`))
                        : null),
                    (showExtraEngines || Boolean(qLower)) && extraCandidates.length > 0
                      ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 148, overflowY: 'auto' } },
                          ...extraCandidates.map(renderToggleChip))
                      : null)
                : null,
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 4 } },
                h('span', { style: { fontSize: 12, color: C.muted } },
                  draftScopeMode === 'all'
                    ? t('将启用全部客户端', 'All supported clients enabled')
                    : t(`已勾选 ${draftScopeClients.length} 个常用 Harness（绿点代表本机已有用量记录）`, `${draftScopeClients.length} harnesses selected (green dot = usage observed)`)),
                h('div', { style: { display: 'flex', gap: 8 } },
                  scopeState?.mode && scopeState.mode !== 'default'
                    ? h('button', {
                        type: 'button',
                        disabled: savingScope,
                        style: button,
                        onClick: () => void saveScopeSelection('default', CORE_HARNESS_PRESET),
                      }, t('恢复默认精简', 'Reset default'))
                    : null,
                  h('button', { type: 'button', disabled: savingScope, style: button, onClick: () => setShowScopeEditor(false) }, t('取消', 'Cancel')),
                  h('button', {
                    type: 'button',
                    disabled: savingScope || (draftScopeMode === 'custom' && draftScopeClients.length === 0),
                    style: { ...button, ...activePill },
                    onClick: () => void saveScopeSelection(),
                  }, savingScope ? t('保存中…', 'Saving…') : t('保存范围并刷新', 'Save scope')))));
          })()
        : null;

      // Engine Coverage Map (graphical status pills, zero tables)
      const observedSourcesCount = sources.filter(s => s?.observed && !s?.error).length;
      const errorSourcesCount = sources.filter(s => Boolean(s?.error)).length;
      const idleSourcesCount = Math.max(0, sources.length - observedSourcesCount - errorSourcesCount);
      const sourcesView = h('section', { style: panel },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            h('strong', null, t('引擎覆盖状态图', 'Engine coverage map')),
            sources.length
              ? h('span', { style: { fontSize: 11.5, color: C.muted } }, t(`${observedSourcesCount} / ${sources.length} 活跃`, `${observedSourcesCount} / ${sources.length} active`))
              : null,
            scopeState?.mode === 'custom'
              ? h('span', { style: { fontSize: 11, padding: '1px 7px', borderRadius: 999, background: tint(palette[0]), color: palette[0] } }, t('仅显示自选常用范围', 'Custom scope'))
              : null),
          h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
            h('button', { type: 'button', style: { ...button, padding: '3px 9px', fontSize: 11 }, onClick: () => void loadSources(true) }, t('探测本地目录', 'Check local dirs')),
            h('button', { type: 'button', style: { ...button, padding: '3px 9px', fontSize: 11, ...(showScopeEditor ? activePill : {}) }, onClick: openScopeEditor }, t('⚙ 选择常用 Harness', '⚙ Configure harnesses')))),
        sources.length
          ? h('div', { 'aria-hidden': true, style: { display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: C.panel2, gap: 1, marginTop: 10 } },
              observedSourcesCount > 0 ? h('div', { style: { width: `${(observedSourcesCount / sources.length) * 100}%`, background: C.ok } }) : null,
              errorSourcesCount > 0 ? h('div', { style: { width: `${(errorSourcesCount / sources.length) * 100}%`, background: C.error } }) : null,
              idleSourcesCount > 0 ? h('div', { style: { width: `${(idleSourcesCount / sources.length) * 100}%`, background: C.border } }) : null)
          : null,
        sources.length
          ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 } },
              ...sources.map((s, i) => {
                const name = optionLabel(s) || t('未知来源', 'Unknown');
                const isErr = Boolean(s?.error);
                const isOk = Boolean(s?.observed) && !isErr;
                const sc = isErr ? C.error : isOk ? C.ok : C.muted;
                const stText = isErr ? String(s.error.message || s.error) : isOk ? t('已观测', 'Observed') : String(s?.status ?? s?.state ?? t('空闲', 'Idle'));
                return h('button', {
                  key: optionValue(s) || i,
                  type: 'button',
                  title: `${name}: ${stText}` + (s?.updatedAt ? ` · ${time(s.updatedAt)}` : ''),
                  onClick: () => change('client', optionValue(s) || 'all'),
                  style: {
                    ...button, padding: '3px 9px', fontSize: 11.5, borderRadius: 999,
                    background: isOk ? tint(C.ok) : C.bg,
                    borderColor: isErr ? C.error : isOk ? tint(C.ok) : C.border,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  },
                },
                h('span', { 'aria-hidden': true, style: { width: 7, height: 7, borderRadius: '50%', background: sc, display: 'inline-block' } }),
                name);
              }))
          : null,
        errors.length
          ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 } },
              errors.map(([key, value]) => h('span', { key, style: { fontSize: 11, color: C.error, padding: '2px 8px', borderRadius: 6, background: tint(C.error) } }, `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)))
          : null,
        sourceProbe?.error ? h('div', { style: { color: C.error, fontSize: 12, marginTop: 8 } }, String(sourceProbe.error)) : null,
        Array.isArray(sourceProbe?.candidates) && sourceProbe.candidates.length
          ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 } },
              ...sourceProbe.candidates.map(c => {
                const okDir = c.status === 'directory-present';
                const errDir = c.status === 'unreadable';
                const dc = errDir ? C.error : okDir ? C.ok : C.muted;
                return h('span', {
                  key: c.client + ':' + c.kind,
                  title: c.path + (c.error ? ` (${c.error})` : ''),
                  style: { fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid ' + C.border, background: C.bg, display: 'inline-flex', alignItems: 'center', gap: 5 },
                },
                h('span', { 'aria-hidden': true, style: { width: 6, height: 6, borderRadius: '50%', background: dc } }),
                `${c.client}/${c.kind}: ${c.status}`);
              }))
          : null);

      const m = data?.metrics;
      let results = null;
      if (m && typeof m === 'object') {
        const daily = meta.trendsAvailable === true && Array.isArray(data.daily) ? data.daily : [];
        const hourly = Array.isArray(data.hourly) ? data.hourly : [];
        const heatmap = Array.isArray(data.heatmap) ? data.heatmap : [];
        const tasks = Array.isArray(data.tasks) ? data.tasks : [];
        const workspaces = Array.isArray(data.workspaces) ? data.workspaces : [];
        const weekdayProfile = Array.isArray(data.weekdayProfile) ? data.weekdayProfile : [];
        const periodDelta = data.periodDelta || null;
        const execProfile = data.executionProfile || null;
        const tm = data.timeMetrics;
        const tp = data.throughputSummary;

        // --- Comparisons helper (computed early so Agent colors stay consistent across Stacked Bars, Donut & Scatter!) ---
        const compare = group => {
          const totals = new Map();
          for (const entry of entries) {
            const name = group(entry) || t('未知', 'Unknown');
            const item = totals.get(name) || { name, tokens: 0, cost: 0, speedTokens: 0, speedMs: 0, tpSum: 0, tpCount: 0, throughput: null, members: new Set() };
            if (entry.client || entry.agent) item.members.add(entry.client || entry.agent);
            const tokens = ['input', 'output', 'reasoning', 'cacheRead', 'cacheWrite'].reduce((sum, key) => addKnown(sum, entry[key]), 0);
            item.tokens = addKnown(item.tokens, tokens);
            item.cost = addKnown(item.cost, entry.cost);
            const tpEntry = entry.throughput;
            if (tpEntry && Number.isFinite(tpEntry.tokensPerSec)) {
              item.tpSum += tpEntry.tokensPerSec;
              item.tpCount += 1;
              if (tpEntry.timedTokens > 0 && tpEntry.totalDurationMs > 0) {
                item.speedTokens += tpEntry.timedTokens;
                item.speedMs += tpEntry.totalDurationMs;
              }
            }
            item.throughput = item.speedMs > 0 ? item.speedTokens / (item.speedMs / 1000) : (item.tpCount > 0 ? item.tpSum / item.tpCount : null);
            totals.set(name, item);
          }
          return [...totals.values()].sort((a, b) => (b.tokens ?? -1) - (a.tokens ?? -1));
        };
        const rawAgentComparison = compare(entry => entry.client || entry.agent);
        const comparison = groupFamily ? compare(entry => agentFamily(entry.client || entry.agent)) : rawAgentComparison;
        const clientColorMap = new Map(rawAgentComparison.map((c, idx) => [c.name, palette[idx % palette.length]]));
        const modelComparison = compare(entry => entry.model);
        const sortedModels = [...modelComparison].sort((a, b) => {
          if (modelRankBy === 'cost') return (b.cost ?? -1) - (a.cost ?? -1);
          if (modelRankBy === 'tps') return (b.throughput ?? -1) - (a.throughput ?? -1);
          return (b.tokens ?? -1) - (a.tokens ?? -1);
        });

        // --- KPI Strip with Period Deltas & Micro-Visuals ---
        const decodeTps = tp?.decodeTokensPerSec;
        const engineTps = tp?.engineTokensPerSec;
        const avgTps = decodeTps ?? engineTps ?? tp?.avgTokensPerSec;
        const activeAgents = new Set(entries.map(e => e.client || e.agent).filter(Boolean));
        const activeModels = new Set(entries.map(e => e.model).filter(Boolean));
        const activeDaysCount = daily.filter(d => (d.totalTokens || 0) > 0).length;
        const peakDayItem = daily.reduce((pk, d) => (!pk || (d.totalTokens || 0) > (pk.totalTokens || 0) ? d : pk), null);

        const kpiTotal = [m.input, m.output, m.reasoning, m.cacheRead, m.cacheWrite].reduce((s, v) => s + (Number.isFinite(v) && v > 0 ? v : 0), 0);
        const totalMiniBar = kpiTotal > 0
          ? h('div', { 'aria-hidden': true, style: { display: 'flex', height: 4, borderRadius: 999, overflow: 'hidden', gap: 1, marginTop: 6, background: C.panel2 } },
              ...[m.input, m.output, m.reasoning, m.cacheRead].map((v, bi) => v > 0
                ? h('div', { key: bi, style: { width: `${(v / kpiTotal) * 100}%`, background: palette[bi] } })
                : null))
          : null;
        const hitRateRatio = typeof m.cacheHitRate === 'number' && Number.isFinite(m.cacheHitRate) ? Math.max(0, Math.min(1, m.cacheHitRate)) : null;
        const hitGauge = hitRateRatio != null
          ? h('svg', { width: 40, height: 40, viewBox: '0 0 36 36', 'aria-hidden': true, style: { flex: '0 0 40px' } },
              h('circle', { cx: 18, cy: 18, r: 14, fill: 'none', stroke: C.panel2, strokeWidth: 4 }),
              h('circle', {
                cx: 18, cy: 18, r: 14, fill: 'none', stroke: C.ok, strokeWidth: 4, strokeLinecap: 'round',
                strokeDasharray: `${(hitRateRatio * 87.96).toFixed(1)} 88`,
                transform: 'rotate(-90 18 18)',
              }))
          : null;

        const so = execProfile?.sessionOrigins;
        const sessionSub = so && (so.mainCount + so.subagentCount > 0)
          ? t(`${activeDaysCount || 1} 活跃天 · 主会话 ${so.mainCount} / 子代理 ${so.subagentCount}`, `${activeDaysCount || 1} active d · ${so.mainCount} main / ${so.subagentCount} sub`)
          : activeDaysCount > 0
            ? t(`${activeDaysCount} 个活跃日` + (tm?.max_concurrent_sessions ? ` · 峰值并发 ${tm.max_concurrent_sessions}` : ''), `${activeDaysCount} active days`)
            : `${t('输出', 'Output')} ${compact(m.output)}`;

        const windowWallMs = (Number(m.totalTokens) > 0)
          ? (execProfile?.timingBreakdown?.wallMs || ((applied?.range === 'month' || applied?.range === 'all') ? tm?.total_active_time_ms : 0))
          : 0;
        const cards = [
          [t('总 Token', 'Total tokens'), compact(m.totalTokens), reportStatus || `${t('输入', 'In')} ${compact(m.input)} · ${t('推理', 'Reas')} ${compact(m.reasoning)}`, num(m.totalTokens), totalMiniBar, deltaBadge(periodDelta?.tokenDeltaPct)],
          [t('估算费用', 'Est. cost'), cost(m.cost), activeDaysCount > 1 && Number.isFinite(m.cost) ? t(`活跃日均 ${shortCost(m.cost / activeDaysCount)}` + (peakDayItem ? ` · 峰值 ${peakDayItem.date.slice(5)}` : ''), `${shortCost(m.cost / activeDaysCount)} / active day`) : t('tokscale 估算 (非账单)', 'tokscale estimate'), t('基于 tokscale 模型定价估算，并非实际账单', 'Estimated via tokscale pricing, not a bill'), null, deltaBadge(periodDelta?.costDeltaPct)],
          [t('缓存命中率', 'Cache hit rate'), pct(m.cacheHitRate), `${t('复用读取', 'Cache read')} ${compact(m.cacheRead)}`, null, null, hitGauge],
          [t('消息 & 活跃规模', 'Messages & activity'), num(m.messages), sessionSub, null, null, null],
          [t('吞吐 & 响应时延', 'Throughput & latency'), Number.isFinite(avgTps) ? tpsFmt(avgTps) : durFmt(windowWallMs), [Number.isFinite(decodeTps) && Number.isFinite(engineTps) ? t(`综合 ${compact(engineTps)} t/s`, `Combined ${compact(engineTps)} t/s`) : null, Number.isFinite(tp?.avgTtftMs) ? `TTFT ${(tp.avgTtftMs / 1000).toFixed(1)}s` : null, windowWallMs ? durFmt(windowWallMs) : null].filter(Boolean).join(' · ') || t('等待计时样本', 'Awaiting timing samples'), null, null, null],
          [t('覆盖矩阵', 'Coverage'), `${activeAgents.size} / ${activeModels.size}`, [workspaces.length ? t(`${workspaces.length} 项目`, `${workspaces.length} projects`) : null, Number.isFinite(data?.totalTasks) && data.totalTasks > 0 ? t(`${data.totalTasks} 任务`, `${data.totalTasks} tasks`) : null].filter(Boolean).join(' · ') || t('Agent / 模型覆盖', 'Agents / models'), null, null, null],
        ];

        const kpiStrip = h('div', { className: 'tu-kpis' },
          ...cards.map(([name, val, sub, valTitle, extraBar, rightWidget], idx) => h('div', { key: name, className: 'tu-kpi', style: panel },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 } },
              h('div', { style: { minWidth: 0 } },
                h('div', { style: { color: C.muted, fontSize: 11.5 } }, name),
                h('div', { title: valTitle || undefined, style: { fontSize: 'clamp(16px, 1.75vw, 22px)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere', marginTop: 3 } }, val)),
              rightWidget || null),
            extraBar || null,
            h('div', { role: idx === 0 && reportStatus ? 'status' : undefined, style: { fontSize: 11, color: C.muted, marginTop: 4, overflowWrap: 'anywhere' } }, sub))));

        // --- Row 1 Left: Multi-Agent Stacked Trend Studio (with Smart Zoom & Instant Hover Readout) ---
        const showHourly = trendTab === 'hourly' && hourly.length > 0;
        const canZoomDaily = !showHourly && daily.length > 60;
        const visibleDaily = canZoomDaily && trendZoom === 'recent60' ? daily.slice(-60) : daily;
        const chartItems = showHourly ? hourly : visibleDaily;
        const hasStacked = !showHourly && chartItems.some(d => d?.byClient && Object.keys(d.byClient).length > 0);
        const effectiveMetric = trendMetric === 'stacked' && !hasStacked ? 'paired' : trendMetric;

        const valFor = item => {
          if (effectiveMetric === 'cost') return item.cost || 0;
          if (effectiveMetric === 'messages') return item.messages || 0;
          return item.totalTokens || 0;
        };
        const maxVal = chartItems.reduce((pk, d) => Math.max(pk, valFor(d)), 0) || 1;
        const maxCost = chartItems.reduce((pk, d) => Math.max(pk, d.cost || 0), 0) || 0.0001;
        const axisMax = effectiveMetric === 'cost' ? maxCost : Math.ceil(maxVal / 4) * 4;

        let trendBody;
        if (chartItems.length) {
          const nPts = chartItems.length;
          const showCostCurve = !showHourly && (effectiveMetric === 'stacked' || effectiveMetric === 'paired') && nPts >= 2 && chartItems.some(d => (d.cost || 0) > 0);
          const showHourlyCurve = showHourly && nPts >= 2;
          const curvePts = (showCostCurve || showHourlyCurve)
            ? chartItems.map((d, i) => {
                const x = ((i + 0.5) / nPts) * 100;
                const ratio = showHourlyCurve ? (valFor(d) / (axisMax || 1)) : ((d.cost || 0) / maxCost);
                const y = 100 - Math.max(3, Math.min(95, ratio * 92));
                return `${x.toFixed(2)},${y.toFixed(2)}`;
              }).join(' ')
            : '';
          const curveColor = showHourly ? palette[5] : palette[2];

          const hoverReadout = hoverTrend
            ? h('div', { style: { fontSize: 11.5, padding: '4px 10px', borderRadius: 8, background: C.bg, border: '1px solid ' + C.border, display: 'flex', flexWrap: 'wrap', gap: '4px 10px', marginTop: 8, fontVariantNumeric: 'tabular-nums' } },
                h('strong', { style: { color: palette[0] } }, hoverTrend.date || hoverTrend.hour),
                h('span', null, compact(hoverTrend.totalTokens) + ' tok'),
                Number.isFinite(hoverTrend.cost) && hoverTrend.cost > 0 ? h('span', { style: { color: palette[2] } }, cost(hoverTrend.cost)) : null,
                hoverTrend.messages ? h('span', { style: { color: C.muted } }, `${num(hoverTrend.messages)} msgs`) : null,
                ...(hoverTrend.byClient
                  ? Object.entries(hoverTrend.byClient)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3)
                      .map(([cn, cv]) => h('span', { key: cn, style: { color: C.muted } }, dot(clientColorMap.get(cn) || palette[0]), `${cn} ${compact(cv)}`))
                  : []))
            : null;

          trendBody = h('div', null,
            hoverReadout,
            h('div', { style: { display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', gap: 10, marginTop: 10 } },
              h('div', { 'aria-hidden': true, style: { position: 'relative', width: '8.5ch', height: 152, textAlign: 'right', color: C.muted, fontSize: 11, fontVariantNumeric: 'tabular-nums' } },
                ...[1, .75, .5, .25, 0].map(tick => h('span', { key: tick, style: { position: 'absolute', right: 0, bottom: `${tick * 100}%`, transform: 'translateY(50%)' } }, effectiveMetric === 'cost' ? '$' + (axisMax * tick).toFixed(2) : compact(axisMax * tick)))),
              h('div', {
                onMouseLeave: () => setHoverTrend(null),
                style: { position: 'relative', height: 152, overflowX: nPts > 64 ? 'auto' : 'hidden', padding: '0 6px', borderTop: '1px solid ' + C.border, backgroundImage: `repeating-linear-gradient(to top, ${C.border} 0 1px, transparent 1px 25%)` },
              },
              h('div', { style: { position: 'relative', display: 'flex', alignItems: 'end', gap: nPts > 35 ? 2 : 4, height: '100%', minWidth: nPts > 64 ? nPts * 9 : '100%' } },
                curvePts
                  ? h('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': true, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 } },
                      h('polyline', { fill: 'none', stroke: curveColor, strokeWidth: 2, vectorEffect: 'non-scaling-stroke', strokeLinecap: 'round', strokeLinejoin: 'round', points: curvePts }))
                  : null,
                ...chartItems.map((d, i) => {
                  const lbl = String(d.date || d.hour || '');
                  const titleText = `${lbl}: ${num(d.totalTokens)}` + (Number.isFinite(d.cost) && d.cost > 0 ? ` · ${cost(d.cost)}` : '') + (d.messages ? ` · ${d.messages} msgs` : '') + (d.turns ? ` · ${d.turns} turns` : '');
                  const onPickDay = d.date ? () => applyImmediate({ ...filters, range: 'custom', since: d.date, until: d.date }) : undefined;

                  if (effectiveMetric === 'stacked' && !showHourly && d.byClient && Object.keys(d.byClient).length > 0) {
                    const hTotal = Math.max(2, (d.totalTokens / (axisMax || 1)) * 100);
                    const segEntries = Object.entries(d.byClient).sort((a, b) => b[1] - a[1]);
                    return h('div', {
                      key: lbl || i, title: titleText, className: 'tu-bar-col',
                      onMouseEnter: () => setHoverTrend(d),
                      onClick: onPickDay,
                      style: { flex: '1 0 5px', maxWidth: 32, height: `${hTotal}%`, display: 'flex', flexDirection: 'column-reverse', borderRadius: '4px 4px 0 0', overflow: 'hidden', cursor: d.date ? 'pointer' : 'default' },
                    },
                    ...segEntries.map(([cName, cTok]) => h('div', {
                      key: cName,
                      style: { height: `${(cTok / (d.totalTokens || 1)) * 100}%`, background: clientColorMap.get(cName) || palette[0], minHeight: 1 },
                    })));
                  }

                  if (effectiveMetric === 'paired' && !showHourly) {
                    const hTok = Math.max(2, (d.totalTokens / (maxVal || 1)) * 100);
                    const hCost = Math.max(2, ((d.cost || 0) / maxCost) * 100);
                    return h('div', {
                      key: lbl || i, title: titleText, className: 'tu-bar-col',
                      onMouseEnter: () => setHoverTrend(d),
                      onClick: onPickDay,
                      style: { flex: '1 0 6px', maxWidth: 34, height: '100%', display: 'flex', alignItems: 'end', gap: 2, cursor: d.date ? 'pointer' : 'default' },
                    },
                    h('div', { style: { flex: 1, height: `${hTok}%`, background: palette[0], borderRadius: '3px 3px 0 0', opacity: 0.9 } }),
                    h('div', { style: { flex: 1, height: `${hCost}%`, background: palette[2], borderRadius: '3px 3px 0 0', opacity: 0.74 } }));
                  }

                  const hSingle = Math.max(2, (valFor(d) / (axisMax || 1)) * 100);
                  return h('div', {
                    key: lbl || i, title: titleText, className: 'tu-bar-col',
                    onMouseEnter: () => setHoverTrend(d),
                    onClick: onPickDay,
                    style: { flex: '1 0 5px', maxWidth: 32, height: `${hSingle}%`, background: showHourly ? palette[1] : palette[0], borderRadius: '4px 4px 0 0', cursor: d.date ? 'pointer' : 'default' },
                  });
                })))),
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 11, color: C.muted, marginTop: 7 } },
              h('span', null, chartItems[0].date || chartItems[0].hour),
              !showHourly && effectiveMetric === 'stacked'
                ? h('span', { style: { display: 'inline-flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' } },
                    ...rawAgentComparison.slice(0, 4).map(c => h('span', { key: c.name }, dot(clientColorMap.get(c.name) || palette[0]), c.name)),
                    showCostCurve ? h('span', null, dot(palette[2]), t('费用曲线', 'Cost curve')) : null)
                : !showHourly && effectiveMetric === 'paired'
                  ? h('span', null, dot(palette[0]), 'Token  ', dot(palette[2]), t('费用柱/曲线 (点击筛选单日)', 'Cost bar & curve'))
                  : showHourly
                    ? h('span', null, t('24 小时活跃波峰（悬停读数）', '24h hourly profile'))
                    : null,
              chartItems.length > 1 ? h('span', null, chartItems[chartItems.length - 1].date || chartItems[chartItems.length - 1].hour) : null));
        } else {
          trendBody = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px 12px', color: C.muted, fontSize: 12, marginTop: 10 } },
            h('span', null, t('此筛选条件下趋势数据不可用。', 'Trend data is unavailable for this selection.')),
            Number.isFinite(m.reasoning) && m.reasoning > 0 && !meta.derivedFromBase
              ? h('small', null, t('点击“刷新数据”即可基于 tokscale graph 生成含推理分项的完整日趋势。', 'Refresh to generate reasoning-inclusive daily trends via tokscale graph.'))
              : null);
        }

        const trendPanel = h('section', { style: panel },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
              h('strong', null, showHourly ? t('分时段用量趋势 (24h)', 'Hourly trend') : t('每日用量趋势', 'Daily trend')),
              meta.trendScope === 'last60d' && !showHourly
                ? h('span', { style: { fontSize: 11, color: C.muted, padding: '1px 7px', borderRadius: 999, border: '1px solid ' + C.border } }, t('近 60 天明细', 'Last 60d'))
                : null,
              canZoomDaily
                ? h('button', {
                    type: 'button',
                    onClick: () => setTrendZoom(z => z === 'recent60' ? 'all' : 'recent60'),
                    style: { ...button, padding: '2px 8px', fontSize: 11, borderRadius: 999, ...(trendZoom === 'all' ? activePill : {}) },
                  }, trendZoom === 'recent60' ? t(`展开全历史 (${daily.length}天)`, `All ${daily.length}d`) : t('聚焦近 60 天', 'Recent 60d'))
                : null),
            h('div', { style: { display: 'flex', gap: 5, flexWrap: 'wrap' } },
              hourly.length ? h('button', { type: 'button', style: { ...button, padding: '3px 8px', fontSize: 11, ...(trendTab === 'hourly' ? activePill : {}) }, onClick: () => setTrendTab(trendTab === 'hourly' ? 'daily' : 'hourly') }, trendTab === 'hourly' ? t('切回每日', 'Show daily') : t('24h分时段', 'Hourly')) : null,
              ...[['stacked', t('Agent堆叠', 'Stacked')], ['paired', t('双柱', 'Paired')], ['tokens', 'Token'], ['cost', t('费用', 'Cost')], ['messages', t('消息', 'Msgs')]].map(([mk, ml]) =>
                h('button', { key: mk, type: 'button', style: { ...button, padding: '3px 8px', fontSize: 11, ...(effectiveMetric === mk ? activePill : {}) }, onClick: () => setTrendMetric(mk) }, ml)))),
          trendBody);

        // --- Row 1 Right: 8-Week Activity Heatmap + Weekday Rhythm Strip ---
        const selectedDay = filters.range === 'custom' && filters.since && filters.since === filters.until ? filters.since : '';
        const wdLabels = [t('一', 'Mon'), t('二', 'Tue'), t('三', 'Wed'), t('四', 'Thu'), t('五', 'Fri'), t('六', 'Sat'), t('日', 'Sun')];
        const maxWdAvg = weekdayProfile.reduce((mx, w) => Math.max(mx, w.avgTokens || 0), 1);

        const heatmapPanel = h('section', { style: panel, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
          h('div', null,
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 } },
              h('div', null,
                h('strong', null, t('8 周活动热力图', '8-week activity')),
                h('span', { style: { fontSize: 11, color: C.muted, marginLeft: 8 } },
                  hoverHeat ? `${hoverHeat.date} · ${compact(hoverHeat.tokens)} · ${cost(hoverHeat.cost)}` : t('点击格子按单日下钻', 'Click day to filter'))),
              h('div', { style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.muted } },
                t('少', 'Less'),
                ...heatColors.map((bg, idx) => h('span', { key: idx, style: { width: 10, height: 10, borderRadius: 2, background: bg, display: 'inline-block' } })),
                t('多', 'More'))),
            heatmap.length
              ? h('div', { className: 'tu-heat-wrap', onMouseLeave: () => setHoverHeat(null) },
                  h('div', { className: 'tu-heat-days', 'aria-hidden': true },
                    ...[t('一', 'M'), '', t('三', 'W'), '', t('五', 'F'), '', t('日', 'S')].map((wd, wi) => h('span', { key: wi }, wd))),
                  h('div', { className: 'tu-heat-grid' },
                    ...heatmap.map(cellItem => {
                      const isSel = selectedDay === cellItem.date;
                      return h('button', {
                        key: cellItem.date, type: 'button',
                        className: 'tu-heat-cell' + (isSel ? ' selected' : ''),
                        title: `${cellItem.date}: ${compact(cellItem.tokens)} (${num(cellItem.tokens)}) · ${cost(cellItem.cost)} · ${cellItem.messages} msgs`,
                        style: { background: heatColors[Math.min(4, Math.max(0, cellItem.intensity || 0))] },
                        onMouseEnter: () => setHoverHeat(cellItem),
                        onClick: () => {
                          if (isSel) applyImmediate(initialFilters);
                          else applyImmediate({ ...filters, range: 'custom', since: cellItem.date, until: cellItem.date });
                        },
                      });
                    })))
              : h('p', { style: { color: C.muted, fontSize: 12, margin: '20px 0' } }, t('热力图等待首轮 graph 扫描完成后生成。', 'Activity heatmap populates after the initial graph scan.'))),
          weekdayProfile.some(w => w.avgTokens > 0)
            ? h('div', { style: { marginTop: 10, paddingTop: 9, borderTop: '1px solid ' + C.border } },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginBottom: 6 } },
                  h('span', null, t('周内日均活跃节律', 'Weekday avg rhythm')),
                  h('span', null, t('峰值: 周', 'Peak: ') + wdLabels[weekdayProfile.reduce((bi, w, i, arr) => (w.avgTokens > arr[bi].avgTokens ? i : bi), 0)])),
                h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, alignItems: 'end', height: 36 } },
                  ...weekdayProfile.map((w, wi) => {
                    const hPct = Math.max(8, (w.avgTokens / maxWdAvg) * 100);
                    return h('div', { key: wi, title: `${wdLabels[wi]}: avg ${compact(w.avgTokens)} (${w.activeDays} active d)`, style: { display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 3 } },
                      h('div', { style: { width: '100%', height: `${hPct}%`, background: w.avgTokens === maxWdAvg ? palette[0] : tint(palette[0]), border: '1px solid ' + (w.avgTokens === maxWdAvg ? palette[0] : C.border), borderRadius: 4 } }),
                      h('span', { style: { fontSize: 10, color: C.muted, lineHeight: 1 } }, wdLabels[wi]));
                  })))
            : null);

        // --- Row 2 Card 1: Token Composition + DSH Output Anatomy ---
        const categories = [
          [t('输入', 'Input'), m.input], [t('输出', 'Output'), m.output], [t('推理', 'Reasoning'), m.reasoning],
          [t('缓存读取', 'Cache read'), m.cacheRead], [t('缓存写入', 'Cache write'), m.cacheWrite],
        ];
        const categoriesValid = categories.every(([, value]) => typeof value === 'number' && Number.isFinite(value) && value >= 0);
        const categoryTotal = categoriesValid ? categories.reduce((sum, [, value]) => sum + value, 0) : 0;
        const ob = execProfile?.outputBreakdown;
        const obTotal = ob ? (ob.answerTokens || 0) + (ob.reasoningTokens || 0) + (ob.toolCallTokens || 0) : 0;

        let composition = h('p', { style: { color: C.muted } }, t('此筛选条件下分类构成不可用。', 'Token composition is unavailable for this selection.'));
        if (categoriesValid && categoryTotal > 0) {
          composition = h('div', { style: { display: 'grid', gap: 11, marginTop: 12 } },
            h('div', { 'aria-hidden': true, style: { display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', background: C.panel2, gap: 2 } },
              ...categories.map(([name, value], i) => value > 0
                ? h('div', { key: name, title: `${name}: ${compact(value)} (${pct(value / categoryTotal)})`, style: { width: `${Math.max(1.2, (value / categoryTotal) * 100)}%`, background: palette[i], borderRadius: 3 } })
                : null)),
            h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7, fontVariantNumeric: 'tabular-nums' } },
              ...categories.map(([name, value], i) => {
                const shareStr = value > 0 && value / categoryTotal < 0.001 ? '<0.1%' : pct(value / categoryTotal);
                return h('div', {
                  key: name,
                  title: `${name}: ${num(value)}`,
                  style: { borderLeft: '3px solid ' + palette[i], background: C.bg, borderRadius: 6, padding: '6px 9px', display: 'grid', gap: 2, minWidth: 0 },
                },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: C.muted } },
                  h('span', null, name),
                  h('span', null, shareStr)),
                h('strong', { style: { fontSize: 13.5, fontWeight: 650 } }, compact(value)));
              })),
            obTotal > 0
              ? h('div', { style: { paddingTop: 8, borderTop: '1px solid ' + C.border, display: 'grid', gap: 5 } },
                  h('div', { style: { fontSize: 11, color: C.muted, display: 'flex', justifyContent: 'space-between' } },
                    h('span', null, t('DSH 生成端细分', 'DSH generation split')),
                    h('span', null, compact(obTotal) + ' out')),
                  h('div', { style: { display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', gap: 1, background: C.panel2 } },
                    ...[
                      [ob.answerTokens, palette[1]],
                      [ob.reasoningTokens, palette[2]],
                      [ob.toolCallTokens, palette[3]],
                    ].map(([v, c], oi) => v > 0 ? h('div', { key: oi, style: { width: `${(v / obTotal) * 100}%`, background: c } }) : null)),
                  h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 10.5, color: C.muted } },
                    h('span', null, dot(palette[1]), t('正文 ', 'Ans ') + compact(ob.answerTokens)),
                    h('span', null, dot(palette[2]), t('思考 ', 'Reas ') + compact(ob.reasoningTokens)),
                    h('span', null, dot(palette[3]), t('工具调用 ', 'Calls ') + compact(ob.toolCallTokens))))
              : null);
        }

        // --- Row 2 Card 2: Agent Donut Chart (Agents ONLY, with Family Merge Toggle!) ---
        const hasMultiFamily = rawAgentComparison.length > compare(entry => agentFamily(entry.client || entry.agent)).length;
        const agentDonut = (() => {
          if (!comparison.length) return h('p', { style: { color: C.muted, fontSize: 12 } }, t('没有可用的明细。', 'No breakdown is available.'));
          const agentTotal = comparison.reduce((sum, it) => sum + (Number.isFinite(it.tokens) && it.tokens > 0 ? it.tokens : 0), 0);
          const maxAgentTok = comparison.reduce((mx, it) => Math.max(mx, Number.isFinite(it.tokens) ? it.tokens : 0), 1);
          let offset = 0;
          const segments = agentTotal > 0
            ? comparison.map((it, i) => {
                const v = Number.isFinite(it.tokens) && it.tokens > 0 ? it.tokens : 0;
                const len = (v / agentTotal) * 100;
                const col = clientColorMap.get(it.name) || palette[i % palette.length];
                const seg = len > 0 ? `${col} ${offset}% ${offset + len}%` : null;
                offset += len;
                return seg;
              }).filter(Boolean)
            : [];
          const topAgent = comparison[0];
          const topShare = agentTotal > 0 && Number.isFinite(topAgent?.tokens) ? pct(topAgent.tokens / agentTotal) : '';
          return h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 12 } },
            segments.length
              ? h('div', { 'aria-hidden': true, style: { display: 'grid', placeItems: 'center', flex: '0 0 112px', height: 112, borderRadius: '50%', background: `conic-gradient(${segments.join(',')})` } },
                  h('div', { style: { width: 74, height: 74, borderRadius: '50%', background: C.panel, display: 'grid', placeItems: 'center', alignContent: 'center', textAlign: 'center', lineHeight: 1.25 } },
                    h('strong', { style: { fontSize: 12 } }, `${comparison.length} Agent`),
                    topShare ? h('span', { style: { fontSize: 10, color: C.muted } }, topShare) : null))
              : null,
            h('div', { style: { display: 'grid', gap: 6, flex: 1, minWidth: 190, maxHeight: 232, overflowY: 'auto' } },
              ...comparison.map((item, i) => {
                const color = clientColorMap.get(item.name) || palette[i % palette.length];
                const share = agentTotal > 0 && Number.isFinite(item.tokens) ? item.tokens / agentTotal : null;
                const barW = Number.isFinite(item.tokens) && maxAgentTok > 0 ? Math.max(2, (item.tokens / maxAgentTok) * 100) : 0;
                const pickTarget = groupFamily && item.members?.size === 1 ? [...item.members][0] : item.name;
                const canPick = !groupFamily || item.members?.size === 1 || catalog.clients.includes(item.name);
                return h('div', {
                  key: item.name,
                  title: `${item.name}${item.members?.size > 1 ? ' (' + [...item.members].join(', ') + ')' : ''}: ${num(item.tokens)} tokens · ${cost(item.cost)}` + (Number.isFinite(item.throughput) ? ` · ${tpsFmt(item.throughput)}` : ''),
                  onClick: canPick ? () => change('client', pickTarget) : undefined,
                  style: { display: 'grid', gap: 3, fontSize: 12, cursor: canPick ? 'pointer' : 'default', padding: '3px 6px', borderRadius: 6, background: barW > 0 ? `linear-gradient(to right, ${tint(color)} ${barW.toFixed(1)}%, transparent ${barW.toFixed(1)}%)` : undefined },
                },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 } },
                  h('span', { style: { overflowWrap: 'anywhere', minWidth: 0, fontWeight: 500 } },
                    dot(color),
                    item.name,
                    groupFamily && item.members?.size > 1 ? h('small', { style: { color: C.muted, marginLeft: 4 } }, `×${item.members.size}`) : null),
                  h('span', { style: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } },
                    h('strong', { title: num(item.tokens) }, compact(item.tokens)),
                    h('small', { style: { color: C.muted, marginLeft: 6 } }, cost(item.cost)),
                    share != null ? h('small', { style: { color: C.muted, marginLeft: 5 } }, share > 0 && share < 0.001 ? '<0.1%' : pct(share)) : null,
                    Number.isFinite(item.throughput) ? h('small', { style: { color: C.ok, marginLeft: 5 } }, item.throughput.toFixed(0) + 't/s') : null)));
              })));
        })();

        // --- Row 2 Card 3: Model Ranking Bars ---
        const ranking = (items, color, { showCost = false, metricKey = 'tokens', onPick } = {}) => {
          const valOf = it => (metricKey === 'cost' ? it.cost : metricKey === 'tps' ? it.throughput : it.tokens);
          const maximum = items.reduce((mx, it) => Math.max(mx, valOf(it) ?? 0), 1);
          return items.length
            ? h('div', { style: { display: 'grid', gap: 9, marginTop: 12, maxHeight: 232, overflowY: 'auto' } },
                ...items.map((item, idx) => {
                  const val = valOf(item);
                  const rightPrimary = metricKey === 'cost' ? cost(item.cost) : metricKey === 'tps' ? tpsFmt(item.throughput) : compact(item.tokens);
                  return h('div', { key: item.name, onClick: onPick ? () => onPick(item.name) : undefined, style: { cursor: onPick ? 'pointer' : 'default' } },
                    h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 } },
                      h('span', { style: { overflowWrap: 'anywhere' } },
                        h('span', { style: { fontSize: 10, color: C.muted, marginRight: 6, fontVariantNumeric: 'tabular-nums' } }, `#${idx + 1}`),
                        item.name),
                      h('span', { style: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } },
                        h('span', { title: metricKey === 'tokens' ? num(item.tokens) : undefined }, rightPrimary),
                        showCost && metricKey !== 'cost' ? h('small', { style: { color: C.muted, marginLeft: 8 } }, cost(item.cost)) : null,
                        metricKey !== 'tps' && Number.isFinite(item.throughput) ? h('small', { style: { color: C.ok, marginLeft: 6 } }, item.throughput.toFixed(0) + 't/s') : null)),
                    Number.isFinite(val) ? h('div', { style: { background: tint(color), height: 8, borderRadius: 999, marginTop: 4, overflow: 'hidden' } },
                      h('div', { style: { width: Math.max(2, Math.min(100, (val / maximum) * 100)) + '%', background: color, height: '100%', borderRadius: 999 } })) : null);
                }))
            : h('p', { style: { color: C.muted, fontSize: 12 } }, t('没有可用的明细。', 'No breakdown is available.'));
        };

        // --- Row 3 Left: Quadrant Model Efficiency Bubble Matrix ---
        const bubbleRows = (() => {
          const byModel = new Map();
          for (const e of entries) {
            if (!e?.model) continue;
            const cur = byModel.get(e.model) || { model: e.model, client: e.client || e.agent || '', tokens: 0, cost: 0, messages: 0, throughput: null };
            const tk = ['input', 'output', 'reasoning', 'cacheRead', 'cacheWrite'].reduce((s, k) => s + (Number(e[k]) || 0), 0);
            cur.tokens += tk;
            cur.cost += Number(e.cost) || 0;
            cur.messages += Number(e.messageCount ?? e.messages) || 0;
            if (!cur.throughput && Number.isFinite(e?.throughput?.tokensPerSec)) cur.throughput = e.throughput.tokensPerSec;
            byModel.set(e.model, cur);
          }
          return [...byModel.values()].filter(r => r.tokens > 0).sort((a, b) => b.tokens - a.tokens).slice(0, 16);
        })();
        const bubbleModeTps = modelRankBy === 'tps' && bubbleRows.filter(r => Number.isFinite(r.throughput) && r.throughput > 0).length >= 3;
        const bubblePanel = bubbleRows.length >= 2
          ? (() => {
              const W = 640, H = 212, padL = 54, padR = 24, padT = 22, padB = 26;
              const logX = v => Math.log10(Math.max(1000, v));
              const xs = bubbleRows.map(r => logX(r.tokens));
              const minX = Math.min(...xs), maxX = Math.max(...xs, minX + 0.5);
              const midX = padL + 0.5 * (W - padL - padR);
              const midY = padT + 0.5 * (H - padT - padB);
              const yScale = v => bubbleModeTps ? Math.log10(Math.max(10, v)) : Math.sqrt(Math.max(0, v));
              const rawYs = bubbleRows.map(r => bubbleModeTps ? Math.max(10, r.throughput || 10) : Math.max(0, r.cost));
              const ys = rawYs.map(yScale);
              const minY = bubbleModeTps ? Math.min(...ys) : 0;
              const maxY = Math.max(...ys, minY + 0.5);
              const maxCostB = Math.max(...bubbleRows.map(r => r.cost), 0.01);
              const maxMsgs = Math.max(1, ...bubbleRows.map(r => r.messages));
              const placed = [];
              return h('section', { style: panel },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 } },
                  h('div', null,
                    h('strong', null, t('模型效能分布气泡图', 'Model efficiency map')),
                    h('span', { style: { fontSize: 11, color: C.muted, marginLeft: 8 } },
                      hoverBubble
                        ? `${hoverBubble.model} (${hoverBubble.client}) · ${compact(hoverBubble.tokens)} · ${cost(hoverBubble.cost)}` + (Number.isFinite(hoverBubble.throughput) ? ` · ${tpsFmt(hoverBubble.throughput)}` : '')
                        : bubbleModeTps
                          ? t('横轴: 用量(对数) · 纵轴: 吞吐(对数) · 气泡: 费用', 'X: Tokens · Y: tok/s · Size: Cost')
                          : t('横轴: 用量(对数) · 纵轴: 费用($) · 气泡: 消息数', 'X: Tokens · Y: Cost · Size: Msgs'))),
                  h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: C.muted } },
                    ...rawAgentComparison.slice(0, 4).map(c => h('span', { key: c.name }, dot(clientColorMap.get(c.name) || palette[0]), c.name)))),
                h('svg', {
                  viewBox: `0 0 ${W} ${H}`,
                  onMouseLeave: () => setHoverBubble(null),
                  style: { width: '100%', height: 'auto', maxHeight: 224, display: 'block' },
                },
                // Quadrant reference crosshairs
                h('line', { x1: midX, y1: padT, x2: midX, y2: H - padB, stroke: C.border, strokeDasharray: '4 4', strokeWidth: 1 }),
                h('line', { x1: padL, y1: midY, x2: W - padR, y2: midY, stroke: C.border, strokeDasharray: '4 4', strokeWidth: 1 }),
                ...[0, 0.33, 0.66, 1].map((tFrac, gi) => {
                  const y = padT + (1 - tFrac) * (H - padT - padB);
                  const valAt = bubbleModeTps ? Math.pow(10, minY + tFrac * (maxY - minY)) : Math.pow(tFrac * maxY, 2);
                  const yLbl = bubbleModeTps
                    ? (valAt >= 1000 ? (valAt / 1000).toFixed(1) + 'K' : Math.round(valAt)) + ' t/s'
                    : '$' + (valAt >= 100 ? Math.round(valAt) : valAt.toFixed(1));
                  return h('g', { key: gi },
                    h('line', { x1: padL, y1: y, x2: W - padR, y2: y, stroke: C.border, strokeDasharray: '2 4', strokeWidth: 0.8 }),
                    h('text', { x: padL - 6, y: y + 4, textAnchor: 'end', fill: C.muted, fontSize: 10 }, yLbl));
                }),
                ...bubbleRows.map((r, bi) => {
                  const cx = padL + ((logX(r.tokens) - minX) / (maxX - minX)) * (W - padL - padR);
                  const yv = yScale(bubbleModeTps ? Math.max(10, r.throughput || 10) : Math.max(0, r.cost));
                  const cy = padT + (1 - (yv - minY) / (maxY - minY)) * (H - padT - padB);
                  const rad = bubbleModeTps
                    ? 6 + Math.sqrt(Math.max(0, r.cost) / maxCostB) * 16
                    : 6 + Math.sqrt(Math.max(1, r.messages) / maxMsgs) * 16;
                  const col = clientColorMap.get(r.client) || palette[bi % palette.length];
                  const shortName = r.model.length > 15 ? r.model.slice(0, 14) + '…' : r.model;
                  const ly = Math.max(11, cy - rad - 4);
                  const canLabel = bi < 8 && placed.every(p => Math.abs(p.x - cx) > 64 || Math.abs(p.y - ly) > 15);
                  if (canLabel) placed.push({ x: cx, y: ly });
                  return h('g', {
                    key: r.model,
                    style: { cursor: 'pointer' },
                    onMouseEnter: () => setHoverBubble(r),
                    onClick: () => change('model', r.model),
                  },
                  h('title', null, `${r.model} (${r.client})\nTokens: ${compact(r.tokens)} (${num(r.tokens)})\nCost: ${cost(r.cost)}\nThroughput: ${tpsFmt(r.throughput)}\nMessages: ${num(r.messages)}`),
                  h('circle', { cx, cy, r: rad, fill: col, fillOpacity: hoverBubble?.model === r.model ? 0.68 : 0.44, stroke: col, strokeWidth: hoverBubble?.model === r.model ? 2.6 : 1.8 }),
                  canLabel ? h('text', { x: cx, y: ly, textAnchor: 'middle', fill: C.text, fontSize: 10, fontWeight: 500 }, shortName) : null);
                }),
                h('text', { x: padL, y: H - 6, fill: C.muted, fontSize: 10 }, compact(Math.pow(10, minX))),
                h('text', { x: W - padR, y: H - 6, textAnchor: 'end', fill: C.muted, fontSize: 10 }, compact(Math.pow(10, maxX)))));
            })()
          : null;

        // --- Row 3 Right: Dual-Tab Deep Telemetry Workbench ([项目工作区矩阵] ⇄ [DSH 耗时解剖 & 工具热力]) ---
        const tbd = execProfile?.timingBreakdown;
        const topTools = execProfile?.topTools || [];
        const hasExecAnatomy = Boolean(tbd && (tbd.ttftMs + tbd.reasoningMs + tbd.textMs + tbd.toolArgMs + tbd.toolsMs > 0 || topTools.length > 0));
        const activeDeepTab = insightTab === 'execution' && hasExecAnatomy ? 'execution' : (workspaces.length > 0 ? 'workspaces' : (hasExecAnatomy ? 'execution' : 'workspaces'));

        const workspaceTreemap = (() => {
          if (!workspaces.length) {
            return h('p', { style: { color: C.muted, fontSize: 12, marginTop: 14 } }, t('当前筛选暂无项目目录归属记录。', 'No project workspace attribution in this window.'));
          }
          const wsTotal = workspaces.reduce((s, w) => s + (w.totalTokens || 0), 0) || 1;
          return h('div', { className: 'tu-treemap' },
            ...workspaces.slice(0, 8).map((w, wi) => {
              const share = w.totalTokens / wsTotal;
              const basisPct = Math.max(22, Math.min(100, Math.round(share * 140)));
              const col = palette[wi % palette.length];
              const isSelected = workspaceFilter === w.workspaceKey;
              return h('div', {
                key: w.workspaceKey,
                className: 'tu-ws-tile',
                title: `${w.workspaceKey}\nTokens: ${compact(w.totalTokens)} (${pct(share)})` + (w.cost > 0 ? `\nEst. cost: ${cost(w.cost)}` : ''),
                onClick: () => setWorkspaceFilter(prev => prev === w.workspaceKey ? '' : w.workspaceKey),
                style: {
                  flex: `${Math.max(1, Math.round(share * 10))} 1 ${basisPct}%`,
                  borderLeft: `4px solid ${col}`,
                  borderColor: isSelected ? palette[0] : undefined,
                  background: isSelected ? tint(col) : `linear-gradient(135deg, ${tint(col)} 0%, ${C.bg} 75%)`,
                },
              },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 } },
                h('strong', { style: { fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, w.label),
                h('span', { style: { fontSize: 10.5, color: C.muted, fontVariantNumeric: 'tabular-nums' } }, pct(share))),
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6, fontVariantNumeric: 'tabular-nums' } },
                h('strong', { style: { fontSize: 14, color: col } }, compact(w.totalTokens)),
                h('span', { style: { fontSize: 10.5, color: C.muted } },
                  [w.cost > 0 ? shortCost(w.cost) : null, w.taskCount > 0 ? `${w.taskCount}t` : null, ...(w.clients || []).slice(0, 2)].filter(Boolean).join(' · '))));
            }));
        })();

        const executionAnatomyView = (() => {
          if (!hasExecAnatomy) {
            return h('p', { style: { color: C.muted, fontSize: 12, marginTop: 14 } }, t('当前筛选不含 DSH 细粒度阶段计时样本。', 'No DSH phase timing samples in this filter.'));
          }
          const phases = [
            [t('首字等待 TTFT', 'TTFT wait'), tbd.ttftMs, palette[2]],
            [t('思考推理', 'Reasoning'), tbd.reasoningMs, palette[3]],
            [t('正文生成', 'Answer gen'), tbd.textMs, palette[1]],
            [t('工具编排', 'Tool args'), tbd.toolArgMs, palette[0]],
            [t('工具执行', 'Tool exec'), tbd.toolsMs, palette[5]],
          ].filter(([, ms]) => ms > 0);
          const phaseSum = phases.reduce((s, [, ms]) => s + ms, 0) || 1;
          const maxToolCalls = topTools.reduce((mx, tl) => Math.max(mx, tl.calls || 0), 1);

          return h('div', { style: { display: 'grid', gap: 10, marginTop: 10 } },
            phases.length
              ? h('div', { style: { display: 'grid', gap: 6 } },
                  h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted } },
                    h('span', null, t('阶段耗时解剖', 'Phase timing anatomy')),
                    h('span', null, `${tbd.calls || 0} LLM calls · ${tbd.toolCalls || 0} tool calls`)),
                  h('div', { style: { display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', gap: 1.5, background: C.panel2 } },
                    ...phases.map(([pName, ms, col]) => h('div', {
                      key: pName,
                      title: `${pName}: ${durFmt(ms)} (${pct(ms / phaseSum)})`,
                      style: { width: `${Math.max(2, (ms / phaseSum) * 100)}%`, background: col },
                    }))),
                  h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px 10px', fontSize: 11 } },
                    ...phases.map(([pName, ms, col]) => h('span', { key: pName, style: { color: C.muted, fontVariantNumeric: 'tabular-nums' } },
                      dot(col), `${pName} `, h('strong', { style: { color: C.text } }, durFmt(ms))))))
              : null,
            topTools.length
              ? h('div', { style: { display: 'grid', gap: 6, maxHeight: 128, overflowY: 'auto', paddingTop: 6, borderTop: '1px solid ' + C.border } },
                  ...topTools.slice(0, 6).map((tl, ti) => h('div', { key: tl.name, style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(60px, 1fr) auto', alignItems: 'center', gap: 8, fontSize: 11.5 } },
                    h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: tl.name }, tl.name),
                    h('div', { style: { height: 6, borderRadius: 999, background: tint(palette[ti % palette.length]), overflow: 'hidden' } },
                      h('div', { style: { width: `${Math.max(4, (tl.calls / maxToolCalls) * 100)}%`, height: '100%', background: palette[ti % palette.length], borderRadius: 999 } })),
                    h('span', { style: { fontVariantNumeric: 'tabular-nums', color: C.muted, whiteSpace: 'nowrap', fontSize: 11 } }, `${tl.calls}× · ${durFmt(tl.avgMs)}/次`))))
              : null);
        })();

        const deepTelemetryPanel = (workspaces.length > 0 || hasExecAnatomy)
          ? h('section', { style: panel },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                h('strong', null, activeDeepTab === 'workspaces' ? t('项目工作区消耗矩阵', 'Workspace treemap') : t('DSH 耗时解剖与高频工具', 'Execution & tool telemetry')),
                h('div', { style: { display: 'flex', gap: 4 } },
                  h('button', { type: 'button', style: { ...button, padding: '2px 8px', fontSize: 11, ...(activeDeepTab === 'workspaces' ? activePill : {}) }, onClick: () => setInsightTab('workspaces') }, t('项目矩阵', 'Workspaces')),
                  hasExecAnatomy
                    ? h('button', { type: 'button', style: { ...button, padding: '2px 8px', fontSize: 11, ...(activeDeepTab === 'execution' ? activePill : {}) }, onClick: () => setInsightTab('execution') }, t('耗时&工具', 'Timing & tools'))
                    : null)),
              activeDeepTab === 'workspaces' ? workspaceTreemap : executionAnatomyView)
          : null;

        // --- Row 4: Interactive Task Stream ---
        const filteredTasks = tasks
          .filter(tk => !workspaceFilter || tk.workspaceKey === workspaceFilter)
          .filter(tk => !taskQuery || [tk.title, tk.cwd, tk.model, tk.client].some(v => String(v || '').toLowerCase().includes(taskQuery.toLowerCase())))
          .sort((a, b) => {
            if (taskSort === 'recent') return (b.updatedAt || 0) - (a.updatedAt || 0);
            if (taskSort === 'tps') return (b.outputTps ?? -1) - (a.outputTps ?? -1);
            return (b.totalTokens || 0) - (a.totalTokens || 0);
          });
        const visibleTasks = showAllTasks ? filteredTasks.slice(0, 40) : filteredTasks.slice(0, 6);
        const maxTaskTok = filteredTasks.reduce((mx, tk) => Math.max(mx, tk.totalTokens || 0), 1);
        const taskPanel = h('section', { style: panel },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
              h('strong', null, t('任务用量详情', 'Task usage')),
              h('span', { style: { fontSize: 12, color: C.muted } }, t(`共 ${filteredTasks.length} 个关联会话任务`, `${filteredTasks.length} matched tasks`)),
              workspaceFilter
                ? h('button', { type: 'button', onClick: () => setWorkspaceFilter(''), style: { ...button, padding: '2px 8px', fontSize: 11, borderRadius: 999, background: tint(palette[0]), borderColor: palette[0] } }, `${workspaceFilter.split('/').pop()} ×`)
                : null),
            h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' } },
              h('input', { type: 'search', value: taskQuery, placeholder: t('搜索任务名/项目/模型…', 'Filter tasks…'), onChange: e => setTaskQuery(e.target.value), style: { ...button, padding: '4px 9px', minWidth: 150, fontSize: 12 } }),
              ...[['tokens', t('按用量', 'By tokens')], ['recent', t('按最近', 'Recent')], ['tps', t('按吞吐', 'By speed')]].map(([sk, sl]) =>
                h('button', { key: sk, type: 'button', style: { ...button, padding: '4px 8px', fontSize: 11, ...(taskSort === sk ? activePill : {}) }, onClick: () => setTaskSort(sk) }, sl)))),
          visibleTasks.length
            ? h('div', { className: 'tu-tasks' },
                ...visibleTasks.map(tk => {
                  const tc = clientColorMap.get(tk.client) || (tk.client === 'dsh' ? palette[0] : palette[1]);
                  const tPct = maxTaskTok > 0 ? Math.max(3, Math.min(100, ((tk.totalTokens || 0) / maxTaskTok) * 100)) : 0;
                  return h('div', { key: tk.client + ':' + tk.id, className: 'tu-task-card' },
                    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 } },
                      h('div', { style: { display: 'flex', alignItems: 'center', gap: 5 } },
                        h('span', { style: { fontSize: 10.5, fontWeight: 650, padding: '2px 7px', borderRadius: 999, background: tint(tc), color: tc } }, tk.client.toUpperCase()),
                        tk.isSubagent ? h('span', { style: { fontSize: 10, padding: '1px 6px', borderRadius: 999, background: tint(palette[3]), color: palette[3] } }, 'SUB') : null,
                        tk.contextRatio != null ? h('span', { title: t('峰值上下文窗口占用率', 'Context window load'), style: { fontSize: 10, color: tk.contextRatio > 0.8 ? C.warn : C.muted } }, `CTX ${Math.round(tk.contextRatio * 100)}%`) : null),
                      h('span', { style: { fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, tk.model)),
                    h('div', { style: { fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: tk.title }, tk.title),
                    tk.cwd ? h('div', { style: { fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: tk.workspaceKey ? 'pointer' : 'default' }, title: tk.cwd, onClick: tk.workspaceKey ? () => setWorkspaceFilter(tk.workspaceKey) : undefined }, shortPath(tk.cwd)) : null,
                    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, fontVariantNumeric: 'tabular-nums', paddingTop: 4, borderTop: '1px solid ' + C.border } },
                      h('strong', null, compact(tk.totalTokens) + ' tok'),
                      h('span', { style: { color: C.muted, fontSize: 11 } }, [
                        Number.isFinite(tk.outputTps) ? tpsFmt(tk.outputTps) : null,
                        tk.wallMs > 0 ? durFmt(tk.wallMs) : null,
                        tk.turns > 0 ? `${tk.turns}t` : null,
                      ].filter(Boolean).join(' · ') || time(tk.updatedAt))),
                    h('div', { 'aria-hidden': true, style: { height: 3, borderRadius: 999, background: C.panel2, overflow: 'hidden' } },
                      h('div', { style: { width: `${tPct.toFixed(1)}%`, height: '100%', background: tc, borderRadius: 999 } })));
                }))
            : h('p', { style: { color: C.muted, fontSize: 12, margin: 0 } }, t('当前筛选范围内暂无本地任务记录（支持 DSH 与 Codex 近期会话）。', 'No local task records in this filter window (reads DSH & recent Codex sessions).')),
          filteredTasks.length > 6
            ? h('button', { type: 'button', style: { ...button, marginTop: 10 }, onClick: () => setShowAllTasks(v => !v) },
                showAllTasks ? t('收起任务列表', 'Show top 6 tasks') : t(`展开更多 (${Math.min(40, filteredTasks.length)})`, `Show more (${Math.min(40, filteredTasks.length)})`))
            : null);

        const deepRow = bubblePanel && deepTelemetryPanel
          ? h('div', { className: 'tu-deep' }, bubblePanel, deepTelemetryPanel)
          : (bubblePanel || deepTelemetryPanel);

        results = h(React.Fragment, null,
          kpiStrip,
          daily.length || heatmap.length || hourly.length
            ? h('div', { className: 'tu-summary' }, trendPanel, heatmapPanel)
            : null,
          h('div', { style: { ...grid(280), alignItems: 'start' } },
            h('section', { style: panel }, h('strong', null, t('Token 构成', 'Token composition')), composition),
            h('section', { style: panel },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
                h('strong', null, t('Agent 用量对比', 'Agent usage comparison')),
                h('div', { style: { display: 'flex', gap: 4 } },
                  hasMultiFamily
                    ? h('button', { type: 'button', style: { ...button, padding: '2px 8px', fontSize: 11, ...(groupFamily ? activePill : {}) }, onClick: () => setGroupFamily(v => !v) }, groupFamily ? t('已合并同系', 'Grouped') : t('合并同系', 'Group family'))
                    : null,
                  filters.client !== 'all' ? h('button', { type: 'button', style: { ...button, padding: '2px 8px', fontSize: 11 }, onClick: () => change('client', 'all') }, t('显示全部', 'Show all')) : null)),
              agentDonut),
            h('section', { style: panel },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
                h('strong', null, t('模型比较', 'Model comparison')),
                h('div', { style: { display: 'flex', gap: 4 } },
                  ...[['tokens', t('用量', 'Tok')], ['cost', t('费用', 'Cost')], ['tps', t('吞吐', 'tok/s')]].map(([rk, rl]) =>
                    h('button', { key: rk, type: 'button', style: { ...button, padding: '2px 7px', fontSize: 11, ...(modelRankBy === rk ? activePill : {}) }, onClick: () => setModelRankBy(rk) }, rl)))),
              ranking(sortedModels, palette[1], { showCost: modelRankBy !== 'tps', metricKey: modelRankBy, onPick: name => change('model', name) }))),
          !daily.length && !heatmap.length && !hourly.length ? h('div', { style: { padding: '2px 4px' } }, trendBody) : null,
          deepRow,
          taskPanel);
      } else if (data) results = notice(t('当前筛选条件没有可用报告；请检查来源状态。', 'No report is available for this selection; check source status.'));
      else if (busy || activeProgress) results = notice(t('正在增量读取本机各 Agent 用量，快引擎（DSH 等）将在 1–4 秒内先行呈现…', 'Scanning local agents progressively (fast engines appear first within ~1–4s)…'), C.muted);
      else if (checkingCache) results = notice(t('正在查找已保存的报告…', 'Checking for a saved report…'), C.muted);
      else if (!error) results = notice(t('点击预设时间或刷新以加载用量。', 'Select a preset or refresh to query usage.'), C.muted);

      return h('main', {
        'data-tokscale-usage': true,
        style: { display: 'grid', gridAutoRows: 'max-content', alignContent: 'start', gap: 12, padding: '14px clamp(12px, 2vw, 24px)', height: '100%', overflowY: 'auto', boxSizing: 'border-box', color: C.text, background: 'color-mix(in srgb, #7893ba 5%, ' + C.bg + ')' },
      }, h('style', null, panelCss), commandBar, scopeEditorPanel, requestError, h('div', { className: 'tu-report', 'aria-busy': busy && !!data }, results), data || sourceProbe ? sourcesView : null);
    }

    function PanelIcon({ size = 20 }) {
      return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('path', { d: 'M4 20h16M6 16v-4M11 16V5M16 16V9M21 16V3' }));
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'tokscale-usage', order: 30, label: () => t('用量洞察', 'Usage insights') }, PanelIcon));
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: 'tokscale-usage' }, UsagePage));
      },
    };
  },
});
