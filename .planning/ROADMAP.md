# Roadmap: SlopDock

## Overview

Three phases that build on each other: first establish a fully-functional PTY terminal session in the browser, then add the file system layer (explorer, attachment, preview), then complete the voice interface (transcription input and streaming TTS output with interruption). Each phase delivers a coherent, verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: PTY Core** - Node.js backend + xterm.js frontend wired end-to-end; user can open Claude CLI in a real terminal session in the browser
- [x] **Phase 2: File System** - VSCode-style file explorer sidebar, file attachment with previews, file preview panel (completed 2026-04-30)
- [x] **Phase 3: Voice I/O** - Voice transcription into the message composer, TTS playback of agent responses, mid-sentence interruption (completed 2026-04-30)
- [x] **Phase 4: Multi-Session Tabs** - Terminal session tabs with stable UUIDs, live state indicators, name from first prompt, session history, persistence across reload (completed 2026-05-01)
- [x] **Phase 5: Project Onboarding Wizard and Setup Health Check** - First-time onboarding modal + health check strip for git, CLAUDE.md, agent CLI, node_modules (completed 2026-05-01)
- [ ] **Phase 6: .slop Config Vault** - Project-local and global config on disk, dotfile backup/restore for Claude, GSD, and second-brain configs

## Phase Details

### Phase 1: PTY Core
**Goal**: User can open Claude CLI in a real PTY terminal session inside the browser and interact with it fully
**Depends on**: Nothing (first phase)
**Requirements**: TERM-01, TERM-02, TERM-03, TERM-04, TERM-05
**Success Criteria** (what must be TRUE):
  1. User can select a folder from the UI and Claude CLI opens in that directory inside the browser terminal
  2. Terminal renders full ANSI colors and Claude CLI's interactive prompts behave correctly
  3. User can compose a multiline message in the input area and send it to the running session
  4. User can scroll back through terminal history and use keyboard copy/paste shortcuts
  5. Terminal reflows and resizes correctly when the browser window or sidebar width changes
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Project scaffold + backend (Express, WebSocket, PTY manager)
- [x] 01-02-PLAN.md — xterm.js Terminal component + usePty + useResize + FolderPicker
- [x] 01-03-PLAN.md — Composer component + App.tsx layout wiring
- [x] 01-04-PLAN.md — Full automated suite + end-to-end manual verification checkpoint

### Phase 2: File System
**Goal**: User has a VSCode-style file explorer at their fingertips and can attach files to messages with previews
**Depends on**: Phase 1
**Requirements**: FILE-01, FILE-02, FILE-03, FILE-04, FILE-05
**Success Criteria** (what must be TRUE):
  1. File tree sidebar shows all files in the selected folder in a collapsible tree
  2. User can toggle the tree between "All Files" and "Changes Only" showing only git-modified files
  3. User can select one or more files to attach; image and text previews appear before sending
  4. Attached files are automatically included via @path syntax when the message is sent to Claude CLI
  5. Clicking any file in the explorer opens its contents in a preview panel
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — Wave 0 test scaffolds (FileTree, useFileTree, FilePreview, Composer @path tests)
- [x] 02-02-PLAN.md — Server file APIs (file tree, git status, file read endpoints + isbinaryfile)
- [x] 02-03-PLAN.md — FileTree component + useFileTree hook + App sidebar layout (FILE-01, FILE-02)
- [x] 02-04-PLAN.md — File attachment, preview panel, Composer @path injection (FILE-03, FILE-04, FILE-05)

### Phase 3: Voice I/O
**Goal**: User can speak to Claude and hear responses read aloud, with full interruption control
**Depends on**: Phase 2
**Requirements**: VOICE-01, VOICE-02, TTS-01, TTS-02, TTS-03, TTS-04
**Success Criteria** (what must be TRUE):
  1. User can press a button to record voice; speech is transcribed and appears in the message composer
  2. User can toggle TTS mode; agent responses are streamed and read aloud using the AudioContext pattern
  3. User can stop TTS at any point with a manual stop button
  4. User can interrupt TTS mid-sentence by speaking; playback stops and the transcribed speech is sent as a new message
  5. TTS pauses automatically when voice recording starts — the two modes never overlap
