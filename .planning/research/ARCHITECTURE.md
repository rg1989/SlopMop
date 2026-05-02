# Architecture Research

**Domain:** Browser-based AI CLI terminal wrapper (xterm.js + node-pty + WebSocket + React)
**Researched:** 2026-04-30
**Confidence:** HIGH — xterm.js/node-pty/WebSocket browser terminal architecture is a well-established pattern (Wetty, ttyd, Replit, StackBlitz all use it). Claims draw from training knowledge through Aug 2025 on a stable, well-documented ecosystem.

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (React SPA)                           │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │  TerminalPane│  │  FileExplorer│  │  MessageInput│  │  VoiceUI │ │
│  │  (xterm.js)  │  │  (tree view) │  │  (textarea)  │  │  (mic/   │ │
│  │              │  │              │  │              │  │   TTS)   │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────┬─────┘ │
│         │                 │                  │               │        │
│  ┌──────┴─────────────────┴──────────────────┴───────────────┴──────┐ │
│  │                     WebSocket Client                              │ │
│  │        (single persistent connection — all messages muxed)        │ │
│  └──────────────────────────────┬────────────────────────────────────┘ │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │ ws://localhost:PORT
┌─────────────────────────────────┼───────────────────────────────────────┐
│                     NODE.JS BACKEND (Express + ws)                    │
│                                                                       │
│  ┌──────────────────────────────┴────────────────────────────────────┐ │
│  │                     WebSocket Server                               │ │
│  │           (message router — dispatches by msg.type)                │ │
│  └───┬───────────────┬──────────────────────┬────────────────────────┘ │
│      │               │                      │                           │
│  ┌───┴────┐  ┌────────┴──────┐  ┌───────────┴──────┐                   │
│  │  PTY   │  │  File System  │  │   Git Service    │                   │
│  │Manager │  │   Service     │  │  (simple-git /   │                   │
│  │(node-  │  │ (fs, chokidar)│  │  child_process)  │                   │
│  │  pty)  │  │               │  │                  │                   │
│  └───┬────┘  └───────────────┘  └──────────────────┘                   │
│      │                                                                   │
│  ┌───┴────────────────────────────┐                                     │
│  │   Claude CLI Process (PTY)     │                                     │
│  │   spawned via node-pty         │                                     │
│  │   cwd = user-selected folder   │                                     │
│  └────────────────────────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `TerminalPane` | Render PTY output; capture keystroke input; handle resize | xterm.js + FitAddon + WebLinksAddon |
| `FileExplorer` | Display directory tree; toggle all/changed files; emit file selection | Recursive tree component; git status polling |
| `MessageInput` | Multiline compose area; file attachment list; send trigger | Controlled textarea; Enter-to-send vs Shift+Enter newline |
| `VoiceUI` | Mic trigger button; TTS play/pause/stop; VAD indicator | Web Speech API or Whisper.js for input; AudioContext for TTS |
| `WebSocket Client` | Single connection; serialize/deserialize JSON messages; reconnect | Native browser WebSocket; reconnect on close |
| `WebSocket Server` | Route incoming messages by `type`; broadcast PTY output back | `ws` library on Node.js; thin router only |
| `PTY Manager` | Spawn/kill Claude CLI process; pipe stdin/stdout; handle resize | `node-pty` — one `IPty` instance at a time |
| `File System Service` | Read directory tree; watch for changes; read file content | `fs.readdir`, `chokidar` for watching |
| `Git Service` | Get changed files (`git status`/`git diff`); file diff badges | `simple-git` or `child_process` spawning `git` |

---

## Recommended Project Structure

