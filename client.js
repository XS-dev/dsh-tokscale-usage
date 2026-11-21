// Native DSH Usage & Telemetry Studio — Precision Telemetry DLS (v1.0.0).
window.__ModuleLoader__.load({
  id: 'dsh-tokscale-usage',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback, useMemo, useRef, memo } = React;
    const useIsoLayoutEffect = React.useLayoutEffect || useEffect;
    const startTrans = React.startTransition || (fn => fn());
    const UI_VERSION = '1.0.0';

    // =========================================================================
    // 1. Precision Telemetry DLS Tokens, Palettes & Scoped Studio CSS
    // =========================================================================
    const C = {
      s0: 'var(--tu-s0)',
      s1: 'var(--tu-s1)',
      s2: 'var(--tu-s2)',
      s3: 'var(--tu-s3)',
      line: 'var(--tu-line)',
      lineStrong: 'var(--tu-line-strong)',
      ink: 'var(--tu-ink)',
      ink2: 'var(--tu-ink-2)',
      ink3: 'var(--tu-ink-3)',
      track: 'var(--tu-track)',
      accent: 'var(--tu-accent)',
      accentFg: 'var(--tu-accent-fg)',
      accentSoft: 'var(--tu-accent-soft)',
      accentInk: 'var(--tu-accent-ink)',
      spend: 'var(--tu-spend)',
      // Semantic compatibility aliases mapped onto strict DLS surfaces & inks
      bg: 'var(--tu-s2)',
      panel: 'var(--tu-s1)',
      panel2: 'var(--tu-track)',
      border: 'var(--tu-line)',
      text: 'var(--tu-ink)',
      muted: 'var(--tu-ink-2)',
      error: 'var(--tu-err)',
      warn: 'var(--tu-warn)',
      ok: 'var(--tu-ok)',
    };

    const TONE = ['var(--tu-tone-1)', 'var(--tu-tone-2)', 'var(--tu-tone-3)', 'var(--tu-tone-4)', 'var(--tu-tone-5)'];
    // Muted Cool Mineral Palette (low-saturation fjord / slate-teal / periwinkle / mist-sage) for Models & Workspaces
    const COOL_PALETTE = [
      'var(--tu-cool-1)',
      'var(--tu-cool-2)',
      'var(--tu-cool-3)',
      'var(--tu-cool-4)',
      'var(--tu-cool-5)',
      'var(--tu-cool-6)',
    ];

    // Fixed Entity-Bound Agent Identity Slots (7 semantic slots + Graphite Other; never hashed randomly)
    const AGENT_FIXED_COLORS = {
      dsh: 'var(--tu-c1)',
      claude: 'var(--tu-c2)',
      codex: 'var(--tu-c3)',
      antigravity: 'var(--tu-c4)',
      gemini: 'var(--tu-c5)',
      cursor: 'var(--tu-c6)',
      opencode: 'var(--tu-c7)',
      trae: 'var(--tu-c7)',
      qwen: 'var(--tu-c7)',
      cline: 'var(--tu-c7)',
      other: 'var(--tu-c-other)',
    };
    const FALLBACK_SERIES = COOL_PALETTE;

    const TOKEN_COLORS = {
      output: 'var(--tu-tok-output)',
      reasoning: 'var(--tu-tok-reasoning)',
      cacheWrite: 'var(--tu-tok-cache-write)',
      input: 'var(--tu-tok-input)',
      cacheRead: 'var(--tu-tok-cache-read)',
    };
    const HEAT_COLORS = ['var(--tu-seq-0)', 'var(--tu-seq-1)', 'var(--tu-seq-2)', 'var(--tu-seq-3)', 'var(--tu-seq-4)'];

    const soft = (color, k = 12) => `color-mix(in oklab, ${color} ${k}%, var(--tu-s1))`;
    const ink = (color, k = 68) => `color-mix(in oklab, ${color} ${k}%, var(--tu-ink))`;
    const cssEsc = s => (typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&'));

    function colorForAgent(name) {
      const key = String(name || '').toLowerCase();
      if (AGENT_FIXED_COLORS[key]) return AGENT_FIXED_COLORS[key];
      if (key.startsWith('antigravity')) return AGENT_FIXED_COLORS.antigravity;
      if (key.startsWith('devin') || key.startsWith('micode')) return 'var(--tu-c6)';
      return AGENT_FIXED_COLORS.other;
    }

    // Deterministic entity-bound cool tone lookup so a model/workspace keeps its cool mineral hue across filter/sort switches
    function colorForCoolEntity(name, fallbackIdx = 0) {
      const s = String(name || '');
      if (!s) return COOL_PALETTE[fallbackIdx % COOL_PALETTE.length];
      let hash = 2166136261;
      for (let i = 0; i < s.length; i++) {
        hash ^= s.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      return COOL_PALETTE[Math.abs(hash) % COOL_PALETTE.length];
    }

    const STUDIO_CSS = `
      /* =======================================================================
         Light Theme (Default & Explicit): Cool Mineral Alabaster Palette
         ======================================================================= */
      [data-tokscale-usage],
      [data-tokscale-usage][data-tu-theme='light'] {
        color-scheme: light;

        /* 1. Cool Slate Ink Hierarchy (high legibility on daylight surfaces) */
        --tu-ink: #0f172a;
        --tu-ink-2: #475569;
        --tu-ink-3: #64748b;

        /* 2. 4-Tier Surface Architecture (S0 Canvas -> S1 Card -> S2 Well -> S3 Frosted Dock) */
        --tu-s0: #f3f6fa;
        --tu-s1: #ffffff;
        --tu-s2: #eef2f7;
        --tu-s3: rgba(255, 255, 255, 0.92);

        /* 3. Hairlines & Grid */
        --tu-line: rgba(15, 23, 42, 0.085);
        --tu-line-strong: rgba(15, 23, 42, 0.165);
        --tu-grid: rgba(15, 23, 42, 0.055);
        --tu-track: #e5ebf2;

        /* 4. Graphite Luminance Ramp & Low-Saturation Cool Mineral Palette */
        --tu-tone-1: #334155;
        --tu-tone-2: #475569;
        --tu-tone-3: #64748b;
        --tu-tone-4: #94a3b8;
        --tu-tone-5: #cbd5e1;

        --tu-cool-1: #3b6ea5; /* Fjord Steel Blue */
        --tu-cool-2: #34787e; /* Glacier Slate Teal */
        --tu-cool-3: #576399; /* Muted Periwinkle */
        --tu-cool-4: #3d7c6b; /* Nordic Pine Mist */
        --tu-cool-5: #5c728d; /* Cerulean Slate */
        --tu-cool-6: #6d6496; /* Cool Twilight Slate */

        --tu-tok-output: var(--tu-cool-1);
        --tu-tok-reasoning: var(--tu-cool-3);
        --tu-tok-cache-write: var(--tu-tone-3);
        --tu-tok-input: var(--tu-cool-2);
        --tu-tok-cache-read: var(--tu-cool-4);
        --tu-spend: var(--tu-cool-2);

        /* 5. Fixed Agent Identity Slots (Daylight-harmonized muted tones) */
        --tu-c1: #2b6cb0; /* dsh */
        --tu-c2: #b86246; /* claude */
        --tu-c3: #288068; /* codex */
        --tu-c4: #5b54b8; /* antigravity */
        --tu-c5: #a8557c; /* gemini */
        --tu-c6: #2f7d58; /* cursor */
        --tu-c7: #a67828; /* other cli */
        --tu-c-other: var(--tu-tone-4);

        /* 6. Focus & Sequential Ramp (never binds near-black host brand var) */
        --tu-accent: #2c66b8;
        --tu-accent-fg: #ffffff;
        --tu-accent-soft: rgba(44, 102, 184, 0.10);
        --tu-accent-ink: #1e4e94;
        --tu-seq-0: #eef2f7;
        --tu-seq-1: #d4e2f4;
        --tu-seq-2: #9dbde6;
        --tu-seq-3: #5f90d1;
        --tu-seq-4: #2c66b8;

        /* 7. System Status (non-chart) */
        --tu-ok: #1f7a68;
        --tu-warn: #b07419;
        --tu-err: #c23b3b;

        /* 8. Elevation Shadows */
        --tu-shadow-1: 0 1px 2px rgba(15, 23, 42, 0.045), 0 0 0 0.5px rgba(15, 23, 42, 0.03);
        --tu-shadow-dock: 0 1px 0 rgba(15, 23, 42, 0.08), 0 6px 18px -10px rgba(15, 23, 42, 0.10);
        --tu-shadow-3: 0 0 0 1px rgba(15, 23, 42, 0.12), 0 12px 28px -8px rgba(15, 23, 42, 0.18);
      }

      /* =======================================================================
         Dark Theme (Host Sync & Media Fallback): Deep Obsidian Slate Palette
         ======================================================================= */
      @media (prefers-color-scheme: dark) {
        [data-tokscale-usage]:not([data-tu-theme='light']) {
          color-scheme: dark;
          --tu-ink: #e6edf7;
          --tu-ink-2: #94a3b8;
          --tu-ink-3: #6b7c93;
          --tu-s0: #0b1018;
          --tu-s1: #111824;
          --tu-s2: #172131;
          --tu-s3: rgba(17, 24, 36, 0.90);
          --tu-line: rgba(148, 163, 184, 0.125);
          --tu-line-strong: rgba(148, 163, 184, 0.23);
          --tu-grid: rgba(148, 163, 184, 0.075);
          --tu-track: #1d293d;
          --tu-tone-1: #cbd5e1;
          --tu-tone-2: #94a3b8;
          --tu-tone-3: #64748b;
          --tu-tone-4: #475569;
          --tu-tone-5: #334155;
          --tu-cool-1: #6ca2de;
          --tu-cool-2: #5db5bb;
          --tu-cool-3: #8d99d1;
          --tu-cool-4: #66b59d;
          --tu-cool-5: #879fb9;
          --tu-cool-6: #a196cc;
          --tu-c1: #5c9ce6;
          --tu-c2: #dc8a6b;
          --tu-c3: #4db897;
          --tu-c4: #8c85eb;
          --tu-c5: #d482a8;
          --tu-c6: #5cb885;
          --tu-c7: #d6aa56;
          --tu-accent: #5b97e8;
          --tu-accent-fg: #0b1018;
          --tu-accent-soft: rgba(91, 151, 232, 0.16);
          --tu-accent-ink: #8cb9f7;
          --tu-seq-0: #172131;
          --tu-seq-1: #1d3252;
          --tu-seq-2: #284c7e;
          --tu-seq-3: #3d6fb3;
          --tu-seq-4: #5b97e8;
          --tu-ok: #46b89c;
          --tu-warn: #deb04b;
          --tu-err: #eb6b6b;
          --tu-shadow-1: inset 0 1px 0 rgba(255, 255, 255, 0.035), 0 2px 6px rgba(0, 0, 0, 0.28);
          --tu-shadow-dock: 0 1px 0 rgba(148, 163, 184, 0.12), 0 8px 22px -10px rgba(0, 0, 0, 0.55);
          --tu-shadow-3: 0 0 0 1px rgba(148, 163, 184, 0.22), 0 14px 32px -8px rgba(0, 0, 0, 0.62);
        }
      }

      [data-tokscale-usage][data-tu-theme='dark'] {
        color-scheme: dark;
        --tu-ink: #e6edf7;
        --tu-ink-2: #94a3b8;
        --tu-ink-3: #6b7c93;
        --tu-s0: #0b1018;
        --tu-s1: #111824;
        --tu-s2: #172131;
        --tu-s3: rgba(17, 24, 36, 0.90);
        --tu-line: rgba(148, 163, 184, 0.125);
        --tu-line-strong: rgba(148, 163, 184, 0.23);
        --tu-grid: rgba(148, 163, 184, 0.075);
        --tu-track: #1d293d;
        --tu-tone-1: #cbd5e1;
        --tu-tone-2: #94a3b8;
        --tu-tone-3: #64748b;
        --tu-tone-4: #475569;
        --tu-tone-5: #334155;
        --tu-cool-1: #6ca2de;
        --tu-cool-2: #5db5bb;
        --tu-cool-3: #8d99d1;
        --tu-cool-4: #66b59d;
        --tu-cool-5: #879fb9;
        --tu-cool-6: #a196cc;
        --tu-c1: #5c9ce6;
        --tu-c2: #dc8a6b;
        --tu-c3: #4db897;
        --tu-c4: #8c85eb;
        --tu-c5: #d482a8;
        --tu-c6: #5cb885;
        --tu-c7: #d6aa56;
        --tu-accent: #5b97e8;
        --tu-accent-fg: #0b1018;
        --tu-accent-soft: rgba(91, 151, 232, 0.16);
        --tu-accent-ink: #8cb9f7;
        --tu-seq-0: #172131;
        --tu-seq-1: #1d3252;
        --tu-seq-2: #284c7e;
        --tu-seq-3: #3d6fb3;
        --tu-seq-4: #5b97e8;
        --tu-ok: #46b89c;
        --tu-warn: #deb04b;
        --tu-err: #eb6b6b;
        --tu-shadow-1: inset 0 1px 0 rgba(255, 255, 255, 0.035), 0 2px 6px rgba(0, 0, 0, 0.28);
        --tu-shadow-dock: 0 1px 0 rgba(148, 163, 184, 0.12), 0 8px 22px -10px rgba(0, 0, 0, 0.55);
        --tu-shadow-3: 0 0 0 1px rgba(148, 163, 184, 0.22), 0 14px 32px -8px rgba(0, 0, 0, 0.62);
      }

      /* Shared Geometry, Typography & Motion Invariants */
      [data-tokscale-usage] {
        --tu-sp-0: 2px; --tu-sp-1: 4px; --tu-sp-2: 6px; --tu-sp-3: 8px;
        --tu-sp-4: 12px; --tu-sp-5: 16px; --tu-sp-6: 20px; --tu-sp-7: 24px;
        --tu-r-sm: 4px; --tu-r-md: 8px; --tu-r-lg: 12px; --tu-r-pill: 999px;
        --tu-meter-sm: 4px; --tu-meter-md: 8px;
        --tu-font-sans: "Inter", "Segoe UI Variable Text", "Segoe UI Variable", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", system-ui, -apple-system, sans-serif;
        --tu-font-mono: "JetBrains Mono", "Cascadia Mono", "SF Mono", ui-monospace, Menlo, Consolas, monospace;
        --tu-fs-1: 11px; --tu-fs-2: 12px; --tu-fs-3: 13px; --tu-fs-4: 16px; --tu-fs-5: 20px; --tu-fs-6: 24px;
        --tu-fw-text: 400; --tu-fw-ui: 500; --tu-fw-strong: 600;
        --tu-fs-2xs: var(--tu-fs-1); --tu-fs-xs: var(--tu-fs-2); --tu-fs-sm: var(--tu-fs-2); --tu-fs-md: var(--tu-fs-3);
        --tu-ease: cubic-bezier(.2, .8, .2, 1);
        --tu-d1: 120ms; --tu-d2: 200ms; --tu-d3: 320ms;
        --tu-dim: .32;

        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
        box-sizing: border-box;
        background: var(--tu-s0);
        color: var(--tu-ink);
        font: var(--tu-fw-text) var(--tu-fs-2)/1.45 var(--tu-font-sans);
        font-variant-numeric: tabular-nums lining-nums;
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
        container-type: inline-size;
        container-name: studio;
      }

      /* Fixed Non-Scrolling Top Dock + Dedicated Scroll Stage (zero top-edge content bleed) */
      [data-tokscale-usage] .tu-top-dock {
        flex: 0 0 auto;
        z-index: 20;
        background: var(--tu-s3);
        -webkit-backdrop-filter: blur(14px) saturate(1.3);
        backdrop-filter: blur(14px) saturate(1.3);
        border-bottom: 1px solid var(--tu-line);
        box-shadow: var(--tu-shadow-dock);
        padding: 10px clamp(12px, 2vw, 24px);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      [data-tokscale-usage] .tu-scroll-stage {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        scrollbar-gutter: stable;
        padding: 14px clamp(12px, 2vw, 24px) 22px;
        display: grid;
        grid-auto-rows: max-content;
        align-content: start;
        gap: var(--tu-sp-4);
      }

      /* Surfaces */
      [data-tokscale-usage] .tu-card {
        background: var(--tu-s1);
        border: 1px solid var(--tu-line);
        border-radius: var(--tu-r-lg);
        box-shadow: var(--tu-shadow-1);
        padding: var(--tu-sp-4) var(--tu-sp-5);
        min-width: 0;
      }
      [data-tokscale-usage] .tu-well {
        background: var(--tu-s2);
        border: 1px solid var(--tu-line);
        border-radius: var(--tu-r-md);
        padding: var(--tu-sp-3) var(--tu-sp-4);
      }

      /* Unified Card Header (single consistent header grammar across all cards) */
      [data-tokscale-usage] .tu-card-hd {
        display: flex;
        align-items: center;
        gap: var(--tu-sp-3);
        min-height: 28px;
        flex-wrap: nowrap;
      }
      [data-tokscale-usage] .tu-card-hd__title {
        font-size: var(--tu-fs-3);
        font-weight: var(--tu-fw-strong);
        line-height: 18px;
        color: var(--tu-ink);
        white-space: nowrap;
        flex-shrink: 0;
        margin: 0;
      }
      [data-tokscale-usage] .tu-card-hd__meta {
        flex: 1;
        min-width: 0;
        font-size: var(--tu-fs-1);
        color: var(--tu-ink-3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      [data-tokscale-usage] .tu-card-hd__actions {
        display: flex;
        align-items: center;
        gap: var(--tu-sp-1);
        flex-shrink: 0;
        margin-left: auto;
      }

      /* Swiss Instrument Numeric Anatomy */
      [data-tokscale-usage] .tu-num { font-variant-numeric: tabular-nums; white-space: nowrap; }
      [data-tokscale-usage] .tu-val { font-weight: var(--tu-fw-strong); color: var(--tu-ink); font-variant-numeric: tabular-nums; white-space: nowrap; }
      [data-tokscale-usage] .tu-val--xl { font-size: var(--tu-fs-6); line-height: 28px; letter-spacing: -.02em; }
      [data-tokscale-usage] .tu-val--lg { font-size: var(--tu-fs-5); line-height: 25px; letter-spacing: -.015em; }
      [data-tokscale-usage] .tu-val--md { font-size: var(--tu-fs-4); line-height: 21px; letter-spacing: -.01em; }
      [data-tokscale-usage] .tu-unit { font-size: var(--tu-fs-1); font-weight: var(--tu-fw-text); color: var(--tu-ink-3); margin-left: .28em; letter-spacing: 0; }
      [data-tokscale-usage] .tu-mono { font-family: var(--tu-font-mono); font-size: var(--tu-fs-1); letter-spacing: 0; }
      [data-tokscale-usage] .tu-meta { font-size: var(--tu-fs-1); color: var(--tu-ink-3); }
      [data-tokscale-usage] .tu-overline { font-size: var(--tu-fs-1); font-weight: var(--tu-fw-ui); color: var(--tu-ink-2); letter-spacing: .02em; }

      /* Chips, Swatches & Meters */
      [data-tokscale-usage] .tu-chip {
        display: inline-flex;
        align-items: center;
        gap: var(--tu-sp-1);
        height: 20px;
        padding: 0 var(--tu-sp-3);
        border-radius: var(--tu-r-pill);
        background: var(--tu-s2);
        color: var(--tu-ink-2);
        font-size: var(--tu-fs-1);
        font-weight: var(--tu-fw-ui);
        white-space: nowrap;
        border: 1px solid var(--tu-line);
      }
      [data-tokscale-usage] .tu-chip--accent { background: var(--tu-accent-soft); color: var(--tu-accent-ink); border-color: color-mix(in oklab, var(--tu-accent) 32%, transparent); }
      [data-tokscale-usage] .tu-hatch {
        background-image: repeating-linear-gradient(45deg, color-mix(in oklab, var(--tu-s1) 48%, transparent) 0 1.5px, transparent 1.5px 4px);
      }
      [data-tokscale-usage] .tu-meter { display: flex; height: var(--tu-meter-sm); gap: 1px; border-radius: var(--tu-r-pill); overflow: hidden; background: var(--tu-track); }
      [data-tokscale-usage] .tu-meter--md { height: var(--tu-meter-md); gap: 1.5px; }

      /* Controls & Segmented Switcher (elevated S1 pill inside sunken S2 track) */
      [data-tokscale-usage] .tu-btn {
        padding: 4px var(--tu-sp-3);
        border: 1px solid var(--tu-line);
        border-radius: var(--tu-r-md);
        background: var(--tu-s1);
        color: var(--tu-ink);
        cursor: pointer;
        font: inherit;
        font-size: var(--tu-fs-1);
        font-weight: var(--tu-fw-ui);
        line-height: 1.35;
        transition: background-color var(--tu-d1) var(--tu-ease), color var(--tu-d1) var(--tu-ease), border-color var(--tu-d1) var(--tu-ease), transform 80ms var(--tu-ease);
      }
      [data-tokscale-usage] .tu-btn:enabled:hover { border-color: var(--tu-line-strong); }
      [data-tokscale-usage] .tu-btn:enabled:active { transform: scale(.97); }
      [data-tokscale-usage] .tu-btn[aria-pressed='true'], [data-tokscale-usage] .tu-btn-active {
        background: var(--tu-accent-soft);
        color: var(--tu-accent-ink);
        border-color: color-mix(in oklab, var(--tu-accent) 42%, transparent);
      }
      [data-tokscale-usage] .tu-seg {
        position: relative;
        display: inline-grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(max-content, 1fr);
        flex-shrink: 0;
        padding: 2px;
        border: 1px solid var(--tu-line);
        border-radius: var(--tu-r-md);
        background: var(--tu-s2);
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
        background: var(--tu-s1);
        box-shadow: 0 0 0 1px var(--tu-line), 0 1px 2px rgba(0, 0, 0, 0.06);
        border-radius: calc(var(--tu-r-md) - 2px);
        transition: transform var(--tu-d2) var(--tu-ease);
      }
      [data-tokscale-usage] .tu-seg > button {
        background: transparent;
        border: 0;
        border-radius: calc(var(--tu-r-md) - 2px);
        padding: 3px var(--tu-sp-3);
        color: var(--tu-ink-2);
        font: inherit;
        font-size: var(--tu-fs-1);
        font-weight: var(--tu-fw-ui);
        cursor: pointer;
        white-space: nowrap;
        transition: color var(--tu-d2) var(--tu-ease);
      }
      [data-tokscale-usage] .tu-seg > button[aria-pressed='true'] { color: var(--tu-ink); font-weight: var(--tu-fw-strong); }

      /* SVG Chart & Ring Family Grammar */
      [data-tokscale-usage] svg text { font-family: var(--tu-font-sans); font-variant-numeric: tabular-nums; }
      [data-tokscale-usage] .tu-grid-line { stroke: var(--tu-grid); stroke-width: 1; shape-rendering: crispEdges; }
      [data-tokscale-usage] .tu-baseline { stroke: var(--tu-line-strong); stroke-width: 1; shape-rendering: crispEdges; }
      [data-tokscale-usage] .tu-axis-text { fill: var(--tu-ink-3); font-size: var(--tu-fs-1); }
      [data-tokscale-usage] .tu-ref-line { stroke: var(--tu-ink-3); stroke-width: 1; stroke-dasharray: 3 3; fill: none; }
      [data-tokscale-usage] .tu-proj-line { stroke: var(--tu-spend); stroke-width: 1.5; stroke-dasharray: 4 3; fill: none; }
      [data-tokscale-usage] .tu-svg-halo {
        paint-order: stroke fill;
        stroke: var(--tu-s1);
        stroke-width: 3px;
        stroke-linejoin: round;
        stroke-linecap: round;
      }
      [data-tokscale-usage] .tu-ring-track { fill: none; stroke: var(--tu-track); }
      [data-tokscale-usage] .tu-arc { fill: none; transition: stroke-dasharray 360ms var(--tu-ease), stroke-dashoffset 360ms var(--tu-ease), opacity var(--tu-d2) var(--tu-ease); }
      @starting-style { [data-tokscale-usage] .tu-arc { stroke-dasharray: 0 999; } }
      [data-tokscale-usage] [data-agent-tone], [data-tokscale-usage] [data-model-tone] { transition: opacity var(--tu-d2) var(--tu-ease), fill-opacity var(--tu-d2) var(--tu-ease); }

      /* Collapse, Motion, Tooltip & Crosshair */
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
        animation: tu-grow 400ms var(--tu-ease) both;
        animation-delay: calc(min(var(--i, 0), 40) * 6ms);
      }
      [data-tokscale-usage] .tu-bar { transition: y var(--tu-d3) var(--tu-ease), height var(--tu-d3) var(--tu-ease), fill-opacity var(--tu-d2) var(--tu-ease); }
      [data-tokscale-usage] .tu-tip {
        position: absolute;
        top: 8px;
        left: 0;
        width: 244px;
        pointer-events: none;
        z-index: 6;
        background: var(--tu-s3);
        -webkit-backdrop-filter: blur(12px) saturate(1.35);
        backdrop-filter: blur(12px) saturate(1.35);
        box-shadow: var(--tu-shadow-3);
        border-radius: var(--tu-r-md);
        padding: var(--tu-sp-3) var(--tu-sp-4);
        font-size: var(--tu-fs-2);
        display: grid;
        gap: var(--tu-sp-1);
        transition: transform 130ms var(--tu-ease), opacity 110ms var(--tu-ease);
      }
      [data-tokscale-usage] .tu-crosshair {
        position: absolute;
        top: var(--pt, 14px);
        bottom: var(--pb, 24px);
        left: 0;
        width: 0;
        border-left: 1px solid color-mix(in oklab, var(--tu-ink) 24%, transparent);
        pointer-events: none;
        z-index: 4;
        transition: transform 85ms var(--tu-ease), opacity 110ms var(--tu-ease);
      }
      @keyframes tu-indet { from { transform: translateX(-100%); } to { transform: translateX(260%); } }
      [data-tokscale-usage] .tu-report { position: relative; display: grid; gap: var(--tu-sp-4); }
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

      /* Panoramic Bento Puzzle Grid & Interactive Tiles */
      [data-tokscale-usage] .tu-kpis { display: grid; grid-template-columns: minmax(0, 1.26fr) minmax(0, 1.2fr) repeat(4, minmax(0, .94fr)); gap: var(--tu-sp-4); align-items: stretch; }
      [data-tokscale-usage] .tu-kpi { text-align: left; padding: var(--tu-sp-4) var(--tu-sp-5); display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; min-height: 96px; container-type: inline-size; cursor: pointer; transition: border-color var(--tu-d1) var(--tu-ease), transform 90ms var(--tu-ease); }
      [data-tokscale-usage] .tu-kpi:hover { border-color: var(--tu-line-strong); }
      [data-tokscale-usage] .tu-kpi:active { transform: scale(.985); }
      [data-tokscale-usage] .tu-kpi-hero { box-shadow: var(--tu-shadow-1), inset 0 2px 0 var(--tu-accent); }
      [data-tokscale-usage] .tu-summary { display: grid; grid-template-columns: minmax(0, 1.54fr) minmax(0, 1fr); gap: var(--tu-sp-4); align-items: stretch; }
      [data-tokscale-usage] .tu-tri { display: grid; grid-template-columns: minmax(0, .88fr) minmax(0, 1.02fr) minmax(0, 1.24fr); gap: var(--tu-sp-4); align-items: stretch; }
      [data-tokscale-usage] .tu-deep { display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr); gap: var(--tu-sp-4); align-items: stretch; content-visibility: auto; contain-intrinsic-size: auto 280px; }
      [data-tokscale-usage] .tu-deep-single { display: grid; grid-template-columns: minmax(0, 1fr); content-visibility: auto; contain-intrinsic-size: auto 260px; }
      [data-tokscale-usage] .tu-bento-card { display: flex; flex-direction: column; justify-content: space-between; gap: var(--tu-sp-4); height: 100%; box-sizing: border-box; }
      [data-tokscale-usage] .tu-tasks-sec { content-visibility: auto; contain-intrinsic-size: auto 320px; }
      [data-tokscale-usage] .tu-tasks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--tu-sp-4); align-items: stretch; }
      [data-tokscale-usage] .tu-task-card { border: 1px solid var(--tu-line); background: var(--tu-s1); border-radius: var(--tu-r-md); padding: var(--tu-sp-4); display: flex; flex-direction: column; justify-content: space-between; gap: var(--tu-sp-2); min-width: 0; transition: border-color var(--tu-d1) var(--tu-ease); }
      [data-tokscale-usage] .tu-task-card:hover { border-color: var(--tu-line-strong); }
      [data-tokscale-usage] .tu-heat-wrap { display: flex; align-items: start; gap: var(--tu-sp-2); }
      [data-tokscale-usage] .tu-heat-days { display: grid; grid-template-rows: repeat(7, 14px); gap: 3px; font-size: var(--tu-fs-1); color: var(--tu-ink-3); line-height: 14px; text-align: right; user-select: none; }
      [data-tokscale-usage] .tu-heat-grid { display: grid; grid-auto-flow: column; grid-template-rows: repeat(7, 14px); gap: 3px; overflow-x: auto; padding: 2px 0 4px; flex: 1; }
      [data-tokscale-usage] .tu-heat-cell { width: 14px; height: 14px; border-radius: var(--tu-r-sm); border: 0; padding: 0; cursor: pointer; outline-offset: -1px; }
      [data-tokscale-usage] .tu-heat-cell:hover { outline: 1px solid color-mix(in oklab, var(--tu-ink) 40%, transparent); }
      [data-tokscale-usage] .tu-heat-cell.in-window { outline: 1px solid color-mix(in oklab, var(--tu-accent) 60%, transparent); }
      [data-tokscale-usage] .tu-heat-cell.selected, [data-tokscale-usage] .tu-heat-cell.linked { outline: 2px solid var(--tu-ink); }
      [data-tokscale-usage] .tu-row-btn {
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        color: var(--tu-ink);
        font: inherit;
        cursor: pointer;
        border-radius: var(--tu-r-md);
        padding: var(--tu-sp-1) var(--tu-sp-3);
        box-shadow: inset 2px 0 0 transparent;
        transition: background-color var(--tu-d1) var(--tu-ease), box-shadow var(--tu-d1) var(--tu-ease);
      }
      [data-tokscale-usage] .tu-row-btn:hover { background: var(--tu-s2); }
      [data-tokscale-usage] .tu-ws-row { width: 100%; text-align: left; font: inherit; color: var(--tu-ink); border: 1px solid var(--tu-line); border-radius: var(--tu-r-md); padding: var(--tu-sp-3) var(--tu-sp-4); background: var(--tu-s1); cursor: pointer; display: grid; gap: var(--tu-sp-1); transition: border-color var(--tu-d1) var(--tu-ease), background-color var(--tu-d1) var(--tu-ease); }
      [data-tokscale-usage] .tu-ws-row:hover { border-color: var(--tu-line-strong); }
      [data-tokscale-usage] button:focus-visible, [data-tokscale-usage] select:focus-visible, [data-tokscale-usage] input:focus-visible, [data-tokscale-usage] svg:focus-visible {
        outline: 2px solid var(--tu-accent);
        outline-offset: 2px;
      }
      @container studio (max-width: 1120px) {
        [data-tokscale-usage] .tu-kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        [data-tokscale-usage] .tu-summary, [data-tokscale-usage] .tu-tri, [data-tokscale-usage] .tu-deep { grid-template-columns: 1fr; }
        [data-tokscale-usage] .tu-tasks { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      }
      @container studio (max-width: 680px) {
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

    // Smooth monotone-clamped cubic Bezier path & closed area builder (prevents overshoot below baseline)
    function buildSmoothCurve(points, baseY) {
      if (!points.length) return { lineD: '', areaD: '' };
      if (points.length === 1) {
        const p = points[0];
        return {
          lineD: `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
          areaD: `M ${p.x.toFixed(1)} ${baseY.toFixed(1)} L ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${p.x.toFixed(1)} ${baseY.toFixed(1)} Z`,
        };
      }
      let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const minSegY = Math.min(p1.y, p2.y);
        const maxSegY = Math.max(p1.y, p2.y);
        const cp1y = Math.max(minSegY, Math.min(baseY, Math.min(maxSegY, p1.y + (p2.y - p0.y) / 6)));
        const cp2y = Math.max(minSegY, Math.min(baseY, Math.min(maxSegY, p2.y - (p3.y - p1.y) / 6)));
        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
      const areaD = `M ${points[0].x.toFixed(1)} ${baseY.toFixed(1)} L ${d.slice(2)} L ${points[points.length - 1].x.toFixed(1)} ${baseY.toFixed(1)} Z`;
      return { lineD: d, areaD };
    }

    // Unified DLS Ring Family Specification (5 calibrated tiers)
    const RING = {
      xl: { D: 112, sw: 13 },
      l: { D: 88, sw: 11 },
      m: { D: 72, sw: 9 },
      s: { D: 54, sw: 4.5 },
      xs: { D: 36, sw: 4 },
    };

    const cardHead = (titleText, metaNode = null, actionsNode = null) => h('div', { className: 'tu-card-hd' },
      h('strong', { className: 'tu-card-hd__title' }, titleText),
      metaNode ? h('div', { className: 'tu-card-hd__meta' }, metaNode) : null,
      actionsNode ? h('div', { className: 'tu-card-hd__actions' }, actionsNode) : null);

    const valUnit = (valStr, unitStr, extraCls = '') => h('span', { className: 'tu-val' + (extraCls ? ' ' + extraCls : '') },
      valStr,
      unitStr ? h('span', { className: 'tu-unit' }, unitStr) : null);

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
      const [, bump] = useState(0);
      useEffect(() => store.subscribe(() => bump(n => n + 1)), [store]);
      return selector(store.get());
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

    // Live DSH host theme detector: synchronizes `data-tu-theme="light|dark"` from host DOM classes, data-theme, or surface luminance
    function detectHostTheme(el) {
      if (typeof document === 'undefined') return 'light';
      const checkAttr = node => {
        if (!node) return '';
        const dt = String(node.getAttribute?.('data-theme') || node.getAttribute?.('data-color-mode') || node.dataset?.theme || '').toLowerCase();
        if (dt.includes('dark')) return 'dark';
        if (dt.includes('light')) return 'light';
        const cls = node.classList;
        if (cls?.contains?.('dark') || cls?.contains?.('theme-dark')) return 'dark';
        if (cls?.contains?.('light') || cls?.contains?.('theme-light')) return 'light';
        return '';
      };
      for (let cur = el?.parentElement; cur; cur = cur.parentElement) {
        const hit = checkAttr(cur);
        if (hit) return hit;
      }
      const rootHit = checkAttr(document.documentElement) || checkAttr(document.body);
      if (rootHit) return rootHit;
      if (typeof getComputedStyle === 'function') {
        for (const probe of [el?.parentElement, document.body, document.documentElement]) {
          if (!probe) continue;
          const bg = getComputedStyle(probe).backgroundColor || '';
          const m = bg.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/i);
          if (m && (m[4] === undefined || Number(m[4]) > 0.15)) {
            const lum = (0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3])) / 255;
            return lum < 0.44 ? 'dark' : 'light';
          }
        }
      }
      if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
      return 'light';
    }

    function useHostTheme(rootRef, manualOverride) {
      useEffect(() => {
        const el = rootRef.current;
        if (!el) return undefined;
        const sync = () => {
          const mode = manualOverride === 'light' || manualOverride === 'dark' ? manualOverride : detectHostTheme(el);
          el.setAttribute('data-tu-theme', mode);
          el.style.colorScheme = mode;
        };
        sync();
        const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
        mq?.addEventListener?.('change', sync);
        let mo = null;
        if (typeof MutationObserver === 'function' && typeof document !== 'undefined') {
          mo = new MutationObserver(sync);
          if (document.documentElement) mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode'] });
          if (document.body) mo.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-mode'] });
        }
        return () => {
          mq?.removeEventListener?.('change', sync);
          mo?.disconnect?.();
        };
      }, [rootRef, manualOverride]);
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
      const baseCol = deltaInfo?.intraday ? C.accent : (up ? C.warn : C.ok);
      const txt = (up ? '▲ +' : '▼ ') + Math.min(999, Math.abs(pctVal * 100)).toFixed(1) + '%' + (deltaInfo?.partial ? '*' : '');
      return h('span', {
        title: tip,
        className: 'tu-num',
        style: { fontSize: 'var(--tu-fs-2xs)', fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: soft(baseCol, 14), color: ink(baseCol, 76), whiteSpace: 'nowrap' },
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
    const KpiStrip = memo(function KpiStrip({ m, daily, hourly, periodDelta, monthlyProjection, execProfile, tm, tp, fallback, activeAgentsCount, activeModelsCount, workspacesCount, totalTasks, actions }) {
      const decodeTps = tp?.decodeTokensPerSec;
      const engineTps = tp?.engineTokensPerSec;
      const avgTps = decodeTps ?? engineTps ?? tp?.avgTokensPerSec;
      const activeDaysCount = daily.filter(d => (d.totalTokens || 0) > 0).length;
      const costPeakDay = daily.reduce((pk, d) => (!pk || (d.cost || 0) > (pk.cost || 0) ? d : pk), null);

      const hourlyPts = Array.isArray(hourly) && hourly.some(x => (x?.totalTokens || 0) > 0) ? hourly.map(x => x.totalTokens || 0) : null;
      const tokenSpark = renderSparkline(daily.length >= 2 ? daily.slice(-14).map(d => d.totalTokens || 0) : (hourlyPts || []), C.accent);
      const costSpark = renderSparkline(daily.length >= 2 ? daily.slice(-14).map(d => d.cost || 0) : (Array.isArray(hourly) && hourly.some(x => (x?.cost || 0) > 0) ? hourly.map(x => x.cost || 0) : []), C.spend);

      const kpiTotal = [m.input, m.output, m.reasoning, m.cacheRead, m.cacheWrite].reduce((s, v) => s + (Number.isFinite(v) && v > 0 ? v : 0), 0);
      const totalMiniBar = !tokenSpark && kpiTotal > 0
        ? h('div', { 'aria-hidden': true, className: 'tu-meter', style: { marginTop: 6 } },
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
        ? h('svg', { width: RING.xs.D, height: RING.xs.D, viewBox: '0 0 36 36', 'aria-hidden': true, style: { flex: '0 0 36px' } },
            h('circle', { cx: 18, cy: 18, r: 14, className: 'tu-ring-track', strokeWidth: RING.xs.sw }),
            h('circle', {
              className: 'tu-arc',
              cx: 18, cy: 18, r: 14, fill: 'none', stroke: TOKEN_COLORS.cacheRead, strokeWidth: RING.xs.sw, strokeLinecap: 'round',
              style: { strokeDasharray: `${(hitRateRatio * 87.96).toFixed(1)} 88` },
              transform: 'rotate(-90 18 18)',
            }))
        : null;

      const so = execProfile?.sessionOrigins;
      const sessionSub = so && (so.mainCount + so.subagentCount > 0)
        ? t(`${activeDaysCount > 0 ? `${activeDaysCount} 活跃天 · ` : ''}主 ${so.mainCount} / 子 ${so.subagentCount}`, `${activeDaysCount > 0 ? `${activeDaysCount} active d · ` : ''}${so.mainCount} main / ${so.subagentCount} sub`)
        : activeDaysCount > 0
          ? t(`${activeDaysCount} 个活跃日` + (tm?.max_concurrent_sessions ? ` · 峰值并发 ${tm.max_concurrent_sessions}` : ''), `${activeDaysCount} active days`)
          : `${t('输出', 'Output')} ${compact(m.output)}`;

      const wallMs = Number(m.totalTokens) > 0 ? (execProfile?.timingBreakdown?.wallMs || tm?.total_active_time_ms || 0) : 0;
      const eomCost = monthlyProjection?.projectedCost > 0 ? monthlyProjection.projectedCost : null;
      const costSubParts = [];
      if (eomCost) costSubParts.push(t(`预计月底 ${shortCost(eomCost)}`, `EOM est. ${shortCost(eomCost)}`));
      else if (activeDaysCount > 1 && Number.isFinite(m.cost) && m.cost > 0) costSubParts.push(t(`日均 ${shortCost(m.cost / activeDaysCount)}`, `${shortCost(m.cost / activeDaysCount)}/d`));
      if (costPeakDay && costPeakDay.cost > 0) costSubParts.push(t(`峰值 ${costPeakDay.date.slice(5)}`, `Peak ${costPeakDay.date.slice(5)}`));
      const costSubtitle = costSubParts.join(' · ') || t('tokscale 估算 (非账单)', 'tokscale estimate');

      const useSessionFallbackOnHero = (m.totalTokens === 0 || m.totalTokens == null) && fallback?.totalTokens > 0;
      const tokenSubtitle = useSessionFallbackOnHero
        ? t(`≈ 会话日志捕获 (${fallback.clients.join(', ')})`, `≈ From ${fallback.sessionCount} live session logs`)
        : `${t('输入', 'In')} ${compact(m.input)} · ${t('推理', 'Reas')} ${compact(m.reasoning)} · ${t('输出', 'Out')} ${compact(m.output)}`;

      const cards = [
        {
          id: 'tokens',
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
          id: 'cost',
          hero: true,
          name: t('估算费用', 'Est. cost'),
          valNode: Number.isFinite(m.cost) ? h(AnimatedNumber, { value: m.cost, format: shortCost }) : h('span', { className: 'tu-num' }, '—'),
          valTitle: Number.isFinite(m.cost) ? `${cost(m.cost)} — ${t('基于 tokscale 模型定价估算，非实际账单', 'tokscale model pricing estimate, not a bill')}` : undefined,
          sub: costSubtitle,
          visual: costSpark,
          badge: renderDeltaBadge(periodDelta?.costDeltaPct, periodDelta, 'cost'),
        },
        {
          id: 'cache',
          name: t('缓存命中率', 'Cache hit rate'),
          valNode: h('span', { className: 'tu-num' }, pct(m.cacheHitRate)),
          sub: `${t('复用读取', 'Cache read')} ${compact(m.cacheRead)}`,
          badge: hitGauge,
        },
        {
          id: 'tasks',
          name: t('消息 & 活跃规模', 'Messages & activity'),
          valNode: h('span', { className: 'tu-num' }, num(m.messages)),
          sub: sessionSub,
        },
        {
          id: 'speed',
          name: t('解码吞吐 & 首字时延', 'Throughput & TTFT'),
          valNode: h('span', { className: 'tu-num' }, Number.isFinite(avgTps) ? tpsFmt(avgTps) : '—'),
          sub: [
            Number.isFinite(tp?.avgTtftMs) ? `TTFT ${(tp.avgTtftMs / 1000).toFixed(1)}s` : null,
            wallMs > 0 ? t(`活跃时长 ${durFmt(wallMs)}`, `Active ${durFmt(wallMs)}`) : null,
          ].filter(Boolean).join(' · ') || t('等待计时样本', 'Awaiting timing samples'),
        },
        {
          id: 'coverage',
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
          role: 'button',
          tabIndex: 0,
          onClick: () => actions?.jumpKpi?.(c.id),
          onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); actions?.jumpKpi?.(c.id); } },
          className: 'tu-card tu-kpi' + (c.hero ? ' tu-kpi-hero' : ''),
        },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 } },
          h('div', { style: { minWidth: 0 } },
            h('div', { style: { color: C.muted, fontSize: 'var(--tu-fs-xs)' } }, c.name),
            h('div', {
              title: c.valTitle,
              style: { fontSize: c.hero ? 'clamp(18px, 11cqi, 24px)' : 'clamp(16px, 9.5cqi, 21px)', fontWeight: 600, marginTop: 2, letterSpacing: '-0.015em' },
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
          borderColor: `color-mix(in oklab, ${C.warn} 42%, var(--tu-line))`,
          background: soft(C.warn, 9),
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        },
      },
      h('div', { style: { fontSize: 'var(--tu-fs-xs)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 } },
        h('strong', { style: { color: ink(C.warn, 76) } }, t('部分引擎扫描未完成 · 已启用会话日志即时兜底', 'Partial scan · showing live session-log fallback')),
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

    // Isolated hover overlay: ONLY this tiny layer re-renders when scrubbing across 60 slots!
    const TrendHoverLayer = memo(function TrendHoverLayer({ hover, chartItems, xAt, W, mode, showHourly, hiddenSet, clientColorMap }) {
      const idx = useHoverSelector(hover, s => s.idx);
      const pinnedIdx = useHoverSelector(hover, s => s.pinnedIdx);
      const hoverDate = useHoverSelector(hover, s => s.date);
      const pinnedDate = useHoverSelector(hover, s => s.pinnedDate);
      const effDate = pinnedDate || hoverDate;
      const effIdx = pinnedIdx != null ? pinnedIdx : idx;
      const activeIndex = effIdx != null && chartItems[effIdx]
        ? effIdx
        : (effDate && !showHourly ? chartItems.findIndex(d => d.date === effDate) : -1);
      const item = activeIndex >= 0 ? chartItems[activeIndex] : null;
      const isPinned = pinnedIdx != null || Boolean(pinnedDate && !showHourly && activeIndex >= 0);
      const x = item ? Math.round(xAt(activeIndex)) : 0;
      const tipW = 248;
      const tx = Math.max(4, Math.min(Math.max(4, W - tipW - 4), x > W * 0.58 ? x - tipW - 14 : x + 14));

      return h(React.Fragment, null,
        h('div', {
          className: 'tu-crosshair',
          'aria-hidden': true,
          style: {
            transform: `translate3d(${x}px, 0, 0)`,
            opacity: item ? 1 : 0,
            borderLeftColor: isPinned ? C.accent : undefined,
          },
        }),
        h('div', {
          className: 'tu-tip',
          role: 'tooltip',
          'aria-live': 'polite',
          style: { transform: `translate3d(${tx}px, 0, 0)`, opacity: item ? 1 : 0 },
        },
        item
          ? h(React.Fragment, null,
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, fontWeight: 600 } },
                h('span', { className: 'tu-num', style: { color: C.accentInk } }, (isPinned ? '📌 ' : '') + (item.date || item.hour)),
                valUnit(compact(item.visibleTokens ?? item.totalTokens), 'tok')),
              h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '2px 8px', color: C.muted, fontSize: 'var(--tu-fs-2xs)' } },
                Number.isFinite(item.visibleCost ?? item.cost) && (item.visibleCost ?? item.cost) > 0
                  ? h('span', { className: 'tu-num', style: { color: ink(C.spend, 76), fontWeight: 600 } }, cost(item.visibleCost ?? item.cost))
                  : null,
                mode === 'cumulative' && Number.isFinite(item.cumCost)
                  ? h('span', { className: 'tu-num' }, `${t('累计', 'Cum')} ${shortCost(item.cumCost)}`)
                  : null,
                mode === 'cacheHit' && Number.isFinite(item.hitRate)
                  ? h('span', { className: 'tu-num', style: { color: ink(TOKEN_COLORS.cacheRead, 74) } }, `${t('命中', 'Hit')} ${pct(item.hitRate)}`)
                  : null,
                item.messages ? h('span', { className: 'tu-num' }, `${num(item.messages)} msgs`) : null),
              item.byClient && !showHourly
                ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '2px 8px', fontSize: 'var(--tu-fs-2xs)', borderTop: '1px solid ' + C.border, paddingTop: 3 } },
                    ...Object.entries(item.byClient)
                      .filter(([cn]) => !hiddenSet.has(cn))
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 4)
                      .map(([cn, cv]) => h('span', { key: cn, className: 'tu-num' }, dot(clientColorMap.get(cn) || colorForAgent(cn)), `${cn} ${compact(cv)}`)))
                : null,
              !showHourly && item.date
                ? h('div', { style: { fontSize: 'var(--tu-fs-2xs)', color: C.ink3, paddingTop: 2 } },
                    isPinned ? t('已锁定检视 · 单击取消 · 双击跳转单日', 'Pinned · Click to unpin · Double-click day') : t('单击锁定检视 · 双击跳转单日', 'Click to pin · Double-click day to filter'))
                : null)
          : null));
    });

    const SvgTrendWorkbench = memo(function SvgTrendWorkbench({
      daily, hourly, m, meta, agentOrder, clientColorMap, monthlyProjection, hover, actions,
      requestedMode, isSingleDayWindow, canExitSingleDay,
    }) {
      const [mode, setMode] = useState('auto'); // 'auto' | 'stacked' | 'cumulative' | 'cacheHit' | 'hourly'
      const [zoom, setZoom] = useState('recent60');
      const [hiddenAgents, setHiddenAgents] = useState(() => []);
      const [boxRef, W] = useElementWidth(660);
      const rafRef = useRef(0);

      useEffect(() => {
        if (requestedMode && requestedMode.mode) setMode(requestedMode.mode);
      }, [requestedMode]);

      // Clear local pinned slot whenever chart dataset or mode changes
      useEffect(() => {
        if (hover.get().pinnedIdx != null) hover.set({ pinnedIdx: null, idx: null });
      }, [daily, hourly, mode, zoom, hover]);

      const hasHourly = Array.isArray(hourly) && hourly.some(x => (x?.totalTokens || 0) > 0);
      const effMode = mode === 'auto'
        ? (isSingleDayWindow && hasHourly ? 'hourly' : 'stacked')
        : (mode === 'hourly' && !hourly.length ? 'stacked' : mode);
      const showHourly = effMode === 'hourly' && hourly.length > 0;
      const isSingleDaySummaryOnly = Boolean(isSingleDayWindow && !showHourly && daily.length <= 1);
      const canZoom = !showHourly && !isSingleDayWindow && daily.length > 60;
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
      } else if (isSingleDaySummaryOnly) {
        // Single-day fallback without sub-hour buckets: render a proportional ring & meter breakdown (NEVER a lonely 1-bar histogram!)
        const dayObj = enrichedDaily[0] || { date: meta?.sinceDate || '', totalTokens: m?.totalTokens || 0, cost: m?.cost || 0, messages: m?.messages || 0, byClient: {} };
        const clientRows = dayObj.byClient && Object.keys(dayObj.byClient).length > 0
          ? Object.entries(dayObj.byClient).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
          : [];
        const dayTok = Math.max(1, dayObj.totalTokens || m?.totalTokens || 0);
        const promptTok = (dayObj.input ?? m?.input ?? 0) + (dayObj.cacheRead ?? m?.cacheRead ?? 0) + (dayObj.cacheWrite ?? m?.cacheWrite ?? 0);
        const genTok = (dayObj.output ?? m?.output ?? 0) + (dayObj.reasoning ?? m?.reasoning ?? 0);
        const R = 31, CIRC = 2 * Math.PI * R;
        let cum = 0;
        const ringArcsNodes = (clientRows.length ? clientRows : [['total', dayTok]]).map(([cn, val]) => {
          const ratio = val / dayTok;
          const start = cum;
          cum += ratio;
          const len = Math.max(0.8, ratio * CIRC - (clientRows.length > 1 ? 1.5 : 0));
          return h('circle', {
            key: cn,
            className: 'tu-arc',
            cx: 40, cy: 40, r: R, fill: 'none',
            stroke: cn === 'total' ? C.accent : (clientColorMap.get(cn) || colorForAgent(cn)),
            strokeWidth: 9,
            strokeDasharray: `${len.toFixed(2)} ${CIRC.toFixed(2)}`,
            strokeDashoffset: `${(-start * CIRC).toFixed(2)}`,
            transform: 'rotate(-90 40 40)',
          });
        });

        body = h('div', {
          className: 'tu-well tu-enter',
          title: `${dayObj.date}: ${num(dayObj.totalTokens)}`,
          style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, marginTop: 6, flex: 1 },
        },
        h('div', { style: { position: 'relative', width: 80, height: 80, flex: '0 0 80px', display: 'grid', placeItems: 'center' } },
          h('svg', { width: 80, height: 80, viewBox: '0 0 80 80', 'aria-hidden': true },
            h('circle', { cx: 40, cy: 40, r: R, className: 'tu-ring-track', strokeWidth: 9 }),
            ...ringArcsNodes),
          h('div', { style: { position: 'absolute', inset: 14, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none', lineHeight: 1.15 } },
            h('strong', { className: 'tu-num', style: { fontSize: 'var(--tu-fs-1)' } }, compact(dayObj.totalTokens)),
            h('span', { style: { fontSize: 10, color: C.muted } }, dayObj.date ? dayObj.date.slice(5) : t('单日', 'Day')))),
        h('div', { style: { flex: 1, minWidth: 200, display: 'grid', gap: 8 } },
          h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 } },
            h('strong', { style: { fontSize: 'var(--tu-fs-3)' } }, `${dayObj.date || t('当前单日', 'Selected day')} · ${t('单日用量全景', 'Single-day profile')}`),
            h('span', { className: 'tu-num', style: { fontSize: 'var(--tu-fs-2)', color: C.muted } },
              [dayObj.cost > 0 ? shortCost(dayObj.cost) : null, dayObj.messages > 0 ? `${num(dayObj.messages)} msgs` : null].filter(Boolean).join(' · '))),
          h('div', { className: 'tu-meter tu-meter--md' },
            ...[
              [dayObj.cacheRead ?? m?.cacheRead ?? 0, TOKEN_COLORS.cacheRead],
              [dayObj.input ?? m?.input ?? 0, TOKEN_COLORS.input],
              [dayObj.output ?? m?.output ?? 0, TOKEN_COLORS.output],
              [dayObj.reasoning ?? m?.reasoning ?? 0, TOKEN_COLORS.reasoning],
            ].map(([v, col], idx) => v > 0 ? h('div', { key: idx, style: { width: `${Math.max(2, (v / dayTok) * 100)}%`, background: col } }) : null)),
          h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 'var(--tu-fs-1)', color: C.muted } },
            promptTok > 0 ? h('span', { className: 'tu-num' }, dot(TOKEN_COLORS.cacheRead), `${t('上下文侧', 'Prompt')} ${compact(promptTok)}`) : null,
            genTok > 0 ? h('span', { className: 'tu-num' }, dot(TOKEN_COLORS.output), `${t('生成解码', 'Generated')} ${compact(genTok)}`) : null,
            ...clientRows.slice(0, 4).map(([cn, cv]) => h('span', { key: cn, className: 'tu-num' }, dot(clientColorMap.get(cn) || colorForAgent(cn)), `${cn} ${compact(cv)}`)))));
      } else {
        const maxSubLaneCost = (effMode === 'stacked' || showHourly)
          ? Math.max(...chartItems.map(d => (showHourly ? d.cost : d.visibleCost) || 0), 0)
          : 0;
        const hasSpendSubLane = maxSubLaneCost > 0;
        const H = hasSpendSubLane ? 214 : 184;
        const padL = 52, padR = 16, padT = 14, padB = 22;
        const plotW = Math.max(120, W - padL - padR);
        const totalPlotH = H - padT - padB;
        const subGap = hasSpendSubLane ? 12 : 0;
        const subH = hasSpendSubLane ? 34 : 0;
        const mainH = totalPlotH - subGap - subH;
        const mainBaseY = padT + mainH;
        const subTopY = mainBaseY + subGap;
        const subBaseY = subTopY + subH;

        const hasProjection = !showHourly && effMode === 'cumulative' && hiddenSet.size === 0 && monthlyProjection?.projectedCost > 0 && monthlyProjection.daysInMonth > monthlyProjection.daysElapsed;
        const totalSlots = hasProjection ? Math.max(nPts + 1, monthlyProjection.daysInMonth) : nPts;
        const slotW = plotW / totalSlots;
        const xAt = i => padL + (i + 0.5) * slotW;
        const barW = Math.min(28, Math.max(3.5, slotW * 0.66));

        const rawPrimaryMax = (() => {
          if (showHourly) return Math.max(...chartItems.map(d => d.totalTokens || 0), 1);
          if (effMode === 'cumulative') {
            const lastCum = enrichedDaily[enrichedDaily.length - 1]?.cumCost || 0;
            return Math.max(lastCum, hasProjection ? monthlyProjection.projectedCost : 0, 0.01);
          }
          if (effMode === 'cacheHit') return 1;
          return Math.max(...enrichedDaily.map(d => Math.max(d.visibleTokens || 0, d.ma7Tokens || 0)), 1);
        })();

        const yAxis = effMode === 'cacheHit' ? { max: 1, step: 0.25 } : niceAxis(rawPrimaryMax, 4);
        const yAt = v => padT + mainH - Math.max(0, Math.min(1, v / (yAxis.max || 1))) * mainH;

        const spendAxis = hasSpendSubLane ? niceAxis(maxSubLaneCost, 2) : null;
        const ySpendAt = v => subTopY + subH - Math.max(0, Math.min(1, v / (spendAxis?.max || 1))) * subH;

        const toPathD = (arr, yGetter) => arr.length >= 2
          ? 'M ' + arr.map((d, i) => `${xAt(i).toFixed(1)} ${yGetter(d).toFixed(1)}`).join(' L ')
          : '';

        // Smooth spline curve for 24h intraday (no bar histogram on single-day!) & synchronized Spend Sub-Lane
        const intradayPts = showHourly ? chartItems.map((d, i) => ({ x: xAt(i), y: yAt(d.totalTokens || 0), v: d.totalTokens || 0, hour: d.hour, cost: d.cost || 0 })) : EMPTY;
        const intradayCurve = showHourly ? buildSmoothCurve(intradayPts, mainBaseY) : null;
        const peakHourPt = showHourly
          ? intradayPts.reduce((pk, p) => (!pk || p.v > pk.v ? p : pk), null)
          : null;

        const spendCurve = hasSpendSubLane
          ? buildSmoothCurve(chartItems.map((d, i) => ({ x: xAt(i), y: ySpendAt((showHourly ? d.cost : d.visibleCost) || 0) })), subBaseY)
          : null;

        const maPathD = !showHourly && effMode === 'stacked' && nPts >= 3 ? toPathD(enrichedDaily, d => yAt(d.ma7Tokens || 0)) : '';
        const cumCurve = !showHourly && effMode === 'cumulative'
          ? buildSmoothCurve(enrichedDaily.map((d, i) => ({ x: xAt(i), y: yAt(d.cumCost || 0) })), mainBaseY)
          : null;
        const projPathD = hasProjection && nPts >= 1
          ? `M ${xAt(nPts - 1).toFixed(1)} ${yAt(enrichedDaily[nPts - 1].cumCost || 0).toFixed(1)} L ${xAt(totalSlots - 1).toFixed(1)} ${yAt(monthlyProjection.projectedCost).toFixed(1)}`
          : '';
        const hitCurve = !showHourly && effMode === 'cacheHit'
          ? buildSmoothCurve(enrichedDaily.map((d, i) => ({ x: xAt(i), y: yAt(d.hitRate || 0) })), mainBaseY)
          : null;

        const xTickIndices = (() => {
          if (nPts <= 7) return chartItems.map((_, i) => i);
          if (showHourly && nPts === 24) return [0, 4, 8, 12, 16, 20, 23];
          const step = Math.max(1, Math.floor((nPts - 1) / 5));
          const list = [];
          for (let i = 0; i < nPts; i += step) list.push(i);
          if (list[list.length - 1] !== nPts - 1) list.push(nPts - 1);
          return list;
        })();

        const slotIndexFromEvent = e => {
          const rect = e.currentTarget.getBoundingClientRect();
          const rawIdx = Math.floor((e.clientX - rect.left - padL) / slotW);
          return rawIdx >= 0 && rawIdx < nPts ? rawIdx : null;
        };

        const handlePointerMove = e => {
          if (hover.get().pinnedIdx != null) return;
          const rawIdx = slotIndexFromEvent(e);
          if (rafRef.current) return;
          const commit = () => {
            rafRef.current = 0;
            hover.set({ idx: rawIdx, date: rawIdx != null ? (chartItems[rawIdx]?.date || null) : null });
          };
          if (typeof requestAnimationFrame === 'function') rafRef.current = requestAnimationFrame(commit);
          else commit();
        };

        // Global contract: Single-click = Pin/Unpin inspection; Double-click = Drill into day
        const handlePointerClick = e => {
          const idx = slotIndexFromEvent(e);
          if (idx == null) return;
          const wasPinned = hover.get().pinnedIdx === idx;
          const nextPin = wasPinned ? null : idx;
          const nextDate = nextPin != null ? (chartItems[nextPin]?.date || null) : null;
          hover.set({ pinnedIdx: nextPin, idx: nextPin ?? idx, pinnedDate: nextDate, date: chartItems[idx]?.date || null });
        };

        const handlePointerDoubleClick = e => {
          if (showHourly) return;
          const idx = slotIndexFromEvent(e);
          if (idx != null && chartItems[idx]?.date) {
            hover.set({ pinnedIdx: null, pinnedDate: null });
            actions.pickDate(chartItems[idx].date);
          }
        };

        const handleSvgKeyDown = e => {
          const cur = hover.get().pinnedIdx ?? hover.get().idx;
          if (e.key === 'Escape' && hover.get().pinnedIdx != null) {
            e.preventDefault();
            hover.set({ pinnedIdx: null, pinnedDate: null });
          } else if (e.key === 'ArrowRight') {
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
          style: { position: 'relative', marginTop: 6, '--pt': `${padT}px`, '--pb': `${padB}px` },
          onMouseLeave: () => {
            if (hover.get().pinnedIdx == null) hover.set({ idx: null, date: null });
          },
        },
        h(TrendHoverLayer, { hover, chartItems, xAt, W, mode: effMode, showHourly, hiddenSet, clientColorMap }),
        h('svg', {
          width: W,
          height: H,
          viewBox: `0 0 ${W} ${H}`,
          tabIndex: 0,
          'aria-label': showHourly ? t('24h 分时平滑曲线图', '24h intraday area curve') : t('每日用量趋势图', 'Daily usage trend chart'),
          onKeyDown: handleSvgKeyDown,
          style: { width: '100%', height: H, display: 'block', overflow: 'visible' },
        },
        h('defs', null,
          h('linearGradient', { id: 'tu-area-cool', x1: '0', y1: '0', x2: '0', y2: '1' },
            h('stop', { offset: '0%', stopColor: COOL_PALETTE[0], stopOpacity: 0.26 }),
            h('stop', { offset: '100%', stopColor: COOL_PALETTE[0], stopOpacity: 0.01 })),
          h('linearGradient', { id: 'tu-area-spend', x1: '0', y1: '0', x2: '0', y2: '1' },
            h('stop', { offset: '0%', stopColor: C.spend, stopOpacity: 0.22 }),
            h('stop', { offset: '100%', stopColor: C.spend, stopOpacity: 0.01 }))),

        // Main lane horizontal gridlines & Y-axis labels
        ...[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const y = crisp(padT + (1 - frac) * mainH);
          const val = yAxis.max * frac;
          const leftLabel = effMode === 'cumulative'
            ? shortCost(val)
            : effMode === 'cacheHit'
              ? `${Math.round(val * 100)}%`
              : compact(val);
          return h('g', { key: frac },
            h('line', { x1: padL, y1: y, x2: W - padR, y2: y, className: frac === 0 ? 'tu-baseline' : 'tu-grid-line' }),
            h('text', { x: padL - 7, y: y + 3.5, textAnchor: 'end', className: 'tu-axis-text tu-num' }, leftLabel));
        }),

        // Mode A: 24h Intraday Smooth Area Curve (replaces vertical bar chart on single-day!)
        showHourly && intradayCurve
          ? h('g', { className: 'tu-enter' },
              intradayCurve.areaD ? h('path', { d: intradayCurve.areaD, fill: 'url(#tu-area-cool)' }) : null,
              intradayCurve.lineD ? h('path', { d: intradayCurve.lineD, fill: 'none', stroke: COOL_PALETTE[0], strokeWidth: 2.1, strokeLinecap: 'round', strokeLinejoin: 'round' }) : null,
              ...intradayPts.map(p => p.v > 0 ? h('circle', {
                key: p.hour,
                cx: p.x,
                cy: p.y,
                r: peakHourPt && peakHourPt.hour === p.hour ? 3.8 : 2.3,
                fill: peakHourPt && peakHourPt.hour === p.hour ? C.s1 : COOL_PALETTE[0],
                stroke: COOL_PALETTE[0],
                strokeWidth: peakHourPt && peakHourPt.hour === p.hour ? 2.2 : 0,
              }, h('title', null, `${p.hour}: ${num(p.v)}` + (p.cost > 0 ? ` · ${cost(p.cost)}` : ''))) : null),
              peakHourPt && peakHourPt.v > 0
                ? h('text', {
                    x: Math.max(padL + 36, Math.min(W - padR - 36, peakHourPt.x)),
                    y: Math.max(padT + 10, peakHourPt.y - 7),
                    textAnchor: 'middle',
                    fill: C.ink,
                    fontSize: 10.5,
                    fontWeight: 600,
                    className: 'tu-svg-halo tu-num',
                  }, `${peakHourPt.hour} · ${compact(peakHourPt.v)}`)
                : null)
          : null,

        // Mode B: Multi-day Stacked Agent Bars
        !showHourly && effMode === 'stacked'
          ? h('g', { key: `stacked-${zoom}` },
              ...chartItems.map((d, i) => {
                const cx = xAt(i);
                const bx = cx - barW / 2;
                const lbl = String(d.date || '');
                const rawTok = d.visibleTokens || 0;
                const titleText = `${lbl}: ${num(d.totalTokens)}` + (Number.isFinite(d.cost) && d.cost > 0 ? ` · ${cost(d.cost)}` : '');

                if (d.byClient && Object.keys(d.byClient).length > 0 && rawTok > 0) {
                  const totalBarH = Math.min(mainH, Math.max(2, (rawTok / (yAxis.max || 1)) * mainH));
                  let yBottom = mainBaseY;
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
                        fillOpacity: 0.9,
                        style: { y: `${yBottom.toFixed(1)}px`, height: `${Math.max(0.8, segH).toFixed(1)}px` },
                      });
                    }));
                }

                const barH = rawTok > 0 ? Math.min(mainH, Math.max(2, (rawTok / (yAxis.max || 1)) * mainH)) : 0;
                const by = mainBaseY - barH;
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
                        fill: COOL_PALETTE[0],
                        fillOpacity: 0.88,
                        style: { y: `${by.toFixed(1)}px`, height: `${barH.toFixed(1)}px` },
                      })
                    : null);
              }))
          : null,

        // Mode C: Cumulative Spend + EOM Projection
        effMode === 'cumulative' && !showHourly && cumCurve
          ? h('g', { className: 'tu-enter' },
              cumCurve.areaD ? h('path', { d: cumCurve.areaD, fill: 'url(#tu-area-spend)' }) : null,
              cumCurve.lineD ? h('path', { d: cumCurve.lineD, fill: 'none', stroke: C.spend, strokeWidth: 2.1, strokeLinecap: 'round', strokeLinejoin: 'round' }) : null,
              ...enrichedDaily.map((d, di) => h('circle', {
                key: d.date,
                cx: xAt(di),
                cy: yAt(d.cumCost || 0),
                r: 2.6,
                fill: C.spend,
              }, h('title', null, `${d.date}: ${cost(d.cumCost)}`))),
              projPathD
                ? h('g', null,
                    h('path', { d: projPathD, className: 'tu-proj-line' }),
                    h('circle', { cx: xAt(totalSlots - 1), cy: yAt(monthlyProjection.projectedCost), r: 3.6, fill: C.spend }),
                    h('text', { x: xAt(totalSlots - 1) - 6, y: Math.max(padT + 11, yAt(monthlyProjection.projectedCost) - 6), textAnchor: 'end', fill: ink(C.spend, 76), fontSize: 11, fontWeight: 600, className: 'tu-num tu-svg-halo' },
                      `${t('月底预测', 'EOM')} ${shortCost(monthlyProjection.projectedCost)}`))
                : null)
          : null,

        // Mode D: Daily Cache Hit Rate Curve
        effMode === 'cacheHit' && !showHourly && hitCurve
          ? h('g', { className: 'tu-enter' },
              hitCurve.areaD ? h('path', { d: hitCurve.areaD, fill: TOKEN_COLORS.cacheRead, fillOpacity: 0.14 }) : null,
              hitCurve.lineD ? h('path', { d: hitCurve.lineD, fill: 'none', stroke: TOKEN_COLORS.cacheRead, strokeWidth: 2.1, strokeLinecap: 'round', strokeLinejoin: 'round' }) : null,
              ...enrichedDaily.map((d, i) => h('circle', {
                key: d.date,
                cx: xAt(i),
                cy: yAt(d.hitRate || 0),
                r: 2.5,
                fill: TOKEN_COLORS.cacheRead,
              }, h('title', null, `${d.date}: ${pct(d.hitRate)}`))))
          : null,

        // Reference 7-day moving average line
        maPathD ? h('path', { d: maPathD, className: 'tu-ref-line', pointerEvents: 'none' }) : null,

        // Synchronized Spend Sub-Lane (dedicated lower track instead of tangled dual right-axis line)
        hasSpendSubLane && spendCurve
          ? h('g', { pointerEvents: 'none' },
              h('line', { x1: padL, y1: crisp(subTopY), x2: W - padR, y2: crisp(subTopY), className: 'tu-grid-line' }),
              h('line', { x1: padL, y1: crisp(subBaseY), x2: W - padR, y2: crisp(subBaseY), className: 'tu-baseline' }),
              h('text', { x: padL - 7, y: subTopY + 9, textAnchor: 'end', className: 'tu-axis-text tu-num' }, shortCost(spendAxis.max)),
              h('text', { x: padL - 7, y: subBaseY, textAnchor: 'end', className: 'tu-axis-text' }, '$0'),
              spendCurve.areaD ? h('path', { d: spendCurve.areaD, fill: 'url(#tu-area-spend)' }) : null,
              spendCurve.lineD ? h('path', { d: spendCurve.lineD, fill: 'none', stroke: C.spend, strokeWidth: 1.6, strokeLinecap: 'round' }) : null)
          : null,

        // Unified pointer surface: Single-click = Pin hover readout; Double-click = Filter day
        h('rect', {
          x: padL,
          y: padT,
          width: plotW,
          height: totalPlotH,
          fill: 'transparent',
          style: { cursor: showHourly ? 'crosshair' : 'pointer' },
          onPointerMove: handlePointerMove,
          onClick: handlePointerClick,
          onDoubleClick: handlePointerDoubleClick,
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
            className: 'tu-axis-text tu-num',
          }, raw);
        })),

        // Interactive Legend Bar
        !showHourly && effMode === 'stacked'
          ? h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6, fontSize: 'var(--tu-fs-1)', color: C.muted } },
              h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' } },
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
                      opacity: off ? 0.42 : 1,
                      textDecoration: off ? 'line-through' : 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                    },
                  }, dot(col), cn);
                }),
                agentOrder.length > 6
                  ? h('span', { style: { fontSize: 'var(--tu-fs-1)', color: C.muted } }, dot(AGENT_FIXED_COLORS.other), t(`+${agentOrder.length - 6} 其他`, `+${agentOrder.length - 6} others`))
                  : null),
              h('div', { style: { display: 'flex', gap: 10, alignItems: 'center' } },
                maPathD ? h('span', null, '┄ ', t('7日均线', '7d MA')) : null,
                hasSpendSubLane ? h('span', { style: { color: ink(C.spend, 76) } }, '━ ', t('下方伴随费用轨', 'Spend lane')) : null))
          : null);
      }

      const modeOptions = [
        ...(isSingleDayWindow ? [] : [['stacked', t('Agent堆叠', 'Stacked')]]),
        ...(hourly.length ? [['hourly', t('24h曲线', '24h')]] : []),
        ...(!isSingleDayWindow ? [['cumulative', t('累计&预测', 'Cumulative')], ['cacheHit', t('缓存率%', 'Cache %')]] : []),
      ];

      const trendTitle = showHourly
        ? (isSingleDayWindow ? t('24h 分时用量趋势', '24h intraday trend') : t('24h 时段叠加分布', '24h hourly profile'))
        : (isSingleDaySummaryOnly ? t('单日用量全景分布', 'Single-day usage profile') : t('每日用量与费用趋势', 'Daily usage & spend trend'));

      const trendMetaNode = h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
        canExitSingleDay
          ? h('button', {
              type: 'button',
              className: 'tu-btn tu-btn-active',
              onClick: actions.exitSingleDay,
              style: { padding: '1px 8px', borderRadius: 999 },
            }, t('← 返回多日范围', '← Back to range'))
          : null,
        showHourly
          ? t('00:00–23:00 平滑曲线 · 单击锁定检视', '00:00–23:00 smooth curve · Click to pin')
          : (!isSingleDaySummaryOnly ? t('单击锁定检视 · 双击按日跳转', 'Click to pin · Double-click day to filter') : null),
        canZoom
          ? h('button', {
              type: 'button',
              className: 'tu-btn',
              'aria-pressed': zoom === 'all',
              onClick: () => setZoom(z => z === 'recent60' ? 'all' : 'recent60'),
              style: { padding: '1px 8px', borderRadius: 999 },
            }, zoom === 'recent60' ? t(`全历史 (${daily.length}天)`, `All ${daily.length}d`) : t('近 60 天', 'Recent 60d'))
          : null);

      return h('section', { id: 'tu-sec-trend', className: 'tu-card tu-bento-card' },
        cardHead(
          trendTitle,
          trendMetaNode,
          modeOptions.length > 1 ? h(Segmented, { options: modeOptions, value: effMode, onChange: setMode, ariaLabel: t('趋势视图模式', 'Trend view mode') }) : null,
        ),
        body);
    });

    const ActivityHeatmap = memo(function ActivityHeatmap({ heatmap, weekdayProfile, selectedDay, windowRange, hover, actions }) {
      const hoverDate = useHoverSelector(hover, s => s.date);
      const pinnedDate = useHoverSelector(hover, s => s.pinnedDate);
      const linkedDate = pinnedDate || hoverDate;
      const wdLabels = [t('一', 'Mon'), t('二', 'Tue'), t('三', 'Wed'), t('四', 'Thu'), t('五', 'Fri'), t('六', 'Sat'), t('日', 'Sun')];
      const maxWdAvg = weekdayProfile.reduce((mx, w) => Math.max(mx, w.avgTokens || 0), 1);

      const leadEmpty = useMemo(() => {
        if (!heatmap.length || !heatmap[0]?.date) return 0;
        const d = new Date(heatmap[0].date + 'T00:00:00');
        return Number.isNaN(d.getTime()) ? 0 : (d.getDay() + 6) % 7;
      }, [heatmap]);

      const activeHover = linkedDate ? heatmap.find(c => c.date === linkedDate) : null;
      const winSince = windowRange?.sinceDate || '';
      const winUntil = windowRange?.untilDate || '';
      const hasMultiWindow = Boolean(winSince && winUntil && winSince < winUntil);

      return h('section', {
        className: 'tu-card',
        style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
      },
      h('div', null,
        cardHead(
          t('8 周活动热力图', '8-week activity'),
          h('span', { className: 'tu-num' },
            activeHover
              ? `${pinnedDate ? '📌 ' : ''}${activeHover.date} · ${compact(activeHover.tokens)} · ${shortCost(activeHover.cost)}`
              : t('单击锁定检视 · 双击单日跳转', 'Click to pin · Double-click to filter')),
          h('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--tu-fs-1)', color: C.muted } },
            t('少', 'Less'),
            ...HEAT_COLORS.map((bg, idx) => h('span', { key: idx, style: { width: 10, height: 10, borderRadius: 2, background: bg, display: 'inline-block' } })),
            t('多', 'More')),
        ),
        heatmap.length
          ? h('div', {
              className: 'tu-heat-wrap',
              style: { marginTop: 8 },
              onMouseLeave: () => {
                if (!hover.get().pinnedDate) hover.set({ date: null });
              },
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
                const isPinned = pinnedDate === cellItem.date;
                const isLinked = !isSel && (isPinned || linkedDate === cellItem.date);
                const inWin = !isSel && !isLinked && hasMultiWindow && cellItem.date >= winSince && cellItem.date <= winUntil;
                return h('button', {
                  key: cellItem.date,
                  type: 'button',
                  'aria-pressed': isSel || isPinned,
                  'aria-label': `${cellItem.date}: ${compact(cellItem.tokens)}`,
                  className: 'tu-heat-cell' + (isSel ? ' selected' : '') + (isLinked ? ' linked' : '') + (inWin ? ' in-window' : ''),
                  title: `${cellItem.date}: ${compact(cellItem.tokens)} (${num(cellItem.tokens)}) · ${cost(cellItem.cost)} · ${cellItem.messages} msgs\n${t('单击锁定检视 · 双击单日跳转', 'Click to pin · Double-click to filter')}`,
                  style: { background: HEAT_COLORS[Math.min(4, Math.max(0, cellItem.intensity || 0))] },
                  onMouseEnter: () => { if (!hover.get().pinnedDate) hover.set({ date: cellItem.date }); },
                  onClick: () => {
                    const nextPin = hover.get().pinnedDate === cellItem.date ? null : cellItem.date;
                    hover.set({ pinnedDate: nextPin, date: nextPin || cellItem.date });
                  },
                  onDoubleClick: () => {
                    hover.set({ pinnedDate: null, pinnedIdx: null });
                    actions.toggleDay(cellItem.date, isSel);
                  },
                });
              })))
          : h('p', { style: { color: C.muted, fontSize: 'var(--tu-fs-xs)', margin: '20px 0' } }, t('热力图等待首轮 graph 扫描完成后生成。', 'Activity heatmap populates after the initial graph scan.'))),
      weekdayProfile.some(w => w.avgTokens > 0)
        ? h('div', { style: { marginTop: 10, paddingTop: 9, borderTop: '1px solid ' + C.border } },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 'var(--tu-fs-1)', color: C.muted, marginBottom: 6 } },
              h('span', null, t('周内日均活跃节律', 'Weekday avg rhythm')),
              h('span', null, t('峰值: 周', 'Peak: ') + wdLabels[weekdayProfile.reduce((bi, w, i, arr) => (w.avgTokens > arr[bi].avgTokens ? i : bi), 0)])),
            h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, alignItems: 'end', height: 40 } },
              ...weekdayProfile.map((w, wi) => {
                const hPct = w.avgTokens > 0 ? Math.max(8, (w.avgTokens / maxWdAvg) * 100) : 2;
                const isPeak = w.avgTokens > 0 && w.avgTokens === maxWdAvg;
                return h('div', {
                  key: wi,
                  title: `${wdLabels[wi]}: avg ${compact(w.avgTokens)} (${w.activeDays} active d)`,
                  style: { display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 3 },
                },
                h('div', { style: { width: '100%', height: `${hPct}%`, background: isPeak ? C.accent : C.accentSoft, border: '1px solid ' + (isPeak ? 'transparent' : C.border), borderRadius: 4, transition: 'height var(--tu-d3) var(--tu-ease)' } }),
                h('span', { style: { fontSize: 'var(--tu-fs-1)', color: C.muted, lineHeight: 1 } }, wdLabels[wi]));
              })))
        : null);
    });

    const TokenComposition = memo(function TokenComposition({ m, execProfile }) {
      const categories = [
        [t('输入', 'Input'), m.input, TOKEN_COLORS.input, false],
        [t('输出', 'Output'), m.output, TOKEN_COLORS.output, false],
        [t('推理', 'Reasoning'), m.reasoning, TOKEN_COLORS.reasoning, false],
        [t('缓存写入', 'Cache write'), m.cacheWrite, TOKEN_COLORS.cacheWrite, false],
        [t('缓存读取', 'Cache read'), m.cacheRead, TOKEN_COLORS.cacheRead, true],
      ];
      const valid = categories.every(([, v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0);
      const total = valid ? categories.reduce((s, [, v]) => s + v, 0) : 0;
      const promptTotal = valid ? (m.input + m.cacheRead + m.cacheWrite) : 0;
      const genTotal = valid ? (m.output + m.reasoning) : 0;
      const ob = execProfile?.outputBreakdown;
      const obTotal = ob ? (ob.answerTokens || 0) + (ob.reasoningTokens || 0) + (ob.toolCallTokens || 0) : 0;

      let content = h('p', { style: { color: C.muted, fontSize: 'var(--tu-fs-xs)' } }, t('此筛选条件下分类构成不可用。', 'Token composition is unavailable for this selection.'));
      if (valid && total > 0) {
        content = h('div', { style: { display: 'grid', gap: 8, marginTop: 8, flex: 1, alignContent: 'space-between' } },
          h('div', { style: { display: 'grid', gap: 6 } },
            promptTotal > 0
              ? h('div', { style: { display: 'grid', gap: 2 } },
                  h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 'var(--tu-fs-1)', color: C.muted } },
                    h('span', null, t('Prompt 上下文侧', 'Prompt context')),
                    h('span', { className: 'tu-num' }, compact(promptTotal))),
                  h('div', { 'aria-hidden': true, className: 'tu-meter tu-meter--md' },
                    ...[[m.cacheRead, TOKEN_COLORS.cacheRead], [m.input, TOKEN_COLORS.input], [m.cacheWrite, TOKEN_COLORS.cacheWrite]]
                      .map(([val, col], idx) => val > 0 ? h('div', { key: idx, style: { width: `${Math.max(1.5, (val / promptTotal) * 100)}%`, background: col } }) : null)))
              : null,
            genTotal > 0
              ? h('div', { style: { display: 'grid', gap: 2 } },
                  h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 'var(--tu-fs-1)', color: C.muted } },
                    h('span', null, t('生成解码侧', 'Generated output')),
                    h('span', { className: 'tu-num' }, compact(genTotal))),
                  h('div', { 'aria-hidden': true, className: 'tu-meter tu-meter--md' },
                    ...[[m.output, TOKEN_COLORS.output], [m.reasoning, TOKEN_COLORS.reasoning]]
                      .map(([val, col], idx) => val > 0 ? h('div', { key: idx, style: { width: `${Math.max(1.5, (val / genTotal) * 100)}%`, background: col } }) : null)))
              : null),
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
              h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, fontSize: 'var(--tu-fs-1)', color: C.muted } },
                h('span', null, name),
                !spanFull ? h('span', { className: 'tu-num' }, shareStr) : null),
              h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 6 } },
                h('strong', { className: 'tu-num', style: { fontSize: 'var(--tu-fs-3)', fontWeight: 600 } }, compact(val)),
                spanFull ? h('span', { className: 'tu-num', style: { fontSize: 'var(--tu-fs-1)', color: C.muted } }, shareStr) : null));
            })),
          obTotal > 0
            ? h('div', { style: { paddingTop: 8, borderTop: '1px solid ' + C.border, display: 'grid', gap: 5 } },
                h('div', { style: { fontSize: 'var(--tu-fs-1)', color: C.muted, display: 'flex', justifyContent: 'space-between' } },
                  h('span', null, t('DSH 生成端细分', 'DSH generation split')),
                  h('span', { className: 'tu-num' }, compact(obTotal) + ' out')),
                h('div', { className: 'tu-meter' },
                  ...[
                    [ob.answerTokens, TOKEN_COLORS.output],
                    [ob.reasoningTokens, TOKEN_COLORS.reasoning],
                    [ob.toolCallTokens, COOL_PALETTE[4]],
                  ].map(([v, c], oi) => v > 0 ? h('div', { key: oi, style: { width: `${(v / obTotal) * 100}%`, background: c } }) : null)),
                h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 'var(--tu-fs-1)', color: C.muted } },
                  h('span', { className: 'tu-num' }, dot(TOKEN_COLORS.output), t('正文 ', 'Ans ') + compact(ob.answerTokens)),
                  h('span', { className: 'tu-num' }, dot(TOKEN_COLORS.reasoning), t('思考 ', 'Reas ') + compact(ob.reasoningTokens)),
                  h('span', { className: 'tu-num' }, dot(COOL_PALETTE[4]), t('工具调用 ', 'Calls ') + compact(ob.toolCallTokens))))
            : null);
      }

      return h('section', { className: 'tu-card tu-bento-card', style: { justifyContent: 'flex-start' } },
        cardHead(t('Token 构成', 'Token composition'), valid && total > 0 ? `${t('缓存比', 'Cache')} ${pct((m.cacheRead || 0) / Math.max(1, promptTotal || total))}` : null),
        content);
    });

    const SvgAgentDonut = memo(function SvgAgentDonut({
      comparison, hasMultiFamily, groupFamily, setGroupFamily, clientFilter, catalogClients,
      clientColorMap, hover, actions,
    }) {
      const hoverAgent = useHoverSelector(hover, s => s.agent);
      const pinnedAgent = useHoverSelector(hover, s => s.pinnedAgent);
      const activeAgent = pinnedAgent || hoverAgent;
      const agentTotal = comparison.reduce((s, it) => s + (Number.isFinite(it.tokens) && it.tokens > 0 ? it.tokens : 0), 0);
      const maxAgentTok = comparison.reduce((mx, it) => Math.max(mx, Number.isFinite(it.tokens) ? it.tokens : 0), 1);
      const R = 42;
      const CIRC = 2 * Math.PI * R;

      const togglePinAgent = name => {
        const nextPin = hover.get().pinnedAgent === name ? null : name;
        hover.set({ pinnedAgent: nextPin, agent: nextPin || name });
      };

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

        const focused = activeAgent ? comparison.find(c => c.name === activeAgent) : null;
        const centerPrimary = focused ? (pinnedAgent ? '📌 ' : '') + focused.name : `${comparison.length} Agent`;
        const centerSub = focused && agentTotal > 0 && Number.isFinite(focused.tokens)
          ? pct(focused.tokens / agentTotal)
          : (agentTotal > 0 && Number.isFinite(comparison[0]?.tokens) ? `${comparison[0].name} ${pct(comparison[0].tokens / agentTotal)}` : '');

        const resolveAgentPick = item => {
          const pickTarget = groupFamily && item.members?.size === 1 ? [...item.members][0] : item.name;
          const canPick = !groupFamily || item.members?.size === 1 || catalogClients.includes(item.name);
          return { pickTarget, canPick };
        };

        body = h('div', {
          style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 10 },
          onMouseLeave: () => { if (!hover.get().pinnedAgent) hover.set({ agent: null }); },
        },
        arcs.length
          ? h('div', { style: { position: 'relative', width: RING.xl.D, height: RING.xl.D, flex: `0 0 ${RING.xl.D}px`, display: 'grid', placeItems: 'center' } },
              h('svg', { width: RING.xl.D, height: RING.xl.D, viewBox: '0 0 112 112', 'aria-hidden': true },
                h('circle', { cx: 56, cy: 56, r: R, className: 'tu-ring-track', strokeWidth: RING.xl.sw }),
                ...arcs.map(a => {
                  const isActive = activeAgent === a.item.name;
                  const dimmed = activeAgent && !isActive;
                  const len = Math.max(0.6, a.ratio * CIRC - (arcs.length > 1 ? 1.8 : 0));
                  const dash = `${len.toFixed(2)} ${CIRC.toFixed(2)}`;
                  const offset = `${(-a.start * CIRC).toFixed(2)}`;
                  const { pickTarget, canPick } = resolveAgentPick(a.item);
                  return h('circle', {
                    key: a.item.name,
                    className: 'tu-arc',
                    'data-agent-tone': a.item.name,
                    cx: 56,
                    cy: 56,
                    r: R,
                    fill: 'none',
                    stroke: a.col,
                    strokeWidth: RING.xl.sw,
                    strokeDasharray: dash,
                    strokeDashoffset: offset,
                    transform: 'rotate(-90 56 56)',
                    style: { cursor: 'pointer', opacity: dimmed ? 0.3 : 1, strokeDasharray: dash, strokeDashoffset: offset },
                    onMouseEnter: () => { if (!hover.get().pinnedAgent) hover.set({ agent: a.item.name }); },
                    onClick: () => togglePinAgent(a.item.name),
                    onDoubleClick: canPick ? () => { hover.set({ pinnedAgent: null }); actions.pickClient(pickTarget); } : undefined,
                  });
                })),
              h('div', { style: { position: 'absolute', inset: 19, display: 'grid', placeItems: 'center', alignContent: 'center', textAlign: 'center', pointerEvents: 'none', lineHeight: 1.2 } },
                h('strong', { style: { fontSize: 'var(--tu-fs-1)', maxWidth: 74, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, centerPrimary),
                centerSub ? h('span', { className: 'tu-num', style: { fontSize: 10, color: C.muted, maxWidth: 74, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, centerSub) : null))
          : null,
        h('div', { style: { display: 'grid', gap: 5, flex: 1, minWidth: 185 } },
          ...comparison.map(item => {
            const color = clientColorMap.get(item.name) || colorForAgent(item.name);
            const share = agentTotal > 0 && Number.isFinite(item.tokens) ? item.tokens / agentTotal : null;
            const barW = Number.isFinite(item.tokens) && maxAgentTok > 0 ? Math.max(2, (item.tokens / maxAgentTok) * 100) : 0;
            const { pickTarget, canPick } = resolveAgentPick(item);
            const isPinned = pinnedAgent === item.name;
            return h('button', {
              key: item.name,
              type: 'button',
              'aria-pressed': isPinned,
              className: 'tu-row-btn',
              title: `${item.name}: ${num(item.tokens)} tokens · ${cost(item.cost)}` + (Number.isFinite(item.throughput) ? ` · ${tpsFmt(item.throughput)}` : '') + `\n${t('单击锁定高亮 · 双击筛选 Agent', 'Click to pin · Double-click to filter')}`,
              onMouseEnter: () => { if (!hover.get().pinnedAgent) hover.set({ agent: item.name }); },
              onClick: () => togglePinAgent(item.name),
              onDoubleClick: canPick ? () => { hover.set({ pinnedAgent: null }); actions.pickClient(pickTarget); } : undefined,
              style: {
                boxShadow: isPinned ? `inset 2px 0 0 ${color}` : undefined,
                background: barW > 0 ? `linear-gradient(to right, ${soft(color, isPinned ? 22 : 14)} ${barW.toFixed(1)}%, transparent ${barW.toFixed(1)}%)` : undefined,
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
                Number.isFinite(item.throughput) ? h('small', { style: { color: ink(COOL_PALETTE[1], 74), marginLeft: 5 } }, item.throughput.toFixed(0) + 't/s') : null)));
          })));
      }

      return h('section', { className: 'tu-card tu-bento-card', style: { justifyContent: 'flex-start' } },
        cardHead(
          t('Agent 用量对比', 'Agent usage comparison'),
          comparison.length ? t('单击锁定 · 双击筛选', 'Click pin · 2× filter') : null,
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
              : null),
        ),
        body);
    });

    const ModelRanking = memo(function ModelRanking({ models, rankBy, setRankBy, modelFilter, hover, actions }) {
      const [expanded, setExpanded] = useState(false);
      const [hoveredModel, setHoveredModel] = useState(null);
      const [pinnedModel, setPinnedModel] = useState(null);
      const activeModel = pinnedModel || hoveredModel;

      const pickHoverModel = mName => {
        if (pinnedModel) return;
        setHoveredModel(mName);
        hover?.set?.({ model: mName });
      };
      const togglePinModel = mName => {
        const nextPin = pinnedModel === mName ? null : mName;
        setPinnedModel(nextPin);
        setHoveredModel(nextPin || mName);
        hover?.set?.({ model: nextPin || mName });
      };

      // Low-saturation cool mineral entity-bound color per model (remains stable across sort tabs)
      const modelColorMap = useMemo(() => {
        const map = new Map();
        models.forEach((mItem, idx) => {
          map.set(mItem.name, colorForCoolEntity(mItem.name, idx));
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

      const ringNode = (() => {
        if (!sorted.length) return null;
        const focused = activeModel ? sorted.find(mItem => mItem.name === activeModel) : null;

        if (isAdditive && totalAdditive > 0) {
          const R = 42;
          const CIRC = 2 * Math.PI * R;
          const headSlices = sorted.slice(0, 6);
          const tailSum = sorted.slice(6).reduce((s, it) => s + (Number.isFinite(valOf(it)) && valOf(it) > 0 ? valOf(it) : 0), 0);
          const rawSlices = [
            ...headSlices.map((it, idx) => ({ name: it.name, val: Math.max(0, valOf(it) || 0), col: modelColorMap.get(it.name) || COOL_PALETTE[idx % COOL_PALETTE.length], clickable: true })),
            ...(tailSum > 0 ? [{ name: t('其他', 'Other'), val: tailSum, col: TONE[3], clickable: false }] : []),
          ].filter(s => s.val > 0);

          let cumRatio = 0;
          const arcs = rawSlices.map(s => {
            const ratio = s.val / totalAdditive;
            const start = cumRatio;
            cumRatio += ratio;
            return { ...s, ratio, start };
          });

          const topRatio = arcs[0]?.ratio ?? 0;
          const centerPrimary = focused ? (pinnedModel ? '📌 ' : '') + focused.name : t(`${sorted.length} 模型`, `${sorted.length} Models`);
          const centerSub = focused
            ? pct(Math.max(0, valOf(focused) || 0) / totalAdditive)
            : (topRatio > 0 ? pct(topRatio) : '');

          return h('div', { style: { position: 'relative', width: RING.xl.D, height: RING.xl.D, flex: `0 0 ${RING.xl.D}px`, display: 'grid', placeItems: 'center' } },
            h('svg', { width: RING.xl.D, height: RING.xl.D, viewBox: '0 0 112 112', 'aria-hidden': true },
              h('circle', { cx: 56, cy: 56, r: R, className: 'tu-ring-track', strokeWidth: RING.xl.sw }),
              ...arcs.map(a => {
                const isAct = activeModel === a.name;
                const dimmed = activeModel && !isAct;
                const len = Math.max(0.6, a.ratio * CIRC - (arcs.length > 1 ? 1.8 : 0));
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
                  strokeWidth: RING.xl.sw,
                  strokeDasharray: dash,
                  strokeDashoffset: offset,
                  transform: 'rotate(-90 56 56)',
                  style: {
                    cursor: a.clickable ? 'pointer' : 'default',
                    opacity: dimmed ? 0.3 : 1,
                    strokeDasharray: dash,
                    strokeDashoffset: offset,
                  },
                  onMouseEnter: () => pickHoverModel(a.name),
                  onClick: a.clickable ? () => togglePinModel(a.name) : undefined,
                  onDoubleClick: a.clickable ? () => { setPinnedModel(null); hover?.set?.({ model: null }); actions.pickModel(a.name); } : undefined,
                });
              })),
            h('div', { style: { position: 'absolute', inset: 20, display: 'grid', placeItems: 'center', alignContent: 'center', textAlign: 'center', pointerEvents: 'none', lineHeight: 1.2 } },
              h('strong', { style: { fontSize: 'var(--tu-fs-1)', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, centerPrimary),
              centerSub ? h('span', { className: 'tu-num', style: { fontSize: 10, color: C.muted } }, centerSub) : null));
        }

        // Rate mode ($/1M or tok/s): concentric 270° radial comparison rings for top 4 models
        const ringItems = sorted.filter(it => Number.isFinite(valOf(it)) && valOf(it) > 0).slice(0, 4);
        if (!ringItems.length) return null;
        const radii = [45, 36.5, 28, 19.5];
        const centerItem = focused || ringItems[0];

        return h('div', { style: { position: 'relative', width: RING.xl.D, height: RING.xl.D, flex: `0 0 ${RING.xl.D}px`, display: 'grid', placeItems: 'center' } },
          h('svg', { width: RING.xl.D, height: RING.xl.D, viewBox: '0 0 112 112', 'aria-hidden': true },
            ...ringItems.map((it, ri) => {
              const r = radii[ri];
              const circ = 2 * Math.PI * r;
              const sweep = circ * 0.75;
              const ratio = Math.max(0.04, Math.min(1, (valOf(it) || 0) / maximum));
              const fillLen = ratio * sweep;
              const col = modelColorMap.get(it.name) || COOL_PALETTE[ri % COOL_PALETTE.length];
              const isAct = activeModel === it.name;
              const dimmed = activeModel && !isAct;
              const trackDash = `${sweep.toFixed(2)} ${circ.toFixed(2)}`;
              const valDash = `${fillLen.toFixed(2)} ${circ.toFixed(2)}`;
              return h('g', { key: it.name },
                h('circle', {
                  cx: 56, cy: 56, r, className: 'tu-ring-track', strokeWidth: 5.5,
                  strokeLinecap: 'round', strokeDasharray: trackDash, transform: 'rotate(135 56 56)',
                }),
                h('circle', {
                  className: 'tu-arc',
                  cx: 56, cy: 56, r, fill: 'none', stroke: col,
                  strokeWidth: 5.5,
                  strokeLinecap: 'round',
                  strokeDasharray: valDash,
                  transform: 'rotate(135 56 56)',
                  style: { cursor: 'pointer', opacity: dimmed ? 0.3 : 1, strokeDasharray: valDash },
                  onMouseEnter: () => pickHoverModel(it.name),
                  onClick: () => togglePinModel(it.name),
                  onDoubleClick: () => { setPinnedModel(null); hover?.set?.({ model: null }); actions.pickModel(it.name); },
                }));
            })),
          h('div', { style: { position: 'absolute', left: 16, right: 16, bottom: 6, textAlign: 'center', pointerEvents: 'none', lineHeight: 1.15 } },
            h('strong', { className: 'tu-num', style: { fontSize: 'var(--tu-fs-1)', display: 'block' } }, fmtVal(centerItem)),
            h('span', { style: { fontSize: 10, color: C.muted, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, centerItem.name)));
      })();

      return h('section', { className: 'tu-card tu-bento-card', style: { justifyContent: 'flex-start' } },
        cardHead(
          t('模型比较', 'Model comparison'),
          modelFilter && modelFilter !== 'all'
            ? h('button', { type: 'button', className: 'tu-btn', style: { padding: '1px 8px', borderRadius: 999 }, onClick: () => actions.pickModel('all') }, t('显示全部', 'Show all'))
            : t('单击锁定 · 双击筛选', 'Click pin · 2× filter'),
          h(Segmented, { options: rankOptions, value: rankBy, onChange: setRankBy, ariaLabel: t('模型排序维度', 'Model sort metric') }),
        ),
        visible.length
          ? h('div', {
              style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 10 },
              onMouseLeave: () => pickHoverModel(null),
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
                const barColor = modelColorMap.get(item.name) || COOL_PALETTE[idx % COOL_PALETTE.length];
                const barW = Number.isFinite(val) && val > 0 ? Math.max(2, Math.min(100, (val / maximum) * 100)) : 0;
                const share = isAdditive && totalAdditive > 0 && Number.isFinite(val) && val > 0 ? val / totalAdditive : null;
                const dimmed = activeModel && activeModel !== item.name;
                const isPinned = pinnedModel === item.name;
                return h('button', {
                  key: item.name,
                  type: 'button',
                  'aria-pressed': isPinned,
                  'data-model-tone': item.name,
                  className: 'tu-row-btn',
                  title: `${item.name} (${item.primaryClient || '—'}): ${num(item.tokens)} tokens · ${cost(item.cost)} · ${unitPriceFmt(item.unitCost)}` + (Number.isFinite(item.throughput) ? ` · ${tpsFmt(item.throughput)}` : '') + `\n${t('单击锁定高亮 · 双击筛选模型', 'Click to pin · Double-click to filter')}`,
                  onMouseEnter: () => pickHoverModel(item.name),
                  onClick: () => togglePinModel(item.name),
                  onDoubleClick: () => { setPinnedModel(null); hover?.set?.({ model: null }); actions.pickModel(item.name); },
                  style: {
                    opacity: dimmed ? 0.42 : 1,
                    boxShadow: isPinned ? `inset 2px 0 0 ${barColor}` : undefined,
                    background: barW > 0 ? `linear-gradient(to right, ${soft(barColor, isPinned ? 22 : 14)} ${barW.toFixed(1)}%, transparent ${barW.toFixed(1)}%)` : undefined,
                  },
                },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 'var(--tu-fs-xs)' } },
                  h('span', { style: { minWidth: 0, display: 'inline-flex', alignItems: 'center', gap: 4, overflow: 'hidden' } },
                    dot(barColor),
                    h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 } }, item.name),
                    item.reasoningShare > 0.2
                      ? h('span', { style: { fontSize: 'var(--tu-fs-1)', padding: '0 5px', borderRadius: 999, background: soft(TOKEN_COLORS.reasoning, 14), color: ink(TOKEN_COLORS.reasoning, 74), flexShrink: 0 } },
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

    const POW10_LABELS = { 0: '1', 1: '10', 2: '100', 3: '1K', 4: '10K', 5: '100K', 6: '1M', 7: '10M', 8: '100M', 9: '1B', 10: '10B', 11: '100B' };
    const estSvgTextWidth = s => {
      let w = 0;
      for (let i = 0; i < s.length; i++) w += s.charCodeAt(i) > 255 ? 11.2 : 6.1;
      return w;
    };
    const shortBubbleModel = name => {
      const s = String(name || '');
      if (s.length <= 17) return s;
      const trimmed = s.replace(/-(tiered-high|tiered-low|preview|latest)$/i, '');
      if (trimmed.length <= 17) return trimmed;
      return trimmed.slice(0, 16) + '…';
    };

    const QuadrantBubbleMap = memo(function QuadrantBubbleMap({ bubbleRows, clientColorMap, hover, actions }) {
      const [yMetric, setYMetric] = useState('cost'); // 'cost' | 'unit' | 'tps'
      const [hoverRow, setHoverRow] = useState(null);
      const [pinnedModel, setPinnedModel] = useState(null);
      const [boxRef, W] = useElementWidth(600);
      if (bubbleRows.length < 2) return null;

      const activeRow = pinnedModel ? (bubbleRows.find(r => r.model === pinnedModel) || hoverRow) : hoverRow;

      const setBubbleHover = row => {
        if (pinnedModel) return;
        setHoverRow(row);
        hover?.set?.({ model: row ? row.model : null });
      };
      const toggleBubblePin = (e, row) => {
        e.stopPropagation();
        const nextPin = pinnedModel === row.model ? null : row.model;
        setPinnedModel(nextPin);
        setHoverRow(nextPin ? row : row);
        hover?.set?.({ model: nextPin || row.model });
      };

      const hasTps = bubbleRows.filter(r => Number.isFinite(r.throughput) && r.throughput > 0).length >= 2;
      const effY = yMetric === 'tps' && !hasTps ? 'cost' : yMetric;

      const H = 242, padL = 56, padR = 16, padT = 8, padB = 24;
      const plotW = Math.max(180, W - padL - padR);
      const plotH = H - padT - padB;
      const inL = 24, inR = 24, inT = 30, inB = 18;
      const domW = Math.max(80, plotW - inL - inR);
      const domH = Math.max(80, plotH - inT - inB);

      const logX = v => Math.log10(Math.max(100, v));
      const rawPowMin = Math.floor(Math.min(...bubbleRows.map(r => logX(r.tokens))));
      const rawPowMax = Math.max(rawPowMin + 1, Math.ceil(Math.max(...bubbleRows.map(r => logX(r.tokens)))));
      const xCoord = tok => padL + inL + ((logX(tok) - rawPowMin) / (rawPowMax - rawPowMin)) * domW;

      const yRawOf = r => {
        if (effY === 'unit') return Math.max(0, r.unitCost || 0);
        if (effY === 'tps') return Math.max(5, r.throughput || 5);
        return Math.max(0, r.cost || 0);
      };
      const yScale = v => effY === 'tps' ? Math.log10(Math.max(5, v)) : Math.sqrt(Math.max(0, v));
      const scaledYs = bubbleRows.map(r => yScale(yRawOf(r)));
      const minY = effY === 'tps' ? Math.min(...scaledYs) * 0.96 : 0;
      const maxY = Math.max(...scaledYs, minY + 0.5) * (effY === 'tps' ? 1.03 : 1.06);
      const yCoord = r => padT + inT + (1 - (yScale(yRawOf(r)) - minY) / (maxY - minY)) * domH;

      const medX = crisp(Math.max(padL + 44, Math.min(padL + plotW - 44, medianOf(bubbleRows.map(r => xCoord(r.tokens))))));
      const medY = crisp(Math.max(padT + 34, Math.min(padT + plotH - 30, medianOf(bubbleRows.map(r => yCoord(r))))));

      const maxMsgs = Math.max(1, ...bubbleRows.map(r => r.messages || 1));
      const totalBubbleTokens = bubbleRows.reduce((s, r) => s + (r.tokens || 0), 0) || 1;
      const xPowerTicks = [];
      for (let p = rawPowMin; p <= rawPowMax; p++) xPowerTicks.push(p);

      const qLabels = effY === 'tps'
        ? [t('小量高速', 'Low-vol fast'), t('大量高速', 'High-vol fast'), t('小量慢速', 'Low-vol slow'), t('大量主力', 'Workhorse')]
        : [t('小量重型', 'Low-vol pricey'), t('大量高消', 'Heavy flagship'), t('轻量试探', 'Light utility'), t('大量经济', 'High-vol lean')];

      const yOptions = [
        ['cost', t('总费用', 'Cost')],
        ['unit', t('单价 $/1M', '$/1M')],
        ...(hasTps ? [['tps', t('吞吐', 'tok/s')]] : []),
      ];

      const agentCols = new Map();
      const positioned = bubbleRows.map((r, idx) => {
        const col = clientColorMap.get(r.client) || colorForAgent(r.client);
        if (r.client && !agentCols.has(r.client)) agentCols.set(r.client, col);
        const cx = xCoord(r.tokens);
        const cy = yCoord(r);
        const rad = 5.5 + Math.sqrt(Math.max(1, r.messages) / maxMsgs) * 11.5;
        return { r, idx, cx, cy, rad, col, gradId: `tu-bg-${String(r.client || 'x').replace(/[^a-zA-Z0-9_-]/g, '')}` };
      });

      const qPills = [
        { label: qLabels[0], x: padL + 7, y: padT + 7, align: 'start' },
        { label: qLabels[1], x: padL + plotW - 7, y: padT + 7, align: 'end', accent: true },
        { label: qLabels[2], x: padL + 7, y: padT + plotH - 23, align: 'start' },
        { label: qLabels[3], x: padL + plotW - 7, y: padT + plotH - 23, align: 'end' },
      ].map(q => {
        const w = Math.round(estSvgTextWidth(q.label) + 12);
        const rx1 = q.align === 'end' ? q.x - w : q.x;
        return { ...q, w, h: 16, x1: rx1, y1: q.y, x2: rx1 + w, y2: q.y + 16 };
      });

      const obstacles = [
        ...positioned.map(p => ({ kind: 'circle', cx: p.cx, cy: p.cy, rad: p.rad + 2.5, model: p.r.model })),
        ...qPills.map(q => ({ kind: 'rect', x1: q.x1 - 2, y1: q.y1 - 2, x2: q.x2 + 2, y2: q.y2 + 2 })),
      ];

      const hitsObstacle = (bx1, by1, bx2, by2, ownModel) => {
        if (bx1 < padL + 5 || bx2 > padL + plotW - 5 || by1 < padT + 4 || by2 > padT + plotH - 4) return true;
        for (const o of obstacles) {
          if (o.kind === 'rect') {
            if (!(bx2 < o.x1 || bx1 > o.x2 || by2 < o.y1 || by1 > o.y2)) return true;
          } else {
            const effR = o.model === ownModel ? Math.max(0, o.rad - 3.5) : o.rad;
            const dx = o.cx - Math.max(bx1, Math.min(o.cx, bx2));
            const dy = o.cy - Math.max(by1, Math.min(o.cy, by2));
            if (dx * dx + dy * dy < effR * effR) return true;
          }
        }
        return false;
      };

      const labelMap = new Map();
      for (const p of positioned.slice(0, 10)) {
        const txt = shortBubbleModel(p.r.model);
        const tw = estSvgTextWidth(txt);
        const candidates = [
          { x: p.cx, y: p.cy - p.rad - 5.5, anchor: 'middle', bx1: p.cx - tw / 2 - 2, by1: p.cy - p.rad - 15.5, bx2: p.cx + tw / 2 + 2, by2: p.cy - p.rad - 3 },
          { x: p.cx, y: p.cy + p.rad + 12.5, anchor: 'middle', bx1: p.cx - tw / 2 - 2, by1: p.cy + p.rad + 2.5, bx2: p.cx + tw / 2 + 2, by2: p.cy + p.rad + 15 },
          { x: p.cx - p.rad - 6.5, y: p.cy + 3.5, anchor: 'end', bx1: p.cx - p.rad - 8.5 - tw, by1: p.cy - 6.5, bx2: p.cx - p.rad - 4.5, by2: p.cy + 6 },
          { x: p.cx + p.rad + 6.5, y: p.cy + 3.5, anchor: 'start', bx1: p.cx + p.rad + 4.5, by1: p.cy - 6.5, bx2: p.cx + p.rad + 8.5 + tw, by2: p.cy + 6 },
          { x: p.cx - p.rad * 0.7 - 5, y: p.cy + p.rad * 0.75 + 10, anchor: 'end', bx1: p.cx - p.rad * 0.7 - 7 - tw, by1: p.cy + p.rad * 0.75, bx2: p.cx - p.rad * 0.7 - 3, by2: p.cy + p.rad * 0.75 + 12.5 },
          { x: p.cx - p.rad * 0.7 - 5, y: p.cy - p.rad * 0.75 - 4, anchor: 'end', bx1: p.cx - p.rad * 0.7 - 7 - tw, by1: p.cy - p.rad * 0.75 - 14, bx2: p.cx - p.rad * 0.7 - 3, by2: p.cy - p.rad * 0.75 - 1.5 },
        ];
        const hit = candidates.find(c => !hitsObstacle(c.bx1, c.by1, c.bx2, c.by2, p.r.model));
        if (hit) {
          labelMap.set(p.r.model, { text: txt, x: hit.x, y: hit.y, anchor: hit.anchor });
          obstacles.push({ kind: 'rect', x1: hit.bx1 - 2, y1: hit.by1 - 1, x2: hit.bx2 + 2, y2: hit.by2 + 1 });
        }
      }

      const zOrdered = [...positioned].sort((a, b) => b.rad - a.rad);
      const hoveredNode = activeRow ? positioned.find(p => p.r.model === activeRow.model) : null;

      return h('section', { className: 'tu-card tu-bento-card', style: { justifyContent: 'space-between' } },
        cardHead(
          t('模型效能分布气泡图', 'Model efficiency map'),
          t('对数用量 × 中位数四象限', 'Log tokens × median quadrants'),
          h(Segmented, { options: yOptions, value: effY, onChange: setYMetric, ariaLabel: t('气泡图纵轴维度', 'Bubble Y-axis metric') }),
        ),

        h('div', {
          ref: boxRef,
          style: { position: 'relative' },
          onMouseLeave: () => setBubbleHover(null),
          onClick: () => { if (pinnedModel) { setPinnedModel(null); setHoverRow(null); hover?.set?.({ model: null }); } },
        },
          h('svg', {
            width: W,
            height: H,
            viewBox: `0 0 ${W} ${H}`,
            style: { width: '100%', height: H, display: 'block' },
          },
          h('defs', null,
            ...[...agentCols.entries()].map(([ag, col]) => {
              const gid = `tu-bg-${String(ag || 'x').replace(/[^a-zA-Z0-9_-]/g, '')}`;
              return h('radialGradient', { key: gid, id: gid, cx: '35%', cy: '32%', r: '70%' },
                h('stop', { offset: '0%', stopColor: col, stopOpacity: 0.3 }),
                h('stop', { offset: '68%', stopColor: col, stopOpacity: 0.52 }),
                h('stop', { offset: '100%', stopColor: col, stopOpacity: 0.72 }));
            })),

          h('rect', { x: padL, y: padT, width: plotW, height: plotH, rx: 8, fill: 'color-mix(in oklab, var(--tu-s2) 56%, transparent)', stroke: C.border, strokeWidth: 1 }),
          h('rect', { x: medX, y: padT + 1, width: Math.max(0, padL + plotW - medX - 1), height: Math.max(0, medY - padT - 1), rx: 4, fill: 'color-mix(in oklab, var(--tu-accent) 4.5%, transparent)' }),

          ...[0, 0.33, 0.67, 1].map((tFrac, gi) => {
            const y = crisp(padT + inT + (1 - tFrac) * domH);
            const valAt = effY === 'tps' ? Math.pow(10, minY + tFrac * (maxY - minY)) : Math.pow(minY + tFrac * (maxY - minY), 2);
            const yLbl = effY === 'tps'
              ? (valAt >= 1000 ? (valAt / 1000).toFixed(1) + 'K' : Math.round(valAt)) + 't/s'
              : effY === 'unit'
                ? `$${valAt >= 10 ? Math.round(valAt) : valAt.toFixed(2)}`
                : shortCost(valAt);
            return h('g', { key: gi },
              h('line', { x1: padL + 1, y1: y, x2: padL + plotW - 1, y2: y, className: 'tu-grid-line' }),
              h('text', { x: padL - 7, y: y + 3.5, textAnchor: 'end', className: 'tu-axis-text tu-num' }, yLbl));
          }),

          ...xPowerTicks.map(p => {
            const x = crisp(padL + inL + ((p - rawPowMin) / (rawPowMax - rawPowMin)) * domW);
            const tickLabel = POW10_LABELS[p] || compact(Math.pow(10, p));
            return h('g', { key: `xp-${p}` },
              h('line', { x1: x, y1: padT + 1, x2: x, y2: padT + plotH - 1, className: 'tu-grid-line' }),
              h('text', { x, y: H - 6, textAnchor: 'middle', className: 'tu-axis-text tu-num' }, tickLabel));
          }),

          h('line', { x1: medX, y1: padT + 2, x2: medX, y2: padT + plotH - 2, stroke: C.accent, strokeOpacity: 0.38, strokeDasharray: '4 4', strokeWidth: 1 }),
          h('line', { x1: padL + 2, y1: medY, x2: padL + plotW - 2, y2: medY, stroke: C.accent, strokeOpacity: 0.38, strokeDasharray: '4 4', strokeWidth: 1 }),

          ...qPills.map((q, qi) => h('g', { key: `qp-${qi}`, pointerEvents: 'none' },
            h('rect', {
              x: q.x1,
              y: q.y1,
              width: q.w,
              height: q.h,
              rx: 4,
              fill: q.accent ? 'color-mix(in oklab, var(--tu-accent) 9%, var(--tu-s1))' : 'color-mix(in oklab, var(--tu-s1) 88%, transparent)',
              stroke: q.accent ? 'color-mix(in oklab, var(--tu-accent) 26%, var(--tu-line))' : C.border,
              strokeWidth: 0.8,
            }),
            h('text', {
              x: q.x1 + q.w / 2,
              y: q.y1 + 11.5,
              textAnchor: 'middle',
              fill: q.accent ? C.accentInk : C.muted,
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: '0.02em',
            }, q.label))),

          hoveredNode
            ? h('g', { pointerEvents: 'none' },
                h('line', { x1: hoveredNode.cx, y1: hoveredNode.cy, x2: hoveredNode.cx, y2: padT + plotH, stroke: hoveredNode.col, strokeOpacity: 0.55, strokeDasharray: '3 3', strokeWidth: 1 }),
                h('line', { x1: padL, y1: hoveredNode.cy, x2: hoveredNode.cx, y2: hoveredNode.cy, stroke: hoveredNode.col, strokeOpacity: 0.55, strokeDasharray: '3 3', strokeWidth: 1 }))
            : null,

          ...zOrdered.map(p => {
            const isHov = activeRow?.model === p.r.model;
            const dimmed = activeRow && !isHov;
            return h('g', {
              key: p.r.model,
              'data-model-tone': p.r.model,
              style: { cursor: 'pointer', opacity: dimmed ? 0.32 : 1, transition: 'opacity 150ms var(--tu-ease)' },
              onMouseEnter: () => setBubbleHover(p.r),
              onClick: e => toggleBubblePin(e, p.r),
              onDoubleClick: e => { e.stopPropagation(); setPinnedModel(null); hover?.set?.({ model: null }); actions.pickModel(p.r.model); },
            },
            h('title', null, `${p.r.model} (${p.r.client})\nTokens: ${compact(p.r.tokens)} (${num(p.r.tokens)})\nCost: ${cost(p.r.cost)} (${unitPriceFmt(p.r.unitCost)})\nThroughput: ${tpsFmt(p.r.throughput)}\nMessages: ${num(p.r.messages)}`),
            isHov ? h('circle', { cx: p.cx, cy: p.cy, r: p.rad + 4, fill: 'none', stroke: p.col, strokeOpacity: 0.34, strokeWidth: 2 }) : null,
            h('circle', {
              cx: p.cx,
              cy: p.cy,
              r: p.rad,
              fill: `url(#${p.gradId})`,
              stroke: p.col,
              strokeWidth: isHov ? 2.2 : 1.5,
            }),
            h('circle', { cx: p.cx, cy: p.cy, r: 2.1, fill: p.col, pointerEvents: 'none' }));
          }),

          ...positioned.map(p => {
            const isHov = activeRow?.model === p.r.model;
            const lbl = labelMap.get(p.r.model);
            if (!lbl && !isHov) return null;
            const lx = lbl ? lbl.x : p.cx;
            const ly = lbl ? lbl.y : Math.max(padT + 14, p.cy - p.rad - 6);
            const anchor = lbl ? lbl.anchor : 'middle';
            const dimmed = activeRow && !isHov;
            return h('text', {
              key: `lbl-${p.r.model}`,
              x: lx,
              y: ly,
              textAnchor: anchor,
              fill: isHov ? C.accentInk : C.text,
              fontSize: 11,
              fontWeight: isHov ? 600 : 500,
              letterSpacing: '-0.01em',
              className: 'tu-svg-halo',
              pointerEvents: 'none',
              style: { opacity: dimmed ? 0.32 : 0.94, transition: 'opacity 150ms var(--tu-ease)' },
            }, isHov ? p.r.model : lbl.text);
          })),

          hoveredNode
            ? (() => {
                const tipW = 224;
                const placeLeft = hoveredNode.cx > W * 0.54;
                const leftPx = placeLeft
                  ? Math.max(padL + 6, hoveredNode.cx - hoveredNode.rad - tipW - 12)
                  : Math.min(W - tipW - 8, hoveredNode.cx + hoveredNode.rad + 12);
                const topPx = Math.max(padT + 6, Math.min(H - 118, hoveredNode.cy - 34));
                const share = hoveredNode.r.tokens / totalBubbleTokens;
                const isPinned = pinnedModel === hoveredNode.r.model;
                return h('div', {
                  className: 'tu-tip tu-num',
                  style: { width: tipW, transform: `translate3d(${Math.round(leftPx)}px, ${Math.round(topPx - 8)}px, 0)` },
                },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, borderBottom: '1px solid ' + C.border, paddingBottom: 4, marginBottom: 2 } },
                  h('strong', { style: { fontSize: 'var(--tu-fs-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, (isPinned ? '📌 ' : '') + hoveredNode.r.model),
                  h('span', { style: { fontSize: 'var(--tu-fs-1)', color: C.muted, flexShrink: 0 } }, dot(hoveredNode.col), hoveredNode.r.client)),
                h('div', { style: { display: 'flex', justifyContent: 'space-between' } },
                  h('span', { style: { color: C.muted } }, t('Token 用量', 'Tokens')),
                  h('strong', null, `${compact(hoveredNode.r.tokens)} (${pct(share)})`)),
                h('div', { style: { display: 'flex', justifyContent: 'space-between' } },
                  h('span', { style: { color: C.muted } }, t('估算费用 / 单价', 'Cost / Unit')),
                  h('span', null, `${shortCost(hoveredNode.r.cost)} · ${unitPriceFmt(hoveredNode.r.unitCost)}`)),
                Number.isFinite(hoveredNode.r.throughput) && hoveredNode.r.throughput > 0
                  ? h('div', { style: { display: 'flex', justifyContent: 'space-between' } },
                      h('span', { style: { color: C.muted } }, t('解码吞吐', 'Throughput')),
                      h('span', { style: { color: ink(COOL_PALETTE[1], 74) } }, tpsFmt(hoveredNode.r.throughput)))
                  : null,
                h('div', { style: { display: 'flex', justifyContent: 'space-between' } },
                  h('span', { style: { color: C.muted } }, t('消息轮次', 'Messages')),
                  h('span', null, num(hoveredNode.r.messages))),
                h('div', { style: { fontSize: 'var(--tu-fs-1)', color: C.ink3, paddingTop: 1 } },
                  isPinned ? t('单击取消锁定 · 双击筛选模型', 'Click to unpin · Double-click to filter') : t('单击锁定卡片 · 双击筛选模型', 'Click to pin · Double-click to filter')));
              })()
            : null),

        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4, paddingTop: 6, borderTop: '1px solid ' + C.border, fontSize: 'var(--tu-fs-1)', color: C.muted } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
            ...[...agentCols.entries()].map(([ag, col]) => h('span', {
              key: ag,
              style: { display: 'inline-flex', alignItems: 'center', fontWeight: 500, color: C.text },
            }, dot(col), ag))),
          h('span', null, t('面积 = 消息规模 · 单击锁定 · 双击筛选', 'Area = msgs · Click to pin · Double-click to filter'))));
    });

    // Pure-SVG multi-segment ring arc builder (zero strokeWidth hover jitter; dims non-active arcs cleanly)
    function buildRingArcs(items, r, cx = 27, cy = 27, strokeWidth = 4.5, gapPx = 1.4, opts = {}) {
      const valid = items.filter(it => Number.isFinite(it.value) && it.value > 0);
      const sum = valid.reduce((s, it) => s + it.value, 0);
      if (sum <= 0) return [];
      const circ = 2 * Math.PI * r;
      let cum = 0;
      return valid.map(it => {
        const ratio = it.value / sum;
        const start = cum;
        cum += ratio;
        const len = Math.max(0.6, ratio * circ - (valid.length > 1 ? gapPx : 0));
        const dash = `${len.toFixed(2)} ${circ.toFixed(2)}`;
        const offset = `${(-start * circ).toFixed(2)}`;
        const isHov = opts.hoverKey && opts.hoverKey === it.key;
        const dimmed = opts.hoverKey && !isHov;
        return h('circle', {
          key: it.key,
          className: 'tu-arc',
          cx,
          cy,
          r,
          fill: 'none',
          stroke: it.color,
          strokeWidth,
          strokeDasharray: dash,
          strokeDashoffset: offset,
          transform: `rotate(-90 ${cx} ${cy})`,
          style: {
            cursor: (it.onClick || it.onDoubleClick) ? 'pointer' : undefined,
            opacity: dimmed ? 0.3 : 1,
            strokeDasharray: dash,
            strokeDashoffset: offset,
          },
          onMouseEnter: it.onHover || undefined,
          onClick: it.onClick || undefined,
          onDoubleClick: it.onDoubleClick || undefined,
        });
      });
    }

    const DeepWorkbench = memo(function DeepWorkbench({
      workspaces, matrixData, execProfile, workspaceFilter, setWorkspaceFilter, clientColorMap, requestedTab, hover, actions,
    }) {
      const [tab, setTab] = useState('workspaces'); // 'workspaces' | 'matrix' | 'execution'
      const [wsExpanded, setWsExpanded] = useState(false);
      const [hoveredWs, setHoveredWs] = useState(null);
      const [pinnedWs, setPinnedWs] = useState(null);
      const [pinnedCellKey, setPinnedCellKey] = useState(null);
      const activeWs = pinnedWs || hoveredWs;

      useEffect(() => {
        if (requestedTab && requestedTab.tab) setTab(requestedTab.tab);
      }, [requestedTab]);

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

      const toggleWorkspace = wKey => {
        const isSame = workspaceFilter && String(workspaceFilter).toLowerCase() === String(wKey).toLowerCase();
        const next = isSame ? '' : wKey;
        setWorkspaceFilter(next);
        if (next) actions?.focusSection?.('tu-sec-tasks');
      };

      const togglePinWs = wKey => {
        setPinnedWs(prev => prev === wKey ? null : wKey);
        setHoveredWs(wKey);
      };

      const workspaceView = (() => {
        if (!workspaces.length) {
          return h('p', { style: { color: C.muted, fontSize: 'var(--tu-fs-xs)', marginTop: 12 } }, t('当前筛选暂无项目目录归属记录。', 'No project workspace attribution in this window.'));
        }
        const wsTotal = workspaces.reduce((s, w) => s + (w.totalTokens || 0), 0) || 1;
        const wsCostTotal = workspaces.reduce((s, w) => s + (w.cost > 0 ? w.cost : 0), 0);
        const visibleWs = wsExpanded ? workspaces : workspaces.slice(0, 6);
        const focusedWs = activeWs ? workspaces.find(w => w.workspaceKey === activeWs) : null;

        const tokMasterSlices = workspaces.slice(0, 7).map((w, idx) => ({
          key: w.workspaceKey,
          value: w.totalTokens || 0,
          color: colorForCoolEntity(w.label || w.workspaceKey, idx),
          onHover: () => { if (!pinnedWs) setHoveredWs(w.workspaceKey); },
          onClick: () => togglePinWs(w.workspaceKey),
          onDoubleClick: () => toggleWorkspace(w.workspaceKey),
        }));
        const tailTok = workspaces.slice(7).reduce((s, w) => s + (w.totalTokens || 0), 0);
        if (tailTok > 0) tokMasterSlices.push({ key: '__other_tok', value: tailTok, color: TONE[3] });

        const costMasterSlices = wsCostTotal > 0
          ? workspaces.slice(0, 7).map((w, idx) => ({
              key: w.workspaceKey,
              value: w.cost > 0 ? w.cost : 0,
              color: colorForCoolEntity(w.label || w.workspaceKey, idx),
              onHover: () => { if (!pinnedWs) setHoveredWs(w.workspaceKey); },
              onClick: () => togglePinWs(w.workspaceKey),
              onDoubleClick: () => toggleWorkspace(w.workspaceKey),
            }))
          : [];
        const tailCost = wsCostTotal > 0 ? workspaces.slice(7).reduce((s, w) => s + (w.cost > 0 ? w.cost : 0), 0) : 0;
        if (tailCost > 0) costMasterSlices.push({ key: '__other_cost', value: tailCost, color: TONE[3] });

        return h('div', {
          key: 'ws',
          className: 'tu-enter',
          style: { display: 'grid', gap: 10, marginTop: 10 },
          onMouseLeave: () => { if (!pinnedWs) setHoveredWs(null); },
        },
        h('div', {
          className: 'tu-well',
          style: {
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-around',
            gap: 12,
          },
        },
        // Master Ring A: Token Share
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
          h('div', { style: { position: 'relative', width: RING.l.D, height: RING.l.D, flex: `0 0 ${RING.l.D}px`, display: 'grid', placeItems: 'center' } },
            h('svg', { width: RING.l.D, height: RING.l.D, viewBox: '0 0 88 88', 'aria-hidden': true },
              h('circle', { cx: 44, cy: 44, r: 34, className: 'tu-ring-track', strokeWidth: RING.l.sw }),
              ...buildRingArcs(tokMasterSlices, 34, 44, 44, RING.l.sw, 1.5, { hoverKey: activeWs })),
            h('div', { style: { position: 'absolute', inset: 16, display: 'grid', placeItems: 'center', alignContent: 'center', textAlign: 'center', pointerEvents: 'none', lineHeight: 1.15 } },
              h('strong', { style: { fontSize: 10.5, maxWidth: 54, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                focusedWs ? focusedWs.label : t('用量占比', 'Tokens')),
              h('span', { className: 'tu-num', style: { fontSize: 10, color: C.muted } },
                focusedWs ? pct((focusedWs.totalTokens || 0) / wsTotal) : compact(wsTotal)))),
          !wsCostTotal
            ? h('div', { style: { display: 'grid', gap: 2, fontSize: 'var(--tu-fs-1)', color: C.muted } },
                h('strong', { style: { color: C.text, fontSize: 'var(--tu-fs-2)' } }, t(`${workspaces.length} 个活跃项目`, `${workspaces.length} active workspaces`)),
                h('span', null, t('外环: 项目内 Agent 构成', 'Outer ring: Agent mix')),
                h('span', null, t('内环: 缓存 / 输入 / 生成', 'Inner ring: Cache / In / Out')))
            : null),

        // Master Ring B: Cost Share
        wsCostTotal > 0
          ? h('div', { style: { position: 'relative', width: RING.l.D, height: RING.l.D, flex: `0 0 ${RING.l.D}px`, display: 'grid', placeItems: 'center' } },
              h('svg', { width: RING.l.D, height: RING.l.D, viewBox: '0 0 88 88', 'aria-hidden': true },
                h('circle', { cx: 44, cy: 44, r: 34, className: 'tu-ring-track', strokeWidth: RING.l.sw }),
                ...buildRingArcs(costMasterSlices, 34, 44, 44, RING.l.sw, 1.5, { hoverKey: activeWs })),
              h('div', { style: { position: 'absolute', inset: 16, display: 'grid', placeItems: 'center', alignContent: 'center', textAlign: 'center', pointerEvents: 'none', lineHeight: 1.15 } },
                h('strong', { style: { fontSize: 10.5, maxWidth: 54, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                  focusedWs ? focusedWs.label : t('费用占比', 'Spend')),
                h('span', { className: 'tu-num', style: { fontSize: 10, color: ink(C.spend, 76) } },
                  focusedWs ? (focusedWs.cost > 0 ? shortCost(focusedWs.cost) : pct(0)) : shortCost(wsCostTotal))))
          : null,

        wsCostTotal > 0
          ? h('div', { style: { display: 'grid', gap: 3, fontSize: 'var(--tu-fs-1)', color: C.muted } },
              h('strong', { style: { color: C.text } }, t('卡片内双环图例', 'Card concentric rings')),
              h('span', null, t('● 外环：项目内各 Agent 占比', '● Outer: Agent share in project')),
              h('span', null, dot(TOKEN_COLORS.cacheRead), t('内环：缓存 · 输入 · 输出/思考', 'Inner: Cache · Input · Output')))
          : null),

        // 2. Per-Project Bento Cards with 54x54 Nested Concentric Rings
        h('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: visibleWs.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 8,
          },
        },
        ...visibleWs.map((w, idx) => {
          const share = (w.totalTokens || 0) / wsTotal;
          const wsCol = colorForCoolEntity(w.label || w.workspaceKey, idx);
          const isSel = Boolean(workspaceFilter && String(workspaceFilter).toLowerCase() === String(w.workspaceKey).toLowerCase());
          const isPinned = pinnedWs === w.workspaceKey;
          const isHov = activeWs === w.workspaceKey;

          const byClientEntries = w.byClient && Object.keys(w.byClient).length > 0
            ? Object.entries(w.byClient).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
            : (w.clients || ['dsh']).map((cName, ci) => [cName, ci === 0 ? (w.totalTokens || 1) : 0]).filter(([, v]) => v > 0);
          const outerAgentSlices = byClientEntries.map(([cName, val]) => ({
            key: `ag-${cName}`,
            value: val,
            color: clientColorMap.get(cName) || colorForAgent(cName),
          }));

          const tbt = w.tokensByType || {};
          const cacheTok = (tbt.cacheRead || 0) + (tbt.cacheWrite || 0);
          const inTok = tbt.input || 0;
          const outTok = (tbt.output || 0) + (tbt.reasoning || 0);
          const typedSum = cacheTok + inTok + outTok;
          const promptSum = (tbt.input || 0) + (tbt.cacheRead || 0) + (tbt.cacheWrite || 0);
          const wsHitRate = promptSum > 0 ? (tbt.cacheRead || 0) / promptSum : null;
          const innerTypeSlices = typedSum > 0
            ? [
                { key: 'cache', value: cacheTok, color: TOKEN_COLORS.cacheRead },
                { key: 'in', value: inTok, color: TOKEN_COLORS.input },
                { key: 'out', value: outTok, color: TOKEN_COLORS.reasoning },
              ]
            : [{ key: 'fallback', value: 1, color: wsCol }];

          return h('button', {
            key: w.workspaceKey,
            type: 'button',
            'aria-pressed': isSel || isPinned,
            className: 'tu-ws-row',
            title: `${w.workspaceKey}\nTokens: ${compact(w.totalTokens)} (${pct(share)})` + (w.cost > 0 ? `\nEst. cost: ${cost(w.cost)}` : '') + `\n${t('单击锁定高亮 · 双击筛选下方任务卡片墙', 'Click to pin · Double-click to filter task cards')}`,
            onMouseEnter: () => { if (!pinnedWs) setHoveredWs(w.workspaceKey); },
            onClick: () => togglePinWs(w.workspaceKey),
            onDoubleClick: () => toggleWorkspace(w.workspaceKey),
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 11px',
              borderColor: isSel ? C.accent : ((isPinned || isHov) ? wsCol : undefined),
              background: isSel ? C.accentSoft : C.s1,
            },
          },
          h('div', { style: { position: 'relative', width: RING.s.D, height: RING.s.D, flex: `0 0 ${RING.s.D}px`, display: 'grid', placeItems: 'center' } },
            h('svg', { width: RING.s.D, height: RING.s.D, viewBox: '0 0 54 54', 'aria-hidden': true },
              h('circle', { cx: 27, cy: 27, r: 22, className: 'tu-ring-track', strokeWidth: RING.s.sw }),
              h('circle', { cx: 27, cy: 27, r: 15, className: 'tu-ring-track', strokeWidth: 3.6 }),
              ...buildRingArcs(outerAgentSlices, 22, 27, 27, RING.s.sw, 1.1),
              ...buildRingArcs(innerTypeSlices, 15, 27, 27, 3.6, 0.9)),
            h('span', {
              className: 'tu-num',
              style: { position: 'absolute', fontSize: 10, fontWeight: 600, color: C.text, pointerEvents: 'none' },
            }, share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`)),

          h('div', { style: { flex: 1, minWidth: 0, display: 'grid', gap: 3 } },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 } },
              h('span', { style: { fontWeight: 600, fontSize: 'var(--tu-fs-xs)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' } },
                dot(wsCol), w.label),
              w.taskCount > 0
                ? h('span', { className: 'tu-num', style: { fontSize: 10, padding: '0 6px', borderRadius: 999, background: C.panel2, color: C.muted, flexShrink: 0 } },
                    t(`${w.taskCount} 任务`, `${w.taskCount}t`))
                : null),
            h('div', { className: 'tu-num', style: { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '2px 7px', fontSize: 'var(--tu-fs-xs)' } },
              h('strong', null, compact(w.totalTokens)),
              w.cost > 0 ? h('span', { style: { color: ink(C.spend, 76), fontWeight: 600, fontSize: 'var(--tu-fs-1)' } }, shortCost(w.cost)) : null,
              wsHitRate != null && wsHitRate > 0
                ? h('span', { style: { color: C.muted, fontSize: 11 } }, t(`缓 ${Math.round(wsHitRate * 100)}%`, `Hit ${Math.round(wsHitRate * 100)}%`))
                : null),
            h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '1px 7px', fontSize: 11, color: C.muted, overflow: 'hidden' } },
              ...byClientEntries.slice(0, 3).map(([cName, val]) => h('span', { key: cName, className: 'tu-num' },
                dot(clientColorMap.get(cName) || colorForAgent(cName)),
                byClientEntries.length > 1 ? `${cName} ${compact(val)}` : cName)))));
        })),
        workspaces.length > 6
          ? h('button', {
              type: 'button',
              className: 'tu-btn',
              style: { justifySelf: 'start' },
              onClick: () => setWsExpanded(v => !v),
            }, wsExpanded ? t('收起至前 6 项', 'Show top 6') : t(`展开全部项目 (${workspaces.length})`, `Show all (${workspaces.length})`))
          : null);
      })();

      const matrixView = (() => {
        const { agents, models, cells, maxCellTokens } = matrixData;
        const cols = `minmax(96px, 1.3fr) repeat(${agents.length}, minmax(72px, 1fr))`;
        return h('div', {
          key: 'mx',
          className: 'tu-enter',
          style: { display: 'grid', gap: 5, marginTop: 10, overflowX: 'auto' },
          onMouseLeave: () => { if (!pinnedCellKey) hover?.set?.({ model: null }); },
        },
          h('div', { style: { display: 'grid', gridTemplateColumns: cols, gap: 5, fontSize: 'var(--tu-fs-1)', color: C.muted, fontWeight: 600, paddingBottom: 3, borderBottom: '1px solid ' + C.border } },
            h('span', null, t('模型 \\ Agent', 'Model \\ Agent')),
            ...agents.map(ag => h('span', { key: ag, style: { textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
              dot(clientColorMap.get(ag) || colorForAgent(ag)), ag))),
          ...models.map(md => h('div', {
            key: md,
            'data-model-tone': md,
            onMouseEnter: () => { if (!pinnedCellKey) hover?.set?.({ model: md }); },
            style: { display: 'grid', gridTemplateColumns: cols, gap: 5, alignItems: 'center', fontSize: 'var(--tu-fs-xs)' },
          },
            h('span', { title: md, style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 } }, md),
            ...agents.map(ag => {
              const cellKey = `${ag}\0${md}`;
              const cell = cells.get(cellKey);
              if (!cell || !(cell.tokens > 0)) {
                return h('div', { key: ag, style: { textAlign: 'right', color: C.muted, padding: '4px 6px' } }, '·');
              }
              const isPinned = pinnedCellKey === cellKey;
              const intensity = Math.max(8, Math.min(38, Math.round((cell.tokens / (maxCellTokens || 1)) * 38)));
              return h('button', {
                key: ag,
                type: 'button',
                'aria-pressed': isPinned,
                className: 'tu-btn tu-num',
                title: `${ag} × ${md}\nTokens: ${num(cell.tokens)}\nCost: ${cost(cell.cost)}\nUnit: ${unitPriceFmt(cell.unitCost)}\n${t('单击锁定高亮 · 双击组合筛选', 'Click to pin · Double-click to filter')}`,
                onClick: () => {
                  const next = isPinned ? null : cellKey;
                  setPinnedCellKey(next);
                  hover?.set?.({ agent: next ? ag : null, model: next ? md : null });
                },
                onDoubleClick: () => {
                  setPinnedCellKey(null);
                  hover?.set?.({ agent: null, model: null });
                  actions.pickAgentModel(ag, md);
                },
                style: {
                  padding: '4px 6px',
                  textAlign: 'right',
                  background: `color-mix(in oklab, var(--tu-accent) ${intensity}%, var(--tu-s1))`,
                  borderColor: isPinned ? C.accent : `color-mix(in oklab, var(--tu-accent) ${Math.min(48, intensity + 12)}%, var(--tu-line))`,
                  display: 'grid',
                  gap: 1,
                },
              },
              h('strong', { style: { fontSize: 'var(--tu-fs-1)' } }, compact(cell.tokens)),
              cell.cost > 0 ? h('small', { style: { fontSize: 'var(--tu-fs-1)', color: C.muted } }, shortCost(cell.cost)) : null);
            }))));
      })();

      const executionView = (() => {
        if (!hasExec) {
          return h('p', { style: { color: C.muted, fontSize: 'var(--tu-fs-xs)', marginTop: 12 } }, t('当前筛选不含 DSH 细粒度阶段计时样本。', 'No DSH phase timing samples in this filter.'));
        }
        const phases = [
          [t('首字等待 TTFT', 'TTFT wait'), tbd.ttftMs, TONE[2]],
          [t('思考推理', 'Reasoning'), tbd.reasoningMs, TOKEN_COLORS.reasoning],
          [t('正文生成', 'Answer gen'), tbd.textMs, TOKEN_COLORS.output],
          [t('工具编排', 'Tool args'), tbd.toolArgMs, TOKEN_COLORS.input],
          [t('工具执行', 'Tool exec'), tbd.toolsMs, COOL_PALETTE[4]],
        ].filter(([, ms]) => ms > 0);
        const phaseSum = phases.reduce((s, [, ms]) => s + ms, 0) || 1;
        const rankedTools = [...topTools]
          .map(tl => ({ ...tl, totalMsCalc: Number(tl.totalMs) || ((Number(tl.calls) || 0) * (Number(tl.avgMs) || 0)) }))
          .sort((a, b) => (b.totalMsCalc || b.calls || 0) - (a.totalMsCalc || a.calls || 0));
        const maxToolMs = rankedTools.reduce((mx, tl) => Math.max(mx, tl.totalMsCalc || 1), 1);

        return h('div', { key: 'ex', className: 'tu-enter', style: { display: 'grid', gap: 10, marginTop: 10 } },
          phases.length
            ? h('div', { style: { display: 'grid', gap: 6 } },
                h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 'var(--tu-fs-1)', color: C.muted } },
                  h('span', null, t('阶段耗时解剖', 'Phase timing anatomy')),
                  h('span', { className: 'tu-num' }, `${tbd.calls || 0} LLM calls · ${tbd.toolCalls || 0} tool calls`)),
                h('div', { className: 'tu-meter tu-meter--md' },
                  ...phases.map(([pName, ms, col]) => h('div', {
                    key: pName,
                    title: `${pName}: ${durFmt(ms)} (${pct(ms / phaseSum)})`,
                    style: { width: `${Math.max(2, (ms / phaseSum) * 100)}%`, background: col },
                  }))),
                h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px 10px', fontSize: 'var(--tu-fs-1)' } },
                  ...phases.map(([pName, ms, col]) => h('span', { key: pName, style: { color: C.muted } },
                    dot(col), `${pName} `, h('strong', { className: 'tu-num', style: { color: C.text } }, durFmt(ms))))))
            : null,
          rankedTools.length
            ? h('div', { style: { display: 'grid', gap: 6, paddingTop: 6, borderTop: '1px solid ' + C.border } },
                ...rankedTools.slice(0, 6).map((tl, ti) => {
                  const col = colorForCoolEntity(tl.name, ti);
                  return h('div', {
                    key: tl.name,
                    style: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(60px, 1fr) auto', alignItems: 'center', gap: 8, fontSize: 'var(--tu-fs-xs)' },
                  },
                  h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: tl.name }, tl.name),
                  h('div', { style: { height: 6, borderRadius: 999, background: soft(col, 15), overflow: 'hidden' } },
                    h('div', { style: { width: `${Math.max(4, (tl.totalMsCalc / maxToolMs) * 100)}%`, height: '100%', background: col, borderRadius: 999 } })),
                  h('span', { className: 'tu-num', style: { color: C.muted, fontSize: 'var(--tu-fs-1)' } },
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
        cardHead(
          titleMap[effTab],
          effTab === 'workspaces' ? t('单击锁定 · 双击过滤任务墙', 'Click pin · 2× filter tasks') : null,
          tabOptions.length > 1
            ? h(Segmented, { options: tabOptions, value: effTab, onChange: setTab, ariaLabel: t('深度洞察视图', 'Deep workbench view') })
            : null,
        ),
        effTab === 'workspaces' ? workspaceView : effTab === 'matrix' ? matrixView : executionView);
    });

    const TaskStream = memo(function TaskStream({ tasks, clientFilter, workspaceFilter, setWorkspaceFilter, clientColorMap }) {
      const [taskQuery, setTaskQuery] = useState('');
      const [taskClientFilter, setTaskClientFilter] = useState('all');
      const [taskSort, setTaskSort] = useState('tokens');
      const [showAll, setShowAll] = useState(false);
      const [expandedKey, setExpandedKey] = useState(null);
      const [pinnedTaskAgent, setPinnedTaskAgent] = useState(null);
      const deferredQuery = typeof React.useDeferredValue === 'function' ? React.useDeferredValue(taskQuery) : taskQuery;

      useEffect(() => {
        setTaskClientFilter('all');
        setPinnedTaskAgent(null);
      }, [clientFilter]);

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
      const wsFilterLower = workspaceFilter ? String(workspaceFilter).toLowerCase() : '';

      const filtered = useMemo(() => {
        const q = deferredQuery.trim().toLowerCase();
        return tasks
          .filter(tk => activeClientPill === 'all' || tk.client === activeClientPill)
          .filter(tk => !wsFilterLower || String(tk.workspaceKey || '').toLowerCase() === wsFilterLower)
          .filter(tk => !q || [tk.title, tk.cwd, tk.model, tk.client].some(v => String(v || '').toLowerCase().includes(q)))
          .sort((a, b) => {
            if (taskSort === 'cost') return (b.cost ?? -1) - (a.cost ?? -1) || (b.totalTokens || 0) - (a.totalTokens || 0);
            if (taskSort === 'recent') return (b.updatedAt || 0) - (a.updatedAt || 0);
            if (taskSort === 'tps') return (b.outputTps ?? -1) - (a.outputTps ?? -1);
            return (b.totalTokens || 0) - (a.totalTokens || 0);
          });
      }, [tasks, activeClientPill, wsFilterLower, deferredQuery, taskSort]);

      const visible = showAll ? filtered.slice(0, 48) : filtered.slice(0, 6);
      const maxTok = filtered.reduce((mx, tk) => Math.max(mx, tk.totalTokens || 0), 1);
      const filteredTokSum = filtered.reduce((s, tk) => s + (tk.totalTokens || 0), 0) || 1;
      const hasLocalLens = activeClientPill !== 'all' || Boolean(workspaceFilter) || Boolean(deferredQuery.trim());
      const sortOptions = [
        ['tokens', t('按用量', 'By tokens')],
        ...(hasTaskCost ? [['cost', t('按费用', 'By cost')]] : []),
        ['recent', t('按最近', 'Recent')],
        ['tps', t('按吞吐', 'By speed')],
      ];

      // Build Task Overview Dual Rings (Agent Mix Ring + Token Type / Origin Ring) when >=2 sessions exist
      const taskOverviewWell = useMemo(() => {
        if (filtered.length < 2) return null;
        const byAg = new Map();
        let sumIn = 0, sumOut = 0, sumCache = 0, sumReas = 0, mainTok = 0, subTok = 0;
        for (const tk of filtered) {
          const tVal = tk.totalTokens || 0;
          if (tk.client && tVal > 0) byAg.set(tk.client, (byAg.get(tk.client) || 0) + tVal);
          sumIn += tk.input || 0;
          sumOut += tk.output || 0;
          sumCache += (tk.cacheRead || 0) + (tk.cacheWrite || 0);
          sumReas += tk.reasoning || 0;
          if (tk.isSubagent) subTok += tVal;
          else mainTok += tVal;
        }
        const agSlices = [...byAg.entries()].sort((a, b) => b[1] - a[1]).map(([cName, val]) => ({
          key: cName,
          value: val,
          color: clientColorMap.get(cName) || colorForAgent(cName),
          onClick: () => setPinnedTaskAgent(prev => prev === cName ? null : cName),
          onDoubleClick: () => setTaskClientFilter(prev => prev === cName ? 'all' : cName),
        }));
        const typedSum = sumIn + sumOut + sumCache + sumReas;
        const typeSlices = typedSum > 0
          ? [
              { key: 'cache', value: sumCache, color: TOKEN_COLORS.cacheRead },
              { key: 'in', value: sumIn, color: TOKEN_COLORS.input },
              { key: 'out', value: sumOut, color: TOKEN_COLORS.output },
              { key: 'reas', value: sumReas, color: TOKEN_COLORS.reasoning },
            ]
          : [
              { key: 'main', value: mainTok, color: COOL_PALETTE[0] },
              { key: 'sub', value: subTok, color: COOL_PALETTE[2] },
            ];
        const focusedAgTok = pinnedTaskAgent ? (byAg.get(pinnedTaskAgent) || 0) : 0;

        return h('div', {
          className: 'tu-well',
          style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 12 },
        },
        h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 } },
          // Ring 1: Session Agent Share
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
            h('div', { style: { position: 'relative', width: RING.m.D, height: RING.m.D, flex: `0 0 ${RING.m.D}px`, display: 'grid', placeItems: 'center' } },
              h('svg', { width: RING.m.D, height: RING.m.D, viewBox: '0 0 72 72', 'aria-hidden': true },
                h('circle', { cx: 36, cy: 36, r: 27, className: 'tu-ring-track', strokeWidth: RING.m.sw }),
                ...buildRingArcs(agSlices, 27, 36, 36, RING.m.sw, 1.3, { hoverKey: pinnedTaskAgent })),
              h('div', { style: { position: 'absolute', inset: 13, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none', lineHeight: 1.1 } },
                h('strong', { style: { fontSize: 10, maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                  pinnedTaskAgent || t('Agent占比', 'Agents')),
                h('span', { className: 'tu-num', style: { fontSize: 9.5, color: C.muted } },
                  pinnedTaskAgent ? pct(focusedAgTok / filteredTokSum) : compact(filteredTokSum))))),
          // Ring 2: Session Token Anatomy Share
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
            h('div', { style: { position: 'relative', width: RING.m.D, height: RING.m.D, flex: `0 0 ${RING.m.D}px`, display: 'grid', placeItems: 'center' } },
              h('svg', { width: RING.m.D, height: RING.m.D, viewBox: '0 0 72 72', 'aria-hidden': true },
                h('circle', { cx: 36, cy: 36, r: 27, className: 'tu-ring-track', strokeWidth: RING.m.sw }),
                ...buildRingArcs(typeSlices, 27, 36, 36, RING.m.sw, 1.3)),
              h('div', { style: { position: 'absolute', inset: 13, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none', lineHeight: 1.1 } },
                h('strong', { style: { fontSize: 10 } }, typedSum > 0 ? t('构成比', 'Tokens') : t('主/子', 'Origin')),
                h('span', { className: 'tu-num', style: { fontSize: 9.5, color: C.muted } },
                  typedSum > 0 ? pct(sumCache / typedSum) : `${filtered.length}t`))))),
        h('div', { style: { display: 'grid', gap: 2, fontSize: 'var(--tu-fs-1)', color: C.muted } },
          h('strong', { style: { color: C.text } }, t('每张任务卡内嵌双环解剖', 'Per-task concentric rings')),
          h('span', null, dot(TOKEN_COLORS.cacheRead), t('外环：缓存复用 · 输入 · 输出 · 推理', 'Outer: Cache · Input · Output · Reasoning')),
          h('span', null, t('● 内环：相对峰值规模 / 上下文负载 · 单击卡片展开明细', '● Inner: Relative scale / CTX load · Click card to expand'))));
      }, [filtered, clientColorMap, pinnedTaskAgent, filteredTokSum]);

      return h('section', { id: 'tu-sec-tasks', className: 'tu-card tu-tasks-sec' },
        h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' } },
            h('strong', { className: 'tu-card-hd__title' }, t('任务用量详情', 'Task usage')),
            h('span', { className: 'tu-num', style: { fontSize: 'var(--tu-fs-1)', color: C.muted } },
              hasLocalLens
                ? t(`筛选 ${filtered.length} / ${tasks.length} 个会话`, `${filtered.length} / ${tasks.length} tasks`)
                : t(`已显示 ${visible.length} / ${filtered.length} 个会话`, `${visible.length} / ${filtered.length} tasks`)),
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
                  className: 'tu-btn tu-btn-active',
                  onClick: () => setWorkspaceFilter(''),
                  style: { padding: '2px 8px', borderRadius: 999 },
                }, t(`仅项目: ${workspaceFilter.split('/').pop()} ×`, `Project: ${workspaceFilter.split('/').pop()} ×`))
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
        taskOverviewWell,
        visible.length
          ? h('div', { className: 'tu-tasks' },
              ...visible.map(tk => {
                const cardKey = tk.client + ':' + tk.id;
                const isExp = expandedKey === cardKey;
                const tc = clientColorMap.get(tk.client) || colorForAgent(tk.client);
                const scaleRatio = maxTok > 0 ? Math.max(0.05, Math.min(1, (tk.totalTokens || 0) / maxTok)) : 0.05;
                const shareRatio = (tk.totalTokens || 0) / filteredTokSum;
                const displayTitle = prettyTaskTitle(tk);
                const unitPrice = tk.totalTokens > 0 && tk.cost > 0 ? (tk.cost / tk.totalTokens) * 1e6 : null;

                // Outer ring: per-task token composition (Cache / Input / Output / Reasoning)
                const tkCache = (tk.cacheRead || 0) + (tk.cacheWrite || 0);
                const tkIn = tk.input || 0;
                const tkOut = tk.output || 0;
                const tkReas = tk.reasoning || 0;
                const tkTypedSum = tkCache + tkIn + tkOut + tkReas;
                const outerSlices = tkTypedSum > 0
                  ? [
                      { key: 'cache', value: tkCache, color: TOKEN_COLORS.cacheRead },
                      { key: 'in', value: tkIn, color: TOKEN_COLORS.input },
                      { key: 'out', value: tkOut, color: TOKEN_COLORS.output },
                      { key: 'reas', value: tkReas, color: TOKEN_COLORS.reasoning },
                    ]
                  : [{ key: 'total', value: Math.max(1, tk.totalTokens || 1), color: tc }];

                // Inner ring: context load (when known) or relative scale vs peak session
                const innerLoad = tk.contextRatio != null ? Math.max(0.06, Math.min(1, tk.contextRatio)) : scaleRatio;
                const innerCirc = 2 * Math.PI * 15;
                const innerDash = `${(innerLoad * innerCirc).toFixed(2)} ${innerCirc.toFixed(2)}`;
                const centerRingText = shareRatio < 0.01 ? '<1%' : `${Math.round(shareRatio * 100)}%`;

                const dimmedByOverview = pinnedTaskAgent && pinnedTaskAgent !== tk.client;

                return h('div', {
                  key: cardKey,
                  className: 'tu-task-card',
                  onClick: () => setExpandedKey(prev => prev === cardKey ? null : cardKey),
                  style: { cursor: 'pointer', borderColor: isExp ? C.accent : undefined, opacity: dimmedByOverview ? 0.36 : 1 },
                },
                h('div', { style: { display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 } },
                  // Embedded 54x54 Concentric Dual Ring per Task Card
                  h('div', { style: { position: 'relative', width: RING.s.D, height: RING.s.D, flex: `0 0 ${RING.s.D}px`, display: 'grid', placeItems: 'center' } },
                    h('svg', { width: RING.s.D, height: RING.s.D, viewBox: '0 0 54 54', 'aria-hidden': true },
                      h('circle', { cx: 27, cy: 27, r: 22, className: 'tu-ring-track', strokeWidth: RING.s.sw }),
                      h('circle', { cx: 27, cy: 27, r: 15, className: 'tu-ring-track', strokeWidth: 3.6 }),
                      ...buildRingArcs(outerSlices, 22, 27, 27, RING.s.sw, 1.0),
                      h('circle', {
                        className: 'tu-arc',
                        'data-agent-tone': tk.client,
                        cx: 27, cy: 27, r: 15, fill: 'none',
                        stroke: tc,
                        strokeWidth: 3.6,
                        strokeLinecap: 'round',
                        strokeDasharray: innerDash,
                        transform: 'rotate(-90 27 27)',
                        style: { strokeDasharray: innerDash },
                      })),
                    h('span', { className: 'tu-num', style: { position: 'absolute', fontSize: 9.5, fontWeight: 600, color: C.text, pointerEvents: 'none' } }, centerRingText)),

                  // Task Metadata & Primary Readout
                  h('div', { style: { flex: 1, minWidth: 0, display: 'grid', gap: 4 } },
                    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 } },
                      h('div', { style: { display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 } },
                        h('span', { 'data-agent-tone': tk.client, style: { fontSize: 'var(--tu-fs-1)', fontWeight: 600, padding: '0 6px', borderRadius: 999, background: soft(tc, 14), color: ink(tc, 76), flexShrink: 0 } }, String(tk.client || '').toUpperCase()),
                        tk.isSubagent ? h('span', { style: { fontSize: 'var(--tu-fs-1)', padding: '0 5px', borderRadius: 999, background: soft(TOKEN_COLORS.reasoning, 14), color: ink(TOKEN_COLORS.reasoning, 74), flexShrink: 0 } }, t('子代理', 'SUB')) : null,
                        tk.contextRatio != null ? h('span', { className: 'tu-num', title: t('峰值上下文窗口占用率', 'Context window load'), style: { fontSize: 'var(--tu-fs-1)', color: tk.contextRatio > 0.8 ? ink(C.warn, 76) : C.muted } }, `CTX ${Math.round(tk.contextRatio * 100)}%`) : null),
                      h('span', { style: { fontSize: 'var(--tu-fs-1)', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, tk.model)),
                    h('div', { style: { fontWeight: 600, fontSize: 'var(--tu-fs-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: tk.title }, displayTitle),
                    h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
                      tk.cwd
                        ? tk.workspaceKey
                          ? h('button', {
                              type: 'button',
                              onClick: e => { e.stopPropagation(); setWorkspaceFilter(prev => String(prev).toLowerCase() === String(tk.workspaceKey).toLowerCase() ? '' : tk.workspaceKey); },
                              title: t(`点击仅看该项目任务：${tk.cwd}`, `Filter tasks by workspace: ${tk.cwd}`),
                              style: { background: C.s2, border: '1px solid ' + C.border, borderRadius: 6, padding: '0 6px', textAlign: 'left', font: 'inherit', fontSize: 11, color: C.muted, cursor: 'pointer', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                            }, shortPath(tk.cwd))
                          : h('span', { style: { fontSize: 'var(--tu-fs-1)', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: tk.cwd }, shortPath(tk.cwd))
                        : h('span', null),
                      h('span', { className: 'tu-num', style: { fontSize: 'var(--tu-fs-2)' } },
                        valUnit(compact(tk.totalTokens), 'tok'),
                        Number.isFinite(tk.cost) && tk.cost > 0
                          ? h('small', { style: { color: ink(C.spend, 76), fontWeight: 600, marginLeft: 6 } }, shortCost(tk.cost))
                          : null)))),

                isExp
                  ? h('div', {
                      className: 'tu-enter tu-well tu-num',
                      style: { fontSize: 'var(--tu-fs-1)', color: C.muted, padding: '6px 9px', display: 'grid', gap: 4 },
                    },
                    h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 8 } },
                      h('span', { className: 'tu-mono' }, `ID: ${String(tk.id || '').slice(0, 14)}` + (String(tk.id || '').length > 14 ? '…' : '')),
                      tk.updatedAt ? h('span', null, time(tk.updatedAt)) : null),
                    tkTypedSum > 0
                      ? h('div', { className: 'tu-meter' },
                          ...[
                            [tkCache, TOKEN_COLORS.cacheRead],
                            [tkIn, TOKEN_COLORS.input],
                            [tkOut, TOKEN_COLORS.output],
                            [tkReas, TOKEN_COLORS.reasoning],
                          ].map(([v, c], bi) => v > 0 ? h('div', { key: bi, style: { width: `${Math.max(2, (v / tkTypedSum) * 100)}%`, background: c } }) : null))
                      : null,
                    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '2px 8px' } },
                      tk.cacheRead > 0 ? h('span', null, dot(TOKEN_COLORS.cacheRead), `${t('缓存', 'Cache')} ${compact(tk.cacheRead)}`) : null,
                      tk.input > 0 ? h('span', null, dot(TOKEN_COLORS.input), `${t('输入', 'In')} ${compact(tk.input)}`) : null,
                      tk.output > 0 ? h('span', null, dot(TOKEN_COLORS.output), `${t('输出', 'Out')} ${compact(tk.output)}`) : null,
                      tk.reasoning > 0 ? h('span', null, dot(TOKEN_COLORS.reasoning), `${t('推理', 'Reas')} ${compact(tk.reasoning)}`) : null),
                    unitPrice != null || Number.isFinite(tk.avgTtftMs)
                      ? h('div', { style: { display: 'flex', gap: 10 } },
                          unitPrice != null ? h('span', null, `${t('单价', 'Rate')} ${unitPriceFmt(unitPrice)}`) : null,
                          Number.isFinite(tk.avgTtftMs) ? h('span', null, `TTFT ${(tk.avgTtftMs / 1000).toFixed(2)}s`) : null)
                      : null)
                  : null,

                h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--tu-fs-1)', color: C.muted, paddingTop: 4, borderTop: '1px solid ' + C.border } },
                  h('span', { className: 'tu-num' }, [
                    Number.isFinite(tk.outputTps) ? tpsFmt(tk.outputTps) : null,
                    tk.wallMs > 0 ? durFmt(tk.wallMs) : null,
                    tk.steps > 0 ? `${tk.steps} steps` : (tk.turns > 0 ? `${tk.turns}t` : null),
                  ].filter(Boolean).join(' · ') || relTime(tk.updatedAt)),
                  h('span', { style: { color: C.ink3 } }, isExp ? t('收起 ▴', 'Less ▴') : t('详情 ▾', 'Inspect ▾'))));
              }))
          : h('p', { style: { color: C.muted, fontSize: 'var(--tu-fs-xs)', margin: 0 } },
              hasLocalLens
                ? t('当前列表筛选条件下没有匹配的任务，点击上方筛选胶囊可清除列表过滤。', 'No tasks matched the active list filter; clear the pill above to show all.')
                : t('当前筛选范围内暂无本地任务记录（支持 Antigravity、Codex 与 DSH 本地会话）。', 'No local task records in this filter window (reads Antigravity, Codex & DSH local sessions).')),
        filtered.length > 6
          ? h('button', { type: 'button', className: 'tu-btn', style: { marginTop: 10 }, onClick: () => setShowAll(v => !v) },
              showAll ? t('收起任务列表', 'Show top 6 tasks') : t(`展开更多 (共 ${Math.min(48, filtered.length)} 条)`, `Show more (${Math.min(48, filtered.length)})`))
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
        h('span', { 'aria-hidden': true, style: { color: checked ? C.accentInk : C.muted, fontWeight: 600 } }, checked ? '✓' : '+'),
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
      sources, errors, sourceProbe, scopeState, showScopeEditor, forceOpenToken, actions,
    }) {
      const observedCount = sources.filter(s => s?.observed && !s?.error).length;
      const errorCount = sources.filter(s => Boolean(s?.error)).length;
      const idleCount = Math.max(0, sources.length - observedCount - errorCount);
      // Fix Bug B1: initialize open only on initial errors or initial explicit probe, so "Hide details" always collapses
      const [expanded, setExpanded] = useState(() => errorCount > 0 || errors.length > 0 || Boolean(sourceProbe?.candidates?.length || sourceProbe?.error));
      useEffect(() => {
        if (errorCount > 0 || errors.length > 0) setExpanded(true);
      }, [errorCount, errors.length]);
      useEffect(() => {
        if (forceOpenToken) setExpanded(true);
      }, [forceOpenToken]);
      const showDetails = expanded;

      const cleanErrMsg = raw => {
        const s = typeof raw === 'string' ? raw : JSON.stringify(raw);
        const m = s.match(/timed out after (\d+)ms/i);
        if (m) return t(`扫描超时 (${Math.round(Number(m[1]) / 1000)}s)`, `Timed out (${Math.round(Number(m[1]) / 1000)}s)`);
        return s;
      };

      return h('section', { id: 'tu-sec-engines', className: 'tu-card', style: { padding: '10px 14px' } },
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
            h('button', { type: 'button', className: 'tu-btn', style: { padding: '3px 9px' }, onClick: () => { setExpanded(true); actions.probeDirs(); } }, t('探测本地目录', 'Check local dirs')),
            h('button', { type: 'button', className: 'tu-btn', 'aria-pressed': showScopeEditor, style: { padding: '3px 9px' }, onClick: () => actions.toggleScope(true) }, t('⚙ 选择常用 Harness', '⚙ Configure harnesses')))),
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
                        background: isOk ? soft(C.ok, 13) : C.bg,
                        borderColor: isErr ? C.error : isOk ? soft(C.ok, 28) : C.border,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      },
                    },
                    h('span', { 'aria-hidden': true, style: { width: 7, height: 7, borderRadius: '50%', background: sc, display: 'inline-block' } }),
                    name,
                    isErr ? h('small', { style: { color: ink(C.error, 76) } }, t('重试', 'Retry')) : null);
                  }))
              : null,
            errors.length
              ? h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } },
                  ...errors.map(([key, value]) => h('span', {
                    key,
                    style: { fontSize: 'var(--tu-fs-xs)', color: ink(C.error, 76), padding: '2px 8px', borderRadius: 6, background: soft(C.error, 12) },
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

      // Panoramic navigation state: 20-step history stack + cross-section jump signals
      const [navHistory, setNavHistory] = useState([]);
      const [trendReqMode, setTrendReqMode] = useState(null);
      const [deepReqTab, setDeepReqTab] = useState(null);
      const [diagOpenSignal, setDiagOpenSignal] = useState(0);
      const [themePref, setThemePref] = useState('auto'); // 'auto' | 'light' | 'dark'

      const [hover] = useState(() => createHoverStore({
        idx: null, date: null, agent: null, model: null,
        pinnedIdx: null, pinnedDate: null, pinnedAgent: null,
      }));
      const rootRef = useRef(null);
      const prevRangeRef = useRef({ range: 'today', since: '', until: '' });
      const drilledDayRef = useRef('');

      useHostTheme(rootRef, themePref);

      // Sync hover/pinned agent & model onto root DOM attributes for zero-React-rerender CSS dimming
      useEffect(() => hover.subscribe(() => {
        const el = rootRef.current;
        if (!el) return;
        const st = hover.get();
        const effAgent = st.pinnedAgent || st.agent;
        const effModel = st.model;
        if (effAgent) el.setAttribute('data-hover-agent', effAgent);
        else el.removeAttribute('data-hover-agent');
        if (effModel) el.setAttribute('data-hover-model', effModel);
        else el.removeAttribute('data-hover-model');
      }), [hover]);

      const focusSection = useCallback(secId => {
        const root = rootRef.current;
        const target = root?.querySelector?.(`#${secId}`);
        target?.scrollIntoView?.({ behavior: REDUCED_MOTION.matches ? 'auto' : 'smooth', block: 'nearest' });
      }, []);

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

      const pushHistory = useCallback(snap => {
        setNavHistory(prev => {
          const last = prev[prev.length - 1];
          if (last && querySignature(last) === querySignature(snap)) return prev;
          return [...prev.slice(-19), { ...snap }];
        });
      }, []);

      const dispatchQuery = useCallback((next, pushPrev = true) => {
        if (querySignature(next) === querySignature(filters)) return;
        if (pushPrev) pushHistory(filters);
        sequence.latestFilters = next;
        setFilters(next);
        const onlyClientOrModel = next.range === filters.range && next.since === filters.since && next.until === filters.until;
        if (onlyClientOrModel && data?.meta?.derivedFromBase) {
          void load(next, false, true).then(hit => {
            if (!hit && sequence.latestFilters === next) void load(next, false, false);
          });
          return;
        }
        void load(next, false, false);
      }, [filters, data, load, sequence, pushHistory]);

      const applyImmediate = useCallback(next => {
        dispatchQuery(next, true);
      }, [dispatchQuery]);

      const goBack = useCallback(() => {
        setNavHistory(prev => {
          if (!prev.length) return prev;
          const target = prev[prev.length - 1];
          drilledDayRef.current = '';
          sequence.latestFilters = target;
          setFilters(target);
          void load(target, false, false);
          return prev.slice(0, -1);
        });
      }, [load, sequence]);

      useEffect(() => {
        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return undefined;
        const onKey = e => {
          if (e.altKey && e.key === 'ArrowLeft' && navHistory.length > 0) {
            e.preventDefault();
            goBack();
          }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [navHistory.length, goBack]);

      const drillToDay = useCallback(dateStr => {
        const isAlreadyThisDay = filters.range === 'custom' && filters.since === dateStr && filters.until === dateStr;
        if (isAlreadyThisDay) {
          // Click same day again -> toggle back out
          const prev = prevRangeRef.current || { range: 'today', since: '', until: '' };
          drilledDayRef.current = '';
          dispatchQuery({ ...filters, range: prev.range, since: prev.since || '', until: prev.until || '' }, true);
          return;
        }
        const isAlreadySingleDay = filters.range === 'custom' && filters.since && filters.since === filters.until;
        if (!isAlreadySingleDay) {
          prevRangeRef.current = { range: filters.range, since: filters.since, until: filters.until };
        }
        drilledDayRef.current = dateStr;
        dispatchQuery({ ...filters, range: 'custom', since: dateStr, until: dateStr }, true);
      }, [filters, dispatchQuery]);

      const exitSingleDay = useCallback(() => {
        const prev = prevRangeRef.current || { range: 'today', since: '', until: '' };
        drilledDayRef.current = '';
        const restored = prev.range === 'custom' && (!prev.since || !prev.until)
          ? { ...filters, range: 'today', since: '', until: '' }
          : { ...filters, range: prev.range, since: prev.since || '', until: prev.until || '' };
        dispatchQuery(restored, true);
      }, [filters, dispatchQuery]);

      const change = useCallback((key, value) => {
        const next = key === 'range' && value !== 'custom'
          ? { ...filters, range: value, since: '', until: '' }
          : { ...filters, [key]: value };
        if (key === 'range' && value !== 'custom') {
          prevRangeRef.current = { range: value, since: '', until: '' };
          drilledDayRef.current = '';
        }
        if (key === 'since' || key === 'until') {
          drilledDayRef.current = '';
        }
        if (querySignature(next) === querySignature(filters)) return;
        sequence.latestFilters = next;
        setFilters(next);
        if (key === 'range' && value === 'custom') {
          if (!next.since || !next.until || next.since > next.until) return;
          pushHistory(filters);
          void load(next, false, false);
          return;
        }
        if (key === 'since' || key === 'until') {
          if (!next.since || !next.until) return;
          if (next.since > next.until) {
            setValidation(t('请选择有效的起止日期，开始日期不能晚于结束日期。', 'Choose a valid start and end date in order.'));
            return;
          }
          pushHistory(filters);
          void load(next, false, false);
          return;
        }
        pushHistory(filters);
        if ((key === 'client' || key === 'model') && data?.meta?.derivedFromBase) {
          void load(next, false, true).then(hit => {
            if (!hit && sequence.latestFilters === next) void load(next, false, false);
          });
          return;
        }
        void load(next, false, false);
      }, [filters, data, load, sequence, pushHistory]);

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

      const openScopeEditor = useCallback((scrollToTop = false) => {
        if (showScopeEditor && !scrollToTop) { setShowScopeEditor(false); return; }
        const curMode = scopeState?.mode === 'all' ? 'all' : 'custom';
        const curList = Array.isArray(scopeState?.enabledClients) && scopeState.enabledClients.length
          ? distinct(scopeState.enabledClients.map(canonHarness))
          : CORE_HARNESS_PRESET;
        setDraftScopeMode(curMode);
        setDraftScopeClients(curList);
        setShowScopeEditor(true);
        if (scrollToTop) {
          setTimeout(() => focusSection('tu-sec-scope'), 40);
        }
        void loadSources(true).then(val => {
          if (val?.scope && !scopeState) {
            setDraftScopeMode(val.scope.mode === 'all' ? 'all' : 'custom');
            if (Array.isArray(val.scope.enabledClients) && val.scope.enabledClients.length) {
              setDraftScopeClients(val.scope.enabledClients);
            }
          }
        });
      }, [showScopeEditor, scopeState, loadSources, focusSection]);

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
      // Repeat clicks on the active Agent / Model / Matrix cell toggle cleanly back to 'all' (fixes B9 & B10)
      const pickDate = useEvent(d => drillToDay(d));
      const pickClient = useEvent(c => {
        const target = c !== 'all' && filters.client === c ? 'all' : c;
        change('client', target);
      });
      const pickModel = useEvent(md => {
        const target = md !== 'all' && filters.model === md ? 'all' : md;
        change('model', target);
      });
      const pickAgentModel = useEvent((ag, md) => {
        const same = filters.client === ag && filters.model === md;
        dispatchQuery({ ...filters, client: same ? 'all' : ag, model: same ? 'all' : md }, true);
      });
      const toggleDay = useEvent((d, wasSel) => (wasSel ? exitSingleDay() : drillToDay(d)));
      const exitSingleDayAct = useEvent(() => exitSingleDay());
      const pickRange = useEvent(rk => change('range', rk));
      const probeDirs = useEvent(() => void loadSources(true));
      const toggleScope = useEvent((fromBottom = false) => openScopeEditor(Boolean(fromBottom)));
      const closeScope = useEvent(() => setShowScopeEditor(false));
      const saveScope = useEvent((modeOv, listOv) => void saveScopeSelection(modeOv, listOv));
      const discoverAllEngines = useEvent(() => void triggerProgressive(filters, true));
      const retryClient = useEvent(c => void triggerProgressive({ ...filters, client: c }, false));
      const focusSecAct = useEvent(secId => focusSection(secId));
      const jumpKpi = useEvent(kind => {
        if (kind === 'tokens') {
          setTrendReqMode({ mode: 'auto', ts: Date.now() });
          focusSection('tu-sec-trend');
        } else if (kind === 'cost') {
          setModelRankBy('cost');
          focusSection('tu-sec-tri');
        } else if (kind === 'cache') {
          setTrendReqMode({ mode: 'cacheHit', ts: Date.now() });
          focusSection('tu-sec-trend');
        } else if (kind === 'tasks') {
          focusSection('tu-sec-tasks');
        } else if (kind === 'speed') {
          setDeepReqTab({ tab: 'execution', ts: Date.now() });
          focusSection('tu-sec-deep');
        } else if (kind === 'coverage') {
          setDiagOpenSignal(n => n + 1);
          focusSection('tu-sec-engines');
        }
      });

      const actions = useMemo(() => ({
        pickDate, pickClient, pickModel, pickAgentModel, toggleDay, exitSingleDay: exitSingleDayAct, pickRange,
        probeDirs, toggleScope, closeScope, saveScope, discoverAllEngines, retryClient,
        focusSection: focusSecAct, jumpKpi,
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
            const rawTp = entry.throughput;
            if (rawTp && Number.isFinite(rawTp.tokensPerSec)) {
              let tps = rawTp.tokensPerSec;
              let timedTok = rawTp.timedTokens || 0;
              const durMs = rawTp.totalDurationMs || 0;
              const promptTok = (Number(entry.input) || 0) + (Number(entry.cacheRead) || 0) + (Number(entry.cacheWrite) || 0);
              const genTok = (Number(entry.output) || 0) + (Number(entry.reasoning) || 0);
              const allTok = promptTok + genTok;
              // Guard against un-normalized tokscale all-token throughput (where cached prompt tokens inflate tok/s to 5K–35K+)
              if (!rawTp.outputNormalized && rawTp.source === 'tokscale' && promptTok > 0 && allTok > 0 && timedTok > genTok * 1.05) {
                const genShare = genTok / allTok;
                tps = tps * genShare;
                timedTok = timedTok * genShare;
              }
              if (tps > 0) {
                item.tpSum += tps;
                item.tpCount += 1;
                if (timedTok > 0 && durMs > 0) {
                  item.speedTokens += timedTok;
                  item.speedMs += durMs;
                }
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

        // Recompute clean aggregate output throughput if server throughputSummary still reflected raw all-token timedTokens
        let cleanEngineTokens = 0, cleanEngineMs = 0;
        for (const mRow of models) {
          if (mRow.speedTokens > 0 && mRow.speedMs > 0) {
            cleanEngineTokens += mRow.speedTokens;
            cleanEngineMs += mRow.speedMs;
          }
        }
        const cleanEngineTps = cleanEngineMs > 0 ? cleanEngineTokens / (cleanEngineMs / 1000) : null;

        return {
          rawAgents,
          familyAgents,
          hasMultiFamily: rawAgents.length > familyAgents.length,
          clientColorMap,
          agentOrder,
          models,
          bubbleRows,
          cleanEngineTps,
          matrixData: { agents: topAgents, models: topModels, cells: matrixCells, maxCellTokens },
        };
      }, [entries]);

      // Client-side case-insensitive workspace deduplication + task breakdown backfill (merges Talkanything casing & powers concentric rings immediately on Ctrl+R)
      const mergedWorkspaces = useMemo(() => {
        const rawWs = Array.isArray(data?.workspaces) ? data.workspaces : EMPTY;
        const rawTasks = Array.isArray(data?.tasks) ? data.tasks : EMPTY;
        if (!rawWs.length) return EMPTY;

        // Pre-aggregate task breakdowns by lowercase workspaceKey
        const taskAggByFold = new Map();
        for (const tk of rawTasks) {
          if (!tk?.workspaceKey) continue;
          const fk = String(tk.workspaceKey).toLowerCase();
          const cur = taskAggByFold.get(fk) || {
            byClient: {},
            tokensByType: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
          };
          const tTok = Number(tk.totalTokens) || 0;
          if (tk.client && tTok > 0) cur.byClient[tk.client] = (cur.byClient[tk.client] || 0) + tTok;
          cur.tokensByType.input += Number(tk.input) || 0;
          cur.tokensByType.output += Number(tk.output) || 0;
          cur.tokensByType.cacheRead += Number(tk.cacheRead) || 0;
          cur.tokensByType.cacheWrite += Number(tk.cacheWrite) || 0;
          cur.tokensByType.reasoning += Number(tk.reasoning) || 0;
          taskAggByFold.set(fk, cur);
        }

        const foldedMap = new Map();
        for (const w of rawWs) {
          if (!w?.workspaceKey) continue;
          const fk = String(w.workspaceKey).toLowerCase();
          const prev = foldedMap.get(fk);
          if (!prev) {
            foldedMap.set(fk, {
              workspaceKey: w.workspaceKey,
              label: w.label || w.workspaceKey.split('/').pop() || w.workspaceKey,
              totalTokens: Number(w.totalTokens) || 0,
              cost: Number(w.cost) || 0,
              taskCount: Number(w.taskCount) || 0,
              clients: [...(w.clients || [])],
              byClient: w.byClient ? { ...w.byClient } : {},
              tokensByType: w.tokensByType
                ? { ...w.tokensByType }
                : { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
            });
          } else {
            prev.totalTokens += Number(w.totalTokens) || 0;
            prev.cost += Number(w.cost) || 0;
            prev.taskCount += Number(w.taskCount) || 0;
            for (const cName of (w.clients || [])) {
              if (cName && !prev.clients.includes(cName)) prev.clients.push(cName);
            }
            for (const [ck, cv] of Object.entries(w.byClient || {})) {
              prev.byClient[ck] = (prev.byClient[ck] || 0) + (Number(cv) || 0);
            }
            if (w.tokensByType) {
              for (const k of ['input', 'output', 'cacheRead', 'cacheWrite', 'reasoning']) {
                prev.tokensByType[k] += Number(w.tokensByType[k]) || 0;
              }
            }
          }
        }

        // Backfill from live tasks if server payload didn't carry per-workspace rings yet
        for (const [fk, item] of foldedMap.entries()) {
          const tAgg = taskAggByFold.get(fk);
          if (!tAgg) continue;
          if (Object.keys(item.byClient).length === 0 && Object.keys(tAgg.byClient).length > 0) {
            item.byClient = { ...tAgg.byClient };
          }
          const tSum = item.tokensByType.input + item.tokensByType.output + item.tokensByType.cacheRead + item.tokensByType.cacheWrite + item.tokensByType.reasoning;
          if (tSum === 0) {
            item.tokensByType = { ...tAgg.tokensByType };
          }
        }

        return [...foldedMap.values()].sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0));
      }, [data?.workspaces, data?.tasks]);

      // Fix Bug B8: auto-clear stale workspaceFilter when query changes and workspace is absent
      useEffect(() => {
        if (!workspaceFilter || !data) return;
        const wf = String(workspaceFilter).toLowerCase();
        const inWs = mergedWorkspaces.some(w => String(w.workspaceKey || '').toLowerCase() === wf);
        const inTasks = Array.isArray(data.tasks) && data.tasks.some(tk => String(tk?.workspaceKey || '').toLowerCase() === wf);
        if (!inWs && !inTasks) setWorkspaceFilter('');
      }, [data, mergedWorkspaces, workspaceFilter]);

      // Dynamic CSS rules for zero-rerender cross-chart Agent & Model dimming
      const hoverAgentCss = useMemo(() => {
        const agentRules = vm.agentOrder.map(ag => {
          const q = cssEsc(ag);
          return `[data-tokscale-usage][data-hover-agent="${q}"] [data-agent-tone]:not([data-agent-tone="${q}"]) { opacity: .26; fill-opacity: .24; }`;
        });
        const modelRules = vm.models.slice(0, 16).map(mItem => {
          const q = cssEsc(mItem.name);
          return `[data-tokscale-usage][data-hover-model="${q}"] [data-model-tone]:not([data-model-tone="${q}"]) { opacity: .28; }`;
        });
        return [...agentRules, ...modelRules].join('\n');
      }, [vm.agentOrder, vm.models]);

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
          ? h('span', { role: 'status', style: { fontSize: 'var(--tu-fs-xs)', color: meta.stale ? ink(C.warn, 76) : C.muted } }, reportStatus)
          : meta.updatedAt
            ? h('span', { title: time(meta.updatedAt), style: { fontSize: 'var(--tu-fs-xs)', color: C.muted } },
                t('已同步 · ', 'Synced · ') + relTime(meta.updatedAt))
            : null;

      const isSingleDay = filters.range === 'custom' && Boolean(filters.since) && filters.since === filters.until;
      const isSingleDayWindow = isSingleDay || filters.range === 'today' || filters.range === 'yesterday';
      const prevLabel = RANGE_LABELS[prevRangeRef.current?.range] || RANGE_LABELS.today;
      const isDrilledDay = isSingleDay && drilledDayRef.current === filters.since;
      const filterChips = [
        filters.client !== 'all' ? ['client', `Agent: ${filters.client}`, () => change('client', 'all')] : null,
        filters.model !== 'all' ? ['model', `${t('模型', 'Model')}: ${filters.model}`, () => change('model', 'all')] : null,
        isSingleDay
          ? ['day', isDrilledDay ? `${t('单日', 'Day')}: ${filters.since} (${t('返回', 'Back to')} ${prevLabel})` : `${t('单日', 'Day')}: ${filters.since}`, exitSingleDay]
          : null,
      ].filter(Boolean);

      const rangeOptions = RANGE_KEYS.map(rk => [rk, RANGE_LABELS[rk]]);
      const cycleTheme = () => setThemePref(prev => (prev === 'auto' ? 'light' : prev === 'light' ? 'dark' : 'auto'));
      const themeLabel = themePref === 'light' ? t('☀ 浅色', '☀ Light') : themePref === 'dark' ? t('☾ 深色', '☾ Dark') : t('◐ 自动', '◐ Auto');

      const commandBar = h('form', {
        onSubmit: e => { e.preventDefault(); void submitFilters(false); },
        className: 'tu-top-dock',
      },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
        h('h1', { style: { fontSize: 18, fontWeight: 600, margin: 0, letterSpacing: '-0.015em' } }, t('用量洞察', 'Usage insights')),
        navHistory.length > 0
          ? h('button', {
              type: 'button',
              className: 'tu-btn',
              title: t('返回上一步筛选 (Alt+←)', 'Step back to previous filter (Alt+←)'),
              onClick: goBack,
              style: { padding: '2px 8px', borderRadius: 999 },
            }, t('← 后退', '← Back'))
          : null,
        statusBadge,
        ...filterChips.map(([ck, cText, onClear]) => h('button', {
          key: ck, type: 'button', className: 'tu-btn tu-btn-active', onClick: onClear,
          style: { padding: '2px 8px', borderRadius: 999 },
        }, cText + ' ×')),
        workspaceFilter
          ? h('button', {
              type: 'button',
              className: 'tu-btn',
              title: t('仅过滤下方任务卡片墙，不影响上方全局图表', 'Filters task cards below only'),
              onClick: () => setWorkspaceFilter(''),
              style: { padding: '2px 8px', borderRadius: 999, borderStyle: 'dashed', borderColor: C.accent },
            }, `${t('任务列表项目', 'Tasks project')}: ${workspaceFilter.split('/').pop()} ×`)
          : null),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7 } },
        dropdown(filters.client, 'client', sortedClients, 'Agent'),
        h('button', {
          type: 'button',
          className: 'tu-btn',
          'aria-pressed': showScopeEditor,
          title: t('设置默认纳入统计与下拉列表的常用 Harness 范围', 'Configure which harnesses are included in usage queries & dropdowns'),
          onClick: () => openScopeEditor(false),
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
        h('button', {
          type: 'button',
          className: 'tu-btn',
          title: t('切换外观主题：跟随宿主 / 冷调浅色 / 深曜深色', 'Switch theme: Auto host sync / Cool Light / Obsidian Dark'),
          onClick: cycleTheme,
          style: { padding: '5px 8px' },
        }, themeLabel),
        (filters.client !== 'all' || filters.model !== 'all' || filters.range !== 'today' || workspaceFilter)
          ? h('button', {
              type: 'button',
              className: 'tu-btn',
              disabled: busy,
              onClick: () => { setWorkspaceFilter(''); setNavHistory([]); drilledDayRef.current = ''; prevRangeRef.current = { range: 'today', since: '', until: '' }; applyImmediate(initialFilters); },
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
        const workspaces = mergedWorkspaces;
        const weekdayProfile = Array.isArray(data.weekdayProfile) ? data.weekdayProfile : EMPTY;
        const execProfile = data.executionProfile || null;
        const fallback = data.fallback || null;
        const isZeroWindow = m.totalTokens === 0 && entries.length === 0 && daily.length === 0 && tasks.length === 0;

        const kpiNode = h(KpiStrip, {
          m,
          daily,
          hourly,
          periodDelta: data.periodDelta || null,
          monthlyProjection: data.monthlyProjection || null,
          execProfile,
          tm: data.timeMetrics || null,
          tp: data.throughputSummary
            ? {
                ...data.throughputSummary,
                engineTokensPerSec: vm.cleanEngineTps ?? data.throughputSummary.engineTokensPerSec,
                avgTokensPerSec: data.throughputSummary.decodeTokensPerSec ?? vm.cleanEngineTps ?? data.throughputSummary.avgTokensPerSec,
              }
            : null,
          fallback,
          activeAgentsCount: vm.rawAgents.length,
          activeModelsCount: vm.models.length,
          workspacesCount: workspaces.length,
          totalTasks: data.totalTasks,
          actions,
        });

        const heatmapNode = h(ActivityHeatmap, {
          heatmap,
          weekdayProfile,
          selectedDay: isSingleDay ? filters.since : '',
          windowRange: { sinceDate: meta.sinceDate, untilDate: meta.untilDate },
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
                    requestedMode: trendReqMode,
                    isSingleDayWindow,
                    canExitSingleDay: isSingleDay,
                  }),
                  heatmapNode)
              : null,
            h('div', { id: 'tu-sec-tri', className: 'tu-tri' },
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
                hover,
                actions,
              })),
            !hasTrendRow
              ? h('div', { style: { color: C.muted, fontSize: 'var(--tu-fs-xs)', padding: '2px 4px' } }, t('此筛选条件下趋势数据不可用。', 'Trend data is unavailable for this selection.'))
              : null,
            showBubble || showDeep
              ? h('div', { id: 'tu-sec-deep', className: showBubble && showDeep ? 'tu-deep' : 'tu-deep-single' },
                  showBubble ? h(QuadrantBubbleMap, { bubbleRows: vm.bubbleRows, clientColorMap: vm.clientColorMap, hover, actions }) : null,
                  showDeep
                    ? h(DeepWorkbench, {
                        workspaces,
                        matrixData: vm.matrixData,
                        execProfile,
                        workspaceFilter,
                        setWorkspaceFilter,
                        clientColorMap: vm.clientColorMap,
                        requestedTab: deepReqTab,
                        hover,
                        actions,
                      })
                    : null)
              : null,
            h(TaskStream, {
              tasks,
              clientFilter: filters.client,
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
      },
      h('style', null, STUDIO_CSS + (hoverAgentCss ? '\n' + hoverAgentCss : '')),
      commandBar,
      h('div', { className: 'tu-scroll-stage' },
        h('div', { id: 'tu-sec-scope' },
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
            }))),
        requestError,
        h('div', { className: 'tu-report', 'aria-busy': busy && !!data }, results),
        data || sourceProbe
          ? h(SourcesDiagnostics, {
              sources,
              errors,
              sourceProbe,
              scopeState,
              showScopeEditor,
              forceOpenToken: diagOpenSignal,
              actions,
            })
          : null));
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
