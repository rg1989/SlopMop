# Phase 4: Multi-Session Tabs - Research

**Researched:** 2026-05-01
**Domain:** Multi-PTY session management, React state architecture, WebSocket multiplexing, localStorage persistence
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SESS-01 | User can spawn multiple terminal sessions within the same workspace | usePty must be instantiated per-session; ws-handler needs session-ID routing or one WS per session |
| SESS-02 | Navigate between sessions via a tab bar (terminal session tabs) | New `SessionTabBar` component above the terminal area; active sessionId drives which usePty renders |
| SESS-03 | Live status indicators on each tab (working / waiting / error / done) | PTY `onData` heuristic + exit event drive per-session status enum; indicator rendered in tab chip |
| SESS-04 | Session name derived from first prompt sent by the user | Intercept first `sendInput` call per session; strip control chars; truncate to ~40 chars |
| SESS-05 | Session history persists across page reloads | Closed session metadata (id, name, cwd, status, closedAt) stored in localStorage per-cwd key |
| SESS-06 | Architecture structured for future full PTY reconnect without client-side changes | Server assigns stable `sessionId`; protocol carries it from the start; client reconnect path is wire-compatible even if server kill-on-close is kept for v1 |
</phase_requirements>

---

## Summary

The codebase is explicitly pre-wired for multi-session. `useSession` has a top-of-file comment: *"When SlopMop grows to support multiple concurrent sessions, App renders an array of these — one per session."* The `EditorTabBar`/`useEditorTabs` infrastructure for file preview tabs is already in place and demonstrates the exact tab-management pattern to replicate. The `usePty` hook creates one WebSocket + one PTY per invocation, so multiple concurrent sessions need only multiple hook instances — no server-side multiplexer is needed in v1.

The key design question is **where session state lives**. The cleanest answer, consistent with the existing architecture, is a new `useSessionManager` hook that owns an array of `SessionEntry` objects (id, name, status, PTY handle, editor tabs, attachments). `App` renders the active session's `<Terminal>` and passes all per-session props through. Inactive sessions stay mounted but invisible (display:none) so xterm.js state is preserved; or they are unmounted and restored from a scrollback snapshot when re-activated.

Status detection is the trickiest requirement. The heuristic used by terminals like iTerm2/Warp: if PTY emits output within the last N ms → "working"; if last output was > N ms ago and PTY is alive → "waiting"; PTY exit → "done" or "error" based on exit code. A 1-second debounce is sufficient for Claude CLI's usage pattern.

**Primary recommendation:** One `WebSocket + node-pty` process per session (already the server model). Add stable `sessionId` (UUID) to the `start` protocol message. Client manages an array of sessions in `useSessionManager`. Status derived from `onData` timing + exit code. Closed session metadata persisted to `localStorage`. Keep inactive sessions mounted (display:none) in v1 — avoids the xterm.js re-init complexity.

---

## Standard Stack

### Core (already in project — no new installs needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `crypto.randomUUID()` | Web API | Stable session UUIDs | Built into modern browsers; no dependency |
| React `useState`/`useRef`/`useCallback` | React 19 | Session array management | Project standard |
| `localStorage` | Web API | Session history persistence | Already used for `slopmop_ui_{cwd}` |
| `node-pty` | 1.1.0 | PTY per session | Already installed |
| WebSocket (`ws`) | 8.17.0 | One WS per session | Already installed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@xterm/xterm` | 6.0.0 | Terminal per session | One Terminal instance per SessionEntry |
| `@xterm/addon-fit` | 0.11.0 | Resize per session | Called per terminal on resize |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| One WS per session | Multiplexed WS with session-ID framing | Multiplexing reduces connection count but adds server complexity; with ≤10 sessions the per-WS model is simpler |
| Mounted but hidden (display:none) | Unmount + serialize scrollback | display:none preserves all xterm.js state trivially; serializing scrollback requires xterm's `serialize` addon (extra dep) |
| UUID from `crypto.randomUUID()` | `nanoid` | `crypto.randomUUID()` is built in since Node 15 / Chrome 92 — no dependency needed |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure

No new top-level directories needed. New files:

```
client/
├── hooks/
│   └── useSessionManager.ts    # NEW — array of SessionEntry, active session, history
├── components/
│   └── SessionTabBar.tsx       # NEW — terminal session tabs with status chips
shared/
└── protocol.ts                 # MODIFY — add sessionId to start message
server/
└── ws-handler.ts               # MODIFY — echo sessionId back to client on start
```

### Pattern 1: SessionEntry Shape

**What:** A plain object describing one terminal session's full state.
**When to use:** Stored in `useSessionManager`'s state array. Passed as prop sets to sub-components.

```typescript
// Source: derived from existing useSession + STATE.md decisions
type SessionStatus = 'connecting' | 'waiting' | 'working' | 'done' | 'error';

