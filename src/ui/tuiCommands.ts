import type { EventRecord } from '../core/contracts'
import { COMMANDS, commandHelpLines } from '../commands/registry'
import {
  listRecentSessions,
  loadSessionEvents,
  type RecentSessionSummary,
} from '../commands/recentSessions'

export type AppMode =
  | { kind: 'compose' }
  | { kind: 'resume_select'; sessions: RecentSessionSummary[] }

type TuiCommandDeps = {
  runsDir: string
  listRecentSessions?: typeof listRecentSessions
  loadSessionEvents?: typeof loadSessionEvents
  now?: () => Date
}

export type TuiCommandResult =
  | { kind: 'not_handled' }
  | { kind: 'show_help'; event: EventRecord }
  | { kind: 'new_session'; sessionId: string }
  | { kind: 'resume_prompt'; mode: AppMode; event: EventRecord }
  | { kind: 'resume_loaded'; sessionId: string; events: EventRecord[]; mode: AppMode }
  | { kind: 'resume_invalid'; event: EventRecord }

export type SlashCandidate = {
  name: string
  description: string
}

function createSessionId(now: Date = new Date()) {
  return `session-${now.toISOString().replace(/[:.]/g, '-')}`
}

function helpEvent(sessionId: string, now: Date): EventRecord {
  return {
    id: `evt-help-${now.getTime()}`,
    sessionId,
    timestamp: now.toISOString(),
    type: 'assistant_text',
    payload: { text: commandHelpLines('tui').join('\n') },
  }
}

function resumeListEvent(
  sessionId: string,
  sessions: RecentSessionSummary[],
  now: Date,
): EventRecord {
  return {
    id: `evt-resume-${now.getTime()}`,
    sessionId,
    timestamp: now.toISOString(),
    type: 'assistant_text',
    payload: {
      text: sessions.length
        ? sessions
            .map(
              (item, index) =>
                `${index + 1}. ${item.sessionId}  ${item.preview}`.trimEnd(),
            )
            .join('\n')
        : 'No resumable sessions found.',
    },
  }
}

function invalidResumeEvent(sessionId: string, now: Date): EventRecord {
  return {
    id: `evt-invalid-resume-${now.getTime()}`,
    sessionId,
    timestamp: now.toISOString(),
    type: 'system_status',
    payload: {
      message: 'Invalid resume selection',
      level: 'error',
      stage: 'error',
      reason: 'invalid_resume_selection',
    },
  }
}

export function matchSlashCommands(input: string): SlashCandidate[] {
  if (!input.startsWith('/')) return []

  const query = input.slice(1).trim().toLowerCase()
  return COMMANDS.filter(command =>
    command.tuiSyntax.slice(1).startsWith(query),
  ).map(command => ({
    name: command.name,
    description: command.description,
  }))
}

export async function resolveTuiCommand(
  text: string,
  sessionId: string,
  mode: AppMode,
  deps: TuiCommandDeps,
): Promise<TuiCommandResult> {
  const now = deps.now?.() ?? new Date()
  const listRecentSessionsImpl = deps.listRecentSessions ?? listRecentSessions
  const loadSessionEventsImpl = deps.loadSessionEvents ?? loadSessionEvents
  const trimmed = text.trim()

  if (mode.kind === 'resume_select') {
    const index = Number.parseInt(trimmed, 10) - 1
    const selected = mode.sessions[index]

    if (!selected) {
      return {
        kind: 'resume_invalid',
        event: invalidResumeEvent(sessionId, now),
      }
    }

    const events = await loadSessionEventsImpl(deps.runsDir, selected.sessionId)
    return {
      kind: 'resume_loaded',
      sessionId: selected.sessionId,
      events,
      mode: { kind: 'compose' },
    }
  }

  if (trimmed === '/help') {
    return {
      kind: 'show_help',
      event: helpEvent(sessionId, now),
    }
  }

  if (trimmed === '/new') {
    return {
      kind: 'new_session',
      sessionId: createSessionId(now),
    }
  }

  if (trimmed === '/resume') {
    const sessions = await listRecentSessionsImpl(deps.runsDir)
    return {
      kind: 'resume_prompt',
      mode: sessions.length ? { kind: 'resume_select', sessions } : { kind: 'compose' },
      event: resumeListEvent(sessionId, sessions, now),
    }
  }

  return { kind: 'not_handled' }
}