**Plans**: 4 plans

Plans:
- [ ] 03-01-PLAN.md — Wave 0 test scaffolds (Web Speech API mocks, useVoiceInput/useTts/VoiceBar stubs)
- [ ] 03-02-PLAN.md — usePty onData extension + useVoiceInput hook (VOICE-01, VOICE-02, TTS-03)
- [ ] 03-03-PLAN.md — useTts hook with ANSI stripping + sentence buffering (TTS-01, TTS-02)
- [ ] 03-04-PLAN.md — VoiceBar component + App.tsx wiring + human verification checkpoint

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. PTY Core | 4/4 | Complete    | 2026-04-30 |
| 2. File System | 4/4 | Complete    | 2026-04-30 |
| 3. Voice I/O | 4/4 | Complete    | 2026-04-30 |
| 4. Multi-Session Tabs | 4/4 | Complete   | 2026-05-01 |


### Phase 4: Multi-Session Tabs

**Goal:** User can spawn multiple terminal sessions within the same workspace, navigate between them via a tab bar, see live status indicators (working/waiting/error/done), and have session names and history persist across reloads — structured for future full PTY reconnect.
**Depends on:** Phase 3
**Requirements**: SESS-01, SESS-02, SESS-03, SESS-04, SESS-05, SESS-06
**Plans:** 4/4 plans complete

Plans:
- [ ] 04-01-PLAN.md — Wave 0 TDD scaffolds (useSessionManager tests, SessionTabBar tests, usePty sessionId extension)
- [ ] 04-02-PLAN.md — Protocol extension + useSessionManager hook (SESS-01, SESS-03, SESS-04, SESS-05, SESS-06)
- [ ] 04-03-PLAN.md — SessionTabBar component + App.tsx multi-terminal wiring (SESS-02)
- [ ] 04-04-PLAN.md — Full automated suite gate + human end-to-end verification checkpoint

### Phase 5: Project Onboarding Wizard and Setup Health Check

**Goal:** First-time onboarding modal guides new users to connect a project folder; ongoing health check strip surfaces whether the active project has the prerequisites Claude Code needs (git, CLAUDE.md, agent CLI in PATH, node_modules).
**Requirements**: ONBOARD-01, ONBOARD-02, ONBOARD-03, HEALTH-01, HEALTH-02, HEALTH-03
**Depends on:** Phase 4
**Plans:** 4/4 plans complete

Plans:
- [ ] 05-01-PLAN.md — Wave 0 test scaffolds (OnboardingModal, useProjectHealth, HealthStatusBar RED stubs)
- [ ] 05-02-PLAN.md — OnboardingModal component + App.tsx wiring + health CSS classes
- [ ] 05-03-PLAN.md — GET /api/project-health endpoint + useProjectHealth hook
- [ ] 05-04-PLAN.md — HealthStatusBar component + App.tsx health wiring + human verification checkpoint

### Phase 6: .slop Config Vault

**Goal:** Settings and onboarding state move from localStorage to per-project .slop/ and global ~/.slop/ on disk; dotfile vault backs up and restores Claude, GSD, git, and SSH configs; two pre-existing bugs (double-spawn, roadmap parser) are fixed.
**Requirements**: SLOP-01, SLOP-02, SETTINGS-01, RECENT-01, VAULT-01, VAULT-02, VAULT-03, ONBOARD-01, ONBOARD-02, BUG-01, BUG-02
**Depends on:** Phase 5
**Plans:** 5 plans

Plans:
- [ ] 06-01-PLAN.md — Wave 0 test stubs + bug fixes (double-spawn dedup, parseRoadmapMd rewrite)
- [ ] 06-02-PLAN.md — Server config endpoints (slop-status, slop-init, global-settings, recent-paths, vault auto-backup)
- [ ] 06-03-PLAN.md — HealthStatusBar 6th dot + OnboardingModal rewire to per-project server-driven
- [ ] 06-04-PLAN.md — Client migration (useSettings server-backed, FolderPicker recents server-backed)
- [ ] 06-05-PLAN.md — Vault endpoints (status/backup/restore) + VaultTab UI + human checkpoint
