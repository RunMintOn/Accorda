import { rm } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { createEventLogStore } from '../src/store/eventLogStore'

const TEST_PATH = '/tmp/accorda-test-events.jsonl'

describe('event log store', () => {
  it('appends v1 events without overwriting old history', async () => {
    await rm(TEST_PATH, { force: true })

    const store = createEventLogStore(TEST_PATH)

    await store.append({
      id: 'evt-1',
      sessionId: 'session-1',
      timestamp: '2026-04-10T00:00:00.000Z',
      type: 'user_message',
      payload: { text: 'hello' },
    })

    await store.append({
      id: 'evt-2',
      sessionId: 'session-1',
      timestamp: '2026-04-10T00:00:01.000Z',
      type: 'assistant_text',
      payload: { text: 'world' },
    })

    const events = await store.readAll()
    expect(events.map(event => event.type)).toEqual([
      'user_message',
      'assistant_text',
    ])
  })
})