interface SessionEntry {
  id: string;               // stable UUID — crypto.randomUUID()
  name: string;             // derived from first user prompt; starts as "Session N"
  status: SessionStatus;
  cwd: string;
  createdAt: number;        // Date.now()
}

// Persisted shape (closed sessions — written to localStorage)
interface PersistedSession {
  id: string;
  name: string;
  cwd: string;
  status: 'done' | 'error';
  closedAt: number;
}
```

### Pattern 2: useSessionManager Hook

**What:** Owns the array of live sessions. Replaces the single `useSession` call in App.tsx.
**When to use:** App.tsx calls this once; renders `<SessionTabBar>` and the active session's terminal.

```typescript
// Source: derived from existing useSession pattern + STATE.md multi-session comment
interface UseSessionManagerReturn {
  sessions: SessionEntry[];
  activeId: string | null;
  spawn: (cwd: string) => string;   // returns new sessionId
  close: (id: string) => void;
  setActive: (id: string) => void;
  updateName: (id: string, name: string) => void;
  updateStatus: (id: string, status: SessionStatus) => void;
  history: PersistedSession[];      // closed sessions from localStorage
}
```

### Pattern 3: One Terminal Component per Session (display:none for inactive)

**What:** Each session renders its own `<Terminal>` inside a wrapper with `display: none` when inactive.
**When to use:** Preserves xterm.js DOM state without re-initialization.

```tsx
// Source: xterm.js docs — Terminal element must stay mounted to retain buffer
{sessions.map(s => (
  <div
    key={s.id}
    style={{ display: s.id === activeId ? 'flex' : 'none', flex: 1, overflow: 'hidden' }}
  >
    <TerminalComponent
      onReady={(t) => handleTerminalReady(s.id, t)}
      sendResize={s.sendResize}
    />
  </div>
))}
```

### Pattern 4: Status Detection via onData + Exit

**What:** Debounced activity tracking to transition between `working` and `waiting`.
**When to use:** Inside `usePty` via the `onData` callback; exit message triggers `done`/`error`.

```typescript
// Source: derived from existing usePty onData + ws onmessage patterns
// In usePty (or useSessionManager wrapping it):
const workingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// In onData handler:
onStatusChange('working');
if (workingTimerRef.current) clearTimeout(workingTimerRef.current);
workingTimerRef.current = setTimeout(() => onStatusChange('waiting'), 1200);

// On PTY exit (code 0 → 'done', else → 'error'):
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'exit') {
    onStatusChange(msg.code === 0 ? 'done' : 'error');
  }
};
```

### Pattern 5: First-Prompt Name Extraction

**What:** Intercept the first non-empty `sendInput` call; strip ANSI/control chars; use as session name.
**When to use:** In `useSessionManager.spawn` or in the `sendInput` wrapper per session.

```typescript
// Source: derived from existing Composer sendInput pattern (Phase 1 decisions)
function extractSessionName(raw: string): string {
  // Strip \r at end (PTY submit char), ANSI escapes, trim
  return raw
    .replace(/\r$/, '')
    .replace(/\x1b\[[0-9;]*[mGKH]/g, '')
    .trim()
    .slice(0, 40) || 'Session';
}
```

### Pattern 6: Protocol Extension for sessionId

**What:** Add `sessionId` to the `start` ClientMessage so the server can route back to the correct client.
**When to use:** Needed for SESS-06 future-reconnect compatibility.

```typescript
// Modify shared/protocol.ts:
export type ClientMessage =
  | { type: 'start'; sessionId: string; cwd: string; cols: number; rows: number; agentCommand: string; agentArgs: string[] }
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'kill' };

