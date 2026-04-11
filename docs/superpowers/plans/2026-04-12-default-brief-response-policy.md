# Default Brief Response Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an appended response-policy layer so Accorda defaults to brief answers, uses a dedicated clarify prompt policy, and records the selected policy in runtime events.

**Architecture:** Keep the Stage 2 control flow unchanged. Introduce a small `responsePolicy` module that maps first-layer decisions to appended system prompts and metadata, then wire that module into `createAgentRuntime` so provider calls and non-provider exits stay transparent. `execute` remains a full second-layer path and only changes the final answer style.

**Tech Stack:** TypeScript, Node.js ESM, Vitest, existing `createAgentRuntime`, existing run-once/default runner path.

---

## Scope

In scope:

- Add `default_brief_v1` and `clarify_direct_v1`.
- Append one extra system prompt per turn when a response policy applies.
- Attach `responsePolicyId`, `responsePolicyMode`, and `responseStyle` to runtime status events.
- Tighten the first-layer `clarify` tool description.
- Verify `answer`, `clarify`, and `execute` behavior with tests.

Out of scope:

- Hard word limits.
- Token budgeting.
- New control-decision kinds.
- Task Mode redesign.
- New tool capabilities.

## File Structure

- Create `src/runtime/responsePolicy.ts`: response policy types, policy selection, metadata projection, and provider-message helper.
- Modify `src/tools/registry.ts`: replace the `clarify` description with the approved dedicated wording.
- Modify `src/runtime/agentRuntime.ts`: select a policy from the first-layer decision, append the policy system message for provider calls, and include policy metadata in runtime status events.
- Create `test/response-policy.test.ts`: unit coverage for policy mapping, metadata, and system-message creation.
- Create `test/tool-registry.test.ts`: lock in the dedicated `clarify` tool description.
- Modify `test/agent-runtime.test.ts`: verify appended policy prompts, policy metadata, clarify directness, and `execute` still using the second layer.
- Modify `test/default-runner.test.ts`: verify `runLocalTurn` sends the appended brief policy to the provider client and preserves policy metadata on provider status events.

---

### Task 1: Add Response Policy Primitives and Clarify Contract

**Files:**
- Create: `src/runtime/responsePolicy.ts`
- Create: `test/response-policy.test.ts`
- Create: `test/tool-registry.test.ts`
- Modify: `src/tools/registry.ts`

- [ ] **Step 1: Write the failing policy tests**

Create `test/response-policy.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  createResponsePolicyMessage,
  responsePolicyMetadata,
  selectResponsePolicy,
} from '../src/runtime/responsePolicy'

describe('response policy', () => {
  it('maps answer and execute to the default brief policy', () => {
    expect(selectResponsePolicy({ kind: 'answer' })).toMatchObject({
      id: 'default_brief_v1',
      mode: 'appended',
      style: 'default_brief',
      prompt: 'Be brief. Lead with the conclusion.',
    })

    expect(selectResponsePolicy({ kind: 'execute' })).toMatchObject({
      id: 'default_brief_v1',
      mode: 'appended',
      style: 'default_brief',
      prompt: 'Be brief. Lead with the conclusion.',
    })
  })

  it('maps clarify to the dedicated clarify policy', () => {
    expect(selectResponsePolicy({ kind: 'clarify' })).toMatchObject({
      id: 'clarify_direct_v1',
      mode: 'appended',
      style: 'clarify_direct',
      prompt:
        'Ask one direct clarification question for the single most important missing detail. Be specific and concise. Do not explain the whole plan.',
    })
  })

  it('does not add a stage-three policy for task mode', () => {
    expect(selectResponsePolicy({ kind: 'task_mode' })).toBeNull()
  })

  it('projects compact metadata and a system message from a policy', () => {
    const policy = selectResponsePolicy({ kind: 'answer' })
    expect(policy).not.toBeNull()
    expect(responsePolicyMetadata(policy!)).toEqual({
      responsePolicyId: 'default_brief_v1',
      responsePolicyMode: 'appended',
      responseStyle: 'default_brief',
    })
    expect(createResponsePolicyMessage(policy!)).toEqual({
      role: 'system',
      content: 'Be brief. Lead with the conclusion.',
    })
  })
})
```

