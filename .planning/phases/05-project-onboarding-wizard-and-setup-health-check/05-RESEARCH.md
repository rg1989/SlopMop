# Phase 5: Project Onboarding Wizard and Setup Health Check - Research

**Researched:** 2026-05-01
**Domain:** UX flow design, filesystem probing, React modal patterns, Node.js fs APIs
**Confidence:** HIGH

## Summary

Phase 5 adds two interlocking capabilities: (1) a first-time onboarding wizard that guides a new user through connecting their first project folder and understanding SlopMop's key features, and (2) an ongoing health check panel that surfaces whether the active project has the prerequisites Claude Code needs to work well — git repo, CLAUDE.md, node_modules, agent CLI in PATH.

The project's existing infrastructure already provides all primitives needed: `/api/which` checks if a command is on PATH, `/api/git-branch` tells us if a folder is a git repo, `/api/rules` loads CLAUDE.md files, and `fs.access` on the server can check whether files/directories exist. No new server-side libraries are required. The only new endpoints needed are a health-check aggregator and possibly a CLAUDE.md bootstrap writer.

The right scope is deliberately narrow: this is a developer tool for a single power user. The wizard should be lightweight (not a multi-step onboarding carousel) — a single modal that appears the first time the app loads with no saved `cwd`, walks the user through picking a folder and shows them the three things to know. Health indicators live in the FolderPicker bar or a small status strip, not a dedicated page.

**Primary recommendation:** Build a `OnboardingModal` (shown once via localStorage flag) + a `useProjectHealth` hook that runs checks when `cwd` changes and surfaces results as a compact status bar row or status dots near the folder bar.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 18 | ^19.2.5 | Component + hook model | Already in project |
| Node.js `fs/promises` | built-in | File existence checks server-side | Already used extensively |
| Express | ^4.19.0 | New `/api/project-health` endpoint | Already in project |
| Vitest + RTL | ^3.0 | Tests for hook and modal | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| localStorage | browser built-in | Track "has seen onboarding" flag | One-time wizard suppression |
| `child_process.execFile` | built-in | `git rev-parse` to detect git repo | Already used for git ops |
| `fs.access` | built-in | Check file/dir existence without reading | Lightweight presence check |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom health endpoint | client-side checks via existing APIs | Server aggregation is one round-trip; client polling multiple APIs is noisier |
| Multi-step wizard carousel | Single modal with 3 bullet points | App is for a power user, not a new consumer; keep it minimal |
| Persistent health sidebar panel | Status dots/strip near folder bar | Less chrome; contextual; no layout disruption |

**Installation:**
```bash
# No new dependencies needed
```

## Architecture Patterns

### Recommended Project Structure
```
client/
├── components/
│   ├── OnboardingModal.tsx       # First-time welcome + project tips
│   └── ProjectHealthBar.tsx      # Compact health indicators strip
├── hooks/
│   └── useProjectHealth.ts       # Fetches /api/project-health on cwd change
server/
└── index.ts                      # Add GET /api/project-health endpoint
tests/
├── OnboardingModal.test.tsx      # Renders + localStorage suppression
└── useProjectHealth.test.ts      # Hook contract tests
```

### Pattern 1: One-Time Onboarding Modal
**What:** A modal gated by `localStorage.getItem('slopmop_onboarding_done')`. Shown when the app loads and `cwd` is null (no saved folder). Dismissed permanently on "Get Started" click.
**When to use:** First app load with no saved folder path.

```typescript
// OnboardingModal.tsx — simplified shape
const ONBOARDING_KEY = 'slopmop_onboarding_done';

export function useOnboardingVisible(cwd: string | null): [boolean, () => void] {
  const [visible, setVisible] = useState(
    () => !localStorage.getItem(ONBOARDING_KEY) && cwd === null
  );
  const dismiss = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setVisible(false);
  }, []);
  return [visible, dismiss];
}
```

**Integration point:** `App.tsx` calls `useOnboardingVisible(cwd)` and renders `<OnboardingModal>` when true. The modal's "Browse for folder" button calls the same `handleConnect` flow already used by `FolderPicker`.

### Pattern 2: Project Health Aggregator Endpoint
**What:** `GET /api/project-health?cwd=...` — runs all checks server-side and returns a single JSON blob. Client calls once when `cwd` changes.
**When to use:** Every time a new folder is connected.

