# SlopMop Architecture

This document describes the runtime architecture, key data flows, state model, and design decisions. Read this before making structural changes.

**See also:** [CONTEXT.md](../CONTEXT.md) for domain vocabulary; [extensibility/README.md](extensibility/README.md) for optional Telegram and Live Canvas behavior; [FEATURE_ADDITIONS_OVERVIEW.md](FEATURE_ADDITIONS_OVERVIEW.md) for a concise feature-oriented map of those additions.

---

## Overview

SlopMop is a local web app with two Node.js processes connected through a WebSocket:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (React 19 + xterm.js)                                      │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ Sidebar  │  │ Terminal │  │ Preview   │  │ Composer +       │  │
│  │ Panels   │  │ (xterm)  │  │ Panel     │  │ VoiceBar         │  │
│  └──────────┘  └──────────┘  └───────────┘  └──────────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │ WebSocket (/ws)    HTTP (/api/*)
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│  Express server (server/index.ts)                                   │
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────────────────┐   │
│  │ ws-handler.ts │  │  file-api.ts  │  │ gsd.ts               │   │
│  │  WebSocket +  │  │ File tree,    │  │ ROADMAP.md parser    │   │
│  │  PTY bridge   │  │ git helpers   │  │ (pure functions)     │   │
│  └───────┬───────┘  └───────────────┘  └──────────────────────┘   │
│          │                                                          │
│  ┌───────▼───────┐  ┌───────────────┐  ┌──────────────────────┐   │
│  │  node-pty     │  │ piper-tts.ts  │  │ whisper-stt.ts       │   │
│  │  PTY process  │  │ Piper TTS     │  │ Whisper STT          │   │
│  └───────┬───────┘  └───────────────┘  └──────────────────────┘   │
└──────────┼──────────────────────────────────────────────────────────┘
           │ stdin / stdout
           ▼
    Agent CLI (claude / aider / opencode / …)
```

---

## Process boundary

The frontend and backend are separate processes:

| Process | Entry point | Port | Starts via |
|---|---|---|---|
| Express API + WS | `server/index.ts` | 3000 | `npm run server` |
| Vite dev server | `client/index.html` | 5173 | `npm run client` |

In development, Vite proxies `/api/*` and `/ws` to `localhost:3000`. In production, Express serves the built `client/dist/` directly and there is no Vite process.

Optional **Telegram** inbound chat is handled by `telegram-transport.ts` (long polling) when `TELEGRAM_BOT_TOKEN` is set; it shares `session-registry.ts` and `pty-manager.ts` with the WebSocket path.

---

## WebSocket protocol

The PTY connection uses a single WebSocket at `/ws`. Each frame is one JSON object (`shared/protocol.ts`). After `start`, the server remembers **`sessionId` for this socket** — `input`, `resize`, and `kill` apply to that session only (payload does not repeat `sessionId`).

**Client → Server:**

| Message | Payload | Description |
|---|---|---|
| `start` | `{ sessionId, cwd, cols, rows, agentCommand, agentArgs }` | Spawn PTY or reconnect and replay buffer |
| `input` | `{ data }` | Raw bytes to PTY stdin |
| `resize` | `{ cols, rows }` | Terminal geometry |
| `kill` | _(none)_ | Kill the current session’s PTY |

**Server → Client:**

| Message | Payload | Description |
|---|---|---|
| `session-ready` | `{ sessionId }` | Session attached |
| `data` | `{ data }` | PTY stdout/stderr chunk |
| `exit` | `{ code }` | PTY exited |
| `error` | `{ message }` | Setup or runtime error |

Each browser session uses a stable UUID for `sessionId`. The server maps session IDs to PTY processes.

---

## Telegram transport (optional)

When enabled, **private chats only**: Telegram user messages are serialized per chat, resolved to a **project directory** by folder name under configured roots (`~/.slop/telegram.json`), then written to a **persistent** PTY (`sessionId` prefix `tg:<chatId>`). Registry entries use `persistent: true` so WebSocket-style detach/TTL does not tear down the PTY when no browser is involved.

Outbound PTY data is ANSI-stripped, debounced, and split under Telegram’s message size limit. This path does **not** embed a separate LLM — it uses the same **`agent.command` / `agent.args`** read from `~/.slop/settings.json`. Bot token and roots are editable in **Settings → Telegram** (`GET`/`PUT /api/telegram-settings`, `PUT /api/telegram-token`). See [README § Telegram transport](../README.md#telegram-transport-optional) and the detailed guide [extensibility/telegram-bridge.md](extensibility/telegram-bridge.md).

---

## Live Canvas (optional UI)

Per workspace folder, the sidebar can render **`.slop/live-canvas.html`** (full HTML document) in a sandboxed iframe (`GET`/`PUT /api/live-canvas`). The panel polls for changes so agent-written dashboards refresh without reloading the app. See [extensibility/live-canvas.md](extensibility/live-canvas.md).

---

## State model

### Session vs. workspace state

The most important architectural boundary in the codebase:

| State | Owner | Lifetime | Examples |
|---|---|---|---|
| Session state | `useSession` hook | Per PTY session | PTY ref, editor tabs, attachments, session name |
| Workspace state | `App.tsx` | Per workspace folder | File tree, roadmap, git status, source control |
| App-global state | `App.tsx` | Whole app | Audio coordinator, settings, active workspace |

**Rule:** If state is meaningless after the agent session ends or the workspace changes, it is session state. If it should survive a session restart, it is workspace state.

### Settings storage

Global settings (agent config, voice hotkey, display preferences) are stored in `~/.slop/settings.json` via the `/api/global-settings` endpoint. They are loaded once at startup and flushed on every settings modal close.

Per-workspace UI state (open editor tabs, active sidebar panel) is stored in `localStorage` keyed by workspace path.

---

## File API

All file system operations go through the Express server. The client never reads files directly; it makes HTTP requests to `/api/file`, `/api/files`, `/api/git-*`, etc.

**Path traversal protection:** Every endpoint that takes a file path resolves it against the `cwd` parameter and rejects requests that escape the workspace root:

```typescript
const absPath = path.resolve(resolvedCwd, relPath);
if (!absPath.startsWith(resolvedCwd + path.sep) && absPath !== resolvedCwd) {
  res.status(403).json({ error: 'Path outside cwd' });
  return;
}
```

---

## Audio pipeline

Voice input and voice output are mutually exclusive. The `useAudioCoordinator` hook enforces this:

```
Microphone
    │
    ▼ (MediaRecorder)
useVoiceInput ──► POST /api/stt ──► Whisper ──► text ──► Composer
    │                                                        │
    │ locks audio while recording                            │
    │                                                        │
useTts ◄──── sentence buffer ◄──── PTY output stream ◄──────┘
    │
    ▼ (AudioContext + AudioBuffer)
GET /api/tts ──► Piper ──► WAV audio ──► speaker
```

- When recording starts, TTS playback is paused.
- When TTS is speaking, a new recording request cancels the current TTS chunk.
- The sentence buffer accumulates PTY output, splits on sentence boundaries (`.!?`), and dispatches one TTS request per sentence.

See [ADR-0003](adr/0003-audio-coordinator-pattern.md) for the full rationale.

---

## GSD roadmap integration

The GSD panel is a read-only view of the workspace's `.planning/` directory. The server parses `ROADMAP.md` and `STATE.md` on every panel load (no caching) and returns structured JSON.

The parsing pipeline in `server/gsd.ts`:

```
ROADMAP.md  ──► parseRoadmapMd()  ──► phases[]
STATE.md    ──► parseStateMd()    ──► quickTasks[]
.planning/phases/  ──► readdir()  ──► plan file presence checks
```

Phase and plan completion is determined by the presence of `-SUMMARY.md` files, not by checkbox state in `ROADMAP.md`. This makes completion authoritative and unambiguous.

Deletion operations (`DELETE /api/gsd/phase`, `DELETE /api/gsd/plan`) patch `ROADMAP.md` and remove files directly. They delegate to the `gsd-tools.cjs` binary for phase removal to stay compatible with GSD's internal data model.

---

## Config vault

The vault system backs up dotfiles from their canonical locations to `~/.slop/backups/`. Writes are atomic (write to `.tmp`, then rename) to prevent partial writes from corrupting backups.

**Backup targets:**

| ID | Source | Backup |
|---|---|---|
| `claude-settings` | `~/.claude/settings.json` | `~/.slop/backups/claude/settings.json` |
| `claude-md` | `~/.claude/CLAUDE.md` | `~/.slop/backups/claude/CLAUDE.md` |
| `claude-keybindings` | `~/.claude/keybindings.json` | `~/.slop/backups/claude/keybindings.json` |
| `gsd-config` | `~/.claude/get-shit-done/config.json` | `~/.slop/backups/gsd/config.json` |
| `git-config` | `~/.gitconfig` | `~/.slop/backups/git/.gitconfig` |
| `ssh-config` | `~/.ssh/config` | `~/.slop/backups/ssh/config` |

The vault directory (`~/.slop/`) can itself be a git repo. `POST /api/vault-git` with `action: "init"` initializes it; `action: "pull"` syncs from remote. This gives full machine-portability with a single `git push`.

---

## UI conventions

### Color system

All colors are CSS custom properties defined in `client/theme.css`. Component code must never contain raw hex values. The palette uses an `rgb` companion variable for alpha-channel use:

```css
--accent: #d4845a;
--accent-rgb: 212, 132, 90;   /* for rgba(var(--accent-rgb), 0.1) */
```

### Typography

All UI text uses `monospace` via a global `* { font-family: monospace }` rule in `App.css`. Two intentional exceptions:
- Terminal output: `'SF Mono', 'Fira Code', 'Courier New', monospace`
- Markdown body prose (`.md-body`): `Georgia, serif`

Adding `font-family: monospace` to individual components is noise — the global rule already handles it.

### Component patterns

- **Popup / dropdown menus** — `background: var(--surface)`, `border: 1px solid var(--border)`, `borderRadius: 6px`, `boxShadow: 0 4px 16px rgba(0,0,0,0.4)`
- **Hover state** — `background: var(--surface-hover)` (`#1c2128`)
- **Selected / active state** — `background: var(--surface-hi)` (`#21262d`)
- **Transitions** — `transition: background 0.15s` for hover; `transition: color 0.12s, background 0.12s` for color+background together

---

## Adding a new panel

The sidebar has four panels: Explorer, Source Control, GSD Roadmap, Second Brain. To add a fifth:

1. Create `client/components/MyPanel.tsx`
2. Add a tab icon button in the sidebar tab bar (`client/components/SessionPane.tsx` or `App.tsx` — check where the sidebar tabs live)
3. Add the panel to the sidebar render switch
4. Add any required server endpoints to `server/index.ts`
5. Write tests for the server logic in `tests/`

---

## Security notes

- The server accepts `cwd` as a query/body parameter on many endpoints. All path-sensitive endpoints validate that resolved paths stay within the declared `cwd`. Do not skip this check when adding new file endpoints.
- The PTY spawns arbitrary commands. The `command` field in a `spawn` message should only accept values that match the configured `AgentConfig.command`; do not allow the client to spawn arbitrary executables.
- Vault backup/restore operates on `~/.slop/`. It does not touch files outside that directory or the declared source paths. Do not extend it to write to arbitrary paths.
