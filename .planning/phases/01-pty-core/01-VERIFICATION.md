---
phase: 01-pty-core
verified: 2026-04-30T18:47:00Z
status: passed
score: 5/5 success criteria verified
re_verification: false
human_verification:
  - test: "TERM-04: Terminal scrollback and copy/paste"
    expected: "Mouse scroll reveals history; Cmd+C copies selected text; Ctrl+C sends SIGINT"
    why_human: "Clipboard API and SIGINT delivery cannot be verified programmatically"
    result: "CONFIRMED PASSING — user approved in live browser session 2026-04-30"
---

# Phase 1: PTY Core Verification Report

**Phase Goal:** User can open Claude CLI in a real PTY terminal session inside the browser and interact with it fully
**Verified:** 2026-04-30T18:47:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can select a folder from the UI and Claude CLI opens in that directory inside the browser terminal | VERIFIED | `FolderPicker` calls `onConnect(path)` → `handleConnect` sets `cwd` → `usePty` sends `{type:'start', cwd, cols, rows}` over WebSocket → `ws-handler` calls `spawnSession(msg.cwd, ...)` with the cwd set on the pty process. Test: pty-manager.test.ts line 32 confirms `options.cwd` equals the provided path. |
| 2 | Terminal renders full ANSI colors and Claude CLI's interactive prompts behave correctly | VERIFIED | `pty-manager.ts` sets `TERM: 'xterm-256color'` and `name: 'xterm-256color'` on spawn options. `Terminal.tsx` loads `WebglAddon` with DOM fallback, and imports `@xterm/xterm/css/xterm.css`. Test: pty-manager.test.ts line 40 confirms `options.env.TERM === 'xterm-256color'`. Confirmed by user in browser. |
| 3 | User can compose a multiline message in the input area and send it to the running session | VERIFIED | `Composer.tsx` uses `forwardRef`, handles Enter (sends `value + '\r'`) and Shift+Enter (inserts newline). `App.tsx` passes `onSend={sendInput}` wiring Composer directly to the PTY via `usePty`. 8 Composer tests pass. |
| 4 | User can scroll back through terminal history and use keyboard copy/paste shortcuts | VERIFIED (human) | xterm.js Terminal created with `scrollback: 5000`. User confirmed in live browser: scroll works, Cmd+C copies, Ctrl+C sends SIGINT. |
| 5 | Terminal reflows and resizes correctly when the browser window or sidebar width changes | VERIFIED | `useResize` hook debounces ResizeObserver at 150ms, calls `fitAddon.fit()` then `onResize(terminal.cols, terminal.rows)`, which propagates via `sendResize` → `usePty` → WebSocket `{type:'resize'}` → `resizeSession()`. 7 useResize tests pass. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | All dependencies declared | VERIFIED | node-pty, express, ws, @xterm/xterm, @xterm/addon-fit, @xterm/addon-webgl, vite, react, typescript, vitest all present. `postinstall` chmod script included for node-pty spawn-helper. |
| `shared/protocol.ts` | ClientMessage and ServerMessage union types | VERIFIED | Exports both types covering start/input/resize/kill and data/exit/error messages. 11 lines, fully substantive. |
| `server/pty-manager.ts` | spawnSession(cwd, cols, rows) function | VERIFIED | Implements full spawn with login PATH, TERM=xterm-256color, correct cwd/cols/rows. Also exports resizeSession. |
| `server/ws-handler.ts` | attachWebSocketServer(server) wiring node-pty to WebSocket | VERIFIED | Routes all 4 message types (start/input/resize/kill), streams PTY onData back as {type:'data'}, kills PTY on close. Error handling present. |
| `server/index.ts` | Express HTTP server + WebSocket server startup | VERIFIED | Calls `attachWebSocketServer(server)`, serves static in production, adds /api/pick-folder (osascript) and /api/homedir endpoints, listens on configurable PORT defaulting to 3000. |
| `client/components/Terminal.tsx` | xterm.js Terminal with FitAddon + WebGL + ResizeObserver | VERIFIED | StrictMode cancelled flag, async dynamic imports, WebGL with DOM fallback, useResize wired, display-only (no direct input). |
| `client/hooks/useResize.ts` | useResize hook with 150ms debounce | VERIFIED | ResizeObserver + setTimeout(150) pattern, proper cleanup on unmount. |
| `client/hooks/usePty.ts` | usePty hook managing WebSocket lifecycle | VERIFIED | Opens WebSocket, sends 'start' on open, writes data to terminal, tracks `connected` state, closes on unmount. |
| `client/components/FolderPicker.tsx` | Folder path input + connect callback | VERIFIED | Native macOS picker via /api/pick-folder, manual text input, localStorage + URL persistence via App.tsx. |
| `client/components/Composer.tsx` | Textarea with Enter-to-send and Shift+Enter-to-newline | VERIFIED | Sends `value + '\r'` (correct PTY CR), clears after send, Shift+Enter falls through to browser default, forwardRef for focus control. |
| `client/App.tsx` | Root layout wiring FolderPicker, Terminal, Composer | VERIFIED | All three components imported and wired. usePty called with cwd/terminal/cols/rows. sendInput wired to Composer onSend. sendResize wired to Terminal. Auto-connect on saved path. Terminal clicks redirect focus to Composer. |
| `tests/pty-manager.test.ts` | Unit tests for PTY spawn behavior | VERIFIED | 6 tests covering cwd, TERM env, cols/rows, resizeSession. All pass. |
| `tests/useResize.test.ts` | Unit tests for TERM-05 debounce | VERIFIED | 7 tests covering debounce timing, cleanup, null guards. All pass. |
| `tests/Composer.test.tsx` | Unit tests for TERM-03 | VERIFIED | 8 tests covering Enter/Shift+Enter/empty/whitespace/disabled/multiline. All pass. |
| `tests/usePty.test.ts` | Unit tests for WebSocket client behavior | VERIFIED | 9 tests. All pass. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/ws-handler.ts` | `server/pty-manager.ts` | `spawnSession()` on 'start' message | WIRED | Line 38: `ptyProcess = spawnSession(msg.cwd, msg.cols, msg.rows)` |
| `server/index.ts` | `server/ws-handler.ts` | `attachWebSocketServer(server)` | WIRED | Line 55: `attachWebSocketServer(server)` called before listen |
| `client/hooks/usePty.ts` | `ws://localhost:3000/ws` | `new WebSocket` on mount | WIRED | Line 31: `const ws = new WebSocket('ws://localhost:3000/ws')` |
| `client/components/Terminal.tsx` | `client/hooks/useResize.ts` | `useResize(containerRef, ...)` | WIRED | Line 70: `useResize(containerRef, terminalRef.current, fitAddonRef.current, sendResize)` |
| `client/hooks/usePty.ts` | `terminal.write(data)` | `ws.onmessage → msg.type === 'data'` | WIRED | Lines 40-41: `if (msg.type === 'data') terminal.write(msg.data)` |
| `client/App.tsx` | `client/components/Composer.tsx` | `onSend` prop → `sendInput` from usePty | WIRED | Line 81: `<Composer ref={composerRef} onSend={sendInput} disabled={!connected} />` |
| `client/components/Composer.tsx` | PTY input | `onSend(value + '\r')` on Enter keydown | WIRED | Lines 16-19: Enter handler calls `onSend(value + '\r')` |

