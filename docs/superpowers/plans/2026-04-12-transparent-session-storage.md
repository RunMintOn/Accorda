# Transparent Session Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist each TUI and one-shot session as an inspectable event timeline with model-call artifacts.

**Architecture:** Add a session-scoped storage facade over the existing JSONL event log and artifact directories. Runtime remains the source of events; provider code records the exact API body it sends and the response body it receives. TUI and `/resume` keep using event-log projection, not a separate display store.

**Tech Stack:** TypeScript, Node fs/promises, Vitest, Ink TUI, OpenAI-compatible chat completions.

---

## File Structure

- Modify `src/core/contracts.ts` to add v1 trace event names and artifact metadata types.
- Create `src/store/sessionStore.ts` to own `.accorda/runs/<sessionId>/` paths, `session.json`, `events.jsonl`, and artifact writes.
- Modify `src/runtime/agentRuntime.ts` to emit runtime decision and model-call trace events.
- Modify `src/runtime/defaultRunner.ts` to pass session paths and trace recorder wiring into the default provider.
- Modify `src/provider/openaiClient.ts` to expose an API-body-based completion function.
- Modify `src/ui/App.tsx` so default TUI submissions write into `.accorda/runs/<sessionId>/events.jsonl`.
- Modify `src/commands/recentSessions.ts` only if session metadata needs to be read for sorting; otherwise keep the existing event-log reader.
- Add or update tests in `test/session-store.test.ts`, `test/agent-runtime.test.ts`, `test/default-runner.test.ts`, `test/interactive-app.test.tsx`, and `test/recent-sessions.test.ts`.

---

## Task 1: Session Store Paths And Metadata

**Files:**
- Create: `src/store/sessionStore.ts`
- Test: `test/session-store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSessionStore } from '../src/store/sessionStore'

describe('session store', () => {
  it('owns session paths, metadata, event log, and artifacts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'accorda-session-store-'))
    try {
      const store = createSessionStore({
        runsDir: join(root, '.accorda', 'runs'),
        sessionId: 'session-a',
        workspaceRoot: root,
        now: () => new Date('2026-04-12T00:00:00.000Z'),
      })

      await store.ensureSession()
      await store.appendEvent({
        id: 'evt-1',
        sessionId: 'session-a',
        timestamp: '2026-04-12T00:00:00.000Z',
        type: 'user_message',
        payload: { text: 'hello' },
      })
      const artifactPath = await store.writeModelCallArtifact(
        'call-1',
        'request',
        { body: { model: 'test-model', messages: [] } },
      )

      expect(store.paths.eventLogPath).toBe(
        join(root, '.accorda', 'runs', 'session-a', 'events.jsonl'),
      )
      expect(JSON.parse(await readFile(store.paths.sessionMetaPath, 'utf8'))).toMatchObject({
        schemaVersion: 1,
        sessionId: 'session-a',
        workspaceRoot: root,
        mode: 'normal',
      })
      expect(await readFile(store.paths.eventLogPath, 'utf8')).toContain('"type":"user_message"')
      expect(JSON.parse(await readFile(artifactPath, 'utf8'))).toMatchObject({
        body: { model: 'test-model', messages: [] },
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- session-store`

Expected: FAIL because `src/store/sessionStore.ts` does not exist.

- [ ] **Step 3: Implement the minimal store**

Implement `createSessionStore()` with:

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { EventRecord } from '../core/contracts'
import { createEventLogStore } from './eventLogStore'

