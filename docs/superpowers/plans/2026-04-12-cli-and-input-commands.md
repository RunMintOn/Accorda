# CLI And Input Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real editable TUI input box plus shared command handling for `/new`, `/resume`, `/help`, `accorda --resume`, and `accorda --help`.

**Architecture:** Introduce one shared command/session layer that both the TUI and the outer CLI can call. Keep the TUI rendering model intact, but move prompt handling to a small input-state helper and add a resume-aware app mode that can either compose normal messages or accept numeric session selection. The entrypoint should grow from a direct `render(<App />)` call into a CLI bootstrap that can print help, resume a session, or start a fresh TUI session.

**Tech Stack:** TypeScript, React, Ink, Vitest, ink-testing-library, Node.js fs/path/process

---

## File Structure

- `src/ui/input/inputState.ts`
  Handles cursor-aware editable input state, newline insertion, deletion, and movement.
- `src/ui/input/keyParser.ts`
  Converts raw terminal bytes into normalized input actions such as insert, move, newline, submit.
- `src/commands/registry.ts`
  Defines the shared command set and help metadata for `new`, `resume`, and `help`.
- `src/commands/recentSessions.ts`
  Lists `.accorda/runs/*`, derives recent session summaries, and loads event history.
- `src/cli/bootstrap.ts`
  Parses outer CLI flags and decides whether to print help, resume, or launch the TUI.
- `src/ui/App.tsx`
  Gains session-aware state, slash-command dispatch, and resume-selection mode.
- `src/ui/components/PromptInput.tsx`
  Stops owning raw stdin logic and becomes a render-only input view driven by app state.
- `src/index.tsx`
  Delegates to the new CLI bootstrap instead of directly rendering the app.

---

### Task 1: Add Shared Command And Recent-Session Primitives

**Files:**
- Create: `src/commands/registry.ts`
- Create: `src/commands/recentSessions.ts`
- Test: `test/command-registry.test.ts`
- Test: `test/recent-sessions.test.ts`

- [ ] **Step 1: Write the failing command-registry tests**

```ts
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
```

- [ ] **Step 2: Write the failing recent-session tests**

```ts
import { describe, expect, it } from 'vitest'
import type { EventRecord } from '../src/core/contracts'
import {
  listRecentSessions,
  loadSessionEvents,
} from '../src/commands/recentSessions'

describe('recent sessions', () => {
  it('sorts recent sessions by updated time and includes prompt preview', async () => {
    const alphaEvents: EventRecord[] = [
      {
        id: 'evt-user-a',
        sessionId: 'alpha',
        timestamp: '2026-04-12T10:00:00.000Z',
        type: 'user_message',
        payload: { text: 'alpha prompt' },
      },
    ]
    const betaEvents: EventRecord[] = [
      {
        id: 'evt-user-b',
        sessionId: 'beta',
        timestamp: '2026-04-12T11:00:00.000Z',
        type: 'user_message',
        payload: { text: 'beta prompt' },
      },
    ]

    const sessions = await listRecentSessions('/tmp/accorda-runs', {
      listRunDirectories: async () => ['alpha', 'beta'],
      readSessionEvents: async sessionId =>
        sessionId === 'alpha' ? alphaEvents : betaEvents,
    })

    expect(sessions).toEqual([
      {
        sessionId: 'beta',
        updatedAt: '2026-04-12T11:00:00.000Z',
        preview: 'beta prompt',
      },
      {
        sessionId: 'alpha',
        updatedAt: '2026-04-12T10:00:00.000Z',
        preview: 'alpha prompt',
      },
    ])
  })

  it('loads a session event history from its event log path', async () => {
    const events: EventRecord[] = [
      {
        id: 'evt-user',
        sessionId: 'resume-me',
        timestamp: '2026-04-12T12:00:00.000Z',
        type: 'user_message',
        payload: { text: 'resume this' },
      },
    ]

    expect(
      await loadSessionEvents('/tmp/accorda-runs', 'resume-me', {
        readSessionEvents: async () => events,
      }),
    ).toEqual(events)
  })
})
```

