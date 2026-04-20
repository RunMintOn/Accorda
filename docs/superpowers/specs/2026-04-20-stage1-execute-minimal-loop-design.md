# Stage1 Execute Minimal Loop Design

**Goal:** 用最小闭环把当前 runtime 收敛成 `answer / execute` 两层结构，并让 `execute` 支持可持续的工具循环、用户追问和权限确认。

## Scope

本设计只覆盖第一阶段最小闭环：

- `stage1` 决策收敛为 `answer` 或 `execute`
- `execute` 统一承载工具调用循环
- 在 `execute` 中支持控制工具 `ask_user` 和 `finish`
- 在等待用户或等待权限期间保留当前执行态

本设计明确不包含：

- `task_mode`
- task notepad / memory
- 用户主动取消执行
- execute 外的独立 `clarify` 顶层状态

## Why This Shape

当前代码已经具备：

- `stage1` 决策骨架
- 本地工具 registry
- event log 与 session 存储
- UI 状态展示

如果继续保留顶层 `clarify`，系统会立刻遇到“clarify 只允许发生在 execute 前，还是 execute 中途也能跳出”的状态拆分问题。把澄清需求并入 `execute` 内部的控制工具，可以降低顶层状态复杂度，并复用同一条执行链。

第一阶段因此只保留两个顶层分流：

- `answer`: 不需要进入执行层，直接回答
- `execute`: 进入统一工具循环，直到显式结束

## Runtime Model

### Stage1

`stage1` 只负责低成本分流：

- 能直接回答的问题，返回 `answer`
- 需要工具、文件、命令、用户补充信息或持续推进的任务，返回 `execute`

`stage1` 不再返回独立 `clarify`。

### Execute Loop

`execute` 是一条持续的执行循环。模型在循环中只能通过显式工具动作推进状态。

工具分为两类：

- 资源工具
  - 直接放行：`ls`、`read`、`glob`、`grep`
  - 需要确认：`write`、`edit`、`bash`
- 控制工具
  - `ask_user`
  - `finish`

循环中的典型路径允许自由混用：

- `read -> finish`
- `read -> ask_user -> read -> finish`
- `read -> write(待确认) -> finish`

runtime 不人为把 `execute` 拆成“澄清阶段”“执行阶段”等子模式。

## Control Tools

### `ask_user`

`ask_user` 是 execute 内部的控制工具，用于向用户请求额外信息。

语义：

- 模型发出 `ask_user`
- runtime 记录当前执行态并进入 `waiting_user`
- UI 明确显示当前仍在 execute 中，例如 `waiting_user (execute)`
- 用户下一条输入默认视为继续当前 execute，而不是开启新的 `stage1` 分流

实现要求：

- 用户回复要作为 `ask_user` 的结果送回同一个执行循环
- 只要 session 中存在 `waiting_user` 的 pending execute，新输入就应短路 `stage1`

### `finish`

`finish` 是 execute 内部的显式结束工具。

语义：

- 模型调用 `finish`
- runtime 结束当前 execute
- `finish` 的输出内容作为最终结果返回给用户

第一阶段不依赖普通文本语义去猜测“这是追问还是最终答案”。execute 的结束必须显式通过 `finish` 完成。

## Permission Flow

`write`、`edit`、`bash` 继续采用“需要确认”的权限策略。

当 execute 调用这些工具时：

- runtime 进入 `waiting_permission`
- UI 明确显示当前仍在 execute 中，例如 `waiting_permission (execute)`
- 用户确认后，继续同一个 execute 循环
- 不重新进入 `stage1`

如果用户拒绝权限：

- runtime 将拒绝结果作为结构化 observation 返回给模型，例如 `permission_denied`
- 同一个 execute 继续，由模型决定改走只读路径、继续追问或直接 `finish`

第一阶段不额外增加“拒绝后继续还是中断”的二次确认流程。

## Session And State

session 需要能够持有一个 `pending execute state`。

至少要区分三类状态：

- `idle`
- `waiting_user`
- `waiting_permission`

其中 `waiting_user` 和 `waiting_permission` 都属于“当前仍有未结束 execute”的状态。

恢复规则：

- 只要存在 pending execute，就优先恢复 execute
- 只有 `finish` 成功完成后，才清除 pending execute 并回到普通对话流

第一阶段不支持用户主动取消 execute，因此不存在“取消后保留还是丢弃”的额外状态分支。

## UI Requirements

第一阶段 UI 只需要补足最小可解释性：

- 当处于普通输入态时，展示当前可输入
- 当 execute 进入 `waiting_user` 时，明确显示仍在 execute 中等待用户回复
- 当 execute 进入 `waiting_permission` 时，明确显示仍在 execute 中等待权限确认
- execute 完成后，状态回到普通对话态

UI 的目标是让用户知道“当前是在新的普通回合，还是在继续上一个执行链”。

## Event And Logging

现有 event log 需要继续承担可观测性，但第一阶段只增加最小必要记录。

至少应能记录：

- `stage1` 选择了 `answer` 还是 `execute`
- execute 内的工具调用和工具结果
- `ask_user` 触发的等待状态
- 权限等待、确认、拒绝
- `finish` 结束执行

目标不是设计完整 task replay 系统，而是让 runtime 当前执行链可追踪、可恢复、可解释。

## Error Handling

第一阶段保持最小原则：

- 工具失败作为 observation 返回给模型，而不是直接终止 execute
- 权限拒绝也作为 observation 返回
- 只有 `finish` 负责正常结束 execute

这保证 execute 始终围绕“观察结果后继续决策”的统一主路径工作。

## Testing Focus

第一阶段验证只做最小充分验证：

1. `stage1` 只会产出 `answer` 或 `execute`
2. execute 内允许连续多次工具循环
3. execute 可通过 `ask_user` 挂起，并在用户回复后恢复同一执行链
4. execute 遇到需要确认的工具时，确认后继续同一执行链
5. execute 遇到权限拒绝时，将拒绝结果作为 observation 返回并继续
6. 只有 `finish` 会结束 execute 并清除 pending state

## Deferred Work

以下内容刻意延后，不在本设计内实现：

- `task_mode`
- 更重的探索-对齐-执行三元循环
- task 专属 notepad
- 长程 memory
- 用户主动取消当前 execute
- execute 之外的复杂恢复策略
