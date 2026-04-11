export type ToolName =
  | 'answer'
  | 'execute'
  | 'clarify'
  | 'task_mode'
  | 'ls'
  | 'read'
  | 'write'
  | 'edit'
  | 'glob'
  | 'grep'
  | 'bash'

export type ToolDefinition = {
  name: ToolName
  description: string
  requiresConfirmation: boolean
}
