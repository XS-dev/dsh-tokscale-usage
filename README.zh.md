# dsh-tokscale-usage

[English](README.md) | 中文

面向 DeepSeek Harness（DSH）的本机多 Agent Token 用量与耗时洞察面板，底层由 [@tokscale/cli](https://github.com/junhoyeo/tokscale) 与本地 `dsh-context` / Codex 会话元数据驱动。

插件已在依赖中内置 `@tokscale/cli`（官方多平台预编译原生二进制，覆盖 Windows / macOS / Linux 的 x64 与 ARM64，且无 `postinstall` 构建脚本）。安装本插件时会自动拉取对应系统的 `tokscale` 二进制，**无需手动全局安装 `tokscale`，也不依赖终端 `PATH` 环境变量**。

## 安装

- **DSH 插件市场（`dshmarket` / DSH 发现页）**：搜索 `dsh-tokscale-usage` 一键安装。
- **命令行安装（`dsh web` 或指定 profile）**：

```sh
dsh plugin --profile <profile> add https://github.com/XS-dev/dsh-tokscale-usage/releases/download/v0.7.0/dsh-tokscale-usage-0.7.0.tgz
```

## 功能概览

- **左侧栏一级面板（「用量洞察」）**：
  - **可持久化常用 Harness 范围（`⚙ 常用范围`）**：自定义勾选日常使用的客户端（保存于 `~/.dsh/tokscale-usage/scope.json`），过滤未安装的数十个无关客户端，加速日常刷新。
  - **Antigravity 统一归并**：自动合并统计 `antigravity-extension`（桌面端 IDE）与 `antigravity-cli`（`agy` 命令行）并统一展示为 `antigravity`，同时剔除旧版 RPC 缓存快照避免重复计数。
  - **灵活时间窗口**：支持 `今天`、`昨天`、`最近 3 天`（`days3`）、`最近 7 天`、`本月`、`全部` 及自定义起止日期，支持环比变化率提示与保留原筛选状态的单日下钻/返回。
  - **纯 SVG 交互式多维图表**：内嵌趋势微火花线与月底费用线性预测的主次分层 KPI 卡片、统一 SVG 坐标系的每日趋势工作台（Agent 堆叠 + 7 日均线 + 右轴日费用 / 累计费用与月底预测虚线 / 每日缓存命中率曲线 / 24 小时等距分时段）配无抖动悬浮浮层、星期一精准对齐的 8 周活动热力图与周内节律、Token 构成与 DSH 生成端细分、跨图表联动高亮的 SVG 环形图、四维模型排行（用量 / 费用 / `$/1M` 综合单价 / 吞吐）、中位数四象限模型效能气泡图、三页签深度工作台（项目消耗排行 / `Agent × 模型` 交叉热力矩阵 / DSH 阶段耗时与工具总耗时）以及任务流卡片。
- **斜杠命令**：`/tokscale` 输出本月本机用量文本摘要。
- **Agent 工具**：`tokscale_usage` 支持按 `range`（`today`、`yesterday`、`days3`、`week`、`month`、`all`、`custom`）、`client`、`model`、`since`、`until`、`refresh` 查询本机用量。

## 说明与限制

- **估算费用非实际账单**：费用由 `tokscale` 内置模型单价估算，未收录定价的模型显示为 `$0`。
- **只读不侵入**：插件仅读取本地会话统计，不修改任何会话历史；缓存与范围配置保存在 `$DSH_HOME/tokscale-usage`（或 `~/.dsh/tokscale-usage`）。

## 本地测试

```sh
node --test
```

## 开源协议

MIT
