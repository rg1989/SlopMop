---
phase: 03-voice-io
verified: 2026-04-30T23:36:00Z
status: human_needed
score: 7/7 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 5/7
  gaps_closed:
    - "useVoiceInput.ts is fully type-safe under strict TypeScript — shared/speech-api.d.ts added; tsconfig.json now has lib: [ES2022, DOM, DOM.Iterable]; Phase 3 files emit zero tsc errors"
    - "VOICE-01 transcript delivery is verified by automated test — test now fires onresult via MockSpeechRecognition.instances[0] and asserts onTranscript called with 'hello world'"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "VOICE-01 + VOICE-02: Voice transcription end-to-end"
    expected: "Click Voice button in Chrome, speak a phrase, phrase appears as sent message in terminal"
    why_human: "SpeechRecognition API requires real browser mic access; cannot simulate with jsdom"
  - test: "TTS-01: PTY output spoken aloud"
    expected: "Enable TTS toggle, type a message, Claude response is read aloud sentence by sentence"
    why_human: "speechSynthesis.speak() calls a real audio API; cannot verify audio output programmatically"
  - test: "TTS-02: Stop button halts speech within 0.5s"
    expected: "Click Stop while speaking; audio stops immediately"
    why_human: "Timing of audio cancellation requires human perception"
  - test: "TTS-03 + TTS-04: Voice interrupt stops TTS"
    expected: "While TTS plays, click mic — TTS stops, spoken phrase sent as new message"
    why_human: "Mutual exclusion involves mic permission prompt and audio state; requires live browser"
  - test: "Firefox graceful degradation"
    expected: "Mic button is disabled/grayed out; TTS still works"
    why_human: "Requires opening app in Firefox"
---

# Phase 3: Voice I/O Verification Report

