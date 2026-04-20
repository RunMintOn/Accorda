import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createExecuteToolCatalog } from '../src/tools/executeCatalog'

let root = ''

afterEach(async () => {
  if (!root) return
  await rm(root, { recursive: true, force: true })
  root = ''
})

describe('execute tool catalog', () => {
  it('exposes ask_user and finish as control tools', async () => {
    root = await mkdtemp(join(tmpdir(), 'accorda-execute-tools-'))
    const catalog = createExecuteToolCatalog(root)

    expect(catalog.definitions.map(tool => tool.name)).toContain('ask_user')
    expect(catalog.definitions.map(tool => tool.name)).toContain('finish')
  })

  it('writes files inside the workspace root', async () => {
    root = await mkdtemp(join(tmpdir(), 'accorda-execute-tools-'))
    const catalog = createExecuteToolCatalog(root)

    await catalog.handlers.write({
      path: 'notes.txt',
      content: 'hello from write',
    })

    await expect(readFile(join(root, 'notes.txt'), 'utf8')).resolves.toBe(
      'hello from write',
    )
  })

  it('edits files by replacing a required oldText match', async () => {
    root = await mkdtemp(join(tmpdir(), 'accorda-execute-tools-'))
    await writeFile(join(root, 'notes.txt'), 'hello world', 'utf8')
    const catalog = createExecuteToolCatalog(root)

    await catalog.handlers.edit({
      path: 'notes.txt',
      oldText: 'world',
      newText: 'accorda',
    })

    await expect(readFile(join(root, 'notes.txt'), 'utf8')).resolves.toBe(
      'hello accorda',
    )
  })
})
