# Phase 2: File System - Research

**Researched:** 2026-04-30
**Domain:** File tree UI, backend file/git APIs, file preview, @path syntax injection
**Confidence:** HIGH

## Summary

Phase 2 adds a VSCode-style file explorer sidebar to the existing SlopMop app. The codebase is a React 19 + Vite client with an Express/TypeScript server that already has REST endpoints (pick-folder, homedir, health) and a WebSocket layer for PTY. Phase 2 extends the server with new REST endpoints (file tree, file read, git status) and adds new React components (FileTree, FilePreviewPanel, attachment state in Composer).

The key architectural insight is that the file tree data lives on the server (Node.js has filesystem access; the browser does not), so all file/git operations are server-side REST calls. The client renders the tree from JSON and manages attachment/preview state locally. The @path syntax for FILE-04 requires prepending attached file paths to the message text before sending to the PTY — no library is needed, it's string concatenation.

**Primary recommendation:** Build thin REST endpoints using Node.js built-in `fs/promises` + `child_process.execFile('git', ['status', '--porcelain'])`. Build the file tree UI as a hand-rolled recursive React component (no heavy tree library). Use `isbinaryfile` for binary detection in the preview endpoint.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FILE-01 | VSCode-style collapsible file tree sidebar for selected folder | Recursive React component + GET /api/files?cwd= endpoint returning JSON tree |
| FILE-02 | Toggle between "All Files" and "Changes Only" (git-changed files) | GET /api/git-status?cwd= using `git status --porcelain` via child_process; filter tree client-side |
| FILE-03 | Select files to attach with image/text previews before sending | Client state array of selected paths; preview via GET /api/file?cwd=&path=; binary detection with isbinaryfile |
| FILE-04 | Attached files passed to Claude CLI via @path syntax on send | String prepend in Composer.onSend: "@/abs/path1 @/abs/path2\n" + original message |
| FILE-05 | Click file in explorer to preview contents in side panel | Reuse same /api/file endpoint; separate "preview" vs "attached" selection state |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs/promises` | built-in | File tree traversal, file reading | No dependency; modern async API; already used in project |
| Node.js `child_process.execFile` | built-in | Run `git status --porcelain` | Already used in server (osascript) — consistent pattern |
| React 19 | already installed | File tree component, preview panel, attachment state | Project stack |
| Express 4 | already installed | New REST endpoints for file/git APIs | Project stack |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `isbinaryfile` | ^5.0.0 | Detect binary vs text files for preview | Needed by FILE-05 preview endpoint to avoid serving garbled binary text |
| chokidar | v5 (ESM-only, Node 20+) | Optional: live-reload file tree on changes | Only if live file tree polling is desired; NOT required for v1 — defer to v2 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled recursive tree | react-arborist, react-complex-tree | Libraries add bundle weight and style override complexity; tree is simple enough without |
| `child_process.execFile` for git | `simple-git` npm package | simple-git adds a dep; execFile('git', ['status', '--porcelain']) is 3 lines and zero deps |
| `isbinaryfile` | Manual null-byte detection | Manual detection misses edge cases; isbinaryfile is a well-tested 5KB package |
| fetch-on-click for preview | Preload all file content in tree payload | Preloading large repos would be slow; lazy-load per click is correct |

**Installation:**
```bash
npm install isbinaryfile
```

## Architecture Patterns

### Recommended Project Structure
```
server/
├── index.ts          # Add new routes: /api/files, /api/file, /api/git-status
├── file-api.ts       # NEW: file tree traversal + file read helpers
├── pty-manager.ts    # Unchanged
└── ws-handler.ts     # Unchanged

client/
├── App.tsx           # Add layout: sidebar panel + preview panel + attachment state
├── App.css           # Add sidebar/split-pane CSS
├── components/
│   ├── FileTree.tsx      # NEW: recursive collapsible file tree
│   ├── FilePreview.tsx   # NEW: preview panel (text/image)
│   ├── AttachBar.tsx     # NEW: shows attached files with remove + inline preview
│   ├── Composer.tsx      # MODIFIED: accept attachments prop, prepend @paths on send
│   ├── Terminal.tsx      # Unchanged
│   └── FolderPicker.tsx  # Unchanged
└── hooks/
    ├── useFileTree.ts    # NEW: fetch /api/files, toggle all/changes mode
    ├── usePty.ts         # Unchanged
    └── useResize.ts      # Unchanged

