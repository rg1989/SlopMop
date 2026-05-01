---
phase: 4
slug: multi-session-tabs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-01
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | SESS-01 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 1 | SESS-02 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 4-01-03 | 01 | 1 | SESS-03 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 2 | SESS-04 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 4-02-02 | 02 | 2 | SESS-05 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 4-02-03 | 02 | 2 | SESS-06 | unit | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `client/__tests__/useSessionTabs.test.ts` — unit stubs for SESS-01, SESS-02, SESS-03
- [ ] `client/__tests__/sessionPersistence.test.ts` — stubs for SESS-04, SESS-05
- [ ] `server/__tests__/sessionProtocol.test.ts` — stubs for SESS-06

*Existing vitest infrastructure covers framework; only test files need to be created.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tab bar renders correctly in browser | SESS-01 | Visual layout cannot be unit tested | Open app, verify tab bar appears above terminal, tabs are clickable |
| Status indicators show correct colors | SESS-03 | CSS/visual state not coverable by vitest | Run a command, verify working/waiting/done transitions in UI |
| Session history persists across reload | SESS-04 | localStorage + page reload flow | Create sessions, reload page, verify session names and history restored |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
