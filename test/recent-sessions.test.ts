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

  it('uses the last user message for previews when trace events are present', async () => {
    const events: EventRecord[] = [
      {
        id: 'evt-trace',
        sessionId: 'traced',
        timestamp: '2026-04-12T12:00:00.000Z',
        type: 'model_call_started',
        payload: { callId: 'call-1' },
      },
      {
        id: 'evt-user',
        sessionId: 'traced',
        timestamp: '2026-04-12T12:00:01.000Z',
        type: 'user_message',
        payload: { text: 'real prompt' },
      },
      {
        id: 'evt-finished',
        sessionId: 'traced',
        timestamp: '2026-04-12T12:00:02.000Z',
        type: 'model_call_finished',
        payload: { callId: 'call-1', ok: true },
      },
    ]

    const sessions = await listRecentSessions('/tmp/accorda-runs', {
      listRunDirectories: async () => ['traced'],
      readSessionEvents: async () => events,
    })

    expect(sessions[0]).toMatchObject({
      sessionId: 'traced',
      preview: 'real prompt',
    })
  })
})
