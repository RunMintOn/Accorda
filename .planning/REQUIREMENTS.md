# Requirements: Accorda

**Defined:** 2026-04-11
**Core Value:** Users can see and trust what the runtime is doing without having to learn or manage a pile of hidden configuration.

## v1 Requirements

### Flow

- [ ] **FLOW-01**: User can submit a natural-language request and the runtime classifies it as direct answer, clarification, or execution flow
- [ ] **FLOW-02**: User can see the current runtime stage and why it changed during a turn
- [ ] **FLOW-03**: Larger tasks enter an explicit multi-step execution flow instead of staying a one-shot black box

### Transparency

- [ ] **TRNS-01**: User can see each tool call with tool name, input summary, and result state in the transcript
- [ ] **TRNS-02**: User can see when execution is waiting on clarification, permission, provider response, or another blocking condition

### Safety

- [ ] **SAFE-01**: User must explicitly approve write, edit, and shell-execution actions before they run
- [ ] **SAFE-02**: Read-only tools can run without unnecessary approval prompts

### Sessions

- [ ] **SESS-01**: User can reopen the CLI and restore the latest session transcript and local session metadata
- [ ] **SESS-02**: Long sessions can be compacted or summarized so work can continue without relying on raw full-history replay
- [ ] **SESS-03**: Event history persists locally in a predictable append-only format that the runtime can reload

### Configuration

- [ ] **CONF-01**: User can start the CLI against an OpenAI-compatible provider with a small, clear configuration surface
- [ ] **CONF-02**: Runtime, provider, and tool layers remain decoupled so provider changes do not require rewriting the runtime loop

### Reliability

- [ ] **RELY-01**: Provider, configuration, and tool failures are surfaced as explicit actionable status instead of silent or ambiguous behavior

### UX

- [ ] **UX-01**: Terminal interaction feels clean and low-noise, borrowing the best terminal patterns from Claude Code without inheriting unnecessary complexity
- [ ] **UX-02**: User can get from install to first useful interaction after a short guided setup, without editing scattered config files

## v2 Requirements

### Channels

- **CHAN-01**: User can connect Telegram and other channels to the runtime through adapter layers
- **CHAN-02**: Runtime can expose a gateway/control-plane shape compatible with broader assistant workflows

### Configuration

- **CONF-03**: User can manage configuration through a local GUI/web interface
- **CONF-04**: Runtime supports multiple first-class provider adapters beyond an OpenAI-compatible baseline

### Continuity

- **SESS-04**: Runtime can resume interrupted long-running execution from precise checkpoints when feasible

### Protocol

- **PROT-01**: Runtime protocol can adopt a stricter grammar/DSL layer if simpler contracts prove insufficient

## Out of Scope

| Feature | Reason |
|---------|--------|
| Telegram / channel / gateway integration in v1 | Would expand scope before the CLI runtime contract is trustworthy |
| Undo / rollback flows in v1 | Useful later, but not required to validate transparent runtime behavior |
| Deep provider-specific feature parity in v1 | Would create coupling before the runtime boundary is stable |
| Grammar / DSL-first protocol work in v1 | Better to validate simple explicit runtime contracts first |
| Full GUI/web control surface in v1 | CLI-first iteration is the shortest path to a trustworthy runtime |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FLOW-01 | Phase 3 | Pending |
| FLOW-02 | Phase 1 | Pending |
| FLOW-03 | Phase 3 | Pending |
| TRNS-01 | Phase 2 | Pending |
| TRNS-02 | Phase 2 | Pending |
| SAFE-01 | Phase 2 | Pending |
| SAFE-02 | Phase 2 | Pending |
| SESS-01 | Phase 4 | Pending |
| SESS-02 | Phase 4 | Pending |
| SESS-03 | Phase 4 | Pending |
| CONF-01 | Phase 1 | Pending |
| CONF-02 | Phase 1 | Pending |
| RELY-01 | Phase 5 | Pending |
| UX-01 | Phase 3 | Pending |
| UX-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-11 after roadmap creation*
