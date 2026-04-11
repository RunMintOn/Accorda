# Feature Research

**Domain:** terminal-first transparent agent runtime / coding assistant
**Researched:** 2026-04-11
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Interactive prompt + transcript loop | A CLI assistant without a clear conversation loop feels broken | LOW | Already partially present in `accorda/src/ui/` |
| Visible tool call stream | Users expect to see file reads, searches, edits, and shell calls in modern coding agents | MEDIUM | Critical to the product's transparency promise |
| Permission gate for dangerous actions | Trust collapses if write/exec actions are invisible or automatic | MEDIUM | Must be explicit for write/edit/bash |
| Session restore | CLI agent work is often interrupted; restart should not mean losing context | MEDIUM | At minimum restore transcript + local session metadata |
| Basic setup path | Users expect to get to first prompt quickly | LOW | "Simple config surface" is part of the product, not just tooling |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Two-layer intent routing | Makes small asks feel lightweight while keeping bigger tasks structured | HIGH | This is one of the clearest product-method differentiators |
| Highly explicit runtime state | Lets users understand why the system is answering, clarifying, waiting, or executing | MEDIUM | Strong contrast against "black box" agent loops |
| Low-config, low-noise CLI | Makes the product friendlier than sprawling agent systems | MEDIUM | Requires discipline in defaults, prompts, and config design |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Multi-channel support in v1 | It feels like the "real" OpenClaw direction | It explodes scope before the runtime contract is stable | Keep channels as v2+ adapters |
| Huge slash-command surface | Feels powerful on demos | Creates cognitive load and weakens the "simple by default" goal | Keep flows task-oriented and expose advanced controls gradually |
| Grammar/DSL-first protocol design | Feels rigorous and architecturally pure | Risks solving the wrong problem before runtime behavior is validated | Start with clean contracts + events, add stricter grammar only if needed |

## Feature Dependencies

```text
[Visible tool stream]
    └──requires──> [Real stage-two execution]
                       └──requires──> [Permission policy wiring]

[Session restore]
    └──requires──> [Persistent event/session stores]

[Two-layer intent routing]
    └──enhances──> [Transparent runtime state]

[Multi-channel support] ──conflicts──> [Tight v1 CLI focus]
```

### Dependency Notes

- **Visible tool stream requires real stage-two execution:** transcript transparency is shallow unless there is an actual execution loop to observe
- **Session restore requires persistence:** resume should be driven by stored event/session artifacts, not in-memory React state
- **Two-layer intent routing enhances transparency:** explicit stage boundaries give users a mental model of what the runtime is doing
- **Multi-channel support conflicts with v1 focus:** it would pull architecture toward adapters and deployment before the CLI runtime is trustworthy

## MVP Definition

### Launch With (v1)

- [ ] Explicit answer / clarify / execute routing — essential to the product method
- [ ] Visible tool invocation + permission flow — essential to trust
- [ ] Session restore + basic compaction/summary — essential for continued real use
- [ ] Minimal OpenAI-compatible setup — essential for low-friction onboarding
- [ ] Clean terminal transcript UX — essential for usability and perceived clarity

### Add After Validation (v1.x)

- [ ] Guided setup/onboarding refinements — add after the runtime loop is stable
- [ ] Better diagnostics and recovery helpers — add once primary failure modes are known
- [ ] Richer task-mode controls — add after the basic two-layer model proves useful

### Future Consideration (v2+)

- [ ] Telegram/channel/gateway integrations — add after CLI runtime contracts stabilize
- [ ] GUI/web configuration editor — add when the config model is worth exposing visually
- [ ] Multi-provider first-class support — add after the provider adapter boundary is mature

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Visible tool + permission flow | HIGH | MEDIUM | P1 |
| Answer / clarify / execute routing | HIGH | HIGH | P1 |
| Session restore | HIGH | MEDIUM | P1 |
| Basic compaction/summary | MEDIUM | MEDIUM | P1 |
| Guided setup | MEDIUM | LOW | P2 |
| GUI config editor | MEDIUM | HIGH | P3 |
| Multi-channel integrations | HIGH | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Competitor A | Competitor B | Our Approach |
|---------|--------------|--------------|--------------|
| Product scope | `openclaw` optimizes for broad assistant/platform reach | `24claude-code` optimizes for terminal coding-agent interaction | Keep Accorda focused on runtime clarity first, then expand outward |
| Tool transcript UX | `openclaw` is not primarily centered on terminal coding transcript UX | `24claude-code` shows strong terminal interaction patterns | Use Claude-style terminal ergonomics where they serve transparency |
| Runtime complexity | `openclaw` accepts large-system complexity to support many channels/adapters | `24claude-code` has broad CLI scope with many subsystems | Deliberately keep v1 smaller and more legible |

## Sources

- `accorda/.planning/codebase/*.md`
- `24claude-code/README.md`
- `openclaw/README.md`

---
*Feature research for: terminal-first transparent agent runtime / coding assistant*
*Researched: 2026-04-11*
