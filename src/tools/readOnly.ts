import { readdir, readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'

export type ReadOnlyToolName = 'ls' | 'read' | 'glob' | 'grep'

export type ReadOnlyToolHandler = (
  input: Record<string, unknown>,
) => Promise<unknown>

export type ReadOnlyToolCall = {
  name: ReadOnlyToolName
  input: Record<string, unknown>
}

export const READ_ONLY_TOOL_NAMES: ReadOnlyToolName[] = [
  'ls',
  'read',
  'glob',
  'grep',
]

export function parseReadOnlyToolRequest(text: string): ReadOnlyToolCall | null {
  const trimmed = text.trim()

  const readMatch = /^read\s+(.+)$/i.exec(trimmed)
  if (readMatch) return { name: 'read', input: { path: readMatch[1] } }

  const lsMatch = /^ls(?:\s+(.+))?$/i.exec(trimmed)
  if (lsMatch) return { name: 'ls', input: { path: lsMatch[1] ?? '.' } }

  const globMatch = /^glob\s+(.+)$/i.exec(trimmed)
  if (globMatch) return { name: 'glob', input: { pattern: globMatch[1] } }

  const grepMatch = /^grep\s+(\S+)(?:\s+(.+))?$/i.exec(trimmed)
  if (grepMatch) {
    return {
      name: 'grep',
      input: { pattern: grepMatch[1], path: grepMatch[2] ?? '.' },
    }
  }

  return null
}

function isInside(root: string, target: string) {
  const normalizedRoot = resolve(root)
  const normalizedTarget = resolve(target)
  const pathFromRoot = relative(normalizedRoot, normalizedTarget)

  return (
    pathFromRoot === '' ||
    (!pathFromRoot.startsWith('..') && pathFromRoot !== '..')
  )
}

function safeResolve(workspaceRoot: string, value: unknown) {
  const requested = typeof value === 'string' && value.trim() ? value.trim() : '.'
  const resolved = resolve(workspaceRoot, requested)

  if (!isInside(workspaceRoot, resolved)) {
    throw new Error(`Path escapes workspace: ${requested}`)
  }

  return resolved
}

async function collectFiles(root: string, path = root): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    const absolutePath = join(path, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(root, absolutePath)))
    } else if (entry.isFile()) {
      files.push(relative(root, absolutePath))
    }
  }

  return files
}

function globToRegex(pattern: string) {
  let source = ''

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]

    if (char === '*') {
      if (pattern[index + 1] === '*') {
        if (pattern[index + 2] === '/') {
          source += '(?:.*/)?'
          index += 2
        } else {
          source += '.*'
          index += 1
        }
      } else {
        source += '[^/]*'
      }
      continue
    }

    source += /[.+^${}()|[\]\\]/.test(char) ? `\\${char}` : char
  }

  return new RegExp(`^${source}$`)
}

export function createReadOnlyTools(
  workspaceRoot: string,
): Record<ReadOnlyToolName, ReadOnlyToolHandler> {
  return {
    async ls(input) {
      const path = safeResolve(workspaceRoot, input.path)
      const entries = await readdir(path, { withFileTypes: true })
      return entries
        .filter(entry => entry.name !== 'node_modules' && entry.name !== '.git')
        .map(entry => `${entry.isDirectory() ? 'dir ' : 'file'} ${entry.name}`)
        .join('\n')
    },
    async read(input) {
      const path = safeResolve(workspaceRoot, input.path)
      return readFile(path, 'utf8')
    },
    async glob(input) {
      const pattern = String(input.pattern ?? '*')
      const matcher = globToRegex(pattern)
      const files = await collectFiles(workspaceRoot)
      return files.filter(file => matcher.test(file)).join('\n')
    },
    async grep(input) {
      const pattern = String(input.pattern ?? '')
      if (!pattern) throw new Error('grep requires a pattern')

      const path = safeResolve(workspaceRoot, input.path)
      const files = await collectFiles(path)
      const matches: string[] = []

      for (const file of files) {
        const absolutePath = join(path, file)
        const raw = await readFile(absolutePath, 'utf8').catch(() => null)
        if (raw === null) continue

        raw.split('\n').forEach((line, index) => {
          if (line.includes(pattern)) {
            matches.push(
              `${relative(workspaceRoot, absolutePath)}:${index + 1}:${line}`,
            )
          }
        })
      }

      return matches.join('\n')
    },
  }
}
