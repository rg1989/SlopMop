---
phase: 14-canvas-mcp-and-connections
plan: "02"
subsystem: api
tags: [canvas, sse, rest-api, node, express, typescript, persistence]

requires:
  - phase: 14-canvas-mcp-and-connections
    provides: Wave 0 RED tests establishing contracts for canvas-tab-store

provides:
  - CanvasTab CRUD store with atomic persistence to .slop/canvas-state.json
  - SSE fan-out for canvas tab mutations via /api/canvas/events
  - 8 REST routes on /api/canvas/tabs for create/read/update/delete/lock/unlock
  - wrapHtml function injecting full theme CSS vars and canvas utility classes

affects:
  - 14-04-MultiTabCanvasPanel (consumes REST + SSE)
  - 14-05-canvas-mcp-tools (writes via REST)

tech-stack:
  added: []
  patterns:
    - "atomicWrite (tmp+rename) pattern from live-canvas.ts copied verbatim"
    - "SSE fan-out with writableEnded check and stale client cleanup"
    - "setTabsGetter injection to break circular dep between store and SSE module"
    - "TDD: RED commit first, GREEN commit on passing, no refactor needed"

key-files:
  created:
    - server/canvas-tab-store.ts
    - server/canvas-tab-sse.ts
    - tests/canvas-tab-store.test.ts
  modified:
    - server/index.ts

key-decisions:
  - "setTabsGetter injection pattern used to avoid circular import between canvas-tab-store and canvas-tab-sse at module load time"
  - "initCanvasStore called with process.cwd() on server startup — canvas tabs are global to server instance, not per-project"
  - "wrapHtml trimStart before DOCTYPE detection per RESEARCH.md pitfall 5 — handles leading whitespace correctly"
  - "notifyCanvasTabsUpdated() called after atomicWrite in persist() — SSE clients always see consistent state"

patterns-established:
  - "Canvas REST routes use get-before-mutate 404 pattern: check getTab before lockTab/updateTab/closeTab"
  - "Tab limit enforced at createTab level — returns null, caller maps to 422"

requirements-completed: [MCP-01, MCP-02, MCP-03, MCP-04, CANVASTAB-04]

duration: 5min
completed: 2026-05-03
---

# Phase 14 Plan 02: Canvas Tab Store, SSE, and REST API Summary

**In-memory canvas tab store with atomic JSON persistence, SSE broadcast, and 8 REST endpoints powering all canvas tab operations**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-03T16:47:10Z
- **Completed:** 2026-05-03T16:51:50Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `server/canvas-tab-store.ts` — CanvasTab CRUD with module-level Map, wrapHtml (DOCTYPE passthrough + full theme injection), atomic persistence, 20-tab limit
- `server/canvas-tab-sse.ts` — SSE fan-out with stale-client cleanup; circular dep avoided via setTabsGetter injection
- 8 REST routes in `server/index.ts` covering all canvas tab operations
- 12 unit tests all GREEN

## Task Commits

1. **Task 1 RED: canvas-tab-store failing tests** - `5d87b5f` (test)
2. **Task 1 GREEN: canvas-tab-store + canvas-tab-sse implementation** - `2c77bd3` (feat)
3. **Task 2: REST routes and SSE endpoint in index.ts** - `67f5fc3` (feat)

## Files Created/Modified

- `server/canvas-tab-store.ts` — CanvasTab interface, CRUD functions, wrapHtml, atomicWrite, persist, initCanvasStore
- `server/canvas-tab-sse.ts` — SSE client set, registerCanvasTabSseClient, notifyCanvasTabsUpdated, setTabsGetter
- `tests/canvas-tab-store.test.ts` — 12 unit tests covering all exported functions
- `server/index.ts` — imports + initCanvasStore startup call + 8 canvas REST routes

## Decisions Made

- **setTabsGetter injection:** `canvas-tab-sse.ts` uses a getter function registered by `initCanvasStore` rather than directly importing `getAllTabs` — avoids circular ESM import at load time. Test mock includes both `notifyCanvasTabsUpdated` and `setTabsGetter`.
- **process.cwd() for initCanvasStore:** Canvas tabs are server-global (not per-project), so using `process.cwd()` at server startup is correct — matches the server's project context.
- **wrapHtml trimStart:** Per RESEARCH.md pitfall 5, `rawHtml.trimStart()` is used for DOCTYPE detection before wrapping, but original `rawHtml` is returned unchanged for passthrough cases.

## Deviations from Plan

None — plan executed exactly as written. The only adjustment was adding `setTabsGetter` to the mock to match the implementation's circular-dep resolution pattern.

## Issues Encountered

- Circular dependency between `canvas-tab-store.ts` (imports `notifyCanvasTabsUpdated`) and `canvas-tab-sse.ts` (needed `getAllTabs`). Resolved by injecting a getter function via `setTabsGetter` — SSE module holds a `_getAll` reference, store calls `setTabsGetter(getAllTabs)` in `initCanvasStore`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 8 REST endpoints live and tested
- SSE broadcast wired — `/api/canvas/events` delivers full tab list on every mutation
- `server/canvas-tab-store.ts` exports ready for MCP tools (plan 05) to call directly
- `MultiTabCanvasPanel` (plan 04) can now consume `/api/canvas/tabs` and `/api/canvas/events`

---
*Phase: 14-canvas-mcp-and-connections*
*Completed: 2026-05-03*
