import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
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

    expect(calls[0]?.slice(0, 3)).toEqual([
      'system:You are Accorda, a minimal local coding assistant runtime. Answer concisely and use prior context when useful.',
      'system:Tools: ls, read, glob, grep. Tool results may appear in context; API tool-calls are not enabled yet.',
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

  it('emits model call started and finished events around provider calls', async () => {
    const runtime = createAgentRuntime({
      id: (() => {
        const ids = [
          'evt-user',
          'evt-decision',
          'evt-status',
          'call-1',
          'evt-started',
          'evt-finished',
          'evt-provider',
          'evt-answer',
        ]
        return () => ids.shift() ?? 'evt-extra'
      })(),
      provider: async ({
        callId,
        messages,
        toolNames,
        recordModelRequest,
        recordModelResponse,
      }) => {
        const requestArtifact = await recordModelRequest({
          body: { model: 'test-model', messages, toolNames },
        })
        const responseArtifact = await recordModelResponse({
          body: { text: 'hello back' },
        })
        return {
          text: 'hello back',
          model: 'test-model',
          trace: { callId, requestArtifact, responseArtifact },
        }
      },
    })

    const events = await runtime.run('hello')

    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'model_call_started',
        payload: expect.objectContaining({
          callId: 'call-1',
          requestArtifact: expect.any(String),
          messageCount: expect.any(Number),
        }),
      }),
    )
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'model_call_finished',
        payload: expect.objectContaining({
          callId: 'call-1',
          ok: true,
          responseArtifact: expect.any(String),
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

      expect(calls[0]?.slice(0, 3)).toEqual([
        'system:You are Accorda, a minimal local coding assistant runtime. Answer concisely and use prior context when useful.',
        'system:Tools: ls, read, glob, grep. Tool results may appear in context; API tool-calls are not enabled yet.',
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

  it('passes execute tools and requires a tool call while in execute mode', async () => {
    const requests: unknown[] = []
    const runtime = createAgentRuntime({
      controlDecision: async () => ({
        kind: 'execute',
        reason: 'stage_one_execute_explicit_request',
      }),
      provider: async ({
        tools,
        toolChoice,
        recordModelRequest,
        recordModelResponse,
      }) => {
        requests.push({ tools, toolChoice })
        await recordModelRequest({
          body: {
            model: 'test-model',
            tools,
            tool_choice: toolChoice,
          },
        })
        await recordModelResponse({
          body: {
            tool_calls: [
              {
                id: 'tool-1',
                type: 'function',
                function: {
                  name: 'finish',
                  arguments: JSON.stringify({ message: 'done' }),
                },
              },
            ],
          },
        })

        return {
          text: '',
          toolCalls: [
            {
              id: 'tool-1',
              type: 'function',
              function: {
                name: 'finish',
                arguments: JSON.stringify({ message: 'done' }),
              },
            },
          ],
        }
      },
      id: (() => {
        let count = 0
        return () => `evt-${++count}`
      })(),
    })

    const events = await runtime.run('inspect package.json')

    expect(requests).toEqual([
      expect.objectContaining({
        toolChoice: 'required',
        tools: expect.arrayContaining([
          expect.objectContaining({
            type: 'function',
            function: expect.objectContaining({ name: 'finish' }),
          }),
        ]),
      }),
    ])
    expect(events.some(event => event.type === 'tool_call')).toBe(true)
  })

  it('returns permission_denied as an observation and keeps execute alive', async () => {
    const readPendingExecute = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        status: 'waiting_permission',
        toolCallId: 'tool-1',
        toolName: 'write',
        input: {
          path: 'notes.txt',
          content: 'hello',
        },
      })
      .mockResolvedValueOnce(null)
    const savePendingExecute = vi.fn()
    let providerCalls = 0
    const runtime = createAgentRuntime({
      controlDecision: async () => ({
        kind: 'execute',
        reason: 'stage_one_execute_explicit_request',
      }),
      sessionStore: {
        readPendingExecute,
        savePendingExecute,
      },
      provider: async () => {
        providerCalls += 1

        if (providerCalls === 1) {
          return {
            text: '',
            toolCalls: [
              {
                id: 'tool-1',
                type: 'function',
                function: {
                  name: 'write',
                  arguments: JSON.stringify({
                    path: 'notes.txt',
                    content: 'hello',
                  }),
                },
              },
            ],
          }
        }

        return {
          text: '',
          toolCalls: [
            {
              id: 'tool-2',
              type: 'function',
              function: {
                name: 'finish',
                arguments: JSON.stringify({ message: 'use a manual write instead' }),
              },
            },
          ],
        }
      },
    })

    const first = await runtime.run('write notes.txt')
    expect(first.some(event => event.payload.reason === 'execute_waiting_permission')).toBe(true)

    const second = await runtime.run('n')
    expect(
      second.some(
        event =>
          event.type === 'tool_result' &&
          event.payload.name === 'write' &&
          event.payload.ok === false &&
          event.payload.error === 'permission_denied',
      ),
    ).toBe(true)
    expect(second.at(-1)).toMatchObject({
      type: 'assistant_text',
      payload: { text: 'use a manual write instead' },
    })
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
