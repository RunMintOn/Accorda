import type { RuntimeStage, RuntimeStatusLevel } from '../../core/contracts'
import type { EventRecord } from '../../core/contracts'
import type { RenderableMessage } from '../messages/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textFromPayload(payload: Record<string, unknown>): string | null {
  return typeof payload.text === 'string' ? payload.text : null
}

function isRuntimeStage(value: unknown): value is RuntimeStage {
  return (
    value === 'idle' ||
    value === 'routing' ||
    value === 'answering' ||
    value === 'executing' ||
    value === 'waiting_permission' ||
    value === 'error'
  )
}

function isRuntimeStatusLevel(value: unknown): value is RuntimeStatusLevel {
  return value === 'info' || value === 'warning' || value === 'error'
}

function systemWarning(event: EventRecord, message: string): RenderableMessage {
  return {
    id: event.id,
    kind: 'system',
    level: 'warning',
    message,
    timestamp: event.timestamp,
  }
}

export function projectEventsToMessages(
  events: EventRecord[],
): RenderableMessage[] {
  return events.map(event => {
    switch (event.type) {
      case 'user_message': {
        const text = textFromPayload(event.payload)
        if (text === null) {
          return systemWarning(event, `Malformed user_message event: ${event.id}`)
        }
        return {
          id: event.id,
          kind: 'user',
          text,
          timestamp: event.timestamp,
        }
      }
      case 'assistant_text': {
        const text = textFromPayload(event.payload)
        if (text === null) {
          return systemWarning(
            event,
            `Malformed assistant_text event: ${event.id}`,
          )
        }
        return {
          id: event.id,
          kind: 'assistant',
          text,
          timestamp: event.timestamp,
        }
      }
      case 'tool_call': {
        const { toolCallId, name, input, layer } = event.payload
        if (
          typeof toolCallId !== 'string' ||
          typeof name !== 'string' ||
          !isRecord(input) ||
          (layer !== 'control' && layer !== 'real')
        ) {
          return systemWarning(event, `Malformed tool_call event: ${event.id}`)
        }
        return {
          id: event.id,
          kind: 'tool_call',
          toolCallId,
          name,
          input,
          layer,
          timestamp: event.timestamp,
        }
      }
      case 'tool_result': {
        const { toolCallId, name, ok, output, error } = event.payload
        if (
          typeof toolCallId !== 'string' ||
          typeof name !== 'string' ||
          typeof ok !== 'boolean' ||
          (error !== undefined && typeof error !== 'string')
        ) {
          return systemWarning(event, `Malformed tool_result event: ${event.id}`)
        }
        return {
          id: event.id,
          kind: 'tool_result',
          toolCallId,
          name,
          ok,
          output,
          error,
          timestamp: event.timestamp,
        }
      }
      case 'system_status': {
        const { message, level, stage, reason } = event.payload
        if (
          typeof message !== 'string' ||
          !isRuntimeStatusLevel(level) ||
          !isRuntimeStage(stage) ||
          typeof reason !== 'string'
        ) {
          return systemWarning(
            event,
            `Malformed system_status event: ${event.id}`,
          )
        }
        return {
          id: event.id,
          kind: 'system',
          message: `${stage}: ${reason} - ${message}`,
          level,
          timestamp: event.timestamp,
        }
      }
    }
  })
}
