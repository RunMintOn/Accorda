import { relative, resolve } from 'node:path'

export function isInside(root: string, target: string) {
  const normalizedRoot = resolve(root)
  const normalizedTarget = resolve(target)
  const pathFromRoot = relative(normalizedRoot, normalizedTarget)

  return (
    pathFromRoot === '' ||
    (!pathFromRoot.startsWith('..') && pathFromRoot !== '..')
  )
}

export function safeResolveWorkspacePath(
  workspaceRoot: string,
  value: unknown,
) {
  const requested = typeof value === 'string' && value.trim() ? value.trim() : '.'
  const resolved = resolve(workspaceRoot, requested)

  if (!isInside(workspaceRoot, resolved)) {
    throw new Error(`Path escapes workspace: ${requested}`)
  }

  return resolved
}
