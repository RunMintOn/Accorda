import React from 'react'
import { Box } from 'ink'
import { AssistantMessage } from './AssistantMessage'
import { SystemStatusMessage } from './SystemStatusMessage'
import { ToolStepMessage } from './ToolStepMessage'
import { UserMessage } from './UserMessage'
import type { RenderableItem } from './types'

type Props = {
  message: RenderableItem
}

export function MessageRow({ message }: Props) {
  return (
    <Box flexDirection="column" marginTop={1}>
      {message.kind === 'user' ? <UserMessage message={message} /> : null}
      {message.kind === 'assistant' ? (
        <AssistantMessage message={message} />
      ) : null}
      {message.kind === 'tool_step' ? <ToolStepMessage message={message} /> : null}
      {message.kind === 'system' ? (
        <SystemStatusMessage message={message} />
      ) : null}
    </Box>
  )
}
