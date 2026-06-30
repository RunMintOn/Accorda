# Retail Ops Demo 数据契约

本目录是 Accorda Retail Ops Agent Demo 的 mock 数据。数据用于验证 Agent 是否能按 skill 查询事实、做确定性计算、输出可追踪结论。

## 文件

- `sales.csv`：销售明细
- `inventory.csv`：库存快照
- `products.csv`：商品主数据
- `rules.json`：业务规则

## sales.csv

字段：

- `date`：销售日期，YYYY-MM-DD
- `store_id`：门店 ID
- `sku`：商品 SKU
- `units`：销量件数
- `revenue`：销售额

## inventory.csv

字段：

- `store_id`：门店 ID
- `sku`：商品 SKU
- `on_hand`：当前库存
- `safety_stock`：安全库存

## products.csv

字段：

- `sku`：商品 SKU
- `name`：商品名
- `category`：品类
- `gross_margin`：毛利率
- `lead_time_days`：补货提前期

## rules.json

包含 demo 使用的规则说明和公式。Agent 应引用规则或公式，不要凭空生成业务判断。

## 已埋场景

- 低库存：`LATTE_BEAN`、`OAT_MILK`、`MATCHA_POWDER`
- 热销但库存不足：`LATTE_BEAN`、`OAT_MILK`
- 销量下降：`COLD_BREW_BOTTLE`
- 滞销高库存：`CERAMIC_MUG`
- 不存在 SKU 兜底：`ABC999`
