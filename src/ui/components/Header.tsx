import React from 'react'
import { ClaudeWelcome } from '../claudeChrome/ClaudeWelcome'
import { RuntimeStatus, type RuntimeStatusView } from './RuntimeStatus'

type Props = {
  sessionId: string
  model?: string
  runtimeStatus: RuntimeStatusView
}

export function Header({ sessionId: _sessionId, model, runtimeStatus }: Props) {
  return (
    <>
      <ClaudeWelcome model={model} />
      <RuntimeStatus status={runtimeStatus} />
    </>
  )
}
