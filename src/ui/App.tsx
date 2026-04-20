import React from 'react'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { Box } from 'ink'
import { useStdin } from 'ink'
import type {
  EventRecord,
  ProviderUsage,
  RuntimeStatusLevel,
  RuntimeStatusSource,
  RuntimeStatusPayload,
} from '../core/contracts'
import {
  listRecentSessions,
  loadSessionEvents,
} from '../commands/recentSessions'
import {
  runLocalTurn,
  type RunLocalTurnOptions,
} from '../runtime/defaultRunner'
import { projectEventsToRenderableItems } from './events/projectRenderableItems'
import { Header } from './components/Header'
import { PermissionDialog } from './components/PermissionDialog'
import { PromptInput } from './components/PromptInput'
import type { RuntimeStatusView } from './components/RuntimeStatus'
import { applyInputAction, createInputState } from './input/inputState'
import { parseKeyBuffer } from './input/keyParser'
import { enableRawMode } from './input/rawMode'
import { MessageList } from './messages/MessageList'
import {
  matchSlashCommands,
  resolveTuiCommand,
  type AppMode,
} from './tuiCommands'

async function defaultSubmit(
  text: string,
  sessionId: string,
  options: RunLocalTurnOptions,
): Promise<EventRecord[]> {
  return runLocalTurn(sessionId, text, options)
}

type Props = {
  initialEvents?: EventRecord[]
  initialSessionId?: string
  onSubmit?: (
    text: string,
    sessionId: string,
    options: RunLocalTurnOptions,
  ) => Promise<EventRecord[]>
  listRecentSessions?: typeof listRecentSessions
  loadSessionEvents?: typeof loadSessionEvents
}

type RuntimeStatusEventPayload = RuntimeStatusPayload & {
  usage?: ProviderUsage
  model?: string
  contextWindow?: number
}

type PendingPermissionRequest = {
  toolName: string
  input: Record<string, unknown>
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
      stage === 'waiting_user' ||
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

function latestPendingPermissionRequest(
  events: EventRecord[],
): PendingPermissionRequest | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.type !== 'system_status') continue
    if (event.payload.stage !== 'waiting_permission') continue
    if (typeof event.payload.toolName !== 'string') continue
    if (
      !event.payload.input ||
      typeof event.payload.input !== 'object' ||
      Array.isArray(event.payload.input)
    ) {
      continue
    }

    return {
      toolName: event.payload.toolName,
      input: event.payload.input as Record<string, unknown>,
    }
  }

  return null
}

function runsDir() {
  return join(cwd(), '.accorda', 'runs')
}

function runOptions(sessionId: string): RunLocalTurnOptions {
  return {
    eventLogPath: join(runsDir(), sessionId, 'events.jsonl'),
    artifactDir: join(runsDir(), sessionId, 'artifacts'),
    workspaceRoot: cwd(),
  }
}

