---
phase: 16
slug: overlays-cleanup
status: complete
verified_by: human + automated
verified_date: 2026-05-03
---

# Phase 16 — Verification Report

## Goal Achievement

**Goal**: Attach, Voice, and TTS buttons appear as a floating overlay; slash command popup intercepts `/` without echoing to PTY; attachment chips render as a floating strip; old Composer is fully deleted.

**Verdict**: COMPLETE — all 7 requirements satisfied.

## Requirement Coverage

| Req | Description | Status |
|-----|-------------|--------|
| ACTION-01 | Action bar (Attach/Voice/TTS) floats over terminal, does not displace terminal content | ✅ |
| ACTION-02 | Cursor row stays visible while typing; action bar does not cover it | ✅ |
| SLASH-01 | `/` opens slash menu popup without echoing to Claude PTY | ✅ |
| SLASH-02 | Arrow keys navigate menu without moving xterm cursor | ✅ |
| ATTACH-01 | Attachment chips appear as an overlay strip, not displacing terminal | ✅ |
| ATTACH-02 | Removing a chip via X button calls `removeAttachment` | ✅ |
| CLEAN-01 | Old Composer component and all its references are fully deleted | ✅ |

## Test Suite

- **211 tests pass** across 35 files — 0 failures
- `useResize.test.ts` updated to cover ref-based API and immediate-fit behavior

## Manual Verification (human)

Verified in live browser session (localhost:5173):
- ActionBar renders as bottom-center overlay on the main terminal surface
- AttachBar renders as bottom-edge overlay when attachments are present
- TerminalInput wrapper is `height: 0; overflow: hidden` — invisible but keyboard events captured
- Slash menu opens on `/`, closes on Escape/Enter, arrow keys navigate the popup

## Post-Verification Fixes

Two terminal rendering bugs were discovered during manual verification and fixed in the same session:

1. **Resize garbling during border drag** — `fitAddon.fit()` was debounced 150 ms along with `sendResize`, causing xterm to render at stale column counts during drag. Fix: `fit()` now fires immediately on every ResizeObserver callback; only the PTY `sendResize` notification is debounced.

2. **Garbled text on page refresh** — `useResize` accepted values instead of refs, so the ResizeObserver was never set up (both values were `null` at render time). Additionally, `sendResize` was never called on initial load when `visibleKey` was already truthy. Fix: hook now accepts refs and reads `.current` lazily; `Terminal.tsx` calls `sendResize` after the initial `requestAnimationFrame` fit.

Both fixes committed: `5d0332b`.

## Files Changed (Phase 16 total)

- `client/components/ActionBar.tsx` — created
- `client/components/AttachBar.tsx` — updated (standalone component)
- `client/components/SessionPane.tsx` — overlays moved into terminal container; TerminalInput wrapper hidden
- `client/components/TerminalInput.tsx` — slash interception via `attachCustomKeyEventHandler`
- `client/hooks/useResize.ts` — rewritten to accept refs; immediate fit + debounced PTY notify
- `client/components/Terminal.tsx` — refs set before `open()`; `sendResize` on initial rAF
- `client/App.css` — overlay positioning, `.terminal-input-wrapper` hidden
- `tests/useResize.test.ts` — updated for new ref-based API