export function createSessionStore(options: {
  runsDir: string
  sessionId: string
  workspaceRoot: string
  now?: () => Date
}) {
  const now = options.now ?? (() => new Date())
  const runDir = join(options.runsDir, options.sessionId)
  const paths = {
    runDir,
    sessionMetaPath: join(runDir, 'session.json'),
    eventLogPath: join(runDir, 'events.jsonl'),
    artifactsDir: join(runDir, 'artifacts'),
    modelCallsDir: join(runDir, 'artifacts', 'model-calls'),
    toolResultsDir: join(runDir, 'artifacts', 'tool-results'),
  }
  const events = createEventLogStore(paths.eventLogPath)

  return {
    paths,
    async ensureSession() {
      await mkdir(runDir, { recursive: true })
      try {
        await readFile(paths.sessionMetaPath, 'utf8')
        return
      } catch {
        const timestamp = now().toISOString()
        await writeFile(
          paths.sessionMetaPath,
          JSON.stringify(
            {
              schemaVersion: 1,
              sessionId: options.sessionId,
              createdAt: timestamp,
              updatedAt: timestamp,
              workspaceRoot: options.workspaceRoot,
              mode: 'normal',
            },
            null,
            2,
          ),
          'utf8',
        )
      }
    },
    async appendEvent(event: EventRecord) {
      await events.append(event)
    },
    async readEvents() {
      return events.readAll()
    },
    async writeModelCallArtifact(callId: string, kind: 'request' | 'response', value: unknown) {
      await mkdir(paths.modelCallsDir, { recursive: true })
      const artifactPath = join(paths.modelCallsDir, `${callId}.${kind}.json`)
      await writeFile(artifactPath, JSON.stringify(value, null, 2), 'utf8')
      return artifactPath
    },
  }
}
```

Keep atomic temp-file writes out of v1.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- session-store`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/store/sessionStore.ts test/session-store.test.ts
git commit -m "feat(storage): add session store"
```

---

## Task 2: Event Types And Runtime Decision Event

**Files:**
- Modify: `src/core/contracts.ts`
- Modify: `src/runtime/agentRuntime.ts`
- Test: `test/agent-runtime.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test to `test/agent-runtime.test.ts`:

```ts
it('emits a runtime_decision event for the stage one choice', async () => {
  const runtime = createAgentRuntime({
    controlDecision: async () => ({
      kind: 'answer',
      reason: 'stage_one_direct_answer',
    }),
    provider: async () => ({ text: 'direct answer' }),
  })

  const events = await runtime.run('hello')

  expect(events).toContainEqual(
    expect.objectContaining({
      type: 'runtime_decision',
      payload: expect.objectContaining({
        layer: 'stage_one',
        decision: 'answer',
        reason: 'stage_one_direct_answer',
      }),
    }),
  )
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- agent-runtime`

Expected: FAIL because `runtime_decision` is not an allowed `EventType` and is not emitted.

- [ ] **Step 3: Expand event types and emit the decision**

Update `src/core/contracts.ts`:

```ts
export type EventType =
  | 'session_started'
  | 'user_message'
  | 'runtime_decision'
  | 'model_call_started'
  | 'model_call_finished'
  | 'tool_call'
  | 'tool_result'
  | 'assistant_text'
  | 'runtime_error'
  | 'system_status'
```

In `src/runtime/agentRuntime.ts`, after `controlDecision` is known and before the existing `system_status`, append:

```ts
await append(
  events,
  createEvent('runtime_decision', {
    layer: 'stage_one',
    decision: controlDecision.kind,
    reason: controlDecision.reason ?? `stage_one_${controlDecision.kind}`,
    responsePolicyId: responsePolicyPayload.responsePolicyId,
    responsePolicyMode: responsePolicyPayload.responsePolicyMode,
    responseStyle: responsePolicyPayload.responseStyle,
  }),
)
```

Keep the existing `system_status` event for current TUI status compatibility.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- agent-runtime`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/core/contracts.ts src/runtime/agentRuntime.ts test/agent-runtime.test.ts
git commit -m "feat(runtime): record runtime decisions"
```

---

## Task 3: Model Call Artifacts And Trace Events

**Files:**
- Modify: `src/runtime/agentRuntime.ts`
- Modify: `src/runtime/defaultRunner.ts`
- Modify: `src/provider/openaiClient.ts`
- Test: `test/agent-runtime.test.ts`
- Test: `test/default-runner.test.ts`

- [ ] **Step 1: Write the failing runtime trace test**

Add to `test/agent-runtime.test.ts`:

