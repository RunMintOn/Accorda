export type StageOneDecision =
  | { kind: 'answer'; text: string }
  | { kind: 'tool'; name: 'clarify' | 'proceed'; input: Record<string, unknown> }

export type StageOneRunner = (input: {
  sessionId: string
  userText: string
}) => Promise<StageOneDecision>
