import type { RuntimeStatusPayload } from '../core/contracts.js'

export type ControlDecision =
  | {
      kind: 'answer'
      reason?: string
    }
  | {
      kind: 'execute'
      reason?: string
    }

export type ControlDecisionInput = {
  sessionId: string
  userText: string
}

export type ControlDecisionRunner = (
  input: ControlDecisionInput,
) => Promise<ControlDecision>

const EXECUTE_PREFIX = /^(read|ls|glob|grep|write|edit|bash)\b/i
const EXECUTE_HINT =
  /(帮我|看看|检查|检索|修复|修改|更新|创建|运行|搜索|inspect|check|fix|update|create|run|search)/i

export async function defaultControlDecision(
  input: ControlDecisionInput,
): Promise<ControlDecision> {
  const text = input.userText.trim()

  if (EXECUTE_PREFIX.test(text) || EXECUTE_HINT.test(text)) {
    return {
      kind: 'execute',
      reason: 'stage_one_execute_explicit_request',
    }
  }

  return {
    kind: 'answer',
    reason: 'stage_one_direct_answer',
  }
}

export function controlDecisionStatus(
  decision: ControlDecision,
): RuntimeStatusPayload {
  return {
    message: `Stage one selected ${decision.kind}`,
    level: 'info',
    stage: 'routing',
    reason: decision.reason ?? `stage_one_${decision.kind}`,
    source: 'stage_one',
  }
}
