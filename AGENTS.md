# Accorda Agent Notes

## 当前主线

Accorda 现在优先发展 Pi SDK + Retail Ops Demo 路线：

```text
Pi SDK AgentSession → Accorda Tool Schema Override → Readable Trace → Pi TUI → Project Skills → Retail Ops Eval Loop
```

不要优先扩展旧 Stage 1 / Stage 2 runtime，除非任务明确要求维护旧入口。

## 关键入口

```bash
npm run pi:dev      # 新 Pi SDK TUI，优先使用
npm run pi:once -- "hello"
npm run pi:repl     # 旧 readline Pi SDK REPL
npm run dev         # 旧 Accorda TUI
npm run retail:validate-data
npm run eval:retail
npm test
```

## 关键目录

```text
src/pi/          Pi SDK TUI、extension、配置隔离、代理
src/trace/       readable trace
src/eval/        Retail data validation / eval readiness
.accorda/skills/ Accorda 项目级 skills，可提交
demo_data/retail/ Retail Ops mock 数据
eval/            eval case 与评估说明
CONTEXT.md       项目术语表
docs/adr/        架构决策
agent_docs/      给后续 agent 的排障和阶段记录
```

## Pi 配置

Accorda 使用项目本地配置：

```text
.accorda/pi-agent/
```

首次运行会从 `~/.pi/agent/` 复制 `auth.json`、`models.json`、`settings.json`。

不要提交运行时目录：`.accorda/pi-agent/`、`.accorda/pi-runs/`。

可以提交：`.accorda/skills/`。Accorda 当前只扫描这个项目级 skill 目录，不加载全局 skills。

TUI 自己的模型选择配置：

```text
.accorda/pi-agent/accorda-tui.json
```

## 设计约束

- 复用 Pi SDK 的模型、认证、session、tool calling。
- Accorda 不 fork Pi SDK，不重新实现 provider 层。
- `bash/edit/write` 通过 Tool Schema Override 保留原工具名并增加 `intent`。
- `append` 是 Accorda 新增 Narrow Tool，也必须有 `intent`。
- v1 不做 permission gate。
- Trace 要 human-first：只记录 intent、command/target、summary、status；不复制完整工具输入输出。
- Task Mode 用 `task_start` / `task_update` 维护可见任务状态，不替代具体 skill 或工作流。
- Retail Ops Demo 当前优先使用 skill + read/bash + 确定性计算，不急着抽 Retail Tools。
- 业务分析类 skill 要求 JSON-grounded：先输出结构化 JSON，最终中文回答只引用 JSON/原始数据中的 SKU 和数字。
- 新增/修改 skill 时优先使用 `/skill:accorda-skill-authoring` 的规范。

## 常见排障

- 无回复但没有报错：检查 `src/pi/piDev.ts` / `src/pi/PiTuiApp.tsx` 是否仍有从 `session.messages` 回退读取最终 assistant 文本。
- `fetch failed`：检查 `src/pi/httpProxy.ts` 和入口处 `configureProxyFromEnv()`。
- 模型列表太大或不合适：改 `.accorda/pi-agent/accorda-tui.json` 的 `scopedModels`。
- Skill 没出现：确认在 `.accorda/skills/<name>/SKILL.md`，并用 `/skills` 查看。
- Retail demo 异常：先跑 `npm run retail:validate-data`，再跑 `npm run eval:retail`。
