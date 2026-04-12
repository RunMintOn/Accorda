import { beforeEach, describe, expect, it, vi } from 'vitest'

const { loadConfig, createTextCompletion, createTextCompletionFromBody } =
  vi.hoisted(() => ({
    loadConfig: vi.fn(),
    createTextCompletion: vi.fn(),
    createTextCompletionFromBody: vi.fn(),
  }))

vi.mock('../src/core/config', () => ({
  loadConfig,
}))

vi.mock('../src/provider/openaiClient', () => ({
  createTextCompletion,
  createTextCompletionFromBody,
}))

import { runLocalTurn } from '../src/runtime/defaultRunner'

describe('runLocalTurn', () => {
  beforeEach(() => {
    loadConfig.mockReset()
    createTextCompletion.mockReset()
    createTextCompletionFromBody.mockReset()
    createTextCompletionFromBody.mockImplementation((config, body) =>
      createTextCompletion(config, body.messages),
    )
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
        responsePolicyId: 'default_brief_v1',
        responsePolicyMode: 'appended',
        responseStyle: 'default_brief',
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

  it('appends the default brief policy before sending answer turns to the provider client', async () => {
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

    await runLocalTurn('session-brief', 'hello')

    expect(createTextCompletion).toHaveBeenCalledTimes(1)
    expect(createTextCompletion.mock.calls[0]?.[1].slice(0, 2)).toEqual([
      {
        role: 'system',
        content:
          'You are Accorda, a minimal local coding assistant runtime. Answer concisely and use prior context when useful.',
      },
      {
        role: 'system',
        content: 'Be brief. Lead with the conclusion.',
      },
    ])
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

  it('creates and updates session metadata next to a persisted event log', async () => {
    const { mkdtemp, readFile, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = await mkdtemp(join(tmpdir(), 'accorda-run-session-meta-'))
    const runDir = join(dir, 'session-log')
    const options = {
      eventLogPath: join(runDir, 'events.jsonl'),
      artifactDir: join(runDir, 'artifacts'),
      workspaceRoot: dir,
    }

    vi.useFakeTimers()
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

      vi.setSystemTime(new Date('2026-04-12T00:00:00.000Z'))
      await runLocalTurn('session-log', 'hello', options)
      vi.setSystemTime(new Date('2026-04-12T00:05:00.000Z'))
      await runLocalTurn('session-log', 'again', options)

      expect(
        JSON.parse(await readFile(join(runDir, 'session.json'), 'utf8')),
      ).toMatchObject({
        schemaVersion: 1,
        sessionId: 'session-log',
        createdAt: '2026-04-12T00:00:00.000Z',
        updatedAt: '2026-04-12T00:05:00.000Z',
        workspaceRoot: dir,
        mode: 'normal',
      })
    } finally {
      vi.useRealTimers()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('persists the exact API body and provider response as model call artifacts', async () => {
    const { mkdtemp, readFile, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = await mkdtemp(join(tmpdir(), 'accorda-model-call-'))

    try {
      loadConfig.mockReturnValue({
        provider: {
          baseURL: 'https://example.com/v1',
          apiKey: 'test-key',
          model: 'gpt-4.1-mini',
        },
        workspaceRoot: dir,
      })
      createTextCompletionFromBody.mockResolvedValue({
        text: 'logged answer',
        model: 'gpt-4.1-mini',
        raw: { id: 'completion-1' },
      })

      const events = await runLocalTurn('session-log', 'hello', {
        eventLogPath: join(dir, 'events.jsonl'),
        artifactDir: join(dir, 'artifacts'),
        workspaceRoot: dir,
      })

      const started = events.find(
        event => event.type === 'model_call_started',
      )
      const finished = events.find(
        event => event.type === 'model_call_finished',
      )
      const request = JSON.parse(
        await readFile(String(started?.payload.requestArtifact), 'utf8'),
      )
      const response = JSON.parse(
        await readFile(String(finished?.payload.responseArtifact), 'utf8'),
      )

      expect(request.body).toMatchObject({
        model: 'gpt-4.1-mini',
        messages: expect.any(Array),
      })
      expect(request.body).not.toHaveProperty('apiKey')
      expect(response.body).toMatchObject({
        text: 'logged answer',
        raw: { id: 'completion-1' },
      })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('finishes model call trace events when the provider request fails after the body is recorded', async () => {
    const { mkdtemp, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = await mkdtemp(join(tmpdir(), 'accorda-model-call-error-'))

    try {
      loadConfig.mockReturnValue({
        provider: {
          baseURL: 'https://example.com/v1',
          apiKey: 'test-key',
          model: 'gpt-4.1-mini',
        },
        workspaceRoot: dir,
      })
      createTextCompletionFromBody.mockRejectedValue(
        new Error('Connection error.'),
      )

      const events = await runLocalTurn('session-log', 'hello', {
        eventLogPath: join(dir, 'events.jsonl'),
        artifactDir: join(dir, 'artifacts'),
        workspaceRoot: dir,
      })

      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'model_call_started',
        }),
      )
      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'model_call_finished',
          payload: expect.objectContaining({
            ok: false,
            error: 'Connection error.',
          }),
        }),
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