- [ ] **Step 2: Write the failing clarify-tool registry test**

Create `test/tool-registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { STAGE_ONE_TOOLS } from '../src/tools/registry'

describe('tool registry', () => {
  it('uses the dedicated clarify contract in stage one', () => {
    expect(STAGE_ONE_TOOLS.find(tool => tool.name === 'clarify')).toEqual({
      name: 'clarify',
      description:
        'Ask one direct clarification question when key information is missing. Ask only for the minimum information needed to continue. Do not answer the task yet. Do not ask multiple questions unless strictly necessary. Use this only when the missing information blocks a correct or safe next step.',
      requiresConfirmation: false,
    })
  })
})
```

- [ ] **Step 3: Run the tests and verify they fail**

Run:

```bash
npm test -- test/response-policy.test.ts test/tool-registry.test.ts
```

Expected:

- `test/response-policy.test.ts` fails because `src/runtime/responsePolicy.ts` does not exist.
- `test/tool-registry.test.ts` fails because the current `clarify` description is still short and generic.

- [ ] **Step 4: Implement the response policy module**

Create `src/runtime/responsePolicy.ts`:

```ts
import type { ControlDecision } from './controlDecision.js'

export type ResponsePolicyId = 'default_brief_v1' | 'clarify_direct_v1'
export type ResponsePolicyMode = 'appended'
export type ResponseStyle = 'default_brief' | 'clarify_direct'

export type ResponsePolicy = {
  id: ResponsePolicyId
  mode: ResponsePolicyMode
  style: ResponseStyle
  prompt: string
}

const DEFAULT_BRIEF_POLICY: ResponsePolicy = {
  id: 'default_brief_v1',
  mode: 'appended',
  style: 'default_brief',
  prompt: 'Be brief. Lead with the conclusion.',
}

const CLARIFY_DIRECT_POLICY: ResponsePolicy = {
  id: 'clarify_direct_v1',
  mode: 'appended',
  style: 'clarify_direct',
  prompt:
    'Ask one direct clarification question for the single most important missing detail. Be specific and concise. Do not explain the whole plan.',
}

export function selectResponsePolicy(
  decision: Pick<ControlDecision, 'kind'>,
): ResponsePolicy | null {
  if (decision.kind === 'answer' || decision.kind === 'execute') {
    return DEFAULT_BRIEF_POLICY
  }

  if (decision.kind === 'clarify') {
    return CLARIFY_DIRECT_POLICY
  }

  return null
}

export function responsePolicyMetadata(policy: ResponsePolicy) {
  return {
    responsePolicyId: policy.id,
    responsePolicyMode: policy.mode,
    responseStyle: policy.style,
  }
}

export function createResponsePolicyMessage(policy: ResponsePolicy) {
  return {
    role: 'system' as const,
    content: policy.prompt,
  }
}
```

- [ ] **Step 5: Tighten the clarify description**

Replace the `clarify` entry in `src/tools/registry.ts` with:

```ts
  {
    name: 'clarify',
    description:
      'Ask one direct clarification question when key information is missing. Ask only for the minimum information needed to continue. Do not answer the task yet. Do not ask multiple questions unless strictly necessary. Use this only when the missing information blocks a correct or safe next step.',
    requiresConfirmation: false,
  },
```

Keep the other stage-one tools unchanged in this task.

- [ ] **Step 6: Run the focused tests**

Run:

```bash
npm test -- test/response-policy.test.ts test/tool-registry.test.ts
```

