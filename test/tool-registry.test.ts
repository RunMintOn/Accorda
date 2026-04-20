import { describe, expect, it } from 'vitest'
import { STAGE_ONE_TOOLS, STAGE_TWO_TOOLS } from '../src/tools/registry'

describe('tool registry', () => {
  it('exposes only answer and execute in stage one', () => {
    expect(STAGE_ONE_TOOLS.map(tool => tool.name)).toEqual([
      'answer',
      'execute',
    ])
  })

  it('reserves ask_user and finish for execute mode', () => {
    expect(STAGE_TWO_TOOLS.map(tool => tool.name)).toContain('ask_user')
    expect(STAGE_TWO_TOOLS.map(tool => tool.name)).toContain('finish')
  })
})
