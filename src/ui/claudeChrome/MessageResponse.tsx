import React from 'react'
import { Box, Text } from 'ink'

type Props = {
  children: React.ReactNode
}

export function MessageResponse({ children }: Props) {
  return (
    <Box flexDirection="row" marginLeft={2}>
      <Text color="gray">{'⎿  '}</Text>
      <Box flexShrink={1}>{children}</Box>
    </Box>
  )
}
