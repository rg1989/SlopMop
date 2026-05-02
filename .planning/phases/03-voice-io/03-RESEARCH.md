# Phase 3: Voice I/O - Research

**Researched:** 2026-04-30
**Domain:** Web Speech API (SpeechRecognition + SpeechSynthesis), AudioContext, browser voice UX
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VOICE-01 | User can record a voice message that is transcribed and dropped into the message input composer | Web Speech API SpeechRecognition with `onresult` event; transcript injected into Composer textarea value |
| VOICE-02 | Transcription is triggered by a button press (push-to-talk or start/stop toggle) | `recognition.start()` / `recognition.stop()` called on button click; toggle state managed in `useVoiceInput` hook |
| TTS-01 | User can toggle a TTS mode where agent responses are streamed and read aloud using the AudioContext pattern | Terminal PTY `data` events captured, ANSI stripped, sentence-buffered; `SpeechSynthesis.speak()` per sentence chunk |
| TTS-02 | TTS playback can be stopped at any point via a manual stop button | `speechSynthesis.cancel()` immediately stops + clears queue; button visible when `ttsActive` state is true |
| TTS-03 | User can interrupt TTS mid-sentence by speaking — playback stops and the transcribed speech is sent as a new message | `SpeechRecognition.onstart` triggers `speechSynthesis.cancel()`; final transcript auto-submitted via `sendInput` |
| TTS-04 | TTS and voice input are mutually exclusive — TTS pauses/stops when voice recording starts | Shared `activeModeRef` / state machine: starting voice recording always calls `speechSynthesis.cancel()` first |
</phase_requirements>

---

## Summary

