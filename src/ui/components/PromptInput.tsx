import React from 'react'
import { Box, Text } from 'ink'

type Props = {
  value: string
  cursor: number
  isLoading: boolean
  mode?: 'compose' | 'resume_select'
}

function renderCursor(value: string, cursor: number) {
  return `${value.slice(0, cursor)}|${value.slice(cursor)}`
}

export function PromptInput({
  value,
  cursor,
  isLoading,
  mode = 'compose',
}: Props) {
  const placeholder =
    mode === 'resume_select'
      ? 'Type a session number'
      : 'Try "create a util logging.py that..."'
  const displayValue = value ? renderCursor(value, cursor) : placeholder

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="single" borderColor={isLoading ? 'yellow' : 'gray'} width="100%">
        <Text color={value ? undefined : 'gray'}>
          {isLoading ? 'Working...' : displayValue}
        </Text>
      </Box>
      <Box paddingX={1}>
        <Text color="gray">Enter: newline · Ctrl+Enter: submit · ctrl+c to exit</Text>
      </Box>
    </Box>
  )
}
