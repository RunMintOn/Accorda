import React from 'react'
import { Box, Text } from 'ink'
import type { RenderableMessage } from './types'

type Props = {
  message: Extract<RenderableMessage, { kind: 'assistant' }>
}

export function AssistantMessage({ message }: Props) {
  return (
    <Box flexDirection="row">
      <Text color="green">
        {'*'}{' '}
      </Text>
      <Text color="green" bold>
        Accorda
      </Text>
      <Text>  {message.text}</Text>
    </Box>
  )
}
