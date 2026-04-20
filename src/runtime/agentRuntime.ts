import { randomUUID } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { cwd } from 'node:process'
import type { EventRecord, RuntimeStatusPayload } from '../core/contracts.js'
import type { ProviderTextResult } from '../provider/openaiClient.js'
import {
  createReadOnlyTools,
  parseReadOnlyToolRequest,
  READ_ONLY_TOOL_NAMES,
  type ReadOnlyToolHandler,
  type ReadOnlyToolName,
} from '../tools/readOnly.js'
import {
  controlDecisionStatus,
  defaultControlDecision,
  type ControlDecisionRunner,
} from './controlDecision.js'
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
  toolNames: ReadOnlyToolName[]
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

export type AgentRuntimeOptions = {
  sessionId?: string
  workspaceRoot?: string
  provider: RuntimeProvider
  eventStore?: EventStore
  artifactDir?: string
  contextWindowChars?: number
  contextPersistRatio?: number
  toolResultPersistBytes?: number
  tools?: Partial<Record<ReadOnlyToolName, ReadOnlyToolHandler>>
  controlDecision?: ControlDecisionRunner
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
  const tools = { ...createReadOnlyTools(workspaceRoot), ...options.tools }
  const decideControl = options.controlDecision ?? defaultControlDecision

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

  function providerMessages(responsePolicy: ResponsePolicy | null) {
    const messages: ProviderMessage[] = [
      {
        role: 'system',
        content:
          'You are Accorda, a minimal local coding assistant runtime. Answer concisely and use prior context when useful.',
      },
      {
        role: 'system',
        content:
          'Tools: ls, read, glob, grep. Tool results may appear in context; API tool-calls are not enabled yet.',
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

  async function runTurn(userText: string) {
    await initialize()
    const events: EventRecord[] = []
    await append(events, createEvent('user_message', { text: userText }))

    const controlDecision = await decideControl({ sessionId, userText })
    const responsePolicy = selectResponsePolicy(controlDecision)
    const responsePolicyPayload = responsePolicy
      ? responsePolicyMetadata(responsePolicy)
      : {}
    const controlStatus = controlDecisionStatus(controlDecision)
    await append(
      events,
      createEvent('runtime_decision', {
        layer: 'stage_one',
        decision: controlDecision.kind,
        reason: controlDecision.reason ?? `stage_one_${controlDecision.kind}`,
        responsePolicyId: responsePolicyPayload.responsePolicyId,
        responsePolicyMode: responsePolicyPayload.responsePolicyMode,
        responseStyle: responsePolicyPayload.responseStyle,
      }),
    )
    await append(
      events,
      createEvent('system_status', {
        ...controlStatus,
        controlDecision: controlDecision.kind,
        ...responsePolicyPayload,
      }),
    )

    const toolRequest =
      controlDecision.kind === 'execute' ? parseReadOnlyToolRequest(userText) : null
    if (toolRequest) {
      const toolCallId = id()
      await append(
        events,
        createEvent('system_status', {
          message: `Running ${toolRequest.name}`,
          level: 'info',
          stage: 'executing',
          reason: 'read_only_tool_request',
          source: 'runtime',
        }),
      )
      await append(
        events,
        createEvent('tool_call', {
          toolCallId,
          name: toolRequest.name,
          input: toolRequest.input,
          layer: 'real',
        }),
      )

      try {
        const rawOutput = await tools[toolRequest.name](toolRequest.input)
        const output = await persistToolOutput(rawOutput)
        await append(
          events,
          createEvent('tool_result', {
            toolCallId,
            name: toolRequest.name,
            ok: true,
            output,
          }),
        )
      } catch (error) {
        await append(
          events,
          createEvent('tool_result', {
            toolCallId,
            name: toolRequest.name,
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown tool failure',
          }),
        )
      }
    }

    const callId = id()
    const messages = providerMessages(responsePolicy)
    const toolNames = READ_ONLY_TOOL_NAMES
    const layer = controlDecision.kind === 'execute' ? 'stage_two' : 'stage_one'
    let requestArtifactPath: string | undefined
    let modelCallFinished = false
    const result = await options.provider({
      callId,
      messages,
      toolNames,
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
            layer,
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

    const providerStatus =
      result.status ??
      ({
        message: 'Provider answered successfully',
        level: 'info',
        stage: 'answering',
        reason: 'agent_runtime_answer',
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
            providerStatus.level === 'error' ? providerStatus.message : undefined,
          usage: result.usage,
          model: result.model,
          finishReason: result.finishReason,
        }),
      )
      modelCallFinished = true
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
    await append(events, createEvent('assistant_text', { text: result.text || '(empty response)' }))
    await persistContextSnapshot(events)

    return events
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
