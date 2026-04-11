import React from 'react'
import { Box, Text, useStdin } from 'ink'

type Props = {
  value: string
  isLoading: boolean
  onChange(value: string): void
  onSubmit(value?: string): void
}

export function PromptInput({ value, isLoading, onChange, onSubmit }: Props) {
  const valueRef = React.useRef(value)
  valueRef.current = value
  const loadingRef = React.useRef(isLoading)
  loadingRef.current = isLoading
  const { stdin } = useStdin()

  React.useEffect(() => {
    function onData(data: Buffer | string) {
      if (loadingRef.current) return

      const input = String(data)
      if (input.includes('\r') || input.includes('\n')) {
        const text = input.replace(/[\r\n]/g, '')
        const nextValue = valueRef.current + text
        if (text) {
          onChange(nextValue)
        }
        onSubmit(nextValue)
        return
      }
      if (input === '\r' || input === '\n') {
        onSubmit(valueRef.current)
        return
      }
      if (input === '\u007F' || input === '\b') {
        onChange(valueRef.current.slice(0, -1))
        return
      }

      const text = input.replace(/[\r\n]/g, '')
      if (text) {
        onChange(valueRef.current + text)
      }
    }

    stdin.on('data', onData)
    return () => {
      stdin.off('data', onData)
    }
  }, [onChange, onSubmit, stdin])

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box
        flexDirection="row"
        alignItems="flex-start"
        borderStyle="round"
        borderColor={isLoading ? 'yellow' : 'green'}
        borderLeft={false}
        borderRight={false}
        borderBottom
        width="100%"
      >
        <Text color="green" dimColor={isLoading}>
          {'❯ '}
        </Text>
        <Text color={value ? undefined : 'gray'}>
          {isLoading ? 'Thinking...' : value || 'Ask Accorda to work on this codebase'}
        </Text>
      </Box>
      <Box paddingX={2}>
        <Text color="gray">? for shortcuts · shift+tab to cycle mode · ctrl+c to exit</Text>
      </Box>
    </Box>
  )
}
