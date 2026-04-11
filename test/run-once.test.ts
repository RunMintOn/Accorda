import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseRunOnceArgs, runOnce } from '../src/cli/runOnce'

describe('run-once cli', () => {
  it('parses prompt and output paths', () => {
    const parsed = parseRunOnceArgs([
      '--session',
      'session-1',
      '--event-log',
      '/tmp/events.jsonl',
      '--artifact-dir',
      '/tmp/artifacts',
      'summarize this project',
    ])

    expect(parsed).toEqual({
      prompt: 'summarize this project',
      sessionId: 'session-1',
      eventLogPath: '/tmp/events.jsonl',
      artifactDir: '/tmp/artifacts',
    })
  })

  it('runs one prompt and prints a machine-readable summary', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'accorda-run-once-'))
    const writes: string[] = []

    try {
      const exitCode = await runOnce(
        [
          '--session',
          'session-1',
          '--event-log',
          join(dir, 'events.jsonl'),
          '--artifact-dir',
          join(dir, 'artifacts'),
          'hello',
        ],
        {
          runLocalTurn: async (sessionId, text, options) => [
            {
              id: 'evt-1',
              sessionId,
              timestamp: '2026-04-12T00:00:00.000Z',
              type: 'assistant_text',
              payload: { text, eventLogPath: options.eventLogPath },
            },
          ],
          stdout: value => writes.push(value),
          stderr: value => writes.push(`ERR:${value}`),
        },
      )

      expect(exitCode).toBe(0)
      expect(JSON.parse(writes[0])).toMatchObject({
        sessionId: 'session-1',
        eventLogPath: join(dir, 'events.jsonl'),
        eventCount: 1,
        finalText: 'hello',
      })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
