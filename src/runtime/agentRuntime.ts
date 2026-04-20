import { randomUUID } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { cwd } from 'node:process'
import type {
  EventRecord,
  PendingExecute,
  RuntimeStatusPayload,
} from '../core/contracts.js'
import { getDefaultPermissionMode } from '../permissions/policy.js'
import type {
  ChatToolDefinition,
  ProviderTextResult,
} from '../provider/openaiClient.js'
import { createExecuteToolCatalog } from '../tools/executeCatalog.js'
import type { ReadOnlyToolHandler } from '../tools/readOnly.js'
import {
  createResponsePolicyMessage,
  responsePolicyMetadata,
  selectResponsePolicy,
  type ResponsePolicy,
} from './responsePolicy.js'

export type ProviderMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

export type RuntimeProvider = (input: {
  callId: string
  messages: ProviderMessage[]
  toolNames: string[]
  tools?: ChatToolDefinition[]
  toolChoice?: 'auto' | 'required'
  recordModelRequest(value: unknown): Promise<string>
  recordModelResponse(value: unknown): Promise<string>
}) => Promise<
  ProviderTextResult & {
    status?: RuntimeStatusPayload
    trace?: {
      callId: string
      requestArtifact?: string
      responseArtifact?: string
    }
  }
>

type EventStore = {
  append(event: EventRecord): Promise<void>
  readAll(): Promise<EventRecord[]>
}

type RuntimeSessionStore = {
  readPendingExecute?(): Promise<PendingExecute | null>
  savePendingExecute?(pendingExecute: PendingExecute | null): Promise<void>
}

export type AgentRuntimeOptions = {
  sessionId?: string
  workspaceRoot?: string
  provider: RuntimeProvider
  eventStore?: EventStore
  sessionStore?: RuntimeSessionStore
  artifactDir?: string
  contextWindowChars?: number
  contextPersistRatio?: number
  toolResultPersistBytes?: number
  tools?: Partial<Record<string, ReadOnlyToolHandler>>
  now?: () => Date
  id?: () => string
}

export type AgentRuntime = {
  run(userText: string): Promise<EventRecord[]>
  readContext(): EventRecord[]
}

const DEFAULT_TOOL_RESULT_PERSIST_BYTES = 20_000
const DEFAULT_CONTEXT_PERSIST_RATIO = 0.7
const DEFAULT_CONTEXT_WINDOW_CHARS = 200_000

function eventToProviderMessage(event: EventRecord): ProviderMessage | null {
  if (event.type === 'user_message') {
    return { role: 'user', content: String(event.payload.text ?? '') }
  }
  if (event.type === 'assistant_text') {
    return { role: 'assistant', content: String(event.payload.text ?? '') }
  }
  if (event.type === 'tool_result') {
    return { role: 'tool', content: JSON.stringify(event.payload) }
  }
  return null
}

function omitUndefined(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  )
}

function parseToolArguments(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') return {}

  try {
    const parsed = JSON.parse(value)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    return {}
  }

  return {}
}

function normalizeProviderToolCalls(
  toolCalls: unknown,
): Array<{
  id: string
  name: string
  input: Record<string, unknown>
}> {
  if (!Array.isArray(toolCalls)) return []

  return toolCalls.flatMap(toolCall => {
    if (!toolCall || typeof toolCall !== 'object') return []

    const callId = 'id' in toolCall && typeof toolCall.id === 'string'
      ? toolCall.id
      : null
    const fn = 'function' in toolCall ? toolCall.function : null
    if (!callId || !fn || typeof fn !== 'object') return []

    const name = 'name' in fn && typeof fn.name === 'string' ? fn.name : null
    if (!name) return []

    const args = 'arguments' in fn ? fn.arguments : undefined

    return [{ id: callId, name, input: parseToolArguments(args) }]
  })
}

