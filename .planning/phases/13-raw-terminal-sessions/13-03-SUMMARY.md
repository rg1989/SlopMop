---
phase: 13-raw-terminal-sessions
plan: 03
subsystem: ui
tags: [xterm, pty, terminal, react, websocket]

requires:
  - phase: 13-raw-terminal-sessions (plan 02)
    provides: RawTerminalPane, useRawSessionManager, bottom panel tab bar wired in App.tsx

provides:
  - Bottom panel tab bar CSS (bpanel-tab, bpanel-tab--active, bpanel-add-btn, bpanel-tab-close, raw-terminal-pane)
  - Terminal focus on mount and click
  - Auto-select newly created tab when + is clicked
  - PTY kill-on-unmount for raw terminal tabs (backend cleanup)
  - Session persistence across panel toggle (display:none pattern)

affects: [raw-terminal-sessions, bottom-panel, pty-lifecycle]

tech-stack:
  added: []
  patterns:
    - killOnUnmount option in usePty for ephemeral vs persistent PTY sessions
    - display:none panel persistence (keep mounted, hide visually) for WebSocket/xterm state survival

key-files:
  created: []
  modified:
    - client/App.css
    - client/App.tsx
    - client/components/Terminal.tsx
    - client/hooks/usePty.ts
    - client/hooks/useRawSessionManager.ts
    - client/components/RawTerminalPane.tsx
    - tests/App.bottomPanel.test.tsx

key-decisions:
  - "Terminal.tsx calls term.focus() after term.open() and adds onClick->focus handler on container div"
  - "useRawSessionManager.add() generates UUID before setSessions so setActiveId is called outside the updater — avoids React batching uncertainty"
  - "usePty killOnUnmount option: raw terminals send kill before WebSocket close; regular agent sessions use detach-on-close for reconnect"
  - "Bottom panel uses display:none not conditional render — keeps RawTerminalPane mounted so PTY WebSockets and xterm state survive panel toggle"
  - "BPANEL-02 test updated to assert display:none rather than DOM absence — reflects display:none implementation"

patterns-established:
  - "display:none for panel persistence: use display:none instead of conditional render when component owns WebSocket or DOM state that must survive hide/show"
  - "killOnUnmount: usePty sessions split into ephemeral (kill) vs persistent (detach) via single boolean option"

requirements-completed: [RAWTERM-01, RAWTERM-02, RAWTERM-03, RAWTERM-04]

duration: 25min
completed: 2026-05-03
---

# Phase 13 Plan 03: Raw Terminal Sessions Visual QA Summary

**Bottom panel terminal tabs styled and 4 QA bugs fixed: focus, auto-select, PTY cleanup, and session persistence across panel toggle**

## Performance

- **Duration:** 25 min
- **Started:** 2026-05-03T02:00:00Z
- **Completed:** 2026-05-03T02:25:00Z
- **Tasks:** 2 (Task 1 from previous run + 4 bug fixes in Task 2 continuation)
- **Files modified:** 8

## Accomplishments

- Bottom panel tab bar CSS landed in Task 1 (commit 4d297ad)
- Fixed 4 functional bugs found during QA: terminal focus, new-tab auto-select, PTY cleanup on close, session persistence on panel toggle
- All 175 tests remain green after fixes

## Task Commits

1. **Task 1: Add bottom panel tab bar CSS to App.css** - `4d297ad` (feat)
2. **Bug 1: Terminal gains focus on mount and click** - `b473eca` (fix)
3. **Bug 2: Auto-select newly created tab on + click** - `ec30305` (fix)
4. **Bug 3: PTY kill message sent on raw terminal tab close** - `3c587b8` (fix)
5. **Bug 4: Preserve terminal sessions when bottom panel is toggled** - `44bd9ed` (fix)

## Files Created/Modified

