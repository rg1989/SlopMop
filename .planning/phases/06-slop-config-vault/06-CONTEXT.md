# Phase 6: .slop Config Vault - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning
**Source:** PRD Express Path (.planning/phases/06-slop-config-vault/06-PRD.md)

<domain>
## Phase Boundary

Phase 6 replaces all SlopMop localStorage usage (except `slopmop_last_folder`) with
on-disk config files, adds a vault backup/restore system for third-party tool configs,
fixes two pre-existing bugs (double-tab spawn, roadmap parser), and rewires the
OnboardingModal to trigger per-project (based on `.slop/` presence) rather than once globally.

Three tiers:
1. **Project-local `.slop/`** — presence = onboarded; holds per-project agent override
2. **Global `~/.slop/`** — user settings and recent paths on disk; survives browser reinstall
3. **`~/.slop/backups/`** — dotfile vault for ~/.claude, GSD, second-brain, git, ssh configs

</domain>

<decisions>
## Implementation Decisions

### Tier 1: Project-local `.slop/`

- `.slop/config.json` shape is locked: `{ version, created, projectName, agent: { command, args, label } }`
- Presence of `.slop/` (not just `config.json`) is the onboarding marker
- New endpoint: `GET /api/slop-status?cwd=` → `{ exists: bool, config: {...} | null }`
- New endpoint: `POST /api/slop-init` → body `{ cwd, projectName? }` → creates `.slop/config.json`
- `.slop/config.json` becomes health check #6 — label "SlopMop config", missing = amber warning (not red error)
- OnboardingModal trigger: call `GET /api/slop-status` whenever `cwd` changes; show modal if `exists === false`
- On "Get Started": call `POST /api/slop-init` → then dismiss modal
- Remove `localStorage.getItem('slopmop_onboarded')` gate entirely
- Per-project agent override: if `.slop/config.json` has `agent`, it overrides global settings

### Tier 2: Global `~/.slop/`

- `~/.slop/settings.json` holds all user prefs (recordingMode, pttKey, sidebarTabsOrientation, showHiddenFiles, typeIndicatorSize)
- `~/.slop/recents.json` holds recently opened project paths
- New endpoints: `GET/PUT /api/global-settings`, `GET/PUT /api/recent-paths`
- Migration: on startup, if `~/.slop/settings.json` missing but `slopmop_settings` in localStorage → migrate transparently, delete localStorage key
- `slopmop_last_folder` stays in localStorage (needed before server is reachable at app boot)

### Tier 3: `~/.slop/backups/` Vault

- Backup targets (locked list):
  - `~/.claude/settings.json` → `~/.slop/backups/claude/settings.json`
  - `~/.claude/settings.local.json` → `~/.slop/backups/claude/settings.local.json`
  - `~/.claude/CLAUDE.md` → `~/.slop/backups/claude/CLAUDE.md`
  - `~/.claude/keybindings.json` → `~/.slop/backups/claude/keybindings.json`
  - `~/.claude/get-shit-done/config.json` → `~/.slop/backups/gsd/config.json`
  - `~/.gitconfig` → `~/.slop/backups/git/.gitconfig`
  - `~/.ssh/config` → `~/.slop/backups/ssh/config`
- SSH private keys NEVER backed up (security boundary — locked)
- New endpoints: `GET /api/vault-status`, `POST /api/vault-backup`, `POST /api/vault-restore`
- Auto-backup on startup: if source newer than backup, copy silently
- UI: new "Vault" tab in existing SettingsModal
- Vault tab shows: list of targets with sync status dots, "Backup All" button, per-file backup/restore, last backup timestamp
- Sync states: green = in sync, amber = source newer than backup, grey = no backup yet

### Bug Fixes (locked scope)

- **Double-tab fix**: inside `spawn()` in `useSessionManager.ts`, when `initial: true`, check if a session with `name === ''` already exists — if so return its id, skip creating a second one
- **Roadmap parser fix**: rewrite `parseRoadmapMd` in `server/gsd.ts` to build phases from `### Phase N:` detail sections directly; use `## Phases` overview list only for completed checkbox state (not as a gate for parsing)

### Claude's Discretion

- Exact file I/O implementation on server (fs.promises, atomic writes via temp file + rename, etc.)
- Whether vault backup is async/queued or blocking
- Exact CSS for the Vault tab UI — must use existing design system (CSS variables, monospace)
- Second-brain memory path detection (read from `~/.claude/CLAUDE.md` references or hardcode known path)
- Error handling for partial backup failures

</decisions>

<specifics>
## Specific Ideas

- `~/.slop/` should be mentioned in UI as "a git repo you can push to GitHub" — show the git init tip in Vault tab
- The "Vault" tab sits inside the existing SettingsModal alongside General/Agent/etc tabs
- `GET /api/slop-status` must be fast (single `fs.access` call) — called on every cwd change
- `POST /api/slop-init` creates the directory with `mkdir -p` then writes `config.json`
- Restore flow: show a simple diff list of what will be overwritten, user clicks "Restore All" or per-file "Restore"
- Health check #6 label: "SlopMop config (.slop)" — amber warning with tooltip "Run /api/slop-init or click 'Get Started'"
- `useSettings` hook needs to be refactored to load/save via `GET/PUT /api/global-settings` instead of localStorage

</specifics>

<deferred>
## Deferred Ideas

- `~/.slop/sessions.json` per-project session history migration (sessions stay in localStorage for now — lower priority)
- Automatic git init of `~/.slop/` with push-to-GitHub workflow
- Second-brain memory backup (path detection is complex; defer to future phase)
- Windows support for `~/.slop/` paths (out of scope for v1)

</deferred>

---

*Phase: 06-slop-config-vault*
*Context gathered: 2026-05-01 via PRD Express Path*
