# Retail Ops Eval 说明

本目录放 Retail Ops Demo 的评估材料。它和 `agent_docs/` 分开：

- `agent_docs/`：阶段记录、排障、设计说明
- `eval/retail/`：评估 case、手动验证记录、后续自动 eval 输入

当前阶段以手动评估为主，不做自动评分。

## 评估目标

验证 Accorda 是否能支撑：

```text
用户问题 → skill-guided workflow → 读取事实数据 → 确定性计算 → JSON 结果 → grounded 中文回答 → trace 可追踪
```

重点不是模型文风，而是：

1. 是否用到了正确 skill。
2. 是否读取了正确数据。
3. 是否用工具/脚本做计算。
4. 是否输出结构化 JSON 计算结果。
5. 最终回答是否只引用 JSON/数据中存在的 SKU 和数字。
6. 数据缺失时是否兜底，不编造。

## 文件

```text
eval/retail_cases.json      # eval case 定义
eval/retail/README.md       # 本说明
eval/retail/runs/           # 可选：手动评估记录
```

## 手动运行方式

```bash
npm run pi:dev
```

确认 skills：

```text
/skills
```

显式 skill 模式示例：

```text
/skill:retail-inventory-risk 找出库存低于安全库存的商品
/skill:retail-sales-trend 分析最近销售趋势，找出上涨和下降最明显的商品
```

## 结果记录模板

建议每次手动评估写入 `eval/retail/runs/<date>.md`：

```text
case id:
input:
model:
thinking:
pass/fail:
是否输出 JSON:
是否引用 JSON:
主要问题:
trace path:
```

## 当前约束

- helper script 可以作为过渡，但不是长期边界。
- 长期边界应是：skill 定义场景方法论，工具/脚本提供事实和确定性计算，最终回答必须 grounded。
- 不允许模型凭直觉补数字、补 SKU、补采购状态。
