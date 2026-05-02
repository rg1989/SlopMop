# Phase 12: bottom-panel-shell - Research

**Researched:** 2026-05-03
**Domain:** React layout restructuring — adding a horizontal bottom panel zone with drag-resize, collapse toggle, tab bar scaffold, and localStorage persistence
**Confidence:** HIGH

## Summary

Phase 12 adds a bottom panel zone below the main session area (`.main-area`). The current `.main-area` is a flex column containing the terminal area and session panes. The bottom panel will be a new flex child at the bottom of `.main-area`, separated from the terminal area by a horizontal resize handle (`.resize-handle--h`).

The project already contains every primitive needed: `useDragResize('up', ...)` handles upward-growing vertical drag; `.resize-handle--h` is the existing horizontal drag separator CSS class; `uiRead`/`uiWrite` handle localStorage persistence; and the session tab bar patterns (`.session-tab-bar`, `.session-tab`) provide a ready-made visual language for the tab bar scaffold. No new dependencies are required.

The primary structural change is in `App.tsx`: the `.main-area` div's content is split into an upper flex-grow terminal zone and a lower collapsible bottom panel. The bottom panel has a header/tab bar scaffold (placeholder — no wired tabs yet), a collapse toggle button, a `.resize-handle--h` separator, and height + open/closed state persisted to localStorage. Phase 13 will populate the bottom panel with raw PTY terminal tabs; Phase 12 only builds the shell.

**Primary recommendation:** Wrap the existing `.terminal-area` and new bottom panel inside `.main-area` as a flex column. Add a `bottomPanelOpen` boolean and `bottomPanelHeight` number to App state, both persisted via `uiRead`/`uiWrite`. Use `useDragResize('up', ...)` for the panel height. Render the `.resize-handle--h` and bottom panel div conditionally on `bottomPanelOpen`; the toggle button is always visible.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React hooks (useState, useRef, useCallback, useEffect) | 18 | State, effects, collapse toggle | Project-wide pattern — no Redux/Zustand |
| `useDragResize` (internal) | — | Drag-to-resize bottom panel height | Already used for sidebar, editor, and canvas column |
| localStorage via `uiRead`/`uiWrite` | — | Persist panel height and open/closed state | Already used for sidebar width, editor width, canvas width/visibility |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest + @testing-library/react | ^3 / ^16 | Unit tests for toggle and persistence | Required — nyquist_validation enabled |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useDragResize('up', ...)` | Custom onMouseDown/onMouseMove | useDragResize already handles min/max clamping and drag-end; no reason to hand-roll |
| Rendering panel only when open | Always-render, height:0 when closed | Conditional render is simpler; Phase 13 will own any unmount complexity for PTY processes inside it |

**Installation:**
```bash
# No new packages — zero dependency change
```

## Architecture Patterns

### Current Layout Structure (after Phase 11)
```
.app (flex column)
  .folder-bar
  .app-body (flex row, flex: 1)
    .sidebar (flex-shrink: 0)
    .resize-handle (col-resize)
    .main-area (flex: 1, flex-direction: column, min-width: 280px)
      .terminal-area (flex: 1 — SessionTabBar + SessionPanes)
    .resize-handle (col-resize)         [conditional on activeTabs]
    .editor-panel (flex-shrink: 0)      [conditional on activeTabs]
    .resize-handle (col-resize)         [conditional on isCanvasVisible]
    .canvas-column (flex-shrink: 0)     [conditional on isCanvasVisible && cwd]
  .app-footer
```

### Target Layout Structure (Phase 12)
```
.app (flex column)
  .folder-bar
  .app-body (flex row, flex: 1)
    .sidebar (unchanged)
    .resize-handle (col-resize)
    .main-area (flex: 1, flex-direction: column, min-width: 280px)
      .terminal-area (flex: 1)                     [unchanged — grows to fill remaining]
      .resize-handle--h                             [new — shown when panel is open]
      .bottom-panel (flex-shrink: 0, height: N)     [new — shown when open]
        .bottom-panel-tab-bar                       [new — tab bar scaffold]
          .bottom-panel-tab-bar-tabs                [new — placeholder, no active tabs yet]
          .bottom-panel-toggle-btn                  [new — collapse button, always rendered here]
        .bottom-panel-body                          [new — content area, empty in Phase 12]
    .resize-handle (col-resize)
    .editor-panel                                   [unchanged]
    .resize-handle (col-resize)
    .canvas-column                                  [unchanged]
  .app-footer
