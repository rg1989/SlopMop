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

- [ ] `src/__tests__/fileTree.test.ts` — stubs for FILE-01, FILE-02 (file tree rendering, git toggle)
- [ ] `src/__tests__/fileAttachment.test.ts` — stubs for FILE-03, FILE-04 (@path injection)
- [ ] `server/__tests__/fileEndpoints.test.ts` — path traversal security test for `/api/file`

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Image preview renders correctly | FILE-03 | Requires visual inspection of rendered image | Select an image file, confirm thumbnail appears in attachment area |
| File contents open in preview panel | FILE-05 | Requires UI interaction | Click any file in tree, confirm preview panel opens with content |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
