# Requirements: ClaudeTalk

**Defined:** 2026-04-30
**Core Value:** A single-user power tool that makes working with Claude CLI feel as fluid as a native IDE — voice in, voice out, files at your fingertips, and full terminal fidelity.

## v1 Requirements

### Terminal

- [x] **TERM-01**: User can select a folder from the UI which opens a real PTY Claude CLI session in that directory
- [x] **TERM-02**: Terminal renders full ANSI/color output with correct Claude CLI interactive behavior
- [x] **TERM-03**: User can compose multiline messages in an input area before sending to the terminal
- [x] **TERM-04**: Terminal supports scrollback buffer and keyboard copy/paste shortcuts
- [x] **TERM-05**: Terminal resizes correctly when browser window or sidebar width changes

### Files

- [x] **FILE-01**: User sees a VSCode-style collapsible file tree sidebar for the selected folder
- [x] **FILE-02**: User can toggle the file tree between "All Files" and "Changes Only" (git-changed files, like VSCode Source Control)
- [x] **FILE-03**: User can select files to attach to a message, with image/text previews shown before sending
- [x] **FILE-04**: Attached files are passed to Claude CLI using @path syntax when the message is sent
- [x] **FILE-05**: User can click a file in the explorer to preview its contents in a side panel

### Voice Input

- [ ] **VOICE-01**: User can record a voice message that is transcribed and dropped into the message input composer
- [ ] **VOICE-02**: Transcription is triggered by a button press (push-to-talk or start/stop toggle)

### TTS Output

- [ ] **TTS-01**: User can toggle a TTS mode where agent responses are streamed and read aloud using the AudioContext pattern (ghost-pepper approach)
- [ ] **TTS-02**: TTS playback can be stopped at any point via a manual stop button
- [ ] **TTS-03**: User can interrupt TTS mid-sentence by speaking — playback stops and the transcribed speech is sent as a new message
- [ ] **TTS-04**: TTS and voice input are mutually exclusive — TTS pauses/stops when voice recording starts

## v2 Requirements

### Power Features

- **POW-01**: Command palette (⌘K) for quick actions
- **POW-02**: Syntax highlighting in file preview panel
- **POW-03**: Git diff inline view in file preview (show changes like VSCode diff editor)
- **POW-04**: Whisper.js local transcription upgrade (replaces Web Speech API for offline/private use)
- **POW-05**: Session history — browse and restore previous Claude CLI sessions
- **POW-06**: Token/cost display in status bar (if Claude CLI exposes this)

### Customization

- **CUST-01**: Theme switcher (dark/light)
- **CUST-02**: Font size controls for terminal
- **CUST-03**: TTS voice selection

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full code editor (Monaco/CodeMirror) | Duplicates VSCode; conflicts with Claude's role as editor; massive scope |
| Multi-user / auth | Personal tool only — no server-side user management |
| Electron packaging | Web app is sufficient for v1; can be added later as a 1-day wrapper |
| Cloud hosting | Local-only by design |
| Multiple concurrent sessions | Single active Claude CLI session per window for v1 |
| Real-time collaboration | Out of personal tool scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TERM-01 | Phase 1 | Complete |
| TERM-02 | Phase 1 | Complete |
| TERM-03 | Phase 1 | Complete |
| TERM-04 | Phase 1 | Complete |
| TERM-05 | Phase 1 | Complete |
| FILE-01 | Phase 2 | Complete |
| FILE-02 | Phase 2 | Complete |
| FILE-03 | Phase 2 | Complete |
| FILE-04 | Phase 2 | Complete |
| FILE-05 | Phase 2 | Complete |
| VOICE-01 | Phase 3 | Pending |
| VOICE-02 | Phase 3 | Pending |
| TTS-01 | Phase 3 | Pending |
| TTS-02 | Phase 3 | Pending |
| TTS-03 | Phase 3 | Pending |
| TTS-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-30*
*Last updated: 2026-04-30 after roadmap creation*
