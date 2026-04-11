import React from 'react'
import { ClaudeWelcome } from '../claudeChrome/ClaudeWelcome'

type Props = {
  sessionId: string
  model?: string
}

export function Header({ sessionId: _sessionId, model }: Props) {
  return <ClaudeWelcome model={model} />
}
