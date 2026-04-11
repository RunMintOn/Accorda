export type StageOneDecision =
  | { kind: 'answer'; text: string; reason?: string }
  | {
      kind: 'tool'
      name: 'clarify' | 'proceed'
      input: Record<string, unknown>
      reason?: string
    }

export type StageOneRunner = (input: {
  sessionId: string
  userText: string
}) => Promise<StageOneDecision>
