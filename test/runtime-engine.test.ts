import { describe, expect, it } from 'vitest'
import { createRuntimeEngine } from '../src/runtime/engine'

describe('runtime engine', () => {
  it('enters stage two after execute and returns explicit executing state', async () => {
    const engine = createRuntimeEngine({
      runStageOne: async () => ({
        kind: 'execute',
        reason: 'stage_one_execute',
      }),
      runStageTwo: async () => ({
        events: [
          { type: 'tool_call', payload: { name: 'read' } },
          { type: 'tool_result', payload: { ok: true } },
          { type: 'assistant_text', payload: { text: 'done' } },
        ],
        finalText: 'done',
        reason: 'entered_execution_layer',
      }),
    })

    const result = await engine.runTurn('session-1', 'read package.json')
    expect(result.returnedToStageOne).toBe(true)
    expect(result.state.stage).toBe('executing')
    expect(result.state.reason).toBe('entered_execution_layer')
    expect(result.finalText).toBe('done')
    expect(result.events).toHaveLength(3)
  })

  it('returns explicit answering state for direct answers', async () => {
    const engine = createRuntimeEngine({
      runStageOne: async () => ({
        kind: 'answer',
        text: 'direct answer',
        reason: 'stage_one_direct_answer',
      }),
      runStageTwo: async () => ({ events: [] }),
    })

    const result = await engine.runTurn('session-1', 'hello')

    expect(result.returnedToStageOne).toBe(false)
    expect(result.state.stage).toBe('answering')
    expect(result.state.reason).toBe('stage_one_direct_answer')
    expect(result.finalText).toBe('direct answer')
  })

  it('returns the clarification question without entering stage two', async () => {
    const engine = createRuntimeEngine({
      runStageOne: async () => ({
        kind: 'clarify',
        question: 'Which file should I inspect?',
        reason: 'stage_one_clarify_request',
      }),
      runStageTwo: async () => {
        throw new Error('stage two should not run')
      },
    })

    const result = await engine.runTurn('session-1', 'check it')

    expect(result.returnedToStageOne).toBe(false)
    expect(result.state.stage).toBe('answering')
    expect(result.state.reason).toBe('stage_one_clarify_request')
    expect(result.finalText).toBe('Which file should I inspect?')
  })

  it('surfaces Task Mode entry without running stage two in this phase', async () => {
    const engine = createRuntimeEngine({
      runStageOne: async () => ({
        kind: 'task_mode',
        summary: 'Investigate failing tests and propose a fix',
        reason: 'stage_one_task_mode',
      }),
      runStageTwo: async () => {
        throw new Error('stage two should not run')
      },
    })

    const result = await engine.runTurn('session-1', 'fix the tests')

    expect(result.returnedToStageOne).toBe(false)
    expect(result.state.stage).toBe('executing')
    expect(result.state.reason).toBe('stage_one_task_mode')
    expect(result.finalText).toBe(
      'Task Mode selected: Investigate failing tests and propose a fix',
    )
  })
})
