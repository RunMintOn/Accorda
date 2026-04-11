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
  return (
    <Box flexDirection="column">
      <Text color="yellow">Permission</Text>
      {pendingRequest ? (
        <Text>
          {pendingRequest.toolName} requires permission {JSON.stringify(pendingRequest.input)}
        </Text>
      ) : (
        <Text color="gray">No pending permission request.</Text>
      )}
    </Box>
  )
}
