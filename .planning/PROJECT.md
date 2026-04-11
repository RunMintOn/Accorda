# Accorda

## What This Is

Accorda is a terminal-first agent runtime and coding assistant being built as a cleaner, more transparent alternative to the kinds of systems represented by OpenClaw and Claude Code. The long-term direction is an OpenClaw-like assistant with channels and gateways, but v1 is deliberately narrower: a CLI experience where users can clearly see intent routing, tool use, permissions, runtime state, and recovery behavior.

The product is meant for people who can use a terminal but do not want to learn a maze of agent configuration. The guiding idea is simple structure, visible execution, and a runtime that feels understandable instead of magical.

## Core Value

Users can see and trust what the runtime is doing without having to learn or manage a pile of hidden configuration.

## Requirements

### Validated

- ✓ Interactive terminal shell exists with transcript-style rendering and prompt input — existing
- ✓ OpenAI-compatible provider configuration is already wired through a separate provider module — existing
- ✓ Append-only event log and session metadata storage primitives exist locally — existing
- ✓ Permission policy concept already distinguishes read-only tools from write/exec tools — existing

### Active

- [ ] Turn the current skeleton into a real two-layer runtime: answer, clarify, or enter explicit execution flow
- [ ] Make every meaningful runtime step visible: stage changes, tool calls, waits, permissions, and failures
- [ ] Add reliable session continuity with resume plus basic compaction/summary for long conversations
- [ ] Keep provider, runtime, and tool layers decoupled so the system stays easier to evolve than OpenClaw
- [ ] Make the CLI feel clean and low-noise, borrowing the best terminal interaction ideas from Claude Code without copying unnecessary complexity

### Out of Scope

- Telegram, channels, and gateway integrations — important long term, but they would blur the current CLI/runtime focus
- Undo / rollback flows — useful later, but not necessary to validate transparent runtime behavior in v1
- Deep provider-specific feature parity beyond an OpenAI-compatible surface — defer until the runtime contract is stable
- Grammar / DSL-first protocol design — defer unless the simpler runtime contract proves insufficient
- Full GUI/web configuration surface — useful later, but CLI-first remains the correct v1 focus

## Context

The repository already contains a working CLI shell in `src/ui/` with a minimal runtime skeleton in `src/runtime/`, tool metadata in `src/tools/`, and local persistence helpers in `src/store/`. The current codebase is intentionally incomplete: stage-two execution is still a stub, permission requests are not yet wired into the live app path, and session restore/compaction are not yet implemented.

Two local reference projects shape the direction. `../openclaw/` provides the long-term product shape: multi-channel assistant runtime, gateways, and extensibility. `../24claude-code/` provides a reference for terminal interaction quality: tool transcript presentation, prompt ergonomics, and visible execution flow. Accorda should learn from both, but remain smaller, clearer, and more explicit in how state moves through the runtime.

The project method is also a product decision. Accorda should separate quick asks from heavier execution work, make intent routing explicit, and keep internals understandable enough that new users can build trust quickly.

## Constraints

- **Tech stack**: Keep the current TypeScript + React + Ink CLI stack for v1 — it already matches the present codebase and supports terminal-first iteration
- **Runtime focus**: CLI before channels — the runtime contract must be clear before Telegram/gateway work begins
- **Provider boundary**: Keep provider integration separate from runtime logic — avoids the coupling that makes larger systems harder to reason about
- **Simplicity**: Prefer the simplest design that preserves transparency — unnecessary features or config layers are a product regression
- **Reliability**: Surface runtime state and failure modes explicitly — hidden behavior is unacceptable for the intended product direction

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build v1 as a CLI-first runtime instead of starting with channels | The hard problem right now is making the core runtime understandable and reliable | — Pending |
| Use OpenClaw as long-term product inspiration, not as a structure to copy wholesale | OpenClaw proves the broader assistant direction, but its current complexity is exactly what Accorda wants to reduce | — Pending |
| Use Claude Code as interaction inspiration for terminal UX | Claude Code demonstrates strong transcript, prompt, and tool-call ergonomics | — Pending |
| Keep a two-layer runtime model | Small asks should stay lightweight; larger tasks need an explicit execution path | — Pending |
| Preserve provider/runtime/tool separation | This is necessary to keep the system adaptable and easier to debug | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-11 after initialization*
