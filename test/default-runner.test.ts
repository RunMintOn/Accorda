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
    expect(events[1]).toMatchObject({
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
    expect(events[2]).toMatchObject({
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
    const statusEvent = events.find(event => event.type === 'system_status')

    expect(statusEvent).toBeDefined()
    expect(statusEvent?.payload.stage).toBe('answering')
    expect(statusEvent?.payload).not.toHaveProperty('usage')
  })

  it('surfaces config failures as explicit error status instead of echo fallback', async () => {
    loadConfig.mockImplementation(() => {
      throw new Error('Missing CONTEXTA_API_KEY')
    })

    const events = await runLocalTurn('session-1', 'hello')

    expect(events[1]).toMatchObject({
      type: 'system_status',
      payload: {
        stage: 'error',
        reason: 'provider_or_config_error',
        source: 'config',
        level: 'error',
        message: 'Missing CONTEXTA_API_KEY',
      },
    })
    expect(events[2]).toMatchObject({
      type: 'assistant_text',
      payload: {
        text: 'Provider unavailable. Check configuration and try again.',
      },
    })
    expect(events[2]?.payload).not.toEqual({ text: 'echo: hello' })
  })
})
