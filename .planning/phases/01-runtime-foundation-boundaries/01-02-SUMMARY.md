---
phase: 01-runtime-foundation-boundaries
plan: 02
subsystem: provider
tags: [config, provider, openai-compatible, diagnostics, metadata]
requires:
  - phase: 01-01
    provides: explicit runtime turn-state contracts
provides:
  - nested provider config layer
  - normalized provider completion results
  - explicit config/provider failure diagnostics in defaultRunner
affects: [ui, phase-03, phase-04]
tech-stack:
  added: []
  patterns:
    - provider returns normalized structured metadata
    - runtime emits system_status for provider and config outcomes
key-files:
  created:
    - test/default-runner.test.ts
  modified:
    - src/core/config.ts
    - src/provider/openaiClient.ts
    - src/runtime/defaultRunner.ts
    - src/core/contracts.ts
    - src/runtime/stageOne.ts
    - src/runtime/stageTwo.ts
    - src/runtime/engine.ts
    - test/config.test.ts
key-decisions:
  - "Config now exposes a provider sub-object rather than top-level baseURL/apiKey/model fields."
  - "Provider adapter returns normalized metadata including usage/model/finishReason/raw when available."
  - "Runner failures surface explicit error status instead of echo fallback."
patterns-established:
  - "Runtime/provider boundary should preserve metadata and tolerate missing optional fields."
  - "system_status events are the mechanism for exposing provider/config diagnostics to the CLI."
requirements-completed: [CONF-01, CONF-02, FLOW-02]
duration: 20min
completed: 2026-04-11
---

# Phase 1: Runtime Foundation & Boundaries Summary

**Explicit provider config layering, normalized completion metadata, and visible runner diagnostics replaced the old text-only boundary**

## Performance

- **Duration:** 20 min
- **Started:** 2026-04-11T20:05:00+08:00
- **Completed:** 2026-04-11T20:08:00+08:00
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Nested provider configuration under a dedicated config layer
- Changed the OpenAI-compatible adapter to return structured completion metadata
- Replaced ambiguous `echo:` fallback behavior with explicit `system_status` diagnostics

## Task Commits

Each task was committed atomically where practical:

1. **Task 1: Keep config explicit and layered without expanding the user surface** - `c182959` (refactor)
2. **Task 2-3: Normalize provider results and surface explicit runner diagnostics** - `d411894` (feat)

## Files Created/Modified
- `src/core/config.ts` - Nests provider config and preserves a small required surface
- `src/provider/openaiClient.ts` - Returns normalized provider results with metadata
- `src/runtime/defaultRunner.ts` - Emits `system_status` events and explicit fallback text
- `src/core/contracts.ts` - Extends runtime turn results with provider metadata/status
- `test/config.test.ts` - Verifies nested provider config shape
- `test/default-runner.test.ts` - Covers metadata-rich, metadata-light, and config-failure paths

## Decisions Made
- Preserved the existing env variable names to avoid widening setup scope in Phase 1
- Treated `usage` as optional and stripped undefined metadata before event emission
- Classified missing `CONTEXTA_*` errors as config-source failures in runner diagnostics

## Deviations from Plan

### Auto-fixed Issues

**1. Mock hoisting issue in `vitest`**
- **Found during:** Task 2-3
- **Issue:** Initial `vi.mock` setup in `test/default-runner.test.ts` used top-level variables that fail under hoisting.
- **Fix:** Switched to `vi.hoisted(...)` so mocks are initialized before module import.
- **Files modified:** `test/default-runner.test.ts`
- **Verification:** `npm test -- test/config.test.ts test/default-runner.test.ts`
- **Committed in:** `d411894`

---

**Total deviations:** 1 auto-fixed
**Impact on plan:** No scope creep. The fix was necessary for the planned test coverage to run.

## Issues Encountered

None beyond the test-mocking issue above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The CLI layer can now consume runtime status plus provider metadata without inventing structure.
- `01-03` can render real runtime state and optional context usage from existing turn data.

---
*Phase: 01-runtime-foundation-boundaries*
*Completed: 2026-04-11*
