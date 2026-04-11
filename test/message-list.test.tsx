import React from 'react'
import { render } from 'ink-testing-library'
import { describe, expect, it } from 'vitest'
import { MessageList } from '../src/ui/messages/MessageList'
import type { RenderableMessage } from '../src/ui/messages/types'

describe('MessageList', () => {
  it('renders user, assistant, tool call, and tool result messages', () => {
    const messages: RenderableMessage[] = [
      {
        id: 'm1',
        kind: 'user',
        text: 'read package',
        timestamp: '2026-04-11T00:00:00.000Z',
      },
      {
        id: 'm2',
        kind: 'tool_call',
        toolCallId: 'call-1',
        name: 'read',
        input: { path: 'package.json' },
        layer: 'real',
        timestamp: '2026-04-11T00:00:01.000Z',
      },
      {
        id: 'm3',
        kind: 'tool_result',
        toolCallId: 'call-1',
        name: 'read',
        ok: true,
        output: 'ok',
        timestamp: '2026-04-11T00:00:02.000Z',
      },
      {
        id: 'm4',
        kind: 'assistant',
        text: 'package read',
        timestamp: '2026-04-11T00:00:03.000Z',
      },
    ]

    const { lastFrame } = render(
      <MessageList messages={messages} isLoading={false} />,
    )

    expect(lastFrame()).toContain('> read package')
    expect(lastFrame()).toContain('● read')
    expect(lastFrame()).toContain('(package.json)')
    expect(lastFrame()).toContain('⎿  ok')
    expect(lastFrame()).toContain('● package read')
    expect(lastFrame()).not.toContain('Tool read')
    expect(lastFrame()).not.toContain('Done read')
  })
})