```
claudetalk/
├── server/                    # Node.js backend
│   ├── index.ts               # Express + WebSocket server entry point
│   ├── pty/
│   │   └── PtyManager.ts      # node-pty spawn, resize, kill, stdin write
│   ├── fs/
│   │   ├── FileService.ts     # directory tree reads, file content reads
│   │   └── WatchService.ts    # chokidar file watcher, emit change events
│   ├── git/
│   │   └── GitService.ts      # git status, changed files, diff parsing
│   └── ws/
│       └── MessageRouter.ts   # WebSocket message dispatcher
│
├── client/                    # React SPA
│   ├── main.tsx               # Entry; mounts App
│   ├── App.tsx                # Layout; WebSocket provider; app shell
│   ├── ws/
│   │   ├── useWebSocket.ts    # WebSocket connection hook + reconnect
│   │   └── messages.ts        # Shared message type definitions (TS types)
│   ├── terminal/
│   │   ├── TerminalPane.tsx   # xterm.js mount, FitAddon, resize observer
│   │   └── useTerminal.ts     # xterm.js init logic
│   ├── explorer/
│   │   ├── FileExplorer.tsx   # Sidebar shell + toggle
│   │   ├── FileTree.tsx       # Recursive tree rendering
│   │   └── useFileTree.ts     # File tree state + server sync
│   ├── input/
│   │   ├── MessageInput.tsx   # Textarea, attachments bar, send button
│   │   └── AttachmentPreview.tsx  # Thumbnail / snippet per file
│   ├── voice/
│   │   ├── VoiceInput.tsx     # Mic button + transcription display
│   │   ├── TtsPlayer.tsx      # Play/interrupt controls
│   │   └── useTts.ts          # AudioContext queue, ghost-pepper pattern
│   └── store/
│       └── useAppStore.ts     # Zustand store — session state, UI state
│
├── shared/
│   └── protocol.ts            # WebSocket message type enum + payload types
│                              # (imported by both server/ and client/)
│
├── vite.config.ts             # Vite dev server + proxy to Node.js backend
├── tsconfig.json
└── package.json
```

### Structure Rationale

- **`shared/protocol.ts`:** Single source of truth for WebSocket message types — avoids client/server drift on message shapes. Both sides import from here.
- **`server/pty/`:** PTY logic isolated — easy to unit test spawn/kill/resize independently of HTTP/WS concerns.
- **`client/ws/`:** WebSocket connection hook separated from components — components subscribe to messages without owning the connection.
- **`client/voice/`:** Voice input and TTS are isolated — high complexity, easily disabled, independent of terminal flow.
- **`client/store/`:** Single Zustand store for cross-cutting state (current session, active folder, TTS on/off, attachment list) — avoids prop drilling.

---

## Architectural Patterns

### Pattern 1: Message-Typed WebSocket Protocol

**What:** All WebSocket frames are JSON with a `type` discriminator field. Server routes by type; client handles by type.

**When to use:** Always. This is the standard for multiplexing PTY data, file tree updates, resize commands, and git events over a single WS connection.

**Trade-offs:** Slight overhead vs raw binary frames. Acceptable — the bottleneck is PTY I/O throughput, not JSON serialization overhead at this scale.

**Example:**
```typescript
// shared/protocol.ts
export type ClientMessage =
  | { type: 'pty:input'; data: string }
  | { type: 'pty:resize'; cols: number; rows: number }
  | { type: 'session:start'; cwd: string }
  | { type: 'session:stop' }
  | { type: 'fs:readdir'; path: string }
  | { type: 'fs:readfile'; path: string };

export type ServerMessage =
  | { type: 'pty:output'; data: string }
  | { type: 'pty:exit'; code: number }
  | { type: 'fs:tree'; tree: FileNode[] }
  | { type: 'fs:changed'; paths: string[] }
  | { type: 'git:status'; files: GitFileStatus[] }
  | { type: 'fs:file'; path: string; content: string };
```

### Pattern 2: PTY as a Singleton per Session

**What:** One `IPty` instance at a time per active session. Spawn on `session:start`, kill on `session:stop` or WebSocket close. Do not allow multiple concurrent PTY instances in v1.

**When to use:** Matches the project constraint (single session). Prevents resource leaks from uncleaned PTY processes.

**Trade-offs:** No concurrency — intentional. Simplifies state dramatically.

**Example:**
```typescript
// server/pty/PtyManager.ts
export class PtyManager {
  private pty: IPty | null = null;

  spawn(cwd: string, onData: (data: string) => void): void {
    if (this.pty) this.kill(); // safety: never double-spawn
    this.pty = nodePty.spawn('claude', [], {
      name: 'xterm-256color',
      cols: 80, rows: 24,
      cwd,
      env: process.env as Record<string, string>
    });
    this.pty.onData(onData);
  }

  write(data: string): void { this.pty?.write(data); }
  resize(cols: number, rows: number): void { this.pty?.resize(cols, rows); }
  kill(): void { this.pty?.kill(); this.pty = null; }
}
```

