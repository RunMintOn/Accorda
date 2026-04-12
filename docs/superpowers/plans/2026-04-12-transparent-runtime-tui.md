# Transparent Runtime TUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the Accorda TUI so it keeps Claude Code's shell rhythm while projecting runtime events into clearer tool-step blocks and lighter status lines.

**Architecture:** Keep runtime events unchanged and insert a projection layer between raw events and Ink renderers. That projection layer will merge `tool_call` and `tool_result` into one tool step model, apply small tool-specific title/summary rules, and leave `user_message`, `assistant_text`, and `system_status` as separate render items. The outer header/input shell will then be adjusted to feel closer to Claude Code without hiding Accorda-specific routing semantics.

**Tech Stack:** TypeScript, React, Ink, Vitest, ink-testing-library

---

### Task 1: Add a Step-Oriented Projection Layer

**Files:**
- Create: `src/ui/events/projectRenderableItems.ts`
- Create: `src/ui/messages/toolProjection.ts`
- Modify: `src/ui/messages/types.ts`
- Modify: `src/ui/App.tsx`
- Test: `test/ui-event-projection.test.ts`

- [ ] **Step 1: Write the failing projection tests**

```ts
import { describe, expect, it } from 'vitest'
import { projectEventsToRenderableItems } from '../src/ui/events/projectRenderableItems'
import type { EventRecord } from '../src/core/contracts'

const base = {
  sessionId: 'session-test',
  timestamp: '2026-04-11T00:00:00.000Z',
}

describe('projectEventsToRenderableItems', () => {
  it('merges tool_call and tool_result into one tool step item', () => {
    const events: EventRecord[] = [
      {
        ...base,
        id: 'evt-call',
        type: 'tool_call',
        payload: {
          toolCallId: 'call-1',
          name: 'read',
          input: { path: 'package.json' },
          layer: 'real',
        },
      },
      {
        ...base,
        id: 'evt-result',
        type: 'tool_result',
        payload: {
          toolCallId: 'call-1',
          name: 'read',
          ok: true,
          output: '{\"name\":\"accorda\"}',
        },
      },
    ]

    expect(projectEventsToRenderableItems(events)).toContainEqual({
      id: 'call-1',
      kind: 'tool_step',
      toolName: 'read',
      title: 'Read package.json',
      status: 'ok',
      summary: 'Read file',
      timestamp: base.timestamp,
    })
  })

  it('keeps system status separate from tool step items', () => {
    const events: EventRecord[] = [
      {
        ...base,
        id: 'evt-status',
        type: 'system_status',
        payload: {
          message: 'Routing to execute',
          level: 'info',
          stage: 'routing',
          reason: 'stage_one_execute',
        },
      },
    ]

    expect(projectEventsToRenderableItems(events)).toEqual([
      {
        id: 'evt-status',
        kind: 'system',
        level: 'info',
        message: 'routing: stage_one_execute - Routing to execute',
        timestamp: base.timestamp,
      },
    ])
  })
})
```

- [ ] **Step 2: Run the projection tests to verify they fail**

Run: `npm test -- test/ui-event-projection.test.ts`
Expected: FAIL because `projectEventsToRenderableItems` and `tool_step` do not exist yet

- [ ] **Step 3: Add the new projection model and tool rules**

```ts
// src/ui/messages/types.ts
export type RenderableItem =
  | {
      id: string
      kind: 'user'
      text: string
      timestamp: string
    }
  | {
      id: string
      kind: 'assistant'
      text: string
      timestamp: string
    }
  | {
      id: string
      kind: 'system'
      message: string
      level: 'info' | 'warning' | 'error'
      timestamp: string
    }
  | {
      id: string
      kind: 'tool_step'
      toolName: string
      title: string
      status: 'running' | 'ok' | 'error'
      summary: string
      timestamp: string
    }
```

