# Superpowers 工作流裁剪说明

本文件用于控制 workflow 的展开深度，不用于否定 skill 的相关性。

若存在相关的 superpowers skill，先尊重其 routing。  
本文件只负责判断：当前任务需要把 workflow 展开到什么程度。  
不要因为“看起来简单”就跳过 skill discovery，也不要借此绕开 rigid skill 的核心纪律。

流程深度应与任务复杂度、风险和总成本相匹配。

对于极小且落点清晰的改动，例如顺手修复一个局部 bug、改一处明确逻辑或补一个很小的缺口，不必进入重型 spec-plan 流程，也不必切换 plan-only mode。  
这类任务只需保留最小充分的思考，可直接列出一个 todo list 后开始执行。

对于低复杂度但仍值得先收敛思路的任务，不走重型 spec-plan 流程。  
只保留最小充分的计划与分析；若确实需要计划，优先采用轻量的 plan-only mode。  
这里的 plan-only mode 属于 Codex CLI 的轻量计划模式，不属于 superpowers 工作流本身。  
当 Codex 判断任务适合这一层时，应直接告知用户，并建议由用户手动开启 plan-only mode 后再继续。

对于中等复杂度任务，保留 workflow 骨架，但裁掉那些不会实质提升质量的步骤。  
通常不需要完整 spec，一个聚焦的 plan 往往已经足够。

对于高复杂度或高风险任务，保留 superpowers 的完整流程。  
不要为了节省时间或 token，而削弱关键分析、设计或验证步骤。

目标不是削弱纪律，而是避免简单任务被不必要的流程放大；  
该严谨的地方保持严谨，不该做重的地方不要做重。