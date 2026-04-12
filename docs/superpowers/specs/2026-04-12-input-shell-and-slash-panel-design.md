# Input Shell And Slash Panel Design

## Goal

This follow-up design tightens the Stage 5 input experience so the TUI feels visibly interactive instead of merely technically editable.

The goal is not to add new command semantics. The goal is to make the input shell, visible cursor, and slash-command feedback feel clear and legible in the terminal.

## Why This Follow-Up Exists

Stage 5 added real input state and command behavior, but the current presentation still has UX gaps:

- the empty state does not clearly look editable
- the cursor is not visible when the buffer is empty
- slash commands still feel like blind typing
- the input row and the helper area are visually mixed together

The result is functionally better than before, but still not close enough to the clarity shown in tools like Claude Code and Qwen Code.

## Scope

In scope:

- make the bottom input area read as a real input shell even when empty
- always show a visible cursor in the input line
- separate the input line from the helper/candidate area
- add a lightweight slash-command panel that appears immediately when input starts with `/`
- keep `/new`, `/resume`, and `/help` on the same command layer

Out of scope:

- new command semantics
- fuzzy matching or complex command palette navigation
- multi-column command browsers
- arrow-key selection in the slash panel
- changing the outer runtime or session model

## Design Summary

The bottom area should become a fixed two-layer shell:

1. the editable input line
2. the contextual helper panel below it

This means:

- the input line is always the place where text is edited
- the lower panel is always the place where hints, slash candidates, or resume options are shown

The two areas should not impersonate each other.

## Input Line

The input line should always render a prompt marker plus a visible cursor.

Examples:

Empty:

```text
> |
```

Normal text:

```text
> read package|
```

Slash command:

```text
> /re|
```

Requirements:

- prompt marker is always visible
- cursor is always visible, including empty state
- placeholder text is no longer rendered as if it were the editable value
- left and right cursor movement should become visually obvious because the cursor position moves inside the line

## Helper Panel

The line below the input should be a contextual panel, not part of the editable text itself.

It has three roles:

- show a light hint in normal empty/editing mode
- show command candidates in slash mode
- show session choices in resume-selection mode

This mirrors the separation visible in tools like Qwen Code:

- top line: edit
- lower region: guidance or selection

## Slash Command Layer

Slash commands remain one semantic layer:

- `/new`
- `/resume`
- `/help`

They are peers semantically.

What changes here is only the immediate UI feedback:

- as soon as the first character is `/`, the helper panel switches into command mode
- it lists matching commands and their one-line descriptions

Examples:

```text
> /|
new      start a new session
resume   resume a recent session
help     show available commands
```

```text
> /re|
resume   resume a recent session
```

The user should not need to remember commands blindly before seeing feedback.

## Resume As A Multi-Step Command

`/resume` is still on the same slash-command layer as `/new` and `/help`.

The only difference is interaction flow:

- `/help` finishes in one step
- `/new` finishes in one step
- `/resume` finishes in two steps because it opens a session selection flow

That does not make `/resume` a higher-level command. It only makes it a command with a follow-up selection step.

## State Model

The input shell should render from a small, explicit UI state model:

- `empty`
- `editing`
- `command_mode`
- `resume_select`

Meaning:

- `empty`
  - blank input line with visible cursor
  - helper panel shows a light prompt hint
- `editing`
  - normal text editing
  - helper panel stays minimal
- `command_mode`
  - input begins with `/`
  - helper panel shows matching slash commands
- `resume_select`
  - `/resume` has already been invoked
  - helper panel shows recent session options
  - input line now expects a numeric selection

This keeps the semantics clean:

- commands remain one layer
- the UI simply reflects different interaction phases

## Testing Requirements

The follow-up implementation should prove:

- the input line renders a visible cursor even when empty
- left/right cursor movement changes visible cursor placement
- slash mode appears as soon as input starts with `/`
- slash candidate filtering works for `/new`, `/resume`, and `/help`
- resume selection still uses the helper panel without collapsing back into a generic message list

## Acceptance Criteria

This follow-up is complete when:

- the user can clearly identify the editable input line at all times
- the empty state still shows a cursor
- slash commands provide immediate visible feedback
- the helper panel is visually distinct from the editable line
- `/resume` remains a peer slash command while still opening a follow-up selection flow