```ts
// src/ui/messages/toolProjection.ts
type ToolProjectionInput = {
  name: string
  input?: Record<string, unknown>
  ok?: boolean
  output?: unknown
  error?: string
}

export function projectToolStep({
  name,
  input,
  ok,
  output,
  error,
}: ToolProjectionInput): { title: string; summary: string } {
  if (name === 'read' && typeof input?.path === 'string') {
    return { title: `Read ${input.path}`, summary: 'Read file' }
  }

  if (name === 'bash' && typeof input?.command === 'string') {
    if (ok === false) {
      return { title: `Ran ${input.command}`, summary: error || 'failed' }
    }

    if (typeof output === 'string' && output.split('\n').length > 3) {
      return {
        title: `Ran ${input.command}`,
        summary: `...+${output.split('\n').length - 1} lines`,
      }
    }

    return {
      title: `Ran ${input.command}`,
      summary: typeof output === 'string' && output ? output : 'completed',
    }
  }

  return {
    title: `${name}${typeof input?.path === 'string' ? ` ${input.path}` : ''}`.trim(),
    summary: ok === false ? error || 'failed' : 'completed',
  }
}
```

```ts
// src/ui/events/projectRenderableItems.ts
import type { EventRecord } from '../../core/contracts'
import type { RenderableItem } from '../messages/types'
import { projectToolStep } from '../messages/toolProjection'

export function projectEventsToRenderableItems(
  events: EventRecord[],
): RenderableItem[] {
  const items: RenderableItem[] = []
  const toolStepIndex = new Map<string, number>()
  const pendingToolCalls = new Map<
    string,
    {
      name: string
      input: Record<string, unknown>
      timestamp: string
    }
  >()

  for (const event of events) {
    if (event.type === 'user_message' && typeof event.payload.text === 'string') {
      items.push({
        id: event.id,
        kind: 'user',
        text: event.payload.text,
        timestamp: event.timestamp,
      })
      continue
    }

    if (event.type === 'assistant_text' && typeof event.payload.text === 'string') {
      items.push({
        id: event.id,
        kind: 'assistant',
        text: event.payload.text,
        timestamp: event.timestamp,
      })
      continue
    }

    if (event.type === 'system_status') {
      items.push({
        id: event.id,
        kind: 'system',
        level: event.payload.level,
        message: `${event.payload.stage}: ${event.payload.reason} - ${event.payload.message}`,
        timestamp: event.timestamp,
      })
      continue
    }

    if (event.type === 'tool_call') {
      pendingToolCalls.set(event.payload.toolCallId, {
        name: event.payload.name,
        input: event.payload.input,
        timestamp: event.timestamp,
      })

      const projected = projectToolStep({
        name: event.payload.name,
        input: event.payload.input,
      })

      items.push({
        id: event.payload.toolCallId,
        kind: 'tool_step',
        toolName: event.payload.name,
        title: projected.title,
        status: 'running',
        summary: 'running',
        timestamp: event.timestamp,
      })
      toolStepIndex.set(event.payload.toolCallId, items.length - 1)
      continue
    }

    if (event.type === 'tool_result') {
      const pending = pendingToolCalls.get(event.payload.toolCallId)
      const itemIndex = toolStepIndex.get(event.payload.toolCallId)
      const projected = projectToolStep({
        name: event.payload.name,
        input: pending?.input,
        ok: event.payload.ok,
        output: event.payload.output,
        error: event.payload.error,
      })

      const nextItem: RenderableItem = {
        id: event.payload.toolCallId,
        kind: 'tool_step',
        toolName: event.payload.name,
        title: projected.title,
        status: event.payload.ok ? 'ok' : 'error',
        summary: projected.summary,
        timestamp: pending?.timestamp ?? event.timestamp,
      }

      if (typeof itemIndex === 'number') {
        items[itemIndex] = nextItem
      } else {
        items.push(nextItem)
      }
      continue
    }
  }

  return items
}
```

- [ ] **Step 4: Run the projection tests to verify they pass**

Run: `npm test -- test/ui-event-projection.test.ts`
Expected: PASS with 2 tests passed

- [ ] **Step 5: Commit the projection layer**

```bash
git add src/ui/events/projectRenderableItems.ts src/ui/messages/toolProjection.ts src/ui/messages/types.ts src/ui/App.tsx test/ui-event-projection.test.ts
git commit -m "feat(ui): project runtime events into tool steps"
```

### Task 2: Replace Direct Tool Event Rows with Tool Step Blocks

**Files:**
- Create: `src/ui/messages/ToolStepMessage.tsx`
- Modify: `src/ui/messages/MessageRow.tsx`
- Modify: `src/ui/messages/MessageList.tsx`
- Delete: `src/ui/messages/ToolCallMessage.tsx`
- Delete: `src/ui/messages/ToolResultMessage.tsx`
- Test: `test/message-list.test.tsx`

