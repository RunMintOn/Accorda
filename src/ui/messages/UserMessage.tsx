import React from 'react'
import { Box, Text } from 'ink'
import type { RenderableMessage } from './types'

type Props = {
  message: Extract<RenderableMessage, { kind: 'user' }>
}

export function UserMessage({ message }: Props) {
  return (
    <Box flexDirection="row" marginTop={1}>
      <Text color="gray">{'> '}</Text>
      <Text bold>{message.text}</Text>
    </Box>
  )
}