Expected: both test files pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/runtime/responsePolicy.ts src/tools/registry.ts test/response-policy.test.ts test/tool-registry.test.ts
git commit -m "feat(runtime): add response policy primitives"
```

Expected: commit succeeds.

---

### Task 2: Wire Appended Policies Into Agent Runtime

**Files:**
- Modify: `src/runtime/agentRuntime.ts`
- Modify: `test/agent-runtime.test.ts`
- Modify: `test/default-runner.test.ts`

- [ ] **Step 1: Add the failing runtime tests**

Append these tests to `test/agent-runtime.test.ts`:

```ts
  it('appends the default brief policy for answer turns and records provider metadata', async () => {
    const calls: string[][] = []
    const runtime = createAgentRuntime({
      provider: async ({ messages }) => {
        calls.push(messages.map(message => `${message.role}:${message.content}`))
        return { text: 'hello back' }
      },
    })

    const events = await runtime.run('hello')

    expect(calls[0]?.slice(0, 2)).toEqual([
      'system:You are Accorda, a minimal local coding assistant runtime. Answer concisely and use prior context when useful.',
      'system:Be brief. Lead with the conclusion.',
    ])
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'system_status',
        payload: expect.objectContaining({
          source: 'provider',
          responsePolicyId: 'default_brief_v1',
          responsePolicyMode: 'appended',
          responseStyle: 'default_brief',
        }),
      }),
    )
  })
```

Replace the existing `logs clarify decisions and returns the question without calling the provider` assertion block with:

```ts
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'system_status',
        payload: expect.objectContaining({
          stage: 'routing',
          reason: 'stage_one_clarify_request',
          controlDecision: 'clarify',
          responsePolicyId: 'clarify_direct_v1',
          responsePolicyMode: 'appended',
          responseStyle: 'clarify_direct',
        }),
      }),
    )
```

Replace the existing `logs Task Mode decisions without calling the provider` assertion block with:

```ts
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
    expect(
      events.some(
        event =>
          event.type === 'system_status' &&
          'responsePolicyId' in event.payload,
      ),
    ).toBe(false)
