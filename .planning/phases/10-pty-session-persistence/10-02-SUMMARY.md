---
phase: 10-pty-session-persistence
plan: 02
subsystem: ui
tags: [react, hooks, websocket, pty, session-persistence, tdd]

# Dependency graph
requires:
  - phase: 10-01
    provides: Wave 0 RED tests for PTY session reconnect (PTY-01 through PTY-05)
provides:
  - SessionStatus with 'reconnecting' status in useSessionManager.ts and usePty.ts
  - restoreForCwd sets restored sessions to status 'reconnecting' (not 'connecting')
  - usePty handles 'session-ready' server message to transition status to 'waiting'
  - sessionId added to usePty effect deps so effect re-runs on prop change
  - SessionTabBar STATUS_CLASS updated to include 'reconnecting' entry
affects:
  - 10-03
  - App.tsx (wires useSessionManager and usePty together)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-copy SessionStatus pattern: useSessionManager.ts and usePty.ts each own their copy, both must stay in sync"
    - "session-ready message transitions reconnecting→waiting; data message transitions to working; exit transitions to done/error"

key-files:
  created: []
  modified:
    - client/hooks/useSessionManager.ts
    - client/hooks/usePty.ts
    - client/components/SessionTabBar.tsx

key-decisions:
  - "SessionStatus 'reconnecting' added to both useSessionManager.ts and usePty.ts independently — each file owns its own copy, keeping them in sync avoids circular imports"
  - "session-ready handler sets 'waiting' regardless of whether connection is fresh or reconnect — consistent behavior, no-op for fresh connects"
  - "sessionId added to usePty effect deps: effect re-runs when restoreForCwd fires and prop changes, triggering reconnect with the correct UUID"

patterns-established:
  - "Record<SessionStatus, string> in SessionTabBar enforces exhaustive status coverage — TypeScript will error if a new status is added but not mapped"

requirements-completed: [PTY-01, PTY-02, PTY-03, PTY-04, PTY-05]

# Metrics
duration: 5min
completed: 2026-05-02
---

# Phase 10 Plan 02: PTY Session Persistence — Client Hook Wiring Summary

**PTY session reconnect enabled: 'reconnecting' status in SessionStatus, session-ready→waiting transition in usePty, and sessionId in effect deps turn previously-RED Wave 0 tests GREEN**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-02T22:00:00Z
- **Completed:** 2026-05-02T22:05:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added 'reconnecting' to SessionStatus union in both useSessionManager.ts and usePty.ts (keeps both copies in sync)
- Fixed restoreForCwd to set restored sessions to status 'reconnecting' instead of 'connecting' (PTY-04)
- Added session-ready message handler in usePty.onmessage that calls onStatus('waiting') (PTY-01/PTY-05)
- Added sessionId to usePty useEffect deps so effect re-runs when the prop changes (PTY-01)
- Full test suite: 158 passed, 0 failed

## Task Commits

1. **Task 1: Add 'reconnecting' to SessionStatus and fix restoreForCwd** - `aa5f56a` (feat)
2. **Task 2: Add sessionId to effect deps, handle session-ready, sync SessionStatus type** - `cd8e2f5` (feat)

## Files Created/Modified

- `client/hooks/useSessionManager.ts` - Added 'reconnecting' to SessionStatus, changed restoreForCwd to use 'reconnecting' status
- `client/hooks/usePty.ts` - Added 'reconnecting' to SessionStatus, added session-ready handler, added sessionId to effect deps
- `client/components/SessionTabBar.tsx` - Added 'reconnecting' entry to STATUS_CLASS record (auto-fix)

## Decisions Made

- SessionStatus exported from both hooks independently — avoids circular imports; both copies must be kept in sync manually (Research Pitfall 3 from 10-RESEARCH.md)
- session-ready handler unconditionally calls onStatus('waiting') — works for both fresh connections and reconnects; no special-casing needed
- sessionId in effect deps is the minimal change needed for effect re-runs on restore; overrideSessionIdRef logic untouched

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added 'reconnecting' to SessionTabBar STATUS_CLASS record**
- **Found during:** Task 2 (usePty changes triggered TypeScript exhaust check)
- **Issue:** `STATUS_CLASS: Record<SessionStatus, string>` is an exhaustive record — after expanding SessionStatus, the 'reconnecting' key was missing, causing a TypeScript error and a failing test (`PTY-04` in SessionTabBar.test.tsx)
- **Fix:** Added `reconnecting: 'status--reconnecting'` to the STATUS_CLASS object
- **Files modified:** `client/components/SessionTabBar.tsx`
- **Verification:** SessionTabBar PTY-04 test now passes; full suite 158/158 green
- **Committed in:** `cd8e2f5` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary for TypeScript correctness and test coverage. No scope creep.

## Issues Encountered

None — changes were exactly as specified in the plan. The SessionTabBar fix was caught immediately by the failing test.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 0 RED tests (PTY-01 through PTY-05) are now GREEN
- Client hooks are wired for reconnect: correct session IDs are sent, session-ready transitions status correctly
- Server-side reconnect logic (ws-handler.ts) was already correct from prior work
- Ready for Wave 2 integration testing or next phase

---
*Phase: 10-pty-session-persistence*
*Completed: 2026-05-02*
