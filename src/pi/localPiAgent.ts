import { access, copyFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { getAgentDir } from '@earendil-works/pi-coding-agent'

async function exists(path: string) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export function getLocalPiAgentDir() {
  return join(cwd(), '.accorda', 'pi-agent')
}

export async function ensureLocalPiAgentDir(agentDir = getLocalPiAgentDir()) {
  await mkdir(agentDir, { recursive: true })

  const globalAgentDir = getAgentDir()
  for (const file of ['auth.json', 'models.json', 'settings.json']) {
    const source = join(globalAgentDir, file)
    const target = join(agentDir, file)
    if (!(await exists(target)) && (await exists(source))) {
      await copyFile(source, target)
    }
  }

  return agentDir
}