```typescript
// server/index.ts — new endpoint shape
app.get('/api/project-health', async (req, res) => {
  const { cwd } = req.query as { cwd?: string };
  if (!cwd) { res.status(400).json({ error: 'cwd required' }); return; }

  const resolved = path.resolve(cwd);

  // Check 1: directory exists and is accessible
  let dirAccessible = false;
  try { await fsAccess(resolved); dirAccessible = true; } catch {}

  // Check 2: is a git repo
  let isGitRepo = false;
  try {
    await execFileAsync('git', ['-C', resolved, 'rev-parse', '--git-dir']);
    isGitRepo = true;
  } catch {}

  // Check 3: CLAUDE.md present
  let hasClaudeMd = false;
  try { await fsAccess(path.join(resolved, 'CLAUDE.md')); hasClaudeMd = true; } catch {}

  // Check 4: agent CLI in PATH (reuse commandExists already defined)
  const agentPath = await commandExists('claude'); // or from settings

  // Check 5: node_modules (optional — only relevant for JS projects)
  let hasNodeModules = false;
  try { await fsAccess(path.join(resolved, 'node_modules')); hasNodeModules = true; } catch {}

  res.json({
    dirAccessible,
    isGitRepo,
    hasClaudeMd,
    agentFound: agentPath !== null,
    agentPath,
    hasNodeModules,
  });
});
```

### Pattern 3: useProjectHealth Hook
**What:** React hook that fetches the health endpoint when `cwd` changes and returns typed results.
**When to use:** Mounted once in App.tsx; result passed to ProjectHealthBar.

```typescript
// client/hooks/useProjectHealth.ts
export interface ProjectHealth {
  loading: boolean;
  dirAccessible: boolean;
  isGitRepo: boolean;
  hasClaudeMd: boolean;
  agentFound: boolean;
  agentPath: string | null;
  hasNodeModules: boolean | null;
}

export function useProjectHealth(cwd: string | null): ProjectHealth {
  const [health, setHealth] = useState<ProjectHealth>(initialHealth);

  useEffect(() => {
    if (!cwd) { setHealth(initialHealth); return; }
    setHealth(prev => ({ ...prev, loading: true }));
    fetch(`/api/project-health?cwd=${encodeURIComponent(cwd)}`)
      .then(r => r.json())
      .then(data => setHealth({ loading: false, ...data }))
      .catch(() => setHealth(prev => ({ ...prev, loading: false })));
  }, [cwd]);

  return health;
}
```

### Pattern 4: ProjectHealthBar (compact inline indicators)
**What:** A slim row of status dots / icons rendered just below the `FolderPicker` bar when a project is open. Each indicator is a colored dot with a tooltip. Clicking on a failing check opens an inline suggestion.
**When to use:** Always visible when `cwd !== null`; collapses or hides when all green.

```
[● git] [● CLAUDE.md] [● claude CLI]
 green    warning        green
```

Status color mapping:
- Green (`--success`): check passed
- Amber (`--warning`): missing but non-critical (node_modules, CLAUDE.md)
- Red (`--error`): blocking (agent CLI not found, directory inaccessible)

### Anti-Patterns to Avoid
- **Full multi-step wizard with page routing:** SlopMop has no router; modals are the established pattern. Don't introduce react-router.
- **Polling health on a timer:** Check once per `cwd` change. Continuous polling is noisy and unnecessary for file-system state.
- **Blocking the terminal spawn on health checks:** Health is informational only. Claude Code sessions spawn regardless of health state. Never gate PTY spawn on health results.
- **Writing CLAUDE.md automatically without user confirmation:** Auto-creation of project files is surprising. At most, offer a "Create CLAUDE.md" button that shows a template in a modal for the user to confirm.
- **New raw hex values in styles:** All health indicator colors must use CSS variables (`--success`, `--warning`, `--error`) per CLAUDE.md.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent CLI detection | Custom PATH walker | `/api/which` (already exists) + `commandExists()` (already exists in server) | Already battle-tested, handles edge cases |
| Git repo detection | Custom `.git` folder check | `git rev-parse --git-dir` via execFileAsync | Handles worktrees, submodules; already used everywhere |
| CLAUDE.md existence | Custom file reader | `fs.access` (already used throughout server) | Minimal — no need to read, just probe |
| Modal overlay pattern | New system | Established `modal-overlay` + `modal-panel` CSS classes already in App.css | Consistency with SettingsModal, ConfirmModal patterns |
| Tooltip pattern | New tooltip lib | `InfoTip` component + `info-tooltip-portal` CSS (already in SettingsModal) | Already extracted and used |

