import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { EventRecord } from '../core/contracts'
import { createEventLogStore } from '../store/eventLogStore'

export type RecentSessionSummary = {
  sessionId: string
  updatedAt: string
  preview: string
}

type RecentSessionDeps = {
  listRunDirectories?: (runsDir: string) => Promise<string[]>
  readSessionEvents?: (
    sessionId: string,
    eventLogPath: string,
  ) => Promise<EventRecord[]>
}

async function defaultListRunDirectories(runsDir: string) {
  try {
    return await readdir(runsDir)
  } catch {
    return []
  }
}

async function defaultReadSessionEvents(
  _sessionId: string,
  eventLogPath: string,
) {
  return createEventLogStore(eventLogPath).readAll()
}

function latestTimestamp(events: EventRecord[]): string {
  return [...events]
    .reverse()
    .find(event => typeof event.timestamp === 'string')?.timestamp ?? ''
}

function lastUserPreview(events: EventRecord[]): string {
  const text = [...events]
    .reverse()
    .find(event => event.type === 'user_message')?.payload.text
  return typeof text === 'string' ? text : ''
}

export async function listRecentSessions(
  runsDir: string,
  deps: RecentSessionDeps = {},
): Promise<RecentSessionSummary[]> {
  const listRunDirectories = deps.listRunDirectories ?? defaultListRunDirectories
  const readSessionEvents = deps.readSessionEvents ?? defaultReadSessionEvents
  const sessionIds = await listRunDirectories(runsDir)

  const summaries = await Promise.all(
    sessionIds.map(async sessionId => {
      const eventLogPath = join(runsDir, sessionId, 'events.jsonl')
      const events = await readSessionEvents(sessionId, eventLogPath)
      return {
        sessionId,
        updatedAt: latestTimestamp(events),
        preview: lastUserPreview(events),
      }
    }),
  )

  return summaries
    .filter(summary => summary.updatedAt)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function loadSessionEvents(
  runsDir: string,
  sessionId: string,
  deps: RecentSessionDeps = {},
): Promise<EventRecord[]> {
  const readSessionEvents = deps.readSessionEvents ?? defaultReadSessionEvents
  return readSessionEvents(sessionId, join(runsDir, sessionId, 'events.jsonl'))
}
