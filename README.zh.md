# dsh-tokscale-usage

[English](README.md) | 中文

面向 DeepSeek Harness（DSH）的本机多 Agent Token 用量与耗时洞察面板，底层由 [@tokscale/cli](https://github.com/junhoyeo/tokscale) 与本地 `dsh-context` / Codex 会话元数据驱动。

插件已在依赖中内置 `@tokscale/cli`（官方多平台预编译原生二进制，覆盖 Windows / macOS / Linux 的 x64 与 ARM64，且无 `postinstall` 构建脚本）。安装本插件时会自动拉取对应系统的 `tokscale` 二进制，**无需手动全局安装 `tokscale`，也不依赖终端 `PATH` 环境变量**。

## 安装

- **DSH 插件市场（`dshmarket` / DSH 发现页）**：搜索 `dsh-tokscale-usage` 一键安装。
- **命令行安装（`dsh web` 或指定 profile）**：

```sh
dsh plugin --profile <profile> add https://github.com/XS-dev/dsh-tokscale-usage/releases/download/v1.0.1/dsh-tokscale-usage-1.0.1.tgz
```

## 功能概览

- **左侧栏一级面板（「用量洞察」· 精密遥测设计语言 v1.0）**：
  - **双主题独立冷调矿物色板 & 独立固定顶栏**：分别校准冷调雪花石浅色（Light）与深曜石板深色（Dark）双套低饱和度冷调色板，自动实时跟随 DSH 宿主主题并提供 `◐ 自动 / ☀ 浅色 / ☾ 深色` 一键切换；顶栏与下方滚动舞台物理分离，滚动时绝无顶部内容透出。
  - **可持久化常用 Harness 范围（`⚙ 常用范围`）**：自定义勾选日常使用的客户端（保存于 `~/.dsh/tokscale-usage/scope.json`），过滤未安装的数十个无关客户端，加速日常刷新。
  - **Antigravity 与 Codex 真实生成吞吐校准 & 单会话归因**：统一合并 `antigravity-extension` 与 `antigravity-cli`，剥离缓存 Prompt 对吞吐的虚高干扰，并从本地 `transcript.jsonl` 步骤时序只读解算 Antigravity 各模型与各会话真实输出吞吐（`tok/s`）及分时曲线，结合 `conversation_summaries.db` 呈现真实任务标题、项目工作区、步数与费用。
  - **全局统一两段式交互契约**：全画布图表统一遵循「悬停实时预览 · **单击锁定悬停检视** · **双击触发全局筛选跳转**」，彻底告别误触跳页，并配备 20 步筛选历史后退栈（`← 后退` / `Alt+←`）。
  - **纯 SVG 全景环形图系与分时平滑曲线**：单日视角采用 24 小时平滑三次样条面积曲线（告别孤立单柱图），多日视角配备同步下方伴随费用轨；`Agent 对比`、`模型比较`、`项目工作区排行` 与 `任务用量详情` 全系搭载多级同心环形图（每张项目卡与任务卡均内嵌 `54×54` 双同心环直观呈现构成比与相对规模）。
- **斜杠命令**：`/tokscale` 输出本月本机用量文本摘要。
- **Agent 工具**：`tokscale_usage` 支持按 `range`（`today`、`yesterday`、`days3`、`week`、`month`、`all`、`custom`）、`client`、`model`、`since`、`until`、`refresh` 查询本机用量。

## 说明与限制

- **估算费用非实际账单**：费用由 `tokscale` 内置模型单价估算，未收录定价的模型显示为 `$0`。
- **只读不侵入**：插件仅读取本地会话统计，不修改任何会话历史；缓存与范围配置保存在 `$DSH_HOME/tokscale-usage`（或 `~/.dsh/tokscale-usage`）。

## 协作开发与本地测试

详见 [CONTRIBUTING.md](CONTRIBUTING.md)（包含本地 DSH 软链接热重载配置、只读与零构建红线及 PR 流程）。

```sh
npm test
```

## 开源协议

MIT
