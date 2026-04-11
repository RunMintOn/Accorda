# Stack Research

**Domain:** terminal-first transparent agent runtime / coding assistant
**Researched:** 2026-04-11
**Confidence:** MEDIUM

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | 5.8.x | Shared type contracts across runtime, tools, persistence, and UI | Strong typing is valuable when the product itself is a stateful runtime with many event shapes and boundaries |
| Node.js | 20+ LTS | CLI runtime, filesystem, child process, and ecosystem compatibility | The project needs stable terminal tooling, package ecosystem depth, and local OS integrations more than raw novelty |
| React + Ink | React 18.x + Ink 5.x | Terminal UI composition | This matches the current codebase and supports Claude-Code-like transcript ergonomics without inventing a custom renderer |
| OpenAI SDK | 4.x | OpenAI-compatible provider transport | Good default transport for an OpenAI-compatible surface while keeping provider logic isolated in one module |
| Zod | 3.x | Runtime validation for config, tool inputs, and event payloads | Transparent runtimes need schema clarity; handwritten checks do not scale well as the protocol grows |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 3.x | Unit and interaction testing | Use for runtime contracts, event projection, persistence, and CLI behavior regression tests |
| ink-testing-library | 4.x | Render and interact with the terminal UI in tests | Use for transcript rendering, keyboard flow, and permission prompt behavior |
| commander | 14.x | Optional command/entrypoint management | Use if the CLI grows beyond a single interactive entry and needs structured subcommands |
| pino | 9.x | Optional structured diagnostics | Use if runtime tracing outgrows event-only visibility and needs separate developer diagnostics |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `tsx` | Run TypeScript directly during development | Already used by `npm run dev`; keeps iteration fast |
| TypeScript strict mode | Catch protocol drift early | Already enabled; keep it strict as event and tool contracts expand |
| git-backed planning docs | Preserve product and runtime decisions | Useful here because the product direction is still being shaped |

## Installation

```bash
# Core
npm install react@18 ink@5 openai@4 zod@3

# Supporting
npm install commander@14 pino@9

# Dev dependencies
npm install -D typescript@5 tsx@4 vitest@3 ink-testing-library@4
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| React + Ink | Custom TTY renderer | Only if Ink becomes a real blocker for fine-grained rendering or performance |
| OpenAI SDK behind adapter | Provider-specific clients throughout the codebase | Only if a single provider becomes permanently fixed, which is not the current design goal |
| TypeScript + Zod contracts | Pure handwritten runtime guards | Only in very small modules; not as the main protocol strategy |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Channel/gateway dependencies in v1 core runtime | They drag product complexity into the part that should stay smallest and clearest | Keep runtime core local and add channel adapters later |
| Provider-specific logic inside stage orchestration | Makes runtime evolution and debugging harder | Keep provider calls behind `src/provider/` boundaries |
| UI-only transparency with hidden backend state | Produces a pretty transcript but not a trustworthy runtime | Make events, waits, permissions, and recovery state first-class |

## Stack Patterns by Variant

**If the product stays CLI-first longer than expected:**
- Keep React + Ink as the main interface
- Because it supports iteration on transcript UX without introducing web-app complexity

**If channels/gateway become active later:**
- Keep the runtime contract stable and add adapter layers around it
- Because the runtime should outlive any one provider, channel, or control plane

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `react@18.x` | `ink@5.x` | Matches the current codebase setup |
| `typescript@5.x` | `tsx@4.x` | Current local development path |
| `openai@4.x` | Node 18+ / 20+ | Fine for local OpenAI-compatible transport use |

## Sources

- Local codebase: `accorda/package.json`, `accorda/src/`, `accorda/.planning/codebase/STACK.md`
- Local reference: `24claude-code/README.md` — terminal architecture and interaction patterns
- Local reference: `openclaw/README.md`, `openclaw/package.json` — long-term assistant/runtime product shape

---
*Stack research for: terminal-first transparent agent runtime / coding assistant*
*Researched: 2026-04-11*
