# Retail Ops Level 2 手动测试

Level 2 测试目标：验证用户不显式指定 `/skill:<name>` 时，Agent 是否能根据自然语言和 skill description 主动选择合适 workflow。

## 测试前准备

启动 TUI：

```bash
npm run pi:dev
```

确认 skills 已加载：

```text
/skills
```

预期看到：

```text
retail-inventory-risk
retail-sales-trend
```

## 记录模板

```text
case id:
input:
model:
thinking:
是否主动使用/读取正确 skill:
是否读取正确数据:
是否使用 bash/脚本计算:
结果: pass / partial / fail
trace path:
备注:
```

## 判定标准

- `pass`：不显式 `/skill`，Agent 主动使用或明显遵循正确 skill，读取正确数据并做确定性计算。
- `partial`：没有明显加载 skill，但读取了正确数据、计算正确、回答可用。
- `fail`：没有读取数据、凭空回答、选错 workflow，或编造结果。

## Case L2-1：快断货

输入：

```text
帮我看看哪些东西快断货了
```

期望 workflow：

- 映射到 `retail-inventory-risk`。
- 读取 `inventory.csv`，最好也读取 `products.csv`。
- 计算 `on_hand < safety_stock` 和库存缺口。

期望输出包含：

- 低库存 / 快断货 / 安全库存
- `LATTE_BEAN`
- `OAT_MILK`
- `MATCHA_POWDER`

不应出现：

- 没有数据
- 无法判断
- 未查数据就直接给建议

## Case L2-2：卖得更好/变差

输入：

```text
最近哪些 SKU 卖得更好了，哪些变差了？
```

期望 workflow：

- 映射到 `retail-sales-trend`。
- 读取 `sales.csv`，最好也读取 `products.csv`。
- 计算当前窗口 vs 对比窗口的销量变化和 `growth_rate`。

期望输出包含：

- 上涨 / 下降
- `LATTE_BEAN` 或 `OAT_MILK`
- `COLD_BREW_BOTTLE`
- 时间窗口或数据限制说明

不应出现：

- 只凭直觉判断趋势
- 没有计算窗口

## Case L2-3：卖得好但库存跟不上

输入：

```text
有没有卖得挺好但库存跟不上的商品？
```

期望 workflow：

- 映射到 `retail-inventory-risk`，并结合销售趋势。
- 读取 `sales.csv`、`inventory.csv`、`products.csv`。
- 计算销量变化，并筛选低库存商品。

期望输出包含：

- 热销 / 销量上涨
- 库存不足 / 库存跟不上
- `LATTE_BEAN`
- `OAT_MILK`

不应出现：

- 只看库存，不看销量
- 只看销量，不看库存
- 编造采购状态

## Trace-based 检查

跑完后可用 trace 做弱证据检查。示例：

```bash
npm run eval:retail:trace -- generalized-stockout-wording .accorda/pi-runs/<trace-id>/trace.jsonl
npm run eval:retail:trace -- generalized-sales-wording .accorda/pi-runs/<trace-id>/trace.jsonl
```

第三个 case 当前还没有对应 eval id，可先人工记录；如果表现稳定，再加入 `eval/retail_cases.json`。
