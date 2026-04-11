import React from 'react'
import { Box, Text } from 'ink'
import { MessageRow } from './MessageRow'
import type { RenderableMessage } from './types'

type Props = {
  messages: RenderableMessage[]
  isLoading: boolean
}

export function MessageList({ messages, isLoading }: Props) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      {messages.length === 0 ? (
        <Box flexDirection="column">
          <Text color="gray">No messages yet.</Text>
          <Text color="gray">Ask Accorda to inspect, edit, or run commands.</Text>
        </Box>
      ) : (
        messages.map(message => (
          <MessageRow key={message.id} message={message} />
        ))
      )}
      {isLoading ? <Text color="yellow">Thinking...</Text> : null}
    </Box>
  )
}
