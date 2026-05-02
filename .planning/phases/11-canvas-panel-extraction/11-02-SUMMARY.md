---
phase: 11-canvas-panel-extraction
plan: "02"
subsystem: client/App.tsx
tags: [canvas, sidebar, layout, drag-resize, localStorage, tdd]
dependency_graph:
  requires: [11-01]
  provides: [canvas-column-state, sidebar-4-tabs]
  affects: [client/App.tsx, tests/App.canvasPanel.test.tsx, tests/LiveCanvasColumn.test.tsx]
tech_stack:
  added: []
  patterns: [useDragResize, uiRead/uiWrite localStorage persistence, prevDragging ref pattern, useCallback toggle]
key_files:
  created: []
  modified:
    - client/App.tsx
decisions:
  - "Canvas column state (isCanvasVisible, canvasInitWidth, canvas) initialized from localStorage before render — no flash of wrong state"
  - "canvasMaxRef updated every render in the layout refs block — same pattern as sidebarMaxRef and editorMaxRef"
  - "toggleCanvas uses functional setIsCanvasVisible updater to write localStorage before returning new value — avoids stale closure"
  - "Tasks 1 and 2 committed together since both touch only client/App.tsx and tests were already committed from 11-01"
metrics:
  duration: "4 min"
  completed: "2026-05-02"
  tasks_completed: 2
  files_modified: 1
---

# Phase 11 Plan 02: Canvas Panel Extraction — App.tsx Restructure Summary

Canvas extracted from the sidebar into a persistent right-column panel with drag-resize and localStorage visibility/width persistence.

## What Was Built

- Removed `'canvas'` from `SidebarTabId` union — now 4 tabs: `explorer | changes | roadmap | brain`
- Removed `IconCanvas` component and `{ id: 'canvas', label: 'Live Canvas', Icon: IconCanvas }` from `SIDEBAR_TABS`
- Removed the final `else` branch in sidebar content area that rendered `<LiveCanvasPanel>`
- Added `CANVAS_DEFAULT_WIDTH = 360` and `CANVAS_MIN = 200` layout constants
- Added `canvasVisible` and `canvasWidth` keys to the `UI` persistence object
- Added `isCanvasVisible` state initialized from `localStorage slopmop_ui:canvas_visible` (default true)
- Added `canvasInitWidth` state clamped to `[CANVAS_MIN, innerWidth/3]` from localStorage
- Added `canvasMaxRef` and `canvas = useDragResize(canvasInitWidth, CANVAS_MIN, 'right', canvasMaxRef)`
- Added `prevCanvasDragging` ref with drag-end effect that persists width to `slopmop_ui:canvas_width`
- Added `toggleCanvas` useCallback that flips `isCanvasVisible` and writes to localStorage
- Updated `canvasMaxRef.current` in the layout max-width refs block
- Added canvas column JSX in `app-body` after editor panel, gated on `cwd && isCanvasVisible`
- Canvas column contains: resize handle, `.canvas-column` div, `.canvas-column-header` with label + `.canvas-toggle-btn` (× SVG), `<LiveCanvasPanel cwd={cwd} isDragging={canvas.isDragging} />`

## Test Results

All 5 CANVAS-* tests GREEN:
- CANVAS-04: sidebar has exactly 4 tabs, no "Live Canvas" button
- CANVAS-05: canvas column present when cwd set and visible=true
- CANVAS-01: canvas-column renders when isCanvasVisible is true (default)
- CANVAS-02: canvas-column absent when slopmop_ui:canvas_visible = false
- CANVAS-03: clicking canvas-toggle-btn hides canvas-column and persists false to localStorage

Full suite: 164 tests, 27 test files — all passed.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Note:** Test files (`App.canvasPanel.test.tsx`, `LiveCanvasColumn.test.tsx`) were already committed as part of 11-01 execution. Both Task 1 and Task 2 changes landed in a single commit `6b54c35` since both exclusively touch `client/App.tsx`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 + Task 2 | 6b54c35 | feat(11-02): remove canvas sidebar tab and add canvas column state to App.tsx |

## Self-Check: PASSED

- client/App.tsx: FOUND
- commit 6b54c35: FOUND
- canvas-column JSX in App.tsx: FOUND
- isCanvasVisible state: FOUND
- All 164 tests passing: CONFIRMED
