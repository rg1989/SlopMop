---
phase: 06-slop-config-vault
plan: 04
subsystem: client-hooks
tags: [server-backed-io, settings, recent-paths, tdd, migration]
dependency_graph:
  requires: [06-02, 06-03]
  provides: [server-backed-settings, server-backed-recent-paths]
  affects: [useSettings, FolderPicker]
tech_stack:
  added: []
  patterns: [fetch-on-mount, fire-and-forget-PUT, localStorage-migration, active-flag-cleanup]
key_files:
  created: []
  modified:
    - client/hooks/useSettings.ts
    - client/components/FolderPicker.tsx
    - tests/useSettings.test.ts
    - tests/FolderPicker.test.tsx
decisions:
  - "useSettings mount effect uses active flag for cleanup — prevents stale setSettings on unmounted component"
  - "FolderPicker named export used in tests (not default) — matches component definition, fixes wave-0 stub import"
  - "TS type narrowing via cast-after-find pattern (putCall as [string, RequestInit]) — avoids broken overload on find() callback with destructured args"
metrics:
  duration: "6min"
  completed_date: "2026-05-01"
  tasks_completed: 2
  files_modified: 4
---

# Phase 6 Plan 4: useSettings + FolderPicker Server Migration Summary

useSettings and FolderPicker migrated to server-backed I/O via GET/PUT /api/global-settings and GET/PUT /api/recent-paths respectively, with localStorage as instant-read init and transparent migration path; all 6 Wave 0 stub tests now GREEN.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | useSettings server migration | aa64c7b | useSettings.ts, tests/useSettings.test.ts |
| 2 | FolderPicker recent paths server migration | bd04c0f | FolderPicker.tsx, tests/FolderPicker.test.tsx |

## What Was Built

**Task 1 — useSettings server migration:**

`client/hooks/useSettings.ts` gained a mount-only `useEffect` that:
1. Fetches GET `/api/global-settings` on mount
2. If server returns settings: merges with DEFAULTS via `setSettings`, clears localStorage
3. If server returns null: reads current localStorage value and migrates via PUT (fire-and-forget)

`update()` now fires PUT `/api/global-settings` (fire-and-forget) in addition to the existing localStorage save. Hook return type unchanged — callers unaffected.

`tests/useSettings.test.ts` replaced 4 placeholder `expect(true).toBe(false)` stubs with real assertions using `renderHook`, `waitFor`, and `vi.stubGlobal` fetch mocking.

**Task 2 — FolderPicker recent paths server migration:**

`client/components/FolderPicker.tsx` gained:
- Mount effect: GET `/api/recent-paths` → overwrites `recentPaths` state if server returns non-empty array
- cwd effect: after `addRecentPath`, also fires PUT `/api/recent-paths` with updated list
- `handleRemoveRecent`: after `removeRecentPath`, also fires PUT `/api/recent-paths` with updated list

`tests/FolderPicker.test.tsx` fixed wave-0 import (named export `{ FolderPicker }` not default), replaced 2 placeholder stubs with real assertions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TS2769 overload errors in test files**
- **Found during:** Task 2 build verification
- **Issue:** Destructured parameter type annotation `([url, opts]: [string, RequestInit])` in `.find()` callback caused TypeScript to fail with "No overload matches this call" (TS2769) and "possibly undefined" (TS18048)
- **Fix:** Cast `.mock.calls` to `[string, RequestInit][]` before `.find()`, use non-destructured access `c[0]`, `c[1]`; cast result after `expect().toBeDefined()` check
- **Files modified:** tests/useSettings.test.ts, tests/FolderPicker.test.tsx
- **Commit:** bd04c0f (folded into Task 2 commit)

**2. [Rule 1 - Bug] Fixed FolderPicker test default import**
- **Found during:** Task 2 RED phase
- **Issue:** Wave-0 stub used `import FolderPicker from '../client/components/FolderPicker'` (default import) but component only exports as named export `export function FolderPicker`
- **Fix:** Changed to `import { FolderPicker } from '../client/components/FolderPicker'`
- **Files modified:** tests/FolderPicker.test.tsx
- **Commit:** bd04c0f

**Pre-existing out-of-scope TS errors** (not fixed per scope rules, logged for reference):
- `SuperToolsModal.tsx` — 5 JSX namespace errors (pre-existing)
- `useTts.test.ts` — 4 overload/arguments errors (pre-existing)

## Self-Check: PASSED

- useSettings.ts: FOUND
- FolderPicker.tsx: FOUND
- Commit aa64c7b: FOUND
- Commit bd04c0f: FOUND
- Tests: 4/4 useSettings + 2/2 FolderPicker GREEN
- TS errors from plan changes: 0
