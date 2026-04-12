import React from 'react'
import { Box, Text } from 'ink'
import { MessageRow } from './MessageRow'
import type { RenderableItem } from './types'

type Props = {
  messages: RenderableItem[]
  isLoading: boolean
}

export function MessageList({ messages, isLoading: _isLoading }: Props) {
  return (
    <Box flexDirection="column">
      {messages.length === 0 ? (
        <Box flexDirection="column" paddingLeft={2}>
          <Text color="gray">Try "summarize this repo" or "read package.json".</Text>
        </Box>
      ) : (
        messages.map(message => (
          <MessageRow key={message.id} message={message} />
        ))
      )}
    </Box>
  )
}
