# Telegram bridge

SlopMop can run a **Telegram bot** that forwards private-chat messages into a **real pseudo-terminal** running your configured CLI agent (for example Claude Code). Replies from the agent are streamed back to Telegram after stripping ANSI escapes and splitting long text into Telegram-safe messages.

This document describes behavior as implemented in the server — configuration, message formats, media handling, limits, and implementation details.

---

## Goals and non-goals

**In scope**

- One **long-lived PTY per Telegram private chat** (per user chat id).
- Same **inference process** as the browser session: whatever you set under **Settings → Agent & Tools** in SlopMop, stored in `~/.slop/settings.json`.
- **Project selection** via a plain folder **name** resolved against configurable **project roots** (not raw arbitrary paths from Telegram).
- **Voice notes** transcribed with the same **local Whisper** stack as the browser voice bar (when installed).
- **Photos and documents** downloaded to disk and passed to the agent using the **same `@absolutePath` convention** as the in-app Composer.

**Out of scope**

- Group chats, channels, or inline bots — handlers require **`chat.type === 'private'`**.
- A separate hosted agent or cloud relay — the SlopMop **Node server** must be running where Whisper and the CLI are available.

---

## Architecture

```
Telegram user (private chat)
       │
       ▼
   grammY Bot (long polling)
       │
       ▼
telegram-transport.ts
       ├── authorize (allowedUserIds)
       ├── parse PROJECT= / body / captions
       ├── resolve folder name → absolute path (project-resolve.ts)
       ├── registry session id: tg:<chatId> (session-registry.ts + pty-manager.ts)
       ├── write user turn to PTY (Composer-shaped text)
       └── on PTY output → strip ANSI → debounce → chunk → sendMessage
```

### Session identity

- Session id format: **`tg:<telegramChatId>`** (see `SESSION_PREFIX` in `server/telegram-transport.ts`).
- **Different from browser WebSocket sessions** — Telegram never shares a PTY with a browser tab; each surface has its own registry entry.

### Working directory

- The PTY is spawned with an initial home-directory cwd, then **`cd`** is sent to:
  - the **last successfully resolved project path** after a `PROJECT=name` line, and/or
  - the path resolved on any message that includes `PROJECT=name`.

