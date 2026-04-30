---
phase: 01-pty-core
plan: 02
subsystem: ui
tags: [xterm, react, websocket, vitest, tdd, pty]

# Dependency graph
requires:
  - phase: 01-01
    provides: shared/protocol.ts ClientMessage/ServerMessage types, WebSocket server at ws://localhost:3000/ws
provides:
  - client/hooks/useResize.ts — ResizeObserver with 150ms debounce, calls onResize(cols, rows)
  - client/hooks/usePty.ts — WebSocket lifecycle hook, sends start/input/resize, writes server data to terminal
  - client/components/Terminal.tsx — xterm.js mount with FitAddon and WebGL (DOM fallback)
  - client/components/FolderPicker.tsx — path input + connect button
  - client/index.html + client/main.tsx — Vite entry point
  - tests/useResize.test.ts — 7 tests (TERM-05)
  - tests/usePty.test.ts — 9 tests (TERM-01, TERM-02, TERM-03 wiring)
affects: [01-03, App wiring, integration]

# Tech tracking
tech-stack:
  added: ["@xterm/xterm", "@xterm/addon-fit", "@xterm/addon-webgl", "react", "react-dom"]
  patterns:
    - TDD with vi.useFakeTimers for debounce testing
    - vi.stubGlobal for mocking ResizeObserver and WebSocket
    - Separate useResize hook keeps resize logic testable independent of Terminal component
    - usePty excludes cols/rows from useEffect deps — resize handled via sendResize, not reconnect

key-files:
  created:
    - client/hooks/useResize.ts
    - client/hooks/usePty.ts
    - client/components/Terminal.tsx
    - client/components/FolderPicker.tsx
    - client/index.html
    - client/main.tsx
    - tests/useResize.test.ts
    - tests/usePty.test.ts
  modified:
    - package.json (added xterm packages + react/react-dom)

key-decisions:
  - "cols/rows excluded from usePty useEffect deps — window resize triggers sendResize, not WebSocket reconnect"
  - "Terminal.tsx uses dynamic import for xterm addons to enable async WebGL with DOM fallback"
  - "useResize accepts terminal+fitAddon as nullable params — hook is a no-op until Terminal is fully initialized"

patterns-established:
  - "Hook separation: useResize owns debounce+observer, usePty owns WebSocket lifecycle — each independently testable"
  - "TDD with fake timers: vi.useFakeTimers() + vi.advanceTimersByTime() for deterministic debounce tests"
  - "WebSocket mock: vi.stubGlobal with simulateOpen/simulateMessage helpers on mock instance"

requirements-completed: [TERM-01, TERM-02, TERM-04, TERM-05]

# Metrics
duration: 2min
completed: 2026-04-30
---

# Phase 1 Plan 02: Frontend Terminal Components Summary

**xterm.js browser terminal with 150ms-debounced ResizeObserver, WebSocket PTY hook (usePty), and folder picker — 22 tests green across 3 files**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-30T17:37:46Z
- **Completed:** 2026-04-30T17:39:56Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- useResize hook with ResizeObserver + 150ms debounce, verified by 7 unit tests using fake timers
- usePty hook managing WebSocket lifecycle (open/message/close), start/input/resize messaging — 9 unit tests green
- Terminal.tsx mounting xterm.js with FitAddon, WebGL addon (DOM fallback on context loss), useResize wired in
- FolderPicker component with path input and connect button, calls onConnect(cwd) on submit
- Full vitest suite: 22 tests green (pty-manager + usePty + useResize)

## Task Commits

Each task was committed atomically:

1. **Task 1: useResize hook + Terminal component** - `ea810ae` (feat)
2. **Task 2: usePty hook + FolderPicker component** - `2994e54` (feat)

**Plan metadata:** (docs commit below)

_Note: Both TDD tasks followed RED → GREEN flow; no separate REFACTOR commit needed._

## Files Created/Modified
- `client/hooks/useResize.ts` — ResizeObserver with 150ms debounce, calls fitAddon.fit() then onResize(cols, rows)
- `client/hooks/usePty.ts` — WebSocket hook: open → start msg, onmessage → terminal.write, sendInput/sendResize callbacks
- `client/components/Terminal.tsx` — xterm.js mount with FitAddon + WebGL addon (try/catch DOM fallback)
- `client/components/FolderPicker.tsx` — Controlled input + form submit → onConnect(path.trim())
- `client/index.html` — Minimal Vite entry with dark background styles
- `client/main.tsx` — React root render with StrictMode, imports App (created in 01-03)
- `tests/useResize.test.ts` — 7 tests: fires once at 150ms, debounces rapid calls, passes correct cols/rows, cleanup
- `tests/usePty.test.ts` — 9 tests: WS URL, start msg, terminal.write on data, sendInput/sendResize, unmount close
- `package.json` — Added @xterm/xterm, @xterm/addon-fit, @xterm/addon-webgl, react, react-dom

## Decisions Made
- cols/rows excluded from usePty useEffect deps — window resize triggers sendResize separately, preventing unnecessary WebSocket reconnects
- Terminal.tsx uses dynamic import for addons to keep async WebGL loading clean with proper DOM fallback on context loss
- useResize accepts terminal and fitAddon as nullable — hook becomes a no-op before Terminal fully initializes, safe to call early

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All frontend terminal components ready for App wiring in Plan 01-03
- usePty + Terminal + FolderPicker can be composed in App.tsx with a single cwd state
- No blockers; full test coverage established for both hooks

---
*Phase: 01-pty-core*
*Completed: 2026-04-30*
