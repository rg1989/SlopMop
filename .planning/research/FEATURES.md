# Feature Research

**Domain:** Browser-based AI CLI wrapper (terminal emulator + file explorer + voice I/O)
**Researched:** 2026-04-30
**Confidence:** MEDIUM — Based on training knowledge of xterm.js, web IDEs (VSCode Web, Replit, StackBlitz, CodeSandbox, Theia), and AI chat interfaces (Claude.ai, ChatGPT, Cursor, Warp). Web research unavailable this session; claims are drawn from well-documented ecosystem knowledge through August 2025.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Full ANSI color + escape sequence rendering | Every real terminal renders color; Claude CLI outputs rich color, spinners, progress bars | LOW | xterm.js handles this natively — non-negotiable |
| Scrollback buffer with mouse scroll | Users need to read past output | LOW | xterm.js scrollback addon; configure buffer size (10k+ lines) |
| Text selection + copy in terminal | Universal expectation in any terminal | LOW | xterm.js SelectionAddon; Ctrl+C conflict requires careful keybinding |
| Keyboard shortcut passthrough | Terminal shortcuts (Ctrl+C, Ctrl+D, arrow keys, Tab) must reach PTY | MEDIUM | Intercept browser defaults carefully; Ctrl+W (close tab) is a common conflict |
| Responsive resize (terminal reflows on window resize) | Split panes, window resize should not break line wrapping | MEDIUM | node-pty `resize()` + xterm.js `fit` addon; must debounce |
| Paste multiline text into terminal | Core workflow for sending messages | LOW | Works natively with PTY; no special handling needed |
| File tree shows real directory structure | Users expect hierarchical nav like any IDE | LOW | Standard recursive directory read; gitignore filtering expected |
| File tree updates on disk changes | Files created by Claude appear without manual refresh | MEDIUM | `chokidar` or `fs.watch`; debounce rapid events |
| Click file to preview | Users expect to see file content on click | LOW | Simple read + syntax highlight; not a full editor |
| Clear visual loading/busy state | Users need to know when Claude is processing | LOW | Track PTY output activity or use a "thinking" indicator |
| Dark mode | Developer tools are dark by default; light mode feels wrong | LOW | Dark-mode-first means this is just the default theme |
| Monospace font rendering | Terminal text must use monospace | LOW | JetBrains Mono, Fira Code, or Cascadia Code are premium choices |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but widely valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| VSCode-style "Changes Only" file tree toggle | Surfaces exactly what Claude modified — eliminates hunting through large trees | MEDIUM | `git diff --name-only` + git status; requires git repo; show M/A/D badges |
| File attachment with inline preview before send | Mirrors Claude.ai UX; far better than typing `@path` manually | MEDIUM | Drag-and-drop + file picker; image thumbnail, text preview, binary badge |
| Voice-to-text input | Hands-free input for dictating long prompts; reduces friction | MEDIUM | Web Speech API (zero deps, real-time) or Whisper.js (offline, higher quality); browser mic permission required |
| TTS read-aloud with streaming + interruption | Unique in CLI wrappers; lets users listen while doing other things | HIGH | Ghost-pepper pattern: stream text tokens → sentence-chunk → queue AudioContext segments; interruption requires cancel + drain |
| Mid-speech interruption (speak to interrupt) | The single hardest and most impressive voice feature | HIGH | Requires VAD (voice activity detection) while TTS is playing; ghost-pepper has solved this |
| Git diff badges on files (M/A/D/?) | Visual diff status in file tree matches VSCode behavior | LOW | Cheap to add once git integration exists; high perceived quality |
| Syntax highlighting in file preview | Makes file preview feel premium vs plain text | LOW | Shiki or highlight.js; map extension to language |
| Sticky "last command" header | Keeps context of what prompt was sent visible during long responses | LOW | Track last user input; pin to top of terminal output area |
| Keyboard shortcut to focus voice input | Power user shortcut (e.g., Cmd+Shift+V) to start recording without mouse | LOW | Single hotkey listener; high UX value for power users |
| Token / cost display (if available via API) | Developers want to monitor usage; rare in CLI wrappers | MEDIUM | Claude CLI may not expose token counts directly; depends on CLI output parsing |
| Command palette (Cmd+K) | Premium feel; quick access to toggle modes, clear terminal, etc. | MEDIUM | cmdk-style overlay; Linear/VSCode pattern; makes app feel "pro" |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full code editor (editable files) | "Why not edit files in the UI?" | Duplicates VSCode; massive scope; conflicts with letting Claude edit files | File preview only; link to open in external editor |
| Multi-session / tabbed terminals | Power users want multiple Claude instances | Multiplies state complexity; node-pty sessions multiply; v1 validation scope expands | Single session; defer tabs to v2 |
| Chat history / conversation replay | "Show me past conversations" | Claude CLI manages its own context/history; reimplementing creates sync problems | Rely on Claude CLI's built-in context; filesystem is the history |
| Custom system prompts via UI | "Let me configure Claude's behavior" | Claude CLI accepts flags; reimplementing in UI adds surface area without value in v1 | Pass-through CLI flags; defer to v1.x |
| Integrated diff viewer (full git UI) | Seems natural with file tree | Full diff viewer = build a git client; high complexity, low leverage | Show changed files; let Claude describe changes in terminal |
| Real-time collaborative editing | "Share my session" | Single-user personal tool; auth complexity; out of scope by definition | Screensharing is sufficient |
| Plugin / extension system | "Make it extensible" | Massive architecture investment; premature before v1 validates | Build it right first; extensions are a v3 concern |
| Auto-suggest / autocomplete in terminal | Tab completion | PTY already handles this natively via the shell/Claude CLI; browser-side autocomplete would conflict | Let PTY handle it — don't intercept |