export function createAgentRuntime(options: AgentRuntimeOptions): AgentRuntime {
  const sessionId = options.sessionId ?? 'local'
  const workspaceRoot = options.workspaceRoot ?? cwd()
  const artifactDir = options.artifactDir ?? join(workspaceRoot, '.accorda', 'runtime-artifacts')
  const contextWindowChars =
    options.contextWindowChars ?? DEFAULT_CONTEXT_WINDOW_CHARS
  const toolResultPersistBytes =
    options.toolResultPersistBytes ?? DEFAULT_TOOL_RESULT_PERSIST_BYTES
  const contextPersistRatio =
    options.contextPersistRatio ?? DEFAULT_CONTEXT_PERSIST_RATIO
  const now = options.now ?? (() => new Date())
  const id = options.id ?? randomUUID
  const executeCatalog = createExecuteToolCatalog(workspaceRoot, options.tools)

  let history: EventRecord[] = []
  let initialized = false
  let queue: Promise<unknown> = Promise.resolve()
  let lastSnapshotEventCount = 0

  async function initialize() {
    if (initialized) return
    history = options.eventStore ? await options.eventStore.readAll() : []
    initialized = true
  }

  function createEvent(
    type: EventRecord['type'],
    payload: Record<string, unknown>,
  ): EventRecord {
    return {
      id: id(),
      sessionId,
      timestamp: now().toISOString(),
      type,
      payload: omitUndefined(payload),
    }
  }

  async function append(events: EventRecord[], event: EventRecord) {
    history.push(event)
    events.push(event)
    await options.eventStore?.append(event)
  }

  async function persistToolOutput(output: unknown) {
    const serialized =
      typeof output === 'string' ? output : JSON.stringify(output, null, 2)
    const bytes = Buffer.byteLength(serialized, 'utf8')

    if (bytes <= toolResultPersistBytes) return output

    await mkdir(join(artifactDir, 'tool-results'), { recursive: true })
    const artifactPath = join(artifactDir, 'tool-results', `${id()}.txt`)
    await writeFile(artifactPath, serialized, 'utf8')

    return {
      persisted: true,
      artifactPath,
      bytes,
      preview: serialized.slice(0, 500),
    }
  }

  async function persistContextSnapshot(events: EventRecord[]) {
    if (contextWindowChars <= 0) return
    if (lastSnapshotEventCount === history.length) return

    const estimate = Buffer.byteLength(JSON.stringify(history), 'utf8')
    const usage = estimate / contextWindowChars
    if (usage < contextPersistRatio) return

    await mkdir(join(artifactDir, 'context-snapshots'), { recursive: true })
    const snapshotPath = join(artifactDir, 'context-snapshots', `${id()}.jsonl`)
    await writeFile(
      snapshotPath,
      history.map(event => JSON.stringify(event)).join('\n') + '\n',
      'utf8',
    )
    lastSnapshotEventCount = history.length

    await append(
      events,
      createEvent('system_status', {
        message: 'Context snapshot persisted',
        level: 'info',
        stage: 'answering',
        reason: 'context_snapshot_persisted',
        source: 'runtime',
        contextUsage: usage,
        snapshotPath,
      }),
    )
  }

  async function writeModelCallArtifact(
    callId: string,
    kind: 'request' | 'response',
    value: unknown,
  ) {
    const modelCallsDir = join(artifactDir, 'model-calls')
    await mkdir(modelCallsDir, { recursive: true })
    const artifactPath = join(modelCallsDir, `${callId}.${kind}.json`)
    await writeFile(artifactPath, JSON.stringify(value, null, 2), 'utf8')
    return artifactPath
  }

  function providerMessages(
    layer: 'stage_one' | 'stage_two',
    responsePolicy: ResponsePolicy | null,
  ) {
    const modePrompt =
      layer === 'stage_one'
        ? 'Stage one is a control layer. You must call exactly one control tool. Use answer when you can respond now. Use execute when the request should enter the execution layer. Do not reply with normal assistant text.'
        : 'Use the provided execution tools to inspect the workspace, ask follow-up questions when needed, and call finish when the task is complete.'
    const messages: ProviderMessage[] = [
      {
        role: 'system',
        content:
          'You are Accorda, a minimal local coding assistant runtime. Answer concisely and use prior context when useful.',
      },
      {
        role: 'system',
        content: modePrompt,
      },
    ]

    if (responsePolicy) {
      messages.push(createResponsePolicyMessage(responsePolicy))
    }

    messages.push(
      ...history.map(eventToProviderMessage).filter(message => message !== null),
    )

    return messages
  }

  async function savePendingExecute(pendingExecute: PendingExecute | null) {
    await options.sessionStore?.savePendingExecute?.(pendingExecute)
  }

  function isPermissionApproval(text: string) {
    return /^(y|yes|approve|approved)$/i.test(text.trim())
  }

  function isPermissionDenial(text: string) {
    return /^(n|no|deny|denied|reject)$/i.test(text.trim())
  }

  function stageOneToolDefinitions(): ChatToolDefinition[] {
    return [
      {
        type: 'function',
        function: {
          name: 'answer',
          description: 'Answer directly without entering the execution layer',
          parameters: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
            required: ['message'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'execute',
          description: 'Enter the execution layer for an actionable request',
          parameters: {
            type: 'object',
            properties: {
              user_text: { type: 'string' },
              goal: { type: 'string' },
            },
            required: ['user_text', 'goal'],
            additionalProperties: false,
          },
        },
      },
    ]
  }

  async function stageOneProviderTurn(
    events: EventRecord[],
    userText: string,
  ): Promise<EventRecord[]> {
    const responsePolicy = selectResponsePolicy({ kind: 'answer' })
    const responsePolicyPayload = responsePolicy
      ? responsePolicyMetadata(responsePolicy)
      : {}
    const callId = id()
    const messages = providerMessages('stage_one', responsePolicy)
    const providerTools = stageOneToolDefinitions()
    const toolNames = providerTools.map(tool => tool.function.name)
    let requestArtifactPath: string | undefined
    let modelCallFinished = false
    const result = await options.provider({
      callId,
      messages,
      toolNames,
      tools: providerTools,
      toolChoice: 'required',
      recordModelRequest: async value => {
        const requestArtifact = await writeModelCallArtifact(
          callId,
          'request',
          value,
        )
        requestArtifactPath = requestArtifact
        await append(
          events,
          createEvent('model_call_started', {
            callId,
            layer: 'stage_one',
            requestArtifact,
            messageCount: messages.length,
            toolNames,
          }),
        )
        return requestArtifact
      },
      recordModelResponse: async value => {
        const responseArtifact = await writeModelCallArtifact(
          callId,
          'response',
          value,
        )
        await append(
          events,
          createEvent('model_call_finished', {
            callId,
            ok: true,
            responseArtifact,
          }),
        )
        modelCallFinished = true
        return responseArtifact
      },
    })

    if (!modelCallFinished && requestArtifactPath) {
      await append(
        events,
        createEvent('model_call_finished', {
          callId,
          ok: result.status?.level !== 'error',
          requestArtifact: requestArtifactPath,
          error:
            result.status?.level === 'error' ? result.status.message : undefined,
          usage: result.usage,
          model: result.model,
          finishReason: result.finishReason,
        }),
      )
    }

    await append(
      events,
      createEvent('system_status', {
        message: result.status?.message ?? 'Provider returned stage one control decision',
        level: result.status?.level ?? 'info',
        stage:
          result.status?.level === 'error'
            ? result.status.stage
            : 'routing',
        reason:
          result.status?.level === 'error'
            ? result.status.reason
            : 'stage_one_control_round',
        source: result.status?.source ?? 'provider',
        ...responsePolicyPayload,
        usage: result.usage,
        model: result.model,
        finishReason: result.finishReason,
      }),
    )

    if (result.status?.level === 'error') {
      await append(
        events,
        createEvent('assistant_text', {
          text: result.text || 'Provider unavailable. Check configuration and try again.',
        }),
      )
      await persistContextSnapshot(events)
      return events
    }

    const providerToolCalls = normalizeProviderToolCalls(result.toolCalls)
    const toolCall = providerToolCalls[0]

    if (!toolCall || (toolCall.name !== 'answer' && toolCall.name !== 'execute')) {
      await append(
        events,
        createEvent('system_status', {
          message: 'Stage one must return an answer or execute tool call.',
          level: 'error',
          stage: 'error',
          reason: 'stage_one_protocol_error',
          source: 'runtime',
          ...responsePolicyPayload,
          usage: result.usage,
          model: result.model,
          finishReason: result.finishReason,
        }),
      )
      await append(
        events,
        createEvent('assistant_text', {
          text: 'Stage one must return an answer or execute tool call.',
        }),
      )
      await persistContextSnapshot(events)
      return events
    }

    await append(
      events,
      createEvent('tool_call', {
        toolCallId: toolCall.id,
        name: toolCall.name,
        input: toolCall.input,
        layer: 'control',
      }),
    )
    await append(
      events,
      createEvent('tool_result', {
        toolCallId: toolCall.id,
        name: toolCall.name,
        ok: true,
        output: toolCall.input,
      }),
    )

    if (toolCall.name === 'answer') {
      const message = String(toolCall.input.message ?? '(empty response)')
      await append(
        events,
        createEvent('runtime_decision', {
          layer: 'stage_one',
          decision: 'answer',
          reason: 'stage_one_direct_answer',
          responsePolicyId: responsePolicyPayload.responsePolicyId,
          responsePolicyMode: responsePolicyPayload.responsePolicyMode,
          responseStyle: responsePolicyPayload.responseStyle,
        }),
      )
      await append(
        events,
        createEvent('system_status', {
          message: 'Stage one selected answer',
          level: 'info',
          stage: 'routing',
          reason: 'stage_one_direct_answer',
          source: 'stage_one',
          controlDecision: 'answer',
          ...responsePolicyPayload,
        }),
      )
      await append(events, createEvent('assistant_text', { text: message }))
      await persistContextSnapshot(events)
      return events
    }

    const executeInput = {
      user_text: String(toolCall.input.user_text ?? userText),
      goal: String(toolCall.input.goal ?? userText),
    }
    await append(
      events,
      createEvent('runtime_decision', {
        layer: 'stage_one',
        decision: 'execute',
        reason: 'stage_one_execute',
        responsePolicyId: responsePolicyPayload.responsePolicyId,
        responsePolicyMode: responsePolicyPayload.responsePolicyMode,
        responseStyle: responsePolicyPayload.responseStyle,
      }),
    )
    await append(
      events,
      createEvent('system_status', {
        message: 'Stage one selected execute',
        level: 'info',
        stage: 'routing',
        reason: 'stage_one_execute',
        source: 'stage_one',
        controlDecision: 'execute',
        ...responsePolicyPayload,
      }),
    )
    await append(
      events,
      createEvent('tool_result', {
        toolCallId: toolCall.id,
        name: 'execute_context',
        ok: true,
        output: executeInput,
      }),
    )

    return executeProviderTurn(events, responsePolicy, responsePolicyPayload)
  }

  async function executeProviderTurn(
    events: EventRecord[],
    responsePolicy: ResponsePolicy | null,
    responsePolicyPayload: Record<string, unknown>,
  ): Promise<EventRecord[]> {
    for (let iteration = 0; iteration < 12; iteration += 1) {
      const callId = id()
      const messages = providerMessages('stage_two', responsePolicy)
      const providerToolNames = executeCatalog.definitions.map(tool => tool.name)
      const providerTools = executeCatalog.definitions.map(tool => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }))
      let requestArtifactPath: string | undefined
      let modelCallFinished = false
      const result = await options.provider({
        callId,
        messages,
        toolNames: providerToolNames,
        tools: providerTools,
        toolChoice: 'required',
        recordModelRequest: async value => {
          const requestArtifact = await writeModelCallArtifact(
            callId,
            'request',
            value,
          )
          requestArtifactPath = requestArtifact
          await append(
            events,
            createEvent('model_call_started', {
              callId,
              layer: 'stage_two',
              requestArtifact,
              messageCount: messages.length,
              toolNames: providerToolNames,
            }),
          )
          return requestArtifact
        },
        recordModelResponse: async value => {
          const responseArtifact = await writeModelCallArtifact(
            callId,
            'response',
            value,
          )
          await append(
            events,
            createEvent('model_call_finished', {
              callId,
              ok: true,
              responseArtifact,
            }),
          )
          modelCallFinished = true
          return responseArtifact
        },
      })

      const providerStatus =
        result.status ??
        ({
          message: 'Provider answered successfully',
          level: 'info',
          stage: 'executing',
          reason: 'agent_runtime_execute',
          source: 'provider',
        } satisfies RuntimeStatusPayload)

      if (!modelCallFinished && requestArtifactPath) {
        await append(
          events,
          createEvent('model_call_finished', {
            callId,
            ok: providerStatus.level !== 'error',
            requestArtifact: requestArtifactPath,
            error:
              providerStatus.level === 'error'
                ? providerStatus.message
                : undefined,
            usage: result.usage,
            model: result.model,
            finishReason: result.finishReason,
          }),
        )
      }

      await append(
        events,
        createEvent('system_status', {
          ...providerStatus,
          ...responsePolicyPayload,
          usage: result.usage,
          model: result.model,
          finishReason: result.finishReason,
        }),
      )

      const providerToolCalls = normalizeProviderToolCalls(result.toolCalls)
      if (!providerToolCalls.length) {
        await append(
          events,
          createEvent('assistant_text', { text: result.text || '(empty response)' }),
        )
        await persistContextSnapshot(events)
        return events
      }

      const toolCall = providerToolCalls[0]
      await append(
        events,
        createEvent('tool_call', {
          toolCallId: toolCall.id,
          name: toolCall.name,
          input: toolCall.input,
          layer:
            toolCall.name === 'ask_user' || toolCall.name === 'finish'
              ? 'control'
              : 'real',
        }),
      )

      if (toolCall.name === 'ask_user') {
        await savePendingExecute({ status: 'waiting_user' })
        await append(
          events,
          createEvent('system_status', {
            message: 'Waiting for user reply',
            level: 'info',
            stage: 'waiting_user',
            reason: 'execute_waiting_user',
            source: 'runtime',
          }),
        )
        await append(
          events,
          createEvent('assistant_text', {
            text: String(toolCall.input.question ?? '(missing question)'),
          }),
        )
        await persistContextSnapshot(events)
        return events
      }

      if (toolCall.name === 'finish') {
        await savePendingExecute(null)
        await append(
          events,
          createEvent('tool_result', {
            toolCallId: toolCall.id,
            name: toolCall.name,
            ok: true,
            output: toolCall.input,
          }),
        )
        await append(
          events,
          createEvent('assistant_text', {
            text: String(toolCall.input.message ?? '(empty response)'),
          }),
        )
        await persistContextSnapshot(events)
        return events
      }

      if (getDefaultPermissionMode(toolCall.name) === 'confirm') {
        await savePendingExecute({
          status: 'waiting_permission',
          toolCallId: toolCall.id,
          toolName: toolCall.name as 'write' | 'edit' | 'bash',
          input: toolCall.input,
        })
        await append(
          events,
          createEvent('system_status', {
            message: `Waiting for permission to run ${toolCall.name}`,
            level: 'info',
            stage: 'waiting_permission',
            reason: 'execute_waiting_permission',
            source: 'permission',
            toolName: toolCall.name,
            input: toolCall.input,
          }),
        )
        await persistContextSnapshot(events)
        return events
      }

      const handler = executeCatalog.handlers[toolCall.name]
      try {
        const rawOutput = await handler(toolCall.input)
        const output = await persistToolOutput(rawOutput)
        await append(
          events,
          createEvent('tool_result', {
            toolCallId: toolCall.id,
            name: toolCall.name,
            ok: true,
            output,
          }),
        )
      } catch (error) {
        await append(
          events,
          createEvent('tool_result', {
            toolCallId: toolCall.id,
            name: toolCall.name,
            ok: false,
            error:
              error instanceof Error ? error.message : 'Unknown tool failure',
          }),
        )
      }
    }

    await append(
      events,
      createEvent('runtime_error', {
        message: 'Execute loop exceeded iteration limit',
      }),
    )
    return events
  }

  async function runTurn(userText: string) {
    await initialize()
    const events: EventRecord[] = []
    await append(events, createEvent('user_message', { text: userText }))

    const pendingExecute = await options.sessionStore?.readPendingExecute?.()
    if (pendingExecute?.status === 'waiting_user') {
      await savePendingExecute(null)
      return executeProviderTurn(events, null, {})
    }

    if (pendingExecute?.status === 'waiting_permission') {
      await savePendingExecute(null)

      if (isPermissionApproval(userText)) {
        const approvedHandler = executeCatalog.handlers[pendingExecute.toolName]

        try {
          const rawOutput = await approvedHandler(pendingExecute.input)
          const output = await persistToolOutput(rawOutput)
          await append(
            events,
            createEvent('tool_result', {
              toolCallId: pendingExecute.toolCallId,
              name: pendingExecute.toolName,
              ok: true,
              output,
            }),
          )
        } catch (error) {
          await append(
            events,
            createEvent('tool_result', {
              toolCallId: pendingExecute.toolCallId,
              name: pendingExecute.toolName,
              ok: false,
              error:
                error instanceof Error ? error.message : 'Unknown tool failure',
            }),
          )
        }
      } else if (isPermissionDenial(userText)) {
        await append(
          events,
          createEvent('tool_result', {
            toolCallId: pendingExecute.toolCallId,
            name: pendingExecute.toolName,
            ok: false,
            error: 'permission_denied',
          }),
        )
      } else {
        await append(
          events,
          createEvent('system_status', {
            message: 'Permission response not understood',
            level: 'warning',
            stage: 'waiting_permission',
            reason: 'execute_waiting_permission',
            source: 'runtime',
            toolName: pendingExecute.toolName,
            input: pendingExecute.input,
          }),
        )
        return events
      }

      return executeProviderTurn(events, null, {})
    }

    return stageOneProviderTurn(events, userText)
  }

  return {
    run(userText: string) {
      const task = queue.then(() => runTurn(userText))
      queue = task.catch(() => undefined)
      return task
    },
    readContext() {
      return [...history]
    },
  }
}
