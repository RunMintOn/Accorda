import React from 'react'
import { Box } from 'ink'
import type { EventRecord } from '../core/contracts'
import { runLocalTurn } from '../runtime/defaultRunner'
import { projectEventsToMessages } from './events/projectEvents'
import { Header } from './components/Header'
import { PermissionDialog } from './components/PermissionDialog'
import { PromptInput } from './components/PromptInput'
import { MessageList } from './messages/MessageList'

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
  const pendingPermissionRequest = null
  const inputRef = React.useRef(input)
  inputRef.current = input
  const messages = React.useMemo(() => projectEventsToMessages(events), [events])

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
    <Box flexDirection="column" padding={1} gap={1}>
      <Header sessionId="local" />
      <Box flexDirection="column">
        <MessageList messages={messages} isLoading={isLoading} />
      </Box>
      <PermissionDialog pendingRequest={pendingPermissionRequest} />
      <Box>
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
