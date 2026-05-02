---
phase: 13-raw-terminal-sessions
plan: "02"
subsystem: ui
tags: [react, xterm, pty, terminal, tabs]

requires:
  - phase: 13-raw-terminal-sessions-01
    provides: useRawSessionManager hook with add/remove/setActive/updateStatus

provides:
  - RawTerminalPane component — xterm terminal wired to usePty for raw shell sessions
  - App.tsx wired with useRawSessionManager, tab bar, auto-seed effect, bottom panel body

affects:
  - Any phase extending the bottom panel (new panel types, layouts)
  - Phases that change App.tsx or useRawSessionManager

tech-stack:
  added: []
  patterns:
    - display:none isolation for inactive xterm panes (same as SessionPane)
    - visibleKey bump to re-fit xterm when pane becomes active
    - sendResize gated on isActive to prevent background PTY resize storms
    - hoisted vi.mock state pattern for per-test mock control without inner vi.mock calls

key-files:
  created:
    - client/components/RawTerminalPane.tsx
  modified:
    - client/App.tsx
    - tests/App.rawTerminal.test.tsx

key-decisions:
  - "RawTerminalPane.tsx mirrors slim SessionPane pattern — no Composer, no AttachBar, no editor tabs"
  - "Auto-seed useEffect excludes rawAdd from deps — it changes every render and would cause infinite loop"
  - "Test mock refactored to use vi.hoisted() mockRawState instead of inner vi.mock() calls — inner vi.mock is unreliable for already-cached modules in Vitest"
  - "RawTerminalPane mock updated to include both className and data-testid — RAWTERM-01 uses CSS class selector while RAWTERM-06 uses attribute selector"

requirements-completed: [RAWTERM-01, RAWTERM-02, RAWTERM-03, RAWTERM-04, RAWTERM-05, RAWTERM-06]

duration: 8min
completed: 2026-05-02
---

# Phase 13 Plan 02: Raw Terminal Sessions — Component and Wiring Summary

**RawTerminalPane xterm component wired into App.tsx with tab bar, auto-seed, and display:none pane isolation; all 6 RAWTERM tests green**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-02T22:29:16Z
- **Completed:** 2026-05-02T22:37:15Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `RawTerminalPane.tsx` — slim terminal pane (no Composer/AttachBar) using xterm + usePty for raw shell sessions
- Wired `useRawSessionManager` into App.tsx with tab bar, auto-seed effect, and per-session `RawTerminalPane` rendering
- Fixed test mock architecture — replaced unreliable inner `vi.mock()` calls with hoisted `mockRawState` pattern

## Task Commits

1. **Task 1: RawTerminalPane component** - `46d0684` (feat)
2. **Task 2: Wire App.tsx — tab bar, auto-seed, bottom panel body** - `a97d136` (feat)

## Files Created/Modified

- `client/components/RawTerminalPane.tsx` — xterm terminal wired to usePty; display:none isolation; visibleKey re-fit
- `client/App.tsx` — imports, useRawSessionManager hook call, auto-seed effect, tab bar JSX, bottom-panel-body JSX
- `tests/App.rawTerminal.test.tsx` — mock refactored to vi.hoisted() state; @ts-expect-error removed; all 6 tests GREEN

## Decisions Made

- Excluded `rawAdd` from auto-seed useEffect deps — it changes on every render and adding it would cause an infinite seed loop
- Used `vi.hoisted()` for mock state instead of inner `vi.mock()` — Vitest's inner `vi.mock()` calls inside `it()` or `beforeEach()` are unreliable for already-resolved modules; hoisted mutable state is the correct pattern
- Added `className="raw-terminal-pane"` to the test mock alongside `data-testid` — RAWTERM-01 uses CSS class selector while RAWTERM-06 uses attribute selector; both need to be present

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock used unreliable inner vi.mock() pattern**
- **Found during:** Task 2 (verifying tests)
- **Issue:** Inner `vi.mock()` calls inside describe/it blocks don't reliably override already-resolved module mocks in Vitest; tests were failing because sessions state wasn't changing per-test
- **Fix:** Replaced inner `vi.mock()` with `vi.hoisted()` to create mutable `mockRawState` object; each `beforeEach` sets `mockRawState.sessions` and `mockRawState.activeId` directly
- **Files modified:** `tests/App.rawTerminal.test.tsx`
- **Verification:** All 6 RAWTERM tests pass; full 175-test suite green
- **Committed in:** `a97d136` (Task 2 commit)

**2. [Rule 1 - Bug] RawTerminalPane mock missing CSS class**
- **Found during:** Task 2 (RAWTERM-01 failure)
- **Issue:** Test mock rendered `data-testid` but not `className="raw-terminal-pane"`; RAWTERM-01 uses `.raw-terminal-pane` CSS selector
- **Fix:** Added `className="raw-terminal-pane"` to mock component
- **Files modified:** `tests/App.rawTerminal.test.tsx`
- **Verification:** RAWTERM-01 passes
- **Committed in:** `a97d136` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs in test infrastructure)
**Impact on plan:** Both fixes required to make tests pass as intended. No scope creep.

## Issues Encountered

Vitest module mock caching: inner `vi.mock()` calls inside test bodies (it/describe/beforeEach) don't work reliably because the module factory is already resolved at module collection time. The `vi.hoisted()` pattern with mutable state is the correct approach for per-test mock control.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Bottom panel fully wired: shell sessions spawn on panel open, tab bar manages sessions, each tab drives a live xterm PTY
- Ready for visual QA — no further implementation needed for RAWTERM requirements
- CSS styling for `bpanel-tab`, `bpanel-tab--active`, `bpanel-add-btn` may need visual polish (classes are applied, base styles may need refinement)

---
*Phase: 13-raw-terminal-sessions*
*Completed: 2026-05-02*
