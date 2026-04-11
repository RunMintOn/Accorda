import { describe, expect, it } from 'vitest'
import {
  createResponsePolicyMessage,
  responsePolicyMetadata,
  selectResponsePolicy,
} from '../src/runtime/responsePolicy'

describe('response policy', () => {
  it('maps answer and execute to the default brief policy', () => {
    expect(selectResponsePolicy({ kind: 'answer' })).toMatchObject({
      id: 'default_brief_v1',
      mode: 'appended',
      style: 'default_brief',
      prompt: 'Be brief. Lead with the conclusion.',
    })

    expect(selectResponsePolicy({ kind: 'execute' })).toMatchObject({
      id: 'default_brief_v1',
      mode: 'appended',
      style: 'default_brief',
      prompt: 'Be brief. Lead with the conclusion.',
    })
  })

  it('maps clarify to the dedicated clarify policy', () => {
    expect(selectResponsePolicy({ kind: 'clarify' })).toMatchObject({
      id: 'clarify_direct_v1',
      mode: 'appended',
      style: 'clarify_direct',
      prompt:
        'Ask one direct clarification question for the single most important missing detail. Be specific and concise. Do not explain the whole plan.',
    })
  })

  it('does not add a stage-three policy for task mode', () => {
    expect(selectResponsePolicy({ kind: 'task_mode' })).toBeNull()
  })

  it('projects compact metadata and a system message from a policy', () => {
    const policy = selectResponsePolicy({ kind: 'answer' })
    expect(policy).not.toBeNull()
    expect(responsePolicyMetadata(policy!)).toEqual({
      responsePolicyId: 'default_brief_v1',
      responsePolicyMode: 'appended',
      responseStyle: 'default_brief',
    })
    expect(createResponsePolicyMessage(policy!)).toEqual({
      role: 'system',
      content: 'Be brief. Lead with the conclusion.',
    })
  })
})
