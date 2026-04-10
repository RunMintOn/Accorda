import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { SessionMeta } from '../core/contracts'

export function createSessionMetaStore(path: string) {
  return {
    async load(): Promise<SessionMeta | null> {
      try {
        return JSON.parse(await readFile(path, 'utf8')) as SessionMeta
      } catch {
        return null
      }
    },
    async save(meta: SessionMeta) {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, JSON.stringify(meta, null, 2), 'utf8')
    },
  }
}
