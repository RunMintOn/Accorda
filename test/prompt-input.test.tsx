import React from 'react'
import { render } from 'ink-testing-library'
import { describe, expect, it } from 'vitest'
import { PromptInput } from '../src/ui/components/PromptInput'

describe('PromptInput', () => {
  it('shows a visible cursor even when the input is empty', () => {
    const { lastFrame } = render(
      <PromptInput value="" cursor={0} isLoading={false} mode="compose" />,
    )

    expect(lastFrame()).toContain('> |')
    expect(lastFrame()).not.toContain('Try "create a util logging.py that..."')
  })

  it('shows the cursor at the current editing position', () => {
    const { lastFrame } = render(
      <PromptInput
        value="read package"
        cursor={4}
        isLoading={false}
        mode="compose"
      />,
    )

    expect(lastFrame()).toContain('> read| package')
  })

  it('shows slash candidates below the input line in command mode', () => {
    const { lastFrame } = render(
      <PromptInput
        value="/re"
        cursor={3}
        isLoading={false}
        mode="command_mode"
        helperLines={['resume   resume a recent session']}
      />,
    )

    expect(lastFrame()).toContain('> /re|')
    expect(lastFrame()).toContain('resume   resume a recent session')
  })

  it('shows resume options in resume-select mode', () => {
    const { lastFrame } = render(
      <PromptInput
        value=""
        cursor={0}
        isLoading={false}
        mode="resume_select"
        helperLines={['1. resume-me  restore this one']}
      />,
    )

    expect(lastFrame()).toContain('1. resume-me  restore this one')
  })
})
