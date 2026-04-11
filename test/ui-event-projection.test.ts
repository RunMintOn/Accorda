import { describe, expect, it } from 'vitest'
import { projectEventsToMessages } from '../src/ui/events/projectEvents'
import type { EventRecord } from '../src/core/contracts'

const base = {
  sessionId: 'session-test',
  timestamp: '2026-04-11T00:00:00.000Z',
}

describe('projectEventsToMessages', () => {
  it('projects session events into TUI renderable messages', () => {
    const events: EventRecord[] = [
      {
        ...base,
        id: 'evt-user',
        type: 'user_message',
        payload: { text: 'list files' },
      },
      {
        ...base,
        id: 'evt-tool',
        type: 'tool_call',
        payload: {
          toolCallId: 'call-1',
          name: 'ls',
          input: { path: '.' },
          layer: 'real',
        },
      },
      {
        ...base,
        id: 'evt-result',
        type: 'tool_result',
        payload: {
          toolCallId: 'call-1',
          name: 'ls',
          ok: true,
          output: 'package.json',
        },
      },
      {
        ...base,
        id: 'evt-assistant',
        type: 'assistant_text',
        payload: { text: 'Found package.json.' },
      },
    ]

    expect(projectEventsToMessages(events)).toEqual([
      {
        id: 'evt-user',
        kind: 'user',
        text: 'list files',
        timestamp: base.timestamp,
      },
      {
        id: 'evt-tool',
        kind: 'tool_call',
        toolCallId: 'call-1',
        name: 'ls',
        input: { path: '.' },
        layer: 'real',
        timestamp: base.timestamp,
      },
      {
        id: 'evt-result',
        kind: 'tool_result',
        toolCallId: 'call-1',
        name: 'ls',
        ok: true,
        output: 'package.json',
        timestamp: base.timestamp,
      },
      {
        id: 'evt-assistant',
        kind: 'assistant',
        text: 'Found package.json.',
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

    expect(projectEventsToMessages(events)).toEqual([
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
