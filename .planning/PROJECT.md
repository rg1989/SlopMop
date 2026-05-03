# SlopMop

## What This Is

A premium local web application that wraps the Claude CLI in a rich, beautifully designed interface. It provides a real pseudo-terminal (PTY) experience inside the browser, a VSCode-style file explorer sidebar, file attachment with previews, voice-to-text input, and a text-to-speech mode that reads agent responses aloud with mid-speech interruption support.

## Current Milestone: v1.2 — Terminal-Native Composer

**Goal:** Replace the Composer textarea with a real xterm.js terminal input so all Claude interactive prompts (permission menus, arrow-key navigation, Ctrl sequences, Tab completion) work natively — then float attach/voice/TTS buttons as overlays.

**Target features:**
- Terminal-native input replaces Composer textarea
- Arrow-key menu navigation for Claude permission prompts
- Floating action bar (attach, voice, TTS) as overlay on terminal input
- Slash-command autocomplete preserved (overlay popup)
- Attachment display/management preserved

---

## Current State — v1.1 Shipped 2026-05-03

**Version:** v1.1 Shell + Canvas ✅
**Status:** Production-ready for single-user local use

Everything in the core loop works: open a project folder → launch Claude CLI in a real PTY terminal → attach files → speak messages → hear responses → manage multiple tab sessions → config persisted to `.slop/` on disk. Sessions survive browser reloads. Canvas panel always visible right column; bottom panel with raw terminal shells. Claude CLI can write to canvas tabs directly via MCP tools.

### What's Live

- **PTY terminal** — xterm.js + node-pty, full ANSI, resize, scrollback
- **PTY session persistence** — sessions survive browser reload; server-side registry with 30-min TTL, scrollback replay
- **File explorer** — collapsible VSCode-style tree, git-changed toggle, @path attachment, preview panel with syntax highlighting and edit mode
- **Voice I/O** — Web Speech API transcription, AudioContext TTS, mid-sentence interruption
- **Multi-session tabs** — up to 8 concurrent sessions, live status, name from first prompt
- **Project onboarding** — first-run modal + health strip (git, CLAUDE.md, CLI, node_modules, .slop)
- **.slop config vault** — per-project + global disk-based config, dotfile backup/restore
- **Shiki rules modal** — CLAUDE.md with fenced code block syntax highlighting
- **AI Guardian** — standing Claude alignment rules, per-project toggle in Settings
- **UI state persistence** — sidebar tab, panel widths, open editor files restored on reload
- **Canvas panel** — persistent right-column panel; polls `.slop/live-canvas.html`; resizable; toolbar toggle
- **Bottom panel** — collapsible panel below main area; raw PTY terminal shells with multi-tab support
- **Telegram bot** — full remote control via Telegram: send messages to active sessions, receive PTY output, voice notes transcribed via Whisper, photo/file delivery to project inbound. Configured via Settings → Telegram tab. (`server/telegram-transport.ts`, 836 lines, 5 modules)
- **Per-project accent color** — project-level theme accent color via Settings UI

### Known Limitations / v1.1 Remaining

- **Canvas is passive**: Canvas panel shows content but Claude CLI has no tool to write to it. Phase 14 adds canvas MCP tools.
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

## v1.1 Goals ✅ ALL SHIPPED 2026-05-03

1. **PTY Session Persistence** (Phase 10) ✅ — live reconnect after browser reload
2. **Canvas Panel Extraction** (Phase 11) ✅ — persistent right-column panel, resizable
3. **Bottom Panel Shell** (Phase 12) ✅ — collapsible bottom zone with horizontal resize
4. **Raw Terminal Sessions** (Phase 13) ✅ — multi-tab PTY shells in bottom panel
5. **Canvas MCP + Multi-Tab + MCP UI** (Phase 14) ✅ — agent-controlled multi-tab canvas via MCP tools; MCP connections management UI

## v1.2 Goals

1. **Terminal-Native Composer** (Phase 15) — Replace textarea Composer with xterm.js terminal input attached to Claude PTY
2. **Floating Action Bar** (Phase 15 or 16) — Attach/Voice/TTS buttons float as overlay on terminal input surface
3. **Slash Command Preservation** (Phase 15 or 16) — Detect /commands typed in terminal, render popup overlay

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

*Last updated: 2026-05-03 — v1.2 milestone started: Terminal-Native Composer*
