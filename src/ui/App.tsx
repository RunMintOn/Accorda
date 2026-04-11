import React from 'react'
import { Box, Text } from 'ink'
import type { EventRecord } from '../core/contracts'
import { runLocalTurn } from '../runtime/defaultRunner'
import { PermissionDialog } from './components/PermissionDialog'
import { PromptInput } from './components/PromptInput'
import { TranscriptView } from './components/TranscriptView'

type Props = {
  initialEvents?: EventRecord[]
  onSubmit?: (text: string) => Promise<EventRecord[]>
}

async function defaultSubmit(text: string): Promise<EventRecord[]> {
  return runLocalTurn('local', text)
}

export function App({ initialEvents = [], onSubmit = defaultSubmit }: Props) {
  const [events, setEvents] = React.useState<EventRecord[]>(initialEvents)
  const [input, setInput] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const inputRef = React.useRef(input)
  inputRef.current = input

  async function handleSubmit(submittedValue?: string) {
    const text = (submittedValue ?? inputRef.current).trim()
    if (!text) return

    setInput('')
    setIsLoading(true)
    try {
      const nextEvents = await onSubmit(text)
      setEvents(current => [...current, ...nextEvents])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text>Contexa v1</Text>
      <Text color="gray">CLI-only coding assistant skeleton</Text>
      <Box marginTop={1} flexDirection="column">
        <TranscriptView events={events} />
      </Box>
      <Box marginTop={1} flexDirection="column">
        <PermissionDialog />
      </Box>
      <Box marginTop={1}>
        <PromptInput
          value={input}
          isLoading={isLoading}
          onChange={setInput}
          onSubmit={handleSubmit}
        />
      </Box>
    </Box>
  )
}
