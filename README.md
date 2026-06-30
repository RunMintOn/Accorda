# Accorda

Accorda 当前主线：基于 Pi SDK 的 Agent Runtime 产品层。底层模型、认证、工具调用和 session 交给 Pi SDK；Accorda 负责 readable trace、Intent 工具增强和 Task Mode 状态展示。

## 运行

推荐入口：

```bash
npm run pi:dev
```

常用命令：

```text
/model        切换模型
/think        切换 thinking level
/task <目标>  进入 Task Mode
/exit         退出
```

单次运行：

```bash
npm run pi:once -- "hello"
npm run pi:once -- --task "检查项目状态"
```

旧 runtime 入口仍保留：

```bash
npm run dev
npm run run:once -- "hello"
```

## 本地文件

Pi SDK 配置隔离在：

```text
.accorda/pi-agent/
```

首次运行会从 `~/.pi/agent/` 复制 `auth.json`、`models.json`、`settings.json`。

Readable trace 写入：

```text
.accorda/pi-runs/<trace-id>/trace.jsonl
```

## 当前边界

- 新主线在 `src/pi/` 和 `src/trace/`。
- 旧 Stage 1 / Stage 2 runtime 暂未移除，但不再是新架构优先方向。
- v1 不做 permission gate，只强制 `bash/edit/write/append` 提供 Intent 并记录 trace。
