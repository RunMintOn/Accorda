# Phase 1: Runtime Foundation & Boundaries - Research

**Researched:** 2026-04-11
**Domain:** CLI runtime contracts, provider normalization, and UI status projection
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Runtime state is the single source of truth. Tool, provider, permission, and user input are event sources only.
- UI must only project runtime state. UI should not infer or invent global state on its own.
- Phase 1 should borrow Claude Code's structural thinking for runtime/message/tool flow, but not chase its full presentation layer.
- State names should be shown directly in engineering form, without an extra natural-language translation layer.
- The minimum runtime state set for this phase is: `idle`, `routing`, `answering`, `executing`, `waiting_permission`, `error`.
- Config should grow structurally, not through ad hoc flags, and should be reasoned about in `provider`, `runtime`, `ui`, and `workspace` layers.
- Accorda should follow a Claude Code-like single main loop where runtime owns history/context and provider handles model invocation plus response adaptation.
- Provider adapters must retain structured data such as `usage`, `model`, `finish_reason`, and `tool_calls` when available.
- User-visible CLI truth should stay minimal: runtime state, current tool action, permission blockage, error source, plus optional best-effort context utilization.

### the agent's Discretion
- Exact internal type shapes for normalized provider results
- Exact event schema evolution from current `EventRecord`
- Exact placement of runtime status within the CLI
- Whether missing usage is hidden or shown as `unknown`

### Deferred Ideas (OUT OF SCOPE)
- OAuth login implementation
- Reuse of external Codex CLI credentials
- Telegram/channels/gateway
- Localhost GUI config editor
- Full Claude Code-like terminal polish

</user_constraints>

<research_summary>
## Summary

Phase 1 does not need new libraries. The existing TypeScript + Ink + OpenAI SDK stack is enough to establish the runtime contract if the code stops collapsing important information too early. The key structural move is to make the runtime own explicit state transitions and normalized provider results, then let the UI render that truth with minimal formatting.

The strongest references are already local. `24claude-code` shows that context usage and status projection are derived from runtime/message data rather than hard-coded UI booleans. `openclaw` shows that the generic loop should stay in core while provider-specific concerns, especially auth, stay on the provider side of the seam. For Accorda, the immediate recommendation is to formalize contracts first, widen provider results second, and only then wire CLI status rendering around those contracts.

**Primary recommendation:** Use the current repo structure, introduce explicit runtime and provider result contracts, and implement status projection as a thin UI layer over those contracts.
</research_summary>

<standard_stack>
## Standard Stack

The established libraries/tools for this phase:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.8.3 | Runtime contracts and CLI code | Already in strict mode and fits contract-heavy work |
| Ink | 5.1.0 | Terminal UI projection | Existing UI is already Ink-based, no migration cost |
| OpenAI SDK | 4.104.0 | OpenAI-compatible request transport | Already in use and returns structured completion objects |
| Vitest | 3.1.4 | Contract and projection tests | Already green in repo, fast enough for iteration |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React | 18.3.1 | State/render model for Ink UI | For runtime status projection and message rendering |
| Node fs/path runtime | built-in | Store/session work and config resolution | Reused when state becomes durable in later phases |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing Ink UI | Rewrite around another terminal framework | Unnecessary scope growth before contracts are stable |
| OpenAI SDK response objects | Hand-written HTTP client | Loses existing typed response shape and increases protocol drift risk |

**Installation:**
```bash
npm install
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```text
src/
├── core/          # Contracts and config entry points
├── provider/      # Provider clients and normalization
├── runtime/       # Main loop, stage transitions, orchestration
├── store/         # Runtime/session persistence helpers
└── ui/            # Projection of runtime truth into Ink
```

### Pattern 1: Runtime-owned state transitions
**What:** Runtime receives signals from provider/tool/permission/user and decides the canonical stage.
**When to use:** Every turn-level state transition.
**Example:**
```ts
type RuntimeStage =
  | 'idle'
  | 'routing'
  | 'answering'
  | 'executing'
  | 'waiting_permission'
  | 'error'
