export type ToolName =
  | 'answer'
  | 'execute'
  | 'ls'
  | 'read'
  | 'write'
  | 'edit'
  | 'glob'
  | 'grep'
  | 'bash'
  | 'ask_user'
  | 'finish'

export type ToolDefinition = {
  name: ToolName
  description: string
  requiresConfirmation: boolean
}