- [ ] **Step 3: Run the new tests to verify they fail**

Run: `npm test -- test/command-registry.test.ts test/recent-sessions.test.ts`
Expected: FAIL because `src/commands/registry.ts` and `src/commands/recentSessions.ts` do not exist yet

- [ ] **Step 4: Add the shared command registry**

```ts
// src/commands/registry.ts
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
      return [
        `${command.tuiSyntax.padEnd(10, ' ')}${command.description}`,
      ]
    }

    if (!command.cliSyntax) return []
    return [`${command.cliSyntax.padEnd(10, ' ')}${command.description}`]
  })
}
```

- [ ] **Step 5: Add the recent-session loader**

```ts
// src/commands/recentSessions.ts
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { EventRecord } from '../core/contracts'
import { createEventLogStore } from '../store/eventLogStore'

export type RecentSessionSummary = {
  sessionId: string
  updatedAt: string
  preview: string
}

type RecentSessionDeps = {
  listRunDirectories?: (runsDir: string) => Promise<string[]>
  readSessionEvents?: (sessionId: string, eventLogPath: string) => Promise<EventRecord[]>
}

async function defaultListRunDirectories(runsDir: string) {
  try {
    return await readdir(runsDir)
  } catch {
    return []
  }
}

async function defaultReadSessionEvents(_sessionId: string, eventLogPath: string) {
  return createEventLogStore(eventLogPath).readAll()
}

function latestTimestamp(events: EventRecord[]): string {
  return [...events]
    .reverse()
    .find(event => typeof event.timestamp === 'string')?.timestamp ?? ''
}

function lastUserPreview(events: EventRecord[]): string {
  const text = [...events]
    .reverse()
    .find(event => event.type === 'user_message')?.payload.text
  return typeof text === 'string' ? text : ''
}

export async function listRecentSessions(
  runsDir: string,
  deps: RecentSessionDeps = {},
): Promise<RecentSessionSummary[]> {
  const listRunDirectories = deps.listRunDirectories ?? defaultListRunDirectories
  const readSessionEvents = deps.readSessionEvents ?? defaultReadSessionEvents
  const sessionIds = await listRunDirectories(runsDir)

  const summaries = await Promise.all(
    sessionIds.map(async sessionId => {
      const eventLogPath = join(runsDir, sessionId, 'events.jsonl')
      const events = await readSessionEvents(sessionId, eventLogPath)
      return {
        sessionId,
        updatedAt: latestTimestamp(events),
        preview: lastUserPreview(events),
      }
    }),
  )

  return summaries
    .filter(summary => summary.updatedAt)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export async function loadSessionEvents(
  runsDir: string,
  sessionId: string,
  deps: RecentSessionDeps = {},
): Promise<EventRecord[]> {
  const readSessionEvents = deps.readSessionEvents ?? defaultReadSessionEvents
  return readSessionEvents(sessionId, join(runsDir, sessionId, 'events.jsonl'))
}
```

- [ ] **Step 6: Run the command and recent-session tests to verify they pass**

Run: `npm test -- test/command-registry.test.ts test/recent-sessions.test.ts`
Expected: PASS with 4 tests passed

- [ ] **Step 7: Commit the shared command/session layer**

```bash
git add src/commands/registry.ts src/commands/recentSessions.ts test/command-registry.test.ts test/recent-sessions.test.ts
git commit -m "feat(commands): add shared command and session primitives"
```

### Task 2: Add Cursor-Aware Input State Helpers

**Files:**
- Create: `src/ui/input/inputState.ts`
- Create: `src/ui/input/keyParser.ts`
- Test: `test/input-state.test.ts`

- [ ] **Step 1: Write the failing input-state tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  applyInputAction,
  createInputState,
} from '../src/ui/input/inputState'

