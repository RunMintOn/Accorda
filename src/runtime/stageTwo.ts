import type {
  ProviderResultMetadata,
  RuntimeEventDraft,
  RuntimeStatusPayload,
} from '../core/contracts'

export type StageTwoResult = {
  events: RuntimeEventDraft[]
  finalText?: string
  reason?: string
  status?: RuntimeStatusPayload
  metadata?: ProviderResultMetadata
}

export type StageTwoRunner = (input: {
  sessionId: string
  userText: string
}) => Promise<StageTwoResult>
