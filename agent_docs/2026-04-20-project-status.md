# Accorda 项目现状判断

日期：2026-04-20

## 结论

Accorda 当前不是空想稿，而是一个已经可运行、可测试的本地 CLI Agent Runtime 骨架。

它已经搭起了：

- CLI/TUI 入口
- session 与 event log 持久化
- stage one 控制决策骨架
- 最小执行层
- 只读本地工具链
- 基本的运行状态展示

但它距离 blueprint 里描述的完整产品还有明显距离。更准确地说，它现在处于“面向目标产品的 v0/v1 骨架期”，不是成熟终端产品阶段。

## 已落地能力

- 可从 CLI 启动交互界面，并支持 resume 现有 session。
- UI 已具备 header、消息流、状态、输入框等基础结构。
- runtime 已有 stage one 决策语义：`answer / execute / clarify / task_mode`。
- 最小执行层已接通只读工具：`ls / read / glob / grep`。
- 工具访问受 workspace 边界限制，避免路径逃逸。
- 事件会追加写入 `jsonl`，历史可恢复。
- model request/response artifact 会落盘，具备一定可观测性。
- 测试覆盖较完整；在 2026-04-20 本次检查中，`npm test` 通过，`24` 个测试文件、`73` 个测试全部通过。

## 主要缺口

- `task_mode` 目前主要还是占位语义，还不是真正的多步任务执行流。
- 权限系统只有策略骨架，UI 中的权限等待与确认闭环还没真正接通。
- registry 里已经出现 `write / edit / bash`，但主 runtime 实际接通的仍然主要是只读工具。
- “低成本记忆”还未形成，目前更接近事件历史和上下文快照，不是可复用经验沉淀。
- 外部 Agent 可观测性已有基础，但离更成熟的回放、调试、验证体验还有产品化差距。

## 当前阶段定位

当前阶段最合适的表述是：

“一个围绕最终蓝图建设中的、本地优先、透明 runtime 导向的 CLI Agent Runtime 最小可行骨架。”

## 这次判断依据

- `dev_docs/accorda项目介绍`
- `README.md`
- `src/runtime/*`
- `src/ui/*`
- `src/tools/*`
- `src/store/*`
- `test/*`
