# Accorda Agent Notes

## 当前主线

Accorda 现在优先发展 Pi SDK 路线：

```text
Pi SDK AgentSession → Accorda Tool Schema Override → Readable Trace → Pi TUI
```

不要优先扩展旧 Stage 1 / Stage 2 runtime，除非任务明确要求维护旧入口。

## 关键入口

```bash
npm run pi:dev      # 新 Pi SDK TUI，优先使用
npm run pi:once -- "hello"
npm run pi:repl     # 旧 readline Pi SDK REPL
npm run dev         # 旧 Accorda TUI
npm test
```

## 关键目录

```text
src/pi/       Pi SDK TUI、extension、配置隔离、代理
src/trace/    readable trace
CONTEXT.md    项目术语表
docs/adr/     架构决策
agent_docs/   给后续 agent 的排障和阶段记录
```

## Pi 配置

Accorda 使用项目本地配置：

```text
.accorda/pi-agent/
```

首次运行会从 `~/.pi/agent/` 复制 `auth.json`、`models.json`、`settings.json`。不要把 `.accorda/` 提交。

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

## 常见排障

- 无回复但没有报错：检查 `src/pi/piDev.ts` / `src/pi/PiTuiApp.tsx` 是否仍有从 `session.messages` 回退读取最终 assistant 文本。
- `fetch failed`：检查 `src/pi/httpProxy.ts` 和入口处 `configureProxyFromEnv()`。
- 模型列表太大或不合适：改 `.accorda/pi-agent/accorda-tui.json` 的 `scopedModels`。
