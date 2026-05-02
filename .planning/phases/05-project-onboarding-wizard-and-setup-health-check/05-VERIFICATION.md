---
phase: 05-project-onboarding-wizard-and-setup-health-check
verified: 2026-05-01T21:05:00Z
status: human_needed
score: 6/6 must-haves verified
re_verification: false
human_verification:
  - test: "OnboardingModal appears on first load with no saved folder"
    expected: "'Welcome to SlopMop' modal visible with 3 bullet points and Get Started button"
    why_human: "Requires clearing localStorage and loading browser — automated tests confirm logic but not browser render"
  - test: "Dismiss persists across reloads"
    expected: "After clicking Get Started and reloading, modal does not appear again"
    why_human: "localStorage persistence across reload cannot be verified in jsdom test environment"
  - test: "Modal is skipped when a folder is already saved"
    expected: "Clear only slopmop_onboarded (keep slopmop_last_folder) — reload — modal must not appear"
    why_human: "Requires real browser + localStorage state manipulation"
  - test: "Health bar shows colored dots for a project missing git and CLAUDE.md"
    expected: "Slim bar with amber/red dots and 'setup issues' label appears below folder picker"
    why_human: "Requires connecting a real directory in a running browser session"
  - test: "Health bar collapses when all checks pass"
    expected: "Connect SlopMop project folder — health bar disappears entirely"
    why_human: "Requires real filesystem checks against a live server"
  - test: "PTY spawns normally regardless of health check state"
    expected: "Terminal opens and accepts input even when health dots are red/amber"
    why_human: "Requires spawning a real PTY session in the browser"
---

# Phase 5: Project Onboarding Wizard and Setup Health Check — Verification Report

**Phase Goal:** First-time onboarding modal guides new users to connect a project folder; ongoing health check strip surfaces whether the active project has the prerequisites Claude Code needs (git, CLAUDE.md, agent CLI in PATH, node_modules). Modal shown once via localStorage gate. Health bar collapses when green. Nothing blocks PTY.
**Verified:** 2026-05-01T21:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | OnboardingModal appears on first load when no folder is saved | VERIFIED | `OnboardingModal.tsx` gates on `initialPath === null && !localStorage.getItem('slopmop_onboarded')` — ONBOARD-01 test GREEN |
| 2 | OnboardingModal does NOT appear when initialPath is non-null | VERIFIED | `useState(() => initialPath === null && ...)` returns false, `if (!visible) return null` — ONBOARD-02 test GREEN |
| 3 | Clicking Get Started sets localStorage key and hides the modal | VERIFIED | `handleDismiss` sets `'slopmop_onboarded' = '1'` and calls `onDismiss` — ONBOARD-03 test GREEN |
| 4 | Health hook starts loading:true, resolves, resets to loading on cwd change | VERIFIED | `useProjectHealth` uses `setTimeout(100ms)` debounce, sets `loading: true` on cwd change — HEALTH-01 + HEALTH-02 tests GREEN |
| 5 | Health dots correctly indicate ok/warn/error/loading states | VERIFIED | `HealthStatusBar` maps each field to `health-dot--{status}` class — HEALTH-03 + HEALTH-03b tests GREEN |
| 6 | Health bar collapses entirely when all checks pass | VERIFIED | `const allGreen = dots.every(d => d.status === 'ok'); if (allGreen) return null` — confirmed in source |
| 7 | Health bar only renders when a project folder is connected | VERIFIED | `{cwd && <HealthStatusBar health={health} />}` in App.tsx — bar absent on empty welcome screen |
| 8 | Health check never blocks PTY — informational only | VERIFIED | Health check runs as independent side-effect with no dependency on PTY spawn path |

