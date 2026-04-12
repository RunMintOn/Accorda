import OpenAI from 'openai'
import type { AppConfig } from '../core/config'
import type { ProviderResultMetadata } from '../core/contracts'

export type ProviderTextResult = {
  text: string
} & ProviderResultMetadata

export type ChatCompletionBody = {
  model: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
}

export function createOpenAICompatibleClient(config: AppConfig) {
  return new OpenAI({
    apiKey: config.provider.apiKey,
    baseURL: config.provider.baseURL,
  })
}

function providerResultFromCompletion(
  completion: Awaited<
    ReturnType<
      ReturnType<typeof createOpenAICompatibleClient>['chat']['completions']['create']
    >
  >,
): ProviderTextResult {
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

export async function createTextCompletionFromBody(
  config: AppConfig,
  body: ChatCompletionBody,
): Promise<ProviderTextResult> {
  const client = createOpenAICompatibleClient(config)
  const completion = await client.chat.completions.create(body)

  return providerResultFromCompletion(completion)
}

export async function createTextCompletion(
  config: AppConfig,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
): Promise<ProviderTextResult> {
  return createTextCompletionFromBody(config, {
    model: config.provider.model,
    messages,
  })
}
