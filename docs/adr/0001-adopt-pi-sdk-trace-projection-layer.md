# 采用 Pi SDK Trace Projection Layer

Accorda 将从自研 two-stage Agent Runtime 主线，转向基于 Pi SDK 的 Trace Projection Layer：Pi SDK 负责模型、认证、基础工具调用、会话与压缩，Accorda 负责将 Pi Session Event 和增强后的工具调用投影为可读的产品级 trace。这个选择避免重复实现 Provider/Tool Loop/Session 体系，同时保留 Accorda 在可观测性、Task Mode、Intent 记录和任务状态展示上的项目价值。

## Considered Options

- 继续保留自研 Stage 1 / Stage 2 双层工具循环：控制力强，但会和 Pi SDK 的 Agent Loop、工具调用、会话和重试机制重叠，增加状态分叉和维护成本。
- 将 Accorda 降级为 Pi SDK 的薄 UI wrapper：实现简单，但项目差异化不足。
- 采用 Pi SDK 作为底层 Agent 能力层，Accorda 作为 trace/task 产品层：复用底层能力，同时保留可读 trace、Task Mode 和工具 Intent 等上层价值。

## Consequences

Accorda v1 不再把自研 Stage 1 / Stage 2 作为新架构主干，而是围绕 Pi SDK session、extension 和事件流构建。bash、edit、write 通过 Tool Schema Override 保留原工具名并强制增加 Intent；append 作为 Narrow Tool 新增；Readable Trace v1 只记录 intent、目标、命令、简短 summary 和状态，不复制完整 Pi session、工具输入或输出。Task Mode 通过 task_start 和 task_update 这类 Task State Tool 维护可见任务状态，而不替代更具体的 skill、工作流或项目指令。
