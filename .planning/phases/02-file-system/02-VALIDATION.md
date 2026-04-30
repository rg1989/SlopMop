---
phase: 2
slug: file-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vite.config.ts (existing) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | FILE-01 | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | FILE-02 | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | FILE-03 | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 2 | FILE-04 | unit | `npm run test -- --run` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 2 | FILE-05 | manual | n/a | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/FileTree.test.tsx` — stubs for FILE-01, FILE-02 (file tree rendering, git toggle, preview click)
- [ ] `tests/useFileTree.test.ts` — stubs for FILE-02 hook (cwd change fetch, mode toggle)
- [ ] `tests/FilePreview.test.tsx` — stubs for FILE-03, FILE-05 (text/image/binary rendering)
- [ ] `tests/Composer.test.tsx` — extended with @path injection cases for FILE-04

*All four files are created by plan 02-01. Wave 0 tests run RED until implementation plans (02-02 through 02-04) turn them GREEN.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| File attachment chips appear on double-click | FILE-03 | UI interaction | Double-click a file, confirm chip appears below tree with filename |
| File contents open in preview panel | FILE-05 | Requires UI interaction | Click any file in tree, confirm preview panel opens with content |
| Image preview renders correctly | FILE-05 | Requires visual inspection of rendered image | Select an image file, confirm img element appears in preview panel |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
