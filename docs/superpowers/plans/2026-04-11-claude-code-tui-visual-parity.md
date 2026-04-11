# Claude Code TUI Visual Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Accorda v1 的 TUI 第一眼视觉改到接近 Claude Code：启动欢迎区、底部输入框、消息/工具层级都按 Claude Code 的终端视觉协议重做。

**Architecture:** 只改 Accorda 的 TUI 表现层，不改 runtime、event log、provider、工具执行协议。参考 Claude Code 的组件边界：`WelcomeV2/LogoV2` 对应我们的 welcome chrome，`PromptInput/*` 对应输入框和 footer，`AssistantTextMessage/AssistantToolUseMessage/MessageResponse` 对应消息和工具输出。

**Tech Stack:** TypeScript, React 18, Ink 5, ink-testing-library, Vitest.

---

## 调研结论

Claude Code 的第一眼视觉不是普通聊天框，而是三套约定：

- 启动页：`24claude-code/src/components/LogoV2/WelcomeV2.tsx` 使用固定宽度 `58` 的 welcome/banner，标题行是 `Welcome to Claude Code v...`，下面是大面积点阵/块状 ASCII/Unicode 图形，不是普通 bordered header。
- 输入区：`24claude-code/src/components/PromptInput/PromptInput.tsx` 的主输入框是 `borderStyle="round"`，但 `borderLeft={false}`、`borderRight={false}`，只保留上下边框，并在左侧用 `PromptInputModeIndicator` 渲染 `❯`。footer 由 `PromptInputFooter` 和 `PromptInputFooterLeftSide` 负责，常态最小提示是 `? for shortcuts`。
- 消息区：`AssistantTextMessage.tsx` 用左侧 `BLACK_CIRCLE` 作为 assistant turn marker；`AssistantToolUseMessage.tsx` 用同一个点加粗显示工具名，并把工具摘要放到括号里；`MessageResponse.tsx` 用 `⎿` 表示工具结果/从属输出。
- 权限区：Claude Code 的 permission dialog 是临时 overlay，不是常驻 panel。Accorda 当前的 `Permission gate` 常驻显示会让第一眼更像普通后台面板，应在无请求时隐藏。

## 文件结构

- Create: `accorda/src/ui/claudeChrome/ClaudeWelcome.tsx`
- Create: `accorda/src/ui/claudeChrome/MessageResponse.tsx`
- Create: `accorda/src/ui/claudeChrome/ToolUseDot.tsx`
- Create: `accorda/src/ui/claudeChrome/path.ts`
- Modify: `accorda/src/ui/App.tsx`
- Modify: `accorda/src/ui/components/Header.tsx`
- Modify: `accorda/src/ui/components/PromptInput.tsx`
- Modify: `accorda/src/ui/components/StatusLine.tsx`
- Modify: `accorda/src/ui/components/PermissionDialog.tsx`
- Modify: `accorda/src/ui/messages/MessageList.tsx`
- Modify: `accorda/src/ui/messages/AssistantMessage.tsx`
- Modify: `accorda/src/ui/messages/UserMessage.tsx`
- Modify: `accorda/src/ui/messages/ToolCallMessage.tsx`
- Modify: `accorda/src/ui/messages/ToolResultMessage.tsx`
- Modify: `accorda/test/interactive-app.test.tsx`
- Modify: `accorda/test/message-list.test.tsx`

### Task 1: Claude-Style Welcome Chrome

**Files:**
- Create: `accorda/src/ui/claudeChrome/path.ts`
- Create: `accorda/src/ui/claudeChrome/ClaudeWelcome.tsx`
- Modify: `accorda/src/ui/components/Header.tsx`
- Test: `accorda/test/interactive-app.test.tsx`

- [ ] **Step 1: Write the failing test**

Replace the header assertions in `accorda/test/interactive-app.test.tsx` with:

```ts
expect(lastFrame()).toContain('Welcome to Accorda Code')
expect(lastFrame()).toContain('cwd:')
expect(lastFrame()).toContain('OpenAI compatible')
expect(lastFrame()).toContain('? for shortcuts')
expect(lastFrame()).not.toContain('OpenAI-compatible CLI agent')
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- interactive-app
```

