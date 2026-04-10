export type StageTwoResult = {
  events: Array<{
    type: string
    payload: Record<string, unknown>
  }>
}

export type StageTwoRunner = (input: {
  sessionId: string
  userText: string
}) => Promise<StageTwoResult>
