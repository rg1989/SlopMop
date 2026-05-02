# Requirements: SlopMop v1.1

**Defined:** 2026-05-02
**Core Value:** Terminal sessions survive browser reloads — close the tab, reopen it, pick up exactly where you left off.

## v1.1 Requirements

### PTY Session Persistence

- [ ] **PTY-01**: When a user refreshes or closes and reopens the browser, active PTY sessions are still alive on the server and the browser reconnects to them automatically
- [ ] **PTY-02**: On reconnect, the terminal replays the last N lines of scrollback so the user sees output history (no blank screen)
- [ ] **PTY-03**: Sessions that have had no browser connection for more than 30 minutes are automatically cleaned up (PTY killed, memory freed)
- [ ] **PTY-04**: The session tab bar correctly reflects which sessions are "reconnecting" vs "live" vs "expired" after a reload
- [ ] **PTY-05**: A session that has already exited (Claude CLI quit) is shown as "done" on reconnect — not attempted to be relaunched

## Out of Scope for v1.1

| Feature | Reason |
|---------|--------|
| PTY reconnect after server restart | Server restart kills OS processes — not recoverable without a persistent process manager like tmux; deferred |
| Shared sessions / multiplexing | Personal tool only |
| Session output search | v2 feature |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PTY-01 | Phase 10 | Planned |
| PTY-02 | Phase 10 | Planned |
| PTY-03 | Phase 10 | Planned |
| PTY-04 | Phase 10 | Planned |
| PTY-05 | Phase 10 | Planned |

---

*Requirements defined: 2026-05-02*
