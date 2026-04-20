import React from 'react'
import { Box, Text } from 'ink'

type PromptMode = 'compose' | 'command_mode' | 'resume_select' | 'permission'

type Props = {
  value: string
  cursor: number
  isLoading: boolean
  mode?: PromptMode
  helperLines?: string[]
}

function renderInputLine(value: string, cursor: number) {
  const content = `${value.slice(0, cursor)}|${value.slice(cursor)}`
  return `> ${content}`
}

function defaultHelper(mode: PromptMode): string[] {
  if (mode === 'resume_select') return ['Type a session number']
  if (mode === 'permission') return ['Enter to approve, Esc to deny']
  return ['Try "read package.json" or start with / for commands']
}

export function PromptInput({
  value,
  cursor,
  isLoading,
  mode = 'compose',
  helperLines = defaultHelper(mode),
}: Props) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="single" borderColor={isLoading ? 'yellow' : 'gray'} width="100%">
        <Text>{isLoading ? '> Working...' : renderInputLine(value, cursor)}</Text>
      </Box>
      <Box flexDirection="column" paddingX={1}>
        {helperLines.map((line, index) => (
          <Text key={index} color="gray">
            {line}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
