import React from 'react'
import { render } from 'ink-testing-library'
import { describe, expect, it } from 'vitest'
import { App } from '../src/ui/App'
import type { EventRecord } from '../src/core/contracts'

describe('interactive app', () => {
  it('shows the Claude-like shell with Accorda status lines and tool steps', async () => {
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
          {
            id: 'evt-status',
            sessionId: 'session-test',
            timestamp: '2026-04-11T00:00:01.500Z',
            type: 'system_status',
            payload: {
              message: 'Provider answered successfully',
              level: 'info',
              stage: 'answering',
              reason: 'stage_one_direct_answer',
              source: 'provider',
              model: 'gpt-4.1-mini',
            },
          },
          {
            id: 'evt-tool',
            sessionId: 'session-test',
            timestamp: '2026-04-11T00:00:02.000Z',
            type: 'tool_call',
            payload: {
              toolCallId: 'call-1',
              name: 'read',
              input: { path: 'package.json' },
              layer: 'real',
            },
          },
          {
            id: 'evt-tool-result',
            sessionId: 'session-test',
            timestamp: '2026-04-11T00:00:03.000Z',
            type: 'tool_result',
            payload: {
              toolCallId: 'call-1',
              name: 'read',
              ok: true,
              output: 'package.json',
            },
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
    expect(lastFrame()).toContain('Accorda Code')
    expect(lastFrame()).toContain('Tips for getting started')
    expect(lastFrame()).toContain('Recent activity')
    expect(lastFrame()).toContain('status: answering')
    expect(lastFrame()).toContain('stage_one_direct_answer')
    expect(lastFrame()).toContain('source: provider')
    expect(lastFrame()).toContain('Read package.json')
    expect(lastFrame()).toContain('ok')
    expect(lastFrame()).toContain('Read file')
    expect(lastFrame()).not.toContain('Permission gate')
    expect(lastFrame()).not.toContain('No pending permission request.')
    expect(lastFrame()).toContain('Try "create a util logging.py that..."')
    expect(lastFrame()).not.toContain('Ask Accorda to work on this codebase')
  })
})
