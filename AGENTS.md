# Repository Guidelines

## Project Structure & Module Organization

Accorda is a TypeScript CLI agent runtime built with React and Ink. Source code lives in `src/`: `src/ui/` renders the terminal interface, `src/runtime/` coordinates the turn loop, `src/tools/` defines tool contracts, `src/permissions/` owns permission policy, `src/prompt/` compiles prompts, `src/provider/` isolates model access, and `src/store/` handles event/session persistence. Tests live in `test/`, for example `test/runtime-engine.test.ts` and `test/message-list.test.tsx`.

Project direction is documented outside this package. Start from `../docs/0-文档地图.md`, then read the files it points to. Do not hard-code assumptions from those documents into code or this guide; treat them as the current source of project intent.

## Build, Test, and Development Commands

- `npm run dev`: start the Ink CLI with the current environment.
- `npm run dev:local`: start the CLI using `.env.local`.
- `npm run run:once -- <prompt>`: execute one non-interactive task and print a JSON run summary.
- `npm run run:once:local -- <prompt>`: run the same path with `.env.local`.
- `npm test`: run the Vitest suite once.
- `npm run test:watch`: run Vitest in watch mode.

Required local model configuration is read by `src/core/config.ts`; keep provider settings out of runtime logic.

## Coding Style & Naming Conventions

Use TypeScript with strict mode and ESM. Follow the existing style: 2-space indentation, single quotes, no semicolons, and trailing commas in multiline literals. React components use PascalCase, such as `PromptInput.tsx`; logic modules use camelCase, such as `defaultRunner.ts`. Prefer small modules and relative imports. Comments should explain non-obvious decisions, not restate code.

## Testing Guidelines

Use Vitest and `ink-testing-library` for UI behavior. Test files should end in `.test.ts` or `.test.tsx` under `test/`. Add or update the most targeted tests for touched behavior, especially runtime events, permission decisions, prompt compilation, event projection, and terminal UI output.

## Commit & Pull Request Guidelines

Recent commits use Conventional Commit style with optional scopes, for example `feat(ui): add dedicated runtime status component`. Keep commits focused. Pull requests should explain the behavior change, list verification commands, link related issues or docs, and include terminal output or screenshots for visible TUI changes.

## Agent-Specific Instructions

GSD is no longer the active workflow. Treat `.planning/` and older generated material as historical context only. For runtime, protocol, tools, permissions, messages/events, context, queueing, recovery, or TUI agent interactions, first consult the current docs entry at `../docs/0-文档地图.md` and follow the referenced guidance. Keep v1 scoped to the local CLI runtime unless the docs explicitly change.
