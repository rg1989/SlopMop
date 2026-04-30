# Pitfalls Research

**Domain:** Browser-based terminal emulator with PTY backend, WebSocket transport, TTS, and file explorer
**Researched:** 2026-04-30
**Confidence:** HIGH (established domain with well-documented failure modes)

## Critical Pitfalls

### Pitfall 1: PTY Resize Never Wired to Terminal

**What goes wrong:**
The xterm.js terminal renders at one size in the browser, but the PTY process on the server has a different size (or the default 80x24). Line-wrapping breaks. Long command output gets truncated. Claude CLI responses that use terminal width for formatting (progress bars, tables, wrapped text) render incorrectly. Interactive prompts like vim, less, and fzf are visually corrupt.

**Why it happens:**
Developers connect data flow (input/output pipes over WebSocket) first and treat resize as a polish step. It's not obvious that the PTY has its own dimensions separate from what xterm.js displays. The default 80x24 works well enough on a small test that the bug goes unnoticed until trying something that uses full width.

**How to avoid:**
Wire resize from day one. In xterm.js, attach a `ResizeObserver` (or use the `FitAddon`) to fire `terminal.onResize`. On resize, send a WebSocket message `{type: 'resize', cols, rows}` to the server. Server calls `pty.resize(cols, rows)` on the node-pty instance. Do this in the same phase as initial PTY connection — never separate.

**Warning signs:**
- Bash prompt wraps at column 80 even when the window is wider
- `stty size` in the terminal returns wrong dimensions
- `less` or `man` pages don't fill the screen
- Claude CLI response formatting looks truncated or double-wrapped

**Phase to address:**
Phase 1 (PTY + WebSocket core) — resize must be part of the initial connection contract, not added later.

---

### Pitfall 2: WebSocket Reconnect Orphans the PTY Process

**What goes wrong:**
When the browser tab refreshes or the WebSocket drops temporarily, a new WebSocket connection is created but the old PTY process is still running on the server (with its own state, running commands, stdin buffer). The new connection spawns a second PTY, leaving the first orphaned — burning CPU/memory and holding the working directory lock. On reconnect, the user gets a fresh shell instead of resuming their session.

**Why it happens:**
WebSocket lifecycle and PTY lifecycle are conflated. Developers assume one connection = one PTY and forget that browsers reconnect, tabs duplicate, and networks hiccup.

**How to avoid:**
Use a session ID (UUID) generated server-side and stored in `sessionStorage` (not `localStorage` — tabs should be independent). On reconnect, the client sends its session ID; the server looks up the existing PTY for that session and reattaches the WebSocket. Implement a TTL: if no reconnect within N seconds (e.g., 30s), kill the PTY and clean up. Since this is single-user, a simpler approach works: maintain one global PTY on the server, and reconnecting clients just re-subscribe to its output stream.

**Warning signs:**
- `ps aux | grep pty` or `ps aux | grep node` shows growing process count after page refreshes
- User sees a fresh shell prompt after network hiccup instead of continuing their session
- Two WebSocket connections arrive at the server simultaneously

**Phase to address:**
Phase 1 (PTY + WebSocket core) — session identity must be part of the initial design, not retrofitted.

---

### Pitfall 3: xterm.js FitAddon Timing Race on Mount

**What goes wrong:**
`FitAddon.fit()` is called before the xterm.js container `div` has rendered with its final CSS dimensions. The terminal initializes at 0x0 or a wrong size. On first load the terminal is blank or has incorrect column count. The PTY receives a resize of (0, 0) or garbage dimensions, which can crash node-pty.

**Why it happens:**
`FitAddon.fit()` reads `offsetWidth`/`offsetHeight` of the container. If called synchronously after `terminal.open(element)`, the browser layout may not have flushed. CSS transitions, flexbox layout settling, and sidebar animations all defer final dimensions.

**How to avoid:**
Call `FitAddon.fit()` inside a `requestAnimationFrame` callback (or a `setTimeout(0)` after `terminal.open()`). Additionally, attach a `ResizeObserver` to the container element so any future layout changes (sidebar toggle, window resize) trigger a re-fit. Guard against 0-dimension fits: `if (cols > 0 && rows > 0) pty.resize(cols, rows)`.

**Warning signs:**
- Terminal appears blank on first load but works after window resize
- `node-pty` throws on startup with invalid dimension errors
- `terminal.cols` returns 0 immediately after open

