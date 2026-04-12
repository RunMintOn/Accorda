# Input Shell And Slash Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the TUI input area visibly editable at all times and add immediate slash-command feedback through a lightweight helper panel.

**Architecture:** Keep the existing Stage 5 command semantics and input state, but separate the bottom shell into two render layers: a real input line and a contextual helper panel. Reuse the existing command registry and resume flow, and add only the minimum UI state needed to render `empty`, `editing`, `command_mode`, and `resume_select` clearly.

**Tech Stack:** TypeScript, React, Ink, Vitest, ink-testing-library

---

## File Structure

- `src/ui/components/PromptInput.tsx`
  Renders the prompt marker, visible cursor, and the lower helper panel.
- `src/ui/tuiCommands.ts`
  Gains a small slash-candidate helper derived from the existing command definitions.
- `src/commands/registry.ts`
  Remains the source of truth for slash command names and descriptions.
- `src/ui/App.tsx`
  Supplies the UI state needed by the input shell, including slash mode and resume-select mode.
- `test/prompt-input.test.tsx`
  Covers visual shell states directly.
- `test/tui-commands.test.ts`
  Covers slash candidate filtering.
- `test/interactive-app.test.tsx`
  Keeps a thin integration test for the visible input line.

---

### Task 1: Add Visible Input-Shell States

**Files:**
- Create: `test/prompt-input.test.tsx`
- Modify: `src/ui/components/PromptInput.tsx`

- [ ] **Step 1: Write the failing input-shell rendering tests**

```tsx
import React from 'react'
import { render } from 'ink-testing-library'
import { describe, expect, it } from 'vitest'
import { PromptInput } from '../src/ui/components/PromptInput'

describe('PromptInput', () => {
  it('shows a visible cursor even when the input is empty', () => {
    const { lastFrame } = render(
      <PromptInput value="" cursor={0} isLoading={false} mode="compose" />,
    )

    expect(lastFrame()).toContain('> |')
    expect(lastFrame()).not.toContain('Try "create a util logging.py that..."')
  })

  it('shows the cursor at the current editing position', () => {
    const { lastFrame } = render(
      <PromptInput
        value="read package"
        cursor={4}
        isLoading={false}
        mode="compose"
      />,
    )

    expect(lastFrame()).toContain('> read| package')
  })
})
```

- [ ] **Step 2: Run the prompt-input tests to verify they fail**

Run: `npm test -- test/prompt-input.test.tsx`
Expected: FAIL because the empty state still renders hint text instead of a visible prompt and cursor

- [ ] **Step 3: Update the input line to render a prompt marker and visible cursor**

```tsx
// src/ui/components/PromptInput.tsx
function renderInputLine(value: string, cursor: number) {
  const content = `${value.slice(0, cursor)}|${value.slice(cursor)}`
  return `> ${content}`
}

export function PromptInput({
  value,
  cursor,
  isLoading,
  mode = 'compose',
}: Props) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="single" borderColor={isLoading ? 'yellow' : 'gray'} width="100%">
        <Text>{isLoading ? '> Working...' : renderInputLine(value, cursor)}</Text>
      </Box>
      <Box paddingX={1}>
        <Text color="gray">Enter: newline · Ctrl+Enter: submit · ctrl+c to exit</Text>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Run the prompt-input tests to verify they pass**

Run: `npm test -- test/prompt-input.test.tsx`
Expected: PASS with the empty and editing cursor states visible

- [ ] **Step 5: Commit the visible input shell**

```bash
git add src/ui/components/PromptInput.tsx test/prompt-input.test.tsx
git commit -m "feat(ui): make input shell visibly editable"
```

### Task 2: Add Lightweight Slash Candidates

**Files:**
- Modify: `src/ui/tuiCommands.ts`
- Test: `test/tui-commands.test.ts`

- [ ] **Step 1: Extend the TUI command tests with slash-candidate filtering**

```ts
it('returns slash candidates immediately when input starts with slash text', () => {
  expect(matchSlashCommands('/')).toEqual([
    { name: 'new', description: 'start a new session' },
    { name: 'resume', description: 'resume a recent session' },
    { name: 'help', description: 'show available commands' },
  ])

  expect(matchSlashCommands('/re')).toEqual([
    { name: 'resume', description: 'resume a recent session' },
  ])
})
```

- [ ] **Step 2: Run the TUI command tests to verify they fail**

Run: `npm test -- test/tui-commands.test.ts`
Expected: FAIL because `matchSlashCommands` does not exist yet

- [ ] **Step 3: Add slash-candidate matching from the shared command registry**

```ts
// src/ui/tuiCommands.ts
import { COMMANDS } from '../commands/registry'

export type SlashCandidate = {
  name: string
  description: string
}

