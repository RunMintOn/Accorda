import { describe, expect, it } from 'vitest'
import { STAGE_ONE_TOOLS } from '../src/tools/registry'

describe('tool registry', () => {
  it('uses the dedicated clarify contract in stage one', () => {
    expect(STAGE_ONE_TOOLS.find(tool => tool.name === 'clarify')).toEqual({
      name: 'clarify',
      description:
        'Ask one direct clarification question when key information is missing. Ask only for the minimum information needed to continue. Do not answer the task yet. Do not ask multiple questions unless strictly necessary. Use this only when the missing information blocks a correct or safe next step.',
      requiresConfirmation: false,
    })
  })
})
