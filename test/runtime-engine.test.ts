import { describe, expect, it } from 'vitest'
import { createRuntimeEngine } from '../src/runtime/engine'

describe('runtime engine', () => {
  it('enters stage two after proceed and returns to stage one after tool loop stops', async () => {
    const engine = createRuntimeEngine({
      runStageOne: async () => ({ kind: 'tool', name: 'proceed', input: {} }),
      runStageTwo: async () => ({
        events: [
          { type: 'tool_call', payload: { name: 'read' } },
          { type: 'tool_result', payload: { ok: true } },
          { type: 'assistant_text', payload: { text: 'done' } },
        ],
      }),
    })

    const result = await engine.runTurn('session-1', 'hello')
    expect(result.returnedToStageOne).toBe(true)
  })
})