shared/
└── protocol.ts       # Unchanged (file API is REST, not WebSocket)
```

### Pattern 1: Server File Tree Endpoint
**What:** Express GET endpoint reads directory recursively with `fs.readdir({ recursive: true, withFileTypes: true })` and returns a nested JSON tree.
**When to use:** On every folder connect and on manual refresh.
**Example:**
```typescript
// server/file-api.ts
import { readdir, stat } from 'fs/promises';
import path from 'path';

export interface FileNode {
  name: string;
  path: string;       // absolute path
  type: 'file' | 'dir';
  children?: FileNode[];
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', '__pycache__']);

export async function buildFileTree(root: string): Promise<FileNode[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nodes: FileNode[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env') continue; // skip hidden except .env
    const absPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      nodes.push({
        name: entry.name,
        path: absPath,
        type: 'dir',
        children: await buildFileTree(absPath),
      });
    } else {
      nodes.push({ name: entry.name, path: absPath, type: 'file' });
    }
  }
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
```

### Pattern 2: Git Status Endpoint
**What:** Runs `git status --porcelain` in the cwd, parses output into a Set of absolute changed file paths.
**When to use:** When user toggles to "Changes Only" mode.
**Example:**
```typescript
// server/file-api.ts
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

export async function getGitChangedPaths(cwd: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd });
    return stdout
      .split('\n')
      .filter(Boolean)
      .map(line => {
        // porcelain format: "XY filename" — filename starts at col 3
        const relPath = line.slice(3).trim().replace(/^"(.*)"$/, '$1'); // unquote if needed
        return path.join(cwd, relPath);
      });
  } catch {
    return []; // not a git repo or git not available
  }
}
```

### Pattern 3: File Preview Endpoint
**What:** Server reads file, detects binary vs text, returns JSON with content or base64.
**When to use:** When user clicks a file or selects it for attachment preview.
**Example:**
```typescript
// server/index.ts — new route
import { isBinaryFile } from 'isbinaryfile';

app.get('/api/file', async (req, res) => {
  const { cwd, path: relPath } = req.query as { cwd: string; path: string };
  const absPath = path.resolve(cwd, relPath);
  // Security: ensure absPath is within cwd
  if (!absPath.startsWith(path.resolve(cwd))) {
    res.status(403).json({ error: 'Path outside cwd' });
    return;
  }
  try {
    const buffer = await readFile(absPath);
    const binary = await isBinaryFile(buffer);
    if (binary) {
      const ext = path.extname(absPath).toLowerCase();
      const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext);
      res.json({ type: 'binary', isImage, base64: buffer.toString('base64'), ext });
    } else {
      res.json({ type: 'text', content: buffer.toString('utf-8') });
    }
  } catch {
    res.status(404).json({ error: 'File not found' });
  }
});
```

### Pattern 4: @path Syntax Injection in Composer
**What:** Before sending, prepend `@absPath` tokens to the message text.
**When to use:** Any time `attachments.length > 0` when Enter is pressed.
**Example:**
```typescript
// client/components/Composer.tsx modification
const handleSend = () => {
  const atPaths = attachments.map(p => `@${p}`).join(' ');
  const fullMessage = atPaths ? `${atPaths}\n${value}` : value;
  onSend(fullMessage + '\r');
  setValue('');
  clearAttachments();
};
```

### Pattern 5: Recursive File Tree React Component
**What:** Hand-rolled recursive component; each directory node is a collapsible `<details>` or a state-toggled `<div>`.
**When to use:** Always — no library needed for this simple use case.
**Example:**
```tsx
// client/components/FileTree.tsx
interface FileNode { name: string; path: string; type: 'file' | 'dir'; children?: FileNode[]; }