```

### Pattern 2: Normalized provider result plus raw preservation
**What:** Return a normalized provider object for runtime use while retaining raw provider payload for compatibility and future feature work.
**When to use:** Every model call boundary.
**Example:**
```ts
type ProviderResult = {
  text: string
  model?: string
  finishReason?: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
  toolCalls?: unknown[]
  raw?: unknown
}
```

### Anti-Patterns to Avoid
- **UI-owned state:** `isLoading` and similar local booleans become misleading once runtime branches multiply.
- **Text-only provider adapters:** Returning only assistant text throws away metadata needed for context usage, diagnostics, and future tool calling.
- **Pre-solving future flows:** Adding `clarifying`, checkpoint resume, or OAuth flow logic now would blur the Phase 1 boundary.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Context utilization | UI-only token guesser | Provider `usage` + known model context window + best-effort estimation | Raw string length is too inaccurate once tool calls and caching matter |
| Provider auth architecture | Runtime-owned provider-specific login paths | Provider-owned auth seam | Prevents core/provider coupling |
| CLI status semantics | Ad hoc spinner copy | Explicit runtime stage contract | Keeps transcript, diagnostics, and future execution consistent |

**Key insight:** The hard part here is not rendering status text. It is choosing a contract that future phases can build on without rewrites.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Over-planning the terminal presentation
**What goes wrong:** The phase turns into a visual polish project instead of a runtime contract project.
**Why it happens:** Claude Code is visually attractive, so teams copy the surface before the semantics.
**How to avoid:** Only plan minimal status projection in Phase 1; keep richer transcript UX for later phases.
**Warning signs:** New components multiply while `RuntimeState` and provider return types remain unchanged.

### Pitfall 2: Hiding errors behind friendly fallbacks
**What goes wrong:** Config or provider failures degrade to ambiguous text responses and the runtime stays opaque.
**Why it happens:** Convenience fallbacks feel helpful early on.
**How to avoid:** Emit explicit status/error information in runtime-visible structures instead of silent echo behavior.
**Warning signs:** Tests still pass while the user cannot tell config failure from a valid assistant answer.

### Pitfall 3: Treating OpenAI-compatible as a strict standard
**What goes wrong:** Runtime assumes all compatible providers return full OpenAI-native metadata.
**Why it happens:** The SDK shape looks stable in the happy path.
**How to avoid:** Normalize optional fields and make UI/status handling resilient to missing `usage` and other metadata.
**Warning signs:** Missing `usage` crashes status rendering or forces fake token numbers.
</common_pitfalls>

## Validation Architecture

- Phase 1 can be validated with focused unit/UI tests plus `npm test`.
- Contract-heavy tasks should update or add tests before broad execution work grows around them.
- Context utilization must be treated as optional: verification should accept either a real percentage or an explicit unknown/missing state, but not fabricated values.

<open_questions>
## Open Questions

1. **Should runtime state live only in events, or also in a dedicated transient state object?**
   - What we know: `src/store/runtimeState.ts` exists but is not integrated.
   - What's unclear: Whether Phase 1 should make it canonical or keep runtime state derived from engine output plus events.
   - Recommendation: Let planner choose the smallest approach that still removes `isLoading` as the primary truth source.

2. **How much of provider raw payload should be persisted?**
   - What we know: Runtime needs normalized fields immediately; raw payload may help forward compatibility.
   - What's unclear: Whether raw payload belongs in persisted events in Phase 1.
   - Recommendation: Keep raw payload in normalized provider result types first; persist only if needed by the chosen implementation.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- Local repo `src/core/contracts.ts`, `src/runtime/engine.ts`, `src/runtime/defaultRunner.ts`, `src/provider/openaiClient.ts`, `src/ui/App.tsx`
- Local reference repo `../24claude-code/src/components/StatusLine.tsx`, `../24claude-code/src/utils/context.ts`, `../24claude-code/src/utils/tokens.ts`
- Local reference repo `../openclaw/AGENTS.md`, `../openclaw/extensions/openai/openai-codex-provider.ts`, `../openclaw/src/plugins/provider-openai-codex-oauth.ts`

### Secondary (MEDIUM confidence)
- OpenAI Chat Completions API reference — confirms responses include a `usage` object in the standard API shape: https://platform.openai.com/docs/api-reference/chat/create/

</sources>

