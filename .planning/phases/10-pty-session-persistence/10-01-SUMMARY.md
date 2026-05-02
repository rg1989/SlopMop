---
phase: 10-pty-session-persistence
plan: "01"
subsystem: testing
tags: [tdd, wave-0, pty, session-persistence, red-tests]
dependency_graph:
  requires: []
  provides: [wave-0-red-tests-pty-01, wave-0-red-tests-pty-04, wave-0-red-tests-pty-05, green-tests-pty-02, green-tests-pty-03]
  affects: [tests/usePty.test.ts, tests/useSessionManager.test.ts, tests/SessionTabBar.test.tsx, tests/session-registry.test.ts]
tech_stack:
  added: []
  patterns: [wave-0-red-pattern, tdd-red-green-refactor]
key_files:
  created:
    - tests/session-registry.test.ts
  modified:
    - tests/usePty.test.ts
    - tests/useSessionManager.test.ts
    - tests/SessionTabBar.test.tsx
    - server/session-registry.ts
key_decisions:
  - "Export SessionRegistry class (not just singleton) to allow isolated instances in tests — Rule 2 auto-fix, not architectural"
  - "PTY-01 sessionId-forwarding test passes immediately (GREEN) — existing hook already forwards sessionId prop; only effect-deps test is RED"
  - "PTY-05 exit-during-reconnect test ends up GREEN since exit handler already calls onStatus done regardless of prior state — session-ready path is the true RED"
metrics:
  duration: 2 min
  completed_date: "2026-05-02"
  tasks_completed: 4
  files_changed: 5
---

# Phase 10 Plan 01: PTY Session Persistence Wave 0 RED Tests Summary

Wave 0 RED test suite establishing acceptance criteria for PTY session persistence before any implementation exists. Follows the project's established Wave 0 RED pattern from Phases 02, 04, and 05.

## What Was Built

Four test files updated or created to define PTY-01 through PTY-05 acceptance criteria as executable code.

**Test results after plan completion:**
- 4 failing (RED) — intentional Wave 0 stubs for unimplemented behaviour
- 154 passing (GREEN) — all pre-existing tests + new verification tests
- 25 test files total (22 pre-existing + 3 modified + 1 new)

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add RED tests to usePty.test.ts (PTY-01, PTY-05) | 79b845e | tests/usePty.test.ts |
| 2 | Add RED tests to useSessionManager.test.ts (PTY-04) | 4b59c81 | tests/useSessionManager.test.ts |
| 3 | Add RED tests to SessionTabBar.test.tsx (PTY-04 visual) | eea8719 | tests/SessionTabBar.test.tsx |
| 4 | Create GREEN tests for session-registry.ts (PTY-02, PTY-03) | 2fb9a4b | tests/session-registry.test.ts, server/session-registry.ts |

## RED Tests (4 — fail until Wave 2 implements them)

| Test | File | Requirement |
|------|------|-------------|
| reopens WebSocket with new sessionId when sessionId prop changes | usePty.test.ts | PTY-01 |
| transitions status from reconnecting to waiting on session-ready | usePty.test.ts | PTY-05 |
| restoreForCwd sets session status to reconnecting | useSessionManager.test.ts | PTY-04 |
| renders status--reconnecting chip for reconnecting session | SessionTabBar.test.tsx | PTY-04 |

## GREEN Tests (new, pass immediately)

| Test | File | Requirement |
|------|------|-------------|
| uses provided sessionId prop in start message | usePty.test.ts | PTY-01 |
| shows done status when reconnecting to already-exited session | usePty.test.ts | PTY-05 |
| restoreForCwd preserves the original session id | useSessionManager.test.ts | PTY-04 |
| restoreForCwd restores activeId from localStorage | useSessionManager.test.ts | PTY-04 |
| getBuffer returns accumulated output written after spawn | session-registry.test.ts | PTY-02 |
| getBuffer returns empty string for unknown session | session-registry.test.ts | PTY-02 |
| removes session after SESSION_TTL_MS elapses | session-registry.test.ts | PTY-03 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Export] Exported SessionRegistry class**
- **Found during:** Task 4
- **Issue:** `session-registry.ts` only exported the singleton `registry` instance, not the class itself. Tests need isolated instances per test to avoid cross-test state pollution.
- **Fix:** Added `export` keyword to the `SessionRegistry` class declaration.
- **Files modified:** server/session-registry.ts
- **Commit:** 2fb9a4b

**2. [Rule 1 - Clarification] PTY-05 exit-during-reconnect test outcome**
- The plan stated this test would FAIL. In practice it PASSES because the existing exit handler calls `onStatus('done')` unconditionally (not checking if status was 'reconnecting'). The true RED test for PTY-05 is the `session-ready` → `waiting` transition test, which correctly FAILS.

## Self-Check: PASSED

All created files exist. All task commits verified present in git log.
