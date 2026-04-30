# Phase 1: PTY Core - Research

**Researched:** 2026-04-30
**Domain:** Browser-based PTY terminal (node-pty + xterm.js + WebSocket)
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TERM-01 | User can select a folder from the UI which opens a real PTY Claude CLI session in that directory | node-pty `spawn()` with `cwd` option; folder picker via `<input type="file" webkitdirectory>` or a native dialog API |
| TERM-02 | Terminal renders full ANSI/color output with correct Claude CLI interactive behavior | xterm.js 6 with @xterm/addon-webgl renderer; `TERM=xterm-256color` env var in spawn options |
| TERM-03 | User can compose multiline messages in an input area before sending to the terminal | Separate `<textarea>` element above/beside the xterm viewport; Enter sends, Shift+Enter inserts newline; value sent via `ptyProcess.write()` |
| TERM-04 | Terminal supports scrollback buffer and keyboard copy/paste shortcuts | xterm.js `scrollback` option (default 1000); Cmd+C/Cmd+V work natively on macOS in Chrome/Firefox; `@xterm/addon-clipboard` for explicit control |
| TERM-05 | Terminal resizes correctly when browser window or sidebar width changes | FitAddon + ResizeObserver with 150ms debounce; propagate cols/rows to PTY via `ptyProcess.resize()` over WebSocket |
</phase_requirements>

---

## Summary

Phase 1 establishes the foundational layer: a Node.js backend that spawns Claude CLI inside a real PTY and streams I/O to the browser via WebSocket, rendered in xterm.js. The technology stack is mature and widely battle-tested (VS Code itself uses this exact combination). The three main components — node-pty, xterm.js, and the WebSocket transport — each have well-known APIs, and the primary implementation risks are in the details: package naming changed in xterm.js 5/6, the canvas renderer was removed in 6.0, resize must be debounced and propagated to the PTY, and the multiline composer is a separate DOM element (not customization of xterm.js input).

The architecture is: `Browser (xterm.js + React UI) <-> WebSocket (ws library) <-> Express HTTP server <-> node-pty <-> Claude CLI process`. The folder selector sends the chosen path to the server, the server spawns a PTY in that directory, and all PTY data flows bidirectionally over the socket. Resize events flow from the xterm.js FitAddon through to `ptyProcess.resize()`.

The biggest pitfall to avoid: using the deprecated `xterm` / `xterm-*` npm packages instead of `@xterm/xterm` and `@xterm/*` scoped packages. Version 6.0 (released December 2025) removed the canvas renderer addon — use WebGL or DOM renderer only.

**Primary recommendation:** Use `@xterm/xterm@6` + `@xterm/addon-fit` + `@xterm/addon-webgl` + `node-pty@1.1` + `ws` + `express`. Scaffold with Vite + React + TypeScript.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @xterm/xterm | 6.0.0 | Browser terminal emulator | Industry standard; used by VS Code, Theia, JupyterLab |
| @xterm/addon-fit | 0.11.0 | Fit terminal to container element | Required for responsive resize |
| @xterm/addon-webgl | 0.19.0 | WebGL renderer (replaces canvas) | Up to 900% faster than canvas; canvas addon removed in v6 |
| @xterm/addon-clipboard | latest | System clipboard access | Explicit copy/paste control beyond browser default |
| node-pty | 1.1.0 | Spawn real PTY processes in Node.js | The only battle-tested PTY library for Node; maintained by Microsoft |
| ws | 8.x | WebSocket server for Node.js | De facto standard; used by VS Code's remote server |
| express | 4.x | HTTP server + static file serving | Mature, minimal, sufficient for single-user local app |

### Frontend Build
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vite | 6.x | Frontend bundler + dev server | Standard for React/TS apps in 2025; instant HMR |
| React | 19.x | UI framework | State management for folder picker, composer, status bar |
| TypeScript | 5.x | Type safety | Strongly recommended; xterm.js ships .d.ts files |

### Testing
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 3.x | Unit/integration test runner | Fast, Vite-native, matches project build tooling |
| @testing-library/react | 16.x | Component testing | Testing the composer, folder picker UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ws | socket.io | socket.io is heavier with auto-reconnect, rooms, etc. — overkill for single-user local app |
| @xterm/addon-webgl | @xterm/addon-canvas | Canvas addon was removed in xterm.js 6.0; DOM renderer is fallback |
| Vite + React | plain HTML + vanilla JS | React better for phase 2/3 state complexity; Vite HMR significantly speeds up iteration |
| express | http module only | Express needed for static serving + clean routing; negligible overhead |

