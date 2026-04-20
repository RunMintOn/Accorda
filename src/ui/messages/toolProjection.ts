type ToolProjectionInput = {
  name: string
  input?: Record<string, unknown>
  ok?: boolean
  output?: unknown
  error?: string
}

function previewText(output: unknown): string | null {
  if (typeof output !== 'string') return null

  const lines = output.split('\n')
  if (lines.length > 3) {
    return `...+${lines.length - 1} lines`
  }

  const compact = output.trim()
  return compact || null
}

export function projectToolStep({
  name,
  input,
  ok,
  output,
  error,
}: ToolProjectionInput): { title: string; summary: string } {
  if (name === 'read' && typeof input?.path === 'string') {
    return { title: `Read ${input.path}`, summary: 'Read file' }
  }

  if (name === 'bash' && typeof input?.command === 'string') {
    if (ok === false) {
      return { title: `Ran ${input.command}`, summary: error || 'failed' }
    }

    return {
      title: `Ran ${input.command}`,
      summary: previewText(output) || 'completed',
    }
  }

  if (name === 'grep' && typeof input?.pattern === 'string') {
    return { title: `Searched ${input.pattern}`, summary: ok === false ? error || 'failed' : 'completed' }
  }

  if (name === 'glob' && typeof input?.pattern === 'string') {
    return { title: `Matched ${input.pattern}`, summary: ok === false ? error || 'failed' : 'completed' }
  }

  if (name === 'ask_user') {
    return { title: 'Asked user', summary: 'waiting for reply' }
  }

  if (name === 'finish') {
    return { title: 'Finished execute', summary: 'returned final answer' }
  }

  if (typeof input?.path === 'string') {
    return {
      title: `${name} ${input.path}`,
      summary: ok === false ? error || 'failed' : 'completed',
    }
  }

  return {
    title: name,
    summary: ok === false ? error || 'failed' : 'completed',
  }
}
