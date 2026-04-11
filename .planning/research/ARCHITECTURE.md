# Architecture Research

**Domain:** terminal-first transparent agent runtime / coding assistant
**Researched:** 2026-04-11
**Confidence:** MEDIUM

## Standard Architecture

### System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                     Terminal Interaction Layer              │
├─────────────────────────────────────────────────────────────┤
│  Prompt UI   Transcript UI   Permission UI   Status UI      │
├─────────────────────────────────────────────────────────────┤
│                   Runtime Orchestration Layer               │
├─────────────────────────────────────────────────────────────┤
│  Intent Router   Stage Controller   Tool Loop   Recovery    │
├─────────────────────────────────────────────────────────────┤
│                   Adapter / Persistence Layer               │
│  Provider Adapter   Tool Adapters   Event Log   Session Meta│
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Terminal UI | Collect input and render visible runtime state | React + Ink components with transcript projection |
| Intent router | Decide answer vs clarify vs execute | Small stage-one contract with explicit outputs |
| Execution loop | Run tools, gate permissions, emit events | Stage-two orchestrator that produces `tool_call` and `tool_result` events |
| Persistence | Resume and compact sessions | Append-only event log plus session metadata and summary artifacts |
| Provider adapter | Convert runtime messages into provider calls | Narrow module under `src/provider/` rather than runtime-wide coupling |

## Recommended Project Structure

```text
src/
├── core/              # Contracts, config, shared runtime types
├── runtime/           # Stage orchestration and task-mode logic
├── tools/             # Tool definitions and execution adapters
├── permissions/       # Approval policy and resolution
├── provider/          # Model/provider adapters
├── store/             # Event log, session metadata, compaction state
├── ui/                # Ink transcript, prompt, status, permission views
└── prompt/            # Message/event compilation for model calls
```

### Structure Rationale

- **`runtime/`:** the product is fundamentally a runtime, so orchestration should stay central and explicit
- **`provider/`:** keeps transport/model concerns separate from task execution logic
- **`store/`:** resume and compaction become much easier when persistence is a first-class layer instead of scattered helpers
- **`ui/`:** transcript rendering should be downstream of events, not mixed directly into execution logic

## Architectural Patterns

### Pattern 1: Event-first runtime visibility

**What:** Runtime actions become explicit events before they become UI
**When to use:** Always, if transparency is a product promise
**Trade-offs:** Slightly more ceremony, much better debuggability

**Example:**
```typescript
type EventRecord = {
  type: 'user_message' | 'tool_call' | 'tool_result' | 'assistant_text' | 'system_status'
  payload: Record<string, unknown>
}
```

### Pattern 2: Two-stage intent routing

**What:** A lightweight decision layer chooses answer / clarify / execute before the heavier tool loop begins
**When to use:** When the product wants both fast simple turns and explicit task execution
**Trade-offs:** More runtime states to model, better user trust and lower unnecessary execution cost

**Example:**
```typescript
type StageOneDecision =
  | { kind: 'answer'; text: string }
  | { kind: 'tool'; name: 'clarify' | 'proceed'; input: Record<string, unknown> }
```

### Pattern 3: Adapter boundaries for growth

**What:** Channels, providers, and tools attach to a stable runtime contract instead of reshaping it
**When to use:** When long-term scope includes many integrations
**Trade-offs:** Requires upfront discipline, but keeps the core runtime smaller and easier to reason about

## Data Flow

### Request Flow

```text
[User Input]
    ↓
[Prompt UI] → [Stage One Router] → [Answer | Clarify | Execute]
                                  ↓
                           [Stage Two Tool Loop]
                                  ↓
                        [Provider / Tool Adapters]
                                  ↓
                        [Event Log + UI Projection]
```

### State Management

```text
[Event Log / Session Meta]
    ↓
[Runtime State]
    ↓
[UI Projection]
    ↓
[Transcript + Status + Permission Views]
```

### Key Data Flows

1. **Turn routing:** user prompt becomes a stage-one decision, then either ends or enters stage two
2. **Execution visibility:** every meaningful transition emits an event that the UI can project directly
3. **Recovery:** persistent session artifacts feed resume and compaction instead of re-deriving state from UI memory

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1 primary users | Single-process CLI with local persistence is enough |
| Small team / daily use | Add stronger compaction, diagnostics, and provider retry handling |
| Multi-channel / always-on assistant | Add adapter boundaries for channels/gateway, but keep runtime contracts stable |

### Scaling Priorities

1. **First bottleneck:** hidden state drift between runtime and UI — fix by making event contracts authoritative
2. **Second bottleneck:** context growth across long sessions — fix with compaction/summaries tied to persisted session state

## Anti-Patterns

### Anti-Pattern 1: UI polish without runtime truth

**What people do:** Build a polished transcript while the underlying runtime state is fuzzy
**Why it's wrong:** Users still cannot tell what the system is actually doing
**Do this instead:** Make transcript rendering a direct projection of real runtime events

### Anti-Pattern 2: Letting integrations define the core

**What people do:** Pull channel/provider/gateway needs into the runtime before the core loop is stable
**Why it's wrong:** Core behavior becomes hard to simplify or trust
**Do this instead:** Stabilize the CLI runtime contract first, then adapt outward

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OpenAI-compatible LLM | Narrow provider adapter | Keep transport/config isolated in `src/provider/` |
| Future channels/gateway | Outer adapter layer | Do not let channel requirements leak into CLI runtime too early |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `runtime` ↔ `provider` | API/messages | Keep model-specific concerns out of the runtime state machine |
| `runtime` ↔ `ui` | Events/view models | UI should consume projected state, not orchestrate logic |
| `runtime` ↔ `store` | Persisted events/meta/summary | Recovery should be reproducible from stored artifacts |

## Sources

- `accorda/.planning/codebase/ARCHITECTURE.md`
- `24claude-code/README.md`
- `openclaw/README.md`

---
*Architecture research for: terminal-first transparent agent runtime / coding assistant*
*Researched: 2026-04-11*