- [ ] **Step 1: Write the failing message rendering tests**

```tsx
import React from 'react'
import { render } from 'ink-testing-library'
import { describe, expect, it } from 'vitest'
import { MessageList } from '../src/ui/messages/MessageList'
import type { RenderableItem } from '../src/ui/messages/types'

describe('MessageList', () => {
  it('renders one tool step block instead of separate call/result rows', () => {
    const messages: RenderableItem[] = [
      {
        id: 'step-1',
        kind: 'tool_step',
        toolName: 'read',
        title: 'Read package.json',
        status: 'ok',
        summary: 'Read file',
        timestamp: '2026-04-11T00:00:00.000Z',
      },
    ]

    const { lastFrame } = render(
      <MessageList messages={messages} isLoading={false} />,
    )

    expect(lastFrame()).toContain('Read package.json')
    expect(lastFrame()).toContain('ok')
    expect(lastFrame()).toContain('Read file')
    expect(lastFrame()).not.toContain('(package.json)')
    expect(lastFrame()).not.toContain('⎿')
  })
})
```

- [ ] **Step 2: Run the message rendering tests to verify they fail**

Run: `npm test -- test/message-list.test.tsx`
Expected: FAIL because `tool_step` is not rendered yet

- [ ] **Step 3: Add the new step block component and wire it into the list**

```tsx
// src/ui/messages/ToolStepMessage.tsx
import React from 'react'
import { Box, Text } from 'ink'
import { ToolUseDot } from '../claudeChrome/ToolUseDot'
import type { RenderableItem } from './types'

type Props = {
  message: Extract<RenderableItem, { kind: 'tool_step' }>
}

export function ToolStepMessage({ message }: Props) {
  const dotStatus =
    message.status === 'ok'
      ? 'success'
      : message.status === 'error'
        ? 'error'
        : 'running'

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box flexDirection="row">
        <ToolUseDot status={dotStatus} />
        <Text bold>{message.title}</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text color={message.status === 'error' ? 'red' : 'gray'}>
          {message.status}
          <Text color="gray">  {message.summary}</Text>
        </Text>
      </Box>
    </Box>
  )
}
```

```tsx
// src/ui/messages/MessageRow.tsx
import { ToolStepMessage } from './ToolStepMessage'

export function MessageRow({ message }: Props) {
  return (
    <Box flexDirection="column" marginTop={1}>
      {message.kind === 'user' ? <UserMessage message={message} /> : null}
      {message.kind === 'assistant' ? <AssistantMessage message={message} /> : null}
      {message.kind === 'tool_step' ? <ToolStepMessage message={message} /> : null}
      {message.kind === 'system' ? <SystemStatusMessage message={message} /> : null}
    </Box>
  )
}
```

```tsx
// src/ui/messages/MessageList.tsx
type Props = {
  messages: RenderableItem[]
  isLoading: boolean
}
```

- [ ] **Step 4: Run the rendering tests to verify they pass**

Run: `npm test -- test/message-list.test.tsx`
Expected: PASS with the tool step block visible as one unit

- [ ] **Step 5: Commit the step block rendering**

```bash
git add src/ui/messages/ToolStepMessage.tsx src/ui/messages/MessageRow.tsx src/ui/messages/MessageList.tsx src/ui/messages/types.ts test/message-list.test.tsx
git rm src/ui/messages/ToolCallMessage.tsx src/ui/messages/ToolResultMessage.tsx
git commit -m "feat(ui): render tool activity as step blocks"
```

### Task 3: Align the Outer Shell with Claude Code While Preserving Accorda Status Semantics

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/components/Header.tsx`
- Modify: `src/ui/components/RuntimeStatus.tsx`
- Modify: `src/ui/components/PromptInput.tsx`
- Modify: `src/ui/claudeChrome/ClaudeWelcome.tsx`
- Test: `test/interactive-app.test.tsx`

- [ ] **Step 1: Write the failing app-level shell test**

```tsx
import React from 'react'
import { render } from 'ink-testing-library'
import { describe, expect, it } from 'vitest'
import { App } from '../src/ui/App'

