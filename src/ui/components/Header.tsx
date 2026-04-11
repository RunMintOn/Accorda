import React from 'react'
import { Box, Text } from 'ink'

type Props = {
  sessionId: string
  model?: string
}

export function Header({ sessionId, model }: Props) {
  return (
    <Box flexDirection="column">
      <Text bold color="green">
        Accorda
      </Text>
      <Text color="gray">
        session {sessionId}
        {model ? ` · model ${model}` : ''}
      </Text>
    </Box>
  )
}
