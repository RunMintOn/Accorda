import React from 'react'
import { render } from 'ink-testing-library'
import { describe, expect, it } from 'vitest'
import { App } from '../src/ui/App'
describe('interactive app', () => {
  it('submits input on Enter', async () => {
    const submissions: string[] = []
    const { stdin } = render(
      <App
        onSubmit={async text => {
          submissions.push(text)
          return []
        }}
      />,
    )

    await new Promise(resolve => setTimeout(resolve, 0))
    stdin.write('a')
    await new Promise(resolve => setTimeout(resolve, 0))
    stdin.write('\r')

    await new Promise(resolve => setTimeout(resolve, 50))

    expect(submissions).toEqual(['a'])
  })
})
