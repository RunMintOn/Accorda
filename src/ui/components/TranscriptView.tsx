import React from 'react'
import { Box, Text } from 'ink'
import type { EventRecord } from '../../core/contracts'

type Props = {
  events: EventRecord[]
}

export function TranscriptView({ events }: Props) {
  return (
    <Box flexDirection="column">
      <Text color="cyan">Transcript</Text>
      {events.length === 0 ? (
        <Text color="gray">No events yet.</Text>
      ) : (
        events.map(event => (
          <Text key={event.id}>
            {event.type}: {String(event.payload.text ?? event.payload.name ?? '')}
          </Text>
        ))
      )}
    </Box>
  )
}
