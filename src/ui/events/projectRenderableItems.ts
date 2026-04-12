import type { EventRecord, RuntimeStage, RuntimeStatusLevel } from '../../core/contracts'
import type { RenderableItem } from '../messages/types'
import { projectToolStep } from '../messages/toolProjection'

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

function systemWarning(event: EventRecord, message: string): RenderableItem {
  return {
    id: event.id,
    kind: 'system',
    level: 'warning',
    message,
    timestamp: event.timestamp,
  }
}

function compactList(value: unknown): string {
  if (!Array.isArray(value)) return 'none'
  const strings = value.filter(item => typeof item === 'string')
  return strings.length ? strings.join(', ') : 'none'
}

export function projectEventsToRenderableItems(
  events: EventRecord[],
): RenderableItem[] {
  const items: RenderableItem[] = []
  const toolStepIndex = new Map<string, number>()
  const pendingToolCalls = new Map<
    string,
    {
      name: string
      input: Record<string, unknown>
      timestamp: string
    }
  >()

  for (const event of events) {
    switch (event.type) {
      case 'user_message': {
        const text = textFromPayload(event.payload)
        items.push(
          text === null
            ? systemWarning(event, `Malformed user_message event: ${event.id}`)
            : {
                id: event.id,
                kind: 'user',
                text,
                timestamp: event.timestamp,
              },
        )
        break
      }
      case 'assistant_text': {
        const text = textFromPayload(event.payload)
        items.push(
          text === null
            ? systemWarning(event, `Malformed assistant_text event: ${event.id}`)
            : {
                id: event.id,
                kind: 'assistant',
                text,
                timestamp: event.timestamp,
              },
        )
        break
      }
      case 'system_status': {
        const { message, level, stage, reason } = event.payload
        items.push(
          typeof message !== 'string' ||
            !isRuntimeStatusLevel(level) ||
            !isRuntimeStage(stage) ||
            typeof reason !== 'string'
            ? systemWarning(event, `Malformed system_status event: ${event.id}`)
            : {
                id: event.id,
                kind: 'system',
                message: `${stage}: ${reason} - ${message}`,
                level,
                timestamp: event.timestamp,
              },
        )
        break
      }
      case 'runtime_decision': {
        const { layer, decision, reason } = event.payload
        items.push(
          typeof layer !== 'string' ||
            typeof decision !== 'string' ||
            typeof reason !== 'string'
            ? systemWarning(event, `Malformed runtime_decision event: ${event.id}`)
            : {
                id: event.id,
                kind: 'system',
                level: 'info',
                message: `${layer}: ${reason} - selected ${decision}`,
                timestamp: event.timestamp,
              },
        )
        break
      }
      case 'model_call_started': {
        const { layer, messageCount, toolNames } = event.payload
        items.push({
          id: event.id,
          kind: 'system',
          level: 'info',
          message: `model call ${String(layer ?? 'unknown')}: ${String(messageCount ?? 'unknown')} messages · tools ${compactList(toolNames)}`,
          timestamp: event.timestamp,
        })
        break
      }
      case 'model_call_finished': {
        const { ok, callId } = event.payload
        items.push({
          id: event.id,
          kind: 'system',
          level: ok === false ? 'error' : 'info',
          message: `model call finished: ${String(callId ?? 'unknown')} · ${ok === false ? 'error' : 'ok'}`,
          timestamp: event.timestamp,
        })
        break
      }
      case 'tool_call': {
        const { toolCallId, name, input, layer } = event.payload
        if (
          typeof toolCallId !== 'string' ||
          typeof name !== 'string' ||
          !isRecord(input) ||
          (layer !== 'control' && layer !== 'real')
        ) {
          items.push(systemWarning(event, `Malformed tool_call event: ${event.id}`))
          break
        }

        pendingToolCalls.set(toolCallId, {
          name,
          input,
          timestamp: event.timestamp,
        })

        const projected = projectToolStep({ name, input })
        items.push({
          id: toolCallId,
          kind: 'tool_step',
          toolName: name,
          title: projected.title,
          status: 'running',
          summary: 'running',
          timestamp: event.timestamp,
        })
        toolStepIndex.set(toolCallId, items.length - 1)
        break
      }
      case 'tool_result': {
        const { toolCallId, name, ok, output, error } = event.payload
        if (
          typeof toolCallId !== 'string' ||
          typeof name !== 'string' ||
          typeof ok !== 'boolean' ||
          (error !== undefined && typeof error !== 'string')
        ) {
          items.push(systemWarning(event, `Malformed tool_result event: ${event.id}`))
          break
        }

        const pending = pendingToolCalls.get(toolCallId)
        const projected = projectToolStep({
          name,
          input: pending?.input,
          ok,
          output,
          error,
        })
        const nextItem: RenderableItem = {
          id: toolCallId,
          kind: 'tool_step',
          toolName: name,
          title: projected.title,
          status: ok ? 'ok' : 'error',
          summary: projected.summary,
          timestamp: pending?.timestamp ?? event.timestamp,
        }
        const existingIndex = toolStepIndex.get(toolCallId)

        if (existingIndex === undefined) {
          items.push(nextItem)
        } else {
          items[existingIndex] = nextItem
        }
        break
      }
    }
  }

  return items
}