```ts
it('emits model call started and finished events around provider calls', async () => {
  const runtime = createAgentRuntime({
    id: (() => {
      const ids = ['evt-user', 'evt-decision', 'evt-status', 'call-1', 'evt-started', 'evt-finished', 'evt-provider', 'evt-answer']
      return () => ids.shift() ?? 'evt-extra'
    })(),
    provider: async ({ callId, messages, toolNames, recordModelRequest, recordModelResponse }) => {
      const requestArtifact = await recordModelRequest({
        body: { model: 'test-model', messages, toolNames },
      })
      const responseArtifact = await recordModelResponse({
        body: { text: 'hello back' },
      })
      return {
        text: 'hello back',
        model: 'test-model',
        trace: { callId, requestArtifact, responseArtifact },
      }
    },
  })

  const events = await runtime.run('hello')

  expect(events).toContainEqual(
    expect.objectContaining({
      type: 'model_call_started',
      payload: expect.objectContaining({
        callId: 'call-1',
        requestArtifact: expect.any(String),
        messageCount: expect.any(Number),
      }),
    }),
  )
  expect(events).toContainEqual(
    expect.objectContaining({
      type: 'model_call_finished',
      payload: expect.objectContaining({
        callId: 'call-1',
        ok: true,
        responseArtifact: expect.any(String),
      }),
    }),
  )
})
```

- [ ] **Step 2: Run the runtime test to verify it fails**

Run: `npm test -- agent-runtime`

Expected: FAIL because provider input has no `callId`, `recordModelRequest`, or `recordModelResponse`.

- [ ] **Step 3: Extend the provider boundary**

In `src/runtime/agentRuntime.ts`, extend `RuntimeProvider` input:

```ts
export type RuntimeProvider = (input: {
  callId: string
  messages: ProviderMessage[]
  toolNames: ReadOnlyToolName[]
  recordModelRequest(value: unknown): Promise<string>
  recordModelResponse(value: unknown): Promise<string>
}) => Promise<ProviderTextResult & {
  status?: RuntimeStatusPayload
  trace?: {
    callId: string
    requestArtifact?: string
    responseArtifact?: string
  }
}>
```

Add local helpers in `createAgentRuntime()`:

```ts
async function writeModelCallArtifact(
  callId: string,
  kind: 'request' | 'response',
  value: unknown,
) {
  const artifactPath = join(artifactDir, 'model-calls', `${callId}.${kind}.json`)
  await mkdir(join(artifactDir, 'model-calls'), { recursive: true })
  await writeFile(artifactPath, JSON.stringify(value, null, 2), 'utf8')
  return artifactPath
}
```

Before calling provider:

```ts
const callId = id()
const messages = providerMessages(responsePolicy)
const result = await options.provider({
  callId,
  messages,
  toolNames: READ_ONLY_TOOL_NAMES,
  recordModelRequest: value => writeModelCallArtifact(callId, 'request', value),
  recordModelResponse: value => writeModelCallArtifact(callId, 'response', value),
})
```

Append `model_call_started` after the request recorder returns. Append `model_call_finished` after provider returns. If the provider returns no artifact paths, still emit the events with `callId`, `messageCount`, and `toolNames`.

- [ ] **Step 4: Write the default provider artifact test**

Add to `test/default-runner.test.ts`:

```ts
it('persists the exact API body and provider response as model call artifacts', async () => {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = await mkdtemp(join(tmpdir(), 'accorda-model-call-'))

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
      raw: { id: 'completion-1' },
    })

    const events = await runLocalTurn('session-log', 'hello', {
      eventLogPath: join(dir, 'events.jsonl'),
      artifactDir: join(dir, 'artifacts'),
      workspaceRoot: dir,
    })

    const started = events.find(event => event.type === 'model_call_started')
    const finished = events.find(event => event.type === 'model_call_finished')
    const request = JSON.parse(await readFile(String(started?.payload.requestArtifact), 'utf8'))
    const response = JSON.parse(await readFile(String(finished?.payload.responseArtifact), 'utf8'))

    expect(request.body).toMatchObject({
      model: 'gpt-4.1-mini',
      messages: expect.any(Array),
    })
    expect(request.body).not.toHaveProperty('apiKey')
    expect(response.body).toMatchObject({
      text: 'logged answer',
      raw: { id: 'completion-1' },
    })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
```

