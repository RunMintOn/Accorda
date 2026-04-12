import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createAgentRuntime } from '../src/runtime/agentRuntime'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function tempRuntimeDir() {
  return mkdtemp(join(tmpdir(), 'accorda-runtime-'))
}

describe('agent runtime', () => {
  it('serializes concurrent user turns through a queue', async () => {
    const order: string[] = []
    const runtime = createAgentRuntime({
      provider: async ({ messages }) => {
        const lastUser = [...messages]
          .reverse()
          .find(message => message.role === 'user')?.content

        order.push(`start:${lastUser}`)
        if (lastUser === 'first') await delay(20)
        order.push(`finish:${lastUser}`)

        return { text: `done:${lastUser}` }
      },
    })

    await Promise.all([runtime.run('first'), runtime.run('second')])

    expect(order).toEqual([
      'start:first',
      'finish:first',
      'start:second',
      'finish:second',
    ])
  })

  it('shares prior user and assistant context with later provider calls', async () => {
    const calls: string[][] = []
    const runtime = createAgentRuntime({
      provider: async ({ messages }) => {
        calls.push(messages.map(message => `${message.role}:${message.content}`))
        const lastUser = [...messages]
          .reverse()
          .find(message => message.role === 'user')?.content
        return { text: `reply:${lastUser}` }
      },
    })

    await runtime.run('first question')
    await runtime.run('second question')

    expect(calls[1]).toContain('user:first question')
    expect(calls[1]).toContain('assistant:reply:first question')
    expect(calls[1]).toContain('user:second question')
  })

  it('appends the default brief policy for answer turns and records provider metadata', async () => {
    const calls: string[][] = []
    const runtime = createAgentRuntime({
      provider: async ({ messages }) => {
        calls.push(messages.map(message => `${message.role}:${message.content}`))
        return { text: 'hello back' }
      },
    })

    const events = await runtime.run('hello')

    expect(calls[0]?.slice(0, 2)).toEqual([
      'system:You are Accorda, a minimal local coding assistant runtime. Answer concisely and use prior context when useful.',
      'system:Be brief. Lead with the conclusion.',
    ])
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'system_status',
        payload: expect.objectContaining({
          source: 'provider',
          responsePolicyId: 'default_brief_v1',
          responsePolicyMode: 'appended',
          responseStyle: 'default_brief',
        }),
      }),
    )
  })

  it('emits a runtime_decision event for the stage one choice', async () => {
    const runtime = createAgentRuntime({
      controlDecision: async () => ({
        kind: 'answer',
        reason: 'stage_one_direct_answer',
      }),
      provider: async () => ({ text: 'direct answer' }),
    })

    const events = await runtime.run('hello')

    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'runtime_decision',
        payload: expect.objectContaining({
          layer: 'stage_one',
          decision: 'answer',
          reason: 'stage_one_direct_answer',
        }),
      }),
    )
  })

  it('persists tool results larger than the configured threshold', async () => {
    const artifactDir = await tempRuntimeDir()
    try {
      const runtime = createAgentRuntime({
        artifactDir,
        toolResultPersistBytes: 20_000,
        provider: async () => ({ text: 'read complete' }),
        tools: {
          read: async () => 'x'.repeat(20_001),
        },
      })

      const events = await runtime.run('read huge.txt')
      const result = events.find(event => event.type === 'tool_result')

      expect(result?.payload.output).toMatchObject({
        persisted: true,
        bytes: 20_001,
      })

      const artifactPath = (result?.payload.output as { artifactPath: string })
        .artifactPath
      await expect(readFile(artifactPath, 'utf8')).resolves.toHaveLength(20_001)
    } finally {
      await rm(artifactDir, { recursive: true, force: true })
    }
  })

  it('persists a context snapshot when estimated context reaches 70 percent', async () => {
    const artifactDir = await tempRuntimeDir()
    try {
      const runtime = createAgentRuntime({
        artifactDir,
        contextWindowChars: 100,
        contextPersistRatio: 0.7,
        provider: async () => ({ text: 'short answer' }),
      })

      const events = await runtime.run('x'.repeat(80))
      const status = events.find(
        event =>
          event.type === 'system_status' &&
          event.payload.reason === 'context_snapshot_persisted',
      )

      expect(status?.payload).toMatchObject({
        stage: 'answering',
        level: 'info',
        source: 'runtime',
      })

      const snapshotPath = status?.payload.snapshotPath as string
      const rawSnapshot = await readFile(snapshotPath, 'utf8')
      expect(rawSnapshot).toContain('"type":"user_message"')
    } finally {
      await rm(artifactDir, { recursive: true, force: true })
    }
  })

  it('runs the default glob tool against the configured workspace', async () => {
    const workspaceRoot = await tempRuntimeDir()
    try {
      await mkdir(join(workspaceRoot, 'src'), { recursive: true })
      await mkdir(join(workspaceRoot, 'src', 'nested'), { recursive: true })
      await writeFile(join(workspaceRoot, 'src', 'agent.ts'), 'export {}\n')
      await writeFile(
        join(workspaceRoot, 'src', 'nested', 'inner.ts'),
        'export {}\n',
      )

      const runtime = createAgentRuntime({
        workspaceRoot,
        provider: async () => ({ text: 'glob complete' }),
      })

      const events = await runtime.run('glob **/*.ts')
      const result = events.find(event => event.type === 'tool_result')

      expect(result?.payload).toMatchObject({
        name: 'glob',
        ok: true,
      })
      expect(String(result?.payload.output).split('\n').sort()).toEqual([
        'src/agent.ts',
        'src/nested/inner.ts',
      ])
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })

  it('logs clarify decisions and returns the question without calling the provider', async () => {
    let providerCalled = false
    const runtime = createAgentRuntime({
      controlDecision: async () => ({
        kind: 'clarify',
        question: 'Which file should I inspect?',
        reason: 'stage_one_clarify_request',
      }),
      provider: async () => {
        providerCalled = true
        return { text: 'provider answer' }
      },
    })

    const events = await runtime.run('check it')

    expect(providerCalled).toBe(false)
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'system_status',
        payload: expect.objectContaining({
          stage: 'routing',
          reason: 'stage_one_clarify_request',
          controlDecision: 'clarify',
          responsePolicyId: 'clarify_direct_v1',
          responsePolicyMode: 'appended',
          responseStyle: 'clarify_direct',
        }),
      }),
    )
    expect(events.at(-1)).toMatchObject({
      type: 'assistant_text',
      payload: { text: 'Which file should I inspect?' },
    })
  })

  it('logs Task Mode decisions without calling the provider', async () => {
    let providerCalled = false
    const runtime = createAgentRuntime({
      controlDecision: async () => ({
        kind: 'task_mode',
        summary: 'Inspect tests and propose a fix',
        reason: 'stage_one_task_mode',
      }),
      provider: async () => {
        providerCalled = true
        return { text: 'provider answer' }
      },
    })

    const events = await runtime.run('fix the tests')

    expect(providerCalled).toBe(false)
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'system_status',
        payload: expect.objectContaining({
          stage: 'routing',
          reason: 'stage_one_task_mode',
          controlDecision: 'task_mode',
        }),
      }),
    )
    expect(
      events.some(
        event =>
          event.type === 'system_status' &&
          'responsePolicyId' in event.payload,
      ),
    ).toBe(false)
    expect(events.at(-1)).toMatchObject({
      type: 'assistant_text',
      payload: {
        text: 'Task Mode selected: Inspect tests and propose a fix',
      },
    })
  })

  it('uses execute decisions to run read-only tools and still appends the brief policy', async () => {
    const workspaceRoot = await tempRuntimeDir()
    const calls: string[][] = []
    try {
      await writeFile(join(workspaceRoot, 'note.txt'), 'hello from note')
      const runtime = createAgentRuntime({
        workspaceRoot,
        controlDecision: async () => ({
          kind: 'execute',
          reason: 'stage_one_execute',
        }),
        provider: async ({ messages }) => {
          calls.push(messages.map(message => `${message.role}:${message.content}`))
          return { text: 'tool result inspected' }
        },
      })

      const events = await runtime.run('read note.txt')

      expect(calls[0]?.slice(0, 2)).toEqual([
        'system:You are Accorda, a minimal local coding assistant runtime. Answer concisely and use prior context when useful.',
        'system:Be brief. Lead with the conclusion.',
      ])
      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'system_status',
          payload: expect.objectContaining({
            source: 'provider',
            responsePolicyId: 'default_brief_v1',
            responsePolicyMode: 'appended',
            responseStyle: 'default_brief',
          }),
        }),
      )
      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'tool_result',
          payload: expect.objectContaining({
            name: 'read',
            ok: true,
            output: 'hello from note',
          }),
        }),
      )
      expect(events.at(-1)).toMatchObject({
        type: 'assistant_text',
        payload: { text: 'tool result inspected' },
      })
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })

  it('does not run tools when the first layer selects direct answer', async () => {
    const workspaceRoot = await tempRuntimeDir()
    try {
      await writeFile(join(workspaceRoot, 'note.txt'), 'hello from note')
      const runtime = createAgentRuntime({
        workspaceRoot,
        controlDecision: async () => ({
          kind: 'answer',
          reason: 'stage_one_direct_answer',
        }),
        provider: async () => ({ text: 'direct provider answer' }),
      })

      const events = await runtime.run('read note.txt')

      expect(events.some(event => event.type === 'tool_call')).toBe(false)
      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'system_status',
          payload: expect.objectContaining({
            stage: 'routing',
            reason: 'stage_one_direct_answer',
            controlDecision: 'answer',
          }),
        }),
      )
      expect(events.at(-1)).toMatchObject({
        type: 'assistant_text',
        payload: { text: 'direct provider answer' },
      })
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })
})
