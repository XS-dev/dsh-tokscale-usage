# dsh-tokscale-usage

English | [中文](README.zh.md)

Local multi-agent token usage and telemetry dashboard for DeepSeek Harness (DSH), backed by [@tokscale/cli](https://github.com/junhoyeo/tokscale) and local `dsh-context` / Codex session metadata.

`@tokscale/cli` is declared as a direct package dependency with prebuilt platform binaries (`win32`, `darwin`, `linux` on `x64` and `arm64`, without `postinstall` build scripts). Installing this plugin automatically provides the `tokscale` binary without requiring global CLI installation or `PATH` configuration.

## Install

- **From DSH Plugin Market (`dshmarket` / DSH Discover):** search `dsh-tokscale-usage` and click Install.
- **From CLI (`dsh web` or custom profile):**

```sh
dsh plugin --profile <profile> add https://github.com/XS-dev/dsh-tokscale-usage/releases/download/v1.0.1/dsh-tokscale-usage-1.0.1.tgz
```

## Features

- **Sidebar Panel (`Usage insights / 用量洞察`) — Precision Telemetry DLS v1.0**:
  - **Calibrated Light & Dark Cool-Mineral Themes**: dedicated Cool Alabaster (Light) and Deep Obsidian Slate (Dark) palettes with automatic DSH host theme synchronization and a 1-click `◐ Auto / ☀ Light / ☾ Dark` switcher, paired with a fixed non-bleeding top command dock.
  - **Configurable Harness Scope (`⚙ Harnesses / 常用范围`)**: choose and persist which local agent harnesses are queried and listed (`~/.dsh/tokscale-usage/scope.json`), avoiding scans across unused clients.
  - **Unified Antigravity Accounting, Throughput & Task Attribution**: folds `antigravity-extension` (Desktop IDE) and `antigravity-cli` (`agy` CLI) under a single `antigravity` identifier, computes real output generation speed (`tok/s`) from local `transcript.jsonl` step timings alongside prompt-stripped Codex output throughput, and enriches session-level `tokscale --group-by client,session,model` usage with local `conversation_summaries.db` titles, workspace paths, step counts, and subagent tags.
  - **Global Two-Stage Inspection & Drilldown**: hover to preview, **single-click** any chart datum to pin/lock inspection readouts without mutating global filters, and **double-click** to jump/filter globally (with a 20-step `← Back` / `Alt+←` filter history stack).
  - **Pure-SVG Multi-Ring & Curve Telemetry**: Hero KPI jumpers, smooth non-bar 24-hour intraday spline curve on single-day windows, multi-day stacked Agent bars with a synchronized Spend Sub-Lane, Monday-aligned 8-week activity heatmap, semantic token composition, Ring-family comparisons (`Agent` donut, `Model` donut/radial gauges, `Workspace` dual master rings + per-project concentric rings, and `Task usage` overview rings + per-task `54×54` concentric dual rings), and collision-free quadrant efficiency bubble map.
- **Slash Command**: `/tokscale` outputs a monthly text summary with token buckets, cache hit rate, estimated cost, and top tasks.
- **Agent Tool**: `tokscale_usage` queries local token usage filtered by `range` (`today`, `yesterday`, `days3`, `week`, `month`, `all`, `custom`), `client`, `model`, `since`, `until`, and `refresh`.

## Notes & Limitations

- **Cost is an estimate**, calculated by `tokscale` pricing tables rather than billing APIs. Models without known pricing report `$0`.
- **Read-only**: the plugin never modifies or moves session transcripts. Cached reports and scope settings are stored under `$DSH_HOME/tokscale-usage` (or `~/.dsh/tokscale-usage`).
- **Incremental scanning**: once initial history is cached, routine refreshes scan a rolling 14-day window and merge into the persisted daily graph; full-history rescans run only on cold cache, `All` range refreshes, or explicit full discovery.

## Development & Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local DSH symlink setup, architecture guardrails, and Pull Request workflow.

```sh
npm test
```

## License

MIT
