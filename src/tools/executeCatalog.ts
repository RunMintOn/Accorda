import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { promisify } from 'node:util'
import { z } from 'zod'
import { createReadOnlyTools, type ReadOnlyToolHandler } from './readOnly'
import { safeResolveWorkspacePath } from './workspacePaths'

const execFileAsync = promisify(execFile)

const writeInput = z.object({
  path: z.string().min(1),
  content: z.string(),
})

const editInput = z.object({
  path: z.string().min(1),
  oldText: z.string().min(1),
  newText: z.string(),
})

const bashInput = z.object({
  command: z.string().min(1),
})

type ExecuteDefinition = {
  name: string
  description: string
  parameters: Record<string, unknown>
  requiresConfirmation: boolean
}

type ExecuteHandlers = Record<string, ReadOnlyToolHandler>

export function createExecuteToolCatalog(workspaceRoot: string): {
  definitions: ExecuteDefinition[]
  handlers: ExecuteHandlers
} {
  const readOnly = createReadOnlyTools(workspaceRoot)

  return {
    definitions: [
      {
        name: 'ls',
        description: 'List files in a directory',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' } },
          additionalProperties: false,
        },
        requiresConfirmation: false,
      },
      {
        name: 'read',
        description: 'Read a file from the workspace',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
          additionalProperties: false,
        },
        requiresConfirmation: false,
      },
      {
        name: 'glob',
        description: 'Find files by pattern',
        parameters: {
          type: 'object',
          properties: { pattern: { type: 'string' } },
          required: ['pattern'],
          additionalProperties: false,
        },
        requiresConfirmation: false,
      },
      {
        name: 'grep',
        description: 'Search file contents by pattern',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string' },
            path: { type: 'string' },
          },
          required: ['pattern'],
          additionalProperties: false,
        },
        requiresConfirmation: false,
      },
      {
        name: 'write',
        description: 'Create or overwrite a file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['path', 'content'],
          additionalProperties: false,
        },
        requiresConfirmation: true,
      },
      {
        name: 'edit',
        description: 'Replace text in a file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            oldText: { type: 'string' },
            newText: { type: 'string' },
          },
          required: ['path', 'oldText', 'newText'],
          additionalProperties: false,
        },
        requiresConfirmation: true,
      },
      {
        name: 'bash',
        description: 'Run a shell command inside the workspace root',
        parameters: {
          type: 'object',
          properties: { command: { type: 'string' } },
          required: ['command'],
          additionalProperties: false,
        },
        requiresConfirmation: true,
      },
      {
        name: 'ask_user',
        description: 'Ask the user a question and pause execute mode',
        parameters: {
          type: 'object',
          properties: { question: { type: 'string' } },
          required: ['question'],
          additionalProperties: false,
        },
        requiresConfirmation: false,
      },
      {
        name: 'finish',
        description: 'Finish execute mode and return the final answer',
        parameters: {
          type: 'object',
          properties: { message: { type: 'string' } },
          required: ['message'],
          additionalProperties: false,
        },
        requiresConfirmation: false,
      },
    ],
    handlers: {
      ...readOnly,
      async write(input) {
        const parsed = writeInput.parse(input)
        const path = safeResolveWorkspacePath(workspaceRoot, parsed.path)
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, parsed.content, 'utf8')
        return { ok: true, path: parsed.path }
      },
      async edit(input) {
        const parsed = editInput.parse(input)
        const path = safeResolveWorkspacePath(workspaceRoot, parsed.path)
        const raw = await readFile(path, 'utf8')

        if (!raw.includes(parsed.oldText)) {
          throw new Error(`edit could not find oldText in ${parsed.path}`)
        }

        await writeFile(path, raw.replace(parsed.oldText, parsed.newText), 'utf8')
        return { ok: true, path: parsed.path }
      },
      async bash(input) {
        const parsed = bashInput.parse(input)
        const result = await execFileAsync('bash', ['-lc', parsed.command], {
          cwd: workspaceRoot,
          timeout: 15_000,
          maxBuffer: 200_000,
        })

        return {
          stdout: result.stdout.trim(),
          stderr: result.stderr.trim(),
          exitCode: 0,
        }
      },
    },
  }
}
