# Roadmap: ClaudeTalk

## Overview

Three phases that build on each other: first establish a fully-functional PTY terminal session in the browser, then add the file system layer (explorer, attachment, preview), then complete the voice interface (transcription input and streaming TTS output with interruption). Each phase delivers a coherent, verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: PTY Core** - Node.js backend + xterm.js frontend wired end-to-end; user can open Claude CLI in a real terminal session in the browser
- [ ] **Phase 2: File System** - VSCode-style file explorer sidebar, file attachment with previews, file preview panel
- [ ] **Phase 3: Voice I/O** - Voice transcription into the message composer, TTS playback of agent responses, mid-sentence interruption

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
- [ ] 01-01-PLAN.md — Project scaffold + backend (Express, WebSocket, PTY manager)
- [ ] 01-02-PLAN.md — xterm.js Terminal component + usePty + useResize + FolderPicker
- [ ] 01-03-PLAN.md — Composer component + App.tsx layout wiring
- [ ] 01-04-PLAN.md — Full automated suite + end-to-end manual verification checkpoint

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
**Plans**: TBD

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
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. PTY Core | 0/4 | Not started | - |
| 2. File System | 0/TBD | Not started | - |
| 3. Voice I/O | 0/TBD | Not started | - |
