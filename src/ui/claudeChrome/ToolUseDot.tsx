import React from 'react'
import { Text } from 'ink'

type Props = {
  status?: 'running' | 'success' | 'error'
}

export function ToolUseDot({ status = 'success' }: Props) {
  const color = status === 'error' ? 'red' : status === 'running' ? undefined : 'green'

  return (
    <Text color={color} dimColor={status === 'running'}>
      ●{' '}
    </Text>
  )
}