Expected: FAIL because current TUI renders `Accorda` / `OpenAI-compatible CLI agent`, not Claude Code-style welcome chrome.

- [ ] **Step 3: Add path helper**

Create `accorda/src/ui/claudeChrome/path.ts`:

```ts
export function truncatePath(path: string, maxWidth = 46): string {
  if (path.length <= maxWidth) return path
  const keep = Math.max(8, maxWidth - 3)
  const left = Math.ceil(keep / 2)
  const right = Math.floor(keep / 2)
  return `${path.slice(0, left)}...${path.slice(path.length - right)}`
}
```

- [ ] **Step 4: Add Claude-style welcome component**

Create `accorda/src/ui/claudeChrome/ClaudeWelcome.tsx`:

```tsx
import React from 'react'
import { Box, Text } from 'ink'
import { cwd } from 'node:process'
import { truncatePath } from './path'

type Props = {
  version?: string
  model?: string
}

const WIDTH = 58
const ART_LINES = [
  '..........................................................',
  '     *                                       █████▓▓░     ',
  '                                 *         ███▓░     ░░   ',
  '            ░░░░░░                        ███▓░           ',
  '    ░░░   ░░░░░░░░░░                      ███▓░           ',
  '   ░░░░░░░░░░░░░░░░░    *                ██▓░░      ▓   ',
  '                                             ░▓▓███▓▓░    ',
  ' *                                 ░░░░                   ',
  '                                 ░░░░░░░░                 ',
  '      █████████                         *                 ',
  '      ██▄█████▄██                       *                 ',
  '      █████████      *                                    ',
  '.......█ █   █ █..........................................',
]

export function ClaudeWelcome({ version = 'v0.1.0', model }: Props) {
  const workspace = truncatePath(cwd())
  const modelLabel = model ?? process.env.OPENAI_MODEL ?? process.env.ACCORDA_MODEL ?? 'model from env'

  return (
    <Box flexDirection="column" width={WIDTH} marginBottom={1}>
      <Text>
        <Text color="green">Welcome to Accorda Code </Text>
        <Text dimColor>{version} </Text>
      </Text>
      {ART_LINES.map((line, index) => (
        <Text key={index} color={index % 3 === 0 ? 'gray' : undefined}>
          {line}
        </Text>
      ))}
      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Text dimColor>cwd: {workspace}</Text>
        <Text dimColor>provider: OpenAI compatible · {modelLabel}</Text>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 5: Replace Header with wrapper**

Modify `accorda/src/ui/components/Header.tsx` to delegate to the new component:

```tsx
import React from 'react'
import { ClaudeWelcome } from '../claudeChrome/ClaudeWelcome'

type Props = {
  sessionId: string
  model?: string
}

