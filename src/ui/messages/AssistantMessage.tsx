import React from 'react'
import { Box, Text } from 'ink'
import { ToolUseDot } from '../claudeChrome/ToolUseDot'
import type { RenderableMessage } from './types'

type Props = {
  message: Extract<RenderableMessage, { kind: 'assistant' }>
}

export function AssistantMessage({ message }: Props) {
  return (
    <Box flexDirection="row" marginTop={1}>
      <ToolUseDot />
      <Text>{message.text}</Text>
    </Box>
  )
}
