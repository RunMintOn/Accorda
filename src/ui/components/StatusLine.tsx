import React from 'react'
import { Text } from 'ink'

type Props = {
  isLoading: boolean
  hasPendingPermission: boolean
}

export function StatusLine({ isLoading, hasPendingPermission }: Props) {
  if (hasPendingPermission) return <Text color="yellow">waiting for permission</Text>
  if (isLoading) return <Text color="gray">esc to interrupt</Text>
  return <Text color="gray">? for shortcuts</Text>
}
