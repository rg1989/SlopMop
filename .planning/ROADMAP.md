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
**Requirements:** PTY-01, PTY-02, PTY-03, PTY-04, PTY-05 (defined in REQUIREMENTS.md)
**Plans:** 3/3 plans complete

Plans:
- [ ] 10-01-PLAN.md — Wave 0 RED test stubs for all 5 requirements (usePty, useSessionManager, SessionTabBar)
- [ ] 10-02-PLAN.md — Core hooks: add 'reconnecting' status, fix restoreForCwd, wire session-ready handler in usePty
- [ ] 10-03-PLAN.md — Visual layer: status--reconnecting chip in SessionTabBar + App.css, human verify

### Phase 11: canvas-panel-extraction

**Goal:** Remove Live Canvas from sidebar tabs and mount it as a persistent, always-visible resizable panel in the right column — split vertically from the editor panel. Includes toolbar toggle, per-direction resize handle, and localStorage persistence for show/hide state and split height.

**Depends on:** Phase 10
**Requirements:** CANVAS-01, CANVAS-02, CANVAS-03, CANVAS-04, CANVAS-05
**Plans:** 4 plans

Plans:
- [ ] 11-01-PLAN.md — Wave 0 RED test stubs for all 5 canvas behaviors (sidebar tab removal, visibility toggle, localStorage persistence)
- [ ] 11-02-PLAN.md — App.tsx restructure: remove sidebar canvas tab, add canvas column state/hooks/JSX
- [ ] 11-03-PLAN.md — CSS: canvas-column, canvas-column-header, canvas-column-label, canvas-toggle-btn classes in App.css
- [ ] 11-04-PLAN.md — FolderPicker toolbar toggle button + human verify

### Phase 12: bottom-panel-shell

**Goal:** Add a bottom panel zone below the main session area, separated by a horizontal resize handle. Includes collapse toggle, tab bar scaffold (for future terminal tabs), and localStorage persistence for height and open/closed state.

**Depends on:** Phase 11
**Requirements:** TBD
**Plans:** TBD — pending /gsd:plan-phase

### Phase 13: raw-terminal-sessions

**Goal:** Populate the bottom panel with plain PTY terminal sessions — no Claude agent, just a raw shell. Supports multiple tabs with add/close, each tab is an independent PTY process. Reuses existing usePty infrastructure.

**Depends on:** Phase 12
**Requirements:** TBD
**Plans:** TBD — pending /gsd:plan-phase

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1–9. v1.0 Foundation | 25/25 | ✅ Complete | 2026-05-02 |
| 10. PTY Session Persistence | 3/3 | Complete    | 2026-05-02 |
| 11. Canvas Panel Extraction | 0/4 | Planned | — |
| 12. Bottom Panel Shell | 0/? | Planned | — |
| 13. Raw Terminal Sessions | 0/? | Planned | — |
