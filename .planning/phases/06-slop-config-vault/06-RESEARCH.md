# Phase 6: .slop Config Vault - Research

**Researched:** 2026-05-01
**Domain:** Node.js file I/O, React async state, config migration, dotfile backup
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tier 1: Project-local `.slop/`**
- `.slop/config.json` shape: `{ version, created, projectName, agent: { command, args, label } }`
- Presence of `.slop/` (not just `config.json`) is the onboarding marker
- New endpoint: `GET /api/slop-status?cwd=` → `{ exists: bool, config: {...} | null }`
- New endpoint: `POST /api/slop-init` → body `{ cwd, projectName? }` → creates `.slop/config.json`
- `.slop/config.json` becomes health check #6 — label "SlopMop config", missing = amber warning (not red error)
- OnboardingModal trigger: call `GET /api/slop-status` whenever `cwd` changes; show modal if `exists === false`
- On "Get Started": call `POST /api/slop-init` → then dismiss modal
- Remove `localStorage.getItem('slopmop_onboarded')` gate entirely
- Per-project agent override: if `.slop/config.json` has `agent`, it overrides global settings

**Tier 2: Global `~/.slop/`**
- `~/.slop/settings.json` holds all user prefs (recordingMode, pttKey, sidebarTabsOrientation, showHiddenFiles, typeIndicatorSize)
- `~/.slop/recents.json` holds recently opened project paths
- New endpoints: `GET/PUT /api/global-settings`, `GET/PUT /api/recent-paths`
- Migration: on startup, if `~/.slop/settings.json` missing but `slopmop_settings` in localStorage → migrate transparently, delete localStorage key
- `slopmop_last_folder` stays in localStorage

**Tier 3: `~/.slop/backups/` Vault**
- Backup targets (locked list): `~/.claude/settings.json`, `~/.claude/settings.local.json`, `~/.claude/CLAUDE.md`, `~/.claude/keybindings.json`, `~/.claude/get-shit-done/config.json`, `~/.gitconfig`, `~/.ssh/config`
- SSH private keys NEVER backed up (security boundary — locked)
- New endpoints: `GET /api/vault-status`, `POST /api/vault-backup`, `POST /api/vault-restore`
- Auto-backup on startup: if source newer than backup, copy silently
- UI: new "Vault" tab in existing SettingsModal

**Bug Fixes (locked scope)**
- Double-tab fix: inside `spawn()` in `useSessionManager.ts`, when `initial: true`, check if a session with `name === ''` already exists — if so return its id, skip creating a second one
- Roadmap parser fix: rewrite `parseRoadmapMd` in `server/gsd.ts` to build phases from `### Phase N:` detail sections directly; use `## Phases` overview list only for completed checkbox state

### Claude's Discretion
- Exact file I/O implementation on server (fs.promises, atomic writes via temp file + rename, etc.)
- Whether vault backup is async/queued or blocking
- Exact CSS for the Vault tab UI — must use existing design system (CSS variables, monospace)
- Second-brain memory path detection (read from `~/.claude/CLAUDE.md` references or hardcode known path)
- Error handling for partial backup failures

### Deferred Ideas (OUT OF SCOPE)
- `~/.slop/sessions.json` per-project session history migration
- Automatic git init of `~/.slop/` with push-to-GitHub workflow
- Second-brain memory backup (path detection is complex)
- Windows support for `~/.slop/` paths
</user_constraints>

---

## Summary

Phase 6 is a pure Node.js + React wiring phase — no new npm dependencies required. All primitives (`fs/promises`, `os.homedir()`, `stat.mtimeMs`, atomic rename via `writeFile` to temp + `rename`) are already available in the Node.js stdlib that the server already uses. The existing server pattern (`readFile`/`writeFile`/`mkdir`/`fsAccess` from `fs/promises`) can be extended directly for every new endpoint.

The `useSettings` hook is a standalone 82-line file with a clean `load()`/`save()` pair. Migration to server-backed I/O means converting `load()` to an async fetch and `save()` to a `PUT /api/global-settings`. The hook needs an async init phase, which means the calling pattern in App.tsx changes from synchronous `useState(load)` to an async effect with a loading state. The simplest approach: keep synchronous localStorage as an immediate-read fallback, then overwrite with server data once it arrives (migration path included free of charge).

