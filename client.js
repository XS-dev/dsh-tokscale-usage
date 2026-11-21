// Native DSH Usage & Telemetry Studio (tokscale + dsh-context v0.7.0).
window.__ModuleLoader__.load({
  id: 'dsh-tokscale-usage',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback, useMemo, useRef, memo } = React;
    const useIsoLayoutEffect = React.useLayoutEffect || useEffect;
    const startTrans = React.startTransition || (fn => fn());

    // =========================================================================
    // 1. Theme Tokens, Contrast-Safe Color Mixing & Scoped Studio CSS
    // =========================================================================
    const C = {
      bg: 'var(--tu-bg)',
      panel: 'var(--tu-panel)',
      panel2: 'var(--tu-panel2)',
      border: 'var(--tu-border)',
      text: 'var(--tu-text)',
      muted: 'var(--tu-muted)',
      accent: 'var(--tu-accent)',
      accentFg: 'var(--tu-accent-fg)',
      accentSoft: 'var(--tu-accent-soft)',
      accentInk: 'var(--tu-accent-ink)',
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
      'var(--tu-panel2)',
      'color-mix(in oklab, var(--tu-accent) 26%, var(--tu-panel))',
      'color-mix(in oklab, var(--tu-accent) 48%, var(--tu-panel))',
      'color-mix(in oklab, var(--tu-accent) 72%, var(--tu-panel))',
      'var(--tu-accent)',
    ];

    const soft = (color, k = 14) => `color-mix(in oklab, ${color} ${k}%, var(--tu-panel))`;
    const ink = (color, k = 68) => `color-mix(in oklab, ${color} ${k}%, var(--tu-text))`;
    const cssEsc = s => (typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&'));

    function colorForAgent(name) {
      const key = String(name || '').toLowerCase();
      if (AGENT_FIXED_COLORS[key]) return AGENT_FIXED_COLORS[key];
      if (key.startsWith('antigravity')) return AGENT_FIXED_COLORS.antigravity;
      let hash = 0;
      for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
      return FALLBACK_SERIES[Math.abs(hash) % FALLBACK_SERIES.length];
    }

    const STUDIO_CSS = `
      [data-tokscale-usage] {
        --tu-bg: var(--dsw-alias-bg-base, #ffffff);
        --tu-panel: var(--dsw-alias-bg-layer-1, #f7f8fa);
        --tu-panel2: var(--dsw-alias-bg-layer-2, #eef1f5);
        --tu-border: var(--dsw-alias-border-l1, #e3e6ea);
        --tu-text: var(--dsw-alias-label-primary, #1a1d21);
        --tu-muted: var(--dsw-alias-label-secondary, #5b6470);
        --tu-accent: color-mix(in oklab, #2563eb 84%, var(--tu-text));
        --tu-accent-fg: var(--tu-bg);
        --tu-accent-soft: color-mix(in oklab, var(--tu-accent) 14%, var(--tu-panel));
        --tu-accent-ink: color-mix(in oklab, var(--tu-accent) 74%, var(--tu-text));
        --tu-fs-2xs: 11px;
        --tu-fs-xs: 12px;
        --tu-fs-sm: 12.5px;
        --tu-fs-md: 13px;
        --tu-ease: cubic-bezier(.2, .8, .2, 1);
        --tu-d1: 120ms;
        --tu-d2: 200ms;
        --tu-d3: 320ms;
        scrollbar-gutter: stable;
        color-scheme: light dark;
      }
      [data-tokscale-usage] .tu-num {
        font-family: "Segoe UI Variable", "Segoe UI", system-ui, -apple-system, sans-serif;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      [data-tokscale-usage] .tu-card {
        background: var(--tu-panel);
        border: 1px solid var(--tu-border);
        border-radius: 12px;
        padding: 14px;
        min-width: 0;
      }
      [data-tokscale-usage] .tu-btn {
        padding: 5px 10px;
        border: 1px solid var(--tu-border);
        border-radius: 8px;
        background: var(--tu-panel);
        color: var(--tu-text);
        cursor: pointer;
        font: inherit;
        font-size: var(--tu-fs-xs);
        line-height: 1.35;
        transition: background-color var(--tu-d1) var(--tu-ease), color var(--tu-d1) var(--tu-ease), border-color var(--tu-d1) var(--tu-ease), transform 80ms var(--tu-ease);
      }
      [data-tokscale-usage] .tu-btn:enabled:hover { border-color: var(--tu-muted); }
      [data-tokscale-usage] .tu-btn:enabled:active { transform: scale(.96); }
      [data-tokscale-usage] .tu-btn[aria-pressed='true'], [data-tokscale-usage] .tu-btn-active {
        background: var(--tu-accent);
        color: var(--tu-accent-fg);
        border-color: transparent;
      }
      [data-tokscale-usage] .tu-seg {
        position: relative;
        display: inline-grid;
        grid-auto-flow: column;
        grid-auto-columns: 1fr;
        padding: 2px;
        border: 1px solid var(--tu-border);
        border-radius: 9px;
        background: var(--tu-bg);
        isolation: isolate;
      }
      [data-tokscale-usage] .tu-seg::before {
        content: '';
        position: absolute;
        z-index: -1;
        top: 2px;
        bottom: 2px;
        left: 2px;
        width: calc((100% - 4px) / var(--n, 1));
        transform: translate3d(calc(var(--i, 0) * 100%), 0, 0);
        background: var(--tu-accent);
        border-radius: 7px;
        transition: transform var(--tu-d2) var(--tu-ease);
      }
      [data-tokscale-usage] .tu-seg > button {
        background: transparent;
        border: 0;
        border-radius: 7px;
        padding: 3px 9px;
        color: var(--tu-text);
        font: inherit;
        font-size: var(--tu-fs-xs);
        cursor: pointer;
        white-space: nowrap;
        transition: color var(--tu-d2) var(--tu-ease);
      }
      [data-tokscale-usage] .tu-seg > button[aria-pressed='true'] { color: var(--tu-accent-fg); font-weight: 600; }
      [data-tokscale-usage] .tu-collapse {
        display: grid;
        grid-template-rows: 0fr;
        opacity: 0;
        transition: grid-template-rows var(--tu-d3) var(--tu-ease), opacity var(--tu-d2) var(--tu-ease);
      }
      [data-tokscale-usage] .tu-collapse[data-open='true'] { grid-template-rows: 1fr; opacity: 1; }
      [data-tokscale-usage] .tu-collapse > div { min-height: 0; overflow: hidden; }
      @keyframes tu-fade-up { from { opacity: 0; transform: translateY(4px); } }
      [data-tokscale-usage] .tu-enter { animation: tu-fade-up var(--tu-d2) var(--tu-ease) both; }
      @keyframes tu-grow { from { transform: scaleY(.03); opacity: 0; } }
      [data-tokscale-usage] .tu-bar-col {
        transform-box: fill-box;
        transform-origin: 50% 100%;
        animation: tu-grow 420ms var(--tu-ease) both;
        animation-delay: calc(min(var(--i, 0), 40) * 7ms);
      }
      [data-tokscale-usage] .tu-bar { transition: y var(--tu-d3) var(--tu-ease), height var(--tu-d3) var(--tu-ease), fill-opacity 160ms var(--tu-ease); }
      [data-tokscale-usage] .tu-arc { transition: stroke-dasharray 400ms var(--tu-ease), stroke-dashoffset 400ms var(--tu-ease), stroke-width 150ms var(--tu-ease), opacity 160ms var(--tu-ease); }
      @starting-style { [data-tokscale-usage] .tu-arc { stroke-dasharray: 0 999; } }
      [data-tokscale-usage] [data-agent-tone] { transition: opacity 160ms var(--tu-ease), fill-opacity 160ms var(--tu-ease); }
      [data-tokscale-usage] .tu-tip {
        position: absolute;
        top: 8px;
        left: 0;
        width: 244px;
        pointer-events: none;
        z-index: 6;
        background: var(--tu-bg);
        border: 1px solid var(--tu-border);
        box-shadow: 0 0 0 1px var(--tu-border), 0 8px 24px color-mix(in srgb, #000 18%, transparent);
        border-radius: 9px;
        padding: 7px 10px;
        font-size: var(--tu-fs-xs);
        display: grid;
        gap: 3px;
        transition: transform 130ms var(--tu-ease), opacity 110ms var(--tu-ease);
      }
      [data-tokscale-usage] .tu-crosshair {
        position: absolute;
        top: var(--pt, 14px);
        bottom: var(--pb, 24px);
        left: 0;
        width: 1px;
        border-left: 1px dashed var(--tu-accent);
        pointer-events: none;
        z-index: 4;
        transition: transform 85ms var(--tu-ease), opacity 110ms var(--tu-ease);
      }
      @keyframes tu-indet { from { transform: translateX(-100%); } to { transform: translateX(260%); } }
      [data-tokscale-usage] .tu-report { position: relative; display: grid; gap: 12px; }
      [data-tokscale-usage] .tu-report::before {
        content: '';
        position: absolute;
        top: -7px;
        left: 0;
        width: 38%;
        height: 2px;
        border-radius: 2px;
        background: linear-gradient(90deg, transparent, var(--tu-accent), transparent);
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms;
      }
      [data-tokscale-usage] .tu-report[aria-busy='true']::before { opacity: 1; animation: tu-indet 1.1s linear infinite; }
      [data-tokscale-usage] .tu-report > * { transition: opacity 200ms var(--tu-ease); }
      [data-tokscale-usage] .tu-report[aria-busy='true'] > * { opacity: .86; transition-delay: 350ms; }
      @keyframes tu-ping { from { transform: scale(1); opacity: .55; } to { transform: scale(2.5); opacity: 0; } }
      [data-tokscale-usage] .tu-live { position: relative; width: 7px; height: 7px; border-radius: 50%; background: var(--tu-accent); display: inline-block; flex-shrink: 0; }
      [data-tokscale-usage] .tu-live::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: inherit; animation: tu-ping 1.6s var(--tu-ease) infinite; }
      [data-tokscale-usage] .tu-kpis { display: grid; grid-template-columns: minmax(0, 1.26fr) minmax(0, 1.2fr) repeat(4, minmax(0, .94fr)); gap: 10px; align-items: stretch; }
      [data-tokscale-usage] .tu-kpi { text-align: left; padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; min-height: 96px; container-type: inline-size; }
      [data-tokscale-usage] .tu-kpi-hero {
        border-color: color-mix(in oklab, var(--tu-accent) 32%, var(--tu-border));
        background: linear-gradient(160deg, color-mix(in oklab, var(--tu-accent) 6%, var(--tu-panel)) 0%, var(--tu-panel) 66%);
      }
      [data-tokscale-usage] .tu-summary { display: grid; grid-template-columns: minmax(0, 1.54fr) minmax(0, 1fr); gap: 12px; align-items: stretch; }
      [data-tokscale-usage] .tu-tri { display: grid; grid-template-columns: minmax(0, .88fr) minmax(0, 1.02fr) minmax(0, 1.24fr); gap: 12px; align-items: stretch; }
      [data-tokscale-usage] .tu-deep { display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr); gap: 12px; align-items: stretch; content-visibility: auto; contain-intrinsic-size: auto 280px; }
      [data-tokscale-usage] .tu-deep-single { display: grid; grid-template-columns: minmax(0, 1fr); content-visibility: auto; contain-intrinsic-size: auto 260px; }
      [data-tokscale-usage] .tu-bento-card { display: flex; flex-direction: column; justify-content: space-between; height: 100%; box-sizing: border-box; }
      [data-tokscale-usage] .tu-tasks-sec { content-visibility: auto; contain-intrinsic-size: auto 320px; }
      [data-tokscale-usage] .tu-tasks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; align-items: stretch; }
      [data-tokscale-usage] .tu-task-card { border: 1px solid var(--tu-border); background: var(--tu-bg); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; justify-content: space-between; gap: 6px; min-width: 0; transition: border-color 140ms var(--tu-ease); }
      [data-tokscale-usage] .tu-task-card:hover { border-color: var(--tu-accent); }
      [data-tokscale-usage] .tu-heat-wrap { display: flex; align-items: start; gap: 6px; }
      [data-tokscale-usage] .tu-heat-days { display: grid; grid-template-rows: repeat(7, 14px); gap: 3px; font-size: var(--tu-fs-xs); color: var(--tu-muted); line-height: 14px; text-align: right; user-select: none; }
      [data-tokscale-usage] .tu-heat-grid { display: grid; grid-auto-flow: column; grid-template-rows: repeat(7, 14px); gap: 3px; overflow-x: auto; padding: 2px 0 4px; flex: 1; }
      [data-tokscale-usage] .tu-heat-cell { width: 14px; height: 14px; border-radius: 3px; border: 0; padding: 0; cursor: pointer; transition: outline-color 120ms var(--tu-ease), filter 120ms var(--tu-ease); }
      [data-tokscale-usage] .tu-heat-cell:hover { filter: brightness(1.12); }
      [data-tokscale-usage] .tu-heat-cell.selected, [data-tokscale-usage] .tu-heat-cell.linked { outline: 2px solid var(--tu-text); outline-offset: -1px; }
      [data-tokscale-usage] .tu-row-btn {
        width: 100%;
        text-align: left;
        border: 1px solid transparent;
        background: transparent;
        color: var(--tu-text);
        font: inherit;
        cursor: pointer;
        border-radius: 7px;
        padding: 4px 7px;
        transition: border-color 140ms var(--tu-ease), background-color 140ms var(--tu-ease);
      }
      [data-tokscale-usage] .tu-row-btn:hover { border-color: var(--tu-border); }
      [data-tokscale-usage] .tu-ws-row { width: 100%; text-align: left; font: inherit; color: var(--tu-text); border: 1px solid var(--tu-border); border-radius: 8px; padding: 8px 10px; background: var(--tu-bg); cursor: pointer; display: grid; gap: 5px; transition: border-color 140ms var(--tu-ease), background-color 140ms var(--tu-ease); }
      [data-tokscale-usage] .tu-ws-row:hover { border-color: var(--tu-accent); }
      [data-tokscale-usage] button:focus-visible, [data-tokscale-usage] select:focus-visible, [data-tokscale-usage] input:focus-visible, [data-tokscale-usage] svg:focus-visible {
        outline: 2px solid var(--tu-accent);
        outline-offset: 2px;
      }
      @media (max-width: 1240px) {
        [data-tokscale-usage] .tu-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        [data-tokscale-usage] .tu-summary, [data-tokscale-usage] .tu-tri, [data-tokscale-usage] .tu-deep { grid-template-columns: 1fr; }
        [data-tokscale-usage] .tu-tasks { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @media (max-width: 680px) {
        [data-tokscale-usage] .tu-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        [data-tokscale-usage] .tu-tasks { grid-template-columns: 1fr; }
      }
      @media (prefers-reduced-motion: reduce) {
        [data-tokscale-usage] *, [data-tokscale-usage] *::before, [data-tokscale-usage] *::after {
          animation-duration: .01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: .01ms !important;
        }
      }
    `;

    // =========================================================================
    // 2. Localization, Formatters & Math Utilities
    // =========================================================================
    const EMPTY = Object.freeze([]);
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
    const relTime = ts => {
      if (!ts) return '—';
      const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
      if (diffSec < 45) return t('刚刚', 'just now');
      const mins = Math.floor(diffSec / 60);
      if (mins < 60) return t(`${mins} 分钟前`, `${mins}m ago`);
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return t(`${hrs} 小时前`, `${hrs}h ago`);
      return new Date(ts).toLocaleDateString();
    };
    const prettyTaskTitle = tk => {
      const raw = String(tk?.title || '');
      const m = raw.match(/^rollout-\d{4}-(\d{2})-(\d{2})T(\d{2})-(\d{2})-\d{2}-([0-9a-f]{8})/i);
      if (m) return `${tk?.isSubagent ? t('子代理', 'Subagent') : t('Codex 会话', 'Codex session')} · ${m[1]}-${m[2]} ${m[3]}:${m[4]} · ${m[5]}`;
      if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(raw)) return `${t('会话', 'Session')} · ${raw.slice(0, 8)}`;
      return raw;
    };

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
    const crisp = v => Math.round(v) + 0.5;

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

    // =========================================================================
    // 3. Zero-Rerender External Store & Stable Hooks
    // =========================================================================
    function useEvent(fn) {
      const ref = useRef(fn);
      ref.current = fn;
      return useCallback((...args) => ref.current(...args), []);
    }

    function createHoverStore(initial) {
      let state = initial;
      const subs = new Set();
      return {
        get: () => state,
        set(patch) {
          let changed = false;
          for (const k of Object.keys(patch)) {
            if (!Object.is(state[k], patch[k])) { changed = true; break; }
          }
          if (!changed) return;
          state = { ...state, ...patch };
          subs.forEach(fn => fn());
        },
        subscribe: fn => { subs.add(fn); return () => subs.delete(fn); },
      };
    }

    function useHoverSelector(store, selector) {
      if (typeof React.useSyncExternalStore === 'function') {
        return React.useSyncExternalStore(store.subscribe, () => selector(store.get()));
      }
      const [val, setVal] = useState(() => selector(store.get()));
      useEffect(() => store.subscribe(() => setVal(selector(store.get()))), [store]);
      return val;
    }

    function useElementWidth(fallback = 660) {
      const ref = useRef(null);
      const [width, setWidth] = useState(fallback);
      useEffect(() => {
        const el = ref.current;
        if (!el || typeof ResizeObserver !== 'function') return undefined;
        let raf = 0;
        const ro = new ResizeObserver(([entry]) => {
          if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
          const update = () => {
            const nw = Math.round(entry.contentRect.width);
            if (nw > 120) setWidth(prev => (Math.abs(nw - prev) >= 2 ? nw : prev));
          };
          if (typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(update);
          else update();
        });
        ro.observe(el);
        return () => {
          ro.disconnect();
          if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
        };
      }, []);
      return [ref, width];
    }

    // =========================================================================
    // 4. Motion & UI Primitives (AnimatedNumber, Segmented, Collapse, Sparkline)
    // =========================================================================
    const REDUCED_MOTION = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

    const AnimatedNumber = memo(function AnimatedNumber({ value, format, duration = 420 }) {
      const ref = useRef(null);
      const shownRef = useRef(null);
      useIsoLayoutEffect(() => {
        const el = ref.current;
        const from = shownRef.current;
        shownRef.current = value;
        if (!el || typeof requestAnimationFrame !== 'function') return undefined;
        if (!Number.isFinite(from) || !Number.isFinite(value) || from === value || REDUCED_MOTION.matches) {
          el.textContent = format(value);
          return undefined;
        }
        el.textContent = format(from);
        let raf = 0;
        let t0 = 0;
        const tick = ts => {
          if (!t0) t0 = ts;
          const p = Math.min(1, (ts - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          const cur = from + (value - from) * eased;
          el.textContent = format(cur);
          if (p < 1) raf = requestAnimationFrame(tick);
          else el.textContent = format(value);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
      }, [value, format, duration]);
      return h('span', { ref, className: 'tu-num' }, format(value));
    });

    function Segmented({ options, value, onChange, ariaLabel, disabledWhenBusy = false, busy = false }) {
      const activeIdx = Math.max(0, options.findIndex(([k]) => k === value));
      return h('div', {
        className: 'tu-seg',
        role: 'group',
        'aria-label': ariaLabel,
        style: { '--n': options.length, '--i': activeIdx },
      },
      ...options.map(([k, lbl]) => h('button', {
        key: k,
        type: 'button',
        disabled: disabledWhenBusy && busy && k === value,
        'aria-pressed': value === k,
        onClick: () => onChange(k),
      }, lbl)));
    }

    function Collapse({ open, children }) {
      const [keep, setKeep] = useState(open);
      useEffect(() => { if (open) setKeep(true); }, [open]);
      if (!open && !keep) return null;
      return h('div', {
        className: 'tu-collapse',
        'data-open': open ? 'true' : 'false',
        onTransitionEnd: e => { if (!open && e.propertyName === 'grid-template-rows') setKeep(false); },
      }, h('div', null, children));
    }

    function renderDeltaBadge(pctVal, deltaInfo, kind) {
      if (deltaInfo?.unavailable === 'scan-incomplete') {
        const missingStr = (deltaInfo.missingClients || []).join(', ');
        return h('span', {
          title: t(`${missingStr} 扫描未完成，暂不计算环比以避免误报`, `Scan incomplete for ${missingStr}; delta withheld`),
          style: { fontSize: 'var(--tu-fs-2xs)', padding: '1px 7px', borderRadius: 999, background: C.panel2, color: C.muted, whiteSpace: 'nowrap' },
        }, t('环比待定', 'Δ pending'));
      }
      if (typeof pctVal !== 'number' || !Number.isFinite(pctVal)) return null;
      const prevWindow = deltaInfo?.prevSince && deltaInfo?.prevUntil
        ? `${deltaInfo.prevSince} ~ ${deltaInfo.prevUntil}`
        : t('上一等长周期', 'previous equal window');
      const prevDetail = kind === 'cost' && Number.isFinite(deltaInfo?.prevCost)
        ? ` (${shortCost(deltaInfo.prevCost)})`
        : kind === 'tokens' && Number.isFinite(deltaInfo?.prevTokens)
          ? ` (${compact(deltaInfo.prevTokens)})`
          : '';
      const exclNote = deltaInfo?.partial && deltaInfo.excludedClients?.length
        ? t(` · 已排除未完成引擎: ${deltaInfo.excludedClients.join(', ')}`, ` · excluded incomplete: ${deltaInfo.excludedClients.join(', ')}`)
        : '';
      const intradayNote = deltaInfo?.intraday ? t('（今日截至当前 vs 昨日全天）', ' (intraday vs full yesterday)') : '';
      const tip = t(`对比 ${prevWindow}${prevDetail}${intradayNote}${exclNote}`, `Change vs ${prevWindow}${prevDetail}${intradayNote}${exclNote}`);

      if (Math.abs(pctVal) < 0.005) {
        return h('span', { title: tip, className: 'tu-num', style: { fontSize: 'var(--tu-fs-2xs)', padding: '1px 6px', borderRadius: 999, background: C.panel2, color: C.muted } }, '0.0%');
      }
      const up = pctVal > 0;
      const baseCol = deltaInfo?.intraday ? '#3b82f6' : (up ? '#d97706' : '#087e75');
      const txt = (up ? '▲ +' : '▼ ') + Math.min(999, Math.abs(pctVal * 100)).toFixed(1) + '%' + (deltaInfo?.partial ? '*' : '');
      return h('span', {
        title: tip,
        className: 'tu-num',
        style: { fontSize: 'var(--tu-fs-2xs)', fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: soft(baseCol, 15), color: ink(baseCol, 72), whiteSpace: 'nowrap' },
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
        style: { display: 'block', marginTop: 5, opacity: 0.9 },
      },
      h('path', { d: areaPath, fill: color, fillOpacity: 0.15 }),
      h('polyline', { fill: 'none', stroke: color, strokeWidth: 1.6, vectorEffect: 'non-scaling-stroke', points: coords.join(' ') }));
    }

    // =========================================================================
    // 5. Memoized Studio Visualization Components
    // =========================================================================
    const KpiStrip = memo(function KpiStrip({ m, daily, periodDelta, monthlyProjection, execProfile, tm, tp, fallback, activeAgentsCount, activeModelsCount, workspacesCount, totalTasks }) {
      const decodeTps = tp?.decodeTokensPerSec;
      const engineTps = tp?.engineTokensPerSec;
      const avgTps = decodeTps ?? engineTps ?? tp?.avgTokensPerSec;
      const activeDaysCount = daily.filter(d => (d.totalTokens || 0) > 0).length;
      const peakDayItem = daily.reduce((pk, d) => (!pk || (d.totalTokens || 0) > (pk.totalTokens || 0) ? d : pk), null);

      const tokenSpark = renderSparkline(daily.slice(-14).map(d => d.totalTokens || 0), '#3b82f6');
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
              className: 'tu-arc',
              cx: 18, cy: 18, r: 14, fill: 'none', stroke: TOKEN_COLORS.cacheRead, strokeWidth: 4, strokeLinecap: 'round',
              style: { strokeDasharray: `${(hitRateRatio * 87.96).toFixed(1)} 88` },
              transform: 'rotate(-90 18 18)',
            }))
        : null;

      const so = execProfile?.sessionOrigins;
      const sessionSub = so && (so.mainCount + so.subagentCount > 0)
        ? t(`${activeDaysCount || 1} 活跃天 · 主 ${so.mainCount} / 子 ${so.subagentCount}`, `${activeDaysCount || 1} active d · ${so.mainCount} main / ${so.subagentCount} sub`)
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

      const useSessionFallbackOnHero = (m.totalTokens === 0 || m.totalTokens == null) && fallback?.totalTokens > 0;
      const tokenSubtitle = useSessionFallbackOnHero
        ? t(`≈ 会话日志捕获 (${fallback.clients.join(', ')})`, `≈ From ${fallback.sessionCount} live session logs`)
        : `${t('输入', 'In')} ${compact(m.input)} · ${t('推理', 'Reas')} ${compact(m.reasoning)} · ${t('输出', 'Out')} ${compact(m.output)}`;

      const cards = [
        {
          hero: true,
          name: t('总 Token', 'Total tokens'),
          valNode: useSessionFallbackOnHero
            ? h('span', { className: 'tu-num' }, '≈ ' + compact(fallback.totalTokens))
            : Number.isFinite(m.totalTokens)
              ? h(AnimatedNumber, { value: m.totalTokens, format: compact })
              : h('span', { className: 'tu-num' }, '—'),
          valTitle: useSessionFallbackOnHero
            ? t(`引擎扫描未完成，当前显示会话日志累计值 ${num(fallback.totalTokens)}`, `Engine scan incomplete; showing session log cumulative ${num(fallback.totalTokens)}`)
            : num(m.totalTokens),
          sub: tokenSubtitle,
          visual: totalMiniBar,
          badge: renderDeltaBadge(periodDelta?.tokenDeltaPct, periodDelta, 'tokens'),
        },
        {
          hero: true,
          name: t('估算费用', 'Est. cost'),
          valNode: Number.isFinite(m.cost) ? h(AnimatedNumber, { value: m.cost, format: shortCost }) : h('span', { className: 'tu-num' }, '—'),
          valTitle: Number.isFinite(m.cost) ? `${cost(m.cost)} — ${t('基于 tokscale 模型定价估算，非实际账单', 'tokscale model pricing estimate, not a bill')}` : undefined,
          sub: costSubtitle,
          visual: costSpark,
          badge: renderDeltaBadge(periodDelta?.costDeltaPct, periodDelta, 'cost'),
        },
        {
          name: t('缓存命中率', 'Cache hit rate'),
          valNode: h('span', { className: 'tu-num' }, pct(m.cacheHitRate)),
          sub: `${t('复用读取', 'Cache read')} ${compact(m.cacheRead)}`,
          badge: hitGauge,
        },
        {
          name: t('消息 & 活跃规模', 'Messages & activity'),
          valNode: h('span', { className: 'tu-num' }, num(m.messages)),
          sub: sessionSub,
        },
        {
          name: t('解码吞吐 & 首字时延', 'Throughput & TTFT'),
          valNode: h('span', { className: 'tu-num' }, Number.isFinite(avgTps) ? tpsFmt(avgTps) : '—'),
          sub: [
            Number.isFinite(tp?.avgTtftMs) ? `TTFT ${(tp.avgTtftMs / 1000).toFixed(1)}s` : null,
            wallMs > 0 ? t(`活跃时长 ${durFmt(wallMs)}`, `Active ${durFmt(wallMs)}`) : null,
          ].filter(Boolean).join(' · ') || t('等待计时样本', 'Awaiting timing samples'),
        },
        {
          name: t('覆盖矩阵', 'Coverage'),
          valNode: h('span', { className: 'tu-num' }, `${activeAgentsCount} / ${activeModelsCount}`),
          sub: [
            workspacesCount ? t(`${workspacesCount} 项目`, `${workspacesCount} projects`) : null,
            Number.isFinite(totalTasks) && totalTasks > 0 ? t(`${totalTasks} 任务`, `${totalTasks} tasks`) : null,
          ].filter(Boolean).join(' · ') || t('活跃 Agent / 模型数', 'Active agents / models'),
        },
      ];

      return h('div', { className: 'tu-kpis' },
        ...cards.map(c => h('div', {
          key: c.name,
          className: 'tu-card tu-kpi' + (c.hero ? ' tu-kpi-hero' : ''),
        },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 } },
          h('div', { style: { minWidth: 0 } },
            h('div', { style: { color: C.muted, fontSize: 'var(--tu-fs-xs)' } }, c.name),
            h('div', {
              title: c.valTitle,
              style: { fontSize: c.hero ? 'clamp(18px, 11cqi, 24px)' : 'clamp(16px, 9.5cqi, 21px)', fontWeight: 700, marginTop: 2 },
            }, c.valNode)),
          c.badge || null),
        c.visual || null,
        h('div', { style: { fontSize: 'var(--tu-fs-xs)', color: C.muted, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: c.sub }, c.sub))));
    });

    const FallbackBanner = memo(function FallbackBanner({ fallback, completeness, actions }) {
      if (!fallback || !(fallback.totalTokens > 0)) return null;
      const missing = completeness?.missingClients?.length ? completeness.missingClients : fallback.clients;
      return h('section', {
        className: 'tu-card tu-enter',
        style: {
          borderColor: 'color-mix(in oklab, #d97706 42%, var(--tu-border))',
          background: soft('#d97706', 9),
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        },
      },
      h('div', { style: { fontSize: 'var(--tu-fs-xs)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 } },
        h('strong', { style: { color: ink('#d97706', 74) } }, t('部分引擎扫描未完成 · 已启用会话日志即时兜底', 'Partial scan · showing live session-log fallback')),
        h('span', { style: { color: C.muted } },
          t(`已从本地日志捕获 ${fallback.sessionCount} 个活跃会话（会话累计口径 ≈ ${compact(fallback.totalTokens)} tokens）`,
            `Captured ${fallback.sessionCount} active sessions from local logs (cumulative ≈ ${compact(fallback.totalTokens)} tokens)`))),
      h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
        ...missing.map(c => h('button', {
          key: c,
          type: 'button',
          className: 'tu-btn',
          onClick: () => actions.retryClient(c),
        }, t(`重试 ${c}`, `Retry ${c}`)))));
    });

    const SmartEmptyCard = memo(function SmartEmptyCard({ heatmap, actions }) {
      const lastActive = useMemo(() => {
        for (let i = heatmap.length - 1; i >= 0; i--) {
          if ((heatmap[i]?.tokens || 0) > 0) return heatmap[i];
        }
        return null;
      }, [heatmap]);

      return h('section', {
        className: 'tu-card tu-enter',
        style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, minHeight: 168 },
      },
      h('strong', { style: { fontSize: 14 } }, t('当前时间窗口暂无用量记录', 'No usage recorded in this time window')),
      h('div', { style: { fontSize: 'var(--tu-fs-sm)', color: C.muted, lineHeight: 1.5 } },
        lastActive
          ? t(`最近一次观测到活跃用量是在 ${lastActive.date}（${compact(lastActive.tokens)} tokens · ${shortCost(lastActive.cost)}）。你可以直接切换时间范围查看：`,
              `Most recent activity was on ${lastActive.date} (${compact(lastActive.tokens)} tokens · ${shortCost(lastActive.cost)}). Jump to an active window:`)
          : t('当前筛选条件下尚未捕获到会话消耗，可尝试放宽时间范围或刷新扫描。',
              'No token activity matched the current filter. Try widening the date window or refreshing.')),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
        lastActive
          ? h('button', { type: 'button', className: 'tu-btn tu-btn-active', onClick: () => actions.pickDate(lastActive.date) },
              t(`查看 ${lastActive.date}`, `Inspect ${lastActive.date}`))
          : null,
        h('button', { type: 'button', className: 'tu-btn', onClick: () => actions.pickRange('yesterday') }, RANGE_LABELS.yesterday),
        h('button', { type: 'button', className: 'tu-btn', onClick: () => actions.pickRange('days3') }, RANGE_LABELS.days3),
        h('button', { type: 'button', className: 'tu-btn', onClick: () => actions.pickRange('week') }, RANGE_LABELS.week),
        h('button', { type: 'button', className: 'tu-btn', onClick: () => actions.pickRange('month') }, RANGE_LABELS.month)));
    });

    // Isolated hover overlay: ONLY this tiny layer re-renders when scrubbing across 60 bars!
    const TrendHoverLayer = memo(function TrendHoverLayer({ hover, chartItems, xAt, W, mode, showHourly, hiddenSet, clientColorMap }) {
      const idx = useHoverSelector(hover, s => s.idx);
      const hoverDate = useHoverSelector(hover, s => s.date);
      const activeIndex = idx != null && chartItems[idx]
        ? idx
        : (hoverDate && !showHourly ? chartItems.findIndex(d => d.date === hoverDate) : -1);
      const item = activeIndex >= 0 ? chartItems[activeIndex] : null;
      const x = item ? Math.round(xAt(activeIndex)) : 0;
      const tipW = 244;
      const tx = Math.max(4, Math.min(Math.max(4, W - tipW - 4), x > W * 0.58 ? x - tipW - 14 : x + 14));

      return h(React.Fragment, null,
        h('div', {
          className: 'tu-crosshair',
          'aria-hidden': true,
          style: { transform: `translate3d(${x}px, 0, 0)`, opacity: item ? 1 : 0 },
        }),
        h('div', {
          className: 'tu-tip',
          role: 'tooltip',
          'aria-live': 'polite',
          style: { transform: `translate3d(${tx}px, 0, 0)`, opacity: item ? 1 : 0 },
        },
        item
          ? h(React.Fragment, null,
              h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 10, fontWeight: 650 } },
                h('span', { className: 'tu-num', style: { color: C.accentInk } }, item.date || item.hour),
                h('span', { className: 'tu-num' }, compact(item.visibleTokens ?? item.totalTokens) + ' tok')),
              h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '2px 8px', color: C.muted, fontSize: 'var(--tu-fs-2xs)' } },
                Number.isFinite(item.visibleCost ?? item.cost) && (item.visibleCost ?? item.cost) > 0
                  ? h('span', { className: 'tu-num', style: { color: ink('#d97706', 72), fontWeight: 600 } }, cost(item.visibleCost ?? item.cost))
                  : null,
                mode === 'cumulative' && Number.isFinite(item.cumCost)
                  ? h('span', { className: 'tu-num' }, `${t('累计', 'Cum')} ${shortCost(item.cumCost)}`)
                  : null,
                mode === 'cacheHit' && Number.isFinite(item.hitRate)
                  ? h('span', { className: 'tu-num', style: { color: ink(TOKEN_COLORS.cacheRead, 70) } }, `${t('命中', 'Hit')} ${pct(item.hitRate)}`)
                  : null,
                item.messages ? h('span', { className: 'tu-num' }, `${num(item.messages)} msgs`) : null),
              item.byClient && !showHourly
                ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '2px 8px', fontSize: 'var(--tu-fs-2xs)', borderTop: '1px solid ' + C.border, paddingTop: 3 } },
                    ...Object.entries(item.byClient)
                      .filter(([cn]) => !hiddenSet.has(cn))
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 4)
                      .map(([cn, cv]) => h('span', { key: cn, className: 'tu-num' }, dot(clientColorMap.get(cn) || colorForAgent(cn)), `${cn} ${compact(cv)}`)))
                : null)
          : null));
    });

    const SvgTrendWorkbench = memo(function SvgTrendWorkbench({
      daily, hourly, m, meta, agentOrder, clientColorMap, monthlyProjection, hover, actions,
    }) {
      const [mode, setMode] = useState('stacked'); // 'stacked' | 'cumulative' | 'cacheHit' | 'hourly'
      const [zoom, setZoom] = useState('recent60');
      const [hiddenAgents, setHiddenAgents] = useState(() => []);
      const [boxRef, W] = useElementWidth(660);
      const rafRef = useRef(0);

      const showHourly = mode === 'hourly' && hourly.length > 0;
      const canZoom = !showHourly && daily.length > 60;
      const baseDaily = canZoom && zoom === 'recent60' ? daily.slice(-60) : daily;
      const hiddenSet = useMemo(() => new Set(hiddenAgents), [hiddenAgents]);

      const toggleHiddenAgent = name => {
        setHiddenAgents(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
      };

      const enrichedDaily = useMemo(() => {
        let cumCost = 0;
        let cumTokens = 0;
        const withVisible = baseDaily.map(d => {
          const byClientRaw = d.byClient && typeof d.byClient === 'object' ? d.byClient : null;
          let visibleTok = d.totalTokens || 0;
          let visibleRatio = 1;
          if (byClientRaw && hiddenSet.size > 0) {
            visibleTok = Object.entries(byClientRaw).reduce((s, [cn, cv]) => s + (hiddenSet.has(cn) ? 0 : (Number(cv) || 0)), 0);
            visibleRatio = (d.totalTokens || 0) > 0 ? visibleTok / d.totalTokens : 0;
          }
          const visibleCost = (Number(d.cost) || 0) * visibleRatio;
          return { ...d, visibleTokens: visibleTok, visibleCost };
        });

        return withVisible.map((d, idx) => {
          cumCost += d.visibleCost;
          cumTokens += d.visibleTokens;
          let maSum = 0, maCnt = 0;
          for (let k = Math.max(0, idx - 6); k <= idx; k++) {
            maSum += withVisible[k].visibleTokens || 0;
            maCnt++;
          }
          const promptSide = (d.input || 0) + (d.cacheRead || 0) + (d.cacheWrite || 0);
          const hitRate = promptSide > 0 ? (d.cacheRead || 0) / promptSide : 0;
          return {
            ...d,
            ma7Tokens: maCnt > 0 ? maSum / maCnt : d.visibleTokens,
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
        body = h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px 12px', color: C.muted, fontSize: 'var(--tu-fs-xs)', marginTop: 10 } },
          h('span', null, t('此筛选条件下趋势数据不可用。', 'Trend data is unavailable for this selection.')),
          Number.isFinite(m?.reasoning) && m.reasoning > 0 && !meta?.derivedFromBase
            ? h('small', null, t('点击“刷新数据”即可基于 tokscale graph 生成含推理分项的完整日趋势。', 'Refresh to generate reasoning-inclusive daily trends via tokscale graph.'))
            : null);
      } else {
        const H = 188, padL = 54, padR = 48, padT = 14, padB = 24;
        const plotW = Math.max(120, W - padL - padR);
        const plotH = H - padT - padB;

        const hasProjection = !showHourly && mode === 'cumulative' && hiddenSet.size === 0 && monthlyProjection?.projectedCost > 0 && monthlyProjection.daysInMonth > monthlyProjection.daysElapsed;
        const totalSlots = hasProjection ? Math.max(nPts + 1, monthlyProjection.daysInMonth) : nPts;
        const slotW = plotW / totalSlots;
        const xAt = i => padL + (i + 0.5) * slotW;
        const barW = Math.min(30, Math.max(3.5, slotW * 0.66));

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

        const maxDailyCost = !showHourly && mode === 'stacked' ? Math.max(...enrichedDaily.map(d => d.visibleCost || 0), 0) : 0;
        const costAxis = maxDailyCost > 0 ? niceAxis(maxDailyCost, 4) : null;
        const yCostAt = v => padT + plotH - Math.max(0, Math.min(1, v / (costAxis?.max || 1))) * plotH;

        const toPathD = (arr, yGetter) => arr.length >= 2
          ? 'M ' + arr.map((d, i) => `${xAt(i).toFixed(1)} ${yGetter(d).toFixed(1)}`).join(' L ')
          : '';

        const costPathD = !showHourly && mode === 'stacked' && costAxis ? toPathD(enrichedDaily, d => yCostAt(d.visibleCost || 0)) : '';
        const maPathD = !showHourly && mode === 'stacked' && nPts >= 3 ? toPathD(enrichedDaily, d => yAt(d.ma7Tokens || 0)) : '';
        const cumPathD = !showHourly && mode === 'cumulative' ? toPathD(enrichedDaily, d => yAt(d.cumCost || 0)) : '';
        const cumAreaD = !showHourly && mode === 'cumulative' && nPts >= 1
          ? `M ${xAt(0).toFixed(1)} ${(padT + plotH).toFixed(1)} L ` +
            enrichedDaily.map((d, i) => `${xAt(i).toFixed(1)} ${yAt(d.cumCost || 0).toFixed(1)}`).join(' L ') +
            ` L ${xAt(nPts - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
          : '';
        const projPathD = hasProjection && nPts >= 1
          ? `M ${xAt(nPts - 1).toFixed(1)} ${yAt(enrichedDaily[nPts - 1].cumCost || 0).toFixed(1)} L ${xAt(totalSlots - 1).toFixed(1)} ${yAt(monthlyProjection.projectedCost).toFixed(1)}`
          : '';
        const hitPathD = !showHourly && mode === 'cacheHit' ? toPathD(enrichedDaily, d => yAt(d.hitRate || 0)) : '';
        const hitAreaD = !showHourly && mode === 'cacheHit' && nPts >= 1
          ? `M ${xAt(0).toFixed(1)} ${(padT + plotH).toFixed(1)} L ` +
            enrichedDaily.map((d, i) => `${xAt(i).toFixed(1)} ${yAt(d.hitRate || 0).toFixed(1)}`).join(' L ') +
            ` L ${xAt(nPts - 1).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
          : '';
        const hourlyPathD = showHourly ? toPathD(chartItems, d => yAt(d.totalTokens || 0)) : '';

        const xTickIndices = (() => {
          if (nPts <= 7) return chartItems.map((_, i) => i);
          if (showHourly && nPts === 24) return [0, 4, 8, 12, 16, 20, 23];
          const step = Math.max(1, Math.floor((nPts - 1) / 5));
          const list = [];
          for (let i = 0; i < nPts; i += step) list.push(i);
          if (list[list.length - 1] !== nPts - 1) list.push(nPts - 1);
          return list;
        })();

        const handlePointerMove = e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const rawIdx = Math.floor((e.clientX - rect.left - padL) / slotW);
          if (rafRef.current) return;
          const commit = () => {
            rafRef.current = 0;
            const idx = rawIdx >= 0 && rawIdx < nPts ? rawIdx : null;
            hover.set({ idx, date: idx != null ? (chartItems[idx]?.date || null) : null });
          };
          if (typeof requestAnimationFrame === 'function') rafRef.current = requestAnimationFrame(commit);
          else commit();
        };

        const handlePointerClick = e => {
          if (showHourly) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const idx = Math.floor((e.clientX - rect.left - padL) / slotW);
          if (idx >= 0 && idx < nPts && chartItems[idx]?.date) {
            actions.pickDate(chartItems[idx].date);
          }
        };

        const handleSvgKeyDown = e => {
          const cur = hover.get().idx;
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            const next = cur == null ? 0 : Math.min(nPts - 1, cur + 1);
            hover.set({ idx: next, date: chartItems[next]?.date || null });
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const next = cur == null ? nPts - 1 : Math.max(0, cur - 1);
            hover.set({ idx: next, date: chartItems[next]?.date || null });
          } else if ((e.key === 'Enter' || e.key === ' ') && cur != null && chartItems[cur]?.date) {
            e.preventDefault();
            actions.pickDate(chartItems[cur].date);
          }
        };

        body = h('div', {
          ref: boxRef,
          style: { position: 'relative', marginTop: 8, '--pt': `${padT}px`, '--pb': `${padB}px` },
          onMouseLeave: () => hover.set({ idx: null, date: null }),
        },
        h(TrendHoverLayer, { hover, chartItems, xAt, W, mode, showHourly, hiddenSet, clientColorMap }),
        h('svg', {
          width: W,
          height: H,
          viewBox: `0 0 ${W} ${H}`,
          tabIndex: 0,
          'aria-label': showHourly ? t('24h 分时段趋势图', '24h hourly chart') : t('每日用量趋势图', 'Daily usage trend chart'),
          onKeyDown: handleSvgKeyDown,
          style: { width: '100%', height: H, display: 'block', overflow: 'visible' },
        },
        // Crisp 1:1 pixel horizontal gridlines & Y-axis labels
        ...[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const y = crisp(padT + (1 - frac) * plotH);
          const val = yAxis.max * frac;
          const leftLabel = mode === 'cumulative'
            ? shortCost(val)
            : mode === 'cacheHit'
              ? `${Math.round(val * 100)}%`
              : compact(val);
          const rightLabel = costAxis ? shortCost(costAxis.max * frac) : null;
          return h('g', { key: frac },
            h('line', { x1: padL, y1: y, x2: W - padR, y2: y, stroke: C.border, strokeDasharray: frac === 0 ? undefined : '2 3', strokeWidth: 1 }),
            h('text', { x: padL - 7, y: y + 4, textAnchor: 'end', fill: C.muted, fontSize: 11, className: 'tu-num' }, leftLabel),
            rightLabel ? h('text', { x: W - padR + 7, y: y + 4, textAnchor: 'start', fill: ink('#d97706', 70), fontSize: 11, className: 'tu-num' }, rightLabel) : null);
        }),

        // Mode 1 / 4: Stacked Agent bars or Hourly bars
        (mode === 'stacked' || showHourly)
          ? h('g', { key: `${mode}-${zoom}-${nPts}` },
              ...chartItems.map((d, i) => {
                const cx = xAt(i);
                const bx = cx - barW / 2;
                const lbl = String(d.date || d.hour || '');
                const rawTok = showHourly ? (d.totalTokens || 0) : (d.visibleTokens || 0);
                const titleText = `${lbl}: ${num(d.totalTokens)}` + (Number.isFinite(d.cost) && d.cost > 0 ? ` · ${cost(d.cost)}` : '');

                if (!showHourly && d.byClient && Object.keys(d.byClient).length > 0 && rawTok > 0) {
                  const totalBarH = Math.min(plotH, Math.max(2, (rawTok / (yAxis.max || 1)) * plotH));
                  let yBottom = padT + plotH;
                  const orderedClients = [
                    ...agentOrder.filter(cn => d.byClient[cn] > 0 && !hiddenSet.has(cn)),
                    ...Object.keys(d.byClient).filter(cn => !agentOrder.includes(cn) && d.byClient[cn] > 0 && !hiddenSet.has(cn)),
                  ];
                  return h('g', { key: lbl || i, className: 'tu-bar-col', title: titleText, style: { '--i': i } },
                    h('title', null, titleText),
                    ...orderedClients.map(cn => {
                      const segTok = d.byClient[cn] || 0;
                      const segH = (segTok / rawTok) * totalBarH;
                      yBottom -= segH;
                      return h('rect', {
                        key: cn,
                        className: 'tu-bar',
                        'data-agent-tone': cn,
                        x: bx,
                        y: yBottom,
                        width: barW,
                        height: Math.max(0.8, segH),
                        rx: 1.5,
                        fill: clientColorMap.get(cn) || colorForAgent(cn),
                        fillOpacity: 0.92,
                        style: { y: `${yBottom.toFixed(1)}px`, height: `${Math.max(0.8, segH).toFixed(1)}px` },
                      });
                    }));
                }

                const barH = rawTok > 0 ? Math.min(plotH, Math.max(2, (rawTok / (yAxis.max || 1)) * plotH)) : 0;
                const by = padT + plotH - barH;
                return h('g', { key: lbl || i, className: 'tu-bar-col', title: titleText, style: { '--i': i } },
                  h('title', null, titleText),
                  barH > 0
                    ? h('rect', {
                        className: 'tu-bar',
                        x: bx,
                        y: by,
                        width: barW,
                        height: barH,
                        rx: 2,
                        fill: showHourly ? '#0d9488' : C.accent,
                        fillOpacity: 0.88,
                        style: { y: `${by.toFixed(1)}px`, height: `${barH.toFixed(1)}px` },
                      })
                    : null);
              }))
          : null,

        // Mode 2: Cumulative Spend + EOM Projection
        mode === 'cumulative' && !showHourly
          ? h('g', { className: 'tu-enter' },
              cumAreaD ? h('path', { d: cumAreaD, fill: '#10b981', fillOpacity: 0.15 }) : null,
              cumPathD ? h('path', { d: cumPathD, fill: 'none', stroke: '#10b981', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }) : null,
              ...enrichedDaily.map(d => h('circle', {
                key: d.date,
                cx: xAt(enrichedDaily.indexOf(d)),
                cy: yAt(d.cumCost || 0),
                r: 2.8,
                fill: '#10b981',
              }, h('title', null, `${d.date}: ${cost(d.cumCost)}`))),
              projPathD
                ? h('g', null,
                    h('path', { d: projPathD, fill: 'none', stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '5 4' }),
                    h('circle', { cx: xAt(totalSlots - 1), cy: yAt(monthlyProjection.projectedCost), r: 4, fill: '#f59e0b' }),
                    h('text', { x: xAt(totalSlots - 1) - 6, y: Math.max(padT + 11, yAt(monthlyProjection.projectedCost) - 6), textAnchor: 'end', fill: ink('#d97706', 74), fontSize: 11, fontWeight: 600, className: 'tu-num' },
                      `${t('月底预测', 'EOM')} ${shortCost(monthlyProjection.projectedCost)}`))
                : null)
          : null,

        // Mode 3: Daily Cache Hit Rate Curve
        mode === 'cacheHit' && !showHourly
          ? h('g', { className: 'tu-enter' },
              hitAreaD ? h('path', { d: hitAreaD, fill: TOKEN_COLORS.cacheRead, fillOpacity: 0.14 }) : null,
              hitPathD ? h('path', { d: hitPathD, fill: 'none', stroke: TOKEN_COLORS.cacheRead, strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }) : null,
              ...enrichedDaily.map((d, i) => h('circle', {
                key: d.date,
                cx: xAt(i),
                cy: yAt(d.hitRate || 0),
                r: 2.8,
                fill: TOKEN_COLORS.cacheRead,
              }, h('title', null, `${d.date}: ${pct(d.hitRate)}`))))
          : null,

        // Overlay curves
        maPathD ? h('path', { d: maPathD, fill: 'none', stroke: C.muted, strokeWidth: 1.5, strokeDasharray: '4 3', pointerEvents: 'none' }) : null,
        costPathD ? h('path', { d: costPathD, fill: 'none', stroke: '#f59e0b', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', pointerEvents: 'none' }) : null,
        hourlyPathD ? h('path', { d: hourlyPathD, fill: 'none', stroke: '#06b6d4', strokeWidth: 1.8, pointerEvents: 'none' }) : null,

        // Single unified pointer hit-surface (eliminates 60 individual mouseenter listeners!)
        h('rect', {
          x: padL,
          y: padT,
          width: plotW,
          height: plotH,
          fill: 'transparent',
          style: { cursor: showHourly ? 'crosshair' : 'pointer' },
          onPointerMove: handlePointerMove,
          onClick: handlePointerClick,
        }),

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
            fontSize: 11,
            className: 'tu-num',
          }, raw);
        })),

        // Interactive Legend Bar
        !showHourly && mode === 'stacked'
          ? h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6, fontSize: 'var(--tu-fs-xs)', color: C.muted } },
              h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' } },
                ...agentOrder.slice(0, 6).map(cn => {
                  const off = hiddenSet.has(cn);
                  const col = clientColorMap.get(cn) || colorForAgent(cn);
                  return h('button', {
                    key: cn,
                    type: 'button',
                    className: 'tu-btn',
                    title: t('点击显隐该 Agent 序列', 'Click to toggle series visibility'),
                    onMouseEnter: () => hover.set({ agent: cn }),
                    onMouseLeave: () => hover.set({ agent: null }),
                    onClick: () => toggleHiddenAgent(cn),
                    style: {
                      padding: '2px 8px',
                      borderRadius: 999,
                      opacity: off ? 0.45 : 1,
                      textDecoration: off ? 'line-through' : 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                    },
                  }, dot(col), cn);
                })),
              h('div', { style: { display: 'flex', gap: 10, alignItems: 'center' } },
                maPathD ? h('span', null, '┄ ', t('7日均线', '7d MA')) : null,
                costPathD ? h('span', { style: { color: ink('#d97706', 72) } }, '━ ', t('日费用 (右轴)', 'Daily cost (R)')) : null))
          : null);
      }

      const modeOptions = [
        ['stacked', t('Agent堆叠', 'Stacked')],
        ['cumulative', t('累计&预测', 'Cumulative')],
        ['cacheHit', t('缓存率%', 'Cache %')],
        ...(hourly.length ? [['hourly', t('24h时段', '24h')]] : []),
      ];

      return h('section', { className: 'tu-card tu-bento-card' },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            h('strong', null, showHourly ? t('24h 分时段活跃分布', '24h hourly distribution') : t('每日用量与费用趋势', 'Daily usage & spend trend')),
            showHourly
              ? h('span', { style: { fontSize: 'var(--tu-fs-2xs)', color: C.muted, padding: '1px 7px', borderRadius: 999, border: '1px solid ' + C.border } },
                  t('快引擎 00:00–23:00 聚合', 'Fast engines 00:00–23:00'))
              : meta?.trendScope === 'last60d'
                ? h('span', { style: { fontSize: 'var(--tu-fs-2xs)', color: C.muted, padding: '1px 7px', borderRadius: 999, border: '1px solid ' + C.border } }, t('近 60 天明细', 'Last 60d'))
                : null,
            canZoom
              ? h('button', {
                  type: 'button',
                  className: 'tu-btn',
                  'aria-pressed': zoom === 'all',
                  onClick: () => setZoom(z => z === 'recent60' ? 'all' : 'recent60'),
                  style: { padding: '2px 8px', borderRadius: 999 },
                }, zoom === 'recent60' ? t(`展开全历史 (${daily.length}天)`, `All ${daily.length}d`) : t('聚焦近 60 天', 'Recent 60d'))
              : null),
          h(Segmented, { options: modeOptions, value: mode, onChange: setMode, ariaLabel: t('趋势视图模式', 'Trend view mode') })),
        body);
    });

    const ActivityHeatmap = memo(function ActivityHeatmap({ heatmap, weekdayProfile, selectedDay, hover, actions }) {
      const linkedDate = useHoverSelector(hover, s => s.date);
      const wdLabels = [t('一', 'Mon'), t('二', 'Tue'), t('三', 'Wed'), t('四', 'Thu'), t('五', 'Fri'), t('六', 'Sat'), t('日', 'Sun')];
      const maxWdAvg = weekdayProfile.reduce((mx, w) => Math.max(mx, w.avgTokens || 0), 1);

      const leadEmpty = useMemo(() => {
        if (!heatmap.length || !heatmap[0]?.date) return 0;
        const d = new Date(heatmap[0].date + 'T00:00:00');
        return Number.isNaN(d.getTime()) ? 0 : (d.getDay() + 6) % 7;
      }, [heatmap]);

      const activeHover = linkedDate ? heatmap.find(c => c.date === linkedDate) : null;

      return h('section', {
        className: 'tu-card',
        style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
      },
      h('div', null,
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, minHeight: 20 } },
          h('div', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
            h('strong', null, t('8 周活动热力图', '8-week activity')),
            h('span', { className: 'tu-num', style: { fontSize: 'var(--tu-fs-xs)', color: C.muted, marginLeft: 8 } },
              activeHover
                ? `${activeHover.date} · ${compact(activeHover.tokens)} · ${shortCost(activeHover.cost)}`
                : t('点击格子按单日下钻', 'Click day to filter'))),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--tu-fs-xs)', color: C.muted, flexShrink: 0 } },
            t('少', 'Less'),
            ...HEAT_COLORS.map((bg, idx) => h('span', { key: idx, style: { width: 10, height: 10, borderRadius: 2, background: bg, display: 'inline-block' } })),
            t('多', 'More'))),
        heatmap.length
          ? h('div', {
              className: 'tu-heat-wrap',
              onMouseLeave: () => hover.set({ date: null }),
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
                const isLinked = !isSel && linkedDate === cellItem.date;
                return h('button', {
                  key: cellItem.date,
                  type: 'button',
                  'aria-pressed': isSel,
                  'aria-label': `${cellItem.date}: ${compact(cellItem.tokens)}`,
                  className: 'tu-heat-cell' + (isSel ? ' selected' : '') + (isLinked ? ' linked' : ''),
                  title: `${cellItem.date}: ${compact(cellItem.tokens)} (${num(cellItem.tokens)}) · ${cost(cellItem.cost)} · ${cellItem.messages} msgs`,
                  style: { background: HEAT_COLORS[Math.min(4, Math.max(0, cellItem.intensity || 0))] },
                  onMouseEnter: () => hover.set({ date: cellItem.date }),
                  onClick: () => actions.toggleDay(cellItem.date, isSel),
                });
              })))
          : h('p', { style: { color: C.muted, fontSize: 'var(--tu-fs-xs)', margin: '20px 0' } }, t('热力图等待首轮 graph 扫描完成后生成。', 'Activity heatmap populates after the initial graph scan.'))),
      weekdayProfile.some(w => w.avgTokens > 0)
        ? h('div', { style: { marginTop: 10, paddingTop: 9, borderTop: '1px solid ' + C.border } },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 'var(--tu-fs-xs)', color: C.muted, marginBottom: 6 } },
              h('span', null, t('周内日均活跃节律', 'Weekday avg rhythm')),
              h('span', null, t('峰值: 周', 'Peak: ') + wdLabels[weekdayProfile.reduce((bi, w, i, arr) => (w.avgTokens > arr[bi].avgTokens ? i : bi), 0)])),
            h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, alignItems: 'end', height: 40 } },
              ...weekdayProfile.map((w, wi) => {
                const hPct = Math.max(10, (w.avgTokens / maxWdAvg) * 100);
                const isPeak = w.avgTokens === maxWdAvg;
                return h('div', {
                  key: wi,
                  title: `${wdLabels[wi]}: avg ${compact(w.avgTokens)} (${w.activeDays} active d)`,
                  style: { display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 3 },
                },
                h('div', { style: { width: '100%', height: `${hPct}%`, background: isPeak ? C.accent : C.accentSoft, border: '1px solid ' + (isPeak ? 'transparent' : C.border), borderRadius: 4, transition: 'height var(--tu-d3) var(--tu-ease)' } }),
                h('span', { style: { fontSize: 'var(--tu-fs-xs)', color: C.muted, lineHeight: 1 } }, wdLabels[wi]));
              })))
        : null);
    });

    const TokenComposition = memo(function TokenComposition({ m, execProfile }) {
      // Order 2x2 pairs + full-width Cache Read tile so all 5 categories form a flush hole-free Bento block
      const categories = [
        [t('输入', 'Input'), m.input, TOKEN_COLORS.input, false],
        [t('输出', 'Output'), m.output, TOKEN_COLORS.output, false],
        [t('推理', 'Reasoning'), m.reasoning, TOKEN_COLORS.reasoning, false],
        [t('缓存写入', 'Cache write'), m.cacheWrite, TOKEN_COLORS.cacheWrite, false],
        [t('缓存读取', 'Cache read'), m.cacheRead, TOKEN_COLORS.cacheRead, true],
      ];
      const valid = categories.every(([, v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0);
      const total = valid ? categories.reduce((s, [, v]) => s + v, 0) : 0;
      const ob = execProfile?.outputBreakdown;
      const obTotal = ob ? (ob.answerTokens || 0) + (ob.reasoningTokens || 0) + (ob.toolCallTokens || 0) : 0;

      let content = h('p', { style: { color: C.muted, fontSize: 'var(--tu-fs-xs)' } }, t('此筛选条件下分类构成不可用。', 'Token composition is unavailable for this selection.'));
      if (valid && total > 0) {
        content = h('div', { style: { display: 'grid', gap: 9, marginTop: 10, flex: 1, alignContent: 'space-between' } },
          h('div', { 'aria-hidden': true, style: { display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: C.panel2, gap: 2 } },
            ...categories.map(([name, val, col]) => val > 0
              ? h('div', { key: name, title: `${name}: ${compact(val)} (${pct(val / total)})`, style: { width: `${Math.max(1.2, (val / total) * 100)}%`, background: col, borderRadius: 2, transition: 'width var(--tu-d3) var(--tu-ease)' } })
              : null)),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 } },
            ...categories.map(([name, val, col, spanFull]) => {
              const shareStr = val > 0 && val / total < 0.001 ? '<0.1%' : pct(val / total);
              return h('div', {
                key: name,
                title: `${name}: ${num(val)}`,
                style: {
                  gridColumn: spanFull ? '1 / -1' : undefined,
                  borderLeft: '3px solid ' + col,
                  background: C.bg,
                  borderRadius: 6,
                  padding: spanFull ? '6px 10px' : '5px 8px',
                  display: spanFull ? 'flex' : 'grid',
                  justifyContent: spanFull ? 'space-between' : undefined,
                  alignItems: spanFull ? 'baseline' : undefined,
                  gap: 2,
                  minWidth: 0,
                },
              },
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, fontSize: 'var(--tu-fs-xs)', color: C.muted } },
                h('span', null, name),
                !spanFull ? h('span', { className: 'tu-num' }, shareStr) : null),
              h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 6 } },
                h('strong', { className: 'tu-num', style: { fontSize: 13.5, fontWeight: 650 } }, compact(val)),
                spanFull ? h('span', { className: 'tu-num', style: { fontSize: 'var(--tu-fs-xs)', color: C.muted } }, shareStr) : null));
            })),
          obTotal > 0
            ? h('div', { style: { paddingTop: 8, borderTop: '1px solid ' + C.border, display: 'grid', gap: 5 } },
                h('div', { style: { fontSize: 'var(--tu-fs-xs)', color: C.muted, display: 'flex', justifyContent: 'space-between' } },
                  h('span', null, t('DSH 生成端细分', 'DSH generation split')),
                  h('span', { className: 'tu-num' }, compact(obTotal) + ' out')),
                h('div', { style: { display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', gap: 1, background: C.panel2 } },
                  ...[
                    [ob.answerTokens, TOKEN_COLORS.output],
                    [ob.reasoningTokens, TOKEN_COLORS.reasoning],
                    [ob.toolCallTokens, TOKEN_COLORS.input],
                  ].map(([v, c], oi) => v > 0 ? h('div', { key: oi, style: { width: `${(v / obTotal) * 100}%`, background: c } }) : null)),
                h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 'var(--tu-fs-xs)', color: C.muted } },
                  h('span', { className: 'tu-num' }, dot(TOKEN_COLORS.output), t('正文 ', 'Ans ') + compact(ob.answerTokens)),
                  h('span', { className: 'tu-num' }, dot(TOKEN_COLORS.reasoning), t('思考 ', 'Reas ') + compact(ob.reasoningTokens)),
                  h('span', { className: 'tu-num' }, dot(TOKEN_COLORS.input), t('工具调用 ', 'Calls ') + compact(ob.toolCallTokens))))
            : null);
      }

      return h('section', { className: 'tu-card tu-bento-card', style: { justifyContent: 'flex-start' } },
        h('strong', null, t('Token 构成', 'Token composition')),
        content);
    });

    const SvgAgentDonut = memo(function SvgAgentDonut({
      comparison, hasMultiFamily, groupFamily, setGroupFamily, clientFilter, catalogClients,
      clientColorMap, hover, actions,
    }) {
      const hoveredAgent = useHoverSelector(hover, s => s.agent);
      const agentTotal = comparison.reduce((s, it) => s + (Number.isFinite(it.tokens) && it.tokens > 0 ? it.tokens : 0), 0);
      const maxAgentTok = comparison.reduce((mx, it) => Math.max(mx, Number.isFinite(it.tokens) ? it.tokens : 0), 1);
      const R = 42;
      const CIRC = 2 * Math.PI * R;

      let body = h('p', { style: { color: C.muted, fontSize: 'var(--tu-fs-xs)' } }, t('没有可用的明细。', 'No breakdown is available.'));
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

        const focused = hoveredAgent ? comparison.find(c => c.name === hoveredAgent) : null;
        const centerPrimary = focused ? focused.name : `${comparison.length} Agent`;
        const centerSub = focused && agentTotal > 0 && Number.isFinite(focused.tokens)
          ? pct(focused.tokens / agentTotal)
          : (agentTotal > 0 && Number.isFinite(comparison[0]?.tokens) ? pct(comparison[0].tokens / agentTotal) : '');

        body = h('div', {
          style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 12 },
          onMouseLeave: () => hover.set({ agent: null }),
        },
        arcs.length
          ? h('div', { style: { position: 'relative', width: 112, height: 112, flex: '0 0 112px', display: 'grid', placeItems: 'center' } },
              h('svg', { width: 112, height: 112, viewBox: '0 0 112 112', 'aria-hidden': true },
                h('circle', { cx: 56, cy: 56, r: R, fill: 'none', stroke: C.panel2, strokeWidth: 16 }),
                ...arcs.map(a => {
                  const isHovered = hoveredAgent === a.item.name;
                  const len = Math.max(0.5, a.ratio * CIRC - (arcs.length > 1 ? 1.5 : 0));
                  const dash = `${len.toFixed(2)} ${CIRC.toFixed(2)}`;
                  const offset = `${(-a.start * CIRC).toFixed(2)}`;
                  return h('circle', {
                    key: a.item.name,
                    className: 'tu-arc',
                    'data-agent-tone': a.item.name,
                    cx: 56,
                    cy: 56,
                    r: R,
                    fill: 'none',
                    stroke: a.col,
                    strokeWidth: isHovered ? 19 : 16,
                    strokeDasharray: dash,
                    strokeDashoffset: offset,
                    transform: 'rotate(-90 56 56)',
                    style: { cursor: 'pointer', strokeDasharray: dash, strokeDashoffset: offset },
                    onMouseEnter: () => hover.set({ agent: a.item.name }),
                    onClick: () => actions.pickClient(a.item.name),
                  });
                })),
              h('div', { style: { position: 'absolute', inset: 22, display: 'grid', placeItems: 'center', alignContent: 'center', textAlign: 'center', pointerEvents: 'none', lineHeight: 1.2 } },
                h('strong', { style: { fontSize: 'var(--tu-fs-xs)', maxWidth: 68, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, centerPrimary),
                centerSub ? h('span', { className: 'tu-num', style: { fontSize: 'var(--tu-fs-2xs)', color: C.muted } }, centerSub) : null))
          : null,
        h('div', { style: { display: 'grid', gap: 5, flex: 1, minWidth: 185 } },
          ...comparison.map(item => {
            const color = clientColorMap.get(item.name) || colorForAgent(item.name);
            const share = agentTotal > 0 && Number.isFinite(item.tokens) ? item.tokens / agentTotal : null;
            const barW = Number.isFinite(item.tokens) && maxAgentTok > 0 ? Math.max(2, (item.tokens / maxAgentTok) * 100) : 0;
            const pickTarget = groupFamily && item.members?.size === 1 ? [...item.members][0] : item.name;
            const canPick = !groupFamily || item.members?.size === 1 || catalogClients.includes(item.name);
            return h('button', {
              key: item.name,
              type: 'button',
              disabled: !canPick,
              className: 'tu-row-btn',
              title: `${item.name}: ${num(item.tokens)} tokens · ${cost(item.cost)}` + (Number.isFinite(item.throughput) ? ` · ${tpsFmt(item.throughput)}` : ''),
              onMouseEnter: () => hover.set({ agent: item.name }),
              onClick: canPick ? () => actions.pickClient(pickTarget) : undefined,
              style: {
                background: barW > 0 ? `linear-gradient(to right, ${soft(color, 16)} ${barW.toFixed(1)}%, transparent ${barW.toFixed(1)}%)` : undefined,
              },
            },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 'var(--tu-fs-xs)' } },
              h('span', { style: { overflowWrap: 'anywhere', minWidth: 0, fontWeight: 500 } },
                dot(color),
                item.name,
                groupFamily && item.members?.size > 1 ? h('small', { style: { color: C.muted, marginLeft: 4 } }, `×${item.members.size}`) : null),
              h('span', { className: 'tu-num' },
                h('strong', { title: num(item.tokens) }, compact(item.tokens)),
                h('small', { style: { color: C.muted, marginLeft: 6 } }, cost(item.cost)),
                share != null ? h('small', { style: { color: C.muted, marginLeft: 5 } }, share > 0 && share < 0.001 ? '<0.1%' : pct(share)) : null,
                Number.isFinite(item.throughput) ? h('small', { style: { color: ink('#087e75', 70), marginLeft: 5 } }, item.throughput.toFixed(0) + 't/s') : null)));
          })));
      }

      return h('section', { className: 'tu-card tu-bento-card', style: { justifyContent: 'flex-start' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
          h('strong', null, t('Agent 用量对比', 'Agent usage comparison')),
          h('div', { style: { display: 'flex', gap: 4 } },
            hasMultiFamily
              ? h('button', {
                  type: 'button',
                  className: 'tu-btn',
                  'aria-pressed': groupFamily,
                  style: { padding: '2px 8px' },
                  onClick: () => setGroupFamily(v => !v),
                }, groupFamily ? t('已合并同系', 'Grouped') : t('合并同系', 'Group family'))
              : null,
            clientFilter !== 'all'
              ? h('button', { type: 'button', className: 'tu-btn', style: { padding: '2px 8px' }, onClick: () => actions.pickClient('all') }, t('显示全部', 'Show all'))
              : null)),
        body);
    });

    const MODEL_RING_PALETTE = ['#6366f1', '#10b981', '#0ea5e9', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#64748b'];

    const ModelRanking = memo(function ModelRanking({ models, rankBy, setRankBy, modelFilter, actions }) {
      const [expanded, setExpanded] = useState(false);
      const [hoveredModel, setHoveredModel] = useState(null);

      // Assign stable color per model based on baseline token order so colors stay consistent when switching tabs
      const modelColorMap = useMemo(() => {
        const map = new Map();
        models.forEach((mItem, idx) => {
          map.set(mItem.name, MODEL_RING_PALETTE[idx % MODEL_RING_PALETTE.length]);
        });
        return map;
      }, [models]);

      const valOf = it => {
        if (rankBy === 'cost') return it.cost;
        if (rankBy === 'unit') return it.unitCost;
        if (rankBy === 'tps') return it.throughput;
        return it.tokens;
      };
      const isAdditive = rankBy === 'tokens' || rankBy === 'cost';
      const sorted = useMemo(() => [...models].sort((a, b) => (valOf(b) ?? -1) - (valOf(a) ?? -1)), [models, rankBy]);
      const maximum = sorted.reduce((mx, it) => Math.max(mx, Number.isFinite(valOf(it)) && valOf(it) > 0 ? valOf(it) : 0), 1e-6);
      const totalAdditive = isAdditive
        ? sorted.reduce((s, it) => s + (Number.isFinite(valOf(it)) && valOf(it) > 0 ? valOf(it) : 0), 0)
        : 0;
      const visible = expanded ? sorted : sorted.slice(0, 6);

      const rankOptions = [
        ['tokens', t('用量', 'Tok')],
        ['cost', t('费用', 'Cost')],
        ['unit', t('$/1M', '$/1M')],
        ['tps', t('吞吐', 'tok/s')],
      ];

      const fmtVal = it => {
        if (!it) return '—';
        if (rankBy === 'cost') return shortCost(it.cost);
        if (rankBy === 'unit') return unitPriceFmt(it.unitCost);
        if (rankBy === 'tps') return Number.isFinite(it.throughput) ? `${Math.round(it.throughput)}t/s` : '—';
        return compact(it.tokens);
      };

      // Build SVG ring visual (360° segmented share donut for Tok/Cost; concentric 270° radial gauges for $/1M & tok/s)
      const ringNode = (() => {
        if (!sorted.length) return null;
        const focused = hoveredModel ? sorted.find(mItem => mItem.name === hoveredModel) : null;

        if (isAdditive && totalAdditive > 0) {
          const R = 42;
          const CIRC = 2 * Math.PI * R;
          const headSlices = sorted.slice(0, 6);
          const tailSum = sorted.slice(6).reduce((s, it) => s + (Number.isFinite(valOf(it)) && valOf(it) > 0 ? valOf(it) : 0), 0);
          const rawSlices = [
            ...headSlices.map(it => ({ name: it.name, val: Math.max(0, valOf(it) || 0), col: modelColorMap.get(it.name) || MODEL_RING_PALETTE[0], clickable: true })),
            ...(tailSum > 0 ? [{ name: t('其他', 'Other'), val: tailSum, col: '#94a3b8', clickable: false }] : []),
          ].filter(s => s.val > 0);

          let cumRatio = 0;
          const arcs = rawSlices.map(s => {
            const ratio = s.val / totalAdditive;
            const start = cumRatio;
            cumRatio += ratio;
            return { ...s, ratio, start };
          });

          const topRatio = arcs[0]?.ratio ?? 0;
          const centerPrimary = focused ? focused.name : t(`${sorted.length} 模型`, `${sorted.length} Models`);
          const centerSub = focused
            ? pct(Math.max(0, valOf(focused) || 0) / totalAdditive)
            : (topRatio > 0 ? pct(topRatio) : '');

          return h('div', { style: { position: 'relative', width: 112, height: 112, flex: '0 0 112px', display: 'grid', placeItems: 'center' } },
            h('svg', { width: 112, height: 112, viewBox: '0 0 112 112', 'aria-hidden': true },
              h('circle', { cx: 56, cy: 56, r: R, fill: 'none', stroke: C.panel2, strokeWidth: 16 }),
              ...arcs.map(a => {
                const isHov = hoveredModel === a.name;
                const dimmed = hoveredModel && !isHov;
                const len = Math.max(0.5, a.ratio * CIRC - (arcs.length > 1 ? 1.5 : 0));
                const dash = `${len.toFixed(2)} ${CIRC.toFixed(2)}`;
                const offset = `${(-a.start * CIRC).toFixed(2)}`;
                return h('circle', {
                  key: a.name,
                  className: 'tu-arc',
                  cx: 56,
                  cy: 56,
                  r: R,
                  fill: 'none',
                  stroke: a.col,
                  strokeWidth: isHov ? 19 : 16,
                  strokeDasharray: dash,
                  strokeDashoffset: offset,
                  transform: 'rotate(-90 56 56)',
                  style: {
                    cursor: a.clickable ? 'pointer' : 'default',
                    opacity: dimmed ? 0.28 : 1,
                    strokeDasharray: dash,
                    strokeDashoffset: offset,
                  },
                  onMouseEnter: () => setHoveredModel(a.name),
                  onClick: a.clickable ? () => actions.pickModel(a.name) : undefined,
                });
              })),
            h('div', { style: { position: 'absolute', inset: 21, display: 'grid', placeItems: 'center', alignContent: 'center', textAlign: 'center', pointerEvents: 'none', lineHeight: 1.2 } },
              h('strong', { style: { fontSize: 'var(--tu-fs-xs)', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, centerPrimary),
              centerSub ? h('span', { className: 'tu-num', style: { fontSize: 'var(--tu-fs-2xs)', color: C.muted } }, centerSub) : null));
        }

        // Rate mode ($/1M or tok/s): concentric 270° radial comparison rings for top 4 models
        const ringItems = sorted.filter(it => Number.isFinite(valOf(it)) && valOf(it) > 0).slice(0, 4);
        if (!ringItems.length) return null;
        const radii = [45, 36.5, 28, 19.5];
        const centerItem = focused || ringItems[0];

        return h('div', { style: { position: 'relative', width: 112, height: 112, flex: '0 0 112px', display: 'grid', placeItems: 'center' } },
          h('svg', { width: 112, height: 112, viewBox: '0 0 112 112', 'aria-hidden': true },
            ...ringItems.map((it, ri) => {
              const r = radii[ri];
              const circ = 2 * Math.PI * r;
              const sweep = circ * 0.75; // 270° symmetric gauge
              const ratio = Math.max(0.04, Math.min(1, (valOf(it) || 0) / maximum));
              const fillLen = ratio * sweep;
              const col = modelColorMap.get(it.name) || MODEL_RING_PALETTE[ri];
              const isHov = hoveredModel === it.name;
              const dimmed = hoveredModel && !isHov;
              const trackDash = `${sweep.toFixed(2)} ${circ.toFixed(2)}`;
              const valDash = `${fillLen.toFixed(2)} ${circ.toFixed(2)}`;
              return h('g', { key: it.name },
                h('circle', {
                  cx: 56, cy: 56, r, fill: 'none', stroke: C.panel2, strokeWidth: 5.5,
                  strokeLinecap: 'round', strokeDasharray: trackDash, transform: 'rotate(135 56 56)',
                }),
                h('circle', {
                  className: 'tu-arc',
                  cx: 56, cy: 56, r, fill: 'none', stroke: col,
                  strokeWidth: isHov ? 7 : 5.5,
                  strokeLinecap: 'round',
                  strokeDasharray: valDash,
                  transform: 'rotate(135 56 56)',
                  style: { cursor: 'pointer', opacity: dimmed ? 0.28 : 1, strokeDasharray: valDash },
                  onMouseEnter: () => setHoveredModel(it.name),
                  onClick: () => actions.pickModel(it.name),
                }));
            })),
          h('div', { style: { position: 'absolute', left: 16, right: 16, bottom: 6, textAlign: 'center', pointerEvents: 'none', lineHeight: 1.15 } },
            h('strong', { className: 'tu-num', style: { fontSize: 'var(--tu-fs-2xs)', display: 'block' } }, fmtVal(centerItem)),
            h('span', { style: { fontSize: 10, color: C.muted, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, centerItem.name)));
      })();

      return h('section', { className: 'tu-card tu-bento-card', style: { justifyContent: 'flex-start' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
            h('strong', null, t('模型比较', 'Model comparison')),
            modelFilter && modelFilter !== 'all'
              ? h('button', { type: 'button', className: 'tu-btn', style: { padding: '2px 8px' }, onClick: () => actions.pickModel('all') }, t('显示全部', 'Show all'))
              : null),
          h(Segmented, { options: rankOptions, value: rankBy, onChange: setRankBy, ariaLabel: t('模型排序维度', 'Model sort metric') })),
        visible.length
          ? h('div', {
              style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 12 },
              onMouseLeave: () => setHoveredModel(null),
            },
            ringNode,
            h('div', { style: { display: 'grid', gap: 5, flex: 1, minWidth: 200 } },
              ...visible.map((item, idx) => {
                const val = valOf(item);
                const rightPrimary = rankBy === 'cost'
                  ? shortCost(item.cost)
                  : rankBy === 'unit'
                    ? unitPriceFmt(item.unitCost)
                    : rankBy === 'tps'
                      ? tpsFmt(item.throughput)
                      : compact(item.tokens);
                const barColor = modelColorMap.get(item.name) || MODEL_RING_PALETTE[idx % MODEL_RING_PALETTE.length];
                const barW = Number.isFinite(val) && val > 0 ? Math.max(2, Math.min(100, (val / maximum) * 100)) : 0;
                const share = isAdditive && totalAdditive > 0 && Number.isFinite(val) && val > 0 ? val / totalAdditive : null;
                const dimmed = hoveredModel && hoveredModel !== item.name;
                return h('button', {
                  key: item.name,
                  type: 'button',
                  className: 'tu-row-btn',
                  title: `${item.name} (${item.primaryClient || '—'}): ${num(item.tokens)} tokens · ${cost(item.cost)} · ${unitPriceFmt(item.unitCost)}` + (Number.isFinite(item.throughput) ? ` · ${tpsFmt(item.throughput)}` : ''),
                  onMouseEnter: () => setHoveredModel(item.name),
                  onClick: () => actions.pickModel(item.name),
                  style: {
                    opacity: dimmed ? 0.45 : 1,
                    background: barW > 0 ? `linear-gradient(to right, ${soft(barColor, 16)} ${barW.toFixed(1)}%, transparent ${barW.toFixed(1)}%)` : undefined,
                  },
                },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 'var(--tu-fs-xs)' } },
                  h('span', { style: { minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 4, overflow: 'hidden' } },
                    dot(barColor),
                    h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 } }, item.name),
                    item.reasoningShare > 0.2
                      ? h('span', { style: { fontSize: 'var(--tu-fs-2xs)', padding: '0 5px', borderRadius: 999, background: soft(TOKEN_COLORS.reasoning, 15), color: ink(TOKEN_COLORS.reasoning, 72), flexShrink: 0 } },
                          t(`思 ${Math.round(item.reasoningShare * 100)}%`, `R ${Math.round(item.reasoningShare * 100)}%`))
                      : null),
                  h('span', { className: 'tu-num', style: { flexShrink: 0 } },
                    h('strong', null, rightPrimary),
                    rankBy === 'tokens' && Number.isFinite(item.cost) && item.cost > 0 ? h('small', { style: { color: C.muted, marginLeft: 5 } }, shortCost(item.cost)) : null,
                    rankBy === 'cost' ? h('small', { style: { color: C.muted, marginLeft: 5 } }, compact(item.tokens)) : null,
                    share != null ? h('small', { style: { color: C.muted, marginLeft: 5 } }, share < 0.001 ? '<0.1%' : pct(share)) : null,
                    !isAdditive && rankBy !== 'unit' && Number.isFinite(item.unitCost) ? h('small', { style: { color: C.muted, marginLeft: 5 } }, unitPriceFmt(item.unitCost)) : null)));
              }),
              sorted.length > 6
                ? h('button', { type: 'button', className: 'tu-btn', style: { justifySelf: 'start', marginTop: 2 }, onClick: () => setExpanded(v => !v) },
                    expanded ? t('收起至前 6', 'Show top 6') : t(`展开全部 (${sorted.length})`, `Show all (${sorted.length})`))
                : null))
          : h('p', { style: { color: C.muted, fontSize: 'var(--tu-fs-xs)', marginTop: 12 } }, t('没有可用的明细。', 'No breakdown is available.')));
    });

    const QuadrantBubbleMap = memo(function QuadrantBubbleMap({ bubbleRows, clientColorMap, actions }) {
      const [yMetric, setYMetric] = useState('cost'); // 'cost' | 'unit' | 'tps'
      const [hoverRow, setHoverRow] = useState(null);
      const [boxRef, W] = useElementWidth(600);
      if (bubbleRows.length < 2) return null;

      const hasTps = bubbleRows.filter(r => Number.isFinite(r.throughput) && r.throughput > 0).length >= 2;
      const effY = yMetric === 'tps' && !hasTps ? 'cost' : yMetric;

      const H = 220, padL = 56, padR = 24, padT = 22, padB = 26;
      const plotW = Math.max(120, W - padL - padR);
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

      const medX = crisp(Math.max(padL + 36, Math.min(W - padR - 36, medianOf(bubbleRows.map(r => xCoord(r.tokens))))));
      const medY = crisp(Math.max(padT + 26, Math.min(H - padB - 26, medianOf(bubbleRows.map(r => yCoord(r))))));

      const maxMsgs = Math.max(1, ...bubbleRows.map(r => r.messages || 1));
      const placed = [];
      const xPowerTicks = [];
      for (let p = rawPowMin; p <= rawPowMax; p++) xPowerTicks.push(p);

      const qLabels = effY === 'tps'
        ? [t('低频高速', 'Low-vol fast'), t('高频高速', 'High-vol fast'), t('低频慢速', 'Low-vol slow'), t('高频主力', 'Workhorse')]
        : [t('低频重型', 'Low-vol pricey'), t('高消核心', 'Heavy flagship'), t('轻量试探', 'Light utility'), t('高频经济', 'High-vol lean')];

      const yOptions = [
        ['cost', t('总费用 $', 'Cost $')],
        ['unit', t('单价 $/1M', '$/1M')],
        ...(hasTps ? [['tps', t('吞吐 tok/s', 'tok/s')]] : []),
      ];

      return h('section', { className: 'tu-card tu-bento-card', style: { justifyContent: 'flex-start' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 } },
          h('div', { style: { minWidth: 0 } },
            h('strong', null, t('模型效能分布气泡图', 'Model efficiency map')),
            h('span', { className: 'tu-num', style: { fontSize: 'var(--tu-fs-xs)', color: C.muted, marginLeft: 8 } },
              hoverRow
                ? `${hoverRow.model} (${hoverRow.client}) · ${compact(hoverRow.tokens)} · ${shortCost(hoverRow.cost)} · ${unitPriceFmt(hoverRow.unitCost)}`
                : t('中位数四象限 · 气泡大小=消息数', 'Median quadrants · Size = messages'))),
          h(Segmented, { options: yOptions, value: effY, onChange: setYMetric, ariaLabel: t('气泡图纵轴维度', 'Bubble Y-axis metric') })),
        h('div', { ref: boxRef, onMouseLeave: () => setHoverRow(null) },
          h('svg', {
            width: W,
            height: H,
            viewBox: `0 0 ${W} ${H}`,
            style: { width: '100%', height: H, display: 'block' },
          },
          h('line', { x1: medX, y1: padT, x2: medX, y2: H - padB, stroke: C.accent, strokeOpacity: 0.38, strokeDasharray: '4 4', strokeWidth: 1 }),
          h('line', { x1: padL, y1: medY, x2: W - padR, y2: medY, stroke: C.accent, strokeOpacity: 0.38, strokeDasharray: '4 4', strokeWidth: 1 }),
          h('text', { x: padL + 6, y: padT + 13, fill: C.muted, fontSize: 12 }, qLabels[0]),
          h('text', { x: W - padR - 6, y: padT + 13, textAnchor: 'end', fill: C.muted, fontSize: 12 }, qLabels[1]),
          h('text', { x: padL + 6, y: H - padB - 6, fill: C.muted, fontSize: 12 }, qLabels[2]),
          h('text', { x: W - padR - 6, y: H - padB - 6, textAnchor: 'end', fill: C.muted, fontSize: 12 }, qLabels[3]),

          ...[0, 0.33, 0.66, 1].map((tFrac, gi) => {
            const y = crisp(padT + (1 - tFrac) * plotH);
            const valAt = effY === 'tps' ? Math.pow(10, minY + tFrac * (maxY - minY)) : Math.pow(tFrac * maxY, 2);
            const yLbl = effY === 'tps'
              ? (valAt >= 1000 ? (valAt / 1000).toFixed(1) + 'K' : Math.round(valAt)) + ' t/s'
              : effY === 'unit'
                ? `$${valAt >= 10 ? Math.round(valAt) : valAt.toFixed(1)}`
                : shortCost(valAt);
            return h('g', { key: gi },
              h('line', { x1: padL, y1: y, x2: W - padR, y2: y, stroke: C.border, strokeDasharray: '2 4', strokeWidth: 1 }),
              h('text', { x: padL - 6, y: y + 4, textAnchor: 'end', fill: C.muted, fontSize: 11, className: 'tu-num' }, yLbl));
          }),

          ...xPowerTicks.map(p => {
            const x = crisp(padL + ((p - rawPowMin) / (rawPowMax - rawPowMin)) * plotW);
            return h('g', { key: `xp-${p}` },
              h('line', { x1: x, y1: padT, x2: x, y2: H - padB, stroke: C.border, strokeDasharray: '2 5', strokeWidth: 1 }),
              h('text', { x, y: H - 6, textAnchor: 'middle', fill: C.muted, fontSize: 11, className: 'tu-num' }, compact(Math.pow(10, p))));
          }),

          ...bubbleRows.map((r, bi) => {
            const cx = xCoord(r.tokens);
            const cy = yCoord(r);
            const rad = 5.5 + Math.sqrt(Math.max(1, r.messages) / maxMsgs) * 15;
            const col = clientColorMap.get(r.client) || colorForAgent(r.client);
            const isHov = hoverRow?.model === r.model;
            const shortName = r.model.length > 16 ? r.model.slice(0, 15) + '…' : r.model;
            const ly = Math.max(12, cy - rad - 4);
            const canLabel = bi < 8 && placed.every(p => Math.abs(p.x - cx) > 68 || Math.abs(p.y - ly) > 15);
            if (canLabel) placed.push({ x: cx, y: ly });
            return h('g', {
              key: r.model,
              'data-agent-tone': r.client,
              style: { cursor: 'pointer' },
              onMouseEnter: () => setHoverRow(r),
              onClick: () => actions.pickModel(r.model),
            },
            h('title', null, `${r.model} (${r.client})\nTokens: ${compact(r.tokens)} (${num(r.tokens)})\nCost: ${cost(r.cost)} (${unitPriceFmt(r.unitCost)})\nThroughput: ${tpsFmt(r.throughput)}\nMessages: ${num(r.messages)}`),
            h('circle', { cx, cy, r: rad, fill: col, fillOpacity: isHov ? 0.72 : 0.46, stroke: col, strokeWidth: isHov ? 2.5 : 1.6 }),
            canLabel ? h('text', { x: cx, y: ly, textAnchor: 'middle', fill: C.text, fontSize: 11, fontWeight: 500 }, shortName) : null);
          }))));
    });

    const DeepWorkbench = memo(function DeepWorkbench({
      workspaces, matrixData, execProfile, workspaceFilter, setWorkspaceFilter, clientColorMap, actions,
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

      const workspaceView = (() => {
        if (!workspaces.length) {
          return h('p', { style: { color: C.muted, fontSize: 'var(--tu-fs-xs)', marginTop: 12 } }, t('当前筛选暂无项目目录归属记录。', 'No project workspace attribution in this window.'));
        }
        const wsTotal = workspaces.reduce((s, w) => s + (w.totalTokens || 0), 0) || 1;
        const wsMax = Math.max(...workspaces.map(w => w.totalTokens || 0), 1);
        return h('div', { key: 'ws', className: 'tu-enter', style: { display: 'grid', gap: 7, marginTop: 10 } },
          ...workspaces.slice(0, 7).map(w => {
            const share = (w.totalTokens || 0) / wsTotal;
            const barPct = Math.max(3, ((w.totalTokens || 0) / wsMax) * 100);
            const primaryAgent = (w.clients || [])[0] || 'dsh';
            const col = clientColorMap.get(primaryAgent) || colorForAgent(primaryAgent);
            const isSel = workspaceFilter === w.workspaceKey;
            return h('button', {
              key: w.workspaceKey,
              type: 'button',
              'aria-pressed': isSel,
              className: 'tu-ws-row',
              title: `${w.workspaceKey}\nTokens: ${compact(w.totalTokens)} (${pct(share)})` + (w.cost > 0 ? `\nEst. cost: ${cost(w.cost)}` : ''),
              onClick: () => setWorkspaceFilter(prev => prev === w.workspaceKey ? '' : w.workspaceKey),
              style: { borderColor: isSel ? C.accent : undefined, background: isSel ? C.accentSoft : C.bg },
            },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 'var(--tu-fs-xs)', width: '100%' } },
              h('span', { style: { fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                dot(col), w.label),
              h('span', { className: 'tu-num' },
                h('strong', null, compact(w.totalTokens)),
                w.cost > 0 ? h('small', { style: { color: C.muted, marginLeft: 6 } }, shortCost(w.cost)) : null,
                h('small', { style: { color: C.muted, marginLeft: 6 } }, pct(share)),
                w.taskCount > 0 ? h('small', { style: { color: C.muted, marginLeft: 5 } }, `${w.taskCount}t`) : null)),
            h('div', { style: { height: 5, borderRadius: 999, background: C.panel2, overflow: 'hidden', width: '100%' } },
              h('div', { style: { width: `${barPct.toFixed(1)}%`, height: '100%', background: col, borderRadius: 999, transition: 'width var(--tu-d3) var(--tu-ease)' } })));
          }));
      })();

      const matrixView = (() => {
        const { agents, models, cells, maxCellTokens } = matrixData;
        const cols = `minmax(96px, 1.3fr) repeat(${agents.length}, minmax(72px, 1fr))`;
        return h('div', { key: 'mx', className: 'tu-enter', style: { display: 'grid', gap: 5, marginTop: 10, overflowX: 'auto' } },
          h('div', { style: { display: 'grid', gridTemplateColumns: cols, gap: 5, fontSize: 'var(--tu-fs-xs)', color: C.muted, fontWeight: 600, paddingBottom: 3, borderBottom: '1px solid ' + C.border } },
            h('span', null, t('模型 \\ Agent', 'Model \\ Agent')),
            ...agents.map(ag => h('span', { key: ag, style: { textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
              dot(clientColorMap.get(ag) || colorForAgent(ag)), ag))),
          ...models.map(md => h('div', { key: md, style: { display: 'grid', gridTemplateColumns: cols, gap: 5, alignItems: 'center', fontSize: 'var(--tu-fs-xs)' } },
            h('span', { title: md, style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 } }, md),
            ...agents.map(ag => {
              const cell = cells.get(`${ag}\0${md}`);
              if (!cell || !(cell.tokens > 0)) {
                return h('div', { key: ag, style: { textAlign: 'right', color: C.muted, padding: '4px 6px' } }, '·');
              }
              const intensity = Math.max(10, Math.min(40, Math.round((cell.tokens / (maxCellTokens || 1)) * 40)));
              const col = clientColorMap.get(ag) || colorForAgent(ag);
              return h('button', {
                key: ag,
                type: 'button',
                className: 'tu-btn tu-num',
                title: `${ag} × ${md}\nTokens: ${num(cell.tokens)}\nCost: ${cost(cell.cost)}\nUnit: ${unitPriceFmt(cell.unitCost)}`,
                onClick: () => actions.pickAgentModel(ag, md),
                style: {
                  padding: '4px 6px',
                  textAlign: 'right',
                  background: `color-mix(in oklab, ${col} ${intensity}%, var(--tu-bg))`,
                  borderColor: `color-mix(in oklab, ${col} 34%, var(--tu-border))`,
                  display: 'grid',
                  gap: 1,
                },
              },
              h('strong', { style: { fontSize: 'var(--tu-fs-2xs)' } }, compact(cell.tokens)),
              cell.cost > 0 ? h('small', { style: { fontSize: 'var(--tu-fs-2xs)', color: C.muted } }, shortCost(cell.cost)) : null);
            }))));
      })();

      const executionView = (() => {
        if (!hasExec) {
          return h('p', { style: { color: C.muted, fontSize: 'var(--tu-fs-xs)', marginTop: 12 } }, t('当前筛选不含 DSH 细粒度阶段计时样本。', 'No DSH phase timing samples in this filter.'));
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

        return h('div', { key: 'ex', className: 'tu-enter', style: { display: 'grid', gap: 10, marginTop: 10 } },
          phases.length
            ? h('div', { style: { display: 'grid', gap: 6 } },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 'var(--tu-fs-xs)', color: C.muted } },
                  h('span', null, t('阶段耗时解剖', 'Phase timing anatomy')),
                  h('span', { className: 'tu-num' }, `${tbd.calls || 0} LLM calls · ${tbd.toolCalls || 0} tool calls`)),
                h('div', { style: { display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', gap: 1.5, background: C.panel2 } },
                  ...phases.map(([pName, ms, col]) => h('div', {
                    key: pName,
                    title: `${pName}: ${durFmt(ms)} (${pct(ms / phaseSum)})`,
                    style: { width: `${Math.max(2, (ms / phaseSum) * 100)}%`, background: col },
                  }))),
                h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px 10px', fontSize: 'var(--tu-fs-xs)' } },
                  ...phases.map(([pName, ms, col]) => h('span', { key: pName, style: { color: C.muted } },
                    dot(col), `${pName} `, h('strong', { className: 'tu-num', style: { color: C.text } }, durFmt(ms))))))
            : null,
          rankedTools.length
            ? h('div', { style: { display: 'grid', gap: 6, paddingTop: 6, borderTop: '1px solid ' + C.border } },
                ...rankedTools.slice(0, 6).map((tl, ti) => {
                  const col = FALLBACK_SERIES[ti % FALLBACK_SERIES.length];
                  return h('div', {
                    key: tl.name,
                    style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(60px, 1fr) auto', alignItems: 'center', gap: 8, fontSize: 'var(--tu-fs-xs)' },
                  },
                  h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: tl.name }, tl.name),
                  h('div', { style: { height: 6, borderRadius: 999, background: soft(col, 15), overflow: 'hidden' } },
                    h('div', { style: { width: `${Math.max(4, (tl.totalMsCalc / maxToolMs) * 100)}%`, height: '100%', background: col, borderRadius: 999 } })),
                  h('span', { className: 'tu-num', style: { color: C.muted, fontSize: 'var(--tu-fs-2xs)' } },
                    `${durFmt(tl.totalMsCalc)} (${tl.calls}×)`));
                }))
            : null);
      })();

      const titleMap = {
        workspaces: t('项目工作区消耗排行', 'Workspace usage'),
        matrix: t('Agent × 模型交叉矩阵', 'Agent × model matrix'),
        execution: t('DSH 耗时解剖与工具耗时', 'Execution & tool telemetry'),
      };
      const tabOptions = [
        ...(workspaces.length > 0 ? [['workspaces', t('项目排行', 'Workspaces')]] : []),
        ...(hasMatrix ? [['matrix', t('Agent×模型', 'Matrix')]] : []),
        ...(hasExec ? [['execution', t('耗时&工具', 'Timing & tools')]] : []),
      ];

      return h('section', { className: 'tu-card tu-bento-card', style: { justifyContent: 'flex-start' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
          h('strong', null, titleMap[effTab]),
          tabOptions.length > 1
            ? h(Segmented, { options: tabOptions, value: effTab, onChange: setTab, ariaLabel: t('深度洞察视图', 'Deep workbench view') })
            : null),
        effTab === 'workspaces' ? workspaceView : effTab === 'matrix' ? matrixView : executionView);
    });

    const TaskStream = memo(function TaskStream({ tasks, workspaceFilter, setWorkspaceFilter, clientColorMap }) {
      const [taskQuery, setTaskQuery] = useState('');
      const [taskClientFilter, setTaskClientFilter] = useState('all');
      const [taskSort, setTaskSort] = useState('tokens');
      const [showAll, setShowAll] = useState(false);
      const deferredQuery = typeof React.useDeferredValue === 'function' ? React.useDeferredValue(taskQuery) : taskQuery;

      const taskClients = useMemo(() => {
        const counts = new Map();
        for (const tk of tasks) {
          if (!tk?.client) continue;
          counts.set(tk.client, (counts.get(tk.client) || 0) + 1);
        }
        return [...counts.entries()].sort((a, b) => b[1] - a[1]);
      }, [tasks]);

      const activeClientPill = taskClientFilter !== 'all' && taskClients.some(([c]) => c === taskClientFilter) ? taskClientFilter : 'all';
      const hasTaskCost = useMemo(() => tasks.some(tk => Number.isFinite(tk?.cost) && tk.cost > 0), [tasks]);

      const filtered = useMemo(() => {
        const q = deferredQuery.trim().toLowerCase();
        return tasks
          .filter(tk => activeClientPill === 'all' || tk.client === activeClientPill)
          .filter(tk => !workspaceFilter || tk.workspaceKey === workspaceFilter)
          .filter(tk => !q || [tk.title, tk.cwd, tk.model, tk.client].some(v => String(v || '').toLowerCase().includes(q)))
          .sort((a, b) => {
            if (taskSort === 'cost') return (b.cost ?? -1) - (a.cost ?? -1) || (b.totalTokens || 0) - (a.totalTokens || 0);
            if (taskSort === 'recent') return (b.updatedAt || 0) - (a.updatedAt || 0);
            if (taskSort === 'tps') return (b.outputTps ?? -1) - (a.outputTps ?? -1);
            return (b.totalTokens || 0) - (a.totalTokens || 0);
          });
      }, [tasks, activeClientPill, workspaceFilter, deferredQuery, taskSort]);

      const visible = showAll ? filtered.slice(0, 42) : filtered.slice(0, 6);
      const maxTok = filtered.reduce((mx, tk) => Math.max(mx, tk.totalTokens || 0), 1);
      const sortOptions = [
        ['tokens', t('按用量', 'By tokens')],
        ...(hasTaskCost ? [['cost', t('按费用', 'By cost')]] : []),
        ['recent', t('按最近', 'Recent')],
        ['tps', t('按吞吐', 'By speed')],
      ];

      return h('section', { className: 'tu-card tu-tasks-sec' },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' } },
            h('strong', null, t('任务用量详情', 'Task usage')),
            h('span', { style: { fontSize: 'var(--tu-fs-xs)', color: C.muted } }, t(`共 ${filtered.length} 个关联会话任务`, `${filtered.length} matched tasks`)),
            taskClients.length > 1
              ? h('div', { style: { display: 'inline-flex', gap: 4, flexWrap: 'wrap' } },
                  h('button', {
                    type: 'button',
                    className: 'tu-btn',
                    'aria-pressed': activeClientPill === 'all',
                    style: { padding: '2px 8px', borderRadius: 999 },
                    onClick: () => setTaskClientFilter('all'),
                  }, t('全部', 'All')),
                  ...taskClients.map(([cName, cnt]) => h('button', {
                    key: cName,
                    type: 'button',
                    className: 'tu-btn',
                    'aria-pressed': activeClientPill === cName,
                    style: { padding: '2px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center' },
                    onClick: () => setTaskClientFilter(prev => prev === cName ? 'all' : cName),
                  }, dot(clientColorMap.get(cName) || colorForAgent(cName)), `${cName} (${cnt})`)))
              : null,
            workspaceFilter
              ? h('button', {
                  type: 'button',
                  className: 'tu-btn',
                  onClick: () => setWorkspaceFilter(''),
                  style: { padding: '2px 8px', borderRadius: 999, background: C.accentSoft, borderColor: C.accent },
                }, `${workspaceFilter.split('/').pop()} ×`)
              : null),
          h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' } },
            h('input', {
              type: 'search',
              value: taskQuery,
              placeholder: t('搜索任务名/项目/模型…', 'Filter tasks…'),
              onChange: e => setTaskQuery(e.target.value),
              className: 'tu-btn',
              style: { padding: '4px 9px', minWidth: 160 },
            }),
            h(Segmented, { options: sortOptions, value: taskSort, onChange: setTaskSort, ariaLabel: t('任务排序方式', 'Task sort order') }))),
        visible.length
          ? h('div', { className: 'tu-tasks' },
              ...visible.map(tk => {
                const tc = clientColorMap.get(tk.client) || colorForAgent(tk.client);
                const tPct = maxTok > 0 ? Math.max(3, Math.min(100, ((tk.totalTokens || 0) / maxTok) * 100)) : 0;
                const displayTitle = prettyTaskTitle(tk);
                return h('div', {
                  key: tk.client + ':' + tk.id,
                  className: 'tu-task-card',
                },
                h('div', { style: { display: 'grid', gap: 5 } },
                  h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 } },
                    h('div', { style: { display: 'flex', alignItems: 'center', gap: 5 } },
                      h('span', { 'data-agent-tone': tk.client, style: { fontSize: 'var(--tu-fs-2xs)', fontWeight: 650, padding: '1px 7px', borderRadius: 999, background: soft(tc, 15), color: ink(tc, 72) } }, String(tk.client || '').toUpperCase()),
                      tk.isSubagent ? h('span', { style: { fontSize: 'var(--tu-fs-2xs)', padding: '1px 6px', borderRadius: 999, background: soft(TOKEN_COLORS.reasoning, 15), color: ink(TOKEN_COLORS.reasoning, 72) } }, t('子代理', 'SUB')) : null,
                      tk.contextRatio != null ? h('span', { className: 'tu-num', title: t('峰值上下文窗口占用率', 'Context window load'), style: { fontSize: 'var(--tu-fs-2xs)', color: tk.contextRatio > 0.8 ? ink('#d97706', 74) : C.muted } }, `CTX ${Math.round(tk.contextRatio * 100)}%`) : null),
                    h('span', { style: { fontSize: 'var(--tu-fs-2xs)', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, tk.model)),
                  h('div', { style: { fontWeight: 600, fontSize: 'var(--tu-fs-md)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: tk.title }, displayTitle),
                  tk.cwd
                    ? tk.workspaceKey
                      ? h('button', {
                          type: 'button',
                          onClick: () => setWorkspaceFilter(tk.workspaceKey),
                          title: tk.cwd,
                          style: { background: 'transparent', border: 0, padding: 0, textAlign: 'left', font: 'inherit', fontSize: 'var(--tu-fs-xs)', color: C.muted, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                        }, shortPath(tk.cwd))
                      : h('div', { style: { fontSize: 'var(--tu-fs-xs)', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: tk.cwd }, shortPath(tk.cwd))
                    : null),
                h('div', { style: { display: 'grid', gap: 5 } },
                  h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 'var(--tu-fs-xs)', paddingTop: 4, borderTop: '1px solid ' + C.border } },
                    h('span', { className: 'tu-num' },
                      h('strong', null, compact(tk.totalTokens) + ' tok'),
                      Number.isFinite(tk.cost) && tk.cost > 0
                        ? h('small', { style: { color: ink('#10b981', 72), fontWeight: 600, marginLeft: 6 } }, shortCost(tk.cost))
                        : null),
                    h('span', { className: 'tu-num', style: { color: C.muted, fontSize: 'var(--tu-fs-2xs)' } }, [
                      Number.isFinite(tk.outputTps) ? tpsFmt(tk.outputTps) : null,
                      tk.wallMs > 0 ? durFmt(tk.wallMs) : null,
                      tk.steps > 0 ? `${tk.steps} steps` : (tk.turns > 0 ? `${tk.turns}t` : null),
                    ].filter(Boolean).join(' · ') || relTime(tk.updatedAt))),
                  h('div', { 'aria-hidden': true, style: { height: 3, borderRadius: 999, background: C.panel2, overflow: 'hidden' } },
                    h('div', { 'data-agent-tone': tk.client, style: { width: `${tPct.toFixed(1)}%`, height: '100%', background: tc, borderRadius: 999, transition: 'width var(--tu-d3) var(--tu-ease)' } }))));
              }))
          : h('p', { style: { color: C.muted, fontSize: 'var(--tu-fs-xs)', margin: 0 } }, t('当前筛选范围内暂无本地任务记录（支持 Antigravity、Codex 与 DSH 本地会话）。', 'No local task records in this filter window (reads Antigravity, Codex & DSH local sessions).')),
        filtered.length > 6
          ? h('button', { type: 'button', className: 'tu-btn', style: { marginTop: 10 }, onClick: () => setShowAll(v => !v) },
              showAll ? t('收起任务列表', 'Show top 6 tasks') : t(`展开更多 (${Math.min(40, filtered.length)})`, `Show more (${Math.min(40, filtered.length)})`))
          : null);
    });

    const ScopeEditorPanel = memo(function ScopeEditorPanel({
      knownObservedList, allEngineCatalog, scopeState, draftScopeMode, setDraftScopeMode,
      draftScopeClients, setDraftScopeClients, savingScope, actions,
    }) {
      const [scopeQuery, setScopeQuery] = useState('');
      const [showExtraEngines, setShowExtraEngines] = useState(false);

      const knownObservedSet = useMemo(() => new Set(knownObservedList), [knownObservedList]);
      const primaryCandidates = useMemo(() => distinct([
        ...knownObservedList,
        ...CORE_HARNESS_PRESET,
        ...draftScopeClients.map(canonHarness),
      ]).sort((a, b) => (knownObservedSet.has(a) ? 0 : 1) - (knownObservedSet.has(b) ? 0 : 1) || a.localeCompare(b)), [knownObservedList, draftScopeClients, knownObservedSet]);

      const primarySet = useMemo(() => new Set(primaryCandidates), [primaryCandidates]);
      const qLower = scopeQuery.trim().toLowerCase();
      const extraCandidates = useMemo(() => distinct(allEngineCatalog.map(canonHarness))
        .filter(c => !primarySet.has(c))
        .filter(c => !qLower || c.toLowerCase().includes(qLower))
        .sort((a, b) => a.localeCompare(b)), [allEngineCatalog, primarySet, qLower]);
      const filteredPrimary = qLower ? primaryCandidates.filter(c => c.toLowerCase().includes(qLower)) : primaryCandidates;

      const renderToggleChip = cName => {
        const checked = draftScopeMode === 'all' || draftScopeClients.includes(cName);
        const isObs = knownObservedSet.has(cName);
        return h('button', {
          key: cName,
          type: 'button',
          className: 'tu-btn',
          'aria-pressed': false,
          onClick: () => {
            setDraftScopeMode('custom');
            setDraftScopeClients(prev => prev.includes(cName) ? prev.filter(x => x !== cName) : [...prev, cName]);
          },
          style: {
            padding: '4px 10px',
            borderRadius: 999,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: checked ? C.accentSoft : C.bg,
            borderColor: checked ? C.accent : C.border,
            fontWeight: checked ? 600 : 400,
          },
        },
        h('span', { 'aria-hidden': true, style: { color: checked ? C.accentInk : C.muted, fontWeight: 700 } }, checked ? '✓' : '+'),
        cName,
        HARNESS_HINTS[cName] ? h('small', { style: { color: C.muted, fontSize: 'var(--tu-fs-2xs)', fontWeight: 400 } }, `(${HARNESS_HINTS[cName]})`) : null,
        isObs ? h('span', { title: t('本机已观测到用量记录', 'Usage observed on this machine'), style: { width: 6, height: 6, borderRadius: '50%', background: C.ok, display: 'inline-block' } }) : null);
      };

      return h('section', { className: 'tu-card', style: { borderColor: C.accent, display: 'grid', gap: 10 } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' } },
          h('div', null,
            h('strong', { style: { fontSize: 14 } }, t('常用 Harness 查询范围设置', 'Configure harness query scope')),
            h('div', { style: { fontSize: 'var(--tu-fs-xs)', color: C.muted, marginTop: 2 } },
              t('保存后，“全部”汇总、图表、下拉框与引擎状态图仅统计和展示你勾选的常用 Harness，不再混入未使用的数十个客户端。', 'Limit "All" queries, charts, dropdowns, and refreshes to your chosen harnesses instead of all 58 clients.'))),
          h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
            knownObservedList.length > 0
              ? h('button', { type: 'button', className: 'tu-btn', onClick: () => { setDraftScopeMode('custom'); setDraftScopeClients([...knownObservedList]); } },
                  t(`仅选本机活跃 (${knownObservedList.length})`, `Active only (${knownObservedList.length})`))
              : null,
            h('button', { type: 'button', className: 'tu-btn', onClick: () => { setDraftScopeMode('custom'); setDraftScopeClients([...CORE_HARNESS_PRESET]); } }, t('推荐常用组', 'Core defaults')),
            h('button', { type: 'button', className: 'tu-btn', 'aria-pressed': draftScopeMode === 'all', onClick: () => setDraftScopeMode('all') }, t('不限 (全部引擎)', 'Unrestricted (all)')),
            h('button', { type: 'button', className: 'tu-btn', onClick: actions.discoverAllEngines }, t('全量扫描发现新引擎', 'Scan all to discover')))),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 7 } }, ...filteredPrimary.map(renderToggleChip)),
        allEngineCatalog.length > primaryCandidates.length
          ? h('div', { style: { borderTop: '1px solid ' + C.border, paddingTop: 8, display: 'grid', gap: 8 } },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                h('input', {
                  type: 'search', value: scopeQuery,
                  placeholder: t('搜索添加其他客户端 (如 cursor / trae / qwen)…', 'Search other harnesses (cursor, trae, qwen)…'),
                  onChange: e => setScopeQuery(e.target.value),
                  className: 'tu-btn',
                  style: { padding: '4px 10px', minWidth: 220 },
                }),
                !qLower
                  ? h('button', { type: 'button', className: 'tu-btn', onClick: () => setShowExtraEngines(v => !v) },
                      showExtraEngines ? t('收起其余未用客户端', 'Hide other clients') : t(`展开其余 ${extraCandidates.length} 个客户端`, `Show ${extraCandidates.length} other clients`))
                  : null),
              (showExtraEngines || Boolean(qLower)) && extraCandidates.length > 0
                ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 148, overflowY: 'auto' } }, ...extraCandidates.map(renderToggleChip))
                : null)
          : null,
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', paddingTop: 4 } },
          h('span', { style: { fontSize: 'var(--tu-fs-xs)', color: C.muted } },
            draftScopeMode === 'all'
              ? t('将启用全部客户端', 'All supported clients enabled')
              : t(`已勾选 ${draftScopeClients.length} 个常用 Harness（绿点代表本机已有用量记录）`, `${draftScopeClients.length} harnesses selected (green dot = usage observed)`)),
          h('div', { style: { display: 'flex', gap: 8 } },
            scopeState?.mode && scopeState.mode !== 'default'
              ? h('button', { type: 'button', disabled: savingScope, className: 'tu-btn', onClick: () => actions.saveScope('default', CORE_HARNESS_PRESET) }, t('恢复默认精简', 'Reset default'))
              : null,
            h('button', { type: 'button', disabled: savingScope, className: 'tu-btn', onClick: actions.closeScope }, t('取消', 'Cancel')),
            h('button', {
              type: 'button',
              disabled: savingScope || (draftScopeMode === 'custom' && draftScopeClients.length === 0),
              className: 'tu-btn tu-btn-active',
              onClick: () => actions.saveScope(),
            }, savingScope ? t('保存中…', 'Saving…') : t('保存范围并刷新', 'Save scope')))));
    });

    const SourcesDiagnostics = memo(function SourcesDiagnostics({
      sources, errors, sourceProbe, scopeState, showScopeEditor, actions,
    }) {
      const [expanded, setExpanded] = useState(false);
      const observedCount = sources.filter(s => s?.observed && !s?.error).length;
      const errorCount = sources.filter(s => Boolean(s?.error)).length;
      const idleCount = Math.max(0, sources.length - observedCount - errorCount);
      const showDetails = expanded || errorCount > 0 || errors.length > 0 || Boolean(sourceProbe);

      const cleanErrMsg = raw => {
        const s = typeof raw === 'string' ? raw : JSON.stringify(raw);
        const m = s.match(/timed out after (\d+)ms/i);
        if (m) return t(`扫描超时 (${Math.round(Number(m[1]) / 1000)}s)`, `Timed out (${Math.round(Number(m[1]) / 1000)}s)`);
        return s;
      };

      return h('section', { className: 'tu-card', style: { padding: '10px 14px' } },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            h('strong', { style: { fontSize: 'var(--tu-fs-md)' } }, t('引擎覆盖状态图', 'Engine coverage map')),
            sources.length
              ? h('span', { className: 'tu-num', style: { fontSize: 'var(--tu-fs-xs)', color: C.muted } }, t(`${observedCount} / ${sources.length} 活跃`, `${observedCount} / ${sources.length} active`))
              : null,
            scopeState?.mode === 'custom'
              ? h('span', { style: { fontSize: 'var(--tu-fs-2xs)', padding: '1px 7px', borderRadius: 999, background: C.accentSoft, color: C.accentInk } }, t('仅显示自选常用范围', 'Custom scope'))
              : null,
            sources.length
              ? h('div', { 'aria-hidden': true, style: { display: 'inline-flex', width: 84, height: 5, borderRadius: 999, overflow: 'hidden', background: C.panel2, gap: 1 } },
                  observedCount > 0 ? h('div', { style: { width: `${(observedCount / sources.length) * 100}%`, background: C.ok } }) : null,
                  errorCount > 0 ? h('div', { style: { width: `${(errorCount / sources.length) * 100}%`, background: C.error } }) : null,
                  idleCount > 0 ? h('div', { style: { width: `${(idleCount / sources.length) * 100}%`, background: C.border } }) : null)
              : null),
          h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
            sources.length > 0
              ? h('button', { type: 'button', className: 'tu-btn', style: { padding: '3px 9px' }, onClick: () => setExpanded(v => !v) },
                  showDetails ? t('收起详情', 'Hide details') : t('展开引擎列表', 'Show engines'))
              : null,
            h('button', { type: 'button', className: 'tu-btn', style: { padding: '3px 9px' }, onClick: actions.probeDirs }, t('探测本地目录', 'Check local dirs')),
            h('button', { type: 'button', className: 'tu-btn', 'aria-pressed': showScopeEditor, style: { padding: '3px 9px' }, onClick: actions.toggleScope }, t('⚙ 选择常用 Harness', '⚙ Configure harnesses')))),
        h(Collapse, { open: showDetails },
          h('div', { style: { display: 'grid', gap: 8, paddingTop: 9 } },
            sources.length
              ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } },
                  ...sources.map((s, i) => {
                    const name = optionLabel(s) || t('未知来源', 'Unknown');
                    const isErr = Boolean(s?.error);
                    const isOk = Boolean(s?.observed) && !isErr;
                    const sc = isErr ? C.error : isOk ? C.ok : C.muted;
                    const stText = isErr ? cleanErrMsg(s.error.message || s.error) : isOk ? t('已观测', 'Observed') : String(s?.status ?? s?.state ?? t('空闲', 'Idle'));
                    return h('button', {
                      key: optionValue(s) || i,
                      type: 'button',
                      className: 'tu-btn',
                      title: `${name}: ${stText}` + (s?.updatedAt ? ` · ${time(s.updatedAt)}` : ''),
                      onClick: () => (isErr ? actions.retryClient(optionValue(s) || 'all') : actions.pickClient(optionValue(s) || 'all')),
                      style: {
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: isOk ? soft('#087e75', 13) : C.bg,
                        borderColor: isErr ? C.error : isOk ? soft('#087e75', 28) : C.border,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      },
                    },
                    h('span', { 'aria-hidden': true, style: { width: 7, height: 7, borderRadius: '50%', background: sc, display: 'inline-block' } }),
                    name,
                    isErr ? h('small', { style: { color: ink('#d23f3f', 74) } }, t('重试', 'Retry')) : null);
                  }))
              : null,
            errors.length
              ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } },
                  ...errors.map(([key, value]) => h('span', {
                    key,
                    style: { fontSize: 'var(--tu-fs-xs)', color: ink('#d23f3f', 74), padding: '2px 8px', borderRadius: 6, background: soft('#d23f3f', 12) },
                  }, `${key}: ${cleanErrMsg(value)}`)))
              : null,
            sourceProbe?.error ? h('div', { style: { color: C.error, fontSize: 'var(--tu-fs-xs)' } }, String(sourceProbe.error)) : null,
            Array.isArray(sourceProbe?.candidates) && sourceProbe.candidates.length
              ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } },
                  ...sourceProbe.candidates.map(c => {
                    const okDir = c.status === 'directory-present';
                    const errDir = c.status === 'unreadable';
                    const dc = errDir ? C.error : okDir ? C.ok : C.muted;
                    return h('span', {
                      key: c.client + ':' + c.kind,
                      title: c.path + (c.error ? ` (${c.error})` : ''),
                      style: { fontSize: 'var(--tu-fs-xs)', padding: '2px 8px', borderRadius: 999, border: '1px solid ' + C.border, background: C.bg, display: 'inline-flex', alignItems: 'center', gap: 5 },
                    },
                    h('span', { 'aria-hidden': true, style: { width: 6, height: 6, borderRadius: '50%', background: dc } }),
                    `${c.client}/${c.kind}: ${c.status}`);
                  }))
              : null)));
    });

    // =========================================================================
    // 6. Main Studio Page Controller (`UsagePage`)
    // =========================================================================
    const initialFilters = { client: 'all', model: 'all', range: 'today', since: '', until: '' };

    function UsagePage() {
      // Preserve first 10 state slots for deterministic unit-test state seeding
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
      const [progress, setProgress] = useState(null);

      // Harness scope configurator state
      const [showScopeEditor, setShowScopeEditor] = useState(false);
      const [scopeState, setScopeState] = useState(null);
      const [allEngineCatalog, setAllEngineCatalog] = useState([]);
      const [draftScopeMode, setDraftScopeMode] = useState('custom');
      const [draftScopeClients, setDraftScopeClients] = useState([]);
      const [savingScope, setSavingScope] = useState(false);

      const [hover] = useState(() => createHoverStore({ idx: null, date: null, agent: null }));
      const rootRef = useRef(null);
      const prevRangeRef = useRef({ range: 'today', since: '', until: '' });

      // Sync hover agent onto root DOM attribute for zero-React-rerender CSS dimming
      useEffect(() => hover.subscribe(() => {
        const el = rootRef.current;
        if (!el) return;
        const { agent } = hover.get();
        if (agent) el.setAttribute('data-hover-agent', agent);
        else el.removeAttribute('data-hover-agent');
      }), [hover]);

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
          fetch('/tokscale-usage/cancel?id=' + token, { method: 'POST', keepalive: true }).catch(() => {});
        }
      };

      const mergeCatalogFromResult = result => {
        const rows = Array.isArray(result?.metrics?.entries) ? result.metrics.entries : EMPTY;
        const sc = result?.meta?.scope;
        if (sc) setScopeState(sc);
        setCatalog(old => ({
          clients: sc?.mode === 'custom' && Array.isArray(sc.enabledClients)
            ? distinct(sc.enabledClients)
            : distinct([...old.clients, ...(Array.isArray(result?.sources) ? result.sources : EMPTY), ...rows.map(e => e.client || e.agent).filter(Boolean)]),
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
            hover.set({ idx: null, date: null });
            startTrans(() => {
              setApplied(query);
              setData(result);
            });
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
      }, [sequence, hover]);

      const triggerProgressive = useCallback(async (query, discoverAll = false) => {
        const target = query || sequence.latestFilters || initialFilters;
        try {
          const params = new URLSearchParams({ client: target.client, range: target.range });
          if (target.range === 'custom' && target.since && target.until) { params.set('since', target.since); params.set('until', target.until); }
          if (discoverAll) params.set('discoverAll', '1');
          const res = await fetch('/tokscale-usage/progressive-refresh?' + params.toString(), { method: 'POST' });
          if (!res.ok) return false;
          const payload = await res.json();
          setProgress(payload.progress);
          let lastRev = payload.progress?.revision || 0;
          let lastEtag = '';
          if (sequence.pollTimer) clearInterval(sequence.pollTimer);
          sequence.pollInFlight = false;
          sequence.pollTimer = setInterval(async () => {
            if (sequence.pollInFlight) return;
            sequence.pollInFlight = true;
            try {
              const sr = await fetch('/tokscale-usage/status', { cache: 'no-store' });
              if (!sr.ok) return;
              const st = await sr.json();
              setProgress(prev => (
                prev && prev.revision === st.revision && prev.completed === st.completed && prev.active === st.active
                  ? prev
                  : st
              ));
              if (st.revision !== lastRev || !st.active) {
                lastRev = st.revision;
                const activeQuery = sequence.latestFilters || target;
                const reqSig = querySignature(activeQuery);
                if (!sequence.controller) {
                  const cp = new URLSearchParams({ client: activeQuery.client, model: activeQuery.model, range: activeQuery.range, rich: '1' });
                  if (activeQuery.range === 'custom') { cp.set('since', activeQuery.since); cp.set('until', activeQuery.until); }
                  const headers = lastEtag ? { 'if-none-match': lastEtag } : undefined;
                  const cr = await fetch('/tokscale-usage/cached-report?' + cp.toString(), { cache: 'no-store', headers });
                  if (cr.ok && cr.status === 200) {
                    lastEtag = cr.headers?.get?.('etag') || '';
                    const fresh = await cr.json();
                    if (!sequence.controller && querySignature(sequence.latestFilters || target) === reqSig) {
                      startTrans(() => {
                        setApplied(activeQuery);
                        setData(fresh);
                      });
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
          return true;
        } catch {
          return false;
        }
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
              ? distinct(Array.isArray(value.clients) ? value.clients : EMPTY)
              : distinct([...old.clients, ...(Array.isArray(value?.clients) ? value.clients : EMPTY)]),
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
      }, [filters, applyImmediate]);

      const exitSingleDay = useCallback(() => {
        const prev = prevRangeRef.current || { range: 'today', since: '', until: '' };
        const restored = prev.range === 'custom' && (!prev.since || !prev.until)
          ? { ...filters, range: 'today', since: '', until: '' }
          : { ...filters, range: prev.range, since: prev.since || '', until: prev.until || '' };
        applyImmediate(restored);
      }, [filters, applyImmediate]);

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
      }, [filters, data, load, sequence]);

      const submitFilters = async (refresh = false) => {
        if (filters.range === 'custom' && (!filters.since || !filters.until || filters.since > filters.until)) {
          setValidation(t('请选择有效的起止日期，开始日期不能晚于结束日期。', 'Choose a valid start and end date in order.'));
          return;
        }
        sequence.latestFilters = filters;
        if (refresh && data?.meta?.derivedFromBase) {
          const startedProg = await triggerProgressive(filters, false);
          if (startedProg) return;
        }
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
          const knownObs = new Set(body?.scope?.observedClients || EMPTY);
          if (nextMode === 'custom' && nextList.some(c => !knownObs.has(c)) && !hit?.metrics?.totalTokens) {
            void triggerProgressive(nextFilters, false);
          }
        } catch (err) {
          setError(t('保存 Harness 范围失败：', 'Failed to save harness scope: ') + String(err?.message || err));
        } finally {
          setSavingScope(false);
        }
      };

      // Constant-reference `actions` bag so every `memo(...)` child skips re-renders!
      const pickDate = useEvent(d => drillToDay(d));
      const pickClient = useEvent(c => change('client', c));
      const pickModel = useEvent(md => change('model', md));
      const pickAgentModel = useEvent((ag, md) => applyImmediate({ ...filters, client: ag, model: md }));
      const toggleDay = useEvent((d, wasSel) => (wasSel ? exitSingleDay() : drillToDay(d)));
      const pickRange = useEvent(rk => change('range', rk));
      const probeDirs = useEvent(() => void loadSources(true));
      const toggleScope = useEvent(() => openScopeEditor());
      const closeScope = useEvent(() => setShowScopeEditor(false));
      const saveScope = useEvent((modeOv, listOv) => void saveScopeSelection(modeOv, listOv));
      const discoverAllEngines = useEvent(() => void triggerProgressive(filters, true));
      const retryClient = useEvent(c => void triggerProgressive({ ...filters, client: c }, false));

      const actions = useMemo(() => ({
        pickDate, pickClient, pickModel, pickAgentModel, toggleDay, pickRange,
        probeDirs, toggleScope, closeScope, saveScope, discoverAllEngines, retryClient,
      }), []);

      // --- Unified Single-Pass ViewModel -----------------------------------
      const meta = data?.meta || {};
      const sources = Array.isArray(data?.sources) ? data.sources : EMPTY;
      const entries = Array.isArray(data?.metrics?.entries) ? data.metrics.entries : EMPTY;
      const activeProgress = progress?.active ? progress : (meta.progress?.active ? meta.progress : null);

      const vm = useMemo(() => {
        const aggregateBy = groupFn => {
          const map = new Map();
          const clientByModel = new Map();
          for (const entry of entries) {
            const name = groupFn(entry) || t('未知', 'Unknown');
            const item = map.get(name) || {
              name, tokens: 0, cost: 0, messages: 0, outputPlusReas: 0, reasoning: 0,
              speedTokens: 0, speedMs: 0, tpSum: 0, tpCount: 0, throughput: null, unitCost: null,
              members: new Set(), primaryClient: '',
            };
            const cName = entry.client || entry.agent || '';
            if (cName) item.members.add(cName);
            const rowTok = ['input', 'output', 'reasoning', 'cacheRead', 'cacheWrite'].reduce((s, k) => addKnown(s, entry[k]), 0);
            item.tokens = addKnown(item.tokens, rowTok);
            item.cost = addKnown(item.cost, entry.cost);
            item.messages += Number(entry.messageCount ?? entry.messages) || 0;
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

        const bubbleRows = models
          .filter(mRow => Number.isFinite(mRow.tokens) && mRow.tokens > 0)
          .slice(0, 16)
          .map(mRow => ({
            model: mRow.name,
            client: mRow.primaryClient || '',
            tokens: mRow.tokens,
            cost: mRow.cost || 0,
            unitCost: mRow.unitCost,
            messages: mRow.messages,
            throughput: mRow.throughput,
          }));

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

      // Dynamic CSS rule for zero-rerender cross-chart Agent dimming (dims visual fills, NOT text!)
      const hoverAgentCss = useMemo(() => vm.agentOrder.map(ag => {
        const q = cssEsc(ag);
        return `[data-tokscale-usage][data-hover-agent="${q}"] [data-agent-tone]:not([data-agent-tone="${q}"]) { opacity: .26; fill-opacity: .24; }`;
      }).join('\n'), [vm.agentOrder]);

      // --- Command Bar & Status --------------------------------------------
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
        className: 'tu-btn',
        style: { minWidth: 112, maxWidth: 'min(240px, 100%)', padding: '5px 9px' },
      },
      h('option', { value: 'all' }, `${prefix}: ${RANGE_LABELS.all}`),
      ...items.map(x => h('option', { key: optionValue(x), value: optionValue(x) },
        optionLabel(x) + (key === 'client' && observedClientNames.has(optionValue(x)) ? ' ★' : ''))));

      const dirty = Boolean(applied && ['client', 'model', 'range', 'since', 'until'].some(k => filters[k] !== applied[k]));
      const reportScope = applied ? [
        applied.range === 'custom' ? `${applied.since} – ${applied.until}` : RANGE_LABELS[applied.range],
        applied.client === 'all' ? null : 'Agent ' + applied.client,
        applied.model === 'all' ? null : t('模型 ', 'Model ') + applied.model,
      ].filter(Boolean).join(' · ') : '';
      const showReportStatus = Boolean(applied && (dirty || busy || meta.stale));
      const reportStatus = showReportStatus ? [
        reportScope && (dirty ? t('显示 ', 'Showing ') : '') + reportScope,
        busy ? t('更新中', 'Updating') : meta.stale ? t('上次缓存', 'Last cached report') : null,
      ].filter(Boolean).join(' · ') : '';

      const statusBadge = activeProgress
        ? h('span', {
            role: 'status',
            style: { fontSize: 'var(--tu-fs-xs)', padding: '3px 10px', borderRadius: 999, background: C.accentSoft, color: C.accentInk, display: 'inline-flex', alignItems: 'center', gap: 7 },
          },
          h('span', { className: 'tu-live', 'aria-hidden': true }),
          t(`增量同步 ${activeProgress.completed}/${activeProgress.total}`, `Syncing ${activeProgress.completed}/${activeProgress.total}`) +
          (activeProgress.currentClients?.length ? ` · ${activeProgress.currentClients.join(', ')}` : ''))
        : reportStatus
          ? h('span', { role: 'status', style: { fontSize: 'var(--tu-fs-xs)', color: meta.stale ? ink('#c98a00', 74) : C.muted } }, reportStatus)
          : meta.updatedAt
            ? h('span', { title: time(meta.updatedAt), style: { fontSize: 'var(--tu-fs-xs)', color: C.muted } },
                t('已同步 · ', 'Synced · ') + relTime(meta.updatedAt))
            : null;

      const isSingleDay = filters.range === 'custom' && Boolean(filters.since) && filters.since === filters.until;
      const prevLabel = RANGE_LABELS[prevRangeRef.current?.range] || RANGE_LABELS.today;
      const filterChips = [
        filters.client !== 'all' ? ['client', `Agent: ${filters.client}`, () => change('client', 'all')] : null,
        filters.model !== 'all' ? ['model', `${t('模型', 'Model')}: ${filters.model}`, () => change('model', 'all')] : null,
        isSingleDay ? ['day', `${t('单日', 'Day')}: ${filters.since} (${t('返回', 'Back to')} ${prevLabel})`, exitSingleDay] : null,
        workspaceFilter ? ['ws', `${t('项目(任务)', 'Project(tasks)')}: ${workspaceFilter.split('/').pop()}`, () => setWorkspaceFilter('')] : null,
      ].filter(Boolean);

      const rangeOptions = RANGE_KEYS.map(rk => [rk, RANGE_LABELS[rk]]);

      const commandBar = h('form', {
        onSubmit: e => { e.preventDefault(); void submitFilters(false); },
        className: 'tu-card',
        style: { padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
      },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
        h('h1', { style: { fontSize: 18.5, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' } }, t('用量洞察', 'Usage insights')),
        statusBadge,
        ...filterChips.map(([ck, cText, onClear]) => h('button', {
          key: ck, type: 'button', className: 'tu-btn', onClick: onClear,
          style: { padding: '2px 8px', borderRadius: 999, background: C.accentSoft, borderColor: C.accent },
        }, cText + ' ×'))),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7 } },
        dropdown(filters.client, 'client', sortedClients, 'Agent'),
        h('button', {
          type: 'button',
          className: 'tu-btn',
          'aria-pressed': showScopeEditor,
          title: t('设置默认纳入统计与下拉列表的常用 Harness 范围', 'Configure which harnesses are included in usage queries & dropdowns'),
          onClick: openScopeEditor,
          style: !showScopeEditor && scopeState?.mode === 'custom'
            ? { padding: '5px 9px', borderColor: C.accent, background: C.accentSoft }
            : { padding: '5px 9px' },
        }, scopeState?.mode === 'custom'
          ? t(`⚙ 常用 (${scopeState.enabledClients.length})`, `⚙ Scope (${scopeState.enabledClients.length})`)
          : t('⚙ 常用范围', '⚙ Harnesses')),
        dropdown(filters.model, 'model', catalog.models, t('模型', 'Model')),
        h(Segmented, {
          options: rangeOptions,
          value: filters.range,
          onChange: rk => change('range', rk),
          ariaLabel: t('日期范围', 'Date range'),
          disabledWhenBusy: true,
          busy,
        }),
        filters.range === 'custom'
          ? h('input', { type: 'date', 'aria-label': t('开始日期', 'Start date'), value: filters.since, onChange: e => change('since', e.target.value), className: 'tu-btn', required: true })
          : null,
        filters.range === 'custom'
          ? h('input', { type: 'date', 'aria-label': t('结束日期', 'End date'), value: filters.until, onChange: e => change('until', e.target.value), className: 'tu-btn', required: true })
          : null,
        busy
          ? h('button', { type: 'button', className: 'tu-btn', onClick: cancel }, t('取消查询', 'Cancel query'))
          : h('button', { type: 'button', className: 'tu-btn', onClick: () => void submitFilters(true) }, t('刷新数据', 'Refresh data')),
        (filters.client !== 'all' || filters.model !== 'all' || filters.range !== 'today' || workspaceFilter)
          ? h('button', {
              type: 'button',
              className: 'tu-btn',
              disabled: busy,
              onClick: () => { setWorkspaceFilter(''); prevRangeRef.current = { range: 'today', since: '', until: '' }; applyImmediate(initialFilters); },
            }, t('重置', 'Reset'))
          : null),
      sourceProbe?.catalogError ? h('div', { role: 'alert', style: { color: C.error, width: '100%', fontSize: 'var(--tu-fs-xs)' } }, t('无法读取完整 Agent 列表：', 'Could not load the complete agent catalog: ') + sourceProbe.catalogError) : null,
      validation ? h('div', { role: 'alert', style: { color: C.error, width: '100%', fontSize: 'var(--tu-fs-xs)' } }, validation) : null);

      const knownObservedList = useMemo(() => distinct([
        ...(scopeState?.observedClients || EMPTY),
        ...sources.filter(s => s?.observed).map(optionValue),
        ...entries.map(e => e.client || e.agent).filter(Boolean),
      ].map(canonHarness)), [scopeState, sources, entries]);

      const errors = useMemo(() => (meta.errors && typeof meta.errors === 'object' ? Object.entries(meta.errors) : EMPTY), [meta.errors]);
      const requestError = error ? h('div', { role: 'alert', className: 'tu-card', style: { color: C.error, fontSize: 'var(--tu-fs-md)' } }, t('报告加载失败：', 'Report request failed: ') + error) : null;
      const notice = (text, color = C.warn) => h('div', { role: 'status', className: 'tu-card', style: { color, fontSize: 'var(--tu-fs-md)' } }, text);

      const m = data?.metrics;
      let results = null;
      if (m && typeof m === 'object') {
        const daily = meta.trendsAvailable === true && Array.isArray(data.daily) ? data.daily : EMPTY;
        const hourly = Array.isArray(data.hourly) ? data.hourly : EMPTY;
        const heatmap = Array.isArray(data.heatmap) ? data.heatmap : EMPTY;
        const tasks = Array.isArray(data.tasks) ? data.tasks : EMPTY;
        const workspaces = Array.isArray(data.workspaces) ? data.workspaces : EMPTY;
        const weekdayProfile = Array.isArray(data.weekdayProfile) ? data.weekdayProfile : EMPTY;
        const execProfile = data.executionProfile || null;
        const fallback = data.fallback || null;
        const isZeroWindow = m.totalTokens === 0 && entries.length === 0 && daily.length === 0 && tasks.length === 0;

        const kpiNode = h(KpiStrip, {
          m,
          daily,
          periodDelta: data.periodDelta || null,
          monthlyProjection: data.monthlyProjection || null,
          execProfile,
          tm: data.timeMetrics || null,
          tp: data.throughputSummary || null,
          fallback,
          activeAgentsCount: vm.rawAgents.length,
          activeModelsCount: vm.models.length,
          workspacesCount: workspaces.length,
          totalTasks: data.totalTasks,
        });

        const heatmapNode = h(ActivityHeatmap, {
          heatmap,
          weekdayProfile,
          selectedDay: isSingleDay ? filters.since : '',
          hover,
          actions,
        });

        if (isZeroWindow && heatmap.length > 0) {
          results = h(React.Fragment, null,
            kpiNode,
            h('div', { className: 'tu-summary' },
              h(SmartEmptyCard, { heatmap, actions }),
              heatmapNode));
        } else {
          const showBubble = vm.bubbleRows.length >= 2;
          const tbd = execProfile?.timingBreakdown;
          const hasExec = Boolean(tbd && (tbd.ttftMs + tbd.reasoningMs + tbd.textMs + tbd.toolArgMs + tbd.toolsMs > 0 || (execProfile?.topTools || EMPTY).length > 0));
          const hasMatrix = vm.matrixData.agents.length >= 1 && vm.matrixData.models.length >= 1;
          const showDeep = workspaces.length > 0 || hasMatrix || hasExec;
          const hasTrendRow = daily.length > 0 || heatmap.length > 0 || hourly.length > 0;

          results = h(React.Fragment, null,
            kpiNode,
            fallback?.totalTokens > 0
              ? h(FallbackBanner, { fallback, completeness: meta.completeness, actions })
              : null,
            hasTrendRow
              ? h('div', { className: 'tu-summary' },
                  h(SvgTrendWorkbench, {
                    daily,
                    hourly,
                    m,
                    meta,
                    agentOrder: vm.agentOrder,
                    clientColorMap: vm.clientColorMap,
                    monthlyProjection: data.monthlyProjection || null,
                    hover,
                    actions,
                  }),
                  heatmapNode)
              : null,
            h('div', { className: 'tu-tri' },
              h(TokenComposition, { m, execProfile }),
              h(SvgAgentDonut, {
                comparison: groupFamily ? vm.familyAgents : vm.rawAgents,
                hasMultiFamily: vm.hasMultiFamily,
                groupFamily,
                setGroupFamily,
                clientFilter: filters.client,
                catalogClients: catalog.clients,
                clientColorMap: vm.clientColorMap,
                hover,
                actions,
              }),
              h(ModelRanking, {
                models: vm.models,
                rankBy: modelRankBy,
                setRankBy: setModelRankBy,
                modelFilter: filters.model,
                actions,
              })),
            !hasTrendRow
              ? h('div', { style: { color: C.muted, fontSize: 'var(--tu-fs-xs)', padding: '2px 4px' } }, t('此筛选条件下趋势数据不可用。', 'Trend data is unavailable for this selection.'))
              : null,
            showBubble || showDeep
              ? h('div', { className: showBubble && showDeep ? 'tu-deep' : 'tu-deep-single' },
                  showBubble ? h(QuadrantBubbleMap, { bubbleRows: vm.bubbleRows, clientColorMap: vm.clientColorMap, actions }) : null,
                  showDeep
                    ? h(DeepWorkbench, {
                        workspaces,
                        matrixData: vm.matrixData,
                        execProfile,
                        workspaceFilter,
                        setWorkspaceFilter,
                        clientColorMap: vm.clientColorMap,
                        actions,
                      })
                    : null)
              : null,
            h(TaskStream, {
              tasks,
              workspaceFilter,
              setWorkspaceFilter,
              clientColorMap: vm.clientColorMap,
            }));
        }
      } else if (data) results = notice(t('当前筛选条件没有可用报告；请检查来源状态。', 'No report is available for this selection; check source status.'));
      else if (busy || activeProgress) results = notice(t('正在增量读取本机各 Agent 用量，快引擎（DSH 等）将在 1–4 秒内先行呈现…', 'Scanning local agents progressively (fast engines appear first within ~1–4s)…'), C.muted);
      else if (checkingCache) results = notice(t('正在查找已保存的报告…', 'Checking for a saved report…'), C.muted);
      else if (!error) results = notice(t('点击预设时间或刷新以加载用量。', 'Select a preset or refresh to query usage.'), C.muted);

      return h('main', {
        ref: rootRef,
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
          background: 'color-mix(in oklab, #7893ba 5%, var(--tu-bg))',
        },
      },
      h('style', null, STUDIO_CSS + (hoverAgentCss ? '\n' + hoverAgentCss : '')),
      commandBar,
      h(Collapse, { open: showScopeEditor },
        h(ScopeEditorPanel, {
          knownObservedList,
          allEngineCatalog,
          scopeState,
          draftScopeMode,
          setDraftScopeMode,
          draftScopeClients,
          setDraftScopeClients,
          savingScope,
          actions,
        })),
      requestError,
      h('div', { className: 'tu-report', 'aria-busy': busy && !!data }, results),
      data || sourceProbe
        ? h(SourcesDiagnostics, {
            sources,
            errors,
            sourceProbe,
            scopeState,
            showScopeEditor,
            actions,
          })
        : null);
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
