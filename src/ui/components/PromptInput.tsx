import React from 'react'
import { Box, Text } from 'ink'

export function PromptInput() {
  return (
    <Box>
      <Text>{'> '}</Text>
      <Text color="gray">Waiting for input wiring…</Text>
    </Box>
  )
}
