import React from 'react'
import { Box, Text } from 'ink'

type PendingPermissionRequest = {
  toolName: string
  input: Record<string, unknown>
} | null

type Props = {
  pendingRequest?: PendingPermissionRequest
}

export function PermissionDialog({ pendingRequest = null }: Props) {
  if (!pendingRequest) {
    return null
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1}>
      <Text color="yellow">Permission gate</Text>
      <Text>
        {pendingRequest.toolName} requires permission {JSON.stringify(pendingRequest.input)}
      </Text>
      <Text color="gray">Press Enter to allow. Press Esc to deny.</Text>
    </Box>
  )
}