### Pattern 3: xterm.js Fit Addon + ResizeObserver

**What:** Use xterm.js `FitAddon.fit()` to resize the terminal to its container, then send the new dimensions to the backend via WebSocket. Use a `ResizeObserver` on the terminal container div (not `window.onresize`) to catch split-pane resizes.

**When to use:** Always — window.onresize misses container-level resize events common in sidebar-split layouts.

**Trade-offs:** None meaningful — ResizeObserver is broadly supported and correct.

**Example:**
```typescript
// client/terminal/TerminalPane.tsx (simplified)
const containerRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  const observer = new ResizeObserver(() => {
    fitAddon.fit();
    send({ type: 'pty:resize', cols: terminal.cols, rows: terminal.rows });
  });
  observer.observe(containerRef.current!);
  return () => observer.disconnect();
}, []);
```

### Pattern 4: Ghost-Pepper TTS Queue (Streaming Interruption)

**What:** Split agent text output into sentence-length chunks as they stream in. Encode each chunk to speech asynchronously, push to an `AudioContext`-backed queue. On interruption (user speaks or clicks stop), drain the queue and cancel the current `AudioBufferSourceNode`.

**When to use:** For TTS with mid-sentence interruption. Do not use the simpler `SpeechSynthesis` browser API — it cannot be interrupted cleanly mid-utterance and has cross-browser inconsistencies.

**Trade-offs:** More complex than `window.speechSynthesis`. Required for the interruption feature.

**Example (structure):**
```typescript
// client/voice/useTts.ts
const queue: AudioBuffer[] = [];
let currentSource: AudioBufferSourceNode | null = null;

function enqueue(text: string) {
  encodeToAudioBuffer(text).then(buf => {
    queue.push(buf);
    if (!currentSource) playNext();
  });
}

function interrupt() {
  queue.length = 0;              // drain pending
  currentSource?.stop();         // cancel current
  currentSource = null;
}
```

---

## Data Flow

### PTY Input Flow (User Types in Terminal)

```
User keystroke in xterm.js
    ↓
xterm.js onData callback
    ↓
WebSocket Client → { type: 'pty:input', data: '\r' }
    ↓
WebSocket Server → MessageRouter
    ↓
PtyManager.write(data)
    ↓
node-pty stdin → Claude CLI process
    ↓
Claude CLI stdout → node-pty onData
    ↓
WebSocket Server → { type: 'pty:output', data: '...' }
    ↓
WebSocket Client → xterm.js terminal.write(data)
    ↓
xterm.js renders ANSI output in browser
```

### Message Input Flow (User Types in MessageInput + Sends)

```
User types in MessageInput textarea
    ↓ [optional: file paths appended from attachment list]
MessageInput constructs final string: "[prompt]\n@path1 @path2"
    ↓
WebSocket Client → { type: 'pty:input', data: constructedString + '\n' }
    ↓
Same as PTY Input Flow above (MessageInput is just a stdin writer)
```

### File Tree Flow (Sidebar)

```
session:start (cwd received)
    ↓
FileService.readdir(cwd) → recursive tree
    ↓
WebSocket Server → { type: 'fs:tree', tree: [...] }
    ↓
FileExplorer renders tree
    ↓
chokidar watches cwd for changes
    ↓ [on file change]
WebSocket Server → { type: 'fs:changed', paths: [...] }
    ↓
FileExplorer updates affected nodes
```

### Changes Only Toggle Flow

```
User clicks "Changes Only" toggle
    ↓
Client → { type: 'git:status' } (or: backend polls on interval)
    ↓
GitService runs: git status --porcelain (cwd)
    ↓
Server → { type: 'git:status', files: [{ path, status }] }
    ↓
FileExplorer filters to changed paths only + shows M/A/D badges
```

### TTS Flow (Agent Response → Audio)

