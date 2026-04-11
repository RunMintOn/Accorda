import React from 'react'
import { Box, Text } from 'ink'

type Props = {
  isLoading: boolean
  hasPendingPermission: boolean
}

export function StatusLine({ isLoading, hasPendingPermission }: Props) {
  const status = hasPendingPermission ? 'waiting-permission' : isLoading ? 'thinking' : 'ready'

  return (
    <Box>
      <Text color={status === 'ready' ? 'green' : 'yellow'}>status {status}</Text>
    </Box>
  )
}
