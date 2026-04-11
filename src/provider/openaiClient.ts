import OpenAI from 'openai'
import type { AppConfig } from '../core/config'
import type { ProviderResultMetadata } from '../core/contracts'

export type ProviderTextResult = {
  text: string
} & ProviderResultMetadata

export function createOpenAICompatibleClient(config: AppConfig) {
  return new OpenAI({
    apiKey: config.provider.apiKey,
    baseURL: config.provider.baseURL,
  })
}

export async function createTextCompletion(
  config: AppConfig,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
): Promise<ProviderTextResult> {
  const client = createOpenAICompatibleClient(config)
  const completion = await client.chat.completions.create({
    model: config.provider.model,
    messages,
  })

  const choice = completion.choices[0]

  return {
    text: choice?.message.content ?? '',
    model: completion.model,
    finishReason: choice?.finish_reason ?? undefined,
    toolCalls: choice?.message.tool_calls ?? undefined,
    usage: completion.usage
      ? {
          inputTokens: completion.usage.prompt_tokens,
          outputTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : undefined,
    raw: completion,
  }
}
