---
phase: 04-multi-session-tabs
plan: "01"
subsystem: testing
tags: [vitest, react-testing-library, tdd, red-phase, useSessionManager, SessionTabBar, usePty]

requires:
  - phase: 03-voice-io
    provides: usePty, test infrastructure, setup.ts with jsdom mocks

provides:
  - RED test scaffolds for all 6 SESS requirements
  - tests/useSessionManager.test.ts covering SESS-01, SESS-03, SESS-04, SESS-05
  - tests/SessionTabBar.test.tsx covering SESS-02
  - usePty.test.ts extended with sessionId assertion for SESS-06

affects: [04-multi-session-tabs]

tech-stack:
  added: []
  patterns:
    - "@ts-expect-error import pattern for Wave 0 RED scaffolds (modules don't exist yet)"
    - "useSessionManager contract-first testing: spawn/close/updateName/updateStatus/history"
    - "SessionTabBar data-session-id attribute pattern for test selectors"

key-files:
  created:
    - tests/useSessionManager.test.ts
    - tests/SessionTabBar.test.tsx
  modified:
    - tests/usePty.test.ts

key-decisions:
  - "Wave 0 RED tests import non-existent modules via @ts-expect-error so Vitest runs RED without TypeScript blocking compilation"
  - "SessionTabBar tests use data-session-id attribute selectors to find specific tab elements by ID"
  - "updateName idempotency after first call is explicitly tested — second call must not change the name"
  - "localStorage key slopmop_sessions_${cwd} established as the per-cwd session history key"

patterns-established:
  - "Wave 0 scaffold: write tests against @ts-expect-error imports before any implementation exists"
  - "usePty sessionId test structure: new describe block appended to existing test file, shares MockWebSocket setup"

requirements-completed: [SESS-01, SESS-02, SESS-03, SESS-04, SESS-05, SESS-06]

duration: 6min
completed: 2026-05-01
---

# Phase 4 Plan 01: Wave 0 RED Test Scaffolds Summary

**TDD Wave 0 scaffolds for multi-session tabs: failing tests define useSessionManager and SessionTabBar contracts before any implementation exists**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-01T15:46:00Z
- **Completed:** 2026-05-01T15:52:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `tests/useSessionManager.test.ts` with 14 failing tests covering spawn, close, naming, status, and history
- Created `tests/SessionTabBar.test.tsx` with 6 failing tests covering tab rendering, active class, click handlers, and status chips
- Extended `tests/usePty.test.ts` with `sessionId in protocol` describe block that fails RED because sessionId is not yet in the start message
- Confirmed no regressions — all previously-passing tests remain green

## Task Commits

1. **Task 1: Write failing tests for useSessionManager** - `a5391e9` (test)
2. **Task 2: Write failing tests for SessionTabBar + extend usePty test** - `6b95032` (test)

## Files Created/Modified

- `tests/useSessionManager.test.ts` - RED tests for SESS-01, SESS-03, SESS-04, SESS-05 (spawn, close, naming, status, history)
- `tests/SessionTabBar.test.tsx` - RED tests for SESS-02 (tab rendering, active state, click handlers)
- `tests/usePty.test.ts` - Extended with `sessionId in protocol` describe block for SESS-06

## Decisions Made

- `SessionTabBar` tests use `data-session-id` attribute as selector anchor — implementation must include this attribute on tab elements
- `updateName` idempotency: the test explicitly asserts second call does NOT change the name (this is the contract Wave 1 must honor)
- localStorage key format `slopmop_sessions_${cwd}` is locked in by the tests — consistent with existing `slopmop_ui_${cwd}` pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — the @ts-expect-error import pattern worked cleanly. Pre-existing failures in FilePreview.test.tsx and FileTree.test.tsx were present before this plan and are unrelated.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 0 scaffolds complete — all 6 SESS requirement contracts are defined in failing tests
- Ready for 04-02: implement `useSessionManager` (GREEN phase for SESS-01, SESS-03, SESS-04, SESS-05)
- Ready for 04-03: implement `SessionTabBar` component (GREEN phase for SESS-02)
- Ready for 04-04: add `sessionId` to usePty start protocol (GREEN phase for SESS-06)

---
*Phase: 04-multi-session-tabs*
*Completed: 2026-05-01*
