# Accorda

Accorda 是一个基于 Pi SDK 的 Agent Runtime 产品层。它存在的目的不是重新实现模型供应商、认证和底层 Agent 循环，而是让 Agent 工作过程更透明、更可恢复、更适合任务化呈现。

## 语言

**Accorda**：
基于 Pi SDK 的上层 Agent Runtime 产品层，重点关注任务编排、执行追踪、失败恢复和知识工具。
_避免_：从零自研 Agent 框架、Provider 框架

**Pi SDK**：
Accorda 依赖的底层 Agent 能力层，负责模型/Provider 接入、认证、基础工具调用、会话机制和压缩能力。
_避免_：参考实现、Provider 辅助库

**Runtime 产品层**：
Accorda 自己保留和发展的上层能力，用来把底层 Agent 活动转化成可见的任务、追踪、恢复和知识工作流。
_避免_：Agent Engine、Provider 层

**Trace Projection Layer**：
Accorda v1 的核心职责：监听 Pi SDK 的原始运行事件，并将其投影为更稳定、更可读、可回放的 Accorda Trace Event。
_避免_：自研 Agent Loop、模型推理层

**Pi Session Event**：
Pi SDK 在 Agent 会话运行过程中产生的原始事件，例如消息增量、工具开始、工具结束和回合结束。
_避免_：Accorda 事件、产品事件

**Accorda Trace Event**：
Accorda 从 Pi Session Event 映射出的产品级追踪事件，用于日志、TUI 展示、回放和后续任务视图。
_避免_：Pi 原始事件、模型消息

**Readable Trace**：
Accorda Trace 的可读性原则：主字段优先服务人类阅读，使用短 ID，长输出截断或落 artifact，Pi 内部 ID 和底层关联信息放入 links。
_避免_：Raw debug dump、完整 Pi session 复制

**Observed Trace**：
只记录已发生事实的追踪信息，不包含 Accorda 对原因、意图或策略的事后推断；工具调用参数中由模型显式声明的 Intent 可以作为事实一起记录。
_避免_：智能分析、失败归因

**Intent**：
模型在调用高风险或外部可见工具时显式声明的本次调用直接目的；它应当简短、具体、用户可见，用于解释当前操作并写入 Accorda Trace Event。
_避免_：Explanation、Reasoning、事后解释、泛泛理由

**Intent-required Tool**：
必须提供 Intent 才能执行的工具，包括 bash、edit、write 和 append；v1 只强制 Intent 和 trace 记录，不做权限确认。
_避免_：Permission Gate、用户确认流程

**Tool Schema Override**：
Accorda 通过 Pi Extension 覆盖 Pi SDK 内置高风险工具的参数 Schema，保留原工具名，并增加 Intent 字段；执行前 Accorda 记录 Intent，再将去除 Intent 后的参数委托给底层工具能力。
_避免_：新工具命名空间、自研工具系统、修改 Pi SDK 源码

**Narrow Tool**：
边界比通用编辑工具更窄、更安全的高频工具，例如只允许向文件末尾追加内容的 append。
_避免_：万能工具、复杂 patch 工具

**Task Mode**：
Accorda 面向复杂、多步、需要对齐或验证的用户目标提供的结构化执行模式；它让任务状态、计划、进度、阻塞和完成情况可见。Task Mode 只管理可见任务状态，不替代更具体的 skill、工作流或项目指令。
_避免_：普通聊天模式、万能工作流、领域方法论

**Task State Tool**：
Task Mode 的状态管理工具，包括 task_start 和 task_update；它们只更新可见任务状态，不执行用户任务本身。
_避免_：执行工具、思考工具、普通 todo 工具

**task_start**：
进入 Task Mode 并声明任务目标的状态工具；只应在用户明确要求进入 Task Mode，或请求明显具有复杂、多步、需要对齐/验证的任务特征时使用。
_避免_：对所有请求自动启动任务、把普通问答包装成任务

**task_update**：
在 Task Mode 中更新任务状态、重要进展、阻塞、计划项和完成情况的状态工具；items 是任务步骤列表，不应记录琐碎微动作。
_避免_：todo_update、微步骤日志、执行动作替代品