describe('interactive app', () => {
  it('shows the Claude-like shell with Accorda status lines and tool steps', async () => {
    const { stdin, lastFrame } = render(<App onSubmit={async () => []} />)

    stdin.write('hello')
    stdin.write('\n')

    await new Promise(resolve => setTimeout(resolve, 50))

    expect(lastFrame()).toContain('Accorda Code')
    expect(lastFrame()).toContain('Recent activity')
    expect(lastFrame()).toContain('status:')
    expect(lastFrame()).toContain('Ask Accorda to work on this codebase')
  })
})
```

- [ ] **Step 2: Run the app-level shell test to verify it fails**

Run: `npm test -- test/interactive-app.test.tsx`
Expected: FAIL because the current shell does not contain the new Claude-like headings and layout

- [ ] **Step 3: Update the header, runtime status, prompt area, and layout**

```tsx
// src/ui/claudeChrome/ClaudeWelcome.tsx
export function ClaudeWelcome({ version = 'v0.1.0', model }: Props) {
  return (
    <Box flexDirection="column" width={88} marginBottom={1}>
      <Text color="hex('#e36d3f')">Accorda Code {version}</Text>
      <Box borderStyle="round" borderColor="hex('#e36d3f')" paddingX={1}>
        <Box width="50%" flexDirection="column">
          <Text bold>Welcome back!</Text>
          <Text color="gray">Accorda logo / workspace summary</Text>
        </Box>
        <Box width="50%" flexDirection="column">
          <Text color="hex('#e36d3f')">Tips for getting started</Text>
          <Text color="gray">Try "read package.json" or "summarize this repo"</Text>
          <Text color="hex('#e36d3f')">Recent activity</Text>
          <Text color="gray">No recent activity</Text>
        </Box>
      </Box>
    </Box>
  )
}
```

```tsx
// src/ui/components/RuntimeStatus.tsx
export function RuntimeStatus({ status }: Props) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={colorForLevel(status.level)}>
        status: {status.stage}
        <Text color="gray"> · {status.reason}</Text>
      </Text>
      <Text color="gray">
        message: {status.message}
        {status.source ? ` · source: ${status.source}` : ''}
      </Text>
    </Box>
  )
}
```

```tsx
// src/ui/components/PromptInput.tsx
return (
  <Box flexDirection="column" marginTop={1}>
    <Box borderStyle="single" borderColor={isLoading ? 'yellow' : 'gray'}>
      <Text color="gray">{isLoading ? 'Working…' : value || 'Try "create a util logging.py that..."'}</Text>
    </Box>
  </Box>
)
```

```tsx
// src/ui/App.tsx
return (
  <Box flexDirection="column" padding={1}>
    <Header sessionId="local" runtimeStatus={runtimeStatus} />
    <Box marginTop={1} flexDirection="column">
      <MessageList messages={messages} isLoading={isLoading} />
    </Box>
    <PromptInput
      value={input}
      isLoading={isLoading}
      onChange={setInput}
      onSubmit={handleSubmit}
    />
  </Box>
)
```

- [ ] **Step 4: Run the shell tests to verify they pass**

Run: `npm test -- test/interactive-app.test.tsx`
Expected: PASS with updated shell text, status lines, and message flow

- [ ] **Step 5: Commit the shell alignment**

```bash
git add src/ui/App.tsx src/ui/components/Header.tsx src/ui/components/RuntimeStatus.tsx src/ui/components/PromptInput.tsx src/ui/claudeChrome/ClaudeWelcome.tsx test/interactive-app.test.tsx
git commit -m "feat(ui): align shell with transparent runtime flow"
```

### Task 4: Run Full UI Verification

**Files:**
- Test: `test/ui-event-projection.test.ts`
- Test: `test/message-list.test.tsx`
- Test: `test/interactive-app.test.tsx`

- [ ] **Step 1: Run focused UI tests**

Run: `npm test -- test/ui-event-projection.test.ts test/message-list.test.tsx test/interactive-app.test.tsx`
Expected: PASS with all UI projection and shell tests green

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS with all existing runtime and UI tests green

- [ ] **Step 3: Smoke the TUI once**

Run: `npm run dev`
Expected: TUI starts, shows the new welcome shell, accepts input, and renders tool activity as single step blocks

- [ ] **Step 4: Review git status**

Run: `git status --short`
Expected: no unexpected files; only intended UI source and test changes remain

- [ ] **Step 5: Commit the verification pass**

```bash
git add src/ui test
git commit -m "test(ui): verify transparent runtime tui"
```
