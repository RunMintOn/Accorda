import React from 'react'
import { Box, Text } from 'ink'
import { cwd } from 'node:process'

type Props = {
  sessionId: string
  model?: string
}

export function Header({ sessionId, model }: Props) {
  const workspace = cwd()

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="green"
      paddingX={1}
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color="green">
          Accorda
        </Text>
        <Text color="gray">OpenAI-compatible CLI agent</Text>
      </Box>
      <Text color="gray">
        session {sessionId} | workspace {workspace}
        {model ? ` | model ${model}` : ' | model from env'}
      </Text>
    </Box>
  )
}
