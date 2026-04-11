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
    <Box flexDirection="column">
      {messages.length === 0 ? (
        <Text color="gray">No messages yet.</Text>
      ) : (
        messages.map(message => (
          <MessageRow key={message.id} message={message} />
        ))
      )}
      {isLoading ? <Text color="gray">Accorda is thinking...</Text> : null}
    </Box>
  )
}
