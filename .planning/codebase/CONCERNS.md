# Codebase Concerns

**Analysis Date:** 2026-04-11

## Tech Debt

**Stage-two execution is still a stub:**
- Issue: The architecture advertises a two-stage runtime, but `src/runtime/defaultRunner.ts` returns no stage-two events and `src/runtime/stageTwo.ts` only defines types
- Files: `src/runtime/defaultRunner.ts`, `src/runtime/stageTwo.ts`, `src/runtime/engine.ts`
- Impact: The app can answer or echo text, but cannot yet execute a real tool loop
- Fix approach: Implement stage-two orchestration, wire it to the tool registry, and emit persisted `tool_call` / `tool_result` events

**Builtin tools are metadata, not implementations:**
- Issue: Files under `src/tools/builtin/` only export a `{ name }` object
- Files: `src/tools/builtin/bash.ts`, `src/tools/builtin/edit.ts`, `src/tools/builtin/glob.ts`, `src/tools/builtin/grep.ts`, `src/tools/builtin/ls.ts`, `src/tools/builtin/read.ts`, `src/tools/builtin/write.ts`
- Impact: The registry in `src/tools/registry.ts` describes tool intent, but nothing can actually run those tools yet
- Fix approach: Add executable tool handlers and connect them to permission gating plus runtime events

## Known Bugs

**Permission dialog is never reachable in the main app path:**
- Symptoms: No permission prompt can appear during a session
- Files: `src/ui/App.tsx`, `src/ui/components/PermissionDialog.tsx`
- Trigger: Any operation that should require confirmation
- Workaround: None in the current checked-in runtime; `pendingPermissionRequest` is hardcoded to `null`

## Security Considerations

**Provider endpoint trust is broad:**
- Risk: `CONTEXTA_BASE_URL` can point at any OpenAI-compatible endpoint, with no allowlist, timeout policy, or response-shape hardening
- Files: `src/core/config.ts`, `src/provider/openaiClient.ts`
- Current mitigation: Required env vars must be present before startup
- Recommendations: Add endpoint validation, request timeout/retry policy, and provider capability checks before use

**Sensitive operations are designed but not enforced end to end:**
- Risk: Permission policy exists, but the actual execution path does not yet mediate real write/edit/bash calls
- Files: `src/permissions/policy.ts`, `src/tools/registry.ts`, `src/ui/App.tsx`
- Current mitigation: Dangerous tools are marked `requiresConfirmation: true` in metadata
- Recommendations: Enforce the policy in runtime execution rather than only in registry declarations

## Performance Bottlenecks

**Transcript rendering scales linearly with full history:**
- Problem: `src/ui/App.tsx` stores all events in memory and reprojects the full list through `projectEventsToMessages(...)`
- Files: `src/ui/App.tsx`, `src/ui/events/projectEvents.ts`, `src/ui/messages/MessageList.tsx`
- Cause: No compaction, windowing, or incremental projection strategy exists
- Improvement path: Persist long histories, stream partial updates, and render a bounded window for large sessions

## Fragile Areas

**UI behavior depends on raw stdin event handling:**
- Files: `src/ui/components/PromptInput.tsx`, `test/interactive-app.test.tsx`
- Why fragile: Input parsing manually handles backspace and newline variants and depends on terminal-specific data events
- Safe modification: Keep changes covered by interaction tests and test both typed characters and submit paths
- Test coverage: Basic happy-path coverage exists; edge cases like paste, IME, and multi-byte input are not covered

**Event payload validation is handwritten:**
- Files: `src/ui/events/projectEvents.ts`, `src/core/contracts.ts`
- Why fragile: The renderer trusts loosely typed `payload: Record<string, unknown>` and narrows it by hand
- Safe modification: Preserve exhaustive event-type handling and add tests whenever event schemas change
- Test coverage: Good warning-path coverage exists, but schema evolution is still manual

## Scaling Limits

**Single-process local CLI only:**
- Current capacity: One local interactive session path centered on `runLocalTurn('local', text)`
- Limit: No multi-session coordinator, no channel adapters, no background workers
- Scaling path: Introduce session persistence wiring, channel abstraction, and stage-two execution workers

## Dependencies at Risk

**`openai` SDK against arbitrary compatible providers:**
- Risk: "Compatible" providers often diverge on message/tool schemas and error formats
- Impact: Provider calls in `src/provider/openaiClient.ts` may fail even when env vars are valid
- Migration plan: Introduce a provider adapter layer rather than calling a single chat completion surface directly

## Missing Critical Features

**Core runtime features listed in README are not delivered yet:**
- Problem: `README.md` explicitly says Telegram/gateway/channels, full task mode, compaction/summaries, and precise mid-run resume are not included yet
- Blocks: The app remains a local CLI skeleton rather than the broader assistant platform implied by the project direction

## Test Coverage Gaps

**Persistence wiring and provider behavior are not end-to-end tested:**
- What's not tested: `src/provider/openaiClient.ts`, `src/store/sessionMetaStore.ts`, and the real runtime path that should connect UI, provider, permissions, and persistence
- Files: `src/provider/openaiClient.ts`, `src/store/sessionMetaStore.ts`, `src/runtime/defaultRunner.ts`
- Risk: Integration breaks can slip through while unit tests still pass
- Priority: High

**Tool execution path has no behavioral coverage because it does not exist yet:**
- What's not tested: Real execution of `ls`, `read`, `write`, `edit`, `glob`, `grep`, or `bash`
- Files: `src/tools/builtin/*.ts`, `src/tools/registry.ts`, `src/runtime/stageTwo.ts`
- Risk: Stage-two implementation could land without guardrails
- Priority: High

---

*Concerns audit: 2026-04-11*