The `SettingsModal` already has a three-tab system (`display | audio | agent`) implemented via a `SettingsTab` union type — adding `vault` is a four-line change. The Vault tab body can be a new self-contained component. The `OnboardingModal` currently gates on `initialPath === null && !localStorage.getItem('slopmop_onboarded')` — the entire gate must be replaced with a server-driven `slopExists` flag managed in App.tsx, with the modal becoming a pure prop-driven presentational component.

**Primary recommendation:** Build in three waves: (1) server endpoints + bug fixes, (2) useSettings migration + onboarding rewire, (3) Vault UI tab. This ordering means each wave is independently testable.

---

## Standard Stack

### Core (already in project — no new installs)

| Module | Source | Purpose | Notes |
|--------|--------|---------|-------|
| `fs/promises` | Node stdlib | File read/write/stat/mkdir/rename | Already imported in `server/index.ts` line 8 |
| `os` | Node stdlib | `os.homedir()` for `~` resolution | Already imported in `server/index.ts` line 4 |
| `path` | Node stdlib | Path joining and resolution | Already imported |
| `crypto` | Node stdlib | UUID for session IDs | Already used via `crypto.randomUUID()` |

### Already-imported `fs/promises` functions in server/index.ts

```typescript
import { readFile, writeFile, access as fsAccess, readdir, rm, mkdir } from 'fs/promises';
```

`stat` is NOT yet imported — add it for mtime comparison. `rename` is NOT yet imported — add it for atomic writes.

**Installation:** None required.

---

## Architecture Patterns

### Recommended File Layout (new files only)

```
server/
└── index.ts              # Add 8 new endpoints inline (matches existing pattern)

client/
├── hooks/
│   └── useSettings.ts    # Rewrite load/save to be server-backed
└── components/
    ├── OnboardingModal.tsx  # Rewire — remove localStorage gate, make prop-driven
    ├── HealthStatusBar.tsx  # Add 6th dot (slop config)
    └── VaultTab.tsx         # New component — Vault tab body for SettingsModal

~/.slop/
├── settings.json
├── recents.json
└── backups/
    ├── claude/
    │   ├── settings.json
    │   ├── settings.local.json
    │   ├── CLAUDE.md
    │   └── keybindings.json
    ├── gsd/
    │   └── config.json
    ├── git/
    │   └── .gitconfig
    └── ssh/
        └── config
```

### Pattern 1: Server Endpoint for Config Read/Write

All new config endpoints follow the same shape as existing ones. Read `~/.slop/` paths via `os.homedir()`:

```typescript
// Source: server/index.ts existing pattern (e.g. /api/project-health)
const SLOP_DIR = path.join(os.homedir(), '.slop');
const SETTINGS_FILE = path.join(SLOP_DIR, 'settings.json');
const RECENTS_FILE = path.join(SLOP_DIR, 'recents.json');

app.get('/api/global-settings', async (_req, res) => {
  try {
    const raw = await readFile(SETTINGS_FILE, 'utf-8');
    res.json({ settings: JSON.parse(raw) });
  } catch {
    res.json({ settings: null }); // null = file doesn't exist yet
  }
});

app.put('/api/global-settings', async (req, res) => {
  const { settings } = req.body as { settings?: unknown };
  if (!settings) { res.status(400).json({ error: 'settings required' }); return; }
  await mkdir(SLOP_DIR, { recursive: true });
  // Atomic write: write to temp, then rename
  const tmp = SETTINGS_FILE + '.tmp';
  await writeFile(tmp, JSON.stringify(settings, null, 2), 'utf-8');
  await rename(tmp, SETTINGS_FILE);
  res.json({ ok: true });
});
```

### Pattern 2: Atomic File Write (temp + rename)

Prevents corrupt config if process crashes mid-write. Add `rename` to the `fs/promises` import:

```typescript
import { readFile, writeFile, access as fsAccess, readdir, rm, mkdir, rename, stat } from 'fs/promises';

// Atomic write helper
async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmp = filePath + '.tmp';
  await writeFile(tmp, content, 'utf-8');
  await rename(tmp, filePath);
}
```