describe('inputState', () => {
  it('inserts text at the cursor and moves left/right', () => {
    let state = createInputState()
    state = applyInputAction(state, { type: 'insert', text: 'abc' })
    state = applyInputAction(state, { type: 'move_left' })
    state = applyInputAction(state, { type: 'insert', text: 'X' })

    expect(state.value).toBe('abXc')
    expect(state.cursor).toBe(3)
  })

  it('treats Enter as newline and Ctrl+Enter as submit', () => {
    let state = createInputState()
    state = applyInputAction(state, { type: 'insert', text: 'line1' })
    state = applyInputAction(state, { type: 'newline' })
    state = applyInputAction(state, { type: 'insert', text: 'line2' })

    expect(state.value).toBe('line1\\nline2')
    expect(state.cursor).toBe('line1\\nline2'.length)
    expect(applyInputAction(state, { type: 'submit' }).submitted).toBe(true)
  })

  it('deletes with backspace and ignores empty submission', () => {
    let state = createInputState()
    expect(applyInputAction(state, { type: 'submit' }).submitted).toBe(false)

    state = applyInputAction(state, { type: 'insert', text: 'ab' })
    state = applyInputAction(state, { type: 'backspace' })

    expect(state.value).toBe('a')
    expect(state.cursor).toBe(1)
  })
})
```

- [ ] **Step 2: Write the failing key-parser tests**

```ts
import { describe, expect, it } from 'vitest'
import { parseKeyBuffer } from '../src/ui/input/keyParser'

describe('parseKeyBuffer', () => {
  it('maps enter to newline and ctrl+enter to submit', () => {
    expect(parseKeyBuffer(Buffer.from([13]))).toEqual({ type: 'newline' })
    expect(parseKeyBuffer(Buffer.from([27, 13]))).toEqual({ type: 'submit' })
  })

  it('maps arrows and backspace to editor actions', () => {
    expect(parseKeyBuffer(Buffer.from([27, 91, 68]))).toEqual({ type: 'move_left' })
    expect(parseKeyBuffer(Buffer.from([27, 91, 67]))).toEqual({ type: 'move_right' })
    expect(parseKeyBuffer(Buffer.from([127]))).toEqual({ type: 'backspace' })
  })
})
```

- [ ] **Step 3: Run the input-state tests to verify they fail**

Run: `npm test -- test/input-state.test.ts`
Expected: FAIL because `src/ui/input/inputState.ts` and `src/ui/input/keyParser.ts` do not exist yet

- [ ] **Step 4: Add the input state reducer**

```ts
// src/ui/input/inputState.ts
export type InputAction =
  | { type: 'insert'; text: string }
  | { type: 'move_left' }
  | { type: 'move_right' }
  | { type: 'backspace' }
  | { type: 'newline' }
  | { type: 'submit' }

export type InputState = {
  value: string
  cursor: number
  submitted: boolean
}

export function createInputState(value = ''): InputState {
  return {
    value,
    cursor: value.length,
    submitted: false,
  }
}

export function applyInputAction(
  state: InputState,
  action: InputAction,
): InputState {
  if (action.type === 'insert') {
    const value =
      state.value.slice(0, state.cursor) +
      action.text +
      state.value.slice(state.cursor)
    return {
      value,
      cursor: state.cursor + action.text.length,
      submitted: false,
    }
  }

  if (action.type === 'move_left') {
    return { ...state, cursor: Math.max(0, state.cursor - 1), submitted: false }
  }

  if (action.type === 'move_right') {
    return {
      ...state,
      cursor: Math.min(state.value.length, state.cursor + 1),
      submitted: false,
    }
  }

  if (action.type === 'backspace') {
    if (state.cursor === 0) return { ...state, submitted: false }
    return {
      value: state.value.slice(0, state.cursor - 1) + state.value.slice(state.cursor),
      cursor: state.cursor - 1,
      submitted: false,
    }
  }

  if (action.type === 'newline') {
    return applyInputAction(state, { type: 'insert', text: '\n' })
  }

  return {
    ...state,
    submitted: state.value.trim().length > 0,
  }
}
```

- [ ] **Step 5: Add the raw key parser**

```ts
// src/ui/input/keyParser.ts
import type { InputAction } from './inputState'

