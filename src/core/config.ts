import { cwd } from 'node:process'

export type AppConfig = {
  provider: {
    baseURL: string
    apiKey: string
    model: string
  }
  workspaceRoot: string
}

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): AppConfig {
  const baseURL = env.CONTEXTA_BASE_URL
  const apiKey = env.CONTEXTA_API_KEY
  const model = env.CONTEXTA_MODEL

  if (!baseURL) throw new Error('Missing CONTEXTA_BASE_URL')
  if (!apiKey) throw new Error('Missing CONTEXTA_API_KEY')
  if (!model) throw new Error('Missing CONTEXTA_MODEL')

  return {
    provider: {
      baseURL,
      apiKey,
      model,
    },
    workspaceRoot: cwd(),
  }
}