### Pattern 3: mtime Comparison for Auto-Backup

`fs.stat()` returns `mtimeMs` (milliseconds since epoch). Verified working on macOS (Node stdlib):

```typescript
// Source: Node.js fs.stat documentation — mtimeMs is a standard Stats property
async function isSourceNewer(sourcePath: string, backupPath: string): Promise<boolean> {
  try {
    const [srcStat, bkStat] = await Promise.all([
      stat(sourcePath),
      stat(backupPath),
    ]);
    return srcStat.mtimeMs > bkStat.mtimeMs;
  } catch {
    // If backup doesn't exist (ENOENT), source is "newer"
    // If source doesn't exist, return false (nothing to back up)
    try { await stat(sourcePath); return true; } catch { return false; }
  }
}
```

### Pattern 4: GET /api/slop-status (fast path)

Single `fsAccess` call — no file read needed for existence check:

```typescript
app.get('/api/slop-status', async (req, res) => {
  const { cwd } = req.query as { cwd?: string };
  if (!cwd) { res.status(400).json({ error: 'cwd required' }); return; }
  const slopDir = path.join(path.resolve(cwd), '.slop');
  const configFile = path.join(slopDir, 'config.json');
  try {
    await fsAccess(slopDir);
    // Directory exists — try to read config
    try {
      const raw = await readFile(configFile, 'utf-8');
      res.json({ exists: true, config: JSON.parse(raw) });
    } catch {
      res.json({ exists: true, config: null });
    }
  } catch {
    res.json({ exists: false, config: null });
  }
});
```

### Pattern 5: POST /api/slop-init

```typescript
app.post('/api/slop-init', async (req, res) => {
  const { cwd, projectName } = req.body as { cwd?: string; projectName?: string };
  if (!cwd) { res.status(400).json({ error: 'cwd required' }); return; }
  const slopDir = path.join(path.resolve(cwd), '.slop');
  const configFile = path.join(slopDir, 'config.json');
  await mkdir(slopDir, { recursive: true });
  const config = {
    version: '1',
    created: new Date().toISOString(),
    projectName: projectName ?? path.basename(path.resolve(cwd)),
    agent: { command: 'claude', args: [], label: 'Claude' },
  };
  await atomicWrite(configFile, JSON.stringify(config, null, 2));
  res.json({ ok: true, config });
});
```

### Pattern 6: useSettings Migration to Server-Backed

Current `useSettings.ts` uses synchronous `localStorage.getItem/setItem`. The migration strategy preserves backward compat:

1. On hook init: immediately read localStorage (for instant render, no flash)
2. Then async: `GET /api/global-settings`
   - If server returns settings: overwrite state with server data, delete `slopmop_settings` from localStorage (migration done)
   - If server returns null: run migration — write current localStorage value to server, then continue
3. On `update()`: call `PUT /api/global-settings` in addition to (or instead of) localStorage

```typescript
// Minimal change pattern — keeps hook interface identical for all callers
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(load); // still sync-init from localStorage

  // Async server sync on mount
  useEffect(() => {
    fetch('/api/global-settings')
      .then(r => r.json())
      .then(({ settings: serverSettings }) => {
        if (serverSettings) {
          // Server has data — use it, clean up localStorage
          const merged = { ...DEFAULTS, ...serverSettings };
          setSettings(merged);
          localStorage.removeItem(STORAGE_KEY);
        } else {
          // Migrate localStorage → server
          const current = load();
          fetch('/api/global-settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: current }),
          }).catch(() => {});
        }
      })
      .catch(() => {}); // Server unreachable — stay with localStorage
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      // Write to server (primary) and localStorage (fallback)
      fetch('/api/global-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: next }),
      }).catch(() => {});
      save(next); // keep localStorage in sync as fallback
      return next;
    });
  }, []);

  return { settings, update };
}
```

### Pattern 7: OnboardingModal Rewire

**Current state (OnboardingModal.tsx):** The `visible` state is computed once on mount using `initialPath` and `localStorage.getItem('slopmop_onboarded')`. The component is stateful and self-gating.

