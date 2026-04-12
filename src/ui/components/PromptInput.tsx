import React from 'react'
import { Box, Text } from 'ink'

type Props = {
  value: string
  cursor: number
  isLoading: boolean
  mode?: 'compose' | 'resume_select'
}

function renderInputLine(value: string, cursor: number) {
  const content = `${value.slice(0, cursor)}|${value.slice(cursor)}`
  return `> ${content}`
}

export function PromptInput({
  value,
  cursor,
  isLoading,
  mode = 'compose',
}: Props) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="single" borderColor={isLoading ? 'yellow' : 'gray'} width="100%">
        <Text>{isLoading ? '> Working...' : renderInputLine(value, cursor)}</Text>
      </Box>
      <Box paddingX={1}>
        <Text color="gray">Enter: newline · Ctrl+Enter: submit · ctrl+c to exit</Text>
      </Box>
    </Box>
  )
}