function FileNode({ node, selected, onSelect, onPreview, changedPaths }: NodeProps) {
  const [open, setOpen] = useState(true);
  const isChanged = changedPaths?.has(node.path);

  if (node.type === 'dir') {
    return (
      <div className="ft-dir">
        <div className="ft-dir-header" onClick={() => setOpen(o => !o)}>
          <span className="ft-caret">{open ? '▾' : '▸'}</span>
          <span className="ft-name">{node.name}</span>
        </div>
        {open && node.children?.map(c => (
          <FileNode key={c.path} node={c} {...rest} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`ft-file ${selected.has(node.path) ? 'ft-selected' : ''} ${isChanged ? 'ft-changed' : ''}`}
      onClick={() => onPreview(node.path)}
      onDoubleClick={() => onSelect(node.path)}
    >
      {node.name}
    </div>
  );
}
```

### Pattern 6: App Layout with Sidebar
**What:** CSS flex layout — sidebar (file tree) on left, main area (terminal + composer) takes remaining width, optional preview panel on right.
**When to use:** Root App.tsx layout change.
**Example:**
```css
/* App.css additions */
.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.sidebar {
  width: 240px;
  min-width: 160px;
  flex-shrink: 0;
  overflow-y: auto;
  background: #161b22;
  border-right: 1px solid #30363d;
}
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.preview-panel {
  width: 320px;
  flex-shrink: 0;
  overflow: auto;
  background: #0d1117;
  border-left: 1px solid #30363d;
}
```

### Anti-Patterns to Avoid
- **Path traversal without validation:** The `/api/file` endpoint MUST verify `absPath.startsWith(path.resolve(cwd))` before reading any file. Never serve arbitrary filesystem paths.
- **Loading entire file content in the tree:** Only return metadata (name, path, type) in the tree endpoint. Fetch content lazily on click/select.
- **Sending file content over WebSocket:** File content APIs use REST (GET), not the existing WebSocket connection. WebSocket is PTY-only.
- **Using `fs.watch` natively for live reload:** Native fs.watch is unreliable cross-platform. Use polling on refresh button for v1; chokidar if live-refresh is ever needed.
- **Adding hidden dotfiles to tree by default:** Skip `.git`, `.DS_Store`, etc. to avoid cluttering the tree with noise.
- **Blocking the server event loop on large dirs:** Use `fs.promises` (async) throughout, never `fs.readdirSync` in request handlers.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Binary file detection | Null-byte scan, extension check | `isbinaryfile` | Handles edge cases: UTF-16, BOM, mixed files, 5KB package |
| Git changed file parsing | Custom porcelain parser | `git status --porcelain` + 3-line slice(3) | Porcelain v1 is stable; custom parsers break on renames/copies |

**Key insight:** The rest of this phase (file tree, preview, attachment state, @path injection) is straightforward enough to hand-roll with React + Node built-ins. No heavy libraries needed.

## Common Pitfalls

### Pitfall 1: Path Traversal Security Hole
**What goes wrong:** `/api/file?cwd=/home/user/project&path=../../etc/passwd` returns system files.
**Why it happens:** Naive `path.join(cwd, relPath)` without validation.
**How to avoid:** Always `path.resolve()` both sides and check `absPath.startsWith(resolvedCwd)`.
**Warning signs:** Any endpoint accepting a path parameter without explicit bounds-check.

### Pitfall 2: Git Command Fails Silently on Non-Git Repos
**What goes wrong:** User opens a folder that isn't a git repo; `git status` throws; Changes Only shows nothing or crashes.
**Why it happens:** `execFile('git', ['status'])` rejects if not a git repo.
**How to avoid:** Wrap in try/catch, return empty array `[]`, surface "Not a git repo" in UI toggle.
**Warning signs:** Uncaught promise rejection in server logs.

### Pitfall 3: Large Repos Slow Tree Load
**What goes wrong:** Monorepos with thousands of files cause the `/api/files` endpoint to hang for seconds.
**Why it happens:** Recursive directory traversal is O(n files).
**How to avoid:** Skip `node_modules`, `dist`, `.git` during traversal (already in Pattern 1). Add a max-depth guard (e.g., depth <= 8).
**Warning signs:** Tree endpoint takes >500ms on a typical project.

### Pitfall 4: Attachment State Survives Folder Change
**What goes wrong:** User switches folder, but old attached file paths from the previous folder are still in state and get injected as @paths into the new session.
**Why it happens:** Attachment state in App.tsx/Composer not cleared when `cwd` changes.
**How to avoid:** `useEffect(() => { clearAttachments(); }, [cwd])` in App.tsx.
**Warning signs:** @path pointing to a file outside current cwd.

### Pitfall 5: Image Preview via Base64 is Large
**What goes wrong:** Sending a 5MB image as base64 in JSON bloats the HTTP response to 7MB.
**Why it happens:** base64 is 33% larger than binary; JSON is text-only.
**How to avoid:** For images in the preview panel, use `res.sendFile()` with proper Content-Type instead of base64 JSON. Only use base64 for the AttachBar inline thumbnail (small, bounded).
**Warning signs:** Network tab shows multi-MB JSON responses.

### Pitfall 6: @path Requires Absolute Paths
**What goes wrong:** Claude CLI receives `@src/index.ts` (relative), can't find the file.
**Why it happens:** Claude CLI resolves @paths relative to its own cwd — which is the selected folder, so relative paths could work, but absolute is safer and unambiguous.
**How to avoid:** Always store absolute paths in attachment state. The file tree already stores `absPath` per node.
**Warning signs:** Claude CLI responds "file not found" or ignores the @path.

## Code Examples

### File Tree Endpoint (verified pattern)
```typescript
// Source: Node.js official docs + project pattern (server/index.ts style)
app.get('/api/files', async (req, res) => {
  const { cwd } = req.query as { cwd: string };
  if (!cwd) { res.status(400).json({ error: 'cwd required' }); return; }
  try {
    const tree = await buildFileTree(path.resolve(cwd));
    res.json({ tree });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
```

### Git Status Endpoint
```typescript
// Source: git-scm.com porcelain format docs
app.get('/api/git-status', async (req, res) => {
  const { cwd } = req.query as { cwd: string };
  const changed = await getGitChangedPaths(path.resolve(cwd));
  res.json({ changed });
});
```

### useFileTree Hook
```typescript
// client/hooks/useFileTree.ts
export function useFileTree(cwd: string | null) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [changedPaths, setChangedPaths] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'all' | 'changes'>('all');

  useEffect(() => {
    if (!cwd) return;
    fetch(`/api/files?cwd=${encodeURIComponent(cwd)}`)
      .then(r => r.json())
      .then(d => setTree(d.tree));
  }, [cwd]);

  const loadChanges = useCallback(() => {
    if (!cwd) return;
    fetch(`/api/git-status?cwd=${encodeURIComponent(cwd)}`)
      .then(r => r.json())
      .then(d => setChangedPaths(new Set(d.changed)));
  }, [cwd]);

  useEffect(() => {
    if (mode === 'changes') loadChanges();
  }, [mode, loadChanges]);

  return { tree, changedPaths, mode, setMode };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fs.readdir` + manual recursive | `fs.readdir({ recursive: true })` | Node.js 18.17 | Simpler, but returns flat list not nested tree — nested tree still needs manual build |
| chokidar v3 (CJS) | chokidar v5 (ESM-only) | Nov 2025 | Project uses ESM (`"type": "module"`) — v5 is compatible, but v1 doesn't need live watch |
| FileReader.readAsDataURL | URL.createObjectURL (for blob previews) | ~2022 | createObjectURL is synchronous and memory-efficient; preferred for image previews when the blob is locally available |

**Deprecated/outdated:**
- `react-split-pane` (tomkp): Unmaintained since ~2021 — use CSS flex instead for this simple two-panel layout.

## Open Questions

1. **Should the file tree auto-refresh when files change?**
   - What we know: chokidar v5 (ESM) can watch the fs and SSE can push updates
   - What's unclear: Is live refresh needed for v1 or is manual refresh (re-fetch on folder open) sufficient?
   - Recommendation: v1 uses manual refresh only (refresh button or re-connect). Live watch is a v2 feature (would need chokidar + SSE setup).

2. **Should hidden dotfiles be shown?**
   - What we know: .env, .gitignore etc. are frequently referenced in Claude sessions
   - What's unclear: User preference — VSCode hides dot-items by default in some modes
   - Recommendation: Show dotfiles in tree by default (users of SlopMop are developers); skip .git dir itself.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3 + jsdom + @testing-library/react |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILE-01 | FileTree renders nodes from JSON tree | unit | `npm test -- tests/FileTree.test.tsx -t "renders file tree"` | Wave 0 |
| FILE-01 | FileTree collapses/expands directory on click | unit | `npm test -- tests/FileTree.test.tsx -t "toggle dir"` | Wave 0 |
| FILE-02 | useFileTree toggles mode and calls /api/git-status | unit | `npm test -- tests/useFileTree.test.ts -t "changes mode"` | Wave 0 |
| FILE-02 | Git-changed files are highlighted in tree | unit | `npm test -- tests/FileTree.test.tsx -t "changedPaths"` | Wave 0 |
| FILE-03 | Selecting file adds to attachment state | unit | `npm test -- tests/FileTree.test.tsx -t "select file"` | Wave 0 |
| FILE-03 | Preview panel shows text content for text file | unit | `npm test -- tests/FilePreview.test.tsx -t "text preview"` | Wave 0 |
| FILE-03 | Preview panel shows image tag for binary image | unit | `npm test -- tests/FilePreview.test.tsx -t "image preview"` | Wave 0 |
| FILE-04 | Composer prepends @paths when attachments present | unit | `npm test -- tests/Composer.test.tsx -t "@path injection"` | Wave 0 |
| FILE-04 | Empty attachments: no @paths prepended | unit | `npm test -- tests/Composer.test.tsx -t "no attachment"` | Wave 0 (extend existing) |
| FILE-05 | Clicking file triggers onPreview with abs path | unit | `npm test -- tests/FileTree.test.tsx -t "preview click"` | Wave 0 |
| FILE-05 | /api/file returns text content for .ts file | integration/manual | manual — server endpoint | N/A |

### Sampling Rate
- **Per task commit:** `npm test -- tests/FileTree.test.tsx tests/useFileTree.test.ts tests/Composer.test.tsx tests/FilePreview.test.tsx`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/FileTree.test.tsx` — covers FILE-01, FILE-02, FILE-03, FILE-05
- [ ] `tests/useFileTree.test.ts` — covers FILE-02 hook logic
- [ ] `tests/FilePreview.test.tsx` — covers FILE-03, FILE-05 preview rendering
- [ ] Extend `tests/Composer.test.tsx` — add FILE-04 @path injection cases (file exists)

## Sources

### Primary (HIGH confidence)
- Node.js official docs (nodejs.org/api/fs.html) — `fs.readdir({ withFileTypes: true })`, `fs/promises`
- git-scm.com/docs/git-status — `--porcelain` format specification
- Project codebase review — existing server patterns (execFileAsync, express routes, shared protocol), client patterns (React hooks, component structure)

### Secondary (MEDIUM confidence)
- [isbinaryfile npm](https://www.npmjs.com/package/isbinaryfile) — binary detection for Node.js
- [chokidar GitHub](https://github.com/paulmillr/chokidar) — v5 ESM-only, Node 20+
- [MDN FileReader.readAsDataURL](https://developer.mozilla.org/en-US/docs/Web/API/FileReader/readAsDataURL) — browser file reading API
- [Claude Code @path docs](https://code.claude.com/docs/en/common-workflows) — @path is client-side eager file loading

### Tertiary (LOW confidence)
- Medium article on Claude Code @path vs bare path — not independently verified against latest Claude CLI version

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Node.js built-ins + existing project deps; no new significant dependencies
- Architecture: HIGH — REST pattern matches existing server; React component pattern matches existing client
- @path syntax: MEDIUM — confirmed by multiple sources; actual Claude CLI behavior in this app is known to work (Phase 1 established PTY fidelity)
- Pitfalls: HIGH — path traversal and git-not-found are classic issues; documented from first principles

**Research date:** 2026-04-30
**Valid until:** 2026-07-30 (stable domain; Node.js fs API and git porcelain format are very stable)
