import { createInterface } from 'node:readline/promises'
import { join } from 'node:path'
import { cwd, stdin as defaultStdin, stdout as defaultStdout } from 'node:process'
import React from 'react'
import { render } from 'ink'
import type { EventRecord } from '../core/contracts'
import { commandHelpLines } from '../commands/registry'
import { listRecentSessions, loadSessionEvents } from '../commands/recentSessions'
import { App } from '../ui/App'

type CliDeps = {
  stdout?: (value: string) => void
  stdinSelect?: () => Promise<string>
  listRecentSessions?: typeof listRecentSessions
  loadSessionEvents?: typeof loadSessionEvents
  renderApp?: (props: {
    initialEvents?: EventRecord[]
    initialSessionId?: string
  }) => {
    waitUntilExit(): Promise<void>
  }
}

function printHelp(stdout: (value: string) => void) {
  stdout('Accorda CLI')
  stdout('')
  stdout('Usage:')
  stdout('  accorda')
  stdout('  accorda --resume')
  stdout('  accorda --help')
  stdout('')
  stdout('Flags:')
  commandHelpLines('cli').forEach(line => stdout(`  ${line}`))
}

function createSessionId(now: Date = new Date()) {
  return `session-${now.toISOString().replace(/[:.]/g, '-')}`
}

async function promptForSelection() {
  const readline = createInterface({
    input: defaultStdin,
    output: defaultStdout,
  })
  const answer = await readline.question('Select session: ')
  readline.close()
  return answer
}

export async function runCli(
  args: string[] = process.argv.slice(2),
  deps: CliDeps = {},
) {
  const stdout = deps.stdout ?? console.log
  const renderApp =
    deps.renderApp ??
    ((props: { initialEvents?: EventRecord[]; initialSessionId?: string }) =>
      render(React.createElement(App, props)))
  const runsDir = join(cwd(), '.accorda', 'runs')

  if (args.includes('--help')) {
    printHelp(stdout)
    return 0
  }

  if (args.includes('--resume')) {
    const recent = await (deps.listRecentSessions ?? listRecentSessions)(runsDir)
    if (!recent.length) {
      stdout('No resumable sessions found.')
      return 1
    }

    recent.forEach((item, index) => {
      stdout(`${index + 1}. ${item.sessionId}  ${item.preview}`)
    })

    const answer = await (deps.stdinSelect ?? promptForSelection)()
    const selected = recent[Number.parseInt(answer, 10) - 1]
    if (!selected) {
      stdout('Invalid resume selection.')
      return 1
    }

    const events = await (deps.loadSessionEvents ?? loadSessionEvents)(
      runsDir,
      selected.sessionId,
    )

    const app = renderApp({
      initialEvents: events,
      initialSessionId: selected.sessionId,
    })
    await app.waitUntilExit()
    return 0
  }

  const app = renderApp({ initialSessionId: createSessionId() })
  await app.waitUntilExit()
  return 0
}