Project resolution uses **`resolveProjectFolderName`** (`server/project-resolve.ts`): recursive search under each configured root up to **`maxSearchDepth`**, matching a **directory basename** exactly. Path-like tokens (`../`, `\`, `.`) are rejected.

---

## Configuration

### Files

| File | Purpose |
|------|---------|
| `~/.slop/telegram.json` | Public config: `projectRoots`, `allowedUserIds`, optional `maxSearchDepth` (0–32, default 8). Example: [telegram.example.json](../telegram.example.json) |
| `~/.slop/telegram-secrets.json` | Bot token (`botToken`). Written by **Settings → Telegram**; aim for file mode `600`. |

### Environment variables

| Variable | Effect |
|----------|--------|
| `TELEGRAM_BOT_TOKEN` | If set, **overrides** the token file. SlopMop logs this as the active token source. |
| `TELEGRAM_PROJECT_ROOTS` | Comma-separated absolute paths. If non-empty, **replaces** `projectRoots` from `telegram.json`. |
| `TELEGRAM_ALLOWED_USER_IDS` | Comma-separated numeric user ids. If non-empty, **replaces** `allowedUserIds` from `telegram.json`. |

Resolution logic lives in `server/telegram-config.ts`: env lists win over file lists when env is non-empty.

### UI

**Settings → Telegram** edits roots, allowlist, depth, and token; saving public config or token triggers **bot restart** (`restartTelegramTransport` from `server/index.ts`).

### Agent command

Loaded from `~/.slop/settings.json`:

```json
{ "agent": { "command": "claude", "args": [] } }
```

Fallback if missing: `claude` with no args. Telegram uses the same helper `loadAgentFromSlopSettings()` as the transport bootstrap.

---

## Security model

1. **Private chats only** — `ensurePrivateChat` drops non-private updates.
2. **Allowlist** — `ctx.from.id` must appear in `allowedUserIds`. Empty allowlist means **no one** is authorized (bot logs a warning at startup).
3. **Project paths** — Users never send raw filesystem paths for cwd; they send a **folder name** that must resolve **uniquely** under configured roots. Ambiguous matches return an error string from the resolver.
4. **Inbound files** — Saved under `~/.slop/telegram-inbound/<chatId>/` with sanitized names and a short random prefix (see below).

---

## User flows

### First-time / `PROJECT=`

1. User sends a message whose first non-empty line matches **`PROJECT=name`** or **`PROJECT: name`** (case-insensitive). The rest of the message is the **body**.
2. `name` must be a single folder name (no path separators). It is resolved to an absolute directory.
3. That directory is stored in per-chat state as **`lastProjectPath`**.
4. A PTY is spawned if needed, then **`cd '…'`** is written using **`shellSingleQuotedPath`** (`server/project-resolve.ts`) so paths with quotes are safe.

If the user sends **`PROJECT=name`** with **no body and no attachment**, the bot replies that the project is set and asks for the next **message, file, or voice note** — it does not send an empty line to the CLI.

### Plain text

After `PROJECT` is set once, following text messages may omit `PROJECT=` until **`/reset`** clears chat state.

Text-only turns call **`deliverTelegramTurn`** with `attachmentPaths: []`.

### Composer-shaped payload to the PTY

When attachments are present, the line sent to the PTY matches the browser **Composer** pattern (`client/components/Composer.tsx`):

- **`@path1 @path2 …`** on the first line (space-separated absolute paths),
- then a newline,
- then the **body** (caption or transcription), possibly empty.

If there are only paths and no body, the transport still sends the `@paths` line plus newline.

### Voice messages

Handler: **`message:voice`** (`server/telegram-transport.ts`).

1. Bot replies **“Transcribing voice…”**.
2. Work is **serialized per chat** via **`chainInbound`** so overlapping voice/file/text does not interleave.
3. File metadata is fetched with Telegram **`getFile`**, then bytes are downloaded with **`fetchTelegramFileBuffer`** (`server/telegram-media.ts`) — **no requirement** to persist voice to disk for STT.
4. **`transcribe(buffer, 'audio/ogg')`** (`server/whisper-stt.ts`) produces text.
5. If Whisper is unavailable, the user gets an install hint (`pip install openai-whisper`, `ffmpeg`).
6. The transcription string is passed to **`deliverTelegramTurn`** as the text part with **no attachments**.

Voice uses the same Whisper probe as **`/doctor`** (`checkWhisper()` before `getWhisperStatus()`).

### Photos

Handler: **`message:photo`**.

1. **Largest** photo size is chosen (`photos[photos.length - 1]`).
2. User sees **“Downloading image…”**, then **“Saved: &lt;absolute path&gt;”**.
3. File is stored via **`saveTelegramFileToInbound`**.
4. **`deliverTelegramTurn`** is called with **`caption`** as body and **one attachment path**.

### Documents

Handler: **`message:document`**.

Same pattern as photos: download notification, save path reply, then **`deliverTelegramTurn`** with caption and single path. **`knownSize`** from Telegram is passed through for pre-reject of oversized downloads.

---

## Inbound file storage

Defined in **`server/telegram-media.ts`**.

| Constant | Value |
|----------|--------|
| Root directory | `~/.slop/telegram-inbound/` |
| Per-chat subdirectory | `<numeric chat id>/` |
| Max download size | **25 MB** (`MAX_TELEGRAM_FILE_BYTES`) |

**Filename rules**

- Suggested name from Telegram is passed through **`safeBasename`** (strip path, replace risky characters, cap length).
- Final name: **`{10-char uuid}_{stem}{ext}`** to avoid collisions.

**Download**

- HTTPS: `https://api.telegram.org/file/bot<token>/<file_path>` via `fetch`.

---

## Outbound messages (agent → Telegram)

### ANSI stripping

PTY output may contain ANSI sequences. Before sending to Telegram, sequences are removed in **`stripAnsi`** (CSI OSC, and simple single-char sequences).

### Debounce

Output chunks are accumulated per session id and flushed after **`OUTPUT_DEBOUNCE_MS`** (420 ms) so bursty streams become fewer Telegram messages.

### Length and splitting

Telegram message length limit is **4096** characters. SlopMop uses an internal target **`TELEGRAM_CHUNK = 3800`** bytes of **logical text** after stripping and trim, then **`chunkTextForTelegram`** (`server/telegram-chunk.ts`):

- Prefer breaking at **newlines** if a sufficiently early newline exists in the window (~45% of max from the start of the slice).
- Else prefer breaking at **spaces** (~35% threshold).
- If neither yields a non-empty chunk, **hard-split** at `max` (handles very long tokens).

This avoids naive fixed-width cuts mid-word when natural breakpoints exist.

---

## Bot commands

| Command | Behavior |
|---------|----------|
| `/start` | Short onboarding: text / voice / files + pointer to `/doctor`, `/reset`, `/help` |
| `/help` | Formatting examples and reminder about Whisper + inbound dir |
| `/doctor` | Lines: token presence, allowlist count, roots count, `maxSearchDepth`, agent command + `which`, **Whisper** availability (after `checkWhisper()`), paths to settings and `telegram.json` |
| `/reset` | Destroys registry session `tg:<chatId>`, clears debounce buffer, clears **`lastProjectPath`** — user must send **`PROJECT=`** again before the next substantive turn |

Messages starting with **`/`** are not forwarded as CLI input except these commands.

---

## Startup

If **`getTelegramBotToken()`** returns nothing, transport logs that Telegram is disabled and **does not** start polling.

Otherwise **`bot.start()`** runs long polling and logs **`[telegram] Long polling started`**.

---

## Troubleshooting

| Symptom | Things to check |
|---------|-----------------|
| “Not authorized” | Your numeric user id in `allowedUserIds` or `TELEGRAM_ALLOWED_USER_IDS`; must be private chat |
| “Unknown project” / “Ambiguous” | Folder name spelling; roots in Settings; duplicate folder names under different roots |
| Voice never transcribes | `/doctor` Whisper line; `pip install openai-whisper`, `ffmpeg` on PATH |
| Downloads fail | File size over 25 MB; bot token valid; network from server to `api.telegram.org` |
| Garbled CLI output on Telegram | Expected for full-screen TUI apps — bridge is optimized for line-oriented CLI agents |
| Long replies split oddly | Algorithm favors newlines/spaces; extreme edge cases still hard-split |

---

## Implementation reference

| Topic | Location |
|-------|----------|
| Bot wiring, handlers, flush logic | `server/telegram-transport.ts` |
| Chunking algorithm | `server/telegram-chunk.ts` |
| Downloads + inbound paths | `server/telegram-media.ts` |
| Merge env + file config | `server/telegram-config.ts` |
| Token + `telegram.json` persistence | `server/telegram-persist.ts` |
| Project name resolution | `server/project-resolve.ts` |
| PTY spawn | `server/pty-manager.ts` |
| Session lifecycle | `server/session-registry.ts` |
| Whisper | `server/whisper-stt.ts` |
| Vitest (chunking) | `tests/telegram-chunk.test.ts` |
| Vitest (project line parsing) | `tests/project-resolve.test.ts` |

---

## Known limitations

- **Media groups** (albums) arrive as separate messages — each photo may trigger its own turn unless the user batches manually.
- **`message:audio`** as a non-voice file may arrive as **document** depending on client — behavior follows the corresponding handler.
- Telegram **rate limits** are not specially queued beyond sequential `sendMessage` in a loop; flood errors are logged.

These are acceptable trade-offs for the current design; tightening them would be future work.
