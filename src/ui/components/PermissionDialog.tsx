import React from 'react'
import { Box, Text } from 'ink'

export function PermissionDialog() {
  return (
    <Box flexDirection="column">
      <Text color="yellow">Permission</Text>
      <Text color="gray">No pending permission request.</Text>
    </Box>
  )
}