export function parseKeyBuffer(buffer: Buffer): InputAction | null {
  const bytes = Array.from(buffer)

  if (bytes.length === 1 && bytes[0] === 13) return { type: 'newline' }
  if (bytes.length === 2 && bytes[0] === 27 && bytes[1] === 13) {
    return { type: 'submit' }
  }
  if (bytes.length === 3 && bytes[0] === 27 && bytes[1] === 91 && bytes[2] === 68) {
    return { type: 'move_left' }
  }
  if (bytes.length === 3 && bytes[0] === 27 && bytes[1] === 91 && bytes[2] === 67) {
    return { type: 'move_right' }
  }
  if (bytes.length === 1 && (bytes[0] === 127 || bytes[0] === 8)) {
    return { type: 'backspace' }
  }

  const text = buffer.toString('utf8')
  if (text) return { type: 'insert', text }
  return null
}
```

- [ ] **Step 6: Run the input-state tests to verify they pass**

Run: `npm test -- test/input-state.test.ts`
Expected: PASS with 5 tests passed

- [ ] **Step 7: Commit the input-state helpers**

```bash
git add src/ui/input/inputState.ts src/ui/input/keyParser.ts test/input-state.test.ts
git commit -m "feat(ui): add editable input state helpers"
```

### Task 3: Integrate Slash Commands And Resume Mode Into The TUI

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/components/PromptInput.tsx`
- Test: `test/interactive-app.test.tsx`

- [ ] **Step 1: Write the failing interactive app tests**

```tsx
import React from 'react'
import { render } from 'ink-testing-library'
import { describe, expect, it } from 'vitest'
import { App } from '../src/ui/App'
import type { EventRecord } from '../src/core/contracts'

describe('interactive app', () => {
  it('renders multi-line input text without auto-submitting on Enter', async () => {
    const { stdin, lastFrame } = render(<App onSubmit={async () => []} />)

    stdin.write('a')
    stdin.write('\r')
    stdin.write('b')

    await new Promise(resolve => setTimeout(resolve, 50))

    expect(lastFrame()).toContain('a')
    expect(lastFrame()).toContain('b')
    expect(lastFrame()).not.toContain('Waiting for runtime result')
  })

  it('shows command help from /help and resets the session on /new', async () => {
    const events: EventRecord[] = [
      {
        id: 'evt-user',
        sessionId: 'session-test',
        timestamp: '2026-04-12T12:00:00.000Z',
        type: 'user_message',
        payload: { text: 'before reset' },
      },
    ]
    const { stdin, lastFrame } = render(<App initialEvents={events} onSubmit={async () => []} />)

    stdin.write('/help')
    stdin.write('\x1b\r')
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(lastFrame()).toContain('/resume')

    stdin.write('/new')
    stdin.write('\x1b\r')
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(lastFrame()).not.toContain('before reset')
  })

  it('shows recent sessions for /resume and restores the selected history', async () => {
    const { stdin, lastFrame } = render(
      <App
        onSubmit={async () => []}
        listRecentSessions={async () => [
          {
            sessionId: 'resume-me',
            updatedAt: '2026-04-12T12:00:00.000Z',
            preview: 'restore this one',
          },
        ]}
        loadSessionEvents={async () => [
          {
            id: 'evt-restored',
            sessionId: 'resume-me',
            timestamp: '2026-04-12T12:00:00.000Z',
            type: 'user_message',
            payload: { text: 'restore this one' },
          },
        ]}
      />,
    )

    stdin.write('/resume')
    stdin.write('\x1b\r')
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(lastFrame()).toContain('1. resume-me')

    stdin.write('1')
    stdin.write('\x1b\r')
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(lastFrame()).toContain('restore this one')
  })
})
```

