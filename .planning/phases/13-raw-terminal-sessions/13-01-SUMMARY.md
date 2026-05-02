---
phase: 13-raw-terminal-sessions
plan: "01"
subsystem: raw-terminal-sessions
tags: [tdd, hooks, testing, wave-0]
dependency_graph:
  requires: []
  provides: [useRawSessionManager, RawSession, RAWTERM-RED-stubs]
  affects: [client/hooks/useRawSessionManager.ts, tests/App.rawTerminal.test.tsx]
tech_stack:
  added: []
  patterns: [Wave-0-RED-stubs, TDD-RED-GREEN, functional-setState-updater]
key_files:
  created:
    - tests/App.rawTerminal.test.tsx
    - client/hooks/useRawSessionManager.ts
  modified:
    - tests/App.rawTerminal.test.tsx
decisions:
  - "useRawSessionManager accepts cwd: string | null — add() is a no-op when null, keeping hook safe before project connection"
  - "No localStorage persistence for raw sessions — ephemeral by design, simpler than useSessionManager"
  - "remove() uses functional setActiveId updater to read current activeId synchronously, avoiding stale closure"
  - "MAX_RAW_SESSIONS = 4 constant guards against unbounded tab growth"
  - "Wave 0 RED pattern: @ts-expect-error on RawTerminalPane import since component does not exist yet; useRawSessionManager @ts-expect-error removed after hook created"
metrics:
  duration: "~2 min"
  completed: "2026-05-03"
  tasks_completed: 2
  files_changed: 2
---

# Phase 13 Plan 01: Wave 0 RED Stubs + useRawSessionManager Hook Summary

**One-liner:** Wave 0 RED test stubs for all 6 RAWTERM requirements plus GREEN useRawSessionManager hook with add/remove/setActive/updateStatus and a 4-session cap.

## What Was Built

### Task 1: Wave 0 RED stubs (tests/App.rawTerminal.test.tsx)
- 6 describe blocks for RAWTERM-01 through RAWTERM-06
- Copied all vi.mock() blocks from App.bottomPanel.test.tsx (same component tree)
- Added mock for useRawSessionManager (exported mockAdd spy for RAWTERM-05)
- Added mock for RawTerminalPane with isActive/cwd props captured for RAWTERM-03/06
- All 6 tests fail RED — missing App.tsx wiring and RawTerminalPane component

### Task 2: useRawSessionManager hook (client/hooks/useRawSessionManager.ts)
- Exports `RawSession` interface and `UseRawSessionManagerReturn` interface
- `add()` creates session with `status: 'connecting'`, sets it as activeId; no-op when cwd null or count >= 4
- `remove(id)` filters session out; if it was activeId, activates last remaining or null
- `setActive(id)` updates activeId
- `updateStatus(id, status)` maps over sessions to update status field
- No dependencies added — uses only React hooks and native crypto.randomUUID()

## Deviations from Plan

None — plan executed exactly as written. The @ts-expect-error on the useRawSessionManager mock was removed (as directed by the plan) after the hook was created.

## Self-Check

Checked after writing:
- tests/App.rawTerminal.test.tsx: exists, 6 describe blocks confirmed
- client/hooks/useRawSessionManager.ts: exists, exports useRawSessionManager and RawSession
- All 6 RAWTERM tests fail RED from missing App wiring (not from hook TypeScript errors)
- No package.json changes
- Commits: 295d06f (RED stubs), 95ecce3 (GREEN hook)
