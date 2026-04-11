import React from 'react'
import { Text } from 'ink'
import { MessageResponse } from '../claudeChrome/MessageResponse'
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
    <MessageResponse>
      <Text color={message.ok ? 'gray' : 'red'}>
        {content || (message.ok ? `${message.name} completed` : `${message.name} failed`)}
      </Text>
    </MessageResponse>
  )
}
