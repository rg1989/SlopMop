# SlopMop

## What This Is

A premium local web application that wraps the Claude CLI in a rich, beautifully designed interface. It provides a real pseudo-terminal (PTY) experience inside the browser, a VSCode-style file explorer sidebar, file attachment with previews, voice-to-text input, and a text-to-speech mode that reads agent responses aloud with mid-speech interruption support.

## Current State — v1.0 Shipped

**Version:** v1.0 Foundation (tagged 2026-05-02)
**Status:** Production-ready for single-user local use

Everything in the core loop works: open a project folder → launch Claude CLI in a real PTY terminal → attach files → speak messages → hear responses → manage multiple tab sessions → config persisted to `.slop/` on disk.

### What's Live

- **PTY terminal** — xterm.js + node-pty, full ANSI, resize, scrollback
- **File explorer** — collapsible VSCode-style tree, git-changed toggle, @path attachment, preview panel
- **Voice I/O** — Web Speech API transcription, AudioContext TTS, mid-sentence interruption
- **Multi-session tabs** — up to 8 concurrent sessions, live status, name from first prompt, sessionId arch ready for reconnect
- **Project onboarding** — first-run modal + health strip (git, CLAUDE.md, CLI, node_modules, .slop)
- **.slop config vault** — per-project + global disk-based config, dotfile backup/restore
- **Shiki rules modal** — CLAUDE.md with fenced code block syntax highlighting
- **AI Guardian** — standing Claude alignment rules, per-project toggle in Settings
- **UI state persistence** — sidebar tab, panel widths, open editor files restored on reload

### Known Limitations / v1.1 Targets

- **PTY reconnect**: Terminal output is lost on browser reload — the PTY process dies when WebSocket drops. sessionId architecture is in place (SESS-06), live reconnect is the primary v1.1 target.
- **Whisper transcription**: Voice input uses Web Speech API (online, browser-dependent). Whisper.js local upgrade is a v2 target.

---

## Core Value

A single-user power tool that makes working with Claude CLI feel as fluid as a native IDE — voice in, voice out, files at your fingertips, and full terminal fidelity.

---

## Architecture

- **Stack**: Node/Express backend (`server/`), React 18 + Vite frontend (`client/`)
- **Terminal**: node-pty over WebSocket (`server/index.ts`)
- **Config**: Per-project `.slop/config.json` + global `~/.slop/settings.json`
- **State**: React hooks only — no Redux, no Zustand
- **Styling**: Plain CSS (`client/App.css`, `client/theme.css`) + inline styles

## Constraints

- **Tech**: Node.js backend required (node-pty for PTY, xterm.js for frontend terminal)
- **Platform**: macOS primary (Claude CLI is Mac/Linux)
- **Users**: Personal / single-user, no auth

---

## v1.1 Goals

1. **PTY Session Persistence** (Phase 10) — live reconnect after browser reload via server-side session registry (tmux/screen model)
2. **Polish pass** — any regressions or paper cuts surfaced during v1.0 use

---

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local web app over Electron | Faster to ship; design quality independent of packaging | ✅ Correct — shipped in 3 days |
| Real PTY over chat-style input | Full terminal fidelity — color, interactive prompts, stdin/stdout | ✅ Validated |
| Files via CLI @path syntax | Mirrors how Claude CLI actually works; no reimplementation | ✅ Validated |
| Ghost-pepper AudioContext for TTS | Already solved streaming + interruption | ✅ Validated |
| .slop/ per-project config over localStorage | Survives browser clears, version-controllable | ✅ Validated |
| Propose+confirm for AI write-back | Anything influencing future agent behavior needs explicit approval | ✅ Validated |
| Modal anchor-to-top (flex-start) | Header stays at fixed screen position regardless of content height | ✅ Validated |

---

*Last updated: 2026-05-02 after v1.0 milestone completion*
