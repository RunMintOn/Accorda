# Project Research Summary

**Project:** Accorda
**Domain:** terminal-first transparent agent runtime / coding assistant
**Researched:** 2026-04-11
**Confidence:** MEDIUM

## Executive Summary

Accorda sits between two reference poles. `openclaw` shows the long-term product destination: an extensible assistant runtime that can eventually live across many channels and environments. `24claude-code` shows a strong terminal interaction model: clear transcript hierarchy, visible tool activity, and low-friction prompt ergonomics. The recommended path is not to combine their full scopes, but to use them selectively to build a smaller, clearer runtime-first CLI.

The key recommendation is to treat runtime transparency as the product, not just a UX detail. That means stage transitions, tool calls, permissions, failures, session persistence, and resume/compaction all need explicit contracts. The main risk is premature expansion: if channels, provider-specific features, or grammar-heavy protocols enter too early, Accorda will recreate the same complexity it is trying to fix.

## Key Findings

### Recommended Stack

The current TypeScript + React + Ink stack is a good fit for the v1 goal and should stay in place. The runtime should continue to use a narrow provider adapter and should introduce stronger schema validation around config, tool inputs, and event payloads as the execution loop becomes real.

**Core technologies:**
- TypeScript — shared contracts across runtime, UI, tools, and persistence
- React + Ink — terminal transcript and interaction layer
- OpenAI SDK behind adapter — OpenAI-compatible transport without coupling the full runtime to one provider
- Zod — schema clarity as runtime states and tool payloads grow

### Expected Features

Users in this domain expect a real prompt/transcript loop, visible tool calls, approval gates for risky actions, and the ability to restore a session after interruption. For Accorda specifically, the differentiator is not "more features"; it is cleaner execution logic plus more visible runtime behavior.

**Must have (table stakes):**
- Visible tool + permission flow — users expect modern coding agents to show their work
- Session restore and basic continuity — users do not want to restart from zero
- Minimal setup path — friction at startup undermines the whole product promise

**Should have (competitive):**
- Two-layer answer / clarify / execute routing — makes the runtime easier to understand
- Explicit runtime status — lets users see why the system is moving or waiting
- Low-noise CLI interaction — improves accessibility for less experienced users

**Defer (v2+):**
- Telegram/channels/gateway integrations
- GUI/web configuration surface
- Deep multi-provider support

### Architecture Approach

The recommended architecture is a layered CLI runtime: transcript UI on top, explicit stage orchestration in the middle, and adapters/persistence underneath. Events should be the source of truth for visibility and recovery. Channels and other future integrations should wrap this runtime contract instead of changing it.

**Major components:**
1. Terminal interaction layer — prompt, transcript, status, permissions
2. Runtime orchestration layer — answer/clarify/execute routing plus tool loop
3. Persistence layer — event log, session metadata, compaction/resume artifacts
4. Adapter layer — provider transport now, channel adapters later

### Critical Pitfalls

1. **Config sprawl** — keep setup centralized and defaults obvious
2. **Visible transcript, invisible runtime** — model state transitions explicitly, not just UI text
3. **Treating every request like a long agent task** — keep a lightweight path for simple asks
4. **Fake resume** — tie continuity to stored state, not cosmetic replay
5. **OpenClaw-scale scope too early** — hold the line on CLI-first runtime work

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Runtime Foundation & Boundaries
**Rationale:** The runtime contract and boundaries must be clear before adding more behavior
**Delivers:** explicit stage/status model, minimal config surface, provider/runtime/tool separation
**Addresses:** transparency and simplicity foundations
**Avoids:** config sprawl and hidden runtime state

### Phase 2: Visible Tool Loop & Permissions
**Rationale:** Trust comes from seeing and approving real execution
**Delivers:** actual stage-two execution with tool lifecycle events and approval enforcement
**Uses:** event-first runtime model
**Implements:** execution loop + permission integration

### Phase 3: Intent Routing & Task Modes
**Rationale:** The product method depends on distinguishing small asks from larger execution work
**Delivers:** answer / clarify / execute routing and cleaner task-mode behavior
**Uses:** stage-one routing contract
**Implements:** explicit multi-step flow for bigger work

### Phase 4: Session Continuity & Compaction
**Rationale:** A transparent runtime still fails real use if it cannot recover cleanly
**Delivers:** resume, summary/compaction, and durable session continuity
**Uses:** persistence layer
**Implements:** event/session restoration

### Phase 5: Reliability, Onboarding & v1 Polish
**Rationale:** Once the loop exists, the system must become easy to start and easier to trust
**Delivers:** actionable failures, guided setup, and reduced friction/noise in CLI use
**Uses:** all earlier layers
**Implements:** v1 usability hardening

### Phase Ordering Rationale

- Config and boundaries come first because they prevent later coupling mistakes
- Tool visibility must exist before intent routing feels meaningful
- Resume/compaction belong after the runtime loop is stable enough to persist honestly
- Onboarding and polish should harden a real runtime, not a placeholder

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** permission enforcement and tool lifecycle details
- **Phase 4:** compaction/resume strategy and continuity semantics

Phases with standard patterns (skip research-phase):
- **Phase 1:** codebase boundaries and config simplification
- **Phase 5:** guided setup and CLI polish patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Strong local evidence from the current codebase and reference repos |
| Features | MEDIUM | Good alignment from user goals plus common coding-agent expectations |
| Architecture | MEDIUM | Direction is clear, but exact runtime contracts still need implementation validation |
| Pitfalls | HIGH | The project already exhibits several early-warning patterns in its skeleton state |

**Overall confidence:** MEDIUM

### Gaps to Address

- Resume semantics need to be defined carefully so "can continue" means more than replaying transcript text
- The exact stage-one decision contract may need refinement once real tool execution exists
- Compaction should preserve enough runtime truth to support transparency, not just save tokens

## Sources

### Primary (HIGH confidence)
- `accorda/.planning/codebase/STACK.md` — current codebase state
- `accorda/.planning/codebase/ARCHITECTURE.md` — current codebase architecture
- `accorda/.planning/codebase/CONCERNS.md` — current risks and gaps

### Secondary (MEDIUM confidence)
- `24claude-code/README.md` — terminal agent interaction patterns
- `openclaw/README.md` — long-term assistant product scope and architecture direction

### Tertiary (LOW confidence)
- Initialization discussion with the project owner on 2026-04-11 — intent and product-method framing

---
*Research completed: 2026-04-11*
*Ready for roadmap: yes*