**Key insight:** Every infrastructure primitive needed for this phase already exists in the codebase. This phase is purely about UX surface, not new infrastructure.

## Common Pitfalls

### Pitfall 1: Modal shown on every reload after folder reconnect
**What goes wrong:** The onboarding modal reappears when cwd is null momentarily during page load before `localStorage` restores the folder.
**Why it happens:** `getInitialPath()` reads localStorage, but the modal visibility check runs synchronously on first render before `handleConnect` fires.
**How to avoid:** Gate the modal on BOTH `!localStorage.getItem(ONBOARDING_KEY)` AND `initialPath === null` (not `cwd === null`). `initialPath` is a stable `useState` initial value. If there's a saved path, don't show the wizard.
**Warning signs:** Modal flashes briefly on every reload.

### Pitfall 2: Health check fires before folder is fully accessible
**What goes wrong:** Health API called immediately on `cwd` change; directory may be briefly inaccessible if user just picked a path via osascript.
**Why it happens:** osascript returns the path before macOS finishes updating permissions/attributes in some edge cases.
**How to avoid:** Add a minimal debounce (100ms) before firing the health fetch. The `useEffect` cleanup pattern handles rapid cwd changes correctly anyway.
**Warning signs:** `dirAccessible: false` for a valid directory on first connection.

### Pitfall 3: Health indicators are distracting when everything is green
**What goes wrong:** Permanent status bar adds visual noise without value.
**Why it happens:** Designed to always show, even when nothing needs attention.
**How to avoid:** Hide the health bar entirely (or show a single tiny "all clear" dot) when all checks pass. Only expand to show individual indicators when at least one is non-green.
**Warning signs:** User feedback that the bar is distracting.

### Pitfall 4: Checking node_modules for non-JS projects
**What goes wrong:** `hasNodeModules: false` shown as a warning for a Python or Rust project.
**Why it happens:** node_modules check is JS-centric.
**How to avoid:** Only surface node_modules warning if a `package.json` also exists in the cwd. Otherwise omit it from results or set it to `null` (N/A).
**Warning signs:** False amber indicators on non-JS repos.

### Pitfall 5: CLAUDE.md "create" action generates boilerplate without context
**What goes wrong:** Auto-generated CLAUDE.md is generic and the user doesn't review it.
**Why it happens:** Convenience shortcut that skips the thinking step.
**How to avoid:** The "Create CLAUDE.md" CTA should open a modal pre-filled with a minimal template and require the user to explicitly save. Do not write the file automatically.

## Code Examples

Verified patterns from the existing codebase:

### Modal overlay (matches established pattern in App.css)
```typescript
// Source: SettingsModal.tsx, ConfirmModal.tsx — consistent across codebase
<div className="modal-overlay" onClick={onClose}>
  <div className="modal-panel" onClick={e => e.stopPropagation()}>
    <div className="modal-header">
      <span className="modal-title">Welcome to SlopMop</span>
    </div>
    <div className="modal-body">
      {/* content */}
    </div>
    <div className="modal-footer">
      <button className="fp-btn primary" onClick={onClose}>Get Started</button>
    </div>
  </div>
</div>
```

### Status dot indicator (new pattern, follows design system)
```css
/* In App.css — follows existing variable + sizing conventions */
.health-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.health-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  cursor: default;
}

.health-dot--ok     { background: var(--success); }
.health-dot--warn   { background: var(--warning); }
.health-dot--error  { background: var(--error); }
.health-dot--loading { background: var(--border-muted); }
```

### localStorage-gated one-time modal
```typescript
// Source: established pattern from FolderPicker.tsx (RECENT_PATHS_KEY)
const HAS_ONBOARDED_KEY = 'slopmop_onboarded';

function hasOnboarded(): boolean {
  return !!localStorage.getItem(HAS_ONBOARDED_KEY);
}
function markOnboarded(): void {
  localStorage.setItem(HAS_ONBOARDED_KEY, '1');
}
```

