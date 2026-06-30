# Pi SDK TUI 阶段总结

## 本阶段完成

- 引入 Pi SDK 作为新主线底层能力。
- 新增 Pi SDK TUI：`npm run pi:dev`。
- 新增单次入口：`npm run pi:once`。
- 保留旧 readline 入口：`npm run pi:repl`。
- 项目本地隔离 Pi 配置：`.accorda/pi-agent/`。
- 支持 `/model`、`/think`、`/task <目标>`。
- 新增 Readable Trace：`.accorda/pi-runs/<trace-id>/trace.jsonl`。
- 通过 Pi Extension 覆盖 `bash/edit/write` schema，强制 `intent`。
- 新增 `append`、`task_start`、`task_update`。
- 增加代理初始化，避免 SDK 入口 `fetch failed`。

## 关键决策

- Accorda 不再优先扩展自研 Stage 1 / Stage 2 runtime。
- Pi SDK 负责模型、认证、session 和工具调用。
- Accorda 负责产品层：Intent、Readable Trace、Task Mode 状态。
- v1 不做 permission gate。
- Trace 保持可读，不做完整回放。

## 重要文件

```text
src/pi/PiTuiApp.tsx
src/pi/accordaExtension.ts
src/pi/piTuiSettings.ts
src/pi/localPiAgent.ts
src/pi/httpProxy.ts
src/trace/readableTrace.ts
CONTEXT.md
docs/adr/0001-adopt-pi-sdk-trace-projection-layer.md
agent_docs/2026-06-30-pi-sdk-runtime-debug-notes.md
agent_docs/2026-06-30-pi-tui-usage.md
```

## 后续候选

- 改善 TUI 消息展示和 trace 展示。
- 增加 Task Mode 的可视化进度区域。
- 将 `pi:dev` 稳定后再考虑替换旧 `npm run dev`。
- 补充 Pi TUI 组件测试。
- 考虑 RAG/knowledge tool，但应作为 Pi custom tool 接入。
