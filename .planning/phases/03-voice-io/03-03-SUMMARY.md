---
phase: 03-voice-io
plan: "03"
subsystem: ui
tags: [react, speechsynthesis, tts, web-speech-api, ansi, hooks]

# Dependency graph
requires:
  - phase: 03-voice-io/03-01
    provides: Web Speech API globals stubbed in tests/setup.ts
provides:
  - useTts hook with handleData, stop, speaking state, and stripAnsi utility
  - ANSI stripping + sentence-buffered SpeechSynthesis playback
  - Chrome 15s bug mitigation via non-Google voice selection
affects: [03-04-VoiceBar, App.tsx TTS wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED → GREEN: test file created first, fails on import, then implementation written"
    - "Sentence-chunked SpeechSynthesis: one utterance per sentence prevents Chrome 15s silent-stop"
    - "ANSI stripping regex pipeline: CSI, OSC, ESC, and control char sequences removed before TTS feed"

key-files:
  created:
    - client/hooks/useTts.ts
    - tests/useTts.test.ts
  modified: []

key-decisions:
  - "Voice selection skips names starting with 'Google ' to avoid Chrome ~15s silent-stop bug (chromium #679437)"
  - "flushSentences uses capture group split so terminator attaches to sentence text — utterance.text includes period"
  - "handleData is a strict no-op when enabled:false — early return before any buffer mutation"
  - "speak() is a useCallback with no enabled dependency — guard moved to handleData — avoids stale closure in buffer flush"

patterns-established:
  - "Pattern: stripAnsi before any TTS buffer append — never feed raw PTY data to SpeechSynthesis"
  - "Pattern: capture-group split for sentence extraction — (parts[i] + parts[i+1]).trim() = sentence with terminator"

requirements-completed: [TTS-01, TTS-02]

# Metrics
duration: 2min
completed: 2026-04-30
---

# Phase 03 Plan 03: useTts Hook Summary

**SpeechSynthesis TTS engine with ANSI stripping, sentence-chunked buffering, and Chrome 15s bug mitigation via non-Google voice selection**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-30T17:35:11Z
- **Completed:** 2026-04-30T17:36:28Z
- **Tasks:** 1 (TDD: RED commit + GREEN commit)
- **Files modified:** 2

## Accomplishments
- Implemented `useTts` hook exporting `{ speaking, stop, handleData }` per interface spec
- `stripAnsi` removes CSI, OSC, and control sequences from raw PTY data before TTS
- `flushSentences` splits on `[.!?]` followed by whitespace/end, speaks each complete sentence immediately
- Chrome 15s silent-stop bug mitigated: voice selection skips names starting with `'Google '`
- All 4 useTts tests GREEN; 50 total tests pass (useVoiceInput test remains RED — that hook not yet implemented, expected)

## Task Commits

Each task was committed atomically:

1. **RED: Failing tests for useTts** - `6e5dac2` (test)
2. **GREEN: useTts implementation** - `d6c989b` (feat)

## Files Created/Modified
- `client/hooks/useTts.ts` - TTS hook: ANSI stripping, sentence buffering, SpeechSynthesis playback, stop
- `tests/useTts.test.ts` - 4 unit tests covering TTS-01 and TTS-02 behaviors

## Decisions Made
- Voice selection skips `'Google '` prefix names — Chrome bug (#679437) triggers 15s silent stop on these voices
- Capture group in `split(/([.!?])(?=\s|$)/)` keeps terminator attached to sentence text so `utterance.text === 'Hello world.'` (with period) matches test expectations
- `speak` callback has no `enabled` dependency — early return guard lives in `handleData` to avoid stale closure capture during buffer flush

## Deviations from Plan

None - plan executed exactly as written. The `flushSentences` capture-group approach was pre-warned in the plan's implementation note and worked correctly on first attempt.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `useTts` hook complete and tested — ready for Plan 04 (VoiceBar component) to wire `handleData` into `usePty` `onData` callback and expose TTS toggle + stop button in UI
- No blockers

---
*Phase: 03-voice-io*
*Completed: 2026-04-30*
