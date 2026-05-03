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

key-files:
  created: []
  modified:
    - client/components/SessionPane.tsx
    - client/App.css
    - client/App.tsx

key-decisions:
  - "composerRef type changed from HTMLTextAreaElement to TerminalInputHandle — VoiceBar focus call uses .focus() which both satisfy"
  - "App.tsx imports TerminalInputHandle directly to update ref declaration — keeps type safety without re-exporting from SessionPane"

patterns-established:
  - "TerminalInput renders into .terminal-input-strip container — CSS class controls fixed height, component controls content"

requirements-completed:
  - TINPUT-01
  - TINPUT-02
  - TINPUT-03
  - TINPUT-04

# Metrics
duration: 12min
completed: 2026-05-03
---

# Phase 15 Plan 03: Terminal Input Core (SessionPane Integration) Summary

**xterm.js TerminalInput strip wired into SessionPane, replacing drag-resize Composer textarea with a fixed 80px xterm.js input at the bottom of every Claude session pane**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-03T20:42:00Z
- **Completed:** 2026-05-03T20:54:00Z
- **Tasks:** 1 of 2 (Task 2 is a human-verify checkpoint — pending)
- **Files modified:** 3

## Accomplishments
- Replaced drag-resize Composer block with TerminalInput in SessionPane
- Added `.terminal-input-strip` CSS class with fixed 80px height using design system variables
- Updated `composerRef` type from `HTMLTextAreaElement` to `TerminalInputHandle` in both SessionPane and App
- All 210 tests pass after changes

## Task Commits

1. **Task 1: Add .terminal-input-strip CSS and wire TerminalInput into SessionPane** - `372963a` (feat)

## Files Created/Modified
- `client/components/SessionPane.tsx` - Replaced drag-resize Composer with TerminalInput; removed useDragResize, AttachBar, Composer imports; updated composerRef type
- `client/App.css` - Added .terminal-input-strip CSS class (flex-shrink: 0, height: 80px, CSS variable colors)
- `client/App.tsx` - Imported TerminalInputHandle, updated composerRef from HTMLTextAreaElement to TerminalInputHandle

## Decisions Made
- `composerRef` type updated in App.tsx by importing `TerminalInputHandle` directly rather than re-exporting from SessionPane — keeps the dependency explicit and avoids circular chain
- `voiceSlot` prop retained in `SessionPaneProps` interface (not rendered in Phase 15) for Phase 16 voice overlay wiring

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated composerRef type in App.tsx**
- **Found during:** Task 1 (SessionPane wiring)
- **Issue:** App.tsx declared `composerRef` as `useRef<HTMLTextAreaElement>` which would cause a TypeScript type mismatch when passed to SessionPane's updated `composerRef?: React.RefObject<TerminalInputHandle | null>`
- **Fix:** Imported `TerminalInputHandle` in App.tsx and changed `useRef<HTMLTextAreaElement>` to `useRef<TerminalInputHandle>`
- **Files modified:** client/App.tsx
- **Verification:** `npx vitest run` — all 210 tests pass
- **Committed in:** 372963a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — type mismatch in App.tsx)
**Impact on plan:** Required for TypeScript correctness; no scope creep.

## Issues Encountered
None beyond the type mismatch auto-fix above.

## Next Phase Readiness
- Task 2 (human-verify checkpoint) is pending — user must verify in browser that the xterm.js strip renders, sends input, and has fixed height
- Phase 16 (voice overlay) can proceed after checkpoint passes; `voiceSlot` prop is retained in SessionPaneProps

---
*Phase: 15-terminal-input-core*
*Completed: 2026-05-03*
