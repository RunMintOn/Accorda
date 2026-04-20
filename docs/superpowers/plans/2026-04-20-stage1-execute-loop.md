# Stage1 Execute Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working `answer / execute` runtime loop, with persistent `execute` state, `ask_user` / `finish` control tools, and permission continuation for `write` / `edit` / `bash`.

**Architecture:** Keep `stage1` cheap and deterministic for this phase: it only decides `answer` or `execute`. Route the `execute` path into a native tool-calling loop with a single explicit tool action per model round; persist only the minimal pending state (`waiting_user` or `waiting_permission`) into `session.json`, and reconstruct the rest from the event log.

**Tech Stack:** TypeScript, Ink, Vitest, Zod, OpenAI-compatible chat completions with tool-calls

---

## File Structure

**Modify:**
- `src/core/contracts.ts`
- `src/runtime/controlDecision.ts`
- `src/runtime/stageOne.ts`
- `src/runtime/engine.ts`
- `src/runtime/agentRuntime.ts`
- `src/runtime/defaultRunner.ts`
- `src/tools/types.ts`
- `src/tools/registry.ts`
- `src/tools/readOnly.ts`
- `src/provider/openaiClient.ts`
- `src/store/sessionStore.ts`
- `src/ui/App.tsx`
- `src/ui/components/PermissionDialog.tsx`
- `src/ui/events/projectEvents.ts`
- `src/ui/messages/toolProjection.ts`
- `src/prompt/compiler.ts`
- `test/control-decision.test.ts`
- `test/runtime-engine.test.ts`
- `test/prompt-compiler.test.ts`
- `test/tool-registry.test.ts`
- `test/permissions.test.ts`
- `test/agent-runtime.test.ts`
- `test/default-runner.test.ts`
- `test/session-store.test.ts`
- `test/ui-event-projection.test.ts`
- `test/interactive-app.test.tsx`

**Create:**
- `src/tools/workspacePaths.ts`
- `src/tools/executeCatalog.ts`
- `test/execute-catalog.test.ts`

## Task 1: Collapse Stage1 To `answer / execute`

**Files:**
- Modify: `src/core/contracts.ts`
- Modify: `src/runtime/controlDecision.ts`
- Modify: `src/runtime/stageOne.ts`
- Modify: `src/runtime/engine.ts`
- Modify: `src/tools/types.ts`
- Modify: `src/tools/registry.ts`
- Modify: `src/prompt/compiler.ts`
- Test: `test/control-decision.test.ts`
- Test: `test/runtime-engine.test.ts`
- Test: `test/prompt-compiler.test.ts`
- Test: `test/tool-registry.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// test/control-decision.test.ts
import { describe, expect, it } from 'vitest'
import {
  controlDecisionStatus,
  defaultControlDecision,
} from '../src/runtime/controlDecision'

describe('control decision', () => {
  it('routes explicit tool requests to execute', async () => {
    await expect(
      defaultControlDecision({
        sessionId: 's-1',
        userText: 'read package.json',
      }),
    ).resolves.toEqual({
      kind: 'execute',
      reason: 'stage_one_execute_explicit_request',
    })
  })

  it('routes ordinary explanatory input to answer', async () => {
    await expect(
      defaultControlDecision({
        sessionId: 's-1',
        userText: 'explain this repo briefly',
      }),
    ).resolves.toEqual({
      kind: 'answer',
      reason: 'stage_one_direct_answer',
    })
  })

  it('creates routing status payloads for execute', () => {
    expect(
      controlDecisionStatus({
        kind: 'execute',
        reason: 'stage_one_execute_explicit_request',
      }),
    ).toEqual({
      message: 'Stage one selected execute',
      level: 'info',
      stage: 'routing',
      reason: 'stage_one_execute_explicit_request',
      source: 'stage_one',
    })
  })
})
```

