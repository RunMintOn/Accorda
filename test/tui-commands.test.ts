import { describe, expect, it } from 'vitest'
import type { EventRecord } from '../src/core/contracts'
import { matchSlashCommands, resolveTuiCommand } from '../src/ui/tuiCommands'

describe('resolveTuiCommand', () => {
  const now = () => new Date('2026-04-12T13:00:00.000Z')

  it('returns help text for /help', async () => {
    const result = await resolveTuiCommand('/help', 'session-a', { kind: 'compose' }, {
      runsDir: '/tmp/runs',
      now,
    })

    expect(result.kind).toBe('show_help')
    expect(result.kind === 'show_help' ? result.event.payload.text : '').toContain('/resume')
  })

  it('creates a new session for /new', async () => {
    const result = await resolveTuiCommand('/new', 'session-a', { kind: 'compose' }, {
      runsDir: '/tmp/runs',
      now,
    })

    expect(result).toEqual({
      kind: 'new_session',
      sessionId: 'session-2026-04-12T13-00-00-000Z',
    })
  })

  it('shows recent sessions for /resume', async () => {
    const result = await resolveTuiCommand('/resume', 'session-a', { kind: 'compose' }, {
      runsDir: '/tmp/runs',
      now,
      listRecentSessions: async () => [
        {
          sessionId: 'resume-me',
          updatedAt: '2026-04-12T12:00:00.000Z',
          preview: 'restore this one',
        },
      ],
    })

    expect(result.kind).toBe('resume_prompt')
    if (result.kind !== 'resume_prompt') return
    expect(result.event.payload.text).toContain('1. resume-me')
    expect(result.mode.kind).toBe('resume_select')
  })

  it('loads a selected session while in resume mode', async () => {
    const events: EventRecord[] = [
      {
        id: 'evt-restored',
        sessionId: 'resume-me',
        timestamp: '2026-04-12T12:00:00.000Z',
        type: 'user_message',
        payload: { text: 'restore this one' },
      },
    ]

    const result = await resolveTuiCommand(
      '1',
      'session-a',
      {
        kind: 'resume_select',
        sessions: [
          {
            sessionId: 'resume-me',
            updatedAt: '2026-04-12T12:00:00.000Z',
            preview: 'restore this one',
          },
        ],
      },
      {
        runsDir: '/tmp/runs',
        now,
        loadSessionEvents: async () => events,
      },
    )

    expect(result).toEqual({
      kind: 'resume_loaded',
      sessionId: 'resume-me',
      events,
      mode: { kind: 'compose' },
    })
  })
})

describe('matchSlashCommands', () => {
  it('returns slash candidates immediately when input starts with slash text', () => {
    expect(matchSlashCommands('/')).toEqual([
      { name: 'new', description: 'start a new session' },
      { name: 'resume', description: 'resume a recent session' },
      { name: 'help', description: 'show available commands' },
    ])

    expect(matchSlashCommands('/re')).toEqual([
      { name: 'resume', description: 'resume a recent session' },
    ])
  })
})