```

### Pattern 1: Height-driven bottom panel with collapse toggle
**What:** `bottomPanelOpen` boolean controls whether the panel renders. `bottomPanelHeight` is the useDragResize value. The toggle button is always visible inside the tab bar (not conditionally rendered), so users can always re-open the panel.
**When to use:** This is the established pattern — `isCanvasVisible` in Phase 11 used the same approach.
**Example:**
```typescript
// In App.tsx — mirrors canvasVisible/canvasWidth pattern exactly
const BOTTOM_PANEL_DEFAULT_HEIGHT = 200;
const BOTTOM_PANEL_MIN = 80;
const BOTTOM_PANEL_MAX_RATIO = 0.5; // never exceed 50% of main-area height

const UI = {
  // existing entries ...
  bottomPanelOpen:   'slopmop_ui:bottom_panel_open',
  bottomPanelHeight: 'slopmop_ui:bottom_panel_height',
} as const;

const [bottomPanelOpen, setBottomPanelOpen] = useState<boolean>(() =>
  uiRead<boolean>(UI.bottomPanelOpen, false)
);
const [bottomPanelInitHeight] = useState(() =>
  Math.max(BOTTOM_PANEL_MIN, uiRead(UI.bottomPanelHeight, BOTTOM_PANEL_DEFAULT_HEIGHT))
);
const bottomPanelMaxRef = useRef<number>(Infinity);
const bottomPanel = useDragResize(bottomPanelInitHeight, BOTTOM_PANEL_MIN, 'up', bottomPanelMaxRef);

// Drag-end persistence (mirrors prevCanvasDragging pattern)
const prevBottomPanelDragging = useRef(false);
useEffect(() => {
  if (prevBottomPanelDragging.current && !bottomPanel.isDragging)
    uiWrite(UI.bottomPanelHeight, bottomPanel.width); // useDragResize uses 'width' internally for all axes
  prevBottomPanelDragging.current = bottomPanel.isDragging;
}, [bottomPanel.isDragging, bottomPanel.width]);

const toggleBottomPanel = useCallback(() => {
  setBottomPanelOpen(v => {
    uiWrite(UI.bottomPanelOpen, !v);
    return !v;
  });
}, []);
```

**Important:** `useDragResize` uses the name `width` for its dimension value regardless of axis. For vertical drag, `bottomPanel.width` is the height in pixels.

### Pattern 2: Tab bar scaffold matching session-tab-bar visual language
**What:** A horizontal bar across the top of the bottom panel, with a placeholder tab slot on the left and a toggle button on the right. Uses same CSS variables and sizing as `.session-tab-bar` (height 32px, background: var(--surface), border-bottom: 1px solid var(--border)).
**When to use:** Phase 12 — renders empty tab slots or a static "Terminal" label placeholder. Phase 13 will replace with live tab components.
**Example:**
```tsx
<div className="bottom-panel-tab-bar">
  <div className="bottom-panel-tab-bar-tabs">
    {/* Phase 13 will insert tab components here */}
  </div>
  <button
    className="bottom-panel-toggle-btn"
    title={bottomPanelOpen ? 'Collapse panel' : 'Expand panel'}
    onClick={toggleBottomPanel}
  >
    {/* chevron-down when open, chevron-up when closed */}
  </button>
