# Architecture

**Analysis Date:** 2026-04-11

## Pattern Overview

**Overall:** Event-oriented terminal application with a two-stage runtime skeleton

**Key Characteristics:**
- User input becomes `EventRecord` items and is projected into renderable UI messages
- Runtime concerns are split between a stage-one decision layer and a stage-two execution layer
- Persistence, permissions, tools, and provider access are separated into small focused modules

## Layers

**CLI Entry Layer:**
- Purpose: Boot the terminal app
- Location: `src/index.tsx`
- Contains: `main()` and Ink `render(...)`
- Depends on: `src/ui/App.tsx`
- Used by: `npm run dev`

**UI Layer:**
- Purpose: Capture input and render transcript chrome
- Location: `src/ui/`
- Contains: `App`, prompt/input components, message renderers, event projection helpers
- Depends on: `src/runtime/defaultRunner.ts`, `src/core/contracts.ts`
- Used by: `src/index.tsx`

**Runtime Layer:**
- Purpose: Decide whether to answer directly or enter tool execution
- Location: `src/runtime/`
- Contains: engine contracts, `createRuntimeEngine`, and `runLocalTurn`
- Depends on: `src/core/config.ts`, `src/provider/openaiClient.ts`
- Used by: `src/ui/App.tsx`

**Provider Layer:**
- Purpose: Talk to the configured LLM endpoint
- Location: `src/provider/openaiClient.ts`
- Contains: OpenAI-compatible client creation and chat completion call
- Depends on: `openai`, `src/core/config.ts`
- Used by: `src/runtime/defaultRunner.ts`

**Persistence Layer:**
- Purpose: Persist and reload local runtime artifacts
- Location: `src/store/`
- Contains: JSONL event log store, session meta store, transient runtime state factory
- Depends on: Node filesystem APIs and `src/core/contracts.ts`
- Used by: tests today; not fully wired into the main app flow yet

## Data Flow

**Interactive Turn Flow:**

1. `src/ui/components/PromptInput.tsx` captures stdin and passes text to `src/ui/App.tsx`
2. `src/ui/App.tsx` calls `runLocalTurn('local', text)` from `src/runtime/defaultRunner.ts`
3. `src/runtime/defaultRunner.ts` creates a runtime engine and invokes stage one
4. Stage one tries the provider through `src/provider/openaiClient.ts` and returns an answer or fallback echo text
5. Returned `EventRecord[]` is appended to React state and projected by `src/ui/events/projectEvents.ts`
6. `src/ui/messages/MessageList.tsx` renders user, assistant, tool, and system rows

**State Management:**
- UI session state lives in React state inside `src/ui/App.tsx`
- Durable history is designed around `EventRecord` and `SessionMeta` in `src/core/contracts.ts`
- `src/store/runtimeState.ts` defines transient runtime state but is not yet integrated into the main turn loop

## Key Abstractions

**EventRecord:**
- Purpose: Canonical append-only record for user messages, tool calls, tool results, assistant text, and system status
- Examples: `src/core/contracts.ts`, `src/ui/events/projectEvents.ts`
- Pattern: Event log / projection model

**Runtime Engine:**
- Purpose: Coordinate stage-one vs stage-two turn handling
- Examples: `src/runtime/engine.ts`, `src/runtime/stageOne.ts`, `src/runtime/stageTwo.ts`
- Pattern: Dependency-injected orchestrator

**RenderableMessage:**
- Purpose: UI-safe projection of raw events into display variants
- Examples: `src/ui/messages/types.ts`, `src/ui/events/projectEvents.ts`
- Pattern: View-model translation layer

## Entry Points

**CLI boot:**
- Location: `src/index.tsx`
- Triggers: `npm run dev`
- Responsibilities: Start Ink rendering with `<App />`

**Turn execution:**
- Location: `src/runtime/defaultRunner.ts`
- Triggers: Prompt submit from `src/ui/App.tsx`
- Responsibilities: Build event list, call provider-backed stage one, and package assistant output

**UI projection:**
- Location: `src/ui/events/projectEvents.ts`
- Triggers: Event state updates in `src/ui/App.tsx`
- Responsibilities: Validate payload shapes and convert events to renderable message variants

## Error Handling

**Strategy:** Mix of fail-fast config validation and permissive fallback behavior

**Patterns:**
- `src/core/config.ts` throws when required provider env vars are missing
- `src/runtime/defaultRunner.ts` catches provider/config failures and falls back to `echo: ${text}`
- `src/store/eventLogStore.ts` and `src/store/sessionMetaStore.ts` swallow read failures and return empty defaults
- `src/ui/events/projectEvents.ts` converts malformed events into warning messages instead of crashing the renderer

## Cross-Cutting Concerns

**Logging:** Local event persistence exists in `src/store/eventLogStore.ts`, but the main app path does not currently append runtime events to disk  
**Validation:** TypeScript strict mode plus runtime payload guards in `src/ui/events/projectEvents.ts`  
**Authentication:** Provider API key only; no user/session auth layer

---

*Architecture analysis: 2026-04-11*
