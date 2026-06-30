import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { cwd } from 'node:process'
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
} from '@earendil-works/pi-coding-agent'
import { createAccordaExtension } from './accordaExtension.js'
import {
  createReadableTraceLog,
  shortTraceId,
  type TaskStatus,
} from '../trace/readableTrace.js'
import { ensureLocalPiAgentDir, getLocalPiAgentDir } from './localPiAgent.js'
import { configureProxyFromEnv } from './httpProxy.js'

type Args = {
  prompt: string
  mode: 'chat' | 'task'
  runDir: string
}

function parseArgs(args: string[]): Args {
  let mode: 'chat' | 'task' = 'chat'
  let runDir = ''
  const promptParts: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--task') {
      mode = 'task'
      continue
    }
    if (arg === '--run-dir') {
      runDir = args[index + 1] ?? ''
      index += 1
      continue
    }
    promptParts.push(arg)
  }

  const traceId = shortTraceId()
  return {
    prompt: promptParts.join(' ').trim(),
    mode,
    runDir: runDir || join(cwd(), '.accorda', 'pi-runs', traceId),
  }
}

function taskModePrompt(goal: string) {
  return `Accorda Task Mode is active. User goal: ${goal}\n\nWork normally, but maintain visible task state with task_update. Start in aligning status: understand the real goal, do not assume the user's proposed solution is correct, inspect local context when needed, and ask only when uncertainty materially affects the next step. Move to executing with task_update when the goal and path are clear. Use task_update for meaningful progress, blockers, completion, or cancellation; do not record trivial micro-actions. For bash, edit, write, and append, provide a concise specific intent.`
}

function taskModeGuidance() {
  return `Accorda provides lightweight task and trace behavior. Use task_start conservatively: only when the user explicitly asks for Task Mode, or when visible task tracking would materially help complex, multi-step, stateful, risky, or validation-heavy work. If uncertain, continue normally or briefly ask the user whether to use Task Mode. Do not use Task Mode for simple answers or one-off explanations. task_start and task_update only update visible task state; they do not perform the user's work. For bash, edit, write, and append, intent is required and should be a concise, specific, user-visible purpose of the tool call.`
}

export async function runPiOnce(args = process.argv.slice(2)) {
  configureProxyFromEnv()
  const parsed = parseArgs(args)
  if (!parsed.prompt) {
    console.error('Usage: npm run pi:once -- [--task] [--run-dir path] <prompt>')
    return 1
  }

  await mkdir(parsed.runDir, { recursive: true })
  const localAgentDir = getLocalPiAgentDir()
  await ensureLocalPiAgentDir(localAgentDir)

  const traceId = shortTraceId()
  const traceLog = createReadableTraceLog(join(parsed.runDir, 'trace.jsonl'), traceId)
  let taskStatus: TaskStatus = 'aligning'

  await traceLog.append({
    type: 'trace_started',
    mode: parsed.mode,
    input: parsed.prompt,
    status: 'running',
  })

  if (parsed.mode === 'task') {
    await traceLog.append({
      type: 'task_started',
      mode: 'task',
      status: taskStatus,
      task: parsed.prompt,
    })
  }

  const loader = new DefaultResourceLoader({
    cwd: cwd(),
    agentDir: localAgentDir,
    systemPromptOverride: base => `${base ?? ''}\n\n${taskModeGuidance()}`.trim(),
    extensionFactories: [
      createAccordaExtension({
        traceLog,
        initialMode: parsed.mode,
        initialTaskStatus: taskStatus,
        onTaskStatusChange: status => {
          taskStatus = status
        },
      }),
    ],
  })
  await loader.reload()

  const authStorage = AuthStorage.create(join(localAgentDir, 'auth.json'))
  const modelRegistry = ModelRegistry.create(authStorage, join(localAgentDir, 'models.json'))
  const { session } = await createAgentSession({
    cwd: cwd(),
    authStorage,
    modelRegistry,
    resourceLoader: loader,
    sessionManager: SessionManager.inMemory(cwd()),
    tools: ['read', 'grep', 'find', 'ls', 'bash', 'edit', 'write', 'append', 'task_start', 'task_update'],
  })

  session.subscribe(event => {
    if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
      process.stdout.write(event.assistantMessageEvent.delta)
    }
  })

  try {
    await session.prompt(parsed.mode === 'task' ? taskModePrompt(parsed.prompt) : parsed.prompt)
    await traceLog.append({
      type: 'trace_finished',
      mode: parsed.mode,
      status: taskStatus === 'done' ? 'done' : 'completed',
    })
  } catch (error) {
    await traceLog.append({
      type: 'trace_finished',
      mode: parsed.mode,
      status: 'failed',
      summary: error instanceof Error ? error.message : 'failed',
    })
    throw error
  } finally {
    session.dispose()
  }

  console.log(`\nTrace: ${traceLog.path}`)
  return 0
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPiOnce().then(
    code => {
      process.exitCode = code
    },
    error => {
      console.error(error instanceof Error ? (error.stack ?? error.message) : error)
      process.exitCode = 1
    },
  )
}
