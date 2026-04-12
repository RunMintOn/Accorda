import React from 'react'
import { Box, Text } from 'ink'
import type { RenderableItem } from './types'

type Props = {
  message: Extract<RenderableItem, { kind: 'user' }>
}

export function UserMessage({ message }: Props) {
  return (
    <Box flexDirection="row" marginTop={1}>
      <Text color="gray">{'> '}</Text>
      <Text bold>{message.text}</Text>
    </Box>
  )
}
