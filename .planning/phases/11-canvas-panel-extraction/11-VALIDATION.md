---
phase: 11
slug: canvas-panel-extraction
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-02
validated: 2026-05-03
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 0 | sidebar-tab-removal (CANVAS-04) | unit | `npm test -- --run tests/App.canvasPanel.test.tsx` | ✅ | ✅ green |
| 11-01-02 | 01 | 0 | canvas-toggle (CANVAS-03) | unit | `npm test -- --run tests/LiveCanvasColumn.test.tsx` | ✅ | ✅ green |
| 11-01-03 | 01 | 1 | layout-structure (CANVAS-01,02) | unit | `npm test -- --run tests/LiveCanvasColumn.test.tsx` | ✅ | ✅ green |
| 11-01-04 | 01 | 1 | resize-handle | manual | see Manual-Only | n/a | manual-only |
| 11-01-05 | 01 | 2 | localStorage-persistence (CANVAS-05) | unit | `npm test -- --run tests/App.canvasPanel.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/App.canvasPanel.test.tsx` — CANVAS-04 (sidebar 4 tabs) and CANVAS-05 (localStorage width restore)
- [x] `tests/LiveCanvasColumn.test.tsx` — CANVAS-01 (column visible), CANVAS-02 (column hidden), CANVAS-03 (toggle + localStorage persist)

*Note: Actual test files differ from the originally planned `tests/canvas-panel-extraction.test.tsx` — split across two files during implementation. All requirements covered.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canvas column resize drag UX | resize-handle | Visual drag interaction hard to automate reliably | Drag canvas resize handle; confirm smooth resize, no iframe pointer-event bleed |
| Canvas show/hide toggle in toolbar | canvas-toggle | Requires live iframe rendering | Click toolbar toggle; confirm canvas column appears/disappears with animation |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** retroactive — 2026-05-03

---

## Validation Audit 2026-05-03

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated (manual-only) | 1 (resize-handle drag UX) |

**Finding:** VALIDATION.md was created during phase planning but sign-offs were never updated after execution. Tests existed and passed (17/17 green). No new tests were needed — documentation staleness only.
