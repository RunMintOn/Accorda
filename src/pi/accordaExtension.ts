import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  createBashTool,
  createEditTool,
  createWriteTool,
  type ExtensionAPI,
  withFileMutationQueue,
} from '@earendil-works/pi-coding-agent'
import { Type } from 'typebox'
import type { ReadableTraceLog, TaskStatus } from '../trace/readableTrace.js'
import {
  summarizeToolInput,
  summarizeToolResult,
} from '../trace/readableTrace.js'

const intentDescription =
  'A concise, specific statement of the immediate purpose of this tool call. Describe what this action is meant to accomplish. Do not write generic phrases or hidden reasoning.'

const missingIntent = 'Missing intent.'

type AccordaExtensionOptions = {
  traceLog: ReadableTraceLog
  initialMode?: 'chat' | 'task'
  initialTaskStatus?: TaskStatus
  onTaskStatusChange?: (status: TaskStatus) => void
}

function requireIntent(input: { intent?: unknown }) {
  if (typeof input.intent !== 'string' || !input.intent.trim()) {
    throw new Error(missingIntent)
  }
  return input.intent.trim()
}

function withoutIntent<T extends { intent?: unknown }>(input: T) {
  const { intent: _intent, ...rest } = input
  return rest
}

export function createAccordaExtension(options: AccordaExtensionOptions) {
  let mode = options.initialMode ?? 'chat'
  let taskStatus: TaskStatus = options.initialTaskStatus ?? 'aligning'

  return function accordaExtension(pi: ExtensionAPI) {
    const cwd = process.cwd()
    const bash = createBashTool(cwd)
    const edit = createEditTool(cwd)
    const write = createWriteTool(cwd)

    pi.registerTool({
      ...bash,
      name: 'bash',
      parameters: Type.Intersect([
        Type.Object({ intent: Type.String({ description: intentDescription }) }),
        bash.parameters as never,
      ]),
      async execute(toolCallId, params, signal, onUpdate) {
        const intent = requireIntent(params)
        const input = withoutIntent(params)
        await options.traceLog.append({
          type: 'tool_started',
          tool: 'bash',
          intent,
          ...summarizeToolInput('bash', input),
        })
        try {
          const result = await bash.execute(toolCallId, input, signal, onUpdate)
          await options.traceLog.append({
            type: 'tool_finished',
            tool: 'bash',
            ...summarizeToolResult(result),
          })
          return result
        } catch (error) {
          await options.traceLog.append({
            type: 'tool_finished',
            tool: 'bash',
            status: 'failed',
            summary: error instanceof Error ? error.message : 'failed',
          })
          throw error
        }
      },
    })

    pi.registerTool({
      ...edit,
      name: 'edit',
      parameters: Type.Intersect([
        Type.Object({ intent: Type.String({ description: intentDescription }) }),
        edit.parameters as never,
      ]),
      async execute(toolCallId, params, signal, onUpdate) {
        const intent = requireIntent(params)
        const input = withoutIntent(params)
        await options.traceLog.append({
          type: 'tool_started',
          tool: 'edit',
          intent,
          ...summarizeToolInput('edit', input),
        })
        try {
          const result = await edit.execute(toolCallId, input, signal, onUpdate)
          await options.traceLog.append({
            type: 'tool_finished',
            tool: 'edit',
            ...summarizeToolResult(result),
          })
          return result
        } catch (error) {
          await options.traceLog.append({
            type: 'tool_finished',
            tool: 'edit',
            status: 'failed',
            summary: error instanceof Error ? error.message : 'failed',
          })
          throw error
        }
      },
    })

    pi.registerTool({
      ...write,
      name: 'write',
      parameters: Type.Intersect([
        Type.Object({ intent: Type.String({ description: intentDescription }) }),
        write.parameters as never,
      ]),
      async execute(toolCallId, params, signal, onUpdate) {
        const intent = requireIntent(params)
        const input = withoutIntent(params)
        await options.traceLog.append({
          type: 'tool_started',
          tool: 'write',
          intent,
          ...summarizeToolInput('write', input),
        })
        try {
          const result = await write.execute(toolCallId, input, signal, onUpdate)
          await options.traceLog.append({
            type: 'tool_finished',
            tool: 'write',
            ...summarizeToolResult(result),
          })
          return result
        } catch (error) {
          await options.traceLog.append({
            type: 'tool_finished',
            tool: 'write',
            status: 'failed',
            summary: error instanceof Error ? error.message : 'failed',
          })
          throw error
        }
      },
    })

    pi.registerTool({
      name: 'append',
      label: 'append',
      description: 'Append text to the end of a file.',
      parameters: Type.Object({
        intent: Type.String({ description: intentDescription }),
        path: Type.String({ description: 'Path to the file to append to.' }),
        content: Type.String({ description: 'Text to append.' }),
      }),
      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const intent = requireIntent(params)
        await options.traceLog.append({
          type: 'tool_started',
          tool: 'append',
          intent,
          ...summarizeToolInput('append', params),
        })
        try {
          const absolutePath = resolve(ctx.cwd, params.path)
          await withFileMutationQueue(absolutePath, async () => {
            await mkdir(dirname(absolutePath), { recursive: true })
            await appendFile(absolutePath, params.content, 'utf8')
          })
          const result = {
            content: [{ type: 'text' as const, text: `Appended to ${params.path}` }],
            details: { path: params.path, bytes: Buffer.byteLength(params.content) },
          }
          await options.traceLog.append({
            type: 'tool_finished',
            tool: 'append',
            status: 'completed',
            summary: `append ${params.content.length} chars`,
          })
          return result
        } catch (error) {
          await options.traceLog.append({
            type: 'tool_finished',
            tool: 'append',
            status: 'failed',
            summary: error instanceof Error ? error.message : 'failed',
          })
          throw error
        }
      },
    })

    pi.registerTool({
      name: 'task_start',
      label: 'task_start',
      description: 'Enter Accorda Task Mode for complex, multi-step work that benefits from visible task tracking.',
      parameters: Type.Object({
        goal: Type.String({ description: 'The user-visible task goal.' }),
        reason: Type.Optional(Type.String({ description: 'Short reason why Task Mode is useful here.' })),
      }),
      async execute(_toolCallId, params) {
        mode = 'task'
        taskStatus = 'aligning'
        options.onTaskStatusChange?.(taskStatus)
        await options.traceLog.append({
          type: 'task_started',
          mode,
          status: taskStatus,
          task: params.goal,
          summary: params.reason,
        })
        return {
          content: [{ type: 'text' as const, text: 'Task Mode started.' }],
          details: { mode, status: taskStatus, goal: params.goal },
        }
      },
    })

    pi.registerTool({
      name: 'task_update',
      label: 'task_update',
      description: 'Update visible Accorda Task Mode status, meaningful progress, blockers, completion, or cancellation.',
      parameters: Type.Object({
        status: Type.Union([
          Type.Literal('aligning'),
          Type.Literal('executing'),
          Type.Literal('blocked'),
          Type.Literal('done'),
          Type.Literal('cancelled'),
        ]),
        summary: Type.String({ description: 'Short user-visible task status update.' }),
        items: Type.Optional(
          Type.Array(
            Type.Object({
              id: Type.String(),
              text: Type.String(),
              status: Type.String(),
            }),
          ),
        ),
      }),
      async execute(_toolCallId, params) {
        if (mode !== 'task') {
          throw new Error('Task Mode is not active.')
        }
        taskStatus = params.status
        options.onTaskStatusChange?.(taskStatus)
        await options.traceLog.append({
          type: 'task_updated',
          mode,
          status: taskStatus,
          summary: params.summary,
          items: params.items,
        })
        return {
          content: [{ type: 'text' as const, text: 'Task updated.' }],
          details: { mode, status: taskStatus, items: params.items ?? [] },
        }
      },
    })
  }
}

export async function appendTaskModeGuidance(path: string) {
  const marker = 'Accorda Task Mode guidance'
  const current = await readFile(path, 'utf8').catch(() => '')
  if (current.includes(marker)) return
}