**Required state (Phase 6):** The modal must show whenever `cwd` changes to a folder without `.slop/`. The gate must move to App.tsx:

```typescript
// In App.tsx — new state
const [slopExists, setSlopExists] = useState<boolean | null>(null); // null = loading

// Effect: check slop-status whenever cwd changes
useEffect(() => {
  if (!cwd) { setSlopExists(null); return; }
  fetch(`/api/slop-status?cwd=${encodeURIComponent(cwd)}`)
    .then(r => r.json())
    .then(({ exists }) => setSlopExists(exists))
    .catch(() => setSlopExists(null));
}, [cwd]);

// In JSX — replace the existing OnboardingModal usage:
// OLD: {!onboardingDone && <OnboardingModal initialPath={initialPath} onDismiss={...} />}
// NEW:
{cwd && slopExists === false && (
  <OnboardingModal
    cwd={cwd}
    onInit={() => setSlopExists(true)}
  />
)}
```

**OnboardingModal becomes fully prop-driven:** Remove all `useState` internal gating and localStorage access. Accept `cwd` prop. "Get Started" calls `POST /api/slop-init` then calls `onInit()`.

### Pattern 8: Double-Tab Spawn Bug Fix

**Root cause (confirmed by reading useSessionManager.ts lines 83–106):** `initialSpawnedRef` is in App.tsx (line 162), guarding the `useEffect` that calls `spawn()`. React StrictMode in development mounts components twice — the `useEffect` cleanup + re-run cycle can fire the effect a second time before `initialSpawnedRef.current = true` is committed, because the effect fires synchronously with the ref set. Additionally, `handleConnect` (line 169) calls `spawn()` without the `initialSpawnedRef` guard.

**Confirmed minimal fix location:** Inside `spawn()` in `useSessionManager.ts`, the `initial: true` path (lines 83–106) does NOT currently check for existing sessions with `name === ''`. The fix is:

```typescript
const spawn = useCallback((cwd: string, { initial = false }: { initial?: boolean } = {}): string => {
  const current = sessionsRef.current;
  if (current.length >= MAX_SESSIONS) {
    return activeIdRef.current ?? current[current.length - 1]?.id ?? '';
  }

  // NEW: deduplicate initial spawn — if a nameless session exists, return it
  if (initial) {
    const existing = current.find(s => s.name === '');
    if (existing) {
      setActiveId(existing.id);
      return existing.id;
    }
  }

  // existing "New" tab dedup for non-initial (lines 90-94 unchanged)
  if (!initial) {
    const unnamedTab = current.find(s => s.name === 'New');
    if (unnamedTab) {
      setActiveId(unnamedTab.id);
      return unnamedTab.id;
    }
  }
  // ... rest unchanged
}, []);
```

### Pattern 9: parseRoadmapMd Rewrite

**Root cause (confirmed by reading gsd.ts lines 22–56):** The parser first scans `## Phases` to build a phases array (lines 29–34), then in the detail section (lines 37–54) it looks up `currentPhase = phases.find(p => p.number === ...)`. If a phase isn't in the `## Phases` list, `find()` returns `undefined`, so `currentPhase` stays null and the `### Phase N:` detail section is silently dropped.

**Fix:** Build phases directly from `### Phase N:` detail sections. Read `## Phases` list only for the `completed` checkbox state:

