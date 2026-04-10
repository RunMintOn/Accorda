import { describe, expect, it } from 'vitest'

describe('cli boot', () => {
  it('exports a renderable App entry', async () => {
    const mod = await import('../src/index')
    expect(typeof mod.main).toBe('function')
  })
})
