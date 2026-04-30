---
phase: 1
slug: pty-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend) + node built-ins (backend) |
| **Config file** | vitest.config.ts / none — Wave 0 installs |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && npm run test:e2e` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && npm run test:e2e`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | TERM-01 | unit | `npm run test -- pty` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | TERM-02 | unit | `npm run test -- terminal` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | TERM-03 | unit | `npm run test -- composer` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | TERM-04 | manual | — | — | ⬜ pending |
| 1-01-05 | 01 | 1 | TERM-05 | unit | `npm run test -- resize` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/pty.test.ts` — stubs for TERM-01 (PTY spawn + folder selection)
- [ ] `tests/terminal.test.ts` — stubs for TERM-02 (ANSI rendering)
- [ ] `tests/composer.test.ts` — stubs for TERM-03 (multiline composer)
- [ ] `tests/resize.test.ts` — stubs for TERM-05 (terminal resize/reflow)
- [ ] `vitest.config.ts` — if no framework detected

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scroll back through terminal history + keyboard copy/paste | TERM-04 | Requires browser interaction and clipboard API; no headless automation | Open browser, run session, scroll up, select text, Cmd+C/Ctrl+C |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