- [ ] **Step 5: Refactor the provider client around API body**

In `src/provider/openaiClient.ts`, introduce:

```ts
export type ChatCompletionBody = {
  model: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
}

export async function createTextCompletionFromBody(
  config: AppConfig,
  body: ChatCompletionBody,
): Promise<ProviderTextResult> {
  const client = createOpenAICompatibleClient(config)
  const completion = await client.chat.completions.create(body)
  // keep existing result mapping
}
```

Keep `createTextCompletion(config, messages)` as a wrapper that builds `body` and calls `createTextCompletionFromBody()` so existing tests remain compatible.

In `src/runtime/defaultRunner.ts`, build the exact body once:

```ts
const body = {
  model: config.provider.model,
  messages: messages.map(providerMessageForCompletion),
}
const requestArtifact = await recordModelRequest({
  schemaVersion: 1,
  callId,
  timestamp: new Date().toISOString(),
  body,
})
const answer = await createTextCompletionFromBody(config, body)
const responseArtifact = await recordModelResponse({
  schemaVersion: 1,
  callId,
  timestamp: new Date().toISOString(),
  body: answer,
})
```

Return `trace: { callId, requestArtifact, responseArtifact }`.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- agent-runtime default-runner`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/runtime/agentRuntime.ts src/runtime/defaultRunner.ts src/provider/openaiClient.ts test/agent-runtime.test.ts test/default-runner.test.ts
git commit -m "feat(runtime): trace model call artifacts"
```

---

## Task 4: TUI Default Session Persistence

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/cli/bootstrap.ts`
- Test: `test/interactive-app.test.tsx`
- Test: `test/cli-bootstrap.test.ts`

- [ ] **Step 1: Write the failing TUI persistence test**

Add to `test/interactive-app.test.tsx`:

```ts
it('passes session-scoped storage options to the default submit path', async () => {
  const submissions: Array<{
    text: string
    sessionId: string
    eventLogPath?: string
    artifactDir?: string
    workspaceRoot?: string
  }> = []
  const { stdin } = render(
    <App
      initialSessionId="session-ui"
      onSubmit={async (text, sessionId, options) => {
        submissions.push({
          text,
          sessionId,
          eventLogPath: options.eventLogPath,
          artifactDir: options.artifactDir,
          workspaceRoot: options.workspaceRoot,
        })
        return []
      }}
    />,
  )

  await new Promise(resolve => setTimeout(resolve, 0))
  stdin.write('hello')
  await new Promise(resolve => setTimeout(resolve, 0))
  stdin.write('\r')
  await new Promise(resolve => setTimeout(resolve, 50))

  expect(submissions).toEqual([
    expect.objectContaining({
      text: 'hello',
      sessionId: 'session-ui',
      eventLogPath: expect.stringContaining('.accorda/runs/session-ui/events.jsonl'),
      artifactDir: expect.stringContaining('.accorda/runs/session-ui/artifacts'),
      workspaceRoot: expect.any(String),
    }),
  ])
})
```

- [ ] **Step 2: Add path-aware submit options**

Update `App`'s submit prop:

```ts
onSubmit?: (
  text: string,
  sessionId: string,
  options: RunLocalTurnOptions,
) => Promise<EventRecord[]>
```

Default submit should call:

```ts
return runLocalTurn(sessionId, text, options)
```

Compute options from the current session:

```ts
function runOptions(sessionId: string): RunLocalTurnOptions {
  return {
    eventLogPath: join(runsDir(), sessionId, 'events.jsonl'),
    artifactDir: join(runsDir(), sessionId, 'artifacts'),
    workspaceRoot: cwd(),
  }
}
```

In `handleSubmit`, call:

```ts
const nextEvents = await onSubmit(text, sessionIdRef.current, runOptions(sessionIdRef.current))
```

- [ ] **Step 3: Make new sessions unique from CLI start**

In `src/cli/bootstrap.ts`, add a local session id helper:

```ts
function createSessionId(now: Date = new Date()) {
  return `session-${now.toISOString().replace(/[:.]/g, '-')}`
}
```

When rendering a fresh app, pass:

```ts
renderApp({ initialSessionId: createSessionId() })
```

Keep `--resume` using the selected `initialSessionId`.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- interactive-app cli-bootstrap`

