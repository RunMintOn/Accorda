import React from 'react'
import { Box, Text } from 'ink'
import { ToolUseDot } from '../claudeChrome/ToolUseDot'
import type { RenderableItem } from './types'

type Props = {
  message: Extract<RenderableItem, { kind: 'assistant' }>
}

export function AssistantMessage({ message }: Props) {
  return (
    <Box flexDirection="row" marginTop={1}>
      <ToolUseDot />
      <Text>{message.text}</Text>
    </Box>
  )
}
