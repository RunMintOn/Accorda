# OpenAI-compatible 兼容层判断

日期：2026-04-21

## 结论

`OpenAI-compatible` 更接近一种“兼容 OpenAI 某些 API 形态的行业约定”，不是一个由独立标准组织维护、边界非常严格的单一协议。

对 Accorda 来说，更安全的判断方式是：

- 把 OpenAI 官方 `chat/completions` 或 `responses` 请求/响应格式当作“基线契约”
- 把各 provider 的差异当作“兼容层偏差”
- 不要把 `OpenAI-compatible` 理解成“任何兼容端点都能无差别替换”

## 为什么这样判断

- OpenAI 官方文档定义了自己的 API 结构，例如 `messages`、`tools`、`tool_choice`、返回里的 `tool_calls` 等。
- 但多家 provider 在自己的官方文档里通常写的是“OpenAI-compatible”或“可用 OpenAI SDK”，这更像“尽量兼容 OpenAI 接口习惯”，不是说它们共同实现了某个第三方标准。
- 有些厂商甚至明确说明这只是 compatibility layer，主要用于接入或测试，不应默认等同于其原生 API 全量语义。

## 对本项目最重要的协议结论

### 1. 工具调用能力是请求体契约，不是 prompt 文字契约

如果某一轮真的允许模型发起 tool call，就应该在请求体里显式传：

- `tools`
- 视需要传 `tool_choice`

只在提示词里写“你有这些工具”不等于模型在协议层真的拥有这些工具。

### 2. Prompt 和 API 字段职责不同

- `messages` / prompt：描述任务、上下文、行为约束
- `tools`：声明可调用能力
- `tool_choice`：约束模型是否必须/可以/不能调工具

不要用 prompt 去伪装协议层能力，也不要指望模型仅靠 prompt 正确推断当前轮次是否真的能调工具。

### 3. “兼容”通常只保证大形状，不保证细语义

常见漂移点：

- 默认 `max_tokens`
- 是否默认启用 thinking/reasoning
- 文本在 `message.content`、内容数组、`reasoning_content` 等字段中的位置
- `finish_reason` 的具体含义
- tool call 的返回细节
- provider 自己的 `extra_body` / 扩展参数

因此，本项目需要区分：

- 基线契约：尽量贴近 OpenAI 官方格式
- provider profile：处理具体 provider 的偏差

## 对 Accorda 的直接设计含义

### stage1

如果 stage1 的目标是“模型可以自行决定直接回答，或调用 stage1 工具进入下一状态”，那么 stage1 请求应该是：

- 带 `messages`
- 带 stage1 可用 `tools`
- `tool_choice: "auto"` 或同等语义

而不是：

- prompt 里列出工具名
- 但请求体里不传 `tools`

### provider 抽象层

provider 层建议拆成两层：

1. 协议基线层
统一处理 OpenAI 形态的基本请求/响应结构。

2. provider 兼容层
只处理各家偏差，例如：
- NVIDIA `z-ai/glm4.7` 在某些场景下需要显式关闭 thinking
- 某些 provider 返回文本字段形态不同
- 某些参数需要放到 `extra_body`

## 建议的后续动作

1. 明确项目当前选择的“基线协议”是 OpenAI `chat/completions` 还是 OpenAI `responses`
2. 给 stage1/stage2 各自写出允许的请求契约
3. 把 provider-specific 处理收敛成 `provider profile`，不要散落在业务逻辑里
4. 给“工具调用最小闭环”补一页文档和测试样例

## 这份判断的依据

- OpenAI Chat Completions 官方文档：定义了 `messages`、`tools`、`tool_choice`、`tool_calls`
- OpenAI Tools 官方文档：说明工具能力通过 API 字段暴露
- NVIDIA 官方文档：明确其接口是 OpenAI-compatible，并且不同模型存在 thinking/参数差异
- OpenRouter 官方文档：明确其提供 OpenAI-compatible API，并做跨 provider 归一化
- Anthropic 官方文档：明确其 OpenAI SDK compatibility 是 compatibility layer，不建议简单视为原生完整等价

参考链接：

- https://platform.openai.com/docs/api-reference/chat/create-chat-completion
- https://platform.openai.com/docs/guides/tools/tool-choice
- https://docs.api.nvidia.com/nim/reference/llm-apis
- https://docs.api.nvidia.com/nim/reference/z-ai-glm4-7
- https://openrouter.ai/docs/api/reference/responses/overview
- https://docs.anthropic.com/en/api/openai-sdk
