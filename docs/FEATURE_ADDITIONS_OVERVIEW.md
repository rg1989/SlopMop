# Recent feature additions (overview)

Single reference for optional workspace capabilities shipped in this branch: **Telegram bridge**, **Live Canvas**, supporting server modules, UI hooks, and documentation. Core PTY/browser behavior is unchanged; these layers attach alongside it.

Canonical detail lives in the linked guides under `docs/extensibility/`.

---

## Telegram — outbound text

- Long assistant replies are split for Telegram’s message size limit using `server/telegram-chunk.ts`.
- Debounced outbound paths target a safe chunk size (~3800 characters) under the 4096-byte ceiling.
- Wired from `server/telegram-transport.ts` into `sendMessage` loops with basic flood retry on 429-style errors.

**Docs:** [extensibility/telegram-bridge.md](extensibility/telegram-bridge.md)  
**Tests:** `tests/telegram-chunk.test.ts`

---

## Telegram — inbound text and project routing

- Leading lines `PROJECT=name` or `PROJECT: name` select or align the workspace folder via `server/project-resolve.ts` (same mental model as Composer `@path` plus body).
- Composer-style paths (`@absolutePath`) plus message body are fed into the same PTY path as the browser.
- If the user sends only a project setter with no body, file, or voice, the bot replies confirming the project is set.

**Docs:** [extensibility/telegram-bridge.md](extensibility/telegram-bridge.md)  
**Tests:** `tests/project-resolve.test.ts`

---

## Telegram — voice notes

- Voice messages are downloaded, transcribed with local Whisper (`server/whisper-stt.js` integration from transport), and the resulting text is delivered like a normal text turn.

**Docs:** [extensibility/telegram-bridge.md](extensibility/telegram-bridge.md)

---

## Telegram — photos and documents

- Photos and documents save under `~/.slop/telegram-inbound/<chatId>/` with safe filenames (`server/telegram-media.ts`).
- Captions and saved absolute paths are forwarded to the agent similarly to browser Composer attachments.

**Docs:** [extensibility/telegram-bridge.md](extensibility/telegram-bridge.md)

---

## Telegram — media groups (albums)

- Messages that share a `media_group_id` are debounced and batched; files are saved then a single turn runs with all paths and the best available caption (`scheduleAlbumItem` / album buffer in `server/telegram-transport.ts`).

**Docs:** [extensibility/telegram-bridge.md](extensibility/telegram-bridge.md)

---

## Telegram — operator commands

- `/doctor` runs a Whisper availability check and reports status.
- `/start` and `/help` strings updated for the current bridge behavior.

**Docs:** [extensibility/telegram-bridge.md](extensibility/telegram-bridge.md)

---

## Live Canvas (HTML artifact panel)

- Agent or tooling writes `.slop/live-canvas.html` per project; the **Live Canvas** sidebar tab loads it in a **sandboxed iframe** (`client/components/LiveCanvasPanel.tsx`).
- HTTP API: `GET` / `PUT /api/live-canvas` with workspace `cwd` query parameter; implementation in `server/live-canvas.ts` and wiring in `server/index.ts`.
- Approximate **2MB** payload cap and **~2s polling** refresh in the client (manual refresh button as well).

**Docs:** [extensibility/live-canvas.md](extensibility/live-canvas.md), pointer stub [LIVE_CANVAS.md](LIVE_CANVAS.md)  
**Tests:** `tests/live-canvas.test.ts`

---

## Super Tools — Live Canvas preset

- **Super Tools** includes a **Live Canvas (HTML dashboard)** entry with icon and a long-form direct command describing how to author `.slop/live-canvas.html` and point the user at the sidebar tab (`client/components/SuperToolsModal.tsx`).

---

## Settings and configuration surfaces

- Telegram-related settings UI: `client/components/TelegramSettingsTab.tsx`, integrated via `client/components/SettingsModal.tsx` and app state in `client/App.tsx` as applicable.
- Example / reference config samples where documented (e.g. `docs/telegram.example.json`).

---

## Documentation set

- **`docs/extensibility/README.md`** — index for optional transports and canvas features.
- **`docs/extensibility/telegram-bridge.md`** — bot setup, security, routing, media, troubleshooting, source map.
- **`docs/extensibility/live-canvas.md`** — file location, sandbox rules, REST contract, limits, agent prompts.
- **`README.md`**, **`CONTEXT.md`**, **`docs/ARCHITECTURE.md`** — updated to mention Live Canvas panel vocabulary and Telegram as optional PTY transport where relevant.

---

## Tooling and correctness

- TypeScript: `SuperTool.Icon` typed as `FC` for compatibility with icon components; Telegram album grouping uses **`string`** `media_group_id` keys consistent with the Bot API.
- **`npm run build`** and **`npm test`** are expected to pass on a clean tree after these changes.
