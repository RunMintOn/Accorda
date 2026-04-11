import OpenAI from 'openai'
import type { AppConfig } from '../core/config'

export function createOpenAICompatibleClient(config: AppConfig) {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  })
}

export async function createTextCompletion(
  config: AppConfig,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
): Promise<string> {
  const client = createOpenAICompatibleClient(config)
  const completion = await client.chat.completions.create({
    model: config.model,
    messages,
  })

  return completion.choices[0]?.message.content ?? ''
}