---

## Feature Dependencies

```
[PTY Backend (node-pty)]
    └──required by──> [Terminal Rendering (xterm.js)]
                          └──required by──> [Keyboard Shortcut Passthrough]
                          └──required by──> [Terminal Resize]
                          └──required by──> [Scrollback + Copy]

[File System Access (Node.js fs)]
    └──required by──> [File Tree Display]
                          └──enhanced by──> [Git Integration]
                                               └──enables──> [Changes Only Toggle]
                                               └──enables──> [Git Diff Badges]

[File Tree Display]
    └──required by──> [File Attachment (path selection)]
                          └──required by──> [Attachment Preview]

[Voice Input (mic permission)]
    └──required by──> [Web Speech API / Whisper.js transcription]
                          └──feeds into──> [Message Send to PTY]

[TTS Engine (AudioContext / ghost-pepper)]
    └──required by──> [Streaming Read-Aloud]
                          └──required by──> [Mid-Speech Interruption]
                          └──requires──> [VAD (Voice Activity Detection)]

[Message Input Box]
    └──required by──> [File Attachment UI]
    └──required by──> [Voice Input Trigger]
    └──feeds into──> [PTY stdin]
```

### Dependency Notes

- **Terminal resize requires both xterm.js fit addon AND node-pty resize():** They must stay in sync; handle window resize events on frontend and propagate to backend via WebSocket.
- **Changes Only toggle requires git integration:** If the project folder is not a git repo, this toggle must gracefully degrade to "show all files."
- **Mid-speech interruption requires VAD while TTS is playing:** This is the hardest feature. VAD (e.g., `@ricky0123/vad-web`) must run continuously in a separate audio worklet while TTS AudioContext is active. Ghost-pepper has demonstrated this pattern works.
- **File attachment path injection requires knowing the working directory:** The backend must track the PTY's cwd to resolve relative paths correctly when constructing `@path` args.
- **Voice input and TTS are independent features** but should not activate simultaneously — TTS playback should pause or duck when voice recording starts.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] PTY terminal in browser (xterm.js + node-pty + WebSocket) — core product; everything else is decoration without this
- [ ] Terminal resize + scrollback + copy — table stakes; bad experience without them
- [ ] Folder picker → opens Claude CLI in that directory — the primary user action
- [ ] Multiline message input with send — required for practical use (Claude prompts are rarely one-liners)
- [ ] File tree sidebar (all files view) — required for file attachment UX to work
- [ ] File attachment with path injection (@path syntax) — core differentiator; validates "files at your fingertips" value prop
- [ ] Attachment preview (images as thumbnails, text as snippet) — low complexity, high perceived quality
- [ ] Changes Only toggle (git diff file list) — high value, medium complexity, differentiates from raw terminal immediately
- [ ] Voice-to-text input — validates voice workflow; Web Speech API is low-effort first pass
- [ ] TTS read-aloud with mid-speech interruption — the "wow" feature; validates the ghost-pepper approach

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Command palette (Cmd+K) — add when there are enough toggleable features to justify it
- [ ] Syntax highlighting in file preview — after file preview is confirmed useful
- [ ] Git diff badges (M/A/D) in file tree — after Changes Only toggle is validated
- [ ] Keyboard shortcut to trigger voice input — after voice workflow is confirmed useful
- [ ] Whisper.js upgrade for voice input — if Web Speech API quality proves insufficient

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Multi-session / tabbed terminals — defer; adds significant state complexity
- [ ] Token / cost display — defer; requires Claude CLI output parsing which may be fragile
- [ ] Command palette with plugin-style extensibility — defer; premature

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| PTY terminal (xterm.js + node-pty) | HIGH | MEDIUM | P1 |
| Scrollback + copy + resize | HIGH | LOW | P1 |
| Folder picker → Claude CLI session | HIGH | LOW | P1 |
| Multiline message input | HIGH | LOW | P1 |
| File tree display | HIGH | LOW | P1 |
| File attachment + path injection | HIGH | MEDIUM | P1 |
| Attachment preview (image/text) | MEDIUM | LOW | P1 |
| Changes Only toggle (git diff) | HIGH | MEDIUM | P1 |
| Voice-to-text input | HIGH | MEDIUM | P1 |
| TTS read-aloud + interruption | HIGH | HIGH | P1 |
| Git diff badges in file tree | MEDIUM | LOW | P2 |
| Syntax highlighting in file preview | MEDIUM | LOW | P2 |
| Command palette (Cmd+K) | MEDIUM | MEDIUM | P2 |
| Whisper.js voice upgrade | MEDIUM | MEDIUM | P2 |
| Token / cost display | LOW | MEDIUM | P3 |
| Multi-session tabs | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Warp (native terminal AI) | Replit / StackBlitz (browser IDE) | Claude.ai (web chat) | Our Approach |
|---------|--------------------------|-----------------------------------|----------------------|--------------|
| Terminal rendering | Native OS, not browser | xterm.js or CodeMirror terminal | None | xterm.js + node-pty — full PTY fidelity |
| File explorer | None | Full editor sidebar | Attachment picker only | VSCode-style sidebar with Changes Only toggle |
| File attachment | None | Full editor context | Drag-and-drop, multi-file | Drag-and-drop → @path injection |
| Voice input | None | None | None (as of 2025) | Web Speech API / Whisper.js |
| TTS output | None | None | None | Ghost-pepper streaming TTS with interruption |
| AI integration | AI completions in terminal | AI coding assistant | Full LLM chat | Claude CLI as backend — no API key needed |
| Design aesthetic | Dark, premium, native | Web-native, colorful | Clean, minimal | VSCode/Linear dark — premium developer aesthetic |

