# dsh-tokscale-usage

English | [中文](README.zh.md)

Local multi-agent token usage and telemetry dashboard for DeepSeek Harness (DSH), backed by [@tokscale/cli](https://github.com/junhoyeo/tokscale) and local `dsh-context` / Codex session metadata.

`@tokscale/cli` is declared as a direct package dependency with prebuilt platform binaries (`win32`, `darwin`, `linux` on `x64` and `arm64`, without `postinstall` build scripts). Installing this plugin automatically provides the `tokscale` binary without requiring global CLI installation or `PATH` configuration.

## Install

- **From DSH Plugin Market (`dshmarket` / DSH Discover):** search `dsh-tokscale-usage` and click Install.
- **From CLI (`dsh web` or custom profile):**

```sh
dsh plugin --profile <profile> add https://github.com/XS-dev/dsh-tokscale-usage/releases/download/v0.5.0/dsh-tokscale-usage-0.5.0.tgz
```

## Features

- **Sidebar Panel (`Usage insights / 用量洞察`)**:
  - **Configurable Harness Scope (`⚙ Harnesses / 常用范围`)**: choose and persist which local agent harnesses are queried and listed (`~/.dsh/tokscale-usage/scope.json`), avoiding scans across unused clients.
  - **Unified Antigravity Accounting**: folds `antigravity-extension` (Desktop IDE) and `antigravity-cli` (`agy` CLI) under a single `antigravity` identifier while skipping duplicate legacy RPC cache snapshots.
  - **Date Windows**: `Today`, `Yesterday`, `Last 3 days` (`days3`), `Last 7 days` (`week`), `This month` (`month`), `All`, and `Custom` (`since` / `until`), with period-over-period delta badges on bounded windows.
  - **Visual Telemetry**: 6 KPI summary cards, multi-agent stacked daily trend bars with cost curve, 24-hour hourly profile, 8-week activity heatmap with weekday rhythm strip, token category composition, agent donut chart, model ranking bars, model efficiency bubble plot, workspace treemap, DSH phase timing breakdown (`TTFT`, reasoning, answer, tool arguments, tool execution), and recent DSH / Codex task cards.
- **Slash Command**: `/tokscale` outputs a monthly text summary with token buckets, cache hit rate, estimated cost, and top tasks.
- **Agent Tool**: `tokscale_usage` queries local token usage filtered by `range` (`today`, `yesterday`, `days3`, `week`, `month`, `all`, `custom`), `client`, `model`, `since`, `until`, and `refresh`.

## Notes & Limitations

- **Cost is an estimate**, calculated by `tokscale` pricing tables rather than billing APIs. Models without known pricing report `$0`.
- **Read-only**: the plugin never modifies or moves session transcripts. Cached reports and scope settings are stored under `$DSH_HOME/tokscale-usage` (or `~/.dsh/tokscale-usage`).
- **Incremental scanning**: once initial history is cached, routine refreshes scan a rolling 14-day window and merge into the persisted daily graph; full-history rescans run only on cold cache, `All` range refreshes, or explicit full discovery.

## Development

```sh
node --test
```

## License

MIT
