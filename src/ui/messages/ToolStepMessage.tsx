import React from 'react'
import { Box, Text } from 'ink'
import { ToolUseDot } from '../claudeChrome/ToolUseDot'
import type { RenderableItem } from './types'

type Props = {
  message: Extract<RenderableItem, { kind: 'tool_step' }>
}

export function ToolStepMessage({ message }: Props) {
  const dotStatus =
    message.status === 'ok'
      ? 'success'
      : message.status === 'error'
        ? 'error'
        : 'running'

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="row">
        <ToolUseDot status={dotStatus} />
        <Text bold>{message.title}</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text color={message.status === 'error' ? 'red' : 'gray'}>
          {message.status}
          <Text color="gray">  {message.summary}</Text>
        </Text>
      </Box>
    </Box>
  )
}
