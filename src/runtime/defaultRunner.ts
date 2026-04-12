import { dirname } from 'node:path'
import { cwd } from 'node:process'
import { loadConfig } from '../core/config.js'
import type { EventRecord } from '../core/contracts.js'
import { createTextCompletionFromBody } from '../provider/openaiClient.js'
import { createEventLogStore } from '../store/eventLogStore.js'
import { createSessionStore } from '../store/sessionStore.js'
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
  return async ({
    callId,
    messages,
    recordModelRequest,
    recordModelResponse,
  }) => {
    try {
      const config = loadConfig()
      const body = {
        model: config.provider.model,
        messages: messages.map(providerMessageForCompletion),
      }
      const timestamp = new Date().toISOString()
      const requestArtifact = await recordModelRequest({
        schemaVersion: 1,
        callId,
        timestamp,
        body,
      })
      const answer = await createTextCompletionFromBody(config, body)
      const responseArtifact = await recordModelResponse({
        schemaVersion: 1,
        callId,
        timestamp: new Date().toISOString(),
        body: answer,
      })

      return {
        ...answer,
        trace: { callId, requestArtifact, responseArtifact },
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

function createPersistentSession(
  sessionId: string,
  options: RunLocalTurnOptions,
) {
  const runDir = options.eventLogPath
    ? dirname(options.eventLogPath)
    : options.artifactDir
      ? dirname(options.artifactDir)
      : null

  if (!runDir) return null

  return createSessionStore({
    runDir,
    sessionId,
    workspaceRoot: options.workspaceRoot ?? cwd(),
  })
}

export async function runLocalTurn(
  sessionId: string,
  text: string,
  options: RunLocalTurnOptions = {},
): Promise<EventRecord[]> {
  const persistentSession = createPersistentSession(sessionId, options)
  await persistentSession?.ensureSession()

  try {
    if (options.eventLogPath || options.artifactDir || options.workspaceRoot) {
      return createRuntime(sessionId, options).run(text)
    }

    return getRuntime(sessionId).run(text)
  } finally {
    await persistentSession?.touchSession()
  }
}
