import React from 'react'
import { Box, Text } from 'ink'
import type {
  ProviderUsage,
  RuntimeStage,
  RuntimeStatusLevel,
  RuntimeStatusSource,
} from '../../core/contracts'

export type RuntimeStatusView = {
  stage: RuntimeStage
  reason: string
  message: string
  level: RuntimeStatusLevel
  source?: RuntimeStatusSource
  usage?: ProviderUsage
  model?: string
  contextWindow?: number
  executeStepCount?: number
  completedExecuteStepCount?: number
}

type Props = {
  status: RuntimeStatusView
}

function colorForLevel(level: RuntimeStatusLevel) {
  if (level === 'error') return 'red'
  if (level === 'warning') return 'yellow'
  return 'cyan'
}

function formatContext(status: RuntimeStatusView): string | null {
  if (!status.usage) return 'unknown'
  if (!status.contextWindow || status.contextWindow <= 0) return 'unknown'
  if (typeof status.usage.inputTokens !== 'number') return 'unknown'

  const used = Math.round((status.usage.inputTokens / status.contextWindow) * 100)
  const clamped = Math.max(0, Math.min(100, used))
  return `${clamped}%`
}

export function RuntimeStatus({ status }: Props) {
  const context = formatContext(status)

  return (
    <Box flexDirection="column" paddingLeft={2} marginTop={1}>
      <Text color={colorForLevel(status.level)}>
        status: {status.stage}
        <Text color="gray"> · {status.reason}</Text>
      </Text>
      <Text color="gray">
        message: {status.message}
        {status.source ? ` · source: ${status.source}` : ''}
      </Text>
      <Text color="gray">
        context: {context}
        {status.model ? ` · model: ${status.model}` : ''}
      </Text>
      {typeof status.executeStepCount === 'number' ? (
        <Text color="gray">
          steps: {status.executeStepCount} total · {status.completedExecuteStepCount ?? 0} completed
        </Text>
      ) : null}
    </Box>
  )
}