```ts
// test/prompt-compiler.test.ts
import { describe, expect, it } from 'vitest'
import { compileStageOneInput } from '../src/prompt/compiler'

describe('prompt compiler', () => {
  it('projects event log into stage-one API messages', () => {
    const compiled = compileStageOneInput([
      {
        id: 'evt-1',
        sessionId: 's-1',
        timestamp: '2026-04-10T00:00:00.000Z',
        type: 'user_message',
        payload: { text: '帮我看看这个项目怎么启动' },
      },
    ])

    expect(compiled.messages).toEqual([
      { role: 'user', content: '帮我看看这个项目怎么启动' },
    ])
    expect(compiled.toolNames).toEqual(['answer', 'execute'])
  })
})
```

```ts
// test/runtime-engine.test.ts
import { describe, expect, it } from 'vitest'
import { createRuntimeEngine } from '../src/runtime/engine'

describe('runtime engine', () => {
  it('enters stage two after execute and returns explicit executing state', async () => {
    const engine = createRuntimeEngine({
      runStageOne: async () => ({
        kind: 'execute',
        reason: 'stage_one_execute',
      }),
      runStageTwo: async () => ({
        events: [
          { type: 'tool_call', payload: { name: 'read' } },
          { type: 'tool_result', payload: { ok: true } },
        ],
        finalText: 'done',
        reason: 'entered_execution_layer',
      }),
    })

    const result = await engine.runTurn('session-1', 'read package.json')
    expect(result.returnedToStageOne).toBe(true)
    expect(result.state.stage).toBe('executing')
    expect(result.state.reason).toBe('entered_execution_layer')
    expect(result.finalText).toBe('done')
  })

  it('returns explicit answering state for direct answers', async () => {
    const engine = createRuntimeEngine({
      runStageOne: async () => ({
        kind: 'answer',
        text: 'direct answer',
        reason: 'stage_one_direct_answer',
      }),
      runStageTwo: async () => ({ events: [] }),
    })

    const result = await engine.runTurn('session-1', 'hello')
    expect(result.returnedToStageOne).toBe(false)
    expect(result.state.stage).toBe('answering')
    expect(result.state.reason).toBe('stage_one_direct_answer')
    expect(result.finalText).toBe('direct answer')
  })
})
```

```ts
// test/tool-registry.test.ts
import { describe, expect, it } from 'vitest'
import { STAGE_ONE_TOOLS, STAGE_TWO_TOOLS } from '../src/tools/registry'

describe('tool registry', () => {
  it('exposes only answer and execute in stage one', () => {
    expect(STAGE_ONE_TOOLS.map(tool => tool.name)).toEqual([
      'answer',
      'execute',
    ])
  })

  it('reserves ask_user and finish for execute mode', () => {
    expect(STAGE_TWO_TOOLS.map(tool => tool.name)).toContain('ask_user')
    expect(STAGE_TWO_TOOLS.map(tool => tool.name)).toContain('finish')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run test/control-decision.test.ts test/runtime-engine.test.ts test/prompt-compiler.test.ts test/tool-registry.test.ts
```

Expected: FAIL because `clarify` / `task_mode` are still present in contracts and registries, and `ask_user` / `finish` do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/core/contracts.ts
export type RuntimeStage =
  | 'idle'
  | 'routing'
  | 'answering'
  | 'executing'
  | 'waiting_user'
  | 'waiting_permission'
  | 'error'
```

```ts
// src/runtime/controlDecision.ts
import type { RuntimeStatusPayload } from '../core/contracts.js'

export type ControlDecision =
  | {
      kind: 'answer'
      reason?: string
    }
  | {
      kind: 'execute'
      reason?: string
    }

const EXECUTE_PREFIX = /^(read|ls|glob|grep|write|edit|bash)\b/i
const EXECUTE_HINT =
  /(帮我|看看|检查|检索|修复|修改|更新|创建|运行|搜索|inspect|check|fix|update|create|run|search)/i

export async function defaultControlDecision(input: {
  sessionId: string
  userText: string
}): Promise<ControlDecision> {
  if (EXECUTE_PREFIX.test(input.userText.trim()) || EXECUTE_HINT.test(input.userText)) {
    return {
      kind: 'execute',
      reason: 'stage_one_execute_explicit_request',
    }
  }

  return {
    kind: 'answer',
    reason: 'stage_one_direct_answer',
  }
}

