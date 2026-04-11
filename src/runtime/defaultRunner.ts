import { loadConfig } from '../core/config.js'
import type { EventRecord } from '../core/contracts.js'
import { createTextCompletion } from '../provider/openaiClient.js'
import { createEventLogStore } from '../store/eventLogStore.js'
import {
  createAgentRuntime,
  type RuntimeProvider,
} from './agentRuntime.js'

type LocalRuntime = ReturnType<typeof createAgentRuntime>

export type RunLocalTurnOptions = {
  eventLogPath?: string
  artifactDir?: string
  workspaceRoot?: string
}

const runtimes = new Map<string, LocalRuntime>()

function providerMessageForCompletion(message: {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}): { role: 'system' | 'user' | 'assistant'; content: string } {
  if (message.role === 'tool') {
    return {
      role: 'user',
      content: `Tool result:\n${message.content}`,
    }
  }

  return {
    role: message.role,
    content: message.content,
  }
}

function createDefaultProvider(): RuntimeProvider {
  return async ({ messages }) => {
    try {
      const config = loadConfig()
      const answer = await createTextCompletion(
        config,
        messages.map(providerMessageForCompletion),
      )

      return {
        ...answer,
        status: {
          message: 'Provider answered successfully',
          level: 'info',
          stage: 'answering',
          reason: 'stage_one_direct_answer',
          source: 'provider',
        },
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown provider failure'

      return {
        text: 'Provider unavailable. Check configuration and try again.',
        status: {
          message,
          level: 'error',
          stage: 'error',
          reason: 'provider_or_config_error',
          source: message.startsWith('Missing CONTEXTA_')
            ? 'config'
            : 'provider',
        },
      }
    }
  }
}

function createRuntime(
  sessionId: string,
  options: RunLocalTurnOptions = {},
) {
  return createAgentRuntime({
    sessionId,
    workspaceRoot: options.workspaceRoot,
    artifactDir: options.artifactDir,
    eventStore: options.eventLogPath
      ? createEventLogStore(options.eventLogPath)
      : undefined,
    provider: createDefaultProvider(),
  })
}

function getRuntime(sessionId: string) {
  const existing = runtimes.get(sessionId)
  if (existing) return existing

  const runtime = createRuntime(sessionId)
  runtimes.set(sessionId, runtime)
  return runtime
}

export async function runLocalTurn(
  sessionId: string,
  text: string,
  options: RunLocalTurnOptions = {},
): Promise<EventRecord[]> {
  if (options.eventLogPath || options.artifactDir || options.workspaceRoot) {
    return createRuntime(sessionId, options).run(text)
  }

  return getRuntime(sessionId).run(text)
}
