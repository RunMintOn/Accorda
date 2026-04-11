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
})
