---
phase: 13
slug: raw-terminal-sessions
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-03
validated: 2026-05-03
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x + React Testing Library |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/App.rawTerminal.test.tsx` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/App.rawTerminal.test.tsx`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 0 | RAWTERM-01..06 stubs | unit | `npx vitest run tests/App.rawTerminal.test.tsx` | ✅ | ✅ green |
| 13-01-02 | 01 | 1 | RAWTERM-01 | unit | `npx vitest run tests/App.rawTerminal.test.tsx` | ✅ | ✅ green |
| 13-01-03 | 01 | 1 | RAWTERM-02 | unit | `npx vitest run tests/App.rawTerminal.test.tsx` | ✅ | ✅ green |
| 13-02-01 | 02 | 1 | RAWTERM-03 | unit | `npx vitest run tests/App.rawTerminal.test.tsx` | ✅ | ✅ green |
| 13-02-02 | 02 | 1 | RAWTERM-04 | unit | `npx vitest run tests/App.rawTerminal.test.tsx` | ✅ | ✅ green |
| 13-02-03 | 02 | 1 | RAWTERM-05 | unit | `npx vitest run tests/App.rawTerminal.test.tsx` | ✅ | ✅ green |
| 13-02-04 | 02 | 1 | RAWTERM-06 | unit | `npx vitest run tests/App.rawTerminal.test.tsx` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/App.rawTerminal.test.tsx` — RAWTERM-01 through RAWTERM-06, all 6 tests green

Follows the established `App.bottomPanel.test.tsx` pattern: heavy mocking of `useDragResize`, `useSessionManager`, xterm.js, and WebSocket. All other test infrastructure (useSessionManager, usePty, session-registry) already exists.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Terminal renders and accepts input visually | RAWTERM-01 | xterm.js canvas rendering not testable in jsdom | Open app, open bottom panel, type a command, verify output appears |
| Tab resize triggers terminal refit | RAWTERM-03 | Resize observer not functional in jsdom | Drag bottom panel resize handle, verify terminal text reflows |

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
| Escalated (manual-only) | 2 (xterm.js canvas render, resize observer) |

**Finding:** VALIDATION.md created during planning; sign-offs not updated after execution. `tests/App.rawTerminal.test.tsx` exists with 6/6 tests green. No new tests needed.
