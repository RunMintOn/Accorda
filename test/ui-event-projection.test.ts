import { describe, expect, it } from 'vitest'
import { projectEventsToRenderableItems } from '../src/ui/events/projectRenderableItems'
import type { EventRecord } from '../src/core/contracts'

const base = {
  sessionId: 'session-test',
  timestamp: '2026-04-11T00:00:00.000Z',
}

describe('projectEventsToRenderableItems', () => {
  it('merges tool_call and tool_result into one tool step item', () => {
    const events: EventRecord[] = [
      {
        ...base,
        id: 'evt-call',
        type: 'tool_call',
        payload: {
          toolCallId: 'call-1',
          name: 'read',
          input: { path: 'package.json' },
          layer: 'real',
        },
      },
      {
        ...base,
        id: 'evt-result',
        type: 'tool_result',
        payload: {
          toolCallId: 'call-1',
          name: 'read',
          ok: true,
          output: '{"name":"accorda"}',
        },
      },
    ]

    expect(projectEventsToRenderableItems(events)).toContainEqual({
      id: 'call-1',
      kind: 'tool_step',
      toolName: 'read',
      title: 'Read package.json',
      status: 'ok',
      summary: 'Read file',
      timestamp: base.timestamp,
    })
  })

  it('keeps system status separate from tool step items', () => {
    const events: EventRecord[] = [
      {
        ...base,
        id: 'evt-status',
        type: 'system_status',
        payload: {
          message: 'Routing to execute',
          level: 'info',
          stage: 'routing',
          reason: 'stage_one_execute',
        },
      },
    ]

    expect(projectEventsToRenderableItems(events)).toEqual([
      {
        id: 'evt-status',
        kind: 'system',
        level: 'info',
        message: 'routing: stage_one_execute - Routing to execute',
        timestamp: base.timestamp,
      },
    ])
  })

  it('turns malformed payloads into system warnings', () => {
    const events: EventRecord[] = [
      {
        ...base,
        id: 'evt-bad',
        type: 'tool_call',
        payload: { name: 'read' },
      },
    ]

    expect(projectEventsToRenderableItems(events)).toEqual([
      {
        id: 'evt-bad',
        kind: 'system',
        level: 'warning',
        message: 'Malformed tool_call event: evt-bad',
        timestamp: base.timestamp,
      },
    ])
  })
})
