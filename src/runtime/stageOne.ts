import type {
  ProviderResultMetadata,
  RuntimeStatusPayload,
} from '../core/contracts'

export type StageOneDecision =
  | {
      kind: 'answer'
      text: string
      reason?: string
      status?: RuntimeStatusPayload
      metadata?: ProviderResultMetadata
    }
  | {
      kind: 'tool'
      name: 'clarify' | 'proceed'
      input: Record<string, unknown>
      reason?: string
      status?: RuntimeStatusPayload
      metadata?: ProviderResultMetadata
    }

export type StageOneRunner = (input: {
  sessionId: string
  userText: string
}) => Promise<StageOneDecision>
