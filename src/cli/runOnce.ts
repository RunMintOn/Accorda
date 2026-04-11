import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { cwd } from 'node:process'
import type { EventRecord } from '../core/contracts.js'
import {
  runLocalTurn,
  type RunLocalTurnOptions,
} from '../runtime/defaultRunner.js'

export type RunOnceArgs = {
  prompt: string
  sessionId: string
  eventLogPath: string
  artifactDir: string
}

type RunOnceDeps = {
  runLocalTurn?: (
    sessionId: string,
    text: string,
    options: RunLocalTurnOptions,
  ) => Promise<EventRecord[]>
  stdout?: (value: string) => void
  stderr?: (value: string) => void
  now?: () => Date
}

function defaultSessionId(now: Date) {
  return `run-${now.toISOString().replace(/[:.]/g, '-')}`
}

export function parseRunOnceArgs(
  args: string[],
  now: Date = new Date(),
): RunOnceArgs {
  let sessionId = ''
  let eventLogPath = ''
  let artifactDir = ''
  const promptParts: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--session') {
      sessionId = args[index + 1] ?? ''
      index += 1
      continue
    }

    if (arg === '--event-log') {
      eventLogPath = args[index + 1] ?? ''
      index += 1
      continue
    }

    if (arg === '--artifact-dir') {
      artifactDir = args[index + 1] ?? ''
      index += 1
      continue
    }

    promptParts.push(arg)
  }

  const resolvedSessionId = sessionId || defaultSessionId(now)
  const resolvedArtifactDir =
    artifactDir || join(cwd(), '.accorda', 'runs', resolvedSessionId, 'artifacts')

  return {
    prompt: promptParts.join(' ').trim(),
    sessionId: resolvedSessionId,
    eventLogPath:
      eventLogPath ||
      join(cwd(), '.accorda', 'runs', resolvedSessionId, 'events.jsonl'),
    artifactDir: resolvedArtifactDir,
  }
}

function finalTextFromEvents(events: EventRecord[]) {
  const final = [...events]
    .reverse()
    .find(event => event.type === 'assistant_text')
  return typeof final?.payload.text === 'string' ? final.payload.text : ''
}

export async function runOnce(
  args: string[] = process.argv.slice(2),
  deps: RunOnceDeps = {},
) {
  const stdout = deps.stdout ?? console.log
  const stderr = deps.stderr ?? console.error
  const parsed = parseRunOnceArgs(args, deps.now?.() ?? new Date())

  if (!parsed.prompt) {
    stderr(
      'Usage: npm run run:once -- [--session id] [--event-log path] [--artifact-dir path] <prompt>',
    )
    return 1
  }

  await mkdir(parsed.artifactDir, { recursive: true })
  const runner = deps.runLocalTurn ?? runLocalTurn
  const events = await runner(parsed.sessionId, parsed.prompt, {
    eventLogPath: parsed.eventLogPath,
    artifactDir: parsed.artifactDir,
    workspaceRoot: cwd(),
  })

  stdout(
    JSON.stringify({
      sessionId: parsed.sessionId,
      eventLogPath: parsed.eventLogPath,
      artifactDir: parsed.artifactDir,
      eventCount: events.length,
      finalText: finalTextFromEvents(events),
    }),
  )

  return 0
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runOnce().then(code => {
    process.exitCode = code
  })
}
