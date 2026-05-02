# Roadmap: SlopMop

## Overview

v1.0 Foundation (phases 1–9) shipped 2026-05-02 — see [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md). Phase 10 onward is v1.1.

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

---

## v1.0 Foundation ✅ SHIPPED 2026-05-02

Phases 1–9 — PTY terminal, file explorer, voice I/O, multi-session tabs, onboarding, .slop vault, Shiki rules, AI Guardian, UI persistence. Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

---

## v1.1: PTY Session Persistence

### Phase 10: PTY Session Persistence

**Goal:** Terminal sessions survive browser reloads — closing and reopening the tab reconnects to the live PTY process exactly where you left off, including full output scrollback, using a tmux/screen-style server-side session registry.

**Depends on:** Phase 9 (v1.0 complete)
**Requirements:** (defined in REQUIREMENTS.md)
**Plans:** TBD — pending /gsd:plan-phase

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1–9. v1.0 Foundation | 25/25 | ✅ Complete | 2026-05-02 |
| 10. PTY Session Persistence | 0/? | Planning | — |
