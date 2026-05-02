---
phase: 10
slug: pty-session-persistence
status: draft
nyquist_compliant: false
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
| 10-01-01 | 01 | 1 | PTY-persist | unit | `npm run test -- --run` | ⬜ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | PTY-reconnect | unit | `npm run test -- --run` | ⬜ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | PTY-scrollback | integration | `npm run test -- --run` | ⬜ W0 | ⬜ pending |
| 10-02-02 | 02 | 2 | PTY-status | unit | `npm run test -- --run` | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/pty-session-persistence.test.ts` — stubs for reconnect + scrollback replay
- [ ] Existing `tests/` infrastructure covers framework setup

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser reload reconnects live PTY | PTY-persist | Requires live WebSocket + PTY process | Open app, start session, reload page, verify output resumes |
| Scrollback replay on reconnect | PTY-scrollback | Requires real scrollback buffer | Start session with output, disconnect, reconnect, verify history visible |
| Session TTL cleanup | PTY-ttl | Requires time manipulation | Verify idle sessions are cleaned up server-side after TTL |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
