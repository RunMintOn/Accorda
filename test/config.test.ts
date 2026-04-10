import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/core/config'

describe('loadConfig', () => {
  it('parses the v1 OpenAI-compatible config surface', () => {
    const config = loadConfig({
      CONTEXTA_BASE_URL: 'https://example.com/v1',
      CONTEXTA_API_KEY: 'test-key',
      CONTEXTA_MODEL: 'gpt-4.1-mini',
    })

    expect(config).toEqual({
      baseURL: 'https://example.com/v1',
      apiKey: 'test-key',
      model: 'gpt-4.1-mini',
      workspaceRoot: expect.any(String),
    })
  })
})