**Installation:**
```bash
# Backend
npm install express ws node-pty

# Frontend (Vite project)
npm install @xterm/xterm @xterm/addon-fit @xterm/addon-webgl @xterm/addon-clipboard

# Dev
npm install -D vite @vitejs/plugin-react typescript vitest @testing-library/react
```

**Important:** node-pty is a native module. On macOS it requires Xcode command-line tools (`xcode-select --install`). It compiles during `npm install` — no separate rebuild step needed for plain Node.js (only Electron requires rebuild).

---

## Architecture Patterns

### Recommended Project Structure
```
claudetalk/
├── server/
│   ├── index.ts          # Express + HTTP server entry point
│   ├── pty-manager.ts    # node-pty spawn/resize/kill logic
│   └── ws-handler.ts     # WebSocket message routing
├── client/
│   ├── main.tsx          # React entry
│   ├── App.tsx           # Root layout
│   ├── components/
│   │   ├── Terminal.tsx  # xterm.js mount + FitAddon wiring
│   │   ├── Composer.tsx  # Multiline textarea input component
│   │   └── FolderPicker.tsx
│   └── hooks/
│       ├── usePty.ts     # WebSocket connection + PTY state
│       └── useResize.ts  # ResizeObserver + debounced fit
├── shared/
│   └── protocol.ts       # WebSocket message types (TypeScript)
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Pattern 1: PTY Spawn + WebSocket Bridge

**What:** On WebSocket connection, server spawns a node-pty process and pipes data bidirectionally.

**When to use:** Every new terminal session (folder selected).

**Example:**
```typescript
// server/pty-manager.ts
import * as pty from 'node-pty';

export function spawnSession(cwd: string, cols: number, rows: number) {
  const shell = process.env.SHELL || '/bin/bash';
  return pty.spawn('claude', [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      // Ensure PATH includes user's shell PATH so claude is found
    },
  });
}
```

```typescript
// server/ws-handler.ts
wss.on('connection', (ws) => {
  let ptyProcess: pty.IPty | null = null;

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'start') {
      ptyProcess = spawnSession(msg.cwd, msg.cols, msg.rows);
      ptyProcess.onData((data) => ws.send(JSON.stringify({ type: 'data', data })));
      ptyProcess.onExit(() => ws.send(JSON.stringify({ type: 'exit' })));
    }
    if (msg.type === 'input' && ptyProcess) ptyProcess.write(msg.data);
    if (msg.type === 'resize' && ptyProcess) ptyProcess.resize(msg.cols, msg.rows);
  });

  ws.on('close', () => ptyProcess?.kill());
});
```

### Pattern 2: xterm.js Mount + FitAddon with Debounced Resize

**What:** Mount xterm.js Terminal into a DOM element, load WebGL + FitAddon, wire ResizeObserver with debounce.

**When to use:** Terminal component mount in React.

**Example:**
```typescript
// client/components/Terminal.tsx (simplified)
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';

const terminal = new Terminal({ scrollback: 5000 });
const fitAddon = new FitAddon();
const webglAddon = new WebglAddon();

terminal.loadAddon(fitAddon);
terminal.loadAddon(webglAddon);
terminal.open(containerEl);
fitAddon.fit();

