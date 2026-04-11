# Phase 1: Runtime Foundation & Boundaries - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 1-Runtime Foundation & Boundaries
**Areas discussed:** runtime state exposure, configuration layering, provider boundary, user-visible CLI truth

---

## Runtime state exposure

| Option | Description | Selected |
|--------|-------------|----------|
| Follow UI appearance first | Make terminal output look closer to Claude Code before firming up the model | |
| Follow runtime/message structure first | Learn Claude Code's internal flow and keep Phase 1 UI plain | ✓ |

**User's choice:** Prioritize Claude Code's structural thinking rather than its full UI layer.
**Notes:** User explicitly wants a lighter, cleaner implementation and does not want extra natural-language wrapping of runtime states. Runtime must be the single source of truth, and UI should only project it.

---

## Runtime state naming and minimum set

| Option | Description | Selected |
|--------|-------------|----------|
| Natural-language labels | Show states as user-friendly prose | |
| Direct engineering names | Show concise state identifiers directly | ✓ |

**User's choice:** Use direct state names.
**Notes:** Minimum accepted state set: `idle`, `routing`, `answering`, `executing`, `waiting_permission`, `error`. User accepted future expansion later if the flow demands it.

---

## Configuration surface

| Option | Description | Selected |
|--------|-------------|----------|
| Minimize config count | Treat fewer settings as the primary goal | |
| Structured growth | Allow config to grow, but only with clear layering and defaults | ✓ |

**User's choice:** Structured growth.
**Notes:** User rejected the idea that "fewer config items" automatically means "clearer". Accepted four-layer framing: `provider`, `runtime`, `ui`, `workspace`.

---

## Provider boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Treat provider as a simple text-returning helper | Narrow adapter, minimal retained metadata | |
| Follow a Claude Code-like single loop | Runtime owns the loop; provider handles model invocation and structured response adaptation | ✓ |

**User's choice:** Single main loop.
**Notes:** User pushed back on overly abstract separation language and re-centered the design on Claude Code's loop: runtime sends full context, model returns text/tool intent, runtime executes and loops. User also insisted that provider return data should not be thrown away.

---

## User-visible CLI truth

| Option | Description | Selected |
|--------|-------------|----------|
| Rich dashboard | Include many metrics and monitoring details up front | |
| Minimal visible set | Show only the key runtime truth needed for transparency | ✓ |

**User's choice:** Minimal visible set.
**Notes:** Accepted visible categories were runtime state, tool action, permission blockage, and error source. User additionally requested context usage visibility if feasible.

---

## Context utilization

| Option | Description | Selected |
|--------|-------------|----------|
| Hard requirement | Must be fully implemented in Phase 1 | |
| Best-effort optional signal | Show when provider usage data exists; otherwise omit or mark unknown | ✓ |

**User's choice:** Best-effort optional signal.
**Notes:** After reviewing Claude Code and current Accorda code, the conclusion was that context percentage should depend on preserved provider usage plus model context window, not UI guessing. Current Accorda provider code throws away this metadata.

---

## Auth and provider expansion

| Option | Description | Selected |
|--------|-------------|----------|
| Add OAuth in Phase 1 | Fold auth/login implementation into runtime foundation work | |
| Defer OAuth implementation | Keep the seam open now, implement login later | ✓ |

**User's choice:** Defer implementation, keep the seam open.
**Notes:** User wants eventual support for API key/baseURL and OAuth-style login. OpenClaw references were reviewed. Decision: OAuth is valuable but not part of Phase 1 delivery.

---

## the agent's Discretion

- Exact normalized provider result type
- Exact event schema and state type changes
- CLI placement/details for runtime state output

## Deferred Ideas

- OAuth login flow
- Codex CLI credential reuse
- Telegram/channels/gateway
- Localhost GUI config editor
- Importing a Codex source tree as another live reference repo now

