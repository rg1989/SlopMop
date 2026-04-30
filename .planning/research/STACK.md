# Stack Research

**Domain:** Browser-based AI CLI wrapper (PTY terminal + voice I/O + file explorer)
**Researched:** 2026-04-30
**Confidence:** MEDIUM-HIGH — xterm.js/node-pty ecosystem is stable and well-documented through training cutoff (Aug 2025). Voice/TTS stack is evolving but patterns are established. Versions listed are latest stable as of training cutoff; verify before pinning.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 20 LTS | Backend runtime | node-pty requires native addons; Node 20 LTS has the stability + native addon tooling. Avoid 22+ until node-pty confirms support. |
| xterm.js | ^5.3 | Browser terminal renderer | The standard for browser PTY rendering. Powers VSCode's integrated terminal, Theia, StackBlitz, Replit. Version 5 is a major rewrite with addon system; 4.x is legacy. |
| node-pty | ^1.0 | PTY process spawning on Node backend | Only battle-tested PTY library for Node.js. Spawns Claude CLI in a real pseudoterminal — ANSI, interactive prompts, resize signals all work correctly. Required for real terminal fidelity. |
| React | ^18.3 | Frontend UI framework | Component model maps cleanly to terminal pane + sidebar + input bar. React 18 concurrent mode handles streaming TTS state updates without jank. |
| Vite | ^5.2 | Frontend build tool + dev server | Zero-config HMR, native ESM, fast cold start. For a local tool with no CI complexity, Vite is far simpler than webpack. |
| Express | ^4.19 | HTTP server for static assets + REST endpoints | Lightweight, widely known, sufficient for single-user local app. Pairs naturally with ws for WebSocket upgrade on same server. |
| ws | ^8.17 | WebSocket server (Node.js) | Low-level but battle-tested. More predictable than socket.io for this use case — no fallback transports, no polling, just raw WebSocket. socket.io overhead is unnecessary for single-user local app. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @xterm/addon-fit | ^0.10 | Resize terminal to fit container | Always — required for proper terminal resize on window/pane resize |
| @xterm/addon-web-links | ^0.11 | Clickable URLs in terminal output | Add in v1 — nearly zero effort, high UX value when Claude outputs URLs |
| @xterm/addon-search | ^0.14 | Ctrl+F search in terminal buffer | Add in v1.x — useful for long sessions |
| @xterm/addon-canvas | ^0.7 | WebGL/Canvas renderer for xterm.js | Use if WebGL renderer addon is unavailable or causes issues; canvas is the fallback |
| @xterm/addon-webgl | ^0.18 | WebGL-accelerated rendering | Use by default — significantly faster than DOM renderer for high-throughput terminal output like Claude's streaming responses |
| chokidar | ^3.6 | File system watcher | Required for live file tree updates when Claude creates/modifies files. More reliable cross-platform than raw `fs.watch`. |
| simple-git | ^3.25 | Git operations from Node.js | Use for "Changes Only" file tree toggle — `git diff --name-only` and `git status` calls. Avoid shelling out to git directly; simple-git handles cwd scoping correctly. |
| @ricky0123/vad-web | ^0.0.19 | Voice Activity Detection (VAD) in browser | Required for mid-speech TTS interruption — detects user speaking while TTS is playing. Uses ONNX Runtime Web under the hood. |
| cmdk | ^1.0 | Command palette component (React) | Use for Cmd+K command palette in v1.x. Best-in-class DX, powers Linear and Vercel's command palettes. |
| shiki | ^1.6 | Syntax highlighting for file preview | Use for file preview pane. Shiki uses real TextMate grammars — VSCode-quality highlighting. Prefer over highlight.js for premium feel. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| TypeScript | ^5.4 | Type safety across frontend + backend | Use strict mode. xterm.js and node-pty have excellent TypeScript types. Catches WebSocket message shape mismatches early. |
| tsx | ^4.x | Run TypeScript Node.js files directly | Use for backend development (`tsx watch server.ts`). Replaces ts-node with faster compilation. |
| eslint + @typescript-eslint | ^8.x / ^7.x | Linting | Standard setup; configure for both browser and Node.js environments (different globals). |
| concurrently | ^8.x | Run frontend and backend dev servers together | `concurrently "vite" "tsx watch src/server/index.ts"` — single `npm run dev` command. |
| electron-rebuild | — | Rebuild node-pty native addon | Only needed if Electron packaging is added later. Not needed for local web server. |

