import React from 'react'
import { Box } from 'ink'
import { AssistantMessage } from './AssistantMessage'
import { SystemStatusMessage } from './SystemStatusMessage'
import { ToolCallMessage } from './ToolCallMessage'
import { ToolResultMessage } from './ToolResultMessage'
import { UserMessage } from './UserMessage'
import type { RenderableMessage } from './types'

type Props = {
  message: RenderableMessage
}

export function MessageRow({ message }: Props) {
  return (
    <Box flexDirection="column" marginTop={1}>
      {message.kind === 'user' ? <UserMessage message={message} /> : null}
      {message.kind === 'assistant' ? (
        <AssistantMessage message={message} />
      ) : null}
      {message.kind === 'tool_call' ? (
        <ToolCallMessage message={message} />
      ) : null}
      {message.kind === 'tool_result' ? (
        <ToolResultMessage message={message} />
      ) : null}
      {message.kind === 'system' ? (
        <SystemStatusMessage message={message} />
      ) : null}
    </Box>
  )
}
