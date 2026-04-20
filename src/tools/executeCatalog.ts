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
      { name: 'ls', requiresConfirmation: false },
      { name: 'read', requiresConfirmation: false },
      { name: 'glob', requiresConfirmation: false },
      { name: 'grep', requiresConfirmation: false },
      { name: 'write', requiresConfirmation: true },
      { name: 'edit', requiresConfirmation: true },
      { name: 'bash', requiresConfirmation: true },
      { name: 'ask_user', requiresConfirmation: false },
      { name: 'finish', requiresConfirmation: false },
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
