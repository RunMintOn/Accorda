import React from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { cwd } from 'node:process'
import type { ThinkingLevel } from '@earendil-works/pi-agent-core'
import type { Model } from '@earendil-works/pi-ai/compat'
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  type AgentSession,
} from '@earendil-works/pi-coding-agent'
import { createAccordaExtension } from './accordaExtension.js'
import { configureProxyFromEnv } from './httpProxy.js'
import { ensureLocalPiAgentDir, getLocalPiAgentDir } from './localPiAgent.js'
import {
  createReadableTraceLog,
  shortTraceId,
  type ReadableTraceLog,
  type TaskStatus,
} from '../trace/readableTrace.js'
import {
  findConfiguredModel,
  loadPiTuiSettings,
  modelKey,
  savePiTuiSettings,
  scopedAvailableModels,
  type PiTuiSettings,
} from './piTuiSettings.js'

const thinkingLevels: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']
const enabledTools = ['read', 'grep', 'find', 'ls', 'bash', 'edit', 'write', 'append', 'task_start', 'task_update']
const readyMessages = [
  'Accorda 准备好了 _^',
  'Accorda 在线 _<',
  'Accorda 正在听 _^',
  'Accorda 待命中 _<',
  'Accorda 可以开始了 _<',
]

type Message = {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  text: string
}

type Phase =
  | { kind: 'booting' }
  | { kind: 'select_model'; models: Model<any>[]; selected: number; query: string }
  | { kind: 'select_thinking'; selected: number }
  | { kind: 'creating_session'; model: Model<any>; thinkingLevel: ThinkingLevel; localAgentDir: string }
  | { kind: 'chat' }
  | { kind: 'error'; message: string }

type Runtime = {
  session: AgentSession
  traceLog: ReadableTraceLog
  model: Model<any>
  thinkingLevel: ThinkingLevel
  tracePath: string
}

function modelLabel(model: Model<any>) {
  const candidate = model as unknown as { provider?: string; id?: string; name?: string }
  return `${candidate.provider ?? 'unknown'}/${candidate.id ?? candidate.name ?? 'unknown'}`
}

function compactModelLabel(model: Model<any>) {
  const candidate = model as unknown as { id?: string; name?: string }
  return candidate.id ?? candidate.name ?? 'unknown'
}

function taskModeGuidance() {
  return `Accorda provides lightweight task and trace behavior. Use task_start conservatively: only when the user explicitly asks for Task Mode, or when visible task tracking would materially help complex, multi-step, stateful, risky, or validation-heavy work. If uncertain, continue normally or briefly ask the user whether to use Task Mode. Do not use Task Mode for simple answers or one-off explanations. task_start and task_update only update visible task state; they do not perform the user's work. For bash, edit, write, and append, intent is required and should be a concise, specific, user-visible purpose of the tool call.`
}

function taskModePrompt(goal: string) {
  return `Accorda Task Mode is active. User goal: ${goal}\n\nWork normally, but maintain visible task state with task_update. Start in aligning status: understand the real goal, do not assume the user's proposed solution is correct, inspect local context when needed, and ask only when uncertainty materially affects the next step. Move to executing with task_update when the goal and path are clear. Use task_update for meaningful progress, blockers, completion, or cancellation; do not record trivial micro-actions. For bash, edit, write, and append, provide a concise specific intent.`
}

function isTaskInput(text: string) {
  return text.startsWith('/task ')
}

function stripTaskPrefix(text: string) {
  return text.replace(/^\/task\s+/, '').trim()
}

function pushMessage(setMessages: React.Dispatch<React.SetStateAction<Message[]>>, message: Omit<Message, 'id'>) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
  setMessages(current => [...current, { id, ...message }])
  return id
}

function appendToMessage(setMessages: React.Dispatch<React.SetStateAction<Message[]>>, id: string, delta: string) {
  setMessages(current =>
    current.map(message => (message.id === id ? { ...message, text: `${message.text}${delta}` } : message)),
  )
}

