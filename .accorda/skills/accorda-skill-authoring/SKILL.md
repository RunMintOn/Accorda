---
name: accorda-skill-authoring
description: Accorda 项目内 Agent Skill 编写规范。Use when creating, reviewing, or improving project skills for Accorda, especially retail ops skills, eval-guided workflows, or tool-grounded agent playbooks.
---

# Accorda Skill Authoring

## 适用场景

当需要新增或修改 Accorda 项目内 skill 时使用本 skill。

项目 skills 放在：

```text
.accorda/skills/<skill-name>/SKILL.md
```

Accorda 当前只扫描项目内 `.accorda/skills/`，不加载全局 skills，也不污染其他 agent 的默认 skill discovery。

## 总原则

Skill 不是工具调用脚本。Skill 应描述场景方法论：

```text
什么时候使用 → 需要哪些事实 → 如何计算 → 如何判断 → 如何输出 → 如何兜底
```

不要把 skill 写成固定步骤的机械 tool script。

## 语言

- 面向人看的内容尽量使用中文。
- skill name、tool name、字段名、JSON key、文件路径保留英文。
- 业务解释、原则、失败兜底、输出要求用中文。

## 结构建议

每个业务 skill 优先包含：

```text
适用场景
数据来源
原则
必要事实
必要计算
推荐步骤
输出格式
失败兜底
```

如果 skill 依赖 demo 数据，引用：

```text
demo_data/retail/README.md
```

## Skill 与工具的关系

Skill 可以提到当前可用能力，但不要强耦合具体工具名。

推荐写法：

```text
需要销售数据、库存数据、商品主数据和规则数据。
Retail tools 如果可用可以优先使用；没有专用工具时，用 read/bash 读取 CSV 并计算。
```

避免写法：

```text
第一步必须调用 retail_query_sales，第二步必须调用 retail_query_inventory。
```

## 计算要求

模型不能凭直觉计算业务指标。凡是涉及数量、增长率、库存缺口、覆盖天数、补货量，都必须由工具或脚本计算。

Skill 应明确公式，例如：

```text
growth_rate = (current_units - previous_units) / max(previous_units, 1)
```

## JSON-grounded 输出

业务分析类 skill 应要求 Agent 在最终回答前生成或引用结构化 JSON 计算结果。

推荐要求：

```text
计算完成后，先输出一个 JSON block，包含 rows、metrics、time_window、data_limitations。
最终中文回答只能引用 JSON block 中出现的 SKU、数字和结论。
回答前自检：每个数字和 SKU 都能在 JSON 或原始数据中找到。
```

这用于降低“工具算对了，但模型转述错了”的风险。

## 失败兜底

Skill 必须写清楚缺数据时怎么处理：

- 查不到 SKU：说明没有匹配，不要编造商品。
- 销售数据为空：不能判断趋势。
- 库存字段缺失：停止判断并说明缺少字段。
- 规则缺失：只输出事实和计算，不输出规则判断。

## Eval 对齐

新增或修改 skill 时，应检查是否影响：

```text
eval/retail_cases.json
eval/retail/README.md
```

Skill 应服务 eval case，但不要只为某个 case 硬编码答案。
