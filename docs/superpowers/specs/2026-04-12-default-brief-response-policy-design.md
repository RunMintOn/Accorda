# Default Brief Response Policy Design

## Goal

Stage 3 adds a small runtime-level response policy layer so Accorda answers more like a local CLI tool by default: short, direct, and non-verbose.

This stage does not change the dual-layer control flow. It only changes how responses are framed after the runtime has already decided whether the turn is `answer`, `clarify`, `execute`, or `task_mode`.

## Scope

In scope:

- Add appended response policies during provider prompt assembly.
- Use a shared default brief policy for normal answers and post-execution summaries.
- Use a dedicated clarify policy for direct, minimal clarification questions.
- Record the selected response policy in runtime status events.

Out of scope:

- Hard word limits or token budgets.
- Semantic complexity scoring.
- Long-form response modes.
- Task Mode redesign.
- Changing the first-layer decision model introduced in Stage 2.

## Design Summary

Accorda keeps its existing base system prompt. Stage 3 adds one more short system message during runtime prompt assembly.

The runtime should treat response style as a composable policy:

1. Base identity prompt describes what Accorda is.
2. Appended response policy prompt describes how this specific turn should be answered.
3. Conversation history, user input, and tool results follow as they do now.

This keeps the product identity stable while letting the runtime shape output style without rewriting the whole prompt.

## Policies

### `default_brief_v1`

Used for:

- `answer`
- final assistant response after `execute`

Prompt text:

`Be brief. Lead with the conclusion.`

Intent:

- Keep normal answers short by default.
- Keep execution summaries short without replacing the real second-layer tool flow.
- Avoid adding a separate `execute`-specific response mode in v1.

Expected effect:

- Simple questions get short answers.
- Post-tool summaries stay concise instead of restating raw tool output.

### `clarify_direct_v1`

Used for:

- `clarify`

Prompt text:

`Ask one direct clarification question for the single most important missing detail. Be specific and concise. Do not explain the whole plan.`

Related first-layer tool description:

`Ask one direct clarification question when key information is missing. Ask only for the minimum information needed to continue. Do not answer the task yet. Do not ask multiple questions unless strictly necessary. Use this only when the missing information blocks a correct or safe next step.`

Intent:

- Make clarification turns minimal and actionable.
- Prevent the model from mixing a partial answer with a clarification request.
- Prevent multi-question dumps in one turn.

Expected effect:

- `帮我改一下` -> `要改哪个文件或哪个行为？`
- `帮我看看这个报错` -> `把报错信息或相关命令输出贴一下。`

## Runtime Integration

Stage 3 should introduce a small response-policy selection step inside runtime prompt assembly.

Expected mapping:

- `answer` -> `default_brief_v1`
- `clarify` -> `clarify_direct_v1`
- `execute` -> `default_brief_v1`
- `task_mode` -> no new policy in this stage; the current Task Mode entry message remains short by construction

`execute` remains a full second-layer path:

1. User input is routed to `execute`.
2. Runtime enters the real tool layer.
3. Tool calls and tool results are persisted as before.
4. The final assistant message after tool work uses the default brief policy.

Stage 3 must not collapse `execute` into a direct answer path.

## Event Log Requirements

The runtime should expose which response policy was appended so the system stays transparent.

These fields should be attached to the provider-facing `system_status` event:

- `responsePolicyId`
- `responsePolicyMode`
- `responseStyle`

Expected values:

- `default_brief_v1`
  - `responsePolicyMode: "appended"`
  - `responseStyle: "default_brief"`

- `clarify_direct_v1`
  - `responsePolicyMode: "appended"`
  - `responseStyle: "clarify_direct"`

The event log should record the policy identifier, not the full prompt text.

## Examples

### Answer

User:

`这个项目怎么启动？`

Expected style:

`运行 npm run dev。需要本地环境变量时用 npm run dev:local。`

### Clarify

User:

`帮我改一下`

Expected style:

`要改哪个文件或哪个行为？`

### Execute

User:

`read package.json`

Expected flow:

- first layer selects `execute`
- second layer runs `read`
- event log keeps the raw `tool_result`
- final assistant message stays short

Expected style:

`已读取 package.json。这里定义了项目脚本和依赖入口。`

## Testing Requirements

Stage 3 implementation should prove:

- prompt assembly appends the expected policy for `answer`
- prompt assembly appends the expected policy for `clarify`
- `execute` still runs the second layer and only changes final response style
- provider status events include response policy metadata
- existing runtime transparency and event persistence remain intact

## Acceptance Criteria

Stage 3 is complete when:

- Accorda keeps the Stage 2 control flow unchanged.
- Normal answers are visibly shorter by default.
- Clarification turns are direct and minimal.
- Execution turns still use the second layer and finish with a short summary.
- Event logs expose which response policy was appended for the turn.
