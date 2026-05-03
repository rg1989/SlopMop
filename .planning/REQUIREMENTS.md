# Requirements: SlopMop

**Defined:** 2026-05-03
**Milestone:** v1.2 — Terminal-Native Composer
**Core Value:** A single-user power tool that makes working with Claude CLI feel as fluid as a native IDE — voice in, voice out, files at your fingertips, and full terminal fidelity.

---

## v1.2 Requirements

### Terminal Input

- [x] **TINPUT-01**: User can type and send messages via a real xterm.js terminal input (not a textarea)
- [x] **TINPUT-02**: User can navigate Claude's permission menus with arrow keys and press Enter to confirm
- [x] **TINPUT-03**: User can send Ctrl+C, Ctrl+D, Tab and other terminal control sequences directly
- [x] **TINPUT-04**: Terminal input is a fixed small height strip (~3–4 lines) at the bottom of the session pane

### Floating Action Bar

- [ ] **ACTION-01**: Attach, Voice, and TTS buttons float as an overlay on the terminal input surface
- [ ] **ACTION-02**: Action bar is always accessible and does not obscure the terminal input line

### Slash Commands

- [ ] **SLASH-01**: When user types `/` in terminal input, the slash command popup appears as an overlay above the input
- [ ] **SLASH-02**: User can navigate the popup with arrow keys and select a command with Enter

### Attachment Display

- [ ] **ATTACH-01**: Attached files appear as chips in a floating strip above the terminal input
- [ ] **ATTACH-02**: User can dismiss individual attachment chips before sending

### Cleanup

- [x] **CLEAN-01**: Old Composer textarea component and textarea-specific code is fully removed

---

## Future Requirements (v1.3+)

### Input Enhancements

- **TINPUT-FUTURE-01**: Terminal input supports multi-line compose mode (Shift+Enter inserts newline before send)
- **TINPUT-FUTURE-02**: Command history navigation (Up/Down arrows cycle through previously sent messages)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Drag-resize on terminal input | Fixed height is simpler; terminal-native feel doesn't need resize |
| Multi-line compose before send | Terminal-native paradigm — compose inline like a real CLI |
| Send button | Enter sends — button is redundant in terminal-native model |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TINPUT-01 | Phase 15 | Complete |
| TINPUT-02 | Phase 15 | Complete |
| TINPUT-03 | Phase 15 | Complete |
| TINPUT-04 | Phase 15 | Complete |
| ACTION-01 | Phase 16 | Pending |
| ACTION-02 | Phase 16 | Pending |
| SLASH-01 | Phase 16 | Pending |
| SLASH-02 | Phase 16 | Pending |
| ATTACH-01 | Phase 16 | Pending |
| ATTACH-02 | Phase 16 | Pending |
| CLEAN-01 | Phase 16 | Complete |

**Coverage:**
- v1.2 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-03*
*Last updated: 2026-05-03 — initial definition*
