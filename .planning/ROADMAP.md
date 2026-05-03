# Roadmap: SlopMop

## Overview

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

---

## v1.0 Foundation ✅ SHIPPED 2026-05-02

Phases 1–9 — PTY terminal, file explorer, voice I/O, multi-session tabs, onboarding, .slop vault, Shiki rules, AI Guardian, UI persistence. Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

---

## v1.1 Shell + Canvas ✅ SHIPPED 2026-05-03

Phases 10–14 — PTY session persistence, canvas panel extraction, bottom panel shell, raw terminal sessions, canvas MCP + multi-tab canvas + MCP connections UI. Full details: [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md)

---

## v1.2 Terminal-Native Composer

### Phases

- [x] **Phase 15: Terminal Input Core** - Replace Composer textarea with xterm.js terminal strip wired to Claude PTY (completed 2026-05-03)
- [ ] **Phase 16: Overlays + Cleanup** - Float action bar, slash command popup, and attachment chips as overlays; remove old Composer

---

## Phase Details

### Phase 15: Terminal Input Core
**Goal**: Users interact with Claude through a real terminal input — typing, arrow-key menus, and control sequences all work natively
**Depends on**: Phase 14 (v1.1 complete)
**Requirements**: TINPUT-01, TINPUT-02, TINPUT-03, TINPUT-04
**Success Criteria** (what must be TRUE):
  1. User can type a message in the terminal input strip and send it to Claude by pressing Enter
  2. When Claude presents a permission menu (Yes/No), user can navigate options with arrow keys and confirm with Enter
  3. User can send Ctrl+C to interrupt, Ctrl+D to end input, and Tab to trigger completion — all reach the PTY
  4. The terminal input renders as a fixed-height strip (~3–4 lines tall) at the bottom of the session pane
**Plans**: 3 plans

Plans:
- [ ] 15-01-PLAN.md — Wave 0: TerminalInput test scaffold (RED tests for TINPUT-01 through TINPUT-04)
- [ ] 15-02-PLAN.md — Wave 1: TerminalInput.tsx component + Terminal.tsx disableStdin prop
- [ ] 15-03-PLAN.md — Wave 2: Wire TerminalInput into SessionPane + App.css + human checkpoint

### Phase 16: Overlays + Cleanup
**Goal**: Attach, voice, TTS, slash commands, and attachment chips all work on the terminal input surface; old Composer is fully gone
**Depends on**: Phase 15
**Requirements**: ACTION-01, ACTION-02, SLASH-01, SLASH-02, ATTACH-01, ATTACH-02, CLEAN-01
**Success Criteria** (what must be TRUE):
  1. Attach, Voice, and TTS buttons appear as a floating overlay on the terminal input surface and remain accessible while typing
  2. The action bar does not cover the active input line — typing and the cursor remain visible with the bar present
  3. Typing `/` in the terminal input opens the slash command popup overlay above the input; arrow keys navigate and Enter selects
  4. Attached files appear as dismissible chips in a floating strip above the terminal input; clicking X on a chip removes it
  5. No Composer textarea code exists in the codebase — the old component and its wiring are deleted
**Plans**: 5 plans

Plans:
- [ ] 16-01-PLAN.md — Wave 1: ActionBar component + CSS overlay wrapper + SessionPane wiring (ACTION-01, ACTION-02)
- [ ] 16-02-PLAN.md — Wave 1: xterm slash interception in TerminalInput + SlashMenu wiring in SessionPane (SLASH-01, SLASH-02)
- [ ] 16-03-PLAN.md — Wave 2: AttachBar floating chip strip in SessionPane (ATTACH-01, ATTACH-02)
- [ ] 16-04-PLAN.md — Wave 2: Delete Composer.tsx, Composer.test.tsx, and dead CSS (CLEAN-01)
- [ ] 16-05-PLAN.md — Wave 3: Human verify all 5 success criteria in browser

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 15. Terminal Input Core | 3/3 | Complete    | 2026-05-03 |
| 16. Overlays + Cleanup | 2/5 | In Progress|  |

---

## Milestone Progress

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 Foundation | 1–9 | 25/25 | ✅ Complete | 2026-05-02 |
| v1.1 Shell + Canvas | 10–14 | 18/18 | ✅ Complete | 2026-05-03 |
| v1.2 Terminal-Native Composer | 15–16 | 0/? | In progress | — |
