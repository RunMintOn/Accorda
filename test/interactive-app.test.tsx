import React from 'react'
import { render } from 'ink-testing-library'
import { describe, expect, it } from 'vitest'
import { App } from '../src/ui/App'
describe('interactive app', () => {
  it('renders multi-line input text without auto-submitting on Enter', async () => {
    const { stdin, lastFrame } = render(<App onSubmit={async () => []} />)

    stdin.write('a')
    stdin.write('\r')
    stdin.write('b')

    await new Promise(resolve => setTimeout(resolve, 50))

    expect(lastFrame()).toContain('a')
    expect(lastFrame()).toContain('b')
    expect(lastFrame()).not.toContain('Waiting for runtime result')
  })
})