</div>
```

### Pattern 3: Max height update per render
**What:** `bottomPanelMaxRef.current` must be updated every render to prevent the panel from growing taller than the available main-area space. The main-area height is `window.innerHeight` minus folder-bar, health-bar, and footer heights — but those are difficult to measure reliably. A safe approximation: cap at 50% of window.innerHeight.
**When to use:** Same as `canvasMaxRef.current` update pattern in the layout max-width refs block.
**Example:**
```typescript
// In the "Layout max-width refs (updated every render)" block in App.tsx
bottomPanelMaxRef.current = Math.floor(window.innerHeight * BOTTOM_PANEL_MAX_RATIO);
```

### Anti-Patterns to Avoid
- **Putting the toggle button outside the bottom panel tab bar:** The toggle must always be visible regardless of panel state. The safest placement is inside the tab bar which is rendered regardless of `bottomPanelOpen`. Do NOT hide the toggle when the panel is closed.
- **Using `height: 0` or `display: none` to collapse instead of conditional render:** The panel is empty in Phase 12; conditional rendering is simpler. Phase 13 will revisit if PTY processes need to survive toggle.
- **Forgetting that `useDragResize` calls its dimension `width` even for vertical axes:** `bottomPanel.width` holds the height in pixels. Naming a variable `height` locally is fine, but the hook property is always `width`.
- **Not rendering the tab bar when panel is closed:** The toggle button must be reachable when closed. Options: (a) always render the tab bar regardless of open state (recommended), or (b) add a persistent edge button elsewhere. Option (a) is simpler and consistent with Phase 11's always-visible canvas header pattern.
- **Using a raw hex color:** CLAUDE.md is explicit — use CSS variables only. No hardcoded hex values.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-to-resize panel height | Custom mousedown/mousemove | `useDragResize('up', ...)` | Already handles min/max clamping, drag state, and cleanup |
| Persist height and open state | Raw localStorage.setItem | `uiRead`/`uiWrite` + prevDragging ref pattern | Exact pattern established by sidebar, editor, canvas |
| Tab bar visual style | New tab component from scratch | Mirror `.session-tab-bar` CSS classes | Same look, same token sizes — reuse the established language |
| Horizontal resize separator | Custom styled div | `.resize-handle--h` CSS class | Already defined, already has hover/dragging states |

**Key insight:** Phase 12 is pure plumbing — it adds bottom panel infrastructure using 100% existing primitives. The value is in getting the scaffold right (dimensions, persistence, toggle) so Phase 13 can slot PTY tabs into `.bottom-panel-body` without touching the shell.

## Common Pitfalls

### Pitfall 1: Toggle button unreachable when panel is collapsed
**What goes wrong:** If the toggle button is rendered inside the panel body or conditional on `bottomPanelOpen`, users can't re-open the panel.
**Why it happens:** Modeling it the same as a content section rather than as a persistent affordance.
**How to avoid:** Render the tab bar (which contains the toggle button) unconditionally — or at minimum always render the toggle button regardless of open state. The Phase 11 canvas column solved this with a separate button in FolderPicker; for the bottom panel, including the toggle in the always-visible tab bar is cleaner.
**Warning signs:** After closing the panel, no UI element exists to re-open it.

### Pitfall 2: `useDragResize` `width` property naming confusion
**What goes wrong:** Developer references `bottomPanel.height` (undefined) instead of `bottomPanel.width`.
**Why it happens:** `useDragResize` uses a single `width` property for the controlled dimension, regardless of whether it's horizontal or vertical.
**How to avoid:** When destructuring, rename locally: `const { width: bottomPanelHeight, ... } = bottomPanel;` or just use `bottomPanel.width` directly in the style.
**Warning signs:** Bottom panel renders at 0px or at the initial value and never changes on drag.

### Pitfall 3: Bottom panel grows into the composer or terminal area
**What goes wrong:** Dragging the resize handle too far up collapses the terminal area to zero height.
**Why it happens:** `bottomPanelMaxRef.current` not set, or set too generously.
**How to avoid:** Set `bottomPanelMaxRef.current = Math.floor(window.innerHeight * 0.5)` each render. The terminal area has `flex: 1` so it will absorb remaining space — but with a very large bottom panel it can shrink to near zero. A 50% cap is a safe first approximation. A tighter cap (e.g. `innerHeight - folderBarHeight - 200`) is more correct but requires measuring the folder bar.
**Warning signs:** Terminal area disappears or composer becomes inaccessible when panel is large.

### Pitfall 4: Drag-end persistence writes on every pixel
**What goes wrong:** `localStorage.setItem` called on every `bottomPanel.width` change during drag, hammering storage and triggering excessive renders.
**Why it happens:** Writing in a `useEffect` without the `prevBottomPanelDragging` guard.
**How to avoid:** Use the same prevDragging ref pattern already established for sidebar, editor, and canvas:
```typescript
useEffect(() => {
  if (prevBottomPanelDragging.current && !bottomPanel.isDragging)
    uiWrite(UI.bottomPanelHeight, bottomPanel.width);
  prevBottomPanelDragging.current = bottomPanel.isDragging;
}, [bottomPanel.isDragging, bottomPanel.width]);
```
**Warning signs:** localStorage being written hundreds of times per second during drag.

### Pitfall 5: Bottom panel default state should be closed
**What goes wrong:** Defaulting `bottomPanelOpen` to `true` causes the panel to appear on first launch even before any terminal tabs exist in Phase 13, wasting screen real estate.
**Why it happens:** Optimistic default without considering the Phase 13 use case.
**How to avoid:** Default to `false`. The panel is a scaffold — it should be closed until the user opens it or Phase 13 opens it automatically when the first terminal tab spawns.

## Code Examples

### State initialization in App.tsx
```typescript
// Add to UI const (alongside existing canvas keys)
const UI = {
  sidebarTab:        'slopmop_ui:sidebar_tab',
  sidebarWidth:      'slopmop_ui:sidebar_width',
  editorWidth:       'slopmop_ui:editor_width',
  editorTabs:        (cwd: string) => `slopmop_ui:editor_tabs:${cwd}`,
  canvasVisible:     'slopmop_ui:canvas_visible',
  canvasWidth:       'slopmop_ui:canvas_width',
  bottomPanelOpen:   'slopmop_ui:bottom_panel_open',   // new
  bottomPanelHeight: 'slopmop_ui:bottom_panel_height', // new
} as const;