// Server echoes it back for confirmation (optional in v1, required for reconnect in v2):
export type ServerMessage =
  | { type: 'data'; data: string }
  | { type: 'exit'; code: number }
  | { type: 'error'; message: string }
  | { type: 'session-ready'; sessionId: string };  // NEW
```

### Pattern 7: localStorage Persistence for Session History

**What:** Closed sessions written to `slopmop_sessions_{cwd}` key. Max 20 entries (ring-buffer).
**When to use:** `close()` in `useSessionManager` triggers a write.

```typescript
// Source: consistent with existing slopmop_ui_{cwd} pattern in App.tsx
const HISTORY_KEY = (cwd: string) => `slopmop_sessions_${cwd}`;
const MAX_HISTORY = 20;

function saveSessionHistory(cwd: string, entry: PersistedSession) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY(cwd));
    const existing: PersistedSession[] = raw ? JSON.parse(raw) : [];
    const updated = [entry, ...existing].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY(cwd), JSON.stringify(updated));
  } catch {}
}
```

### Anti-Patterns to Avoid

- **Unmounting inactive terminals:** xterm.js loses its scrollback buffer and requires full re-initialization. Use `display: none` instead.
- **Sharing one WebSocket across sessions:** The current ws-handler is stateful per-connection (one `ptyProcess` ref per WS). Multiplexing would require a server rewrite. Keep one WS per session.
- **Storing the full terminal scrollback in localStorage:** xterm.js buffers can be large. Only persist metadata (name, status, cwd, timestamps) — not terminal content.
- **Keying Terminal on sessionId directly:** If the session ID is used as the React key and it changes, xterm.js will be destroyed and re-created. Keep keys stable.
- **Letting App.tsx grow further:** All session management logic belongs in `useSessionManager`. App.tsx should only pass `sessions`, `activeId`, and `SessionTabBar` props through.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique session IDs | Custom incrementing counter | `crypto.randomUUID()` | Browser-native, zero collision risk, no dependency |
| Tab scroll overflow | Custom scroll logic | Copy the existing `EditorTabBar` pattern (ResizeObserver + scrollBy) | Already solved in the codebase |
| PTY per session | Server-side session registry | One WebSocket connection = one PTY (existing ws-handler model) | No new server code needed for v1 |
| ANSI stripping for names | Full ANSI parser | Simple regex: `/\x1b\[[0-9;]*[mGKH]/g` | Sufficient for session name extraction; full parser adds dep |

**Key insight:** The project's architecture already assumes multi-session. The migration path is additive: wrap one `useSession` in an array, add `useSessionManager`, add `SessionTabBar`. The server needs only the `sessionId` field added to the `start` message.

---

## Common Pitfalls

### Pitfall 1: xterm.js Terminal Destroyed on Unmount
**What goes wrong:** If `<TerminalComponent>` is conditionally rendered (`{activeId === s.id && <TerminalComponent>}`), xterm.js tears down the terminal DOM node on every switch. On remount it calls `terminal.reset()` (see usePty `ws.onopen`), clearing the buffer.
**Why it happens:** React unmounts the DOM subtree; xterm.js loses its canvas renderer.
**How to avoid:** Keep all session terminals mounted; toggle visibility with `style={{ display: 'none' }}`.
**Warning signs:** Terminal shows blank on tab switch; PTY output is lost; `onReady` fires twice.

### Pitfall 2: Multiple usePty Instances Racing on Resize
**What goes wrong:** All mounted sessions receive the window resize event and call `sendResize`. Inactive sessions send resize to their own PTY (which is fine), but if the inactive terminal's `cols/rows` don't match the visible container, switching back shows mis-sized output.
**Why it happens:** `useResize` fires for every mounted terminal.
**How to avoid:** Only pass `sendResize` to active sessions; or pass it to all but let xterm's fitAddon calculate correctly since all terminals share the same DOM slot.
**Warning signs:** Terminal output looks compressed or stretched after tab switch.

### Pitfall 3: sendInput Name Capture Misses Slash Commands
**What goes wrong:** Slash commands like `/help` are sent via the Composer but the first-prompt extraction should still capture them meaningfully.
**Why it happens:** The raw send value includes the slash.
**How to avoid:** Accept slash commands as valid names. The extraction regex only strips control chars — `/help` becomes a valid name "help".

### Pitfall 4: Status Indicator Thrashing
**What goes wrong:** Claude CLI emits many small output chunks rapidly. If each chunk flips status to "working" and the debounce resets, the indicator never stabilizes.
**Why it happens:** Short debounce + high-frequency output.
**How to avoid:** Use 1200ms debounce (matches Claude CLI's ~1s prompt redraw cycle). Test with rapid output: status should stay "working" until output stops for 1.2s.

### Pitfall 5: localStorage Key Collision on cwd Switch
**What goes wrong:** Session history for `/path/a` is written under `slopmop_sessions_/path/a`; if user switches cwd, history from old cwd shows under new cwd.
**Why it happens:** Key includes cwd already — this is fine. The pitfall is only if key is global (no cwd suffix).
**How to avoid:** Always key by cwd: `slopmop_sessions_${cwd}`. Load on cwd change (same pattern as existing `slopmop_ui_${cwd}`).

### Pitfall 6: Protocol Backward Compatibility
**What goes wrong:** Adding `sessionId` to `start` message breaks existing `ws-handler.ts` if it validates the message shape strictly.
**Why it happens:** TypeScript strict typing on the server.
**How to avoid:** Add `sessionId` as optional (`sessionId?: string`) in a transitional step, or update both sides atomically in the same plan.

---

## Code Examples

Verified patterns from project source:

### Spawning a New Session (useSessionManager)
```typescript
// Source: derived from usePty.ts + useSession.ts patterns
const spawn = useCallback((cwd: string): string => {
  const id = crypto.randomUUID();
  setSessions(prev => [...prev, {
    id,
    name: `Session ${prev.length + 1}`,
    status: 'connecting',
    cwd,
    createdAt: Date.now(),
  }]);
  return id;
}, []);
```

### SessionTabBar Status Chip CSS Classes
```typescript
// Source: consistent with existing .editor-tab pattern in App.css
// Status → CSS class mapping:
const STATUS_CLASS: Record<SessionStatus, string> = {
  connecting: 'status--connecting',
  waiting:    'status--waiting',
  working:    'status--working',
  done:       'status--done',
  error:      'status--error',
};
// Colors aligned with accent: working=#d4845a, waiting=#8b949e, done=#3fb950, error=#f85149
```

### Persisting on Session Close
```typescript
// Source: consistent with App.tsx saveUIState pattern
const close = useCallback((id: string) => {
  setSessions(prev => {
    const session = prev.find(s => s.id === id);
    if (session) {
      saveSessionHistory(session.cwd, {
        id: session.id,
        name: session.name,
        cwd: session.cwd,
        status: session.status === 'working' ? 'done' : session.status as 'done' | 'error',
        closedAt: Date.now(),
      });
    }
    return prev.filter(s => s.id !== id);
  });
}, []);
```

### usePty Called per Session in useSessionManager
```typescript
// Source: useSession.ts — existing single-session call pattern
// useSessionManager renders one usePty per session entry via child components,
// OR maintains a Map<sessionId, UsePtyReturn> — the latter requires
// hooks to not be called conditionally. Recommended: render one
// <SessionPty key={s.id}> component per session that calls usePty internally.
// This is consistent with the existing useSession → usePty delegation.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single session, single usePty | Array of sessions, one usePty per | Phase 4 | App.tsx comment already signals this migration |
| No session metadata | SessionEntry with id/name/status | Phase 4 | Enables tab bar UX and persistence |
| No history | Closed sessions in localStorage | Phase 4 | SESS-05 requirement |

**Deprecated/outdated for Phase 4:**
- Direct `useSession` call in App.tsx: replaced by `useSessionManager` which owns the array.
- Single `<TerminalComponent>` in App.tsx: replaced by mapped session terminals with display:none toggling.

---

## Open Questions

1. **How many concurrent sessions to support before imposing a limit?**
   - What we know: node-pty allocates a real OS process per session; 10 concurrent Claude CLI processes would be heavy.
   - What's unclear: no requirement specifies a maximum.
   - Recommendation: Soft cap of 8 sessions enforced in `spawn()` — show a toast if exceeded. This is an implementation detail the planner should choose; default to 8.

2. **Should inactive session PTYs remain alive when their tab is closed (background vs killed)?**
   - What we know: SESS-06 says "structured for future PTY reconnect" — implies sessions may eventually outlive their tab.
   - What's unclear: SESS-05 only says history persists, not that the process stays alive.
   - Recommendation: Kill PTY on tab close in v1 (consistent with existing `ws.onclose` kill behavior). The `sessionId` in the protocol future-proofs reconnect without client changes.

3. **Should the xterm.js `serialize` addon be added for inactive-session scrollback preservation?**
   - What we know: display:none keeps the live DOM but consumes memory for all sessions.
   - What's unclear: No requirement specifies scrollback preservation across switches.
   - Recommendation: Use display:none without serialize. If memory becomes an issue, that's a Phase 5 concern.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x + @testing-library/react 16 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESS-01 | `useSessionManager.spawn()` adds a new SessionEntry to the array | unit | `npm test -- --reporter=verbose tests/useSessionManager.test.ts` | ❌ Wave 0 |
| SESS-02 | `SessionTabBar` renders one tab per session, highlights active | unit | `npm test -- --reporter=verbose tests/SessionTabBar.test.tsx` | ❌ Wave 0 |
| SESS-03 | Status transitions: connecting → waiting → working → done | unit | `npm test -- --reporter=verbose tests/useSessionManager.test.ts` | ❌ Wave 0 |
| SESS-04 | First prompt sets session name; subsequent sends do not | unit | `npm test -- --reporter=verbose tests/useSessionManager.test.ts` | ❌ Wave 0 |
| SESS-05 | `close()` writes to localStorage; reloaded manager reads history | unit | `npm test -- --reporter=verbose tests/useSessionManager.test.ts` | ❌ Wave 0 |
| SESS-06 | Protocol `start` message includes `sessionId` field | unit | `npm test -- --reporter=verbose tests/usePty.test.ts` | ✅ (extend existing) |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/useSessionManager.test.ts` — covers SESS-01, SESS-03, SESS-04, SESS-05
- [ ] `tests/SessionTabBar.test.tsx` — covers SESS-02
- [ ] Extend `tests/usePty.test.ts` — assert `sessionId` sent in start message (SESS-06)

*(Existing test infrastructure and setup.ts are fully compatible — no new framework install needed.)*

---

## Sources

### Primary (HIGH confidence)
- Direct codebase reading: `client/hooks/usePty.ts`, `useSession.ts`, `useEditorTabs.ts`, `App.tsx`
- Direct codebase reading: `server/ws-handler.ts`, `server/pty-manager.ts`, `shared/protocol.ts`
- Direct codebase reading: `client/components/EditorTabBar.tsx`, `vitest.config.ts`, `tests/setup.ts`
- `.planning/STATE.md` — Accumulated decisions section documents multi-session intent explicitly

### Secondary (MEDIUM confidence)
- xterm.js architecture knowledge (display:none preservation) — consistent with known xterm.js DOM model
- Node.js `crypto.randomUUID()` — available since Node 15.6; project uses Node 22+ (tsconfig targets ES2022)

### Tertiary (LOW confidence)
- None — all findings are grounded in codebase inspection or well-established Web/Node APIs.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; everything verified in package.json
- Architecture: HIGH — usePty/useSession/useEditorTabs patterns read directly from source
- Pitfalls: HIGH — derived from direct code analysis of existing xterm.js integration and PTY lifecycle
- Validation: HIGH — vitest.config.ts and test patterns read directly from tests/

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (stable stack; xterm.js API unlikely to change)