export function App({
  initialEvents = [],
  initialSessionId = 'local',
  onSubmit = defaultSubmit,
  listRecentSessions: listRecentSessionsProp = listRecentSessions,
  loadSessionEvents: loadSessionEventsProp = loadSessionEvents,
}: Props) {
  const { stdin, setRawMode, isRawModeSupported } = useStdin()
  const [events, setEvents] = React.useState<EventRecord[]>(initialEvents)
  const [inputState, setInputState] = React.useState(createInputState())
  const [isLoading, setIsLoading] = React.useState(false)
  const [mode, setMode] = React.useState<AppMode>({ kind: 'compose' })
  const [sessionId, setSessionId] = React.useState(initialSessionId)
  const [pendingStatus, setPendingStatus] = React.useState<RuntimeStatusView>(
    createDefaultStatus(),
  )
  const inputStateRef = React.useRef(inputState)
  inputStateRef.current = inputState
  const modeRef = React.useRef(mode)
  modeRef.current = mode
  const sessionIdRef = React.useRef(sessionId)
  sessionIdRef.current = sessionId
  const loadingRef = React.useRef(isLoading)
  loadingRef.current = isLoading
  const pendingEscapeRef = React.useRef(false)
  const messages = React.useMemo(
    () => projectEventsToRenderableItems(events),
    [events],
  )
  const slashCandidates = React.useMemo(
    () => matchSlashCommands(inputState.value),
    [inputState.value],
  )
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
  const pendingPermissionRequest = React.useMemo(
    () => latestPendingPermissionRequest(events),
    [events],
  )
  const promptMode =
    mode.kind === 'resume_select'
      ? 'resume_select'
      : inputState.value.startsWith('/')
        ? 'command_mode'
        : 'compose'
  const helperLines =
    promptMode === 'command_mode'
      ? slashCandidates.map(candidate =>
          `${candidate.name.padEnd(8, ' ')}${candidate.description}`,
        )
      : mode.kind === 'resume_select'
        ? mode.sessions.map(
            (session, index) =>
              `${index + 1}. ${session.sessionId}  ${session.preview}`,
          )
        : ['Try "read package.json" or start with / for commands']

  function setInputStateSynced(nextState: ReturnType<typeof createInputState>) {
    inputStateRef.current = nextState
    setInputState(nextState)
  }

  function setModeSynced(nextMode: AppMode) {
    modeRef.current = nextMode
    setMode(nextMode)
  }

  function setSessionIdSynced(nextSessionId: string) {
    sessionIdRef.current = nextSessionId
    setSessionId(nextSessionId)
  }

  async function handleSubmit(submittedValue: string) {
    const text = submittedValue.trim()
    if (!text) return

    const commandResult = await resolveTuiCommand(text, sessionIdRef.current, modeRef.current, {
      runsDir: runsDir(),
      listRecentSessions: listRecentSessionsProp,
      loadSessionEvents: loadSessionEventsProp,
    })

    if (commandResult.kind === 'show_help') {
      setEvents(current => [...current, commandResult.event])
      setInputStateSynced(createInputState())
      return
    }

    if (commandResult.kind === 'new_session') {
      setSessionIdSynced(commandResult.sessionId)
      setEvents([])
      setModeSynced({ kind: 'compose' })
      setPendingStatus(createDefaultStatus())
      setInputStateSynced(createInputState())
      return
    }

    if (commandResult.kind === 'resume_prompt') {
      setModeSynced(commandResult.mode)
      setEvents(current => [...current, commandResult.event])
      setInputStateSynced(createInputState())
      return
    }

    if (commandResult.kind === 'resume_loaded') {
      setSessionIdSynced(commandResult.sessionId)
      setEvents(commandResult.events)
      setModeSynced(commandResult.mode)
      setPendingStatus(
        latestRuntimeStatus(commandResult.events) ?? createDefaultStatus(),
      )
      setInputStateSynced(createInputState())
      return
    }

    if (commandResult.kind === 'resume_invalid') {
      setEvents(current => [...current, commandResult.event])
      setInputStateSynced(createInputState())
      return
    }

    setIsLoading(true)
    setPendingStatus(
      createDefaultStatus({
        stage: 'routing',
        reason: 'awaiting_turn_result',
        message: 'Waiting for runtime result',
      }),
    )
    try {
      const nextEvents = await onSubmit(
        text,
        sessionIdRef.current,
        runOptions(sessionIdRef.current),
      )
      setEvents(current => [...current, ...nextEvents])
      const nextStatus = latestRuntimeStatus(nextEvents)
      if (nextStatus) {
        setPendingStatus(nextStatus)
      }
    } finally {
      setIsLoading(false)
      setInputStateSynced(createInputState())
    }
  }

  React.useEffect(
    () => enableRawMode({ isRawModeSupported, setRawMode }),
    [isRawModeSupported, setRawMode],
  )

  React.useEffect(() => {
    function onData(data: Buffer | string) {
      if (loadingRef.current) return

      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)

      if (buffer.length === 1 && buffer[0] === 27) {
        pendingEscapeRef.current = true
        return
      }

      if (
        pendingEscapeRef.current &&
        buffer.length === 1 &&
        buffer[0] === 13
      ) {
        pendingEscapeRef.current = false
        const nextState = applyInputAction(inputStateRef.current, {
          type: 'submit',
        })
        inputStateRef.current = nextState
        void handleSubmit(nextState.value)
        return
      }

      pendingEscapeRef.current = false
      const action = parseKeyBuffer(buffer)
      if (!action) return

      const nextState = applyInputAction(inputStateRef.current, action)
      if (action.type === 'submit') {
        inputStateRef.current = nextState
        void handleSubmit(nextState.value)
        return
      }

      setInputStateSynced(nextState)
    }

    stdin.on('data', onData)
    return () => {
      stdin.off('data', onData)
    }
  }, [stdin])

  return (
    <Box flexDirection="column" padding={1} gap={1}>
      <Header sessionId={sessionId} runtimeStatus={runtimeStatus} />
      <Box flexDirection="column">
        <MessageList messages={messages} isLoading={isLoading} />
      </Box>
      <PermissionDialog pendingRequest={pendingPermissionRequest} />
      <Box>
        <PromptInput
          value={inputState.value}
          cursor={inputState.cursor}
          isLoading={isLoading}
          mode={promptMode}
          helperLines={helperLines}
        />
      </Box>
    </Box>
  )
}