function replaceMessage(setMessages: React.Dispatch<React.SetStateAction<Message[]>>, id: string, text: string) {
  setMessages(current =>
    current.map(message => (message.id === id ? { ...message, text } : message)),
  )
}

function toolIntent(args: unknown) {
  if (!args || typeof args !== 'object') return ''
  const intent = (args as { intent?: unknown }).intent
  return typeof intent === 'string' ? intent.trim() : ''
}

function toolTarget(toolName: string, args: unknown) {
  if (!args || typeof args !== 'object') return ''
  const input = args as { command?: unknown; path?: unknown; edits?: unknown; content?: unknown }
  if (toolName === 'bash' && typeof input.command === 'string') return input.command
  if (typeof input.path === 'string') return input.path
  return ''
}

function toolResultSummary(result: unknown, isError: boolean) {
  const text = textFromUnknownMessage(result)
  const exitCode = text.match(/exit code:?\s*(\d+)/i)?.[1]
  if (exitCode) return `${isError ? '✗' : '✓'} exit code ${exitCode}`
  return isError ? '✗ failed' : '✓ done'
}

function assistantTextFromMessages(messages: unknown[]) {
  const lastAssistant = [...messages].reverse().find(message => {
    if (!message || typeof message !== 'object') return false
    return (message as { role?: unknown }).role === 'assistant'
  })
  return textFromUnknownMessage(lastAssistant).trim()
}

function textFromUnknownMessage(message: unknown): string {
  if (!message || typeof message !== 'object') return ''
  const candidate = message as { content?: unknown; text?: unknown; parts?: unknown }
  if (typeof candidate.text === 'string') return candidate.text
  if (typeof candidate.content === 'string') return candidate.content
  if (Array.isArray(candidate.content)) return candidate.content.map(textFromContentPart).join('')
  if (Array.isArray(candidate.parts)) return candidate.parts.map(textFromContentPart).join('')
  return ''
}

function textFromContentPart(part: unknown): string {
  if (typeof part === 'string') return part
  if (!part || typeof part !== 'object') return ''
  const value = part as { text?: unknown; content?: unknown }
  if (typeof value.text === 'string') return value.text
  if (typeof value.content === 'string') return value.content
  return ''
}

