---
name: retail-inventory-risk
description: 零售库存风险分析 skill。用于用户询问库存不足、低于安全库存、快断货、缺货风险、库存不够、热销但库存跟不上、是否需要补货、补货风险等场景。Use for low stock, inventory risk, stockout risk, hot-selling items with insufficient inventory, and replenishment risk.
---

# Retail Inventory Risk

## 适用场景

用户询问：

- 哪些商品库存不足
- 哪些商品低于安全库存
- 哪些热销商品有缺货风险
- 是否需要补货
- 库存风险排查

## 数据来源

优先读取项目 mock 数据：

```text
demo_data/retail/inventory.csv
demo_data/retail/products.csv
demo_data/retail/sales.csv
demo_data/retail/rules.json
```

字段契约见：

```text
demo_data/retail/README.md
```

## 原则

- 不要凭模型直觉判断库存风险。
- 先查事实数据，再用脚本或工具做确定性计算。
- 结论必须引用字段、时间窗口或规则。
- 数据缺失时直接说明限制，不要编造。
- Retail tools 如果可用可以优先使用；没有专用工具时，用 `read`/`bash` 读取 CSV 并计算。

## 必要事实

库存风险至少需要：

- `store_id`
- `sku`
- `on_hand`
- `safety_stock`

如果要判断“热销但库存不足”，还需要：

- `date`
- `units`
- 当前时间窗口销量
- 对比时间窗口销量

## 必要计算

- 低库存：`on_hand < safety_stock`
- 库存缺口：`stock_gap = max(0, safety_stock - on_hand)`
- 平均日销量：`avg_daily_sales = window_units / window_days`
- 覆盖天数：`coverage_days = on_hand / max(avg_daily_sales, 1)`
- 销量增长率：`growth_rate = (current_units - previous_units) / max(previous_units, 1)`

这些计算必须用脚本或工具完成，不要心算。

## 推荐步骤

1. 读取数据契约和相关 CSV。
2. 对库存行计算低库存和库存缺口。
3. 如果用户提到热销、上涨、最近销量，读取销售数据并计算近 7 天与前 7 天销量变化。
4. 合并商品名称、品类、供应周期等主数据。
5. 输出风险项和数据限制。

## JSON-grounded 输出

计算完成后，先给出一个 JSON block，包含：

```json
{
  "case": "inventory_risk",
  "time_window": "如果使用了销售数据，写明当前窗口和对比窗口",
  "rows": [
    {
      "store_id": "S001",
      "sku": "LATTE_BEAN",
      "name": "拿铁咖啡豆",
      "on_hand": 12,
      "safety_stock": 30,
      "stock_gap": 18,
      "avg_daily_sales": 9.5,
      "coverage_days": 1.26
    }
  ],
  "data_limitations": []
}
```

最终中文回答只能引用 JSON block 或原始数据中存在的 SKU、数字和结论。回答前自检：每个数字、SKU、缺口、增长率都能在 JSON 或原始数据中找到。

## 输出格式

JSON 后再用中文简要说明：

- 商品 / 门店
- 当前库存
- 安全库存
- 库存缺口
- 近 7 日销量或平均日销量（如果查询过）
- 风险说明
- 数据限制

## 失败兜底

- 查不到商品：说明没有匹配 SKU 或商品名。
- 销售数据为空：只能判断库存是否低于安全库存，不能判断热销风险。
- 库存字段缺失：停止判断并说明缺少必要字段。
