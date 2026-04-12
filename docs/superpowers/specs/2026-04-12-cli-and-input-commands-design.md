# CLI And Input Commands Design

## Goal

Stage 5 adds two missing interaction layers that make Accorda usable as a real local tool:

- a real editable input box inside the TUI
- a minimal command system shared between TUI slash commands and outer CLI flags

This stage is not about building a rich terminal editor or a complex command framework. It is about making the common path usable for both humans and agents.

## Current Baseline

Current behavior has two clear gaps:

- the TUI input area is only a bordered text display driven by raw `stdin` appends
- there is no command system for `/new`, `/resume`, `/help`, or outer CLI flags like `--resume`

The current TUI can start, display runtime state, and render tool steps, but session control and command-driven flows are still missing.

## Scope

In scope:

- replace the current fake input area with a real editable single-buffer input model
- add TUI slash commands:
  - `/new`
  - `/resume`
  - `/help`
- add outer CLI flags:
  - default `accorda` starts a new session
  - `accorda --resume`
  - `accorda --help`
- share command definitions between TUI and outer CLI entry points
- support a minimal recent-session picker for resume

Out of scope:

- `/init`
- `--new`
- fuzzy search, paging, or advanced history filtering for resume
- command autocompletion
- multi-pane command palettes
- guaranteeing identical key behavior in every terminal emulator

## Design Summary

Stage 5 should introduce one shared command definition layer with two adapters:

1. a TUI slash-command adapter for input beginning with `/`
2. a CLI flag adapter for process arguments

The command registry is the single place where command names, descriptions, and handlers are defined.

This keeps command semantics aligned:

- `/resume`
- `accorda --resume`

should ultimately invoke the same logical command behavior, even though their presentation differs.

## Command Set

### TUI Commands

- `/new`
  - start a new session without leaving the running TUI
- `/resume`
  - show recent sessions and let the user choose one
- `/help`
  - show supported commands inside the current TUI

### Outer CLI

- `accorda`
  - start a new session and open the TUI
- `accorda --resume`
  - show recent sessions, let the user choose one, then open the TUI with that session loaded
- `accorda --help`
  - print help text and exit

`--new` is intentionally omitted because the default `accorda` invocation already means "start a new session."

## Input Model

Stage 5 should replace the current append-only prompt behavior with a small editable input state.

The new input box should support:

- cursor position
- insertion at the cursor
- backspace deletion
- left and right cursor movement
- multi-line text in one input buffer
- no-op submission when the buffer is empty

Key behavior for v1:

- `Enter` inserts a newline
- `Ctrl+Enter` submits the current buffer

This key choice is intentionally scoped to the user's current terminal environment. Stage 5 does not promise identical `Ctrl+Enter` behavior across every terminal emulator.

## Resume Flow

`resume` should be intentionally simple in v1.

Behavior:

1. collect recent sessions from `.accorda/runs/*`
2. derive lightweight list entries:
   - index
   - session id
   - updated time
   - last user message preview
3. show that list
4. accept a numeric selection
5. read that session's `events.jsonl`
6. project those events back into the TUI

This applies to both:

- `/resume`
- `accorda --resume`

The UI may differ, but the selection model should stay the same.

## Session Semantics

Stage 5 should make the session model explicit:

- launching `accorda` creates a new session
- `/new` creates a new session without restarting the process
- `/resume` and `--resume` load an existing session's event history

The resumed session should become the current session for future turns, not just a read-only transcript preview.

## UI State Handling

The TUI input area now needs two modes:

- normal compose mode
- resume-selection mode

Both modes should reuse the same input area instead of introducing a separate complex picker UI.

Examples:

- normal mode:
  - user types a message or slash command
- resume mode:
  - the app shows recent sessions
  - the input expects a number

This keeps Stage 5 small and avoids a new interaction subsystem.

## Help Output

TUI `/help` should render a short assistant-style help message showing:

- `/new`
- `/resume`
- `/help`

Outer CLI `--help` should print:

- usage
- available flags
- one-line descriptions

The wording can differ slightly, but both should come from the same command definitions where possible.

## Architectural Direction

Stage 5 likely requires these new boundaries:

- command registry
- TUI command parser
- CLI argument parser
- input buffer state reducer or equivalent focused helper
- recent-session loader over `.accorda/runs`

The current `src/index.tsx` entry point is too thin for outer CLI flags. It should delegate to a CLI bootstrap layer that decides:

- print help and exit
- resume a session
- launch a fresh TUI session

## Error Handling

Stage 5 should handle these failures clearly:

- no resumable sessions found
- invalid resume selection
- selected session file missing
- malformed session event log
- unsupported key sequence for submit in a given terminal

Failures should remain visible in the TUI or CLI output rather than silently falling back.

## Testing Requirements

Stage 5 implementation should prove:

- the input buffer supports cursor movement, insertion, deletion, and multi-line editing
- `Enter` adds a newline instead of submitting
- `Ctrl+Enter` submits in the tested terminal environment
- `/new`, `/resume`, and `/help` parse correctly inside the TUI
- `accorda --help` and `accorda --resume` parse correctly outside the TUI
- resume lists recent sessions and loads a selected session's event history
- invalid resume selections and missing histories produce clear errors

## Acceptance Criteria

Stage 5 is complete when:

- the TUI input box is truly editable instead of append-only
- `Enter` inserts newline text
- `Ctrl+Enter` submits in the supported environment
- `/new`, `/resume`, and `/help` work inside the TUI
- `accorda` starts a new session by default
- `accorda --resume` restores a previous session
- `accorda --help` prints usable help text
- TUI and CLI commands share one consistent command definition layer
