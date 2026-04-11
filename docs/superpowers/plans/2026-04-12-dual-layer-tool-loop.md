# Dual-Layer Tool Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first-layer control decision for Accorda's dual-layer tool loop: direct answer, direct execute, clarify, and Task Mode entry.

**Architecture:** Introduce a small control-decision module and wire it into the existing runtime without changing the provider client. The real CLI path uses deterministic routing for the current build, while tests can inject all four first-layer decisions. Task Mode is surfaced as a visible first-layer exit, not as a full task executor in this phase.

**Tech Stack:** TypeScript, Node.js ESM, Vitest, existing `createAgentRuntime`, existing event-log contracts.

---

## Scope

In scope:

- Rename the old stage-one `proceed` concept to `execute`.
- Add stage-one `answer`, `execute`, `clarify`, and `task_mode` tool names.
- Persist a `system_status` event whenever the first layer makes a control decision.
- Keep read-only tool execution in the second layer.
- Cover all four exits with tests.

Out of scope:

- Memory.
- Full Task Mode execution.
- Local-machine permission policy beyond the current workspace-safe read-only tools.
- TUI redesign.
- Project-wide NodeNext import-extension cleanup.

## File Structure

- Create `src/runtime/controlDecision.ts`: shared first-layer decision types, default routing, and status payload conversion.
- Modify `src/tools/types.ts`: add stage-one tool names and remove `proceed`.
- Modify `src/tools/registry.ts`: expose the four first-layer control tools.
- Modify `src/prompt/compiler.ts`: keep using registry names; no logic change expected.
- Modify `src/runtime/stageOne.ts`: update the old stage-one decision union.
- Modify `src/runtime/engine.ts`: handle the four first-layer exits.
- Modify `src/runtime/agentRuntime.ts`: inject and log control decisions before tool/provider work.
- Create `test/control-decision.test.ts`: pure unit coverage for default routing and status payloads.
- Modify `test/prompt-compiler.test.ts`: expect four stage-one tool names.
- Modify `test/runtime-engine.test.ts`: cover `answer`, `execute`, `clarify`, and `task_mode`.
- Modify `test/agent-runtime.test.ts`: cover runtime event logging for injected control decisions.

---

### Task 1: Add Control Decision Module

**Files:**
- Create: `src/runtime/controlDecision.ts`
- Create: `test/control-decision.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `test/control-decision.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  controlDecisionStatus,
  defaultControlDecision,
} from '../src/runtime/controlDecision'

