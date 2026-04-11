# Technology Stack

**Analysis Date:** 2026-04-11

## Languages

**Primary:**
- TypeScript 5.8.3 - All application code under `src/` and tests under `test/`

**Secondary:**
- TSX via React JSX runtime - Terminal UI components in `src/ui/` and entrypoint `src/index.tsx`
- Markdown - Project notes and implementation plans in `README.md` and `docs/superpowers/plans/2026-04-11-claude-code-tui-visual-parity.md`

## Runtime

**Environment:**
- Node.js ESM runtime - Configured by `package.json` (`"type": "module"`) and `tsconfig.json` (`"module": "NodeNext"`)

**Package Manager:**
- npm - Scripts defined in `package.json`
- Lockfile: present in `package-lock.json`

## Frameworks

**Core:**
- React 18.3.1 - Component model for the terminal UI in `src/ui/App.tsx` and `src/ui/components/*.tsx`
- Ink 5.1.0 - Terminal rendering primitives such as `render`, `Box`, `Text`, and `useStdin` in `src/index.tsx` and `src/ui/components/PromptInput.tsx`
- OpenAI SDK 4.104.0 - OpenAI-compatible chat completion client in `src/provider/openaiClient.ts`

**Testing:**
- Vitest 3.1.4 - Test runner and assertions configured in `vitest.config.ts`
- ink-testing-library 4.0.0 - Terminal UI rendering tests in `test/interactive-app.test.tsx` and `test/message-list.test.tsx`

**Build/Dev:**
- tsx 4.19.2 - Local execution for `npm run dev` via `tsx src/index.tsx`
- TypeScript compiler 5.8.3 - Static typing and JSX compilation via `tsconfig.json`

## Key Dependencies

**Critical:**
- `ink` - Core CLI UI surface and input handling in `src/ui/`
- `react` - State and render model for the CLI shell in `src/ui/App.tsx`
- `openai` - Provider client used by `src/runtime/defaultRunner.ts`

**Infrastructure:**
- `zod` - Installed in `package.json` but not yet used by the checked-in source
- `@types/node` and `@types/react` - Type definitions for runtime and UI code

## Configuration

**Environment:**
- `src/core/config.ts` requires `CONTEXTA_BASE_URL`, `CONTEXTA_API_KEY`, and `CONTEXTA_MODEL`
- Workspace root is inferred from `process.cwd()` in `src/core/config.ts`

**Build:**
- `package.json` defines `dev`, `test`, and `test:watch`
- `tsconfig.json` enables `strict` mode, `react-jsx`, and `NodeNext`
- `vitest.config.ts` sets the test environment to `node`

## Platform Requirements

**Development:**
- Node.js environment capable of ESM + TSX execution
- Interactive terminal stdin support for Ink input in `src/ui/components/PromptInput.tsx`
- Writable local filesystem for append-only event logs in `src/store/eventLogStore.ts`

**Production:**
- Current target is a local terminal CLI shell, not a packaged desktop or server deployment
- No deployment manifests, Dockerfiles, or CI build definitions are present in the repository

---

*Stack analysis: 2026-04-11*
