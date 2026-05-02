# Phase 6 PRD: .slop Config Vault

## What We're Building

Two-tier config architecture that moves SlopMop off localStorage and onto disk,
plus a dotfile backup/restore system for configs we don't control.

---

## Tier 1: Project-local `.slop/`

A hidden folder created inside each project directory when SlopMop onboards it.
Its presence is the onboarding marker. No `.slop/` = show wizard. `.slop/` exists = skip wizard.

### `.slop/config.json`
```json
{
  "version": "1",
  "created": "2026-05-01T12:00:00Z",
  "projectName": "my-project",
  "agent": { "command": "claude", "args": [], "label": "Claude" }
}
```

**Per-project agent override:** each project can use a different agent command.
If `agent` is present in `.slop/config.json`, it overrides `~/.slop/settings.json`.

### New server endpoints
- `GET /api/slop-status?cwd=` → `{ exists: bool, config: {...} | null }`
- `POST /api/slop-init` → body `{ cwd, projectName? }` → creates `.slop/config.json`

### Health check addition
`.slop/config.json` existence becomes health check #6 (joining the existing 5).
Label: "SlopMop config". Missing = warning (amber), not error — it can be created.

### Onboarding modal fix
- Remove the `localStorage.getItem('slopmop_onboarded')` gate
- Replace with: call `GET /api/slop-status?cwd=` when a folder is connected
- Show OnboardingModal if `exists === false`
- On "Get Started": call `POST /api/slop-init` then dismiss
- Modal also shows when `cwd` changes to a folder with no `.slop/`
  (not just on first app load — works for every new project)

---

## Tier 2: Global `~/.slop/`

User-level config that persists across browser reinstalls and survives cache clears.

### `~/.slop/settings.json`
Migrates `slopmop_settings` from localStorage:
```json
{
  "version": "1",
  "recordingMode": "toggle",
  "pttKey": null,
  "sidebarTabsOrientation": "horizontal",
  "showHiddenFiles": true,
  "typeIndicatorSize": 14
}
```
Agent default lives here too (overridden per-project by `.slop/config.json`).

### `~/.slop/recents.json`
Migrates `slopmop_recent_paths` from localStorage:
```json
{ "version": "1", "paths": ["/path/to/project1", "/path/to/project2"] }
```

### Migration strategy
On startup: if `~/.slop/settings.json` doesn't exist but `slopmop_settings` does
in localStorage, read localStorage and write to disk, then delete the localStorage key.
One-time migration, transparent to user.

### New server endpoints
- `GET /api/global-settings` → reads `~/.slop/settings.json`
- `PUT /api/global-settings` → writes `~/.slop/settings.json`
- `GET /api/recent-paths` → reads `~/.slop/recents.json`
- `PUT /api/recent-paths` → writes `~/.slop/recents.json`

---

## Tier 3: `~/.slop/backups/` — Dotfile Vault

Backup and restore configs from tools we don't own.

### What gets backed up
| Source | Destination | Notes |
|--------|-------------|-------|
| `~/.claude/settings.json` | `~/.slop/backups/claude/settings.json` | MCP servers, permissions, hooks |
| `~/.claude/settings.local.json` | `~/.slop/backups/claude/settings.local.json` | Local overrides |
| `~/.claude/CLAUDE.md` | `~/.slop/backups/claude/CLAUDE.md` | Global Claude instructions |
| `~/.claude/keybindings.json` | `~/.slop/backups/claude/keybindings.json` | Key bindings |
| `~/.claude/get-shit-done/config.json` | `~/.slop/backups/gsd/config.json` | GSD model profiles |
| second-brain `memory/*.md` | `~/.slop/backups/second-brain/*.md` | Memory files |
| `~/.gitconfig` | `~/.slop/backups/git/.gitconfig` | Git identity, aliases |
| `~/.ssh/config` | `~/.slop/backups/ssh/config` | SSH host aliases ONLY |

### Never backed up (security boundary)
- SSH private keys (`id_rsa`, `id_ed25519`, etc.)
- Any `.env` files
- API keys or tokens
- Browser passwords or cookies

### Backup modes
- **Manual:** "Backup Now" button in SlopMop settings panel
- **Auto:** On SlopMop startup, if any source file is newer than its backup, copy it

### Restore flow
- "Restore" button shows a diff: backup vs. current (what would change)
- User confirms per-file or all-at-once
- Copies from `~/.slop/backups/` → original locations

### New server endpoints
- `GET /api/vault-status` → returns list of backup targets with `{ source, dest, sourceExists, backupExists, inSync, lastBackup }`
- `POST /api/vault-backup` → body `{ targets?: string[] }` → copies source → dest for specified targets (or all if omitted)
- `POST /api/vault-restore` → body `{ targets: string[] }` → copies dest → source

### UI: Vault panel in Settings modal
New "Vault" tab in the existing SettingsModal:
- List of backup targets with sync status (green dot = in sync, amber = source newer, grey = no backup yet)
- "Backup All" button
- Per-file "Backup" and "Restore" buttons
- Last backup timestamp per file
- "~/.slop is a git repo" tip with copy-paste command

---

## Bug Fixes (included in this phase)

### Fix 1: Double-tab on load
The `initialSpawnedRef` guard doesn't reliably prevent React StrictMode double-spawn.
Fix: add dedup inside `spawn()` for `initial: true` — if a session with `name === ''`
already exists, return its id instead of creating a second one.

### Fix 2: Roadmap parser misses new phases
`parseRoadmapMd` requires phases to appear in the `## Phases` overview list before
it will parse their `### Phase N:` detail sections. GSD tools only write detail sections.
Fix: rewrite parser to build phases from `### Phase N:` sections directly (primary),
use the overview list only for `completed` status (checkbox state).

---

## What stays in localStorage

Only one key: `slopmop_last_folder` — which project to reopen on app start.
This is app-launch state (needed before any server call can be made), not config.

---

## Acceptance Criteria

### Project config
- [ ] `GET /api/slop-status` returns correct `exists` for folders with/without `.slop/`
- [ ] `POST /api/slop-init` creates `<cwd>/.slop/config.json` with correct shape
- [ ] OnboardingModal shows when connecting any folder with no `.slop/` (not just first-ever load)
- [ ] OnboardingModal does NOT show when `.slop/` already exists
- [ ] Health bar shows amber `.slop/` dot for unconfigured folders
- [ ] Health bar shows green `.slop/` dot after init

### Global settings
- [ ] On startup: settings load from `~/.slop/settings.json` if it exists
- [ ] Saving settings writes to `~/.slop/settings.json`
- [ ] One-time migration from localStorage runs transparently
- [ ] Recent paths load from `~/.slop/recents.json`

### Vault
- [ ] "Backup All" copies all source files to `~/.slop/backups/`
- [ ] Vault status shows correct sync state per file
- [ ] Restore copies backup → source location
- [ ] Auto-backup runs on startup for files newer than backup
- [ ] SSH private keys are never included

### Bug fixes
- [ ] Only one tab on fresh load (no double-spawn)
- [ ] Phase 5 and all future phases appear in roadmap tab without manual ROADMAP.md edits
