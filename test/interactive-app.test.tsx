import React from 'react'
import { render } from 'ink-testing-library'
import { describe, expect, it } from 'vitest'
import { App } from '../src/ui/App'

describe('interactive app', () => {
  it('submits input on Enter', async () => {
    const submissions: string[] = []
    const { stdin } = render(
      <App
        onSubmit={async text => {
          submissions.push(text)
          return []
        }}
      />,
    )

    await new Promise(resolve => setTimeout(resolve, 0))
    stdin.write('a')
    await new Promise(resolve => setTimeout(resolve, 0))
    stdin.write('\r')

    await new Promise(resolve => setTimeout(resolve, 50))

    expect(submissions).toEqual(['a'])
  })

  it('passes session-scoped storage options to the default submit path', async () => {
    const submissions: Array<{
      text: string
      sessionId: string
      eventLogPath?: string
      artifactDir?: string
      workspaceRoot?: string
    }> = []
    const { stdin } = render(
      <App
        initialSessionId="session-ui"
        onSubmit={async (text, sessionId, options) => {
          submissions.push({
            text,
            sessionId,
            eventLogPath: options.eventLogPath,
            artifactDir: options.artifactDir,
            workspaceRoot: options.workspaceRoot,
          })
          return []
        }}
      />,
    )

    await new Promise(resolve => setTimeout(resolve, 0))
    stdin.write('hello')
    await new Promise(resolve => setTimeout(resolve, 0))
    stdin.write('\r')
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(submissions).toEqual([
      expect.objectContaining({
        text: 'hello',
        sessionId: 'session-ui',
        eventLogPath: expect.stringContaining(
          '.accorda/runs/session-ui/events.jsonl',
        ),
        artifactDir: expect.stringContaining(
          '.accorda/runs/session-ui/artifacts',
        ),
        workspaceRoot: expect.any(String),
      }),
    ])
  })

  it('shows the permission dialog when the latest status is waiting_permission', async () => {
    const { lastFrame } = render(
      <App
        initialEvents={[
          {
            id: 'evt-status',
            sessionId: 'session-ui',
            timestamp: '2026-04-12T00:00:00.000Z',
            type: 'system_status',
            payload: {
              message: 'Waiting for permission',
              level: 'info',
              stage: 'waiting_permission',
              reason: 'execute_waiting_permission',
              toolName: 'write',
              input: { path: 'notes.txt', content: 'hello' },
            },
          },
        ]}
      />,
    )

    expect(lastFrame()).toContain('Permission gate')
    expect(lastFrame()).toContain('write')
  })

  it('hides the permission dialog once a later runtime status leaves waiting_permission', async () => {
    const { lastFrame } = render(
      <App
        initialEvents={[
          {
            id: 'evt-wait',
            sessionId: 'session-ui',
            timestamp: '2026-04-12T00:00:00.000Z',
            type: 'system_status',
            payload: {
              message: 'Waiting for permission',
              level: 'info',
              stage: 'waiting_permission',
              reason: 'execute_waiting_permission',
              toolName: 'bash',
              input: { command: 'uname -a' },
            },
          },
          {
            id: 'evt-next',
            sessionId: 'session-ui',
            timestamp: '2026-04-12T00:00:01.000Z',
            type: 'system_status',
            payload: {
              message: 'Provider answered successfully',
              level: 'info',
              stage: 'executing',
              reason: 'agent_runtime_execute',
              source: 'provider',
            },
          },
        ]}
      />,
    )

    expect(lastFrame()).not.toContain('Permission gate')
  })

  it('submits approval on Enter while waiting for permission', async () => {
    const submissions: string[] = []
    const { stdin } = render(
      <App
        initialEvents={[
          {
            id: 'evt-status',
            sessionId: 'session-ui',
            timestamp: '2026-04-12T00:00:00.000Z',
            type: 'system_status',
            payload: {
              message: 'Waiting for permission',
              level: 'info',
              stage: 'waiting_permission',
              reason: 'execute_waiting_permission',
              toolName: 'bash',
              input: { command: 'uname -a' },
            },
          },
        ]}
        onSubmit={async text => {
          submissions.push(text)
          return []
        }}
      />,
    )

    await new Promise(resolve => setTimeout(resolve, 0))
    stdin.write('\r')
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(submissions).toEqual(['approve'])
  })

  it('submits denial on Esc while waiting for permission', async () => {
    const submissions: string[] = []
    const { stdin } = render(
      <App
        initialEvents={[
          {
            id: 'evt-status',
            sessionId: 'session-ui',
            timestamp: '2026-04-12T00:00:00.000Z',
            type: 'system_status',
            payload: {
              message: 'Waiting for permission',
              level: 'info',
              stage: 'waiting_permission',
              reason: 'execute_waiting_permission',
              toolName: 'bash',
              input: { command: 'uname -a' },
            },
          },
        ]}
        onSubmit={async text => {
          submissions.push(text)
          return []
        }}
      />,
    )

    await new Promise(resolve => setTimeout(resolve, 0))
    stdin.write('\u001b')
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(submissions).toEqual(['deny'])
  })

  it('shows execute step counts in the header status', async () => {
    const { lastFrame } = render(
      <App
        initialEvents={[
          {
            id: 'evt-status',
            sessionId: 'session-ui',
            timestamp: '2026-04-12T00:00:00.000Z',
            type: 'system_status',
            payload: {
              message: 'Provider answered successfully',
              level: 'info',
              stage: 'executing',
              reason: 'agent_runtime_execute',
              source: 'provider',
            },
          },
          {
            id: 'evt-call-1',
            sessionId: 'session-ui',
            timestamp: '2026-04-12T00:00:01.000Z',
            type: 'tool_call',
            payload: {
              toolCallId: 'tool-1',
              name: 'bash',
              input: { command: 'uname -a' },
              layer: 'real',
            },
          },
          {
            id: 'evt-result-1',
            sessionId: 'session-ui',
            timestamp: '2026-04-12T00:00:02.000Z',
            type: 'tool_result',
            payload: {
              toolCallId: 'tool-1',
              name: 'bash',
              ok: true,
              output: { stdout: 'Linux' },
            },
          },
          {
            id: 'evt-call-2',
            sessionId: 'session-ui',
            timestamp: '2026-04-12T00:00:03.000Z',
            type: 'tool_call',
            payload: {
              toolCallId: 'tool-2',
              name: 'bash',
              input: { command: 'free -h' },
              layer: 'real',
            },
          },
        ]}
      />,
    )

    expect(lastFrame()).toContain('steps: 2 total · 1 completed')
  })
})