```

Replace the existing `uses execute decisions to run read-only tools before provider answers` test with:

```ts
  it('uses execute decisions to run read-only tools and still appends the brief policy', async () => {
    const workspaceRoot = await tempRuntimeDir()
    const calls: string[][] = []
    try {
      await writeFile(join(workspaceRoot, 'note.txt'), 'hello from note')
      const runtime = createAgentRuntime({
        workspaceRoot,
        controlDecision: async () => ({
          kind: 'execute',
          reason: 'stage_one_execute',
        }),
        provider: async ({ messages }) => {
          calls.push(messages.map(message => `${message.role}:${message.content}`))
          return { text: 'tool result inspected' }
        },
      })

      const events = await runtime.run('read note.txt')

      expect(calls[0]?.slice(0, 2)).toEqual([
        'system:You are Accorda, a minimal local coding assistant runtime. Answer concisely and use prior context when useful.',
        'system:Be brief. Lead with the conclusion.',
      ])
      expect(events).toContainEqual(
        expect.objectContaining({
          type: 'system_status',
          payload: expect.objectContaining({
            source: 'provider',
            responsePolicyId: 'default_brief_v1',
            responsePolicyMode: 'appended',
            responseStyle: 'default_brief',
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
```

- [ ] **Step 2: Add the failing default-runner tests**

Append these tests to `test/default-runner.test.ts`:

```ts
  it('appends the default brief policy before sending answer turns to the provider client', async () => {
    loadConfig.mockReturnValue({
      provider: {
        baseURL: 'https://example.com/v1',
        apiKey: 'test-key',
        model: 'gpt-4.1-mini',
      },
      workspaceRoot: '/tmp/workspace',
    })
    createTextCompletion.mockResolvedValue({
      text: 'hello back',
      model: 'gpt-4.1-mini',
    })

    await runLocalTurn('session-brief', 'hello')

    expect(createTextCompletion).toHaveBeenCalledTimes(1)
    expect(createTextCompletion.mock.calls[0]?.[1].slice(0, 2)).toEqual([
      {
        role: 'system',
        content:
          'You are Accorda, a minimal local coding assistant runtime. Answer concisely and use prior context when useful.',
      },
      {
        role: 'system',
        content: 'Be brief. Lead with the conclusion.',
      },
    ])
  })
```

In the existing `preserves provider metadata in system status events when usage is present` test, extend the `providerStatus` expectation payload with:

```ts
        responsePolicyId: 'default_brief_v1',
        responsePolicyMode: 'appended',
        responseStyle: 'default_brief',
```

- [ ] **Step 3: Run the tests and verify they fail**

Run:

```bash
npm test -- test/agent-runtime.test.ts test/default-runner.test.ts
```

Expected:

- answer-path tests fail because provider messages currently contain only the base system prompt.
- clarify-path tests fail because routing status events do not yet include response policy metadata.
- default-runner tests fail because provider status events do not yet include response policy metadata.

- [ ] **Step 4: Wire policy selection into `createAgentRuntime`**

In `src/runtime/agentRuntime.ts`, add this import:

```ts
import {
  createResponsePolicyMessage,
  responsePolicyMetadata,
  selectResponsePolicy,
  type ResponsePolicy,
} from './responsePolicy.js'
```

Change `providerMessages` from:

```ts
  function providerMessages() {
    return [
      {
        role: 'system' as const,
        content:
          'You are Accorda, a minimal local coding assistant runtime. Answer concisely and use prior context when useful.',
      },
      ...history.map(eventToProviderMessage).filter(message => message !== null),
    ]
  }
```

to:

```ts
  function providerMessages(responsePolicy: ResponsePolicy | null) {
    const messages: ProviderMessage[] = [
      {
        role: 'system',
        content:
          'You are Accorda, a minimal local coding assistant runtime. Answer concisely and use prior context when useful.',
      },
    ]

    if (responsePolicy) {
      messages.push(createResponsePolicyMessage(responsePolicy))
    }

    messages.push(
      ...history.map(eventToProviderMessage).filter(message => message !== null),
    )

    return messages
  }
```

In `runTurn`, immediately after `const controlDecision = ...`, add:

```ts
    const responsePolicy = selectResponsePolicy(controlDecision)
    const responsePolicyPayload = responsePolicy
      ? responsePolicyMetadata(responsePolicy)
      : {}
```

Update the routing status append from:

```ts
      createEvent('system_status', {
        ...controlStatus,
        controlDecision: controlDecision.kind,
      }),
```

to:

```ts
      createEvent('system_status', {
        ...controlStatus,
        controlDecision: controlDecision.kind,
        ...responsePolicyPayload,
      }),
```

Update the provider call from:

```ts
    const result = await options.provider({
      messages: providerMessages(),
      toolNames: READ_ONLY_TOOL_NAMES,
    })
```

to:

```ts
    const result = await options.provider({
      messages: providerMessages(responsePolicy),
      toolNames: READ_ONLY_TOOL_NAMES,
    })
```

Update the provider status append from:

```ts
      createEvent('system_status', {
        ...providerStatus,
        usage: result.usage,
        model: result.model,
        finishReason: result.finishReason,
      }),
```

to:

```ts
      createEvent('system_status', {
        ...providerStatus,
        ...responsePolicyPayload,
        usage: result.usage,
        model: result.model,
        finishReason: result.finishReason,
      }),
```

- [ ] **Step 5: Run the focused tests**

Run:

```bash
npm test -- test/agent-runtime.test.ts test/default-runner.test.ts
```

Expected: both test files pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/runtime/agentRuntime.ts test/agent-runtime.test.ts test/default-runner.test.ts
git commit -m "feat(runtime): append default brief response policies"
```

Expected: commit succeeds.

---

### Task 3: Full Verification

**Files:**
- No code changes expected in this task.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run the run-once smoke test**

Run:

```bash
npm run run:once -- --session brief-policy-smoke "这个项目怎么启动？"
```

Expected:

- command exits successfully
- stdout prints a JSON object with `sessionId`, `eventCount`, and `finalText`
- the generated event log contains a provider or config status event with `responsePolicyId` when the turn reaches the provider

- [ ] **Step 3: Inspect repository status**

Run:

```bash
git status --short
```

Expected: no output.

If `git status --short` shows only intentional files from this plan, commit them with:

```bash
git add src test
git commit -m "test(runtime): verify default brief response policy"
```
