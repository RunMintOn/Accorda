import { describe, expect, it } from 'vitest'
import type { EventRecord } from '../src/core/contracts'
import {
  listRecentSessions,
  loadSessionEvents,
} from '../src/commands/recentSessions'

describe('recent sessions', () => {
  it('sorts recent sessions by updated time and includes prompt preview', async () => {
    const alphaEvents: EventRecord[] = [
      {
        id: 'evt-user-a',
        sessionId: 'alpha',
        timestamp: '2026-04-12T10:00:00.000Z',
        type: 'user_message',
        payload: { text: 'alpha prompt' },
      },
    ]
    const betaEvents: EventRecord[] = [
      {
        id: 'evt-user-b',
        sessionId: 'beta',
        timestamp: '2026-04-12T11:00:00.000Z',
        type: 'user_message',
        payload: { text: 'beta prompt' },
      },
    ]

    const sessions = await listRecentSessions('/tmp/accorda-runs', {
      listRunDirectories: async () => ['alpha', 'beta'],
      readSessionEvents: async (sessionId: string) =>
        sessionId === 'alpha' ? alphaEvents : betaEvents,
    })

    expect(sessions).toEqual([
      {
        sessionId: 'beta',
        updatedAt: '2026-04-12T11:00:00.000Z',
        preview: 'beta prompt',
      },
      {
        sessionId: 'alpha',
        updatedAt: '2026-04-12T10:00:00.000Z',
        preview: 'alpha prompt',
      },
    ])
  })

  it('loads a session event history from its event log path', async () => {
    const events: EventRecord[] = [
      {
        id: 'evt-user',
        sessionId: 'resume-me',
        timestamp: '2026-04-12T12:00:00.000Z',
        type: 'user_message',
        payload: { text: 'resume this' },
      },
    ]

    expect(
      await loadSessionEvents('/tmp/accorda-runs', 'resume-me', {
        readSessionEvents: async () => events,
      }),
    ).toEqual(events)
  })
})
