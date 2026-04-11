# Agent-Friendly Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a non-interactive run-once path that lets external agents start Accorda, execute one task, and inspect a persisted event log.

**Architecture:** Keep the existing Ink TUI path unchanged. Extend `runLocalTurn` with optional event-log and artifact-output settings, then add a separate `src/cli/runOnce.ts` command for automation. The run-once command prints a small JSON summary to stdout and persists full runtime events to JSONL.

**Tech Stack:** TypeScript, Node.js ESM, tsx, Vitest, existing `createAgentRuntime`, existing `createEventLogStore`.

---

## Scope

This plan implements Phase 1 from `../../../../docs/2-讨论与目标/v1实现路线.md`: Agent-friendly self-iteration.

In scope:

- A run-once CLI entrypoint for external agents.
- A configurable event log path for one run.
- A stable session/run id in stdout.
- Tests proving events are persisted and CLI args are passed correctly.

Out of scope:

- Task Mode.
- Memory.
- Full local-machine permission policy.
- TUI redesign.
- Project-wide `tsc --noEmit` import-extension cleanup.

## File Structure

- Modify `src/runtime/agentRuntime.ts`: export runtime option/provider types needed by `defaultRunner`.
- Modify `src/runtime/defaultRunner.ts`: add optional event-log and artifact settings to `runLocalTurn`.
- Create `src/cli/runOnce.ts`: parse CLI args, call `runLocalTurn`, print a JSON summary.
- Modify `package.json`: add `run:once` and `run:once:local` scripts.
- Modify `test/default-runner.test.ts`: cover event-log persistence through `runLocalTurn`.
- Create `test/run-once.test.ts`: cover argument parsing and injected runner behavior.

---

### Task 1: Export Runtime Types

**Files:**
- Modify: `src/runtime/agentRuntime.ts`

- [ ] **Step 1: Export the provider and runtime option types**

Change the local type declarations near the top of `src/runtime/agentRuntime.ts`:

```ts
export type ProviderMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
}

export type RuntimeProvider = (input: {
  messages: ProviderMessage[]
  toolNames: ReadOnlyToolName[]
}) => Promise<ProviderTextResult & { status?: RuntimeStatusPayload }>

type EventStore = {
  append(event: EventRecord): Promise<void>
  readAll(): Promise<EventRecord[]>
}

export type AgentRuntimeOptions = {
  sessionId?: string
  workspaceRoot?: string
  provider: RuntimeProvider
  eventStore?: EventStore
  artifactDir?: string
  contextWindowChars?: number
  contextPersistRatio?: number
  toolResultPersistBytes?: number
  tools?: Partial<Record<ReadOnlyToolName, ReadOnlyToolHandler>>
  now?: () => Date
  id?: () => string
}

export type AgentRuntime = {
  run(userText: string): Promise<EventRecord[]>
  readContext(): EventRecord[]
}
```

Keep the rest of the file unchanged in this task.

- [ ] **Step 2: Run the focused runtime tests**

Run:

```bash
npm test -- test/agent-runtime.test.ts
```

Expected: all tests in `test/agent-runtime.test.ts` pass.

---

### Task 2: Make `runLocalTurn` Persist Events When Requested

**Files:**
- Modify: `src/runtime/defaultRunner.ts`
- Modify: `test/default-runner.test.ts`

- [ ] **Step 1: Add a failing persistence test**

Append this test to `test/default-runner.test.ts`:

```ts
it('persists events to a caller-provided event log path', async () => {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = await mkdtemp(join(tmpdir(), 'accorda-run-local-turn-'))

  try {
    loadConfig.mockReturnValue({
      provider: {
        baseURL: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'gpt-4.1-mini',
      },
      workspaceRoot: dir,
    })
    createTextCompletion.mockResolvedValue({
      text: 'logged answer',
      model: 'gpt-4.1-mini',
    })

    const eventLogPath = join(dir, 'events.jsonl')
    const events = await runLocalTurn('session-log', 'hello', {
      eventLogPath,
      artifactDir: join(dir, 'artifacts'),
      workspaceRoot: dir,
    })

    const raw = await readFile(eventLogPath, 'utf8')
    const persisted = raw
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line))

    expect(persisted.map(event => event.type)).toEqual(
      events.map(event => event.type),
    )
    expect(persisted[0]).toMatchObject({
      sessionId: 'session-log',
      type: 'user_message',
      payload: { text: 'hello' },
    })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- test/default-runner.test.ts
```

Expected: fails because `runLocalTurn` only accepts two arguments and does not persist to `eventLogPath`.

- [ ] **Step 3: Implement run options in `defaultRunner`**

Update imports in `src/runtime/defaultRunner.ts`:

```ts
import { loadConfig } from '../core/config.js'
import type { EventRecord } from '../core/contracts.js'
import { createTextCompletion } from '../provider/openaiClient.js'
import { createEventLogStore } from '../store/eventLogStore.js'
import {
  createAgentRuntime,
  type RuntimeProvider,
} from './agentRuntime.js'
```