### Server health check using existing helpers
```typescript
// Source: commandExists() already at line 61 of server/index.ts
// Source: fsAccess already imported at line 8 of server/index.ts
// Source: execFileAsync already at line 17 of server/index.ts
// All three are already available — no new imports needed
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multi-page onboarding wizards | Single informational modal | Industry shift ~2020 | Less friction; power tools skip tutorial theater |
| Always-visible status bars | Contextual/dismissible indicators | VS Code 1.x → current | Reduced chrome; shows only when actionable |
| Client-side file checks via fetch per item | Server-side aggregated health endpoint | N/A (design choice) | One round-trip vs. 5+ |

**Deprecated/outdated:**
- Multi-step wizard with "Next" buttons: appropriate for consumer apps, not power tools.
- Reading CLAUDE.md to check its contents for health: just presence check is sufficient; content quality is Claude's job, not ours.

## Open Questions

1. **Which agent CLI should health check target?**
   - What we know: The settings `agent.command` field is configurable (default: `claude`).
   - What's unclear: Should health check use the *current settings value* or always check `claude`? If settings haven't loaded yet, we don't know the target.
   - Recommendation: Pass the agent command as a query param to `/api/project-health?cwd=...&agent=claude` so the check is settings-aware.

2. **Should the onboarding modal include a mini feature tour?**
   - What we know: App is a power tool for a single user who likely knows what they're doing.
   - What's unclear: Is there value in showing "here's what the sidebar tabs do"?
   - Recommendation: Keep it to 3 bullet points max: (1) pick a folder, (2) the sidebar tabs, (3) voice. No carousel.

3. **Should we show a "CLAUDE.md missing" warning inline in the terminal area vs. in the health bar?**
   - What we know: Claude Code uses CLAUDE.md for project context; missing it degrades output quality.
   - What's unclear: Is a status bar warning sufficient or should it be more prominent (e.g., a banner)?
   - Recommendation: Status bar dot is sufficient. A banner would be intrusive. The warning is advisory, not blocking.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x + React Testing Library 16.x |
| Config file | vite.config.ts (vitest config inline) |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ONBOARD-01 | OnboardingModal renders when no saved folder + not yet onboarded | unit | `npm test -- --run OnboardingModal` | ❌ Wave 0 |
| ONBOARD-02 | OnboardingModal does NOT render when `initialPath` is set | unit | `npm test -- --run OnboardingModal` | ❌ Wave 0 |
| ONBOARD-03 | Dismissing modal sets localStorage key | unit | `npm test -- --run OnboardingModal` | ❌ Wave 0 |
| HEALTH-01 | useProjectHealth returns loading:true then resolves | unit | `npm test -- --run useProjectHealth` | ❌ Wave 0 |
| HEALTH-02 | useProjectHealth resets on cwd change | unit | `npm test -- --run useProjectHealth` | ❌ Wave 0 |
| HEALTH-03 | ProjectHealthBar renders correct dot colors per health state | unit | `npm test -- --run ProjectHealthBar` | ❌ Wave 0 |
| HEALTH-04 | /api/project-health returns correct shape for valid git repo | integration (manual) | manual verification | N/A |

### Sampling Rate
- **Per task commit:** `npm test -- --run`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/OnboardingModal.test.tsx` — covers ONBOARD-01, ONBOARD-02, ONBOARD-03
- [ ] `tests/useProjectHealth.test.ts` — covers HEALTH-01, HEALTH-02
- [ ] `tests/ProjectHealthBar.test.tsx` — covers HEALTH-03

*(Existing test infrastructure — Vitest + RTL + setup.ts — fully covers all new tests. No framework install needed.)*

## Sources

### Primary (HIGH confidence)
- Codebase direct read: `server/index.ts` — existing endpoints, `commandExists()`, `fsAccess`, `execFileAsync` patterns
- Codebase direct read: `client/components/SettingsModal.tsx` — modal structure, InfoTip tooltip, tab patterns
- Codebase direct read: `client/components/FolderPicker.tsx` — localStorage patterns, recent paths, connect flow
- Codebase direct read: `client/App.tsx` — `getInitialPath()`, `handleConnect`, `useState(getInitialPath)` pattern
- Codebase direct read: `CLAUDE.md` — design system constraints (CSS variables, no new hex, no external libs)

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — decision log confirming existing architectural choices (React hooks only, no Redux)
- `.planning/REQUIREMENTS.md` + `.planning/ROADMAP.md` — phase scope context

### Tertiary (LOW confidence)
- None — all findings are grounded in direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all primitives verified in existing code
- Architecture: HIGH — modal + hook pattern is established; endpoint shape follows existing patterns
- Pitfalls: HIGH — derived from direct code analysis of existing patterns and their edge cases

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (stable codebase; patterns won't drift)