Expected: PASS after updating tests for the new `renderApp` props.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/ui/App.tsx src/cli/bootstrap.ts test/interactive-app.test.tsx test/cli-bootstrap.test.ts
git commit -m "feat(ui): persist tui sessions by default"
```

---

## Task 5: Resume And Event Projection Compatibility

**Files:**
- Modify: `src/ui/events/projectRenderableItems.ts`
- Modify: `src/commands/recentSessions.ts`
- Test: `test/ui-event-projection.test.ts`
- Test: `test/recent-sessions.test.ts`

- [ ] **Step 1: Write projection tests for trace events**

Add to `test/ui-event-projection.test.ts`:

```ts
it('keeps model call trace events visible but compact', () => {
  const events: EventRecord[] = [
    {
      id: 'evt-start',
      sessionId: 'session-1',
      timestamp: '2026-04-12T00:00:00.000Z',
      type: 'model_call_started',
      payload: {
        callId: 'call-1',
        layer: 'stage_one',
        messageCount: 2,
        toolNames: ['answer', 'execute'],
        requestArtifact: 'artifacts/model-calls/call-1.request.json',
      },
    },
  ]

  expect(projectEventsToRenderableItems(events)).toContainEqual(
    expect.objectContaining({
      kind: 'system_status',
      message: expect.stringContaining('model call'),
    }),
  )
})
```

- [ ] **Step 2: Run the projection test to verify it fails**

Run: `npm test -- ui-event-projection`

Expected: FAIL because the projection does not yet handle `model_call_started`.

- [ ] **Step 3: Add compact projection behavior**

Update `src/ui/events/projectRenderableItems.ts` so:

- `runtime_decision` projects as a compact status row.
- `model_call_started` projects as a compact status row.
- `model_call_finished` projects as a compact status row.
- unknown trace events never crash projection.

The message content should be short, for example:

```text
model call stage_one: 2 messages · tools answer, execute
```

- [ ] **Step 4: Ensure recent sessions remain based on user messages**

Add a test to `test/recent-sessions.test.ts` with trace events before and after a `user_message`, and assert preview still uses the last `user_message`.

Run: `npm test -- recent-sessions ui-event-projection`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/ui/events/projectRenderableItems.ts src/commands/recentSessions.ts test/ui-event-projection.test.ts test/recent-sessions.test.ts
git commit -m "feat(ui): project session trace events"
```

---

## Task 6: End-To-End Verification

**Files:**
- No production edits expected unless verification reveals a defect.

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 2: Run one-shot persistence smoke**

Run:

```bash
npm run run:once -- --session trace-smoke "用一句话回复：trace smoke"
```

Expected:

- command exits successfully even if provider config is missing
- stdout includes `.accorda/runs/trace-smoke/events.jsonl`
- event log exists
- model-call artifact files exist when provider boundary is reached

- [ ] **Step 3: Run TUI persistence smoke**

Run:

```bash
npm run dev
```

In the TUI, send `你好`, then exit with `ctrl+c`.

Expected:

- a new `.accorda/runs/session-*/events.jsonl` exists
- the log includes `user_message`
- the log includes model-call trace events or a `runtime_error` if config fails before provider request body exists
- the input line still displays text inside the input box

- [ ] **Step 4: Commit any verification fixes**

If verification required edits, commit them with a focused message.

If no edits were required, do not create an empty commit.
