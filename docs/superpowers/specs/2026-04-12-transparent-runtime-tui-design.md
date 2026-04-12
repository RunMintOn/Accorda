# Transparent Runtime TUI Design

## Goal

Stage 4 upgrades the TUI from a simple event list into a clearer local-agent interface.

This stage has two goals:

- align the overall shell and reading rhythm with Claude Code
- make Accorda's runtime and tool activity easier to understand without turning the UI into a raw log dump

The product difference stays in semantics, not in a radically different shell.

## Current Baseline

Current TUI behavior is still event-shaped:

- `projectEventsToMessages()` maps each event into one renderable message
- `tool_call` and `tool_result` are rendered as separate rows
- `system_status` is flattened into plain text system lines
- the empty state and outer shell are functional but still skeletal

This is easy to implement, but it reads more like a transcript than a mature agent interface.

## Scope

In scope:

- update the outer TUI shell so the welcome state, message area, and input rhythm feel closer to Claude Code
- replace direct tool event rendering with a projected execution-flow view
- merge `tool_call` and `tool_result` into one visible tool step block
- keep `system_status` visible, but separate from tool step blocks
- add a small tool-specific projection layer for titles and summaries

Out of scope:

- transcript expansion or inline full-output viewers
- grouped multi-tool batches like Claude Code's richer tool grouping
- redesigning the runtime event schema
- memory UI, task mode UI, or multi-agent UI
- heavy visual branding work beyond Accorda naming and logo treatment

## Design Summary

Stage 4 should change the TUI projection pipeline:

1. raw runtime events remain the source of truth
2. the UI derives a step-oriented view model from those events
3. renderers display that view model as a cleaner execution flow

This keeps runtime transparency while avoiding a one-row-per-event interface.

The shell should stay familiar:

- Claude Code-like outer layout and pacing
- Accorda name and logo
- Accorda-specific runtime semantics in status text and execution flow

## UI Model

### Standard Messages

These continue to render as direct messages:

- `user_message`
- `assistant_text`

### Tool Step Blocks

`tool_call` and the matching `tool_result` should project into one tool step block.

The block is the main unit of execution-flow display. It should show only:

- title
- status
- short summary

The step block status set stays intentionally small in v1:

- `running`
- `ok`
- `error`

Mapping:

- `tool_call` without a matching result -> `running`
- successful `tool_result` -> `ok`
- failed `tool_result` -> `error`

### System Status Lines

`system_status` should not be merged into tool step blocks.

It should render as a lighter runtime-status line that explains what the system is doing, for example:

- routing decisions
- provider/config failures
- permission waits

This keeps tool steps focused on concrete actions while preserving runtime transparency.

## Tool Projection Rules

Stage 4 should not summarize tool output by borrowing a later assistant sentence. It also should not rely on dumping raw JSON or blindly truncating large output.

Instead, the UI should introduce a small projection layer:

- common tools get explicit title and summary rules
- unknown tools fall back to a generic rule

Examples:

- `read`
  - title: `Read package.json`
  - summary: `Read file`

- `bash`
  - title: `Ran npm test`
  - summary:
    - short useful output preview when safe
    - otherwise `...+N lines`
    - failure summary when failed

- `grep` or `glob`
  - title based on the query
  - summary based on match count or a short preview

Fallback behavior:

- title: tool name plus key input
- summary: `completed` or `failed`

This is intentionally modest. v1 only needs enough projection logic to make the common path readable.

## Output Handling

Stage 4 should keep the main view compact:

- do not inline large file contents
- do not inline long command output
- do not add transcript expansion in this stage

When output is too large, the step block should show a compact omission hint such as `...+27 lines`.

The event log remains the full-fidelity source; the TUI is a readable projection.

## Architectural Direction

The current `projectEventsToMessages()` path is too flat for this UI.

Stage 4 should move toward:

- event records
- projected render model
- message/step renderers

That likely means:

- introducing a new projected step/message type for tool blocks
- matching tool calls with tool results by `toolCallId`
- keeping malformed events visible as warnings instead of silently dropping them

The design should preserve the current testing philosophy: deterministic event input, deterministic UI projection output.

## Testing Requirements

Stage 4 implementation should prove:

- `tool_call` and `tool_result` project into one step block
- step block status transitions are correct
- tool-specific title and summary rules work for common tools
- large outputs collapse into omission hints instead of flooding the UI
- `system_status` remains visible but separate from tool blocks
- existing malformed-event warnings still surface

## Acceptance Criteria

Stage 4 is complete when:

- the outer TUI shell feels materially closer to Claude Code
- user and assistant messages still render directly
- tool activity reads as one execution flow made of step blocks
- step blocks show title, status, and short summary only
- runtime status remains visible without being mixed into tool blocks
- the UI stays a consistent projection of the underlying event log