export function Header({ model }: Props) {
  return <ClaudeWelcome model={model} />
}
```

- [ ] **Step 6: Run test to verify it passes**

Run:

```bash
npm test -- interactive-app
```

Expected: PASS for `interactive-app`.

- [ ] **Step 7: Commit**

```bash
git add src/ui/claudeChrome/path.ts src/ui/claudeChrome/ClaudeWelcome.tsx src/ui/components/Header.tsx test/interactive-app.test.tsx
git commit -m "feat: add claude style welcome chrome"
```

### Task 2: Claude-Style Prompt And Footer

**Files:**
- Modify: `accorda/src/ui/components/PromptInput.tsx`
- Modify: `accorda/src/ui/components/StatusLine.tsx`
- Modify: `accorda/src/ui/App.tsx`
- Test: `accorda/test/interactive-app.test.tsx`

- [ ] **Step 1: Write the failing test**

In `accorda/test/interactive-app.test.tsx`, replace prompt/status assertions with:

```ts
expect(lastFrame()).toContain('❯')
expect(lastFrame()).toContain('? for shortcuts')
expect(lastFrame()).toContain('shift+tab to cycle mode')
expect(lastFrame()).toContain('ctrl+c to exit')
expect(lastFrame()).not.toContain('Ask Accorda. Press Enter to send.')
expect(lastFrame()).not.toContain('status ready')
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- interactive-app
```

Expected: FAIL because current prompt uses boxed `Ask Accorda...` and a separate `status ready` line.

- [ ] **Step 3: Update PromptInput**

Replace the return block in `accorda/src/ui/components/PromptInput.tsx` with:

```tsx
return (
  <Box flexDirection="column" marginTop={1}>
    <Box
      flexDirection="row"
      alignItems="flex-start"
      borderStyle="round"
      borderColor={isLoading ? 'yellow' : 'green'}
      borderLeft={false}
      borderRight={false}
      borderBottom
      width="100%"
    >
      <Text color="green" dimColor={isLoading}>
        {'❯ '}
      </Text>
      <Text color={value ? undefined : 'gray'}>
        {isLoading ? 'Thinking...' : value || 'Ask Accorda to work on this codebase'}
      </Text>
    </Box>
    <Box paddingX={2}>
      <Text color="gray">
        ? for shortcuts · shift+tab to cycle mode · ctrl+c to exit
      </Text>
    </Box>
  </Box>
)
```

- [ ] **Step 4: Remove separate status row from App**

In `accorda/src/ui/App.tsx`, delete the `StatusLine` import and delete this block:

```tsx
<Box>
  <StatusLine
    isLoading={isLoading}
    hasPendingPermission={pendingPermissionRequest !== null}
  />
</Box>
```

- [ ] **Step 5: Keep StatusLine available but Claude-like**

Replace `accorda/src/ui/components/StatusLine.tsx` with a non-panel footer-compatible component:

```tsx
import React from 'react'
import { Text } from 'ink'

type Props = {
  isLoading: boolean
  hasPendingPermission: boolean
}

export function StatusLine({ isLoading, hasPendingPermission }: Props) {
  if (hasPendingPermission) return <Text color="yellow">waiting for permission</Text>
  if (isLoading) return <Text color="gray">esc to interrupt</Text>
  return <Text color="gray">? for shortcuts</Text>
}
```

- [ ] **Step 6: Run test to verify it passes**

Run:

```bash
npm test -- interactive-app
```

Expected: PASS for `interactive-app`.

- [ ] **Step 7: Commit**

```bash
git add src/ui/components/PromptInput.tsx src/ui/components/StatusLine.tsx src/ui/App.tsx test/interactive-app.test.tsx
git commit -m "feat: align prompt chrome with claude code"
```

### Task 3: Claude-Style Message And Tool Rendering

**Files:**
- Create: `accorda/src/ui/claudeChrome/MessageResponse.tsx`
- Create: `accorda/src/ui/claudeChrome/ToolUseDot.tsx`
- Modify: `accorda/src/ui/messages/MessageList.tsx`
- Modify: `accorda/src/ui/messages/AssistantMessage.tsx`
- Modify: `accorda/src/ui/messages/UserMessage.tsx`
- Modify: `accorda/src/ui/messages/ToolCallMessage.tsx`
- Modify: `accorda/src/ui/messages/ToolResultMessage.tsx`
- Test: `accorda/test/message-list.test.tsx`
- Test: `accorda/test/interactive-app.test.tsx`

- [ ] **Step 1: Write the failing message-list test**

Replace the rendering assertions in `accorda/test/message-list.test.tsx` with:

```ts
expect(lastFrame()).toContain('> read package')
expect(lastFrame()).toContain('● read')
expect(lastFrame()).toContain('(package.json)')
expect(lastFrame()).toContain('⎿  ok')
expect(lastFrame()).toContain('● package read')
expect(lastFrame()).not.toContain('Tool read')
expect(lastFrame()).not.toContain('Done read')
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- message-list
```

Expected: FAIL because current output uses `Tool read`, `Done read`, boxed message list.

- [ ] **Step 3: Add ToolUseDot**

Create `accorda/src/ui/claudeChrome/ToolUseDot.tsx`:

```tsx
import React from 'react'
import { Text } from 'ink'

type Props = {
  status?: 'running' | 'success' | 'error'
}

