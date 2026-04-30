---
phase: 02-file-system
plan: "01"
subsystem: file-system-tests
tags: [tdd, wave-0, red-state, file-tree, file-preview, composer]
dependency_graph:
  requires: []
  provides: [file-tree-test-contract, use-file-tree-test-contract, file-preview-test-contract, composer-path-injection-test-contract]
  affects: [02-02, 02-03, 02-04]
tech_stack:
  added: []
  patterns: [tdd-red-state, vitest, testing-library-react, renderHook, vi-mock-fetch]
key_files:
  created:
    - tests/FileTree.test.tsx
    - tests/useFileTree.test.ts
    - tests/FilePreview.test.tsx
  modified:
    - tests/Composer.test.tsx
decisions:
  - "Wave 0 tests import non-existent modules with @ts-expect-error to silence TS while Vitest still runs and fails RED — no stub files needed"
  - "useFileTree tests use global.fetch mock via vi.fn() in beforeEach — matches hook implementation pattern from research"
  - "Composer @path tests appended after existing tests without modifying existing cases — preserves GREEN baseline"
metrics:
  duration: "2 min"
  completed_date: "2026-04-30"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 2 Plan 1: File System Test Scaffolds (Wave 0) Summary

**One-liner:** Vitest RED-state test scaffolds for FileTree (5 tests), useFileTree hook (3 tests), FilePreview (4 tests), and Composer @path injection (4 tests) — behavioral contract for implementation waves.

## Objective

Create Wave 0 test scaffolds for Phase 2 file system features. All tests are written RED — they import modules that don't exist yet. They define the behavioral contract that implementation plans (02-03, 02-04) must satisfy.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create FileTree and useFileTree test scaffolds | 2375d21 | tests/FileTree.test.tsx, tests/useFileTree.test.ts |
| 2 | Create FilePreview scaffold and extend Composer tests | 41cc57c | tests/FilePreview.test.tsx, tests/Composer.test.tsx |

## Test Coverage Created

### tests/FileTree.test.tsx (5 tests — all RED)
- renders file tree — shows directory name and file names (FILE-01)
- toggle dir — clicking directory header collapses children; clicking again expands (FILE-01)
- changedPaths highlights changed file — element has ft-changed class (FILE-02)
- select file adds to selection — double-clicking calls onSelect with absolute path (FILE-03)
- preview click — single-clicking calls onPreview with absolute path (FILE-05)

### tests/useFileTree.test.ts (3 tests — all RED)
- fetches tree on cwd change — calls /api/files?cwd=... and updates tree state (FILE-02)
- setMode to changes calls git-status — fetch called with /api/git-status?cwd=... (FILE-02)
- setMode to all does not call git-status — switching back skips git-status fetch (FILE-02)

### tests/FilePreview.test.tsx (4 tests — all RED)
- renders text content — shows content in pre/code element (FILE-03, FILE-05)
- renders image tag for binary image — img src=data:image/png;base64,... (FILE-03, FILE-05)
- renders binary message for non-image binary — notice text, no img tag (FILE-03, FILE-05)
- renders nothing when content is null — container.firstChild is null (FILE-03)

### tests/Composer.test.tsx (4 new tests — RED; 9 original tests — GREEN)
- @path injection — single attachment — onSend receives @path prepended (FILE-04)
- @path injection — multiple attachments — onSend receives space-separated @paths (FILE-04)
- @path injection — no attachments — onSend called with plain message (FILE-04)
- attachments cleared after send — clearAttachments called once after Enter (FILE-04)

## Verification Results

Full suite run:
- 31 pre-existing tests: GREEN (pty-manager, usePty, useResize, original Composer)
- 3 new @path Composer tests: RED (Composer props not yet implemented)
- FileTree, useFileTree, FilePreview test files: RED with module-not-found (expected)
- Exit code: 0

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

Checking created files exist and commits are recorded.

## Self-Check: PASSED

- FOUND: tests/FileTree.test.tsx
- FOUND: tests/useFileTree.test.ts
- FOUND: tests/FilePreview.test.tsx
- FOUND: tests/Composer.test.tsx (modified)
- FOUND: commit 2375d21 (Task 1)
- FOUND: commit 41cc57c (Task 2)