All 7 key links verified wired.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| TERM-01 | 01-01, 01-02 | Folder selection opens real PTY Claude CLI in selected directory | SATISFIED | `spawnSession(cwd, ...)` sets pty cwd; FolderPicker → handleConnect → usePty 'start' message. Test: pty-manager.test.ts line 32. |
| TERM-02 | 01-01, 01-02 | Full ANSI/color output with correct Claude CLI interactive behavior | SATISFIED | TERM=xterm-256color in spawn env; xterm.js with WebGL renderer. Test: pty-manager.test.ts lines 40-66. User confirmed. |
| TERM-03 | 01-03 | Multiline messages composed in input area before sending | SATISFIED | Composer: Enter sends `value + '\r'`, Shift+Enter inserts newline, clears after send. 8 tests pass. |
| TERM-04 | 01-04 | Terminal supports scrollback buffer and keyboard copy/paste | SATISFIED | scrollback: 5000 in xterm.js Terminal config. Human verified: scroll, Cmd+C copy, Ctrl+C SIGINT all working. |
| TERM-05 | 01-02 | Terminal resizes correctly when browser window or sidebar changes | SATISFIED | useResize with 150ms debounce → fitAddon.fit() → sendResize WebSocket message → resizeSession(). 7 tests pass. |

All 5 phase requirements satisfied. No orphaned requirements.

### Anti-Patterns Found

None detected. Scan results:
- No TODO/FIXME/XXX/HACK/PLACEHOLDER comments in source files
- No `return null` or `return {}` stub returns in components or API handlers
- No console.log-only implementations
- All handlers perform real work (not just e.preventDefault())

### Human Verification Required

#### 1. TERM-04: Terminal Scrollback and Copy/Paste

**Test:** Open app, connect to a directory, generate sufficient terminal output, then: (a) scroll up with mouse to confirm history is visible; (b) select text and press Cmd+C, paste elsewhere to confirm copy; (c) press Ctrl+C inside terminal to confirm SIGINT is delivered (not clipboard copy).
**Expected:** Scroll reveals history; Cmd+C copies selected text to clipboard; Ctrl+C interrupts the running process.
**Why human:** Clipboard API (`navigator.clipboard`) and SIGINT delivery to a PTY subprocess cannot be verified through unit tests or static analysis.
**Result:** CONFIRMED PASSING — user approved all 5 success criteria in live browser session on 2026-04-30.

### Deviations from Original Plans (Auto-Corrected During E2E)

The following deviations were discovered during Plan 01-04 human verification and fixed before phase sign-off. All are committed and present in the codebase:

1. **node-pty spawn-helper missing execute bit** — Added `postinstall` chmod script in package.json (commit `8def504`).
2. **React StrictMode double-init** — Added `cancelled` flag pattern in Terminal.tsx useEffect (commit `7b078e2`).
3. **Composer sent `\n` instead of `\r`** — Changed to `value + '\r'` in Composer.tsx (commit `a6c7427`). Composer tests updated to expect `\r`.
4. **UX hardening** — Composer-only input (terminal clicks redirect focus), osascript native folder picker, localStorage + URL persistence, auto-connect on saved path (commits `c0285ec`, `a22c523`, `0be779d`, `79d8944`).

These are improvements above the plan baseline, not regressions. All are working and tested.

---

_Verified: 2026-04-30T18:47:00Z_
_Verifier: Claude (gsd-verifier)_
