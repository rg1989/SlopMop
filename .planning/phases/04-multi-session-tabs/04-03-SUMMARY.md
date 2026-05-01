---
phase: 04-multi-session-tabs
plan: "03"
subsystem: ui
tags: [react, multi-session, tabs, terminal, xterm]

# Dependency graph
requires:
  - phase: 04-multi-session-tabs/04-02
    provides: useSessionManager hook with spawn/close/setActive/updateStatus/updateName/history
provides:
  - SessionTabBar component with status chips, spawn button, close buttons, scroll overflow
  - SessionPane component (one per session) owning terminal + composer + editor tabs + preview
  - App.tsx rewired to useSessionManager with multi-session tab UX
  - display:none inactive panes (xterm.js not re-initialized on tab switch)
affects: [future session persistence, mobile layout, voice routing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One SessionPane per session — each calls useSession once, satisfying React hooks rules"
    - "activeActionsRef mutable ref forwards active session actions (sendInput, openFile, etc.) to App for sidebar and audio routing"
    - "isActive gating on sendResize prevents inactive pane from clobbering other session PTY sizes"
    - "onRegisterActions callback re-runs every render (no deps) to keep actions ref current without stale closures"
    - "onFirstInput + hasNamedRef.current pattern: name extracted from first non-empty input, idempotent"

key-files:
  created:
    - client/components/SessionTabBar.tsx
    - client/components/SessionPane.tsx
  modified:
    - client/App.tsx
    - client/App.css
    - tests/setup.ts
    - tests/SessionTabBar.test.tsx

key-decisions:
  - "SessionPane owns terminal+composer+preview — each pane is a self-contained column; preview panel is a flex sibling inside the pane rather than an app-level right panel"
  - "VoiceBar stays app-level in voice-bar-row div; audio routes to active session via activeSendInputRef mutable ref"
  - "onRegisterActions runs without deps on every render — ensures App always has fresh session callbacks without stale closure bugs"
  - "ResizeObserver mock added to tests/setup.ts (jsdom missing it) — all SessionTabBar tests pass GREEN"
  - "Removed @ts-expect-error from SessionTabBar test — Wave 0 RED directive now unused after module created"

patterns-established:
  - "Tab bar pattern: data-session-id attribute on each tab div for test targeting; data-close on close button"
  - "Status chip: .status-chip span with .status--{status} class; color values match RESEARCH.md spec"

requirements-completed: [SESS-01, SESS-02, SESS-03]

# Metrics
duration: 8min
completed: 2026-05-01
---

# Phase 04 Plan 03: Multi-Session Tab UX Summary

**SessionTabBar + SessionPane components delivering visible multi-session UX with status chips, spawn/close controls, and display:none tab switching that preserves xterm.js state**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-01T13:02:54Z
- **Completed:** 2026-05-01T13:03:50Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- SessionTabBar renders one tab per session with status chip (color-coded by status), close button, active class, scroll overflow, and spawn (+) button — all 7 unit tests pass GREEN
- SessionPane wraps one useSession call per instance; owns TerminalComponent, Composer, AttachBar, EditorTabBar, FilePreview/BrainEntryView; display:none hides inactive panes without destroying xterm state
- App.tsx fully rewired from single-session useSession to useSessionManager + SessionTabBar + mapped SessionPane components; sidebar file/diff/brain actions route to active session via mutable ref pattern

## Task Commits

1. **Task 1: Build SessionTabBar component and CSS** - `2312c05` (feat)
2. **Task 2: Create SessionPane and rewire App.tsx** - `cd021af` (feat)

## Files Created/Modified
- `client/components/SessionTabBar.tsx` - Tab bar with status chips, close buttons, spawn button, ResizeObserver scroll overflow
- `client/components/SessionPane.tsx` - Per-session pane owning terminal+composer+preview; calls useSession once; registers actions with App
- `client/App.tsx` - Rewired to useSessionManager; removes single useSession call; renders SessionTabBar + mapped SessionPanes
- `client/App.css` - Session Tab Bar styles (status chip colors, tab layout, spawn button, voice-bar-row)
- `tests/setup.ts` - ResizeObserver mock added (jsdom missing; required for SessionTabBar tests)
- `tests/SessionTabBar.test.tsx` - Removed now-unused @ts-expect-error directive

## Decisions Made
- SessionPane owns the full column (terminal + composer + preview panel) rather than keeping preview as an app-level right sidebar — simpler display:none isolation per session
- VoiceBar stays app-level and routes to active session via `activeSendInputRef` (mutable ref) — avoids threading all audio props through SessionPane
- `onRegisterActions` runs without deps array (every render) to keep App's activeActionsRef current; this is intentional and avoids stale closure bugs on session.openFile etc.
- ResizeObserver mock added to global test setup as Rule 2 (missing critical functionality for tests) — all tests passing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added ResizeObserver mock to test setup**
- **Found during:** Task 1 (SessionTabBar tests)
- **Issue:** jsdom does not implement ResizeObserver; SessionTabBar's overflow scroll pattern uses it; all tests threw ReferenceError
- **Fix:** Added MockResizeObserver class to tests/setup.ts via vi.stubGlobal
- **Files modified:** tests/setup.ts
- **Verification:** All 7 SessionTabBar tests pass GREEN after mock added
- **Committed in:** 2312c05 (Task 1 commit)

**2. [Rule 1 - Bug] Removed @ts-expect-error from SessionTabBar test**
- **Found during:** Task 1 verification (tsc --noEmit)
- **Issue:** Wave 0 RED used @ts-expect-error to import non-existent module; directive unused after module created (TS2578)
- **Fix:** Removed the directive line from tests/SessionTabBar.test.tsx
- **Files modified:** tests/SessionTabBar.test.tsx
- **Committed in:** cd021af (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both essential for correctness. No scope creep.

## Issues Encountered
- composerRef type mismatch: React 19 `useRef<T>` returns `RefObject<T | null>` but SessionPane expected `RefObject<T>` — fixed by widening the prop type to `RefObject<HTMLTextAreaElement | null>`
- Pre-existing TypeScript errors in SuperToolsModal.tsx and FileTree.test.tsx (unrelated to this plan) — left as-is per scope boundary rule

## Next Phase Readiness
- SessionTabBar and SessionPane components complete; multi-session tab UX delivered
- Sessions can be spawned, switched, and closed without xterm.js re-initialization
- Phase 04-03 requirements SESS-01, SESS-02, SESS-03 satisfied
- Pre-existing test failures (FileTree, FilePreview, usePty port mismatch) documented as out-of-scope

---
*Phase: 04-multi-session-tabs*
*Completed: 2026-05-01*
