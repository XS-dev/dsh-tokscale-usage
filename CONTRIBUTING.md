# Contributing to dsh-tokscale-usage / 协作开发指南

Thanks for your interest in contributing to **dsh-tokscale-usage**! This document covers local development setup, architecture conventions, testing, and Pull Request guidelines.

欢迎参与 **dsh-tokscale-usage** 的协作开发！本文说明本地联调挂载方式、代码结构约束、单元测试与 PR 提交流程。

---

## 1. Local Development Setup / 本地联调环境

### Prerequisites / 环境要求
- **Node.js `>= 22.0.0`** (uses built-in `node:test` and `node:sqlite` `DatabaseSync`)
- **DeepSeek Harness (`dsh`)** `>= 0.2.0-rc.2`

### Clone & Link into DSH / 克隆并软链接到 DSH Profile

```bash
git clone https://github.com/XS-dev/dsh-tokscale-usage.git
cd dsh-tokscale-usage
npm install
```

Link your working tree into your active DSH profile (`desktop` or `default`) so code edits take effect immediately on reload:

将仓库软链接至本地 DSH profile 的 `node_modules` 目录（例如 `desktop`），修改 `client.js` 后在 DSH 窗口按 `Ctrl+R` / `Cmd+R` 即可热重载前端，修改服务端 `lib/*.mjs` 重启插件或 DSH 即可生效：

- **macOS / Linux**:
  ```bash
  ln -s "$(pwd)" ~/.dsh/profiles/desktop/node_modules/dsh-tokscale-usage
  ```
- **Windows (PowerShell)**:
  ```powershell
  New-Item -ItemType SymbolicLink `
    -Path "$HOME\.dsh\profiles\desktop\node_modules\dsh-tokscale-usage" `
    -Target (Get-Location).Path
  ```

Ensure `"dsh-tokscale-usage": {}` is enabled under `plugins` in `~/.dsh/profiles/desktop/dsh.yml`.

---

## 2. Architecture Overview / 目录与架构约定

```text
├── index.mjs          # Cordis plugin entry: JSON HTTP routes, /tokscale command, tokscale_usage tool
├── client.js          # Zero-build browser UMD bundle (React.createElement + pure SVG + CSS tokens)
├── lib/
│   ├── tokscale.mjs   # @tokscale/cli binary resolver, bounded Codex hardlink window,fg/bg process gate
│   ├── store.mjs      # Incremental 60d graph cache, progressive refresh, ETag/rich payload slicer
│   ├── tasks.mjs      # Read-only per-task attribution (DSH overview-cache, Codex JSONL, Antigravity SQLite)
│   ├── sources.mjs    # Fast non-scanning local engine directory probe
│   └── views.mjs      # CLI / tool text summary formatter & data invariants
├── locale/            # Built-in i18n dictionaries (en-US, zh-CN)
└── test/              # Zero-dependency Node test suite (74+ tests)
```

### Key Guardrails / 核心开发红线
1. **Strictly Read-Only (`只读不侵入`)**: Never mutate, move, or lock user session files (`~/.dsh/sessions`, `~/.codex/sessions`, `~/.gemini/antigravity`). Open SQLite databases with `{ readOnly: true }`.
2. **Zero Build Step (`零构建前端`)**: `client.js` runs directly in DSH's `__ModuleLoader__` without bundlers or external charting libraries. Use `React.createElement` (`h(...)`), pure SVG charts, and theme-adaptive CSS custom properties (`--tu-*`).
3. **Cross-Platform Binary Safety**: Do not add `postinstall` compilation scripts or assume `tokscale` is on global `PATH`; always resolve via `lib/tokscale.mjs`.

---

## 3. Running Tests / 运行测试

```bash
npm test
```

GitHub Actions CI automatically runs syntax checks and the full `node --test` suite on **Ubuntu** and **Windows** (Node 22) for every Push and Pull Request.

---

## 4. Submitting a Pull Request / 提交 PR 流程

1. Fork the repository (or create a feature branch `feat/<topic>` / `fix/<topic>` if you are a repository collaborator).
2. Add or update unit tests in `test/*.test.mjs` covering your change.
3. Verify `npm test` passes locally with zero failures.
4. Open a Pull Request against `main` with a clear summary and (for UI changes) before/after screenshots in light or dark mode.
