import OpenAI from 'openai'
import type { AppConfig } from '../core/config'

export function createOpenAICompatibleClient(config: AppConfig) {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  })
}
