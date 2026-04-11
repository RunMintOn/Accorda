import React from 'react'
import { render } from 'ink-testing-library'
import { describe, expect, it } from 'vitest'
import { App } from '../src/ui/App'
import type { EventRecord } from '../src/core/contracts'

describe('interactive app', () => {
  it('submits user input and shows assistant output', async () => {
    const events: EventRecord[] = []
    const { stdin, lastFrame } = render(
      <App
        initialEvents={events}
        onSubmit={async text => [
          {
            id: 'evt-user',
            sessionId: 'session-test',
            timestamp: '2026-04-11T00:00:00.000Z',
            type: 'user_message',
            payload: { text },
          },
          {
            id: 'evt-assistant',
            sessionId: 'session-test',
            timestamp: '2026-04-11T00:00:01.000Z',
            type: 'assistant_text',
            payload: { text: `echo: ${text}` },
          },
        ]}
      />,
    )

    await new Promise(resolve => setTimeout(resolve, 20))

    stdin.write('hello')
    stdin.write('\n')

    await new Promise(resolve => setTimeout(resolve, 100))

    expect(lastFrame()).toContain('hello')
    expect(lastFrame()).toContain('echo: hello')
  })
})