async function createRuntime({
  model,
  thinkingLevel,
  localAgentDir,
  setMessages,
  assistantMessageIdRef,
  streamedTextRef,
  toolMessageIdsRef,
  setTaskStatus,
}: {
  model: Model<any>
  thinkingLevel: ThinkingLevel
  localAgentDir: string
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  assistantMessageIdRef: React.MutableRefObject<string | null>
  streamedTextRef: React.MutableRefObject<boolean>
  toolMessageIdsRef: React.MutableRefObject<Map<string, string>>
  setTaskStatus: React.Dispatch<React.SetStateAction<TaskStatus | null>>
}): Promise<Runtime> {
  const traceId = shortTraceId()
  const runDir = join(cwd(), '.accorda', 'pi-runs', traceId)
  await mkdir(runDir, { recursive: true })
  const traceLog = createReadableTraceLog(join(runDir, 'trace.jsonl'), traceId)
  let taskStatus: TaskStatus = 'aligning'

  const authStorage = AuthStorage.create(join(localAgentDir, 'auth.json'))
  const modelRegistry = ModelRegistry.create(authStorage, join(localAgentDir, 'models.json'))
  const loader = new DefaultResourceLoader({
    cwd: cwd(),
    agentDir: localAgentDir,
    systemPromptOverride: base => `${base ?? ''}\n\n${taskModeGuidance()}`.trim(),
    extensionFactories: [
      createAccordaExtension({
        traceLog,
        initialMode: 'chat',
        initialTaskStatus: taskStatus,
        onTaskStatusChange: status => {
          taskStatus = status
          setTaskStatus(status)
        },
      }),
    ],
  })
  await loader.reload()

  const { session } = await createAgentSession({
    cwd: cwd(),
    agentDir: localAgentDir,
    authStorage,
    modelRegistry,
    model,
    thinkingLevel,
    resourceLoader: loader,
    sessionManager: SessionManager.inMemory(cwd()),
    tools: enabledTools,
  })

  session.subscribe(event => {
    if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
      streamedTextRef.current = true
      let assistantId = assistantMessageIdRef.current
      if (!assistantId) {
        assistantId = pushMessage(setMessages, { role: 'assistant', text: '' })
        assistantMessageIdRef.current = assistantId
      }
      appendToMessage(setMessages, assistantId, event.assistantMessageEvent.delta)
    }

    if (event.type === 'tool_execution_start') {
      const toolEvent = event as unknown as { toolCallId: string; toolName: string; args: unknown }
      if (toolEvent.toolName === 'task_start' || toolEvent.toolName === 'task_update') return
      const intent = toolIntent(toolEvent.args) || toolEvent.toolName
      const target = toolTarget(toolEvent.toolName, toolEvent.args)
      const id = pushMessage(setMessages, {
        role: 'tool',
        text: `${intent}\n  ${toolEvent.toolName}${target ? ` · ${target}` : ''} · running`,
      })
      toolMessageIdsRef.current.set(toolEvent.toolCallId, id)
    }
    if (event.type === 'tool_execution_end') {
      const toolEvent = event as unknown as { toolCallId: string; toolName: string; result: unknown; isError: boolean }
      if (toolEvent.toolName === 'task_start') {
        pushMessage(setMessages, { role: 'system', text: '任务模式已启动' })
        setTaskStatus('aligning')
        return
      }
      if (toolEvent.toolName === 'task_update') {
        const details = (toolEvent.result as { details?: { status?: string } } | undefined)?.details
        const status = details?.status
        pushMessage(setMessages, { role: 'system', text: status ? `任务状态：${status}` : '任务状态已更新' })
        return
      }
      const id = toolMessageIdsRef.current.get(toolEvent.toolCallId)
      if (!id) return
      const previous = toolResultSummary(toolEvent.result, toolEvent.isError)
      setMessages(current =>
        current.map(message =>
          message.id === id
            ? { ...message, text: message.text.replace(/ · running$/, ` · ${previous}`) }
            : message,
        ),
      )
      toolMessageIdsRef.current.delete(toolEvent.toolCallId)
    }
    if (event.type === 'auto_retry_start') {
      const message = (event as unknown as { errorMessage?: string }).errorMessage ?? 'auto retry'
      pushMessage(setMessages, { role: 'system', text: `[retry] ${message}` })
    }
    if (event.type === 'auto_retry_end') {
      const retryEvent = event as unknown as { success?: boolean; finalError?: string }
      if (!retryEvent.success && retryEvent.finalError) {
        pushMessage(setMessages, { role: 'system', text: `[error] ${retryEvent.finalError}` })
      }
    }
  })

  return {
    session,
    traceLog,
    model,
    thinkingLevel,
    tracePath: traceLog.path,
  }
}

