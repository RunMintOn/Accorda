import { describe, expect, it } from 'vitest'
import { createRuntimeEngine } from '../src/runtime/engine'

describe('runtime engine', () => {
  it('enters stage two after proceed and returns explicit executing state', async () => {
    const engine = createRuntimeEngine({
      runStageOne: async () => ({
        kind: 'tool',
        name: 'proceed',
        input: {},
        reason: 'stage_one_proceed',
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

    const result = await engine.runTurn('session-1', 'hello')
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
})
