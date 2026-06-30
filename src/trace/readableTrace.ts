import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export type TraceStatus = 'running' | 'completed' | 'failed' | 'done' | 'blocked' | 'cancelled'

export type TaskStatus = 'aligning' | 'executing' | 'blocked' | 'done' | 'cancelled'

export type TraceEvent = {
  time: string
  type:
    | 'trace_started'
    | 'trace_finished'
    | 'tool_started'
    | 'tool_finished'
    | 'task_started'
    | 'task_updated'
  trace: string
  mode?: 'chat' | 'task'
  input?: string
  status?: TraceStatus | TaskStatus
  tool?: string
  intent?: string
  command?: string
  target?: string
  summary?: string
  task?: string
  items?: Array<{ id: string; text: string; status: string }>
}

export type ReadableTraceLog = {
  path: string
  append(event: Omit<TraceEvent, 'time' | 'trace'>): Promise<void>
}

export function createReadableTraceLog(path: string, traceId: string): ReadableTraceLog {
  return {
    path,
    async append(event) {
      await mkdir(dirname(path), { recursive: true })
      const record: TraceEvent = {
        time: new Date().toISOString(),
        trace: traceId,
        ...event,
      }
      await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8')
    },
  }
}

export function shortTraceId(now: Date = new Date()) {
  const compact = now.toISOString().replace(/[-:.TZ]/g, '').slice(8, 14)
  return `tr_${compact}`
}

export function summarizeToolInput(tool: string, input: Record<string, unknown>) {
  if (tool === 'bash') {
    return { command: typeof input.command === 'string' ? input.command : undefined }
  }

  const target = typeof input.path === 'string' ? input.path : undefined

  if (tool === 'edit') {
    const edits = Array.isArray(input.edits) ? input.edits.length : 0
    return { target, summary: `${edits} edit block${edits === 1 ? '' : 's'}` }
  }

  if (tool === 'write') {
    const length = typeof input.content === 'string' ? input.content.length : 0
    return { target, summary: `write ${length} chars` }
  }

  if (tool === 'append') {
    const length = typeof input.content === 'string' ? input.content.length : 0
    return { target, summary: `append ${length} chars` }
  }

  return {}
}

export function summarizeToolResult(result: unknown) {
  const output = textFromToolResult(result)
  const exitCode = output?.match(/exit code:?\s*(\d+)/i)?.[1]
  if (exitCode) {
    return {
      status: exitCode === '0' ? 'completed' : 'failed',
      summary: `exit code ${exitCode}`,
    } as const
  }

  return {
    status: 'completed',
    summary: output ? firstLine(output) : 'completed',
  } as const
}

function textFromToolResult(result: unknown) {
  if (!result || typeof result !== 'object') return ''
  const content = (result as { content?: unknown }).content
  if (!Array.isArray(content)) return ''
  const first = content[0]
  if (!first || typeof first !== 'object') return ''
  const text = (first as { text?: unknown }).text
  return typeof text === 'string' ? text : ''
}

function firstLine(text: string) {
  const line = text.split('\n').find(value => value.trim()) ?? ''
  return line.length > 120 ? `${line.slice(0, 117)}...` : line
}
