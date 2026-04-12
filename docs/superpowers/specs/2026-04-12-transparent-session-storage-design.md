# Transparent Session Storage Design

## Goal

Define the v1 storage model for Accorda's transparent runtime.

The goal is to make every model call and runtime decision traceable without turning the session history into a noisy raw dump.

## Design Summary

Accorda should use a session-scoped storage model:

```text
.accorda/runs/<sessionId>/
  session.json
  events.jsonl
  artifacts/
    model-calls/
    tool-results/
```

`events.jsonl` is the single timeline of truth. It records what happened and in what order.

`artifacts/` stores larger evidence referenced by events, such as full model request and response bodies or large tool results.

TUI and `/resume` should project their display from `events.jsonl`. They should not maintain a second source of truth.

## Session Metadata

`session.json` stores stable session metadata:

- schema version
- session id
- parent session id, when relevant
- created and updated timestamps
- workspace root
- mode

This file is metadata, not the conversation history.

## Event Log

The event log is append-only JSONL.

Each event should include:

- schema version
- event id
- session id
- turn id, when relevant
- timestamp
- type
- payload

v1 should record semantic boundaries, not internal implementation details.

Initial event types:

- `session_started`
- `user_message`
- `runtime_decision`
- `model_call_started`
- `model_call_finished`
- `tool_call`
- `tool_result`
- `assistant_text`
- `runtime_error`

The log should be detailed enough to explain why a final answer happened, but concise enough for humans and external agents to scan.

## Model Call Artifacts

Each model API call gets a `callId`.

Before sending the request, Accorda saves the exact API body that will be sent to the provider. The artifact may wrap that body with Accorda metadata, but the body itself should not be transformed.

Accorda should not collect headers, environment variables, or provider client config for v1. This preserves the model-facing request body while avoiding API key capture.

After the provider returns, Accorda saves the response body as a matching artifact.

The event log references these files through `callId` and artifact paths.

## Tool Result Artifacts

Small tool results can stay in the event payload as summaries.

Large tool results should be written under `artifacts/tool-results/`, with the event log keeping the `toolCallId`, success state, preview, and artifact path.

Tool failures should still be ordinary events, not runtime crashes.

## Display Projection

The TUI message list and `/resume` view should be derived from the event log.

For v1, no separate display transcript is required.

A projection cache such as `transcript.md` or `view.json` may be added later if replay becomes slow, but it must remain disposable and rebuildable.

## Out Of Scope

v1 does not require:

- SQLite or another database
- remote sync
- a separate display truth file
- full secret redaction rules
- recording every keystroke, render pass, function call, or temporary variable

## References

This design is influenced by:

- Claude Code's session transcript pattern, where `transcript.jsonl` supports resume and debugging
- OpenClaw's session boundary pattern, where JSONL storage is scoped by agent and session
- Accorda's own requirement that model calls remain inspectable through local artifacts
