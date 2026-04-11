# Codebase Structure

**Analysis Date:** 2026-04-11

## Directory Layout

```text
accorda/
├── docs/               # Project planning notes and implementation plans
├── src/                # Application source
├── test/               # Vitest suites
├── package.json        # Scripts and dependency manifest
├── tsconfig.json       # TypeScript compiler settings
└── vitest.config.ts    # Test runner config
```

## Directory Purposes

**`src/core`:**
- Purpose: Shared types and environment-driven config
- Contains: `AppConfig`, `EventRecord`, `SessionMeta`, `RuntimeState`
- Key files: `src/core/config.ts`, `src/core/contracts.ts`

**`src/runtime`:**
- Purpose: Turn orchestration and stage contracts
- Contains: `createRuntimeEngine`, stage input/output types, default local runner
- Key files: `src/runtime/defaultRunner.ts`, `src/runtime/engine.ts`

**`src/ui`:**
- Purpose: Ink-based CLI presentation layer
- Contains: top-level app, chrome components, transcript rows, event projection
- Key files: `src/ui/App.tsx`, `src/ui/components/PromptInput.tsx`, `src/ui/events/projectEvents.ts`

**`src/tools`:**
- Purpose: Tool registry and builtin tool identifiers
- Contains: tool metadata and placeholder builtin declarations
- Key files: `src/tools/registry.ts`, `src/tools/builtin/*.ts`

**`src/store`:**
- Purpose: Filesystem-backed persistence helpers
- Contains: event log, session metadata, runtime state factory
- Key files: `src/store/eventLogStore.ts`, `src/store/sessionMetaStore.ts`

**`test`:**
- Purpose: Behavioral and UI regression tests
- Contains: runtime, config, persistence, projection, and interactive Ink tests
- Key files: `test/interactive-app.test.tsx`, `test/ui-event-projection.test.ts`, `test/runtime-engine.test.ts`

## Key File Locations

**Entry Points:**
- `src/index.tsx`: CLI boot entry that renders `<App />`

**Configuration:**
- `package.json`: npm scripts and runtime dependencies
- `tsconfig.json`: NodeNext + strict TypeScript settings
- `vitest.config.ts`: test environment setup

**Core Logic:**
- `src/runtime/defaultRunner.ts`: current turn execution path
- `src/runtime/engine.ts`: two-stage orchestration
- `src/provider/openaiClient.ts`: external provider integration

**Testing:**
- `test/*.test.ts`
- `test/*.test.tsx`

## Naming Conventions

**Files:**
- React components use PascalCase filenames such as `src/ui/components/Header.tsx`
- Non-component modules use camelCase filenames such as `src/store/eventLogStore.ts`
- Tests use kebab-case or lowercase feature names with `.test.ts(x)` such as `test/runtime-engine.test.ts`

**Directories:**
- Lowercase functional groupings such as `src/runtime`, `src/store`, `src/provider`

## Where to Add New Code

**New runtime feature:**
- Primary code: `src/runtime/`, `src/tools/`, and `src/provider/` depending on whether the change is orchestration, tool execution, or provider-facing
- Tests: `test/` with one file per feature area

**New UI component/module:**
- Implementation: `src/ui/components/`, `src/ui/messages/`, or `src/ui/claudeChrome/`

**Utilities:**
- Shared helpers: colocate with their owning layer; there is no shared `utils/` directory yet

## Special Directories

**`docs/superpowers/plans`:**
- Purpose: Human-authored implementation planning artifacts
- Generated: No
- Committed: Yes

**`node_modules`:**
- Purpose: Installed dependencies for local development
- Generated: Yes
- Committed: No, ignored by `.gitignore`

**`.planning/codebase`:**
- Purpose: GSD-generated repository map for future planning and execution
- Generated: Yes
- Committed: Intended to be committed once reviewed

---

*Structure analysis: 2026-04-11*
