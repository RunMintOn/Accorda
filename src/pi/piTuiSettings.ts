import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { cwd } from 'node:process'
import type { ThinkingLevel } from '@earendil-works/pi-agent-core'
import type { Model } from '@earendil-works/pi-ai/compat'

export type PiTuiSettings = {
  model?: { provider: string; id: string }
  thinkingLevel?: ThinkingLevel
  scopedModels: Array<{ provider: string; id: string; label?: string }>
}

export const defaultScopedModels: PiTuiSettings['scopedModels'] = [
  { provider: 'deepseek', id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { provider: 'deepseek', id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { provider: 'openai-codex', id: 'gpt-5.3-codex-spark', label: 'Codex Spark' },
  { provider: 'openai-codex', id: 'gpt-5.4', label: 'Codex 5.4' },
  { provider: 'openai-codex', id: 'gpt-5.4-mini', label: 'Codex 5.4 Mini' },
  { provider: 'openai-codex', id: 'gpt-5.5', label: 'Codex 5.5' },
]

export function settingsPath() {
  return join(cwd(), '.accorda', 'pi-agent', 'accorda-tui.json')
}

export async function loadPiTuiSettings(path = settingsPath()): Promise<PiTuiSettings> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<PiTuiSettings>
    return {
      model: parsed.model,
      thinkingLevel: parsed.thinkingLevel,
      scopedModels: parsed.scopedModels?.length ? parsed.scopedModels : defaultScopedModels,
    }
  } catch {
    const settings: PiTuiSettings = {
      thinkingLevel: 'medium',
      scopedModels: defaultScopedModels,
    }
    await savePiTuiSettings(settings, path)
    return settings
  }
}

export async function savePiTuiSettings(settings: PiTuiSettings, path = settingsPath()) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
}

export function modelKey(model: Model<any>) {
  const candidate = model as unknown as { provider?: string; id?: string; name?: string }
  return { provider: candidate.provider ?? '', id: candidate.id ?? candidate.name ?? '' }
}

export function findConfiguredModel(models: Model<any>[], settings: PiTuiSettings) {
  if (settings.model) {
    const selected = models.find(model => {
      const key = modelKey(model)
      return key.provider === settings.model?.provider && key.id === settings.model.id
    })
    if (selected) return selected
  }

  return scopedAvailableModels(models, settings)[0] ?? models[0]
}

export function scopedAvailableModels(models: Model<any>[], settings: PiTuiSettings) {
  const scoped = settings.scopedModels
    .map(item =>
      models.find(model => {
        const key = modelKey(model)
        return key.provider === item.provider && key.id === item.id
      }),
    )
    .filter((model): model is Model<any> => Boolean(model))

  return scoped.length ? scoped : models
}