export function ToolUseDot({ status = 'success' }: Props) {
  const color = status === 'error' ? 'red' : status === 'running' ? undefined : 'green'
  return (
    <Text color={color} dimColor={status === 'running'}>
      ●{' '}
    </Text>
  )
}
```

- [ ] **Step 4: Add MessageResponse**

Create `accorda/src/ui/claudeChrome/MessageResponse.tsx`:

```tsx
import React from 'react'
import { Box, Text } from 'ink'

type Props = {
  children: React.ReactNode
}

export function MessageResponse({ children }: Props) {
  return (
    <Box flexDirection="row" marginLeft={2}>
      <Text color="gray">{'⎿  '}</Text>
      <Box flexShrink={1}>{children}</Box>
    </Box>
  )
}
```

- [ ] **Step 5: Remove boxed message panel**

Update `accorda/src/ui/messages/MessageList.tsx` so the root is unbordered:

```tsx
return (
  <Box flexDirection="column">
    {messages.length === 0 ? (
      <Box flexDirection="column" paddingLeft={2}>
        <Text color="gray">Try "summarize this repo" or "read package.json".</Text>
      </Box>
    ) : (
      messages.map(message => <MessageRow key={message.id} message={message} />)
    )}
    {isLoading ? (
      <Box marginTop={1}>
        <Text color="gray">● Thinking...</Text>
      </Box>
    ) : null}
  </Box>
)
```

- [ ] **Step 6: Update assistant messages**

Replace `accorda/src/ui/messages/AssistantMessage.tsx` render with:

```tsx
return (
  <Box flexDirection="row" marginTop={1}>
    <ToolUseDot />
    <Text>{message.text}</Text>
  </Box>
)
```

Add import:

```ts
import { ToolUseDot } from '../claudeChrome/ToolUseDot'
```

- [ ] **Step 7: Update user messages**

Replace `accorda/src/ui/messages/UserMessage.tsx` render with:

```tsx
return (
  <Box flexDirection="row" marginTop={1}>
    <Text color="gray">{'> '}</Text>
    <Text bold>{message.text}</Text>
  </Box>
)
```

- [ ] **Step 8: Update tool call messages**

In `accorda/src/ui/messages/ToolCallMessage.tsx`, add this helper:

```ts
function renderSummary(name: string, input: unknown): string {
  if (input && typeof input === 'object' && 'path' in input) {
    return String((input as { path: unknown }).path)
  }
  if (input && typeof input === 'object' && 'command' in input) {
    return String((input as { command: unknown }).command)
  }
  return compactJson(input)
}
```

Replace the render with:

```tsx
return (
  <Box flexDirection="row" marginTop={1}>
    <ToolUseDot status="running" />
    <Text bold>{message.name}</Text>
    <Text color="gray">({renderSummary(message.name, message.input)})</Text>
  </Box>
)
```

Add import:

```ts
import { ToolUseDot } from '../claudeChrome/ToolUseDot'
```

- [ ] **Step 9: Update tool result messages**

Replace `accorda/src/ui/messages/ToolResultMessage.tsx` render with:

```tsx
return (
  <MessageResponse>
    <Text color={message.ok ? 'gray' : 'red'}>
      {content || (message.ok ? `${message.name} completed` : `${message.name} failed`)}
    </Text>
  </MessageResponse>
)
```

Add import:

```ts
import { MessageResponse } from '../claudeChrome/MessageResponse'
```

- [ ] **Step 10: Update interactive test tool assertions**

In `accorda/test/interactive-app.test.tsx`, replace:

```ts
expect(lastFrame()).toContain('Tool read')
expect(lastFrame()).toContain('read')
expect(lastFrame()).toContain('package.json')
```

with:

```ts
expect(lastFrame()).toContain('● read')
expect(lastFrame()).toContain('(package.json)')
expect(lastFrame()).toContain('⎿  package.json')
```

- [ ] **Step 11: Run tests to verify they pass**

Run:

```bash
npm test -- message-list interactive-app
```

Expected: PASS for `message-list` and `interactive-app`.

- [ ] **Step 12: Commit**

```bash
git add src/ui/claudeChrome/MessageResponse.tsx src/ui/claudeChrome/ToolUseDot.tsx src/ui/messages/MessageList.tsx src/ui/messages/AssistantMessage.tsx src/ui/messages/UserMessage.tsx src/ui/messages/ToolCallMessage.tsx src/ui/messages/ToolResultMessage.tsx test/message-list.test.tsx test/interactive-app.test.tsx
git commit -m "feat: render messages like claude code"
```

### Task 4: Hide Idle Permission Panel

**Files:**
- Modify: `accorda/src/ui/components/PermissionDialog.tsx`
- Modify: `accorda/src/ui/App.tsx`
- Test: `accorda/test/interactive-app.test.tsx`

- [ ] **Step 1: Write the failing test**

In `accorda/test/interactive-app.test.tsx`, replace the idle permission assertions with:

```ts
expect(lastFrame()).not.toContain('Permission gate')
expect(lastFrame()).not.toContain('No pending permission request.')
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- interactive-app
```

Expected: FAIL because current TUI shows a constant `Permission gate` panel.

- [ ] **Step 3: Hide idle permission UI**

In `accorda/src/ui/components/PermissionDialog.tsx`, make the component return `null` when no request exists:

```tsx
if (!pendingRequest) {
  return null
}
```

Keep the existing pending-request border content for future permission flow.

- [ ] **Step 4: Remove redundant wrapper from App**

In `accorda/src/ui/App.tsx`, replace:

```tsx
<Box flexDirection="column">
  <PermissionDialog pendingRequest={pendingPermissionRequest} />
