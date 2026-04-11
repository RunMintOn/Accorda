<!-- GSD:project-start source:PROJECT.md -->
## Project

**Accorda**

Accorda is a terminal-first agent runtime and coding assistant being built as a cleaner, more transparent alternative to the kinds of systems represented by OpenClaw and Claude Code. The long-term direction is an OpenClaw-like assistant with channels and gateways, but v1 is deliberately narrower: a CLI experience where users can clearly see intent routing, tool use, permissions, runtime state, and recovery behavior.

The product is meant for people who can use a terminal but do not want to learn a maze of agent configuration. The guiding idea is simple structure, visible execution, and a runtime that feels understandable instead of magical.

**Core Value:** Users can see and trust what the runtime is doing without having to learn or manage a pile of hidden configuration.

### Constraints

- **Tech stack**: Keep the current TypeScript + React + Ink CLI stack for v1 — it already matches the present codebase and supports terminal-first iteration
- **Runtime focus**: CLI before channels — the runtime contract must be clear before Telegram/gateway work begins
- **Provider boundary**: Keep provider integration separate from runtime logic — avoids the coupling that makes larger systems harder to reason about
- **Simplicity**: Prefer the simplest design that preserves transparency — unnecessary features or config layers are a product regression
- **Reliability**: Surface runtime state and failure modes explicitly — hidden behavior is unacceptable for the intended product direction
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.8.3 - All application code under `src/` and tests under `test/`
- TSX via React JSX runtime - Terminal UI components in `src/ui/` and entrypoint `src/index.tsx`
- Markdown - Project notes and implementation plans in `README.md` and `docs/superpowers/plans/2026-04-11-claude-code-tui-visual-parity.md`
## Runtime
- Node.js ESM runtime - Configured by `package.json` (`"type": "module"`) and `tsconfig.json` (`"module": "NodeNext"`)
- npm - Scripts defined in `package.json`
- Lockfile: present in `package-lock.json`
## Frameworks
- React 18.3.1 - Component model for the terminal UI in `src/ui/App.tsx` and `src/ui/components/*.tsx`
- Ink 5.1.0 - Terminal rendering primitives such as `render`, `Box`, `Text`, and `useStdin` in `src/index.tsx` and `src/ui/components/PromptInput.tsx`
- OpenAI SDK 4.104.0 - OpenAI-compatible chat completion client in `src/provider/openaiClient.ts`
- Vitest 3.1.4 - Test runner and assertions configured in `vitest.config.ts`
- ink-testing-library 4.0.0 - Terminal UI rendering tests in `test/interactive-app.test.tsx` and `test/message-list.test.tsx`
- tsx 4.19.2 - Local execution for `npm run dev` via `tsx src/index.tsx`
- TypeScript compiler 5.8.3 - Static typing and JSX compilation via `tsconfig.json`
## Key Dependencies
- `ink` - Core CLI UI surface and input handling in `src/ui/`
- `react` - State and render model for the CLI shell in `src/ui/App.tsx`
- `openai` - Provider client used by `src/runtime/defaultRunner.ts`
- `zod` - Installed in `package.json` but not yet used by the checked-in source
- `@types/node` and `@types/react` - Type definitions for runtime and UI code
## Configuration
- `src/core/config.ts` requires `CONTEXTA_BASE_URL`, `CONTEXTA_API_KEY`, and `CONTEXTA_MODEL`
- Workspace root is inferred from `process.cwd()` in `src/core/config.ts`
- `package.json` defines `dev`, `test`, and `test:watch`
- `tsconfig.json` enables `strict` mode, `react-jsx`, and `NodeNext`
- `vitest.config.ts` sets the test environment to `node`
## Platform Requirements
- Node.js environment capable of ESM + TSX execution
- Interactive terminal stdin support for Ink input in `src/ui/components/PromptInput.tsx`
- Writable local filesystem for append-only event logs in `src/store/eventLogStore.ts`
- Current target is a local terminal CLI shell, not a packaged desktop or server deployment
- No deployment manifests, Dockerfiles, or CI build definitions are present in the repository
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- React components use PascalCase filenames such as `src/ui/App.tsx`, `src/ui/components/PromptInput.tsx`, and `src/ui/claudeChrome/ClaudeWelcome.tsx`
- Logic and store modules use camelCase filenames such as `src/runtime/defaultRunner.ts` and `src/store/sessionMetaStore.ts`
- Tests end with `.test.ts` or `.test.tsx` under `test/`
- Verb-first helper and factory naming such as `loadConfig`, `createRuntimeEngine`, `createEventLogStore`, and `projectEventsToMessages`
- Lower camelCase throughout, with focused locals like `events`, `pendingRequest`, `valueRef`, and `stageOne`
- PascalCase for types and aliases such as `EventRecord`, `SessionMeta`, `RuntimeState`, and `RenderableMessage`
## Code Style
- No formatter config is checked in, but current code consistently uses 2-space indentation, single quotes, and no semicolons
- Trailing commas are used in multiline arrays/objects, especially in React props and test fixtures
- No ESLint or Biome config found in the repository
- Style discipline currently comes from TypeScript strict mode and existing file patterns
## Import Organization
- None found; imports are relative paths like `../runtime/defaultRunner`
## Error Handling
- Throw on missing required config in `src/core/config.ts`
- Catch and degrade to safe defaults in `src/runtime/defaultRunner.ts`, `src/store/eventLogStore.ts`, and `src/store/sessionMetaStore.ts`
- Validate unknown event payloads with narrow type guards in `src/ui/events/projectEvents.ts`
## Logging
- Persist domain events through store abstractions rather than log statements
- Tests assert observable behavior instead of console output
## Comments
- Comments are rare; most files rely on small function size and descriptive names instead of inline explanation
- Not used in the checked-in source files
## Function Design
## Module Design
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- User input becomes `EventRecord` items and is projected into renderable UI messages
- Runtime concerns are split between a stage-one decision layer and a stage-two execution layer
- Persistence, permissions, tools, and provider access are separated into small focused modules
## Layers
- Purpose: Boot the terminal app
- Location: `src/index.tsx`
- Contains: `main()` and Ink `render(...)`
- Depends on: `src/ui/App.tsx`
- Used by: `npm run dev`
- Purpose: Capture input and render transcript chrome
- Location: `src/ui/`
- Contains: `App`, prompt/input components, message renderers, event projection helpers
- Depends on: `src/runtime/defaultRunner.ts`, `src/core/contracts.ts`
- Used by: `src/index.tsx`
- Purpose: Decide whether to answer directly or enter tool execution
- Location: `src/runtime/`
- Contains: engine contracts, `createRuntimeEngine`, and `runLocalTurn`
- Depends on: `src/core/config.ts`, `src/provider/openaiClient.ts`
- Used by: `src/ui/App.tsx`
- Purpose: Talk to the configured LLM endpoint
- Location: `src/provider/openaiClient.ts`
- Contains: OpenAI-compatible client creation and chat completion call
- Depends on: `openai`, `src/core/config.ts`
- Used by: `src/runtime/defaultRunner.ts`
- Purpose: Persist and reload local runtime artifacts
- Location: `src/store/`
- Contains: JSONL event log store, session meta store, transient runtime state factory
- Depends on: Node filesystem APIs and `src/core/contracts.ts`
- Used by: tests today; not fully wired into the main app flow yet
## Data Flow
- UI session state lives in React state inside `src/ui/App.tsx`
- Durable history is designed around `EventRecord` and `SessionMeta` in `src/core/contracts.ts`
- `src/store/runtimeState.ts` defines transient runtime state but is not yet integrated into the main turn loop
## Key Abstractions
- Purpose: Canonical append-only record for user messages, tool calls, tool results, assistant text, and system status
- Examples: `src/core/contracts.ts`, `src/ui/events/projectEvents.ts`
- Pattern: Event log / projection model
- Purpose: Coordinate stage-one vs stage-two turn handling
- Examples: `src/runtime/engine.ts`, `src/runtime/stageOne.ts`, `src/runtime/stageTwo.ts`
- Pattern: Dependency-injected orchestrator
- Purpose: UI-safe projection of raw events into display variants
- Examples: `src/ui/messages/types.ts`, `src/ui/events/projectEvents.ts`
- Pattern: View-model translation layer
## Entry Points
- Location: `src/index.tsx`
- Triggers: `npm run dev`
- Responsibilities: Start Ink rendering with `<App />`
- Location: `src/runtime/defaultRunner.ts`
- Triggers: Prompt submit from `src/ui/App.tsx`
- Responsibilities: Build event list, call provider-backed stage one, and package assistant output
- Location: `src/ui/events/projectEvents.ts`
- Triggers: Event state updates in `src/ui/App.tsx`
- Responsibilities: Validate payload shapes and convert events to renderable message variants
## Error Handling
- `src/core/config.ts` throws when required provider env vars are missing
- `src/runtime/defaultRunner.ts` catches provider/config failures and falls back to `echo: ${text}`
- `src/store/eventLogStore.ts` and `src/store/sessionMetaStore.ts` swallow read failures and return empty defaults
- `src/ui/events/projectEvents.ts` converts malformed events into warning messages instead of crashing the renderer
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
