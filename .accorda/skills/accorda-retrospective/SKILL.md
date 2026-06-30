---
name: accorda-retrospective
description: Accorda 复盘 skill。Use when reviewing recent agent runs, readable traces, retail eval results, skill behavior, or deciding how to improve skills/tools/data/eval after a demo or failure.
---

# Accorda Retrospective

## 适用场景

用于复盘 Accorda 的一次或多次运行结果，尤其是：

- Retail Ops eval case 手动运行结果
- readable trace
- skill 是否生效
- 工具调用是否合理
- JSON-grounded 输出是否可靠
- 是否需要改 skill、数据、eval case 或工具

## 输入材料

优先要求用户提供至少一种：

- case id
- 用户输入
- agent 最终回答
- trace path
- 手动评估记录
- 用户观察到的问题

如果材料不足，先说明缺口，不要假装已完成复盘。

## 分析维度

按以下维度复盘：

1. Skill 选择：是否使用了合适 skill，是否需要新增或修改 skill。
2. 数据读取：是否读取了期望数据文件，是否存在缺数据或脏数据风险。
3. 确定性计算：是否用工具/脚本计算，还是模型凭直觉判断。
4. JSON-grounded：是否先产生结构化 JSON，最终回答是否只引用 JSON/原始数据中的 SKU 和数字。
5. Trace 可读性：trace 是否能让人看懂 intent、数据来源和计算动作。
6. 复用机会：是否出现重复脚本、重复查询或可抽象能力。
7. Eval 覆盖：现有 eval case 是否覆盖这个问题，是否需要新增 Level 1/Level 2 case。
8. 用户风险：普通用户是否可能被回答带偏。

## 输出格式

用中文输出，保持简洁：

```text
结论：

证据：
- ...

问题：
- ...

建议：
- [P0/P1/P2] ...

不建议现在做：
- ...

需要补充的信息：
- ...
```

## 优先级标准

- `P0`：会导致错误结论、数据编造、用户被明显误导。
- `P1`：影响稳定性、可复用性、eval 可信度。
- `P2`：体验或文档优化。

## 约束

- 不要自动修改 skill、代码或 eval case，除非用户明确要求。
- 不要把一次偶然失败直接上升为大重构。
- 优先建议小而可验证的改动。
- 如果只是 UI 展示问题，和 workflow 正确性分开描述。
