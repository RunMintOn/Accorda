import { describe, expect, it } from 'vitest'
import {
  controlDecisionStatus,
  defaultControlDecision,
} from '../src/runtime/controlDecision'

describe('control decision', () => {
  it('routes explicit read-only tool requests to execute', async () => {
    await expect(
      defaultControlDecision({
        sessionId: 's-1',
        userText: 'read package.json',
      }),
    ).resolves.toEqual({
      kind: 'execute',
      reason: 'stage_one_execute_read_only_tool',
    })
  })

  it('routes ordinary input to direct answer', async () => {
    await expect(
      defaultControlDecision({
        sessionId: 's-1',
        userText: 'explain the project briefly',
      }),
    ).resolves.toEqual({
      kind: 'answer',
      reason: 'stage_one_direct_answer',
    })
  })

  it('creates routing status payloads for visible event logs', () => {
    expect(
      controlDecisionStatus({
        kind: 'clarify',
        question: 'Which file should I inspect?',
        reason: 'stage_one_clarify_request',
      }),
    ).toEqual({
      message: 'Stage one selected clarify',
      level: 'info',
      stage: 'routing',
      reason: 'stage_one_clarify_request',
      source: 'stage_one',
    })
  })
})
