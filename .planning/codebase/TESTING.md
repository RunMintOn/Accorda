# Testing Patterns

**Analysis Date:** 2026-04-11

## Test Framework

**Runner:**
- Vitest 3.1.4
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in `expect`

**Run Commands:**
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

## Test File Organization

**Location:**
- Separate top-level `test/` directory rather than colocated test files

**Naming:**
- `*.test.ts` for logic modules such as `test/runtime-engine.test.ts`
- `*.test.tsx` for Ink UI tests such as `test/interactive-app.test.tsx`

**Structure:**
```text
test/
├── cli-boot.test.ts
├── config.test.ts
├── event-log-store.test.ts
├── interactive-app.test.tsx
├── message-list.test.tsx
├── permissions.test.ts
├── prompt-compiler.test.ts
├── recovery-baseline.test.ts
├── runtime-engine.test.ts
└── ui-event-projection.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
describe('runtime engine', () => {
  it('enters stage two after proceed...', async () => {
    const engine = createRuntimeEngine({ ... })
    const result = await engine.runTurn('session-1', 'hello')
    expect(result.returnedToStageOne).toBe(true)
  })
})
```

**Patterns:**
- One file per module or behavior slice
- `describe` + `it` style with direct assertions on returned values or rendered output
- UI tests use `render(...)`, interact through `stdin.write(...)`, and inspect `lastFrame()`

## Mocking

**Framework:** Mostly no explicit mocking framework usage

**Patterns:**
```typescript
const engine = createRuntimeEngine({
  runStageOne: async () => ({ kind: 'tool', name: 'proceed', input: {} }),
  runStageTwo: async () => ({ events: [] }),
})
```

**What to Mock:**
- Runtime collaborators are stubbed via dependency injection in `test/runtime-engine.test.ts`
- UI submit handlers are passed directly as props in `test/interactive-app.test.tsx`

**What NOT to Mock:**
- Event projection and store behavior are tested against real data structures in `test/ui-event-projection.test.ts` and `test/event-log-store.test.ts`

## Fixtures and Factories

**Test Data:**
```typescript
const base = {
  sessionId: 'session-test',
  timestamp: '2026-04-11T00:00:00.000Z',
}
```

**Location:**
- Inline inside each test file; no shared fixture directory exists

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
# No dedicated coverage script found in package.json
```

## Test Types

**Unit Tests:**
- Config loading, permission policy, prompt compilation, runtime orchestration, and store behavior

**Integration Tests:**
- Ink rendering and input submission flow in `test/interactive-app.test.tsx`
- Event-to-message projection in `test/ui-event-projection.test.ts`

**E2E Tests:**
- Not used

## Common Patterns

**Async Testing:**
```typescript
await new Promise(resolve => setTimeout(resolve, 100))
```

**Error Testing:**
```typescript
expect(projectEventsToMessages(events)).toEqual([
  {
    id: 'evt-bad',
    kind: 'system',
    level: 'warning',
    message: 'Malformed tool_call event: evt-bad',
    timestamp: base.timestamp,
  },
])
```

---

*Testing analysis: 2026-04-11*