Add these types and helpers after `type LocalRuntime`:

```ts
export type RunLocalTurnOptions = {
  eventLogPath?: string
  artifactDir?: string
  workspaceRoot?: string
}

function createDefaultProvider(): RuntimeProvider {
  return async ({ messages }) => {
    try {
      const config = loadConfig()
      const answer = await createTextCompletion(
        config,
        messages.map(providerMessageForCompletion),
      )

      return {
        ...answer,
        status: {
          message: 'Provider answered successfully',
          level: 'info',
          stage: 'answering',
          reason: 'stage_one_direct_answer',
          source: 'provider',
        },
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown provider failure'

      return {
        text: 'Provider unavailable. Check configuration and try again.',
        status: {
          message,
          level: 'error',
          stage: 'error',
          reason: 'provider_or_config_error',
          source: message.startsWith('Missing CONTEXTA_')
            ? 'config'
            : 'provider',
        },
      }
    }
  }
}
```

Replace `getRuntime` with:

```ts
function createRuntime(sessionId: string, options: RunLocalTurnOptions = {}) {
  return createAgentRuntime({
    sessionId,
    workspaceRoot: options.workspaceRoot,
    artifactDir: options.artifactDir,
    eventStore: options.eventLogPath
      ? createEventLogStore(options.eventLogPath)
      : undefined,
    provider: createDefaultProvider(),
  })
}

function getRuntime(sessionId: string) {
  const existing = runtimes.get(sessionId)
  if (existing) return existing

  const runtime = createRuntime(sessionId)
  runtimes.set(sessionId, runtime)
  return runtime
}
```

Replace `runLocalTurn` with:

```ts
export async function runLocalTurn(
  sessionId: string,
  text: string,
  options: RunLocalTurnOptions = {},
): Promise<EventRecord[]> {
  if (options.eventLogPath || options.artifactDir || options.workspaceRoot) {
    return createRuntime(sessionId, options).run(text)
  }

  return getRuntime(sessionId).run(text)
}
```

Remove the old inline `provider` block from `getRuntime`; it now lives in `createDefaultProvider`.

- [ ] **Step 4: Run the focused tests**

Run:

```bash
npm test -- test/default-runner.test.ts test/agent-runtime.test.ts
```

Expected: both files pass.

---

### Task 3: Add the Run-Once CLI Module

**Files:**
- Create: `src/cli/runOnce.ts`
- Create: `test/run-once.test.ts`

- [ ] **Step 1: Add a failing CLI parser/runner test**

Create `test/run-once.test.ts`:

```ts
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseRunOnceArgs, runOnce } from '../src/cli/runOnce'

describe('run-once cli', () => {
  it('parses prompt and output paths', () => {
    const parsed = parseRunOnceArgs([
      '--session',
      'session-1',
      '--event-log',
      '/tmp/events.jsonl',
      '--artifact-dir',
      '/tmp/artifacts',
      'summarize this project',
    ])

    expect(parsed).toEqual({
      prompt: 'summarize this project',
      sessionId: 'session-1',
      eventLogPath: '/tmp/events.jsonl',
      artifactDir: '/tmp/artifacts',
    })
  })

  it('runs one prompt and prints a machine-readable summary', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'accorda-run-once-'))
    const writes: string[] = []

    try {
      const exitCode = await runOnce(
        [
          '--session',
          'session-1',
          '--event-log',
          join(dir, 'events.jsonl'),
          '--artifact-dir',
          join(dir, 'artifacts'),
          'hello',
        ],
        {
          runLocalTurn: async (sessionId, text, options) => [
            {
              id: 'evt-1',
              sessionId,
              timestamp: '2026-04-12T00:00:00.000Z',
              type: 'assistant_text',
              payload: { text, eventLogPath: options.eventLogPath },
            },
          ],
          stdout: value => writes.push(value),
          stderr: value => writes.push(`ERR:${value}`),
        },
      )

      expect(exitCode).toBe(0)
      expect(JSON.parse(writes[0])).toMatchObject({
        sessionId: 'session-1',
        eventLogPath: join(dir, 'events.jsonl'),
        eventCount: 1,
        finalText: 'hello',
      })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- test/run-once.test.ts
```

Expected: fails because `src/cli/runOnce.ts` does not exist.

- [ ] **Step 3: Implement `src/cli/runOnce.ts`**

Create `src/cli/runOnce.ts`:

```ts
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { cwd } from 'node:process'
import type { EventRecord } from '../core/contracts.js'
import {
  runLocalTurn,
  type RunLocalTurnOptions,
} from '../runtime/defaultRunner.js'

export type RunOnceArgs = {
  prompt: string
  sessionId: string
  eventLogPath: string
  artifactDir: string
}

type RunOnceDeps = {
  runLocalTurn?: (
    sessionId: string,
    text: string,
    options: RunLocalTurnOptions,
  ) => Promise<EventRecord[]>
  stdout?: (value: string) => void
  stderr?: (value: string) => void
  now?: () => Date
}

function defaultSessionId(now: Date) {
  return `run-${now.toISOString().replace(/[:.]/g, '-')}`
}

export function parseRunOnceArgs(
  args: string[],
  now: Date = new Date(),
): RunOnceArgs {
  let sessionId = ''
  let eventLogPath = ''
  let artifactDir = ''
  const promptParts: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--session') {
      sessionId = args[index + 1] ?? ''
      index += 1
      continue
    }

    if (arg === '--event-log') {
      eventLogPath = args[index + 1] ?? ''
      index += 1
      continue
    }

    if (arg === '--artifact-dir') {
      artifactDir = args[index + 1] ?? ''
      index += 1
      continue
    }

    promptParts.push(arg)
  }

  const resolvedSessionId = sessionId || defaultSessionId(now)
  const resolvedArtifactDir =
    artifactDir || join(cwd(), '.accorda', 'runs', resolvedSessionId, 'artifacts')

  return {
    prompt: promptParts.join(' ').trim(),
    sessionId: resolvedSessionId,
    eventLogPath:
      eventLogPath ||
      join(cwd(), '.accorda', 'runs', resolvedSessionId, 'events.jsonl'),
    artifactDir: resolvedArtifactDir,
  }
}

function finalTextFromEvents(events: EventRecord[]) {
  const final = [...events]
    .reverse()
    .find(event => event.type === 'assistant_text')
  return typeof final?.payload.text === 'string' ? final.payload.text : ''
}

export async function runOnce(
  args: string[] = process.argv.slice(2),
  deps: RunOnceDeps = {},
) {
  const stdout = deps.stdout ?? console.log
  const stderr = deps.stderr ?? console.error
  const parsed = parseRunOnceArgs(args, deps.now?.() ?? new Date())

  if (!parsed.prompt) {
    stderr('Usage: npm run run:once -- [--session id] [--event-log path] [--artifact-dir path] <prompt>')
    return 1
  }

  await mkdir(parsed.artifactDir, { recursive: true })
  const runner = deps.runLocalTurn ?? runLocalTurn
  const events = await runner(parsed.sessionId, parsed.prompt, {
    eventLogPath: parsed.eventLogPath,
    artifactDir: parsed.artifactDir,
    workspaceRoot: cwd(),
  })

  stdout(
    JSON.stringify({
      sessionId: parsed.sessionId,
      eventLogPath: parsed.eventLogPath,
      artifactDir: parsed.artifactDir,
      eventCount: events.length,
      finalText: finalTextFromEvents(events),
    }),
  )

  return 0
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runOnce().then(code => {
    process.exitCode = code
  })
}
```

- [ ] **Step 4: Run the focused CLI test**

Run:

```bash
npm test -- test/run-once.test.ts
```

Expected: passes.

---

### Task 4: Add Package Scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add scripts**

Modify the `scripts` block in `package.json`:

```json
"scripts": {
  "dev": "tsx src/index.tsx",
  "dev:local": "node --env-file=.env.local --import tsx src/index.tsx",
  "run:once": "tsx src/cli/runOnce.ts",
  "run:once:local": "node --env-file=.env.local --import tsx src/cli/runOnce.ts",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 2: Run script help path**

Run:

```bash
npm run run:once --
```

Expected: exits with code `1` and prints usage text because no prompt was provided.

- [ ] **Step 3: Run test suite**

Run:

```bash
npm test
```

Expected: all Vitest tests pass.

---

### Task 5: Document Verification Notes

**Files:**
- Modify: `AGENTS.md` only if command guidance becomes stale.
- Do not modify `BLUEPRINT.md` or `v1实现路线.md` in this task.

- [ ] **Step 1: Check whether `AGENTS.md` needs command updates**

Open `AGENTS.md` and inspect the command section. If `run:once` is now a primary contributor command, add these bullets:

```md
- `npm run run:once -- <prompt>`: execute one non-interactive task and print a JSON run summary.
- `npm run run:once:local -- <prompt>`: run the same path with `.env.local`.
```

If the command section is already too long, leave `AGENTS.md` unchanged and mention the command in the final handoff instead.

- [ ] **Step 2: Final verification**

Run:

```bash
npm test
```

Expected: all Vitest tests pass.

Run:

```bash
git status --short
```

Expected: changes are limited to the files in this plan plus existing pre-plan changes already in the worktree.

---

## Self-Review

- Spec coverage: covers Phase 1 run-once startup, event log output, run/session id, machine-readable summary, and tests.
- Deferred scope: Task Mode, memory, local-machine permission policy, and TUI redesign remain out of scope.
- Known project issue: `./node_modules/.bin/tsc --noEmit` currently fails across the existing project because many NodeNext imports lack explicit `.js` extensions. Do not fix that in this plan; create a separate import-extension cleanup plan if needed.
