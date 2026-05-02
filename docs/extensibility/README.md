# SlopMop — extended workspace features

This folder documents optional capabilities that go beyond the core browser terminal + file/git workflow: **Telegram as a remote control surface** for the same CLI agent, **rich outbound message formatting** on Telegram, **media ingestion** (voice, images, files), and **Live Canvas** (agent-authored HTML in the sidebar).

These features are implemented entirely inside this repository; the guides here are the canonical reference for behavior, configuration, HTTP APIs, and operator workflows.

## Contents

| Document | What it covers |
|----------|----------------|
| [telegram-bridge.md](telegram-bridge.md) | Bot setup, security model, `PROJECT=` routing, text/voice/files, outbound chunking, commands, troubleshooting, source file map |
| [live-canvas.md](live-canvas.md) | `.slop/live-canvas.html`, sandboxed iframe UI, REST API, limits, prompts for agents |

## Quick orientation

- **Telegram** does not run a separate agent runtime. It attaches to a **persistent PTY** keyed by Telegram chat id (`tg:<chatId>`), using the same **agent command** as SlopMop Settings (`~/.slop/settings.json` → `agent.command` / `agent.args`).
- **Live Canvas** is **per project folder** (the workspace `cwd` you open in the browser). It is one HTML file per project, rendered beside the tree/git panels.

## Source files (high level)

| Area | Primary modules |
|------|-----------------|
| Telegram transport | `server/telegram-transport.ts` |
| Telegram downloads / inbound paths | `server/telegram-media.ts` |
| Telegram outbound splitting | `server/telegram-chunk.ts` |
| Telegram JSON + secrets | `server/telegram-persist.ts`, `server/telegram-config.ts` |
| Project name → folder | `server/project-resolve.ts` |
| Live Canvas persistence + API wiring | `server/live-canvas.ts`, `server/index.ts` (`/api/live-canvas`) |
| Live Canvas UI | `client/components/LiveCanvasPanel.tsx`, `client/App.tsx` (sidebar tab) |

When improving or debugging behavior, start from the relevant guide above, then jump to the listed modules.
