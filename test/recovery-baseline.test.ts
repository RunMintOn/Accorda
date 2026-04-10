import { rm } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { createEventLogStore } from '../src/store/eventLogStore'

const TEST_PATH = '/tmp/accorda-recovery.jsonl'

describe('recovery baseline', () => {
  it('can reload prior history after a process restart', async () => {
    await rm(TEST_PATH, { force: true })

    const store = createEventLogStore(TEST_PATH)

    await store.append({
      id: 'evt-1',
      sessionId: 'session-1',
      timestamp: '2026-04-10T00:00:00.000Z',
      type: 'user_message',
      payload: { text: 'hello' },
    })

    const reloaded = createEventLogStore(TEST_PATH)
    const events = await reloaded.readAll()

    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe('user_message')
  })
})