```typescript
// Source: gsd.ts — rewrite of parseRoadmapMd
export function parseRoadmapMd(content: string): PhaseDraft[] {
  const lines = content.split('\n');

  // Pass 1: collect completed state from ## Phases overview list
  const completedMap = new Map<number, boolean>();
  let inPhasesSection = false;
  for (const line of lines) {
    if (/^## Phases/.test(line)) { inPhasesSection = true; continue; }
    if (/^## /.test(line) && !/^## Phases/.test(line)) { inPhasesSection = false; }
    if (inPhasesSection) {
      const m = line.match(/^- \[([x ])\] \*\*Phase (\d+(?:\.\d+)?): /);
      if (m) completedMap.set(parseFloat(m[2]), m[1] === 'x');
    }
  }

  // Pass 2: build phases from ### Phase N: detail sections (primary source of truth)
  const phases: PhaseDraft[] = [];
  let currentPhase: PhaseDraft | null = null;
  let inPlans = false;

  for (const line of lines) {
    const detailM = line.match(/^### Phase (\d+(?:\.\d+)?): (.+)/);
    if (detailM) {
      const num = parseFloat(detailM[1]);
      currentPhase = {
        number: num,
        name: detailM[2].trim(),
        goal: '',
        completed: completedMap.get(num) ?? false,
        plans: [],
      };
      phases.push(currentPhase);
      inPlans = false;
      continue;
    }

    if (currentPhase) {
      const goalM = line.match(/^\*\*Goal\*\*: (.+)/);
      if (goalM) { currentPhase.goal = goalM[1].trim(); }
      if (line.trim() === 'Plans:') { inPlans = true; continue; }
      if (inPlans) {
        if (!line.startsWith('- ')) { inPlans = false; continue; }
        const planM = line.match(/^- \[([x ])\] (\S+\.md) — (.+)/);
        if (planM) currentPhase.plans.push({ file: planM[2].trim(), name: planM[3].trim(), completed: planM[1] === 'x' });
      }
    }
  }

  return phases.sort((a, b) => a.number - b.number);
}
```

### Pattern 10: Health Check #6 (.slop dot)

**Current HealthStatusBar state (lines 28–59):** The `dots` array is built from the `ProjectHealth` interface. The `.slop` check comes from a separate `slopExists` fetch (not bundled into `/api/project-health`). Two options:

A. Add `slopExists` to `ProjectHealth` interface + `/api/project-health` endpoint response  
B. Pass `slopExists` as a separate prop to `HealthStatusBar`

**Recommended: Option B** — keeps the health endpoint focused on project env checks, not SlopMop-specific state. `slopExists` is already fetched in App.tsx for the onboarding modal trigger. Pass it through:

```typescript
// HealthStatusBar.tsx — add prop
interface HealthStatusBarProps {
  health: ProjectHealth;
  slopExists: boolean | null; // null = loading/no cwd
}

// Inside the dots array construction (after the node_modules push):
if (slopExists !== null) {
  dots.push({
    key: 'slop-config',
    label: slopExists
      ? 'SlopMop config (.slop) present'
      : 'SlopMop config (.slop) missing — click Get Started',
    status: slopExists ? 'ok' : 'warn',
  });
}
```

### Pattern 11: SettingsModal Vault Tab

**Current tab system (SettingsModal.tsx line 182):**
```typescript
type SettingsTab = 'display' | 'audio' | 'agent';
```

Add `vault`:
```typescript
type SettingsTab = 'display' | 'audio' | 'agent' | 'vault';
```

The tab bar render (lines 294–303) maps over `(['display', 'audio', 'agent'] as SettingsTab[])`. Change to include `'vault'` and add the label `'Vault'` to the conditional label expression.

The Vault tab body should be a separate `VaultTab` component that fetches `/api/vault-status` on mount and provides backup/restore buttons. Pass no props from SettingsModal — the component is self-contained (fetches its own data).

### Pattern 12: Vault Backup Targets (server-side constants)

```typescript
const HOME = os.homedir();
const BACKUP_ROOT = path.join(HOME, '.slop', 'backups');

const VAULT_TARGETS = [
  { id: 'claude-settings',       src: path.join(HOME, '.claude/settings.json'),              dest: path.join(BACKUP_ROOT, 'claude/settings.json') },
  { id: 'claude-settings-local', src: path.join(HOME, '.claude/settings.local.json'),        dest: path.join(BACKUP_ROOT, 'claude/settings.local.json') },
  { id: 'claude-md',             src: path.join(HOME, '.claude/CLAUDE.md'),                  dest: path.join(BACKUP_ROOT, 'claude/CLAUDE.md') },
  { id: 'claude-keybindings',    src: path.join(HOME, '.claude/keybindings.json'),           dest: path.join(BACKUP_ROOT, 'claude/keybindings.json') },
  { id: 'gsd-config',            src: path.join(HOME, '.claude/get-shit-done/config.json'),  dest: path.join(BACKUP_ROOT, 'gsd/config.json') },
  { id: 'git-config',            src: path.join(HOME, '.gitconfig'),                         dest: path.join(BACKUP_ROOT, 'git/.gitconfig') },
  { id: 'ssh-config',            src: path.join(HOME, '.ssh/config'),                        dest: path.join(BACKUP_ROOT, 'ssh/config') },
] as const;
```

