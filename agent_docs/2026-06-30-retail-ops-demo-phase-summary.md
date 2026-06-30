# Retail Ops Demo 阶段总结

## 本阶段完成

- 将 Accorda skills 隔离到 `.accorda/skills/`，只加载项目级 skills，不加载全局 skills。
- 新增 `/skills`，用于查看当前加载的项目 skills。
- 新增 Retail Ops mock 数据：
  - `demo_data/retail/sales.csv`
  - `demo_data/retail/inventory.csv`
  - `demo_data/retail/products.csv`
  - `demo_data/retail/rules.json`
- 新增 Retail skills：
  - `retail-inventory-risk`
  - `retail-sales-trend`
- 新增 skill 编写规范：
  - `accorda-skill-authoring`
- 新增复盘 skill：
  - `accorda-retrospective`
- 新增 Retail eval cases：
  - `eval/retail_cases.json`
- 新增 Retail eval 说明：
  - `eval/retail/README.md`
- 新增数据校验：
  - `npm run retail:validate-data`
- 新增 eval readiness：
  - `npm run eval:retail`

## 当前验证状态

Level 1 的 6 个手动 case 已由用户验证通过：

- 低库存检查
- 热销但库存不足
- 销售趋势分析
- 滞销高库存
- 补货建议
- 不存在 SKU 兜底

当前实现主要通过：

```text
/skill:<retail-skill> → read/bash → Python/脚本确定性计算 → JSON-grounded 中文回答
```

尚未引入专用 Retail Tools。

## 关键设计决策

- Retail Demo 先以 eval case 驱动，不先堆工具。
- Skill 描述场景方法论，不退化成固定 tool script。
- 当前可用 `read/bash` 完成事实读取和确定性计算；重复逻辑稳定后再考虑抽工具。
- 业务分析输出要求 JSON-grounded，降低“工具算对但模型转述错”的风险。
- `.accorda/skills/` 可提交；`.accorda/pi-agent/` 和 `.accorda/pi-runs/` 仍是运行时目录，不提交。
- Retrospective 只提出改进建议，不自动修改 skill/code/eval。

## 当前限制

- Eval 仍以手动运行为主，`eval:retail` 目前只做 readiness check。
- 没有自动模型评测、trace-based scoring 或独立 verifier agent。
- 没有专用 Retail Tools，trace 中主要看到 `read/bash`。
- TUI 长输入/长历史消息展示还有截断和换行体验问题。
- 真实跨进程 session resume 尚未实现。

## 后续候选

优先级较高但暂不急：

- Level 2 泛化问法验证。
- trace-based eval：从 trace 检查是否读取 expected data files、是否调用 bash、是否输出 JSON。
- 轻量 verifier：检查最终回答中的 SKU/数字是否来自 JSON block。
- Retail Tools：当重复脚本稳定后再抽象。
- `/retail` 用户入口：让普通用户不用显式输入 `/skill:<name>`。

暂不建议现在做：

- embedding RAG。
- 自动生成或自动修改 skill。
- 大规模 Retail Tools。
- 完整自动模型 eval。
- 复杂 session resume。