---

## Installation

```bash
# Core backend
npm install express ws node-pty simple-git chokidar

# Core frontend
npm install react react-dom xterm @xterm/addon-fit @xterm/addon-webgl @xterm/addon-web-links

# Voice / TTS
npm install @ricky0123/vad-web

# Supporting UI
npm install cmdk shiki

# Dev dependencies
npm install -D typescript tsx vite @vitejs/plugin-react concurrently eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin @types/node @types/express @types/ws
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| ws (raw WebSocket) | socket.io | Use socket.io if you need reconnection logic, rooms, or broadcast to multiple clients. For single-user local app, ws is sufficient and simpler. |
| Vite | webpack / Create React App | Use webpack if you have complex module federation needs or a large existing webpack config. CRA is deprecated — avoid. |
| simple-git | child_process + git CLI | Use child_process only if simple-git's abstraction causes issues. simple-git handles cwd correctly which matters here. |
| chokidar | fs.watch / fs.watchFile | fs.watch is unreliable on macOS (misses events in some cases). chokidar uses FSEvents on macOS — correct choice. |
| shiki | highlight.js / prism | Use highlight.js if bundle size is a hard constraint. Shiki produces VSCode-quality output but has a larger initial load. |
| @xterm/addon-webgl | DOM renderer (default) | Fall back to DOM renderer if WebGL causes issues on specific machines (some corporate GPU drivers block WebGL). |
| Express | Fastify / Koa | Use Fastify if performance benchmarks matter. For a single-user local tool, Express simplicity wins. |
| @ricky0123/vad-web | WebRTC VAD / custom AudioWorklet | vad-web is the most production-ready browser VAD library as of 2025. Custom AudioWorklet is viable but requires significant audio DSP knowledge. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| socket.io | Adds ~50KB of JS, polling fallback, rooms/namespace complexity — all unnecessary for a single WebSocket connection to a local server | ws (raw WebSocket) |
| xterm.js v4.x | End of active development; v5 has the addon rewrite, better TypeScript types, and is what VSCode uses | xterm.js v5.x |
| node-pty v0.x | Pre-1.0 had significant bugs with resize signals and Windows PTY; v1.0 stabilized the API | node-pty ^1.0 |
| Web Speech API as final voice stack | Requires internet connection (sends audio to Google/OS servers), not available offline, accuracy varies by OS | Web Speech API is fine for v1; upgrade to whisper.js (transformers.js) for offline high-quality transcription in v1.x |
| Web Audio API `SpeechSynthesis` | The browser's built-in TTS (`window.speechSynthesis`) is choppy, cannot stream, has no reliable interruption events, and sounds robotic | Use AudioContext with chunked audio buffers (ghost-pepper pattern) or a local TTS server |
| webpack / CRA | CRA is officially deprecated (unmaintained). webpack config complexity is unnecessary for this app's scale. | Vite |
| Next.js / Remix | Server-side rendering framework overhead is irrelevant for a local single-page app. Adds complexity around API routes vs Express, and node-pty requires a real Node.js server process — Next.js API routes do not support long-lived processes/streams reliably. | Vite + Express |
| Electron (v1) | Adds packaging complexity, code-signing requirements, and native rebuild friction — none of which matter for a local web server. PROJECT.md explicitly defers this. | Local web server (Node.js + browser) |

---

## Stack Patterns by Variant

**For TTS (streaming read-aloud with interruption):**
- Do NOT use `window.speechSynthesis` — it cannot be reliably interrupted and cannot stream
- Use the ghost-pepper pattern: receive text tokens from PTY output → chunk into sentences → encode each sentence as audio → queue AudioContext buffer sources → cancel queued sources on interrupt signal
- VAD runs in a separate AudioWorklet to detect speech while TTS is playing
- `@ricky0123/vad-web` provides the VAD; the audio pipeline is custom AudioContext code

**For voice input (v1 — low friction):**
- Use Web Speech API (`SpeechRecognition`) for v1 — zero dependencies, real-time partial results, works in Chrome/Edge/Safari
- Caveat: requires internet on Chrome (Google servers); Firefox does not support it
- For offline or higher accuracy: use `@xenova/transformers` (transformers.js) with Whisper model — runs fully in-browser via ONNX

**For voice input (v1.x upgrade path):**
- `@xenova/transformers` with `Xenova/whisper-small` model
- First load is ~150MB model download; cached in IndexedDB after that
- Use a Web Worker to run inference off main thread

**For file tree with git integration:**
- Use `simple-git` for `git().status()` and `git().diff(['--name-only', 'HEAD'])`
- Gate git calls on `git().checkIsRepo()` — gracefully degrade if folder is not a git repo
- Debounce chokidar events (100ms) before triggering file tree refresh — Claude can create many files in rapid succession

**For WebSocket message protocol:**
- Define a typed message union (TypeScript discriminated union) for all WebSocket messages early
- At minimum: `{ type: 'terminal:data', data: string }`, `{ type: 'terminal:resize', cols: number, rows: number }`, `{ type: 'terminal:input', data: string }`, `{ type: 'filetree:update', tree: FileNode[] }`, `{ type: 'tts:chunk', text: string }`, `{ type: 'tts:interrupt' }`
- Share this type definition between frontend and backend via a shared `types/` directory

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| node-pty ^1.0 | Node.js 18, 20, 22 | Requires native compilation (`node-gyp`). Node 20 LTS is the safest target. Rebuild required after Node version upgrade. |
| xterm.js ^5.3 | Any modern browser | Requires WebGL support for WebGL addon; falls back gracefully. Works in Chrome, Firefox, Safari, Edge. |
| @xterm/addon-* | Must match xterm.js major version | All `@xterm/addon-*` packages must be on v5-compatible releases. Mixing v4 addons with v5 core breaks. |
| @ricky0123/vad-web | Requires SharedArrayBuffer | Browser must serve pages with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers. Add these to Express static middleware. |
| shiki ^1.x | Node.js 18+ | Shiki v1 is a major rewrite (codenamed `shikiji` merge). API is different from v0.x. Use v1 only. |
| ws ^8.x | Node.js 14+ | No compatibility concerns for Node 20. |
| simple-git ^3.x | Node.js 14+ / git 2.13+ | Most macOS systems have git 2.39+ — no concern. |

---

## Architecture Note: Single-Server vs Separate Processes

For this app, run everything from a single Node.js process:
- Express serves static frontend assets
- Express upgrades `/ws` path to WebSocket (via `ws` `handleProtocols` or `express-ws`)
- node-pty spawns Claude CLI as a child PTY process
- chokidar + simple-git run in the same process

This is simpler than a separate frontend dev server + backend — and for a local personal tool, process isolation provides no benefit.

In dev mode only, use `concurrently` to run Vite (HMR) and `tsx watch` (backend) separately.

---

## Sources

- xterm.js GitHub and official documentation (training knowledge, HIGH confidence — stable ecosystem, well-documented through Aug 2025)
- node-pty GitHub README and issues (training knowledge, HIGH confidence — stable API since v1.0)
- Web Speech API MDN documentation (training knowledge, HIGH confidence — long-stable Web API with known browser support matrix)
- @ricky0123/vad-web npm page and GitHub (training knowledge, MEDIUM confidence — active library as of training cutoff; verify version)
- @xenova/transformers / transformers.js Whisper implementation (training knowledge, MEDIUM confidence — evolving, verify latest model names)
- Ghost-pepper repo referenced in PROJECT.md (https://github.com/matthartman/ghost-pepper) — TTS streaming + interruption pattern (MEDIUM confidence — unable to fetch live; assess when implementing TTS phase)
- Shiki v1 documentation (training knowledge, MEDIUM confidence — v1 is a major rewrite, verify API before use)
- simple-git npm documentation (training knowledge, HIGH confidence — stable, widely used)
- chokidar GitHub (training knowledge, HIGH confidence — de facto standard for Node.js file watching)

**Confidence by area:**
- PTY stack (xterm.js + node-pty + ws): HIGH — industry standard, used by VSCode, StackBlitz, Replit
- Frontend framework (React + Vite): HIGH — dominant standard; no surprises expected
- File system (chokidar + simple-git): HIGH — stable, well-understood APIs
- Voice input (Web Speech API v1 / whisper.js v1.x): MEDIUM — Web Speech API is stable; whisper.js model names and API evolve
- TTS streaming/interruption (ghost-pepper pattern): MEDIUM — pattern is validated by PROJECT.md reference; implementation details need live repo review
- VAD (@ricky0123/vad-web): MEDIUM — active library, COOP/COEP header requirement is a known gotcha

---

*Stack research for: ClaudeTalk — Browser-based Claude CLI wrapper*
*Researched: 2026-04-30*