### Anti-Patterns to Avoid

- **Don't use `fs.copyFile` for atomic writes** — it doesn't guarantee atomicity on crash. Use `writeFile` to temp + `rename`.
- **Don't block server startup for vault auto-backup** — fire-and-forget with `.catch(() => {})`, same pattern as `initPiper()` and `checkWhisper()` at line 917.
- **Don't add `slopExists` to `/api/project-health`** — the health endpoint already has 100ms debounce in `useProjectHealth`; bundling slop-status there couples two concerns and invalidates existing tests.
- **Don't use `localStorage.getItem` in the new OnboardingModal** — the old gate must be deleted entirely.
- **Don't make `useSettings` return a loading flag** — callers (App.tsx, SettingsModal) don't need it; defaults render immediately from localStorage.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic config writes | Custom file locking | `writeFile` to `.tmp` + `rename()` | Rename is atomic on POSIX filesystems; no lock needed for single-writer |
| Home dir resolution | String expansion of `~/` | `os.homedir()` | Handles edge cases (no HOME env var) — already in server/index.ts |
| mtime comparison | Timestamp parsing | `stat().mtimeMs` | Direct millisecond comparison, no date parsing |
| UUID for session IDs | Custom ID generation | `crypto.randomUUID()` | Already used in useSessionManager.ts |

**Key insight:** Every primitive needed in Phase 6 is already in the project's existing stdlib imports or within one import addition (`rename`, `stat` from `fs/promises`). No new packages.

---

## Common Pitfalls

### Pitfall 1: Double-Spawn Root Cause Misidentification

**What goes wrong:** Developers add more guards in App.tsx (`initialSpawnedRef`) without fixing the real dedup gap inside `spawn()`. This doesn't fully fix the StrictMode issue because `handleConnect` (line 169) bypasses `initialSpawnedRef` entirely.
**Why it happens:** `initialSpawnedRef` only guards the `useEffect` path, not the `handleConnect` path.
**How to avoid:** The fix is inside `spawn()` itself — if `initial: true` and a session with `name === ''` already exists, return its id. This is the single source of truth.
**Warning signs:** Two tabs visible on fresh load; both have `name === ''`; `sessions.length === 2` in React DevTools.

### Pitfall 2: OnboardingModal Shows on Every Render

**What goes wrong:** If `slopExists` state in App.tsx is reset to `null` on every cwd change (including during the async fetch), the modal flashes briefly while the fetch is pending.
**Why it happens:** `null` means "loading" but if the JSX renders `{cwd && slopExists === false && ...}`, null correctly suppresses the modal. Ensure `null` is not treated as `false`.
**How to avoid:** Use `slopExists === false` (strict equality), not `!slopExists`, in the JSX condition.

### Pitfall 3: useSettings Race Condition on Mount

**What goes wrong:** Server fetch returns settings that are older than what the user just changed in the same session.
**Why it happens:** The server fetch is async; if the user changes settings before the fetch completes, the fetch result overwrites the new state.
**How to avoid:** Only apply server settings on mount (in the `useEffect` with empty deps). The `update()` callback writes to server immediately — no re-fetch needed. Use a `mounted` boolean to skip applying server state if the component unmounts.

### Pitfall 4: parseRoadmapMd Breaking Existing Roadmap

**What goes wrong:** The rewritten parser returns phases in discovery order from `### Phase N:` sections. If the ROADMAP.md has detail sections before the `## Phases` list, or out of order, plans may appear wrong.
**How to avoid:** Sort phases by number at the end of the parse (`phases.sort((a, b) => a.number - b.number)`). The existing ROADMAP.md has detail sections after `## Phases` — the rewrite handles both orderings.

### Pitfall 5: Vault Backup Partial Failure

