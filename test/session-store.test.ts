import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSessionStore } from '../src/store/sessionStore'

describe('session store', () => {
  it('owns session paths, metadata, event log, and artifacts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'accorda-session-store-'))
    try {
      const store = createSessionStore({
        runsDir: join(root, '.accorda', 'runs'),
        sessionId: 'session-a',
        workspaceRoot: root,
        now: () => new Date('2026-04-12T00:00:00.000Z'),
      })

      await store.ensureSession()
      await store.appendEvent({
        id: 'evt-1',
        sessionId: 'session-a',
        timestamp: '2026-04-12T00:00:00.000Z',
        type: 'user_message',
        payload: { text: 'hello' },
      })
      const artifactPath = await store.writeModelCallArtifact(
        'call-1',
        'request',
        { body: { model: 'test-model', messages: [] } },
      )

      expect(store.paths.eventLogPath).toBe(
        join(root, '.accorda', 'runs', 'session-a', 'events.jsonl'),
      )
      expect(
        JSON.parse(await readFile(store.paths.sessionMetaPath, 'utf8')),
      ).toMatchObject({
        schemaVersion: 1,
        sessionId: 'session-a',
        workspaceRoot: root,
        mode: 'normal',
      })
      expect(await readFile(store.paths.eventLogPath, 'utf8')).toContain(
        '"type":"user_message"',
      )
      expect(JSON.parse(await readFile(artifactPath, 'utf8'))).toMatchObject({
        body: { model: 'test-model', messages: [] },
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('persists pending execute state in session metadata', async () => {
    const root = await mkdtemp(join(tmpdir(), 'accorda-session-store-'))
    try {
      const store = createSessionStore({
        runsDir: join(root, '.accorda', 'runs'),
        sessionId: 'session-a',
        workspaceRoot: root,
        now: () => new Date('2026-04-12T00:00:00.000Z'),
      })

      await store.ensureSession()
      await store.savePendingExecute({
        status: 'waiting_user',
      })

      expect(await store.readPendingExecute()).toEqual({
        status: 'waiting_user',
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