- `client/App.css` - Added bpanel-tab, bpanel-tab--active, bpanel-add-btn, bpanel-tab-close, raw-terminal-pane CSS classes
- `client/App.tsx` - Changed bottom panel from conditional render to display:none for session persistence
- `client/components/Terminal.tsx` - Added term.focus() on mount and onClick->focus on container div
- `client/hooks/usePty.ts` - Added killOnUnmount option; sends kill message before WebSocket close when enabled
- `client/hooks/useRawSessionManager.ts` - Moved UUID generation before setSessions so setActiveId is outside updater
- `client/components/RawTerminalPane.tsx` - Passes killOnUnmount:true to usePty
- `tests/App.bottomPanel.test.tsx` - Updated BPANEL-02 to check display:none instead of DOM absence

## Decisions Made

- **display:none vs conditional render:** Chose display:none for the bottom panel so RawTerminalPane stays mounted. WebSocket connections and xterm.js canvas state survive panel hide/show — no reconnect needed when user reopens the panel.
- **killOnUnmount split:** Regular agent PTY sessions use detach-on-close (server keeps PTY for reconnect). Raw terminal tabs use kill-on-close (ephemeral, no reconnect intended). Single boolean option in usePty handles both cases cleanly.
- **addSession ID outside updater:** Moving `crypto.randomUUID()` before `setSessions` allows `setActiveId(id)` to run as a standalone state update, not nested inside another state updater. This eliminates React 18 batching ambiguity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Terminal not receiving keyboard input**
- **Found during:** QA checkpoint (user-reported)
- **Issue:** xterm.js terminal mounted but never focused — clicks did not move cursor and keyboard had no effect
- **Fix:** Added `terminal.focus()` after `terminal.open()` in Terminal.tsx; added `onClick` handler on container div calling `terminalRef.current?.focus()`
- **Files modified:** `client/components/Terminal.tsx`
- **Committed in:** b473eca

**2. [Rule 1 - Bug] New tab not auto-selected after + click**
- **Found during:** QA checkpoint (user-reported)
- **Issue:** `setActiveId` called inside `setSessions` updater; React 18 batching caused the active ID not to update reliably, leaving new tab unselected
- **Fix:** Generate UUID before `setSessions`, call `setActiveId(id)` as a separate state update outside the updater
- **Files modified:** `client/hooks/useRawSessionManager.ts`
- **Committed in:** ec30305

**3. [Rule 2 - Missing Critical] PTY not killed on tab close**
- **Found during:** QA checkpoint (user-reported uncertainty)
- **Issue:** Server WebSocket close handler calls `registry.detach()` not `registry.destroy()` — PTY process stays alive as zombie after tab is closed
- **Fix:** Added `killOnUnmount` option to `usePty`; when true, sends `{type:'kill'}` message before closing WebSocket; `RawTerminalPane` enables it; regular agent sessions leave it false
- **Files modified:** `client/hooks/usePty.ts`, `client/components/RawTerminalPane.tsx`
- **Committed in:** 3c587b8

**4. [Rule 1 - Bug] Sessions lost when bottom panel is closed**
- **Found during:** QA checkpoint (user-reported)
- **Issue:** Bottom panel rendered conditionally (`{bottomPanelOpen && ...}`); on close, React unmounted all RawTerminalPane components, destroying WebSocket connections and xterm.js state
- **Fix:** Changed to `display:none` style on panel and resize handle; components stay mounted while panel is visually hidden
- **Files modified:** `client/App.tsx`, `tests/App.bottomPanel.test.tsx`
- **Committed in:** 44bd9ed

---

**Total deviations:** 4 auto-fixed (3 Rule 1 bugs, 1 Rule 2 missing critical)
**Impact on plan:** All fixes directly required for the stated QA success criteria. No scope creep.

## Issues Encountered

- BPANEL-02 test asserted `.bottom-panel` is null when panel is closed. After the display:none change, the element is always in the DOM. Updated test to assert `display: none` style instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 13 is complete. All 4 RAWTERM requirements delivered:
- RAWTERM-01: Bottom panel opens with one auto-seeded shell tab
- RAWTERM-02: Tab bar shows session chips with close buttons and + add button
- RAWTERM-03: Each tab is an independent PTY process running bash
- RAWTERM-04: Switching tabs preserves terminal state (display:none isolation)

---
*Phase: 13-raw-terminal-sessions*
*Completed: 2026-05-03*
