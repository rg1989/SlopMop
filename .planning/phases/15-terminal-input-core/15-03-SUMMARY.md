---
phase: 15-terminal-input-core
plan: "03"
subsystem: ui
tags: [xterm, terminal, react, typescript]

# Dependency graph
requires:
  - phase: 15-02
    provides: TerminalInput component with TerminalInputHandle ref interface
provides:
  - SessionPane with TerminalInput strip replacing drag-resize Composer
  - .terminal-input-strip CSS class (fixed 80px, no resize)
  - composerRef updated to TerminalInputHandle type in SessionPane and App
affects: [phase-16-voice-overlay, any caller of SessionPane composerRef]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "composerRef forwarded to TerminalInput.focus() via TerminalInputHandle interface"
    - "Fixed-height xterm.js strip at bottom of session pane via .terminal-input-strip CSS"
    - "disableStdin:true on read-only display terminal prevents input theft; display-area clicks redirect focus to input strip"

key-files:
  created: []
  modified:
    - client/components/SessionPane.tsx
    - client/App.css
    - client/App.tsx

key-decisions:
  - "composerRef type changed from HTMLTextAreaElement to TerminalInputHandle — VoiceBar focus call uses .focus() which both satisfy"
  - "App.tsx imports TerminalInputHandle directly to update ref declaration — keeps type safety without re-exporting from SessionPane"
  - "disableStdin={true} on display TerminalComponent makes it output-only — all input flows through TerminalInput strip"
  - "localInputRef fallback ensures strip is always focusable even when composerRef prop is not provided by App"

patterns-established:
  - "TerminalInput renders into .terminal-input-strip container — CSS class controls fixed height, component controls content"
  - "Read-only display terminal pattern: disableStdin:true + display-area onClick redirect to input strip"

requirements-completed:
  - TINPUT-01
  - TINPUT-02
  - TINPUT-03
  - TINPUT-04

# Metrics
duration: 35min
completed: 2026-05-03
---

# Phase 15 Plan 03: Terminal Input Core (SessionPane Integration) Summary

**xterm.js TerminalInput strip fully wired as sole input path — display terminal locked read-only with disableStdin, display-area clicks redirect to strip, auto-focus on pane activation**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-03T20:42:00Z
- **Completed:** 2026-05-03T21:20:00Z
- **Tasks:** 2 (Task 1 auto, Task 2 human-verify with post-verify bug fix)
- **Files modified:** 3 (SessionPane, App.css, App.tsx)

## Accomplishments
- Replaced drag-resize Composer block with TerminalInput in SessionPane
- Added `.terminal-input-strip` CSS class with fixed 80px height using design system variables
- Updated `composerRef` type from `HTMLTextAreaElement` to `TerminalInputHandle` in both SessionPane and App
- Fixed post-verify disconnect bug: added `disableStdin={true}` on display terminal, `localInputRef` fallback, auto-focus on active, click redirect
- All 210 tests pass

## Task Commits

1. **Task 1: Add .terminal-input-strip CSS and wire TerminalInput into SessionPane** - `372963a` (feat)
2. **Task 2 fix: Disconnect display terminal stdin, route all input through strip** - `e0ddbe3` (fix)

## Files Created/Modified
- `client/components/SessionPane.tsx` - Replaced Composer with TerminalInput; `disableStdin={true}` on display terminal; `localInputRef` fallback; auto-focus on active; click redirect
- `client/App.css` - Added `.terminal-input-strip` CSS class (fixed 80px, CSS variable colors)
- `client/App.tsx` - Imported `TerminalInputHandle`, updated `composerRef` type

## Decisions Made
- `composerRef` type updated in App.tsx by importing `TerminalInputHandle` directly — keeps dependency explicit, avoids circular chain
- `disableStdin={true}` on display terminal makes it output-only; all input flows through TerminalInput strip
- `localInputRef` fallback ensures strip is focusable even when `composerRef` prop is absent
- `voiceSlot` prop retained in `SessionPaneProps` (not rendered in Phase 15) for Phase 16 wiring

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated composerRef type in App.tsx**
- **Found during:** Task 1 (SessionPane wiring)
- **Issue:** App.tsx declared `composerRef` as `useRef<HTMLTextAreaElement>` — type mismatch with updated SessionPane prop
- **Fix:** Imported `TerminalInputHandle` in App.tsx, changed ref type
- **Files modified:** client/App.tsx
- **Committed in:** `372963a`

**2. [Rule 1 - Bug] Display terminal stealing keyboard focus — TerminalInput strip disconnected**
- **Found during:** Task 2 (human-verify checkpoint)
- **Issue:** `TerminalComponent` had `disableStdin: false` (default). xterm.js showed an interactive cursor and consumed keystrokes when focused. The `TerminalInput.onData → sendInput` wiring was correct, but the display terminal stole focus on any click, so typed characters never reached the strip.
- **Fix:** Added `disableStdin={true}` to `TerminalComponent`, `localInputRef` fallback ref, auto-focus effect on `isActive`, and `onClick` on display container → `inputRef.current?.focus()`
- **Files modified:** client/components/SessionPane.tsx
- **Verification:** 210 tests pass; display terminal no longer shows cursor; clicking display area focuses input strip
- **Committed in:** `e0ddbe3`

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs)
**Impact on plan:** Both required for correctness. The `disableStdin` fix was explicitly noted in STATE.md decisions ("SessionPane passes true for Claude sessions in Plan 03") but was missed in Task 1 implementation.

## Issues Encountered
The `disableStdin` prop was pre-built in `Terminal.tsx` (Plan 15-02) and the decision to pass `true` in SessionPane was recorded in STATE.md — but the Task 1 implementation did not include it, causing the strip to be visually present but functionally unreachable. Caught at human-verify and fixed atomically.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 16 (VoiceBar overlay): `composerRef` is now `TerminalInputHandle | null` — `.focus()` works unchanged from caller side
- TerminalInput is the sole input path; all 210 tests green; no regressions in PTY or session management

---
*Phase: 15-terminal-input-core*
*Completed: 2026-05-03*
