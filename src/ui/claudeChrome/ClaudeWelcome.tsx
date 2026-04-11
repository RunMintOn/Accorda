import React from 'react'
import { cwd } from 'node:process'
import { Box, Text } from 'ink'
import { truncatePath } from './path'

type Props = {
  version?: string
  model?: string
}

const WIDTH = 58
const ART_LINES = [
  '..........................................................',
  '     *                                       █████▓▓░     ',
  '                                 *         ███▓░     ░░   ',
  '            ░░░░░░                        ███▓░           ',
  '    ░░░   ░░░░░░░░░░                      ███▓░           ',
  '   ░░░░░░░░░░░░░░░░░    *                ██▓░░      ▓     ',
  '                                             ░▓▓███▓▓░    ',
  ' *                                 ░░░░                   ',
  '                                 ░░░░░░░░                 ',
  '      █████████                         *                 ',
  '      ██▄█████▄██                       *                 ',
  '      █████████      *                                    ',
  '.......█ █   █ █..........................................',
] as const

export function ClaudeWelcome({ version = 'v0.1.0', model }: Props) {
  const workspace = truncatePath(cwd())
  const modelLabel =
    model ?? process.env.OPENAI_MODEL ?? process.env.ACCORDA_MODEL ?? 'model from env'

  return (
    <Box flexDirection="column" width={WIDTH} marginBottom={1}>
      <Text>
        <Text color="green">Welcome to Accorda Code </Text>
        <Text dimColor>{version}</Text>
      </Text>
      {ART_LINES.map((line, index) => (
        <Text key={index} color={index % 3 === 0 ? 'gray' : undefined}>
          {line}
        </Text>
      ))}
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text dimColor>cwd: {workspace}</Text>
        <Text dimColor>provider: OpenAI compatible · {modelLabel}</Text>
      </Box>
    </Box>
  )
}
