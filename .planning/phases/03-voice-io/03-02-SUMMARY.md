---
phase: 03-voice-io
plan: 02
subsystem: ui
tags: [react, speech-recognition, web-speech-api, hooks, websocket]

# Dependency graph
requires:
  - phase: 03-01
    provides: Web Speech API globals stubbed in tests/setup.ts; RED test stubs for useVoiceInput
  - phase: 02-file-system
    provides: usePty hook base implementation that this plan extends

provides:
  - useVoiceInput hook: SpeechRecognition lifecycle (start, stop, recording state, onTranscript, onStart callbacks)
  - usePty extended with onData?: (raw: string) => void callback for PTY data interception

affects: [03-03, 03-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New SR instance per start() call — avoids 'already-started' DOMException on rapid mic toggling"
    - "onStart fires before recognition.start() — enables TTS-04 mutual exclusion (stop TTS before mic opens)"
    - "onData callback in usePty is strictly additive — existing callers pass no onData and work unchanged"

key-files:
  created:
    - client/hooks/useVoiceInput.ts
  modified:
    - client/hooks/usePty.ts

key-decisions:
  - "Create fresh SpeechRecognition instance on each start() call rather than reusing — avoids browser DOMException on re-start"
  - "onData added to UsePtyOptions interface with optional chaining — zero-cost when not provided; enables useTts data interception"
  - "useVoiceInput returns supported boolean for caller UI gating (e.g., hide mic button on Firefox)"

patterns-established:
  - "Voice hook pattern: useCallback with SR reference in ref, fire onStart before recognition start"
  - "Additive interface extension: optional callback added to existing hook options without breaking callers"

requirements-completed: [VOICE-01, VOICE-02, TTS-03]

# Metrics
duration: 8min
completed: 2026-04-30
---

# Phase 3 Plan 02: useVoiceInput + usePty onData Summary

**SpeechRecognition hook with per-call instance creation and onStart TTS-interrupt signal; usePty extended with optional raw-data tap for TTS pipeline**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-30T17:35:30Z
- **Completed:** 2026-04-30T17:43:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- useVoiceInput hook implements full SpeechRecognition lifecycle: start/stop, recording state, onTranscript callback, onStart signal for TTS mutual exclusion
- usePty extended with optional onData callback that fires alongside terminal.write — prerequisite for useTts PTY data interception
- All 4 useVoiceInput tests GREEN (VOICE-01, VOICE-02, TTS-03); all 9 usePty tests remain GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend usePty with optional onData callback** - `2ca5d1e` (feat)
2. **Task 2: Implement useVoiceInput hook** - `0b0620c` (feat)

**Plan metadata:** committed with SUMMARY.md

## Files Created/Modified
- `client/hooks/useVoiceInput.ts` - SpeechRecognition hook: feature-detects SR/webkitSR, creates fresh instance per start(), fires onStart before recognition, sets recording state, calls onTranscript from onresult
- `client/hooks/usePty.ts` - Added onData?: (raw: string) => void to UsePtyOptions; fires after terminal.write in ws.onmessage data handler

## Decisions Made
- New SpeechRecognition instance per start() call — browsers throw DOMException if start() is called twice on same instance
- onData callback pattern mirrors the existing optional callback pattern in the codebase (no mandatory callers)
- useVoiceInput returns `supported` boolean alongside recording/start/stop so callers can conditionally render mic UI

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Context revealed 03-01 was partially executed in a prior session (setup.ts committed, but useVoiceInput.test.ts and VoiceBar.test.tsx were missing). Added those wave 0 stubs before starting 03-02 execution.
- useTts hook was already implemented (d6c989b) in a prior 03-03 partial run; useTts.test.ts was the committed final version, not a wave 0 stub — left unchanged.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- useVoiceInput and usePty onData are complete prerequisites for Plan 03-03 (useTts wiring) and Plan 03-04 (VoiceBar UI)
- useTts is already implemented — Plan 03-04 (VoiceBar + App wiring) can proceed directly

---
*Phase: 03-voice-io*
*Completed: 2026-04-30*
