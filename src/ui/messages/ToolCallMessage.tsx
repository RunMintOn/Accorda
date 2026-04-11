import React from 'react'
import { Box, Text } from 'ink'
import type { RenderableMessage } from './types'

type Props = {
  message: Extract<RenderableMessage, { kind: 'tool_call' }>
}

function compactJson(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return '[unserializable input]'
  }
}

export function ToolCallMessage({ message }: Props) {
  return (
    <Box flexDirection="column" marginLeft={2}>
      <Box flexDirection="row">
        <Text color={message.layer === 'control' ? 'yellow' : 'magenta'} bold>
          tool
        </Text>
        <Text>  {message.name}</Text>
        <Text color="gray">  {message.layer}</Text>
      </Box>
      <Text color="gray">input {compactJson(message.input)}</Text>
    </Box>
  )
}