</Box>
```

with:

```tsx
<PermissionDialog pendingRequest={pendingPermissionRequest} />
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
npm test -- interactive-app
```

Expected: PASS for `interactive-app`.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/PermissionDialog.tsx src/ui/App.tsx test/interactive-app.test.tsx
git commit -m "feat: hide idle permission panel"
```

### Task 5: Manual Visual Verification

**Files:**
- Modify: `accorda/docs/superpowers/plans/2026-04-11-claude-code-tui-visual-parity.md`
- Test: terminal run output

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: all Vitest test files pass.

- [ ] **Step 2: Start the TUI**

Run:

```bash
npm run dev
```

Expected first screen:

```text
Welcome to Accorda Code v0.1.0
..........................................................
     *                                       █████▓▓░
...
cwd: /home/.../accorda
provider: OpenAI compatible · model from env

Try "summarize this repo" or "read package.json".

──────────────────────────────────────────────
❯ Ask Accorda to work on this codebase
──────────────────────────────────────────────
? for shortcuts · shift+tab to cycle mode · ctrl+c to exit
```

- [ ] **Step 3: Submit a sample message**

While `npm run dev` is active, type:

```text
hello
```

Then press Enter.

Expected post-submit shape:

```text
> hello
● echo: hello
──────────────────────────────────────────────
❯ Ask Accorda to work on this codebase
──────────────────────────────────────────────
? for shortcuts · shift+tab to cycle mode · ctrl+c to exit
```

- [ ] **Step 4: Stop the TUI**

Press:

```text
ctrl+c
```

Expected: process exits cleanly.

- [ ] **Step 5: Commit plan/test verification note if changed**

If the expected first screen differs because Ink renders borders at the terminal width, update the expected sample in this plan to match the real output and commit:

```bash
git add docs/superpowers/plans/2026-04-11-claude-code-tui-visual-parity.md
git commit -m "docs: record claude style tui verification"
```

## Self-Review

- Spec coverage: covers startup welcome, prompt/footer, message/tool rendering, permission idle state, tests, and manual visual run.
- Placeholder scan: no implementation placeholders left; each task has exact files, assertions, code snippets, commands, and expected results.
- Type consistency: new imports use `../claudeChrome/*` from `src/ui/messages/*` and `./path` from `src/ui/claudeChrome/*`; test strings match the snippets above.
- Scope check: plan intentionally excludes runtime/provider/tool execution changes. This is a visual parity pass only.
