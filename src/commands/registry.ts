export type CommandName = 'new' | 'resume' | 'help'
export type CommandSurface = 'tui' | 'cli'

export type CommandDefinition = {
  name: CommandName
  description: string
  tuiSyntax: `/${string}`
  cliSyntax?: `--${string}`
}

export const COMMANDS: CommandDefinition[] = [
  {
    name: 'new',
    description: 'start a new session',
    tuiSyntax: '/new',
  },
  {
    name: 'resume',
    description: 'resume a recent session',
    tuiSyntax: '/resume',
    cliSyntax: '--resume',
  },
  {
    name: 'help',
    description: 'show available commands',
    tuiSyntax: '/help',
    cliSyntax: '--help',
  },
]

export function getCommand(name: string): CommandDefinition | undefined {
  return COMMANDS.find(command => command.name === name)
}

export function commandHelpLines(surface: CommandSurface): string[] {
  return COMMANDS.flatMap(command => {
    if (surface === 'tui') {
      return [`${command.tuiSyntax.padEnd(10, ' ')}${command.description}`]
    }

    if (!command.cliSyntax) return []
    return [`${command.cliSyntax.padEnd(10, ' ')}${command.description}`]
  })
}