describe('control decision', () => {
  it('routes explicit read-only tool requests to execute', async () => {
    await expect(
      defaultControlDecision({
        sessionId: 's-1',
        userText: 'read package.json',
      }),
    ).resolves.toEqual({
      kind: 'execute',
      reason: 'stage_one_execute_read_only_tool',
    })
  })

  it('routes ordinary input to direct answer', async () => {
    await expect(
      defaultControlDecision({
        sessionId: 's-1',
        userText: 'explain the project briefly',
      }),
    ).resolves.toEqual({
      kind: 'answer',
      reason: 'stage_one_direct_answer',
    })
  })

  it('creates routing status payloads for visible event logs', () => {
    expect(
      controlDecisionStatus({
        kind: 'clarify',
        question: 'Which file should I inspect?',
        reason: 'stage_one_clarify_request',
      }),
    ).toEqual({
      message: 'Stage one selected clarify',
      level: 'info',
      stage: 'routing',
      reason: 'stage_one_clarify_request',
      source: 'stage_one',
    })
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- test/control-decision.test.ts
```

Expected: fails because `src/runtime/controlDecision.ts` does not exist.

- [ ] **Step 3: Implement the module**

Create `src/runtime/controlDecision.ts`:

```ts
import type { RuntimeStatusPayload } from '../core/contracts.js'
import { parseReadOnlyToolRequest } from '../tools/readOnly.js'

export type ControlDecision =
  | {
      kind: 'answer'
      reason?: string
    }
  | {
      kind: 'execute'
      reason?: string
    }
  | {
      kind: 'clarify'
      question: string
      reason?: string
    }
  | {
      kind: 'task_mode'
      summary: string
      reason?: string
    }

export type ControlDecisionInput = {
  sessionId: string
  userText: string
}

export type ControlDecisionRunner = (
  input: ControlDecisionInput,
) => Promise<ControlDecision>

export async function defaultControlDecision(
  input: ControlDecisionInput,
): Promise<ControlDecision> {
  if (parseReadOnlyToolRequest(input.userText)) {
    return {
      kind: 'execute',
      reason: 'stage_one_execute_read_only_tool',
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

- [ ] **Step 4: Run the focused test**

Run:

```bash
npm test -- test/control-decision.test.ts
```

Expected: all tests in `test/control-decision.test.ts` pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/runtime/controlDecision.ts test/control-decision.test.ts
git commit -m "feat(runtime): add control decision model"
```

Expected: commit succeeds.

---

### Task 2: Update Stage-One Tool Names

**Files:**
- Modify: `src/tools/types.ts`
- Modify: `src/tools/registry.ts`
- Modify: `test/prompt-compiler.test.ts`

- [ ] **Step 1: Update the failing prompt compiler expectation**

In `test/prompt-compiler.test.ts`, replace:

```ts
    expect(compiled.toolNames).toEqual(['clarify', 'proceed'])
```

with:

```ts
    expect(compiled.toolNames).toEqual([
      'answer',
      'execute',
      'clarify',
      'task_mode',
    ])
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- test/prompt-compiler.test.ts
```

Expected: fails because the registry still returns `clarify` and `proceed`.

- [ ] **Step 3: Update tool name types**

Replace the `ToolName` union in `src/tools/types.ts` with:

```ts
export type ToolName =
  | 'answer'
  | 'execute'
  | 'clarify'
  | 'task_mode'
  | 'ls'
  | 'read'
  | 'write'
  | 'edit'
  | 'glob'
  | 'grep'
  | 'bash'
```

- [ ] **Step 4: Update the stage-one registry**

Replace `STAGE_ONE_TOOLS` in `src/tools/registry.ts` with:

```ts
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
  {
    name: 'clarify',
    description: 'Ask the user to clarify intent before continuing',
    requiresConfirmation: false,
  },
  {
    name: 'task_mode',
    description: 'Enter a multi-step task planning and execution flow',
    requiresConfirmation: false,
  },
]
```

- [ ] **Step 5: Run the focused test**

Run:

```bash
npm test -- test/prompt-compiler.test.ts
```

Expected: all tests in `test/prompt-compiler.test.ts` pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/tools/types.ts src/tools/registry.ts test/prompt-compiler.test.ts
git commit -m "feat(runtime): expose stage one control tools"
```

Expected: commit succeeds.

---

### Task 3: Teach the Skeleton Engine All Four Exits

**Files:**
- Modify: `src/runtime/stageOne.ts`
- Modify: `src/runtime/engine.ts`
- Modify: `test/runtime-engine.test.ts`

- [ ] **Step 1: Replace the engine tests**

Replace `test/runtime-engine.test.ts` with:

```ts
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
          { type: 'assistant_text', payload: { text: 'done' } },
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
    expect(result.events).toHaveLength(3)
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

  it('returns the clarification question without entering stage two', async () => {
    const engine = createRuntimeEngine({
      runStageOne: async () => ({
        kind: 'clarify',
        question: 'Which file should I inspect?',
        reason: 'stage_one_clarify_request',
      }),
      runStageTwo: async () => {
        throw new Error('stage two should not run')
      },
    })

    const result = await engine.runTurn('session-1', 'check it')

    expect(result.returnedToStageOne).toBe(false)
    expect(result.state.stage).toBe('answering')
    expect(result.state.reason).toBe('stage_one_clarify_request')
    expect(result.finalText).toBe('Which file should I inspect?')
  })

  it('surfaces Task Mode entry without running stage two in this phase', async () => {
    const engine = createRuntimeEngine({
      runStageOne: async () => ({
        kind: 'task_mode',
        summary: 'Investigate failing tests and propose a fix',
        reason: 'stage_one_task_mode',
      }),
      runStageTwo: async () => {
        throw new Error('stage two should not run')
      },
    })

    const result = await engine.runTurn('session-1', 'fix the tests')

    expect(result.returnedToStageOne).toBe(false)
    expect(result.state.stage).toBe('executing')
    expect(result.state.reason).toBe('stage_one_task_mode')
    expect(result.finalText).toBe(
      'Task Mode selected: Investigate failing tests and propose a fix',
    )
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- test/runtime-engine.test.ts
```

Expected: fails because `StageOneDecision` still uses the old `kind: 'tool'` form.

- [ ] **Step 3: Update the stage-one decision type**

Replace `StageOneDecision` in `src/runtime/stageOne.ts` with:

```ts
export type StageOneDecision =
  | {
      kind: 'answer'
      text: string
      reason?: string
      status?: RuntimeStatusPayload
      metadata?: ProviderResultMetadata
    }
  | {
      kind: 'execute'
      reason?: string
      status?: RuntimeStatusPayload
      metadata?: ProviderResultMetadata
    }
  | {
      kind: 'clarify'
      question: string
      reason?: string
      status?: RuntimeStatusPayload
      metadata?: ProviderResultMetadata
    }
  | {
      kind: 'task_mode'
      summary: string
      reason?: string
      status?: RuntimeStatusPayload
      metadata?: ProviderResultMetadata
    }
```

Also change the import in the same file to include `.js`:

```ts
} from '../core/contracts.js'
```

- [ ] **Step 4: Update the engine branching**

In `src/runtime/engine.ts`, replace the branch that checks `stageOne.name === 'clarify'` and the default proceed path with:

```ts
      if (stageOne.kind === 'clarify') {
        return {
          state: createRuntimeState(
            'answering',
            stageOne.reason ?? 'stage_one_clarify_request',
          ),
          returnedToStageOne: false,
          finalText: stageOne.question,
          status:
            stageOne.status ??
            {
              message: 'Clarification needed',
              level: 'info',
              stage: 'answering',
              reason: stageOne.reason ?? 'stage_one_clarify_request',
              source: 'stage_one',
            },
          metadata: stageOne.metadata,
        }
      }

      if (stageOne.kind === 'task_mode') {
        return {
          state: createRuntimeState(
            'executing',
            stageOne.reason ?? 'stage_one_task_mode',
          ),
          returnedToStageOne: false,
          finalText: `Task Mode selected: ${stageOne.summary}`,
          status:
            stageOne.status ??
            {
              message: 'Task Mode selected',
              level: 'info',
              stage: 'executing',
              reason: stageOne.reason ?? 'stage_one_task_mode',
              source: 'stage_one',
            },
          metadata: stageOne.metadata,
        }
      }

      const stageTwo = await deps.runStageTwo({ sessionId, userText })
```

Keep the existing stage-two return object below this replacement unchanged.

- [ ] **Step 5: Run the focused test**

Run:

```bash
npm test -- test/runtime-engine.test.ts
```

Expected: all tests in `test/runtime-engine.test.ts` pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/runtime/stageOne.ts src/runtime/engine.ts test/runtime-engine.test.ts
git commit -m "feat(runtime): support four stage one exits"
```

Expected: commit succeeds.

---

### Task 4: Wire Control Decisions Into Agent Runtime

**Files:**
- Modify: `src/runtime/agentRuntime.ts`
- Modify: `test/agent-runtime.test.ts`

- [ ] **Step 1: Add failing runtime tests**

Append these tests inside `describe('agent runtime', () => { ... })` in `test/agent-runtime.test.ts`:

```ts
  it('logs clarify decisions and returns the question without calling the provider', async () => {
    let providerCalled = false
    const runtime = createAgentRuntime({
      controlDecision: async () => ({
        kind: 'clarify',
        question: 'Which file should I inspect?',
        reason: 'stage_one_clarify_request',
      }),
      provider: async () => {
        providerCalled = true
        return { text: 'provider answer' }
      },
    })

    const events = await runtime.run('check it')

    expect(providerCalled).toBe(false)
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'system_status',
        payload: expect.objectContaining({
          stage: 'routing',
          reason: 'stage_one_clarify_request',
          controlDecision: 'clarify',
        }),
      }),
    )
    expect(events.at(-1)).toMatchObject({
      type: 'assistant_text',
      payload: { text: 'Which file should I inspect?' },
    })
  })

  it('logs Task Mode decisions without calling the provider', async () => {
    let providerCalled = false
    const runtime = createAgentRuntime({
      controlDecision: async () => ({
        kind: 'task_mode',
        summary: 'Inspect tests and propose a fix',
        reason: 'stage_one_task_mode',
      }),
      provider: async () => {
        providerCalled = true
        return { text: 'provider answer' }
      },
    })

    const events = await runtime.run('fix the tests')

    expect(providerCalled).toBe(false)
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'system_status',
        payload: expect.objectContaining({
          stage: 'routing',
          reason: 'stage_one_task_mode',
          controlDecision: 'task_mode',
        }),
      }),
    )
    expect(events.at(-1)).toMatchObject({
      type: 'assistant_text',
      payload: {
        text: 'Task Mode selected: Inspect tests and propose a fix',
      },
    })
  })

  it('uses execute decisions to run read-only tools before provider answers', async () => {
    const workspaceRoot = await tempRuntimeDir()
    try {
      await writeFile(join(workspaceRoot, 'note.txt'), 'hello from note')
      const runtime = createAgentRuntime({
        workspaceRoot,
        controlDecision: async () => ({
          kind: 'execute',
          reason: 'stage_one_execute',
        }),
        provider: async () => ({ text: 'tool result inspected' }),
      })

      const events = await runtime.run('read note.txt')

      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'system_status',
          payload: expect.objectContaining({
            stage: 'routing',
            reason: 'stage_one_execute',
            controlDecision: 'execute',
          }),
        }),
      )
      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'tool_result',
          payload: expect.objectContaining({
            name: 'read',
            ok: true,
            output: 'hello from note',
          }),
        }),
      )
      expect(events.at(-1)).toMatchObject({
        type: 'assistant_text',
        payload: { text: 'tool result inspected' },
      })
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })

  it('does not run tools when the first layer selects direct answer', async () => {
    const workspaceRoot = await tempRuntimeDir()
    try {
      await writeFile(join(workspaceRoot, 'note.txt'), 'hello from note')
      const runtime = createAgentRuntime({
        workspaceRoot,
        controlDecision: async () => ({
          kind: 'answer',
          reason: 'stage_one_direct_answer',
        }),
        provider: async () => ({ text: 'direct provider answer' }),
      })

      const events = await runtime.run('read note.txt')

      expect(events.some(event => event.type === 'tool_call')).toBe(false)
      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'system_status',
          payload: expect.objectContaining({
            stage: 'routing',
            reason: 'stage_one_direct_answer',
            controlDecision: 'answer',
          }),
        }),
      )
      expect(events.at(-1)).toMatchObject({
        type: 'assistant_text',
        payload: { text: 'direct provider answer' },
      })
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true })
    }
  })
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
npm test -- test/agent-runtime.test.ts
```

Expected: fails because `createAgentRuntime` does not accept `controlDecision`.

- [ ] **Step 3: Update imports and options**

In `src/runtime/agentRuntime.ts`, add this import:

```ts
import {
  controlDecisionStatus,
  defaultControlDecision,
  type ControlDecisionRunner,
} from './controlDecision.js'
```

Add this field to `AgentRuntimeOptions`:

```ts
  controlDecision?: ControlDecisionRunner
