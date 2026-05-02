---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Foundation ✅ SHIPPED 2026-05-02
status: completed
stopped_at: Completed 13-03-PLAN.md
last_updated: "2026-05-02T23:03:27.063Z"
last_activity: "2026-04-30 - Completed quick task 1: add syntax colors and edit mode to file preview panel"
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 12
  completed_plans: 12
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-30)

**Core value:** A single-user power tool that makes working with Claude CLI feel as fluid as a native IDE — voice in, voice out, files at your fingertips, and full terminal fidelity.
**Current focus:** Phase 1 — PTY Core

## Current Position

Phase: 3 of 3 (Voice I/O) — COMPLETE
Plan: 4 of 4 in current phase — COMPLETE
Status: All 3 phases complete — v1.0 milestone delivered
Last activity: 2026-04-30 - Completed quick task 1: add syntax colors and edit mode to file preview panel

Progress: [██████████] 100% (All Phases)

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
| Phase 03-voice-io P02 | 8min | 2 tasks | 2 files |
| Phase 04-multi-session-tabs P01 | 6min | 2 tasks | 3 files |
| Phase 04-multi-session-tabs P02 | 12min | 2 tasks | 6 files |
| Phase 04-multi-session-tabs P03 | 8min | 2 tasks | 6 files |
| Phase 04-multi-session-tabs P04 | 8min | 1 tasks | 4 files |
| Phase 05-project-onboarding-wizard-and-setup-health-check P01 | 2 | 2 tasks | 3 files |
| Phase 05-project-onboarding-wizard-and-setup-health-check P02 | 1min | 2 tasks | 4 files |
| Phase 05-project-onboarding-wizard-and-setup-health-check P03 | 525402min | 2 tasks | 2 files |
| Phase 05-project-onboarding-wizard-and-setup-health-check P04 | 2 | 2 tasks | 4 files |
| Phase 05-project-onboarding-wizard-and-setup-health-check P04 | 10 | 3 tasks | 4 files |
| Phase 06-slop-config-vault P01 | 4min | 2 tasks | 9 files |
| Phase 06-slop-config-vault P02 | 3min | 2 tasks | 1 files |
| Phase 06-slop-config-vault P03 | 5min | 2 tasks | 5 files |
| Phase 06-slop-config-vault P04 | 6min | 2 tasks | 4 files |
| Phase 06-slop-config-vault P05 | 4min | 2 tasks | 5 files |
| Phase 10-pty-session-persistence P01 | 2min | 4 tasks | 5 files |
| Phase 10-pty-session-persistence P02 | 5min | 2 tasks | 3 files |
| Phase 10-pty-session-persistence P03 | 2min | 1 tasks | 1 files |
| Phase 10-pty-session-persistence P03 | 2min | 2 tasks | 1 files |
| Phase 11-canvas-panel-extraction P03 | 2min | 1 tasks | 1 files |
| Phase 11-canvas-panel-extraction P01 | 2min | 2 tasks | 2 files |
| Phase 11-canvas-panel-extraction P02 | 4min | 2 tasks | 1 files |
| Phase 12-bottom-panel-shell P01 | 4min | 2 tasks | 3 files |
| Phase 12-bottom-panel-shell P02 | 5min | 1 tasks | 1 files |
| Phase 13-raw-terminal-sessions P01 | 2min | 2 tasks | 2 files |
| Phase 13-raw-terminal-sessions P02 | 8min | 2 tasks | 3 files |
| Phase 13-raw-terminal-sessions P03 | 525543min | 6 tasks | 7 files |

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
- [Phase 03-voice-io]: Create fresh SpeechRecognition instance on each start() call — avoids browser DOMException on re-start
- [Phase 03-voice-io]: onData added to UsePtyOptions as optional callback — zero-cost when absent, enables useTts PTY interception
- [Phase 03-voice-io]: Mutual exclusion (TTS-04) enforced in App.tsx wiring via onStart callback, not inside hooks — keeps hooks independently testable
- [Phase 03-voice-io]: onData gated by ttsEnabled flag (ttsEnabled ? tts.handleData : undefined) — zero processing overhead when TTS is off
- [Phase 03-voice-io]: VoiceBar as pure presentational component receiving all callbacks as props — no direct hook calls inside component
- [Phase 04-multi-session-tabs]: Wave 0 RED tests import non-existent modules via @ts-expect-error so Vitest runs RED without TypeScript blocking compilation
- [Phase 04-multi-session-tabs]: sessionsRef+activeIdRef mirrors state in refs so spawn/close callbacks read current values synchronously without stale closures
- [Phase 04-multi-session-tabs]: SessionStatus exported from both usePty.ts and useSessionManager.ts to avoid circular imports between the two hooks
- [Phase 04-multi-session-tabs]: SessionPane owns terminal+composer+preview column; display:none isolates inactive panes without destroying xterm.js state
- [Phase 04-multi-session-tabs]: onRegisterActions runs without deps on every render to keep App activeActionsRef current — avoids stale closure bugs on session callbacks
- [Phase 04-multi-session-tabs]: VoiceBar stays app-level; routes to active session via activeSendInputRef mutable ref — avoids threading audio props through SessionPane
- [Phase 04-multi-session-tabs]: Pre-existing test/implementation drift in FileTree, FilePreview, usePty, useSessionManager tests fixed inline to unblock checkpoint gate
- [Phase 05-project-onboarding-wizard-and-setup-health-check]: Wave 0 RED pattern extended to Phase 5 — same @ts-expect-error technique from Phase 02 and 04, import errors confirm modules don't exist yet
- [Phase 05-02]: Gate OnboardingModal visibility on stable initialPath (useState initial value), not cwd — cwd may be null momentarily even for returning users
- [Phase 05-02]: onboardingDone state tracked in App instead of re-reading localStorage on every render — cleaner and idiomatic React
- [Phase 05-03]: hasNodeModules returns null (not false) when package.json absent — avoids false alarm for non-JS projects
- [Phase 05-03]: 100ms debounce in useProjectHealth guards against osascript path delivery timing race condition
- [Phase 05-04]: Show all dots (ok+warn+error) in HealthStatusBar when bar is visible — HEALTH-03 test asserts health-dot--ok must appear alongside warn dots; tests override plan action text in TDD
- [Phase 05-04]: Show all dots (ok+warn+error) in HealthStatusBar when bar is visible — HEALTH-03 test asserts health-dot--ok must appear alongside warn dots; tests are source of truth in TDD
- [Phase 06-slop-config-vault]: initialSessionIdRef tracks initial session id synchronously so dedup works within a single act() batch without stale sessionsRef
- [Phase 06-slop-config-vault]: parseRoadmapMd rewritten with two-pass algorithm: Pass 1 builds completedMap from overview, Pass 2 builds phases from detail sections
- [Phase 06-slop-config-vault]: atomicWrite uses .tmp + rename pattern for safe filesystem writes
- [Phase 06-slop-config-vault]: Discriminated union props on OnboardingModal preserves legacy tests while adding prop-driven mode
- [Phase 06-slop-config-vault]: Strict slopExists === false in JSX prevents flash of OnboardingModal during null loading state
- [Phase 06-slop-config-vault]: useSettings mount effect uses active flag for cleanup — prevents stale setSettings on unmounted component
- [Phase 06-slop-config-vault]: TS type narrowing via cast-after-find pattern (putCall as [string, RequestInit]) — avoids broken overload on find() callback with destructured args
- [Phase 06-slop-config-vault]: VaultTab is self-contained fetching /api/vault-status on mount — no props from SettingsModal
- [Phase 06-slop-config-vault]: Sync dot: inSync=true→ok, !backupExists||!inSync→warn, !sourceExists→grey
- [Phase 10-01]: Export SessionRegistry class (not just singleton) to allow isolated instances in tests — non-architectural auto-fix
- [Phase 10-02]: SessionStatus 'reconnecting' exported from both useSessionManager.ts and usePty.ts independently — avoids circular imports, both copies kept in sync
- [Phase 10-02]: session-ready handler in usePty sets 'waiting' unconditionally — works for fresh connections and reconnects without special-casing
- [Phase 10-02]: sessionId in usePty effect deps is the minimal change for re-running effect on restore; overrideSessionIdRef logic for exit/fresh-spawn path untouched
- [Phase 10-03]: Defined @keyframes pulse inline since no generic pulse keyframe existed in App.css
- [Phase 11-03]: No font-family declarations in canvas CSS — global * rule in App.css handles inheritance per CLAUDE.md
- [Phase 11-03]: canvas-column .live-canvas-panel override not needed — .live-canvas-panel already has flex:1 and overflow:hidden
- [Phase 11-canvas-panel-extraction]: Mock all child components in App tests so App renders without xterm/PTY/WebSocket dependencies in jsdom
- [Phase 11-canvas-panel-extraction]: CANVAS-02 passes at Wave 0 (canvas-column not yet implemented); RED requirement applies to overall test set
- [Phase 11-02]: Canvas column state initialized from localStorage before render — no flash of wrong state on mount
- [Phase 11-02]: toggleCanvas uses functional setIsCanvasVisible updater to write localStorage — avoids stale closure
- [Phase 11-canvas-panel-extraction]: Canvas toggle button always rendered when prop is provided (not gated on visibility) so user can always re-open canvas panel
- [Phase 11-canvas-panel-extraction]: CANVAS-05 test fixed: waitFor updated to wait for canvas-column element directly, not app-body which resolves before cwd is set
- [Phase 11-canvas-panel-extraction]: Canvas max-width formula set to 70% of viewport width, independent of sidebar; canvas init width clamped to max on startup; fp-canvas-btn given border + white default + orange hover
- [Phase 11-04-fix]: canvasMaxRef updated to innerWidth - sidebarWidth - CANVAS_MIN_CENTER(280) - handle; .main-area gets min-width: 280px as CSS hard floor — prevents center panel from shrinking to zero
- [Phase 12-01]: useDragResize mock passes through initialWidth so BPANEL-05 height restoration test reflects localStorage value
- [Phase 12-01]: bottom-panel-tab-bar rendered unconditionally inside .main-area using existing flex-direction:column layout
- [Phase 12-02]: Chevron direction was inverted at checkpoint — up when closed, down when open; fixed in d124851 before human approval
- [Phase 13-01]: useRawSessionManager accepts cwd: string | null — add() is a no-op when null, keeping hook safe before project connection
- [Phase 13-01]: No localStorage persistence for raw sessions — ephemeral by design, simpler than useSessionManager
- [Phase 13-02]: Test mock refactored to vi.hoisted() mockRawState — inner vi.mock() inside test bodies is unreliable for already-resolved modules in Vitest
- [Phase 13-02]: Auto-seed useEffect excludes rawAdd from deps — changes every render and would cause infinite seed loop
- [Phase 13-raw-terminal-sessions]: display:none for bottom panel keeps RawTerminalPane mounted — PTY WebSocket and xterm state survive panel hide/show without reconnect
- [Phase 13-raw-terminal-sessions]: usePty killOnUnmount splits ephemeral raw terminals (kill) from persistent agent sessions (detach) via single boolean option

### Roadmap Evolution

- Phase 4 added: Multi-Session Tabs — terminal session tabs with stable UUIDs, live state indicators (working/waiting/error/done), session name from first prompt, session history persisted on close, structured for future full PTY reconnect without client-side changes
- Phase 5 added: Project Onboarding Wizard and Setup Health Check
- Phase 6 added: .slop Config Vault — project-local + global config on disk replacing localStorage; dotfile backup/restore system for Claude, GSD, and second-brain configs

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | add syntax colors and edit mode to file preview panel | 2026-04-30 | a5c4deb | [1-add-syntax-colors-and-edit-mode-to-file-](.planning/quick/1-add-syntax-colors-and-edit-mode-to-file-/) |
| 2 | add slash-command autocomplete dropdown to Composer | 2026-05-01 | 58f5c3e | [2-add-slash-command-autocomplete-dropdown-](.planning/quick/2-add-slash-command-autocomplete-dropdown-/) |

## Session Continuity

Last session: 2026-05-02T23:03:20.029Z
Stopped at: Completed 13-03-PLAN.md
Resume file: None
