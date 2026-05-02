---
phase: 10
slug: pty-session-persistence
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-02
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + React Testing Library |
| **Config file** | vitest.config.ts (project root) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-T1 | 01 | 1 | PTY-01, PTY-05 | unit (RED stubs) | `npm run test -- --run --reporter=verbose tests/usePty.test.ts` | ⬜ W0 | ⬜ pending |
| 10-01-T2 | 01 | 1 | PTY-04 | unit (RED stubs) | `npm run test -- --run --reporter=verbose tests/useSessionManager.test.ts` | ⬜ W0 | ⬜ pending |
| 10-01-T3 | 01 | 1 | PTY-04 | unit (RED stubs) | `npm run test -- --run --reporter=verbose tests/SessionTabBar.test.tsx` | ⬜ W0 | ⬜ pending |
| 10-01-T4 | 01 | 1 | PTY-02, PTY-03 | unit (GREEN) | `npm run test -- --run tests/session-registry.test.ts` | ⬜ W0 | ⬜ pending |
| 10-02-T1 | 02 | 2 | PTY-01, PTY-04, PTY-05 | unit | `npm run test -- --run` | ⬜ W0 | ⬜ pending |
| 10-02-T2 | 02 | 2 | PTY-02 | unit | `npm run test -- --run` | ⬜ W0 | ⬜ pending |
| 10-03-T1 | 03 | 3 | PTY-03 | unit | `npm run test -- --run` | ⬜ W0 | ⬜ pending |
| 10-03-T2 | 03 | 3 | all | checkpoint | manual — see Manual-Only Verifications below | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/usePty.test.ts` — RED stubs for PTY-01 (sessionId prop change re-opens WS) and PTY-05 (session-ready→waiting and exit→done on reconnect)
- [ ] `tests/useSessionManager.test.ts` — RED stubs for PTY-04 (restoreForCwd sets reconnecting status)
- [ ] `tests/SessionTabBar.test.tsx` — RED stubs for PTY-04 (status--reconnecting CSS class)
- [ ] `tests/session-registry.test.ts` — GREEN verification tests for PTY-02 (buffer replay) and PTY-03 (TTL cleanup)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser reload reconnects live PTY | PTY-persist | Requires live WebSocket + PTY process | Open app, start session, reload page, verify output resumes |
| Scrollback replay on reconnect | PTY-scrollback | Requires real scrollback buffer | Start session with output, disconnect, reconnect, verify history visible |
| Session TTL cleanup | PTY-ttl | Requires time manipulation | Verify idle sessions are cleaned up server-side after TTL |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
