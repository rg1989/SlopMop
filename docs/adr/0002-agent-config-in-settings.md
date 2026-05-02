# AgentConfig lives in user Settings, not a per-workspace config file

The agent launch configuration (command, args, label) is stored in `localStorage` as part of `AppSettings` rather than in a per-workspace file (e.g. `.slopmop.json`).

The reasoning: SlopMop is a personal local tool. The agent a user wants to run is a personal preference — the same user is unlikely to want `claude` in one workspace and `aider` in another as a default. Storing it in settings keeps the UX simple: change once, applies everywhere. A per-workspace file would require the workspace to exist and be writable, adds a config format to maintain, and creates a bootstrapping problem (which agent do you use before you've opened a workspace?).

## Considered options

**Per-workspace `.slopmop.json`** — natural for teams where different repos use different agents. Rejected for now because SlopMop is single-user and local-only; the added complexity isn't warranted. Revisit if workspace-level overrides become a real need.

**Environment variable** — simpler but not configurable from the UI and invisible to new users. Rejected.

## Consequences

When workspace-level agent overrides become desirable (e.g. a repo that requires a specific agent version), the right path is to add an optional workspace config that takes precedence over Settings — not to move the default out of Settings. The Settings value becomes the fallback.