// Debounced resize — CRITICAL: without debounce, CSS transitions fire dozens of events
let resizeTimer: ReturnType<typeof setTimeout>;
const observer = new ResizeObserver(() => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    fitAddon.fit();
    ws.send(JSON.stringify({
      type: 'resize',
      cols: terminal.cols,
      rows: terminal.rows,
    }));
  }, 150);
});
observer.observe(containerEl);
```

### Pattern 3: Multiline Composer (Separate from Terminal)

**What:** A `<textarea>` component that sits outside the xterm.js viewport. Enter sends, Shift+Enter adds newline. On send, value is written to PTY via WebSocket.

**When to use:** TERM-03 requirement. Do NOT try to implement this inside xterm.js — it has no native multiline composition concept.

**Example:**
```typescript
// client/components/Composer.tsx
function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [value, setValue] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSend(value + '\n'); // PTY needs trailing newline to execute
        setValue('');
      }
    }
    // Shift+Enter: default textarea behavior inserts newline — no handler needed
  };

  return (
    <textarea
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
    />
  );
}
```

### Pattern 4: Folder Selection

**What:** Use `<input type="file" webkitdirectory>` for folder selection — it returns `FileList` with relative paths. Extract the root path via `webkitRelativePath` split.

**Note:** This returns relative paths inside a sandboxed file access. For a local app, a better approach is a custom Node.js API endpoint that opens a native folder dialog using `open` (macOS) or a headless approach with the Electron shell API — but since this is NOT Electron, use `webkitdirectory` and accept the selected files, then send the full directory path from the backend perspective.

**Practical approach for local app:** Expose a GET `/folders/home` endpoint that returns `process.env.HOME` and subdirectories; user picks from a rendered tree, and the full `cwd` path is always known server-side.

### Anti-Patterns to Avoid

- **Using deprecated `xterm` package:** The old `xterm` and `xterm-*` (non-scoped) packages are frozen. Always use `@xterm/xterm` and `@xterm/*`.
- **Using canvas addon in v6:** `@xterm/addon-canvas` was removed from xterm.js 6.0.0. Use `@xterm/addon-webgl` with DOM as fallback.
- **Calling `fitAddon.fit()` without debounce in ResizeObserver:** During CSS transitions (sidebar expand/collapse), ResizeObserver fires 30-60 times per second. Without debounce, the PTY gets 60 simultaneous resize signals — causes garbled rendering.
- **Implementing multiline input inside xterm.js:** xterm.js doesn't have a multiline composer concept. All characters typed into the terminal go straight to the PTY. The composer must be a separate DOM element.
- **Omitting `TERM=xterm-256color` in PTY env:** Without this, Claude CLI may fall back to a dumb terminal mode with no color/interactive prompts.
- **Spawning PTY without explicit `env: { ...process.env }`:** If `env` is set without spreading `process.env`, PATH is reset to system defaults and `claude` may not be found.
- **Not initializing PTY size from actual terminal dimensions:** Always send `cols` and `rows` from the client's measured container before spawning — never hardcode 80x24.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Terminal emulation | Custom VT100 parser | xterm.js | ANSI escape codes, cursor control, SGR attributes = thousands of edge cases |
| PTY process spawning | `child_process.spawn` + pipe | node-pty | `child_process` doesn't allocate a real PTY; Claude CLI's interactive prompts require a real TTY device |
| WebSocket transport | Raw `net.Socket` | `ws` library | Framing, ping/pong, error handling, spec compliance |
| Copy/paste clipboard | `execCommand` (deprecated) | `@xterm/addon-clipboard` / browser native | Clipboard API is async, requires permissions, varies by browser |
| Resize detection | `window.resize` event | ResizeObserver | `window.resize` doesn't fire for container-level size changes (e.g., sidebar toggle) |
| Debounce utility | Custom timer wrapper | lodash.debounce or inline setTimeout pattern | The inline setTimeout pattern is 5 lines; simple enough to hand-roll |

**Key insight:** The entire PTY stack (PTY allocation, VT100 parsing, terminal rendering) is solved infrastructure. The custom work is UI layout, the folder picker, and the composer component.

---

## Common Pitfalls

### Pitfall 1: PTY size mismatch between xterm.js and node-pty
**What goes wrong:** Terminal renders garbled output, history navigation (up arrow) corrupts the display, cursor jumps to wrong position.
**Why it happens:** xterm.js and the PTY process must agree on `cols` and `rows` at all times. If they differ, the PTY's line-wrapping decisions don't match what xterm.js renders.
**How to avoid:** Always initialize PTY with measured `cols`/`rows` from `fitAddon.propose()` or `terminal.cols`/`terminal.rows` AFTER `fitAddon.fit()`. Send resize events to PTY immediately after every `fit()` call.
**Warning signs:** Text wraps at wrong width; `q` to quit vi shows garbled output.

### Pitfall 2: node-pty PATH inheritance
**What goes wrong:** `claude` command not found when spawned, even though it works in the user's shell.
**Why it happens:** node-pty inherits `process.env` from the Node.js server process, which may have a different PATH than the user's interactive shell (e.g., NVM, Homebrew, pyenv not initialized).
**How to avoid:** Spread `...process.env` in spawn options. Optionally read PATH from a login shell: `const path = execSync('/bin/bash -lc "echo $PATH"').toString().trim()`.
**Warning signs:** `spawn ENOENT` error or "claude: command not found" in terminal.

### Pitfall 3: Resize storm during CSS transitions
**What goes wrong:** Every sidebar toggle or window resize triggers 30-60 resize RPCs to the server, causing cascading terminal redraws.
**Why it happens:** ResizeObserver fires on every animation frame when a CSS transition is running. Without debounce, each callback calls `fitAddon.fit()` and sends a WebSocket message.
**How to avoid:** Debounce the ResizeObserver callback at 150ms. Only send the resize WebSocket message after debounce settles.
**Warning signs:** Terminal flickers during sidebar animations.

### Pitfall 4: xterm.js @xterm/* scoped package confusion
**What goes wrong:** `import { Terminal } from 'xterm'` fails to find types or imports wrong version; addons import from wrong package names.
**Why it happens:** Old `xterm` and `xterm-addon-fit` packages are deprecated and pinned to v5. The `@xterm/xterm` and `@xterm/addon-fit` scoped packages are v6+.
**How to avoid:** Only install `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-webgl` etc. Never mix scoped and unscoped.
**Warning signs:** TypeScript type errors on `Terminal`, addons failing to load.

### Pitfall 5: Ctrl+C ambiguity in the terminal
**What goes wrong:** User presses Ctrl+C expecting to copy text, but it sends SIGINT to Claude CLI instead.
**Why it happens:** Inside the xterm.js terminal element, all keyboard input is captured by the terminal and sent to the PTY. Ctrl+C is the Unix interrupt signal.
**How to avoid:** On macOS, Cmd+C for copy is the standard — and it works. In xterm.js, selection copy uses Cmd+C natively in Chrome/Firefox on Mac. Ctrl+C inside the terminal should remain as SIGINT. For the composer textarea, Cmd+C works normally. Document this clearly in the UI.
**Warning signs:** Users complaining they can't copy.

### Pitfall 6: WebGL renderer fallback
**What goes wrong:** `WebglAddon` fails silently in headless environments or some browsers with WebGL disabled.
**Why it happens:** WebGL may be unavailable (security settings, headless CI, software rendering).
**How to avoid:** Wrap `terminal.loadAddon(webglAddon)` in try/catch; fall back to DOM renderer.
```typescript
try {
  terminal.loadAddon(new WebglAddon());
} catch {
  // DOM renderer used automatically as fallback
}
```

---

## Code Examples

Verified patterns from official sources:

### node-pty spawn (current API)
```typescript
// Source: https://github.com/microsoft/node-pty README
import * as pty from 'node-pty';

const ptyProcess = pty.spawn('/bin/bash', [], {
  name: 'xterm-256color',
  cols: 80,
  rows: 30,
  cwd: '/path/to/project',
  env: { ...process.env, TERM: 'xterm-256color' },
});

ptyProcess.onData((data: string) => {
  // send to WebSocket client
});

ptyProcess.write('ls\r'); // \r not \n for PTY

ptyProcess.resize(120, 40); // propagate from xterm.js
```

### xterm.js terminal mount (v6 API)
```typescript
// Source: https://xtermjs.org/docs/guides/using-addons/
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import '@xterm/xterm/css/xterm.css'; // Required CSS import

const terminal = new Terminal({
  scrollback: 5000,
  theme: {
    background: '#0d1117', // dark mode
  },
});

const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);

try {
  terminal.loadAddon(new WebglAddon());
} catch {
  // falls back to DOM renderer
}

terminal.open(document.getElementById('terminal')!);
fitAddon.fit();
```

### WebSocket server (ws library)
```typescript
// Source: https://github.com/websockets/ws README
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import express from 'express';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    // route by msg.type
  });
  ws.on('error', console.error);
});

server.listen(3000);
```

### Shared message protocol (TypeScript)
```typescript
// shared/protocol.ts
export type ClientMessage =
  | { type: 'start'; cwd: string; cols: number; rows: number }
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'kill' };

export type ServerMessage =
  | { type: 'data'; data: string }
  | { type: 'exit'; code: number }
  | { type: 'error'; message: string };
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `xterm` npm package | `@xterm/xterm` scoped package | v5 (2023) | Must update all imports |
| `xterm-addon-fit` | `@xterm/addon-fit` | v5 (2023) | Same |
| Canvas renderer always bundled | WebGL addon optional, DOM default | v5 (2023) | Smaller bundle; opt-in to faster renderer |
| `@xterm/addon-canvas` | Removed — use `@xterm/addon-webgl` or DOM | v6.0 (Dec 2025) | Do not install canvas addon with v6 |
| `window.resize` for terminal resize | ResizeObserver + FitAddon | 2022+ | Container-level resize events |
| socket.io for terminal WebSocket | `ws` directly | Ongoing | socket.io overhead not needed for single-user |

**Deprecated/outdated:**
- `xterm` package (unscoped): frozen at v5, will not receive updates
- `xterm-addon-*` (unscoped): same — use `@xterm/*`
- `@xterm/addon-canvas`: removed from xterm.js 6.0.0
- `windowsMode` Terminal option: removed in v6
- `fastScrollModifier` Terminal option: removed in v6 (set via keybindings)

---

## Open Questions

1. **Folder picker UX**
   - What we know: `<input webkitdirectory>` works in Chrome/Safari; returns file entries with relative paths
   - What's unclear: Best pattern for extracting the root folder path when the server already knows the filesystem; whether to use a custom REST endpoint returning directory listings
   - Recommendation: Implement a `GET /api/browse?path=` endpoint returning directory contents; render a simple path input + native folder dialog trigger. The server always resolves the absolute path.

2. **Claude CLI executable location**
   - What we know: `claude` must be on PATH when node-pty spawns the process
   - What's unclear: Where the user has Claude CLI installed (npm global, homebrew, custom path)
   - Recommendation: Read PATH from user's login shell on server startup: `execSync('/bin/bash -lc "echo $PATH"').toString().trim()` and inject into PTY env.

3. **Session persistence on WebSocket disconnect**
   - What we know: node-pty process lives on the server independently of the WebSocket connection
   - What's unclear: Whether to kill the PTY on disconnect or keep it alive for reconnect
   - Recommendation: For Phase 1 (single session, single user, local), kill PTY on WebSocket close. Session persistence is a v2 feature (POW-05).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `vitest.config.ts` — Wave 0 creation required |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TERM-01 | Server spawns PTY with correct `cwd` | unit | `npx vitest run tests/pty-manager.test.ts` | Wave 0 |
| TERM-02 | PTY env includes `TERM=xterm-256color` | unit | `npx vitest run tests/pty-manager.test.ts` | Wave 0 |
| TERM-03 | Composer sends value+\n on Enter, adds newline on Shift+Enter | unit (component) | `npx vitest run tests/Composer.test.tsx` | Wave 0 |
| TERM-04 | scrollback option set; copy/paste key behavior | manual-only | N/A — clipboard API requires real browser interaction | manual |
| TERM-05 | Resize message sent with correct cols/rows after debounce | unit | `npx vitest run tests/useResize.test.ts` | Wave 0 |

**TERM-04 is manual-only:** The Clipboard API and actual browser selection behavior cannot be meaningfully tested in a Node.js/jsdom environment. Test this manually in Chrome on macOS: select text in terminal, press Cmd+C, paste elsewhere.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/pty-manager.test.ts tests/Composer.test.tsx tests/useResize.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/pty-manager.test.ts` — covers TERM-01, TERM-02 (mock node-pty, verify spawn options)
- [ ] `tests/Composer.test.tsx` — covers TERM-03 (Enter sends, Shift+Enter newlines, value cleared after send)
- [ ] `tests/useResize.test.ts` — covers TERM-05 (debounce fires once after 150ms, correct cols/rows emitted)
- [ ] `vitest.config.ts` — Vitest configuration
- [ ] Framework install: `npm install -D vitest @testing-library/react @testing-library/user-event jsdom`

---

## Sources

### Primary (HIGH confidence)
- [github.com/microsoft/node-pty](https://github.com/microsoft/node-pty) — spawn API, resize, env options, version 1.1.0
- [xtermjs.org/docs/guides/using-addons/](https://xtermjs.org/docs/guides/using-addons/) — addon loading, @xterm/* package naming
- [github.com/xtermjs/xterm.js releases/6.0.0](https://github.com/xtermjs/xterm.js/releases/tag/6.0.0) — breaking changes (canvas removed, viewport redesign, alt key handling)
- [github.com/websockets/ws](https://github.com/websockets/ws) — WebSocket server API

### Secondary (MEDIUM confidence)
- [saisandeepvaddi.com/blog/how-to-create-web-based-terminals](https://saisandeepvaddi.com/blog/how-to-create-web-based-terminals) — end-to-end architecture pattern
- [npmjs.com/package/@xterm/addon-fit](https://www.npmjs.com/package/@xterm/addon-fit) — FitAddon version 0.11.0 confirmed
- [npmjs.com/package/@xterm/addon-webgl](https://www.npmjs.com/package/@xterm/addon-webgl) — WebGL addon version 0.19.0 confirmed
- [github.com/xtermjs/xterm.js/issues/5320](https://github.com/xtermjs/xterm.js/issues/5320) — FitAddon resize pitfalls documented

### Tertiary (LOW confidence — needs validation)
- Various GitHub issues on xterm.js resize/reflow — general guidance, not version-pinned

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified via npm registry, official docs, and GitHub releases
- Architecture: HIGH — standard pattern documented across multiple authoritative sources
- Pitfalls: HIGH (canvas removal, package naming) / MEDIUM (PATH inheritance, resize debounce) — cross-referenced with issues

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (xterm.js moving quickly; re-check addon versions before installing)
