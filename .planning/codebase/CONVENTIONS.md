# Coding Conventions

**Analysis Date:** 2026-04-11

## Naming Patterns

**Files:**
- React components use PascalCase filenames such as `src/ui/App.tsx`, `src/ui/components/PromptInput.tsx`, and `src/ui/claudeChrome/ClaudeWelcome.tsx`
- Logic and store modules use camelCase filenames such as `src/runtime/defaultRunner.ts` and `src/store/sessionMetaStore.ts`
- Tests end with `.test.ts` or `.test.tsx` under `test/`

**Functions:**
- Verb-first helper and factory naming such as `loadConfig`, `createRuntimeEngine`, `createEventLogStore`, and `projectEventsToMessages`

**Variables:**
- Lower camelCase throughout, with focused locals like `events`, `pendingRequest`, `valueRef`, and `stageOne`

**Types:**
- PascalCase for types and aliases such as `EventRecord`, `SessionMeta`, `RuntimeState`, and `RenderableMessage`

## Code Style

**Formatting:**
- No formatter config is checked in, but current code consistently uses 2-space indentation, single quotes, and no semicolons
- Trailing commas are used in multiline arrays/objects, especially in React props and test fixtures

**Linting:**
- No ESLint or Biome config found in the repository
- Style discipline currently comes from TypeScript strict mode and existing file patterns

## Import Organization

**Order:**
1. External packages such as `react`, `ink`, `openai`, and Node builtins
2. Local value imports
3. Local type imports using `import type`

**Path Aliases:**
- None found; imports are relative paths like `../runtime/defaultRunner`

## Error Handling

**Patterns:**
- Throw on missing required config in `src/core/config.ts`
- Catch and degrade to safe defaults in `src/runtime/defaultRunner.ts`, `src/store/eventLogStore.ts`, and `src/store/sessionMetaStore.ts`
- Validate unknown event payloads with narrow type guards in `src/ui/events/projectEvents.ts`

## Logging

**Framework:** No dedicated logging framework

**Patterns:**
- Persist domain events through store abstractions rather than log statements
- Tests assert observable behavior instead of console output

## Comments

**When to Comment:**
- Comments are rare; most files rely on small function size and descriptive names instead of inline explanation

**JSDoc/TSDoc:**
- Not used in the checked-in source files

## Function Design

**Size:** Functions are generally short and purpose-specific, especially in `src/runtime/engine.ts`, `src/provider/openaiClient.ts`, and `src/ui/events/projectEvents.ts`

**Parameters:** Most APIs take a small object or a narrow set of primitive parameters; dependency injection is preferred where orchestration needs testing

**Return Values:** Factories return small objects with methods, and projection helpers return typed structures rather than mutating shared state

## Module Design

**Exports:** Named exports are the default across `src/` and `test/`

**Barrel Files:** None found; modules are imported directly from their source file

---

*Convention analysis: 2026-04-11*
