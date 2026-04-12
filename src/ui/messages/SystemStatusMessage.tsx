import React from 'react'
import { Box, Text } from 'ink'
import type { RenderableItem } from './types'

type Props = {
  message: Extract<RenderableItem, { kind: 'system' }>
}

function colorForLevel(level: 'info' | 'warning' | 'error') {
  if (level === 'error') return 'red'
  if (level === 'warning') return 'yellow'
  return 'gray'
}

export function SystemStatusMessage({ message }: Props) {
  return (
    <Box flexDirection="row">
      <Text color={colorForLevel(message.level)} bold>
        {message.level}
      </Text>
      <Text color="gray">  {message.message}</Text>
    </Box>
  )
}
