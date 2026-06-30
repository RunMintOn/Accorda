---
name: retail-sales-trend
description: 零售销售趋势分析 skill。Use when the user asks about sales trend, rising or declining products, recent sales changes, top movers, or SKU/store/category sales comparison.
---

# Retail Sales Trend

## 适用场景

用户询问：

- 最近销量趋势
- 哪些商品销量上涨或下降
- 哪些 SKU 表现最好/最差
- 门店或品类销售变化
- 近 7 天与之前相比的变化

## 数据来源

优先读取：

```text
demo_data/retail/sales.csv
demo_data/retail/products.csv
demo_data/retail/rules.json
```

字段契约见：

```text
demo_data/retail/README.md
```

## 原则

- 不要凭模型直觉判断趋势。
- 必须基于销售明细聚合计算。
- 说明时间窗口和对比窗口。
- 数据不足时说明限制。
- Retail tools 如果可用可以优先使用；没有专用工具时，用 `read`/`bash` 读取 CSV 并计算。

## 必要事实

销售趋势至少需要：

- `date`
- `store_id`
- `sku`
- `units`
- `revenue`

商品展示通常还需要：

- `name`
- `category`

## 必要计算

默认使用最近 4 天对比前 4 天；如果用户指定窗口，按用户要求。

- 当前窗口销量：`current_units`
- 对比窗口销量：`previous_units`
- 销量差：`delta_units = current_units - previous_units`
- 增长率：`growth_rate = (current_units - previous_units) / max(previous_units, 1)`
- 上涨：`growth_rate >= 0.2`
- 下降：`growth_rate <= -0.2`

这些计算必须用脚本或工具完成，不要心算。

## 推荐步骤

1. 读取销售数据和商品数据。
2. 确定分析窗口和对比窗口。
3. 按 `sku`、必要时按 `store_id` 或 `category` 聚合销量和销售额。
4. 计算 `delta_units` 和 `growth_rate`。
5. 输出上涨和下降最明显的商品。
6. 如果样本天数不足，明确说明。

## JSON-grounded 输出

计算完成后，先给出一个 JSON block，包含：

```json
{
  "case": "sales_trend",
  "time_window": {
    "current": "2026-06-21..2026-06-24",
    "previous": "2026-06-17..2026-06-20"
  },
  "rows": [
    {
      "sku": "LATTE_BEAN",
      "name": "拿铁咖啡豆",
      "current_units": 38,
      "previous_units": 20,
      "delta_units": 18,
      "growth_rate": 0.9
    }
  ],
  "data_limitations": ["demo 数据只有 8 天时，使用后 4 天 vs 前 4 天作为对比窗口"]
}
```

最终中文回答只能引用 JSON block 或原始数据中存在的 SKU、数字和结论。回答前自检：每个数字、SKU、增长率都能在 JSON 或原始数据中找到。

## 输出格式

JSON 后再用中文简要说明：

- 时间窗口
- 上涨商品 Top N
- 下降商品 Top N
- 每项包含 SKU、商品名、当前销量、对比销量、变化量、增长率
- 数据限制

## 失败兜底

- 销售数据为空：说明无法分析趋势。
- SKU 不存在：说明没有匹配商品。
- 对比窗口没有数据：只输出当前窗口销量，不判断趋势。
