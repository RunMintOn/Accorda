import React from 'react'
import { Box, Text } from 'ink'
import type { RenderableMessage } from './types'

type Props = {
  message: Extract<RenderableMessage, { kind: 'tool_result' }>
}

function compactValue(value: unknown): string {
  if (value === undefined) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return '[unserializable output]'
  }
}

export function ToolResultMessage({ message }: Props) {
  const content = message.ok ? compactValue(message.output) : message.error

  return (
    <Box flexDirection="row" marginLeft={2}>
      <Text color={message.ok ? 'green' : 'red'} bold>
        {message.ok ? 'Done' : 'Error'} {message.name}
      </Text>
      {content ? <Text color="gray">  output: {content}</Text> : null}
    </Box>
  )
}
