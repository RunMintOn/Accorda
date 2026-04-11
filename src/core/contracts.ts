export type EventType =
  | 'user_message'
  | 'tool_call'
  | 'tool_result'
  | 'assistant_text'
  | 'system_status'

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
  isLoading: boolean
  inStageTwo: boolean
  streamingText: string
  pendingPermissionRequest: null | {
    toolName: string
    input: Record<string, unknown>
  }
}
