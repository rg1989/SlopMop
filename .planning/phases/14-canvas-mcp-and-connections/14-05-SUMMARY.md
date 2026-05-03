---
phase: 14-canvas-mcp-and-connections
plan: "05"
subsystem: api
tags: [mcp, stdio, canvas, node, esm, fetch, zod]

requires:
  - phase: 14-02
    provides: REST endpoints for canvas tab CRUD that this script proxies

provides:
  - server/canvas-mcp-stdio.js — standalone MCP stdio server with 5 canvas tools (canvas_open, canvas_update, canvas_lock, canvas_unlock, canvas_close)
  - Exported callCanvas* functions for test isolation

affects: [14-canvas-mcp-and-connections, claude-cli-mcp-config]

tech-stack:
  added: []
  patterns:
    - "MCP stdio server as thin HTTP proxy — tools call Express REST API via fetch, no business logic in stdio layer"
    - "isMain guard for top-level await in ESM — StdioServerTransport connect gated behind process.argv[1] check so file is importable in tests"
    - "Export tool handler functions alongside registerTool calls — enables unit tests to invoke tool logic without spawning MCP transport"

key-files:
  created:
    - server/canvas-mcp-stdio.js
  modified: []

key-decisions:
  - "Export callCanvas* functions to allow test imports without spawning stdio transport — isMain guard gates the server.connect call"
  - "Use zod (v4) directly (not zod/v4 sub-path) — package.json has zod@^4.4.2 which exports from root as v4 API"
  - "server.tool() instead of server.registerTool() — current MCP SDK version uses .tool() not .registerTool()"

patterns-established:
  - "MCP tool handler exported as named function + wired to server.tool() — separates testability from transport"

requirements-completed: [MCP-05]

duration: 5min
completed: 2026-05-03
---

# Phase 14 Plan 05: Canvas MCP Stdio Server Summary

**Standalone MCP stdio server with 5 canvas tools proxying Express REST API via fetch, with named exports for test isolation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-03T16:54:09Z
- **Completed:** 2026-05-03T16:59:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `server/canvas-mcp-stdio.js` as plain ESM (runs with `node server/canvas-mcp-stdio.js` directly)
- All 5 MCP tools implemented: canvas_open, canvas_update, canvas_lock, canvas_unlock, canvas_close
- Each tool proxies to Express REST API via Node 18+ built-in fetch, returning `{isError:true}` on non-2xx (never throws)
- Named exports (`callCanvasOpen`, `callCanvasClose`, etc.) allow test imports without spawning stdio transport
- All canvas-mcp-tools tests pass (2/2 GREEN)

## Task Commits

1. **Task 1: canvas-mcp-stdio.js — all 5 MCP tools** - `5aa110e` (feat)

## Files Created/Modified

- `server/canvas-mcp-stdio.js` - Standalone MCP stdio server with 5 canvas tools, exported handler functions, isMain guard

## Decisions Made

- Exported `callCanvas*` functions alongside `server.tool()` registrations so tests can import without triggering `StdioServerTransport` connect (which reads stdin and would block tests)
- Used `server.tool()` (not `server.registerTool()`) — the installed `@modelcontextprotocol/sdk@^1.29.0` uses `.tool()` as the registration method
- Used `zod` import (not `zod/v4`) — the installed `zod@^4.4.2` exports the v4 API from the root entry point

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used server.tool() instead of server.registerTool()**
- **Found during:** Task 1
- **Issue:** Plan action block showed `server.registerTool()` but `@modelcontextprotocol/sdk@1.29` exposes `.tool()` as the registration method
- **Fix:** Used `server.tool(name, description, schema, handler)` signature which matches current SDK API
- **Files modified:** server/canvas-mcp-stdio.js
- **Verification:** Tests pass, no runtime errors
- **Committed in:** 5aa110e

**2. [Rule 1 - Bug] Used zod root import instead of zod/v4**
- **Found during:** Task 1
- **Issue:** Plan specified `import { z } from 'zod/v4'` but installed zod@4.x exports v4 API from root; `/v4` sub-path may not exist
- **Fix:** `import { z } from 'zod'` — works correctly with zod@4.4.2
- **Files modified:** server/canvas-mcp-stdio.js
- **Verification:** Tests pass
- **Committed in:** 5aa110e

---

**Total deviations:** 2 auto-fixed (both Rule 1 — API version mismatches between plan and installed packages)
**Impact on plan:** Both fixes required for the code to work at all. No scope creep.

## Issues Encountered

None beyond the API version mismatches resolved above.

## Next Phase Readiness

- `server/canvas-mcp-stdio.js` is ready for Claude CLI MCP configuration (plan 14-03 or similar)
- Script can be registered as MCP server: `node /path/to/server/canvas-mcp-stdio.js`
- `SLOPMOP_PORT` env var must match the running SlopMop server port

---
*Phase: 14-canvas-mcp-and-connections*
*Completed: 2026-05-03*
