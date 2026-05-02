---
phase: 12-bottom-panel-shell
verified: 2026-05-03T00:33:00Z
status: human_needed
score: 5/5 automated must-haves verified
human_verification:
  - test: "Drag-resize feel"
    expected: "Dragging the horizontal handle above the panel body grows/shrinks the panel smoothly without collapsing the terminal area. Panel never exceeds ~50% of window height."
    why_human: "useDragResize is mocked in unit tests — real drag behavior requires a running browser"
  - test: "localStorage restore across hard reload"
    expected: "After opening panel, resizing it, and pressing Cmd+Shift+R, the panel reopens at the same height"
    why_human: "Unit tests cover height value injection but cannot simulate a full browser reload cycle"
  - test: "Visual style conformance"
    expected: "Tab bar background is dark (matches --surface), chevron is visible and changes direction (down when open, up when closed), no raw hex colors visible"
    why_human: "CSS variable rendering and visual correctness cannot be verified by static grep"
---

# Phase 12: Bottom Panel Shell Verification Report

**Phase Goal:** Implement the bottom panel shell — a persistent, collapsible panel anchored below the terminal area with a tab bar strip, toggle button, drag-resize handle, and localStorage persistence for open state and height.
**Verified:** 2026-05-03T00:33:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A horizontal tab bar strip is always visible at the bottom of .main-area regardless of panel open/closed state | VERIFIED | `.bottom-panel-tab-bar` rendered unconditionally in App.tsx line 598; BPANEL-01 test passes |
| 2 | A toggle button inside the tab bar opens and closes the bottom panel body | VERIFIED | `.bottom-panel-toggle-btn` wired to `toggleBottomPanel` callback (App.tsx line 604); BPANEL-03 test passes |
| 3 | The panel body and resize handle are hidden when closed, visible with the correct pixel height when open | VERIFIED | `{bottomPanelOpen && (<>...<div className="bottom-panel" style={{ height: bottomPanel.width }}>...)}` at App.tsx line 614-628; BPANEL-02 and BPANEL-03 tests pass |
| 4 | Toggling persists bottomPanelOpen to localStorage so state survives reload | VERIFIED | `uiWrite(UI.bottomPanelOpen, !v)` inside `toggleBottomPanel` callback (App.tsx line 219); BPANEL-04 test passes |
| 5 | Panel height is restored from localStorage on mount | VERIFIED | `useState(() => Math.max(BOTTOM_PANEL_MIN, uiRead(UI.bottomPanelHeight, BOTTOM_PANEL_DEFAULT_HEIGHT)))` (App.tsx line 187-189); BPANEL-05 test passes with `300px` assertion |

**Score:** 5/5 truths verified (automated)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/App.bottomPanel.test.tsx` | Unit tests for BPANEL-01..05 | VERIFIED | 254 lines, 5 tests, all GREEN (5/5 pass) |
| `client/App.tsx` | bottomPanelOpen state, bottomPanel useDragResize hook, toggleBottomPanel callback, JSX layout | VERIFIED | All expected identifiers present at lines 184-221 and 598-628 |
| `client/App.css` | CSS classes for bottom panel shell | VERIFIED | All 5 required classes present at lines 4363-4408, all using CSS variables (no raw hex) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `client/App.tsx` | `client/hooks/useDragResize.ts` | `useDragResize(bottomPanelInitHeight, BOTTOM_PANEL_MIN, 'up', bottomPanelMaxRef)` | WIRED | Line 191 — correct signature with 'up' direction and max ref |
| `client/App.tsx` | localStorage | `uiRead/uiWrite` via `UI.bottomPanelOpen` and `UI.bottomPanelHeight` keys | WIRED | Keys defined in UI const (lines 86-87); uiRead in useState initializer (lines 185, 188); uiWrite in toggleBottomPanel (line 219) and drag-end effect (line 213) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BPANEL-01 | 12-01-PLAN.md | Tab bar always rendered regardless of panel state | SATISFIED | `.bottom-panel-tab-bar` rendered unconditionally; test passes |
| BPANEL-02 | 12-01-PLAN.md | Panel body hidden when closed | SATISFIED | Conditional render `{bottomPanelOpen && ...}`; test verifies `.bottom-panel` is null when closed |
| BPANEL-03 | 12-01-PLAN.md | Panel body shown with inline height style when open | SATISFIED | `style={{ height: bottomPanel.width }}` applied; test verifies height truthy after toggle |
| BPANEL-04 | 12-01-PLAN.md | Toggle writes to localStorage | SATISFIED | `uiWrite(UI.bottomPanelOpen, !v)` in callback; test reads localStorage key after click |
| BPANEL-05 | 12-01-PLAN.md | Panel height restored from localStorage on mount | SATISFIED | `uiRead(UI.bottomPanelHeight, ...)` in useState initializer; test sets key to 300, asserts `300px` |

**Note on REQUIREMENTS.md:** The project REQUIREMENTS.md (`.planning/REQUIREMENTS.md`) only defines PTY-01..05 for a v1.1 persistence scope. BPANEL IDs are not registered in that file. This is a known scope boundary — the BPANEL requirements exist only in the phase plans and ROADMAP.md. No orphaned requirements were found.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

CSS audit: All bottom panel CSS classes (lines 4363-4408) use `var(--surface)`, `var(--border)`, `var(--txt-dim)`, `var(--txt)`, `var(--surface-hover)`, `var(--bg)` — no raw hex values. Pre-existing raw hex values elsewhere in App.css (lines 2132-2283) are unrelated to this phase.

No TODO/FIXME/placeholder comments in bottom panel code. No empty implementations. `bottom-panel-body` is intentionally empty per design (Phase 13 will populate it — this is the stated shell contract, not a stub).

### Human Verification Required

#### 1. Drag-resize feel

**Test:** Start `npm run dev`, open http://localhost:5173, open a project, click the chevron toggle to open the panel, then drag the thin horizontal strip above the panel body upward and downward.
**Expected:** Panel grows when dragged up, shrinks when dragged down. Terminal area absorbs the remaining space. Panel cannot exceed ~50% of window height (enforced by `Math.floor(window.innerHeight * 0.5)` max ref).
**Why human:** `useDragResize` is mocked in all unit tests — real drag behavior (mouse events, pixel tracking) can only be validated in a live browser.

#### 2. localStorage restore across hard reload

**Test:** Open the panel, drag it to a non-default height, then hard-reload with Cmd+Shift+R. Also test: close the panel, hard-reload.
**Expected:** After reload with panel open, panel reopens at the exact height it was before reload. After reload with panel closed, only the tab bar strip shows.
**Why human:** Unit tests cover height value injection into state but cannot simulate the full browser unload/load cycle including localStorage persistence through page teardown.

#### 3. Visual style conformance

**Test:** Inspect the bottom panel tab bar and expanded body visually.
**Expected:** Tab bar has a dark surface background matching other panel headers (`--surface`), border separating it from the terminal area, chevron icon visible, changes from up-pointing (when panel is closed) to down-pointing (when open). No jarring colors, no font regressions.
**Why human:** CSS variable rendering, visual weight, and icon direction correctness require human eyes — static grep confirms variable names but not rendered values.

### Gaps Summary

No automated gaps found. All 5 BPANEL requirements are satisfied by the implementation. Full test suite passes (169/169, 28 files). TypeScript check clean (no new errors).

Three human-verification items remain, all related to drag-resize feel, localStorage persistence across real browser reload, and visual style — behaviors that unit tests structurally cannot cover.

---

_Verified: 2026-05-03T00:33:00Z_
_Verifier: Claude (gsd-verifier)_
