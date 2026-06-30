import { mkdtemp, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  createReadableTraceLog,
  summarizeToolInput,
} from '../src/trace/readableTrace.js'

describe('readable trace', () => {
  it('writes human-first jsonl events with a short trace id', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'accorda-trace-'))
    const path = join(dir, 'trace.jsonl')
    const log = createReadableTraceLog(path, 'tr_test')

    await log.append({
      type: 'tool_started',
      tool: 'bash',
      intent: '运行测试验证当前行为',
      command: 'npm test',
    })

    const [line] = (await readFile(path, 'utf8')).trim().split('\n')
    const event = JSON.parse(line)

    expect(event.trace).toBe('tr_test')
    expect(event.type).toBe('tool_started')
    expect(event.intent).toBe('运行测试验证当前行为')
    expect(event.command).toBe('npm test')
  })

  it('summarizes mutating tool input without copying full content', () => {
    expect(
      summarizeToolInput('write', {
        path: 'src/example.ts',
        content: 'hello world',
      }),
    ).toEqual({ target: 'src/example.ts', summary: 'write 11 chars' })

    expect(
      summarizeToolInput('edit', {
        path: 'src/example.ts',
        edits: [{ oldText: 'a', newText: 'b' }],
      }),
    ).toEqual({ target: 'src/example.ts', summary: '1 edit block' })
  })
})
