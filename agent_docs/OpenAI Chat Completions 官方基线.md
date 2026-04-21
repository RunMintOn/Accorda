# OpenAI Chat Completions 官方基线

日期：2026-04-21

## 目的

这份文档不是复制完整官方文档，而是为 Accorda 固定一份“官方基线认知”。

本项目后续提到的 `OpenAI chat/completions 基线`，默认指：

- OpenAI 官方 `POST /v1/chat/completions`
- 以及其中与多轮对话、工具调用直接相关的字段语义

官方参考：

- https://platform.openai.com/docs/api-reference/chat/create-chat-completion
- https://platform.openai.com/docs/guides/tools/tool-choice

## 基线判断

### 1. 这是 OpenAI 自己的 API 规范，不是行业标准

OpenAI 官方文档定义了自己的请求和响应结构。

其他厂商说自己是 `OpenAI-compatible`，通常表示：

- 尽量兼容 OpenAI 的字段形状
- 尽量兼容 OpenAI SDK
- 但不保证完全等价

因此，Accorda 应把 OpenAI 官方格式视为“基线参考”，而不是假设所有兼容端点都完全一致。

### 2. 能力声明和行为提示是两回事

在 `chat/completions` 里：

- `messages` 用来表达上下文、任务、约束
- `tools` 用来声明模型可以调用哪些工具
- `tool_choice` 用来约束模型是否允许/必须/禁止调用工具
- reasoning/thinking 相关字段用于调节模型的思考行为，但不同 API 和模型家族的字段设计可能不同

所以：

- 只在 prompt 里写“你有这些工具”，不等于协议层已经允许工具调用
- 如果要让模型真的能 tool call，必须在请求体显式传 `tools`

## 与本项目相关的最小官方字段

### 请求侧

最关键字段：

- `model: string`
- `messages: array`
- `tools?: array`
- `tool_choice?: string | object`
- `max_tokens?: number`
- `stream?: boolean`
- reasoning/thinking 相关可选字段

其中与工具调用相关的官方语义：

- 没有 `tools` 时，默认不会发生工具调用
- 有 `tools` 时，`tool_choice` 默认是 `auto`
- `tool_choice: "auto"` 表示模型可在“直接回答”和“调用工具”之间选择
- `tool_choice: "required"` 表示模型必须调用至少一个工具
- 也可以强制指定某个工具

其中与 reasoning/thinking 相关的现实判断：

- 现代模型普遍具备某种思考能力
- 但“是否默认开启思考”“如何配置思考”“是否返回思考内容”并不总是统一
- 因此可以把 reasoning/thinking 视为高优先级能力入口，但不要默认所有兼容 provider 都完全同形

### 响应侧

最关键字段：

- `choices[0].message`
- `choices[0].finish_reason`

在与本项目相关的最小闭环里，最重要的是：

- `message.content`
- `message.tool_calls`
- `finish_reason`

常见情况：

1. 直接回答  
`message.content` 有文本，`tool_calls` 为空或不存在

2. 工具调用  
`message.tool_calls` 有内容，`finish_reason` 往往是 `tool_calls`

3. 长度截断  
`finish_reason = "length"`，表示输出被 token 上限截断

## 官方基线对 Accorda 的直接约束

### stage1 如果允许模型自行决定是否调工具

那请求应满足：

- 带 `messages`
- 带 stage1 工具列表 `tools`
- `tool_choice` 为 `auto`，或等价默认行为
- 如项目需要，可同时带 reasoning/thinking 相关配置

### stage2 如果要求先走执行闭环

那请求应满足：

- 带执行工具列表 `tools`
- `tool_choice` 为 `required`
- 如项目需要，可同时带 reasoning/thinking 相关配置

### 不能混淆的点

下面这种做法不符合官方基线的协议分层：

- 在 prompt 里列出工具名
- 但请求体里不传 `tools`
- 同时又期待模型准确理解“这轮可不可以真实调用工具”

## 这份文档不覆盖的内容

为了避免范围失控，这份文档不展开：

- OpenAI `responses` API
- 多模态 content parts 的完整细节
- 全量采样参数
- 流式 tool call 的事件细节
- 各 provider 的扩展参数

这些内容只有在项目真的开始依赖时再补。
