import { describe, expect, it } from 'vitest'
import {
  controlDecisionStatus,
  defaultControlDecision,
} from '../src/runtime/controlDecision'

describe('control decision', () => {
  it('routes explicit tool requests to execute', async () => {
    await expect(
      defaultControlDecision({
        sessionId: 's-1',
        userText: 'read package.json',
      }),
    ).resolves.toEqual({
      kind: 'execute',
      reason: 'stage_one_execute_explicit_request',
    })
  })

  it('routes ordinary explanatory input to answer', async () => {
    await expect(
      defaultControlDecision({
        sessionId: 's-1',
        userText: 'explain this repo briefly',
      }),
    ).resolves.toEqual({
      kind: 'answer',
      reason: 'stage_one_direct_answer',
    })
  })

  it('creates routing status payloads for execute', () => {
    expect(
      controlDecisionStatus({
        kind: 'execute',
        reason: 'stage_one_execute_explicit_request',
      }),
    ).toEqual({
      message: 'Stage one selected execute',
      level: 'info',
      stage: 'routing',
      reason: 'stage_one_execute_explicit_request',
      source: 'stage_one',
    })
  })
})
