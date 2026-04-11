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

function omitUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>
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
        return {
          kind: 'answer',
          text: answer.text || '(empty response)',
          reason: 'stage_one_direct_answer',
          status: {
            message: 'Provider answered successfully',
            level: 'info',
            stage: 'answering',
            reason: 'stage_one_direct_answer',
            source: 'provider',
          },
          metadata: omitUndefined({
            usage: answer.usage,
            model: answer.model,
            finishReason: answer.finishReason,
            toolCalls: answer.toolCalls,
            raw: answer.raw,
          }),
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown provider failure'

        return {
          kind: 'answer',
          text: 'Provider unavailable. Check configuration and try again.',
          reason: 'provider_or_config_error',
          status: {
            message,
            level: 'error',
            stage: 'error',
            reason: 'provider_or_config_error',
            source: message.startsWith('Missing CONTEXTA_') ? 'config' : 'provider',
          },
        }
      }
    },
    runStageTwo: async () => ({ events: [] }),
  })

  const result = await engine.runTurn(sessionId, text)
  if (result.status) {
    events.push(event(sessionId, 'system_status', { ...result.status, ...result.metadata }))
  }
  if (result.finalText) {
    events.push(event(sessionId, 'assistant_text', { text: result.finalText }))
  }

  return events
}
