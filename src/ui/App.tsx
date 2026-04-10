import React from 'react'
import { Box, Text } from 'ink'
import { PermissionDialog } from './components/PermissionDialog'
import { PromptInput } from './components/PromptInput'
import { TranscriptView } from './components/TranscriptView'

export function App() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text>Contexa v1</Text>
      <Text color="gray">CLI-only coding assistant skeleton</Text>
      <Box marginTop={1} flexDirection="column">
        <TranscriptView />
      </Box>
      <Box marginTop={1} flexDirection="column">
        <PermissionDialog />
      </Box>
      <Box marginTop={1}>
        <PromptInput />
      </Box>
    </Box>
  )
}
