---
phase: 01-pty-core
plan: 01
subsystem: infra
tags: [node-pty, express, websocket, ws, typescript, vitest, vite, react]

# Dependency graph
requires: []
provides:
  - Express HTTP server on port 3000 with WebSocket at /ws
  - PTY manager: spawnSession(cwd, cols, rows) spawning claude CLI in real PTY
  - WebSocket handler routing start/input/resize/kill messages
  - shared/protocol.ts ClientMessage and ServerMessage union types
  - Vitest test infrastructure with 6 passing unit tests for TERM-01 and TERM-02
affects: [01-02, 01-03, all frontend plans]

# Tech tracking
tech-stack:
  added:
    - express@4.19 (HTTP server + static serving)
    - ws@8.17 (WebSocket server)
    - node-pty@1.1 (real PTY allocation for Claude CLI)
    - concurrently@9 (parallel dev server runner)
    - vite@6 (frontend bundler)
    - "@vitejs/plugin-react@4.3"
    - typescript@5.5
    - tsx@4.16 (TypeScript server runner)
    - vitest@3 (test runner)
    - "@testing-library/react@16"
    - "@testing-library/jest-dom@6.4"
    - jsdom@24
  patterns:
    - TDD with vi.hoisted() for ESM mock hoisting in Vitest
    - Login-shell PATH injection via execSync('/bin/bash -lc "echo $PATH"')
    - PTY-WebSocket bridge: onData piped to ws.send, ws.on('message') piped to ptyProcess.write
    - PTY killed on WebSocket close to avoid orphan processes

key-files:
  created:
    - package.json
    - tsconfig.json
    - vite.config.ts
    - vitest.config.ts
    - shared/protocol.ts
    - tests/setup.ts
    - tests/pty-manager.test.ts
    - server/pty-manager.ts
    - server/ws-handler.ts
    - server/index.ts
  modified: []

key-decisions:
  - "Use vi.hoisted() for Vitest mock factory — vi.mock is hoisted but factory closures are not; hoisted() ensures mocks are initialized before module imports"
  - "Inject login-shell PATH from /bin/bash -lc rather than relying on process.env.PATH — prevents claude-not-found errors in non-interactive Node.js process"
  - "Kill PTY on WebSocket close in Phase 1 — session persistence deferred to v2 (POW-05)"

patterns-established:
  - "Pattern: vi.hoisted() — always use for mock objects referenced inside vi.mock() factory in Vitest ESM projects"
  - "Pattern: LOGIN_PATH at module load — compute login shell PATH once on server startup, inject into every PTY spawn"

requirements-completed: [TERM-01, TERM-02]

# Metrics
duration: 3min
completed: 2026-04-30
---

# Phase 1 Plan 01: PTY Core Backend Summary

**node-pty PTY manager + WebSocket bridge + Express server with 6 passing Vitest unit tests for TERM-01/TERM-02**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-30T14:31:54Z
- **Completed:** 2026-04-30T14:34:47Z
- **Tasks:** 2 (Task 1: scaffold + RED phase, Task 2: implementation + GREEN phase)
- **Files created:** 10

## Accomplishments
- Monorepo scaffolded with all dependencies (node-pty, ws, express, vite, vitest, react, typescript)
- PTY manager implements spawnSession() with correct cwd, cols/rows, TERM=xterm-256color, and login-shell PATH
- WebSocket handler routes all 4 message types (start/input/resize/kill) with error handling and PTY cleanup on close
- shared/protocol.ts provides ClientMessage and ServerMessage union types for frontend consumption
- All 6 unit tests pass: cwd propagation, TERM env var, cols/rows, resize delegation, return value

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold monorepo + test infrastructure (RED phase)** - `e8aad27` (test)
2. **Task 2: Implement backend PTY manager + WebSocket handler + HTTP server (GREEN phase)** - `e49fd21` (feat)

_Note: TDD tasks — test commit (RED) followed by implementation commit (GREEN)_

## Files Created/Modified
- `package.json` - All dependencies declared for full monorepo
- `tsconfig.json` - TypeScript config for server/client/shared/tests
- `vite.config.ts` - Vite config with React plugin and WebSocket proxy
- `vitest.config.ts` - Vitest config with jsdom environment and jest-dom setup
- `shared/protocol.ts` - ClientMessage and ServerMessage union types
- `tests/setup.ts` - jest-dom import for testing-library matchers
- `tests/pty-manager.test.ts` - 6 unit tests covering TERM-01 and TERM-02
- `server/pty-manager.ts` - spawnSession() and resizeSession() using node-pty
- `server/ws-handler.ts` - attachWebSocketServer() with full message routing
- `server/index.ts` - Express server + WebSocket at port 3000

## Decisions Made
- Used `vi.hoisted()` for Vitest mock initialization — vi.mock factory is hoisted before variable declarations, requiring vi.hoisted() to create mocks that are available at hoist time
- Inject login-shell PATH using `execSync('/bin/bash -lc "echo $PATH"')` at module load time — ensures NVM/Homebrew/pyenv paths are included so `claude` is found
- Kill PTY on WebSocket close (no session persistence) — per Phase 1 scope; persistence deferred to v2

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.mock factory hoisting in Vitest ESM**
- **Found during:** Task 2 (GREEN phase — first test run)
- **Issue:** Test file defined `mockSpawn` as a `const` but `vi.mock()` is hoisted above all variable declarations by Vitest's transformer, causing `ReferenceError: Cannot access 'mockSpawn' before initialization`
- **Fix:** Changed mock variable declarations to use `vi.hoisted(() => ...)` which creates initializers that run at hoist time, before module imports
- **Files modified:** tests/pty-manager.test.ts
- **Verification:** All 6 tests pass after fix
- **Committed in:** e49fd21 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Fix was essential for tests to run. No scope creep — test file only, behavior unchanged.

## Issues Encountered
- Vitest ESM mock hoisting: `vi.mock()` factory cannot reference variables defined in module scope. Resolved with `vi.hoisted()` pattern (documented in patterns-established for future plans).

## User Setup Required
None - no external service configuration required. Note: `npm run server` requires `claude` CLI on PATH. Server will throw on first PTY spawn if claude is not installed.

## Next Phase Readiness
- Backend fully functional: server starts, WebSocket accepts connections, PTY spawns when `start` message received
- shared/protocol.ts ready for frontend consumption by plans 01-02 and 01-03
- Vitest infrastructure in place for all subsequent test files
- No blockers for parallel execution of 01-02 (xterm.js Terminal component) and 01-03 (Composer + FolderPicker)

---
*Phase: 01-pty-core*
*Completed: 2026-04-30*
