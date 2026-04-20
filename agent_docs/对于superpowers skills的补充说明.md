# 对于superpowers skills的补充说明(重要!)
在调用了几次superpowers 的skill之后,codex应该已经大致了解了其工作流程
codex需要对实现复杂度有预估
复杂度分层用于裁剪 workflow depth，不用于跳过 skill routing。
- 若低复杂度
	- 不走superpowers的spec--plan等流程
	- 我会手动切换到plan-only mode, 这是codex自己的计划模式
    - 在codex决定要走这一层时, 直接和用户说明, 建议用户开启plan mode
	- 采用最小充分计划，避免过度流程化
	- 适配简单的改动
- 若中复杂度
	- 保留superpowers流程骨架，但允许裁剪
	- 可跳过 spec，直接写 plan；自行控制 plan 详略
	- 允许省略不影响质量的步骤，避免不必要的流程开销
	- 适配中等复杂度改动。
- 若高复杂度
	- 默认采用superpowers完整流程
	- 不为压缩流程而省略关键分析、设计、验证步骤
	- 适配高复杂度改动