**What goes wrong:** `POST /api/vault-backup` copies 6 of 7 files and fails on the 7th. The endpoint returns an error, but 6 files are already backed up.
**Why it happens:** Non-atomic batch operation.
**How to avoid:** Process targets individually, collect `{ id, ok, error }` results, return all results even on partial failure. Client shows per-file status rather than all-or-nothing.

### Pitfall 6: SSH Config Backup vs Keys

**What goes wrong:** Accidentally backing up `~/.ssh/id_*` private key files.
**How to avoid:** The `VAULT_TARGETS` array is hardcoded to `~/.ssh/config` only (the text config file). Never use glob patterns or directory copies for SSH. The server should validate that no backup target path contains a substring like `id_rsa`, `id_ed25519`, `id_ecdsa`.

### Pitfall 7: Recent Paths localStorage Key Name

**What goes wrong:** The CONTEXT.md says `slopmop_recent_paths` is migrated. This key is not visible in the current codebase — it may not have been implemented yet in Phase 5.
**What we know:** Only `slopmop_last_folder` and `slopmop_settings` are confirmed localStorage keys in the current code. `slopmop_recent_paths` may be unused.
**How to avoid:** When implementing `GET/PUT /api/recent-paths`, the migration step should check for `slopmop_recent_paths` in localStorage — if absent, treat as empty array. Do not error.

---

## Code Examples

### Vault Status Endpoint

```typescript
// GET /api/vault-status — returns per-target sync state
app.get('/api/vault-status', async (_req, res) => {
  const results = await Promise.all(VAULT_TARGETS.map(async (t) => {
    let sourceExists = false;
    let backupExists = false;
    let inSync = false;
    let lastBackup: string | null = null;

    try { await fsAccess(t.src); sourceExists = true; } catch { /* missing */ }
    try {
      const bkStat = await stat(t.dest);
      backupExists = true;
      lastBackup = new Date(bkStat.mtimeMs).toISOString();
      if (sourceExists) {
        const srcStat = await stat(t.src);
        inSync = srcStat.mtimeMs <= bkStat.mtimeMs;
      }
    } catch { /* no backup */ }

    return { id: t.id, src: t.src, dest: t.dest, sourceExists, backupExists, inSync, lastBackup };
  }));
  res.json({ targets: results });
});
```

### Auto-Backup on Server Startup

```typescript
// Fire-and-forget — same pattern as initPiper() at server startup
async function autoBackupVault(): Promise<void> {
  await mkdir(BACKUP_ROOT, { recursive: true });
  for (const t of VAULT_TARGETS) {
    try {
      const newer = await isSourceNewer(t.src, t.dest);
      if (!newer) continue;
      await mkdir(path.dirname(t.dest), { recursive: true });
      const content = await readFile(t.src);
      await atomicWrite(t.dest, content.toString());
    } catch { /* per-target failure is acceptable */ }
  }
}

// In server listen callback:
server.listen(PORT, () => {
  console.log(`SlopMop server listening on :${PORT}`);
  initPiper().catch(() => {});
  checkWhisper().catch(() => {});
  autoBackupVault().catch(() => {}); // NEW
});
```

Note: `atomicWrite` above takes a string — for binary files, use `writeFile` directly to temp + `rename`. All vault targets are text files, so string is fine.

---

## State of the Art

| Old Approach | Current Approach | Rationale |
|--------------|------------------|-----------|
| `localStorage` for all settings | `~/.slop/settings.json` (server-side) | Survives browser cache clear, accessible to other tools |
| `localStorage` for onboarding flag | `.slop/` directory presence | Per-project onboarding; survives reinstall |
| Global-once onboarding | Per-cwd onboarding check | Every new project gets the wizard |
| `## Phases` list as parser gate | `### Phase N:` sections as primary source | GSD tools only write detail sections |

---

## Open Questions

1. **`slopmop_recent_paths` localStorage key**
   - What we know: The CONTEXT.md says to migrate this key, but it's not visible in the current codebase (`useSessionManager.ts` uses `slopmop_sessions_*` keys, not `recent_paths`)
   - What's unclear: Was `slopmop_recent_paths` ever implemented? If not, the migration step is a no-op
   - Recommendation: Implement `GET/PUT /api/recent-paths` endpoint and `recents.json` on server side. On migration, check localStorage for the key — if empty/absent, start with empty array. No error path needed.

