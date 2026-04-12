import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { EventRecord } from '../core/contracts'
import { createEventLogStore } from './eventLogStore'

type CreateSessionStoreOptions = {
  runsDir?: string
  runDir?: string
  sessionId: string
  workspaceRoot: string
  now?: () => Date
}

export function createSessionStore(options: CreateSessionStoreOptions) {
  const now = options.now ?? (() => new Date())
  if (!options.runDir && !options.runsDir) {
    throw new Error('Session store requires runDir or runsDir')
  }

  const runDir = options.runDir ?? join(options.runsDir!, options.sessionId)
  const paths = {
    runDir,
    sessionMetaPath: join(runDir, 'session.json'),
    eventLogPath: join(runDir, 'events.jsonl'),
    artifactsDir: join(runDir, 'artifacts'),
    modelCallsDir: join(runDir, 'artifacts', 'model-calls'),
    toolResultsDir: join(runDir, 'artifacts', 'tool-results'),
  }
  const events = createEventLogStore(paths.eventLogPath)

  function createMeta(createdAt: string, updatedAt = createdAt) {
    return {
      schemaVersion: 1,
      sessionId: options.sessionId,
      createdAt,
      updatedAt,
      workspaceRoot: options.workspaceRoot,
      mode: 'normal',
    }
  }

  async function readMeta() {
    try {
      return JSON.parse(await readFile(paths.sessionMetaPath, 'utf8')) as Record<
        string,
        unknown
      >
    } catch {
      return null
    }
  }

  async function writeMeta(meta: Record<string, unknown>) {
    await mkdir(runDir, { recursive: true })
    await writeFile(paths.sessionMetaPath, JSON.stringify(meta, null, 2), 'utf8')
  }

  return {
    paths,
    async ensureSession() {
      await mkdir(runDir, { recursive: true })
      const existing = await readMeta()
      if (existing) {
        return
      }

      const timestamp = now().toISOString()
      await writeMeta(createMeta(timestamp))
    },
    async touchSession() {
      const timestamp = now().toISOString()
      const existing = await readMeta()
      await writeMeta({
        ...createMeta(timestamp),
        ...existing,
        updatedAt: timestamp,
      })
    },
    async appendEvent(event: EventRecord) {
      await events.append(event)
    },
    async readEvents() {
      return events.readAll()
    },
    async writeModelCallArtifact(
      callId: string,
      kind: 'request' | 'response',
      value: unknown,
    ) {
      await mkdir(paths.modelCallsDir, { recursive: true })
      const artifactPath = join(paths.modelCallsDir, `${callId}.${kind}.json`)
      await writeFile(artifactPath, JSON.stringify(value, null, 2), 'utf8')
      return artifactPath
    },
  }
}
