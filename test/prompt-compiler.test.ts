import { describe, expect, it } from 'vitest'
import { compileStageOneInput } from '../src/prompt/compiler'

describe('prompt compiler', () => {
  it('projects event log into stage-one API messages', () => {
    const compiled = compileStageOneInput([
      {
        id: 'evt-1',
        sessionId: 's-1',
        timestamp: '2026-04-10T00:00:00.000Z',
        type: 'user_message',
        payload: { text: '帮我看看这个项目怎么启动' },
      },
    ])

    expect(compiled.messages).toEqual([
      { role: 'user', content: '帮我看看这个项目怎么启动' },
    ])
    expect(compiled.toolNames).toEqual(['clarify', 'proceed'])
  })
})
