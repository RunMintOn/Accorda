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
})
