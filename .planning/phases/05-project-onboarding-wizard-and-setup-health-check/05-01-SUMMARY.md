---
phase: 05-project-onboarding-wizard-and-setup-health-check
plan: "01"
subsystem: testing
tags: [wave-0, tdd, red, onboarding, health-check]
dependency_graph:
  requires: []
  provides: [OnboardingModal test contract, useProjectHealth test contract, HealthStatusBar test contract]
  affects: [05-02-PLAN.md, 05-03-PLAN.md, 05-04-PLAN.md]
tech_stack:
  added: []
  patterns: [Wave 0 RED — @ts-expect-error on non-existent imports so Vitest runs RED without TypeScript blocking compilation]
key_files:
  created:
    - tests/OnboardingModal.test.tsx
    - tests/useProjectHealth.test.ts
    - tests/HealthStatusBar.test.tsx
  modified: []
decisions:
  - Wave 0 RED pattern extended to Phase 5 — same @ts-expect-error technique from Phase 02 and 04
  - HealthStatusBar test encodes two cases — dot--warn/dot--ok mapping and dot--loading for loading state
metrics:
  duration: 2 min
  completed: "2026-05-01"
  tasks: 2
  files: 3
---

# Phase 5 Plan 01: Wave 0 RED Test Scaffolds Summary

Wave 0 test scaffolds for Phase 5 — three test files encoding OnboardingModal, useProjectHealth, and HealthStatusBar contracts using @ts-expect-error imports to run RED in Vitest without implementation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | OnboardingModal test scaffold (RED) | 05b4652 | tests/OnboardingModal.test.tsx |
| 2 | useProjectHealth + HealthStatusBar scaffolds (RED) | 13880c2 | tests/useProjectHealth.test.ts, tests/HealthStatusBar.test.tsx |

## What Was Built

Three Wave 0 test files establishing the Phase 5 test contracts:

- `tests/OnboardingModal.test.tsx` — 3 cases: ONBOARD-01 renders when no path/not onboarded, ONBOARD-02 suppressed when path set, ONBOARD-03 dismiss sets localStorage key
- `tests/useProjectHealth.test.ts` — 2 cases: HEALTH-01 loading->resolved state transition, HEALTH-02 resets to loading on cwd change
- `tests/HealthStatusBar.test.tsx` — 2 cases: HEALTH-03 dot class mapping (warn/ok per health state), loading dots when loading=true

All three import non-existent modules via `@ts-expect-error` — TypeScript is suppressed but Vitest runs and fails with "Failed to resolve import" errors, confirming RED state.

## Deviations from Plan

None — plan executed exactly as written. Pre-existing `useSessionManager.test.ts` failures (3 tests asserting `'Session 1'` but impl returns `'New'`) confirmed pre-existing before this plan via `git stash` check; out of scope.

## Self-Check: PASSED

All 3 test files found on disk. Both task commits (05b4652, 13880c2) confirmed in git log.
