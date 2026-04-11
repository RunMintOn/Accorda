import React from 'react'
import { Box, Text } from 'ink'
import { ToolUseDot } from '../claudeChrome/ToolUseDot'
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

function renderSummary(name: string, input: unknown): string {
  if (input && typeof input === 'object' && 'path' in input) {
    return String((input as { path: unknown }).path)
  }
  if (input && typeof input === 'object' && 'command' in input) {
    return String((input as { command: unknown }).command)
  }
  return compactJson(input)
}

export function ToolCallMessage({ message }: Props) {
  return (
    <Box flexDirection="row" marginTop={1}>
      <ToolUseDot status="running" />
      <Text bold>{message.name}</Text>
      <Text color="gray">({renderSummary(message.name, message.input)})</Text>
    </Box>
  )
}