```
PTY output stream (pty:output events)
    ↓
TTS parser detects agent response boundary (heuristic or explicit marker)
    ↓
Text chunked into sentences (~50-100 chars each)
    ↓
Each chunk → TTS encoding (browser TTS API or ElevenLabs/OpenAI TTS)
    ↓
AudioBuffer pushed to playback queue
    ↓
AudioContext plays queue sequentially
    ↓ [if user speaks or clicks interrupt]
VAD fires / interrupt button clicked
    ↓
Queue drained + currentSource.stop()
    ↓ [optional: capture user input via mic]
Voice transcription → MessageInput
```

---

## Build Order

Dependencies between components determine build order. Build foundational layers first; UI layers depend on them.

```
Phase 1 — Backend Core
  1. WebSocket server scaffold (Express + ws)
  2. PTY Manager (node-pty spawn/kill/resize/input)
  3. Shared protocol types
  → Milestone: Can spawn Claude CLI, echo PTY I/O over WebSocket

Phase 2 — Terminal Frontend
  4. React app scaffold (Vite + TypeScript)
  5. WebSocket client hook
  6. TerminalPane (xterm.js + FitAddon + resize)
  → Milestone: Full browser terminal connected to real Claude CLI PTY

Phase 3 — File System Layer
  7. FileService + WatchService (backend)
  8. FileExplorer component (client)
  9. GitService + Changes Only toggle
  10. File attachment injection into MessageInput
  → Milestone: Working sidebar, attach files to messages

Phase 4 — Voice Layer
  11. Voice input (Web Speech API)
  12. TTS player (ghost-pepper pattern — AudioContext queue)
  13. VAD + interruption
  → Milestone: Voice-in, voice-out, mid-speech interruption
```

**Why this order:**
- PTY + WebSocket is the riskiest integration (PTY process management, escape sequence handling, resize sync). Prove it works first before building any UI on top.
- File system is pure Node.js — low risk, high value, can be built while terminal is being polished.
- Voice is the highest-complexity, highest-risk feature. Deferring it prevents it from blocking terminal work.

---

## Scaling Considerations

This is a single-user local tool. Scaling is not a concern. Notes are relevant for reliability only.

| Concern | At 1 user (local) | Notes |
|---------|-------------------|-------|
| PTY memory leak | No leak if PtyManager.kill() always called | Always handle WebSocket disconnect to kill PTY |
| chokidar file watcher | Single watcher per session | Stop watcher on session end; large repos (node_modules) need exclusions |
| WebSocket reconnect | Must handle gracefully | xterm.js buffers are lost on disconnect; user sees blank terminal; offer "reconnect" button |
| Large PTY output (long codegen) | xterm.js scrollback buffer | Default scrollback (1000 lines) too low for Claude codegen; set to 10,000+ |

---

## Anti-Patterns

### Anti-Pattern 1: Multiple WebSocket Connections (One Per Feature)

**What people do:** Create separate WebSocket connections for terminal data, file tree updates, and voice events.

**Why it's wrong:** Browser limits connections per host; adds reconnection logic complexity in proportion to connections; CORS/auth surface multiplied; harder to sequence events across concerns (e.g., "session:stop" must also stop file watcher).

**Do this instead:** Multiplex everything over one WebSocket connection using `type`-tagged JSON messages. Route on both ends by message type.

### Anti-Pattern 2: Writing PTY Data as UTF-8 Strings Without Binary Safety

**What people do:** `socket.send(data)` where `data` is a raw Buffer from node-pty, without ensuring UTF-8 encoding or handling partial multi-byte sequences.

**Why it's wrong:** PTY output contains raw bytes. A multi-byte UTF-8 character (e.g., a box-drawing character) can be split across two `onData` callbacks, corrupting the sequence at the split boundary if sent immediately.

**Do this instead:** xterm.js handles corrupt sequences gracefully in practice, but prefer `data.toString('utf8')` explicitly. For robustness, accumulate partial sequences using a TextDecoder with `{ stream: true }` on the server before forwarding.

### Anti-Pattern 3: Intercepting All Keyboard Events in the Browser

**What people do:** Add global `keydown` listeners to implement "send to PTY" behavior, or to add custom shortcuts.

**Why it's wrong:** xterm.js already handles keyboard input correctly for the terminal, including escape sequences for arrow keys, Ctrl+C → SIGINT, etc. Overriding breaks these. Global listeners conflict with browser shortcuts (Ctrl+W, Cmd+T).

