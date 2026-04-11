import type { ToolDefinition } from './types'

export const STAGE_ONE_TOOLS: ToolDefinition[] = [
  {
    name: 'answer',
    description: 'Answer directly without entering the execution layer',
    requiresConfirmation: false,
  },
  {
    name: 'execute',
    description: 'Enter the execution layer for an actionable request',
    requiresConfirmation: false,
  },
  {
    name: 'clarify',
    description: 'Ask the user to clarify intent before continuing',
    requiresConfirmation: false,
  },
  {
    name: 'task_mode',
    description: 'Enter a multi-step task planning and execution flow',
    requiresConfirmation: false,
  },
]

export const STAGE_TWO_TOOLS: ToolDefinition[] = [
  {
    name: 'ls',
    description: 'List files in a directory',
    requiresConfirmation: false,
  },
  {
    name: 'read',
    description: 'Read a file from the workspace',
    requiresConfirmation: false,
  },
  {
    name: 'write',
    description: 'Create or overwrite a file',
    requiresConfirmation: true,
  },
  {
    name: 'edit',
    description: 'Edit a file in place',
    requiresConfirmation: true,
  },
  {
    name: 'glob',
    description: 'Find files by pattern',
    requiresConfirmation: false,
  },
  {
    name: 'grep',
    description: 'Search file contents by pattern',
    requiresConfirmation: false,
  },
  {
    name: 'bash',
    description: 'Run a shell command',
    requiresConfirmation: true,
  },
]
