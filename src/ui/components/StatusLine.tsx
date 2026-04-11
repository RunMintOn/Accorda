import React from 'react'
import { Box, Text } from 'ink'

type Props = {
  isLoading: boolean
  hasPendingPermission: boolean
}

export function StatusLine({ isLoading, hasPendingPermission }: Props) {
  const status = hasPendingPermission ? 'waiting-permission' : isLoading ? 'thinking' : 'ready'

  return (
    <Box justifyContent="space-between" width="100%">
      <Text color={status === 'ready' ? 'green' : 'yellow'}>
        status {status}
      </Text>
      <Text color="gray">mode normal | tools idle | Ctrl+C exit</Text>
    </Box>
  )
}