- [ ] **Step 2: Run the interactive app tests to verify they fail**

Run: `npm test -- test/interactive-app.test.tsx`
Expected: FAIL because Enter still submits, slash commands do not exist, and the app has no resume/help command mode

- [ ] **Step 3: Add the minimal slash-command and resume-aware app state**

```tsx
// src/ui/App.tsx
async function defaultSubmit(text: string, sessionId: string): Promise<EventRecord[]> {
  return runLocalTurn(sessionId, text)
}

type AppDeps = {
  listRecentSessions?: typeof listRecentSessions
  loadSessionEvents?: typeof loadSessionEvents
}

type AppMode =
  | { kind: 'compose' }
  | { kind: 'resume_select'; sessions: RecentSessionSummary[] }

type Props = {
  initialEvents?: EventRecord[]
  initialSessionId?: string
  onSubmit?: (text: string, sessionId: string) => Promise<EventRecord[]>
} & AppDeps

function createSessionId(now: Date = new Date()) {
  return `session-${now.toISOString().replace(/[:.]/g, '-')}`
}

export function App({
  initialEvents = [],
  initialSessionId = 'local',
  onSubmit = defaultSubmit,
  listRecentSessions: listRecentSessionsProp = listRecentSessions,
  loadSessionEvents: loadSessionEventsProp = loadSessionEvents,
}: Props) {
  const { stdin } = useStdin()
  const [events, setEvents] = React.useState<EventRecord[]>(initialEvents)
  const [inputState, setInputState] = React.useState(createInputState())
  const [mode, setMode] = React.useState<AppMode>({ kind: 'compose' })
  const [sessionId, setSessionId] = React.useState(initialSessionId)

  React.useEffect(() => {
    function onData(data: Buffer | string) {
      if (isLoading) return
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
      const action = parseKeyBuffer(buffer)
      if (!action) return

      const nextState = applyInputAction(inputState, action)
      if (action.type === 'submit') {
        void handleSubmit(nextState.value)
        return
      }

      setInputState(nextState)
    }

    stdin.on('data', onData)
    return () => {
      stdin.off('data', onData)
    }
  }, [handleSubmit, inputState, isLoading, stdin])

  async function handleSubmit(currentValue: string) {
    const text = currentValue.trim()
    if (!text) return

    if (mode.kind === 'resume_select') {
      const index = Number.parseInt(text, 10) - 1
      const selected = mode.sessions[index]
      if (!selected) {
        setEvents(current => [
          ...current,
          {
            id: `evt-invalid-resume-${Date.now()}`,
            sessionId,
            timestamp: new Date().toISOString(),
            type: 'system_status',
            payload: {
              message: 'Invalid resume selection',
              level: 'error',
              stage: 'error',
              reason: 'invalid_resume_selection',
            },
          },
        ])
        setInputState(createInputState())
        return
      }

      const restored = await loadSessionEventsProp('.accorda/runs', selected.sessionId)
      setSessionId(selected.sessionId)
      setEvents(restored)
      setMode({ kind: 'compose' })
      setInputState(createInputState())
      return
    }

    if (text === '/help') {
      setEvents(current => [
        ...current,
        {
          id: `evt-help-${Date.now()}`,
          sessionId,
          timestamp: new Date().toISOString(),
          type: 'assistant_text',
          payload: { text: commandHelpLines('tui').join('\n') },
        },
      ])
      setInputState(createInputState())
      return
    }

    if (text === '/new') {
      setSessionId(createSessionId())
      setEvents([])
      setMode({ kind: 'compose' })
      setInputState(createInputState())
      return
    }

    if (text === '/resume') {
      const sessions = await listRecentSessionsProp('.accorda/runs')
      setMode({ kind: 'resume_select', sessions })
      setEvents(current => [
        ...current,
        {
          id: `evt-resume-${Date.now()}`,
          sessionId,
          timestamp: new Date().toISOString(),
          type: 'assistant_text',
          payload: {
            text: sessions.length
              ? sessions.map((item, index) => `${index + 1}. ${item.sessionId}  ${item.preview}`).join('\n')
              : 'No resumable sessions found.',
          },
        },
      ])
      setInputState(createInputState())
      return
    }

    const nextEvents = await onSubmit(text, sessionId)
    setEvents(current => [...current, ...nextEvents])
    setInputState(createInputState())
  }
```

