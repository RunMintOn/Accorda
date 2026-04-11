# Roadmap: Accorda

## Overview

Accorda already has a promising CLI shell and runtime skeleton. The roadmap for v1 is to turn that skeleton into a trustworthy terminal runtime: first clarify the contracts and boundaries, then make tool execution visible and safe, then add explicit intent routing, then ship real session continuity, and finally harden onboarding and reliability so the system feels simple instead of improvised.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Runtime Foundation & Boundaries** - Make stage/state visibility and runtime boundaries explicit
- [ ] **Phase 2: Visible Tool Loop & Permissions** - Turn the execution layer into a real, observable, gated tool loop
- [ ] **Phase 3: Intent Routing & Task Modes** - Implement answer/clarify/execute routing and cleaner large-task handling
- [ ] **Phase 4: Session Continuity & Compaction** - Restore sessions reliably and keep long conversations operable
- [ ] **Phase 5: Reliability, Onboarding & v1 Polish** - Make setup, failures, and daily CLI use feel dependable and simple

## Phase Details

### Phase 1: Runtime Foundation & Boundaries
**Goal**: Establish the runtime contracts that make the rest of the product understandable and changeable
**Depends on**: Nothing (first phase)
**Requirements**: [FLOW-02, CONF-01, CONF-02]
**Success Criteria** (what must be TRUE):
  1. User can see the runtime's current stage/state in the CLI and understand why it changed
  2. OpenAI-compatible configuration is reduced to a small, explicit surface with clear diagnostics
  3. Provider logic remains isolated from runtime orchestration and tool contracts
**Plans**: TBD

Plans:
- [ ] 01-01: Formalize runtime state, event, and stage contracts
- [ ] 01-02: Clean up configuration loading and provider boundary
- [ ] 01-03: Wire visible status/state projection into the CLI

### Phase 2: Visible Tool Loop & Permissions
**Goal**: Replace the current stub execution layer with a real transparent tool loop
**Depends on**: Phase 1
**Requirements**: [TRNS-01, TRNS-02, SAFE-01, SAFE-02]
**Success Criteria** (what must be TRUE):
  1. User can see real tool lifecycle events in the transcript, not placeholder metadata only
  2. Read-only tools execute without noisy prompts, while write/edit/bash actions pause for approval
  3. Blocking states such as waiting for permission or provider response are explicitly visible
**Plans**: TBD

Plans:
- [ ] 02-01: Implement stage-two execution contracts and tool handlers
- [ ] 02-02: Enforce permission policy in the live runtime path
- [ ] 02-03: Project tool lifecycle and wait states into the transcript UI

### Phase 3: Intent Routing & Task Modes
**Goal**: Make the runtime choose the right kind of turn instead of treating everything the same
**Depends on**: Phase 2
**Requirements**: [FLOW-01, FLOW-03, UX-01]
**Success Criteria** (what must be TRUE):
  1. User requests are visibly routed to answer, clarify, or execute paths
  2. Larger tasks enter an explicit multi-step flow instead of disappearing into a one-shot response
  3. The terminal interaction remains clean and low-noise while showing more runtime detail
**Plans**: TBD

Plans:
- [ ] 03-01: Implement stage-one answer/clarify/proceed decisions against real turn context
- [ ] 03-02: Define and surface lightweight vs heavier task flow behavior
- [ ] 03-03: Refine transcript/prompt UX around intent routing

### Phase 4: Session Continuity & Compaction
**Goal**: Make interrupted work resumable and long sessions sustainable
**Depends on**: Phase 3
**Requirements**: [SESS-01, SESS-02, SESS-03]
**Success Criteria** (what must be TRUE):
  1. User can restart the CLI and recover the latest session state from local artifacts
  2. Event history persists in a predictable append-only format that can be reloaded safely
  3. Long conversations can be compacted or summarized without losing the ability to continue work
**Plans**: TBD

Plans:
- [ ] 04-01: Wire session metadata and event log into the live runtime
- [ ] 04-02: Implement resume flow for the latest local session
- [ ] 04-03: Add basic compaction/summary support for long histories

### Phase 5: Reliability, Onboarding & v1 Polish
**Goal**: Make the system feel dependable, understandable, and easier to start using
**Depends on**: Phase 4
**Requirements**: [RELY-01, UX-02]
**Success Criteria** (what must be TRUE):
  1. Provider, config, and tool failures show actionable status instead of ambiguous fallback behavior
  2. User can get from install to first useful interaction with a short guided setup
  3. The resulting v1 CLI feels simpler and more trustworthy than the current skeleton
**Plans**: TBD

Plans:
- [ ] 05-01: Improve failure visibility and recovery guidance
- [ ] 05-02: Add setup/onboarding flow for minimal configuration
- [ ] 05-03: Harden and polish the end-to-end CLI experience

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Runtime Foundation & Boundaries | 0/3 | Not started | - |
| 2. Visible Tool Loop & Permissions | 0/3 | Not started | - |
| 3. Intent Routing & Task Modes | 0/3 | Not started | - |
| 4. Session Continuity & Compaction | 0/3 | Not started | - |
| 5. Reliability, Onboarding & v1 Polish | 0/3 | Not started | - |