**Score:** 8/8 truths verified (automated)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/OnboardingModal.test.tsx` | Wave 0 scaffold, ONBOARD-01..03 tests | VERIFIED | 3 tests, all GREEN, no @ts-expect-error (removed after module created) |
| `tests/useProjectHealth.test.ts` | HEALTH-01, HEALTH-02 tests | VERIFIED | 2 tests, all GREEN |
| `tests/HealthStatusBar.test.tsx` | HEALTH-03 test | VERIFIED | 2 tests (HEALTH-03 + HEALTH-03b), all GREEN |
| `client/components/OnboardingModal.tsx` | One-time welcome modal | VERIFIED | Named export, gates on initialPath + localStorage, handles dismiss correctly |
| `client/hooks/useProjectHealth.ts` | Health hook + ProjectHealth interface | VERIFIED | Exports both `useProjectHealth` and `ProjectHealth` interface, 100ms debounce, proper reset |
| `server/index.ts` | GET /api/project-health endpoint | VERIFIED | Endpoint at line 90, returns all 6 fields: dirAccessible, isGitRepo, hasClaudeMd, agentFound, agentPath, hasNodeModules |
| `client/components/HealthStatusBar.tsx` | Colored dot row, collapses when green | VERIFIED | Shows all dots (ok+warn+error) when non-all-green, returns null when allGreen |
| `client/App.css` | .health-bar, .health-dot CSS classes | VERIFIED | All classes present at lines 3935+, use CSS variables only — no raw hex values |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `client/App.tsx` | `OnboardingModal.tsx` | `useState(getInitialPath)` + `{!onboardingDone && <OnboardingModal initialPath={initialPath} ...>}` | WIRED | Line 228-233, uses stable `initialPath` not live `cwd` |
| `OnboardingModal` dismiss button | `localStorage.setItem('slopmop_onboarded', '1')` | `handleDismiss` callback | WIRED | Confirmed in source, ONBOARD-03 test exercises this path |
| `client/App.tsx` | `useProjectHealth` hook | `const health = useProjectHealth(cwd, settings.agent.command)` | WIRED | Line 133, passes agent command from settings |
| `client/App.tsx` | `HealthStatusBar.tsx` | `{cwd && <HealthStatusBar health={health} />}` | WIRED | Line 244, cwd-gated |
| `useProjectHealth` hook | `GET /api/project-health` | `fetch('/api/project-health?cwd=...&agent=...')` with `encodeURIComponent` | WIRED | Line 38 in hook |
| `server /api/project-health` | `commandExists`, `fsAccess`, `execFileAsync` | Direct calls — no new imports | WIRED | Uses pre-existing server helpers |
| `HealthStatusBar` | `.health-dot--{status}` CSS | Template literal `health-dot health-dot--${d.status}` | WIRED | Line 70 in HealthStatusBar.tsx |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ONBOARD-01 | 05-01, 05-02 | Modal renders when no saved folder and not yet onboarded | SATISFIED | OnboardingModal gates on `initialPath === null && !localStorage.getItem('slopmop_onboarded')` — test GREEN |
| ONBOARD-02 | 05-01, 05-02 | Modal suppressed when initialPath is non-null | SATISFIED | `useState` returns false immediately, `if (!visible) return null` — test GREEN |
| ONBOARD-03 | 05-01, 05-02 | Dismiss sets localStorage key | SATISFIED | `localStorage.setItem('slopmop_onboarded', '1')` in handleDismiss — test GREEN |
| HEALTH-01 | 05-01, 05-03 | Hook returns loading:true initially, resolves with health data | SATISFIED | `setHealth(prev => ({ ...prev, loading: true }))` then fetch resolves — test GREEN |
| HEALTH-02 | 05-01, 05-03 | Hook resets to loading when cwd changes | SATISFIED | useEffect dep array `[cwd, agentCommand]` triggers reset and 100ms debounce — test GREEN |
| HEALTH-03 | 05-01, 05-04 | Dots render correct class per health state | SATISFIED | All 4 checks mapped to ok/warn/error, loading path renders health-dot--loading — test GREEN |

**Notes on REQUIREMENTS.md gap:** ONBOARD-01..03 and HEALTH-01..03 are referenced in ROADMAP.md (line 105) and in all four PLAN frontmatter `requirements` fields, but they are NOT defined in `.planning/REQUIREMENTS.md`. The REQUIREMENTS.md ends at SESS-06 with no Phase 5 section. This is a documentation gap — the requirement IDs exist in plans and roadmap, but the requirements registry was never updated with their definitions. The implementations satisfy the intent, but the traceability table is incomplete.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `client/components/OnboardingModal.tsx` | 13 | `if (!visible) return null` | Info | Intentional — suppression logic, not a stub |
| `client/components/HealthStatusBar.tsx` | 62 | `if (allGreen) return null` | Info | Intentional — collapse-when-green behavior |

No blocker anti-patterns found. The `return null` occurrences are intentional feature logic, not placeholder stubs.

**CSS compliance check:** No raw hex values found in any phase 5 files. All colors use CSS variables (`var(--success)`, `var(--warning)`, `var(--error)`, `var(--border-muted)`).

**HealthStatusBar deviation from plan:** The PLAN specified filtering to show only non-green dots. The SUMMARY documents a deliberate deviation: all dots (including ok) are now shown when the bar is visible, because the HEALTH-03 test asserts `health-dot--ok` must be present alongside warn dots. The current code implements the deviation correctly — `dots.map` without filter, and `allGreen` check still collapses bar to null when everything is green. This is correct behavior.

---

### Pre-existing Test Failures (Out of Scope)

The full test suite shows 3 failing tests in `useSessionManager.test.ts` (Phase 4) — session name defaults changed from "Session 1/2" to "New". These failures:
- Existed before Phase 5 work began (confirmed in SUMMARY)
- Are not caused by any Phase 5 changes
- Are NOT blockers for Phase 5 goal achievement

Phase 5 tests: 7/7 GREEN.

---

### Human Verification Required

The automated suite passes all 7 Phase 5 tests. The following scenarios require browser verification with a running dev server (`npm run dev` at `/Users/rgv250cc/Documents/Projects/SlopMop`, visit http://localhost:5173):

#### 1. Onboarding Modal First Load

**Test:** DevTools → Application → Local Storage → clear `slopmop_onboarded` and `slopmop_last_folder`, then reload
**Expected:** "Welcome to SlopMop" modal appears with 3 bullet points and "Get Started" button
**Why human:** jsdom test environment cannot verify real browser render / localStorage interaction across reload

#### 2. Dismiss Persists Across Reload

**Test:** Click "Get Started", then reload the page
**Expected:** Modal does not reappear
**Why human:** Cross-reload localStorage persistence is browser-native behavior; jsdom does not persist state across renders

#### 3. Modal Skipped When Folder Is Saved

**Test:** Clear `slopmop_onboarded` only (keep `slopmop_last_folder`), reload
**Expected:** Modal does not appear — folder was already saved
**Why human:** Requires real localStorage state with a specific key combination

#### 4. Health Bar Shows Issues

**Test:** Connect a folder with no git repo and no CLAUDE.md (e.g., `/tmp/test-folder`)
**Expected:** Slim bar appears below folder picker with amber/red dots and "setup issues" label; dot tooltip on hover shows what is wrong
**Why human:** Requires real filesystem path and running server with /api/project-health

#### 5. Health Bar Collapses When All Green

**Test:** Connect the SlopMop project folder itself
**Expected:** Health bar disappears (all checks pass)
**Why human:** Requires live server health checks against a real directory

#### 6. PTY Spawns Despite Health Issues

**Test:** Connect a folder with health issues (no git, no CLAUDE.md), then start interacting
**Expected:** Terminal session spawns normally; health dots are informational only
**Why human:** Requires actually spawning a PTY session in the browser

---

## Summary

All 6 requirement IDs (ONBOARD-01..03, HEALTH-01..03) are implemented and tested. All 7 automated tests are GREEN. All 4 artifacts exist with substantive implementations. All 7 key links are wired. No blocker anti-patterns found. No raw hex values introduced.

Two minor gaps noted:
1. **Documentation gap:** REQUIREMENTS.md was not updated with ONBOARD-01..03 and HEALTH-01..03 definitions. The IDs are referenced in ROADMAP.md and all PLANs but have no entries in the requirements registry.
2. **Human verification pending:** 6 browser scenarios need manual confirmation. The SUMMARY claims all 6 passed (auto-approved), but this verification cannot confirm the human checkpoint was actually performed versus auto-skipped.

---

_Verified: 2026-05-01T21:05:00Z_
_Verifier: Claude (gsd-verifier)_
