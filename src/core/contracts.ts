export type EventType =
  | 'session_started'
  | 'user_message'
  | 'runtime_decision'
  | 'model_call_started'
  | 'model_call_finished'
  | 'tool_call'
  | 'tool_result'
  | 'assistant_text'
  | 'runtime_error'
  | 'system_status'

export type RuntimeStage =
  | 'idle'
  | 'routing'
  | 'answering'
  | 'executing'
  | 'waiting_user'
  | 'waiting_permission'
  | 'error'

export type RuntimeStatusSource =
  | 'runtime'
  | 'stage_one'
  | 'stage_two'
  | 'provider'
  | 'permission'
  | 'config'
  | 'tool'
  | 'user'

export type RuntimeStatusLevel = 'info' | 'warning' | 'error'

export type RuntimeStatusPayload = {
  message: string
  level: RuntimeStatusLevel
  stage: RuntimeStage
  reason: string
  source?: RuntimeStatusSource
}

export type ProviderUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export type ProviderResultMetadata = {
  usage?: ProviderUsage
  model?: string
  finishReason?: string
  toolCalls?: unknown[]
  raw?: unknown
}

export type EventRecord = {
  id: string
  sessionId: string
  timestamp: string
  type: EventType
  payload: Record<string, unknown>
}

export type SessionMeta = {
  session_id: string
  parent_session_id?: string
  created_at: string
  updated_at: string
  last_user_prompt: string
  mode: 'normal'
}

export type RuntimeState = {
  stage: RuntimeStage
  reason: string
  streamingText: string
  pendingPermissionRequest: null | {
    toolName: string
    input: Record<string, unknown>
  }
}

export type RuntimeEventDraft = {
  type: EventType
  payload: Record<string, unknown>
}

export type RuntimeTurnResult = {
  state: RuntimeState
  returnedToStageOne: boolean
  finalText?: string
  events?: RuntimeEventDraft[]
  status?: RuntimeStatusPayload
  metadata?: ProviderResultMetadata
}
