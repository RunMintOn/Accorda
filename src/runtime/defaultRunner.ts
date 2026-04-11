import { randomUUID } from 'node:crypto'
import { loadConfig } from '../core/config'
import type { EventRecord } from '../core/contracts'
import { createTextCompletion } from '../provider/openaiClient'
import { createRuntimeEngine } from './engine'

function event(
  sessionId: string,
  type: EventRecord['type'],
  payload: Record<string, unknown>,
): EventRecord {
  return {
    id: randomUUID(),
    sessionId,
    timestamp: new Date().toISOString(),
    type,
    payload,
  }
}

export async function runLocalTurn(
  sessionId: string,
  text: string,
): Promise<EventRecord[]> {
  const events: EventRecord[] = [
    event(sessionId, 'user_message', { text }),
  ]

  const engine = createRuntimeEngine({
    runStageOne: async () => {
      try {
        const config = loadConfig()
        const answer = await createTextCompletion(config, [
          {
            role: 'system',
            content:
              'You are Accorda, a minimal CLI coding assistant. Answer concisely.',
          },
          { role: 'user', content: text },
        ])
        return { kind: 'answer', text: answer || '(empty response)' }
      } catch {
        return { kind: 'answer', text: `echo: ${text}` }
      }
    },
    runStageTwo: async () => ({ events: [] }),
  })

  const result = await engine.runTurn(sessionId, text)
  if (result.finalText) {
    events.push(event(sessionId, 'assistant_text', { text: result.finalText }))
  }

  return events
}
