# Pitfalls Research

**Domain:** terminal-first transparent agent runtime / coding assistant
**Researched:** 2026-04-11
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Config sprawl disguised as flexibility

**What goes wrong:**
The system accumulates many config files, hidden defaults, and provider-specific switches until users cannot tell how behavior is controlled.

**Why it happens:**
Agent runtimes often grow by adding capabilities faster than they simplify setup.

**How to avoid:**
Keep a minimal config surface for v1, document defaults clearly, and centralize configuration ownership.

**Warning signs:**
Users need to touch multiple files to get started, or runtime behavior changes for reasons they cannot explain.

**Phase to address:**
Phase 1 and Phase 5

---

### Pitfall 2: Visible transcript, invisible runtime

**What goes wrong:**
The UI looks informative, but users still cannot tell why the system answered, clarified, paused, or executed.

**Why it happens:**
Developers polish message rendering before formalizing runtime states and transitions.

**How to avoid:**
Make stage changes, waits, permission blocks, and failures explicit runtime events with direct UI projection.

**Warning signs:**
The transcript shows outputs but not causes; debugging requires reading source instead of reading the session.

**Phase to address:**
Phase 1 through Phase 3

---

### Pitfall 3: Treating all requests like long-running agent tasks

**What goes wrong:**
Small asks feel slow and over-engineered, while long tasks remain confusing because there is no clear escalation path.

**Why it happens:**
The runtime never formalizes the difference between lightweight response flow and explicit execution flow.

**How to avoid:**
Keep a clear stage-one routing contract and only enter the heavier loop when needed.

**Warning signs:**
Simple questions trigger unnecessary tool flow, or large tasks remain one-shot black boxes.

**Phase to address:**
Phase 3

---

### Pitfall 4: Fake resume

**What goes wrong:**
The product claims recovery support, but restart only restores superficial transcript text and loses operational state.

**Why it happens:**
Resume is added late, after persistence and event contracts have already drifted.

**How to avoid:**
Tie resume to persisted event/session artifacts and ship basic compaction before claiming serious continuity.

**Warning signs:**
Restarted sessions look familiar but cannot safely continue work.

**Phase to address:**
Phase 4

---

### Pitfall 5: Pulling in OpenClaw-scale scope too early

**What goes wrong:**
Channels, gateways, adapters, and platform concerns consume the roadmap before the CLI runtime is trustworthy.

**Why it happens:**
The long-term product vision is exciting, and foundational runtime work can feel less glamorous.

**How to avoid:**
Keep v1 strictly CLI-first and measure progress by runtime clarity, not breadth of integrations.

**Warning signs:**
Roadmap conversations drift toward Telegram/gateway work while stage-two execution or resume is still incomplete.

**Phase to address:**
All phases, especially Phase 1

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded fallbacks instead of explicit failure states | Faster demos | Hides real runtime problems and weakens trust | Only very early spikes, not v1 runtime behavior |
| Handwritten payload guards everywhere | Quick local progress | Event schema drift becomes hard to manage | Acceptable only until a schema layer is introduced |
| Tool metadata without execution contracts | Lets UI progress early | Delays the hard part and invites misleading demos | Acceptable only for skeleton phase |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenAI-compatible providers | Assuming all "compatible" endpoints behave the same | Keep provider calls behind adapters and surface errors explicitly |
| Future channels/gateway | Letting inbound transport shape core runtime decisions | Treat channels as adapters over a stable runtime contract |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Reprojecting the full transcript forever | Slow or noisy long sessions | Add compaction and bounded rendering windows | Long conversations / frequent tool loops |
| Storing only UI state, not runtime state | Resume appears fast but breaks continuation | Persist event and session artifacts explicitly | As soon as users restart mid-work |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Dangerous tools without enforced approval | Unintended writes or shell execution | Make approval flow part of the execution path, not just metadata |
| Leaking provider details into many layers | Hard-to-audit credential and transport usage | Centralize provider logic in a dedicated adapter |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Too many visible controls too early | New users feel overwhelmed | Keep the first-run CLI narrow and default-driven |
| Cute transcript effects without causal clarity | Looks polished but not trustworthy | Prioritize state explanation over ornamental UI |

## "Looks Done But Isn't" Checklist

- [ ] **Tool loop:** Often missing real execution + permission enforcement — verify `tool_call` and `tool_result` come from actual runtime flow
- [ ] **Resume:** Often missing continued operability — verify restored sessions can continue safely, not just display old text
- [ ] **Transparency:** Often missing explicit wait/failure states — verify transcript shows why the runtime stopped or paused
- [ ] **Simple setup:** Often missing actionable diagnostics — verify bad config produces understandable recovery guidance

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Config sprawl | MEDIUM | Collapse config ownership, document defaults, remove duplicate switches |
| Fake resume | HIGH | Rebuild resume from authoritative persisted event/session state |
| Over-scoped v1 | HIGH | Cut roadmap back to CLI/runtime essentials and defer adapters |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Config sprawl | Phase 1 / Phase 5 | Minimal config surface exists and is documented |
| Invisible runtime state | Phase 1 / Phase 2 / Phase 3 | Stage/status/tool/wait events appear in transcript |
| Fake resume | Phase 4 | Restart can recover and continue session state safely |
| OpenClaw-scale scope creep | All phases | Roadmap remains CLI-first until v1 goals ship |

## Sources

- `accorda/.planning/codebase/CONCERNS.md`
- `24claude-code/README.md`
- `openclaw/README.md`
- User project direction captured during initialization on 2026-04-11

---
*Pitfalls research for: terminal-first transparent agent runtime / coding assistant*
*Researched: 2026-04-11*
