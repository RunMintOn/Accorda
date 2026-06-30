# Retail Ops Demo 手动评估指南

本指南用于手动验证 Retail Ops Agent Demo。当前阶段不做自动评分，先用固定 case 检查 Agent 是否按 skill 查询事实、做确定性计算、输出可追踪结论。

## 运行入口

```bash
npm run pi:dev
```

先确认项目 skills：

```text
/skills
```

预期至少看到：

```text
retail-inventory-risk
retail-sales-trend
```

## 评估原则

每个 case 重点看 5 件事：

1. 是否加载或遵循正确 skill。
2. 是否读取 `demo_data/retail/` 下的数据文件。
3. 是否用 `bash`/脚本做确定性计算，而不是脑补。
4. 输出是否引用具体 SKU、字段、时间窗口或公式。
5. 数据缺失时是否兜底，而不是编造。

## Case 1：低库存检查

输入：

```text
/skill:retail-inventory-risk 找出库存低于安全库存的商品
```

期望行为：

- 读取 `inventory.csv`。
- 读取 `products.csv` 以补商品名。
- 计算 `on_hand < safety_stock`。
- 计算库存缺口 `stock_gap`。

期望输出包含：

- `LATTE_BEAN`
- `OAT_MILK`
- `MATCHA_POWDER`
- 当前库存
- 安全库存
- 库存缺口

不应出现：

- 凭经验判断
- 没查数据就给结论

## Case 2：热销但库存不足

输入：

```text
/skill:retail-inventory-risk 哪些商品最近销量上涨但库存不足？
```

期望行为：

- 读取 `sales.csv`、`inventory.csv`、`products.csv`。
- 计算当前窗口与对比窗口销量变化。
- 同时判断低库存。

期望输出包含：

- `LATTE_BEAN`
- `OAT_MILK`
- 销量上涨说明
- 库存不足说明

不应出现：

- 只看库存，不看销量
- 只说“可能热销”，没有计算依据

## Case 3：销售趋势分析

输入：

```text
/skill:retail-sales-trend 分析最近销售趋势，找出上涨和下降最明显的商品
```

期望行为：

- 读取 `sales.csv`。
- 读取 `products.csv`。
- 按 SKU 聚合销量。
- 计算 `current_units`、`previous_units`、`growth_rate`。

期望输出包含：

- 上涨商品：如 `LATTE_BEAN`、`OAT_MILK`
- 下降商品：如 `COLD_BREW_BOTTLE`
- 时间窗口
- 增长率或变化量

不应出现：

- 没说明时间窗口
- 没有计算过程

## Case 4：滞销高库存

输入：

```text
/skill:retail-inventory-risk 哪些商品库存很多但最近卖不动？
```

期望行为：

- 读取 `inventory.csv`、`sales.csv`、`products.csv`、`rules.json`。
- 判断高库存：`on_hand >= safety_stock * 3`。
- 判断低近期销量或低平均日销量。

期望输出包含：

- `CERAMIC_MUG`
- 高库存
- 滞销或近期销量低

不应出现：

- 建议补货
- 把高库存误判为缺货

## Case 5：补货建议

输入：

```text
/skill:retail-inventory-risk 根据当前库存和最近销量，给出今日补货建议
```

期望行为：

- 读取 `inventory.csv`、`sales.csv`、`products.csv`、`rules.json`。
- 计算平均日销量。
- 使用公式：`max(0, safety_stock + lead_time_days * avg_daily_sales - on_hand)`。
- 明确说明这是公式建议，不是真实采购单。

期望输出包含：

- `LATTE_BEAN`
- `OAT_MILK`
- 补货量或建议数量
- 公式依据

不应出现：

- 已下单
- 供应商确认
- 编造真实采购状态

## Case 6：不存在 SKU 兜底

输入：

```text
/skill:retail-inventory-risk 查看 SKU ABC999 的库存风险
```

期望行为：

- 查询 `inventory.csv` 和 `products.csv`。
- 发现没有匹配 SKU。
- 明确说明无法判断该 SKU。

期望输出包含：

- `ABC999`
- 没有匹配 / 查不到
- 可检查现有 SKU 或数据范围

不应出现：

- 库存正常
- 建议补货
- 编造商品名

## Level 2：泛化问法

这些 case 用来观察 Agent 是否能把自然语言映射到正确 skill/workflow。

### 快断货

输入：

```text
/skill:retail-inventory-risk 帮我看看哪些东西快断货了
```

期望：等价于低库存/库存风险检查。

### 卖得更好/变差

输入：

```text
/skill:retail-sales-trend 最近哪些 SKU 卖得更好了，哪些变差了？
```

期望：等价于销售趋势分析。

## 记录结果

建议每次手动验证时记录：

```text
case id:
model:
thinking:
pass/fail:
主要问题:
trace path:
```

## 当前限制

- 目前是手动评估，不是自动评分。
- case 数据是 mock 的，用于验证 Agent workflow，不代表真实零售业务。
- 第一版优先使用 `read`/`bash` 做数据读取和计算，暂不强制专用 Retail Tools。