2. **VaultTab `readFile` for binary config files**
   - What we know: All vault targets (`.json`, `.md`, `config`, `.gitconfig`) are text files
   - What's unclear: `.gitconfig` might have non-UTF8 characters on some systems
   - Recommendation: Read with `'utf-8'` encoding, catch errors per-file, mark as unreadable rather than failing the batch.

3. **Agent override from `.slop/config.json`**
   - What we know: The CONTEXT.md says per-project `agent` in `.slop/config.json` overrides `~/.slop/settings.json`
   - What's unclear: Where in App.tsx does the override apply? `useSettings` doesn't know about `cwd`
   - Recommendation: In App.tsx, after `slop-status` fetch succeeds and `config.agent` is present, call `updateSettings({ agent: config.agent })` to apply the override. This is a transient update — it reverts when cwd changes to a project without `.slop/config.json` agent field. Flag this as a planner decision point.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x + React Testing Library 16.x |
| Config file | `vite.config.ts` (Vitest runs via Vite) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Area | Behavior | Test Type | File |
|------|----------|-----------|------|
| Double-spawn bug | Only 1 session created on initial spawn even if called twice | unit | `tests/useSessionManager.test.ts` (extend existing) |
| Roadmap parser | Phases without `## Phases` list entry still parsed | unit | `tests/gsd.test.ts` (new file) |
| OnboardingModal | Shows when `slopExists === false`, hidden when `true` | unit | `tests/OnboardingModal.test.tsx` (extend existing) |
| HealthStatusBar | 6th dot renders for slop config state | unit | `tests/HealthStatusBar.test.tsx` (extend existing) |
| useSettings | Loads from server on mount, falls back to localStorage | unit | `tests/useSettings.test.ts` (new file) |
| VaultTab | Renders target list from vault-status data | unit | `tests/VaultTab.test.tsx` (new file) |

### Wave 0 Gaps

- [ ] `tests/gsd.test.ts` — covers roadmap parser rewrite (no existing test file for gsd.ts)
- [ ] `tests/useSettings.test.ts` — covers server-backed settings migration
- [ ] `tests/VaultTab.test.tsx` — covers vault UI rendering

*(Existing test files for `useSessionManager`, `OnboardingModal`, `HealthStatusBar` can be extended inline)*

---

## Sources

### Primary (HIGH confidence)
- Direct code reading of `server/index.ts` — all import patterns, endpoint patterns, startup hooks
- Direct code reading of `server/gsd.ts` — parser bug confirmed line-by-line
- Direct code reading of `client/hooks/useSettings.ts` — localStorage key `slopmop_settings`, `load()`/`save()` shape
- Direct code reading of `client/hooks/useSessionManager.ts` — `spawn()` dedup gap confirmed lines 83–106
- Direct code reading of `client/components/SettingsModal.tsx` — tab union type, tab bar render pattern
- Direct code reading of `client/components/OnboardingModal.tsx` — localStorage gate confirmed line 10
- Direct code reading of `client/components/HealthStatusBar.tsx` — dots array pattern, conditional push
- Node.js stdlib `fs.stat.mtimeMs` — verified live: `node -e "require('fs/promises').stat('/etc/hosts').then(s => console.log(s.mtimeMs))"` → returns valid timestamp
- Node.js stdlib `os.homedir()` — verified live: returns `/Users/rgv250cc`

### Secondary (MEDIUM confidence)
- Node.js documentation: `rename()` is atomic on POSIX (same filesystem) — standard best practice for config file writes

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all primitives verified in existing code or live Node.js calls
- Architecture: HIGH — patterns derived directly from reading existing server/client code
- Pitfalls: HIGH — most derived from direct code reading (spawn() dedup gap, parser gate, localStorage race)
- Open questions: LOW — one uncertainty around `slopmop_recent_paths` key existence

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (Node.js stdlib stable; no framework dependencies on fast-moving libs)