Phase 3 adds voice input and TTS output to SlopMop using exclusively browser-native APIs — no external services, no new npm packages. Voice input uses the **Web Speech API `SpeechRecognition`** interface (available in Chrome/Edge via `window.webkitSpeechRecognition`; partial Safari support). TTS output uses **`window.speechSynthesis`** (broadly supported in all major browsers). Both APIs are zero-install, zero-cost, and work offline for synthesis (recognition requires an internet connection on Chrome's default mode).

The architecture is a client-only feature. The server (Express/WebSocket) does not change. A `useVoiceInput` hook manages the microphone lifecycle; a `useTts` hook manages speech synthesis and listens to PTY data events from `usePty`'s `onData` callback extension. The two hooks coordinate via a shared "active mode" ref so they are mutually exclusive. The Composer and App.tsx wire the hooks into existing UI buttons.

The critical implementation concern is the **Chrome SpeechSynthesis long-text bug**: speech stops silently after ~15 seconds when using Google-provided voices. The mitigation is sentence-level chunking (speak one sentence at a time via the queue) plus avoiding voices whose name starts with "Google ". A secondary concern is **AudioContext autoplay policy**: the `AudioContext` (if used) must be created or resumed after a user gesture — however, since we use `SpeechSynthesis` rather than raw `AudioContext`, this concern is avoided.

**Primary recommendation:** Use `SpeechRecognition` for voice input and `SpeechSynthesis.speak()` (one utterance per sentence) for TTS. Intercept PTY terminal data in `usePty` via a new `onData` callback prop, strip ANSI codes, buffer into sentences, and speak each sentence chunk. Mutual exclusion between modes is enforced in a shared React state.

---

## Standard Stack

### Core (all browser-native, zero new packages)

| API | Availability | Purpose | Why Standard |
|-----|-------------|---------|--------------|
| `window.SpeechRecognition` / `window.webkitSpeechRecognition` | Chrome/Edge (full), Safari 14.1+ (partial) | Voice-to-text transcription | Built into browser; no API key needed; low latency |
| `window.speechSynthesis` | Chrome, Edge, Safari, Firefox | Text-to-speech playback | Universally supported; zero cost; no streaming needed for sentence chunks |
| `SpeechSynthesisUtterance` | Same as speechSynthesis | Represents a single TTS request with voice/rate/pitch | Standard interface for controlling synthesis |

### No New npm Packages Required

The existing stack (React 19, Vite 6, Vitest 3, TypeScript 5.5, jsdom) fully covers Phase 3. No new dependencies are needed.

If Whisper.js local transcription is desired (POW-04, v2 scope), that is a future upgrade path — **not in scope for Phase 3**.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `SpeechRecognition` (browser-native) | `react-speech-recognition` npm package | Package adds React wrapper convenience but adds a dependency; native API is sufficient for this use case |
| `SpeechSynthesis` (browser-native) | OpenAI TTS API / Elevenlabs | External APIs require server proxy, API keys, cost; browser-native is private and free |
| Sentence-chunk speak() | Single large utterance | Chrome stops after ~15s for large utterances; chunking is the established fix |

---

## Architecture Patterns

### Recommended File Structure

```
client/
├── hooks/
│   ├── usePty.ts           # EXISTING — add onData callback prop extension
│   ├── useVoiceInput.ts    # NEW — SpeechRecognition lifecycle
│   └── useTts.ts           # NEW — SpeechSynthesis + PTY data interception
├── components/
│   ├── Composer.tsx        # EXISTING — add mic button; accept transcript injection
│   ├── VoiceButton.tsx     # NEW — mic icon button with active/recording states
│   └── TtsControls.tsx     # NEW — TTS toggle switch + stop button
└── App.tsx                 # EXISTING — wire hooks, pass onData to usePty
```

### Pattern 1: usePty onData Callback Extension

The existing `usePty` hook writes PTY data directly to `terminal.write(msg.data)`. To intercept output for TTS, extend with an optional `onData` callback prop that fires with each raw data string alongside the existing terminal write.

```typescript
// shared/protocol.ts — no change needed
// client/hooks/usePty.ts — add optional callback
interface UsePtyOptions {
  cwd: string | null;
  terminal: Terminal | null;
  cols: number;
  rows: number;
  onData?: (raw: string) => void; // NEW — optional TTS intercept
}

// Inside ws.onmessage handler:
if (msg.type === 'data') {
  terminal.write(msg.data);
  options.onData?.(msg.data); // fire callback without blocking terminal
}
```

This is additive and backward-compatible — no existing behavior changes.

### Pattern 2: ANSI Strip + Sentence Buffer

PTY data contains ANSI escape codes (colors, cursor movement). Strip them before feeding to TTS:

```typescript
// Regex: strip ANSI escape sequences
function stripAnsi(raw: string): string {
  // Source: standard ANSI escape pattern
  return raw.replace(/\x1b\[[0-9;]*[mGKHFABCDJA-Z]/g, '')
            .replace(/\x1b\][^\x07]*\x07/g, '')  // OSC sequences
            .replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, ''); // other controls
}
```

Buffer stripped text, split on sentence terminators (`.`, `!`, `?` followed by space or end of string), speak each complete sentence immediately via `speechSynthesis.speak()`.

```typescript
// Sentence split — speak when sentence is complete
const SENTENCE_END = /[.!?](?:\s|$)/;

function flushSentences(buffer: string, speak: (s: string) => void): string {
  const parts = buffer.split(SENTENCE_END);
  // All parts except last are complete sentences
  for (let i = 0; i < parts.length - 1; i++) {
    if (parts[i].trim()) speak(parts[i].trim());
  }
  return parts[parts.length - 1]; // remainder kept in buffer
}
```

### Pattern 3: SpeechRecognition Toggle Hook

```typescript
// client/hooks/useVoiceInput.ts
export function useVoiceInput(options: {
  onTranscript: (text: string) => void;
  onStart?: () => void; // called when mic opens — used to stop TTS
}) {
  const [recording, setRecording] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);

  const start = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return; // browser not supported
    options.onStart?.(); // stop TTS before mic opens
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false; // final results only
    rec.continuous = false;     // single utterance = simpler stop logic
    rec.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript;
      options.onTranscript(text);
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => setRecording(false);
    rec.start();
    recRef.current = rec;
    setRecording(true);
  }, [options]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    setRecording(false);
  }, []);

  return { recording, start, stop };
}
```

### Pattern 4: SpeechSynthesis TTS Hook

```typescript
// client/hooks/useTts.ts
export function useTts(options: { enabled: boolean }) {
  const [speaking, setSpeaking] = useState(false);
  const bufferRef = useRef('');

  const speak = useCallback((text: string) => {
    if (!options.enabled || !text.trim()) return;
    const u = new SpeechSynthesisUtterance(text);
    // Avoid Google voices — they trigger the 15s Chrome bug
    const voices = speechSynthesis.getVoices();
    const safeVoice = voices.find(v => !v.name.startsWith('Google ') && v.lang.startsWith('en'));
    if (safeVoice) u.voice = safeVoice;
    u.rate = 1.1; // slightly faster is comfortable for responses
    u.onstart = () => setSpeaking(true);
    u.onend = () => { if (!speechSynthesis.speaking) setSpeaking(false); };
    speechSynthesis.speak(u);
  }, [options.enabled]);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    bufferRef.current = '';
    setSpeaking(false);
  }, []);

  // Called by usePty onData callback
  const handleData = useCallback((raw: string) => {
    if (!options.enabled) return;
    const text = stripAnsi(raw);
    bufferRef.current += text;
    bufferRef.current = flushSentences(bufferRef.current, speak);
  }, [options.enabled, speak]);

  return { speaking, speak, stop, handleData };
}
```

### Pattern 5: Mutual Exclusion

Both hooks share a signal via App.tsx:

```typescript
// App.tsx
const tts = useTts({ enabled: ttsEnabled });

const voice = useVoiceInput({
  onTranscript: (text) => {
    // TTS-03: transcript becomes a new message
    setValue(text); // inject into Composer
    // optionally auto-send:
    sendInput(text + '\r');
  },
  onStart: () => {
    // TTS-04: stop TTS when mic opens
    tts.stop();
  }
});
```

### Anti-Patterns to Avoid

- **Single large utterance:** Never pass the entire Claude response as one `SpeechSynthesisUtterance`. Chrome stops after ~15 seconds. Split at sentence boundaries.
- **Creating AudioContext outside user gesture:** If you ever add AudioContext, create it lazily on first button click, not at module load.
- **Relying on `recognition.continuous = true` for push-to-talk:** Single-utterance mode (`continuous: false`) is simpler and more predictable for this use case.
- **Not stripping ANSI before TTS:** Raw PTY data contains escape codes; feeding them to SpeechSynthesis produces garbled spoken output.
- **Checking `speechSynthesis.speaking` inside `onData` to gate playback:** The `speaking` property only indicates current playback state, not whether the queue is healthy. Use the sentence queue approach instead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Speech-to-text transcription | Custom microphone + audio processing pipeline | `SpeechRecognition` API | VAD, language models, streaming — all handled by browser |
| Text-to-speech audio generation | `AudioContext` + PCM generation | `SpeechSynthesis.speak()` | Voice synthesis is handled natively; no audio buffer management needed |
| ANSI escape code stripping | Custom state machine | Simple regex pattern (documented above) | ANSI stripping is a solved 5-line problem; no library needed |
| Voice activity detection | Custom audio level analysis | `SpeechRecognition.onspeechstart` event | Browser fires this event when it detects speech has started |

**Key insight:** Web Speech API handles the hard problems (VAD, acoustic modeling, streaming transcription, voice synthesis, audio device management). The application layer only needs to wire events and manage state.

---

## Common Pitfalls

### Pitfall 1: Chrome SpeechSynthesis 15-second Silent Stop
**What goes wrong:** Long TTS utterances (> ~15 seconds) silently stop mid-word in Chrome. No error event fires. `speechSynthesis.speaking` may still return `true`.
**Why it happens:** Chrome bug (chromium issue #679437, open for years). Affects Google-provided voices especially.
**How to avoid:** Speak one sentence at a time. Avoid voice names starting with "Google ". Keep utterance objects referenced (not garbage-collected) while speaking.
**Warning signs:** TTS stops mid-paragraph with no `onend` event, or `onend` fires too early.

### Pitfall 2: SpeechRecognition Not Available in Firefox
**What goes wrong:** `window.SpeechRecognition` and `window.webkitSpeechRecognition` are both `undefined` in Firefox.
**Why it happens:** Firefox does not implement the SpeechRecognition API.
**How to avoid:** Feature-detect with `const SR = window.SpeechRecognition ?? (window as any).webkitSpeechRecognition`. If `SR` is undefined, disable the microphone button gracefully with a tooltip explaining browser support.
**Warning signs:** `TypeError: SR is not a constructor` in Firefox.

### Pitfall 3: SpeechRecognition Fires `onend` Immediately If Called Twice
**What goes wrong:** Calling `recognition.start()` on an already-running instance throws a `DOMException: already-started`.
**Why it happens:** A new instance must be created each time; the API is single-use.
**How to avoid:** Always create a `new SR()` instance on each `start()` call. Store ref to current instance to call `stop()` on it.

### Pitfall 4: Voices Not Available on Initial Call to `getVoices()`
**What goes wrong:** `speechSynthesis.getVoices()` returns an empty array on first call.
**Why it happens:** Voices load asynchronously. `voiceschanged` event fires when ready.
**How to avoid:** Call `getVoices()` inside `onvoiceschanged` handler, or call lazily when `speak()` is first invoked (voices are ready by then in practice).
**Warning signs:** `u.voice` is set to `undefined`; TTS still works (uses default voice) but voice selection is ineffective.

### Pitfall 5: ANSI Codes Spoken Aloud
**What goes wrong:** PTY data contains sequences like `\x1b[32m` that get spoken as literal characters or garbled sounds.
**Why it happens:** `SpeechSynthesis` receives the raw string including escape codes.
**How to avoid:** Always run `stripAnsi()` on PTY data before passing to TTS buffer.
**Warning signs:** User hears "escape bracket 32 m" or unusual clicking sounds.

### Pitfall 6: TTS Speaking Over Itself
**What goes wrong:** If TTS is enabled and user sends multiple messages quickly, multiple sentence streams pile up in the synthesis queue.
**Why it happens:** `speechSynthesis.speak()` queues utterances — it does not replace.
**How to avoid:** On new message send, call `speechSynthesis.cancel()` before the new response data starts flowing, or gate: only start feeding sentences after the previous stream's end is detected (track with a `sessionId` ref that increments on each send).

---

## Code Examples

### Feature Detection + Recognition Bootstrap

```typescript
// Source: MDN SpeechRecognition docs + standard pattern
const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
if (!SR) {
  // Show disabled mic button with tooltip
  return;
}
const recognition = new SR() as SpeechRecognition;
recognition.lang = 'en-US';
recognition.interimResults = false;
recognition.continuous = false;
```

### SpeechSynthesis Cancel + Speak

```typescript
// Source: MDN SpeechSynthesis docs
function speakSentence(text: string) {
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.1;
  // Safe voice selection (avoid Chrome 15s bug)
  const voices = speechSynthesis.getVoices();
  const safe = voices.find(v => !v.name.startsWith('Google ') && v.lang.startsWith('en'));
  if (safe) u.voice = safe;
  speechSynthesis.speak(u);
}

function stopTts() {
  speechSynthesis.cancel(); // clears queue + stops current utterance immediately
}
```

### Voices Ready Pattern

```typescript
// Source: MDN Using_the_Web_Speech_API
let voices: SpeechSynthesisVoice[] = [];
function loadVoices() {
  voices = speechSynthesis.getVoices();
}
loadVoices();
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = loadVoices;
}
```

### ANSI Strip Regex

```typescript
// Standard ANSI escape sequence pattern
function stripAnsi(raw: string): string {
  return raw
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '')   // CSI sequences (colors, cursor)
    .replace(/\x1b\][^\x07]*\x07/g, '')       // OSC sequences (title changes)
    .replace(/\x1b[^[\]]/g, '')               // other ESC sequences
    .replace(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]/g, ''); // control chars
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single large `SpeechSynthesisUtterance` for full response | Sentence-chunked queue | Chrome bug since ~2017, widely known | Must chunk or synthesis fails at ~15s |
| `AudioContext` manually for TTS | `SpeechSynthesis` for standard voices | Always true; AudioContext TTS only needed for custom audio (OpenAI API audio streams) | Simpler implementation for browser-native voices |
| `react-speech-recognition` wrapper | Raw `SpeechRecognition` API | Library is unmaintained since ~2022 | No library needed for basic push-to-talk |

**Deprecated/outdated:**
- `SpeechRecognition.grammars`: Removed from Web Speech API spec. Setting it has no effect in modern Chrome. Do not use.
- `webkitSpeechRecognition` as sole interface: Now also available as unprefixed `SpeechRecognition` in Chrome 33+. Use `window.SpeechRecognition ?? window.webkitSpeechRecognition` for compatibility.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3 + @testing-library/react 16 |
| Config file | `vitest.config.ts` (jsdom environment) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOICE-01 | `onTranscript` callback fires with recognized text | unit | `npm test -- tests/useVoiceInput.test.ts` | ❌ Wave 0 |
| VOICE-02 | `start()` calls `recognition.start()`; `stop()` calls `recognition.stop()` | unit | `npm test -- tests/useVoiceInput.test.ts` | ❌ Wave 0 |
| TTS-01 | `handleData()` strips ANSI, buffers, calls `speak()` per sentence | unit | `npm test -- tests/useTts.test.ts` | ❌ Wave 0 |
| TTS-02 | `stop()` calls `speechSynthesis.cancel()` | unit | `npm test -- tests/useTts.test.ts` | ❌ Wave 0 |
| TTS-03 | `onStart` callback in useVoiceInput calls `tts.stop()` | unit | `npm test -- tests/useVoiceInput.test.ts` | ❌ Wave 0 |
| TTS-04 | Starting voice recording stops TTS (mutual exclusion) | integration | `npm test -- tests/VoiceBar.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/useVoiceInput.test.ts` — covers VOICE-01, VOICE-02, TTS-03; needs `SpeechRecognition` mock
- [ ] `tests/useTts.test.ts` — covers TTS-01, TTS-02; needs `speechSynthesis` mock
- [ ] `tests/VoiceBar.test.tsx` — covers TTS-04 integration; needs both mocks
- [ ] jsdom mocks for `window.SpeechRecognition`, `window.webkitSpeechRecognition`, `window.speechSynthesis` — add to `tests/setup.ts`

**jsdom does not implement Web Speech API.** All tests must mock these globals. Pattern from existing `usePty.test.ts` (vi.mock WebSocket) applies — use `vi.stubGlobal` in test setup.

---

## Open Questions

1. **TTS source: raw PTY data vs. dedicated message extraction**
   - What we know: PTY data is raw ANSI terminal stream — it contains both Claude's response text AND UI chrome (prompts, progress spinners, tool use output)
   - What's unclear: How to reliably distinguish Claude's response prose from UI chrome (e.g., tool-use progress messages like `⠙ Checking files...`) to avoid speaking noise
   - Recommendation: Start with the simple approach (speak all stripped text); add a heuristic filter (skip lines starting with `⠙`, `⠸`, etc.) if user feedback shows it's noisy. This is a UX polish concern, not a blocking issue.

2. **Microphone permission UX**
   - What we know: Browser will prompt for microphone permission on first `recognition.start()` call
   - What's unclear: Whether to pre-request permission on app load vs. on first mic button press
   - Recommendation: Request on first button press (lazy) — avoids upfront permission dialog on users who never use voice.

3. **TTS interrupt point tracking (TTS-03)**
   - What we know: When user interrupts TTS, the transcript becomes a new message. The requirement says "mid-sentence by speaking" — the interruption trigger is `SpeechRecognition.onstart` or `onspeechstart`.
   - What's unclear: Whether to track which portion of the response was spoken (for context) — the requirement does NOT ask for this; it only says transcript is sent as new message.
   - Recommendation: Simple implementation: on voice start, call `speechSynthesis.cancel()`, clear sentence buffer, take transcript and call `sendInput(transcript + '\r')`. No partial-response tracking needed for v1.

---

## Sources

### Primary (HIGH confidence)
- MDN Web Docs: SpeechRecognition — https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
- MDN Web Docs: SpeechSynthesis — https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis
- MDN Web Docs: Using the Web Speech API — https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API

### Secondary (MEDIUM confidence)
- Chromium bug #679437 (SpeechSynthesis stops at ~15s) — reported via multiple web sources, confirmed by workaround pattern in community
- caniuse.com Speech Recognition — Chrome/Edge full support; Safari 14.1+ partial; Firefox unsupported
- Chrome SpeechSynthesis workarounds article — https://iifx.dev/en/articles/457363230/chrome-tts-workarounds-solving-the-speechsynthesisutterance-event-and-initial-speak-failure

### Tertiary (LOW confidence)
- Sentence-chunking approach for streaming TTS — verified via multiple blog posts (picovoice.ai, talkrapp.com) but no single authoritative spec reference

---

## Metadata

**Confidence breakdown:**
- Standard stack (browser APIs): HIGH — MDN docs are authoritative, no packages needed
- Architecture patterns (hook design): HIGH — mirrors existing hook pattern in codebase (usePty, useFileTree)
- ANSI stripping: HIGH — standard well-known regex pattern
- Chrome SpeechSynthesis 15s bug mitigation: MEDIUM — confirmed via multiple community sources, Chromium bug tracker
- Firefox lack of SpeechRecognition support: HIGH — confirmed via caniuse.com

**Research date:** 2026-04-30
**Valid until:** 2026-07-30 (Web Speech API is stable; browser support changes slowly)
