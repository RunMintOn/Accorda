import React from 'react'
import { Box, Text } from 'ink'
import type { RenderableMessage } from './types'

type Props = {
  message: Extract<RenderableMessage, { kind: 'user' }>
}

export function UserMessage({ message }: Props) {
  return (
    <Box flexDirection="row">
      <Text color="cyan">
        {'>'}{' '}
      </Text>
      <Text color="cyan" bold>
        You
      </Text>
      <Text>  {message.text}</Text>
    </Box>
  )
}
