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
})
