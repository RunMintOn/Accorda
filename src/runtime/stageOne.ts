import type {
  ProviderResultMetadata,
  RuntimeStatusPayload,
} from '../core/contracts.js'

export type StageOneDecision =
  | {
      kind: 'answer'
      text: string
      reason?: string
      status?: RuntimeStatusPayload
      metadata?: ProviderResultMetadata
    }
  | {
      kind: 'execute'
      reason?: string
      status?: RuntimeStatusPayload
      metadata?: ProviderResultMetadata
    }
  | {
      kind: 'clarify'
      question: string
      reason?: string
      status?: RuntimeStatusPayload
      metadata?: ProviderResultMetadata
    }
  | {
      kind: 'task_mode'
      summary: string
      reason?: string
      status?: RuntimeStatusPayload
      metadata?: ProviderResultMetadata
    }

export type StageOneRunner = (input: {
  sessionId: string
  userText: string
}) => Promise<StageOneDecision>