**Phase to address:**
Phase 1 (terminal rendering) — must be handled in the initial xterm.js setup code.

---

### Pitfall 4: Binary/Control Sequence Data Mangled Through JSON WebSocket

**What goes wrong:**
PTY output includes ANSI escape sequences, sometimes non-UTF8 bytes (box-drawing characters in some locales, binary data from programs like `xxd`), and null bytes. If the server sends PTY output as a JSON string field (`{type: "data", payload: "..."}`) and does naive string concatenation or JSON.stringify on raw Buffer data, Unicode replacement characters appear, ANSI sequences get corrupted, and xterm.js renders garbage or crashes.

**Why it happens:**
Node.js Buffers and JavaScript strings have different semantics. `buffer.toString()` defaults to UTF-8 and silently replaces invalid sequences. Developers prototype with simple text and only discover the issue with programs that output control sequences or box-drawing characters.

**How to avoid:**
Use a binary WebSocket frame for PTY data. Set `ws.binaryType = 'arraybuffer'` on the client. On the server, send PTY data as `Buffer` directly: `ws.send(data)` where `data` is the raw Buffer from node-pty's `data` event. On the client, receive as `ArrayBuffer` and write to xterm.js using `terminal.write(new Uint8Array(event.data))`. For control messages (resize, session ID), use a separate JSON channel or prefix bytes to distinguish message types.

**Warning signs:**
- Box-drawing characters in terminal output appear as `?` or `â`
- ANSI color codes show as literal `[0;32m` text instead of colors
- `cat` of a binary file causes xterm.js to freeze or show replacement characters

**Phase to address:**
Phase 1 (WebSocket data transport) — the transport encoding decision must be made at the start, not changed later.

---

### Pitfall 5: TTS Interruption Leaves Audio Context in Broken State

**What goes wrong:**
When the user interrupts TTS mid-sentence, the implementation calls `speechSynthesis.cancel()` or stops an audio element, but the Web Speech API's `SpeechSynthesis` object enters a broken state on some browsers (particularly Chrome) where subsequent `speak()` calls are silently ignored. The TTS queue fills up, utterances never play, and the UI appears to work (no errors thrown) but produces no audio.

**Why it happens:**
`speechSynthesis.cancel()` has a known Chrome bug where the synthesis engine pauses instead of fully resetting. It was a widely-reported bug for years. The ghost-pepper repo the project references solves this specifically. Developers who implement TTS from scratch without studying ghost-pepper hit this reliably.

**How to avoid:**
Use the ghost-pepper pattern: after `cancel()`, call `speechSynthesis.resume()` followed by a short `setTimeout` before queuing the next utterance. Alternatively, use the chunked audio approach where TTS is done server-side (via a system command or API) and streamed as audio chunks — this avoids Web Speech API state management entirely for the playback side. For interruption, maintain an `isPlaying` flag and a queue, drain the queue on interrupt, and always resume after cancel.

**Warning signs:**
- TTS works for the first response but goes silent on second or third
- `speechSynthesis.pending` is `true` but nothing plays
- No errors in console but `onstart` event never fires on subsequent utterances

**Phase to address:**
Phase 3 (TTS feature) — study ghost-pepper implementation before writing any TTS code, not after hitting the bug.

---

### Pitfall 6: File Watcher `chokidar` Firing on Every Temp File Write

**What goes wrong:**
`chokidar` watches the project directory for the "changed files" sidebar feature. Claude CLI, git operations, language servers, and editors write many temporary files (`.git/index.lock`, `__pycache__`, `.DS_Store`, editor swap files). The watcher fires hundreds of events per second during an active Claude CLI session. The server pushes all events to the client, the browser re-renders the file tree on every event, and the UI becomes janky or the WebSocket is flooded with file-change messages.

**Why it happens:**
The naive approach is `chokidar.watch(projectRoot)` with no ignore patterns. Works fine on a small static directory, fails badly in any real project with active tooling.

**How to avoid:**
Configure chokidar with a comprehensive `ignored` list: `.git/**`, `node_modules/**`, `**/__pycache__/**`, `**/*.pyc`, `**/.DS_Store`, `**/*.swp`, `**/*.swo`, `**/*~`. Use `awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }` to debounce rapid successive writes. On the server side, debounce the WebSocket push: collect changes over a 200ms window and send a single batched update. Never send more than one file-tree update per render frame.

**Warning signs:**
- Browser CPU spikes during any active Claude CLI operation
- WebSocket message rate jumps to hundreds per second while Claude is running
- File tree flickers constantly during git operations

