---
phase: 12
slug: bottom-panel-shell
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-02
validated: 2026-05-03
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.0.0 + @testing-library/react ^16 |
| **Config file** | vitest.config.ts (project root) |
| **Quick run command** | `npm test -- --reporter=verbose bottom-panel` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --reporter=verbose bottom-panel`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 0 | BPANEL-01..05 stubs | unit | `npm test -- App.bottomPanel` | ✅ | ✅ green |
| 12-01-02 | 01 | 1 | BPANEL-01 | unit | `npm test -- App.bottomPanel` | ✅ | ✅ green |
| 12-01-03 | 01 | 1 | BPANEL-02,03 | unit | `npm test -- App.bottomPanel` | ✅ | ✅ green |
| 12-01-04 | 01 | 1 | BPANEL-04 | unit | `npm test -- App.bottomPanel` | ✅ | ✅ green |
| 12-01-05 | 01 | 1 | BPANEL-05 | unit | `npm test -- App.bottomPanel` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/App.bottomPanel.test.tsx` — BPANEL-01 through BPANEL-05, all 5 tests green

*Existing infrastructure covers vitest + RTL — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag resize feel / UX | BPANEL-03 | RTL cannot simulate mousemove drag | Open app, drag the horizontal handle, verify panel grows/shrinks smoothly |
| localStorage survives reload | BPANEL-04,05 | RTL localStorage is ephemeral | Open app, resize + toggle, hard-reload, verify state restored |

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
| Escalated (manual-only) | 2 (drag resize UX, localStorage reload survival) |

**Finding:** VALIDATION.md created during planning; sign-offs not updated after execution. `tests/App.bottomPanel.test.tsx` exists with 5/5 tests green. No new tests needed.