export function controlDecisionStatus(
  decision: ControlDecision,
): RuntimeStatusPayload {
  return {
    message: `Stage one selected ${decision.kind}`,
    level: 'info',
    stage: 'routing',
    reason: decision.reason ?? `stage_one_${decision.kind}`,
    source: 'stage_one',
  }
}
```

```ts
// src/tools/types.ts
export type ToolName =
  | 'answer'
  | 'execute'
  | 'ls'
  | 'read'
  | 'write'
  | 'edit'
  | 'glob'
  | 'grep'
  | 'bash'
  | 'ask_user'
  | 'finish'
```

```ts
// src/tools/registry.ts
export const STAGE_ONE_TOOLS: ToolDefinition[] = [
  {
    name: 'answer',
    description: 'Answer directly without entering the execution layer',
    requiresConfirmation: false,
  },
  {
    name: 'execute',
    description: 'Enter the execution layer for an actionable request',
    requiresConfirmation: false,
  },
]

export const STAGE_TWO_TOOLS: ToolDefinition[] = [
  { name: 'ls', description: 'List files in a directory', requiresConfirmation: false },
  { name: 'read', description: 'Read a file from the workspace', requiresConfirmation: false },
  { name: 'write', description: 'Create or overwrite a file', requiresConfirmation: true },
  { name: 'edit', description: 'Edit a file in place', requiresConfirmation: true },
  { name: 'glob', description: 'Find files by pattern', requiresConfirmation: false },
  { name: 'grep', description: 'Search file contents by pattern', requiresConfirmation: false },
  { name: 'bash', description: 'Run a shell command', requiresConfirmation: true },
  { name: 'ask_user', description: 'Ask the user for more information and pause execute mode', requiresConfirmation: false },
  { name: 'finish', description: 'Finish execute mode and return the final answer', requiresConfirmation: false },
]
```

```ts
// src/prompt/compiler.ts
export function compileStageOneInput(events: EventRecord[]) {
  return {
    messages: events.map(projectEventToMessage).filter(Boolean),
    toolNames: STAGE_ONE_TOOLS.map(tool => tool.name),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run test/control-decision.test.ts test/runtime-engine.test.ts test/prompt-compiler.test.ts test/tool-registry.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/contracts.ts src/runtime/controlDecision.ts src/runtime/stageOne.ts src/runtime/engine.ts src/tools/types.ts src/tools/registry.ts src/prompt/compiler.ts test/control-decision.test.ts test/runtime-engine.test.ts test/prompt-compiler.test.ts test/tool-registry.test.ts
git commit -m "refactor: collapse stage one to answer and execute"
```

## Task 2: Build The Execute Tool Catalog

**Files:**
- Create: `src/tools/workspacePaths.ts`
- Create: `src/tools/executeCatalog.ts`
- Modify: `src/tools/readOnly.ts`
- Modify: `src/permissions/policy.ts`
- Test: `test/execute-catalog.test.ts`
- Test: `test/permissions.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// test/execute-catalog.test.ts
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createExecuteToolCatalog } from '../src/tools/executeCatalog'

let root = ''

afterEach(async () => {
  if (root) {
    await rm(root, { recursive: true, force: true })
    root = ''
  }
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
```

```ts
// test/permissions.test.ts
import { describe, expect, it } from 'vitest'
import { getDefaultPermissionMode } from '../src/permissions/policy'

describe('default permission policy', () => {
  it('auto-allows read-only and control tools, confirms write and exec tools', () => {
    expect(getDefaultPermissionMode('read')).toBe('allow')
    expect(getDefaultPermissionMode('glob')).toBe('allow')
    expect(getDefaultPermissionMode('ask_user')).toBe('allow')
    expect(getDefaultPermissionMode('finish')).toBe('allow')
    expect(getDefaultPermissionMode('write')).toBe('confirm')
    expect(getDefaultPermissionMode('edit')).toBe('confirm')
    expect(getDefaultPermissionMode('bash')).toBe('confirm')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run test/execute-catalog.test.ts test/permissions.test.ts
```

Expected: FAIL because the execute catalog file does not exist and the permission policy does not know about control tools.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/tools/workspacePaths.ts
import { relative, resolve } from 'node:path'

export function isInside(root: string, target: string) {
  const normalizedRoot = resolve(root)
  const normalizedTarget = resolve(target)
  const pathFromRoot = relative(normalizedRoot, normalizedTarget)

  return (
    pathFromRoot === '' ||
    (!pathFromRoot.startsWith('..') && pathFromRoot !== '..')
  )
}

export function safeResolveWorkspacePath(workspaceRoot: string, value: unknown) {
  const requested = typeof value === 'string' && value.trim() ? value.trim() : '.'
  const resolved = resolve(workspaceRoot, requested)

  if (!isInside(workspaceRoot, resolved)) {
    throw new Error(`Path escapes workspace: ${requested}`)
  }

  return resolved
}
```

```ts
// src/tools/executeCatalog.ts
import { execFile } from 'node:child_process'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { z } from 'zod'
import { createReadOnlyTools } from './readOnly'
import { safeResolveWorkspacePath } from './workspacePaths'

const execFileAsync = promisify(execFile)

const writeInput = z.object({
  path: z.string().min(1),
  content: z.string(),
})

const editInput = z.object({
  path: z.string().min(1),
  oldText: z.string().min(1),
  newText: z.string(),
})

const bashInput = z.object({
  command: z.string().min(1),
})

export function createExecuteToolCatalog(workspaceRoot: string) {
  const readOnly = createReadOnlyTools(workspaceRoot)

  return {
    definitions: [
      {
        name: 'ls',
        description: 'List files in a directory',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: [],
          additionalProperties: false,
        },
        requiresConfirmation: false,
      },
      {
        name: 'read',
        description: 'Read a file from the workspace',
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
          additionalProperties: false,
        },
        requiresConfirmation: false,
      },
      {
        name: 'glob',
        description: 'Find files by pattern',
        parameters: {
          type: 'object',
          properties: { pattern: { type: 'string' } },
          required: ['pattern'],
          additionalProperties: false,
        },
        requiresConfirmation: false,
      },
      {
        name: 'grep',
        description: 'Search file contents by pattern',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'string' },
            path: { type: 'string' },
          },
          required: ['pattern'],
          additionalProperties: false,
        },
        requiresConfirmation: false,
      },
      {
        name: 'write',
        description: 'Create or overwrite a file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
          },
          required: ['path', 'content'],
          additionalProperties: false,
        },
        requiresConfirmation: true,
      },
      {
        name: 'edit',
        description: 'Replace oldText with newText in a file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            oldText: { type: 'string' },
            newText: { type: 'string' },
          },
          required: ['path', 'oldText', 'newText'],
          additionalProperties: false,
        },
        requiresConfirmation: true,
      },
      {
        name: 'bash',
        description: 'Run a shell command inside the workspace root',
        parameters: {
          type: 'object',
          properties: { command: { type: 'string' } },
          required: ['command'],
          additionalProperties: false,
        },
        requiresConfirmation: true,
      },
      {
        name: 'ask_user',
        description: 'Ask the user a question and pause execute mode',
        parameters: {
          type: 'object',
          properties: { question: { type: 'string' } },
          required: ['question'],
          additionalProperties: false,
        },
        requiresConfirmation: false,
      },
      {
        name: 'finish',
        description: 'Finish execute mode and return the final answer',
        parameters: {
          type: 'object',
          properties: { message: { type: 'string' } },
          required: ['message'],
          additionalProperties: false,
        },
        requiresConfirmation: false,
      },
    ],
    handlers: {
      ...readOnly,
      async write(input: unknown) {
        const parsed = writeInput.parse(input)
        const path = safeResolveWorkspacePath(workspaceRoot, parsed.path)
        await writeFile(path, parsed.content, 'utf8')
        return { ok: true, path: parsed.path }
      },
      async edit(input: unknown) {
        const parsed = editInput.parse(input)
        const path = safeResolveWorkspacePath(workspaceRoot, parsed.path)
        const raw = await readFile(path, 'utf8')
        if (!raw.includes(parsed.oldText)) {
          throw new Error(`edit could not find oldText in ${parsed.path}`)
        }
        await writeFile(path, raw.replace(parsed.oldText, parsed.newText), 'utf8')
        return { ok: true, path: parsed.path }
      },
      async bash(input: unknown) {
        const parsed = bashInput.parse(input)
        const result = await execFileAsync('bash', ['-lc', parsed.command], {
          cwd: workspaceRoot,
          timeout: 15_000,
          maxBuffer: 200_000,
        })
        return {
          stdout: result.stdout.trim(),
          stderr: result.stderr.trim(),
          exitCode: 0,
        }
      },
    },
  }
}
```

```ts
// src/permissions/policy.ts
const ALWAYS_ALLOW = new Set(['ls', 'read', 'glob', 'grep', 'ask_user', 'finish'])
const REQUIRE_CONFIRM = new Set(['write', 'edit', 'bash'])
```

```ts
// src/tools/readOnly.ts
import { safeResolveWorkspacePath } from './workspacePaths'
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run test/execute-catalog.test.ts test/permissions.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/tools/workspacePaths.ts src/tools/executeCatalog.ts src/tools/readOnly.ts src/permissions/policy.ts test/execute-catalog.test.ts test/permissions.test.ts
git commit -m "feat: add execute tool catalog"
```

## Task 3: Add Provider Tool-Call Plumbing For Execute

**Files:**
- Modify: `src/provider/openaiClient.ts`
- Modify: `src/runtime/agentRuntime.ts`
- Test: `test/agent-runtime.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// test/agent-runtime.test.ts
it('passes execute tools and requires a tool call while in execute mode', async () => {
  const requests: unknown[] = []
  const runtime = createAgentRuntime({
    controlDecision: async () => ({
      kind: 'execute',
      reason: 'stage_one_execute_explicit_request',
    }),
    provider: async ({ recordModelRequest }) => {
      await recordModelRequest({
        body: {
          model: 'test-model',
          tools: [{ type: 'function', function: { name: 'finish' } }],
          tool_choice: 'required',
        },
      })
      return {
        text: '',
        toolCalls: [
          {
            id: 'tool-1',
            type: 'function',
            function: {
              name: 'finish',
              arguments: JSON.stringify({ message: 'done' }),
            },
          },
        ],
      }
    },
    id: (() => {
      let count = 0
      return () => `evt-${++count}`
    })(),
  })

  const events = await runtime.run('inspect package.json')
  expect(events.some(event => event.type === 'tool_call')).toBe(true)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run test/agent-runtime.test.ts
```

Expected: FAIL because execute mode does not yet send tool definitions or process tool calls.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/provider/openaiClient.ts
export type ChatToolDefinition = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export type ChatCompletionBody = {
  model: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  tools?: ChatToolDefinition[]
  tool_choice?: 'auto' | 'required'
}
```

```ts
// src/runtime/agentRuntime.ts
export type RuntimeProvider = (input: {
  callId: string
  messages: ProviderMessage[]
  toolNames: string[]
  tools?: Array<{
    type: 'function'
    function: {
      name: string
      description: string
      parameters: Record<string, unknown>
    }
  }>
  toolChoice?: 'auto' | 'required'
  recordModelRequest(value: unknown): Promise<string>
  recordModelResponse(value: unknown): Promise<string>
}) => Promise<ProviderTextResult & { status?: RuntimeStatusPayload }>
```

```ts
// src/runtime/agentRuntime.ts
const executeCatalog = createExecuteToolCatalog(workspaceRoot)

const result = await options.provider({
  callId,
  messages,
  toolNames: executeCatalog.definitions.map(tool => tool.name),
  tools: executeCatalog.definitions.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  })),
  toolChoice: 'required',
  recordModelRequest: async value => {
    const requestArtifact = await writeModelCallArtifact(callId, 'request', value)
    await append(
      events,
      createEvent('model_call_started', {
        callId,
        layer: 'stage_two',
        requestArtifact,
        messageCount: messages.length,
        toolNames: executeCatalog.definitions.map(tool => tool.name),
      }),
    )
    return requestArtifact
  },
  recordModelResponse: async value => {
    const responseArtifact = await writeModelCallArtifact(callId, 'response', value)
    await append(
      events,
      createEvent('model_call_finished', {
        callId,
        ok: true,
        responseArtifact,
      }),
    )
    return responseArtifact
  },
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run test/agent-runtime.test.ts
```

Expected: PASS for existing coverage plus the new execute tool-call test.

- [ ] **Step 5: Commit**

```bash
git add src/provider/openaiClient.ts src/runtime/agentRuntime.ts test/agent-runtime.test.ts
git commit -m "feat: plumb execute tool calls through provider"
```

## Task 4: Persist Pending Execute State And Resume The Same Loop

**Files:**
- Modify: `src/core/contracts.ts`
- Modify: `src/store/sessionStore.ts`
- Modify: `src/runtime/defaultRunner.ts`
- Modify: `src/runtime/agentRuntime.ts`
- Test: `test/session-store.test.ts`
- Test: `test/default-runner.test.ts`
- Test: `test/agent-runtime.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// test/session-store.test.ts
it('persists pending execute state in session metadata', async () => {
  const root = await mkdtemp(join(tmpdir(), 'accorda-session-store-'))
  try {
    const store = createSessionStore({
      runsDir: join(root, '.accorda', 'runs'),
      sessionId: 'session-a',
      workspaceRoot: root,
      now: () => new Date('2026-04-12T00:00:00.000Z'),
    })

    await store.ensureSession()
    await store.savePendingExecute({
      status: 'waiting_user',
    })

    expect(await store.readPendingExecute()).toEqual({
      status: 'waiting_user',
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
```

```ts
// test/default-runner.test.ts
it('resumes a pending ask_user execute loop on the next user message', async () => {
  loadConfig.mockReturnValue({
    provider: {
      baseURL: 'https://example.com/v1',
      apiKey: 'test-key',
      model: 'gpt-4.1-mini',
    },
    workspaceRoot: '/tmp/workspace',
  })

  createTextCompletionFromBody
    .mockResolvedValueOnce({
      text: '',
      toolCalls: [
        {
          id: 'tool-1',
          type: 'function',
          function: {
            name: 'ask_user',
            arguments: JSON.stringify({ question: 'Which file should I inspect?' }),
          },
        },
      ],
    })
    .mockResolvedValueOnce({
      text: '',
      toolCalls: [
        {
          id: 'tool-2',
          type: 'function',
          function: {
            name: 'finish',
            arguments: JSON.stringify({ message: 'Inspect src/index.tsx first.' }),
          },
        },
      ],
    })

  const dir = await mkdtemp(join(tmpdir(), 'accorda-run-'))
  const options = {
    eventLogPath: join(dir, 'events.jsonl'),
    artifactDir: join(dir, 'artifacts'),
    workspaceRoot: dir,
  }

  const first = await runLocalTurn('session-loop', 'help me inspect this repo', options)
  expect(first.some(event => event.payload.reason === 'execute_waiting_user')).toBe(true)

  const second = await runLocalTurn('session-loop', 'check src/index.tsx', options)
  expect(second.at(-1)).toMatchObject({
    type: 'assistant_text',
    payload: { text: 'Inspect src/index.tsx first.' },
  })
})
```

```ts
// test/agent-runtime.test.ts
it('returns permission_denied as an observation and keeps execute alive', async () => {
  // first call yields a pending write request, second call denies it, third call finishes
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run test/session-store.test.ts test/default-runner.test.ts test/agent-runtime.test.ts
```

Expected: FAIL because session metadata has no pending execute API and the runtime cannot resume `ask_user` or permission waits.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/core/contracts.ts
export type PendingExecute =
  | {
      status: 'waiting_user'
    }
  | {
      status: 'waiting_permission'
      toolCallId: string
      toolName: 'write' | 'edit' | 'bash'
      input: Record<string, unknown>
    }

export type SessionMeta = {
  schemaVersion: 1
  sessionId: string
  createdAt: string
  updatedAt: string
  workspaceRoot: string
  mode: 'normal'
  pendingExecute?: PendingExecute | null
}
```

```ts
// src/store/sessionStore.ts
async function readMeta(): Promise<SessionMeta | null> {
  try {
    return JSON.parse(await readFile(paths.sessionMetaPath, 'utf8')) as SessionMeta
  } catch {
    return null
  }
}

return {
  paths,
  async ensureSession() {
    await mkdir(runDir, { recursive: true })
    const existing = await readMeta()
    if (existing) return
    const timestamp = now().toISOString()
    await writeMeta(createMeta(timestamp))
  },
  async touchSession() {
    const timestamp = now().toISOString()
    const existing = await readMeta()
    await writeMeta({
      ...createMeta(timestamp),
      ...existing,
      updatedAt: timestamp,
    })
  },
  async appendEvent(event: EventRecord) {
    await events.append(event)
  },
  async readEvents() {
    return events.readAll()
  },
  async readPendingExecute() {
    const meta = await readMeta()
    return meta?.pendingExecute ?? null
  },
  async savePendingExecute(pendingExecute: PendingExecute | null) {
    const meta = (await readMeta()) ?? createMeta(now().toISOString())
    await writeMeta({
      ...meta,
      pendingExecute,
      updatedAt: now().toISOString(),
    })
  },
}
```

```ts
// src/runtime/defaultRunner.ts
const persistentSession = createPersistentSession(sessionId, options)
await persistentSession?.ensureSession()

return createRuntime(sessionId, {
  ...options,
  sessionStore: persistentSession ?? undefined,
}).run(text)
```

```ts
// src/runtime/agentRuntime.ts
async function run(userText: string) {
  await initialize()
  const pending = await options.sessionStore?.readPendingExecute?.()

  if (pending?.status === 'waiting_permission') {
    return runPendingPermissionTurn(userText, pending)
  }

  const events: EventRecord[] = []
  await append(events, createEvent('user_message', { text: userText }))

  if (pending?.status === 'waiting_user') {
    return runExecuteLoop(events)
  }

  const controlDecision = await decideControl({ sessionId, userText })
  if (controlDecision.kind === 'answer') {
    return runAnswerTurn(events, controlDecision)
  }

  return runExecuteLoop(events)
}
```

```ts
// src/runtime/agentRuntime.ts
async function handleExecuteToolCall(
  events: EventRecord[],
  toolCall: {
    id: string
    name: string
    input: Record<string, unknown>
  },
) {
  if (toolCall.name === 'ask_user') {
    await options.sessionStore?.savePendingExecute({ status: 'waiting_user' })
    await append(
      events,
      createEvent('system_status', {
        message: 'Waiting for user reply',
        level: 'info',
        stage: 'waiting_user',
        reason: 'execute_waiting_user',
        source: 'runtime',
      }),
    )
    await append(events, createEvent('assistant_text', { text: toolCall.input.question }))
    return { done: true }
  }

  if (toolCall.name === 'finish') {
    await options.sessionStore?.savePendingExecute(null)
    await append(events, createEvent('assistant_text', { text: toolCall.input.message }))
    return { done: true }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run test/session-store.test.ts test/default-runner.test.ts test/agent-runtime.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/contracts.ts src/store/sessionStore.ts src/runtime/defaultRunner.ts src/runtime/agentRuntime.ts test/session-store.test.ts test/default-runner.test.ts test/agent-runtime.test.ts
git commit -m "feat: persist and resume execute loops"
```

## Task 5: Wire Permission/UI Status And End-To-End Visibility

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/components/PermissionDialog.tsx`
- Modify: `src/ui/events/projectEvents.ts`
- Modify: `src/ui/messages/toolProjection.ts`
- Test: `test/ui-event-projection.test.ts`
- Test: `test/interactive-app.test.tsx`

- [ ] **Step 1: Write the failing tests**

```ts
// test/ui-event-projection.test.ts
it('renders waiting_user status as a valid system message', () => {
  const events: EventRecord[] = [
    {
      id: 'evt-status',
      sessionId: 'session-test',
      timestamp: '2026-04-11T00:00:00.000Z',
      type: 'system_status',
      payload: {
        message: 'Waiting for user reply',
        level: 'info',
        stage: 'waiting_user',
        reason: 'execute_waiting_user',
      },
    },
  ]

  expect(projectEventsToRenderableItems(events)).toEqual([
    {
      id: 'evt-status',
      kind: 'system',
      level: 'info',
      message: 'waiting_user: execute_waiting_user - Waiting for user reply',
      timestamp: '2026-04-11T00:00:00.000Z',
    },
  ])
})
```

```tsx
// test/interactive-app.test.tsx
import React from 'react'
import { render } from 'ink-testing-library'
import { describe, expect, it } from 'vitest'
import { App } from '../src/ui/App'

describe('interactive app', () => {
  it('shows the permission dialog when the latest status is waiting_permission', async () => {
    const { lastFrame } = render(
      <App
        initialEvents={[
          {
            id: 'evt-status',
            sessionId: 'session-ui',
            timestamp: '2026-04-12T00:00:00.000Z',
            type: 'system_status',
            payload: {
              message: 'Waiting for permission',
              level: 'info',
              stage: 'waiting_permission',
              reason: 'execute_waiting_permission',
              toolName: 'write',
              input: { path: 'notes.txt', content: 'hello' },
            },
          },
        ]}
      />,
    )

    expect(lastFrame()).toContain('Permission gate')
    expect(lastFrame()).toContain('write')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run test/ui-event-projection.test.ts test/interactive-app.test.tsx
```

Expected: FAIL because `waiting_user` is not yet recognized as a stage and the app does not derive pending permission requests from events.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/ui/events/projectEvents.ts
function isRuntimeStage(value: unknown): value is RuntimeStage {
  return (
    value === 'idle' ||
    value === 'routing' ||
    value === 'answering' ||
    value === 'executing' ||
    value === 'waiting_user' ||
    value === 'waiting_permission' ||
    value === 'error'
  )
}
```

```ts
// src/ui/messages/toolProjection.ts
if (name === 'ask_user') {
  return { title: 'Asked user', summary: 'waiting for reply' }
}

if (name === 'finish') {
  return { title: 'Finished execute', summary: 'returned final answer' }
}
```

```tsx
// src/ui/App.tsx
function latestPendingPermissionRequest(events: EventRecord[]) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.type !== 'system_status') continue
    if (event.payload.stage !== 'waiting_permission') continue
    if (typeof event.payload.toolName !== 'string') continue
    if (!event.payload.input || typeof event.payload.input !== 'object') continue

    return {
      toolName: event.payload.toolName,
      input: event.payload.input as Record<string, unknown>,
    }
  }

  return null
}

const pendingPermissionRequest = React.useMemo(
  () => latestPendingPermissionRequest(events),
  [events],
)
```

```tsx
// src/ui/components/PermissionDialog.tsx
export function PermissionDialog({ pendingRequest = null }: Props) {
  if (!pendingRequest) return null

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="yellow" paddingX={1}>
      <Text color="yellow">Permission gate</Text>
      <Text>
        {pendingRequest.toolName} requires permission {JSON.stringify(pendingRequest.input)}
      </Text>
      <Text color="gray">Reply `y` to approve or `n` to deny</Text>
    </Box>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npx vitest run test/ui-event-projection.test.ts test/interactive-app.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/App.tsx src/ui/components/PermissionDialog.tsx src/ui/events/projectEvents.ts src/ui/messages/toolProjection.ts test/ui-event-projection.test.ts test/interactive-app.test.tsx
git commit -m "feat: show execute waiting states in the ui"
```

## Final Verification

- [ ] **Step 1: Run the focused regression suite**

Run:

```bash
npx vitest run test/control-decision.test.ts test/runtime-engine.test.ts test/prompt-compiler.test.ts test/tool-registry.test.ts test/execute-catalog.test.ts test/permissions.test.ts test/agent-runtime.test.ts test/default-runner.test.ts test/session-store.test.ts test/ui-event-projection.test.ts test/interactive-app.test.tsx
```

Expected: PASS

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS with the full repository test suite green.

- [ ] **Step 3: Commit the final verification checkpoint**

```bash
git add src test
git commit -m "test: verify stage1 execute minimal loop"
```
