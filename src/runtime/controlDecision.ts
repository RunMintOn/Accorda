import type { RuntimeStatusPayload } from '../core/contracts.js'
import { parseReadOnlyToolRequest } from '../tools/readOnly.js'

export type ControlDecision =
  | {
      kind: 'answer'
      reason?: string
    }
  | {
      kind: 'execute'
      reason?: string
    }
  | {
      kind: 'clarify'
      question: string
      reason?: string
    }
  | {
      kind: 'task_mode'
      summary: string
      reason?: string
    }

export type ControlDecisionInput = {
  sessionId: string
  userText: string
}

export type ControlDecisionRunner = (
  input: ControlDecisionInput,
) => Promise<ControlDecision>

export async function defaultControlDecision(
  input: ControlDecisionInput,
): Promise<ControlDecision> {
  if (parseReadOnlyToolRequest(input.userText)) {
    return {
      kind: 'execute',
      reason: 'stage_one_execute_read_only_tool',
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