- [ ] **Step 4: Make the prompt component render the editable buffer instead of owning stdin**

```tsx
// src/ui/components/PromptInput.tsx
type Props = {
  value: string
  cursor: number
  isLoading: boolean
}

function renderCursor(value: string, cursor: number) {
  return `${value.slice(0, cursor)}|${value.slice(cursor)}`
}

export function PromptInput({ value, cursor, isLoading }: Props) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="single" borderColor={isLoading ? 'yellow' : 'gray'} width="100%">
        <Text color={value ? undefined : 'gray'}>
          {renderCursor(value || 'Try "create a util logging.py that..."', cursor)}
        </Text>
      </Box>
      <Box paddingX={1}>
        <Text color="gray">Enter: newline · Ctrl+Enter: submit · ctrl+c to exit</Text>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 5: Run the interactive app tests to verify they pass**

Run: `npm test -- test/interactive-app.test.tsx`
Expected: PASS with Enter staying in compose mode and slash commands working

- [ ] **Step 6: Commit the TUI integration**

```bash
git add src/ui/App.tsx src/ui/components/PromptInput.tsx test/interactive-app.test.tsx
git commit -m "feat(ui): add slash commands and resume mode"
```

### Task 4: Add Outer CLI Bootstrap For `accorda`, `--resume`, And `--help`

**Files:**
- Create: `src/cli/bootstrap.ts`
- Modify: `src/index.tsx`
- Test: `test/cli-bootstrap.test.ts`

- [ ] **Step 1: Write the failing CLI bootstrap tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import type { EventRecord } from '../src/core/contracts'
import { runCli } from '../src/cli/bootstrap'

describe('runCli', () => {
  it('prints help and exits for --help', async () => {
    const stdout: string[] = []

    const code = await runCli(['--help'], {
      stdout: value => stdout.push(value),
      renderApp: () => ({ waitUntilExit: async () => {} }),
    })

    expect(code).toBe(0)
    expect(stdout.join('\n')).toContain('--resume')
  })

  it('loads a resumed session before rendering for --resume', async () => {
    const renderApp = vi.fn(() => ({ waitUntilExit: async () => {} }))

    await runCli(['--resume'], {
      stdout: () => {},
      stdinSelect: async () => '1',
      listRecentSessions: async () => [
        {
          sessionId: 'resume-me',
          updatedAt: '2026-04-12T12:00:00.000Z',
          preview: 'resume this',
        },
      ],
      loadSessionEvents: async (): Promise<EventRecord[]> => [
        {
          id: 'evt-user',
          sessionId: 'resume-me',
          timestamp: '2026-04-12T12:00:00.000Z',
          type: 'user_message',
          payload: { text: 'resume this' },
        },
      ],
      renderApp,
    })

    expect(renderApp).toHaveBeenCalledWith({
      initialEvents: [
        {
          id: 'evt-user',
          sessionId: 'resume-me',
          timestamp: '2026-04-12T12:00:00.000Z',
          type: 'user_message',
          payload: { text: 'resume this' },
        },
      ],
      initialSessionId: 'resume-me',
    })
  })
})
```

- [ ] **Step 2: Run the CLI bootstrap tests to verify they fail**

Run: `npm test -- test/cli-bootstrap.test.ts`
Expected: FAIL because `src/cli/bootstrap.ts` does not exist yet

