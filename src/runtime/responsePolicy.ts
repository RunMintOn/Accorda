import type { ControlDecision } from './controlDecision.js'

export type ResponsePolicyId = 'default_brief_v1' | 'clarify_direct_v1'
export type ResponsePolicyMode = 'appended'
export type ResponseStyle = 'default_brief' | 'clarify_direct'

export type ResponsePolicy = {
  id: ResponsePolicyId
  mode: ResponsePolicyMode
  style: ResponseStyle
  prompt: string
}

const DEFAULT_BRIEF_POLICY: ResponsePolicy = {
  id: 'default_brief_v1',
  mode: 'appended',
  style: 'default_brief',
  prompt: 'Be brief. Lead with the conclusion.',
}

const CLARIFY_DIRECT_POLICY: ResponsePolicy = {
  id: 'clarify_direct_v1',
  mode: 'appended',
  style: 'clarify_direct',
  prompt:
    'Ask one direct clarification question for the single most important missing detail. Be specific and concise. Do not explain the whole plan.',
}

export function selectResponsePolicy(
  decision: Pick<ControlDecision, 'kind'>,
): ResponsePolicy | null {
  if (decision.kind === 'answer' || decision.kind === 'execute') {
    return DEFAULT_BRIEF_POLICY
  }

  if (decision.kind === 'clarify') {
    return CLARIFY_DIRECT_POLICY
  }

  return null
}

export function responsePolicyMetadata(policy: ResponsePolicy) {
  return {
    responsePolicyId: policy.id,
    responsePolicyMode: policy.mode,
    responseStyle: policy.style,
  }
}

export function createResponsePolicyMessage(policy: ResponsePolicy) {
  return {
    role: 'system' as const,
    content: policy.prompt,
  }
}
