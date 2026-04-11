import { beforeEach, describe, expect, it, vi } from 'vitest'

const { loadConfig, createTextCompletion } = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  createTextCompletion: vi.fn(),
}))

vi.mock('../src/core/config', () => ({
  loadConfig,
}))

vi.mock('../src/provider/openaiClient', () => ({
  createTextCompletion,
}))

import { runLocalTurn } from '../src/runtime/defaultRunner'

describe('runLocalTurn', () => {
  beforeEach(() => {
    loadConfig.mockReset()
    createTextCompletion.mockReset()
  })

  it('preserves provider metadata in system status events when usage is present', async () => {
    loadConfig.mockReturnValue({
      provider: {
        baseURL: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'gpt-4.1-mini',
      },
      workspaceRoot: '/tmp/workspace',
    })
    createTextCompletion.mockResolvedValue({
      text: 'hello back',
      usage: {
        inputTokens: 10,
        outputTokens: 4,
        totalTokens: 14,
      },
      model: 'gpt-4.1-mini',
      finishReason: 'stop',
      raw: { id: 'raw-completion' },
    })

    const events = await runLocalTurn('session-1', 'hello')

    expect(events[0]).toMatchObject({
      type: 'user_message',
      payload: { text: 'hello' },
    })
    const providerStatus = events.find(
      event =>
        event.type === 'system_status' && event.payload.source === 'provider',
    )
    expect(providerStatus).toMatchObject({
      type: 'system_status',
      payload: {
        stage: 'answering',
        reason: 'stage_one_direct_answer',
        source: 'provider',
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
        },
        model: 'gpt-4.1-mini',
        finishReason: 'stop',
      },
    })
    expect(events.at(-1)).toMatchObject({
      type: 'assistant_text',
      payload: { text: 'hello back' },
    })
  })

  it('keeps working when provider usage metadata is absent', async () => {
    loadConfig.mockReturnValue({
      provider: {
        baseURL: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'gpt-4.1-mini',
      },
      workspaceRoot: '/tmp/workspace',
    })
    createTextCompletion.mockResolvedValue({
      text: 'hello back',
      model: 'gpt-4.1-mini',
    })

    const events = await runLocalTurn('session-1', 'hello')
    const statusEvent = events.find(
      event =>
        event.type === 'system_status' && event.payload.source === 'provider',
    )

    expect(statusEvent).toBeDefined()
    expect(statusEvent?.payload.stage).toBe('answering')
    expect(statusEvent?.payload).not.toHaveProperty('usage')
  })

  it('surfaces config failures as explicit error status instead of echo fallback', async () => {
    loadConfig.mockImplementation(() => {
      throw new Error('Missing CONTEXTA_API_KEY')
    })

    const events = await runLocalTurn('session-1', 'hello')
    const configStatus = events.find(
      event =>
        event.type === 'system_status' && event.payload.source === 'config',
    )
    const answer = events.find(event => event.type === 'assistant_text')

    expect(configStatus).toMatchObject({
      type: 'system_status',
      payload: {
        stage: 'error',
        reason: 'provider_or_config_error',
        source: 'config',
        level: 'error',
        message: 'Missing CONTEXTA_API_KEY',
      },
    })
    expect(answer).toMatchObject({
      type: 'assistant_text',
      payload: {
        text: 'Provider unavailable. Check configuration and try again.',
      },
    })
    expect(answer?.payload).not.toEqual({ text: 'echo: hello' })
  })

  it('persists events to a caller-provided event log path', async () => {
    const { mkdtemp, readFile, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = await mkdtemp(join(tmpdir(), 'accorda-run-local-turn-'))

    try {
      loadConfig.mockReturnValue({
        provider: {
          baseURL: 'https://example.com/v1',
          apiKey: 'test-key',
          model: 'gpt-4.1-mini',
        },
        workspaceRoot: dir,
      })
      createTextCompletion.mockResolvedValue({
        text: 'logged answer',
        model: 'gpt-4.1-mini',
      })

      const eventLogPath = join(dir, 'events.jsonl')
      const events = await runLocalTurn('session-log', 'hello', {
        eventLogPath,
        artifactDir: join(dir, 'artifacts'),
        workspaceRoot: dir,
      })

      const raw = await readFile(eventLogPath, 'utf8')
      const persisted = raw
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line))

      expect(persisted.map(event => event.type)).toEqual(
        events.map(event => event.type),
      )
      expect(persisted[0]).toMatchObject({
        sessionId: 'session-log',
        type: 'user_message',
        payload: { text: 'hello' },
      })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
