import type { RuntimeEventDraft } from '../core/contracts'

export type StageTwoResult = {
  events: RuntimeEventDraft[]
  finalText?: string
  reason?: string
}

export type StageTwoRunner = (input: {
  sessionId: string
  userText: string
}) => Promise<StageTwoResult>
