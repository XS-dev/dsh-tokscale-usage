// Native DSH Usage & Telemetry Studio (tokscale + dsh-context v0.6.0).
window.__ModuleLoader__.load({
  id: 'dsh-tokscale-usage',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback } = React;
    const useMemo = React.useMemo || (fn => fn());
    const useRef = React.useRef || (init => {
      const [box] = useState(() => ({ current: init }));
      return box;
    });
    const memo = React.memo || (comp => comp);

    // --- Theme & Semantic Palettes -------------------------------------------
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

    const AGENT_FIXED_COLORS = {
      antigravity: '#6366f1',
      codex: '#10b981',
      dsh: '#0ea5e9',
      claude: '#d97706',
      gemini: '#8b5cf6',
      cursor: '#ec4899',
      opencode: '#14b8a6',
      trae: '#f97316',
      qwen: '#06b6d4',
      cline: '#84cc16',
      other: '#64748b',
    };
    const FALLBACK_SERIES = ['#3b82f6', '#14b8a6', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#f97316', '#84cc16'];
    const TOKEN_COLORS = {
      input: '#3b82f6',
      output: '#0d9488',
      reasoning: '#a855f7',
      cacheRead: '#22c55e',
      cacheWrite: '#94a3b8',
    };
    const HEAT_COLORS = [
      'var(--dsw-alias-bg-layer-2, rgba(120,147,186,.14))',
      'color-mix(in srgb, #3b82f6 26%, transparent)',
      'color-mix(in srgb, #3b82f6 48%, transparent)',
      'color-mix(in srgb, #3b82f6 74%, transparent)',
      '#3b82f6',
    ];

    function colorForAgent(name) {
      const key = String(name || '').toLowerCase();
      if (AGENT_FIXED_COLORS[key]) return AGENT_FIXED_COLORS[key];
      if (key.startsWith('antigravity')) return AGENT_FIXED_COLORS.antigravity;
      let hash = 0;
      for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
      return FALLBACK_SERIES[Math.abs(hash) % FALLBACK_SERIES.length];
    }

    // --- Localization & Formatting Helpers -----------------------------------
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
      const a = Math.abs(n);
      if (a >= 1000) return '$' + (n / 1000).toFixed(2) + 'K';
      if (a >= 100) return '$' + n.toFixed(1);
      if (a >= 1) return '$' + n.toFixed(2);
      if (a > 0) return '$' + n.toFixed(4);
      return '$0.00';
    };
    const unitPriceFmt = n => {
      if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return '—';
      return n >= 10 ? `$${n.toFixed(1)}/1M` : `$${n.toFixed(2)}/1M`;
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

    const RANGE_LABELS = {
      all: t('全部', 'All'),
      today: t('今天', 'Today'),
      yesterday: t('昨天', 'Yesterday'),
      days3: t('最近 3 天', 'Last 3 days'),
      week: t('最近 7 天', 'Last 7 days'),
      month: t('本月', 'This month'),
      custom: t('自定义', 'Custom'),
    };
    const RANGE_KEYS = ['today', 'yesterday', 'days3', 'week', 'month', 'all', 'custom'];
    const CORE_HARNESS_PRESET = ['dsh', 'codex', 'antigravity', 'claude', 'gemini'];
    const HARNESS_HINTS = {
      antigravity: t('IDE + CLI 合并统计', 'IDE + CLI unified'),
      codex: 'OpenAI Codex',
      dsh: t('DSH 原生', 'DSH native'),
      claude: 'Claude Code',
      gemini: 'Gemini CLI',
    };

    const tint = (color, pctMix = 13) => `color-mix(in srgb, ${color} ${pctMix}%, ${C.panel})`;
    const dot = color => h('span', {
      'aria-hidden': true,
      style: { display: 'inline-block', width: 8, height: 8, background: color, marginRight: 6, borderRadius: '50%', flexShrink: 0 },
    });
    const optionValue = x => (typeof x === 'string' ? x : String(x?.id ?? x?.value ?? x?.client ?? x?.model ?? x?.name ?? ''));
    const optionLabel = x => (typeof x === 'string' ? x : String(x?.label ?? x?.name ?? x?.model ?? x?.client ?? x?.id ?? x?.value ?? ''));
    const distinct = xs => [...new Map(xs.filter(x => optionValue(x) && optionValue(x) !== 'all').map(x => [optionValue(x), x])).values()];
    const canonHarness = name => {
      const s = String(name || '');
      return (s === 'antigravity-extension' || s === 'antigravity-cli') ? 'antigravity' : s;
    };
    const agentFamily = name => {
      const s = String(name || '');
      if (s === 'antigravity' || s.startsWith('antigravity-')) return 'antigravity';
      if (s.startsWith('devin-')) return 'devin';
      if (s.startsWith('micode')) return 'micode';
      return s;
    };
    const shortPath = p => {
      if (!p) return '';
      const parts = String(p).replace(/\\/g, '/').split('/').filter(Boolean);
      return parts.length <= 2 ? parts.join('/') : '…/' + parts.slice(-2).join('/');
    };
    const addKnown = (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? a + b : null);
    const querySignature = q => `${q?.client || 'all'}|${q?.model || 'all'}|${q?.range || 'today'}|${q?.since || ''}|${q?.until || ''}`;

    /** Compute human-friendly nice axis step & max for 4 grid intervals. */
    function niceAxis(maxVal, ticks = 4) {
      if (!Number.isFinite(maxVal) || maxVal <= 0) return { max: ticks, step: 1 };
      const rawStep = maxVal / ticks;
      const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
      const norm = rawStep / mag;
      const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
      const step = niceNorm * mag;
      return { max: step * ticks, step };
    }

    function medianOf(values) {
      if (!values.length) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    // --- Shared Styles & Scoped Stylesheet -----------------------------------
    const btnBase = {
      padding: '5px 10px',
      border: '1px solid ' + C.border,
      borderRadius: 8,
      background: C.panel,
      color: C.text,
      cursor: 'pointer',
      font: 'inherit',
      fontSize: 12,
      lineHeight: 1.35,
    };
    const btnActive = { background: C.brand, color: '#fff', borderColor: C.brand };
    const selectStyle = { ...btnBase, minWidth: 112, maxWidth: 'min(240px, 100%)', padding: '5px 9px' };
    const panelStyle = { background: C.panel, border: '1px solid ' + C.border, borderRadius: 12, padding: 14, minWidth: 0 };

    const STUDIO_CSS = `
      [data-tokscale-usage] .tu-kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
      [data-tokscale-usage] .tu-kpi { text-align: left; padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; min-height: 92px; }
      [data-tokscale-usage] .tu-kpi-hero { border-color: color-mix(in srgb, ${C.brand} 32%, ${C.border}); background: linear-gradient(160deg, color-mix(in srgb, ${C.brand} 5%, ${C.panel}) 0%, ${C.panel} 65%); }
      [data-tokscale-usage] .tu-summary { display: grid; grid-template-columns: minmax(0, 1.52fr) minmax(0, 1fr); gap: 12px; }
      [data-tokscale-usage] .tu-tri { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: start; }
      [data-tokscale-usage] .tu-deep { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 12px; align-items: start; }
      [data-tokscale-usage] .tu-report { display: grid; gap: 12px; transition: opacity 120ms ease-out; }
      [data-tokscale-usage] .tu-report[aria-busy='true'] { opacity: .64; }
      [data-tokscale-usage] .tu-tasks { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 10px; }
      [data-tokscale-usage] .tu-task-card { border: 1px solid ${C.border}; background: ${C.bg}; border-radius: 10px; padding: 10px 12px; display: grid; gap: 6px; min-width: 0; transition: border-color 140ms ease, opacity 140ms ease; }
      [data-tokscale-usage] .tu-task-card:hover { border-color: ${C.brand}; }
      [data-tokscale-usage] .tu-heat-wrap { display: flex; align-items: start; gap: 6px; }
      [data-tokscale-usage] .tu-heat-days { display: grid; grid-template-rows: repeat(7, 14px); gap: 3px; font-size: 10px; color: ${C.muted}; line-height: 14px; text-align: right; user-select: none; }
      [data-tokscale-usage] .tu-heat-grid { display: grid; grid-auto-flow: column; grid-template-rows: repeat(7, 14px); gap: 3px; overflow-x: auto; padding-bottom: 4px; flex: 1; }
      [data-tokscale-usage] .tu-heat-cell { width: 14px; height: 14px; border-radius: 3px; border: 1px solid transparent; padding: 0; cursor: pointer; transition: transform 120ms ease, border-color 120ms ease; }
      [data-tokscale-usage] .tu-heat-cell.selected, [data-tokscale-usage] .tu-heat-cell.linked { border-color: ${C.text}; transform: scale(1.15); }
      [data-tokscale-usage] .tu-ws-row { border: 1px solid ${C.border}; border-radius: 8px; padding: 8px 10px; background: ${C.bg}; cursor: pointer; display: grid; gap: 5px; transition: border-color 140ms ease; }
      [data-tokscale-usage] .tu-ws-row:hover { border-color: ${C.brand}; }
      [data-tokscale-usage] button { transition: background-color 140ms ease, border-color 140ms ease, opacity 140ms ease; }
      [data-tokscale-usage] button:enabled:hover { border-color: ${C.muted}; }
      [data-tokscale-usage] button:focus-visible, [data-tokscale-usage] select:focus-visible, [data-tokscale-usage] input:focus-visible { outline: 2px solid ${C.brand}; outline-offset: 2px; }
      @media (max-width: 1180px) {
        [data-tokscale-usage] .tu-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        [data-tokscale-usage] .tu-summary, [data-tokscale-usage] .tu-tri, [data-tokscale-usage] .tu-deep { grid-template-columns: 1fr; }
      }
      @media (max-width: 640px) { [data-tokscale-usage] .tu-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      @media (prefers-reduced-motion: reduce) { [data-tokscale-usage] .tu-report, [data-tokscale-usage] button, [data-tokscale-usage] .tu-heat-cell { transition: none; } }
    `;

    // --- Micro-Visual Helpers ------------------------------------------------
    function renderDeltaBadge(pctVal, deltaInfo, kind) {
      if (typeof pctVal !== 'number' || !Number.isFinite(pctVal)) return null;
      const prevWindow = deltaInfo?.prevSince && deltaInfo?.prevUntil
        ? `${deltaInfo.prevSince} ~ ${deltaInfo.prevUntil}`
        : t('上一等长周期', 'previous equal window');
      const prevDetail = kind === 'cost' && Number.isFinite(deltaInfo?.prevCost)
        ? ` (${shortCost(deltaInfo.prevCost)})`
        : kind === 'tokens' && Number.isFinite(deltaInfo?.prevTokens)
          ? ` (${compact(deltaInfo.prevTokens)})`
          : '';
      const tip = t(`对比 ${prevWindow}${prevDetail} 变化率`, `Change vs ${prevWindow}${prevDetail}`);
      if (Math.abs(pctVal) < 0.005) {
        return h('span', { title: tip, style: { fontSize: 10.5, padding: '1px 6px', borderRadius: 999, background: C.panel2, color: C.muted } }, '0.0%');
      }
      const up = pctVal > 0;
      const col = up ? C.warn : C.ok;
      const txt = (up ? '▲ +' : '▼ ') + Math.min(999, Math.abs(pctVal * 100)).toFixed(1) + '%';
      return h('span', {
        title: tip,
        style: { fontSize: 10.5, fontWeight: 600, padding: '1px 6px', borderRadius: 999, background: tint(col), color: col, whiteSpace: 'nowrap' },
      }, txt);
    }

    function renderSparkline(points, color) {
      if (!Array.isArray(points) || points.length < 2 || !points.some(v => v > 0)) return null;
      const maxV = Math.max(...points, 1e-6);
      const W = 120, H = 22;
      const coords = points.map((v, i) => {
        const x = (i / (points.length - 1)) * W;
        const y = H - 2 - (Math.max(0, v) / maxV) * (H - 4);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      const areaPath = `M0,${H} L${coords.join(' L')} L${W},${H} Z`;
      return h('svg', {
        width: '100%', height: H, viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': true,
        style: { display: 'block', marginTop: 5, opacity: 0.88 },
      },
      h('path', { d: areaPath, fill: color, fillOpacity: 0.14 }),
      h('polyline', { fill: 'none', stroke: color, strokeWidth: 1.6, vectorEffect: 'non-scaling-stroke', points: coords.join(' ') }));
    }

    // --- Sub-Components (Memoized) -------------------------------------------
    const KpiStrip = memo(function KpiStrip({ m, daily, periodDelta, monthlyProjection, execProfile, tm, tp, activeAgentsCount, activeModelsCount, workspacesCount, totalTasks, reportStatus }) {
      const decodeTps = tp?.decodeTokensPerSec;
      const engineTps = tp?.engineTokensPerSec;
      const avgTps = decodeTps ?? engineTps ?? tp?.avgTokensPerSec;
      const activeDaysCount = daily.filter(d => (d.totalTokens || 0) > 0).length;
      const peakDayItem = daily.reduce((pk, d) => (!pk || (d.totalTokens || 0) > (pk.totalTokens || 0) ? d : pk), null);

      const tokenSpark = renderSparkline(daily.slice(-14).map(d => d.totalTokens || 0), C.brand);
      const costSpark = renderSparkline(daily.slice(-14).map(d => d.cost || 0), '#10b981');

      const kpiTotal = [m.input, m.output, m.reasoning, m.cacheRead, m.cacheWrite].reduce((s, v) => s + (Number.isFinite(v) && v > 0 ? v : 0), 0);
      const totalMiniBar = !tokenSpark && kpiTotal > 0
        ? h('div', { 'aria-hidden': true, style: { display: 'flex', height: 4, borderRadius: 999, overflow: 'hidden', gap: 1, marginTop: 6, background: C.panel2 } },
            ...[
              [m.input, TOKEN_COLORS.input],
              [m.output, TOKEN_COLORS.output],
              [m.reasoning, TOKEN_COLORS.reasoning],
              [m.cacheRead, TOKEN_COLORS.cacheRead],
              [m.cacheWrite, TOKEN_COLORS.cacheWrite],
            ].map(([v, col], bi) => v > 0 ? h('div', { key: bi, style: { width: `${(v / kpiTotal) * 100}%`, background: col } }) : null))
        : tokenSpark;

      const hitRateRatio = typeof m.cacheHitRate === 'number' && Number.isFinite(m.cacheHitRate) ? Math.max(0, Math.min(1, m.cacheHitRate)) : null;
      const hitGauge = hitRateRatio != null
        ? h('svg', { width: 38, height: 38, viewBox: '0 0 36 36', 'aria-hidden': true, style: { flex: '0 0 38px' } },
            h('circle', { cx: 18, cy: 18, r: 14, fill: 'none', stroke: C.panel2, strokeWidth: 4 }),
            h('circle', {
              cx: 18, cy: 18, r: 14, fill: 'none', stroke: TOKEN_COLORS.cacheRead, strokeWidth: 4, strokeLinecap: 'round',
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

      const wallMs = Number(m.totalTokens) > 0 ? (execProfile?.timingBreakdown?.wallMs || tm?.total_active_time_ms || 0) : 0;
      const eomCost = monthlyProjection?.projectedCost > 0 ? monthlyProjection.projectedCost : null;
      const costSubParts = [];
      if (eomCost) costSubParts.push(t(`预计月底 ${shortCost(eomCost)}`, `EOM est. ${shortCost(eomCost)}`));
      else if (activeDaysCount > 1 && Number.isFinite(m.cost) && m.cost > 0) costSubParts.push(t(`日均 ${shortCost(m.cost / activeDaysCount)}`, `${shortCost(m.cost / activeDaysCount)}/d`));
      if (peakDayItem && peakDayItem.cost > 0) costSubParts.push(t(`峰值 ${peakDayItem.date.slice(5)}`, `Peak ${peakDayItem.date.slice(5)}`));
      const costSubtitle = costSubParts.join(' · ') || t('tokscale 估算 (非账单)', 'tokscale estimate');

      const cards = [
        {
          hero: true,
          name: t('总 Token', 'Total tokens'),
          val: compact(m.totalTokens),
          valTitle: num(m.totalTokens),
          sub: reportStatus || `${t('输入', 'In')} ${compact(m.input)} · ${t('推理', 'Reas')} ${compact(m.reasoning)}`,
          subRole: reportStatus ? 'status' : undefined,
          visual: totalMiniBar,
          badge: renderDeltaBadge(periodDelta?.tokenDeltaPct, periodDelta, 'tokens'),
        },
        {
          hero: true,
          name: t('估算费用', 'Est. cost'),
          val: Number.isFinite(m.cost) ? shortCost(m.cost) : '—',
          valTitle: Number.isFinite(m.cost) ? `${cost(m.cost)} — ${t('基于 tokscale 模型定价估算，非实际账单', 'tokscale model pricing estimate, not a bill')}` : undefined,
          sub: costSubtitle,
          visual: costSpark,
          badge: renderDeltaBadge(periodDelta?.costDeltaPct, periodDelta, 'cost'),
        },
        {
          name: t('缓存命中率', 'Cache hit rate'),
          val: pct(m.cacheHitRate),
          sub: `${t('复用读取', 'Cache read')} ${compact(m.cacheRead)}`,
          badge: hitGauge,
        },
        {
          name: t('消息 & 活跃规模', 'Messages & activity'),
          val: num(m.messages),
          sub: sessionSub,
        },
        {
          name: t('解码吞吐 & 首字时延', 'Throughput & TTFT'),
          val: Number.isFinite(avgTps) ? tpsFmt(avgTps) : '—',
          sub: [
            Number.isFinite(tp?.avgTtftMs) ? `TTFT ${(tp.avgTtftMs / 1000).toFixed(1)}s` : null,
            wallMs > 0 ? t(`活跃时长 ${durFmt(wallMs)}`, `Active ${durFmt(wallMs)}`) : null,
          ].filter(Boolean).join(' · ') || t('等待计时样本', 'Awaiting timing samples'),
        },
        {
          name: t('覆盖矩阵', 'Coverage'),
          val: `${activeAgentsCount} / ${activeModelsCount}`,
          sub: [
            workspacesCount ? t(`${workspacesCount} 项目`, `${workspacesCount} projects`) : null,
            Number.isFinite(totalTasks) && totalTasks > 0 ? t(`${totalTasks} 任务`, `${totalTasks} tasks`) : null,
          ].filter(Boolean).join(' · ') || t('活跃 Agent / 模型数', 'Active agents / models'),
        },
      ];

      return h('div', { className: 'tu-kpis' },
        ...cards.map(c => h('div', {
          key: c.name,
          className: 'tu-kpi' + (c.hero ? ' tu-kpi-hero' : ''),
          style: panelStyle,
        },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 } },
          h('div', { style: { minWidth: 0 } },
            h('div', { style: { color: C.muted, fontSize: 11.5 } }, c.name),
            h('div', {
              title: c.valTitle,
              style: { fontSize: c.hero ? 'clamp(18px, 1.9vw, 24px)' : 'clamp(16px, 1.7vw, 21px)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere', marginTop: 2 },
            }, c.val)),
          c.badge || null),
        c.visual || null,
        h('div', { role: c.subRole, style: { fontSize: 11, color: C.muted, marginTop: 4, overflowWrap: 'anywhere' } }, c.sub))));
    });

    const SmartEmptyCard = memo(function SmartEmptyCard({ heatmap, onPickRange, onPickDate }) {
      const lastActive = useMemo(() => {
        for (let i = heatmap.length - 1; i >= 0; i--) {
          if ((heatmap[i]?.tokens || 0) > 0) return heatmap[i];
        }
        return null;
      }, [heatmap]);

      return h('section', {
        style: { ...panelStyle, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, minHeight: 168 },
      },
      h('strong', { style: { fontSize: 14 } }, t('当前时间窗口暂无用量记录', 'No usage recorded in this time window')),
      h('div', { style: { fontSize: 12.5, color: C.muted, lineHeight: 1.5 } },
        lastActive
          ? t(`最近一次观测到活跃用量是在 ${lastActive.date}（${compact(lastActive.tokens)} tokens · ${shortCost(lastActive.cost)}）。你可以直接切换时间范围查看：`,
              `Most recent activity was on ${lastActive.date} (${compact(lastActive.tokens)} tokens · ${shortCost(lastActive.cost)}). Jump to an active window:`)
          : t('当前筛选条件下尚未捕获到会话消耗，可尝试放宽时间范围或刷新扫描。',
              'No token activity matched the current filter. Try widening the date window or refreshing.')),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
        lastActive
          ? h('button', { type: 'button', style: { ...btnBase, ...btnActive }, onClick: () => onPickDate(lastActive.date) },
              t(`查看 ${lastActive.date}`, `Inspect ${lastActive.date}`))
          : null,
        h('button', { type: 'button', style: btnBase, onClick: () => onPickRange('yesterday') }, RANGE_LABELS.yesterday),
        h('button', { type: 'button', style: btnBase, onClick: () => onPickRange('days3') }, RANGE_LABELS.days3),
        h('button', { type: 'button', style: btnBase, onClick: () => onPickRange('week') }, RANGE_LABELS.week),
        h('button', { type: 'button', style: btnBase, onClick: () => onPickRange('month') }, RANGE_LABELS.month)));
    });

    const SvgTrendWorkbench = memo(function SvgTrendWorkbench({
      daily, hourly, m, meta, agentOrder, clientColorMap, monthlyProjection,
      hoverDate, setHoverDate, hoverAgent, setHoverAgent, onPickDate,
    }) {
      const [mode, setMode] = useState('stacked'); // 'stacked' | 'cumulative' | 'cacheHit' | 'hourly'
      const [zoom, setZoom] = useState('recent60');
      const [hiddenAgents, setHiddenAgents] = useState(() => []);
      const [hoverIdx, setHoverIdx] = useState(null);

      const showHourly = mode === 'hourly' && hourly.length > 0;
      const canZoom = !showHourly && daily.length > 60;
      const baseDaily = canZoom && zoom === 'recent60' ? daily.slice(-60) : daily;
      const hiddenSet = useMemo(() => new Set(hiddenAgents), [hiddenAgents]);

      const toggleHiddenAgent = name => {
        setHiddenAgents(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
      };

      // Build series data with 7d moving average, cumulative spend, and daily cache hit rate
      const enrichedDaily = useMemo(() => {
        let cumCost = 0;
        let cumTokens = 0;
        return baseDaily.map((d, idx) => {
          const byClientRaw = d.byClient && typeof d.byClient === 'object' ? d.byClient : null;
          let visibleTok = d.totalTokens || 0;
          if (byClientRaw && hiddenSet.size > 0) {
            visibleTok = Object.entries(byClientRaw).reduce((s, [cn, cv]) => s + (hiddenSet.has(cn) ? 0 : (Number(cv) || 0)), 0);
          }
          cumCost += Number(d.cost) || 0;
          cumTokens += visibleTok;
          let maSum = 0, maCnt = 0;
          for (let k = Math.max(0, idx - 6); k <= idx; k++) {
            maSum += baseDaily[k].totalTokens || 0;
            maCnt++;
          }
          const promptSide = (d.input || 0) + (d.cacheRead || 0) + (d.cacheWrite || 0);
          const hitRate = promptSide > 0 ? (d.cacheRead || 0) / promptSide : 0;
          return {
            ...d,
            visibleTokens: visibleTok,
            ma7Tokens: maCnt > 0 ? maSum / maCnt : visibleTok,
            cumCost,
            cumTokens,
            hitRate,
          };
        });
      }, [baseDaily, hiddenSet]);

      const chartItems = showHourly ? hourly : enrichedDaily;
      const nPts = chartItems.length;

      let body;
      if (!nPts) {
        body = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px 12px', color: C.muted, fontSize: 12, marginTop: 10 } },
          h('span', null, t('此筛选条件下趋势数据不可用。', 'Trend data is unavailable for this selection.')),
          Number.isFinite(m?.reasoning) && m.reasoning > 0 && !meta?.derivedFromBase
            ? h('small', null, t('点击“刷新数据”即可基于 tokscale graph 生成含推理分项的完整日趋势。', 'Refresh to generate reasoning-inclusive daily trends via tokscale graph.'))
            : null);
      } else {
        const W = 680, H = 178, padL = 52, padR = 46, padT = 14, padB = 24;
        const plotW = W - padL - padR;
        const plotH = H - padT - padB;

        const hasProjection = !showHourly && mode === 'cumulative' && monthlyProjection?.projectedCost > 0 && monthlyProjection.daysInMonth > monthlyProjection.daysElapsed;
        const totalSlots = hasProjection ? Math.max(nPts + 1, monthlyProjection.daysInMonth) : nPts;
        const xAt = i => padL + ((i + 0.5) / totalSlots) * plotW;
        const barW = Math.min(30, Math.max(3.5, (plotW / totalSlots) * 0.66));

        const rawPrimaryMax = (() => {
          if (showHourly) return Math.max(...chartItems.map(d => d.totalTokens || 0), 1);
          if (mode === 'cumulative') {
            const lastCum = enrichedDaily[enrichedDaily.length - 1]?.cumCost || 0;
            return Math.max(lastCum, hasProjection ? monthlyProjection.projectedCost : 0, 0.01);
          }
          if (mode === 'cacheHit') return 1;
          return Math.max(...enrichedDaily.map(d => Math.max(d.visibleTokens || 0, d.ma7Tokens || 0)), 1);
        })();

        const yAxis = mode === 'cacheHit' ? { max: 1, step: 0.25 } : niceAxis(rawPrimaryMax, 4);
        const yAt = v => padT + plotH - Math.max(0, Math.min(1, v / (yAxis.max || 1))) * plotH;

        const maxDailyCost = !showHourly && mode === 'stacked' ? Math.max(...enrichedDaily.map(d => d.cost || 0), 0) : 0;
        const costAxis = maxDailyCost > 0 ? niceAxis(maxDailyCost, 4) : null;
        const yCostAt = v => padT + plotH - Math.max(0, Math.min(1, v / (costAxis?.max || 1))) * plotH;

        const activeItem = hoverIdx != null && chartItems[hoverIdx]
          ? chartItems[hoverIdx]
          : (hoverDate && !showHourly ? chartItems.find(d => d.date === hoverDate) : null);
        const activeIndex = activeItem ? chartItems.indexOf(activeItem) : -1;

        // Build polyline curves
        const costLinePts = !showHourly && mode === 'stacked' && costAxis && nPts >= 2
          ? enrichedDaily.map((d, i) => `${xAt(i).toFixed(1)},${yCostAt(d.cost || 0).toFixed(1)}`).join(' ')
          : '';
        const maLinePts = !showHourly && mode === 'stacked' && nPts >= 3
          ? enrichedDaily.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d.ma7Tokens || 0).toFixed(1)}`).join(' ')
          : '';
        const cumLinePts = !showHourly && mode === 'cumulative'
          ? enrichedDaily.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d.cumCost || 0).toFixed(1)}`).join(' ')
          : '';
        const cumAreaPath = !showHourly && mode === 'cumulative' && nPts >= 1
          ? `M${xAt(0).toFixed(1)},${(padT + plotH).toFixed(1)} L` +
            enrichedDaily.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d.cumCost || 0).toFixed(1)}`).join(' L') +
            ` L${xAt(nPts - 1).toFixed(1)},${(padT + plotH).toFixed(1)} Z`
          : '';
        const projPts = hasProjection && nPts >= 1
          ? `${xAt(nPts - 1).toFixed(1)},${yAt(enrichedDaily[nPts - 1].cumCost || 0).toFixed(1)} ${xAt(totalSlots - 1).toFixed(1)},${yAt(monthlyProjection.projectedCost).toFixed(1)}`
          : '';
        const hitLinePts = !showHourly && mode === 'cacheHit'
          ? enrichedDaily.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d.hitRate || 0).toFixed(1)}`).join(' ')
          : '';
        const hitAreaPath = !showHourly && mode === 'cacheHit' && nPts >= 1
          ? `M${xAt(0).toFixed(1)},${(padT + plotH).toFixed(1)} L` +
            enrichedDaily.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d.hitRate || 0).toFixed(1)}`).join(' L') +
            ` L${xAt(nPts - 1).toFixed(1)},${(padT + plotH).toFixed(1)} Z`
          : '';
        const hourlyCurvePts = showHourly && nPts >= 2
          ? chartItems.map((d, i) => `${xAt(i).toFixed(1)},${yAt(d.totalTokens || 0).toFixed(1)}`).join(' ')
          : '';

        // Floating tooltip (zero layout shift!)
        const tooltipFlipLeft = activeIndex >= 0 && activeIndex > totalSlots * 0.58;
        const floatingTooltip = activeItem
          ? h('div', {
              style: {
                position: 'absolute',
                top: 8,
                left: tooltipFlipLeft ? 'auto' : 58,
                right: tooltipFlipLeft ? 54 : 'auto',
                zIndex: 6,
                pointerEvents: 'none',
                background: C.bg,
                border: '1px solid ' + C.border,
                boxShadow: '0 4px 14px rgba(0,0,0,0.10)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 11.5,
                fontVariantNumeric: 'tabular-nums',
                display: 'grid',
                gap: 3,
                maxWidth: 260,
              },
            },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 10, fontWeight: 650 } },
              h('span', { style: { color: C.brand } }, activeItem.date || activeItem.hour),
              h('span', null, compact(activeItem.visibleTokens ?? activeItem.totalTokens) + ' tok')),
            h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '2px 8px', color: C.muted, fontSize: 11 } },
              Number.isFinite(activeItem.cost) && activeItem.cost > 0 ? h('span', { style: { color: '#d97706', fontWeight: 600 } }, cost(activeItem.cost)) : null,
              mode === 'cumulative' && Number.isFinite(activeItem.cumCost) ? h('span', null, `${t('累计', 'Cum')} ${shortCost(activeItem.cumCost)}`) : null,
              mode === 'cacheHit' && Number.isFinite(activeItem.hitRate) ? h('span', { style: { color: TOKEN_COLORS.cacheRead } }, `${t('命中', 'Hit')} ${pct(activeItem.hitRate)}`) : null,
              activeItem.messages ? h('span', null, `${num(activeItem.messages)} msgs`) : null),
            activeItem.byClient && !showHourly
              ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '2px 8px', fontSize: 10.5, borderTop: '1px solid ' + C.border, paddingTop: 3 } },
                  ...Object.entries(activeItem.byClient)
                    .filter(([cn]) => !hiddenSet.has(cn))
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4)
                    .map(([cn, cv]) => h('span', { key: cn }, dot(clientColorMap.get(cn) || colorForAgent(cn)), `${cn} ${compact(cv)}`)))
              : null)
          : null;

        // X-axis tick indices (up to 6 evenly spaced labels)
        const xTickIndices = (() => {
          if (nPts <= 7) return chartItems.map((_, i) => i);
          if (showHourly && nPts === 24) return [0, 4, 8, 12, 16, 20, 23];
          const step = Math.max(1, Math.floor((nPts - 1) / 5));
          const list = [];
          for (let i = 0; i < nPts; i += step) list.push(i);
          if (list[list.length - 1] !== nPts - 1) list.push(nPts - 1);
          return list;
        })();

        body = h('div', {
          style: { position: 'relative', marginTop: 8 },
          onMouseLeave: () => { setHoverIdx(null); setHoverDate(null); },
        },
        floatingTooltip,
        h('svg', {
          viewBox: `0 0 ${W} ${H}`,
          style: { width: '100%', height: 'auto', maxHeight: 205, display: 'block', overflow: 'visible' },
        },
        // Horizontal gridlines & left/right Y-axis labels
        ...[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const y = padT + (1 - frac) * plotH;
          const val = yAxis.max * frac;
          const leftLabel = mode === 'cumulative'
            ? shortCost(val)
            : mode === 'cacheHit'
              ? `${Math.round(val * 100)}%`
              : compact(val);
          const rightLabel = costAxis ? shortCost(costAxis.max * frac) : null;
          return h('g', { key: frac },
            h('line', { x1: padL, y1: y, x2: W - padR, y2: y, stroke: C.border, strokeDasharray: frac === 0 ? undefined : '2 3', strokeWidth: frac === 0 ? 1 : 0.8 }),
            h('text', { x: padL - 6, y: y + 3.5, textAnchor: 'end', fill: C.muted, fontSize: 10 }, leftLabel),
            rightLabel ? h('text', { x: W - padR + 6, y: y + 3.5, textAnchor: 'start', fill: '#d97706', fontSize: 9.5 }, rightLabel) : null);
        }),

        // Active hover crosshair
        activeIndex >= 0
          ? h('line', { x1: xAt(activeIndex), y1: padT, x2: xAt(activeIndex), y2: padT + plotH, stroke: C.brand, strokeDasharray: '3 3', strokeWidth: 1 })
          : null,

        // Mode 1: Stacked Agent bars or Hourly bars
        (mode === 'stacked' || showHourly)
          ? chartItems.map((d, i) => {
              const cx = xAt(i);
              const bx = cx - barW / 2;
              const lbl = String(d.date || d.hour || '');
              const rawTok = showHourly ? (d.totalTokens || 0) : (d.visibleTokens || 0);
              const titleText = `${lbl}: ${num(d.totalTokens)}` + (Number.isFinite(d.cost) && d.cost > 0 ? ` · ${cost(d.cost)}` : '');

              if (!showHourly && d.byClient && Object.keys(d.byClient).length > 0 && rawTok > 0) {
                let yBottom = padT + plotH;
                const orderedClients = [
                  ...agentOrder.filter(cn => d.byClient[cn] > 0 && !hiddenSet.has(cn)),
                  ...Object.keys(d.byClient).filter(cn => !agentOrder.includes(cn) && d.byClient[cn] > 0 && !hiddenSet.has(cn)),
                ];
                return h('g', {
                  key: lbl || i,
                  title: titleText,
                  style: { cursor: d.date ? 'pointer' : 'default' },
                  onMouseEnter: () => { setHoverIdx(i); if (d.date) setHoverDate(d.date); },
                  onClick: d.date ? () => onPickDate(d.date) : undefined,
                },
                h('title', null, titleText),
                // Invisible full-height hit rect for effortless hover on short bars
                h('rect', { x: cx - (plotW / totalSlots) / 2, y: padT, width: plotW / totalSlots, height: plotH, fill: 'transparent' }),
                ...orderedClients.map(cn => {
                  const segTok = d.byClient[cn] || 0;
                  const segH = Math.max(1.2, (segTok / (yAxis.max || 1)) * plotH);
                  yBottom -= segH;
                  const dimmed = hoverAgent && hoverAgent !== cn;
                  return h('rect', {
                    key: cn,
                    x: bx,
                    y: Math.max(padT, yBottom),
                    width: barW,
                    height: segH,
                    rx: 1.5,
                    fill: clientColorMap.get(cn) || colorForAgent(cn),
                    fillOpacity: dimmed ? 0.25 : 0.92,
                  });
                }));
              }

              const barH = rawTok > 0 ? Math.max(2, (rawTok / (yAxis.max || 1)) * plotH) : 0;
              return h('g', {
                key: lbl || i,
                title: titleText,
                style: { cursor: d.date ? 'pointer' : 'default' },
                onMouseEnter: () => { setHoverIdx(i); if (d.date) setHoverDate(d.date); },
                onClick: d.date ? () => onPickDate(d.date) : undefined,
              },
              h('title', null, titleText),
              h('rect', { x: cx - (plotW / totalSlots) / 2, y: padT, width: plotW / totalSlots, height: plotH, fill: 'transparent' }),
              barH > 0 ? h('rect', { x: bx, y: padT + plotH - barH, width: barW, height: barH, rx: 2, fill: showHourly ? '#0d9488' : C.brand, fillOpacity: 0.86 }) : null);
            })
          : null,

        // Mode 2: Cumulative Spend + EOM Projection
        mode === 'cumulative' && !showHourly
          ? h('g', null,
              cumAreaPath ? h('path', { d: cumAreaPath, fill: '#10b981', fillOpacity: 0.15 }) : null,
              nPts >= 2 ? h('polyline', { fill: 'none', stroke: '#10b981', strokeWidth: 2.2, points: cumLinePts }) : null,
              ...enrichedDaily.map((d, i) => h('g', {
                key: d.date,
                title: `${d.date}: ${num(d.totalTokens)} · ${cost(d.cumCost)}`,
                style: { cursor: 'pointer' },
                onMouseEnter: () => { setHoverIdx(i); setHoverDate(d.date); },
                onClick: () => onPickDate(d.date),
              },
              h('rect', { x: xAt(i) - (plotW / totalSlots) / 2, y: padT, width: plotW / totalSlots, height: plotH, fill: 'transparent' }),
              h('circle', { cx: xAt(i), cy: yAt(d.cumCost || 0), r: activeIndex === i ? 4.2 : 2.6, fill: '#10b981' }))),
              projPts
                ? h('g', null,
                    h('polyline', { fill: 'none', stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '5 4', points: projPts }),
                    h('circle', { cx: xAt(totalSlots - 1), cy: yAt(monthlyProjection.projectedCost), r: 4, fill: '#f59e0b' }),
                    h('text', { x: xAt(totalSlots - 1) - 4, y: Math.max(padT + 10, yAt(monthlyProjection.projectedCost) - 6), textAnchor: 'end', fill: '#d97706', fontSize: 10, fontWeight: 600 },
                      `${t('月底预测', 'EOM')} ${shortCost(monthlyProjection.projectedCost)}`))
                : null)
          : null,

        // Mode 3: Daily Cache Hit Rate Curve
        mode === 'cacheHit' && !showHourly
          ? h('g', null,
              hitAreaPath ? h('path', { d: hitAreaPath, fill: TOKEN_COLORS.cacheRead, fillOpacity: 0.14 }) : null,
              nPts >= 2 ? h('polyline', { fill: 'none', stroke: TOKEN_COLORS.cacheRead, strokeWidth: 2.2, points: hitLinePts }) : null,
              ...enrichedDaily.map((d, i) => h('g', {
                key: d.date,
                title: `${d.date}: ${pct(d.hitRate)}`,
                style: { cursor: 'pointer' },
                onMouseEnter: () => { setHoverIdx(i); setHoverDate(d.date); },
                onClick: () => onPickDate(d.date),
              },
              h('rect', { x: xAt(i) - (plotW / totalSlots) / 2, y: padT, width: plotW / totalSlots, height: plotH, fill: 'transparent' }),
              h('circle', { cx: xAt(i), cy: yAt(d.hitRate || 0), r: activeIndex === i ? 4.2 : 2.6, fill: TOKEN_COLORS.cacheRead }))))
          : null,

        // Overlay curves on Stacked / Hourly
        maLinePts ? h('polyline', { fill: 'none', stroke: C.muted, strokeWidth: 1.5, strokeDasharray: '4 3', points: maLinePts, pointerEvents: 'none' }) : null,
        costLinePts ? h('polyline', { fill: 'none', stroke: '#f59e0b', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', points: costLinePts, pointerEvents: 'none' }) : null,
        hourlyCurvePts ? h('polyline', { fill: 'none', stroke: '#06b6d4', strokeWidth: 1.8, points: hourlyCurvePts, pointerEvents: 'none' }) : null,

        // X-axis tick labels
        ...xTickIndices.map(idx => {
          const item = chartItems[idx];
          if (!item) return null;
          const raw = item.date ? item.date.slice(5) : item.hour;
          return h('text', {
            key: idx,
            x: xAt(idx),
            y: H - 5,
            textAnchor: idx === 0 ? 'start' : (idx === nPts - 1 && !hasProjection ? 'end' : 'middle'),
            fill: C.muted,
            fontSize: 10,
          }, raw);
        })),

        // Interactive Legend Bar (click Agent to hide/isolate; hover to cross-highlight)
        !showHourly && mode === 'stacked'
          ? h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6, fontSize: 11, color: C.muted } },
              h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' } },
                ...agentOrder.slice(0, 6).map(cn => {
                  const off = hiddenSet.has(cn);
                  const col = clientColorMap.get(cn) || colorForAgent(cn);
                  return h('button', {
                    key: cn,
                    type: 'button',
                    title: t('点击显隐该 Agent 序列', 'Click to toggle series visibility'),
                    onMouseEnter: () => setHoverAgent(cn),
                    onMouseLeave: () => setHoverAgent(null),
                    onClick: () => toggleHiddenAgent(cn),
                    style: {
                      ...btnBase,
                      padding: '1px 7px',
                      fontSize: 11,
                      borderRadius: 999,
                      opacity: off ? 0.42 : 1,
                      textDecoration: off ? 'line-through' : 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                    },
                  }, dot(col), cn);
                })),
              h('div', { style: { display: 'flex', gap: 10, alignItems: 'center' } },
                maLinePts ? h('span', null, '┄ ', t('7日均线', '7d MA')) : null,
                costLinePts ? h('span', { style: { color: '#d97706' } }, '━ ', t('日费用 (右轴)', 'Daily cost (R)')) : null))
          : null);
      }

      return h('section', { style: panelStyle },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            h('strong', null, showHourly ? t('24h 分时段活跃分布', '24h hourly distribution') : t('每日用量与费用趋势', 'Daily usage & spend trend')),
            showHourly
              ? h('span', { style: { fontSize: 11, color: C.muted, padding: '1px 7px', borderRadius: 999, border: '1px solid ' + C.border } },
                  t('当前区间 00:00–23:00 聚合', '00:00–23:00 window profile'))
              : meta?.trendScope === 'last60d'
                ? h('span', { style: { fontSize: 11, color: C.muted, padding: '1px 7px', borderRadius: 999, border: '1px solid ' + C.border } }, t('近 60 天明细', 'Last 60d'))
                : null,
            canZoom
              ? h('button', {
                  type: 'button',
                  onClick: () => setZoom(z => z === 'recent60' ? 'all' : 'recent60'),
                  style: { ...btnBase, padding: '2px 8px', fontSize: 11, borderRadius: 999, ...(zoom === 'all' ? btnActive : {}) },
                }, zoom === 'recent60' ? t(`展开全历史 (${daily.length}天)`, `All ${daily.length}d`) : t('聚焦近 60 天', 'Recent 60d'))
              : null),
          h('div', { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
            ...[
              ['stacked', t('Agent堆叠', 'Stacked')],
              ['cumulative', t('累计&预测', 'Cumulative')],
              ['cacheHit', t('缓存率%', 'Cache %')],
              ...(hourly.length ? [['hourly', t('24h时段', '24h')]] : []),
            ].map(([mk, ml]) => h('button', {
              key: mk,
              type: 'button',
              style: { ...btnBase, padding: '3px 8px', fontSize: 11, ...(mode === mk ? btnActive : {}) },
              onClick: () => setMode(mk),
            }, ml)))),
        body);
    });

    const ActivityHeatmap = memo(function ActivityHeatmap({ heatmap, weekdayProfile, selectedDay, hoverDate, setHoverDate, onToggleDay }) {
      const [localHover, setLocalHover] = useState(null);
      const wdLabels = [t('一', 'Mon'), t('二', 'Tue'), t('三', 'Wed'), t('四', 'Thu'), t('五', 'Fri'), t('六', 'Sat'), t('日', 'Sun')];
      const maxWdAvg = weekdayProfile.reduce((mx, w) => Math.max(mx, w.avgTokens || 0), 1);

      // Align cell 0 to its true day-of-week row (Mon=0..Sun=6) so rows match 一..日 labels!
      const leadEmpty = useMemo(() => {
        if (!heatmap.length || !heatmap[0]?.date) return 0;
        const d = new Date(heatmap[0].date + 'T00:00:00');
        return Number.isNaN(d.getTime()) ? 0 : (d.getDay() + 6) % 7;
      }, [heatmap]);

      const activeHover = localHover || (hoverDate ? heatmap.find(c => c.date === hoverDate) : null);

      return h('section', {
        style: { ...panelStyle, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
      },
      h('div', null,
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, minHeight: 20 } },
          h('div', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
            h('strong', null, t('8 周活动热力图', '8-week activity')),
            h('span', { style: { fontSize: 11, color: C.muted, marginLeft: 8, fontVariantNumeric: 'tabular-nums' } },
              activeHover
                ? `${activeHover.date} · ${compact(activeHover.tokens)} · ${shortCost(activeHover.cost)}`
                : t('点击格子按单日下钻', 'Click day to filter'))),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.muted, flexShrink: 0 } },
            t('少', 'Less'),
            ...HEAT_COLORS.map((bg, idx) => h('span', { key: idx, style: { width: 10, height: 10, borderRadius: 2, background: bg, display: 'inline-block' } })),
            t('多', 'More'))),
        heatmap.length
          ? h('div', {
              className: 'tu-heat-wrap',
              onMouseLeave: () => { setLocalHover(null); setHoverDate(null); },
            },
            h('div', { className: 'tu-heat-days', 'aria-hidden': true },
              ...[t('一', 'M'), '', t('三', 'W'), '', t('五', 'F'), '', t('日', 'S')].map((wd, wi) => h('span', { key: wi }, wd))),
            h('div', { className: 'tu-heat-grid' },
              ...Array.from({ length: leadEmpty }, (_, li) => h('span', {
                key: `pad-${li}`,
                'aria-hidden': true,
                style: { width: 14, height: 14, visibility: 'hidden' },
              })),
              ...heatmap.map(cellItem => {
                const isSel = selectedDay === cellItem.date;
                const isLinked = !isSel && hoverDate === cellItem.date;
                return h('button', {
                  key: cellItem.date,
                  type: 'button',
                  className: 'tu-heat-cell' + (isSel ? ' selected' : '') + (isLinked ? ' linked' : ''),
                  title: `${cellItem.date}: ${compact(cellItem.tokens)} (${num(cellItem.tokens)}) · ${cost(cellItem.cost)} · ${cellItem.messages} msgs`,
                  style: { background: HEAT_COLORS[Math.min(4, Math.max(0, cellItem.intensity || 0))] },
                  onMouseEnter: () => { setLocalHover(cellItem); setHoverDate(cellItem.date); },
                  onClick: () => onToggleDay(cellItem.date, isSel),
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
                const isPeak = w.avgTokens === maxWdAvg;
                return h('div', {
                  key: wi,
                  title: `${wdLabels[wi]}: avg ${compact(w.avgTokens)} (${w.activeDays} active d)`,
                  style: { display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 3 },
                },
                h('div', { style: { width: '100%', height: `${hPct}%`, background: isPeak ? C.brand : tint(C.brand, 22), border: '1px solid ' + (isPeak ? C.brand : C.border), borderRadius: 4 } }),
                h('span', { style: { fontSize: 10, color: C.muted, lineHeight: 1 } }, wdLabels[wi]));
              })))
        : null);
    });

    const TokenComposition = memo(function TokenComposition({ m, execProfile }) {
      const categories = [
        [t('输入', 'Input'), m.input, TOKEN_COLORS.input],
        [t('输出', 'Output'), m.output, TOKEN_COLORS.output],
        [t('推理', 'Reasoning'), m.reasoning, TOKEN_COLORS.reasoning],
        [t('缓存读取', 'Cache read'), m.cacheRead, TOKEN_COLORS.cacheRead],
        [t('缓存写入', 'Cache write'), m.cacheWrite, TOKEN_COLORS.cacheWrite],
      ];
      const valid = categories.every(([, v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0);
      const total = valid ? categories.reduce((s, [, v]) => s + v, 0) : 0;
      const ob = execProfile?.outputBreakdown;
      const obTotal = ob ? (ob.answerTokens || 0) + (ob.reasoningTokens || 0) + (ob.toolCallTokens || 0) : 0;

      let content = h('p', { style: { color: C.muted, fontSize: 12 } }, t('此筛选条件下分类构成不可用。', 'Token composition is unavailable for this selection.'));
      if (valid && total > 0) {
        content = h('div', { style: { display: 'grid', gap: 10, marginTop: 12 } },
          h('div', { 'aria-hidden': true, style: { display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: C.panel2, gap: 2 } },
            ...categories.map(([name, val, col]) => val > 0
              ? h('div', { key: name, title: `${name}: ${compact(val)} (${pct(val / total)})`, style: { width: `${Math.max(1.2, (val / total) * 100)}%`, background: col, borderRadius: 2 } })
              : null)),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 7, fontVariantNumeric: 'tabular-nums' } },
            ...categories.map(([name, val, col]) => {
              const shareStr = val > 0 && val / total < 0.001 ? '<0.1%' : pct(val / total);
              return h('div', {
                key: name,
                title: `${name}: ${num(val)}`,
                style: { borderLeft: '3px solid ' + col, background: C.bg, borderRadius: 6, padding: '6px 9px', display: 'grid', gap: 2, minWidth: 0 },
              },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: C.muted } },
                h('span', null, name),
                h('span', null, shareStr)),
              h('strong', { style: { fontSize: 13.5, fontWeight: 650 } }, compact(val)));
            })),
          obTotal > 0
            ? h('div', { style: { paddingTop: 8, borderTop: '1px solid ' + C.border, display: 'grid', gap: 5 } },
                h('div', { style: { fontSize: 11, color: C.muted, display: 'flex', justifyContent: 'space-between' } },
                  h('span', null, t('DSH 生成端细分', 'DSH generation split')),
                  h('span', null, compact(obTotal) + ' out')),
                h('div', { style: { display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', gap: 1, background: C.panel2 } },
                  ...[
                    [ob.answerTokens, TOKEN_COLORS.output],
                    [ob.reasoningTokens, TOKEN_COLORS.reasoning],
                    [ob.toolCallTokens, TOKEN_COLORS.input],
                  ].map(([v, c], oi) => v > 0 ? h('div', { key: oi, style: { width: `${(v / obTotal) * 100}%`, background: c } }) : null)),
                h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 10.5, color: C.muted } },
                  h('span', null, dot(TOKEN_COLORS.output), t('正文 ', 'Ans ') + compact(ob.answerTokens)),
                  h('span', null, dot(TOKEN_COLORS.reasoning), t('思考 ', 'Reas ') + compact(ob.reasoningTokens)),
                  h('span', null, dot(TOKEN_COLORS.input), t('工具调用 ', 'Calls ') + compact(ob.toolCallTokens))))
            : null);
      }

      return h('section', { style: panelStyle },
        h('strong', null, t('Token 构成', 'Token composition')),
        content);
    });

    const SvgAgentDonut = memo(function SvgAgentDonut({
      comparison, hasMultiFamily, groupFamily, setGroupFamily, clientFilter, catalogClients,
      clientColorMap, hoverAgent, setHoverAgent, onPickClient,
    }) {
      const agentTotal = comparison.reduce((s, it) => s + (Number.isFinite(it.tokens) && it.tokens > 0 ? it.tokens : 0), 0);
      const maxAgentTok = comparison.reduce((mx, it) => Math.max(mx, Number.isFinite(it.tokens) ? it.tokens : 0), 1);
      const R = 42;
      const CIRC = 2 * Math.PI * R;

      let body = h('p', { style: { color: C.muted, fontSize: 12 } }, t('没有可用的明细。', 'No breakdown is available.'));
      if (comparison.length) {
        let cumRatio = 0;
        const arcs = agentTotal > 0
          ? comparison.map(it => {
              const v = Number.isFinite(it.tokens) && it.tokens > 0 ? it.tokens : 0;
              const ratio = v / agentTotal;
              const start = cumRatio;
              cumRatio += ratio;
              return { item: it, ratio, start, col: clientColorMap.get(it.name) || colorForAgent(it.name) };
            }).filter(a => a.ratio > 0)
          : [];

        const focused = hoverAgent ? comparison.find(c => c.name === hoverAgent) : null;
        const centerPrimary = focused ? focused.name : `${comparison.length} Agent`;
        const centerSub = focused && agentTotal > 0 && Number.isFinite(focused.tokens)
          ? pct(focused.tokens / agentTotal)
          : (agentTotal > 0 && Number.isFinite(comparison[0]?.tokens) ? pct(comparison[0].tokens / agentTotal) : '');

        body = h('div', {
          style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 12 },
          onMouseLeave: () => setHoverAgent(null),
        },
        arcs.length
          ? h('div', { style: { position: 'relative', width: 112, height: 112, flex: '0 0 112px', display: 'grid', placeItems: 'center' } },
              h('svg', { width: 112, height: 112, viewBox: '0 0 112 112', 'aria-hidden': true },
                h('circle', { cx: 56, cy: 56, r: R, fill: 'none', stroke: C.panel2, strokeWidth: 16 }),
                ...arcs.map(a => {
                  const isHovered = hoverAgent === a.item.name;
                  const len = Math.max(0.5, a.ratio * CIRC - (arcs.length > 1 ? 1.5 : 0));
                  return h('circle', {
                    key: a.item.name,
                    cx: 56,
                    cy: 56,
                    r: R,
                    fill: 'none',
                    stroke: a.col,
                    strokeWidth: isHovered ? 19 : 16,
                    strokeDasharray: `${len.toFixed(2)} ${CIRC.toFixed(2)}`,
                    strokeDashoffset: `${(-a.start * CIRC).toFixed(2)}`,
                    transform: 'rotate(-90 56 56)',
                    style: { cursor: 'pointer', opacity: hoverAgent && !isHovered ? 0.38 : 1, transition: 'stroke-width 120ms ease, opacity 120ms ease' },
                    onMouseEnter: () => setHoverAgent(a.item.name),
                    onClick: () => onPickClient(a.item.name),
                  });
                })),
              h('div', { style: { position: 'absolute', inset: 22, display: 'grid', placeItems: 'center', alignContent: 'center', textAlign: 'center', pointerEvents: 'none', lineHeight: 1.2 } },
                h('strong', { style: { fontSize: 11.5, maxWidth: 66, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, centerPrimary),
                centerSub ? h('span', { style: { fontSize: 10, color: C.muted } }, centerSub) : null))
          : null,
        h('div', { style: { display: 'grid', gap: 5, flex: 1, minWidth: 185 } },
          ...comparison.map(item => {
            const color = clientColorMap.get(item.name) || colorForAgent(item.name);
            const share = agentTotal > 0 && Number.isFinite(item.tokens) ? item.tokens / agentTotal : null;
            const barW = Number.isFinite(item.tokens) && maxAgentTok > 0 ? Math.max(2, (item.tokens / maxAgentTok) * 100) : 0;
            const pickTarget = groupFamily && item.members?.size === 1 ? [...item.members][0] : item.name;
            const canPick = !groupFamily || item.members?.size === 1 || catalogClients.includes(item.name);
            const dimmed = hoverAgent && hoverAgent !== item.name;
            return h('div', {
              key: item.name,
              title: `${item.name}: ${num(item.tokens)} tokens · ${cost(item.cost)}` + (Number.isFinite(item.throughput) ? ` · ${tpsFmt(item.throughput)}` : ''),
              onMouseEnter: () => setHoverAgent(item.name),
              onClick: canPick ? () => onPickClient(pickTarget) : undefined,
              style: {
                display: 'grid',
                gap: 2,
                fontSize: 12,
                cursor: canPick ? 'pointer' : 'default',
                padding: '4px 7px',
                borderRadius: 6,
                opacity: dimmed ? 0.45 : 1,
                background: barW > 0 ? `linear-gradient(to right, ${tint(color, 16)} ${barW.toFixed(1)}%, transparent ${barW.toFixed(1)}%)` : undefined,
              },
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
      }

      return h('section', { style: panelStyle },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
          h('strong', null, t('Agent 用量对比', 'Agent usage comparison')),
          h('div', { style: { display: 'flex', gap: 4 } },
            hasMultiFamily
              ? h('button', {
                  type: 'button',
                  style: { ...btnBase, padding: '2px 8px', fontSize: 11, ...(groupFamily ? btnActive : {}) },
                  onClick: () => setGroupFamily(v => !v),
                }, groupFamily ? t('已合并同系', 'Grouped') : t('合并同系', 'Group family'))
              : null,
            clientFilter !== 'all'
              ? h('button', { type: 'button', style: { ...btnBase, padding: '2px 8px', fontSize: 11 }, onClick: () => onPickClient('all') }, t('显示全部', 'Show all'))
              : null)),
        body);
    });

    const ModelRanking = memo(function ModelRanking({ models, rankBy, setRankBy, onPickModel }) {
      const [expanded, setExpanded] = useState(false);
      const valOf = it => {
        if (rankBy === 'cost') return it.cost;
        if (rankBy === 'unit') return it.unitCost;
        if (rankBy === 'tps') return it.throughput;
        return it.tokens;
      };
      const sorted = useMemo(() => [...models].sort((a, b) => (valOf(b) ?? -1) - (valOf(a) ?? -1)), [models, rankBy]);
      const maximum = sorted.reduce((mx, it) => Math.max(mx, valOf(it) ?? 0), 1e-6);
      const visible = expanded ? sorted : sorted.slice(0, 6);

      return h('section', { style: panelStyle },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
          h('strong', null, t('模型比较', 'Model comparison')),
          h('div', { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
            ...[
              ['tokens', t('用量', 'Tok')],
              ['cost', t('费用', 'Cost')],
              ['unit', t('$/1M', '$/1M')],
              ['tps', t('吞吐', 'tok/s')],
            ].map(([rk, rl]) => h('button', {
              key: rk,
              type: 'button',
              style: { ...btnBase, padding: '2px 7px', fontSize: 11, ...(rankBy === rk ? btnActive : {}) },
              onClick: () => setRankBy(rk),
            }, rl)))),
        visible.length
          ? h('div', { style: { display: 'grid', gap: 8, marginTop: 12 } },
              ...visible.map((item, idx) => {
                const val = valOf(item);
                const rightPrimary = rankBy === 'cost'
                  ? shortCost(item.cost)
                  : rankBy === 'unit'
                    ? unitPriceFmt(item.unitCost)
                    : rankBy === 'tps'
                      ? tpsFmt(item.throughput)
                      : compact(item.tokens);
                const barColor = item.primaryClient ? colorForAgent(item.primaryClient) : '#10b981';
                return h('div', {
                  key: item.name,
                  title: `${item.name}: ${num(item.tokens)} tokens · ${cost(item.cost)} · ${unitPriceFmt(item.unitCost)}`,
                  onClick: () => onPickModel(item.name),
                  style: { cursor: 'pointer' },
                },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 } },
                  h('span', { style: { overflowWrap: 'anywhere', display: 'inline-flex', alignItems: 'center', gap: 4 } },
                    h('span', { style: { fontSize: 10, color: C.muted, fontVariantNumeric: 'tabular-nums' } }, `#${idx + 1}`),
                    item.name,
                    item.reasoningShare > 0.2
                      ? h('span', { style: { fontSize: 9.5, padding: '0 5px', borderRadius: 999, background: tint(TOKEN_COLORS.reasoning), color: TOKEN_COLORS.reasoning } },
                          t(`思 ${Math.round(item.reasoningShare * 100)}%`, `R ${Math.round(item.reasoningShare * 100)}%`))
                      : null),
                  h('span', { style: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } },
                    h('strong', null, rightPrimary),
                    rankBy !== 'cost' && Number.isFinite(item.cost) && item.cost > 0 ? h('small', { style: { color: C.muted, marginLeft: 6 } }, shortCost(item.cost)) : null,
                    rankBy !== 'unit' && Number.isFinite(item.unitCost) ? h('small', { style: { color: C.muted, marginLeft: 5 } }, unitPriceFmt(item.unitCost)) : null,
                    rankBy !== 'tps' && Number.isFinite(item.throughput) ? h('small', { style: { color: C.ok, marginLeft: 5 } }, item.throughput.toFixed(0) + 't/s') : null)),
                Number.isFinite(val) && val > 0
                  ? h('div', { style: { background: tint(barColor, 14), height: 6, borderRadius: 999, marginTop: 4, overflow: 'hidden' } },
                      h('div', { style: { width: Math.max(2, Math.min(100, (val / maximum) * 100)) + '%', background: barColor, height: '100%', borderRadius: 999 } }))
                  : null);
              }),
              sorted.length > 6
                ? h('button', { type: 'button', style: { ...btnBase, padding: '4px 9px', fontSize: 11.5, justifySelf: 'start' }, onClick: () => setExpanded(v => !v) },
                    expanded ? t('收起至前 6', 'Show top 6') : t(`展开全部 (${sorted.length})`, `Show all (${sorted.length})`))
                : null)
          : h('p', { style: { color: C.muted, fontSize: 12, marginTop: 12 } }, t('没有可用的明细。', 'No breakdown is available.')));
    });

    const QuadrantBubbleMap = memo(function QuadrantBubbleMap({ bubbleRows, clientColorMap, hoverAgent, onPickModel }) {
      const [yMetric, setYMetric] = useState('cost'); // 'cost' | 'unit' | 'tps'
      const [hoverRow, setHoverRow] = useState(null);
      if (bubbleRows.length < 2) return null;

      const hasTps = bubbleRows.filter(r => Number.isFinite(r.throughput) && r.throughput > 0).length >= 2;
      const effY = yMetric === 'tps' && !hasTps ? 'cost' : yMetric;

      const W = 640, H = 216, padL = 56, padR = 24, padT = 22, padB = 26;
      const plotW = W - padL - padR;
      const plotH = H - padT - padB;
      const logX = v => Math.log10(Math.max(100, v));

      const rawPowMin = Math.floor(Math.min(...bubbleRows.map(r => logX(r.tokens))));
      const rawPowMax = Math.max(rawPowMin + 1, Math.ceil(Math.max(...bubbleRows.map(r => logX(r.tokens)))));
      const xCoord = tok => padL + ((logX(tok) - rawPowMin) / (rawPowMax - rawPowMin)) * plotW;

      const yRawOf = r => {
        if (effY === 'unit') return Math.max(0, r.unitCost || 0);
        if (effY === 'tps') return Math.max(10, r.throughput || 10);
        return Math.max(0, r.cost || 0);
      };
      const yScale = v => effY === 'tps' ? Math.log10(Math.max(10, v)) : Math.sqrt(Math.max(0, v));
      const scaledYs = bubbleRows.map(r => yScale(yRawOf(r)));
      const minY = effY === 'tps' ? Math.min(...scaledYs) : 0;
      const maxY = Math.max(...scaledYs, minY + 0.5);
      const yCoord = r => padT + (1 - (yScale(yRawOf(r)) - minY) / (maxY - minY)) * plotH;

      // Sample-median crosshairs for true quadrant partitioning
      const medX = Math.max(padL + 36, Math.min(W - padR - 36, medianOf(bubbleRows.map(r => xCoord(r.tokens)))));
      const medY = Math.max(padT + 26, Math.min(H - padB - 26, medianOf(bubbleRows.map(r => yCoord(r)))));

      const maxMsgs = Math.max(1, ...bubbleRows.map(r => r.messages || 1));
      const placed = [];
      const xPowerTicks = [];
      for (let p = rawPowMin; p <= rawPowMax; p++) xPowerTicks.push(p);

      const qLabels = effY === 'tps'
        ? [t('低频高速', 'Low-vol fast'), t('高频高速', 'High-vol fast'), t('低频慢速', 'Low-vol slow'), t('高频主力', 'Workhorse')]
        : [t('低频重型', 'Low-vol pricey'), t('高消核心', 'Heavy flagship'), t('轻量试探', 'Light utility'), t('高频经济', 'High-vol lean')];

      return h('section', { style: panelStyle },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 } },
          h('div', { style: { minWidth: 0 } },
            h('strong', null, t('模型效能分布气泡图', 'Model efficiency map')),
            h('span', { style: { fontSize: 11, color: C.muted, marginLeft: 8, fontVariantNumeric: 'tabular-nums' } },
              hoverRow
                ? `${hoverRow.model} (${hoverRow.client}) · ${compact(hoverRow.tokens)} · ${shortCost(hoverRow.cost)} · ${unitPriceFmt(hoverRow.unitCost)}`
                : t('中位数四象限 · 气泡大小=消息数', 'Median quadrants · Size = messages'))),
          h('div', { style: { display: 'flex', gap: 4 } },
            ...[
              ['cost', t('总费用 $', 'Cost $')],
              ['unit', t('单价 $/1M', '$/1M')],
              ...(hasTps ? [['tps', t('吞吐 tok/s', 'tok/s')]] : []),
            ].map(([yk, yl]) => h('button', {
              key: yk,
              type: 'button',
              style: { ...btnBase, padding: '2px 7px', fontSize: 11, ...(effY === yk ? btnActive : {}) },
              onClick: () => setYMetric(yk),
            }, yl)))),
        h('svg', {
          viewBox: `0 0 ${W} ${H}`,
          onMouseLeave: () => setHoverRow(null),
          style: { width: '100%', height: 'auto', maxHeight: 228, display: 'block' },
        },
        // Median quadrant crosshairs & corner labels
        h('line', { x1: medX, y1: padT, x2: medX, y2: H - padB, stroke: C.brand, strokeOpacity: 0.35, strokeDasharray: '4 4', strokeWidth: 1 }),
        h('line', { x1: padL, y1: medY, x2: W - padR, y2: medY, stroke: C.brand, strokeOpacity: 0.35, strokeDasharray: '4 4', strokeWidth: 1 }),
        h('text', { x: padL + 5, y: padT + 11, fill: C.muted, fontSize: 9.5, opacity: 0.75 }, qLabels[0]),
        h('text', { x: W - padR - 5, y: padT + 11, textAnchor: 'end', fill: C.muted, fontSize: 9.5, opacity: 0.75 }, qLabels[1]),
        h('text', { x: padL + 5, y: H - padB - 5, fill: C.muted, fontSize: 9.5, opacity: 0.75 }, qLabels[2]),
        h('text', { x: W - padR - 5, y: H - padB - 5, textAnchor: 'end', fill: C.muted, fontSize: 9.5, opacity: 0.75 }, qLabels[3]),

        // Y-axis gridlines
        ...[0, 0.33, 0.66, 1].map((tFrac, gi) => {
          const y = padT + (1 - tFrac) * plotH;
          const valAt = effY === 'tps' ? Math.pow(10, minY + tFrac * (maxY - minY)) : Math.pow(tFrac * maxY, 2);
          const yLbl = effY === 'tps'
            ? (valAt >= 1000 ? (valAt / 1000).toFixed(1) + 'K' : Math.round(valAt)) + ' t/s'
            : effY === 'unit'
              ? `$${valAt >= 10 ? Math.round(valAt) : valAt.toFixed(1)}`
              : shortCost(valAt);
          return h('g', { key: gi },
            h('line', { x1: padL, y1: y, x2: W - padR, y2: y, stroke: C.border, strokeDasharray: '2 4', strokeWidth: 0.7 }),
            h('text', { x: padL - 6, y: y + 3.5, textAnchor: 'end', fill: C.muted, fontSize: 9.5 }, yLbl));
        }),

        // Power-of-10 X-axis ticks
        ...xPowerTicks.map(p => {
          const x = padL + ((p - rawPowMin) / (rawPowMax - rawPowMin)) * plotW;
          return h('g', { key: `xp-${p}` },
            h('line', { x1: x, y1: padT, x2: x, y2: H - padB, stroke: C.border, strokeDasharray: '2 5', strokeWidth: 0.6 }),
            h('text', { x, y: H - 6, textAnchor: 'middle', fill: C.muted, fontSize: 9.5 }, compact(Math.pow(10, p))));
        }),

        // Model bubbles
        ...bubbleRows.map((r, bi) => {
          const cx = xCoord(r.tokens);
          const cy = yCoord(r);
          const rad = 5.5 + Math.sqrt(Math.max(1, r.messages) / maxMsgs) * 15;
          const col = clientColorMap.get(r.client) || colorForAgent(r.client);
          const dimmed = hoverAgent && hoverAgent !== r.client;
          const isHov = hoverRow?.model === r.model;
          const shortName = r.model.length > 16 ? r.model.slice(0, 15) + '…' : r.model;
          const ly = Math.max(11, cy - rad - 4);
          const canLabel = bi < 8 && placed.every(p => Math.abs(p.x - cx) > 66 || Math.abs(p.y - ly) > 15);
          if (canLabel) placed.push({ x: cx, y: ly });
          return h('g', {
            key: r.model,
            style: { cursor: 'pointer', opacity: dimmed ? 0.28 : 1 },
            onMouseEnter: () => setHoverRow(r),
            onClick: () => onPickModel(r.model),
          },
          h('title', null, `${r.model} (${r.client})\nTokens: ${compact(r.tokens)} (${num(r.tokens)})\nCost: ${cost(r.cost)} (${unitPriceFmt(r.unitCost)})\nThroughput: ${tpsFmt(r.throughput)}\nMessages: ${num(r.messages)}`),
          h('circle', { cx, cy, r: rad, fill: col, fillOpacity: isHov ? 0.72 : 0.45, stroke: col, strokeWidth: isHov ? 2.5 : 1.6 }),
          canLabel ? h('text', { x: cx, y: ly, textAnchor: 'middle', fill: C.text, fontSize: 10, fontWeight: 500 }, shortName) : null);
        })));
    });

    const DeepWorkbench = memo(function DeepWorkbench({
      workspaces, matrixData, execProfile, workspaceFilter, setWorkspaceFilter,
      clientColorMap, onPickAgentModel,
    }) {
      const [tab, setTab] = useState('workspaces'); // 'workspaces' | 'matrix' | 'execution'
      const tbd = execProfile?.timingBreakdown;
      const topTools = execProfile?.topTools || [];
      const hasExec = Boolean(tbd && (tbd.ttftMs + tbd.reasoningMs + tbd.textMs + tbd.toolArgMs + tbd.toolsMs > 0 || topTools.length > 0));
      const hasMatrix = matrixData.agents.length >= 1 && matrixData.models.length >= 1;

      if (!workspaces.length && !hasExec && !hasMatrix) return null;

      const effTab = tab === 'execution' && hasExec
        ? 'execution'
        : tab === 'matrix' && hasMatrix
          ? 'matrix'
          : workspaces.length > 0
            ? 'workspaces'
            : hasMatrix
              ? 'matrix'
              : 'execution';

      // Tab 1: Ranked Workspace Horizontal Bars
      const workspaceView = (() => {
        if (!workspaces.length) {
          return h('p', { style: { color: C.muted, fontSize: 12, marginTop: 12 } }, t('当前筛选暂无项目目录归属记录。', 'No project workspace attribution in this window.'));
        }
        const wsTotal = workspaces.reduce((s, w) => s + (w.totalTokens || 0), 0) || 1;
        const wsMax = Math.max(...workspaces.map(w => w.totalTokens || 0), 1);
        return h('div', { style: { display: 'grid', gap: 7, marginTop: 10 } },
          ...workspaces.slice(0, 7).map(w => {
            const share = (w.totalTokens || 0) / wsTotal;
            const barPct = Math.max(3, ((w.totalTokens || 0) / wsMax) * 100);
            const primaryAgent = (w.clients || [])[0] || 'dsh';
            const col = clientColorMap.get(primaryAgent) || colorForAgent(primaryAgent);
            const isSel = workspaceFilter === w.workspaceKey;
            return h('div', {
              key: w.workspaceKey,
              className: 'tu-ws-row',
              title: `${w.workspaceKey}\nTokens: ${compact(w.totalTokens)} (${pct(share)})` + (w.cost > 0 ? `\nEst. cost: ${cost(w.cost)}` : ''),
              onClick: () => setWorkspaceFilter(prev => prev === w.workspaceKey ? '' : w.workspaceKey),
              style: { borderColor: isSel ? C.brand : undefined, background: isSel ? tint(C.brand, 9) : C.bg },
            },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 12 } },
              h('span', { style: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                dot(col), w.label),
              h('span', { style: { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } },
                h('strong', null, compact(w.totalTokens)),
                w.cost > 0 ? h('small', { style: { color: C.muted, marginLeft: 6 } }, shortCost(w.cost)) : null,
                h('small', { style: { color: C.muted, marginLeft: 6 } }, pct(share)),
                w.taskCount > 0 ? h('small', { style: { color: C.muted, marginLeft: 5 } }, `${w.taskCount}t`) : null)),
            h('div', { style: { height: 5, borderRadius: 999, background: C.panel2, overflow: 'hidden' } },
              h('div', { style: { width: `${barPct.toFixed(1)}%`, height: '100%', background: col, borderRadius: 999 } })));
          }));
      })();

      // Tab 2: Agent × Model Heat Matrix (CSS grid, zero raw <table>)
      const matrixView = (() => {
        const { agents, models, cells, maxCellTokens } = matrixData;
        const cols = `minmax(92px, 1.3fr) repeat(${agents.length}, minmax(68px, 1fr))`;
        return h('div', { style: { display: 'grid', gap: 5, marginTop: 10, overflowX: 'auto' } },
          h('div', { style: { display: 'grid', gridTemplateColumns: cols, gap: 5, fontSize: 11, color: C.muted, fontWeight: 600, paddingBottom: 3, borderBottom: '1px solid ' + C.border } },
            h('span', null, t('模型 \\ Agent', 'Model \\ Agent')),
            ...agents.map(ag => h('span', { key: ag, style: { textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
              dot(clientColorMap.get(ag) || colorForAgent(ag)), ag))),
          ...models.map(md => h('div', { key: md, style: { display: 'grid', gridTemplateColumns: cols, gap: 5, alignItems: 'center', fontSize: 11.5 } },
            h('span', { title: md, style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 } }, md),
            ...agents.map(ag => {
              const cell = cells.get(`${ag}\0${md}`);
              if (!cell || !(cell.tokens > 0)) {
                return h('div', { key: ag, style: { textAlign: 'right', color: C.muted, opacity: 0.35, padding: '4px 6px' } }, '·');
              }
              const intensity = Math.max(10, Math.min(42, Math.round((cell.tokens / (maxCellTokens || 1)) * 42)));
              const col = clientColorMap.get(ag) || colorForAgent(ag);
              return h('button', {
                key: ag,
                type: 'button',
                title: `${ag} × ${md}\nTokens: ${num(cell.tokens)}\nCost: ${cost(cell.cost)}\nUnit: ${unitPriceFmt(cell.unitCost)}`,
                onClick: () => onPickAgentModel(ag, md),
                style: {
                  ...btnBase,
                  padding: '4px 6px',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  background: `color-mix(in srgb, ${col} ${intensity}%, ${C.bg})`,
                  borderColor: `color-mix(in srgb, ${col} 35%, ${C.border})`,
                  display: 'grid',
                  gap: 1,
                },
              },
              h('strong', { style: { fontSize: 11 } }, compact(cell.tokens)),
              cell.cost > 0 ? h('small', { style: { fontSize: 9.5, color: C.muted } }, shortCost(cell.cost)) : null);
            }))));
      })();

      // Tab 3: Execution Timing Anatomy & Total-Duration Tool Ranking
      const executionView = (() => {
        if (!hasExec) {
          return h('p', { style: { color: C.muted, fontSize: 12, marginTop: 12 } }, t('当前筛选不含 DSH 细粒度阶段计时样本。', 'No DSH phase timing samples in this filter.'));
        }
        const phases = [
          [t('首字等待 TTFT', 'TTFT wait'), tbd.ttftMs, '#f59e0b'],
          [t('思考推理', 'Reasoning'), tbd.reasoningMs, TOKEN_COLORS.reasoning],
          [t('正文生成', 'Answer gen'), tbd.textMs, TOKEN_COLORS.output],
          [t('工具编排', 'Tool args'), tbd.toolArgMs, TOKEN_COLORS.input],
          [t('工具执行', 'Tool exec'), tbd.toolsMs, '#06b6d4'],
        ].filter(([, ms]) => ms > 0);
        const phaseSum = phases.reduce((s, [, ms]) => s + ms, 0) || 1;
        const rankedTools = [...topTools]
          .map(tl => ({ ...tl, totalMsCalc: Number(tl.totalMs) || ((Number(tl.calls) || 0) * (Number(tl.avgMs) || 0)) }))
          .sort((a, b) => (b.totalMsCalc || b.calls || 0) - (a.totalMsCalc || a.calls || 0));
        const maxToolMs = rankedTools.reduce((mx, tl) => Math.max(mx, tl.totalMsCalc || 1), 1);

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
          rankedTools.length
            ? h('div', { style: { display: 'grid', gap: 6, paddingTop: 6, borderTop: '1px solid ' + C.border } },
                ...rankedTools.slice(0, 6).map((tl, ti) => {
                  const col = FALLBACK_SERIES[ti % FALLBACK_SERIES.length];
                  return h('div', {
                    key: tl.name,
                    style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(60px, 1fr) auto', alignItems: 'center', gap: 8, fontSize: 11.5 },
                  },
                  h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: tl.name }, tl.name),
                  h('div', { style: { height: 6, borderRadius: 999, background: tint(col, 15), overflow: 'hidden' } },
                    h('div', { style: { width: `${Math.max(4, (tl.totalMsCalc / maxToolMs) * 100)}%`, height: '100%', background: col, borderRadius: 999 } })),
                  h('span', { style: { fontVariantNumeric: 'tabular-nums', color: C.muted, whiteSpace: 'nowrap', fontSize: 11 } },
                    `${durFmt(tl.totalMsCalc)} (${tl.calls}×)`));
                }))
            : null);
      })();

      const titleMap = {
        workspaces: t('项目工作区消耗排行', 'Workspace usage'),
        matrix: t('Agent × 模型交叉矩阵', 'Agent × model matrix'),
        execution: t('DSH 耗时解剖与工具耗时', 'Execution & tool telemetry'),
      };

      return h('section', { style: panelStyle },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
          h('strong', null, titleMap[effTab]),
          h('div', { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
            workspaces.length > 0
              ? h('button', { type: 'button', style: { ...btnBase, padding: '2px 8px', fontSize: 11, ...(effTab === 'workspaces' ? btnActive : {}) }, onClick: () => setTab('workspaces') }, t('项目排行', 'Workspaces'))
              : null,
            hasMatrix
              ? h('button', { type: 'button', style: { ...btnBase, padding: '2px 8px', fontSize: 11, ...(effTab === 'matrix' ? btnActive : {}) }, onClick: () => setTab('matrix') }, t('Agent×模型', 'Matrix'))
              : null,
            hasExec
              ? h('button', { type: 'button', style: { ...btnBase, padding: '2px 8px', fontSize: 11, ...(effTab === 'execution' ? btnActive : {}) }, onClick: () => setTab('execution') }, t('耗时&工具', 'Timing & tools'))
              : null)),
        effTab === 'workspaces' ? workspaceView : effTab === 'matrix' ? matrixView : executionView);
    });

    const TaskStream = memo(function TaskStream({ tasks, workspaceFilter, setWorkspaceFilter, clientColorMap, hoverAgent }) {
      const [taskQuery, setTaskQuery] = useState('');
      const [taskSort, setTaskSort] = useState('tokens');
      const [showAll, setShowAll] = useState(false);

      const filtered = useMemo(() => tasks
        .filter(tk => !workspaceFilter || tk.workspaceKey === workspaceFilter)
        .filter(tk => !taskQuery || [tk.title, tk.cwd, tk.model, tk.client].some(v => String(v || '').toLowerCase().includes(taskQuery.toLowerCase())))
        .sort((a, b) => {
          if (taskSort === 'recent') return (b.updatedAt || 0) - (a.updatedAt || 0);
          if (taskSort === 'tps') return (b.outputTps ?? -1) - (a.outputTps ?? -1);
          return (b.totalTokens || 0) - (a.totalTokens || 0);
        }), [tasks, workspaceFilter, taskQuery, taskSort]);

      const visible = showAll ? filtered.slice(0, 40) : filtered.slice(0, 6);
      const maxTok = filtered.reduce((mx, tk) => Math.max(mx, tk.totalTokens || 0), 1);

      return h('section', { style: panelStyle },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            h('strong', null, t('任务用量详情', 'Task usage')),
            h('span', { style: { fontSize: 12, color: C.muted } }, t(`共 ${filtered.length} 个关联会话任务`, `${filtered.length} matched tasks`)),
            workspaceFilter
              ? h('button', {
                  type: 'button',
                  onClick: () => setWorkspaceFilter(''),
                  style: { ...btnBase, padding: '2px 8px', fontSize: 11, borderRadius: 999, background: tint(C.brand), borderColor: C.brand },
                }, `${workspaceFilter.split('/').pop()} ×`)
              : null),
          h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' } },
            h('input', {
              type: 'search',
              value: taskQuery,
              placeholder: t('搜索任务名/项目/模型…', 'Filter tasks…'),
              onChange: e => setTaskQuery(e.target.value),
              style: { ...btnBase, padding: '4px 9px', minWidth: 150, fontSize: 12 },
            }),
            ...[
              ['tokens', t('按用量', 'By tokens')],
              ['recent', t('按最近', 'Recent')],
              ['tps', t('按吞吐', 'By speed')],
            ].map(([sk, sl]) => h('button', {
              key: sk,
              type: 'button',
              style: { ...btnBase, padding: '4px 8px', fontSize: 11, ...(taskSort === sk ? btnActive : {}) },
              onClick: () => setTaskSort(sk),
            }, sl)))),
        visible.length
          ? h('div', { className: 'tu-tasks' },
              ...visible.map(tk => {
                const tc = clientColorMap.get(tk.client) || colorForAgent(tk.client);
                const tPct = maxTok > 0 ? Math.max(3, Math.min(100, ((tk.totalTokens || 0) / maxTok) * 100)) : 0;
                const dimmed = hoverAgent && hoverAgent !== tk.client;
                return h('div', {
                  key: tk.client + ':' + tk.id,
                  className: 'tu-task-card',
                  style: dimmed ? { opacity: 0.42 } : undefined,
                },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 } },
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: 5 } },
                    h('span', { style: { fontSize: 10.5, fontWeight: 650, padding: '2px 7px', borderRadius: 999, background: tint(tc), color: tc } }, String(tk.client || '').toUpperCase()),
                    tk.isSubagent ? h('span', { style: { fontSize: 10, padding: '1px 6px', borderRadius: 999, background: tint(TOKEN_COLORS.reasoning), color: TOKEN_COLORS.reasoning } }, 'SUB') : null,
                    tk.contextRatio != null ? h('span', { title: t('峰值上下文窗口占用率', 'Context window load'), style: { fontSize: 10, color: tk.contextRatio > 0.8 ? C.warn : C.muted } }, `CTX ${Math.round(tk.contextRatio * 100)}%`) : null),
                  h('span', { style: { fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, tk.model)),
                h('div', { style: { fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: tk.title }, tk.title),
                tk.cwd
                  ? h('div', {
                      style: { fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: tk.workspaceKey ? 'pointer' : 'default' },
                      title: tk.cwd,
                      onClick: tk.workspaceKey ? () => setWorkspaceFilter(tk.workspaceKey) : undefined,
                    }, shortPath(tk.cwd))
                  : null,
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
        filtered.length > 6
          ? h('button', { type: 'button', style: { ...btnBase, marginTop: 10 }, onClick: () => setShowAll(v => !v) },
              showAll ? t('收起任务列表', 'Show top 6 tasks') : t(`展开更多 (${Math.min(40, filtered.length)})`, `Show more (${Math.min(40, filtered.length)})`))
          : null);
    });

    const SourcesDiagnostics = memo(function SourcesDiagnostics({
      sources, errors, sourceProbe, scopeState, showScopeEditor, onOpenScope, onProbeDirs, onPickClient,
    }) {
      const [expanded, setExpanded] = useState(false);
      const observedCount = sources.filter(s => s?.observed && !s?.error).length;
      const errorCount = sources.filter(s => Boolean(s?.error)).length;
      const idleCount = Math.max(0, sources.length - observedCount - errorCount);
      const showDetails = expanded || errorCount > 0 || errors.length > 0 || Boolean(sourceProbe);

      return h('section', { style: { ...panelStyle, padding: '10px 14px' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            h('strong', { style: { fontSize: 13 } }, t('引擎覆盖状态图', 'Engine coverage map')),
            sources.length
              ? h('span', { style: { fontSize: 11.5, color: C.muted } }, t(`${observedCount} / ${sources.length} 活跃`, `${observedCount} / ${sources.length} active`))
              : null,
            scopeState?.mode === 'custom'
              ? h('span', { style: { fontSize: 11, padding: '1px 7px', borderRadius: 999, background: tint(C.brand), color: C.brand } }, t('仅显示自选常用范围', 'Custom scope'))
              : null,
            sources.length
              ? h('div', { 'aria-hidden': true, style: { display: 'inline-flex', width: 84, height: 5, borderRadius: 999, overflow: 'hidden', background: C.panel2, gap: 1 } },
                  observedCount > 0 ? h('div', { style: { width: `${(observedCount / sources.length) * 100}%`, background: C.ok } }) : null,
                  errorCount > 0 ? h('div', { style: { width: `${(errorCount / sources.length) * 100}%`, background: C.error } }) : null,
                  idleCount > 0 ? h('div', { style: { width: `${(idleCount / sources.length) * 100}%`, background: C.border } }) : null)
              : null),
          h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
            sources.length > 0
              ? h('button', { type: 'button', style: { ...btnBase, padding: '3px 9px', fontSize: 11 }, onClick: () => setExpanded(v => !v) },
                  showDetails ? t('收起详情', 'Hide details') : t('展开引擎列表', 'Show engines'))
              : null,
            h('button', { type: 'button', style: { ...btnBase, padding: '3px 9px', fontSize: 11 }, onClick: onProbeDirs }, t('探测本地目录', 'Check local dirs')),
            h('button', { type: 'button', style: { ...btnBase, padding: '3px 9px', fontSize: 11, ...(showScopeEditor ? btnActive : {}) }, onClick: onOpenScope }, t('⚙ 选择常用 Harness', '⚙ Configure harnesses')))),
        showDetails && sources.length
          ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 } },
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
                  onClick: () => onPickClient(optionValue(s) || 'all'),
                  style: {
                    ...btnBase,
                    padding: '3px 9px',
                    fontSize: 11.5,
                    borderRadius: 999,
                    background: isOk ? tint(C.ok) : C.bg,
                    borderColor: isErr ? C.error : isOk ? tint(C.ok) : C.border,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  },
                },
                h('span', { 'aria-hidden': true, style: { width: 7, height: 7, borderRadius: '50%', background: sc, display: 'inline-block' } }),
                name);
              }))
          : null,
        errors.length
          ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 } },
              ...errors.map(([key, value]) => h('span', { key, style: { fontSize: 11, color: C.error, padding: '2px 8px', borderRadius: 6, background: tint(C.error) } }, `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)))
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
    });

    // --- Main Studio Page ----------------------------------------------------
    const initialFilters = { client: 'all', model: 'all', range: 'today', since: '', until: '' };

    function UsagePage() {
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

      const [groupFamily, setGroupFamily] = useState(false);
      const [modelRankBy, setModelRankBy] = useState('tokens');
      const [workspaceFilter, setWorkspaceFilter] = useState('');
      const [hoverDate, setHoverDate] = useState(null);
      const [hoverAgent, setHoverAgent] = useState(null);
      const [progress, setProgress] = useState(null);

      // Harness scope configurator state
      const [showScopeEditor, setShowScopeEditor] = useState(false);
      const [scopeState, setScopeState] = useState(null);
      const [allEngineCatalog, setAllEngineCatalog] = useState([]);
      const [draftScopeMode, setDraftScopeMode] = useState('custom');
      const [draftScopeClients, setDraftScopeClients] = useState([]);
      const [scopeQuery, setScopeQuery] = useState('');
      const [showExtraEngines, setShowExtraEngines] = useState(false);
      const [savingScope, setSavingScope] = useState(false);

      const prevRangeRef = useRef({ range: 'today', since: '', until: '' });

      const stopQuery = (stopPoll = false) => {
        const token = sequence.token;
        sequence.token = null;
        sequence.controller?.abort();
        sequence.controller = null;
        if (stopPoll && sequence.pollTimer) {
          clearInterval(sequence.pollTimer);
          sequence.pollTimer = null;
        }
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
          params.set('rich', '1');
          const route = cacheOnly ? 'cached-report' : 'report';
          const response = await fetch('/tokscale-usage/' + route + '?' + params.toString(), { cache: 'no-store', signal: controller.signal });
          if (cacheOnly && (response.status === 204 || response.status === 404)) return null;
          if (!response.ok) {
            let message = 'HTTP ' + response.status;
            try { const body = await response.json(); message = body.error?.message || body.error || body.message || message; } catch { /* ignore */ }
            throw new Error(String(message));
          }
          const result = await response.json();
          if (id === sequence.current) {
            setApplied(query);
            setData(result);
            setHoverDate(null);
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
          sequence.pollInFlight = false;
          sequence.pollTimer = setInterval(async () => {
            if (sequence.pollInFlight) return;
            sequence.pollInFlight = true;
            try {
              const sr = await fetch('/tokscale-usage/status', { cache: 'no-store' });
              if (!sr.ok) return;
              const st = await sr.json();
              setProgress(st);
              if (st.revision !== lastRev || !st.active) {
                lastRev = st.revision;
                const activeQuery = sequence.latestFilters || target;
                const reqSig = querySignature(activeQuery);
                if (!sequence.controller) {
                  const cp = new URLSearchParams({ client: activeQuery.client, model: activeQuery.model, range: activeQuery.range, rich: '1' });
                  if (activeQuery.range === 'custom') { cp.set('since', activeQuery.since); cp.set('until', activeQuery.until); }
                  const cr = await fetch('/tokscale-usage/cached-report?' + cp.toString(), { cache: 'no-store' });
                  if (cr.ok && cr.status === 200) {
                    const fresh = await cr.json();
                    if (!sequence.controller && querySignature(sequence.latestFilters || target) === reqSig) {
                      setApplied(activeQuery);
                      setData(fresh);
                      mergeCatalogFromResult(fresh);
                    }
                  }
                }
              }
              if (!st.active) {
                clearInterval(sequence.pollTimer);
                sequence.pollTimer = null;
              }
            } catch { /* ignore transient poll failure */ }
            finally { sequence.pollInFlight = false; }
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

      const loadSources = useCallback(async (force = false) => {
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
      }, [sequence]);

      const applyImmediate = useCallback(next => {
        sequence.latestFilters = next;
        setFilters(next);
        void load(next, false, false);
      }, [load, sequence]);

      const drillToDay = useCallback(dateStr => {
        const isAlreadySingleDay = filters.range === 'custom' && filters.since && filters.since === filters.until;
        if (!isAlreadySingleDay) {
          prevRangeRef.current = { range: filters.range, since: filters.since, until: filters.until };
        }
        applyImmediate({ ...filters, range: 'custom', since: dateStr, until: dateStr });
      }, [filters, applyImmediate, prevRangeRef]);

      const exitSingleDay = useCallback(() => {
        const prev = prevRangeRef.current || { range: 'today', since: '', until: '' };
        const restored = prev.range === 'custom' && (!prev.since || !prev.until)
          ? { ...filters, range: 'today', since: '', until: '' }
          : { ...filters, range: prev.range, since: prev.since || '', until: prev.until || '' };
        applyImmediate(restored);
      }, [filters, applyImmediate, prevRangeRef]);

      const change = useCallback((key, value) => {
        const next = key === 'range' && value !== 'custom'
          ? { ...filters, range: value, since: '', until: '' }
          : { ...filters, [key]: value };
        if (key === 'range' && value !== 'custom') {
          prevRangeRef.current = { range: value, since: '', until: '' };
        }
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
      }, [filters, data, load, sequence, prevRangeRef]);

      const submitFilters = (refresh = false) => {
        if (filters.range === 'custom' && (!filters.since || !filters.until || filters.since > filters.until)) {
          setValidation(t('请选择有效的起止日期，开始日期不能晚于结束日期。', 'Choose a valid start and end date in order.'));
          return;
        }
        sequence.latestFilters = filters;
        void load(filters, refresh, false);
      };

      const openScopeEditor = useCallback(() => {
        if (showScopeEditor) { setShowScopeEditor(false); return; }
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
      }, [showScopeEditor, scopeState, loadSources]);

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

      // --- Unified Single-Pass ViewModel -----------------------------------
      const meta = data?.meta || {};
      const sources = Array.isArray(data?.sources) ? data.sources : [];
      const entries = Array.isArray(data?.metrics?.entries) ? data.metrics.entries : [];
      const activeProgress = progress?.active ? progress : (meta.progress?.active ? meta.progress : null);

      const vm = useMemo(() => {
        const aggregateBy = groupFn => {
          const map = new Map();
          const clientByModel = new Map();
          for (const entry of entries) {
            const name = groupFn(entry) || t('未知', 'Unknown');
            const item = map.get(name) || {
              name, tokens: 0, cost: 0, outputPlusReas: 0, reasoning: 0,
              speedTokens: 0, speedMs: 0, tpSum: 0, tpCount: 0, throughput: null, unitCost: null,
              members: new Set(), primaryClient: '',
            };
            const cName = entry.client || entry.agent || '';
            if (cName) item.members.add(cName);
            const rowTok = ['input', 'output', 'reasoning', 'cacheRead', 'cacheWrite'].reduce((s, k) => addKnown(s, entry[k]), 0);
            item.tokens = addKnown(item.tokens, rowTok);
            item.cost = addKnown(item.cost, entry.cost);
            item.reasoning += Number(entry.reasoning) || 0;
            item.outputPlusReas += (Number(entry.output) || 0) + (Number(entry.reasoning) || 0);
            if (cName && Number.isFinite(rowTok)) {
              const prevBest = clientByModel.get(name);
              if (!prevBest || rowTok > prevBest.tok) {
                clientByModel.set(name, { client: cName, tok: rowTok });
                item.primaryClient = cName;
              }
            }
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
            item.unitCost = Number.isFinite(item.tokens) && item.tokens > 0 && Number.isFinite(item.cost) && item.cost > 0
              ? (item.cost / item.tokens) * 1e6
              : null;
            item.reasoningShare = item.outputPlusReas > 0 ? item.reasoning / item.outputPlusReas : 0;
            map.set(name, item);
          }
          return [...map.values()].sort((a, b) => (b.tokens ?? -1) - (a.tokens ?? -1));
        };

        const rawAgents = aggregateBy(e => e.client || e.agent);
        const familyAgents = aggregateBy(e => agentFamily(e.client || e.agent));
        const clientColorMap = new Map(rawAgents.map((c, idx) => [c.name, idx >= 7 ? AGENT_FIXED_COLORS.other : colorForAgent(c.name)]));
        const agentOrder = rawAgents.map(c => c.name);
        const models = aggregateBy(e => e.model);

        // Bubble rows
        const bubbleRows = models
          .filter(mRow => Number.isFinite(mRow.tokens) && mRow.tokens > 0)
          .slice(0, 16)
          .map(mRow => ({
            model: mRow.name,
            client: mRow.primaryClient || '',
            tokens: mRow.tokens,
            cost: mRow.cost || 0,
            unitCost: mRow.unitCost,
            messages: entries.filter(e => e.model === mRow.name).reduce((s, e) => s + (Number(e.messageCount ?? e.messages) || 0), 0),
            throughput: mRow.throughput,
          }));

        // Agent × Model Matrix (top 5 agents × top 6 models)
        const topAgents = rawAgents.slice(0, 5).map(a => a.name);
        const topModels = models.slice(0, 6).map(mItem => mItem.name);
        const matrixCells = new Map();
        let maxCellTokens = 0;
        for (const e of entries) {
          const ag = e.client || e.agent;
          const md = e.model;
          if (!ag || !md || !topAgents.includes(ag) || !topModels.includes(md)) continue;
          const key = `${ag}\0${md}`;
          const cur = matrixCells.get(key) || { tokens: 0, cost: 0, unitCost: null };
          const tk = ['input', 'output', 'reasoning', 'cacheRead', 'cacheWrite'].reduce((s, k) => s + (Number(e[k]) || 0), 0);
          cur.tokens += tk;
          cur.cost += Number(e.cost) || 0;
          cur.unitCost = cur.tokens > 0 && cur.cost > 0 ? (cur.cost / cur.tokens) * 1e6 : null;
          if (cur.tokens > maxCellTokens) maxCellTokens = cur.tokens;
          matrixCells.set(key, cur);
        }

        return {
          rawAgents,
          familyAgents,
          hasMultiFamily: rawAgents.length > familyAgents.length,
          clientColorMap,
          agentOrder,
          models,
          bubbleRows,
          matrixData: { agents: topAgents, models: topModels, cells: matrixCells, maxCellTokens },
        };
      }, [entries]);

      // --- Command Bar & Active Filter Chips --------------------------------
      const observedClientNames = new Set(sources.filter(s => s?.observed).map(optionValue));
      const sortedClients = [...catalog.clients].sort((a, b) => {
        const ao = observedClientNames.has(optionValue(a)) ? 0 : 1;
        const bo = observedClientNames.has(optionValue(b)) ? 0 : 1;
        return ao - bo || optionLabel(a).localeCompare(optionLabel(b));
      });

      const dropdown = (value, key, items, prefix) => h('select', {
        value,
        'aria-label': prefix,
        onFocus: key === 'client' ? () => loadSources(false) : undefined,
        onChange: e => change(key, e.target.value),
        style: selectStyle,
      },
      h('option', { value: 'all' }, `${prefix}: ${RANGE_LABELS.all}`),
      ...items.map(x => h('option', { key: optionValue(x), value: optionValue(x) },
        optionLabel(x) + (key === 'client' && observedClientNames.has(optionValue(x)) ? ' ★' : ''))));

      const statusBadge = activeProgress
        ? h('span', {
            role: 'status',
            style: { fontSize: 11.5, padding: '3px 10px', borderRadius: 999, background: tint(C.brand), color: C.brand, display: 'inline-flex', alignItems: 'center', gap: 6 },
          },
          h('span', { style: { width: 7, height: 7, borderRadius: '50%', background: C.brand } }),
          t(`增量同步 ${activeProgress.completed}/${activeProgress.total}`, `Syncing ${activeProgress.completed}/${activeProgress.total}`) +
          (activeProgress.currentClients?.length ? ` · ${activeProgress.currentClients.join(', ')}` : ''))
        : meta.updatedAt
          ? h('span', { style: { fontSize: 11.5, color: meta.stale ? C.warn : C.muted } },
              (meta.stale ? t('上次快照 · ', 'Snapshot · ') : t('已同步 · ', 'Synced · ')) + time(meta.updatedAt))
          : null;

      const isSingleDay = filters.range === 'custom' && Boolean(filters.since) && filters.since === filters.until;
      const prevLabel = RANGE_LABELS[prevRangeRef.current?.range] || RANGE_LABELS.today;
      const filterChips = [
        filters.client !== 'all' ? ['client', `Agent: ${filters.client}`, () => change('client', 'all')] : null,
        filters.model !== 'all' ? ['model', `${t('模型', 'Model')}: ${filters.model}`, () => change('model', 'all')] : null,
        isSingleDay ? ['day', `${t('单日', 'Day')}: ${filters.since} (${t('返回', 'Back to')} ${prevLabel})`, exitSingleDay] : null,
        workspaceFilter ? ['ws', `${t('项目(任务)', 'Project(tasks)')}: ${workspaceFilter.split('/').pop()}`, () => setWorkspaceFilter('')] : null,
      ].filter(Boolean);

      const commandBar = h('form', {
        onSubmit: e => { e.preventDefault(); submitFilters(false); },
        style: { ...panelStyle, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
      },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
        h('h1', { style: { fontSize: 18.5, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' } }, t('用量洞察', 'Usage insights')),
        statusBadge,
        ...filterChips.map(([ck, cText, onClear]) => h('button', {
          key: ck, type: 'button', onClick: onClear,
          style: { ...btnBase, padding: '2px 8px', fontSize: 11, borderRadius: 999, background: tint(C.brand), borderColor: C.brand, color: C.text },
        }, cText + ' ×'))),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7 } },
        dropdown(filters.client, 'client', sortedClients, 'Agent'),
        h('button', {
          type: 'button',
          title: t('设置默认纳入统计与下拉列表的常用 Harness 范围', 'Configure which harnesses are included in usage queries & dropdowns'),
          onClick: openScopeEditor,
          style: {
            ...btnBase,
            padding: '5px 9px',
            ...(showScopeEditor ? btnActive : scopeState?.mode === 'custom' ? { borderColor: C.brand, background: tint(C.brand) } : {}),
          },
        }, scopeState?.mode === 'custom'
          ? t(`⚙ 常用 (${scopeState.enabledClients.length})`, `⚙ Scope (${scopeState.enabledClients.length})`)
          : t('⚙ 常用范围', '⚙ Harnesses')),
        dropdown(filters.model, 'model', catalog.models, t('模型', 'Model')),
        h('div', {
          role: 'group',
          'aria-label': t('日期范围', 'Date range'),
          style: { display: 'inline-flex', flexWrap: 'wrap', gap: 2, padding: 2, borderRadius: 8, background: C.bg, border: '1px solid ' + C.border },
        },
        ...RANGE_KEYS.map(rk => h('button', {
          key: rk,
          type: 'button',
          disabled: busy && rk === filters.range,
          'aria-pressed': filters.range === rk,
          onClick: () => change('range', rk),
          style: {
            ...btnBase,
            padding: '4px 9px',
            borderColor: 'transparent',
            background: filters.range === rk ? C.brand : 'transparent',
            color: filters.range === rk ? '#fff' : C.text,
            fontSize: 11.5,
          },
        }, RANGE_LABELS[rk]))),
        filters.range === 'custom'
          ? h('input', { type: 'date', 'aria-label': t('开始日期', 'Start date'), value: filters.since, onChange: e => change('since', e.target.value), style: selectStyle, required: true })
          : null,
        filters.range === 'custom'
          ? h('input', { type: 'date', 'aria-label': t('结束日期', 'End date'), value: filters.until, onChange: e => change('until', e.target.value), style: selectStyle, required: true })
          : null,
        busy
          ? h('button', { type: 'button', style: btnBase, onClick: cancel }, t('取消查询', 'Cancel query'))
          : h('button', { type: 'button', style: btnBase, onClick: () => submitFilters(true) }, t('刷新数据', 'Refresh data')),
        (filters.client !== 'all' || filters.model !== 'all' || filters.range !== 'today' || workspaceFilter)
          ? h('button', {
              type: 'button',
              style: { ...btnBase, padding: '5px 9px' },
              disabled: busy,
              onClick: () => { setWorkspaceFilter(''); prevRangeRef.current = { range: 'today', since: '', until: '' }; applyImmediate(initialFilters); },
            }, t('重置', 'Reset'))
          : null),
      sourceProbe?.catalogError ? h('div', { role: 'alert', style: { color: C.error, width: '100%', fontSize: 12 } }, t('无法读取完整 Agent 列表：', 'Could not load the complete agent catalog: ') + sourceProbe.catalogError) : null,
      validation ? h('div', { role: 'alert', style: { color: C.error, width: '100%', fontSize: 12 } }, validation) : null);

      // --- Harness Scope Editor Panel --------------------------------------
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
            ]).sort((a, b) => (knownObservedSet.has(a) ? 0 : 1) - (knownObservedSet.has(b) ? 0 : 1) || a.localeCompare(b));
            const primarySet = new Set(primaryCandidates);
            const qLower = scopeQuery.trim().toLowerCase();
            const extraCandidates = distinct(allEngineCatalog.map(canonHarness))
              .filter(c => !primarySet.has(c))
              .filter(c => !qLower || c.toLowerCase().includes(qLower))
              .sort((a, b) => a.localeCompare(b));
            const filteredPrimary = qLower ? primaryCandidates.filter(c => c.toLowerCase().includes(qLower)) : primaryCandidates;

            const renderToggleChip = cName => {
              const checked = draftScopeMode === 'all' || draftScopeClients.includes(cName);
              const isObs = knownObservedSet.has(cName);
              return h('button', {
                key: cName,
                type: 'button',
                'aria-pressed': checked,
                onClick: () => {
                  setDraftScopeMode('custom');
                  setDraftScopeClients(prev => prev.includes(cName) ? prev.filter(x => x !== cName) : [...prev, cName]);
                },
                style: {
                  ...btnBase,
                  padding: '4px 10px',
                  fontSize: 12,
                  borderRadius: 999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: checked ? tint(C.brand) : C.bg,
                  borderColor: checked ? C.brand : C.border,
                  fontWeight: checked ? 600 : 400,
                },
              },
              h('span', { 'aria-hidden': true, style: { color: checked ? C.brand : C.muted, fontWeight: 700 } }, checked ? '✓' : '+'),
              cName,
              HARNESS_HINTS[cName] ? h('small', { style: { color: C.muted, fontSize: 10.5, fontWeight: 400 } }, `(${HARNESS_HINTS[cName]})`) : null,
              isObs ? h('span', { title: t('本机已观测到用量记录', 'Usage observed on this machine'), style: { width: 6, height: 6, borderRadius: '50%', background: C.ok, display: 'inline-block' } }) : null);
            };

            return h('section', { style: { ...panelStyle, borderColor: C.brand, display: 'grid', gap: 10 } },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' } },
                h('div', null,
                  h('strong', { style: { fontSize: 14 } }, t('常用 Harness 查询范围设置', 'Configure harness query scope')),
                  h('div', { style: { fontSize: 12, color: C.muted, marginTop: 2 } },
                    t('保存后，“全部”汇总、图表、下拉框与引擎状态图仅统计和展示你勾选的常用 Harness，不再混入未使用的数十个客户端。', 'Limit "All" queries, charts, dropdowns, and refreshes to your chosen harnesses instead of all 58 clients.'))),
                h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
                  knownObservedList.length > 0
                    ? h('button', { type: 'button', style: { ...btnBase, padding: '3px 9px', fontSize: 11.5 }, onClick: () => { setDraftScopeMode('custom'); setDraftScopeClients([...knownObservedList]); } },
                        t(`仅选本机活跃 (${knownObservedList.length})`, `Active only (${knownObservedList.length})`))
                    : null,
                  h('button', { type: 'button', style: { ...btnBase, padding: '3px 9px', fontSize: 11.5 }, onClick: () => { setDraftScopeMode('custom'); setDraftScopeClients([...CORE_HARNESS_PRESET]); } }, t('推荐常用组', 'Core defaults')),
                  h('button', { type: 'button', style: { ...btnBase, padding: '3px 9px', fontSize: 11.5, ...(draftScopeMode === 'all' ? btnActive : {}) }, onClick: () => setDraftScopeMode('all') }, t('不限 (全部引擎)', 'Unrestricted (all)')),
                  h('button', { type: 'button', style: { ...btnBase, padding: '3px 9px', fontSize: 11.5 }, onClick: () => void triggerProgressive(filters, true) }, t('全量扫描发现新引擎', 'Scan all to discover')))),
              h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 7 } }, ...filteredPrimary.map(renderToggleChip)),
              allEngineCatalog.length > primaryCandidates.length
                ? h('div', { style: { borderTop: '1px solid ' + C.border, paddingTop: 8, display: 'grid', gap: 8 } },
                    h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                      h('input', {
                        type: 'search', value: scopeQuery,
                        placeholder: t('搜索添加其他客户端 (如 cursor / trae / qwen)…', 'Search other harnesses (cursor, trae, qwen)…'),
                        onChange: e => setScopeQuery(e.target.value),
                        style: { ...btnBase, padding: '4px 10px', minWidth: 220, fontSize: 12 },
                      }),
                      !qLower
                        ? h('button', { type: 'button', style: { ...btnBase, padding: '3px 9px', fontSize: 11.5 }, onClick: () => setShowExtraEngines(v => !v) },
                            showExtraEngines ? t('收起其余未用客户端', 'Hide other clients') : t(`展开其余 ${extraCandidates.length} 个客户端`, `Show ${extraCandidates.length} other clients`))
                        : null),
                    (showExtraEngines || Boolean(qLower)) && extraCandidates.length > 0
                      ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 148, overflowY: 'auto' } }, ...extraCandidates.map(renderToggleChip))
                      : null)
                : null,
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 4 } },
                h('span', { style: { fontSize: 12, color: C.muted } },
                  draftScopeMode === 'all'
                    ? t('将启用全部客户端', 'All supported clients enabled')
                    : t(`已勾选 ${draftScopeClients.length} 个常用 Harness（绿点代表本机已有用量记录）`, `${draftScopeClients.length} harnesses selected (green dot = usage observed)`)),
                h('div', { style: { display: 'flex', gap: 8 } },
                  scopeState?.mode && scopeState.mode !== 'default'
                    ? h('button', { type: 'button', disabled: savingScope, style: btnBase, onClick: () => void saveScopeSelection('default', CORE_HARNESS_PRESET) }, t('恢复默认精简', 'Reset default'))
                    : null,
                  h('button', { type: 'button', disabled: savingScope, style: btnBase, onClick: () => setShowScopeEditor(false) }, t('取消', 'Cancel')),
                  h('button', {
                    type: 'button',
                    disabled: savingScope || (draftScopeMode === 'custom' && draftScopeClients.length === 0),
                    style: { ...btnBase, ...btnActive },
                    onClick: () => void saveScopeSelection(),
                  }, savingScope ? t('保存中…', 'Saving…') : t('保存范围并刷新', 'Save scope')))));
          })()
        : null;

      // --- Main Report Body ------------------------------------------------
      const dirty = !applied || ['client', 'model', 'range', 'since', 'until'].some(k => filters[k] !== applied[k]);
      const reportScope = applied ? [
        applied.range === 'custom' ? `${applied.since} – ${applied.until}` : RANGE_LABELS[applied.range],
        applied.client === 'all' ? null : 'Agent ' + applied.client,
        applied.model === 'all' ? null : t('模型 ', 'Model ') + applied.model,
      ].filter(Boolean).join(' · ') : '';
      const reportStatus = [
        reportScope && (dirty ? t('显示 ', 'Showing ') : '') + reportScope,
        busy ? t('更新中', 'Updating') : meta.stale ? t('上次缓存', 'Last cached report') : null,
      ].filter(Boolean).join(' · ');

      const errors = meta.errors && typeof meta.errors === 'object' ? Object.entries(meta.errors) : [];
      const requestError = error ? h('div', { role: 'alert', style: { ...panelStyle, color: C.error, fontSize: 13 } }, t('报告加载失败：', 'Report request failed: ') + error) : null;
      const notice = (text, color = C.warn) => h('div', { role: 'status', style: { ...panelStyle, color, fontSize: 13 } }, text);

      const m = data?.metrics;
      let results = null;
      if (m && typeof m === 'object') {
        const daily = meta.trendsAvailable === true && Array.isArray(data.daily) ? data.daily : [];
        const hourly = Array.isArray(data.hourly) ? data.hourly : [];
        const heatmap = Array.isArray(data.heatmap) ? data.heatmap : [];
        const tasks = Array.isArray(data.tasks) ? data.tasks : [];
        const workspaces = Array.isArray(data.workspaces) ? data.workspaces : [];
        const weekdayProfile = Array.isArray(data.weekdayProfile) ? data.weekdayProfile : [];
        const isZeroWindow = m.totalTokens === 0 && entries.length === 0 && daily.length === 0 && tasks.length === 0;

        const kpiNode = h(KpiStrip, {
          m,
          daily,
          periodDelta: data.periodDelta || null,
          monthlyProjection: data.monthlyProjection || null,
          execProfile: data.executionProfile || null,
          tm: data.timeMetrics || null,
          tp: data.throughputSummary || null,
          activeAgentsCount: vm.rawAgents.length,
          activeModelsCount: vm.models.length,
          workspacesCount: workspaces.length,
          totalTasks: data.totalTasks,
          reportStatus,
        });

        const heatmapNode = h(ActivityHeatmap, {
          heatmap,
          weekdayProfile,
          selectedDay: isSingleDay ? filters.since : '',
          hoverDate,
          setHoverDate,
          onToggleDay: (dateStr, wasSelected) => {
            if (wasSelected) exitSingleDay();
            else drillToDay(dateStr);
          },
        });

        if (isZeroWindow && heatmap.length > 0) {
          results = h(React.Fragment, null,
            kpiNode,
            h('div', { className: 'tu-summary' },
              h(SmartEmptyCard, {
                heatmap,
                onPickRange: rk => change('range', rk),
                onPickDate: dateStr => drillToDay(dateStr),
              }),
              heatmapNode));
        } else {
          const trendNode = h(SvgTrendWorkbench, {
            daily,
            hourly,
            m,
            meta,
            agentOrder: vm.agentOrder,
            clientColorMap: vm.clientColorMap,
            monthlyProjection: data.monthlyProjection || null,
            hoverDate,
            setHoverDate,
            hoverAgent,
            setHoverAgent,
            onPickDate: dateStr => drillToDay(dateStr),
          });

          const bubbleNode = h(QuadrantBubbleMap, {
            bubbleRows: vm.bubbleRows,
            clientColorMap: vm.clientColorMap,
            hoverAgent,
            onPickModel: md => change('model', md),
          });

          const deepWorkbenchNode = h(DeepWorkbench, {
            workspaces,
            matrixData: vm.matrixData,
            execProfile: data.executionProfile || null,
            workspaceFilter,
            setWorkspaceFilter,
            clientColorMap: vm.clientColorMap,
            onPickAgentModel: (ag, md) => applyImmediate({ ...filters, client: ag, model: md }),
          });

          const hasTrendRow = daily.length > 0 || heatmap.length > 0 || hourly.length > 0;
          results = h(React.Fragment, null,
            kpiNode,
            hasTrendRow ? h('div', { className: 'tu-summary' }, trendNode, heatmapNode) : null,
            h('div', { className: 'tu-tri' },
              h(TokenComposition, { m, execProfile: data.executionProfile || null }),
              h(SvgAgentDonut, {
                comparison: groupFamily ? vm.familyAgents : vm.rawAgents,
                hasMultiFamily: vm.hasMultiFamily,
                groupFamily,
                setGroupFamily,
                clientFilter: filters.client,
                catalogClients: catalog.clients,
                clientColorMap: vm.clientColorMap,
                hoverAgent,
                setHoverAgent,
                onPickClient: c => change('client', c),
              }),
              h(ModelRanking, {
                models: vm.models,
                rankBy: modelRankBy,
                setRankBy: setModelRankBy,
                onPickModel: md => change('model', md),
              })),
            !hasTrendRow
              ? h('div', { style: { color: C.muted, fontSize: 12, padding: '2px 4px' } }, t('此筛选条件下趋势数据不可用。', 'Trend data is unavailable for this selection.'))
              : null,
            bubbleNode || deepWorkbenchNode ? h('div', { className: 'tu-deep' }, bubbleNode, deepWorkbenchNode) : null,
            h(TaskStream, {
              tasks,
              workspaceFilter,
              setWorkspaceFilter,
              clientColorMap: vm.clientColorMap,
              hoverAgent,
            }));
        }
      } else if (data) results = notice(t('当前筛选条件没有可用报告；请检查来源状态。', 'No report is available for this selection; check source status.'));
      else if (busy || activeProgress) results = notice(t('正在增量读取本机各 Agent 用量，快引擎（DSH 等）将在 1–4 秒内先行呈现…', 'Scanning local agents progressively (fast engines appear first within ~1–4s)…'), C.muted);
      else if (checkingCache) results = notice(t('正在查找已保存的报告…', 'Checking for a saved report…'), C.muted);
      else if (!error) results = notice(t('点击预设时间或刷新以加载用量。', 'Select a preset or refresh to query usage.'), C.muted);

      const sourcesFooter = data || sourceProbe
        ? h(SourcesDiagnostics, {
            sources,
            errors,
            sourceProbe,
            scopeState,
            showScopeEditor,
            onOpenScope: openScopeEditor,
            onProbeDirs: () => void loadSources(true),
            onPickClient: c => change('client', c),
          })
        : null;

      return h('main', {
        'data-tokscale-usage': true,
        style: {
          display: 'grid',
          gridAutoRows: 'max-content',
          alignContent: 'start',
          gap: 12,
          padding: '14px clamp(12px, 2vw, 24px)',
          height: '100%',
          overflowY: 'auto',
          boxSizing: 'border-box',
          color: C.text,
          background: 'color-mix(in srgb, #7893ba 5%, ' + C.bg + ')',
        },
      },
      h('style', null, STUDIO_CSS),
      commandBar,
      scopeEditorPanel,
      requestError,
      h('div', { className: 'tu-report', 'aria-busy': busy && !!data }, results),
      sourcesFooter);
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
