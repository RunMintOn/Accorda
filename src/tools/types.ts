export type ToolName =
  | 'clarify'
  | 'proceed'
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