Key observation: No existing tool combines all five (PTY terminal + file explorer with git diff + file attachments + voice in + TTS out). This is genuinely unoccupied space.

---

## Sources

- xterm.js documentation and addon list (training knowledge, HIGH confidence through Aug 2025)
- node-pty README and resize API (training knowledge, HIGH confidence)
- Ghost-pepper repo (https://github.com/matthartman/ghost-pepper) — referenced in PROJECT.md for TTS interruption pattern
- Web Speech API MDN spec (HIGH confidence — stable, broadly supported in Chrome/Safari/Edge)
- Warp terminal, Replit, StackBlitz, CodeSandbox, VSCode Web feature sets (MEDIUM confidence — training knowledge, may have evolved)
- Claude.ai file attachment UX (MEDIUM confidence — known through Aug 2025; may have changed)
- @ricky0123/vad-web for VAD in browser (MEDIUM confidence — active library as of training cutoff)

**Confidence notes:**
- PTY + xterm.js feature set: HIGH — stable, well-documented, very unlikely to have changed fundamentally
- Web Speech API browser support: HIGH — long-stable Web API
- Ghost-pepper TTS interruption approach: MEDIUM — referenced in PROJECT.md, assumes repo is current
- Competitor feature sets (Warp, Replit, etc.): MEDIUM — correct as of Aug 2025, may have evolved
- Token cost display via Claude CLI output: LOW — CLI output format subject to change; needs verification

---

*Feature research for: Browser-based Claude CLI wrapper (ClaudeTalk)*
*Researched: 2026-04-30*
