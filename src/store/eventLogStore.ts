import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { EventRecord } from '../core/contracts'

export function createEventLogStore(path: string) {
  return {
    async append(event: EventRecord) {
      await mkdir(dirname(path), { recursive: true })
      await appendFile(path, JSON.stringify(event) + '\n', 'utf8')
    },
    async readAll(): Promise<EventRecord[]> {
      try {
        const raw = await readFile(path, 'utf8')
        return raw
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line) as EventRecord)
      } catch {
        return []
      }
    },
  }
}
