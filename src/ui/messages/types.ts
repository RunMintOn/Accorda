export type RenderableMessage =
  | {
      id: string
      kind: 'user'
      text: string
      timestamp: string
    }
  | {
      id: string
      kind: 'assistant'
      text: string
      timestamp: string
    }
  | {
      id: string
      kind: 'tool_call'
      toolCallId: string
      name: string
      input: Record<string, unknown>
      layer: 'control' | 'real'
      timestamp: string
    }
  | {
      id: string
      kind: 'tool_result'
      toolCallId: string
      name: string
      ok: boolean
      output?: unknown
      error?: string
      timestamp: string
    }
  | {
      id: string
      kind: 'system'
      message: string
      level: 'info' | 'warning' | 'error'
      timestamp: string
    }

export type RenderableItem =
  | {
      id: string
      kind: 'user'
      text: string
      timestamp: string
    }
  | {
      id: string
      kind: 'assistant'
      text: string
      timestamp: string
    }
  | {
      id: string
      kind: 'system'
      message: string
      level: 'info' | 'warning' | 'error'
      timestamp: string
    }
  | {
      id: string
      kind: 'tool_step'
      toolName: string
      title: string
      status: 'running' | 'ok' | 'error'
      summary: string
      timestamp: string
    }