// Add to layout constants block
const BOTTOM_PANEL_DEFAULT_HEIGHT = 200;
const BOTTOM_PANEL_MIN = 80;

// Add to App() state block
const [bottomPanelOpen, setBottomPanelOpen] = useState<boolean>(() =>
  uiRead<boolean>(UI.bottomPanelOpen, false)
);
const [bottomPanelInitHeight] = useState(() =>
  Math.max(BOTTOM_PANEL_MIN, uiRead(UI.bottomPanelHeight, BOTTOM_PANEL_DEFAULT_HEIGHT))
);
const bottomPanelMaxRef = useRef<number>(Infinity);
const bottomPanel = useDragResize(bottomPanelInitHeight, BOTTOM_PANEL_MIN, 'up', bottomPanelMaxRef);

// Add to drag-end persistence block
const prevBottomPanelDragging = useRef(false);
useEffect(() => {
  if (prevBottomPanelDragging.current && !bottomPanel.isDragging)
    uiWrite(UI.bottomPanelHeight, bottomPanel.width);
  prevBottomPanelDragging.current = bottomPanel.isDragging;
}, [bottomPanel.isDragging, bottomPanel.width]);

const toggleBottomPanel = useCallback(() => {
  setBottomPanelOpen(v => {
    uiWrite(UI.bottomPanelOpen, !v);
    return !v;
  });
}, []);

// Add to layout max-width refs block
bottomPanelMaxRef.current = Math.floor(window.innerHeight * 0.5);
```

### JSX inside .main-area
```tsx
<div className="main-area">
  {/* existing terminal area — unchanged */}
  <div
    className="terminal-area"
    style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    onClick={() => composerRef.current?.focus()}
  >
    {/* ... SessionTabBar + SessionPanes unchanged ... */}
  </div>

  {/* Bottom panel — tab bar always rendered (contains toggle), body conditional */}
  <div className="bottom-panel-tab-bar">
    <div className="bottom-panel-tab-bar-tabs">
      {/* Phase 13 will insert tab components here */}
    </div>
    <button
      className="bottom-panel-toggle-btn"
      title={bottomPanelOpen ? 'Collapse panel' : 'Expand panel'}
      onClick={toggleBottomPanel}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        {bottomPanelOpen
          ? <polyline points="18 15 12 9 6 15" />   /* chevron-up = collapse */
          : <polyline points="6 9 12 15 18 9" />     /* chevron-down = expand */
        }
      </svg>
    </button>
  </div>

  {bottomPanelOpen && (
    <>
      <div
        className={`resize-handle--h${bottomPanel.isDragging ? ' dragging' : ''}`}
        onMouseDown={bottomPanel.onMouseDown}
      />
      <div
        className="bottom-panel"
        style={{ height: bottomPanel.width }}
      >
        <div className="bottom-panel-body">
          {/* Phase 13 content goes here */}
        </div>
      </div>
    </>
  )}
</div>
```

### CSS additions to App.css
```css
/* ── Bottom panel ─────────────────────────────────────────────── */

.bottom-panel-tab-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  height: 32px;
  background: var(--surface);
  border-top: 1px solid var(--border);
}

.bottom-panel-tab-bar-tabs {
  flex: 1;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.bottom-panel-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--txt-dim);
  padding: 4px 8px;
  height: 100%;
  transition: color 0.12s, background 0.12s;
}
.bottom-panel-toggle-btn:hover {
  color: var(--txt);
  background: var(--surface-hover);
}

.bottom-panel {
  flex-shrink: 0;
  overflow: hidden;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}

