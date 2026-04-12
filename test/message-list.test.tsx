import React from 'react'
import { render } from 'ink-testing-library'
import { describe, expect, it } from 'vitest'
import { MessageList } from '../src/ui/messages/MessageList'
import type { RenderableItem } from '../src/ui/messages/types'

describe('MessageList', () => {
  it('renders one tool step block instead of separate call/result rows', () => {
    const messages: RenderableItem[] = [
      {
        id: 'step-1',
        kind: 'tool_step',
        toolName: 'read',
        title: 'Read package.json',
        status: 'ok',
        summary: 'Read file',
        timestamp: '2026-04-11T00:00:00.000Z',
      },
    ]

    const { lastFrame } = render(
      <MessageList messages={messages} isLoading={false} />,
    )

    expect(lastFrame()).toContain('Read package.json')
    expect(lastFrame()).toContain('ok')
    expect(lastFrame()).toContain('Read file')
    expect(lastFrame()).not.toContain('(package.json)')
    expect(lastFrame()).not.toContain('⎿')
  })

  it('does not rely on a generic thinking spinner when no explicit status message is provided', () => {
    const { lastFrame } = render(<MessageList messages={[]} isLoading={true} />)

    expect(lastFrame()).toContain('Try "summarize this repo" or "read package.json".')
    expect(lastFrame()).not.toContain('● Thinking...')
  })
})
