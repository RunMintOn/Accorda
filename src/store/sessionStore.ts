import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { EventRecord } from '../core/contracts'
import { createEventLogStore } from './eventLogStore'

type CreateSessionStoreOptions = {
  runsDir: string
  sessionId: string
  workspaceRoot: string
  now?: () => Date
}

export function createSessionStore(options: CreateSessionStoreOptions) {
  const now = options.now ?? (() => new Date())
  const runDir = join(options.runsDir, options.sessionId)
  const paths = {
    runDir,
    sessionMetaPath: join(runDir, 'session.json'),
    eventLogPath: join(runDir, 'events.jsonl'),
    artifactsDir: join(runDir, 'artifacts'),
    modelCallsDir: join(runDir, 'artifacts', 'model-calls'),
    toolResultsDir: join(runDir, 'artifacts', 'tool-results'),
  }
  const events = createEventLogStore(paths.eventLogPath)

  return {
    paths,
    async ensureSession() {
      await mkdir(runDir, { recursive: true })
      try {
        await readFile(paths.sessionMetaPath, 'utf8')
        return
      } catch {
        const timestamp = now().toISOString()
        await writeFile(
          paths.sessionMetaPath,
          JSON.stringify(
            {
              schemaVersion: 1,
              sessionId: options.sessionId,
              createdAt: timestamp,
              updatedAt: timestamp,
              workspaceRoot: options.workspaceRoot,
              mode: 'normal',
            },
            null,
            2,
          ),
          'utf8',
        )
      }
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