**Phase Goal:** User can speak to Claude and hear responses read aloud, with full interruption control
**Verified:** 2026-04-30T23:36:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (commit de6a817)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Web Speech API globals are mocked in test setup so jsdom does not crash | VERIFIED | tests/setup.ts exports MockSpeechRecognition and mockSpeechSynthesis via vi.stubGlobal on 4 globals; 56/56 tests pass |
| 2 | useVoiceInput hook exists and provides start/stop/recording/supported | VERIFIED | client/hooks/useVoiceInput.ts exports all four; substantive SpeechRecognition lifecycle implementation |
| 3 | useTts hook exists with handleData, stop, speaking; ANSI stripping and sentence buffering work | VERIFIED | client/hooks/useTts.ts exports all three; stripAnsi + flushSentences implemented; all 4 useTts tests pass |
| 4 | VoiceBar component renders mic button, TTS toggle, and conditional stop button | VERIFIED | client/components/VoiceBar.tsx exists with all required props and conditional rendering; both VoiceBar tests pass |
| 5 | App.tsx wires useTts, useVoiceInput, VoiceBar with mutual exclusion and transcript injection | VERIFIED | App.tsx imports all three; ttsEnabled state; onData gated; onStart fires tts.stop(); transcript via sendInput(text+'\r'); VoiceBar in JSX |
| 6 | useVoiceInput.ts is fully type-safe under strict TypeScript | VERIFIED | shared/speech-api.d.ts declares SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent globally; tsconfig.json has lib: [ES2022, DOM, DOM.Iterable]; tsc --noEmit emits zero errors in Phase 3 files |
| 7 | VOICE-01 transcript delivery is verified by automated test | VERIFIED | useVoiceInput.test.ts VOICE-01 test: calls start(), retrieves MockSpeechRecognition.instances[0], fires onresult with {results:[{transcript:'hello world'}]}, asserts onTranscript called with 'hello world' — real assertion, not placeholder |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/speech-api.d.ts` | Global SpeechRecognition type declarations | VERIFIED | Declares SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent interfaces + var declarations |
| `tsconfig.json` | lib includes DOM for speech recognition types | VERIFIED | lib: ["ES2022", "DOM", "DOM.Iterable"] at line 4; include covers shared/**/* |
| `tests/setup.ts` | vi.stubGlobal mocks for SpeechRecognition, speechSynthesis | VERIFIED | Exports MockSpeechRecognition (with instances array), mockSpeechSynthesis; vi.stubGlobal on all 4 Web Speech API globals |
| `tests/useVoiceInput.test.ts` | Real VOICE-01 onresult assertion | VERIFIED | 4 tests; VOICE-01 fires onresult via MockSpeechRecognition.instances[0] and asserts onTranscript('hello world') |
| `tests/useTts.test.ts` | Tests for TTS-01, TTS-02 | VERIFIED | 4 tests GREEN; substantive assertions on cancel, speak, ANSI stripping, partial buffer |
| `tests/VoiceBar.test.tsx` | Integration tests for TTS-04 | VERIFIED | 2 tests GREEN; mic click calls onMicStart, stop click calls onTtsStop |
| `client/hooks/useVoiceInput.ts` | SpeechRecognition lifecycle hook | VERIFIED | Substantive implementation; zero tsc errors after shared/speech-api.d.ts added |
| `client/hooks/useTts.ts` | ANSI stripping, sentence buffering, speechSynthesis | VERIFIED | Fully implemented; all 4 tests pass; Chrome 15s bug mitigation included |
| `client/components/VoiceBar.tsx` | Mic button + TTS toggle + stop button | VERIFIED | All props implemented; conditional stop button; title attributes match test queries |
| `client/App.tsx` | Wires useTts, useVoiceInput, VoiceBar with onData | VERIFIED | All imports present; ttsEnabled state; onData gated; mutual exclusion wired; VoiceBar in JSX |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| shared/speech-api.d.ts | client/hooks/useVoiceInput.ts | tsconfig include: shared/**/* | WIRED | tsconfig.json includes shared/**/*; file resolves SpeechRecognition types at compile time |
| tests/setup.ts | window.SpeechRecognition | vi.stubGlobal | WIRED | vi.stubGlobal('SpeechRecognition', MockSpeechRecognition) at line 33 |
| tests/useVoiceInput.test.ts | MockSpeechRecognition.instances[0] | onresult event dispatch | WIRED | instances[0] captured after start(); onresult fired with fake event; onTranscript asserted |
| client/hooks/useVoiceInput.ts | window.SpeechRecognition | feature detect then new SR() | WIRED | SpeechRecognition/webkitSpeechRecognition feature detect; new SR() in start() |
| client/hooks/usePty.ts | options.onData | ws.onmessage handler | WIRED | onData?.(msg.data) present; interface has onData |
| client/App.tsx | usePty | onData prop passing tts.handleData | WIRED | onData: ttsEnabled ? tts.handleData : undefined at line 112 |
| client/App.tsx | useVoiceInput | onStart: tts.stop mutual exclusion | WIRED | onStart: () => { tts.stop(); } at line 122 |
| client/App.tsx | Composer | transcript injection via sendInput | WIRED | sendInput(text + '\r') inside onTranscript callback |
| client/hooks/useTts.ts | window.speechSynthesis | speechSynthesis.speak(utterance) | WIRED | speechSynthesis.speak(u) present; verified by useTts tests |
| client/hooks/useTts.ts | stripAnsi | called inside handleData | WIRED | const text = stripAnsi(raw) at top of handleData |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VOICE-01 | 03-01, 03-02, 03-04 | Voice message transcribed and dropped into message input | VERIFIED | useVoiceInput fires onTranscript; App wires sendInput(text+'\r'); VOICE-01 test exercises onresult path and asserts onTranscript called |
| VOICE-02 | 03-01, 03-02, 03-04 | Transcription triggered by button press | VERIFIED | VoiceBar mic button calls onMicStart -> voice.start(); test confirms |
| TTS-01 | 03-01, 03-03, 03-04 | TTS mode streams agent responses via speechSynthesis | VERIFIED | useTts.handleData -> stripAnsi -> flushSentences -> speechSynthesis.speak; test verifies ANSI stripping + speak call |
| TTS-02 | 03-01, 03-03, 03-04 | TTS playback stopped by manual stop button | VERIFIED | VoiceBar Stop button -> onTtsStop -> tts.stop() -> speechSynthesis.cancel(); test confirms |
| TTS-03 | 03-01, 03-02, 03-04 | Voice interrupt stops TTS, transcript sent as new message | VERIFIED | onStart fires tts.stop(); onTranscript calls sendInput(text+'\r'); test verifies onStart fires |
| TTS-04 | 03-01, 03-04 | TTS and voice input mutually exclusive | VERIFIED | App.tsx wires onStart: tts.stop(); VoiceBar test confirms mic click fires onMicStart |

All 6 requirement IDs (VOICE-01, VOICE-02, TTS-01, TTS-02, TTS-03, TTS-04) are claimed by plans and have full implementation and test evidence. No orphaned requirements.

### Anti-Patterns Found

None. The two warning-level anti-patterns from the previous verification are resolved:

- shared/speech-api.d.ts now provides all Speech API types; tsc emits zero errors in Phase 3 files.
- tests/useVoiceInput.test.ts VOICE-01 test has a real assertion, not a placeholder.

No TODO/FIXME/placeholder comments in implementation files. No empty return stubs. All 56 tests pass.

Note: tsc --noEmit still emits 12 errors in tests/pty-manager.test.ts and tests/usePty.test.ts — these are pre-existing Phase 1/2 issues outside the scope of this verification.

### Human Verification Required

#### 1. Voice Transcription (VOICE-01, VOICE-02)

**Test:** Open http://localhost:5173 in Chrome, click the Voice button in VoiceBar, grant mic permission, speak a phrase ("What is 2 plus 2?")
**Expected:** Recording indicator appears; spoken phrase is sent as a new message to Claude after speech ends
**Why human:** SpeechRecognition requires real browser microphone access; jsdom cannot simulate

#### 2. TTS Playback (TTS-01)

**Test:** Enable the TTS toggle (turns blue), type a question and press Enter, wait for Claude to respond
**Expected:** Response is read aloud sentence by sentence; "Speaking..." indicator visible during playback
**Why human:** speechSynthesis.speak() requires real audio hardware; cannot verify audio output in tests

#### 3. Manual Stop (TTS-02)

**Test:** While TTS is playing, click the red Stop button
**Expected:** Audio stops within 0.5 seconds
**Why human:** Audio timing requires human perception

#### 4. Voice Interrupt (TTS-03 + TTS-04)

**Test:** Enable TTS, trigger a long Claude response, while it speaks click the mic button and say a phrase
**Expected:** TTS audio stops immediately when mic button is clicked; spoken phrase is sent as a new message
**Why human:** Involves mic permission, real audio state, and real-time mutual exclusion behavior

#### 5. Firefox Degradation (Optional)

**Test:** Open app in Firefox
**Expected:** Mic button is disabled/grayed out; TTS toggle still functions
**Why human:** Requires Firefox browser

### Gaps Summary

No gaps remain. Both previously-identified gaps are closed in commit de6a817:

**Gap 1 (closed) — TypeScript type errors:** shared/speech-api.d.ts added with full SpeechRecognition interface declarations. tsconfig.json now has `lib: ["ES2022", "DOM", "DOM.Iterable"]` and include covers `shared/**/*`. tsc --noEmit emits zero errors across all Phase 3 source files.

**Gap 2 (closed) — VOICE-01 placeholder test:** The test now retrieves the actual SpeechRecognition instance created by the hook (MockSpeechRecognition.instances[0]), fires a fake onresult event with transcript text, and asserts onTranscript was called with that exact text. This is a real behavioral assertion that would fail if the hook's onresult handler were broken.

Automated checks: 7/7 truths verified, 10/10 artifacts verified, 10/10 key links wired, 6/6 requirements satisfied, 56/56 tests pass. Phase goal is achieved at the code level; human verification of browser audio/mic behavior remains open as these require real browser APIs that cannot be simulated in jsdom.

---

_Verified: 2026-04-30T23:36:00Z_
_Verifier: Claude (gsd-verifier)_
