# Phase 1: Runtime Foundation & Boundaries - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Define the runtime foundation and system boundaries for Accorda's CLI-first v1. This phase clarifies runtime state ownership, provider/runtime separation, configuration layering, and the minimum user-visible runtime truth. It does not implement the full tool loop, OAuth login, channel/gateway support, or UI polish.

</domain>

<decisions>
## Implementation Decisions

### Runtime state model and ownership
- **D-01:** Runtime state is the single source of truth. Tool, provider, permission, and user input are event sources only.
- **D-02:** UI must only project runtime state. UI should not infer or invent global state on its own.
- **D-03:** Phase 1 should borrow Claude Code's structural thinking for runtime/message/tool flow, but not chase its full presentation layer.
- **D-04:** State names should be shown directly in engineering form, without an extra natural-language translation layer.
- **D-05:** The minimum runtime state set for this phase is: `idle`, `routing`, `answering`, `executing`, `waiting_permission`, `error`.
- **D-06:** Do not pre-expand the state graph for future cases such as `clarifying` or generic `waiting_input` in Phase 1. Add them later only when the flow is real.

### Configuration philosophy and layering
- **D-07:** The goal is not "as few config items as possible". The goal is clear structure, clear responsibilities, and clear defaults.
- **D-08:** Config is allowed to grow over time, but growth must be structured rather than an accumulation of ad hoc switches.
- **D-09:** Phase 1 should reason about config in four layers: `provider`, `runtime`, `ui`, and `workspace`.
- **D-10:** Users should be pushed away from hand-editing config whenever possible; long-term direction can include a localhost GUI/editor, but not in this phase.

### Main loop and provider boundary
- **D-11:** Accorda should follow a Claude Code-like single main loop: runtime maintains message history and execution context, feeds it to the model, receives text/tool decisions, executes, records, and loops.
- **D-12:** Provider responsibility in Phase 1 is model invocation plus response adaptation. Runtime responsibility is message flow, tool execution, permission gating, state transitions, persistence hooks, and UI projection.
- **D-13:** Provider adapters must not collapse responses down to plain text too early. Structured response data should be preserved for runtime use.
- **D-14:** `usage`, `model`, `finish_reason`, `tool_calls`, and comparable metadata should be retained when available instead of being discarded.
- **D-15:** Runtime should consume normalized provider fields, while raw provider payloads may also be retained for compatibility and future evolution.
- **D-16:** Because Accorda targets `OpenAI-compatible` backends, runtime must not assume every provider always returns every OpenAI-native field.

### User-visible runtime truth in CLI
- **D-17:** Phase 1 should expose a minimal visible set rather than a rich dashboard.
- **D-18:** The minimum visible set is: current runtime state, current tool action, permission blockage, and error source.
- **D-19:** `context utilization` may be shown if provider usage data is available, but it is a best-effort signal rather than a phase blocker.
- **D-20:** Context percentage should be derived from provider/API usage plus known model context window, not from UI-only guesses.
- **D-21:** If provider usage is unavailable, context utilization should be omitted or shown as unknown rather than fabricated.

### the agent's Discretion
- Exact internal type shapes for normalized provider results
- Exact event schema evolution from current `EventRecord`
- Exact placement of state display within the CLI layout
- Whether context utilization is hidden entirely or displayed as unknown when usage is absent

</decisions>

<specifics>
## Specific Ideas

- Accorda should aim for the same family of runtime clarity as Claude Code, but a lighter and cleaner implementation, roughly "60%" of that complexity rather than full parity.
- The project should prefer copying the structural ideas of strong references over inventing novel abstractions too early.
- Context usage display is desirable, but only if it can be grounded in real provider data.
- Provider/auth design should stay open enough to support both API key/baseURL and OAuth-style login later.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project intent and scope
- `.planning/PROJECT.md` — Product direction, target shape, and current v1 boundary
- `.planning/REQUIREMENTS.md` — Phase-driving requirements for runtime clarity, routing, permissions, and session continuity
- `.planning/ROADMAP.md` — Phase 1 boundary and dependency context
- `.planning/STATE.md` — Current project memory and initialization status

### Existing codebase context
- `.planning/codebase/ARCHITECTURE.md` — Current architecture snapshot and where runtime/provider/UI seams already exist
- `.planning/codebase/CONCERNS.md` — Current risks, including thin runtime state and provider coupling
- `.planning/codebase/STRUCTURE.md` — Source tree layout and current ownership boundaries

### Claude Code references
- `../24claude-code/src/components/StatusLine.tsx` — Example of exposing model/context status from runtime data
- `../24claude-code/src/utils/context.ts` — Context window lookup and context percentage calculation
- `../24claude-code/src/utils/tokens.ts` — Usage extraction and token estimation strategy

### OpenClaw references
- `../openclaw/AGENTS.md` — Core loop vs provider-owned behavior boundary rules
- `../openclaw/extensions/openai/openai-codex-provider.ts` — OpenAI Codex provider/plugin seam and OAuth registration pattern
- `../openclaw/src/plugins/provider-openai-codex-oauth.ts` — Browser-based OAuth flow as a provider-owned capability
- `../openclaw/extensions/openai/openai-codex-cli-auth.ts` — CLI credential reuse pattern for Codex-authenticated environments

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/runtime/engine.ts` — Existing stage-one/stage-two handoff skeleton; can evolve into the single main loop boundary without starting from zero
- `src/runtime/defaultRunner.ts` — Current local turn runner; main place where provider result shape is currently too narrow
- `src/core/contracts.ts` — Existing `EventRecord` and `RuntimeState` types; useful starting point but current runtime state is too thin
- `src/core/config.ts` — Clean current config entry point suitable for layering rather than replacement
- `src/tools/registry.ts` — Existing stage-one/stage-two tool split already reflects the intended two-layer methodology
- `src/ui/App.tsx` — Current UI projection point; today it only reflects `isLoading` and should later consume real runtime state

### Established Patterns
- Two-layer tool split already exists conceptually (`clarify` / `proceed` versus execution tools), so Phase 1 should formalize it rather than redesign it
- Event projection already exists, which means state visibility should grow from runtime/event truth instead of ad hoc UI booleans
- Provider integration is currently OpenAI-compatible and minimal, which makes this the right moment to widen the adapter return type before the system grows

### Integration Points
- Provider result normalization should begin in `src/provider/openaiClient.ts`
- Runtime state ownership and transitions should consolidate under `src/runtime/*`
- User-visible state projection should land in `src/ui/*`, driven by runtime-derived data rather than local UI flags

</code_context>

<deferred>
## Deferred Ideas

- Telegram, channels, and gateway integration
- Localhost GUI/config editor for reducing direct config-file edits
- OAuth login implementation, including browser flow, token storage, and refresh
- Reusing local Codex CLI credentials or equivalent external CLI auth state
- Pulling a separate Codex source tree into the workspace for reference right now
- Full UI polish to match Claude Code's richer presentation layer

</deferred>

---

*Phase: 01-runtime-foundation-boundaries*
*Context gathered: 2026-04-11*
