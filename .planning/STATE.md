---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: "Completed 03-01: Voice I/O Wave 0 test scaffolds"
last_updated: "2026-04-30T17:38:24.946Z"
last_activity: "2026-04-30 — Plan 01-04 complete: E2E verification, all 5 TERM criteria confirmed"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 12
  completed_plans: 10
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-30)

**Core value:** A single-user power tool that makes working with Claude CLI feel as fluid as a native IDE — voice in, voice out, files at your fingertips, and full terminal fidelity.
**Current focus:** Phase 1 — PTY Core

## Current Position

Phase: 1 of 3 (PTY Core) — COMPLETE
Plan: 4 of 4 in current phase — COMPLETE
Status: Phase 1 complete; ready for Phase 2 planning
Last activity: 2026-04-30 — Plan 01-04 complete: E2E verification, all 5 TERM criteria confirmed

Progress: [██████████] 100% (Phase 1)

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: 3 min
- Total execution time: 0.05 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-pty-core | 1 | 3 min | 3 min |

**Recent Trend:**
- Last 5 plans: 3 min
- Trend: Baseline established

*Updated after each plan completion*
| Phase 01-pty-core P02 | 2 | 2 tasks | 9 files |
| Phase 01-pty-core P03 | 8 | 2 tasks | 4 files |
| Phase 02-file-system P01 | 2 min | 2 tasks | 4 files |
| Phase 02-file-system P02 | 2min | 2 tasks | 4 files |
| Phase 02-file-system P03 | 4min | 2 tasks | 6 files |
| Phase 02-file-system P04 | 3min | 2 tasks | 6 files |
| Phase 02-file-system P04 | 20min | 3 tasks | 7 files |
| Phase 03-voice-io P03 | 2min | 1 tasks | 2 files |
| Phase 03-voice-io P01 | 3min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Init]: Local web app over Electron — faster to ship, design quality independent of packaging
- [Init]: Real PTY over chat-style input — full terminal fidelity (color, interactive prompts, stdin/stdout)
- [Init]: Ghost-pepper pattern for TTS — already solved streaming + interruption
- [01-01]: Use vi.hoisted() for Vitest mock factory — vi.mock is hoisted but factory closures are not; hoisted() ensures mocks are initialized before module imports
- [01-01]: Inject login-shell PATH from /bin/bash -lc rather than relying on process.env.PATH — prevents claude-not-found errors in non-interactive Node.js process
- [01-01]: Kill PTY on WebSocket close in Phase 1 — session persistence deferred to v2 (POW-05)
- [Phase 01-02]: cols/rows excluded from usePty useEffect deps — window resize triggers sendResize separately, preventing WebSocket reconnects
- [Phase 01-02]: useResize hook accepts terminal+fitAddon as nullable — no-op until Terminal fully initialized, safe to call during mount
- [Phase 01-03]: Composer sends value+newline to PTY — trim check guards empty sends but raw value is transmitted to preserve multiline whitespace
- [Phase 01-03]: App dual-gate pattern: Composer disabled until both cwd and terminal are set, preventing PTY race condition
- [Phase 01-04]: node-pty spawn-helper requires chmod +x after npm install — added postinstall script to package.json
- [Phase 01-04]: React StrictMode double-mount guarded with cancelled flag in async Terminal init
- [Phase 01-04]: PTY expects \r (CR) not \n (LF) for submitting input — LF is silently discarded in raw PTY mode
- [Phase 01-04]: Composer is the sole input surface; terminal panel is display-only (clicks redirected to Composer)
- [Phase 01-04]: Native macOS folder picker via osascript invoked from /api/pick-folder backend endpoint
- [Phase 01-04]: Working directory persisted in localStorage + URL ?cwd= query param for session continuity
- [Phase 02-file-system]: Wave 0 tests use @ts-expect-error on non-existent imports so Vitest runs RED without TypeScript blocking compilation
- [Phase 02-file-system]: Composer @path injection: prepend '@absPath1 @absPath2\n' to message before '\r' when attachments is non-empty
- [Phase 02-file-system]: path.sep suffix in traversal check: absPath.startsWith(resolvedCwd + path.sep) blocks root-level attacks while remaining platform-safe
- [Phase 02-file-system]: getGitChangedPaths always returns [] on error — callers never need try/catch for the git-status route
- [Phase 02-file-system]: buildFileTree max depth 8 guard prevents hangs on pathological repos; sort dirs-before-files matches IDE conventions
- [Phase 02-file-system]: FileNode interface defined in FileTree.tsx and imported by useFileTree.ts — avoids shared types coupling between client and server
- [Phase 02-file-system]: Preview panel slot added as empty placeholder in 02-03 so 02-04 can wire FilePreview without further layout changes
- [Phase 02-file-system]: FilePreview returns null for null data; AttachBar filename-only chips; Composer clearAttachments after onSend
- [Phase 02-file-system]: Removed @ts-expect-error from FilePreview.test.tsx after module created — unused suppressions cause TS2578
- [Phase 02-file-system]: Changes mode pruning uses recursive hasChangedDescendant — entire subtrees pruned at directory level
- [Phase 02-file-system]: Dotfiles included in tree with hidden:boolean set server-side; .git excluded via SKIP_DIRS
- [Phase 03-voice-io]: Voice selection skips 'Google ' prefix names to avoid Chrome 15s silent-stop bug (chromium #679437)
- [Phase 03-voice-io]: flushSentences capture-group split keeps terminator attached to sentence text — utterance.text includes period
- [Phase 03-voice-io]: vi.stubGlobal at module level persists speech API globals; beforeEach resets call counts to prevent test bleed
- [Phase 03-voice-io]: Export MockSpeechRecognition and mockSpeechSynthesis from setup.ts so test files can assert on exact calls without re-creating mocks

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-04-30T17:38:24.943Z
Stopped at: Completed 03-01: Voice I/O Wave 0 test scaffolds
Resume file: None
