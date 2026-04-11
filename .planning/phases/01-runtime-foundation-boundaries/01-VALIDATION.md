---
phase: 1
slug: runtime-foundation-boundaries
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- test/runtime-engine.test.ts test/config.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- test/runtime-engine.test.ts test/config.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | FLOW-02 | T-01-01 | Malformed or incomplete runtime state cannot silently pass as valid stage data | unit | `npm test -- test/runtime-engine.test.ts` | ✅ | ⬜ pending |
| 1-01-02 | 01 | 1 | FLOW-02 | T-01-02 | Event projection handles explicit runtime/system status without crashing UI translation | unit | `npm test -- test/message-list.test.tsx` | ✅ | ⬜ pending |
| 1-02-01 | 02 | 2 | CONF-01 | T-02-01 | Config surface stays explicit and rejects missing required provider settings | unit | `npm test -- test/config.test.ts` | ✅ | ⬜ pending |
| 1-02-02 | 02 | 2 | CONF-02 | T-02-02 | Provider metadata remains available to runtime without exposing secrets to UI | unit | `npm test -- test/default-runner.test.ts` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 3 | FLOW-02 | T-03-01 | CLI renders runtime state from runtime truth rather than local loading booleans | ui | `npm test -- test/interactive-app.test.tsx test/message-list.test.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/default-runner.test.ts` — add coverage for normalized provider result handling and explicit config/provider diagnostics

---

## Manual-Only Verifications

All phase behaviors should have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

