# Pi SDK TUI 使用说明

Accorda 现在有一个新的 Pi SDK TUI 入口：

```bash
npm run pi:dev
```

## 功能

- 启动时从 `.accorda/pi-agent/` 读取 Pi auth/model/settings；首次运行会从 `~/.pi/agent/` 复制。
- 启动后默认使用上次保存的模型和 thinking level，不再每次强制选择。
- 使用 `/model` 打开模型选择；可直接输入搜索，方向键选择，Enter 确认，Esc 返回。
- 使用 `/think` 打开 thinking level 选择：`off / minimal / low / medium / high / xhigh`。
- 进入聊天界面后直接输入消息，Enter 发送。
- 使用 `/task <目标>` 进入 Task Mode。
- 使用 `/exit` 或 `/quit` 退出。
- 每次运行会写入 readable trace：

```text
.accorda/pi-runs/<trace-id>/trace.jsonl
```

## 本地配置

Accorda TUI 自己维护配置文件：

```text
.accorda/pi-agent/accorda-tui.json
```

其中 `scopedModels` 控制 `/model` 中优先展示的模型列表。默认包含 DeepSeek 和 OpenAI Codex 的常用模型；如果这些模型在当前 Pi auth/model 配置中不可用，会自动回退到全部可用模型。

## 旧入口

旧 Accorda TUI 仍是：

```bash
npm run dev
```

旧命令行 Pi SDK REPL 保留为：

```bash
npm run pi:repl
```