**Do this instead:** Let xterm.js own all keyboard input inside its canvas. Add shortcuts only outside the terminal canvas (e.g., Cmd+Shift+V for voice trigger, Cmd+K for command palette) — using `keydown` on the outer app container with `!event.target.closest('.xterm')` guards.

### Anti-Pattern 4: Spawning Claude CLI via `child_process.exec` Instead of node-pty

**What people do:** Use `child_process.spawn` or `exec` to run Claude CLI and pipe stdio.

**Why it's wrong:** Claude CLI detects it is not in a PTY and changes behavior (disables color, may disable interactive prompts, spinner animations break). Many CLI tools behave differently in non-PTY contexts. This is the core reason node-pty exists.

**Do this instead:** Always use `node-pty` to spawn the process. It creates a real pseudo-terminal that the CLI cannot distinguish from a real terminal.

### Anti-Pattern 5: Using `window.speechSynthesis` for TTS

**What people do:** Use the browser's built-in `SpeechSynthesis` API for TTS because it requires zero dependencies.

**Why it's wrong:** `SpeechSynthesis.cancel()` stops speech but cannot be interrupted mid-phoneme on all browsers. Chrome's implementation is notoriously buggy with long strings. The API cannot handle streaming (must buffer full text before speaking). No control over audio buffer timing.

**Do this instead:** Use the `AudioContext` + queued `AudioBufferSourceNode` approach from ghost-pepper. Fetch TTS-encoded audio asynchronously per sentence chunk, queue buffers, and cancel via `source.stop()`. This gives precise interrupt control.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude CLI | node-pty spawn in cwd | Must be in PATH; version discovery via `claude --version` on startup |
| Git | `child_process.exec('git status --porcelain')` or `simple-git` | Run in session cwd; handle "not a git repo" gracefully |
| Web Speech API | Browser-native; no backend needed | Chrome/Edge: full support. Safari: partial (recognition may require user gesture). Firefox: limited. |
| TTS backend | AudioContext for playback; encoding via browser TTS or external API | Ghost-pepper uses local model or OpenAI TTS API; keep swappable |
| VAD | `@ricky0123/vad-web` (ONNX-based, runs in AudioWorklet) | Must run in AudioWorklet context; co-exists with TTS AudioContext |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| TerminalPane ↔ WebSocket client | Hook: `usePtyOutput` subscribes to `pty:output` messages | Terminal never calls WebSocket directly; goes through hook |
| MessageInput ↔ PTY | `send({ type: 'pty:input', data })` via WebSocket | MessageInput constructs the full stdin string; PTY does not know about attachments |
| FileExplorer ↔ MessageInput | File selection event bubbles to parent via callback/store | Decoupled — explorer emits `onFileSelect(path)`, input appends it |
| VoiceInput ↔ MessageInput | Voice transcription written into MessageInput state | User can edit transcript before sending — never auto-send |
| TTS ↔ TerminalPane | TTS subscribes to same `pty:output` stream, parses for agent text | TTS and terminal both consume PTY output independently |
| PtyManager ↔ WatchService | Shared `cwd` — both set at `session:start`, both cleared at `session:stop` | No direct coupling; both owned by session lifecycle |

---

## Sources

- xterm.js documentation and addon API (training knowledge, HIGH confidence — stable API through Aug 2025)
- node-pty README and `IPty` interface (training knowledge, HIGH confidence)
- `ws` library Node.js WebSocket server (training knowledge, HIGH confidence)
- Wetty / ttyd open-source implementations (training knowledge — these projects implement the same PTY-over-WebSocket pattern; HIGH confidence on pattern correctness)
- Ghost-pepper repo (https://github.com/matthartman/ghost-pepper) — referenced in PROJECT.md for TTS interruption
- `@ricky0123/vad-web` (MEDIUM confidence — active as of training cutoff; verify version at install time)
- Web Speech API MDN specification (HIGH confidence — stable Web API)
- Vite proxy configuration for dev (HIGH confidence — standard Vite feature)

---

*Architecture research for: SlopMop — browser-based Claude CLI terminal wrapper*
*Researched: 2026-04-30*