export function matchSlashCommands(input: string): SlashCandidate[] {
  if (!input.startsWith('/')) return []

  const query = input.slice(1).trim().toLowerCase()
  return COMMANDS.filter(command =>
    command.tuiSyntax.slice(1).startsWith(query),
  ).map(command => ({
    name: command.name,
    description: command.description,
  }))
}
```

- [ ] **Step 4: Run the TUI command tests to verify they pass**

Run: `npm test -- test/tui-commands.test.ts`
Expected: PASS with slash candidate filtering green

- [ ] **Step 5: Commit the slash-candidate helper**

```bash
git add src/ui/tuiCommands.ts test/tui-commands.test.ts
git commit -m "feat(ui): add slash command candidates"
```

### Task 3: Render The Helper Panel For Empty, Slash, And Resume States

**Files:**
- Modify: `src/ui/App.tsx`
- Modify: `src/ui/components/PromptInput.tsx`
- Modify: `test/interactive-app.test.tsx`
- Modify: `test/prompt-input.test.tsx`

- [ ] **Step 1: Add failing helper-panel tests**

```tsx
it('shows slash candidates below the input line in command mode', () => {
  const { lastFrame } = render(
    <PromptInput
      value="/re"
      cursor={3}
      isLoading={false}
      mode="command_mode"
      helperLines={['resume   resume a recent session']}
    />,
  )

  expect(lastFrame()).toContain('> /re|')
  expect(lastFrame()).toContain('resume   resume a recent session')
})

it('shows resume options in resume-select mode', () => {
  const { lastFrame } = render(
    <PromptInput
      value=""
      cursor={0}
      isLoading={false}
      mode="resume_select"
      helperLines={['1. resume-me  restore this one']}
    />,
  )

  expect(lastFrame()).toContain('1. resume-me  restore this one')
})
```

- [ ] **Step 2: Run the prompt-input and interactive tests to verify they fail**

Run: `npm test -- test/prompt-input.test.tsx test/interactive-app.test.tsx`
Expected: FAIL because `PromptInput` does not yet render a distinct helper panel

- [ ] **Step 3: Add helper-panel rendering to `PromptInput`**

```tsx
// src/ui/components/PromptInput.tsx
type PromptMode = 'compose' | 'command_mode' | 'resume_select'

type Props = {
  value: string
  cursor: number
  isLoading: boolean
  mode?: PromptMode
  helperLines?: string[]
}

function defaultHelper(mode: PromptMode): string[] {
  if (mode === 'resume_select') return ['Type a session number']
  return ['Try "read package.json" or start with / for commands']
}

export function PromptInput({
  value,
  cursor,
  isLoading,
  mode = 'compose',
  helperLines = defaultHelper(mode),
}: Props) {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="single" borderColor={isLoading ? 'yellow' : 'gray'} width="100%">
        <Text>{isLoading ? '> Working...' : renderInputLine(value, cursor)}</Text>
      </Box>
      <Box flexDirection="column" paddingX={1}>
        {helperLines.map((line, index) => (
          <Text key={index} color="gray">
            {line}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Feed the helper panel from `App`**

```tsx
// src/ui/App.tsx
const slashCandidates = React.useMemo(
  () => matchSlashCommands(inputState.value),
  [inputState.value],
)

const promptMode =
  mode.kind === 'resume_select'
    ? 'resume_select'
    : inputState.value.startsWith('/')
      ? 'command_mode'
      : 'compose'

const helperLines =
  promptMode === 'command_mode'
    ? slashCandidates.map(candidate =>
        `${candidate.name.padEnd(8, ' ')}${candidate.description}`,
      )
    : mode.kind === 'resume_select'
      ? mode.sessions.map(
          (session, index) => `${index + 1}. ${session.sessionId}  ${session.preview}`,
        )
      : ['Try "read package.json" or start with / for commands']

<PromptInput
  value={inputState.value}
  cursor={inputState.cursor}
  isLoading={isLoading}
  mode={promptMode}
  helperLines={helperLines}
/>
```

- [ ] **Step 5: Run the prompt-input and interactive tests to verify they pass**

Run: `npm test -- test/prompt-input.test.tsx test/interactive-app.test.tsx test/tui-commands.test.ts`
Expected: PASS with visible helper-panel behavior for empty, slash, and resume states

- [ ] **Step 6: Commit the helper panel integration**

```bash
git add src/ui/App.tsx src/ui/components/PromptInput.tsx src/ui/tuiCommands.ts test/prompt-input.test.tsx test/interactive-app.test.tsx test/tui-commands.test.ts
git commit -m "feat(ui): add slash helper panel"
```

### Task 4: Run Verification

**Files:**
- Test: `test/prompt-input.test.tsx`
- Test: `test/tui-commands.test.ts`
- Test: `test/interactive-app.test.tsx`

- [ ] **Step 1: Run focused input-shell tests**

Run: `npm test -- test/prompt-input.test.tsx test/tui-commands.test.ts test/interactive-app.test.tsx`
Expected: PASS with all input-shell and slash-panel tests green

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS with all runtime, CLI, and UI tests green

- [ ] **Step 3: Smoke the TUI**

Run: `npm run dev`
Expected: the empty input shows `> |`, slash input shows command candidates, and `/resume` shows session options in the helper panel

- [ ] **Step 4: Review git status**

Run: `git status --short`
Expected: no unexpected files; only intended UI source and test changes remain

- [ ] **Step 5: Commit the verification pass**

```bash
git add src/ui test
git commit -m "test(ui): verify input shell and slash panel"
```
