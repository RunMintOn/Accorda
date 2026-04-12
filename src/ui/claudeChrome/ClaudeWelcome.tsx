import React from 'react'
import { cwd } from 'node:process'
import { Box, Text } from 'ink'
import { truncatePath } from './path'

type Props = {
  version?: string
  model?: string
}

const ACCENT = '#e36d3f'

function infoLine(label: string, value: string) {
  return (
    <Text>
      <Text color="gray">{label} </Text>
      <Text>{value}</Text>
    </Text>
  )
}

export function ClaudeWelcome({ version = 'v0.1.0', model }: Props) {
  const workspace = truncatePath(cwd())
  const modelLabel =
    model ?? process.env.OPENAI_MODEL ?? process.env.ACCORDA_MODEL ?? 'model from env'

  return (
    <Box flexDirection="column" width={92} marginBottom={1}>
      <Text color={ACCENT}>Accorda Code {version}</Text>
      <Box borderStyle="round" borderColor={ACCENT} flexDirection="row" paddingX={1} paddingY={1}>
        <Box flexDirection="column" width={43}>
          <Text bold>Welcome back!</Text>
          <Text color={ACCENT} bold>
            [A]
          </Text>
          {infoLine('workspace:', workspace)}
          {infoLine('provider:', `OpenAI compatible · ${modelLabel}`)}
        </Box>
        <Box width={2} />
        <Box flexDirection="column" flexGrow={1}>
          <Text color={ACCENT}>Tips for getting started</Text>
          <Text>Run /init to create repo instructions</Text>
          <Text color={ACCENT}>Recent activity</Text>
          <Text color="gray">No recent activity</Text>
        </Box>
      </Box>
    </Box>
  )
}