**Phase to address:**
Phase 2 (file explorer) — debounce and ignore patterns must be in the initial chokidar setup.

---

### Pitfall 7: Web Speech API Transcription Only Works in Chrome/Edge

**What goes wrong:**
`webkitSpeechRecognition` / `SpeechRecognition` is implemented in Chromium browsers only. Firefox has had it behind a flag for years and it remains disabled by default. Safari's implementation is partial and requires user interaction in a specific way. A developer tests in Chrome, ships the feature, and it silently fails (no error, just no recognition) in Firefox and some Safari versions.

**Why it happens:**
The Web Speech API spec is not fully implemented across browsers. MDN marks it as "non-standard" for the recognition side. Developers assume modern API availability implies cross-browser support.

**How to avoid:**
Since this is a personal tool (macOS, likely Chrome or Safari), document the browser requirement explicitly. Add a feature-detection guard at startup: `if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window))` show a clear message. As a fallback, have whisper.js ready as an alternative transcription path — it runs in-browser via WASM and works in all browsers. Given the ghost-pepper context (also a local web tool), Chrome/Edge is a reasonable baseline, but the guard prevents silent failures.

**Warning signs:**
- No error thrown but microphone never activates
- `SpeechRecognition` is `undefined` in the console
- Works in Chrome dev tools but not when opened in another browser

**Phase to address:**
Phase 3 (voice input) — browser capability check on feature initialization.

---

### Pitfall 8: node-pty Shell Environment Not Inheriting Correct PATH

**What goes wrong:**
`node-pty` spawns the shell, but the PATH and environment available to the PTY process differs from what a normal terminal session has. Specifically, tools installed via `nvm`, `rbenv`, `pyenv`, `brew`, or `asdf` are not on the PATH because the PTY doesn't source the user's shell startup files (`.zshrc`, `.bashrc`) correctly. `claude` CLI itself may not be found. The spawned shell works for basic commands but fails for project-specific toolchains.

**Why it happens:**
`node-pty` by default spawns an interactive shell but may not source all profile files depending on how it's invoked. The `env` option passed to `pty.spawn()` captures Node's process environment at server startup, which may not have run `nvm` or Homebrew path setup.

**How to avoid:**
Spawn node-pty with `env: process.env` AND set the shell to the user's actual login shell (`process.env.SHELL || '/bin/zsh'`). Use the `-l` (login) flag when spawning: `pty.spawn(shell, ['-l'], { env: process.env, cwd, cols, rows })`. The login flag causes zsh/bash to source profile files. On macOS, also ensure `HOME` is set in the env. Test by running `which claude` and `echo $PATH` in the spawned PTY immediately after startup.

**Warning signs:**
- `command not found: claude` when typing in the terminal even though `claude` works in a normal terminal
- `nvm`, `rbenv`, or `brew` tools missing from PATH in the PTY
- `echo $PATH` in the PTY shows a shorter path than a normal terminal

**Phase to address:**
Phase 1 (PTY spawning) — shell environment must be validated before any other work.

---

### Pitfall 9: Streaming TTS Starts Before Response is Buffered Enough

**What goes wrong:**
The implementation watches Claude CLI stdout and starts TTS as soon as the first sentence arrives. But Claude's output is streamed token-by-token, and sentence boundaries are ambiguous mid-stream. TTS starts speaking "The answer is" then pauses while waiting for more tokens, creating an unnatural choppy speech pattern. Worse, the TTS engine may cut off mid-word if the next chunk arrives before the utterance finishes.

**Why it happens:**
Streaming output is read at the token level. Naive implementations pipe every chunk to TTS without any buffering or sentence detection logic.

**How to avoid:**
Buffer PTY output and split on sentence boundaries (`. `, `? `, `! `, newline followed by a non-continuation character). Only enqueue a TTS utterance when a complete sentence is detected. Implement a timeout fallback: if no sentence boundary is seen within N characters (e.g., 200), flush whatever is buffered. The ghost-pepper repo handles this — study its buffering logic directly. Do not start TTS on the first token; wait for the first sentence boundary.

**Warning signs:**
- TTS reads partial words or awkward sentence fragments
- Speech pauses between words for 100-500ms while more tokens arrive
- Claude's "thinking" tokens (if any) are spoken aloud

**Phase to address:**
Phase 3 (TTS feature) — sentence buffering logic is a prerequisite for any TTS implementation.