.bottom-panel-body {
  flex: 1;
  overflow: hidden;
}
```

**Note on resize handle ordering:** The `.resize-handle--h` sits between the tab bar and the panel body when the panel is open. The drag handle grows the panel upward — dragging up increases `bottomPanel.width` (the height). This matches the `'up'` direction in `useDragResize`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No bottom panel | Bottom panel shell with collapse toggle | Phase 12 | Creates docking zone for Phase 13 raw terminal tabs |
| Session tab bar at top of terminal area | Same (unchanged) | — | The top session bar is for Claude agent sessions; bottom panel tab bar is for raw shell sessions |

**No deprecated patterns involved.** This is additive layout work using existing project infrastructure.

## Open Questions

1. **Should the tab bar render when panel is closed?**
   - What we know: The toggle button must always be reachable. The `.bottom-panel-tab-bar` contains the toggle.
   - Recommendation: Always render `.bottom-panel-tab-bar`. When closed it shows only the toggle button (the tabs div is empty in Phase 12 anyway). This is a 32px strip at the bottom of `.main-area` — minimal visual cost, maximum discoverability.

2. **Where exactly does the resize handle go — above or below the tab bar?**
   - What we know: The `'up'` direction in useDragResize grows the panel upward when dragging upward. The handle is the drag target.
   - Recommendation: Place the `.resize-handle--h` between the tab bar and the `.bottom-panel` body. This means: tab bar (always visible) → resize handle (when open) → panel body (when open). Dragging the handle directly above the panel content is the most natural UX.

3. **Should the panel default open or closed?**
   - Recommendation: Default closed (`false`). The bottom panel is empty in Phase 12 — no point showing it. Phase 13 can open it when the first raw terminal tab is spawned.

4. **Max height calculation — 50% or measured?**
   - What we know: Measuring DOM elements for max height is complex and ties into ResizeObserver territory.
   - Recommendation: Use `Math.floor(window.innerHeight * 0.5)` as a pragmatic cap. This matches the canvas column's `window.innerWidth * 0.7` approach from Phase 11.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.0 + @testing-library/react ^16 |
| Config file | vitest.config.ts (project root) |
| Quick run command | `npm test -- --reporter=verbose bottom-panel` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

Phase 12 requirements are not formally named. Based on the phase description, the behaviors to test are:

| Behavior ID | Behavior | Test Type | Automated Command | File Exists? |
|-------------|----------|-----------|-------------------|-------------|
| BPANEL-01 | Bottom panel tab bar is always rendered (contains toggle button) | unit (React) | `npm test -- App.bottomPanel` | ❌ Wave 0 |
| BPANEL-02 | Bottom panel body hidden when `bottomPanelOpen` is false | unit (React) | `npm test -- App.bottomPanel` | ❌ Wave 0 |
| BPANEL-03 | Bottom panel body shown with correct height style when `bottomPanelOpen` is true | unit (React) | `npm test -- App.bottomPanel` | ❌ Wave 0 |
| BPANEL-04 | Toggle button flips `bottomPanelOpen` and persists to localStorage | unit (React) | `npm test -- App.bottomPanel` | ❌ Wave 0 |
| BPANEL-05 | Panel height restored from localStorage on mount | unit (React) | `npm test -- App.bottomPanel` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- --reporter=verbose` on affected test file
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/App.bottomPanel.test.tsx` — covers BPANEL-01 through BPANEL-05
- No framework install needed — Vitest + RTL already configured

## Sources

### Primary (HIGH confidence)
- Direct code reading of `client/App.tsx` (full file, 647 lines) — current layout structure post-Phase 11, useDragResize wiring for sidebar/editor/canvas, uiRead/uiWrite pattern, UI const keys, layout max-width refs block, prevDragging ref pattern
- Direct code reading of `client/hooks/useDragResize.ts` — `'up'` direction confirmed, `width` property name applies to all axes, maxRef clamping
- Direct code reading of `client/App.css` — `.main-area`, `.resize-handle--h`, `.session-tab-bar`, `.canvas-column`, `.canvas-column-header`, `.canvas-toggle-btn` patterns
- Direct code reading of `.planning/phases/11-canvas-panel-extraction/11-RESEARCH.md` — architecture decisions from Phase 11 that Phase 12 must follow
- Direct code reading of `.planning/config.json` — nyquist_validation: true

### Secondary (MEDIUM confidence)
- CLAUDE.md design system rules — confirmed font/color/spacing/border constraints for new CSS

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, no external research needed
- Architecture: HIGH — layout structure fully read from source, all existing patterns confirmed, Phase 12 is additive with no structural conflicts
- Pitfalls: HIGH — derived from reading actual code; pitfalls are exact parallels of Phase 11 patterns
- Test mapping: MEDIUM — requirement IDs are inferred from phase description, not formal specs

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (stable codebase — no fast-moving dependencies)