export function PiTuiApp() {
  const { exit } = useApp()
  const [phase, setPhase] = React.useState<Phase>({ kind: 'booting' })
  const [runtime, setRuntime] = React.useState<Runtime | null>(null)
  const [settings, setSettings] = React.useState<PiTuiSettings | null>(null)
  const [availableModels, setAvailableModels] = React.useState<Model<any>[]>([])
  const [messages, setMessages] = React.useState<Message[]>([])
  const [inputValue, setInputValue] = React.useState('')
  const [isWorking, setIsWorking] = React.useState(false)
  const assistantMessageIdRef = React.useRef<string | null>(null)
  const streamedTextRef = React.useRef(false)
  const toolMessageIdsRef = React.useRef(new Map<string, string>())
  const [taskStatus, setTaskStatus] = React.useState<TaskStatus | null>(null)
  const [readyMessage] = React.useState(
    () => readyMessages[Math.floor(Math.random() * readyMessages.length)] ?? readyMessages[0],
  )

  React.useEffect(() => {
    configureProxyFromEnv()
    let cancelled = false
    async function boot() {
      try {
        const localAgentDir = await ensureLocalPiAgentDir(getLocalPiAgentDir())
        const authStorage = AuthStorage.create(join(localAgentDir, 'auth.json'))
        const modelRegistry = ModelRegistry.create(authStorage, join(localAgentDir, 'models.json'))
        const models = modelRegistry.getAvailable()
        if (!models.length) {
          throw new Error('没有可用模型。请先运行 pi 并通过 /login 登录，或检查 .accorda/pi-agent/auth.json。')
        }
        const nextSettings = await loadPiTuiSettings()
        const model = findConfiguredModel(models, nextSettings)
        if (!model) throw new Error('没有可用模型。请先运行 pi 并通过 /login 登录。')
        if (!cancelled) {
          setSettings(nextSettings)
          setAvailableModels(models)
          setPhase({
            kind: 'creating_session',
            model,
            thinkingLevel: nextSettings.thinkingLevel ?? 'medium',
            localAgentDir,
          })
        }
      } catch (error) {
        if (!cancelled) setPhase({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (phase.kind !== 'creating_session') return
    let cancelled = false
    createRuntime({
      model: phase.model,
      thinkingLevel: phase.thinkingLevel,
      localAgentDir: phase.localAgentDir,
      setMessages,
      assistantMessageIdRef,
      streamedTextRef,
      toolMessageIdsRef,
      setTaskStatus,
    }).then(
      nextRuntime => {
        if (cancelled) {
          nextRuntime.session.dispose()
          return
        }
        setRuntime(nextRuntime)
        setPhase({ kind: 'chat' })
      },
      error => {
        if (!cancelled) setPhase({ kind: 'error', message: error instanceof Error ? error.message : String(error) })
      },
    )
    return () => {
      cancelled = true
    }
  }, [phase])

  React.useEffect(() => () => runtime?.session.dispose(), [runtime])

  useInput((input, key) => {
    if (phase.kind === 'error') {
      if (key.return || input === 'q') exit()
      return
    }

    if (phase.kind === 'select_model') {
      const filtered = filterModels(phase.models, phase.query)
      if (key.escape) {
        setPhase({ kind: 'chat' })
        return
      }
      if (key.upArrow) setPhase({ ...phase, selected: Math.max(0, phase.selected - 1) })
      if (key.downArrow) setPhase({ ...phase, selected: Math.min(filtered.length - 1, phase.selected + 1) })
      if (key.backspace || key.delete) {
        setPhase({ ...phase, query: phase.query.slice(0, -1), selected: 0 })
        return
      }
      if (key.return) {
        const model = filtered[phase.selected]
        if (model) void switchModel(model)
        return
      }
      if (input && !key.meta && !key.ctrl) {
        setPhase({ ...phase, query: `${phase.query}${input}`, selected: 0 })
      }
      return
    }

    if (phase.kind === 'select_thinking') {
      if (key.escape) {
        setPhase({ kind: 'chat' })
        return
      }
      if (key.upArrow) setPhase({ ...phase, selected: Math.max(0, phase.selected - 1) })
      if (key.downArrow) setPhase({ ...phase, selected: Math.min(thinkingLevels.length - 1, phase.selected + 1) })
      if (key.return) void switchThinking(thinkingLevels[phase.selected])
      return
    }

    if (phase.kind !== 'chat' || isWorking) return
    if (key.ctrl && input === 'c') {
      exit()
      return
    }
    if (key.return) {
      const text = inputValue.trim()
      setInputValue('')
      if (!text) return
      if (text === '/exit' || text === '/quit') {
        exit()
        return
      }
      if (text === '/task') {
        pushMessage(setMessages, { role: 'system', text: '请输入任务目标：/task <目标>' })
        return
      }
      if (text === '/model') {
        setPhase({
          kind: 'select_model',
          models: scopedAvailableModels(availableModels, settings ?? { scopedModels: [] }),
          selected: 0,
          query: '',
        })
        return
      }
      if (text === '/think' || text === '/thinking') {
        setPhase({
          kind: 'select_thinking',
          selected: Math.max(0, thinkingLevels.indexOf(runtime?.thinkingLevel ?? 'medium')),
        })
        return
      }
      void submit(text)
      return
    }
    if (key.backspace || key.delete) {
      setInputValue(current => current.slice(0, -1))
      return
    }
    if (input && !key.meta && !key.ctrl) {
      setInputValue(current => `${current}${input}`)
    }
  }, { isActive: Boolean(process.stdin.isTTY) })

  async function switchModel(model: Model<any>) {
    if (!runtime || !settings) return
    await runtime.session.setModel(model)
    const key = modelKey(model)
    const nextSettings = { ...settings, model: key }
    await savePiTuiSettings(nextSettings)
    setSettings(nextSettings)
    setRuntime({ ...runtime, model })
    pushMessage(setMessages, { role: 'system', text: `已切换模型：${modelLabel(model)}` })
    setPhase({ kind: 'chat' })
  }

  async function switchThinking(thinkingLevel: ThinkingLevel) {
    if (!runtime || !settings) return
    runtime.session.setThinkingLevel(thinkingLevel)
    const nextSettings = { ...settings, thinkingLevel }
    await savePiTuiSettings(nextSettings)
    setSettings(nextSettings)
    setRuntime({ ...runtime, thinkingLevel })
    pushMessage(setMessages, { role: 'system', text: `已切换思考等级：${thinkingLevel}` })
    setPhase({ kind: 'chat' })
  }

  async function submit(text: string) {
    if (!runtime) return
    const task = isTaskInput(text)
    const inputText = task ? stripTaskPrefix(text) : text
    setIsWorking(true)
    pushMessage(setMessages, { role: 'user', text })
    assistantMessageIdRef.current = null
    streamedTextRef.current = false
    if (task) setTaskStatus('aligning')

    await runtime.traceLog.append({
      type: 'trace_started',
      mode: task ? 'task' : 'chat',
      input: inputText,
      status: 'running',
    })
    if (task) {
      await runtime.traceLog.append({
        type: 'task_started',
        mode: 'task',
        status: 'aligning',
        task: inputText,
      })
    }

    try {
      await runtime.session.prompt(task ? taskModePrompt(inputText) : inputText)
      if (!streamedTextRef.current) {
        const finalText = assistantTextFromMessages(runtime.session.messages as unknown[])
        if (finalText) pushMessage(setMessages, { role: 'assistant', text: finalText })
        const errorMessage = (runtime.session.agent.state as { errorMessage?: string }).errorMessage
        if (errorMessage) pushMessage(setMessages, { role: 'system', text: `[error] ${errorMessage}` })
      }
      await runtime.traceLog.append({
        type: 'trace_finished',
        mode: task ? 'task' : 'chat',
        status: 'completed',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      pushMessage(setMessages, { role: 'system', text: `[error] ${message}` })
      await runtime.traceLog.append({
        type: 'trace_finished',
        mode: task ? 'task' : 'chat',
        status: 'failed',
        summary: message,
      })
    } finally {
      assistantMessageIdRef.current = null
      setIsWorking(false)
    }
  }

  return (
    <Box flexDirection="column" padding={1} gap={1}>
      <Header phase={phase} runtime={runtime} readyMessage={readyMessage} />
      <Body phase={phase} runtime={runtime} messages={messages} inputValue={inputValue} isWorking={isWorking} taskStatus={taskStatus} />
    </Box>
  )
}

function Header({ phase, runtime: _runtime, readyMessage }: { phase: Phase; runtime: Runtime | null; readyMessage: string }) {
  return (
    <Box flexDirection="column">
      <Text bold color="#ff8c00">{readyMessage}</Text>
      {phase.kind === 'booting' || phase.kind === 'creating_session' ? (
        <Text color="gray">{phase.kind === 'booting' ? 'Loading local config...' : 'Starting...'}</Text>
      ) : null}
    </Box>
  )
}

function Body({
  phase,
  runtime,
  messages,
  inputValue,
  isWorking,
  taskStatus,
}: {
  phase: Phase
  runtime: Runtime | null
  messages: Message[]
  inputValue: string
  isWorking: boolean
  taskStatus: TaskStatus | null
}) {
  if (phase.kind === 'booting' || phase.kind === 'creating_session') return <Text color="yellow">Preparing session...</Text>
  if (phase.kind === 'error') return <Text color="red">{phase.message}</Text>
  if (phase.kind === 'select_model') {
    const filtered = filterModels(phase.models, phase.query)
    return <SelectList title="选择模型（输入可搜索，Esc 返回）" items={filtered.map(modelLabel)} selected={phase.selected} query={phase.query} />
  }
  if (phase.kind === 'select_thinking') return <SelectList title="选择思考等级（Esc 返回）" items={thinkingLevels} selected={phase.selected} />

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        {messages.length === 0 ? null : null}
        {messages.slice(-18).map(message => <MessageLine key={message.id} message={message} />)}
      </Box>
      <Box justifyContent="space-between">
        <Text color={taskStatus ? 'yellow' : 'gray'}>{taskStatus ? `task:${taskStatus}` : 'chat'}</Text>
      </Box>
      <Box borderStyle="single" borderColor={isWorking ? 'yellow' : 'gray'}>
        <Text>{isWorking ? '> Working...' : `> ${inputValue}|`}</Text>
      </Box>
      <Box justifyContent="space-between">
        <Text color="gray">Enter · /model · /think · /task · /exit</Text>
        <Text color="gray">{runtime ? `${compactModelLabel(runtime.model)} · ${runtime.thinkingLevel}` : ''}</Text>
      </Box>
    </Box>
  )
}

function filterModels(models: Model<any>[], query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return models
  return models.filter(model => modelLabel(model).toLowerCase().includes(normalized))
}

function SelectList({ title, items, selected, query }: { title: string; items: string[]; selected: number; query?: string }) {
  const windowSize = 20
  const start = Math.min(
    Math.max(0, selected - Math.floor(windowSize / 2)),
    Math.max(0, items.length - windowSize),
  )
  const visibleItems = items.slice(start, start + windowSize)

  return (
    <Box flexDirection="column">
      <Text bold>{title}</Text>
      {query !== undefined ? <Text color="gray">搜索：{query || ' '}</Text> : null}
      {visibleItems.map((item, offset) => {
        const index = start + offset
        return (
          <Text key={`${index}-${item}`} color={index === selected ? 'cyan' : undefined}>
            {index === selected ? '› ' : '  '}{item}
          </Text>
        )
      })}
      {items.length > windowSize ? (
        <Text color="gray">显示 {start + 1}-{start + visibleItems.length} / {items.length}</Text>
      ) : null}
      <Text color="gray">↑/↓ 选择，Enter 确认</Text>
    </Box>
  )
}

function MessageLine({ message }: { message: Message }) {
  if (message.role === 'user') return <Text color="green">› {message.text}</Text>
  if (message.role === 'assistant') return <Text>  {message.text || '…'}</Text>
  if (message.role === 'tool') return <Text color="yellow">◇ {message.text}</Text>
  return <Text color="gray">· {message.text}</Text>
}