- [ ] **Step 3: Add the outer CLI bootstrap**

```ts
// src/cli/bootstrap.ts
import { createInterface } from 'node:readline/promises'
import { stdin as defaultStdin, stdout as defaultStdout } from 'node:process'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { render } from 'ink'
import React from 'react'
import type { EventRecord } from '../core/contracts'
import { App } from '../ui/App'
import { commandHelpLines } from '../commands/registry'
import { listRecentSessions, loadSessionEvents } from '../commands/recentSessions'

type CliDeps = {
  stdout?: (value: string) => void
  stdinSelect?: () => Promise<string>
  listRecentSessions?: typeof listRecentSessions
  loadSessionEvents?: typeof loadSessionEvents
  renderApp?: (props: { initialEvents?: EventRecord[]; initialSessionId?: string }) => {
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

export async function runCli(
  args: string[] = process.argv.slice(2),
  deps: CliDeps = {},
) {
  const stdout = deps.stdout ?? console.log
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

    const stdinSelect =
      deps.stdinSelect ??
      (async () => {
        const readline = createInterface({ input: defaultStdin, output: defaultStdout })
        const answer = await readline.question('Select session: ')
        readline.close()
        return answer
      })

    const answer = await stdinSelect()
    const selected = recent[Number.parseInt(answer, 10) - 1]
    if (!selected) {
      stdout('Invalid resume selection.')
      return 1
    }

    const events = await (deps.loadSessionEvents ?? loadSessionEvents)(
      runsDir,
      selected.sessionId,
    )

    const app = (deps.renderApp ?? (props => render(<App {...props} />)))({
      initialEvents: events,
      initialSessionId: selected.sessionId,
    })
    await app.waitUntilExit()
    return 0
  }

  const app = (deps.renderApp ?? (props => render(<App {...props} />)))({})
  await app.waitUntilExit()
  return 0
}
```

- [ ] **Step 4: Wire the main entrypoint through the new bootstrap**

```ts
// src/index.tsx
import { runCli } from './cli/bootstrap'

export async function main() {
  return runCli(process.argv.slice(2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(code => {
    process.exitCode = code
  })
}
```

- [ ] **Step 5: Run the CLI bootstrap tests to verify they pass**

Run: `npm test -- test/cli-bootstrap.test.ts`
Expected: PASS with help output and resume bootstrap working

- [ ] **Step 6: Commit the CLI bootstrap**

```bash
git add src/cli/bootstrap.ts src/index.tsx test/cli-bootstrap.test.ts
git commit -m "feat(cli): add help and resume bootstrap"
```

### Task 5: Run Full Verification

**Files:**
- Test: `test/command-registry.test.ts`
- Test: `test/recent-sessions.test.ts`
- Test: `test/input-state.test.ts`
- Test: `test/interactive-app.test.tsx`
- Test: `test/cli-bootstrap.test.ts`

- [ ] **Step 1: Run focused command/input tests**

Run: `npm test -- test/command-registry.test.ts test/recent-sessions.test.ts test/input-state.test.ts test/interactive-app.test.tsx test/cli-bootstrap.test.ts`
Expected: PASS with all new command/input tests green

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS with all existing runtime, UI, and CLI tests green

- [ ] **Step 3: Smoke the help flag**

Run: `npm run dev -- --help`
Expected: prints help text containing `--resume` and exits with status 0

- [ ] **Step 4: Smoke resume when no sessions exist or selection is invalid**

Run: `node --import tsx src/index.tsx --resume`
Expected: prints either `No resumable sessions found.` or a session list followed by a clear invalid-selection error; no crash

- [ ] **Step 5: Review git status**

Run: `git status --short`
Expected: no unexpected files; only intended command, input, CLI, and test changes remain

- [ ] **Step 6: Commit the verification pass**

```bash
git add src test
git commit -m "test(cli): verify input and command flow"
```
