---
phase: 11
slug: canvas-panel-extraction
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-02
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
| 11-01-01 | 01 | 0 | sidebar-tab-removal | unit | `npm test -- --run` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 0 | canvas-toggle | unit | `npm test -- --run` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | layout-structure | unit | `npm test -- --run` | ❌ W0 | ⬜ pending |
| 11-01-04 | 01 | 1 | resize-handle | unit | `npm test -- --run` | ❌ W0 | ⬜ pending |
| 11-01-05 | 01 | 2 | localStorage-persistence | unit | `npm test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/canvas-panel-extraction.test.tsx` — stubs for sidebar tab removal (4 tabs not 5), canvas toggle, resize handle, localStorage persistence
- [ ] Existing `tests/` infrastructure covers framework setup

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canvas column resize drag UX | resize-handle | Visual drag interaction hard to automate reliably | Drag canvas resize handle; confirm smooth resize, no iframe pointer-event bleed |
| Canvas show/hide toggle in toolbar | canvas-toggle | Requires live iframe rendering | Click toolbar toggle; confirm canvas column appears/disappears with animation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
