import React from 'react'
import { Box } from 'ink'
import type {
  EventRecord,
  ProviderUsage,
  RuntimeStatusLevel,
  RuntimeStatusSource,
  RuntimeStatusPayload,
} from '../core/contracts'
import { runLocalTurn } from '../runtime/defaultRunner'
import { projectEventsToMessages } from './events/projectEvents'
import { Header } from './components/Header'
import { PermissionDialog } from './components/PermissionDialog'
import { PromptInput } from './components/PromptInput'
import type { RuntimeStatusView } from './components/RuntimeStatus'
import { MessageList } from './messages/MessageList'

type Props = {
  initialEvents?: EventRecord[]
  onSubmit?: (text: string) => Promise<EventRecord[]>
}

async function defaultSubmit(text: string): Promise<EventRecord[]> {
  return runLocalTurn('local', text)
}

type RuntimeStatusEventPayload = RuntimeStatusPayload & {
  usage?: ProviderUsage
  model?: string
  contextWindow?: number
}

function isRuntimeStatusEventPayload(
  payload: Record<string, unknown>,
): payload is RuntimeStatusEventPayload {
  const level = payload.level
  const stage = payload.stage

  return (
    typeof payload.message === 'string' &&
    typeof payload.reason === 'string' &&
    (level === 'info' || level === 'warning' || level === 'error') &&
    (stage === 'idle' ||
      stage === 'routing' ||
      stage === 'answering' ||
      stage === 'executing' ||
      stage === 'waiting_permission' ||
      stage === 'error')
  )
}

function createDefaultStatus(
  overrides: Partial<RuntimeStatusView> = {},
): RuntimeStatusView {
  return {
    stage: 'idle',
    reason: 'ready_for_input',
    message: 'Ready for input',
    level: 'info',
    source: 'runtime',
    ...overrides,
  }
}

function latestRuntimeStatus(events: EventRecord[]): RuntimeStatusView | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.type !== 'system_status') continue
    if (!isRuntimeStatusEventPayload(event.payload)) continue

    return {
      stage: event.payload.stage,
      reason: event.payload.reason,
      message: event.payload.message,
      level: event.payload.level as RuntimeStatusLevel,
      source: event.payload.source as RuntimeStatusSource | undefined,
      usage: event.payload.usage,
      model: event.payload.model,
      contextWindow: event.payload.contextWindow,
    }
  }

  return null
}

export function App({ initialEvents = [], onSubmit = defaultSubmit }: Props) {
  const [events, setEvents] = React.useState<EventRecord[]>(initialEvents)
  const [input, setInput] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [pendingStatus, setPendingStatus] = React.useState<RuntimeStatusView>(
    createDefaultStatus(),
  )
  const pendingPermissionRequest = null
  const inputRef = React.useRef(input)
  inputRef.current = input
  const messages = React.useMemo(() => projectEventsToMessages(events), [events])
  const runtimeStatus = React.useMemo(
    () =>
      latestRuntimeStatus(events) ??
      (isLoading
        ? createDefaultStatus({
            stage: 'routing',
            reason: 'awaiting_turn_result',
            message: 'Waiting for runtime result',
          })
        : pendingStatus),
    [events, isLoading, pendingStatus],
  )

  async function handleSubmit(submittedValue?: string) {
    const text = (submittedValue ?? inputRef.current).trim()
    if (!text) return

    setInput('')
    setIsLoading(true)
    setPendingStatus(
      createDefaultStatus({
        stage: 'routing',
        reason: 'awaiting_turn_result',
        message: 'Waiting for runtime result',
      }),
    )
    try {
      const nextEvents = await onSubmit(text)
      setEvents(current => [...current, ...nextEvents])
      const nextStatus = latestRuntimeStatus(nextEvents)
      if (nextStatus) {
        setPendingStatus(nextStatus)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box flexDirection="column" padding={1} gap={1}>
      <Header sessionId="local" runtimeStatus={runtimeStatus} />
      <Box flexDirection="column">
        <MessageList messages={messages} isLoading={isLoading} />
      </Box>
      <PermissionDialog pendingRequest={pendingPermissionRequest} />
      <Box>
        <PromptInput
          value={input}
          isLoading={isLoading}
          onChange={setInput}
          onSubmit={handleSubmit}
        />
      </Box>
    </Box>
  )
}
