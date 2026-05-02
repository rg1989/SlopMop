# vendor/

Vendored third-party tools bundled with SlopMop so installation works offline
and without fetching from external registries.

**Nothing in this directory is part of the SlopMop app itself.**
The app source lives in `client/`, `server/`, and `shared/`.

---

## Contents

### `gsd/`

**GSD — Get Shit Done** coding agent for Claude Code.

- Source: https://www.npmjs.com/package/gsd-pi
- Version bundled: see `gsd/VERSION`
- License: MIT
- Author: glittercowboy
- Installed to: `~/.claude/get-shit-done/`

### `hooks/`

GSD lifecycle hooks for Claude Code (session start, tool use, stop).

- Source: distributed as part of the `gsd-pi` npm package
- License: MIT (same as above)
- Installed to: `~/.claude/hooks/`

Files:
- `pre-bash.sh` / `pre-write.sh` — GSD PreToolUse guards
- `gsd-check-update.js` — SessionStart update checker
- `gsd-context-monitor.js` — PostToolUse context monitor
- `gsd-phase-completer.sh` — Stop hook for phase completion
- `gsd-statusline.js` — status line integration

### `commands/`

Claude Code slash commands installed to `~/.claude/commands/`.

- `gsd/` — GSD slash commands (MIT, from gsd-pi)
- `full-feature.md` — full-feature skill (MIT, from gsd-pi)

---

## Updating

To refresh vendor/ from the latest gsd-pi release:

```bash
npm run update-vendor
```

This re-installs `gsd-pi` globally and syncs the new files into `vendor/`,
then shows a diff so you can review what changed before committing.