```

Inside `createAgentRuntime`, after `const tools = ...`, add:

```ts
  const decideControl = options.controlDecision ?? defaultControlDecision
```

- [ ] **Step 4: Add control decision handling to `runTurn`**

In `runTurn`, immediately after appending the `user_message`, add:

```ts
    const controlDecision = await decideControl({ sessionId, userText })
    const controlStatus = controlDecisionStatus(controlDecision)
    await append(
      events,
      createEvent('system_status', {
        ...controlStatus,
        controlDecision: controlDecision.kind,
      }),
    )

    if (controlDecision.kind === 'clarify') {
      await append(
        events,
        createEvent('assistant_text', { text: controlDecision.question }),
      )
      await persistContextSnapshot(events)
      return events
    }

    if (controlDecision.kind === 'task_mode') {
      await append(
        events,
        createEvent('assistant_text', {
          text: `Task Mode selected: ${controlDecision.summary}`,
        }),
      )
      await persistContextSnapshot(events)
      return events
    }
```

Then replace:

```ts
    const toolRequest = parseReadOnlyToolRequest(userText)
    if (toolRequest) {
```

with:

```ts
    const toolRequest =
      controlDecision.kind === 'execute'
        ? parseReadOnlyToolRequest(userText)
        : null
    if (toolRequest) {
```

- [ ] **Step 5: Run the focused runtime test**

Run:

```bash
npm test -- test/agent-runtime.test.ts
```

Expected: all tests in `test/agent-runtime.test.ts` pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/runtime/agentRuntime.ts test/agent-runtime.test.ts
git commit -m "feat(runtime): log first-layer control decisions"
```

Expected: commit succeeds.

---

### Task 5: Full Verification

**Files:**
- No code changes expected in this task.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run the local CLI smoke test**

Run:

```bash
npm run run:once -- --session dual-layer-smoke "用一句话回复：dual layer smoke ok"
```

Expected: command exits successfully and prints a JSON object with `sessionId`, `eventCount`, and `finalText`.

- [ ] **Step 3: Inspect repository status**

Run:

```bash
git status --short
```

Expected: no output.

If `git status --short` shows only intentional files from this plan, commit them with:

```bash
git add src test
git commit -m "test(runtime): verify dual-layer control loop"
```

