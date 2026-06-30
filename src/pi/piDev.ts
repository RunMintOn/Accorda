import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
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
} from '@earendil-works/pi-coding-agent'
import { createAccordaExtension } from './accordaExtension.js'
import { ensureLocalPiAgentDir, getLocalPiAgentDir } from './localPiAgent.js'
import { configureProxyFromEnv } from './httpProxy.js'
import {
  createReadableTraceLog,
  shortTraceId,
  type TaskStatus,
} from '../trace/readableTrace.js'

const thinkingLevels: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']

function modelLabel(model: Model<any>) {
  const candidate = model as unknown as { provider?: string; id?: string; name?: string }
  return `${candidate.provider ?? 'unknown'}/${candidate.id ?? candidate.name ?? 'unknown'}`
}

function taskModeGuidance() {
  return `Accorda provides lightweight task and trace behavior. Use task_start conservatively: only when the user explicitly asks for Task Mode, or when visible task tracking would materially help complex, multi-step, stateful, risky, or validation-heavy work. If uncertain, continue normally or briefly ask the user whether to use Task Mode. Do not use Task Mode for simple answers or one-off explanations. task_start and task_update only update visible task state; they do not perform the user's work. For bash, edit, write, and append, intent is required and should be a concise, specific, user-visible purpose of the tool call.`
}

async function chooseModel(rl: ReturnType<typeof createInterface>, models: Model<any>[]) {
  if (!models.length) {
    throw new Error('No available Pi models. Run pi /login and select a model first.')
  }

  console.log('\nAvailable models:')
  models.slice(0, 30).forEach((model, index) => {
    console.log(`  ${index + 1}. ${modelLabel(model)}`)
  })
  if (models.length > 30) console.log(`  ... ${models.length - 30} more hidden`)

  const answer = await rl.question(`Select model [1]: `)
  const index = Number.parseInt(answer || '1', 10) - 1
  return models[Math.min(Math.max(index, 0), models.length - 1)]
}

async function chooseThinkingLevel(rl: ReturnType<typeof createInterface>) {
  console.log('\nThinking levels:')
  thinkingLevels.forEach((level, index) => console.log(`  ${index + 1}. ${level}`))
  const answer = await rl.question('Select thinking level [4: medium]: ')
  const index = Number.parseInt(answer || '4', 10) - 1
  return thinkingLevels[Math.min(Math.max(index, 0), thinkingLevels.length - 1)]
}

function isTaskInput(text: string) {
  return text.startsWith('/task ')
}

function stripTaskPrefix(text: string) {
  return text.replace(/^\/task\s+/, '').trim()
}

function assistantTextFromMessages(messages: unknown[]) {
  const lastAssistant = [...messages]
    .reverse()
    .find(message => {
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
  if (Array.isArray(candidate.content)) {
    return candidate.content.map(textFromContentPart).join('')
  }
  if (Array.isArray(candidate.parts)) {
    return candidate.parts.map(textFromContentPart).join('')
  }
  return ''
}

function textFromContentPart(part: unknown): string {
  if (typeof part === 'string') return part
  if (!part || typeof part !== 'object') return ''
  const value = part as { text?: unknown; content?: unknown; type?: unknown }
  if (typeof value.text === 'string') return value.text
  if (typeof value.content === 'string') return value.content
  return ''
}

function taskModePrompt(goal: string) {
  return `Accorda Task Mode is active. User goal: ${goal}\n\nWork normally, but maintain visible task state with task_update. Start in aligning status: understand the real goal, do not assume the user's proposed solution is correct, inspect local context when needed, and ask only when uncertainty materially affects the next step. Move to executing with task_update when the goal and path are clear. Use task_update for meaningful progress, blockers, completion, or cancellation; do not record trivial micro-actions. For bash, edit, write, and append, provide a concise specific intent.`
}

export async function runPiDev() {
  configureProxyFromEnv()
  const rl = createInterface({ input, output })
  const localAgentDir = await ensureLocalPiAgentDir(getLocalPiAgentDir())
  const authStorage = AuthStorage.create(join(localAgentDir, 'auth.json'))
  const modelRegistry = ModelRegistry.create(authStorage, join(localAgentDir, 'models.json'))
  const availableModels = modelRegistry.getAvailable()

  try {
    const model = await chooseModel(rl, availableModels)
    const thinkingLevel = await chooseThinkingLevel(rl)

    const traceId = shortTraceId()
    const runDir = join(cwd(), '.accorda', 'pi-runs', traceId)
    await mkdir(runDir, { recursive: true })
    const traceLog = createReadableTraceLog(join(runDir, 'trace.jsonl'), traceId)
    let taskStatus: TaskStatus = 'aligning'

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
      tools: ['read', 'grep', 'find', 'ls', 'bash', 'edit', 'write', 'append', 'task_start', 'task_update'],
    })

    let streamedText = false
    session.subscribe(event => {
      if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
        streamedText = true
        process.stdout.write(event.assistantMessageEvent.delta)
      }
      if (event.type === 'auto_retry_start') {
        console.error(`\n[retry] ${event.errorMessage}`)
      }
      if (event.type === 'auto_retry_end' && !event.success && event.finalError) {
        console.error(`\n[error] ${event.finalError}`)
      }
    })

    console.log(`\nAccorda Pi Dev`)
    console.log(`Model: ${modelLabel(model)}`)
    console.log(`Thinking: ${thinkingLevel}`)
    console.log(`Trace: ${traceLog.path}`)
    console.log('Type /task <goal> for Task Mode, /exit to quit.\n')

    while (true) {
      const text = (await rl.question('\n> ')).trim()
      if (!text) continue
      if (text === '/exit' || text === '/quit') break

      const task = isTaskInput(text)
      const inputText = task ? stripTaskPrefix(text) : text
      taskStatus = 'aligning'
      await traceLog.append({
        type: 'trace_started',
        mode: task ? 'task' : 'chat',
        input: inputText,
        status: 'running',
      })
      if (task) {
        await traceLog.append({
          type: 'task_started',
          mode: 'task',
          status: taskStatus,
          task: inputText,
        })
      }

      try {
        streamedText = false
        await session.prompt(task ? taskModePrompt(inputText) : inputText)
        if (!streamedText) {
          const finalText = assistantTextFromMessages(session.messages as unknown[])
          if (finalText) process.stdout.write(finalText)
          const errorMessage = (session.agent.state as { errorMessage?: string }).errorMessage
          if (errorMessage) console.error(`\n[error] ${errorMessage}`)
        }
        await traceLog.append({
          type: 'trace_finished',
          mode: task ? 'task' : 'chat',
          status: taskStatus === 'done' ? 'done' : 'completed',
        })
      } catch (error) {
        await traceLog.append({
          type: 'trace_finished',
          mode: task ? 'task' : 'chat',
          status: 'failed',
          summary: error instanceof Error ? error.message : 'failed',
        })
        console.error(error instanceof Error ? error.message : error)
      }
      process.stdout.write('\n')
    }

    session.dispose()
    return 0
  } finally {
    rl.close()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPiDev().then(
    code => {
      process.exitCode = code
    },
    error => {
      console.error(error instanceof Error ? (error.stack ?? error.message) : error)
      process.exitCode = 1
    },
  )
}
