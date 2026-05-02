# Changelog

All notable changes are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.0.0] — 2026-05-01

First complete milestone. Six phases shipped.

### Added

**PTY Core (Phase 1)**
- Full pseudo-terminal in the browser via node-pty + xterm.js
- WebSocket-backed PTY with stable session UUIDs
- Multiline Composer with `Enter` to send, `Shift+Enter` for newline
- Folder picker with native macOS dialog (`osascript`)
- Terminal resize and reflow on window/sidebar resize

**File System (Phase 2)**
- VSCode-style collapsible file tree with file-type icons
- Toggle between All Files and Changes Only (git-modified) views
- File attachment — staged files prepended as `@path` syntax in Composer
- File preview panel with Shiki syntax highlighting (`one-dark-pro`)
- Preview tabs promote to permanent editor tabs on first edit
- File search, collapse-all, hidden-file toggle

**Voice I/O (Phase 3)**
- Push-to-talk and toggle recording modes with configurable hotkey
- Voice input transcribed locally via Whisper STT
- TTS output via local Piper — reads agent responses sentence-by-sentence
- AudioCoordinator enforces STT/TTS mutual exclusion
- Manual TTS stop button; recording automatically pauses TTS

**Multi-Session Tabs (Phase 4)**
- Multiple terminal sessions per workspace
- Session tab bar with live status indicators (working / waiting / done / error)
- Session names derived from first Composer message
- Session history modal with timestamps
- Session state (editor tabs, attachments) persists across tab switches
- Session UUID assigned at spawn; stable across reconnects

**Onboarding & Health Check (Phase 5)**
- First-run onboarding modal for workspace selection and agent configuration
- Health check status bar: git repo, CLAUDE.md, agent CLI in PATH, node_modules
- `npm run setup` script — idempotent dependency check and install
- `GET /api/project-health` endpoint for health status polling

**Config Vault (Phase 6)**
- Global settings persisted in `~/.slop/settings.json` (not localStorage)
- Per-project `.slop/config.json` for agent overrides and AI Guardian toggle
- Recent workspace paths persisted server-side in `~/.slop/recents.json`
- Vault UI: backup and restore dotfiles (Claude, GSD, git, SSH configs)
- Atomic file writes throughout (write `.tmp`, then rename)
- Auto-backup schedule: Never / On launch / Hourly / Daily
- Vault git init and remote pull (`POST /api/vault-git`)

### Also added across all phases
- Drag-resizable sidebar and preview panel widths, persisted per workspace
- Source control panel: staged/unstaged diffs, stage/unstage/discard, commit
- Branch switcher and push support in source control
- Second Brain panel: per-workspace Markdown knowledge base in `.brain/`
- GSD Roadmap panel: phases, plans, quick tasks, progress bar, planning doc links
- Inline phase and plan deletion from the roadmap panel
- Rules modal: renders all active CLAUDE.md files with Shiki highlighting
- AI Guardian: per-project roadmap alignment rules with per-project toggle
- Settings modal: Display / Audio / Agent & Tools / Vault / AI Guardian tabs
- Super Tools modal: GSD phase tracking and agent tool configuration
- `GET /api/known-agents` — auto-detects installed agent CLIs
- `GET /api/which` — arbitrary PATH command existence check
- `GET /api/rules` — loads CLAUDE.md hierarchy with `@`-import resolution
- Full Vitest unit test suite covering all hooks and key server utilities

---

## [Unreleased]

### Planned
- UI polish and state persistence improvements (Phase 7 candidate)
- Rules modal edit mode — inline CLAUDE.md editing from the UI
- Agent-agnostic slash command palette
- Terminal session reconnect on server restart

[1.0.0]: https://github.com/rg1989/SlopMop/releases/tag/v1.0.0
