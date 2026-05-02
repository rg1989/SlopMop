---
phase: 11-canvas-panel-extraction
plan: 04
subsystem: ui
tags: [react, canvas, toolbar, toggle, FolderPicker]

# Dependency graph
requires:
  - phase: 11-02
    provides: canvas state (isCanvasVisible, toggleCanvas) in App.tsx
  - phase: 11-03
    provides: canvas-column layout with header close button and resize handle
provides:
  - FolderPicker toolbar canvas toggle button always visible in toolbar
  - fp-canvas-btn CSS with active/inactive states using accent color
  - App.tsx wires toggleCanvas and isCanvasVisible to FolderPicker
affects: [future-canvas-phases]

# Tech tracking
tech-stack:
  added: []
  patterns: [button-always-visible-toggle-pattern, active-state-via-css-modifier-class]

key-files:
  created: []
  modified:
    - client/components/FolderPicker.tsx
    - client/App.tsx
    - client/App.css
    - tests/App.canvasPanel.test.tsx

key-decisions:
  - "Canvas toggle button always rendered when prop is provided, not gated on canvas visibility — ensures user can always re-open canvas"
  - "fp-canvas-btn--active modifier class for accent color state, no JS color switching"
  - "CANVAS-05 test waitFor updated to wait for canvas-column element directly instead of app-body"
  - "Canvas max-width formula changed to Math.floor(window.innerWidth * 0.7) making it independent of sidebar"
  - "Canvas init width clamped to max on startup to prevent restoring out-of-bounds localStorage values"
  - "fp-canvas-btn given border: 1px solid --border, var(--txt) default and accent orange on hover matching fp-rules-btn pattern"

patterns-established:
  - "Always-visible toggle pattern: render button regardless of panel visibility so user can re-open"
  - "CSS modifier class for active state: fp-canvas-btn--active applies accent color cleanly"

requirements-completed: [CANVAS-01, CANVAS-02, CANVAS-03]

# Metrics
duration: 5min
completed: 2026-05-02
---

# Phase 11 Plan 04: Canvas Toggle Button Summary

**FolderPicker toolbar canvas toggle button with accent active state, wired from App.tsx via prop drilling**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-02T23:07:00Z
- **Completed:** 2026-05-02T23:12:00Z
- **Tasks:** 1 auto (Task 2 is human-verify checkpoint, pending user approval)
- **Files modified:** 4

## Accomplishments
- Added `onCanvasToggle` and `isCanvasVisible` optional props to FolderPickerProps
- Canvas toggle button rendered in FolderPicker toolbar (always visible when prop is provided)
- Button shows accent color (`--accent`) when canvas is open, dim when hidden
- `fp-canvas-btn` CSS updated: border, white default, orange hover — matching fp-rules-btn pattern
- App.tsx passes `toggleCanvas` and `isCanvasVisible` to FolderPicker call site
- Canvas max-width formula changed to 70% of viewport (independent of sidebar)
- Canvas init width clamped to max on startup to prevent restoring oversized localStorage values
- All 164 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Add canvas toggle button to FolderPicker and wire from App.tsx** - `7f05b59` (feat)

## Files Created/Modified
- `client/components/FolderPicker.tsx` - Added onCanvasToggle/isCanvasVisible props and canvas toggle button
- `client/App.tsx` - Passes toggleCanvas and isCanvasVisible to FolderPicker
- `client/App.css` - Added fp-canvas-btn, fp-canvas-btn--active CSS classes
- `tests/App.canvasPanel.test.tsx` - Fixed CANVAS-05 test waitFor to wait for canvas-column directly

## Decisions Made
- Canvas toggle button always rendered when `onCanvasToggle` prop is provided — not gated on canvas visibility. This ensures user can always re-open the canvas panel.
- Active state uses CSS modifier class `fp-canvas-btn--active` (clean, no JS color logic)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CANVAS-05 test timing — waitFor too early**
- **Found during:** Task 1 verification (npm test)
- **Issue:** CANVAS-05 test used `waitFor(() => expect('.app-body').not.toBeNull())` then immediately queried `.canvas-column`. Since `.app-body` always exists, `waitFor` resolved before cwd was set, so canvas-column wasn't rendered yet.
- **Fix:** Changed `waitFor` to wait for `.canvas-column` directly, which only appears after cwd is established asynchronously.
- **Files modified:** `tests/App.canvasPanel.test.tsx`
- **Verification:** All 164 tests pass including CANVAS-05
- **Committed in:** `7f05b59` (Task 1 commit)

**2. [Rule 1 - Bug] Canvas max-width not persisting on refresh**
- **Found during:** Human verification
- **Issue:** Canvas init width was clamped only by CANVAS_MIN with no upper bound, so stored values could exceed the effective max. Also canvasMaxRef used `window.innerWidth - 300 - RESIZE_HANDLE_WIDTH` which shared the same constant as sidebar, creating coupling.
- **Fix:** Changed canvas max formula to `Math.floor(window.innerWidth * 0.7)` making it independent of sidebar. Added upper-bound clamp to canvas init width so stored values are clamped on startup.
- **Files modified:** `client/App.tsx`
- **Committed in:** `9e7b77e` (fix commit)

**3. [Rule 1 - Bug] Canvas toggle button styling incorrect**
- **Found during:** Human verification
- **Issue:** Button had no border, `--txt-dim` (dim grey) default color, and only shifted to `--txt` on hover — too subtle and inconsistent with other fp-* buttons.
- **Fix:** Added `border: 1px solid var(--border)`, changed default to `var(--txt)` (white), hover to `var(--accent)` orange with accent-tinted background — matching the `fp-rules-btn` pattern.
- **Files modified:** `client/App.css`
- **Committed in:** `9e7b77e` (fix commit)

---

**Total deviations:** 3 auto-fixed (Rule 1 bugs)
**Impact on plan:** All fixes improve UX correctness. No scope creep.

## Issues Encountered
Pre-existing TypeScript errors in `tests/usePty.test.ts` (unrelated to this plan's changes — logged as out of scope).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Task 2 is a human-verify checkpoint — awaiting user approval of full canvas panel UX
- All code complete: toggle button, canvas column, resize handle, persistence
- Human must verify: 4 sidebar tabs, canvas column, X close button, toolbar toggle button, drag resize, persistence across reload

---
*Phase: 11-canvas-panel-extraction*
*Completed: 2026-05-02*
