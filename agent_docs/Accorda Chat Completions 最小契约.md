# Accorda Chat Completions 最小契约

日期：2026-04-21

## 目的

这份文档不是官方协议说明，而是 Accorda 当前阶段准备依赖的最小子集。

目标是回答四个问题：

- Accorda 现在打算把 `chat/completions` 用到什么程度
- 哪些字段是运行时必须依赖的
- stage1 和 stage2 分别怎么使用这套协议
- 哪些东西不应该混在一起表达

## 当前选择

Accorda 当前将 OpenAI `chat/completions` 作为对话与工具调用的基线接口。

现阶段不以 `responses` 作为主协议，不追求覆盖 OpenAI 全部字段，只依赖完成当前 runtime 所需的最小子集。

## 请求最小契约

### 必需字段

- `model`
- `messages`

### 条件必需字段

- `tools`
  当这一轮允许模型调用工具时必须提供。

- `tool_choice`
  当这一轮需要明确约束工具策略时应显式提供。

### 第一批高优先级字段

Accorda 现阶段应优先支持以下字段或能力入口：

- `tools`
- `tool_choice`
- `max_tokens`
- `stream`
- reasoning/thinking 相关配置

这里的 reasoning/thinking 被视为第一批能力，不是因为其协议已经完全统一，而是因为现代模型普遍具备这类能力，项目不应把它长期放在外围。

## 响应最小契约

Accorda 当前最小上只依赖：

- `choices[0]`
- `choices[0].message`
- `choices[0].finish_reason`

其中运行时必须正确处理：

- `message.content`
- `message.tool_calls`
- `finish_reason`

对于 reasoning/thinking，当前阶段不把“思考内容返回形态”列为统一硬契约；先承认这是高优先级能力，但具体返回字段和默认行为仍可能因 provider/model 而异。

## Stage1 契约

### 目标

stage1 不是纯文本分流器。

stage1 的正确目标应是：

- 模型可直接回答
- 模型也可调用 stage1 工具
- 工具结果可推动 runtime 进入下一状态

### 请求要求

stage1 请求应：

- 带 stage1 对应的 `messages`
- 带 stage1 对应的 `tools`
- 采用 `tool_choice: "auto"`，或使用与此等价的默认行为
- 可带 reasoning/thinking 相关配置

### 响应要求

stage1 响应需要支持两类结果：

1. 直接回答
- `message.content` 有文本
- 没有 `tool_calls`

2. 发起工具调用
- `message.tool_calls` 非空
- runtime 按调用结果推进状态

### 不应继续使用的表达

如果 stage1 本轮允许工具调用，就不应再用这种表达：

- “API tool-calls are not enabled yet”

因为这会把“本轮行为策略”和“协议层能力”混淆。

## Stage2 契约

### 目标

stage2 负责执行闭环，而不是开放式聊天。

### 请求要求

stage2 请求应：

- 带执行阶段可用的 `tools`
- 显式传 `tool_choice: "required"`
- 可带 reasoning/thinking 相关配置

### 响应要求

stage2 首要预期是：

- 模型先产生 `tool_calls`

如果 provider 返回普通文本而没有工具调用，runtime 需要明确决定：

- 视为失败
- 或视为降级完成

但这个策略需要在实现里统一，不能让不同分支各自解释。

## Provider 层契约

provider 层建议分成两层理解：

### 1. 基线解析层

负责处理本项目承诺支持的 `chat/completions` 最小字段：

- `messages`
- `tools`
- `tool_choice`
- `message.content`
- `message.tool_calls`
- `finish_reason`

### 2. provider profile 层

负责处理非官方基线的 provider 差异，例如：

- 默认开启 thinking
- 需要额外扩展字段
- 文本字段返回形态漂移
- 默认 token 上限过低
- thinking 内容是否可见，以及以什么字段返回

这类逻辑不应散落在 stage1/stage2 的业务判断里。

## 当前阶段建议的落地顺序

1. 先把 stage1 调整为真正的 `tools + tool_choice:auto`
2. 再清理 prompt 中对工具能力的误导性描述
3. 再把 provider-specific 行为收敛到 provider profile
4. 最后补齐 stage1/stage2 的协议回归测试

## 非目标

当前这份最小契约不承诺：

- 完整支持 OpenAI 全量字段
- 完整支持 `responses`
- 完整支持所有兼容 provider 的全部扩展能力
- 完整支持所有流式细节

它只定义 Accorda 当前阶段真正要依赖和维护的最小协议面。
