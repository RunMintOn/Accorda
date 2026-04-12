import { describe, expect, it } from 'vitest'
import { COMMANDS, commandHelpLines, getCommand } from '../src/commands/registry'

describe('command registry', () => {
  it('defines the shared TUI and CLI command set', () => {
    expect(COMMANDS.map(command => command.name)).toEqual([
      'new',
      'resume',
      'help',
    ])
    expect(getCommand('resume')?.description).toBe('resume a recent session')
  })

  it('produces stable help lines for TUI and CLI surfaces', () => {
    expect(commandHelpLines('tui')).toEqual([
      '/new      start a new session',
      '/resume   resume a recent session',
      '/help     show available commands',
    ])
    expect(commandHelpLines('cli')).toEqual([
      '--resume  resume a recent session',
      '--help    show available commands',
    ])
  })
})
