---
phase: 16
slug: overlays-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-03
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + React Testing Library |
| **Config file** | vite.config.ts |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~15 seconds |

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
| 16-01-01 | 01 | 1 | ACTION-01, ACTION-02 | unit | `npm test -- --run --reporter=verbose -t "ActionBar"` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | SLASH-01, SLASH-02 | unit | `npm test -- --run --reporter=verbose -t "SlashMenu.*TerminalInput"` | ❌ W0 | ⬜ pending |
| 16-02-01 | 02 | 1 | ATTACH-01, ATTACH-02 | unit | `npm test -- --run --reporter=verbose -t "AttachBar.*SessionPane"` | ❌ W0 | ⬜ pending |
| 16-03-01 | 03 | 2 | CLEAN-01 | unit | `npm test -- --run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/ActionBar.test.tsx` — stubs for ACTION-01, ACTION-02 (action bar renders in overlay, does not cover cursor row)
- [ ] `tests/SlashMenuIntegration.test.tsx` — stubs for SLASH-01, SLASH-02 (slash menu opens on `/`, closes on Escape/Enter)
- [ ] `tests/AttachBarIntegration.test.tsx` — stubs for ATTACH-01, ATTACH-02 (chips render, X button fires removeAttachment)

Existing test infrastructure (vitest + RTL) covers all phase requirements — no new framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Action bar floats top-right, cursor row stays visible while typing | ACTION-02 | xterm cursor position is rendered on canvas — jsdom cannot inspect | Run `npm run dev`, open Claude session, type text, confirm cursor visible below action bar |
| `/` keystroke opens slash menu without echoing to PTY | SLASH-01 | xterm `attachCustomKeyEventHandler` runs in real browser only | Type `/` in TerminalInput strip, confirm popup appears, confirm no `/` sent to Claude PTY |
| Arrow keys navigate slash menu without moving xterm cursor | SLASH-02 | xterm key interception verified only in real browser | With slash menu open, press arrow keys, confirm highlight moves in menu not in terminal |
| Attachment chips float above strip, not overlapping input | ATTACH-01 | CSS absolute positioning verified only visually | Attach a file, confirm chip strip appears above the 80px input strip without overlap |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