---

### Pitfall 10: File Attachment @path Injection via Unsanitized Input

**What goes wrong:**
The file attachment feature constructs a Claude CLI command like `claude @/path/to/file "user message"`. If the path is taken from user input or the file picker without sanitization, a crafted path like `@/etc/passwd` or a filename containing shell metacharacters could inject arbitrary arguments or read sensitive files. Even in a single-user local tool, this is a real risk if the app is accessible on the local network.

**Why it happens:**
Local tools are assumed safe because "it's just me." Developers skip path validation and pass user-controlled strings directly into CLI argument construction.

**How to avoid:**
Always resolve file paths to absolute paths using `path.resolve()` and verify they are within the user-selected project directory using `path.relative()` — reject paths that start with `..`. Sanitize filenames: strip or reject shell metacharacters (`$`, `` ` ``, `\`, `"`, `'`, `;`, `&`, `|`). Use argument arrays rather than string concatenation when spawning processes: `pty.write(`@${sanitizedPath} `)` is safer than string interpolation into a shell command.

**Warning signs:**
- File picker allows selecting files outside the project root
- @path arguments are constructed with string concatenation from raw input
- No path validation between UI selection and CLI invocation

**Phase to address:**
Phase 2 (file attachment feature) — validation logic must be in the path-to-CLI-arg translation layer.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single global PTY (no session IDs) | Simpler server code | Can't survive page refresh; reconnect always starts new shell | Acceptable for MVP since this is single-user |
| JSON string for PTY data instead of binary frames | Easier to debug | ANSI/binary corruption in edge cases | Never — binary frames from day one cost nothing |
| No chokidar ignore patterns | Faster to write | CPU thrashing, WebSocket flood in any active project | Never — 5 lines of ignore config prevents this |
| `speechSynthesis` without cancel/resume guard | Works in happy path | Silent TTS failures after first interruption | Never — the guard is 3 lines of code |
| Spawn PTY without `-l` login flag | Works for basic commands | `claude` CLI not found, nvm/brew tools missing | Never — the flag costs nothing |
| FitAddon.fit() without ResizeObserver | Terminal sizes correctly on load | Terminal breaks when sidebar toggles or window resizes | Never — ResizeObserver is a 5-line addition |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| node-pty + WebSocket | Sending PTY Buffer as JSON string field | Send raw Buffer as binary WebSocket frame; receive as Uint8Array |
| xterm.js FitAddon | Calling fit() synchronously after open() | Call fit() in requestAnimationFrame; attach ResizeObserver for subsequent resizes |
| Web Speech API | Calling speechSynthesis.speak() immediately after cancel() | Call cancel(), then resume(), then setTimeout before next speak() |
| chokidar + git repo | Watching entire project root without ignores | Ignore .git/**, node_modules/**, temp files; debounce push to client |
| node-pty shell spawn | Using `process.env.SHELL` without `-l` flag | Spawn with login flag: `pty.spawn(shell, ['-l'], {env: process.env})` |
| ghost-pepper TTS | Implementing TTS from scratch | Read ghost-pepper source first; it solves buffering + interruption + Chrome bugs |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| File tree re-render on every chokidar event | UI jank during any git/Claude operation | Debounce file-change WebSocket push to 200ms batch window | Immediately on first active Claude session |
| Sending every PTY output chunk to TTS buffer individually | Token-by-token speech, pauses between words | Buffer to sentence boundary before enqueuing TTS | As soon as Claude streams a response |
| No ResizeObserver on xterm.js container | Terminal breaks on every sidebar toggle | Attach ResizeObserver from day one | First time user toggles sidebar |
| Streaming file tree diffs on every keystroke | WebSocket saturation during typing | Debounce git diff calls; only diff on file save events | Large repos with many changed files |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Passing unsanitized file paths to CLI @path args | Path traversal: read /etc/passwd or other sensitive files | Resolve to absolute path, verify within project root, reject `..` |
| No bind address restriction on server | App accessible to anyone on local network | Bind to `127.0.0.1` explicitly, never `0.0.0.0` |
| Executing user-typed commands via shell string | Shell injection via metacharacters in filenames | Use argv arrays, not shell string interpolation |
| Logging PTY output to server-side file | Sensitive data (API keys, passwords) persisted to disk | Never log PTY data; it's the user's terminal |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| TTS reads code blocks verbatim | "backtick backtick backtick javascript backtick backtick backtick" | Strip or skip code fences and inline code from TTS queue |
| No visual indicator when TTS is reading | User doesn't know if TTS is active or stuck | Show an animated waveform or "reading..." indicator tied to utterance onstart/onend |
| Terminal loses focus after clicking file explorer | User types into the void; keys don't go to terminal | Re-focus terminal after file tree interactions; use a focus manager |
| File attachment preview shows path not filename | User can't tell which files are attached | Show basename in preview chip; show full path in tooltip |
| Voice input button with no hold-to-record affordance | User clicks, nothing obvious happens, clicks again | Clear push-to-talk or toggle-to-record state with visual feedback |
| Sidebar "changed files" toggle shows nothing on clean repo | User thinks feature is broken | Show empty state message: "No changed files — working tree is clean" |

## "Looks Done But Isn't" Checklist

- [ ] **PTY resize:** Works on load — verify that resizing the browser window OR toggling the sidebar correctly resizes the PTY (run `stty size` in terminal after each)
- [ ] **WebSocket reconnect:** Looks connected — verify that a page refresh reattaches to the existing PTY session rather than spawning a new shell (check process count)
- [ ] **TTS interruption:** First response reads aloud — verify that interrupting and then asking a second question produces TTS for the second response (not silence)
- [ ] **PATH in PTY:** Terminal opens — verify `which claude`, `which node`, and any nvm/brew tools are all found in the PTY shell
- [ ] **File watcher:** Sidebar shows files — verify that running `git checkout` or a large file operation does not cause CPU spike or UI freeze
- [ ] **Voice input:** Transcription works in Chrome — verify feature-detection gracefully handles Firefox (shows message, doesn't crash)
- [ ] **File attachment:** @path works for valid files — verify that selecting a file outside the project root is rejected, not passed through

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Binary data mangled in JSON transport | HIGH | Refactor entire WebSocket message protocol; all message handling code must change |
| PTY session orphaning | MEDIUM | Add session ID and reattach logic; test with network simulation tools |
| TTS Chrome broken-state bug | LOW | Add cancel/resume guard; 3-line fix once the bug is identified |
| Chokidar event flood | LOW | Add ignore patterns and debounce; minimal refactor |
| Shell PATH missing tools | LOW | Add `-l` login flag to pty.spawn(); test immediately |
| FitAddon timing race | LOW | Wrap fit() in requestAnimationFrame; 2-line fix |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| PTY resize not wired | Phase 1: PTY + WebSocket | Run `stty size` in terminal after browser resize |
| WebSocket reconnect orphans PTY | Phase 1: PTY + WebSocket | Page-refresh test; check `ps` for orphan processes |
| xterm.js FitAddon timing race | Phase 1: Terminal rendering | Open app; check terminal dimensions immediately on load |
| Binary data mangled via JSON | Phase 1: WebSocket transport | Run `ls --color` and verify ANSI colors render; run `cat` on a binary file |
| Shell PATH missing tools | Phase 1: PTY spawn setup | Run `which claude` and `echo $PATH` in PTY |
| File watcher event flood | Phase 2: File explorer | Run `git checkout main` in watched project; check CPU |
| File attachment path injection | Phase 2: File attachment | Attempt to attach a file outside project root; verify rejection |
| TTS Chrome broken state | Phase 3: TTS implementation | Interrupt TTS 3 times consecutively; verify 4th response still reads aloud |
| TTS streaming before sentence buffered | Phase 3: TTS implementation | Observe speech cadence on a long Claude response |
| Web Speech API browser compat | Phase 3: Voice input | Open app in Firefox; verify graceful fallback message |

## Sources

- xterm.js GitHub issues: known FitAddon timing bugs (#2523, #3430 and related)
- node-pty README: login shell and environment setup guidance
- Chrome Bug Tracker: speechSynthesis.cancel() leaves synthesis in broken state (crbug.com/481065, years-long known issue)
- ghost-pepper repo (https://github.com/matthartman/ghost-pepper): proven TTS interruption and buffering patterns
- chokidar documentation: awaitWriteFinish and ignored options
- MDN Web Speech API: browser compatibility table (SpeechRecognition marked experimental/non-standard)
- WebSocket spec: binary frame types for ArrayBuffer/Blob transport
- Training knowledge: HIGH confidence — these are well-documented pitfalls with years of community reports

---
*Pitfalls research for: browser-based terminal emulator (xterm.js + node-pty + WebSocket + TTS)*
*Researched: 2026-04-30*
