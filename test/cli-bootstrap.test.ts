import { describe, expect, it, vi } from 'vitest'
import type { EventRecord } from '../src/core/contracts'
import { runCli } from '../src/cli/bootstrap'

describe('runCli', () => {
  it('prints help and exits for --help', async () => {
    const stdout: string[] = []

    const code = await runCli(['--help'], {
      stdout: value => stdout.push(value),
      renderApp: () => ({ waitUntilExit: async () => {} }),
    })

    expect(code).toBe(0)
    expect(stdout.join('\n')).toContain('--resume')
  })

  it('loads a resumed session before rendering for --resume', async () => {
    const renderApp = vi.fn(() => ({ waitUntilExit: async () => {} }))

    await runCli(['--resume'], {
      stdout: () => {},
      stdinSelect: async () => '1',
      listRecentSessions: async () => [
        {
          sessionId: 'resume-me',
          updatedAt: '2026-04-12T12:00:00.000Z',
          preview: 'resume this',
        },
      ],
      loadSessionEvents: async (): Promise<EventRecord[]> => [
        {
          id: 'evt-user',
          sessionId: 'resume-me',
          timestamp: '2026-04-12T12:00:00.000Z',
          type: 'user_message',
          payload: { text: 'resume this' },
        },
      ],
      renderApp,
    })

    expect(renderApp).toHaveBeenCalledWith({
      initialEvents: [
        {
          id: 'evt-user',
          sessionId: 'resume-me',
          timestamp: '2026-04-12T12:00:00.000Z',
          type: 'user_message',
          payload: { text: 'resume this' },
        },
      ],
      initialSessionId: 'resume-me',
    })
  })
})
